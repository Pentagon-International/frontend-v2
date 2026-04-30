import { Box, Text, Group } from "@mantine/core";

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
    trend === "up" ? "#15803D" : trend === "down" ? "#DC2626" : "#64748B";

  return (
    <Box
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        padding: "16px 18px",
        boxShadow:
          "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 14px rgba(15, 23, 42, 0.06)",
        flex: "1 1 140px",
        minWidth: 120,
      }}
    >
      <Text size="10px" fw={600} c="#64748B" tt="uppercase" ls={0.6} mb={8}>
        {label}
      </Text>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Text fw={700} fz={26} c="#0F172A" lh={1.1}>
          {value}
        </Text>
        {trendLabel ? (
          <Text size="xs" fw={600} c={trendColor} style={{ whiteSpace: "nowrap" }}>
            {trend === "up" ? "▲ " : trend === "down" ? "▼ " : ""}
            {trendLabel}
          </Text>
        ) : null}
      </Group>
    </Box>
  );
}
