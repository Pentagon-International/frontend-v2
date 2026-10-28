import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ToastNotification } from "../components";
import { useExchangeRateRoe } from "./useExchangeRateRoe";
import { formatRoeAsString } from "../utils/exchangeRateRoe";
import { formatMoneyAmountBound } from "../utils/nonDecimalMoneyAmount";

export type BookingChargeRoeRow = {
  currency_country_code?: string;
  roe?: string | number | "";
  cost_currency_country_code?: string;
  cost_roe?: string | number | "";
  no_of_units?: string | number | "";
  sell_per_unit?: string | number | "";
  cost_per_unit?: string | number | "";
  total_sell?: string | number | "";
  total_cost?: string | number | "";
};

type UpdateChargeFn = (
  index: number,
  field: string,
  value: string | number,
) => void;

export const parseBookingRoe = (
  roe: string | number | "" | null | undefined,
): number | null => {
  if (roe === "" || roe === null || roe === undefined) return null;
  const num = typeof roe === "string" ? parseFloat(roe) : roe;
  return Number.isFinite(num) ? num : null;
};

const isBookingRoeEmpty = (
  roe: string | number | "" | null | undefined,
): boolean => roe === "" || roe === null || roe === undefined;

/** Cost currency from cost field only (no sell fallback). */
export const resolveCostCurrencyCode = (
  charge: BookingChargeRoeRow,
): string => String(charge.cost_currency_country_code ?? "").trim();

/** Cost ROE from cost field only (no sell fallback). */
export const resolveCostRoeValue = (
  charge: BookingChargeRoeRow,
): string | number | "" | null | undefined => charge.cost_roe;

export const recalcBookingChargeTotals = <T extends BookingChargeRoeRow>(
  charge: T,
): T => {
  const next = { ...charge };
  const noOfUnits = parseFloat(String(next.no_of_units)) || 0;
  const sellPerUnit = parseFloat(String(next.sell_per_unit)) || 0;
  const costPerUnit = parseFloat(String(next.cost_per_unit)) || 0;
  const sellRoe = parseFloat(String(next.roe)) || 1;
  const costRoe = parseFloat(String(next.cost_roe ?? "")) || 1;
  next.total_sell = formatMoneyAmountBound(noOfUnits * sellPerUnit * sellRoe);
  next.total_cost = formatMoneyAmountBound(noOfUnits * costPerUnit * costRoe);
  return next;
};

export function useBookingChargesRoe<T extends BookingChargeRoeRow>(
  charges: T[],
  setCharges: Dispatch<SetStateAction<T[]>>,
) {
  const {
    defaultBranchCurrency,
    isBaseCurrency,
    ensureRoeForCurrency,
    validateRoeField,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
  } = useExchangeRateRoe();

  const [chargeRoeErrors, setChargeRoeErrors] = useState<
    Record<number, string>
  >({});
  const [costChargeRoeErrors, setCostChargeRoeErrors] = useState<
    Record<number, string>
  >({});

  const chargeCurrenciesKey = charges
    .map((c) => String(c.currency_country_code ?? "").trim())
    .join("|");
  const costChargeCurrenciesKey = charges
    .map((c) => resolveCostCurrencyCode(c))
    .join("|");

  useEffect(() => {
    const branchCurrency = defaultBranchCurrency.trim();
    if (!branchCurrency) return;

    let changed = false;
    const updated = charges.map((charge) => {
      // Default empty sell currency only — never copy sell into cost fields
      if (!String(charge.currency_country_code ?? "").trim()) {
        changed = true;
        return recalcBookingChargeTotals({
          ...charge,
          currency_country_code: branchCurrency,
          roe: "1",
        });
      }
      return charge;
    });
    if (changed) setCharges(updated);
  }, [charges, defaultBranchCurrency, setCharges]);

  const clearChargeRoeError = useCallback((index: number) => {
    setChargeRoeErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const clearCostChargeRoeError = useCallback((index: number) => {
    setCostChargeRoeErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  useEffect(() => {
    let changed = false;
    const updated = charges.map((charge) => {
      const code = String(charge.currency_country_code ?? "").trim();
      if (code && isBaseCurrency(code) && parseBookingRoe(charge.roe) !== 1) {
        changed = true;
        return recalcBookingChargeTotals({ ...charge, roe: "1" });
      }
      return charge;
    });
    if (changed) setCharges(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrenciesKey]);

  useEffect(() => {
    let changed = false;
    const updated = charges.map((charge) => {
      const code = resolveCostCurrencyCode(charge);
      const costRoe = resolveCostRoeValue(charge);
      if (code && isBaseCurrency(code) && parseBookingRoe(costRoe) !== 1) {
        changed = true;
        return recalcBookingChargeTotals({ ...charge, cost_roe: "1" });
      }
      return charge;
    });
    if (changed) setCharges(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costChargeCurrenciesKey]);

  useEffect(() => {
    charges.forEach((charge, index) => {
      const code = String(charge.currency_country_code ?? "")
        .trim()
        .toUpperCase();
      if (!code || !isBookingRoeEmpty(charge.roe)) return;
      if (isBaseCurrency(code)) return;
      void ensureRoeForCurrency(code).then((roe) => {
        if (roe == null) return;
        setCharges((prev) => {
          if (!isBookingRoeEmpty(prev[index]?.roe)) return prev;
          if (
            String(prev[index]?.currency_country_code ?? "")
              .trim()
              .toUpperCase() !== code
          ) {
            return prev;
          }
          const next = [...prev];
          next[index] = recalcBookingChargeTotals({
            ...next[index],
            roe: formatRoeAsString(roe),
          });
          return next;
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrenciesKey]);

  useEffect(() => {
    charges.forEach((charge, index) => {
      const code = resolveCostCurrencyCode(charge).toUpperCase();
      if (!code || !isBookingRoeEmpty(charge.cost_roe)) return;
      if (isBaseCurrency(code)) return;
      // Only auto-fetch when cost currency is explicitly set (or differs from sell)
      if (!String(charge.cost_currency_country_code ?? "").trim()) return;
      void ensureRoeForCurrency(code).then((roe) => {
        if (roe == null) return;
        setCharges((prev) => {
          if (!isBookingRoeEmpty(prev[index]?.cost_roe)) return prev;
          if (resolveCostCurrencyCode(prev[index] ?? {}).toUpperCase() !== code) {
            return prev;
          }
          const next = [...prev];
          next[index] = recalcBookingChargeTotals({
            ...next[index],
            cost_roe: formatRoeAsString(roe),
          });
          return next;
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costChargeCurrenciesKey]);

  const handleCurrencyChange = useCallback(
    (index: number, currencyCode: string, updateCharge: UpdateChargeFn) => {
      const code = currencyCode.trim();
      updateCharge(index, "currency_country_code", code);
      if (isBaseCurrency(code)) {
        updateCharge(index, "roe", "1");
      } else {
        updateCharge(index, "roe", "");
        void ensureRoeForCurrency(code.toUpperCase()).then((roe) => {
          if (roe != null) updateCharge(index, "roe", formatRoeAsString(roe));
        });
      }
      clearChargeRoeError(index);
    },
    [clearChargeRoeError, ensureRoeForCurrency, isBaseCurrency],
  );

  const handleCostCurrencyChange = useCallback(
    (index: number, currencyCode: string, updateCharge: UpdateChargeFn) => {
      const code = currencyCode.trim();
      updateCharge(index, "cost_currency_country_code", code);
      if (isBaseCurrency(code)) {
        updateCharge(index, "cost_roe", "1");
      } else {
        updateCharge(index, "cost_roe", "");
        void ensureRoeForCurrency(code.toUpperCase()).then((roe) => {
          if (roe != null)
            updateCharge(index, "cost_roe", formatRoeAsString(roe));
        });
      }
      clearCostChargeRoeError(index);
    },
    [clearCostChargeRoeError, ensureRoeForCurrency, isBaseCurrency],
  );

  const handleRoeChange = useCallback(
    (
      index: number,
      value: string | number,
      updateCharge: UpdateChargeFn,
    ) => {
      const charge = charges[index];
      const code = String(charge?.currency_country_code ?? "").trim();
      if (code && isBaseCurrency(code)) {
        updateCharge(index, "roe", "1");
        return;
      }
      updateCharge(index, "roe", value);
      const roeError = validateRoeField(code, parseBookingRoe(value));
      setChargeRoeErrors((prev) => {
        if (roeError) return { ...prev, [index]: roeError };
        if (!prev[index]) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [charges, isBaseCurrency, validateRoeField],
  );

  const handleCostRoeChange = useCallback(
    (
      index: number,
      value: string | number,
      updateCharge: UpdateChargeFn,
    ) => {
      const charge = charges[index];
      const code = resolveCostCurrencyCode(charge ?? {});
      if (code && isBaseCurrency(code)) {
        updateCharge(index, "cost_roe", "1");
        return;
      }
      updateCharge(index, "cost_roe", value);
      const roeError = validateRoeField(code, parseBookingRoe(value));
      setCostChargeRoeErrors((prev) => {
        if (roeError) return { ...prev, [index]: roeError };
        if (!prev[index]) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [charges, isBaseCurrency, validateRoeField],
  );

  const validateChargesRoe = useCallback((): boolean => {
    let toastMessage: string | null = null;
    const errors: Record<number, string> = {};
    const costErrors: Record<number, string> = {};

    charges.forEach((charge, index) => {
      const sellCode = String(charge.currency_country_code ?? "").trim();
      if (sellCode) {
        const roeError = validateRoeField(sellCode, parseBookingRoe(charge.roe));
        if (roeError) {
          errors[index] = roeError;
          if (!toastMessage) {
            toastMessage =
              roeError === ROE_CANNOT_BE_ONE_FIELD
                ? ROE_CANNOT_BE_ONE_TOAST
                : roeError;
          }
        }
      }
      const costCode = resolveCostCurrencyCode(charge);
      if (costCode) {
        const costRoeError = validateRoeField(
          costCode,
          parseBookingRoe(charge.cost_roe),
        );
        if (costRoeError) {
          costErrors[index] = costRoeError;
          if (!toastMessage) {
            toastMessage =
              costRoeError === ROE_CANNOT_BE_ONE_FIELD
                ? ROE_CANNOT_BE_ONE_TOAST
                : costRoeError;
          }
        }
      }
    });

    if (
      Object.keys(errors).length === 0 &&
      Object.keys(costErrors).length === 0
    ) {
      return true;
    }

    setChargeRoeErrors(errors);
    setCostChargeRoeErrors(costErrors);
    ToastNotification({
      type: "error",
      message: toastMessage ?? ROE_CANNOT_BE_ONE_TOAST,
    });
    return false;
  }, [
    charges,
    validateRoeField,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
  ]);

  return {
    defaultBranchCurrency,
    isChargeBaseCurrency: isBaseCurrency,
    chargeRoeErrors,
    costChargeRoeErrors,
    handleCurrencyChange,
    handleCostCurrencyChange,
    handleRoeChange,
    handleCostRoeChange,
    validateChargesRoe,
    clearChargeRoeError,
    clearCostChargeRoeError,
  };
}
