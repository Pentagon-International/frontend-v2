import { Box, Paper } from "@mantine/core";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME, ERP_LIST_INNER_PAD_X } from "./erpListTheme";

export interface ERPListTableCardProps {
  /** e.g. bulk selection toolbar */
  selectionBar?: ReactNode;
  /** Scrollable table region (native `<table>` or DataTable). */
  children: ReactNode;
  /** Pagination / summary row */
  footer?: ReactNode;
  theme?: ErpListTheme;
  /** Outer vertical padding for the card block (default matches Air Export). */
  mainPy?: "xs" | "sm" | "md" | "lg";
  /**
   * When `true`, no horizontal `px` on the outer `main` wrapper (e.g. embedded in dashboard panels).
   * @default false
   */
  flush?: boolean;
}

/**
 * White list surface: Paper with xl radius, optional selection band, horizontal scroll body, footer.
 */
export function ERPListTableCard({
  selectionBar,
  children,
  footer,
  theme = DEFAULT_ERP_LIST_THEME,
  mainPy = "md",
  flush = false,
}: ERPListTableCardProps) {
  return (
    <Box
      component="main"
      py={mainPy}
      px={flush ? 0 : ERP_LIST_INNER_PAD_X}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <Paper
        withBorder
        radius="xl"
        shadow="sm"
        p={0}
        style={{
          overflow: "hidden",
          borderColor: theme.border,
          backgroundColor: theme.cardBg,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {selectionBar}
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            backgroundColor: theme.cardBg,
          }}
        >
          {children}
        </Box>
        {footer}
      </Paper>
    </Box>
  );
}
