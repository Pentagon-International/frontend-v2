import type {
  AgeingBucket,
  FinanceOutstandingAgeingData,
  OutstandingPartySlice,
  OutstandingPartyType,
  OutstandingRiskLevel,
  OutstandingTableRow,
  OutstandingTableSection,
} from "./financeOutstandingAgeingTypes";
import { FINANCE_OUTSTANDING_AGEING_MOCK } from "./financeOutstandingAgeingMock";

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

function riskLevel(value: unknown): OutstandingRiskLevel {
  const v = firstString(value).toLowerCase();
  if (v === "high") return "high";
  if (v === "medium" || v === "med") return "medium";
  return "low";
}

function normalizeBucket(raw: unknown, index: number): AgeingBucket {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: firstString(row.id, row.bucket_id, `bucket_${index}`),
    label: firstString(row.label, row.name, `Bucket ${index + 1}`),
    amountDisplay: firstString(row.amount_display, row.amountDisplay) || undefined,
    amountCr: safeNumber(row.amount_cr ?? row.amountCr ?? row.amount),
    pct: safeNumber(row.pct ?? row.percentage),
    invoiceCount: safeNumber(row.invoice_count ?? row.invoiceCount ?? row.invoices),
    footnote: firstString(row.footnote, row.note) || undefined,
    footnoteTone:
      firstString(row.footnote_tone, row.footnoteTone).toLowerCase() === "bad" ? "bad" : undefined,
  };
}

function normalizeTableRow(raw: unknown): OutstandingTableRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const days60Plus = safeNumber(
    row.days_60_plus ?? row.days60Plus ?? row.days_61_plus ?? row.over_60,
    safeNumber(row.days_61_90) + safeNumber(row.days_90_plus),
  );
  return {
    id: firstString(row.id, row.code) || undefined,
    primaryLabel: firstString(row.primary_label, row.primaryLabel, row.name, row.branch_name),
    branchVariant: firstString(row.branch_variant, row.branchVariant).toLowerCase() || undefined,
    showBranchChip: Boolean(row.show_branch_chip ?? row.showBranchChip ?? row.branch_variant),
    subtitle: firstString(row.subtitle, row.sub, row.meta),
    outstanding: safeNumber(row.outstanding ?? row.outstanding_cr),
    current: safeNumber(row.current ?? row.current_cr),
    days1_30: safeNumber(row.days_1_30 ?? row.days1_30),
    days31_60: safeNumber(row.days_31_60 ?? row.days31_60),
    days60Plus,
    risk: riskLevel(row.risk ?? row.risk_level),
    watchLabel: firstString(row.watch_label, row.watchLabel, row.badge) || undefined,
    watchTone:
      firstString(row.watch_tone, row.watchTone).toLowerCase() === "bad"
        ? "bad"
        : firstString(row.watch_tone, row.watchTone).toLowerCase() === "warn"
          ? "warn"
          : undefined,
    highlight60Plus: Boolean(row.highlight_60_plus ?? row.highlight60Plus),
    isMoreFooter: Boolean(row.is_more_footer ?? row.isMoreFooter),
    moreCount: safeNumber(row.more_count ?? row.moreCount) || undefined,
  };
}

function normalizeTableSection(raw: unknown): OutstandingTableSection {
  const section = (raw ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(section.rows) ? section.rows : [];
  const rows = rowsRaw.map(normalizeTableRow);
  const totalRaw = section.total ?? section.footer;
  const moreRaw = section.more_footer ?? section.moreFooter;
  return {
    rows,
    total: totalRaw
      ? normalizeTableRow(totalRaw)
      : {
          primaryLabel: "Total",
          subtitle: "",
          outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
          current: rows.reduce((s, r) => s + r.current, 0),
          days1_30: rows.reduce((s, r) => s + r.days1_30, 0),
          days31_60: rows.reduce((s, r) => s + r.days31_60, 0),
          days60Plus: rows.reduce((s, r) => s + r.days60Plus, 0),
          risk: "low",
        },
    moreFooter: moreRaw ? normalizeTableRow(moreRaw) : undefined,
  };
}

function normalizePartySlice(raw: unknown, fallback: OutstandingPartySlice): OutstandingPartySlice {
  const slice = (raw ?? {}) as Record<string, unknown>;
  const bucketsRaw = Array.isArray(slice.ageing_buckets)
    ? slice.ageing_buckets
    : Array.isArray(slice.ageingBuckets)
      ? slice.ageingBuckets
      : [];
  return {
    tabLabel: firstString(slice.tab_label, slice.tabLabel, fallback.tabLabel),
    amountCr: safeNumber(slice.amount_cr ?? slice.amountCr, fallback.amountCr),
    ageingBuckets: bucketsRaw.length
      ? bucketsRaw.map(normalizeBucket)
      : fallback.ageingBuckets,
    byBranch: normalizeTableSection(slice.by_branch ?? slice.byBranch ?? fallback.byBranch),
    byParty: normalizeTableSection(slice.by_party ?? slice.byParty ?? fallback.byParty),
  };
}

export function normalizeFinanceOutstandingAgeing(raw: unknown): FinanceOutstandingAgeingData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root.result ?? root) ?? {}) as Record<string, unknown>;
  const metaRaw = (data.meta ?? data.header ?? {}) as Record<string, unknown>;

  const customerRaw = data.customer ?? data.customer_outstanding;
  const agentRaw = data.agent ?? data.agent_outstanding;

  return {
    meta: {
      title: firstString(metaRaw.title, data.title, FINANCE_OUTSTANDING_AGEING_MOCK.meta.title),
      subtitle: firstString(metaRaw.subtitle, data.subtitle, FINANCE_OUTSTANDING_AGEING_MOCK.meta.subtitle),
      asOfLabel: firstString(
        metaRaw.as_of_label,
        metaRaw.asOfLabel,
        metaRaw.period_label,
        FINANCE_OUTSTANDING_AGEING_MOCK.meta.asOfLabel,
      ),
    },
    customer: normalizePartySlice(customerRaw, FINANCE_OUTSTANDING_AGEING_MOCK.customer),
    agent: normalizePartySlice(agentRaw, FINANCE_OUTSTANDING_AGEING_MOCK.agent),
    filterOptions:
      (data.filter_options as FinanceOutstandingAgeingData["filterOptions"]) ??
      FINANCE_OUTSTANDING_AGEING_MOCK.filterOptions,
  };
}

export function getPartySlice(
  data: FinanceOutstandingAgeingData,
  party: OutstandingPartyType,
): OutstandingPartySlice {
  return party === "agent" ? data.agent : data.customer;
}
