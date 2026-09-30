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