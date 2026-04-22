import { useMemo, useState } from "react";
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const isOutstandingOverdue = type === "outstanding-overdue";
  
  // Extract labels for use in both chartOption and chartEvents
  const labels = useMemo(() => data.map((item) => item.label), [data]);

  const chartOption = useMemo(() => {
    const value1Data = data.map((item) => item.value1);
    const value2Data = data.map((item) => item.value2);

    const series1Name = isOutstandingOverdue ? "Outstanding" : "Actual";
    const series2Name = isOutstandingOverdue ? "Overdue" : "Budget";
    
    // Softer pastel colors to mirror the provided design
    const series1Color = isOutstandingOverdue ? "#BCDFF5" : "#A7D8F0";
    const series2Color = isOutstandingOverdue ? "#F6C7C9" : "#F5A3A3";

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

    // Use series labels instead of graphics for salesperson counts
    const graphicElements: any[] = [];

    const salespersonLabel = isOutstandingOverdue
      ? {
          show: true,
          position: "top",
          formatter: (params: any) => {
            if (hoveredIndex === params.dataIndex) return "";
            const item = data[params.dataIndex];
            if (!item?.salesperson) return "";
            return `Salesperson ${item.salesperson}`;
          },
          fontSize: 10,
          fontWeight: 500,
          color: "#98A2B3",
          lineHeight: 14,
        }
      : {
          show: false,
        };

    return {
      backgroundColor: "#fff",
      graphic: graphicElements as any,
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        borderColor: "#E5E7EB",
        borderWidth: 1,
        shadowBlur: 12,
        shadowColor: "rgba(16, 84, 118, 0.08)",
        padding: 12,
        textStyle: {
          color: "#0F172A",
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
              color: "#98A2B3",
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
        top: isOutstandingOverdue ? "22%" : "10%", // More space at top for salesperson labels
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        triggerEvent: true, // Enable click events on axis labels
        axisLabel: {
          fontSize: 10,
          color: "#98A2B3",
          rotate: isOutstandingOverdue ? 0 : 0, // tilt for budget to keep all labels visible
          hideOverlap: true,
          overflow: isOutstandingOverdue ? undefined : "break",
          width: isOutstandingOverdue ? undefined : 50,          interval: 0,
        },
        axisLine: {
          lineStyle: {
            color: "#E5E7EB",
          },
        },
        axisTick: {
          show: false,
        },
        axisPointer: {
          show: true,
          type: "shadow",
          shadowStyle: {
            color: "rgba(16, 84, 118, 0.08)",
          },
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: formatter,
          fontSize: 10,
          color: "#98A2B3",
        },
        splitLine: {
          lineStyle: {
            color: "#F2F4F7",
            type: "dotted",
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
          barWidth: isOutstandingOverdue ? "32%" : "60%", // Narrower bars for side-by-side layout
          barGap: isOutstandingOverdue ? "0%" : "0%", // Gap between bars in side-by-side layout
          itemStyle: {
            color: series1Color,
            cursor: isOutstandingOverdue ? "pointer" : "default",
            borderRadius: isOutstandingOverdue ? [6, 6, 0, 0] : 0, // Rounded top for Outstanding vs Overdue
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 14,
              shadowOffsetX: 0,
              shadowColor: "rgba(16, 84, 118, 0.25)",
            },
          },
          label: {
            ...salespersonLabel,
          },
          labelLayout: isOutstandingOverdue
            ? () => ({
                y: 10, // keep all salesperson labels at a consistent height
                align: "center",
                verticalAlign: "top",
              })
            : undefined,
        },
        {
          name: series2Name,
          type: "bar",
          stack: isOutstandingOverdue ? undefined : "total", // Side-by-side for Outstanding vs Overdue, stacked for Budget vs Actual
          data: value2Data,
          barWidth: isOutstandingOverdue ? "32%" : "60%", // Narrower bars for side-by-side layout
          itemStyle: {
            color: series2Color,
            cursor: isOutstandingOverdue ? "pointer" : "default",
            borderRadius: isOutstandingOverdue ? [6, 6, 0, 0] : 0, // Rounded top for Outstanding vs Overdue
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 14,
              shadowOffsetX: 0,
              shadowColor: "rgba(16, 84, 118, 0.25)",
            },
          },
          label: {
            show: false,
          },
        },
      ],
    };
  }, [
    data,
    type,
    maxValue,
    yAxisFormatter,
    showLegend,
    legendPosition,
    hoveredIndex,
    isOutstandingOverdue,
    labels,
  ]);

  const chartStyle = useMemo(
    () => ({
      height: typeof height === "number" ? `${height}px` : height,
      width: "100%",
    }),
    [height]
  );

  const chartEvents = useMemo(() => {
    const baseEvents: any = {
      click: (params: any) => {
        if (!onBarClick) return;
        
        // Handle click on x-axis labels
        if (params.componentType === "xAxis") {
          // Create a synthetic event object that matches bar click structure
          const syntheticParams = {
            componentType: "series",
            componentSubType: "bar",
            seriesType: "bar",
            seriesIndex: 0,
            seriesName: isOutstandingOverdue ? "Outstanding" : "Actual",
            name: params.value,
            dataIndex: labels.indexOf(params.value),
            data: data[labels.indexOf(params.value)],
            value: data[labels.indexOf(params.value)]?.value1 || 0,
          };
          onBarClick(syntheticParams);
        } 
        // Handle normal bar clicks
        else {
          onBarClick(params);
        }
      },
    };

    if (isOutstandingOverdue) {
      baseEvents.mouseover = (params: any) => {
        if (
          params?.componentSubType === "bar" &&
          typeof params?.dataIndex === "number"
        ) {
          setHoveredIndex(params.dataIndex);
        }
      };

      baseEvents.mouseout = () => setHoveredIndex(null);
      baseEvents.globalout = () => setHoveredIndex(null);
    }

    return baseEvents;
  }, [onBarClick, isOutstandingOverdue, data, labels]);

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

