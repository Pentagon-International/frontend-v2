import dayjs from "dayjs";
import { URL } from "../api/serverUrls";
import { putAPICall } from "../service/putApiCall";
import { API_HEADER } from "../store/storeKeys";

/** True when a booking schedule date is present and parseable. */
export function hasBookingScheduleDate(value: unknown): boolean {
  if (value == null) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "null") return false;
  return dayjs(raw).isValid();
}

export function bookingHasEtdAndEta(booking: Record<string, unknown>): boolean {
  return (
    hasBookingScheduleDate(booking.etd) && hasBookingScheduleDate(booking.eta)
  );
}

export function formatBookingScheduleDate(value: Date): string {
  return dayjs(value).format("YYYY-MM-DD");
}

/**
 * Keep dates already confirmed on the list row when a later booking fetch
 * comes back without them.
 */
export function preferBookingScheduleDates(
  resolved: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...resolved,
    etd: hasBookingScheduleDate(resolved.etd) ? resolved.etd : source.etd,
    eta: hasBookingScheduleDate(resolved.eta) ? resolved.eta : source.eta,
  };
}

/** Persist ETD and ETA on the booking, using the same update shape as list cancel. */
export async function updateBookingEtdEta(
  booking: Record<string, unknown>,
  etd: Date,
  eta: Date,
): Promise<Record<string, unknown>> {
  const payload = {
    ...booking,
    etd: formatBookingScheduleDate(etd),
    eta: formatBookingScheduleDate(eta),
  };
  await putAPICall(URL.customerServiceShipment, payload, API_HEADER);
  return payload;
}
