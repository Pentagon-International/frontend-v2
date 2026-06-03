import { useMemo } from "react";
import { useBranchNumberFormat } from "../../../hooks/useBranchNumberFormat";
import {
  Box,
  Group,
  Text,
  Button,
  Select,
  SegmentedControl,
  Badge,
} from "@mantine/core";
import { BarChart, BarChartDataItem } from "../../../components";
import dayjs from "dayjs";
import {
  getFilteredBudgetData,
  calculateBudgetAggregatedData,
  calculateFinancialYearBudgetRangeForYear,
  BudgetAggregatedData,
} from "../../../service/dashboard.service";
import {
  dashboardPanelShell,
  dashboardPanelHeaderBand,
  dashboardPanelTitleStyle,
  dashboardViewAllStyle,
} from "./dashboardPanelStyles";

interface BudgetBarChartProps {
  // State props
  budgetDrillLevel: 0 | 1 | 2 | 3;
  budgetSelectedCompany: string | null;
  budgetSelectedSalesperson: string | null;
  budgetDateRange: { date_from: string; date_to: string };
  budgetRawData: any;
  budgetAggregatedData: BudgetAggregatedData;
  budgetHoverTotals: {
    budget: number;
    actual: number;
  } | null;
  isLoadingBudget: boolean;
  budgetStartMonth: string;
  budgetEndMonth: string;
  budgetType: "salesperson" | "non-salesperson";
  selectedYear: string | null;
  yearOptions: { value: string; label: string }[];
  fromMonthOptions: { value: string; label: string }[];
  toMonthOptions: { value: string; label: string }[];

  // Setters
  setBudgetDrillLevel: (level: 0 | 1 | 2 | 3) => void;
  setBudgetSelectedCompany: (company: string | null) => void;
  setBudgetSelectedSalesperson: (salesperson: string | null) => void;
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
  budgetRawData,
  isLoadingBudget,
  budgetStartMonth,
  budgetEndMonth,
  budgetType,
  selectedYear,
  yearOptions,
  fromMonthOptions,
  toMonthOptions,
  setBudgetDrillLevel,
  setBudgetRawData,
  setBudgetAggregatedData,
  setSearchSalesman,
  setSelectedCompany,
  setIsLoadingBudget,
  setSelectedYear,
  handleBudgetViewAll,
  handleBudgetBarClick,
  handleBudgetTypeChange,
  handleBudgetMonthFilterChange,
}: BudgetBarChartProps) => {
  const { numberLocale, currencySymbol } = useBranchNumberFormat();
  const budgetYAxisFormatter = useMemo(
    () => (value: number) =>
      `${currencySymbol}${(value / 1e6).toLocaleString(numberLocale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}M`,
    [currencySymbol, numberLocale],
  );

  // Memoized chart data preparation
  const barChartData = useMemo(() => {
    if (!budgetRawData?.data || !Array.isArray(budgetRawData.data)) {
      return [];
    }

    let chartData: BarChartDataItem[] = [];

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
    } else {
      const root = budgetRawData.data[0];
      if (!root) return [];

      const items = Array.isArray(root?.budget) ? root.budget : [];

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

    return chartData;
  }, [budgetRawData, budgetDrillLevel]);

  // Handle bar click
  const handleBarClickEvent = (params: any) => {
    const dataIndex = params.dataIndex;

    // Get the full item from raw data
    let item: any = null;

    if (budgetDrillLevel === 0) {
      item = budgetRawData?.data?.[dataIndex];
    } else {
      const root = budgetRawData?.data?.[0];
      if (root && Array.isArray(root.budget)) {
        item = root.budget[dataIndex];
      }
    }

    if (item) {
      handleBudgetBarClick({
        dataIndex,
        data: item,
        seriesName: params.seriesName,
      });
    }
  };

  return (
    <Box style={{ ...dashboardPanelShell, flex: "0 0 auto" }}>
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Group
            gap="sm"
            align="center"
            wrap="nowrap"
            style={{ flex: 1, minWidth: 0 }}
          >
            <Text style={dashboardPanelTitleStyle}>Budget vs Actual</Text>
            <Badge
              variant="light"
              color="#105476"
              size="sm"
              radius="sm"
              style={{ flexShrink: 0 }}
            >
              {budgetStartMonth} — {budgetEndMonth}
            </Badge>
          </Group>
          <Text
            size="sm"
            c="#105476"
            style={{ ...dashboardViewAllStyle, flexShrink: 0 }}
            onClick={handleBudgetViewAll}
          >
            View All
          </Text>
        </Group>
      </Box>

      <Group
        gap="sm"
        align="center"
        wrap="wrap"
        mb="md"
        style={{ rowGap: 8 }}
      >
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
          styles={{
            root: {
              backgroundColor: "#E8EDF5",
              fontFamily: "Inter, sans-serif",
            },
            label: {
              fontSize: "12px",
            },
          }}
        />
        <Select
          placeholder="Select Year"
          value={selectedYear}
          onChange={(value) => {
            if (value) {
              setSelectedYear(value);
              const yearRange = calculateFinancialYearBudgetRangeForYear(
                parseInt(value)
              );
              handleBudgetMonthFilterChange(
                yearRange.start_month,
                yearRange.end_month
              );
            }
          }}
          w={150}
          size="xs"
          data={yearOptions}
          styles={{
            input: { fontSize: "12px", fontFamily: "Inter, sans-serif" },
          }}
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

      {/* Back Button */}
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
        numberLocale={numberLocale}
        yAxisFormatter={budgetYAxisFormatter}
        showLegend={true}
        legendPosition="bottom"
      />
    </Box>
  );
};

export default BudgetBarChart;
