export const sectionIconColors: Record<string, string> = {
  Dashboard: "#10B563",
  Sales: "#10B563",
  "Customer Service": "#6010B5",
  
  Road: "#10A4B5",
  Air: "#10A4B5",
  "Ocean": "#10A4B5",

  Accounts: "#1034B5",
  Masters: "#1034B5",
  Settings: "#1034B5",

  Reports: "#B5105D",
  Help: "#B5105D",

  Collapse: "#105476",
};

export const sectionIconBackground: Record<string, string> = {
  Dashboard: "#EDFCF5",
  Sales: "#EDFCF5",
  "Customer Service": "#F5EDFC",

  Road: "#EDFBFC",
  Air: "#EDFBFC",
  "Ocean": "#EDFBFC",

  Accounts: "#EDF1FC",
  Masters: "#EDF1FC",
  Settings: "#EDF1FC",

  Reports: "#FCEDF4",
  Help: "#FCEDF4",

  Collapse: "#105476",
};

// 🎨 Base style fragments
const baseRoot = {
  padding: "4px 6px",
  fontWeight: 500,
  margin: 0,
  fontSize:"16px",
  minHeight:"36px"
};


// 🔹 Main navigation link
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
      borderRadius: key!=="Tariff" ? 8 : 0,
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8,
      transition: "background-color 0.3s ease",
      width: "100%",
      backgroundColor: isActive? "#F5FCFF" : "transparent",
      borderLeft: key==="Tariff" ? (isActive ? "1px solid #105476" : "1px solid #E8E8E8") : "",
      color: isActive ? "#105476" : "#444955",
      fontWeight: isActive ? 600 : 500,
      marginBottom: 0,
      "&:hover": {
        backgroundColor:"#F5FCFF"
      },
    },
    section: {
      marginInlineEnd: isSidebarCollapsed && key!=="Tariff" ? 0 : "8px", 
    },
  };
};

// 🔹 Generic sub-link
export const getSubLinkStyles = (isActive: boolean, key: string) => {

  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive? "#F5FCFF" : "transparent",
      color: isActive ? "#105476" : "#444955",
      borderLeft: isActive ? "1px solid #105476" : "1px solid #E8E8E8",
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8, 
      fontWeight: isActive ? 600 : 500,
      "&:hover": {
        backgroundColor:"#F5FCFF"
      },
    },
  };
};

// 🔹 Tariff sub-link (extra indent + special colors)
export const getTariffSubLinkStyles = (isActive: boolean, key: string) => {

  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive? "#F5FCFF" : "transparent",
      color: isActive ? "#105476" : "#444955",
      borderLeft: isActive ? "1px solid #105476" : "1px solid #E8E8E8",
      fontWeight: isActive ? 600 : 500,
      "&:hover": {
        backgroundColor:"#F5FCFF"
      },
    },
  };
};

// 🔹 Customer Service sub-link (same as generic but with padding + fontFamily)
export const getCustomerServiceSubLinkStyles = (
  isActive: boolean,
  key: string
) => {

  return {
    root: {
      ...baseRoot,
      backgroundColor: isActive? "#F5FCFF" : "transparent",
      color: isActive ? "#105476" : "#444955",
      fontWeight: isActive ? 600 : 500,
      "&:hover": {
         backgroundColor:"#F5FCFF"
      },
    },
  };
};
