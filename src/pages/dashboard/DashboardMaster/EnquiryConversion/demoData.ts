import type { FunnelSegment } from "./SegmentedFunnelBar";
import type { StageFunnelRow } from "./StageFunnelCard";
import type { ModeLegendRow } from "./ByModeValueCard";
import type { RepBarRow } from "./ConversionByRepCard";
import type { EnquiryRow } from "./TopActiveEnquiriesTable";

/** Illustrative dataset aligned with Pentagon standalone dashboard HTML — swap with API responses later */

export const demoMetricStrip = {
  newCount: "284",
  newTrend: "+12.4%",
  quoteRate: "71.8%",
  quoteTrend: "+3.2pp",
  winRate: "28.9%",
  winTrend: "+2.1pp",
  avgDeal: "₹5.9 L",
  avgDealTrend: "-₹40K",
};

export const demoStageFunnelRows: StageFunnelRow[] = [
  {
    stage: "New",
    summary: "284 · ₹14.2 Cr",
    count: 284,
    rate: undefined,
    barPercent: 100,
    barColor: "#93C5FD",
  },
  {
    stage: "Quoted",
    summary: "204 · ₹11.6 Cr",
    count: 204,
    rate: "71.8%",
    barPercent: 72,
    barColor: "#3B82F6",
  },
  {
    stage: "Negotiation",
    summary: "136 · ₹8.4 Cr",
    count: 136,
    rate: "66.7%",
    barPercent: 54,
    barColor: "#7C3AED",
  },
  {
    stage: "Won",
    summary: "82 · ₹4.9 Cr",
    count: 82,
    rate: "60.3%",
    barPercent: 38,
    barColor: "#15803D",
  },
  {
    stage: "Lost",
    summary: "54 · ₹2.7 Cr",
    count: 54,
    rate: "39.7%",
    barPercent: 28,
    barColor: "#DC2626",
  },
];

export const demoModeSegments: FunnelSegment[] = [
  { key: "fcl", label: "Ocean FCL", weight: 28, color: "#2563EB" },
  { key: "lcl", label: "Ocean LCL", weight: 18, color: "#1D4ED8" },
  { key: "air", label: "Air", weight: 22, color: "#EA580C" },
  { key: "road", label: "Road", weight: 12, color: "#64748B" },
  { key: "rail", label: "Rail", weight: 8, color: "#7C3AED" },
  { key: "cus", label: "Customs", weight: 8, color: "#DB2777" },
  { key: "wh", label: "Warehousing", weight: 4, color: "#38BDF8" },
];

export const demoModeRows: ModeLegendRow[] = [
  { key: "fcl", label: "Ocean FCL", color: "#2563EB", valueLabel: "₹3.98 Cr", percentLabel: "28%" },
  { key: "lcl", label: "Ocean LCL", color: "#1D4ED8", valueLabel: "₹2.56 Cr", percentLabel: "18%" },
  { key: "air", label: "Air Freight", color: "#EA580C", valueLabel: "₹3.12 Cr", percentLabel: "22%" },
  { key: "road", label: "Road", color: "#64748B", valueLabel: "₹1.70 Cr", percentLabel: "12%" },
  { key: "rail", label: "Rail", color: "#7C3AED", valueLabel: "₹1.14 Cr", percentLabel: "8%" },
  { key: "cus", label: "Customs", color: "#DB2777", valueLabel: "₹1.14 Cr", percentLabel: "8%" },
  { key: "wh", label: "Warehousing", color: "#38BDF8", valueLabel: "₹56 L", percentLabel: "4%" },
];

export const demoRepRows: RepBarRow[] = [
  { name: "Aditi Rao", rateLabel: "34.2%", winsLabel: "22/64", barPercent: 78, barColor: "#15803D" },
  { name: "Vikram Singh", rateLabel: "31.1%", winsLabel: "18/58", barPercent: 68, barColor: "#105476" },
  { name: "Neha Gupta", rateLabel: "26.4%", winsLabel: "14/53", barPercent: 52, barColor: "#EA580C" },
];

export const demoEnquiryRows: EnquiryRow[] = [
  {
    id: "1",
    customer: "Tata Steel Ltd.",
    enquiryCode: "ENQ-2604-0188",
    ageLabel: "3d",
    stale: true,
    lane: "JNPT → HAM",
    modeLabel: "OCN FCL",
    modeColor: "#2563EB",
    stageLabel: "Negot.",
    stageDotColor: "#7C3AED",
    probability: 75,
    valueLabel: "₹48.2 L",
  },
  {
    id: "2",
    customer: "Marico Industries",
    enquiryCode: "ENQ-2604-0177",
    ageLabel: "1d",
    lane: "BLR → LHR",
    modeLabel: "AIR",
    modeColor: "#EA580C",
    stageLabel: "Quoted",
    stageDotColor: "#F59E0B",
    probability: 50,
    valueLabel: "₹36.5 L",
  },
];
