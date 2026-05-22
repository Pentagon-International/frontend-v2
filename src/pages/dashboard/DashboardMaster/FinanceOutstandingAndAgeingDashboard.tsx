import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Flex, Skeleton } from "@mantine/core";
import { ERP_LIST_FONT_SANS, ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import useAuthStore from "../../../store/authStore";
import type { PeriodGranularity } from "./collectionTargetVsPerformance/components/PeriodPillGroup";
import { AgeingSummaryBar } from "./financeOutstandingAgeing/components/AgeingSummaryBar";
import { OutstandingPageHeader } from "./financeOutstandingAgeing/components/OutstandingPageHeader";
import { OutstandingTable } from "./financeOutstandingAgeing/components/OutstandingTable";
import { ViewToggle } from "./financeOutstandingAgeing/components/PartyTabs";
import { fetchOutstandingAgeing } from "./financeOutstandingAgeing/financeOutstandingAgeingApi";
import {
  emptyFinanceOutstandingAgeing,
  getPartySlice,
  normalizeFinanceOutstandingAgeing,
} from "./financeOutstandingAgeing/financeOutstandingAgeingNormalize";
import type {
  FinanceOutstandingAgeingData,
  OutstandingPartyType,
  OutstandingViewMode,
} from "./financeOutstandingAgeing/financeOutstandingAgeingTypes";
import { OST_PAGE_BG } from "./financeOutstandingAgeing/theme";

const PAGE_LIMIT = 15;

const FinanceOutstandingAndAgeingDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const company = user?.company?.company_name || "PENTAGON INDIA";

  const [data, setData] = useState<FinanceOutstandingAgeingData>(
    emptyFinanceOutstandingAgeing(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("month");
  const [branchFilter, setBranchFilter] = useState<string | null>("all");
  const [riskFilter, setRiskFilter] = useState<string | null>("all");
  const [partyType] = useState<OutstandingPartyType>("customer");
  const [viewMode, setViewMode] = useState<OutstandingViewMode>("branch");
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [viewMode, branchFilter, riskFilter]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const body = await fetchOutstandingAgeing({
        company,
        branch: viewMode === "branch",
        index: pageIndex,
        limit: PAGE_LIMIT,
        risk: riskFilter === "all" ? null : riskFilter,
        location: branchFilter === "all" ? null : branchFilter,
      });
      setData(normalizeFinanceOutstandingAgeing(body, viewMode));
    } catch {
      setData(emptyFinanceOutstandingAgeing());
      setLoadError(
        "Unable to load outstanding & ageing data. Please refresh or try again later.",
      );
    } finally {
      setLoading(false);
    }
  }, [branchFilter, company, pageIndex, riskFilter, viewMode]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const partySlice = useMemo(() => getPartySlice(data, partyType), [data, partyType]);
  const tableSection = viewMode === "branch" ? partySlice.byBranch : partySlice.byParty;
  const partyColumnLabel = partyType === "agent" ? "Agent" : "Customer";

  return (
    <Box
      className={ERP_LIST_GEIST_ROOT_CLASS}
      style={{
        background: OST_PAGE_BG,
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

        <OutstandingPageHeader
          meta={data.meta}
          periodGranularity={periodGranularity}
          onPeriodGranularityChange={setPeriodGranularity}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          riskFilter={riskFilter}
          onRiskFilterChange={setRiskFilter}
          filterOptions={data.filterOptions}
          onRefresh={() => void loadDashboard()}
        />

        <Flex align="center" gap={12} wrap="wrap" mb={14}>
          {/* <PartyTabs data={data} value={partyType} onChange={setPartyType} /> */}
          <Box style={{ flex: 1, minWidth: 8 }} />
          <ViewToggle
            value={viewMode}
            onChange={setViewMode}
            partyLabel={partyColumnLabel}
          />
        </Flex>

        <Box
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "16px 18px 8px",
          }}
        >
          {loading ? (
            <Skeleton height={88} mb={16} radius="md" />
          ) : (
            <AgeingSummaryBar buckets={partySlice.ageingBuckets} currency={data.currency} />
          )}
          <OutstandingTable
            section={tableSection}
            viewMode={viewMode}
            partyLabel={partyColumnLabel}
            currency={data.currency}
            loading={loading}
            embedded
          />
        </Box>
      </Box>
    </Box>
  );
};

export default FinanceOutstandingAndAgeingDashboard;
