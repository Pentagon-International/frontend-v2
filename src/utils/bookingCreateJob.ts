import type { NavigateFunction } from "react-router-dom";
import dayjs from "dayjs";
import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";
import { getAPICall } from "../service/getApiCall";
import { API_HEADER } from "../store/storeKeys";
import useAuthStore from "../store/authStore";
import { ToastNotification } from "../components";
import {
  costLocalAmountForPayload,
  sellLocalAmountForPayload,
} from "./houseChargeAmounts";
import {
  parseJobDocumentsFromApi,
} from "./jobDocuments";
import {
  bindMoneyWholeNumberMode,
  isVietnamBranchFromUser,
  roundMoneyToDecimals,
} from "./nonDecimalMoneyAmount";
import { parseNoOfUnitForPayload } from "./houseCargoChargeableWeight";
import { pickPackageTypeCodeFromCargo } from "./packageTypeOptions";

export type BookingCreateJobMode =
  | "air-export"
  | "inland-export"
  | "inland-import"
  | "air-import"
  | "ocean-export"
  | "ocean-import";

const JOB_EDIT_PATH: Record<BookingCreateJobMode, string> = {
  "air-export": "/air/export-job/edit",
  "inland-export": "/inland/export-job/edit",
  "inland-import": "/inland/import-job/edit",
  "air-import": "/air/import-job/edit",
  "ocean-export": "/SeaExport/export-job/edit",
  "ocean-import": "/SeaExport/import-job/edit",
};

/** Ensure Vietnam whole-number money mode matches the logged-in branch. */
function syncBookingJobMoneyMode(): void {
  bindMoneyWholeNumberMode(
    isVietnamBranchFromUser(useAuthStore.getState().user),
  );
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

/** Monetary number for job payload (whole numbers for Vietnam, else 2 dp). */
function toMoneyOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n == null) return null;
  const rounded = roundMoneyToDecimals(n);
  return rounded == null || rounded === undefined ? null : rounded;
}

function toMoneyFormValue(value: unknown): string | number | "" {
  if (value == null || value === "") return "";
  const n = toMoneyOrNull(value);
  return n == null ? "" : n;
}

function formatRoutingDate(value: unknown): string | null {
  if (!value) return null;
  const d = dayjs(value as string);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
}

/** Booking header carrier only — not routing leg carrier. */
function resolveCarrierCode(booking: Record<string, unknown>): string {
  return String(booking.carrier_code ?? "").trim();
}

function resolveCarrierName(booking: Record<string, unknown>): string {
  return String(booking.carrier_name ?? "").trim();
}

/** Booking header flight number only — not routing leg flight. */
function resolveFlightNumber(booking: Record<string, unknown>): string {
  return String(
    booking.flight_no ?? booking.flightno ?? booking.flight_number ?? "",
  ).trim();
}

/** Booking header voyage number only — not routing leg voyage. */
function resolveVoyageNumber(booking: Record<string, unknown>): string {
  return String(booking.voyage_no ?? booking.voyage_number ?? "").trim();
}

function resolveVesselName(booking: Record<string, unknown>): string {
  return String(booking.vessel_name ?? "").trim();
}

/** House reference from booking (HAWB / HBL). */
function resolveBookingHouseNumber(booking: Record<string, unknown>): string {
  return String(
    booking.houseno ??
      booking.house_no ??
      booking.hawb_no ??
      booking.hawb_number ??
      booking.hbl_number ??
      "",
  ).trim();
}

/** Master reference from booking (MAWB / MBL). */
function resolveBookingMasterNumber(booking: Record<string, unknown>): string {
  return String(
    booking.mawb_no ??
      booking.master_no ??
      booking.mbl_number ??
      booking.masterno ??
      "",
  ).trim();
}

function isLclBooking(booking: Record<string, unknown>): boolean {
  return String(booking.service ?? "").trim().toUpperCase() === "LCL";
}

function isFclBooking(booking: Record<string, unknown>): boolean {
  return String(booking.service ?? "").trim().toUpperCase() === "FCL";
}

function resolveContainerTypeCode(cargo: Record<string, unknown>): string {
  return String(
    cargo.container_type_code ??
      cargo.container_type ??
      cargo.container_type_name ??
      "",
  ).trim();
}

function buildJobContainerDetailRow(
  containerType: string,
  containerNo?: string | null,
): Record<string, unknown> {
  const no = String(containerNo ?? "").trim();
  return {
    container_type_input: containerType || null,
    container_no: no || null,
    actual_seal_no: null,
    customs_seal_no: null,
    loading_date: null,
    uploading_date: null,
  };
}

/**
 * Ocean FCL booking cargo is grouped by container type:
 *   cargo_details[].container_type_code + cargo_details[].containers[]
 * Job container_details needs one row per physical container (type + container_no).
 */
function mapFclContainerDetailsFromBooking(
  cargoList: unknown[],
): Array<Record<string, unknown>> {
  if (!cargoList.length) return [];

  const containers: Array<Record<string, unknown>> = [];

  for (const cargo of cargoList) {
    const row = cargo as Record<string, unknown>;
    const containerType = resolveContainerTypeCode(row);
    const nested = Array.isArray(row.containers) ? row.containers : [];

    if (nested.length > 0) {
      for (const nestedRow of nested) {
        const container = nestedRow as Record<string, unknown>;
        const containerNo = String(container.container_no ?? "").trim();
        if (!containerNo && !containerType) continue;
        containers.push(buildJobContainerDetailRow(containerType, containerNo));
      }
      continue;
    }

    // Fallback: no nested list — use parent row (type + optional single container_no).
    // Prefer creating `no_of_containers` blank-number rows of the same type when count > 1.
    const declaredCount = toNumberOrNull(row.no_of_containers);
    const containerNo = String(row.container_no ?? "").trim();
    if (!containerNo && !containerType) continue;
    if (declaredCount != null && declaredCount > 1 && !nested.length) {
      for (let i = 0; i < Math.floor(declaredCount); i += 1) {
        containers.push(
          buildJobContainerDetailRow(
            containerType,
            i === 0 ? containerNo || null : null,
          ),
        );
      }
      continue;
    }
    containers.push(buildJobContainerDetailRow(containerType, containerNo));
  }

  return containers;
}

function mapContainerDetailsFromBooking(booking: Record<string, unknown>) {
  const cargoList = Array.isArray(booking.cargo_details)
    ? booking.cargo_details
    : [];

  if (isFclBooking(booking)) {
    return mapFclContainerDetailsFromBooking(cargoList);
  }

  if (!isLclBooking(booking)) return [];

  const containers: Array<Record<string, unknown>> = [];

  for (const cargo of cargoList) {
    const row = cargo as Record<string, unknown>;
    const containerType = resolveContainerTypeCode(row);
    const nested = Array.isArray(row.containers) ? row.containers : [];

    if (nested.length > 0) {
      for (const nestedRow of nested) {
        const container = nestedRow as Record<string, unknown>;
        const containerNo = String(container.container_no ?? "").trim();
        if (!containerNo && !containerType) continue;
        containers.push(buildJobContainerDetailRow(containerType, containerNo));
      }
      continue;
    }

    const containerNo = String(row.container_no ?? "").trim();
    if (!containerNo && !containerType) continue;
    containers.push(buildJobContainerDetailRow(containerType, containerNo));
  }

  return containers;
}

/** True when a booking routing leg has real data (not just move_type / status placeholders). */
function isRoutingRowDefined(row: Record<string, unknown>): boolean {
  return Boolean(
    row.from_port_code ||
      row.from_location_code ||
      row.from_code ||
      row.to_port_code ||
      row.to_location_code ||
      row.to_code ||
      row.carrier_code ||
      row.carrier_name ||
      row.etd ||
      row.eta ||
      row.atd ||
      row.ata ||
      row.flight ||
      row.flight_no ||
      row.rail_no ||
      row.truck_no ||
      row.voyage_number ||
      row.voyage_no ||
      row.vessel ||
      row.vessel_name,
  );
}

function mapRoutingTransportType(
  row: Record<string, unknown>,
  fallback: string,
): string {
  const move = String(row.move_type ?? "").trim().toUpperCase();
  if (move === "AIR") return "Air";
  if (move === "SEA") return "Sea";
  if (move === "ROAD") return "Road";
  if (move === "RAIL") return "Rail";
  return fallback;
}

function mapOceanRoutings(booking: Record<string, unknown>, transportType: string) {
  const routingDetails = (
    Array.isArray(booking.routing_details) ? booking.routing_details : []
  ).filter((r) => isRoutingRowDefined(r as Record<string, unknown>));

  if (routingDetails.length === 0) {
    return [];
  }

  return routingDetails.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      transport_type: mapRoutingTransportType(row, transportType),
      from_port_code:
        row.from_port_code || row.from_location_code || row.from_code || "",
      to_port_code:
        row.to_port_code || row.to_location_code || row.to_code || "",
      carrier_code: row.carrier_code || row.carrier_name || "",
      flight: row.flight || row.flight_no || "",
      rail_no: row.rail_no || "",
      truck_no: row.truck_no || "",
      voyage_number: row.voyage_number || row.voyage_no || "",
      vessel: row.vessel || row.vessel_name || "",
      etd: formatRoutingDate(row.etd),
      eta: formatRoutingDate(row.eta),
      atd: formatRoutingDate(row.atd),
      ata: formatRoutingDate(row.ata),
    };
  });
}

function mapCargoDetails(
  booking: Record<string, unknown>,
  transport: "air" | "ocean" = "ocean",
) {
  const cargo = Array.isArray(booking.cargo_details) ? booking.cargo_details : [];
  const isFclOcean =
    transport === "ocean" &&
    String(booking.service ?? "")
      .trim()
      .toUpperCase() === "FCL";
  const haz = booking.is_hazardous ?? "";

  // Ocean FCL: expand nested `containers[]` into house cargo rows (one per container_no).
  if (isFclOcean) {
    const expanded: Array<Record<string, unknown>> = [];
    for (const c of cargo) {
      const row = c as Record<string, unknown>;
      const nested = Array.isArray(row.containers) ? row.containers : [];
      if (nested.length > 0) {
        for (const nestedRow of nested) {
          const container = nestedRow as Record<string, unknown>;
          const containerNo = String(container.container_no ?? "").trim();
          expanded.push({
            container_no: containerNo || null,
            no_of_packages: toNumberOrNull(container.no_of_packages),
            package_type: pickPackageTypeCodeFromCargo(container) ||
              pickPackageTypeCodeFromCargo(row),
            package_type_code:
              pickPackageTypeCodeFromCargo(container) ||
              pickPackageTypeCodeFromCargo(row) ||
              null,
            gross_weight:
              container.gross_weight ?? row.gross_weight ?? "",
            volume: container.volume ?? row.volume ?? "",
            chargeable_weight:
              container.chargeable_weight ??
              row.chargeable_weight ??
              "",
            haz,
          });
        }
        continue;
      }
      expanded.push({
        container_no: String(row.container_no ?? "").trim() || null,
        no_of_packages: toNumberOrNull(row.no_of_packages),
        package_type: pickPackageTypeCodeFromCargo(row),
        package_type_code: pickPackageTypeCodeFromCargo(row) || null,
        gross_weight: row.gross_weight || "",
        volume: row.volume ?? "",
        chargeable_weight: row.chargeable_weight || "",
        haz,
      });
    }
    return expanded;
  }

  return cargo.map((c) => {
    const row = c as Record<string, unknown>;
    const noOfPackages =
      toNumberOrNull(row.no_of_packages) ?? toNumberOrNull(row.no_of_containers);

    return {
      no_of_packages: noOfPackages,
      package_type: pickPackageTypeCodeFromCargo(row),
      package_type_code: pickPackageTypeCodeFromCargo(row) || null,
      gross_weight: row.gross_weight || "",
      volume:
        transport === "air"
          ? row.volume_weight ?? row.volume ?? ""
          : row.volume ?? "",
      chargeable_weight: row.chargeable_weight || "",
      haz,
    };
  });
}

function normalizePpCc(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "PP" || raw === "PREPAID") return "Prepaid";
  if (raw === "CC" || raw === "COLLECT") return "Collect";
  return String(value ?? "").trim();
}

function resolveJobUnitFromBookingRow(row: Record<string, unknown>): {
  unit_id: number | null;
  unit_code: string;
} {
  const rawUnit = row.unit ?? row.unit_id;
  const explicitCode = String(row.unit_code ?? "").trim();
  if (rawUnit == null || rawUnit === "") {
    return { unit_id: null, unit_code: explicitCode };
  }
  const rawStr = String(rawUnit).trim();
  const asNum = Number(rawStr);
  if (Number.isFinite(asNum) && !Number.isNaN(asNum) && rawStr === String(asNum)) {
    return { unit_id: asNum, unit_code: explicitCode };
  }
  return { unit_id: null, unit_code: explicitCode || rawStr };
}

/** Map booking quotation/rate lines to job master-level estimates (FCL Export). */
function mapBookingRateDetailsToEstimates(booking: Record<string, unknown>) {
  const rates = Array.isArray(booking.rate_details) ? booking.rate_details : [];
  return rates.map((c) => {
    const row = c as Record<string, unknown>;
    const chargeId = row.charge_id != null ? Number(row.charge_id) : null;
    const { unit_id, unit_code } = resolveJobUnitFromBookingRow(row);
    return {
      supplier_code: null,
      charge_id: chargeId != null && !Number.isNaN(chargeId) ? chargeId : null,
      pp_cc: normalizePpCc(row.pp_cc) || "Prepaid",
      unit_id,
      ...(unit_code ? { unit_code } : {}),
      no_of_unit:
        parseNoOfUnitForPayload(row.no_of_units) ??
        parseNoOfUnitForPayload(row.no_of_unit),
      currency_id:
        row.currency_id != null
          ? Number(row.currency_id)
          : row.currency_country_code != null
            ? Number(row.currency_country_code)
            : null,
      roe: toNumberOrNull(row.roe) ?? 1,
      cost_per_unit:
        toMoneyOrNull(row.cost_per_unit) ?? toMoneyOrNull(row.sell_per_unit),
      total_cost:
        toMoneyOrNull(row.total_cost) ??
        toMoneyOrNull(row.min_sell) ??
        toMoneyOrNull(row.total_sell) ??
        toMoneyOrNull(row.sell_amount_total),
    };
  });
}

function getOceanExportService(booking: Record<string, unknown>): string {
  return String(booking.service ?? "FCL").trim().toUpperCase();
}

/** Job create API expects "Export" / "Import", not "EXPORT" / "IMPORT". */
function normalizeJobServiceType(
  value: unknown,
  fallback: "Export" | "Import",
): "Export" | "Import" {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const upper = raw.toUpperCase();
  if (upper === "IMPORT") return "Import";
  if (upper === "EXPORT") return "Export";
  if (raw === "Import" || raw === "Export") return raw;
  return fallback;
}

type OceanBookingChargeProfile = "fcl-export" | "lcl-export" | "other";

function getOceanBookingChargeProfile(
  mode: BookingCreateJobMode,
  booking: Record<string, unknown>,
): OceanBookingChargeProfile | null {
  if (mode !== "ocean-export" && mode !== "ocean-import") return null;
  const service = getOceanExportService(booking);
  if (mode === "ocean-export" && service === "FCL") return "fcl-export";
  if (mode === "ocean-export" && service === "LCL") return "lcl-export";
  return "other";
}

/** FCL export only: master-level estimates from booking rate_details. */
function shouldMapBookingChargesToEstimates(
  mode: BookingCreateJobMode,
  booking: Record<string, unknown>,
): boolean {
  return getOceanBookingChargeProfile(mode, booking) === "fcl-export";
}

function hasBookingRateDetails(booking: Record<string, unknown>): boolean {
  const rates = Array.isArray(booking.rate_details) ? booking.rate_details : [];
  return rates.length > 0;
}

/**
 * House charge lines for job create (mawb_charges / mbl_charges payload shape).
 * @param includeCost LCL export: true (sell + cost). FCL/other/air house: false (sell only).
 */
function mapHouseChargesFromBooking(
  booking: Record<string, unknown>,
  includeCost: boolean,
) {
  const rates = Array.isArray(booking.rate_details) ? booking.rate_details : [];
  return rates.map((c) => {
    const row = c as Record<string, unknown>;
    const noOfUnit = row.no_of_units || row.no_of_unit || "";
    const amountPerUnit = toMoneyFormValue(row.sell_per_unit);
    const amount = toMoneyFormValue(
      row.min_sell || row.total_sell || row.sell_amount_total || "",
    );
    const roe = row.roe ?? "";
    const totalCost = includeCost ? toMoneyFormValue(row.total_cost) : "";
    const unitCost = includeCost ? toMoneyFormValue(row.cost_per_unit) : "";
    return {
      charge_id: row.charge_id || "",
      supplier_code: "",
      pp_cc: row.pp_cc || "",
      unit_id: row.unit_id || row.unit || "",
      no_of_unit: noOfUnit,
      amount,
      amount_per_unit: amountPerUnit,
      currency_id: row.currency_id || row.currency_country_code || "",
      roe,
      sell_local_amount: sellLocalAmountForPayload(
        amount,
        roe,
        noOfUnit,
        amountPerUnit,
      ),
      total_cost: totalCost,
      unit_cost: unitCost,
      cost_local_amount: includeCost
        ? costLocalAmountForPayload(totalCost, roe)
        : "",
    };
  });
}

/** Job housing events use `{ type, date }`; send `[]` when booking has none. */
function mapBookingEventsForJob(booking: Record<string, unknown>) {
  const raw = Array.isArray(booking.events) ? booking.events : [];
  if (raw.length === 0) return [];

  const mapped = raw
    .map((e) => {
      const row = e as Record<string, unknown>;
      const type = String(row.type ?? row.event_type ?? "").trim();
      const dateRaw = row.date ?? row.event_date ?? "";
      const date =
        dateRaw instanceof Date
          ? dayjs(dateRaw).isValid()
            ? dayjs(dateRaw).format("YYYY-MM-DD")
            : ""
          : String(dateRaw ?? "").trim();
      if (!type && !date) return null;
      const id =
        row.id != null && row.id !== ""
          ? typeof row.id === "number"
            ? row.id
            : Number(row.id)
          : null;
      return {
        ...(id != null && !Number.isNaN(id) ? { id } : {}),
        type,
        date,
      };
    })
    .filter((row): row is { type: string; date: string; id?: number } => row != null);

  return mapped;
}

function getBookingIdsFromBooking(booking: Record<string, unknown>): number[] {
  const id = booking.id;
  if (id == null || id === "") return [];
  const n = typeof id === "number" ? id : Number(String(id).trim());
  return Number.isFinite(n) && n > 0 ? [n] : [];
}

/** Booking documents belong on the single housing row in job create payload. */
function mapBookingDocumentsForHousingPayload(
  booking: Record<string, unknown>,
): { document_ids: number[] } | Record<string, never> {
  const { document_ids } = parseJobDocumentsFromApi(booking);
  // Only attach when booking already has documents (omit empty on job create-from-booking)
  if (document_ids.length === 0) return {};
  return { document_ids };
}

async function resolveBookingRecordForJobCreate(
  booking: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (parseJobDocumentsFromApi(booking).document_ids.length > 0) {
    return booking;
  }

  const bookingIds = getBookingIdsFromBooking(booking);
  if (bookingIds.length === 0) return booking;

  try {
    const response = (await getAPICall(
      `${URL.customerServiceShipment}${bookingIds[0]}/`,
      API_HEADER,
    )) as {
      success?: boolean;
      status?: boolean;
      data?: Record<string, unknown> | Record<string, unknown>[];
    };
    const raw = response?.data;
    const detail = Array.isArray(raw)
      ? raw.length > 0
        ? (raw[0] as Record<string, unknown>)
        : null
      : raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : null;
    if (!detail) return booking;

    return { ...booking, ...detail };
  } catch (err) {
    console.error("Error fetching booking for job create documents:", err);
    return booking;
  }
}

function buildAirHousing(booking: Record<string, unknown>, trade: string) {
  return {
    hawb_no: resolveBookingHouseNumber(booking),
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
    cargo_details: mapCargoDetails(booking, "air"),
    mawb_charges: hasBookingRateDetails(booking)
      ? mapHouseChargesFromBooking(booking, true)
      : [],
    events: mapBookingEventsForJob(booking),
    ...mapBookingDocumentsForHousingPayload(booking),
  };
}

function buildOceanHousing(
  booking: Record<string, unknown>,
  trade: string,
  mode: BookingCreateJobMode,
) {
  const housing: Record<string, unknown> = {
    hbl_number: resolveBookingHouseNumber(booking),
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
    events: mapBookingEventsForJob(booking),
    ...mapBookingDocumentsForHousingPayload(booking),
  };

  const profile = getOceanBookingChargeProfile(mode, booking);
  if (profile && hasBookingRateDetails(booking)) {
    const includeCost = profile === "lcl-export";
    housing.mbl_charges = mapHouseChargesFromBooking(booking, includeCost);
  }

  return housing;
}

export function buildJobCreatePayloadFromBooking(
  booking: Record<string, unknown>,
  mode: BookingCreateJobMode,
): Record<string, unknown> {
  syncBookingJobMoneyMode();
  const isInlandExport = mode === "inland-export";
  const isInlandImport = mode === "inland-import";
  const isInland = isInlandExport || isInlandImport;
  const isAir =
    mode === "air-export" || isInland || mode === "air-import";
  const serviceType =
    mode === "air-import" ||
    mode === "ocean-import" ||
    isInlandImport
      ? "Import"
      : "Export";
  const service = isInland
    ? "INLAND"
    : String(booking.service || (isAir ? "AIR" : "FCL"));
  const routingTransport = isAir ? "Air" : "Sea";
  const oceanRoutings = mapOceanRoutings(booking, routingTransport);

  const base: Record<string, unknown> = {
    service,
    service_type: isInlandExport
      ? "EXPORT"
      : isInlandImport
        ? "IMPORT"
        : normalizeJobServiceType(booking.service_type, serviceType),
    ...(isInland
      ? { service_code: String(booking.service_code ?? "").trim() }
      : {}),
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
    carrier_code: resolveCarrierCode(booking),
    carrier_name: resolveCarrierName(booking),
    carrier_booking_no: booking.carrier_booking_no || "",
    voyage_number: resolveVoyageNumber(booking) || null,
    booking_ids: getBookingIdsFromBooking(booking),
    estimates: shouldMapBookingChargesToEstimates(mode, booking)
      ? mapBookingRateDetailsToEstimates(booking)
      : [],
    ...(oceanRoutings.length > 0 ? { ocean_routings: oceanRoutings } : {}),
    housing_details: [
      isAir
        ? buildAirHousing(
            booking,
            mode === "air-export" || mode === "inland-export"
              ? "Re Export"
              : "Import",
          )
        : buildOceanHousing(
            booking,
            mode === "ocean-export" ? "Export" : "Import",
            mode,
          ),
    ],
  };

  if (isAir) {
    const masterNo = resolveBookingMasterNumber(booking);
    const flightNo = resolveFlightNumber(booking);
    return {
      ...base,
      flightno: flightNo || null,
      flight_no: flightNo || null,
      is_direct: booking.is_direct ?? false,
      mawb_no: masterNo,
      mbl_date: formatRoutingDate(booking.mawb_date),
    };
  }

  const containerDetails = mapContainerDetailsFromBooking(booking);
  const masterNo = resolveBookingMasterNumber(booking);

  return {
    ...base,
    is_direct: booking.is_direct ?? false,
    schedule_id: booking.schedule_id ? String(booking.schedule_id) : null,
    vessel_name: resolveVesselName(booking) || null,
    mbl_number: masterNo || null,
    mbl_date: formatRoutingDate(booking.mbl_date || booking.mawb_date),
    ...(containerDetails.length > 0
      ? { container_details: containerDetails }
      : {}),
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
    const bookingForPayload = await resolveBookingRecordForJobCreate(booking);
    const payload = buildJobCreatePayloadFromBooking(bookingForPayload, mode);
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

    const payloadEstimates = Array.isArray(payload.estimates)
      ? payload.estimates
      : [];

    if (job) {
      const jobEstimates = Array.isArray(job.estimates) ? job.estimates : [];
      const estimates =
        jobEstimates.length > 0 ? jobEstimates : payloadEstimates;
      navigate(jobEditPath, {
        state: {
          job: { ...job, estimates },
          ...(estimates.length > 0 ? { estimates } : {}),
        },
      });
    } else {
      navigate(jobEditPath, {
        state: {
          jobId: jobDetailsId,
          ...(payloadEstimates.length > 0
            ? { estimates: payloadEstimates }
            : {}),
        },
      });
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
