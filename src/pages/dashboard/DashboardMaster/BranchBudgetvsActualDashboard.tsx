import React, { useCallback, useEffect, useMemo, useState } from "react";
import useAuthStore from "../../../store/authStore";
import { calculateFinancialYearBudgetRangeForYear } from "../../../service/dashboard.service";
import BranchMonthlyBudget from "./BranchMonthlyBudget";
import {
  Alert,
  Box,
  Button,
  Flex,
  Loader,
  Select,
  SimpleGrid,
  Skeleton,
  Text,
} from "@mantine/core";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import ReactECharts from "echarts-for-react";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import {
  ERP_LIST_FONT_MONO,
  ERP_LIST_FONT_SANS,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components/ERPListPage/erpListGeistShell";
import { BRANCH_BUDGET_VS_ACTUAL_MOCK } from "./branchBudgetVsActualMock";
import { normalizeBranchBudgetVsActual } from "./branchBudgetVsActualNormalize";
import { formatAmountInCr } from "./accountsDashboardNormalize";
import type {
  BranchBudgetVsActualData,
  BranchBvaRow,
  BvaBarTone,
  BvaKpi,
  BvaMetricTab,
} from "./branchBudgetVsActualTypes";
import type { TrendDirection } from "./accountsDashboardTypes";

const PAGE_BG = "#f1f5f9";
const CARD_BG = "#ffffff";
const LINE = "#e2e8f0";
const INK = "#0f172a";
const INK_2 = "#334155";
const INK_3 = "#64748b";
const INK_4 = "#94a3b8";
const NAVY_700 = "#1e3a5f";
const NAVY_800 = "#0f2744";
const NAVY_900 = "#0a1628";
const GOOD = "#16a34a";
const BAD = "#dc2626";
const WARN = "#d97706";
const GOOD_BG = "#dcfce7";
const BAD_BG = "#fee2e2";
const WARN_BG = "#fef3c7";

type PeriodGranularity = "month" | "quarter" | "h1h2" | "fy";

const BVA_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 90px 2fr 90px 70px",
  gap: 12,
  alignItems: "center",
  padding: "12px 0",
};

function trendColor(direction?: TrendDirection, invert = false): string {
  const up = invert ? BAD : GOOD;
  const down = invert ? GOOD : BAD;
  if (direction === "up") return up;
  if (direction === "down") return down;
  return INK_3;
}

function actualBarColor(tone?: BvaBarTone): string {
  if (tone === "over") return GOOD;
  if (tone === "under") return WARN;
  return NAVY_700;
}

function modeBarColor(tone?: "good" | "warn" | "neutral"): string {
  if (tone === "good") return GOOD;
  if (tone === "warn") return WARN;
  return NAVY_700;
}

function BvaKpiCard({ kpi, loading }: { kpi: BvaKpi; loading?: boolean }) {
  if (loading) {
    return (
      <Box
        style={{
          background: CARD_BG,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: "14px 16px",
          minHeight: 96,
        }}
      >
        <Skeleton height={10} width="55%" mb={10} />
        <Skeleton height={28} width="70%" mb={8} />
        <Skeleton height={12} width="45%" />
      </Box>
    );
  }

  const arrow =
    kpi.trendDirection === "up" ? "▲" : kpi.trendDirection === "down" ? "▼" : "";

  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: "14px 16px",
        minHeight: 96,
      }}
    >
      <Text fz={11} fw={500} c={INK_3} tt="uppercase" style={{ letterSpacing: "0.04em" }}>
        {kpi.label}
      </Text>
      <Text
        mt={4}
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: INK,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {kpi.showCurrency && kpi.unit !== "%" ? (
          <Text span c={INK_3} fz={14} fw={500} mr={2}>
            ₹
          </Text>
        ) : null}
        {kpi.unit === "%" ? kpi.value.toFixed(1) : kpi.value.toFixed(2)}
        {kpi.unit ? (
          <Text span c={INK_3} fz={14} fw={500} ml={2}>
            {kpi.unit}
          </Text>
        ) : null}
      </Text>
      {kpi.context ? (
        <Text fz={12} c={INK_4} mt={6}>
          {kpi.context}
        </Text>
      ) : kpi.trendText ? (
        <Text fz={12} fw={500} c={trendColor(kpi.trendDirection)} mt={6}>
          {arrow} {kpi.trendText}
        </Text>
      ) : null}
    </Box>
  );
}

function PerformanceBar({
  actualWidthPct,
  markerLeftPct,
  tone,
}: {
  actualWidthPct: number;
  markerLeftPct: number;
  tone?: BvaBarTone;
}) {
  return (
    <Box
      style={{
        height: 22,
        background: "#f1f5f9",
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(11,31,58,0.08) 4px, rgba(11,31,58,0.08) 8px)",
          border: `1px dashed ${LINE}`,
          borderRadius: 4,
        }}
      />
      <Box
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${Math.min(100, Math.max(0, actualWidthPct))}%`,
          background: actualBarColor(tone),
          borderRadius: 4,
        }}
      />
      <Box
        style={{
          position: "absolute",
          top: -3,
          bottom: -3,
          left: `${Math.min(100, Math.max(0, markerLeftPct))}%`,
          width: 2,
          background: NAVY_900,
          transform: "translateX(-1px)",
        }}
      />
    </Box>
  );
}

function parseBranchIdentity(row: BranchBvaRow): { branchName: string; branchCode?: string } {
  const code = row.branchCode || row.id;
  if (row.branchName) {
    return { branchName: row.branchName, branchCode: code };
  }
  const match = row.name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { branchName: match[1].trim(), branchCode: match[2].trim() };
  }
  return { branchName: row.name.trim(), branchCode: code };
}

function BranchPerformanceRow({
  row,
  isTotal,
  onRowClick,
}: {
  row: BranchBvaRow;
  isTotal?: boolean;
  onRowClick?: (row: BranchBvaRow) => void;
}) {
  return (
    <Box
      component={onRowClick && !isTotal ? "button" : "div"}
      onClick={onRowClick && !isTotal ? () => onRowClick(row) : undefined}
      style={{
        ...BVA_GRID,
        borderBottom: isTotal ? "none" : `1px solid ${LINE}`,
        borderTop: isTotal ? `2px solid ${NAVY_900}` : undefined,
        paddingTop: isTotal ? 14 : 12,
        marginTop: isTotal ? 4 : 0,
        fontWeight: isTotal ? 600 : 400,
        width: "100%",
        textAlign: "left",
        background: "transparent",
        borderLeft: "none",
        borderRight: "none",
        cursor: onRowClick && !isTotal ? "pointer" : "default",
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={
        onRowClick && !isTotal
          ? (e: React.MouseEvent<HTMLElement>) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
            }
          : undefined
      }
      onMouseLeave={
        onRowClick && !isTotal
          ? (e: React.MouseEvent<HTMLElement>) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          : undefined
      }
    >
      <Box>
        <Text fz={12} fw={isTotal ? 600 : 500} c={INK}>
          {row.name}
        </Text>
        {row.subtitle ? (
          <Text fz={10.5} c={INK_4} mt={2}>
            {row.subtitle}
            {row.watchLabel ? (
              <>
                {" · "}
                <Box
                  component="span"
                  style={{
                    display: "inline-block",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: WARN_BG,
                    color: "#92400e",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    verticalAlign: "middle",
                  }}
                >
                  {row.watchLabel}
                </Box>
              </>
            ) : null}
          </Text>
        ) : null}
      </Box>
      <Text className="bva-val" fz={12} c={INK_2} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        <Text span c={INK_4} fz={10} mr={2}>
          ₹
        </Text>
        {formatAmountInCr(row.budget)}
      </Text>
      <Text
        fz={12}
        fw={600}
        c={INK}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        <Text span c={INK_4} fz={10} mr={2}>
          ₹
        </Text>
        {formatAmountInCr(row.actual)}
      </Text>
      <PerformanceBar
        actualWidthPct={row.barActualWidthPct}
        markerLeftPct={row.markerLeftPct}
        tone={row.barTone}
      />
      <Text
        fz={12}
        fw={600}
        c={row.varianceDirection === "pos" ? GOOD : BAD}
        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {row.varianceDisplay ?? formatAmountInCr(row.variance)}
      </Text>
      <Text
        fz={11}
        c={INK_3}
        style={{ fontFamily: ERP_LIST_FONT_MONO, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {row.achievementPct.toFixed(row.achievementPct % 1 === 0 ? 0 : 1)}%
      </Text>
    </Box>
  );
}

const BranchBudgetvsActualDashboard: React.FC = () => {
  const [data, setData] = useState<BranchBudgetVsActualData>(BRANCH_BUDGET_VS_ACTUAL_MOCK);
  const [loading, setLoading] = useState(true);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("month");
  const [metricTab, setMetricTab] = useState<BvaMetricTab>("revenue");
  const [periodFilter, setPeriodFilter] = useState<string | null>("fy_ytd");
  const [groupBy, setGroupBy] = useState<string | null>("branch");
  const [metricFilter, setMetricFilter] = useState<string | null>("revenue_gp");
  const [branchDrawerOpened, setBranchDrawerOpened] = useState(false);
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [selectedBranchCode, setSelectedBranchCode] = useState<string | undefined>();

  const user = useAuthStore((state) => state.user);
  const company = user?.company?.company_name || "PENTAGON INDIA";

  const { start_month: startMonth, end_month: endMonth } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fyStart = month >= 4 ? year : year - 1;
    return calculateFinancialYearBudgetRangeForYear(fyStart);
  }, []);

  const handleBranchRowClick = useCallback((row: BranchBvaRow) => {
    const { branchName, branchCode } = parseBranchIdentity(row);
    if (!branchName) return;
    setSelectedBranchName(branchName);
    setSelectedBranchCode(branchCode);
    setBranchDrawerOpened(true);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCallProtected.post(URL.dashboard.branchBudgetVsActual, {
        period: periodGranularity,
        period_filter: periodFilter,
        group_by: groupBy,
        metric: metricFilter,
        performance_metric: metricTab,
      });
      setData(normalizeBranchBudgetVsActual(response.data));
      setApiNotice(null);
    } catch {
      setData(BRANCH_BUDGET_VS_ACTUAL_MOCK);
      setApiNotice(
        "Live branch budget data is not available yet. Showing reference layout with demo figures until the API responds.",
      );
    } finally {
      setLoading(false);
    }
  }, [groupBy, metricFilter, metricTab, periodFilter, periodGranularity]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const monthlyChartOption = useMemo(() => {
    const points = data.monthlyRunRate.points;
    if (!points.length) return {};
    const labels = points.map((p) => p.month);
    const budget = points.map((p) => p.budget);
    const actual = points.map((p) => p.actual);
    const maxVal = Math.max(...budget, ...actual, 1);

    return {
      textStyle: { fontFamily: ERP_LIST_FONT_SANS },
      grid: { top: 20, left: 44, right: 16, bottom: 36 },
      tooltip: {
        trigger: "axis",
        textStyle: { fontFamily: ERP_LIST_FONT_SANS, fontSize: 12 },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: LINE } },
        axisLabel: { fontSize: 9, color: INK_4, fontFamily: ERP_LIST_FONT_MONO },
      },
      yAxis: {
        type: "value",
        max: Math.ceil(maxVal * 1.1 * 2) / 2,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: LINE } },
        axisLabel: { fontSize: 9, color: INK_4, fontFamily: ERP_LIST_FONT_MONO },
      },
      series: [
        {
          name: "Budget",
          type: "bar",
          data: budget,
          barWidth: 22,
          itemStyle: { color: "#e2e8f0", borderRadius: [2, 2, 0, 0] },
          z: 1,
        },
        {
          name: "Actual",
          type: "bar",
          data: points.map((p, i) => ({
            value: p.actual,
            itemStyle: {
              color: p.isForecast ? "#f59e0b" : NAVY_700,
              opacity: p.isForecast ? 0.85 : 1,
              borderRadius: [2, 2, 0, 0],
            },
          })),
          barWidth: 18,
          barGap: "-85%",
          z: 2,
        },
      ],
    };
  }, [data.monthlyRunRate.points]);

  const periodPills: { value: PeriodGranularity; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "quarter", label: "Quarter" },
    { value: "h1h2", label: "H1/H2" },
    { value: "fy", label: "FY" },
  ];

  const metricTabs: { value: BvaMetricTab; label: string }[] = [
    { value: "revenue", label: "Revenue" },
    { value: "gross_profit", label: "Gross Profit" },
    { value: "volume", label: "Volume (TEU/Tons)" },
  ];

  return (
    <Box
      className={ERP_LIST_GEIST_ROOT_CLASS}
      style={{
        background: PAGE_BG,
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

        <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="lg">
          <Box style={{ minWidth: 0 }}>
            <Text
              style={{
                fontSize: "clamp(20px, 3vw, 26px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: INK,
                lineHeight: 1.15,
              }}
            >
              {data.meta.title}
            </Text>
            <Text fz={12} c={INK_3} mt={6} style={{ lineHeight: 1.5 }}>
              {data.meta.subtitle}
            </Text>
          </Box>

          <Flex gap={8} wrap="wrap" justify="flex-end" align="center">
            <Box
              style={{
                display: "inline-flex",
                background: "#f8fafc",
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                padding: 2,
                gap: 1,
              }}
            >
              {periodPills.map((pill) => (
                <Button
                  key={pill.value}
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => setPeriodGranularity(pill.value)}
                  styles={{
                    root: {
                      height: 28,
                      padding: "0 11px",
                      fontSize: 11.5,
                      fontWeight: periodGranularity === pill.value ? 600 : 500,
                      color: periodGranularity === pill.value ? NAVY_800 : INK_3,
                      background: periodGranularity === pill.value ? CARD_BG : "transparent",
                      boxShadow:
                        periodGranularity === pill.value
                          ? "0 1px 2px rgba(15,23,42,0.06)"
                          : "none",
                    },
                  }}
                >
                  {pill.label}
                </Button>
              ))}
            </Box>

            <Button
              size="compact-xs"
              variant="filled"
              styles={{
                root: {
                  background: NAVY_800,
                  height: 32,
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            >
              {data.meta.periodLabel}
            </Button>
            <Select
              size="xs"
              value={groupBy}
              onChange={setGroupBy}
              data={[
                { value: "branch", label: "By Branch" },
                ...(data.filterOptions?.groupBy ?? []),
              ]}
              styles={{
                input: {
                  height: 32,
                  minHeight: 32,
                  width: 120,
                  borderColor: LINE,
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            />
            <Select
              size="xs"
              value={metricFilter}
              onChange={setMetricFilter}
              data={[
                { value: "revenue_gp", label: "Revenue + GP" },
                ...(data.filterOptions?.metrics ?? []),
              ]}
              styles={{
                input: {
                  height: 32,
                  minHeight: 32,
                  width: 130,
                  borderColor: LINE,
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            />
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<IconDownload size={14} />}
              styles={{
                root: {
                  height: 32,
                  borderColor: LINE,
                  color: INK_2,
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            >
              Export
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => void loadDashboard()}
              aria-label="Refresh"
            >
              <IconRefresh size={16} />
            </Button>
          </Flex>
        </Flex>

        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing={14} mb={14}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <BvaKpiCard key={i} kpi={data.kpis[0]} loading />
              ))
            : data.kpis.map((kpi) => <BvaKpiCard key={kpi.label} kpi={kpi} />)}
        </SimpleGrid>

        <Box
          style={{
            background: CARD_BG,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            padding: "18px 18px 8px",
            marginBottom: 14,
          }}
        >
          <Flex align="baseline" gap={10} wrap="wrap" mb={12}>
            <Text fz={13} fw={600} c={INK} style={{ letterSpacing: "-0.005em" }}>
              Branch Performance · YTD
            </Text>
            <Text fz={11} c={INK_4}>
              Actual (solid) vs Budget (marker)
            </Text>
            <Box style={{ flex: 1, minWidth: 8 }} />
            <Box style={{ display: "inline-flex", gap: 2 }}>
              {metricTabs.map((tab) => (
                <Button
                  key={tab.value}
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => setMetricTab(tab.value)}
                  styles={{
                    root: {
                      height: "auto",
                      minHeight: 24,
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: metricTab === tab.value ? 600 : 500,
                      color: metricTab === tab.value ? INK : INK_3,
                      background: metricTab === tab.value ? "#f1f5f9" : "transparent",
                      borderRadius: 4,
                    },
                  }}
                >
                  {tab.label}
                </Button>
              ))}
            </Box>
          </Flex>

          {loading ? (
            <Box py="sm">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={48} mb={8} radius={6} />
              ))}
            </Box>
          ) : (
            <Box>
              <Box
                style={{
                  ...BVA_GRID,
                  color: INK_4,
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 500,
                  paddingTop: 0,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                <div>Branch</div>
                <div style={{ textAlign: "right" }}>Budget</div>
                <div style={{ textAlign: "right" }}>Actual</div>
                <div />
                <div style={{ textAlign: "right" }}>Variance</div>
                <div style={{ textAlign: "right" }}>Achvd.</div>
              </Box>
              {data.branchPerformance.rows.map((row) => (
                <BranchPerformanceRow
                  key={row.id ?? row.name}
                  row={row}
                  onRowClick={handleBranchRowClick}
                />
              ))}
              <BranchPerformanceRow row={data.branchPerformance.total} isTotal />
            </Box>
          )}
        </Box>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={14}>
          <Box
            style={{
              background: CARD_BG,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 18,
              minHeight: 280,
            }}
          >
            <Flex align="baseline" gap={10} mb={14}>
              <Text fz={13} fw={600} c={INK}>
                Monthly Run-rate vs Budget
              </Text>
              <Text fz={11} c={INK_4}>
                {data.monthlyRunRate.fyLabel}
              </Text>
            </Flex>
            {loading ? (
              <Flex align="center" justify="center" mih={200}>
                <Loader size="sm" color={NAVY_800} />
              </Flex>
            ) : (
              <>
                <ReactECharts option={monthlyChartOption} style={{ height: 220, width: "100%" }} />
                <Flex gap={14} mt={6} wrap="wrap">
                  <Flex align="center" gap={6}>
                    <Box style={{ width: 10, height: 10, background: "#e2e8f0", borderRadius: 2 }} />
                    <Text fz={11} c={INK_3}>
                      Budget
                    </Text>
                  </Flex>
                  <Flex align="center" gap={6}>
                    <Box style={{ width: 10, height: 10, background: NAVY_700, borderRadius: 2 }} />
                    <Text fz={11} c={INK_3}>
                      Actual
                    </Text>
                  </Flex>
                  <Flex align="center" gap={6}>
                    <Box style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: 2 }} />
                    <Text fz={11} c={INK_3}>
                      Forecast Mar
                    </Text>
                  </Flex>
                </Flex>
              </>
            )}
          </Box>

          <Box
            style={{
              background: CARD_BG,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 18,
              minHeight: 280,
            }}
          >
            <Flex align="baseline" gap={10} mb={14}>
              <Text fz={13} fw={600} c={INK}>
                By Mode · Budget vs Actual
              </Text>
              <Text fz={11} c={INK_4}>
                YTD · marker = budget
              </Text>
            </Flex>

            {loading ? (
              <Skeleton height={180} radius="md" />
            ) : (
              <Box style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.byMode.items.map((item) => (
                  <Box
                    key={item.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 1fr 100px",
                      gap: 10,
                      alignItems: "center",
                      fontSize: 11,
                    }}
                  >
                    <Text fw={500} c={INK_2}>
                      {item.name}
                    </Text>
                    <Box
                      style={{
                        height: 18,
                        background: "#f1f5f9",
                        borderRadius: 4,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: `${Math.min(100, item.barWidthPct)}%`,
                          background: modeBarColor(item.tone),
                          borderRadius: 4,
                        }}
                      />
                      <Box
                        style={{
                          position: "absolute",
                          top: -2,
                          bottom: -2,
                          left: `${Math.min(100, item.targetLeftPct)}%`,
                          width: 2,
                          background: "#f59e0b",
                          transform: "translateX(-1px)",
                        }}
                      />
                    </Box>
                    <Text
                      fz={11}
                      fw={600}
                      c={INK}
                      style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                    >
                      ₹{item.actual.toFixed(1)} / {item.budget.toFixed(1)} Cr
                    </Text>
                  </Box>
                ))}
              </Box>
            )}

            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: INK_4,
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                margin: "16px 0 10px",
              }}
            >
              Variance call-outs
              <Box style={{ flex: 1, height: 1, background: LINE }} />
            </Box>

            <Flex direction="column" gap={8}>
              {data.varianceCallouts.map((callout, i) => (
                <Flex key={i} align="center" gap={10}>
                  <Box
                    component="span"
                    style={{
                      display: "inline-block",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: callout.tone === "good" ? GOOD_BG : BAD_BG,
                      color: callout.tone === "good" ? "#166534" : "#991b1b",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {callout.amount}
                  </Box>
                  <Text fz={12} c={INK_2}>
                    {callout.text}
                  </Text>
                </Flex>
              ))}
            </Flex>
          </Box>
        </SimpleGrid>
      </Box>
      <BranchMonthlyBudget
        opened={branchDrawerOpened}
        onClose={() => setBranchDrawerOpened(false)}
        company={company}
        branchName={selectedBranchName}
        branchCode={selectedBranchCode}
        startMonth={startMonth}
        endMonth={endMonth}
      />
    </Box>
  );
};

export default BranchBudgetvsActualDashboard;
