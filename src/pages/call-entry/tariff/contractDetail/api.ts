import { URL } from "../../../../api/serverUrls";
import { apiCallProtected } from "../../../../api/axios";
import type { ContractDetailResponse } from "./types";

export async function fetchContractDetail(
  carrierCode: string,
  service: string,
): Promise<ContractDetailResponse> {
  const response = (await apiCallProtected.get(
    `${URL.get_contract}${encodeURIComponent(carrierCode)}/?service=${encodeURIComponent(service)}`,
  )) as ContractDetailResponse;

  return {
    status: Boolean(response?.status),
    message: response?.message,
    vendor_reference: response?.vendor_reference ?? "",
    is_legacy: response?.is_legacy,
    is_editable: response?.is_editable,
    contract_basics: response?.contract_basics,
    rate_sheet: Array.isArray(response?.rate_sheet) ? response.rate_sheet : [],
    rate_sheet_summary: response?.rate_sheet_summary ?? {
      lane_count: 0,
      min_rate: "0",
      max_rate: "0",
      avg_rate: "0",
    },
    surcharges: Array.isArray(response?.surcharges) ? response.surcharges : [],
    surcharges_summary: response?.surcharges_summary ?? {
      applied_count: 0,
      total_rows: 0,
    },
    internal_notes: response?.internal_notes ?? null,
    created_at: response?.created_at,
    updated_at: response?.updated_at,
  };
}
