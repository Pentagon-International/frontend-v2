import {
  formatUserDecimal,
  getDefaultBranchCountryCode,
  getDefaultBranchCurrencyCode,
  type BranchCurrencyContext,
} from "./userNumberFormat";

export type JobLevelSummary = {
  estimates_total_cost?: number | string | null;
};

export type HousingLevelSummary = {
  total_local_sell?: number | string | null;
  total_local_cost?: number | string | null;
  [key: string]: unknown;
};

export function parseSummaryAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function mapHousingSummaryFromApi(
  raw: unknown,
): HousingLevelSummary | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as HousingLevelSummary;
}

export function mapJobSummaryFromApi(raw: unknown): JobLevelSummary | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const summary = raw as Record<string, unknown>;
  return {
    estimates_total_cost: summary.estimates_total_cost as
      | number
      | string
      | null
      | undefined,
  };
}

export function calcEstimatesTotalCost(
  estimates: Array<{ total_cost?: unknown }> | undefined,
): number | null {
  if (!Array.isArray(estimates) || estimates.length === 0) return null;
  let sum = 0;
  let hasValue = false;
  for (const row of estimates) {
    const amount = parseSummaryAmount(row.total_cost);
    if (amount != null) {
      sum += amount;
      hasValue = true;
    }
  }
  return hasValue ? Math.round(sum * 100) / 100 : null;
}

export function calcChargesTotalSellLocal(
  charges: Array<{ sell_local_amount?: unknown; local_amount?: unknown }> | undefined,
): number | null {
  if (!Array.isArray(charges) || charges.length === 0) return null;
  let sum = 0;
  let hasValue = false;
  for (const charge of charges) {
    const amount = parseSummaryAmount(
      charge.sell_local_amount ?? charge.local_amount,
    );
    if (amount != null) {
      sum += amount;
      hasValue = true;
    }
  }
  return hasValue ? Math.round(sum * 100) / 100 : null;
}

export function calcChargesTotalCostLocal(
  charges: Array<{ cost_local_amount?: unknown }> | undefined,
): number | null {
  if (!Array.isArray(charges) || charges.length === 0) return null;
  let sum = 0;
  let hasValue = false;
  for (const charge of charges) {
    const amount = parseSummaryAmount(charge.cost_local_amount);
    if (amount != null) {
      sum += amount;
      hasValue = true;
    }
  }
  return hasValue ? Math.round(sum * 100) / 100 : null;
}

type HouseChargeSource = {
  charges?: Array<{
    sell_local_amount?: unknown;
    local_amount?: unknown;
    cost_local_amount?: unknown;
  }>;
  mawb_charges?: Array<{
    sell_local_amount?: unknown;
    local_amount?: unknown;
    cost_local_amount?: unknown;
  }>;
  mbl_charges?: Array<{
    sell_local_amount?: unknown;
    local_amount?: unknown;
    cost_local_amount?: unknown;
  }>;
};

/** Prefer normalized `charges`; fall back to API `mawb_charges` / `mbl_charges`. */
export function getHouseChargesForTotals(
  house?: HouseChargeSource | null,
): Array<{ sell_local_amount?: unknown; cost_local_amount?: unknown }> {
  if (!house) return [];
  for (const key of ["charges", "mawb_charges", "mbl_charges"] as const) {
    const rows = house[key];
    if (Array.isArray(rows) && rows.length > 0) return rows;
  }
  return [];
}

export function resolveHouseLocalTotals(
  charges:
    | Array<{
        sell_local_amount?: unknown;
        local_amount?: unknown;
        cost_local_amount?: unknown;
      }>
    | undefined,
  summary?: HousingLevelSummary | null,
): { totalSell: number | null; totalCost: number | null } {
  const summarySell = parseSummaryAmount(summary?.total_local_sell);
  const summaryCost = parseSummaryAmount(summary?.total_local_cost);
  const computedSell = calcChargesTotalSellLocal(charges);
  const computedCost = calcChargesTotalCostLocal(charges);

  return {
    totalSell: computedSell ?? summarySell,
    totalCost: computedCost ?? summaryCost,
  };
}

export function getUserLoggedInCurrencyCode(
  branches?: BranchCurrencyContext[] | null,
): string {
  return getDefaultBranchCurrencyCode(branches);
}

export function formatJobSummaryAmount(
  value: number | null | undefined,
  branches?: BranchCurrencyContext[] | null,
): string {
  if (value == null) return "-";
  const currencyCode = getDefaultBranchCurrencyCode(branches);
  const countryCode = getDefaultBranchCountryCode(branches);
  return formatUserDecimal(value, countryCode, currencyCode, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
