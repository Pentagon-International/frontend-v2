import { formatCurrencyAmountForUi } from "../../../../utils/nonDecimalMoneyAmount";

export function currencyCodeLabel(code?: string): string {
  return code?.trim().toUpperCase() || "INR";
}

/** Formats rupee-scale API amounts with currency code prefix (no symbol). */
export function formatCollectionCrLAmount(value: number, currencyCode = "INR"): string {
  const code = currencyCodeLabel(currencyCode);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}${code} ${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}${code} ${(abs / 100000).toFixed(1)} L`;
  if (abs >= 1 && abs < 1000) {
    return `${sign}${code} ${abs.toFixed(abs >= 10 ? 2 : 1)}${abs >= 1 ? " Cr" : ""}`;
  }
  return `${sign}${code} ${formatCurrencyAmountForUi(abs)}`;
}
