import type { EnquiryConversionAggregatedData } from "../../../../service/dashboard.service";
import type { FunnelSegment } from "./SegmentedFunnelBar";
import { enquiryConversionColors } from "./enquiryConversionTokens";

/**
 * Overview “Enquiry Conversion” bar — four slices (no Negot.):
 * New (remainder + in‑flight active), Quoted, Won, Lost.
 */
export function buildEnquiryConversionSegments(
  data: EnquiryConversionAggregatedData
): FunnelSegment[] {
  const q = Math.max(0, data.totalQuoteCreated);
  const active = Math.max(0, data.totalActive);
  const won = Math.max(0, data.totalGain);
  const lost = Math.max(0, data.totalLost);
  const total = Math.max(0, data.totalEnquiries);

  const accountedBeforeRemainder = q + active + won + lost;
  const remainder =
    total > 0 ? Math.max(0, total - accountedBeforeRemainder) : 0;
  /** Combine “new” backlog + active pipeline (no separate Negot segment). */
  const newCombined = remainder + active;

  return [
    {
      key: "new",
      label: "New",
      weight: newCombined,
      color: enquiryConversionColors.bars.navy1,
    },
    {
      key: "quoted",
      label: "Quoted",
      weight: q,
      color: enquiryConversionColors.bars.navy2,
    },
    { key: "won", label: "Won", weight: won, color: enquiryConversionColors.bars.won },
    { key: "lost", label: "Lost", weight: lost, color: enquiryConversionColors.bars.lost },
  ];
}
