import { URL } from "../../../api/serverUrls";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";

export type ChaServiceMasterItem = {
  id?: number;
  service_code: string;
  service_name: string;
  transport_mode?: string;
  full_groupage?: string;
  import_export?: string;
  status?: string;
};

export async function fetchChaServices(
  serviceCodes: string[],
): Promise<ChaServiceMasterItem[]> {
  const response = await getAPICall(`${URL.serviceMaster}`, API_HEADER);
  const all = Array.isArray(response) ? response : [];
  const codeSet = new Set(serviceCodes.map(String));
  return (all as ChaServiceMasterItem[]).filter(
    (item) =>
      codeSet.has(String(item.service_code)) &&
      (item.status == null || item.status === "ACTIVE"),
  );
}

export async function fetchServiceMasterByCode(
  serviceCode: string,
): Promise<ChaServiceMasterItem | null> {
  if (!serviceCode.trim()) return null;
  const response = await getAPICall(
    `${URL.serviceMaster}?service_code=${encodeURIComponent(serviceCode.trim())}`,
    API_HEADER,
  );
  if (Array.isArray(response) && response.length > 0) {
    return response[0] as ChaServiceMasterItem;
  }
  if (response && typeof response === "object" && "service_code" in response) {
    return response as ChaServiceMasterItem;
  }
  return null;
}

/** Map a CHA service master row to job-create service payload fields. */
export function resolveChaServicePayload(
  service: ChaServiceMasterItem,
  serviceType: "Import" | "Export",
): {
  service: string;
  service_code: string;
  service_id: string;
  service_type: "Import" | "Export";
} {
  let serviceValue: string;
  if (service.transport_mode === "AIR") {
    serviceValue = "AIR";
  } else {
    serviceValue = service.full_groupage === "FULL" ? "FCL" : "LCL";
  }
  return {
    service: serviceValue,
    service_code: String(service.service_code),
    service_id: service.id != null ? String(service.id) : "",
    service_type: serviceType,
  };
}

export function buildChaListFilters(config: {
  serviceCodes: string[];
  serviceType: "Import" | "Export";
}): Record<string, string | string[] | boolean> {
  return {
    is_service_job: true,
    service_code: config.serviceCodes,
    service_type: config.serviceType,
  };
}

/** Fetch a single job-create record by id (full detail for edit). */
export async function fetchJobCreateById(
  id: number,
): Promise<Record<string, unknown> | null> {
  const jobListRes = await getAPICall(`${URL.jobCreate}${id}/`, API_HEADER);
  const body = (jobListRes as { data?: unknown })?.data ?? jobListRes;
  const list = Array.isArray((body as { data?: unknown[] })?.data)
    ? (body as { data: unknown[] }).data
    : Array.isArray(body)
      ? (body as unknown[])
      : [];
  return list.length > 0 ? (list[0] as Record<string, unknown>) : null;
}
