import { SimpleGrid } from "@mantine/core";
import type { CollectionKpi } from "../collectionTargetVsPerformanceTypes";
import { CollectionKpiCard } from "./CollectionKpiCard";

type CollectionKpiRowProps = {
  kpis: CollectionKpi[];
  loading?: boolean;
};

export function CollectionKpiRow({ kpis, loading }: CollectionKpiRowProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 5 }} spacing={14} mb={14}>
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <CollectionKpiCard key={i} kpi={kpis[0]} loading />
          ))
        : kpis.map((kpi) => (
            <CollectionKpiCard
              key={kpi.label}
              kpi={kpi}
              invertTrend={kpi.label === "DSO"}
            />
          ))}
    </SimpleGrid>
  );
}
