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
  embeddedBelowFunnel,
}: {
  title: string;
  segments: FunnelSegment[];
  rows: ModeLegendRow[];
  /** Tighter top padding when directly under Stage Funnel in one card */
  embeddedBelowFunnel?: boolean;
}) {
  const pt = embeddedBelowFunnel ? 14 : 24;
  const titleMb = embeddedBelowFunnel ? 12 : 16;
  const listMt = embeddedBelowFunnel ? 14 : 20;
  const rowGap = embeddedBelowFunnel ? 12 : 14;

  return (
    <Box
      style={{
        padding: `${pt}px 24px 24px`,
      }}
    >
      <Text
        fw={600}
        fz={12}
        tt="uppercase"
        lts={0.8}
        c={enquiryConversionColors.subHeading}
        mb={titleMb}
      >
        {title}
      </Text>
      {segments.length > 0 ? (
        <>
          <SegmentedFunnelBar segments={segments} height={8} showLabels={false} />
          <Stack gap={rowGap} mt={listMt}>
            {rows.map((r) => (
              <Group key={r.key} justify="space-between" wrap="nowrap" gap="sm">
                <Group gap={12} wrap="nowrap">
                  <Box
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: r.color,
                      flexShrink: 0,
                    }}
                  />
                  <Text size="sm" fw={600} c={enquiryConversionColors.heading}>
                    {r.label}
                  </Text>
                </Group>
                <Group gap={16} wrap="nowrap">
                  <Text size="sm" fw={700} c={enquiryConversionColors.heading}>
                    {r.valueLabel}
                  </Text>
                  <Text size="xs" fw={500} c={enquiryConversionColors.muted} style={{ minWidth: 32 }} ta="right">
                    {r.percentLabel}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </>
      ) : (
        <Text size="sm" c={enquiryConversionColors.subHeading} py={16}>
          No service breakdown for this filter.
        </Text>
      )}
    </Box>
  );
}
