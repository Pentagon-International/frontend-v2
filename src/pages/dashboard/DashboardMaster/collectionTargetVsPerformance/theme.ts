import type { CSSProperties } from "react";

export const COL_PAGE_BG = "#f1f5f9";
export const COL_CARD_BG = "#ffffff";
export const COL_LINE = "#e2e8f0";
export const COL_INK = "#0f172a";
export const COL_INK_2 = "#334155";
export const COL_INK_3 = "#64748b";
export const COL_INK_4 = "#94a3b8";
export const COL_NAVY_700 = "#1e3a5f";
export const COL_NAVY_800 = "#0f2744";
export const COL_NAVY_900 = "#0a1628";
export const COL_GOOD = "#16a34a";
export const COL_BAD = "#dc2626";
export const COL_WARN = "#d97706";
export const COL_GOOD_BG = "#dcfce7";
export const COL_BAD_BG = "#fee2e2";
export const COL_WARN_BG = "#fef3c7";
export const COL_ACCENT = "#f59e0b";

export const COL_BRANCH_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 90px 2fr 90px 70px",
  gap: 12,
  alignItems: "center",
  padding: "12px 18px",
};

/** @deprecated Use COL_BRANCH_GRID */
export const COL_BVA_GRID = COL_BRANCH_GRID;

export const BRANCH_CHIP_CITY: Record<string, string> = {
  mum: "Mumbai",
  del: "Delhi",
  blr: "Bangalore",
  maa: "Chennai",
  ccu: "Kolkata",
  amd: "Ahmedabad",
};
