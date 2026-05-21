import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, SimpleGrid } from "@mantine/core";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { ERP_LIST_FONT_SANS, ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import useAuthStore from "../../../store/authStore";
import type { PeriodGranularity } from "./collectionTargetVsPerformance/components/PeriodPillGroup";
import { ActivityListPanel } from "./financePendingActivities/components/ActivityListPanel";
import { BranchOpenItemsTable } from "./financePendingActivities/components/BranchOpenItemsTable";
import { PendingActivitiesPageHeader } from "./financePendingActivities/components/PendingActivitiesPageHeader";
import { PendingActivityKpiRow } from "./financePendingActivities/components/PendingActivityKpiRow";
import {
  buildPendingActivitiesRequest,
  DEFAULT_TOP_LISTS,
  normalizeDateRange,
  parseApiDate,
  periodToDateRange,
  type PendingActivitiesDateRange,
  type PendingActivitiesTopLists,
} from "./financePendingActivities/financePendingActivitiesApi";
import {
  emptyFinancePendingActivities,
  normalizeFinancePendingActivities,
} from "./financePendingActivities/financePendingActivitiesNormalize";
import type { FinancePendingActivitiesData } from "./financePendingActivities/financePendingActivitiesTypes";
import { PA_PAGE_BG } from "./financePendingActivities/theme";

const FinancePendingActivitiesDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const company = user?.company?.company_name?.trim() || "Pentagon India";

  const [data, setData] = useState<FinancePendingActivitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("month");
  const [dateRange, setDateRange] = useState<PendingActivitiesDateRange>(() =>
    periodToDateRange("month"),
  );
  const [branchFilter, setBranchFilter] = useState<string | null>("all");
  const [ownerFilter, setOwnerFilter] = useState<string | null>("all");
  const [topLists, setTopLists] = useState<PendingActivitiesTopLists>(DEFAULT_TOP_LISTS);

  useEffect(() => {
    setTopLists(DEFAULT_TOP_LISTS);
  }, [dateRange.date_from, dateRange.date_to, branchFilter]);

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
    setError(null);
    try {
      const payload = buildPendingActivitiesRequest({
        company,
        dateRange,
        topLists,
        branchCode: branchFilter === "all" ? null : branchFilter,
      });

      const body = await apiCallProtected.post(URL.dashboard.financePendingActivities, payload);
      setData(normalizeFinancePendingActivities(body, topLists));
    } catch {
      setData(null);
      setError("Unable to load pending activities. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [branchFilter, company, dateRange, topLists]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleInvoicesPageChange = useCallback((index: number) => {
    setTopLists((prev) => ({
      ...prev,
      invoices_to_raise: { ...prev.invoices_to_raise, index },
    }));
  }, []);

  const handleCostsPageChange = useCallback((index: number) => {
    setTopLists((prev) => ({
      ...prev,
      costs_to_book: { ...prev.costs_to_book, index },
    }));
  }, []);

  const handleVouchersPageChange = useCallback((index: number) => {
    setTopLists((prev) => ({
      ...prev,
      vouchers_pending: { ...prev.vouchers_pending, index },
    }));
  }, []);

  const emptyView = emptyFinancePendingActivities();
  const view = data ?? emptyView;
  const showDashboard = data !== null || loading;
  const asOfLabel =
    view.meta.asOfLabel ||
    `Open · ${dayjs().format("D MMM YYYY")}`;

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
        {error ? (
          <Alert color="red" variant="light" mb="md" radius="md" title="Could not load data">
            {error}
          </Alert>
        ) : null}

        {showDashboard ? (
          <>
            <PendingActivitiesPageHeader
              meta={{ ...view.meta, asOfLabel }}
              periodGranularity={periodGranularity}
              onPeriodGranularityChange={handlePeriodGranularityChange}
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={handleFromDateChange}
              onToDateChange={handleToDateChange}
              branchFilter={branchFilter}
              onBranchFilterChange={setBranchFilter}
              ownerFilter={ownerFilter}
              onOwnerFilterChange={setOwnerFilter}
              filterOptions={view.filterOptions}
              onRefresh={() => void loadDashboard()}
            />

            <PendingActivityKpiRow kpis={view.kpis} loading={loading} />

            <BranchOpenItemsTable section={view.byBranch} loading={loading} />

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={14} mb={14}>
              <ActivityListPanel
                panel={view.invoicesPanel}
                loading={loading}
                onPageChange={handleInvoicesPageChange}
              />
              <Box style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <ActivityListPanel
                  panel={view.costsPanel}
                  loading={loading}
                  compact
                  onPageChange={handleCostsPageChange}
                />
                <ActivityListPanel
                  panel={view.vouchersPanel}
                  loading={loading}
                  showTypeColumn
                  compact
                  onPageChange={handleVouchersPageChange}
                />
              </Box>
            </SimpleGrid>
          </>
        ) : null}
      </Box>
    </Box>
  );
};

export default FinancePendingActivitiesDashboard;
