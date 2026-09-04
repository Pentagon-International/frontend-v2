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

export function findPartyAddressByStateId(
  addresses: PartyAddressLike[] | undefined | null,
  stateId: string,
  stateOptions: Array<{ value: string; label?: string }>,
): PartyAddressLike | undefined {
  const target = String(stateId ?? "").trim();
  if (!target || !Array.isArray(addresses)) return undefined;

  return addresses.find(
    (address) => resolveStateCodeFromPartyAddress(address, stateOptions) === target,
  );
}

export function getPartyGstForStateId(
  addresses: PartyAddressLike[] | undefined | null,
  stateId: string,
  stateOptions: Array<{ value: string; label?: string }>,
): string {
  const address = findPartyAddressByStateId(addresses, stateId, stateOptions);
  const gst = address?.gst_id;
  return gst != null && String(gst).trim() !== "" ? String(gst).trim() : "";
}

/** Unique state options from party addresses (primary first when present). */
export function collectPartyStateOptions(
  addresses: PartyAddressLike[] | undefined | null,
  stateOptions: Array<{ value: string; label?: string }>,
): Array<{ value: string; label: string }> {
  if (!Array.isArray(addresses) || addresses.length === 0) return [];

  const primary = findPrimaryPartyAddress(addresses);
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  const pushOption = (address: PartyAddressLike) => {
    const value = resolveStateCodeFromPartyAddress(address, stateOptions);
    if (!value || seen.has(value)) return;
    seen.add(value);
    const masterLabel = stateOptions.find((s) => s.value === value)?.label;
    const addressStateLabel =
      address.state != null ? String(address.state).trim() : "";
    options.push({
      value,
      label: masterLabel ?? (addressStateLabel || value),
    });
  };

  if (primary) pushOption(primary);
  for (const address of addresses) pushOption(address);

  return options;
}

export function extractPartyAddressesFromRecord(
  record: unknown,
): PartyAddressLike[] {
  if (!record || typeof record !== "object") return [];
  const data = record as {
    addresses_data?: PartyAddressLike[];
    addresses?: PartyAddressLike[];
  };
  const addresses = data.addresses_data ?? data.addresses;
  return Array.isArray(addresses) ? addresses : [];
}

export type PartyTdsSectionLike = {
  section_id?: number | null;
  section_code?: string | null;
  section_name?: string | null;
  tds_section_code?: string | null;
  tds_section_name?: string | null;
};

export function extractPartyTdsSectionsFromRecord(
  record: unknown,
): PartyTdsSectionLike[] {
  if (!record || typeof record !== "object") return [];
  const data = record as {
    tds_section_data?: PartyTdsSectionLike[];
    tds_sections?: PartyTdsSectionLike[];
  };
  const rows = data.tds_section_data ?? data.tds_sections;
  return Array.isArray(rows) ? rows : [];
}

/**
 * TDS section code mapped from a party (vendor/agent/customer) master record.
 * Matched against the TDS section master options so an inactive or unknown code
 * is never pushed into the dropdown. Options built as `{name} - {code}`.
 */
export function resolvePartyTdsSectionCode(
  tdsSections: PartyTdsSectionLike[] | null | undefined,
  tdsSectionOptions?: Array<{ value: string; label?: string }>,
): string {
  const rows = Array.isArray(tdsSections) ? tdsSections : [];
  const options = Array.isArray(tdsSectionOptions) ? tdsSectionOptions : [];

  for (const row of rows) {
    const code = String(row.section_code ?? row.tds_section_code ?? "").trim();
    if (code) {
      if (options.length === 0) return code;
      const matched = options.find(
        (option) =>
          String(option.value).trim().toUpperCase() === code.toUpperCase(),
      );
      if (matched) return matched.value;
    }

    const name = String(row.section_name ?? row.tds_section_name ?? "")
      .trim()
      .toUpperCase();
    if (!name || options.length === 0) continue;
    const matchedByName = options.find((option) => {
      const label = String(option.label ?? "")
        .trim()
        .toUpperCase();
      return label === name || label.startsWith(`${name} - `);
    });
    if (matchedByName) return matchedByName.value;
  }

  return "";
}

export function mergeStateOptionsWithPartyAddresses(
  stateOptions: Array<{ value: string; label?: string }>,
  partyStateOptions: Array<{ value: string; label: string }>,
): Array<{ value: string; label: string }> {
  const merged = stateOptions.map((option) => ({
    value: option.value,
    label: option.label ?? option.value,
  }));
  const seen = new Set(merged.map((option) => option.value));

  for (const option of partyStateOptions) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    merged.push(option);
  }

  return merged;
}

export const PRQ_GST_CHARGE_NAME = {
  SGST: "STATE GOODS AND SERVICE TAX",
  CGST: "CENTRAL GOODS AND SERVICE TAX",
  IGST: "INTEGRATED GOODS AND SERVICE TAX",
} as const;

const PRQ_GST_CHARGE_NAME_SET = new Set<string>(
  Object.values(PRQ_GST_CHARGE_NAME),
);

export function isPrqGstChargeName(chargeName: unknown): boolean {
  return PRQ_GST_CHARGE_NAME_SET.has(
    String(chargeName ?? "").trim().toUpperCase(),
  );
}

export function isPrqTdsChargeRow(charge: Record<string, unknown>): boolean {
  return (
    (charge.charge_id == null || charge.charge_id === "") &&
    String(charge.account_code ?? "").trim() !== "" &&
    !isPrqGstChargeName(charge.charge_name)
  );
}

function parsePrqChargeAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function parsePrqChargeLocalAmount(
  charge: Record<string, unknown>,
): number | null {
  return (
    parsePrqChargeAmount(charge.local_amount) ??
    parsePrqChargeAmount(charge.amount_in_local) ??
    parsePrqChargeAmount(charge.amount)
  );
}

function parsePrqChargeForeignAmount(
  charge: Record<string, unknown>,
): number | null {
  return parsePrqChargeAmount(charge.amount);
}

export type PrqAgentInvAmountSplit = {
  taxable_amount: number | null;
  non_taxable_amount: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  charges: Record<string, unknown>[];
};

/**
 * Derive the Agent INV/CRN header amounts from PRQ charges so the supplier
 * invoice mirrors the payment request without a manual GST calculation.
 *
 * GST charge rows feed the CGST/SGST/IGST fields and the remaining ("actual")
 * charges feed Taxable Amount. With no GST rows at all, the actual charge total
 * becomes the Non Taxable Amount instead. Charge rows are carried over as-is.
 */
export function splitPrqChargesForSupplierInvoiceAgentInv(
  charges: unknown[],
  fallbackTotalAmount: number | null,
): PrqAgentInvAmountSplit {
  const rows = Array.isArray(charges) ? charges : [];
  const carriedCharges: Record<string, unknown>[] = [];
  let cgst_amount: number | null = null;
  let sgst_amount: number | null = null;
  let igst_amount: number | null = null;
  let actualSum = 0;
  let hasActualRow = false;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const charge = raw as Record<string, unknown>;
    carriedCharges.push(charge);

    const nameUpper = String(charge.charge_name ?? "").trim().toUpperCase();

    if (nameUpper === PRQ_GST_CHARGE_NAME.CGST) {
      cgst_amount = parsePrqChargeLocalAmount(charge);
      continue;
    }
    if (nameUpper === PRQ_GST_CHARGE_NAME.SGST) {
      sgst_amount = parsePrqChargeLocalAmount(charge);
      continue;
    }
    if (nameUpper === PRQ_GST_CHARGE_NAME.IGST) {
      igst_amount = parsePrqChargeLocalAmount(charge);
      continue;
    }

    if (isPrqTdsChargeRow(charge)) continue;

    const amount = parsePrqChargeForeignAmount(charge);
    if (amount != null) {
      actualSum += amount;
      hasActualRow = true;
    }
  }

  const actualTotal = hasActualRow ? clampPrqAmount(actualSum) : null;
  const hasGst =
    cgst_amount != null || sgst_amount != null || igst_amount != null;

  if (hasGst) {
    return {
      taxable_amount: actualTotal,
      non_taxable_amount: null,
      cgst_amount,
      sgst_amount,
      igst_amount,
      charges: carriedCharges,
    };
  }

  return {
    taxable_amount: null,
    non_taxable_amount: actualTotal ?? fallbackTotalAmount,
    cgst_amount: null,
    sgst_amount: null,
    igst_amount: null,
    charges: carriedCharges,
  };
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
