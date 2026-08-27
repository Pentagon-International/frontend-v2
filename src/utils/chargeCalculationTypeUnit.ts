/**
 * Default unit_code from charge-master calculation_type.
 * Applied only when a charge is newly selected and the row's unit is empty.
 *
 * UNIT        → KG (AIR / Inland), W/M (LCL), none (FCL)
 * SHIPMENT    → SHPT (all flows)
 * PERCENTAGE  → PERCNT (all flows)
 * PER_CONTAINER → none (manual)
 */

export function isChargeUnitValueEmpty(unit: unknown): boolean {
  return unit == null || String(unit).trim() === "";
}

function normalizeServiceType(service: unknown): string {
  if (Array.isArray(service)) {
    return String(service[0] ?? "")
      .trim()
      .toUpperCase();
  }
  return String(service ?? "")
    .trim()
    .toUpperCase();
}

export function resolveDefaultUnitCodeFromCalculationType(
  calculationType: unknown,
  service: unknown,
): string | null {
  const calc = String(calculationType ?? "")
    .trim()
    .toUpperCase();
  if (!calc) return null;

  if (calc === "SHIPMENT") return "SHPT";
  if (calc === "PERCENTAGE") return "PERCNT";
  if (calc === "PER_CONTAINER") return null;

  if (calc === "UNIT") {
    const svc = normalizeServiceType(service);
    if (svc === "AIR" || svc === "INLAND") return "KG";
    if (svc === "LCL") return "W/M";
    return null;
  }

  return null;
}

type UnitOptionLike = {
  value: string;
  label: string;
  unit_code?: string;
};

function normalizeUnitToken(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/** Alternate codes that may appear in unit master for the same default. */
function unitCodeMatchCandidates(unitCode: string): string[] {
  const upper = String(unitCode ?? "")
    .trim()
    .toUpperCase();
  if (!upper) return [];
  const aliases: Record<string, string[]> = {
    SHPT: ["SHPT", "SHIPMENT"],
    PERCNT: ["PERCNT", "PERCENTAGE", "PERCENT"],
    "W/M": ["W/M", "WM"],
    KG: ["KG", "KGS", "KG(S)"],
  };
  return aliases[upper] ?? [upper];
}

/** Match a preferred unit_code against dropdown options (booking / quotation). */
export function findUnitOptionValueByCode(
  unitCode: string,
  unitOptions: UnitOptionLike[],
): string | null {
  const candidates = unitCodeMatchCandidates(unitCode);
  if (!candidates.length || !unitOptions.length) return null;

  for (const candidate of candidates) {
    const targetUpper = candidate.toUpperCase();
    const targetToken = normalizeUnitToken(candidate);

    const byCode = unitOptions.find((option) => {
      const code = String(option.unit_code ?? option.value ?? "")
        .trim()
        .toUpperCase();
      return code === targetUpper;
    });
    if (byCode) return byCode.value;

    const byValue = unitOptions.find(
      (option) => option.value.trim().toUpperCase() === targetUpper,
    );
    if (byValue) return byValue.value;

    const byToken = unitOptions.find((option) => {
      const codeToken = normalizeUnitToken(
        String(option.unit_code ?? option.value ?? ""),
      );
      const labelToken = normalizeUnitToken(option.label);
      return (
        codeToken === targetToken ||
        labelToken === targetToken ||
        labelToken.startsWith(targetToken)
      );
    });
    if (byToken) return byToken.value;
  }

  return null;
}

/** Match preferred unit_code for job/invoice options that use unit_id as value. */
export function findJobUnitOptionByCode(
  unitCode: string,
  unitOptions: UnitOptionLike[],
): UnitOptionLike | null {
  const value = findUnitOptionValueByCode(unitCode, unitOptions);
  if (!value) return null;
  return unitOptions.find((option) => option.value === value) ?? null;
}

/**
 * Resolve default unit for a newly selected charge.
 * Returns null when unit should not be auto-set (empty calc type, PER_CONTAINER,
 * FCL+UNIT, or unit already populated).
 */
export function resolveAutoUnitForNewCharge(params: {
  calculationType: unknown;
  service: unknown;
  currentUnit?: unknown;
  currentUnitId?: unknown;
  currentUnitCode?: unknown;
}): string | null {
  const unitAlreadySet =
    !isChargeUnitValueEmpty(params.currentUnit) ||
    !isChargeUnitValueEmpty(params.currentUnitId) ||
    !isChargeUnitValueEmpty(params.currentUnitCode);
  if (unitAlreadySet) return null;

  return resolveDefaultUnitCodeFromCalculationType(
    params.calculationType,
    params.service,
  );
}
