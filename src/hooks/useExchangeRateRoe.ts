import { useCallback, useMemo, useRef } from "react";
import useAuthStore from "../store/authStore";
import {
  type CurrencyMasterItem,
  fetchExchangeRateMaster,
  getBranchCurrencyDefaults,
  isChargeBaseCurrency,
  isChargeBranchCurrency,
  resolveChargeCurrencyCode,
  validateRoeForCurrency,
  ROE_CANNOT_BE_ONE_FIELD,
  ROE_CANNOT_BE_ONE_TOAST,
} from "../utils/exchangeRateRoe";

type BranchLike = {
  is_default?: boolean;
  currency?: { currency_id?: number; currency_code?: string };
  country?: { country_code?: string };
};

export function useExchangeRateRoe() {
  const user = useAuthStore((state) => state.user);
  const defaultBranch = useMemo(() => {
    const branches = (user?.branches ?? []) as BranchLike[];
    return (
      branches.find((b) => b.is_default === true) ?? branches[0] ?? undefined
    );
  }, [user?.branches]);

  const defaultBranchCurrency = defaultBranch?.currency?.currency_code ?? "";
  const defaultBranchCurrencyId =
    defaultBranch?.currency?.currency_id != null
      ? String(defaultBranch.currency.currency_id)
      : "";
  const activeBranchCountryCode = defaultBranch?.country?.country_code ?? "";

  const roeCacheRef = useRef<Map<string, number>>(new Map());
  const pendingRoeFetchesRef = useRef<Map<string, Promise<number | null>>>(
    new Map(),
  );

  const isBaseCurrency = useCallback(
    (currency: string | null | undefined): boolean => {
      return isChargeBranchCurrency(
        currency ?? "",
        "",
        defaultBranchCurrency,
        defaultBranchCurrencyId,
      );
    },
    [defaultBranchCurrency, defaultBranchCurrencyId],
  );

  const isChargeBaseCurrencyFor = useCallback(
    (
      charge: {
        currency?: string;
        currency_code?: string;
        currency_id?: string;
      },
      currencyData: CurrencyMasterItem[],
    ): boolean => {
      return isChargeBaseCurrency(
        charge,
        defaultBranchCurrency,
        defaultBranchCurrencyId,
        currencyData,
      );
    },
    [defaultBranchCurrency, defaultBranchCurrencyId],
  );

  const ensureRoeForCurrency = useCallback(
    async (currency: string): Promise<number | null> => {
      const currencyUpper = currency?.trim().toUpperCase();
      if (!currencyUpper) return null;

      if (
        isChargeBranchCurrency(
          currencyUpper,
          "",
          defaultBranchCurrency,
          defaultBranchCurrencyId,
        )
      ) {
        roeCacheRef.current.set(currencyUpper, 1);
        return 1;
      }

      const cached = roeCacheRef.current.get(currencyUpper);
      if (cached !== undefined) return cached;

      if (!activeBranchCountryCode) return null;

      const pending = pendingRoeFetchesRef.current.get(currencyUpper);
      if (pending) return pending;

      const fetchPromise = (async (): Promise<number | null> => {
        try {
          const rate = await fetchExchangeRateMaster(
            activeBranchCountryCode,
            currencyUpper,
          );
          if (rate != null) {
            roeCacheRef.current.set(currencyUpper, rate);
          }
          return rate;
        } catch (error) {
          console.error("Error fetching exchange rate:", error);
          return null;
        } finally {
          pendingRoeFetchesRef.current.delete(currencyUpper);
        }
      })();

      pendingRoeFetchesRef.current.set(currencyUpper, fetchPromise);
      return fetchPromise;
    },
    [activeBranchCountryCode, defaultBranchCurrency, defaultBranchCurrencyId],
  );

  const validateRoeField = useCallback(
    (
      currencyCode: string | null | undefined,
      roe: number | null | undefined,
      currencyId?: string | null,
    ) =>
      validateRoeForCurrency(
        currencyCode,
        roe,
        defaultBranchCurrency,
        true,
        {
          currencyId,
          branchCurrencyId: defaultBranchCurrencyId,
        },
      ),
    [defaultBranchCurrency, defaultBranchCurrencyId],
  );

  const validateRoeToast = useCallback(
    (
      currencyCode: string | null | undefined,
      roe: number | null | undefined,
      currencyId?: string | null,
    ) =>
      validateRoeForCurrency(
        currencyCode,
        roe,
        defaultBranchCurrency,
        false,
        {
          currencyId,
          branchCurrencyId: defaultBranchCurrencyId,
        },
      ),
    [defaultBranchCurrency, defaultBranchCurrencyId],
  );

  const resolveCurrencyCode = useCallback(
    (
      charge: {
        currency?: string;
        currency_code?: string;
        currency_id?: string;
      },
      currencyData: CurrencyMasterItem[],
    ) => resolveChargeCurrencyCode(charge, currencyData),
    [],
  );

  const getBranchCurrencyDefaultsForForm = useCallback(
    () =>
      getBranchCurrencyDefaults(
        defaultBranchCurrencyId,
        defaultBranchCurrency,
      ),
    [defaultBranchCurrencyId, defaultBranchCurrency],
  );

  return {
    defaultBranchCurrency,
    defaultBranchCurrencyId,
    activeBranchCountryCode,
    isBaseCurrency,
    isChargeBaseCurrencyFor,
    ensureRoeForCurrency,
    validateRoeField,
    validateRoeToast,
    resolveCurrencyCode,
    getBranchCurrencyDefaults: getBranchCurrencyDefaultsForForm,
    roeCacheRef,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
  };
}
