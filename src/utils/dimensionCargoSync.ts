/**
 * Shared dimension/cargo-sync utilities for Booking and House (enquiry-parity).
 * AIR: Centimeter=6000, Inch=366
 * LCL: Centimeter=1000000, Inch=1728
 */

export const DIMENSION_DIVISORS: Record<string, Record<string, number>> = {
  AIR: { Centimeter: 6000, Inch: 366 },
  LCL: { Centimeter: 1000000, Inch: 1728 },
  INLAND: { Centimeter: 6000, Inch: 366 }, // air-like
};

export const DIMENSION_UNIT_OPTIONS_BY_SERVICE: Record<
  string,
  { value: string; label: string }[]
> = {
  AIR: [
    { value: "Centimeter", label: "Centimeter" },
    { value: "Inch", label: "Inch" },
  ],
  LCL: [
    { value: "Centimeter", label: "Centimeter" },
    { value: "Inch", label: "Inch" },
  ],
  INLAND: [
    { value: "Centimeter", label: "Centimeter" },
    { value: "Inch", label: "Inch" },
  ],
};

/**
 * Return divisor for a given service + unit label.
 * Falls back to AIR divisors when service is unknown/unsupported.
 */
export function getDimensionValue(service: string, unitLabel: string): number {
  const svc = (service || "").toUpperCase();
  const unit = unitLabel || "";
  const map = DIMENSION_DIVISORS[svc] ?? DIMENSION_DIVISORS["AIR"];
  return map[unit] ?? 0;
}

/**
 * Same rounding as EnquiryCreate:
 * if fractional part >= 0.5 → ceil; else round to 2dp.
 */
export function roundVol(val: number): number {
  if (!isFinite(val)) return 0;
  const frac = val - Math.trunc(val);
  if (frac >= 0.5) return Math.ceil(val);
  return Math.round(val * 100) / 100;
}

/** Calculate per-row volume weight from raw L*W*H*pieces / divisor. */
export function calcRowVolWeight(
  length: number,
  width: number,
  height: number,
  pieces: number,
  divisor: number,
): number {
  if (!divisor) return 0;
  const raw = (length * width * height * pieces) / divisor;
  return roundVol(raw);
}

export interface DimensionRow {
  /** Present when editing an existing row returned by the API. */
  id?: number;
  pieces: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  /** Divisor stored on each row (same as getDimensionValue result). */
  value: number | null;
  vol_weight: number | null;
}

/**
 * Map `dimension_data` returned by the API into editable form rows.
 * API shape: { id, pieces, length, width, height, value, volume_weight, dimension_unit }
 */
export function mapDimensionDataToFormRows(
  dimensionData: unknown[],
): DimensionRow[] {
  if (!Array.isArray(dimensionData) || dimensionData.length === 0) return [];
  return dimensionData.map((d: any) => ({
    id: d.id ?? undefined,
    pieces: d.pieces ?? null,
    length: d.length ?? null,
    width: d.width ?? null,
    height: d.height ?? null,
    value: d.value ?? null,
    vol_weight: d.volume_weight ?? null,
  }));
}

/**
 * Derive the dimension_unit string from the first row of dimension_data
 * (API stores `dimension_unit` on each row).
 */
export function getDimensionUnitFromData(dimensionData: unknown[]): string {
  if (!Array.isArray(dimensionData) || dimensionData.length === 0)
    return "Centimeter";
  const first = dimensionData[0] as any;
  return String(first?.dimension_unit || "Centimeter");
}

/**
 * Map form rows → API `dimension_details` payload array.
 */
export function mapFormRowsToDimensionDetails(
  rows: DimensionRow[],
  dimUnit: string,
  service: string,
): Record<string, unknown>[] {
  const divisor = getDimensionValue(service, dimUnit);
  return rows
    .filter(
      (r) =>
        (Number(r.pieces) || 0) > 0 ||
        (Number(r.length) || 0) > 0 ||
        (Number(r.width) || 0) > 0 ||
        (Number(r.height) || 0) > 0,
    )
    .map((r) => {
      const item: Record<string, unknown> = {
        pieces: Math.trunc(Number(r.pieces) || 0),
        length: Math.round((Number(r.length) || 0) * 100) / 100,
        width: Math.round((Number(r.width) || 0) * 100) / 100,
        height: Math.round((Number(r.height) || 0) * 100) / 100,
        value: r.value ?? divisor,
        volume_weight: Math.round((Number(r.vol_weight) || 0) * 1000) / 1000,
        dimension_unit: dimUnit,
      };
      if (r.id) item.id = r.id;
      return item;
    });
}

const DIM_SERVICES = new Set(["AIR", "LCL", "INLAND"]);

/**
 * Always include `dimension_details` for AIR/LCL/INLAND (including `[]`)
 * so cleared rows soft-delete on the backend. Omit for other services.
 */
export function dimensionDetailsForPayload(
  service: string,
  rows: DimensionRow[] | undefined | null,
  dimUnit?: string,
): { dimension_details: Record<string, unknown>[] } | Record<string, never> {
  const svc = (service || "").toUpperCase();
  if (!DIM_SERVICES.has(svc) || !Array.isArray(rows)) return {};
  return {
    dimension_details: mapFormRowsToDimensionDetails(
      rows,
      dimUnit || "Centimeter",
      svc,
    ),
  };
}

/**
 * Coerce enquiry/quotation haz flags ("Yes"/"No", bool, 1/0) → boolean.
 */
export function coerceHazardousFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "yes" || s === "true" || s === "1";
  }
  return false;
}

/**
 * Resolve raw dimension arrays from enquiry/quotation/service shapes.
 * Supports: dimension_data, dimension_details, diemensions (enquiry form typo).
 */
export function extractDimensionSource(
  src: Record<string, unknown> | null | undefined,
): unknown[] {
  if (!src || typeof src !== "object") return [];
  const data = src.dimension_data;
  if (Array.isArray(data) && data.length > 0) return data;
  const details = src.dimension_details;
  if (Array.isArray(details) && details.length > 0) return details;
  const typo = src.diemensions;
  if (Array.isArray(typo) && typo.length > 0) {
    return typo.map((d: any) => ({
      pieces: d.pieces ?? null,
      length: d.length ?? null,
      width: d.width ?? null,
      height: d.height ?? null,
      value: d.value ?? null,
      volume_weight: d.volume_weight ?? d.vol_weight ?? null,
      dimension_unit: d.dimension_unit,
    }));
  }
  return [];
}

/**
 * Map enquiry/quotation service haz fields into EnquiryCreate cargo Yes/No shape.
 */
export function resolveEnquiryHazCargoFields(
  service: Record<string, unknown> | null | undefined,
  fcl?: Record<string, unknown> | null,
): {
  hazardous_cargo: "Yes" | "No";
  un_no: string | null;
  class: string | null;
  pkg_group: string | null;
} {
  const src = service || {};
  const cargoList = Array.isArray(src.cargo_details)
    ? (src.cargo_details as Record<string, unknown>[])
    : [];
  const cargo0 = cargoList[0] || {};
  const isHaz = coerceHazardousFlag(
    src.hazardous_cargo ?? cargo0.hazardous_cargo,
  );
  if (!isHaz) {
    return {
      hazardous_cargo: "No",
      un_no: null,
      class: null,
      pkg_group: null,
    };
  }
  const un_no =
    (src.un_no as string | null | undefined) ||
    (cargo0.un_no as string | null | undefined) ||
    (fcl?.un_no as string | null | undefined) ||
    null;
  const classVal =
    (src.class_name as string | null | undefined) ||
    (src.class as string | null | undefined) ||
    (cargo0.class_name as string | null | undefined) ||
    (cargo0.class as string | null | undefined) ||
    (fcl?.class_name as string | null | undefined) ||
    (fcl?.class as string | null | undefined) ||
    null;
  const pkg_group =
    (src.pkg_group as string | null | undefined) ||
    (cargo0.pkg_group as string | null | undefined) ||
    (fcl?.pkg_group as string | null | undefined) ||
    null;
  return {
    hazardous_cargo: "Yes",
    un_no: un_no ? String(un_no) : null,
    class: classVal ? String(classVal) : null,
    pkg_group: pkg_group ? String(pkg_group) : null,
  };
}

/**
 * Prefill haz + dims for quotation/enquiry → booking Create pages.
 * Omits enquiry dim ids (booking creates new rows on save).
 */
export function buildBookingHazDimPrefill(
  serviceDetails: Record<string, unknown> | null | undefined,
): {
  is_hazardous: boolean;
  un_no: string;
  class_name: string;
  pkg_group: string;
  dimension_unit: string;
  dimensions: DimensionRow[];
} {
  const src = serviceDetails || {};
  const cargoList = Array.isArray(src.cargo_details)
    ? (src.cargo_details as Record<string, unknown>[])
    : [];
  const cargo = cargoList[0] || {};

  const is_hazardous = coerceHazardousFlag(
    src.hazardous_cargo ?? src.is_hazardous ?? cargo.hazardous_cargo,
  );
  const un_no = String(src.un_no ?? cargo.un_no ?? "").trim();
  const class_name = String(
    src.class_name ?? src.class ?? cargo.class_name ?? cargo.class ?? "",
  ).trim();
  const pkg_group = String(src.pkg_group ?? cargo.pkg_group ?? "").trim();

  const dimRaw = extractDimensionSource(src);
  const unitFromSrc =
    typeof src.dimension_unit === "string" && src.dimension_unit.trim()
      ? String(src.dimension_unit).trim()
      : "";
  const dimension_unit =
    unitFromSrc || getDimensionUnitFromData(dimRaw) || "Centimeter";
  const dimensions = mapDimensionDataToFormRows(dimRaw).map(
    ({ id: _id, ...rest }) => rest,
  );

  return {
    is_hazardous,
    un_no: is_hazardous ? un_no : "",
    class_name: is_hazardous ? class_name : "",
    pkg_group: is_hazardous ? pkg_group : "",
    dimension_unit,
    dimensions,
  };
}

/**
 * Fields to merge into Quotation → booking `serviceDetails` navigation state.
 */
export function buildQuotationServiceHazDimFields(
  service: Record<string, unknown> | null | undefined,
  quotation?: Record<string, unknown> | null,
): Record<string, unknown> {
  const src = { ...(quotation || {}), ...(service || {}) };
  const prefill = buildBookingHazDimPrefill(src);
  const dimRaw = extractDimensionSource(src);
  return {
    hazardous_cargo: prefill.is_hazardous,
    un_no: prefill.un_no || null,
    class_name: prefill.class_name || null,
    pkg_group: prefill.pkg_group || null,
    dimension_unit: prefill.dimension_unit,
    dimension_data: dimRaw.length
      ? dimRaw.map((d: any) => ({
          pieces: d.pieces ?? null,
          length: d.length ?? null,
          width: d.width ?? null,
          height: d.height ?? null,
          value: d.value ?? null,
          volume_weight: d.volume_weight ?? d.vol_weight ?? null,
          dimension_unit: d.dimension_unit || prefill.dimension_unit,
        }))
      : [],
  };
}

/** Compute total pieces and total vol-weight from form rows. */
export function computeDimensionTotals(rows: DimensionRow[]): {
  totalPieces: number;
  totalVolWeight: number;
} {
  const totalPieces = rows.reduce(
    (s, r) => s + (Number(r.pieces) || 0),
    0,
  );
  const totalVolWeightRaw = rows.reduce(
    (s, r) => s + (Number(r.vol_weight) || 0),
    0,
  );
  return { totalPieces, totalVolWeight: roundVol(totalVolWeightRaw) };
}
