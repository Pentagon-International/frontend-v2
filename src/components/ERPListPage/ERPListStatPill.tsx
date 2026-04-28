import { Box, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";

export interface ERPListStatPillProps {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  /** Icon tile background (CSS color). */
  iconBackground?: string;
  /** Icon color (CSS color). */
  iconColor?: string;
  theme?: ErpListTheme;
}

/**
 * KPI tile used in list sub-headers (icon + large value + caption).
 */
export function ERPListStatPill({
  icon,
  value,
  label,
  iconBackground,
  iconColor,
  theme = DEFAULT_ERP_LIST_THEME,
}: ERPListStatPillProps) {
  const bg = iconBackground ?? `${theme.primary}1a`;
  const fgIcon = iconColor ?? theme.primary;

  return (
    <Group gap={8} wrap="nowrap" align="center">
      <Box
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Box style={{ color: fgIcon, display: "flex" }}>{icon}</Box>
      </Box>
      <Box>
        <Text fw={700} size="lg" c={theme.fg} lh={1} style={{ fontFamily: theme.fontSans }}>
          {value}
        </Text>
        <Text size={10} c={theme.muted} lh={1.2} style={{ fontFamily: theme.fontSans }}>
          {label}
        </Text>
      </Box>
    </Group>
  );
}
