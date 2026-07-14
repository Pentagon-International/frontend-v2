import dayjs from "dayjs";

/**
 * Wall-clock datetime for API payloads — no Z / offset.
 * e.g. "2026-03-22T09:50:00"
 */
export function formatLocalDateTime(
  value: Date | string | null | undefined,
): string | null {
  if (value == null || value === "") return null;
  const d = dayjs(value);
  if (!d.isValid()) return null;
  return d.format("YYYY-MM-DDTHH:mm:ss");
}

/**
 * Parse API datetime as wall-clock (no UTC→local shift).
 */
export function parseLocalDateTime(
  value: string | Date | null | undefined,
): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return dayjs(value).isValid() ? value : null;
  }
  const d = dayjs(value);
  return d.isValid() ? d.toDate() : null;
}
