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
  dotColor?: string;
  dotBgColor?: string;
};

export function StageFunnelCard({
  title,
  subtitle,
  rows,
  embeddedAboveModeSection,
  onFunnelRowClick,
}: {
  title: string;
  subtitle?: string;
  rows: StageFunnelRow[];
  /** Tighter bottom padding when stacked with By Mode inside one card */
  embeddedAboveModeSection?: boolean;
  /** When set, each funnel row opens the stage drill-down (e.g. right drawer). */
  onFunnelRowClick?: (row: StageFunnelRow) => void;
}) {
  const pb = embeddedAboveModeSection ? 14 : 24;
  const headerMb = embeddedAboveModeSection ? 18 : 24;
  const rowGap = embeddedAboveModeSection ? 12 : 16;

  return (
    <Box
      style={{
        padding: `24px 24px ${pb}px`,
      }}
    >
      <Group gap="sm" mb={headerMb} align="baseline">
        <Text fw={700} fz={16} c={enquiryConversionColors.heading}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" fw={500} c={enquiryConversionColors.subHeading}>
            {subtitle}
          </Text>
        ) : null}
      </Group>
      <Stack gap={rowGap}>
        {rows.length === 0 ? (
          <Text size="sm" c={enquiryConversionColors.subHeading}>
            No funnel data for this filter.
          </Text>
        ) : (
          <Fragment>
            {rows.map((row) => (
              <Box
                key={row.stage}
                component={onFunnelRowClick ? "button" : "div"}
                type={onFunnelRowClick ? "button" : undefined}
                onClick={onFunnelRowClick ? () => onFunnelRowClick(row) : undefined}
                style={{
                  width: "100%",
                  margin: 0,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: onFunnelRowClick ? "pointer" : undefined,
                  textAlign: "inherit",
                  font: "inherit",
                  color: "inherit",
                }}
              >
              <Group wrap="nowrap" align="center" gap="md">
                <Box
                  style={{
                    flex: "0 0 100px",
                    background: row.dotBgColor || `${row.barColor}1A`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Box
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: row.dotColor || row.barColor,
                      flexShrink: 0,
                    }}
                  />
                  <Text size="xs" fw={700} c={row.dotColor || row.barColor} style={{ whiteSpace: "nowrap" }}>
                    {row.stage}
                  </Text>
                </Box>
                
                <Box
                  style={{
                    flex: 1,
                    position: "relative",
                    height: 32,
                    borderRadius: 8,
                    background: "#F8FAFC",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, Math.max(0, row.barPercent))}%`,
                      backgroundColor: row.barColor,
                      borderRadius: 8,
                      pointerEvents: "none",
                      transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                  <Box
                    style={{
                      position: "absolute",
                      left: 12,
                      top: 0,
                      bottom: 0,
                      display: "flex",
                      alignItems: "center",
                      zIndex: 1,
                    }}
                  >
                    <Text size="xs" fw={600} c="#FFFFFF">
                      {row.barCaption}
                    </Text>
                  </Box>
                </Box>

                <Box style={{ flex: "0 0 40px", textAlign: "right" }}>
                  <Text size="sm" fw={700} c={enquiryConversionColors.heading}>
                    {row.count.toLocaleString("en-IN")}
                  </Text>
                </Box>

                <Box style={{ flex: "0 0 50px", textAlign: "right" }}>
                  <Text size="xs" fw={500} c={enquiryConversionColors.muted}>
                    {row.conversionNote || "—"}
                  </Text>
                </Box>
              </Group>
              </Box>
            ))}
          </Fragment>
        )}
      </Stack>
    </Box>
  );
}
