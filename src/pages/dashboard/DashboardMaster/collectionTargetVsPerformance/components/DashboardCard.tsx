import { Box, Flex, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { COL_CARD_BG, COL_INK, COL_INK_4, COL_LINE } from "../theme";

type DashboardCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  padding?: string;
  headerRight?: ReactNode;
};

export function DashboardCard({
  title,
  subtitle,
  children,
  padding = "18px",
  headerRight,
}: DashboardCardProps) {
  return (
    <Box
      style={{
        background: COL_CARD_BG,
        border: `1px solid ${COL_LINE}`,
        borderRadius: 10,
        padding,
        overflow: "hidden",
      }}
    >
      <Flex align="baseline" gap={10} wrap="wrap" mb={subtitle || headerRight ? 14 : 12}>
        <Text fz={13} fw={600} c={COL_INK} style={{ letterSpacing: "-0.005em" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text fz={11} c={COL_INK_4}>
            {subtitle}
          </Text>
        ) : null}
        {headerRight ? (
          <>
            <Box style={{ flex: 1, minWidth: 8 }} />
            {headerRight}
          </>
        ) : null}
      </Flex>
      {children}
    </Box>
  );
}
