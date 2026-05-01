/** Shared palette aligned with Pentagon Sales Overview “Enquiry Conversion” dashboard */
export const enquiryConversionColors = {
  // Page & Panel
  pageBg: "#F4F6FA",
  panelBg: "#FFFFFF",
  panelBorder: "#E2E8F0",
  heading: "#0F172A",
  subHeading: "#64748B",
  muted: "#94A3B8",

  // Stage Funnel & General Status
  status: {
    new: { dot: "#3b82f6", bg: "#eff6ff" },
    quoted: { dot: "#f59e0b", bg: "#fffbeb" },
    negotiation: { dot: "#8b5cf6", bg: "#f5f3ff" },
    won: { dot: "#22c55e", bg: "#f0fdf4" },
    lost: { dot: "#ef4444", bg: "#fef2f2" },
  },

  // Bar Colors (Stage Funnel)
  bars: {
    navy1: "#1E3A5F",
    navy2: "#475569",
    navy3: "#7084b8",
    won: "#22C55E",
    lost: "#EF4444",
  },

  /** Overview tile segmented bar — four stages (no Negot.): light New → blue Quoted → green Won → red Lost */
  overviewFunnel: {
    new: "#CBD5E1",
    quoted: "#3B82F6",
    won: "#10B981",
    lost: "#EF4444",
  },

  // Mode Colors
  modes: {
    fcl: "#0ea5e9",
    lcl: "#0369a1",
    air: "#f59e0b",
    road: "#64748b",
    rail: "#8b5cf6",
    customs: "#ec4899",
    warehousing: "#6366f1",
  },

  // Other UI
  shadow: "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 14px rgba(15, 23, 42, 0.06)",
  radius: 12,
} as const;
