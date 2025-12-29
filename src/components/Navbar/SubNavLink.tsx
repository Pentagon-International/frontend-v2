import { NavLink } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getSubLinkStyles } from "./navbarStyles";

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

  return (
    <NavLink
      label={label}
      leftSection={Icon ? <Icon size={16} /> : null}
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
            setOpenCollapsible(parent, false);
          } else {
            setOpenCollapsible(parent, true);
          }
        }
        if (parent === "Sales") {
          collapsibles?.setIsCustomerServiceOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
        } else if (parent === "Transportation") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsCustomerServiceOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
          // Only close the opposite collapsible (Air or Ocean), not the one being clicked
          // If setIsAirOpen is provided, it's an Air sub-option, so close Ocean
          // If setIsSeaExportOpen is provided, it's an Ocean sub-option, so close Air
          if (collapsibles?.setIsAirOpen) {
            collapsibles?.setIsSeaExportOpen?.(false);
            // Don't close Air - keep it open like Sales
          } else if (collapsibles?.setIsSeaExportOpen) {
            collapsibles?.setIsAirOpen?.(false);
            // Don't close Ocean - keep it open like Sales
          } else {
            // Fallback: close both if neither is specified
            collapsibles?.setIsSeaExportOpen?.(false);
            collapsibles?.setIsAirOpen?.(false);
          }
        } else if (parent === "Customer Service") {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
        } else {
          collapsibles?.setIsSalesOpen?.(false);
          collapsibles?.setIsTariffOpen?.(false);
        }
      }}
    />
  );
};
