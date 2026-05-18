import type { TrendDirection } from "./accountsDashboardTypes";

export type BvaMetricTab = "revenue" | "gross_profit" | "volume";

export type BvaBarTone = "over" | "under" | "neutral";

export type BranchBvaRow = {
  id?: string;
  name: string;
  subtitle?: string;
  watchLabel?: string;
  budget: number;
  actual: number;
  barActualWidthPct: number;
  markerLeftPct: number;
  barTone?: BvaBarTone;
  variance: number;
  varianceDisplay?: string;
  varianceDirection?: "pos" | "neg";
  achievementPct: number;
};

export type BvaKpi = {
  label: string;
  value: number;
  unit?: string;
  showCurrency?: boolean;
  context?: string;
  trendText?: string;
  trendDirection?: TrendDirection;
};

export type MonthlyRunRatePoint = {
  month: string;
  budget: number;
  actual: number;
  isForecast?: boolean;
};

export type ModeBvaItem = {
  name: string;
  actual: number;
  budget: number;
  barWidthPct: number;
  targetLeftPct: number;
  tone?: "good" | "warn" | "neutral";
};

export type VarianceCallout = {
  amount: string;
  tone: "good" | "bad";
  text: string;
};

export type BranchBudgetVsActualData = {
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
    fyLabel?: string;
  };
  kpis: BvaKpi[];
  branchPerformance: {
    rows: BranchBvaRow[];
    total: BranchBvaRow;
  };
  monthlyRunRate: {
    fyLabel: string;
    points: MonthlyRunRatePoint[];
  };
  byMode: {
    items: ModeBvaItem[];
  };
  varianceCallouts: VarianceCallout[];
  filterOptions?: {
    periods?: { value: string; label: string }[];
    groupBy?: { value: string; label: string }[];
    metrics?: { value: string; label: string }[];
  };
};
