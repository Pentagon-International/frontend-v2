import { useMemo } from "react";
import { Card, Group, Text, Button, Box } from "@mantine/core";
import { BarChart, BarChartDataItem } from "../../../components";

type MetricType = "outstanding" | "overdue";

interface OutstandingBarChartProps {
  // State props
  drillLevel: 0 | 1 | 2;
  selectedMetric: MetricType;
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

  // Handlers
  handleOutstandingViewAll: () => void;
  handleBack: () => void;
  handleBarClick: (params: any) => void;
}

const OutstandingBarChart = ({
  drillLevel,
  companySummary,
  locationData,
  salespersonData,
  isLoadingOutstandingChart,
  handleOutstandingViewAll,
  handleBack,
  handleBarClick,
}: OutstandingBarChartProps) => {
  // Build bar chart data based on drillLevel
  const barChartData = useMemo((): BarChartDataItem[] => {
    if (drillLevel === 0) {
      // Company level
      return (companySummary || []).map((c: any) => ({
        label: c.company_name || "Company",
        value1: parseFloat(c.total_outstanding || 0),
        value2: parseFloat(c.total_overdue || 0),
        salesperson: c.total_salesperson || "",
        _meta: {
          type: "company",
          outstanding: parseFloat(c.total_outstanding || 0),
          overdue: parseFloat(c.total_overdue || 0),
          branch_code: c.branch_code,
          company_name: c.company_name,
        },
      }));
    }

    if (drillLevel === 1) {
      // Location level
      return (locationData || []).map((loc: any) => ({
        label: loc.location || loc.Location || "Location",
        value1: parseFloat(loc?.summary?.total_outstanding || 0),
        value2: parseFloat(loc?.summary?.total_overdue || 0),
        salesperson:
          loc?.summary?.total || loc?.summary?.total_salesperson || "",
        _meta: {
          type: "location",
          location: loc.location || loc.Location,
          outstanding: parseFloat(loc?.summary?.total_outstanding || 0),
          overdue: parseFloat(loc?.summary?.total_overdue || 0),
        },
      }));
    }

    // drillLevel === 2: Salesperson level
    return (salespersonData || []).map((sp: any) => ({
      label: sp.salesman_name || "Salesperson",
      value1: parseFloat(sp.local_outstanding || 0),
      value2: parseFloat(sp.overdue || 0),
      salesperson: sp.salesman_id || "",
      _meta: {
        type: "salesperson",
        salesman: sp.salesman_name,
        outstanding: parseFloat(sp.local_outstanding || 0),
        overdue: parseFloat(sp.overdue || 0),
      },
    }));
  }, [drillLevel, companySummary, locationData, salespersonData]);

  // Handle bar click event
  const handleBarClickEvent = (params: any) => {
    const dataIndex = params.dataIndex;
    const item = barChartData[dataIndex];

    if (item && item._meta) {
      handleBarClick({
        data: {
          _meta: item._meta,
          name: item.label,
        },
      });
    }
  };

  return (
    <Box
      style={{
        border: "1px solid #F7F7F7",
        borderRadius: "8px",
        padding: "16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Group justify="space-between" align="center" mb="sm" wrap="nowrap">
        <Group gap="xs" align="center">
          {drillLevel > 0 && (
            <Button size="compact-xs" variant="light" onClick={handleBack}>
              Back
            </Button>
          )}
        </Group>
        <Text
          size="sm"
          c="#105476"
          style={{
            textDecoration: "underline",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onClick={handleOutstandingViewAll}
        >
          View All
        </Text>
      </Group>

      <Box
        style={{
          flex: 1,
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <BarChart
          data={barChartData}
          type="outstanding-overdue"
          height={350}
          isLoading={isLoadingOutstandingChart}
          onBarClick={handleBarClickEvent}
          showLegend={true}
          legendPosition="bottom"
        />
      </Box>
    </Box>
  );
};

export default OutstandingBarChart;
