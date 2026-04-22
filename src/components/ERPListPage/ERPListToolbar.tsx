import { Box, Flex } from "@mantine/core";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";
import {
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_FULL_BLEED_MX,
  ERP_LIST_INNER_PAD_X,
} from "./erpListTheme";

export interface ERPListToolbarProps {
  /** Left cluster (e.g. stat pills). */
  leading: ReactNode;
  /** Optional middle metrics (e.g. pcs / kg); shown after a vertical rule. */
  secondary?: ReactNode;
  /** Right cluster — use `marginLeft: auto` on a wrapping Flex for toolbar actions. */
  actions: ReactNode;
  theme?: ErpListTheme;
}

/**
 * Full-bleed white sub-header strip: stats | divider | secondary | actions.
 * Matches Air Export Booking master toolbar layout.
 */
export function ERPListToolbar({
  leading,
  secondary,
  actions,
  theme = DEFAULT_ERP_LIST_THEME,
}: ERPListToolbarProps) {
  return (
    <Box
      mx={ERP_LIST_FULL_BLEED_MX}
      style={{
        backgroundColor: theme.cardBg,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <Box px={ERP_LIST_INNER_PAD_X} py={12}>
        <Flex
          align="center"
          gap={24}
          wrap="nowrap"
          style={{
            overflowX: "auto",
            minHeight: 40,
            scrollbarWidth: "thin",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Flex align="center" gap={32} wrap="nowrap" style={{ flexShrink: 0 }}>
            {leading}
          </Flex>

          {secondary ? (
            <>
              <Box
                style={{
                  width: 1,
                  height: 32,
                  backgroundColor: theme.border,
                  flexShrink: 0,
                }}
              />
              <Flex align="center" gap={24} wrap="nowrap" style={{ flexShrink: 0 }}>
                {secondary}
              </Flex>
            </>
          ) : null}

          <Flex
            align="center"
            gap={8}
            wrap="nowrap"
            style={{ marginLeft: "auto", flexShrink: 0 }}
          >
            {actions}
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
