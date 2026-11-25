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
  // An explicit acknowledgement from the UI allows any exposure level. The
  // client is responsible for putting the user through the full risk dialog
  // before sending confirmLowExposure.
  if (confirmLowExposure) return { kind: "safe" };
  if (count >= 3) return { kind: "blocked", count };
  if (count > 0) return { kind: "warning", count };
  return { kind: "safe" };
}