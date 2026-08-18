/**
 * House charge sell/cost local amount helpers (Export Job / booking → job).
 * Matches HouseCreate formulas:
 *   amount = no_of_unit * amount_per_unit (when amount not set)
 *   sell_local_amount = amount * roe
 *   cost_local_amount = total_cost * roe
 *
 * Rounding follows bound non-decimal money mode (see nonDecimalMoneyAmount.ts).
 */

import {
  clampMoneyAmount,
  roundMoneyAmountBound,
} from "./nonDecimalMoneyAmount";

export function toChargeNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

/** Currency-side charge amounts (sell/cost in charge currency): always 2 dp. */
export function roundChargeAmount(value: number): number {
  return clampMoneyAmount(value, false) ?? 0;
}

/** Local amount fields (sell/cost in branch currency): Vietnam whole numbers when bound. */
export function roundLocalChargeAmount(value: number): number {
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
  return roundLocalChargeAmount(sellAmount * rate);
}

export function calcCostLocalAmount(
  totalCost: unknown,
  roe: unknown,
): number | null {
  const cost = toChargeNumber(totalCost);
  const rate = toChargeNumber(roe) ?? 1;
  if (cost == null || cost <= 0 || rate <= 0) return null;
  return roundLocalChargeAmount(cost * rate);
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

type SupplierInvoiceCostRow = {
  total_cost?: unknown;
  unit_cost?: unknown;
  cost_per_unit?: unknown;
  no_of_unit?: unknown;
  roe?: unknown;
};

/**
 * Estimates "Total" is qty × cost/unit × ROE. Supplier Invoice Amount is
 * currency cost (qty × cost/unit), then that screen applies ROE for local.
 * Never uses sell `amount`.
 */
export function resolveSupplierInvoiceEstimateCostAmount(
  row: SupplierInvoiceCostRow,
): number | null {
  const qty = toChargeNumber(row.no_of_unit);
  const cpu = toChargeNumber(row.cost_per_unit);
  if (qty != null && cpu != null && qty > 0) {
    return roundChargeAmount(qty * cpu);
  }

  const total = toChargeNumber(row.total_cost);
  if (total == null) return null;
  const roe = toChargeNumber(row.roe);
  if (roe != null && roe !== 0) {
    return roundChargeAmount(total / roe);
  }
  return roundChargeAmount(total);
}

/**
 * House Total Cost is already currency cost (qty × unit cost).
 * Never uses sell `amount` or cost_local_amount.
 */
export function resolveSupplierInvoiceHouseCostAmount(
  row: SupplierInvoiceCostRow,
): number | null {
  const total = toChargeNumber(row.total_cost);
  if (total != null) return roundChargeAmount(total);

  const qty = toChargeNumber(row.no_of_unit);
  const unitCost = toChargeNumber(row.unit_cost ?? row.cost_per_unit);
  if (qty != null && unitCost != null) {
    return roundChargeAmount(qty * unitCost);
  }
  return null;
}
