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
            color: isActive ? "#105476" : "#444955",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} />
        </div> : null}
      styles={style}
      onClick={() => {
        if (
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
              if (collapsibles?.setIsAirOpen) {
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
          // Also close in layout store for collapsed mode
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Customer Service", false);
        } else if (parent === "Transportation") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsCustomerServiceOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          // Only close the opposite collapsible (Air or Ocean), not the one being clicked
          // If setIsAirOpen is provided, it's an Air sub-option, so close Ocean
          // If setIsSeaExportOpen is provided, it's an Ocean sub-option, so close Air
          if (collapsibles?.setIsAirOpen) {
            collapsibles?.setIsSeaExportOpen?.(false);
            // Also close Ocean in layout store for collapsed mode
            setOpenCollapsible("Ocean", false);
            // Don't close Air - keep it open like Sales
          } else if (collapsibles?.setIsSeaExportOpen) {
            collapsibles?.setIsAirOpen?.(false);
            // Also close Air in layout store for collapsed mode
            setOpenCollapsible("Air", false);
            // Don't close Ocean - keep it open like Sales
          } else {
            // Fallback: close both if neither is specified
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsAirOpen?.(false);
            setOpenCollapsible("Air", false);
            setOpenCollapsible("Ocean", false);
          }
          // Close Sales in collapsed mode when Transportation sub-link is clicked
          setOpenCollapsible("Sales", false);
        } else if (parent === "Customer Service") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          // Also close in layout store for collapsed mode
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
        } else {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          collapsibles?.setIsAirOpen?.(false);
          collapsibles?.setIsSeaExportOpen?.(false);
          // Also close in layout store for collapsed mode
          setOpenCollapsible("Sales", false);
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
        }
      }}
    />
  );
};
