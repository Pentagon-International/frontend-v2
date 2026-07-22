/**
 * Monetary amount decimal handling.
 * When non-decimal mode is enabled (currently Vietnam branches): whole numbers via Math.round.
 * Otherwise: 2 decimal places.
 *
 * Pages that round amounts during render/submit should call
 * `bindMoneyWholeNumberMode(isVietnamBranchFromUser(user))` each render
 * so module-level helpers (clampAmount, houseChargeAmounts) stay in sync.
 */

import { getDefaultUserBranch } from "./userNumberFormat";
import { roundToDecimals } from "./numberInputUtils";

export type VietnamBranchDetectInput = {
  countryCode?: string | null;
  countryName?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  currencyCode?: string | null;
};

export type VietnamBranchUser = {
  branches?: Array<{
    is_default?: boolean;
    branch_code?: string | null;
    branch_name?: string | null;
    country?: {
      country_code?: string | null;
      country_name?: string | null;
    } | null;
    currency?: { currency_code?: string | null } | null;
  } | null> | null;
  country?: {
    country_code?: string | null;
    country_name?: string | null;
  } | null;
} | null | undefined;

export function isVietnamBranch(input: VietnamBranchDetectInput): boolean {
  const country = String(input.countryCode ?? "")
    .trim()
    .toUpperCase();
  if (country === "VN" || country === "VNM") return true;

  const countryName = String(input.countryName ?? "")
    .trim()
    .toUpperCase();
  if (
    countryName.includes("VIETNAM") ||
    countryName.includes("VIET NAM")
  ) {
    return true;
  }

  const branchCode = String(input.branchCode ?? "")
    .trim()
    .toUpperCase();
  if (
    branchCode === "VN" ||
    branchCode === "VNM" ||
    branchCode.includes("VIETNAM")
  ) {
    return true;
  }

  const branchName = String(input.branchName ?? "")
    .trim()
    .toUpperCase();
  if (
    branchName.includes("VIETNAM") ||
    branchName.includes("VIET NAM")
  ) {
    return true;
  }

  // Fallback when only currency is known (e.g. sparse branch payloads).
  if (!country && !branchCode && !branchName) {
    const currency = String(input.currencyCode ?? "")
      .trim()
      .toUpperCase();
    if (currency === "VND") return true;
  }

  return false;
}

export function isVietnamBranchFromUser(user: VietnamBranchUser): boolean {
  const branch = getDefaultUserBranch(user?.branches);
  if (
    isVietnamBranch({
      countryCode: branch?.country?.country_code,
      countryName: branch?.country?.country_name,
      branchCode: branch?.branch_code,
      branchName: branch?.branch_name,
      currencyCode: branch?.currency?.currency_code,
    })
  ) {
    return true;
  }

  return isVietnamBranch({
    countryCode: user?.country?.country_code,
    countryName: user?.country?.country_name,
  });
}

/** Mantine NumberInput decimalScale for money fields (0 = non-decimal). */
export function getAmountDecimalScale(noDecimals: boolean): 0 | 2 {
  return noDecimals ? 0 : 2;
}

/**
 * Round a finite monetary value.
 * Non-decimal mode: nearest whole number (100.5 → 101, 100.3 → 100).
 * Else: 2 decimal places.
 */
export function roundMoneyAmount(value: number, noDecimals: boolean): number {
  if (!Number.isFinite(value)) return value;
  return noDecimals ? Math.round(value) : parseFloat(value.toFixed(2));
}

export function clampMoneyAmount(
  value: number | null | undefined,
  noDecimals = false,
): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return roundMoneyAmount(n, noDecimals);
}

export function formatMoneyAmount(
  value: number | null | undefined,
  noDecimals: boolean,
): string {
  const clamped = clampMoneyAmount(value ?? 0, noDecimals);
  if (clamped == null) return noDecimals ? "0" : "0.00";
  return noDecimals ? String(clamped) : clamped.toFixed(2);
}

/** Session flag so existing module-level clampAmount helpers pick up non-decimal mode. */
let moneyWholeNumberMode = false;

export function bindMoneyWholeNumberMode(noDecimals: boolean): void {
  moneyWholeNumberMode = Boolean(noDecimals);
}

export function isMoneyWholeNumberMode(): boolean {
  return moneyWholeNumberMode;
}

export function clampMoneyAmountBound(
  value: number | null | undefined,
): number | null {
  return clampMoneyAmount(value, moneyWholeNumberMode);
}

export function roundMoneyAmountBound(value: number): number {
  return roundMoneyAmount(value, moneyWholeNumberMode);
}

export function formatMoneyAmountBound(
  value: number | null | undefined,
): string {
  return formatMoneyAmount(value, moneyWholeNumberMode);
}

export function getBoundAmountDecimalScale(): 0 | 2 {
  return getAmountDecimalScale(moneyWholeNumberMode);
}

/**
 * Drop-in for amount fields that currently use `roundToDecimals(..., 2)`.
 * Respects the bound non-decimal (whole-number) mode.
 */
export function roundMoneyToDecimals(
  value: number | string | null | undefined,
): number | null | undefined {
  if (moneyWholeNumberMode) {
    if (value === null) return null;
    if (value === undefined) return undefined;
    if (value === "") return undefined;
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (!Number.isFinite(num)) return undefined;
    return Math.round(num);
  }
  return roundToDecimals(value, 2);
}
