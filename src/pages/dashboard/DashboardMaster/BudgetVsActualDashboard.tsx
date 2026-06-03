import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useLocation, useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { ERPListToolbar } from "../../../components";
import useAuthStore from "../../../store/authStore";
import { useBranchNumberFormat } from "../../../hooks/useBranchNumberFormat";
import { DashboardChartSearch } from "../../../components/DashboardChartSearch";
import { useDashboardChartSearch } from "../../../hooks/useDashboardChartSearch";
import { ActionIcon } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import {
  calculateFinancialYearBudgetRangeForYear,
  getCurrentFinancialYearStart,
  getFilteredBudgetData,
} from "../../../service/dashboard.service";
import SalespersonMonthlyBudget from "./SalespersonMonthlyBudget";

const ERP_FONT_SANS = "'Geist', sans-serif";

type RouteState = {
  company?: string | null;
  type?: "salesperson" | "non-salesperson";
  start_month?: string;
  end_month?: string;
  salesperson?: string | null;
  mode?: string | null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const toTitle = (value: string) =>
  value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");

const getRepBarColor = (pct: number): string => {
  if (pct >= 80) return "#22C55E";
  if (pct >= 60) return "#000080";
  return "#F59E0B";
};

const MODE_BAR_NAVY = "#1E293B";
const MODE_BAR_ORANGE = "#F59E0B";
const MODE_BAR_GREEN = "#22C55E";

function getModeBarColor(modeName: string): string {
  const m = modeName.toLowerCase();
  // Air before LCL so names like "Air LCL" use Monthly Trend actual color (navy).
  if (m.includes("air")) return MODE_BAR_NAVY;
  if (m.includes("custom")) return MODE_BAR_GREEN;
  if (m.includes("lcl")) return MODE_BAR_ORANGE;
  if (m.includes("fcl")) return MODE_BAR_NAVY;
  if (m.includes("rail")) return MODE_BAR_NAVY;
  if (m.includes("road")) return MODE_BAR_ORANGE;
  if (m.includes("warehous")) return MODE_BAR_ORANGE;
  return MODE_BAR_NAVY;
}

/** By Mode · YTD — Air uses same actual/budget colors as Monthly Trend. */
function getByModeActualBarColor(modeName: string): string {
  const m = modeName.toLowerCase();
  if (m.includes("air")) return MODE_BAR_NAVY;
  return getModeBarColor(modeName);
}

const BY_MODE_BUDGET_MARKER = MODE_BAR_ORANGE;
const TREND_CHART_FORECAST = "#64748B";
const TREND_CHART_FORECAST_HOVER = "#475569";

const selectInputStyles = {
  input: {
    height: 30,
    minHeight: 30,
    fontSize: 11,
    borderColor: "#E2E8F0",
    color: "#4A607A",
    fontWeight: 500,
    background: "#FFFFFF",
  },
} as const;

export default function BudgetVsActualDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 62em)");
  const isCompact = useMediaQuery("(max-width: 48em)");
  const user = useAuthStore((state) => state.user);
  const { formatBudgetCrL: formatCrL, numberLocale, isIndianBranch, currencySymbol } =
    useBranchNumberFormat();
  const routeState = (location.state || {}) as RouteState;

  const company = routeState.company?.trim() || user?.company?.company_name || "PENTAGON INDIA";
  const {
    input: searchInput,
    setInput: setSearchInput,
    committed: committedSearch,
    commit: commitSearch,
  } = useDashboardChartSearch();
  const initialYear =
    routeState.start_month?.split("-")[0] ||
    String(getCurrentFinancialYearStart());
  const initialRange = calculateFinancialYearBudgetRangeForYear(
    parseInt(initialYear, 10)
  );

  const [type, setType] = useState<"salesperson" | "non-salesperson">(
    routeState.type || "salesperson"
  );
  const [selectedYear, setSelectedYear] = useState<string | null>(initialYear);
  const [startMonth, setStartMonth] = useState(
    routeState.start_month || initialRange.start_month
  );
  const [endMonth, setEndMonth] = useState(routeState.end_month || initialRange.end_month);
  const salesperson = "";
  const [mode, setMode] = useState(routeState.mode || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [repPageIndex, setRepPageIndex] = useState(0);
  const [repPageLimit] = useState(10);
  const [selectedRepForDrawer, setSelectedRepForDrawer] = useState("");
  const [salespersonDrawerOpened, setSalespersonDrawerOpened] = useState(false);

  const yearOptions = useMemo(() => {
    const current = getCurrentFinancialYearStart();
    return Array.from({ length: 4 }, (_, i) => {
      const y = current - (3 - i);
      return {
        value: String(y),
        label: `FY ${String(y).slice(-2)}-${String(y + 1).slice(-2)}`,
      };
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getFilteredBudgetData({
        type,
        company,
        start_month: startMonth,
        end_month: endMonth,
        ...(committedSearch?.trim() && { search: committedSearch.trim() }),
        by_sales_rep_ytd: {
          index: repPageIndex,
          limit: repPageLimit,
        },
        ...(mode && { mode }),
      } as any);
      setResponse(data);
    } catch (err) {
      console.error("Error loading Budget vs Actual dashboard:", err);
      setError("Unable to load Budget vs Actual dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [
    company,
    endMonth,
    mode,
    repPageIndex,
    repPageLimit,
    startMonth,
    type,
    committedSearch,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setRepPageIndex(0);
  }, [type, company, startMonth, endMonth, mode, salesperson]);

  const summary = response?.summary || {};
  const repRows = response?.by_sales_rep_ytd?.rows || [];
  const monthlyTrend = response?.monthly_trend || [];
  const byMode = response?.by_mode_ytd || [];

  const modeOptions = useMemo(() => {
    const modes = Array.from(
      new Set<string>(byMode.map((row: any) => String(row.mode || "").trim()).filter(Boolean))
    );
    return [{ value: "", label: "All modes" }, ...modes.map((m) => ({ value: m, label: m }))];
  }, [byMode]);

  const repMeta = response?.by_sales_rep_ytd || {};
  const repTotal = toNumber(repMeta.total ?? repMeta.pagination_total ?? repRows.length);
  const hasPrevRepPage = repPageIndex > 0;
  const hasNextRepPage =
    repTotal > 0
      ? (repPageIndex + 1) * repPageLimit < repTotal
      : repRows.length >= repPageLimit;

  const teamSummary = useMemo(() => {
    const rowSummary = response?.by_sales_rep_ytd?.summary;
    if (rowSummary) {
      return {
        budget: toNumber(rowSummary.total_budget),
        actual: toNumber(rowSummary.total_actual),
        variance: toNumber(rowSummary.total_variance),
        achv: toNumber(rowSummary.achievement_pct),
      };
    }
    const budget = repRows.reduce((sum: number, row: any) => sum + toNumber(row.budget), 0);
    const actual = repRows.reduce((sum: number, row: any) => sum + toNumber(row.actual), 0);
    const variance = repRows.reduce((sum: number, row: any) => sum + toNumber(row.variance), 0);
    const achv = budget > 0 ? (actual / budget) * 100 : 0;
    return { budget, actual, variance, achv };
  }, [repRows, response?.by_sales_rep_ytd?.summary]);

  const monthlyTrendOption = useMemo(() => {
    if (!monthlyTrend.length) {
      return {
        title: { text: "No trend data", left: "center", top: "middle", textStyle: { color: "#9CA3AF", fontSize: 12 } },
      };
    }
    const labels = monthlyTrend.map((row: any) => dayjs(`${row.month}-01`).format("MMM"));
    const budget = monthlyTrend.map((row: any) => toNumber(row.budget));
    const actual = monthlyTrend.map((row: any) => toNumber(row.actual));
    const n = monthlyTrend.length;
    const lastIdx = Math.max(0, n - 1);
    const forecastLast = toNumber(monthlyTrend[lastIdx]?.forecast ?? monthlyTrend[lastIdx]?.budget);
    const actualBarData = actual.map((v: number, i: number) => (i === lastIdx ? null : v));
    const forecastBarData = actual.map((_v: number, i: number) =>
      i === lastIdx ? forecastLast || actual[lastIdx] : null
    );

    return {
      textStyle: { fontFamily: ERP_FONT_SANS },
      grid: { top: 22, left: 44, right: 12, bottom: 44 },
      legend: {
        bottom: 4,
        left: 0,
        data: ["Budget", "Actual", "Forecast"],
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 10, color: "#9CA3AF", fontFamily: ERP_FONT_SANS },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: "#E5E7EB" } },
        axisLabel: { fontSize: 10, color: "#9CA3AF", fontFamily: ERP_FONT_SANS },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisLabel: {
          fontSize: 10,
          color: "#9CA3AF",
          fontFamily: ERP_FONT_SANS,
          formatter: (v: number) =>
            isIndianBranch
              ? (v / 1e7).toLocaleString(numberLocale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : (v / 1e6).toLocaleString(numberLocale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
        },
        splitLine: { lineStyle: { color: "#F3F4F6", type: "solid" } },
      },
      series: [
        {
          name: "Budget",
          type: "bar",
          data: budget,
          itemStyle: { color: MODE_BAR_ORANGE, borderRadius: [4, 4, 0, 0] },
          emphasis: {
            itemStyle: { color: "#D97706" },
          },
          barWidth: "52%",
          barGap: "-100%",
          z: 1,
        },
        {
          name: "Actual",
          type: "bar",
          data: actualBarData,
          itemStyle: { color: MODE_BAR_NAVY, borderRadius: [3, 3, 0, 0] },
          emphasis: {
            itemStyle: { color: "#0F172A" },
          },
          barWidth: "34%",
          barGap: "-100%",
          z: 2,
        },
        {
          name: "Forecast",
          type: "bar",
          data: forecastBarData,
          itemStyle: { color: TREND_CHART_FORECAST, borderRadius: [3, 3, 0, 0] },
          emphasis: {
            itemStyle: { color: TREND_CHART_FORECAST_HOVER },
          },
          barWidth: "34%",
          barGap: "-100%",
          z: 2,
        },
        {
          name: "Trend line",
          type: "line",
          data: actual,
          smooth: 0.35,
          symbol: "circle",
          symbolSize: 4,
          showSymbol: n <= 14,
          lineStyle: { color: "#0EA5E9", width: 2 },
          itemStyle: { color: "#0EA5E9" },
          z: 3,
        },
      ],
      tooltip: {
        trigger: "axis",
        textStyle: { fontFamily: ERP_FONT_SANS, fontSize: 12 },
      },
    };
  }, [monthlyTrend, isIndianBranch, numberLocale]);

  const fyLabel = `FY ${selectedYear?.slice(-2)}-${String(Number(selectedYear) + 1).slice(-2)}`;
  const achYtd = toNumber(summary.achievement_pct);
  const varYtd = toNumber(summary.variance_ytd);
  const forecastStatusStr = String(summary.forecast_status || "on_track").toLowerCase();
  const forecastOnTrack =
    forecastStatusStr.includes("track") ||
    forecastStatusStr.includes("on") ||
    !forecastStatusStr.includes("risk");

  return (
    <Box
      bg="#F8F9FA"
      mx={{ base: -12, sm: -16, lg: -24 }}

      mih={400}
      style={{
        fontFamily: ERP_FONT_SANS,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <Stack gap={10}>
        <ERPListToolbar
          bleed={false}
          leading={
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0, paddingLeft: 10, paddingRight: 15 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Back"
                onClick={() => navigate(-1)}
              >
                <IconArrowLeft size={18} stroke={2} />
              </ActionIcon>
              <Box style={{ minWidth: 0 }}>
              {/* <Text fz={11} fw={600} c="#7B8DA5" mb={5} style={{ lineHeight: 1.35 }}>
                Pentagon Freight › Sales › Budget vs Actual
              </Text> */}
              <Text  c="#111827" style={{ fontSize: "clamp(14px, 5vw, 20px)", lineHeight: 1.08, fontFamily: "Geist", fontWeight: 550 }} mb={4}>
                Budget vs Actual
              </Text>
              <Text fz={11} fw={600} c="#8AA0B9" style={{ lineHeight: 1.4 }}>
                {fyLabel} · {formatCrL(summary.budget_ytd)} team target · {achYtd.toFixed(1)}% achieved YTD
              </Text>
              </Box>
            </Group>
          }
          actions={
            <Box style={{ minWidth: isCompact ? 320 : 420, paddingRight: 10 }}>

              <Group gap={8} wrap="wrap" style={{ width: "100%", justifyContent: isCompact ? "stretch" : "flex-end" }}>
              <SegmentedControl
                size="xs"
                value={type}
                onChange={(value) => setType(value as "salesperson" | "non-salesperson")}
                data={[
                  { label: "Sales", value: "salesperson" },
                  { label: "Non-sales", value: "non-salesperson" },
                ]}
              />
                <Select
                  size="xs"
                  radius={6}
                  data={yearOptions}
                  value={selectedYear}
                  onChange={(value) => {
                    if (!value) return;
                    setSelectedYear(value);
                    const range = calculateFinancialYearBudgetRangeForYear(parseInt(value, 10));
                    setStartMonth(range.start_month);
                    setEndMonth(range.end_month);
                  }}
                  style={{ flex: isCompact ? "1 1 calc(50% - 4px)" : "1 1 118px", minWidth: isCompact ? 0 : 100 }}
                  styles={selectInputStyles}
                />
                <Select
                  size="xs"
                  radius={6}
                  data={modeOptions}
                  value={mode}
                  onChange={(v) => setMode(v || "")}
                  style={{ flex: isCompact ? "1 1 calc(50% - 4px)" : "1 1 120px", minWidth: isCompact ? 0 : 100 }}
                  styles={selectInputStyles}
                />
              <Box
                style={{
                  width: "clamp(200px, 20vw, 280px)",
                  minWidth: 200,
                  flexShrink: 0,
                }}
              >
                <DashboardChartSearch
                  value={searchInput}
                  onChange={setSearchInput}
                  onCommit={commitSearch}
                  onClear={() => commitSearch("")}
                  placeholder="Search customer / salesperson"
                />
              </Box>
                {/* <Button
                  size="xs"
                  radius={6}
                  variant="default"
                  style={{
                    flex: isCompact ? "1 1 100%" : "1 1 88px",
                    minWidth: isCompact ? 0 : undefined,
                  }}
                  styles={{
                    root: {
                      height: 30,
                      fontSize: 11,
                      fontWeight: 700,
                      borderColor: "#E2E8F0",
                      color: "#1E293B",
                      background: "#FFFFFF",
                    },
                  }}
                >
                  Export
                </Button> */}
              </Group>
            </Box>
          }
        />

        <Stack gap={8}>
          {/* <SegmentedControl
            size="xs"
            value={type}
            onChange={(value) => setType(value as "salesperson" | "non-salesperson")}
            data={[
              { label: "Sales", value: "salesperson" },
              { label: "Non-sales", value: "non-salesperson" },
            ]}
            fullWidth={isCompact}
            styles={{
              root: { maxWidth: isCompact ? "100%" : 360 },
              label: { fontSize: 11, fontWeight: 600 },
            }}
          /> */}
          <Group gap={8} wrap="wrap" align="center" style={{ width: "100%" ,}}>
            {/* <Select
              size="xs"
              radius={6}
              w={isCompact ? undefined : 120}
              style={{ flex: isCompact ? "1 1 calc(50% - 4px)" : undefined, minWidth: isCompact ? 0 : 120 }}
              data={monthOptions}
              value={startMonth}
              onChange={(v) => v && setStartMonth(v)}
              styles={selectInputStyles}
            />
            <Select
              size="xs"
              radius={6}
              w={isCompact ? undefined : 120}
              style={{ flex: isCompact ? "1 1 calc(50% - 4px)" : undefined, minWidth: isCompact ? 0 : 120 }}
              data={monthOptions}
              value={endMonth}
              onChange={(v) => v && setEndMonth(v)}
              styles={selectInputStyles}
            /> */}
            {/* <Select
              size="xs"
              radius={6}
              w={isCompact ? undefined : 140}
              style={{ flex: isCompact ? "1 1 100%" : "1 1 140px", minWidth: isCompact ? 0 : 130 }}
              data={salespersonOptions}
              value={salesperson}
              onChange={(v) => setSalesperson(v || "")}
              styles={selectInputStyles}
            /> */}
            {/* <Button
              size="xs"
              radius={6}
              onClick={() => void fetchData()}
              style={{ flex: isCompact ? "1 1 100%" : "1 1 88px" }}
              styles={{
                root: {
                  background: "#101C2E",
                  height: 30,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#FFFFFF",
                },
              }}
            >
              Apply
            </Button> */}
          </Group>
        </Stack>

        <Grid gutter={{ base: 8, sm: 10 }} style={{ paddingLeft: 10, paddingRight: 10 }}>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card
              radius={8}
              p={{ base: "10px 12px", sm: 12 }}
              withBorder
              style={{
                borderColor: "#E9ECEF",
                background: "#FFFFFF",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <Text size="10px" fw={700} c="#64748B" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                Budget YTD
              </Text>
              <Text fw={800} fz={isCompact ? 24 : 28} c="#111827" mt={4} style={{ lineHeight: 1.1 }}>
                {formatCrL(summary.budget_ytd)}
              </Text>
              <Text size="11px" c="#94A3B8" fw={600} mt={4}>
                Plan
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card
              radius={8}
              p={{ base: "10px 12px", sm: 12 }}
              withBorder
              style={{
                borderColor: "#E9ECEF",
                background: "#FFFFFF",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <Text size="10px" fw={700} c="#64748B" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                Actual YTD
              </Text>
              <Text fw={800} fz={isCompact ? 24 : 28} c="#111827" mt={4} style={{ lineHeight: 1.1 }}>
                {formatCrL(summary.actual_ytd)}
              </Text>
              <Text size="11px" fw={700} c={varYtd < 0 ? "#DC2626" : "#16A34A"} mt={4}>
                {varYtd < 0 ? "▼ " : "▲ "}
                {formatCrL(summary.variance_ytd)}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card
              radius={8}
              p={{ base: "10px 12px", sm: 12 }}
              withBorder
              style={{
                borderColor: "#E9ECEF",
                background: "#FFFFFF",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <Text size="10px" fw={700} c="#64748B" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                Achievement
              </Text>
              <Text fw={800} fz={isCompact ? 24 : 28} c="#111827" mt={4} style={{ lineHeight: 1.1 }}>
                {achYtd.toFixed(1)}%
              </Text>
              <Text size="11px" fw={700} c={achYtd < 100 ? "#DC2626" : "#16A34A"} mt={4}>
                {achYtd < 100 ? "▼ vs. 100% plan" : "▲ on plan"}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card
              radius={8}
              p={{ base: "10px 12px", sm: 12 }}
              withBorder
              style={{
                borderColor: "#E9ECEF",
                background: "#FFFFFF",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <Text size="10px" fw={700} c="#64748B" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                Forecast FY-end
              </Text>
              <Text fw={800} fz={isCompact ? 24 : 28} c="#111827" mt={4} style={{ lineHeight: 1.1 }}>
                {formatCrL(summary.forecast_fy_end)}
              </Text>
              <Text size="11px" fw={700} c={forecastOnTrack ? "#16A34A" : "#DC2626"} mt={4}>
                {forecastOnTrack ? "▲ on track" : "▼ " + toTitle(String(summary.forecast_status || "at risk"))}
              </Text>
            </Card>
          </Grid.Col>
        </Grid>

        {error && <Alert color="red">{error}</Alert>}
        {isLoading && (
          <Group justify="center" py="xl">
            <Loader color="#105476" />
          </Group>
        )}

        {!isLoading && (
          <Grid gutter={{ base: 8, sm: 10 }} style={{ paddingLeft: 10, paddingRight: 10 }}>
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Card
                radius={8}
                p={{ base: 10, sm: 12 }}
                withBorder
                style={{
                  borderColor: "#E9ECEF",
                  background: "#FFFFFF",
                  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                }}
              >
                <Group gap={8} mb={10} wrap="wrap" align="baseline">
                  <Text fw={700} fz={14} c="#111827" style={{ lineHeight: 1.2 }}>
                    By Sales Rep · YTD
                  </Text>
                  <Text fz={11} c="#9CA3AF" fw={600}>
                    Actual (solid) vs Budget (marker)
                  </Text>
                </Group>

                <Box style={{ overflowX: "auto" }}>
                  <Box style={{ minWidth: isCompact ? 620 : undefined }}>
                    <Grid columns={24} mb={8}>
                      <Grid.Col span={5} style={{ paddingLeft: 20 }}>
                        <Text fz={10} fw={700} c="#94A3B8" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                          Rep
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text fz={10} fw={700} c="#94A3B8" ta="center" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                          Budget
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text fz={10} fw={700} c="#94A3B8" ta="center" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                          Actual
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={6} />
                      <Grid.Col span={4}>
                        <Text fz={10} fw={700} c="#94A3B8" ta="center" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                          Variance
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text fz={10} fw={700} c="#94A3B8" ta="center" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                          Achvd.
                        </Text>
                      </Grid.Col>
                    </Grid>

                    <Stack gap={0}>
                      {repRows.map((row: any, idx: number) => {
                        const budget = toNumber(row.budget);
                        const actual = toNumber(row.actual);
                        const variance = toNumber(row.variance);
                        const achv = toNumber(row.achievement_pct);
                        const maxBase = Math.max(budget, actual, 1);
                        const actualPct = clamp((actual / maxBase) * 100, 0, 100);
                        const markerPct = clamp((budget / maxBase) * 100, 0, 100);
                        const barColor = getRepBarColor(achv);
                        return (
                          <Box
                            key={`${row.sno}-${row.sales_person}`}
                            py={10}
                            style={{
                              borderTop: idx === 0 ? "1px solid #E9ECEF" : "none",
                              borderBottom: "1px solid #E9ECEF",
                              cursor: "pointer",
                              transition: "background-color 120ms ease",
                            }}
                            onClick={() => {
                              const selectedRep = String(row.sales_person || "").trim();
                              if (!selectedRep) return;
                              setSelectedRepForDrawer(selectedRep);
                              setSalespersonDrawerOpened(true);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#F8FAFC";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#FFFFFF";
                            }}
                          >
                            <Grid columns={24} align="center">
                              <Grid.Col span={5} style={{ paddingLeft: 20 }}>
                                <Text fw={700} fz={12} c="#111827" lineClamp={1}>
                                  {row.sales_person}
                                </Text>
                                {/* <Text fz={10} c="#9CA3AF" lineClamp={1}>
                                  {roleLabel}
                                </Text> */}
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <Text fw={600} fz={12} c="#64748B" ta="center">
                                  {formatCrL(budget)}
                                </Text>
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <Text fw={700} fz={12} c="#111827" ta="center" style={{ whiteSpace: "nowrap" }}>
                                  {formatCrL(actual)}
                                </Text>
                              </Grid.Col>
                              <Grid.Col span={6}>
                                <Box
                                  style={{
                                    position: "relative",
                                    height: 18,
                                    borderRadius: 9999,
                                    background: "#E5E7EB",
                                    overflow: "hidden",
                                  }}
                                >
                                  <Box
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      background:
                                        "repeating-linear-gradient(135deg, #E5E7EB 0, #E5E7EB 5px, #F3F4F6 5px, #F3F4F6 10px)",
                                    }}
                                  />
                                  <Box
                                    style={{
                                      position: "absolute",
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: `${actualPct}%`,
                                      background: barColor,
                                      borderRadius: 9999,
                                    }}
                                  />
                                  {/* <Box
                                    style={{
                                      position: "absolute",
                                      left: `calc(${markerPct}% - 1px)`,
                                      top: 0,
                                      bottom: 0,
                                      width: 2,
                                      background: "#111827",
                                      zIndex: 2,
                                    }}
                                  /> */}
                                </Box>
                              </Grid.Col>
                              <Grid.Col span={4}>
                                <Text
                                  fw={700}
                                  fz={12}
                                  c={variance < 0 ? "#DC2626" : "#16A34A"}
                                  ta="center"
                                >
                                  {variance > 0 ? "+" : ""}
                                  {formatCrL(variance)}
                                </Text>
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <Text fw={700} fz={12} c="#374151" ta="center">
                                  {Math.round(achv)}%
                                </Text>
                              </Grid.Col>
                            </Grid>
                          </Box>
                        );
                      })}
                    </Stack>

                    <Group justify="space-between" mt={8} mb={6}>
                      <Text fz={11} fw={600} c="#94A3B8">
                        Page {repPageIndex + 1}
                        {repTotal > 0
                          ? ` · Showing ${repPageIndex * repPageLimit + 1}-${Math.min(
                              (repPageIndex + 1) * repPageLimit,
                              repTotal
                            )} of ${repTotal}`
                          : ""}
                      </Text>
                      <Group gap={6}>
                        <Button
                          size="xs"
                          radius={6}
                          variant="default"
                          disabled={!hasPrevRepPage}
                          onClick={() => setRepPageIndex((prev) => Math.max(0, prev - 1))}
                          styles={{
                            root: {
                              height: 28,
                              borderColor: "#E2E8F0",
                              background: "#FFFFFF",
                              color: "#1E293B",
                              fontSize: 11,
                              fontWeight: 700,
                            },
                          }}
                        >
                          Prev
                        </Button>
                        <Button
                          size="xs"
                          radius={6}
                          variant="default"
                          disabled={!hasNextRepPage}
                          onClick={() => setRepPageIndex((prev) => prev + 1)}
                          styles={{
                            root: {
                              height: 28,
                              borderColor: "#E2E8F0",
                              background: "#FFFFFF",
                              color: "#1E293B",
                              fontSize: 11,
                              fontWeight: 700,
                            },
                          }}
                        >
                          Next
                        </Button>
                      </Group>
                    </Group>

                    <Divider my={10} size="sm" style={{ borderTop: "2px solid #111827" }} />
                    <Grid columns={24} align="center" style={{ paddingLeft: 20 }}>
                      <Grid.Col span={5}>
                        <Text fw={800} fz={12} c="#111827">
                          Team Total
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text fw={700} fz={12} c="#64748B" ta="center">
                          {formatCrL(teamSummary.budget)}
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text fw={700} fz={12} c="#111827" ta="center" style={{ whiteSpace: "nowrap" }}>
                          {formatCrL(teamSummary.actual)}
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        {(() => {
                          const tb = teamSummary.budget;
                          const ta = teamSummary.actual;
                          const maxBase = Math.max(tb, ta, 1);
                          const actualPct = clamp((ta / maxBase) * 100, 0, 100);
                          const markerPct = clamp((tb / maxBase) * 100, 0, 100);
                          const teamBar = getRepBarColor(teamSummary.achv);
                          return (
                            <Box
                              style={{
                                position: "relative",
                                height: 18,
                                borderRadius: 9999,
                                background: "#E5E7EB",
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  background:
                                    "repeating-linear-gradient(135deg, #E5E7EB 0, #E5E7EB 5px, #F3F4F6 5px, #F3F4F6 10px)",
                                }}
                              />
                              <Box
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: `${actualPct}%`,
                                  background: teamBar,
                                  borderRadius: 9999,
                                }}
                              />
                              {/* <Box
                                style={{
                                  position: "absolute",
                                  left: `calc(${markerPct}% - 1px)`,
                                  top: 0,
                                  bottom: 0,
                                  width: 2,
                                  background: "#111827",
                                  zIndex: 2,
                                }}
                              /> */}
                            </Box>
                          );
                        })()}
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <Text
                          fw={800}
                          fz={12}
                          c={teamSummary.variance < 0 ? "#DC2626" : "#16A34A"}
                          ta="center"
                        >
                          {teamSummary.variance > 0 ? "+" : ""}
                          {formatCrL(teamSummary.variance)}
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text fw={800} fz={12} c="#374151" ta="center">
                          {teamSummary.achv.toFixed(1)}%
                        </Text>
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Box>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Stack gap={10}>
                <Card
                  radius={8}
                  p={{ base: 10, sm: 12 }}
                  withBorder
                  style={{
                    borderColor: "#E9ECEF",
                    background: "#FFFFFF",
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                  }}
                >
                  <Group gap={8} mb={8} wrap="wrap" align="baseline">
                    <Text fw={700} fz={14} c="#111827" style={{ lineHeight: 1.2 }}>
                      Monthly Trend
                    </Text>
                    <Text fz={11} c="#9CA3AF" fw={600}>
                      {fyLabel} · {currencySymbol}{" "}
                    </Text>
                  </Group>
                  <Box h={isCompact ? 220 : isMobile ? 240 : 280}>
                    <ReactECharts option={monthlyTrendOption} style={{ height: "100%", width: "100%" }} />
                  </Box>
                </Card>

                <Card
                  radius={8}
                  p={{ base: 10, sm: 12 }}
                  withBorder
                  style={{
                    borderColor: "#E9ECEF",
                    background: "#FFFFFF",
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                  }}
                >
                  <Group gap={8} mb={10} wrap="wrap" align="baseline">
                    <Text fw={700} fz={14} c="#111827" style={{ lineHeight: 1.2 }}>
                      By Mode · YTD
                    </Text>
                    <Text fz={11} c="#9CA3AF" fw={600}>
                      Marker = budget target
                    </Text>
                  </Group>
                  <Stack gap={isCompact ? 10 : 12}>
                    {byMode.map((row: any) => {
                      const budget = toNumber(row.budget);
                      const actual = toNumber(row.actual);
                      const base = Math.max(budget, actual, 1);
                      const actualPct = clamp((actual / base) * 100, 0, 100);
                      const markerPct = clamp((budget / base) * 100, 0, 100);
                      const modeName = String(row.mode || "Unknown");
                      const color = getByModeActualBarColor(modeName);
                      return (
                        <Group key={modeName} justify="space-between" wrap="nowrap" gap={10} align="center">
                          <Text
                            fz={12}
                            fw={600}
                            c="#374151"
                            style={{ minWidth: isCompact ? 72 : 96, flex: "0 0 auto" }}
                            lineClamp={1}
                          >
                            {modeName}
                          </Text>
                          <Box
                            style={{
                              flex: 1,
                              minWidth: 48,
                              height: 18,
                              borderRadius: 9999,
                              // background: "#EEF2F7",
                              background: MODE_BAR_ORANGE,
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            <Box
                              style={{
                                height: "100%",
                                width: `${actualPct}%`,
                                background: color,
                                borderRadius: 9999,
                              }}
                            />
                            {/* <Box
                              style={{
                                position: "absolute",
                                left: `calc(${markerPct}% - 1px)`,
                                top: 0,
                                bottom: 0,
                                width: 2,
                                background: BY_MODE_BUDGET_MARKER,
                                zIndex: 2,
                              }}
                            /> */}
                          </Box>
                          <Text
                            fz={11}
                            fw={700}
                            c="#111827"
                            style={{
                              minWidth: isCompact ? 100 : 118,
                              flex: "0 0 auto",
                              textAlign: "right",
                            }}
                          >
                            {formatCrL(actual)} / {formatCrL(budget)}
                          </Text>
                        </Group>
                      );
                    })}
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
      <SalespersonMonthlyBudget
        opened={salespersonDrawerOpened}
        onClose={() => setSalespersonDrawerOpened(false)}
        company={company}
        salesperson={selectedRepForDrawer}
        startMonth={startMonth}
        endMonth={endMonth}
        type={type}
      />
    </Box>
  );
}
