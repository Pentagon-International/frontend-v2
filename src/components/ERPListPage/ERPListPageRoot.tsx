import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";

export interface ERPListPageRootProps {
  children: ReactNode;
  theme?: ErpListTheme;
  className?: string;
}

/**
 * Full-height list page column on `pageBg` (place toolbar, filters, and `ERPListTableCard` inside).
 */
export function ERPListPageRoot({
  children,
  theme = DEFAULT_ERP_LIST_THEME,
  className,
}: ERPListPageRootProps) {
  return (
    <Box
      className={className}
      style={{
        height: "calc(100vh - 60px)",
        backgroundColor: theme.pageBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </Box>
  );
}
