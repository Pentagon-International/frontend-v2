import { Box, Text } from "@mantine/core";
import { MODE_CHIP_STYLES, SEGMENT_LABELS } from "./constants";
import type { ProfitabilityJobSegment } from "./types";

type ModeChipProps = {
  segment: ProfitabilityJobSegment;
};

export function ModeChip({ segment }: ModeChipProps) {
  const style = MODE_CHIP_STYLES[segment];
  return (
    <Box
      component="span"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: 3,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: style.background,
        color: style.color,
      }}
    >
      {SEGMENT_LABELS[segment]}
    </Box>
  );
}
