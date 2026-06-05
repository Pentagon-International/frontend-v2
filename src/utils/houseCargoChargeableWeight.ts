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
    if (!PARTIAL_DECIMAL_PATTERN.test(trimmed)) return null;
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

/** Ocean: gross (KG) → CBM for chargeable when gross wins the max comparison. */
function oceanGrossKgToCbm(grossWeight: HouseCargoWeightValue): HouseCargoWeightValue {
  const grossNum = parseHouseCargoWeightInput(grossWeight);
  if (grossNum === null || grossNum <= 0) return null;
  return coerceHouseCargoWeightInput(grossNum / 1000);
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
    if (volNum > 0 && volNum >= grossCbm) return volume ?? null;
    if (grossCbm > 0 && grossCbm > volNum) return oceanGrossKgToCbm(grossWeight);
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
    gross_weight: formatHouseCargoWeightForPayload(gross_weight),
    volume: formatHouseCargoWeightForPayload(volume),
    chargeable_weight: formatHouseCargoChargeableForPayload(
      gross_weight as HouseCargoWeightValue,
      volume as HouseCargoWeightValue,
      unit,
    ),
  };
}
