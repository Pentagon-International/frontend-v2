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
  revenueL: number;
  costL: number;
  delivered: string;
};

export type ProfitabilityDrillContext = {
  dimension: BreakdownDimension;
  row: BreakdownRow;
  periodLabel?: string;
  categoryBenchmarkPct?: number;
};

export type ProfitabilityDrillSummary = {
  revenueL: number;
  costL: number;
  grossProfitL: number;
  marginPct: number;
  avgMarginPct: number;
  jobCount: number;
  gpTrendText?: string;
  gpTrendUp?: boolean;
};
