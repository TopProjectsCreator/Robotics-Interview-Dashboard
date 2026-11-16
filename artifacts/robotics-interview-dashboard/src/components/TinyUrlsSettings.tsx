import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  MousePointerClick,
  Trash2,
} from "lucide-react";
import {
  getListTinyUrlsQueryKey,
  useCreateTinyUrl,
  useDeleteTinyUrl,
  useListTinyUrls,
} from "@workspace/api-client-react";

const field =
  "h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm text-[#182232] outline-none placeholder:text-[#9aa8ae] focus:border-[#16869a] dark:border-[#31495a] dark:bg-[#0f1e27] dark:text-[#e6eef2] dark:placeholder:text-[#6b7f8a] dark:focus:border-[#3f8492]";
const accentButton =
  "flex h-10 items-center gap-1.5 rounded-lg border border-[#cbd9da] bg-white px-3 text-xs font-semibold text-[#385762] transition hover:border-[#16869a] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3a5567] dark:bg-[#182935] dark:text-[#c3d3db] dark:hover:border-[#3f8492]";
const removeButton =
  "rounded-lg border border-[#e0b8b4] bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#a34d46] transition hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#7d4038] dark:bg-[#22191b] dark:text-[#e89087] dark:hover:bg-[#3a211d]";
const iconButton =
  "rounded-lg border border-[#cbd9da] bg-white p-2 text-[#385762] transition hover:border-[#16869a] hover:text-[#16869a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:border-[#3a5567] dark:bg-[#182935] dark:text-[#c3d3db] dark:hover:border-[#3f8492] dark:hover:text-[#6fc3cf]";

const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

/** Mirror of the server: trim, reduce pasted short links to their alias, lowercase. */
function normalizeAlias(input: string): string {
  let alias = input.trim();
  const prefixMatch = alias.match(/^(?:https?:\/\/[^/\s]+)?\/?t\/([^/\s]+)\/?$/i);
  if (prefixMatch) return prefixMatch[1].toLowerCase();
  return alias.replace(/^\/+|\/+$/g, "").toLowerCase();
}

/** Mirror of the server: upgrade bare domains and host:port, require absolute http(s) with no userinfo. */
function normalizeTarget(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 2048) return null;
  const schemeMatch = raw.match(SCHEME_PATTERN);
  let parsed: URL;
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    const rest = raw.slice(schemeMatch[0].length);
    if (scheme === "http" || scheme === "https") {
      try {
        parsed = new URL(raw);
      } catch {
        return null;
      }
    } else if (/^\d/.test(rest)) {
      // Bare host:port typed without a scheme, e.g. "localhost:3000/console"
      try {
        parsed = new URL(`https://${raw}`);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  } else {
    try {
      parsed = new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || !parsed.hostname) return null;
  return parsed.toString();
}

/** Pull the server's { error } message out of an API failure. */
function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null | undefined)?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const message = (data as Record<string, unknown>).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatCreatedAt(value: unknown): string {
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Team tinyurls live on this site's own domain at /t/<alias> — the domain is
 * auto-detected from where the app is opened (no per-deployment setup), so a
 * link created here works everywhere the site does. Only team admins manage
 * them; anyone with the link can follow it.
 */
export function TinyUrlsSettings() {
  const queryClient = useQueryClient();
  const list = useListTinyUrls({
    query: { queryKey: getListTinyUrlsQueryKey(), retry: false },
  });
  const create = useCreateTinyUrl();
  const remove = useDeleteTinyUrl();
  const [aliasInput, setAliasInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const origin = window.location.origin;
  const normalizedAlias = normalizeAlias(aliasInput);
  const previewAlias = normalizedAlias || "your-alias";
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListTinyUrlsQueryKey() });

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
    } catch {
      setError("Clipboard copy was blocked. Select the link text and copy it manually.");
    }
  };

  const submit = () => {
    setError("");
    setNotice("");
    const alias = normalizeAlias(aliasInput);
    if (!ALIAS_PATTERN.test(alias)) {
      setError("Aliases use letters, numbers, hyphens, and underscores, start with a letter or number, and run up to 64 characters.");
      return;
    }
    const targetUrl = normalizeTarget(targetInput);
    if (!targetUrl) {
      setError("Enter a full web address like https://team.example.com/signup (bare domains are fine too). Only http and https links are supported.");
      return;
    }
    create.mutate(
      { data: { alias, targetUrl } },
      {
        onSuccess: (saved) => {
          setAliasInput("");
          setTargetInput("");
          const shortUrl = `${origin}${saved.path}`;
          setNotice(`Created ${shortUrl}`);
          void copy(shortUrl, saved.id);
          void refresh();
        },
        onError: (mutationError) => setError(apiErrorMessage(mutationError, "Could not create that tinyurl.")),
      },
    );
  };

  const removeLink = (id: string, alias: string) => {
    setError("");
    setNotice("");
    remove.mutate(
      { tinyUrlId: id },
      {
        onSuccess: () => {
          setNotice(`Deleted /t/${alias}.`);
          void refresh();
        },
        onError: (mutationError) => setError(apiErrorMessage(mutationError, "Could not delete that tinyurl.")),
      },
    );
  };

  const items = list.data?.items ?? [];
  const busy = create.isPending || remove.isPending;

  return (
    <div>
      <p className="text-xs leading-5 text-[#7c8c91] dark:text-[#93a8b2]">
        Short links on this site's own domain — the domain is auto-detected from where the app is opened, so a link created here works everywhere the site does.
        Great for flyers, QR codes, and slides. Anyone with the link can follow it; only team admins can create or delete them.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          value={targetInput}
          onChange={(event) => setTargetInput(event.target.value)}
          placeholder="Where it goes — https://team.example.com/signup"
          aria-label="Target URL"
          autoComplete="off"
          spellCheck={false}
          data-testid="input-tinyurl-target"
          className={`${field} min-w-0 flex-[2]`}
        />
        <input
          value={aliasInput}
          onChange={(event) => setAliasInput(event.target.value)}
          placeholder="alias — e.g. tryouts"
          aria-label="Custom alias"
          autoComplete="off"
          spellCheck={false}
          data-testid="input-tinyurl-alias"
          className={`${field} mono min-w-0 flex-1`}
        />
        <button type="submit" disabled={busy} data-testid="button-create-tinyurl" className={accentButton}>
          {create.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Link2 size={14} />}
          Create
        </button>
      </form>
      <p className="mono mt-2 truncate text-[11px] text-[#52666e] dark:text-[#b3c3cb]" data-testid="tinyurl-preview">
        {origin}/t/{previewAlias}
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-[#a34d46] dark:text-[#e89087]" data-testid="tinyurl-error">{error}</p>}
      {notice && <p role="status" className="mt-2 break-all text-xs text-[#12737d] dark:text-[#6fc3cf]" data-testid="tinyurl-notice">{notice}</p>}
      {list.isLoading && <p className="mt-3 text-xs text-[#7c8c91] dark:text-[#93a8b2]" data-testid="tinyurl-loading">Loading tinyurls…</p>}
      {list.isError && (
        <p className="mt-3 text-xs text-[#a34d46] dark:text-[#e89087]" data-testid="tinyurl-load-error">
          Could not load tinyurls.{" "}
          <button type="button" onClick={() => list.refetch()} className="font-semibold text-[#16869a] dark:text-[#6fc3cf]">Retry</button>
        </p>
      )}
      {list.data && (items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#7c8c91] dark:text-[#93a8b2]" data-testid="tinyurl-empty">
          <Link2 size={13} aria-hidden="true" />
          No tinyurls yet. Create one above — it works instantly.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const shortUrl = `${origin}${item.path}`;
            const copied = copiedId === item.id;
            return (
              <li
                key={item.id}
                data-testid={`tinyurl-entry-${item.alias}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e3ebeb] bg-white px-3 py-2 text-xs dark:border-[#31495a] dark:bg-[#0f1e27]"
              >
                <code className="mono rounded bg-[#eef3f2] px-2 py-0.5 text-[11px] font-semibold text-[#182232] dark:bg-[#16262f] dark:text-[#e6eef2]">/t/{item.alias}</code>
                <a
                  href={item.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={item.targetUrl}
                  className="max-w-[14rem] truncate text-[#52666e] underline decoration-dotted underline-offset-2 hover:text-[#16869a] dark:text-[#b3c3cb] dark:hover:text-[#6fc3cf]"
                  data-testid={`tinyurl-target-${item.alias}`}
                >
                  {item.targetUrl}
                </a>
                <span className="flex items-center gap-1 text-[#8a999d] dark:text-[#6b828c]" title="Clicks counted from real visits">
                  <MousePointerClick size={12} aria-hidden="true" />
                  {item.clickCount}
                </span>
                {item.createdByName && <span className="text-[#8a999d] dark:text-[#6b828c]">by {item.createdByName}</span>}
                {item.createdAt && <span className="text-[#8a999d] dark:text-[#6b828c]">{formatCreatedAt(item.createdAt)}</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(shortUrl, item.id)}
                    aria-label={`Copy ${shortUrl}`}
                    data-testid={`button-copy-tinyurl-${item.alias}`}
                    className={iconButton}
                  >
                    {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                  </button>
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${shortUrl}`}
                    data-testid={`button-open-tinyurl-${item.alias}`}
                    className={iconButton}
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeLink(item.id, item.alias)}
                    disabled={busy}
                    aria-label={`Delete /t/${item.alias}`}
                    data-testid={`button-delete-tinyurl-${item.alias}`}
                    className={`flex items-center gap-1 ${removeButton}`}
                  >
                    <Trash2 size={11} aria-hidden="true" />
                    Delete
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}
