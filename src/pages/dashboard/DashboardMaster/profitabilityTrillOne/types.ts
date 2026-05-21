import type { BreakdownDimension, BreakdownRow } from "../accountsDashboardTypes";

export type ProfitabilityJobSegment =
  | "ocean-fcl"
  | "ocean-lcl"
  | "air"
  | "customs"
  | "road"
  | "warehousing";

export type ProfitabilityJob = {
  id: string;
  customer: string;
  segment: ProfitabilityJobSegment;
  branch: string;
  lane: string;
  rep: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number | null;
  currencyCode: string;
  delivered: string;
};

export type ProfitabilityDrillContext = {
  dimension: BreakdownDimension;
  row: BreakdownRow;
  periodLabel?: string;
  categoryBenchmarkPct?: number;
};

export type ProfitabilityDrillSummary = {
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number;
  avgMarginPct: number;
  jobCount: number;
  currencyCode: string;
  gpTrendText?: string;
  gpTrendUp?: boolean;
};
