import { createTheme, rem } from "@mantine/core";

export const defaultTheme = createTheme({
  // autoContrast: true,
  
  // Responsive breakpoints
  breakpoints: {
    xs: '36em',   // 576px - Mobile
    sm: '48em',   // 768px - Large Mobile/Small Tablet
    md: '62em',   // 992px - Tablet
    lg: '75em',   // 1200px - Desktop
    xl: '88em',   // 1408px - Large Desktop
  },
  
  // Define your brand colors based on red shades
  colors: {
    primaryBrand: [
      "#ffe5e5", // Lightest shade
      "#ffcccc",
      "#105476",
      "#ff6666",
      "#ff3333", // Primary brand color
      "#ff1a1a",
      "#e60000",
      "#cc0000",
      "#b30000",
      "#800000", // Darkest shade
    ],
    secondaryBrand: [
      "#fff3e0", // Complementary color
      "#ffe0b2",
      "#ffcc80",
      "#ffb74d",
      "#ffa726",
      "#ff9800",
      "#fb8c00",
      "#f57c00",
      "#ef6c00",
      "#e65100",
    ],
    // Replace the default blue if needed
    blue: [
      "#e3f2fd",
      "#bbdefb",
      "#90caf9",
      "#64b5f6",
      "#42a5f5",
      "#2196f3",
      "#1e88e5",
      "#1976d2",
      "#1565c0",
      "#0d47a1",
    ],
    gray: [
      '#f8f9fa', // 0
      '#f1f3f5',
      '#e9ecef',
      '#dee2e6',
      '#ced4da',
      '#adb5bd',
      '#868e96',
      '#495057',
      '#343a40',
      '#212529', // 9
    ],
  },

  // Customize the shadows for different elements
  shadows: {
    sm: "0px 1px 2px rgba(0, 0, 0, 0.05)",
    md: "0px 2px 4px rgba(0, 0, 0, 0.1)",
    xl: "0px 4px 8px rgba(0, 0, 0, 0.15)",
  },

  // Define font family and styles for headings and body text
  headings: {
    // fontFamily: "Rozha One, serif", // Using Rozha One for headings
    sizes: {
      h1: { fontSize: rem(48), fontWeight: "700" },
      h2: { fontSize: rem(40), fontWeight: "600" },
      h3: { fontSize: rem(32), fontWeight: "500" },
      h4: { fontSize: rem(28), fontWeight: "500" },
      h5: { fontSize: rem(24), fontWeight: "400" },
      h6: { fontSize: rem(20), fontWeight: "400" },
    },
  },

  // fontFamily: "Questrial, sans-serif", // Using Questrial for body text

  // Control the spacing and padding (e.g., for margins or layout spacing)
  spacing: {
    xs: rem(4),
    sm: rem(8),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },

  // Customize radius for buttons or cards
  radius: {
    sm: rem(4),
    md: rem(8),
    lg: rem(16),
    xl: rem(24),
  },

  // Control typography
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },

  // Other miscellaneous configurations for consistency
  other: {
    primaryGradient: "linear-gradient(45deg, #ff3333 0%, #e60000 100%)",
  },
});
