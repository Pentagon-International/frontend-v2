/** Normalize stored package_type to code (supports legacy "CODE - Name"). */
export function normalizePackageTypeCode(
  value: string | null | undefined,
): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const match = s.match(/^([A-Za-z0-9]+)\s+-\s+/);
  if (match) return match[1];
  return s;
}

/** Read package type code from API/cargo row (`package_type_code` or legacy `package_type`). */
export function pickPackageTypeCodeFromCargo(
  cargo: Record<string, unknown> | null | undefined,
): string {
  if (!cargo || typeof cargo !== "object") return "";
  return normalizePackageTypeCode(
    (cargo.package_type_code ?? cargo.package_type ?? "") as string,
  );
}

/** Extract package_type_name for BOL (supports code-only, `CODE-Name`, `CODE - Name`). */
export function formatPackageTypeNameForBol(
  value: string | null | undefined,
): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const spaced = raw.match(/^[A-Za-z0-9]+\s+-\s+(.+)$/);
  if (spaced) return spaced[1].trim();
  const compact = raw.match(/^[A-Za-z0-9]+-(.+)$/);
  if (compact) return compact[1].trim();
  return raw;
}

export type PackageTypeOption = {
  value: string;
  /** House UI: `{code}-{name}` */
  label: string;
  /** BOL / print: name only */
  name: string;
};

/** Resolve package type name from code using master options. */
export function resolvePackageTypeName(
  packageTypeCode: string | null | undefined,
  options?: PackageTypeOption[],
): string {
  const raw = packageTypeCode != null ? String(packageTypeCode).trim() : "";
  if (!raw) return "";
  const code = normalizePackageTypeCode(raw);
  const match = options?.find((o) => o.value === code);
  if (match?.name) return match.name;
  return formatPackageTypeNameForBol(raw);
}

/**
 * Resolve package type name for BOL.
 * Prefers cargo_details package_type(_code), then housing.package_type, else fallback.
 */
export function resolvePackageTypeFromHousing(
  housingData:
    | {
        package_type?: unknown;
        cargo_details?: unknown;
      }
    | null
    | undefined,
  fallback = "PACKAGE(S)",
): string {
  const cargoList = Array.isArray(housingData?.cargo_details)
    ? housingData.cargo_details
    : [];

  for (const row of cargoList) {
    const cargo = (row ?? {}) as Record<string, unknown>;
    const pt = cargo.package_type ?? cargo.package_type_code;
    const name = formatPackageTypeNameForBol(pt != null ? String(pt) : "");
    if (name) return name;
  }

  const top = formatPackageTypeNameForBol(
    housingData?.package_type != null
      ? String(housingData.package_type)
      : "",
  );
  if (top) return top;
  return fallback;
}

export function extractPackageTypeList(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object") {
    const data = (response as { data?: unknown }).data;
    if (Array.isArray(data)) return data;
  }
  return [];
}

export function mapPackageTypeOptions(
  records: unknown[],
  options?: { activeOnly?: boolean },
): PackageTypeOption[] {
  if (!Array.isArray(records)) return [];
  const activeOnly = options?.activeOnly !== false;

  return records
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const status = row.status != null ? String(row.status) : "";
      if (activeOnly && status && status !== "ACTIVE") return null;

      const code =
        row.package_type_code != null ? String(row.package_type_code) : "";
      if (!code) return null;

      const name =
        row.package_type_name != null
          ? String(row.package_type_name)
          : code;

      return {
        value: code,
        label: `${code}-${name}`,
        name,
      };
    })
    .filter((opt): opt is PackageTypeOption => opt != null);
}
