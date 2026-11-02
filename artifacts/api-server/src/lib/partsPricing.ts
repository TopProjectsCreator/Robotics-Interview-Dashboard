export type PriceQueryResult = { rows: Record<string, unknown>[] };

export type PriceQuery = (
  statement: string,
  values?: unknown[],
) => Promise<PriceQueryResult>;

/**
 * Reads only an explicit goBILDA FTC price label and its adjacent amount.
 * It deliberately does not derive a percentage from the regular price.
 */
export function parsePublishedFtcTeamPrice(html: string): string | null {
  const visibleText = html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&dollar;/gi, "$")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ");
  const labels = [
    /\bFTC\s+(?:(?:team|teams)\s+)?price\b/gi,
    /\b(?:team|teams)\s+price\s*(?:for\s+)?FTC\b/gi,
  ];
  for (const labelPattern of labels) {
    for (const match of visibleText.matchAll(labelPattern)) {
      const end = (match.index ?? 0) + match[0].length;
      const nearby = visibleText.slice(end, end + 100);
      // A price label should be followed directly by its amount, not unrelated
      // prose or another field. This limits accidental matches on shipping text.
      const amount = nearby.match(/^[\s:：\-–—]*(?:USD\s*)?\$?(\d{1,3}(?:,\d{3})*|\d{1,9})(?:\.(\d{1,2}))?/i);
      const currencyAmount = amount?.[0].match(/(?:\$|USD)/i)
        ? amount
        : nearby.match(/^[\s:：\-–—]*USD\s+(\d{1,3}(?:,\d{3})*|\d{1,9})(?:\.(\d{1,2}))?/i);
      const found = currencyAmount ?? (nearby.match(/^[\s:：\-–—]*\$\s*(\d{1,3}(?:,\d{3})*|\d{1,9})(?:\.(\d{1,2}))?/i));
      if (!found) continue;
      const whole = found[1]?.replace(/,/g, "");
      if (!whole) continue;
      const fraction = found[2] ?? "";
      const normalized = fraction ? `${whole}.${fraction}` : whole;
      const numeric = Number(normalized);
      if (Number.isFinite(numeric) && numeric <= 99_999_999.99) return normalized;
    }
  }
  return null;
}

export async function readFtcPricingPreference(
  query: PriceQuery,
  teamId: string,
): Promise<boolean> {
  const result = await query(
    `select "use_ftc_pricing" as "useFtcPricing"
       from "parts_team_settings"
      where "team_id" = $1`,
    [teamId],
  );
  return result.rows[0]?.useFtcPricing === true;
}

export async function saveFtcPricingPreference(
  query: PriceQuery,
  teamId: string,
  useFtcPricing: boolean,
): Promise<boolean> {
  const result = await query(
    `insert into "parts_team_settings" ("team_id", "use_ftc_pricing", "updated_at")
     values ($1, $2, now())
     on conflict ("team_id") do update set
       "use_ftc_pricing" = excluded."use_ftc_pricing",
       "updated_at" = now()
     returning "use_ftc_pricing" as "useFtcPricing"`,
    [teamId, useFtcPricing],
  );
  return result.rows[0]?.useFtcPricing === true;
}

export function selectSupplierPrice(
  regularPrice: string | null,
  ftcTeamPrice: string | null,
  useFtcPricing: boolean,
): { price: string | null; priceType: "regular" | "ftc" } {
  if (useFtcPricing && ftcTeamPrice !== null) {
    return { price: ftcTeamPrice, priceType: "ftc" };
  }
  return { price: regularPrice, priceType: "regular" };
}
