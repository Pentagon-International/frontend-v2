import type { EnquiryConversionAggregatedData } from "../../../../service/dashboard.service";
import type { FunnelSegment } from "./SegmentedFunnelBar";
import { enquiryConversionColors } from "./enquiryConversionTokens";

/**
 * Maps aggregated enquiry buckets into funnel segment weights for the overview bar:
 * Active (incl. any remainder vs total enquiries), Quoted, Won, Lost — no negotiation stage.
 */
export function buildEnquiryConversionSegments(
  data: EnquiryConversionAggregatedData
): FunnelSegment[] {
  const q = Math.max(0, data.totalQuoteCreated);
  const activeBase = Math.max(0, data.totalActive);
  /* Won funnel width: sourced from backend gained (total_gain / gained); label remains “Won”. */
  const wonFromGained = Math.max(0, data.totalGain);
  const lost = Math.max(0, data.totalLost);
  const total = Math.max(0, data.totalEnquiries);

  const accounted = q + activeBase + wonFromGained + lost;
  const remainder = Math.max(0, total > 0 ? total - accounted : 0);
  const activeCombined = activeBase + remainder;

  return [
    {
      key: "active",
      label: "Active",
      weight: activeCombined,
      color: enquiryConversionColors.active,
    },
    {
      key: "quoted",
      label: "Quoted",
      weight: q,
      color: enquiryConversionColors.quoted,
    },
    { key: "won", label: "Won", weight: wonFromGained, color: enquiryConversionColors.won },
    {
      key: "lost",
      label: "Lost",
      weight: lost,
      color: enquiryConversionColors.lost,
    },
  ];
}
