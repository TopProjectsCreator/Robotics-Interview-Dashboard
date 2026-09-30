export function catalogSearchVariants(query: string): string[] {
  const cleaned = query.trim();
  if (!cleaned) return [];

  const variants = new Set([cleaned]);
  const metricMatch =
    cleaned.match(/\b(\d+(?:\.\d+)?)\s*mm\b/i) ??
    cleaned.match(/\bM\s*(\d+(?:\.\d+)?)(?=$|[\s×x-])/i);

  if (!metricMatch || metricMatch.index === undefined) return [...variants];

  const size = metricMatch[1];
  const prefix = cleaned.slice(0, metricMatch.index).trim();
  const suffix = cleaned.slice(metricMatch.index + metricMatch[0].length).trim();
  for (const sizeForm of [`${size}mm`, `${size} mm`, `M${size}`, `M ${size}`]) {
    variants.add([prefix, sizeForm, suffix].filter(Boolean).join(" "));
  }

  return [...variants].slice(0, 16);
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function searchTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(mm|cm|inches|inch|in)\b/g, "$1$2")
    .match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? [];
}

function matchesSearchToken(candidate: string, term: string): boolean {
  if (candidate === term) return true;
  if (term.endsWith("ies") && candidate === `${term.slice(0, -3)}y`) return true;
  if (candidate.endsWith("ies") && `${candidate.slice(0, -3)}y` === term) return true;
  if (term.endsWith("s") && candidate === term.slice(0, -1)) return true;
  return candidate.endsWith("s") && candidate.slice(0, -1) === term;
}

/**
 * Search-provider descriptions can include incidental mentions far beyond the
 * product itself. Require every meaningful query term in the title or the
 * opening description, and require at least one term in the product title.
 */
export function isRelevantCatalogSearchResult(
  query: string,
  title: string,
  description: string,
): boolean {
  const terms = searchTokens(query).filter((term) => !SEARCH_STOP_WORDS.has(term));
  if (terms.length === 0) return false;

  const titleTokens = searchTokens(title);
  const descriptionTokens = searchTokens(description.slice(0, 320));
  const titleMatches = terms.filter((term) =>
    titleTokens.some((token) => matchesSearchToken(token, term)),
  );
  if (titleMatches.length === 0) return false;

  return terms.every(
    (term) =>
      titleTokens.some((token) => matchesSearchToken(token, term)) ||
      descriptionTokens.some((token) => matchesSearchToken(token, term)),
  );
}