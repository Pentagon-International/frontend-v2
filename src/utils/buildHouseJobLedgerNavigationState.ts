type HousingDetail = Record<string, unknown> & {
  hbl_number?: string;
  hawb_number?: string;
};

type HouseJobLedgerLocationState = {
  job?: Record<string, unknown> & {
    id?: string | number;
    job_id?: string | number;
  };
  mblDetails?: Record<string, unknown>;
  mawbDetails?: Record<string, unknown>;
  carrierDetails?: Record<string, unknown>;
  routings?: unknown;
};

export function resolveHouseHblHawbNo(
  houseDetail: HousingDetail | null | undefined,
): string {
  if (!houseDetail) return "";
  return String(
    houseDetail.hbl_number ?? houseDetail.hawb_number ?? "",
  ).trim();
}

export function buildHouseJobLedgerNavigationState(
  houseDetail: HousingDetail,
  locationState: HouseJobLedgerLocationState | null | undefined,
  options: {
    serviceName: string;
    jobId?: string | number | null;
    jobReturnTo: string;
    jobReturnToState?: unknown;
  },
) {
  const hbl_hawb_no = resolveHouseHblHawbNo(houseDetail);
  const jobId =
    options.jobId ??
    locationState?.job?.job_id ??
    locationState?.job?.id ??
    null;

  return {
    ...(jobId != null ? { jobId: String(jobId) } : {}),
    service_name: options.serviceName,
    ...(hbl_hawb_no ? { hbl_hawb_no } : {}),
    jobReturnTo: options.jobReturnTo,
    ...(options.jobReturnToState != null
      ? { jobReturnToState: options.jobReturnToState }
      : {}),
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
    housingDetails: [houseDetail],
    hawbDetails: [houseDetail],
  };
}
