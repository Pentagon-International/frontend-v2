import { URL } from "../../../api/serverUrls";
import { postAPICall } from "../../../service/postApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import {
  isIndianUserFromProfile,
  type UserCountryProfile,
} from "../../../utils/userNumberFormat";

export type CanSacWiseTotal = {
  sac_code?: string;
  charge_name?: string;
  total_amount?: number;
  charge_names?: string[];
  charge_count?: number;
  rate?: number;
  rate_type?: string;
  shipment_no?: string;
  currency_id?: number;
  currency_code?: string;
  currency_name?: string;
};

export type CanGstBreakupResponse = {
  message?: string;
  shipment_id?: string;
  sac_wise_totals?: CanSacWiseTotal[];
  cgst_total?: string;
  sgst_total?: string;
  igst_total?: string;
  total?: string;
};

export async function fetchCanGstBreakup(
  shipmentId: string,
): Promise<CanGstBreakupResponse | null> {
  const trimmedShipmentId = String(shipmentId ?? "").trim();
  if (!trimmedShipmentId) return null;

  try {
    const response = await postAPICall(
      URL.invoiceCalculateGstBreakup,
      { shipment_id: trimmedShipmentId },
      API_HEADER,
    );
    const raw = response as {
      data?: CanGstBreakupResponse;
      [k: string]: unknown;
    };
    return (raw?.data ?? response) as CanGstBreakupResponse;
  } catch (error) {
    console.error("Error fetching CAN calculate-gst-breakup:", error);
    return null;
  }
}

export async function resolveCanSacWiseTotals(
  country: UserCountryProfile,
  shipmentId?: string | null,
): Promise<CanSacWiseTotal[]> {
  if (!isIndianUserFromProfile(country)) return [];

  const trimmedShipmentId = String(shipmentId ?? "").trim();
  if (!trimmedShipmentId) return [];

  const breakup = await fetchCanGstBreakup(trimmedShipmentId);
  return breakup?.sac_wise_totals ?? [];
}
