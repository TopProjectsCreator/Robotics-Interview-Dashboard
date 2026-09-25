export type PasswordExposureAssessment =
  | { kind: "safe" }
  | { kind: "warning"; count: number }
  | { kind: "blocked"; count: number };

export function assessPasswordExposure(
  count: number,
  confirmLowExposure = false,
): PasswordExposureAssessment {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Password exposure count must be a non-negative safe integer");
  }
  if (count >= 3) return { kind: "blocked", count };
  if (count > 0 && !confirmLowExposure) return { kind: "warning", count };
  return { kind: "safe" };
}