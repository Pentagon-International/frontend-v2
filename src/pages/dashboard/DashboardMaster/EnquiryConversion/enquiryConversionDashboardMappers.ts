import type {
  EnquiryConversionDashboardResponse,
  EnquiryConversionApiSummaryStatusChange,
} from "../../../../service/dashboard.service";
import { extractNumericValue } from "../../../../service/dashboard.service";
import type { FunnelSegment } from "./SegmentedFunnelBar";
import type { StageFunnelRow } from "./StageFunnelCard";
import type { ModeLegendRow } from "./ByModeValueCard";
import type { RepBarRow } from "./ConversionByRepCard";
import type { EnquiryRow } from "./TopActiveEnquiriesTable";

type Trend = "up" | "down" | "neutral";

/** Design baseline from mock (284 enquiries ≈ ₹14.2 Cr pipeline); scales with API counts until value fields ship. */
const REF_ENQUIRIES = 284;
const REF_PIPELINE_INR = 14.2 * 1e7;
const INR_PER_ENQUIRY = REF_PIPELINE_INR / REF_ENQUIRIES;

export function pipelineValueApproxFromEnquiryCount(totalEnquiry: number): number {
  const n = Math.max(0, totalEnquiry);
  return (n / Math.max(REF_ENQUIRIES, 1)) * REF_PIPELINE_INR;
}

function formatInrIndianCompact(amount: number): string {
  const neg = amount < 0;
  const x = Math.abs(amount);
  const p = neg ? "-" : "";
  if (!Number.isFinite(x) || x < 1) return `${p}₹0`;

  const crLbl = (v: number) => {
    const cr = v / 1e7;
    const dec = cr >= 100 ? 1 : cr >= 10 ? 1 : 2;
    let t = cr.toFixed(dec);
    if (dec === 2) t = t.replace(/\.?0+$/, "");
    return `${p}₹${t} Cr`;
  };
  const lLbl = (v: number) => {
    const l = v / 1e5;
    const dec = l >= 10 ? 1 : 2;
    const t = l.toFixed(dec).replace(/\.?0+$/, "");
    return `${p}₹${t} L`;
  };

  if (x >= 1e7) return crLbl(x);
  if (x >= 1e5) return lLbl(x);
  return `${p}₹${Math.round(x).toLocaleString("en-IN")}`;
}

function trendFromChange(
  s?: EnquiryConversionApiSummaryStatusChange
): { trend: Trend; label: string } {
  if (!s?.change_percentage) return { trend: "neutral", label: "" };
  const trend: Trend =
    s.direction === "decrease"
      ? "down"
      : s.direction === "increase"
        ? "up"
        : "neutral";
  return { trend, label: s.change_percentage.trim() };
}

const STAGE_META: Record<
  "active" | "quoted" | "won" | "lost",
  { label: string; color: string }
> = {
  active: { label: "Active", color: "#93C5FD" },
  quoted: { label: "Quoted", color: "#CA8A04" },
  won: { label: "Won", color: "#15803D" },
  lost: { label: "Lost", color: "#DC2626" },
};

const MODE_COLORS: Record<string, string> = {
  AIR: "#EA580C",
  FCL: "#2563EB",
  LCL: "#1D4ED8",
  OTHERS: "#64748B",
};

function modeLabel(code: string): string {
  const u = code.toUpperCase();
  switch (u) {
    case "AIR":
      return "Air Freight";
    case "FCL":
      return "Ocean FCL";
    case "LCL":
      return "Ocean LCL";
    case "OTHERS":
      return "Others";
    default:
      return code;
  }
}

function modeAbbrev(code: string): string {
  const u = code.toUpperCase();
  if (u === "AIR") return "AIR";
  if (u === "FCL") return "OCN FCL";
  if (u === "LCL") return "OCN LCL";
  return u;
}

function badgeColorForMode(code: string): string {
  return MODE_COLORS[code.toUpperCase()] ?? "#64748B";
}

export function stageLabelFromApiStatus(status: string): {
  label: string;
  dotColor: string;
} {
  const u = status.toUpperCase().replace(/\s+/g, " ");
  if (u === "ACTIVE") return { label: "Active", dotColor: "#93C5FD" };
  if (u === "QUOTE CREATED" || u.includes("QUOTE"))
    return { label: "Quoted", dotColor: "#CA8A04" };
  if (u.includes("GAIN")) return { label: "Won", dotColor: "#15803D" };
  if (u === "LOST") return { label: "Lost", dotColor: "#DC2626" };
  return {
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
    dotColor: "#64748B",
  };
}

export interface EnquiryConversionMetricVm {
  label: string;
  value: string;
  trend?: Trend;
  trendLabel?: string;
}

export function buildEnquiryConversionMetrics(
  res: EnquiryConversionDashboardResponse | undefined
): EnquiryConversionMetricVm[] {
  const s = res?.summary;
  if (!s) {
    return [
      { label: "ACTIVE", value: "—" },
      { label: "QUOTE RATE", value: "—" },
      { label: "WIN RATE", value: "—" },
      { label: "AVG. DEAL SIZE", value: "—", trendLabel: "N/A" },
    ];
  }

  const mom = s.status_change_vs_previous_month;
  const a = trendFromChange(mom?.active);
  const q = trendFromChange(mom?.quote_created);
  const g = trendFromChange(mom?.gain);

  return [
    {
      label: "ACTIVE",
      value: String(s.total_active ?? 0),
      trend: a.trend,
      trendLabel: a.label,
    },
    {
      label: "QUOTE RATE",
      value: s.quote_created_percentage?.trim() ?? "—",
      trend: q.trend,
      trendLabel: q.label,
    },
    {
      label: "WIN RATE",
      value: s.gain_percentage?.trim() ?? "—",
      trend: g.trend,
      trendLabel: g.label,
    },
    {
      label: "AVG. DEAL SIZE",
      value: formatInrIndianCompact(INR_PER_ENQUIRY),
      trend: "neutral",
      trendLabel: "estimated",
    },
  ];
}

/** Stage funnel — Active → Quoted → Won → Lost (no negotiation). Won uses gained totals. */
export function buildStageFunnelRowsFromDashboard(
  res: EnquiryConversionDashboardResponse | undefined
): StageFunnelRow[] {
  const s = res?.summary;
  if (s == null) return [];

  const total = Math.max(1, extractNumericValue(s.total_enquiry));
  const ta = extractNumericValue(s.total_active);
  const tq = extractNumericValue(s.total_quote_created);
  const tg = extractNumericValue(s.total_gain);
  const tl = extractNumericValue(s.total_lost);

  const row = (
    key: keyof typeof STAGE_META,
    count: number,
    conversionNote?: string
  ): StageFunnelRow => {
    const cap = `${count.toLocaleString("en-IN")} · ${formatInrIndianCompact(count * INR_PER_ENQUIRY)}`;
    return {
      stage: STAGE_META[key].label,
      barCaption: cap,
      count,
      conversionNote: conversionNote?.trim() || undefined,
      barPercent: Math.round((Math.min(count, total) / total) * 100),
      barColor: STAGE_META[key].color,
    };
  };

  return [
    row("active", ta, s.active_percentage?.trim()),
    row("quoted", tq, s.quote_created_percentage?.trim()),
    row("won", tg, s.gain_percentage?.trim()),
    row("lost", tl, s.lost_percentage?.trim()),
  ];
}

export function buildModeCardFromDashboard(
  res: EnquiryConversionDashboardResponse | undefined
): { segments: FunnelSegment[]; rows: ModeLegendRow[] } {
  const services = Array.isArray(res?.service)
    ? res!.service!.filter((x) => extractNumericValue(x.count) >= 0)
    : [];

  const totalCount = services.reduce(
    (s, x) => s + extractNumericValue(x.count),
    0
  );

  const segments: FunnelSegment[] = services.map((item) => {
    const code = item.service?.toUpperCase() ?? "?";
    return {
      key: code,
      label: modeLabel(code),
      weight: Math.max(0, extractNumericValue(item.count)),
      color: MODE_COLORS[code] ?? "#94A3B8",
    };
  });

  const rows: ModeLegendRow[] = services.map((item) => {
    const code = item.service?.toUpperCase() ?? "?";
    const c = extractNumericValue(item.count);
    const pct = item.percentage?.trim() ?? (totalCount > 0 ? `${Math.round((c / totalCount) * 100)}%` : "0%");
    return {
      key: code,
      label: modeLabel(code),
      color: MODE_COLORS[code] ?? "#94A3B8",
      valueLabel: formatInrIndianCompact(c * INR_PER_ENQUIRY),
      percentLabel: pct,
    };
  });

  return { segments, rows };
}

export function buildRepRowsFromDashboard(
  res: EnquiryConversionDashboardResponse | undefined
): RepBarRow[] {
  const rows = res?.data;
  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows.map((item) => {
    const gained = extractNumericValue(item.gained);
    const total = Math.max(1, extractNumericValue(item.total_enquiry));
    const ratePct = Math.min(100, (gained / total) * 100);
    return {
      name: item.salesperson,
      rateLabel: `${ratePct.toFixed(1)}%`,
      winsLabel: `${gained}/${total}`,
      barPercent: ratePct,
      barColor: "#15803D",
    };
  });
}

/** Win-rate benchmark line (mean of rep win %). */
export function meanRepBenchmarkPercent(repRows: RepBarRow[]): number | undefined {
  if (repRows.length === 0) return undefined;
  const sum = repRows.reduce((s, r) => s + r.barPercent, 0);
  return Math.round((sum / repRows.length) * 10) / 10;
}

export function buildTopEnquiryRowsFromDashboard(
  res: EnquiryConversionDashboardResponse | undefined
): EnquiryRow[] {
  const list = res?.top_enquiries;
  if (!Array.isArray(list)) return [];

  return list.map((e) => {
    const stage = stageLabelFromApiStatus(e.status);
    return {
      id: e.enquiry_id,
      customer: e.customer_name,
      enquiryCode: e.enquiry_id,
      ageLabel: "—",
      stale: false,
      lane: `${e.origin_code} → ${e.destination_code}`,
      modeLabel: modeAbbrev(e.service),
      modeColor: badgeColorForMode(e.service),
      stageLabel: stage.label,
      stageDotColor: stage.dotColor,
      probability: null,
      valueLabel: "—",
    };
  });
}

export function formatEnquiryConversionPageSubtitle(
  res: EnquiryConversionDashboardResponse | undefined
): string {
  const total = extractNumericValue(res?.summary?.total_enquiry);
  const ok = res?.success;
  if (!ok && !total) return "Pipeline · —";
  const v = pipelineValueApproxFromEnquiryCount(total);
  return `Pipeline · ${total.toLocaleString("en-IN")} enquiries · ${formatInrIndianCompact(v)} total value`;
}
