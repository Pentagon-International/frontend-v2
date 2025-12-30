import { Box, Text, Group, Select } from "@mantine/core";
import OutstandingBarChart from "./OutstandingBarChart";

interface OutstandingSectionProps {
  drillLevel: 0 | 1 | 2;
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
  handleBack: () => void;
  handlePieClick: (payload: any) => void;
  outstandingPeriod: string;
  setOutstandingPeriod: (value: string) => void;
}

const OutstandingSection = ({
  drillLevel,
  selectedMetric,
  companySummary,
  locationData,
  salespersonData,
  selectedCompanyCtx,
  selectedCompany,
  selectedLocation,
  contextTotals,
  hoverTotals,
  isLoadingOutstandingChart,
  handleOutstandingViewAll,
  handleBack,
  handlePieClick,
  outstandingPeriod,
  setOutstandingPeriod,
}: OutstandingSectionProps) => {
  return (
    <Box
      style={{
        border: "1px solid #F7F7F7",
        borderRadius: "8px",
        padding: "12px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Group justify="space-between" align="center" mb="md">
        <Text
          size="md"
          fw={500}
          c="#22252B"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Outstanding vs Overdue
        </Text>
        <Select
          placeholder="Select Period"
          value={outstandingPeriod}
          onChange={(value) => setOutstandingPeriod(value || "last_30_days")}
          w={150}
          size="xs"
          data={[
            { value: "last_30_days", label: "Last 30 days" },
            { value: "last_60_days", label: "Last 60 days" },
            { value: "last_90_days", label: "Last 90 days" },
            { value: "last_6_months", label: "Last 6 Months" },
            { value: "last_year", label: "Last Year" },
          ]}
          styles={{
            input: { fontSize: "12px" },
          }}
        />
      </Group>

      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <OutstandingBarChart
          drillLevel={drillLevel}
          selectedMetric={selectedMetric}
          companySummary={companySummary}
          locationData={locationData}
          salespersonData={salespersonData}
          selectedCompanyCtx={selectedCompanyCtx}
          selectedCompany={selectedCompany}
          selectedLocation={selectedLocation}
          contextTotals={contextTotals}
          hoverTotals={hoverTotals}
          isLoadingOutstandingChart={isLoadingOutstandingChart}
          handleOutstandingViewAll={handleOutstandingViewAll}
          handleBack={handleBack}
          handleBarClick={handlePieClick}
        />
      </Box>
    </Box>
  );
};

export default OutstandingSection;
