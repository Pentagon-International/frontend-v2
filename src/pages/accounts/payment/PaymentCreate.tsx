import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Loader,
  Modal,
  NumberInput,
  Stack,
  Table,
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
  IconFileInvoice,
} from "@tabler/icons-react";
import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

const PAYMENT_TYPE_OPTIONS = [
  { value: "CHEQUE", label: "CHEQUE" },
  { value: "ONLINE", label: "ONLINE" },
  { value: "CASH", label: "CASH" },
  { value: "NEFT", label: "NEFT" },
];

const DR_CR_OPTIONS = [
  { value: "Cr", label: "Cr" },
  { value: "Dr", label: "Dr" },
];

const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    return response;
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

function getRoeValue(
  currency: string,
  countryCode: string | undefined,
): number {
  const currencyUpper = currency?.toUpperCase();
  if (countryCode === "IN") {
    if (currencyUpper === "INR") return 1;
    if (currencyUpper === "USD") return 88.75;
  } else if (countryCode === "AE") {
    if (currencyUpper === "AED") return 1;
    if (currencyUpper === "USD") return 3.67;
  }
  return 1;
}

// Header daybook: document_type PMT for Payment
const fetchDaybookPMT = async () => {
  try {
    const payload = { filters: { document_type: "PMT" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (PMT):", error);
    return [];
  }
};

// Adjustments/allocations section daybook: document_type CRJ for Payment
const fetchDaybookCRJ = async () => {
  try {
    const payload = { filters: { document_type: "CRJ" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (CRJ):", error);
    return [];
  }
};

const ROE_MAX = 99999999999.9999;

function clampROE(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value))
    return value === undefined ? null : value;
  const rounded = Math.round(value * 10000) / 10000;
  if (Math.abs(rounded) > ROE_MAX) return rounded > 0 ? ROE_MAX : -ROE_MAX;
  return rounded;
}

const AMOUNT_MAX = 9999999999999.99;

function clampAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value))
    return value === undefined ? null : value;
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded) > AMOUNT_MAX)
    return rounded > 0 ? AMOUNT_MAX : -AMOUNT_MAX;
  return rounded;
}

type DetailRow = {
  id?: number | null;
  subledger_id?: string | null;
  customer_code: string;
  customer_display: string;
  narration: string;
  currency: string;
  roe: number | null;
  amount: number | null;
  local_amount: number | null;
  dr_cr: "Cr" | "Dr";
};

type AdjustmentRow = {
  id?: number | null;
  invoice_id?: number | null;
  location: string;
  type: string;
  subledger: string;
  subledger_display: string;
  daybook_id: string;
  document_no: string;
  doc_date: Date | null;
  currency: string;
  roe: number | null;
  adj_curr_amount: number | null;
  adj_local_amount: number | null;
};

/** Supplier invoice item from filter/supplier-invoice response */
type SupplierInvoiceItem = {
  id?: number;
  crj_number?: string;
  date?: string;
  approved_amount?: string | number;
  Inv_crn_amount?: string | number;
  currency_code?: string;
  day_book_id?: number;
  agent_name?: string;
  agent_code?: string;
  [key: string]: unknown;
};

const fetchFilterSupplierInvoice = async (
  agentName: string,
): Promise<SupplierInvoiceItem[]> => {
  const response = await postAPICall(
    URL.supplierInvoiceFilter,
    { filters: { status: "POSTED", agent_name: agentName } },
    API_HEADER,
  );
  const res = response as
    | { data?: SupplierInvoiceItem[] }
    | SupplierInvoiceItem[];
  const data = Array.isArray(res) ? res : res?.data;
  return Array.isArray(data) ? data : [];
};

type PaymentListItem = {
  id?: number;
  payment_no?: string;
  status?: string;
  date?: string;
  day_book_id?: number;
  day_book_name?: string;
  day_book_code?: string;
  type?: string;
  currency_code?: string;
  currency_id?: number;
  roe?: string | number;
  amount?: string | number;
  local_amount?: string | number;
  narration?: string;
  note?: string;
  account_code?: string;
  received_from?: string;
  bank?: string;
  branch?: string;
  cheque_no?: string;
  chq_clrd_date?: string | null;
  dr_cr?: string;
  parties?: Array<{
    id?: number;
    subledger_id?: number;
    subledger_code?: string;
    subledger_name?: string;
    narration?: string;
    currency_code?: string;
    currency_id?: number;
    roe?: string | number;
    amount?: string | number;
    local_amount?: string | number;
    dr_cr?: string;
  }>;
  allocations?: Array<{
    id?: number;
    invoice_id?: number;
    supplier_invoice_id?: number;
    invoice_roe?: string | number;
    subledger_id?: number;
    subledger_code?: string;
    subledger_name?: string;
    location?: string;
    type?: string;
    type_name?: string;
    type_id?: number;
    day_book_id?: number;
    day_book_name?: string;
    day_book_code?: string;
    document_no?: string;
    document_date?: string;
    adj_curr_amount?: string | number;
    adj_local_amount?: string | number;
    currency_code?: string;
    currency_id?: number;
    roe?: string | number;
  }>;
  [key: string]: unknown;
};

type PaymentFormValues = {
  daybook_id: string;
  type: string;
  date: Date | null;
  currency: string;
  roe: number | null;
  amount: number | null;
  local_amount: number | null;
  narration: string;
  bank: string;
  branch: string;
  cheque_no: string;
  cheque_date: Date | null;
  details: DetailRow[];
  adjustments: AdjustmentRow[];
};

const getDefaultDetailRow = (localCurrency: string): DetailRow => ({
  subledger_id: null,
  customer_code: "",
  customer_display: "",
  narration: "",
  currency: localCurrency,
  roe: 1,
  amount: null,
  local_amount: null,
  dr_cr: "Cr",
});

const getDefaultAdjustmentRow = (localCurrency: string): AdjustmentRow => ({
  location: "",
  type: "",
  subledger: "",
  subledger_display: "",
  daybook_id: "",
  document_no: "",
  doc_date: null,
  currency: localCurrency,
  roe: null,
  adj_curr_amount: null,
  adj_local_amount: null,
  invoice_id: null,
});

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === undefined) return null;
  if (value instanceof Date) return value;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateDDMMYYYY(date: Date | null | undefined): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}-${m}-${y}`;
}

const fieldStyles = {
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
  label: fieldStyles.label,
};

const reversalNonEditableStyles = {
  root: {
    opacity: 1,
    pointerEvents: "none" as const,
  },
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
    backgroundColor: "#f5f5f5",
    cursor: "default",
    opacity: 1,
    pointerEvents: "none" as const,
  },
  label: fieldStyles.label,
};

function parseDocumentDate(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim();
  const parts = s.split("-");
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const day = parseInt(a, 10);
    const month = parseInt(b, 10) - 1;
    const year = parseInt(c, 10);
    if (
      c.length === 4 &&
      !isNaN(day) &&
      !isNaN(month) &&
      !isNaN(year) &&
      month >= 0 &&
      month <= 11
    ) {
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    if (a.length === 4) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDocumentDateDisplay(value: string | null | undefined): string {
  const d = parseDocumentDate(value);
  return d ? d.toLocaleDateString() : "—";
}

type PaymentCreateProps = {
  titleOverride?: string;
  backPath?: string;
};

export default function PaymentCreate({
  titleOverride = "Create Payment",
  backPath = "/payment",
}: PaymentCreateProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [loadedDetails, setLoadedDetails] = useState<DetailRow[] | null>(null);

  const defaultBranch =
    user?.branches?.find((b) => b.is_default) || user?.branches?.[0];
  const localCurrency =
    (defaultBranch as { currency?: { currency_code?: string } } | undefined)
      ?.currency?.currency_code ?? "";

  const [dropdownZIndex] = useState(300);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceModalDetailRowIndex, setInvoiceModalDetailRowIndex] = useState<
    number | null
  >(null);
  const [invoiceModalBillTo, setInvoiceModalBillTo] = useState<string | null>(
    null,
  );
  const [supplierInvoiceList, setSupplierInvoiceList] = useState<
    SupplierInvoiceItem[]
  >([]);
  const [selectedInvoiceIndices, setSelectedInvoiceIndices] = useState<
    Set<number>
  >(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    payment_no?: string;
    document_no?: string;
    status?: string;
  } | null>(null);

  const branchCode =
    (defaultBranch as { branch_code?: string } | undefined)?.branch_code ?? "";

  const form = useForm<PaymentFormValues>({
    initialValues: {
      daybook_id: "",
      type: "CASH",
      date: new Date(),
      currency: localCurrency,
      roe: 1,
      amount: null,
      local_amount: null,
      narration: "",
      bank: "",
      branch: "",
      cheque_no: "",
      cheque_date: null,
      details: [getDefaultDetailRow(localCurrency)],
      adjustments: [getDefaultAdjustmentRow(localCurrency)],
    },
    validate: {
      daybook_id: (v) => (!v ? "Daybook is required" : null),
      type: (v) => (!v ? "Type is required" : null),
      date: (v) => (!v ? "Date is required" : null),
      currency: (v) => (!v ? "Currency is required" : null),
    },
  });

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  const { data: daybookDataPMT = [] } = useQuery({
    queryKey: ["daybook", "PMT"],
    queryFn: fetchDaybookPMT,
    staleTime: Infinity,
  });

  const { data: daybookDataForAdjustments = [] } = useQuery({
    queryKey: ["daybook", "CRJ"],
    queryFn: fetchDaybookCRJ,
    staleTime: Infinity,
  });

  const {
    data: filterSupplierInvoiceData,
    isLoading: filterSupplierInvoiceLoading,
    isFetching: filterSupplierInvoiceFetching,
    isError: filterSupplierInvoiceError,
  } = useQuery({
    queryKey: ["filterSupplierInvoice", invoiceModalBillTo ?? ""],
    queryFn: () => fetchFilterSupplierInvoice(invoiceModalBillTo!),
    enabled: invoiceModalOpen && !!invoiceModalBillTo,
    staleTime: 5 * 60 * 1000,
  });

  const currencyOptions = useMemo(() => {
    const data = currencyData as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const code = (item.currency_code ?? item.code ?? "").toString().trim();
        return { value: code, label: code ? code.toUpperCase() : "" };
      })
      .filter((o) => o.value !== "");
  }, [currencyData]);

  const daybookOptions = useMemo(() => {
    const data = daybookDataPMT as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookDataPMT]);

  const daybookAdjustmentOptions = useMemo(() => {
    const data = daybookDataForAdjustments as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookDataForAdjustments]);

  const currencyIdByCode = useMemo(() => {
    const data = currencyData as {
      id?: number;
      currency_code?: string;
      code?: string;
    }[];
    if (!Array.isArray(data)) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const code = (item.currency_code ?? item.code ?? "")
        .toString()
        .trim()
        .toUpperCase();
      if (code && item.id != null) map[code] = Number(item.id);
    });
    return map;
  }, [currencyData]);

  useEffect(() => {
    if (!localCurrency || form.values.currency) return;
    form.setFieldValue("currency", localCurrency);
  }, [localCurrency]);

  const paymentFromState = location.state as PaymentListItem | null | undefined;
  const pathname = location.pathname;

  // Load edit/view data from payment list (state passed when navigating from PaymentMaster)
  useEffect(() => {
    if (!paymentFromState || paymentFromState.id == null || !localCurrency) {
      if (!paymentFromState) setLoadedDetails(null);
      return;
    }
    const parseNum = (v: string | number | null | undefined): number | null => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };

    const dateVal = parseDocumentDate(paymentFromState.date);
    const chqDateVal = parseDocumentDate(paymentFromState.chq_clrd_date);
    const roeVal = parseNum(paymentFromState.roe);
    const amountVal = parseNum(paymentFromState.amount);
    const localAmountVal = parseNum(paymentFromState.local_amount);

    // Map list response parties: subledger_code, subledger_name (list) -> customer_code, customer_display (form)
    const parties = Array.isArray(paymentFromState.parties)
      ? paymentFromState.parties
      : [];
    const details: DetailRow[] =
      parties.length > 0
        ? parties.map((p) => {
            const pAny = p as {
              id?: number;
              subledger_id?: number | string;
              subledger_code?: string;
              subledger_name?: string;
              account_code?: string;
              subledger?: string;
              narration?: string;
              currency_code?: string;
              roe?: string | number;
              amount?: string | number;
              local_amount?: string | number;
              dr_cr?: string;
            };
            return {
              id: pAny.id ?? null,
              subledger_id:
                pAny.subledger_id != null ? String(pAny.subledger_id) : null,
              customer_code: String(
                pAny.subledger_code ?? pAny.account_code ?? "",
              ).trim(),
              customer_display: String(
                pAny.subledger_name ?? pAny.subledger ?? "",
              ).trim(),
              narration: String(pAny.narration ?? "").trim(),
              currency: (pAny.currency_code ?? localCurrency).toString().trim(),
              roe: parseNum(pAny.roe) ?? 1,
              amount: parseNum(pAny.amount),
              local_amount: parseNum(pAny.local_amount),
              dr_cr: (pAny.dr_cr === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr",
            };
          })
        : [getDefaultDetailRow(localCurrency)];

    // Map list response allocations: document_no, document_date, subledger_code, subledger_name, day_book_id, type, location, supplier_invoice_id, adj_curr_amount, adj_local_amount
    const allocations = paymentFromState.allocations;
    const adjustments: AdjustmentRow[] =
      Array.isArray(allocations) && allocations.length > 0
        ? allocations.map((a) => {
            const aAny = a as {
              id?: number;
              supplier_invoice_id?: number;
              invoice_id?: number;
              invoice_roe?: string | number;
              roe?: string | number;
              location?: string;
              type?: string;
              type_name?: string;
              subledger_code?: string;
              subledger_name?: string;
              subledger?: string;
              day_book_id?: number;
              document_no?: string;
              document_date?: string;
              currency_code?: string;
              adj_curr_amount?: string | number;
              adj_local_amount?: string | number;
            };
            const roeFromApi = aAny.invoice_roe ?? aAny.roe;
            return {
              id: aAny.id ?? null,
              invoice_id:
                aAny.supplier_invoice_id != null
                  ? Number(aAny.supplier_invoice_id)
                  : aAny.invoice_id != null
                    ? Number(aAny.invoice_id)
                    : null,
              location: String(aAny.location ?? "").trim(),
              type: String(aAny.type ?? aAny.type_name ?? "").trim(),
              subledger: String(aAny.subledger_code ?? aAny.subledger ?? "").trim(),
              subledger_display: String(
                aAny.subledger_name ?? aAny.subledger ?? "",
              ).trim(),
              daybook_id:
                aAny.day_book_id != null ? String(aAny.day_book_id) : "",
              document_no: String(aAny.document_no ?? "").trim(),
              doc_date: parseDocumentDate(aAny.document_date),
              currency: (aAny.currency_code ?? localCurrency).toString().trim(),
              roe: parseNum(roeFromApi),
              adj_curr_amount: parseNum(aAny.adj_curr_amount),
              adj_local_amount: parseNum(aAny.adj_local_amount),
            };
          })
        : [getDefaultAdjustmentRow(localCurrency)];

    setLoadedDetails(details);
    form.setValues({
      daybook_id:
        paymentFromState.day_book_id != null
          ? String(paymentFromState.day_book_id)
          : "",
      type: (paymentFromState.type ?? "CASH").toString().trim(),
      date: dateVal ?? new Date(),
      currency: (paymentFromState.currency_code ?? localCurrency)
        .toString()
        .trim(),
      roe: roeVal ?? 1,
      amount: amountVal,
      local_amount: localAmountVal,
      narration: (paymentFromState.narration ?? "").toString(),
      bank: (paymentFromState.bank ?? "").toString(),
      branch: (paymentFromState.branch ?? "").toString(),
      cheque_no: (paymentFromState.cheque_no ?? "").toString(),
      cheque_date: chqDateVal,
      details,
      adjustments,
    });
    if (details.length > 0) form.setFieldValue("details", details);

    const docNo = (
      paymentFromState.payment_no ??
      (paymentFromState as { document_no?: string }).document_no ??
      ""
    ).toString();
    setSaveResponse({
      id: Number(paymentFromState.id),
      payment_no: docNo,
      document_no: docNo,
      status: (paymentFromState.status ?? "UNPOSTED").toString(),
    });
    // Re-run when state changes (e.g. navigating from list to edit/view with different row)
  }, [paymentFromState, localCurrency]);

  const userCountryCode = user?.country?.country_code;

  useEffect(() => {
    const curr = form.values.currency?.trim().toUpperCase();
    if (!curr || !localCurrency) return;
    if (curr === localCurrency.toUpperCase()) {
      form.setFieldValue("roe", 1);
    } else {
      form.setFieldValue("roe", getRoeValue(curr, userCountryCode));
    }
  }, [form.values.currency, localCurrency, userCountryCode]);

  const partyLocalAmountsSnapshot = form.values.details
    .map((d) => d.local_amount ?? "")
    .join(";");
  useEffect(() => {
    const sum = (form.values.details ?? []).reduce(
      (s, d) =>
        s +
        (d.local_amount != null && Number.isFinite(d.local_amount)
          ? d.local_amount
          : 0),
      0,
    );
    const headerLocal = clampAmount(sum);
    const roeVal = form.values.roe;
    const derivedHeaderAmount =
      headerLocal != null &&
      roeVal != null &&
      Number.isFinite(roeVal) &&
      roeVal !== 0
        ? clampAmount(headerLocal / roeVal)
        : null;
    if (form.values.local_amount !== headerLocal) {
      form.setFieldValue("local_amount", headerLocal);
    }
    if (
      derivedHeaderAmount != null &&
      form.values.amount !== derivedHeaderAmount
    ) {
      form.setFieldValue("amount", derivedHeaderAmount);
    }
  }, [partyLocalAmountsSnapshot]);

  useEffect(() => {
    const amt = form.values.amount;
    const roeVal = form.values.roe;
    const local =
      amt != null &&
      Number.isFinite(amt) &&
      roeVal != null &&
      Number.isFinite(roeVal)
        ? clampAmount(amt * roeVal)
        : null;
    if (form.values.local_amount !== local) {
      form.setFieldValue("local_amount", local);
    }
  }, [form.values.amount, form.values.roe]);

  const syncPartyDetailsFromAllocations = (
    adjustmentsToUse?: AdjustmentRow[],
  ) => {
    const adjustments = adjustmentsToUse ?? form.values.adjustments ?? [];
    form.values.details.forEach((row, idx) => {
      const partyCode = (row.customer_code ?? "").toString().trim();
      const partyDisplay = (row.customer_display ?? "").toString().trim();
      const matchingAllocations = adjustments.filter(
        (a) =>
          (partyCode && (a.subledger ?? "").toString().trim() === partyCode) ||
          (partyDisplay &&
            (a.subledger_display ?? "").toString().trim() === partyDisplay),
      );
      if (matchingAllocations.length === 0) return;
      const sum = matchingAllocations.reduce(
        (s, a) =>
          s +
          (a.adj_local_amount != null && Number.isFinite(a.adj_local_amount)
            ? a.adj_local_amount
            : 0),
        0,
      );
      const local = clampAmount(sum);
      const roeVal = row.roe != null && Number.isFinite(row.roe) ? row.roe : 1;
      const derivedAmount =
        local != null &&
        roeVal != null &&
        Number.isFinite(roeVal) &&
        roeVal !== 0
          ? clampAmount(local / roeVal)
          : null;
      if (form.values.details[idx].local_amount !== local) {
        form.setFieldValue(`details.${idx}.local_amount`, local);
      }
      if (
        derivedAmount != null &&
        form.values.details[idx].amount !== derivedAmount
      ) {
        form.setFieldValue(`details.${idx}.amount`, derivedAmount);
      }
    });
  };

  const detailsSnapshotForLocal = form.values.details
    .map(
      (r) =>
        `${r.customer_code}|${r.customer_display}|${r.currency}|${r.amount}|${r.roe}`,
    )
    .join(";");
  useEffect(() => {
    form.values.details.forEach((row, idx) => {
      const amt = row.amount;
      const roeVal = row.roe != null && Number.isFinite(row.roe) ? row.roe : 1;
      const local =
        amt != null && Number.isFinite(amt) ? clampAmount(amt * roeVal) : null;
      if (form.values.details[idx].local_amount !== local) {
        form.setFieldValue(`details.${idx}.local_amount`, local);
      }
    });
  }, [detailsSnapshotForLocal, localCurrency]);

  const showChequeSection = form.values.type === "CHEQUE";

  const addDetailRow = () => {
    setLoadedDetails(null);
    form.insertListItem("details", getDefaultDetailRow(localCurrency));
  };

  const removeDetailRow = (idx: number) => {
    if (form.values.details.length <= 1) return;
    setLoadedDetails(null);
    form.removeListItem("details", idx);
  };

  const addAdjustmentRow = () => {
    form.insertListItem("adjustments", getDefaultAdjustmentRow(localCurrency));
  };

  const removeAdjustmentRow = (idx: number) => {
    if (form.values.adjustments.length <= 1) return;
    form.removeListItem("adjustments", idx);
  };

  const openInvoiceModal = (detailRowIndex: number) => {
    const row = form.values.details[detailRowIndex];
    const agentName =
      row?.customer_display?.trim() || row?.customer_code?.trim();
    if (!agentName) return;
    setInvoiceModalDetailRowIndex(detailRowIndex);
    setInvoiceModalBillTo(agentName);
    setInvoiceModalOpen(true);
    setSupplierInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
  };

  useEffect(() => {
    if (!invoiceModalOpen || !filterSupplierInvoiceData) return;
    const list = filterSupplierInvoiceData;
    setSupplierInvoiceList(list);
    const existingDocNos = new Set(
      form.values.adjustments
        .map((a) => (a.document_no ?? "").toString().trim())
        .filter(Boolean),
    );
    const alreadySelected = new Set<number>();
    existingDocNos.forEach((docNo) => {
      const idx = list.findIndex(
        (inv) => (inv.crj_number ?? "").toString().trim() === docNo,
      );
      if (idx >= 0) alreadySelected.add(idx);
    });
    setSelectedInvoiceIndices(alreadySelected);
  }, [invoiceModalOpen, filterSupplierInvoiceData]);

  useEffect(() => {
    if (invoiceModalOpen && filterSupplierInvoiceError) {
      ToastNotification({
        type: "error",
        message: "Failed to load supplier invoices",
      });
      setSupplierInvoiceList([]);
    }
  }, [invoiceModalOpen, filterSupplierInvoiceError]);

  const toggleInvoiceSelection = (idx: number) => {
    setSelectedInvoiceIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectSupplierInvoice = () => {
    if (invoiceModalDetailRowIndex == null) return;
    const sorted = Array.from(selectedInvoiceIndices).sort((a, b) => a - b);
    if (sorted.length === 0) {
      ToastNotification({
        type: "warning",
        message: "Please select at least one supplier invoice",
      });
      return;
    }
    const detailRow = form.values.details[invoiceModalDetailRowIndex];
    const currentAdjustments = form.values.adjustments;
    const partyCode = (detailRow?.customer_code ?? "").toString().trim();
    const partyDisplay = (detailRow?.customer_display ?? "").toString().trim();
    const isSameParty = (a: AdjustmentRow) =>
      (partyCode && (a.subledger ?? "").toString().trim() === partyCode) ||
      (partyDisplay &&
        (a.subledger_display ?? "").toString().trim() === partyDisplay);
    const managedDocNos = new Set(
      supplierInvoiceList
        .map((inv) => (inv.crj_number ?? "").toString().trim())
        .filter(Boolean),
    );
    const isManagedRow = (a: AdjustmentRow) =>
      managedDocNos.has((a.document_no ?? "").toString().trim());
    const newRows: AdjustmentRow[] = sorted.map((listIdx) => {
      const inv = supplierInvoiceList[listIdx];
      const docDate = inv.date != null ? parseDocumentDate(inv.date) : null;
      const approvedNum =
        typeof inv.approved_amount === "number"
          ? inv.approved_amount
          : typeof inv.approved_amount === "string"
            ? parseFloat(inv.approved_amount) || null
            : null;
      const invCrnNum =
        typeof inv.Inv_crn_amount === "number"
          ? inv.Inv_crn_amount
          : typeof inv.Inv_crn_amount === "string"
            ? parseFloat(inv.Inv_crn_amount) || null
            : null;
      const amountNum = approvedNum ?? invCrnNum;
      const daybookId = inv.day_book_id;
      return {
        location: branchCode,
        type: "Supplier Invoice",
        subledger: detailRow?.customer_code ?? "",
        subledger_display: detailRow?.customer_display ?? "",
        daybook_id: daybookId != null ? String(daybookId) : "",
        document_no: (inv.crj_number ?? "").toString(),
        doc_date: docDate,
        currency: (inv.currency_code ?? localCurrency).toString().trim(),
        roe: 1,
        adj_curr_amount: amountNum,
        adj_local_amount: amountNum,
        invoice_id: inv.id != null ? Number(inv.id) : null,
      };
    });
    let withoutThisPartyManaged = currentAdjustments.filter(
      (a) => !(isSameParty(a) && isManagedRow(a)),
    );
    const isSingleEmptyRow =
      withoutThisPartyManaged.length === 1 &&
      !(withoutThisPartyManaged[0].document_no ?? "").toString().trim();
    if (isSingleEmptyRow && newRows.length > 0) {
      withoutThisPartyManaged = [];
    }
    const nextAdjustments: AdjustmentRow[] = [
      ...withoutThisPartyManaged,
      ...newRows,
    ];
    if (nextAdjustments.length === 0) {
      nextAdjustments.push(getDefaultAdjustmentRow(localCurrency));
    }
    form.setFieldValue("adjustments", nextAdjustments);
    syncPartyDetailsFromAllocations(nextAdjustments);
    setInvoiceModalOpen(false);
    setInvoiceModalDetailRowIndex(null);
    setInvoiceModalBillTo(null);
    setSupplierInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
  };

  const buildPaymentPayload = (
    values: PaymentFormValues,
    options: { status?: string } = {},
  ) => {
    const dayBookId = Number(values.daybook_id) || 0;
    const currencyId =
      currencyIdByCode[values.currency?.trim().toUpperCase()] ?? 0;
    const isEdit = saveResponse?.id != null && saveResponse.id > 0;
    const base: Record<string, unknown> = {
      ...(isEdit ? { id: saveResponse!.id } : {}),
      date: formatDateDDMMYYYY(values.date),
      day_book_id: dayBookId,
      type: (values.type ?? "CASH").toString().toUpperCase(),
      currency_id: currencyId,
      roe: values.roe ?? 0,
      amount: values.amount ?? 0,
      local_amount: values.local_amount ?? 0,
      narration: values.narration ?? "",
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      chq_clrd_date: formatDateDDMMYYYY(values.cheque_date),
      dr_cr: (paymentFromState?.dr_cr ?? "Cr").toString(),
      parties: (values.details ?? []).map((d) => ({
        ...(d.id != null && d.id > 0 ? { id: d.id } : {}),
        subledger_code: d.customer_code ?? "",
        narration: d.narration ?? "",
        currency_id: currencyIdByCode[d.currency?.trim().toUpperCase()] ?? 0,
        roe: d.roe ?? 0,
        amount: d.amount ?? 0,
        local_amount: d.local_amount ?? 0,
        dr_cr: (d.dr_cr ?? "Cr").toString(),
      })),
      allocations: (values.adjustments ?? []).map((a) => ({
        ...(a.id != null && a.id > 0 ? { id: a.id } : {}),
        location: a.location ?? "",
        subledger_code: a.subledger ?? a.subledger_display ?? "",
        day_book_id: Number(a.daybook_id) || 0,
        type: a.type ?? "",
        document_no: a.document_no ?? "",
        document_date: formatDateDDMMYYYY(a.doc_date),
        currency_id: currencyIdByCode[a.currency?.trim().toUpperCase()] ?? 0,
        ...(a.invoice_id != null && a.invoice_id > 0
          ? { supplier_invoice_id: a.invoice_id }
          : {}),
        adj_curr_amount: a.adj_curr_amount ?? 0,
        adj_local_amount: a.adj_local_amount ?? 0,
      })),
    };
    if (isEdit && options.status != null) {
      base.status = (options.status ?? "UNPOSTED").toString().toUpperCase();
    }
    return base;
  };

  const handleSubmit = async (values: PaymentFormValues) => {
    const partyLocalTotal =
      (values.details ?? []).reduce(
        (sum, d) =>
          sum +
          (d.local_amount != null && Number.isFinite(d.local_amount)
            ? d.local_amount
            : 0),
        0,
      ) ?? 0;
    const adjLocalTotal =
      (values.adjustments ?? []).reduce(
        (sum, a) =>
          sum +
          (a.adj_local_amount != null && Number.isFinite(a.adj_local_amount)
            ? a.adj_local_amount
            : 0),
        0,
      ) ?? 0;
    if (partyLocalTotal > adjLocalTotal) {
      ToastNotification({
        type: "error",
        message:
          "The total Local Amount of Party Details cannot exceed the total Adj Local Amount of the Adjustments section.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const isUpdate = saveResponse?.id != null && saveResponse.id > 0;
      const payload = isUpdate
        ? buildPaymentPayload(values, { status: "UNPOSTED" })
        : buildPaymentPayload(values);

      if (isUpdate) {
        const updateUrl = `${URL.payment}`;
        const raw = await putAPICall(updateUrl, payload, API_HEADER);
        const response =
          (
            raw as {
              data?: {
                id?: number;
                payment_no?: string;
                status?: string | number;
              };
            }
          )?.data ?? raw;
        const res = response as {
          id?: number;
          payment_no?: string;
          status?: string | number;
        };
        if (res?.id != null) {
          setSaveResponse({
            id: res.id ?? saveResponse.id,
            payment_no: res.payment_no ?? saveResponse.payment_no ?? "",
            document_no: saveResponse.document_no ?? "",
            status: res.status != null ? String(res.status) : "UNPOSTED",
          });
          await queryClient.invalidateQueries({ queryKey: ["payment"] });
          ToastNotification({
            type: "success",
            message: "Payment updated successfully.",
          });
        }
      } else {
        const raw = await postAPICall(URL.payment, payload, API_HEADER);
        const wrap = raw as {
          data?: {
            id?: number;
            payment_no?: string;
            status?: string | number;
            parties?: Array<{ id?: number; account_code?: string }>;
            allocations?: Array<{ id?: number }>;
          };
        };
        const data = wrap?.data;
        if (data?.id != null) {
          setSaveResponse({
            id: data.id,
            payment_no: data.payment_no ?? "",
            document_no: data.payment_no ?? "",
            status: data.status != null ? String(data.status) : "UNPOSTED",
          });
          if (
            data.parties &&
            Array.isArray(data.parties) &&
            data.parties.length === form.values.details.length
          ) {
            const updatedDetails = form.values.details.map((d, i) => ({
              ...d,
              id: data.parties![i]?.id ?? d.id,
            }));
            form.setFieldValue("details", updatedDetails);
          }
          if (
            data.allocations &&
            Array.isArray(data.allocations) &&
            data.allocations.length === form.values.adjustments.length
          ) {
            const updatedAdjustments = form.values.adjustments.map((a, i) => ({
              ...a,
              id: data.allocations![i]?.id ?? a.id,
            }));
            form.setFieldValue("adjustments", updatedAdjustments);
          }
          await queryClient.invalidateQueries({ queryKey: ["payment"] });
          ToastNotification({
            type: "success",
            message: "Payment saved successfully.",
          });
        }
      }
    } catch (err) {
      console.error("Save/update payment error:", err);
      ToastNotification({
        type: "error",
        message:
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Failed to save payment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostPayment = async () => {
    if (!saveResponse?.id) {
      ToastNotification({
        type: "error",
        message: "Save the payment first before posting.",
      });
      return;
    }
    setIsPosting(true);
    try {
      const payload = buildPaymentPayload(form.values, { status: "POSTED" });
      const postUpdateUrl = `${URL.payment}`;
      const raw = await putAPICall(postUpdateUrl, payload, API_HEADER);
      const response =
        (
          raw as {
            data?: {
              id?: number;
              payment_no?: string;
              status?: string | number;
            };
          }
        )?.data ?? raw;
      const res = response as {
        id?: number;
        payment_no?: string;
        status?: string | number;
      };
      if (res?.id != null) {
        setSaveResponse((prev) => ({
          ...prev,
          id: res.id ?? prev?.id,
          payment_no: res.payment_no ?? prev?.payment_no ?? "",
          document_no: prev?.document_no ?? "",
          status: res.status != null ? String(res.status) : "POSTED",
        }));
        await queryClient.invalidateQueries({ queryKey: ["payment"] });
        ToastNotification({
          type: "success",
          message: "Payment posted successfully.",
        });
      }
    } catch (err) {
      console.error("Post payment error:", err);
      ToastNotification({
        type: "error",
        message:
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Failed to post payment.",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const statusUpper = String(saveResponse?.status ?? "").toUpperCase();
  const isViewRoute = pathname.includes("/view");
  const isReadOnly = isViewRoute || statusUpper === "POSTED";
  const inputStyles = isReadOnly ? readOnlyFieldStyles : fieldStyles;
  const headerDateDisabled = isReadOnly;
  const headerOtherDisabled = isReadOnly;
  const useNonEditableStyleOnly = isReadOnly;
  const headerFieldStyles = headerOtherDisabled
    ? useNonEditableStyleOnly
      ? reversalNonEditableStyles
      : readOnlyFieldStyles
    : fieldStyles;
  const partyFieldStyles = headerOtherDisabled
    ? useNonEditableStyleOnly
      ? reversalNonEditableStyles
      : readOnlyFieldStyles
    : fieldStyles;
  const adjustmentFieldStyles = reversalNonEditableStyles;
  const headerDaybookStyles = isReadOnly
    ? useNonEditableStyleOnly
      ? reversalNonEditableStyles
      : readOnlyFieldStyles
    : inputStyles;

  const pageTitle = pathname.includes("/payment/view")
    ? "View Payment"
    : pathname.includes("/payment/edit")
      ? "Edit Payment"
      : pathname.includes("/payment/create")
        ? "Create Payment"
        : titleOverride;

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
              {isPosting
                ? "Updating payment..."
                : saveResponse?.id
                  ? "Updating payment..."
                  : "Saving payment..."}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text size="xl" fw={600} c="#105476">
            {pageTitle}
          </Text>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">
                    Payment No:
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    color="#105476"
                    styles={{ root: { textTransform: "none" } }}
                  >
                    {saveResponse.payment_no ||
                      saveResponse.document_no ||
                      (saveResponse.id != null
                        ? String(saveResponse.id)
                        : "") ||
                      "—"}
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
                      statusUpper === "UNPOSTED"
                        ? "gray"
                        : statusUpper === "POSTED"
                          ? "green"
                          : "#105476"
                    }
                    styles={{ root: { textTransform: "none" } }}
                  >
                    {statusUpper || "—"}
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
            isReadOnly ? (e) => e.preventDefault() : form.onSubmit(handleSubmit)
          }
        >
          <Grid>
            {/* Row 1: Daybook, Type, Date, Currency, ROE, Amount, Local Amount - same as Receipt */}
            <Grid.Col span={2}>
              <Dropdown
                label="Daybook"
                placeholder="Select daybook"
                data={daybookOptions}
                value={form.values.daybook_id || null}
                onChange={(v) => form.setFieldValue("daybook_id", v ?? "")}
                searchable
                withAsterisk
                error={form.errors.daybook_id}
                styles={headerDaybookStyles}
                disabled={useNonEditableStyleOnly ? false : isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="Type"
                placeholder="Select type"
                data={PAYMENT_TYPE_OPTIONS}
                value={form.values.type}
                onChange={(v) => form.setFieldValue("type", v ?? "CASH")}
                searchable
                withAsterisk
                error={form.errors.type}
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <SingleDateInput
                label="Date"
                placeholder="Select date"
                value={normalizeDate(form.values.date)}
                onChange={(date) => form.setFieldValue("date", date)}
                withAsterisk
                error={form.errors.date as string | undefined}
                disabled={headerDateDisabled}
                styles={
                  headerDateDisabled
                    ? useNonEditableStyleOnly
                      ? reversalNonEditableStyles
                      : readOnlyFieldStyles
                    : undefined
                }
              />
            </Grid.Col>
            <Grid.Col span={1.5}>
              <Dropdown
                label="Currency"
                placeholder="Select currency"
                data={currencyOptions}
                value={form.values.currency}
                onChange={(v) => {
                  form.setFieldValue("currency", v ?? "");
                  if (v?.toUpperCase() === localCurrency.toUpperCase()) {
                    form.setFieldValue("roe", 1);
                  }
                }}
                searchable
                withAsterisk
                error={form.errors.currency}
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
            </Grid.Col>
            <Grid.Col span={1.5}>
              <NumberInput
                label="ROE"
                placeholder="Rate of exchange"
                value={form.values.roe ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "roe",
                    clampROE(typeof v === "string" ? parseFloat(v) : v) ?? null,
                  )
                }
                min={0}
                decimalScale={4}
                max={ROE_MAX}
                hideControls
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
            </Grid.Col>
            <Grid.Col span={1.5}>
              <NumberInput
                label="Amount"
                placeholder="Amount"
                value={form.values.amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "amount",
                    clampAmount(typeof v === "string" ? parseFloat(v) : v) ??
                      null,
                  )
                }
                min={0}
                decimalScale={2}
                max={AMOUNT_MAX}
                hideControls
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
            </Grid.Col>
            <Grid.Col span={1.5}>
              <NumberInput
                label="Local Amount"
                placeholder="Local amount"
                value={form.values.local_amount ?? undefined}
                onChange={(v) =>
                  form.setFieldValue(
                    "local_amount",
                    clampAmount(typeof v === "string" ? parseFloat(v) : v) ??
                      null,
                  )
                }
                min={0}
                decimalScale={2}
                max={AMOUNT_MAX}
                hideControls
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
            </Grid.Col>

            {/* CHEQUE section - only when Type is CHEQUE - same as Receipt */}
            {showChequeSection && (
              <>
                <Grid.Col span={2}>
                  <TextInput
                    label="Bank"
                    placeholder="Bank"
                    {...form.getInputProps("bank")}
                    styles={headerFieldStyles}
                    disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Branch"
                    placeholder="Branch"
                    {...form.getInputProps("branch")}
                    styles={headerFieldStyles}
                    disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Cheque No"
                    placeholder="Cheque No"
                    {...form.getInputProps("cheque_no")}
                    styles={headerFieldStyles}
                    disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <SingleDateInput
                    label="Cheque Date"
                    placeholder="Select date"
                    value={normalizeDate(form.values.cheque_date)}
                    onChange={(date) => form.setFieldValue("cheque_date", date)}
                    disabled={headerDateDisabled}
                    styles={
                      headerDateDisabled
                        ? useNonEditableStyleOnly
                          ? reversalNonEditableStyles
                          : readOnlyFieldStyles
                        : undefined
                    }
                  />
                </Grid.Col>
              </>
            )}

            <Grid.Col span={12}>
              <Textarea
                label="Narration"
                placeholder="Narration"
                value={form.values.narration ?? ""}
                onChange={(e) =>
                  form.setFieldValue("narration", e.currentTarget.value)
                }
                rows={2}
                minRows={2}
                autosize={false}
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
            </Grid.Col>

            {/* Party details section - card with border - same as Receipt */}
            <Grid.Col span={12}>
              <Card withBorder p="md" mt="md" radius="md">
                <Text size="sm" fw={600} c="#105476">
                  Party details
                </Text>
                <Box mt="xs">
                  <Grid
                    w="100%"
                    gutter="sm"
                    py="sm"
                    style={{
                      fontWeight: 600,
                      color: "#105476",
                      borderBottom: "1px solid #e9ecef",
                    }}
                  >
                    <Grid.Col span={3} style={{ fontSize: "13px" }}>
                      Account Name
                    </Grid.Col>
                    <Grid.Col span={2.5} style={{ fontSize: "13px" }}>
                      Narration
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Currency
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      ROE
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Amount
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Local Amount
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Dr/Cr
                    </Grid.Col>
                    <Grid.Col span={1.5} style={{ fontSize: "13px" }}>
                      Actions
                    </Grid.Col>
                  </Grid>

                  {form.values.details.map((_, idx) => {
                    const formRow = form.values.details[idx];
                    const loadedRow =
                      loadedDetails &&
                      loadedDetails.length === form.values.details.length
                        ? loadedDetails[idx]
                        : null;
                    const row = loadedRow ?? formRow;
                    const partyKey = `party-${idx}-${row?.subledger_id ?? row?.customer_code ?? idx}`;
                    return (
                      <Grid key={partyKey} w="100%" gutter="sm" mt="sm">
                        <Grid.Col span={3}>
                          <SearchableSelect
                            key={partyKey}
                            placeholder="Account Name"
                            apiEndpoint={URL.supplierByType}
                            value={row?.customer_code || null}
                            displayValue={row?.customer_display || null}
                            disabled={useNonEditableStyleOnly ? false : isReadOnly}
                            onChange={(value, _selected, originalData) => {
                              setLoadedDetails(null);
                              const orig = originalData as {
                                id?: number;
                                customer_code?: string;
                                customer_name?: string;
                                agent_code?: string;
                                agent_name?: string;
                                name?: string;
                              };
                              const name =
                                orig?.agent_name ??
                                orig?.customer_name ??
                                orig?.name ??
                                "";
                              const code =
                                orig?.agent_code ?? orig?.customer_code ?? "";
                              const sid =
                                orig?.id != null
                                  ? orig.id
                                  : typeof value === "string" &&
                                      /^\d+$/.test(value)
                                    ? Number(value)
                                    : null;
                              form.setFieldValue(
                                `details.${idx}.subledger_id`,
                                sid,
                              );
                              form.setFieldValue(
                                `details.${idx}.customer_code`,
                                code || (value ?? ""),
                              );
                              form.setFieldValue(
                                `details.${idx}.customer_display`,
                                name,
                              );
                              form.setFieldValue(
                                `details.${idx}.currency`,
                                localCurrency,
                              );
                              form.setFieldValue(`details.${idx}.roe`, 1);
                            }}
                            dropdownZIndex={dropdownZIndex}
                            displayFormat={(item) => {
                              const i = item as {
                                id?: number;
                                customer_code?: string;
                                customer_name?: string;
                                agent_code?: string;
                                agent_name?: string;
                                name?: string;
                              };
                              return {
                                value: String(
                                  i?.id ??
                                    i?.agent_code ??
                                    i?.customer_code ??
                                    "",
                                ),
                                label: String(
                                  i?.agent_name ??
                                    i?.customer_name ??
                                    i?.name ??
                                    "",
                                ),
                              };
                            }}
                            searchFields={[
                              "agent_name",
                              "agent_code",
                              "customer_name",
                              "customer_code",
                            ]}
                            returnOriginalData
                            styles={partyFieldStyles}
                          />
                        </Grid.Col>
                        <Grid.Col span={2.5}>
                          <TextInput
                            placeholder="Narration"
                            {...form.getInputProps(`details.${idx}.narration`)}
                            disabled={useNonEditableStyleOnly ? false : isReadOnly}
                            styles={partyFieldStyles}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            value={form.values.details[idx].currency}
                            readOnly
                            styles={partyFieldStyles}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <NumberInput
                            placeholder="ROE"
                            min={0}
                            hideControls
                            value={form.values.details[idx].roe ?? undefined}
                            onChange={(v) => {
                              const newRoe =
                                clampROE(
                                  typeof v === "string" ? parseFloat(v) : v,
                                ) ?? 1;
                              form.setFieldValue(`details.${idx}.roe`, newRoe);
                              const amt = form.values.details[idx]?.amount;
                              if (
                                amt != null &&
                                Number.isFinite(amt) &&
                                newRoe != null &&
                                Number.isFinite(newRoe)
                              ) {
                                form.setFieldValue(
                                  `details.${idx}.local_amount`,
                                  clampAmount(amt * newRoe),
                                );
                              }
                            }}
                            decimalScale={4}
                            max={ROE_MAX}
                            styles={partyFieldStyles}
                            disabled={useNonEditableStyleOnly ? false : isReadOnly}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <NumberInput
                            placeholder="Amount"
                            min={0}
                            hideControls
                            value={form.values.details[idx].amount ?? undefined}
                            onChange={(v) => {
                              const newAmount =
                                clampAmount(
                                  typeof v === "string" ? parseFloat(v) : v,
                                ) ?? null;
                              form.setFieldValue(
                                `details.${idx}.amount`,
                                newAmount,
                              );
                              const roeVal = form.values.details[idx]?.roe ?? 1;
                              if (
                                newAmount != null &&
                                Number.isFinite(newAmount) &&
                                roeVal != null &&
                                Number.isFinite(roeVal)
                              ) {
                                form.setFieldValue(
                                  `details.${idx}.local_amount`,
                                  clampAmount(newAmount * roeVal),
                                );
                              }
                            }}
                            decimalScale={2}
                            max={AMOUNT_MAX}
                            styles={partyFieldStyles}
                            disabled={useNonEditableStyleOnly ? false : isReadOnly}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <NumberInput
                            placeholder="Local Amount"
                            min={0}
                            hideControls
                            value={
                              form.values.details[idx].local_amount ?? undefined
                            }
                            onChange={(v) =>
                              form.setFieldValue(
                                `details.${idx}.local_amount`,
                                clampAmount(
                                  typeof v === "string" ? parseFloat(v) : v,
                                ) ?? null,
                              )
                            }
                            decimalScale={2}
                            max={AMOUNT_MAX}
                            styles={partyFieldStyles}
                            disabled={useNonEditableStyleOnly ? false : isReadOnly}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Dropdown
                            placeholder="Dr/Cr"
                            data={DR_CR_OPTIONS}
                            value={form.values.details[idx].dr_cr}
                            onChange={(v) =>
                              form.setFieldValue(
                                `details.${idx}.dr_cr`,
                                (v as "Cr" | "Dr") ?? "Cr",
                              )
                            }
                            styles={partyFieldStyles}
                            disabled={useNonEditableStyleOnly ? false : isReadOnly}
                          />
                        </Grid.Col>
                        <Grid.Col span={1.5}>
                          <Group gap={4} wrap="nowrap">
                            <Button
                              type="button"
                              variant="subtle"
                              size="sm"
                              onClick={addDetailRow}
                              title="Add row"
                              disabled={isReadOnly}
                            >
                              <IconPlus size={18} />
                            </Button>
                            <Button
                              type="button"
                              variant="subtle"
                              size="sm"
                              color="red"
                              onClick={() => removeDetailRow(idx)}
                              disabled={
                                isReadOnly || form.values.details.length <= 1
                              }
                              title="Remove row"
                            >
                              <IconTrash size={18} />
                            </Button>
                            <Button
                              type="button"
                              variant="subtle"
                              size="sm"
                              title="Get supplier invoice details"
                              disabled={
                                isReadOnly ||
                                (invoiceModalDetailRowIndex === idx &&
                                  (filterSupplierInvoiceLoading ||
                                    filterSupplierInvoiceFetching)) ||
                                (!form.values.details[idx].customer_code &&
                                  !form.values.details[idx].customer_display)
                              }
                              onClick={() => openInvoiceModal(idx)}
                              leftSection={
                                invoiceModalDetailRowIndex === idx &&
                                (filterSupplierInvoiceLoading ||
                                  filterSupplierInvoiceFetching) ? (
                                  <Loader size="xs" color="#105476" />
                                ) : (
                                  <IconFileInvoice size={18} />
                                )
                              }
                            />
                          </Group>
                        </Grid.Col>
                      </Grid>
                    );
                  })}
                </Box>
              </Card>
            </Grid.Col>

            {/* Adjustment section - card with border - same as Receipt */}
            <Grid.Col span={12}>
              <Card withBorder p="md" mt="md" radius="md">
                <Text size="sm" fw={600} c="#105476">
                  Adjustments
                </Text>
                <Box mt="xs">
                  <Grid
                    w="100%"
                    gutter="sm"
                    py="sm"
                    style={{
                      fontWeight: 600,
                      color: "#105476",
                      borderBottom: "1px solid #e9ecef",
                    }}
                  >
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Location
                    </Grid.Col>
                    <Grid.Col span={1.5} style={{ fontSize: "13px" }}>
                      Daybook
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Type
                    </Grid.Col>
                    <Grid.Col span={1.5} style={{ fontSize: "13px" }}>
                      Account Name
                    </Grid.Col>
                    <Grid.Col span={1.5} style={{ fontSize: "13px" }}>
                      Document no
                    </Grid.Col>
                    <Grid.Col span={1.5} style={{ fontSize: "13px" }}>
                      Document date
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Currency
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Adj Curr Amount
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Adj local amount
                    </Grid.Col>
                    <Grid.Col span={1} style={{ fontSize: "13px" }}>
                      Actions
                    </Grid.Col>
                  </Grid>

                  {form.values.adjustments.map((_, idx) => (
                    <Grid key={idx} w="100%" gutter="sm" mt="sm">
                      <Grid.Col span={1}>
                        <TextInput
                          placeholder="Location"
                          readOnly
                          {...form.getInputProps(`adjustments.${idx}.location`)}
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <Dropdown
                          placeholder="Daybook"
                          data={daybookAdjustmentOptions}
                          value={
                            form.values.adjustments[idx].daybook_id || null
                          }
                          disabled={false}
                          readOnly
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <TextInput
                          placeholder="Type"
                          readOnly
                          {...form.getInputProps(`adjustments.${idx}.type`)}
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <TextInput
                          placeholder="Account Name"
                          readOnly
                          value={
                            form.values.adjustments[idx].subledger_display ||
                            form.values.adjustments[idx].subledger
                          }
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <TextInput
                          placeholder="Document no"
                          readOnly
                          {...form.getInputProps(
                            `adjustments.${idx}.document_no`,
                          )}
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <SingleDateInput
                          placeholder="Document date"
                          value={normalizeDate(
                            form.values.adjustments[idx].doc_date,
                          )}
                          onChange={() => {}}
                          disabled
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Currency"
                          data={currencyOptions}
                          value={form.values.adjustments[idx].currency || null}
                          disabled={false}
                          readOnly
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          placeholder="Adj Curr Amount"
                          min={0}
                          hideControls
                          value={
                            form.values.adjustments[idx].adj_curr_amount ??
                            undefined
                          }
                          onChange={(v) => {
                            const newCurr =
                              clampAmount(
                                typeof v === "string" ? parseFloat(v) : v,
                              ) ?? null;
                            form.setFieldValue(
                              `adjustments.${idx}.adj_curr_amount`,
                              newCurr,
                            );
                            const rowRoe = form.values.adjustments[idx]?.roe;
                            let newLocal: number | null = null;
                            if (
                              newCurr != null &&
                              rowRoe != null &&
                              Number.isFinite(rowRoe)
                            ) {
                              newLocal = clampAmount(newCurr * rowRoe);
                              form.setFieldValue(
                                `adjustments.${idx}.adj_local_amount`,
                                newLocal,
                              );
                            }
                            const effectiveAdjustments =
                              form.values.adjustments.map((a, i) =>
                                i === idx
                                  ? {
                                      ...a,
                                      adj_curr_amount: newCurr,
                                      adj_local_amount:
                                        newLocal ?? a.adj_local_amount,
                                    }
                                  : a,
                              );
                            syncPartyDetailsFromAllocations(
                              effectiveAdjustments,
                            );
                          }}
                          decimalScale={2}
                          max={AMOUNT_MAX}
                          styles={
                            isReadOnly ? adjustmentFieldStyles : fieldStyles
                          }
                          disabled={isReadOnly}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          placeholder="Adj local amount"
                          min={0}
                          hideControls
                          readOnly
                          value={
                            form.values.adjustments[idx].adj_local_amount ??
                            undefined
                          }
                          decimalScale={2}
                          max={AMOUNT_MAX}
                          styles={adjustmentFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Group gap={4} wrap="nowrap">
                          <Button
                            type="button"
                            variant="subtle"
                            size="sm"
                            onClick={addAdjustmentRow}
                            title="Add row"
                            disabled={isReadOnly}
                          >
                            <IconPlus size={18} />
                          </Button>
                          <Button
                            type="button"
                            variant="subtle"
                            size="sm"
                            color="red"
                            onClick={() => removeAdjustmentRow(idx)}
                            disabled={
                              isReadOnly || form.values.adjustments.length <= 1
                            }
                            title="Remove row"
                          >
                            <IconTrash size={18} />
                          </Button>
                        </Group>
                      </Grid.Col>
                    </Grid>
                  ))}
                </Box>
              </Card>
            </Grid.Col>
          </Grid>

          <Modal
            opened={invoiceModalOpen}
            onClose={() => {
              setInvoiceModalOpen(false);
              setInvoiceModalDetailRowIndex(null);
              setInvoiceModalBillTo(null);
              setSupplierInvoiceList([]);
              setSelectedInvoiceIndices(new Set());
            }}
            title="Select Supplier Invoice"
            size="lg"
            styles={{ title: { fontWeight: 600, color: "#105476" } }}
          >
            {filterSupplierInvoiceLoading || filterSupplierInvoiceFetching ? (
              <Text size="sm" c="dimmed">
                Loading supplier invoices...
              </Text>
            ) : (
              <>
                <Table
                  withTableBorder
                  withColumnBorders
                  striped
                  highlightOnHover
                  style={{ fontSize: "13px" }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 40 }}></Table.Th>
                      <Table.Th>CRJ Number</Table.Th>
                      <Table.Th>Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {supplierInvoiceList.map((inv, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Checkbox
                            checked={selectedInvoiceIndices.has(idx)}
                            onChange={() => toggleInvoiceSelection(idx)}
                          />
                        </Table.Td>
                        <Table.Td>{inv.crj_number ?? "—"}</Table.Td>
                        <Table.Td>
                          {formatDocumentDateDisplay(inv.date)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {supplierInvoiceList.length === 0 &&
                  !filterSupplierInvoiceLoading &&
                  !filterSupplierInvoiceFetching && (
                    <Text size="sm" c="dimmed" mt="sm">
                      No posted supplier invoices found for this agent.
                    </Text>
                  )}
                <Group justify="flex-end" mt="md">
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => {
                      setInvoiceModalOpen(false);
                      setInvoiceModalDetailRowIndex(null);
                      setInvoiceModalBillTo(null);
                      setSupplierInvoiceList([]);
                      setSelectedInvoiceIndices(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="#105476"
                    onClick={handleSelectSupplierInvoice}
                    disabled={selectedInvoiceIndices.size === 0}
                  >
                    Select
                  </Button>
                </Group>
              </>
            )}
          </Modal>

          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              color="#105476"
              onClick={() => navigate(backPath)}
            >
              Cancel
            </Button>
            {!isReadOnly && (
              <>
                <Button
                  type="submit"
                  color="#105476"
                  loading={isSubmitting}
                  rightSection={
                    isSubmitting ? null : <IconChevronRight size={16} />
                  }
                >
                  {saveResponse?.id ? "Update Payment" : "Save Payment"}
                </Button>
                {saveResponse && statusUpper === "UNPOSTED" && (
                  <Button
                    type="button"
                    color="black"
                    variant="filled"
                    loading={isPosting}
                    onClick={handlePostPayment}
                  >
                    Post Payment
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
