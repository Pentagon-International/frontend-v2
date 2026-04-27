/**
 * Total list size for `customerServiceShipmentFilter` (and similar) paginated responses.
 * Reads total from common fields, avoids `total || pageLength` when total is 0, and
 * bumps when the API under-reports vs `index` + current page length.
 */
export function getBookingShipmentFilterListTotal(
  response: Record<string, unknown>,
  rows: unknown[],
  requestOffset: number,
): number {
  const raw =
    response.total ??
    response.count ??
    response.total_count ??
    response.total_pagination ??
    response.pagination_total;

  let n: number;
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    n = raw;
  } else if (typeof raw === "string" && String(raw).trim() !== "") {
    const p = Number(raw);
    n = !Number.isNaN(p) ? p : 0;
  } else {
    n = Array.isArray(rows) ? rows.length : 0;
  }

  const idxRaw = response.index;
  const idx =
    typeof idxRaw === "number" && !Number.isNaN(idxRaw) ? idxRaw : requestOffset;
  const len = Array.isArray(rows) ? rows.length : 0;
  if (len > 0 && idx >= 0 && n < idx + len) {
    n = Math.max(n, idx + len);
  }
  return n;
}
