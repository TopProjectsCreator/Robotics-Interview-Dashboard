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

export type PasskeyChallenge = { mode: "register" | "login"; challenge: string; interviewerId?: string };

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
    return parsed;
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
