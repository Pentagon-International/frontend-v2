import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, SimpleGrid } from "@mantine/core";
import { ERP_LIST_FONT_SANS, ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import useAuthStore from "../../../store/authStore";
import CollectionDashboardFirstTrill from "./CollectionDashboardFirstTrill";
import { BranchCollectionTable } from "./collectionTargetVsPerformance/components/BranchCollectionTable";
import { CollectionKpiRow } from "./collectionTargetVsPerformance/components/CollectionKpiRow";
import { CollectionPageHeader } from "./collectionTargetVsPerformance/components/CollectionPageHeader";
import { DailyCollectionChart } from "./collectionTargetVsPerformance/components/DailyCollectionChart";
import { MonthlyTargetCard } from "./collectionTargetVsPerformance/components/MonthlyTargetCard";
import type { PeriodGranularity } from "./collectionTargetVsPerformance/components/PeriodPillGroup";
import {
  buildCollectionPerformanceRequest,
  fetchCollectionPerformance,
} from "./collectionTargetVsPerformance/collectionTargetVsPerformanceApi";
import {
  normalizeDateRange,
  parseApiDate,
  periodToDateRange,
  type PendingActivitiesDateRange,
} from "./financePendingActivities/financePendingActivitiesApi";
import {
  emptyCollectionTargetVsPerformance,
  normalizeCollectionTargetVsPerformance,
} from "./collectionTargetVsPerformance/collectionTargetVsPerformanceNormalize";
import type {
  BranchCollectionRow,
  CollectionTargetVsPerformanceData,
} from "./collectionTargetVsPerformance/collectionTargetVsPerformanceTypes";
import { COL_PAGE_BG } from "./collectionTargetVsPerformance/theme";

const CollectionTargetvsPerformanceDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const company = user?.company?.company_name || "PENTAGON INDIA";

  const [data, setData] = useState<CollectionTargetVsPerformanceData>(
    emptyCollectionTargetVsPerformance(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("fy");
  const [dateRange, setDateRange] = useState<PendingActivitiesDateRange>(() =>
    periodToDateRange("fy"),
  );
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<string | null>("all");
  const [selectedBranchForDrawer, setSelectedBranchForDrawer] =
    useState<BranchCollectionRow | null>(null);
  const [branchDrawerOpened, setBranchDrawerOpened] = useState(false);

  const handlePeriodGranularityChange = useCallback((period: PeriodGranularity) => {
    setPeriodGranularity(period);
    setDateRange(periodToDateRange(period));
  }, []);

  const fromDate = parseApiDate(dateRange.date_from);
  const toDate = parseApiDate(dateRange.date_to);

  const handleFromDateChange = useCallback(
    (date: Date | null) => {
      const next = normalizeDateRange(date, toDate ?? date);
      if (next) setDateRange(next);
    },
    [toDate],
  );

  const handleToDateChange = useCallback(
    (date: Date | null) => {
      const next = normalizeDateRange(fromDate ?? date, date);
      if (next) setDateRange(next);
    },
    [fromDate],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const body = await fetchCollectionPerformance(
        buildCollectionPerformanceRequest(company, dateRange, {
          header: branchFilter,
        }),
      );
      setData(normalizeCollectionTargetVsPerformance(body));
    } catch {
      setData(emptyCollectionTargetVsPerformance());
      setLoadError("Unable to load collection performance. Please refresh or try again later.");
    } finally {
      setLoading(false);
    }
  }, [branchFilter, company, dateRange]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const displayData = data;

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
        {loadError ? (
          <Alert color="red" variant="light" mb="md" radius="md" title="Could not load data">
            {loadError}
          </Alert>
        ) : null}

        <CollectionPageHeader
          meta={displayData.meta}
          periodGranularity={periodGranularity}
          onPeriodGranularityChange={handlePeriodGranularityChange}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={handleFromDateChange}
          onToDateChange={handleToDateChange}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          currencyFilter={currencyFilter}
          onCurrencyFilterChange={setCurrencyFilter}
          filterOptions={displayData.filterOptions}
          onRefresh={() => void loadDashboard()}
        />

        <CollectionKpiRow kpis={displayData.kpis} loading={loading} />

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={14} mb={14}>
          <MonthlyTargetCard data={displayData.thisMonth} loading={loading} />
          <DailyCollectionChart data={displayData.dailyCollection} loading={loading} />
        </SimpleGrid>

        <BranchCollectionTable
          rows={displayData.branchPerformance.rows}
          total={displayData.branchPerformance.total}
          loading={loading}
          onRowClick={handleRowClick}
        />
      </Box>

      <CollectionDashboardFirstTrill
        opened={branchDrawerOpened}
        onClose={() => setBranchDrawerOpened(false)}
        branch={selectedBranchForDrawer}
        company={company}
        dateRange={dateRange}
      />
    </Box>
  );
};

export default CollectionTargetvsPerformanceDashboard;
