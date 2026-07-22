/**
 * House charge sell/cost local amount helpers (Export Job / booking → job).
 * Matches HouseCreate formulas:
 *   amount = no_of_unit * amount_per_unit (when amount not set)
 *   sell_local_amount = amount * roe
 *   cost_local_amount = total_cost * roe
 *
 * Rounding follows bound non-decimal money mode (see nonDecimalMoneyAmount.ts).
 */

import { roundMoneyAmountBound } from "./nonDecimalMoneyAmount";

export function toChargeNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

export function roundChargeAmount(value: number): number {
  return roundMoneyAmountBound(value);
}

/** Resolve sell amount from amount or no_of_unit × amount_per_unit. */
export function resolveSellAmount(
  amount: unknown,
  noOfUnit: unknown,
  amountPerUnit: unknown,
): number | null {
  const direct = toChargeNumber(amount);
  if (direct != null && direct > 0) return roundChargeAmount(direct);

  const qty = toChargeNumber(noOfUnit);
  const cpu = toChargeNumber(amountPerUnit);
  if (qty != null && cpu != null && qty > 0 && cpu > 0) {
    return roundChargeAmount(qty * cpu);
  }

  return direct != null && direct > 0 ? roundChargeAmount(direct) : null;
}

export function calcSellLocalAmount(
  amount: unknown,
  roe: unknown,
  noOfUnit?: unknown,
  amountPerUnit?: unknown,
): number | null {
  const sellAmount = resolveSellAmount(amount, noOfUnit, amountPerUnit);
  const rate = toChargeNumber(roe) ?? 1;
  if (sellAmount == null || sellAmount <= 0 || rate <= 0) return null;
  return roundChargeAmount(sellAmount * rate);
}

export function calcCostLocalAmount(
  totalCost: unknown,
  roe: unknown,
): number | null {
  const cost = toChargeNumber(totalCost);
  const rate = toChargeNumber(roe) ?? 1;
  if (cost == null || cost <= 0 || rate <= 0) return null;
  return roundChargeAmount(cost * rate);
}

/** For job-create API payload (numeric or empty string). */
export function sellLocalAmountForPayload(
  amount: unknown,
  roe: unknown,
  noOfUnit?: unknown,
  amountPerUnit?: unknown,
): number | "" {
  const n = calcSellLocalAmount(amount, roe, noOfUnit, amountPerUnit);
  return n != null ? n : "";
}

export function costLocalAmountForPayload(
  totalCost: unknown,
  roe: unknown,
): number | "" {
  const n = calcCostLocalAmount(totalCost, roe);
  return n != null ? n : "";
}
