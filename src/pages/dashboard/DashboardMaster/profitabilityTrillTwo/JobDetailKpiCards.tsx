import { Box, SimpleGrid, Text } from "@mantine/core";
import { BAD, CARD_BG, GOOD, INK, INK_3, INK_4, LINE } from "../profitabilityTrillOne/constants";
import type { JobProfitabilityDetail } from "./types";
import { formatLakhs } from "../profitabilityTrillOne/utils";

type JobDetailKpiCardsProps = {
  detail: JobProfitabilityDetail;
};

function MiniKpi({
  label,
  value,
  detailText,
  valueColor,
  detailColor,
}: {
  label: string;
  value: string;
  detailText: string;
  valueColor?: string;
  detailColor?: string;
}) {
  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <Text fz={10} fw={500} c={INK_3} tt="uppercase" style={{ letterSpacing: "0.04em" }}>
        {label}
      </Text>
      <Text
        mt={2}
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: valueColor ?? INK,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Text>
      <Text fz={10} mt={1} c={detailColor ?? INK_4}>
        {detailText}
      </Text>
    </Box>
  );
}

export function JobDetailKpiCards({ detail }: JobDetailKpiCardsProps) {
  const marginUp = detail.marginPct >= 20;

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10} mb={16}>
      <MiniKpi
        label="Revenue"
        value={`₹${formatLakhs(detail.revenueL)}`}
        detailText={`${detail.revenueLines.length} charge lines`}
      />
      <MiniKpi
        label="Direct Cost"
        value={`₹${formatLakhs(detail.costL)}`}
        detailText={`${detail.costLines.length} cost lines`}
      />
      <MiniKpi
        label="Gross Profit"
        value={`₹${formatLakhs(detail.grossProfitL)}`}
        detailText={`${marginUp ? "▲" : "▼"} ${detail.marginPct.toFixed(1)}% margin`}
        valueColor={GOOD}
        detailColor={marginUp ? GOOD : BAD}
      />
      <MiniKpi
        label="Per Unit"
        value={detail.perUnitLabel}
        detailText="GP / unit"
      />
    </SimpleGrid>
  );
}
