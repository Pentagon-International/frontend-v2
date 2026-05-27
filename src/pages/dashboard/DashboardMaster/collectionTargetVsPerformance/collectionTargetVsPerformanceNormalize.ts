import type {
  BranchCollectionRow,
  CollectionBarTone,
  CollectionKpi,
  CollectionTargetVsPerformanceData,
  DailyCollectionPoint,
  MonthlyStatItem,
} from "./collectionTargetVsPerformanceTypes";
import type { TrendDirection } from "../accountsDashboardTypes";
import { formatCollectionCrLAmount } from "./collectionAmountFormat";

const INR_PER_L = 100_000;

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

function rupees(value: unknown): number {
  return safeNumber(value);
}

function rupeesToL(value: unknown): number {
  return safeNumber(value) / INR_PER_L;
}

function trendDirection(value: unknown): TrendDirection {
  const v = firstString(value).toLowerCase();
  if (v === "up" || v === "down" || v === "flat") return v;
  if (safeNumber(value) < 0) return "down";
  if (safeNumber(value) > 0) return "up";
  return "flat";
}

function barTone(achievementPct: number): CollectionBarTone {
  if (achievementPct >= 98) return "over";
  if (achievementPct < 85) return "under";
  return "neutral";
}

function formatGapAmount(valueRupees: number, currencyCode: string): string {
  const formatted = formatCollectionCrLAmount(valueRupees, currencyCode);
  return valueRupees >= 0 ? `+${formatted.replace(/^-/, "")}` : formatted;
}

function normalizeBranchRow(
  raw: unknown,
  currencyCode: string,
  options?: { isTotal?: boolean },
): BranchCollectionRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const target = rupees(row.target ?? row.target_cr);
  const collected = rupees(row.collected ?? row.collected_cr);
  const achievementPctRaw = row.achievement_pct ?? row.achievementPct;
  const achievementPct =
    achievementPctRaw == null || achievementPctRaw === ""
      ? target > 0
        ? (collected / target) * 100
        : collected > 0
          ? 100
          : 0
      : safeNumber(achievementPctRaw);
  const gap = rupees(row.gap ?? row.gap_cr);
  const gapDirection = gap >= 0 ? "pos" : "neg";
  const receiptCount = safeNumber(row.receipt_count ?? row.receiptCount);
  const bookRupees = safeNumber(row.book);

  const subtitleParts: string[] = [];
  if (receiptCount > 0) subtitleParts.push(`${receiptCount} receipts`);
  if (bookRupees > 0) subtitleParts.push(`${formatCollectionCrLAmount(bookRupees, currencyCode)} book`);
  const overdueRupees = safeNumber(row.overdue);
  let exposureLabel: string | undefined;
  let exposureTone: BranchCollectionRow["exposureTone"];
  if (overdueRupees > 0) {
    exposureLabel = `${formatCollectionCrLAmount(overdueRupees, currencyCode)} overdue`;
    exposureTone = overdueRupees > bookRupees * 0.5 ? "bad" : "warn";
  }

  return {
    id: firstString(row.id, row.branch_code, row.code) || undefined,
    branchName: firstString(
      row.branch_name,
      row.branchName,
      row.name,
      options?.isTotal ? "All Branches" : "",
    ),
    branchCode: firstString(row.branch_code, row.branchCode, row.code) || undefined,
    branchVariant:
      firstString(row.branch_variant, row.branchVariant, row.branch_code).toLowerCase() ||
      undefined,
    branchChipLabel:
      firstString(row.branch_chip_label, row.branchChipLabel, row.branch_name) || undefined,
    subtitle: firstString(row.subtitle, row.sub, subtitleParts.join(" · ")) || undefined,
    exposureLabel,
    exposureTone,
    target,
    collected,
    barCollectedWidthPct: Math.min(100, Math.max(0, achievementPct)),
    markerLeftPct: 100,
    barTone: barTone(achievementPct),
    gap,
    gapDisplay: firstString(row.gap_display, row.gapDisplay) || formatGapAmount(gap, currencyCode),
    gapDirection: gapDirection as "pos" | "neg",
    achievementPct,
  };
}

/** Maps API `summary` → KPI row cards. */
function buildSummaryKpis(summary: Record<string, unknown>, currencyCode: string): CollectionKpi[] {
  const targetRupees = rupees(summary.target);
  const collectedRupees = rupees(summary.collected);
  const gapRupees = rupees(summary.gap);
  const achievementRaw = summary.achievement_pct;
  const achievement =
    achievementRaw == null || achievementRaw === ""
      ? null
      : safeNumber(achievementRaw);
  const dso = safeNumber(summary.dso_days);
  const acp = safeNumber(summary.acp_days);

  return [
    {
      label: "Target YTD",
      value: targetRupees,
      formattedValue: formatCollectionCrLAmount(targetRupees, currencyCode),
      context: "Plan",
    },
    {
      label: "Collected YTD",
      value: collectedRupees,
      formattedValue: formatCollectionCrLAmount(collectedRupees, currencyCode),
      trendText: gapRupees !== 0 ? formatGapAmount(gapRupees, currencyCode) : undefined,
      trendDirection: trendDirection(gapRupees),
    },
    {
      label: "Achievement",
      value: achievement ?? 0,
      formattedValue: achievement == null ? "N/A" : undefined,
      unit: "%",
      context: achievement == null ? undefined : undefined,
    },
    {
      label: "DSO",
      value: dso,
      unit: "days",
    },
    {
      label: "ACP",
      value: acp,
      unit: "days",
    },
  ];
}

function buildMonthlyStats(monthly: Record<string, unknown>, currencyCode: string): MonthlyStatItem[] {
  const collectedRupees = safeNumber(monthly.collected);
  const remainingRupees = safeNumber(monthly.remaining_target);
  const runRate = safeNumber(monthly.run_rate_per_day);
  const requiredRunRate = safeNumber(monthly.required_run_rate_per_day);
  const forecast = safeNumber(monthly.forecast_eom);
  const receiptCount = safeNumber(monthly.receipt_count);
  const workingDaysRemaining = safeNumber(monthly.working_days_remaining);
  const runRateAbove = Boolean(monthly.run_rate_above_required);

  const stats: MonthlyStatItem[] = [
    {
      label: "Collected",
      value: formatCollectionCrLAmount(collectedRupees, currencyCode),
      detail: receiptCount > 0 ? `${receiptCount} receipts` : undefined,
    },
    {
      label: "Remaining",
      value: formatCollectionCrLAmount(remainingRupees, currencyCode),
      detail:
        workingDaysRemaining > 0
          ? `${workingDaysRemaining} working days`
          : undefined,
    },
    {
      label: "Run-rate / day",
      value: formatCollectionCrLAmount(runRate, currencyCode),
      detail:
        requiredRunRate > 0
          ? runRateAbove
            ? `Above ${formatCollectionCrLAmount(requiredRunRate, currencyCode)} need`
            : `Below ${formatCollectionCrLAmount(requiredRunRate, currencyCode)} need`
          : undefined,
      detailTone: runRateAbove ? "up" : requiredRunRate > 0 ? "down" : undefined,
    },
    {
      label: "Forecast EOM",
      value: formatCollectionCrLAmount(forecast, currencyCode),
      detail: firstString(monthly.forecast_detail, monthly.forecast_note) || undefined,
    },
  ];

  return stats.filter((s) => s.value || s.detail);
}

function buildMetaSubtitle(
  summary: Record<string, unknown>,
  dateFrom: string,
  dateTo: string,
  currencyCode: string,
  periodDays?: number,
): string {
  const collected = formatCollectionCrLAmount(safeNumber(summary.collected), currencyCode);
  const target = formatCollectionCrLAmount(safeNumber(summary.target), currencyCode);
  const achievementRaw = summary.achievement_pct;
  const achievement =
    achievementRaw == null || achievementRaw === ""
      ? "N/A"
      : `${safeNumber(achievementRaw).toFixed(1)}%`;
  const dso = firstString(summary.dso_days);
  const range =
    dateFrom && dateTo
      ? `${dayjsLabel(dateFrom)} – ${dayjsLabel(dateTo)}`
      : periodDays
        ? `${periodDays} days`
        : "";
  return [range, `${collected} collected of ${target} target`, `${achievement} achievement`, dso ? `DSO ${dso} days` : ""]
    .filter(Boolean)
    .join(" · ");
}

function dayjsLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function sumBranchRows(rows: BranchCollectionRow[], currencyCode: string): BranchCollectionRow {
  const target = rows.reduce((s, r) => s + r.target, 0);
  const collected = rows.reduce((s, r) => s + r.collected, 0);
  const gap = collected - target;
  const achievementPct = target > 0 ? (collected / target) * 100 : collected > 0 ? 100 : 0;
  return normalizeBranchRow(
    {
      branch_name: "All Branches",
      target,
      collected,
      gap,
      achievement_pct: achievementPct,
    },
    currencyCode,
    { isTotal: true },
  );
}

const EMPTY_COLLECTION: CollectionTargetVsPerformanceData = {
  currencyCode: "INR",
  meta: {
    title: "Collection Target vs Performance",
    subtitle: "",
    periodLabel: "—",
  },
  kpis: [],
  thisMonth: {
    title: "This Month",
    subtitle: "",
    gaugePct: 0,
    stats: [],
  },
  dailyCollection: {
    title: "Daily Collection",
    subtitle: "",
    runRateNeed: 0,
    points: [],
  },
  branchPerformance: {
    rows: [],
    total: normalizeBranchRow({ branch_name: "All Branches" }, "INR", { isTotal: true }),
  },
};

export function emptyCollectionTargetVsPerformance(): CollectionTargetVsPerformanceData {
  return { ...EMPTY_COLLECTION };
}

/** Unwrap common API envelopes so `summary` / `monthly` / `branches` are reachable. */
function unwrapCollectionPayload(raw: unknown): Record<string, unknown> {
  const root = (raw ?? {}) as Record<string, unknown>;
  const nested = root.data ?? root.result ?? root.payload ?? root.response;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const inner = nested as Record<string, unknown>;
    if (
      inner.summary != null ||
      inner.monthly != null ||
      inner.daily_collections != null ||
      inner.branches != null
    ) {
      return inner;
    }
  }
  return root;
}

export function normalizeCollectionTargetVsPerformance(
  raw: unknown,
): CollectionTargetVsPerformanceData {
  const data = unwrapCollectionPayload(raw);

  // API sections: summary → KPIs, monthly → This Month, daily_collections → chart, branches → table
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const monthly = (data.monthly ?? {}) as Record<string, unknown>;
  const dateFrom = firstString(data.date_from);
  const dateTo = firstString(data.date_to);
  const periodDays = safeNumber(data.period_days, 0);
  const currencyCode = firstString(data.currency_code, summary.currency_code, monthly.currency_code) || "INR";

  const monthLabel = firstString(monthly.month_label, monthly.month);
  const daysElapsed = safeNumber(monthly.days_elapsed);
  const daysInMonth = safeNumber(monthly.days_in_month);
  const monthlyTargetRupees = safeNumber(monthly.target);
  const monthlyCollectedRupees = safeNumber(monthly.collected);
  const achievementMonthRaw = monthly.achievement_month_pct ?? monthly.achievement_pct;
  const gaugePct =
    achievementMonthRaw == null || achievementMonthRaw === ""
      ? monthlyTargetRupees > 0
        ? (monthlyCollectedRupees / monthlyTargetRupees) * 100
        : monthlyCollectedRupees > 0
          ? 100
          : 0
      : safeNumber(achievementMonthRaw);

  const dailyPointsRaw = Array.isArray(data.daily_collections)
    ? data.daily_collections
    : Array.isArray(data.daily_collection)
      ? data.daily_collection
      : [];

  const dailyPoints: DailyCollectionPoint[] = dailyPointsRaw.map((point) => {
    const row = (point ?? {}) as Record<string, unknown>;
    return {
      day:
        safeNumber(row.day, safeNumber(row.label)) ||
        firstString(row.day, row.label),
      amount: rupeesToL(row.amount ?? row.value ?? row.collection),
    };
  });

  const requiredRunRateL = rupeesToL(monthly.required_run_rate_per_day);

  const rowsRaw = Array.isArray(data.branches)
    ? data.branches
    : Array.isArray((data.branch_performance as Record<string, unknown> | undefined)?.rows)
      ? (data.branch_performance as Record<string, unknown>).rows
      : [];

  const rows = (rowsRaw as unknown[])
    .map((row) => normalizeBranchRow(row, currencyCode))
    .filter((r) => r.branchName);
  const total = rows.length
    ? sumBranchRows(rows, currencyCode)
    : normalizeBranchRow({ branch_name: "All Branches" }, currencyCode, { isTotal: true });

  const branchOptions = rows
    .filter((r) => r.branchCode)
    .map((r) => ({
      value: r.branchCode!,
      label: r.branchName,
    }));

  const periodLabel =
    dateFrom && dateTo
      ? dateFrom === dateTo
        ? dayjsLabel(dateTo)
        : `${new Date(dateFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${dayjsLabel(dateTo)}`
      : monthLabel || "Period";

  return {
    currencyCode,
    meta: {
      title: "Collection Target vs Performance",
      subtitle: buildMetaSubtitle(summary, dateFrom, dateTo, currencyCode, periodDays || undefined),
      periodLabel,
    },
    kpis: buildSummaryKpis(summary, currencyCode),
    thisMonth: {
      title: monthLabel ? `This Month — ${monthLabel}` : "This Month",
      subtitle:
        daysElapsed > 0 && daysInMonth > 0
          ? `${daysElapsed} days into month · ${formatCollectionCrLAmount(monthlyCollectedRupees, currencyCode)} collected of ${formatCollectionCrLAmount(monthlyTargetRupees, currencyCode)} target`
          : firstString(monthly.subtitle),
      gaugePct,
      stats: buildMonthlyStats(monthly, currencyCode),
    },
    dailyCollection: {
      title: monthLabel ? `Daily Collection · ${monthLabel}` : "Daily Collection",
      subtitle:
        requiredRunRateL > 0
          ? `Daily inflows vs daily run-rate need (${formatCollectionCrLAmount(safeNumber(monthly.required_run_rate_per_day), currencyCode)})`
          : firstString(data.daily_subtitle),
      runRateNeed: requiredRunRateL,
      runRateLabel:
        requiredRunRateL > 0
          ? `Need ${formatCollectionCrLAmount(safeNumber(monthly.required_run_rate_per_day), currencyCode)}/day`
          : undefined,
      points: dailyPoints,
    },
    branchPerformance: {
      rows,
      total,
    },
    filterOptions: branchOptions.length ? { branches: branchOptions } : undefined,
  };
}
