import { useMemo } from "react";
import { Card, Group, Text, Button, Select, SegmentedControl } from "@mantine/core";
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
    <Card
      shadow="sm"
      p="md"
      radius="md"
      style={{ border: "1px solid #e9ecef", height: "100%" }}
    >
      {/* Title and Controls */}
      <Group justify="space-between" align="center" mb="md">
        <Text 
        size="lg"
        fw={500}
        c="#22252B"
        style={{ fontFamily: "Inter, sans-serif" }}
        >
          Budget vs Actual
        </Text>
        <Group gap="sm">
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
                backgroundColor: "#f1f3f5",
                fontFamily: "Inter, sans-serif",
              },
              label: {
                fontSize: "12px",
              },
            }}
          />
            <Group gap="xs" align="center">
        <Select
            placeholder="Select Period"
            value={selectedYear}
            onChange={(value) =>
              setSelectedYear(value)
            }
            w={150}
            size="xs"
            data={[
              { value: "2023", label: "2023" },
              { value: "2024", label: "2024" },
              { value: "2025", label: "2025" },
            ]}
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
      
        </Group>
      </Group>

      {/* Header row: Month filters + View All */}
      <Group justify="end" align="center" mb="sm" gap="xs">
      
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
        showLegend={true}
        legendPosition="bottom"
      />
    </Card>
  );
};

export default BudgetBarChart;

