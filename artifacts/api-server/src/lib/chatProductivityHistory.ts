export type ProductivityHistoryRow = {
  score: number;
  summary: string;
  breakdown: unknown;
  periodStart: Date | string | null;
  periodEnd: Date | string | null;
  createdAt: Date;
};

function validDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasValidScoredPeriod(row: ProductivityHistoryRow): boolean {
  const start = validDate(row.periodStart);
  const end = validDate(row.periodEnd);
  return Boolean(start && end && start.getTime() < end.getTime());
}

/**
 * Builds all history views from assessments with a valid, non-empty score
 * period. Filtering here also protects the response if legacy rows reach this
 * layer despite the database query's period predicates.
 */
export function buildProductivityHistory(
  rows: ProductivityHistoryRow[],
  range: string,
  tzOffsetMinutes: number,
  maxPoints: number,
) {
  const eligibleRows = rows.filter(hasValidScoredPeriod);
  const dayBuckets = new Map<string, { sum: number; max: number; count: number }>();
  for (const row of eligibleRows) {
    const local = new Date(row.createdAt.getTime() - tzOffsetMinutes * 60_000);
    const key = local.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key) ?? { sum: 0, max: 0, count: 0 };
    bucket.sum += row.score;
    bucket.max = Math.max(bucket.max, row.score);
    bucket.count += 1;
    dayBuckets.set(key, bucket);
  }
  const daily = [...dayBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      date,
      averageScore: Math.round((bucket.sum / bucket.count) * 10) / 10,
      maxScore: bucket.max,
      reviewCount: bucket.count,
    }));

  const truncated = eligibleRows.length > maxPoints;
  const points = (truncated ? eligibleRows.slice(-maxPoints) : eligibleRows).map((row) => ({
    score: row.score,
    summary: row.summary,
    breakdown: row.breakdown,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    createdAt: row.createdAt,
  }));

  return {
    range,
    reviewCount: eligibleRows.length,
    truncated,
    points,
    daily,
  };
}
