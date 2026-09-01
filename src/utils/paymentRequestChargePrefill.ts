/**
 * Maps job/house/estimate charge rows into Payment Request create navigation state.
 * PRQ cost fields use amount_per_unit (cost/unit) and amount (total cost).
 */

import { clampMoneyAmountBound } from "./nonDecimalMoneyAmount";

export type ChargeSourceForPrqPrefill = {
  charge_id?: number | null;
  charge_name?: string;
  currency?: string;
  currency_code?: string;
  currency_id?: string | number | null;
  roe?: number | null;
  unit_code?: string;
  unit?: string;
  unit_id?: string | number | null;
  no_of_unit?: number | null;
  no_of_units?: number | null;
  unit_cost?: number | null;
  cost_per_unit?: number | null;
  total_cost?: number | null;
  cost_local_amount?: number | null;
  local_amount?: number | null;
};

export type PaymentRequestChargePrefillContext = {
  job_no: string;
  sub_job?: string;
  segment?: string;
  cn_r?: string;
};

export type PaymentRequestPrefillSource = "estimate" | "house";

export type PartyAddressLike = {
  address_type?: string;
  gst_id?: string | null;
  state_id?: number | null;
  state?: unknown;
};

function toNumOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampPrqAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return clampMoneyAmountBound(value);
}

/** Cost/unit for PRQ — house charges use unit_cost; estimates use cost_per_unit. */
export function resolvePrqCostPerUnit(
  charge: ChargeSourceForPrqPrefill,
): number | null {
  return toNumOrNull(charge.unit_cost ?? charge.cost_per_unit);
}

/** Total cost for PRQ — never falls back to sell amount. */
export function resolvePrqTotalCost(
  charge: ChargeSourceForPrqPrefill,
): number | null {
  const total = toNumOrNull(charge.total_cost);
  if (total != null) return total;

  const qty = toNumOrNull(charge.no_of_unit ?? charge.no_of_units);
  const costPerUnit = resolvePrqCostPerUnit(charge);
  if (qty != null && costPerUnit != null && qty > 0 && costPerUnit > 0) {
    return clampPrqAmount(qty * costPerUnit);
  }

  return null;
}

/** PRQ amount/local amount from qty × cost/unit and amount × ROE. */
export function recalculatePrqChargeAmounts(charge: {
  no_of_unit?: number | null;
  amount_per_unit?: number | null;
  roe?: number | null;
}): { amount: number | null; amount_in_local: number | null } {
  const qty = toNumOrNull(charge.no_of_unit);
  const costPerUnit = toNumOrNull(charge.amount_per_unit);
  const roe = toNumOrNull(charge.roe);

  let amount: number | null = null;
  if (qty != null && costPerUnit != null && qty > 0 && costPerUnit > 0) {
    amount = clampPrqAmount(qty * costPerUnit);
  }

  let amount_in_local: number | null = null;
  if (amount != null && roe != null && roe > 0) {
    amount_in_local = clampPrqAmount(amount * roe);
  }

  return { amount, amount_in_local };
}

export function findPrimaryPartyAddress(
  addresses: PartyAddressLike[] | undefined | null,
): PartyAddressLike | undefined {
  if (!Array.isArray(addresses) || addresses.length === 0) return undefined;
  return (
    addresses.find(
      (address) =>
        String(address.address_type ?? "").trim().toUpperCase() === "PRIMARY",
    ) ?? addresses[0]
  );
}

export function getPartyGstFromPrimaryAddress(
  addresses: PartyAddressLike[] | undefined | null,
): string {
  const primary = findPrimaryPartyAddress(addresses);
  const gst = primary?.gst_id;
  return gst != null && String(gst).trim() !== "" ? String(gst).trim() : "";
}

export type PartyGstOption = {
  value: string;
  address: PartyAddressLike;
};

/** Unique GST numbers from party addresses (primary first when present). */
export function collectPartyGstOptions(
  addresses: PartyAddressLike[] | undefined | null,
): PartyGstOption[] {
  if (!Array.isArray(addresses) || addresses.length === 0) return [];

  const primary = findPrimaryPartyAddress(addresses);
  const seen = new Set<string>();
  const options: PartyGstOption[] = [];

  const pushOption = (address: PartyAddressLike) => {
    const gst =
      address.gst_id != null ? String(address.gst_id).trim() : "";
    if (!gst || seen.has(gst)) return;
    seen.add(gst);
    options.push({ value: gst, address });
  };

  if (primary) pushOption(primary);
  for (const address of addresses) pushOption(address);

  return options;
}

export function findPartyAddressByGst(
  addresses: PartyAddressLike[] | undefined | null,
  gst: string,
): PartyAddressLike | undefined {
  const target = String(gst ?? "").trim();
  if (!target || !Array.isArray(addresses)) return undefined;
  return addresses.find(
    (address) => String(address.gst_id ?? "").trim() === target,
  );
}

export function resolveStateCodeFromPartyAddress(
  address: PartyAddressLike | undefined,
  stateOptions: Array<{ value: string; label?: string }>,
): string {
  if (!address) return "";

  const stateCandidate = address.state_id ?? address.state;
  if (stateCandidate == null || String(stateCandidate).trim() === "") {
    return "";
  }

  const candidateStr = String(stateCandidate).trim();
  const numericMatch = candidateStr.match(/^\d+$/);
  const matchedState = numericMatch
    ? (stateOptions.find((s) => String(s.value).trim() === candidateStr) ??
      null)
    : (stateOptions.find(
        (s) =>
          String(s.label ?? "")
            .trim()
            .toLowerCase() === candidateStr.toLowerCase(),
      ) ?? null);

  return (
    matchedState?.value ?? (numericMatch ? candidateStr : candidateStr)
  );
}

export function mapChargeToPaymentRequestPrefill(
  charge: ChargeSourceForPrqPrefill,
  context: PaymentRequestChargePrefillContext,
  options?: { source?: PaymentRequestPrefillSource },
): Record<string, unknown> {
  const source = options?.source ?? "house";
  const roe = toNumOrNull(charge.roe);
  const noOfUnit = toNumOrNull(charge.no_of_unit ?? charge.no_of_units);
  const amountPerUnit = resolvePrqCostPerUnit(charge);

  const base = {
    charge_id: charge.charge_id ?? null,
    charge_name: charge.charge_name ?? "",
    segment: context.segment ?? "",
    job_no: context.job_no,
    sub_job: context.sub_job ?? "",
    cn_r: context.cn_r ?? "",
    currency: charge.currency_code ?? charge.currency ?? "",
    currency_id: charge.currency_id ?? "",
    roe,
    unit_code: charge.unit_code ?? charge.unit ?? "",
    unit_id: charge.unit_id ?? "",
    no_of_unit: noOfUnit,
    amount_per_unit: amountPerUnit,
    tax_code: "",
    tax: "false",
  };

  if (source === "estimate") {
    return {
      ...base,
      amount: null,
      amount_in_local: null,
    };
  }

  const totalCost = resolvePrqTotalCost(charge);
  return {
    ...base,
    amount: totalCost,
    amount_in_local:
      toNumOrNull(charge.cost_local_amount ?? charge.local_amount) ??
      (totalCost != null && roe != null
        ? clampPrqAmount(totalCost * roe)
        : null),
  };
}
