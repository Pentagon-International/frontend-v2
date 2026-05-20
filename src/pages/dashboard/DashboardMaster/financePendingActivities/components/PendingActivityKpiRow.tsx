import { SimpleGrid } from "@mantine/core";
import type { PendingActivityKpi } from "../financePendingActivitiesTypes";
import { PendingActivityKpiCard } from "./PendingActivityKpiCard";

type PendingActivityKpiRowProps = {
  kpis: PendingActivityKpi[];
  loading?: boolean;
};

export function PendingActivityKpiRow({ kpis, loading }: PendingActivityKpiRowProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing={14} mb={14}>
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <PendingActivityKpiCard key={i} kpi={kpis[0]} loading />
          ))
        : kpis.map((kpi) => <PendingActivityKpiCard key={kpi.id} kpi={kpi} />)}
    </SimpleGrid>
  );
}
