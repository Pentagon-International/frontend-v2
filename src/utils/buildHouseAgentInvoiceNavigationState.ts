type HousingCharge = Record<string, unknown> & {
  pp_cc?: string;
  shipment_id?: string;
  shipper_id?: string;
};

type HousingDetail = Record<string, unknown> & {
  charges?: HousingCharge[];
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
  const shipmentId = String(
    fullDetail.shipment_id ?? fullDetail.shipment_no ?? "",
  ).trim();

  const collectCharges = (fullDetail.charges ?? [])
    .filter((charge) => String(charge.pp_cc ?? "").trim() === "Collect")
    .map((charge) => ({
      ...charge,
      shipment_id: String(charge.shipment_id ?? shipmentId).trim(),
      shipper_id: String(
        charge.shipper_id ??
          fullDetail.shipper_code ??
          fullDetail.shipper_id ??
          "",
      ).trim(),
    }));

  const detailForInvoice = {
    ...fullDetail,
    charges: collectCharges,
  };

  return {
    serviceType,
    hawbDetails: [detailForInvoice],
    housingDetails: [detailForInvoice],
    is_agent: true,
    fromHouseLevel: true,
    ...(locationState?.job && { job: locationState.job }),
    ...(locationState?.mblDetails && {
      mblDetails: locationState.mblDetails,
    }),
    ...(locationState?.mawbDetails && {
      mawbDetails: locationState.mawbDetails,
    }),
    ...(locationState?.carrierDetails && {
      carrierDetails: locationState.carrierDetails,
    }),
    ...(locationState?.routings && { routings: locationState.routings }),
  };
}
