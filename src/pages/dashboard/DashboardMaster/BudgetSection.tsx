import { Box } from "@mantine/core";
import BudgetBarChart from "./BudgetBarChart";
import { BudgetAggregatedData } from "../../../service/dashboard.service";

interface BudgetSectionProps {
  budgetDrillLevel: 0 | 1 | 2 | 3;
  budgetSelectedCompany: string | null;
  budgetSelectedSalesperson: string | null;
  budgetDateRange: { date_from: string; date_to: string };
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
  setBudgetDrillLevel: (level: 0 | 1 | 2 | 3) => void;
  setBudgetSelectedCompany: (company: string | null) => void;
  setBudgetSelectedSalesperson: (salesperson: string | null) => void;
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
  handleBudgetMonthFilterChange: (startMonth: string | null, endMonth: string | null) => void;
}

const BudgetSection = (props: BudgetSectionProps) => {
  return (
    <Box mb="lg">
      <BudgetBarChart {...props} />
    </Box>
  );
};

export default BudgetSection;

