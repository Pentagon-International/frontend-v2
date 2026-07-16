import dayjs from "dayjs";
import type {
  AuditHistoryItem,
  ContractBasics,
  ContractDetailResponse,
  ContractRateLine,
  ContractSurcharge,
} from "./types";

const SERVICE_MODE_LABELS: Record<string, string> = {
  FCL: "Ocean FCL",
  LCL: "Ocean LCL",
  AIR: "Air Freight",
};

export function getServiceModeLabel(service: string): string {
  return SERVICE_MODE_LABELS[service.trim().toUpperCase()] || service;
}

export function getVendorTypeLabel(service: string): string {
  const normalized = service.trim().toUpperCase();
  if (normalized === "AIR") return "Airline";
  if (normalized === "FCL" || normalized === "LCL") return "Shipping Line";
  return "Vendor";
}

export function getContractDisplayId(data: ContractDetailResponse): string {
  const tariffCode = data.contract_basics?.tariff_codes?.[0];
  if (tariffCode) return tariffCode;
  return data.vendor_reference || "—";
}

export function formatApiDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY") : value;
}

export function formatApiDateTime(value?: string | null): string {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY · HH:mm") : value;
}

export function getDaysLeft(validTo?: string | null): number | null {
  if (!validTo) return null;
  const parsed = dayjs(validTo);
  if (!parsed.isValid()) return null;
  return parsed.startOf("day").diff(dayjs().startOf("day"), "day");
}

export function formatDaysLeft(validTo?: string | null): string {
  const daysLeft = getDaysLeft(validTo);
  if (daysLeft === null) return "—";
  if (daysLeft <= 0) return daysLeft === 0 ? "Expires today" : `expired ${Math.abs(daysLeft)}d ago`;
  return `${daysLeft}d left`;
}

export function getValidityPercent(validFrom?: string, validTo?: string): number {
  if (!validFrom || !validTo) return 0;
  const start = dayjs(validFrom);
  const end = dayjs(validTo);
  if (!start.isValid() || !end.isValid() || !end.isAfter(start)) return 0;

  const total = end.diff(start, "day");
  const elapsed = dayjs().diff(start, "day");
  if (total <= 0) return 0;
  const remaining = Math.max(0, Math.min(100, ((total - elapsed) / total) * 100));
  return Math.round(remaining);
}

export function getCurrencyPrefix(currencyCode: string): string {
  return currencyCode ? `${currencyCode} ` : "";
}

export function formatMoney(
  value: string | number | null | undefined,
  currencyCode: string,
  options?: { decimals?: number },
): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(amount)) return String(value);
  return `${getCurrencyPrefix(currencyCode)}${amount.toLocaleString("en-US", {
    maximumFractionDigits: options?.decimals ?? 0,
    minimumFractionDigits: options?.decimals ?? 0,
  })}`;
}

export function formatRateWithUnit(
  rate: string | number | null | undefined,
  unit: string | null | undefined,
  currencyCode: string,
): string {
  const formatted = formatMoney(rate, currencyCode);
  if (formatted === "—") return formatted;
  if (!unit?.trim()) return formatted;
  return `${formatted}/${unit.trim()}`;
}

export function formatLaneLabel(line: ContractRateLine): string {
  const origin = line.origin_name || line.origin_code;
  const destination = line.destination_name || line.destination_code;
  const originCode = line.origin_code ? ` (${line.origin_code})` : "";
  const destinationCode = line.destination_code ? ` (${line.destination_code})` : "";
  return `${origin}${originCode} → ${destination}${destinationCode}`;
}

export function getStatusPresentation(status: string): {
  label: string;
  className: "active" | "expiring" | "expired" | "default";
} {
  const value = status.trim().toUpperCase();
  if (value === "ACTIVE") return { label: "Active", className: "active" };
  if (value === "EXPIRING") return { label: "Expiring", className: "expiring" };
  if (value === "EXPIRED") return { label: "Expired", className: "expired" };
  return {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    className: "default",
  };
}

export function getAutoRenewLabel(basics: ContractBasics): string {
  if (!basics.auto_renew) return "Disabled · manual renewal";
  if (basics.auto_renew_days) {
    return `Enabled · ${basics.auto_renew_days} days notice`;
  }
  return "Enabled";
}

export function buildAuditHistory(data: ContractDetailResponse): AuditHistoryItem[] {
  const items: AuditHistoryItem[] = [];
  const basics = data.contract_basics;

  if (data.updated_at) {
    items.push({
      key: "updated",
      timestamp: formatApiDateTime(data.updated_at),
      label: data.message || "Contract updated",
      actor:
        data.updated_by ||
        data.updated_by_name ||
        basics.updated_by ||
        basics.updated_by_name ||
        basics.approved_by ||
        basics.created_by ||
        "—",
      isRecent: true,
    });
  }

  if (data.created_at) {
    items.push({
      key: "created",
      timestamp: formatApiDateTime(data.created_at),
      label: `Contract created · ${data.rate_sheet.length} rate line${data.rate_sheet.length === 1 ? "" : "s"}`,
      actor: basics.created_by || "—",
    });
  }

  return items;
}

export function getAppliedSurcharges(surcharges: ContractSurcharge[]): ContractSurcharge[] {
  return surcharges.filter((item) => item.applied !== false);
}

export function formatSurchargeRate(item: ContractSurcharge): string {
  const rate = String(item.rate ?? "").trim();
  if (!rate) return "—";
  if (rate.includes("%")) return rate;
  return formatRateWithUnit(rate, item.unit, item.currency_code);
}

export function formatSurchargeSubtitle(item: ContractSurcharge): string {
  const parts = [item.frequency, item.basis, item.unit]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return parts.join(" · ") || "—";
}

export function formatAvgBuyRateSummary(
  data: ContractDetailResponse,
): { value: string; currency: string } {
  const summary = data.rate_sheet_summary;
  const currency = data.contract_basics.currency_code || data.rate_sheet[0]?.currency_code || "—";
  const firstUnit =
    data.rate_sheet[0]?.equipment || data.rate_sheet[0]?.unit || "";
  const avg = formatMoney(summary.avg_rate, currency);
  const value =
    avg === "—"
      ? "—"
      : firstUnit
        ? `${avg}/${firstUnit}`
        : avg;
  return { value, currency };
}
