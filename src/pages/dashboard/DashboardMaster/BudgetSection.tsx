import { Box, Text, Group, Select, SegmentedControl } from "@mantine/core";
import Budget from "./Budget";
import { BudgetAggregatedData } from "../../../service/dashboard.service";

interface BudgetSectionProps {
  budgetDrillLevel: 0 | 1 | 2;
  budgetSelectedCompany: string | null;
  budgetSelectedSalesperson: string | null;
  budgetDateRange: { date_from: string; date_to: string };
  budgetWindowStart: number;
  budgetRawData: any[];
  budgetAggregatedData: BudgetAggregatedData;
  budgetHoverTotals: { budget: number; actual: number } | null;
  isLoadingBudget: boolean;
  budgetStartMonth: string;
  budgetEndMonth: string;
  budgetType: "salesperson" | "non-salesperson";
  selectedYear: string | null;
  fromMonthOptions: { value: string; label: string }[];
  toMonthOptions: { value: string; label: string }[];
  setBudgetDrillLevel: (level: 0 | 1 | 2) => void;
  setBudgetSelectedCompany: (company: string | null) => void;
  setBudgetSelectedSalesperson: (salesperson: string | null) => void;
  setBudgetWindowStart: (start: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBudgetRawData: (data: any[]) => void;
  setBudgetAggregatedData: (data: BudgetAggregatedData) => void;
  setSearchSalesman: (value: string) => void;
  setSelectedCompany: (company: string | null) => void;
  setIsLoadingBudget: (loading: boolean) => void;
  setBudgetType: (type: "salesperson" | "non-salesperson") => void;
  setSelectedYear: (year: string | null) => void;
  handleBudgetViewAll: () => void;
  handleBudgetBarClick: (data: any) => void;
  handleBudgetTypeChange: (value: "salesperson" | "non-salesperson") => void;
  handleBudgetMonthFilterChange: (startMonth: string, endMonth: string) => void;
}

const BudgetSection = (props: BudgetSectionProps) => {
  const {
    budgetType,
    handleBudgetTypeChange,
    selectedYear,
    ...budgetProps
  } = props;

  return (
    <Box mb="lg">
      <Group justify="space-between" align="center" mb="md">
        <Text size="lg" fw={600}>
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
              },
              label: {
                fontSize: "12px",
              },
            }}
          />
          <Select
            placeholder="Select Period"
            value={selectedYear}
            onChange={(value) =>
              props.setSelectedYear(value)
            }
            w={150}
            size="xs"
            data={[
              { value: "2023", label: "2023" },
              { value: "2024", label: "2024" },
              { value: "2025", label: "2025" },
            ]}
            styles={{
              input: { fontSize: "12px" },
            }}
          />
        </Group>
      </Group>

      <Budget
        {...budgetProps}
        budgetType={budgetType}
        selectedYear={selectedYear}
      />
    </Box>
  );
};

export default BudgetSection;

