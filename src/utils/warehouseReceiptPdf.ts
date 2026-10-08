import { URL } from "../api/serverUrls";
import useAuthStore from "../store/authStore";
import { resolveBookingPrimaryKey } from "./airWayBillPdf";

export { resolveBookingPrimaryKey };

/**
 * Fetch Warehouse Receipt PDF for an AIR/LCL Export booking.
 * Backend currently returns dummy body values until field mapping is added.
 */
export async function fetchWarehouseReceiptPdf(
  bookingId: number,
): Promise<Blob> {
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(
    `${URL.base}${URL.customerServiceShipment}${bookingId}/warehouse-receipt-pdf/`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data?.message) message = String(data.message);
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }
  return response.blob();
}
