import { URL } from "../api/serverUrls";
import useAuthStore from "../store/authStore";

export type AirExportAirPdfDocument = "awb" | "draft_awb" | "label";

export const AIR_EXPORT_AIR_PDF_MENU_DOCUMENTS = [
  "draft_awb",
  "awb",
  "label",
] as const satisfies readonly AirExportAirPdfDocument[];

export type AirExportAirPdfByHousingPayload = {
  housing_id: number;
  document: AirExportAirPdfDocument;
};

export type AirExportAirPdfByJobPayload = {
  job_id: number;
  document: AirExportAirPdfDocument;
};

export type AirExportAirPdfPayload =
  | AirExportAirPdfByHousingPayload
  | AirExportAirPdfByJobPayload;

/** housing_details[].id from job detail — not shipment_id or job id */
export function resolveHousingDetailsPrimaryKey(
  record: { id?: unknown } | null | undefined,
): number {
  const raw = record?.id;
  if (raw == null || raw === "") return 0;
  const id = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function resolveJobPrimaryKey(
  record: { id?: unknown; job_id?: unknown } | null | undefined,
): number {
  const raw = record?.id ?? record?.job_id;
  if (raw == null || raw === "") return 0;
  const id = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function getAirExportAirPdfMenuTitle(
  document: AirExportAirPdfDocument,
  referenceLabel?: string,
  options?: { includeReference?: boolean },
): string {
  const title =
    document === "draft_awb"
      ? "Draft Air Way Bill"
      : document === "awb"
        ? "Original Air Way Bill"
        : "Air Label";

  if (options?.includeReference) {
    const label = String(referenceLabel ?? "").trim();
    return label ? `${title} - ${label}` : title;
  }

  return title;
}

export function resolveAirExportHouseMenuLabel(
  house: { hawb_number?: string; shipment_id?: string },
  index: number,
): string {
  const hawbNo = String(house.hawb_number ?? "").trim();
  if (hawbNo) return hawbNo;
  const shipmentId = String(house.shipment_id ?? "").trim();
  if (shipmentId) return shipmentId;
  return `House${index + 1}`;
}

export function resolveAirExportMasterMenuLabel(
  job: { mawb_number?: string; mawb_no?: string; job_id?: unknown; id?: unknown },
  mawbNumber?: string,
): string {
  const mawb = String(
    mawbNumber ?? job.mawb_number ?? job.mawb_no ?? "",
  ).trim();
  if (mawb) return mawb;
  const jobId = job.job_id ?? job.id;
  if (jobId != null && String(jobId).trim() !== "") {
    return String(jobId);
  }
  return "Master";
}

export async function fetchAirExportAirPdf(
  payload: AirExportAirPdfPayload,
): Promise<Blob> {
  const token = useAuthStore.getState().accessToken;
  const body =
    "housing_id" in payload
      ? {
          housing_id: resolveHousingDetailsPrimaryKey({ id: payload.housing_id }),
          document: payload.document,
        }
      : {
          job_id: resolveJobPrimaryKey({ id: payload.job_id }),
          document: payload.document,
        };

  if ("housing_id" in body && !body.housing_id) {
    throw new Error("Invalid housing_details id for Air PDF");
  }
  if ("job_id" in body && !body.job_id) {
    throw new Error("Invalid job id for Air PDF");
  }

  const response = await fetch(`${URL.base}job-create/air/pdf/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.blob();
}

export async function fetchAirWayBillLabelPdf(
  housingId: number,
  document: AirExportAirPdfDocument = "awb",
): Promise<Blob> {
  return fetchAirExportAirPdf({ housing_id: housingId, document });
}

export async function fetchAirExportAirPdfByJob(
  jobId: number,
  document: AirExportAirPdfDocument,
): Promise<Blob> {
  return fetchAirExportAirPdf({ job_id: jobId, document });
}
