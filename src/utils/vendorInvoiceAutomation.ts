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
  charge_id?: string | number;
  charge_code?: string;
  charge_name?: string;
  currency_id?: string | number;
  currency_code?: string;
  currency_name?: string;
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
  agent_id?: string | number;
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
  type?: string;
  job_no?: string;
  master_bl?: string;
  day_book_id?: string | number;
  day_book_name?: string;
  state_id?: string | number;
  state_name?: string;
  currency_id?: string | number;
  currency_code?: string;
  currency_name?: string;
  charges_data?: VendorInvoiceChargeRow[];
}

/** Editable preview values. Display names stay on the form; ids go in the payload. */
export interface VendorInvoiceOverrideCharge {
  shipment_no: string;
  charge_id: string;
  charge_name: string;
  currency_id: string;
  currency_code: string;
  roe: string;
  amount: string;
  amount_in_local: string;
  Dr_Cr: string;
  narration: string;
  tax_code: string;
}

export interface VendorInvoiceOverrideDraft {
  day_book_id: string;
  day_book_name: string;
  state_id: string;
  state_name: string;
  currency_id: string;
  currency_code: string;
  currency_name: string;
  date: string;
  Inv_Crn_no: string;
  taxable_amount: string;
  Inv_crn_amount: string;
  status: string;
  agent_id: string;
  agent_name: string;
  Dr_Cr: string;
  charges_data: VendorInvoiceOverrideCharge[];
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
  signal?: AbortSignal,
): Promise<VendorInvoiceRecord | null> {
  try {
    const { data } = await invoiceApi.get(
      `${VENDOR_INVOICE_AUTOMATION_URLS.list}/${recordId}`,
      { ...authConfig(), signal },
    );
    const records = parseInvoiceRecords(data);
    return records.find((r) => r.id === recordId) ?? records[0] ?? null;
  } catch (error: unknown) {
    // Make polling robust against transient "not ready yet" states.
    if (isVendorInvoiceAbortError(error)) {
      throw error;
    }

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

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

export function isVendorInvoiceAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return axios.isAxiosError(error) && error.code === "ERR_CANCELED";
}

export async function pollVendorInvoiceRecord(
  recordId: number,
  isDone: (record: VendorInvoiceRecord) => boolean,
  options?: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal },
): Promise<VendorInvoiceRecord> {
  const intervalMs = options?.intervalMs ?? 3000;
  const maxAttempts = options?.maxAttempts ?? 60;
  const signal = options?.signal;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) throw abortError();
    const record = await fetchVendorInvoiceRecord(recordId, signal);
    if (record && isDone(record)) return record;
    await sleep(intervalMs, signal);
  }
  throw new Error("Timed out waiting for invoice processing.");
}

export async function startVendorInvoiceCreation(
  payload: VendorInvoiceStartPayload,
): Promise<unknown> {
  const { data } = await invoiceApi.post(
    VENDOR_INVOICE_AUTOMATION_URLS.startJob,
    payload,
    authConfig(),
  );
  return data;
}

export interface VendorInvoiceStartCharge {
  shipment_no: string;
  charge_id: number;
  charge_name: string;
  currency_id: number;
  roe: string;
  amount: string;
  amount_in_local: string;
  Dr_Cr: string;
  narration: string;
  tax_code: string;
}

export interface VendorInvoiceStartPayload {
  record_ids: number[];
  shipment_no: string;
  day_book_id: number;
  state_id: number | null;
  currency_id: number;
  date: string;
  Inv_Crn_no: string;
  taxable_amount: string;
  Inv_crn_amount: string;
  status: string;
  agent_id: number;
  agent_name: string;
  Dr_Cr: string;
  charges_data: VendorInvoiceStartCharge[];
}

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function toIsoDateString(value: unknown): string {
  const raw = textValue(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function toAmountString(value: unknown, fallback = ""): string {
  const raw = textValue(value);
  if (!raw) return fallback;
  const num = Number(raw.replace(/,/g, ""));
  return Number.isFinite(num) ? num.toFixed(2) : raw;
}

export function normalizeVendorInvoiceDrCr(value: unknown): string {
  const raw = textValue(value).toUpperCase();
  if (raw === "DR" || raw === "D" || raw === "DEBIT") return "DR";
  if (raw === "CR" || raw === "C" || raw === "CREDIT") return "CR";
  return "";
}

function idString(value: unknown): string {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? String(num) : "";
}

function emptyOverrideCharge(
  shipmentNo: string,
  headerDrCr: string,
): VendorInvoiceOverrideCharge {
  return {
    shipment_no: shipmentNo,
    charge_id: "",
    charge_name: "",
    currency_id: "",
    currency_code: "",
    roe: "1.00",
    amount: "",
    amount_in_local: "",
    Dr_Cr: headerDrCr,
    narration: "",
    tax_code: "",
  };
}

export function buildVendorInvoiceOverrideDraft(
  extracted: VendorInvoiceExtractedData | null | undefined,
  shipmentNo: string,
): VendorInvoiceOverrideDraft {
  const headerShipment = shipmentNo.trim();
  const headerDrCr = normalizeVendorInvoiceDrCr(extracted?.Dr_Cr);
  const sourceCharges = Array.isArray(extracted?.charges_data)
    ? extracted.charges_data
    : [];
  const charges =
    sourceCharges.length > 0
      ? sourceCharges.map((row) => ({
          shipment_no: textValue(row.shipment_no) || headerShipment,
          charge_id: idString(row.charge_id),
          charge_name: textValue(row.charge_name),
          currency_id: idString(row.currency_id) || idString(extracted?.currency_id),
          currency_code:
            textValue(row.currency_code) || textValue(extracted?.currency_code),
          roe: toAmountString(row.roe, "1.00"),
          amount: toAmountString(row.amount),
          amount_in_local: toAmountString(row.amount_in_local),
          Dr_Cr: normalizeVendorInvoiceDrCr(row.Dr_Cr) || headerDrCr,
          narration: textValue(row.narration) || textValue(row.charge_name),
          tax_code: textValue(row.tax_code) || textValue(row.hsn_sac_code),
        }))
      : [emptyOverrideCharge(headerShipment, headerDrCr)];

  return {
    day_book_id: idString(extracted?.day_book_id),
    day_book_name: textValue(extracted?.day_book_name),
    state_id: idString(extracted?.state_id),
    state_name: textValue(extracted?.state_name),
    currency_id: idString(extracted?.currency_id),
    currency_code: textValue(extracted?.currency_code),
    currency_name: textValue(extracted?.currency_name),
    date: toIsoDateString(extracted?.date),
    Inv_Crn_no: textValue(extracted?.Inv_Crn_no),
    taxable_amount: toAmountString(extracted?.taxable_amount),
    Inv_crn_amount: toAmountString(extracted?.Inv_crn_amount),
    status: textValue(extracted?.status) || "UNPOSTED",
    agent_id: idString(extracted?.agent_id),
    agent_name: textValue(extracted?.agent_name),
    Dr_Cr: headerDrCr,
    charges_data: charges,
  };
}

export function isOverseasCrjDaybook(dayBookName?: string | null): boolean {
  return textValue(dayBookName).toUpperCase().includes("OVERSEAS");
}

export function isVendorInvoiceAlreadyCreated(status?: string | null): boolean {
  return normalizeStatus(status) === "INVOICE_CREATED";
}

function hasPositiveId(value: string): boolean {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

/** True only when every start-creation override field is present. */
export function isVendorInvoiceOverrideReady(
  shipmentNo: string,
  draft: VendorInvoiceOverrideDraft | null | undefined,
): boolean {
  if (!draft) return false;
  const shipment = shipmentNo.trim();
  if (!shipment) return false;
  if (!hasPositiveId(draft.day_book_id)) return false;
  if (!isOverseasCrjDaybook(draft.day_book_name) && !hasPositiveId(draft.state_id)) {
    return false;
  }
  if (!hasPositiveId(draft.currency_id)) return false;
  if (!toIsoDateString(draft.date)) return false;
  if (!textValue(draft.Inv_Crn_no)) return false;
  if (!textValue(draft.taxable_amount)) return false;
  if (!textValue(draft.Inv_crn_amount)) return false;
  if (!textValue(draft.status)) return false;
  if (!hasPositiveId(draft.agent_id) || !textValue(draft.agent_name)) return false;
  if (!normalizeVendorInvoiceDrCr(draft.Dr_Cr)) return false;
  if (!draft.charges_data.length) return false;

  return draft.charges_data.every((row) => {
    const lineShipment = textValue(row.shipment_no) || shipment;
    return (
      !!lineShipment &&
      hasPositiveId(row.charge_id) &&
      !!textValue(row.charge_name) &&
      hasPositiveId(row.currency_id) &&
      !!textValue(row.roe) &&
      !!textValue(row.amount) &&
      !!textValue(row.amount_in_local) &&
      !!normalizeVendorInvoiceDrCr(row.Dr_Cr) &&
      !!textValue(row.narration) &&
      !!textValue(row.tax_code)
    );
  });
}

function positiveId(value: string, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${label} is required.`);
  }
  return num;
}

export function buildVendorInvoiceStartPayload(
  recordId: number,
  shipmentNo: string,
  draft: VendorInvoiceOverrideDraft,
): VendorInvoiceStartPayload {
  const shipment = shipmentNo.trim();
  if (!shipment) throw new Error("Shipment number is required.");

  const date = toIsoDateString(draft.date);
  if (!date) throw new Error("Date is required.");
  if (!textValue(draft.Inv_Crn_no)) throw new Error("Inv / CRN No. is required.");
  if (!textValue(draft.taxable_amount)) throw new Error("Taxable amount is required.");
  if (!textValue(draft.Inv_crn_amount)) throw new Error("Inv / CRN amount is required.");
  if (!textValue(draft.status)) throw new Error("Status is required.");
  if (!textValue(draft.agent_name)) throw new Error("Agent is required.");
  const headerDrCr = normalizeVendorInvoiceDrCr(draft.Dr_Cr);
  if (!headerDrCr) throw new Error("Dr/Cr is required.");
  if (!draft.charges_data.length) throw new Error("At least one charge line is required.");

  return {
    record_ids: [recordId],
    shipment_no: shipment,
    day_book_id: positiveId(draft.day_book_id, "Day book"),
    state_id: isOverseasCrjDaybook(draft.day_book_name)
      ? hasPositiveId(draft.state_id)
        ? positiveId(draft.state_id, "State")
        : null
      : positiveId(draft.state_id, "State"),
    currency_id: positiveId(draft.currency_id, "Currency"),
    date,
    Inv_Crn_no: textValue(draft.Inv_Crn_no),
    taxable_amount: toAmountString(draft.taxable_amount),
    Inv_crn_amount: toAmountString(draft.Inv_crn_amount),
    status: textValue(draft.status),
    agent_id: positiveId(draft.agent_id, "Agent"),
    agent_name: textValue(draft.agent_name),
    Dr_Cr: headerDrCr,
    charges_data: draft.charges_data.map((row, index) => {
      const line = index + 1;
      const lineShipment = textValue(row.shipment_no) || shipment;
      const lineDrCr = normalizeVendorInvoiceDrCr(row.Dr_Cr);
      if (!lineShipment) throw new Error(`Charge line ${line}: shipment no. is required.`);
      if (!textValue(row.narration)) throw new Error(`Charge line ${line}: narration is required.`);
      if (!textValue(row.tax_code)) throw new Error(`Charge line ${line}: tax code is required.`);
      if (!textValue(row.amount)) throw new Error(`Charge line ${line}: amount is required.`);
      if (!textValue(row.amount_in_local)) {
        throw new Error(`Charge line ${line}: local amount is required.`);
      }
      if (!lineDrCr) throw new Error(`Charge line ${line}: Dr/Cr is required.`);
      return {
        shipment_no: lineShipment,
        charge_id: positiveId(row.charge_id, `Charge line ${line}: charge`),
        charge_name: textValue(row.charge_name),
        currency_id: positiveId(row.currency_id, `Charge line ${line}: currency`),
        roe: toAmountString(row.roe, "1.00"),
        amount: toAmountString(row.amount),
        amount_in_local: toAmountString(row.amount_in_local),
        Dr_Cr: lineDrCr,
        narration: textValue(row.narration),
        tax_code: textValue(row.tax_code),
      };
    }),
  };
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
