import { Box, Center, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { DEFAULT_ERP_LIST_THEME, type ErpListTheme } from "./erpListTheme";
import { ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG } from "./erpListTableStyles";

export interface ERPListTableEmptyProps {
  theme?: ErpListTheme;
  /** 24px icon, typically Tabler, colored with `theme.muted` at call site. */
  icon: ReactNode;
  title: string;
  /** Subtitle; omit or pass empty string to hide. */
  hint?: string;
  minHeight?: number;
  /** Vertical padding for the block (default `60` for full table card; use `32` when nested). */
  paddingY?: number;
}

/**
 * Centered empty state inside `ERPListTableCard` (same pattern as
 * `AirExportBookingMaster` / native HTML table empty row).
 */
export function ERPListTableEmpty({
  theme = DEFAULT_ERP_LIST_THEME,
  icon,
  title,
  hint = "Try adjusting your search or filters",
  minHeight = 200,
  paddingY = 60,
}: ERPListTableEmptyProps) {
  const { fg, muted, fontSans, cardBg } = theme;
  return (
    <Center
      py={paddingY}
      style={{
        backgroundColor: cardBg,
        flex: 1,
        minHeight,
        fontFamily: fontSans,
      }}
    >
      <Stack align="center" gap="md">
        <Box
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            backgroundColor: ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
            {title}
          </Text>
          {hint ? (
            <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
              {hint}
            </Text>
          ) : null}
        </Box>
      </Stack>
    </Center>
  );
}
