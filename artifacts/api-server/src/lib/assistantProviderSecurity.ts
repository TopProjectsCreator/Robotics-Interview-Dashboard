import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const ENCRYPTION_VERSION = "v1";

function encryptionKey(context: string): Buffer {
  const secret = process.env.AI_BYOK_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret?.trim()) {
    throw new Error("Team credential encryption is not configured.");
  }
  return createHash("sha256").update(`${context}:${secret}`).digest();
}

function encryptCredential(credential: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(context), iv);
  const ciphertext = Buffer.concat([cipher.update(credential, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptCredential(value: string, context: string, errorMessage: string): string {
  const [version, ivText, tagText, ciphertextText, extra] = value.split(".");
  if (version !== ENCRYPTION_VERSION || !ivText || !tagText || !ciphertextText || extra) {
    throw new Error(errorMessage);
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(context), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(errorMessage);
  }
}

export function encryptAssistantProviderCredential(credential: string): string {
  return encryptCredential(credential, "team-ai-provider");
}

export function decryptAssistantProviderCredential(value: string): string {
  return decryptCredential(value, "team-ai-provider", "The saved team provider credential cannot be decrypted.");
}

export function encryptMaildropApiKey(apiKey: string): string {
  return encryptCredential(apiKey, "team-maildrop-api-key");
}

export function decryptMaildropApiKey(value: string): string {
  return decryptCredential(value, "team-maildrop-api-key", "The saved team Maildrop API key cannot be decrypted.");
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
    octets[0] >= 224;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") || normalized.startsWith("fea") ||
    normalized.startsWith("feb") || normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

export async function validateCompatibleEndpoint(value: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid public HTTPS endpoint.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "https:" ||
    url.username || url.password ||
    !hostname || hostname === "localhost" ||
    hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
    hostname.endsWith(".internal") || hostname.endsWith(".test") ||
    isIP(hostname) !== 0
  ) {
    throw new Error("Use a public HTTPS endpoint without embedded credentials.");
  }
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) =>
      isIP(record.address) === 4 ? isPrivateIpv4(record.address) : isPrivateIpv6(record.address),
    )) {
      throw new Error("The endpoint must resolve only to public addresses.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("public addresses")) throw error;
    throw new Error("The endpoint host could not be verified as public.");
  }
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}
