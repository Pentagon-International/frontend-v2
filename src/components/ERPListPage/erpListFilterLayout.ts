import type { CSSProperties } from "react";

/**
 * Clips each filter control in a full-width flex column (Air Export booking pattern)
 * so labels + 32px inputs align across `Grid` rows.
 */
export const erpListFilterFieldCellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  minHeight: 0,
};

/**
 * Air Export `AirExportBookingMaster` default: full width on small screens, then
 * 1/2 → 1/3 → 1/6 of the 12-col grid.
 */
export const ERP_LIST_FILTER_FIELD_COL_SPAN = {
  base: 12,
  sm: 6,
  md: 4,
  xl: 2,
} as const;

/** Wider control (e.g. date range): half row on `xl` (4/12) */
export const ERP_LIST_FILTER_FIELD_COL_SPAN_WIDE = {
  base: 12,
  sm: 12,
  md: 8,
  xl: 4,
} as const;

/** Five equal columns on a 12-col grid (2.4 × 5) — e.g. pipeline / freight rows */
export const ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS = {
  base: 12,
  sm: 6,
  md: 4,
  xl: 2.4,
} as const;

/** Two “fifth” spans (4.8 / 12) for a wide field beside five-column rows */
export const ERP_LIST_FILTER_FIELD_COL_SPAN_TWO_FIFTHS = {
  base: 12,
  sm: 12,
  md: 8,
  xl: 4.8,
} as const;

/** Four equal columns (3/12) — tariff carrier / service / dates */
export const ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER = {
  base: 12,
  sm: 6,
  md: 3,
  xl: 3,
} as const;
