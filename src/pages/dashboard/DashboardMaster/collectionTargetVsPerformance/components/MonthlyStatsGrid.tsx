import { Box, SimpleGrid, Text } from "@mantine/core";
import type { MonthlyStatItem } from "../collectionTargetVsPerformanceTypes";
import { COL_BAD, COL_CARD_BG, COL_GOOD, COL_INK, COL_INK_3, COL_INK_4, COL_LINE } from "../theme";

type MonthlyStatsGridProps = {
  stats: MonthlyStatItem[];
};

function detailColor(tone?: MonthlyStatItem["detailTone"]): string {
  if (tone === "up") return COL_GOOD;
  if (tone === "down") return COL_BAD;
  return COL_INK_4;
}

export function MonthlyStatsGrid({ stats }: MonthlyStatsGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={10} style={{ flex: 1 }}>
      {stats.map((stat) => (
        <Box
          key={stat.label}
          style={{
            background: "#f8fafc",
            border: `1px solid ${COL_LINE}`,
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <Text
            fz={10.5}
            fw={500}
            c={COL_INK_3}
            tt="uppercase"
            style={{ letterSpacing: "0.04em" }}
          >
            {stat.label}
          </Text>
          <Text
            fz={18}
            fw={600}
            c={COL_INK}
            mt={2}
            style={{ letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}
          >
            {stat.value}
          </Text>
          {stat.detail ? (
            <Text fz={10.5} c={detailColor(stat.detailTone)} mt={2}>
              {stat.detail}
            </Text>
          ) : null}
        </Box>
      ))}
    </SimpleGrid>
  );
}
