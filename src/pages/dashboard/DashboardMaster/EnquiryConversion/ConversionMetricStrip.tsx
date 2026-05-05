import type { CSSProperties, ReactNode } from "react";
import { Group, Stack, Text, Box } from "@mantine/core";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export type ConversionMetricStripColumn = {
  key: string;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  valueColor?: string;
  captionColor?: string;
  captionFw?: number;
};

const ERP_FONT = "'Geist', sans-serif";

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: enquiryConversionColors.subHeading,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontFamily: ERP_FONT,
};

/**
 * Three-column KPI row on the Overview “Enquiry Conversion” tile.
 */
export function ConversionMetricStrip({
  columns,
  onActivate,
}: {
  columns: ConversionMetricStripColumn[];
  onActivate?: () => void;
}) {
  return (
    <Box style={{ fontFamily: ERP_FONT, width: "100%" }}>
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        gap={16}
      >
        {columns.map((col) => {
          return (
            <Stack
              key={col.key}
              gap={4}
              align="flex-start"
              style={{
                flex: "1 1 120px",
                minWidth: 100,
                cursor: onActivate ? "pointer" : undefined,
              }}
              onClick={onActivate}
            >
              <Text style={labelStyle}>{col.label}</Text>
              <Text
                fz={{ base: "xl", sm: 26 }}
                fw={700}
                c={col.valueColor ?? enquiryConversionColors.heading}
                style={{ lineHeight: 1.1, fontFamily: ERP_FONT }}
                ta="left"
              >
                {typeof col.value === "number"
                  ? col.value.toLocaleString("en-IN")
                  : col.value}
              </Text>
              {col.caption != null ? (
                <Text
                  fz={13}
                  c={col.captionColor ?? enquiryConversionColors.heading}
                  fw={col.captionFw ?? 400}
                  style={{ fontFamily: ERP_FONT }}
                  ta="left"
                  lh={1.35}
                >
                  {col.caption}
                </Text>
              ) : null}
            </Stack>
          );
        })}
      </Group>
    </Box>
  );
}
