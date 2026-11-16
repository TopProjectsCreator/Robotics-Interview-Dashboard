/**
 * TinyURL validation and canonicalization, shared by the Settings →
 * Operations short-link tool and the public `/t/<alias>` redirect.
 *
 * Aliases are stored lowercase and are unique across the whole deployment —
 * the redirect carries no team context, so two teams must never share one.
 * Targets are limited to absolute http(s) URLs without embedded credentials:
 * a short link on the team's own domain must never become a javascript: or
 * data: URL, and userinfo URLs are the raw material of phishing links.
 */

export const TINY_URL_ALIAS_MAX_LENGTH = 64;
export const TINY_URL_TARGET_MAX_LENGTH = 2048;
/** Per-team cap so a fat-fingered import loop cannot fill the table. */
export const TINY_URL_TEAM_LIMIT = 200;
export const TINY_URL_REDIRECT_PREFIX = "/t/";

const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Canonical form of an alias, or null when it is not usable. Trims the
 * slashes and whitespace people paste from a full short link ("/t/tryouts"
 * or "https://team.example.com/t/tryouts"), lowercases, then enforces the
 * character set: start with a letter or digit, then letters, digits,
 * hyphens and underscores, up to 64 chars.
 */
export function normalizeTinyUrlAlias(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let alias = input.trim();
  // Tolerate pasted short links: strip an optional origin and the /t/ prefix.
  const prefixMatch = alias.match(/^(?:https?:\/\/[^/\s]+)?\/?t\/([^/\s]+)\/?$/i);
  if (prefixMatch) alias = prefixMatch[1];
  else alias = alias.replace(/^\/+|\/+$/g, "");
  alias = alias.toLowerCase();
  if (!ALIAS_PATTERN.test(alias)) return null;
  return alias;
}

/**
 * Absolute target URL in stored form, or null when not usable. A bare
 * domain ("example.com/signup") or bare host:port ("localhost:3000/console")
 * is accepted and upgraded to https:// so the form is forgiving; anything
 * with an explicit scheme other than http(s) — and any URL with userinfo —
 * is rejected.
 */
export function normalizeTinyUrlTarget(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > TINY_URL_TARGET_MAX_LENGTH) return null;
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
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname) return null;
  return parsed.toString();
}

/** Path the public redirect answers on for a stored alias. */
export function tinyUrlPath(alias: string): string {
  return `${TINY_URL_REDIRECT_PREFIX}${alias}`;
}

/** True when the request path (e.g. "/t/tryouts") is a syntactically valid alias route. */
export function isValidTinyUrlAlias(alias: string): boolean {
  return ALIAS_PATTERN.test(alias);
}
