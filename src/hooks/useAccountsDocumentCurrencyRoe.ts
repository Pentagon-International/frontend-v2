import { useCallback } from "react";
import { useExchangeRateRoe } from "./useExchangeRateRoe";

/**
 * Accounts documents: active branch currency defaults + exchange-rate-master ROE.
 */
export function useAccountsDocumentCurrencyRoe() {
  const exchange = useExchangeRateRoe();
  const {
    defaultBranchCurrency,
    defaultBranchCurrencyId,
    activeBranchCountryCode,
    isBaseCurrency,
    ensureRoeForCurrency,
    getBranchCurrencyDefaults,
    validateRoeField,
    validateRoeToast,
    resolveCurrencyCode,
    isChargeBaseCurrencyFor,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
  } = exchange;

  const localCurrency = defaultBranchCurrency;

  const resolveRoeForCurrency = useCallback(
    async (currencyCode: string | null | undefined): Promise<number | null> => {
      const code = String(currencyCode ?? "").trim().toUpperCase();
      if (!code) return null;
      if (isBaseCurrency(code)) return 1;
      return ensureRoeForCurrency(code);
    },
    [ensureRoeForCurrency, isBaseCurrency],
  );

  const syncRoeForCurrencyChange = useCallback(
    (
      currencyCode: string | null | undefined,
      setRoe: (roe: number | null) => void,
      currencyId?: string | null,
    ) => {
      const code = String(currencyCode ?? "").trim().toUpperCase();
      if (!code && !currencyId) return;
      if (isBaseCurrency(code, currencyId)) {
        setRoe(1);
        return;
      }
      if (!code) return;
      void ensureRoeForCurrency(code).then((roe) => {
        if (roe != null) setRoe(roe);
      });
    },
    [ensureRoeForCurrency, isBaseCurrency],
  );

  const onRoeValueChange = useCallback(
    (
      currencyCode: string | null | undefined,
      rawRoe: number | null | undefined,
      setRoe: (roe: number | null) => void,
      setFieldError: (field: string, message: string) => void,
      clearFieldError: (field: string) => void,
      fieldKey = "roe",
      currencyId?: string | null,
    ) => {
      if (isBaseCurrency(currencyCode, currencyId)) {
        setRoe(1);
        clearFieldError(fieldKey);
        return;
      }
      setRoe(rawRoe ?? null);
      const err = validateRoeField(currencyCode, rawRoe, currencyId);
      if (err) setFieldError(fieldKey, err);
      else clearFieldError(fieldKey);
    },
    [isBaseCurrency, validateRoeField],
  );

  return {
    localCurrency,
    defaultBranchCurrency,
    defaultBranchCurrencyId,
    activeBranchCountryCode,
    isLocalCurrency: isBaseCurrency,
    isBaseCurrency,
    resolveRoeForCurrency,
    syncRoeForCurrencyChange,
    onRoeValueChange,
    ensureRoeForCurrency,
    getBranchCurrencyDefaults,
    validateRoeField,
    validateRoeToast,
    resolveCurrencyCode,
    isChargeBaseCurrencyFor,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
  };
}
