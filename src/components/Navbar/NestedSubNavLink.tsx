import { NavLink } from "@mantine/core";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getTariffSubLinkStyles } from "./navbarStyles";
import { useLocation, useNavigate } from "react-router-dom";

type Props = {
  parent: string;
  subParent: string;
  label: string;
  path: string;
  collapsibles?: {
    setIsCustomerServiceOpen?: (v: boolean) => void;
    setIsTariffOpen?: (v: boolean) => void;
    setIsSalesOpen?: (v: boolean) => void;
    setIsAirOpen?: (v: boolean) => void;
    setIsSeaExportOpen?: (v: boolean) => void;
  };
  icon?: React.ComponentType<{ size?: number; [key: string]: unknown }>;
};

export const NestedSubNavLink = ({
  parent,
  subParent,
  label,
  path,
  collapsibles,
  icon: Icon,
}: Props) => {
  const {
    activeSubNav,
    activeTariffSubNav,
    activeNav,
    setActiveNav,
    setActiveSubNav,
    setActiveTariffSubNav,
    setTitle,
    isSidebarCollapsed,
    setOpenCollapsible,
  } = useLayoutStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Check active state based on both store values and pathname for reliability
  const isActive =
    (activeSubNav === "Tariff" && activeTariffSubNav === label) ||
    pathname === path;

  const style = getTariffSubLinkStyles(isActive, label);

  const handleClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const shouldNavigate =
      activeNav !== parent ||
      activeSubNav !== subParent ||
      activeTariffSubNav !== label ||
      pathname !== path;

    if (shouldNavigate) {
      setActiveNav(parent);
      setActiveSubNav(subParent);
      setActiveTariffSubNav(label);
      setTitle(parent);
      navigate(path);

      // Close flyout after navigation if sidebar is collapsed
      if (isSidebarCollapsed) {
        setOpenCollapsible(parent, false);
        setOpenCollapsible(subParent, false);
      }
    }

    // Close other collapsibles
    if (parent === "Sales") {
      collapsibles?.setIsCustomerServiceOpen?.(false);
      collapsibles?.setIsAirOpen?.(false);
      collapsibles?.setIsSeaExportOpen?.(false);
      setOpenCollapsible("Air", false);
      setOpenCollapsible("Ocean", false);
      setOpenCollapsible("Customer Service", false);
    }
  };

  return (
    <NavLink
      data-nested-nav-link="true"
      label={label}
      styles={{
        ...style,
        root: {
          ...style.root,
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
        },
      }}
      leftSection={
        Icon ? (
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: "transparent",
              color: isActive ? "#105476" : "#444955",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Icon size={16} />
          </div>
        ) : null
      }
      onClick={handleClick}
      onMouseDown={(e) => {
        // Prevent text selection on some devices
        e.preventDefault();
      }}
    />
  );
};
