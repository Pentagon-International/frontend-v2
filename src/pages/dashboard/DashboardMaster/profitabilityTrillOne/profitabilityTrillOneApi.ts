import dayjs from "dayjs";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import { unwrapProfitabilityPayload } from "../accountsDashboardNormalize";
import type { ProfitabilityDrillSummary, ProfitabilityJob, ProfitabilityJobSegment } from "./types";

function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function responseCurrencyCode(data: Record<string, unknown>): string {
  return firstString(data.currency_code) || "INR";
}

export function serviceToJobSegment(service: string): ProfitabilityJobSegment {
  const lower = service.toLowerCase();
  if (lower.includes("ocean") && lower.includes("fcl")) return "ocean-fcl";
  if (lower.includes("ocean") && lower.includes("lcl")) return "ocean-lcl";
  if (lower.includes("air")) return "air";
  if (lower.includes("custom")) return "customs";
  if (lower.includes("road")) return "road";
  if (lower.includes("warehous")) return "warehousing";
  return "ocean-fcl";
}

function formatGpTrend(pct: unknown): string | undefined {
  if (pct === null || pct === undefined || pct === "") return undefined;
  const n = safeNumber(pct);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function normalizeDrillSummary(raw: unknown): ProfitabilityDrillSummary {
  const data = unwrapProfitabilityPayload(raw);
  const currencyCode = responseCurrencyCode(data);
  const kpis = (data.kpis ?? {}) as Record<string, unknown>;
  const previous = (data.previous_period ?? {}) as Record<string, unknown>;
  const change = (previous.change ?? {}) as Record<string, unknown>;
  const direction = (change.direction ?? {}) as Record<string, unknown>;

  const gpPct = change.gross_profit_pct;
  const gpDirection = firstString(direction.gross_profit);

  return {
    revenue: safeNumber(kpis.gross_revenue),
    cost: safeNumber(kpis.direct_cost),
    grossProfit: safeNumber(kpis.gross_profit),
    marginPct: safeNumber(kpis.gp_margin_pct),
    avgMarginPct: safeNumber(kpis.gp_margin_pct),
    jobCount: safeNumber(kpis.job_count),
    currencyCode,
    gpTrendText: formatGpTrend(gpPct),
    gpTrendUp: gpDirection === "increase" || (gpDirection === "" && safeNumber(gpPct) >= 0),
  };
}

function normalizeJobRowToJob(
  raw: unknown,
  index: number,
  defaultCurrency: string,
  defaultCustomerName = "",
): ProfitabilityJob {
  const row = (raw ?? {}) as Record<string, unknown>;
  const modeLabel = firstString(row.mode_label, row.modeLabel);
  const segment = serviceToJobSegment(modeLabel);
  const revenue = safeNumber(row.revenue);
  const cost = safeNumber(row.cost);
  const grossProfit = safeNumber(row.gross_profit, revenue - cost);
  const marginRaw = row.margin_pct ?? row.marginPct;
  const marginPct =
    marginRaw === null || marginRaw === undefined || marginRaw === ""
      ? null
      : safeNumber(marginRaw);
  const jobId = firstString(row.job_id, row.jobId, row.label);
  const branchCode = firstString(row.branch_code).toLowerCase();
  const jobDate = firstString(row.job_date, row.jobDate);

  return {
    id: jobId || `job-${safeNumber(row.sno, index + 1)}`,
    customer:
      firstString(row.customer_name, row.customerName, defaultCustomerName, row.label, row.job_id) ||
      "—",
    segment,
    branch: branchCode || "mum",
    lane: firstString(row.lane, row.mix_label, row.subtitle) || "—",
    rep: firstString(row.salesperson) || "—",
    revenue,
    cost,
    grossProfit,
    marginPct,
    currencyCode: firstString(row.currency_code) || defaultCurrency,
    delivered: jobDate || "—",
  };
}

function normalizeCustomerRowToJob(
  raw: unknown,
  serviceName: string,
  index: number,
  defaultCurrency: string,
): ProfitabilityJob {
  const row = (raw ?? {}) as Record<string, unknown>;
  const segment = serviceToJobSegment(serviceName);
  const revenue = safeNumber(row.revenue);
  const cost = safeNumber(row.cost);
  const grossProfit = safeNumber(row.gross_profit, revenue - cost);
  const marginRaw = row.margin_pct ?? row.marginPct;
  const marginPct =
    marginRaw === null || marginRaw === undefined || marginRaw === ""
      ? null
      : safeNumber(marginRaw);
  const jobCount = safeNumber(row.job_count);
  const customerCode = firstString(row.customer_code);
  const branchCode = firstString(row.branch_code).toLowerCase();

  return {
    id: customerCode || `customer-${safeNumber(row.sno, index + 1)}`,
    customer: firstString(row.label, row.customer_name) || "—",
    segment,
    branch: branchCode || "mum",
    lane: firstString(row.mix_label, row.subtitle) || "—",
    rep: firstString(row.salesperson) || "—",
    revenue,
    cost,
    grossProfit,
    marginPct,
    currencyCode: firstString(row.currency_code) || defaultCurrency,
    delivered: jobCount > 0 ? `${jobCount} jobs` : "—",
  };
}

function normalizeDrillJobs(
  raw: unknown,
  segmentLabel: string,
  rowKind: "customer" | "job" = "customer",
): ProfitabilityJob[] {
  const data = unwrapProfitabilityPayload(raw);
  const currencyCode = responseCurrencyCode(data);
  const breakdown = (data.profit_breakdown ?? {}) as Record<string, unknown>;
  const dimension = firstString(breakdown.dimension).toLowerCase();
  const isJobRows = rowKind === "job" || dimension === "job";
  const filters = (data.filters ?? {}) as Record<string, unknown>;
  const defaultCustomerName = firstString(filters.customer_name, filters.customerName);
  const rowsRaw = Array.isArray(breakdown.rows) ? breakdown.rows : [];
  if (isJobRows) {
    return rowsRaw.map((row, i) =>
      normalizeJobRowToJob(row, i, currencyCode, defaultCustomerName),
    );
  }
  return rowsRaw.map((row, i) =>
    normalizeCustomerRowToJob(row, segmentLabel, i, currencyCode),
  );
}

function buildDrillDatePayload(options: {
  company: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}) {
  return {
    company: options.company,
    date_from: options.fromDate
      ? dayjs(options.fromDate).format("YYYY-MM-DD")
      : dayjs().startOf("month").format("YYYY-MM-DD"),
    date_to: options.toDate
      ? dayjs(options.toDate).format("YYYY-MM-DD")
      : dayjs().format("YYYY-MM-DD"),
    compare_previous_period: true,
  };
}

export function buildSegmentDrillPayload(options: {
  company: string;
  service: string;
  customerCode?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}) {
  const payload: Record<string, unknown> = {
    ...buildDrillDatePayload(options),
    segment: true,
    service: options.service,
  };
  const customerCode = options.customerCode?.trim();
  if (customerCode) payload.customer_code = customerCode;
  return payload;
}

export function buildBranchDrillPayload(options: {
  company: string;
  branchCode: string;
  customerCode?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}) {
  const payload: Record<string, unknown> = {
    ...buildDrillDatePayload(options),
    branch: true,
    branch_code: options.branchCode,
  };
  const customerCode = options.customerCode?.trim();
  if (customerCode) payload.customer_code = customerCode;
  return payload;
}

export function buildCustomerDrillPayload(options: {
  company: string;
  customerCode: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}) {
  return {
    ...buildDrillDatePayload(options),
    customer: true,
    customer_code: options.customerCode,
  };
}

export function buildTradelaneDrillPayload(options: {
  company: string;
  originCode: string;
  destinationCode: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}) {
  return {
    ...buildDrillDatePayload(options),
    tradelane: true,
    origin_code: options.originCode,
    destination_code: options.destinationCode,
  };
}

export function buildSalespersonDrillPayload(options: {
  company: string;
  salespersonName: string;
  customerCode?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}) {
  const payload: Record<string, unknown> = {
    ...buildDrillDatePayload(options),
    salesperson: true,
    salesperson_name: options.salespersonName,
  };
  const customerCode = options.customerCode?.trim();
  if (customerCode) payload.customer_code = customerCode;
  return payload;
}

export type ProfitabilityDrillRowKind = "customer" | "job";

export type ProfitabilityDrillData = {
  summary: ProfitabilityDrillSummary;
  jobs: ProfitabilityJob[];
  currencyCode: string;
  rowKind: ProfitabilityDrillRowKind;
  /** True when the drill request included salesperson_name. */
  showSalesperson: boolean;
};

/** @deprecated Use ProfitabilityDrillData */
export type SegmentDrillData = ProfitabilityDrillData;

function withHeaderBranchCode(
  payload: Record<string, unknown>,
  headerBranchCode?: string | null,
): Record<string, unknown> {
  const code = headerBranchCode?.trim();
  if (!code) return payload;
  return { ...payload, header_branch_code: code };
}

async function fetchProfitabilityDrillData(
  payload: Record<string, unknown>,
  segmentLabel: string,
  rowKind: "customer" | "job" = "customer",
  headerBranchCode?: string | null,
): Promise<ProfitabilityDrillData> {
  const body = await apiCallProtected.post(
    URL.dashboard.accountsProfitability,
    withHeaderBranchCode(payload, headerBranchCode),
  );
  const summary = normalizeDrillSummary(body);
  const jobs = normalizeDrillJobs(body, segmentLabel, rowKind);
  jobs.sort((a, b) => b.grossProfit - a.grossProfit);
  const showSalesperson = Boolean(firstString(payload.salesperson_name));
  return { summary, jobs, currencyCode: summary.currencyCode, rowKind, showSalesperson };
}

export async function fetchSegmentDrillData(options: {
  company: string;
  service: string;
  customerCode?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  headerBranchCode?: string | null;
}): Promise<ProfitabilityDrillData> {
  const customerCode = options.customerCode?.trim();
  return fetchProfitabilityDrillData(
    buildSegmentDrillPayload(options),
    options.service,
    customerCode ? "job" : "customer",
    options.headerBranchCode,
  );
}

export async function fetchBranchDrillData(options: {
  company: string;
  branchCode: string;
  customerCode?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  headerBranchCode?: string | null;
}): Promise<ProfitabilityDrillData> {
  const customerCode = options.customerCode?.trim();
  return fetchProfitabilityDrillData(
    buildBranchDrillPayload(options),
    options.branchCode,
    customerCode ? "job" : "customer",
    options.headerBranchCode,
  );
}

export async function fetchCustomerDrillData(options: {
  company: string;
  customerCode: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  headerBranchCode?: string | null;
}): Promise<ProfitabilityDrillData> {
  return fetchProfitabilityDrillData(
    buildCustomerDrillPayload(options),
    options.customerCode,
    "job",
    options.headerBranchCode,
  );
}

export async function fetchTradelaneDrillData(options: {
  company: string;
  originCode: string;
  destinationCode: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  headerBranchCode?: string | null;
}): Promise<ProfitabilityDrillData> {
  return fetchProfitabilityDrillData(
    buildTradelaneDrillPayload(options),
    `${options.originCode} → ${options.destinationCode}`,
    "customer",
    options.headerBranchCode,
  );
}

export async function fetchSalespersonDrillData(options: {
  company: string;
  salespersonName: string;
  customerCode?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  headerBranchCode?: string | null;
}): Promise<ProfitabilityDrillData> {
  const customerCode = options.customerCode?.trim();
  return fetchProfitabilityDrillData(
    buildSalespersonDrillPayload(options),
    options.salespersonName,
    customerCode ? "job" : "customer",
    options.headerBranchCode,
  );
}
