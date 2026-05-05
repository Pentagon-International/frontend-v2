import type {
  EnquiryDrilldownEnquiry,
  EnquiryDrilldownQuotationService,
} from "../../../../service/dashboard.service";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export function modeAbbrev(code: string): string {
  const u = code.toUpperCase();
  if (u === "AIR") return "AIR";
  if (u === "FCL") return "OCN FCL";
  if (u === "LCL") return "OCN LCL";
  if (u === "CUSTOMS") return "CUSTOMS";
  return u;
}

export function badgeColorForMode(code: string): string {
  const u = code.toUpperCase();
  const map: Record<string, string> = {
    AIR: enquiryConversionColors.modes.air,
    FCL: enquiryConversionColors.modes.fcl,
    LCL: enquiryConversionColors.modes.lcl,
    CUSTOMS: enquiryConversionColors.modes.customs,
    ROAD: enquiryConversionColors.modes.road,
    RAIL: enquiryConversionColors.modes.rail,
    OTHERS: enquiryConversionColors.muted,
  };
  return map[u] ?? "#64748B";
}

export function formatInrLakhs(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  const lakhs = amount / 100000;
  if (lakhs >= 1) return `₹${lakhs >= 10 ? lakhs.toFixed(1) : lakhs.toFixed(2)} L`;
  const thousands = amount / 1000;
  if (thousands >= 1) return `₹${thousands.toFixed(1)} K`;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function parseMoney(s?: string | number | null): number {
  if (s == null) return 0;
  const n =
    typeof s === "number"
      ? s
      : parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Primary quote total sell (INR etc.) from first quotation. */
export function primaryQuoteTotalSell(e: EnquiryDrilldownEnquiry): number {
  const q = e.quotations?.[0];
  const qs = q?.quotation_services?.[0];
  return parseMoney(qs?.total_sell);
}

export function sumWonValueInr(enquiries: EnquiryDrilldownEnquiry[]): number {
  let sum = 0;
  for (const e of enquiries) {
    if (e.status?.toUpperCase().includes("GAIN")) {
      sum += primaryQuoteTotalSell(e);
    }
  }
  return sum;
}

export function laneFromEnquiry(e: EnquiryDrilldownEnquiry): string {
  const o = e.origin_code_list?.filter(Boolean) ?? [];
  const d = e.destination_code_list?.filter(Boolean) ?? [];
  if (o.length && d.length) {
    return `${o[0]} → ${d[0]}`;
  }
  const s0 = e.services?.[0];
  if (s0?.origin_code_read && s0?.destination_code_read) {
    return `${s0.origin_code_read} → ${s0.destination_code_read}`;
  }
  return "—";
}

export function winProbLabel(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("GAIN")) return "100%";
  if (u === "LOST" || u.includes("LOST")) return "0%";
  if (u.includes("NEGOT")) return "75%";
  if (u.includes("QUOTE") || u === "ACTIVE") return "50%";
  return "—";
}

export function firstQuoteService(
  e: EnquiryDrilldownEnquiry
): EnquiryDrilldownQuotationService | undefined {
  return e.quotations?.[0]?.quotation_services?.[0];
}
