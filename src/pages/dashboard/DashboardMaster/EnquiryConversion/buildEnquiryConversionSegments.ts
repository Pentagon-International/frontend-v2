import type { EnquiryConversionAggregatedData } from "../../../../service/dashboard.service";
import type { FunnelSegment } from "./SegmentedFunnelBar";
import { enquiryConversionColors } from "./enquiryConversionTokens";

/**
 * Maps aggregated enquiry buckets into funnel segment weights for the overview bar.
 * "New" is derived as the remainder of total enquiries minus tracked buckets when possible.
 */
export function buildEnquiryConversionSegments(
  data: EnquiryConversionAggregatedData
): FunnelSegment[] {
  const q = Math.max(0, data.totalQuoteCreated);
  const negot = Math.max(0, data.totalActive);
  const won = Math.max(0, data.totalGain);
  const lost = Math.max(0, data.totalLost);
  const total = Math.max(0, data.totalEnquiries);

  const accounted = q + negot + won + lost;
  const neu = Math.max(0, total > 0 ? total - accounted : 0);

  return [
    { key: "new", label: "New", weight: neu, color: enquiryConversionColors.new },
    {
      key: "quoted",
      label: "Quoted",
      weight: q,
      color: enquiryConversionColors.quoted,
    },
    {
      key: "negot",
      label: "Negot.",
      weight: negot,
      color: enquiryConversionColors.negotiation,
    },
    { key: "won", label: "Won", weight: won, color: enquiryConversionColors.won },
    {
      key: "lost",
      label: "Lost",
      weight: lost,
      color: enquiryConversionColors.lost,
    },
  ];
}
