export type InvoicePostChargeResponse = {
  id?: number;
  charge_id?: number;
  charge_code?: string;
  charge_name?: string;
  shipment_id?: string;
  shipment_no?: string;
  shipper_id?: string;
  unit_code?: string | null;
  unit_id?: number | null;
  no_of_unit?: string | number;
  currency_code?: string;
  currency_id?: number;
  roe?: string | number;
  amount_per_unit?: string | number;
  amount?: string | number;
  amount_in_local?: string | number;
  amount_in_header?: string | number;
  tax_code?: string | null;
  tax_id?: number | null;
  is_tax_row?: boolean | null;
  Dr_Cr?: string;
  igst_rate?: string | number | null;
  cgst_rate?: string | number | null;
  sgst_rate?: string | number | null;
  tax_rate?: string | number | null;
  tax_amount?: string | number | null;
};

export type InvoiceMutationResponse = {
  id?: number;
  customer_id?: number;
  document_no?: string;
  status?: string;
  irn_no?: string | null;
  fapiao_no?: string | null;
  is_agent?: boolean;
  charges?: InvoicePostChargeResponse[];
};

export type ParsedInvoiceMutationResponse =
  | { success: false; message: string }
  | { success: true; message: string; data: InvoiceMutationResponse };

/** Handles `{ status, message, data }` wrapper and legacy top-level invoice objects. */
export function parseInvoiceMutationResponse(
  raw: unknown,
  fallbackMessage: string,
  successFallback?: string,
): ParsedInvoiceMutationResponse {
  const resolvedSuccessMessage = successFallback ?? fallbackMessage;
  const obj = raw as {
    status?: boolean;
    message?: string;
    data?: InvoiceMutationResponse;
    id?: number;
  } | null;

  if (!obj || typeof obj !== "object") {
    return { success: false, message: fallbackMessage };
  }

  if (typeof obj.status === "boolean") {
    if (obj.status === false) {
      return {
        success: false,
        message: (obj.message ?? "").trim() || fallbackMessage,
      };
    }
    const data =
      obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
        ? obj.data
        : null;
    if (!data) {
      return {
        success: false,
        message: (obj.message ?? "").trim() || fallbackMessage,
      };
    }
    return {
      success: true,
      message: (obj.message ?? "").trim() || resolvedSuccessMessage,
      data,
    };
  }

  if (obj.id != null) {
    return {
      success: true,
      message: resolvedSuccessMessage,
      data: obj as InvoiceMutationResponse,
    };
  }

  const nested = obj.data;
  if (
    nested &&
    typeof nested === "object" &&
    !Array.isArray(nested) &&
    nested.id != null
  ) {
    return {
      success: true,
      message: (obj.message ?? "").trim() || resolvedSuccessMessage,
      data: nested,
    };
  }

  return { success: false, message: fallbackMessage };
}

export function readIrnNoFromInvoiceData(
  data: { irn_no?: string | null } | null | undefined,
): string | null {
  if (!data || data.irn_no == null) return null;
  const irn = String(data.irn_no).trim();
  return irn !== "" ? irn : null;
}
