import dayjs from "dayjs";
import { BRANCH_CHIP_CITY } from "../collectionTargetVsPerformance/theme";
import type {
  CollectionChargeLine,
  CollectionInvoiceDrillData,
  CollectionPaymentTimelineEvent,
} from "./types";

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function rawApiAmount(value: unknown): string {
  if (value == null || value === "") return "—";
  return firstString(value) || String(value);
}

function formatDocDate(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format("D MMM YYYY") : iso;
}

function timelineKind(value: unknown): CollectionPaymentTimelineEvent["kind"] {
  const k = firstString(value).toLowerCase();
  if (k === "invoice") return "invoice";
  if (k === "due") return "due";
  if (k === "payment" || k === "paid") return "payment";
  return "other";
}

function timelineState(kind: CollectionPaymentTimelineEvent["kind"]): "done" | "alert" | "pending" {
  if (kind === "due") return "alert";
  if (kind === "payment") return "done";
  if (kind === "invoice") return "done";
  return "pending";
}

function statusTone(status: string, dueStatus: string): CollectionInvoiceDrillData["statusTone"] {
  const s = status.toUpperCase();
  if (s === "PARTIAL") return "partial";
  if (dueStatus.startsWith("+")) return "overdue";
  if (s === "OPEN") return "open";
  return "neutral";
}

export function emptyCollectionInvoiceDrill(documentNo = "Invoice"): CollectionInvoiceDrillData {
  return {
    breadcrumb: `${documentNo} · Invoice detail`,
    invoiceId: documentNo,
    customerName: "—",
    branchLabel: "—",
    jobRef: "—",
    terms: "—",
    currency: "INR",
    balance: "—",
    status: "OPEN",
    statusTone: "open",
    receivableLabel: "Balance due",
    invoiceDate: "—",
    dueDate: "—",
    grossAmount: "—",
    received: "—",
    chargeLines: [],
    subtotal: "—",
    taxTotal: "—",
    invoiceTotal: "—",
    timeline: [],
  };
}

export function normalizeCollectionInvoiceDrill(
  raw: unknown,
  hint?: { documentNo?: string; branchName?: string },
): CollectionInvoiceDrillData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const nested = root.data ?? root.result ?? root.payload;
  const envelope =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : root;

  const invoice =
    envelope.level === "invoice" && envelope.invoice
      ? (envelope.invoice as Record<string, unknown>)
      : ((envelope.invoice ?? envelope) as Record<string, unknown>);

  const documentNo = firstString(invoice.document_no, invoice.documentNo, hint?.documentNo) || "—";
  const branchCode = firstString(invoice.branch_code, invoice.branchCode).toLowerCase();
  const branchName = firstString(invoice.branch_name, invoice.branchName, hint?.branchName);
  const branchLabel =
    (BRANCH_CHIP_CITY[branchCode] ?? branchName ?? branchCode.toUpperCase()) || "—";
  const status = firstString(invoice.status, "OPEN").toUpperCase();
  const dueStatus = firstString(invoice.due_status, invoice.dueStatus);

  const chargeLinesRaw = Array.isArray(invoice.charge_lines) ? invoice.charge_lines : [];
  const chargeLines: CollectionChargeLine[] = chargeLinesRaw.map((line) => {
    const row = (line ?? {}) as Record<string, unknown>;
    return {
      chargeHead: firstString(row.charge_head, row.chargeHead, "—"),
      qty: rawApiAmount(row.qty),
      unit: firstString(row.unit) || "—",
      rate: rawApiAmount(row.rate),
      amount: rawApiAmount(row.amount),
    };
  });

  const timelineRaw = Array.isArray(invoice.payment_timeline) ? invoice.payment_timeline : [];
  const timeline: CollectionPaymentTimelineEvent[] = timelineRaw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const kind = timelineKind(row.kind);
    return {
      date: formatDocDate(firstString(row.date)),
      title: firstString(row.title, "—"),
      amount: rawApiAmount(row.amount),
      kind,
      state: timelineState(kind),
    };
  });

  const branchDisplay = hint?.branchName ?? branchLabel;

  return {
    breadcrumb: `${branchDisplay} · Invoices › ${documentNo}`,
    invoiceId: documentNo,
    customerName: firstString(invoice.customer_name, invoice.customerName, "—"),
    branchLabel,
    branchVariant: branchCode || undefined,
    jobRef: firstString(invoice.job_ref, invoice.jobRef, invoice.shipment_no, invoice.shipmentNo, "—"),
    terms: firstString(invoice.credit_terms, invoice.creditTerms, "—"),
    currency: firstString(invoice.currency_code, invoice.currencyCode, "INR"),
    balance: rawApiAmount(invoice.balance),
    status,
    statusTone: statusTone(status, dueStatus),
    receivableLabel: "Balance due",
    invoiceDate: formatDocDate(firstString(invoice.document_date, invoice.documentDate)),
    dueDate: formatDocDate(firstString(invoice.due_date, invoice.dueDate)),
    grossAmount: rawApiAmount(invoice.gross_amount, invoice.grossAmount),
    received: rawApiAmount(invoice.received, invoice.paid),
    chargeLines,
    subtotal: rawApiAmount(invoice.subtotal),
    taxTotal: rawApiAmount(invoice.tax_total, invoice.taxTotal),
    invoiceTotal: rawApiAmount(invoice.invoice_total, invoice.invoiceTotal),
    timeline,
  };
}
