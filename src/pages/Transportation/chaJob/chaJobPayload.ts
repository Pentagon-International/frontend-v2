import dayjs from "dayjs";
import { formatLocalDateTime } from "../../../utils/localDateTime";
import type { ChaJobConfig } from "./chaJobConfig";
import { pickChaHouseBlPayloadFields } from "./chaHouseBlFields";
import { pickChaMasterTransportPayload } from "./chaJobMasterSnapshot";

function isAirTransport(mode: string): boolean {
  const m = (mode || "").trim().toUpperCase();
  return m === "AIR" || m === "NA";
}

function formatChaJobDate(
  value: unknown,
  transportMode: string,
): string | null {
  if (value == null || value === "") return null;
  if (!dayjs(value as string | Date).isValid()) return null;
  if (isAirTransport(transportMode)) {
    return formatLocalDateTime(value as Date);
  }
  return dayjs(value as string | Date).format("YYYY-MM-DD");
}

function formatMasterDocDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (!dayjs(value as string | Date).isValid()) return null;
  return dayjs(value as string | Date).format("YYYY-MM-DD");
}

function mapHousingForChaServiceJob(
  house: Record<string, unknown>,
  transportMode: string,
): Record<string, unknown> {
  const chargesKey = isAirTransport(transportMode)
    ? "mawb_charges"
    : "mbl_charges";
  const houseNo =
    house.hawb_no ??
    house.hawb_number ??
    house.hbl_number ??
    house.hbl_no ??
    null;

  const charges = house[chargesKey] ?? house.charges ?? [];

  return {
    ...(Number(house.id) > 0 && { id: Number(house.id) }),
    ...(house.shipment_id != null &&
      house.shipment_id !== "" && {
        shipment_id: house.shipment_id,
      }),
    pp_cc: house.pp_cc ?? null,
    routed: house.routed ?? null,
    routed_by: house.routed_by ?? null,
    origin_code: house.origin_code ?? null,
    destination_code: house.destination_code ?? null,
    shipper_name: house.shipper_name ?? "",
    shipper_email: house.shipper_email ?? "",
    shipper_address: house.shipper_address ?? "",
    consignee_name: house.consignee_name ?? "",
    consignee_email: house.consignee_email ?? "",
    consignee_address: house.consignee_address ?? "",
    carrier_agent_name: house.carrier_agent_name ?? "",
    carrier_agent_email: house.carrier_agent_email ?? "",
    carrier_agent_address: house.carrier_agent_address ?? "",
    hbl_number: houseNo,
    ...pickChaHouseBlPayloadFields(
      house as { bl_no?: string | null; bl_date?: string | Date | null },
    ),
    ...(house.shipment_terms_code != null &&
      String(house.shipment_terms_code).trim() !== "" && {
        shipment_terms_code: house.shipment_terms_code,
      }),
    ...(house.shipment_terms_name != null &&
      String(house.shipment_terms_name).trim() !== "" && {
        shipment_terms_name: house.shipment_terms_name,
      }),
    commodity_description: house.commodity_description ?? null,
    marks_no: house.marks_no ?? null,
    cargo_details: Array.isArray(house.cargo_details)
      ? house.cargo_details
      : [],
    [chargesKey]: Array.isArray(charges) ? charges : [],
  };
}

/** Page heading for CHA job create/edit/view screens. */
export function getChaJobPageTitle(
  chaConfig: ChaJobConfig,
  mode: "create" | "edit" | "view",
): string {
  const label = chaConfig.pageTitle;
  if (mode === "view") return `View ${label}`;
  if (mode === "edit") return `Edit ${label}`;
  return `Create ${label}`;
}

/**
 * Transform a normal (agent) job payload into a service-job payload for CHA jobs.
 * Keeps the normal job UI while submitting `is_service_job` + `service_id`.
 */
export function buildChaServiceJobPayload(input: {
  agentPayload: Record<string, unknown>;
  serviceId: number | string | null | undefined;
  transportMode: "AIR" | "SEA";
}): Record<string, unknown> {
  const { agentPayload, serviceId, transportMode } = input;
  const houses = Array.isArray(agentPayload.housing_details)
    ? agentPayload.housing_details
    : [];

  const mblNumber =
    agentPayload.mbl_number ?? agentPayload.mawb_no ?? null;
  const mblDate = formatMasterDocDate(
    agentPayload.mbl_date ?? agentPayload.mawb_date,
  );

  const containerDetails = agentPayload.container_details;
  const documentIds = agentPayload.document_ids;

  return {
    is_service_job: true,
    service_id: serviceId ? Number(serviceId) : null,
    ...pickChaMasterTransportPayload(agentPayload, transportMode),
    pp_cc: agentPayload.pp_cc ?? "Collect",
    origin_code: agentPayload.origin_code ?? null,
    destination_code: agentPayload.destination_code ?? null,
    etd: formatChaJobDate(agentPayload.etd, transportMode),
    eta: formatChaJobDate(agentPayload.eta, transportMode),
    job_date:
      agentPayload.job_date != null
        ? formatMasterDocDate(agentPayload.job_date)
        : null,
    shipper_name: agentPayload.shipper_name ?? "",
    shipper_email: agentPayload.shipper_email ?? "",
    shipper_address: agentPayload.shipper_address ?? "",
    consignee_name: agentPayload.consignee_name ?? "",
    consignee_email: agentPayload.consignee_email ?? "",
    consignee_address: agentPayload.consignee_address ?? "",
    carrier_agent_name: agentPayload.carrier_agent_name ?? "",
    carrier_agent_email: agentPayload.carrier_agent_email ?? "",
    carrier_agent_address: agentPayload.carrier_agent_address ?? "",
    mbl_number: mblNumber,
    mbl_date: mblDate,
    ...(Array.isArray(containerDetails) &&
      containerDetails.length > 0 && {
        container_details: containerDetails,
      }),
    housing_details: houses.map((house) =>
      mapHousingForChaServiceJob(
        house as Record<string, unknown>,
        transportMode,
      ),
    ),
    ...(Array.isArray(documentIds) &&
      documentIds.length > 0 && { document_ids: documentIds }),
  };
}
