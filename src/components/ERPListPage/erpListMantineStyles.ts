import type { ErpListTheme } from "./erpListTheme";

/** Default `Button` `styles` for toolbar actions (32px, outline). */
export function erpToolbarOutlineButtonStyles(theme: ErpListTheme) {
  return {
    root: {
      height: 32,
      fontSize: 12,
      borderColor: theme.border,
      gap: 6,
      paddingLeft: 10,
      paddingRight: 12,
      fontFamily: theme.fontSans,
    },
  } as const;
}

/** Primary CTA in toolbar (e.g. New / Create). */
export function erpToolbarPrimaryButtonStyles(theme: ErpListTheme) {
  return {
    root: {
      height: 32,
      fontSize: 12,
      backgroundColor: theme.primary,
      gap: 6,
      paddingLeft: 10,
      paddingRight: 12,
      border: "none",
      fontFamily: theme.fontSans,
    },
  } as const;
}

/** Compact `Select` in toolbar (status, etc.). */
export function erpToolbarSelectStyles(theme: ErpListTheme) {
  return {
    input: {
      height: 32,
      minHeight: 32,
      fontSize: 12,
      borderColor: theme.border,
      fontFamily: theme.fontSans,
    },
    dropdown: { fontFamily: theme.fontSans, fontSize: 14 },
    option: { fontFamily: theme.fontSans, fontSize: 14 },
  } as const;
}

/** `Select` in table pagination footer (rows per page). */
export function erpPaginationSelectStyles(theme: ErpListTheme) {
  return {
    input: { fontFamily: theme.fontSans },
    dropdown: { fontFamily: theme.fontSans, fontSize: 14 },
    option: { fontFamily: theme.fontSans, fontSize: 14 },
  } as const;
}

/**
 * Filter panel fields: Geist labels (muted) + 32px inputs — matches Air Export
 * `AIR_EXPORT_FILTER_UNIFIED_STYLES` / list filter density.
 */
export function erpListFilterUnifiedMantineStyles(theme: ErpListTheme) {
  return {
    label: {
      fontFamily: theme.fontSans,
      fontSize: 12,
      fontWeight: 500,
      color: theme.muted,
      lineHeight: 1.25,
      marginBottom: 6,
      display: "block" as const,
      minHeight: 15,
    },
    input: {
      fontFamily: theme.fontSans,
      fontSize: 12,
      height: 32,
      minHeight: 32,
      borderColor: theme.border,
    },
    dropdown: {
      fontFamily: theme.fontSans,
      fontSize: 12,
    },
    option: {
      fontFamily: theme.fontSans,
      fontSize: 12,
    },
  } as const;
}
