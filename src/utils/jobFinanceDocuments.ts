import { URL } from "../api/serverUrls";
import { postAPICall } from "../service/postApiCall";
import { API_HEADER } from "../store/storeKeys";

export type JobFinanceDocumentType =
  | "invoice"
  | "supplier_invoice"
  | "payment_request"
  | string;

export type JobFinanceReverseDocument = {
  reverse_invoice_id?: number;
  reverse_supplier_invoice_id?: number;
  day_book_name?: string | null;
  document_no?: string;
  party_name?: string;
  document_date?: string;
  local_total?: string | number;
  header_total?: string | number;
  status?: string;
  [key: string]: unknown;
};

export type JobFinanceDocument = {
  sno?: number;
  document_type: JobFinanceDocumentType;
  invoice_id?: number;
  supplier_invoice_id?: number;
  payment_request_id?: number;
  day_book_name?: string | null;
  document_no?: string;
  party_name?: string;
  document_date?: string;
  local_total?: string | number;
  header_total?: string | number;
  status?: string;
  reverse?: JobFinanceReverseDocument[];
  [key: string]: unknown;
};

export type JobFinanceDocumentsSearchFilters = {
  day_book_name?: string;
  document_no?: string;
  party_name?: string;
  status?: string;
};

export type FetchJobFinanceDocumentsParams = {
  jobId?: string | null;
  shipmentId?: string | null;
  /** Offset (pageIndex * pageSize). */
  index?: number;
  limit?: number;
  search?: JobFinanceDocumentsSearchFilters;
};

export type JobFinanceDocumentsResponse = {
  data: JobFinanceDocument[];
  total: number;
  index: number;
  limit: number;
};

export const JOB_FINANCE_DOCUMENTS_PAGE_SIZE = 20;

export function getJobFinanceDocumentId(
  row: JobFinanceDocument,
): number | null {
  const type = String(row.document_type ?? "")
    .trim()
    .toLowerCase();
  if (type === "invoice" && row.invoice_id != null) {
    return Number(row.invoice_id);
  }
  if (type === "supplier_invoice" && row.supplier_invoice_id != null) {
    return Number(row.supplier_invoice_id);
  }
  if (type === "payment_request" && row.payment_request_id != null) {
    return Number(row.payment_request_id);
  }
  return null;
}

export function getJobFinanceReverseDocumentId(
  rev: JobFinanceReverseDocument,
  parentType?: string | null,
): number | null {
  const type = String(parentType ?? "")
    .trim()
    .toLowerCase();
  if (type === "supplier_invoice" && rev.reverse_supplier_invoice_id != null) {
    return Number(rev.reverse_supplier_invoice_id);
  }
  if (rev.reverse_invoice_id != null) {
    return Number(rev.reverse_invoice_id);
  }
  if (rev.reverse_supplier_invoice_id != null) {
    return Number(rev.reverse_supplier_invoice_id);
  }
  return null;
}

/** Restore job/house form tab after returning from an Accounts document. */
export function readJobFormActiveTabFromLocation(
  locationState: unknown,
  fallback = 0,
): number {
  const raw = (locationState as { activeTab?: unknown } | null | undefined)
    ?.activeTab;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export async function fetchJobFinanceDocuments(
  params: FetchJobFinanceDocumentsParams,
): Promise<JobFinanceDocumentsResponse> {
  const jobId = params.jobId != null ? String(params.jobId).trim() : "";
  const shipmentId =
    params.shipmentId != null ? String(params.shipmentId).trim() : "";
  const limit = params.limit ?? JOB_FINANCE_DOCUMENTS_PAGE_SIZE;
  const index = params.index ?? 0;

  if (!jobId && !shipmentId) {
    return { data: [], total: 0, index, limit };
  }

  const filters: Record<string, string> = jobId
    ? { job_id: jobId }
    : { shipment_id: shipmentId };

  const dayBookName = params.search?.day_book_name?.trim() ?? "";
  const documentNo = params.search?.document_no?.trim() ?? "";
  const partyName = params.search?.party_name?.trim() ?? "";
  const status = params.search?.status?.trim() ?? "";
  if (dayBookName) filters.day_book_name = dayBookName;
  if (documentNo) filters.document_no = documentNo;
  if (partyName) filters.party_name = partyName;
  if (status) filters.status = status;

  const res = await postAPICall(
    URL.jobFinanceDocumentsFilter,
    {
      filters,
      index,
      limit,
    },
    API_HEADER,
  );
  const body = res as {
    data?: JobFinanceDocument[];
    total?: number;
    index?: number;
    limit?: number;
  };
  const data = Array.isArray(body?.data) ? body.data : [];
  const total =
    typeof body?.total === "number" && Number.isFinite(body.total)
      ? body.total
      : data.length;

  return {
    data,
    total,
    index: typeof body?.index === "number" ? body.index : index,
    limit: typeof body?.limit === "number" ? body.limit : limit,
  };
}
