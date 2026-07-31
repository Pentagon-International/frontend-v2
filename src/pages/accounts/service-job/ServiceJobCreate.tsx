import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
} from "@mantine/core";
import { useForm, type UseFormReturnType } from "@mantine/form";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileAnalytics,
  IconFileInvoice,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
import { mergeEditPageAuditSources } from "../../../utils/editPageAuditInfo";
import {
  Dropdown,
  SearchableSelect,
  ToastNotification,
  DateTimeInput,
  SingleDateInput,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import FormNumberInput from "../../../components/FormNumberInput";
import RequiredLabel from "../../../components/RequiredLabel";
import { ChargesLocalAmountTotalsRow } from "../../../components/JobChargeSummaryDisplay";
import { JobInvoiceDeleteConfirmModal } from "../../../components/JobInvoiceDeleteConfirmModal";
import { JobInvoiceDeleteMenuItem } from "../../../components/JobInvoiceDeleteMenuItem";
import { JobReverseInvoiceAccountMenu } from "../../../components/JobReverseInvoiceAccountMenu";
import {
  JobMasterPartyDetailsPanel,
  type JobMasterPartyDetailsValues,
  type PartyAddressOption,
} from "../../Transportation/JobMasterPartyDetailsPanel";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useExchangeRateRoe } from "../../../hooks/useExchangeRateRoe";
import { useJobAccountInvoices } from "../../../hooks/useJobAccountInvoices";
import useAuthStore from "../../../store/authStore";
import {
  ROE_DECIMAL_PLACES,
  roundRoeForPayload,
} from "../../../utils/exchangeRateRoe";
import {
  bindMoneyWholeNumberMode,
  clampMoneyAmountBound,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
  roundMoneyToDecimals,
} from "../../../utils/nonDecimalMoneyAmount";
import { roundToDecimals } from "../../../utils/numberInputUtils";
import { buildJobUnitOptions } from "../../../utils/houseCargoChargeableWeight";
import {
  formatInvoiceDocumentNo,
  getInvoiceDocumentNo,
} from "../../../utils/invoiceDocumentNumber";
import { getInvoiceStatusBadgeColor } from "../../../utils/invoiceStatus";
import dayjs from "dayjs";
import {
  formatLocalDateTime,
  parseLocalDateTime,
} from "../../../utils/localDateTime";

const JOB_DETAILS_TAB = 0;
const PARTY_DETAILS_TAB = 1;
const CHARGES_TAB = 2;
const ACCOUNTS_TAB = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ServiceMasterRow = {
  id: number;
  service_code?: string;
  service_name: string;
  transport_mode: string;
  import_export?: string;
  status?: string;
};

type ServiceJobChargeDetail = {
  id?: number | null;
  charge_id: number | null;
  charge_name: string;
  pp_cc: string;
  unit_id: string;
  unit_code?: string;
  no_of_unit: number | null;
  currency_id: string;
  currency: string;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null;
  local_amount?: number | null;
  cost_per_unit?: number | null;
  total_cost?: number | null;
  cost_local_amount?: number | null;
  supplier_code?: string;
  supplier_name?: string;
};

type SalespersonData = { sales_person?: string };
type SalespersonsResponse = { data?: SalespersonData[] };

type ServiceJobFormValues = {
  service_id: string;
  pp_cc: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  routed: string;
  routed_by: string;
  awb_number: string;
  etd: Date | null;
  eta: Date | null;
};

const EMPTY_PARTY_DETAILS: JobMasterPartyDetailsValues = {
  shipper_id: "",
  shipper_name: "",
  shipper_email: "",
  shipper_address_id: "",
  shipper_address: "",
  consignee_id: "",
  consignee_name: "",
  consignee_email: "",
  consignee_address_id: "",
  consignee_address: "",
  carrier_agent_id: "",
  carrier_agent_name: "",
  carrier_agent_email: "",
  carrier_agent_address_id: "",
  carrier_agent_address: "",
};

type ReverseInvoiceItem = {
  id?: number;
  reverse_invoice_id?: number;
  reverse_document_no?: string;
  document_no?: string;
  document_date?: string;
  total?: string | number;
  status?: string;
  day_book_name?: string;
};

type InvoiceListItem = {
  id: number;
  invoice_id?: number;
  day_book_name?: string;
  document_no?: string;
  document_date?: string;
  status?: string;
  total?: string | number;
  reverse_invoices?: ReverseInvoiceItem[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAirTransportMode(transportMode: string): boolean {
  const mode = (transportMode || "").trim().toUpperCase();
  return mode === "AIR" || mode === "NA";
}

function getUnitServiceType(transportMode: string): string {
  return isAirTransportMode(transportMode) ? "AIR" : "SEA";
}

function getPortTransportParams(
  transportMode: string,
): { transport_mode: string } | undefined {
  const mode = (transportMode || "").trim();
  if (!mode) return undefined;
  return { transport_mode: isAirTransportMode(mode) ? "AIR" : "SEA" };
}

function getInvoiceServiceType(transportMode: string): string {
  return isAirTransportMode(transportMode) ? "AIR" : "SEA";
}

/** Normalize job Freight (pp_cc); defaults to Collect. */
function resolveFreightPpCc(...candidates: unknown[]): string {
  for (const value of candidates) {
    const raw = String(value ?? "").trim();
    if (!raw) continue;
    const upper = raw.toUpperCase();
    if (upper === "PP" || upper === "PREPAID") return "Prepaid";
    if (upper === "CC" || upper === "COLLECT") return "Collect";
    if (raw === "Prepaid" || raw === "Collect") return raw;
  }
  return "Collect";
}

/** Export services → Prepaid; Import services → Collect. */
function getDefaultPpCcFromService(importExport?: string): "Prepaid" | "Collect" {
  const raw = String(importExport ?? "")
    .trim()
    .toUpperCase();
  if (raw.includes("EXPORT")) return "Prepaid";
  if (raw.includes("IMPORT")) return "Collect";
  return "Collect";
}

function getMasterAwbField(
  transportMode: string,
): "mawb_no" | "mbl_number" {
  return isAirTransportMode(transportMode) ? "mawb_no" : "mbl_number";
}

function getHouseAwbField(
  transportMode: string,
): "hawb_no" | "hbl_number" {
  return isAirTransportMode(transportMode) ? "hawb_no" : "hbl_number";
}

function readMasterAwbFromJob(
  job: Record<string, unknown>,
  transportMode: string,
): string {
  if (isAirTransportMode(transportMode)) {
    return String(job.mawb_no ?? job.mawb_number ?? "");
  }
  return String(job.mbl_number ?? "");
}

function readHouseAwbFromHouse(
  house: Record<string, unknown>,
  transportMode: string,
): string {
  if (isAirTransportMode(transportMode)) {
    return String(
      house.hawb_no ?? house.hawb_number ?? house.hbl_number ?? "",
    );
  }
  return String(house.hbl_number ?? "");
}

function readChargesFromHouse(
  house: Record<string, unknown>,
  transportMode: string,
): unknown[] {
  const air = isAirTransportMode(transportMode);
  const src = air
    ? house.mawb_charges ?? house.charges
    : house.mbl_charges ?? house.charges;
  return Array.isArray(src) ? src : [];
}

function getHousingChargesPayloadKey(
  transportMode: string,
): "mawb_charges" | "mbl_charges" {
  return isAirTransportMode(transportMode) ? "mawb_charges" : "mbl_charges";
}

function parseJobDateField(value: unknown): Date | null {
  return parseLocalDateTime(value as string | Date | null | undefined);
}

function formatJobDateForPayload(
  value: Date | null,
  transportMode: string,
): string | null {
  if (!value || !dayjs(value).isValid()) return null;
  if (!isAirTransportMode(transportMode)) {
    return dayjs(value).format("YYYY-MM-DD");
  }
  return formatLocalDateTime(value);
}

function mapChargesForPayload(
  charges: ServiceJobChargeDetail[],
  mode: "create" | "edit",
) {
  return charges.map((charge) => ({
    ...(mode === "edit" && charge.id != null && { id: Number(charge.id) }),
    charge_id: charge.charge_id ?? null,
    supplier_code:
      charge.supplier_code != null ? String(charge.supplier_code) : null,
    pp_cc: charge.pp_cc || "",
    unit_id: charge.unit_id ? String(charge.unit_id) : "",
    no_of_unit: roundToDecimals(charge.no_of_unit) ?? null,
    currency_id: charge.currency_id ? String(charge.currency_id) : "",
    roe: roundRoeForPayload(charge.roe) ?? null,
    amount_per_unit: roundMoneyToDecimals(charge.amount_per_unit) ?? null,
    amount: roundMoneyToDecimals(charge.amount) ?? null,
    sell_local_amount:
      roundMoneyToDecimals(charge.local_amount) ??
      roundMoneyToDecimals(charge.amount) ??
      null,
    unit_cost: roundMoneyToDecimals(charge.cost_per_unit) ?? null,
    total_cost: roundMoneyToDecimals(charge.total_cost) ?? null,
    cost_local_amount: roundMoneyToDecimals(charge.cost_local_amount) ?? null,
  }));
}

function mapChargeFromApi(
  charge: Record<string, unknown>,
): ServiceJobChargeDetail {
  const unitDetails = charge.unit_details as
    | { unit_id?: number; unit_code?: string }
    | undefined;
  const currencyDetails = charge.currency_details as
    | { currency_id?: number; currency_code?: string }
    | undefined;
  const toNum = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };
  const chargeId =
    charge.charge_id != null
      ? Number(charge.charge_id)
      : charge.id != null
        ? Number(charge.id)
        : null;

  return {
    id: charge.id != null ? Number(charge.id) : undefined,
    charge_id: chargeId,
    charge_name: charge.charge_name ? String(charge.charge_name) : "",
    supplier_code: charge.supplier_code ? String(charge.supplier_code) : "",
    supplier_name: charge.supplier_name ? String(charge.supplier_name) : "",
    pp_cc: String(charge.pp_cc ?? "Collect"),
    unit_id:
      charge.unit_id != null
        ? String(charge.unit_id)
        : unitDetails?.unit_id != null
          ? String(unitDetails.unit_id)
          : "",
    unit_code: String(charge.unit_code ?? unitDetails?.unit_code ?? ""),
    no_of_unit: toNum(charge.no_of_unit),
    currency_id:
      charge.currency_id != null
        ? String(charge.currency_id)
        : currencyDetails?.currency_id != null
          ? String(currencyDetails.currency_id)
          : "",
    currency: String(
      currencyDetails?.currency_code ?? charge.currency_code ?? "",
    ),
    roe: toNum(charge.roe),
    amount_per_unit: toNum(charge.amount_per_unit),
    amount: toNum(charge.amount),
    local_amount: toNum(charge.sell_local_amount ?? charge.local_amount),
    cost_per_unit: toNum(charge.unit_cost ?? charge.cost_per_unit),
    total_cost: toNum(charge.total_cost),
    cost_local_amount: toNum(charge.cost_local_amount),
  };
}

function createEmptyCharge(
  defaults: {
    currency_id: string;
    currency: string;
    roe: number | null;
  },
  ppCc: "Prepaid" | "Collect" = "Collect",
): ServiceJobChargeDetail {
  return {
    charge_id: null,
    charge_name: "",
    pp_cc: ppCc,
    unit_id: "",
    no_of_unit: null,
    currency_id: defaults.currency_id,
    currency: defaults.currency,
    roe: defaults.roe,
    amount_per_unit: null,
    amount: null,
    local_amount: null,
    cost_per_unit: null,
    total_cost: null,
    cost_local_amount: null,
    supplier_code: "",
    supplier_name: "",
  };
}

const PORT_DISPLAY_FORMAT = (item: Record<string, unknown>) => ({
  value: String(item.port_code ?? ""),
  label: `${item.port_name} (${item.port_code})`,
});

const CHARGE_DISPLAY_FORMAT = (item: Record<string, unknown>) => ({
  value: String(item.id ?? ""),
  label: String(item.charge_name ?? ""),
});

const SUPPLIER_DISPLAY_FORMAT = (item: Record<string, unknown>) => ({
  value: String(item.customer_code ?? ""),
  label: String(item.customer_name ?? ""),
});

const AGENT_DISPLAY_FORMAT = (item: Record<string, unknown>) => ({
  value: String(item.customer_name ?? ""),
  label: String(item.customer_name ?? ""),
});

async function fetchSalespersons() {
  return postAPICall(URL.salespersons, { customer_id: "" }, API_HEADER);
}

async function fetchCurrencyMaster() {
  try {
    return await getAPICall(`${URL.currencyMaster}`, API_HEADER);
  } catch {
    return [];
  }
}

async function fetchUnitMaster(serviceType: string) {
  try {
    const response = (await postAPICall(
      URL.unitMasterFilter,
      { filters: { service_type: serviceType } },
      API_HEADER,
    )) as { data?: unknown[] };
    return response?.data || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Port field section
// ---------------------------------------------------------------------------

type ServiceJobPortFieldProps = {
  label: string;
  portCode: string;
  portName: string;
  disabled: boolean;
  portKey: string;
  additionalParams?: { transport_mode: string };
  onPortChange: (code: string, name: string) => void;
};

const ServiceJobPortField = memo(function ServiceJobPortField({
  label,
  portCode,
  portName,
  disabled,
  portKey,
  additionalParams,
  onPortChange,
}: ServiceJobPortFieldProps) {
  const displayValue = useMemo(() => {
    if (portName && portCode) return `${portName} (${portCode})`;
    return portCode || undefined;
  }, [portCode, portName]);

  const handleChange = useCallback(
    (
      value: string | null,
      selectedData?: { value: string; label: string } | null,
    ) => {
      const code = value || "";
      if (selectedData) {
        onPortChange(code, selectedData.label.split(" (")[0] || "");
        return;
      }
      onPortChange(code, "");
    },
    [onPortChange],
  );

  return (
    <SearchableSelect
      key={portKey}
      label={label}
      placeholder={
        disabled ? "Select service first" : `Type ${label.toLowerCase()} code or name`
      }
      apiEndpoint={URL.portMaster}
      searchFields={["port_code", "port_name"]}
      displayFormat={PORT_DISPLAY_FORMAT}
      value={portCode || null}
      displayValue={displayValue}
      disabled={disabled}
      additionalParams={additionalParams}
      minSearchLength={2}
      dropdownZIndex={10}
      onChange={handleChange}
    />
  );
});

// ---------------------------------------------------------------------------
// Charges section
// ---------------------------------------------------------------------------

function ServiceJobChargesSection({
  form,
  transportMode,
  defaultPpCc = "Collect",
  readOnly = false,
  showCreateInvoice = false,
  onCreateInvoice,
  showCreateSupplierInvoice = false,
  onCreateSupplierInvoice,
  showCreatePrq = false,
  onCreatePrq,
}: {
  form: UseFormReturnType<{ charges: ServiceJobChargeDetail[] }>;
  transportMode: string;
  defaultPpCc?: "Prepaid" | "Collect";
  readOnly?: boolean;
  showCreateInvoice?: boolean;
  onCreateInvoice?: () => void;
  showCreateSupplierInvoice?: boolean;
  onCreateSupplierInvoice?: () => void;
  showCreatePrq?: boolean;
  onCreatePrq?: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(isVietnamBranch);
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});
  const {
    isChargeBaseCurrencyFor,
    ensureRoeForCurrency,
    validateRoeField,
    resolveCurrencyCode,
    getBranchCurrencyDefaults,
  } = useExchangeRateRoe();
  const branchCurrencyDefaults = getBranchCurrencyDefaults();
  const unitServiceType = getUnitServiceType(transportMode);

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster", unitServiceType],
    queryFn: () => fetchUnitMaster(unitServiceType),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const currencyOptions = useMemo(() => {
    if (!Array.isArray(currencyData)) return [];
    return (currencyData as Array<Record<string, unknown>>).map((item) => {
      const code = String(item.currency_code ?? item.code ?? "");
      const id = item.id != null ? String(item.id) : "";
      return { value: id || code, label: code || id || "" };
    });
  }, [currencyData]);

  const unitOptions = useMemo(
    () => buildJobUnitOptions(unitDataRaw),
    [unitDataRaw],
  );

  const chargeAmountPerUnits = form.values.charges
    .map((c) => c.amount_per_unit)
    .join(",");
  const chargeNoOfUnits = form.values.charges.map((c) => c.no_of_unit).join(",");
  const chargeRoes = form.values.charges.map((c) => c.roe).join(",");
  const chargeAmounts = form.values.charges.map((c) => c.amount).join(",");
  const chargeTotalCosts = form.values.charges
    .map((c) => c.total_cost)
    .join(",");

  useEffect(() => {
    if (readOnly) return;
    const updatedCharges = form.values.charges.map((charge) => {
      const next = { ...charge };
      if (
        charge.amount_per_unit != null &&
        charge.amount_per_unit > 0 &&
        charge.no_of_unit != null &&
        charge.no_of_unit > 0
      ) {
        const calculatedAmount =
          clampMoneyAmountBound(
            charge.no_of_unit * charge.amount_per_unit,
          ) ?? 0;
        if (calculatedAmount > 0) next.amount = calculatedAmount;
      }
      if (next.amount != null && next.amount > 0 && next.roe != null && next.roe > 0) {
        next.local_amount = next.amount * next.roe;
      } else {
        next.local_amount = null;
      }
      if (
        next.total_cost != null &&
        next.total_cost > 0 &&
        next.roe != null &&
        next.roe > 0
      ) {
        next.cost_local_amount = next.total_cost * next.roe;
      } else {
        next.cost_local_amount = null;
      }
      return next;
    });
    const hasChanges = updatedCharges.some((charge, index) => {
      const original = form.values.charges[index];
      return (
        charge.amount !== original?.amount ||
        charge.local_amount !== original?.local_amount ||
        charge.cost_local_amount !== original?.cost_local_amount
      );
    });
    if (hasChanges) form.setValues({ charges: updatedCharges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmountPerUnits, chargeNoOfUnits, chargeRoes, chargeAmounts, chargeTotalCosts, readOnly]);

  const clearChargeError = (index: number, field: string) => {
    setChargeErrors((prev) => {
      if (!prev[index]?.[field]) return prev;
      const next = { ...prev };
      const row = { ...next[index] };
      delete row[field];
      if (Object.keys(row).length === 0) delete next[index];
      else next[index] = row;
      return next;
    });
  };

  return (
    <Box mt="md">
      <Group justify="space-between" mb="md">
        <Text size="md" fw={600} c="#105476">
          Charges
        </Text>
        <Group gap="sm">
          {showCreatePrq && onCreatePrq && (
            <Button
              variant="outline"
              color="#105476"
              size="sm"
              onClick={onCreatePrq}
            >
              Create PRQ
            </Button>
          )}
          {showCreateSupplierInvoice && onCreateSupplierInvoice && (
            <Button
              variant="outline"
              color="#105476"
              size="sm"
              onClick={onCreateSupplierInvoice}
            >
              Create Supplier Invoice
            </Button>
          )}
          {showCreateInvoice && onCreateInvoice && (
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconFileInvoice size={16} />}
              onClick={onCreateInvoice}
            >
              Create Invoice
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                form.insertListItem(
                  "charges",
                  createEmptyCharge(branchCurrencyDefaults, defaultPpCc),
                );
              }}
            >
              Add Charge
            </Button>
          )}
        </Group>
      </Group>

      <Grid mb={2} gutter="sm" style={{ fontWeight: 700 }}>
        <Grid.Col span={1.4} />
        <Grid.Col span={0.9} />
        <Grid.Col span={0.8} />
        <Grid.Col span={0.8} />
        <Grid.Col span={0.7} />
        <Grid.Col span={0.7} />
        <Grid.Col span={2.55}>
          <Box style={{ border: "1.5px solid #228be6", borderRadius: 6, textAlign: "center", padding: "2px 0", color: "#228be6", fontSize: 12, fontWeight: 700 }}>
            SELL
          </Box>
        </Grid.Col>
        <Grid.Col span={3.65}>
          <Box style={{ border: "1.5px solid #e67700", borderRadius: 6, textAlign: "center", padding: "2px 0", color: "#e67700", fontSize: 12, fontWeight: 700 }}>
            COST
          </Box>
        </Grid.Col>
        <Grid.Col span={0.5} />
      </Grid>

      <Grid mb="xs" style={{ fontWeight: 600, color: "#105476" }} gutter="sm">
        <Grid.Col span={1.4}><RequiredLabel label="Charge Name" required={false} /></Grid.Col>
        <Grid.Col span={0.9}><RequiredLabel label="Prepaid / Collect" required={false} /></Grid.Col>
        <Grid.Col span={0.8}><RequiredLabel label="Unit" required={false} /></Grid.Col>
        <Grid.Col span={0.8}><RequiredLabel label="Currency" required={false} /></Grid.Col>
        <Grid.Col span={0.7}><RequiredLabel label="ROE" required={false} /></Grid.Col>
        <Grid.Col span={0.7}><RequiredLabel label="No of Unit" required={false} /></Grid.Col>
        <Grid.Col span={0.85}><RequiredLabel label="Amount/Unit" required={false} /></Grid.Col>
        <Grid.Col span={0.85}><RequiredLabel label="Amount" required={false} /></Grid.Col>
        <Grid.Col span={0.85}><RequiredLabel label="Local Amount" required={false} /></Grid.Col>
        <Grid.Col span={0.85}><RequiredLabel label="Cost/Unit" required={false} /></Grid.Col>
        <Grid.Col span={0.85}><RequiredLabel label="Total Cost" required={false} /></Grid.Col>
        <Grid.Col span={0.85}><RequiredLabel label="Local Amount" required={false} /></Grid.Col>
        <Grid.Col span={1.1}><RequiredLabel label="Supplier" required={false} /></Grid.Col>
        <Grid.Col span={0.5}><RequiredLabel label="Actions" required={false} /></Grid.Col>
      </Grid>

      {form.values.charges.map((charge, index) => (
        <Grid key={index} gutter="sm" mb="xs">
          <Grid.Col span={1.4}>
            <SearchableSelect
              placeholder="Type charge name"
              apiEndpoint={URL.chargeMaster}
              searchFields={["charge_name", "charge_code"]}
              displayFormat={CHARGE_DISPLAY_FORMAT}
              value={charge.charge_id != null ? String(charge.charge_id) : null}
              displayValue={charge.charge_name || undefined}
              readOnly={readOnly}
              onChange={(value, selectedData) => {
                form.setFieldValue(`charges.${index}.charge_id`, value ? Number(value) : null);
                form.setFieldValue(`charges.${index}.charge_name`, selectedData?.label ?? "");
                clearChargeError(index, "charge_name");
              }}
              error={chargeErrors[index]?.charge_name}
              minSearchLength={2}
              dropdownZIndex={1000}
            />
          </Grid.Col>
          <Grid.Col span={0.9}>
            <Dropdown
              placeholder="Select Prepaid/Collect"
              searchable
              data={[
                { value: "Prepaid", label: "Prepaid" },
                { value: "Collect", label: "Collect" },
              ]}
              value={charge.pp_cc || null}
              disabled={readOnly}
              onChange={(value) => {
                form.setFieldValue(`charges.${index}.pp_cc`, value || "");
                clearChargeError(index, "pp_cc");
              }}
              error={chargeErrors[index]?.pp_cc}
            />
          </Grid.Col>
          <Grid.Col span={0.8}>
            <Dropdown
              placeholder="Select Unit"
              searchable
              data={unitOptions}
              value={charge.unit_id || null}
              disabled={readOnly}
              onChange={(value) => {
                const unitId = value ?? "";
                form.setFieldValue(`charges.${index}.unit_id`, unitId);
                form.setFieldValue(
                  `charges.${index}.unit_code`,
                  unitOptions.find((o) => o.value === unitId)?.label ?? "",
                );
              }}
            />
          </Grid.Col>
          <Grid.Col span={0.8}>
            <Dropdown
              placeholder="Select Currency"
              searchable
              data={currencyOptions}
              value={charge.currency_id || null}
              disabled={readOnly}
              onChange={(value) => {
                const currencyId = value ?? "";
                const code = currencyOptions.find((o) => o.value === currencyId)?.label ?? "";
                form.setFieldValue(`charges.${index}.currency_id`, currencyId);
                form.setFieldValue(`charges.${index}.currency`, code);
                if (isChargeBaseCurrencyFor(charge, currencyData as never[])) {
                  form.setFieldValue(`charges.${index}.roe`, 1);
                } else {
                  void ensureRoeForCurrency(code).then((roe) => {
                    form.setFieldValue(`charges.${index}.roe`, roe);
                  });
                }
                clearChargeError(index, "currency_id");
              }}
              error={chargeErrors[index]?.currency_id}
            />
          </Grid.Col>
          <Grid.Col span={0.7}>
            <FormNumberInput
              placeholder="ROE"
              min={0}
              hideControls
              decimalScale={ROE_DECIMAL_PLACES}
              readOnly={readOnly || isChargeBaseCurrencyFor(charge, currencyData as never[])}
              value={charge.roe || undefined}
              onChange={(value) => {
                const roe = value as number | null;
                form.setFieldValue(`charges.${index}.roe`, roe);
                const roeError = validateRoeField(
                  resolveCurrencyCode(charge, currencyData as never[]),
                  roe,
                  charge.currency_id,
                );
                if (roeError) {
                  setChargeErrors((prev) => ({
                    ...prev,
                    [index]: { ...(prev[index] ?? {}), roe: roeError },
                  }));
                } else {
                  clearChargeError(index, "roe");
                }
              }}
              error={chargeErrors[index]?.roe}
            />
          </Grid.Col>
          <Grid.Col span={0.7}>
            <FormNumberInput
              placeholder="No of Unit"
              min={0}
              hideControls
              readOnly={readOnly}
              value={charge.no_of_unit || undefined}
              onChange={(value) => {
                const noOfUnit = value as number | null;
                form.setFieldValue(`charges.${index}.no_of_unit`, noOfUnit);
                const current = form.values.charges[index];
                if (current.amount_per_unit != null && current.amount_per_unit > 0 && noOfUnit != null && noOfUnit > 0) {
                  form.setFieldValue(`charges.${index}.amount`, noOfUnit * current.amount_per_unit);
                }
                if (current.cost_per_unit != null && current.cost_per_unit > 0 && noOfUnit != null && noOfUnit > 0) {
                  form.setFieldValue(`charges.${index}.total_cost`, noOfUnit * current.cost_per_unit);
                }
              }}
            />
          </Grid.Col>
          <Grid.Col span={0.85}>
            <FormNumberInput
              placeholder="Amount/Unit"
              min={0}
              hideControls
              decimalScale={amountDecimalScale}
              readOnly={readOnly}
              value={charge.amount_per_unit || undefined}
              onChange={(value) => {
                const amountPerUnit = value as number | null;
                form.setFieldValue(`charges.${index}.amount_per_unit`, amountPerUnit);
                const current = form.values.charges[index];
                if (amountPerUnit != null && amountPerUnit > 0 && current.no_of_unit != null && current.no_of_unit > 0) {
                  form.setFieldValue(`charges.${index}.amount`, current.no_of_unit * amountPerUnit);
                }
              }}
            />
          </Grid.Col>
          <Grid.Col span={0.85}>
            <FormNumberInput
              placeholder="Amount"
              min={0}
              hideControls
              decimalScale={amountDecimalScale}
              readOnly={readOnly}
              value={charge.amount || undefined}
              onChange={(value) => {
                form.setFieldValue(`charges.${index}.amount`, value as number | null);
              }}
            />
          </Grid.Col>
          <Grid.Col span={0.85}>
            <FormNumberInput
              placeholder="Local Amount"
              min={0}
              hideControls
              decimalScale={amountDecimalScale}
              readOnly={readOnly}
              value={charge.local_amount || undefined}
              onChange={(value) => {
                form.setFieldValue(`charges.${index}.local_amount`, value as number | null);
              }}
            />
          </Grid.Col>
          <Grid.Col span={0.85}>
            <FormNumberInput
              placeholder="Cost/Unit"
              min={0}
              hideControls
              decimalScale={amountDecimalScale}
              readOnly={readOnly}
              value={charge.cost_per_unit || undefined}
              onChange={(value) => {
                const costPerUnit = value as number | null;
                form.setFieldValue(`charges.${index}.cost_per_unit`, costPerUnit);
                const current = form.values.charges[index];
                if (costPerUnit != null && costPerUnit > 0 && current.no_of_unit != null && current.no_of_unit > 0) {
                  form.setFieldValue(`charges.${index}.total_cost`, current.no_of_unit * costPerUnit);
                }
              }}
            />
          </Grid.Col>
          <Grid.Col span={0.85}>
            <FormNumberInput
              placeholder="Total Cost"
              min={0}
              hideControls
              decimalScale={amountDecimalScale}
              readOnly={readOnly}
              value={charge.total_cost || undefined}
              onChange={(value) => {
                form.setFieldValue(`charges.${index}.total_cost`, value as number | null);
              }}
            />
          </Grid.Col>
          <Grid.Col span={0.85}>
            <FormNumberInput
              placeholder="Local Amount"
              min={0}
              hideControls
              decimalScale={amountDecimalScale}
              readOnly={readOnly}
              value={charge.cost_local_amount || undefined}
              onChange={(value) => {
                form.setFieldValue(`charges.${index}.cost_local_amount`, value as number | null);
              }}
            />
          </Grid.Col>
          <Grid.Col span={1.1}>
            <SearchableSelect
              placeholder="Type supplier"
              apiEndpoint={URL.supplierByType}
              searchFields={["customer_name", "customer_code"]}
              displayFormat={SUPPLIER_DISPLAY_FORMAT}
              value={charge.supplier_code ? String(charge.supplier_code) : null}
              displayValue={charge.supplier_name || undefined}
              readOnly={readOnly}
              onChange={(value, selectedData) => {
                form.setFieldValue(`charges.${index}.supplier_code`, value || "");
                form.setFieldValue(`charges.${index}.supplier_name`, selectedData?.label || "");
              }}
              minSearchLength={2}
              dropdownZIndex={1000}
            />
          </Grid.Col>
          <Grid.Col span={0.5} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {!readOnly && form.values.charges.length > 1 && (
              <ActionIcon variant="light" color="red" onClick={() => form.removeListItem("charges", index)}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Grid.Col>
        </Grid>
      ))}

      <ChargesLocalAmountTotalsRow
        offsetBeforeSellCol={7.1}
        house={{ charges: form.values.charges }}
        branches={user?.branches}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Accounts section
// ---------------------------------------------------------------------------

const serviceJobInvoiceMenuItemStyles = {
  item: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    borderRadius: "6px",
    padding: "10px 12px",
    marginBottom: "4px",
    "&:hover": {
      backgroundColor: "#F8F9FA",
    },
  },
  itemLabel: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
  },
};

function ServiceJobInvoiceMenuIcon({
  backgroundColor,
  children,
}: {
  backgroundColor: string;
  children: ReactNode;
}) {
  return (
    <Box
      style={{
        backgroundColor,
        borderRadius: "6px",
        padding: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Box>
  );
}

function ServiceJobAccountsSection({
  activeTab,
  accountsTabIndex,
  jobData,
  editPath,
}: {
  activeTab: number;
  accountsTabIndex: number;
  jobData: Record<string, unknown> | null;
  editPath: string;
}) {
  const navigate = useNavigate();
  const shipmentNo = jobData?.job_id ? String(jobData.job_id) : null;
  const {
    invoiceList,
    invoiceListLoading,
    invoiceDeletingId,
    expandedInvoiceRowId,
    setExpandedInvoiceRowId,
    requestDeleteInvoice,
    requestDeleteReverseInvoice,
    deleteConfirmProps,
  } = useJobAccountInvoices<InvoiceListItem>({
    activeTab,
    accountsTabIndex,
    shipmentNo,
    isAgent: false,
    enabled: !!jobData?.id,
  });

  return (
    <Box mt="md">
      <Text size="md" fw={600} c="#105476" mb="md">
        Accounts
      </Text>
      {invoiceListLoading ? (
        <Center py="xl"><Loader color="#105476" size="lg" /></Center>
      ) : (
        <ScrollArea>
          <Table withTableBorder withColumnBorders striped highlightOnHover style={{ minWidth: 700 }} styles={{ th: { padding: "8px" }, td: { padding: "8px" } }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Daybook</Table.Th>
                <Table.Th>Document Number</Table.Th>
                <Table.Th>Invoice Date</Table.Th>
                <Table.Th>Invoice Total</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invoiceList.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Center py="xl"><Text c="dimmed">No invoices to display</Text></Center>
                  </Table.Td>
                </Table.Tr>
              ) : (
                invoiceList.map((row, idx) => {
                  const statusUpper = (row.status ?? "").toUpperCase();
                  const isUnposted = statusUpper === "UNPOSTED" || row.status === "unpost";
                  const rowKey = `${row.id}-${idx}`;
                  const isExpanded = expandedInvoiceRowId === rowKey;
                  const reverseInvoices = row.reverse_invoices ?? [];
                  const hasReverseInvoices = reverseInvoices.length > 0;
                  const invoiceViewId = row.invoice_id ?? row.id;
                  return (
                    <Fragment key={rowKey}>
                      <Table.Tr
                        style={hasReverseInvoices ? { cursor: "pointer" } : undefined}
                        onClick={() => {
                          if (!hasReverseInvoices) {
                            setExpandedInvoiceRowId(null);
                            return;
                          }
                          setExpandedInvoiceRowId((prev) => (prev === rowKey ? null : rowKey));
                        }}
                      >
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            {hasReverseInvoices && (isExpanded ? <IconChevronUp size={14} color="#105476" /> : <IconChevronDown size={14} color="#105476" />)}
                            {row.day_book_name ?? "-"}
                          </Group>
                        </Table.Td>
                        <Table.Td>{formatInvoiceDocumentNo(getInvoiceDocumentNo(row)) || row.document_no || "-"}</Table.Td>
                        <Table.Td>{row.document_date ?? "-"}</Table.Td>
                        <Table.Td>{row.total ?? "-"}</Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={getInvoiceStatusBadgeColor(row.status)}>
                            {row.status ?? "-"}
                          </Badge>
                        </Table.Td>
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <Menu
                            shadow="md"
                            width={200}
                            position="bottom-end"
                            styles={{
                              dropdown: {
                                border: "1px solid #E9ECEF",
                                borderRadius: "8px",
                                padding: "8px",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                              },
                            }}
                          >
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="#105476" size="sm">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={
                                  <ServiceJobInvoiceMenuIcon backgroundColor="#E7F5FF">
                                    <IconEye size={16} color="#105476" />
                                  </ServiceJobInvoiceMenuIcon>
                                }
                                styles={serviceJobInvoiceMenuItemStyles}
                                onClick={() =>
                                  navigate(
                                    `/service-job/invoice/view/${invoiceViewId}`,
                                    {
                                      state: {
                                        invoiceData: row,
                                        fromJobLevel: true,
                                        returnTo: editPath,
                                        returnToState: { job: jobData },
                                        ...(jobData && { job: jobData }),
                                      },
                                    },
                                  )
                                }
                              >
                                View
                              </Menu.Item>
                              {isUnposted && (
                                <>
                                  <Menu.Item
                                    leftSection={
                                      <ServiceJobInvoiceMenuIcon backgroundColor="#E7F5FF">
                                        <IconEdit size={16} color="#105476" />
                                      </ServiceJobInvoiceMenuIcon>
                                    }
                                    styles={serviceJobInvoiceMenuItemStyles}
                                    onClick={() =>
                                      navigate(
                                        `/service-job/invoice/edit/${row.invoice_id}`,
                                        {
                                          state: {
                                            invoiceData: row,
                                            fromJobLevel: true,
                                            returnTo: editPath,
                                            returnToState: { job: jobData },
                                            ...(jobData && { job: jobData }),
                                          },
                                        },
                                      )
                                    }
                                  >
                                    Edit
                                  </Menu.Item>
                                  <JobInvoiceDeleteMenuItem
                                    disabled={
                                      invoiceDeletingId === invoiceViewId
                                    }
                                    onDelete={() =>
                                      requestDeleteInvoice(
                                        invoiceViewId as number,
                                      )
                                    }
                                  />
                                </>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                      {isExpanded && reverseInvoices.map((rev, revIdx) => (
                        <Table.Tr key={`${rowKey}-rev-${revIdx}`} bg="gray.0">
                          <Table.Td pl="xl">{rev.day_book_name ?? "Reverse"}</Table.Td>
                          <Table.Td>{rev.reverse_document_no ?? rev.document_no ?? "-"}</Table.Td>
                          <Table.Td>{rev.document_date ?? "-"}</Table.Td>
                          <Table.Td>{rev.total ?? "-"}</Table.Td>
                          <Table.Td><Badge size="sm" variant="light">{rev.status ?? "-"}</Badge></Table.Td>
                          <Table.Td onClick={(e) => e.stopPropagation()}>
                            <JobReverseInvoiceAccountMenu rev={rev} parentRow={row} jobBasePath="/service-job" navigate={navigate} job={jobData} deletingReverseId={invoiceDeletingId} onRequestDeleteReverseInvoice={requestDeleteReverseInvoice} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Fragment>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
      <JobInvoiceDeleteConfirmModal {...deleteConfirmProps} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ServiceJobCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const isEditMode = Boolean(routeId);
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const stateJobFromNav =
    (location.state as { job?: Record<string, unknown> } | null)?.job ?? null;
  const [resolvedJob, setResolvedJob] = useState<Record<string, unknown> | null>(
    null,
  );
  const jobData = resolvedJob ?? stateJobFromNav;

  const { getBranchCurrencyDefaults } = useExchangeRateRoe();
  const branchCurrencyDefaults = getBranchCurrencyDefaults();

  const [activeTab, setActiveTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(
    isEditMode && !stateJobFromNav,
  );
  const [costSheetPreviewOpen, setCostSheetPreviewOpen] = useState(false);
  const [costSheetLoading, setCostSheetLoading] = useState(false);
  const [costSheetPdfUrl, setCostSheetPdfUrl] = useState<string | null>(null);
  const lastHydrationKeyRef = useRef<string | null>(null);
  const forceApiFetchRef = useRef(false);

  useEffect(() => {
    if (lastHydrationKeyRef.current !== null) {
      forceApiFetchRef.current = true;
    }
    lastHydrationKeyRef.current = null;
    setResolvedJob(null);
  }, [routeId, location.key]);
  const [houseMeta, setHouseMeta] = useState<{
    id?: number;
    shipment_id?: string;
  }>({});

  const form = useForm<ServiceJobFormValues>({
    initialValues: {
      service_id: "",
      pp_cc: "Collect",
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      routed: "",
      routed_by: "",
      awb_number: "",
      etd: null,
      eta: null,
    },
  });

  const partyDetailsForm = useForm<JobMasterPartyDetailsValues>({
    initialValues: { ...EMPTY_PARTY_DETAILS },
  });
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    PartyAddressOption[]
  >([]);
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    PartyAddressOption[]
  >([]);
  const [carrierAgentAddressOptions, setCarrierAgentAddressOptions] = useState<
    PartyAddressOption[]
  >([]);
  const [shipperAddressSearch, setShipperAddressSearch] = useState("");
  const [consigneeAddressSearch, setConsigneeAddressSearch] = useState("");
  const [carrierAgentAddressSearch, setCarrierAgentAddressSearch] =
    useState("");
  const [shipperAddressCustom, setShipperAddressCustom] = useState(false);
  const [consigneeAddressCustom, setConsigneeAddressCustom] = useState(false);
  const [carrierAgentAddressCustom, setCarrierAgentAddressCustom] =
    useState(false);

  const chargesForm = useForm<{ charges: ServiceJobChargeDetail[] }>({
    initialValues: {
      charges: [createEmptyCharge(branchCurrencyDefaults)],
    },
  });

  const { data: serviceMasterList = [] } = useQuery({
    queryKey: ["serviceMasterList"],
    queryFn: async () => {
      const response = await getAPICall(URL.serviceMaster, API_HEADER);
      return Array.isArray(response) ? (response as ServiceMasterRow[]) : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const activeServices = useMemo(
    () =>
      serviceMasterList.filter(
        (s) => String(s.status ?? "ACTIVE").toUpperCase() === "ACTIVE",
      ),
    [serviceMasterList],
  );

  const serviceOptions = useMemo(
    () =>
      activeServices.map((s) => ({
        value: String(s.id),
        label: s.service_name,
      })),
    [activeServices],
  );

  const selectedService = useMemo(
    () =>
      activeServices.find((s) => String(s.id) === form.values.service_id) ??
      null,
    [activeServices, form.values.service_id],
  );

  const transportMode = selectedService?.transport_mode ?? "";
  const defaultPpCc = getDefaultPpCcFromService(selectedService?.import_export);
  const isSeaJob =
    Boolean(transportMode) && !isAirTransportMode(transportMode);
  const awbFieldLabel = isSeaJob ? "BL Number" : "AWB Number";
  const awbFieldPlaceholder = isSeaJob
    ? "Enter BL number"
    : "Enter AWB number";

  const portTransportParams = useMemo(
    () => getPortTransportParams(transportMode),
    [transportMode],
  );

  const portsEnabled = Boolean(form.values.service_id && portTransportParams);

  const portSelectKey = useMemo(
    () =>
      `${form.values.service_id}-${portTransportParams?.transport_mode ?? ""}`,
    [form.values.service_id, portTransportParams?.transport_mode],
  );

  const handleOriginPortChange = useCallback(
    (code: string, name: string) => {
      form.setFieldValue("origin_code", code);
      form.setFieldValue("origin_name", name);
    },
    [form],
  );

  const handleDestinationPortChange = useCallback(
    (code: string, name: string) => {
      form.setFieldValue("destination_code", code);
      form.setFieldValue("destination_name", name);
    },
    [form],
  );

  const { data: rawSalespersonsData = [] } = useQuery({
    queryKey: ["salespersons", ""],
    queryFn: fetchSalespersons,
    staleTime: 10 * 60 * 1000,
  });

  const salespersonsData = useMemo(() => {
    const response = rawSalespersonsData as SalespersonsResponse;
    if (!response?.data?.length) return [];
    return response.data.map((item) => ({
      value: item.sales_person ? String(item.sales_person) : "",
      label: item.sales_person ?? "",
    }));
  }, [rawSalespersonsData]);

  const populateFromJob = useCallback(
    (job: Record<string, unknown>) => {
      const serviceId =
        job.service_id != null ? String(job.service_id) : "";
      const svc =
        serviceMasterList.find((s) => String(s.id) === serviceId) ?? null;
      const mode = svc?.transport_mode ?? "";

      const house = Array.isArray(job.housing_details)
        ? (job.housing_details[0] as Record<string, unknown> | undefined)
        : undefined;

      if (house?.id != null) {
        setHouseMeta({
          id: Number(house.id),
          shipment_id: house.shipment_id
            ? String(house.shipment_id)
            : house.shipment_no
              ? String(house.shipment_no)
              : undefined,
        });
      }

      form.setValues({
        service_id: serviceId,
        pp_cc: resolveFreightPpCc(
          job.pp_cc,
          job.freight,
          house?.pp_cc,
          house?.freight,
        ),
        origin_code: String(job.origin_code ?? house?.origin_code ?? ""),
        origin_name: String(job.origin_name ?? house?.origin_name ?? ""),
        destination_code: String(
          job.destination_code ?? house?.destination_code ?? "",
        ),
        destination_name: String(
          job.destination_name ?? house?.destination_name ?? "",
        ),
        routed: String(house?.routed ?? ""),
        routed_by: String(house?.routed_by ?? ""),
        awb_number:
          readMasterAwbFromJob(job, mode) ||
          (house ? readHouseAwbFromHouse(house, mode) : ""),
        etd: parseJobDateField(job.etd ?? house?.etd),
        eta: parseJobDateField(job.eta ?? house?.eta),
      });

      partyDetailsForm.setValues({
        shipper_id: String(
          house?.shipper_id ?? house?.shipper_code ?? "",
        ),
        shipper_name: String(house?.shipper_name ?? ""),
        shipper_email: String(house?.shipper_email ?? ""),
        shipper_address_id: String(house?.shipper_address_id ?? ""),
        shipper_address: String(house?.shipper_address ?? ""),
        consignee_id: String(
          house?.consignee_id ?? house?.consignee_code ?? "",
        ),
        consignee_name: String(house?.consignee_name ?? ""),
        consignee_email: String(house?.consignee_email ?? ""),
        consignee_address_id: String(house?.consignee_address_id ?? ""),
        consignee_address: String(house?.consignee_address ?? ""),
        carrier_agent_id: String(
          house?.carrier_agent_id ?? house?.carrier_agent_code ?? "",
        ),
        carrier_agent_name: String(house?.carrier_agent_name ?? ""),
        carrier_agent_email: String(house?.carrier_agent_email ?? ""),
        carrier_agent_address_id: String(
          house?.carrier_agent_address_id ?? "",
        ),
        carrier_agent_address: String(house?.carrier_agent_address ?? ""),
      });
      setShipperAddressCustom(Boolean(String(house?.shipper_address ?? "").trim()));
      setConsigneeAddressCustom(
        Boolean(String(house?.consignee_address ?? "").trim()),
      );
      setCarrierAgentAddressCustom(
        Boolean(String(house?.carrier_agent_address ?? "").trim()),
      );

      if (house) {
        const chargeRows = readChargesFromHouse(house, mode).map((c) =>
          mapChargeFromApi(c as Record<string, unknown>),
        );
        if (chargeRows.length > 0) {
          chargesForm.setValues({ charges: chargeRows });
        }
      }
    },
    [serviceMasterList, chargesForm, form, partyDetailsForm],
  );

  useEffect(() => {
    if (!isEditMode || serviceMasterList.length === 0 || !routeId) {
      return;
    }

    const hydrationKey = `${routeId}:${location.key}`;
    if (lastHydrationKeyRef.current === hydrationKey) {
      return;
    }

    const stateJob = stateJobFromNav;
    const hasMatchingStateJob =
      stateJob?.id != null && String(stateJob.id) === String(routeId);

    if (!forceApiFetchRef.current && hasMatchingStateJob) {
      populateFromJob(stateJob);
      setResolvedJob(stateJob);
      lastHydrationKeyRef.current = hydrationKey;
      setIsLoadingJob(false);
      return;
    }

    forceApiFetchRef.current = false;
    let cancelled = false;

    const load = async () => {
      setIsLoadingJob(true);
      try {
        const response = await getAPICall(
          `${URL.jobCreate}${routeId}/`,
          API_HEADER,
        );
        const job =
          response && typeof response === "object"
            ? (response as Record<string, unknown>)
            : null;
        if (!job) throw new Error("Job not found");
        if (!cancelled) {
          populateFromJob(job);
          setResolvedJob(job);
          lastHydrationKeyRef.current = hydrationKey;
        }
      } catch (err) {
        ToastNotification({
          type: "error",
          message:
            err instanceof Error ? err.message : "Failed to load service job",
        });
      } finally {
        if (!cancelled) setIsLoadingJob(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    isEditMode,
    routeId,
    location.key,
    stateJobFromNav?.id,
    populateFromJob,
    serviceMasterList.length,
  ]);

  const serviceJobAuditSource = useMemo(
    () => mergeEditPageAuditSources(jobData),
    [jobData],
  );

  useEffect(() => {
    if (
      form.values.routed === "self" &&
      !form.values.routed_by &&
      user?.full_name
    ) {
      form.setFieldValue("routed_by", user.full_name);
    }
    if (form.values.routed !== "self" && form.values.routed !== "agent") {
      form.setFieldValue("routed_by", "");
    }
  }, [form.values.routed, form.values.routed_by, user?.full_name, form]);

  const buildPayload = () => {
    const mode = transportMode;
    const masterAwbField = getMasterAwbField(mode);
    const houseAwbField = getHouseAwbField(mode);
    const chargesKey = getHousingChargesPayloadKey(mode);
    const housePartyBlock = {
      shipper_name: partyDetailsForm.values.shipper_name || "",
      shipper_email: partyDetailsForm.values.shipper_email || "",
      shipper_address: partyDetailsForm.values.shipper_address || "",
      consignee_name: partyDetailsForm.values.consignee_name || "",
      consignee_email: partyDetailsForm.values.consignee_email || "",
      consignee_address: partyDetailsForm.values.consignee_address || "",
      carrier_agent_name: partyDetailsForm.values.carrier_agent_name || "",
      carrier_agent_email: partyDetailsForm.values.carrier_agent_email || "",
      carrier_agent_address:
        partyDetailsForm.values.carrier_agent_address || "",
    };

    const housingDetail: Record<string, unknown> = {
      ...(houseMeta.id != null && { id: houseMeta.id }),
      ...(houseMeta.shipment_id && { shipment_id: houseMeta.shipment_id }),
      pp_cc: form.values.pp_cc || "Collect",
      routed: form.values.routed || null,
      routed_by: form.values.routed_by || null,
      origin_code: form.values.origin_code || null,
      destination_code: form.values.destination_code || null,
      ...housePartyBlock,
      [houseAwbField]: form.values.awb_number || null,
      [chargesKey]: mapChargesForPayload(
        chargesForm.values.charges,
        isEditMode ? "edit" : "create",
      ),
    };

    return {
      is_service_job: true,
      service_id: form.values.service_id
        ? Number(form.values.service_id)
        : null,
      pp_cc: form.values.pp_cc || "Collect",
      origin_code: form.values.origin_code || null,
      destination_code: form.values.destination_code || null,
      etd: formatJobDateForPayload(form.values.etd, mode),
      eta: formatJobDateForPayload(form.values.eta, mode),
      // Master shipper / consignee intentionally empty for service jobs
      shipper_name: "",
      shipper_email: "",
      shipper_address: "",
      consignee_name: "",
      consignee_email: "",
      consignee_address: "",
      [masterAwbField]: form.values.awb_number || null,
      housing_details: [housingDetail],
    };
  };

  const housingDetailForInvoice = useMemo(() => {
    const chargesKey = getHousingChargesPayloadKey(transportMode);
    return {
      ...(houseMeta.id != null && { id: houseMeta.id }),
      ...(houseMeta.shipment_id && {
        shipment_id: houseMeta.shipment_id,
        shipment_no: houseMeta.shipment_id,
      }),
      routed: form.values.routed,
      routed_by: form.values.routed_by,
      origin_code: form.values.origin_code,
      destination_code: form.values.destination_code,
      shipper_name: partyDetailsForm.values.shipper_name,
      shipper_email: partyDetailsForm.values.shipper_email,
      shipper_address: partyDetailsForm.values.shipper_address,
      consignee_name: partyDetailsForm.values.consignee_name,
      consignee_email: partyDetailsForm.values.consignee_email,
      consignee_address: partyDetailsForm.values.consignee_address,
      carrier_agent_name: partyDetailsForm.values.carrier_agent_name,
      carrier_agent_email: partyDetailsForm.values.carrier_agent_email,
      carrier_agent_address: partyDetailsForm.values.carrier_agent_address,
      [getHouseAwbField(transportMode)]: form.values.awb_number,
      charges: chargesForm.values.charges,
      [chargesKey]: chargesForm.values.charges,
    };
  }, [
    chargesForm.values.charges,
    form.values,
    houseMeta,
    partyDetailsForm.values,
    transportMode,
  ]);

  const editPath = routeId ? `/service-job/edit/${routeId}` : "/service-job";

  const maxTabIndex = useMemo(() => {
    if (isEditMode && jobData?.id != null) return ACCOUNTS_TAB;
    return CHARGES_TAB;
  }, [isEditMode, jobData?.id]);

  const handleNextTab = useCallback(() => {
    setActiveTab((current) => (current < maxTabIndex ? current + 1 : current));
  }, [maxTabIndex]);

  const handlePrevTab = useCallback(() => {
    setActiveTab((current) =>
      current > JOB_DETAILS_TAB ? current - 1 : current,
    );
  }, []);

  const handleCreateInvoice = useCallback(() => {
    const collectCharges = (
      (housingDetailForInvoice.charges as Array<{ pp_cc?: string }>) ?? []
    ).filter((c) => String(c.pp_cc ?? "").trim() === "Collect");
    navigate("/service-job/invoice", {
      state: {
        serviceType: getInvoiceServiceType(transportMode),
        hawbDetails: [{ ...housingDetailForInvoice, charges: collectCharges }],
        housingDetails: [
          { ...housingDetailForInvoice, charges: collectCharges },
        ],
        is_agent: false,
        billToFrom: "consignee",
        fromJobLevel: true,
        returnTo: editPath,
        returnToState: { job: jobData },
        ...(jobData && { job: jobData }),
      },
    });
  }, [
    editPath,
    housingDetailForInvoice,
    jobData,
    navigate,
    transportMode,
  ]);

  const handleCreateSupplierInvoice = useCallback(() => {
    const toStr = (v: unknown) => String(v ?? "").trim();
    const jobId = toStr(jobData?.job_id ?? jobData?.id);
    if (!jobId) {
      ToastNotification({
        type: "error",
        message: "Job ID not found for Supplier Invoice prefill.",
      });
      return;
    }

    const charges = (chargesForm.values.charges ?? [])
      .map((e) => ({
        shipment_no: jobId,
        charge_id: e.charge_id ?? null,
        charge_name: e.charge_name ?? "",
        currency_id: e.currency_id || null,
        roe: e.roe ?? null,
        amount: e.total_cost ?? null,
        supplier_code: toStr(e.supplier_code),
        supplier_name: toStr(e.supplier_name),
      }))
      .filter(
        (c) =>
          toStr(c.shipment_no) &&
          c.charge_id != null &&
          c.amount != null &&
          String(c.amount).trim() !== "" &&
          (toStr(c.supplier_code) || toStr(c.supplier_name)),
      );

    if (charges.length === 0) {
      ToastNotification({
        type: "error",
        message:
          "Please select a supplier on the charge(s) to proceed with creating a Supplier Invoice.",
      });
      return;
    }

    navigate("/supplier-invoice/create", {
      state: {
        prefillSupplierInvoiceFromJob: {
          source: "service-job",
          job_id: jobId,
          charges,
        },
      },
    });
  }, [chargesForm.values.charges, jobData, navigate]);

  const handleCreatePrq = useCallback(() => {
    const charges = chargesForm.values.charges ?? [];
    const chargesFromEstimates = charges
      .filter(
        (e) =>
          e.charge_id != null ||
          (e.charge_name && e.charge_name.trim() !== ""),
      )
      .map((e) => ({
        charge_id: e.charge_id,
        charge_name: e.charge_name ?? "",
        segment: "",
        job_no: String(jobData?.job_id ?? jobData?.id ?? ""),
        sub_job: "",
        cn_r: "",
        currency: e.currency ?? "",
        currency_id: e.currency_id ?? "",
        roe: e.roe,
        unit_code: e.unit_code ?? "",
        unit_id: e.unit_id ?? "",
        no_of_unit: e.no_of_unit,
        amount_per_unit: e.cost_per_unit,
        amount: e.total_cost,
        amount_in_local:
          e.cost_local_amount != null
            ? e.cost_local_amount
            : e.total_cost != null && e.roe != null
              ? Math.round(e.total_cost * e.roe * 100) / 100
              : e.total_cost,
        tax_code: "",
        tax: "false",
      }));
    const firstSupplier =
      charges.find(
        (e) =>
          String(e.supplier_code ?? "").trim() !== "" ||
          String(e.supplier_name ?? "").trim() !== "",
      ) ?? null;

    navigate("/payment-request/create", {
      state: {
        serviceType: getInvoiceServiceType(transportMode),
        chargesFromEstimates:
          chargesFromEstimates.length > 0 ? chargesFromEstimates : undefined,
        supplier:
          firstSupplier != null
            ? {
                supplier_code: String(firstSupplier.supplier_code ?? ""),
                supplier_name: String(firstSupplier.supplier_name ?? ""),
              }
            : null,
        job_reference_1:
          jobData?.job_id != null
            ? String(jobData.job_id)
            : jobData?.id != null
              ? String(jobData.id)
              : "",
        ...(jobData && { job: jobData }),
      },
    });
  }, [chargesForm.values.charges, jobData, navigate, transportMode]);

  const handleCloseCostSheetPreview = useCallback(() => {
    setCostSheetPreviewOpen(false);
    setCostSheetLoading(false);
    if (costSheetPdfUrl) {
      window.URL.revokeObjectURL(costSheetPdfUrl);
    }
    setCostSheetPdfUrl(null);
  }, [costSheetPdfUrl]);

  const handleDownloadCostSheetPdf = useCallback(() => {
    if (!costSheetPdfUrl) return;
    const jobId =
      String(jobData?.job_id ?? jobData?.id ?? "job").trim() || "job";
    const link = document.createElement("a");
    link.href = costSheetPdfUrl;
    link.download = `job-cost-sheet-${jobId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [costSheetPdfUrl, jobData?.job_id, jobData?.id]);

  const handleJobCostSheet = useCallback(async () => {
    const jobId = String(jobData?.job_id ?? "").trim();
    if (!jobId) {
      ToastNotification({
        type: "error",
        message: "Job ID is required to generate Job Cost Sheet.",
      });
      return;
    }

    setCostSheetPreviewOpen(true);
    setCostSheetLoading(true);
    if (costSheetPdfUrl) {
      window.URL.revokeObjectURL(costSheetPdfUrl);
      setCostSheetPdfUrl(null);
    }

    try {
      const response = await apiCallProtected.post(
        `${URL.jobLedger}`,
        {
          filters: {
            job_id: jobId,
            type: "pdf",
          },
        },
        { ...API_HEADER, responseType: "blob" },
      );

      const blob =
        response instanceof Blob
          ? response
          : (response as { data?: Blob })?.data instanceof Blob
            ? (response as { data: Blob }).data
            : null;

      if (!blob || blob.size === 0) {
        throw new Error("Empty PDF response from server");
      }

      const head = await blob.slice(0, 256).text();
      const headTrim = head.trimStart();
      if (headTrim.startsWith("{") || headTrim.startsWith("[")) {
        let message = "Failed to generate Job Cost Sheet PDF";
        try {
          const parsed = JSON.parse(await blob.text()) as {
            detail?: string;
            message?: string;
            error?: string;
          };
          message =
            parsed.detail || parsed.message || parsed.error || message;
        } catch {
          /* keep default */
        }
        throw new Error(message);
      }

      setCostSheetPdfUrl(window.URL.createObjectURL(blob));
    } catch (error: unknown) {
      console.error("Job Cost Sheet PDF error:", error);
      ToastNotification({
        type: "error",
        message:
          (error as { message?: string })?.message ||
          "Failed to generate Job Cost Sheet PDF",
      });
      setCostSheetPreviewOpen(false);
      setCostSheetPdfUrl(null);
    } finally {
      setCostSheetLoading(false);
    }
  }, [costSheetPdfUrl, jobData?.job_id]);

  useEffect(() => {
    return () => {
      if (costSheetPdfUrl) {
        window.URL.revokeObjectURL(costSheetPdfUrl);
      }
    };
  }, [costSheetPdfUrl]);

  const handleOpenJobLedger = useCallback(() => {
    const jobId = String(jobData?.job_id ?? "").trim();
    if (!jobId) {
      ToastNotification({
        type: "error",
        message: "Job ID is required to open Job Ledger.",
      });
      return;
    }
    navigate("/job-ledger", {
      state: {
        jobId,
        service_name: selectedService?.service_name || "Service Job",
        jobReturnTo: location.pathname,
        jobReturnToState: location.state,
      },
    });
  }, [
    jobData?.job_id,
    location.pathname,
    location.state,
    navigate,
    selectedService?.service_name,
  ]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      if (isEditMode && jobData?.id) {
        await putAPICall(
          URL.jobCreate,
          { ...payload, id: jobData.id },
          API_HEADER,
        );
      } else {
        await postAPICall(URL.jobCreate, payload, API_HEADER);
      }
      ToastNotification({
        type: "success",
        message: `Service job ${isEditMode ? "updated" : "created"} successfully`,
      });
      navigate("/service-job", { state: { refreshData: true } });
    } catch (err) {
      ToastNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to save service job",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingJob) {
    return (
      <Center style={{ minHeight: "60vh" }}>
        <Loader color="#105476" size="lg" />
      </Center>
    );
  }

  return (
    <Box p="md" mx="auto" style={{display: "flex", flexDirection: "column", height: "100%"}}>
      <Group justify="space-between" mb="md">
        <EditPageHeadingRow
          visible={isEditMode && Boolean(jobData)}
          auditSource={serviceJobAuditSource}
          animateKey={(jobData as { id?: number })?.id}
        >
          <Text size="xl" fw={600} c="#105476">
            {isEditMode ? "Edit Service Job" : "Create Service Job"}
          </Text>
        </EditPageHeadingRow>
        <Group gap="sm">
          {isEditMode && String(jobData?.job_id ?? "").trim() !== "" && (
            <Menu shadow="md" width={240} position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="#105476"
                  size="lg"
                  aria-label="Service job actions"
                  styles={{
                    root: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      border: "1px solid #E9ECEF",
                      borderRadius: "8px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                  }}
                >
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown
                styles={{
                  dropdown: {
                    border: "1px solid #E9ECEF",
                    borderRadius: "8px",
                    padding: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  },
                }}
              >
                <Menu.Item
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconFileInvoice size={16} color="#105476" />
                    </Box>
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                  onClick={handleOpenJobLedger}
                >
                  Job Ledger
                </Menu.Item>
                <Menu.Item
                  leftSection={
                    <Box
                      style={{
                        backgroundColor: "#E7F5FF",
                        borderRadius: "6px",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconFileAnalytics size={16} color="#105476" />
                    </Box>
                  }
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": {
                        backgroundColor: "#F8F9FA",
                      },
                    },
                    itemLabel: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                    },
                  }}
                  onClick={() => void handleJobCostSheet()}
                  disabled={costSheetLoading}
                >
                  Job Cost Sheet
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          <Button
            color="#105476"
            leftSection={<IconCheck size={18} />}
            loading={isSubmitting}
            onClick={handleSubmit}
          >
            {isEditMode ? "Update" : "Create"}
          </Button>
        </Group>
      </Group>

      <Tabs
        value={String(activeTab)}
        onChange={(v) => v != null && setActiveTab(Number(v))}
        color="#105476"
        style={{ flex: 1, paddingBottom: 20 }}
      >
        <Tabs.List
          mb="md"
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            borderBottom: "none",
          }}
        >
          <Tabs.Tab 
            value={String(JOB_DETAILS_TAB)} 
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: activeTab === JOB_DETAILS_TAB ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: activeTab === JOB_DETAILS_TAB ? 600 : 400,
            }}
          >
            Job Details
          </Tabs.Tab>
          <Tabs.Tab
            value={String(PARTY_DETAILS_TAB)}
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom:
                activeTab === PARTY_DETAILS_TAB ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: activeTab === PARTY_DETAILS_TAB ? 600 : 400,
            }}
          >
            Party Details
          </Tabs.Tab>
          <Tabs.Tab 
            value={String(CHARGES_TAB)}
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: activeTab === CHARGES_TAB ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: activeTab === CHARGES_TAB ? 600 : 400,
            }}
          >
            Charges
          </Tabs.Tab>
          {isEditMode && jobData?.id != null && (
            <Tabs.Tab 
              value={String(ACCOUNTS_TAB)}
              style={{
                textAlign: "center",
                padding: "12px",
                backgroundColor: "transparent",
                borderBottom: activeTab === ACCOUNTS_TAB ? "3px solid #105476" : "none",
                color: "#105476",
                fontSize: 16,
                fontWeight: activeTab === ACCOUNTS_TAB ? 600 : 400,
              }}
            >
              Accounts
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value={String(JOB_DETAILS_TAB)}>
          <Box mt="md">
            <Grid>
              <Grid.Col span={4}>
                <Dropdown
                  label="Service"
                  placeholder="Select service"
                  searchable
                  data={serviceOptions}
                  value={form.values.service_id || null}
                  onChange={(value) => {
                    form.setFieldValue("service_id", value || "");
                    form.setFieldValue("origin_code", "");
                    form.setFieldValue("origin_name", "");
                    form.setFieldValue("destination_code", "");
                    form.setFieldValue("destination_name", "");
                    const svc =
                      activeServices.find((s) => String(s.id) === (value || "")) ??
                      null;
                    const nextPpCc = getDefaultPpCcFromService(svc?.import_export);
                    // Only retarget blank charge rows so user-edited values stay intact
                    const nextCharges = chargesForm.values.charges.map((c) => {
                      const isBlankRow =
                        !c.charge_id &&
                        !String(c.charge_name ?? "").trim() &&
                        !String(c.supplier_code ?? "").trim();
                      return isBlankRow ? { ...c, pp_cc: nextPpCc } : c;
                    });
                    chargesForm.setValues({ charges: nextCharges });
                  }}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <ServiceJobPortField
                  label="Origin"
                  portCode={form.values.origin_code}
                  portName={form.values.origin_name}
                  disabled={!portsEnabled}
                  portKey={`origin-${portSelectKey}`}
                  additionalParams={portTransportParams}
                  onPortChange={handleOriginPortChange}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <ServiceJobPortField
                  label="Destination"
                  portCode={form.values.destination_code}
                  portName={form.values.destination_name}
                  disabled={!portsEnabled}
                  portKey={`destination-${portSelectKey}`}
                  additionalParams={portTransportParams}
                  onPortChange={handleDestinationPortChange}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  label="Freight"
                  placeholder="Select Freight"
                  searchable
                  data={[
                    { value: "Prepaid", label: "Prepaid" },
                    { value: "Collect", label: "Collect" },
                  ]}
                  value={form.values.pp_cc || null}
                  onChange={(value) => {
                    form.setFieldValue("pp_cc", value || "Collect");
                  }}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  label="Routed"
                  placeholder="Select routed"
                  searchable
                  data={[
                    { value: "self", label: "Self" },
                    { value: "agent", label: "Agent" },
                  ]}
                  value={form.values.routed || null}
                  onChange={(value) =>
                    form.setFieldValue("routed", value || "")
                  }
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {form.values.routed === "self" ? (
                  salespersonsData.length > 0 ? (
                    <Dropdown
                      label="Routed By"
                      placeholder="Select salesperson"
                      searchable
                      data={salespersonsData}
                      value={form.values.routed_by || null}
                      onChange={(value) =>
                        form.setFieldValue("routed_by", value || "")
                      }
                    />
                  ) : (
                    <FormTextInput
                      label="Routed By"
                      placeholder="Enter routed by"
                      {...form.getInputProps("routed_by")}
                    />
                  )
                ) : form.values.routed === "agent" ? (
                  <SearchableSelect
                    label="Routed By"
                    placeholder="Type agent name"
                    apiEndpoint={URL.agent}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={AGENT_DISPLAY_FORMAT}
                    value={form.values.routed_by || null}
                    displayValue={form.values.routed_by || undefined}
                    onChange={(value) =>
                      form.setFieldValue("routed_by", value || "")
                    }
                    minSearchLength={2}
                  />
                ) : (
                  <FormTextInput
                    label="Routed By"
                    placeholder="Enter routed by"
                    {...form.getInputProps("routed_by")}
                  />
                )}
              </Grid.Col>

              <Grid.Col span={4}>
                <FormTextInput
                  label={awbFieldLabel}
                  placeholder={awbFieldPlaceholder}
                  {...form.getInputProps("awb_number")}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {isSeaJob ? (
                  <SingleDateInput
                    label="ETD"
                    placeholder="YYYY-MM-DD"
                    value={form.values.etd}
                    onChange={(value: Date | null) => {
                      form.setFieldValue("etd", value);
                    }}
                    error={form.errors.etd as string | undefined}
                    size="sm"
                  />
                ) : (
                  <DateTimeInput
                    label="ETD"
                    placeholder="YYYY-MM-DD"
                    value={form.values.etd}
                    onChange={(value: Date | null) => {
                      form.setFieldValue("etd", value);
                    }}
                    error={form.errors.etd as string | undefined}
                    size="sm"
                  />
                )}
              </Grid.Col>

              <Grid.Col span={4}>
                {isSeaJob ? (
                  <SingleDateInput
                    label="ETA"
                    placeholder="YYYY-MM-DD"
                    value={form.values.eta}
                    onChange={(value: Date | null) => {
                      form.setFieldValue("eta", value);
                    }}
                    error={form.errors.eta as string | undefined}
                    size="sm"
                  />
                ) : (
                  <DateTimeInput
                    label="ETA"
                    placeholder="YYYY-MM-DD"
                    value={form.values.eta}
                    onChange={(value: Date | null) => {
                      form.setFieldValue("eta", value);
                    }}
                    error={form.errors.eta as string | undefined}
                    size="sm"
                  />
                )}
              </Grid.Col>
            </Grid>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value={String(PARTY_DETAILS_TAB)}>
          <Box mt="md">
            <JobMasterPartyDetailsPanel
              idPrefix="service-job-party"
              partyDetailsForm={partyDetailsForm}
              shipperAddressOptions={shipperAddressOptions}
              setShipperAddressOptions={setShipperAddressOptions}
              consigneeAddressOptions={consigneeAddressOptions}
              setConsigneeAddressOptions={setConsigneeAddressOptions}
              carrierAgentAddressOptions={carrierAgentAddressOptions}
              setCarrierAgentAddressOptions={setCarrierAgentAddressOptions}
              shipperAddressSearch={shipperAddressSearch}
              setShipperAddressSearch={setShipperAddressSearch}
              consigneeAddressSearch={consigneeAddressSearch}
              setConsigneeAddressSearch={setConsigneeAddressSearch}
              carrierAgentAddressSearch={carrierAgentAddressSearch}
              setCarrierAgentAddressSearch={setCarrierAgentAddressSearch}
              shipperAddressCustom={shipperAddressCustom}
              setShipperAddressCustom={setShipperAddressCustom}
              consigneeAddressCustom={consigneeAddressCustom}
              setConsigneeAddressCustom={setConsigneeAddressCustom}
              carrierAgentAddressCustom={carrierAgentAddressCustom}
              setCarrierAgentAddressCustom={setCarrierAgentAddressCustom}
            />
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value={String(CHARGES_TAB)}>
          <ServiceJobChargesSection
            form={chargesForm}
            transportMode={transportMode}
            defaultPpCc={defaultPpCc}
            showCreateInvoice={isEditMode && jobData?.id != null}
            onCreateInvoice={handleCreateInvoice}
            showCreateSupplierInvoice={isEditMode && jobData?.id != null}
            onCreateSupplierInvoice={handleCreateSupplierInvoice}
            showCreatePrq={isEditMode && jobData?.id != null}
            onCreatePrq={handleCreatePrq}
          />
        </Tabs.Panel>

        {isEditMode && jobData?.id != null && (
          <Tabs.Panel value={String(ACCOUNTS_TAB)}>
            <ServiceJobAccountsSection
              activeTab={activeTab}
              accountsTabIndex={ACCOUNTS_TAB}
              jobData={jobData}
              editPath={editPath}
            />
          </Tabs.Panel>
        )}
      </Tabs>

      <Box
        component="footer"
        style={{
          marginTop: "24px",
          zIndex: 200,
          borderTop: "1px solid #dcdcdc",
          padding: "12px 24px 12px 0",
        }}
      >
        <Group justify="space-between" maw="100%" mx="auto" w="100%">
          <Group gap="md">
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate("/service-job")}
            >
              Back to List
            </Button>
            <Button
              variant="outline"
              color="#105476"
              disabled={activeTab === JOB_DETAILS_TAB}
              leftSection={<IconArrowLeft size={16} />}
              onClick={handlePrevTab}
            >
              Back
            </Button>
          </Group>
          <Box>
              <Button
                color="#105476"
                disabled={activeTab === maxTabIndex}
                rightSection={<IconChevronRight size={16} />}
                onClick={handleNextTab}
              >
                Next
              </Button>
          </Box>
        </Group>
      </Box>

      <Modal
        opened={costSheetPreviewOpen}
        onClose={handleCloseCostSheetPreview}
        title={
          <Text size="lg" fw={600} c="#105476">
            Job Cost Sheet
          </Text>
        }
        centered
        size="95%"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            minHeight: "90vh",
            maxWidth: "1200px",
          },
          body: {
            padding: 0,
            height: "100%",
          },
        }}
      >
        <Stack h="82vh">
          {costSheetLoading ? (
            <Center style={{ flex: 1 }}>
              <Loader color="#105476" size="lg" />
            </Center>
          ) : costSheetPdfUrl ? (
            <>
              <iframe
                src={costSheetPdfUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="Job Cost Sheet PDF Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  color="#105476"
                  leftSection={<IconDownload size={16} />}
                  onClick={handleDownloadCostSheetPdf}
                >
                  Download
                </Button>
                <Button color="#105476" onClick={handleCloseCostSheetPreview}>
                  Close
                </Button>
              </Group>
            </>
          ) : (
            <Center style={{ flex: 1 }}>
              <Text c="dimmed">No PDF available</Text>
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}
