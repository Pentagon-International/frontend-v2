import type {
  BranchBvaRow,
  BranchBudgetVsActualData,
  BvaBarTone,
  BvaKpi,
  ModeBvaItem,
  MonthlyRunRatePoint,
  VarianceCallout,
} from "./branchBudgetVsActualTypes";
import type { TrendDirection } from "./accountsDashboardTypes";
import { BRANCH_BUDGET_VS_ACTUAL_MOCK } from "./branchBudgetVsActualMock";

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

function trendDirection(value: unknown): TrendDirection {
  const v = firstString(value).toLowerCase();
  if (v === "up" || v === "down" || v === "flat") return v;
  if (safeNumber(value) < 0) return "down";
  if (safeNumber(value) > 0) return "up";
  return "flat";
}

function barTone(value: unknown, achievementPct?: number): BvaBarTone {
  const v = firstString(value).toLowerCase();
  if (v === "over" || v === "under" || v === "neutral") return v;
  const pct = achievementPct ?? safeNumber(value);
  if (pct >= 100) return "over";
  if (pct < 75) return "under";
  return "neutral";
}

function formatVariance(valueInCr: number, display?: string): string {
  if (display) return display;
  const sign = valueInCr >= 0 ? "+" : "−";
  const abs = Math.abs(valueInCr);
  if (abs >= 1) return `${sign}₹${abs.toFixed(2)} Cr`;
  return `${sign}₹${(abs * 100).toFixed(0)} L`;
}

function normalizeBranchRow(raw: unknown): BranchBvaRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const budget = safeNumber(row.budget ?? row.budget_cr);
  const actual = safeNumber(row.actual ?? row.actual_cr);
  const achievementPct = safeNumber(
    row.achievement_pct ?? row.achievementPct ?? row.achieved_pct,
    budget > 0 ? (actual / budget) * 100 : 0,
  );
  const variance = safeNumber(row.variance ?? row.variance_cr, actual - budget);
  const varianceDirection =
    firstString(row.variance_direction, row.varianceDirection).toLowerCase() === "pos" ||
    variance >= 0
      ? "pos"
      : "neg";

  return {
    id: firstString(row.id, row.code) || undefined,
    name: firstString(row.name, row.branch),
    subtitle: firstString(row.subtitle, row.sub, row.meta),
    watchLabel: firstString(row.watch_label, row.watchLabel) || undefined,
    budget,
    actual,
    barActualWidthPct: safeNumber(row.bar_actual_width_pct ?? row.barActualWidthPct, achievementPct),
    markerLeftPct: safeNumber(row.marker_left_pct ?? row.markerLeftPct, 100),
    barTone: barTone(row.bar_tone ?? row.barTone, achievementPct),
    variance,
    varianceDisplay: firstString(row.variance_display, row.varianceDisplay) || formatVariance(variance),
    varianceDirection: varianceDirection as "pos" | "neg",
    achievementPct,
  };
}

function normalizeKpi(raw: unknown, index: number): BvaKpi {
  const row = (raw ?? {}) as Record<string, unknown>;
  const trend = (row.trend ?? row.change ?? {}) as Record<string, unknown>;
  return {
    label: firstString(row.label, row.name, `KPI ${index + 1}`),
    value: safeNumber(row.value ?? row.amount),
    unit: firstString(row.unit, ""),
    showCurrency: Boolean(row.show_currency ?? row.showCurrency ?? row.unit === "Cr"),
    context: firstString(row.context, trend.context),
    trendText: firstString(row.trend_text, trend.text, trend.value),
    trendDirection: trendDirection(trend.direction ?? row.trend_direction),
  };
}

export function normalizeBranchBudgetVsActual(raw: unknown): BranchBudgetVsActualData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root.result ?? root) ?? {}) as Record<string, unknown>;

  const metaRaw = (data.meta ?? data.header ?? {}) as Record<string, unknown>;
  const kpisRaw = Array.isArray(data.kpis) ? data.kpis : Array.isArray(data.summary) ? data.summary : [];

  const branchRaw = (data.branch_performance ?? data.branchPerformance ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(branchRaw.rows) ? branchRaw.rows : Array.isArray(data.branches) ? data.branches : [];

  const monthlyRaw = (data.monthly_run_rate ?? data.monthlyRunRate ?? {}) as Record<string, unknown>;
  const monthlyPointsRaw = Array.isArray(monthlyRaw.points)
    ? monthlyRaw.points
    : Array.isArray(monthlyRaw.months)
      ? monthlyRaw.months
      : [];

  const byModeRaw = (data.by_mode ?? data.byMode ?? {}) as Record<string, unknown>;
  const modeItemsRaw = Array.isArray(byModeRaw.items) ? byModeRaw.items : Array.isArray(byModeRaw.modes) ? byModeRaw.modes : [];

  const calloutsRaw = Array.isArray(data.variance_callouts)
    ? data.variance_callouts
    : Array.isArray(data.varianceCallouts)
      ? data.varianceCallouts
      : [];

  const rows = rowsRaw.map(normalizeBranchRow).filter((r) => r.name);
  const totalRaw = branchRaw.total ?? branchRaw.totals;

  return {
    meta: {
      title: firstString(metaRaw.title, data.title, "Branch Budget vs Actual"),
      subtitle: firstString(metaRaw.subtitle, metaRaw.sub, data.subtitle),
      periodLabel: firstString(metaRaw.period_label, metaRaw.periodLabel, "FY YTD"),
      fyLabel: firstString(metaRaw.fy_label, metaRaw.fyLabel),
    },
    kpis: kpisRaw.length ? kpisRaw.map(normalizeKpi) : BRANCH_BUDGET_VS_ACTUAL_MOCK.kpis,
    branchPerformance: {
      rows: rows.length ? rows : BRANCH_BUDGET_VS_ACTUAL_MOCK.branchPerformance.rows,
      total: totalRaw
        ? normalizeBranchRow({ ...((totalRaw as Record<string, unknown>) ?? {}), name: "All Branches" })
        : rows.length
          ? normalizeBranchRow({
              name: "All Branches",
              budget: rows.reduce((s, r) => s + r.budget, 0),
              actual: rows.reduce((s, r) => s + r.actual, 0),
              barActualWidthPct: 53,
              markerLeftPct: 58,
              achievementPct:
                rows.reduce((s, r) => s + r.budget, 0) > 0
                  ? (rows.reduce((s, r) => s + r.actual, 0) / rows.reduce((s, r) => s + r.budget, 0)) * 100
                  : 0,
              variance: rows.reduce((s, r) => s + r.actual, 0) - rows.reduce((s, r) => s + r.budget, 0),
            })
          : BRANCH_BUDGET_VS_ACTUAL_MOCK.branchPerformance.total,
    },
    monthlyRunRate: {
      fyLabel: firstString(monthlyRaw.fy_label, monthlyRaw.fyLabel, "FY · ₹ Cr · all branches"),
      points: monthlyPointsRaw.length
        ? monthlyPointsRaw.map((point) => {
            const row = (point ?? {}) as Record<string, unknown>;
            return {
              month: firstString(row.month, row.label),
              budget: safeNumber(row.budget ?? row.budget_cr),
              actual: safeNumber(row.actual ?? row.actual_cr),
              isForecast: Boolean(row.is_forecast ?? row.isForecast),
            } satisfies MonthlyRunRatePoint;
          })
        : BRANCH_BUDGET_VS_ACTUAL_MOCK.monthlyRunRate.points,
    },
    byMode: {
      items: modeItemsRaw.length
        ? modeItemsRaw.map((item) => {
            const row = (item ?? {}) as Record<string, unknown>;
            const actual = safeNumber(row.actual ?? row.actual_cr);
            const budget = safeNumber(row.budget ?? row.budget_cr);
            return {
              name: firstString(row.name, row.mode),
              actual,
              budget,
              barWidthPct: safeNumber(row.bar_width_pct ?? row.barWidthPct, budget > 0 ? (actual / budget) * 100 : 0),
              targetLeftPct: safeNumber(row.target_left_pct ?? row.targetLeftPct, 50),
              tone: (firstString(row.tone).toLowerCase() as ModeBvaItem["tone"]) || undefined,
            } satisfies ModeBvaItem;
          })
        : BRANCH_BUDGET_VS_ACTUAL_MOCK.byMode.items,
    },
    varianceCallouts: calloutsRaw.length
      ? calloutsRaw.map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const toneRaw = firstString(row.tone, row.type).toLowerCase();
          return {
            amount: firstString(row.amount, row.value),
            tone: toneRaw === "good" ? "good" : "bad",
            text: firstString(row.text, row.message, row.description),
          } satisfies VarianceCallout;
        })
      : BRANCH_BUDGET_VS_ACTUAL_MOCK.varianceCallouts,
    filterOptions: data.filter_options as BranchBudgetVsActualData["filterOptions"],
  };
}
