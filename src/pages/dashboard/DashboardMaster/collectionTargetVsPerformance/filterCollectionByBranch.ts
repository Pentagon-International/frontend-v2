import type {
  BranchCollectionRow,
  CollectionTargetVsPerformanceData,
} from "./collectionTargetVsPerformanceTypes";

function sumBranchRows(rows: BranchCollectionRow[]): BranchCollectionRow {
  const target = rows.reduce((s, r) => s + r.target, 0);
  const collected = rows.reduce((s, r) => s + r.collected, 0);
  const gap = collected - target;
  const achievementPct = target > 0 ? (collected / target) * 100 : collected > 0 ? 100 : 0;
  return {
    branchName: "All Branches",
    target,
    collected,
    barCollectedWidthPct: Math.min(100, Math.max(0, achievementPct)),
    markerLeftPct: 100,
    barTone: achievementPct >= 98 ? "over" : achievementPct < 85 ? "under" : "neutral",
    gap,
    gapDirection: gap >= 0 ? "pos" : "neg",
    achievementPct,
  };
}

/** Client-side branch filter when API returns all branches in one response. */
export function filterCollectionByBranch(
  data: CollectionTargetVsPerformanceData,
  branchCode: string | null,
): CollectionTargetVsPerformanceData {
  if (!branchCode || branchCode === "all") return data;

  const rows = data.branchPerformance.rows.filter(
    (r) => r.branchCode === branchCode || r.id === branchCode,
  );

  return {
    ...data,
    branchPerformance: {
      rows,
      total: rows.length ? sumBranchRows(rows) : data.branchPerformance.total,
    },
  };
}
