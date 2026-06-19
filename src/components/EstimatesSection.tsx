import { useEffect } from "react";
import { ActionIcon, Box, Grid, Group } from "@mantine/core";
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
import {
  applyJobChargeUnitChange,
  buildJobUnitOptions,
  mapJobChargesWithUnits,
  toBookingCargoForNoOfUnits,
  type JobChargeNoOfUnitContext,
} from "../utils/houseCargoChargeableWeight";

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

export function createEmptyEstimateRow(): EstimateRow {
  return {
    supplier_code: "",
    supplier_name: "",
    charge_id: null,
    charge_name: "",
    pp_cc: "",
    unit_id: "",
    unit_code: "",
    no_of_unit: null,
    currency_id: "",
    currency_code: "",
    roe: null,
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
  const rate = toNumberOrNull(roe) ?? 1; // Default ROE to 1 if not set
  const cpu = toNumberOrNull(cost_per_unit);
  if (qty == null || cpu == null) return null;
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
  /** When set, auto-fills no_of_unit on unit selection (job create/edit). */
  jobUnitDefaults?: {
    service: string;
  } & JobChargeNoOfUnitContext;
};

export function EstimatesSection({
  form,
  serviceType,
  readOnly = false,
  supplierEndpoint = URL.supplierByType,
  chargeEndpoint = URL.chargeMaster,
  debugTag,
  jobUnitDefaults,
}: EstimatesSectionProps) {
  const user = useAuthStore((state) => state.user);
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

  const currencyOptions = (currencyDataRaw ?? [])
    .map((c) => {
      const id = c?.id != null ? String(c.id) : "";
      const name = String(c?.code ?? "").trim();
      if (!id || !name) return null;
      return { value: id, label: name };
    })
    .filter(Boolean) as Array<{ value: string; label: string }>;

  const unitOptions = (unitDataRaw ?? [])
    .map((u) => {
      const id = u?.id != null ? String(u.id) : "";
      const name = String(u?.unit_name ?? "").trim();
      if (!id || !name) return null;
      return { value: id, label: name };
    })
    .filter(Boolean) as Array<{ value: string; label: string }>;

  const jobUnitOptions = buildJobUnitOptions(unitDataRaw ?? []);

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

  const getRoeValue = (currencyCode: string): number => {
    const userCountryCode = user?.country?.country_code;
    const currencyUpper = String(currencyCode ?? "").toUpperCase();

    if (userCountryCode === "IN") {
      if (currencyUpper === "INR") return 1;
      if (currencyUpper === "USD") return 88.75;
    } else if (userCountryCode === "AE") {
      if (currencyUpper === "AED") return 1;
      if (currencyUpper === "USD") return 3.67;
    }
    return 1;
  };

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
        <Grid key={index} gutter="sm" mb="xs" align="flex-end">
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
                if (code) {
                  form.setFieldValue(`estimates.${index}.roe`, getRoeValue(code));
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
              value={row.roe ?? undefined}
              onChange={(value) => {
                const v = typeof value === "number" ? value : toNumberOrNull(value);
                form.setFieldValue(`estimates.${index}.roe`, v);
                const total = calcTotalCost(row.no_of_unit, v, row.cost_per_unit);
                form.setFieldValue(`estimates.${index}.total_cost`, total);
              }}
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
                      form.insertListItem("estimates", createEmptyEstimateRow())
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
                        form.setValues({ estimates: [createEmptyEstimateRow()] });
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

    </Box>
  );
}

// Convenience helper for pages creating the form
export function useEstimatesForm(
  initial?: Partial<EstimatesFormValues>,
): UseFormReturnType<EstimatesFormValues> {
  return useForm<EstimatesFormValues>({
    initialValues: {
      estimates:
        initial?.estimates && initial.estimates.length > 0
          ? initial.estimates
          : [createEmptyEstimateRow()],
    },
  });
}

