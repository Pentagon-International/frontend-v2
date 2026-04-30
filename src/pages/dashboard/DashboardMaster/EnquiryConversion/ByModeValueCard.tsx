import { Box, Stack, Text, Group } from "@mantine/core";
import { SegmentedFunnelBar, type FunnelSegment } from "./SegmentedFunnelBar";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export type ModeLegendRow = {
  key: string;
  label: string;
  color: string;
  valueLabel: string;
  percentLabel: string;
};

export function ByModeValueCard({
  title,
  segments,
  rows,
}: {
  title: string;
  segments: FunnelSegment[];
  rows: ModeLegendRow[];
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
      <Text fw={600} fz={11} tt="uppercase" ls={0.8} c="#64748B" mb={14}>
        {title}
      </Text>
      {segments.length > 0 ? (
        <>
          <SegmentedFunnelBar segments={segments} height={22} showLabels={false} />
          <Stack gap={12} mt={18}>
            {rows.map((r) => (
              <Group key={r.key} justify="space-between" wrap="nowrap" gap="sm">
                <Group gap={10} wrap="nowrap">
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      backgroundColor: r.color,
                      flexShrink: 0,
                    }}
                  />
                  <Text size="sm" fw={600} c="#0F172A">
                    {r.label}
                  </Text>
                </Group>
                <Group gap={16} wrap="nowrap">
                  <Text size="sm" fw={700} c="#0F172A">
                    {r.valueLabel}
                  </Text>
                  <Text size="sm" c="#64748B" style={{ minWidth: 36 }} ta="right">
                    {r.percentLabel}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </>
      ) : (
        <Text size="sm" c="#64748B" py={16}>
          No service breakdown for this filter.
        </Text>
      )}
    </Box>
  );
}
