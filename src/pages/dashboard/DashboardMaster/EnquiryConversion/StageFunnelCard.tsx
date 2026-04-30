import { Fragment } from "react";
import { Box, Group, Stack, Text } from "@mantine/core";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export type StageFunnelRow = {
  stage: string;
  /** Shown inside the colored bar — e.g. "284 · ₹14.2 Cr" */
  barCaption: string;
  count: number;
  /** Optional right-column conversion note (MoM-style / vs previous stage). */
  conversionNote?: string;
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
      <Stack gap={14}>
        {rows.length === 0 ? (
          <Text size="sm" c="#64748B">
            No funnel data for this filter.
          </Text>
        ) : (
          <Fragment>
            {rows.map((row) => (
              <Box key={row.stage}>
                <Group justify="space-between" gap="sm" mb={8} wrap="nowrap">
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
                  <Group gap={12} wrap="nowrap">
                    <Text size="xs" fw={700} c="#0F172A" ta="right">
                      {row.count.toLocaleString("en-IN")}
                    </Text>
                    {row.conversionNote ? (
                      <Text
                        size="xs"
                        c="#475569"
                        ta="right"
                        style={{ minWidth: 48 }}
                      >
                        {row.conversionNote}
                      </Text>
                    ) : null}
                  </Group>
                </Group>
                <Box
                  style={{
                    position: "relative",
                    height: 26,
                    borderRadius: 6,
                    background: "#F1F5F9",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, Math.max(6, row.barPercent))}%`,
                      backgroundColor: row.barColor,
                      borderRadius: 6,
                      pointerEvents: "none",
                    }}
                  />
                  <Group
                    gap={8}
                    wrap="nowrap"
                    align="center"
                    style={{
                      position: "relative",
                      zIndex: 1,
                      height: "100%",
                      padding: "0 10px",
                      minWidth: 0,
                    }}
                  >
                    <Text
                      size="xs"
                      fw={700}
                      c={row.barPercent < 36 ? "#0F172A" : "#fff"}
                      style={{
                        textShadow:
                          row.barPercent >= 36
                            ? "0 1px 2px rgba(0,0,0,0.22)"
                            : "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {row.barCaption}
                    </Text>
                  </Group>
                </Box>
              </Box>
            ))}
          </Fragment>
        )}
      </Stack>
    </Box>
  );
}
