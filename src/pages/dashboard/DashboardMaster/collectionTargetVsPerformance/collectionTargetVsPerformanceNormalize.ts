import type {
  BranchCollectionRow,
  CollectionBarTone,
  CollectionKpi,
  CollectionTargetVsPerformanceData,
  DailyCollectionPoint,
  MonthlyStatItem,
} from "./collectionTargetVsPerformanceTypes";
import type { TrendDirection } from "../accountsDashboardTypes";
import { COLLECTION_TARGET_VS_PERFORMANCE_MOCK } from "./collectionTargetVsPerformanceMock";

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

function barTone(value: unknown, achievementPct?: number): CollectionBarTone {
  const v = firstString(value).toLowerCase();
  if (v === "over" || v === "under" || v === "neutral") return v;
  const pct = achievementPct ?? safeNumber(value);
  if (pct >= 98) return "over";
  if (pct < 85) return "under";
  return "neutral";
}

function formatGap(valueInCr: number, display?: string): string {
  if (display) return display;
  const sign = valueInCr >= 0 ? "+" : "−";
  const abs = Math.abs(valueInCr);
  if (abs >= 1) return `${sign}₹${abs.toFixed(2)} Cr`;
  return `${sign}₹${(abs * 100).toFixed(0)} L`;
}

function normalizeKpi(raw: unknown, index: number): CollectionKpi {
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

function normalizeBranchRow(raw: unknown): BranchCollectionRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  const target = safeNumber(row.target ?? row.target_cr);
  const collected = safeNumber(row.collected ?? row.collected_cr);
  const achievementPct = safeNumber(
    row.achievement_pct ?? row.achievementPct,
    target > 0 ? (collected / target) * 100 : 0,
  );
  const gap = safeNumber(row.gap ?? row.gap_cr, collected - target);
  const gapDirection =
    firstString(row.gap_direction, row.gapDirection).toLowerCase() === "pos" || gap >= 0
      ? "pos"
      : "neg";

  return {
    id: firstString(row.id, row.code) || undefined,
    branchName: firstString(row.branch_name, row.branchName, row.name),
    branchCode: firstString(row.branch_code, row.branchCode, row.code) || undefined,
    branchVariant:
      firstString(row.branch_variant, row.branchVariant).toLowerCase() || undefined,
    branchChipLabel:
      firstString(row.branch_chip_label, row.branchChipLabel, row.city) || undefined,
    subtitle: firstString(row.subtitle, row.sub, row.meta),
    exposureLabel: firstString(row.exposure_label, row.exposureLabel) || undefined,
    exposureTone:
      firstString(row.exposure_tone, row.exposureTone).toLowerCase() === "warn"
        ? "warn"
        : firstString(row.exposure_tone, row.exposureTone).toLowerCase() === "bad"
          ? "bad"
          : undefined,
    target,
    collected,
    barCollectedWidthPct: safeNumber(
      row.bar_collected_width_pct ?? row.barCollectedWidthPct,
      achievementPct,
    ),
    markerLeftPct: safeNumber(row.marker_left_pct ?? row.markerLeftPct, 100),
    barTone: barTone(row.bar_tone ?? row.barTone, achievementPct),
    gap,
    gapDisplay: firstString(row.gap_display, row.gapDisplay) || formatGap(gap),
    gapDirection: gapDirection as "pos" | "neg",
    achievementPct,
  };
}

export function normalizeCollectionTargetVsPerformance(
  raw: unknown,
): CollectionTargetVsPerformanceData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = ((root.data ?? root.result ?? root) ?? {}) as Record<string, unknown>;

  const metaRaw = (data.meta ?? data.header ?? {}) as Record<string, unknown>;
  const kpisRaw = Array.isArray(data.kpis) ? data.kpis : Array.isArray(data.summary) ? data.summary : [];

  const monthRaw = (data.this_month ?? data.thisMonth ?? {}) as Record<string, unknown>;
  const statsRaw = Array.isArray(monthRaw.stats) ? monthRaw.stats : [];

  const dailyRaw = (data.daily_collection ?? data.dailyCollection ?? {}) as Record<string, unknown>;
  const dailyPointsRaw = Array.isArray(dailyRaw.points)
    ? dailyRaw.points
    : Array.isArray(dailyRaw.days)
      ? dailyRaw.days
      : [];

  const branchRaw = (data.branch_performance ?? data.branchPerformance ?? {}) as Record<
    string,
    unknown
  >;
  const rowsRaw = Array.isArray(branchRaw.rows)
    ? branchRaw.rows
    : Array.isArray(data.branches)
      ? data.branches
      : [];

  const rows = rowsRaw.map(normalizeBranchRow).filter((r) => r.branchName);
  const totalRaw = branchRaw.total ?? branchRaw.totals;

  return {
    meta: {
      title: firstString(metaRaw.title, data.title, "Collection Target vs Performance"),
      subtitle: firstString(metaRaw.subtitle, metaRaw.sub, data.subtitle),
      periodLabel: firstString(metaRaw.period_label, metaRaw.periodLabel, "FY YTD"),
    },
    kpis: kpisRaw.length ? kpisRaw.map(normalizeKpi) : COLLECTION_TARGET_VS_PERFORMANCE_MOCK.kpis,
    thisMonth: {
      title: firstString(monthRaw.title, "This Month"),
      subtitle: firstString(monthRaw.subtitle, monthRaw.sub),
      gaugePct: safeNumber(
        monthRaw.gauge_pct ?? monthRaw.gaugePct,
        COLLECTION_TARGET_VS_PERFORMANCE_MOCK.thisMonth.gaugePct,
      ),
      stats: statsRaw.length
        ? statsRaw.map((item) => {
            const row = (item ?? {}) as Record<string, unknown>;
            const toneRaw = firstString(row.detail_tone, row.detailTone).toLowerCase();
            return {
              label: firstString(row.label),
              value: firstString(row.value),
              detail: firstString(row.detail, row.sub),
              detailTone:
                toneRaw === "up" || toneRaw === "down"
                  ? (toneRaw as MonthlyStatItem["detailTone"])
                  : undefined,
            } satisfies MonthlyStatItem;
          })
        : COLLECTION_TARGET_VS_PERFORMANCE_MOCK.thisMonth.stats,
    },
    dailyCollection: {
      title: firstString(dailyRaw.title, "Daily Collection"),
      subtitle: firstString(dailyRaw.subtitle, dailyRaw.sub),
      runRateNeed: safeNumber(
        dailyRaw.run_rate_need ?? dailyRaw.runRateNeed,
        COLLECTION_TARGET_VS_PERFORMANCE_MOCK.dailyCollection.runRateNeed,
      ),
      runRateLabel: firstString(dailyRaw.run_rate_label, dailyRaw.runRateLabel),
      points: dailyPointsRaw.length
        ? dailyPointsRaw.map((point) => {
            const row = (point ?? {}) as Record<string, unknown>;
            return {
              day: safeNumber(row.day, row.label) || firstString(row.day, row.label),
              amount: safeNumber(row.amount ?? row.value ?? row.collection),
            } satisfies DailyCollectionPoint;
          })
        : COLLECTION_TARGET_VS_PERFORMANCE_MOCK.dailyCollection.points,
    },
    branchPerformance: {
      rows: rows.length ? rows : COLLECTION_TARGET_VS_PERFORMANCE_MOCK.branchPerformance.rows,
      total: totalRaw
        ? normalizeBranchRow({
            ...((totalRaw as Record<string, unknown>) ?? {}),
            branch_name: "All Branches",
          })
        : rows.length
          ? normalizeBranchRow({
              branch_name: "All Branches",
              target: rows.reduce((s, r) => s + r.target, 0),
              collected: rows.reduce((s, r) => s + r.collected, 0),
              barCollectedWidthPct: 53,
              markerLeftPct: 57,
              achievementPct:
                rows.reduce((s, r) => s + r.target, 0) > 0
                  ? (rows.reduce((s, r) => s + r.collected, 0) /
                      rows.reduce((s, r) => s + r.target, 0)) *
                    100
                  : 0,
              gap:
                rows.reduce((s, r) => s + r.collected, 0) -
                rows.reduce((s, r) => s + r.target, 0),
            })
          : COLLECTION_TARGET_VS_PERFORMANCE_MOCK.branchPerformance.total,
    },
    filterOptions: data.filter_options as CollectionTargetVsPerformanceData["filterOptions"],
  };
}
