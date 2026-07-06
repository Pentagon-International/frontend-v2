import { NavLink } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getSubLinkStyles, sectionIconBackground, sectionIconColors } from "./navbarStyles";

type Props = {
  parent: string;
  label: string;
  icon?: React.ComponentType<any>;
  path: string;
  collapsibles?: {
    setIsCustomerServiceOpen?: (v: boolean) => void;
    setIsTariffOpen?: (v: boolean) => void;
    setIsSalesOpen?: (v: boolean) => void;
    setIsSeaExportOpen?: (v: boolean) => void;
    setIsAirOpen?: (v: boolean) => void;
    setIsInlandOpen?: (v: boolean) => void;
    setIsAccountsOpen?: (v: boolean) => void;
    setIsDashboardOpen?: (v: boolean) => void;
    setIsFinanceDashboardOpen?: (v: boolean) => void;
  };
};

export const SubNavLink = ({
  parent,
  label,
  icon: Icon,
  path,
  collapsibles,
}: Props) => {
  const {
    setTitle,
    setActiveNav,
    setActiveSubNav,
    activeSubNav,
    activeNav,
    title,
    setOpenCollapsible,
  } = useLayoutStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const style = getSubLinkStyles(activeSubNav === label, label);
  const isActive = activeSubNav === label;
  const iconColor = sectionIconColors[parent] || "white";
  const iconBackground = sectionIconBackground[parent] || "#105476";

  return (
    <NavLink
      label={label}
      leftSection={Icon ? <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            backgroundColor: "transparent",
            color: isActive ? "#60A5FA" : "#4A6880",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} />
        </div> : null}
      styles={style}
      onClick={() => {
        const isDashboardOverview =
          parent === "Dashboard" && label === "Overview" && path === "/";

        if (isDashboardOverview) {
          setActiveNav(parent);
          setActiveSubNav(label);
          setTitle(parent);
          navigate("/", {
            state: { resetDashboard: true },
            replace: pathname === "/",
          });
        } else if (
          title !== parent ||
          activeNav !== parent ||
          activeSubNav !== label ||
          pathname !== path
        ) {
          setActiveNav(parent);
          setActiveSubNav(label);
          setTitle(parent);
          navigate(path);
          if (label !== "Tariff") {
            // For Transportation, determine which popover to close (Air or Ocean)
            // For other parents like Sales, use parent directly
            if (parent === "Transportation") {
              if (collapsibles?.setIsInlandOpen) {
                setOpenCollapsible("Inland", false);
              } else if (collapsibles?.setIsAirOpen) {
                // Air sub-link - close Air popover
                setOpenCollapsible("Air", false);
              } else if (collapsibles?.setIsSeaExportOpen) {
                // Ocean sub-link - close Ocean popover
                setOpenCollapsible("Ocean", false);
              }
            } else {
              // For Sales and other parents, close using parent name
              setOpenCollapsible(parent, false);
            }
          } else {
            setOpenCollapsible(parent, true);
          }
        }
        if (parent === "Sales") {
          collapsibles?.setIsCustomerServiceOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          collapsibles?.setIsInlandOpen?.(false);
          collapsibles?.setIsAccountsOpen?.(false);
          // Also close in layout store for collapsed mode
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Inland", false);
          setOpenCollapsible("Customer Service", false);
          setOpenCollapsible("Accounts", false);
          setOpenCollapsible("Dashboard", false);
        } else if (parent === "Transportation") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsCustomerServiceOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          // Only close the opposite collapsible (Air, Ocean, or Inland), not the one being clicked
          if (collapsibles?.setIsInlandOpen) {
            collapsibles?.setIsAirOpen?.(false);
            collapsibles?.setIsSeaExportOpen?.(false);
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Ocean", false);
          } else if (collapsibles?.setIsAirOpen) {
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsInlandOpen?.(false);
            // Also close Ocean in layout store for collapsed mode
            setOpenCollapsible("Ocean", false);
            setOpenCollapsible("Inland", false);
            // Don't close Air - keep it open like Sales
          } else if (collapsibles?.setIsSeaExportOpen) {
            collapsibles?.setIsAirOpen?.(false);
            collapsibles?.setIsInlandOpen?.(false);
            // Also close Air in layout store for collapsed mode
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Inland", false);
            // Don't close Ocean - keep it open like Sales
          } else {
            // Fallback: close all if none is specified
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsAirOpen?.(false);
            collapsibles?.setIsInlandOpen?.(false);
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Ocean", false);
            setOpenCollapsible("Inland", false);
          }
          // Close Sales in collapsed mode when Transportation sub-link is clicked
          setOpenCollapsible("Sales", false);
          collapsibles?.setIsAccountsOpen?.(false);
          setOpenCollapsible("Accounts", false);
        } else if (parent === "Customer Service") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          collapsibles?.setIsInlandOpen?.(false);
          collapsibles?.setIsAccountsOpen?.(false);
          // Also close in layout store for collapsed mode
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Inland", false);
          setOpenCollapsible("Accounts", false);
        } else if (parent === "Accounts") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          collapsibles?.setIsInlandOpen?.(false);
          // Also close in layout store for collapsed mode
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Inland", false);
        } else if (parent === "Dashboard") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          collapsibles?.setIsInlandOpen?.(false);
          collapsibles?.setIsAccountsOpen?.(false);
          collapsibles?.setIsFinanceDashboardOpen?.(false);
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Inland", false);
          setOpenCollapsible("Accounts", false);
          setOpenCollapsible("Finance Dashboard", false);
        } else if (parent === "Finance Dashboard") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          collapsibles?.setIsInlandOpen?.(false);
          collapsibles?.setIsAccountsOpen?.(false);
          collapsibles?.setIsDashboardOpen?.(false);
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Inland", false);
          setOpenCollapsible("Accounts", false);
          setOpenCollapsible("Dashboard", false);
        } else {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          collapsibles?.setIsInlandOpen?.(false);
          collapsibles?.setIsAccountsOpen?.(false);
          // Also close in layout store for collapsed mode
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Inland", false);
          setOpenCollapsible("Accounts", false);
        }
      }}
    />
  );
};
