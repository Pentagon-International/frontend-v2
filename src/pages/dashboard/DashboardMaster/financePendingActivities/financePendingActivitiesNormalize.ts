import dayjs from "dayjs";
import { formatAmountInCr } from "../accountsDashboardNormalize";
import type {
  ActivityListItem,
  ActivityListPanel,
  BranchOpenItemRow,
  BranchOpenItemsSection,
  FinancePendingActivitiesData,
  PendingActivityCategory,
  PendingActivityKpi,
} from "./financePendingActivitiesTypes";
import {
  EMPTY_BRANCH_TOTAL,
  EMPTY_FINANCE_PENDING_ACTIVITIES,
} from "./financePendingActivitiesTypes";
import type { PendingActivitiesTopLists } from "./financePendingActivitiesApi";

const CRORE = 10_000_000;

function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inrToCr(inr: number): number {
  return inr / CRORE;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function categoryId(value: unknown): PendingActivityCategory {
  const v = firstString(value).toLowerCase();
  if (v.includes("cost")) return "costs";
  if (v.includes("voucher")) return "vouchers";
  if (v.includes("credit")) return "credit_notes";
  return "invoices";
}

const PANEL_DEFAULTS: Record<
  PendingActivityCategory,
  Pick<ActivityListPanel, "id" | "title" | "moreLabel">
> = {
  invoices: { id: "invoices", title: "Invoices to Raise", moreLabel: "invoices" },
  costs: { id: "costs", title: "Costs to Book", moreLabel: "entries" },
  vouchers: { id: "vouchers", title: "Vouchers Awaiting Approval", moreLabel: "vouchers" },
  credit_notes: { id: "credit_notes", title: "Credit Notes Pending", moreLabel: "credit notes" },
};

const KPI_ORDER: PendingActivityCategory[] = [
  "invoices",
  "costs",
  "vouchers",
  "credit_notes",
];

const SUMMARY_KEY: Record<PendingActivityCategory, string> = {
  invoices: "invoices_to_raise",
  costs: "costs_to_book",
  vouchers: "vouchers_pending",
  credit_notes: "credit_notes_pending",
};

function formatCountExposure(count: number, exposureInr: number): string {
  return `${count} · ₹${formatAmountInCr(inrToCr(exposureInr))}`;
}

function kpiHighlight(
  category: PendingActivityCategory,
  row: Record<string, unknown>,
): Pick<PendingActivityKpi, "highlightLabel" | "highlightValue" | "highlightTone"> {
  switch (category) {
    case "invoices": {
      const over30 = safeNumber(row.over_30d);
      return over30 > 0
        ? { highlightLabel: "Over 30d", highlightValue: over30, highlightTone: "warn" }
        : {};
    }
    case "costs": {
      const preMec = safeNumber(row.pre_mec);
      return preMec > 0
        ? { highlightLabel: "Pre-MEC", highlightValue: preMec, highlightTone: "warn" }
        : {};
    }
    case "vouchers": {
      const over7 = safeNumber(row.over_7d);
      return over7 > 0
        ? { highlightLabel: "Over 7d", highlightValue: over7, highlightTone: "bad" }
        : {};
    }
    case "credit_notes": {
      const disputes = safeNumber(row.disputes);
      return disputes > 0
        ? { highlightLabel: "Disputes", highlightValue: disputes, highlightTone: "bad" }
        : {};
    }
    default:
      return {};
  }
}

function normalizeKpiFromSummary(
  category: PendingActivityCategory,
  raw: unknown,
): PendingActivityKpi {
  const row = (raw ?? {}) as Record<string, unknown>;
  const exposure = safeNumber(row.total_exposure ?? row.exposure ?? row.amount);
  return {
    id: category,
    label: firstString(row.title, PANEL_DEFAULTS[category].title),
    subtitle: firstString(row.description, row.subtitle),
    amountCr: inrToCr(exposure),
    count: safeNumber(row.count),
    avgAgeDays: safeNumber(row.avg_age_days ?? row.avgAgeDays),
    ...kpiHighlight(category, row),
  };
}

function normalizeKpis(summary: unknown): PendingActivityKpi[] {
  if (!summary || typeof summary !== "object") return [];
  const record = summary as Record<string, unknown>;
  return KPI_ORDER.map((category) => {
    const key = SUMMARY_KEY[category];
    const block = record[key];
    if (!block || typeof block !== "object") {
      return {
        id: category,
        label: PANEL_DEFAULTS[category].title,
        subtitle: "",
        amountCr: 0,
        count: 0,
        avgAgeDays: 0,
      };
    }
    return normalizeKpiFromSummary(category, block);
  });
}

function normalizeDistributionFromPct(
  pct: Record<string, unknown> | undefined,
): BranchOpenItemRow["distribution"] {
  if (!pct) return [];
  return Object.entries(pct)
    .map(([key, value]) => ({
      category: categoryId(key),
      flex: safeNumber(value, 0),
    }))
    .filter((seg) => seg.flex > 0);
}

function normalizeDistributionFromAmounts(
  amounts: Record<string, unknown> | undefined,
): BranchOpenItemRow["distribution"] {
  if (!amounts) return [];
  return Object.entries(amounts)
    .map(([key, value]) => ({
      category: categoryId(key),
      flex: safeNumber(value, 0),
    }))
    .filter((seg) => seg.flex > 0);
}

function normalizeBranchRow(raw: unknown): BranchOpenItemRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const invoices = (row.invoices ?? {}) as Record<string, unknown>;
  const costs = (row.costs ?? {}) as Record<string, unknown>;
  const branchCode = firstString(row.branch_code, row.branchCode);
  const invoiceExposure = safeNumber(invoices.exposure ?? invoices.amount);
  const costExposure = safeNumber(costs.exposure ?? costs.amount);
  const totalExposure = safeNumber(row.total_exposure ?? row.totalExposureCr);

  return {
    id: branchCode || undefined,
    branchName: firstString(row.branch_name, row.branchName, branchCode),
    branchVariant: branchCode.toLowerCase() || undefined,
    invoiceCount: safeNumber(invoices.count),
    invoiceAmountCr: inrToCr(invoiceExposure),
    invoiceDisplay: formatCountExposure(safeNumber(invoices.count), invoiceExposure),
    costCount: safeNumber(costs.count),
    costAmountCr: inrToCr(costExposure),
    costDisplay: formatCountExposure(safeNumber(costs.count), costExposure),
    distribution:
      normalizeDistributionFromPct(row.distribution_pct as Record<string, unknown>) ||
      normalizeDistributionFromAmounts(row.distribution as Record<string, unknown>),
    totalExposureCr: inrToCr(totalExposure),
    totalExposureDisplay: `₹${formatAmountInCr(inrToCr(totalExposure))}`,
    owner: firstString(row.owner, row.owner_name) || "—",
  };
}

function sumBranchRows(rows: BranchOpenItemRow[]): BranchOpenItemRow {
  const total = rows.reduce(
    (acc, row) => ({
      invoiceCount: acc.invoiceCount + row.invoiceCount,
      invoiceAmountCr: acc.invoiceAmountCr + row.invoiceAmountCr,
      costCount: acc.costCount + row.costCount,
      costAmountCr: acc.costAmountCr + row.costAmountCr,
      totalExposureCr: acc.totalExposureCr + row.totalExposureCr,
      distribution: [] as BranchOpenItemRow["distribution"],
    }),
    {
      invoiceCount: 0,
      invoiceAmountCr: 0,
      costCount: 0,
      costAmountCr: 0,
      totalExposureCr: 0,
      distribution: [] as BranchOpenItemRow["distribution"],
    },
  );

  const invoiceInr = total.invoiceAmountCr * CRORE;
  const costInr = total.costAmountCr * CRORE;
  const totalInr = total.totalExposureCr * CRORE;

  return {
    branchName: "All Branches",
    invoiceCount: total.invoiceCount,
    invoiceAmountCr: total.invoiceAmountCr,
    invoiceDisplay: formatCountExposure(total.invoiceCount, invoiceInr),
    costCount: total.costCount,
    costAmountCr: total.costAmountCr,
    costDisplay: formatCountExposure(total.costCount, costInr),
    distribution: [],
    totalExposureCr: total.totalExposureCr,
    totalExposureDisplay: `₹${formatAmountInCr(inrToCr(totalInr))}`,
    owner: "",
  };
}

function normalizeBranchSection(raw: unknown): BranchOpenItemsSection {
  const rowsRaw = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.rows)
      ? ((raw as Record<string, unknown>).rows as unknown[])
      : [];
  const rows = rowsRaw.map(normalizeBranchRow);
  return {
    rows,
    total: rows.length ? sumBranchRows(rows) : EMPTY_BRANCH_TOTAL,
  };
}

function normalizeActivityItem(
  raw: unknown,
  category: PendingActivityCategory,
  index: number,
): ActivityListItem {
  const row = (raw ?? {}) as Record<string, unknown>;
  const amountInr = safeNumber(row.amount ?? row.exposure);
  const amounts = Array.isArray(row.amounts) ? row.amounts : [];
  const firstShipment = (amounts[0] ?? {}) as Record<string, unknown>;
  const isVoucher = category === "vouchers";

  const title = isVoucher
    ? firstString(row.beneficiary, row.title)
    : firstString(row.customer_name, row.customer, row.beneficiary, row.title);

  const reference = isVoucher
    ? firstString(row.voucher_no, row.reference)
    : firstString(row.job_ref, firstShipment.shipment_id, row.reference);

  const rowId = firstString(row.id);
  const uniqueId = rowId ? `${rowId}-${index}` : `row-${index}`;

  return {
    id: uniqueId,
    iconTone: category,
    title: title || "—",
    subtitle: firstString(row.subtitle, row.description),
    reference: reference || "—",
    amountCr: inrToCr(amountInr),
    ageDays: safeNumber(row.age_days ?? row.ageDays),
    branchCode: firstString(row.branch_code, row.branchCode) || undefined,
    branchVariant: firstString(row.branch_code, row.branchVariant).toLowerCase() || undefined,
    typeTag: isVoucher ? firstString(row.type, row.type_tag) || undefined : undefined,
    statusNote: firstString(row.status_note, row.subtitle) || undefined,
  };
}

function normalizePanel(
  raw: unknown,
  category: PendingActivityCategory,
  topList?: { index: number; limit: number },
): ActivityListPanel {
  const panel = (raw ?? {}) as Record<string, unknown>;
  const defaults = PANEL_DEFAULTS[category];
  const itemsRaw = Array.isArray(panel.rows)
    ? panel.rows
    : Array.isArray(panel.items)
      ? panel.items
      : Array.isArray(panel.results)
        ? panel.results
        : [];
  const totalCount = safeNumber(panel.total ?? panel.count ?? panel.total_count);
  const index = safeNumber(panel.index, topList?.index ?? 0);
  const limit = safeNumber(panel.limit, topList?.limit ?? itemsRaw.length);
  const items = itemsRaw.map((item, i) => normalizeActivityItem(item, category, index + i));
  const remaining = Math.max(0, totalCount - index - items.length);

  return {
    id: category,
    title: firstString(panel.title, defaults.title),
    subtitle: firstString(panel.subtitle, panel.description),
    totalCount,
    items,
    moreCount: remaining > 0 ? remaining : undefined,
    moreLabel: defaults.moreLabel,
    pagination:
      totalCount > 0
        ? { index, limit, total: totalCount }
        : undefined,
  };
}

function branchFilterOptions(
  branches: BranchOpenItemRow[],
): FinancePendingActivitiesData["filterOptions"] {
  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [];
  for (const row of branches) {
    const code = row.id ?? row.branchVariant?.toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    options.push({ value: code, label: row.branchName || code });
  }
  return { branches: options.length ? options : undefined };
}

function buildMeta(
  root: Record<string, unknown>,
  data: Record<string, unknown>,
  filters: Record<string, unknown>,
): FinancePendingActivitiesData["meta"] {
  const dateFrom = firstString(filters.date_from, data.date_from);
  const dateTo = firstString(filters.date_to, data.date_to, filters.as_of, data.as_of);
  const asOf = firstString(filters.as_of, data.as_of, dateTo);
  const company = firstString(filters.company_name, filters.company);

  let subtitle = firstString(data.subtitle);
  if (!subtitle && dateFrom && dateTo) {
    const from = dayjs(dateFrom);
    const to = dayjs(dateTo);
    if (from.isValid() && to.isValid()) {
      subtitle =
        from.year() === to.year()
          ? `${from.format("D MMM")} – ${to.format("D MMM YYYY")}`
          : `${from.format("D MMM YYYY")} – ${to.format("D MMM YYYY")}`;
    }
  }
  if (company) {
    subtitle = subtitle ? `${company} · ${subtitle}` : company;
  }

  const asOfLabel = asOf && dayjs(asOf).isValid()
    ? `Open · ${dayjs(asOf).format("D MMM YYYY")}`
    : "Open as of today";

  return {
    title: firstString(data.title, root.message, "Pending Activities"),
    subtitle,
    asOfLabel,
  };
}

export function normalizeFinancePendingActivities(
  raw: unknown,
  topLists?: PendingActivitiesTopLists,
): FinancePendingActivitiesData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const filters = (root.filters ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;
  const topListsData = (data.top_lists ?? {}) as Record<string, unknown>;

  const kpis = normalizeKpis(data.summary);
  const byBranch = normalizeBranchSection(data.by_branch);
  const filterOptions = branchFilterOptions(byBranch.rows);

  const invoicesRaw = topListsData.invoices_to_raise ?? data.invoices_to_raise;
  const costsRaw = topListsData.costs_to_book ?? data.costs_to_book;
  const vouchersRaw = topListsData.vouchers_pending ?? data.vouchers_pending;
  const creditRaw = topListsData.credit_notes_pending ?? data.credit_notes_pending;

  return {
    meta: buildMeta(root, data, filters),
    kpis,
    byBranch,
    invoicesPanel: normalizePanel(invoicesRaw, "invoices", topLists?.invoices_to_raise),
    costsPanel: normalizePanel(costsRaw, "costs", topLists?.costs_to_book),
    vouchersPanel: normalizePanel(vouchersRaw, "vouchers", topLists?.vouchers_pending),
    creditNotesPanel: creditRaw
      ? normalizePanel(creditRaw, "credit_notes")
      : undefined,
    filterOptions,
  };
}

export function emptyFinancePendingActivities(): FinancePendingActivitiesData {
  return { ...EMPTY_FINANCE_PENDING_ACTIVITIES };
}
