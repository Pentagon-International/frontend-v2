import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { postAPICall } from "./postApiCall";
import { API_HEADER } from "../store/storeKeys";

export type CustomerPanApprovalRow = {
  id: number;
  pan_no?: string;
  customer_name?: string;
  gstin?: string;
  gstin_count?: number;
  state?: string;
  district?: string;
  pincode?: string;
  assigned_to?: string;
  status?: string;
  created_at?: string;
  created_by?: string;
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
    return { rows: payload.data, total, paginationTotal };
  }

  if (Array.isArray(body)) {
    const rows = body as CustomerPanApprovalRow[];
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
    `${URL.customerPanPendingList}?index=${index}&limit=${limit}`,
    { filters: {} },
  );
  return normalizeListResponse(response, limit);
}

export async function approveCustomerPan(
  id: number,
): Promise<unknown> {
  return postAPICall(URL.customerPanApprove, { id }, API_HEADER);
}

export async function rejectCustomerPan(id: number): Promise<unknown> {
  return postAPICall(URL.customerPanReject, { id }, API_HEADER);
}

export function extractApiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Request failed";
}
