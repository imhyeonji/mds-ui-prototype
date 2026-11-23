// Rates a dataset by its share of present (non-missing) cells, for the traffic-light donut in the data preview.
// Green from 95% present, red at 75% present or less, orange in between.
export const COMPLETENESS_THRESHOLDS = { good: 95, poor: 75 } as const;

export type CompletenessLevel = "good" | "fair" | "poor" | "unknown";

// Bright traffic-light colours. Orange leans towards amber so it stays clearly apart from red.
// Only used for the ring and legend dots; the rating is always also given as text.
export const COMPLETENESS_COLORS: Record<CompletenessLevel, string> = {
  good: "#22c55e",
  fair: "#f59e0b",
  poor: "#ef4444",
  unknown: "#9ca3af",
};

/** Share of present cells in percent (0–100, two decimals) from the missing share; null when it is not a number. */
export function presentPercent(missingPercent: number): number | null {
  if (typeof missingPercent !== "number" || !Number.isFinite(missingPercent)) return null;
  const missing = Math.min(100, Math.max(0, missingPercent));
  // Rounded to avoid floating-point noise such as 85.75000000000001.
  return Math.round((100 - missing) * 100) / 100;
}

export function completenessLevel(present: number | null): CompletenessLevel {
  if (present === null || !Number.isFinite(present)) return "unknown";
  if (present >= COMPLETENESS_THRESHOLDS.good) return "good";
  if (present <= COMPLETENESS_THRESHOLDS.poor) return "poor";
  return "fair";
}
