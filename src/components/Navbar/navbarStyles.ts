// Section icon colors — vibrant, designed for dark sidebar background
export const sectionIconColors: Record<string, string> = {
  Dashboard: "#34D399",
  "Finance Dashboard": "#38BDF8",
  Sales: "#34D399",
  "Customer Service": "#A78BFA",

  Road: "#38BDF8",
  Air: "#38BDF8",
  Ocean: "#38BDF8",
  Inland: "#38BDF8",

  Accounts: "#60A5FA",
  Masters: "#60A5FA",
  Settings: "#60A5FA",
  Automation: "#60A5FA",
  "Import Job": "#60A5FA",
  "Job Creation": "#60A5FA",
  Jobcreation: "#60A5FA",
  Invoice: "#60A5FA",
  "Vendor Invoice": "#60A5FA",
  "Invoice Manager": "#60A5FA",
  Chatbot: "#60A5FA",

  Reports: "#F472B6",
  Help: "#F472B6",

  Collapse: "#60A5FA",
};

// Inactive icon box background — subtle tinted overlays for dark sidebar
export const sectionIconBackground: Record<string, string> = {
  Dashboard: "rgba(52, 211, 153, 0.12)",
  "Finance Dashboard": "rgba(56, 189, 248, 0.12)",
  Sales: "rgba(52, 211, 153, 0.12)",
  "Customer Service": "rgba(167, 139, 250, 0.12)",

  Road: "rgba(56, 189, 248, 0.12)",
  Air: "rgba(56, 189, 248, 0.12)",
  Ocean: "rgba(56, 189, 248, 0.12)",
  Inland: "rgba(56, 189, 248, 0.12)",

  Accounts: "rgba(96, 165, 250, 0.12)",
  Masters: "rgba(96, 165, 250, 0.12)",
  Settings: "rgba(96, 165, 250, 0.12)",
  Automation: "rgba(96, 165, 250, 0.12)",
  "Import Job": "rgba(96, 165, 250, 0.12)",
  "Job Creation": "rgba(96, 165, 250, 0.12)",
  Jobcreation: "rgba(96, 165, 250, 0.12)",
  Invoice: "rgba(96, 165, 250, 0.12)",
  "Vendor Invoice": "rgba(96, 165, 250, 0.12)",
  "Invoice Manager": "rgba(96, 165, 250, 0.12)",
  Chatbot: "rgba(96, 165, 250, 0.12)",

  Reports: "rgba(244, 114, 182, 0.12)",
  Help: "rgba(244, 114, 182, 0.12)",

  Collapse: "rgba(96, 165, 250, 0.12)",
};

const baseRoot = {
  padding: "3px 6px",
  fontWeight: 400,
  margin: 0,
  fontSize: "13.5px",
  minHeight: "34px",
};

// Main navigation link styles (dark sidebar)
export const getLinkStyles = (
  isActive: boolean,
  key: string,
  collapseOpen?: boolean,
  activeNav?: String,
  isSidebarCollapsed?: Boolean,
) => {
  return {
    root: {
      ...baseRoot,
      borderRadius: key !== "Tariff" ? 6 : 0,
      borderTopRightRadius: 6,
      borderBottomRightRadius: 6,
      transition: "background-color 0.15s ease, color 0.15s ease",
      width: "100%",
      backgroundColor: isActive ? "rgba(59, 130, 246, 0.18)" : "transparent",
      borderLeft: key === "Tariff"
        ? (isActive ? "2px solid #3B82F6" : "2px solid rgba(255,255,255,0.08)")
        : "",
      color: isActive ? "#E8F4FF" : "#7A9AB8",
      fontWeight: isActive ? 600 : 400,
      marginBottom: 0,
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "#C0D4E8",
      },
    },
    section: {
      marginInlineEnd: isSidebarCollapsed && key !== "Tariff" ? 0 : "8px",
    },
  };
};

// Generic sub-link styles (dark sidebar)
export const getSubLinkStyles = (isActive: boolean, key: string) => {
  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive ? "rgba(59, 130, 246, 0.18)" : "transparent",
      color: isActive ? "#E8F4FF" : "#7A9AB8",
      borderLeft: isActive
        ? "2px solid #3B82F6"
        : "2px solid rgba(255,255,255,0.08)",
      borderTopRightRadius: 6,
      borderBottomRightRadius: 6,
      fontWeight: isActive ? 600 : 400,
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "#C0D4E8",
      },
    },
  };
};

// Tariff sub-link (extra indent)
export const getTariffSubLinkStyles = (isActive: boolean, key: string) => {
  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive ? "rgba(59, 130, 246, 0.18)" : "transparent",
      color: isActive ? "#E8F4FF" : "#7A9AB8",
      borderLeft: isActive
        ? "2px solid #3B82F6"
        : "2px solid rgba(255,255,255,0.08)",
      fontWeight: isActive ? 600 : 400,
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "#C0D4E8",
      },
    },
  };
};

// Customer Service sub-link
export const getCustomerServiceSubLinkStyles = (
  isActive: boolean,
  key: string,
) => {
  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive ? "rgba(59, 130, 246, 0.18)" : "transparent",
      color: isActive ? "#E8F4FF" : "#7A9AB8",
      fontWeight: isActive ? 600 : 400,
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "#C0D4E8",
      },
    },
  };
};
