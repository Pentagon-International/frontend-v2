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
  IconUpload,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useDisclosure } from "@mantine/hooks";
import { Dropzone } from "@mantine/dropzone";
import { useNavigate, useLocation } from "react-router-dom";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
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
import { apiCallProtected } from "../../../api/axios";
import useAuthStore from "../../../store/authStore";
import useDateFormat from "../../../hooks/useDateFormat";
import dayjs from "dayjs";
import { useCanPostDocuments } from "../../../hooks/useCanPostDocuments";
import { useAccountsDocumentCurrencyRoe } from "../../../hooks/useAccountsDocumentCurrencyRoe";
import {
  parseRoeForPayload,
  ROE_DECIMAL_PLACES,
  ROE_MAX_VALUE,
} from "../../../utils/exchangeRateRoe";
import {
  bindMoneyWholeNumberMode,
  clampMoneyAmountBound,
  formatMoneyAmountBound,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import { navigateFinanceReturn } from "../invoices/financeDocumentNavigation";
import { mergeEditPageAuditSources, appendEditPageAuditPatch } from "../../../utils/editPageAuditInfo";
import { getServerErrorMessage } from "../../../utils/apiErrorMessage";

const PAYMENT_TYPE_OPTIONS = [
  { value: "CHEQUE", label: "CHEQUE" },
  { value: "ONLINE", label: "ONLINE" },
  { value: "CASH", label: "CASH" },
  { value: "NEFT", label: "NEFT" },
  { value: "TT", label: "TT" },
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

// Header daybook: create payment flow (document_type PMT)
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
    const payload = { filters: { document_type: "" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (CRJ):", error);
    return [];
  }
};

// Header daybook: create payment reversal flow only (document_type PMTREV)
const fetchDaybookPMTREV = async () => {
  try {
    const payload = { filters: { document_type: "PMTREV" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (PMTREV):", error);
    return [];
  }
};

const AMOUNT_MAX = 9999999999999.99;

function clampAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value))
    return value === undefined ? null : value;
  const rounded = clampMoneyAmountBound(value);
  if (rounded == null) return null;
  if (Math.abs(rounded) > AMOUNT_MAX)
    return rounded > 0 ? AMOUNT_MAX : -AMOUNT_MAX;
  return rounded;
}

function formatChartOfAccountsLabel(
  glName: string | null | undefined,
  glAccountCode: string | null | undefined,
  accountName: string | null | undefined,
): string {
  const a = String(glName ?? "").trim();
  const b = String(glAccountCode ?? "").trim();
  const c = String(accountName ?? "").trim();
  return [c, b, a].filter(Boolean).join(" - ");
}

type DetailRow = {
  id?: number | null;
  subledger_id?: string | null;
  /** GL account code from chart-of-accounts (used for allocations modal filter) */
  account_code: string;
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

type InvoiceCombinedItem = {
  id?: number;
  doc_id?: number | string;
  document_no?: string;
  document_date?: string;
  due_date?: string;
  total?: number | string;
  document_amount?: number | string;
  daybook_id?: number | string;
  day_book_id?: number | string;
  daybook_name?: string;
  day_book_type?: string;
  day_book_document_type?: string;
  currency_id?: number | string;
  currency_code?: string;
  roe?: number | string;
  amount?: number | string;
  amount_in_local?: number | string;
  [key: string]: unknown;
};

function parseAllocationDocumentRoe(roe: unknown): number | null {
  if (roe == null || roe === "") return null;
  if (typeof roe === "number") return Number.isFinite(roe) ? roe : null;
  const n = parseFloat(String(roe));
  return Number.isFinite(n) ? n : null;
}

function seedAllocationRoeMap(
  map: Map<string, number>,
  items: InvoiceCombinedItem[],
) {
  for (const inv of items) {
    const docNo = (inv.document_no ?? "").toString().trim();
    const roe = parseAllocationDocumentRoe(inv.roe);
    if (docNo && roe != null) map.set(docNo, roe);
  }
}

function resolveAdjustmentDocumentRoe(
  adjustment: AdjustmentRow,
  roeByDocument: Map<string, number>,
): number | null {
  const fromRow = parseAllocationDocumentRoe(adjustment.roe);
  if (fromRow != null) return fromRow;
  const docNo = (adjustment.document_no ?? "").toString().trim();
  if (!docNo) return null;
  const fromMap = roeByDocument.get(docNo);
  return fromMap != null && Number.isFinite(fromMap) ? fromMap : null;
}

function calcAdjLocalFromCurr(
  curr: number | null,
  documentRoe: number | null,
): number | null {
  if (curr == null || !Number.isFinite(curr)) return null;
  if (documentRoe == null || !Number.isFinite(documentRoe)) return null;
  return clampAmount(curr * documentRoe);
}

const fetchOutstandingAllocations = async (payload: {
  account_code: string;
  subledger_code: string;
}): Promise<InvoiceCombinedItem[]> => {
  const response = await postAPICall(
    URL.outstandingAllocations,
    payload,
    API_HEADER,
  );
  const res = response as
    | { data?: InvoiceCombinedItem[] }
    | InvoiceCombinedItem[];
  const data = Array.isArray(res) ? res : res?.data;
  return Array.isArray(data) ? data : [];
};

type PaymentListItem = {
  id?: number;
  payment_no?: string;
  reverse_payment_no?: string;
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
  cheque_date?: string | null;
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

type SupportingDocument = {
  name: string;
  file: File | null;
  document_url?: string;
  document_id?: number;
  original_document_name?: string;
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
  chq_clrd_date: Date | null;
  details: DetailRow[];
  adjustments: AdjustmentRow[];
  supporting_documents: SupportingDocument[];
};

/** Map API/stored party Dr/Cr. When prefilling reversal create from a source payment, flip Dr↔Cr. */
function mapPaymentPartyDrCr(
  raw: string | null | undefined,
  flipForReversalSource: boolean,
): "Cr" | "Dr" {
  const side =
    String(raw ?? "")
      .trim()
      .toLowerCase() === "dr"
      ? "Dr"
      : "Cr";
  if (!flipForReversalSource) return side;
  return side === "Dr" ? "Cr" : "Dr";
}

const getDefaultDetailRow = (
  localCurrency: string,
  isReversalFlow = false,
): DetailRow => ({
  subledger_id: null,
  account_code: "",
  customer_code: "",
  customer_display: "",
  narration: "",
  currency: localCurrency,
  roe: 1,
  amount: null,
  local_amount: null,
  dr_cr: isReversalFlow ? "Cr" : "Dr",
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

/** YYYY-MM-DD for payment API payloads (local calendar day) */
function formatDateDDMMYYYY(date: Date | null | undefined): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
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

function formatDocumentDateDisplay(
  value: string | null | undefined,
  dateFormat: string,
): string {
  const d = parseDocumentDate(value);
  return d ? dayjs(d).format(dateFormat) : "—";
}

function formatOutstandingDocumentAmountInLocal(
  amountInLocal: number | string | null | undefined,
): string {
  if (amountInLocal == null || amountInLocal === "") return "—";
  if (typeof amountInLocal === "number")
    return Number.isFinite(amountInLocal)
      ? formatMoneyAmountBound(amountInLocal)
      : "—";
  const n = parseFloat(String(amountInLocal).trim());
  return Number.isFinite(n)
    ? formatMoneyAmountBound(n)
    : String(amountInLocal);
}

/** First non-empty trimmed string — API often returns `payment_no: ""` where `??` would not fall back. */
function firstNonEmptyString(
  ...candidates: Array<string | number | null | undefined>
): string {
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s !== "") return s;
  }
  return "";
}

type PaymentCreateProps = {
  titleOverride?: string;
  backPath?: string;
  isReversal?: boolean;
};

export default function PaymentCreate({
  titleOverride = "Create Payment",
  backPath = "/payment",
  isReversal: _isReversal = false,
}: PaymentCreateProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const dateFormat = useDateFormat();
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(isVietnamBranch);
  const canPostDocuments = useCanPostDocuments();
  const [loadedDetails, setLoadedDetails] = useState<DetailRow[] | null>(null);
  const sourcePaymentNoRef = useRef<string>("");
  const [reversePaymentSaveResponse, setReversePaymentSaveResponse] = useState<{
    id?: number;
    payment_no?: string;
    reverse_payment_no?: string;
    status?: string;
  } | null>(null);

  const {
    localCurrency,
    isLocalCurrency,
    syncRoeForCurrencyChange,
    onRoeValueChange,
    validateRoeField,
    validateRoeToast,
  } = useAccountsDocumentCurrencyRoe();
  const defaultBranch =
    user?.branches?.find((b) => b.is_default) || user?.branches?.[0];

  const [dropdownZIndex] = useState(300);
  const [
    documentsModalOpened,
    { open: openDocumentsModal, close: closeDocumentsModal },
  ] = useDisclosure(false);
  const [fileErrors, setFileErrors] = useState<{ [key: number]: string }>({});
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const downloadFile = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceModalDetailRowIndex, setInvoiceModalDetailRowIndex] = useState<
    number | null
  >(null);
  /** When set, allocations API is triggered (or served from cache) for this filter */
  const [invoiceModalAllocationFilter, setInvoiceModalAllocationFilter] =
    useState<{ account_code: string; subledger_code: string } | null>(null);
  const [invoiceList, setInvoiceList] = useState<InvoiceCombinedItem[]>([]);
  const allocationRoeByDocumentRef = useRef<Map<string, number>>(new Map());
  const [selectedInvoiceIndices, setSelectedInvoiceIndices] = useState<
    Set<number>
  >(new Set());
  const [
    isOpeningSupplierInvoiceFromModal,
    setIsOpeningSupplierInvoiceFromModal,
  ] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [saveResponse, setSaveResponse] = useState<{
    id?: number;
    payment_no?: string;
    document_no?: string;
    status?: string;
  } | null>(null);
  const [auditPatch, setAuditPatch] = useState<Record<string, unknown> | null>(
    null,
  );

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
      chq_clrd_date: null,
      details: [getDefaultDetailRow(localCurrency, _isReversal)],
      adjustments: [getDefaultAdjustmentRow(localCurrency)],
      supporting_documents: [] as SupportingDocument[],
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

  // Header daybook: PMT for create payment, PMTREV for create payment reverse (same as Receipt RPT + RPTREV)
  const { data: daybookDataPMT = [] } = useQuery({
    queryKey: ["daybook", "PMT"],
    queryFn: fetchDaybookPMT,
    staleTime: Infinity,
  });

  const { data: daybookDataPMTREV = [] } = useQuery({
    queryKey: ["daybook", "PMTREV"],
    queryFn: fetchDaybookPMTREV,
    staleTime: Infinity,
  });

  const { data: daybookDataForAdjustments = [] } = useQuery({
    queryKey: ["daybook", "CRJ"],
    queryFn: fetchDaybookCRJ,
    staleTime: Infinity,
  });

  const {
    data: filterInvoiceData,
    isLoading: filterInvoiceLoading,
    isFetching: filterInvoiceFetching,
    isError: filterInvoiceError,
  } = useQuery({
    queryKey: [
      "outstandingAllocations",
      invoiceModalAllocationFilter?.account_code ?? "",
      invoiceModalAllocationFilter?.subledger_code ?? "",
    ],
    queryFn: () => fetchOutstandingAllocations(invoiceModalAllocationFilter!),
    enabled:
      invoiceModalOpen &&
      !!invoiceModalAllocationFilter?.account_code &&
      !!invoiceModalAllocationFilter?.subledger_code,
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
    const data = (_isReversal ? daybookDataPMTREV : daybookDataPMT) as {
      id?: number;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [_isReversal, daybookDataPMT, daybookDataPMTREV]);

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
  const loadedFromListState = paymentFromState?.id != null;
  const pathname = location.pathname;

  useEffect(() => {
    setAuditPatch(null);
  }, [location.key]);

  const isReversalEditOrView =
    _isReversal &&
    (pathname.includes("/reversal/edit") ||
      pathname.includes("/reversal/view"));
  const isReversalCreate = _isReversal && pathname.includes("/reversal/create");

  const financeReturnTo =
    (location.state as { returnTo?: string } | null)?.returnTo?.trim() ?? "";
  const paymentResolvedBackPath =
    isReversalCreate && !financeReturnTo
      ? "/payment"
      : financeReturnTo || backPath;
  const handlePaymentBack = () => {
    navigateFinanceReturn(navigate, location.state, paymentResolvedBackPath);
  };

  // Load from list: state is payment row (Payment Master or Reversal list) or source payment (reversal create from Payment Master)
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
    const chqClrdDateVal = parseDocumentDate(paymentFromState.chq_clrd_date);
    const chequeDateVal = parseDocumentDate(paymentFromState.cheque_date);
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
              account_code: String(pAny.account_code ?? "").trim(),
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
              dr_cr: mapPaymentPartyDrCr(pAny.dr_cr, isReversalCreate),
            };
          })
        : [getDefaultDetailRow(localCurrency, _isReversal)];

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
              subledger: String(
                aAny.subledger_code ?? aAny.subledger ?? "",
              ).trim(),
              subledger_display: String(
                aAny.subledger_name ?? aAny.subledger ?? "",
              ).trim(),
              daybook_id:
                aAny.day_book_id != null ? String(aAny.day_book_id) : "",
              document_no: String(aAny.document_no ?? "").trim(),
              doc_date: parseDocumentDate(aAny.document_date),
              currency: (aAny.currency_code ?? localCurrency).toString().trim(),
              roe: parseAllocationDocumentRoe(roeFromApi),
              adj_curr_amount: parseNum(aAny.adj_curr_amount),
              adj_local_amount: parseNum(aAny.adj_local_amount),
            };
          })
        : [getDefaultAdjustmentRow(localCurrency)];

    setLoadedDetails(details);
    form.setValues({
      daybook_id: isReversalCreate
        ? ""
        : paymentFromState.day_book_id != null
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
      cheque_date: chequeDateVal,
      chq_clrd_date: chqClrdDateVal,
      details,
      adjustments,
    });
    if (details.length > 0) form.setFieldValue("details", details);

    const docNo = (
      paymentFromState.payment_no ??
      (paymentFromState as { document_no?: string }).document_no ??
      ""
    ).toString();

    if (_isReversal) {
      if (isReversalEditOrView) {
        setReversePaymentSaveResponse({
          id: Number(paymentFromState.id),
          payment_no: (paymentFromState.payment_no ?? "").toString(),
          reverse_payment_no: (
            paymentFromState.reverse_payment_no ?? ""
          ).toString(),
          status: (paymentFromState.status ?? "UNPOSTED").toString(),
        });
        // Original payment no for API `payment_no`; keep when save/post response omits it.
        sourcePaymentNoRef.current = (
          paymentFromState.payment_no ?? ""
        ).toString();
      } else {
        sourcePaymentNoRef.current = (
          paymentFromState.payment_no ?? ""
        ).toString();
      }
    } else {
      setSaveResponse({
        id: Number(paymentFromState.id),
        payment_no: docNo,
        document_no: docNo,
        status: (paymentFromState.status ?? "UNPOSTED").toString(),
      });
    }

    // Populate supporting documents for edit/view only — reversal create starts empty
    if (!isReversalCreate) {
      const rawDocs = (paymentFromState as any)?.documents;
      if (Array.isArray(rawDocs) && rawDocs.length > 0) {
        const mapped = rawDocs.map((doc: any) => ({
          name: (doc.document_name ?? doc.file_name ?? "").toString(),
          file: null as File | null,
          document_url: doc.document_url ?? doc.document ?? "",
          document_id: doc.id ?? undefined,
          original_document_name: (
            doc.document_name ??
            doc.file_name ??
            ""
          ).toString(),
        }));
        form.setFieldValue("supporting_documents", mapped);
      }
    } else {
      form.setFieldValue("supporting_documents", []);
    }

    // Re-run when state changes (e.g. navigating from list to edit/view with different row)
  }, [
    paymentFromState,
    localCurrency,
    _isReversal,
    isReversalEditOrView,
    isReversalCreate,
    location.key,
  ]);

  const partyAccountCodeBackfillKey = (form.values.details ?? [])
    .map((d) => `${d.customer_code}|${d.account_code ?? ""}`)
    .join(";");

  // Edit: backfill document ROE from outstanding allocations when list rows omit it.
  useEffect(() => {
    if (!loadedFromListState) return;

    const adjustments = form.values.adjustments ?? [];
    const needsLookup = adjustments.some(
      (a) =>
        (a.document_no ?? "").toString().trim() &&
        resolveAdjustmentDocumentRoe(a, allocationRoeByDocumentRef.current) ==
          null,
    );
    if (!needsLookup) return;

    const partyKeys = new Map<
      string,
      { account_code: string; subledger_code: string }
    >();
    for (const d of form.values.details ?? []) {
      const accountCode = (d.account_code ?? "").toString().trim();
      const subledgerCode = (d.customer_code ?? "").toString().trim();
      if (!accountCode || !subledgerCode) continue;
      partyKeys.set(`${accountCode}|${subledgerCode}`, {
        account_code: accountCode,
        subledger_code: subledgerCode,
      });
    }
    if (partyKeys.size === 0) return;

    let cancelled = false;
    void (async () => {
      for (const party of partyKeys.values()) {
        try {
          const list = await fetchOutstandingAllocations(party);
          if (cancelled) return;
          seedAllocationRoeMap(allocationRoeByDocumentRef.current, list);
        } catch {
          // ignore lookup failures
        }
      }
      if (cancelled) return;

      let changed = false;
      const updated = adjustments.map((a) => {
        const documentRoe = resolveAdjustmentDocumentRoe(
          a,
          allocationRoeByDocumentRef.current,
        );
        if (documentRoe == null || a.roe != null) return a;
        changed = true;
        return { ...a, roe: documentRoe };
      });
      if (changed) form.setFieldValue("adjustments", updated);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadedFromListState, paymentFromState?.id, partyAccountCodeBackfillKey]);

  // Create only: auto-fetch ROE when currency is set. Edit/view/reversal-from-list use list row ROE;
  // exchange rate master is called only when the user changes currency (dropdown onChange).
  useEffect(() => {
    const curr = form.values.currency?.trim();
    if (!curr || !localCurrency || loadedFromListState) return;
    syncRoeForCurrencyChange(curr, (roe) => form.setFieldValue("roe", roe));
  }, [
    form.values.currency,
    localCurrency,
    loadedFromListState,
    syncRoeForCurrencyChange,
  ]);

  const partyLocalAmountsSnapshot = form.values.details
    .map((d) => d.local_amount ?? "")
    .join(";");
  const headerAmountRoeKey = `${form.values.amount ?? ""}|${form.values.roe ?? ""}`;
  const prevPartyLocalRef = useRef(partyLocalAmountsSnapshot);
  const prevHeaderAmountRoeRef = useRef(headerAmountRoeKey);

  useEffect(() => {
    const partyLocalChanged =
      prevPartyLocalRef.current !== partyLocalAmountsSnapshot;
    const headerAmountRoeChanged =
      prevHeaderAmountRoeRef.current !== headerAmountRoeKey;

    if (partyLocalChanged) {
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
    } else if (headerAmountRoeChanged) {
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
    }

    prevPartyLocalRef.current = partyLocalAmountsSnapshot;
    prevHeaderAmountRoeRef.current = headerAmountRoeKey;
  }, [partyLocalAmountsSnapshot, headerAmountRoeKey]);

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

  const showChequeSection = form.values.type !== "CASH";

  const addDetailRow = () => {
    setLoadedDetails(null);
    form.insertListItem(
      "details",
      getDefaultDetailRow(localCurrency, _isReversal),
    );
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
    const accountCode = (row?.account_code ?? "").toString().trim();
    const subledgerCode = (row?.customer_code ?? "").toString().trim();
    if (!accountCode || !subledgerCode) return;
    setInvoiceModalDetailRowIndex(detailRowIndex);
    setInvoiceModalAllocationFilter({
      account_code: accountCode,
      subledger_code: subledgerCode,
    });
    setInvoiceModalOpen(true);
    setInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
  };

  useEffect(() => {
    if (!invoiceModalOpen || !filterInvoiceData) return;
    const list = filterInvoiceData;
    seedAllocationRoeMap(allocationRoeByDocumentRef.current, list);
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
        message: "Failed to load documents",
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

  const openSupplierInvoiceFromAllocationRow = async (
    inv: InvoiceCombinedItem,
  ) => {
    const docType = String(
      inv.day_book_document_type ?? inv.day_book_type ?? "",
    )
      .trim()
      .toUpperCase();
    if (docType !== "CRJ") return;

    const docIdRaw = inv.doc_id;
    const docId = docIdRaw != null ? Number(docIdRaw) : NaN;
    if (!Number.isFinite(docId) || docId <= 0) {
      ToastNotification({
        type: "warning",
        message: "Supplier invoice not found",
      });
      return;
    }

    const newTab = window.open("about:blank", "_blank");
    if (!newTab) {
      ToastNotification({
        type: "warning",
        message:
          "Popup blocked. Please allow popups to open the supplier invoice in a new tab.",
      });
      return;
    }

    try {
      setIsOpeningSupplierInvoiceFromModal(true);
      const res = await apiCallProtected.get(
        `${URL.supplierInvoice}${docId}/`,
        API_HEADER,
      );
      const rawData = (res as { data?: unknown })?.data ?? res;
      const record =
        rawData &&
        typeof rawData === "object" &&
        "data" in (rawData as Record<string, unknown>) &&
        (rawData as { data?: unknown }).data &&
        typeof (rawData as { data?: unknown }).data === "object"
          ? ((rawData as { data?: Record<string, unknown> }).data ?? null)
          : rawData && typeof rawData === "object"
            ? (rawData as Record<string, unknown>)
            : null;

      const statusUpper = record
        ? String(record.status ?? "")
            .trim()
            .toUpperCase()
        : "";
      const mode = statusUpper === "POSTED" ? "view" : "edit";

      setIsOpeningSupplierInvoiceFromModal(false);
      const supplierPath = `/supplier-invoice/${mode}/${docId}`;
      const supplierUrl = new window.URL(
        supplierPath,
        window.location.origin,
      ).toString();
      newTab.location.href = supplierUrl;
      try {
        newTab.opener = null;
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      console.error("Failed to open supplier invoice", e);
      ToastNotification({
        type: "error",
        message: "Unable to open supplier invoice details.",
      });
      try {
        newTab.close();
      } catch {
        // ignore
      }
      setIsOpeningSupplierInvoiceFromModal(false);
    }
  };

  const handleSelectInvoice = () => {
    if (invoiceModalDetailRowIndex == null) return;
    const sorted = Array.from(selectedInvoiceIndices).sort((a, b) => a - b);
    if (sorted.length === 0) {
      ToastNotification({
        type: "warning",
        message: "Please select at least one document",
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
        inv.amount != null
          ? typeof inv.amount === "number"
            ? inv.amount
            : typeof inv.amount === "string"
              ? parseFloat(inv.amount) || null
              : null
          : typeof inv.total === "number"
            ? inv.total
            : typeof inv.total === "string"
              ? parseFloat(inv.total) || null
              : null;
      const localTotalNum =
        inv.amount_in_local != null
          ? typeof inv.amount_in_local === "number"
            ? inv.amount_in_local
            : typeof inv.amount_in_local === "string"
              ? parseFloat(inv.amount_in_local) || null
              : null
          : null;
      const invRoe = parseAllocationDocumentRoe(inv.roe);
      const daybookId = inv.day_book_id ?? inv.daybook_id;
      return {
        location: branchCode,
        type: ((inv.day_book_document_type as string) ??
          (inv.day_book_type as string) ??
          "") as string,
        subledger: detailRow?.customer_code ?? "",
        subledger_display: detailRow?.customer_display ?? "",
        daybook_id: daybookId != null ? String(daybookId) : "",
        document_no: (inv.document_no ?? "").toString(),
        doc_date: docDate,
        currency: (inv.currency_code ?? localCurrency).toString().trim(),
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
    seedAllocationRoeMap(
      allocationRoeByDocumentRef.current,
      sorted.map((listIdx) => invoiceList[listIdx]),
    );
    form.setFieldValue("adjustments", nextAdjustments);
    syncPartyDetailsFromAllocations(nextAdjustments);
    setInvoiceModalOpen(false);
    setInvoiceModalDetailRowIndex(null);
    setInvoiceModalAllocationFilter(null);
    setInvoiceList([]);
    setSelectedInvoiceIndices(new Set());
  };

  const buildPaymentPayload = (
    values: PaymentFormValues,
    options: { status?: string } = {},
  ) => {
    const rawAdjustments = values.adjustments ?? [];
    const nonEmptyAdjustments = rawAdjustments.filter((a) => {
      const hasAmounts =
        (a.adj_local_amount != null &&
          Number.isFinite(a.adj_local_amount) &&
          a.adj_local_amount !== 0) ||
        (a.adj_curr_amount != null &&
          Number.isFinite(a.adj_curr_amount) &&
          a.adj_curr_amount !== 0);
      const hasDocument = (a.document_no ?? "").trim() !== "";
      return hasAmounts || hasDocument;
    });

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
      roe: parseRoeForPayload(values.roe) ?? 0,
      amount: values.amount ?? 0,
      local_amount: values.local_amount ?? 0,
      narration: values.narration ?? "",
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      cheque_date: formatDateDDMMYYYY(values.cheque_date),
      chq_clrd_date: formatDateDDMMYYYY(values.chq_clrd_date),
      dr_cr: (paymentFromState?.dr_cr ?? "Cr").toString(),
      parties: (values.details ?? []).map((d) => ({
        ...(d.id != null && d.id > 0 ? { id: d.id } : {}),
        account_code: d.account_code ?? "",
        subledger_code: d.customer_code ?? "",
        narration: d.narration ?? "",
        currency_id: currencyIdByCode[d.currency?.trim().toUpperCase()] ?? 0,
        roe: parseRoeForPayload(d.roe) ?? 0,
        amount: d.amount ?? 0,
        local_amount: d.local_amount ?? 0,
        dr_cr: (d.dr_cr ?? "Dr").toString(),
      })),
      allocations: nonEmptyAdjustments.map((a) => ({
        ...(a.id != null && a.id > 0 ? { id: a.id } : {}),
        location: a.location ?? "",
        subledger_code: a.subledger ?? a.subledger_display ?? "",
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

  /** Build payload for reverse-payment API. Header dr_cr = "Dr"; party lines default Cr. */
  const buildReversalPayload = (
    values: PaymentFormValues,
    options?: {
      reversalId?: number;
      paymentNo?: string;
      status?: string;
      detailsOverride?: DetailRow[];
    },
  ) => {
    const rawAdjustments = values.adjustments ?? [];
    const nonEmptyAdjustments = rawAdjustments.filter((a) => {
      const hasAmounts =
        (a.adj_local_amount != null &&
          Number.isFinite(a.adj_local_amount) &&
          a.adj_local_amount !== 0) ||
        (a.adj_curr_amount != null &&
          Number.isFinite(a.adj_curr_amount) &&
          a.adj_curr_amount !== 0);
      const hasDocument = (a.document_no ?? "").trim() !== "";
      return hasAmounts || hasDocument;
    });

    const dayBookId = Number(values.daybook_id) || 0;
    const currencyId =
      currencyIdByCode[values.currency?.trim().toUpperCase()] ?? 0;
    const paymentNo = firstNonEmptyString(
      options?.paymentNo,
      sourcePaymentNoRef.current,
    );
    const isUpdate = options?.reversalId != null && options.reversalId > 0;
    const details = options?.detailsOverride ?? values.details ?? [];
    const source = paymentFromState as
      | Record<string, unknown>
      | null
      | undefined;
    const base: Record<string, unknown> = {
      payment_no: paymentNo,
      date: formatDateDDMMYYYY(values.date),
      day_book_id: dayBookId,
      type: (values.type ?? "CASH").toString().toUpperCase(),
      currency_id: currencyId,
      roe: parseRoeForPayload(values.roe) ?? 0,
      account_code: (source?.account_code ?? "").toString(),
      received_from: (source?.received_from ?? "").toString(),
      amount: values.amount ?? 0,
      local_amount: values.local_amount ?? 0,
      narration: values.narration ?? "",
      note: (source?.note ?? "").toString(),
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      cheque_date: formatDateDDMMYYYY(values.cheque_date),
      chq_clrd_date: formatDateDDMMYYYY(values.chq_clrd_date),
      dr_cr: "Dr",
      parties: details.map((d) => ({
        account_code: d.account_code ?? "",
        subledger_code: d.customer_code ?? "",
        narration: d.narration ?? "",
        currency_id: currencyIdByCode[d.currency?.trim().toUpperCase()] ?? 0,
        roe: parseRoeForPayload(d.roe) ?? 0,
        amount: d.amount ?? 0,
        local_amount: d.local_amount ?? 0,
        dr_cr: (d.dr_cr ?? "Cr").toString(),
      })),
      allocations: nonEmptyAdjustments.map((a) => ({
        location: a.location ?? "",
        subledger_code: a.subledger ?? a.subledger_display ?? "",
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
    if (options?.status != null) {
      base.status = options.status.toString().toUpperCase();
    }
    return base;
  };

  const FORM_DATA_HEADERS = {
    ...API_HEADER,
    headers: {
      ...API_HEADER.headers,
      "Content-Type": "multipart/form-data",
    },
  };

  /**
   * Builds a multipart/form-data body for payment API calls.
   * Fields:
   *   payment           – JSON-stringified payload
   *   document_names[i] – display name for document i
   *   document[i]       – File object for document i
   *   document_id[i]    – server-side ID of an existing document (when replacing)
   */
  const buildPaymentFormData = (payload: object): FormData => {
    const fd = new FormData();
    fd.append("payment", JSON.stringify(payload));
    let fileIndex = 0;
    form.values.supporting_documents.forEach((doc) => {
      if (doc.file) {
        if (doc.name) fd.append(`document_names[${fileIndex}]`, doc.name);
        fd.append(`document[${fileIndex}]`, doc.file);
        if (doc.document_id != null)
          fd.append(`document_id[${fileIndex}]`, String(doc.document_id));
        fileIndex++;
      }
    });
    return fd;
  };

  /**
   * Builds a multipart/form-data body for reverse-payment API calls.
   * Fields:
   *   reverse_payment   – JSON-stringified payload
   *   document_names[i] – display name for document i
   *   document[i]       – File object for document i
   *   document_id[i]    – server-side ID of an existing document (when replacing)
   */
  const buildReversalFormData = (payload: object): FormData => {
    const fd = new FormData();
    fd.append("reverse_payment", JSON.stringify(payload));
    let docIndex = 0;
    form.values.supporting_documents.forEach((doc) => {
      if (doc.file) {
        fd.append(`document_names[${docIndex}]`, (doc.name ?? "").toString());
        fd.append(`document[${docIndex}]`, doc.file);
        if (doc.document_id != null) {
          fd.append(`document_id[${docIndex}]`, String(doc.document_id));
        }
      } else if (doc.document_id != null) {
        fd.append(`document_id[${docIndex}]`, String(doc.document_id));
      }
      docIndex++;
    });
    return fd;
  };

  const handleSubmit = async (values: PaymentFormValues) => {
    // Posted documents: only Cheque Cleared Date may be updated via PATCH.
    const postedStatus = String(saveResponse?.status ?? "").toUpperCase();
    if (
      !_isReversal &&
      pathname.includes("/edit") &&
      postedStatus === "POSTED" &&
      saveResponse?.id != null
    ) {
      const newDocs = values.supporting_documents.filter(
        (d) => d.document_id == null,
      );
      const hasNewFiles = newDocs.some((d) => d.file != null);

      if (hasNewFiles) {
        const incompleteNewDoc = newDocs.some(
          (d) =>
            (Boolean(d.file) && !(d.name ?? "").trim()) ||
            (Boolean((d.name ?? "").trim()) && !d.file),
        );
        if (incompleteNewDoc) {
          ToastNotification({
            message: "Each new document must have both a name and a file.",
            type: "error",
          });
          return;
        }
        const oversized = values.supporting_documents.some(
          (doc) => doc.file != null && doc.file.size > MAX_FILE_SIZE,
        );
        if (oversized) {
          ToastNotification({
            message: "One or more files exceed the 5MB limit.",
            type: "error",
          });
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const id = saveResponse.id;
        if (hasNewFiles) {
          const fd = new FormData();
          fd.append(
            "payment",
            JSON.stringify({
              id,
              chq_clrd_date: formatDateDDMMYYYY(values.chq_clrd_date),
            }),
          );
          let fileIndex = 0;
          values.supporting_documents.forEach((doc) => {
            if (!doc.file) return;
            fd.append(
              `document_names[${fileIndex}]`,
              (doc.name ?? "").toString(),
            );
            fd.append(`document[${fileIndex}]`, doc.file);
            fileIndex++;
          });
          const raw = (await apiCallProtected.patch(
            `${URL.payment}${id}/`,
            fd,
            FORM_DATA_HEADERS,
          )) as any;
          const res = raw?.data?.data ?? raw?.data ?? raw;
          if (Array.isArray(res?.documents)) {
            form.setFieldValue(
              "supporting_documents",
              res.documents.map((doc: any) => ({
                name: (
                  doc.document_name ??
                  doc.file_name ??
                  doc.name ??
                  ""
                ).toString(),
                file: null,
                document_url: doc.document_url ?? doc.url ?? "",
                document_id: doc.id ?? undefined,
                original_document_name:
                  doc.original_document_name ??
                  doc.document_name ??
                  doc.file_name ??
                  "",
              })),
            );
          }
          await queryClient.invalidateQueries({ queryKey: ["payment"] });
          ToastNotification({
            type: "success",
            message: "Payment updated successfully.",
          });
        } else {
          await apiCallProtected.patch(
            `${URL.payment}${id}/`,
            {
              id,
              chq_clrd_date: formatDateDDMMYYYY(values.chq_clrd_date),
            },
            API_HEADER,
          );
          await queryClient.invalidateQueries({ queryKey: ["payment"] });
          ToastNotification({
            type: "success",
            message: "Cheque Cleared Date updated successfully.",
          });
        }
      } catch (e: unknown) {
        console.error("Failed to update posted payment", e);
        ToastNotification({
          type: "error",
          message: getServerErrorMessage(e, "Failed to update payment."),
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const headerRoeToastError = validateRoeToast(values.currency, values.roe);
    if (headerRoeToastError) {
      form.setFieldError(
        "roe",
        validateRoeField(values.currency, values.roe) ?? headerRoeToastError,
      );
      ToastNotification({ type: "error", message: headerRoeToastError });
      return;
    }
    for (let i = 0; i < (values.details ?? []).length; i++) {
      const detail = values.details[i];
      const detailRoeToastError = validateRoeToast(detail.currency, detail.roe);
      if (detailRoeToastError) {
        form.setFieldError(
          `details.${i}.roe`,
          validateRoeField(detail.currency, detail.roe) ?? detailRoeToastError,
        );
        ToastNotification({ type: "error", message: detailRoeToastError });
        return;
      }
    }

    const hasAdjustments = (values.adjustments ?? []).some((a) => {
      const hasAmounts =
        (a.adj_local_amount != null &&
          Number.isFinite(a.adj_local_amount) &&
          a.adj_local_amount !== 0) ||
        (a.adj_curr_amount != null &&
          Number.isFinite(a.adj_curr_amount) &&
          a.adj_curr_amount !== 0);
      const hasDocument = (a.document_no ?? "").trim() !== "";
      return hasAmounts || hasDocument;
    });
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
    // Validation aligned with Receipt: when adjustments exist, Party total
    // should not be less than total allocation amount.
    if (hasAdjustments && partyLocalTotal < adjLocalTotal) {
      ToastNotification({
        type: "error",
        message:
          "The total Local Amount of Payment cannot be less than the total Local Amount of Invoice.",
      });
      return;
    }
    // Important: allow saving "open payment" (no adjustments),
    // same as Receipt. So we DO NOT restrict party totals when allocations are empty.
    // Also, unlike the earlier logic, we don't block when partyLocalTotal > adjLocalTotal.
    setIsSubmitting(true);
    try {
      if (_isReversal) {
        const isReversalUpdate =
          reversePaymentSaveResponse?.id != null &&
          reversePaymentSaveResponse.id > 0;
        const detailsForPayload =
          loadedDetails &&
          loadedDetails.length === (values.details ?? []).length
            ? loadedDetails
            : (values.details ?? []);

        if (isReversalUpdate) {
          const payload = buildReversalPayload(values, {
            reversalId: reversePaymentSaveResponse.id,
            paymentNo: reversePaymentSaveResponse.payment_no ?? "",
            status: "UNPOSTED",
            detailsOverride: detailsForPayload,
          });
          const fd = buildReversalFormData(payload);
          const raw = (await apiCallProtected.put(
            `${URL.reversePayment}${reversePaymentSaveResponse.id}/`,
            fd,
            FORM_DATA_HEADERS,
          )) as any;
          const res = raw?.data?.data ?? raw?.data ?? raw;
          if (res?.id != null) {
            setReversePaymentSaveResponse((prev) => ({
              ...prev!,
              id: prev!.id,
              payment_no: firstNonEmptyString(
                sourcePaymentNoRef.current,
                res.payment_no,
                prev?.payment_no,
              ),
              reverse_payment_no: firstNonEmptyString(
                res.reverse_payment_no,
                prev?.reverse_payment_no,
              ),
              status: res.status != null ? String(res.status) : "UNPOSTED",
            }));
            setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));
            await queryClient.invalidateQueries({ queryKey: ["payment"] });
            await queryClient.invalidateQueries({
              queryKey: ["payment-reversal"],
            });
            ToastNotification({
              type: "success",
              message: "Payment reversal updated successfully.",
            });
          }
        } else {
          const payload = buildReversalPayload(values, {
            detailsOverride: detailsForPayload,
          });
          const fd = buildReversalFormData(payload);
          const raw = (await apiCallProtected.post(
            URL.reversePayment,
            fd,
            FORM_DATA_HEADERS,
          )) as any;
          const data = (raw as any)?.data?.data ?? (raw as any)?.data ?? raw;
          if (data?.id != null) {
            setReversePaymentSaveResponse({
              id: Number(data.id),
              payment_no: firstNonEmptyString(
                sourcePaymentNoRef.current,
                data.payment_no,
              ),
              reverse_payment_no: firstNonEmptyString(data.reverse_payment_no),
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
            await queryClient.invalidateQueries({ queryKey: ["payment"] });
            await queryClient.invalidateQueries({
              queryKey: ["payment-reversal"],
            });
            ToastNotification({
              type: "success",
              message: "Payment reversal created successfully.",
            });
          }
        }
        setIsSubmitting(false);
        return;
      }

      const isUpdate = saveResponse?.id != null && saveResponse.id > 0;
      const payload = isUpdate
        ? buildPaymentPayload(values, { status: "UNPOSTED" })
        : buildPaymentPayload(values);
      payload.is_agent = false;
      if (isUpdate) {
        const fd = buildPaymentFormData(payload);
        const raw = (await apiCallProtected.put(
          `${URL.payment}${saveResponse!.id}/`,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        const res = raw?.data?.data ?? raw?.data ?? raw;
        if (res?.id != null) {
          setSaveResponse({
            id: res.id ?? saveResponse.id,
            payment_no: res.payment_no ?? saveResponse.payment_no ?? "",
            document_no: saveResponse.document_no ?? "",
            status: res.status != null ? String(res.status) : "UNPOSTED",
          });
          setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));
          // Refresh documents from response
          if (Array.isArray(res.documents) && res.documents.length > 0) {
            form.setFieldValue(
              "supporting_documents",
              res.documents.map((doc: any) => ({
                name: (doc.document_name ?? doc.file_name ?? "").toString(),
                file: null,
                document_url: doc.document_url ?? doc.document ?? "",
                document_id: doc.id ?? undefined,
                original_document_name: (
                  doc.document_name ??
                  doc.file_name ??
                  ""
                ).toString(),
              })),
            );
          }
          await queryClient.invalidateQueries({ queryKey: ["payment"] });
          ToastNotification({
            type: "success",
            message: "Payment updated successfully.",
          });
        }
      } else {
        const fd = buildPaymentFormData(payload);
        const raw = (await apiCallProtected.post(
          URL.payment,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        const data = raw?.data?.data ?? raw?.data ?? raw;
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
          // Refresh documents from response
          if (Array.isArray(data.documents) && data.documents.length > 0) {
            form.setFieldValue(
              "supporting_documents",
              data.documents.map((doc: any) => ({
                name: (doc.document_name ?? doc.file_name ?? "").toString(),
                file: null,
                document_url: doc.document_url ?? doc.document ?? "",
                document_id: doc.id ?? undefined,
                original_document_name: (
                  doc.document_name ??
                  doc.file_name ??
                  ""
                ).toString(),
              })),
            );
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
        message: getServerErrorMessage(err, "Failed to save payment."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostPayment = async () => {
    if (_isReversal) {
      if (!reversePaymentSaveResponse?.id) {
        ToastNotification({
          type: "error",
          message: "Save the payment reversal first before posting.",
        });
        return;
      }
      setIsPosting(true);
      try {
        const payload = buildReversalPayload(form.values, {
          reversalId: reversePaymentSaveResponse.id,
          paymentNo: reversePaymentSaveResponse.payment_no ?? "",
          status: "POSTED",
        });
        const fd = buildReversalFormData(payload);
        const raw = (await apiCallProtected.put(
          `${URL.reversePayment}${reversePaymentSaveResponse.id}/`,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        const res = raw?.data?.data ?? raw?.data ?? raw;
        if (res?.id != null) {
          setReversePaymentSaveResponse((prev) => ({
            ...prev!,
            id: prev!.id,
            payment_no: firstNonEmptyString(
              sourcePaymentNoRef.current,
              res.payment_no,
              prev?.payment_no,
            ),
            reverse_payment_no: firstNonEmptyString(
              res.reverse_payment_no,
              prev?.reverse_payment_no,
            ),
            status: res.status != null ? String(res.status) : "POSTED",
          }));
          await queryClient.invalidateQueries({ queryKey: ["payment"] });
          await queryClient.invalidateQueries({
            queryKey: ["payment-reversal"],
          });
          ToastNotification({
            type: "success",
            message: "Payment reversal posted successfully.",
          });
        }
      } catch (err) {
        console.error("Post payment reversal error:", err);
        ToastNotification({
          type: "error",
          message: getServerErrorMessage(err, "Failed to post payment reversal."),
        });
      } finally {
        setIsPosting(false);
      }
      return;
    }

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
      payload.is_agent = false;
      const fd = buildPaymentFormData(payload);
      const raw = (await apiCallProtected.put(
        `${URL.payment}${saveResponse!.id}/`,
        fd,
        FORM_DATA_HEADERS,
      )) as any;
      const res = raw?.data?.data ?? raw?.data ?? raw;
      if (res?.id != null) {
        setSaveResponse((prev) => ({
          ...prev,
          id: res.id ?? prev?.id,
          payment_no: res.payment_no ?? prev?.payment_no ?? "",
          document_no: prev?.document_no ?? "",
          status: res.status != null ? String(res.status) : "POSTED",
        }));
        setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));
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
        message: getServerErrorMessage(err, "Failed to post payment."),
      });
    } finally {
      setIsPosting(false);
    }
  };

  const statusUpper = String(saveResponse?.status ?? "").toUpperCase();
  const reversalStatusUpper = String(
    reversePaymentSaveResponse?.status ?? "",
  ).toUpperCase();
  const isViewRoute = pathname.includes("/view");
  // Posted edit: allow updating Cheque Cleared Date only (PATCH).
  const isPostedChequeClearanceEdit =
    !_isReversal &&
    !isViewRoute &&
    pathname.includes("/edit") &&
    statusUpper === "POSTED";
  const isReadOnly =
    isViewRoute ||
    (!_isReversal && statusUpper === "POSTED") ||
    (_isReversal && reversalStatusUpper === "POSTED");
  const canAttachDocumentsAfterPost =
    !_isReversal &&
    !isViewRoute &&
    pathname.includes("/edit") &&
    statusUpper === "POSTED" &&
    saveResponse?.id != null &&
    saveResponse.id > 0;
  const canManageSupportingDocuments =
    !isReadOnly || canAttachDocumentsAfterPost;
  const reversalFormDisabled = _isReversal;
  const inputStyles =
    isReadOnly || reversalFormDisabled ? readOnlyFieldStyles : fieldStyles;
  const headerDateDisabled = isReadOnly;
  const chequeClearanceDateDisabled =
    headerDateDisabled && !isPostedChequeClearanceEdit;
  const headerOtherDisabled = isReadOnly || reversalFormDisabled;
  const useNonEditableStyleOnly = isReadOnly || _isReversal;
  const headerFieldStyles = headerOtherDisabled
    ? useNonEditableStyleOnly
      ? reversalNonEditableStyles
      : readOnlyFieldStyles
    : fieldStyles;
  // Party details: same read-only styling rule as Receipt (isReadOnly || reversalFormDisabled)
  const partyFieldStyles =
    isReadOnly || reversalFormDisabled
      ? useNonEditableStyleOnly
        ? reversalNonEditableStyles
        : readOnlyFieldStyles
      : fieldStyles;
  const adjustmentFieldStyles = reversalNonEditableStyles;
  // On reversal page, header daybook and date are editable; all other fields disabled (same as Receipt).
  const isHeaderDaybookEditable = _isReversal && !isReadOnly;
  const headerDaybookStyles = isHeaderDaybookEditable
    ? fieldStyles
    : useNonEditableStyleOnly
      ? reversalNonEditableStyles
      : inputStyles;

  const showAuditInfo =
    pathname.includes("/edit") || pathname.includes("/view");
  const paymentAuditSource = mergeEditPageAuditSources(
    paymentFromState,
    _isReversal ? reversePaymentSaveResponse : saveResponse,
    auditPatch,
  );

  const pageTitle = pathname.includes("/payment/reversal/view")
    ? "View Payment Reversal"
    : pathname.includes("/payment/reversal/edit")
      ? "Edit Payment Reversal"
      : pathname.includes("/payment/reversal/create")
        ? "Create Payment Reversal"
        : pathname.includes("/payment/view")
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
                ? _isReversal
                  ? "Updating payment reversal..."
                  : "Updating payment..."
                : _isReversal
                  ? reversePaymentSaveResponse?.id
                    ? "Updating payment reversal..."
                    : "Saving payment reversal..."
                  : saveResponse?.id
                    ? "Updating payment..."
                    : "Saving payment..."}
            </Text>
          </Stack>
        </Box>
      )}
      <Stack gap="md">
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <EditPageHeadingRow
            visible={showAuditInfo && Boolean(paymentAuditSource)}
            auditSource={paymentAuditSource}
            animateKey={(paymentAuditSource as { id?: number })?.id}
          >
            <Text size="xl" fw={600} c="#105476">
              {pageTitle}
            </Text>
          </EditPageHeadingRow>
          <Group gap="md" wrap="nowrap">
            {saveResponse && !_isReversal && (
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
            {_isReversal &&
              (reversePaymentSaveResponse ||
                (isReversalEditOrView && paymentFromState)) && (
                <Group gap="sm" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} c="dimmed">
                      Reverse Payment No:
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color="#105476"
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {(reversePaymentSaveResponse?.reverse_payment_no ??
                        reversePaymentSaveResponse?.payment_no ??
                        (paymentFromState as { reverse_payment_no?: string })
                          ?.reverse_payment_no ??
                        (paymentFromState as { payment_no?: string })
                          ?.payment_no ??
                        (reversePaymentSaveResponse?.id != null
                          ? String(reversePaymentSaveResponse.id)
                          : paymentFromState?.id != null
                            ? String(paymentFromState.id)
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
                        reversalStatusUpper === "UNPOSTED"
                          ? "gray"
                          : reversalStatusUpper === "POSTED"
                            ? "green"
                            : "#105476"
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
              onClick={() => handlePaymentBack()}
            >
              Back
            </Button>
          </Group>
        </Group>

        <Box
          component="form"
          onSubmit={
            isReadOnly && !isPostedChequeClearanceEdit
              ? (e) => e.preventDefault()
              : form.onSubmit(handleSubmit)
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
                disabled={
                  isHeaderDaybookEditable || useNonEditableStyleOnly
                    ? false
                    : isReadOnly
                }
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
                  form.clearFieldError("roe");
                  if (v) {
                    syncRoeForCurrencyChange(v, (roe) =>
                      form.setFieldValue("roe", roe),
                    );
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
                  onRoeValueChange(
                    form.values.currency,
                    typeof v === "string"
                      ? Number.isFinite(parseFloat(v))
                        ? parseFloat(v)
                        : null
                      : (v as number | null),
                    (roe) => form.setFieldValue("roe", roe),
                    form.setFieldError,
                    form.clearFieldError,
                    "roe",
                  )
                }
                min={0}
                decimalScale={ROE_DECIMAL_PLACES}
                max={ROE_MAX_VALUE}
                hideControls
                error={form.errors.roe}
                styles={headerFieldStyles}
                disabled={
                  useNonEditableStyleOnly
                    ? false
                    : headerOtherDisabled || isLocalCurrency(form.values.currency)
                }
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
                decimalScale={amountDecimalScale}
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
                decimalScale={amountDecimalScale}
                max={AMOUNT_MAX}
                hideControls
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
            </Grid.Col>

            {/* Cheque fields - shown for all types except CASH (also when editing posted clearance date) */}
            {(showChequeSection || isPostedChequeClearanceEdit) && (
              <>
                <Grid.Col span={2}>
                  <TextInput
                    label="Bank"
                    placeholder="Bank"
                    {...form.getInputProps("bank")}
                    styles={headerFieldStyles}
                    disabled={
                      useNonEditableStyleOnly ? false : headerOtherDisabled
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Branch"
                    placeholder="Branch"
                    {...form.getInputProps("branch")}
                    styles={headerFieldStyles}
                    disabled={
                      useNonEditableStyleOnly ? false : headerOtherDisabled
                    }
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <TextInput
                    label="Cheque No"
                    placeholder="Cheque No"
                    {...form.getInputProps("cheque_no")}
                    styles={headerFieldStyles}
                    disabled={
                      useNonEditableStyleOnly ? false : headerOtherDisabled
                    }
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
                <Grid.Col span={2}>
                  <SingleDateInput
                    label="Cheque Cleared Date"
                    placeholder="Select date"
                    value={normalizeDate(form.values.chq_clrd_date)}
                    onChange={(date) =>
                      form.setFieldValue("chq_clrd_date", date)
                    }
                    disabled={chequeClearanceDateDisabled}
                    styles={
                      chequeClearanceDateDisabled
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
                            apiEndpoint={URL.chartOfAccounts}
                            value={row?.customer_code || null}
                            displayValue={row?.customer_display || null}
                            disabled={
                              useNonEditableStyleOnly ? false : isReadOnly
                            }
                            onChange={(value, _selected, originalData) => {
                              setLoadedDetails(null);
                              const orig = originalData as {
                                id?: number;
                                gl_name?: string;
                                gl_account_code?: string;
                                sl_code?: string;
                                account_name?: string;
                              };
                              const glName = orig?.gl_name ?? "";
                              const name = orig?.account_name ?? "";
                              const subledgerCode = orig?.sl_code ?? "";
                              const glAccountCode = orig?.gl_account_code ?? "";
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
                                `details.${idx}.account_code`,
                                glAccountCode,
                              );
                              form.setFieldValue(
                                `details.${idx}.customer_code`,
                                subledgerCode || (value ?? ""),
                              );
                              form.setFieldValue(
                                `details.${idx}.customer_display`,
                                formatChartOfAccountsLabel(
                                  glName,
                                  glAccountCode,
                                  name,
                                ),
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
                                gl_name?: string;
                                gl_account_code?: string;
                                account_name?: string;
                              };
                              return {
                                value: String(i?.id ?? ""),
                                label: formatChartOfAccountsLabel(
                                  String(i?.gl_name ?? "").trim(),
                                  String(i?.gl_account_code ?? "").trim(),
                                  String(i?.account_name ?? "").trim(),
                                ),
                              };
                            }}
                            searchFields={[
                              "account_name",
                              "gl_name",
                              "gl_account_code",
                              "sl_code",
                            ]}
                            returnOriginalData
                            styles={partyFieldStyles}
                          />
                        </Grid.Col>
                        <Grid.Col span={2.5}>
                          <TextInput
                            placeholder="Narration"
                            {...form.getInputProps(`details.${idx}.narration`)}
                            disabled={
                              useNonEditableStyleOnly ? false : isReadOnly
                            }
                            styles={partyFieldStyles}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          {/* <TextInput
                            value={form.values.details[idx].currency}
                            readOnly
                            styles={partyFieldStyles}
                          /> */}
                                    <Dropdown
                // label="Currency"
                placeholder="Select currency"
                data={currencyOptions}
                // value={form.values.currency}
                value={form.values.details[idx].currency}
                onChange={(v) => {
                  form.setFieldValue(`details.${idx}.currency`, v ?? "");
                  form.clearFieldError(`details.${idx}.roe`);
                  if (v) {
                    syncRoeForCurrencyChange(v, (roe) =>
                      form.setFieldValue(`details.${idx}.roe`, roe),
                    );
                  }
                }}
                searchable
                withAsterisk
                error={form.errors.currency}
                styles={headerFieldStyles}
                disabled={useNonEditableStyleOnly ? false : headerOtherDisabled}
              />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <NumberInput
                            placeholder="ROE"
                            min={0}
                            hideControls
                            value={form.values.details[idx].roe ?? undefined}
                            onChange={(v) => {
                              const detailCurrency =
                                form.values.details[idx]?.currency ?? "";
                              const newRoe =
                                typeof v === "string"
                                  ? Number.isFinite(parseFloat(v))
                                    ? parseFloat(v)
                                    : null
                                  : (v as number | null);
                              onRoeValueChange(
                                detailCurrency,
                                newRoe,
                                (roe) =>
                                  form.setFieldValue(`details.${idx}.roe`, roe),
                                form.setFieldError,
                                form.clearFieldError,
                                `details.${idx}.roe`,
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
                            decimalScale={ROE_DECIMAL_PLACES}
                            max={ROE_MAX_VALUE}
                            error={form.errors[`details.${idx}.roe`]}
                            styles={partyFieldStyles}
                            disabled={
                              useNonEditableStyleOnly
                                ? false
                                : isReadOnly ||
                                  isLocalCurrency(
                                    form.values.details[idx]?.currency,
                                  )
                            }
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
                            decimalScale={amountDecimalScale}
                            max={AMOUNT_MAX}
                            styles={partyFieldStyles}
                            disabled={
                              useNonEditableStyleOnly ? false : isReadOnly
                            }
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
                            decimalScale={amountDecimalScale}
                            max={AMOUNT_MAX}
                            styles={partyFieldStyles}
                            disabled={
                              useNonEditableStyleOnly ? false : isReadOnly
                            }
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
                                (v as "Cr" | "Dr") ??
                                  (_isReversal ? "Cr" : "Dr"),
                              )
                            }
                            styles={partyFieldStyles}
                            disabled={
                              useNonEditableStyleOnly ? false : isReadOnly
                            }
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
                              disabled={isReadOnly || _isReversal}
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
                              title="Get document details"
                              disabled={
                                isReadOnly ||
                                _isReversal ||
                                (invoiceModalDetailRowIndex === idx &&
                                  (filterInvoiceLoading ||
                                    filterInvoiceFetching)) ||
                                !form.values.details[idx].account_code ||
                                !form.values.details[idx].customer_code
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
                            const adjustment = form.values.adjustments[idx];
                            const documentRoe = resolveAdjustmentDocumentRoe(
                              adjustment,
                              allocationRoeByDocumentRef.current,
                            );
                            if (
                              documentRoe != null &&
                              adjustment.roe !== documentRoe
                            ) {
                              form.setFieldValue(
                                `adjustments.${idx}.roe`,
                                documentRoe,
                              );
                            }
                            const newLocal = calcAdjLocalFromCurr(
                              newCurr,
                              documentRoe,
                            );
                            form.setFieldValue(
                              `adjustments.${idx}.adj_curr_amount`,
                              newCurr,
                            );
                            form.setFieldValue(
                              `adjustments.${idx}.adj_local_amount`,
                              newLocal,
                            );
                            const effectiveAdjustments =
                              form.values.adjustments.map((a, i) =>
                                i === idx
                                  ? {
                                      ...a,
                                      roe: documentRoe ?? a.roe,
                                      adj_curr_amount: newCurr,
                                      adj_local_amount: newLocal,
                                    }
                                  : a,
                              );
                            syncPartyDetailsFromAllocations(
                              effectiveAdjustments,
                            );
                          }}
                          decimalScale={amountDecimalScale}
                          max={AMOUNT_MAX}
                          styles={
                            isReadOnly || _isReversal
                              ? adjustmentFieldStyles
                              : fieldStyles
                          }
                          disabled={isReadOnly || _isReversal}
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
                          decimalScale={amountDecimalScale}
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
                            disabled={isReadOnly || _isReversal}
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
              setInvoiceModalAllocationFilter(null);
              setInvoiceList([]);
              setSelectedInvoiceIndices(new Set());
              setIsOpeningSupplierInvoiceFromModal(false);
            }}
            title="Select Document"
            size="lg"
            styles={{
              title: { fontWeight: 600, color: "#105476" },
              body: { position: "relative" },
            }}
          >
            {isOpeningSupplierInvoiceFromModal && (
              <Box
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(255,255,255,0.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                }}
              >
                <Group gap="sm">
                  <Loader size="sm" color="#105476" />
                  <Text size="sm" c="#105476" fw={600}>
                    Opening supplier invoice…
                  </Text>
                </Group>
              </Box>
            )}
            {filterInvoiceLoading || filterInvoiceFetching ? (
              <Text size="sm" c="dimmed">
                Loading documents...
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
                      <Table.Th>Document Number</Table.Th>
                      <Table.Th>Document Doc Type</Table.Th>
                      <Table.Th>Document Date</Table.Th>
                      <Table.Th>Document Amount</Table.Th>
                      <Table.Th>Outstanding Amount</Table.Th>
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
                        <Table.Td>
                          {String(
                            inv.day_book_document_type ??
                              inv.day_book_type ??
                              "",
                          )
                            .trim()
                            .toUpperCase() === "CRJ" ? (
                            <Text
                              component="span"
                              style={{
                                color: "#105476",
                                textDecoration: "underline",
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                void openSupplierInvoiceFromAllocationRow(inv)
                              }
                              title="Open supplier invoice"
                            >
                              {inv.document_no ?? "—"}
                            </Text>
                          ) : (
                            <Text component="span">
                              {inv.document_no ?? "—"}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {String(
                            inv.day_book_document_type ??
                              inv.day_book_type ??
                              "—",
                          )}
                        </Table.Td>
                        <Table.Td>
                          {formatDocumentDateDisplay(
                            inv.document_date as string,
                            dateFormat,
                          )}
                        </Table.Td>
                        <Table.Td>
                          {formatOutstandingDocumentAmountInLocal(
                            inv.document_amount,
                          )}
                        </Table.Td>
                        <Table.Td>
                          {formatOutstandingDocumentAmountInLocal(inv.amount)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {invoiceList.length === 0 &&
                  !filterInvoiceLoading &&
                  !filterInvoiceFetching && (
                    <Text size="sm" c="dimmed" mt="sm">
                      No documents found for this account.
                    </Text>
                  )}
                <Group justify="flex-end" mt="md">
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => {
                      setInvoiceModalOpen(false);
                      setInvoiceModalDetailRowIndex(null);
                      setInvoiceModalAllocationFilter(null);
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

          {/* Supporting Documents Modal */}
            <Modal
              opened={documentsModalOpened}
              onClose={closeDocumentsModal}
              title={
                canManageSupportingDocuments
                  ? "Attach Supporting Documents"
                  : "Supporting Documents"
              }
              size="xl"
              centered
              style={{ fontFamily: "Inter" }}
              styles={{ title: { fontWeight: 600, color: "#105476" } }}
            >
              <Stack gap="xs">
                {form.values.supporting_documents.map((doc, index) => {
                  const isExistingDoc = doc.document_id != null;
                  const canEditDocRow =
                    !isReadOnly ||
                    (canAttachDocumentsAfterPost && !isExistingDoc);

                  return (
                  <Grid key={index} columns={12} gutter="sm" align="flex-end">
                    <Grid.Col span={5.5}>
                      <TextInput
                        label="Document Name"
                        placeholder="Enter document name"
                        value={doc.name}
                        disabled={!canEditDocRow}
                        onChange={(e) => {
                          if (!canEditDocRow) return;
                          const updatedDocs = [
                            ...form.values.supporting_documents,
                          ];
                          updatedDocs[index] = {
                            ...updatedDocs[index],
                            name: e.target.value,
                          };
                          form.setFieldValue(
                            "supporting_documents",
                            updatedDocs,
                          );
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={5.5}>
                      <Box>
                        <Text size="sm" fw={500} mb={4}>
                          File
                        </Text>
                        <Dropzone
                          disabled={!canEditDocRow}
                          onDrop={(files: File[]) => {
                            if (!canEditDocRow) return;
                            if (files.length === 0) return;
                            const file = files[0];
                            if (fileErrors[index]) {
                              const newErrors = { ...fileErrors };
                              delete newErrors[index];
                              setFileErrors(newErrors);
                            }
                            if (file.size > MAX_FILE_SIZE) {
                              const newErrors = { ...fileErrors };
                              newErrors[index] =
                                `File size exceeds 5MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                              setFileErrors(newErrors);
                              ToastNotification({
                                type: "error",
                                message: `File "${file.name}" exceeds 5MB limit`,
                              });
                              return;
                            }
                            const updatedDocs = [
                              ...form.values.supporting_documents,
                            ];
                            updatedDocs[index] = {
                              ...updatedDocs[index],
                              file,
                              document_url: undefined,
                              document_id: undefined,
                            };
                            form.setFieldValue(
                              "supporting_documents",
                              updatedDocs,
                            );
                          }}
                          onReject={(files: any[]) => {
                            const rejection = files[0];
                            if (
                              rejection?.errors?.some(
                                (e: any) => e.code === "file-too-large",
                              )
                            ) {
                              const newErrors = { ...fileErrors };
                              newErrors[index] = "File size exceeds 5MB limit";
                              setFileErrors(newErrors);
                            }
                          }}
                          maxSize={MAX_FILE_SIZE}
                          accept={undefined}
                          multiple={false}
                          styles={{
                            root: {
                              border: "1px solid var(--mantine-color-gray-4)",
                              borderRadius: "var(--mantine-radius-sm)",
                              backgroundColor: "var(--mantine-color-white)",
                              minHeight: "36px",
                              padding: "0",
                            },
                            inner: {
                              padding: "0",
                              minHeight: "36px",
                            },
                          }}
                        >
                          <Group
                            justify="space-between"
                            gap="xs"
                            px="sm"
                            style={{
                              minHeight: "36px",
                              pointerEvents: "none",
                              cursor: canEditDocRow ? "pointer" : "default",
                            }}
                          >
                            <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                              {doc.file ? (
                                <>
                                  <IconUpload
                                    size={16}
                                    color="var(--mantine-color-dimmed)"
                                  />
                                  <Text
                                    size="sm"
                                    truncate
                                    style={{
                                      flex: 1,
                                      color: "var(--mantine-color-dark)",
                                    }}
                                  >
                                    {doc.file.name}
                                  </Text>
                                </>
                              ) : doc.document_url ? (
                                <>
                                  <IconDownload
                                    size={16}
                                    color="var(--mantine-color-blue-6)"
                                  />
                                  <Text
                                    size="sm"
                                    truncate
                                    style={{
                                      flex: 1,
                                      color: "var(--mantine-color-blue-6)",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      pointerEvents: "auto",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        doc.document_url &&
                                        doc.original_document_name
                                      ) {
                                        downloadFile(
                                          doc.document_url,
                                          doc.original_document_name,
                                        );
                                      }
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.opacity = "0.8";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.opacity = "1";
                                    }}
                                  >
                                    {doc.original_document_name ||
                                      "Download file"}
                                  </Text>
                                </>
                              ) : (
                                <>
                                  <IconUpload
                                    size={16}
                                    color="var(--mantine-color-dimmed)"
                                  />
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                    truncate
                                    style={{ flex: 1 }}
                                  >
                                    Drag and drop or click to select file
                                  </Text>
                                </>
                              )}
                            </Group>
                            {canEditDocRow && (doc.file || doc.document_url) && (
                              <Button
                                variant="subtle"
                                color="red"
                                size="xs"
                                p={4}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (fileErrors[index]) {
                                    const newErrors = { ...fileErrors };
                                    delete newErrors[index];
                                    setFileErrors(newErrors);
                                  }
                                  const updatedDocs = [
                                    ...form.values.supporting_documents,
                                  ];
                                  updatedDocs[index] = {
                                    ...updatedDocs[index],
                                    file: null,
                                    document_url: undefined,
                                    document_id: undefined,
                                  };
                                  form.setFieldValue(
                                    "supporting_documents",
                                    updatedDocs,
                                  );
                                }}
                                style={{ pointerEvents: "auto" }}
                              >
                                <IconX size={14} />
                              </Button>
                            )}
                          </Group>
                        </Dropzone>
                        {fileErrors[index] && (
                          <Text size="xs" c="red" mt={4}>
                            {fileErrors[index]}
                          </Text>
                        )}
                      </Box>
                    </Grid.Col>
                    {canEditDocRow && (
                    <Grid.Col span={1}>
                      <Button
                        variant="light"
                        color="red"
                        onClick={() => {
                          if (fileErrors[index]) {
                            const newErrors = { ...fileErrors };
                            delete newErrors[index];
                            setFileErrors(newErrors);
                          }
                          if (form.values.supporting_documents.length === 1) {
                            form.setFieldValue("supporting_documents", [
                              { name: "", file: null },
                            ]);
                          } else {
                            const updatedDocs =
                              form.values.supporting_documents.filter(
                                (_, i) => i !== index,
                              );
                            form.setFieldValue(
                              "supporting_documents",
                              updatedDocs,
                            );
                            const newErrors: { [key: number]: string } = {};
                            Object.keys(fileErrors).forEach((key) => {
                              const keyNum = parseInt(key);
                              if (keyNum < index) {
                                newErrors[keyNum] = fileErrors[keyNum];
                              } else if (keyNum > index) {
                                newErrors[keyNum - 1] = fileErrors[keyNum];
                              }
                            });
                            setFileErrors(newErrors);
                          }
                        }}
                      >
                        <IconTrash size={16} />
                      </Button>
                    </Grid.Col>
                    )}
                    {canManageSupportingDocuments && (
                    <Grid.Col span={1} offset={11}>
                      {index ===
                        form.values.supporting_documents.length - 1 && (
                        <Button
                          variant="light"
                          color="#105476"
                          onClick={() => {
                            form.setFieldValue("supporting_documents", [
                              ...form.values.supporting_documents,
                              { name: "", file: null },
                            ]);
                          }}
                        >
                          <IconPlus size={16} />
                        </Button>
                      )}
                    </Grid.Col>
                    )}
                  </Grid>
                );
                })}

                {canManageSupportingDocuments &&
                  form.values.supporting_documents.length === 0 && (
                  <Button
                    variant="light"
                    color="#105476"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => {
                      form.setFieldValue("supporting_documents", [
                        { name: "", file: null },
                      ]);
                    }}
                    fullWidth
                  >
                    Add Document
                  </Button>
                )}

                <Group justify="flex-end" mt="md">
                  <Button variant="outline" onClick={closeDocumentsModal}>
                    Close
                  </Button>
                </Group>
              </Stack>
            </Modal>

          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              size="sm"
              styles={{
                root: {
                  borderColor: "#105476",
                  color: "#666",
                  fontSize: "13px",
                  fontFamily: "Inter",
                },
              }}
              onClick={() => {
                if (
                  canManageSupportingDocuments &&
                  form.values.supporting_documents.length === 0
                ) {
                  form.setFieldValue("supporting_documents", [
                    { name: "", file: null },
                  ]);
                }
                const newErrors: { [key: number]: string } = {};
                form.values.supporting_documents.forEach((doc, idx) => {
                  if (doc.file && doc.file.size > MAX_FILE_SIZE) {
                    newErrors[idx] =
                      `File size exceeds 5MB limit. Current size: ${(doc.file.size / (1024 * 1024)).toFixed(2)}MB`;
                  }
                });
                setFileErrors(newErrors);
                openDocumentsModal();
              }}
              disabled={isSubmitting}
            >
              {canManageSupportingDocuments
                ? "Attach supporting document"
                : "View supporting document(s)"}
            </Button>
            <Button
              variant="outline"
              color="#105476"
              onClick={() => handlePaymentBack()}
            >
              Cancel
            </Button>
            {(!isReadOnly || isPostedChequeClearanceEdit) && (
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
                    ? reversePaymentSaveResponse?.id
                      ? "Update Payment Reversal"
                      : "Save Payment Reversal"
                    : isPostedChequeClearanceEdit
                      ? "Update Payment"
                      : saveResponse?.id
                        ? "Update Payment"
                        : "Save Payment"}
                </Button>
                {!isPostedChequeClearanceEdit &&
                  (_isReversal
                    ? reversePaymentSaveResponse &&
                      canPostDocuments &&
                      reversalStatusUpper === "UNPOSTED" && (
                        <Button
                          type="button"
                          color="black"
                          variant="filled"
                          loading={isPosting}
                          onClick={handlePostPayment}
                        >
                          Post Payment Reversal
                        </Button>
                      )
                    : saveResponse &&
                      canPostDocuments &&
                      statusUpper === "UNPOSTED" && (
                        <Button
                          type="button"
                          color="black"
                          variant="filled"
                          loading={isPosting}
                          onClick={handlePostPayment}
                        >
                          Post Payment
                        </Button>
                      ))}
              </>
            )}
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}
