import { NavLink, Tooltip } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getLinkStyles } from "./navbarStyles.ts";

type Props = {
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  collapsibles?: {
    setIsSalesOpen?: (v: boolean) => void;
    setIsCustomerServiceOpen?: (v: boolean) => void;
    setIsTariffOpen?: (v: boolean) => void;
  };
};

export const SimpleNavLink = ({
  label,
  icon: Icon,
  path,
  collapsibles,
}: Props) => {
  const {
    title,
    activeNav,
    setActiveNav,
    setTitle,
    setActiveSubNav,
    setActiveTariffSubNav,
    isSidebarCollapsed,
  } = useLayoutStore();

  const navigate = useNavigate();
  const { pathname } = useLocation();

  const style = getLinkStyles(
    activeNav === label,
    label,
    undefined,
    undefined,
    isSidebarCollapsed
  );

  const handleClick = () => {
    // Special handling for Dashboard navigation
    if (label === "Dashboard" && path === "/") {
      if (pathname === "/") {
        // Already on dashboard - navigate with reset flag to reset drill levels
        navigate("/", { state: { resetDashboard: true }, replace: true });
      } else {
        // Navigate to dashboard with reset flag
        setTitle(label);
        setActiveNav(label);
        setActiveSubNav("");
        setActiveTariffSubNav("");
        navigate(path, { state: { resetDashboard: true } });
      }
    } else {
      // Normal navigation for other links
      if (title !== label || activeNav !== label || pathname !== path) {
        setTitle(label);
        setActiveNav(label);
        setActiveSubNav("");
        setActiveTariffSubNav("");
        navigate(path);
      }
    }
    collapsibles?.setIsSalesOpen?.(false);
    collapsibles?.setIsCustomerServiceOpen?.(false);
    collapsibles?.setIsTariffOpen?.(false);
  };

  const navContent = (
    <NavLink
      label={isSidebarCollapsed ? undefined : label}
      leftSection={<Icon size={20} color={style.icon.color} />}
      styles={style}
      onClick={handleClick}
    />
  );

  return isSidebarCollapsed ? (
    <Tooltip
      label={label}
      color="#363636"
      position="right"
      arrowOffset={50}
      style={{ padding: "5px 15px", fontWeight: 400 }}
      arrowSize={8}
      withArrow
    >
      {navContent}
    </Tooltip>
  ) : (
    navContent
  );
};
