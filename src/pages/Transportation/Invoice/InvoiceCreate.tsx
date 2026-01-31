import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Text,
  TextInput,
  Textarea,
  NumberInput,
  Stack,
  Loader,
  ScrollArea,
  Tabs,
  Table,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useState, useMemo, useEffect, useCallback } from "react";
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
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import useAuthStore from "../../../store/authStore";

// Fetch functions
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

// Daybook: POST with { filters: { document_type: "INV" } }, response.data has id and name
const fetchDaybook = async () => {
  try {
    const payload = { filters: { document_type: "INV" } };
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
const fetchUnitMaster = async () => {
  try {
    const payload = {
      filters: {
        service_type: "AIR",
      },
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
  customer_id: number;
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
  charge_id: number | null; // id from charge master (value when selecting charge)
  charge_name: string; // display label for charge
  unit_code: string;
  no_of_unit: number | null;
  currency: string;
  billing_currency?: string | null;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null; // Internal naming: currency_amount (amount in currency)
  header_amount: number | null;
  amount_in_local: number | null; // Auto-calculated as: amount * roe
  tax_code: string; // sac_code from get-effective-sac (display)
  tax_code_id: number | null; // for payload
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
  charges: ChargeItem[];
};

// Normalize form date value to Date | null for SingleDateInput (handles string from serialization)
function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

// Clamp amount to max 10 digits including decimals, max 2 decimal places (e.g. 99999999.99)
function clampAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return value === undefined ? null : value;
  const rounded = Math.round(value * 100) / 100;
  const maxVal = 99999999.99;
  if (Math.abs(rounded) > maxVal) return rounded > 0 ? maxVal : -maxVal;
  return rounded;
}

// Invoice data shape from filter/invoice API (for edit/view form fill)
type InvoiceDataFromApi = {
  id?: number;
  bill_to?: string;
  address?: string;
  gstn?: string;
  shipment_no?: string;
  document_no?: string;
  document_date?: string;
  due_date?: string;
  roe?: string | number;
  narration?: string;
  irn_no?: string;
  state_id?: number;
  currency_id?: number;
  currency_code?: string;
  day_book_id?: number;
  day_book_name?: string;
  charges?: Array<{
    charge_id?: number;
    charge_name?: string;
    unit_code?: string;
    no_of_unit?: string | number;
    currency_code?: string;
    roe?: string | number;
    amount_per_unit?: string | number;
    amount?: string | number;
    amount_in_local?: string | number;
    amount_in_header?: string | number | null;
    tax_code?: string;
    tax_code_id?: number;
  }>;
};

function InvoiceCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: invoiceId } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);

  const isViewMode = location.pathname.includes("/view/");
  const isEditOrViewMode = Boolean(
    invoiceId &&
      (location.pathname.includes("/edit/") ||
        location.pathname.includes("/view/")),
  );

  // Default branch currency (active branch: is_default === true) for Billing Currency
  const defaultBranchCurrency =
    (
      user?.branches?.find(
        (b: { is_default?: boolean }) => b.is_default === true,
      ) as { currency?: { currency_code?: string } } | undefined
    )?.currency?.currency_code ?? "";

  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [isPosting, setIsPosting] = useState(false);
  const [invoiceIsPosted, setInvoiceIsPosted] = useState(false);
  const [addressOptions, setAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  const isReadOnly = isViewMode || invoiceIsPosted;

  // User's local currency code (for ROE = 1 when billing currency matches)
  const userLocalCurrency = useMemo(() => {
    const code = user?.country?.country_code;
    if (code === "IN") return "INR";
    if (code === "AE") return "AED";
    return "";
  }, [user?.country?.country_code]);

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
      charges: [],
    },
    validate: {
      bill_to: (value) => (!value ? "Bill To is required" : null),
      address: (value) => (!value ? "Address is required" : null),
      state: (value) => (!value ? "State is required" : null),
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

  // Fetch daybook data (filtered by document_type INV)
  const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
    queryKey: ["daybook", "INV"],
    queryFn: fetchDaybook,
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
    queryKey: ["unitMaster", "AIR"],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
  });

  // Format currency options
  const currencyOptions = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.code || item.currency_code || ""),
      label: `${item.code || item.currency_code || ""}`,
    }));
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

  // Format daybook options: id = value, name = label (value is daybook_id)
  const daybookOptions = useMemo(() => {
    const data = daybookData as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookData]);

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

  // Format unit options
  const unitOptions = useMemo(() => {
    const data = unitData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.unit_code || item.code || item.id || ""),
      label: item.unit_name || item.name || "",
    }));
  }, [unitData]);

  // Set Billing Currency from user's default branch when user is available and currency is still empty
  useEffect(() => {
    if (!defaultBranchCurrency || form.values.currency) return;
    form.setFieldValue("currency", defaultBranchCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBranchCurrency]);

  // When user currency and billing currency are the same, set top-level ROE to 1
  useEffect(() => {
    const billingCurrency = form.values.currency?.trim().toUpperCase();
    if (!billingCurrency || !userLocalCurrency) return;
    if (billingCurrency === userLocalCurrency.toUpperCase()) {
      form.setFieldValue("roe", 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.currency, userLocalCurrency]);

  // Keep Bill To, State and Address in sync: when customer (Bill To) is empty, clear state and address
  useEffect(() => {
    const billTo = form.values.bill_to;
    if (!billTo || (typeof billTo === "string" && billTo.trim() === "")) {
      if (form.values.address) form.setFieldValue("address", "");
      if (form.values.state) form.setFieldValue("state", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.bill_to]);

  // Populate form from house (HAWB) state: shipper/Bill To/address and house charges → invoice charges
  useEffect(() => {
    const hawbDetails =
      location.state?.hawbDetails || location.state?.housingDetails || [];

    if (Array.isArray(hawbDetails) && hawbDetails.length > 0) {
      // Get the first HAWB detail
      const firstHawb = hawbDetails[0];

      if (firstHawb) {
        // Set shipment_id from housing to shipment_no field
        if (firstHawb.shipment_id) {
          form.setFieldValue("shipment_no", String(firstHawb.shipment_id));
        }

        // Set shipper address in the address field
        if (firstHawb.shipper_address) {
          form.setFieldValue("address", firstHawb.shipper_address);
        }

        // Set shipper name in Bill To field (customer name for payload and validation)
        if (firstHawb.shipper_name) {
          setBillToDisplayName(firstHawb.shipper_name);
          form.setFieldValue("bill_to", firstHawb.shipper_name);
        }

        // State from housing is set after state API loads (see useEffect below)

        // Map house (HAWB) charges into invoice charges form (same shape as housing stepper for common fields)
        if (
          firstHawb.charges &&
          Array.isArray(firstHawb.charges) &&
          firstHawb.charges.length > 0
        ) {
          const mappedCharges = firstHawb.charges.map((charge: any) => {
            // Handle unit_code from unit_details or direct field (API may return nested object)
            const unitDetails = charge.unit_details as
              | { unit_code?: string }
              | undefined;
            const unitCode =
              charge.unit_code ||
              charge.unit_input ||
              unitDetails?.unit_code ||
              "";

            // Handle currency from currency_details or direct field (API may return nested object)
            const currencyDetails = charge.currency_details as
              | { currency_code?: string }
              | undefined;
            const currency =
              charge.currency || currencyDetails?.currency_code || "";

            const amountInLocal =
              charge.amount_in_local != null
                ? typeof charge.amount_in_local === "number"
                  ? charge.amount_in_local
                  : parseFloat(charge.amount_in_local)
                : null;
            const headerAmt =
              (charge.amount_in_header ?? charge.header_amount) != null
                ? typeof (charge.amount_in_header ?? charge.header_amount) ===
                  "number"
                  ? (charge.amount_in_header ?? charge.header_amount)
                  : parseFloat(
                      String(charge.amount_in_header ?? charge.header_amount),
                    )
                : null;

            return {
              charge_id:
                (charge.charge_id ?? charge.id) != null
                  ? Number(charge.charge_id ?? charge.id)
                  : null,
              charge_name: charge.charge_name ? String(charge.charge_name) : "",
              unit_code: unitCode ? String(unitCode) : "",
              no_of_unit: charge.no_of_unit as number | null,
              currency: currency ? String(currency) : "",
              roe: charge.roe as number | null,
              amount_per_unit: charge.amount_per_unit as number | null,
              amount: charge.amount as number | null,
              header_amount: Number.isFinite(headerAmt) ? headerAmt : null,
              amount_in_local: Number.isFinite(amountInLocal)
                ? amountInLocal
                : null,
              tax_code: charge.tax_code ? String(charge.tax_code) : "",
              tax_code_id: charge.tax_code_id != null ? Number(charge.tax_code_id) : null,
            };
          });
          form.setFieldValue("charges", mappedCharges);
        } else {
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
              tax_code_id: null,
            },
          ]);
        }
      }
    } else {
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
          tax_code_id: null,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Populate form from invoice data when navigating from Accounts (edit/view)
  useEffect(() => {
    const invoiceData = location.state?.invoiceData as
      | InvoiceDataFromApi
      | undefined;
    if (!invoiceData || !isEditOrViewMode) return;

    setBillToDisplayName(invoiceData.bill_to ?? null);
    form.setValues({
      bill_to: invoiceData.bill_to ?? "",
      address: invoiceData.address ?? "",
      state: invoiceData.state_id != null ? String(invoiceData.state_id) : "",
      gstn: invoiceData.gstn ?? "",
      shipment_no: invoiceData.shipment_no ?? "",
      daybook_id:
        invoiceData.day_book_id != null ? String(invoiceData.day_book_id) : "",
      document_date: normalizeDate(invoiceData.document_date ?? null),
      due_date: normalizeDate(invoiceData.due_date ?? null),
      currency: invoiceData.currency_code ?? "",
      roe:
        invoiceData.roe != null
          ? typeof invoiceData.roe === "string"
            ? parseFloat(invoiceData.roe)
            : invoiceData.roe
          : null,
      narration: invoiceData.narration ?? "",
      irn_no: invoiceData.irn_no ?? "",
      charges:
        invoiceData.charges && invoiceData.charges.length > 0
          ? invoiceData.charges.map((c: any) => ({
              charge_id: c.charge_id != null ? Number(c.charge_id) : null,
              charge_name: c.charge_name ?? "",
              unit_code: c.unit_code ?? "",
              no_of_unit:
                c.no_of_unit != null
                  ? typeof c.no_of_unit === "string"
                    ? parseFloat(c.no_of_unit)
                    : c.no_of_unit
                  : null,
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
              tax_code_id: c.tax_code_id != null ? Number(c.tax_code_id) : null,
            }))
          : form.values.charges.length > 0
            ? form.values.charges
            : [
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
                  tax_code_id: null,
                },
              ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, isEditOrViewMode, location.state?.invoiceData]);

  // Set state from housing shipper_state_id once state API has loaded
  // Use hawbDetails first, then fallback to job.housing_details (from API) when passed house has no shipper_state_id
  useEffect(() => {
    if (isStateLoading || !stateData?.length) return;
    const hawbDetails =
      location.state?.hawbDetails || location.state?.housingDetails || [];
    const firstHawb =
      Array.isArray(hawbDetails) && hawbDetails.length > 0
        ? hawbDetails[0]
        : null;
    const jobHousing = (
      location.state?.job as {
        housing_details?: Array<{ shipper_state_id?: number | null }>;
      }
    )?.housing_details;
    const shipperStateId =
      firstHawb?.shipper_state_id != null
        ? firstHawb.shipper_state_id
        : (jobHousing?.[0]?.shipper_state_id ?? null);
    if (shipperStateId != null) {
      form.setFieldValue("state", String(shipperStateId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStateLoading, stateData]);

  // Auto-set ROE when currency changes
  const chargeCurrencies = form.values.charges.map((c) => c.currency).join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      // Auto-set ROE if currency is selected but ROE is not set
      let roe = charge.roe;
      if (charge.currency && !roe) {
        roe = getRoeValue(charge.currency);
      }

      // Only update ROE, don't touch amount
      if (roe !== charge.roe) {
        return {
          ...charge,
          roe: roe || null,
        };
      }

      return charge;
    });

    // Only update if there are actual changes to ROE
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.roe !== form.values.charges[index]?.roe,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrencies, getRoeValue]);

  // Auto-calculate amount when amount_per_unit, no_of_unit, or roe changes
  const chargeAmountPerUnits = form.values.charges
    .map((c) => c.amount_per_unit)
    .join(",");
  const chargeNoOfUnits = form.values.charges
    .map((c) => c.no_of_unit)
    .join(",");
  const chargeRoes = form.values.charges.map((c) => c.roe).join(",");

  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge, index) => {
      // Auto-calculate amount if amount_per_unit is provided
      if (
        charge.amount_per_unit !== null &&
        charge.amount_per_unit !== undefined &&
        charge.amount_per_unit > 0 &&
        charge.no_of_unit !== null &&
        charge.no_of_unit > 0 &&
        charge.roe !== null &&
        charge.roe !== undefined &&
        charge.roe > 0
      ) {
        const calculatedAmount =
          charge.no_of_unit * charge.roe * charge.amount_per_unit;
        const clamped = clampAmount(calculatedAmount);
        if (clamped != null && clamped > 0 && clamped !== charge.amount) {
          return {
            ...charge,
            amount: clamped,
          };
        }
      }

      return charge;
    });

    // Only update if there are actual changes to amount
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.amount !== form.values.charges[index]?.amount,
    );

    if (hasChanges) {
      form.setFieldValue("charges", updatedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmountPerUnits, chargeNoOfUnits, chargeRoes]);

  // Auto-calculate amount_in_local (Local Amount) as: amount (currency_amount) * charge.roe
  const chargeAmounts = form.values.charges.map((c) => c.amount).join(",");
  const chargeRoesForLocal = form.values.charges.map((c) => c.roe).join(",");

  useEffect(() => {
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
          return {
            ...charge,
            amount_in_local: clamped,
          };
        }
      }

      return charge;
    });

    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.amount_in_local !== form.values.charges[index]?.amount_in_local,
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
    if (
      chargesTabActive !== "tax" ||
      !saveResponse?.id ||
      saveResponse?.customer_id == null
    ) {
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

    // When Bill To is removed/cleared, clear state and address-related fields and stop
    const isCleared =
      value == null || (typeof value === "string" && value.trim() === "");
    if (isCleared) {
      setAddressOptions([]);
      form.setFieldValue("address", "");
      form.setFieldValue("state", "");
      return;
    }

    // Customer selected from search: populate address options and state from customer response (addresses_data)
    if (
      originalData &&
      (originalData as Record<string, unknown>).addresses_data
    ) {
      const addressesData = (originalData as Record<string, unknown>)
        .addresses_data as Array<{
        id: number;
        address: string;
        state_id?: number;
      }>;
      const addressOptions = (addressesData || []).map(
        (addr: { id: number; address: string }) => ({
          value: String(addr.id),
          label: addr.address,
        }),
      );

      setAddressOptions(addressOptions);
      form.setFieldValue("address", "");

      // Set state_id from first address that has state_id (e.g. primary) in customer response
      const addrWithState = (addressesData || []).find(
        (a: { state_id?: number }) => a.state_id != null,
      );
      if (addrWithState?.state_id != null) {
        form.setFieldValue("state", String(addrWithState.state_id));
      }
    } else {
      setAddressOptions([]);
      form.setFieldValue("address", "");
      // Do not clear state here — value is set (e.g. from house) but we may not have originalData
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

      const stateId = Number(values.state);
      const currencyItem = (currencyData as any[])?.find(
        (c: any) =>
          (c.code || c.currency_code || "").toString() === values.currency,
      );
      const currencyId =
        currencyItem?.id != null ? Number(currencyItem.id) : null;

      if (!stateId || stateId <= 0) {
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

      // Total = sum of header amount column
      const total = values.charges.reduce(
        (sum, c) => sum + (c.header_amount ?? 0),
        0,
      );

      const formatDateDDMMYYYY = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };

      const payload = {
        bill_to: values.bill_to,
        address: values.address,
        state_id: stateId,
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
        total,
        // status: "UNPOST",
        charges: values.charges.map((charge) => {
          const chargeCurrencyItem = (currencyData as any[])?.find(
            (c: any) =>
              (c.code || c.currency_code || "").toString() === charge.currency,
          );
          const chargeCurrencyId =
            chargeCurrencyItem?.id != null
              ? Number(chargeCurrencyItem.id)
              : null;
          const unitItem = (unitData as any[])?.find(
            (u: any) =>
              String(u.unit_code || u.code || u.id) === charge.unit_code,
          );
          const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
          return {
            shipment_no: values.shipment_no,
            charge_id: charge.charge_id ?? null,
            unit_id: unitId,
            no_of_unit: charge.no_of_unit ?? 0,
            currency_id: chargeCurrencyId,
            roe: charge.roe ?? 0,
            amount_per_unit: clampAmount(charge.amount_per_unit ?? 0) ?? 0,
            amount: clampAmount(charge.amount ?? 0) ?? 0,
            amount_in_local: clampAmount(charge.amount_in_local ?? 0) ?? 0,
            amount_in_header: clampAmount(charge.header_amount ?? 0) ?? 0,
            tax_code_id: charge.tax_code_id ?? null,
          };
        }),
      };
      console.log("payload---", payload);

      const response = (await postAPICall(URL.invoice, payload, API_HEADER)) as
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
        ToastNotification({
          message: "Invoice created successfully",
          type: "success",
        });
        // Stay on same page with form values filled; document_no and status shown in header
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
    if (!saveResponse?.id || saveResponse?.customer_id == null) {
      ToastNotification({
        message: "Save the invoice first and ensure customer_id is available.",
        type: "error",
      });
      return;
    }
    setIsPosting(true);
    try {
      const values = form.values;
      const stateId = Number(values.state);
      const currencyItem = (currencyData as { id?: number; code?: string; currency_code?: string }[])?.find(
        (c) =>
          (c.code || c.currency_code || "").toString() === values.currency,
      );
      const currencyId =
        currencyItem?.id != null ? Number(currencyItem.id) : null;
      if (!stateId || stateId <= 0 || currencyId == null || currencyId <= 0) {
        ToastNotification({
          message: "Please ensure State and Currency are valid.",
          type: "error",
        });
        setIsPosting(false);
        return;
      }
      const total = values.charges.reduce(
        (sum, c) => sum + (c.header_amount ?? 0),
        0,
      );
      const formatDateDDMMYYYY = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };
      let breakupData = gstBreakup;
      if (!breakupData?.sac_wise_totals?.length) {
        breakupData = await fetchInvoiceCalculateGstBreakup({
          customer_id: saveResponse.customer_id,
          invoice_id: saveResponse.id,
        }) as typeof gstBreakup;
      }
      const sacWiseTotals = breakupData?.sac_wise_totals ?? [];
      const topRoe = values.roe != null && values.roe > 0 ? Number(values.roe) : 1;
      const taxes = sacWiseTotals.map((row) => ({
        tax_code: row.sac_code ?? "",
        rate: row.rate ?? 0,
        amount: row.total_amount ?? 0,
      }));
      const chargesPayload = values.charges.map((charge) => {
        const chargeCurrencyItem = (currencyData as { id?: number; code?: string; currency_code?: string }[])?.find(
          (c) =>
            (c.code || c.currency_code || "").toString() === charge.currency,
        );
        const chargeCurrencyId =
          chargeCurrencyItem?.id != null ? Number(chargeCurrencyItem.id) : null;
        const unitItem = (unitData as { id?: number; unit_code?: string; code?: string }[])?.find(
          (u) =>
            String(u.unit_code || u.code || u.id) === charge.unit_code,
        );
        const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
        return {
          shipment_no: values.shipment_no,
          charge_id: charge.charge_id ?? null,
          unit_id: unitId,
          no_of_unit: charge.no_of_unit ?? 0,
          currency_id: chargeCurrencyId,
          roe: charge.roe ?? 0,
          amount_per_unit: clampAmount(charge.amount_per_unit ?? 0) ?? 0,
          amount: clampAmount(charge.amount ?? 0) ?? 0,
          amount_in_local: clampAmount(charge.amount_in_local ?? 0) ?? 0,
          amount_in_header: clampAmount(charge.header_amount ?? 0) ?? 0,
          tax_code_id: charge.tax_code_id ?? null,
        };
      });
      // Append tax rows from sac_wise_totals: charge_id, currency_id, roe (top), amount (total_amount), amount_in_local & amount_in_header (total_amount * roe), tax_code from sac_code; other fields empty
      const taxCharges = sacWiseTotals.map((row) => {
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
          tax_code_id: null,
        };
      });
      const allChargesPayload = [...chargesPayload, ...taxCharges];
      const payload = {
        id: saveResponse.id,
        bill_to: values.bill_to,
        address: values.address,
        state_id: stateId,
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
        status: "POSTED",
        total,
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
        // Re-render charges from POST response (includes tax rows) for view mode
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
            return {
              charge_id: c.charge_id ?? null,
              charge_name: c.charge_name ?? "",
              unit_code: c.unit_code ?? "",
              no_of_unit: Number.isFinite(noOfUnit) ? noOfUnit : null,
              currency: c.currency_code ?? "",
              roe: Number.isFinite(roe) ? roe : null,
              amount_per_unit: Number.isFinite(amountPerUnit)
                ? amountPerUnit
                : null,
              amount: Number.isFinite(amount) ? amount : null,
              header_amount: Number.isFinite(headerAmount) ? headerAmount : null,
              amount_in_local: Number.isFinite(amountInLocal)
                ? amountInLocal
                : null,
              tax_code: c.tax_code ?? "",
              tax_code_id: c.tax_id != null ? c.tax_id : null,
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
        message: (error as { message?: string })?.message ?? "Failed to post invoice",
        type: "error",
      });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Box p="md" style={{ position: "relative" }}>
      {/* Full-page loader overlay when saving or posting */}
      {(isSubmitting || isPosting) && (
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
              {isPosting ? "Posting invoice..." : "Saving invoice..."}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        {/* Header: Title | document_no & status (after save) | Back */}
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text size="xl" fw={600} c="#105476">
            Create Invoice
          </Text>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">
                    {saveResponse.status?.toUpperCase() === "POSTED"
                      ? "Invoice Number"
                      : "Draft Invoice Number"}
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
                label="Bill To"
                placeholder="Type customer name"
                apiEndpoint={URL.customer}
                searchFields={["customer_name", "customer_code"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.customer_name),
                  label: String(item.customer_name),
                })}
                value={form.values.bill_to}
                displayValue={billToDisplayName || undefined}
                onChange={handleBillToChange}
                returnOriginalData={true}
                withAsterisk
                dropdownZIndex={1000}
                disabled={isReadOnly}
                error={
                  form.errors.bill_to ? String(form.errors.bill_to) : undefined
                }
                styles={{
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
                }}
              />
            </Grid.Col>

            {/* State */}
            <Grid.Col span={2}>
              <Dropdown
                label="State"
                placeholder={isStateLoading ? "Loading states" : "Select state"}
                data={stateOptions}
                value={form.values.state ? form.values.state : null}
                onChange={(value) => form.setFieldValue("state", value ?? "")}
                searchable
                withAsterisk
                error={form.errors.state || undefined}
                disabled={isStateLoading || isReadOnly}
                styles={{
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
                }}
              />
            </Grid.Col>

            {/* GSTN */}
            <Grid.Col span={2}>
              <TextInput
                label="GSTN"
                placeholder="Enter GSTN"
                value={form.values.gstn}
                onChange={(e) => form.setFieldValue("gstn", e.target.value)}
                error={form.errors.gstn}
                readOnly={isReadOnly}
                styles={{
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
                }}
              />
            </Grid.Col>

            {/* Shipment No */}
            <Grid.Col span={2}>
              <TextInput
                label="Shipment No"
                placeholder="Enter shipment number"
                readOnly={isReadOnly}
                value={form.values.shipment_no}
                onChange={(e) =>
                  form.setFieldValue("shipment_no", e.target.value)
                }
                withAsterisk
                error={form.errors.shipment_no}
                styles={{
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
                }}
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
                disabled={isDaybookLoading || isReadOnly}
                styles={{
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
                }}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
                error={
                  form.errors.due_date
                    ? typeof form.errors.due_date === "string"
                      ? form.errors.due_date
                      : String(form.errors.due_date)
                    : undefined
                }
              />
            </Grid.Col>

            {/* Currency */}
            <Grid.Col span={2}>
              <Dropdown
                label="Billing Currency"
                placeholder="Select currency"
                data={currencyOptions}
                value={form.values.currency}
                onChange={(value) =>
                  form.setFieldValue("currency", value || "")
                }
                searchable
                withAsterisk
                error={
                  form.errors.currency
                    ? String(form.errors.currency)
                    : undefined
                }
                disabled={isCurrencyLoading || isReadOnly}
                styles={{
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
                }}
              />
            </Grid.Col>

            {/* ROE */}
            <Grid.Col span={2}>
              <NumberInput
                label="ROE"
                placeholder="Enter rate of exchange"
                value={form.values.roe ?? undefined}
                onChange={(value) => {
                  const numValue =
                    typeof value === "number"
                      ? value
                      : typeof value === "string"
                        ? parseFloat(value) || null
                        : null;
                  form.setFieldValue("roe", numValue);
                }}
                withAsterisk
                readOnly={isReadOnly}
                error={form.errors.roe ? String(form.errors.roe) : undefined}
                min={0}
                decimalScale={4}
                step={0.0001}
                styles={{
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
                }}
              />
            </Grid.Col>

            {/* IRN No */}
            <Grid.Col span={2}>
              <TextInput
                label="IRN No"
                placeholder="Enter IRN number"
                value={form.values.irn_no}
                onChange={(e) => form.setFieldValue("irn_no", e.target.value)}
                error={form.errors.irn_no}
                readOnly={isReadOnly}
                styles={{
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
                }}
              />
            </Grid.Col>

            {/* Address - moved to end */}
            <Grid.Col span={6}>
              {addressOptions.length > 0 ? (
                <Dropdown
                  label="Address"
                  placeholder="Select address"
                  data={addressOptions}
                  value={form.values.address}
                  onChange={(value) =>
                    form.setFieldValue("address", value || "")
                  }
                  searchable
                  withAsterisk
                  disabled={isReadOnly}
                  error={
                    form.errors.address
                      ? String(form.errors.address)
                      : undefined
                  }
                  styles={{
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
                  }}
                />
              ) : (
                <TextInput
                  label="Address"
                  placeholder="Enter address"
                  value={form.values.address}
                  onChange={(e) =>
                    form.setFieldValue("address", e.target.value)
                  }
                  withAsterisk
                  readOnly={isReadOnly}
                  error={
                    form.errors.address
                      ? String(form.errors.address)
                      : undefined
                  }
                  styles={{
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
                  }}
                />
              )}
            </Grid.Col>

            {/* Narration - moved to end */}
            <Grid.Col span={6}>
              <Textarea
                label="Narration"
                placeholder="Enter narration"
                value={form.values.narration}
                onChange={(e) =>
                  form.setFieldValue("narration", e.target.value)
                }
                error={form.errors.narration}
                readOnly={isReadOnly}
                rows={2}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    marginBottom: "4px",
                  },
                }}
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
              {saveResponse && (
                <Tabs.List>
                  <Tabs.Tab value="charges">Charges</Tabs.Tab>
                  <Tabs.Tab value="tax">Tax</Tabs.Tab>
                </Tabs.List>
              )}

              <Tabs.Panel value="charges">
                {/* Dynamic Charges Rows */}
                <Box mb="sm" mt="md">
                  <Grid
                    w="100%"
                    gutter="sm"
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
                    <Grid.Col span={1.5} style={{ fontSize: "13px" }}>Charge</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Currency</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Unit</Grid.Col>
                    <Grid.Col span={0.75} style={{ fontSize: "13px" }}>ROE</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>No of Unit</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Amount per Unit</Grid.Col>
                    <Grid.Col span={1.25} style={{ fontSize: "13px" }}>Currency Amount</Grid.Col>
                    <Grid.Col span={1.25} style={{ fontSize: "13px" }}>
                      Amount in {form.values.currency ? form.values.currency.toUpperCase() : "(Billing currency)"}
                    </Grid.Col>
                    <Grid.Col span={1.25} style={{ fontSize: "13px" }}>Local Amount</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>SAC Code</Grid.Col>
                    <Grid.Col span={0.5} style={{ fontSize: "13px" }}>Actions</Grid.Col>
                  </Grid>

                  {form.values.charges.map((charge, index) => (
                    <Grid
                      key={index}
                      w="100%"
                      gutter="sm"
                      mt={index !== 0 ? "sm" : 0}
                    >
                      <Grid.Col span={1.5}>
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
                            form.setFieldValue(
                              `charges.${index}.tax_code_id`,
                              null,
                            );
                            if (chargeErrors[index]?.charge_name) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].charge_name;
                                if (
                                  Object.keys(newErrors[index]).length === 0
                                ) {
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
                                const item = data.find(
                                  (x) => x.charge_id === chargeId,
                                );
                                if (
                                  item?.sac_code != null &&
                                  item.sac_code !== ""
                                ) {
                                  form.setFieldValue(
                                    `charges.${index}.tax_code`,
                                    item.sac_code,
                                  );
                                  const taxCodeIdNum = Number(item.sac_code);
                                  form.setFieldValue(
                                    `charges.${index}.tax_code_id`,
                                    Number.isFinite(taxCodeIdNum)
                                      ? taxCodeIdNum
                                      : null,
                                  );
                                }
                              });
                            }
                          }}
                          withAsterisk
                          disabled={isReadOnly}
                          error={chargeErrors[index]?.charge_name}
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
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Select Currency"
                          withAsterisk
                          searchable
                          data={currencyOptions}
                          value={charge.currency || null}
                          disabled={isReadOnly}
                          onChange={(value) => {
                            const roe = value ? getRoeValue(value) : null;
                            form.setFieldValue(
                              `charges.${index}.currency`,
                              value || "",
                            );
                            if (roe !== null) {
                              form.setFieldValue(`charges.${index}.roe`, roe);
                            }
                            // Clear error when field is updated
                            if (chargeErrors[index]?.currency) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].currency;
                                if (
                                  Object.keys(newErrors[index]).length === 0
                                ) {
                                  delete newErrors[index];
                                }
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          error={chargeErrors[index]?.currency}
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
                          placeholder="Select Unit"
                          searchable
                          data={unitOptions}
                          value={charge.unit_code || null}
                          disabled={isReadOnly}
                          onChange={(value) =>
                            form.setFieldValue(
                              `charges.${index}.unit_code`,
                              value ?? "",
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
                      <Grid.Col span={0.75}>
                        <NumberInput
                          placeholder="ROE"
                          min={0}
                          hideControls
                          withAsterisk
                          readOnly={isReadOnly}
                          value={charge.roe || undefined}
                          onChange={(value) => {
                            const roe = value as number | null;
                            form.setFieldValue(`charges.${index}.roe`, roe);
                            const currentCharge = form.values.charges[index];

                            // Auto-calculate amount (currency_amount) if amount_per_unit is provided
                            if (
                              currentCharge.amount_per_unit !== null &&
                              currentCharge.amount_per_unit !== undefined &&
                              currentCharge.amount_per_unit > 0 &&
                              currentCharge.no_of_unit !== null &&
                              currentCharge.no_of_unit > 0 &&
                              roe !== null &&
                              roe > 0
                            ) {
                              const calculatedAmount =
                                currentCharge.no_of_unit *
                                roe *
                                currentCharge.amount_per_unit;
                              const clampedAmount = clampAmount(calculatedAmount);
                              if (clampedAmount != null && clampedAmount > 0) {
                                form.setFieldValue(
                                  `charges.${index}.amount`,
                                  clampedAmount,
                                );
                              }
                            }

                            // Auto-calculate Local Amount = currency_amount * roe
                            if (
                              currentCharge.amount !== null &&
                              currentCharge.amount !== undefined &&
                              currentCharge.amount > 0 &&
                              roe !== null &&
                              roe > 0
                            ) {
                              const calculatedLocalAmount =
                                currentCharge.amount * roe;
                              const clampedLocal = clampAmount(calculatedLocalAmount);
                              if (clampedLocal != null && clampedLocal > 0) {
                                form.setFieldValue(
                                  `charges.${index}.amount_in_local`,
                                  clampedLocal,
                                );
                              }
                            }

                            // Clear error when field is updated
                            if (chargeErrors[index]?.roe) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].roe;
                                if (
                                  Object.keys(newErrors[index]).length === 0
                                ) {
                                  delete newErrors[index];
                                }
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          error={chargeErrors[index]?.roe}
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
                          placeholder="No of Unit"
                          min={0}
                          hideControls
                          readOnly={isReadOnly}
                          value={charge.no_of_unit || undefined}
                          onChange={(value) => {
                            const noOfUnit = value as number | null;
                            form.setFieldValue(
                              `charges.${index}.no_of_unit`,
                              noOfUnit,
                            );
                            // Auto-calculate amount if amount_per_unit is provided
                            const currentCharge = form.values.charges[index];
                            if (
                              currentCharge.amount_per_unit !== null &&
                              currentCharge.amount_per_unit !== undefined &&
                              currentCharge.amount_per_unit > 0 &&
                              noOfUnit !== null &&
                              noOfUnit > 0 &&
                              currentCharge.roe !== null &&
                              currentCharge.roe !== undefined &&
                              currentCharge.roe > 0
                            ) {
                              const calculatedAmount =
                                noOfUnit *
                                currentCharge.roe *
                                currentCharge.amount_per_unit;
                              const clampedAmount = clampAmount(calculatedAmount);
                              if (clampedAmount != null && clampedAmount > 0) {
                                form.setFieldValue(
                                  `charges.${index}.amount`,
                                  clampedAmount,
                                );
                              }
                            }
                          }}
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
                          placeholder="Per Unit"
                          min={0}
                          decimalScale={2}
                          hideControls
                          readOnly={isReadOnly}
                          value={charge.amount_per_unit || undefined}
                          onChange={(value) => {
                            const raw = value as number | null;
                            const amountPerUnit = clampAmount(raw);
                            form.setFieldValue(
                              `charges.${index}.amount_per_unit`,
                              amountPerUnit,
                            );
                            // Auto-calculate amount if amount_per_unit is provided
                            const currentCharge = form.values.charges[index];
                            if (
                              amountPerUnit !== null &&
                              amountPerUnit !== undefined &&
                              amountPerUnit > 0 &&
                              currentCharge.no_of_unit !== null &&
                              currentCharge.no_of_unit > 0 &&
                              currentCharge.roe !== null &&
                              currentCharge.roe !== undefined &&
                              currentCharge.roe > 0
                            ) {
                              const calculatedAmount =
                                currentCharge.no_of_unit *
                                currentCharge.roe *
                                amountPerUnit;
                              const clampedAmount = clampAmount(calculatedAmount);
                              if (clampedAmount != null && clampedAmount > 0) {
                                form.setFieldValue(
                                  `charges.${index}.amount`,
                                  clampedAmount,
                                );
                              }
                            }
                          }}
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
                        <NumberInput
                          placeholder="Currency Amount"
                          min={0}
                          decimalScale={2}
                          hideControls
                          withAsterisk
                          readOnly={isReadOnly}
                          value={charge.amount || undefined}
                          onChange={(value) => {
                            const raw = value as number | null;
                            const currencyAmount = clampAmount(raw);
                            form.setFieldValue(
                              `charges.${index}.amount`,
                              currencyAmount,
                            );

                            // Auto-calculate Local Amount = currency_amount * roe
                            const currentCharge = form.values.charges[index];
                            if (
                              currencyAmount !== null &&
                              currencyAmount !== undefined &&
                              currencyAmount > 0 &&
                              currentCharge.roe !== null &&
                              currentCharge.roe !== undefined &&
                              currentCharge.roe > 0
                            ) {
                              const calculatedLocalAmount =
                                currencyAmount * currentCharge.roe;
                              const clampedLocal = clampAmount(calculatedLocalAmount);
                              if (clampedLocal != null && clampedLocal > 0) {
                                form.setFieldValue(
                                  `charges.${index}.amount_in_local`,
                                  clampedLocal,
                                );
                              }
                            }

                            // Clear error when field is updated
                            if (chargeErrors[index]?.amount) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].amount;
                                if (
                                  Object.keys(newErrors[index]).length === 0
                                ) {
                                  delete newErrors[index];
                                }
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          error={chargeErrors[index]?.amount}
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
                        <NumberInput
                          placeholder={`Amount in ${form.values.currency ? form.values.currency.toUpperCase() : "billing currency"}`}
                          min={0}
                          decimalScale={2}
                          hideControls
                          readOnly={isReadOnly}
                          value={charge.header_amount || undefined}
                          onChange={(value) => {
                            form.setFieldValue(
                              `charges.${index}.header_amount`,
                              clampAmount(value as number | null),
                            );
                          }}
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
                        <NumberInput
                          placeholder="Local Amount"
                          min={0}
                          decimalScale={2}
                          hideControls
                          withAsterisk
                          readOnly={isReadOnly}
                          value={charge.amount_in_local || undefined}
                          onChange={(value) => {
                            form.setFieldValue(
                              `charges.${index}.amount_in_local`,
                              clampAmount(value as number | null),
                            );
                          }}
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
                          placeholder="SAC Code"
                          withAsterisk
                          readOnly
                          value={charge.tax_code}
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
                        {!isReadOnly && (
                          <Group gap="xs">
                            {form.values.charges.length > 1 && (
                              <Button
                                variant="light"
                                color="red"
                                size="sm"
                                px={12}
                                onClick={() => {
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
                                  const newChargeCurrency =
                                    defaultBranchCurrency ||
                                    form.values.currency ||
                                    "";
                                  const roe = newChargeCurrency
                                    ? getRoeValue(newChargeCurrency)
                                    : null;
                                  form.insertListItem("charges", {
                                    charge_id: null,
                                    charge_name: "",
                                    unit_code: "",
                                    no_of_unit: null,
                                    currency: newChargeCurrency,
                                    billing_currency: null,
                                    roe,
                                    amount_per_unit: null,
                                    amount: null,
                                    header_amount: null,
                                    amount_in_local: null,
                                    tax_code: "",
                                    tax_code_id: null,
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
                </Box>
              </Tabs.Panel>

              {saveResponse && (
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
                            {(gstBreakup.sac_wise_totals ?? []).map((row, idx) => (
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
                            ))}
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
                    (!saveResponse.id || saveResponse.customer_id == null) && (
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
                  Save Invoice
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
                      Post Invoice
                    </Button>
                  )}
              </>
            )}
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}

export default InvoiceCreate;
