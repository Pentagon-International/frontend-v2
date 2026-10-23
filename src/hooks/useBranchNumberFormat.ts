import { useCallback, useMemo } from "react";
import useAuthStore from "../store/authStore";
import { usePipelineReportCurrencyStore } from "../store/pipelineReportCurrencyStore";
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
  const displayCurrencyMode = usePipelineReportCurrencyStore((state) => state.mode);
  const branchCountryCode = useMemo(
    () => getDefaultBranchCountryCode(branches),
    [branches],
  );
  const branchCurrencyCode = useMemo(
    () => getDefaultBranchCurrencyCode(branches),
    [branches],
  );
  const effectiveCurrencyCode =
    displayCurrencyMode === "USD" ? "USD" : branchCurrencyCode;
  const numberLocale = getUserNumberLocale(branchCountryCode, effectiveCurrencyCode);
  const isIndianBranch = isIndianNumberFormatCountry(
    branchCountryCode,
    branchCurrencyCode,
  );
  const currencySymbol = getOutstandingAmountCurrencySymbol(
    effectiveCurrencyCode,
    branchCountryCode,
  );

  const formatAmount = useCallback(
    (value: string | number | null | undefined) =>
      formatUserInteger(value, branchCountryCode, effectiveCurrencyCode),
    [branchCountryCode, effectiveCurrencyCode],
  );

  const formatBudgetCrL = useCallback(
    (value: unknown) =>
      formatBudgetAmountCrL(value, branchCountryCode, effectiveCurrencyCode),
    [branchCountryCode, effectiveCurrencyCode],
  );

  const formatBudgetFull = useCallback(
    (value: unknown) =>
      formatBudgetCurrencyFull(value, branchCountryCode, effectiveCurrencyCode),
    [branchCountryCode, effectiveCurrencyCode],
  );

  return {
    branchCountryCode,
    branchCurrencyCode: effectiveCurrencyCode,
    numberLocale,
    isIndianBranch,
    currencySymbol,
    formatAmount,
    formatAmountFromNumber: formatAmount,
    formatBudgetCrL,
    formatBudgetFull,
  };
}
