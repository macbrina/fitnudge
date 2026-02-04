/**
 * General helpers for the admin portal.
 * Add formatting, validation, and utility functions here.
 */

// ====================
// Number formatting
// ====================

const THRESHOLD_K = 1_000;
const THRESHOLD_M = 1_000_000;
const THRESHOLD_B = 1_000_000_000;

/**
 * Format a number in abbreviated form (1k, 1.213k, 100k, 10M, etc.)
 *
 * @param value - Number to format
 * @param options - Optional: decimals (default 3), forceFull (skip abbreviation)
 */
export function formatCompact(
  value: number,
  options?: { decimals?: number; forceFull?: boolean }
): string {
  const { decimals = 3, forceFull = false } = options ?? {};

  if (forceFull || Math.abs(value) < THRESHOLD_K) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: value % 1 !== 0 ? decimals : 0,
      maximumFractionDigits: value % 1 !== 0 ? decimals : 0,
    });
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= THRESHOLD_B) {
    const v = value / THRESHOLD_B;
    const s = v.toFixed(decimals).replace(/\.?0+$/, "");
    return `${sign}${s}B`;
  }
  if (abs >= THRESHOLD_M) {
    const v = value / THRESHOLD_M;
    const s = v.toFixed(decimals).replace(/\.?0+$/, "");
    return `${sign}${s}M`;
  }
  // 1k - 999.999k
  const v = value / THRESHOLD_K;
  const s = v.toFixed(decimals).replace(/\.?0+$/, "");
  return `${sign}${s}k`;
}
