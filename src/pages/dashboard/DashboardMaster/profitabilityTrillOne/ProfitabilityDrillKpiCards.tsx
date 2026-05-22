import { Box, SimpleGrid, Text } from "@mantine/core";
import { BAD, CARD_BG, GOOD, INK, INK_3, INK_4, LINE } from "./constants";
import { TruncatedFormattedAmount } from "./TruncatedAmountText";
import type { ProfitabilityDrillSummary } from "./types";
import { formatProfitabilityAmount } from "./utils";

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
  truncateValue = false,
}: {
  label: string;
  value: string;
  detail: string;
  valueColor?: string;
  detailColor?: string;
  truncateValue?: boolean;
}) {
  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 0,
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
      <Box mt={2} style={{ minWidth: 0 }}>
        {truncateValue ? (
          <TruncatedFormattedAmount text={value} fz={18} fw={600} color={valueColor ?? INK} />
        ) : (
          <Text
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
        )}
      </Box>
      <Text fz={10} mt={1} c={detailColor ?? INK_4}>
        {detail}
      </Text>
    </Box>
  );
}

export function ProfitabilityDrillKpiCards({
  summary,
  categoryBenchmarkPct: _categoryBenchmarkPct,
}: ProfitabilityDrillKpiCardsProps) {
  const { currencyCode } = summary;

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10} mb={16}>
      <MiniKpi
        label="Revenue"
        value={formatProfitabilityAmount(summary.revenue, currencyCode)}
        detail={`${summary.jobCount} jobs`}
        truncateValue
      />
      <MiniKpi
        label="Direct Cost"
        value={formatProfitabilityAmount(summary.cost, currencyCode)}
        detail={``}
        truncateValue
      />
      <MiniKpi
        label="Gross Profit"
        value={formatProfitabilityAmount(summary.grossProfit, currencyCode)}
        detail={
          summary.gpTrendText
            ? `${summary.gpTrendUp ? "▲" : "▼"} ${summary.gpTrendText}`
            : "—"
        }
        valueColor={summary.grossProfit >= 0 ? GOOD : BAD}
        detailColor={summary.gpTrendUp ? GOOD : BAD}
        truncateValue
      />
      <MiniKpi
        label="Avg Margin"
        value={`${summary.avgMarginPct.toFixed(1)}%`}
        // detail={`Cat. avg ${benchmark.toFixed(1)}%`}
        detail={``}
      />
    </SimpleGrid>
  );
}
