import dayjs from "dayjs";
import type { SalespersonMonthlyBudgetItem } from "../../../service/dashboard.service";
import { BRANCH_BUDGET_VS_ACTUAL_MOCK } from "./branchBudgetVsActualMock";

export type BranchMonthlyMockResult = {
  rows: SalespersonMonthlyBudgetItem[];
  summary: {
    totalActualBudget: number;
    totalSalesBudget: number;
    currency: string;
  };
};

const CR = 10_000_000;

const BRANCH_META: Record<
  string,
  { tradeType: string; serviceType: string }
> = {
  MUM: { tradeType: "Export", serviceType: "Ocean FCL" },
  DEL: { tradeType: "Import", serviceType: "Air" },
  BLR: { tradeType: "Export", serviceType: "Air" },
  MAA: { tradeType: "Export", serviceType: "Ocean FCL" },
  AMD: { tradeType: "Import", serviceType: "Road" },
  CCU: { tradeType: "Export", serviceType: "Ocean LCL" },
};

const DEFAULT_META = { tradeType: "Export", serviceType: "Ocean FCL" };

function resolveBranchKey(branchName: string, branchCode?: string): string {
  if (branchCode) return branchCode.toUpperCase();
  const match = branchName.match(/\(([^)]+)\)/);
  if (match) return match[1].trim().toUpperCase();
  return branchName.split(" ")[0]?.toUpperCase() || "MUM";
}

function findBranchYtd(branchName: string, branchCode?: string) {
  const key = resolveBranchKey(branchName, branchCode);
  const row = BRANCH_BUDGET_VS_ACTUAL_MOCK.branchPerformance.rows.find((r) => {
    const rowKey = resolveBranchKey(r.name);
    return rowKey === key || r.name.toLowerCase().includes(branchName.toLowerCase());
  });
  return row ?? BRANCH_BUDGET_VS_ACTUAL_MOCK.branchPerformance.rows[0];
}

function monthsBetween(startMonth: string, endMonth: string): string[] {
  const start = dayjs(`${startMonth}-01`);
  const end = dayjs(`${endMonth}-01`);
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return [
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
    ];
  }
  const months: string[] = [];
  let cursor = start;
  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    months.push(cursor.format("YYYY-MM"));
    cursor = cursor.add(1, "month");
  }
  return months.length ? months : [start.format("YYYY-MM")];
}

/** Demo month-wise budget vs actual until branch-budget-vs-actual supports drill_down. */
export function getBranchMonthlyBudgetMock(params: {
  branchName: string;
  branchCode?: string;
  startMonth: string;
  endMonth: string;
}): BranchMonthlyMockResult {
  const key = resolveBranchKey(params.branchName, params.branchCode);
  const meta = BRANCH_META[key] ?? DEFAULT_META;
  const branchRow = findBranchYtd(params.branchName, params.branchCode);

  const ytdBudgetInr = Math.round(branchRow.budget * CR);
  const ytdActualInr = Math.round(branchRow.actual * CR);

  const months = monthsBetween(params.startMonth, params.endMonth);
  const seasonal = BRANCH_BUDGET_VS_ACTUAL_MOCK.monthlyRunRate.points.map((p) => p.budget);
  const weightTotal = seasonal.reduce((sum, w) => sum + w, 0) || 1;

  const rows: SalespersonMonthlyBudgetItem[] = months.map((month, index) => {
    const weight = seasonal[index % seasonal.length] / weightTotal;
    const sales_budget = Math.round(ytdBudgetInr * weight);
    const actual_budget = Math.round(ytdActualInr * weight);
    return {
      sno: index + 1,
      month,
      actual_budget,
      sales_budget,
      currency: "INR",
      trade_type: meta.tradeType,
      service_type: meta.serviceType,
      incentive_percentage: 0,
      incentive_amount: actual_budget - sales_budget,
    };
  });

  const totalSalesBudget = rows.reduce((sum, r) => sum + r.sales_budget, 0);
  const totalActualBudget = rows.reduce((sum, r) => sum + r.actual_budget, 0);

  const budgetDelta = ytdBudgetInr - totalSalesBudget;
  const actualDelta = ytdActualInr - totalActualBudget;
  if (rows.length > 0) {
    rows[rows.length - 1].sales_budget += budgetDelta;
    rows[rows.length - 1].actual_budget += actualDelta;
    rows[rows.length - 1].incentive_amount =
      rows[rows.length - 1].actual_budget - rows[rows.length - 1].sales_budget;
  }

  return {
    rows,
    summary: {
      totalActualBudget: ytdActualInr,
      totalSalesBudget: ytdBudgetInr,
      currency: "INR",
    },
  };
}
