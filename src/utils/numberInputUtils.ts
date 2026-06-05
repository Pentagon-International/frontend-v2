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

const COORDINATE_MAX_DIGITS = 15;

/**
 * Truncate latitude/longitude to at most N numeric digits (decimal point excluded).
 * Preserves sign; empty/invalid input returns an empty string.
 */
export function formatCoordinateForPayload(
  value: number | string | null | undefined,
  maxDigits: number = COORDINATE_MAX_DIGITS,
): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const negative = raw.startsWith("-");
  const normalized = raw.replace(/^-/, "").replace(/[^\d.]/g, "");
  if (!normalized) return "";

  const dotIndex = normalized.indexOf(".");
  const intPart =
    dotIndex === -1 ? normalized : normalized.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? "" : normalized.slice(dotIndex + 1);

  const intDigits = (intPart.replace(/\D/g, "") || "0").replace(/^0+(?=\d)/, "");
  const decDigits = decPart.replace(/\D/g, "");

  const intDigitCount = intDigits.length;
  const remainingForDec = Math.max(0, maxDigits - intDigitCount);
  const finalDec = decDigits.slice(0, remainingForDec);
  const finalInt = intDigits.slice(0, maxDigits);

  let result = finalInt;
  if (finalDec.length > 0 && finalInt.length < maxDigits) {
    result += `.${finalDec}`;
  }

  return negative ? `-${result}` : result;
}