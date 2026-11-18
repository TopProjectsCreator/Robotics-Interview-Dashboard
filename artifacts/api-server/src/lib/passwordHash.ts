import { randomBytes, timingSafeEqual } from "node:crypto";
import { deriveSecret } from "./asyncScrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await deriveSecret(password, salt)).toString("hex")}`;
}

export async function passwordHashMatches(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) return false;
  const [saltHex, hashHex] = encoded.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const actual = await deriveSecret(password, Buffer.from(saltHex, "hex"));
    const expected = Buffer.from(hashHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
