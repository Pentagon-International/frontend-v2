import { useMemo } from "react";
import {
  Card,
  Group,
  Text,
  Button,
  Select,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { BarChart, BarChartDataItem } from "../../../components";
import dayjs from "dayjs";
import {
  getFilteredBudgetData,
  calculateBudgetAggregatedData,
  BudgetAggregatedData,
} from "../../../service/dashboard.service";

interface BudgetBarChartProps {
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

const BudgetBarChart = ({
  budgetDrillLevel,
  budgetSelectedCompany,
  budgetSelectedSalesperson,
  budgetWindowStart,
  budgetRawData,
  isLoadingBudget,
  budgetStartMonth,
  budgetEndMonth,
  budgetType,
  fromMonthOptions,
  toMonthOptions,
  setBudgetDrillLevel,
  setBudgetWindowStart,
  setBudgetRawData,
  setBudgetAggregatedData,
  setSearchSalesman,
  setSelectedCompany,
  setIsLoadingBudget,
  handleBudgetViewAll,
  handleBudgetBarClick,
  handleBudgetMonthFilterChange,
}: BudgetBarChartProps) => {
  // Memoized chart data preparation
  const { barChartData, totalItems } = useMemo(() => {
    if (!budgetRawData?.data || !Array.isArray(budgetRawData.data)) {
      return { barChartData: [], totalItems: 0 };
    }

    let chartData: BarChartDataItem[] = [];
    let total = 0;

    if (budgetDrillLevel === 0) {
      // At level 0, show all companies
      chartData = budgetRawData.data.map((company: any) => ({
        label: company?.company_name || "Company",
        value1: Number(company?.summary?.total_actual_budget || 0),
        value2: Number(company?.summary?.total_sales_budget || 0),
        _meta: {
          type: "company",
          company_name: company?.company_name,
          actual: Number(company?.summary?.total_actual_budget || 0),
          budget: Number(company?.summary?.total_sales_budget || 0),
        },
      }));
      total = budgetRawData.data.length;
    } else {
      const root = budgetRawData.data[0];
      if (!root) return { barChartData: [], totalItems: 0 };

      const items = Array.isArray(root?.budget) ? root.budget : [];
      total = items.length;

      if (budgetDrillLevel === 1) {
        chartData = items.map((i: any) => ({
          label: i.salesperson || "-",
          value1: Number(i.actual_budget) || 0,
          value2: Number(i.sales_budget) || 0,
          _meta: {
            type: "salesperson",
            salesperson: i.salesperson,
            actual: Number(i.actual_budget) || 0,
            budget: Number(i.sales_budget) || 0,
          },
        }));
      } else {
        chartData = items.map((i: any) => ({
          label: i.month ? dayjs(i.month + "-01").format("MMM") : "-",
          value1: Number(i.actual_budget) || 0,
          value2: Number(i.sales_budget) || 0,
          _meta: {
            type: "month",
            month: i.month,
            actual: Number(i.actual_budget) || 0,
            budget: Number(i.sales_budget) || 0,
          },
        }));
      }
    }

    // Pagination
    const pageSize = 6;
    if (chartData.length > pageSize) {
      const start = budgetWindowStart;
      const end = start + pageSize;
      chartData = chartData.slice(start, end);
    }

    return { barChartData: chartData, totalItems: total };
  }, [budgetRawData, budgetDrillLevel, budgetWindowStart]);

  // Memoized pagination button visibility
  const budgetPaginationButtons = useMemo(() => {
    const pageSize = 6;
    const showPrev = budgetWindowStart > 0;
    const showNext = budgetWindowStart + pageSize < totalItems;

    return { showPrev, showNext };
  }, [budgetWindowStart, totalItems]);

  // Handle bar click
  const handleBarClickEvent = (params: any) => {
    const dataIndex = params.dataIndex;
    const actualIndex = dataIndex + budgetWindowStart;
    
    // Get the full item from raw data
    let item: any = null;
    
    if (budgetDrillLevel === 0) {
      item = budgetRawData?.data?.[actualIndex];
    } else {
      const root = budgetRawData?.data?.[0];
      if (root && Array.isArray(root.budget)) {
        item = root.budget[actualIndex];
      }
    }

    if (item) {
      handleBudgetBarClick({
        dataIndex: actualIndex,
        data: item,
        seriesName: params.seriesName,
      });
    }
  };

  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      style={{ border: "1px solid #e9ecef", height: "100%" }}
    >
      {/* Header row: Month filters + View All */}
      <Group justify="space-between" align="center" mb="sm" gap="xs">
        <Group gap="xs" align="center">
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
        <Text
          size="sm"
          c="#105476"
          style={{
            textDecoration: "underline",
            cursor: "pointer",
          }}
          onClick={handleBudgetViewAll}
        >
          View All
        </Text>
      </Group>

      {/* Second row: Back Button */}
      <Group justify="space-between" align="center" mb="xs">
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

      <BarChart
        data={barChartData}
        type="budget-actual"
        height={320}
        isLoading={isLoadingBudget}
        onBarClick={handleBarClickEvent}
        showLegend={true}
        legendPosition="bottom"
      />

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
    </Card>
  );
};

export default BudgetBarChart;

