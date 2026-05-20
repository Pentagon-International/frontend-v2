import { ERP_LIST_FONT_MONO, ERP_LIST_FONT_SANS } from "../../../../components/ERPListPage/erpListGeistShell";

export function formatLakhs(valueL: number): string {
  const abs = Math.abs(valueL);
  if (abs >= 100) return `${(abs / 100).toFixed(2)} Cr`;
  return `${abs.toFixed(1)} L`;
}

export function formatCurrencyL(valueL: number, bold = false): string {
  const formatted = formatLakhs(valueL);
  return formatted;
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

export function jobMarginPct(job: { revenueL: number; costL: number }): number {
  const gp = job.revenueL - job.costL;
  return job.revenueL > 0 ? (gp / job.revenueL) * 100 : 0;
}
