import { getAPICall } from "../service/getApiCall";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";

export type CurrencyMasterItem = {
  id?: number;
  code?: string;
  currency_code?: string;
};

export const ROE_CANNOT_BE_ONE_FIELD = "ROE can't be 1";
export const ROE_CANNOT_BE_ONE_TOAST =
  "ROE cannot be 1 when currency differs from local currency";

export type BranchCurrencyLike = {
  is_default?: boolean;
  currency?: { currency_id?: number; currency_code?: string };
};

export function getDefaultBranchCurrencyFromUser(
  branches: BranchCurrencyLike[] | undefined,
): { branchCurrencyId: string; branchCurrencyCode: string } {
  const defaultBranch =
    branches?.find((b) => b.is_default === true) ?? branches?.[0];
  return {
    branchCurrencyId:
      defaultBranch?.currency?.currency_id != null
        ? String(defaultBranch.currency.currency_id)
        : "",
    branchCurrencyCode: defaultBranch?.currency?.currency_code ?? "",
  };
}

export function getBranchCurrencyDefaults(
  branchCurrencyId: string,
  branchCurrencyCode: string,
): {
  currency_id: string;
  currency_code: string;
  currency: string;
  roe: number | null;
} {
  const hasBranch = Boolean(
    String(branchCurrencyId).trim() || String(branchCurrencyCode).trim(),
  );
  return {
    currency_id: branchCurrencyId,
    currency_code: branchCurrencyCode,
    currency: branchCurrencyCode,
    roe: hasBranch ? 1 : null,
  };
}

export const formatExchangeSellRate = (sellRate: string | number): number => {
  const num = typeof sellRate === "string" ? parseFloat(sellRate) : sellRate;
  if (!Number.isFinite(num)) return 1;
  return Math.round(num * 100) / 100;
};

export const fetchExchangeRateMaster = async (
  countryCode: string,
  currencyCode: string,
): Promise<number | null> => {
  const response = await getAPICall(
    `${URL.exchangeRateMaster}?country_code=${encodeURIComponent(countryCode)}&currency_code=${encodeURIComponent(currencyCode)}`,
    API_HEADER,
  );
  const res = response as {
    data?:
      | { sell_rate?: string | number; data?: { sell_rate?: string | number } }
      | { sell_rate?: string | number };
    sell_rate?: string | number;
  };
  const body = (res?.data ?? res) as {
    sell_rate?: string | number;
    data?: { sell_rate?: string | number };
  };
  const sellRate = body?.data?.sell_rate ?? body?.sell_rate;
  if (sellRate == null || sellRate === "") return null;
  return formatExchangeSellRate(sellRate);
};

export const isChargeBranchCurrency = (
  currencyCode: string,
  currencyId: string,
  branchCurrency: string,
  branchCurrencyId: string,
): boolean => {
  const base = branchCurrency?.trim().toUpperCase() ?? "";
  const code = currencyCode?.trim().toUpperCase() ?? "";
  if (base && code && code === base) return true;
  if (
    branchCurrencyId &&
    currencyId &&
    String(currencyId) === String(branchCurrencyId)
  ) {
    return true;
  }
  return false;
};

export const resolveChargeCurrencyCode = (
  charge: {
    currency?: string;
    currency_code?: string;
    currency_id?: string;
  },
  currencyData: CurrencyMasterItem[],
): string => {
  const currencyId = charge.currency_id
    ? String(charge.currency_id).trim()
    : "";
  const fromField = (charge.currency ?? charge.currency_code ?? "")
    .trim()
    .toUpperCase();
  if (fromField && currencyId && fromField === currencyId.toUpperCase()) {
    const row = currencyData.find((c) => String(c.id) === currencyId);
    return (row?.code || row?.currency_code || "")
      .toString()
      .trim()
      .toUpperCase();
  }
  if (fromField) return fromField;
  if (currencyId) {
    const row = currencyData.find((c) => String(c.id) === currencyId);
    return (row?.code || row?.currency_code || "")
      .toString()
      .trim()
      .toUpperCase();
  }
  return "";
};

export const validateRoeForCurrency = (
  currencyCode: string | null | undefined,
  roe: number | null | undefined,
  branchCurrency: string | null | undefined,
  forField = false,
  options?: {
    currencyId?: string | null;
    branchCurrencyId?: string | null;
  },
): string | null => {
  if (roe === null || roe === undefined) return "ROE is required";

  const branchCurrencyId = options?.branchCurrencyId ?? "";
  const base = branchCurrency?.trim().toUpperCase() ?? "";
  const code = currencyCode?.trim().toUpperCase() ?? "";
  const currencyId = options?.currencyId ?? "";
  const hasBranchCurrency = Boolean(base || branchCurrencyId);
  const hasChargeCurrency = Boolean(code || currencyId);
  if (!hasBranchCurrency || !hasChargeCurrency) return null;

  const isBase = isChargeBranchCurrency(
    code,
    currencyId,
    branchCurrency ?? "",
    branchCurrencyId,
  );

  if (isBase && roe !== 1) {
    return "ROE must be 1 when currency matches local currency";
  }
  if (!isBase && roe === 1) {
    return forField ? ROE_CANNOT_BE_ONE_FIELD : ROE_CANNOT_BE_ONE_TOAST;
  }
  return null;
};

export const isChargeBaseCurrency = (
  charge: {
    currency?: string;
    currency_code?: string;
    currency_id?: string;
  },
  branchCurrency: string,
  branchCurrencyId: string,
  currencyData: CurrencyMasterItem[],
): boolean => {
  const code = resolveChargeCurrencyCode(charge, currencyData);
  return isChargeBranchCurrency(
    code,
    charge.currency_id ?? "",
    branchCurrency,
    branchCurrencyId,
  );
};

export type EstimateRoeRow = {
  currency_code?: string;
  currency_id?: string;
  roe?: number | null;
};

export const validateEstimatesRoeRows = (
  rows: EstimateRoeRow[],
  branchCurrency: string,
  branchCurrencyId: string,
  currencyData: CurrencyMasterItem[],
): {
  ok: boolean;
  fieldErrors: Record<number, { roe: string }>;
  toastMessage: string | null;
} => {
  const fieldErrors: Record<number, { roe: string }> = {};
  let toastMessage: string | null = null;

  rows.forEach((row, index) => {
    const hasCurrency = Boolean(
      String(row.currency_id ?? "").trim() || String(row.currency_code ?? "").trim(),
    );
    if (!hasCurrency || row.roe == null) return;

    const code = resolveChargeCurrencyCode(
      {
        currency_code: row.currency_code,
        currency_id: row.currency_id,
      },
      currencyData,
    );
    const toastError = validateRoeForCurrency(
      code,
      row.roe,
      branchCurrency,
      false,
      {
        currencyId: row.currency_id,
        branchCurrencyId,
      },
    );
    if (!toastError) return;

    const fieldError = validateRoeForCurrency(
      code,
      row.roe,
      branchCurrency,
      true,
      {
        currencyId: row.currency_id,
        branchCurrencyId,
      },
    );
    fieldErrors[index] = { roe: fieldError ?? toastError };
    if (!toastMessage) toastMessage = toastError;
  });

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    toastMessage,
  };
};
