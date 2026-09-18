export type CustomerSelectionType = "master" | "freeText" | "temp";

export type CustomerSelectionState = {
  selectionType: CustomerSelectionType;
  customerName: string;
  tempCode: string | null;
};

export const INITIAL_CUSTOMER_SELECTION: CustomerSelectionState = {
  selectionType: "master",
  customerName: "",
  tempCode: null,
};

type BuildCustomerCreatePayloadParams = {
  selection: CustomerSelectionState;
  customerFieldValue: string;
  fieldKey: "customer" | "customer_code";
};

/** Build extra customer fields for create payloads (call entry / enquiry). */
export function buildCustomerCreatePayloadFields({
  selection,
  customerFieldValue,
  fieldKey,
}: BuildCustomerCreatePayloadParams): Record<string, string> {
  const payload: Record<string, string> = {
    [fieldKey]: customerFieldValue,
  };

  if (selection.selectionType === "temp" && selection.tempCode) {
    payload.temp_code = selection.tempCode;
    if (selection.customerName) {
      payload.customer_name = selection.customerName;
    }
  }

  return payload;
}

export function isNewCustomerDetailsPending(
  selection: CustomerSelectionState
): boolean {
  return selection.selectionType === "freeText";
}

export function isNewCustomerSelection(
  selection: CustomerSelectionState
): boolean {
  return (
    selection.selectionType === "freeText" || selection.selectionType === "temp"
  );
}

export const NEW_CUSTOMER_DETAILS_PENDING_ERROR =
  "Please save the new customer details";

/** True when a forwarder party is selected (code, id, or name). */
export function hasForwarderParty(params: {
  forwarderCode?: unknown;
  forwarderId?: unknown;
  forwarderName?: unknown;
}): boolean {
  if (
    params.forwarderId != null &&
    String(params.forwarderId).trim() !== ""
  ) {
    return true;
  }
  if (String(params.forwarderCode ?? "").trim()) return true;
  if (String(params.forwarderName ?? "").trim()) return true;
  return false;
}

/** True when a billing customer party is selected (id or name). */
export function hasBillingCustomerParty(params: {
  billingCustomerId?: string | number | null;
  billingCustomerName?: string | null;
}): boolean {
  if (
    params.billingCustomerId != null &&
    String(params.billingCustomerId).trim() !== ""
  ) {
    return true;
  }
  if (String(params.billingCustomerName ?? "").trim()) return true;
  return false;
}

/** Include temp_code on booking/job shipper payloads when applicable. */
export function buildShipperTempPayloadFields(
  selection: CustomerSelectionState
): Record<string, string> {
  if (selection.selectionType === "temp" && selection.tempCode) {
    return { temp_code: selection.tempCode };
  }
  return {};
}

/**
 * Customer master codes look like "CUST27721". Bare numeric values are
 * internal PKs (e.g. 27714) and must not be used for customer_master search.
 */
export function isCustomerMasterCode(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  return !/^\d+$/.test(s);
}

/** First non-empty value that looks like a customer/agent master code. */
export function resolveCustomerMasterCode(
  ...candidates: unknown[]
): string {
  for (const candidate of candidates) {
    if (isCustomerMasterCode(candidate)) {
      return String(candidate).trim();
    }
  }
  return "";
}

/** First master code found across records/keys (skips bare numeric PKs). */
export function pickCustomerMasterCodeFromRecords(
  records: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
): string {
  for (const rec of records) {
    if (!rec) continue;
    for (const key of keys) {
      const code = resolveCustomerMasterCode(rec[key]);
      if (code) return code;
    }
  }
  return "";
}
