import type { PipelineReportFilters } from "../../../service/dashboard.service";

/**
 * Maps pipeline UI column keys to API `filters.type` for drill-down requests.
 */
export function mapPipelineColumnTypeToApiType(
  columnType: string | null | undefined
): string | undefined {
  if (columnType == null || String(columnType).trim() === "") {
    return undefined;
  }
  const key = String(columnType).trim().toLowerCase();
  switch (key) {
    case "gained":
      return "gained";
    case "quote":
    case "quoted":
    case "quoted_created":
      return "quoted_created";
    case "lost":
      return "lost";
    case "pipeline":
      return "pipeline";
    case "potential":
      return "potential";
    case "expected":
      return "expected";
    default:
      return columnType;
  }
}

export function isPipelineQuotedDrillType(
  columnType: string | null | undefined
): boolean {
  return mapPipelineColumnTypeToApiType(columnType) === "quoted_created";
}

/** Base drill (e.g. salesperson row + financial column): include `type` in API payload. */
export function withPipelineDrillType(
  filters: PipelineReportFilters,
  columnType: string
): PipelineReportFilters | null {
  const type = mapPipelineColumnTypeToApiType(columnType);
  if (!type) return null;
  return { ...filters, type };
}

/** Next drill (customer row): keep existing filters and add `customer_code`. */
export function withPipelineCustomerCode(
  filters: PipelineReportFilters,
  customerCode: string | null | undefined
): PipelineReportFilters {
  if (!customerCode || customerCode === "-") {
    return filters;
  }
  return { ...filters, customer_code: customerCode };
}
