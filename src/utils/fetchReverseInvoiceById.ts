import { URL } from "../api/serverUrls";
import { getAPICall } from "../service/getApiCall";
import { API_HEADER } from "../store/storeKeys";

export type ReverseInvoiceDetail = {
  id?: number;
  customer_id?: number;
  state_id?: number;
  state_name?: string;
  currency_id?: number;
  currency_code?: string;
  bill_to?: string;
  bill_to_name?: string;
  address?: string;
  gstn?: string;
  shipment_no?: string;
  day_book_id?: number;
  day_book_name?: string;
  document_no?: string;
  reverse_document_no?: string;
  document_date?: string;
  due_date?: string;
  roe?: string | number;
  narration?: string;
  irn_no?: string;
  fapiao_no?: string;
  status?: string;
  total?: string | number;
  header_total?: string | number;
  Dr_Cr?: string;
  document_type?: string;
  is_agent?: boolean;
  charges?: Array<{
    id?: number;
    charge_id?: number;
    charge_name?: string;
    shipment_id?: string;
    shipment_no?: string;
    unit_code?: string;
    currency_code?: string;
    no_of_unit?: string | number;
    roe?: string | number;
    amount_per_unit?: string | number;
    amount?: string | number;
    amount_in_local?: string | number;
    amount_in_header?: string | number;
    tax_code?: string;
    Dr_Cr?: string;
  }>;
};

function unwrapGetResponse<T>(response: unknown): T | null {
  const payload = response as { data?: unknown };
  const inner = payload?.data;
  const raw =
    inner != null &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    "data" in (inner as Record<string, unknown>)
      ? (inner as { data?: unknown }).data
      : (inner ?? response);
  const data = Array.isArray(raw) ? raw[0] : raw;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as T;
}

/** GET reverse-invoice/{id}/ — full document for edit/view. */
export async function fetchReverseInvoiceById(
  reverseInvoiceId: number,
): Promise<ReverseInvoiceDetail | null> {
  const response = await getAPICall(
    `${URL.reverseInvoice}${reverseInvoiceId}/`,
    API_HEADER,
  );
  return unwrapGetResponse<ReverseInvoiceDetail>(response);
}
