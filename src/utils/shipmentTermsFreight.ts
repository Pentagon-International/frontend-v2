/**
 * Maps shipment-terms master `freight` (PREPAID/COLLECT) to booking Freight dropdown values.
 */
export const normalizeShipmentTermsFreight = (
  value: unknown,
): "Prepaid" | "Collect" | "" => {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  if (raw === "PP" || raw.includes("PREPAID")) return "Prepaid";
  if (raw === "CC" || raw.includes("COLLECT")) return "Collect";
  return "";
};

export type TermsOfShipmentMasterItem = {
  tos_code?: string | null;
  tos_name?: string | null;
  freight?: string | null;
};

export type ApplyShipmentTermsSelectionOptions = {
  /** Booking forms use `freight`; house/job forms use `pp_cc`. Default: `freight`. */
  freightField?: "freight" | "pp_cc";
};

/**
 * Apply shipment-terms selection: code, name, and linked Freight (Prepaid/Collect).
 */
export const applyShipmentTermsSelection = (
  setFieldValue: (field: string, value: unknown) => void,
  termsOfShipment: TermsOfShipmentMasterItem[] | unknown,
  tosCode: string | null | undefined,
  options?: ApplyShipmentTermsSelectionOptions,
): void => {
  const freightField = options?.freightField ?? "freight";
  const code = tosCode || "";
  setFieldValue("shipment_terms_code", code);

  if (!code || !Array.isArray(termsOfShipment)) {
    setFieldValue("shipment_terms_name", "");
    return;
  }

  const selected = termsOfShipment.find(
    (item) => String(item?.tos_code ?? "") === code,
  );

  if (!selected) {
    setFieldValue("shipment_terms_name", "");
    return;
  }

  setFieldValue("shipment_terms_name", String(selected.tos_name ?? ""));

  const freight = normalizeShipmentTermsFreight(selected.freight);
  if (freight) {
    setFieldValue(freightField, freight);
  }
};
