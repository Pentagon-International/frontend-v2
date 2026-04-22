import { createTheme, rem } from "@mantine/core";

/**
 * CSS class from `index.css` — scopes Geist to list screens (same as Air Export Booking).
 */
export const ERP_LIST_GEIST_ROOT_CLASS = "air-export-booking-geist-root";

export const ERP_LIST_GEIST_MONO_CLASS = "air-export-geist-mono";

export const ERP_LIST_FONT_SANS = "'Geist', sans-serif";
export const ERP_LIST_FONT_MONO = "'Geist Mono', monospace";

/** Root box style for `ERP_LIST_GEIST_ROOT_CLASS` wrappers. */
export const erpListGeistRootTypography = {
  fontFamily: ERP_LIST_FONT_SANS,
  fontSize: 14,
  lineHeight: 1.5,
  WebkitFontSmoothing: "antialiased" as const,
  MozOsxFontSmoothing: "grayscale" as const,
};

/** Mantine theme slice aligned with Air Export list density. */
export const erpListGeistMantineTheme = createTheme({
  fontFamily: ERP_LIST_FONT_SANS,
  fontFamilyMonospace: ERP_LIST_FONT_MONO,
  headings: { fontFamily: ERP_LIST_FONT_SANS },
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },
});

export const erpListGeistMenuDropdownStyles = {
  dropdown: { fontFamily: ERP_LIST_FONT_SANS, fontSize: 14 },
} as const;

export const erpListGeistSelectClassNames = {
  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
  option: ERP_LIST_GEIST_ROOT_CLASS,
} as const;
