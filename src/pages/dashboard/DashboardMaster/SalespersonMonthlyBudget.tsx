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
import {
  getSalespersonMonthlyBudgetSummary,
  type SalespersonMonthlyBudgetItem,
} from "../../../service/dashboard.service";

const ERP_FONT_SANS = "'Geist', sans-serif";

type SalespersonMonthlyBudgetProps = {
  opened: boolean;
  onClose: () => void;
  company: string;
  salesperson: string;
  startMonth: string;
  endMonth: string;
  type: string;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCrL = (value: unknown): string => {
  const amount = toNumber(value);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const formatCurrencyFull = (value: unknown): string => {
  const amount = toNumber(value);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const getAchievementColor = (percentage: number): string => {
  if (percentage >= 90) return "#27ae60";
  if (percentage >= 70) return "#FFBF00";
  return "#e74c3c";
};

export default function SalespersonMonthlyBudget({
  opened,
  onClose,
  company,
  salesperson,
  startMonth,
  endMonth,
  type,
}: SalespersonMonthlyBudgetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SalespersonMonthlyBudgetItem[]>([]);
  const [summary, setSummary] = useState({
    totalActualBudget: 0,
    totalSalesBudget: 0,
    currency: "INR",
  });

  useEffect(() => {
    const fetchMonthlyBudget = async () => {
      if (!opened || !salesperson) return;
      try {
        setIsLoading(true);
        setError(null);
        const response = await getSalespersonMonthlyBudgetSummary({
          company,
          salesperson,
          start_month: startMonth,
          end_month: endMonth,
          type,
        });
        const payload = response?.data?.[0];
        setRows(payload?.budget || []);
        setSummary({
          totalActualBudget: toNumber(
            response?.summary?.total_actual_budget ?? payload?.summary?.total_actual_budget
          ),
          totalSalesBudget: toNumber(
            response?.summary?.total_sales_budget ?? payload?.summary?.total_sales_budget
          ),
          currency: response?.summary?.currency || payload?.currency || "INR",
        });
      } catch (err) {
        console.error("Error loading salesperson monthly budget:", err);
        setError("Unable to load monthly budget details.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchMonthlyBudget();
  }, [opened, company, salesperson, startMonth, endMonth]);

  const sparklineOption = useMemo(() => {
    const labels = rows.map((row) => dayjs(`${row.month}-01`).format("MMM"));
    const actualSeries = rows.map((row) => (row.actual_budget));
    const budgetSeries = rows.map((row) => (row.sales_budget));
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
          formatter: (v: number) => `${(v / 10000000).toFixed(1)}Cr`,
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
        formatter: (params: any[]) => {
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
        {
          name: "Actual highlight",
          type: "line",
          data: actualSeries,
          smooth: 0.35,
          symbol: "none",
          lineStyle: { opacity: 0 },
          markPoint: actualSeries.length
            ? {
                symbol: "circle",
                symbolSize: 10,
                data: [{ coord: [labels.length - 1, actualSeries[actualSeries.length - 1]] }],
                itemStyle: { color: "#0EA5E9", borderColor: "#FFFFFF", borderWidth: 2 },
                label: { show: false },
              }
            : undefined,
          z: 3,
        },
      ],
    };
  }, [rows]);

  const sparklineInsights = useMemo(() => {
    if (!rows.length) {
      return {
        avgAch: 0,
        bestMonthLabel: "-",
        bestVariance: 0,
        watchMonthLabel: "-",
        watchVariance: 0,
      };
    }
    const withMetrics = rows.map((row) => {
      const actual = (row.actual_budget);
      const budget = (row.sales_budget);
      const variance = actual - budget;
      const ach = budget > 0 ? (actual / budget) * 100 : 0;
      return {
        monthLabel: dayjs(`${row.month}-01`).format("MMM YYYY"),
        variance,
        ach,
      };
    });
    const best = withMetrics.reduce((acc, row) => (row.variance > acc.variance ? row : acc));
    const watch = withMetrics.reduce((acc, row) => (row.variance < acc.variance ? row : acc));
    const avgAch =
      withMetrics.reduce((sum, row) => sum + row.ach, 0) / Math.max(withMetrics.length, 1);
    return {
      avgAch,
      bestMonthLabel: best.monthLabel,
      bestVariance: best.variance,
      watchMonthLabel: watch.monthLabel,
      watchVariance: watch.variance,
    };
  }, [rows]);

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
            Salesperson Monthly Budget
          </Text>
          <Text fz={12} fw={600} c="#64748B">
            {salesperson}
          </Text>
          </Box>
          <Box>
          <Text fz={11} fw={600} c="#8AA0B9" style={{ lineHeight: 1.4 }}>
          {company}{" · "}{dayjs(`${startMonth}-01`).format("MMM YYYY")}{" - "}{dayjs(`${endMonth}-01`).format("MMM YYYY")}{" . "}{summary.currency}
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
        {/* <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Box>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                Company
              </Text>
              <Text fz={14} fw={700} c="#0F172A">
                {company}
              </Text>
            </Box>
            <Box>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                Period
              </Text>
              <Text fz={14} fw={700} c="#0F172A">
                {dayjs(`${startMonth}-01`).format("MMM YYYY")} - {dayjs(`${endMonth}-01`).format("MMM YYYY")}
              </Text>
            </Box>
            <Box>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                Currency
              </Text>
              <Text fz={14} fw={700} c="#0F172A">
                {summary.currency}
              </Text>
            </Box>
          </Group>
        </Card> */}

        <Grid gutter={10}>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                Actual Budget
              </Text>
              <Text fw={800} fz={24} c="#111827" mt={4}>
                {summary.totalActualBudget}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
              <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                Sales Budget
              </Text>
              <Text fw={800} fz={24} c="#111827" mt={4}>
                {summary.totalSalesBudget}
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
                  <Text fz={10} c="#065F46" fw={700}>Above</Text>
                </Group>
              </Box>
              <Box
                px={8}
                py={4}
                style={{ borderRadius: 999, border: "1px solid #FECACA", background: "#FEF2F2" }}
              >
                <Group gap={6}>
                  <Box w={12} h={2} bg="#DC2626" />
                  <Text fz={10} c="#991B1B" fw={700}>Below</Text>
                </Group>
              </Box>
              <Box
                px={8}
                py={4}
                style={{ borderRadius: 999, border: "1px solid #E2E8F0", background: "#F8FAFC" }}
              >
                <Group gap={6}>
                  <Box w={12} h={2} bg="#94A3B8" />
                  <Text fz={10} c="#475569" fw={700}>Budget</Text>
                </Group>
              </Box>
            </Group>
          </Group>
          {/* <Grid gutter={8} mb={8}>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Box
                p={8}
                style={{
                  borderRadius: 8,
                  border: "1px solid #DCFCE7",
                  background: "linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)",
                }}
              >
                <Text fz={10} fw={700} c="#15803D" tt="uppercase" style={{ letterSpacing: "0.04em" }}>
                  Best Month
                </Text>
                <Text fz={12} fw={700} c="#166534" mt={2}>
                  {sparklineInsights.bestMonthLabel}
                </Text>
                <Text fz={11} fw={700} c="#16A34A">
                  {sparklineInsights.bestVariance >= 0 ? "+" : ""}
                  {formatCrL(sparklineInsights.bestVariance)}
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Box
                p={8}
                style={{
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
                }}
              >
                <Text fz={10} fw={700} c="#475569" tt="uppercase" style={{ letterSpacing: "0.04em" }}>
                  Avg Achievement
                </Text>
                <Text fz={20} fw={800} c="#0F172A" mt={2}>
                  {sparklineInsights.avgAch.toFixed(1)}%
                </Text>
                <Text fz={10} fw={600} c="#64748B">
                  across selected period
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Box
                p={8}
                style={{
                  borderRadius: 8,
                  border: "1px solid #FEE2E2",
                  background: "linear-gradient(180deg, #FEF2F2 0%, #FFFFFF 100%)",
                }}
              >
                <Text fz={10} fw={700} c="#B91C1C" tt="uppercase" style={{ letterSpacing: "0.04em" }}>
                  Watch Month
                </Text>
                <Text fz={12} fw={700} c="#7F1D1D" mt={2}>
                  {sparklineInsights.watchMonthLabel}
                </Text>
                <Text fz={11} fw={700} c="#DC2626">
                  {sparklineInsights.watchVariance >= 0 ? "+" : ""}
                  {formatCrL(sparklineInsights.watchVariance)}
                </Text>
              </Box>
            </Grid.Col>
          </Grid> */}
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

        <Card withBorder radius={8} p={0} style={{ borderColor: "#E2E8F0", background: "#FFFFFF", overflow: "hidden" }}>
          <Box px="md" py="sm" style={{ background: "#F8FAFC" }}>
            <Text fw={700} fz={13} c="#0F172A">
              Month-wise Budget Performance
            </Text>
          </Box>
          <Divider />

          {error && <Alert color="red" m="md">{error}</Alert>}
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
                    <Table.Th ta="right">Applicable Incentive</Table.Th>
                    <Table.Th ta="right">Trade Type</Table.Th>
                    <Table.Th ta="right">Service Type</Table.Th>
                    <Table.Th ta="right">Achievement</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => {
                    const actual = (row.actual_budget);
                    const budget = (row.sales_budget);
                    const variance = actual - budget;
                    const rowAch = budget > 0 ? (actual / budget) * 100 : 0;
                    return (
                      <Table.Tr key={`${row.sno}-${row.month}`}>
                        <Table.Td>
                          <Text fw={600} fz={13}>{dayjs(`${row.month}-01`).format("MMM YYYY")}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13}>{(actual)}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} fz={13} c="#475569">{(budget)}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} c={variance >= 0 ? "#16A34A" : "#DC2626"}>
                          {row.incentive_amount}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} c="#0F172A">{row.trade_type ?? "-"}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={13} c="#0F172A">{row.service_type ?? "-"}</Text>
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
                      <Table.Td colSpan={5}>
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
