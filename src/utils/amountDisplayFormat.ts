/**
 * UI-only thousand-separator formatting for amount / total displays.
 * Do not use for inputs, form values, or API payloads.
 */

import {
  getDefaultUserBranch,
  type BranchCurrencyContext,
} from "./userNumberFormat";

export type AmountFormat = "WESTERN" | "INDIAN" | "EUROPEAN";

const COUNTRY_AMOUNT_FORMAT: Record<string, AmountFormat> = {
  IN: "INDIAN",
  IND: "INDIAN",
  VN: "EUROPEAN",
  VNM: "EUROPEAN",
  US: "WESTERN",
  USA: "WESTERN",
  AE: "WESTERN",
  ARE: "WESTERN",
  KE: "WESTERN",
  KEN: "WESTERN",
  CN: "WESTERN",
  CHN: "WESTERN",
};

const AMOUNT_FORMAT_LOCALE: Record<AmountFormat, string> = {
  WESTERN: "en-US",
  INDIAN: "en-IN",
  EUROPEAN: "de-DE",
};

let boundCountryCode = "";

export type AmountDisplayUser = {
  branches?: BranchCurrencyContext[] | null;
  country?: {
    country_code?: string | null;
    country_name?: string | null;
  } | null;
} | null | undefined;

function countryCodeFromName(countryName?: string | null): string {
  const name = String(countryName ?? "").trim().toUpperCase();
  if (!name) return "";
  if (name.includes("INDIA")) return "IN";
  if (name.includes("VIETNAM") || name.includes("VIET NAM")) return "VN";
  if (name.includes("KENYA")) return "KE";
  if (name.includes("CHINA")) return "CN";
  if (
    name.includes("UNITED ARAB") ||
    name.includes("DUBAI") ||
    name.includes("UAE")
  ) {
    return "AE";
  }
  if (name.includes("UNITED STATES") || name === "USA") return "US";
  return "";
}

export function resolveAmountDisplayCountryCode(
  countryCode?: string | null,
  countryName?: string | null,
): string {
  const code = String(countryCode ?? "").trim().toUpperCase();
  return code || countryCodeFromName(countryName);
}

export function getAmountFormatForCountry(
  countryCode?: string | null,
  countryName?: string | null,
): AmountFormat {
  const code = resolveAmountDisplayCountryCode(countryCode, countryName);
  if (!code) return "WESTERN";
  return COUNTRY_AMOUNT_FORMAT[code] ?? "WESTERN";
}

export function bindAmountDisplayCountry(
  countryCode?: string | null,
  countryName?: string | null,
): void {
  boundCountryCode = resolveAmountDisplayCountryCode(countryCode, countryName);
}

export function bindAmountDisplayFromUser(user: AmountDisplayUser): void {
  const branch = getDefaultUserBranch(user?.branches);
  bindAmountDisplayCountry(
    branch?.country?.country_code ?? user?.country?.country_code,
    branch?.country?.country_name ?? user?.country?.country_name,
  );
}

export function getBoundAmountFormat(): AmountFormat {
  return getAmountFormatForCountry(boundCountryCode);
}

/**
 * Mantine NumberInput display separators for total amount fields.
 * onChange still returns a number — do not use for payload strings.
 * Grouping matches formatAmountForDisplay: lakh for India, 3-digit otherwise.
 */
export function getAmountNumberInputFormatProps(): {
  thousandSeparator: string;
  decimalSeparator: string;
  thousandsGroupStyle: "thousand" | "lakh";
} {
  const format = getBoundAmountFormat();
  if (format === "EUROPEAN") {
    return {
      thousandSeparator: ".",
      decimalSeparator: ",",
      thousandsGroupStyle: "thousand",
    };
  }
  if (format === "INDIAN") {
    return {
      thousandSeparator: ",",
      decimalSeparator: ".",
      thousandsGroupStyle: "lakh",
    };
  }
  return {
    thousandSeparator: ",",
    decimalSeparator: ".",
    thousandsGroupStyle: "thousand",
  };
}

export function formatAmountForDisplay(
  value: number | null | undefined,
  options?: {
    countryCode?: string | null;
    countryName?: string | null;
    fractionDigits?: number;
  },
): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const format = getAmountFormatForCountry(
    options?.countryCode ?? boundCountryCode,
    options?.countryName,
  );
  const digits = options?.fractionDigits ?? 2;
  return safe.toLocaleString(AMOUNT_FORMAT_LOCALE[format], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  });
}
