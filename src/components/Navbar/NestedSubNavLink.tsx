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
  icon?: React.ComponentType<any>;
};

export const NestedSubNavLink = ({ parent, subParent, label, path, collapsibles, icon: Icon }: Props) => {
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
const isActive = activeSubNav === "Tariff" && activeTariffSubNav === label
  const style = getTariffSubLinkStyles(
    isActive,
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
      leftSection={
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
          }}
        >
          <Icon size={16} />
        </div>
      }
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
    />
  );
};
