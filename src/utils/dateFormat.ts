import dayjs from "dayjs";

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
