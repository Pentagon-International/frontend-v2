import { SimpleGrid } from "@mantine/core";
import type { CollectionKpi } from "../collectionTargetVsPerformanceTypes";
import { CollectionKpiCard } from "./CollectionKpiCard";

type CollectionKpiRowProps = {
  kpis: CollectionKpi[];
  loading?: boolean;
  currencyCode?: string;
};

export function CollectionKpiRow({ kpis, loading, currencyCode = "INR" }: CollectionKpiRowProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 5 }} spacing={14} mb={14}>
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <CollectionKpiCard key={i} kpi={{ label: "", value: 0 }} loading />
          ))
        : kpis.map((kpi) => (
            <CollectionKpiCard
              key={kpi.label}
              kpi={kpi}
              currencyCode={currencyCode}
              invertTrend={kpi.label === "DSO"}
            />
          ))}
    </SimpleGrid>
  );
}
