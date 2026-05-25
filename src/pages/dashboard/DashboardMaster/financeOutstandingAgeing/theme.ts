import type { CSSProperties } from "react";

export const OST_PAGE_BG = "#f1f5f9";
export const OST_CARD_BG = "#ffffff";
export const OST_LINE = "#e2e8f0";
export const OST_INK = "#0f172a";
export const OST_INK_2 = "#334155";
export const OST_INK_3 = "#64748b";
export const OST_INK_4 = "#94a3b8";
export const OST_NAVY_800 = "#0f2744";
export const OST_GOOD = "#16a34a";
export const OST_BAD = "#dc2626";
export const OST_WARN = "#d97706";
export const OST_GOOD_BG = "#dcfce7";
export const OST_BAD_BG = "#fee2e2";
export const OST_WARN_BG = "#fef3c7";

export const OST_AR_ROW_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1fr 0.8fr",
  gap: 12,
  alignItems: "center",
  padding: "10px 18px",
};

export const AGEING_BUCKET_STRIPES: Record<string, string> = {
  current: "#22c55e",
  days_1_30: "#fbbf24",
  days_31_60: "#fb923c",
  days_61_90: "#ea580c",
  days_90_plus: "#dc2626",
};

export const BRANCH_CHIP_CITY: Record<string, string> = {
  mum: "Mumbai",
  del: "Delhi",
  blr: "Bangalore",
  maa: "Chennai",
  ccu: "Kolkata",
  amd: "Ahmedabad",
};
