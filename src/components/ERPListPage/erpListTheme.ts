import type { MantineSpacing } from "@mantine/core";

/** Default ERP list / master screen tokens (matches Air Export Booking v0). */
export interface ErpListTheme {
  border: string;
  muted: string;
  fg: string;
  primary: string;
  /** Table sub-header band inside the card */
  headerBg: string;
  pageBg: string;
  cardBg: string;
  fontSans: string;
}

export const DEFAULT_ERP_LIST_THEME: ErpListTheme = {
  border: "#e2e8f0",
  muted: "#64748b",
  fg: "#0f172a",
  primary: "#105476",
  headerBg: "#f8fafc",
  pageBg: "#F0F4F8",
  cardBg: "#ffffff",
  fontSans: "'Geist', sans-serif",
};

/** Cancels AppShell main horizontal padding; pair with inner `px`. */
export const ERP_LIST_FULL_BLEED_MX = { base: -16, sm: -24 } as const;

export const ERP_LIST_INNER_PAD_X: Record<string, MantineSpacing> = {
  base: 16,
  lg: 24,
};
