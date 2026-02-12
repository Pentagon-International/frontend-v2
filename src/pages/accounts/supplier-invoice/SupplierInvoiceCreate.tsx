import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  Dropdown,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import useAuthStore from "../../../store/authStore";

const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    return response;
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

const fetchStateMaster = async () => {
  try {
    const response = await getAPICall(`${URL.state}`, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? response ?? [];
  } catch (error) {
    console.error("Error fetching state master:", error);
    return [];
  }
};

const fetchDaybook = async () => {
  try {
    const payload = { filters: { document_type: "CRJ" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook:", error);
    return [];
  }
};

const fetchChargeMaster = async () => {
  try {
    const response = await postAPICall(
      URL.chargeMasterFilter,
      { filters: {} },
      API_HEADER,
    );
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching charge master:", error);
    return [];
  }
};

const fetchChartOfAccounts = async () => {
  try {
    const response = await postAPICall(
      URL.chartOfAccountsFilter,
      { filters: {} },
      API_HEADER,
    );
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    return [];
  }
};

// GET job-create dropdown list (shipment_id, service_id for get-effective-sac)
const fetchJobCreate = async () => {
  try {
    const response = await getAPICall(URL.filterJobCreate, API_HEADER);
    return (
      (response as { data?: { shipment_id?: string; service_id?: number }[] })
        ?.data ?? []
    );
  } catch (error) {
    console.error("Error fetching job-create:", error);
    return [];
  }
};

// Fetch effective SAC for charge + service: POST { items: [{ charge_id, service_id }] }
const fetchGetEffectiveSac = async (
  items: { charge_id: number; service_id: number }[],
) => {
  try {
    const response = await postAPICall(
      URL.gstChargeMappingGetEffectiveSac,
      { items },
      API_HEADER,
    );
    return (
      (
        response as {
          data?: Array<{
            charge_id: number;
            service_id: number;
            sac_code?: string | null;
            sac_name?: string | null;
            error?: string;
          }>;
        }
      )?.data ?? []
    );
  } catch (error) {
    console.error("Error fetching get-effective-sac:", error);
    return [];
  }
};

const CRN_OPTIONS = [
  { value: "Cost", label: "Cost" },
  { value: "Revenue", label: "Revenue" },
  { value: "Neutral", label: "Neutral" },
];

type ChargeRow = {
  id?: number;
  account_code: string;
  subledger_code: string;
  CRN: string;
  narration: string;
  shipment_no: string;
  charge_id: number | null;
  currency_id: number | null;
  roe: number | null;
  amount: number | null;
  amount_in_local: number | null;
  tax_code: string;
  Dr_Cr: "Cr" | "Dr";
};

type SupplierInvoiceFormValues = {
  cbp_number: string;
  cost_center: string;
  day_book_id: string;
  crj_number: string;
  date: Date | null;
  due_date: Date | null;
  creditor_agent: string;
  agent_code: string;
  state_id: string;
  tds_section_code: string;
  note: string;
  narration: string;
  customer_gst_no: string;
  location_gst_no: string;
  Inv_Crn_note: string;
  Inv_Crn_no: string;
  currency_id: string;
  taxable_amount: number | null;
  non_taxable_amount: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  Inv_crn_amount: number | null;
  approved_amount: number | null;
  difference_amount: number | null;
  status: string;
  Dr_Cr: "Cr" | "Dr"; // Sent in payload; no UI field (default "Dr")
  charges_data: ChargeRow[];
};

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function clampAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value))
    return value === undefined ? null : value;
  const rounded = Math.round(value * 1000) / 1000;
  const maxVal = 999999999.999;
  if (Math.abs(rounded) > maxVal) return rounded > 0 ? maxVal : -maxVal;
  return rounded;
}

function formatDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

type ApiCharge = {
  id?: number;
  account_code?: string;
  subledger_code?: string;
  CRN?: string;
  narration?: string;
  shipment_no?: string;
  charge_id?: number;
  currency_id?: number;
  roe?: number | string;
  amount?: number | string;
  amount_in_local?: number | string;
  tax_code?: string;
  Dr_Cr?: string;
};
function mapApiChargesToRows(charges: ApiCharge[]): ChargeRow[] {
  if (!Array.isArray(charges)) return [];
  return charges.map((c) => ({
    id: c.id,
    account_code: c.account_code ?? "",
    subledger_code: c.subledger_code ?? "",
    CRN: c.CRN ?? "",
    narration: c.narration ?? "",
    shipment_no: c.shipment_no ?? "",
    charge_id: c.charge_id ?? null,
    currency_id: c.currency_id ?? null,
    roe: typeof c.roe === "string" ? parseFloat(c.roe) || null : (c.roe ?? null),
    amount: typeof c.amount === "string" ? parseFloat(c.amount) || null : (c.amount ?? null),
    amount_in_local: typeof c.amount_in_local === "string" ? parseFloat(c.amount_in_local) || null : (c.amount_in_local ?? null),
    tax_code: c.tax_code ?? "",
    Dr_Cr: (c.Dr_Cr === "Dr" || c.Dr_Cr === "Cr" ? c.Dr_Cr : "Dr") as "Dr" | "Cr",
  }));
}

const inputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
  },
  label: {
    fontSize: "13px",
    fontFamily: "Inter",
    marginBottom: "4px",
  },
};

const readOnlyFieldStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
    backgroundColor: "#f5f5f5",
    cursor: "default",
  },
  label: inputStyles.label,
};

type SupplierInvoiceCreateProps = {
  isReversal?: boolean;
  titleOverride?: string;
  backPath?: string;
};

export default function SupplierInvoiceCreate({
  isReversal = false,
  titleOverride,
  backPath = "/supplier-invoice",
}: SupplierInvoiceCreateProps = {}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Reversal mode: header Dr_Cr = "Cr", charges Dr_Cr = "Dr" (enforced on mount)
  useEffect(() => {
    if (isReversal) {
      form.setFieldValue("Dr_Cr", "Cr");
      form.values.charges_data.forEach((_, i) => {
        form.setFieldValue(`charges_data.${i}.Dr_Cr`, "Dr");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReversal]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    crj_number?: string;
    Inv_Crn_no?: string;
    status?: string;
  } | null>(null);

  const defaultBranch = user?.branches?.find(
    (b: { is_default?: boolean }) => b.is_default === true,
  ) as
    | { currency?: { currency_id?: number; currency_code?: string } }
    | undefined;
  const defaultBranchCurrencyId =
    defaultBranch?.currency?.currency_id != null
      ? String(defaultBranch.currency.currency_id)
      : "";

  const getRoeValue = useCallback(
    (currencyCode: string): number => {
      const code = (user?.country?.country_code ?? "").toUpperCase();
      const curr = (currencyCode ?? "").toUpperCase();
      if (code === "IN") {
        if (curr === "INR") return 1;
        if (curr === "USD") return 88.75;
      } else if (code === "AE") {
        if (curr === "AED") return 1;
        if (curr === "USD") return 3.67;
      }
      return 1;
    },
    [user?.country?.country_code],
  );

  const form = useForm<SupplierInvoiceFormValues>({
    initialValues: {
      cbp_number: "",
      cost_center: "",
      day_book_id: "",
      crj_number: "",
      date: new Date(),
      due_date: new Date(),
      creditor_agent: "",
      agent_code: "",
      state_id: "",
      tds_section_code: "",
      note: "",
      narration: "",
      customer_gst_no: "",
      location_gst_no: "",
      Inv_Crn_note: "",
      Inv_Crn_no: "",
      currency_id: defaultBranchCurrencyId || "",
      taxable_amount: null,
      non_taxable_amount: null,
      cgst_amount: null,
      sgst_amount: null,
      igst_amount: null,
      Inv_crn_amount: null,
      approved_amount: null,
      difference_amount: null,
      status: "UNPOSTED",
      Dr_Cr: "Dr", // Header Dr_Cr: sent in payload only (no UI field)
      charges_data: [
        {
          account_code: "",
          subledger_code: "",
          CRN: "",
          narration: "",
          shipment_no: "",
          charge_id: null,
          currency_id: null,
          roe: null,
          amount: null,
          amount_in_local: null,
          tax_code: "",
          Dr_Cr: "Dr",
        },
      ],
    },
    validate: {
      day_book_id: (v) => (!v ? "Day book is required" : null),
      date: (v) => (!v ? "Date is required" : null),
      due_date: (v) => (!v ? "Due date is required" : null),
      currency_id: (v) => (!v ? "Currency is required" : null),
      state_id: (v) => (!v ? "State is required" : null),
    },
  });

  const { data: currencyData = [], isLoading: isCurrencyLoading } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  const { data: stateData = [], isLoading: isStateLoading } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });

  const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
    queryKey: ["daybook", "INV"],
    queryFn: fetchDaybook,
    staleTime: Infinity,
  });

  const { data: chargeData = [], isLoading: isChargeLoading } = useQuery({
    queryKey: ["chargeMaster"],
    queryFn: fetchChargeMaster,
    staleTime: Infinity,
  });

  const currencyOptions = useMemo(() => {
    const data = currencyData as {
      id?: number;
      currency_code?: string;
      code?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => ({
        value: String(item.id ?? ""),
        label:
          (item.currency_code ?? item.code ?? "").toString().trim() ||
          String(item.id ?? ""),
      }))
      .filter((o) => o.value);
  }, [currencyData]);

  const stateOptions = useMemo(() => {
    const data = stateData as {
      id?: number;
      state_name?: string;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.state_name ?? item.name ?? "",
    }));
  }, [stateData]);

  const daybookOptions = useMemo(() => {
    const data = daybookData as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookData]);

  const chargeOptions = useMemo(() => {
    const data = chargeData as {
      id?: number;
      charge_name?: string;
      charge_code?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.charge_name ?? item.charge_code ?? "",
    }));
  }, [chargeData]);

  const { data: chartOfAccountsData = [] } = useQuery({
    queryKey: ["chartOfAccounts"],
    queryFn: fetchChartOfAccounts,
    staleTime: Infinity,
  });

  const accountOptions = useMemo(() => {
    const data = chartOfAccountsData as {
      gl_account_code?: string;
      account_name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => ({
        value: String(item.gl_account_code ?? ""),
        label: item.account_name ?? item.gl_account_code ?? "",
      }))
      .filter((o) => o.value);
  }, [chartOfAccountsData]);

  const { data: jobCreateData = [] } = useQuery({
    queryKey: ["jobCreate"],
    queryFn: fetchJobCreate,
    staleTime: 60_000,
  });

  const jobList = jobCreateData as {
    shipment_id?: string;
    service_id?: number;
  }[];
  const shipmentOptions = useMemo(() => {
    if (!Array.isArray(jobList)) return [];
    return jobList
      .filter((item) => item.shipment_id != null && item.shipment_id !== "")
      .map((item) => ({
        value: String(item.shipment_id),
        label: String(item.shipment_id),
      }));
  }, [jobList]);

  const getServiceIdByShipmentId = useCallback(
    (shipmentId: string | null | undefined): number | null => {
      if (!shipmentId || !Array.isArray(jobList)) return null;
      const item = jobList.find((j) => j.shipment_id === shipmentId);
      return item?.service_id != null ? item.service_id : null;
    },
    [jobList],
  );

  const fetchSacForChargeRow = useCallback(
    (index: number, chargeId: number | null, shipmentNo: string) => {
      if (chargeId == null || !shipmentNo) return;
      const serviceId = getServiceIdByShipmentId(shipmentNo);
      if (serviceId == null) return;
      fetchGetEffectiveSac([
        { charge_id: chargeId, service_id: serviceId },
      ]).then((data) => {
        const item = data.find((x) => x.charge_id === chargeId);
        if (item?.sac_code != null && item.sac_code !== "") {
          form.setFieldValue(`charges_data.${index}.tax_code`, item.sac_code);
        }
      });
    },
    [getServiceIdByShipmentId],
  );

  const [agentDisplayName, setAgentDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (defaultBranchCurrencyId) {
      if (!form.values.currency_id) {
        form.setFieldValue("currency_id", defaultBranchCurrencyId);
      }
      // Set local currency on charge rows that don't have currency_id
      const charges = form.values.charges_data;
      const next = charges.map((c) =>
        c.currency_id == null
          ? { ...c, currency_id: Number(defaultBranchCurrencyId) }
          : c,
      );
      if (next.some((c, i) => c.currency_id !== charges[i]?.currency_id)) {
        form.setFieldValue("charges_data", next);
      }
    }
  }, [defaultBranchCurrencyId]);

  // Auto-calc amount_in_local = ROE * Amount whenever ROE or Amount changes
  const chargesAmountRoeKey = form.values.charges_data
    .map((c) => `${c.amount}-${c.roe}`)
    .join(",");
  useEffect(() => {
    const charges = form.values.charges_data;
    let changed = false;
    const next = charges.map((c) => {
      const amount = c.amount ?? 0;
      const roe = c.roe ?? 0;
      const local = clampAmount(amount * roe);
      if (local !== (c.amount_in_local ?? null)) changed = true;
      return { ...c, amount_in_local: local };
    });
    if (changed) form.setFieldValue("charges_data", next);
  }, [chargesAmountRoeKey]);

  const buildPayload = (values: SupplierInvoiceFormValues, statusOverride?: string) => {
    const chargesPayload = values.charges_data.map((c) => {
      const base = {
        account_code: c.account_code || "",
        subledger_code: c.subledger_code || "",
        CRN: c.CRN || "",
        narration: c.narration || "",
        shipment_no: c.shipment_no || "",
        charge_id: c.charge_id ?? 0,
        currency_id: c.currency_id ?? 0,
        roe: String(c.roe ?? 0),
        amount: String(clampAmount(c.amount ?? 0) ?? 0),
        amount_in_local: String(clampAmount(c.amount_in_local ?? 0) ?? 0),
        tax_code: c.tax_code || "",
        Dr_Cr: c.Dr_Cr,
      };
      if (c.id != null) return { ...base, id: c.id };
      return base;
    });
    return {
      ...(saveResponse?.id != null ? { id: saveResponse.id } : {}),
      cbp_number: values.cbp_number || "",
      cost_center: values.cost_center || "",
      day_book_id: values.day_book_id ? Number(values.day_book_id) : null,
      crj_number: values.crj_number || "",
      date: values.date ? formatDDMMYYYY(new Date(values.date)) : "",
      creditor_agent: values.creditor_agent || "",
      agent_code: values.agent_code || "",
      state_id: values.state_id ? Number(values.state_id) : null,
      tds_section_code: values.tds_section_code || "",
      note: values.note || "",
      narration: values.narration || "",
      customer_gst_no: values.customer_gst_no || "",
      location_gst_no: values.location_gst_no || "",
      Inv_Crn_note: values.Inv_Crn_note || "",
      Inv_Crn_no: values.Inv_Crn_no || "",
      currency_id: values.currency_id ? Number(values.currency_id) : null,
      taxable_amount: String(clampAmount(values.taxable_amount ?? 0) ?? 0),
      non_taxable_amount: String(
        clampAmount(values.non_taxable_amount ?? 0) ?? 0,
      ),
      cgst_amount: String(clampAmount(values.cgst_amount ?? 0) ?? 0),
      sgst_amount: String(clampAmount(values.sgst_amount ?? 0) ?? 0),
      igst_amount: String(clampAmount(values.igst_amount ?? 0) ?? 0),
      Inv_crn_amount: String(clampAmount(values.Inv_crn_amount ?? 0) ?? 0),
      approved_amount: String(clampAmount(values.approved_amount ?? 0) ?? 0),
      difference_amount: String(
        clampAmount(values.difference_amount ?? 0) ?? 0,
      ),
      due_date: values.due_date
        ? formatDDMMYYYY(new Date(values.due_date))
        : "",
      status: statusOverride ?? values.status ?? "UNPOSTED",
      Dr_Cr: values.Dr_Cr,
      charges_data: chargesPayload,
    };
  };

  const handleSubmit = async (values: SupplierInvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = buildPayload(values);
      const isEdit = saveResponse?.id != null;

      if (isEdit) {
        const raw = (await putAPICall(
          URL.supplierInvoice,
          payload,
          API_HEADER,
        )) as { data?: { id?: number; crj_number?: string; status?: unknown; charges?: ApiCharge[] } } | { id?: number; crj_number?: string; status?: unknown } | undefined;
        const data = (raw && "data" in raw && raw.data != null ? raw.data : raw) as { id?: number; crj_number?: string; status?: unknown; charges?: ApiCharge[]; Inv_Crn_no?: string } | undefined;
        if (data) {
          setSaveResponse({
            id: data.id ?? saveResponse?.id,
            crj_number: data.crj_number ?? saveResponse?.crj_number ?? "",
            Inv_Crn_no: data.Inv_Crn_no ?? saveResponse?.Inv_Crn_no ?? "",
            status: data.status != null ? String(data.status) : (saveResponse?.status ?? "UNPOSTED"),
          });
          if (Array.isArray(data.charges)) {
            form.setFieldValue("charges_data", mapApiChargesToRows(data.charges));
          }
          ToastNotification({
            message: "Supplier invoice updated successfully",
            type: "success",
          });
        }
      } else {
        const raw = (await postAPICall(
          URL.supplierInvoice,
          payload,
          API_HEADER,
        )) as { data?: { id?: number; crj_number?: string; status?: unknown; charges?: ApiCharge[] } } | { id?: number; crj_number?: string; status?: unknown } | undefined;
        const data = (raw && "data" in raw && raw.data != null ? raw.data : raw) as { id?: number; crj_number?: string; status?: unknown; charges?: ApiCharge[]; Inv_Crn_no?: string } | undefined;
        if (data) {
          setSaveResponse({
            id: data.id,
            crj_number: data.crj_number ?? "",
            Inv_Crn_no: data.Inv_Crn_no ?? "",
            status: data.status != null ? String(data.status) : "UNPOSTED",
          });
          if (Array.isArray(data.charges)) {
            form.setFieldValue("charges_data", mapApiChargesToRows(data.charges));
          }
          ToastNotification({
            message: "Supplier invoice created successfully",
            type: "success",
          });
        }
      }
    } catch (error: unknown) {
      console.error(
        saveResponse?.id != null ? "Error updating" : "Error creating",
        "supplier invoice:",
        error,
      );
      ToastNotification({
        message:
          (error as { message?: string })?.message ??
          (saveResponse?.id != null
            ? "Failed to update supplier invoice"
            : "Failed to create supplier invoice"),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePost = async () => {
    if (saveResponse?.id == null) return;
    setIsSubmitting(true);
    try {
      const payload = buildPayload(form.values, "POSTED");
      const raw = (await putAPICall(
        URL.supplierInvoice,
        payload,
        API_HEADER,
      )) as { data?: { id?: number; crj_number?: string; status?: unknown; charges?: ApiCharge[] } } | { id?: number; status?: unknown } | undefined;
      const data = raw && "data" in raw && raw.data != null ? raw.data : raw;
      if (data) {
        const statusStr = (data as { status?: unknown }).status != null ? String((data as { status?: unknown }).status) : "POSTED";
        setSaveResponse((prev) =>
          prev ? { ...prev, status: statusStr } : null,
        );
        form.setFieldValue("status", "POSTED");
        if (Array.isArray((data as { charges?: ApiCharge[] }).charges)) {
          form.setFieldValue("charges_data", mapApiChargesToRows((data as { charges: ApiCharge[] }).charges));
        }
        ToastNotification({
          message: "Supplier invoice posted successfully",
          type: "success",
        });
      }
    } catch (error: unknown) {
      console.error("Error posting supplier invoice:", error);
      ToastNotification({
        message:
          (error as { message?: string })?.message ??
          "Failed to post supplier invoice",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusUpper = String(saveResponse?.status ?? "").toUpperCase();
  const isReadOnly = saveResponse != null && statusUpper === "POSTED";
  const effectiveInputStyles = isReadOnly ? readOnlyFieldStyles : inputStyles;

  const addChargeRow = () => {
    const currencyIdStr =
      form.values.currency_id || defaultBranchCurrencyId || "";
    const currCode =
      currencyOptions.find((o) => o.value === currencyIdStr)?.label ?? "";
    const roe = currCode ? getRoeValue(currCode) : 1;
    form.insertListItem("charges_data", {
      account_code: "",
      subledger_code: "",
      CRN: "",
      narration: "",
      shipment_no: "",
      charge_id: null,
      currency_id:
        defaultBranchCurrencyId != null
          ? Number(defaultBranchCurrencyId)
          : currencyIdStr
            ? Number(currencyIdStr)
            : null,
      roe,
      amount: null,
      amount_in_local: null,
      tax_code: "",
      Dr_Cr: "Dr",
    });
  };

  return (
    <Box p={"sm"} style={{ position: "relative" }}>
      {isSubmitting && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text size="sm" c="#105476" fw={500}>
              Saving supplier invoice...
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Text size="xl" fw={600} c="#105476">
            {titleOverride ?? "Create Supplier Invoice"}
          </Text>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">
                    CRJ Number:
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    color="#105476"
                    styles={{ root: { textTransform: "none" } }}
                  >
                    {saveResponse.crj_number || saveResponse.Inv_Crn_no || "—"}
                  </Badge>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">
                    Status:
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    color={
                      String(saveResponse.status ?? "").toUpperCase() === "UNPOSTED"
                        ? "gray"
                        : "green"
                    }
                    styles={{ root: { textTransform: "none" } }}
                  >
                    {String(saveResponse.status ?? "").toUpperCase() || "—"}
                  </Badge>
                </Group>
              </Group>
            )}
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(backPath)}
            >
              Back
            </Button>
          </Group>
        </Group>

        <Box
          component="form"
          onSubmit={
            isReadOnly
              ? (e: React.FormEvent) => e.preventDefault()
              : form.onSubmit((values) =>
                  handleSubmit(values as SupplierInvoiceFormValues),
                )
          }
        >
          {/* Segment: Credit Journal Voucher — CBP Number through Location GST No */}
          <Text size="sm" fw={600} c="#105476" mb="xs">
            Credit Journal Voucher
          </Text>
          <Grid mb="md">
            {/* <Grid.Col span={2}>
              <TextInput
                label="CBP Number"
                placeholder="CBP Number"
                value={form.values.cbp_number}
                onChange={(e) =>
                  form.setFieldValue("cbp_number", e.target.value)
                }
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="Cost Center"
                placeholder="Cost Center"
                value={form.values.cost_center}
                onChange={(e) =>
                  form.setFieldValue("cost_center", e.target.value)
                }
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col> */}
            <Grid.Col span={2}>
              <Dropdown
                label="Day Book"
                placeholder={
                  isDaybookLoading ? "Loading..." : "Select day book"
                }
                data={daybookOptions}
                value={form.values.day_book_id || null}
                onChange={(v) => form.setFieldValue("day_book_id", v ?? "")}
                searchable
                withAsterisk
                error={form.errors.day_book_id}
                disabled={isDaybookLoading || isReadOnly}
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="CRJ Number"
                placeholder="CRJ Number"
                value={form.values.crj_number}
                onChange={(e) =>
                  form.setFieldValue("crj_number", e.target.value)
                }
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <SingleDateInput
                label="Date"
                placeholder="Select date"
                value={normalizeDate(form.values.date)}
                onChange={(d) => {
                  form.setFieldValue("date", d);
                  if (!form.values.due_date) form.setFieldValue("due_date", d);
                }}
                withAsterisk
                error={form.errors.date ? String(form.errors.date) : undefined}
                disabled={isReadOnly}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <TextInput
                label="Creditor/Agent"
                placeholder="Creditor Agent"
                value={form.values.creditor_agent}
                onChange={(e) =>
                  form.setFieldValue("creditor_agent", e.target.value)
                }
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <SearchableSelect
                label="Agent"
                disabled={isReadOnly}
                placeholder="Type agent name or code"
                apiEndpoint={URL.agent}
                searchFields={["customer_name", "customer_code"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(
                    item.customer_code ?? item.agent_code ?? item.id ?? "",
                  ),
                  label: String(
                    item.customer_name ??
                      item.agent_name ??
                      item.customer_code ??
                      "",
                  ),
                })}
                value={form.values.agent_code || null}
                displayValue={agentDisplayName ?? undefined}
                onChange={(value, selectedData) => {
                  form.setFieldValue("agent_code", value ?? "");
                  setAgentDisplayName(selectedData?.label ?? null);
                }}
                dropdownZIndex={1000}
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="State"
                placeholder={isStateLoading ? "Loading..." : "Select state"}
                data={stateOptions}
                value={form.values.state_id || null}
                onChange={(v) => form.setFieldValue("state_id", v ?? "")}
                searchable
                withAsterisk
                error={form.errors.state_id}
                disabled={isStateLoading || isReadOnly}
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="TDS Section Code"
                disabled={isReadOnly}
                placeholder="TDS Section Code"
                value={form.values.tds_section_code}
                onChange={(e) =>
                  form.setFieldValue("tds_section_code", e.target.value)
                }
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="Customer GST No"
                placeholder="Customer GST No"
                value={form.values.customer_gst_no}
                onChange={(e) =>
                  form.setFieldValue("customer_gst_no", e.target.value)
                }
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="Location GST No"
                placeholder="Location GST No"
                value={form.values.location_gst_no}
                onChange={(e) =>
                  form.setFieldValue("location_gst_no", e.target.value)
                }
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Textarea
                label="Note"
                placeholder="Note"
                value={form.values.note}
                onChange={(e) => form.setFieldValue("note", e.target.value)}
                rows={2}
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Textarea
                label="Narration"
                placeholder="Narration"
                value={form.values.narration}
                onChange={(e) =>
                  form.setFieldValue("narration", e.target.value)
                }
                rows={2}
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
          </Grid>

          {/* Segment: Agent INV/CRN Detail — Due Date, Currency, Inv/Crn Note through Difference Amount */}
          <Text size="sm" fw={600} c="#105476" mb="xs">
            Agent INV/CRN Detail
          </Text>
          <Grid mb="md">
            <Grid.Col span={2}>
              <TextInput
                label="Inv/Crn Note"
                placeholder="Inv/Crn Note"
                value={form.values.Inv_Crn_note}
                onChange={(e) =>
                  form.setFieldValue("Inv_Crn_note", e.target.value)
                }
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="Inv/Crn No"
                placeholder="Inv/Crn No"
                value={form.values.Inv_Crn_no}
                onChange={(e) =>
                  form.setFieldValue("Inv_Crn_no", e.target.value)
                }
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="Currency"
                placeholder={
                  isCurrencyLoading ? "Loading..." : "Select currency"
                }
                data={currencyOptions}
                value={form.values.currency_id || null}
                onChange={(v) => form.setFieldValue("currency_id", v ?? "")}
                searchable
                withAsterisk
                error={form.errors.currency_id}
                disabled={isCurrencyLoading || isReadOnly}
                styles={effectiveInputStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <NumberInput
                label="Inv/Crn Amount"
                disabled={isReadOnly}
                placeholder="0"
                value={form.values.Inv_crn_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "Inv_crn_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                min={0}
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <NumberInput
                label="Taxable Amount"
                disabled={isReadOnly}
                placeholder="0"
                value={form.values.taxable_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "taxable_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                min={0}
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput
                label="Non Taxable Amount"
                disabled={isReadOnly}
                placeholder="0"
                value={form.values.non_taxable_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "non_taxable_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                min={0}
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput
                label="CGST Amount"
                disabled={isReadOnly}
                placeholder="0"
                value={form.values.cgst_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "cgst_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                min={0}
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput
                label="SGST Amount"
                disabled={isReadOnly}
                placeholder="0"
                value={form.values.sgst_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "sgst_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                min={0}
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput
                label="IGST Amount"
                placeholder="0"
                value={form.values.igst_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "igst_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                min={0}
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <NumberInput
                label="Approved Amount"
                disabled={isReadOnly}
                placeholder="0"
                value={form.values.approved_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "approved_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                min={0}
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput
                label="Difference Amount"
                disabled={isReadOnly}
                placeholder="0"
                value={form.values.difference_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "difference_amount",
                    typeof v === "number" ? v : null,
                  )
                }
                decimalScale={3}
                hideControls
                styles={effectiveInputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <SingleDateInput
                label="Due Date"
                placeholder="Select due date"
                value={normalizeDate(form.values.due_date)}
                onChange={(d) => form.setFieldValue("due_date", d)}
                withAsterisk
                error={
                  form.errors.due_date
                    ? String(form.errors.due_date)
                    : undefined
                }
                disabled={isReadOnly}
              />
            </Grid.Col>
          </Grid>

          {/* Charges Section — span 12, grid form like InvoiceCreate */}
          <Grid mt="md">
            <Grid.Col span={12}>
              <Group justify="space-between" align="center" mb="sm">
                <Text size="sm" fw={600} c="#105476">
                  Charges
                </Text>
                {/* <Button
                type="button"
                size="sm"
                variant="light"
                color="#105476"
                leftSection={<IconPlus size={16} />}
                onClick={addChargeRow}
              >
                Add Charge
              </Button> */}
              </Group>
              <Box mb="sm" mt="md">
                <Grid
                  w="100%"
                  gutter="sm"
                  py="sm"
                  style={{
                    position: "sticky",
                    top: 45,
                    // zIndex: 100,
                    backgroundColor: "white",
                    fontWeight: 600,
                    color: "#105476",
                  }}
                >
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Account
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Subledger
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    CRN
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Narration
                  </Grid.Col>
                  <Grid.Col span={1.25} style={{ fontSize: "13px" }}>
                    Shipment No
                  </Grid.Col>
                  <Grid.Col span={1.25} style={{ fontSize: "13px" }}>
                    Charge
                  </Grid.Col>
                  <Grid.Col span={0.75} style={{ fontSize: "13px" }}>
                    Currency
                  </Grid.Col>
                  <Grid.Col span={0.75} style={{ fontSize: "13px" }}>
                    ROE
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Amount
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Local Amount
                  </Grid.Col>
                  <Grid.Col span={0.75} style={{ fontSize: "13px" }}>
                    SAC Code
                  </Grid.Col>
                  <Grid.Col span={0.75} style={{ fontSize: "13px" }}>
                    Dr/Cr
                  </Grid.Col>
                  <Grid.Col span={0.5} style={{ fontSize: "13px" }}>
                    Actions
                  </Grid.Col>
                </Grid>

                {form.values.charges_data.map((row, index) => (
                  <Grid
                    key={index}
                    w="100%"
                    gutter="sm"
                    mt={index !== 0 ? "sm" : 0}
                  >
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="Account Code"
                        data={accountOptions}
                        value={row.account_code || null}
                        onChange={(v) =>
                          form.setFieldValue(
                            `charges_data.${index}.account_code`,
                            v ?? "",
                          )
                        }
                        searchable
                        clearable
                        disabled={isReadOnly}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SearchableSelect
                        placeholder="Subledger"
                        disabled={isReadOnly}
                        apiEndpoint={URL.customer}
                        searchFields={["customer_name", "customer_code"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.customer_code ?? item.id ?? ""),
                          label: String(
                            item.customer_name ?? item.customer_code ?? "",
                          ),
                        })}
                        value={row.subledger_code || null}
                        displayValue={row.subledger_code || undefined}
                        onChange={(value) =>
                          form.setFieldValue(
                            `charges_data.${index}.subledger_code`,
                            value ?? "",
                          )
                        }
                        dropdownZIndex={1000}
                        minSearchLength={2}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="CRN"
                        data={CRN_OPTIONS}
                        value={row.CRN || null}
                        onChange={(v) =>
                          form.setFieldValue(
                            `charges_data.${index}.CRN`,
                            v ?? "",
                          )
                        }
                        disabled={isReadOnly}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <TextInput
                        placeholder="Narration"
                        value={row.narration}
                        onChange={(e) =>
                          form.setFieldValue(
                            `charges_data.${index}.narration`,
                            e.target.value,
                          )
                        }
                        disabled={isReadOnly}
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
                        placeholder="Shipment No"
                        data={shipmentOptions}
                        value={row.shipment_no || null}
                        disabled={isReadOnly}
                        onChange={(v) => {
                          const shipmentNo = v ?? "";
                          form.setFieldValue(
                            `charges_data.${index}.shipment_no`,
                            shipmentNo,
                          );
                          fetchSacForChargeRow(
                            index,
                            row.charge_id,
                            shipmentNo,
                          );
                        }}
                        searchable
                        clearable
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
                        placeholder="Charge"
                        data={chargeOptions}
                        value={
                          row.charge_id != null ? String(row.charge_id) : null
                        }
                        onChange={(v) => {
                          const chargeId = v ? Number(v) : null;
                          form.setFieldValue(
                            `charges_data.${index}.charge_id`,
                            chargeId,
                          );
                          if (chargeId != null && row.shipment_no) {
                            fetchSacForChargeRow(
                              index,
                              chargeId,
                              row.shipment_no,
                            );
                          }
                        }}
                        searchable
                        clearable
                        disabled={isChargeLoading || isReadOnly}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={0.75}>
                      <Dropdown
                        placeholder="Currency"
                        data={currencyOptions}
                        value={
                          row.currency_id != null
                            ? String(row.currency_id)
                            : null
                        }
                        onChange={(v) => {
                          const id = v ? Number(v) : null;
                          form.setFieldValue(
                            `charges_data.${index}.currency_id`,
                            id,
                          );
                          const code =
                            currencyOptions.find((o) => o.value === v)?.label ??
                            "";
                          if (code)
                            form.setFieldValue(
                              `charges_data.${index}.roe`,
                              getRoeValue(code),
                            );
                        }}
                        searchable
                        clearable
                        disabled={isCurrencyLoading || isReadOnly}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={0.75}>
                      <NumberInput
                        placeholder="ROE"
                        value={row.roe ?? undefined}
                        onChange={(v) =>
                          form.setFieldValue(
                            `charges_data.${index}.roe`,
                            typeof v === "number" ? v : null,
                          )
                        }
                        min={0}
                        decimalScale={4}
                        hideControls
                        disabled={isReadOnly}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <NumberInput
                        placeholder="0"
                        value={row.amount ?? undefined}
                        onChange={(v) =>
                          form.setFieldValue(
                            `charges_data.${index}.amount`,
                            typeof v === "number" ? v : null,
                          )
                        }
                        min={0}
                        decimalScale={2}
                        hideControls
                        disabled={isReadOnly}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                    <NumberInput
                      placeholder="0"
                      value={row.amount_in_local ?? undefined}
                      onChange={(v) =>
                        form.setFieldValue(
                          `charges_data.${index}.amount_in_local`,
                          typeof v === "number" ? v : null,
                        )
                      }
                      min={0}
                      decimalScale={2}
                      hideControls
                      disabled={isReadOnly}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.75}>
                    <TextInput
                      placeholder="SAC Code"
                        value={row.tax_code}
                        readOnly
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={0.75}>
                      <Dropdown
                        data={[
                          { value: "Dr", label: "Dr" },
                          { value: "Cr", label: "Cr" },
                        ]}
                        value={row.Dr_Cr}
                        onChange={(v) =>
                          form.setFieldValue(
                            `charges_data.${index}.Dr_Cr`,
                            (v === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr",
                          )
                        }
                        disabled={isReadOnly}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={0.5}>
                      <Group gap="xs">
                        {!isReadOnly && form.values.charges_data.length > 1 && (
                          <Button
                            type="button"
                            variant="light"
                            color="red"
                            size="sm"
                            px={12}
                            onClick={() =>
                              form.removeListItem("charges_data", index)
                            }
                          >
                            <IconTrash size={16} />
                          </Button>
                        )}
                        {!isReadOnly && form.values.charges_data.length - 1 === index && (
                          <Button
                            type="button"
                            radius="sm"
                            px={12}
                            size="sm"
                            variant="light"
                            color="#105476"
                            onClick={addChargeRow}
                          >
                            <IconPlus size={16} />
                          </Button>
                        )}
                      </Group>
                    </Grid.Col>
                  </Grid>
                ))}
              </Box>
            </Grid.Col>
          </Grid>

          {!isReadOnly && (
            <Group justify="flex-end" mt="lg" gap="sm">
              {saveResponse?.id != null && statusUpper === "UNPOSTED" && (
                <Button
                  type="button"
                  color="green"
                  loading={isSubmitting}
                  onClick={handlePost}
                >
                  Post
                </Button>
              )}
              <Button
                type="submit"
                color="#105476"
                rightSection={<IconChevronRight size={16} />}
                loading={isSubmitting}
              >
                {saveResponse?.id != null ? "Update Supplier Invoice" : "Save Supplier Invoice"}
              </Button>
            </Group>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
