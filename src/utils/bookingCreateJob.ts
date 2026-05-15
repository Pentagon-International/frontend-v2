import type { NavigateFunction } from "react-router-dom";
import dayjs from "dayjs";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { getAPICall } from "../service/getApiCall";
import { API_HEADER } from "../store/storeKeys";
import { ToastNotification } from "../components";

export type BookingCreateJobMode =
  | "air-export"
  | "air-import"
  | "ocean-export"
  | "ocean-import";

const JOB_EDIT_PATH: Record<BookingCreateJobMode, string> = {
  "air-export": "/air/export-job/edit",
  "air-import": "/air/import-job/edit",
  "ocean-export": "/SeaExport/export-job/edit",
  "ocean-import": "/SeaExport/import-job/edit",
};

function formatRoutingDate(value: unknown): string | null {
  if (!value) return null;
  const d = dayjs(value as string);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
}

function mapOceanRoutings(booking: Record<string, unknown>, transportType: string) {
  const routingDetails = Array.isArray(booking.routing_details)
    ? booking.routing_details
    : [];
  return routingDetails.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      transport_type: transportType,
      from_port_code:
        row.from_port_code || row.from_location_code || row.from_code || "",
      to_port_code:
        row.to_port_code || row.to_location_code || row.to_code || "",
      carrier_code: row.carrier_code || row.carrier_name || "",
      flight: row.flight || row.flight_no || "",
      rail_no: row.rail_no || "",
      truck_no: row.truck_no || "",
      voyage_number: row.voyage_number || row.voyage_no || "",
      vessel: row.vessel || row.vessel_name || booking.vessel_name || "",
      etd: formatRoutingDate(row.etd),
      eta: formatRoutingDate(row.eta),
      atd: formatRoutingDate(row.atd),
      ata: formatRoutingDate(row.ata),
    };
  });
}

function mapCargoDetails(booking: Record<string, unknown>) {
  const cargo = Array.isArray(booking.cargo_details) ? booking.cargo_details : [];
  return cargo.map((c) => {
    const row = c as Record<string, unknown>;
    return {
      no_of_packages: row.no_of_packages || row.no_of_containers || "",
      gross_weight: row.gross_weight || "",
      volume: row.volume || "",
      chargeable_weight: row.chargeable_weight || "",
      haz: booking.is_hazardous ?? "",
    };
  });
}

function mapMawbCharges(booking: Record<string, unknown>) {
  const rates = Array.isArray(booking.rate_details) ? booking.rate_details : [];
  return rates.map((c) => {
    const row = c as Record<string, unknown>;
    return {
      charge_id: row.charge_id || "",
      supplier_code: "",
      pp_cc: row.pp_cc || "",
      unit_id: row.unit_id || "",
      no_of_unit: row.no_of_units || row.no_of_unit || "",
      amount: row.min_sell || row.sell_amount_total || "",
      amount_per_unit: row.sell_per_unit || "",
      cost_local_amount: "",
      currency_id: row.currency_id || "",
      roe: row.roe || "",
      sell_local_amount: "",
      total_cost: row.total_cost || "",
      unit_cost: row.cost_per_unit || "",
    };
  });
}

function mapEvents(booking: Record<string, unknown>) {
  const events = Array.isArray(booking.events) ? booking.events : [];
  return events.map((e) => {
    const row = e as Record<string, unknown>;
    return {
      event_id: row.event_id || "",
      event_name: row.event_name || "",
      event_date: row.event_date || "",
      event_status: row.event_status || "",
      event_description: row.event_description || "",
      event_type: row.event_type || "",
      event_priority: row.event_priority || "",
      event_location: row.event_location || "",
    };
  });
}

function buildAirHousing(booking: Record<string, unknown>, trade: string) {
  return {
    booking_id: booking.id,
    hawb_no: booking.mawb_no || booking.houseno || "",
    origin_code: booking.origin_code || booking.origin_code_read || "",
    destination_code:
      booking.destination_code || booking.destination_code_read || "",
    trade,
    routed: booking.routed || "",
    routed_by: booking.routed_by || "",
    customer_service: booking.customer_service_name || "",
    agent_name:
      booking.destination_agent_name || booking.agent_name || "",
    agent_address:
      booking.destination_agent_address || booking.agent_address || "",
    agent_email:
      booking.destination_agent_email || booking.agent_email || "",
    shipper_name: booking.shipper_name || booking.customer_name || "",
    shipper_address: booking.shipper_address || "",
    shipper_email: booking.shipper_email || "",
    consignee_name: booking.consignee_name || "",
    consignee_address: booking.consignee_address || "",
    consignee_email: booking.consignee_email || "",
    notify1_customer_name:
      booking.notify1_customer_name || booking.notify_customer_name || "",
    notify1_customer_address:
      booking.notify1_customer_address || booking.notify_customer_address || "",
    notify1_customer_email:
      booking.notify1_customer_email || booking.notify_customer_email || "",
    cha_name: booking.cha || booking.cha_name || "",
    cha_address: booking.cha_address || "",
    commodity_description: booking.commodity_description || "",
    marks_no: booking.marks_no || "",
    shipment_terms_code:
      booking.shipment_terms_code || booking.shipment_terms_code_read || "",
    cargo_details: mapCargoDetails(booking),
    mawb_charges: mapMawbCharges(booking),
    events: mapEvents(booking),
  };
}

function buildOceanHousing(booking: Record<string, unknown>, trade: string) {
  return {
    booking_id: booking.id,
    hbl_number: booking.houseno || booking.house_no || booking.mawb_no || "",
    origin_code: booking.origin_code || booking.origin_code_read || "",
    destination_code:
      booking.destination_code || booking.destination_code_read || "",
    trade,
    routed: booking.routed || "",
    routed_by: booking.routed_by || "",
    customer_service: booking.customer_service_name || "",
    agent_name:
      booking.destination_agent_name ||
      booking.forwarder_name ||
      booking.agent_name ||
      "",
    agent_address: booking.destination_agent_address || booking.agent_address || "",
    agent_email: booking.destination_agent_email || booking.agent_email || "",
    shipper_name: booking.shipper_name || booking.customer_name || "",
    shipper_address: booking.shipper_address || "",
    shipper_email: booking.shipper_email || "",
    consignee_name: booking.consignee_name || "",
    consignee_address: booking.consignee_address || "",
    consignee_email: booking.consignee_email || "",
    notify1_customer_name:
      booking.notify1_customer_name || booking.notify_customer_name || "",
    notify1_customer_address:
      booking.notify1_customer_address || booking.notify_customer_address || "",
    notify1_customer_email:
      booking.notify1_customer_email || booking.notify_customer_email || "",
    cha_name: booking.cha || booking.cha_name || "",
    cha_address: booking.cha_address || "",
    commodity_description: booking.commodity_description || "",
    marks_no: booking.marks_no || "",
    shipment_terms_code:
      booking.shipment_terms_code || booking.shipment_terms_code_read || "",
    cargo_details: mapCargoDetails(booking),
    events: mapEvents(booking),
  };
}

export function buildJobCreatePayloadFromBooking(
  booking: Record<string, unknown>,
  mode: BookingCreateJobMode,
): Record<string, unknown> {
  const isAir = mode === "air-export" || mode === "air-import";
  const serviceType =
    mode === "air-import" || mode === "ocean-import" ? "Import" : "Export";
  const service = String(booking.service || (isAir ? "AIR" : "FCL"));
  const routingTransport = isAir ? "Air" : "Sea";

  const base: Record<string, unknown> = {
    service,
    service_type: booking.service_type || serviceType,
    agent:
      booking.destination_agent_code ||
      booking.origin_agent ||
      booking.agent_code ||
      "",
    origin_code: booking.origin_code || booking.origin_code_read || "",
    destination_code:
      booking.destination_code || booking.destination_code_read || "",
    etd: formatRoutingDate(booking.etd),
    eta: formatRoutingDate(booking.eta),
    atd: formatRoutingDate(booking.atd),
    ata: formatRoutingDate(booking.ata),
    carrier_code: booking.carrier_code || booking.carrier_code_read || "",
    carrier_booking_no: booking.carrier_booking_no || "",
    voyage_number: booking.voyage_no || booking.voyage_number || "",
    estimates: [],
    ocean_routings: mapOceanRoutings(booking, routingTransport),
    housing_details: [
      isAir
        ? buildAirHousing(
            booking,
            mode === "air-export" ? "Re Export" : "Import",
          )
        : buildOceanHousing(
            booking,
            mode === "ocean-export" ? "Export" : "Import",
          ),
    ],
  };

  if (isAir) {
    return {
      ...base,
      flightno: booking.flight_no || booking.flightno || "",
      is_direct: booking.is_direct ?? false,
      mawb_no: booking.mawb_no || "",
      mbl_date: formatRoutingDate(booking.mawb_date),
    };
  }

  return {
    ...base,
    is_direct: booking.is_direct ?? false,
    vessel_name: booking.vessel_name || null,
    mbl_number: booking.mawb_no || booking.mbl_number || null,
    mbl_date: formatRoutingDate(booking.mbl_date || booking.mawb_date),
    ...(mode === "ocean-import"
      ? {
          igm_no: booking.igm_no ? String(booking.igm_no).trim() : null,
          igm_date: formatRoutingDate(booking.igm_date),
        }
      : {}),
  };
}

export function extractJobDetailsIdFromResponse(
  response: unknown,
): number | undefined {
  const r = response as Record<string, unknown>;
  const data = (r?.data as Record<string, unknown> | undefined) ?? r;
  const nested = data?.data as Record<string, unknown> | undefined;
  const candidates = [
    nested?.job_details_id,
    nested?.id,
    data?.job_details_id,
    data?.id,
    r?.job_details_id,
    r?.id,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const n = typeof c === "number" ? c : Number(String(c).trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

export async function fetchJobRecordByDetailsId(
  jobDetailsId: number,
): Promise<Record<string, unknown> | null> {
  const jobListRes = await getAPICall(
    `${URL.jobCreate}${jobDetailsId}/`,
    API_HEADER,
  );
  const body = (jobListRes as { data?: unknown })?.data ?? jobListRes;
  const list = Array.isArray((body as { data?: unknown[] })?.data)
    ? (body as { data: unknown[] }).data
    : Array.isArray(body)
      ? (body as unknown[])
      : [];
  return list.length > 0 ? (list[0] as Record<string, unknown>) : null;
}

export type CreateJobFromBookingOptions = {
  navigate: NavigateFunction;
  mode: BookingCreateJobMode;
  onStart?: () => void;
  onEnd?: () => void;
  invalidateList?: () => void;
};

export async function createJobFromBooking(
  booking: Record<string, unknown>,
  options: CreateJobFromBookingOptions,
): Promise<boolean> {
  const { navigate, mode, onStart, onEnd, invalidateList } = options;
  const jobEditPath = JOB_EDIT_PATH[mode];

  onStart?.();
  try {
    const payload = buildJobCreatePayloadFromBooking(booking, mode);
    const response = (await apiCallProtected.post(
      URL.jobCreate,
      payload,
    )) as unknown;
    const jobDetailsId = extractJobDetailsIdFromResponse(response);

    if (!jobDetailsId) {
      ToastNotification({
        type: "error",
        message: "Job was created but no job id was returned from the server.",
      });
      return false;
    }

    ToastNotification({
      type: "success",
      message: "Job created successfully",
    });

    invalidateList?.();

    let job: Record<string, unknown> | null = null;
    try {
      job = await fetchJobRecordByDetailsId(jobDetailsId);
    } catch (fetchErr) {
      console.error("Error fetching job after create:", fetchErr);
    }

    if (job) {
      navigate(jobEditPath, { state: { job } });
    } else {
      navigate(jobEditPath, { state: { jobId: jobDetailsId } });
    }
    return true;
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: {
        data?: { message?: string; detail?: string; error?: string };
      };
      message?: string;
    };
    const errMsg =
      axiosErr?.response?.data?.message ||
      axiosErr?.response?.data?.detail ||
      axiosErr?.response?.data?.error ||
      (err instanceof Error ? err.message : "Failed to create job");
    ToastNotification({ type: "error", message: String(errMsg) });
    return false;
  } finally {
    onEnd?.();
  }
}
