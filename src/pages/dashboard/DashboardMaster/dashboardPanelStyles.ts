import type { CSSProperties } from "react";

/** Shared shell for Sales dashboard widgets (ERP-style consistency). */
export const dashboardPanelShell: CSSProperties = {
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
  minHeight: 44,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  paddingBottom: 8,
  marginBottom: 16,
  borderBottom: "1px solid #EEF2F6",
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
  fontSize: "14px",
  fontWeight: 600,
  color: "#0F172A",
  letterSpacing: "0.02em",
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const dashboardViewAllStyle: CSSProperties = {
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
