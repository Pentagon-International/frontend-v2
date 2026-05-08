import type { CSSProperties } from "react";
import { erpListGeistRootTypography } from "../../../components";

/** Shared shell for Sales dashboard widgets — Geist rhythm aligned with AirExportBookingMaster. */
export const dashboardPanelShell: CSSProperties = {
  ...erpListGeistRootTypography,
  background: "#ffffff",
  border: "1px solid #E2E8F0",
  borderRadius: "12px",
  padding: "18px 20px",
  flex: 1,
  width: "100%",
  minHeight: 0,
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  boxShadow:
    "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 14px rgba(15, 23, 42, 0.06)",
};

/** Same header height & divider position across all dashboard tiles. */
export const dashboardPanelHeaderBand: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  paddingBottom: 0,
  marginBottom: 12,
  boxSizing: "border-box",
};

/** Fills remaining card height; minHeight 0 lets flex children shrink without layout blowout. */
export const dashboardPanelBody: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

export const dashboardPanelTitleStyle: CSSProperties = {
  fontFamily: "Geist",
  fontSize: "14px",
  fontWeight: "550",
  color: "#0F172A",
  lineHeight: 1.3,
};

export const dashboardViewAllStyle: CSSProperties = {
  fontFamily: erpListGeistRootTypography.fontFamily,
  fontSize: 14,
  fontWeight: 500,
  WebkitFontSmoothing: erpListGeistRootTypography.WebkitFontSmoothing,
  MozOsxFontSmoothing: erpListGeistRootTypography.MozOsxFontSmoothing,
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
