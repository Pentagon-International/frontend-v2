/**
 * Display-only job identifier.
 * Returns the raw job_id (service_code prefix is not applied).
 * Use only in list/table UI — keep raw job_id for filters, navigation, and API payloads.
 */
export function formatDisplayJobId(
  jobId?: string | number | null,
  _serviceCode?: string | null,
): string {
  const id = jobId == null ? "" : String(jobId).trim();
  return id;
}
