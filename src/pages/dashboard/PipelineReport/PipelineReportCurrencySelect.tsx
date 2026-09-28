import { useEffect, useMemo } from "react";
import { Select } from "@mantine/core";
import useAuthStore from "../../../store/authStore";
import {
  usePipelineReportCurrencyStore,
  type PipelineReportCurrencyMode,
} from "../../../store/pipelineReportCurrencyStore";

type BranchWithCurrency = {
  is_default?: boolean;
  user_branch_id?: number;
  branch_code?: string;
  currency?: { currency_code?: string } | null;
};

/** Active branch currency from the logged-in user. Empty when the branch has no currency. */
export function getActiveBranchCurrencyCode(
  branches: BranchWithCurrency[] | undefined,
): string {
  const branch =
    branches?.find((item) => item.is_default === true) ?? branches?.[0];
  return (branch?.currency?.currency_code || "").trim().toUpperCase();
}

/**
 * Local currency of the active branch, plus USD when that currency is not already USD.
 * Hidden for volume / shipment pipeline reports (company P2CCI).
 */
export default function PipelineReportCurrencySelect({
  dropdownZIndex,
}: {
  /** Needed inside the pipeline drawer, which stacks above the default menu. */
  dropdownZIndex?: number;
}) {
  const user = useAuthStore((state) => state.user);
  const mode = usePipelineReportCurrencyStore((state) => state.mode);
  const setMode = usePipelineReportCurrencyStore((state) => state.setMode);
  const syncBranchCurrency = usePipelineReportCurrencyStore(
    (state) => state.syncBranchCurrency,
  );

  const branches = user?.branches as BranchWithCurrency[] | undefined;
  const activeBranch = useMemo(
    () => branches?.find((item) => item.is_default === true) ?? branches?.[0],
    [branches],
  );
  const localCode = useMemo(
    () => getActiveBranchCurrencyCode(branches),
    [branches],
  );
  const activeBranchId =
    activeBranch?.user_branch_id != null
      ? String(activeBranch.user_branch_id)
      : (activeBranch?.branch_code ?? "");

  useEffect(() => {
    syncBranchCurrency(activeBranchId, localCode);
  }, [activeBranchId, localCode, syncBranchCurrency]);

  if (!localCode || localCode === "USD" || user?.pulse_id === "P2CCI") {
    return null;
  }

  return (
    <Select
      aria-label="Pipeline report currency"
      size="xs"
      allowDeselect={false}
      data={[
        { value: "LOCAL", label: localCode },
        { value: "USD", label: "USD" },
      ]}
      value={mode === "USD" ? "USD" : "LOCAL"}
      onChange={(value) =>
        setMode((value === "USD" ? "USD" : "LOCAL") as PipelineReportCurrencyMode)
      }
      w={92}
      comboboxProps={
        dropdownZIndex != null ? { zIndex: dropdownZIndex } : undefined
      }
      styles={{
        input: {
          height: 32,
          minHeight: 32,
          fontSize: 12,
        },
      }}
    />
  );
}
