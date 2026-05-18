import type { TrendDirection } from "../accountsDashboardTypes";

export type CollectionBarTone = "over" | "under" | "neutral";

export type CollectionKpi = {
  label: string;
  value: number;
  unit?: string;
  showCurrency?: boolean;
  context?: string;
  trendText?: string;
  trendDirection?: TrendDirection;
};

export type MonthlyStatItem = {
  label: string;
  value: string;
  detail?: string;
  detailTone?: "up" | "down" | "neutral";
};

export type DailyCollectionPoint = {
  day: number | string;
  amount: number;
};

export type BranchCollectionRow = {
  id?: string;
  branchName: string;
  branchCode?: string;
  branchVariant?: string;
  /** City label inside branch chip (e.g. Mumbai); falls back to variant map. */
  branchChipLabel?: string;
  subtitle?: string;
  exposureLabel?: string;
  exposureTone?: "bad" | "warn";
  target: number;
  collected: number;
  barCollectedWidthPct: number;
  markerLeftPct: number;
  barTone?: CollectionBarTone;
  gap: number;
  gapDisplay?: string;
  gapDirection?: "pos" | "neg";
  achievementPct: number;
};

export type CollectionTargetVsPerformanceData = {
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
  };
  kpis: CollectionKpi[];
  thisMonth: {
    title: string;
    subtitle: string;
    gaugePct: number;
    stats: MonthlyStatItem[];
  };
  dailyCollection: {
    title: string;
    subtitle: string;
    runRateNeed: number;
    runRateLabel?: string;
    points: DailyCollectionPoint[];
  };
  branchPerformance: {
    rows: BranchCollectionRow[];
    total: BranchCollectionRow;
  };
  filterOptions?: {
    periods?: { value: string; label: string }[];
    branches?: { value: string; label: string }[];
    currencies?: { value: string; label: string }[];
  };
};
