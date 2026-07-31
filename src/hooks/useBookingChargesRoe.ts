import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ToastNotification } from "../components";
import { useExchangeRateRoe } from "./useExchangeRateRoe";
import { formatRoeAsString } from "../utils/exchangeRateRoe";
import { formatMoneyAmountBound } from "../utils/nonDecimalMoneyAmount";

export type BookingChargeRoeRow = {
  currency_country_code?: string;
  roe?: string | number | "";
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

export const recalcBookingChargeTotals = <T extends BookingChargeRoeRow>(
  charge: T,
): T => {
  const next = { ...charge };
  const noOfUnits = parseFloat(String(next.no_of_units)) || 0;
  const sellPerUnit = parseFloat(String(next.sell_per_unit)) || 0;
  const costPerUnit = parseFloat(String(next.cost_per_unit)) || 0;
  const roe = parseFloat(String(next.roe)) || 1;
  next.total_sell = formatMoneyAmountBound(noOfUnits * sellPerUnit * roe);
  next.total_cost = formatMoneyAmountBound(noOfUnits * costPerUnit * roe);
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

  const chargeCurrenciesKey = charges
    .map((c) => String(c.currency_country_code ?? "").trim())
    .join("|");

  useEffect(() => {
    const branchCurrency = defaultBranchCurrency.trim();
    if (!branchCurrency) return;

    let changed = false;
    const updated = charges.map((charge) => {
      if (String(charge.currency_country_code ?? "").trim()) return charge;
      changed = true;
      return recalcBookingChargeTotals({
        ...charge,
        currency_country_code: branchCurrency,
        roe: "1",
      });
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

  const validateChargesRoe = useCallback((): boolean => {
    let toastMessage: string | null = null;
    const errors: Record<number, string> = {};

    charges.forEach((charge, index) => {
      const code = String(charge.currency_country_code ?? "").trim();
      if (!code) return;
      const roeError = validateRoeField(code, parseBookingRoe(charge.roe));
      if (!roeError) return;
      errors[index] = roeError;
      if (!toastMessage) {
        toastMessage =
          roeError === ROE_CANNOT_BE_ONE_FIELD
            ? ROE_CANNOT_BE_ONE_TOAST
            : roeError;
      }
    });

    if (Object.keys(errors).length === 0) return true;

    setChargeRoeErrors(errors);
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
    handleCurrencyChange,
    handleRoeChange,
    validateChargesRoe,
    clearChargeRoeError,
  };
}
