import { branchDotColor, unwrapProfitabilityPayload } from "../accountsDashboardNormalize";
import { getSegmentLabel } from "../profitabilityTrillOne/data";
import type { ProfitabilityJob, ProfitabilityJobSegment } from "../profitabilityTrillOne/types";
import { formatProfitabilityAmount } from "../profitabilityTrillOne/utils";
import type {
  JobPlLine,
  JobProfitabilityDetail,
} from "./types";

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

/** Internal lakhs factor used by JobPlTable totals (amount = revenueL × 100000). */
function toDisplayLakhs(amount: number): number {
  return amount / 100_000;
}

function segmentKeyFromLabel(label: string): ProfitabilityJobSegment | undefined {
  const lower = label.toLowerCase();
  if (lower.includes("ocean") && lower.includes("fcl")) return "ocean-fcl";
  if (lower.includes("ocean") && lower.includes("lcl")) return "ocean-lcl";
  if (lower.includes("air")) return "air";
  if (lower.includes("custom")) return "customs";
  if (lower.includes("road")) return "road";
  if (lower.includes("warehous")) return "warehousing";
  return undefined;
}

const BRANCH_LABELS: Record<string, string> = {
  mum: "Mumbai",
  del: "Delhi",
  blr: "Bangalore",
  maa: "Chennai",
  amd: "Ahmedabad",
  ccu: "Kolkata",
  chn: "China",
};

function branchLabel(code: string): string {
  return BRANCH_LABELS[code.toLowerCase()] ?? code.toUpperCase();
}

function normalizeJobPnlLine(raw: unknown): JobPlLine {
  const row = (raw ?? {}) as Record<string, unknown>;
  const qtyRaw = row.qty ?? row.quantity;
  const unit = firstString(row.unit);
  const qty =
    qtyRaw !== null && qtyRaw !== undefined && qtyRaw !== ""
      ? `${qtyRaw}${unit ? ` ${unit}` : ""}`
      : "—";

  return {
    head: firstString(row.charge_name, row.chargeName, row.head, row.cost_head),
    party: firstString(row.beneficiary, row.party, row.vendor),
    qty,
    rate: firstString(row.rate_label, row.rateLabel, row.rate, row.rate_type),
    amountInr: safeNumber(row.amount ?? row.amount_inr ?? row.value),
  };
}

function normalizeJobPnlSection(raw: unknown): {
  lines: JobPlLine[];
  total: number;
  subtitle?: string;
} {
  const section = (raw ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(section.rows) ? section.rows : [];
  return {
    lines: rowsRaw.map(normalizeJobPnlLine),
    total: safeNumber(section.total),
    subtitle: firstString(section.subtitle) || undefined,
  };
}

function formatVolume(volume: unknown, volumeUnit: string): string {
  if (volume === null || volume === undefined || volume === "") return "—";
  const value = firstString(volume);
  return volumeUnit ? `${value} ${volumeUnit}` : value;
}

function formatPerUnitLabel(
  perUnit: unknown,
  volumeUnit: string,
  currencyCode: string,
): string {
  if (perUnit === null || perUnit === undefined || perUnit === "") return "—";
  const amount = formatProfitabilityAmount(safeNumber(perUnit), currencyCode);
  return volumeUnit ? `${amount} / ${volumeUnit}` : amount;
}

export function normalizeJobProfitabilityDetail(
  raw: unknown,
  fallbackJob?: ProfitabilityJob | null,
): JobProfitabilityDetail {
  const data = unwrapProfitabilityPayload(raw);
  const jobPnl = (data.job_pnl ?? data.jobPnl) as Record<string, unknown> | undefined;

  if (!jobPnl || typeof jobPnl !== "object") {
    throw new Error("Missing job_pnl in profitability response.");
  }

  const filters = (data.filters ?? {}) as Record<string, unknown>;
  const kpis = (jobPnl.kpis ?? {}) as Record<string, unknown>;
  const revenueSection = normalizeJobPnlSection(jobPnl.revenue);
  const costSection = normalizeJobPnlSection(jobPnl.direct_cost ?? jobPnl.directCost);

  const currencyCode =
    firstString(jobPnl.currency_code, kpis.currency_code, data.currency_code) || "INR";
  const revenue = safeNumber(kpis.revenue, revenueSection.total);
  const cost = safeNumber(kpis.direct_cost, costSection.total);
  const grossProfit = safeNumber(kpis.gross_profit, revenue - cost);
  const marginPct = safeNumber(
    kpis.margin_pct,
    revenue > 0 ? (grossProfit / revenue) * 100 : 0,
  );

  const modeLabel = firstString(jobPnl.mode_label, jobPnl.modeLabel);
  const segmentKey = segmentKeyFromLabel(modeLabel) ?? fallbackJob?.segment;
  const branchCode = firstString(jobPnl.branch_code, filters.branch_code).toLowerCase();
  const volumeUnit = firstString(jobPnl.volume_unit, jobPnl.volumeUnit);

  return {
    jobId: firstString(jobPnl.job_id, jobPnl.jobId, fallbackJob?.id),
    customer:
      firstString(filters.customer_name, filters.customerName, fallbackJob?.customer) || "—",
    lane: firstString(jobPnl.lane, fallbackJob?.lane) || "—",
    segment: modeLabel || (segmentKey ? getSegmentLabel(segmentKey) : "—"),
    segmentKey,
    status: "invoiced",
    statusLabel: firstString(jobPnl.trade) || "—",
    branch: {
      code: branchCode || "—",
      label: branchLabel(branchCode || "—"),
    },
    salesperson: firstString(jobPnl.salesperson, fallbackJob?.rep) || "—",
    delivered: firstString(jobPnl.job_date, jobPnl.jobDate, fallbackJob?.delivered) || "—",
    volume: formatVolume(jobPnl.volume, volumeUnit),
    currencyCode,
    revenueL: toDisplayLakhs(revenue),
    costL: toDisplayLakhs(cost),
    grossProfitL: toDisplayLakhs(grossProfit),
    marginPct,
    perUnitLabel: formatPerUnitLabel(kpis.per_unit, volumeUnit, currencyCode),
    revenueLines: revenueSection.lines,
    costLines: costSection.lines,
    directCostSubtitle: costSection.subtitle,
    linkedDocuments: [],
    marginBridge: [],
    marginCommentary: "",
  };
}

export function branchChipDotColor(code: string): string {
  return branchDotColor(code);
}
