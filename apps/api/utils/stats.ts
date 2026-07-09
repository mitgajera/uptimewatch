// Shared analytics helpers used by the analytics/dashboard controllers.

// Supported analytics time ranges, mapped to their length in milliseconds.
export const RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * p-th percentile of an ascending-sorted array (rounded). Returns 0 for empty input.
 */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.ceil((p / 100) * sortedAsc.length) - 1
  );
  return Math.round(sortedAsc[Math.max(0, idx)]);
}

/**
 * Rounded arithmetic mean of the values. Returns 0 for empty input.
 */
export function average(nums: number[]): number {
  return nums.length > 0
    ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
    : 0;
}

/**
 * Uptime percentage from up/total check counts, rounded to two decimals.
 * Returns 100 when there are no checks.
 */
export function uptimePercent(upCount: number, total: number): number {
  const pct = total ? (upCount / total) * 100 : 100;
  return Math.round(pct * 100) / 100;
}
