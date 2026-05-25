import { Flex, Loader, Text } from "@mantine/core";
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { ERP_LIST_FONT_MONO, ERP_LIST_FONT_SANS } from "../../../../../components/ERPListPage/erpListGeistShell";
import type { CollectionTargetVsPerformanceData } from "../collectionTargetVsPerformanceTypes";
import { COL_ACCENT, COL_INK_4, COL_LINE, COL_NAVY_700, COL_NAVY_800 } from "../theme";
import { DashboardCard } from "./DashboardCard";

type DailyCollectionChartProps = {
  data: CollectionTargetVsPerformanceData["dailyCollection"];
  currencyCode?: string;
  loading?: boolean;
};

export function DailyCollectionChart({
  data,
  currencyCode = "INR",
  loading,
}: DailyCollectionChartProps) {
  const code = currencyCode.trim().toUpperCase() || "INR";
  const chartOption = useMemo(() => {
    const labels = data.points.map((p) => String(p.day));
    const amounts = data.points.map((p) => p.amount);
    const maxVal = Math.max(...amounts, data.runRateNeed, 1);

    return {
      textStyle: { fontFamily: ERP_LIST_FONT_SANS },
      grid: { top: 24, left: 44, right: 72, bottom: 36 },
      tooltip: {
        trigger: "axis",
        textStyle: { fontFamily: ERP_LIST_FONT_SANS, fontSize: 12 },
        formatter: (params: { name: string; value: number }[]) => {
          const bar = params[0];
          return `${bar?.name}: ${code} ${Number(bar?.value).toFixed(1)} L`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: COL_LINE } },
        axisLabel: {
          fontSize: 9,
          color: COL_INK_4,
          fontFamily: ERP_LIST_FONT_MONO,
          interval: 0,
          formatter: (value: string) => {
            const day = Number(value);
            if (!Number.isFinite(day)) return value;
            const last = Number(labels[labels.length - 1]);
            if (day === 1 || day === last || day % 4 === 0) return value;
            return "";
          },
        },
      },
      yAxis: {
        type: "value",
        max: Math.ceil(maxVal / 5) * 5,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: COL_LINE } },
        axisLabel: {
          fontSize: 9,
          color: COL_INK_4,
          fontFamily: ERP_LIST_FONT_MONO,
          formatter: (v: number) => `${v}L`,
        },
      },
      series: [
        {
          name: "Daily collection",
          type: "bar",
          data: amounts,
          barWidth: 14,
          itemStyle: { color: COL_NAVY_700, borderRadius: [2, 2, 0, 0] },
        },
      ],
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: COL_ACCENT, width: 2, type: "dashed" },
        label: {
          show: true,
          position: "end",
          formatter: data.runRateLabel ?? `Need ${code} ${data.runRateNeed} L/day`,
          color: COL_ACCENT,
          fontFamily: ERP_LIST_FONT_MONO,
          fontSize: 10,
        },
        data: [{ yAxis: data.runRateNeed }],
      },
    };
  }, [data, code]);

  return (
    <DashboardCard title={data.title} subtitle={data.subtitle}>
      {loading ? (
        <Flex align="center" justify="center" mih={220}>
          <Loader size="sm" color={COL_NAVY_800} />
        </Flex>
      ) : (
        <>
          <ReactECharts option={chartOption} style={{ height: 220, width: "100%" }} />
          <Flex gap={16} mt={6} wrap="wrap">
            <Flex align="center" gap={6}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: COL_NAVY_700,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              <Text fz={11} c={COL_INK_4}>
                Daily collection
              </Text>
            </Flex>
            <Flex align="center" gap={6}>
              <span
                style={{
                  width: 14,
                  height: 2,
                  background: COL_ACCENT,
                  display: "inline-block",
                }}
              />
              <Text fz={11} c={COL_INK_4}>
                Daily run-rate need
              </Text>
            </Flex>
          </Flex>
        </>
      )}
    </DashboardCard>
  );
}
