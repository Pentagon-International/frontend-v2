import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { postAPICall } from "./postApiCall";
import { API_HEADER } from "../store/storeKeys";

export type CustomerPanApprovalAddress = {
  id?: number;
  customer_location?: string | null;
  address_type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  pan_no?: string | null;
  gst_id?: string | null;
};

export type CustomerPanApprovalRow = {
  id: number;
  sno?: number;
  customer_name?: string;
  term_code?: string | null;
  tds_type?: string | null;
  own_office?: boolean;
  status?: string;
  assigned_to?: string;
  network_id?: number | null;
  network_name?: string | null;
  credit_day?: number;
  credit_amount?: string;
  created_at?: string;
  created_by?: string;
  approved?: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  customer_code?: string | null;
  customer_types?: unknown[];
  addresses_data?: CustomerPanApprovalAddress[];
  /** Flattened from primary address for table display */
  pan_no?: string;
  gstin?: string;
  gstin_count?: number;
  state?: string;
  district?: string;
  pincode?: string;
};

export type CustomerPanApprovalListResponse = {
  success?: boolean;
  message?: string | null;
  total?: number;
  filters_total_count?: number;
  pagination_total?: number;
  index?: number;
  limit?: number;
  data?: CustomerPanApprovalRow[];
};

function getPrimaryAddress(
  record: CustomerPanApprovalRow,
): CustomerPanApprovalAddress | undefined {
  const addresses = record.addresses_data;
  if (!Array.isArray(addresses) || addresses.length === 0) return undefined;

  const primary = addresses.find(
    (addr) => String(addr.address_type ?? "").trim().toLowerCase() === "primary",
  );
  return primary ?? addresses[0];
}

export function normalizeCustomerPanApprovalRow(
  record: CustomerPanApprovalRow,
): CustomerPanApprovalRow {
  const primary = getPrimaryAddress(record);
  const gstinList = (record.addresses_data ?? [])
    .map((addr) => String(addr.gst_id ?? "").trim())
    .filter(Boolean);
  const uniqueGstins = [...new Set(gstinList)];

  return {
    ...record,
    pan_no: String(primary?.pan_no ?? record.pan_no ?? "").trim(),
    gstin: uniqueGstins[0] ?? String(record.gstin ?? "").trim(),
    gstin_count: uniqueGstins.length || record.gstin_count,
    state: String(primary?.state ?? record.state ?? "").trim(),
    district: String(
      primary?.customer_location ?? primary?.city ?? record.district ?? "",
    ).trim(),
    pincode: String(primary?.pincode ?? record.pincode ?? "").trim(),
  };
}

function normalizeListResponse(
  body: unknown,
  limit: number,
): {
  rows: CustomerPanApprovalRow[];
  total: number;
  paginationTotal: number;
} {
  if (!body || typeof body !== "object") {
    return { rows: [], total: 0, paginationTotal: 1 };
  }

  const payload = body as CustomerPanApprovalListResponse;

  if (Array.isArray(payload.data)) {
    const total = payload.filters_total_count ?? payload.total ?? payload.data.length;
    const derivedPages =
      limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    const paginationTotal =
      payload.pagination_total && payload.pagination_total > 0
        ? payload.pagination_total
        : derivedPages;
    return {
      rows: payload.data.map(normalizeCustomerPanApprovalRow),
      total,
      paginationTotal,
    };
  }

  if (Array.isArray(body)) {
    const rows = (body as CustomerPanApprovalRow[]).map(
      normalizeCustomerPanApprovalRow,
    );
    return { rows, total: rows.length, paginationTotal: 1 };
  }

  return { rows: [], total: 0, paginationTotal: 1 };
}

export async function fetchCustomerPanPendingList(
  index: number,
  limit: number,
): Promise<{
  rows: CustomerPanApprovalRow[];
  total: number;
  paginationTotal: number;
}> {
  const response = await apiCallProtected.post(
    `${URL.customerVerificationFilter}?index=${index}&limit=${limit}`,
    { filters: { approved: false } },
  );
  return normalizeListResponse(response, limit);
}

export async function approveCustomerPan(id: number): Promise<unknown> {
  return postAPICall(
    `${URL.customerVerification}${id}/approve/`,
    { status: "approved" },
    API_HEADER,
  );
}

export async function rejectCustomerPan(id: number): Promise<unknown> {
  return postAPICall(
    `${URL.customerVerification}${id}/approve/`,
    { status: "rejected" },
    API_HEADER,
  );
}

export function extractApiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Request failed";
}
