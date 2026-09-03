import { ActionIcon, Box, Group, Paper, Text } from "@mantine/core";
import { IconFilter, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";
import {
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_FULL_BLEED_MX,
  ERP_LIST_INNER_PAD_X,
} from "./erpListTheme";

export interface ERPListFilterPanelProps {
  title: string;
  subtitle?: string;
  /** Header icon; defaults to filter icon. */
  headerIcon?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  /** Filter fields (e.g. Grid of inputs). */
  children: ReactNode;
  /** Clear / Apply row. */
  footer?: ReactNode;
  theme?: ErpListTheme;
}

/**
 * Collapsible filter sheet: pageBg strip + bordered Paper + header band + body + optional footer.
 */
export function ERPListFilterPanel({
  title,
  subtitle,
  headerIcon,
  onClose,
  closeLabel = "Close filters",
  children,
  footer,
  theme = DEFAULT_ERP_LIST_THEME,
}: ERPListFilterPanelProps) {
  return (
    <Box
      mx={ERP_LIST_FULL_BLEED_MX}
      px={ERP_LIST_INNER_PAD_X}
      pt="sm"
      pb="md"
      style={{
        flexShrink: 0,
        backgroundColor: theme.pageBg,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <Paper
        withBorder
        radius="md"
        p={0}
        shadow="sm"
        style={{
          borderColor: theme.border,
          backgroundColor: theme.cardBg,
          overflow: "hidden",
        }}
      >
        <Group
          justify="space-between"
          align="center"
          wrap="nowrap"
          gap="sm"
          px="md"
          py={10}
          style={{
            backgroundColor: theme.headerBg,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <Group gap={10} wrap="nowrap" align="center">
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: `${theme.primary}14`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: theme.primary,
              }}
            >
              {headerIcon ?? <IconFilter size={16} stroke={1.5} />}
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text
                size="sm"
                fw={600}
                c={theme.fg}
                lh={1.3}
                style={{ fontFamily: theme.fontSans }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  size="xs"
                  c={theme.muted}
                  lh={1.2}
                  style={{ fontFamily: theme.fontSans }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </Box>
          </Group>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
        <Box p={{ base: "md", sm: "lg" }}>
          {children}
          {footer}
        </Box>
      </Paper>
    </Box>
  );
}
