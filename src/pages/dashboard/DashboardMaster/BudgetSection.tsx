import BudgetVsActualCard from "./BudgetVsActualCard";
import { BudgetAggregatedData } from "../../../service/dashboard.service";

/** Props the dashboard parent keeps in sync; only a subset is forwarded to `BudgetVsActualCard`. */
export interface BudgetSectionProps {
  budgetDrillLevel: 0 | 1 | 2 | 3;
  budgetSelectedCompany: string | null;
  budgetSelectedSalesperson: string | null;
  budgetDateRange: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  budgetRawData: any;
  budgetAggregatedData: BudgetAggregatedData;
  budgetHoverTotals: { actual: number; sales: number } | null;
  isLoadingBudget: boolean;
  budgetStartMonth: string;
  budgetEndMonth: string;
  budgetType: "salesperson" | "non-salesperson";
  selectedYear: string | null;
  yearOptions: { value: string; label: string }[];
  fromMonthOptions: { value: string; label: string }[];
  toMonthOptions: { value: string; label: string }[];
  setBudgetDrillLevel: (level: 0 | 1 | 2 | 3) => void;
  setBudgetSelectedCompany: (company: string | null) => void;
  setBudgetSelectedSalesperson: (salesperson: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBudgetRawData: (data: any) => void;
  setBudgetAggregatedData: (data: BudgetAggregatedData) => void;
  setSearchSalesman: (value: string) => void;
  setSelectedCompany: (company: string | null) => void;
  setIsLoadingBudget: (loading: boolean) => void;
  setBudgetType: (type: "salesperson" | "non-salesperson") => void;
  setSelectedYear: (year: string | null) => void;
  handleBudgetViewAll: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleBudgetBarClick: (data: any) => void;
  handleBudgetTypeChange: (value: "salesperson" | "non-salesperson") => void;
  handleBudgetMonthFilterChange: (
    startMonth: string | null,
    endMonth: string | null
  ) => void;
}

const BudgetSection = ({
  budgetRawData,
  budgetAggregatedData,
  budgetType,
  selectedYear,
  budgetStartMonth,
  budgetEndMonth,
  yearOptions,
  fromMonthOptions,
  toMonthOptions,
  handleBudgetViewAll,
  handleBudgetTypeChange,
  handleBudgetMonthFilterChange,
  setSelectedYear,
}: BudgetSectionProps) => {
  return (
    <BudgetVsActualCard
      budgetRawData={budgetRawData}
      budgetAggregatedData={budgetAggregatedData}
      budgetType={budgetType}
      selectedYear={selectedYear}
      budgetStartMonth={budgetStartMonth}
      budgetEndMonth={budgetEndMonth}
      yearOptions={yearOptions}
      fromMonthOptions={fromMonthOptions}
      toMonthOptions={toMonthOptions}
      handleBudgetViewAll={handleBudgetViewAll}
      handleBudgetTypeChange={handleBudgetTypeChange}
      handleBudgetMonthFilterChange={handleBudgetMonthFilterChange}
      setSelectedYear={setSelectedYear}
    />
  );
};

export default BudgetSection;
