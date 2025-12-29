// CollapsibleNav.tsx
import { NavLink, Collapse, Box, Portal, Tooltip } from "@mantine/core";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
} from "@tabler/icons-react";
import { useLayoutStore } from "../../store/useLayoutStore";
import { getLinkStyles } from "./navbarStyles";

type Props = {
  label: string;
  icon: React.ComponentType<any>;
  parent?: string;
  children?: ReactNode;
  openedLocal: boolean;
  setOpenedLocal: (value: boolean | ((prev: boolean) => boolean)) => void;
};

export const CollapsibleNav = ({
  label,
  icon: Icon,
  children,
  parent,
  openedLocal,
  setOpenedLocal,
}: Props) => {
  const {
    activeNav,
    activeSubNav,
    activeTariffSubNav,
    setActiveTariffSubNav,
    isSidebarCollapsed,
    openCollapsibles,
    setOpenCollapsible,
  } = useLayoutStore();

  const hasActiveChild =
    (label === "Sales" && activeSubNav === "Tariff") ||
    (parent && activeSubNav === label) ||
    (label === "Air" && activeSubNav.startsWith("Air")) ||
    (label === "Ocean" && activeSubNav.startsWith("Ocean")) ||
    (label === "Ocean" && activeSubNav.startsWith("FCL")) ||
    (label === "Ocean" && activeSubNav.startsWith("LCL"));

  // compute opened based on mode
  const opened = isSidebarCollapsed ? !!openCollapsibles[label] : openedLocal;

  // now compute isActive (depends on opened)
  const isActive =
    activeNav === label ||
    (activeNav === "Transportation" &&
      (label === "Air" || label === "Ocean")) ||
    hasActiveChild ||
    opened;

  // refs for positioning flyout in collapsed mode
  const navRef = useRef<HTMLDivElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });

  // compute "opened" based on mode:

  const style = getLinkStyles(
    isActive,
    label,
    opened,
    activeNav,
    isSidebarCollapsed
  );

  // keep local state in sync for expanded mode
  useEffect(() => {
    if (!isSidebarCollapsed) {
      setOpenedLocal(isActive);
    }
  }, [isActive, isSidebarCollapsed]);

  // sync store when collapsed
  useEffect(() => {
    if (isSidebarCollapsed) {
      if (!!openCollapsibles[label] !== opened) {
        setOpenCollapsible(label, opened);
      }
    }
  }, [opened, isSidebarCollapsed, label, openCollapsibles, setOpenCollapsible]);

  // compute flyout position
  useEffect(() => {
    if (opened && isSidebarCollapsed && navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      setFlyoutPos({ top: rect.top, left: rect.right + 8 });
    }
  }, [opened, isSidebarCollapsed]);

  // close flyout when clicking outside
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (!opened || !isSidebarCollapsed) return;
      const target = e.target as Node;
      if (navRef.current?.contains(target)) return;
      if (flyoutRef.current?.contains(target)) return;
      // delay close to allow nested link navigation
      setTimeout(() => setOpenCollapsible(label, false), 150);
    }

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [opened, isSidebarCollapsed, label, setOpenCollapsible]);

  const handleClick = () => {
    if (isSidebarCollapsed) {
      setOpenCollapsible(label, !openCollapsibles[label]);
      if (
        label === "Tariff" &&
        (activeSubNav !== "" || activeTariffSubNav !== "")
      ) {
        setActiveTariffSubNav("");
      }
    } else {
      setOpenedLocal((o) => !o);
      if (
        label === "Tariff" &&
        (activeSubNav !== "" || activeTariffSubNav !== "")
      ) {
        setActiveTariffSubNav("");
      }
    }
  };

  const navLinkWrapped = (
    <Box ref={navRef}>
      <NavLink
        label={isSidebarCollapsed && label !== "Tariff" ? undefined : label}
        leftSection={<Icon size={18} color={style.icon.color} />}
        rightSection={
          isSidebarCollapsed ? (
            label !== "Tariff" ? undefined : opened ? (
              <IconChevronLeft size={16} />
            ) : (
              <IconChevronRight size={16} />
            )
          ) : opened ? (
            <IconChevronUp size={16} />
          ) : (
            <IconChevronDown size={16} />
          )
        }
        styles={style}
        onClick={handleClick}
      />
    </Box>
  );

  return (
    <>
      {isSidebarCollapsed && !opened && label !== "Tariff" ? (
        <Tooltip
          label={label}
          color="#363636"
          position="right"
          arrowOffset={50}
          style={{ padding: "5px 15px", fontWeight: 400 }}
          arrowSize={8}
          withArrow
        >
          <span style={{ display: "block" }}>{navLinkWrapped}</span>
        </Tooltip>
      ) : (
        navLinkWrapped
      )}

      {!isSidebarCollapsed && (
        <Collapse in={opened}>
          <Box
            style={{
              border: label === "Tariff" ? "" : "1px solid #BADDEE",
              borderTop: "none",
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
              overflow: "hidden",
            }}
          >
            {children}
          </Box>
        </Collapse>
      )}

      {isSidebarCollapsed && opened && (
        <Portal>
          <Box
            ref={flyoutRef}
            style={{
              position: "fixed",
              top: flyoutPos.top,
              left: flyoutPos.left,
              zIndex: 9999,
              background: "#fff",
              border: "1px solid #BADDEE",
              borderRadius: 6,
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              minWidth: 220,
              overflow: "hidden",
            }}
          >
            {children}
          </Box>
        </Portal>
      )}
    </>
  );
};
