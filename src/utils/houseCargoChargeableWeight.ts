import { roundToDecimals } from "./numberInputUtils";

/** Max decimal places for gross (KG), volume (CBM), and chargeable volume on ocean cargo. */
export const HOUSE_CARGO_WEIGHT_DECIMALS = 3;

export type HouseCargoWeightValue = number | string | null;

/** Allow up to 3 decimals; display follows user input (no forced trailing zeros). */
export const HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS = {
  decimalScale: HOUSE_CARGO_WEIGHT_DECIMALS,
} as const;

const PARTIAL_DECIMAL_PATTERN = /^\d*\.?\d{0,3}$/;

function houseCargoWeightNumberToString(num: number): string {
  return String(num);
}

/** Load from API/edit data — keep string literals (e.g. 32.100); never force 2 dp. */
export function importHouseCargoWeightFromApi(
  value: unknown,
): HouseCargoWeightValue {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (PARTIAL_DECIMAL_PATTERN.test(trimmed)) return trimmed;
  }
  return coerceHouseCargoWeightInput(value as string | number);
}

export type HouseChargeableWeightUnit = "ocean" | "air";

export function parseHouseCargoWeightInput(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return null;
  return num;
}

export function houseCargoWeightValuesEqual(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  if (a === b) return true;
  const aNum = parseHouseCargoWeightInput(a);
  const bNum = parseHouseCargoWeightInput(b);
  if (aNum === null && bNum === null) return true;
  if (aNum === null || bNum === null) return false;
  return aNum === bNum;
}

export function isPositiveHouseCargoWeight(
  value: string | number | null | undefined,
): boolean {
  const n = parseHouseCargoWeightInput(value);
  return n !== null && n > 0;
}

/**
 * Keep string input as typed (e.g. 14.210). When NumberInput blurs to a number,
 * keep the prior string if the numeric value is unchanged (preserves trailing zeros).
 */
export function coerceHouseCargoWeightInput(
  value: string | number | null | undefined,
  previous?: HouseCargoWeightValue,
): HouseCargoWeightValue {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!PARTIAL_DECIMAL_PATTERN.test(trimmed)) {
      return previous ?? null;
    }
    return trimmed;
  }
  const num = roundToDecimals(value, HOUSE_CARGO_WEIGHT_DECIMALS);
  if (num === null || num === undefined) return null;
  if (typeof previous === "string") {
    const prevNum = parseHouseCargoWeightInput(previous);
    if (prevNum !== null && prevNum === num) {
      return previous;
    }
  }
  return houseCargoWeightNumberToString(num);
}

/** @deprecated Use coerceHouseCargoWeightInput for volume field onChange */
export function normalizeHouseCargoWeightInput(
  value: string | number | null | undefined,
): HouseCargoWeightValue {
  return coerceHouseCargoWeightInput(value);
}

/** Read-only display: preserve typed decimals (e.g. 32.100), not NumberInput normalization. */
export function formatHouseCargoWeightDisplay(
  value: HouseCargoWeightValue,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

/** Payload: same literal as UI display (always a string, never a JSON number). */
export function formatHouseCargoWeightForPayload(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === ".") return null;
    if (!PARTIAL_DECIMAL_PATTERN.test(trimmed)) return null;
    const num = parseFloat(trimmed);
    if (!Number.isFinite(num)) return null;
    return trimmed;
  }
  const coerced = coerceHouseCargoWeightInput(value);
  if (coerced === null) return null;
  return formatHouseCargoWeightDisplay(coerced);
}

/** Minimum ocean chargeable weight (CBM) after max(gross÷1000, volume) calculation. */
export const OCEAN_CHARGEABLE_WEIGHT_MIN = 1;

/** Ocean: gross (KG) → CBM for chargeable when gross wins the max comparison. */
function oceanGrossKgToCbm(grossWeight: HouseCargoWeightValue): HouseCargoWeightValue {
  const grossNum = parseHouseCargoWeightInput(grossWeight);
  if (grossNum === null || grossNum <= 0) return null;
  return coerceHouseCargoWeightInput(grossNum / 1000);
}

/** Ocean chargeable CBM: values below 1 are raised to 1. */
export function applyOceanChargeableWeightMinimum(
  value: HouseCargoWeightValue,
): HouseCargoWeightValue {
  const num = parseHouseCargoWeightInput(value);
  if (num === null || num <= 0) return value;
  if (num < OCEAN_CHARGEABLE_WEIGHT_MIN) {
    return coerceHouseCargoWeightInput(OCEAN_CHARGEABLE_WEIGHT_MIN);
  }
  return value;
}

function normalizeChargeUnitToken(value: string): string {
  return value.trim().toUpperCase().replace(/\s/g, "");
}

function chargeUnitTokens(unitCode: string, unitLabel?: string): string[] {
  const tokens = new Set<string>();
  if (unitCode.trim()) tokens.add(normalizeChargeUnitToken(unitCode));
  if (unitLabel?.trim()) tokens.add(normalizeChargeUnitToken(unitLabel));
  return [...tokens];
}

function hasChargeUnitToken(
  unitCode: string,
  unitLabel: string | undefined,
  ...candidates: string[]
): boolean {
  const tokens = chargeUnitTokens(unitCode, unitLabel);
  const normalizedCandidates = candidates.map(normalizeChargeUnitToken);
  return tokens.some((token) => normalizedCandidates.includes(token));
}

export function isShipmentOrDocChargeUnit(
  unitCode: string,
  unitLabel?: string,
): boolean {
  return hasChargeUnitToken(
    unitCode,
    unitLabel,
    "SHIPMENT",
    "SHPT",
    "DOC",
  );
}

export function isWmChargeUnit(unitCode: string, unitLabel?: string): boolean {
  return hasChargeUnitToken(
    unitCode,
    unitLabel,
    "W/M",
    "WM",
    "WEIGHT/MEASUREMENT",
    "WEIGHTMEASUREMENT",
  );
}

/** Plain CBM (volume) — not W/M or CBM(S)/CBMS variants. */
export function isPlainCbmChargeUnit(
  unitCode: string,
  unitLabel?: string,
): boolean {
  if (isWmChargeUnit(unitCode, unitLabel)) return false;
  if (isCbmsChargeUnit(unitCode, unitLabel)) return false;
  return hasChargeUnitToken(unitCode, unitLabel, "CBM");
}

/** Charge unit CBM(S) / CBMS — auto-fill from chargeable CBM, not raw volume. */
export function isCbmsChargeUnit(
  unitCode: string,
  unitLabel?: string,
): boolean {
  return hasChargeUnitToken(
    unitCode,
    unitLabel,
    "CBMS",
    "CBM(S)",
  );
}

export function isKgChargeUnit(unitCode: string, unitLabel?: string): boolean {
  return hasChargeUnitToken(unitCode, unitLabel, "KG");
}

/** Parse no_of_unit without rounding (preserves 1–3 dp as entered). */
export function parseNoOfUnitForPayload(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num =
    typeof value === "string" ? parseFloat(value.trim()) : Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function noOfUnitValuesEqual(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  if (a === b) return true;
  const aNum = parseNoOfUnitForPayload(a);
  const bNum = parseNoOfUnitForPayload(b);
  if (aNum === null && bNum === null) return true;
  if (aNum === null || bNum === null) return false;
  return aNum === bNum;
}

export type OceanBookingCargoForCbms = {
  gross_weight?: HouseCargoWeightValue;
  volume?: HouseCargoWeightValue;
  volume_weight?: HouseCargoWeightValue;
  chargeable_weight?: HouseCargoWeightValue;
  chargeable_volume?: HouseCargoWeightValue;
};

export type BookingCargoForNoOfUnits = OceanBookingCargoForCbms & {
  container_type_code?: string;
  container_type?: string;
  no_of_containers?: number | string | null;
};

function formatBookingNoOfUnitsValue(
  value: HouseCargoWeightValue | number | string | null | undefined,
): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const imported = importHouseCargoWeightFromApi(value);
  return imported === null ? null : imported;
}

function resolvePrimaryBookingCargo(
  cargoDetails: BookingCargoForNoOfUnits[],
): BookingCargoForNoOfUnits {
  return cargoDetails[0] ?? {};
}

function resolveLclChargeableVolumeSource(
  cargo: BookingCargoForNoOfUnits,
): HouseCargoWeightValue {
  if (isPositiveHouseCargoWeight(cargo.chargeable_volume)) {
    return cargo.chargeable_volume ?? null;
  }
  return calculateHouseChargeableWeight(
    cargo.gross_weight ?? null,
    cargo.volume ?? null,
    "ocean",
  );
}

function resolveAirChargeableWeightSource(
  cargo: BookingCargoForNoOfUnits,
): HouseCargoWeightValue {
  if (isPositiveHouseCargoWeight(cargo.chargeable_weight)) {
    return cargo.chargeable_weight ?? null;
  }
  return calculateHouseChargeableWeight(
    cargo.gross_weight ?? null,
    cargo.volume_weight ?? null,
    "air",
  );
}

function resolveSingleOceanBookingLclCbmsSource(
  cargo: OceanBookingCargoForCbms,
): HouseCargoWeightValue {
  if (isPositiveHouseCargoWeight(cargo.chargeable_volume)) {
    return cargo.chargeable_volume ?? null;
  }
  if (isPositiveHouseCargoWeight(cargo.chargeable_weight)) {
    return cargo.chargeable_weight ?? null;
  }
  const calculated = calculateHouseChargeableWeight(
    cargo.gross_weight ?? null,
    cargo.volume ?? null,
    "ocean",
  );
  return isPositiveHouseCargoWeight(calculated) ? calculated : null;
}

/** Sum LCL chargeable CBM across cargo rows (volume field preferred, then weight). */
export function sumOceanBookingLclChargeableCbm(
  cargoList: OceanBookingCargoForCbms[],
): number | null {
  let total = 0;
  let hasValue = false;

  for (const cargo of cargoList) {
    const value = parseHouseCargoWeightInput(
      resolveSingleOceanBookingLclCbmsSource(cargo),
    );
    if (value !== null && value > 0) {
      total += value;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

/**
 * LCL ocean booking: no_of_units for CBM(S) from chargeable volume/weight — preserves decimals.
 */
export function getOceanBookingLclCbmsNoOfUnitForCharge(
  cargoList: OceanBookingCargoForCbms[],
): string | number | null {
  if (cargoList.length === 0) return null;

  if (cargoList.length === 1) {
    const source = resolveSingleOceanBookingLclCbmsSource(cargoList[0]);
    if (source === null || source === "") return null;
    return source;
  }

  const total = sumOceanBookingLclChargeableCbm(cargoList);
  return total === null ? null : total;
}

export function formatBookingNoOfUnitsForPayload(
  value: string | number | null | undefined,
): number | null {
  return parseNoOfUnitForPayload(value);
}

/**
 * Resolve booking charge no_of_units from service, unit, and cargo — mirrors quotation logic.
 * Returns null when the unit should not auto-fill from cargo.
 */
export function resolveBookingChargeNoOfUnits(
  unitCode: string,
  unitLabel: string | undefined,
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
): string | number | null {
  if (!unitCode.trim() || !service) return null;

  if (isShipmentOrDocChargeUnit(unitCode, unitLabel)) {
    return 1;
  }

  const primaryCargo = resolvePrimaryBookingCargo(cargoDetails);

  if (service === "AIR") {
    if (isKgChargeUnit(unitCode, unitLabel)) {
      return formatBookingNoOfUnitsValue(
        resolveAirChargeableWeightSource(primaryCargo),
      );
    }
    return null;
  }

  if (service === "LCL") {
    if (isWmChargeUnit(unitCode, unitLabel)) {
      return formatBookingNoOfUnitsValue(
        resolveLclChargeableVolumeSource(primaryCargo),
      );
    }
    if (isCbmsChargeUnit(unitCode, unitLabel)) {
      return getOceanBookingLclCbmsNoOfUnitForCharge(cargoDetails);
    }
    if (isPlainCbmChargeUnit(unitCode, unitLabel)) {
      return formatBookingNoOfUnitsValue(primaryCargo.volume);
    }
    return null;
  }

  if (service === "FCL") {
    const unitTokens = chargeUnitTokens(unitCode, unitLabel);
    const matchingCargo = cargoDetails.find((cargo) => {
      const containerCode = normalizeChargeUnitToken(
        String(cargo.container_type_code || cargo.container_type || ""),
      );
      return containerCode && unitTokens.includes(containerCode);
    });
    if (matchingCargo?.no_of_containers != null) {
      return formatBookingNoOfUnitsValue(matchingCargo.no_of_containers);
    }
  }

  return null;
}

export type BookingUnitOption = { value: string; label: string };

type UnitMasterRow = {
  unit_code?: string;
  unit_name?: string;
  service_type?: string;
  status?: string;
};

/** Booking unit dropdown: all ACTIVE rows from unit master API — value = unit_code, label = unit_name. */
export function buildBookingUnitOptions(
  unitDataRaw: unknown[],
): BookingUnitOption[] {
  if (!Array.isArray(unitDataRaw)) return [];

  return unitDataRaw
    .filter((item) => {
      const row = item as UnitMasterRow;
      if (row.status && row.status !== "ACTIVE") return false;
      return Boolean(String(row.unit_code || "").trim());
    })
    .map((item) => {
      const row = item as UnitMasterRow;
      return {
        value: String(row.unit_code || ""),
        label: row.unit_name || row.unit_code || "",
      };
    });
}

/**
 * Map a quotation/API unit value to booking dropdown value (unit_code).
 * Quotation stores unit_code; booking displays unit_name but matches by unit_code.
 */
export function resolveBookingUnitCode(
  unitValue: string,
  unitOptions: BookingUnitOption[],
): string {
  const trimmed = (unitValue ?? "").trim();
  if (!trimmed) return "";
  if (!unitOptions.length) return trimmed;

  const exact = unitOptions.find((option) => option.value === trimmed);
  if (exact) return exact.value;

  const upper = trimmed.toUpperCase();
  const byUpperValue = unitOptions.find(
    (option) => option.value.toUpperCase() === upper,
  );
  if (byUpperValue) return byUpperValue.value;

  const byUpperLabel = unitOptions.find(
    (option) => option.label.trim().toUpperCase() === upper,
  );
  if (byUpperLabel) return byUpperLabel.value;

  const token = normalizeChargeUnitToken(trimmed);
  const byToken = unitOptions.find(
    (option) =>
      normalizeChargeUnitToken(option.value) === token ||
      normalizeChargeUnitToken(option.label) === token,
  );
  if (byToken) return byToken.value;

  return trimmed;
}

export function formatBookingChargeNoOfUnitsField(
  value: string | number | null | undefined,
): string | number {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? trimmed : "";
}

/** Booking charges: set no_of_units when unit changes. */
export function applyBookingChargeUnitSelection(
  unitCode: string,
  unitLabel: string | undefined,
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  currentNoOfUnits: string | number,
): string | number {
  const resolved = resolveBookingChargeNoOfUnits(
    unitCode,
    unitLabel,
    service,
    cargoDetails,
  );
  if (resolved !== null && resolved !== "") {
    return resolved;
  }
  return currentNoOfUnits;
}

/** Apply unit selection on a charge row: resolve unit_code and set default no_of_units. */
export function applyBookingChargeUnitChange<
  T extends BookingChargeForNoOfUnitsSync,
>(
  charge: T,
  rawUnitValue: string,
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  unitOptions: BookingUnitOption[],
): T {
  const unitCode = resolveBookingUnitCode(rawUnitValue, unitOptions);
  if (!unitCode) {
    return recalcBookingChargeLineTotals({
      ...charge,
      unit: "",
      no_of_units: "",
    });
  }

  const unitOpt = unitOptions.find((option) => option.value === unitCode);
  const nextNoOfUnits = applyBookingChargeUnitSelection(
    unitCode,
    unitOpt?.label,
    service,
    cargoDetails,
    "",
  );

  return recalcBookingChargeLineTotals({
    ...charge,
    unit: unitCode,
    no_of_units: formatBookingChargeNoOfUnitsField(nextNoOfUnits),
  });
}

function isBookingChargeNoOfUnitsEmpty(
  value: string | number | null | undefined,
): boolean {
  return (
    value === "" || value === null || value === undefined
  );
}

/**
 * Map quotation/booking charges: resolve unit to unit_code from master options,
 * and auto-fill no_of_units from cargo when the field is empty.
 */
export function mapBookingChargesWithUnits<
  T extends BookingChargeForNoOfUnitsSync,
>(
  charges: T[],
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  unitOptions: BookingUnitOption[],
): T[] | null {
  if (!charges.length) return null;

  let hasChanges = false;
  const updated = charges.map((charge) => {
    let next = charge;

    if (next.unit && unitOptions.length) {
      const unitCode = resolveBookingUnitCode(next.unit, unitOptions);
      if (unitCode && unitCode !== next.unit) {
        hasChanges = true;
        next = { ...next, unit: unitCode };
      }
    }

    if (
      next.unit &&
      service &&
      isBookingChargeNoOfUnitsEmpty(next.no_of_units)
    ) {
      const unitCode = resolveBookingUnitCode(next.unit, unitOptions);
      const unitOpt = unitOptions.find((option) => option.value === unitCode);
      const resolved = resolveBookingChargeNoOfUnits(
        unitCode,
        unitOpt?.label,
        service,
        cargoDetails,
      );
      if (resolved !== null && resolved !== "") {
        hasChanges = true;
        next = recalcBookingChargeLineTotals({
          ...next,
          unit: unitCode || next.unit,
          no_of_units: formatBookingChargeNoOfUnitsField(resolved),
        });
      }
    }

    return next;
  });

  return hasChanges ? updated : null;
}

/** @deprecated Use mapBookingChargesWithUnits */
export function normalizeBookingChargesUnitCodes<
  T extends BookingChargeForNoOfUnitsSync,
>(charges: T[], unitOptions: BookingUnitOption[]): T[] | null {
  return mapBookingChargesWithUnits(charges, "", [], unitOptions);
}

export type JobUnitMasterRow = {
  id?: number;
  unit_code?: string;
  unit_name?: string;
  name?: string;
  status?: string;
};

export type JobUnitOption = {
  value: string;
  label: string;
  unit_code: string;
};

export type JobChargeForNoOfUnits = {
  unit_id?: string;
  unit_code?: string;
  no_of_unit?: number | null;
};

export type JobContainerForNoOfUnits = {
  container_type?: string;
  container_type_code?: string;
  container_no?: string;
};

export type JobCargoForFclNoOfUnits = {
  container_number?: string;
  container_no?: string;
  no_of_packages?: number | string | null;
};

export type JobChargeNoOfUnitContext = {
  containerDetails?: JobContainerForNoOfUnits[];
  jobCargoDetails?: JobCargoForFclNoOfUnits[];
};

const FCL_CONTAINER_UNIT_PATTERN = /^(20|40|45|53)/;

function containerDetailTypeTokens(
  container: JobContainerForNoOfUnits,
): string[] {
  const tokens = new Set<string>();
  for (const value of [
    container.container_type,
    container.container_type_code,
  ]) {
    const normalized = normalizeChargeUnitToken(String(value ?? ""));
    if (normalized) tokens.add(normalized);
  }
  return [...tokens];
}

function isProbableFclContainerChargeUnit(
  unitCode: string,
  unitLabel?: string,
): boolean {
  const tokens = chargeUnitTokens(unitCode, unitLabel);
  if (tokens.some((token) => token.includes("CONTAINER"))) return true;
  return tokens.some((token) => FCL_CONTAINER_UNIT_PATTERN.test(token));
}

/**
 * FCL job: match charge unit to container type and return the count of
 * container_details rows for that type.
 * Returns "not-container" when the unit is not a container-type unit.
 */
function resolveFclJobContainerChargeNoOfUnit(
  unitCode: string,
  unitLabel: string | undefined,
  containerDetails: JobContainerForNoOfUnits[],
): number | "not-container" {
  const unitTokens = chargeUnitTokens(unitCode, unitLabel);
  const knownContainerTypeTokens = new Set(
    containerDetails.flatMap((container) => containerDetailTypeTokens(container)),
  );

  const isContainerUnit =
    unitTokens.some((token) => knownContainerTypeTokens.has(token)) ||
    isProbableFclContainerChargeUnit(unitCode, unitLabel);

  if (!isContainerUnit) return "not-container";

  const matchingContainers = containerDetails.filter((container) => {
    const type = String(
      container.container_type ?? container.container_type_code ?? "",
    ).trim();
    if (!type) return false;
    const typeTokens = containerDetailTypeTokens(container);
    return typeTokens.some((token) => unitTokens.includes(token));
  });

  if (matchingContainers.length > 0) {
    return matchingContainers.length;
  }

  // Container-type unit selected but no matching rows in container_details
  return 1;
}

/** Job unit dropdown: all ACTIVE rows — value = unit id, label = unit_name. */
export function buildJobUnitOptions(unitDataRaw: unknown[]): JobUnitOption[] {
  if (!Array.isArray(unitDataRaw)) return [];

  return (unitDataRaw as JobUnitMasterRow[])
    .filter((row) => {
      if (row.status && row.status !== "ACTIVE") return false;
      const id = row.id != null ? String(row.id) : "";
      const code = String(row.unit_code ?? "").trim();
      return Boolean(id || code);
    })
    .map((row) => {
      const unit_code = String(row.unit_code ?? "").trim();
      const label = String(row.unit_name ?? row.name ?? unit_code).trim();
      const id = row.id != null ? String(row.id) : "";
      return {
        value: id || unit_code,
        label: label || unit_code,
        unit_code: unit_code || label,
      };
    });
}

export function toBookingCargoForNoOfUnits(
  cargoDetails: Array<{
    gross_weight?: HouseCargoWeightValue;
    volume?: HouseCargoWeightValue;
    volume_weight?: HouseCargoWeightValue;
    chargeable_weight?: HouseCargoWeightValue;
    chargeable_volume?: HouseCargoWeightValue;
    container_type?: string;
    container_type_code?: string;
    container_code?: string;
    no_of_containers?: number | string | null;
    no_of_packages?: number | string | null;
  }>,
): BookingCargoForNoOfUnits[] {
  return cargoDetails.map((cargo) => ({
    gross_weight: cargo.gross_weight,
    volume: cargo.volume,
    volume_weight: cargo.volume_weight,
    chargeable_weight: cargo.chargeable_weight,
    chargeable_volume: cargo.chargeable_volume,
    container_type: cargo.container_type ?? cargo.container_code,
    container_type_code: cargo.container_type_code ?? cargo.container_code,
    no_of_containers: cargo.no_of_containers ?? cargo.no_of_packages,
  }));
}

function findJobUnitOption(
  unitOptions: JobUnitOption[],
  unitId: string,
): JobUnitOption | undefined {
  return unitOptions.find((option) => option.value === unitId);
}

function resolveJobUnitCodeFromOption(
  unitOpt: JobUnitOption | undefined,
): string {
  if (!unitOpt) return "";
  return unitOpt.unit_code || unitOpt.label || "";
}

function isJobChargeNoOfUnitEmpty(
  value: number | null | undefined,
): boolean {
  return value === null || value === undefined;
}

function resolveJobChargeNoOfUnitNumber(
  unitCode: string,
  unitLabel: string | undefined,
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  context?: JobChargeNoOfUnitContext,
): number | null {
  if (!unitCode.trim() || !service) return null;

  if (service === "FCL" && context?.containerDetails?.length) {
    const fclResult = resolveFclJobContainerChargeNoOfUnit(
      unitCode,
      unitLabel,
      context.containerDetails,
    );
    if (fclResult !== "not-container") {
      return fclResult;
    }
  }

  const resolved = resolveBookingChargeNoOfUnits(
    unitCode,
    unitLabel,
    service,
    cargoDetails,
  );
  if (resolved !== null && resolved !== "") {
    return parseNoOfUnitForPayload(resolved);
  }

  return 1;
}

/** Job charges: apply unit selection and auto-fill no_of_unit from cargo. */
export function applyJobChargeUnitChange<T extends JobChargeForNoOfUnits>(
  charge: T,
  unitId: string,
  unitOptions: JobUnitOption[],
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  context?: JobChargeNoOfUnitContext,
): T {
  if (!unitId) {
    return {
      ...charge,
      unit_id: "",
      unit_code: "",
      no_of_unit: null,
    };
  }

  const unitOpt = findJobUnitOption(unitOptions, unitId);
  const unitCode = resolveJobUnitCodeFromOption(unitOpt);
  const nextNoOfUnit = resolveJobChargeNoOfUnitNumber(
    unitCode,
    unitOpt?.label,
    service,
    cargoDetails,
    context,
  );

  return {
    ...charge,
    unit_id: unitId,
    unit_code: unitCode,
    no_of_unit: nextNoOfUnit,
  };
}

/** Map job charges from API/edit: resolve unit_id and auto-fill empty no_of_unit. */
export function mapJobChargesWithUnits<T extends JobChargeForNoOfUnits>(
  charges: T[],
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  unitOptions: JobUnitOption[],
  context?: JobChargeNoOfUnitContext,
): T[] | null {
  if (!charges.length) return null;

  let hasChanges = false;
  const updated = charges.map((charge) => {
    let next = { ...charge };

    if ((!next.unit_id || !String(next.unit_id).trim()) && next.unit_code) {
      const codeUpper = String(next.unit_code).trim().toUpperCase();
      const byCode = unitOptions.find(
        (option) =>
          option.unit_code.toUpperCase() === codeUpper ||
          option.label.trim().toUpperCase() === codeUpper,
      );
      if (byCode) {
        hasChanges = true;
        next = {
          ...next,
          unit_id: byCode.value,
          unit_code: byCode.unit_code,
        };
      }
    } else if (next.unit_id && unitOptions.length) {
      const unitOpt = findJobUnitOption(unitOptions, String(next.unit_id));
      const unitCode = resolveJobUnitCodeFromOption(unitOpt);
      if (unitCode && unitCode !== next.unit_code) {
        hasChanges = true;
        next = { ...next, unit_code: unitCode };
      }
    }

    const unitOpt = next.unit_id
      ? findJobUnitOption(unitOptions, String(next.unit_id))
      : undefined;
    const unitCode =
      next.unit_code || resolveJobUnitCodeFromOption(unitOpt) || "";

    if (
      unitCode &&
      service &&
      isJobChargeNoOfUnitEmpty(next.no_of_unit)
    ) {
      const resolved = resolveJobChargeNoOfUnitNumber(
        unitCode,
        unitOpt?.label,
        service,
        cargoDetails,
        context,
      );
      if (resolved !== null) {
        hasChanges = true;
        next = { ...next, no_of_unit: resolved };
      }
    }

    return next;
  });

  return hasChanges ? updated : null;
}

/** Keep job charge rows in sync when cargo-derived units change. */
export function syncJobChargesWithCargoNoOfUnits<
  T extends JobChargeForNoOfUnits,
>(
  charges: T[],
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  unitOptions: JobUnitOption[],
  context?: JobChargeNoOfUnitContext,
): T[] | null {
  let hasChanges = false;
  const updated = charges.map((charge) => {
    // Preserve existing quantity on edit/load; only auto-fill when empty.
    if (!isJobChargeNoOfUnitEmpty(charge.no_of_unit)) return charge;
    if (!charge.unit_id && !charge.unit_code) return charge;
    const unitOpt = charge.unit_id
      ? findJobUnitOption(unitOptions, String(charge.unit_id))
      : undefined;
    const unitCode =
      charge.unit_code || resolveJobUnitCodeFromOption(unitOpt) || "";
    if (!unitCode) return charge;

    const nextNoOfUnit = resolveJobChargeNoOfUnitNumber(
      unitCode,
      unitOpt?.label,
      service,
      cargoDetails,
      context,
    );
    if (nextNoOfUnit === null) return charge;
    if (noOfUnitValuesEqual(charge.no_of_unit, nextNoOfUnit)) return charge;

    hasChanges = true;
    return {
      ...charge,
      unit_code: unitCode,
      no_of_unit: nextNoOfUnit,
    };
  });

  return hasChanges ? updated : null;
}

export function buildJobChargeNoOfUnitsSyncKey(
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  context?: JobChargeNoOfUnitContext,
): string {
  const base = buildBookingCargoNoOfUnitsSyncKey(service, cargoDetails);
  if (service !== "FCL" || !context?.containerDetails?.length) return base;

  const containers = context.containerDetails
    .map(
      (container) =>
        `${container.container_type ?? ""}:${container.container_type_code ?? ""}:${container.container_no ?? ""}`,
    )
    .join("|");
  const cargo = (context.jobCargoDetails ?? [])
    .map(
      (row) =>
        `${row.container_number ?? row.container_no ?? ""}:${row.no_of_packages ?? ""}`,
    )
    .join("|");

  return `${base}::${containers}::${cargo}`;
}

export function buildBookingCargoNoOfUnitsSyncKey(
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
): string {
  if (!cargoDetails.length) return `${service}:empty`;
  if (service === "FCL") {
    return `${service}:${cargoDetails
      .map(
        (cargo) =>
          `${cargo.container_type_code ?? ""}:${cargo.container_type ?? ""}:${cargo.no_of_containers ?? ""}`,
      )
      .join("|")}`;
  }
  return `${service}:${cargoDetails
    .map(
      (cargo) =>
        `${cargo.chargeable_volume ?? ""}:${cargo.chargeable_weight ?? ""}:${cargo.volume ?? ""}:${cargo.volume_weight ?? ""}:${cargo.gross_weight ?? ""}`,
    )
    .join("|")}`;
}

export type BookingChargeForNoOfUnitsSync = {
  unit: string;
  no_of_units: string | number;
  sell_per_unit?: string | number;
  cost_per_unit?: string | number;
  roe?: string | number;
  total_sell?: string;
  total_cost?: string;
};

function recalcBookingChargeLineTotals<T extends BookingChargeForNoOfUnitsSync>(
  charge: T,
): T {
  const noOfUnits = parseFloat(String(charge.no_of_units)) || 0;
  const sellPerUnit = parseFloat(String(charge.sell_per_unit)) || 0;
  const costPerUnit = parseFloat(String(charge.cost_per_unit)) || 0;
  const roe = parseFloat(String(charge.roe)) || 1;
  return {
    ...charge,
    total_sell: (sellPerUnit * roe * noOfUnits).toFixed(2),
    total_cost: (costPerUnit * roe * noOfUnits).toFixed(2),
  };
}

/** Keep charge rows in sync when cargo-derived units change (KG, W/M, CBM, CBM(S), FCL containers). */
export function syncBookingChargesWithCargoNoOfUnits<
  T extends BookingChargeForNoOfUnitsSync,
>(
  charges: T[],
  service: string,
  cargoDetails: BookingCargoForNoOfUnits[],
  unitOptions: Array<{ value: string; label: string }>,
): T[] | null {
  let hasChanges = false;
  const updated = charges.map((charge) => {
    if (!charge.unit) return charge;
    const unitCode = resolveBookingUnitCode(charge.unit, unitOptions);
    const unitOpt = unitOptions.find((option) => option.value === unitCode);
    const nextNoOfUnits = resolveBookingChargeNoOfUnits(
      unitCode,
      unitOpt?.label,
      service,
      cargoDetails,
    );
    if (unitCode !== charge.unit) {
      hasChanges = true;
      charge = { ...charge, unit: unitCode };
    }
    if (nextNoOfUnits === null) return charge;
    if (noOfUnitValuesEqual(charge.no_of_units, nextNoOfUnits)) return charge;
    hasChanges = true;
    return recalcBookingChargeLineTotals({
      ...charge,
      no_of_units: nextNoOfUnits,
    });
  });
  return hasChanges ? updated : null;
}

/**
 * LCL ocean job: no_of_unit for CBM(S) from chargeable weight (CBM) — no rounding.
 */
export function resolveOceanCbmsNoOfUnit(
  cargoList: Array<{
    gross_weight?: HouseCargoWeightValue;
    volume: HouseCargoWeightValue;
    chargeable_weight?: HouseCargoWeightValue;
  }>,
): number | null {
  if (cargoList.length === 0) return null;

  if (cargoList.length === 1) {
    const cargo = cargoList[0];
    const stored = parseHouseCargoWeightInput(cargo.chargeable_weight);
    if (stored !== null && stored > 0) return stored;
    const calculated = parseHouseCargoWeightInput(
      calculateHouseChargeableWeight(
        cargo.gross_weight ?? null,
        cargo.volume,
        "ocean",
      ),
    );
    return calculated !== null && calculated > 0 ? calculated : null;
  }

  const total = sumHouseOceanChargeableWeight(cargoList);
  return total !== null && total > 0 ? total : null;
}

export function sumHouseOceanChargeableWeight(
  cargoList: Array<{
    gross_weight?: HouseCargoWeightValue;
    volume: HouseCargoWeightValue;
    chargeable_weight?: HouseCargoWeightValue;
  }>,
): number | null {
  let total = 0;
  let hasValue = false;

  for (const cargo of cargoList) {
    const fromStored = parseHouseCargoWeightInput(cargo.chargeable_weight);
    const value =
      fromStored ??
      parseHouseCargoWeightInput(
        calculateHouseChargeableWeight(
          cargo.gross_weight ?? null,
          cargo.volume,
          "ocean",
        ),
      );
    if (value !== null && value > 0) {
      total += value;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

/**
 * Ocean: chargeable volume (CBM) = max(gross KG ÷ 1000, volume).
 * When volume wins, use volume as entered; when gross wins, use gross ÷ 1000.
 * Air: chargeable (KG) = max(gross, volume) — copy the winning field.
 */
export function calculateHouseChargeableWeight(
  grossWeight: HouseCargoWeightValue,
  volume: HouseCargoWeightValue,
  unit: HouseChargeableWeightUnit,
): HouseCargoWeightValue {
  const grossNum = parseHouseCargoWeightInput(grossWeight) ?? 0;
  const volNum = parseHouseCargoWeightInput(volume) ?? 0;

  if (!grossNum && !volNum) return null;

  if (unit === "ocean") {
    const grossCbm = grossNum > 0 ? grossNum / 1000 : 0;
    if (volNum > 0 && volNum >= grossCbm) {
      return applyOceanChargeableWeightMinimum(volume ?? null);
    }
    if (grossCbm > 0 && grossCbm > volNum) {
      return applyOceanChargeableWeightMinimum(oceanGrossKgToCbm(grossWeight));
    }
    return null;
  }

  if (volNum > 0 && volNum >= grossNum) return volume ?? null;
  if (grossNum > 0 && grossNum > volNum) return grossWeight ?? null;
  return null;
}

/** UI: chargeable volume/weight from max comparison. */
export function formatHouseCargoChargeableDisplay(
  grossWeight: HouseCargoWeightValue,
  volume: HouseCargoWeightValue,
  unit: HouseChargeableWeightUnit,
): string {
  const source = calculateHouseChargeableWeight(grossWeight, volume, unit);
  return formatHouseCargoWeightDisplay(source);
}

/** Payload: chargeable from max(gross÷1000, volume) on ocean. */
export function formatHouseCargoChargeableForPayload(
  grossWeight: HouseCargoWeightValue,
  volume: HouseCargoWeightValue,
  unit: HouseChargeableWeightUnit,
): string | null {
  const source = calculateHouseChargeableWeight(grossWeight, volume, unit);
  if (source === null) return null;
  return formatHouseCargoWeightForPayload(source);
}

export function withRecalculatedChargeableWeight<
  T extends {
    gross_weight?: HouseCargoWeightValue;
    volume: HouseCargoWeightValue;
    chargeable_weight: HouseCargoWeightValue;
  },
>(cargo: T, unit: HouseChargeableWeightUnit): T {
  const chargeable = calculateHouseChargeableWeight(
    cargo.gross_weight ?? null,
    cargo.volume,
    unit,
  );
  return {
    ...cargo,
    chargeable_weight: isPositiveHouseCargoWeight(chargeable) ? chargeable : null,
  };
}

export type OceanBookingLclChargeableKey =
  | "chargeable_weight"
  | "chargeable_volume";

/** Ocean booking cargo row weights for API (preserves user-entered decimals). */
export function buildOceanBookingCargoWeightPayload(
  cargo: {
    gross_weight?: unknown;
    volume?: unknown;
    volume_weight?: unknown;
    chargeable_weight?: unknown;
    chargeable_volume?: unknown;
  },
  service: string,
  lclChargeableKey: OceanBookingLclChargeableKey,
): {
  gross_weight: string | null;
  volume: string | null;
  volume_weight: string | null;
  chargeable_weight: string | null;
  chargeable_volume: string | null;
} {
  const gross = cargo.gross_weight as HouseCargoWeightValue;
  const volume = cargo.volume as HouseCargoWeightValue;
  const volumeWeight = cargo.volume_weight as HouseCargoWeightValue;
  const oceanChargeable = formatHouseCargoChargeableForPayload(
    gross,
    volume,
    "ocean",
  );
  const airChargeable = formatHouseCargoChargeableForPayload(
    gross,
    volumeWeight,
    "air",
  );

  let chargeable_weight: string | null;
  let chargeable_volume: string | null;

  const storedChargeableWeight =
    cargo.chargeable_weight as HouseCargoWeightValue;
  const storedChargeableVolume =
    cargo.chargeable_volume as HouseCargoWeightValue;

  if (service === "AIR") {
    chargeable_weight = airChargeable;
    chargeable_volume =
      formatHouseCargoWeightForPayload(storedChargeableVolume);
  } else if (service === "LCL" && lclChargeableKey === "chargeable_volume") {
    chargeable_volume = oceanChargeable;
    chargeable_weight =
      formatHouseCargoWeightForPayload(storedChargeableWeight);
  } else if (service === "LCL") {
    chargeable_weight = oceanChargeable;
    chargeable_volume =
      formatHouseCargoWeightForPayload(storedChargeableVolume);
  } else {
    chargeable_weight =
      formatHouseCargoWeightForPayload(storedChargeableWeight);
    chargeable_volume =
      formatHouseCargoWeightForPayload(storedChargeableVolume);
  }

  return {
    gross_weight: formatHouseCargoWeightForPayload(gross),
    volume: formatHouseCargoWeightForPayload(volume),
    volume_weight: formatHouseCargoWeightForPayload(volumeWeight),
    chargeable_weight,
    chargeable_volume,
  };
}

/** FCL nested container row weights for ocean booking payload. */
export function buildOceanBookingContainerWeightPayload(c: {
  gross_weight?: unknown;
  volume?: unknown;
}): {
  gross_weight: string | null;
  volume: string | null;
  chargeable_weight: string | null;
} {
  const gross = c.gross_weight as HouseCargoWeightValue;
  const volume = c.volume as HouseCargoWeightValue;
  return {
    gross_weight: formatHouseCargoWeightForPayload(gross),
    volume: formatHouseCargoWeightForPayload(volume),
    chargeable_weight: formatHouseCargoChargeableForPayload(gross, volume, "ocean"),
  };
}

/** Sum container gross (KG) for FCL header gross_weight field. */
export function sumOceanBookingContainerGrossKg(
  containers: Array<{ gross_weight?: HouseCargoWeightValue }>,
): HouseCargoWeightValue {
  const total = containers.reduce(
    (sum, c) => sum + (parseHouseCargoWeightInput(c.gross_weight) ?? 0),
    0,
  );
  if (total <= 0) return null;
  return coerceHouseCargoWeightInput(total);
}

export function formatHouseCargoDetailWeightFields<
  T extends {
    gross_weight?: unknown;
    volume?: unknown;
    chargeable_weight?: unknown;
  },
>(
  cargo: T,
  unit: HouseChargeableWeightUnit,
): Omit<T, "gross_weight" | "volume" | "chargeable_weight"> & {
  gross_weight: string | null;
  volume: string | null;
  chargeable_weight: string | null;
} {
  const {
    gross_weight,
    volume,
    chargeable_weight: _chargeable,
    ...rest
  } = cargo;
  void _chargeable;
  return {
    ...rest,
    gross_weight: formatHouseCargoWeightForPayload(
      gross_weight as HouseCargoWeightValue,
    ),
    volume: formatHouseCargoWeightForPayload(volume as HouseCargoWeightValue),
    chargeable_weight: formatHouseCargoChargeableForPayload(
      gross_weight as HouseCargoWeightValue,
      volume as HouseCargoWeightValue,
      unit,
    ),
  };
}
