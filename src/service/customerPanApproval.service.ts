import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { postAPICall } from "./postApiCall";
import { API_HEADER } from "../store/storeKeys";

export type CustomerPanApprovalAddress = {
  id?: number;
  customer_location?: string | null;
  address_type?: string | null;
  address?: string | null;
  msme?: boolean;
  msme_no?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  phone_no?: string | null;
  mobile_no?: string | null;
  email?: string | null;
  pan_no?: string | null;
  pan_aadhaar_link?: boolean;
  Itr_filed?: string | null;
  tds_threshold_flag?: boolean;
  gst_registration_status?: string | null;
  tan_no?: string | null;
  gst_id?: string | null;
  arn_no?: string | null;
  uin_no?: string | null;
  composite_regular?: string | null;
  sez?: boolean;
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
  /** Derived summaries for list display */
  address_count?: number;
  gstin_count?: number;
  pan_count?: number;
};

export type CustomerPanApprovalFilters = {
  customer_name?: string;
  term_code?: string;
  status?: string;
};

export type RelatedCustomer = {
  id: number;
  customer_code?: string;
  customer_name?: string;
  status?: string;
  city?: string;
  address?: string;
  email?: string | null;
  phone_no?: string | null;
};

export type RelatedCustomersResponse = {
  success?: boolean;
  message?: string | null;
  search_name?: string;
  total?: number;
  data?: RelatedCustomer[];
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

export function normalizeCustomerPanApprovalRow(
  record: CustomerPanApprovalRow,
): CustomerPanApprovalRow {
  const addresses = record.addresses_data ?? [];
  const gstinList = addresses
    .map((addr) => String(addr.gst_id ?? "").trim())
    .filter(Boolean);
  const uniqueGstins = [...new Set(gstinList)];
  const panList = addresses
    .map((addr) => String(addr.pan_no ?? "").trim())
    .filter(Boolean);
  const uniquePans = [...new Set(panList)];

  return {
    ...record,
    address_count: addresses.length,
    gstin_count: uniqueGstins.length,
    pan_count: uniquePans.length,
  };
}

export function formatCustomerPanDisplayValue(
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
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

function buildCustomerPanApprovalFiltersPayload(
  filters?: CustomerPanApprovalFilters,
): Record<string, string> {
  const payload: Record<string, string> = {};

  const customerName = String(filters?.customer_name ?? "").trim();
  const termCode = String(filters?.term_code ?? "").trim();
  const status = String(filters?.status ?? "").trim();

  if (customerName) payload.customer_name = customerName;
  if (termCode) payload.term_code = termCode;
  if (status) payload.status = status;

  return payload;
}

export async function fetchCustomerPanPendingList(
  index: number,
  limit: number,
  filters?: CustomerPanApprovalFilters,
): Promise<{
  rows: CustomerPanApprovalRow[];
  total: number;
  paginationTotal: number;
}> {
  const filtersPayload = buildCustomerPanApprovalFiltersPayload(filters);
  const response = await apiCallProtected.post(
    `${URL.customerVerificationFilter}?index=${index}&limit=${limit}`,
    { filters: filtersPayload },
  );
  return normalizeListResponse(response, limit);
}

export async function fetchRelatedCustomers(
  customerName: string,
): Promise<RelatedCustomersResponse> {
  const response = await postAPICall(
    URL.customerVerificationRelatedCustomers,
    { customer_name: customerName },
    API_HEADER,
  );
  return (response ?? {}) as RelatedCustomersResponse;
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
