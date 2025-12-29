import { useMemo } from "react";
import { Card, Group, Text, Button, Box, Loader, Center } from "@mantine/core";
import ReactECharts from "echarts-for-react";

type MetricType = "outstanding" | "overdue";

interface OutstandingProps {
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
  handlePieClick: (params: any) => void;
}

const Outstanding = ({
  drillLevel,
  selectedMetric,
  companySummary,
  locationData,
  salespersonData,
  selectedCompanyCtx,
  selectedCompany,
  selectedLocation,
  isLoadingOutstandingChart,
  handleOutstandingViewAll,
  handleBack,
  handlePieClick,
}: OutstandingProps) => {
  // Build current series data based on drillLevel
  const buildCurrentSeriesData = () => {
    if (drillLevel === 0) {
      return (companySummary || [])
        .map((c: any) => ({
          value:
            selectedMetric === "outstanding"
              ? parseFloat(c.total_outstanding || 0)
              : parseFloat(c.total_overdue || 0),
          name: c.company_name,
          _meta: {
            type: "company",
            outstanding: parseFloat(c.total_outstanding || 0),
            overdue: parseFloat(c.total_overdue || 0),
            branch_code: c.branch_code,
          },
        }))
        .filter((item) => item.value > 0);
    }
    if (drillLevel === 1) {
      return (locationData || [])
        .map((loc: any) => ({
          value:
            selectedMetric === "outstanding"
              ? parseFloat(loc?.summary?.total_outstanding || 0)
              : parseFloat(loc?.summary?.total_overdue || 0),
          name: loc.location || loc.Location,
          _meta: {
            type: "location",
            location: loc.location || loc.Location,
            outstanding: parseFloat(loc?.summary?.total_outstanding || 0),
            overdue: parseFloat(loc?.summary?.total_overdue || 0),
          },
        }))
        .filter((item) => item.value > 0);
    }
    // drillLevel === 2 -> salesperson list
    return (salespersonData || [])
      .map((sp: any) => ({
        value:
          selectedMetric === "outstanding"
            ? parseFloat(sp.local_outstanding || 0)
            : parseFloat(sp.overdue || 0),
        name: sp.salesman_name,
        _meta: {
          type: "salesperson",
          salesman: sp.salesman_name,
          outstanding: parseFloat(sp.local_outstanding || 0),
          overdue: parseFloat(sp.overdue || 0),
        },
      }))
      .filter((item) => item.value > 0);
  };

  // Pie chart configuration with drilldown and legend/labels
  const pieChartOption = useMemo(() => {
    const dataSeries = buildCurrentSeriesData();
    const titleText = "";

    // Compute explicit totals for level 0 based on GET summary
    let level0Total = 0;
    if (drillLevel === 0) {
      if (selectedMetric === "outstanding") {
        level0Total = (companySummary || []).reduce(
          (s, c) => s + parseFloat(c.total_outstanding || 0),
          0
        );
      } else {
        level0Total = (companySummary || []).reduce(
          (s, c) => s + parseFloat(c.total_overdue || 0),
          0
        );
      }
    }

    return {
      title: {
        text: titleText,
        left: "center",
        top: 0,
        textStyle: { fontSize: 12, fontWeight: 600 },
      },
      tooltip: {
        trigger: "item",
        position: function (
          point: any,
          _params: any,
          _dom: any,
          _rect: any,
          size: any
        ) {
          const tooltipWidth = size.contentSize[0];
          const chartWidth = size.viewSize[0];
          return [
            Math.min(point[0] + 20, chartWidth - tooltipWidth - 10),
            point[1] - 10,
          ];
        },
        formatter: (params: any) => {
          const meta = params.data._meta || {};
          const outstanding = meta.outstanding || 0;
          const overdue = meta.overdue || 0;

          let tooltip = "";

          if (drillLevel === 0) {
            tooltip += `${params.name}<br/>`;
          } else if (drillLevel === 1) {
            tooltip += `${params.name}<br/>`;
          } else if (drillLevel === 2) {
            tooltip += `${params.name}<br/>`;
          }

          tooltip += `OS: ${outstanding.toLocaleString()}<br/>`;
          tooltip += `OD: ${overdue.toLocaleString()}<br/>`;

          let totalSalespersons = 0;

          if (drillLevel === 0) {
            const companyData = companySummary.find(
              (c) => c.company_name === params.name
            );
            totalSalespersons = companyData?.total_salesperson || 0;
          } else if (drillLevel === 1) {
            const locationDataItem = locationData.find(
              (loc) => (loc.location || loc.Location) === params.name
            );
            totalSalespersons = locationDataItem?.summary?.total || 0;
          } else if (drillLevel === 2) {
            const locationDataItem = locationData.find((loc) =>
              loc.outstanding_data?.some(
                (sp: any) => sp.salesman_name === params.name
              )
            );
            totalSalespersons = locationDataItem?.summary?.total || 0;
          }

          if (drillLevel !== 2) {
            tooltip += `Salesperson: ${totalSalespersons}`;
          }

          return tooltip;
        },
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#ccc",
        borderWidth: 1,
        textStyle: {
          color: "#333",
        },
      },
      legend: {
        show: false,
      },
      series: [
        // Outer background circle (light gray) - larger radius
        {
          type: "pie",
          radius: ["0%", "90%"],
          center: ["50%", "50%"],
          data: [{ value: 100, itemStyle: { color: "#F5F5F5" } }],
          label: { show: false },
          silent: true,
          z: 1,
        },
        // Inner background circle (light gray) - same as outside
        {
          type: "pie",
          radius: ["0%", "45%"],
          center: ["50%", "50%"],
          data: [{ value: 100, itemStyle: { color: "#F5F5F5" } }],
          label: { show: false },
          silent: true,
          z: 1,
        },
        // Center white circle
        {
          type: "pie",
          radius: ["0%", "25%"],
          center: ["50%", "50%"],
          data: [{ value: 100, itemStyle: { color: "#FFFFFF" } }],
          label: { show: false },
          silent: true,
          z: 1,
        },
        // Main data circle (ring design) - interactive
        {
          type: "pie",
          radius: ["50%", "70%"],
          center: ["50%", "50%"],
          data: dataSeries,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
          label: {
            show: true,
            overflow: "truncate",
            formatter: function (p: any) {
              return p.name;
            },
            fontSize: 10,
          },
          z: 2,
        },
      ],
      graphic: [],
    };
  }, [
    drillLevel,
    selectedMetric,
    companySummary,
    locationData,
    salespersonData,
    selectedCompanyCtx,
    selectedCompany,
    selectedLocation,
  ]);

  const pieChartStyle = useMemo(
    () => ({
      height: "100%",
      width: "100%",
      alignItems: "center",
    }),
    []
  );

  const pieChartEvents = useMemo(
    () => ({
      click: handlePieClick,
    }),
    [handlePieClick]
  );

  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      h={380}
      style={{ border: "1px solid #e9ecef" }}
    >
      <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
        <Text size="md" fw={500} c="Black">
          Outstanding vs Over Due
        </Text>
        <Group gap="xs" align="center">
          <Text
            size="md"
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
      </Group>
      <Group gap="xs" mb="md" justify="flex-end">
        {drillLevel > 1 && (
          <Button
            size="compact-xs"
            variant="light"
            ml="100px"
            onClick={handleBack}
          >
            Back
          </Button>
        )}
      </Group>

      <Box
        style={{
          height: 300,
          width: 300,
          margin: "0 auto",
          position: "relative",
        }}
      >
        {isLoadingOutstandingChart ? (
          <Center h={300}>
            <Loader size="lg" color="#105476" />
          </Center>
        ) : (
          <ReactECharts
            option={pieChartOption}
            style={pieChartStyle}
            onEvents={pieChartEvents}
          />
        )}
      </Box>
    </Card>
  );
};

export default Outstanding;
