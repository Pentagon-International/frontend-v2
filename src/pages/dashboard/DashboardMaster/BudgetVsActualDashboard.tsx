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
import { useLocation } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import useAuthStore from "../../../store/authStore";
import {
  calculateFinancialYearBudgetRangeForYear,
  getFilteredBudgetData,
} from "../../../service/dashboard.service";

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

const formatCrL = (value: unknown): string => {
  const amount = toNumber(value);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const toTitle = (value: string) =>
  value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");

const getRepBarColor = (pct: number): string => {
  if (pct >= 100) return "#16A34A";
  if (pct >= 90) return "#173A6B";
  return "#D97706";
};

function getCurrentFinancialYearStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? String(year) : String(year - 1);
}

function getFinancialMonthOptions(selectedYear: string | null) {
  const baseYear = selectedYear
    ? parseInt(selectedYear, 10)
    : parseInt(getCurrentFinancialYearStart(), 10);
  const options: Array<{ value: string; label: string }> = [];
  for (let month = 4; month <= 12; month += 1) {
    options.push({
      value: `${baseYear}-${String(month).padStart(2, "0")}`,
      label: dayjs(`${baseYear}-${String(month).padStart(2, "0")}-01`).format("MMM YYYY"),
    });
  }
  for (let month = 1; month <= 3; month += 1) {
    options.push({
      value: `${baseYear + 1}-${String(month).padStart(2, "0")}`,
      label: dayjs(`${baseYear + 1}-${String(month).padStart(2, "0")}-01`).format("MMM YYYY"),
    });
  }
  return options;
}

export default function BudgetVsActualDashboard() {
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 62em)");
  const user = useAuthStore((state) => state.user);
  const routeState = (location.state || {}) as RouteState;

  const company = routeState.company?.trim() || user?.company?.company_name || "PENTAGON INDIA";
  const initialYear = routeState.start_month?.split("-")[0] || getCurrentFinancialYearStart();
  const initialRange = calculateFinancialYearBudgetRangeForYear(parseInt(initialYear, 10));

  const [type, setType] = useState<"salesperson" | "non-salesperson">(
    routeState.type || "salesperson"
  );
  const [selectedYear, setSelectedYear] = useState<string | null>(initialYear);
  const [startMonth, setStartMonth] = useState(
    routeState.start_month || initialRange.start_month
  );
  const [endMonth, setEndMonth] = useState(routeState.end_month || initialRange.end_month);
  const [salesperson, setSalesperson] = useState(routeState.salesperson || "");
  const [mode, setMode] = useState(routeState.mode || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);

  const monthOptions = useMemo(() => getFinancialMonthOptions(selectedYear), [selectedYear]);
  const yearOptions = useMemo(() => {
    const current = parseInt(getCurrentFinancialYearStart(), 10);
    return Array.from({ length: 4 }, (_, i) => {
      const y = String(current - (3 - i));
      return { value: y, label: `FY ${y.slice(-2)}-${String(Number(y) + 1).slice(-2)}` };
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
        ...(salesperson && { salesperson }),
        ...(mode && { mode }),
      } as any);
      setResponse(data);
    } catch (err) {
      console.error("Error loading Budget vs Actual dashboard:", err);
      setError("Unable to load Budget vs Actual dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [company, endMonth, mode, salesperson, startMonth, type]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const summary = response?.summary || {};
  const repRows = response?.by_sales_rep_ytd?.rows || [];
  const monthlyTrend = response?.monthly_trend || [];
  const byMode = response?.by_mode_ytd || [];

  const salespersonOptions = useMemo(() => {
    const names = Array.from(
      new Set<string>(
        repRows.map((row: any) => String(row.sales_person || "").trim()).filter(Boolean)
      )
    );
    return [{ value: "", label: "All reps" }, ...names.map((n) => ({ value: n, label: n }))];
  }, [repRows]);

  const modeOptions = useMemo(() => {
    const modes = Array.from(
      new Set<string>(byMode.map((row: any) => String(row.mode || "").trim()).filter(Boolean))
    );
    return [{ value: "", label: "All modes" }, ...modes.map((m) => ({ value: m, label: m }))];
  }, [byMode]);

  const filteredRepRows = useMemo(
    () => repRows.filter((row: any) => !salesperson || row.sales_person === salesperson),
    [repRows, salesperson]
  );

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
    const budget = filteredRepRows.reduce((sum: number, row: any) => sum + toNumber(row.budget), 0);
    const actual = filteredRepRows.reduce((sum: number, row: any) => sum + toNumber(row.actual), 0);
    const variance = filteredRepRows.reduce((sum: number, row: any) => sum + toNumber(row.variance), 0);
    const achv = budget > 0 ? (actual / budget) * 100 : 0;
    return { budget, actual, variance, achv };
  }, [filteredRepRows, response?.by_sales_rep_ytd?.summary]);

  const monthlyTrendOption = useMemo(() => {
    const labels = monthlyTrend.map((row: any) => dayjs(`${row.month}-01`).format("MMM"));
    const budget = monthlyTrend.map((row: any) => toNumber(row.budget));
    const actual = monthlyTrend.map((row: any) => toNumber(row.actual));
    const forecast = budget.map((value: number, i: number) =>
      i >= actual.length - 2 ? value : null
    );
    return {
      grid: { top: 18, left: 42, right: 14, bottom: 30 },
      legend: { bottom: 0, itemWidth: 10, textStyle: { fontSize: 11, color: "#8AA0B9" } },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { fontSize: 10, color: "#8AA0B9" },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          fontSize: 10,
          color: "#8AA0B9",
          formatter: (v: number) => (v / 10000000).toFixed(2),
        },
        splitLine: { lineStyle: { color: "#EEF2F7" } },
      },
      series: [
        {
          name: "Budget",
          type: "bar",
          data: budget,
          itemStyle: { color: "#E5EDF6" },
          barWidth: 12,
          barGap: "-100%",
          z: 1,
        },
        {
          name: "Actual",
          type: "bar",
          data: actual,
          itemStyle: { color: "#173A6B" },
          barWidth: 10,
          z: 2,
        },
        {
          name: "Forecast",
          type: "line",
          data: forecast,
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#16A3F0", width: 3 },
          z: 3,
        },
      ],
      tooltip: { trigger: "axis" },
    };
  }, [monthlyTrend]);

  return (
    <Box
      bg="#F8FAFC"
      mx={{ base: -12, sm: -16, lg: -24 }}
      px={{ base: 12, sm: 16, lg: 20 }}
      py={{ base: 12, sm: 16, lg: 24 }}
      style={{ fontFamily: ERP_FONT_SANS }}
    >
      <Stack gap={10}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap={8}>
          <Box>
            <Text fz={11} fw={600} c="#7B8DA5">
              Pentagon Freight › Sales › Budget vs Actual
            </Text>
            <Text fw={700} c="#0B1F3A" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
              Budget vs Actual
            </Text>
            <Text fz={11} c="#8AA0B9" fw={600}>
              FY {selectedYear?.slice(-2)}-{String(Number(selectedYear) + 1).slice(-2)} ·{" "}
              {formatCrL(summary.budget_ytd)} team target ·{" "}
              {toNumber(summary.achievement_pct).toFixed(1)}% achieved YTD
            </Text>
          </Box>

          <Group gap={8} wrap="wrap">
            <Button
              size="xs"
              styles={{ root: { background: "#101C2E", height: 30, fontWeight: 700 } }}
            >
              FY {selectedYear?.slice(-2)}-{String(Number(selectedYear) + 1).slice(-2)}
            </Button>
            <Select
              size="xs"
              w={95}
              data={[
                { value: "salesperson", label: "By Rep" },
                { value: "non-salesperson", label: "Non-sales" },
              ]}
              value={type}
              onChange={(value) => value && setType(value as "salesperson" | "non-salesperson")}
            />
            <Select size="xs" w={110} data={modeOptions} value={mode} onChange={(v) => setMode(v || "")} />
            <Button
              size="xs"
              variant="outline"
              styles={{ root: { height: 30, borderColor: "#E2E8F0", color: "#1E293B" } }}
            >
              Export
            </Button>
          </Group>

          <Group gap={8} wrap="wrap">
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
              w={110}
              data={yearOptions}
              value={selectedYear}
              onChange={(value) => {
                if (!value) return;
                setSelectedYear(value);
                const range = calculateFinancialYearBudgetRangeForYear(parseInt(value, 10));
                setStartMonth(range.start_month);
                setEndMonth(range.end_month);
              }}
            />
            <Select size="xs" w={120} data={monthOptions} value={startMonth} onChange={(v) => v && setStartMonth(v)} />
            <Select size="xs" w={120} data={monthOptions} value={endMonth} onChange={(v) => v && setEndMonth(v)} />
            <Select size="xs" w={130} data={salespersonOptions} value={salesperson} onChange={(v) => setSalesperson(v || "")} />
            <Button size="xs" onClick={() => void fetchData()} styles={{ root: { background: "#101C2E", height: 30 } }}>
              Apply
            </Button>
          </Group>
        </Group>

        <Grid gutter={10}>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card radius={8} p={10} withBorder style={{ borderColor: "#E6EDF5" }}>
              <Text size="10px" fw={700} c="#8AA0B9">BUDGET YTD</Text>
              <Text fw={800} fz={30} c="#0B1F3A">{formatCrL(summary.budget_ytd)}</Text>
              <Text size="11px" c="#8AA0B9">Plan</Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card radius={8} p={10} withBorder style={{ borderColor: "#E6EDF5" }}>
              <Text size="10px" fw={700} c="#8AA0B9">ACTUAL YTD</Text>
              <Text fw={800} fz={30} c="#0B1F3A">{formatCrL(summary.actual_ytd)}</Text>
              <Text size="11px" c={toNumber(summary.variance_ytd) < 0 ? "#EF4444" : "#16A34A"}>
                {toNumber(summary.variance_ytd) < 0 ? "▼" : "▲"} {formatCrL(summary.variance_ytd)}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card radius={8} p={10} withBorder style={{ borderColor: "#E6EDF5" }}>
              <Text size="10px" fw={700} c="#8AA0B9">ACHIEVEMENT</Text>
              <Text fw={800} fz={30} c="#0B1F3A">{toNumber(summary.achievement_pct).toFixed(1)}%</Text>
              <Text size="11px" c={toNumber(summary.variance_ytd) < 0 ? "#EF4444" : "#16A34A"}>
                {toNumber(summary.variance_ytd) < 0 ? "vs 100% plan" : "on plan"}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card radius={8} p={10} withBorder style={{ borderColor: "#E6EDF5" }}>
              <Text size="10px" fw={700} c="#8AA0B9">FORECAST Y-END</Text>
              <Text fw={800} fz={30} c="#0B1F3A">{formatCrL(summary.forecast_fy_end)}</Text>
              <Text size="11px" c={String(summary.forecast_status).includes("risk") ? "#EF4444" : "#16A34A"}>
                {toTitle(String(summary.forecast_status || "on_track"))}
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
          <Grid gutter={10}>
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Card radius={8} p={12} withBorder style={{ borderColor: "#E6EDF5" }}>
                <Group gap={8} mb={8}>
                  <Text fw={800} fz={34} c="#0B1F3A" style={{ lineHeight: 1 }}>By Sales Rep · YTD</Text>
                  <Text fz={12} c="#9AAECB" fw={600}>Actual (solid) vs Budget (marker)</Text>
                </Group>

                <Grid columns={24} mb={6}>
                  <Grid.Col span={7}><Text fz={10} fw={700} c="#9AAECB">REP</Text></Grid.Col>
                  <Grid.Col span={3}><Text fz={10} fw={700} c="#9AAECB">BUDGET</Text></Grid.Col>
                  <Grid.Col span={3}><Text fz={10} fw={700} c="#9AAECB">ACTUAL</Text></Grid.Col>
                  <Grid.Col span={7}></Grid.Col>
                  <Grid.Col span={2}><Text fz={10} fw={700} c="#9AAECB">VARIANCE</Text></Grid.Col>
                  <Grid.Col span={2}><Text fz={10} fw={700} c="#9AAECB">ACHVD.</Text></Grid.Col>
                </Grid>

                <Stack gap={0}>
                  {filteredRepRows.slice(0, 6).map((row: any, idx: number) => {
                    const budget = toNumber(row.budget);
                    const actual = toNumber(row.actual);
                    const variance = toNumber(row.variance);
                    const achv = toNumber(row.achievement_pct);
                    const maxBase = Math.max(budget, actual, 1);
                    const actualPct = clamp((actual / maxBase) * 100, 0, 100);
                    const markerPct = clamp((budget / maxBase) * 100, 0, 100);
                    const barColor = getRepBarColor(achv);
                    const roleLabel =
                      idx % 3 === 0
                        ? "North · Ocean lead"
                        : idx % 3 === 1
                          ? "West · FCL specialist"
                          : "South · Air freight";

                    return (
                      <Box key={`${row.sno}-${row.sales_person}`} py={8} style={{ borderTop: idx === 0 ? "1px solid #EEF3F8" : "none", borderBottom: "1px solid #EEF3F8" }}>
                        <Grid columns={24} align="center">
                          <Grid.Col span={7}>
                            <Text fw={700} fz={13} c="#0F172A">{row.sales_person}</Text>
                            <Text fz={10} c="#A3B4CF">{roleLabel}</Text>
                          </Grid.Col>
                          <Grid.Col span={3}><Text fw={600} fz={12} c="#334155">{formatCrL(budget)}</Text></Grid.Col>
                          <Grid.Col span={3}><Text fw={700} fz={12} c="#0F172A">{formatCrL(actual)}</Text></Grid.Col>
                          <Grid.Col span={7}>
                            <Box style={{ position: "relative", height: 24, borderRadius: 6, background: "#F8FBFF", overflow: "hidden" }}>
                              <Box
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  background: "repeating-linear-gradient(45deg, #E8EEF5 0, #E8EEF5 4px, #F7FAFD 4px, #F7FAFD 8px)",
                                }}
                              />
                              <Box style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${actualPct}%`, background: barColor, borderRadius: 6 }} />
                              <Box style={{ position: "absolute", left: `${markerPct}%`, top: 0, bottom: 0, width: 3, background: "#0B2548" }} />
                            </Box>
                          </Grid.Col>
                          <Grid.Col span={2}><Text fw={800} fz={12} c={variance < 0 ? "#EF4444" : "#16A34A"} ta="right">{formatCrL(variance)}</Text></Grid.Col>
                          <Grid.Col span={2}><Text fw={700} fz={12} c="#7C93B2" ta="right">{Math.round(achv)}%</Text></Grid.Col>
                        </Grid>
                      </Box>
                    );
                  })}
                </Stack>

                <Divider my={8} color="#1F467A" />
                <Grid columns={24} align="center">
                  <Grid.Col span={7}><Text fw={800} fz={13} c="#0F172A">Team Total</Text></Grid.Col>
                  <Grid.Col span={3}><Text fw={700} fz={12}>{formatCrL(teamSummary.budget)}</Text></Grid.Col>
                  <Grid.Col span={3}><Text fw={700} fz={12}>{formatCrL(teamSummary.actual)}</Text></Grid.Col>
                  <Grid.Col span={7}>
                    <Box style={{ position: "relative", height: 22, borderRadius: 6, background: "#F8FBFF", overflow: "hidden" }}>
                      <Box
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${clamp((teamSummary.actual / Math.max(teamSummary.actual, teamSummary.budget, 1)) * 100, 0, 100)}%`,
                          background: "#173A6B",
                        }}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={2}><Text fw={800} fz={12} c={teamSummary.variance < 0 ? "#EF4444" : "#16A34A"} ta="right">{formatCrL(teamSummary.variance)}</Text></Grid.Col>
                  <Grid.Col span={2}><Text fw={800} fz={12} c="#637A98" ta="right">{teamSummary.achv.toFixed(1)}%</Text></Grid.Col>
                </Grid>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Stack gap={10}>
                <Card radius={8} p={10} withBorder style={{ borderColor: "#E6EDF5" }}>
                  <Group gap={8} mb={6}>
                    <Text fw={800} fz={34} c="#0B1F3A" style={{ lineHeight: 1 }}>Monthly Trend</Text>
                    <Text fz={12} c="#9AAECB" fw={600}>FY {selectedYear?.slice(-2)}-{String(Number(selectedYear) + 1).slice(-2)} · {formatCrL(summary.budget_fy_total || summary.budget_ytd)}</Text>
                  </Group>
                  <Box h={isMobile ? 230 : 260}>
                    <ReactECharts option={monthlyTrendOption} style={{ height: "100%", width: "100%" }} />
                  </Box>
                </Card>

                <Card radius={8} p={10} withBorder style={{ borderColor: "#E6EDF5" }}>
                  <Group gap={8} mb={6}>
                    <Text fw={800} fz={34} c="#0B1F3A" style={{ lineHeight: 1 }}>By Mode · YTD</Text>
                    <Text fz={12} c="#9AAECB" fw={600}>Marker = budget target</Text>
                  </Group>
                  <Stack gap={8}>
                    {byMode.map((row: any, idx: number) => {
                      const budget = toNumber(row.budget);
                      const actual = toNumber(row.actual);
                      const base = Math.max(budget, actual, 1);
                      const actualPct = clamp((actual / base) * 100, 0, 100);
                      const markerPct = clamp((budget / base) * 100, 0, 100);
                      const modeName = String(row.mode || "Unknown");
                      const isCustoms = modeName.toLowerCase().includes("custom");
                      const color = isCustoms ? "#16A34A" : idx % 2 === 0 ? "#173A6B" : "#D97706";
                      return (
                        <Group key={modeName} justify="space-between" wrap="nowrap">
                          <Text fz={13} fw={700} c="#334155" style={{ minWidth: 86 }}>{modeName}</Text>
                          <Box style={{ flex: 1, height: 28, borderRadius: 7, background: "#F6FAFD", position: "relative", overflow: "hidden" }}>
                            <Box style={{ height: "100%", width: `${actualPct}%`, background: color, borderRadius: 7 }} />
                            <Box style={{ position: "absolute", left: `${markerPct}%`, top: 0, bottom: 0, width: 3, background: "#F59E0B" }} />
                          </Box>
                          <Text fz={12} fw={800} c="#0F172A" style={{ minWidth: 106, textAlign: "right" }}>
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
    </Box>
  );
}
