import dayjs from "dayjs";
import type {
  AgeingBucket,
  FinanceOutstandingAgeingData,
  OutstandingAmountCells,
  OutstandingPartySlice,
  OutstandingRiskLevel,
  OutstandingTableRow,
  OutstandingTableSection,
  OutstandingViewMode,
} from "./financeOutstandingAgeingTypes";

const INR_PER_CR = 10_000_000;

function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
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

/** Preserves API amount strings without formatting or unit conversion. */
function rawAmount(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "—";
}

function formatWithCurrency(value: unknown, currency: string): string {
  const raw = rawAmount(value);
  if (raw === "—") return "—";
  return currency ? `${currency} ${raw}` : raw;
}

function amountsFromApi(
  _row: Record<string, unknown>,
  keys: {
    outstanding: unknown;
    overdue?: unknown;
    dso_days?: unknown;
    days1_30?: unknown;
    days31_60?: unknown;
    days61_90?: unknown;
    days90_180?: unknown;
    days180_plus?: unknown;
    open_line_count?: unknown;
    days60Plus?: unknown;
  },
): OutstandingAmountCells {
  const days61_90 = rawAmount(keys.days61_90);
  const days90_180 = rawAmount(keys.days90_180);
  const days180_plus = rawAmount(keys.days180_plus);
  const days60Plus =
    rawAmount(keys.days60Plus) !== "—"
      ? rawAmount(keys.days60Plus)
      : days180_plus !== "—"
        ? days180_plus
        : days90_180 !== "—"
          ? days90_180
          : days61_90;

  return {
    outstanding: rawAmount(keys.outstanding),
    overdue: rawAmount(keys.overdue),
    dso_days: rawAmount(keys.dso_days),
    days1_30: rawAmount(keys.days1_30),
    days31_60: rawAmount(keys.days31_60),
    days61_90,
    days90_180,
    days180_plus,
    open_line_count: rawAmount(keys.open_line_count),
    days60Plus,
  };
}

function riskLevel(value: unknown): OutstandingRiskLevel {
  const v = firstString(value).toLowerCase();
  if (v === "high") return "high";
  if (v === "medium" || v === "med") return "medium";
  return "low";
}

function rupeesToCr(rupees: number): number {
  return rupees / INR_PER_CR;
}

const EMPTY_AMOUNTS: OutstandingAmountCells = {
  outstanding: "—",
  overdue: "—",
  dso_days: "—",
  days1_30: "—",
  days31_60: "—",
  days61_90: "—",
  days90_180: "—",
  days180_plus: "—",
  open_line_count: "—",
  days60Plus: "—",
};

function emptyTotalRow(label: string): OutstandingTableRow {
  return {
    primaryLabel: label,
    subtitle: "",
    amounts: { ...EMPTY_AMOUNTS },
    risk: "low",
  };
}

function totalRowFromSummary(summary: Record<string, unknown>): OutstandingTableRow {
  return {
    primaryLabel: "Total",
    subtitle: "",
    amounts: amountsFromApi(summary, {
      outstanding: summary.total_outstanding ?? summary.book,
      overdue: summary.total_overdue ?? summary.overdue,
      dso_days: summary.dso_days,
      days1_30: summary.days_1_30,
      days31_60: summary.days_31_60,
      days61_90: summary.days_61_90,
      days90_180: summary.days_90_180,
      days180_plus: summary.days_180_plus,
      open_line_count: summary.open_line_count ?? summary.open_invoices,
      days60Plus: summary.days_90_plus ?? summary.days_90,
    }),
    risk: "low",
  };
}

function buildAgeingBuckets(summary: Record<string, unknown>, currency: string): AgeingBucket[] {
  const total = safeNumber(summary.total_outstanding);
  const openInvoices = safeNumber(summary.open_invoices);
  const currentRaw =
    summary.current ??
    (summary.total_outstanding !== undefined && summary.total_overdue !== undefined
      ? String(Math.max(0, safeNumber(summary.total_outstanding) - safeNumber(summary.total_overdue)))
      : undefined);

  const buckets: { id: string; label: string; raw: unknown }[] = [
    { id: "current", label: "Current", raw: currentRaw },
    { id: "overdue", label: "Overdue", raw: summary.total_overdue },
    { id: "dso_days", label: "DSO Days", raw: summary.dso_days ,},
    { id: "days_1_30", label: "1–30 Days", raw: summary.days_1_30 },
    { id: "days_31_60", label: "31–60 Days", raw: summary.days_31_60 },
    { id: "days_61_90", label: "61–90 Days", raw: summary.days_61_90 },
    { id: "days_61_90", label: "90–180 Days", raw: summary.days_90_180 },
    { id: "days_61_90", label: "180+ Days", raw: summary.days_180_plus },

    // { id: "days_90_plus", label: "90+ Days", raw: summary.days_90_plus ?? summary.days_90 },
  ];

  return buckets.map((bucket) => {
    const amount = safeNumber(bucket.raw);
    return {
      id: bucket.id,
      label: bucket.label,
      raw: bucket.raw,
      amountDisplay: formatWithCurrency(bucket.raw, currency),
      amountCr: rupeesToCr(amount),
      pct: total > 0 ? (amount / total) * 100 : 0,
      invoiceCount:
        total > 0 && openInvoices > 0
          ? Math.max(0, Math.round(openInvoices * (amount / total)))
          : 0,
      footnote:
        bucket.id === "days_90_plus" && rawAmount(summary.total_overdue) !== "—"
          ? `${formatWithCurrency(summary.total_overdue, currency)} overdue`
          : undefined,
      footnoteTone: bucket.id === "days_90_plus" && rawAmount(summary.total_overdue) !== "—" ? "bad" : undefined,
    };
  });
}

function branchNameFromApi(row: Record<string, unknown>): string {
  return firstString(row.location);
}

function mapCustomerRow(raw: unknown): OutstandingTableRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const risk = riskLevel(row.risk ?? row.risk_level);
  const branchName = branchNameFromApi(row);
  const amounts = amountsFromApi(row, {
    outstanding: row.outstanding,
    overdue: row.overdue,
    dso_days: row.dso_days,
    days1_30: row.days_1_30 ?? row.days1_30,
    days31_60: row.days_31_60 ?? row.days31_60,
    days61_90: row.days_61_90 ?? row.days_61_plus,
    days90_180: row.days_90_180 ?? row.days_90,
    days180_plus: row.days_180_plus ?? row.days_180,
    open_line_count: row.open_line_count ?? row.open_line_count,
    days60Plus: row.days_90_plus ?? row.days_61_90 ?? row.days_61_plus ?? row.days_60_plus,
  });

  const customerName = firstString(row.customer_name, row.customerName, row.name);
  return {
    id: firstString(row.customer_code, row.customerCode, row.id) || undefined,
    primaryLabel: customerName || "—",
    customerName: customerName || undefined,
    branchName: branchName || undefined,
    showBranchChip: Boolean(branchName),
    subtitle: [
      firstString(row.credit_display, row.creditDisplay),
      firstString(row.salesperson),
    ]
      .filter(Boolean)
      .join(" · "),
    amounts,
    risk,
    watchLabel: risk === "high" ? "High" : risk === "medium" ? "Watch" : undefined,
    watchTone: risk === "high" ? "bad" : risk === "medium" ? "warn" : undefined,
    highlight60Plus:
      (amounts.days61_90 !== "—" ||
        amounts.days90_180 !== "—" ||
        amounts.days180_plus !== "—") &&
      safeNumber(row.outstanding) > 0 &&
      (safeNumber(amounts.days61_90) +
        safeNumber(amounts.days90_180) +
        safeNumber(amounts.days180_plus)) >
        safeNumber(row.outstanding) * 0.15,
  };
}

function mapBranchRow(raw: unknown): OutstandingTableRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const book = safeNumber(row.book ?? row.outstanding);
  const overdue = safeNumber(row.overdue);
  const receiptCount = safeNumber(row.receipt_count ?? row.receiptCount);
  const invoiceCount = safeNumber(row.invoice_count ?? row.invoiceCount);
  const code = firstString(row.branch_code, row.branchCode).toLowerCase();
  const branchName =
    branchNameFromApi(row) ||
    firstString(row.branch_name, row.branchName, code.toUpperCase());
  const amounts = amountsFromApi(row, {
    outstanding: row.book ?? row.outstanding,
    overdue: row.overdue,
    dso_days: row.dso_days,
    days1_30: row.days_1_30,
    days31_60: row.days_31_60,
    days61_90: row.days_61_90,
    days90_180: row.days_90_180,
    days180_plus: row.days_180_plus,
    open_line_count: row.open_line_count ?? row.invoice_count,
    days60Plus: row.days_90_plus ?? row.days_61_90,
  });

  const subtitleParts: string[] = [];
  if (receiptCount > 0) subtitleParts.push(`${receiptCount} receipts`);
  if (invoiceCount > 0) subtitleParts.push(`${invoiceCount} invoices`);
  const collectedRaw = rawAmount(row.collected);
  if (collectedRaw !== "—") subtitleParts.push(`${collectedRaw} collected`);

  return {
    id: code || undefined,
    primaryLabel: branchName || "—",
    branchName: branchName || undefined,
    branchVariant: code || undefined,
    showBranchChip: true,
    subtitle: subtitleParts.join(" · ") || amounts.outstanding,
    amounts,
    risk: overdue > book * 0.4 && book > 0 ? "high" : overdue > 0 ? "medium" : "low",
    watchLabel: overdue > book * 0.4 ? "High" : overdue > 0 ? "Watch" : undefined,
    watchTone: overdue > book * 0.4 ? "bad" : overdue > 0 ? "warn" : undefined,
    highlight60Plus: amounts.days60Plus !== "—" && overdue > 0,
  };
}

function buildTableSection(
  rowsRaw: unknown[],
  mapRow: (raw: unknown) => OutstandingTableRow,
  totalLabel: string,
  summary: Record<string, unknown>,
  moreCount?: number,
): OutstandingTableSection {
  const rows = rowsRaw.map(mapRow).filter((r) => r.primaryLabel);
  const hasSummaryTotals = Boolean(
    summary.total_outstanding ?? summary.book ?? summary.days_1_30,
  );
  return {
    rows,
    total: rows.length
      ? hasSummaryTotals
        ? totalRowFromSummary(summary)
        : emptyTotalRow(totalLabel)
      : emptyTotalRow(totalLabel),
    moreFooter:
      moreCount && moreCount > 0
        ? {
            primaryLabel: "",
            subtitle: "",
            amounts: { ...EMPTY_AMOUNTS },
            risk: "low",
            isMoreFooter: true,
            moreCount,
          }
        : undefined,
  };
}

function buildMetaSubtitle(summary: Record<string, unknown>, currency: string): string {
  const openInvoices = safeNumber(summary.open_invoices);
  const customerCount = safeNumber(summary.customer_count);
  const parts = [
    `${formatWithCurrency(summary.total_outstanding, currency)} outstanding`,
    `${formatWithCurrency(summary.total_overdue, currency)} overdue`,
    openInvoices > 0 ? `${openInvoices} open invoices` : null,
    customerCount > 0 ? `${customerCount} customers` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function buildListFilterOptions(dataRaw: unknown[]) {
  const customerNames = Array.from(
    new Set(
      dataRaw
        .map((raw) => {
          const row = (raw ?? {}) as Record<string, unknown>;
          return firstString(row.customer_name, row.customerName, row.name);
        })
        .filter(Boolean),
    ),
  );
  const locations = Array.from(
    new Set(
      dataRaw
        .map((raw) => {
          const row = (raw ?? {}) as Record<string, unknown>;
          return firstString(row.location);
        })
        .filter(Boolean),
    ),
  );
  return {
    customers: [
      { value: "", label: "All customers" },
      ...customerNames.map((v) => ({ value: v, label: v })),
    ],
    locations: [
      { value: "", label: "All locations" },
      ...locations.map((v) => ({ value: v, label: v })),
    ],
  };
}

function buildBranchMetaSubtitle(
  summary: Record<string, unknown>,
  branchCount: number,
  currency: string,
): string {
  const parts = [
    `${formatWithCurrency(summary.book ?? summary.total_outstanding, currency)} book`,
    `${formatWithCurrency(summary.overdue ?? summary.total_overdue, currency)} overdue`,
    branchCount > 0 ? `${branchCount} branches` : null,
    safeNumber(summary.receipt_count) > 0
      ? `${safeNumber(summary.receipt_count)} receipts`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function emptyPartySlice(currency = ""): OutstandingPartySlice {
  return {
    tabLabel: "Customer Outstanding",
    amountCr: 0,
    ageingBuckets: buildAgeingBuckets({}, currency),
    byBranch: { rows: [], total: emptyTotalRow("Total") },
    byParty: { rows: [], total: emptyTotalRow("Total") },
  };
}

export function emptyFinanceOutstandingAgeing(): FinanceOutstandingAgeingData {
  const empty = emptyPartySlice();
  return {
    meta: {
      title: "Outstanding & Ageing",
      subtitle: "",
      asOfLabel: "—",
    },
    currency: "",
    customer: empty,
    agent: { ...empty, tabLabel: "Agent Outstanding" },
    pagination: { index: 0, limit: 15, total: 0, hasNext: false },
  };
}

export function normalizeFinanceOutstandingAgeing(
  raw: unknown,
  viewMode: OutstandingViewMode,
): FinanceOutstandingAgeingData {
  const root = (raw ?? {}) as Record<string, unknown>;

  const index = safeNumber(root.index);
  const limit = safeNumber(root.limit, 15);
  const total = safeNumber(root.total);
  const returned = safeNumber(root.returned_count, 0);
  const rowCount = Array.isArray(root.data) ? root.data.length : 0;
  const hasNext = Boolean(root.has_next) || index + Math.max(returned, rowCount) < total;

  const summary = (root.summary ?? {}) as Record<string, unknown>;
  const currency = firstString(summary.currency);
  const asOf = firstString(root.as_of, root.asOf);
  const asOfLabel = asOf
    ? `As of ${dayjs(asOf).isValid() ? dayjs(asOf).format("D MMM YYYY") : asOf}`
    : "—";

  const branchesRaw = Array.isArray(root.branches) ? root.branches : [];
  const dataRaw = Array.isArray(root.data) ? root.data : [];

  const isBranchView = viewMode === "branch" || Boolean(root.branch) || branchesRaw.length > 0;

  let byBranch: OutstandingTableSection;
  let byParty: OutstandingTableSection;

  if (isBranchView) {
    const branchRows = branchesRaw.length ? branchesRaw : dataRaw;
    byBranch = buildTableSection(
      branchRows,
      mapBranchRow,
      "Total",
      summary,
      hasNext ? Math.max(0, total - branchRows.length) : 0,
    );
    byParty = { rows: [], total: emptyTotalRow("Total") };
  } else {
    byParty = buildTableSection(dataRaw, mapCustomerRow, "Total", summary);
    byBranch = { rows: [], total: emptyTotalRow("Total") };
  }

  const totalOutstandingRupees = safeNumber(
    summary.total_outstanding ?? summary.book ?? summary.billing,
  );
  const ageingBuckets =
    Object.keys(summary).length > 0
      ? buildAgeingBuckets(summary, currency)
      : buildAgeingBuckets(
          {
            ...summary,
            total_outstanding: summary.book ?? summary.total_outstanding,
            total_overdue: summary.overdue ?? summary.total_overdue,
            open_invoices: summary.invoice_count ?? summary.open_invoices,
          },
          currency,
        );

  const customerSlice: OutstandingPartySlice = {
    tabLabel: "Customer Outstanding",
    amountCr: rupeesToCr(totalOutstandingRupees),
    ageingBuckets,
    byBranch,
    byParty,
  };

  return {
    meta: {
      title: "Outstanding & Ageing",
      subtitle: isBranchView
        ? buildBranchMetaSubtitle(summary, branchesRaw.length || byBranch.rows.length, currency)
        : buildMetaSubtitle(summary, currency),
      asOfLabel,
    },
    currency,
    customer: customerSlice,
    agent: { ...emptyPartySlice(currency), tabLabel: "Agent Outstanding" },
    filterOptions: buildListFilterOptions(dataRaw),
    pagination: { index, limit, total, hasNext },
  };
}

export function getPartySlice(
  data: FinanceOutstandingAgeingData,
  party: "customer" | "agent",
): OutstandingPartySlice {
  return party === "agent" ? data.agent : data.customer;
}
