import { Box, SimpleGrid, Text } from "@mantine/core";
import { BAD, CARD_BG, GOOD, INK, INK_3, INK_4, LINE } from "./constants";
import type { ProfitabilityDrillSummary } from "./types";
import { formatLakhs } from "./utils";

type ProfitabilityDrillKpiCardsProps = {
  summary: ProfitabilityDrillSummary;
  categoryBenchmarkPct?: number;
};

function MiniKpi({
  label,
  value,
  detail,
  valueColor,
  detailColor,
}: {
  label: string;
  value: string;
  detail: string;
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
      <Text
        fz={10}
        fw={500}
        c={INK_3}
        tt="uppercase"
        style={{ letterSpacing: "0.04em" }}
      >
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
        {detail}
      </Text>
    </Box>
  );
}

export function ProfitabilityDrillKpiCards({
  summary,
  categoryBenchmarkPct,
}: ProfitabilityDrillKpiCardsProps) {
  const costPct =
    summary.revenueL > 0
      ? ((summary.costL / summary.revenueL) * 100).toFixed(1)
      : "0.0";
  const benchmark = categoryBenchmarkPct ?? summary.marginPct;

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10} mb={16}>
      <MiniKpi
        label="Revenue"
        value={`₹${formatLakhs(summary.revenueL)}`}
        detail={`${summary.jobCount} jobs`}
      />
      <MiniKpi
        label="Direct Cost"
        value={`₹${formatLakhs(summary.costL)}`}
        detail={`${costPct}% of revenue`}
      />
      <MiniKpi
        label="Gross Profit"
        value={`₹${formatLakhs(summary.grossProfitL)}`}
        detail={
          summary.gpTrendText
            ? `${summary.gpTrendUp ? "▲" : "▼"} ${summary.gpTrendText}`
            : "—"
        }
        valueColor={GOOD}
        detailColor={summary.gpTrendUp ? GOOD : BAD}
      />
      <MiniKpi
        label="Avg Margin"
        value={`${summary.avgMarginPct.toFixed(1)}%`}
        detail={`Cat. avg ${benchmark.toFixed(1)}%`}
      />
    </SimpleGrid>
  );
}
