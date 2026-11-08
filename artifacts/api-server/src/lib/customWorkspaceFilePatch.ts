/**
 * Pure helpers for precise custom-workspace source edits.
 *
 * These have no database or network dependencies so they can be unit
 * tested directly. `applySearchReplace` backs the
 * `patch_custom_workspace_file` builder tool; `validateSourceFile` is the
 * pre-save syntax gate so the builder gets line-level errors instead of a
 * broken preview; `paginateContent` backs paged reads of large files.
 */

export type SearchReplaceResult =
  | { ok: true; content: string; occurrences: 1 }
  | { ok: false; error: string; occurrences: number };

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Replace the single exact occurrence of `search` with `replace`.
 * Ambiguous or missing anchors are rejected: the builder should re-read
 * the file and choose a tighter anchor, or fall back to a full rewrite
 * with `write_custom_workspace_file`.
 */
export function applySearchReplace(content: string, search: string, replace: string): SearchReplaceResult {
  if (!search) return { ok: false, error: "A non-empty search anchor is required.", occurrences: 0 };
  const occurrences = countOccurrences(content, search);
  if (occurrences === 0) {
    return {
      ok: false,
      error: "The search anchor was not found in this file. Re-read the file and use its exact current text.",
      occurrences: 0,
    };
  }
  if (occurrences > 1) {
    return {
      ok: false,
      error: `The search anchor matches ${occurrences} places and is ambiguous. Include surrounding lines to make it unique.`,
      occurrences,
    };
  }
  return { ok: true, content: content.replace(search, replace), occurrences: 1 };
}

/**
 * Build a small before/after snippet showing the changed region with
 * context. Plain line diff (not a full LCS) is intentional: a patch
 * touches one anchor, so the changed span is exactly the search/replace
 * region around its line number.
 */
export function diffSnippet(before: string, after: string, contextLines = 3): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  let first = 0;
  while (first < beforeLines.length && first < afterLines.length &&
    beforeLines[first] === afterLines[first]) {
    first += 1;
  }
  let lastBefore = beforeLines.length - 1;
  let lastAfter = afterLines.length - 1;
  while (lastBefore >= first && lastAfter >= first &&
    beforeLines[lastBefore] === afterLines[lastAfter]) {
    lastBefore -= 1;
    lastAfter -= 1;
  }
  const start = Math.max(0, first - contextLines);
  const endBefore = Math.min(beforeLines.length - 1, lastBefore + contextLines);
  const endAfter = Math.min(afterLines.length - 1, lastAfter + contextLines);
  const lines: string[] = [`@@ around line ${first + 1} @@`];
  for (let index = start; index <= endBefore; index += 1) {
    lines.push(`- ${index + 1}: ${beforeLines[index]}`);
  }
  for (let index = start; index <= endAfter; index += 1) {
    lines.push(`+ ${index + 1}: ${afterLines[index]}`);
  }
  return lines.join("\n").slice(0, 4000);
}

export interface PagedContent {
  content: string;
  totalChars: number;
  offset: number;
  truncated: boolean;
}

/** Return a character window of `content` (for large-file reads). */
export function paginateContent(content: string, offset = 0, maxChars = 30_000): PagedContent {
  const safeOffset = Math.max(0, Math.min(Math.floor(offset) || 0, content.length));
  const safeMax = Math.max(1, Math.min(Math.floor(maxChars) || 30_000, 60_000));
  const slice = content.slice(safeOffset, safeOffset + safeMax);
  return {
    content: slice,
    totalChars: content.length,
    offset: safeOffset,
    truncated: safeOffset + slice.length < content.length,
  };
}

/**
 * Extract inline scripts from an HTML document (script bodies without a
 * `src` attribute), returned in document order.
 */
export function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(html)) !== null) {
    if (/\bsrc\s*=/i.test(match[1])) continue;
    scripts.push(match[2]);
  }
  return scripts;
}

function parseJavaScript(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  try {
    // Parse-only check: `new Function` compiles without executing.
    new Function(trimmed);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // ES modules and top-level await are legal in <script type="module">;
    // don't false-positive on them. Re-check with the async-function
    // constructor, which accepts top-level await/return syntax.
    if (/import|export|await/.test(trimmed)) {
      try {
        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as
          new (...args: string[]) => unknown;
        new AsyncFunction(trimmed);
        return null;
      } catch {
        return message;
      }
    }
    return message;
  }
}

/**
 * Pre-save syntax gate. Returns human-readable issues for JavaScript in
 * standalone .js/.ts files and inline <script> blocks in .html files.
 * Empty array means the file parsed cleanly.
 */
export function validateSourceFile(path: string, content: string): string[] {
  const issues: string[] = [];
  if (/\.(js|mjs|cjs)$/i.test(path)) {
    const error = parseJavaScript(content);
    if (error) issues.push(`${path}: JavaScript syntax error — ${error}`);
    return issues;
  }
  if (/\.ts$/i.test(path)) {
    return issues; // TypeScript source is not compiled by the preview.
  }
  if (/\.(html?|htm)$/i.test(path)) {
    extractInlineScripts(content).forEach((script, index) => {
      const error = parseJavaScript(script);
      if (error) issues.push(`index.html inline script ${index + 1}: JavaScript syntax error — ${error}`);
    });
  }
  return issues;
}
