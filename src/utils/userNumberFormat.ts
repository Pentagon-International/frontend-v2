/** True when the logged-in user's country is India (lakhs/crores grouping). */
export function isIndianUserCountry(
  countryCode?: string | null,
): boolean {
  return String(countryCode ?? "").trim().toUpperCase() === "IN";
}

/** `en-IN` (1,00,000) for India; `en-US` (100,000) for other countries. */
export function getUserNumberLocale(countryCode?: string | null): string {
  return isIndianUserCountry(countryCode) ? "en-IN" : "en-US";
}

export function formatUserInteger(
  value: string | number | undefined | null,
  countryCode?: string | null,
): string {
  const n = Math.round(Number(value ?? 0));
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(getUserNumberLocale(countryCode), {
    maximumFractionDigits: 0,
  });
}

export function formatUserDecimal(
  value: string | number | undefined | null,
  countryCode?: string | null,
  options?: Intl.NumberFormatOptions,
): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(getUserNumberLocale(countryCode), options);
}

/** Compact currency labels for dashboard outstanding cards (Cr/L vs M/K). */
export function formatOutstandingAmountCompact(
  value: string | number | undefined | null,
  countryCode?: string | null,
  currencySymbol = "₹",
): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";
  const locale = getUserNumberLocale(countryCode);

  if (isIndianUserCountry(countryCode)) {
    if (abs >= 1e7) {
      return `${sign}${currencySymbol}${(abs / 1e7).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} Cr`;
    }
    if (abs >= 1e5) {
      return `${sign}${currencySymbol}${(abs / 1e5).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} L`;
    }
    return `${sign}${currencySymbol}${abs.toLocaleString(locale, {
      maximumFractionDigits: 0,
    })}`;
  }

  if (abs >= 1e9) {
    return `${sign}${currencySymbol}${(abs / 1e9).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${currencySymbol}${(abs / 1e6).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${currencySymbol}${(abs / 1e3).toLocaleString(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}K`;
  }
  return `${sign}${currencySymbol}${abs.toLocaleString(locale, {
    maximumFractionDigits: 0,
  })}`;
}
