import type { Request, Response } from "express";

/**
 * Origin and RP ID for WebAuthn.
 *
 * Prefer an explicit override (WEBAUTHN_ORIGIN) because the page origin and
 * the API origin can differ during development behind the Vite proxy; fall
 * back to the browser's Origin header, which is exactly what WebAuthn checks,
 * and finally derive it from the request itself.
 */
export function webauthnOrigin(req: Request): string {
  const configured = process.env.WEBAUTHN_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const originHeader = req.get("origin")?.trim();
  if (originHeader) return originHeader.replace(/\/+$/, "");
  const proto = (req.get("x-forwarded-proto")?.split(",")[0] ?? "").trim() || (req.secure ? "https" : "http");
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

export function webauthnRPID(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
}

/**
 * The configured WEBAUTHN_ORIGIN override alone (no request involved), so
 * callers can distinguish "a deployment-wide override is in force" from a
 * per-request origin derived from the browser's Origin header.
 */
export function configuredWebauthnOrigin(): string | null {
  const configured = process.env.WEBAUTHN_ORIGIN?.trim().replace(/\/+$/, "");
  return configured || null;
}

/**
 * Normalise a candidate URL to the origin it names — `https://host[:port]`,
 * with no path, trailing slash, or credentials. Returns null for anything
 * that is not an absolute http(s) URL. WebAuthn binds credentials to
 * origins, not paths, so this is the "which URL was this passkey made on"
 * value stored per credential.
 */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Read the origin the authenticator itself reported for this ceremony.
 * `clientDataJSON` is the base64url-encoded JSON blob containing
 * `{ type, challenge, origin }`; its `origin` is exactly the page URL the
 * ceremony ran on, which is the most trustworthy source for "which URL was
 * this passkey made with" (it survives behind proxies and mirror hosts
 * where the request's Origin header may be missing or rewritten). Returns
 * null when the response is malformed or carries no http(s) origin.
 */
export function originFromResponse(response: unknown): string | null {
  if (typeof response !== "object" || response === null) return null;
  const clientDataJSON = (response as { clientDataJSON?: unknown }).clientDataJSON;
  if (typeof clientDataJSON !== "string" || !clientDataJSON) return null;
  try {
    const json = Buffer.from(clientDataJSON, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { origin?: unknown };
    return normalizeOrigin(typeof parsed.origin === "string" ? parsed.origin : null);
  } catch {
    return null;
  }
}

/** De-duplicate an allowlist of strings, dropping blanks, keeping order. */
export function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * The origin/RP ID to offer for a passkey sign-in.
 *
 * A credential stays bound to the RP ID of the site it was registered on,
 * so when every credential for the account shares one stored origin, that
 * origin's RP ID is what the authenticator can satisfy — offering the
 * current page's hostname instead would make the browser hide those
 * credentials. An explicit WEBAUTHN_ORIGIN override still wins: the
 * deployment has told us the canonical site. When credentials disagree
 * (e.g. one passkey per mirror host) or none carry a stored origin yet,
 * the current request's origin is offered, and `expectedOriginsForLogin`
 * keeps verification tolerant of either.
 */
export function authenticationOriginFor({
  currentOrigin,
  credentialOrigins,
}: {
  currentOrigin: string;
  credentialOrigins: Array<string | null | undefined>;
}): string {
  const configured = configuredWebauthnOrigin();
  if (configured) return configured;
  const stored = dedupeStrings(credentialOrigins.map((origin) => normalizeOrigin(origin)));
  return stored.length === 1 ? stored[0]! : currentOrigin.replace(/\/+$/, "");
}

/**
 * Origins a passkey assertion may come from: the origin pinned into the
 * challenge when the ceremony was prepared, the origin the current request
 * claims, and — crucially — the origin the credential was originally
 * created on. Accepting any of them is what lets a passkey registered on
 * the primary site still verify when the user reaches it through a mirror
 * origin. This remains safe: SimpleWebAuthn still checks the challenge,
 * the RP ID hash, and the signature, and the allowlist contains only
 * first-party origins (never an arbitrary caller-supplied value).
 */
export function expectedOriginsForLogin({
  challengeOrigin,
  currentOrigin,
  storedOrigin,
}: {
  challengeOrigin?: string | null;
  currentOrigin: string;
  storedOrigin?: string | null;
}): string[] {
  return dedupeStrings([
    normalizeOrigin(challengeOrigin),
    normalizeOrigin(configuredWebauthnOrigin()),
    normalizeOrigin(currentOrigin),
    normalizeOrigin(storedOrigin),
  ]);
}

/** RP IDs matching `expectedOriginsForLogin` (derived from the same origins). */
export function expectedRpIdsForLogin({
  challengeOrigin,
  challengeRpId,
  currentOrigin,
  storedOrigin,
}: {
  challengeOrigin?: string | null;
  challengeRpId?: string | null;
  currentOrigin: string;
  storedOrigin?: string | null;
}): string[] {
  const origins = expectedOriginsForLogin({ challengeOrigin, currentOrigin, storedOrigin });
  const rpIds = origins.map((origin) => webauthnRPID(origin));
  return dedupeStrings([challengeRpId, ...rpIds]);
}

export function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const buf = Buffer.from(padded, "base64");
  // Slice into a fresh ArrayBuffer so the type is Uint8Array<ArrayBuffer>,
  // which is what the credential descriptor expects.
  return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export function bytesToBase64url(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Challenge handed to the authenticator, kept in an httpOnly cookie until it is consumed. */
export const PASSKEY_CHALLENGE_COOKIE = "passkey_challenge";

/**
 * Challenge handed to the authenticator, kept in an httpOnly cookie until it
 * is consumed. `origin`/`rpId` pin the site the ceremony was prepared for,
 * so verification expects exactly that site rather than re-deriving it from
 * whichever request happens to submit the response (which may be a mirror
 * host the browser was opened on only at submit time).
 */
export type PasskeyChallenge = {
  mode: "register" | "login";
  challenge: string;
  interviewerId?: string;
  origin?: string;
  rpId?: string;
};

export function setPasskeyChallenge(res: Response, value: PasskeyChallenge): void {
  res.cookie(PASSKEY_CHALLENGE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(res.req),
    path: "/api/auth",
    maxAge: 5 * 60_000,
  });
}

export function readPasskeyChallenge(req: Request): PasskeyChallenge | null {
  const raw = (req.cookies as Record<string, string> | undefined)?.[PASSKEY_CHALLENGE_COOKIE];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PasskeyChallenge;
    if (!parsed || (parsed.mode !== "register" && parsed.mode !== "login") || typeof parsed.challenge !== "string") return null;
    // Keep only the known fields; a tampered cookie must not smuggle an
    // attacker-chosen origin/RP ID into the verification allowlist.
    const cleaned: PasskeyChallenge = { mode: parsed.mode, challenge: parsed.challenge };
    if (typeof parsed.interviewerId === "string") cleaned.interviewerId = parsed.interviewerId;
    const origin = normalizeOrigin(parsed.origin);
    if (origin) cleaned.origin = origin;
    if (typeof parsed.rpId === "string" && parsed.rpId.trim()) cleaned.rpId = parsed.rpId.trim();
    return cleaned;
  } catch {
    return null;
  }
}

export function clearPasskeyChallenge(res: Response): void {
  res.clearCookie(PASSKEY_CHALLENGE_COOKIE, { path: "/api/auth" });
}

function isSecureRequest(req: Request): boolean {
  const proto = (req.get("x-forwarded-proto")?.split(",")[0] ?? "").trim();
  return req.secure || proto === "https";
}

/** Credential id from an AuthenticationResponseJSON / RegistrationResponseJSON. */
export function credentialIdFromResponse(response: unknown): string {
  const record = response as { id?: unknown; rawId?: unknown } | null;
  const id = typeof record?.id === "string" ? record.id : typeof record?.rawId === "string" ? record.rawId : "";
  if (!id) throw new Error("Credential id missing from response");
  return id;
}
