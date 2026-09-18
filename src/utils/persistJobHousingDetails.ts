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

/** Prefer first non-null, non-empty-string value (empty string must not mask job data). */
function firstFilled(...values: unknown[]): unknown {
  for (const v of values) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    return v;
  }
  return undefined;
}

function firstFilledString(...values: unknown[]): string {
  const v = firstFilled(...values);
  return v != null ? String(v) : "";
}

/**
 * Prefer populated nav array; fall back to job array when nav is empty/missing
 * so house PUT does not wipe master nested rows.
 */
function pickPopulatedArray(
  preferred: unknown,
  fallback: unknown,
): unknown[] | null {
  if (Array.isArray(preferred) && preferred.length > 0) return preferred;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return null;
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

  const socFlag = container.soc_flag;
  const cfsId = toPk(container.cfs_id);

  return {
    ...(container.id != null &&
      container.id !== "" && { id: Number(container.id) }),
    // Only send FK when we actually have a numeric pk (never a code string)
    ...(typeAsPk != null ? { container_type: typeAsPk } : {}),
    container_type_input: containerTypeInput,
    container_no: container.container_no ?? null,
    actual_seal_no: container.actual_seal_no ?? null,
    customs_seal_no: container.customs_seal_no ?? null,
    soc_flag:
      socFlag === true ? true : socFlag === false ? false : null,
    seal_type: container.seal_type ?? null,
    loading_date: formatDateYmd(container.loading_date),
    // API field is uploading_date (master Update); accept unloading_date from forms
    uploading_date: formatDateYmd(
      container.unloading_date ?? container.uploading_date,
    ),
    ...(cfsId != null ? { cfs_id: cfsId } : {}),
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
  const modeAlias = chargeKey === "mawb_charges" ? mawbCharges : mblCharges;
  const otherAlias = chargeKey === "mawb_charges" ? mblCharges : mawbCharges;

  // Prefer any non-empty source. Empty `charges: []` must not hide API rows
  // under mbl_charges/mawb_charges (that previously wiped charges on PUT).
  if (Array.isArray(charges) && charges.length > 0) return charges;
  if (Array.isArray(modeAlias) && modeAlias.length > 0) return modeAlias;
  if (Array.isArray(otherAlias) && otherAlias.length > 0) return otherAlias;

  // Explicit empty form `charges` = intentional clear for this house.
  if (Array.isArray(charges)) return charges;
  if (Array.isArray(modeAlias)) return modeAlias;
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

  const itemNoRaw = firstFilled(mbl.item_no, job.item_no);
  const igmNoRaw = firstFilled(mbl.igm_no, job.igm_no);

  const payload: Record<string, unknown> = {
    id: jobId,
    service: firstFilled(mbl.service, job.service) ?? job.service,
    ...(firstFilled(mbl.service_id, job.service_id) != null
      ? { service_id: firstFilled(mbl.service_id, job.service_id) }
      : {}),
    ...(firstFilled(mbl.service_code, job.service_code) != null
      ? { service_code: firstFilled(mbl.service_code, job.service_code) }
      : {}),
    pp_cc: firstFilledString(mbl.pp_cc, job.pp_cc) || "Collect",
    note: firstFilledString(mbl.note, job.note),
    ...(job.service_type != null ? { service_type: job.service_type } : {}),
    is_direct: mbl.is_direct ?? job.is_direct ?? false,
    agent:
      firstFilled(
        mbl.origin_agent,
        mbl.agent_code,
        mbl.agent,
        job.agent,
      ) ?? null,
    origin_code: firstFilled(mbl.origin_code, job.origin_code) ?? null,
    destination_code:
      firstFilled(mbl.destination_code, job.destination_code) ?? null,
    etd: formatMasterDate(etdSrc, isAir) ?? (isAir ? "" : null),
    eta: formatMasterDate(etaSrc, isAir) ?? (isAir ? "" : null),
    atd: formatMasterDate(firstFilled(mbl.atd, job.atd), isAir),
    ata: formatMasterDate(firstFilled(mbl.ata, job.ata), isAir),
    job_date: formatDateYmd(jobDateSrc),
    shipper_name: firstFilledString(mbl.shipper_name, job.shipper_name),
    shipper_email: firstFilledString(mbl.shipper_email, job.shipper_email),
    shipper_address: firstFilledString(
      mbl.shipper_address,
      job.shipper_address,
    ),
    consignee_name: firstFilledString(mbl.consignee_name, job.consignee_name),
    consignee_email: firstFilledString(
      mbl.consignee_email,
      job.consignee_email,
    ),
    consignee_address: firstFilledString(
      mbl.consignee_address,
      job.consignee_address,
    ),
    carrier_agent_name: firstFilledString(
      mbl.carrier_agent_name,
      job.carrier_agent_name,
    ),
    carrier_agent_email: firstFilledString(
      mbl.carrier_agent_email,
      job.carrier_agent_email,
    ),
    carrier_agent_address: firstFilledString(
      mbl.carrier_agent_address,
      job.carrier_agent_address,
    ),
    carrier_code: firstFilled(carrier.carrier_code, job.carrier_code) ?? null,
    vessel_name: firstFilled(carrier.vessel_name, job.vessel_name) ?? null,
    voyage_number:
      firstFilled(
        carrier.voyage_number,
        carrier.flight_number,
        job.voyage_number,
        job.flightno,
      ) ?? null,
    mbl_number: firstFilled(carrier.mbl_number, job.mbl_number) ?? null,
    mbl_date: formatDateYmd(firstFilled(carrier.mbl_date, job.mbl_date)),
    flightno:
      firstFilled(carrier.flight_number, job.flightno, carrier.voyage_number) ??
      null,
    mawb_no: firstFilled(carrier.mawb_number, job.mawb_no) ?? null,
    mawb_date: formatDateYmd(firstFilled(carrier.mawb_date, job.mawb_date)),
    igm_no: igmNoRaw != null ? String(igmNoRaw).trim() : null,
    igm_date: formatDateYmd(firstFilled(mbl.igm_date, job.igm_date)),
    item_no: itemNoRaw != null ? String(itemNoRaw).trim() : null,
    ...(bookingIds.length > 0 ? { booking_ids: bookingIds } : {}),
    housing_details: sanitizeHousingDetailsForPayload(
      updatedHousingDetails,
      isAir ? "mawb_charges" : "mbl_charges",
    ),
  };

  const routings = pickPopulatedArray(state.routings, job.ocean_routings);
  if (routings) {
    payload.ocean_routings = (routings as Record<string, unknown>[]).map(
      mapRoutingForPayload,
    );
  }

  const containers = pickPopulatedArray(
    state.containerDetails,
    job.container_details,
  );
  if (containers) {
    payload.container_details = (
      containers as Record<string, unknown>[]
    ).map(mapContainerForPayload);
  }

  const estimatesRaw = pickPopulatedArray(state.estimates, job.estimates);
  // Only include estimates when populated. Omitting preserves JobChargesDetails.
  if (estimatesRaw) {
    payload.estimates = (estimatesRaw as Record<string, unknown>[])
      .map(mapEstimateForPayload)
      .filter((row): row is Record<string, unknown> => row != null);
  }

  if (Array.isArray(state.document_ids) && state.document_ids.length > 0) {
    payload.document_ids = state.document_ids;
  } else if (Array.isArray(job.document_ids) && job.document_ids.length > 0) {
    payload.document_ids = job.document_ids;
  }

  return payload;
}

/**
 * After house PUT, refresh master snapshot in nav state from saved job
 * so subsequent house saves keep populated master fields.
 */
export function mergeMasterNavStateFromSavedJob(
  navState: Record<string, unknown> | null | undefined,
  savedJob: Record<string, unknown> | null,
): Record<string, unknown> {
  const state = { ...(navState ?? {}) } as Record<string, unknown>;
  if (!savedJob) return state;

  const masterKey =
    state.mawbDetails != null || savedJob.mawb_no != null
      ? "mawbDetails"
      : "mblDetails";
  const existingMaster = {
    ...((state[masterKey] as Record<string, unknown> | undefined) ?? {}),
  };
  const existingCarrier = {
    ...((state.carrierDetails as Record<string, unknown> | undefined) ?? {}),
  };

  state.job = savedJob;
  state[masterKey] = {
    ...existingMaster,
    service: firstFilled(savedJob.service, existingMaster.service),
    pp_cc: firstFilled(savedJob.pp_cc, existingMaster.pp_cc),
    note: firstFilled(savedJob.note, existingMaster.note) ?? existingMaster.note,
    origin_code: firstFilled(savedJob.origin_code, existingMaster.origin_code),
    origin_name: firstFilled(savedJob.origin_name, existingMaster.origin_name),
    destination_code: firstFilled(
      savedJob.destination_code,
      existingMaster.destination_code,
    ),
    destination_name: firstFilled(
      savedJob.destination_name,
      existingMaster.destination_name,
    ),
    etd: firstFilled(savedJob.etd, existingMaster.etd),
    eta: firstFilled(savedJob.eta, existingMaster.eta),
    atd: firstFilled(savedJob.atd, existingMaster.atd),
    ata: firstFilled(savedJob.ata, existingMaster.ata),
    job_date: firstFilled(savedJob.job_date, existingMaster.job_date),
    igm_no: firstFilled(savedJob.igm_no, existingMaster.igm_no),
    igm_date: firstFilled(savedJob.igm_date, existingMaster.igm_date),
    item_no: firstFilled(savedJob.item_no, existingMaster.item_no),
    shipper_name: firstFilled(savedJob.shipper_name, existingMaster.shipper_name),
    shipper_email: firstFilled(
      savedJob.shipper_email,
      existingMaster.shipper_email,
    ),
    shipper_address: firstFilled(
      savedJob.shipper_address,
      existingMaster.shipper_address,
    ),
    consignee_name: firstFilled(
      savedJob.consignee_name,
      existingMaster.consignee_name,
    ),
    consignee_email: firstFilled(
      savedJob.consignee_email,
      existingMaster.consignee_email,
    ),
    consignee_address: firstFilled(
      savedJob.consignee_address,
      existingMaster.consignee_address,
    ),
    carrier_agent_name: firstFilled(
      savedJob.carrier_agent_name,
      existingMaster.carrier_agent_name,
    ),
    carrier_agent_email: firstFilled(
      savedJob.carrier_agent_email,
      existingMaster.carrier_agent_email,
    ),
    carrier_agent_address: firstFilled(
      savedJob.carrier_agent_address,
      existingMaster.carrier_agent_address,
    ),
  };

  state.carrierDetails = {
    ...existingCarrier,
    carrier_code: firstFilled(savedJob.carrier_code, existingCarrier.carrier_code),
    carrier_name: firstFilled(savedJob.carrier_name, existingCarrier.carrier_name),
    vessel_name: firstFilled(savedJob.vessel_name, existingCarrier.vessel_name),
    voyage_number: firstFilled(
      savedJob.voyage_number,
      existingCarrier.voyage_number,
    ),
    flight_number: firstFilled(
      savedJob.flightno,
      existingCarrier.flight_number,
    ),
    mbl_number: firstFilled(savedJob.mbl_number, existingCarrier.mbl_number),
    mbl_date: firstFilled(savedJob.mbl_date, existingCarrier.mbl_date),
    mawb_number: firstFilled(savedJob.mawb_no, existingCarrier.mawb_number),
    mawb_date: firstFilled(savedJob.mawb_date, existingCarrier.mawb_date),
  };

  if (Array.isArray(savedJob.ocean_routings) && savedJob.ocean_routings.length > 0) {
    state.routings = savedJob.ocean_routings;
  }
  if (
    Array.isArray(savedJob.container_details) &&
    savedJob.container_details.length > 0
  ) {
    state.containerDetails = savedJob.container_details;
  }
  if (Array.isArray(savedJob.estimates) && savedJob.estimates.length > 0) {
    state.estimates = savedJob.estimates;
  }

  return state;
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
