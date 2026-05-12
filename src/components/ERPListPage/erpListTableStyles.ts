import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { ErpListTheme } from "./erpListTheme";

/**
 * Native `<table>` shell — matches {@link AirExportBookingMaster} list table.
 */
export function erpListTableElementStyle(theme: ErpListTheme): CSSProperties {
  return {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
    backgroundColor: theme.cardBg,
    fontFamily: theme.fontSans,
  };
}

export type ErpListThOptions = {
  textAlign?: "left" | "right" | "center";
};

/**
 * Header cell — matches Air Export `Th` (sans sort button).
 */
export function erpListThStyle(theme: ErpListTheme, options?: ErpListThOptions): CSSProperties {
  return {
    padding: "6px 10px",
    textAlign: options?.textAlign ?? "left",
    fontWeight: 500,
    minWidth:120,
    fontSize: 14,
    color: theme.muted,
    backgroundColor: theme.headerBg,
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: "nowrap",
    userSelect: "none",
  };
}

/** Padding-only body cell (row border lives on `<tr>`). */
export function erpListTdPaddingStyle(): CSSProperties {
  return { padding: "10px" };
}

/**
 * Body cell tone — matches {@link AirExportBookingMaster} list body columns
 * (dates/mono-style fields → muted; Pcs → muted right; key amounts → `fg` + 500).
 */
export type ErpListBodyCellTone = "default" | "muted" | "numeric" | "numericStrong";

/**
 * Merges padding with Air-style foreground / alignment for data cells.
 */
export function erpListTdCellToneStyle(
  theme: ErpListTheme,
  tone: ErpListBodyCellTone = "default",
): CSSProperties {
  const pad = erpListTdPaddingStyle();
  switch (tone) {
    case "muted":
      return { ...pad, color: theme.muted, fontSize: 14 };
    case "numeric":
      return { ...pad, textAlign: "right", fontSize: 14, color: theme.muted };
    case "numericStrong":
      return {
        ...pad,
        textAlign: "right",
        fontSize: 14,
        fontWeight: 500,
        color: theme.fg,
      };
    default:
      return { ...pad };
  }
}

/**
 * Last header cell reserved for row actions / menu (no label).
 * Air Export uses ~44px; list screens often use 48px.
 */
export function erpListThActionsSpacer(
  theme: ErpListTheme,
  widthPx: number = 48,
): CSSProperties {
  return {
    width: widthPx,
    minWidth: widthPx,
    backgroundColor: theme.headerBg,
    borderBottom: `1px solid ${theme.border}`,
  };
}

/**
 * Row action menu cell (non-sticky) — {@link AirExportBookingMaster} uses `10px 8px` and centered icon.
 */
export function erpListRowActionMenuTdStyle(): CSSProperties {
  return { padding: "10px 8px", textAlign: "center" };
}

/**
 * Sticky trailing column for row actions (Lead / Call / Enquiry summary).
 */
export function erpListStickyActionTdStyle(
  theme: ErpListTheme,
  options?: { paddingInline?: "8px" | "14px" },
): CSSProperties {
  const pad = options?.paddingInline ?? "8px";
  return {
    padding: `10px ${pad}`,
    position: "sticky",
    right: 0,
    backgroundColor: theme.cardBg,
    borderLeft: `1px solid ${theme.border}`,
    boxShadow: "-4px 0 8px -4px rgba(15, 23, 42, 0.08)",
    zIndex: 2,
  };
}

/**
 * Sticky last header so it lines up with `erpListStickyActionTdStyle` (optional; many screens use an empty spacer th instead).
 */
export function erpListStickyActionThStyle(theme: ErpListTheme, minWidthPx: number = 80): CSSProperties {
  return {
    ...erpListThStyle(theme),
    position: "sticky",
    right: 0,
    zIndex: 3,
    minWidth: minWidthPx,
  };
}

export type ErpListDataRowInteraction = {
  style: CSSProperties;
  onMouseEnter: (e: ReactMouseEvent<HTMLTableRowElement>) => void;
  onMouseLeave: (e: ReactMouseEvent<HTMLTableRowElement>) => void;
};

/**
 * Data row: bottom border on the row + hover to `headerBg` (#f8fafc) like Air Export.
 * Optional `selected` tints the row with primary (8% alpha).
 */
/**
 * `<table>` on {@link AirExportBookingMaster} — no root `fontFamily` (inherits Geist from shell).
 */
export function erpListBookingMasterTableStyle(theme: ErpListTheme): CSSProperties {
  return {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
    backgroundColor: theme.cardBg,
  };
}

/** Trailing header cell for row menu (~44px) — matches Air Export Booking list. */
export function erpListBookingMasterTrailingHeaderTh(theme: ErpListTheme): CSSProperties {
  return {
    width: 44,
    backgroundColor: theme.headerBg,
    borderBottom: `1px solid ${theme.border}`,
  };
}

export const ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG = "#f1f5f9";

/** Default body `<td>` padding — Air Export Booking data cells. */
export function erpListBookingMasterBodyTd(): CSSProperties {
  return { padding: "10px 14px" };
}

/** Muted date column — Air Export Booking `Date` column. */
export function erpListBookingMasterDateTd(theme: ErpListTheme): CSSProperties {
  return { padding: "10px 14px", color: theme.muted };
}

/**
 * Reference-style cell shell (MAWB, flight) — Air Export Booking mono band + 12px muted.
 * Pair with `ERP_LIST_GEIST_MONO_CLASS` on `<td>`.
 */
export function erpListBookingMasterReferenceTdShell(theme: ErpListTheme): CSSProperties {
  return { padding: "10px 14px", fontSize: 12, color: theme.muted };
}

export function erpListDataRowProps(
  theme: ErpListTheme,
  options?: { selected?: boolean },
): ErpListDataRowInteraction {
  const { border, headerBg, primary } = theme;
  const selected = Boolean(options?.selected);
  return {
    style: {
      borderBottom: `1px solid ${border}`,
      transition: "background 0.12s",
      backgroundColor: selected ? `${primary}08` : undefined,
    },
    onMouseEnter: (e) => {
      const el = e.currentTarget as HTMLTableRowElement;
      if (!selected) el.style.backgroundColor = headerBg;
    },
    onMouseLeave: (e) => {
      const el = e.currentTarget as HTMLTableRowElement;
      if (!selected) el.style.backgroundColor = "";
    },
  };
}
