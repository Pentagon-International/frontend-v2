export type BranchCurrencyContext = {
  is_default?: boolean;
  branch_code?: string | null;
  branch_name?: string | null;
  country?: { country_code?: string; country_name?: string | null };
  currency?: { currency_code?: string };
};

/** True when the logged-in user's country is India (lakhs/crores grouping). */
export function isIndianUserCountry(
  countryCode?: string | null,
): boolean {
  return String(countryCode ?? "").trim().toUpperCase() === "IN";
}

export type UserCountryProfile = {
  country_code?: string | null;
  country_name?: string | null;
} | null | undefined;

/** True when the logged-in user's profile country is India. */
export function isIndianUserFromProfile(
  country?: UserCountryProfile,
): boolean {
  return (
    isIndianUserCountry(country?.country_code) ||
    String(country?.country_name ?? "")
      .toLowerCase()
      .includes("india")
  );
}

export function getDefaultUserBranch(
  branches?: BranchCurrencyContext[] | null,
): BranchCurrencyContext | undefined {
  if (!branches?.length) return undefined;
  return branches.find((b) => b.is_default) ?? branches[0];
}

export function getDefaultBranchCurrencyCode(
  branches?: BranchCurrencyContext[] | null,
): string {
  return String(
    getDefaultUserBranch(branches)?.currency?.currency_code ?? "",
  )
    .trim()
    .toUpperCase();
}

export function getDefaultBranchCountryCode(
  branches?: BranchCurrencyContext[] | null,
): string {
  return String(getDefaultUserBranch(branches)?.country?.country_code ?? "")
    .trim()
    .toUpperCase();
}

/** True when the active (default) branch country is India. */
export function isIndianOutstandingBranch(
  branchCountryCode?: string | null,
  branchCurrencyCode?: string | null,
): boolean {
  const branchCountry = String(branchCountryCode ?? "").trim().toUpperCase();
  if (branchCountry === "IN") return true;
  if (branchCountry) return false;
  return String(branchCurrencyCode ?? "").trim().toUpperCase() === "INR";
}

/** Supported outstanding / dashboard currency symbols (ISO code → symbol). */
const OUTSTANDING_CURRENCY_SYMBOL_BY_CODE: Record<string, string> = {
  INR: "₹",
  USD: "$",
  KES: "KSh",
  VND: "₫",
  CNY: "¥",
};

/**
 * Amount prefix: symbols for mapped codes; AED uses code + space; empty when unknown.
 */
export function getOutstandingAmountCurrencySymbol(
  currencyCode?: string | null,
  branchCountryCode?: string | null,
): string {
  const code = String(currencyCode ?? "").trim().toUpperCase();
  if (isIndianOutstandingBranch(branchCountryCode, code)) return "₹";
  if (!code) return "";
  if (code === "AED") return "AED ";
  return OUTSTANDING_CURRENCY_SYMBOL_BY_CODE[code] ?? "";
}

/** India (en-IN): 10,00,000 — foreign default branch (en-US): 1,000,000 */
export function isIndianNumberFormatCountry(
  countryCode?: string | null,
  currencyCode?: string | null,
): boolean {
  return isIndianOutstandingBranch(countryCode, currencyCode);
}

/** Badge label: symbols for mapped codes; AED shows code without trailing space. */
export function getOutstandingCurrencyCodeLabel(
  currencyCode?: string | null,
  branchCountryCode?: string | null,
): string {
  const code = String(currencyCode ?? "").trim().toUpperCase();
  if (isIndianOutstandingBranch(branchCountryCode, code)) return "₹";
  if (!code) return "";
  if (code === "AED") return "AED";
  return OUTSTANDING_CURRENCY_SYMBOL_BY_CODE[code] ?? "";
}

/**
 * Currency code for outstanding UI: India may use API summary; foreign branches use
 * active branch currency from login (e.g. AED, USD) so INR from company API is not shown.
 */
export function resolveOutstandingDisplayCurrency(
  summaryCurrency?: string | null,
  branchCurrencyCode?: string | null,
  branchCountryCode?: string | null,
): string {
  const branchCurrency = String(branchCurrencyCode ?? "").trim().toUpperCase();
  const summary = String(summaryCurrency ?? "").trim().toUpperCase();
  if (isIndianOutstandingBranch(branchCountryCode, branchCurrency)) {
    return summary || branchCurrency || "INR";
  }
  return branchCurrency || summary || "INR";
}

/** `en-IN` (1,00,000) for India; `en-US` (100,000) for other countries. */
export function getUserNumberLocale(
  countryCode?: string | null,
  currencyCode?: string | null,
): string {
  return isIndianOutstandingBranch(countryCode, currencyCode) ? "en-IN" : "en-US";
}

export function formatUserInteger(
  value: string | number | undefined | null,
  countryCode?: string | null,
  currencyCode?: string | null,
): string {
  const n = Math.round(Number(value ?? 0));
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(getUserNumberLocale(countryCode, currencyCode), {
    maximumFractionDigits: 0,
  });
}

export function formatUserDecimal(
  value: string | number | undefined | null,
  countryCode?: string | null,
  currencyCodeOrOptions?: string | null | Intl.NumberFormatOptions,
  maybeOptions?: Intl.NumberFormatOptions,
): string {
  let currencyCode: string | null | undefined;
  let options: Intl.NumberFormatOptions | undefined;
  if (
    currencyCodeOrOptions !== null &&
    typeof currencyCodeOrOptions === "object"
  ) {
    options = currencyCodeOrOptions;
  } else {
    currencyCode = currencyCodeOrOptions as string | null | undefined;
    options = maybeOptions;
  }
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(getUserNumberLocale(countryCode, currencyCode), options);
}

/** Budget summary cards: Cr/L for India branch, M/K for foreign. */
export function formatBudgetAmountCrL(
  value: unknown,
  branchCountryCode?: string | null,
  branchCurrencyCode?: string | null,
): string {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const locale = getUserNumberLocale(branchCountryCode, branchCurrencyCode);
  const symbol = getOutstandingAmountCurrencySymbol(
    branchCurrencyCode,
    branchCountryCode,
  );

  if (isIndianOutstandingBranch(branchCountryCode, branchCurrencyCode)) {
    if (abs >= 1e7) {
      return `${sign}${symbol}${(abs / 1e7).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} Cr`;
    }
    if (abs >= 1e5) {
      return `${sign}${symbol}${(abs / 1e5).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} L`;
    }
    return `${sign}${symbol}${abs.toLocaleString(locale, {
      maximumFractionDigits: 2,
    })}`;
  }

  if (abs >= 1e6) {
    return `${sign}${symbol}${(abs / 1e6).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${symbol}${(abs / 1e3).toLocaleString(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}K`;
  }
  return `${sign}${symbol}${abs.toLocaleString(locale, {
    maximumFractionDigits: 2,
  })}`;
}

export function formatBudgetCurrencyFull(
  value: unknown,
  branchCountryCode?: string | null,
  branchCurrencyCode?: string | null,
): string {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const locale = getUserNumberLocale(branchCountryCode, branchCurrencyCode);
  const symbol = getOutstandingAmountCurrencySymbol(
    branchCurrencyCode,
    branchCountryCode,
  );
  return `${sign}${symbol}${abs.toLocaleString(locale, {
    maximumFractionDigits: 2,
  })}`;
}

/** Compact currency labels for dashboard outstanding cards (Cr/L vs M/K). */
export function formatOutstandingAmountCompact(
  value: string | number | undefined | null,
  countryCode?: string | null,
  currencyCode?: string | null,
): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";
  const locale = getUserNumberLocale(countryCode);
  const currencySymbol = getOutstandingAmountCurrencySymbol(
    currencyCode,
    countryCode,
  );

  if (isIndianNumberFormatCountry(countryCode)) {
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
