/**
 * Subtitle under “Enquiry Conversion” on Sales Leadership overview —
 * enquiries count only (no ₹ pipeline line).
 *
 * `pipelineCr` accepted for callers that still pass it; it is intentionally ignored here.
 */
export function formatEnquiryConversionOverviewSubtitle(
  totalEnquiries: number,
  _pipelineCr?: number | null
): string {
  const n = Math.max(0, Math.round(totalEnquiries)).toLocaleString("en-IN");
  return `${n} enquiries`;
}
