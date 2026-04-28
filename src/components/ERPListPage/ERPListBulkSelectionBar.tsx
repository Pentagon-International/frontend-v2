import { Box, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";

export interface ERPListBulkSelectionBarProps {
  theme?: ErpListTheme;
  count: number;
  /** Singular noun, e.g. `"booking"` → "3 bookings selected". */
  entityLabel?: string;
  /** Right-side actions (export, clear selection, etc.). */
  children: ReactNode;
}

/**
 * Tinted band above the table when rows are selected (Air Export selection bar).
 */
export function ERPListBulkSelectionBar({
  theme = DEFAULT_ERP_LIST_THEME,
  count,
  entityLabel = "row",
  children,
}: ERPListBulkSelectionBarProps) {
  const plural = count !== 1 ? `${entityLabel}s` : entityLabel;

  return (
    <Box
      px="md"
      py={8}
      style={{
        backgroundColor: `${theme.primary}0d`,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <Group justify="space-between" wrap="wrap" gap={8}>
        <Text size="sm" fw={500} c={theme.primary}>
          {count} {plural} selected
        </Text>
        <Group gap={8}>{children}</Group>
      </Group>
    </Box>
  );
}
