import { FC, Suspense, lazy, useMemo } from "react";
import { Loader } from "@mantine/core";
import type { AnalyticsChatChart } from "./analyticsChatTypes";
import styles from "./Chatbot.module.css";

const Plot = lazy(() => import("react-plotly.js"));

type PlotlyFigure = {
  data?: unknown[];
  layout?: Record<string, unknown>;
};

/** API may send traces at chart.data (array) or a full figure { data, layout }. */
const asPlotlyFigure = (raw: unknown): PlotlyFigure | null => {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? { data: raw } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const figure = raw as PlotlyFigure;
  if (Array.isArray(figure.data)) return figure;
  return null;
};

/** Backend may attach non-Plotly metadata on chart.config (e.g. data_shape, source_file). */
const NON_PLOTLY_CONFIG_KEYS = new Set(["data_shape", "source_file"]);

const plotlyConfigFromChart = (config?: Record<string, unknown>): Record<string, unknown> => {
  if (!config) return {};
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !NON_PLOTLY_CONFIG_KEYS.has(key)),
  );
};

export const AnalyticsChatChartBlock: FC<{ chart: AnalyticsChatChart }> = ({ chart }) => {
  const figure = useMemo(() => asPlotlyFigure(chart.data), [chart.data]);
  if (!figure) return null;

  const height =
    typeof chart.height === "number"
      ? chart.height
      : typeof chart.height === "string"
        ? parseInt(chart.height, 10) || 360
        : 360;

  return (
    <div className={styles.analyticsBlock}>
      {chart.title ? <div className={styles.analyticsChartTitle}>{chart.title}</div> : null}
      <div className={styles.chartScroll}>
        <Suspense
          fallback={
            <div className={styles.chartLoading}>
              <Loader size="sm" color="blue" />
            </div>
          }
        >
          <Plot
            data={figure.data ?? []}
            layout={{
              ...(figure.layout ?? {}),
              autosize: true,
              margin: { t: 40, r: 20, b: 40, l: 50 },
            }}
            config={{
              responsive: true,
              displayModeBar: false,
              ...plotlyConfigFromChart(chart.config),
            }}
            style={{ width: "100%", height }}
            useResizeHandler
          />
        </Suspense>
      </div>
    </div>
  );
};
