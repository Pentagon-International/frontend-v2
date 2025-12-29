import { useMemo } from "react";
import {
  Card,
  Group,
  Text,
  Button,
  Box,
  Loader,
  Center,
  Stack,
  SegmentedControl,
  Select,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import {
  getFilteredBudgetData,
  calculateBudgetAggregatedData,
  BudgetAggregatedData,
} from "../../../service/dashboard.service";

interface BudgetProps {
  // State props
  budgetDrillLevel: 0 | 1 | 2 | 3;
  budgetSelectedCompany: string | null;
  budgetSelectedSalesperson: string | null;
  budgetDateRange: string;
  budgetWindowStart: number;
  budgetRawData: any;
  budgetAggregatedData: BudgetAggregatedData;
  budgetHoverTotals: {
    actual: number;
    sales: number;
  } | null;
  isLoadingBudget: boolean;
  budgetStartMonth: string;
  budgetEndMonth: string;
  budgetType: "salesperson" | "non-salesperson";
  selectedYear: string | null;
  fromMonthOptions: { value: string; label: string }[];
  toMonthOptions: { value: string; label: string }[];

  // Setters
  setBudgetDrillLevel: (level: 0 | 1 | 2 | 3) => void;
  setBudgetSelectedCompany: (company: string | null) => void;
  setBudgetSelectedSalesperson: (salesperson: string | null) => void;
  setBudgetWindowStart: (start: number | ((prev: number) => number)) => void;
  setBudgetRawData: (data: any) => void;
  setBudgetAggregatedData: (data: BudgetAggregatedData) => void;
  setSearchSalesman: (salesman: string) => void;
  setSelectedCompany: (company: string | null) => void;
  setIsLoadingBudget: (loading: boolean) => void;
  setBudgetType: (type: "salesperson" | "non-salesperson") => void;
  setSelectedYear: (year: string | null) => void;

  // Handlers
  handleBudgetViewAll: () => void;
  handleBudgetBarClick: (params: any) => void;
  handleBudgetTypeChange: (value: "salesperson" | "non-salesperson") => void;
  handleBudgetMonthFilterChange: (
    startMonth: string | null,
    endMonth: string | null
  ) => void;
}

const Budget = ({
  budgetDrillLevel,
  budgetSelectedCompany,
  budgetSelectedSalesperson,
  budgetDateRange,
  budgetWindowStart,
  budgetRawData,
  budgetAggregatedData,
  budgetHoverTotals,
  isLoadingBudget,
  budgetStartMonth,
  budgetEndMonth,
  budgetType,
  selectedYear,
  fromMonthOptions,
  toMonthOptions,
  setBudgetDrillLevel,
  setBudgetSelectedCompany,
  setBudgetSelectedSalesperson,
  setBudgetWindowStart,
  setBudgetRawData,
  setBudgetAggregatedData,
  setSearchSalesman,
  setSelectedCompany,
  setIsLoadingBudget,
  setBudgetType,
  setSelectedYear,
  handleBudgetViewAll,
  handleBudgetBarClick,
  handleBudgetTypeChange,
  handleBudgetMonthFilterChange,
}: BudgetProps) => {
  // Memoized chart data preparation
  const budgetChartData = useMemo(() => {
    if (!budgetRawData?.data || !Array.isArray(budgetRawData.data)) {
      return { labels: [], actual: [], sales: [] };
    }

    let labels: string[] = [];
    let actual: number[] = [];
    let sales: number[] = [];

    if (budgetDrillLevel === 0) {
      // At level 0, show all companies
      labels = budgetRawData.data.map(
        (company: any) => company?.company_name || "Company"
      );
      actual = budgetRawData.data.map((company: any) =>
        Number(company?.summary?.total_actual_budget || 0)
      );
      sales = budgetRawData.data.map((company: any) =>
        Number(company?.summary?.total_sales_budget || 0)
      );
    } else {
      const root = budgetRawData.data[0];
      if (!root) return { labels: [], actual: [], sales: [] };

      const items = Array.isArray(root?.budget) ? root.budget : [];

      if (budgetDrillLevel === 1) {
        labels = items.map((i: any) => {
          const name = i.salesperson || "-";
          return name.length > 3 ? name.substring(0, 3) + "." : name;
        });
        actual = items.map((i: any) => Number(i.actual_budget) || 0);
        sales = items.map((i: any) => Number(i.sales_budget) || 0);
      } else {
        labels = items.map((i: any) =>
          i.month ? dayjs(i.month + "-01").format("MMM") : "-"
        );
        actual = items.map((i: any) => Number(i.actual_budget) || 0);
        sales = items.map((i: any) => Number(i.sales_budget) || 0);
      }
    }

    const pageSize = 6;
    if (labels.length > pageSize) {
      const start = budgetWindowStart;
      const end = start + pageSize;
      labels = labels.slice(start, end);
      actual = actual.slice(start, end);
      sales = sales.slice(start, end);
    }

    return { labels, actual, sales };
  }, [budgetRawData, budgetDrillLevel, budgetWindowStart]);

  // Memoized pagination button visibility
  const budgetPaginationButtons = useMemo(() => {
    if (!budgetRawData?.data || !Array.isArray(budgetRawData.data)) {
      return { showPrev: false, showNext: false };
    }

    let totalItems = 0;

    if (budgetDrillLevel === 0) {
      totalItems = budgetRawData.data.length;
    } else {
      const root = budgetRawData.data[0];
      if (!root) return { showPrev: false, showNext: false };
      const items = Array.isArray(root?.budget) ? root.budget : [];
      totalItems = items.length;
    }

    const pageSize = 6;
    const showPrev = budgetWindowStart > 0;
    const showNext = budgetWindowStart + pageSize < totalItems;

    return { showPrev, showNext };
  }, [budgetRawData, budgetDrillLevel, budgetWindowStart]);

  // Budget bar chart configuration
  const budgetBarChartOption = useMemo(() => {
    const { labels, actual, sales } = budgetChartData;

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        position: function (
          point: any,
          _params: any,
          _dom: any,
          _rect: any,
          size: any
        ) {
          const tooltipWidth = size.contentSize[0];
          const chartWidth = size.viewSize[0];
          return [
            Math.min(point[0] + 20, chartWidth - tooltipWidth - 10),
            point[1] - 10,
          ];
        },
        formatter: function (params: any) {
          let tooltip = "";
          if (budgetDrillLevel === 1) {
            const index = params[0].dataIndex + budgetWindowStart;
            const fullName =
              budgetRawData?.data?.[0]?.budget?.[index]?.salesperson ||
              params[0].axisValue;
            tooltip = fullName + "<br>";
          } else {
            tooltip = params[0].axisValue + "<br>";
          }
          params.forEach((param: any) => {
            tooltip += `${param.seriesName}: ${param.value.toLocaleString()}<br>`;
          });
          return tooltip;
        },
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#ccc",
        borderWidth: 1,
        textStyle: {
          color: "#333",
        },
      },
      legend: {
        data: ["Actual", "Budget"],
        bottom: 5,
        textStyle: {
          fontSize: 11,
        },
        itemGap: 15,
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "25%",
        top: "5%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          fontSize: 10,
          color: "#666",
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: function (value: number) {
            return `₹${(value / 1000000).toFixed(1)}M`;
          },
          fontSize: 10,
          color: "#666",
        },
        splitNumber: 6,
        minInterval: 1,
        max: function () {
          const allValues = [...actual, ...sales];
          const maxValue = Math.max(...allValues);
          return Math.ceil(maxValue / 1000000) * 1000000;
        },
      },
      series: [
        {
          name: "Actual",
          type: "bar",
          data: actual,
          // barMinHeight: 20,

          itemStyle: {
            color: "#086ea1",
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
        },
        {
          name: "Budget",
          type: "bar",
          data: sales,
          // barMinHeight: 20,

          itemStyle: {
            color: "#105476",
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
        },
      ],
    };
  }, [budgetChartData, budgetDrillLevel, budgetRawData, budgetWindowStart]);

  const budgetBarChartStyle = useMemo(
    () => ({
      height: "100%",
      width: "100%",
    }),
    []
  );

  const budgetBarChartEvents = useMemo(
    () => ({
      click: handleBudgetBarClick,
    }),
    [handleBudgetBarClick]
  );

  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      h={380}
      style={{ border: "1px solid #e9ecef" }}
    >
      {/* Header row: Title + Toggle + View All */}
      <Group justify="space-between" align="center" mb="xs" gap="xs">
        <Text size="md" fw={500} c="Black">
          Budget vs Actual
        </Text>
        {/* <Group gap="xs"> */}
        <SegmentedControl
          value={budgetType}
          onChange={(value) =>
            handleBudgetTypeChange(value as "salesperson" | "non-salesperson")
          }
          data={[
            { label: "Sales", value: "salesperson" },
            { label: "Non-Sales", value: "non-salesperson" },
          ]}
          size="xs"
          color="#105476"
          styles={{
            root: {
              backgroundColor: "#f1f3f5",
            },
          }}
        />
        <Text
          size="md"
          c="#105476"
          style={{
            textDecoration: "underline",
            cursor: "pointer",
          }}
          onClick={handleBudgetViewAll}
        >
          View All
        </Text>
        {/* </Group> */}
      </Group>

      {/* Filter inputs row */}
      <Group gap="xs" mb="xs" align="center">
        <Select
          placeholder="Year"
          data={[
            { value: "2025", label: "2025" },
            { value: "2024", label: "2024" },
            { value: "2023", label: "2023" },
            { value: "2022", label: "2022" },
            { value: "2021", label: "2021" },
            { value: "2020", label: "2020" },
          ]}
          value={selectedYear}
          onChange={(value) => {
            if (value) {
              setSelectedYear(value);
              // The parent component will handle updating the month values with the new year
            }
          }}
          clearable
          size="xs"
          w={80}
        />
        <Select
          placeholder="From Month"
          data={fromMonthOptions}
          value={budgetStartMonth}
          onChange={(value) => {
            if (value) {
              const endMonth =
                !budgetEndMonth || budgetEndMonth < value
                  ? value
                  : budgetEndMonth;
              handleBudgetMonthFilterChange(value, endMonth);
            }
          }}
          size="xs"
          w={110}
          withAsterisk
          required
        />
        <Select
          placeholder="To Month"
          data={toMonthOptions}
          value={budgetEndMonth}
          onChange={(value) => {
            if (value) {
              handleBudgetMonthFilterChange(budgetStartMonth, value);
            }
          }}
          size="xs"
          w={110}
          withAsterisk
          required
        />
      </Group>

      {/* Second row: Date Range + Back Button */}
      <Group justify="space-between" align="center">
        {budgetDrillLevel > 1 && (
          <Button
            size="compact-xs"
            variant="light"
            disabled={isLoadingBudget}
            onClick={async () => {
              setIsLoadingBudget(true);
              try {
                if (budgetDrillLevel === 3) {
                  setBudgetWindowStart(0);
                  const resp = await getFilteredBudgetData({
                    company: budgetSelectedCompany,
                    salesman: budgetSelectedSalesperson,
                    start_month: budgetStartMonth,
                    end_month: budgetEndMonth,
                    type: budgetType,
                  } as any);
                  setBudgetRawData(resp);
                  const agg = calculateBudgetAggregatedData(resp);
                  setBudgetAggregatedData(agg);
                  setBudgetDrillLevel(2);
                } else if (budgetDrillLevel === 2) {
                  setSearchSalesman("");
                  setBudgetWindowStart(0);
                  const resp = await getFilteredBudgetData({
                    company: budgetSelectedCompany,
                    start_month: budgetStartMonth,
                    end_month: budgetEndMonth,
                    type: budgetType,
                  } as any);
                  setBudgetRawData(resp);
                  const agg = calculateBudgetAggregatedData(resp);
                  setBudgetAggregatedData(agg);
                  setBudgetDrillLevel(1);
                } else if (budgetDrillLevel === 1) {
                  setBudgetSelectedCompany(null);
                  setSelectedCompany(null);
                  setBudgetWindowStart(0);
                  const resp = await getFilteredBudgetData({
                    start_month: budgetStartMonth,
                    end_month: budgetEndMonth,
                    type: budgetType,
                  } as any);
                  setBudgetRawData(resp);
                  const agg = calculateBudgetAggregatedData(resp);
                  setBudgetAggregatedData(agg);
                  setBudgetDrillLevel(0);
                }
              } finally {
                setIsLoadingBudget(false);
              }
            }}
          >
            Back
          </Button>
        )}
      </Group>

      <Box
        style={{
          height: 320,
          width: "100%",
          margin: "0 auto",
          position: "relative",
          top: 10,
          // marginBottom: 10,
        }}
      >
        {isLoadingBudget ? (
          <Center h={300}>
            <Loader size="lg" color="#105476" />
          </Center>
        ) : (
          <ReactECharts
            option={budgetBarChartOption}
            style={budgetBarChartStyle}
            onEvents={budgetBarChartEvents}
          />
        )}
      </Box>

      {/* Pagination buttons */}
      <Group justify="flex-end" pt="xs">
        {budgetPaginationButtons.showPrev && (
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => setBudgetWindowStart((s) => Math.max(0, s - 3))}
          >
            <IconChevronLeft size={14} />
            <Text size="sm">Prev</Text>
          </Button>
        )}
        {budgetPaginationButtons.showNext && (
          <Button
            size="compact-xs"
            variant="subtle"
            aria-label="Next"
            onClick={() => setBudgetWindowStart((s) => s + 3)}
          >
            <Text size="sm">Next</Text>
            <IconChevronRight size={14} />
          </Button>
        )}
      </Group>

      {/* Budget Values Display Under Chart */}
      {isLoadingBudget ? (
        <Center mt="md">
          <Text c="dimmed">Loading chart data...</Text>
        </Center>
      ) : (
        <Stack gap="sm" align="center" mt="md"></Stack>
      )}
    </Card>
  );
};

export default Budget;
