import type { ContractDetailResponse } from "./types";
import { getVendorTypeLabel } from "./utils";

export type MappedRateSheetRow = {
  key: string;
  origin_code: string;
  origin_label: string;
  destination_code: string;
  destination_label: string;
  equipment: string;
  buy_rate: string;
  charge_code: string;
  service_transit: string;
  notes: string;
};

export type MappedSurchargeRow = {
  key: string;
  charge_code: string;
  charge_name: string;
  basis: string;
  rate: string;
  frequency: string;
  applied: boolean;
};

export type MappedCreateContractForm = {
  contractId: string;
  carrierCode: string;
  carrierLabel: string;
  vendorReference: string;
  service: string;
  coverageDescription: string;
  currencyCode: string;
  currencyLabel: string;
  validFrom: string;
  validTo: string;
  approverLabel: string;
  autoRenew: boolean;
  autoRenewDays: number | null;
  internalNotes: string;
  rateRows: MappedRateSheetRow[];
  surchargeRows: MappedSurchargeRow[];
};

function formatPortLabel(name?: string, code?: string): string {
  const trimmedName = String(name ?? "").trim();
  const trimmedCode = String(code ?? "").trim();
  if (trimmedName && trimmedCode) return `${trimmedName} (${trimmedCode})`;
  return trimmedName || trimmedCode;
}

function createEmptyRateRow(): MappedRateSheetRow {
  return {
    key: crypto.randomUUID(),
    origin_code: "",
    origin_label: "",
    destination_code: "",
    destination_label: "",
    equipment: "",
    buy_rate: "",
    charge_code: "FRT",
    service_transit: "",
    notes: "",
  };
}

export function mapDetailToCreateForm(
  detail: ContractDetailResponse,
): MappedCreateContractForm {
  const basics = detail.contract_basics;

  return {
    contractId: basics.tariff_codes?.[0] || detail.vendor_reference,
    carrierCode: basics.carrier_code,
    carrierLabel: `${basics.carrier_name} · ${getVendorTypeLabel(basics.service)}`,
    vendorReference: basics.vendor_reference,
    service: basics.service,
    coverageDescription: basics.coverage_description,
    currencyCode: basics.currency_code,
    currencyLabel: basics.currency_code,
    validFrom: basics.valid_from,
    validTo: basics.valid_to,
    approverLabel: basics.approved_by || "",
    autoRenew: basics.auto_renew,
    autoRenewDays: basics.auto_renew_days,
    internalNotes: detail.internal_notes || "",
    rateRows:
      detail.rate_sheet.length > 0
        ? detail.rate_sheet.map((line) => ({
            key: crypto.randomUUID(),
            origin_code: line.origin_code,
            origin_label: formatPortLabel(line.origin_name, line.origin_code),
            destination_code: line.destination_code,
            destination_label: formatPortLabel(
              line.destination_name,
              line.destination_code,
            ),
            equipment: line.equipment || line.unit || "",
            buy_rate: line.buy_rate || line.rate || "",
            charge_code: line.charge_code || "FRT",
            service_transit: line.service_transit || "",
            notes: line.notes || "",
          }))
        : [createEmptyRateRow()],
    surchargeRows: detail.surcharges.map((item) => ({
      key: crypto.randomUUID(),
      charge_code: item.charge_code,
      charge_name: item.charge_name,
      basis: item.basis || item.unit || "",
      rate: item.rate,
      frequency: item.frequency || "",
      applied: item.applied !== false,
    })),
  };
}
