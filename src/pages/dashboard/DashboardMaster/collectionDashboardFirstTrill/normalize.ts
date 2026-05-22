import dayjs from "dayjs";
import { formatCrLAmount } from "../accountsDashboardNormalize";
import { BRANCH_CHIP_CITY } from "../collectionTargetVsPerformance/theme";
import type {
  CollectionBranchDrillData,
  CollectionBranchDrillSummaryCard,
  CollectionOutstandingInvoiceRow,
} from "./types";

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function formatPct(value: unknown): string {
  const n = safeNumber(value);
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
}

function formatDocDate(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format("D MMM YYYY") : iso;
}

/** Preserve API amount strings (no Cr/L conversion). */
function rawApiAmount(value: unknown): string {
  if (value == null || value === "") return "—";
  return firstString(value) || String(value);
}

function statusTone(status: string): CollectionOutstandingInvoiceRow["statusTone"] {
  const s = status.toUpperCase();
  if (s === "PARTIAL") return "partial";
  if (s === "OPEN") return "open";
  return "other";
}

function ageTone(ageDisplay: string, ageDays: number): CollectionOutstandingInvoiceRow["ageTone"] {
  const display = ageDisplay.toLowerCase();
  if (display.includes("not due")) return "notDue";
  if (ageDays > 0 || display.startsWith("+")) return "overdue";
  return "neutral";
}

function normalizeInvoiceRow(raw: unknown): CollectionOutstandingInvoiceRow | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  const documentNo = firstString(row.document_no, row.documentNo);
  if (!documentNo) return null;

  const documentDate = firstString(row.document_date, row.documentDate);
  const creditTerms = firstString(row.credit_terms, row.creditTerms);
  const branchCode = firstString(row.branch_code, row.branchCode).toLowerCase();
  const city = (BRANCH_CHIP_CITY[branchCode] ?? branchCode.toUpperCase()) || "—";
  const currency = firstString(row.currency_code, row.currencyCode, "INR");
  const paidRupees = safeNumber(row.paid);
  const ageDisplay = firstString(row.age_display, row.ageDisplay);
  const ageDays = safeNumber(row.age_days, row.ageDays);
  const status = firstString(row.status, "OPEN").toUpperCase();

  return {
    invoiceId: safeNumber(row.invoice_id, row.invoiceId),
    documentNo,
    invoiceMeta: [formatDocDate(documentDate), creditTerms].filter(Boolean).join(" · "),
    customerName: firstString(row.customer_name, row.customerName, "—"),
    customerMeta: `● ${city.toUpperCase()} · ${currency}`,
    branchVariant: branchCode || undefined,
    amount: rawApiAmount(row.amount),
    paid: rawApiAmount(row.paid),
    paidTone: paidRupees > 0 ? "good" : "muted",
    balance: rawApiAmount(row.balance),
    ageDisplay: ageDisplay || (ageDays > 0 ? `+${ageDays} d` : "—"),
    ageTone: ageTone(ageDisplay, ageDays),
    status,
    statusTone: statusTone(status),
  };
}

function buildSummaryCards(summary: Record<string, unknown>): CollectionBranchDrillSummaryCard[] {
  const outstanding = safeNumber(summary.outstanding);
  const invoiceCount = safeNumber(summary.invoice_count);

  return [
    {
      label: "Outstanding",
      value: formatCrLAmount(outstanding),
      detail: invoiceCount > 0 ? `${invoiceCount} invoices` : "—",
    },
    {
      label: "Current",
      value: formatCrLAmount(summary.current),
      detail: formatPct(summary.current_pct),
      valueColor: "#16a34a",
    },
    {
      label: "1–60 days",
      value: formatCrLAmount(summary.days_1_60),
      detail: formatPct(summary.days_1_60_pct),
    },
    {
      label: "60+ days",
      value: formatCrLAmount(summary.days_60_plus),
      detail: formatPct(summary.days_60_plus_pct),
    },
  ];
}

export function emptyCollectionBranchDrill(branchName = "Branch"): CollectionBranchDrillData {
  return {
    breadcrumb: `${branchName} · Invoices`,
    title: `${branchName} · Collection drill-down`,
    subtitle: "Outstanding invoices contributing to collection gap",
    summaryCards: buildSummaryCards({}),
    invoices: [],
    invoiceCount: 0,
  };
}

export function normalizeCollectionBranchDrill(
  raw: unknown,
  branchHint?: { branchName?: string; branchCode?: string },
): CollectionBranchDrillData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const nested = root.data ?? root.result ?? root.payload;
  const envelope =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : root;

  const branch =
    envelope.level === "branch" && envelope.branch
      ? (envelope.branch as Record<string, unknown>)
      : ((envelope.branch ?? envelope) as Record<string, unknown>);
  const branchName =
    firstString(branch.branch_name, branch.branchName, branchHint?.branchName) || "Branch";
  const branchCode =
    firstString(branch.branch_code, branch.branchCode, branchHint?.branchCode, envelope.branch_code) ||
    "";

  const summary = (branch.summary ?? {}) as Record<string, unknown>;
  const invoicesRaw = Array.isArray(branch.outstanding_invoices)
    ? branch.outstanding_invoices
    : [];

  const invoices = invoicesRaw
    .map((row) => normalizeInvoiceRow(row))
    .filter((row): row is CollectionOutstandingInvoiceRow => row != null);

  const paginationRaw = (branch.pagination ?? {}) as Record<string, unknown>;

  return {
    breadcrumb: `${branchName} · Invoices`,
    title: `${branchName} · Collection drill-down`,
    subtitle: "Outstanding invoices contributing to collection gap",
    summaryCards: buildSummaryCards(summary),
    invoices,
    invoiceCount: safeNumber(summary.invoice_count, invoices.length),
    pagination: paginationRaw.total_count != null
      ? {
          index: safeNumber(paginationRaw.index),
          limit: safeNumber(paginationRaw.limit, 20),
          totalCount: safeNumber(paginationRaw.total_count),
          hasNext: Boolean(paginationRaw.has_next),
        }
      : undefined,
  };
}
