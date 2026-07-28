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

export type VendorInvoiceFileStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "INVOICE_CREATED"
  | string;

export interface VendorInvoiceChargeRow {
  narration?: string;
  shipment_no?: string;
  hsn_sac_code?: string;
  Dr_Cr?: string;
  amount?: string;
  amount_in_local?: string;
}

export interface VendorInvoiceExtractedData {
  date?: string;
  prq_reference_no?: string;
  agent_name?: string;
  Inv_Crn_no?: string;
  Inv_crn_amount?: string;
  job_no?: string;
  charges_data?: VendorInvoiceChargeRow[];
}

export interface VendorInvoiceRecord {
  id: number;
  file_name?: string;
  status?: VendorInvoiceFileStatus;
  failer_message?: string;
  extracted_data?: VendorInvoiceExtractedData;
  supplier_invoice_id?: number;
  invoice_id?: number;
  created_invoice_id?: number;
}

interface UploadResult {
  uploaded?: Array<{ filename: string; size_kb: number; id?: number }>;
  errors?: Array<{ filename: string; error: string }>;
}

function authConfig(extra?: Record<string, string>) {
  return { headers: { ...AUTH_HEADERS(), ...extra } };
}

function parseInvoiceRecords(data: unknown): VendorInvoiceRecord[] {
  const payload = data as Record<string, unknown>;
  const rows = payload?.rows;
    // (payload?.data as Record<string, unknown> | undefined)?.rows ??
    // (Array.isArray(payload?.data) ? payload.data : null) ??
    // (Array.isArray(data) ? data : []);
  return Array.isArray(rows) ? (rows as VendorInvoiceRecord[]) : [];
}

export function getMasterShipmentNo(
  jobData?: { job_id?: string | number | null; id?: string | number | null } | null,
): string {
  return String(jobData?.job_id ?? jobData?.id ?? "").trim();
}

export function getHouseShipmentNo(house: Record<string, unknown>): string {
  return String(house.shipment_id ?? house.shipment_no ?? "").trim();
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
  return { recordId, filename: uploaded.filename ?? files[0]?.name ?? "invoice.pdf" };
}

export async function fetchVendorInvoiceRecord(
  recordId: number,
): Promise<VendorInvoiceRecord | null> {
  const { data } = await invoiceApi.get(
    VENDOR_INVOICE_AUTOMATION_URLS.list,
    authConfig(),
  );
  console.log("Fetched invoice records:", data);
  return parseInvoiceRecords(data).find((r) => r.id === recordId) ?? null;
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
): Promise<unknown> {
  const { data } = await invoiceApi.post(
    VENDOR_INVOICE_AUTOMATION_URLS.startJob,
    { record_ids: recordIds, shipment_no: shipmentNo },
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
    response?.data && typeof response.data === "object"
      ? (response.data as Record<string, unknown>)
      : null;

  return (
    pickPositiveId(
      response?.supplier_invoice_id,
      response?.invoice_id,
      response?.id,
      nested?.supplier_invoice_id,
      nested?.invoice_id,
      nested?.id,
      record?.supplier_invoice_id,
      record?.invoice_id,
      record?.created_invoice_id,
    ) ?? null
  );
}

export function isVendorInvoiceExtracted(record: VendorInvoiceRecord): boolean {
  if (record.status === "failed") {
    throw new Error(record.failer_message || "Invoice extraction failed.");
  }
  const payload = record.extracted_data ?? {};
  return (
    record.status === "done" &&
    Object.keys(payload).length > 0
  );
}

export function isVendorInvoiceCreated(record: VendorInvoiceRecord): boolean {
  if (record.status === "failed") {
    throw new Error(record.failer_message || "Invoice creation failed.");
  }
  return record.status === "INVOICE_CREATED";
}
