import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, SimpleGrid } from "@mantine/core";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { ERP_LIST_FONT_SANS, ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import type { PeriodGranularity } from "./collectionTargetVsPerformance/components/PeriodPillGroup";
import { ActivityListPanel } from "./financePendingActivities/components/ActivityListPanel";
import { BranchOpenItemsTable } from "./financePendingActivities/components/BranchOpenItemsTable";
import { PendingActivitiesPageHeader } from "./financePendingActivities/components/PendingActivitiesPageHeader";
import { PendingActivityKpiRow } from "./financePendingActivities/components/PendingActivityKpiRow";
import { FINANCE_PENDING_ACTIVITIES_MOCK } from "./financePendingActivities/financePendingActivitiesMock";
import { normalizeFinancePendingActivities } from "./financePendingActivities/financePendingActivitiesNormalize";
import type { FinancePendingActivitiesData } from "./financePendingActivities/financePendingActivitiesTypes";
import { PA_PAGE_BG } from "./financePendingActivities/theme";

const FinancePendingActivitiesDashboard: React.FC = () => {
  const [data, setData] = useState<FinancePendingActivitiesData>(FINANCE_PENDING_ACTIVITIES_MOCK);
  const [loading, setLoading] = useState(true);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("month");
  const [branchFilter, setBranchFilter] = useState<string | null>("all");
  const [ownerFilter, setOwnerFilter] = useState<string | null>("all");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCallProtected.post(URL.dashboard.financePendingActivities, {
        period: periodGranularity,
        branch: branchFilter === "all" ? null : branchFilter,
        owner: ownerFilter === "all" ? null : ownerFilter,
      });
      setData(normalizeFinancePendingActivities(response.data));
      setApiNotice(null);
    } catch {
      setData(FINANCE_PENDING_ACTIVITIES_MOCK);
      setApiNotice(
        "Live pending activities data is not available yet. Showing reference layout with demo figures until the API responds.",
      );
    } finally {
      setLoading(false);
    }
  }, [branchFilter, ownerFilter, periodGranularity]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <Box
      className={ERP_LIST_GEIST_ROOT_CLASS}
      style={{
        background: PA_PAGE_BG,
        fontFamily: ERP_LIST_FONT_SANS,
        borderRadius: 12,
        minHeight: 400,
      }}
    >
      <Box px={{ base: 12, sm: 16 }} py="md">
        {apiNotice ? (
          <Alert color="yellow" variant="light" mb="md" radius="md" title="Demo data">
            {apiNotice}
          </Alert>
        ) : null}

        <PendingActivitiesPageHeader
          meta={data.meta}
          periodGranularity={periodGranularity}
          onPeriodGranularityChange={setPeriodGranularity}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          ownerFilter={ownerFilter}
          onOwnerFilterChange={setOwnerFilter}
          filterOptions={data.filterOptions}
          onRefresh={() => void loadDashboard()}
        />

        <PendingActivityKpiRow kpis={data.kpis} loading={loading} />

        <BranchOpenItemsTable section={data.byBranch} loading={loading} />

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={14} mb={14}>
          <ActivityListPanel panel={data.invoicesPanel} loading={loading} />
          <Box style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ActivityListPanel panel={data.costsPanel} loading={loading} compact />
            <ActivityListPanel
              panel={data.vouchersPanel}
              loading={loading}
              showTypeColumn
              compact
            />
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
};

export default FinancePendingActivitiesDashboard;
