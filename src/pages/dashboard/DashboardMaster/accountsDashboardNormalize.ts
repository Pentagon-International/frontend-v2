import type {
  AccountsDashboardData,
  AccountsKpi,
  BreakdownDimension,
  BreakdownRow,
  MonthlyTrendPoint,
  RevenueMixItem,
  MarginBySegmentItem,
  TrendDirection,
} from "./accountsDashboardTypes";
import { ACCOUNTS_DASHBOARD_MOCK } from "./accountsDashboardMock";

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

function marginTone(value: unknown): BreakdownRow["marginTone"] {
  const v = firstString(value).toLowerCase();
  if (v === "good" || v === "warn" || v === "bad" || v === "neutral") return v;
  const pct = safeNumber(value);
  if (pct >= 25) return "good";
  if (pct >= 18) return "neutral";
  if (pct >= 14) return "warn";
  return "bad";
}

function normalizeKpi(raw: unknown, index: number): AccountsKpi {
  const row = (raw ?? {}) as Record<string, unknown>;
  const trend = (row.trend ?? row.change ?? {}) as Record<string, unknown>;
  const spark = Array.isArray(row.sparkline)
    ? row.sparkline
    : Array.isArray(row.spark)
      ? row.spark
      : [];
  return {
    key: firstString(row.key, row.id, `kpi_${index}`),
    label: firstString(row.label, row.name, row.title, `KPI ${index + 1}`),
    value: safeNumber(row.value ?? row.amount),
    unit: firstString(row.unit, row.value_unit, ""),
    isPercent: Boolean(row.is_percent ?? row.isPercent ?? row.unit === "%"),
    showCurrency: Boolean(
      row.show_currency ??
        row.showCurrency ??
        row.currency ??
        (row.unit === "Cr" || row.unit === "L"),
    ),
    trend: {
      direction: trendDirection(trend.direction ?? trend.trend_direction ?? row.trend_direction),
      text: firstString(trend.text, trend.value, trend.pct, row.trend_text, row.trend_pct),
      context: firstString(trend.context, trend.label, row.trend_context, "vs. last period"),
    },
    sparkline: spark.map((p) => safeNumber(p)),
    sparklineColor: firstString(row.sparkline_color, row.sparklineColor),
  };
}

function normalizeBreakdownRow(raw: unknown): BreakdownRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const revenue = safeNumber(row.revenue ?? row.revenue_cr);
  const cost = safeNumber(row.cost ?? row.cost_cr);
  const grossProfit = safeNumber(
    row.gross_profit ?? row.grossProfit ?? row.profit ?? revenue - cost,
  );
  const marginPct = safeNumber(row.margin_pct ?? row.marginPct ?? row.margin, revenue > 0 ? (grossProfit / revenue) * 100 : 0);
  const yoyPct = safeNumber(row.yoy_pct ?? row.yoyPct ?? row.yoy);
  return {
    id: firstString(row.id, row.code) || undefined,
    name: firstString(row.name, row.dimension, row.segment, row.label),
    subtitle: firstString(row.subtitle, row.sub, row.meta),
    code: firstString(row.code, row.branch_code, row.branchCode) || undefined,
    branchVariant:
      firstString(row.branch_variant, row.branchVariant).toLowerCase() || undefined,
    dotColor: firstString(row.dot_color, row.dotColor) || undefined,
    revenue,
    cost,
    grossProfit,
    marginPct,
    marginTone: marginTone(row.margin_tone ?? row.marginTone ?? marginPct),
    yoyPct,
    yoyDirection: trendDirection(row.yoy_direction ?? row.yoyDirection ?? yoyPct),
    yoyLabel: firstString(row.yoy_label, row.yoyLabel) || undefined,
  };
}

function normalizeDimensionKey(value: unknown): BreakdownDimension | null {
  const key = firstString(value).toLowerCase();
  if (key === "segment" || key === "branch" || key === "customer" || key === "tradelane" || key === "salesperson") {
    return key;
  }
  return null;
}

export function normalizeAccountsDashboard(raw: unknown): AccountsDashboardData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root.result ?? root) ?? {}) as Record<string, unknown>;

  const metaRaw = (data.meta ?? data.header ?? {}) as Record<string, unknown>;
  const kpisRaw = Array.isArray(data.kpis)
    ? data.kpis
    : Array.isArray(data.summary)
      ? data.summary
      : [];

  const breakdownRoot = (data.breakdown ?? data.profit_breakdown ?? {}) as Record<string, unknown>;
  const byDimensionRaw =
    (breakdownRoot.by_dimension ?? breakdownRoot.byDimension ?? breakdownRoot.dimensions ?? data.by_dimension) as
      | Record<string, unknown>
      | undefined;

  const byDimension: AccountsDashboardData["breakdown"]["byDimension"] = {};
  if (byDimensionRaw && typeof byDimensionRaw === "object") {
    for (const [key, value] of Object.entries(byDimensionRaw)) {
      const dim = normalizeDimensionKey(key);
      if (!dim) continue;
      const block = (value ?? {}) as Record<string, unknown>;
      const rowsRaw = Array.isArray(block.rows) ? block.rows : Array.isArray(value) ? (value as unknown[]) : [];
      const rows = rowsRaw.map(normalizeBreakdownRow).filter((r) => r.name);
      const totalRaw = block.total ?? block.totals;
      byDimension[dim] = {
        rows,
        total: totalRaw
          ? normalizeBreakdownRow({ ...((totalRaw as Record<string, unknown>) ?? {}), name: firstString((totalRaw as Record<string, unknown>).name, "Total") })
          : rows.length
            ? normalizeBreakdownRow({
                name: `Total · all ${dim}s`,
                revenue: rows.reduce((s, r) => s + r.revenue, 0),
                cost: rows.reduce((s, r) => s + r.cost, 0),
                grossProfit: rows.reduce((s, r) => s + r.grossProfit, 0),
                marginPct:
                  rows.reduce((s, r) => s + r.revenue, 0) > 0
                    ? (rows.reduce((s, r) => s + r.grossProfit, 0) / rows.reduce((s, r) => s + r.revenue, 0)) * 100
                    : 0,
                yoyPct: 0,
              })
            : normalizeBreakdownRow({ name: "Total" }),
      };
    }
  }

  const monthlyRaw = (data.monthly_trend ?? data.monthlyTrend ?? {}) as Record<string, unknown>;
  const monthlyPointsRaw = Array.isArray(monthlyRaw.points)
    ? monthlyRaw.points
    : Array.isArray(monthlyRaw.months)
      ? monthlyRaw.months
      : Array.isArray(data.monthly)
        ? data.monthly
        : [];

  const revenueMixRaw = (data.revenue_mix ?? data.revenueMix ?? {}) as Record<string, unknown>;
  const mixItemsRaw = Array.isArray(revenueMixRaw.items)
    ? revenueMixRaw.items
    : Array.isArray(revenueMixRaw.segments)
      ? revenueMixRaw.segments
      : [];

  const marginRaw = (data.margin_by_segment ?? data.marginBySegment ?? {}) as Record<string, unknown>;
  const marginItemsRaw = Array.isArray(marginRaw.items)
    ? marginRaw.items
    : Array.isArray(marginRaw.segments)
      ? marginRaw.segments
      : [];

  const dimensions =
    (Array.isArray(breakdownRoot.dimensions)
      ? breakdownRoot.dimensions.map(normalizeDimensionKey).filter(Boolean)
      : Object.keys(byDimension)) as BreakdownDimension[];

  const normalized: AccountsDashboardData = {
    meta: {
      title: firstString(metaRaw.title, data.title, "Profitability"),
      subtitle: firstString(metaRaw.subtitle, metaRaw.sub, data.subtitle),
      periodLabel: firstString(metaRaw.period_label, metaRaw.periodLabel, data.period_label),
      updatedAgo: firstString(metaRaw.updated_ago, metaRaw.updatedAgo, data.updated_ago),
      fyLabel: firstString(metaRaw.fy_label, metaRaw.fyLabel, data.fy_label),
    },
    kpis: kpisRaw.length ? kpisRaw.map(normalizeKpi) : ACCOUNTS_DASHBOARD_MOCK.kpis,
    breakdown: {
      dimensions: dimensions.length ? dimensions : ACCOUNTS_DASHBOARD_MOCK.breakdown.dimensions,
      activeDimension:
        normalizeDimensionKey(breakdownRoot.active_dimension ?? breakdownRoot.activeDimension) ??
        "segment",
      byDimension: Object.keys(byDimension).length ? byDimension : ACCOUNTS_DASHBOARD_MOCK.breakdown.byDimension,
    },
    monthlyTrend: {
      fyLabel: firstString(monthlyRaw.fy_label, monthlyRaw.fyLabel, "FY · ₹ Cr"),
      points: monthlyPointsRaw.length
        ? monthlyPointsRaw.map((point) => {
            const row = (point ?? {}) as Record<string, unknown>;
            return {
              month: firstString(row.month, row.label),
              revenue: safeNumber(row.revenue ?? row.revenue_cr),
              grossProfit: safeNumber(row.gross_profit ?? row.grossProfit ?? row.profit),
              marginPct: safeNumber(row.margin_pct ?? row.marginPct ?? row.margin),
            } satisfies MonthlyTrendPoint;
          })
        : ACCOUNTS_DASHBOARD_MOCK.monthlyTrend.points,
    },
    revenueMix: {
      total: safeNumber(revenueMixRaw.total, revenueMixRaw.total_cr),
      totalUnit: firstString(revenueMixRaw.total_unit, revenueMixRaw.totalUnit, "Cr"),
      items: mixItemsRaw.length
        ? mixItemsRaw.map((item) => {
            const row = (item ?? {}) as Record<string, unknown>;
            return {
              name: firstString(row.name, row.segment),
              value: safeNumber(row.value ?? row.revenue ?? row.amount),
              pct: safeNumber(row.pct ?? row.percent ?? row.share),
              color: firstString(row.color, "#0ea5e9"),
            } satisfies RevenueMixItem;
          })
        : ACCOUNTS_DASHBOARD_MOCK.revenueMix.items,
    },
    marginBySegment: {
      benchmarkPct: safeNumber(marginRaw.benchmark_pct ?? marginRaw.benchmarkPct, 21.5),
      items: marginItemsRaw.length
        ? marginItemsRaw.map((item) => {
            const row = (item ?? {}) as Record<string, unknown>;
            return {
              name: firstString(row.name, row.segment),
              marginPct: safeNumber(row.margin_pct ?? row.marginPct ?? row.margin),
              color: firstString(row.color) || undefined,
            } satisfies MarginBySegmentItem;
          })
        : ACCOUNTS_DASHBOARD_MOCK.marginBySegment.items,
    },
    filterOptions: data.filter_options as AccountsDashboardData["filterOptions"],
  };

  return normalized;
}

export function formatCrLAmount(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`;
  if (abs >= 1 && abs < 1000) {
    return `${sign}₹${abs.toFixed(abs >= 10 ? 2 : 1)}${abs >= 1 ? " Cr" : ""}`;
  }
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Values from API are typically in crores when unit is Cr. */
export function formatDashboardAmount(value: number, unit = "Cr"): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "Cr" || unit === "cr") return `₹${value.toFixed(value >= 10 ? 2 : 2)} Cr`;
  if (unit === "L" || unit === "l") return `₹${value.toFixed(1)} L`;
  return formatCrLAmount(value);
}

/** Format a value stored in crores as ₹X.XX Cr or ₹X.X L (reference dashboard style). */
export function formatAmountInCr(valueInCr: number): string {
  const abs = Math.abs(valueInCr);
  if (abs >= 1) return `${abs.toFixed(abs >= 10 ? 2 : 2)} Cr`;
  return `${(abs * 100).toFixed(1)} L`;
}

const BRANCH_DOT_COLORS: Record<string, string> = {
  mum: "#0ea5e9",
  del: "#f59e0b",
  blr: "#22c55e",
  maa: "#8b5cf6",
  ccu: "#ec4899",
  amd: "#14b8a6",
};

export function branchDotColor(variant?: string, explicit?: string): string {
  if (explicit) return explicit;
  if (variant && BRANCH_DOT_COLORS[variant.toLowerCase()]) {
    return BRANCH_DOT_COLORS[variant.toLowerCase()];
  }
  return "#1e3a5f";
}
