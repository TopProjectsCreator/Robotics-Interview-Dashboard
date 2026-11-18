import { scrypt } from "node:crypto";

// Leave worker-pool capacity for other crypto, filesystem and DNS work. The
// permit is transferred directly to a waiter, so newcomers cannot exceed it.
const MAX_ACTIVE = 2;
let active = 0;
const waiting: Array<() => void> = [];

export async function deriveSecret(value: string, salt: Buffer): Promise<Buffer> {
  if (active >= MAX_ACTIVE) await new Promise<void>((resolve) => waiting.push(resolve));
  else active += 1;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      // Keep the original Node scrypt defaults and 64-byte derived key.
      scrypt(value, salt, 64, (error, key) => error ? reject(error) : resolve(key));
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}
