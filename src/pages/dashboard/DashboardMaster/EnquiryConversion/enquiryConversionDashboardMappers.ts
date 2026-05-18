import type {
  EnquiryConversionDashboardResponse,
  EnquiryConversionApiSummaryStatusChange,
  EnquiryConversionTopEnquiryRow,
  EnquiryDrilldownEnquiry,
} from "../../../../service/dashboard.service";
import { extractNumericValue } from "../../../../service/dashboard.service";
import type { FunnelSegment } from "./SegmentedFunnelBar";
import type { StageFunnelRow } from "./StageFunnelCard";
import type { ModeLegendRow } from "./ByModeValueCard";
import type { RepBarRow } from "./ConversionByRepCard";
import type { EnquiryRow } from "./TopActiveEnquiriesTable";

type Trend = "up" | "down" | "neutral";

const PCT_GREEN = "#16A34A";
const PCT_NAVY = "#1E3A8A";
const PCT_ORANGE = "#F59E0B";

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

function parsePercentNumber(label?: string): number | undefined {
  if (!label) return undefined;
  const m = label.match(/-?\d+(\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

function colorFromPercent(pct: number): string {
  if (pct >= 80) return PCT_GREEN;
  if (pct >= 60) return PCT_NAVY;
  return PCT_ORANGE;
}

import { enquiryConversionColors } from "./enquiryConversionTokens";

const STAGE_META: Record<
  "new" | "quoted" | "negotiation" | "won" | "lost",
  { label: string; barColor: string; dotColor: string; dotBgColor: string }
> = {
  new: {
    label: "active",
    barColor:  enquiryConversionColors.bars.navy1,
    dotColor: enquiryConversionColors.status.new.dot,
    dotBgColor: enquiryConversionColors.status.new.bg,
  },
  quoted: {
    label: "Quoted",
    barColor: enquiryConversionColors.bars.navy2,
    dotColor: enquiryConversionColors.status.quoted.dot,
    dotBgColor: enquiryConversionColors.status.quoted.bg,
  },
  negotiation: {
    label: "Negotiation",
    barColor: enquiryConversionColors.bars.navy3,
    dotColor: enquiryConversionColors.status.negotiation.dot,
    dotBgColor: enquiryConversionColors.status.negotiation.bg,
  },
  won: {
    label: "Won",
    barColor: enquiryConversionColors.bars.won,
    dotColor: enquiryConversionColors.status.won.dot,
    dotBgColor: enquiryConversionColors.status.won.bg,
  },
  lost: {
    label: "Lost",
    barColor: enquiryConversionColors.bars.lost,
    dotColor: enquiryConversionColors.status.lost.dot,
    dotBgColor: enquiryConversionColors.status.lost.bg,
  },
};

const MODE_COLORS: Record<string, string> = {
  AIR: enquiryConversionColors.modes.air,
  FCL: enquiryConversionColors.modes.fcl,
  LCL: enquiryConversionColors.modes.lcl,
  ROAD: enquiryConversionColors.modes.road,
  RAIL: enquiryConversionColors.modes.rail,
  CUSTOMS: enquiryConversionColors.modes.customs,
  WAREHOUSING: enquiryConversionColors.modes.warehousing,
  OTHERS: enquiryConversionColors.muted,
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
  if (u === "ACTIVE") return { label: "New", dotColor: enquiryConversionColors.status.new.dot };
  if (u === "QUOTE CREATED" || u.includes("QUOTE"))
    return { label: "Quoted", dotColor: enquiryConversionColors.status.quoted.dot };
  if (u.includes("NEGOTIAT"))
    return { label: "Negotiation", dotColor: enquiryConversionColors.status.negotiation.dot };
  if (u.includes("GAIN")) return { label: "Won", dotColor: enquiryConversionColors.status.won.dot };
  if (u === "LOST") return { label: "Lost", dotColor: enquiryConversionColors.status.lost.dot };
  return {
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
    dotColor: enquiryConversionColors.muted,
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
      { label: "QUOTE CREATED RATE", value: "—" },
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
      label: "QUOTE CREATED RATE",
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
      label: "TOTAL ENQUIRIES",
      value: String(s.total_enquiry ?? 0),
      trend: "neutral",
      trendLabel: "",
    },
  ];
}

/** Stage funnel — New → Quoted → Won → Lost. Negotiation is injected if needed. */
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
    const cap = `${count.toLocaleString("en-IN")} `;
    const meta = STAGE_META[key];
    const parsedPct = parsePercentNumber(conversionNote);
    const pctForColor =
      parsedPct != null
        ? Math.max(0, Math.min(100, parsedPct))
        : (Math.min(count, total) / total) * 100;
    return {
      stage: meta.label,
      barCaption: cap,
      count,
      conversionNote: conversionNote?.trim() || undefined,
      barPercent: Math.round((Math.min(count, total) / total) * 100),
      // barColor: colorFromPercent(pctForColor),
      barColor: meta.dotColor,
      dotColor: meta.dotColor,
      dotBgColor: meta.dotBgColor,
    };
  };

  return [
    row("new", ta, s.active_percentage?.trim() || "100%"),
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
      valueLabel: c.toLocaleString("en-IN"),
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
    const gainedRaw = item.gained;
    const gained = extractNumericValue(item.gained);
    const total = Math.max(1, extractNumericValue(item.total_enquiry));
    const gainedPercentFromApi =
      typeof gainedRaw === "string"
        ? (() => {
            const match = gainedRaw.match(/\(([^)]*%)\)/);
            if (!match?.[1]) return undefined;
            const pctNumber = Number(match[1].replace("%", "").trim());
            return Number.isFinite(pctNumber) ? pctNumber : undefined;
          })()
        : undefined;
    const ratePct = Math.min(
      100,
      gainedPercentFromApi ?? (gained / total) * 100
    );
    const rateLabel =
      Number.isInteger(ratePct) || Math.abs(ratePct - Math.round(ratePct)) < 0.001
        ? `${Math.round(ratePct)}%`
        : `${ratePct.toFixed(1)}%`;
    return {
      name: item.salesperson,
      rateLabel,
      winsLabel: `${gained}/${total}`,
      barPercent: ratePct,
      barColor: colorFromPercent(ratePct),
      salespersonEmail: item.salesperson_email,
      ccMail: item.cc_mail as string | string[] | undefined,
      active: extractNumericValue(item.active),
      gained: extractNumericValue(item.gained),
      lost: extractNumericValue(item.lost),
      quoteCreated: extractNumericValue(item.quote_created),
    };
  });
}

/** Win-rate benchmark line (mean of rep win %). */
export function meanRepBenchmarkPercent(repRows: RepBarRow[]): number | undefined {
  if (repRows.length === 0) return undefined;
  const sum = repRows.reduce((s, r) => s + r.barPercent, 0);
  return Math.round((sum / repRows.length) * 10) / 10;
}

/** Map dashboard `top_enquiries` row to drilldown shape for the details drawer. */
export function buildDrilldownFromTopEnquiryRow(
  e: EnquiryConversionTopEnquiryRow
): EnquiryDrilldownEnquiry {
  return {
    enquiry_id: e.enquiry_id,
    customer_name: e.customer_name,
    status: e.status,
    sales_person: e.sales_person,
    origin_code_list: e.origin_code ? [e.origin_code] : undefined,
    destination_code_list: e.destination_code ? [e.destination_code] : undefined,
    services: [
      {
        service: e.service,
        service_name: e.service,
        origin_code_read: e.origin_code,
        destination_code_read: e.destination_code,
      },
    ],
  };
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
      drilldownEnquiry: buildDrilldownFromTopEnquiryRow(e),
      salespersonEmail: e.salesperson_email,
      ccMail: e.cc_mail as string | string[] | undefined,
      salespersonName: e.sales_person?.trim(),
    };
  });
}

export function formatEnquiryConversionPageSubtitle(
  res: EnquiryConversionDashboardResponse | undefined
): string {
  const total = extractNumericValue(res?.summary?.total_enquiry);
  const ok = res?.success;
  if (!ok && !total) return "Enquiries · —";
  return `${total.toLocaleString("en-IN")} enquiries`;
}
