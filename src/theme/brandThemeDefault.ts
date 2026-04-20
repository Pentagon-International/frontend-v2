import { createTheme, rem } from "@mantine/core";

export const defaultTheme = createTheme({
  breakpoints: {
    xs: "36em",
    sm: "48em",
    md: "62em",
    lg: "75em",
    xl: "88em",
  },

  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  colors: {
    primaryBrand: [
      "#EFF6FF",
      "#DBEAFE",
      "#BFDBFE",
      "#93C5FD",
      "#60A5FA",
      "#3B82F6",
      "#2563EB",
      "#1D4ED8",
      "#1E40AF",
      "#1E3A8A",
    ],
    secondaryBrand: [
      "#F0FDF4",
      "#DCFCE7",
      "#BBF7D0",
      "#86EFAC",
      "#4ADE80",
      "#22C55E",
      "#16A34A",
      "#15803D",
      "#166534",
      "#14532D",
    ],
    blue: [
      "#EFF6FF",
      "#DBEAFE",
      "#BFDBFE",
      "#93C5FD",
      "#60A5FA",
      "#3B82F6",
      "#2563EB",
      "#1D4ED8",
      "#1E40AF",
      "#1E3A8A",
    ],
    gray: [
      "#F8FAFC",
      "#F1F5F9",
      "#E2E8F0",
      "#CBD5E1",
      "#94A3B8",
      "#64748B",
      "#475569",
      "#334155",
      "#1E293B",
      "#0F172A",
    ],
  },

  shadows: {
    xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
    sm: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
    md: "0 4px 6px rgba(15, 23, 42, 0.05), 0 2px 4px rgba(15, 23, 42, 0.06)",
    lg: "0 10px 15px rgba(15, 23, 42, 0.06), 0 4px 6px rgba(15, 23, 42, 0.05)",
    xl: "0 20px 25px rgba(15, 23, 42, 0.08), 0 10px 10px rgba(15, 23, 42, 0.04)",
  },

  headings: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    sizes: {
      h1: { fontSize: rem(32), fontWeight: "700", lineHeight: "1.2" },
      h2: { fontSize: rem(26), fontWeight: "600", lineHeight: "1.3" },
      h3: { fontSize: rem(22), fontWeight: "600", lineHeight: "1.35" },
      h4: { fontSize: rem(18), fontWeight: "600", lineHeight: "1.4" },
      h5: { fontSize: rem(16), fontWeight: "500", lineHeight: "1.5" },
      h6: { fontSize: rem(14), fontWeight: "500", lineHeight: "1.5" },
    },
  },

  spacing: {
    xs: rem(4),
    sm: rem(8),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },

  radius: {
    xs: rem(2),
    sm: rem(4),
    md: rem(6),
    lg: rem(10),
    xl: rem(16),
  },

  fontSizes: {
    xs: rem(11),
    sm: rem(13),
    md: rem(14),
    lg: rem(16),
    xl: rem(18),
  },

  other: {
    primaryGradient: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
    sidebarBg: "#0D1B2E",
    pageBg: "#F0F4F8",
  },
});
