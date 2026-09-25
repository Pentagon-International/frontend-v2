export type HouseChargeLike = {
  id?: number | string;
  charge_id?: number | null;
  charge_name?: string;
  pp_cc?: string;
  unit_id?: string | number | null;
  unit_code?: string;
  no_of_unit?: number | null;
  currency_id?: string | number | null;
  currency?: string;
  roe?: number | null;
  amount_per_unit?: number | null;
  amount?: number | null;
  sell_local_amount?: number | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  cost_local_amount?: number | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
};

const hasNumericChargeValue = (value: unknown): boolean => {
  if (value == null || value === "") return false;
  const n = Number(value);
  return !Number.isNaN(n) && n !== 0;
};

/** True when the row has user-entered charge data beyond UI defaults (Collect, currency, roe). */
export function hasMeaningfulHouseChargeData(charge: HouseChargeLike): boolean {
  if (String(charge.charge_name ?? "").trim()) return true;
  if (charge.charge_id != null && charge.charge_id !== 0) return true;

  if (hasNumericChargeValue(charge.amount)) return true;
  if (hasNumericChargeValue(charge.amount_per_unit)) return true;
  if (hasNumericChargeValue(charge.sell_local_amount)) return true;
  if (hasNumericChargeValue(charge.unit_cost)) return true;
  if (hasNumericChargeValue(charge.total_cost)) return true;
  if (hasNumericChargeValue(charge.cost_local_amount)) return true;

  if (String(charge.supplier_code ?? "").trim()) return true;
  if (String(charge.supplier_name ?? "").trim()) return true;

  // const unitId = charge.unit_id;
  // if (unitId != null && String(unitId).trim() !== "") return true;

  if (charge.no_of_unit != null && String(charge.no_of_unit).trim() !== "") {
    return true;
  }

  return false;
}

export function getMeaningfulHouseCharges<T extends HouseChargeLike>(
  charges: T[],
): T[] {
  return charges.filter(hasMeaningfulHouseChargeData);
}

/** Which API charge array to prefer after form `charges`. Default keeps air/inland order. */
export type HouseChargeAliasPreference = "mawb" | "mbl";

function nonEmptyChargeArray(value: unknown): unknown[] | null {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

/**
 * Resolve house charge rows for UI load / display.
 * Prefer non-empty `charges` (form/mapped), then the preferred API alias, then the other.
 * Empty `charges: []` must NOT block fallback to API charge arrays.
 * Ocean passes `"mbl"` so legacy rows stored under `mawb_charges` still load, then save as MBL.
 */
export function resolveHouseChargesSource(
  source:
    | {
        charges?: unknown;
        mbl_charges?: unknown;
        mawb_charges?: unknown;
      }
    | null
    | undefined,
  prefer: HouseChargeAliasPreference = "mawb",
): unknown[] {
  if (!source) return [];
  const charges = nonEmptyChargeArray(source.charges);
  if (charges) return charges;
  const primary = prefer === "mbl" ? source.mbl_charges : source.mawb_charges;
  const secondary = prefer === "mbl" ? source.mawb_charges : source.mbl_charges;
  return nonEmptyChargeArray(primary) ?? nonEmptyChargeArray(secondary) ?? [];
}

export type HouseChargeValidationResult = {
  valid: boolean;
  errors: Record<number, Record<string, string>>;
  roeToastMessage: string | null;
};

export type HouseChargeRoeValidator = (
  charge: HouseChargeLike,
  index: number,
) => string | null;

/**
 * Validates only charge rows with meaningful user data.
 * Rows with only default pp_cc / currency / roe are skipped.
 */
export function validateMeaningfulHouseCharges(
  charges: HouseChargeLike[],
  validateRoe: HouseChargeRoeValidator,
  options?: {
    roeCannotBeOneField?: string;
    roeCannotBeOneToast?: string;
  },
): HouseChargeValidationResult {
  const errors: Record<number, Record<string, string>> = {};
  let hasErrors = false;
  let roeToastMessage: string | null = null;

  charges.forEach((charge, index) => {
    if (!hasMeaningfulHouseChargeData(charge)) return;

    const chargeError: Record<string, string> = {};

    if (
      (!charge.charge_name || charge.charge_name.trim() === "") &&
      (charge.charge_id == null || charge.charge_id === 0)
    ) {
      chargeError.charge_name = "Charge Name is required";
      hasErrors = true;
    }
    if (!charge.pp_cc || charge.pp_cc.trim() === "") {
      chargeError.pp_cc = "Prepaid/Collect is required";
      hasErrors = true;
    }
    if (!charge.currency_id || String(charge.currency_id).trim() === "") {
      chargeError.currency_id = "Currency is required";
      hasErrors = true;
    }
    if (charge.roe === null || charge.roe === undefined) {
      chargeError.roe = "ROE is required";
      hasErrors = true;
    } else {
      const roeRuleError = validateRoe(charge, index);
      if (roeRuleError) {
        chargeError.roe = roeRuleError;
        hasErrors = true;
        if (
          options?.roeCannotBeOneField &&
          options?.roeCannotBeOneToast &&
          roeRuleError === options.roeCannotBeOneField &&
          !roeToastMessage
        ) {
          roeToastMessage = options.roeCannotBeOneToast;
        }
      }
    }
    // Sell Amount/Unit, Amount, and Local Amount are optional (cost-only rows allowed).
    // Zero is a valid sell value when entered.

    if (Object.keys(chargeError).length > 0) {
      errors[index] = chargeError;
    }
  });

  return { valid: !hasErrors, errors, roeToastMessage };
}
