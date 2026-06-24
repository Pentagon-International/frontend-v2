import { useQuery } from "@tanstack/react-query";
import { odexApi } from "../services/odexApi";
import type { OdexJobListFilters, OdexJobListItem } from "../types/odex";
import { normalizeOdexStatus } from "../utils/odexApiParse";

function mapListItem(row: Record<string, unknown>): OdexJobListItem {
  return {
    id: (row.id ?? row.job_id) as string | number,
    job_ref: String(row.job_ref ?? ""),
    consol_job_id:
      row.consol_job_id != null ? Number(row.consol_job_id) : null,
    odex_type: String(row.odex_type ?? ""),
    status: normalizeOdexStatus(row.status) as OdexJobListItem["status"],
    progress_percentage:
      row.progress_percentage != null
        ? Number(row.progress_percentage)
        : null,
    filled_fields_count:
      row.filled_fields_count != null
        ? Number(row.filled_fields_count)
        : undefined,
    screenshot_count:
      row.screenshot_count != null
        ? Number(row.screenshot_count)
        : undefined,
    thumbnail_url: row.thumbnail_url ? String(row.thumbnail_url) : null,
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    last_log: row.last_log ? String(row.last_log) : null,
  };
}

export function useOdexJobList(
  filters: OdexJobListFilters,
  options?: { refetchInterval?: number; enabled?: boolean },
) {
  return useQuery({
    queryKey: ["odex-jobs", filters],
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
    queryFn: async () => {
      const { results, total } = await odexApi.listJobs(filters);
      return {
        results: results.map((r) =>
          mapListItem(r as Record<string, unknown>),
        ),
        total,
      };
    },
  });
}
