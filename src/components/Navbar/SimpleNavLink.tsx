import { NavLink, Tooltip } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getLinkStyles, sectionIconColors, sectionIconBackground } from "./navbarStyles.ts";
import { isWorkflowChatbotPath } from "../../pages/Workflow/jobcreation/workflowUrls";

type Props = {
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  collapsibles?: {
    setIsSalesOpen?: (v: boolean) => void;
    setIsCustomerServiceOpen?: (v: boolean) => void;
    setIsTariffOpen?: (v: boolean) => void;
    setIsAirOpen?: (v: boolean) => void;
    setIsSeaExportOpen?: (v: boolean) => void;
    setIsAccountsOpen?: (v: boolean) => void;
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
    setOpenCollapsible,
  } = useLayoutStore();

  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive =
    label === "Dashboard"
      ? pathname === "/"
      : label === "Chatbot"
        ? pathname === "/chatbot" ||
          pathname.startsWith("/chatbot-") ||
          activeNav === label
        : pathname === path || pathname.startsWith(`${path}/`) || activeNav === label;

  const style = getLinkStyles(
    isActive,
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
      const isOnTarget =
        label === "Chatbot" ? isWorkflowChatbotPath(pathname) : pathname === path;

      if (title !== label || activeNav !== label || !isOnTarget) {
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
    collapsibles?.setIsAirOpen?.(false);
    collapsibles?.setIsSeaExportOpen?.(false);
    collapsibles?.setIsAccountsOpen?.(false);
    // Also close in layout store for collapsed mode
    setOpenCollapsible("Sales", false);
    setOpenCollapsible("Air", false);
    setOpenCollapsible("Ocean", false);
    setOpenCollapsible("Customer Service", false);
    setOpenCollapsible("Tariff", false);
    setOpenCollapsible("Accounts", false);
  };
  const iconColor = sectionIconColors[label] || "white";
  const iconBackground = sectionIconBackground[label] || "#105476";

  const navContent = (
    <NavLink
      label={isSidebarCollapsed ? undefined : label}
      leftSection={
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            backgroundColor: isActive ? iconColor : iconBackground,
            color: isActive ? "#fff" : iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} />
        </div>
      }
      styles={style}
      onClick={handleClick}
    />
  );

  return isSidebarCollapsed ? (
    <Tooltip
      label={label}
      color="#0F2035"
      position="right"
      arrowOffset={50}
      style={{ padding: "5px 14px", fontWeight: 400, fontSize: "13px" }}
      arrowSize={8}
      withArrow
    >
      {navContent}
    </Tooltip>
  ) : (
    navContent
  );
};
