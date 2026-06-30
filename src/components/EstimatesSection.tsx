import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { ActionIcon, Box, Grid, Group, Text } from "@mantine/core";
import { useForm, type UseFormReturnType } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import useAuthStore from "../store/authStore";
import { getAPICall } from "../service/getApiCall";
import { postAPICall } from "../service/postApiCall";
import Dropdown from "./Dropdown";
import SearchableSelect from "./SearchableSelect";
import FormNumberInput from "./FormNumberInput";
import RequiredLabel from "./RequiredLabel";
import ToastNotification from "./ToastNotification";
import {
  applyJobChargeUnitChange,
  buildJobUnitOptions,
  mapJobChargesWithUnits,
  toBookingCargoForNoOfUnits,
  type JobChargeNoOfUnitContext,
} from "../utils/houseCargoChargeableWeight";
import {
  calcEstimatesTotalCost,
  formatJobSummaryAmount,
  parseSummaryAmount,
} from "../utils/jobSummaryTotals";
import type { BranchCurrencyContext } from "../utils/userNumberFormat";
import { useExchangeRateRoe } from "../hooks/useExchangeRateRoe";
import {
  getBranchCurrencyDefaults,
  getDefaultBranchCurrencyFromUser,
  ROE_CANNOT_BE_ONE_TOAST,
  ROE_DECIMAL_PLACES,
  validateEstimatesRoeRows,
  type BranchCurrencyLike,
} from "../utils/exchangeRateRoe";

export type EstimateRow = {
  id?: number | string;
  supplier_code: string;
  supplier_name: string;
  charge_id: number | null;
  charge_name: string;
  pp_cc: string;
  unit_id: string;
  unit_code: string;
  no_of_unit: number | null;
  currency_id: string;
  currency_code: string;
  roe: number | null;
  cost_per_unit: number | null;
  total_cost: number | null;
};

export type EstimatesFormValues = {
  estimates: EstimateRow[];
};

export function createEmptyEstimateRow(options?: {
  currencyId?: string;
  currencyCode?: string;
}): EstimateRow {
  const branchDefaults = getBranchCurrencyDefaults(
    options?.currencyId ?? "",
    options?.currencyCode ?? "",
  );
  return {
    supplier_code: "",
    supplier_name: "",
    charge_id: null,
    charge_name: "",
    pp_cc: "",
    unit_id: "",
    unit_code: "",
    no_of_unit: null,
    currency_id: branchDefaults.currency_id,
    currency_code: branchDefaults.currency_code,
    roe: branchDefaults.roe,
    cost_per_unit: null,
    total_cost: null,
  };
}

type CurrencyMasterItem = {
  id?: number;
  code?: string;
  currency_code?: string;
  currency_name?: string;
};

type UnitMasterItem = {
  id?: number;
  unit_code?: string;
  unit_name?: string;
};

async function fetchCurrencyMaster(): Promise<CurrencyMasterItem[]> {
  const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
  const raw = (response as { data?: unknown[] })?.data ?? response;
  return Array.isArray(raw) ? (raw as CurrencyMasterItem[]) : [];
}

async function fetchUnitMaster(serviceType: string): Promise<UnitMasterItem[]> {
  const payload = { filters: { service_type: serviceType } };
  const response = (await postAPICall(
    URL.unitMasterFilter,
    payload,
    API_HEADER,
  )) as { data?: unknown[] };
  const raw = response?.data ?? [];
  return Array.isArray(raw) ? (raw as UnitMasterItem[]) : [];
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

/** Mantine Select option values are strings; API rows may use numbers. */
function selectStringId(id: unknown): string | null {
  if (id == null || id === "") return null;
  const s = String(id).trim();
  return s === "" ? null : s;
}

function calcTotalCost(
  no_of_unit: unknown,
  roe: unknown,
  cost_per_unit: unknown,
): number | null {
  const qty = toNumberOrNull(no_of_unit);
  const rate = toNumberOrNull(roe);
  const cpu = toNumberOrNull(cost_per_unit);
  if (qty == null || cpu == null || rate == null) return null;
  if (!Number.isFinite(qty) || !Number.isFinite(cpu) || !Number.isFinite(rate)) {
    return null;
  }
  return Math.round(qty * rate * cpu * 100) / 100;
}

function normalizePpCc(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "PP" || raw === "PREPAID") return "Prepaid";
  if (raw === "CC" || raw === "COLLECT") return "Collect";
  return String(value ?? "").trim();
}

export type EstimatesSectionProps = {
  form: UseFormReturnType<EstimatesFormValues>;
  serviceType?: string | string[];
  readOnly?: boolean;
  /** Defaults to URL.supplierByType */
  supplierEndpoint?: string;
  /** Defaults to URL.chargeMaster */
  chargeEndpoint?: string;
  /** Set if you want to restrict unit master in future */
  unitMasterFilters?: Record<string, unknown>;
  /** Optional debug tag; logs form values when provided */
  debugTag?: string;
  /** From filter/list API summary on edit — used until estimates are changed */
  summaryEstimatesTotalCost?: number | string | null;
  /** User branches for amount formatting */
  userBranches?: BranchCurrencyContext[] | null;
  /** When set, auto-fills no_of_unit on unit selection (job create/edit). */
  jobUnitDefaults?: {
    service: string;
  } & JobChargeNoOfUnitContext;
  /** Parent calls this before submit to block API when ROE rules fail. */
  roeSubmitValidateRef?: MutableRefObject<(() => boolean) | null>;
};

export function EstimatesSection({
  form,
  serviceType,
  readOnly = false,
  supplierEndpoint = URL.supplierByType,
  chargeEndpoint = URL.chargeMaster,
  debugTag,
  summaryEstimatesTotalCost,
  userBranches,
  jobUnitDefaults,
  roeSubmitValidateRef,
}: EstimatesSectionProps) {
  const user = useAuthStore((state) => state.user);
  const branches = userBranches ?? (user?.branches as BranchCurrencyContext[] | undefined);
  const {
    isBaseCurrency,
    isChargeBaseCurrencyFor,
    ensureRoeForCurrency,
    validateRoeField,
    defaultBranchCurrency,
    defaultBranchCurrencyId,
  } = useExchangeRateRoe();

  const createDefaultEstimateRow = () =>
    createEmptyEstimateRow({
      currencyId: defaultBranchCurrencyId,
      currencyCode: defaultBranchCurrency,
    });
  const [estimateErrors, setEstimateErrors] = useState<
    Record<number, Record<string, string>>
  >({});
  const serviceTypeValue = Array.isArray(serviceType)
    ? (serviceType[0] ?? "")
    : (serviceType ?? "");
  const serviceTypeKey = Array.isArray(serviceType)
    ? serviceType.join(",")
    : (serviceType ?? "");

  const { data: currencyDataRaw = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster", serviceTypeKey],
    queryFn: () => fetchUnitMaster(serviceTypeValue),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const currencyData = (currencyDataRaw ?? []) as CurrencyMasterItem[];

  const estimateCurrenciesKey = form.values.estimates
    .map((r) => `${r.currency_id ?? ""}|${r.currency_code ?? ""}`)
    .join("|");

  useEffect(() => {
    let changed = false;
    const updated = form.values.estimates.map((row) => {
      if (
        isChargeBaseCurrencyFor(
          {
            currency_code: row.currency_code,
            currency_id: row.currency_id,
          },
          currencyData,
        ) &&
        row.roe !== 1
      ) {
        changed = true;
        return { ...row, roe: 1 };
      }
      return row;
    });
    if (changed) form.setFieldValue("estimates", updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateCurrenciesKey, currencyDataRaw]);

  useEffect(() => {
    form.values.estimates.forEach((row, index) => {
      if (!row.currency_id || row.roe != null) return;
      const code = String(row.currency_code ?? "").trim().toUpperCase();
      if (!code) return;
      if (
        isChargeBaseCurrencyFor(
          { currency_code: row.currency_code, currency_id: row.currency_id },
          currencyData,
        )
      ) {
        return;
      }
      void ensureRoeForCurrency(code).then((roe) => {
        if (form.values.estimates[index]?.roe == null) {
          form.setFieldValue(`estimates.${index}.roe`, roe);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateCurrenciesKey, currencyDataRaw]);

  useEffect(() => {
    if (!roeSubmitValidateRef) return;
    roeSubmitValidateRef.current = () => {
      const result = validateEstimatesRoeRows(
        form.values.estimates,
        defaultBranchCurrency,
        defaultBranchCurrencyId,
        currencyData,
      );
      if (!result.ok) {
        setEstimateErrors((prev) => ({ ...prev, ...result.fieldErrors }));
        ToastNotification({
          type: "error",
          message: result.toastMessage ?? ROE_CANNOT_BE_ONE_TOAST,
        });
        return false;
      }
      return true;
    };
    return () => {
      roeSubmitValidateRef.current = null;
    };
  }, [
    roeSubmitValidateRef,
    form.values.estimates,
    defaultBranchCurrency,
    defaultBranchCurrencyId,
    currencyData,
  ]);

  const currencyOptions = currencyData
    .map((c) => {
      const id = c?.id != null ? String(c.id) : "";
      const name = String(c?.currency_code ?? c?.code ?? "").trim();
      if (!id || !name) return null;
      return { value: id, label: name };
    })
    .filter(Boolean) as Array<{ value: string; label: string }>;

  const clearEstimateError = (index: number, field: string) => {
    setEstimateErrors((prev) => {
      if (!prev[index]?.[field]) return prev;
      const next = { ...prev };
      const row = { ...next[index] };
      delete row[field];
      if (Object.keys(row).length === 0) delete next[index];
      else next[index] = row;
      return next;
    });
  };

  const unitOptions = (unitDataRaw ?? [])
    .map((u) => {
      const id = u?.id != null ? String(u.id) : "";
      const name = String(u?.unit_name ?? "").trim();
      if (!id || !name) return null;
      return { value: id, label: name };
    })
    .filter(Boolean) as Array<{ value: string; label: string }>;

  const jobUnitOptions = buildJobUnitOptions(unitDataRaw ?? []);

  const computedEstimatesTotal = useMemo(
    () => calcEstimatesTotalCost(form.values.estimates),
    [form.values.estimates],
  );

  const displayEstimatesTotal =
    computedEstimatesTotal ??
    parseSummaryAmount(summaryEstimatesTotalCost);

  // Resolve unit_id from unit_code when master loads; only auto-fill no_of_unit when empty.
  useEffect(() => {
    if (!jobUnitDefaults?.service || !jobUnitOptions.length) return;
    const estimates = form.values.estimates ?? [];
    if (!estimates.length) return;

    const bookingCargo = toBookingCargoForNoOfUnits(
      jobUnitDefaults.jobCargoDetails ?? [],
    );
    const updated = mapJobChargesWithUnits(
      estimates,
      jobUnitDefaults.service,
      bookingCargo,
      jobUnitOptions,
      {
        containerDetails: jobUnitDefaults.containerDetails,
        jobCargoDetails: jobUnitDefaults.jobCargoDetails,
      },
    );
    if (updated) {
      form.setFieldValue("estimates", updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    jobUnitOptions,
    jobUnitDefaults?.service,
    jobUnitDefaults?.containerDetails,
  ]);

  useEffect(() => {
    if (!debugTag) return;
    const estimates = form.values.estimates ?? [];
    const missingByRow = estimates.map((r) => {
      const missing: string[] = [];
      if (r.charge_id == null) missing.push("charge_id");
      if (!r.charge_name) missing.push("charge_name");
      if (!normalizePpCc(r.pp_cc)) missing.push("pp_cc");
      if (!r.unit_id) missing.push("unit_id");
      if (!r.currency_id) missing.push("currency_id");
      return missing;
    });

    console.log(`🧾 [${debugTag}] EstimatesSection received form.values`, {
      estimatesCount: estimates.length,
      estimates,
      missingByRow,
      unitOptionsCount: unitOptions.length,
      currencyOptionsCount: currencyOptions.length,
    });
  }, [
    debugTag,
    form.values.estimates,
    unitOptions.length,
    currencyOptions.length,
  ]);

  return (
    <Box>
      <Grid
        mb="xs"
        style={{ fontWeight: 600, color: "#105476" }}
        gutter="sm"
      >
        <Grid.Col span={1.75}>
          <RequiredLabel label="Charge" required={true} />
        </Grid.Col>
        <Grid.Col span={1.25}>
          <RequiredLabel label="Prepaid / Collect" required={true} />
        </Grid.Col>
        <Grid.Col span={1.25}>
          <RequiredLabel label="Unit" required={true} />
        </Grid.Col>
        <Grid.Col span={1}>
          <RequiredLabel label="No of Unit" required={true} />
        </Grid.Col>
        <Grid.Col span={1.25}>
          <RequiredLabel label="Currency" required={true} />
        </Grid.Col>
        <Grid.Col span={0.9}>
          <RequiredLabel label="ROE" required={true} />
        </Grid.Col>
        <Grid.Col span={1}>
          <RequiredLabel label="Cost / Unit" required={true} />
        </Grid.Col>
        <Grid.Col span={1}>
          <RequiredLabel label="Total Cost" required={true} />
        </Grid.Col>
        <Grid.Col span={1.75}>
          <RequiredLabel label="Supplier" required={false} />
        </Grid.Col>
        <Grid.Col span={0.85}>
          <RequiredLabel label="Actions" required={false} />
        </Grid.Col>
      </Grid>

      {form.values.estimates.map((row, index) => (
        <Grid key={index} gutter="sm" mb="xs" align="flex-start">
          <Grid.Col span={1.75}>
            <SearchableSelect
              placeholder="Type charge"
              apiEndpoint={chargeEndpoint}
              searchFields={["charge_name", "charge_code"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.id ?? ""),
                label: String(item.charge_name ?? ""),
              })}
              value={row.charge_id != null ? String(row.charge_id) : null}
              displayValue={row.charge_name || undefined}
              onChange={(value, selectedData) => {
                form.setFieldValue(
                  `estimates.${index}.charge_id`,
                  value ? Number(value) : null,
                );
                form.setFieldValue(
                  `estimates.${index}.charge_name`,
                  selectedData?.label || "",
                );
              }}
              disabled={readOnly}
              minSearchLength={2}
              dropdownZIndex={1000}
              styles={{
                input: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  height: "36px",
                },
              }}
            />
          </Grid.Col>

          <Grid.Col span={1.25}>
            <Dropdown
              placeholder="Select"
              searchable
              data={[
                { value: "Prepaid", label: "Prepaid" },
                { value: "Collect", label: "Collect" },
              ]}
              value={normalizePpCc(row.pp_cc) || null}
              onChange={(value) =>
                form.setFieldValue(`estimates.${index}.pp_cc`, value || "")
              }
              disabled={readOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.25}>
            <Dropdown
              placeholder="Unit"
              searchable
              data={unitOptions}
              value={selectStringId(row.unit_id)}
              onChange={(value) => {
                const unitId = value ?? "";
                const currentUnitId = selectStringId(row.unit_id) ?? "";
                if (unitId === currentUnitId) return;

                if (jobUnitDefaults?.service && jobUnitOptions.length) {
                  const bookingCargo = toBookingCargoForNoOfUnits(
                    jobUnitDefaults.jobCargoDetails ?? [],
                  );
                  const updated = applyJobChargeUnitChange(
                    {
                      unit_id: row.unit_id,
                      unit_code: row.unit_code,
                      no_of_unit: row.no_of_unit,
                    },
                    unitId,
                    jobUnitOptions,
                    jobUnitDefaults.service,
                    bookingCargo,
                    {
                      containerDetails: jobUnitDefaults.containerDetails,
                      jobCargoDetails: jobUnitDefaults.jobCargoDetails,
                    },
                  );
                  form.setFieldValue(
                    `estimates.${index}.unit_id`,
                    updated.unit_id ?? "",
                  );
                  form.setFieldValue(
                    `estimates.${index}.unit_code`,
                    updated.unit_code ?? "",
                  );
                  form.setFieldValue(
                    `estimates.${index}.no_of_unit`,
                    updated.no_of_unit,
                  );
                  const total = calcTotalCost(
                    updated.no_of_unit,
                    row.roe,
                    row.cost_per_unit,
                  );
                  form.setFieldValue(`estimates.${index}.total_cost`, total);
                  return;
                }

                const unitItem = (unitDataRaw ?? []).find(
                  (u) => String(u.id ?? "") === unitId,
                );
                const unitCode = String(unitItem?.unit_code ?? "").trim();
                form.setFieldValue(`estimates.${index}.unit_id`, unitId);
                form.setFieldValue(`estimates.${index}.unit_code`, unitCode);
              }}
              disabled={readOnly}
            />
          </Grid.Col>

          <Grid.Col span={1}>
            <FormNumberInput
              placeholder="Qty"
              min={0}
              decimalScale={0}
              hideControls
              value={row.no_of_unit ?? undefined}
              onChange={(value) => {
                const v = typeof value === "number" ? value : toNumberOrNull(value);
                form.setFieldValue(`estimates.${index}.no_of_unit`, v);
                const total = calcTotalCost(v, row.roe, row.cost_per_unit);
                form.setFieldValue(`estimates.${index}.total_cost`, total);
              }}
              disabled={readOnly}
            />
          </Grid.Col>

          <Grid.Col span={1.25}>
            <Dropdown
              placeholder="Currency"
              searchable
              data={currencyOptions}
              value={selectStringId(row.currency_id)}
              onChange={(value) => {
                const currencyId = value ?? "";
                const currItem = (currencyDataRaw ?? []).find(
                  (c) => String(c.id ?? "") === currencyId,
                );
                const code = String(
                  currItem?.currency_code ?? currItem?.code ?? "",
                ).trim();
                form.setFieldValue(`estimates.${index}.currency_id`, currencyId);
                form.setFieldValue(`estimates.${index}.currency_code`, code);
                clearEstimateError(index, "roe");
                if (isBaseCurrency(code)) {
                  form.setFieldValue(`estimates.${index}.roe`, 1);
                  const total = calcTotalCost(row.no_of_unit, 1, row.cost_per_unit);
                  form.setFieldValue(`estimates.${index}.total_cost`, total);
                } else {
                  void ensureRoeForCurrency(code).then((roe) => {
                    form.setFieldValue(`estimates.${index}.roe`, roe);
                    const total = calcTotalCost(
                      row.no_of_unit,
                      roe,
                      row.cost_per_unit,
                    );
                    form.setFieldValue(`estimates.${index}.total_cost`, total);
                  });
                }
              }}
              disabled={readOnly}
            />
          </Grid.Col>

          <Grid.Col span={0.9}>
            <FormNumberInput
              placeholder="ROE"
              min={0}
              hideControls
              decimalScale={ROE_DECIMAL_PLACES}
              value={row.roe ?? undefined}
              readOnly={
                readOnly ||
                isChargeBaseCurrencyFor(
                  {
                    currency_code: row.currency_code,
                    currency_id: row.currency_id,
                  },
                  currencyData,
                )
              }
              onChange={(value) => {
                if (
                  isChargeBaseCurrencyFor(
                    {
                      currency_code: row.currency_code,
                      currency_id: row.currency_id,
                    },
                    currencyData,
                  )
                ) {
                  form.setFieldValue(`estimates.${index}.roe`, 1);
                  return;
                }
                const v = typeof value === "number" ? value : toNumberOrNull(value);
                form.setFieldValue(`estimates.${index}.roe`, v);
                const roeError = validateRoeField(
                  row.currency_code,
                  v,
                  row.currency_id,
                );
                if (roeError) {
                  setEstimateErrors((prev) => ({
                    ...prev,
                    [index]: { ...(prev[index] ?? {}), roe: roeError },
                  }));
                } else {
                  clearEstimateError(index, "roe");
                }
                const total = calcTotalCost(row.no_of_unit, v, row.cost_per_unit);
                form.setFieldValue(`estimates.${index}.total_cost`, total);
              }}
              error={estimateErrors[index]?.roe}
              disabled={readOnly}
            />
          </Grid.Col>

          <Grid.Col span={1}>
            <FormNumberInput
              placeholder="Cost"
              min={0}
              hideControls
              value={row.cost_per_unit ?? undefined}
              onChange={(value) => {
                const v = typeof value === "number" ? value : toNumberOrNull(value);
                form.setFieldValue(`estimates.${index}.cost_per_unit`, v);
                const total = calcTotalCost(row.no_of_unit, row.roe, v);
                form.setFieldValue(`estimates.${index}.total_cost`, total);
              }}
              disabled={readOnly}
            />
          </Grid.Col>

          <Grid.Col span={1}>
            <FormNumberInput
              placeholder="Total"
              min={0}
              hideControls
              decimalScale={2}
              value={row.total_cost ?? undefined}
              onChange={(value) => {
                const v = typeof value === "number" ? value : toNumberOrNull(value);
                form.setFieldValue(`estimates.${index}.total_cost`, v);
              }}
              disabled={readOnly}
              readOnly
            />
          </Grid.Col>

          <Grid.Col span={1.75}>
            <SearchableSelect
              placeholder="Type supplier"
              apiEndpoint={supplierEndpoint}
              searchFields={["customer_name", "customer_code"]}
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.customer_code ?? ""),
                label: String(item.customer_name ?? ""),
              })}
              value={row.supplier_code || null}
              displayValue={row.supplier_name || undefined}
              onChange={(value, selectedData) => {
                form.setFieldValue(`estimates.${index}.supplier_code`, value || "");
                form.setFieldValue(
                  `estimates.${index}.supplier_name`,
                  selectedData?.label || "",
                );
              }}
              disabled={readOnly}
              minSearchLength={2}
              dropdownZIndex={1000}
              styles={{
                input: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  height: "36px",
                },
              }}
            />
          </Grid.Col>

          <Grid.Col span={0.85}>
            {!readOnly && (
              <Group gap="xs">
                {index === form.values.estimates.length - 1 && (
                  <ActionIcon
                    variant="light"
                    color="#105476"
                    onClick={() =>
                      form.insertListItem("estimates", createDefaultEstimateRow())
                    }
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                )}
                {form.values.estimates.length > 1 && (
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => {
                      if (form.values.estimates.length <= 1) {
                        form.setValues({ estimates: [createDefaultEstimateRow()] });
                        return;
                      }
                      form.removeListItem("estimates", index);
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            )}
          </Grid.Col>
        </Grid>
      ))}

      <Grid
        mt="sm"
        gutter="sm"
        align="flex-start"
        style={{ fontWeight: 600, color: "#105476" }}
      >
        <Grid.Col span={1.75} />
        <Grid.Col span={1.25} />
        <Grid.Col span={1.25} />
        <Grid.Col span={1} />
        <Grid.Col span={1.25} />
        <Grid.Col span={0.9} />
        <Grid.Col span={1}>
          <Text size="sm" fw={600} c="#105476" ta="right">
            Total:
          </Text>
        </Grid.Col>
        <Grid.Col span={1}>
          <Text size="sm" fw={600} ta="center" w="100%">
            {formatJobSummaryAmount(displayEstimatesTotal, branches)}
          </Text>
        </Grid.Col>
        <Grid.Col span={1.75} />
        <Grid.Col span={0.85} />
      </Grid>
    </Box>
  );
}

// Convenience helper for pages creating the form
export function useEstimatesForm(
  initial?: Partial<EstimatesFormValues>,
): UseFormReturnType<EstimatesFormValues> {
  const user = useAuthStore((state) => state.user);
  const { branchCurrencyId, branchCurrencyCode } = getDefaultBranchCurrencyFromUser(
    user?.branches as BranchCurrencyLike[] | undefined,
  );

  return useForm<EstimatesFormValues>({
    initialValues: {
      estimates:
        initial?.estimates && initial.estimates.length > 0
          ? initial.estimates
          : [
              createEmptyEstimateRow({
                currencyId: branchCurrencyId,
                currencyCode: branchCurrencyCode,
              }),
            ],
    },
  });
}

