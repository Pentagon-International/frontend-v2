/**
 * Resolve total record count for tariff filter_* list APIs.
 * Avoids `data.total || rows.length` (wrong when total is 0).
 * Bumps total when API under-reports vs index + page row count.
 */
export function getTariffFilterListTotal(data: any, rows: unknown[]): number {
  if (!data || typeof data !== "object") {
    return Array.isArray(rows) ? rows.length : 0;
  }
  const raw: unknown =
    data.total ??
    data.count ??
    data.total_count ??
    data.pagination_total;

  let n: number;
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    n = raw;
  } else if (typeof raw === "string" && String(raw).trim() !== "") {
    const p = Number(raw);
    n = !Number.isNaN(p) ? p : 0;
  } else {
    n = Array.isArray(rows) ? rows.length : 0;
  }

  const idx = Number(data.index);
  const len = Array.isArray(rows) ? rows.length : 0;
  if (len > 0 && !Number.isNaN(idx) && idx >= 0 && n < idx + len) {
    n = Math.max(n, idx + len);
  }
  return n;
}
