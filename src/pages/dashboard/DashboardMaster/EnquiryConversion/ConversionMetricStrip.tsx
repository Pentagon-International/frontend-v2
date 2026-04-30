import type { ReactNode } from "react";
import { Group, Stack, Text } from "@mantine/core";

export type ConversionMetricStripColumn = {
  key: string;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  /** Main KPI number color */
  valueColor?: string;
  captionColor?: string;
  captionFw?: number;
};

const labelStyle = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#64748B",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

/**
 * Three-column KPI row used on the Overview “Enquiry Conversion” tile (same structure as Outstanding vs Overdue).
 */
export function ConversionMetricStrip({
  columns,
  onActivate,
}: {
  columns: ConversionMetricStripColumn[];
  /** Opens linked module / drill-down when the strip is actionable */
  onActivate?: () => void;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="lg">
      {columns.map((col) => (
        <Stack
          key={col.key}
          gap={6}
          align="center"
          style={{
            flex: 1,
            cursor: onActivate ? "pointer" : undefined,
          }}
          onClick={onActivate}
        >
          <Text style={labelStyle}>{col.label}</Text>
          <Text
            size="xl"
            fw={700}
            c={col.valueColor ?? "#0F172A"}
            style={{ lineHeight: 1.15 }}
          >
            {col.value}
          </Text>
          {col.caption != null ? (
            <Text
              size="xs"
              c={col.captionColor ?? "#64748B"}
              fw={col.captionFw ?? 400}
            >
              {col.caption}
            </Text>
          ) : null}
        </Stack>
      ))}
    </Group>
  );
}
