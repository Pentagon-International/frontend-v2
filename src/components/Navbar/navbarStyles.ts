// 🎨 Common icon color mapping
export const sectionIconColors: Record<string, string> = {
  Dashboard: "#005430",
  Sales: "#005430",
  "Customer Service": "#005430",
  Road: "red",
  Air: "red",
  "Ocean": "red",

  Accounts: "#105476",
  Masters: "#105476",
  Settings: "#105476",

  Reports: "#005430",
  Help: "#005430",

  Collapse: "#105476",
};

// 🎨 Base style fragments
const baseRoot = {
  padding: "8px 12px",
  fontWeight: 500,
  color: "#105476",
  margin: 0,
};

const baseIcon = {
  color: "#105476",
};

const baseLabel = {
  color: "#105476",
};

// 🔹 Main navigation link
export const getLinkStyles = (
  isActive: boolean,
  key: string,
  collapseOpen?: boolean,
  activeNav?: String,
  isSidebarCollapsed?: Boolean,
) => {
  const iconColor = sectionIconColors[key] || "#105476";

  return {
    root: {
      ...baseRoot,
      padding : isSidebarCollapsed && key!=="Tariff" ? "12px" : "8px 12px",
      borderRadius: key === "Tariff" ? 0 : 6,
      borderBottomLeftRadius: isSidebarCollapsed && key!=="Tariff" ? 6 : (collapseOpen ? 0 : 6),
      borderBottomRightRadius: isSidebarCollapsed && key!=="Tariff" ? 6 : (collapseOpen ? 0 : 6),
      transition: "background-color 0.2s ease",
      width: !isSidebarCollapsed && key!=="Tariff" ? "fit" : "100%",
      backgroundColor:
        key === "Tariff"
          ? isActive || collapseOpen
            ? "#baddee"
            : "#fff"
          : isActive
            ? "#105476"
            : "transparent",
      color: key === "Tariff" ? "#105476" : isActive ? "white" : "#105476",
      fontWeight: isActive ? 600 : 500,
      marginBottom: 0,
      "&:hover": {
        backgroundColor:
          key === "Tariff"
            ? isActive
              ? "#baddee"
              : "#e3f2fd"
            : isActive
              ? "#105476"
              : "#e3f2fd",
      },
    },
    icon: {
      ...baseIcon,
      color: key === "Tariff" ? iconColor : isActive ? "white" : iconColor,
    },
    section: {
      marginInlineEnd: isSidebarCollapsed && key!=="Tariff" ? 0 : "8px", 
    },
  };
};

// 🔹 Generic sub-link
export const getSubLinkStyles = (isActive: boolean, key: string) => {
  const iconColor = sectionIconColors[key] || "#105476";

  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive ? "#BADDEE" : "#fff",
      fontWeight: isActive ? 600 : 500,
      "&:hover": {
        backgroundColor: isActive ? "#BADDEE" : "#F0F8FF",
      },
    },
    icon: {
      ...baseIcon,
      color: isActive ? "white" : iconColor,
    },
    label: { ...baseLabel },
  };
};

// 🔹 Tariff sub-link (extra indent + special colors)
export const getTariffSubLinkStyles = (isActive: boolean, key: string) => {
  const iconColor = sectionIconColors[key] || "#105476";

  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive ? "#6FB8D2" : "#fff",
      paddingLeft: "24px",
      fontWeight: isActive ? 600 : 500,
      "&:hover": {
        backgroundColor: isActive ? "#6FB8D2" : "#F0F8FF",
      },
    },
    icon: {
      ...baseIcon,
      color: isActive ? "white" : iconColor,
    },
    label: { ...baseLabel },
  };
};

// 🔹 Customer Service sub-link (same as generic but with padding + fontFamily)
export const getCustomerServiceSubLinkStyles = (
  isActive: boolean,
  key: string
) => {
  const iconColor = sectionIconColors[key] || "#105476";

  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive ? "#BADDEE" : "#fff",
      paddingLeft: "24px",
      fontWeight: isActive ? 600 : 500,
      "&:hover": {
        backgroundColor: isActive ? "#BADDEE" : "#F0F8FF",
      },
    },
    icon: {
      ...baseIcon,
      color: isActive ? "white" : iconColor,
    },
    label: { ...baseLabel },
  };
};
