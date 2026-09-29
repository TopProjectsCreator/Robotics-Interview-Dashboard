export type CadconvertFaceSummary = {
  meshedFaces: number;
  totalFaces: number;
  triangles: number;
};

function parseCount(value: string): number | null {
  const count = Number(value.replaceAll(",", ""));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function parseCadconvertFaceSummary(output: string): CadconvertFaceSummary | null {
  const summaryPattern =
    /(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s+faces\b.{0,128}?\b(\d[\d,]*)\s+triangles\b/g;
  let latest: CadconvertFaceSummary | null = null;

  for (const match of output.matchAll(summaryPattern)) {
    const meshedFaces = parseCount(match[1]);
    const totalFaces = parseCount(match[2]);
    const triangles = parseCount(match[3]);
    if (meshedFaces === null || totalFaces === null || triangles === null) continue;
    latest = { meshedFaces, totalFaces, triangles };
  }

  return latest;
}

export function requireCompleteCadconvertFaceSummary(output: string): CadconvertFaceSummary {
  const summary = parseCadconvertFaceSummary(output);
  if (
    !summary ||
    summary.totalFaces === 0 ||
    summary.meshedFaces !== summary.totalFaces ||
    summary.triangles === 0
  ) {
    throw new Error("The local converter did not mesh every source face");
  }

  return summary;
}