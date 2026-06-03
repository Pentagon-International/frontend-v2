import { useCallback, useMemo } from "react";
import useAuthStore from "../store/authStore";
import {
  formatBudgetAmountCrL,
  formatBudgetCurrencyFull,
  formatUserInteger,
  getDefaultBranchCountryCode,
  getDefaultBranchCurrencyCode,
  getOutstandingAmountCurrencySymbol,
  getUserNumberLocale,
  isIndianNumberFormatCountry,
} from "../utils/userNumberFormat";

/** Number grouping from active login branch: en-IN for India, en-US for foreign. */
export function useBranchNumberFormat() {
  const branches = useAuthStore((state) => state.user?.branches);
  const branchCountryCode = useMemo(
    () => getDefaultBranchCountryCode(branches),
    [branches],
  );
  const branchCurrencyCode = useMemo(
    () => getDefaultBranchCurrencyCode(branches),
    [branches],
  );
  const numberLocale = getUserNumberLocale(branchCountryCode, branchCurrencyCode);
  const isIndianBranch = isIndianNumberFormatCountry(
    branchCountryCode,
    branchCurrencyCode,
  );
  const currencySymbol = getOutstandingAmountCurrencySymbol(
    branchCurrencyCode,
    branchCountryCode,
  );

  const formatAmount = useCallback(
    (value: string | number | null | undefined) =>
      formatUserInteger(value, branchCountryCode, branchCurrencyCode),
    [branchCountryCode, branchCurrencyCode],
  );

  const formatBudgetCrL = useCallback(
    (value: unknown) =>
      formatBudgetAmountCrL(value, branchCountryCode, branchCurrencyCode),
    [branchCountryCode, branchCurrencyCode],
  );

  const formatBudgetFull = useCallback(
    (value: unknown) =>
      formatBudgetCurrencyFull(value, branchCountryCode, branchCurrencyCode),
    [branchCountryCode, branchCurrencyCode],
  );

  return {
    branchCountryCode,
    branchCurrencyCode,
    numberLocale,
    isIndianBranch,
    currencySymbol,
    formatAmount,
    formatAmountFromNumber: formatAmount,
    formatBudgetCrL,
    formatBudgetFull,
  };
}
