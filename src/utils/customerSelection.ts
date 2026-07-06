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
