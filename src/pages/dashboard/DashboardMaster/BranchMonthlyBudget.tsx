import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import dayjs from "dayjs";
import ReactECharts from "echarts-for-react";
import type { SalespersonMonthlyBudgetItem } from "../../../service/dashboard.service";
import { getBranchMonthlyBudgetMock } from "./branchMonthlyBudgetMock";
import { useBranchNumberFormat } from "../../../hooks/useBranchNumberFormat";

const ERP_FONT_SANS = "'Geist', sans-serif";

type BranchMonthlyBudgetProps = {
  opened: boolean;
  onClose: () => void;
  company: string;
  branchName: string;
  branchCode?: string;
  startMonth: string;
  endMonth: string;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getAchievementColor = (percentage: number): string => {
  if (percentage >= 90) return "#27ae60";
  if (percentage >= 70) return "#FFBF00";
  return "#e74c3c";
};

export default function BranchMonthlyBudget({
  opened,
  onClose,
  company,
  branchName,
  branchCode,
  startMonth,
  endMonth,
}: BranchMonthlyBudgetProps) {
  const {
    formatAmount,
    formatBudgetCrL: formatCrL,
    formatBudgetFull: formatCurrencyFull,
    numberLocale,
    isIndianBranch,
  } = useBranchNumberFormat();
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<SalespersonMonthlyBudgetItem[]>([]);
  const [summary, setSummary] = useState({
    totalActualBudget: 0,
    totalSalesBudget: 0,
    currency: "INR",
  });

  useEffect(() => {
    if (!opened || !branchName) return;

    setIsLoading(true);

    const timer = window.setTimeout(() => {
      const mock = getBranchMonthlyBudgetMock({
        branchName,
        branchCode,
        startMonth,
        endMonth,
      });
      setRows(mock.rows);
      setSummary(mock.summary);
      setIsLoading(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [opened, branchName, branchCode, startMonth, endMonth]);

  const sparklineOption = useMemo(() => {
    const labels = rows.map((row) => dayjs(`${row.month}-01`).format("MMM"));
    const actualSeries = rows.map((row) => row.actual_budget);
    const budgetSeries = rows.map((row) => row.sales_budget);
    return {
      animation: true,
      grid: { left: 8, right: 8, top: 26, bottom: 18, containLabel: false },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          show: true,
          color: "#94A3B8",
          fontSize: 10,
          interval: labels.length > 8 ? 1 : 0,
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: {
          show: true,
          color: "#A1A1AA",
          fontSize: 9,
          formatter: (v: number) =>
            isIndianBranch
              ? `${(v / 1e7).toLocaleString(numberLocale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}Cr`
              : `${(v / 1e6).toLocaleString(numberLocale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}M`,
        },
        splitLine: { show: true, lineStyle: { color: "#EEF2F7", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "#CBD5E1", width: 1 } },
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
        padding: [8, 10],
        textStyle: { color: "#0F172A", fontFamily: ERP_FONT_SANS, fontSize: 11 },
        formatter: (params: { axisValue?: string; seriesName?: string; value?: number }[]) => {
          const p = Array.isArray(params) ? params : [];
          const month = p[0]?.axisValue || "";
          const actual = p.find((i) => i.seriesName === "Actual")?.value ?? 0;
          const budget = p.find((i) => i.seriesName === "Budget")?.value ?? 0;
          return `
            <div style="min-width:190px">
              <div style="font-weight:700;color:#0F172A;margin-bottom:6px">${month}</div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#64748B">Actual</span><span style="font-weight:700">${formatCurrencyFull(actual)}</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#64748B">Budget</span><span style="font-weight:700">${formatCurrencyFull(budget)}</span></div>
            </div>
          `;
        },
      },
      series: [
        {
          name: "Budget",
          type: "line",
          data: budgetSeries,
          smooth: 0.35,
          symbol: "none",
          lineStyle: { width: 2, color: "#94A3B8", type: "dashed" },
          areaStyle: { color: "rgba(148, 163, 184, 0.08)" },
          z: 1,
        },
        {
          name: "Actual",
          type: "line",
          data: actualSeries,
          smooth: 0.35,
          symbol: "circle",
          symbolSize: 5,
          showSymbol: rows.length <= 16,
          connectNulls: true,
          lineStyle: { width: 2.6, color: "#0EA5E9" },
          itemStyle: {
            color: (params: { dataIndex: number }) =>
              (actualSeries[params.dataIndex] ?? 0) >= (budgetSeries[params.dataIndex] ?? 0)
                ? "#16A34A"
                : "#DC2626",
          },
          areaStyle: { color: "rgba(14, 165, 233, 0.10)" },
          z: 2,
        },
      ],
    };
  }, [rows, formatCurrencyFull, isIndianBranch, numberLocale]);

  const branchTitle = branchCode ? `${branchName} (${branchCode})` : branchName;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="66%"
      title={
        <Group gap={8} style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Box>
            <Text fw={700} c="#111827" style={{ fontFamily: ERP_FONT_SANS }}>
              Branch Monthly Budget
            </Text>
            <Text fz={12} fw={600} c="#64748B">
              {branchTitle}
            </Text>
          </Box>
          <Box>
            <Text fz={11} fw={600} c="#8AA0B9" style={{ lineHeight: 1.4 }}>
              {company}
              {" · "}
              {dayjs(`${startMonth}-01`).format("MMM YYYY")}
              {" - "}
              {dayjs(`${endMonth}-01`).format("MMM YYYY")}
              {" · "}
              {summary.currency}
            </Text>
          </Box>
        </Group>
      }
      styles={{
        body: { background: "#F8FAFC", padding: 14 },
        title: { width: "100%" },
      }}
    >
      <Stack gap={10} style={{ fontFamily: ERP_FONT_SANS }}>
        <Alert color="yellow" variant="light" styles={{ message: { fontSize: 12 } }}>
          Showing demo monthly figures until the branch drill-down API is available.
        </Alert>
        <Grid gutter={10}>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                Actual
              </Text>
              <Text fw={800} fz={24} c="#111827" mt={4}>
                {formatCrL(summary.totalActualBudget)}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                Budget
              </Text>
              <Text fw={800} fz={24} c="#111827" mt={4}>
                {formatCrL(summary.totalSalesBudget)}
              </Text>
            </Card>
          </Grid.Col>
        </Grid>

        <Card
          withBorder
          radius={8}
          p="md"
          style={{
            borderColor: "#DCE3EC",
            background:
              "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,1) 22%, rgba(255,255,255,1) 100%)",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
          }}
        >
          <Group justify="space-between" align="center" mb={8}>
            <Box>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                Performance Sparkline
              </Text>
              <Text fz={13} fw={700} c="#0F172A" mt={2}>
                Actual vs Budget Trend
              </Text>
            </Box>
            <Group gap={8}>
              <Box
                px={8}
                py={4}
                style={{ borderRadius: 999, border: "1px solid #D1FAE5", background: "#ECFDF5" }}
              >
                <Group gap={6}>
                  <Box w={12} h={2} bg="#16A34A" />
                  <Text fz={10} c="#065F46" fw={700}>
                    Above
                  </Text>
                </Group>
              </Box>
              <Box
                px={8}
                py={4}
                style={{ borderRadius: 999, border: "1px solid #FECACA", background: "#FEF2F2" }}
              >
                <Group gap={6}>
                  <Box w={12} h={2} bg="#DC2626" />
                  <Text fz={10} c="#991B1B" fw={700}>
                    Below
                  </Text>
                </Group>
              </Box>
              <Box
                px={8}
                py={4}
                style={{ borderRadius: 999, border: "1px solid #E2E8F0", background: "#F8FAFC" }}
              >
                <Group gap={6}>
                  <Box w={12} h={2} bg="#94A3B8" />
                  <Text fz={10} c="#475569" fw={700}>
                    Budget
                  </Text>
                </Group>
              </Box>
            </Group>
          </Group>
          <Box h={150}>
            {rows.length ? (
              <ReactECharts option={sparklineOption} style={{ height: "100%", width: "100%" }} />
            ) : (
              <Group h="100%" justify="center" align="center">
                <Text fz={12} fw={600} c="#94A3B8">
                  No trend data available for the selected period.
                </Text>
              </Group>
            )}
          </Box>
        </Card>

        <Card
          withBorder
          radius={8}
          p={0}
          style={{ borderColor: "#E2E8F0", background: "#FFFFFF", overflow: "hidden" }}
        >
          <Box px="md" py="sm" style={{ background: "#F8FAFC" }}>
            <Text fw={700} fz={13} c="#0F172A">
              Month-wise Budget Performance
            </Text>
          </Box>
          <Divider />

          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader color="#105476" />
            </Group>
          ) : (
            <ScrollArea h={420}>
              <Table stickyHeader highlightOnHover horizontalSpacing="md" verticalSpacing={11}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Month</Table.Th>
                    <Table.Th ta="right">Actual</Table.Th>
                    <Table.Th ta="right">Budget</Table.Th>
                    <Table.Th ta="right">Variance</Table.Th>
                    <Table.Th ta="right">Trade Type</Table.Th>
                    <Table.Th ta="right">Service Type</Table.Th>
                    <Table.Th ta="right">Achievement</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => {
                    const actual = row.actual_budget;
                    const budget = row.sales_budget;
                    const variance = actual - budget;
                    const rowAch = budget > 0 ? (actual / budget) * 100 : 0;
                    return (
                      <Table.Tr key={`${row.sno}-${row.month}`}>
                        <Table.Td>
                          <Text fw={600} fz={13}>
                            {dayjs(`${row.month}-01`).format("MMM YYYY")}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatAmount(actual)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} fz={13} c="#475569" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatAmount(budget)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} c={variance >= 0 ? "#16A34A" : "#DC2626"}>
                            {variance >= 0 ? "+" : ""}
                            {formatCrL(variance)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} c="#0F172A">
                            {row.trade_type ?? "-"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} c="#0F172A">
                            {row.service_type ?? "-"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} c={getAchievementColor(rowAch)}>
                            {rowAch.toFixed(1)}%
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                  {!rows.length && (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text c="#94A3B8" ta="center" py="md">
                          No budget rows available for this selection.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      </Stack>
    </Drawer>
  );
}
