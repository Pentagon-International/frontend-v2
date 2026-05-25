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
import { ALL_BREAKDOWN_DIMENSIONS } from "./accountsDashboardEmpty";

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
  if (v === "up" || v === "increase") return "up";
  if (v === "down" || v === "decrease") return "down";
  if (v === "flat" || v === "unchanged" || v === "neutral") return "flat";
  if (safeNumber(value) < 0) return "down";
  if (safeNumber(value) > 0) return "up";
  return "flat";
}

function formatChangeWithDirection(
  pct: unknown,
  directionValue?: unknown,
): { direction: TrendDirection; text: string } {
  const formatted = formatChangePct(pct);
  if (directionValue != null && firstString(directionValue)) {
    return { ...formatted, direction: trendDirection(directionValue) };
  }
  return formatted;
}

function formatChangePpWithDirection(
  pp: unknown,
  directionValue?: unknown,
): { direction: TrendDirection; text: string } {
  const formatted = formatChangePp(pp);
  if (directionValue != null && firstString(directionValue)) {
    return { ...formatted, direction: trendDirection(directionValue) };
  }
  return formatted;
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

/** Raw API amounts are INR; UI stores values in crores. */
function toCr(value: unknown): number {
  const n = safeNumber(value);
  if (!n) return 0;
  return Math.abs(n) >= 10000 ? n / 1e7 : n;
}

function formatChangePct(pct: unknown): { direction: TrendDirection; text: string } {
  if (pct == null || pct === "") return { direction: "flat", text: "—" };
  const n = Number(pct);
  if (!Number.isFinite(n)) return { direction: "flat", text: "—" };
  const sign = n >= 0 ? "+" : "";
  return {
    direction: n > 0 ? "up" : n < 0 ? "down" : "flat",
    text: `${sign}${n.toFixed(1)}%`,
  };
}

function formatChangePp(pp: unknown): { direction: TrendDirection; text: string } {
  if (pp == null || pp === "") return { direction: "flat", text: "—" };
  const n = Number(pp);
  if (!Number.isFinite(n)) return { direction: "flat", text: "—" };
  const sign = n >= 0 ? "+" : "";
  return {
    direction: n > 0 ? "up" : n < 0 ? "down" : "flat",
    text: `${sign}${n.toFixed(1)}pp`,
  };
}

const REVENUE_MIX_COLORS = ["#0f2744", "#1e3a5f", "#3b5f8f", "#0ea5e9", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

/** Reference dashboard segment palette (Pentagon Finance standalone). */
const SEGMENT_COLOR_MAP: Record<string, string> = {
  "ocean fcl": "#38bdf8",
  "air freight": "#f59e0b",
  "air": "#f59e0b",
  "ocean lcl": "#1e3a5f",
  customs: "#ec4899",
  road: "#94a3b8",
  warehousing: "#8b5cf6",
};

function segmentChartColor(name: string, index: number): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(SEGMENT_COLOR_MAP)) {
    if (lower.includes(key)) return color;
  }
  return REVENUE_MIX_COLORS[index % REVENUE_MIX_COLORS.length];
}

function marginBarColor(marginPct: number): string {
  if (marginPct >= 25) return "#22c55e";
  if (marginPct >= 18) return "#1e3a5f";
  if (marginPct >= 14) return "#f59e0b";
  return "#f59e0b";
}

function normalizeBreakdownRow(raw: unknown, options?: { amountsInCr?: boolean }): BreakdownRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const amountsInCr = options?.amountsInCr ?? false;
  const revenueRaw = safeNumber(row.revenue ?? row.revenue_cr ?? row.gross_revenue);
  const costRaw = safeNumber(row.cost ?? row.cost_cr ?? row.direct_cost);
  const grossProfitRaw = safeNumber(
    row.gross_profit ?? row.grossProfit ?? row.profit ?? revenueRaw - costRaw,
  );
  const revenue = amountsInCr ? revenueRaw : toCr(revenueRaw);
  const cost = amountsInCr ? costRaw : toCr(costRaw);
  const grossProfit = amountsInCr ? grossProfitRaw : toCr(grossProfitRaw);
  const marginPct = safeNumber(
    row.margin_pct ?? row.marginPct ?? row.margin ?? row.gp_margin_pct,
    revenue > 0 ? (grossProfit / revenue) * 100 : 0,
  );
  const yoyRaw = row.yoy_change_pct ?? row.yoy_pct ?? row.yoyPct ?? row.yoy;
  const yoyHasData = yoyRaw != null && yoyRaw !== "";
  const yoyPct = yoyHasData ? safeNumber(yoyRaw) : 0;
  const nextDrill = (row.next_drill_down ?? row.nextDrillDown ?? {}) as Record<string, unknown>;
  return {
    id: firstString(row.id, row.code, row.customer_code, row.customerCode) || undefined,
    name: firstString(row.label, row.name, row.dimension, row.segment, row.customer_name),
    subtitle: firstString(row.mix_label, row.subtitle, row.sub, row.meta),
    code:
      firstString(row.code, row.customer_code, row.customerCode, row.branch_code, row.branchCode) ||
      undefined,
    branchVariant:
      firstString(row.branch_variant, row.branchVariant).toLowerCase() || undefined,
    dotColor: firstString(row.dot_color, row.dotColor) || undefined,
    revenue,
    cost,
    grossProfit,
    marginPct,
    marginTone: marginTone(row.margin_tone ?? row.marginTone ?? marginPct),
    yoyPct,
    yoyHasData,
    yoyDirection: trendDirection(
      row.direction ?? row.yoy_direction ?? row.yoyDirection ?? (yoyHasData ? yoyPct : undefined),
    ),
    yoyLabel: firstString(row.yoy_label, row.yoyLabel) || undefined,
    originCode: firstString(row.origin_code, row.originCode) || undefined,
    destinationCode: firstString(row.destination_code, row.destinationCode) || undefined,
    service:
      firstString(row.service, nextDrill.service, row.mode_label, row.modeLabel) || undefined,
    customerCode:
      firstString(row.customer_code, row.customerCode, nextDrill.customer_code) || undefined,
    drillBranchCode:
      firstString(row.branch_code, row.branchCode, nextDrill.branch_code) || undefined,
    salespersonName:
      firstString(row.salesperson_name, row.salespersonName, nextDrill.salesperson_name) ||
      undefined,
  };
}

function attachKpiSparklines(kpis: AccountsKpi[], monthlyPoints: MonthlyTrendPoint[]): AccountsKpi[] {
  if (monthlyPoints.length < 2) return kpis;
  const revenueSpark = monthlyPoints.map((p) => p.revenue);
  const costSpark = monthlyPoints.map((p) => Math.max(0, p.revenue - p.grossProfit));
  const profitSpark = monthlyPoints.map((p) => p.grossProfit);
  const marginSpark = monthlyPoints.map((p) => p.marginPct);

  return kpis.map((kpi) => {
    if (kpi.key === "gross_revenue") {
      return { ...kpi, sparkline: revenueSpark, sparklineColor: "#16a34a" };
    }
    if (kpi.key === "direct_costs") {
      return { ...kpi, sparkline: costSpark, sparklineColor: "#94a3b8" };
    }
    if (kpi.key === "gross_profit" || kpi.key === "net_profit") {
      return { ...kpi, sparkline: profitSpark, sparklineColor: "#16a34a" };
    }
    if (kpi.key === "gp_margin") {
      return { ...kpi, sparkline: marginSpark, sparklineColor: "#0ea5e9" };
    }
    return kpi;
  });
}

function normalizeProfitabilityKpis(
  kpisRaw: Record<string, unknown>,
  changeRaw: Record<string, unknown>,
): AccountsKpi[] {
  const directionRaw = (changeRaw.direction ?? {}) as Record<string, unknown>;
  const revenueTrend = formatChangeWithDirection(
    changeRaw.gross_revenue_pct,
    directionRaw.gross_revenue,
  );
  const costTrend = formatChangeWithDirection(
    changeRaw.direct_cost_pct,
    directionRaw.direct_cost,
  );
  const profitTrend = formatChangeWithDirection(
    changeRaw.gross_profit_pct,
    directionRaw.gross_profit,
  );
  const marginTrend = formatChangePpWithDirection(
    changeRaw.gp_margin_pp,
    directionRaw.gp_margin,
  );

  return [
    {
      key: "gross_revenue",
      label: "Gross Revenue",
      value: toCr(kpisRaw.gross_revenue),
      unit: "Cr",
      showCurrency: true,
      trend: { ...revenueTrend, context: "vs. last period" },
    },
    {
      key: "direct_costs",
      label: "Direct Costs",
      value: toCr(kpisRaw.direct_cost),
      unit: "Cr",
      showCurrency: true,
      trend: { ...costTrend, context: "vs. last period" },
    },
    {
      key: "gross_profit",
      label: "Gross Profit",
      value: toCr(kpisRaw.gross_profit),
      unit: "Cr",
      showCurrency: true,
      trend: { ...profitTrend, context: "vs. last period" },
    },
    {
      key: "gp_margin",
      label: "GP Margin",
      value: safeNumber(kpisRaw.gp_margin_pct),
      unit: "%",
      isPercent: true,
      trend: { ...marginTrend, context: "vs. last period" },
    },
    {
      key: "cbm",
      label: "CBM",
      value: safeNumber(kpisRaw.cbm),
      unit: "",
      isPercent: false,
    },
    {
      key: "teu",
      label: "TEU",
      value: safeNumber(kpisRaw.teu),
      unit: "",
      isPercent: false,
    },
    {
      key: "weight",
      label: "Weight",
      value: safeNumber(kpisRaw.weight),
      unit: "",
      isPercent: false,
    },
  ];
}

function profitBreakdownToMixAndMargin(
  rows: BreakdownRow[],
  rowsRaw?: unknown[],
): {
  revenueMix: { total: number; totalUnit: string; items: RevenueMixItem[] };
  marginBySegment: { benchmarkPct: number; items: MarginBySegmentItem[] };
} {
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const items: RevenueMixItem[] = rows.map((row, i) => {
    const raw = (rowsRaw?.[i] ?? {}) as Record<string, unknown>;
    const pctFromApi = raw.mix_pct ?? raw.pct ?? raw.percent;
    return {
      name: row.name,
      value: row.revenue,
      pct:
        pctFromApi != null && pctFromApi !== ""
          ? safeNumber(pctFromApi)
          : total > 0
            ? Math.round((row.revenue / total) * 1000) / 10
            : 0,
      color: segmentChartColor(row.name, i),
    };
  });
  const marginItems: MarginBySegmentItem[] = rows.map((row, i) => ({
    name: row.name,
    marginPct: row.marginPct,
    color: marginBarColor(row.marginPct) || segmentChartColor(row.name, i),
  }));
  const margins = marginItems.map((m) => m.marginPct).filter((m) => m > 0);
  const benchmarkPct =
    margins.length > 0
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 21.5;

  return {
    revenueMix: { total, totalUnit: "Cr", items },
    marginBySegment: { benchmarkPct, items: marginItems },
  };
}

function normalizeDimensionKey(value: unknown): BreakdownDimension | null {
  const key = firstString(value).toLowerCase();
  if (key === "segment" || key === "branch" || key === "customer" || key === "tradelane" || key === "salesperson") {
    return key;
  }
  return null;
}

export function unwrapProfitabilityPayload(raw: unknown): Record<string, unknown> {
  const root = (raw ?? {}) as Record<string, unknown>;
  if (
    root.kpis != null ||
    root.profit_breakdown != null ||
    root.profitBreakdown != null ||
    root.monthly_trend != null ||
    root.monthlyTrend != null
  ) {
    return root;
  }
  const nested = (root.data ?? root.result) as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested;
  }
  return root;
}

export function normalizeAccountsDashboard(
  raw: unknown,
  activeDimension: BreakdownDimension = "segment",
): AccountsDashboardData {
  const data = unwrapProfitabilityPayload(raw);

  const filtersRaw = (data.filters ?? {}) as Record<string, unknown>;
  const metaRaw = (data.meta ?? data.header ?? {}) as Record<string, unknown>;
  const previousPeriod = (data.previous_period ?? {}) as Record<string, unknown>;
  const changeRaw = (previousPeriod.change ?? {}) as Record<string, unknown>;

  const kpisObject =
    data.kpis && typeof data.kpis === "object" && !Array.isArray(data.kpis)
      ? (data.kpis as Record<string, unknown>)
      : null;
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
  if (byDimensionRaw && typeof byDimensionRaw === "object" && !Array.isArray(byDimensionRaw)) {
    for (const [key, value] of Object.entries(byDimensionRaw)) {
      const dim = normalizeDimensionKey(key);
      if (!dim) continue;
      const block = (value ?? {}) as Record<string, unknown>;
      const rowsRaw = Array.isArray(block.rows) ? block.rows : Array.isArray(value) ? (value as unknown[]) : [];
      const rows = rowsRaw.map((r) => normalizeBreakdownRow(r)).filter((r) => r.name);
      const totalRaw = block.total ?? block.totals;
      byDimension[dim] = {
        rows,
        total: totalRaw
          ? normalizeBreakdownRow({
              ...((totalRaw as Record<string, unknown>) ?? {}),
              name: firstString((totalRaw as Record<string, unknown>).name, "Total"),
            })
          : rows.length
            ? normalizeBreakdownRow({
                name: `Total · all ${dim}s`,
                revenue: rows.reduce((s, r) => s + r.revenue, 0),
                cost: rows.reduce((s, r) => s + r.cost, 0),
                grossProfit: rows.reduce((s, r) => s + r.grossProfit, 0),
                marginPct:
                  rows.reduce((s, r) => s + r.revenue, 0) > 0
                    ? (rows.reduce((s, r) => s + r.grossProfit, 0) /
                        rows.reduce((s, r) => s + r.revenue, 0)) *
                      100
                    : 0,
                yoyPct: 0,
              })
            : normalizeBreakdownRow({ name: "Total" }),
      };
    }
  }

  const profitRowsRaw = Array.isArray(breakdownRoot.rows) ? breakdownRoot.rows : [];
  if (profitRowsRaw.length) {
    const rows = profitRowsRaw.map((r) => normalizeBreakdownRow(r)).filter((r) => r.name);
    const totalsRaw = (breakdownRoot.totals ?? breakdownRoot.total ?? {}) as Record<string, unknown>;
    const total = normalizeBreakdownRow({
      ...totalsRaw,
      label: firstString(totalsRaw.label, `Total · all ${activeDimension}s`),
      name: firstString(totalsRaw.label, totalsRaw.name, `Total · all ${activeDimension}s`),
      subtitle: firstString(totalsRaw.summary, totalsRaw.subtitle),
      revenue: totalsRaw.gross_revenue ?? totalsRaw.revenue,
      cost: totalsRaw.direct_cost ?? totalsRaw.cost,
      gross_profit: totalsRaw.gross_profit,
      margin_pct: totalsRaw.gp_margin_pct ?? totalsRaw.margin_pct,
    });
    byDimension[activeDimension] = { rows, total };
  }

  const monthlyRaw = (data.monthly_trend ?? data.monthlyTrend ?? {}) as Record<string, unknown>;
  const monthlyPointsRaw = Array.isArray(monthlyRaw.rows)
    ? monthlyRaw.rows
    : Array.isArray(monthlyRaw.points)
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

  const profitBreakdownRows = byDimension[activeDimension]?.rows ?? [];
  const mixFromProfitRows =
    profitRowsRaw.length > 0
      ? profitBreakdownToMixAndMargin(
          profitRowsRaw.map((r) => normalizeBreakdownRow(r)).filter((r) => r.name),
          profitRowsRaw,
        )
      : profitBreakdownRows.length > 0
        ? profitBreakdownToMixAndMargin(profitBreakdownRows)
        : null;

  const dateFrom = firstString(filtersRaw.date_from, metaRaw.date_from);
  const dateTo = firstString(filtersRaw.date_to, metaRaw.date_to);
  const currencyCode =
    firstString(data.currency_code, filtersRaw.currency_code, metaRaw.currency_code) || "INR";
  const periodLabel =
    dateFrom && dateTo
      ? `${dateFrom} – ${dateTo}`
      : firstString(metaRaw.period_label, metaRaw.periodLabel, data.period_label);

  const monthlyPoints: MonthlyTrendPoint[] = monthlyPointsRaw.length
    ? monthlyPointsRaw.map((point) => {
        const row = (point ?? {}) as Record<string, unknown>;
        return {
          month: firstString(row.label, row.month),
          revenue: toCr(row.gross_revenue ?? row.revenue ?? row.revenue_cr),
          grossProfit: toCr(row.gross_profit ?? row.grossProfit ?? row.profit),
          marginPct: safeNumber(row.margin_pct ?? row.marginPct ?? row.margin),
        } satisfies MonthlyTrendPoint;
      })
    : [];

  const baseKpis = kpisObject
    ? normalizeProfitabilityKpis(kpisObject, changeRaw)
    : kpisRaw.length
      ? kpisRaw.map(normalizeKpi)
      : [];

  const normalized: AccountsDashboardData = {
    currencyCode,
    meta: {
      title: firstString(metaRaw.title, data.title, breakdownRoot.title, "Profitability"),
      subtitle: firstString(
        metaRaw.subtitle,
        metaRaw.sub,
        data.subtitle,
        filtersRaw.company,
        "CFO view · All branches",
      ),
      periodLabel,
      updatedAgo: firstString(metaRaw.updated_ago, metaRaw.updatedAgo, data.updated_ago),
      fyLabel: firstString(metaRaw.fy_label, metaRaw.fyLabel, data.fy_label),
      breakdownSubtitle: firstString(
        breakdownRoot.subtitle,
        "Revenue · Cost · Gross Profit · Margin %",
      ),
    },
    kpis: attachKpiSparklines(baseKpis, monthlyPoints),
    breakdown: {
      dimensions: ALL_BREAKDOWN_DIMENSIONS,
      activeDimension,
      byDimension: Object.keys(byDimension).length ? byDimension : {},
    },
    monthlyTrend: {
      fyLabel: firstString(
        monthlyRaw.subtitle,
        monthlyRaw.fy_label,
        monthlyRaw.fyLabel,
        monthlyRaw.title,
        `FY · ${currencyCode} Cr`,
      ),
      points: monthlyPoints,
    },
    revenueMix: mixFromProfitRows
      ? mixFromProfitRows.revenueMix
      : mixItemsRaw.length
          ? {
              total: safeNumber(revenueMixRaw.total ?? revenueMixRaw.total_cr),
              totalUnit: firstString(revenueMixRaw.total_unit, revenueMixRaw.totalUnit, "Cr"),
              items: mixItemsRaw.map((item, i) => {
                const row = (item ?? {}) as Record<string, unknown>;
                return {
                  name: firstString(row.name, row.segment, row.label),
                  value: toCr(row.value ?? row.revenue ?? row.amount),
                  pct: safeNumber(row.pct ?? row.percent ?? row.share ?? row.mix_pct),
                  color: firstString(row.color, REVENUE_MIX_COLORS[i % REVENUE_MIX_COLORS.length]),
                } satisfies RevenueMixItem;
              }),
            }
          : { total: 0, totalUnit: "Cr", items: [] },
    marginBySegment: mixFromProfitRows
      ? mixFromProfitRows.marginBySegment
      : marginItemsRaw.length
          ? {
              benchmarkPct: safeNumber(marginRaw.benchmark_pct ?? marginRaw.benchmarkPct, 21.5),
              items: marginItemsRaw.map((item, i) => {
                const row = (item ?? {}) as Record<string, unknown>;
                return {
                  name: firstString(row.name, row.segment, row.label),
                  marginPct: safeNumber(row.margin_pct ?? row.marginPct ?? row.margin),
                  color: firstString(row.color, REVENUE_MIX_COLORS[i % REVENUE_MIX_COLORS.length]) || undefined,
                } satisfies MarginBySegmentItem;
              }),
            }
          : { benchmarkPct: 0, items: [] },
    filterOptions: data.filter_options as AccountsDashboardData["filterOptions"],
  };

  return normalized;
}

/** Request flags for profitability breakdown dimension (segment uses default view). */
export function profitabilityDimensionFlags(
  dimension: BreakdownDimension,
): Partial<Record<"branch" | "tradelane" | "salesperson" | "customer", boolean>> {
  switch (dimension) {
    case "branch":
      return { branch: true };
    case "tradelane":
      return { tradelane: true };
    case "salesperson":
      return { salesperson: true };
    case "customer":
      return { customer: true };
    default:
      return {};
  }
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

/** Format a value stored in crores as X.XX Cr or X.X L (reference dashboard style). */
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
