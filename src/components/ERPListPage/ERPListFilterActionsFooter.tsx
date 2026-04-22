import { Button, Group } from "@mantine/core";
import { IconFilter, IconX } from "@tabler/icons-react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";

export interface ERPListFilterActionsFooterProps {
  theme?: ErpListTheme;
  onClear: () => void;
  onApply: () => void;
  applyLoading?: boolean;
  applyDisabled?: boolean;
  clearLabel?: string;
  applyLabel?: string;
}

/**
 * Standard filter sheet footer: Clear + Apply (Air Export filter panel).
 */
export function ERPListFilterActionsFooter({
  theme = DEFAULT_ERP_LIST_THEME,
  onClear,
  onApply,
  applyLoading = false,
  applyDisabled = false,
  clearLabel = "Clear",
  applyLabel = "Apply Filters",
}: ERPListFilterActionsFooterProps) {
  return (
    <Group
      justify="flex-end"
      gap={8}
      mt="lg"
      pt="md"
      style={{ borderTop: `1px solid ${theme.border}` }}
    >
      <Button
        size="xs"
        variant="outline"
        leftSection={<IconX size={13} />}
        styles={{
          root: {
            height: 32,
            fontSize: 12,
            borderColor: theme.primary,
            color: theme.primary,
            fontFamily: theme.fontSans,
          },
        }}
        onClick={onClear}
      >
        {clearLabel}
      </Button>
      <Button
        size="xs"
        leftSection={<IconFilter size={13} />}
        styles={{
          root: {
            height: 32,
            fontSize: 12,
            backgroundColor: theme.primary,
            border: "none",
            fontFamily: theme.fontSans,
          },
        }}
        onClick={onApply}
        loading={applyLoading}
        disabled={applyDisabled}
      >
        {applyLabel}
      </Button>
    </Group>
  );
}
