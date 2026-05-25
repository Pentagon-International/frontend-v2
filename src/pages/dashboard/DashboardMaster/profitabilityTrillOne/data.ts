import { LANE_LABELS, SEGMENT_LABELS } from "./constants";
import type { ProfitabilityJob } from "./types";

export function getSegmentLabel(segment: ProfitabilityJob["segment"]): string {
  return SEGMENT_LABELS[segment];
}

export function getLaneLabel(lane: string): string {
  return LANE_LABELS[lane] ?? lane;
}
