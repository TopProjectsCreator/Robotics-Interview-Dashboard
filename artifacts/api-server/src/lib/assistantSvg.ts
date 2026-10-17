export const SHOW_SVG_MAX_CHARS = 12_000;

// Mirrors the frontend sanitizer (App.tsx sanitizeSvg) so nothing the model
// previews gets silently stripped or rejected in the browser.
const UNSAFE_SVG_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /<script[\s>]/i, reason: "it contains a <script> tag" },
  { pattern: /<style[\s>]/i, reason: "it contains a <style> tag; use presentation attributes instead" },
  { pattern: /<foreignObject[\s>]/i, reason: "it contains <foreignObject>" },
  { pattern: /<(?:iframe|object|embed|link|meta)[\s>]/i, reason: "it contains an embedded or external element" },
  { pattern: /<a[\s>]/i, reason: "it contains an <a> link" },
  { pattern: /\son[a-z]+\s*=/i, reason: "it contains an inline event handler" },
  { pattern: /javascript:/i, reason: "it contains a javascript: URL" },
  { pattern: /\b(?:xlink:)?href\s*=/i, reason: "it contains an href/xlink:href reference; inline all content instead" },
  { pattern: /\bsrc\s*=/i, reason: "it contains a src reference; inline all content instead" },
];

/**
 * Returns null when the SVG is safe to preview/send, otherwise a short reason
 * the model can act on. Validation is intentionally conservative: the browser
 * renders SVG through a strict DOMPurify allowlist, so anything that would be
 * stripped there is rejected here so the model can revise before "sending".
 */
export function validateShowSvg(svg: unknown): string | null {
  if (typeof svg !== "string" || !svg.trim()) return "the svg field is empty";
  const value = svg.trim();
  if (!/<svg[\s>]/i.test(value) || !/<\/svg\s*>/i.test(value)) {
    return "it is not a complete <svg>...</svg> element";
  }
  if (value.length > SHOW_SVG_MAX_CHARS) {
    return `it is ${value.length} characters; keep it under ${SHOW_SVG_MAX_CHARS} characters (about 60 lines)`;
  }
  for (const { pattern, reason } of UNSAFE_SVG_PATTERNS) {
    if (pattern.test(value)) return reason;
  }
  return null;
}

export function normalizeShowSvg(svg: string): string {
  return svg.trim();
}

export function showSvgPreviewResult(svg: string, title: string): string {
  const label = title ? ` "${title}"` : "";
  return [
    `SVG preview${label} (NOT sent to the admin yet):`,
    "",
    svg,
    "",
    "Are you sure this is good to send to the user? Check that the drawing is complete, readable, correctly sized, and free of clipped or overlapping elements. To send it, call show_svg again with the EXACT same svg value and confirm=true — a prose reply alone does not send anything. If anything is wrong, fix the markup and call show_svg again (omit confirm) to preview the corrected version.",
  ].join("\n");
}

export function showSvgApprovedResult(title: string): string {
  return `Approved${title ? ` ("${title}")` : ""} — the SVG was sent to the admin and appears in your answer.`;
}

export function showSvgAlreadySentResult(): string {
  return "That exact SVG was already approved and sent to the admin. Do not send it again.";
}

export function showSvgNotPreviewedResult(): string {
  return "That SVG has not been previewed, so it was not sent. Call show_svg with the svg and no confirm first so you can review it, then confirm the exact same markup.";
}

export type ShowSvgState = {
  previews: Set<string>;
  approved: string[];
};

export type ShowSvgResolution = {
  kind: "invalid" | "already-sent" | "previewed" | "not-previewed" | "approved";
  message: string;
};

/**
 * Single entry point for the show_svg review gate. The first call previews the
 * SVG back to the model (and remembers it); only a second call with the exact
 * same markup and confirm=true approves it for the answer. State persists
 * across tool rounds so the preview always precedes the send.
 */
export function resolveShowSvg(
  state: ShowSvgState,
  rawSvg: unknown,
  confirmed: boolean,
  title = "",
): ShowSvgResolution {
  const svg = normalizeShowSvg(typeof rawSvg === "string" ? rawSvg : "");
  const invalid = validateShowSvg(svg);
  if (invalid) {
    return {
      kind: "invalid",
      message: `That SVG cannot be shown because ${invalid}. Fix the markup and call show_svg again with the corrected svg (omit confirm) to preview it.`,
    };
  }
  if (state.approved.includes(svg)) {
    return { kind: "already-sent", message: showSvgAlreadySentResult() };
  }
  if (!confirmed) {
    state.previews.add(svg);
    return { kind: "previewed", message: showSvgPreviewResult(svg, title) };
  }
  if (!state.previews.has(svg)) {
    return { kind: "not-previewed", message: showSvgNotPreviewedResult() };
  }
  state.approved.push(svg);
  return { kind: "approved", message: showSvgApprovedResult(title) };
}
