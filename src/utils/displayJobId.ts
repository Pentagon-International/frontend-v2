/**
 * Display-only job identifier: prepends service_code when present
 * (e.g. AI + 2606INMUM0025 → AI2606INMUM0025).
 * Use only in list/table UI — keep raw job_id for filters, navigation, and API payloads.
 */
export function formatDisplayJobId(
  jobId?: string | number | null,
  serviceCode?: string | null,
): string {
  const id = jobId == null ? "" : String(jobId).trim();
  const code = serviceCode == null ? "" : String(serviceCode).trim();
  if (!id) return "";
  if (!code) return id;
  return `${code}-${id}`;
}
