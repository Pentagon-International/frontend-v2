import OutstandingVsOverdueCard from "./OutstandingVsOverdueCard";

interface OutstandingSectionProps {
  globalSearch?: string;
  drillLevel: 0 | 1 | 2;
  handleBack: () => void | Promise<void>;
  selectedMetric: "outstanding" | "overdue";
  companySummary: any[];
  locationData: any[];
  salespersonData: any[];
  selectedCompanyCtx: {
    company?: string;
    branch_code?: string;
    currency?: string;
  };
  selectedCompany: string | null;
  selectedLocation: string | null;
  contextTotals: {
    outstanding: number;
    overdue: number;
  };
  hoverTotals: {
    outstanding: number;
    overdue: number;
  } | null;
  isLoadingOutstandingChart: boolean;
  handleOutstandingViewAll: () => void;
  handlePieClick: (payload: any) => void;
}

const OutstandingSection = ({
  selectedCompany,
  handleOutstandingViewAll,
  globalSearch,
}: OutstandingSectionProps) => {
  const company = selectedCompany || "PENTAGON INDIA";

  return (
    <OutstandingVsOverdueCard
      company={company}
      onViewAll={handleOutstandingViewAll}
      globalSearch={globalSearch}
    />
  );
};

export default OutstandingSection;
