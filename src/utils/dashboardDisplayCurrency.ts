import { usePipelineReportCurrencyStore } from "../store/pipelineReportCurrencyStore";

export type DashboardDisplayCurrency = "LOCAL" | "USD";

/** Current dashboard display currency from the shared session store. */
export function getDashboardDisplayCurrency(): DashboardDisplayCurrency {
  return usePipelineReportCurrencyStore.getState().mode === "USD" ? "USD" : "LOCAL";
}

/** Fields to merge into dashboard money API payloads (same as Pipeline Report). */
export function getDashboardDisplayCurrencyFields(): {
  display_currency: DashboardDisplayCurrency;
} {
  return { display_currency: getDashboardDisplayCurrency() };
}

/** Merge display_currency into a payload without mutating the original. */
export function withDisplayCurrency<T extends Record<string, unknown>>(
  payload: T,
): T & { display_currency: DashboardDisplayCurrency } {
  return {
    ...payload,
    ...getDashboardDisplayCurrencyFields(),
  };
}
