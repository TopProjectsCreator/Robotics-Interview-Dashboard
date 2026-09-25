import { createHash } from "node:crypto";

const PWNED_PASSWORDS_RANGE_API = "https://api.pwnedpasswords.com/range/";
const REQUEST_TIMEOUT_MS = 5000;

export async function getPwnedPasswordCount(
  password: string,
  fetchRange: typeof fetch = fetch,
): Promise<number> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const response = await fetchRange(`${PWNED_PASSWORDS_RANGE_API}${prefix}`, {
    headers: {
      "Add-Padding": "true",
      "User-Agent": "RoboticsInterviewDashboard-PasswordSafety/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Pwned Passwords returned HTTP ${response.status}`);
  }

  const rangeResults = await response.text();
  for (const line of rangeResults.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;

    const returnedSuffix = line.slice(0, separator).trim().toUpperCase();
    if (returnedSuffix !== suffix) continue;

    const rawCount = line.slice(separator + 1).trim();
    if (!/^\d+$/.test(rawCount)) {
      throw new Error("Pwned Passwords returned an invalid occurrence count");
    }
    const count = Number(rawCount);
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error("Pwned Passwords returned an invalid occurrence count");
    }
    return count;
  }

  return 0;
}