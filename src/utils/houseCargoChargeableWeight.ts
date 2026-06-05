import { roundToDecimals } from "./numberInputUtils";

/** Max decimal places for volume and chargeable weight on house cargo rows. */
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

/** Load from API/edit data — keep string decimals when the API sends them. */
export function importHouseCargoWeightFromApi(
  value: unknown,
): HouseCargoWeightValue {
  if (value === null || value === undefined || value === "") return null;
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

/**
 * Use the same stored representation as the winning source (volume or gross).
 */
function resolveChargeableDisplayValue(
  chargeableNum: number,
  volume: HouseCargoWeightValue,
  grossWeight: HouseCargoWeightValue,
  volNum: number,
  grossNum: number,
  unit: HouseChargeableWeightUnit,
): HouseCargoWeightValue {
  const grossCbm = grossNum > 0 ? grossNum / 1000 : 0;
  const volumeWins =
    volNum > 0 &&
    (unit === "ocean" ? volNum >= grossCbm : volNum >= grossNum);
  const grossWins =
    grossNum > 0 &&
    (unit === "ocean" ? grossCbm > volNum : grossNum > volNum);

  if (volumeWins) {
    return volume ?? coerceHouseCargoWeightInput(chargeableNum);
  }
  if (grossWins) {
    return grossWeight ?? coerceHouseCargoWeightInput(chargeableNum);
  }
  return coerceHouseCargoWeightInput(chargeableNum);
}

/**
 * Ocean (CBM): chargeable = max(gross ÷ 1000, volume) — display matches winning field.
 * Air (KG): chargeable = max(gross, volume) — display matches winning field.
 */
export function calculateHouseChargeableWeight(
  grossWeight: HouseCargoWeightValue,
  volume: HouseCargoWeightValue,
  unit: HouseChargeableWeightUnit,
): HouseCargoWeightValue {
  const grossNum = parseHouseCargoWeightInput(grossWeight) ?? 0;
  const volNum = parseHouseCargoWeightInput(volume) ?? 0;

  if (!grossNum && !volNum) return null;

  const chargeableNum =
    unit === "ocean"
      ? Math.max(grossNum ? grossNum / 1000 : 0, volNum)
      : Math.max(grossNum, volNum);

  if (chargeableNum <= 0) return null;

  return resolveChargeableDisplayValue(
    chargeableNum,
    volume,
    grossWeight,
    volNum,
    grossNum,
    unit,
  );
}

export function withRecalculatedChargeableWeight<
  T extends {
    gross_weight: HouseCargoWeightValue;
    volume: HouseCargoWeightValue;
    chargeable_weight: HouseCargoWeightValue;
  },
>(cargo: T, unit: HouseChargeableWeightUnit): T {
  const chargeable = calculateHouseChargeableWeight(
    cargo.gross_weight,
    cargo.volume,
    unit,
  );
  return {
    ...cargo,
    chargeable_weight: isPositiveHouseCargoWeight(chargeable) ? chargeable : null,
  };
}

export function formatHouseCargoDetailWeightFields<
  T extends { volume?: unknown; chargeable_weight?: unknown },
>(
  cargo: T,
): Omit<T, "volume" | "chargeable_weight"> & {
  volume: string | null;
  chargeable_weight: string | null;
} {
  const { volume, chargeable_weight, ...rest } = cargo;
  return {
    ...rest,
    volume: formatHouseCargoWeightForPayload(volume),
    chargeable_weight: formatHouseCargoWeightForPayload(chargeable_weight),
  };
}
