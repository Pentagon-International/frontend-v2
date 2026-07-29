import axios from "axios";

const invoiceApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}ai-workflow`,
});

const AUTH_HEADERS = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
});

export const VENDOR_INVOICE_AUTOMATION_URLS = {
  list: "/document-upload-list/resource",
  upload: "/upload-invoice/",
  startJob: "/start-creation-invoice/",
} as const;

/** Backend status lifecycle for vendor invoice automation records. */
export type VendorInvoiceFileStatus =
  | "PENDING"
  | "EXTRACTING"
  | "COMPLETED"
  | "FAILED"
  | "INVOICE_CREATION_IN_PROGRESS"
  | "INVOICE_CREATED"
  | "INVOICE_FAILED"
  | string;

export interface VendorInvoiceChargeRow {
  account_code?: string;
  hsn_sac_code?: string;
  subledger_code?: string;
  CRN?: string;
  narration?: string;
  shipment_no?: string;
  roe?: string;
  amount?: string;
  amount_in_local?: string;
  tax_code?: string;
  Dr_Cr?: string;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cgst_rate?: number;
  sgst_rate?: number;
  igst_rate?: number;
}

export interface VendorInvoiceExtractedData {
  date?: string;
  prq_reference_no?: string;
  agent_name?: string;
  Inv_Crn_no?: string;
  customer_gst_no?: string;
  location_gst_no?: string;
  taxable_amount?: string;
  non_taxable_amount?: string;
  cgst_amount?: string;
  sgst_amount?: string;
  igst_amount?: string;
  Inv_crn_amount?: string;
  approved_amount?: string;
  difference_amount?: string;
  due_date?: string;
  status?: string;
  Dr_Cr?: string;
  job_no?: string;
  master_bl?: string;
  charges_data?: VendorInvoiceChargeRow[];
}

export interface VendorInvoiceRecord {
  id: number;
  file_name?: string;
  file_url?: string;
  status?: VendorInvoiceFileStatus;
  failer_message?: string | null;
  extracted_data?: VendorInvoiceExtractedData;
  supplier_invoice_id?: number;
  invoice_id?: number;
  created_invoice_id?: number;
}

interface UploadResult {
  statusCode?: number;
  message?: string;
  record_id?: number;
  file_name?: string;
  file_url?: string;
  status?: string;
  /** @deprecated Prefer file_name from API */
  filename?: string;
  uploaded?: Array<{ filename: string; size_kb: number; id?: number }>;
  errors?: Array<{ filename: string; error: string }>;
}

function authConfig(extra?: Record<string, string>) {
  return { headers: { ...AUTH_HEADERS(), ...extra } };
}

function normalizeStatus(status?: string | null): string {
  return String(status ?? "").trim().toUpperCase();
}

function isRecordObject(value: unknown): value is VendorInvoiceRecord {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Number.isFinite(Number((value as VendorInvoiceRecord).id))
  );
}

/**
 * Supports resource responses:
 * - { data: { id, status, extracted_data, ... } }  (single record)
 * - { data: { rows: [...] } } | { data: [...] }
 * - { rows: [...] } | { files: [...] } | [...]
 */
function parseInvoiceRecords(data: unknown): VendorInvoiceRecord[] {
  const payload = data as Record<string, unknown> | null | undefined;
  if (!payload || typeof payload !== "object") return [];

  const nested = payload.data;

  if (isRecordObject(nested)) {
    return [nested];
  }

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedObj = nested as Record<string, unknown>;
    if (Array.isArray(nestedObj.rows)) {
      return nestedObj.rows as VendorInvoiceRecord[];
    }
    if (Array.isArray(nestedObj.files)) {
      return nestedObj.files as VendorInvoiceRecord[];
    }
  }

  if (Array.isArray(nested)) {
    return nested as VendorInvoiceRecord[];
  }

  if (Array.isArray(payload.rows)) {
    return payload.rows as VendorInvoiceRecord[];
  }
  if (Array.isArray(payload.files)) {
    return payload.files as VendorInvoiceRecord[];
  }
  if (Array.isArray(data)) {
    return data as VendorInvoiceRecord[];
  }

  return [];
}

/** Master-level start-creation payload: business Job ID (`job_id`). */
export function getMasterShipmentNo(
  jobData?: { job_id?: string | number | null; id?: string | number | null } | null,
): string {
  return String(jobData?.job_id ?? "").trim();
}

/** House-level start-creation payload: house `shipment_id`. */
export function getHouseShipmentNo(house: Record<string, unknown>): string {
  return String(house.shipment_id ?? "").trim();
}

export async function uploadVendorInvoicePdf(
  files: File[],
): Promise<{ recordId: number; filename: string }> {
  const fd = new FormData();
  files.forEach((f) => fd.append("invoice_attachments", f));
  const { data } = await invoiceApi.post<UploadResult>(
    VENDOR_INVOICE_AUTOMATION_URLS.upload,
    fd,
    authConfig({ "Content-Type": "multipart/form-data" }),
  );
  const uploaded = data;
  const recordId = uploaded?.record_id;
  if (recordId == null) {
    throw new Error("Upload succeeded but no record id was returned.");
  }
  return {
    recordId,
    filename:
      uploaded.file_name ??
      uploaded.filename ??
      files[0]?.name ??
      "invoice.pdf",
  };
}

export async function fetchVendorInvoiceRecord(
  recordId: number,
): Promise<VendorInvoiceRecord | null> {
  try {
    const { data } = await invoiceApi.get(
      `${VENDOR_INVOICE_AUTOMATION_URLS.list}/${recordId}`,
      authConfig(),
    );
    const records = parseInvoiceRecords(data);
    return records.find((r) => r.id === recordId) ?? records[0] ?? null;
  } catch (error: unknown) {
    // Make polling robust against transient "not ready yet" states.
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) {
        // "Record not found" can occur while backend is still preparing it.
        return null;
      }

      const payload = error.response?.data as
        | { message?: unknown; error?: unknown; data?: { error?: unknown } }
        | undefined;
      const backendError =
        payload?.data?.error ?? payload?.error ?? payload?.message;

      throw new Error(
        backendError != null && String(backendError).trim() !== ""
          ? String(backendError)
          : "Failed to fetch record.",
      );
    }

    throw new Error("Failed to fetch record.");
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollVendorInvoiceRecord(
  recordId: number,
  isDone: (record: VendorInvoiceRecord) => boolean,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<VendorInvoiceRecord> {
  const intervalMs = options?.intervalMs ?? 3000;
  const maxAttempts = options?.maxAttempts ?? 60;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const record = await fetchVendorInvoiceRecord(recordId);
    if (record && isDone(record)) return record;
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for invoice processing.");
}

export async function startVendorInvoiceCreation(
  recordIds: number[],
  shipmentNo: string,
  dayBookId: number,
): Promise<unknown> {
  const { data } = await invoiceApi.post(
    VENDOR_INVOICE_AUTOMATION_URLS.startJob,
    {
      record_ids: recordIds,
      shipment_no: shipmentNo,
      day_book_id: dayBookId,
    },
    authConfig(),
  );
  return data;
}

function pickPositiveId(...values: unknown[]): number | null {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

export function extractSupplierInvoiceId(
  startJobResponse: unknown,
  record?: VendorInvoiceRecord | null,
): number | null {
  const response = startJobResponse as Record<string, unknown> | null | undefined;
  const nested =
    response?.data && typeof response.data === "object" && !Array.isArray(response.data)
      ? (response.data as Record<string, unknown>)
      : null;

  // Prefer explicit invoice id fields only — avoid bare `id`, which is the
  // document-upload record id in resource/upload responses.
  return (
    pickPositiveId(
      response?.supplier_invoice_id,
      response?.invoice_id,
      response?.created_invoice_id,
      nested?.supplier_invoice_id,
      nested?.invoice_id,
      nested?.created_invoice_id,
      record?.supplier_invoice_id,
      record?.invoice_id,
      record?.created_invoice_id,
    ) ?? null
  );
}

/** Extraction finished (success or failure). Keep polling while PENDING / EXTRACTING. */
export function isVendorInvoiceExtractionSettled(
  record: VendorInvoiceRecord,
): boolean {
  const status = normalizeStatus(record.status);
  return status === "COMPLETED" || status === "DONE" || status === "FAILED";
}

export function isVendorInvoiceExtracted(record: VendorInvoiceRecord): boolean {
  const status = normalizeStatus(record.status);
  if (status === "FAILED") {
    throw new Error(record.failer_message || "Invoice extraction failed.");
  }
  const payload = record.extracted_data ?? {};
  return (
    (status === "COMPLETED" || status === "DONE") &&
    Object.keys(payload).length > 0
  );
}

/** Creation finished (success or failure). Keep polling while INVOICE_CREATION_IN_PROGRESS. */
export function isVendorInvoiceCreationSettled(
  record: VendorInvoiceRecord,
): boolean {
  const status = normalizeStatus(record.status);
  return (
    status === "INVOICE_CREATED" ||
    status === "INVOICE_FAILED" ||
    extractSupplierInvoiceId(null, record) != null
  );
}

export function isVendorInvoiceCreated(record: VendorInvoiceRecord): boolean {
  const status = normalizeStatus(record.status);
  if (status === "INVOICE_FAILED") {
    throw new Error(record.failer_message || "Invoice creation failed.");
  }
  return status === "INVOICE_CREATED";
}
