export type TrendDirection = "up" | "down" | "flat";

export type AccountsKpi = {
  key: string;
  label: string;
  value: number;
  unit: string;
  isPercent?: boolean;
  showCurrency?: boolean;
  trend: {
    direction: TrendDirection;
    text: string;
    context?: string;
  };
  sparkline?: number[];
  sparklineColor?: string;
};

export type BreakdownRow = {
  id?: string;
  name: string;
  subtitle?: string;
  /** Branch / location code shown in chip (e.g. MUM). */
  code?: string;
  /** Branch chip variant for dot color (mum, del, blr, maa, ccu, amd). */
  branchVariant?: string;
  dotColor?: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number;
  marginTone?: "good" | "warn" | "bad" | "neutral";
  yoyPct: number;
  yoyDirection?: TrendDirection;
  /** When set, shows e.g. "▼ New" instead of a percentage. */
  yoyLabel?: string;
};

export type BreakdownDimension = "segment" | "branch" | "customer" | "tradelane" | "salesperson";

export type RevenueMixItem = {
  name: string;
  value: number;
  pct: number;
  color: string;
};

export type MarginBySegmentItem = {
  name: string;
  marginPct: number;
  color?: string;
};

export type MonthlyTrendPoint = {
  month: string;
  revenue: number;
  grossProfit: number;
  marginPct: number;
};

export type AccountsDashboardData = {
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
    updatedAgo: string;
    fyLabel?: string;
  };
  kpis: AccountsKpi[];
  breakdown: {
    dimensions: BreakdownDimension[];
    activeDimension?: BreakdownDimension;
    byDimension: Partial<
      Record<
        BreakdownDimension,
        {
          rows: BreakdownRow[];
          total: BreakdownRow;
        }
      >
    >;
  };
  monthlyTrend: {
    fyLabel: string;
    points: MonthlyTrendPoint[];
  };
  revenueMix: {
    total: number;
    totalUnit: string;
    items: RevenueMixItem[];
  };
  marginBySegment: {
    benchmarkPct?: number;
    items: MarginBySegmentItem[];
  };
  filterOptions?: {
    periods?: { value: string; label: string }[];
    branches?: { value: string; label: string }[];
    modes?: { value: string; label: string }[];
  };
};
