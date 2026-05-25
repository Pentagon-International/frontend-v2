import type { CSSProperties } from "react";
import type { PendingActivityCategory } from "./financePendingActivitiesTypes";

export const PA_PAGE_BG = "#f1f5f9";
export const PA_CARD_BG = "#ffffff";
export const PA_LINE = "#e2e8f0";
export const PA_INK = "#0f172a";
export const PA_INK_3 = "#64748b";
export const PA_INK_4 = "#94a3b8";
export const PA_NAVY_800 = "#0f2744";
export const PA_BAD = "#dc2626";
export const PA_WARN = "#d97706";
export const PA_GOOD = "#16a34a";
export const PA_BAD_BG = "#fee2e2";
export const PA_WARN_BG = "#fef3c7";

export const PA_KPI_STRIPE: Record<PendingActivityCategory, string> = {
  invoices: "#f59e0b",
  costs: "#6366f1",
  vouchers: "#be185d",
  credit_notes: "#16a34a",
};

export const PA_KPI_ICON_BG: Record<PendingActivityCategory, string> = {
  invoices: "#fff7ed",
  costs: "#eef2ff",
  vouchers: "#fdf2f8",
  credit_notes: "#f0fdf4",
};

export const PA_DIST_COLOR: Record<PendingActivityCategory, string> = {
  invoices: "#f59e0b",
  costs: "#6366f1",
  vouchers: "#be185d",
  credit_notes: "#16a34a",
};

export const PA_BRANCH_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr 1.4fr 1fr 0.9fr",
  gap: 12,
  alignItems: "center",
  padding: "11px 18px",
};

export const PA_ACTIVITY_ROW_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px 1.6fr 0.9fr 0.75fr 0.55fr 0.65fr 20px",
  gap: 10,
  alignItems: "center",
  padding: "10px 16px",
};

export const PA_VOUCHER_ROW_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px 1.6fr 0.7fr 0.75fr 0.55fr 0.65fr 20px",
  gap: 10,
  alignItems: "center",
  padding: "10px 16px",
};

export const BRANCH_CHIP_CITY: Record<string, string> = {
  mum: "Mumbai",
  del: "Delhi",
  blr: "Bangalore",
  maa: "Chennai",
  ccu: "Kolkata",
  amd: "Ahmedabad",
};
