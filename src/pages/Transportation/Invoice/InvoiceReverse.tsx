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
import { IconArrowLeft, IconChevronRight, IconTrash } from "@tabler/icons-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { ToastNotification, SingleDateInput, Dropdown, SearchableSelect } from "../../../components";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import useAuthStore from "../../../store/authStore";
import { getAPICall } from "../../../service/getApiCall";

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
    return (response as { data?: unknown[] })?.data || response || [];
  } catch (error) {
    console.error("Error fetching state master:", error);
    return [];
  }
};

// Daybook for reverse invoice: CRN document_type (invoice page uses INV)
const fetchDaybookCRN = async () => {
  try {
    const payload = { filters: { document_type: "CRN" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (CRN):", error);
    return [];
  }
};

const fetchUnitMaster = async () => {
  try {
    const payload = { filters: { service_type: "AIR" } };
    const response = await postAPICall(URL.unitMasterFilter, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching unit master:", error);
    return [];
  }
};

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
      (response as {
        data?: Array<{
          charge_id: number;
          service_id: number;
          sac_code?: string | null;
        }>;
      })?.data ?? []
    );
  } catch (error) {
    console.error("Error fetching get-effective-sac:", error);
    return [];
  }
};

// Same endpoint as InvoiceCreate (invoice/calculate-gst-breakup/), payload: { customer_id, reverse_invoice_id }
const fetchReverseInvoiceCalculateGstBreakup = async (payload: {
  customer_id: number;
  reverse_invoice_id: number;
}) => {
  try {
    const response = await postAPICall(
      URL.invoiceCalculateGstBreakup,
      payload,
      API_HEADER,
    );
    return response as {
      sac_wise_totals?: Array<{
        sac_code?: string;
        charge_name?: string;
        total_amount?: number;
        rate?: number;
        rate_type?: string;
        charge_id?: number;
      }>;
      total?: string;
    };
  } catch (error) {
    console.error("Error fetching calculate-gst-breakup for reverse invoice:", error);
    throw error;
  }
};

function clampAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return value === undefined ? null : value;
  const rounded = Math.round(value * 100) / 100;
  const maxVal = 99999999.99;
  if (Math.abs(rounded) > maxVal) return rounded > 0 ? maxVal : -maxVal;
  return rounded;
}

type ChargeItem = {
  id?: number | null;
  charge_id: number | null;
  charge_name: string;
  unit_code: string;
  no_of_unit: number | null;
  currency: string;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null;
  header_amount: number | null;
  amount_in_local: number | null;
  tax_code: string;
  dr_cr: "Cr" | "Dr";
};

type InvoiceFormData = {
  bill_to: string;
  address: string;
  state: string;
  gstn: string;
  shipment_no: string;
  daybook_id: string;
  document_date: Date | null;
  due_date: Date | null;
  currency: string;
  roe: number | null;
  narration: string;
  irn_no: string;
  charges: ChargeItem[];
};

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // API may return DD-MM-YYYY
  const parts = s.split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year) && month >= 0 && month <= 11) {
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

type ReversableDataResponse = {
  id?: number;
  state_id?: number;
  state_name?: string;
  currency_id?: number;
  currency_code?: string;
  bill_to?: string;
  address?: string;
  gstn?: string;
  shipment_no?: string;
  day_book_id?: number;
  day_book_name?: string;
  document_no?: string;
  document_date?: string;
  due_date?: string;
  roe?: string | number;
  narration?: string;
  irn_no?: string;
  status?: string;
  total?: string | number;
  header_total?: string | number;
  Dr_Cr?: string;
  charges?: Array<{
    id?: number;
    charge_id?: number;
    charge_name?: string;
    unit_code?: string;
    currency_code?: string;
    no_of_unit?: string | number;
    roe?: string | number;
    amount_per_unit?: string | number;
    amount?: string | number;
    amount_in_local?: string | number;
    amount_in_header?: string | number;
    tax_code?: string;
    Dr_Cr?: string;
  }>;
};

const inputStyles = {
  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
};

function InvoiceReverse() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const defaultBranchCurrency =
    (user?.branches?.find((b: { is_default?: boolean }) => b.is_default === true) as { currency?: { currency_code?: string } } | undefined)?.currency?.currency_code ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documentNo, setDocumentNo] = useState<string | null>(null);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    customer_id?: number;
    document_no?: string;
    status?: string;
  } | null>(null);
  const [invoiceIsPosted, setInvoiceIsPosted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [chargesTabActive, setChargesTabActive] = useState<string>("charges");
  const [gstBreakup, setGstBreakup] = useState<{
    sac_wise_totals?: Array<{
      sac_code?: string;
      charge_name?: string;
      total_amount?: number;
      rate?: number;
      rate_type?: string;
      charge_id?: number;
    }>;
    total?: string;
  } | null>(null);
  const [gstBreakupLoading, setGstBreakupLoading] = useState(false);
  const [chargeErrors, setChargeErrors] = useState<Record<number, Record<string, string>>>({});

  const jobServiceId =
    (location.state as { job?: { service_id?: number } })?.job?.service_id ?? null;

  const isReadOnly = invoiceIsPosted;

  const form = useForm<InvoiceFormData>({
    initialValues: {
      bill_to: "",
      address: "",
      state: "",
      gstn: "",
      shipment_no: "",
      daybook_id: "",
      document_date: null,
      due_date: null,
      currency: defaultBranchCurrency,
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

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });
  const { data: stateData = [], isLoading: isStateLoading } = useQuery({
    queryKey: ["stateMaster"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });
  const { data: daybookData = [] } = useQuery({
    queryKey: ["daybook", "CRN"],
    queryFn: fetchDaybookCRN,
    staleTime: Infinity,
  });
  const { data: unitData = [] } = useQuery({
    queryKey: ["unitMaster", "AIR"],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
  });

  const currencyOptions = useMemo(() => {
    const data = currencyData as { code?: string; currency_code?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.code || item.currency_code || ""),
      label: `${item.code || item.currency_code || ""}`,
    }));
  }, [currencyData]);

  const stateOptions = useMemo(() => {
    const data = stateData as { id?: number; state_name?: string; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.state_name || item.name || "",
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

  const unitOptions = useMemo(() => {
    const data = unitData as { unit_code?: string; code?: string; id?: number; unit_name?: string; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.unit_code || item.code || item.id || ""),
      label: item.unit_name || item.name || "",
    }));
  }, [unitData]);

  // Helper: ROE based on currency and user's country (same as InvoiceCreate)
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

  // Auto-set ROE when charge currency changes (charge has currency but no ROE)
  const chargeCurrencies = form.values.charges.map((c) => c.currency).join(",");
  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      let roe = charge.roe;
      if (charge.currency && (roe === null || roe === undefined)) {
        roe = getRoeValue(charge.currency);
      }
      if (roe !== charge.roe) {
        return { ...charge, roe: roe ?? null };
      }
      return charge;
    });
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.roe !== form.values.charges[index]?.roe,
    );
    if (hasChanges) form.setFieldValue("charges", updatedCharges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrencies, getRoeValue]);

  // Auto-calculate amount (currency amount) when no_of_unit, amount_per_unit, or roe changes: amount = no_of_unit * roe * amount_per_unit
  const chargeAmountPerUnits = form.values.charges.map((c) => c.amount_per_unit).join(",");
  const chargeNoOfUnits = form.values.charges.map((c) => c.no_of_unit).join(",");
  const chargeRoes = form.values.charges.map((c) => c.roe).join(",");
  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount_per_unit != null && charge.amount_per_unit > 0 &&
        charge.no_of_unit != null && charge.no_of_unit > 0 &&
        charge.roe != null && charge.roe > 0
      ) {
        const calculatedAmount = charge.no_of_unit * charge.roe * charge.amount_per_unit;
        const clamped = clampAmount(calculatedAmount);
        if (clamped != null && clamped > 0 && clamped !== charge.amount) {
          return { ...charge, amount: clamped };
        }
      }
      return charge;
    });
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.amount !== form.values.charges[index]?.amount,
    );
    if (hasChanges) form.setFieldValue("charges", updatedCharges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmountPerUnits, chargeNoOfUnits, chargeRoes]);

  // Auto-calculate amount_in_local when amount or charge roe changes: amount_in_local = amount * roe
  const chargeAmounts = form.values.charges.map((c) => c.amount).join(",");
  const chargeRoesForLocal = form.values.charges.map((c) => c.roe).join(",");
  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount != null && charge.amount > 0 &&
        charge.roe != null && charge.roe > 0
      ) {
        const calculatedLocalAmount = charge.amount * charge.roe;
        const clamped = clampAmount(calculatedLocalAmount);
        if (clamped != null && clamped > 0 && clamped !== charge.amount_in_local) {
          return { ...charge, amount_in_local: clamped };
        }
      }
      return charge;
    });
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.amount_in_local !== form.values.charges[index]?.amount_in_local,
    );
    if (hasChanges) form.setFieldValue("charges", updatedCharges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeAmounts, chargeRoesForLocal]);

  // Auto-calculate header_amount: same currency → header_amount = amount_in_local; different → amount_in_local / header ROE
  const headerBillingCurrency = form.values.currency;
  const headerRoe = form.values.roe;
  const chargeLocalAmounts = form.values.charges.map((c) => c.amount_in_local).join(",");
  const chargeCurrenciesForHeader = form.values.charges.map((c) => c.currency).join(",");
  useEffect(() => {
    const updatedCharges = form.values.charges.map((charge) => {
      if (
        charge.amount_in_local != null && charge.amount_in_local > 0 &&
        headerBillingCurrency && charge.currency
      ) {
        let newHeaderAmount: number | null = null;
        if (headerBillingCurrency.toUpperCase() === String(charge.currency).toUpperCase()) {
          newHeaderAmount = charge.amount_in_local;
        } else if (headerRoe != null && headerRoe > 0) {
          newHeaderAmount = charge.amount_in_local / headerRoe;
        }
        const clampedHeader = clampAmount(newHeaderAmount);
        if (clampedHeader != null && clampedHeader > 0 && clampedHeader !== charge.header_amount) {
          return { ...charge, header_amount: clampedHeader };
        }
      }
      return charge;
    });
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.header_amount !== form.values.charges[index]?.header_amount,
    );
    if (hasChanges) form.setFieldValue("charges", updatedCharges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerBillingCurrency, headerRoe, chargeLocalAmounts, chargeCurrenciesForHeader]);

  useEffect(() => {
    const docNo = (location.state as { document_no?: string } | null)?.document_no;
    if (!docNo?.trim()) {
      setLoadError("Document number is required. Please go back and use Invoice Reverse from the Accounts table.");
      setLoading(false);
      return;
    }
    setDocumentNo(docNo);
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    postAPICall(URL.invoiceReversableData, { document_no: docNo }, API_HEADER)
      .then((res) => {
        if (cancelled) return;
        const data = res as ReversableDataResponse;
        const roeNum =
          data.roe != null
            ? typeof data.roe === "string"
              ? parseFloat(data.roe)
              : data.roe
            : null;
        form.setValues({
          bill_to: data.bill_to ?? "",
          address: data.address ?? "",
          state: data.state_id != null ? String(data.state_id) : "",
          gstn: data.gstn ?? "",
          shipment_no: data.shipment_no ?? "",
          daybook_id: "", // Do not set daybook from response; user selects from CRN-filtered dropdown
          document_date: normalizeDate(data.document_date ?? null),
          due_date: normalizeDate(data.due_date ?? null),
          currency: data.currency_code ?? "",
          roe: Number.isFinite(roeNum) ? roeNum : null,
          narration: data.narration ?? "",
          irn_no: data.irn_no ?? "",
          charges:
            data.charges && data.charges.length > 0
              ? data.charges.map((c) => {
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
                    id: c.id ?? null,
                    charge_id: c.charge_id ?? null,
                    charge_name: c.charge_name ?? "",
                    unit_code: c.unit_code ?? "",
                    no_of_unit: Number.isFinite(noOfUnit) ? noOfUnit : null,
                    currency: c.currency_code ?? "",
                    roe: Number.isFinite(roe) ? roe : null,
                    amount_per_unit: Number.isFinite(amountPerUnit) ? amountPerUnit : null,
                    amount: Number.isFinite(amount) ? amount : null,
                    header_amount: Number.isFinite(headerAmount) ? headerAmount : null,
                    amount_in_local: Number.isFinite(amountInLocal) ? amountInLocal : null,
                    tax_code: c.tax_code ?? "",
                    dr_cr: (c.Dr_Cr === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr",
                  };
                })
              : [],
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err?.message || "Failed to load reversable invoice data.");
          ToastNotification({
            message: err?.message || "Failed to load reversable invoice data.",
            type: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.state]);

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
    fetchReverseInvoiceCalculateGstBreakup({
      customer_id: saveResponse.customer_id,
      reverse_invoice_id: saveResponse.id,
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

  const handlePostInvoiceReverse = async () => {
    if (!saveResponse?.id || saveResponse?.customer_id == null) {
      ToastNotification({
        message: "Save the reverse invoice first and ensure customer_id is available.",
        type: "error",
      });
      return;
    }
    setIsPosting(true);
    try {
      const values = form.values;
      const stateId = Number(values.state);
      const currencyItem = (currencyData as { id?: number; code?: string; currency_code?: string }[])?.find(
        (c) => (c.code || c.currency_code || "").toString() === values.currency,
      );
      const currencyId = currencyItem?.id != null ? Number(currencyItem.id) : null;
      if (!stateId || stateId <= 0 || currencyId == null || currencyId <= 0) {
        ToastNotification({ message: "Please ensure State and Currency are valid.", type: "error" });
        setIsPosting(false);
        return;
      }
      const total = values.charges.reduce((sum, c) => sum + (c.header_amount ?? 0), 0);
      const header_total = total;
      const local_total = values.charges.reduce((sum, c) => sum + (c.amount_in_local ?? 0), 0);
      const formatDateDDMMYYYY = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };
      let breakupData = gstBreakup;
      if (!breakupData?.sac_wise_totals?.length) {
        breakupData = await fetchReverseInvoiceCalculateGstBreakup({
          customer_id: saveResponse.customer_id,
          reverse_invoice_id: saveResponse.id,
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
          (c) => (c.code || c.currency_code || "").toString() === charge.currency,
        );
        const chargeCurrencyId = chargeCurrencyItem?.id != null ? Number(chargeCurrencyItem.id) : null;
        const unitItem = (unitData as { id?: number; unit_code?: string; code?: string }[])?.find(
          (u) => String(u.unit_code || u.code || u.id) === charge.unit_code,
        );
        const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
        return {
          ...(charge.id != null && charge.id > 0 ? { id: charge.id } : {}),
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
          tax_code: charge.tax_code ?? "",
          Dr_Cr: charge.dr_cr ?? "Cr",
        };
      });
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
          tax_code: row.sac_code ?? "",
          Dr_Cr: "Cr",
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
        document_no: documentNo,
        document_date: values.document_date ? formatDateDDMMYYYY(new Date(values.document_date)) : null,
        due_date: values.due_date ? formatDateDDMMYYYY(new Date(values.due_date)) : null,
        currency_id: currencyId,
        roe: values.roe,
        narration: values.narration || null,
        irn_no: values.irn_no || null,
        status: "POSTED",
        total,
        header_total,
        local_total,
        Dr_Cr: "Dr",
        charges: allChargesPayload,
        taxes,
      };
      const response = (await putAPICall(URL.reverseInvoice, payload, API_HEADER)) as
        | { id?: number; customer_id?: number; document_no?: string; status?: string; charges?: Array<{
            charge_id?: number; charge_name?: string; unit_code?: string; currency_code?: string;
            no_of_unit?: string | number; roe?: string | number; amount_per_unit?: string | number;
            amount?: string | number; amount_in_local?: string | number; amount_in_header?: string | number;
            tax_code?: string; Dr_Cr?: string;
          }> }
        | undefined;
      if (response) {
        setSaveResponse((prev) => ({
          ...prev,
          id: response.id,
          customer_id: response.customer_id ?? prev?.customer_id,
          document_no: response.document_no ?? "",
          status: response.status ?? "POSTED",
        }));
        setInvoiceIsPosted(true);
        if (response.charges && Array.isArray(response.charges)) {
          const mappedCharges: ChargeItem[] = response.charges.map((c) => {
            const noOfUnit = c.no_of_unit != null ? (typeof c.no_of_unit === "string" ? parseFloat(c.no_of_unit) : c.no_of_unit) : null;
            const roe = c.roe != null ? (typeof c.roe === "string" ? parseFloat(c.roe) : c.roe) : null;
            const amountPerUnit = c.amount_per_unit != null ? (typeof c.amount_per_unit === "string" ? parseFloat(c.amount_per_unit) : c.amount_per_unit) : null;
            const amount = c.amount != null ? (typeof c.amount === "string" ? parseFloat(c.amount) : c.amount) : null;
            const amountInLocal = c.amount_in_local != null ? (typeof c.amount_in_local === "string" ? parseFloat(c.amount_in_local) : c.amount_in_local) : null;
            const headerAmount = c.amount_in_header != null ? (typeof c.amount_in_header === "string" ? parseFloat(c.amount_in_header) : c.amount_in_header) : null;
            return {
              charge_id: c.charge_id ?? null,
              charge_name: c.charge_name ?? "",
              unit_code: c.unit_code ?? "",
              no_of_unit: Number.isFinite(noOfUnit) ? noOfUnit : null,
              currency: c.currency_code ?? "",
              roe: Number.isFinite(roe) ? roe : null,
              amount_per_unit: Number.isFinite(amountPerUnit) ? amountPerUnit : null,
              amount: Number.isFinite(amount) ? amount : null,
              header_amount: Number.isFinite(headerAmount) ? headerAmount : null,
              amount_in_local: Number.isFinite(amountInLocal) ? amountInLocal : null,
              tax_code: c.tax_code ?? "",
              dr_cr: (c as { Dr_Cr?: string }).Dr_Cr === "Dr" ? "Dr" : "Cr",
            };
          });
          form.setFieldValue("charges", mappedCharges);
        }
        ToastNotification({ message: "Reverse invoice posted successfully", type: "success" });
      }
    } catch (error: unknown) {
      console.error("Error posting reverse invoice:", error);
      ToastNotification({
        message: (error as { message?: string })?.message ?? "Failed to post reverse invoice",
        type: "error",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleSubmit = async (values: InvoiceFormData) => {
    if (!documentNo?.trim()) {
      ToastNotification({ message: "Document number is missing.", type: "error" });
      return;
    }
    // Validate charges: charge, currency, roe, amount, amount_in_local, tax_code
    const chargeErrs: Record<number, Record<string, string>> = {};
    const invalidCharges = values.charges.some((charge, index) => {
      const err: Record<string, string> = {};
      if (!charge.charge_name && charge.charge_id == null) err.charge_name = "Charge is required";
      if (!charge.currency) err.currency = "Currency is required";
      if (charge.roe === null || charge.roe === undefined) err.roe = "ROE is required";
      if (charge.amount === null || charge.amount === undefined) err.amount = "Currency Amount is required";
      if (charge.amount_in_local === null || charge.amount_in_local === undefined) err.amount_in_local = "Local Amount is required";
      if (!charge.tax_code?.trim()) err.tax_code = "SAC Code is required";
      if (Object.keys(err).length > 0) {
        chargeErrs[index] = err;
        return true;
      }
      return false;
    });
    if (invalidCharges) {
      setChargeErrors(chargeErrs);
      ToastNotification({
        message: "Please fill all required fields in charges section (Charge, Currency, ROE, Currency Amount, Local Amount, SAC Code).",
        type: "error",
      });
      return;
    }
    setChargeErrors({});
    setIsSubmitting(true);
    try {
      const stateId = Number(values.state);
      const currencyItem = (currencyData as { id?: number; code?: string; currency_code?: string }[])?.find(
        (c) => (c.code || c.currency_code || "").toString() === values.currency,
      );
      const currencyId = currencyItem?.id != null ? Number(currencyItem.id) : null;
      if (!stateId || stateId <= 0 || currencyId == null || currencyId <= 0) {
        ToastNotification({ message: "Please select valid State and Billing Currency.", type: "error" });
        setIsSubmitting(false);
        return;
      }
      const total = values.charges.reduce((sum, c) => sum + (c.header_amount ?? 0), 0);
      const header_total = total;
      const local_total = values.charges.reduce((sum, c) => sum + (c.amount_in_local ?? 0), 0);
      const formatDateDDMMYYYY = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      };
      const isUpdate = saveResponse?.id != null && saveResponse.id > 0;
      const chargesPayload = values.charges.map((charge) => {
        const chargeCurrencyItem = (currencyData as { id?: number; code?: string; currency_code?: string }[])?.find(
          (c) => (c.code || c.currency_code || "").toString() === charge.currency,
        );
        const chargeCurrencyId = chargeCurrencyItem?.id != null ? Number(chargeCurrencyItem.id) : null;
        const unitItem = (unitData as { id?: number; unit_code?: string; code?: string }[])?.find(
          (u) => String(u.unit_code || u.code || u.id) === charge.unit_code,
        );
        const unitId = unitItem?.id != null ? Number(unitItem.id) : null;
        return {
          ...(isUpdate && charge.id != null && charge.id > 0 ? { id: charge.id } : {}),
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
          tax_code: charge.tax_code ?? "",
          Dr_Cr: charge.dr_cr ?? "Cr",
        };
      });
      const payload = {
        ...(isUpdate ? { id: saveResponse.id } : {}),
        bill_to: values.bill_to,
        address: values.address,
        state_id: stateId,
        gstn: values.gstn || null,
        shipment_no: values.shipment_no,
        daybook_id: values.daybook_id ? Number(values.daybook_id) : null,
        document_no: documentNo,
        document_date: values.document_date ? formatDateDDMMYYYY(new Date(values.document_date)) : null,
        due_date: values.due_date ? formatDateDDMMYYYY(new Date(values.due_date)) : null,
        currency_id: currencyId,
        roe: values.roe,
        narration: values.narration || null,
        irn_no: values.irn_no || null,
        status: "UNPOSTED",
        total,
        header_total,
        local_total,
        Dr_Cr: "Dr",
        charges: chargesPayload,
      };
      if (isUpdate) {
        const response = (await putAPICall(URL.reverseInvoice, payload, API_HEADER)) as
          | { id?: number; document_no?: string; status?: string }
          | undefined;
        if (response) {
          const res = response as {
            id?: number;
            customer_id?: number;
            document_no?: string;
            status?: string;
            charges?: Array<{ id?: number }>;
          };
          setSaveResponse((prev) => ({
            ...prev,
            id: res.id ?? prev?.id,
            customer_id: res.customer_id ?? prev?.customer_id,
            document_no: res.document_no ?? prev?.document_no ?? "",
            status: res.status ?? prev?.status ?? "UNPOSTED",
          }));
          // Merge returned charge ids into form (e.g. new charges created by this PUT)
          if (res.charges && Array.isArray(res.charges)) {
            const updatedCharges = form.values.charges.map((c, i) => ({
              ...c,
              id: res.charges![i]?.id ?? c.id,
            }));
            form.setFieldValue("charges", updatedCharges);
          }
          ToastNotification({ message: "Reverse invoice updated successfully", type: "success" });
        }
      } else {
        const response = (await postAPICall(URL.reverseInvoice, payload, API_HEADER)) as
          | { id?: number; document_no?: string; status?: string }
          | undefined;
        if (response) {
          const res = response as {
            id?: number;
            customer_id?: number;
            document_no?: string;
            status?: string;
            charges?: Array<{ id?: number }>;
          };
          setSaveResponse({
            id: res.id,
            customer_id: res.customer_id,
            document_no: res.document_no ?? "",
            status: res.status ?? "UNPOSTED",
          });
          // Merge returned charge ids into form so Update (PUT) sends id for existing charges
          if (res.charges && Array.isArray(res.charges)) {
            const updatedCharges = form.values.charges.map((c, i) => ({
              ...c,
              id: res.charges![i]?.id ?? c.id,
            }));
            form.setFieldValue("charges", updatedCharges);
          }
          const statusUpper = (res.status ?? "").toUpperCase();
          setInvoiceIsPosted(statusUpper === "POSTED");
          ToastNotification({ message: "Reverse invoice saved successfully", type: "success" });
        }
      }
    } catch (error: unknown) {
      console.error("Error saving reverse invoice:", error);
      ToastNotification({
        message: (error as { message?: string })?.message ?? "Failed to save reverse invoice",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box p="md">
        <Stack align="center" justify="center" py="xl" gap="md">
          <Loader size="lg" color="#105476" />
          <Text size="sm" c="#105476" fw={500}>
            Loading invoice data...
          </Text>
        </Stack>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="xl" fw={600} c="#105476">
              Invoice Reverse
            </Text>
            <Button variant="outline" color="#105476" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
              Back
            </Button>
          </Group>
          <Text size="sm" c="red">
            {loadError}
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box p="md" style={{ position: "relative" }}>
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
              {isPosting ? "Posting..." : saveResponse?.id ? "Updating..." : "Saving..."}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text size="xl" fw={600} c="#105476">
            Invoice Reverse
          </Text>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">
                    {saveResponse.status?.toUpperCase() === "POSTED" ? "Reverse Invoice Number" : "Draft Reverse Invoice Number"}
                  </Text>
                  <Badge size="sm" variant="light" color="#105476" styles={{ root: { textTransform: "none" } }}>
                    {saveResponse.document_no || documentNo || "—"}
                  </Badge>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">Status:</Text>
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
            {/* {documentNo && !saveResponse && (
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} c="dimmed">Original Document No</Text>
                <Badge size="sm" variant="light" color="#105476" styles={{ root: { textTransform: "none" } }}>
                  {documentNo}
                </Badge>
              </Group>
            )} */}
            <Button variant="outline" color="#105476" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
              Back
            </Button>
          </Group>
        </Group>

        <Box
          component="form"
          onSubmit={isReadOnly ? (e) => e.preventDefault() : form.onSubmit(handleSubmit)}
          style={
            isReadOnly
              ? { opacity: 0.92, backgroundColor: "#f5f5f5", borderRadius: 8, padding: 16 }
              : undefined
          }
        >
          <Grid>
            <Grid.Col span={4}>
              <TextInput
                label="Bill To"
                placeholder="Bill To"
                value={form.values.bill_to}
                onChange={(e) => form.setFieldValue("bill_to", e.target.value)}
                disabled={isReadOnly}
                withAsterisk
                error={form.errors.bill_to}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="State"
                placeholder={isStateLoading ? "Loading states" : "Select state"}
                data={stateOptions}
                value={form.values.state || null}
                onChange={(value) => form.setFieldValue("state", value ?? "")}
                searchable
                withAsterisk
                disabled={isStateLoading || isReadOnly}
                error={form.errors.state}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="GSTN"
                placeholder="GSTN"
                value={form.values.gstn}
                onChange={(e) => form.setFieldValue("gstn", e.target.value)}
                disabled={isReadOnly}
                error={form.errors.gstn}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="Shipment No"
                placeholder="Shipment No"
                value={form.values.shipment_no}
                onChange={(e) => form.setFieldValue("shipment_no", e.target.value)}
                disabled={isReadOnly}
                withAsterisk
                error={form.errors.shipment_no}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="Daybook"
                placeholder="Select daybook"
                data={daybookOptions}
                value={form.values.daybook_id || null}
                onChange={(value) => form.setFieldValue("daybook_id", value ?? "")}
                searchable
                withAsterisk
                disabled={isReadOnly}
                error={form.errors.daybook_id}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <SingleDateInput
                label="Document Date"
                placeholder="Document Date"
                value={normalizeDate(form.values.document_date)}
                onChange={(date) => form.setFieldValue("document_date", date)}
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
            <Grid.Col span={2}>
              <SingleDateInput
                label="Due Date"
                placeholder="Due Date"
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
            <Grid.Col span={2}>
              <Dropdown
                label="Billing Currency"
                placeholder="Select currency"
                data={currencyOptions}
                value={form.values.currency || null}
                onChange={(value) => form.setFieldValue("currency", value ?? "")}
                searchable
                withAsterisk
                disabled={isReadOnly}
                error={form.errors.currency}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <NumberInput
                label="ROE"
                placeholder="ROE"
                value={form.values.roe ?? undefined}
                onChange={(value) => form.setFieldValue("roe", typeof value === "number" ? value : value === "" ? null : parseFloat(String(value)) || null)}
                disabled={isReadOnly}
                withAsterisk
                min={0}
                decimalScale={4}
                error={form.errors.roe}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="IRN No"
                placeholder="IRN No"
                value={form.values.irn_no}
                onChange={(e) => form.setFieldValue("irn_no", e.target.value)}
                disabled={isReadOnly}
                error={form.errors.irn_no}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Address"
                placeholder="Address"
                value={form.values.address}
                onChange={(e) => form.setFieldValue("address", e.target.value)}
                disabled={isReadOnly}
                withAsterisk
                error={form.errors.address}
                styles={inputStyles}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Textarea
                label="Narration"
                placeholder="Narration"
                value={form.values.narration}
                onChange={(e) => form.setFieldValue("narration", e.target.value)}
                disabled={isReadOnly}
                rows={2}
                error={form.errors.narration}
                styles={{ input: { fontSize: "13px", fontFamily: "Inter" }, label: inputStyles.label }}
              />
            </Grid.Col>
          </Grid>

          <Box mt="md">
            <Tabs
              variant="default"
              color="#105476"
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
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Unit</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Currency</Grid.Col>
                    <Grid.Col span={0.75} style={{ fontSize: "13px" }}>ROE</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>No of Unit</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Amount per Unit</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Currency Amount</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Amount in {form.values.currency ? form.values.currency.toUpperCase() : "()"}
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>Local Amount</Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>SAC Code</Grid.Col>
                    <Grid.Col span={0.75} style={{ fontSize: "13px" }}>Dr/Cr</Grid.Col>
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
                          value={charge.charge_id != null ? String(charge.charge_id) : null}
                          displayValue={charge.charge_name || undefined}
                          onChange={(value, selectedData) => {
                            const chargeId = value ? Number(value) : null;
                            const chargeName = selectedData?.label ?? "";
                            form.setFieldValue(`charges.${index}.charge_id`, chargeId);
                            form.setFieldValue(`charges.${index}.charge_name`, chargeName);
                            form.setFieldValue(`charges.${index}.tax_code`, "");
                            if (chargeErrors[index]?.charge_name) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].charge_name;
                                if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                            if (chargeId != null && jobServiceId != null) {
                              fetchGetEffectiveSac([{ charge_id: chargeId, service_id: jobServiceId }]).then((data) => {
                                const item = data.find((x) => x.charge_id === chargeId);
                                if (item?.sac_code != null && item.sac_code !== "") {
                                  form.setFieldValue(`charges.${index}.tax_code`, item.sac_code);
                                  if (chargeErrors[index]?.tax_code) {
                                    const newErrors = { ...chargeErrors };
                                    if (newErrors[index]) {
                                      delete newErrors[index].tax_code;
                                      if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                                    }
                                    setChargeErrors(newErrors);
                                  }
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
                            input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Unit"
                          data={unitOptions}
                          value={charge.unit_code || null}
                          onChange={(value) => form.setFieldValue(`charges.${index}.unit_code`, value ?? "")}
                          searchable
                          disabled={isReadOnly}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Currency"
                          data={currencyOptions}
                          value={charge.currency || null}
                          onChange={(value) => {
                            form.setFieldValue(`charges.${index}.currency`, value ?? "");
                            if (chargeErrors[index]?.currency) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].currency;
                                if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          searchable
                          withAsterisk
                          disabled={isReadOnly}
                          error={chargeErrors[index]?.currency}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.75}>
                        <NumberInput
                          placeholder="ROE"
                          value={charge.roe ?? undefined}
                          onChange={(v) => {
                            form.setFieldValue(`charges.${index}.roe`, typeof v === "number" ? v : v === "" ? null : parseFloat(String(v)) || null);
                            if (chargeErrors[index]?.roe) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].roe;
                                if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          hideControls
                          withAsterisk
                          disabled={isReadOnly}
                          error={chargeErrors[index]?.roe}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          value={charge.no_of_unit ?? undefined}
                          onChange={(v) => form.setFieldValue(`charges.${index}.no_of_unit`, typeof v === "number" ? v : v === "" ? null : parseFloat(String(v)) || null)}
                          min={0}
                          hideControls
                          disabled={isReadOnly}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          value={charge.amount_per_unit ?? undefined}
                          onChange={(v) => form.setFieldValue(`charges.${index}.amount_per_unit`, typeof v === "number" ? v : v === "" ? null : parseFloat(String(v)) || null)}
                          min={0}
                          decimalScale={2}
                          hideControls
                          disabled={isReadOnly}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          placeholder="Currency Amount"
                          value={charge.amount ?? undefined}
                          onChange={(v) => {
                            form.setFieldValue(`charges.${index}.amount`, typeof v === "number" ? v : v === "" ? null : parseFloat(String(v)) || null);
                            if (chargeErrors[index]?.amount) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].amount;
                                if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          min={0}
                          decimalScale={2}
                          hideControls
                          withAsterisk
                          disabled={isReadOnly}
                          error={chargeErrors[index]?.amount}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          value={charge.header_amount ?? undefined}
                          onChange={(v) => form.setFieldValue(`charges.${index}.header_amount`, typeof v === "number" ? v : v === "" ? null : parseFloat(String(v)) || null)}
                          min={0}
                          decimalScale={2}
                          hideControls
                          disabled={isReadOnly}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          placeholder="Local Amount"
                          value={charge.amount_in_local ?? undefined}
                          onChange={(v) => {
                            form.setFieldValue(`charges.${index}.amount_in_local`, typeof v === "number" ? v : v === "" ? null : parseFloat(String(v)) || null);
                            if (chargeErrors[index]?.amount_in_local) {
                              const newErrors = { ...chargeErrors };
                              if (newErrors[index]) {
                                delete newErrors[index].amount_in_local;
                                if (Object.keys(newErrors[index]).length === 0) delete newErrors[index];
                              }
                              setChargeErrors(newErrors);
                            }
                          }}
                          min={0}
                          decimalScale={2}
                          hideControls
                          withAsterisk
                          disabled={isReadOnly}
                          error={chargeErrors[index]?.amount_in_local}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <TextInput
                          placeholder="SAC Code"
                          withAsterisk
                          readOnly
                          value={charge.tax_code}
                          disabled={isReadOnly}
                          error={chargeErrors[index]?.tax_code}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.75}>
                        <Dropdown
                          placeholder="Dr/Cr"
                          data={[
                            { value: "Cr", label: "Cr" },
                            { value: "Dr", label: "Dr" },
                          ]}
                          value={charge.dr_cr ?? "Cr"}
                          onChange={(value) => form.setFieldValue(`charges.${index}.dr_cr`, (value === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr")}
                          disabled={isReadOnly}
                          styles={{ input: { fontSize: "13px", fontFamily: "Inter", height: "36px" } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={0.5}>
                        {!isReadOnly && (
                          <Group gap="xs">
                            {form.values.charges.length > 1 && (
                              <Button
                                variant="light"
                                color="red"
                                size="sm"
                                px={12}
                                onClick={() => form.removeListItem("charges", index)}
                              >
                                <IconTrash size={16} />
                              </Button>
                            )}
                            {/* Add charge disabled on invoice reverse – charges can only be deleted */}
                            {/* {form.values.charges.length - 1 === index && (
                              <Button
                                radius="sm"
                                px={12}
                                size="sm"
                                variant="light"
                                color="#105476"
                                onClick={() => {
                                  const newCurrency = form.values.currency || "";
                                  form.insertListItem("charges", {
                                    charge_id: null,
                                    charge_name: "",
                                    unit_code: "",
                                    no_of_unit: null,
                                    currency: newCurrency,
                                    roe: null,
                                    amount_per_unit: null,
                                    amount: null,
                                    header_amount: null,
                                    amount_in_local: null,
                                    tax_code: "",
                                    dr_cr: "Cr",
                                  });
                                }}
                              >
                                <IconPlus size={16} />
                              </Button>
                            )} */}
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
                              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>SAC</Table.Th>
                              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>Charge Name</Table.Th>
                              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>Rate</Table.Th>
                              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>Amount</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {(gstBreakup.sac_wise_totals ?? []).map((row, idx) => (
                              <Table.Tr key={idx}>
                                <Table.Td style={{ fontSize: "13px" }}>{row.sac_code ?? "—"}</Table.Td>
                                <Table.Td style={{ fontSize: "13px" }}>{row.charge_name ?? "—"}</Table.Td>
                                <Table.Td style={{ fontSize: "13px" }}>
                                  {row.rate != null && row.rate_type != null
                                    ? `${row.rate}${row.rate_type}`
                                    : "—"}
                                </Table.Td>
                                <Table.Td style={{ fontSize: "13px" }}>
                                  {row.total_amount != null ? Number(row.total_amount) : "—"}
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                          <Table.Tfoot>
                            <Table.Tr>
                              <Table.Td style={{ fontSize: "13px" }} />
                              <Table.Td style={{ fontSize: "13px" }} />
                              <Table.Td style={{ fontSize: "13px", fontWeight: 600, color: "#105476" }}>
                                Total:
                              </Table.Td>
                              <Table.Td style={{ fontSize: "13px", fontWeight: 600, color: "#105476" }}>
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
                        Save the reverse invoice to load GST breakup (customer_id from response is required).
                      </Text>
                    )}
                </Tabs.Panel>
              )}
            </Tabs>
          </Box>

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" color="#105476" onClick={() => navigate(-1)}>
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
                  {saveResponse?.id ? "Update Invoice Reverse" : "Save Invoice Reverse"}
                </Button>
                {saveResponse &&
                  saveResponse.status?.toUpperCase() === "UNPOSTED" &&
                  !invoiceIsPosted && (
                    <Button
                      type="button"
                      color="black"
                      variant="filled"
                      loading={isPosting}
                      onClick={handlePostInvoiceReverse}
                    >
                      Post Invoice Reverse
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

export default InvoiceReverse;
