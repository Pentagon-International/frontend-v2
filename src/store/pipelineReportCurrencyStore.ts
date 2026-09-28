import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PipelineReportCurrencyMode = "LOCAL" | "USD";

type PipelineReportCurrencyState = {
  mode: PipelineReportCurrencyMode;
  /** Active branch the stored mode was last synced against. */
  activeBranchId: string;
  /** Active-branch currency the stored mode was last synced against. */
  branchCurrencyCode: string;
  setMode: (mode: PipelineReportCurrencyMode) => void;
  syncBranchCurrency: (branchId: string, code: string) => void;
  reset: () => void;
};

export const usePipelineReportCurrencyStore =
  create<PipelineReportCurrencyState>()(
    persist(
      (set, get) => ({
        mode: "LOCAL",
        activeBranchId: "",
        branchCurrencyCode: "",
        setMode: (mode) => set({ mode }),
        syncBranchCurrency: (branchId, code) => {
          const id = (branchId || "").trim();
          const normalized = (code || "").trim().toUpperCase();
          const prevId = get().activeBranchId;
          const branchChanged = prevId !== "" && id !== "" && prevId !== id;
          const localIsUsd = normalized === "USD";
          set({
            activeBranchId: id || prevId,
            branchCurrencyCode: normalized,
            mode: branchChanged || localIsUsd ? "LOCAL" : get().mode,
          });
        },
        reset: () =>
          set({ mode: "LOCAL", activeBranchId: "", branchCurrencyCode: "" }),
      }),
      {
        name: "pipeline-report-currency",
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          mode: state.mode,
          activeBranchId: state.activeBranchId,
          branchCurrencyCode: state.branchCurrencyCode,
        }),
      },
    ),
  );

export function resetPipelineReportCurrency() {
  usePipelineReportCurrencyStore.getState().reset();
}
