export type AnalyticsChatTable = {
  columns: string[];
  rows: Record<string, unknown>[];
  total_rows: number;
  truncated: boolean;
  title?: string;
  description?: string;
};

export type AnalyticsChatChart = {
  chart_type: string;
  title?: string;
  data: unknown;
  config?: Record<string, unknown>;
  width?: string | number;
  height?: string | number;
};

export type AnalyticsChatExport = {
  filename: string;
  total_rows: number;
  download_url: string;
};

/** POST /chat/message?type=analytics → response.data */
export type AnalyticsChatData = {
  session_id?: number | string;
  reply?: string;
  title?: string;
  summary?: string;
  table?: AnalyticsChatTable;
  chart?: AnalyticsChatChart;
  chart_requested?: boolean;
  export?: AnalyticsChatExport;
};

/** Stored on assistant messages (analytics live replies). */
export type AnalyticsMessagePayload = Pick<
  AnalyticsChatData,
  "summary" | "table" | "chart" | "chart_requested" | "export"
>;

export const parseAnalyticsChatData = (raw: unknown): AnalyticsChatData | null => {
  if (!raw || typeof raw !== "object") return null;
  return raw as AnalyticsChatData;
};

export const hasAnalyticsStructuredBlocks = (
  data: AnalyticsChatData | null | undefined,
): boolean => {
  if (!data) return false;
  return Boolean(
    (data.table?.rows && data.table.rows.length > 0) ||
      data.chart?.data ||
      data.export?.download_url,
  );
};

export const toAnalyticsMessagePayload = (
  data: AnalyticsChatData | null,
): AnalyticsMessagePayload | undefined => {
  if (!hasAnalyticsStructuredBlocks(data)) return undefined;
  return {
    summary: data?.summary,
    table: data?.table,
    chart: data?.chart,
    chart_requested: data?.chart_requested,
    export: data?.export,
  };
};
