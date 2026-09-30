import dayjs from "dayjs";
import type { ChaJobConfig } from "./chaJobConfig";
import { pickChaCustomsFromAgentPayload } from "./chaJobCustomsFields";
import { pickChaMasterTransportPayload } from "./chaJobMasterSnapshot";

function formatMasterDocDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (!dayjs(value as string | Date).isValid()) return null;
  return dayjs(value as string | Date).format("YYYY-MM-DD");
}

/**
 * Keep the freight house payload intact for CHA. Only clear origin/destination
 * agent fields and normalize the house number onto hbl_number (air CHA stores
 * HAWB there when hawb_no is empty).
 */
function mapHousingForChaServiceJob(
  house: Record<string, unknown>,
): Record<string, unknown> {
  const houseNo =
    house.hawb_no ??
    house.hawb_number ??
    house.hbl_number ??
    house.hbl_no ??
    null;

  return {
    ...house,
    agent: null,
    agent_name: null,
    agent_address: null,
    agent_email: null,
    hbl_number: houseNo,
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
 * Transform a normal (agent) job payload for CHA job pages.
 * Keeps the freight payload fields (note, IGM, ATD/ATA, routings, estimates,
 * booking_ids, house parties, etc.) and only applies CHA overrides:
 * `is_service_job: false`, `service_id`, cleared origin/destination agent,
 * and BOE/SB customs when present.
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

  return {
    ...agentPayload,
    is_service_job: false,
    service_id: serviceId ? Number(serviceId) : null,
    ...pickChaMasterTransportPayload(agentPayload, transportMode),
    ...pickChaCustomsFromAgentPayload(agentPayload),
    // Air CHA forms use mawb_*; job master still persists via mbl_* aliases.
    mbl_number: mblNumber,
    mbl_date: mblDate,
    housing_details: houses.map((house) =>
      mapHousingForChaServiceJob(house as Record<string, unknown>),
    ),
  };
}
