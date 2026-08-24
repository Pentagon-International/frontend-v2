import { collectAgentChargesFromHousings } from "./collectAgentInvoiceCharges";

type HousingDetail = Record<string, unknown> & {
  charges?: Array<Record<string, unknown>>;
  shipment_id?: string;
  shipment_no?: string;
  shipper_code?: string;
  shipper_id?: string;
};

type HouseAgentInvoiceLocationState = {
  job?: Record<string, unknown>;
  mblDetails?: Record<string, unknown>;
  mawbDetails?: Record<string, unknown>;
  carrierDetails?: Record<string, unknown>;
  routings?: unknown;
};

export function buildHouseAgentInvoiceNavigationState(
  fullDetail: HousingDetail,
  locationState: HouseAgentInvoiceLocationState | null | undefined,
  serviceType: string | string[],
) {
  const detailForInvoice = {
    ...fullDetail,
    charges: collectAgentChargesFromHousings([fullDetail]),
  };

  return {
    serviceType,
    hawbDetails: [detailForInvoice],
    housingDetails: [detailForInvoice],
    is_agent: true,
    fromHouseLevel: true,
    ...(locationState?.job != null ? { job: locationState.job } : {}),
    ...(locationState?.mblDetails != null
      ? { mblDetails: locationState.mblDetails }
      : {}),
    ...(locationState?.mawbDetails != null
      ? { mawbDetails: locationState.mawbDetails }
      : {}),
    ...(locationState?.carrierDetails != null
      ? { carrierDetails: locationState.carrierDetails }
      : {}),
    ...(locationState?.routings != null
      ? { routings: locationState.routings }
      : {}),
  };
}
