// utils/numberUtils.ts

/**
 * Rounds a number to a specified number of decimal places.
 * Handles all edge cases: null, undefined, string numbers, Infinity, NaN
 *
 * @param value - The value to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded number or null/undefined matching input
 */

export const roundToDecimals = (
  value: number | string | null | undefined,
  decimals: number = 2,
): number | null | undefined => {
  // Preserve null and undefined as-is
  if (value === null) return null;
  if (value === undefined) return undefined;

  // Handle empty string
  if (value === "") return undefined;

  // Convert string numbers to number
  const num = typeof value === "string" ? parseFloat(value) : value;

  // Handle NaN (e.g., parseFloat("abc"))
  if (isNaN(num)) return undefined;

  // Handle Infinity
  if (!isFinite(num)) return undefined;

  // Use Number.EPSILON to avoid floating point precision issues
  // e.g., 1.005 with plain Math.round gives 1.00 instead of 1.01
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
};