/**
 * Deterministic wall-clock background selection. Every client holding the same
 * background list lands on the same image at the same moment, without any
 * server coordination, as long as the configured interval is the same.
 */
export function backgroundIndexAt(backgroundCount: number, rotationSeconds: number, nowMs: number): number {
  if (!Number.isFinite(nowMs)) return 0;
  if (backgroundCount <= 0 || rotationSeconds <= 0 || !Number.isFinite(rotationSeconds)) return 0;
  return Math.floor(nowMs / 1000 / rotationSeconds) % backgroundCount;
}
