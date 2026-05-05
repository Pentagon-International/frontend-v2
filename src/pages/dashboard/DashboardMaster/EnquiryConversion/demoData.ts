import type { FunnelSegment } from "./SegmentedFunnelBar";
import type { StageFunnelRow } from "./StageFunnelCard";
import type { ModeLegendRow } from "./ByModeValueCard";
import type { RepBarRow } from "./ConversionByRepCard";
import type { EnquiryRow } from "./TopActiveEnquiriesTable";

/** Illustrative dataset aligned with Pentagon standalone dashboard HTML — swap with API responses later */

export const demoMetricStrip = {
  activeCount: "284",
  activeTrend: "+12.4%",
  quoteRate: "71.8%",
  quoteTrend: "+3.2pp",
  winRate: "28.9%",
  winTrend: "+2.1pp",
  avgDeal: "₹5.9 L",
  avgDealTrend: "-₹40K",
};

import { enquiryConversionColors } from "./enquiryConversionTokens";

export const demoStageFunnelRows: StageFunnelRow[] = [
  {
    stage: "New",
    barCaption: "284 · ₹14.2 Cr",
    count: 284,
    conversionNote: "100%",
    barPercent: 100,
    barColor: enquiryConversionColors.bars.navy1,
    dotColor: enquiryConversionColors.status.new.dot,
    dotBgColor: enquiryConversionColors.status.new.bg,
  },
  {
    stage: "Quoted",
    barCaption: "204 · ₹11.6 Cr",
    count: 204,
    conversionNote: "71.8%",
    barPercent: 72,
    barColor: enquiryConversionColors.bars.navy2,
    dotColor: enquiryConversionColors.status.quoted.dot,
    dotBgColor: enquiryConversionColors.status.quoted.bg,
  },
  {
    stage: "Negotiation",
    barCaption: "136 · ₹8.4 Cr",
    count: 136,
    conversionNote: "66.7%",
    barPercent: 48,
    barColor: enquiryConversionColors.bars.navy3,
    dotColor: enquiryConversionColors.status.negotiation.dot,
    dotBgColor: enquiryConversionColors.status.negotiation.bg,
  },
  {
    stage: "Won",
    barCaption: "82 · ₹4.9 Cr",
    count: 82,
    conversionNote: "60.3%",
    barPercent: 29,
    barColor: enquiryConversionColors.bars.won,
    dotColor: enquiryConversionColors.status.won.dot,
    dotBgColor: enquiryConversionColors.status.won.bg,
  },
  {
    stage: "Lost",
    barCaption: "54 · ₹2.7 Cr",
    count: 54,
    conversionNote: "39.7%",
    barPercent: 19,
    barColor: enquiryConversionColors.bars.lost,
    dotColor: enquiryConversionColors.status.lost.dot,
    dotBgColor: enquiryConversionColors.status.lost.bg,
  },
];

export const demoModeSegments: FunnelSegment[] = [
  { key: "fcl", label: "Ocean FCL", weight: 28, color: enquiryConversionColors.modes.fcl },
  { key: "lcl", label: "Ocean LCL", weight: 18, color: enquiryConversionColors.modes.lcl },
  { key: "air", label: "Air", weight: 22, color: enquiryConversionColors.modes.air },
  { key: "road", label: "Road", weight: 12, color: enquiryConversionColors.modes.road },
  { key: "rail", label: "Rail", weight: 8, color: enquiryConversionColors.modes.rail },
  { key: "cus", label: "Customs", weight: 8, color: enquiryConversionColors.modes.customs },
  { key: "wh", label: "Warehousing", weight: 4, color: enquiryConversionColors.modes.warehousing },
];

export const demoModeRows: ModeLegendRow[] = [
  { key: "fcl", label: "Ocean FCL", color: enquiryConversionColors.modes.fcl, valueLabel: "₹3.98 Cr", percentLabel: "28%" },
  { key: "lcl", label: "Ocean LCL", color: enquiryConversionColors.modes.lcl, valueLabel: "₹2.56 Cr", percentLabel: "18%" },
  { key: "air", label: "Air Freight", color: enquiryConversionColors.modes.air, valueLabel: "₹3.12 Cr", percentLabel: "22%" },
  { key: "road", label: "Road", color: enquiryConversionColors.modes.road, valueLabel: "₹1.70 Cr", percentLabel: "12%" },
  { key: "rail", label: "Rail", color: enquiryConversionColors.modes.rail, valueLabel: "₹1.14 Cr", percentLabel: "8%" },
  { key: "cus", label: "Customs", color: enquiryConversionColors.modes.customs, valueLabel: "₹1.14 Cr", percentLabel: "8%" },
  { key: "wh", label: "Warehousing", color: enquiryConversionColors.modes.warehousing, valueLabel: "₹56 L", percentLabel: "4%" },
];

export const demoRepRows: RepBarRow[] = [
  { name: "R. Sharma", rateLabel: "34.2%", winsLabel: "22/64", barPercent: 78, barColor: enquiryConversionColors.bars.won },
  { name: "P. Kapoor", rateLabel: "31.8%", winsLabel: "18/57", barPercent: 68, barColor: enquiryConversionColors.bars.won },
  { name: "A. Menon", rateLabel: "28.6%", winsLabel: "14/49", barPercent: 52, barColor: enquiryConversionColors.bars.navy1 },
  { name: "D. Verma", rateLabel: "26.2%", winsLabel: "11/42", barPercent: 48, barColor: enquiryConversionColors.bars.navy1 },
  { name: "S. Naidu", rateLabel: "22.9%", winsLabel: "8/35", barPercent: 38, barColor: enquiryConversionColors.modes.air },
  { name: "K. Iyer", rateLabel: "18.9%", winsLabel: "7/37", barPercent: 28, barColor: enquiryConversionColors.modes.air },
];

export const demoEnquiryRows: EnquiryRow[] = [
  {
    id: "1",
    customer: "Tata Steel Ltd.",
    enquiryCode: "ENQ-2604-0188",
    ageLabel: "3d",
    stale: false,
    lane: "JNPT → HAM",
    modeLabel: "OCN FCL",
    modeColor: enquiryConversionColors.modes.fcl,
    stageLabel: "Negotiation",
    stageDotColor: enquiryConversionColors.status.negotiation.dot,
    probability: 75,
    valueLabel: "₹48.2 L",
    drilldownEnquiry: {
      enquiry_id: "ENQ-2604-0188",
      customer_name: "Tata Steel Ltd.",
      status: "NEGOTIATION",
      origin_code_list: ["JNPT"],
      destination_code_list: ["HAM"],
      services: [
        {
          service: "FCL",
          service_name: "FCL",
          origin_code_read: "JNPT",
          destination_code_read: "HAM",
        },
      ],
    },
  },
  {
    id: "2",
    customer: "Marico Industries",
    enquiryCode: "ENQ-2604-0177",
    ageLabel: "1d",
    lane: "BLR → LHR",
    modeLabel: "AIR",
    modeColor: enquiryConversionColors.modes.air,
    stageLabel: "Quoted",
    stageDotColor: enquiryConversionColors.status.quoted.dot,
    probability: 50,
    valueLabel: "₹36.5 L",
    drilldownEnquiry: {
      enquiry_id: "ENQ-2604-0177",
      customer_name: "Marico Industries",
      status: "QUOTE CREATED",
      origin_code_list: ["BLR"],
      destination_code_list: ["LHR"],
      services: [
        {
          service: "AIR",
          service_name: "AIR",
          origin_code_read: "BLR",
          destination_code_read: "LHR",
        },
      ],
    },
  },
  {
    id: "3",
    customer: "Hindalco Aluminium",
    enquiryCode: "ENQ-2604-0169",
    ageLabel: "5d",
    stale: true,
    lane: "MAA → SIN",
    modeLabel: "OCN FCL",
    modeColor: enquiryConversionColors.modes.fcl,
    stageLabel: "Negotiation",
    stageDotColor: enquiryConversionColors.status.negotiation.dot,
    probability: 60,
    valueLabel: "₹29.4 L",
    drilldownEnquiry: {
      enquiry_id: "ENQ-2604-0169",
      customer_name: "Hindalco Aluminium",
      status: "NEGOTIATION",
      origin_code_list: ["MAA"],
      destination_code_list: ["SIN"],
      services: [
        {
          service: "FCL",
          service_name: "FCL",
          origin_code_read: "MAA",
          destination_code_read: "SIN",
        },
      ],
    },
  },
];
