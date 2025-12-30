import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Box, Center, Loader } from "@mantine/core";

export interface BarChartDataItem {
  label: string;
  value1: number;
  value2: number;
  salesperson?: string | number; // Optional salesperson ID for Outstanding vs Overdue
  [key: string]: any; // Allow additional metadata
}

export interface BarChartProps {
  data: BarChartDataItem[];
  type: "outstanding-overdue" | "budget-actual";
  height?: number | string;
  isLoading?: boolean;
  onBarClick?: (params: any) => void;
  yAxisFormatter?: (value: number) => string;
  maxValue?: number;
  showLegend?: boolean;
  legendPosition?: "top" | "bottom";
}

const BarChart = ({
  data,
  type,
  height = 320,
  isLoading = false,
  onBarClick,
  yAxisFormatter,
  maxValue,
  showLegend = true,
  legendPosition = "bottom",
}: BarChartProps) => {
  const chartOption = useMemo(() => {
    const labels = data.map((item) => item.label);
    const value1Data = data.map((item) => item.value1);
    const value2Data = data.map((item) => item.value2);
    const salespersonData = data.map((item) => item.salesperson);

    // Determine colors and labels based on type
    const isOutstandingOverdue = type === "outstanding-overdue";
    
    const series1Name = isOutstandingOverdue ? "Outstanding" : "Actual";
    const series2Name = isOutstandingOverdue ? "Overdue" : "Budget";
    
    // Colors matching the image exactly
    // Outstanding: Light blue (#A3D5F0)
    // Overdue: Light pink/red (#F5A8A8)
    // Actual: Light blue (#A7D8F0)
    // Budget: Light pink/red (#F5A3A3)
    const series1Color = isOutstandingOverdue ? "#A3D5F0" : "#A7D8F0"; // Light blue for Outstanding and Actual
    const series2Color = isOutstandingOverdue ? "#F5A8A8" : "#F5A3A3"; // Light pink for Overdue and Budget

    // Calculate max value for Y-axis
    const allValues = [...value1Data, ...value2Data];
    const calculatedMax = maxValue || Math.max(...allValues, 0);
    // For Outstanding vs Overdue, add more headroom (20%) for salesperson labels
    const multiplier = isOutstandingOverdue ? 1.2 : 1.1;
    const yAxisMax = calculatedMax > 0 ? Math.ceil(calculatedMax * multiplier) : 100;

    // Format Y-axis labels
    const defaultFormatter = (value: number) => {
      if (isOutstandingOverdue) {
        // For Outstanding vs Overdue: show in thousands (250k format)
        if (value === 0) return "0";
        if (value >= 1000) {
          const thousands = value / 1000;
          return `${thousands.toFixed(0)}k`;
        }
        return value.toFixed(0);
      } else {
        // For Budget vs Actual: show in millions (250m format)
        return `₹${(value / 1000000).toFixed(1)}M`;
      }
    };

    const formatter = yAxisFormatter || defaultFormatter;

    // Tooltip formatter
    const tooltipFormatter = (params: any) => {
      if (Array.isArray(params)) {
        const param = params[0];
        const dataIndex = param.dataIndex;
        const item = data[dataIndex];
        
        let tooltip = `<div style="font-weight: 600; margin-bottom: 4px;">${item.label}</div>`;
        
        params.forEach((p: any) => {
          const value = typeof p.value === "number" ? p.value : p.value[1];
          tooltip += `<div style="margin: 2px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; background-color: ${p.color}; margin-right: 5px; border-radius: 2px;"></span>
            ${p.seriesName}: ${value.toLocaleString("en-IN")}
          </div>`;
        });

        // Add salesperson info for Outstanding vs Overdue
        if (isOutstandingOverdue && item.salesperson) {
          tooltip += `<div style="margin-top: 4px; font-weight: 500;">Salesperson: ${item.salesperson}</div>`;
        }

        return tooltip;
      }
      return "";
    };

    // Create graphic elements for salesperson labels at fixed top position
    const graphicElements = isOutstandingOverdue ? data.map((item, index) => {
      if (!item.salesperson) return null;
      
      return {
        type: 'text',
        left: `${((index + 0.5) / labels.length) * 100}%`, // Center of each bar group
        top: '8%', // Fixed position from top
        style: {
          text: `Salesperson\n${item.salesperson}`,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 400,
          fill: '#666',
          lineHeight: 14,
        },
        silent: true,
      };
    }).filter(Boolean) : [];

    return {
      graphic: [],
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#ccc",
        borderWidth: 1,
        textStyle: {
          color: "#333",
          fontSize: 12,
        },
        formatter: tooltipFormatter,
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
      },
      legend: showLegend
        ? {
            data: [series1Name, series2Name],
            [legendPosition]: legendPosition === "bottom" ? 10 : 5,
            textStyle: {
              fontSize: 11,
              color: "#666",
            },
            itemGap: 20,
            itemWidth: 14,
            itemHeight: 10,
            icon: "rect",
          }
        : {
            show: false,
          },
      grid: {
        left: "5%",
        right: "4%",
        bottom: showLegend && legendPosition === "bottom" ? "15%" : "10%",
        top: isOutstandingOverdue ? "18%" : "10%", // More space at top for salesperson labels
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          fontSize: 10,
          color: "#666",
          rotate: labels.some((l) => l.length > 10) ? 45 : 0,
          interval: 0,
        },
        axisLine: {
          lineStyle: {
            color: "#e0e0e0",
          },
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: formatter,
          fontSize: 10,
          color: "#666",
        },
        splitLine: {
          lineStyle: {
            color: "#f0f0f0",
            type: "dashed",
          },
        },
        max: yAxisMax,
        minInterval: 1,
      },
      series: [
        {
          name: series1Name,
          type: "bar",
          stack: isOutstandingOverdue ? undefined : "total", // Side-by-side for Outstanding vs Overdue, stacked for Budget vs Actual
          data: value1Data,
          barWidth: isOutstandingOverdue ? "35%" : "60%", // Narrower bars for side-by-side layout
          barGap: isOutstandingOverdue ? "10%" : "0%", // Gap between bars in side-by-side layout
          itemStyle: {
            color: series1Color,
            borderRadius: isOutstandingOverdue ? [4, 4, 0, 0] : 0, // Rounded top for Outstanding vs Overdue
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
          label: {
            show: false,
          },
          // Add markPoint for salesperson labels at consistent height
          ...(isOutstandingOverdue && {
            markPoint: {
              symbol: "rect",
              symbolSize: [60, 30], // Rectangle to contain the text, centered between bars
              symbolOffset: [0, 0], // Center the symbol at the coordinate
              itemStyle: {
                color: "transparent",
                borderWidth: 0,
              },
              label: {
                show: true,
                formatter: (params: any) => {
                  const dataIndex = params.data.coord[0];
                  if (salespersonData[dataIndex]) {
                    return `Salesperson\n${salespersonData[dataIndex]}`;
                  }
                  return "";
                },
                fontSize: 10,
                color: "#666",
                fontWeight: 400,
                lineHeight: 14,
                position: "inside",
                align: "center",
                verticalAlign: "middle",
              },
              data: labels.map((_label: string, index: number) => ({
                coord: [index, yAxisMax * 0.95], // Position at 95% of Y-axis max for consistent height
                value: salespersonData[index],
              })),
              silent: true,
              animation: false,
            },
          }),
        },
        {
          name: series2Name,
          type: "bar",
          stack: isOutstandingOverdue ? undefined : "total", // Side-by-side for Outstanding vs Overdue, stacked for Budget vs Actual
          data: value2Data,
          barWidth: isOutstandingOverdue ? "35%" : "60%", // Narrower bars for side-by-side layout
          itemStyle: {
            color: series2Color,
            borderRadius: isOutstandingOverdue ? [4, 4, 0, 0] : 0, // Rounded top for Outstanding vs Overdue
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.3)",
            },
          },
          label: {
            show: false,
          },
        },
      ],
    };
  }, [data, type, maxValue, yAxisFormatter, showLegend, legendPosition]);

  const chartStyle = useMemo(
    () => ({
      height: typeof height === "number" ? `${height}px` : height,
      width: "100%",
    }),
    [height]
  );

  const chartEvents = useMemo(
    () => ({
      click: onBarClick || (() => {}),
    }),
    [onBarClick]
  );

  if (isLoading) {
    return (
      <Box style={{ height: typeof height === "number" ? `${height}px` : height }}>
        <Center h="100%">
          <Loader size="lg" color="#105476" />
        </Center>
      </Box>
    );
  }

  return (
    <Box style={{ height: typeof height === "number" ? `${height}px` : height }}>
      <ReactECharts
        option={chartOption}
        style={chartStyle}
        onEvents={chartEvents}
      />
    </Box>
  );
};

export default BarChart;

