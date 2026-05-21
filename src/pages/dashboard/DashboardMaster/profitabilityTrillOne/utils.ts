import { ERP_LIST_FONT_MONO, ERP_LIST_FONT_SANS } from "../../../../components/ERPListPage/erpListGeistShell";

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
};

/** Formats API monetary values as-is (no Cr/L conversion). */
export function formatProfitabilityAmount(value: number, currencyCode = "INR"): string {
  const code = currencyCode.trim().toUpperCase() || "INR";
  const symbol = CURRENCY_SYMBOL[code] ?? `${code} `;
  const abs = Math.abs(value);
  const hasFraction = abs % 1 !== 0;
  const formatted = hasFraction
    ? abs.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
    : abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${value < 0 ? "-" : ""}${symbol}${formatted}`;
}

export function formatLakhs(valueL: number): string {
  const abs = Math.abs(valueL);
  if (abs >= 100) return `${(abs / 100).toFixed(2)} Cr`;
  return `${abs.toFixed(1)} L`;
}

export function formatCurrencyL(valueL: number, _bold = false): string {
  return formatLakhs(valueL);
}

export function marginTone(marginPct: number): "good" | "ok" | "warn" | "bad" {
  if (marginPct >= 24) return "good";
  if (marginPct >= 18) return "ok";
  if (marginPct >= 12) return "warn";
  return "bad";
}

export const profitabilityTrillFonts = {
  sans: ERP_LIST_FONT_SANS,
  mono: ERP_LIST_FONT_MONO,
};

export function jobMarginPct(job: {
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number | null;
}): number {
  if (job.marginPct !== null && Number.isFinite(job.marginPct)) return job.marginPct;
  return job.revenue > 0 ? (job.grossProfit / job.revenue) * 100 : 0;
}
