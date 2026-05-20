import type {
  ActivityListItem,
  ActivityListPanel,
  BranchOpenItemRow,
  BranchOpenItemsSection,
  FinancePendingActivitiesData,
  PendingActivityCategory,
  PendingActivityKpi,
} from "./financePendingActivitiesTypes";
import { FINANCE_PENDING_ACTIVITIES_MOCK } from "./financePendingActivitiesMock";

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

function categoryId(value: unknown): PendingActivityCategory {
  const v = firstString(value).toLowerCase();
  if (v.includes("cost")) return "costs";
  if (v.includes("voucher")) return "vouchers";
  if (v.includes("credit")) return "credit_notes";
  return "invoices";
}

function normalizeKpi(raw: unknown, index: number): PendingActivityKpi {
  const row = (raw ?? {}) as Record<string, unknown>;
  const id = categoryId(row.id ?? row.category ?? index);
  const highlightToneRaw = firstString(row.highlight_tone, row.highlightTone).toLowerCase();
  return {
    id,
    label: firstString(row.label, row.title, `KPI ${index + 1}`),
    subtitle: firstString(row.subtitle, row.sub),
    amountCr: safeNumber(row.amount_cr ?? row.amountCr ?? row.amount),
    amountDisplay: firstString(row.amount_display, row.amountDisplay) || undefined,
    count: safeNumber(row.count),
    avgAgeDays: safeNumber(row.avg_age_days ?? row.avgAgeDays ?? row.avg_age),
    highlightLabel: firstString(row.highlight_label, row.highlightLabel) || undefined,
    highlightValue: safeNumber(row.highlight_value ?? row.highlightValue) || undefined,
    highlightTone:
      highlightToneRaw === "bad" ? "bad" : highlightToneRaw === "warn" ? "warn" : undefined,
  };
}

function normalizeDistribution(raw: unknown): BranchOpenItemRow["distribution"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((seg) => {
    const s = (seg ?? {}) as Record<string, unknown>;
    return {
      category: categoryId(s.category ?? s.type),
      flex: safeNumber(s.flex ?? s.weight, 1),
    };
  });
}

function normalizeBranchRow(raw: unknown): BranchOpenItemRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: firstString(row.id, row.code) || undefined,
    branchName: firstString(row.branch_name, row.branchName, row.name),
    branchVariant: firstString(row.branch_variant, row.branchVariant).toLowerCase() || undefined,
    subtitle: firstString(row.subtitle, row.sub),
    watchLabel: firstString(row.watch_label, row.watchLabel) || undefined,
    watchTone:
      firstString(row.watch_tone, row.watchTone).toLowerCase() === "bad"
        ? "bad"
        : firstString(row.watch_tone, row.watchTone).toLowerCase() === "warn"
          ? "warn"
          : undefined,
    invoiceCount: safeNumber(row.invoice_count ?? row.invoiceCount),
    invoiceAmountCr: safeNumber(row.invoice_amount_cr ?? row.invoiceAmountCr),
    invoiceDisplay: firstString(row.invoice_display, row.invoiceDisplay) || undefined,
    costCount: safeNumber(row.cost_count ?? row.costCount),
    costAmountCr: safeNumber(row.cost_amount_cr ?? row.costAmountCr),
    costDisplay: firstString(row.cost_display, row.costDisplay) || undefined,
    distribution: normalizeDistribution(row.distribution ?? row.distribution_segments),
    totalExposureCr: safeNumber(row.total_exposure_cr ?? row.totalExposureCr),
    totalExposureDisplay:
      firstString(row.total_exposure_display, row.totalExposureDisplay) || undefined,
    owner: firstString(row.owner, row.owner_name),
  };
}

function normalizeBranchSection(raw: unknown): BranchOpenItemsSection {
  const section = (raw ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(section.rows) ? section.rows : [];
  const rows = rowsRaw.map(normalizeBranchRow);
  const totalRaw = section.total ?? {};
  return {
    rows: rows.length ? rows : FINANCE_PENDING_ACTIVITIES_MOCK.byBranch.rows,
    total: rows.length
      ? normalizeBranchRow(totalRaw)
      : FINANCE_PENDING_ACTIVITIES_MOCK.byBranch.total,
  };
}

function normalizeActivityItem(raw: unknown): ActivityListItem {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: firstString(row.id) || undefined,
    iconTone: categoryId(row.icon_tone ?? row.iconTone ?? row.category),
    title: firstString(row.title, row.name, row.customer, row.vendor),
    subtitle: firstString(row.subtitle, row.sub),
    reference: firstString(row.reference, row.job_ref, row.jobRef),
    amountCr: safeNumber(row.amount_cr ?? row.amountCr ?? row.amount),
    amountDisplay: firstString(row.amount_display, row.amountDisplay) || undefined,
    ageDays: safeNumber(row.age_days ?? row.ageDays ?? row.age),
    branchCode: firstString(row.branch_code, row.branchCode) || undefined,
    branchVariant: firstString(row.branch_variant, row.branchVariant).toLowerCase() || undefined,
    typeTag: firstString(row.type_tag, row.typeTag, row.type) || undefined,
    statusNote: firstString(row.status_note, row.statusNote) || undefined,
  };
}

function normalizePanel(raw: unknown, fallback: ActivityListPanel): ActivityListPanel {
  const panel = (raw ?? {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(panel.items) ? panel.items : [];
  const tabsRaw = panel.filter_tabs ?? panel.filterTabs;
  return {
    id: categoryId(panel.id ?? fallback.id),
    title: firstString(panel.title, fallback.title),
    subtitle: firstString(panel.subtitle, fallback.subtitle),
    totalCount: safeNumber(panel.total_count ?? panel.totalCount, fallback.totalCount),
    filterTabs: Array.isArray(tabsRaw)
      ? tabsRaw.map((t) => {
          const tab = (t ?? {}) as Record<string, unknown>;
          return {
            value: firstString(tab.value, tab.id),
            label: firstString(tab.label, tab.name),
          };
        })
      : fallback.filterTabs,
    items: itemsRaw.length ? itemsRaw.map(normalizeActivityItem) : fallback.items,
    moreCount: safeNumber(panel.more_count ?? panel.moreCount) || fallback.moreCount,
    moreLabel: firstString(panel.more_label, panel.moreLabel) || fallback.moreLabel,
  };
}

export function normalizeFinancePendingActivities(raw: unknown): FinancePendingActivitiesData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root.result ?? root) ?? {}) as Record<string, unknown>;
  const metaRaw = (data.meta ?? data.header ?? {}) as Record<string, unknown>;
  const kpisRaw = Array.isArray(data.kpis) ? data.kpis : [];

  return {
    meta: {
      title: firstString(metaRaw.title, data.title, "Pending Activities"),
      subtitle: firstString(metaRaw.subtitle, data.subtitle, FINANCE_PENDING_ACTIVITIES_MOCK.meta.subtitle),
      asOfLabel: firstString(metaRaw.as_of_label, metaRaw.asOfLabel, "Open as of today"),
    },
    kpis: kpisRaw.length ? kpisRaw.map(normalizeKpi) : FINANCE_PENDING_ACTIVITIES_MOCK.kpis,
    byBranch: normalizeBranchSection(data.by_branch ?? data.byBranch),
    invoicesPanel: normalizePanel(
      data.invoices_panel ?? data.invoicesPanel,
      FINANCE_PENDING_ACTIVITIES_MOCK.invoicesPanel,
    ),
    costsPanel: normalizePanel(
      data.costs_panel ?? data.costsPanel,
      FINANCE_PENDING_ACTIVITIES_MOCK.costsPanel,
    ),
    vouchersPanel: normalizePanel(
      data.vouchers_panel ?? data.vouchersPanel,
      FINANCE_PENDING_ACTIVITIES_MOCK.vouchersPanel,
    ),
    creditNotesPanel: data.credit_notes_panel
      ? normalizePanel(data.credit_notes_panel, {
          id: "credit_notes",
          title: "Credit Notes Pending",
          subtitle: "",
          totalCount: 0,
          items: [],
        })
      : undefined,
    filterOptions:
      (data.filter_options as FinancePendingActivitiesData["filterOptions"]) ??
      FINANCE_PENDING_ACTIVITIES_MOCK.filterOptions,
  };
}
