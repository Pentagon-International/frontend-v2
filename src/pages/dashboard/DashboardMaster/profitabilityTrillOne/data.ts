import type { BreakdownDimension, BreakdownRow } from "../accountsDashboardTypes";
import { LANE_LABELS, REP_LABELS, SEGMENT_LABELS } from "./constants";
import type { ProfitabilityDrillContext, ProfitabilityDrillSummary, ProfitabilityJob } from "./types";

type RawJob = {
  id: string;
  cust: string;
  seg: ProfitabilityJob["segment"];
  branch: string;
  lane: string;
  rep: string;
  rev: number;
  cost: number;
  delivered: string;
};

const RAW_JOBS: RawJob[] = [
  { id: "JOB-26-04188", cust: "Reliance Industries", seg: "ocean-fcl", branch: "mum", lane: "jnpt-ham", rep: "sharma", rev: 14.2, cost: 11.2, delivered: "2 Apr 2026" },
  { id: "JOB-26-04172", cust: "Tata Steel Ltd.", seg: "ocean-fcl", branch: "mum", lane: "mun-jeb", rep: "sharma", rev: 12.8, cost: 10.1, delivered: "5 Apr 2026" },
  { id: "JOB-26-04165", cust: "Maruti Suzuki India", seg: "air", branch: "del", lane: "del-fra", rep: "kapoor", rev: 9.6, cost: 6.7, delivered: "9 Apr 2026" },
  { id: "JOB-26-04158", cust: "Asian Paints Ltd.", seg: "ocean-lcl", branch: "mum", lane: "mun-jeb", rep: "kapoor", rev: 7.2, cost: 5.65, delivered: "11 Apr 2026" },
  { id: "JOB-26-04151", cust: "Wipro Consumer Care", seg: "air", branch: "blr", lane: "blr-lhr", rep: "menon", rev: 6.4, cost: 4.5, delivered: "12 Apr 2026" },
  { id: "JOB-26-04142", cust: "Havells India", seg: "ocean-fcl", branch: "del", lane: "mum-rtm", rep: "kapoor", rev: 5.8, cost: 4.85, delivered: "14 Apr 2026" },
  { id: "JOB-26-04134", cust: "Apollo Tyres", seg: "customs", branch: "maa", lane: "maa-sin", rep: "menon", rev: 4.8, cost: 3.3, delivered: "16 Apr 2026" },
  { id: "JOB-26-04127", cust: "TVS Motor Co.", seg: "ocean-lcl", branch: "maa", lane: "maa-sin", rep: "naidu", rev: 3.6, cost: 2.8, delivered: "18 Apr 2026" },
  { id: "JOB-26-04098", cust: "Reliance Industries", seg: "ocean-fcl", branch: "mum", lane: "jnpt-ham", rep: "sharma", rev: 18.4, cost: 14.6, delivered: "28 Mar 2026" },
  { id: "JOB-26-04087", cust: "Tata Steel Ltd.", seg: "ocean-fcl", branch: "mum", lane: "mun-jeb", rep: "sharma", rev: 16.2, cost: 13.1, delivered: "24 Mar 2026" },
  { id: "JOB-26-04076", cust: "Maruti Suzuki India", seg: "air", branch: "del", lane: "del-fra", rep: "kapoor", rev: 11.4, cost: 7.8, delivered: "22 Mar 2026" },
  { id: "JOB-26-04068", cust: "Wipro Consumer Care", seg: "air", branch: "blr", lane: "blr-lhr", rep: "menon", rev: 8.2, cost: 5.8, delivered: "20 Mar 2026" },
  { id: "JOB-26-04054", cust: "Apollo Tyres", seg: "ocean-fcl", branch: "maa", lane: "maa-sin", rep: "menon", rev: 14.2, cost: 11.8, delivered: "18 Mar 2026" },
  { id: "JOB-26-04042", cust: "Asian Paints Ltd.", seg: "air", branch: "mum", lane: "mum-jfk", rep: "kapoor", rev: 12.6, cost: 8.9, delivered: "15 Mar 2026" },
  { id: "JOB-26-04031", cust: "Adani Wilmar", seg: "ocean-fcl", branch: "amd", lane: "mun-jeb", rep: "verma", rev: 8.8, cost: 7.2, delivered: "12 Mar 2026" },
  { id: "JOB-26-04018", cust: "Havells India", seg: "ocean-fcl", branch: "del", lane: "mum-rtm", rep: "kapoor", rev: 9.4, cost: 7.65, delivered: "10 Mar 2026" },
  { id: "JOB-26-03992", cust: "TVS Motor Co.", seg: "ocean-fcl", branch: "maa", lane: "maa-anr", rep: "naidu", rev: 7.6, cost: 6.2, delivered: "8 Mar 2026" },
  { id: "JOB-26-03987", cust: "Mahindra Logistics", seg: "ocean-lcl", branch: "maa", lane: "maa-sin", rep: "menon", rev: 4.4, cost: 3.5, delivered: "6 Mar 2026" },
  { id: "JOB-26-03978", cust: "Reliance Industries", seg: "customs", branch: "mum", lane: "jnpt-ham", rep: "sharma", rev: 3.8, cost: 2.4, delivered: "4 Mar 2026" },
  { id: "JOB-26-03962", cust: "Maruti Suzuki India", seg: "air", branch: "del", lane: "del-dxb", rep: "khurana", rev: 6.8, cost: 4.8, delivered: "2 Mar 2026" },
  { id: "JOB-26-03954", cust: "Asian Paints Ltd.", seg: "ocean-fcl", branch: "mum", lane: "jnpt-dur", rep: "kapoor", rev: 8.4, cost: 6.85, delivered: "28 Feb 2026" },
  { id: "JOB-26-03942", cust: "Tata Steel Ltd.", seg: "ocean-fcl", branch: "mum", lane: "mum-rtm", rep: "sharma", rev: 7.2, cost: 6.1, delivered: "25 Feb 2026" },
  { id: "JOB-26-03928", cust: "Wipro Consumer Care", seg: "customs", branch: "blr", lane: "blr-lhr", rep: "reddy", rev: 2.8, cost: 1.8, delivered: "22 Feb 2026" },
  { id: "JOB-26-03915", cust: "Havells India", seg: "air", branch: "del", lane: "del-fra", rep: "kapoor", rev: 5.2, cost: 3.8, delivered: "20 Feb 2026" },
  { id: "JOB-26-03904", cust: "Reliance Industries", seg: "ocean-fcl", branch: "mum", lane: "jnpt-ham", rep: "sharma", rev: 16.8, cost: 13.2, delivered: "18 Feb 2026" },
  { id: "JOB-26-03892", cust: "Apollo Tyres", seg: "road", branch: "maa", lane: "maa-sin", rep: "naidu", rev: 1.8, cost: 1.55, delivered: "15 Feb 2026" },
  { id: "JOB-26-03884", cust: "Mahindra Logistics", seg: "ocean-fcl", branch: "maa", lane: "maa-anr", rep: "menon", rev: 6.4, cost: 5.3, delivered: "12 Feb 2026" },
  { id: "JOB-26-03871", cust: "Adani Wilmar", seg: "ocean-lcl", branch: "amd", lane: "mun-jeb", rep: "verma", rev: 3.2, cost: 2.6, delivered: "10 Feb 2026" },
  { id: "JOB-26-03862", cust: "Maruti Suzuki India", seg: "warehousing", branch: "del", lane: "del-fra", rep: "kapoor", rev: 1.4, cost: 1.1, delivered: "8 Feb 2026" },
  { id: "JOB-26-03854", cust: "TVS Motor Co.", seg: "ocean-fcl", branch: "maa", lane: "maa-sin", rep: "naidu", rev: 9.4, cost: 7.8, delivered: "5 Feb 2026" },
  { id: "JOB-26-03842", cust: "CESC Ltd.", seg: "ocean-fcl", branch: "ccu", lane: "jnpt-ham", rep: "iyer", rev: 4.2, cost: 3.9, delivered: "2 Feb 2026" },
  { id: "JOB-26-03831", cust: "Reliance Industries", seg: "air", branch: "mum", lane: "mum-jfk", rep: "sharma", rev: 14.8, cost: 10.2, delivered: "30 Jan 2026" },
];

export const PROFITABILITY_JOBS: ProfitabilityJob[] = RAW_JOBS.map((job) => ({
  id: job.id,
  customer: job.cust,
  segment: job.seg,
  branch: job.branch,
  lane: job.lane,
  rep: job.rep,
  revenueL: job.rev,
  costL: job.cost,
  delivered: job.delivered,
}));

function segmentKeyFromName(name: string): ProfitabilityJob["segment"] | null {
  const lower = name.toLowerCase();
  if (lower.includes("ocean") && lower.includes("fcl")) return "ocean-fcl";
  if (lower.includes("ocean") && lower.includes("lcl")) return "ocean-lcl";
  if (lower.includes("air")) return "air";
  if (lower.includes("custom")) return "customs";
  if (lower.includes("road")) return "road";
  if (lower.includes("warehous")) return "warehousing";
  return null;
}

function laneKeyFromName(name: string): string | null {
  const normalized = name.replace(/\s*[-–—→]\s*/g, " → ").trim();
  const match = Object.entries(LANE_LABELS).find(([, label]) => label === normalized);
  return match?.[0] ?? null;
}

function repKeyFromName(name: string): string | null {
  const match = Object.entries(REP_LABELS).find(([, label]) => label === name.trim());
  return match?.[0] ?? null;
}

export function filterJobsForRow(
  dimension: BreakdownDimension,
  row: BreakdownRow,
): ProfitabilityJob[] {
  if (dimension === "segment") {
    const seg = segmentKeyFromName(row.name);
    return seg ? PROFITABILITY_JOBS.filter((job) => job.segment === seg) : [];
  }
  if (dimension === "branch") {
    const branch = (row.code || row.branchVariant || "").toLowerCase();
    return branch ? PROFITABILITY_JOBS.filter((job) => job.branch === branch) : [];
  }
  if (dimension === "customer") {
    return PROFITABILITY_JOBS.filter((job) => job.customer === row.name);
  }
  if (dimension === "tradelane") {
    const lane = laneKeyFromName(row.name);
    return lane ? PROFITABILITY_JOBS.filter((job) => job.lane === lane) : [];
  }
  if (dimension === "salesperson") {
    const rep = repKeyFromName(row.name);
    return rep ? PROFITABILITY_JOBS.filter((job) => job.rep === rep) : [];
  }
  return [];
}

export function buildDrillSummary(
  context: ProfitabilityDrillContext,
  jobs: ProfitabilityJob[],
): ProfitabilityDrillSummary {
  const { row } = context;
  const revenueL = row.revenue * 100;
  const costL = row.cost * 100;
  const grossProfitL = row.grossProfit * 100;
  const marginPct = row.marginPct;
  const avgMarginPct =
    jobs.length > 0
      ? jobs.reduce((sum, job) => {
          const gp = job.revenueL - job.costL;
          return sum + (job.revenueL > 0 ? (gp / job.revenueL) * 100 : 0);
        }, 0) / jobs.length
      : marginPct;

  const gpTrendUp =
    row.yoyDirection === "up" || (row.yoyHasData !== false && row.yoyPct >= 0);
  const gpTrendText =
    row.yoyLabel ??
    (row.yoyHasData === false
      ? undefined
      : `${row.yoyPct >= 0 ? "+" : ""}${row.yoyPct.toFixed(1)}%`);

  return {
    revenueL,
    costL,
    grossProfitL,
    marginPct,
    avgMarginPct,
    jobCount: jobs.length,
    gpTrendText,
    gpTrendUp,
  };
}

export function sortJobsByGrossProfit(jobs: ProfitabilityJob[]): ProfitabilityJob[] {
  return [...jobs].sort(
    (a, b) => b.revenueL - b.costL - (a.revenueL - a.costL),
  );
}

export function getSegmentLabel(segment: ProfitabilityJob["segment"]): string {
  return SEGMENT_LABELS[segment];
}

export function getLaneLabel(lane: string): string {
  return LANE_LABELS[lane] ?? lane;
}
