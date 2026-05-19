import type { PipelineReportFilters, PipelineReportSummary } from "../../../service/dashboard.service";
import {
  getPotentialCustomersData,
  getPotentialCustomersDataForProduct,
  getPotentialCustomersDataForRegional,
} from "../../../service/dashboard.service";
export type QuotationDrillFetchKind = "salesperson" | "regional" | "product";

export type PipelineCustomerProfitRow = {
  customer_code: string;
  customer_name: string;
  potential: number;
  pipeline: number;
  gained: number;
  lost: number;
  quote: number;
  expected: number;
};

export type PipelineCustomerProfitFetchResult = {
  rows: PipelineCustomerProfitRow[];
  summary: PipelineReportSummary | null;
};

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isPipelineQuotationLineRow(
  row: Record<string, unknown> | null | undefined
): boolean {
  if (!row) return false;
  const qid = row.quotation_id;
  return qid != null && String(qid).trim() !== "" && String(qid) !== "-";
}

export function mapPipelineCustomerProfitRows(
  data: unknown[] | undefined
): PipelineCustomerProfitRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== "object") return false;
      return !isPipelineQuotationLineRow(item as Record<string, unknown>);
    })
    .map((item) => ({
      customer_code: String(item.customer_code ?? "").trim() || "-",
      customer_name: String(item.customer_name ?? "").trim() || "-",
      potential: toNum(item.potential_profit ?? item.potential),
      pipeline: toNum(item.pipeline_profit ?? item.pipeline),
      gained: toNum(item.gained_profit ?? item.gained),
      lost: toNum(item.lost_profit ?? item.lost),
      quote: toNum(item.quoted_profit ?? item.quoted_created ?? item.quote),
      expected: toNum(item.expected_profit ?? item.expected),
    }));
}

async function fetchPipelineDrillResponse(
  filters: PipelineReportFilters,
  kind: QuotationDrillFetchKind
) {
  if (kind === "regional") {
    return getPotentialCustomersDataForRegional(filters);
  }
  if (kind === "product") {
    return getPotentialCustomersDataForProduct(filters);
  }
  return getPotentialCustomersData(filters);
}

export async function fetchPipelineCustomerProfitDrill(
  filters: PipelineReportFilters,
  kind: QuotationDrillFetchKind
): Promise<PipelineCustomerProfitFetchResult> {
  const response = (await fetchPipelineDrillResponse(filters, kind)) as {
    data?: unknown[];
    summary?: PipelineReportSummary;
  };
  return {
    rows: mapPipelineCustomerProfitRows(response.data),
    summary: response.summary ?? null,
  };
}
