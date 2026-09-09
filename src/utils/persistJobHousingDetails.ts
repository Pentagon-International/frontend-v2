import dayjs from "dayjs";
import { putAPICall } from "../service/putApiCall";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import { formatLocalDateTime } from "./localDateTime";
import {
  parseJobSaveResponse,
  resolveSavedJobId,
} from "./jobSaveResponse";
import { collectLinkedBookingIds } from "./bookingCreateJob";
import { parseNoOfUnitForPayload } from "./houseCargoChargeableWeight";
import {
  hasMeaningfulHouseChargeData,
  type HouseChargeLike,
} from "./houseChargesPayload";
import { roundRoeForPayload } from "./exchangeRateRoe";
import {
  roundLocalMoneyToDecimals,
  roundMoneyToDecimals,
} from "./nonDecimalMoneyAmount";

/** Coerce API FK/PK fields; reject non-numeric display strings (e.g. charge names). */
function toPk(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" && !/^\d+(\.\d+)?$/.test(value.trim())) {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDateYmd(value: unknown): string | null {
  if (value == null || value === "") return null;
  const d = dayjs(value as string | Date);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
}

function formatMasterDate(
  value: unknown,
  isAir: boolean,
): string | null {
  if (value == null || value === "") return null;
  if (isAir) {
    if (value instanceof Date) return formatLocalDateTime(value);
    if (typeof value === "string" && value.includes("T")) return value;
    const d = dayjs(value as string | Date);
    return d.isValid() ? formatLocalDateTime(d.toDate()) : null;
  }
  return formatDateYmd(value);
}

function mapRoutingForPayload(
  routing: Record<string, unknown>,
): Record<string, unknown> {
  const transportType = String(routing.transport_type || "").toLowerCase();
  const payload: Record<string, unknown> = {
    ...(routing.id !== undefined &&
      routing.id !== null &&
      routing.id !== "" && { id: Number(routing.id) }),
    transport_type: routing.transport_type
      ? String(routing.transport_type).toUpperCase()
      : null,
    from_port_code: routing.from_code ?? routing.from_port_code ?? null,
    to_port_code: routing.to_code ?? routing.to_port_code ?? null,
    etd: formatDateYmd(routing.etd),
    eta: formatDateYmd(routing.eta),
    atd: formatDateYmd(routing.atd),
    ata: formatDateYmd(routing.ata),
    carrier_code: null,
    vessel: null,
    flight: null,
    truck_no: null,
    rail_no: null,
    voyage_number: null,
  };

  if (transportType === "sea" || transportType === "vessel") {
    payload.vessel = routing.vessel ?? null;
    payload.voyage_number = routing.voyage_number ?? null;
  } else if (transportType === "air") {
    payload.carrier_code = routing.carrier_code ?? null;
    payload.flight = routing.flight ?? null;
  } else if (transportType === "road") {
    payload.carrier_code = routing.carrier_code ?? null;
    payload.truck_no = routing.truck_no ?? null;
  } else if (transportType === "rail") {
    payload.carrier_code = routing.carrier_code ?? null;
    payload.rail_no = routing.rail_no ?? null;
  } else {
    payload.carrier_code = routing.carrier_code ?? null;
    payload.vessel = routing.vessel ?? null;
    payload.flight = routing.flight ?? null;
    payload.truck_no = routing.truck_no ?? null;
    payload.rail_no = routing.rail_no ?? null;
    payload.voyage_number = routing.voyage_number ?? null;
  }
  return payload;
}

function mapContainerForPayload(
  container: Record<string, unknown>,
): Record<string, unknown> {
  // Master Update sends the type *code* as `container_type_input` (never as FK
  // `container_type`). Nav/form state stores the code in `container_type`; API
  // rows may expose it via `container_type_input` / `container_type_details`.
  const typeDetails = container.container_type_details as
    | { container_type_code?: string }
    | undefined;
  const rawType = container.container_type;
  const typeAsPk = toPk(rawType);
  const containerTypeInput =
    (container.container_type_input != null &&
    String(container.container_type_input).trim() !== ""
      ? String(container.container_type_input).trim()
      : null) ??
    (typeDetails?.container_type_code != null &&
    String(typeDetails.container_type_code).trim() !== ""
      ? String(typeDetails.container_type_code).trim()
      : null) ??
    (rawType != null &&
    String(rawType).trim() !== "" &&
    typeAsPk == null
      ? String(rawType).trim()
      : null);

  return {
    ...(container.id != null &&
      container.id !== "" && { id: Number(container.id) }),
    // Only send FK when we actually have a numeric pk (never a code string)
    ...(typeAsPk != null ? { container_type: typeAsPk } : {}),
    container_type_input: containerTypeInput,
    container_no: container.container_no ?? null,
    actual_seal_no: container.actual_seal_no ?? null,
    customs_seal_no: container.customs_seal_no ?? null,
    loading_date: formatDateYmd(container.loading_date),
    unloading_date: formatDateYmd(
      container.unloading_date ?? container.uploading_date,
    ),
  };
}

/**
 * Master Update estimate shape: charge_id PK only — never charge_name display string.
 */
function mapEstimateForPayload(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const chargeId = toPk(row.charge_id);
  const hasData =
    !!String(row.supplier_code ?? "").trim() ||
    !!String(row.supplier_name ?? "").trim() ||
    chargeId != null ||
    !!String(row.charge_name ?? "").trim() ||
    !!String(row.pp_cc ?? "").trim() ||
    toPk(row.unit_id) != null ||
    toPk(row.currency_id) != null ||
    row.no_of_unit != null ||
    row.cost_per_unit != null ||
    row.total_cost != null;
  if (!hasData) return null;

  const id = toPk(row.id);
  return {
    ...(id != null ? { id } : {}),
    supplier_code: row.supplier_code ? String(row.supplier_code) : null,
    charge_id: chargeId,
    pp_cc: String(row.pp_cc ?? ""),
    unit_id: toPk(row.unit_id),
    no_of_unit: parseNoOfUnitForPayload(row.no_of_unit),
    currency_id: toPk(row.currency_id),
    roe: roundRoeForPayload(row.roe as number | string | null) ?? null,
    cost_per_unit: roundMoneyToDecimals(row.cost_per_unit) ?? null,
    total_cost: roundMoneyToDecimals(row.total_cost) ?? null,
  };
}

/**
 * Master Update house charge shape: charge_id / unit_id / currency_id as PKs.
 * Omits charge_name / unit_code / currency display strings that break FK fields.
 */
function mapHouseChargeForPayload(
  charge: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!hasMeaningfulHouseChargeData(charge as HouseChargeLike)) return null;

  const id = toPk(charge.id);
  const unitId =
    toPk(charge.unit_id) ??
    toPk(charge.unit); // only if numeric pk, not unit_code
  const currencyId =
    toPk(charge.currency_id) ??
    toPk(charge.currency); // only if numeric pk, not currency code

  return {
    ...(id != null ? { id } : {}),
    charge_id: toPk(charge.charge_id),
    supplier_code:
      charge.supplier_code != null ? String(charge.supplier_code) : null,
    pp_cc: String(charge.pp_cc ?? ""),
    unit_id: unitId,
    currency_id: currencyId,
    no_of_unit: parseNoOfUnitForPayload(charge.no_of_unit),
    roe:
      charge.roe != null
        ? roundRoeForPayload(charge.roe as number | string | null)
        : null,
    amount_per_unit:
      charge.amount_per_unit != null
        ? roundMoneyToDecimals(charge.amount_per_unit)
        : null,
    amount:
      charge.amount != null ? roundMoneyToDecimals(charge.amount) : null,
    sell_local_amount:
      charge.sell_local_amount != null
        ? roundLocalMoneyToDecimals(charge.sell_local_amount)
        : (charge as { local_amount?: unknown }).local_amount != null
          ? roundLocalMoneyToDecimals(
              (charge as { local_amount?: unknown }).local_amount,
            )
          : null,
    unit_cost:
      charge.unit_cost != null
        ? roundMoneyToDecimals(charge.unit_cost)
        : (charge as { cost_per_unit?: unknown }).cost_per_unit != null
          ? roundMoneyToDecimals(
              (charge as { cost_per_unit?: unknown }).cost_per_unit,
            )
          : null,
    total_cost:
      charge.total_cost != null
        ? roundMoneyToDecimals(charge.total_cost)
        : null,
    cost_local_amount:
      charge.cost_local_amount != null
        ? roundLocalMoneyToDecimals(charge.cost_local_amount)
        : null,
  };
}

type HouseChargePayloadKey = "mawb_charges" | "mbl_charges";

function pickRawHouseCharges(
  house: Record<string, unknown>,
  chargeKey: HouseChargePayloadKey,
): unknown[] | null {
  const charges = house.charges;
  const mawbCharges = house.mawb_charges;
  const mblCharges = house.mbl_charges;

  // Form state writes the latest lines onto `charges`. Prefer that, then the
  // API alias for this mode, then the other alias.
  if (chargeKey === "mawb_charges") {
    if (Array.isArray(charges)) return charges;
    if (Array.isArray(mawbCharges)) return mawbCharges;
    if (Array.isArray(mblCharges)) return mblCharges;
    return null;
  }

  if (Array.isArray(mblCharges)) return mblCharges;
  if (Array.isArray(charges)) return charges;
  return null;
}

function omitHouseChargeAliases(
  house: Record<string, unknown>,
): Record<string, unknown> {
  const {
    charges: _charges,
    mbl_charges: _mblCharges,
    mawb_charges: _mawbCharges,
    ...rest
  } = house;
  return rest;
}

function mapHouseChargeRows(rawCharges: unknown[]): Record<string, unknown>[] {
  return (rawCharges as Record<string, unknown>[])
    .map(mapHouseChargeForPayload)
    .filter((row): row is Record<string, unknown> => row != null);
}

function sanitizeHousingDetailsForPayload(
  housingDetails: unknown[],
  chargeKey: HouseChargePayloadKey = "mbl_charges",
): unknown[] {
  return housingDetails.map((house) => {
    if (!house || typeof house !== "object" || Array.isArray(house)) {
      return house;
    }
    const h = house as Record<string, unknown>;
    const rawCharges = pickRawHouseCharges(h, chargeKey);

    // Air jobs accept house charges only on `mawb_charges`.
    if (chargeKey === "mawb_charges") {
      const rest = omitHouseChargeAliases(h);
      if (!rawCharges) return rest;
      return { ...rest, mawb_charges: mapHouseChargeRows(rawCharges) };
    }

    if (!rawCharges) return house;

    const mapped = mapHouseChargeRows(rawCharges);
    return {
      ...h,
      mbl_charges: mapped,
      ...(Array.isArray(h.charges) ? { charges: mapped } : {}),
    };
  });
}

/**
 * Build a full job update payload from house-page navigation state
 * (master form snapshot + all houses), matching master Update intent.
 */
export function buildFullJobUpdatePayloadFromHouseNav(
  jobId: number,
  updatedHousingDetails: unknown[],
  navState: unknown,
): Record<string, unknown> {
  const state = (navState ?? {}) as Record<string, unknown>;
  const job = (state.job ?? {}) as Record<string, unknown>;
  const mbl = (state.mblDetails ??
    state.mawbDetails ??
    {}) as Record<string, unknown>;
  const carrier = (state.carrierDetails ?? {}) as Record<string, unknown>;

  const serviceType = String(job.service_type ?? "").toLowerCase();
  const isImport = serviceType.includes("import");
  const isAir =
    state.mawbDetails != null ||
    carrier.flight_number != null ||
    carrier.mawb_number != null ||
    String(mbl.service ?? job.service ?? "")
      .toUpperCase()
      .includes("AIR");

  const etdSrc = mbl.etd ?? job.etd;
  const etaSrc = mbl.eta ?? job.eta;
  const jobDateSrc =
    mbl.job_date ?? (isImport ? etaSrc : etdSrc) ?? job.job_date;

  const bookingIds = collectLinkedBookingIds(
    updatedHousingDetails as Array<{ booking_id?: unknown }>,
    job.booking_ids,
  );

  const payload: Record<string, unknown> = {
    id: jobId,
    service: mbl.service ?? job.service,
    ...(mbl.service_id != null || job.service_id != null
      ? { service_id: mbl.service_id ?? job.service_id }
      : {}),
    ...(mbl.service_code != null || job.service_code != null
      ? { service_code: mbl.service_code ?? job.service_code }
      : {}),
    pp_cc: mbl.pp_cc ?? job.pp_cc ?? "Collect",
    note: mbl.note ?? job.note ?? "",
    ...(job.service_type != null ? { service_type: job.service_type } : {}),
    is_direct: mbl.is_direct ?? job.is_direct ?? false,
    agent:
      mbl.origin_agent ??
      mbl.agent_code ??
      mbl.agent ??
      job.agent ??
      null,
    origin_code: mbl.origin_code ?? job.origin_code ?? null,
    destination_code: mbl.destination_code ?? job.destination_code ?? null,
    etd: formatMasterDate(etdSrc, isAir) ?? (isAir ? "" : null),
    eta: formatMasterDate(etaSrc, isAir) ?? (isAir ? "" : null),
    atd: formatMasterDate(mbl.atd ?? job.atd, isAir),
    ata: formatMasterDate(mbl.ata ?? job.ata, isAir),
    job_date: formatDateYmd(jobDateSrc),
    shipper_name: mbl.shipper_name ?? job.shipper_name ?? "",
    shipper_email: mbl.shipper_email ?? job.shipper_email ?? "",
    shipper_address: mbl.shipper_address ?? job.shipper_address ?? "",
    consignee_name: mbl.consignee_name ?? job.consignee_name ?? "",
    consignee_email: mbl.consignee_email ?? job.consignee_email ?? "",
    consignee_address: mbl.consignee_address ?? job.consignee_address ?? "",
    carrier_agent_name:
      mbl.carrier_agent_name ?? job.carrier_agent_name ?? "",
    carrier_agent_email:
      mbl.carrier_agent_email ?? job.carrier_agent_email ?? "",
    carrier_agent_address:
      mbl.carrier_agent_address ?? job.carrier_agent_address ?? "",
    carrier_code: carrier.carrier_code ?? job.carrier_code ?? null,
    vessel_name: carrier.vessel_name ?? job.vessel_name ?? null,
    voyage_number:
      carrier.voyage_number ??
      carrier.flight_number ??
      job.voyage_number ??
      null,
    mbl_number: carrier.mbl_number ?? job.mbl_number ?? null,
    mbl_date: formatDateYmd(carrier.mbl_date ?? job.mbl_date),
    flightno: carrier.flight_number ?? job.flightno ?? null,
    mawb_no: carrier.mawb_number ?? job.mawb_no ?? null,
    mawb_date: formatDateYmd(carrier.mawb_date ?? job.mawb_date),
    igm_no:
      mbl.igm_no != null && String(mbl.igm_no).trim()
        ? String(mbl.igm_no).trim()
        : (job.igm_no ?? null),
    igm_date: formatDateYmd(mbl.igm_date ?? job.igm_date),
    ...(bookingIds.length > 0 ? { booking_ids: bookingIds } : {}),
    housing_details: sanitizeHousingDetailsForPayload(
      updatedHousingDetails,
      isAir ? "mawb_charges" : "mbl_charges",
    ),
  };

  const routings = Array.isArray(state.routings)
    ? state.routings
    : Array.isArray(job.ocean_routings)
      ? job.ocean_routings
      : null;
  if (routings) {
    payload.ocean_routings = (routings as Record<string, unknown>[]).map(
      mapRoutingForPayload,
    );
  }

  const containers = Array.isArray(state.containerDetails)
    ? state.containerDetails
    : Array.isArray(job.container_details)
      ? job.container_details
      : null;
  if (containers) {
    payload.container_details = (
      containers as Record<string, unknown>[]
    ).map(mapContainerForPayload);
  }

  const estimatesRaw = Array.isArray(state.estimates)
    ? state.estimates
    : Array.isArray(job.estimates)
      ? job.estimates
      : null;
  if (estimatesRaw) {
    payload.estimates = (estimatesRaw as Record<string, unknown>[])
      .map(mapEstimateForPayload)
      .filter((row): row is Record<string, unknown> => row != null);
  }

  if (Array.isArray(state.document_ids)) {
    payload.document_ids = state.document_ids;
  } else if (Array.isArray(job.document_ids)) {
    payload.document_ids = job.document_ids;
  }

  return payload;
}

/**
 * Persist full job update from house page (master snapshot + housing list).
 */
export async function persistJobHousingDetails(
  jobId: number,
  housingDetails: unknown[],
  navState?: unknown,
  fallbackMessage = "Job updated successfully",
): Promise<{
  message: string;
  job: Record<string, unknown> | null;
}> {
  const payload = buildFullJobUpdatePayloadFromHouseNav(
    jobId,
    housingDetails,
    navState,
  );
  const response = await putAPICall(URL.jobCreate, payload, API_HEADER);
  return parseJobSaveResponse(response, fallbackMessage);
}

export function resolveHouseJobIdFromLocationState(
  state: { job?: { id?: unknown } } | null | undefined,
): number | null {
  return resolveSavedJobId(
    (state?.job as Record<string, unknown> | undefined) ?? null,
    state?.job?.id,
  );
}
