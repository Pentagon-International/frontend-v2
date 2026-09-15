import axios from "axios";
import { getMasterShipmentNo, getHouseShipmentNo } from "./vendorInvoiceAutomation";

const workflowApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}ai-workflow`,
});

const AUTH_HEADERS = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
});

export const PAYMENT_REQUEST_AUTOMATION_URLS = {
  list: "/document-upload-list/resource",
  upload: "/upload-payment-request/",
  startJob: "/start-creation-payment-request/",
} as const;

export const PAYMENT_REQUEST_DOCUMENT_TYPE = "PAYMENT_REQUEST";

export { getMasterShipmentNo, getHouseShipmentNo };

export const PAYMENT_TYPE_OPTIONS = [
  { value: "Bank", label: "Bank" },
  { value: "CASH", label: "Cash" },
  { value: "PDC", label: "Pdc" },
  { value: "ONLINE TRANSFER", label: "Online Transfer" },
  { value: "DD/PO", label: "Dd/Po" },
  { value: "TT", label: "Tt" },
];

export const VOUCHER_TYPE_OPTIONS = [
  { value: "SEA EXPORTS", label: "Sea Exports" },
  { value: "SEA IMPORTS", label: "Sea Imports" },
  { value: "CFS", label: "CFS" },
  { value: "BROKERAGE", label: "Brokerage" },
  { value: "AIR EXPORTS", label: "Air Exports" },
  { value: "AIR IMPORTS", label: "Air Imports" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "COASTAL", label: "Coastal" },
];

export const PAID_TO_TYPE_OPTIONS = [
  { value: "supplier", label: "Supplier" },
  { value: "agent", label: "Agent" },
];

export interface PaymentRequestChargeDraft {
  job_id: string;
  charge_id: string;
  charge_name: string;
  charge_code: string;
  account_id: string;
  account_code: string;
  account_name: string;
  subledger_code: string;
  currency_id: string;
  currency_code: string;
  currency_name: string;
  roe: string;
  unit_id: string;
  unit_code: string;
  no_of_unit: string;
  amount_per_unit: string;
  amount: string;
  local_amount: string;
  sac_code: string;
  narration: string;
  cn_r: string;
  Dr_Cr: string;
  /** Matches PRQ Calculate GST tax rows (FE + create payload Dr_Cr). */
  is_tax_row?: boolean;
  line_type?: string;
}

export interface PaymentRequestOverrideDraft {
  job_reference: string;
  date: string;
  payment_type: string;
  vouchar_type: string;
  paid_to_type: string;
  paid_to: string;
  account_id: string;
  account_code: string;
  currency_id: string;
  currency_code: string;
  currency_name: string;
  state_id: string;
  state_name: string;
  amount: string;
  taxable_amount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  customer_gst_no: string;
  location_gst_no: string;
  actual_inv_no: string;
  actual_inv_date: string;
  proforma_inv_no: string;
  proforma_inv_date: string;
  note: string;
  account_note: string;
  tds_section_code: string;
  charges_data: PaymentRequestChargeDraft[];
}

export interface PaymentRequestExtractedData extends Partial<PaymentRequestOverrideDraft> {
  enrichment_error?: string;
}

export interface PaymentRequestAutomationRecord {
  id: number;
  type?: string;
  file_name?: string;
  file_url?: string;
  status?: string;
  failer_message?: string | null;
  extracted_data?: PaymentRequestExtractedData;
  payment_request_id?: number;
  created_payment_request_id?: number;
}

function authConfig(extra?: Record<string, string>) {
  return { headers: { ...AUTH_HEADERS(), ...extra } };
}

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function idString(value: unknown): string {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? String(num) : "";
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

/** Cap free-text notes to a max word count (PRQ automation). */
export function limitToMaxWords(value: unknown, maxWords = 20): string {
  const text = textValue(value);
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

export function normalizePaymentType(value: unknown): string {
  const raw = textValue(value);
  if (!raw) return "";
  const match = PAYMENT_TYPE_OPTIONS.find(
    (option) =>
      option.value.toLowerCase() === raw.toLowerCase() ||
      option.label.toLowerCase() === raw.toLowerCase(),
  );
  return match?.value ?? raw;
}

export function normalizeVoucherType(value: unknown): string {
  const raw = textValue(value).toUpperCase();
  if (!raw) return "";
  const match = VOUCHER_TYPE_OPTIONS.find((option) => option.value === raw);
  return match?.value ?? raw;
}

function isRecordObject(value: unknown): value is PaymentRequestAutomationRecord {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Number.isFinite(Number((value as PaymentRequestAutomationRecord).id))
  );
}

function parseRecords(data: unknown): PaymentRequestAutomationRecord[] {
  const payload = data as Record<string, unknown> | null | undefined;
  if (!payload || typeof payload !== "object") return [];
  const nested = payload.data;
  if (isRecordObject(nested)) return [nested];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedObj = nested as Record<string, unknown>;
    if (Array.isArray(nestedObj.rows)) return nestedObj.rows as PaymentRequestAutomationRecord[];
  }
  if (Array.isArray(nested)) return nested as PaymentRequestAutomationRecord[];
  if (Array.isArray(payload.rows)) return payload.rows as PaymentRequestAutomationRecord[];
  if (Array.isArray(data)) return data as PaymentRequestAutomationRecord[];
  return [];
}

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

export function isPaymentRequestAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return axios.isAxiosError(error) && error.code === "ERR_CANCELED";
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

export async function uploadPaymentRequestPdf(
  files: File[],
  shipmentNo?: string,
  voucherType?: string,
): Promise<{ recordId: number; filename: string }> {
  const fd = new FormData();
  files.forEach((file) => fd.append("invoice_attachments", file));
  const shipment = String(shipmentNo ?? "").trim();
  if (shipment) fd.append("shipment_no", shipment);
  const voucher = String(voucherType ?? "").trim();
  if (voucher) fd.append("voucher_type", voucher);
  const { data } = await workflowApi.post(
    PAYMENT_REQUEST_AUTOMATION_URLS.upload,
    fd,
    authConfig({ "Content-Type": "multipart/form-data" }),
  );
  const recordId = data?.record_id;
  if (recordId == null) {
    throw new Error("Upload succeeded but no document id was returned.");
  }
  return {
    recordId,
    filename: data.file_name ?? data.filename ?? files[0]?.name ?? "payment-request.pdf",
  };
}

export async function fetchPaymentRequestRecord(
  recordId: number,
  signal?: AbortSignal,
): Promise<PaymentRequestAutomationRecord | null> {
  try {
    const { data } = await workflowApi.get(
      `${PAYMENT_REQUEST_AUTOMATION_URLS.list}/${recordId}`,
      { ...authConfig(), signal },
    );
    const records = parseRecords(data);
    return records.find((row) => rId(row) === recordId) ?? records[0] ?? null;
  } catch (error: unknown) {
    if (isPaymentRequestAbortError(error)) throw error;
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw new Error(readableError(error, "Could not load the extracted payment request."));
  }
}

function rId(row: PaymentRequestAutomationRecord): number {
  return Number(row.id);
}

export async function pollPaymentRequestRecord(
  recordId: number,
  isDone: (record: PaymentRequestAutomationRecord) => boolean,
  options?: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal },
): Promise<PaymentRequestAutomationRecord> {
  const intervalMs = options?.intervalMs ?? 3000;
  const maxAttempts = options?.maxAttempts ?? 60;
  const signal = options?.signal;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) throw abortError();
    const record = await fetchPaymentRequestRecord(recordId, signal);
    if (record && isDone(record)) return record;
    await sleep(intervalMs, signal);
  }
  throw new Error("Timed out waiting for payment request processing. Please try again.");
}

export function isPaymentRequestExtractionSettled(record: PaymentRequestAutomationRecord): boolean {
  const status = textValue(record.status).toUpperCase();
  return status === "COMPLETED" || status === "DONE" || status === "FAILED";
}

export function isPaymentRequestExtracted(record: PaymentRequestAutomationRecord): boolean {
  const status = textValue(record.status).toUpperCase();
  if (status === "FAILED") {
    throw new Error(record.failer_message || "Could not read this payment request. Please check the file and try again.");
  }
  return (status === "COMPLETED" || status === "DONE") && Object.keys(record.extracted_data ?? {}).length > 0;
}

export function isPaymentRequestCreationSettled(record: PaymentRequestAutomationRecord): boolean {
  const status = textValue(record.status).toUpperCase();
  return status === "PRQ_CREATED" || status === "PRQ_FAILED" || extractPaymentRequestId(null, record) != null;
}

export function isPaymentRequestCreated(record: PaymentRequestAutomationRecord): boolean {
  const status = textValue(record.status).toUpperCase();
  if (status === "PRQ_FAILED") {
    throw new Error(record.failer_message || "Payment request creation failed. Please check the details and try again.");
  }
  return status === "PRQ_CREATED";
}

function emptyCharge(jobId: string): PaymentRequestChargeDraft {
  return {
    job_id: jobId,
    charge_id: "",
    charge_name: "",
    charge_code: "",
    account_id: "",
    account_code: "",
    account_name: "",
    subledger_code: "",
    currency_id: "",
    currency_code: "",
    currency_name: "",
    roe: "1.00",
    unit_id: "",
    unit_code: "",
    no_of_unit: "",
    amount_per_unit: "",
    amount: "",
    local_amount: "",
    sac_code: "",
    narration: "",
    cn_r: "",
    Dr_Cr: "Dr",
  };
}

/** Prefer printed amounts. Only derive amount from qty×rate when amount is missing. */
export function recalculateAutomationChargeAmounts(
  row: {
    no_of_unit?: string;
    amount_per_unit?: string;
    amount?: string;
    local_amount?: string;
    roe?: string;
  },
  options?: { forceFromQtyRate?: boolean },
): Pick<PaymentRequestChargeDraft, "amount" | "local_amount"> {
  const qty = Number(String(row.no_of_unit ?? "").replace(/,/g, ""));
  const rate = Number(String(row.amount_per_unit ?? "").replace(/,/g, ""));
  const roe = Number(String(row.roe ?? "1").replace(/,/g, ""));
  let amount = toAmountString(row.amount);
  const canDerive =
    Number.isFinite(qty) && Number.isFinite(rate) && qty > 0 && rate > 0;
  if (canDerive && (options?.forceFromQtyRate || !amount || amount === "0.00")) {
    amount = (qty * rate).toFixed(2);
  }
  let local = toAmountString(row.local_amount || amount);
  if (amount && Number.isFinite(roe) && roe > 0 && (!local || local === "0.00" || options?.forceFromQtyRate)) {
    local = (Number(amount) * roe).toFixed(2);
  } else if (amount && Number.isFinite(roe) && roe > 0 && !toAmountString(row.local_amount)) {
    local = (Number(amount) * roe).toFixed(2);
  }
  return { amount, local_amount: local || amount };
}

function isNonServiceChargeDraftRow(row: {
  narration?: string;
  charge_name?: string;
  line_type?: string;
  is_tax_row?: boolean;
}): boolean {
  if (row.is_tax_row === true) return true;
  const lineType = textValue(row.line_type).toLowerCase();
  if (lineType === "tax" || lineType === "gst" || lineType === "total" || lineType === "footer") {
    return true;
  }
  const narr = textValue(row.narration || row.charge_name);
  if (!narr) return false;
  return /^(c\s*gst|s\s*gst|i\s*gst|cgst|sgst|igst|gst(\s*amount)?)\b/i.test(narr)
    || /^((grand|net)\s*)?(sub\s*)?total|round\s*off|net\s*payable|amount\s*payable\b/i.test(narr);
}

function isTaxChargeDraft(row: {
  is_tax_row?: boolean;
  line_type?: string;
  narration?: string;
  charge_name?: string;
}): boolean {
  if (row.is_tax_row === true) return true;
  const lineType = textValue(row.line_type).toLowerCase();
  if (lineType === "tax" || lineType === "gst") return true;
  const narr = textValue(row.narration || row.charge_name);
  return /^(c\s*gst|s\s*gst|i\s*gst|cgst|sgst|igst)\b/i.test(narr);
}

/** True when a charge draft is a GST/tax line (PRQ Calculate GST shape). */
export function isPaymentRequestTaxChargeDraft(row: {
  is_tax_row?: boolean;
  line_type?: string;
  narration?: string;
  charge_name?: string;
}): boolean {
  return isTaxChargeDraft(row);
}

/** Build CGST/SGST/IGST charge lines in Payment Request Calculate-GST shape. */
export function buildPrqGstChargeDrafts(args: {
  jobId: string;
  paidTo?: string;
  taxableAmount?: string;
  cgstAmount?: string;
  sgstAmount?: string;
  igstAmount?: string;
  currencyId?: string;
  currencyCode?: string;
  currencyName?: string;
  existing?: PaymentRequestChargeDraft[];
}): PaymentRequestChargeDraft[] {
  const existing = Array.isArray(args.existing) ? args.existing : [];
  const hasTaxLabel = (label: string) =>
    existing.some((row) => {
      if (!isTaxChargeDraft(row)) return false;
      const name = textValue(row.charge_name || row.narration).toUpperCase();
      return name.includes(label.toUpperCase());
    });

  const taxable = toAmountString(args.taxableAmount);
  const paidTo = textValue(args.paidTo);
  const out: PaymentRequestChargeDraft[] = [];
  for (const [label, amountRaw] of [
    ["CGST", args.cgstAmount],
    ["SGST", args.sgstAmount],
    ["IGST", args.igstAmount],
  ] as const) {
    const amount = toAmountString(amountRaw);
    if (!amount || Number(amount) <= 0) continue;
    if (hasTaxLabel(label)) continue;
    const taxablePart = taxable || amount;
    // Matches calculate-gst-breakup narration: "{party} -- {charge} -- {taxable}"
    const narration = `${paidTo || label} -- ${label} -- ${taxablePart}`;
    out.push({
      ...emptyCharge(args.jobId),
      charge_name: label,
      charge_code: "",
      currency_id: textValue(args.currencyId),
      currency_code: textValue(args.currencyCode) || "INR",
      currency_name: textValue(args.currencyName),
      roe: "1.00",
      amount,
      local_amount: amount,
      narration,
      cn_r: "Dr",
      Dr_Cr: "Dr",
      is_tax_row: true,
      line_type: "tax",
    });
  }
  return out;
}

export function buildPaymentRequestOverrideDraft(
  extracted: PaymentRequestExtractedData | null | undefined,
  shipmentNo: string,
  voucherType?: string,
): PaymentRequestOverrideDraft {
  const jobId = shipmentNo.trim();
  const sourceCharges = Array.isArray(extracted?.charges_data) ? extracted.charges_data : [];
  const headerCurrencyId = idString(extracted?.currency_id);
  const headerCurrencyCode = textValue(extracted?.currency_code);
  const paidTo = textValue(extracted?.paid_to);

  const mapServiceRow = (row: PaymentRequestChargeDraft | Record<string, unknown>): PaymentRequestChargeDraft => {
    const chargeId = idString(row.charge_id);
    const resolvedName = chargeId ? textValue(row.charge_name) : "";
    const base: PaymentRequestChargeDraft = {
      job_id: jobId || textValue(row.job_id),
      charge_id: chargeId,
      // Unresolved charge master → empty so user picks charge + id in UI.
      charge_name: resolvedName,
      charge_code: chargeId ? textValue(row.charge_code) : "",
      account_id: idString(row.account_id),
      account_code: textValue(row.account_code),
      account_name: textValue(row.account_name),
      subledger_code: textValue(row.subledger_code),
      currency_id: idString(row.currency_id) || headerCurrencyId,
      currency_code: textValue(row.currency_code) || headerCurrencyCode,
      currency_name: textValue(row.currency_name) || textValue(extracted?.currency_name),
      roe: toAmountString(row.roe, "1.00"),
      unit_id: idString(row.unit_id),
      unit_code: textValue(row.unit_code),
      no_of_unit: textValue(row.no_of_unit),
      amount_per_unit: toAmountString(row.amount_per_unit),
      amount: toAmountString(row.amount),
      local_amount: toAmountString(row.local_amount || row.amount),
      sac_code: textValue(row.sac_code),
      narration: textValue(row.narration) || resolvedName,
      cn_r: textValue(row.cn_r),
      Dr_Cr: "Dr",
    };
    const recalc = recalculateAutomationChargeAmounts(base);
    return { ...base, ...recalc };
  };

  const mapTaxRow = (row: PaymentRequestChargeDraft | Record<string, unknown>): PaymentRequestChargeDraft => {
    const chargeId = idString(row.charge_id);
    const chargeName = textValue(row.charge_name) || textValue(row.narration) || "GST";
    const amount = toAmountString(row.amount);
    const drCr = textValue(row.Dr_Cr) || textValue(row.cn_r) || "Dr";
    return {
      job_id: jobId || textValue(row.job_id),
      charge_id: chargeId,
      charge_name: chargeName,
      charge_code: textValue(row.charge_code),
      account_id: idString(row.account_id),
      account_code: textValue(row.account_code),
      account_name: textValue(row.account_name),
      subledger_code: textValue(row.subledger_code),
      currency_id: idString(row.currency_id) || headerCurrencyId,
      currency_code: textValue(row.currency_code) || headerCurrencyCode || "INR",
      currency_name: textValue(row.currency_name) || textValue(extracted?.currency_name),
      roe: toAmountString(row.roe, "1.00") || "1.00",
      unit_id: "",
      unit_code: "",
      no_of_unit: "",
      amount_per_unit: "",
      amount,
      local_amount: toAmountString(row.local_amount || row.amount) || amount,
      sac_code: textValue(row.sac_code),
      narration: textValue(row.narration) || `${paidTo || chargeName} -- ${chargeName} -- ${toAmountString(extracted?.taxable_amount) || amount}`,
      cn_r: textValue(row.cn_r) || drCr,
      Dr_Cr: drCr,
      is_tax_row: true,
      line_type: "tax",
    };
  };

  const taxFromExtract = sourceCharges
    .filter((row) => isTaxChargeDraft(row as PaymentRequestChargeDraft))
    .map((row) => mapTaxRow(row as PaymentRequestChargeDraft));

  const serviceCharges = sourceCharges.filter(
    (row) => !isNonServiceChargeDraftRow(row as PaymentRequestChargeDraft),
  );
  const serviceMapped =
    serviceCharges.length > 0
      ? serviceCharges.map((row) => mapServiceRow(row as PaymentRequestChargeDraft))
      : [emptyCharge(jobId)];

  const gstFromTotals = buildPrqGstChargeDrafts({
    jobId,
    paidTo,
    taxableAmount: toAmountString(extracted?.taxable_amount),
    cgstAmount: toAmountString(extracted?.cgst_amount),
    sgstAmount: toAmountString(extracted?.sgst_amount),
    igstAmount: toAmountString(extracted?.igst_amount),
    currencyId: headerCurrencyId,
    currencyCode: headerCurrencyCode || "INR",
    currencyName: textValue(extracted?.currency_name),
    existing: taxFromExtract,
  });

  return {
    job_reference: jobId || textValue(extracted?.job_reference),
    date: toIsoDateString(extracted?.date),
    payment_type: normalizePaymentType(extracted?.payment_type),
    vouchar_type: normalizeVoucherType(voucherType || extracted?.vouchar_type),
    paid_to_type: textValue(extracted?.paid_to_type).toLowerCase() || "supplier",
    paid_to: paidTo,
    account_id: idString(extracted?.account_id),
    account_code: textValue(extracted?.account_code),
    currency_id: headerCurrencyId,
    currency_code: headerCurrencyCode,
    currency_name: textValue(extracted?.currency_name),
    state_id: idString(extracted?.state_id),
    state_name: textValue(extracted?.state_name),
    amount: toAmountString(extracted?.amount),
    taxable_amount: toAmountString(extracted?.taxable_amount),
    cgst_amount: toAmountString(extracted?.cgst_amount),
    sgst_amount: toAmountString(extracted?.sgst_amount),
    igst_amount: toAmountString(extracted?.igst_amount),
    customer_gst_no: textValue(extracted?.customer_gst_no),
    location_gst_no: textValue(extracted?.location_gst_no),
    actual_inv_no: textValue(extracted?.actual_inv_no),
    actual_inv_date: toIsoDateString(extracted?.actual_inv_date),
    proforma_inv_no: textValue(extracted?.proforma_inv_no),
    proforma_inv_date: toIsoDateString(extracted?.proforma_inv_date),
    note: limitToMaxWords(extracted?.note, 20),
    account_note: limitToMaxWords(extracted?.account_note, 20),
    tds_section_code: textValue(extracted?.tds_section_code),
    charges_data: [...serviceMapped, ...taxFromExtract, ...gstFromTotals],
  };
}

function hasPositiveId(value: string): boolean {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

export function isPaymentRequestOverrideReady(
  shipmentNo: string,
  draft: PaymentRequestOverrideDraft | null | undefined,
  options?: { requireGst?: boolean },
): boolean {
  return !hasPaymentRequestOverrideFieldErrors(
    getPaymentRequestOverrideFieldErrors(shipmentNo, draft, options),
  );
}

export type PaymentRequestFieldErrors = {
  header: Partial<Record<string, string>>;
  charges: Array<Partial<Record<string, string>>>;
};

/** Same required rules as create payload / ready check — for click-time field borders. */
export function getPaymentRequestOverrideFieldErrors(
  shipmentNo: string,
  draft: PaymentRequestOverrideDraft | null | undefined,
  options?: { requireGst?: boolean },
): PaymentRequestFieldErrors {
  const header: PaymentRequestFieldErrors["header"] = {};
  const charges: PaymentRequestFieldErrors["charges"] = [];
  if (!draft) {
    header.job_reference = "Shipment number is required";
    return { header, charges };
  }
  if (!textValue(shipmentNo) && !textValue(draft.job_reference)) {
    header.job_reference = "Shipment number is required";
  }
  if (!toIsoDateString(draft.date)) header.date = "Date is required";
  if (!normalizePaymentType(draft.payment_type)) {
    header.payment_type = "Payment Type is required";
  }
  if (!normalizeVoucherType(draft.vouchar_type)) {
    header.vouchar_type = "Voucher Type is required";
  }
  if (!textValue(draft.paid_to)) header.paid_to = "Paid To is required";
  if (!hasPositiveId(draft.account_id)) header.account_id = "Party is required";
  if (!hasPositiveId(draft.currency_id)) header.currency_id = "Currency is required";
  if (!textValue(draft.amount)) header.amount = "Amount is required";
  if (options?.requireGst) {
    if (!textValue(draft.customer_gst_no)) {
      header.customer_gst_no = "Vendor GSTN is required";
    }
    if (!textValue(draft.location_gst_no)) {
      header.location_gst_no = "Location GSTN is required";
    }
  }
  if (!draft.charges_data.length) {
    header.charges_data = "At least one charge line is required";
  } else {
    draft.charges_data.forEach((row, index) => {
      const rowErrors: Partial<Record<string, string>> = {};
      if (!textValue(row.job_id || shipmentNo)) {
        rowErrors.job_id = "Job Id is required";
      }
      if (!hasPositiveId(row.charge_id)) rowErrors.charge_id = "Charge is required";
      if (!hasPositiveId(row.currency_id)) rowErrors.currency_id = "Currency is required";
      if (!textValue(row.amount)) rowErrors.amount = "Amount is required";
      if (!textValue(row.local_amount)) rowErrors.local_amount = "Local amount is required";
      charges[index] = rowErrors;
    });
  }
  return { header, charges };
}

export function hasPaymentRequestOverrideFieldErrors(
  errors: PaymentRequestFieldErrors,
): boolean {
  if (Object.keys(errors.header).length > 0) return true;
  return errors.charges.some((row) => Object.keys(row).length > 0);
}

function positiveId(value: string, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error(`${label} is required.`);
  return num;
}

export function buildPaymentRequestStartPayload(
  recordId: number,
  shipmentNo: string,
  draft: PaymentRequestOverrideDraft,
  options?: { requireGst?: boolean },
) {
  const shipment = textValue(draft.job_reference) || shipmentNo.trim();
  if (!shipment) throw new Error("Shipment number is required.");
  const date = toIsoDateString(draft.date);
  if (!date) throw new Error("Date is required.");
  const paymentType = normalizePaymentType(draft.payment_type);
  if (!paymentType) throw new Error("Payment type is required.");
  const voucherType = normalizeVoucherType(draft.vouchar_type);
  if (!voucherType) throw new Error("Voucher type is required.");
  if (!textValue(draft.paid_to)) throw new Error("Paid to is required.");
  if (!textValue(draft.amount)) throw new Error("Amount is required.");
  if (options?.requireGst) {
    if (!textValue(draft.customer_gst_no)) throw new Error("Vendor GSTN is required.");
    if (!textValue(draft.location_gst_no)) throw new Error("Location GSTN is required.");
  }
  if (!draft.charges_data.length) throw new Error("At least one charge line is required.");

  return {
    record_ids: [recordId],
    shipment_no: shipment,
    job_reference: shipment,
    date,
    payment_type: paymentType,
    vouchar_type: voucherType,
    paid_to_type: textValue(draft.paid_to_type) || "supplier",
    paid_to: textValue(draft.paid_to),
    account_id: positiveId(draft.account_id, "Party"),
    ...(textValue(draft.account_code) ? { account_code: textValue(draft.account_code) } : {}),
    currency_id: positiveId(draft.currency_id, "Currency"),
    state_id: hasPositiveId(draft.state_id) ? positiveId(draft.state_id, "State") : null,
    amount: toAmountString(draft.amount),
    customer_gst_no: textValue(draft.customer_gst_no),
    location_gst_no: textValue(draft.location_gst_no),
    actual_inv_no: textValue(draft.actual_inv_no),
    actual_inv_date: toIsoDateString(draft.actual_inv_date) || null,
    proforma_inv_no: textValue(draft.proforma_inv_no),
    proforma_inv_date: toIsoDateString(draft.proforma_inv_date) || null,
    note: limitToMaxWords(draft.note, 20),
    account_note: limitToMaxWords(draft.account_note, 20),
    tds_section_code: textValue(draft.tds_section_code),
    status: "Active",
    CINV: false,
    charges_data: draft.charges_data.map((row, index) => {
      const line = index + 1;
      const jobId = textValue(row.job_id) || shipment;
      if (!textValue(row.amount)) throw new Error(`Charge line ${line}: amount is required.`);
      if (!textValue(row.local_amount)) throw new Error(`Charge line ${line}: local amount is required.`);
      const isTax = isTaxChargeDraft(row);
      // Tax rows: keep printed GST amounts (same as PRQ mapPaymentRequestChargeToPayload).
      const amounts = isTax
        ? {
            amount: toAmountString(row.amount),
            local_amount: toAmountString(row.local_amount || row.amount),
          }
        : (() => {
            const recalc = recalculateAutomationChargeAmounts(row);
            return {
              amount: toAmountString(recalc.amount || row.amount),
              local_amount: toAmountString(recalc.local_amount || row.local_amount),
            };
          })();
      const drCr = isTax ? textValue(row.Dr_Cr) || textValue(row.cn_r) || "Dr" : "Dr";
      const cnR = textValue(row.cn_r) || (isTax ? drCr : "");
      return {
        job_id: jobId,
        charge_id: positiveId(row.charge_id, `Charge line ${line}: charge`),
        charge_name: textValue(row.charge_name),
        ...(hasPositiveId(row.account_id) ? { account_id: Number(row.account_id) } : {}),
        ...(textValue(row.account_code) ? { account_code: textValue(row.account_code) } : {}),
        ...(textValue(row.account_name) ? { account_name: textValue(row.account_name) } : {}),
        ...(textValue(row.subledger_code) ? { subledger_code: textValue(row.subledger_code) } : {}),
        ...(cnR ? { cn_r: cnR } : {}),
        currency_id: positiveId(row.currency_id, `Charge line ${line}: currency`),
        roe: toAmountString(row.roe, "1.00"),
        ...(!isTax && hasPositiveId(row.unit_id) ? { unit_id: Number(row.unit_id) } : {}),
        ...(!isTax && textValue(row.no_of_unit) ? { no_of_unit: textValue(row.no_of_unit) } : {}),
        ...(!isTax && textValue(row.amount_per_unit)
          ? { amount_per_unit: toAmountString(row.amount_per_unit) }
          : {}),
        amount: amounts.amount,
        local_amount: amounts.local_amount,
        sac_code: textValue(row.sac_code),
        narration: textValue(row.narration) || textValue(row.charge_name),
        Dr_Cr: drCr,
      };
    }),
  };
}

export async function startPaymentRequestCreation(payload: unknown): Promise<unknown> {
  const { data } = await workflowApi.post(
    PAYMENT_REQUEST_AUTOMATION_URLS.startJob,
    payload,
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

export function extractPaymentRequestId(
  startJobResponse: unknown,
  record?: PaymentRequestAutomationRecord | null,
): number | null {
  const response = startJobResponse as Record<string, unknown> | null | undefined;
  const nested =
    response?.data && typeof response.data === "object" && !Array.isArray(response.data)
      ? (response.data as Record<string, unknown>)
      : null;
  return (
    pickPositiveId(
      response?.payment_request_id,
      nested?.payment_request_id,
      nested?.id,
      record?.payment_request_id,
      record?.created_payment_request_id,
      record?.extracted_data && (record.extracted_data as { payment_request_id?: unknown }).payment_request_id,
    ) ?? null
  );
}

export function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { message?: unknown; detail?: unknown; error?: unknown; data?: { message?: unknown } }
      | undefined;
    const message = payload?.detail ?? payload?.message ?? payload?.data?.message ?? payload?.error;
    if (message != null && textValue(message)) return String(message);
  }
  return fallback;
}
