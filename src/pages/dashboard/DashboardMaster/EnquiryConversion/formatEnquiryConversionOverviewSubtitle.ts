/**
 * Subtitle under “Enquiry Conversion” — matches standalone HTML:
 * `284 enquiries · ₹8.42 Cr pipeline`
 */
export function formatEnquiryConversionOverviewSubtitle(
  totalEnquiries: number,
  pipelineCr?: number | null
): string {
  const n = Math.max(0, Math.round(totalEnquiries)).toLocaleString("en-IN");
  const pipe =
    pipelineCr != null && Number.isFinite(pipelineCr) && pipelineCr > 0
      ? `₹${pipelineCr.toFixed(2)} Cr`
      : "₹ — Cr";
  return `${n} enquiries · ${pipe} pipeline`;
}
