import { NavLink } from "@mantine/core";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getTariffSubLinkStyles } from "./navbarStyles";
import { NavLink as RouterLink, useLocation, useNavigate } from "react-router-dom";

type Props = {
  parent: string;
  subParent: string;
  label: string;
  path: string;
  collapsibles?: {
    setIsCustomerServiceOpen?: (v: boolean) => void;
  };
};

export const NestedSubNavLink = ({ parent, subParent, label, path, collapsibles }: Props) => {
  const {
    activeSubNav,
    activeTariffSubNav,
    activeNav,
    setActiveNav,
    setActiveSubNav,
    setActiveTariffSubNav,
    isSidebarCollapsed,
    setOpenCollapsible,
  } = useLayoutStore();
const navigate = useNavigate();
  const style = getTariffSubLinkStyles(
    activeSubNav === "Tariff" && activeTariffSubNav === label,
    label
  );
  const { pathname } = useLocation();

  const handleClick = () => {
    if (
      activeNav !== parent ||
      activeSubNav !== subParent ||
      activeTariffSubNav !== label ||
      pathname !== path
    ) {
      setActiveNav(parent);
      setActiveSubNav(subParent);
      setActiveTariffSubNav(label);
      navigate(path)
      if (isSidebarCollapsed) {
        setOpenCollapsible(parent, false);
        setOpenCollapsible(subParent, false);
      }
    }
    collapsibles?.setIsCustomerServiceOpen?.(false)
  };

  return (
    <NavLink
      label={label}
      styles={style}
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
    />
  );
};
