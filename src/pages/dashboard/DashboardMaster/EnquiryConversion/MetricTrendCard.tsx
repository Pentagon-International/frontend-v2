import { Box, Text, Stack } from "@mantine/core";
import { IconArrowUpRight, IconArrowDownRight } from "@tabler/icons-react";
import { enquiryConversionColors } from "./enquiryConversionTokens";

type Trend = "up" | "down" | "neutral";

export function MetricTrendCard({
  label,
  value,
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  trend?: Trend;
  trendLabel?: string;
}) {
  const trendColor =
    trend === "up" ? "#22C55E" : trend === "down" ? "#EF4444" : enquiryConversionColors.subHeading;

  return (
    <Box
      style={{
        background: enquiryConversionColors.panelBg,
        border: `1px solid ${enquiryConversionColors.panelBorder}`,
        borderRadius: enquiryConversionColors.radius,
        padding: "20px 24px",
        boxShadow: enquiryConversionColors.shadow,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 120,
      }}
    >
      <Text size="11px" fw={600} c={enquiryConversionColors.subHeading} tt="uppercase" lts={0.8} mb={12}>
        {label}
      </Text>
      <Stack gap={4}>
        <Text fw={700} fz={32} c={enquiryConversionColors.heading} lh={1}>
          {value}
        </Text>
        {trendLabel ? (
          <Box style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {trend === "up" && <IconArrowUpRight size={14} color={trendColor} stroke={3} />}
            {trend === "down" && <IconArrowDownRight size={14} color={trendColor} stroke={3} />}
            <Text size="xs" fw={700} c={trendColor}>
              {trendLabel}
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
