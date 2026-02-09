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
import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

const fetchDaybookRPTREV = async () => {
  try {
    const payload = { filters: { document_type: "RPTREV" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (RPTREV):", error);
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
  if (Math.abs(rounded) > AMOUNT_MAX)
    return rounded > 0 ? AMOUNT_MAX : -AMOUNT_MAX;
  return rounded;
}

/** Party row: customer_display = label in UI (subledger_name from list / customer_name from search); customer_code = subledger_code in payload */
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
  roe: number | null; // invoice ROE for recalculating adj_local_amount when user edits adj_curr_amount
  adj_curr_amount: number | null;
  adj_local_amount: number | null;
};

type InvoiceCombinedItem = {
  id?: number;
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

const fetchFilterInvoice = async (
  billTo: string,
): Promise<InvoiceCombinedItem[]> => {
  const response = await postAPICall(
    URL.filterInvoice,
    { filters: { status: "POSTED", bill_to: billTo } },
    API_HEADER,
  );
  const res = response as
    | { data?: InvoiceCombinedItem[] }
    | InvoiceCombinedItem[];
  const data = Array.isArray(res) ? res : res?.data;
  return Array.isArray(data) ? data : [];
};

/** Receipt row from list API (filter/receipt) - used for View/Edit and Create Reversal from Receipt Master.
 * Filter response may not include account_code_code / account_name / account_code_branch_account_code. */
type ReceiptListItem = {
  id?: number;
  receipt_no?: string;
  reverse_receipt_no?: string;
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
  account_code_id?: number;
  received_from_code?: string;
  received_from_name?: string;
  bank?: string;
  branch?: string;
  cheque_no?: string;
  chq_clrd_date?: string | null;
  dr_cr?: string;
  /** Each party: subledger_name = UI label (Account Name), subledger_code = value for payload */
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

/** DD-MM-YYYY for receipt and reverse-receipt APIs */
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

// Display document_date from API (supports DD-MM-YYYY or ISO)
function formatDocumentDateDisplay(value: string | null | undefined): string {
  const d = parseDocumentDate(value);
  return d ? d.toLocaleDateString() : "—";
}

type ReceiptCreateProps = {
  titleOverride?: string;
  backPath?: string;
  isReversal?: boolean;
};

export default function ReceiptCreate({
  titleOverride = "Create Receipt",
  backPath = "/receipt",
  isReversal: _isReversal = false,
}: ReceiptCreateProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  // const loadedFromStateIdRef = useRef<number | string | null>(null);
  /** When loading from list, hold details so Account Name displays for every row (state triggers re-render) */
  const [loadedDetails, setLoadedDetails] = useState<DetailRow[] | null>(null);
  const sourceReceiptIdForReversalRef = useRef<number | null>(null);
  const sourceReceiptNoForReversalRef = useRef<string>("");

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
  /** When set, invoice combined API is triggered (or served from cache) for this billTo */
  const [invoiceModalBillTo, setInvoiceModalBillTo] = useState<string | null>(
    null,
  );
  const [invoiceList, setInvoiceList] = useState<InvoiceCombinedItem[]>([]);
  const [selectedInvoiceIndices, setSelectedInvoiceIndices] = useState<
    Set<number>
  >(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    receipt_no?: string;
    document_no?: string;
    status?: string;
  } | null>(null);

  const [reverseReceiptSaveResponse, setReverseReceiptSaveResponse] = useState<{
    id: number;
    receipt_no?: string;
    reverse_receipt_no?: string;
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

  const daybookQueryKey = _isReversal ? "RPTREV" : "RPT";
  const daybookQueryFn = _isReversal ? fetchDaybookRPTREV : fetchDaybookRPT;
  const { data: daybookDataForPage = [] } = useQuery({
    queryKey: ["daybook", daybookQueryKey],
    queryFn: daybookQueryFn,
    staleTime: Infinity,
  });

  const {
    data: filterInvoiceData,
    isLoading: filterInvoiceLoading,
    isFetching: filterInvoiceFetching,
    isError: filterInvoiceError,
  } = useQuery({
    queryKey: ["filterInvoice", invoiceModalBillTo ?? ""],
    queryFn: () => fetchFilterInvoice(invoiceModalBillTo!),
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
    const data = daybookDataForPage as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookDataForPage]);

  const daybookAdjustmentOptions = useMemo(() => {
    const data = daybookDataForPage as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookDataForPage]);

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

  // Load from list: state is receipt row (Receipt Master) or reversal row (Receipt Reversal list for edit/view)
  const receiptFromState = location.state as ReceiptListItem | null | undefined;
  const pathname = location.pathname;
  const isReversalEditOrView =
    _isReversal &&
    (pathname.includes("/reversal/edit") ||
      pathname.includes("/reversal/view"));
  const isReversalCreate = _isReversal && pathname.includes("/reversal/create");

  useEffect(() => {
    if (!receiptFromState || receiptFromState.id == null || !localCurrency) {
      if (!receiptFromState) {
        setLoadedDetails(null);
      }
      return;
    }
    const parseNum = (v: string | number | null | undefined): number | null => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };

    const dateVal = parseDocumentDate(receiptFromState.date);
    const chqDateVal = parseDocumentDate(receiptFromState.chq_clrd_date);
    const roeVal = parseNum(receiptFromState.roe);
    const amountVal = parseNum(receiptFromState.amount);
    const localAmountVal = parseNum(receiptFromState.local_amount);

    const parties = Array.isArray(receiptFromState.parties)
      ? receiptFromState.parties
      : [];
    // Party details: subledger_name = UI label (Account Name), subledger_code = value sent in payload. Set both for every row.
    // Receipt Reversal: party Dr/Cr default is "Dr". Receipt Create: use source or "Cr".
    const details: DetailRow[] =
      parties.length > 0
        ? parties.map((p) => ({
            id: p.id ?? null,
            subledger_id: p.subledger_id ?? null,
            customer_code: String(p.subledger_code ?? "").trim(),
            customer_display: String(p.subledger_name ?? "").trim(),
            narration: String(p.narration ?? "").trim(),
            currency: (p.currency_code ?? localCurrency).toString().trim(),
            roe: parseNum(p.roe) ?? 1,
            amount: parseNum(p.amount),
            local_amount: parseNum(p.local_amount),
            dr_cr: _isReversal
              ? ("Dr" as const)
              : ((p.dr_cr === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr"),
          }))
        : [getDefaultDetailRow(localCurrency)];

    const allocations = receiptFromState.allocations;
    const adjustments: AdjustmentRow[] =
      Array.isArray(allocations) && allocations.length > 0
        ? allocations.map((a) => {
            const roeFromApi = a.invoice_roe ?? a.roe;
            return {
              id: a.id ?? null,
              invoice_id: a.invoice_id != null ? Number(a.invoice_id) : null,
              location: (a.location ?? "").toString(),
              type: (a.type_name ?? a.type ?? "").toString(),
              subledger: (a.subledger_code ?? "").toString(),
              subledger_display: (a.subledger_name ?? "").toString(),
              daybook_id: a.day_book_id != null ? String(a.day_book_id) : "",
              document_no: (a.document_no ?? "").toString(),
              doc_date: parseDocumentDate(a.document_date),
              currency: (a.currency_code ?? localCurrency).toString().trim(),
              roe: parseNum(roeFromApi),
              adj_curr_amount: parseNum(a.adj_curr_amount),
              adj_local_amount: parseNum(a.adj_local_amount),
            };
          })
        : [getDefaultAdjustmentRow(localCurrency)];

    setLoadedDetails(details);
    form.setValues({
      daybook_id: isReversalCreate
        ? ""
        : receiptFromState.day_book_id != null
          ? String(receiptFromState.day_book_id)
          : "",
      type: (receiptFromState.type ?? "CASH").toString().trim(),
      date: dateVal ?? new Date(),
      currency: (receiptFromState.currency_code ?? localCurrency)
        .toString()
        .trim(),
      roe: roeVal ?? 1,
      amount: amountVal,
      local_amount: localAmountVal,
      narration: (receiptFromState.narration ?? "").toString(),
      note: (receiptFromState.note ?? "").toString(),
      account_code: "",
      bank: (receiptFromState.bank ?? "").toString(),
      branch: (receiptFromState.branch ?? "").toString(),
      cheque_no: (receiptFromState.cheque_no ?? "").toString(),
      cheque_date: chqDateVal,
      details,
      adjustments,
    });
    // Force details to apply (ensures all parties from list are shown, e.g. when navigating from Receipt Reversal)
    if (details.length > 0) {
      form.setFieldValue("details", details);
    }

    if (_isReversal) {
      if (isReversalEditOrView) {
        setReverseReceiptSaveResponse({
          id: Number(receiptFromState.id),
          receipt_no: (receiptFromState.receipt_no ?? "").toString(),
          reverse_receipt_no: (
            receiptFromState.reverse_receipt_no ??
            receiptFromState.receipt_no ??
            ""
          ).toString(),
          status: (receiptFromState.status ?? "UNPOSTED").toString(),
        });
        sourceReceiptIdForReversalRef.current = null;
        sourceReceiptNoForReversalRef.current = "";
      } else {
        sourceReceiptIdForReversalRef.current =
          Number(receiptFromState.id) || null;
        sourceReceiptNoForReversalRef.current = (
          receiptFromState.receipt_no ?? ""
        ).toString();
      }
    } else {
      setSaveResponse({
        id: Number(receiptFromState.id),
        receipt_no: (receiptFromState.receipt_no ?? "").toString(),
        document_no: (receiptFromState.receipt_no ?? "").toString(),
        status: (receiptFromState.status ?? "UNPOSTED").toString(),
      });
    }
  }, [
    receiptFromState?.id,
    localCurrency,
    _isReversal,
    isReversalEditOrView,
    isReversalCreate,
  ]);

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

  // When party details Local Amount changes: set header Local Amount = sum(party details), header Amount = header Local Amount / header ROE (same idea as party: adj local → party local, party amount = party local/roe)
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

  // Header: when user changes ROE or Amount, set Local Amount = Amount × ROE (same as party details; header not forced to party sum)
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

  /** Sync party details from allocation totals: only call when adjustments actually change (Adj Curr Amount or invoice selection), not when user changes Amount/ROE. */
  const syncPartyDetailsFromAllocations = (
    adjustmentsToUse?: AdjustmentRow[],
  ) => {
    const adjustments = adjustmentsToUse ?? form.values.adjustments ?? [];
    form.values.details.forEach((row, idx) => {
      const partyCode = (row.customer_code ?? "").toString().trim();
      const partyDisplay = (row.customer_display ?? "").toString().trim();
      const matchingAllocations = adjustments.filter(
        (a) =>
          (partyCode &&
            (a.subledger ?? "").toString().trim() === partyCode) ||
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

  // When Amount or ROE change: Local Amount = Amount * ROE (always use ROE when available)
  const detailsSnapshotForLocal =
    form.values.details
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
        amt != null && Number.isFinite(amt)
          ? clampAmount(amt * roeVal)
          : null;
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
    const billTo = row?.customer_display?.trim() || row?.customer_code?.trim();
    if (!billTo) return;
    setInvoiceModalDetailRowIndex(detailRowIndex);
    setInvoiceModalBillTo(billTo);
    setInvoiceModalOpen(true);
    setInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
  };

  useEffect(() => {
    if (!invoiceModalOpen || !filterInvoiceData) return;
    const list = filterInvoiceData;
    setInvoiceList(list);
    const existingDocNos = new Set(
      form.values.adjustments
        .map((a) => (a.document_no ?? "").toString().trim())
        .filter(Boolean),
    );
    const alreadySelected = new Set<number>();
    existingDocNos.forEach((docNo) => {
      const idx = list.findIndex(
        (inv) => (inv.document_no ?? "").toString().trim() === docNo,
      );
      if (idx >= 0) alreadySelected.add(idx);
    });
    setSelectedInvoiceIndices(alreadySelected);
  }, [invoiceModalOpen, filterInvoiceData]);

  useEffect(() => {
    if (invoiceModalOpen && filterInvoiceError) {
      ToastNotification({
        type: "error",
        message: "Failed to load invoices",
      });
      setInvoiceList([]);
    }
  }, [invoiceModalOpen, filterInvoiceError]);

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
    const partyCode = (detailRow?.customer_code ?? "").toString().trim();
    const partyDisplay = (detailRow?.customer_display ?? "").toString().trim();
    const isSameParty = (a: AdjustmentRow) =>
      (partyCode && (a.subledger ?? "").toString().trim() === partyCode) ||
      (partyDisplay &&
        (a.subledger_display ?? "").toString().trim() === partyDisplay);
    const managedDocNos = new Set(
      invoiceList
        .map((inv) => (inv.document_no ?? "").toString().trim())
        .filter(Boolean),
    );
    const isManagedRow = (a: AdjustmentRow) =>
      managedDocNos.has((a.document_no ?? "").toString().trim());
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
      const daybookId = inv.day_book_id ?? inv.daybook_id;
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
        adj_local_amount:
          localTotalNum != null
            ? localTotalNum
            : totalNum != null && invRoe != null
              ? clampAmount(totalNum * invRoe)
              : totalNum,
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
    setInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
    // ToastNotification({
    //   type: "success",
    //   message:
    //     newRows.length === 1
    //       ? "Adjustments updated (1 invoice)"
    //       : `Adjustments updated (${newRows.length} invoices)`,
    // });
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
      date: formatDateDDMMYYYY(values.date),
      day_book_id: dayBookId,
      type: (values.type ?? "CASH").toString().toUpperCase(),
      currency_id: currencyId,
      roe: values.roe ?? 0,
      amount: values.amount ?? 0,
      local_amount: values.local_amount ?? 0,
      narration: values.narration ?? "",
      note: values.note ?? "",
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      chq_clrd_date: formatDateDDMMYYYY(values.cheque_date),
      dr_cr: (receiptFromState?.dr_cr ?? "Cr").toString(),
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
        ...(a.invoice_id != null && a.invoice_id > 0
          ? { invoice_id: a.invoice_id }
          : {}),
        location: a.location ?? "",
        subledger_code: a.subledger ?? "",
        day_book_id: Number(a.daybook_id) || 0,
        type: a.type ?? "",
        document_no: a.document_no ?? "",
        document_date: formatDateDDMMYYYY(a.doc_date),
        currency_id: currencyIdByCode[a.currency?.trim().toUpperCase()] ?? 0,
        adj_curr_amount: a.adj_curr_amount ?? 0,
        adj_local_amount: a.adj_local_amount ?? 0,
      })),
    };
    if (isEdit && options.status != null) {
      base.status = (options.status ?? "UNPOSTED").toString().toUpperCase();
    }
    return base;
  };

  /** Build payload for reverse-receipt API. Uses DD-MM-YYYY for dates. No account_code. For create (POST) omit id. */
  const buildReversalPayload = (
    values: ReceiptFormValues,
    options?: {
      reversalId?: number;
      receiptNo?: string;
      status?: string;
      detailsOverride?: DetailRow[];
    },
  ) => {
    const dayBookId = Number(values.daybook_id) || 0;
    const currencyId =
      currencyIdByCode[values.currency?.trim().toUpperCase()] ?? 0;
    const receiptNo =
      options?.receiptNo ?? sourceReceiptNoForReversalRef.current ?? "";
    const status = (options?.status ?? "UNPOSTED").toString().toUpperCase();
    const isUpdate = options?.reversalId != null && options.reversalId > 0;
    const details = options?.detailsOverride ?? values.details ?? [];
    const base: Record<string, unknown> = {
      date: formatDateDDMMYYYY(values.date),
      receipt_no: receiptNo,
      status,
      day_book_id: dayBookId,
      type: (values.type ?? "CASH").toString().toUpperCase(),
      currency_id: currencyId,
      roe: values.roe ?? 0,
      amount: values.amount ?? 0,
      local_amount: values.local_amount ?? 0,
      narration: values.narration ?? "",
      note: values.note ?? "",
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      chq_clrd_date: formatDateDDMMYYYY(values.cheque_date),
      dr_cr: (receiptFromState?.dr_cr ?? "Cr").toString(),
      // Party: label = customer_display (subledger_name from list / customer_name from search); payload = subledger_code (customer_code)
      parties: details.map((d) => ({
        subledger_code: d.customer_code ?? "",
        narration: d.narration ?? "",
        currency_id: currencyIdByCode[d.currency?.trim().toUpperCase()] ?? 0,
        roe: d.roe ?? 0,
        amount: d.amount ?? 0,
        local_amount: d.local_amount ?? 0,
        dr_cr: (d.dr_cr ?? "Dr").toString(),
      })),
      allocations: (values.adjustments ?? []).map((a) => ({
        location: a.location ?? "",
        subledger_code: a.subledger ?? "",
        day_book_id: Number(a.daybook_id) || 0,
        type: a.type ?? "",
        document_no: a.document_no ?? "",
        document_date: formatDateDDMMYYYY(a.doc_date),
        currency_id: currencyIdByCode[a.currency?.trim().toUpperCase()] ?? 0,
        adj_curr_amount: a.adj_curr_amount ?? 0,
        adj_local_amount: a.adj_local_amount ?? 0,
      })),
    };
    if (isUpdate && options?.reversalId != null) {
      base.id = options.reversalId;
    }
    return base;
  };

  const handleSubmit = async (values: ReceiptFormValues) => {
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
      if (_isReversal) {
        const isReversalUpdate =
          reverseReceiptSaveResponse?.id != null &&
          reverseReceiptSaveResponse.id > 0;
        const detailsForPayload =
          loadedDetails &&
          loadedDetails.length === (values.details ?? []).length
            ? loadedDetails
            : (values.details ?? []);

        if (isReversalUpdate) {
          const payload = buildReversalPayload(values, {
            reversalId: reverseReceiptSaveResponse.id,
            receiptNo: reverseReceiptSaveResponse.receipt_no ?? "",
            status: "UNPOSTED",
            detailsOverride: detailsForPayload,
          });
          const raw = await putAPICall(URL.reverseReceipt, payload, API_HEADER);
          const wrap = raw as {
            data?: {
              id?: number;
              receipt_no?: string;
              reverse_receipt_no?: string;
              status?: string;
            };
          };
          const res = wrap?.data;
          if (res?.id != null) {
            setReverseReceiptSaveResponse((prev) => ({
              id: prev!.id,
              receipt_no: res.receipt_no ?? prev?.receipt_no ?? "",
              reverse_receipt_no:
                res.reverse_receipt_no ?? prev?.reverse_receipt_no ?? "",
              status: res.status != null ? String(res.status) : "UNPOSTED",
            }));
            await queryClient.invalidateQueries({ queryKey: ["receipt"] });
            await queryClient.invalidateQueries({
              queryKey: ["receipt-reversal"],
            });
            ToastNotification({
              type: "success",
              message: "Reverse receipt updated successfully.",
            });
          }
        } else {
          const payload = buildReversalPayload(values, {
            detailsOverride: detailsForPayload,
          });
          // Create receipt reversal: POST
          const raw = await postAPICall(
            URL.reverseReceipt,
            payload,
            API_HEADER,
          );
          const wrap = raw as {
            data?: {
              id?: number;
              receipt_no?: string;
              reverse_receipt_no?: string;
              status?: string;
              parties?: Array<{ id?: number }>;
              allocations?: Array<{ id?: number }>;
            };
          };
          const data = wrap?.data;
          if (data?.id != null) {
            setReverseReceiptSaveResponse({
              id: Number(data.id),
              receipt_no: data.receipt_no ?? "",
              reverse_receipt_no: data.reverse_receipt_no ?? "",
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
              const updatedAdjustments = form.values.adjustments.map(
                (a, i) => ({
                  ...a,
                  id: data.allocations![i]?.id ?? a.id,
                }),
              );
              form.setFieldValue("adjustments", updatedAdjustments);
            }
            await queryClient.invalidateQueries({ queryKey: ["receipt"] });
            await queryClient.invalidateQueries({
              queryKey: ["receipt-reversal"],
            });
            ToastNotification({
              type: "success",
              message: "Receipt reversal created successfully.",
            });
          }
        }
        setIsSubmitting(false);
        return;
      }

      const isUpdate = saveResponse?.id != null && saveResponse.id > 0;
      const payload = isUpdate
        ? buildReceiptPayload(values, { status: "UNPOSTED" })
        : buildReceiptPayload(values);

      if (isUpdate) {
        const raw = await putAPICall(URL.receipt, payload, API_HEADER);
        const response =
          (
            raw as {
              data?: {
                id?: number;
                receipt_no?: string;
                status?: string | number;
              };
            }
          )?.data ?? raw;
        const res = response as {
          id?: number;
          receipt_no?: string;
          status?: string | number;
        };
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

  const handlePostReverseReceipt = async () => {
    if (!reverseReceiptSaveResponse?.id) {
      ToastNotification({
        type: "error",
        message: "Save the reverse receipt first before posting.",
      });
      return;
    }
    setIsPosting(true);
    try {
      const payload = buildReversalPayload(form.values, {
        reversalId: reverseReceiptSaveResponse.id,
        receiptNo: reverseReceiptSaveResponse.receipt_no ?? "",
        status: "POSTED",
      });
      const raw = await putAPICall(URL.reverseReceipt, payload, API_HEADER);
      const wrap = raw as {
        data?: {
          id?: number;
          receipt_no?: string;
          reverse_receipt_no?: string;
          status?: string;
        };
      };
      const res = wrap?.data;
      if (res?.id != null) {
        setReverseReceiptSaveResponse((prev) => ({
          ...prev!,
          receipt_no: res.receipt_no ?? prev?.receipt_no ?? "",
          reverse_receipt_no:
            res.reverse_receipt_no ?? prev?.reverse_receipt_no ?? "",
          status: res.status != null ? String(res.status) : "POSTED",
        }));
        await queryClient.invalidateQueries({ queryKey: ["receipt"] });
        await queryClient.invalidateQueries({ queryKey: ["receipt-reversal"] });
        ToastNotification({
          type: "success",
          message: "Reverse receipt posted successfully.",
        });
      }
    } catch (err) {
      console.error("Post reverse receipt error:", err);
      ToastNotification({
        type: "error",
        message:
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Failed to post reverse receipt.",
      });
    } finally {
      setIsPosting(false);
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
      const response =
        (
          raw as {
            data?: {
              id?: number;
              receipt_no?: string;
              status?: string | number;
            };
          }
        )?.data ?? raw;
      const res = response as {
        id?: number;
        receipt_no?: string;
        status?: string | number;
      };
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
  const reversalStatusUpper = String(
    reverseReceiptSaveResponse?.status ?? "",
  ).toUpperCase();
  const isViewRoute = pathname.includes("/view");
  // Read-only: view route, or receipt/reversal with status POSTED; same field styling as POSTED view
  const isReadOnly =
    isViewRoute ||
    (!_isReversal && statusUpper === "POSTED") ||
    (_isReversal && reversalStatusUpper === "POSTED");
  // On reversal page, all fields are disabled except daybook; user can only change daybook and use action buttons
  const reversalFormDisabled = _isReversal;
  const inputStyles = isReadOnly ? readOnlyFieldStyles : fieldStyles;

  const pageTitle = pathname.includes("/reversal/view")
    ? "View Receipt Reversal"
    : pathname.includes("/reversal/edit")
      ? "Edit Receipt Reversal"
      : pathname.includes("/reversal/create")
        ? "Create Receipt Reversal"
        : pathname.includes("/receipt/view")
          ? "View Receipt"
          : pathname.includes("/receipt/edit")
            ? "Edit Receipt"
            : pathname.includes("/receipt/create")
              ? "Create Receipt"
              : titleOverride;

  const effectiveBackPath =
    _isReversal && pathname.includes("/reversal/create")
      ? "/receipt"
      : backPath;

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
                ? _isReversal
                  ? "Updating reverse receipt..."
                  : "Updating receipt..."
                : _isReversal
                  ? "Saving Reverse Receipt..."
                  : "Saving receipt..."}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        {/* Header: Title | Receipt No & Status (left of Back) | Back */}
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text size="xl" fw={600} c="#105476">
            {pageTitle}
          </Text>
          <Group gap="md" wrap="nowrap">
            {saveResponse && !_isReversal && (
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
            {_isReversal &&
              (reverseReceiptSaveResponse ||
                (isReversalEditOrView && receiptFromState)) && (
                <Group gap="sm" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} c="dimmed">
                      Reverse Receipt No:
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color="#105476"
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {(reverseReceiptSaveResponse?.reverse_receipt_no ??
                        receiptFromState?.reverse_receipt_no ??
                        reverseReceiptSaveResponse?.receipt_no ??
                        receiptFromState?.receipt_no ??
                        (reverseReceiptSaveResponse?.id != null
                          ? String(reverseReceiptSaveResponse.id)
                          : receiptFromState?.id != null
                            ? String(receiptFromState.id)
                            : "")) ||
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
                        (reversalStatusUpper === "UNPOSTED"
                          ? "gray"
                          : reversalStatusUpper === "POSTED"
                            ? "green"
                            : "#105476") as string
                      }
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {reversalStatusUpper || "—"}
                    </Badge>
                  </Group>
                </Group>
              )}
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(effectiveBackPath)}
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
                disabled={isReadOnly || reversalFormDisabled}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Box
                style={
                  isReadOnly
                    ? {
                        backgroundColor: "#f5f5f5",
                        borderRadius: 4,
                        padding: "2px 0",
                      }
                    : undefined
                }
              >
                <SingleDateInput
                  label="Date"
                  placeholder="Select date"
                  value={normalizeDate(form.values.date)}
                  onChange={(date) => form.setFieldValue("date", date)}
                  withAsterisk
                  error={form.errors.date as string | undefined}
                  disabled={isReadOnly || reversalFormDisabled}
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
                disabled={isReadOnly || reversalFormDisabled}
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
                disabled={isReadOnly || reversalFormDisabled}
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
                disabled={isReadOnly || reversalFormDisabled}
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
                disabled={isReadOnly || reversalFormDisabled}
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
                    disabled={isReadOnly || reversalFormDisabled}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Branch"
                    placeholder="Branch"
                    {...form.getInputProps("branch")}
                    styles={inputStyles}
                    disabled={isReadOnly || reversalFormDisabled}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Cheque No"
                    placeholder="Cheque No"
                    {...form.getInputProps("cheque_no")}
                    styles={inputStyles}
                    disabled={isReadOnly || reversalFormDisabled}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <Box
                    style={
                      isReadOnly
                        ? {
                            backgroundColor: "#f5f5f5",
                            borderRadius: 4,
                            padding: "2px 0",
                          }
                        : undefined
                    }
                  >
                    <SingleDateInput
                      label="Cheque Date"
                      placeholder="Select date"
                      value={normalizeDate(form.values.cheque_date)}
                      onChange={(date) =>
                        form.setFieldValue("cheque_date", date)
                      }
                      disabled={isReadOnly || reversalFormDisabled}
                    />
                  </Box>
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
                styles={inputStyles}
                disabled={isReadOnly || reversalFormDisabled}
              />
            </Grid.Col>

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
                            apiEndpoint={URL.customer}
                            value={row?.customer_code || null}
                            displayValue={row?.customer_display || null}
                            disabled={isReadOnly || reversalFormDisabled}
                            onChange={(value, _selected, originalData) => {
                              setLoadedDetails(null);
                              const orig = originalData as {
                                id?: number;
                                customer_code?: string;
                                customer_name?: string;
                                name?: string;
                              };
                              const name =
                                orig?.customer_name ?? orig?.name ?? "";
                              const code = orig?.customer_code ?? "";
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
                                name?: string;
                              };
                              return {
                                value: String(i?.id ?? i?.customer_code ?? ""),
                                label: String(
                                  i?.customer_name ?? i?.name ?? "",
                                ),
                              };
                            }}
                            searchFields={["customer_name", "customer_code"]}
                            returnOriginalData
                            styles={inputStyles}
                          />
                        </Grid.Col>
                        <Grid.Col span={2.5}>
                          <TextInput
                            placeholder="Narration"
                            {...form.getInputProps(`details.${idx}.narration`)}
                            disabled={isReadOnly || reversalFormDisabled}
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
                            onChange={(v) => {
                              const newRoe =
                                clampROE(
                                  typeof v === "string" ? parseFloat(v) : v,
                                ) ?? 1;
                              form.setFieldValue(
                                `details.${idx}.roe`,
                                newRoe,
                              );
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
                            styles={inputStyles}
                            disabled={isReadOnly || reversalFormDisabled}
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
                              const roeVal =
                                form.values.details[idx]?.roe ??
                                1;
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
                            styles={inputStyles}
                            disabled={isReadOnly || reversalFormDisabled}
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
                            disabled={isReadOnly || reversalFormDisabled}
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
                            disabled={isReadOnly || reversalFormDisabled}
                          />
                        </Grid.Col>
                        <Grid.Col span={1.5}>
                          <Group gap={4} wrap="nowrap">
                            {!_isReversal && (
                              <Button
                                type="button"
                                variant="subtle"
                                size="sm"
                                onClick={addDetailRow}
                                title="Add row"
                                disabled={isReadOnly || reversalFormDisabled}
                              >
                                <IconPlus size={18} />
                              </Button>
                            )}
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
                            {!_isReversal && (
                              <Button
                                type="button"
                                variant="subtle"
                                size="sm"
                                title="Get invoice details"
                                disabled={
                                  isReadOnly ||
                                  (invoiceModalDetailRowIndex === idx &&
                                    (filterInvoiceLoading ||
                                      filterInvoiceFetching)) ||
                                  (!form.values.details[idx].customer_code &&
                                    !form.values.details[idx].customer_display)
                                }
                                onClick={() => openInvoiceModal(idx)}
                                leftSection={
                                  invoiceModalDetailRowIndex === idx &&
                                  (filterInvoiceLoading ||
                                    filterInvoiceFetching) ? (
                                    <Loader size="xs" color="#105476" />
                                  ) : (
                                    <IconFileInvoice size={18} />
                                  )
                                }
                              />
                            )}
                          </Group>
                        </Grid.Col>
                      </Grid>
                    );
                  })}
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
                        <Box
                          style={{
                            backgroundColor: "#f5f5f5",
                            borderRadius: 4,
                            padding: "2px 0",
                          }}
                        >
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
                                      adj_local_amount: newLocal ?? a.adj_local_amount,
                                    }
                                  : a,
                              );
                            syncPartyDetailsFromAllocations(effectiveAdjustments);
                          }}
                          decimalScale={2}
                          max={AMOUNT_MAX}
                          styles={inputStyles}
                          disabled={isReadOnly || reversalFormDisabled}
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
                          {!_isReversal && (
                            <Button
                              type="button"
                              variant="subtle"
                              size="sm"
                              onClick={addAdjustmentRow}
                              title="Add row"
                              disabled={isReadOnly || reversalFormDisabled}
                            >
                              <IconPlus size={18} />
                            </Button>
                          )}
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

          {/* Invoice selection modal - not used in Receipt Reversal */}
          <Modal
            opened={invoiceModalOpen}
            onClose={() => {
              setInvoiceModalOpen(false);
              setInvoiceModalDetailRowIndex(null);
              setInvoiceModalBillTo(null);
              setInvoiceList([]);
              setSelectedInvoiceIndices(new Set());
            }}
            title="Select Invoice"
            size="lg"
            styles={{ title: { fontWeight: 600, color: "#105476" } }}
          >
            {filterInvoiceLoading || filterInvoiceFetching ? (
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
                {invoiceList.length === 0 &&
                  !filterInvoiceLoading &&
                  !filterInvoiceFetching && (
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
                      setInvoiceModalBillTo(null);
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
              onClick={() => navigate(effectiveBackPath)}
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
                  {_isReversal
                    ? reverseReceiptSaveResponse?.id
                      ? "Update Receipt Reversal"
                      : "Create Receipt Reversal"
                    : saveResponse?.id
                      ? "Update Receipt"
                      : "Save Receipt"}
                </Button>
                {_isReversal &&
                  reverseReceiptSaveResponse &&
                  String(
                    reverseReceiptSaveResponse.status ?? "",
                  ).toUpperCase() === "UNPOSTED" && (
                    <Button
                      type="button"
                      color="black"
                      variant="filled"
                      loading={isPosting}
                      onClick={handlePostReverseReceipt}
                    >
                      Post Receipt Reversal
                    </Button>
                  )}
                {!_isReversal && saveResponse && statusUpper === "UNPOSTED" && (
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
