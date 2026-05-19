import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Flex } from "@mantine/core";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { ERP_LIST_FONT_SANS, ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import type { PeriodGranularity } from "./collectionTargetVsPerformance/components/PeriodPillGroup";
import { AgeingSummaryBar } from "./financeOutstandingAgeing/components/AgeingSummaryBar";
import { OutstandingPageHeader } from "./financeOutstandingAgeing/components/OutstandingPageHeader";
import { OutstandingTable } from "./financeOutstandingAgeing/components/OutstandingTable";
import { PartyTabs, ViewToggle } from "./financeOutstandingAgeing/components/PartyTabs";
import { FINANCE_OUTSTANDING_AGEING_MOCK } from "./financeOutstandingAgeing/financeOutstandingAgeingMock";
import { getPartySlice, normalizeFinanceOutstandingAgeing } from "./financeOutstandingAgeing/financeOutstandingAgeingNormalize";
import type {
  FinanceOutstandingAgeingData,
  OutstandingPartyType,
  OutstandingViewMode,
} from "./financeOutstandingAgeing/financeOutstandingAgeingTypes";
import { OST_PAGE_BG } from "./financeOutstandingAgeing/theme";

const FinanceOutstandingAndAgeingDashboard: React.FC = () => {
  const [data, setData] = useState<FinanceOutstandingAgeingData>(FINANCE_OUTSTANDING_AGEING_MOCK);
  const [loading, setLoading] = useState(true);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("month");
  const [branchFilter, setBranchFilter] = useState<string | null>("all");
  const [riskFilter, setRiskFilter] = useState<string | null>("all");
  const [partyType, setPartyType] = useState<OutstandingPartyType>("customer");
  const [viewMode, setViewMode] = useState<OutstandingViewMode>("branch");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCallProtected.post(URL.dashboard.financeOutstandingAgeing, {
        period: periodGranularity,
        branch: branchFilter === "all" ? null : branchFilter,
        risk: riskFilter === "all" ? null : riskFilter,
        party_type: partyType,
        view: viewMode,
      });
      setData(normalizeFinanceOutstandingAgeing(response.data));
      setApiNotice(null);
    } catch {
      setData(FINANCE_OUTSTANDING_AGEING_MOCK);
      setApiNotice(
        "Live outstanding & ageing data is not available yet. Showing reference layout with demo figures until the API responds.",
      );
    } finally {
      setLoading(false);
    }
  }, [branchFilter, periodGranularity, partyType, riskFilter, viewMode]);

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
        {apiNotice ? (
          <Alert color="yellow" variant="light" mb="md" radius="md" title="Demo data">
            {apiNotice}
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
          <PartyTabs data={data} value={partyType} onChange={setPartyType} />
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
          <AgeingSummaryBar buckets={partySlice.ageingBuckets} />
          <OutstandingTable
            section={tableSection}
            viewMode={viewMode}
            partyLabel={partyColumnLabel}
            loading={loading}
            embedded
          />
        </Box>
      </Box>
    </Box>
  );
};

export default FinanceOutstandingAndAgeingDashboard;
