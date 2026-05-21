import { SimpleGrid } from "@mantine/core";
import type { PendingActivityKpi } from "../financePendingActivitiesTypes";
import { PendingActivityKpiCard } from "./PendingActivityKpiCard";

type PendingActivityKpiRowProps = {
  kpis: PendingActivityKpi[];
  loading?: boolean;
};

export function PendingActivityKpiRow({ kpis, loading }: PendingActivityKpiRowProps) {
  const skeletonCount = Math.max(kpis.length, 4);

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing={14} mb={14}>
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <PendingActivityKpiCard key={i} kpi={kpis[0] ?? { id: "invoices", label: "", subtitle: "", amountCr: 0, count: 0, avgAgeDays: 0 }} loading />
          ))
        : kpis.map((kpi) => <PendingActivityKpiCard key={kpi.id} kpi={kpi} />)}
    </SimpleGrid>
  );
}
