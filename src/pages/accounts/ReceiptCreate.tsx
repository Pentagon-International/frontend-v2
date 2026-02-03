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
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../api/serverUrls";
import {
  Dropdown,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../components";
import { getAPICall } from "../../service/getApiCall";
import { API_HEADER } from "../../store/storeKeys";
import { postAPICall } from "../../service/postApiCall";
import { putAPICall } from "../../service/putApiCall";
import useAuthStore from "../../store/authStore";

const RECEIPT_TYPE_OPTIONS = [
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

// Default ROE by currency (same as InvoiceCreate): IN -> INR=1, USD=88.75; AE -> AED=1, USD=3.67
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

const fetchDaybookRPT = async () => {
  try {
    const payload = { filters: { document_type: "RPT" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (RPT):", error);
    return [];
  }
};

const fetchDaybookAll = async () => {
  try {
    const payload = { filters: {} };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (all):", error);
    return [];
  }
};

// ROE: max 15 digits including 4 decimal places (11 integer + 4 decimal)
const ROE_MAX = 99999999999.9999;

function clampROE(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value))
    return value === undefined ? null : value;
  const rounded = Math.round(value * 10000) / 10000;
  if (Math.abs(rounded) > ROE_MAX) return rounded > 0 ? ROE_MAX : -ROE_MAX;
  return rounded;
}

// Amount: max 15 digits including 2 decimal places (13 integer + 2 decimal)
const AMOUNT_MAX = 9999999999999.99;

function clampAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value))
    return value === undefined ? null : value;
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded) > AMOUNT_MAX) return rounded > 0 ? AMOUNT_MAX : -AMOUNT_MAX;
  return rounded;
}

type DetailRow = {
  id?: number | null;
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
  location: string;
  type: string;
  subledger: string;
  subledger_display: string;
  daybook_id: string;
  document_no: string;
  doc_date: Date | null;
  currency: string;
  roe: number | null; // invoice ROE for recalculating adj_local_amount when user edits adj_curr_amount
  adj_curr_amount: number | null;
  adj_local_amount: number | null;
};

type InvoiceCombinedItem = {
  document_no?: string;
  document_date?: string;
  due_date?: string;
  total?: number | string;
  daybook_id?: number | string;
  day_book_id?: number | string;
  daybook_name?: string;
  day_book_type?: string;
  currency_id?: number | string;
  currency_code?: string;
  [key: string]: unknown;
};

type ReceiptFormValues = {
  daybook_id: string;
  type: string;
  date: Date | null;
  currency: string;
  roe: number | null;
  amount: number | null;
  local_amount: number | null;
  narration: string;
  note: string;
  account_code: string;
  bank: string;
  branch: string;
  cheque_no: string;
  cheque_date: Date | null;
  details: DetailRow[];
  adjustments: AdjustmentRow[];
};

const getDefaultDetailRow = (localCurrency: string): DetailRow => ({
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
});

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === undefined) return null;
  if (value instanceof Date) return value;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateYYYYMMDD(date: Date | null | undefined): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

// Same styling for all fields when in posted/read-only mode (used for header, party details, adjustments)
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

// Parse document_date from API (DD-MM-YYYY or YYYY-MM-DD) to Date
function parseDocumentDate(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim();
  const parts = s.split("-");
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const day = parseInt(a, 10);
    const month = parseInt(b, 10) - 1;
    const year = parseInt(c, 10);
    if (c.length === 4 && !isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 0 && month <= 11) {
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

// Display document_date from API (supports DD-MM-YYYY or ISO)
function formatDocumentDateDisplay(value: string | null | undefined): string {
  const d = parseDocumentDate(value);
  return d ? d.toLocaleDateString() : "—";
}

export default function ReceiptCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

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
  const [invoiceList, setInvoiceList] = useState<InvoiceCombinedItem[]>([]);
  const [selectedInvoiceIndices, setSelectedInvoiceIndices] = useState<
    Set<number>
  >(new Set());
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    receipt_no?: string;
    document_no?: string;
    status?: string;
  } | null>(null);

  const branchCode =
    (defaultBranch as { branch_code?: string } | undefined)?.branch_code ?? "";

  const form = useForm<ReceiptFormValues>({
    initialValues: {
      daybook_id: "",
      type: "CASH",
      date: new Date(),
      currency: localCurrency,
      roe: 1,
      amount: null,
      local_amount: null,
      narration: "",
      note: "",
      account_code: "",
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

  const { data: daybookData = [] } = useQuery({
    queryKey: ["daybook", "RPT"],
    queryFn: fetchDaybookRPT,
    staleTime: Infinity,
  });

  const { data: daybookAllData = [] } = useQuery({
    queryKey: ["daybook", "all"],
    queryFn: fetchDaybookAll,
    staleTime: Infinity,
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
    const data = daybookData as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookData]);

  const daybookAdjustmentOptions = useMemo(() => {
    const data = daybookAllData as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookAllData]);

  const currencyIdByCode = useMemo(() => {
    const data = currencyData as {
      id?: number;
      currency_code?: string;
      code?: string;
    }[];
    if (!Array.isArray(data)) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const code = (item.currency_code ?? item.code ?? "").toString().trim().toUpperCase();
      if (code && item.id != null) map[code] = Number(item.id);
    });
    return map;
  }, [currencyData]);

  useEffect(() => {
    if (!localCurrency || form.values.currency) return;
    form.setFieldValue("currency", localCurrency);
  }, [localCurrency]);

  const userCountryCode = user?.country?.country_code;

  useEffect(() => {
    const curr = form.values.currency?.trim().toUpperCase();
    if (!curr || !localCurrency) return;
    if (curr === localCurrency.toUpperCase()) {
      form.setFieldValue("roe", 1);
    } else {
      form.setFieldValue(
        "roe",
        getRoeValue(curr, userCountryCode),
      );
    }
  }, [form.values.currency, localCurrency, userCountryCode]);

  // Header: Local Amount = Amount when same currency, else Amount * ROE
  useEffect(() => {
    const amt = form.values.amount;
    const roeVal = form.values.roe;
    const curr = form.values.currency?.trim().toUpperCase();
    if (curr === localCurrency?.toUpperCase()) {
      form.setFieldValue(
        "local_amount",
        amt != null && Number.isFinite(amt) ? clampAmount(amt) : null,
      );
    } else {
      form.setFieldValue(
        "local_amount",
        amt != null &&
          Number.isFinite(amt) &&
          roeVal != null &&
          Number.isFinite(roeVal)
          ? clampAmount(amt * roeVal)
          : null,
      );
    }
  }, [form.values.currency, form.values.amount, form.values.roe, localCurrency]);

  // Party details: Local Amount = Amount when same currency as header/local, else Amount * ROE
  const detailsSnapshot = form.values.details
    .map((r) => `${r.currency}|${r.amount}|${r.roe}`)
    .join(";");
  useEffect(() => {
    form.values.details.forEach((row, idx) => {
      const amt = row.amount;
      const roeVal = row.roe;
      const curr = row.currency?.trim().toUpperCase();
      const local =
        curr === localCurrency?.toUpperCase()
          ? amt != null && Number.isFinite(amt)
            ? clampAmount(amt)
            : null
          : amt != null &&
              Number.isFinite(amt) &&
              roeVal != null &&
              Number.isFinite(roeVal)
            ? clampAmount(amt * roeVal)
            : null;
      if (form.values.details[idx].local_amount !== local) {
        form.setFieldValue(`details.${idx}.local_amount`, local);
      }
    });
  }, [detailsSnapshot, localCurrency]);

  const showChequeSection = form.values.type === "CHEQUE";

  const addDetailRow = () => {
    form.insertListItem("details", getDefaultDetailRow(localCurrency));
  };

  const removeDetailRow = (idx: number) => {
    if (form.values.details.length <= 1) return;
    form.removeListItem("details", idx);
  };

  const addAdjustmentRow = () => {
    form.insertListItem("adjustments", getDefaultAdjustmentRow(localCurrency));
  };

  const removeAdjustmentRow = (idx: number) => {
    if (form.values.adjustments.length <= 1) return;
    form.removeListItem("adjustments", idx);
  };

  const openInvoiceModal = async (detailRowIndex: number) => {
    const row = form.values.details[detailRowIndex];
    const billTo = row?.customer_display?.trim() || row?.customer_code?.trim();
    if (!billTo) return;
    setInvoiceModalDetailRowIndex(detailRowIndex);
    setInvoiceModalOpen(true);
    setInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
    setInvoiceLoading(true);
    try {
      const payload = {
        filters: { status: "POSTED", bill_to: billTo },
      };
      const response = await postAPICall(
        URL.invoiceCombined,
        payload,
        API_HEADER,
      );
      const res = response as { data?: InvoiceCombinedItem[] } | InvoiceCombinedItem[];
      const data = Array.isArray(res) ? res : res?.data;
      setInvoiceList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      ToastNotification({
        type: "error",
        message: "Failed to load invoices",
      });
      setInvoiceList([]);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const toggleInvoiceSelection = (idx: number) => {
    setSelectedInvoiceIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectInvoice = () => {
    if (invoiceModalDetailRowIndex == null) return;
    const sorted = Array.from(selectedInvoiceIndices).sort((a, b) => a - b);
    if (sorted.length === 0) {
      ToastNotification({
        type: "warning",
        message: "Please select at least one invoice",
      });
      return;
    }
    const detailRow = form.values.details[invoiceModalDetailRowIndex];
    const currentAdjustments = form.values.adjustments;
    const newRows: AdjustmentRow[] = sorted.map((listIdx) => {
      const inv = invoiceList[listIdx];
      const docDate =
        inv.document_date != null
          ? parseDocumentDate(inv.document_date as string)
          : null;
      const totalNum =
        typeof inv.total === "number"
          ? inv.total
          : typeof inv.total === "string"
            ? parseFloat(inv.total) || null
            : null;
      const localTotalNum =
        inv.local_total != null
          ? typeof inv.local_total === "number"
            ? inv.local_total
            : typeof inv.local_total === "string"
              ? parseFloat(inv.local_total) || null
              : null
          : null;
      const invRoe =
        inv.roe != null
          ? typeof inv.roe === "number"
            ? inv.roe
            : typeof inv.roe === "string"
              ? parseFloat(inv.roe) || null
              : null
          : null;
      const daybookId =
        inv.day_book_id ?? inv.daybook_id;
      return {
        location: branchCode,
        type: (inv.day_book_type as string) ?? "",
        subledger: detailRow?.customer_code ?? "",
        subledger_display: detailRow?.customer_display ?? "",
        daybook_id: daybookId != null ? String(daybookId) : "",
        document_no: inv.document_no ?? "",
        doc_date: docDate,
        currency: inv.currency_code ?? localCurrency,
        roe: invRoe,
        adj_curr_amount: totalNum,
        adj_local_amount: localTotalNum != null ? localTotalNum : (totalNum != null && invRoe != null ? clampAmount(totalNum * invRoe) : totalNum),
      };
    });
    // Append selected invoices to Adjustments so multiple parties' selections accumulate
    const isSingleEmptyRow =
      currentAdjustments.length === 1 &&
      !currentAdjustments[0].document_no?.trim();
    const nextAdjustments: AdjustmentRow[] = isSingleEmptyRow
      ? newRows
      : [...currentAdjustments, ...newRows];
    if (nextAdjustments.length === 0) {
      nextAdjustments.push(getDefaultAdjustmentRow(localCurrency));
    }
    form.setFieldValue("adjustments", nextAdjustments);
    setInvoiceModalOpen(false);
    setInvoiceModalDetailRowIndex(null);
    setInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
    ToastNotification({
      type: "success",
      message:
        sorted.length === 1
          ? "Invoice added to Adjustments"
          : `${sorted.length} invoices added to Adjustments`,
    });
  };

  const buildReceiptPayload = (
    values: ReceiptFormValues,
    options: { status?: string } = {},
  ) => {
    const dayBookId = Number(values.daybook_id) || 0;
    const currencyId =
      currencyIdByCode[values.currency?.trim().toUpperCase()] ?? 0;
    const isEdit = saveResponse?.id != null && saveResponse.id > 0;
    const base: Record<string, unknown> = {
      ...(isEdit ? { id: saveResponse!.id } : {}),
      date: formatDateYYYYMMDD(values.date),
      day_book_id: dayBookId,
      type: values.type ?? "CASH",
      currency_id: currencyId,
      roe: values.roe ?? 0,
      account_code: values.account_code ?? "",
      amount: values.amount ?? 0,
      local_amount: values.local_amount ?? 0,
      narration: values.narration ?? "",
      note: values.note ?? "",
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      chq_clrd_date: formatDateYYYYMMDD(values.cheque_date),
      dr_cr: "Cr",
      parties: (values.details ?? []).map((d) => ({
        ...(d.id != null && d.id > 0 ? { id: d.id } : {}),
        subledger_code: d.customer_code ?? "",
        narration: d.narration ?? "",
        currency_id: currencyIdByCode[d.currency?.trim().toUpperCase()] ?? 0,
        roe: d.roe ?? 0,
        amount: d.amount ?? 0,
        local_amount: d.local_amount ?? 0,
        dr_cr: d.dr_cr ?? "Cr",
      })),
      allocations: (values.adjustments ?? []).map((a) => ({
        ...(a.id != null && a.id > 0 ? { id: a.id } : {}),
        location: a.location ?? "",
        subledger_code: a.subledger ?? "",
        day_book_id: Number(a.daybook_id) || 0,
        type: a.type ?? "",
        document_no: a.document_no ?? "",
        document_date: formatDateYYYYMMDD(a.doc_date),
        currency_id: currencyIdByCode[a.currency?.trim().toUpperCase()] ?? 0,
        adj_curr_amount: a.adj_curr_amount ?? 0,
        adj_local_amount: a.adj_local_amount ?? 0,
      })),
    };
    // Create flow: do not send status. Edit flow (update/post): send status.
    if (isEdit && options.status != null) {
      base.status = options.status;
    }
    return base;
  };

  const handleSubmit = async (values: ReceiptFormValues) => {
    const partyTotal =
      (values.details ?? []).reduce(
        (sum, d) =>
          sum + (d.amount != null && Number.isFinite(d.amount) ? d.amount : 0),
        0,
      ) ?? 0;
    const adjTotal =
      (values.adjustments ?? []).reduce(
        (sum, a) =>
          sum +
          (a.adj_curr_amount != null && Number.isFinite(a.adj_curr_amount)
            ? a.adj_curr_amount
            : 0),
        0,
      ) ?? 0;
    if (partyTotal > adjTotal) {
      ToastNotification({
        type: "error",
        message:
          "The total amount of Party Details cannot exceed the total Adj Curr Amount of the Adjustments section.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const isUpdate = saveResponse?.id != null && saveResponse.id > 0;
      const payload = isUpdate
        ? buildReceiptPayload(values, { status: "UNPOSTED" })
        : buildReceiptPayload(values);

      if (isUpdate) {
        const raw = await putAPICall(URL.receipt, payload, API_HEADER);
        const response = (raw as { data?: { id?: number; receipt_no?: string; status?: string | number } })?.data ?? raw;
        const res = response as { id?: number; receipt_no?: string; status?: string | number };
        if (res?.id != null) {
          setSaveResponse({
            id: res.id ?? saveResponse.id,
            receipt_no: res.receipt_no ?? saveResponse.receipt_no ?? "",
            document_no: saveResponse.document_no ?? "",
            status: res.status != null ? String(res.status) : "UNPOSTED",
          });
          await queryClient.invalidateQueries({ queryKey: ["receipt"] });
          ToastNotification({
            type: "success",
            message: "Receipt updated successfully.",
          });
        }
      } else {
        const raw = await postAPICall(URL.receipt, payload, API_HEADER);
        const wrap = raw as {
          data?: {
            id?: number;
            receipt_no?: string;
            status?: string | number;
            parties?: Array<{ id?: number; subledger_code?: string }>;
            allocations?: Array<{ id?: number }>;
          };
        };
        const data = wrap?.data;
        if (data?.id != null) {
          setSaveResponse({
            id: data.id,
            receipt_no: data.receipt_no ?? "",
            document_no: data.receipt_no ?? "",
            status: data.status != null ? String(data.status) : "UNPOSTED",
          });
          // Merge party and allocation ids from response into form for future updates
          if (data.parties && Array.isArray(data.parties) && data.parties.length === form.values.details.length) {
            const updatedDetails = form.values.details.map((d, i) => ({
              ...d,
              id: data.parties![i]?.id ?? d.id,
            }));
            form.setFieldValue("details", updatedDetails);
          }
          if (data.allocations && Array.isArray(data.allocations) && data.allocations.length === form.values.adjustments.length) {
            const updatedAdjustments = form.values.adjustments.map((a, i) => ({
              ...a,
              id: data.allocations![i]?.id ?? a.id,
            }));
            form.setFieldValue("adjustments", updatedAdjustments);
          }
          await queryClient.invalidateQueries({ queryKey: ["receipt"] });
          ToastNotification({
            type: "success",
            message: "Receipt saved successfully.",
          });
        }
      }
    } catch (err) {
      console.error("Save/update receipt error:", err);
      ToastNotification({
        type: "error",
        message:
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Failed to save receipt.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostReceipt = async () => {
    if (!saveResponse?.id) {
      ToastNotification({
        type: "error",
        message: "Save the receipt first before posting.",
      });
      return;
    }
    setIsPosting(true);
    try {
      const payload = buildReceiptPayload(form.values, { status: "POSTED" });
      const raw = await putAPICall(URL.receipt, payload, API_HEADER);
      const response = (raw as { data?: { id?: number; receipt_no?: string; status?: string | number } })?.data ?? raw;
      const res = response as { id?: number; receipt_no?: string; status?: string | number };
      if (res?.id != null) {
        setSaveResponse((prev) => ({
          ...prev,
          id: res.id ?? prev?.id,
          receipt_no: res.receipt_no ?? prev?.receipt_no ?? "",
          document_no: prev?.document_no ?? "",
          status: res.status != null ? String(res.status) : "POSTED",
        }));
        await queryClient.invalidateQueries({ queryKey: ["receipt"] });
        ToastNotification({
          type: "success",
          message: "Receipt posted successfully.",
        });
      }
    } catch (err) {
      console.error("Post receipt error:", err);
      ToastNotification({
        type: "error",
        message:
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Failed to post receipt.",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const statusUpper = String(saveResponse?.status ?? "").toUpperCase();
  const isReadOnly = statusUpper === "POSTED";
  const inputStyles = isReadOnly ? readOnlyFieldStyles : fieldStyles;

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
              {isPosting ? "Posting receipt..." : "Saving receipt..."}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        {/* Header: Title | Receipt No & Status (left of Back) | Back */}
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text size="xl" fw={600} c="#105476">
            Create Receipt
          </Text>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">
                    Receipt No:
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    color="#105476"
                    styles={{ root: { textTransform: "none" } }}
                  >
                    {saveResponse.receipt_no ||
                      saveResponse.document_no ||
                      (saveResponse.id != null ? String(saveResponse.id) : "") ||
                      "—"}
                  </Badge>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} c="dimmed">Status:</Text>
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
              onClick={() => navigate("/receipt")}
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
            {/* Row 1: Daybook, Type, Date, Currency, ROE, Amount, Local Amount */}
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
                styles={inputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Dropdown
                label="Type"
                placeholder="Select type"
                data={RECEIPT_TYPE_OPTIONS}
                value={form.values.type}
                onChange={(v) => form.setFieldValue("type", v ?? "CASH")}
                searchable
                withAsterisk
                error={form.errors.type}
                styles={inputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Box style={isReadOnly ? { backgroundColor: "#f5f5f5", borderRadius: 4, padding: "2px 0" } : undefined}>
                <SingleDateInput
                  label="Date"
                  placeholder="Select date"
                  value={normalizeDate(form.values.date)}
                  onChange={(date) => form.setFieldValue("date", date)}
                  withAsterisk
                  error={form.errors.date as string | undefined}
                  disabled={isReadOnly}
                />
              </Box>
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
                styles={inputStyles}
                disabled={isReadOnly}
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
                styles={inputStyles}
                disabled={isReadOnly}
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
                styles={inputStyles}
                disabled={isReadOnly}
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
                styles={inputStyles}
                disabled={isReadOnly}
              />
            </Grid.Col>

            {/* CHEQUE section - only when Type is CHEQUE */}
            {showChequeSection && (
              <>
                <Grid.Col span={2}>
                  <TextInput
                    label="Bank"
                    placeholder="Bank"
                    {...form.getInputProps("bank")}
                    styles={inputStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Branch"
                    placeholder="Branch"
                    {...form.getInputProps("branch")}
                    styles={inputStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Cheque No"
                    placeholder="Cheque No"
                    {...form.getInputProps("cheque_no")}
                    styles={inputStyles}
                    disabled={isReadOnly}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <Box style={isReadOnly ? { backgroundColor: "#f5f5f5", borderRadius: 4, padding: "2px 0" } : undefined}>
                    <SingleDateInput
                      label="Cheque Date"
                      placeholder="Select date"
                      value={normalizeDate(form.values.cheque_date)}
                      onChange={(date) => form.setFieldValue("cheque_date", date)}
                      disabled={isReadOnly}
                    />
                  </Box>
                </Grid.Col>
              </>
            )}

            {/* Party details section - card with border */}
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

                  {form.values.details.map((_, idx) => (
                    <Grid key={idx} w="100%" gutter="sm" mt="sm">
                      <Grid.Col span={3}>
                        <SearchableSelect
                          placeholder="Account Name"
                          apiEndpoint={URL.customer}
                          value={form.values.details[idx].customer_code || null}
                          displayValue={
                            form.values.details[idx].customer_display || null
                          }
                          disabled={isReadOnly}
                          onChange={(value, _selected, originalData) => {
                            const name =
                              (
                                originalData as {
                                  customer_name?: string;
                                  name?: string;
                                }
                              )?.customer_name ??
                              (
                                originalData as {
                                  customer_name?: string;
                                  name?: string;
                                }
                              )?.name ??
                              "";
                            form.setFieldValue(
                              `details.${idx}.customer_code`,
                              value ?? "",
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
                          displayFormat={(item) => ({
                            value: String(
                              (item as { customer_code?: string })
                                ?.customer_code ??
                                (item as { id?: string })?.id ??
                                "",
                            ),
                            label: String(
                              (item as { customer_name?: string })
                                ?.customer_name ??
                                (item as { name?: string })?.name ??
                                "",
                            ),
                          })}
                          searchFields={["customer_name", "customer_code"]}
                          returnOriginalData
                          styles={inputStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.5}>
                        <TextInput
                          placeholder="Narration"
                          {...form.getInputProps(`details.${idx}.narration`)}
                          disabled={isReadOnly}
                          styles={inputStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <TextInput
                          value={form.values.details[idx].currency}
                          readOnly
                          styles={inputStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          placeholder="ROE"
                          min={0}
                          hideControls
                          value={form.values.details[idx].roe ?? undefined}
                          onChange={(v) =>
                            form.setFieldValue(
                              `details.${idx}.roe`,
                              clampROE(
                                typeof v === "string" ? parseFloat(v) : v,
                              ) ?? 1,
                            )
                          }
                          decimalScale={4}
                          max={ROE_MAX}
                          styles={inputStyles}
                          disabled={isReadOnly}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <NumberInput
                          placeholder="Amount"
                          min={0}
                          hideControls
                          value={form.values.details[idx].amount ?? undefined}
                          onChange={(v) =>
                            form.setFieldValue(
                              `details.${idx}.amount`,
                              clampAmount(
                                typeof v === "string" ? parseFloat(v) : v,
                              ) ?? null,
                            )
                          }
                          decimalScale={2}
                          max={AMOUNT_MAX}
                          styles={inputStyles}
                          disabled={isReadOnly}
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
                          styles={inputStyles}
                          disabled={isReadOnly}
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
                          styles={inputStyles}
                          disabled={isReadOnly}
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
                            title="Get invoice details"
                            disabled={
                              isReadOnly ||
                              invoiceLoading ||
                              (!form.values.details[idx].customer_code &&
                                !form.values.details[idx].customer_display)
                            }
                            onClick={() => openInvoiceModal(idx)}
                            leftSection={
                              invoiceLoading &&
                              invoiceModalDetailRowIndex === idx ? (
                                <Loader size="xs" color="#105476" />
                              ) : (
                                <IconFileInvoice size={18} />
                              )
                            }
                          />
                        </Group>
                      </Grid.Col>
                    </Grid>
                  ))}
                </Box>
              </Card>
            </Grid.Col>

            {/* Adjustment section - card with border */}
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
                          styles={readOnlyFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <Dropdown
                          placeholder="Daybook"
                          data={daybookAdjustmentOptions}
                          value={
                            form.values.adjustments[idx].daybook_id || null
                          }
                          disabled
                          readOnly
                          styles={readOnlyFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <TextInput
                          placeholder="Type"
                          readOnly
                          {...form.getInputProps(`adjustments.${idx}.type`)}
                          styles={readOnlyFieldStyles}
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
                          styles={readOnlyFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <TextInput
                          placeholder="Document no"
                          readOnly
                          {...form.getInputProps(
                            `adjustments.${idx}.document_no`,
                          )}
                          styles={readOnlyFieldStyles}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <Box style={{ backgroundColor: "#f5f5f5", borderRadius: 4, padding: "2px 0" }}>
                          <SingleDateInput
                            placeholder="Doc date"
                            value={normalizeDate(
                              form.values.adjustments[idx].doc_date,
                            )}
                            onChange={() => {}}
                            disabled
                          />
                        </Box>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Currency"
                          data={currencyOptions}
                          value={form.values.adjustments[idx].currency || null}
                          disabled
                          readOnly
                          styles={readOnlyFieldStyles}
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
                            const newCurr = clampAmount(
                              typeof v === "string" ? parseFloat(v) : v,
                            ) ?? null;
                            form.setFieldValue(
                              `adjustments.${idx}.adj_curr_amount`,
                              newCurr,
                            );
                            const rowRoe = form.values.adjustments[idx]?.roe;
                            if (newCurr != null && rowRoe != null && Number.isFinite(rowRoe)) {
                              const newLocal = clampAmount(newCurr * rowRoe);
                              form.setFieldValue(
                                `adjustments.${idx}.adj_local_amount`,
                                newLocal,
                              );
                            }
                          }}
                          decimalScale={2}
                          max={AMOUNT_MAX}
                          styles={inputStyles}
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
                          styles={readOnlyFieldStyles}
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
                              isReadOnly ||
                              form.values.adjustments.length <= 1
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

          {/* Invoice selection modal */}
          <Modal
            opened={invoiceModalOpen}
            onClose={() => {
              setInvoiceModalOpen(false);
              setInvoiceModalDetailRowIndex(null);
              setInvoiceList([]);
              setSelectedInvoiceIndices(new Set());
            }}
            title="Select Invoice"
            size="lg"
            styles={{ title: { fontWeight: 600, color: "#105476" } }}
          >
            {invoiceLoading ? (
              <Text size="sm" c="dimmed">
                Loading invoices...
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
                      <Table.Th>Invoice Number</Table.Th>
                      <Table.Th>Document Number</Table.Th>
                      <Table.Th>Document Date</Table.Th>
                      <Table.Th>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {invoiceList.map((inv, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Checkbox
                            checked={selectedInvoiceIndices.has(idx)}
                            onChange={() => toggleInvoiceSelection(idx)}
                          />
                        </Table.Td>
                        <Table.Td>{inv.document_no ?? "—"}</Table.Td>
                        <Table.Td>{inv.document_no ?? "—"}</Table.Td>
                        <Table.Td>
                          {formatDocumentDateDisplay(
                            inv.document_date as string,
                          )}
                        </Table.Td>
                        <Table.Td>
                          {inv.total != null
                            ? typeof inv.total === "number"
                              ? inv.total.toFixed(2)
                              : String(inv.total)
                            : "—"}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {invoiceList.length === 0 && !invoiceLoading && (
                  <Text size="sm" c="dimmed" mt="sm">
                    No posted invoices found for this customer.
                  </Text>
                )}
                <Group justify="flex-end" mt="md">
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => {
                      setInvoiceModalOpen(false);
                      setInvoiceModalDetailRowIndex(null);
                      setInvoiceList([]);
                      setSelectedInvoiceIndices(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="#105476"
                    onClick={handleSelectInvoice}
                    disabled={selectedInvoiceIndices.size === 0}
                  >
                    Select
                  </Button>
                </Group>
              </>
            )}
          </Modal>

          {/* Action Buttons */}
          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              color="#105476"
              onClick={() => navigate("/receipt")}
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
                  {saveResponse?.id ? "Update Receipt" : "Save Receipt"}
                </Button>
                {saveResponse && statusUpper === "UNPOSTED" && (
                    <Button
                      type="button"
                      color="black"
                      variant="filled"
                      loading={isPosting}
                      onClick={handlePostReceipt}
                    >
                      Post Receipt
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
