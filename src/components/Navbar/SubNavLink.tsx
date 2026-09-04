import { NavLink } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getSubLinkStyles, sectionIconBackground, sectionIconColors } from "./navbarStyles";

type Props = {
  parent: string;
  label: string;
  /** Layout-store active key when different from visible label */
  subNavKey?: string;
  icon?: React.ComponentType<any>;
  path: string;
  collapsibles?: {
    setIsCustomerServiceOpen?: (v: boolean) => void;
    setIsTariffOpen?: (v: boolean) => void;
    setIsSalesOpen?: (v: boolean) => void;
    setIsSeaExportOpen?: (v: boolean) => void;
    setIsAirOpen?: (v: boolean) => void;
    setIsInlandOpen?: (v: boolean) => void;
    setIsChaOpen?: (v: boolean) => void;
    setIsAccountsOpen?: (v: boolean) => void;
    setIsDashboardOpen?: (v: boolean) => void;
    setIsFinanceDashboardOpen?: (v: boolean) => void;
  };
};

export const SubNavLink = ({
  parent,
  label,
  subNavKey,
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
  const activeKey = subNavKey ?? label;
  const style = getSubLinkStyles(activeSubNav === activeKey, label);
  const isActive = activeSubNav === activeKey;
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
          setOpenCollapsible("Dashboard", false);
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Inland", false);
          setOpenCollapsible("CHA", false);
          setOpenCollapsible("Accounts", false);
          setOpenCollapsible("Finance Dashboard", false);
          navigate("/", {
            state: { resetDashboard: true },
            replace: pathname === "/",
          });
        } else if (
          title !== parent ||
          activeNav !== parent ||
          activeSubNav !== activeKey ||
          pathname !== path
        ) {
          setActiveNav(parent);
          setActiveSubNav(activeKey);
          setTitle(parent);
          navigate(path);
          if (label !== "Tariff") {
            // For Transportation, determine which popover to close (Air or Ocean)
            // For other parents like Sales, use parent directly
            if (parent === "Transportation") {
              if (collapsibles?.setIsChaOpen) {
                setOpenCollapsible("CHA", false);
              } else if (collapsibles?.setIsInlandOpen) {
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
          setOpenCollapsible("CHA", false);
          setOpenCollapsible("Customer Service", false);
          setOpenCollapsible("Accounts", false);
          setOpenCollapsible("Dashboard", false);
        } else if (parent === "Transportation") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsCustomerServiceOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          // Only close the opposite collapsible (Air, Ocean, Inland, or CHA), not the one being clicked
          if (collapsibles?.setIsChaOpen) {
            collapsibles?.setIsAirOpen?.(false);
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsInlandOpen?.(false);
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Ocean", false);
            setOpenCollapsible("Inland", false);
          } else if (collapsibles?.setIsInlandOpen) {
            collapsibles?.setIsAirOpen?.(false);
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsChaOpen?.(false);
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Ocean", false);
            setOpenCollapsible("CHA", false);
          } else if (collapsibles?.setIsAirOpen) {
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsInlandOpen?.(false);
            collapsibles?.setIsChaOpen?.(false);
            // Also close Ocean in layout store for collapsed mode
            setOpenCollapsible("Ocean", false);
            setOpenCollapsible("Inland", false);
            setOpenCollapsible("CHA", false);
            // Don't close Air - keep it open like Sales
          } else if (collapsibles?.setIsSeaExportOpen) {
            collapsibles?.setIsAirOpen?.(false);
            collapsibles?.setIsInlandOpen?.(false);
            collapsibles?.setIsChaOpen?.(false);
            // Also close Air in layout store for collapsed mode
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Inland", false);
            setOpenCollapsible("CHA", false);
            // Don't close Ocean - keep it open like Sales
          } else {
            // Fallback: close all if none is specified
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsAirOpen?.(false);
            collapsibles?.setIsInlandOpen?.(false);
            collapsibles?.setIsChaOpen?.(false);
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Ocean", false);
            setOpenCollapsible("Inland", false);
            setOpenCollapsible("CHA", false);
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
          setOpenCollapsible("CHA", false);
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
          setOpenCollapsible("CHA", false);
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
          setOpenCollapsible("CHA", false);
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
          setOpenCollapsible("CHA", false);
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
          setOpenCollapsible("CHA", false);
          setOpenCollapsible("Accounts", false);
        }
      }}
    />
  );
};
