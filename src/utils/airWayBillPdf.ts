import { URL } from "../api/serverUrls";
import useAuthStore from "../store/authStore";

export type AirWayBillPdfPayload = {
  housing_id: number;
  document: "awb";
};

/** housing_details[].id from job detail — not shipment_id or job id */
export function resolveHousingDetailsPrimaryKey(
  record: { id?: unknown } | null | undefined,
): number {
  const raw = record?.id;
  if (raw == null || raw === "") return 0;
  const id = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export async function fetchAirWayBillLabelPdf(
  housingId: number,
): Promise<Blob> {
  const housingPk = resolveHousingDetailsPrimaryKey({ id: housingId });
  if (!housingPk) {
    throw new Error("Invalid housing_details id for Air Way Bill PDF");
  }

  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${URL.base}job-create/air/pdf/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      housing_id: housingPk,
      document: "awb",
    } satisfies AirWayBillPdfPayload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.blob();
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
