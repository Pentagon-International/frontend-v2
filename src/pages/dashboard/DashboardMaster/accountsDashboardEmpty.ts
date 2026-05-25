import type { BreakdownDimension } from "./accountsDashboardTypes";

export const ALL_BREAKDOWN_DIMENSIONS: BreakdownDimension[] = [
  "segment",
  "branch",
  "customer",
  "tradelane",
  "salesperson",
];

export const EMPTY_BREAKDOWN_TOTAL = {
  name: "Total",
  revenue: 0,
  cost: 0,
  grossProfit: 0,
  marginPct: 0,
  yoyPct: 0,
};
