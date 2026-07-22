import { useCallback } from "react";
import { useExchangeRateRoe } from "./useExchangeRateRoe";
import { clampRoeForAccounts } from "../utils/exchangeRateRoe";
import ToastNotification from "../components/ToastNotification";

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
      onValidated?: (roe: number | null, fieldError: string | null) => void,
    ) => {
      const code = String(currencyCode ?? "").trim().toUpperCase();
      if (!code && !currencyId) return;
      if (isBaseCurrency(code, currencyId)) {
        setRoe(1);
        onValidated?.(1, null);
        return;
      }
      if (!code) return;
      setRoe(null);
      void ensureRoeForCurrency(code).then((roe) => {
        const normalized = roe != null ? clampRoeForAccounts(roe) : null;
        setRoe(normalized);
        const err = validateRoeField(code, normalized, currencyId);
        onValidated?.(normalized, err);
        if (err === ROE_CANNOT_BE_ONE_FIELD) {
          ToastNotification({
            type: "error",
            message: ROE_CANNOT_BE_ONE_TOAST,
          });
        }
      });
    },
    [
      ensureRoeForCurrency,
      isBaseCurrency,
      validateRoeField,
      ROE_CANNOT_BE_ONE_FIELD,
      ROE_CANNOT_BE_ONE_TOAST,
    ],
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
      const normalizedRoe = clampRoeForAccounts(rawRoe ?? null);
      setRoe(normalizedRoe);
      const err = validateRoeField(currencyCode, normalizedRoe, currencyId);
      if (err) {
        setFieldError(fieldKey, err);
        if (err === ROE_CANNOT_BE_ONE_FIELD) {
          ToastNotification({
            type: "error",
            message: ROE_CANNOT_BE_ONE_TOAST,
          });
        }
      } else {
        clearFieldError(fieldKey);
      }
    },
    [
      isBaseCurrency,
      validateRoeField,
      ROE_CANNOT_BE_ONE_FIELD,
      ROE_CANNOT_BE_ONE_TOAST,
    ],
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
