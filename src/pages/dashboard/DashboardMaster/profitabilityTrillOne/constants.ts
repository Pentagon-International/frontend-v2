import type { BreakdownDimension } from "../accountsDashboardTypes";
import type { ProfitabilityJobSegment } from "./types";

export const INK = "#0f172a";
export const INK_2 = "#334155";
export const INK_3 = "#64748b";
export const INK_4 = "#94a3b8";
export const LINE = "#e2e8f0";
export const CARD_BG = "#ffffff";
export const PAGE_BG = "#f1f5f9";
export const NAVY_600 = "#1e3a5f";
export const NAVY_700 = "#1e3a5f";
export const GOOD = "#16a34a";
export const BAD = "#dc2626";

export const DIMENSION_CRUMB: Record<BreakdownDimension, string> = {
  segment: "Segment",
  branch: "Branch",
  customer: "Customer",
  tradelane: "Tradelane",
  salesperson: "Salesperson",
};

export const SEGMENT_LABELS: Record<ProfitabilityJobSegment, string> = {
  "ocean-fcl": "Ocean FCL",
  "ocean-lcl": "Ocean LCL",
  air: "Air Freight",
  customs: "Customs",
  road: "Road",
  warehousing: "Warehousing",
};

export const LANE_LABELS: Record<string, string> = {
  "jnpt-ham": "JNPT → Hamburg",
  "del-fra": "Delhi → Frankfurt",
  "mun-jeb": "Mundra → Jebel Ali",
  "blr-lhr": "Bangalore → London",
  "maa-sin": "Chennai → Singapore",
  "mum-jfk": "Mumbai → New York",
  "jnpt-dur": "JNPT → Durban",
  "maa-anr": "Chennai → Antwerp",
  "del-dxb": "Delhi → Dubai",
  "mum-rtm": "Mumbai → Rotterdam",
};

export const REP_LABELS: Record<string, string> = {
  sharma: "R. Sharma",
  kapoor: "P. Kapoor",
  menon: "A. Menon",
  verma: "D. Verma",
  naidu: "S. Naidu",
  iyer: "K. Iyer",
  khurana: "N. Khurana",
  reddy: "S. Reddy",
};

export const MODE_CHIP_STYLES: Record<
  ProfitabilityJobSegment,
  { background: string; color: string }
> = {
  "ocean-fcl": { background: "#e0f2fe", color: "#075985" },
  "ocean-lcl": { background: "#ecfeff", color: "#155e75" },
  air: { background: "#fef3c7", color: "#92400e" },
  road: { background: "#f1f5f9", color: "#334155" },
  customs: { background: "#fce7f3", color: "#9f1239" },
  warehousing: { background: "#e0e7ff", color: "#3730a3" },
};
