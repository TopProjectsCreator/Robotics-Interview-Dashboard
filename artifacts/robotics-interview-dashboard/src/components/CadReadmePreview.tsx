import { useQuery } from "@tanstack/react-query";
import type { CadModel } from "@workspace/api-client-react";

import { storageUrl } from "@/components/CadModelPreviewDialog";

const MAX_README_CHARS = 100_000;
const MAX_README_BYTES = 1024 * 1024;

function safeLinkTarget(href: string): string | null {
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

function renderInlineMarkdown(source: string, keyPrefix: string) {
  const tokens = /(\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = tokens.exec(source))) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    const tokenKey = `${keyPrefix}-${key++}`;
    if (match[2] !== undefined) {
      const href = safeLinkTarget(match[3]);
      nodes.push(href ? (
        <a key={tokenKey} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          {match[2]}
        </a>
      ) : match[2]);
    } else if (match[4] !== undefined) {
      nodes.push(<code key={tokenKey} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{match[4]}</code>);
    } else if (match[5] !== undefined || match[6] !== undefined) {
      nodes.push(<strong key={tokenKey}>{match[5] ?? match[6]}</strong>);
    } else {
      nodes.push(<em key={tokenKey}>{match[7] ?? match[8]}</em>);
    }
    cursor = tokens.lastIndex;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

function splitTableRow(row: string): string[] {
  return row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function SafeMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let key = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const blockKey = `readme-block-${key++}`;
    const fence = trimmed.match(/^```([\w+-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={blockKey} className="overflow-x-auto rounded-lg bg-muted p-3 text-sm">
          <code className="font-mono">{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const content = renderInlineMarkdown(heading[2], blockKey);
      const className = "font-semibold tracking-tight text-foreground";
      const margin = heading[1].length === 1 ? "text-2xl" : heading[1].length === 2 ? "text-xl" : "text-lg";
      const classNames = `${className} ${margin}`;
      const level = Math.min(heading[1].length, 6);
      const Heading = (["h1", "h2", "h3", "h4", "h5", "h6"] as const)[level - 1];
      blocks.push(<Heading key={blockKey} className={classNames}>{content}</Heading>);
      index += 1;
      continue;
    }

    if (/^([-*_])(?:\s*\1){2,}$/.test(trimmed)) {
      blocks.push(<hr key={blockKey} className="border-border" />);
      index += 1;
      continue;
    }

    if (trimmed.includes("|") && lines[index + 1]) {
      const alignments = splitTableRow(lines[index + 1]);
      if (alignments.length > 0 && alignments.every((cell) => /^:?-{1,}:?$/.test(cell))) {
        const headers = splitTableRow(trimmed);
        const rows: string[][] = [];
        index += 2;
        while (index < lines.length && lines[index].trim().includes("|")) {
          const row = splitTableRow(lines[index]);
          if (row.length === headers.length) rows.push(row);
          index += 1;
        }
        blocks.push(
          <div key={blockKey} className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-foreground">
                <tr>
                  {headers.map((header, cellIndex) => (
                    <th key={cellIndex} className="border-b border-border px-3 py-2 font-semibold">
                      {renderInlineMarkdown(header, `${blockKey}-header-${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="even:bg-muted/40">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border-b border-border px-3 py-2 text-foreground">
                        {renderInlineMarkdown(cell, `${blockKey}-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    if (/^>\s?/.test(trimmed)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={blockKey} className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
          {quote.map((text, quoteIndex) => (
            <p key={`${blockKey}-${quoteIndex}`}>{renderInlineMarkdown(text, `${blockKey}-${quoteIndex}`)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^([-*+]|\d+\.)\s+(.+)$/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={blockKey} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
          {items.map((item, itemIndex) => (
            <li key={`${blockKey}-${itemIndex}`}>{renderInlineMarkdown(item, `${blockKey}-${itemIndex}`)}</li>
          ))}
        </List>,
      );
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|>\s?|[-*+]\s+|\d+\.\s+)/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(
      <p key={blockKey}>{renderInlineMarkdown(paragraph.join(" "), blockKey)}</p>,
    );
  }

  return (
    <div className="prose prose-sm max-w-none space-y-3 text-foreground dark:prose-invert [&_a]:break-words [&_li]:text-foreground [&_p]:text-foreground [&_pre]:text-foreground">
      {blocks}
    </div>
  );
}

export function CadReadmePreview({ model }: { model: CadModel }) {
  const isTooLargeToPreview = model.sizeBytes > MAX_README_BYTES;
  const readme = useQuery({
    queryKey: ["/api/cad/readme", model.id, model.objectPath],
    queryFn: async () => {
      if (isTooLargeToPreview) {
        throw new Error("README is too large to preview here. Download it from its library card.");
      }
      const response = await fetch(storageUrl(model.objectPath), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "README file could not be found." : "README could not be loaded. Try again.");
      }
      return response.text();
    },
    enabled: !isTooLargeToPreview,
    retry: false,
  });

  return (
    <section
      aria-labelledby="cad-readme-heading"
      className="mt-6 rounded-xl border border-border bg-background p-4 text-foreground sm:p-6"
      data-testid="cad-readme-preview"
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 id="cad-readme-heading" className="text-base font-semibold text-foreground">README.md</h2>
        <span className="truncate text-xs text-muted-foreground">{model.fileName}</span>
      </div>
      {isTooLargeToPreview ? (
        <p className="text-sm text-muted-foreground" data-testid="cad-readme-too-large">
          README is larger than 1 MiB and can’t be previewed here. Download it from its library card.
        </p>
      ) : readme.isPending ? (
        <p role="status" className="text-sm text-muted-foreground" data-testid="cad-readme-loading">Loading README…</p>
      ) : readme.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3" role="alert" data-testid="cad-readme-error">
          <p className="text-sm text-destructive">{readme.error.message || "README could not be loaded. Try again."}</p>
          <button
            type="button"
            onClick={() => void readme.refetch()}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
            data-testid="cad-readme-retry"
          >
            Retry
          </button>
        </div>
      ) : (
        <SafeMarkdown
          source={
            readme.data.length > MAX_README_CHARS
              ? `${readme.data.slice(0, MAX_README_CHARS)}\n\n… README preview truncated.`
              : readme.data
          }
        />
      )}
    </section>
  );
}
