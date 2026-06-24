import { URL } from "../api/serverUrls";
import { postAPICall } from "../service/postApiCall";
import { API_HEADER } from "../store/storeKeys";

export async function fetchJobInvoiceList<T>(
  shipmentNo: string,
  isAgent: boolean,
): Promise<T[]> {
  const res = await postAPICall(
    URL.invoiceCombined,
    { filters: { shipment_no: shipmentNo, is_agent: isAgent } },
    API_HEADER,
  );
  const data = (res as { data?: T[] })?.data;
  return Array.isArray(data) ? data : [];
}
