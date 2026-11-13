/**
 * Shared master + house required-field policy for Transportation job pages.
 *
 * Intentionally separate from Booking → Job create, which only validates
 * booking-available fields (see validateBookingForJobCreate).
 */

export type JobTransportFamily = "ocean" | "air" | "inland";
export type JobDirection = "export" | "import";

export type JobValidationContext = {
  family: JobTransportFamily;
  direction: JobDirection;
  isChaMode?: boolean;
};

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function hasDate(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return str(value).toLowerCase() !== "null";
}

function hasNumberOrZero(value: unknown): boolean {
  if (value == null || value === "") return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n);
}

function houseNoLabel(ctx: JobValidationContext): string {
  if (ctx.family === "ocean") return "HBL No";
  if (ctx.family === "inland") return "TWB No";
  return "HAWB No";
}

function houseListLabel(ctx: JobValidationContext): string {
  if (ctx.family === "ocean") return "HBL";
  if (ctx.family === "inland") return "TWB";
  return "HAWB";
}

function masterLabel(ctx: JobValidationContext): string {
  if (ctx.family === "ocean") return "MBL";
  if (ctx.family === "inland") return "WayBill";
  return "MAWB";
}

function resolveHouseNumber(house: Record<string, unknown>): string {
  return str(
    house.hbl_number ?? house.hawb_no ?? house.hawb_number ?? house.houseno,
  );
}

function resolveAgentCode(master: Record<string, unknown>): string {
  return str(master.origin_agent ?? master.agent_code ?? master.agent);
}

function resolveMasterDocNo(carrier: Record<string, unknown>): string {
  return str(
    carrier.mbl_number ??
      carrier.mawb_number ??
      carrier.mawb_no ??
      carrier.master_no,
  );
}

function resolveFlightOrTruck(carrier: Record<string, unknown>): string {
  return str(carrier.flight_number ?? carrier.flightno ?? carrier.flight_no);
}

/** Master header fields shared across navigate / house-save / submit. */
export function getMasterHeaderMissingFields(
  ctx: JobValidationContext,
  master: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  const service = str(master.service ?? master.service_code);
  if (!service) missing.push("Service");

  const isDirect = master.is_direct === true;
  const agentRequired =
    !ctx.isChaMode &&
    (ctx.direction === "import" || !isDirect);
  if (agentRequired && !resolveAgentCode(master)) {
    missing.push(ctx.direction === "import" ? "Origin Agent" : "Destination Agent");
  }

  if (!str(master.origin_code)) missing.push("Origin");
  if (!str(master.destination_code)) missing.push("Destination");
  if (!hasDate(master.etd)) missing.push("ETD");
  if (!hasDate(master.eta)) missing.push("ETA");
  return missing;
}

/** Carrier / master document block. */
export function getCarrierMissingFields(
  ctx: JobValidationContext,
  carrier: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  if (!str(carrier.carrier_code) && !str(carrier.carrier_name)) {
    missing.push("Carrier");
  }

  if (ctx.family === "ocean") {
    if (!str(carrier.vessel_name)) missing.push("Vessel Name");
    if (!str(carrier.voyage_number ?? carrier.voyage_no)) {
      missing.push("Voyage Number");
    }
    if (!resolveMasterDocNo(carrier)) missing.push("MBL No");
  } else if (ctx.family === "air") {
    if (!resolveFlightOrTruck(carrier)) missing.push("Flight Number");
    if (!resolveMasterDocNo(carrier)) missing.push("MAWB No");
  } else {
    if (!resolveFlightOrTruck(carrier)) missing.push("Truck Number");
    if (!resolveMasterDocNo(carrier)) missing.push("WayBill No");
  }
  return missing;
}

function getCargoMissingFields(
  ctx: JobValidationContext,
  cargos: unknown[],
): string[] {
  const missing: string[] = [];
  if (!Array.isArray(cargos) || cargos.length === 0) {
    missing.push("At least one Cargo Detail");
    return missing;
  }

  cargos.forEach((raw, j) => {
    const cargo = (raw ?? {}) as Record<string, unknown>;
    const prefix = `Cargo ${j + 1}`;

    if (ctx.family === "ocean") {
      const containerNo = str(cargo.container_no ?? cargo.container_number);
      if (!containerNo) missing.push(`${prefix}: Container Number`);
      if (!hasNumberOrZero(cargo.no_of_packages)) {
        missing.push(`${prefix}: Number of Packages`);
      }
      if (!hasNumberOrZero(cargo.gross_weight)) {
        missing.push(`${prefix}: Gross Weight`);
      }
      if (!hasNumberOrZero(cargo.volume)) {
        missing.push(`${prefix}: Volume`);
      }
      return;
    }

    // Air / inland house cargo — match HouseCreate (present, 0 allowed)
    if (!hasNumberOrZero(cargo.no_of_packages)) {
      missing.push(`${prefix}: Number of Packages`);
    }
    if (!hasNumberOrZero(cargo.gross_weight)) {
      missing.push(`${prefix}: Gross Weight`);
    }
    const volume = cargo.volume ?? cargo.volume_weight;
    if (!hasNumberOrZero(volume)) {
      missing.push(`${prefix}: Volume Weight`);
    }
  });

  return missing;
}

/** One house row — aligned with HouseCreate required steps (excl. charges). */
export function getHouseMissingFields(
  ctx: JobValidationContext,
  house: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  if (!resolveHouseNumber(house)) missing.push(houseNoLabel(ctx));
  if (!str(house.origin_code)) missing.push("Origin");
  if (!str(house.destination_code)) missing.push("Destination");
  if (!str(house.trade)) missing.push("Trade");
  if (!str(house.shipment_terms_code ?? house.shipment_terms_name)) {
    missing.push("Shipment Terms");
  }
  if (!str(house.routed)) missing.push("Routed");
  if (!str(house.routed_by)) missing.push("Routed By");
  if (!str(house.shipper_name)) missing.push("Shipper Name");
  if (!str(house.consignee_name)) missing.push("Consignee Name");
  if (!str(house.billing_customer_name)) missing.push("Billing Customer Name");

  const cargos = Array.isArray(house.cargo_details) ? house.cargo_details : [];
  missing.push(...getCargoMissingFields(ctx, cargos));
  return missing;
}

export type JobHouseListValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Validate full house list before Job Create/Update. */
export function validateHouseListForJobPersist(
  ctx: JobValidationContext,
  houses: unknown[],
): JobHouseListValidationResult {
  const label = houseListLabel(ctx);
  if (!Array.isArray(houses) || houses.length === 0) {
    return {
      ok: false,
      message: `At least one ${label} detail is required before creating ${masterLabel(ctx)}`,
    };
  }

  for (let i = 0; i < houses.length; i++) {
    const house = (houses[i] ?? {}) as Record<string, unknown>;
    const missing = getHouseMissingFields(ctx, house);
    if (missing.length > 0) {
      return {
        ok: false,
        message: `${label} ${i + 1} is missing required fields: ${missing.join(", ")}`,
      };
    }
  }
  return { ok: true };
}

export type JobMasterSnapshotValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * When saving/updating a house, ensure master (+ carrier) required fields
 * from the job snapshot are also complete.
 */
export function validateMasterSnapshotForHousePersist(
  ctx: JobValidationContext,
  snapshot: {
    master?: Record<string, unknown> | null;
    carrier?: Record<string, unknown> | null;
  },
): JobMasterSnapshotValidationResult {
  const master = snapshot.master ?? {};
  const carrier = snapshot.carrier ?? {};
  const missing = [
    ...getMasterHeaderMissingFields(ctx, master),
    ...getCarrierMissingFields(ctx, carrier),
  ];
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    message: `Please fill all required ${masterLabel(ctx)} & Carrier details before saving house: ${missing.join(", ")}`,
  };
}
