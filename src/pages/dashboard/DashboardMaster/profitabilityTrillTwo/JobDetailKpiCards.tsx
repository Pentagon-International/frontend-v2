import { Box, SimpleGrid, Text } from "@mantine/core";
import { BAD, CARD_BG, GOOD, INK, INK_3, INK_4, LINE } from "../profitabilityTrillOne/constants";
import { TruncatedFormattedAmount } from "../profitabilityTrillOne/TruncatedAmountText";
import type { JobProfitabilityDetail } from "./types";
import { formatProfitabilityAmount } from "../profitabilityTrillOne/utils";

type JobDetailKpiCardsProps = {
  detail: JobProfitabilityDetail;
};

function MiniKpi({
  label,
  value,
  detailText,
  valueColor,
  detailColor,
  truncateValue = false,
}: {
  label: string;
  value: string;
  detailText: string;
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
      <Text fz={10} fw={500} c={INK_3} tt="uppercase" style={{ letterSpacing: "0.04em" }}>
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
        {detailText}
      </Text>
    </Box>
  );
}

export function JobDetailKpiCards({ detail }: JobDetailKpiCardsProps) {
  const marginUp = detail.marginPct >= 20;
  const { currencyCode } = detail;

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10} mb={16}>
      <MiniKpi
        label="Revenue"
        value={formatProfitabilityAmount(detail.revenueL * 100_000, currencyCode)}
        detailText={`${detail.revenueLines.length} charge lines`}
        truncateValue
      />
      <MiniKpi
        label="Direct Cost"
        value={formatProfitabilityAmount(detail.costL * 100_000, currencyCode)}
        detailText={`${detail.costLines.length} cost lines`}
        truncateValue
      />
      <MiniKpi
        label="Gross Profit"
        value={formatProfitabilityAmount(detail.grossProfitL * 100_000, currencyCode)}
        detailText={`${marginUp ? "▲" : "▼"} ${detail.marginPct.toFixed(1)}% margin`}
        valueColor={GOOD}
        detailColor={marginUp ? GOOD : BAD}
        truncateValue
      />
      <MiniKpi
        label="Per Unit"
        value={detail.perUnitLabel}
        detailText=""
      />
    </SimpleGrid>
  );
}
