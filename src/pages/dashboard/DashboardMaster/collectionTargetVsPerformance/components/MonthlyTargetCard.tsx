import { Flex } from "@mantine/core";
import type { CollectionTargetVsPerformanceData } from "../collectionTargetVsPerformanceTypes";
import { DashboardCard } from "./DashboardCard";
import { MonthlyGauge } from "./MonthlyGauge";
import { MonthlyStatsGrid } from "./MonthlyStatsGrid";

type MonthlyTargetCardProps = {
  data: CollectionTargetVsPerformanceData["thisMonth"];
};

export function MonthlyTargetCard({ data }: MonthlyTargetCardProps) {
  return (
    <DashboardCard title={data.title} subtitle={data.subtitle}>
      <Flex
        gap={18}
        align="center"
        wrap="wrap"
        direction={{ base: "column", sm: "row" }}
      >
        <MonthlyGauge pct={data.gaugePct} />
        <MonthlyStatsGrid stats={data.stats} />
      </Flex>
    </DashboardCard>
  );
}
