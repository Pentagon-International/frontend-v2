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
import {
  getLinkStyles,
  sectionIconBackground,
  sectionIconColors,
} from "./navbarStyles";

type Props = {
  label: string;
  icon: React.ComponentType<{ size?: number; [key: string]: unknown }>;
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
  const prevActiveNavRef = useRef<string>(activeNav);

  // compute "opened" based on mode:

  const style = getLinkStyles(
    isActive,
    label,
    opened,
    activeNav,
    isSidebarCollapsed
  );

  // keep local state in sync for expanded mode - only auto-close when navigating away
  useEffect(() => {
    if (!isSidebarCollapsed) {
      // Only auto-close when activeNav CHANGES (not just when it doesn't match)
      // This allows manual toggles to work without interference
      const activeNavChanged = prevActiveNavRef.current !== activeNav;

      if (activeNavChanged) {
        const shouldBeOpen =
          activeNav === label ||
          (label === "Air" || label === "Ocean"
            ? activeNav === "Transportation"
            : false) ||
          hasActiveChild;
        // Only close if we're navigating away (activeNav changed and doesn't match)
        if (!shouldBeOpen && activeNav !== "" && openedLocal) {
          setOpenedLocal(false);
        }
      }
      // Always update ref to track current activeNav for next comparison
      prevActiveNavRef.current = activeNav;
    }
  }, [
    activeNav,
    isSidebarCollapsed,
    label,
    hasActiveChild,
    openedLocal,
    setOpenedLocal,
  ]);

  // sync store when collapsed - only auto-close when navigating away
  useEffect(() => {
    if (isSidebarCollapsed) {
      // Only auto-close when activeNav CHANGES (not just when it doesn't match)
      const activeNavChanged = prevActiveNavRef.current !== activeNav;

      if (activeNavChanged) {
        const shouldBeOpen =
          activeNav === label ||
          (label === "Air" || label === "Ocean"
            ? activeNav === "Transportation"
            : false) ||
          hasActiveChild;
        // Only close if we're navigating away (activeNav changed and doesn't match)
        if (!shouldBeOpen && activeNav !== "" && openCollapsibles[label]) {
          setOpenCollapsible(label, false);
        }
      }
      // Always update ref to track current activeNav for next comparison
      prevActiveNavRef.current = activeNav;
      // Sync manual toggles from opened state (this allows manual toggles to work)
      if (!!openCollapsibles[label] !== opened) {
        setOpenCollapsible(label, opened);
      }
    }
  }, [
    opened,
    isSidebarCollapsed,
    label,
    openCollapsibles,
    setOpenCollapsible,
    activeNav,
    hasActiveChild,
  ]);

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

      // Don't close if clicking inside the nav link
      if (navRef.current?.contains(target)) return;

      // Don't close if clicking inside the flyout
      if (flyoutRef.current?.contains(target)) {
        // Check if clicking on a nested nav link - keep flyout open for navigation
        const nestedLink = (target as HTMLElement).closest(
          "[data-nested-nav-link]"
        );
        if (nestedLink) {
          return;
        }
        // Click inside flyout but not on a link - also keep open
        return;
      }

      // Only close if clicking outside both nav and flyout
      setOpenCollapsible(label, false);
    }

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [opened, isSidebarCollapsed, label, setOpenCollapsible]);

  const handleClick = () => {
    // Don't clear activeTariffSubNav when toggling - let the child links handle navigation
    const shouldClearTariffSubNav = false;

    if (isSidebarCollapsed) {
      const isOpening = !openCollapsibles[label];
      setOpenCollapsible(label, isOpening);
      // Close other collapsibles when opening this one (mutual exclusion)
      if (isOpening) {
        if (label === "Air") {
          setOpenCollapsible("Ocean", false);
          setOpenCollapsible("Sales", false);
        } else if (label === "Ocean") {
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Sales", false);
        } else if (label === "Sales") {
          setOpenCollapsible("Air", false);
          setOpenCollapsible("Ocean", false);
        }
      }
      if (
        shouldClearTariffSubNav &&
        label === "Tariff" &&
        (activeSubNav !== "" || activeTariffSubNav !== "")
      ) {
        setActiveTariffSubNav("");
      }
    } else {
      setOpenedLocal((o) => !o);
      if (
        shouldClearTariffSubNav &&
        label === "Tariff" &&
        (activeSubNav !== "" || activeTariffSubNav !== "")
      ) {
        setActiveTariffSubNav("");
      }
    }
  };

  const iconColor = sectionIconColors[label] || "white";
  const iconBackground = sectionIconBackground[label] || "#105476";

  const navLinkWrapped = (
    <Box ref={navRef}>
      <NavLink
        label={isSidebarCollapsed && label !== "Tariff" ? undefined : label}
        leftSection={
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor:
                label !== "Tariff"
                  ? isActive
                    ? "#105476"
                    : iconBackground
                  : "transparent",
              color:
                label !== "Tariff"
                  ? isActive
                    ? "#fff"
                    : iconColor
                  : isActive
                    ? "#105476"
                    : "#444955",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={16} />
          </div>
        }
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
              // border: label === "Tariff" ? "1px solid #BADDEE" : "",
              // borderTop: "none",
              // borderBottomLeftRadius: 6,
              // borderBottomRightRadius: 6,
              paddingLeft: "16px",
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
            onClick={(e) => {
              // Stop propagation to prevent document click handler from closing flyout
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              // Stop propagation on mousedown as well
              e.stopPropagation();
            }}
            style={{
              position: "fixed",
              top: flyoutPos.top,
              left: flyoutPos.left,
              zIndex: 100,
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
