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

/**
 * Job finance docs return RCM supplier invoices as `document_type: "supplier_invoice"`
 * with `day_book_name: "COST INVOICE"` (no `is_rcm` flag). Also honor `is_rcm` when present.
 */
export function isRcmSupplierInvoiceDocument(
  row: {
    is_rcm?: unknown;
    day_book_name?: unknown;
    daybook_name?: unknown;
  } | null | undefined,
): boolean {
  if (!row) return false;
  const raw = row.is_rcm;
  if (raw === true || raw === 1) return true;
  const flag = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;

  const bookName = String(row.day_book_name ?? row.daybook_name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return bookName === "cost invoice";
}

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

function coercePositiveId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normalize daybook / API aliases to canonical job-finance document types. */
export function normalizeJobFinanceDocumentType(value: unknown): string {
  const t = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    inv: "invoice",
    crn: "credit_note",
    cn: "credit_note",
    cdn: "credit_note",
    invrev: "reverse_invoice",
    inv_rev: "reverse_invoice",
    invoice_reverse: "reverse_invoice",
    rpt: "receipt",
    rptrev: "reverse_receipt",
    rpt_rev: "reverse_receipt",
    receipt_reverse: "reverse_receipt",
    pmt: "payment",
    pmtrev: "reverse_payment",
    pmt_rev: "reverse_payment",
    payment_reverse: "reverse_payment",
    jv: "journal_voucher",
    glj: "journal_voucher",
    jvrev: "reverse_voucher",
    jv_rev: "reverse_voucher",
    gljrev: "reverse_voucher",
    journal_voucher_reversal: "reverse_voucher",
    crj: "supplier_invoice",
    cinv: "supplier_invoice",
    supplier_invoice_rcm: "supplier_invoice",
    crjrev: "reverse_supplier_invoice",
    cinvrev: "reverse_supplier_invoice",
    supplier_invoice_reverse: "reverse_supplier_invoice",
    reverse_supplier_invoice_rcm: "reverse_supplier_invoice",
  };
  return aliases[t] ?? t;
}

export function getJobFinanceDocumentId(
  row: JobFinanceDocument,
): number | null {
  const type = normalizeJobFinanceDocumentType(row.document_type);

  const typed: Record<string, unknown[]> = {
    invoice: [row.invoice_id],
    credit_note: [
      row.invoice_id,
      row.credit_note_id,
      (row as { id?: unknown }).id,
    ],
    reverse_invoice: [
      row.reverse_invoice_id,
      (row as { id?: unknown }).id,
    ],
    supplier_invoice: [row.supplier_invoice_id],
    reverse_supplier_invoice: [
      row.reverse_supplier_invoice_id,
      (row as { id?: unknown }).id,
    ],
    payment_request: [row.payment_request_id],
    receipt: [row.receipt_id, (row as { id?: unknown }).id],
    reverse_receipt: [
      row.reverse_receipt_id,
      (row as { id?: unknown }).id,
    ],
    payment: [row.payment_id, (row as { id?: unknown }).id],
    reverse_payment: [
      row.reverse_payment_id,
      (row as { id?: unknown }).id,
    ],
    journal_voucher: [
      row.journal_voucher_id,
      row.voucher_id,
      (row as { id?: unknown }).id,
    ],
    reverse_voucher: [
      row.reverse_voucher_id,
      row.journal_voucher_id,
      (row as { id?: unknown }).id,
    ],
  };

  const candidates = typed[type];
  if (!candidates) return null;

  for (const candidate of candidates) {
    const id = coercePositiveId(candidate);
    if (id != null) return id;
  }
  return null;
}

export function getJobFinanceReverseDocumentId(
  rev: JobFinanceReverseDocument,
  parentType?: string | null,
): number | null {
  const type = normalizeJobFinanceDocumentType(parentType);
  if (type === "supplier_invoice") {
    return (
      coercePositiveId(rev.reverse_supplier_invoice_id) ??
      coercePositiveId((rev as { id?: unknown }).id)
    );
  }
  if (type === "receipt" || type === "reverse_receipt") {
    return (
      coercePositiveId(rev.reverse_receipt_id) ??
      coercePositiveId((rev as { id?: unknown }).id)
    );
  }
  if (type === "payment" || type === "reverse_payment") {
    return (
      coercePositiveId(rev.reverse_payment_id) ??
      coercePositiveId((rev as { id?: unknown }).id)
    );
  }
  if (type === "journal_voucher" || type === "reverse_voucher") {
    return (
      coercePositiveId(rev.reverse_voucher_id) ??
      coercePositiveId((rev as { id?: unknown }).id)
    );
  }
  if (type === "invoice" || type === "reverse_invoice" || type === "") {
    return coercePositiveId(rev.reverse_invoice_id);
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
