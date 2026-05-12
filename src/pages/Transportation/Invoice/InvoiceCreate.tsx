import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Text,
  Stack,
  Loader,
  ScrollArea,
  Tabs,
  Table,
  Menu,
  ActionIcon,
  Modal,
  Center,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
  IconDotsVertical,
  IconEye,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  SearchableSelect,
  Dropdown,
  ToastNotification,
  SingleDateInput,
} from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { apiCallProtected } from "../../../api/axios";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import useAuthStore from "../../../store/authStore";
import FormNumberInput from "../../../components/FormNumberInput";
import FormTextInput from "../../../components/FormTextInput";
import FormTextArea from "../../../components/FormTextArea";

// Fetch functions

type GstRatesBySacResponse = {
  igst?: number | string | null;
  cgst?: number | string | null;
  sgst?: number | string | null;
  IGST?: number | string | null;
  CGST?: number | string | null;
  SGST?: number | string | null;
  igst_percent?: number | string | null;
  cgst_percent?: number | string | null;
  sgst_percent?: number | string | null;
  same_state?: boolean;
};

type GstRates = {
  igst: number | null;
  cgst: number | null;
  sgst: number | null;
  same_state: boolean;
};

const fetchGstRatesByStateSac = async (payload: {
  state_id: number;
  sac_code: string;
}) => {
  return postAPICall("invoice/gst-rates-by-state-sac/", payload, API_HEADER);
};
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
    return (response as any)?.data || response || [];
  } catch (error) {
    console.error("Error fetching state master:", error);
    return [];
  }
};

// Daybook: POST with { filters: { document_type } }, response.data has id and name
const fetchDaybook = async (documentType: "INV" | "CRN" = "INV") => {
  try {
    const payload = { filters: { document_type: documentType } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook:", error);
    return [];
  }
};

// Fetch charge master
const fetchChargeMaster = async () => {
  try {
    const payload = {
      filters: {},
    };
    const response = await postAPICall(
      URL.chargeMasterFilter,
      payload,
      API_HEADER,
    );
    return (response as any)?.data || [];
  } catch (error) {
    console.error("Error fetching charge master:", error);
    return [];
  }
};

// Fetch unit master

// Fetch effective SAC (tax code) for charge + service: POST body { items: [{ charge_id, service_id }] }
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

// Fetch GST breakup for invoice: POST body { customer_id, invoice_id }
const fetchInvoiceCalculateGstBreakup = async (payload: {
  // customer_id: number;
  invoice_id: number;
}) => {
  try {
    const response = await postAPICall(
      URL.invoiceCalculateGstBreakup,
      payload,
      API_HEADER,
    );
    return response as {
      charges?: Array<{
        charge_id?: number;
        charge_name?: string;
        sac_code?: string;
        rate_name?: string;
        rate?: number;
        rate_type?: string;
        amount?: number;
      }>;
      sac_wise_totals?: Array<{
        sac_code?: string;
        charge_name?: string;
        total_amount?: number;
        charge_names?: string[];
        charge_count?: number;
        charge_id?: number;
        rate?: number;
        rate_type?: string;
      }>;
      cgst_total?: string;
      sgst_total?: string;
      igst_total?: string;
      total?: string;
    };
  } catch (error) {
    console.error("Error fetching calculate-gst-breakup:", error);
    throw error;
  }
};

type ChargeItem = {
  id?: number | null; // primary key from API when editing existing charge
  charge_id: number | null; // id from charge master (value when selecting charge)
  charge_code?: string; // e.g. ISC / IGST (from API)
  charge_name: string; // display label for charge
  shipment_id?: string; // per-charge shipment id (when from job level, from corresponding HAWB)
  shipper_id?: string; // per-charge shipper id/code (from corresponding HAWB)
  unit_code: string;
  unit_id?: string; // from house / dropdown value when using id
  no_of_unit: number | null;
  currency: string;
  currency_id?: string; // from house / dropdown value when using id
  billing_currency?: string | null;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null; // Internal naming: currency_amount (amount in currency)
  header_amount: number | null;
  amount_in_local: number | null; // Auto-calculated as: amount * roe
  tax_code: string; // sac_code from get-effective-sac / payload
  dr_cr: "Cr" | "Dr"; // Dr/Cr for charge row, default "Cr"
  is_tax_row?: boolean; // appended tax row during POST; don't fetch/calc GST for this row
  igst_rate?: number | null;
  cgst_rate?: number | null;
  sgst_rate?: number | null;
};

type InvoiceFormData = {
  bill_to: string;
  address: string;
  state: string;
  gstn: string;
  shipment_no: string;
  daybook_id: string; // stored as string for dropdown, sent as number in payload
  document_date: Date | null;
  due_date: Date | null;
  currency: string;
  roe: number | null;
  narration: string;
  irn_no: string;
  fapiao_no: string;
  charges: ChargeItem[];
};

// Normalize form date value to Date | null for SingleDateInput (handles string from serialization)
function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  // Try native parsing first (works for ISO, RFC, etc.)
  const native = new Date(raw);
  if (!isNaN(native.getTime())) return native;

  // Handle common backend formats like:
  // - "DD-MM-YYYY"
  // - "DD/MM/YYYY"
  // - "DD-MM-YYYY HH:mm" / "DD/MM/YYYY HH:mm"
  const m = raw.match(
    /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hours = m[4] != null ? Number(m[4]) : 0;
    const minutes = m[5] != null ? Number(m[5]) : 0;
    const seconds = m[6] != null ? Number(m[6]) : 0;
    const d = new Date(year, month - 1, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// Round monetary amounts to exactly 2 decimal places (payload / display math). No upper bound.
function clampAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined)
    return value === undefined ? null : null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return parseFloat(n.toFixed(2));
}

/** Prefer first non-empty string from nested party/job records (ocean housings vary by field names). */
function pickFirstTrimmedCode(
  records: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
): string {
  for (const rec of records) {
    if (!rec) continue;
    for (const key of keys) {
      const raw = rec[key];
      if (raw == null || raw === "") continue;
      const s = String(raw).trim();
      if (s !== "") return s;
    }
  }
  return "";
}

function clampSumAmounts(parts: Array<number | null | undefined>): number {
  const sum = parts.reduce<number>(
    (acc, v) =>
      Number.isFinite(Number(v)) ? acc + (Number(v) as number) : acc,
    0,
  );
  return clampAmount(sum) ?? 0;
}

/** Charges on a housing row may be `charges` (air/sea) or `mawb_charges` (air import). */
function getHousingChargeArray(
  hawb: Record<string, unknown>,
): Record<string, unknown>[] {
  const ch = hawb.charges;
  if (Array.isArray(ch) && ch.length > 0)
    return ch as Record<string, unknown>[];
  const mc = hawb.mawb_charges;
  if (Array.isArray(mc) && mc.length > 0)
    return mc as Record<string, unknown>[];
  return [];
}

/** Map job/house party to master state_id for invoice State dropdown. */
function resolvePartyStateIdFromHousing(
  isAgent: boolean,
  useConsigneeForBillTo: boolean,
  firstHawb: Record<string, unknown>,
  jobHouse0?: Record<string, unknown>,
  jobRoot?: Record<string, unknown> | null,
): number | null {
  const raw = isAgent
    ? (firstHawb["agent_state_id"] ??
      jobHouse0?.["agent_state_id"] ??
      jobRoot?.["agent_state_id"] ??
      null)
    : useConsigneeForBillTo
      ? (firstHawb["consignee_state_id"] ??
        jobHouse0?.["consignee_state_id"] ??
        jobRoot?.["consignee_state_id"] ??
        null)
      : (firstHawb["shipper_state_id"] ??
        jobHouse0?.["shipper_state_id"] ??
        jobRoot?.["shipper_state_id"] ??
        null);
  if (
    raw === null ||
    raw === undefined ||
    String(raw).trim() === "" ||
    !Number.isFinite(Number(raw))
  )
    return null;
  return Number(raw);
}

// Invoice data shape from filter/invoice API (for edit/view form fill)
type InvoiceDataFromApi = {
  id?: number;
  customer_id?: number;
  bill_to?: string;
  bill_to_name?: string;
  address?: string;
  gstn?: string;
  shipment_no?: string;
  document_no?: string;
  document_date?: string;
  due_date?: string;
  roe?: string | number;
  narration?: string;
  irn_no?: string;
  fapiao_no?: string;
  state_id?: number;
  currency_id?: number;
  currency_code?: string;
  day_book_id?: number;
  day_book_name?: string;
  daybook_id?: number;
  daybook_name?: string;
  status?: string;
  is_agent?: boolean;
  charges?: Array<{
    id?: number;
    charge_id?: number;
    charge_name?: string;
    shipment_id?: string;
    shipper_id?: string;
    unit_id?: string;
    unit_code?: string;
    no_of_unit?: string | number;
    currency_code?: string;
    roe?: string | number;
    amount_per_unit?: string | number;
    amount?: string | number;
    amount_in_local?: string | number;
    amount_in_header?: string | number | null;
    tax_code?: string;
  }>;
};

type InvoiceCreateProps = {
  documentType?: "INV" | "CRN";
  baseDrCr?: "Dr" | "Cr";
  chargeDefaultDrCr?: "Dr" | "Cr";
  documentLabel?: string;
};

function InvoiceCreate({
  documentType = "INV",
  baseDrCr = "Dr",
  chargeDefaultDrCr = "Cr",
  documentLabel = "Invoice",
}: InvoiceCreateProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: invoiceId } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const isViewMode = location.pathname.includes("/view/");
  const isEditMode = location.pathname.includes("/edit/");
  const isEditOrViewMode = Boolean(
    invoiceId &&
      (location.pathname.includes("/edit/") ||
        location.pathname.includes("/view/")),
  );

  // Default branch currency (active branch: is_default === true) for Billing Currency
  const defaultBranch = user?.branches?.find(
    (b: { is_default?: boolean }) => b.is_default === true,
  ) as
    | { currency?: { currency_id?: number; currency_code?: string } }
    | undefined;
  const defaultBranchCurrency = defaultBranch?.currency?.currency_code ?? "";
  const defaultBranchCurrencyId =
    defaultBranch?.currency?.currency_id != null
      ? String(defaultBranch.currency.currency_id)
      : "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceDataFromApi, setInvoiceDataFromApi] =
    useState<InvoiceDataFromApi | null>(null);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    customer_id?: number;
    document_no?: string;
    status?: string;
  } | null>(null);
  const [billToDisplayName, setBillToDisplayName] = useState<string | null>(
    null,
  );
  const [chargesTabActive, setChargesTabActive] = useState<string>("charges");
  const [gstBreakup, setGstBreakup] = useState<{
    charges?: Array<{
      charge_id?: number;
      charge_name?: string;
      sac_code?: string;
      rate_name?: string;
      rate?: number;
      rate_type?: string;
      amount?: number;
    }>;
    sac_wise_totals?: Array<{
      sac_code?: string;
      charge_name?: string;
      total_amount?: number;
      charge_names?: string[];
      charge_count?: number;
      charge_id?: number;
      rate?: number;
      rate_type?: string;
    }>;
    cgst_total?: string;
    sgst_total?: string;
    igst_total?: string;
    total?: string;
  } | null>(null);
  const [gstBreakupLoading, setGstBreakupLoading] = useState(false);

  const [gstRatesByChargeIndex, setGstRatesByChargeIndex] = useState<
    Record<number, GstRates | null>
  >({});
  const [gstRatesLoadingByIndex, setGstRatesLoadingByIndex] = useState<
    Record<number, boolean>
  >({});
  const gstRatesCacheRef = useRef<Map<string, GstRates>>(new Map());
  const lastGstRatesFetchKeyRef = useRef<string>("");

  const [isPosting, setIsPosting] = useState(false);
  const [invoiceIsPosted, setInvoiceIsPosted] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [addressOptions, setAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  const isReadOnly = isViewMode || invoiceIsPosted;
  const invoiceDataFromState =
    (location.state?.invoiceData as Record<string, unknown> | undefined) ?? {};
  const inferredCreditFromData =
    String(invoiceDataFromState?.document_type ?? "").toUpperCase() === "CRN" ||
    String(
      (invoiceDataFromApi as Record<string, unknown> | null)?.document_type ??
        "",
    ).toUpperCase() === "CRN" ||
    String(
      invoiceDataFromState?.Dr_Cr ?? invoiceDataFromState?.dr_cr ?? "",
    ).toLowerCase() === "cr" ||
    String(
      (invoiceDataFromApi as Record<string, unknown> | null)?.Dr_Cr ??
        (invoiceDataFromApi as Record<string, unknown> | null)?.dr_cr ??
        "",
    ).toLowerCase() === "cr";
  const isCreditNoteFlow =
    documentType === "CRN" ||
    location.pathname.includes("credit-note") ||
    inferredCreditFromData;
  const resolvedDocumentLabel = isCreditNoteFlow
    ? "Credit Note"
    : documentLabel;
  const pdfDocumentLabel = resolvedDocumentLabel;
  const pageTitle = isViewMode
    ? `View ${resolvedDocumentLabel}`
    : isEditMode
      ? `Edit ${resolvedDocumentLabel}`
      : `Create ${resolvedDocumentLabel}`;

  // Ref for validate (state optional when agent invoice) — kept in sync with isAgentInvoice
  const isAgentInvoiceRef = useRef(false);

  // Agent invoice: hide SAC, IGST/CGST/SGST, Totals section, and Tax tab (customer invoice only)
  const isAgentInvoice = useMemo(() => {
    if ((location.state as { is_agent?: boolean } | null)?.is_agent === true)
      return true;
    const fromApi = (invoiceDataFromApi as { is_agent?: boolean } | null)
      ?.is_agent;
    if (fromApi === true) return true;
    const fromState = (
      location.state?.invoiceData as { is_agent?: boolean } | undefined
    )?.is_agent;
    return fromState === true;
  }, [
    location.state?.is_agent,
    location.state?.invoiceData,
    invoiceDataFromApi,
  ]);

  const fetchUnitMaster = async () => {
    try {
      const payload = {
        filters: { service_type: location.state?.serviceType },
      };
      const response = await postAPICall(
        URL.unitMasterFilter,
        payload,
        API_HEADER,
      );
      return (response as any)?.data || [];
    } catch (error) {
      console.error("Error fetching unit master:", error);
      return [];
    }
  };

  useEffect(() => {
    isAgentInvoiceRef.current = isAgentInvoice;
  }, [isAgentInvoice]);

  // When opened from Air Export Job Create (job level): show "Job id" instead of "Shipment No"
  // When opened from Air House Create (house level): show "Shipment No"
  const isFromAirExportJob = useMemo(
    () =>
      (location.state as { fromJobLevel?: boolean } | null)?.fromJobLevel ===
      true,
    [location.state],
  );

  // Show "Shipment id" column in charges tab when from Air/Sea Export/Import Job Create (job level), hide when from House Create
  const showShipmentIdInCharges = useMemo(
    () =>
      isFromAirExportJob &&
      (location.pathname.includes("/air/export-job") ||
        location.pathname.includes("/air/import-job") ||
        location.pathname.includes("/SeaExport/export-job") ||
        location.pathname.includes("/SeaExport/import-job")),
    [isFromAirExportJob, location.pathname],
  );

  // Ocean Import customer invoice: Bill To/state from consignee when billToFrom is omitted (matches Air Import + House flow).
  const invoiceUsesConsigneeParty = useMemo(() => {
    const isAgentFlow =
      (location.state as { is_agent?: boolean } | null)?.is_agent === true;
    if (isAgentFlow) return false;
    const bt = (
      location.state as { billToFrom?: "shipper" | "consignee" } | null
    )?.billToFrom;
    if (bt === "consignee") return true;
    if (bt === "shipper") return false;
    return location.pathname.includes("/SeaExport/import-job/invoice");
  }, [location.pathname, location.state?.is_agent, location.state?.billToFrom]);

  // User's local currency code (for ROE = 1 when billing currency matches)
  const userLocalCurrency = useMemo(() => {
    const code = user?.country?.country_code;
    if (code === "IN") return "INR";
    if (code === "AE") return "AED";
    return "";
  }, [user?.country?.country_code]);

  const isChinaUser = useMemo(() => {
    const countryCode = (user?.country?.country_code ?? "").toUpperCase();
    const countryName = (user?.country?.country_name ?? "").toUpperCase();
    return countryCode === "CN" || countryName === "CHINA";
  }, [user?.country?.country_code, user?.country?.country_name]);

  // Helper function to calculate ROE based on currency and user's country
  const getRoeValue = useCallback(
    (currency: string): number => {
      const userCountryCode = user?.country?.country_code;
      const currencyUpper = currency?.toUpperCase();

      if (userCountryCode === "IN") {
        if (currencyUpper === "INR") return 1;
        if (currencyUpper === "USD") return 88.75;
      } else if (userCountryCode === "AE") {
        if (currencyUpper === "AED") return 1;
        if (currencyUpper === "USD") return 3.67;
      }

      return 1;
    },
    [user?.country?.country_code],
  );

  const form = useForm<InvoiceFormData>({
    initialValues: {
      bill_to: "",
      address: "",
      state: "",
      gstn: "",
      shipment_no: "",
      daybook_id: "",
      document_date: new Date(), // Set to today's date by default
      due_date: new Date(), // Same as document date by default
      currency: defaultBranchCurrency, // Default: active branch currency from login
      roe: null,
      narration: "",
      irn_no: "",
      fapiao_no: "",
      charges: [],
    },
    validate: {
      bill_to: (value) => (!value ? "Bill To is required" : null),
      address: (value) => (!value ? "Address is required" : null),
      state: (value) =>
        isAgentInvoiceRef.current ? null : !value ? "State is required" : null,
      shipment_no: (value) => (!value ? "Shipment No is required" : null),
      daybook_id: (value) => (!value ? "Daybook is required" : null),
      document_date: (value) => (!value ? "Document Date is required" : null),
      due_date: (value) => (!value ? "Due Date is required" : null),
      currency: (value) => (!value ? "Currency is required" : null),
      roe: (value) => (value === null ? "ROE is required" : null),
    },
  });

  // Fetch currency data
  const { data: currencyData = [], isLoading: isCurrencyLoading } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  // Fetch state data
  const { data: stateData = [], isLoading: isStateLoading } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });

  // Fetch daybook data (filtered by document_type)
  const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
    queryKey: ["daybook", documentType],
    queryFn: () => fetchDaybook(documentType),
    staleTime: Infinity,
  });

  // Fetch charge master data
  const { data: chargeData = [], isLoading: isChargeLoading } = useQuery({
    queryKey: ["chargeMaster"],
    queryFn: fetchChargeMaster,
    staleTime: Infinity,
  });

  // Fetch unit master data
  const { data: unitData = [], isLoading: isUnitLoading } = useQuery({
    queryKey: ["unitMaster", location.state?.serviceType ?? ""],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
  });

  // Format currency options: value = id (for house unit_id/currency_id) or code
  const currencyOptions = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => {
      const code = item.currency_code ?? item.code ?? "";
      const id = item.id != null ? String(item.id) : "";
      return { value: id || code, label: `${code || id}` };
    });
  }, [currencyData]);

  // Billing currency options: value = code so form.values.currency (code) matches dropdown
  const billingCurrencyOptions = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data
      .map((item: any) => {
        const code = (item.currency_code ?? item.code ?? "").toString().trim();
        return { value: code, label: code ? code.toUpperCase() : "" };
      })
      .filter((o: { value: string }) => o.value !== "");
  }, [currencyData]);

  // Format state options
  const stateOptions = useMemo(() => {
    const data = stateData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.id || ""),
      label: item.state_name || item.name || "",
    }));
  }, [stateData]);

  // State from housing: apply only after state master is loaded and options exist (avoids Select clearing value before data arrives).
  useEffect(() => {
    if (isStateLoading) return;

    const stateRows = Array.isArray(stateData) ? (stateData as any[]) : [];
    if (stateRows.length === 0) return;

    const hawbDetails =
      location.state?.hawbDetails || location.state?.housingDetails || [];
    const job = location.state?.job as
      | { housing_details?: Array<Record<string, unknown>> }
      | undefined;
    const jobHousingArr = Array.isArray(job?.housing_details)
      ? (job?.housing_details as Array<Record<string, unknown>>)
      : [];
    const firstHawb =
      Array.isArray(hawbDetails) && hawbDetails.length > 0
        ? hawbDetails[0]
        : jobHousingArr[0];
    const jobHouse0 = jobHousingArr.length > 0 ? jobHousingArr[0] : undefined;
    const isAgent =
      (location.state as { is_agent?: boolean } | null)?.is_agent === true;

    if (!firstHawb) return;

    const stateIdNum = resolvePartyStateIdFromHousing(
      isAgent,
      invoiceUsesConsigneeParty,
      firstHawb as Record<string, unknown>,
      jobHouse0,
      (job ?? null) as Record<string, unknown> | null,
    );
    if (stateIdNum == null) return;

    const desired = String(stateIdNum);
    if (desired === form.values.state) return;

    queueMicrotask(() => {
      form.setFieldValue("state", desired);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isStateLoading,
    stateData,
    location.key,
    location.state?.is_agent,
    invoiceUsesConsigneeParty,
    location.state?.hawbDetails,
    location.state?.housingDetails,
    location.state?.job,
  ]);

  // Format daybook options: id = value, name = label (value is daybook_id)
  const daybookOptions = useMemo(() => {
    const invoiceData = (invoiceDataFromApi ??
      (location.state?.invoiceData as InvoiceDataFromApi | undefined)) as
      | InvoiceDataFromApi
      | undefined;
    const savedDaybookId =
      invoiceData?.day_book_id != null
        ? String(invoiceData.day_book_id)
        : invoiceData?.daybook_id != null
          ? String(invoiceData.daybook_id)
          : "";
    const savedDaybookName =
      invoiceData?.day_book_name ?? invoiceData?.daybook_name ?? "";

    const data = daybookData as Array<{
      id?: number | string;
      name?: string;
      daybook_id?: number | string;
      daybook_name?: string;
    }>;
    if (!Array.isArray(data)) return [];
    const options = data.map((item) => ({
      value: String(item.id ?? item.daybook_id ?? ""),
      label: item.name ?? item.daybook_name ?? "",
    }));
    if (
      isEditOrViewMode &&
      savedDaybookId &&
      !options.some((opt) => opt.value === savedDaybookId)
    ) {
      options.push({
        value: savedDaybookId,
        label: savedDaybookName || savedDaybookId,
      });
    }
    return options;
  }, [daybookData, invoiceDataFromApi, isEditOrViewMode, location.state]);

  // service_id from job (e.g. when navigating from air import list / house) for get-effective-sac
  const jobServiceId =
    (location.state as { job?: { service_id?: number } })?.job?.service_id ??
    null;

  // Format charge options (legacy charge master, kept if used elsewhere)
  const chargeOptions = useMemo(() => {
    const data = chargeData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.charge_code || item.id || ""),
      label: item.charge_name || item.name || "",
    }));
  }, [chargeData]);

  // Format unit options: value = id (for house unit_id) or unit_code
  const unitOptions = useMemo(() => {
    const data = unitData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => {
      const id = item.id != null ? String(item.id) : "";
      const unitCode = item.unit_code ?? item.code ?? "";
      return {
        value: id || unitCode,
        label: item.unit_name || item.name || unitCode || "",
      };
    });
  }, [unitData]);

  // Agent invoice: force billing currency to USD on every navigation when is_agent is in state
  // location.key changes on each navigation so effect runs when returning to invoice after back + create again
  useEffect(() => {
    const isAgent =
      (location.state as { is_agent?: boolean } | null)?.is_agent === true;
    if (!isAgent) return;
    form.setFieldValue("currency", "USD");
    const roe = getRoeValue("USD");
    if (roe !== null && roe !== undefined) {
      form.setFieldValue("roe", roe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.is_agent, location.key]);

  // Set Billing Currency from user's default branch when user is available and currency is still empty (skip for agent invoice - use USD)
  useEffect(() => {
    const isAgent =
      (location.state as { is_agent?: boolean } | null)?.is_agent === true;
    if (isAgent || !defaultBranchCurrency || form.values.currency) return;
    form.setFieldValue("currency", defaultBranchCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBranchCurrency]);

  const isReverseInvoiceNavigation = Boolean(
    (
      location.state as {
        invoiceData?: { reverse_invoice_id?: number | string };
      } | null
    )?.invoiceData?.reverse_invoice_id,
  );

  // When user currency and billing currency are the same, set top-level ROE to 1
  useEffect(() => {
    const billingCurrency = form.values.currency?.trim().toUpperCase();
    if (!billingCurrency || !userLocalCurrency) return;
    if (billingCurrency === userLocalCurrency.toUpperCase()) {
      form.setFieldValue("roe", 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.currency, userLocalCurrency]);

  // When Bill To is cleared, clear address only. Do not clear state here: it runs before
  // house→invoice prefill and would wipe shipper/consignee state before bill_to is set.
  // Clearing state on user action is handled in handleBillToChange.
  useEffect(() => {
    const billTo = form.values.bill_to;
    if (!billTo || (typeof billTo === "string" && billTo.trim() === "")) {
      if (form.values.address) form.setFieldValue("address", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.bill_to]);

  // Populate form from house (HAWB) state: shipper/Bill To/address and house charges → invoice charges
  useEffect(() => {
    // After POST, we rehydrate charges from API response. Avoid re-applying the initial
    // navigation (house) charges, which would overwrite the response values.
    if (invoiceIsPosted || isPosting) return;
    const hawbDetails =
      location.state?.hawbDetails || location.state?.housingDetails || [];
    const isAgent =
      (location.state as { is_agent?: boolean } | null)?.is_agent === true;
    const job = (
      location.state as {
        job?: Record<string, unknown>;
      } | null
    )?.job;
    const jobHousingArr = Array.isArray(
      (job as { housing_details?: unknown[] } | undefined)?.housing_details,
    )
      ? ((job as { housing_details: Array<Record<string, unknown>> })
          .housing_details ?? [])
      : [];
    const jobHouse0 = jobHousingArr.length > 0 ? jobHousingArr[0] : undefined;

    if (Array.isArray(hawbDetails) && hawbDetails.length > 0) {
      // Get the first HAWB detail
      const firstHawb = hawbDetails[0];

      if (firstHawb) {
        const firstHawbRec = firstHawb as Record<string, unknown>;

        if (isAgent && job) {
          // Agent invoice: default billing currency USD, Bill To = origin/destination agent
          form.setFieldValue("currency", "USD");
          const roe = getRoeValue("USD");
          if (roe !== null && roe !== undefined) {
            form.setFieldValue("roe", roe);
          }
          const agentCode = pickFirstTrimmedCode(
            [
              (job ?? null) as Record<string, unknown> | null,
              firstHawbRec,
              jobHouse0,
            ],
            [
              "agent_code",
              "origin_agent",
              "destination_agent",
              "destination_agent_code",
              "agent_customer_code",
            ],
          );
          const agentNamePick = pickFirstTrimmedCode(
            [
              (job ?? null) as Record<string, unknown> | null,
              firstHawbRec,
              jobHouse0,
            ],
            [
              "agent_name",
              "origin_agent_name",
              "destination_agent_name",
              "agent_display_name",
            ],
          );
          // Set display name before code so ocean export job invoice (Bill To agent) avoids a transient code-only Bill To hint.
          if (agentNamePick) setBillToDisplayName(agentNamePick);
          if (agentCode) {
            form.setFieldValue("bill_to", agentCode);
          }
          const agentAddressRaw =
            firstHawbRec?.origin_agent_address ??
            firstHawbRec?.agent_address ??
            jobHouse0?.agent_address ??
            jobHouse0?.origin_agent_address;
          if (
            typeof agentAddressRaw === "string" &&
            agentAddressRaw.trim() !== ""
          ) {
            form.setFieldValue("address", agentAddressRaw);
          }
        } else {
          // Customer invoice: by default Bill To = shipper, but allow ocean import to use consignee when requested
          if (defaultBranchCurrency) {
            form.setFieldValue("currency", defaultBranchCurrency);
            const roe = getRoeValue(defaultBranchCurrency);
            if (roe !== null && roe !== undefined) {
              form.setFieldValue("roe", roe);
            }
          }
          if (invoiceUsesConsigneeParty) {
            // Ocean import customer invoice: Bill To / address from consignee
            console.log(
              "[InvoiceCreate] Ocean import - using consignee for Bill To. Raw firstHawb:",
              firstHawb,
            );
            const consigneeAddr = firstHawbRec["consignee_address"];
            if (
              typeof consigneeAddr === "string" &&
              consigneeAddr.trim() !== ""
            ) {
              form.setFieldValue("address", consigneeAddr);
            }
            const consigneeCode = pickFirstTrimmedCode(
              [
                firstHawbRec,
                jobHouse0,
                (job ?? null) as Record<string, unknown> | null,
              ],
              ["consignee_code", "consignee_id", "customer_code"],
            );
            console.log(
              "[InvoiceCreate] Consignee mapping - extracted consignee_code:",
              consigneeCode,
            );
            if (consigneeCode) {
              form.setFieldValue("bill_to", consigneeCode);
              console.log(
                "[InvoiceCreate] Consignee mapping - set form.bill_to to consignee_code",
              );
            }
            const consigneeName = (
              firstHawb as {
                consignee_name?: string;
                bill_to_name?: string;
              }
            ).consignee_name;
            if (consigneeName) {
              console.log(
                "[InvoiceCreate] Consignee mapping - extracted consignee_name:",
                consigneeName,
              );
              setBillToDisplayName(
                String(
                  consigneeName ||
                    (firstHawb as { bill_to_name?: string }).bill_to_name,
                ),
              );
              console.log(
                "[InvoiceCreate] Consignee mapping - set billToDisplayName",
              );
            }

            // Populate GSTN from consignee GST, if available
            const consigneeGstRaw = (
              firstHawb as { consignee_gst_id?: string | null }
            ).consignee_gst_id;
            if (consigneeGstRaw) {
              form.setFieldValue("gstn", String(consigneeGstRaw));
            } else if (
              job &&
              Array.isArray(
                (
                  job as {
                    housing_details?: Array<{
                      consignee_gst_id?: string | null;
                    }>;
                  }
                ).housing_details,
              )
            ) {
              const jobHousing = (
                job as {
                  housing_details?: Array<{ consignee_gst_id?: string | null }>;
                }
              ).housing_details;
              const fromJobGst = jobHousing?.[0]?.consignee_gst_id;
              if (fromJobGst) {
                form.setFieldValue("gstn", String(fromJobGst));
              }
            }
          } else {
            // Default customer invoice: Bill To / address from shipper (export / non-consignee flows)
            if (firstHawb.shipper_address) {
              form.setFieldValue("address", firstHawb.shipper_address);
            }
            const shipperCode = pickFirstTrimmedCode(
              [
                firstHawbRec,
                jobHouse0,
                (job ?? null) as Record<string, unknown> | null,
              ],
              ["shipper_code", "shipper_id", "customer_code"],
            );
            if (shipperCode) {
              form.setFieldValue("bill_to", shipperCode);
            }
            if (firstHawb.shipper_name) {
              setBillToDisplayName(
                String(
                  firstHawb.shipper_name ||
                    (firstHawb as { bill_to_name?: string }).bill_to_name,
                ),
              );
            }

            // Populate GSTN from shipper GST, if available
            const shipperGstRaw = (
              firstHawb as { shipper_gst_id?: string | null }
            ).shipper_gst_id;
            if (shipperGstRaw) {
              form.setFieldValue("gstn", String(shipperGstRaw));
            } else if (
              job &&
              Array.isArray(
                (
                  job as {
                    housing_details?: Array<{ shipper_gst_id?: string | null }>;
                  }
                ).housing_details,
              )
            ) {
              const jobHousing = (
                job as {
                  housing_details?: Array<{ shipper_gst_id?: string | null }>;
                }
              ).housing_details;
              const fromJobGst = jobHousing?.[0]?.shipper_gst_id;
              if (fromJobGst) {
                form.setFieldValue("gstn", String(fromJobGst));
              }
            }
          }
        }

        // Party state — applied in the effect once state dropdown master has loaded.

        // Set shipment_no: when from Air Export Job use job.id, else use firstHawb.shipment_id
        if (isFromAirExportJob) {
          form.setFieldValue(
            "shipment_no",
            String((job as { job_id: number }).job_id),
          );
        } else if (firstHawb.shipment_id) {
          form.setFieldValue("shipment_no", String(firstHawb.shipment_id));
        }

        // Map house charges → invoice lines.
        // Agent: Collect from every HAWB (charges or mawb_charges); each line uses same billing currency as header.
        const chargesSource: unknown[] = (() => {
          if (documentType === "CRN") return [];
          if (isAgent) {
            const houses = hawbDetails as Array<Record<string, unknown>>;
            const merged = houses.flatMap((hawb) =>
              getHousingChargeArray(hawb)
                .filter(
                  (c) =>
                    String((c as { pp_cc?: unknown }).pp_cc ?? "").trim() ===
                    "Collect",
                )
                .map((c) => {
                  const row =
                    typeof c === "object" && c !== null
                      ? (c as Record<string, unknown>)
                      : {};
                  return {
                    ...row,
                    shipment_id:
                      row.shipment_id ??
                      hawb.shipment_id ??
                      hawb.shipment_no ??
                      "",
                    shipper_id:
                      row.shipper_id ??
                      hawb.shipper_code ??
                      hawb.shipper_id ??
                      "",
                  };
                }),
            );
            if (merged.length > 0) return merged;
            if (
              firstHawb.charges &&
              Array.isArray(firstHawb.charges) &&
              firstHawb.charges.length > 0
            )
              return firstHawb.charges as unknown[];
            return [];
          }
          if (
            firstHawb.charges &&
            Array.isArray(firstHawb.charges) &&
            firstHawb.charges.length > 0
          )
            return firstHawb.charges as unknown[];
          return [];
        })();

        if (chargesSource.length > 0) {
          // Agent: header billing currency defaults to USD (see agent useEffect); each charge keeps its own currency from the job.
          const billingCurrency = isAgent
            ? "USD"
            : defaultBranchCurrency || form.values.currency || "";
          const headerCode = billingCurrency.trim().toUpperCase();
          const headerRoe = billingCurrency
            ? getRoeValue(billingCurrency)
            : null;

          const mappedCharges = (chargesSource as any[]).map((charge: any) => {
            const unitDetails = charge.unit_details as
              | { unit_code?: string; unit_id?: number }
              | undefined;
            const unitCode = String(
              charge.unit_code ??
                charge.unit_input ??
                unitDetails?.unit_code ??
                "",
            ).trim();
            const currencyDetails = charge.currency_details as
              | { currency_id?: number; currency_code?: string }
              | undefined;
            const rawCurrencyId =
              charge.currency_id ??
              currencyDetails?.currency_id ??
              (typeof charge.currency === "number" ? charge.currency : null);
            let currency = String(
              charge.currency_code ??
                currencyDetails?.currency_code ??
                (typeof charge.currency === "string" ? charge.currency : "") ??
                "",
            )
              .trim()
              .toUpperCase();
            if (!currency && rawCurrencyId != null && Array.isArray(currencyData)) {
              const row = (
                currencyData as {
                  id?: number;
                  code?: string;
                  currency_code?: string;
                }[]
              ).find((c) => String(c.id) === String(rawCurrencyId));
              currency = (row?.code || row?.currency_code || "")
                .toString()
                .trim()
                .toUpperCase();
            }
            const unit_id =
              charge.unit_id != null && String(charge.unit_id).trim() !== ""
                ? String(charge.unit_id)
                : charge.unit != null && String(charge.unit).trim() !== ""
                  ? String(charge.unit)
                  : unitDetails?.unit_id != null
                    ? String(unitDetails.unit_id)
                    : "";
            const currency_id =
              rawCurrencyId != null ? String(rawCurrencyId) : "";

            const noOfUnit =
              charge.no_of_unit != null
                ? typeof charge.no_of_unit === "number"
                  ? charge.no_of_unit
                  : parseFloat(charge.no_of_unit)
                : null;
            const amountPerUnit =
              charge.amount_per_unit != null
                ? typeof charge.amount_per_unit === "number"
                  ? charge.amount_per_unit
                  : parseFloat(charge.amount_per_unit)
                : null;
            const roeVal =
              charge.roe != null && String(charge.roe).trim() !== ""
                ? typeof charge.roe === "number"
                  ? charge.roe
                  : parseFloat(String(charge.roe))
                : currency
                  ? getRoeValue(currency)
                  : null;

            let amount: number | null =
              charge.amount != null
                ? typeof charge.amount === "number"
                  ? charge.amount
                  : parseFloat(String(charge.amount))
                : null;
            let amountInLocal: number | null =
              charge.amount_in_local != null
                ? typeof charge.amount_in_local === "number"
                  ? charge.amount_in_local
                  : parseFloat(String(charge.amount_in_local))
                : charge.sell_local_amount != null
                  ? typeof charge.sell_local_amount === "number"
                    ? charge.sell_local_amount
                    : parseFloat(String(charge.sell_local_amount))
                  : null;
            let headerAmt: number | null =
              (charge.amount_in_header ?? charge.header_amount) != null
                ? typeof (charge.amount_in_header ?? charge.header_amount) ===
                  "number"
                  ? (charge.amount_in_header ?? charge.header_amount)
                  : parseFloat(
                      String(charge.amount_in_header ?? charge.header_amount),
                    )
                : null;

            if (
              noOfUnit != null &&
              noOfUnit > 0 &&
              amountPerUnit != null &&
              amountPerUnit > 0
            ) {
              const calcAmount = clampAmount(noOfUnit * amountPerUnit);
              if (calcAmount != null) amount = calcAmount;
              if (
                amount != null &&
                amount > 0 &&
                roeVal != null &&
                roeVal > 0
              ) {
                const calcLocal = clampAmount(amount * roeVal);
                if (calcLocal != null) amountInLocal = calcLocal;
              }
            }
            if (amountInLocal != null && amountInLocal > 0) {
              const billCurr =
                billingCurrency || (form.values.currency ?? "").trim();
              const chargeCurr = currency.trim();
              if (billCurr && chargeCurr) {
                if (billCurr.toUpperCase() === chargeCurr.toUpperCase()) {
                  headerAmt = amountInLocal;
                } else if (headerRoe != null && headerRoe > 0) {
                  headerAmt = clampAmount(amountInLocal / headerRoe);
                } else {
                  headerAmt = amountInLocal;
                }
              } else {
                headerAmt = amountInLocal;
              }
            }

            return {
              charge_id:
                (charge.charge_id ?? charge.id) != null
                  ? Number(charge.charge_id ?? charge.id)
                  : null,
              charge_name: charge.charge_name ? String(charge.charge_name) : "",
              shipment_id:
                charge.shipment_id != null &&
                String(charge.shipment_id).trim() !== ""
                  ? String(charge.shipment_id)
                  : charge.shipment_no != null &&
                      String(charge.shipment_no).trim() !== ""
                    ? String(charge.shipment_no)
                    : firstHawb.shipment_id
                      ? String(firstHawb.shipment_id)
                      : null,
              shipper_id:
                charge.shipper_id != null
                  ? String(charge.shipper_id)
                  : charge.shipper_code != null
                    ? String(charge.shipper_code)
                    : (firstHawb as { shipper_code?: string }).shipper_code
                      ? String(
                          (firstHawb as { shipper_code: string }).shipper_code,
                        )
                      : "",
              unit_code: unitCode,
              unit_id,
              no_of_unit: noOfUnit,
              currency,
              currency_id,
              roe: roeVal,
              amount_per_unit: amountPerUnit,
              amount: Number.isFinite(amount) ? amount : null,
              header_amount: Number.isFinite(headerAmt) ? headerAmt : null,
              amount_in_local: Number.isFinite(amountInLocal)
                ? amountInLocal
                : null,
              tax_code: charge.tax_code ? String(charge.tax_code) : "",
              dr_cr: (charge as any).dr_cr === "Dr" ? "Dr" : chargeDefaultDrCr,
            };
          });
          form.setFieldValue("charges", mappedCharges);

          const jobServiceIdForSac =
            (location.state as { job?: { service_id?: number } })?.job
              ?.service_id ?? null;
          if (
            !isAgent &&
            jobServiceIdForSac &&
            mappedCharges.some((c: ChargeItem) => c.charge_id != null)
          ) {
            const chargesWithIds = mappedCharges
              .map((c, idx) => ({ charge: c, originalIdx: idx }))
              .filter(({ charge }) => charge.charge_id != null);

            const items = chargesWithIds.map(({ charge }) => ({
              charge_id: charge.charge_id!,
              service_id: jobServiceIdForSac,
            }));

            fetchGetEffectiveSac(items).then((data) => {
              data.forEach((item, responseIdx) => {
                const originalIdx = chargesWithIds[responseIdx]?.originalIdx;
                if (
                  originalIdx !== undefined &&
                  item.sac_code != null &&
                  item.sac_code !== ""
                ) {
                  form.setFieldValue(
                    `charges.${originalIdx}.tax_code`,
                    item.sac_code,
                  );
                }
              });
            });
          }
        } else {
          const branchCurrency = isAgent
            ? ""
            : defaultBranchCurrency || form.values.currency || "";
          const branchRoe =
            !isAgent && branchCurrency ? getRoeValue(branchCurrency) : null;
          form.setFieldValue("charges", [
            {
              charge_id: null,
              charge_name: "",
              unit_code: "",
              unit_id: "",
              no_of_unit: null,
              currency: branchCurrency,
              currency_id: isAgent ? "" : defaultBranchCurrencyId || "",
              billing_currency: null,
              roe: branchRoe,
              amount_per_unit: null,
              amount: null,
              header_amount: null,
              amount_in_local: null,
              tax_code: "",
              dr_cr: chargeDefaultDrCr,
            },
          ]);
        }
      }
    } else {
      if (isFromAirExportJob && job && (job as { id?: number }).id != null) {
        form.setFieldValue("shipment_no", String((job as { id: number }).id));
      }
      form.setFieldValue("charges", [
        {
          charge_id: null,
          charge_name: "",
          unit_code: "",
          no_of_unit: null,
          currency: "",
          billing_currency: null,
          roe: null,
          amount_per_unit: null,
          amount: null,
          header_amount: null,
          amount_in_local: null,
          tax_code: "",
          dr_cr: chargeDefaultDrCr,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.key,
    location.state?.is_agent,
    invoiceUsesConsigneeParty,
    location.state?.job,
    location.state?.hawbDetails,
    location.state?.housingDetails,
    isFromAirExportJob,
  ]);

  // When opening invoice view screen from Accounts table (route has :id), fetch latest invoice details
  const { data: invoiceViewFetchRes, isFetching: invoiceViewFetchLoading } =
    useQuery({
      queryKey: [
        "invoice-view",
        invoiceId,
        isReverseInvoiceNavigation ? "reverse_invoice_id" : "invoice_id",
        location.key,
      ],
      enabled: Boolean(isEditOrViewMode && invoiceId && location.key),
      queryFn: async () => getAPICall(`${URL.invoice}${invoiceId}`, API_HEADER),
      staleTime: 5 * 60 * 1000,
      refetchOnMount: true,
      refetchOnReconnect: true,
    });

  useEffect(() => {
    if (!isEditOrViewMode || !invoiceId) return;
    const payload = invoiceViewFetchRes as any;
    const data = payload?.data?.data ?? payload?.data ?? payload;
    if (data && typeof data === "object") {
      setInvoiceDataFromApi(data as InvoiceDataFromApi);
    } else {
      setInvoiceDataFromApi(null);
    }
  }, [invoiceId, isEditOrViewMode, invoiceViewFetchRes]);

  // Populate form from invoice data when navigating from Accounts (edit/view)
  useEffect(() => {
    const invoiceData = (invoiceDataFromApi ??
      (location.state?.invoiceData as InvoiceDataFromApi | undefined)) as
      | InvoiceDataFromApi
      | undefined;
    if (!invoiceData || !isEditOrViewMode) return;

    const documentDate = normalizeDate(invoiceData.document_date ?? null);
    const dueDate = normalizeDate(invoiceData.due_date ?? null) ?? documentDate;

    setBillToDisplayName(invoiceData.bill_to_name ?? null);
    // Set saveResponse so Update Invoice is shown and PUT is used when editing
    setSaveResponse({
      id: invoiceData.id,
      customer_id: invoiceData.customer_id,
      document_no: invoiceData.document_no ?? "",
      status: invoiceData.status ?? "UNPOSTED",
    });
    const statusUpper = (invoiceData.status ?? "").toUpperCase();
    setInvoiceIsPosted(statusUpper === "POSTED");
    form.setValues({
      bill_to: invoiceData.bill_to ?? "",
      address: invoiceData.address ?? "",
      state: invoiceData.state_id != null ? String(invoiceData.state_id) : "",
      gstn: invoiceData.gstn ?? "",
      shipment_no: invoiceData.shipment_no ?? "",
      daybook_id:
        invoiceData.day_book_id != null
          ? String(invoiceData.day_book_id)
          : invoiceData.daybook_id != null
            ? String(invoiceData.daybook_id)
            : "",
      document_date: documentDate,
      due_date: dueDate,
      currency: invoiceData.currency_code ?? "",
      roe:
        invoiceData.roe != null
          ? typeof invoiceData.roe === "string"
            ? parseFloat(invoiceData.roe)
            : invoiceData.roe
          : null,
      narration: invoiceData.narration ?? "",
      irn_no: invoiceData.irn_no ?? "",
      fapiao_no: invoiceData.fapiao_no ?? "",
      charges:
        invoiceData.charges && invoiceData.charges.length > 0
          ? invoiceData.charges.map((c: any) => {
              const chargeCodeUpper = String(c.charge_code ?? "")
                .trim()
                .toUpperCase();
              const isTaxRow =
                chargeCodeUpper === "IGST" ||
                chargeCodeUpper === "CGST" ||
                chargeCodeUpper === "SGST";

              const parseNullableNumber = (v: unknown): number | null => {
                if (v == null || v === "") return null;
                const n = typeof v === "number" ? v : parseFloat(String(v));
                return Number.isFinite(n) ? n : null;
              };

              return {
                id: c.id != null ? Number(c.id) : null,
                charge_id: c.charge_id != null ? Number(c.charge_id) : null,
                charge_code: c.charge_code ?? "",
                charge_name: c.charge_name ?? "",
                shipment_id: c.shipment_id
                  ? String(c.shipment_id)
                  : c.shipment_no
                    ? String(c.shipment_no)
                    : "",
                shipper_id: c.shipper_id ?? "",
                unit_id:
                  c.unit_id != null && String(c.unit_id).trim() !== ""
                    ? String(c.unit_id)
                    : (() => {
                        const unitCode = String(c.unit_code ?? "").trim();
                        if (!unitCode) return "";
                        const opt = unitOptions.find(
                          (o) =>
                            String(o.value).trim().toUpperCase() ===
                              unitCode.toUpperCase() ||
                            String(o.label).trim().toUpperCase() ===
                              unitCode.toUpperCase(),
                        );
                        return opt?.value ?? "";
                      })(),
                unit_code: c.unit_code ?? "",
                no_of_unit:
                  c.no_of_unit != null
                    ? typeof c.no_of_unit === "string"
                      ? parseFloat(c.no_of_unit)
                      : c.no_of_unit
                    : null,
                currency_id:
                  c.currency_id != null && String(c.currency_id).trim() !== ""
                    ? String(c.currency_id)
                    : (() => {
                        const code = String(c.currency_code ?? "").trim();
                        if (!code) return "";
                        const opt = currencyOptions.find(
                          (o) =>
                            String(o.label).trim().toUpperCase() ===
                              code.toUpperCase() ||
                            String(o.value).trim().toUpperCase() ===
                              code.toUpperCase(),
                        );
                        return opt?.value ?? "";
                      })(),
                currency: c.currency_code ?? "",
                roe:
                  c.roe != null
                    ? typeof c.roe === "string"
                      ? parseFloat(c.roe)
                      : c.roe
                    : null,
                amount_per_unit:
                  c.amount_per_unit != null
                    ? typeof c.amount_per_unit === "string"
                      ? parseFloat(c.amount_per_unit)
                      : c.amount_per_unit
                    : null,
                amount:
                  c.amount != null
                    ? typeof c.amount === "string"
                      ? parseFloat(c.amount)
                      : c.amount
                    : null,
                header_amount:
                  c.amount_in_header != null
                    ? typeof c.amount_in_header === "string"
                      ? parseFloat(c.amount_in_header)
                      : c.amount_in_header
                    : null,
                amount_in_local:
                  c.amount_in_local != null
                    ? typeof c.amount_in_local === "string"
                      ? parseFloat(c.amount_in_local)
                      : c.amount_in_local
                    : null,
                tax_code: c.tax_code ?? "",
                dr_cr:
                  (c as any).dr_cr === "Dr" || (c as any).Dr_Cr === "Dr"
                    ? "Dr"
                    : chargeDefaultDrCr,
                is_tax_row: isTaxRow,
                igst_rate: parseNullableNumber(c.igst_rate),
                cgst_rate: parseNullableNumber(c.cgst_rate),
                sgst_rate: parseNullableNumber(c.sgst_rate),
              };
            })
          : form.values.charges.length > 0
            ? form.values.charges
            : [
                {
                  charge_id: null,
                  charge_name: "",
                  unit_code: "",
                  unit_id: "",
                  no_of_unit: null,
                  currency: "",
                  currency_id: "",
                  roe: null,
                  amount_per_unit: null,
                  amount: null,
                  header_amount: null,
                  amount_in_local: null,
                  tax_code: "",
                  dr_cr: chargeDefaultDrCr,
                },
              ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceDataFromApi, isEditOrViewMode]);

  // Fetch GST rates by State + SAC for each charge (used for IGST/CGST/SGST display)
  useEffect(() => {
    const stateId = form.values.state ? Number(form.values.state) : null;
    if (!stateId || Number.isNaN(stateId)) {
      // Clear loading states if no state is selected
      setGstRatesLoadingByIndex({});
      return;
    }

    const sacs = (form.values.charges || [])
      .map((c, idx) => ({
        idx,
        sac: String(c.tax_code || "").trim(),
        localAmount: c.amount_in_local,
        isTaxRow: c.is_tax_row === true,
      }))
      // For appended tax rows, we still want to *display* SAC code but must NOT fetch GST rates.
      .filter((x) => x.sac !== "" && !x.isTaxRow);

    if (sacs.length === 0) {
      // Clear loading states if no SAC codes are present
      setGstRatesLoadingByIndex({});
      return;
    }

    const fetchKey = JSON.stringify({
      stateId,
      sacs: sacs.map((s) => ({ sac: s.sac, localAmount: s.localAmount })),
    });
    if (fetchKey === lastGstRatesFetchKeyRef.current) return;
    lastGstRatesFetchKeyRef.current = fetchKey;

    let cancelled = false;

    // Set loading state only for indices that need fetching (not in cache and don't have rates yet)
    const indicesToFetch: number[] = [];
    sacs.forEach(({ idx, sac }) => {
      const cacheKey = `${stateId}:${sac}`;
      const hasCache = gstRatesCacheRef.current.has(cacheKey);
      const hasRates = gstRatesByChargeIndex[idx] != null;

      if (!hasCache && !hasRates) {
        indicesToFetch.push(idx);
      }
    });

    if (indicesToFetch.length > 0) {
      setGstRatesLoadingByIndex((prev) => {
        const next = { ...prev };
        indicesToFetch.forEach((idx) => {
          next[idx] = true;
        });
        return next;
      });
    }

    Promise.all(
      sacs.map(async ({ idx, sac }) => {
        const cacheKey = `${stateId}:${sac}`;
        const cached = gstRatesCacheRef.current.get(cacheKey);
        if (cached) return { idx, rates: cached, fromCache: true };

        try {
          const res = (await fetchGstRatesByStateSac({
            state_id: stateId,
            sac_code: sac,
          })) as any;
          const payload = res?.data?.data ?? res?.data ?? res;
          const data = payload as GstRatesBySacResponse | null | undefined;

          const igstRaw = data?.igst_percent;
          const cgstRaw = data?.cgst_percent;
          const sgstRaw = data?.sgst_percent;
          const sameState = data?.same_state ?? false;

          const rates: GstRates = {
            igst: igstRaw == null || igstRaw === "" ? null : Number(igstRaw),
            cgst: cgstRaw == null || cgstRaw === "" ? null : Number(cgstRaw),
            sgst: sgstRaw == null || sgstRaw === "" ? null : Number(sgstRaw),
            same_state: sameState,
          };

          gstRatesCacheRef.current.set(cacheKey, rates);
          return { idx, rates, fromCache: false };
        } catch {
          return { idx, rates: null, fromCache: false };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setGstRatesByChargeIndex((prev) => {
        const next = { ...prev };
        results.forEach(({ idx, rates }) => {
          next[idx] = rates;
        });
        return next;
      });
      // Clear loading state only for indices that were fetched (not from cache)
      const indicesToClear = results
        .filter((r) => !r.fromCache)
        .map((r) => r.idx);

      if (indicesToClear.length > 0) {
        setGstRatesLoadingByIndex((prev) => {
          const next = { ...prev };
          indicesToClear.forEach((idx) => {
            next[idx] = false;
          });
          return next;
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.state, form.values.charges]);

  // Ensure appended tax rows never carry GST rates (avoid stale cached rates causing display/calculation).
  useEffect(() => {
    const taxRowIndices = (form.values.charges || [])
      .map((c, idx) => (c.is_tax_row === true ? idx : -1))
      .filter((idx) => idx >= 0);

    if (taxRowIndices.length === 0) return;

    setGstRatesByChargeIndex((prev) => {
      const next = { ...prev };
      taxRowIndices.forEach((idx) => {
        next[idx] = null;
      });
      return next;
    });

    setGstRatesLoadingByIndex((prev) => {
      const next = { ...prev };
      taxRowIndices.forEach((idx) => {
        next[idx] = false;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.charges]);

  // Auto-calculate currency amount (amount) as: amount_per_unit * no_of_unit
  const chargeAmountPerUnits = form.values.charges
    .map((c) => c.amount_per_unit)
    .join(",");
  const chargeNoOfUnits = form.values.charges
    .map((c) => c.no_of_unit)
    .join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount_per_unit != null &&
        charge.amount_per_unit > 0 &&
        charge.no_of_unit != null &&
        charge.no_of_unit > 0
      ) {
        const calculatedAmount = charge.no_of_unit * charge.amount_per_unit;
        const clamped = clampAmount(calculatedAmount);
        if (clamped != null && clamped !== charge.amount) {
          return {
            ...charge,
            amount: clamped,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) => charge.amount !== form.values.charges[index]?.amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmountPerUnits, chargeNoOfUnits]);

  // Auto-calculate amount_in_local (Local Amount) as: amount (currency_amount) * charge.roe
  const chargeAmounts = form.values.charges.map((c) => c.amount).join(",");
  const chargeRoesForLocal = form.values.charges.map((c) => c.roe).join(",");

  useEffect(() => {
    const billingCurrency = (form.values.currency ?? "").trim().toUpperCase();
    const topRoe =
      form.values.roe != null && form.values.roe > 0
        ? Number(form.values.roe)
        : null;

    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount !== null &&
        charge.amount !== undefined &&
        charge.amount > 0 &&
        charge.roe !== null &&
        charge.roe !== undefined &&
        charge.roe > 0
      ) {
        const calculatedLocalAmount = charge.amount * charge.roe;
        const clamped = clampAmount(calculatedLocalAmount);
        if (
          clamped != null &&
          clamped > 0 &&
          clamped !== charge.amount_in_local
        ) {
          // When we recalc amount_in_local, also recalc header_amount so they stay in sync
          const chargeCurr = (charge.currency ?? "").trim().toUpperCase();
          const newHeaderAmount =
            billingCurrency && chargeCurr && billingCurrency === chargeCurr
              ? clamped
              : topRoe != null
                ? clampAmount(clamped / topRoe)
                : clamped;
          return {
            ...charge,
            amount_in_local: clamped,
            header_amount:
              newHeaderAmount != null ? newHeaderAmount : charge.header_amount,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.amount_in_local !==
          form.values.charges[index]?.amount_in_local ||
        charge.header_amount !== form.values.charges[index]?.header_amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmounts, chargeRoesForLocal]);

  // Auto-calculate header_amount:
  // - If invoice Billing Currency (top currency) matches charge currency → header_amount = amount_in_local
  // - If they differ → header_amount = amount_in_local / invoice-level ROE
  const headerBillingCurrency = form.values.currency;
  const headerRoe = form.values.roe;
  const chargeLocalAmounts = form.values.charges
    .map((c) => c.amount_in_local)
    .join(",");
  const chargeCurrenciesForHeader = form.values.charges
    .map((c) => c.currency)
    .join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount_in_local !== null &&
        charge.amount_in_local !== undefined &&
        charge.amount_in_local > 0 &&
        headerBillingCurrency &&
        charge.currency
      ) {
        let newHeaderAmount: number | null = null;

        if (
          headerBillingCurrency.toUpperCase() ===
          String(charge.currency).toUpperCase()
        ) {
          // Same currency → header amount equals local amount
          newHeaderAmount = charge.amount_in_local;
        } else if (
          headerRoe !== null &&
          headerRoe !== undefined &&
          headerRoe > 0
        ) {
          // Different currency → divide local amount by top-level ROE
          newHeaderAmount = charge.amount_in_local / headerRoe;
        }

        const clampedHeader = clampAmount(newHeaderAmount);
        if (
          clampedHeader !== null &&
          clampedHeader > 0 &&
          clampedHeader !== charge.header_amount
        ) {
          return {
            ...charge,
            header_amount: clampedHeader,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.header_amount !== form.values.charges[index]?.header_amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    headerBillingCurrency,
    headerRoe,
    chargeLocalAmounts,
    chargeCurrenciesForHeader,
  ]);

  // When Tax tab is active and we have invoice_id and customer_id from save response, fetch GST breakup
  useEffect(() => {
    // if (
    //   chargesTabActive !== "tax" ||
    //   !saveResponse?.id ||
    //   saveResponse?.customer_id == null
    // )
    if (chargesTabActive !== "tax" || !saveResponse?.id) {
      return;
    }
    let cancelled = false;
    setGstBreakupLoading(true);
    setGstBreakup(null);
    fetchInvoiceCalculateGstBreakup({
      customer_id: saveResponse.customer_id,
      invoice_id: saveResponse.id,
    })
      .then((data) => {
        if (!cancelled) setGstBreakup(data);
      })
      .catch(() => {
        if (!cancelled) setGstBreakup(null);
      })
      .finally(() => {
        if (!cancelled) setGstBreakupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chargesTabActive, saveResponse?.id, saveResponse?.customer_id]);

  // Bill To change: (1) When cleared → clear state and address. (2) When customer selected from search → set Bill To + State from customer response (addresses_data.state_id). (3) When from house page → shipper/state set on load (mount effect).
  const handleBillToChange = (
    value: string | null,
    selectedData?: { value: string; label: string } | null,
    originalData?: Record<string, unknown> | null,
  ) => {
    form.setFieldValue("bill_to", value ?? "");
    setBillToDisplayName(selectedData?.label ?? null);

    // When Bill To is removed/cleared, clear state, address and GSTN and stop
    const isCleared =
      value == null || (typeof value === "string" && value.trim() === "");
    if (isCleared) {
      setAddressOptions([]);
      form.setFieldValue("address", "");
      form.setFieldValue("state", "");
      form.setFieldValue("gstn", "");
      return;
    }

    // Customer selected from search: populate address options, state and GSTN from customer response (addresses_data)
    if (
      originalData &&
      (originalData as Record<string, unknown>).addresses_data
    ) {
      const addressesData = (originalData as Record<string, unknown>)
        .addresses_data as Array<{
        id: number;
        address: string;
        state_id?: number;
        address_type?: string | null;
        gst_id?: string | null;
      }>;
      const addressOptions = (addressesData || []).map((addr) => ({
        value: String(addr.id),
        label: addr.address,
      }));

      setAddressOptions(addressOptions);
      form.setFieldValue("address", "");

      // Prefer PRIMARY address for state and GSTN; if none, fall back to first address that has each field
      const primaryAddress = (addressesData || []).find(
        (a) => String(a.address_type || "").toUpperCase() === "PRIMARY",
      );

      const addrForState =
        primaryAddress || (addressesData || []).find((a) => a.state_id != null);
      if (addrForState?.state_id != null) {
        form.setFieldValue("state", String(addrForState.state_id));
      }

      const addrForGst =
        primaryAddress ||
        (addressesData || []).find(
          (a) => (a as { gst_id?: string | null }).gst_id != null,
        );
      const gstFromAddress = (
        addrForGst as { gst_id?: string | null } | undefined
      )?.gst_id;
      if (gstFromAddress) {
        form.setFieldValue("gstn", String(gstFromAddress));
      }
    } else {
      setAddressOptions([]);
      form.setFieldValue("address", "");
      // Do not clear state or GSTN here — they may have been set from house data
    }
  };

  // Handle form submission
  const handleSubmit = async (values: InvoiceFormData) => {
    console.log("values---", values);

    setIsSubmitting(true);
    try {
      // Validate charges
      // const invalidCharges = values.charges.some((charge) => {
      //   const hasMissingRequired =
      //     !charge.charge_name ||
      //     !charge.currency ||
      //     charge.roe === null ||
      //     charge.amount === null ||
      //     charge.amount_in_local === null ||
      //     !charge.tax_code;

      //   return hasMissingRequired;
      // });

      // if (invalidCharges) {
      //   ToastNotification({
      //     message: "Please fill all required fields in charges section",
      //     type: "error",
      //   });
      //   setIsSubmitting(false);
      //   return;
      // }

      const stateId = values.state ? Number(values.state) : null;
      const headerCurSave = (values.currency ?? "")
        .toString()
        .trim()
        .toUpperCase();
      const currencyItem = (currencyData as any[])?.find(
        (c: any) =>
          (c.code || c.currency_code || "").toString().trim().toUpperCase() ===
          headerCurSave,
      );
      const currencyId =
        currencyItem?.id != null ? Number(currencyItem.id) : null;

      const isAgentInvoiceFlow =
        (location.state as { is_agent?: boolean } | null)?.is_agent === true ||
        (invoiceDataFromApi as { is_agent?: boolean } | null)?.is_agent ===
          true;
      if (!isAgentInvoiceFlow && (!stateId || stateId <= 0)) {
        ToastNotification({
          message: "Please select a valid State",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }
      if (currencyId == null || currencyId <= 0) {
        ToastNotification({
          message: "Please select a valid Billing Currency",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }

      // Total = sum of header amount column; header_total = same (rounded to 2 dp for payload)
      const total = clampSumAmounts(
        values.charges.map((c) => c.header_amount ?? 0),
      );
      const header_total = total;
      const local_total = clampSumAmounts(
        values.charges.map((c) => c.amount_in_local ?? 0),
      );

      const formatDateDDMMYYYY = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };

      const isAgentSave =
        (location.state as { is_agent?: boolean } | null)?.is_agent === true ||
        (invoiceDataFromApi as { is_agent?: boolean } | null)?.is_agent ===
          true;

      // Agent invoice: no tax integration — skip GST endpoint, use zeros for tax fields
      // Customer invoice: resolve GST rates per charge (gst-rates-by-state-sac)
      const gstRatesForCharges: (GstRates | null)[] = isAgentSave
        ? values.charges.map(() => null)
        : await Promise.all(
            values.charges.map(async (charge, idx) => {
              const cached = gstRatesByChargeIndex[idx];
              if (cached) return cached;
              const sacCode = (charge.tax_code ?? "").trim();
              if (!sacCode || stateId == null || stateId <= 0) return null;
              try {
                const res = (await fetchGstRatesByStateSac({
                  state_id: stateId,
                  sac_code: sacCode,
                })) as unknown;
                const resObj = res as {
                  data?: { data?: GstRatesBySacResponse; [k: string]: unknown };
                  [k: string]: unknown;
                };
                const payload = resObj?.data?.data ?? resObj?.data ?? res;
                const gstData = payload as
                  | GstRatesBySacResponse
                  | null
                  | undefined;
                const igstRaw = gstData?.igst_percent;
                const cgstRaw = gstData?.cgst_percent;
                const sgstRaw = gstData?.sgst_percent;
                const sameState = gstData?.same_state ?? false;
                return {
                  igst:
                    igstRaw == null || igstRaw === "" ? null : Number(igstRaw),
                  cgst:
                    cgstRaw == null || cgstRaw === "" ? null : Number(cgstRaw),
                  sgst:
                    sgstRaw == null || sgstRaw === "" ? null : Number(sgstRaw),
                  same_state: sameState,
                };
              } catch {
                return null;
              }
            }),
          );

      const chargesPayload = values.charges.map((charge, idx) => {
        const currencyDataArr = currencyData as {
          id?: number;
          code?: string;
          currency_code?: string;
        }[];
        const chargeCurrencyItem = charge.currency_id
          ? currencyDataArr?.find(
              (c) => String(c.id) === String(charge.currency_id).trim(),
            )
          : currencyDataArr?.find(
              (c) =>
                (c.code || c.currency_code || "")
                  .toString()
                  .trim()
                  .toUpperCase() ===
                (charge.currency ?? "").toString().trim().toUpperCase(),
            );
        let chargeCurrencyId =
          chargeCurrencyItem?.id != null ? Number(chargeCurrencyItem.id) : null;
        const unitDataArr = unitData as {
          id?: number;
          unit_code?: string;
          code?: string;
        }[];
        const unitItem = charge.unit_id
          ? unitDataArr?.find((u) => String(u.id) === charge.unit_id)
          : unitDataArr?.find(
              (u) => String(u.unit_code || u.code || u.id) === charge.unit_code,
            );
        const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
        const headerAmount = clampAmount(charge.header_amount ?? 0) ?? 0;
        const rates = gstRatesForCharges[idx];
        const igstRate = rates?.igst ?? 0;
        const cgstRate = rates?.cgst ?? 0;
        const sgstRate = rates?.sgst ?? 0;
        const sameState = rates?.same_state ?? false;
        const igstAmt =
          !sameState && igstRate > 0
            ? clampAmount(headerAmount * (Number(igstRate) / 100))
            : 0;
        const cgstAmt =
          sameState && cgstRate > 0
            ? clampAmount(headerAmount * (Number(cgstRate) / 100))
            : 0;
        const sgstAmt =
          sameState && sgstRate > 0
            ? clampAmount(headerAmount * (Number(sgstRate) / 100))
            : 0;
        return {
          ...(charge.id != null && charge.id > 0 ? { id: charge.id } : {}),
          shipment_no:
            charge.shipment_id != null &&
            String(charge.shipment_id).trim() !== ""
              ? String(charge.shipment_id)
              : null,
          // : values.shipment_no,
          ...(charge.shipper_id ? { shipper_id: charge.shipper_id } : {}),
          charge_id: charge.charge_id ?? null,
          unit_id: unitId,
          no_of_unit: charge.no_of_unit ?? 0,
          currency_id: chargeCurrencyId,
          roe: charge.roe ?? 0,
          amount_per_unit: clampAmount(charge.amount_per_unit ?? 0) ?? 0,
          amount: clampAmount(charge.amount ?? 0) ?? 0,
          amount_in_local: clampAmount(charge.amount_in_local ?? 0) ?? 0,
          amount_in_header: headerAmount,
          tax_code: charge.tax_code ?? "",
          Dr_Cr: charge.dr_cr ?? "Cr",
          igst_rate: igstRate,
          cgst_rate: cgstRate,
          sgst_rate: sgstRate,
          igst: igstAmt,
          cgst: cgstAmt,
          sgst: sgstAmt,
        };
      });

      const isUpdate = saveResponse?.id != null && saveResponse.id > 0;
      const isAgent =
        (location.state as { is_agent?: boolean } | null)?.is_agent === true ||
        (invoiceDataFromApi as { is_agent?: boolean } | null)?.is_agent ===
          true;
      const job = (
        location.state as { job?: { job_id?: number; id?: number } } | null
      )?.job;
      const jobId =
        job && (job.job_id != null || job.id != null)
          ? (job.job_id ?? job.id)
          : undefined;
      const addressLabelForPayload =
        addressOptions.find((opt) => opt.value === values.address)?.label ??
        values.address;

      const payload = {
        ...(isUpdate ? { id: saveResponse.id } : {}),
        ...(jobId != null ? { job_id: jobId } : {}),
        bill_to: values.bill_to,
        address: addressLabelForPayload,
        state_id: isAgent
          ? stateId != null && stateId > 0
            ? stateId
            : null
          : stateId,
        gstn: values.gstn || null,
        shipment_no: values.shipment_no,
        daybook_id: values.daybook_id ? Number(values.daybook_id) : null,
        document_date: values.document_date
          ? formatDateDDMMYYYY(new Date(values.document_date))
          : null,
        due_date: values.due_date
          ? formatDateDDMMYYYY(new Date(values.due_date))
          : null,
        currency_id: currencyId,
        roe: values.roe,
        narration: values.narration || null,
        irn_no: values.irn_no || null,
        fapiao_no: values.fapiao_no || null,
        ...(isUpdate ? { status: "UNPOSTED" } : {}),
        total,
        header_total,
        local_total,
        Dr_Cr: baseDrCr,
        is_agent: isAgent,
        charges: chargesPayload,
      };
      console.log("payload---", payload);

      if (isUpdate) {
        const response = (await putAPICall(
          URL.invoice,
          payload,
          API_HEADER,
        )) as
          | {
              id?: number;
              customer_id?: number;
              document_no?: string;
              status?: string;
            }
          | undefined;
        if (response) {
          setSaveResponse((prev) => ({
            ...prev,
            id: response.id ?? prev?.id,
            customer_id: response.customer_id ?? prev?.customer_id,
            document_no: response.document_no ?? prev?.document_no ?? "",
            status: response.status ?? prev?.status ?? "UNPOSTED",
          }));
          // Merge returned charge ids into form (e.g. new charges created by this PUT)
          const res = response as { charges?: Array<{ id?: number }> };
          if (res.charges && Array.isArray(res.charges)) {
            const updatedCharges = form.values.charges.map((c, i) => {
              const chargeRes = res.charges?.[i];
              const id = chargeRes?.id;
              return {
                ...c,
                id: id != null ? Number(id) : c.id,
              };
            });
            form.setFieldValue("charges", updatedCharges);
          }
          ToastNotification({
            message: "Invoice updated successfully",
            type: "success",
          });
        }
      } else {
        const response = (await postAPICall(
          URL.invoice,
          payload,
          API_HEADER,
        )) as
          | {
              id?: number;
              customer_id?: number;
              document_no?: string;
              status?: string;
            }
          | undefined;
        if (response) {
          setSaveResponse({
            id: response.id,
            customer_id: response.customer_id,
            document_no: response.document_no ?? "",
            status: response.status ?? "UNPOSTED",
          });
          // Merge returned charge ids into form so Update (PUT) sends id for existing charges
          const res = response as { charges?: Array<{ id?: number }> };
          if (res.charges && Array.isArray(res.charges)) {
            const updatedCharges = form.values.charges.map((c, i) => {
              const chargeRes = res.charges?.[i];
              const id = chargeRes?.id;
              return {
                ...c,
                id: id != null ? Number(id) : c.id,
              };
            });
            form.setFieldValue("charges", updatedCharges);
          }
          ToastNotification({
            message: `${documentLabel} created successfully`,
            type: "success",
          });
        }
      }
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      ToastNotification({
        message: error?.message || "Failed to create invoice",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostInvoice = async () => {
    // if (!saveResponse?.id || saveResponse?.customer_id == null) {
    if (!saveResponse?.id) {
      ToastNotification({
        message: "Save the invoice first and ensure customer_id is available.",
        type: "error",
      });
      return;
    }
    setIsPosting(true);
    try {
      const values = form.values;
      const stateId = values.state ? Number(values.state) : null;
      const headerCur = (values.currency ?? "").toString().trim().toUpperCase();
      const currencyItem = (
        currencyData as { id?: number; code?: string; currency_code?: string }[]
      )?.find(
        (c) =>
          (c.code || c.currency_code || "").toString().trim().toUpperCase() ===
          headerCur,
      );
      const currencyId =
        currencyItem?.id != null ? Number(currencyItem.id) : null;
      const isAgentPost =
        (location.state as { is_agent?: boolean } | null)?.is_agent === true ||
        (invoiceDataFromApi as { is_agent?: boolean } | null)?.is_agent ===
          true;
      const stateValid = stateId != null && stateId > 0;
      if (
        (!isAgentPost && !stateValid) ||
        currencyId == null ||
        currencyId <= 0
      ) {
        ToastNotification({
          message: "Please ensure State and Currency are valid.",
          type: "error",
        });
        setIsPosting(false);
        return;
      }
      const formatDateDDMMYYYY = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };

      // Agent invoice: no tax integration — do not hit fetchInvoiceCalculateGstBreakup or gst-rates-by-state-sac
      let sacWiseTotals: Array<{
        sac_code?: string;
        charge_name?: string;
        charge_id?: number;
        total_amount?: number;
        rate?: number;
      }> = [];
      let taxes: Array<{ tax_code: string; rate: number; amount: number }> = [];
      if (!isAgentPost) {
        let breakupData = gstBreakup;
        if (!breakupData?.sac_wise_totals?.length) {
          breakupData = (await fetchInvoiceCalculateGstBreakup({
            customer_id: saveResponse.customer_id as number,
            invoice_id: saveResponse.id as number,
          })) as typeof gstBreakup;
        }
        sacWiseTotals = breakupData?.sac_wise_totals ?? [];
        taxes = sacWiseTotals
          .filter((row) => {
            const name = String(row.charge_name ?? "")
              .trim()
              .toUpperCase();
            const rate = Number(row.rate ?? 0);
            // If tax rate is 0%, do not send IGST/CGST/SGST in payload.
            if (
              (name === "IGST" || name === "CGST" || name === "SGST") &&
              rate <= 0
            )
              return false;
            return true;
          })
          .map((row) => ({
            tax_code: row.sac_code ?? "",
            rate: row.rate ?? 0,
            amount: clampAmount(row.total_amount ?? 0) ?? 0,
          }));
      }

      const topRoe =
        values.roe != null && values.roe > 0 ? Number(values.roe) : 1;
      const currencyDataArr = currencyData as {
        id?: number;
        code?: string;
        currency_code?: string;
      }[];
      const unitDataArr = unitData as {
        id?: number;
        unit_code?: string;
        code?: string;
      }[];

      // Agent invoice: no GST fetch — use null rates so charge tax amounts are zero
      const gstRatesForPostCharges: (GstRates | null)[] = isAgentPost
        ? values.charges.map(() => null)
        : await Promise.all(
            values.charges.map(async (charge, idx) => {
              const cached = gstRatesByChargeIndex[idx];
              if (cached) return cached;
              const sacCode = (charge.tax_code ?? "").trim();
              if (!sacCode || stateId == null || stateId <= 0) return null;
              try {
                const res = (await fetchGstRatesByStateSac({
                  state_id: stateId,
                  sac_code: sacCode,
                })) as unknown;
                const resObj = res as {
                  data?: { data?: GstRatesBySacResponse; [k: string]: unknown };
                  [k: string]: unknown;
                };
                const payload = resObj?.data?.data ?? resObj?.data ?? res;
                const gstData = payload as
                  | GstRatesBySacResponse
                  | null
                  | undefined;
                const igstRaw = gstData?.igst_percent;
                const cgstRaw = gstData?.cgst_percent;
                const sgstRaw = gstData?.sgst_percent;
                const sameState = gstData?.same_state ?? false;
                return {
                  igst:
                    igstRaw == null || igstRaw === "" ? null : Number(igstRaw),
                  cgst:
                    cgstRaw == null || cgstRaw === "" ? null : Number(cgstRaw),
                  sgst:
                    sgstRaw == null || sgstRaw === "" ? null : Number(sgstRaw),
                  same_state: sameState,
                };
              } catch {
                return null;
              }
            }),
          );
      const chargesPayload = values.charges.map((charge, idx) => {
        const chargeCurrencyItem = charge.currency_id
          ? currencyDataArr?.find(
              (c) => String(c.id) === String(charge.currency_id).trim(),
            )
          : currencyDataArr?.find(
              (c) =>
                (c.code || c.currency_code || "")
                  .toString()
                  .trim()
                  .toUpperCase() ===
                (charge.currency ?? "").toString().trim().toUpperCase(),
            );
        let chargeCurrencyId =
          chargeCurrencyItem?.id != null ? Number(chargeCurrencyItem.id) : null;
        const unitItem = charge.unit_id
          ? unitDataArr?.find((u) => String(u.id) === charge.unit_id)
          : unitDataArr?.find(
              (u) => String(u.unit_code || u.code || u.id) === charge.unit_code,
            );
        const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
        const headerAmount = clampAmount(charge.header_amount ?? 0) ?? 0;
        const rates = gstRatesForPostCharges[idx];
        const igstRate = rates?.igst ?? 0;
        const cgstRate = rates?.cgst ?? 0;
        const sgstRate = rates?.sgst ?? 0;
        const sameState = rates?.same_state ?? false;
        const igstAmt =
          !sameState && igstRate > 0
            ? clampAmount(headerAmount * (Number(igstRate) / 100))
            : 0;
        const cgstAmt =
          sameState && cgstRate > 0
            ? clampAmount(headerAmount * (Number(cgstRate) / 100))
            : 0;
        const sgstAmt =
          sameState && sgstRate > 0
            ? clampAmount(headerAmount * (Number(sgstRate) / 100))
            : 0;
        return {
          ...(charge.id != null && charge.id > 0 ? { id: charge.id } : {}),
          shipment_no:
            charge.shipment_id != null &&
            String(charge.shipment_id).trim() !== ""
              ? String(charge.shipment_id)
              : null,
          // : values.shipment_no,
          ...(charge.shipper_id ? { shipper_id: charge.shipper_id } : {}),
          charge_id: charge.charge_id ?? null,
          unit_id: unitId,
          no_of_unit: charge.no_of_unit ?? 0,
          currency_id: chargeCurrencyId,
          roe: charge.roe ?? 0,
          amount_per_unit: clampAmount(charge.amount_per_unit ?? 0) ?? 0,
          amount: clampAmount(charge.amount ?? 0) ?? 0,
          amount_in_local: clampAmount(charge.amount_in_local ?? 0) ?? 0,
          amount_in_header: headerAmount,
          tax_code: charge.tax_code ?? "",
          Dr_Cr: charge.dr_cr ?? "Cr",
          igst_rate: igstRate,
          cgst_rate: cgstRate,
          sgst_rate: sgstRate,
          igst: igstAmt,
          cgst: cgstAmt,
          sgst: sgstAmt,
        };
      });
      // Agent invoice: no tax charges in payload. Customer invoice: append tax rows from sac_wise_totals
      const taxCharges = isAgentPost
        ? []
        : sacWiseTotals
            .filter((row) => {
              const name = String(row.charge_name ?? "")
                .trim()
                .toUpperCase();
              const rate = Number(row.rate ?? 0);
              // If tax rate is 0%, do not include IGST/CGST/SGST rows in charge payload.
              if (
                (name === "IGST" || name === "CGST" || name === "SGST") &&
                rate <= 0
              )
                return false;
              return true;
            })
            .map((row) => {
              const amt = clampAmount(row.total_amount ?? 0) ?? 0;
              const amountInLocal = clampAmount(amt * topRoe) ?? 0;
              return {
                shipment_no: values.shipment_no,
                charge_id: row.charge_id ?? null,
                unit_id: null,
                no_of_unit: 0,
                currency_id: currencyId,
                roe: topRoe,
                amount_per_unit: 0,
                amount: amt,
                amount_in_local: amountInLocal,
                amount_in_header: amountInLocal,
                // This row is itself a tax amount entry. Keep SAC code visible, but do NOT fetch/calc GST.
                tax_code: row.sac_code ?? "",
                is_tax_row: true,
                igst_rate: null,
                cgst_rate: null,
                sgst_rate: null,
                igst: null,
                cgst: null,
                sgst: null,
                Dr_Cr: "Cr",
              };
            });
      const allChargesPayload = isAgentPost
        ? chargesPayload
        : [...chargesPayload, ...taxCharges];

      // Recompute totals from final charges payload (base charges + appended tax rows)
      const total = clampSumAmounts(
        allChargesPayload.map((c) => Number(c.amount_in_header) || 0),
      );
      const header_total = total;
      const local_total = clampSumAmounts(
        allChargesPayload.map((c) => Number(c.amount_in_local) || 0),
      );
      const jobForPost = (
        location.state as { job?: { job_id?: number; id?: number } } | null
      )?.job;
      const jobIdForPost =
        jobForPost && (jobForPost.job_id != null || jobForPost.id != null)
          ? (jobForPost.job_id ?? jobForPost.id)
          : undefined;
      const addressLabelForPayload =
        addressOptions.find((opt) => opt.value === values.address)?.label ??
        values.address;
      const payload = {
        id: saveResponse.id,
        ...(jobIdForPost != null ? { job_id: jobIdForPost } : {}),
        bill_to: values.bill_to,
        address: addressLabelForPayload,
        state_id: isAgentPost
          ? stateId != null && stateId > 0
            ? stateId
            : null
          : stateId,
        gstn: values.gstn || null,
        shipment_no: values.shipment_no,
        daybook_id: values.daybook_id ? Number(values.daybook_id) : null,
        document_date: values.document_date
          ? formatDateDDMMYYYY(new Date(values.document_date))
          : null,
        due_date: values.due_date
          ? formatDateDDMMYYYY(new Date(values.due_date))
          : null,
        currency_id: currencyId,
        roe: values.roe,
        narration: values.narration || null,
        irn_no: values.irn_no || null,
        fapiao_no: values.fapiao_no || null,
        status: "POSTED",
        total,
        header_total,
        local_total,
        Dr_Cr: baseDrCr,
        is_agent: isAgentPost,
        charges: allChargesPayload,
        taxes,
      };
      const response = (await putAPICall(URL.invoice, payload, API_HEADER)) as
        | {
            id?: number;
            customer_id?: number;
            document_no?: string;
            status?: string;
            charges?: Array<{
              id?: number;
              charge_id?: number;
              charge_name?: string;
              unit_code?: string | null;
              unit_id?: number | null;
              no_of_unit?: string | number;
              currency_code?: string;
              currency_id?: number;
              roe?: string | number;
              amount_per_unit?: string | number;
              amount?: string | number;
              amount_in_local?: string | number;
              amount_in_header?: string | number;
              tax_code?: string | null;
              tax_id?: number | null;
            }>;
          }
        | undefined;
      if (response) {
        setSaveResponse({
          id: response.id,
          customer_id: response.customer_id,
          document_no: response.document_no ?? "",
          status: response.status ?? "POSTED",
        });
        setInvoiceIsPosted(true);
        // After POST, display charges exactly as returned by API.
        if (response.charges && Array.isArray(response.charges)) {
          const mappedCharges: ChargeItem[] = response.charges.map((c) => {
            const noOfUnit =
              c.no_of_unit != null
                ? typeof c.no_of_unit === "string"
                  ? parseFloat(c.no_of_unit)
                  : c.no_of_unit
                : null;
            const roe =
              c.roe != null
                ? typeof c.roe === "string"
                  ? parseFloat(c.roe)
                  : c.roe
                : null;
            const amountPerUnit =
              c.amount_per_unit != null
                ? typeof c.amount_per_unit === "string"
                  ? parseFloat(c.amount_per_unit)
                  : c.amount_per_unit
                : null;
            const amount =
              c.amount != null
                ? typeof c.amount === "string"
                  ? parseFloat(c.amount)
                  : c.amount
                : null;
            const amountInLocal =
              c.amount_in_local != null
                ? typeof c.amount_in_local === "string"
                  ? parseFloat(c.amount_in_local)
                  : c.amount_in_local
                : null;
            const headerAmount =
              c.amount_in_header != null
                ? typeof c.amount_in_header === "string"
                  ? parseFloat(c.amount_in_header)
                  : c.amount_in_header
                : null;

            const chargeCodeUpper = String(
              (c as { charge_code?: string | null }).charge_code ?? "",
            )
              .trim()
              .toUpperCase();
            const isTaxRow =
              (c as { is_tax_row?: boolean | null }).is_tax_row === true ||
              chargeCodeUpper === "IGST" ||
              chargeCodeUpper === "CGST" ||
              chargeCodeUpper === "SGST" ||
              // Heuristic fallback for tax-only line items
              ((c.unit_id == null || String(c.unit_id).trim() === "") &&
                (noOfUnit == null || noOfUnit === 0) &&
                (amountPerUnit == null || amountPerUnit === 0) &&
                ((c as any).igst_rate == null ||
                  (c as any).cgst_rate == null ||
                  (c as any).sgst_rate == null));

            return {
              id: c.id ?? undefined,
              charge_id: c.charge_id ?? null,
              charge_name: c.charge_name ?? "",
              shipment_id: (c as { shipment_id?: string }).shipment_id
                ? String((c as { shipment_id: string }).shipment_id)
                : (c as { shipment_no?: string }).shipment_no
                  ? String((c as { shipment_no: string }).shipment_no)
                  : "",
              shipper_id: (c as { shipper_id?: string }).shipper_id ?? "",
              unit_code: c.unit_code ?? "",
              unit_id: c.unit_id != null ? String(c.unit_id) : undefined,
              no_of_unit: Number.isFinite(noOfUnit) ? noOfUnit : null,
              currency: c.currency_code ?? "",
              currency_id:
                c.currency_id != null ? String(c.currency_id) : undefined,
              roe: Number.isFinite(roe) ? roe : null,
              amount_per_unit: Number.isFinite(amountPerUnit)
                ? amountPerUnit
                : null,
              amount: Number.isFinite(amount) ? amount : null,
              header_amount: Number.isFinite(headerAmount)
                ? headerAmount
                : null,
              amount_in_local: Number.isFinite(amountInLocal)
                ? amountInLocal
                : null,
              tax_code:
                c.tax_code ?? (c.tax_id != null ? String(c.tax_id) : ""),
              dr_cr: (c as { Dr_Cr?: string }).Dr_Cr === "Dr" ? "Dr" : "Cr",
              is_tax_row: isTaxRow,
              igst_rate: (() => {
                const raw = (c as any).igst_rate;
                if (raw == null || raw === "") return null;
                const parsed =
                  typeof raw === "number" ? raw : parseFloat(String(raw));
                return Number.isFinite(parsed) ? parsed : null;
              })(),
              cgst_rate: (() => {
                const raw = (c as any).cgst_rate;
                if (raw == null || raw === "") return null;
                const parsed =
                  typeof raw === "number" ? raw : parseFloat(String(raw));
                return Number.isFinite(parsed) ? parsed : null;
              })(),
              sgst_rate: (() => {
                const raw = (c as any).sgst_rate;
                if (raw == null || raw === "") return null;
                const parsed =
                  typeof raw === "number" ? raw : parseFloat(String(raw));
                return Number.isFinite(parsed) ? parsed : null;
              })(),
            };
          });

          form.setFieldValue("charges", mappedCharges);
        }
        ToastNotification({
          message: "Invoice posted successfully",
          type: "success",
        });
      }
    } catch (error: unknown) {
      console.error("Error posting invoice:", error);
      ToastNotification({
        message:
          (error as { message?: string })?.message ?? "Failed to post invoice",
        type: "error",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleDraftInvoicePreview = async () => {
    if (!saveResponse?.id) return;
    setPreviewOpen(true);
    setPdfBlob(null);
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${URL.base}${URL.invoice}${saveResponse.id}/pdf/`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const pdfUrl = window.URL.createObjectURL(blob);
      setPdfBlob(pdfUrl);
    } catch (error) {
      console.error("Error fetching invoice PDF:", error);
      ToastNotification({
        type: "error",
        message: "Failed to load PDF preview",
      });
      setPreviewOpen(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
    setPdfBlob(null);
  };

  const handleDownloadPDF = () => {
    if (pdfBlob) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `Invoice-${saveResponse?.document_no || saveResponse?.id || "draft"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const headerSameState = (() => {
    const fromFetchedRates = Object.values(gstRatesByChargeIndex).find(
      (rates) => rates?.same_state !== undefined,
    )?.same_state;
    if (fromFetchedRates !== undefined) return fromFetchedRates;

    // Fallback for cases where rates haven't been fetched yet (or were skipped for tax rows):
    // infer intra/inter state from non-tax rows' returned rates (from POST response mapping).
    const nonTax = (form.values.charges || []).filter(
      (c) => c.is_tax_row !== true,
    );
    if (nonTax.some((c) => (c.cgst_rate ?? 0) > 0 || (c.sgst_rate ?? 0) > 0))
      return true;
    if (nonTax.some((c) => (c.igst_rate ?? 0) > 0)) return false;
    return undefined;
  })();

  return (
    <Box p="md" style={{ position: "relative" }}>
      {/* Full-page loader overlay when saving or posting */}
      {(isSubmitting || isPosting || invoiceViewFetchLoading) && (
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
              {invoiceViewFetchLoading
                ? `Loading ${resolvedDocumentLabel.toLowerCase()}...`
                : isPosting
                  ? `Posting ${resolvedDocumentLabel.toLowerCase()}...`
                  : `Saving ${resolvedDocumentLabel.toLowerCase()}...`}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        {/* Header: Title | document_no & status (after save) | Back */}
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text size="xl" fw={600} c="#105476">
            {pageTitle}
          </Text>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">
                    {saveResponse.status?.toUpperCase() === "POSTED"
                      ? `${resolvedDocumentLabel} Number`
                      : `Draft ${resolvedDocumentLabel} Number`}
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    color="#105476"
                    styles={{ root: { textTransform: "none" } }}
                  >
                    {saveResponse.document_no || "—"}
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
                      saveResponse.status?.toUpperCase() === "UNPOSTED"
                        ? "gray"
                        : saveResponse.status?.toUpperCase() === "POSTED"
                          ? "green"
                          : "#105476"
                    }
                    styles={{ root: { textTransform: "none" } }}
                  >
                    {saveResponse.status?.toUpperCase() || "—"}
                  </Badge>
                </Group>
              </Group>
            )}
            {saveResponse && (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="light" color="#105476" size="lg">
                    <IconDotsVertical size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconEye size={14} />}
                    onClick={handleDraftInvoicePreview}
                  >
                    {saveResponse?.status?.toUpperCase() === "POSTED"
                      ? pdfDocumentLabel
                      : `Draft ${pdfDocumentLabel}`}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
          </Group>
        </Group>

        {/* Form - when invoice is POSTED, apply disabled styling to entire form */}
        <Box
          component="form"
          onSubmit={
            isReadOnly ? (e) => e.preventDefault() : form.onSubmit(handleSubmit)
          }
          style={
            isReadOnly
              ? {
                  opacity: 0.92,
                  backgroundColor: "#f5f5f5",
                  borderRadius: 8,
                  padding: 16,
                }
              : undefined
          }
        >
          <Grid>
            {/* Row 1: 4 fields - Bill To (span 4 = 2 fields), State, GSTN, Shipment No */}
            {/* Bill To - spans 2 fields (span=4) */}
            <Grid.Col span={4}>
              <SearchableSelect
                key={`invoice-bill-to-${form.values.bill_to}:${billToDisplayName ?? "_"}`}
                label="Bill To"
                placeholder="Type customer name"
                apiEndpoint={URL.allCustomers}
                searchFields={["customer_name", "customer_code"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.customer_code),
                  label: String(item.customer_name),
                })}
                value={form.values.bill_to}
                displayValue={billToDisplayName || undefined}
                onChange={handleBillToChange}
                returnOriginalData={true}
                withAsterisk
                dropdownZIndex={1000}
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={
                  form.errors.bill_to ? String(form.errors.bill_to) : undefined
                }
              />
            </Grid.Col>

            {!isAgentInvoice && (
              <>
                <Grid.Col span={2}>
                  <Dropdown
                    label="State"
                    placeholder={
                      isStateLoading ? "Loading states" : "Select state"
                    }
                    data={stateOptions}
                    value={form.values.state ? form.values.state : null}
                    onChange={(value) =>
                      form.setFieldValue("state", value ?? "")
                    }
                    searchable
                    withAsterisk
                    error={form.errors.state || undefined}
                    readOnly={isStateLoading || isReadOnly}
                  />
                </Grid.Col>

                <Grid.Col span={2}>
                  <FormTextInput
                    label="GSTN"
                    placeholder="Enter GSTN"
                    value={form.values.gstn}
                    onChange={(e) => form.setFieldValue("gstn", e.target.value)}
                    error={form.errors.gstn}
                    readOnly={isReadOnly}
                  />
                </Grid.Col>
              </>
            )}

            {/* Shipment No / Job id - Job id when from Air Export Job */}
            <Grid.Col span={2}>
              <FormTextInput
                label={isFromAirExportJob ? "Job id" : "Shipment No"}
                placeholder={
                  isFromAirExportJob ? "Job id" : "Enter shipment number"
                }
                readOnly={isReadOnly}
                // disabled={isReadOnly}
                value={form.values.shipment_no}
                onChange={(e) =>
                  form.setFieldValue("shipment_no", e.target.value)
                }
                withAsterisk
                error={form.errors.shipment_no}
              />
            </Grid.Col>

            {/* Row 2: 5 fields - Daybook, Document Date, Due Date, Currency, ROE, IRN No */}
            {/* Daybook */}
            <Grid.Col span={2}>
              <Dropdown
                label="Daybook"
                placeholder="Select daybook"
                data={daybookOptions}
                value={form.values.daybook_id ? form.values.daybook_id : null}
                onChange={(value) =>
                  form.setFieldValue("daybook_id", value ?? "")
                }
                searchable
                withAsterisk
                error={form.errors.daybook_id}
                readOnly={isDaybookLoading || isReadOnly}
                // disabled={isDaybookLoading || isReadOnly}
              />
            </Grid.Col>
            {/* Document Date */}
            <Grid.Col span={2}>
              <SingleDateInput
                label="Document Date"
                placeholder="Select document date"
                value={normalizeDate(form.values.document_date)}
                onChange={(date) => {
                  form.setFieldValue("document_date", date);
                  form.setFieldValue("due_date", date);
                }}
                withAsterisk
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={
                  form.errors.document_date
                    ? typeof form.errors.document_date === "string"
                      ? form.errors.document_date
                      : String(form.errors.document_date)
                    : undefined
                }
              />
            </Grid.Col>

            {/* Due Date - same value/onChange pattern as Document Date */}
            <Grid.Col span={2}>
              <SingleDateInput
                label="Due Date"
                placeholder="Select due date"
                value={normalizeDate(form.values.due_date)}
                onChange={(date) => form.setFieldValue("due_date", date)}
                withAsterisk
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={
                  form.errors.due_date
                    ? typeof form.errors.due_date === "string"
                      ? form.errors.due_date
                      : String(form.errors.due_date)
                    : undefined
                }
              />
            </Grid.Col>

            {/* Currency - key forces re-mount so label stays in sync when set programmatically (e.g. agent invoice USD) */}
            <Grid.Col span={2}>
              <Dropdown
                key={`billing-currency-${form.values.currency}-${location.key}`}
                label="Billing Currency"
                placeholder="Select currency"
                data={billingCurrencyOptions}
                value={form.values.currency}
                onChange={(value) => {
                  const newCurrency = value || "";
                  // Recalculate header_amount for all charges when billing currency changes.
                  // When billing currency === charge currency (e.g. both INR), header_amount = amount_in_local.
                  const headerRoe = form.values.roe;
                  const updatedCharges = form.values.charges.map((charge) => {
                    if (
                      charge.amount_in_local != null &&
                      charge.amount_in_local > 0 &&
                      newCurrency
                    ) {
                      const chargeCurr = (charge.currency ?? "")
                        .trim()
                        .toUpperCase();
                      const billCurr = newCurrency.trim().toUpperCase();
                      let newHeader: number | null = null;
                      if (billCurr === chargeCurr) {
                        // Same currency (e.g. both INR): header amount = local amount
                        newHeader = charge.amount_in_local;
                      } else if (headerRoe != null && headerRoe > 0) {
                        newHeader = clampAmount(
                          charge.amount_in_local / headerRoe,
                        );
                      } else {
                        newHeader = charge.amount_in_local;
                      }
                      if (newHeader != null) {
                        return { ...charge, header_amount: newHeader };
                      }
                    }
                    return charge;
                  });
                  // Apply currency and charges in one update so header_amount is not lost
                  form.setValues({
                    ...form.values,
                    currency: newCurrency,
                    charges: updatedCharges,
                  });
                }}
                searchable
                withAsterisk
                error={
                  form.errors.currency
                    ? String(form.errors.currency)
                    : undefined
                }
                // disabled={isCurrencyLoading || isReadOnly}
                readOnly={isCurrencyLoading || isReadOnly}
              />
            </Grid.Col>

            {/* ROE */}
            <Grid.Col span={2}>
              <FormNumberInput
                label="ROE"
                placeholder="Enter rate of exchange"
                value={form.values.roe ?? undefined}
                decimalScale={2}
                onChange={(value) => {
                  const numValue =
                    typeof value === "number"
                      ? value
                      : typeof value === "string"
                        ? parseFloat(value) || null
                        : null;
                  form.setFieldValue("roe", numValue);
                  // Recalculate header_amount for all charges when header ROE changes
                  const headerBillingCurrency = (form.values.currency ?? "")
                    .trim()
                    .toUpperCase();
                  const updatedCharges = form.values.charges.map((charge) => {
                    if (
                      charge.amount_in_local != null &&
                      charge.amount_in_local > 0 &&
                      headerBillingCurrency
                    ) {
                      const chargeCurr = (charge.currency ?? "")
                        .trim()
                        .toUpperCase();
                      let newHeader: number | null = null;
                      if (headerBillingCurrency === chargeCurr) {
                        newHeader = charge.amount_in_local;
                      } else if (numValue != null && numValue > 0) {
                        newHeader = clampAmount(
                          charge.amount_in_local / numValue,
                        );
                      } else {
                        newHeader = charge.amount_in_local;
                      }
                      if (newHeader != null) {
                        return { ...charge, header_amount: newHeader };
                      }
                    }
                    return charge;
                  });
                  form.setFieldValue("charges", updatedCharges);
                }}
                withAsterisk
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                error={form.errors.roe ? String(form.errors.roe) : undefined}
                min={0}
                step={0.0001}
              />
            </Grid.Col>

            {/* IRN No */}
            <Grid.Col span={2}>
              <FormTextInput
                label="IRN No"
                placeholder="Enter IRN number"
                value={form.values.irn_no}
                onChange={(e) => form.setFieldValue("irn_no", e.target.value)}
                error={form.errors.irn_no}
                // disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </Grid.Col>

            {isChinaUser && (
              <Grid.Col span={2}>
                <FormTextInput
                  label="Fapiao No"
                  placeholder="Enter fapiao number"
                  value={form.values.fapiao_no}
                  onChange={(e) =>
                    form.setFieldValue("fapiao_no", e.target.value)
                  }
                  readOnly={false}
                />
              </Grid.Col>
            )}

            {/* Address - moved to end */}
            <Grid.Col span={6}>
              {addressOptions.length > 0 ? (
                <Dropdown
                  label="Address"
                  placeholder="Select address"
                  data={addressOptions}
                  value={form.values.address}
                  dropdownZIndex={1000}
                  onChange={(value) =>
                    form.setFieldValue("address", value || "")
                  }
                  searchable
                  withAsterisk
                  // disabled={isReadOnly}
                  readOnly={isReadOnly}
                  error={
                    form.errors.address
                      ? String(form.errors.address)
                      : undefined
                  }
                />
              ) : (
                <FormTextInput
                  label="Address"
                  placeholder="Enter address"
                  value={form.values.address}
                  onChange={(e) =>
                    form.setFieldValue("address", e.target.value)
                  }
                  withAsterisk
                  // disabled={isReadOnly}
                  readOnly={isReadOnly}
                  error={
                    form.errors.address
                      ? String(form.errors.address)
                      : undefined
                  }
                />
              )}
            </Grid.Col>

            {/* Narration - moved to end */}
            <Grid.Col span={6}>
              <FormTextArea
                label="Narration"
                placeholder="Enter narration"
                value={form.values.narration}
                onChange={(e) =>
                  form.setFieldValue("narration", e.target.value)
                }
                error={form.errors.narration}
                // disabled={isReadOnly}
                readOnly={isReadOnly}
                rows={2}
              />
            </Grid.Col>
          </Grid>

          {/* Charges Section: show Tabs (Charges / Tax) only when document_no and status are displayed (after save) */}
          <Box mt="md">
            <Tabs
              variant="default"
              color={"#105476"}
              value={chargesTabActive}
              onChange={(v) => setChargesTabActive(v ?? "charges")}
              defaultValue="charges"
            >
              {saveResponse && !isAgentInvoice && (
                <Tabs.List>
                  <Tabs.Tab value="charges">Charges</Tabs.Tab>
                  <Tabs.Tab value="tax">Tax</Tabs.Tab>
                </Tabs.List>
              )}

              <Tabs.Panel value="charges">
                {/* Dynamic Charges Rows */}
                {/* <Box mb="sm" mt="md"> */}
                <Grid
                  w="100%"
                  // gutter="sm"
                  py="sm"
                  style={{
                    position: "sticky",
                    top: 45,
                    zIndex: 100,
                    backgroundColor: "white",
                    fontWeight: 600,
                    color: "#105476",
                  }}
                >
                  {showShipmentIdInCharges && (
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Shipment id
                    </Grid.Col>
                  )}
                  <Grid.Col
                    span={showShipmentIdInCharges ? 1.3 : 1.5}
                    style={{ fontSize: "13px" }}
                  >
                    Charge
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Unit
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Currency
                  </Grid.Col>
                  <Grid.Col span={0.45} style={{ fontSize: "13px" }}>
                    ROE
                  </Grid.Col>
                  <Grid.Col span={0.65} style={{ fontSize: "13px" }}>
                    No of Unit
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Amount per Unit
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Currency Amount
                  </Grid.Col>
                  <Grid.Col span={1} style={{ fontSize: "13px" }}>
                    Amount in{" "}
                    {form.values.currency
                      ? form.values.currency.toUpperCase()
                      : "()"}
                  </Grid.Col>
                  <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                    Local Amount
                  </Grid.Col>
                  {!isAgentInvoice && (
                    <Grid.Col span={0.8} style={{ fontSize: "13px" }}>
                      SAC Code
                    </Grid.Col>
                  )}
                  <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                    Dr/Cr
                  </Grid.Col>
                  {!isAgentInvoice && headerSameState === true && (
                    <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                      CGST
                    </Grid.Col>
                  )}
                  {!isAgentInvoice && headerSameState === true && (
                    <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                      SGST
                    </Grid.Col>
                  )}
                  {!isAgentInvoice && headerSameState === false && (
                    <Grid.Col span={0.55} style={{ fontSize: "13px" }}>
                      IGST
                    </Grid.Col>
                  )}
                  {!isReadOnly && (
                    <Grid.Col span={0.5} style={{ fontSize: "13px" }}>
                      Actions
                    </Grid.Col>
                  )}
                </Grid>

                {form.values.charges.map((charge, index) => (
                  <Grid
                    key={index}
                    w="100%"
                    gutter="xs"
                    mt={index !== 0 ? "sm" : 0}
                  >
                    {showShipmentIdInCharges && (
                      <Grid.Col span={1}>
                        <FormTextInput
                          value={charge.shipment_id ?? ""}
                          readOnly
                          styles={{
                            input: {
                              backgroundColor: "var(--mantine-color-gray-0)",
                            },
                          }}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={showShipmentIdInCharges ? 1.3 : 1.5}>
                      <SearchableSelect
                        placeholder="Type charge name"
                        apiEndpoint={URL.chargeMaster}
                        searchFields={["charge_name", "charge_code"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.id ?? ""),
                          label: String(item.charge_name ?? ""),
                        })}
                        value={
                          charge.charge_id != null
                            ? String(charge.charge_id)
                            : null
                        }
                        displayValue={charge.charge_name || undefined}
                        onChange={(value, selectedData) => {
                          const chargeId = value ? Number(value) : null;
                          const chargeName = selectedData?.label ?? "";
                          form.setFieldValue(
                            `charges.${index}.charge_id`,
                            chargeId,
                          );
                          form.setFieldValue(
                            `charges.${index}.charge_name`,
                            chargeName,
                          );
                          form.setFieldValue(`charges.${index}.tax_code`, "");
                          if (chargeErrors[index]?.charge_name) {
                            const newErrors = { ...chargeErrors };
                            if (newErrors[index]) {
                              delete newErrors[index].charge_name;
                              if (Object.keys(newErrors[index]).length === 0) {
                                delete newErrors[index];
                              }
                            }
                            setChargeErrors(newErrors);
                          }
                          // Fetch effective SAC (tax code) when charge and service_id are set
                          if (chargeId != null && jobServiceId != null) {
                            fetchGetEffectiveSac([
                              {
                                charge_id: chargeId,
                                service_id: jobServiceId,
                              },
                            ]).then((data) => {
                              // Since we're sending only one item, response will have one item at index 0
                              const item = data[0];
                              if (
                                item?.sac_code != null &&
                                item.sac_code !== ""
                              ) {
                                form.setFieldValue(
                                  `charges.${index}.tax_code`,
                                  item.sac_code,
                                );
                              }
                            });
                          }
                        }}
                        withAsterisk
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        error={chargeErrors[index]?.charge_name}
                        minSearchLength={2}
                        dropdownZIndex={1000}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="Select Unit"
                        searchable
                        data={unitOptions}
                        value={charge.unit_id || charge.unit_code || null}
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        onChange={(value) => {
                          const v = value ?? "";
                          form.setFieldValue(`charges.${index}.unit_id`, v);
                          const opt = unitOptions.find((o) => o.value === v);
                          form.setFieldValue(
                            `charges.${index}.unit_code`,
                            opt ? String(opt.label || opt.value) : v,
                          );
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="Select Currency"
                        withAsterisk
                        searchable
                        data={currencyOptions}
                        value={charge.currency_id || charge.currency || null}
                        readOnly={isReadOnly}
                        // disabled={isReadOnly}
                        onChange={(value) => {
                          const v = value ?? "";
                          form.setFieldValue(`charges.${index}.currency_id`, v);
                          const opt = currencyOptions.find(
                            (o) => o.value === v,
                          );
                          const code = opt ? (opt.label ?? opt.value) : v;
                          form.setFieldValue(`charges.${index}.currency`, code);
                          const newRoe = code ? getRoeValue(code) : null;
                          if (newRoe !== null) {
                            form.setFieldValue(`charges.${index}.roe`, newRoe);
                          }
                          const currentCharge = form.values.charges[index];
                          const amt = currentCharge.amount;
                          if (
                            amt != null &&
                            amt > 0 &&
                            newRoe != null &&
                            newRoe > 0
                          ) {
                            const local = clampAmount(amt * newRoe);
                            if (local != null)
                              form.setFieldValue(
                                `charges.${index}.amount_in_local`,
                                local,
                              );
                            const billingCurr = (form.values.currency ?? "")
                              .trim()
                              .toUpperCase();
                            const chargeCurr = (code ?? "")
                              .trim()
                              .toUpperCase();
                            const headerRoe = form.values.roe;
                            if (local != null && billingCurr && chargeCurr) {
                              const headerAmt =
                                billingCurr === chargeCurr
                                  ? local
                                  : headerRoe != null && headerRoe > 0
                                    ? clampAmount(local / headerRoe)
                                    : local;
                              if (headerAmt != null)
                                form.setFieldValue(
                                  `charges.${index}.header_amount`,
                                  headerAmt,
                                );
                            }
                          }
                          // Clear error when field is updated
                          if (chargeErrors[index]?.currency) {
                            const newErrors = { ...chargeErrors };
                            if (newErrors[index]) {
                              delete newErrors[index].currency;
                              if (Object.keys(newErrors[index]).length === 0) {
                                delete newErrors[index];
                              }
                            }
                            setChargeErrors(newErrors);
                          }
                        }}
                        error={chargeErrors[index]?.currency}
                      />

                      {/* <Group
                           gap={4}
                           align="center"
                           wrap="nowrap"
                           style={{
                            width: "100%",
                            flexDirection: "row",
                            flexWrap: "nowrap",
                            alignItems: "center",
                           }}
                         >
            
                         <Button
                              mt={4}
                              size="xs"
                              variant="light"
                              color="#105476"
                              disabled={isReadOnly}
                              onClick={async () => {
                              const stateId = form.values.state ? Number(form.values.state) : null;
                              const sacCode = charge.tax_code?.trim();
                              
                              if (!stateId || !sacCode) {
                                ToastNotification({
                                  message: "Please ensure State and SAC Code are filled",
                                  type: "error",
                                });
                                return;
                              }

                              try {
                                const res = (await fetchGstRatesByStateSac({
                                  state_id: stateId,
                                  sac_code: sacCode,
                                })) as any;
                                const payload = res?.data?.data ?? res?.data ?? res;
                                const data = payload as GstRatesBySacResponse | null | undefined;

                                const igstRaw = data?.igst_percent;
                                const cgstRaw = data?.cgst_percent;
                                const sgstRaw = data?.sgst_percent;
                                const sameState = data?.same_state ?? false;

                                const rates: GstRates = {
                                  igst: igstRaw == null || igstRaw === "" ? null : Number(igstRaw),
                                  cgst: cgstRaw == null || cgstRaw === "" ? null : Number(cgstRaw),
                                  sgst: sgstRaw == null || sgstRaw === "" ? null : Number(sgstRaw),
                                  same_state: sameState,
                                };

                                // Cache the result
                                const cacheKey = `${stateId}:${sacCode}`;
                                gstRatesCacheRef.current.set(cacheKey, rates);

                                // Update the rates for this index
                                setGstRatesByChargeIndex((prev) => ({
                                  ...prev,
                                  [index]: rates,
                                }));

                                ToastNotification({
                                  message: "GST rates fetched successfully",
                                  type: "success",
                                });
                              } catch (error) {
                                console.error("Error fetching GST rates:", error);
                                ToastNotification({
                                  message: "Failed to fetch GST rates",
                                  type: "error",
                                });
                                setGstRatesByChargeIndex((prev) => ({
                                  ...prev,
                                  [index]: null,
                                }));
                              }
                            }}
                            styles={{
                              root: {
                                height: "28px",
                                minHeight: "28px",
                                padding: "0 6px",
                                flexShrink: 0,
                              },
                            }}
                          >
                            GST Rates
                          </Button>
                         </Group> */}
                    </Grid.Col>
                    <Grid.Col span={0.45}>
                      <FormNumberInput
                        placeholder="ROE"
                        min={0}
                        hideControls
                        withAsterisk
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        value={charge.roe || undefined}
                        onChange={(value) => {
                          const roe = value as number | null;
                          const currentCharge = form.values.charges[index];
                          let amount = currentCharge.amount;
                          let amountInLocal = currentCharge.amount_in_local;
                          let headerAmt = currentCharge.header_amount;

                          // Auto-calculate amount = amount_per_unit * no_of_unit
                          if (
                            currentCharge.amount_per_unit != null &&
                            currentCharge.amount_per_unit > 0 &&
                            currentCharge.no_of_unit != null &&
                            currentCharge.no_of_unit > 0
                          ) {
                            amount = clampAmount(
                              currentCharge.no_of_unit *
                                currentCharge.amount_per_unit,
                            );
                          }
                          // Auto-calculate Local Amount = amount * roe, and header amount (same as local when billing === charge currency)
                          if (
                            amount != null &&
                            amount > 0 &&
                            roe != null &&
                            roe > 0
                          ) {
                            amountInLocal = clampAmount(amount * roe);
                            const billingCurr = (form.values.currency ?? "")
                              .trim()
                              .toUpperCase();
                            const chargeCurr = (currentCharge.currency ?? "")
                              .trim()
                              .toUpperCase();
                            const headerRoe = form.values.roe;
                            headerAmt =
                              billingCurr === chargeCurr &&
                              amountInLocal != null
                                ? amountInLocal
                                : headerRoe != null &&
                                    headerRoe > 0 &&
                                    amountInLocal != null
                                  ? clampAmount(amountInLocal / headerRoe)
                                  : amountInLocal;
                          }

                          const updatedCharges = form.values.charges.map(
                            (c, i) =>
                              i !== index
                                ? c
                                : {
                                    ...c,
                                    roe,
                                    amount,
                                    amount_in_local: amountInLocal,
                                    header_amount: headerAmt,
                                  },
                          );
                          form.setFieldValue("charges", updatedCharges);

                          if (chargeErrors[index]?.roe) {
                            const newErrors = { ...chargeErrors };
                            if (newErrors[index]) {
                              delete newErrors[index].roe;
                              if (Object.keys(newErrors[index]).length === 0)
                                delete newErrors[index];
                            }
                            setChargeErrors(newErrors);
                          }
                        }}
                        error={chargeErrors[index]?.roe}
                      />
                    </Grid.Col>
                    <Grid.Col span={0.65}>
                      <FormNumberInput
                        placeholder="No of Unit"
                        min={0}
                        hideControls
                        // disabled={isReadOnly}
                        allowDecimal={false}
                        readOnly={isReadOnly}
                        value={charge.no_of_unit || undefined}
                        onChange={(value) => {
                          const noOfUnit = value as number | null;
                          const currentCharge = form.values.charges[index];
                          let amount = currentCharge.amount;
                          let amountInLocal = currentCharge.amount_in_local;
                          let headerAmt = currentCharge.header_amount;

                          if (
                            currentCharge.amount_per_unit != null &&
                            currentCharge.amount_per_unit > 0 &&
                            noOfUnit != null &&
                            noOfUnit > 0
                          ) {
                            amount = clampAmount(
                              noOfUnit * currentCharge.amount_per_unit,
                            );
                            const roeVal = currentCharge.roe;
                            if (
                              amount != null &&
                              amount > 0 &&
                              roeVal != null &&
                              roeVal > 0
                            ) {
                              amountInLocal = clampAmount(amount * roeVal);
                              const billingCurr = (form.values.currency ?? "")
                                .trim()
                                .toUpperCase();
                              const chargeCurr = (currentCharge.currency ?? "")
                                .trim()
                                .toUpperCase();
                              const headerRoe = form.values.roe;
                              headerAmt =
                                billingCurr === chargeCurr &&
                                amountInLocal != null
                                  ? amountInLocal
                                  : headerRoe != null &&
                                      headerRoe > 0 &&
                                      amountInLocal != null
                                    ? clampAmount(amountInLocal / headerRoe)
                                    : amountInLocal;
                            }
                          }

                          const updatedCharges = form.values.charges.map(
                            (c, i) =>
                              i !== index
                                ? c
                                : {
                                    ...c,
                                    no_of_unit: noOfUnit,
                                    amount,
                                    amount_in_local: amountInLocal,
                                    header_amount: headerAmt,
                                  },
                          );
                          form.setFieldValue("charges", updatedCharges);
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <FormNumberInput
                        placeholder="Per Unit"
                        min={0}
                        hideControls
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        value={charge.amount_per_unit || undefined}
                        onChange={(value) => {
                          const amountPerUnit = clampAmount(
                            value as number | null,
                          );
                          const currentCharge = form.values.charges[index];
                          let amount = currentCharge.amount;
                          let amountInLocal = currentCharge.amount_in_local;
                          let headerAmt = currentCharge.header_amount;

                          if (
                            amountPerUnit != null &&
                            amountPerUnit > 0 &&
                            currentCharge.no_of_unit != null &&
                            currentCharge.no_of_unit > 0
                          ) {
                            amount = clampAmount(
                              currentCharge.no_of_unit * amountPerUnit,
                            );
                            const roeVal = currentCharge.roe;
                            if (
                              amount != null &&
                              amount > 0 &&
                              roeVal != null &&
                              roeVal > 0
                            ) {
                              amountInLocal = clampAmount(amount * roeVal);
                              const billingCurr = (form.values.currency ?? "")
                                .trim()
                                .toUpperCase();
                              const chargeCurr = (currentCharge.currency ?? "")
                                .trim()
                                .toUpperCase();
                              const headerRoe = form.values.roe;
                              headerAmt =
                                billingCurr === chargeCurr &&
                                amountInLocal != null
                                  ? amountInLocal
                                  : headerRoe != null &&
                                      headerRoe > 0 &&
                                      amountInLocal != null
                                    ? clampAmount(amountInLocal / headerRoe)
                                    : amountInLocal;
                            }
                          }

                          const updatedCharges = form.values.charges.map(
                            (c, i) =>
                              i !== index
                                ? c
                                : {
                                    ...c,
                                    amount_per_unit: amountPerUnit,
                                    amount,
                                    amount_in_local: amountInLocal,
                                    header_amount: headerAmt,
                                  },
                          );
                          form.setFieldValue("charges", updatedCharges);
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <FormNumberInput
                        placeholder="Currency Amount"
                        min={0}
                        hideControls
                        withAsterisk
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        value={charge.amount || undefined}
                        onChange={(value) => {
                          const currencyAmount = clampAmount(
                            value as number | null,
                          );
                          const currentCharge = form.values.charges[index];
                          let amountInLocal = currentCharge.amount_in_local;
                          let headerAmt = currentCharge.header_amount;

                          if (
                            currencyAmount != null &&
                            currencyAmount > 0 &&
                            currentCharge.roe != null &&
                            currentCharge.roe > 0
                          ) {
                            amountInLocal = clampAmount(
                              currencyAmount * currentCharge.roe,
                            );
                            const billingCurr = (form.values.currency ?? "")
                              .trim()
                              .toUpperCase();
                            const chargeCurr = (currentCharge.currency ?? "")
                              .trim()
                              .toUpperCase();
                            const headerRoe = form.values.roe;
                            headerAmt =
                              billingCurr === chargeCurr &&
                              amountInLocal != null
                                ? amountInLocal
                                : headerRoe != null &&
                                    headerRoe > 0 &&
                                    amountInLocal != null
                                  ? clampAmount(amountInLocal / headerRoe)
                                  : amountInLocal;
                          }

                          const updatedCharges = form.values.charges.map(
                            (c, i) =>
                              i !== index
                                ? c
                                : {
                                    ...c,
                                    amount: currencyAmount,
                                    amount_in_local: amountInLocal,
                                    header_amount: headerAmt,
                                  },
                          );
                          form.setFieldValue("charges", updatedCharges);

                          if (chargeErrors[index]?.amount) {
                            const newErrors = { ...chargeErrors };
                            if (newErrors[index]) {
                              delete newErrors[index].amount;
                              if (Object.keys(newErrors[index]).length === 0)
                                delete newErrors[index];
                            }
                            setChargeErrors(newErrors);
                          }
                        }}
                        error={chargeErrors[index]?.amount}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <FormNumberInput
                        placeholder={`Amount in ${form.values.currency ? form.values.currency.toUpperCase() : "(billing currency)"}`}
                        min={0}
                        hideControls
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        value={charge.header_amount || undefined}
                        onChange={(value) => {
                          form.setFieldValue(
                            `charges.${index}.header_amount`,
                            clampAmount(value as number | null),
                          );
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={0.8}>
                      <FormNumberInput
                        placeholder="Local Amount"
                        min={0}
                        hideControls
                        withAsterisk
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        value={charge.amount_in_local || undefined}
                        onChange={(value) => {
                          const clampedLocal = clampAmount(
                            value as number | null,
                          );
                          const billingCurr = (form.values.currency ?? "")
                            .trim()
                            .toUpperCase();
                          const chargeCurr = (charge.currency ?? "")
                            .trim()
                            .toUpperCase();
                          const sameCurrency =
                            billingCurr === chargeCurr && billingCurr !== "";
                          // Single atomic update: set amount_in_local and header_amount together when same currency
                          const currentCharges = form.values.charges;
                          const updatedCharges = currentCharges.map((c, i) => {
                            if (i !== index) return c;
                            return {
                              ...c,
                              amount_in_local: clampedLocal,
                              header_amount:
                                sameCurrency && clampedLocal != null
                                  ? clampedLocal
                                  : c.header_amount,
                            };
                          });
                          form.setFieldValue("charges", updatedCharges);
                        }}
                      />
                    </Grid.Col>
                    {!isAgentInvoice && (
                      <Grid.Col span={0.8}>
                        <FormTextInput
                          placeholder="SAC Code"
                          withAsterisk
                          // disabled={isReadOnly}
                          readOnly={isReadOnly}
                          value={charge.tax_code}
                          rightSection={
                            gstRatesLoadingByIndex[index] &&
                            (!charge.tax_code ||
                              charge.tax_code.trim() === "") ? (
                              <Loader size="xs" color="#105476" />
                            ) : null
                          }
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                          }}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={0.55}>
                      <Dropdown
                        placeholder="Dr/Cr"
                        data={[
                          { value: "Cr", label: "Cr" },
                          { value: "Dr", label: "Dr" },
                        ]}
                        value={charge.dr_cr ?? chargeDefaultDrCr}
                        // disabled={isReadOnly}
                        readOnly={isReadOnly}
                        onChange={(value) =>
                          form.setFieldValue(
                            `charges.${index}.dr_cr`,
                            (value === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr",
                          )
                        }
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                        }}
                      />
                    </Grid.Col>
                    {/* {gstRatesByChargeIndex[index]?.same_state === true && ( */}
                    {!isAgentInvoice && headerSameState === true && (
                      <Grid.Col span={0.55}>
                        {/* {gstRatesByChargeIndex[index]?.same_state === true && ( */}
                        <FormTextInput
                          placeholder="CGST"
                          value={(() => {
                            const code = String(charge.charge_code ?? "")
                              .trim()
                              .toUpperCase();
                            if (
                              charge.is_tax_row === true ||
                              code === "IGST" ||
                              code === "CGST" ||
                              code === "SGST"
                            )
                              return "";
                            const rate = gstRatesByChargeIndex[index]?.cgst;
                            const localAmount = charge.amount_in_local;
                            if (rate == null || localAmount == null) return "";
                            const amount = clampAmount(
                              (localAmount * rate) / 100,
                            );
                            return amount != null ? String(amount) : "";
                          })()}
                          readOnly
                          // disabled
                          rightSection={(() => {
                            const rate = gstRatesByChargeIndex[index]?.cgst;
                            const localAmount = charge.amount_in_local;
                            const amount =
                              rate == null || localAmount == null
                                ? null
                                : clampAmount((localAmount * rate) / 100);
                            const display =
                              amount != null ? String(amount) : "";
                            return gstRatesLoadingByIndex[index] &&
                              display === "" ? (
                              <Loader size="xs" color="#105476" />
                            ) : null;
                          })()}
                          styles={{
                            root: { flex: "0 0 88px" },
                            input: {
                              fontSize: "11px",
                              fontFamily: "Inter",
                              height: "28px",
                            },
                          }}
                        />
                        {/* )} */}
                      </Grid.Col>
                    )}
                    {!isAgentInvoice && headerSameState === true && (
                      <Grid.Col span={0.55}>
                        {/* {gstRatesByChargeIndex[index]?.same_state === true && ( */}
                        <FormTextInput
                          placeholder="SGST"
                          value={(() => {
                            const code = String(charge.charge_code ?? "")
                              .trim()
                              .toUpperCase();
                            if (
                              charge.is_tax_row === true ||
                              code === "IGST" ||
                              code === "CGST" ||
                              code === "SGST"
                            )
                              return "";
                            const rate = gstRatesByChargeIndex[index]?.sgst;
                            const localAmount = charge.amount_in_local;
                            if (rate == null || localAmount == null) return "";
                            const amount = clampAmount(
                              (localAmount * rate) / 100,
                            );
                            return amount != null ? String(amount) : "";
                          })()}
                          // disabled
                          readOnly
                          rightSection={(() => {
                            const rate = gstRatesByChargeIndex[index]?.sgst;
                            const localAmount = charge.amount_in_local;
                            const amount =
                              rate == null || localAmount == null
                                ? null
                                : clampAmount((localAmount * rate) / 100);
                            const display =
                              amount != null ? String(amount) : "";
                            return gstRatesLoadingByIndex[index] &&
                              display === "" ? (
                              <Loader size="xs" color="#105476" />
                            ) : null;
                          })()}
                          styles={{
                            root: { flex: "0 0 88px" },
                            input: {
                              fontSize: "11px",
                              fontFamily: "Inter",
                              height: "28px",
                            },
                          }}
                        />

                        {/* )} */}
                      </Grid.Col>
                    )}
                    {!isAgentInvoice && headerSameState === false && (
                      <Grid.Col span={0.55}>
                        {/* {gstRatesByChargeIndex[index]?.same_state === false && ( */}
                        <FormTextInput
                          placeholder="IGST"
                          value={(() => {
                            const code = String(charge.charge_code ?? "")
                              .trim()
                              .toUpperCase();
                            if (
                              charge.is_tax_row === true ||
                              code === "IGST" ||
                              code === "CGST" ||
                              code === "SGST"
                            )
                              return "";
                            const rate = gstRatesByChargeIndex[index]?.igst;
                            const localAmount = charge.amount_in_local;
                            if (rate == null || localAmount == null) return "";
                            const amount = clampAmount(
                              (localAmount * rate) / 100,
                            );
                            return amount != null ? String(amount) : "";
                          })()}
                          readOnly
                          rightSection={(() => {
                            const rate = gstRatesByChargeIndex[index]?.igst;
                            const localAmount = charge.amount_in_local;
                            const amount =
                              rate == null || localAmount == null
                                ? null
                                : clampAmount((localAmount * rate) / 100);
                            const display =
                              amount != null ? String(amount) : "";
                            return gstRatesLoadingByIndex[index] &&
                              display === "" ? (
                              <Loader size="xs" color="#105476" />
                            ) : null;
                          })()}
                          styles={{
                            root: { flex: "0 0 88px" },
                            input: {
                              fontSize: "11px",
                              fontFamily: "Inter",
                              height: "28px",
                            },
                          }}
                        />
                        {/* )} */}
                      </Grid.Col>
                    )}
                    <Grid.Col span={0.5}>
                      {!isReadOnly && (
                        <Group gap="xs">
                          {form.values.charges.length > 1 && (
                            <Button
                              variant="light"
                              color="red"
                              size="sm"
                              px={12}
                              onClick={() => {
                                setGstRatesByChargeIndex((prev) => {
                                  const next: Record<number, GstRates | null> =
                                    {};
                                  Object.entries(prev).forEach(
                                    ([key, value]) => {
                                      const idx = Number(key);
                                      if (Number.isNaN(idx) || idx === index)
                                        return;
                                      next[idx > index ? idx - 1 : idx] = value;
                                    },
                                  );
                                  return next;
                                });
                                setGstRatesLoadingByIndex((prev) => {
                                  const next: Record<number, boolean> = {};
                                  Object.entries(prev).forEach(
                                    ([key, value]) => {
                                      const idx = Number(key);
                                      if (Number.isNaN(idx) || idx === index)
                                        return;
                                      next[idx > index ? idx - 1 : idx] = value;
                                    },
                                  );
                                  return next;
                                });
                                form.removeListItem("charges", index);
                              }}
                            >
                              <IconTrash size={16} />
                            </Button>
                          )}
                          {form.values.charges.length - 1 === index && (
                            <Button
                              radius="sm"
                              px={12}
                              size="sm"
                              variant="light"
                              color="#105476"
                              onClick={() => {
                                // New charge currency = local currency (active branch) from store, not billing currency
                                const newChargeCurrency =
                                  defaultBranchCurrency || "";
                                const roe = newChargeCurrency
                                  ? getRoeValue(newChargeCurrency)
                                  : null;
                                const newChargeCurrencyId =
                                  defaultBranchCurrencyId ||
                                  (currencyOptions.find(
                                    (o) =>
                                      (o.label || "").toUpperCase() ===
                                      (newChargeCurrency || "").toUpperCase(),
                                  )?.value ??
                                    "");
                                form.insertListItem("charges", {
                                  charge_id: null,
                                  charge_name: "",
                                  shipment_id: undefined,
                                  shipper_id: "",
                                  unit_code: "",
                                  unit_id: "",
                                  no_of_unit: null,
                                  currency: newChargeCurrency,
                                  currency_id: newChargeCurrencyId,
                                  billing_currency: null,
                                  roe,
                                  amount_per_unit: null,
                                  amount: null,
                                  header_amount: null,
                                  amount_in_local: null,
                                  tax_code: "",
                                  dr_cr: chargeDefaultDrCr,
                                });
                              }}
                            >
                              <IconPlus size={16} />
                            </Button>
                          )}
                        </Group>
                      )}
                    </Grid.Col>
                  </Grid>
                ))}
                {/* </Box> */}

                {/* Totals Section - customer invoice only (hidden for agent invoice) */}
                {!isAgentInvoice && (
                  <Box
                    mt="xl"
                    p="md"
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderRadius: 8,
                      border: "1px solid #dee2e6",
                    }}
                  >
                    <Grid gutter="md">
                      <Grid.Col span={3}>
                        <Box>
                          <Text size="sm" fw={500} c="dimmed" mb={4}>
                            Local Amount Total
                          </Text>
                          <Text size="lg" fw={600} c="#105476">
                            {form.values.charges
                              .reduce(
                                (sum, c) => sum + (c.amount_in_local ?? 0),
                                0,
                              )
                              .toFixed(2)}
                          </Text>
                        </Box>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Box>
                          <Text size="sm" fw={500} c="dimmed" mb={4}>
                            IGST Total
                          </Text>
                          <Text size="lg" fw={600} c="#105476">
                            {form.values.charges
                              .reduce((sum, c, idx) => {
                                const rate = gstRatesByChargeIndex[idx]?.igst;
                                const localAmount = c.amount_in_local;
                                if (rate == null || localAmount == null)
                                  return sum;
                                const amount = clampAmount(
                                  (localAmount * rate) / 100,
                                );
                                return sum + (amount ?? 0);
                              }, 0)
                              .toFixed(2)}
                          </Text>
                        </Box>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Box>
                          <Text size="sm" fw={500} c="dimmed" mb={4}>
                            CGST Total
                          </Text>
                          <Text size="lg" fw={600} c="#105476">
                            {form.values.charges
                              .reduce((sum, c, idx) => {
                                const rate = gstRatesByChargeIndex[idx]?.cgst;
                                const localAmount = c.amount_in_local;
                                if (rate == null || localAmount == null)
                                  return sum;
                                const amount = clampAmount(
                                  (localAmount * rate) / 100,
                                );
                                return sum + (amount ?? 0);
                              }, 0)
                              .toFixed(2)}
                          </Text>
                        </Box>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Box>
                          <Text size="sm" fw={500} c="dimmed" mb={4}>
                            SGST Total
                          </Text>
                          <Text size="lg" fw={600} c="#105476">
                            {form.values.charges
                              .reduce((sum, c, idx) => {
                                const rate = gstRatesByChargeIndex[idx]?.sgst;
                                const localAmount = c.amount_in_local;
                                if (rate == null || localAmount == null)
                                  return sum;
                                const amount = clampAmount(
                                  (localAmount * rate) / 100,
                                );
                                return sum + (amount ?? 0);
                              }, 0)
                              .toFixed(2)}
                          </Text>
                        </Box>
                      </Grid.Col>
                    </Grid>
                  </Box>
                )}
              </Tabs.Panel>

              {saveResponse && !isAgentInvoice && (
                <Tabs.Panel value="tax">
                  {gstBreakupLoading && (
                    <Stack align="center" py="xl">
                      <Loader size="md" color="#105476" />
                      <Text size="sm" c="dimmed">
                        Loading GST breakup...
                      </Text>
                    </Stack>
                  )}
                  {!gstBreakupLoading &&
                    !gstBreakup &&
                    chargesTabActive === "tax" &&
                    saveResponse?.id &&
                    saveResponse?.customer_id != null && (
                      <Text size="sm" c="dimmed" py="md">
                        No GST breakup data.
                      </Text>
                    )}
                  {!gstBreakupLoading && gstBreakup && (
                    <>
                      <ScrollArea mt="md">
                        <Table
                          withTableBorder
                          withColumnBorders
                          striped
                          highlightOnHover
                          style={{ minWidth: 400 }}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                SAC
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Charge Name
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Rate
                              </Table.Th>
                              <Table.Th
                                style={{ fontSize: "12px", fontWeight: 600 }}
                              >
                                Amount
                              </Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {(gstBreakup.sac_wise_totals ?? []).map(
                              (row, idx) => (
                                <Table.Tr key={idx}>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.sac_code ?? "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.charge_name ?? "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.rate != null && row.rate_type != null
                                      ? `${row.rate}${row.rate_type}`
                                      : "—"}
                                  </Table.Td>
                                  <Table.Td style={{ fontSize: "13px" }}>
                                    {row.total_amount != null
                                      ? Number(row.total_amount)
                                      : "—"}
                                  </Table.Td>
                                </Table.Tr>
                              ),
                            )}
                          </Table.Tbody>
                          <Table.Tfoot>
                            <Table.Tr>
                              <Table.Td style={{ fontSize: "13px" }} />
                              <Table.Td style={{ fontSize: "13px" }} />
                              <Table.Td
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "#105476",
                                }}
                              >
                                Total:
                              </Table.Td>
                              <Table.Td
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "#105476",
                                }}
                              >
                                {gstBreakup.total ?? "0.00"}
                              </Table.Td>
                            </Table.Tr>
                          </Table.Tfoot>
                        </Table>
                      </ScrollArea>
                    </>
                  )}
                  {chargesTabActive === "tax" &&
                    saveResponse &&
                    // (!saveResponse.id || saveResponse.customer_id == null) && (
                    !saveResponse.id && (
                      <Text size="sm" c="dimmed" py="md">
                        Save the invoice to load GST breakup (customer_id from
                        response is required).
                      </Text>
                    )}
                </Tabs.Panel>
              )}
            </Tabs>
          </Box>

          {/* Action Buttons */}
          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              color="#105476"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            {!isReadOnly && (
              <>
                <Button
                  type="submit"
                  color="#105476"
                  rightSection={<IconChevronRight size={16} />}
                  loading={isSubmitting}
                >
                  {saveResponse?.id
                    ? `Update ${resolvedDocumentLabel}`
                    : `Save ${resolvedDocumentLabel}`}
                </Button>
                {saveResponse &&
                  saveResponse.status?.toUpperCase() === "UNPOSTED" &&
                  !invoiceIsPosted && (
                    <Button
                      type="button"
                      color="black"
                      variant="filled"
                      loading={isPosting}
                      onClick={handlePostInvoice}
                    >
                      {`Post ${resolvedDocumentLabel}`}
                    </Button>
                  )}
              </>
            )}
          </Group>
        </Box>
      </Stack>

      {/* PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title="PDF Preview"
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
          {pdfBlob ? (
            <>
              <iframe
                src={pdfBlob}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="PDF Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleClosePreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  leftSection={<IconDownload size={16} />}
                  color="#105476"
                >
                  Download PDF
                </Button>
              </Group>
            </>
          ) : (
            <Center h="100%">
              <Stack align="center">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Generating PDF preview...</Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}

export default InvoiceCreate;
