import {
  Badge,
  Menu,
  ActionIcon,
  Box,
  Center,
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
  IconDotsVertical,
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

const RECEIPT_TYPE_OPTIONS = [
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

// Header daybook: create receipt flow only
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

// Header daybook: create receipt reverse flow only
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

// Adjustments section daybook: all flows (receipt and receipt reversal)
const fetchDaybookINV = async () => {
  try {
    const payload = { filters: { document_type: "" } };
    const response = await postAPICall(URL.daybook, payload, API_HEADER);
    return (response as { data?: unknown[] })?.data ?? [];
  } catch (error) {
    console.error("Error fetching daybook (INV):", error);
    return [];
  }
};

// Amount: max 15 digits including 2 decimal places (13 integer + 2 decimal)
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

/** Party row: customer_display = label in UI (subledger_name from list / customer_name from search); customer_code = subledger_code in payload */
type DetailRow = {
  id?: number | null;
  subledger_id?: string | null;
  /** GL account code (used for allocations lookup) */
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
  roe: number | null; // invoice ROE for recalculating adj_local_amount when user edits adj_curr_amount
  adj_curr_amount: number | null;
  adj_local_amount: number | null;
};

type InvoiceCombinedItem = {
  id?: number;
  /** Primary key of invoice when document type is INV */
  doc_id?: number;
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

const fetchOutstandingAllocations = async (payload: {
  account_code: string;
  subledger_code: string;
}): Promise<InvoiceCombinedItem[]> => {
  const response = await postAPICall(
    URL.outstandingAllocations,
    payload,
    API_HEADER,
  );
  const res = response as { data?: unknown } | InvoiceCombinedItem[];
  const raw = Array.isArray(res) ? res : res?.data;
  if (Array.isArray(raw)) return raw as InvoiceCombinedItem[];
  if (raw && typeof raw === "object") {
    const nested = (raw as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as InvoiceCombinedItem[];
  }
  return [];
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
  cheque_date?: string | null;
  chq_clrd_date?: string | null;
  dr_cr?: string;
  /** Each party: subledger_name = UI label (Account Name), subledger_code = value for payload */
  parties?: Array<{
    id?: number;
    subledger_id?: number;
    subledger_code?: string;
    subledger_name?: string;
    account_name?: string;
    account_code?: string;
    narration?: string;
    currency_code?: string;
    currency_id?: number;
    roe?: string | number;
    amount?: string | number;
    local_amount?: string | number;
    dr_cr?: string;
    is_tds_calcualted_record?: boolean;
    is_tds_calculated_record?: boolean;
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

type SupportingDocument = {
  name: string;
  file: File | null;
  document_url?: string;
  document_id?: number;
  original_document_name?: string;
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
  chq_clrd_date: Date | null;
  details: DetailRow[];
  adjustments: AdjustmentRow[];
  supporting_documents: SupportingDocument[];
};

const getDefaultDetailRow = (
  localCurrency: string,
  forReversal = false,
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
  dr_cr: forReversal ? "Dr" : "Cr",
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

/** YYYY-MM-DD for receipt and reverse-receipt API payloads (local calendar day) */
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

// Receipt reversal: non-editable via styling only (no disabled prop) so all fields look the same as adjustments readonly
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

// Display document_date from API (supports DD-MM-YYYY or ISO) in country format
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

/** First non-empty trimmed string — API often returns `receipt_no: ""` where `??` would not fall back. */
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

/** List API uses `is_tds_calcualted_record` (typo); accept both spellings. */
function isPartyTdsCalculatedRecord(p: {
  is_tds_calcualted_record?: unknown;
  is_tds_calculated_record?: unknown;
}): boolean {
  const raw = p.is_tds_calcualted_record ?? p.is_tds_calculated_record;
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function receiptPartyDrCrToSide(drCr: string | undefined | null): "Dr" | "Cr" {
  return String(drCr ?? "")
    .trim()
    .toLowerCase() === "dr"
    ? "Dr"
    : "Cr";
}

function flipDrCr(side: "Dr" | "Cr"): "Dr" | "Cr" {
  return side === "Dr" ? "Cr" : "Dr";
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
  const dateFormat = useDateFormat();
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(isVietnamBranch);
  const canPostDocuments = useCanPostDocuments();
  // const loadedFromStateIdRef = useRef<number | string | null>(null);
  /** When loading from list, hold details so Account Name displays for every row (state triggers re-render) */
  const [loadedDetails, setLoadedDetails] = useState<DetailRow[] | null>(null);
  const sourceReceiptIdForReversalRef = useRef<number | null>(null);
  const sourceReceiptNoForReversalRef = useRef<string>("");

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
  const [selectedInvoiceIndices, setSelectedInvoiceIndices] = useState<
    Set<number>
  >(new Set());
  const [isOpeningInvoiceFromModal, setIsOpeningInvoiceFromModal] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPdfBlob, setReceiptPdfBlob] = useState<string | null>(null);
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
  const [auditPatch, setAuditPatch] = useState<Record<string, unknown> | null>(
    null,
  );

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

  // Header daybook: RPT for create receipt, RPTREV for create receipt reverse
  const { data: daybookDataRPT = [] } = useQuery({
    queryKey: ["daybook", "RPT"],
    queryFn: fetchDaybookRPT,
    staleTime: Infinity,
  });
  const { data: daybookDataRPTREV = [] } = useQuery({
    queryKey: ["daybook", "RPTREV"],
    queryFn: fetchDaybookRPTREV,
    staleTime: Infinity,
  });

  // Adjustments section daybook: INV for all flows
  const { data: daybookDataForAdjustments = [] } = useQuery({
    queryKey: ["daybook", "INV"],
    queryFn: fetchDaybookINV,
    staleTime: Infinity,
  });

  const {
    data: filterInvoiceData,
    isLoading: filterInvoiceLoading,
    isFetching: filterInvoiceFetching,
    isError: filterInvoiceError,
  } = useQuery({
    queryKey: [
      "outstandingAllocationsForReceipt",
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
    const data = (_isReversal ? daybookDataRPTREV : daybookDataRPT) as {
      id?: number;
      name?: string;
    }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [_isReversal, daybookDataRPT, daybookDataRPTREV]);

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

  // Load from list: state is receipt row (Receipt Master) or reversal row (Receipt Reversal list for edit/view)
  const receiptFromState = location.state as ReceiptListItem | null | undefined;
  const loadedFromListState = receiptFromState?.id != null;
  const pathname = location.pathname;

  useEffect(() => {
    setAuditPatch(null);
  }, [location.key]);

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
    const chqClrdDateVal = parseDocumentDate(receiptFromState.chq_clrd_date);
    const chequeDateVal = parseDocumentDate(receiptFromState.cheque_date);
    const roeVal = parseNum(receiptFromState.roe);
    const amountVal = parseNum(receiptFromState.amount);
    const localAmountVal = parseNum(receiptFromState.local_amount);

    const parties = Array.isArray(receiptFromState.parties)
      ? receiptFromState.parties
      : [];
    // Party details: subledger_name = UI label (Account Name), subledger_code = value sent in payload. Set both for every row.
    // Reversal create (from receipt): normal party Dr; TDS row (is_tds_calcualted_record) flips receipt Dr/Cr. Edit/view: saved values.
    const details: DetailRow[] =
      parties.length > 0
        ? parties.map((p) => ({
            id: p.id ?? null,
            subledger_id:
              p.subledger_id != null ? String(p.subledger_id) : null,
            account_code: String(p.account_code ?? "").trim(),
            customer_code: String(p.subledger_code ?? "").trim(),
            customer_display: String(
              p.account_name ?? p.subledger_name ?? "",
            ).trim(),
            narration: String(p.narration ?? "").trim(),
            currency: (p.currency_code ?? localCurrency).toString().trim(),
            roe: parseNum(p.roe) ?? 1,
            amount: parseNum(p.amount),
            local_amount: parseNum(p.local_amount),
            dr_cr: _isReversal
              ? isReversalEditOrView
                ? receiptPartyDrCrToSide(p.dr_cr)
                : isPartyTdsCalculatedRecord(p)
                  ? flipDrCr(receiptPartyDrCrToSide(p.dr_cr))
                  : ("Dr" as const)
              : ((p.dr_cr === "Dr" ? "Dr" : "Cr") as "Cr" | "Dr"),
          }))
        : [getDefaultDetailRow(localCurrency, _isReversal)];

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
      cheque_date: chequeDateVal,
      chq_clrd_date: chqClrdDateVal,
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
        // Original receipt no for API `receipt_no` (same as list row); do not clear — used when save/post response omits it.
        sourceReceiptNoForReversalRef.current = (
          receiptFromState.receipt_no ?? ""
        ).toString();
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

    // Pass-through documents for view/edit only — reversal create starts with no attachments
    if (!isReversalCreate) {
      const rawDocs =
        (receiptFromState as any)?.documents ??
        (receiptFromState as any)?.supporting_documents ??
        [];
      if (Array.isArray(rawDocs) && rawDocs.length > 0) {
        form.setFieldValue(
          "supporting_documents",
          rawDocs.map((doc: any) => ({
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
    } else {
      form.setFieldValue("supporting_documents", []);
    }
  }, [
    receiptFromState?.id,
    localCurrency,
    _isReversal,
    isReversalEditOrView,
    isReversalCreate,
    location.key,
  ]);

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

  // When party details change: header amount = Σ(Cr) − Σ(Dr)
  // This is important because backend may append extra party rows (ex: TDS) on save.
  const partyLocalAmountsSnapshot = form.values.details
    .map((d) => `${d.dr_cr}|${d.local_amount ?? ""}`)
    .join(";");
  const partyAmountsSnapshot = form.values.details
    .map((d) => `${d.dr_cr}|${d.amount ?? ""}`)
    .join(";");
  const headerAmountRoeKey = `${form.values.amount ?? ""}|${form.values.roe ?? ""}`;
  const prevPartyLocalRef = useRef(partyLocalAmountsSnapshot);
  const prevPartyAmountsRef = useRef(partyAmountsSnapshot);
  const prevHeaderAmountRoeRef = useRef(headerAmountRoeKey);

  useEffect(() => {
    const partyLocalChanged =
      prevPartyLocalRef.current !== partyLocalAmountsSnapshot;
    const partyAmountsChanged =
      prevPartyAmountsRef.current !== partyAmountsSnapshot;
    const headerAmountRoeChanged =
      prevHeaderAmountRoeRef.current !== headerAmountRoeKey;

    const details = form.values.details ?? [];
    let amountForLocal = form.values.amount;

    if (partyAmountsChanged) {
      const netAmount = details.reduce((s, d) => {
        const sign = d.dr_cr === "Dr" ? -1 : 1;
        const amt =
          d.amount != null && Number.isFinite(d.amount) ? d.amount : 0;
        return s + sign * amt;
      }, 0);
      const headerAmount = clampAmount(netAmount);
      if (form.values.amount !== headerAmount) {
        form.setFieldValue("amount", headerAmount);
      }
      amountForLocal = headerAmount;
    }

    if (partyLocalChanged) {
      const netLocal = details.reduce((s, d) => {
        const sign = d.dr_cr === "Dr" ? -1 : 1;
        const local =
          d.local_amount != null && Number.isFinite(d.local_amount)
            ? d.local_amount
            : 0;
        return s + sign * local;
      }, 0);
      const headerLocal = clampAmount(netLocal);
      if (form.values.local_amount !== headerLocal) {
        form.setFieldValue("local_amount", headerLocal);
      }
    } else if (headerAmountRoeChanged || partyAmountsChanged) {
      const roeVal = form.values.roe;
      const local =
        amountForLocal != null &&
        Number.isFinite(amountForLocal) &&
        roeVal != null &&
        Number.isFinite(roeVal)
          ? clampAmount(amountForLocal * roeVal)
          : null;
      if (form.values.local_amount !== local) {
        form.setFieldValue("local_amount", local);
      }
    }

    prevPartyLocalRef.current = partyLocalAmountsSnapshot;
    prevPartyAmountsRef.current = partyAmountsSnapshot;
    prevHeaderAmountRoeRef.current = headerAmountRoeKey;
  }, [partyLocalAmountsSnapshot, partyAmountsSnapshot, headerAmountRoeKey]);

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

  // When Amount or ROE change: Local Amount = Amount * ROE (always use ROE when available)
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

  const openInvoiceFromAllocationRow = async (inv: InvoiceCombinedItem) => {
    const docType = String(
      inv.day_book_document_type ?? inv.day_book_type ?? "",
    )
      .trim()
      .toUpperCase();
    if (docType !== "INV") return;

    const docIdRaw = inv.doc_id;
    const docId = docIdRaw != null ? Number(docIdRaw) : NaN;
    if (!Number.isFinite(docId) || docId <= 0) {
      ToastNotification({
        type: "warning",
        message: "Invoice not found",
      });
      return;
    }

    // Open the tab immediately (popup blockers allow this on user gesture).
    // Never navigate away from the Receipt page.
    const newTab = window.open("about:blank", "_blank");
    if (!newTab) {
      ToastNotification({
        type: "warning",
        message:
          "Popup blocked. Please allow popups to open the invoice in a new tab.",
      });
      return;
    }

    try {
      setIsOpeningInvoiceFromModal(true);
      const res = await apiCallProtected.get(
        `${URL.invoice}${docId}/`,
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

      setIsOpeningInvoiceFromModal(false);
      const invoicePath = `/invoice/${mode}/${docId}`;
      const invoiceUrl = new window.URL(
        invoicePath,
        window.location.origin,
      ).toString();
      newTab.location.href = invoiceUrl;
      try {
        newTab.opener = null;
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      console.error("Failed to open invoice", e);
      ToastNotification({
        type: "error",
        message: "Unable to open invoice details.",
      });
      try {
        newTab.close();
      } catch {
        // ignore
      }
      setIsOpeningInvoiceFromModal(false);
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
          : inv.local_total != null
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
        type:
          (inv.day_book_document_type as string) ??
          (inv.day_book_type as string) ??
          "",
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
        invoice_id:
          inv.doc_id != null
            ? Number(inv.doc_id)
            : inv.id != null
              ? Number(inv.id)
              : null,
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
    setInvoiceModalAllocationFilter(null);
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
      note: values.note ?? "",
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      cheque_date: formatDateDDMMYYYY(values.cheque_date),
      chq_clrd_date: formatDateDDMMYYYY(values.chq_clrd_date),
      dr_cr: (receiptFromState?.dr_cr ?? "Dr").toString(),
      parties: (values.details ?? []).map((d) => ({
        ...(d.id != null && d.id > 0 ? { id: d.id } : {}),
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
        ...(a.id != null && a.id > 0 ? { id: a.id } : {}),
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

  /** Reverse-receipt payload: header dr_cr is always Cr (do not inherit source receipt). Party dr_cr from form, default Dr. YYYY-MM-DD dates. */
  const buildReversalPayload = (
    values: ReceiptFormValues,
    options?: {
      reversalId?: number;
      receiptNo?: string;
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
    const receiptNo = firstNonEmptyString(
      options?.receiptNo,
      sourceReceiptNoForReversalRef.current,
    );
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
      roe: parseRoeForPayload(values.roe) ?? 0,
      amount: values.amount ?? 0,
      local_amount: values.local_amount ?? 0,
      narration: values.narration ?? "",
      note: values.note ?? "",
      bank: values.bank ?? "",
      branch: values.branch ?? "",
      cheque_no: values.cheque_no ?? "",
      cheque_date: formatDateDDMMYYYY(values.cheque_date),
      chq_clrd_date: formatDateDDMMYYYY(values.chq_clrd_date),
      dr_cr: "Cr",
      // Party: label = customer_display; payload = subledger_code. dr_cr from UI (default Dr for reversal rows).
      parties: details.map((d) => ({
        account_code: d.account_code ?? "",
        subledger_code: d.customer_code ?? "",
        narration: d.narration ?? "",
        currency_id: currencyIdByCode[d.currency?.trim().toUpperCase()] ?? 0,
        roe: parseRoeForPayload(d.roe) ?? 0,
        amount: d.amount ?? 0,
        local_amount: d.local_amount ?? 0,
        dr_cr: (d.dr_cr === "Dr" || d.dr_cr === "Cr"
          ? d.dr_cr
          : "Dr"
        ).toString(),
      })),
      allocations: nonEmptyAdjustments.map((a) => ({
        location: a.location ?? "",
        subledger_code: a.subledger ?? "",
        day_book_id: Number(a.daybook_id) || 0,
        type: a.type ?? "",
        document_no: a.document_no ?? "",
        document_date: formatDateDDMMYYYY(a.doc_date),
        currency_id: currencyIdByCode[a.currency?.trim().toUpperCase()] ?? 0,
        ...(a.invoice_id != null && a.invoice_id > 0
          ? { invoice_id: a.invoice_id }
          : {}),
        adj_curr_amount: a.adj_curr_amount ?? 0,
        adj_local_amount: a.adj_local_amount ?? 0,
      })),
    };
    if (isUpdate && options?.reversalId != null) {
      base.id = options.reversalId;
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
   * Builds a multipart/form-data body for reverse-receipt API calls.
   * Fields:
   *   reverse_receipt       – JSON-stringified payload
   *   document_names[i]     – display name for document i
   *   document[i]           – File object for document i
   *   document_id[i]        – server-side ID of an existing document (when replacing)
   */
  const buildReversalFormData = (payload: object): FormData => {
    const fd = new FormData();
    fd.append("reverse_receipt", JSON.stringify(payload));
    let docIndex = 0;
    form.values.supporting_documents.forEach((doc) => {
      if (doc.file) {
        fd.append(`document_names[${docIndex}]`, (doc.name ?? "").toString());
        fd.append(`document[${docIndex}]`, doc.file);
        if (doc.document_id != null) {
          fd.append(`document_id[${docIndex}]`, String(doc.document_id));
        }
      } else if (doc.document_id != null) {
        // Existing document that is not being replaced: send its ID so backend retains it.
        fd.append(`document_id[${docIndex}]`, String(doc.document_id));
      }
      docIndex++;
    });
    return fd;
  };

  /**
   * Builds a multipart/form-data body for receipt API calls.
   * Fields:
   *   receipt           – JSON-stringified payload
   *   document_names[i] – display name for document i
   *   document[i]       – File object for document i
   *   document_id[i]    – server-side ID of an existing document (when replacing)
   */
  const buildReceiptFormData = (payload: object): FormData => {
    const fd = new FormData();
    fd.append("receipt", JSON.stringify(payload));
    let docIndex = 0;
    form.values.supporting_documents.forEach((doc) => {
      if (doc.file) {
        fd.append(`document_names[${docIndex}]`, (doc.name ?? "").toString());
        fd.append(`document[${docIndex}]`, doc.file);
        if (doc.document_id != null) {
          fd.append(`document_id[${docIndex}]`, String(doc.document_id));
        }
      } else if (doc.document_id != null) {
        // Existing document that is not being replaced: send its ID so backend retains it.
        fd.append(`document_id[${docIndex}]`, String(doc.document_id));
      }
      docIndex++;
    });
    return fd;
  };

  const handleSubmit = async (values: ReceiptFormValues) => {
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
            "receipt",
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
            `${URL.receipt}${id}/`,
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
          await queryClient.invalidateQueries({ queryKey: ["receipt"] });
          ToastNotification({
            type: "success",
            message: "Receipt updated successfully.",
          });
        } else {
          await apiCallProtected.patch(
            `${URL.receipt}${id}/`,
            {
              id,
              chq_clrd_date: formatDateDDMMYYYY(values.chq_clrd_date),
            },
            API_HEADER,
          );
          await queryClient.invalidateQueries({ queryKey: ["receipt"] });
          ToastNotification({
            type: "success",
            message: "Cheque Cleared Date updated successfully.",
          });
        }
      } catch (e: unknown) {
        console.error("Failed to update posted receipt", e);
        ToastNotification({
          type: "error",
          message: getServerErrorMessage(e, "Failed to update receipt."),
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

    if (hasAdjustments) {
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
      if (partyLocalTotal < adjLocalTotal) {
        ToastNotification({
          type: "error",
          message:
            "The total Local Amount of Receipt cannot be less than the total Local Amount of Invoice.",
        });
        return;
      }
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
          payload.is_agent = false;
          const fd = buildReversalFormData(payload);
          const raw = (await apiCallProtected.put(
            `${URL.reverseReceipt}${reverseReceiptSaveResponse.id}/`,
            fd,
            FORM_DATA_HEADERS,
          )) as any;
          const res = raw?.data?.data ?? raw?.data ?? raw;
          if (res?.id != null) {
            setReverseReceiptSaveResponse((prev) => ({
              id: prev!.id,
              receipt_no: firstNonEmptyString(
                sourceReceiptNoForReversalRef.current,
                res.receipt_no,
                prev?.receipt_no,
              ),
              reverse_receipt_no: firstNonEmptyString(
                res.reverse_receipt_no,
                prev?.reverse_receipt_no,
              ),
              status: res.status != null ? String(res.status) : "UNPOSTED",
            }));
            setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));
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
          payload.is_agent = false;
          const fd = buildReversalFormData(payload);
          const raw = (await apiCallProtected.post(
            URL.reverseReceipt,
            fd,
            FORM_DATA_HEADERS,
          )) as any;
          const data = raw?.data?.data ?? raw?.data ?? raw;
          if (data?.id != null) {
            setReverseReceiptSaveResponse({
              id: Number(data.id),
              receipt_no: firstNonEmptyString(
                sourceReceiptNoForReversalRef.current,
                data.receipt_no,
              ),
              reverse_receipt_no: firstNonEmptyString(data.reverse_receipt_no),
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
      payload.is_agent = false;
      if (isUpdate) {
        const fd = buildReceiptFormData(payload);
        const raw = (await apiCallProtected.put(
          `${URL.receipt}${saveResponse!.id}/`,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        const res = raw?.data?.data ?? raw?.data ?? raw;
        if (res?.id != null) {
          setSaveResponse({
            id: res.id ?? saveResponse.id,
            receipt_no: res.receipt_no ?? saveResponse.receipt_no ?? "",
            document_no: saveResponse.document_no ?? "",
            status: res.status != null ? String(res.status) : "UNPOSTED",
          });
          setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));
          // After update, reflect the exact API response (can include appended party rows like TDS)
          applyCreatedReceiptToUI(res);
          await queryClient.invalidateQueries({ queryKey: ["receipt"] });
          ToastNotification({
            type: "success",
            message: "Receipt updated successfully.",
          });
        }
      } else {
        const fd = buildReceiptFormData(payload);
        const raw = (await apiCallProtected.post(
          URL.receipt,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        const data = raw?.data?.data ?? raw?.data ?? raw;
        if (data?.id != null) {
          setSaveResponse({
            id: data.id,
            receipt_no: data.receipt_no ?? "",
            document_no: data.receipt_no ?? "",
            status: data.status != null ? String(data.status) : "UNPOSTED",
          });
          // After create, reflect the exact API response (can include extra party rows like TDS)
          applyCreatedReceiptToUI(data);
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
        message: getServerErrorMessage(err, "Failed to save receipt."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyCreatedReceiptToUI = (created: unknown) => {
    const data = created as {
      roe?: number | string | null;
      parties?: Array<{
        id?: number;
        subledger_id?: number;
        subledger_code?: string;
        subledger_name?: string;
        account_name?: string;
        account_code?: string;
        narration?: string;
        currency_code?: string;
        roe?: number | string | null;
        amount?: number | string | null;
        local_amount?: number | string | null;
        dr_cr?: "Cr" | "Dr" | string;
      }>;
    };

    if (!Array.isArray(data?.parties) || data.parties.length === 0) return;

    const parseNum = (v: unknown): number | null => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };

    const nextHeaderRoe = parseNum(data.roe);
    if (
      nextHeaderRoe != null &&
      Number.isFinite(nextHeaderRoe) &&
      form.values.roe !== nextHeaderRoe
    ) {
      form.setFieldValue("roe", nextHeaderRoe);
    }

    const details: DetailRow[] = data.parties.map((p) => ({
      id: p.id ?? null,
      subledger_id: p.subledger_id != null ? String(p.subledger_id) : null,
      account_code: String(p.account_code ?? "").trim(),
      customer_code: String(p.subledger_code ?? "").trim(),
      customer_display: String(p.account_name ?? p.subledger_name ?? "").trim(),
      narration: String(p.narration ?? "").trim(),
      currency: String(p.currency_code ?? localCurrency).trim(),
      roe: parseNum(p.roe) ?? 1,
      amount: parseNum(p.amount),
      local_amount: parseNum(p.local_amount),
      dr_cr: p.dr_cr === "Dr" ? "Dr" : "Cr",
    }));

    setLoadedDetails(details);
    form.setFieldValue("details", details);
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
      payload.is_agent = false;
      const fd = buildReversalFormData(payload);
      const raw = (await apiCallProtected.put(
        `${URL.reverseReceipt}${reverseReceiptSaveResponse.id}/`,
        fd,
        FORM_DATA_HEADERS,
      )) as any;
      const res = raw?.data?.data ?? raw?.data ?? raw;
      if (res?.id != null) {
        setReverseReceiptSaveResponse((prev) => ({
          ...prev!,
          receipt_no: firstNonEmptyString(
            sourceReceiptNoForReversalRef.current,
            res.receipt_no,
            prev?.receipt_no,
          ),
          reverse_receipt_no: firstNonEmptyString(
            res.reverse_receipt_no,
            prev?.reverse_receipt_no,
          ),
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
        message: getServerErrorMessage(err, "Failed to post reverse receipt."),
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
      payload.is_agent = false;
      const fd = buildReceiptFormData(payload);
      const raw = (await apiCallProtected.put(
        `${URL.receipt}${saveResponse!.id}/`,
        fd,
        FORM_DATA_HEADERS,
      )) as any;
      const res = raw?.data?.data ?? raw?.data ?? raw;
      if (res?.id != null) {
        setSaveResponse((prev) => ({
          ...prev,
          id: res.id ?? prev?.id,
          receipt_no: res.receipt_no ?? prev?.receipt_no ?? "",
          document_no: prev?.document_no ?? "",
          status: res.status != null ? String(res.status) : "POSTED",
        }));
        setAuditPatch((prev) => appendEditPageAuditPatch(prev, res));
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
        message: getServerErrorMessage(err, "Failed to post receipt."),
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleReceiptPreview = async () => {
    const receiptId = saveResponse?.id;
    if (!receiptId) {
      ToastNotification({
        type: "error",
        message: "Save the receipt first before previewing.",
      });
      return;
    }
    setReceiptPreviewOpen(true);
    setReceiptPdfBlob(null);
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${URL.base}${URL.receipt}${receiptId}/pdf/`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Empty PDF response");
      }
      setReceiptPdfBlob(window.URL.createObjectURL(blob));
    } catch (err) {
      console.error("Receipt PDF preview error:", err);
      ToastNotification({
        type: "error",
        message: "Failed to load receipt PDF preview.",
      });
      setReceiptPreviewOpen(false);
    }
  };

  const handleCloseReceiptPreview = () => {
    setReceiptPreviewOpen(false);
    if (receiptPdfBlob) {
      window.URL.revokeObjectURL(receiptPdfBlob);
    }
    setReceiptPdfBlob(null);
  };

  const handleDownloadReceiptPdf = () => {
    if (!receiptPdfBlob) return;
    const link = document.createElement("a");
    link.href = receiptPdfBlob;
    link.download = `Receipt-${saveResponse?.receipt_no || saveResponse?.document_no || saveResponse?.id || "draft"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusUpper = String(saveResponse?.status ?? "").toUpperCase();
  const reversalStatusUpper = String(
    reverseReceiptSaveResponse?.status ?? "",
  ).toUpperCase();
  const isViewRoute = pathname.includes("/view");
  // Posted edit: allow updating Cheque Cleared Date only (PATCH).
  const isPostedChequeClearanceEdit =
    !_isReversal &&
    !isViewRoute &&
    pathname.includes("/edit") &&
    statusUpper === "POSTED";
  // Read-only: view route, or receipt/reversal with status POSTED; same field styling as POSTED view
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
  // On reversal page, header daybook and date are editable; all other fields disabled.
  const reversalFormDisabled = _isReversal;
  const inputStyles =
    isReadOnly || reversalFormDisabled ? readOnlyFieldStyles : fieldStyles;
  const headerDateDisabled = isReadOnly;
  const chequeClearanceDateDisabled =
    headerDateDisabled && !isPostedChequeClearanceEdit;
  const headerOtherDisabled = isReadOnly || reversalFormDisabled;
  // Receipt & receipt reversal: same unified non-editable style (styling-only, no disabled prop) for all read-only fields
  const useNonEditableStyleOnly = isReadOnly || _isReversal;
  const headerFieldStyles = headerOtherDisabled
    ? useNonEditableStyleOnly
      ? reversalNonEditableStyles
      : readOnlyFieldStyles
    : fieldStyles;
  const partyFieldStyles =
    isReadOnly || reversalFormDisabled
      ? useNonEditableStyleOnly
        ? reversalNonEditableStyles
        : readOnlyFieldStyles
      : fieldStyles;
  // Adjustments section: same unified style as reversal for create receipt, view receipt, and reversal flows
  const adjustmentFieldStyles = reversalNonEditableStyles;
  // Header daybook: active/editable in reversal create and reversal edit only; read-only styling otherwise
  const isHeaderDaybookEditable = _isReversal && !isReadOnly;
  const headerDaybookStyles = isHeaderDaybookEditable
    ? fieldStyles
    : useNonEditableStyleOnly
      ? reversalNonEditableStyles
      : inputStyles;

  const showAuditInfo =
    pathname.includes("/edit") || pathname.includes("/view");
  const receiptAuditSource = mergeEditPageAuditSources(
    receiptFromState,
    _isReversal ? reverseReceiptSaveResponse : saveResponse,
    auditPatch,
  );

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

  const financeReturnTo =
    (location.state as { returnTo?: string } | null)?.returnTo?.trim() ?? "";
  const effectiveBackPath =
    _isReversal && pathname.includes("/reversal/create") && !financeReturnTo
      ? "/receipt"
      : financeReturnTo || backPath;
  const handleReceiptBack = () => {
    navigateFinanceReturn(navigate, location.state, effectiveBackPath);
  };

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
          <EditPageHeadingRow
            visible={showAuditInfo && Boolean(receiptAuditSource)}
            auditSource={receiptAuditSource}
            animateKey={(receiptAuditSource as { id?: number })?.id}
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
            {saveResponse?.id && !_isReversal && (
              <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
                <Menu.Target>
                  <ActionIcon variant="light" color="#105476" size="lg">
                    <IconDotsVertical size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconDownload size={16} />}
                    onClick={handleReceiptPreview}
                  >
                    Download Receipt
                  </Menu.Item>
                  {isViewRoute && (
                    <Menu.Item
                      leftSection={<IconFileInvoice size={16} />}
                      onClick={openDocumentsModal}
                    >
                      Document
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => handleReceiptBack()}
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
                data={RECEIPT_TYPE_OPTIONS}
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
              {/* <Box
                style={
                  headerDateDisabled ? reversalReadOnlyWrapperStyle : undefined
                }
              > */}
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
              {/* </Box> */}
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
                          <Box>
                            <SearchableSelect
                              key={partyKey}
                              placeholder="Account Name"
                              apiEndpoint={URL.chartOfAccounts}
                              value={row?.customer_code || null}
                              displayValue={row?.customer_display || null}
                              disabled={
                                useNonEditableStyleOnly
                                  ? false
                                  : isReadOnly || reversalFormDisabled
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
                                const name = orig?.account_name ?? "";
                                const subledgerCode = orig?.sl_code ?? "";
                                const glAccountCode =
                                  orig?.gl_account_code ?? "";
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
                                // UI label should show only account_name (not subledger_name)
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
                                  gl_name?: string;
                                  gl_account_code?: string;
                                  account_name?: string;
                                };
                                const id = String(i.id ?? "").trim();
                                const gl = String(
                                  i.gl_account_code ?? "",
                                ).trim();
                                const name = String(
                                  i.account_name ?? "",
                                ).trim();
                                const glName = String(i.gl_name ?? "").trim();
                                return {
                                  value: id,
                                  label: formatChartOfAccountsLabel(
                                    glName,
                                    gl,
                                    name,
                                  ),
                                };
                              }}
                              searchFields={[
                                "gl_name",
                                "gl_account_code",
                                "account_name",
                                "id",
                              ]}
                              returnOriginalData
                              styles={partyFieldStyles}
                            />

                            {(() => {
                              const accountCode = row?.account_code
                                ?.toString()
                                .trim();
                              const subledgerCode = row?.customer_code
                                ?.toString()
                                .trim();
                              if (!accountCode && !subledgerCode) return null;
                              return (
                                <Text size="xs" c="dimmed" mt={4}>
                                  {accountCode
                                    ? `Account Code: ${accountCode}`
                                    : ""}
                                  {accountCode && subledgerCode ? "  |  " : ""}
                                  {subledgerCode
                                    ? `Subledger Code: ${subledgerCode}`
                                    : ""}
                                </Text>
                              );
                            })()}
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={2.5}>
                          <TextInput
                            placeholder="Narration"
                            {...form.getInputProps(`details.${idx}.narration`)}
                            disabled={
                              useNonEditableStyleOnly
                                ? false
                                : isReadOnly || reversalFormDisabled
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
                                  reversalFormDisabled ||
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
                              useNonEditableStyleOnly
                                ? false
                                : isReadOnly || reversalFormDisabled
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
                              useNonEditableStyleOnly
                                ? false
                                : isReadOnly || reversalFormDisabled
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
                                  (_isReversal ? "Dr" : "Cr"),
                              )
                            }
                            styles={partyFieldStyles}
                            disabled={
                              useNonEditableStyleOnly
                                ? false
                                : isReadOnly || reversalFormDisabled
                            }
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
                                disabled={
                                  useNonEditableStyleOnly
                                    ? false
                                    : isReadOnly || reversalFormDisabled
                                }
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
                                title="Get document details"
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
                        {/* <Box style={reversalReadOnlyWrapperStyle}> */}
                        <SingleDateInput
                          placeholder="Document date"
                          value={normalizeDate(
                            form.values.adjustments[idx].doc_date,
                          )}
                          onChange={() => {}}
                          disabled
                          styles={adjustmentFieldStyles}
                        />
                        {/* </Box> */}
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
                          decimalScale={amountDecimalScale}
                          max={AMOUNT_MAX}
                          styles={
                            isReadOnly || reversalFormDisabled
                              ? adjustmentFieldStyles
                              : fieldStyles
                          }
                          disabled={
                            useNonEditableStyleOnly
                              ? false
                              : isReadOnly || reversalFormDisabled
                          }
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
                          {!_isReversal && (
                            <Button
                              type="button"
                              variant="subtle"
                              size="sm"
                              onClick={addAdjustmentRow}
                              title="Add row"
                              disabled={
                                useNonEditableStyleOnly
                                  ? false
                                  : isReadOnly || reversalFormDisabled
                              }
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
              setInvoiceModalAllocationFilter(null);
              setInvoiceList([]);
              setSelectedInvoiceIndices(new Set());
              setIsOpeningInvoiceFromModal(false);
            }}
            title="Select Document"
            size="lg"
            styles={{
              title: { fontWeight: 600, color: "#105476" },
              body: { position: "relative" },
            }}
          >
            {isOpeningInvoiceFromModal && (
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
                    Opening invoice…
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
                      <Table.Th>Document Type</Table.Th>
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
                            .toUpperCase() === "INV" ? (
                            <Text
                              component="span"
                              style={{
                                color: "#105476",
                                textDecoration: "underline",
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                void openInvoiceFromAllocationRow(inv)
                              }
                              title="Open invoice"
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
                      No posted documents found for this customer.
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
                        form.setFieldValue("supporting_documents", updatedDocs);
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
                          };
                          form.setFieldValue(
                            "supporting_documents",
                            updatedDocs,
                          );
                        }}
                        onReject={(fileRejections: any[]) => {
                          if (!canEditDocRow) return;
                          const rejection = fileRejections[0];
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
                            const newErrors: {
                              [key: number]: string;
                            } = {};
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

          {/* Action Buttons */}
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
              onClick={() => handleReceiptBack()}
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
                    ? reverseReceiptSaveResponse?.id
                      ? "Update Receipt Reversal"
                      : "Create Receipt Reversal"
                    : isPostedChequeClearanceEdit
                      ? "Update Receipt"
                      : saveResponse?.id
                        ? "Update Receipt"
                        : "Save Receipt"}
                </Button>
                {!isPostedChequeClearanceEdit &&
                  _isReversal &&
                  reverseReceiptSaveResponse &&
                  canPostDocuments &&
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
                {!isPostedChequeClearanceEdit &&
                  !_isReversal &&
                  saveResponse &&
                  canPostDocuments &&
                  statusUpper === "UNPOSTED" && (
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

      <Modal
        opened={receiptPreviewOpen}
        onClose={handleCloseReceiptPreview}
        title={`Receipt - ${saveResponse?.receipt_no || saveResponse?.document_no || saveResponse?.id || ""}`}
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
          {receiptPdfBlob ? (
            <>
              <iframe
                src={receiptPdfBlob}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="Receipt PDF Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleCloseReceiptPreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleDownloadReceiptPdf}
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
                <Text c="dimmed">Loading receipt PDF preview...</Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}
