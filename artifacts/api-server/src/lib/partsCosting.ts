export const MAX_PART_UNIT_PRICE = 99_999_999.99;
export const PRICE_SNAPSHOT_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export function isValidCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

export function isValidMoneyAmount(value: unknown): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_PART_UNIT_PRICE
  ) {
    return false;
  }
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

export function moneyFromDatabase(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return isValidMoneyAmount(amount) ? Math.round(amount * 100) / 100 : null;
}

export function isPriceSnapshotStale(
  capturedAt: Date | string,
  now = Date.now(),
): boolean {
  const timestamp = capturedAt instanceof Date
    ? capturedAt.getTime()
    : new Date(capturedAt).getTime();
  return !Number.isFinite(timestamp) || now - timestamp > PRICE_SNAPSHOT_STALE_AFTER_MS;
}

export function calculateLineTotal(
  quantity: number,
  unitCost: number | null,
  currency: string | null,
): number | null {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    unitCost === null ||
    !isValidMoneyAmount(unitCost) ||
    !isValidCurrencyCode(currency)
  ) {
    return null;
  }
  const cents = Math.round(unitCost * 100) * quantity;
  if (!Number.isSafeInteger(cents)) return null;
  return cents / 100;
}

export function summarizeSavedCosts(
  lines: { quantity: number; unitCost: number | null; currency: string | null }[],
): { subtotalsByCurrency: { currency: string; amount: number }[]; unpricedPartCount: number } {
  const totalsInCents = new Map<string, number>();
  let unpricedPartCount = 0;
  for (const line of lines) {
    const total = calculateLineTotal(line.quantity, line.unitCost, line.currency);
    if (total === null || !line.currency) {
      unpricedPartCount += 1;
      continue;
    }
    const nextCents = (totalsInCents.get(line.currency) ?? 0) + Math.round(total * 100);
    if (!Number.isSafeInteger(nextCents)) {
      throw new Error("Saved cost total exceeds the supported precision.");
    }
    totalsInCents.set(line.currency, nextCents);
  }
  return {
    subtotalsByCurrency: [...totalsInCents.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, cents]) => ({ currency, amount: cents / 100 })),
    unpricedPartCount,
  };
}