import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Flex,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconChevronRight,
  IconDownload,
  IconRefresh,
} from "@tabler/icons-react";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import {
  ERP_LIST_FONT_MONO,
  ERP_LIST_FONT_SANS,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components/ERPListPage/erpListGeistShell";
import { SingleDateInput } from "../../../components";
import useAuthStore from "../../../store/authStore";
import {
  ALL_BREAKDOWN_DIMENSIONS,
  EMPTY_BREAKDOWN_TOTAL,
} from "./accountsDashboardEmpty";
import {
  branchDotColor,
  formatAmountInCr,
  normalizeAccountsDashboard,
  profitabilityDimensionFlags,
} from "./accountsDashboardNormalize";
import type {
  AccountsDashboardData,
  AccountsKpi,
  BreakdownDimension,
  BreakdownRow,
  TrendDirection,
} from "./accountsDashboardTypes";
import ProfitabilityTrillOne from "./ProfitabilityTrillOne";

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
const DIMENSION_LABELS: Record<BreakdownDimension, string> = {
  segment: "Segment",
  branch: "Branch",
  customer: "Customer",
  tradelane: "Tradelane",
  salesperson: "Salesperson",
};

/** Shape-only prop for KPI loading skeletons (no displayed values). */
const KPI_LOADING_SHAPE: AccountsKpi = {
  key: "_loading",
  label: "",
  value: 0,
  unit: "",
  trend: { direction: "flat", text: "" },
};

type AccountsDashboardProps = {
  fromDate?: Date | null;
  toDate?: Date | null;
  globalSearch?: string;
};

type PeriodGranularity = "month" | "quarter" | "h1h2" | "fy";

function defaultFromDate(): Date {
  return dayjs().startOf("month").toDate();
}

function defaultToDate(): Date {
  return new Date();
}

const dateFieldStyles = {
  input: {
    height: 32,
    minHeight: 32,
    borderColor: LINE,
    fontSize: 12,
    fontWeight: 500,
    width: 132,
  },
} as const;

function sparklinePoints(values: number[]): string {
  if (!values.length) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 28;
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
}

function trendColor(direction: TrendDirection, invert = false): string {
  const up = invert ? BAD : GOOD;
  const down = invert ? GOOD : BAD;
  if (direction === "up") return up;
  if (direction === "down") return down;
  return INK_3;
}

function marginFill(tone: BreakdownRow["marginTone"]): string {
  if (tone === "good") return "linear-gradient(90deg, #15803d, #22c55e)";
  if (tone === "warn") return "linear-gradient(90deg, #b45309, #f59e0b)";
  if (tone === "bad") return "linear-gradient(90deg, #991b1b, #ef4444)";
  return `linear-gradient(90deg, ${NAVY_700}, #3b5f8f)`;
}

const PF_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1.6fr 0.8fr 0.6fr",
  gap: 12,
  alignItems: "center",
  padding: "12px 14px",
  fontSize: 12,
};

function CurrencyAmount({
  valueInCr,
  bold = false,
}: {
  valueInCr: number;
  bold?: boolean;
}) {
  return (
    <div
      className="pf-num"
      style={{
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        fontWeight: bold ? 600 : 400,
        color: bold ? INK : INK_2,
      }}
    >
      <span style={{ color: INK_4, fontSize: 10, marginRight: 1 }}>₹</span>
      {formatAmountInCr(valueInCr)}
    </div>
  );
}

function MarginBar({
  marginPct,
  maxMargin,
  tone,
}: {
  marginPct: number;
  maxMargin: number;
  tone?: BreakdownRow["marginTone"];
}) {
  const widthPct = Math.min(100, (marginPct / Math.max(maxMargin, 1)) * 100);
  return (
    <Box>
      <Box
        style={{
          height: 18,
          background: "#f1f5f9",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Box
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${widthPct}%`,
            background: marginFill(tone),
            borderRadius: 4,
          }}
        />
      </Box>
      <Text
        fz={11}
        c={INK_3}
        mt={2}
        style={{ fontFamily: ERP_LIST_FONT_MONO, textAlign: "right", display: "block" }}
      >
        {marginPct.toFixed(1)}%
      </Text>
    </Box>
  );
}

function YoyCell({ row }: { row: BreakdownRow }) {
  if (row.yoyLabel) {
    return (
      <Text fz={11} fw={600} c={BAD} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        ▼ {row.yoyLabel}
      </Text>
    );
  }
  if (row.yoyHasData === false) {
    return (
      <Text fz={11} c={INK_4} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        —
      </Text>
    );
  }
  const direction = row.yoyDirection ?? (row.yoyPct >= 0 ? "up" : "down");
  const up = direction === "up";
  const sign = row.yoyPct >= 0 ? "+" : "";
  return (
    <Text
      fz={11}
      fw={600}
      c={trendColor(direction)}
      style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
    >
      {up ? "▲" : "▼"} {sign}
      {Math.abs(row.yoyPct).toFixed(1)}%
    </Text>
  );
}

function DimensionCell({
  row,
  dimension,
}: {
  row: BreakdownRow;
  dimension: BreakdownDimension;
}) {
  const showBranchChip = dimension === "branch" && row.code;

  return (
    <Flex align="flex-start" gap={showBranchChip ? 8 : 0} style={{ minWidth: 0 }}>
      {showBranchChip ? (
        <Box
          component="span"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10.5,
            fontWeight: 600,
            padding: "2px 7px",
            borderRadius: 3,
            background: "#f8fafc",
            color: INK_2,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            border: `1px solid ${LINE}`,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          <Box
            component="span"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: branchDotColor(row.branchVariant, row.dotColor),
            }}
          />
          {row.code}
        </Box>
      ) : null}
      <Box style={{ minWidth: 0 }}>
        <Text className="pf-name" fw={600} c={INK} lh={1.3} style={{ letterSpacing: "-0.01em" }}>
          {row.name}
        </Text>
        {row.subtitle ? (
          <Text className="pf-sub" fz={10.5} c={INK_4} mt={2} fw={400}>
            {row.subtitle}
          </Text>
        ) : null}
      </Box>
    </Flex>
  );
}

function BreakdownTable({
  rows,
  total,
  dimension,
  loading,
  onRowClick,
}: {
  rows: BreakdownRow[];
  total: BreakdownRow;
  dimension: BreakdownDimension;
  loading?: boolean;
  onRowClick?: (row: BreakdownRow) => void;
}) {
  const maxMargin = Math.max(...rows.map((r) => r.marginPct), total.marginPct, 1);

  if (loading) {
    return (
      <Box px={14} pb={14}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={44} mb={8} radius={6} />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      <Box
        className="pf-row head"
        style={{
          ...PF_GRID,
          background: "#f8fafc",
          color: INK_3,
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 500,
          paddingTop: 10,
          paddingBottom: 10,
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div>Dimension</div>
        <div style={{ textAlign: "right" }}>Revenue</div>
        <div style={{ textAlign: "right" }}>Cost</div>
        <div style={{ textAlign: "right" }}>Gross Profit</div>
        <div>Margin %</div>
        <div style={{ textAlign: "right" }}>Yo-Y</div>
        <div />
      </Box>

      {rows.map((row) => (
        <Box
          key={row.id ?? row.name}
          className="pf-row clickable"
          style={{
            ...PF_GRID,
            borderBottom: `1px solid ${LINE}`,
            cursor: "pointer",
            transition: "background 120ms",
          }}
          onClick={() => onRowClick?.(row)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f8fafc";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <DimensionCell row={row} dimension={dimension} />
          <CurrencyAmount valueInCr={row.revenue} />
          <CurrencyAmount valueInCr={row.cost} />
          <CurrencyAmount valueInCr={row.grossProfit} bold />
          <MarginBar marginPct={row.marginPct} maxMargin={maxMargin} tone={row.marginTone} />
          <YoyCell row={row} />
          <Flex justify="flex-end" align="center" c={INK_4}>
            <IconChevronRight size={16} stroke={1.75} />
          </Flex>
        </Box>
      ))}

      <Box
        className="pf-row total"
        style={{
          ...PF_GRID,
          background: "#f8fafc",
          fontWeight: 600,
          borderTop: `2px solid ${NAVY_900}`,
          borderBottom: "none",
        }}
      >
        <Box>
          <Text fw={600} c={INK}>
            {total.name}
          </Text>
          {total.subtitle ? (
            <Text className="pf-sub" fz={10.5} c={INK_4} mt={2} fw={400}>
              {total.subtitle}
            </Text>
          ) : null}
        </Box>
        <CurrencyAmount valueInCr={total.revenue} bold />
        <CurrencyAmount valueInCr={total.cost} bold />
        <CurrencyAmount valueInCr={total.grossProfit} bold />
        <MarginBar marginPct={total.marginPct} maxMargin={maxMargin} tone="neutral" />
        <YoyCell row={total} />
        <div />
      </Box>
    </Box>
  );
}

function KpiCard({ kpi, loading }: { kpi: AccountsKpi; loading?: boolean }) {
  if (loading) {
    return (
      <Box
        style={{
          background: CARD_BG,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: "14px 16px",
          minHeight: 108,
        }}
      >
        <Skeleton height={10} width="55%" mb={10} />
        <Skeleton height={28} width="70%" mb={10} />
        <Skeleton height={12} width="45%" />
      </Box>
    );
  }

  const trendUp = kpi.trend.direction === "up";
  const arrow = trendUp ? "▲" : kpi.trend.direction === "down" ? "▼" : "—";

  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: "14px 16px",
        position: "relative",
        minHeight: 108,
      }}
    >
      <Text
        fz={11}
        fw={500}
        c={INK_3}
        tt="uppercase"
        style={{ letterSpacing: "0.04em" }}
      >
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
        {kpi.showCurrency && !kpi.isPercent ? (
          <Text span c={INK_3} fz={14} fw={500} mr={2}>
            ₹
          </Text>
        ) : null}
        {kpi.isPercent ? kpi.value.toFixed(1) : kpi.value.toFixed(2)}
        <Text span c={INK_3} fz={14} fw={500} ml={2}>
          {kpi.unit}
        </Text>
      </Text>
      <Flex align="center" gap={6} mt={6}>
        <Text
          fz={12}
          fw={500}
          c={trendColor(kpi.trend.direction, kpi.key === "direct_costs")}
        >
          {arrow} {kpi.trend.text}
        </Text>
        {kpi.trend.context ? (
          <Text fz={12} c={INK_4} fw={400}>
            {kpi.trend.context}
          </Text>
        ) : null}
      </Flex>
      {kpi.sparkline && kpi.sparkline.length > 1 ? (
        <svg
          viewBox="0 0 64 28"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            right: 14,
            bottom: 14,
            width: 64,
            height: 28,
          }}
          aria-hidden
        >
          <polyline
            fill="none"
            stroke={kpi.sparklineColor || GOOD}
            strokeWidth={1.5}
            points={sparklinePoints(kpi.sparkline)}
          />
        </svg>
      ) : null}
    </Box>
  );
}


const AccountsDashboard: React.FC<AccountsDashboardProps> = ({
  fromDate: fromDateProp,
  toDate: toDateProp,
  globalSearch: _globalSearch,
}) => {
  const user = useAuthStore((state) => state.user);
  const company = user?.company?.company_name?.trim() || "Pentagon India";
  const [rangeFrom, setRangeFrom] = useState<Date | null>(
    () => fromDateProp ?? defaultFromDate(),
  );
  const [rangeTo, setRangeTo] = useState<Date | null>(() => toDateProp ?? defaultToDate());
  const [data, setData] = useState<AccountsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [activeDimension, setActiveDimension] = useState<BreakdownDimension>("segment");
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>("month");
  const [branchFilter, setBranchFilter] = useState<string | null>("all");
  const [modeFilter, setModeFilter] = useState<string | null>("all");
  const [drillRow, setDrillRow] = useState<BreakdownRow | null>(null);
  const [drillOpened, setDrillOpened] = useState(false);

  useEffect(() => {
    if (fromDateProp != null) setRangeFrom(fromDateProp);
  }, [fromDateProp]);

  useEffect(() => {
    if (toDateProp != null) setRangeTo(toDateProp);
  }, [toDateProp]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setApiNotice(null);
    try {
      const payload = {
        company,
        date_from: rangeFrom
          ? dayjs(rangeFrom).format("YYYY-MM-DD")
          : dayjs().startOf("month").format("YYYY-MM-DD"),
        date_to: rangeTo ? dayjs(rangeTo).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
        compare_previous_period: true,
        ...profitabilityDimensionFlags(activeDimension),
      };

      // Interceptor already returns axios `response.data` (not the full AxiosResponse).
      const body = await apiCallProtected.post(URL.dashboard.accountsProfitability, payload);
      const normalized = normalizeAccountsDashboard(body, activeDimension);

      setData((prev) => ({
        ...normalized,
        breakdown: {
          ...normalized.breakdown,
          byDimension: {
            ...(prev?.breakdown.byDimension ?? {}),
            ...normalized.breakdown.byDimension,
          },
        },
      }));
    } catch {
      setApiNotice("Unable to load profitability data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [activeDimension, company, rangeFrom, rangeTo]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const breakdownBlock = data?.breakdown.byDimension[activeDimension];
  const breakdownRows = breakdownBlock?.rows ?? [];
  const breakdownTotal =
    breakdownBlock?.total ??
    ({
      ...EMPTY_BREAKDOWN_TOTAL,
      name: `Total · all ${activeDimension}s`,
    } satisfies BreakdownRow);

  const monthlyChartOption = useMemo(() => {
    if (!data) return {};
    const points = data.monthlyTrend.points;
    if (!points.length) return {};
    const labels = points.map((p) => p.month);
    const revenue = points.map((p) => p.revenue);
    const grossProfit = points.map((p) => p.grossProfit);
    const revenueRemainder = revenue.map((r, i) => Math.max(0, r - grossProfit[i]));
    const margin = points.map((p) => p.marginPct);
    const maxVal = Math.max(...revenue, 1);
    const marginMax = Math.max(...margin, 10);

    return {
      textStyle: { fontFamily: ERP_LIST_FONT_SANS },
      grid: { top: 28, left: 44, right: 16, bottom: 52 },
      legend: {
        bottom: 4,
        left: 0,
        itemWidth: 10,
        itemHeight: 10,
        data: ["Revenue", "Gross Profit", "Margin %"],
        textStyle: { fontSize: 10, color: INK_4, fontFamily: ERP_LIST_FONT_SANS },
      },
      tooltip: {
        trigger: "axis",
        textStyle: { fontFamily: ERP_LIST_FONT_SANS, fontSize: 12 },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: LINE } },
        axisLabel: { fontSize: 10, color: INK_4, fontFamily: ERP_LIST_FONT_MONO },
      },
      yAxis: [
        {
          type: "value",
          max: Math.ceil(maxVal / 5) * 5,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: LINE } },
          axisLabel: {
            fontSize: 9,
            color: INK_4,
            fontFamily: ERP_LIST_FONT_MONO,
          },
        },
        {
          type: "value",
          min: 0,
          max: Math.ceil((marginMax * 1.08) / 5) * 5,
          show: false,
        },
      ],
      series: [
        {
          name: "Gross Profit",
          type: "bar",
          stack: "total",
          data: grossProfit,
          barWidth: 24,
          itemStyle: { color: NAVY_800, borderRadius: [0, 0, 0, 0] },
          z: 2,
        },
        {
          name: "Revenue",
          type: "bar",
          stack: "total",
          data: revenueRemainder,
          barWidth: 24,
          itemStyle: { color: "#bae6fd", borderRadius: [3, 3, 0, 0] },
          z: 1,
        },
        {
          name: "Margin %",
          type: "line",
          yAxisIndex: 1,
          data: margin,
          smooth: 0.35,
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: "#f59e0b", width: 2 },
          itemStyle: { color: "#f59e0b" },
          z: 3,
        },
      ],
    };
  }, [data]);

  const donutOption = useMemo(() => {
    if (!data) return {};
    const items = data.revenueMix.items;
    return {
      textStyle: { fontFamily: ERP_LIST_FONT_SANS },
      tooltip: {
        trigger: "item",
        formatter: "{b}: ₹{c} Cr ({d}%)",
        textStyle: { fontFamily: ERP_LIST_FONT_SANS },
      },
      series: [
        {
          type: "pie",
          radius: ["58%", "78%"],
          center: ["38%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          data: items.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: item.color },
          })),
        },
      ],
      graphic: [
        {
          type: "text",
          left: "30%",
          top: "44%",
          style: {
            text: `₹${data.revenueMix.total.toFixed(1)} Cr`,
            fill: INK,
            font: "600 16px Geist, sans-serif",
            textAlign: "center",
          },
        },
        {
          type: "text",
          left: "33%",
          top: "54%",
          style: {
            text: "REVENUE",
            fill: INK_4,
            font: "500 9px Geist, sans-serif",
            textAlign: "center",
          },
        },
      ],
    };
  }, [data]);

  const marginBarOption = useMemo(() => {
    if (!data) return {};
    const items = [...data.marginBySegment.items].sort((a, b) => b.marginPct - a.marginPct);
    const names = items.map((i) => i.name);
    const values = items.map((i) => i.marginPct);
    const colors = items.map((i) => i.color || (i.marginPct >= 25 ? GOOD : i.marginPct >= 18 ? NAVY_800 : WARN));
    const benchmark = data.marginBySegment.benchmarkPct ?? 21.5;
    const axisMax = Math.max(...values, benchmark, 1);

    return {
      textStyle: { fontFamily: ERP_LIST_FONT_SANS },
      grid: { top: 8, left: 8, right: 48, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        max: Math.ceil(axisMax * 1.12),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      yAxis: {
        type: "category",
        data: names,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 11,
          color: INK_2,
          fontFamily: ERP_LIST_FONT_SANS,
        },
      },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] },
          })),
          barWidth: 14,
          label: {
            show: true,
            position: "right",
            formatter: "{c}%",
            color: INK_3,
            fontFamily: ERP_LIST_FONT_MONO,
            fontSize: 11,
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#f59e0b", width: 1, type: "solid" },
            data: [{ xAxis: benchmark }],
          },
        },
      ],
    };
  }, [data]);

  const periodPills: { value: PeriodGranularity; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "quarter", label: "Quarter" },
    { value: "h1h2", label: "H1/H2" },
    { value: "fy", label: "FY" },
  ];

  if (loading && data === null) {
    return (
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={{
          background: PAGE_BG,
          fontFamily: ERP_LIST_FONT_SANS,
          borderRadius: 12,
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader size="lg" color={NAVY_800} />
      </Box>
    );
  }

  if (data === null) {
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
          <Alert color="red" variant="light" mb="md" radius="md" title="Data unavailable">
            {apiNotice ?? "Something went wrong."}
          </Alert>
          <Button
            size="sm"
            variant="filled"
            onClick={() => void loadDashboard()}
            styles={{ root: { background: NAVY_800 } }}
          >
            Try again
          </Button>
        </Box>
      </Box>
    );
  }

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
          <Alert color="red" variant="light" mb="md" radius="md" title="Data unavailable">
            {apiNotice}
          </Alert>
        ) : null}

        <Flex
          justify="space-between"
          align="flex-start"
          gap="md"
          wrap="wrap"
          mb="lg"
        >
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
              {data.meta.periodLabel ? ` · ${data.meta.periodLabel}` : ""}
              {data.meta.updatedAgo ? ` · Updated ${data.meta.updatedAgo}` : ""}
            </Text>
          </Box>

          <Group gap={8} wrap="wrap" justify="flex-end" align="flex-end">
            <Box
              style={{
                display: "inline-flex",
                alignSelf: "flex-end",
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
                      background:
                        periodGranularity === pill.value ? CARD_BG : "transparent",
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

            <Flex gap={8} align="flex-end" wrap="nowrap">
              <Box>
                <Text
                  fz={10}
                  fw={600}
                  c={INK_4}
                  mb={4}
                  lh={1}
                  style={{ letterSpacing: "0.04em" }}
                >
                  FROM
                </Text>
                <SingleDateInput
                  size="xs"
                  placeholder="From date"
                  value={rangeFrom}
                  onChange={setRangeFrom}
                  allowDeselection={false}
                  maxDate={rangeTo ?? new Date()}
                  styles={dateFieldStyles}
                />
              </Box>
              <Box>
                <Text
                  fz={10}
                  fw={600}
                  c={INK_4}
                  mb={4}
                  lh={1}
                  style={{ letterSpacing: "0.04em" }}
                >
                  TO
                </Text>
                <SingleDateInput
                  size="xs"
                  placeholder="To date"
                  value={rangeTo}
                  onChange={setRangeTo}
                  allowDeselection={false}
                  minDate={rangeFrom ?? undefined}
                  maxDate={new Date()}
                  styles={dateFieldStyles}
                />
              </Box>
            </Flex>

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
              {data.meta.periodLabel?.split(" ")[0] ?? "Apr 2026"} · MTD
            </Button>
            <Select
              size="xs"
              value={branchFilter}
              onChange={setBranchFilter}
              data={[
                { value: "all", label: "All branches" },
                ...(data.filterOptions?.branches ?? []),
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
            <Select
              size="xs"
              value={modeFilter}
              onChange={setModeFilter}
              data={[
                { value: "all", label: "All modes" },
                ...(data.filterOptions?.modes ?? []),
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
            {/* <Button
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
            </Button> */}
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => void loadDashboard()}
              aria-label="Refresh"
            >
              <IconRefresh size={16} />
            </Button>
          </Group>
        </Flex>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 5 }} spacing={14} mb={22}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <KpiCard key={i} kpi={KPI_LOADING_SHAPE} loading />
              ))
            : data.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
        </SimpleGrid>

        <Box
          style={{
            background: CARD_BG,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <Flex
            align="baseline"
            gap={10}
            wrap="wrap"
            px={18}
            pt={18}
            pb={12}
          >
            <Text fz={13} fw={600} c={INK} style={{ letterSpacing: "-0.005em" }}>
              Profitability
            </Text>
            <Text fz={11} c={INK_4}>
              {data.meta.breakdownSubtitle ?? "Revenue · Cost · Gross Profit · Margin %"}
            </Text>
            <Box style={{ flex: 1, minWidth: 8 }} />
            <Box
              className="dim-toggle"
              style={{
                display: "inline-flex",
                background: "#f8fafc",
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                padding: 2,
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              {ALL_BREAKDOWN_DIMENSIONS.map((dim) => (
                <Button
                  key={dim}
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => setActiveDimension(dim)}
                  styles={{
                    root: {
                      height: "auto",
                      minHeight: 28,
                      padding: "6px 11px",
                      fontSize: 11.5,
                      fontWeight: activeDimension === dim ? 600 : 500,
                      color: activeDimension === dim ? NAVY_800 : INK_3,
                      background: activeDimension === dim ? CARD_BG : "transparent",
                      borderRadius: 4,
                      boxShadow:
                        activeDimension === dim ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                    },
                  }}
                >
                  {DIMENSION_LABELS[dim]}
                </Button>
              ))}
            </Box>
          </Flex>

          <BreakdownTable
            rows={breakdownRows}
            total={breakdownTotal}
            dimension={activeDimension}
            loading={loading}
            onRowClick={(row) => {
              setDrillRow(row);
              setDrillOpened(true);
            }}
          />
        </Box>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={14}>
          <Box
            style={{
              background: CARD_BG,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 18,
              minHeight: 320,
            }}
          >
            <Flex align="baseline" gap={10} mb={14}>
              <Text fz={13} fw={600} c={INK}>
                Monthly Revenue & Gross Profit
              </Text>
              <Text fz={11} c={INK_4}>
                {data.monthlyTrend.fyLabel}
              </Text>
            </Flex>
            {loading ? (
              <Flex align="center" justify="center" mih={240}>
                <Loader size="sm" color={NAVY_800} />
              </Flex>
            ) : (
              <ReactECharts option={monthlyChartOption} style={{ height: 260, width: "100%" }} />
            )}
          </Box>

          <Box
            style={{
              background: CARD_BG,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 18,
              minHeight: 320,
            }}
          >
            <Text fz={13} fw={600} c={INK} mb={2}>
              Revenue Mix & Margin Drivers
            </Text>
            <Text fz={11} c={INK_4} mb={14}>
              By segment · period total
            </Text>

            <Flex gap="lg" align="stretch" wrap="wrap">
              <Box style={{ flex: "1 1 200px", minWidth: 200, position: "relative" }}>
                {loading ? (
                  <Flex align="center" justify="center" mih={200}>
                    <Loader size="sm" />
                  </Flex>
                ) : (
                  <ReactECharts option={donutOption} style={{ height: 220, width: "100%" }} />
                )}
              </Box>

              <Stack gap={7} style={{ flex: "1 1 180px", minWidth: 180, justifyContent: "center" }}>
                {data.revenueMix.items.map((item) => (
                  <Flex key={item.name} align="center" gap={8} justify="space-between">
                    <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                      <Box
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <Text fz={12} c={INK_2} truncate>
                        {item.name}
                      </Text>
                    </Flex>
                    <Text fz={12} fw={600} c={INK} style={{ fontVariantNumeric: "tabular-nums" }}>
                      ₹{item.value.toFixed(2)} Cr
                    </Text>
                    <Text fz={11} c={INK_4} w={32} ta="right">
                      {item.pct}%
                    </Text>
                  </Flex>
                ))}
              </Stack>
            </Flex>

            <Text
              fz={10.5}
              fw={600}
              c={INK_4}
              tt="uppercase"
              mt="lg"
              mb={10}
              style={{ letterSpacing: "0.06em" }}
            >
              Margin by segment
            </Text>
            {loading ? (
              <Skeleton height={180} radius="md" />
            ) : (
              <ReactECharts option={marginBarOption} style={{ height: 200, width: "100%" }} />
            )}
          </Box>
        </SimpleGrid>
      </Box>

      <ProfitabilityTrillOne
        opened={drillOpened}
        onClose={() => setDrillOpened(false)}
        dimension={activeDimension}
        row={drillRow}
        periodLabel={data.meta.periodLabel?.split(" ")[0] ?? "YTD"}
        categoryBenchmarkPct={data.marginBySegment.benchmarkPct}
        company={company}
        fromDate={rangeFrom}
        toDate={rangeTo}
      />
    </Box>
  );
};

export default AccountsDashboard;
