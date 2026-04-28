import { Box, Text, Group } from "@mantine/core";
import OutstandingBarChart from "./OutstandingBarChart";
import {
  dashboardPanelShell,
  dashboardPanelHeaderBand,
  dashboardPanelBody,
  dashboardPanelTitleStyle,
  dashboardViewAllStyle,
} from "./dashboardPanelStyles";

interface OutstandingSectionProps {
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
  drillLevel,
  handleBack,
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
  handlePieClick,
}: OutstandingSectionProps) => {
  return (
    <Box style={dashboardPanelShell}>
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Box style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={dashboardPanelTitleStyle}>
              Outstanding vs Overdue
            </Text>
          </Box>
          <Group gap="md" wrap="nowrap" style={{ flexShrink: 0 }}>
            {drillLevel > 0 && (
              <Text
                size="sm"
                c="#64748B"
                fw={500}
                style={{
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                onClick={() => void handleBack()}
              >
                ← Back
              </Text>
            )}
            <Text
              size="sm"
              c="#105476"
              style={dashboardViewAllStyle}
              onClick={handleOutstandingViewAll}
            >
              View All
            </Text>
          </Group>
        </Group>
      </Box>

      <Box style={dashboardPanelBody}>
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
          handleBarClick={handlePieClick}
        />
      </Box>
    </Box>
  );
};

export default OutstandingSection;
