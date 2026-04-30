import { Box, Stack, Text, Group } from "@mantine/core";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export type StageFunnelRow = {
  stage: string;
  summary: string;
  count: number;
  rate?: string;
  barPercent: number;
  barColor: string;
};

export function StageFunnelCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: StageFunnelRow[];
}) {
  return (
    <Box
      style={{
        background: "#fff",
        border: `1px solid ${enquiryConversionColors.panelBorder}`,
        borderRadius: 12,
        padding: "18px 20px",
        height: "100%",
        boxShadow:
          "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 14px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Stack gap={4} mb={16}>
        <Text fw={600} fz={14} c={enquiryConversionColors.heading}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" c="#64748B">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      <Stack gap={12}>
        {rows.map((row) => (
          <Box key={row.stage}>
            <Group justify="space-between" gap="sm" mb={6} wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <Box
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: row.barColor,
                    flexShrink: 0,
                  }}
                />
                <Text size="sm" fw={600} c="#0F172A">
                  {row.stage}
                </Text>
              </Group>
              <Text size="xs" c="#475569" ta="right">
                {row.summary}
              </Text>
            </Group>
            <Box
              style={{
                height: 8,
                borderRadius: 4,
                background: "#F1F5F9",
                overflow: "hidden",
              }}
            >
              <Box
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(4, row.barPercent))}%`,
                  backgroundColor: row.barColor,
                  borderRadius: 4,
                }}
              />
            </Box>
            <Group justify="space-between" mt={4}>
              <Text size="xs" c="#64748B">
                Count: {row.count}
              </Text>
              {row.rate ? (
                <Text size="xs" c="#64748B">
                  Rate: {row.rate}
                </Text>
              ) : null}
            </Group>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
