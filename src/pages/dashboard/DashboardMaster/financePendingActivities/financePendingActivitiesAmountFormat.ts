import { formatAmountInCr } from "../accountsDashboardNormalize";

export function currencyCodeLabel(code?: string): string {
  return code?.trim().toUpperCase() || "INR";
}

export function formatPendingActivityAmountCr(amountCr: number, currencyCode = "INR"): string {
  return `${currencyCodeLabel(currencyCode)} ${formatAmountInCr(amountCr)}`;
}

export function formatCountExposureDisplay(
  count: number,
  amountCr: number,
  currencyCode = "INR",
): string {
  return `${count} · ${formatPendingActivityAmountCr(amountCr, currencyCode)}`;
}
