import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Dropzone } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronRight,
  IconDotsVertical,
  IconDownload,
  IconFileText,
  IconSend,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
import { mergeEditPageAuditSources } from "../../../utils/editPageAuditInfo";
import { getServerErrorMessage } from "../../../utils/apiErrorMessage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  Dropdown,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
} from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import { useCanPostDocuments } from "../../../hooks/useCanPostDocuments";
import { useAccountsDocumentCurrencyRoe } from "../../../hooks/useAccountsDocumentCurrencyRoe";
import {
  formatRoeForAccountsPayload,
  parseRoeForPayload,
  ROE_DECIMAL_PLACES,
} from "../../../utils/exchangeRateRoe";
import {
  bindMoneyWholeNumberMode,
  clampCurrencyMoneyAmountBound,
  clampMoneyAmountBound,
  formatMoneyAmount,
  formatMoneyAmountBound,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
  roundLocalMoneyToDecimals,
} from "../../../utils/nonDecimalMoneyAmount";
import { navigateFinanceReturn } from "../invoices/financeDocumentNavigation";

// ─── API Fetchers ────────────────────────────────────────────────────────────

const fetchDaybookJV = async (): Promise<unknown[]> => {
  try {
    const response = await postAPICall(
      URL.daybook,
      { filters: { document_type: "GLJ" } },
      API_HEADER,
    );
    return (response as { data?: unknown[] })?.data ?? [];
  } catch {
    return [];
  }
};

const fetchCurrencyMaster = async () => {
  try {
    return await getAPICall(`${URL.currencyMaster}`, API_HEADER);
  } catch {
    return [];
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────

type JVChargeRow = {
  id?: number | null;
  segment: string;
  job_no: string;
  sub_job: string;
  shipment_id: string;
  cn_r: string;
  charge_id: number | null;
  charge_name: string;
  account_id: number | null;
  account_code: string;
  account_name: string;
  subledger_code: string;
  code: string;
  key: string;
  currency_id: string;
  currency_code: string;
  roe: number | null;
  amount: number | null;
  local_amount: number | null;
  dr_cr: string;
  narration: string;
};

type JVFormValues = {
  document_id: string;
  journal_no: string;
  day_book_id: string;
  note: string;
  narration: string;
  journal_date: Date | null;
  status: string;
  file_name: string;
  reversal_daybook_id: string;
  reversal_journal_no: string;
  charges: JVChargeRow[];
};

type SaveResponse = { id?: number; journal_no?: string; status?: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyRow = (): JVChargeRow => ({
  segment: "",
  job_no: "",
  sub_job: "",
  shipment_id: "",
  cn_r: "",
  charge_id: null,
  charge_name: "",
  account_id: null,
  account_code: "",
  account_name: "",
  subledger_code: "",
  code: "",
  key: "",
  currency_id: "",
  currency_code: "",
  roe: null,
  amount: null,
  local_amount: null,
  dr_cr: "Dr",
  narration: "",
});

function clampAmt(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const r = clampCurrencyMoneyAmountBound(v);
  if (r == null) return null;
  const MAX = 99999999.99;
  return Math.abs(r) > MAX ? (r > 0 ? MAX : -MAX) : r;
}

function clampLocalAmt(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const r = clampMoneyAmountBound(v);
  if (r == null) return null;
  const MAX = 99999999.99;
  return Math.abs(r) > MAX ? (r > 0 ? MAX : -MAX) : r;
}

function toLocalAmount(value: number | string | null | undefined): number | null {
  const rounded = roundLocalMoneyToDecimals(value);
  return rounded == null || !Number.isFinite(rounded) ? null : rounded;
}

const STATUS_OPTIONS = [
  { value: "UNPOSTED", label: "Unposted" },
  { value: "POSTED", label: "Posted" },
];

const DR_CR_OPTIONS = [
  { value: "Dr", label: "Dr" },
  { value: "Cr", label: "Cr" },
];

const CN_R_OPTIONS = [
  { value: "C", label: "C" },
  { value: "N", label: "N" },
  { value: "R", label: "R" },
];

const inputStyles = {
  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
};

const textareaStyles = {
  input: { fontSize: "13px", fontFamily: "Inter" },
  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
};

const cellStyle: React.CSSProperties = {
  padding: "3px 3px 3px 0",
  verticalAlign: "middle",
};
const inputCell = {
  input: { fontSize: "12px", fontFamily: "Inter", height: "34px" },
};

// ─── Component ───────────────────────────────────────────────────────────────

function JournalVoucherReversal() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { id: recordId } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const currencyAmountDecimalScale = getAmountDecimalScale(false);
  const localAmountDecimalScale = getAmountDecimalScale(isVietnamBranch);
  const canPostDocuments = useCanPostDocuments();

  const isViewMode = location.pathname.includes("/view/");
  const isReadOnly = isViewMode;

  const handleFinanceDocumentBack = () => {
    navigateFinanceReturn(navigate, location.state);
  };

  const {
    localCurrency: defaultCurrencyCode,
    defaultBranchCurrencyId: defaultCurrencyId,
    isLocalCurrency,
    syncRoeForCurrencyChange,
    onRoeValueChange,
    validateRoeField,
    validateRoeToast,
  } = useAccountsDocumentCurrencyRoe();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveResponse, setSaveResponse] = useState<SaveResponse | null>(null);
  const [jvAuditPatch, setJvAuditPatch] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const [fileErrors, setFileErrors] = useState<{ [key: number]: string }>({});
  const [
    documentsModalOpened,
    { open: openDocumentsModal, close: closeDocumentsModal },
  ] = useDisclosure(false);
  const [supportingDocuments, setSupportingDocuments] = useState<
    Array<{
      name: string;
      file: File | null;
      document_url?: string;
      document_id?: number;
      original_document_name?: string;
    }>
  >([]);

  const downloadFile = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isUpdate =
    (saveResponse?.id != null && saveResponse.id > 0) || Boolean(recordId);

  // ID of the source JV when opening as a JV Reversal (no recordId in URL)
  const reversalSourceId = (location.state as any)?.reversalOf?.id;
  const isReversalMode = Boolean(reversalSourceId) && !recordId;
  // We flip Dr/Cr only when prefilling from Journal Voucher endpoint (opened from JV Master)
  const shouldFlipDrCr = Boolean(reversalSourceId) && !recordId;
  // The ID to fetch for edit / view / reversal pre-fill
  const fetchId =
    recordId ??
    (reversalSourceId != null ? String(reversalSourceId) : undefined);

  useEffect(() => {
    setJvAuditPatch(null);
  }, [fetchId, location.key]);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: daybookData = [], isLoading: isDaybookLoading } = useQuery({
    queryKey: ["daybook-jv"],
    queryFn: fetchDaybookJV,
    staleTime: Infinity,
  });

  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
  });

  // ─── Fetch full JV record by ID (Edit / View / JV Reversal) ──────────────

  const { data: jvFetchRes, isLoading: isJVFetching } = useQuery({
    queryKey: [
      recordId ? "journalVoucherReversal-detail" : "journalVoucher-detail",
      fetchId,
      location.key,
    ],
    enabled: Boolean(fetchId),
    queryFn: () => {
      // If opened from JV Master (create reversal): recordId is undefined and we prefill from JV
      // If opened from JV Reversal Master (edit/view reversal): recordId exists and we fetch reversal
      const endpoint = recordId
        ? (URL as any).journalVoucherReversal
        : (URL as any).journalVoucher;
      return getAPICall(`${endpoint}${fetchId}/`, API_HEADER);
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const jvAuditSource = useMemo(() => {
    const fromFetch = (() => {
      if (!jvFetchRes) return null;
      const d =
        (jvFetchRes as { data?: { data?: unknown } })?.data?.data ??
        (jvFetchRes as { data?: unknown })?.data ??
        jvFetchRes;
      return d && typeof d === "object" && !Array.isArray(d)
        ? (d as Record<string, unknown>)
        : null;
    })();
    return mergeEditPageAuditSources(fromFetch, jvAuditPatch);
  }, [jvFetchRes, jvAuditPatch]);

  // ─── Derived options ─────────────────────────────────────────────────────

  const daybookOptions = useMemo(() => {
    const data = daybookData as { id?: number; name?: string }[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      value: String(item.id ?? ""),
      label: item.name ?? "",
    }));
  }, [daybookData]);

  const currencyOptions = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.id ?? ""),
      label: (item.currency_code ?? item.code ?? "").toString().trim(),
    }));
  }, [currencyData]);

  // ─── Form ─────────────────────────────────────────────────────────────────

  const form = useForm<JVFormValues>({
    initialValues: {
      document_id: "",
      journal_no: "",
      day_book_id: "",
      note: "",
      narration: "",
      journal_date: new Date(),
      status: "UNPOSTED",
      file_name: "",
      reversal_daybook_id: "",
      reversal_journal_no: "",
      charges: [emptyRow()],
    },
    validate: {
      day_book_id: (v) => (!v ? "Day book is required" : null),
      journal_date: (v) => (!v ? "Journal date is required" : null),
    },
  });

  // ─── Populate form from API response (Edit / View / JV Reversal) ─────────

  useEffect(() => {
    if (!jvFetchRes) return;

    const d =
      (jvFetchRes as any)?.data?.data ??
      (jvFetchRes as any)?.data ??
      jvFetchRes;
    if (!d || typeof d !== "object" || Array.isArray(d)) return;

    const parseDate = (v: string | null | undefined): Date | null => {
      if (!v) return null;
      const dt = new Date(v);
      return isNaN(dt.getTime()) ? null : dt;
    };

    if (!isReversalMode) {
      setSaveResponse({
        id: d.id,
        journal_no: d.document_no ?? "",
        status: d.status ?? "",
      });
    }

    const chargesFromApi =
      Array.isArray(d.charges) && d.charges.length > 0
        ? d.charges.map((c: any) => ({
            id: isReversalMode ? null : (c.id ?? null),
            segment: "",
            job_no: c.job_id ?? "",
            sub_job: "",
            shipment_id: c.shipment_id ?? "",
            cn_r: c.c_r_n ?? "",
            charge_id: c.charge_id != null ? Number(c.charge_id) : null,
            charge_name: "",
            account_id: c.account_id != null ? Number(c.account_id) : null,
            account_code: c.code ?? "",
            account_name: c.account_name ?? "",
            subledger_code: c.subledger ?? "",
            code: c.code ?? "",
            key: c.key ?? "",
            currency_id: c.currency_id != null ? String(c.currency_id) : "",
            currency_code: "",
            roe: parseRoeForPayload(c.roe),
            amount: c.amount != null ? Number(c.amount) : null,
            local_amount: toLocalAmount(c.local_amount),
            dr_cr: shouldFlipDrCr ? (c.dr_cr === "Dr" ? "Cr" : "Dr") : c.dr_cr,
            narration: c.narration ?? "",
          }))
        : [emptyRow()];

    form.setValues({
      document_id: isReversalMode ? "" : d.id ? String(d.id) : "",
      journal_no: isReversalMode ? "" : (d.document_no ?? ""),
      day_book_id: d.daybook_id != null ? String(d.daybook_id) : "",
      note: d.note ?? "",
      narration: d.narration ?? "",
      journal_date: isReversalMode
        ? new Date()
        : (parseDate(d.journal_date) ?? new Date()),
      status: isReversalMode ? "UNPOSTED" : (d.status ?? "UNPOSTED"),
      file_name: "",
      reversal_daybook_id: "",
      reversal_journal_no: "",
      charges: chargesFromApi,
    });

    // Populate supporting documents for edit/view (skip for reversal create — upload manually)
    if (
      !isReversalMode &&
      Array.isArray(d.documents) &&
      d.documents.length > 0
    ) {
      setSupportingDocuments(
        d.documents.map((doc: any) => ({
          name: doc.document_name ?? doc.name ?? "",
          file: null,
          document_url: doc.document_url ?? doc.url ?? "",
          document_id: doc.id ?? undefined,
          original_document_name:
            doc.original_document_name ?? doc.document_name ?? "",
        })),
      );
    } else if (isReversalMode) {
      setSupportingDocuments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jvFetchRes]);

  // ─── Totals ───────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const row of form.values.charges) {
      const amt = row.local_amount ?? 0;
      if (row.dr_cr === "Dr") debit += amt;
      else credit += amt;
    }
    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      difference: Math.round((debit - credit) * 100) / 100,
    };
  }, [form.values.charges]);

  // ─── Selected row account info ────────────────────────────────────────────

  const selectedRow = form.values.charges[selectedRowIndex];
  const selectedAccountName = selectedRow?.account_name || "";
  const selectedNarration = selectedRow?.narration || "";

  // ─── Submit ───────────────────────────────────────────────────────────────

  const buildPayload = (values: JVFormValues, overrideStatus?: string) => {
    const formatDate = (d: Date | null) => {
      if (!d) return null;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${year}-${month}-${day}`;
    };

    // Compute totals from charges (3 decimal precision)
    let debit = 0;
    let credit = 0;
    for (const row of values.charges) {
      const amt = row.local_amount ?? 0;
      if (row.dr_cr === "Dr") debit += amt;
      else credit += amt;
    }
    const debitTotal = Math.round(debit * 1000) / 1000;
    const creditTotal = Math.round(credit * 1000) / 1000;
    const difference = Math.round((debit - credit) * 1000) / 1000;

    // Top-level account_name: first charge that has one
    const firstAccountName =
      values.charges.find((c) => c.account_name)?.account_name ?? "";

    return {
      ...(isUpdate ? { id: saveResponse?.id ?? Number(recordId) } : {}),
      document_no: values.journal_no || values.document_id || "",
      account_name: firstAccountName,
      narration: values.narration ?? "",
      journal_date: formatDate(values.journal_date),
      note: values.note ?? "",
      status: overrideStatus ?? values.status ?? "UNPOSTED",
      debit_total: formatMoneyAmountBound(debitTotal),
      credit_total: formatMoneyAmountBound(creditTotal),
      difference: formatMoneyAmountBound(difference),
      daybook_id: values.day_book_id ? Number(values.day_book_id) : null,
      charges: values.charges.map((c) => ({
        ...(c.id != null ? { id: c.id } : {}),
        charge_id: c.charge_id ?? null,
        currency_id: c.currency_id ? Number(c.currency_id) : null,
        account_name: c.account_name ?? "",
        subledger: c.subledger_code ?? "",
        code: c.code ?? "",
        key: c.key ?? "",
        roe: formatRoeForAccountsPayload(c.roe),
        amount:
          c.amount != null
            ? formatMoneyAmount(Number(c.amount), false)
            : formatMoneyAmount(0, false),
        local_amount:
          c.local_amount != null
            ? formatMoneyAmountBound(Number(c.local_amount))
            : formatMoneyAmountBound(0),
        dr_cr: c.dr_cr ?? "Dr",
        narration: c.narration ?? "",
        c_r_n: c.cn_r ?? "",
        shipment_id: c.shipment_id ?? "",
        job_id: c.job_no ?? "",
      })),
    };
  };

  /** Build a multipart/form-data body from the JSON payload + supporting documents.
   *  Fields:
   *    reverse_voucher          – JSON-stringified payload
   *    document_names[i]        – display name for document i
   *    document[i]              – File object for document i
   */
  const buildFormData = (payload: object): FormData => {
    const fd = new FormData();
    fd.append("reverse_voucher", JSON.stringify(payload));
    let fileIndex = 0;
    supportingDocuments.forEach((doc) => {
      if (!doc.file) return;
      fd.append(`document_names[${fileIndex}]`, (doc.name ?? "").toString());
      fd.append(`document[${fileIndex}]`, doc.file);
      fileIndex++;
    });
    return fd;
  };

  const FORM_DATA_HEADERS = {
    ...API_HEADER,
    headers: {
      ...API_HEADER.headers,
      "Content-Type": "multipart/form-data",
    },
  };

  const handleSubmit = async (values: JVFormValues) => {
    for (let i = 0; i < (values.charges ?? []).length; i++) {
      const charge = values.charges[i];
      const chargeRoeToastError = validateRoeToast(
        charge.currency_code,
        charge.roe,
        charge.currency_id,
      );
      if (chargeRoeToastError) {
        form.setFieldError(
          `charges.${i}.roe`,
          validateRoeField(
            charge.currency_code,
            charge.roe,
            charge.currency_id,
          ) ?? chargeRoeToastError,
        );
        ToastNotification({ type: "error", message: chargeRoeToastError });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = buildPayload(values);
      const fd = buildFormData(payload);
      if (isUpdate) {
        const recordIdNum = saveResponse?.id ?? Number(recordId);
        const res = (await apiCallProtected.put(
          `${(URL as any).journalVoucherReversal}${recordIdNum}/`,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        if (res) {
          const d = res?.data?.data ?? res?.data ?? res;
          setSaveResponse((prev) => ({
            ...prev,
            id: d?.id ?? prev?.id,
            journal_no: d?.journal_no ?? prev?.journal_no,
            status: d?.status ?? prev?.status,
          }));
          if (d && typeof d === "object" && !Array.isArray(d)) {
            setJvAuditPatch(d as Record<string, unknown>);
          }
          void queryClient.invalidateQueries({
            queryKey: [
              "journalVoucherReversal-detail",
              String(recordIdNum),
            ],
          });
          ToastNotification({
            message: "Journal voucher updated successfully",
            type: "success",
          });
        }
      } else {
        const res = (await apiCallProtected.post(
          (URL as any).journalVoucherReversal,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        if (res) {
          const d = res?.data?.data ?? res?.data ?? res;
          if (d?.id) {
            setSaveResponse({
              id: d.id,
              journal_no: d.journal_no ?? "",
              status: d.status,
            });
            form.setFieldValue("document_id", String(d.id));
            form.setFieldValue("journal_no", d.journal_no ?? "");
          }
          ToastNotification({
            message: "Journal voucher saved successfully",
            type: "success",
          });
        }
      }
    } catch (err: unknown) {
      ToastNotification({
        message: getServerErrorMessage(err, "Failed to save journal voucher"),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePost = async () => {
    const errors = form.validate();
    if (errors.hasErrors) return;
    setIsSubmitting(true);
    try {
      const payload = buildPayload(form.values, "POSTED");
      const fd = buildFormData(payload);
      if (isUpdate) {
        const recordIdNum = saveResponse?.id ?? Number(recordId);
        const res = (await apiCallProtected.put(
          `${(URL as any).journalVoucherReversal}${recordIdNum}/`,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        if (res) {
          const d = res?.data?.data ?? res?.data ?? res;
          setSaveResponse((prev) => ({
            ...prev,
            id: d?.id ?? prev?.id,
            journal_no: d?.journal_no ?? prev?.journal_no,
            status: "POSTED",
          }));
          form.setFieldValue("status", "POSTED");
          ToastNotification({
            message: "Journal voucher posted successfully",
            type: "success",
          });
          navigate("/journal-voucher-reversal");
        }
      } else {
        const res = (await apiCallProtected.post(
          (URL as any).journalVoucherReversal,
          fd,
          FORM_DATA_HEADERS,
        )) as any;
        if (res) {
          const d = res?.data?.data ?? res?.data ?? res;
          if (d?.id) {
            setSaveResponse({
              id: d.id,
              journal_no: d.journal_no ?? "",
              status: "POSTED",
            });
            form.setFieldValue("document_id", String(d.id));
            form.setFieldValue("journal_no", d.journal_no ?? "");
            form.setFieldValue("status", "POSTED");
          }
          ToastNotification({
            message: "Journal voucher posted successfully",
            type: "success",
          });
          navigate("/journal-voucher-reversal");
        }
      }
    } catch (err: unknown) {
      ToastNotification({
        message: getServerErrorMessage(err, "Failed to post journal voucher"),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const tableHeaders = [
    { label: "SNo", width: "40px" },
    // { label: "Seg", width: "68px" },
    { label: "Job Id", width: "88px" },
    // { label: "Sub Job", width: "80px" },
    { label: "Shipment Id", width: "108px" },
    { label: "C/R/N", width: "62px" },
    { label: "Charge", width: "148px" },
    { label: "*Account Name", width: "168px" },
    { label: "Subledger", width: "102px" },
    { label: "Code", width: "76px" },
    { label: "Key", width: "76px" },
    { label: "*Curr", width: "88px" },
    { label: "*ROE", width: "76px" },
    { label: "*Amount", width: "108px" },
    { label: "*Local Amount", width: "116px" },
    { label: "Dr/Cr", width: "70px" },
    { label: "Narration", width: "148px" },
  ];

  return (
    <Box p="md" style={{ position: "relative" }}>
      {/* Loading overlay – saving */}
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
              Saving journal voucher...
            </Text>
          </Stack>
        </Box>
      )}

      {/* Loading overlay – fetching record */}
      {isJVFetching && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998,
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text size="sm" c="#105476" fw={500}>
              Loading journal voucher...
            </Text>
          </Stack>
        </Box>
      )}

      <Stack gap="md">
        {/* ── Page header ── */}
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <EditPageHeadingRow
            visible={Boolean(recordId) && Boolean(jvAuditSource)}
            auditSource={jvAuditSource}
            animateKey={(jvAuditSource as { id?: number })?.id ?? recordId}
          >
            <Text size="xl" fw={700} c="#105476" style={{ fontFamily: "Inter" }}>
              Journal Voucher Reversal
            </Text>
          </EditPageHeadingRow>
          <Group gap="md" wrap="nowrap">
            {saveResponse && (
              <Group gap="sm" wrap="nowrap">
                {(saveResponse.id || form.values.document_id) && (
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Text
                      size="sm"
                      fw={500}
                      c="dimmed"
                      style={{ fontFamily: "Inter" }}
                    >
                      Document ID
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color="#105476"
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {form.values.document_id || "—"}
                    </Badge>
                  </Group>
                )}
                {saveResponse.journal_no && (
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Text
                      size="sm"
                      fw={500}
                      c="dimmed"
                      style={{ fontFamily: "Inter" }}
                    >
                      Journal No
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color="#105476"
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {saveResponse.journal_no}
                    </Badge>
                  </Group>
                )}
                {saveResponse.status && (
                  <Group gap="xs" wrap="nowrap">
                    <Text
                      size="sm"
                      fw={500}
                      c="dimmed"
                      style={{ fontFamily: "Inter" }}
                    >
                      Status:
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color={
                        saveResponse.status === "POSTED" ? "green" : "orange"
                      }
                      styles={{ root: { textTransform: "none" } }}
                    >
                      {saveResponse.status}
                    </Badge>
                  </Group>
                )}
              </Group>
            )}
            <Menu shadow="md" width={180} position="bottom-end" withArrow>
              <Menu.Target>
                <ActionIcon
                  variant="default"
                  size="lg"
                  radius="sm"
                  aria-label="More options"
                  style={{ border: "1px solid #cce4f0" }}
                >
                  <IconDotsVertical size={16} color="#105476" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconFileText size={14} />}
                  disabled={!saveResponse?.id}
                  styles={{ item: { fontFamily: "Inter", fontSize: "13px" } }}
                >
                  Document
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => handleFinanceDocumentBack()}
              styles={{ root: { fontFamily: "Inter", fontSize: "13px" } }}
            >
              Back
            </Button>
          </Group>
        </Group>

        {/* ── Form ── */}
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
          {/* ── Header Panel ── */}
          <Box
            mb="lg"
            style={{
              borderRadius: 8,
              border: "1px solid #cce4f0",
              overflow: "hidden",
            }}
          >
            {/* Panel title bar */}
            <Box
              px="md"
              py="xs"
              style={{
                backgroundColor: "#105476",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                size="xs"
                fw={600}
                c="white"
                style={{
                  fontFamily: "Inter",
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                }}
              >
                Journal Voucher Reversal Details
              </Text>
              {/* <Group gap="xs">
                  <Button
                    size="xs"
                    variant="white"
                    color="#105476"
                    leftSection={<IconFileText size={13} />}
                    disabled={isReadOnly || !saveResponse?.id}
                    styles={{
                      root: {
                        fontFamily: "Inter",
                        fontSize: "12px",
                        height: "26px",
                        paddingLeft: 10,
                        paddingRight: 10,
                      },
                    }}
                  >
                    Document
                  </Button>
                  <Button
                    size="xs"
                    variant="filled"
                    color="green"
                    leftSection={<IconSend size={13} />}
                    disabled={isReadOnly || saveResponse?.status === "POSTED"}
                    loading={isSubmitting}
                    onClick={handlePost}
                    styles={{
                      root: {
                        fontFamily: "Inter",
                        fontSize: "12px",
                        height: "26px",
                        paddingLeft: 10,
                        paddingRight: 10,
                      },
                    }}
                  >
                    Post
                  </Button>
                </Group> */}
            </Box>

            <Box p="md" style={{ backgroundColor: "#f8fcff" }}>
              {/* ── Row 1: Daybook | Note | JV Reversal ── */}
              {/* <Grid columns={12} gutter="md"> */}
              {/* Daybook */}
              {/* <Grid.Col span={2}>
                    <Dropdown
                      label="Day Book"
                      placeholder={isDaybookLoading ? "Loading..." : "Select day book"}
                      data={daybookOptions}
                      value={form.values.day_book_id || null}
                      onChange={(v) => form.setFieldValue("day_book_id", v ?? "")}
                      searchable
                      withAsterisk
                      disabled={isDaybookLoading || isReadOnly}
                      error={form.errors.day_book_id}
                      styles={inputStyles}
                    />
                  </Grid.Col> */}

              {/* JV Reversal box */}
              {/* <Grid.Col span={3}>
                    <Box
                      p="sm"
                      style={{
                        border: "1px solid #cce4f0",
                        borderRadius: 6,
                        backgroundColor: "white",
                        height: "100%",
                        width: "100%",
                      }}
                    >
                      <Text
                        size="xs"
                        fw={700}
                        c="#105476"
                        mb="xs"
                        style={{
                          fontFamily: "Inter",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                          fontSize: "11px",
                          borderBottom: "1px solid #e3f2fc",
                          paddingBottom: 4,
                        }}
                      >
                        JV Reversal
                      </Text>
                      <Grid columns={12} gutter="xs" align= "flex-end">
                        <Grid.Col span={5}>
                          <Dropdown
                            label="Daybook"
                            placeholder="Select"
                            data={daybookOptions}
                            value={form.values.reversal_daybook_id || null}
                            onChange={(v) => form.setFieldValue("reversal_daybook_id", v ?? "")}
                            searchable
                            disabled={isReadOnly}
                            styles={{
                              input: { fontSize: "12px", fontFamily: "Inter", height: "32px" },
                              label: { fontSize: "12px", fontFamily: "Inter", marginBottom: "3px" },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={5}>
                          <TextInput
                            label="Journal No"
                            placeholder="Enter"
                            value={form.values.reversal_journal_no}
                            onChange={(e) =>
                              form.setFieldValue("reversal_journal_no", e.target.value)
                            }
                            readOnly={isReadOnly}
                            styles={{
                              input: { fontSize: "12px", fontFamily: "Inter", height: "32px" },
                              label: { fontSize: "12px", fontFamily: "Inter", marginBottom: "3px" },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={1} style={{ marginBottom: "5px" }} >
                          <Button
                            size="xs"
                            variant="outline"
                            color="#105476"
                            disabled={isReadOnly || !form.values.reversal_journal_no}
                            styles={{
                              root: { fontFamily: "Inter", fontSize: "12px", height: "28px" , },
                            }}
                          >
                            Get
                          </Button>
                        </Grid.Col>
                      </Grid>
                    </Box>
                  </Grid.Col> */}
              {/* </Grid> */}

              {/* ── Row 2: Journal Date | Status | File Name | Upload | Download ── */}
              <Grid columns={12}>
                {/* Daybook */}
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
                    disabled={isDaybookLoading || isReadOnly}
                    error={form.errors.day_book_id}
                    styles={inputStyles}
                  />
                </Grid.Col>
                {/* Journal Date */}
                <Grid.Col span={2}>
                  <SingleDateInput
                    label="Journal Date"
                    placeholder="Select date"
                    value={form.values.journal_date}
                    onChange={(d) => form.setFieldValue("journal_date", d)}
                    withAsterisk
                    readOnly={isReadOnly}
                    error={
                      form.errors.journal_date
                        ? String(form.errors.journal_date)
                        : undefined
                    }
                  />
                </Grid.Col>

                {/* Status */}
                <Grid.Col span={2}>
                  <Dropdown
                    label="Status"
                    placeholder="Select status"
                    data={STATUS_OPTIONS}
                    value={form.values.status || null}
                    onChange={(v) =>
                      form.setFieldValue("status", v ?? "UNPOSTED")
                    }
                    disabled={isReadOnly}
                    styles={inputStyles}
                  />
                </Grid.Col>

                {/* Note */}
                <Grid.Col span={3}>
                  <Textarea
                    label="Note"
                    placeholder="Enter note"
                    value={form.values.note}
                    onChange={(e) => form.setFieldValue("note", e.target.value)}
                    readOnly={isReadOnly}
                    rows={2}
                    styles={textareaStyles}
                  />
                </Grid.Col>

                {/* Narration */}
                <Grid.Col span={3}>
                  <Textarea
                    label="Narration"
                    placeholder="Enter narration"
                    value={form.values.narration}
                    onChange={(e) =>
                      form.setFieldValue("narration", e.target.value)
                    }
                    readOnly={isReadOnly}
                    rows={2}
                    styles={textareaStyles}
                  />
                </Grid.Col>

                {/* File Name */}
                {/* <Grid.Col span={3}>
                    <TextInput
                      label="File Name"
                      placeholder="Select file"
                      value={form.values.file_name}
                      onChange={(e) => form.setFieldValue("file_name", e.target.value)}
                      readOnly={isReadOnly}
                      styles={inputStyles}
                    />
                  </Grid.Col> */}

                {/* Upload / Download */}
                {/* <Grid.Col span={2}>
                    <Box style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: 8 }}>
                      <Button
                        size="sm"
                        variant="outline"
                        color="#105476"
                        leftSection={<IconFileUpload size={14} />}
                        disabled={isReadOnly}
                        styles={{ root: { fontFamily: "Inter", fontSize: "13px", flex: 1 } }}
                      >
                        Upload
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        color="#105476"
                        leftSection={<IconDownload size={14} />}
                        disabled={!form.values.file_name}
                        styles={{ root: { fontFamily: "Inter", fontSize: "13px", flex: 1 } }}
                      >
                        Download
                      </Button>
                    </Box>
                  </Grid.Col> */}
              </Grid>
            </Box>
          </Box>

          {/* ── Cost Center / Charges Section ── */}
          <Box
            style={{
              borderRadius: 8,
              border: "1px solid #cce4f0",
              overflow: "hidden",
            }}
          >
            {/* Section title */}
            {/* <Box
                px="md"
                py="xs"
                style={{
                  backgroundColor: "#105476",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  size="xs"
                  fw={600}
                  c="white"
                  style={{ fontFamily: "Inter", letterSpacing: "0.8px", textTransform: "uppercase" }}
                >
                  Cost Center
                </Text>
                {!isReadOnly && (
                  <ActionIcon
                    variant="white"
                    color="#105476"
                    size="sm"
                    radius="sm"
                    onClick={() =>
                      form.insertListItem("charges", {
                        ...emptyRow(),
                        currency_id: defaultCurrencyId,
                        currency_code: defaultCurrencyCode,
                        roe: defaultCurrencyCode ? 1 : null,
                      })
                    }
                    title="Add row"
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                )}
              </Box> */}

            <Box p="md" style={{ overflowX: "auto", overflowY: "visible" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: "0 3px",
                  tableLayout: "fixed",
                  minWidth: 1580,
                }}
              >
                <colgroup>
                  {tableHeaders.map((h) => (
                    <col key={h.label} style={{ width: h.width }} />
                  ))}
                  {!isReadOnly && <col style={{ width: "52px" }} />}
                </colgroup>

                {/* ── Header ── */}
                <thead>
                  <tr>
                    {tableHeaders.map((h) => (
                      <th
                        key={h.label}
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          padding: "8px 4px 8px 0",
                          textAlign: "left",
                          fontSize: "12px",
                          fontFamily: "Inter",
                          fontWeight: 700,
                          color: "#105476",
                          whiteSpace: "nowrap",
                          borderBottom: "2px solid #e3f2fc",
                          backgroundColor: "white",
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                    {!isReadOnly && (
                      <th
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          padding: "8px 4px 8px 0",
                          textAlign: "left",
                          fontSize: "12px",
                          fontFamily: "Inter",
                          fontWeight: 700,
                          color: "#105476",
                          borderBottom: "2px solid #e3f2fc",
                          backgroundColor: "white",
                        }}
                      >
                        Act
                      </th>
                    )}
                  </tr>
                </thead>

                {/* ── Body ── */}
                <tbody>
                  {form.values.charges.map((row, index) => {
                    const isSelected = selectedRowIndex === index;
                    return (
                      <tr
                        key={index}
                        onClick={() => setSelectedRowIndex(index)}
                        style={{
                          backgroundColor: isSelected
                            ? "#eef6fb"
                            : "transparent",
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                      >
                        {/* SNo */}
                        <td style={cellStyle}>
                          <TextInput
                            value={String(index + 1)}
                            readOnly
                            styles={{
                              input: {
                                ...inputCell.input,
                                backgroundColor: "var(--mantine-color-gray-0)",
                                textAlign: "center",
                                paddingLeft: 2,
                                paddingRight: 2,
                              },
                            }}
                          />
                        </td>

                        {/* Segment */}
                        {/* <td style={cellStyle}>
                            <TextInput
                              placeholder="Seg"
                              value={row.segment}
                              onChange={(e) =>
                                form.setFieldValue(`charges.${index}.segment`, e.target.value)
                              }
                              readOnly={isReadOnly}
                              styles={inputCell}
                            />
                          </td> */}

                        {/* Job */}
                        <td style={cellStyle}>
                          <TextInput
                            placeholder="Job"
                            value={row.job_no}
                            onChange={(e) =>
                              form.setFieldValue(
                                `charges.${index}.job_no`,
                                e.target.value,
                              )
                            }
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* Sub Job */}
                        {/* <td style={cellStyle}>
                            <TextInput
                              placeholder="Sub Job"
                              value={row.sub_job}
                              onChange={(e) =>
                                form.setFieldValue(`charges.${index}.sub_job`, e.target.value)
                              }
                              readOnly={isReadOnly}
                              styles={inputCell}
                            />
                          </td> */}

                        {/* Booking No */}
                        <td style={cellStyle}>
                          <TextInput
                            placeholder="Booking No."
                            value={row.shipment_id}
                            onChange={(e) =>
                              form.setFieldValue(
                                `charges.${index}.shipment_id`,
                                e.target.value,
                              )
                            }
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* C/R/N */}
                        <td style={cellStyle}>
                          <Dropdown
                            placeholder="C/R/N"
                            data={CN_R_OPTIONS}
                            value={row.cn_r || null}
                            onChange={(v) =>
                              form.setFieldValue(
                                `charges.${index}.cn_r`,
                                v ?? "",
                              )
                            }
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* Charge */}
                        <td style={cellStyle}>
                          <SearchableSelect
                            placeholder="Charge name"
                            apiEndpoint={(URL as any).chargeMaster}
                            searchFields={["charge_name", "charge_code"]}
                            displayFormat={(item: Record<string, unknown>) => ({
                              value: String(item.id ?? ""),
                              label: String(item.charge_name ?? ""),
                            })}
                            value={
                              row.charge_id != null
                                ? String(row.charge_id)
                                : null
                            }
                            displayValue={row.charge_name || undefined}
                            onChange={(value, selectedData) => {
                              form.setFieldValue(
                                `charges.${index}.charge_id`,
                                value ? Number(value) : null,
                              );
                              form.setFieldValue(
                                `charges.${index}.charge_name`,
                                selectedData?.label ?? "",
                              );
                            }}
                            readOnly={isReadOnly}
                            minSearchLength={2}
                            dropdownZIndex={1000}
                            styles={inputCell}
                          />
                        </td>

                        {/* Account Code */}
                        <td style={cellStyle}>
                          <SearchableSelect
                            placeholder="Search by account name"
                            apiEndpoint={URL.chartOfAccounts}
                            value={
                              row.account_id != null
                                ? String(row.account_id)
                                : null
                            }
                            dropdownZIndex={1100}
                            minSearchLength={1}
                            searchFields={[
                              "gl_name",
                              "gl_account_code",
                              "account_name",
                              "id",
                            ]}
                            displayFormat={(item: Record<string, unknown>) => {
                              const id = String(item.id ?? "").trim();
                              const glName = String(item.gl_name ?? "").trim();
                              const gl = String(
                                item.gl_account_code ?? "",
                              ).trim();
                              const name = String(
                                item.account_name ?? "",
                              ).trim();
                              return {
                                value: id,
                                label: [name, gl, glName]
                                  .filter(Boolean)
                                  .join(" - "),
                              };
                            }}
                            displayValue={
                              row.account_name
                                ? `${row.account_name}${
                                    row.account_code
                                      ? ` - ${row.account_code}`
                                      : ""
                                  }`
                                : row.account_code || undefined
                            }
                            returnOriginalData
                            onChange={(value, _selectedData, originalData) => {
                              if (!value || !originalData) {
                                form.setFieldValue(
                                  `charges.${index}.account_id`,
                                  null,
                                );
                                form.setFieldValue(
                                  `charges.${index}.account_code`,
                                  "",
                                );
                                form.setFieldValue(
                                  `charges.${index}.subledger_code`,
                                  "",
                                );
                                form.setFieldValue(
                                  `charges.${index}.account_name`,
                                  "",
                                );
                                return;
                              }

                              form.setFieldValue(
                                `charges.${index}.account_id`,
                                Number.isFinite(Number(value))
                                  ? Number(value)
                                  : null,
                              );
                              form.setFieldValue(
                                `charges.${index}.account_code`,
                                originalData.gl_account_code !== undefined &&
                                  originalData.gl_account_code !== null
                                  ? String(originalData.gl_account_code)
                                  : "",
                              );
                              form.setFieldValue(
                                `charges.${index}.subledger_code`,
                                originalData.sl_code !== undefined &&
                                  originalData.sl_code !== null
                                  ? String(originalData.sl_code)
                                  : "",
                              );
                              form.setFieldValue(
                                `charges.${index}.account_name`,
                                [
                                  String(
                                    (originalData as any).gl_account_code ?? "",
                                  ).trim(),
                                  String(
                                    (originalData as any).account_name ?? "",
                                  ).trim(),
                                  String(
                                    (originalData as any).gl_name ?? "",
                                  ).trim(),
                                ]
                                  .filter(Boolean)
                                  .join(" - "),
                              );
                            }}
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* Subledger */}
                        <td style={cellStyle}>
                          <TextInput
                            placeholder="Subledger"
                            value={row.subledger_code}
                            readOnly
                            styles={{
                              input: {
                                ...inputCell.input,
                                backgroundColor: "var(--mantine-color-gray-0)",
                              },
                            }}
                          />
                        </td>

                        {/* Code */}
                        <td style={cellStyle}>
                          <TextInput
                            placeholder="Code"
                            value={row.code}
                            onChange={(e) =>
                              form.setFieldValue(
                                `charges.${index}.code`,
                                e.target.value,
                              )
                            }
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* Key */}
                        <td style={cellStyle}>
                          <TextInput
                            placeholder="Key"
                            value={row.key}
                            onChange={(e) =>
                              form.setFieldValue(
                                `charges.${index}.key`,
                                e.target.value,
                              )
                            }
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* Currency */}
                        <td style={cellStyle}>
                          <Dropdown
                            placeholder="Curr"
                            searchable
                            data={currencyOptions}
                            value={row.currency_id || null}
                            readOnly={isReadOnly}
                            onChange={(v) => {
                              const val = v ?? "";
                              form.setFieldValue(
                                `charges.${index}.currency_id`,
                                val,
                              );
                              const opt = currencyOptions.find(
                                (o) => o.value === val,
                              );
                              const code = opt?.label ?? val;
                              form.setFieldValue(
                                `charges.${index}.currency_code`,
                                code,
                              );
                              form.clearFieldError(`charges.${index}.roe`);
                              syncRoeForCurrencyChange(
                                code,
                                (roe) => {
                                  form.setFieldValue(`charges.${index}.roe`, roe);
                                  const amt = form.values.charges[index].amount;
                                  if (
                                    amt != null &&
                                    amt > 0 &&
                                    roe != null
                                  ) {
                                    form.setFieldValue(
                                      `charges.${index}.local_amount`,
                                      clampLocalAmt(amt * roe),
                                    );
                                  }
                                },
                                val ?? "",
                              );
                            }}
                            styles={inputCell}
                          />
                        </td>

                        {/* ROE */}
                        <td style={cellStyle}>
                          <NumberInput
                            placeholder="ROE"
                            min={0}
                            hideControls
                            decimalScale={ROE_DECIMAL_PLACES}
                            readOnly={
                              isReadOnly ||
                              isLocalCurrency(
                                row.currency_code,
                                row.currency_id,
                              )
                            }
                            value={row.roe ?? undefined}
                            onChange={(v) => {
                              const roe = v as number | null;
                              onRoeValueChange(
                                row.currency_code,
                                roe,
                                (nextRoe) =>
                                  form.setFieldValue(`charges.${index}.roe`, nextRoe),
                                form.setFieldError,
                                form.clearFieldError,
                                `charges.${index}.roe`,
                                row.currency_id,
                              );
                              const amt = form.values.charges[index].amount;
                              if (
                                amt != null &&
                                amt > 0 &&
                                roe != null &&
                                roe > 0
                              ) {
                                form.setFieldValue(
                                  `charges.${index}.local_amount`,
                                  clampLocalAmt(amt * roe),
                                );
                              }
                            }}
                            error={form.errors[`charges.${index}.roe`]}
                            styles={inputCell}
                          />
                        </td>

                        {/* Amount */}
                        <td style={cellStyle}>
                          <NumberInput
                            placeholder="Amount"
                            min={0}
                            hideControls
                            decimalScale={currencyAmountDecimalScale}
                            readOnly={isReadOnly}
                            value={row.amount ?? undefined}
                            onChange={(v) => {
                              const amt = clampAmt(v as number | null);
                              form.setFieldValue(
                                `charges.${index}.amount`,
                                amt,
                              );
                              const roe = form.values.charges[index].roe;
                              if (amt != null && roe != null && roe > 0) {
                                form.setFieldValue(
                                  `charges.${index}.local_amount`,
                                  clampLocalAmt(amt * roe),
                                );
                              }
                            }}
                            styles={inputCell}
                          />
                        </td>

                        {/* Local Amount */}
                        <td style={cellStyle}>
                          <NumberInput
                            placeholder="Local Amt"
                            hideControls
                            decimalScale={localAmountDecimalScale}
                            readOnly
                            value={row.local_amount ?? undefined}
                            styles={{
                              input: {
                                ...inputCell.input,
                                backgroundColor: "var(--mantine-color-gray-0)",
                              },
                            }}
                          />
                        </td>

                        {/* Dr/Cr */}
                        <td style={cellStyle}>
                          <Dropdown
                            placeholder="Dr/Cr"
                            data={DR_CR_OPTIONS}
                            value={row.dr_cr || "Dr"}
                            onChange={(v) =>
                              form.setFieldValue(
                                `charges.${index}.dr_cr`,
                                v ?? "Dr",
                              )
                            }
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* Narration */}
                        <td style={cellStyle}>
                          <TextInput
                            placeholder="Narration"
                            value={row.narration}
                            onChange={(e) =>
                              form.setFieldValue(
                                `charges.${index}.narration`,
                                e.target.value,
                              )
                            }
                            readOnly={isReadOnly}
                            styles={inputCell}
                          />
                        </td>

                        {/* Actions */}
                        {!isReadOnly && (
                          <td style={{ ...cellStyle, paddingLeft: 4 }}>
                            <Group gap={2} wrap="nowrap">
                              {form.values.charges.length > 1 && (
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    form.removeListItem("charges", index);
                                    if (
                                      selectedRowIndex >=
                                      form.values.charges.length - 1
                                    ) {
                                      setSelectedRowIndex(
                                        Math.max(
                                          0,
                                          form.values.charges.length - 2,
                                        ),
                                      );
                                    }
                                  }}
                                >
                                  <IconTrash size={12} />
                                </ActionIcon>
                              )}
                              {form.values.charges.length - 1 === index && (
                                <ActionIcon
                                  variant="light"
                                  color="#105476"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    form.insertListItem("charges", {
                                      ...emptyRow(),
                                      currency_id: defaultCurrencyId,
                                      currency_code: defaultCurrencyCode,
                                      roe: defaultCurrencyCode ? 1 : null,
                                    });
                                  }}
                                >
                                  <IconPlus size={12} />
                                </ActionIcon>
                              )}
                            </Group>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ── Totals row ── */}
              <Divider mt="md" mb="md" color="#dee2e6" size="sm" />
              <Grid columns={12} gutter="md">
                <Grid.Col span={4}>
                  <Box
                    p="sm"
                    style={{
                      border: "1px solid #e3f2fc",
                      borderRadius: 6,
                      backgroundColor: "white",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text
                      size="xs"
                      fw={600}
                      c="dimmed"
                      style={{ fontFamily: "Inter", minWidth: 70 }}
                    >
                      Debit Total
                    </Text>
                    <Text
                      size="sm"
                      fw={700}
                      c="#105476"
                      style={{ fontFamily: "Inter" }}
                    >
                      {formatMoneyAmountBound(totals.debit)}
                    </Text>
                  </Box>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Box
                    p="sm"
                    style={{
                      border: "1px solid #e3f2fc",
                      borderRadius: 6,
                      backgroundColor: "white",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text
                      size="xs"
                      fw={600}
                      c="dimmed"
                      style={{ fontFamily: "Inter", minWidth: 75 }}
                    >
                      Credit Total
                    </Text>
                    <Text
                      size="sm"
                      fw={700}
                      c="#105476"
                      style={{ fontFamily: "Inter" }}
                    >
                      {formatMoneyAmountBound(totals.credit)}
                    </Text>
                  </Box>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Box
                    p="sm"
                    style={{
                      border: `1px solid ${Math.abs(totals.difference) > 0.005 ? "#ffe3e3" : "#e3f2fc"}`,
                      borderRadius: 6,
                      backgroundColor:
                        Math.abs(totals.difference) > 0.005
                          ? "#fff5f5"
                          : "white",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text
                      size="xs"
                      fw={600}
                      c="dimmed"
                      style={{ fontFamily: "Inter", minWidth: 70 }}
                    >
                      Difference
                    </Text>
                    <Text
                      size="sm"
                      fw={700}
                      c={
                        Math.abs(totals.difference) > 0.005 ? "red" : "#105476"
                      }
                      style={{ fontFamily: "Inter" }}
                    >
                      {formatMoneyAmountBound(totals.difference)}
                    </Text>
                  </Box>
                </Grid.Col>
              </Grid>

              {/* ── Account Name & Narration (selected row display) ── */}
              <Divider mt="md" mb="md" color="#dee2e6" size="sm" />
              <Grid columns={12} gutter="md">
                <Grid.Col span={3}>
                  <TextInput
                    label="Account Name"
                    value={selectedAccountName}
                    readOnly
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        height: "36px",
                        backgroundColor: "var(--mantine-color-gray-0)",
                        color: "#105476",
                        fontWeight: 500,
                      },
                      label: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        marginBottom: "4px",
                      },
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <TextInput
                    label="Narration"
                    value={selectedNarration}
                    readOnly
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                        height: "36px",
                        backgroundColor: "var(--mantine-color-gray-0)",
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
            </Box>
          </Box>

          {/* ── Form actions ── */}
          <Group justify="space-between" mt="xl" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              onClick={() => handleFinanceDocumentBack()}
              styles={{ root: { fontFamily: "Inter", fontSize: "13px" } }}
            >
              Cancel
            </Button>
            <Group gap="sm">
              {!isReadOnly && (
                <Button
                  variant="outline"
                  color="#105476"
                  onClick={() => {
                    if (supportingDocuments.length === 0) {
                      setSupportingDocuments([{ name: "", file: null }]);
                    }
                    const newErrors: { [key: number]: string } = {};
                    supportingDocuments.forEach((doc, idx) => {
                      if (doc.file && doc.file.size > MAX_FILE_SIZE) {
                        newErrors[idx] =
                          `File size exceeds 10MB limit. Current size: ${(doc.file.size / (1024 * 1024)).toFixed(2)}MB`;
                      }
                    });
                    setFileErrors(newErrors);
                    openDocumentsModal();
                  }}
                  disabled={isSubmitting}
                  styles={{ root: { fontFamily: "Inter", fontSize: "13px" } }}
                >
                  Attach Supporting Documents
                </Button>
              )}
              {!isReadOnly && (
                <Button
                  type="submit"
                  color="#105476"
                  rightSection={<IconChevronRight size={16} />}
                  loading={isSubmitting}
                  styles={{ root: { fontFamily: "Inter", fontSize: "13px" } }}
                >
                  {isUpdate ? "Update" : "Save"}
                </Button>
              )}
              {!isReadOnly && isUpdate && canPostDocuments && (
                <Button
                  variant="filled"
                  color="green"
                  leftSection={<IconSend size={16} />}
                  onClick={handlePost}
                  disabled={isSubmitting || form.values.status === "POSTED"}
                  loading={isSubmitting}
                  styles={{ root: { fontFamily: "Inter", fontSize: "13px" } }}
                >
                  Post
                </Button>
              )}
            </Group>
          </Group>
        </Box>
      </Stack>

      {/* ── Supporting Documents Modal ── */}
      <Modal
        opened={documentsModalOpened}
        onClose={closeDocumentsModal}
        title="Attach Supporting Documents"
        size="xl"
        centered
        style={{ fontFamily: "Inter" }}
      >
        <Stack gap="xs">
          {supportingDocuments.map((doc, index) => (
            <Grid key={index} columns={12} gutter="sm" align="flex-end">
              <Grid.Col span={5.5}>
                <TextInput
                  label="Document Name"
                  placeholder="Enter document name"
                  value={doc.name}
                  onChange={(e) => {
                    const updated = [...supportingDocuments];
                    updated[index] = {
                      ...updated[index],
                      name: e.target.value,
                    };
                    setSupportingDocuments(updated);
                  }}
                  styles={inputStyles}
                />
              </Grid.Col>
              <Grid.Col span={5.5}>
                <Box>
                  <Text
                    size="sm"
                    fw={500}
                    mb={4}
                    style={{ fontFamily: "Inter", fontSize: "13px" }}
                  >
                    File
                  </Text>
                  <Dropzone
                    onDrop={(files: File[]) => {
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
                          `File size exceeds 10MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                        setFileErrors(newErrors);
                        ToastNotification({
                          type: "error",
                          message: `File "${file.name}" exceeds 10MB limit`,
                        });
                        return;
                      }
                      const updated = [...supportingDocuments];
                      updated[index] = {
                        ...updated[index],
                        file,
                        document_url: undefined,
                        document_id: undefined,
                      };
                      setSupportingDocuments(updated);
                    }}
                    onReject={(files: any[]) => {
                      const rejection = files[0];
                      if (
                        rejection?.errors?.some(
                          (e: any) => e.code === "file-too-large",
                        )
                      ) {
                        const newErrors = { ...fileErrors };
                        newErrors[index] = "File size exceeds 10MB limit";
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
                      inner: { padding: "0", minHeight: "36px" },
                    }}
                  >
                    <Group
                      justify="space-between"
                      gap="xs"
                      px="sm"
                      style={{
                        minHeight: "36px",
                        pointerEvents: "none",
                        cursor: "pointer",
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
                            >
                              {doc.original_document_name || "Download file"}
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
                      {(doc.file || doc.document_url) && (
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
                            const updated = [...supportingDocuments];
                            updated[index] = {
                              ...updated[index],
                              file: null,
                              document_url: undefined,
                              document_id: undefined,
                            };
                            setSupportingDocuments(updated);
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
                    if (supportingDocuments.length === 1) {
                      setSupportingDocuments([{ name: "", file: null }]);
                    } else {
                      const updated = supportingDocuments.filter(
                        (_, i) => i !== index,
                      );
                      setSupportingDocuments(updated);
                      const newErrors: { [key: number]: string } = {};
                      Object.keys(fileErrors).forEach((key) => {
                        const keyNum = parseInt(key);
                        if (keyNum < index)
                          newErrors[keyNum] = fileErrors[keyNum];
                        else if (keyNum > index)
                          newErrors[keyNum - 1] = fileErrors[keyNum];
                      });
                      setFileErrors(newErrors);
                    }
                  }}
                >
                  <IconTrash size={16} />
                </Button>
              </Grid.Col>
              <Grid.Col span={1} offset={11}>
                {index === supportingDocuments.length - 1 && (
                  <Button
                    variant="light"
                    color="#105476"
                    onClick={() => {
                      setSupportingDocuments([
                        ...supportingDocuments,
                        { name: "", file: null },
                      ]);
                    }}
                  >
                    <IconPlus size={16} />
                  </Button>
                )}
              </Grid.Col>
            </Grid>
          ))}

          {supportingDocuments.length === 0 && (
            <Button
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={() => setSupportingDocuments([{ name: "", file: null }])}
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
    </Box>
  );
}

export default JournalVoucherReversal;
