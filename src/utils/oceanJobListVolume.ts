/** Per-job summary from `filterJobCreate` list (job level, not housing_details). */
export type OceanJobRowSummary = {
  estimates_total_cost?: string | number | null;
  container_type?: string[] | null;
  volume_total?: string | number | null;
};

/** Ocean job list Volume column: FCL → container_type[], LCL → volume_total. */
export function getOceanJobListVolumeDisplay(
  service: string | undefined | null,
  summary: OceanJobRowSummary | null | undefined,
): string {
  const svc = String(service ?? "").trim().toUpperCase();
  if (!svc) return "—";

  if (svc === "FCL") {
    const types = summary?.container_type;
    if (!Array.isArray(types) || types.length === 0) return "—";
    const parts = types.map((t) => String(t ?? "").trim()).filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "—";
  }

  if (svc === "LCL") {
    const raw = summary?.volume_total;
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      return "—";
    }
    return String(raw).trim();
  }

  return "—";
}
