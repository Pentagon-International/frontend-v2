import type { StageFunnelRow } from "./StageFunnelCard";

/** Maps funnel row label from dashboard mapper → POST body `type`. */
export function funnelStageRowToApiType(row: StageFunnelRow | null): string | null {
  if (!row) return null;
  const s = row.stage.trim();
  if (s.toLowerCase() === "active") return "Active";
  if (s === "Quoted") return "QUOTE CREATED";
  if (s === "Won") return "GAINED";
  if (s === "Lost") return "LOST";
  return "Active";
}

