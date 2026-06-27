export const PERCENT_STEP = 5;

/** Clamps and snaps a percentage to the nearest step (e.g. 5% increments). */
export function snapPercent(value: number, min: number, max: number, step = PERCENT_STEP): number {
  if (!Number.isFinite(value)) return max;
  const clamped = Math.min(max, Math.max(min, value));
  if (step <= 0) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}
