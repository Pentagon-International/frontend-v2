import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export const getDateFormat = (countryCode?: string): string => {
  switch (countryCode) {
    case "IN":
      return "DD-MM-YYYY";
    case "US":
      return "MM-DD-YYYY";
    default:
      return "YYYY-MM-DD";
  }
};

/** Format a date-only value for UI using the country date format. */
export function formatDateForUi(
  value: string | Date | null | undefined,
  dateFormat: string,
  empty = "—",
): string {
  if (value == null || value === "") return empty;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return String(value);
  return parsed.format(dateFormat);
}

/**
 * Format a date/datetime for UI.
 * ISO timestamps include time; plain YYYY-MM-DD stays date-only.
 */
export function formatDateTimeForUi(
  value: string | Date | null | undefined,
  dateFormat: string,
  empty = "—",
): string {
  if (value == null || value === "") return empty;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return String(value);
  if (typeof value === "string" && value.includes("T")) {
    return parsed.format(`${dateFormat} hh:mm A`);
  }
  return parsed.format(dateFormat);
}

/**
 * Parse a typed date string using the UI format, with ISO `YYYY-MM-DD` fallback.
 * Returns a local calendar Date so existing payload formatters stay correct.
 */
export function parseTypedDate(
  input: string,
  dateFormat: string,
): Date | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  const fromUi = dayjs(trimmed, dateFormat, true);
  if (fromUi.isValid()) return fromUi.toDate();

  const fromIso = dayjs(trimmed, "YYYY-MM-DD", true);
  if (fromIso.isValid()) return fromIso.toDate();

  return null;
}
