import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, SimpleGrid } from "@mantine/core";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { ERP_LIST_FONT_SANS, ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import useAuthStore from "../../../store/authStore";
import BranchCollectionInvoiceDrawer from "./BranchCollectionInvoiceDrawer";
import { BranchCollectionTable } from "./collectionTargetVsPerformance/components/BranchCollectionTable";
import { CollectionKpiRow } from "./collectionTargetVsPerformance/components/CollectionKpiRow";
import { CollectionPageHeader } from "./collectionTargetVsPerformance/components/CollectionPageHeader";
import { DailyCollectionChart } from "./collectionTargetVsPerformance/components/DailyCollectionChart";
import { MonthlyTargetCard } from "./collectionTargetVsPerformance/components/MonthlyTargetCard";
import type { PeriodGranularity } from "./collectionTargetVsPerformance/components/PeriodPillGroup";
import { COLLECTION_TARGET_VS_PERFORMANCE_MOCK } from "./collectionTargetVsPerformance/collectionTargetVsPerformanceMock";
import { normalizeCollectionTargetVsPerformance } from "./collectionTargetVsPerformance/collectionTargetVsPerformanceNormalize";
import type {
  BranchCollectionRow,
  CollectionTargetVsPerformanceData,
} from "./collectionTargetVsPerformance/collectionTargetVsPerformanceTypes";
import { COL_PAGE_BG } from "./collectionTargetVsPerformance/theme";

const CollectionTargetvsPerformanceDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const company = user?.company?.company_name || "PENTAGON INDIA";

  const [data, setData] = useState<CollectionTargetVsPerformanceData>(
    COLLECTION_TARGET_VS_PERFORMANCE_MOCK,
  );
  const [loading, setLoading] = useState(true);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("month");
  const [periodFilter, setPeriodFilter] = useState<string | null>("fy_ytd");
  const [branchFilter, setBranchFilter] = useState<string | null>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string | null>("all");
  const [selectedBranchForDrawer, setSelectedBranchForDrawer] =
    useState<BranchCollectionRow | null>(null);
  const [branchDrawerOpened, setBranchDrawerOpened] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCallProtected.post(URL.dashboard.collectionTargetVsPerformance, {
        period: periodGranularity,
        period_filter: periodFilter,
        branch: branchFilter === "all" ? null : branchFilter,
        currency: currencyFilter === "all" ? null : currencyFilter,
      });
      setData(normalizeCollectionTargetVsPerformance(response.data));
      setApiNotice(null);
    } catch {
      setData(COLLECTION_TARGET_VS_PERFORMANCE_MOCK);
      setApiNotice(
        "Live collection data is not available yet. Showing reference layout with demo figures until the API responds.",
      );
    } finally {
      setLoading(false);
    }
  }, [branchFilter, currencyFilter, periodFilter, periodGranularity]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleRowClick = (row: BranchCollectionRow) => {
    const branchKey = row.id ?? row.branchCode ?? row.branchName;
    if (!branchKey?.trim()) return;
    setSelectedBranchForDrawer(row);
    setBranchDrawerOpened(true);
  };

  return (
    <Box
      className={ERP_LIST_GEIST_ROOT_CLASS}
      style={{
        background: COL_PAGE_BG,
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

        <CollectionPageHeader
          meta={data.meta}
          periodGranularity={periodGranularity}
          onPeriodGranularityChange={setPeriodGranularity}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          currencyFilter={currencyFilter}
          onCurrencyFilterChange={setCurrencyFilter}
          filterOptions={data.filterOptions}
          onRefresh={() => void loadDashboard()}
        />

        <CollectionKpiRow kpis={data.kpis} loading={loading} />

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={14} mb={14}>
          <MonthlyTargetCard data={data.thisMonth} />
          <DailyCollectionChart data={data.dailyCollection} loading={loading} />
        </SimpleGrid>

        <BranchCollectionTable
          rows={data.branchPerformance.rows}
          total={data.branchPerformance.total}
          loading={loading}
          onRowClick={handleRowClick}
        />
      </Box>

      <BranchCollectionInvoiceDrawer
        opened={branchDrawerOpened}
        onClose={() => setBranchDrawerOpened(false)}
        branch={selectedBranchForDrawer}
        company={company}
        periodGranularity={periodGranularity}
        periodFilter={periodFilter}
        currencyFilter={currencyFilter}
        periodLabel={data.meta.periodLabel}
      />
    </Box>
  );
};

export default CollectionTargetvsPerformanceDashboard;
