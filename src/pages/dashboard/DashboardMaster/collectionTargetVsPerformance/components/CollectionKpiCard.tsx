import { Box, Skeleton, Text } from "@mantine/core";
import type { CollectionKpi } from "../collectionTargetVsPerformanceTypes";
import type { TrendDirection } from "../../accountsDashboardTypes";
import { COL_BAD, COL_CARD_BG, COL_GOOD, COL_INK, COL_INK_3, COL_INK_4, COL_LINE } from "../theme";

function trendColor(direction?: TrendDirection, invert = false): string {
  const up = invert ? COL_BAD : COL_GOOD;
  const down = invert ? COL_GOOD : COL_BAD;
  if (direction === "up") return up;
  if (direction === "down") return down;
  return COL_INK_3;
}

type CollectionKpiCardProps = {
  kpi: CollectionKpi;
  loading?: boolean;
  invertTrend?: boolean;
};

export function CollectionKpiCard({ kpi, loading, invertTrend }: CollectionKpiCardProps) {
  if (loading) {
    return (
      <Box
        style={{
          background: COL_CARD_BG,
          border: `1px solid ${COL_LINE}`,
          borderRadius: 10,
          padding: "14px 16px",
          minHeight: 96,
        }}
      >
        <Skeleton height={10} width="55%" mb={10} />
        <Skeleton height={28} width="70%" mb={8} />
        <Skeleton height={12} width="45%" />
      </Box>
    );
  }

  const arrow =
    kpi.trendDirection === "up" ? "▲" : kpi.trendDirection === "down" ? "▼" : "";

  return (
    <Box
      style={{
        background: COL_CARD_BG,
        border: `1px solid ${COL_LINE}`,
        borderRadius: 10,
        padding: "14px 16px",
        minHeight: 96,
      }}
    >
      <Text fz={11} fw={500} c={COL_INK_3} tt="uppercase" style={{ letterSpacing: "0.04em" }}>
        {kpi.label}
      </Text>
      <Text
        mt={4}
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: COL_INK,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {kpi.formattedValue ? (
          kpi.formattedValue
        ) : (
          <>
            {kpi.showCurrency && kpi.unit !== "%" ? (
              <Text span c={COL_INK_3} fz={14} fw={500} mr={2}>
                ₹
              </Text>
            ) : null}
            {kpi.unit === "%" || kpi.unit === "days"
              ? kpi.value.toFixed(1)
              : kpi.value.toFixed(2)}
            {kpi.unit ? (
              <Text span c={COL_INK_3} fz={14} fw={500} ml={2}>
                {kpi.unit}
              </Text>
            ) : null}
          </>
        )}
      </Text>
      {kpi.context ? (
        <Text fz={12} c={COL_INK_4} mt={6}>
          {kpi.context}
        </Text>
      ) : kpi.trendText ? (
        <Text fz={12} fw={500} c={trendColor(kpi.trendDirection, invertTrend)} mt={6}>
          {arrow} {kpi.trendText}
        </Text>
      ) : null}
    </Box>
  );
}
