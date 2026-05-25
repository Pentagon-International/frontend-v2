import { Flex, Loader, Skeleton } from "@mantine/core";
import type { CollectionTargetVsPerformanceData } from "../collectionTargetVsPerformanceTypes";
import { COL_NAVY_800 } from "../theme";
import { DashboardCard } from "./DashboardCard";
import { MonthlyGauge } from "./MonthlyGauge";
import { MonthlyStatsGrid } from "./MonthlyStatsGrid";

type MonthlyTargetCardProps = {
  data: CollectionTargetVsPerformanceData["thisMonth"];
  loading?: boolean;
};

export function MonthlyTargetCard({ data, loading }: MonthlyTargetCardProps) {
  return (
    <DashboardCard title={data.title} subtitle={data.subtitle}>
      {loading ? (
        <Flex
          gap={18}
          align="center"
          wrap="wrap"
          direction={{ base: "column", sm: "row" }}
          mih={200}
        >
          <Flex align="center" justify="center" style={{ width: 220, minHeight: 130 }}>
            <Loader size="sm" color={COL_NAVY_800} />
          </Flex>
          <Flex direction="column" gap={10} style={{ flex: 1, width: "100%" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={56} radius="md" />
            ))}
          </Flex>
        </Flex>
      ) : (
        <Flex
          gap={18}
          align="center"
          wrap="wrap"
          direction={{ base: "column", sm: "row" }}
        >
          <MonthlyGauge pct={data.gaugePct} />
          <MonthlyStatsGrid stats={data.stats} />
        </Flex>
      )}
    </DashboardCard>
  );
}
