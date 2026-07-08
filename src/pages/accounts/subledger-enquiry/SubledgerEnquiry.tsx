import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Alert,
  ActionIcon,
  Box,
  Button,
  createTheme,
  Grid,
  MantineProvider,
  rem,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconBook2,
  IconCoin,
  IconFilter,
  IconInfoCircle,
  IconRefresh,
  IconSearch,
  IconTable,
  IconX,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from "mantine-react-table";
import { useDebouncedValue } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import {
  Dropdown,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableEmpty,
  ERPListTableLoading,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme, ErpListBodyCellTone } from "../../../components";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import useAuthStore from "../../../store/authStore";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";

type CoaItem = {
  id?: number;
  gl_account_code?: string;
  sl_code?: string;
  account_name?: string;
};

type SubledgerEntryRow = {
  sno?: number;
  location?: string | null;
  day_book_code?: string | null;
  day_book_type?: string | null;
  document_no?: string | null;
  date_document?: string | null;
  due_date?: string | null;
  shipment_no?: string | null;
  service?: string | null;
  job_id?: string | null;
  debit_local_amount?: number | null;
  credit_local_amount?: number | null;
  narration?: string | null;
  note?: string | null;
  amount?: number | null;
  closing_balance?: number | null;
  outstanding_amount?: number | null;
  outstanding_days?: number | null;
};

type SubledgerEnquiryResponse = {
  date_from?: string;
  date_to?: string;
  account_code?: string;
  opening_balance?: number | null;
  closing_balance?: number | null;
  total?: number;
  data?: SubledgerEntryRow[];
};

type EntryColumn = {
  key: keyof SubledgerEntryRow;
  label: string;
  span: number;
};

const ENTRY_COLUMNS: EntryColumn[] = [
  { key: "sno", label: "S.No.", span: 0.4 },
  { key: "location", label: "Location", span: 0.65 },
  { key: "day_book_code", label: "Day Book", span: 0.85 },
  { key: "day_book_type", label: "Type", span: 0.65 },
  { key: "document_no", label: "Doc No", span: 1.25 },
  { key: "date_document", label: "Doc Date", span: 0.9 },
  { key: "due_date", label: "Due Date", span: 0.9 },
  { key: "service", label: "Service", span: 0.55 },
  { key: "job_id", label: "Job Id", span: 0.95 },
  { key: "shipment_no", label: "Shipment No", span: 1.0 },
  { key: "debit_local_amount", label: "Debit", span: 0.95 },
  { key: "credit_local_amount", label: "Credit", span: 0.95 },
  { key: "narration", label: "Narration", span: 1 },
  { key: "note", label: "Note", span: 1 },
  { key: "amount", label: "Amount", span: 0.95 },
  { key: "outstanding_amount", label: "Outstanding Amt", span: 1.0 },
  { key: "outstanding_days", label: "Outstanding Days", span: 0.95 },
  { key: "closing_balance", label: "Closing Bal", span: 0.8 },
];

function entryColumnId(col: MRT_ColumnDef<SubledgerEntryRow>): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

function subledgerMrtColumnSize(key: keyof SubledgerEntryRow): number {
  // Keep early identifier columns compact (Receipt list-like density).
  switch (key) {
    case "sno":
      return 60;
    case "location":
      return 80;
    case "day_book_code":
      return 80;
    case "day_book_type":
      return 80;
    case "document_no":
      return 140;
    case "date_document":
    case "due_date":
      return 130;
    case "service":
      return 80;
    case "job_id":
      return 130;
    case "shipment_no":
      return 130;
    case "debit_local_amount":
    case "credit_local_amount":
    case "amount":
    case "closing_balance":
    case "outstanding_amount":
      return 120;
    case "outstanding_days":
      return 110;
    case "narration":
    case "note":
      return 120;
    default:
      return 140;
  }
}

function subledgerCellAlign(
  key: keyof SubledgerEntryRow,
): "left" | "center" | "right" {
  // User request: align debit/credit/amount values properly (center align).
  if (
    key === "debit_local_amount" ||
    key === "credit_local_amount" ||
    key === "amount" ||
    key === "closing_balance" ||
    key === "outstanding_amount" ||
    key === "outstanding_days"
  ) {
    return "center";
  }
  return subledgerThTextAlign(key);
}

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSubledgerCell(
  key: keyof SubledgerEntryRow,
  value: unknown,
  dateFormat: unknown,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (key === "sno") return String(value);
  if (key === "date_document" || key === "due_date") {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      value instanceof Date
    ) {
      const parsed = dayjs(value);
      if (!parsed.isValid()) return String(value);
      return parsed.format(String(dateFormat));
    }
    return String(value);
  }
  if (key === "outstanding_days") {
    if (typeof value === "number" && Number.isFinite(value))
      return String(Math.round(value));
    if (typeof value === "string" && value.trim() !== "") {
      const n = parseInt(value, 10);
      if (!Number.isNaN(n)) return String(n);
    }
    return String(value);
  }
  if (
    key === "debit_local_amount" ||
    key === "credit_local_amount" ||
    key === "amount" ||
    key === "closing_balance" ||
    key === "outstanding_amount"
  ) {
    if (typeof value === "number") return formatAmount(value);
    if (typeof value === "string" && value.trim() !== "") {
      const n = parseFloat(value);
      if (!Number.isNaN(n)) return formatAmount(n);
    }
  }
  return String(value);
}

function formatDateYYYYMMDD(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Same Geist + density as Air Export Booking list screens. */
const V0_FONT_SANS = "'Geist', sans-serif";
const v0RootTypographyShell = {
  fontFamily: V0_FONT_SANS,
  fontSize: 14,
  lineHeight: 1.5,
  WebkitFontSmoothing: "antialiased" as const,
  MozOsxFontSmoothing: "grayscale" as const,
};

const v0MenuStyles = {
  dropdown: { fontFamily: V0_FONT_SANS, fontSize: 14 },
};

const SUBLEDGER_FILTER_BORDER = "#e2e8f0";
const SUBLEDGER_FILTER_UNIFIED_STYLES = {
  label: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    fontWeight: 500,
    color: "#64748b",
    lineHeight: 1.25,
    marginBottom: 6,
    display: "block" as const,
    minHeight: 15,
  },
  input: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    height: 32,
    minHeight: 32,
    borderColor: SUBLEDGER_FILTER_BORDER,
  },
  dropdown: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
  option: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
} as const;

const subledgerV0MantineTheme = createTheme({
  fontFamily: V0_FONT_SANS,
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },
});

const SUBLEDGER_FILTER_SELECT_CLASSNAMES = {
  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
  option: ERP_LIST_GEIST_ROOT_CLASS,
};

type SubledgerColumnKey = (typeof ENTRY_COLUMNS)[number]["key"];

const buildDefaultSubledgerColumnVisibility = (): Record<
  SubledgerColumnKey,
  boolean
> =>
  Object.fromEntries(ENTRY_COLUMNS.map((c) => [c.key, true])) as Record<
    SubledgerColumnKey,
    boolean
  >;

type FilterFormValues = {
  fromDate: Date | null;
  toDate: Date | null;
  accountId: string | null;
  accountCode: string | null;
  location: string | null | undefined;
};

type AppliedFilterSummary = {
  date_from: string;
  date_to: string;
  account_code: string;
  subledger_code?: string;
  location?: string;
  account_name?: string;
};

const filterSchema: yup.ObjectSchema<FilterFormValues> = yup.object({
  fromDate: yup.date().nullable().required("From date is required"),
  toDate: yup.date().nullable().required("To date is required"),
  accountId: yup.string().nullable().required("Account is required"),
  accountCode: yup.string().nullable().required("Account is required"),
  location: yup.string().nullable().optional(),
});

function subledgerColumnTone(
  key: keyof SubledgerEntryRow,
): ErpListBodyCellTone {
  if (key === "date_document" || key === "due_date") return "muted";
  if (
    key === "debit_local_amount" ||
    key === "credit_local_amount" ||
    key === "amount" ||
    key === "closing_balance" ||
    key === "outstanding_amount" ||
    key === "outstanding_days"
  ) {
    return "numeric";
  }
  return "default";
}

function subledgerThTextAlign(key: keyof SubledgerEntryRow): "left" | "right" {
  return subledgerColumnTone(key) === "numeric" ? "right" : "left";
}

export default function SubledgerEnquiry() {
  const [selectedAccount, setSelectedAccount] = useState<CoaItem | null>(null);
  const [rows, setRows] = useState<SubledgerEntryRow[]>([]);
  const [enquirySummary, setEnquirySummary] = useState<{
    opening_balance: number | null;
    closing_balance: number | null;
  } | null>(null);
  const [resultTotal, setResultTotal] = useState<number | null>(null);
  const [isFetchingRows, setIsFetchingRows] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilterSummary | null>(null);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500);
  const [visibleColumns, setVisibleColumns] = useState<
    Record<SubledgerColumnKey, boolean>
  >(() => buildDefaultSubledgerColumnVisibility());

  const dateFormat = useDateFormat();
  const form = useForm<FilterFormValues>({
    initialValues: {
      fromDate: null,
      toDate: null,
      accountId: null,
      accountCode: null,
      location: null,
    },
    validate: yupResolver(filterSchema),
    validateInputOnBlur: true,
  });

  const selectedSlCode = selectedAccount?.sl_code ?? "";
  const selectedAccountName = selectedAccount?.account_name ?? "";

  const { user } = useAuthStore();

  const asStringError = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;

  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#105476";
  const pageBg = "#F0F4F8";
  const cardBg = "#ffffff";
  const erpTheme: ErpListTheme = useMemo(
    () => ({
      border,
      muted,
      fg,
      primary,
      headerBg: "#f8fafc",
      pageBg,
      cardBg,
      fontSans: V0_FONT_SANS,
    }),
    [],
  );

  const visibleEntryColumns = useMemo(() => {
    const v = ENTRY_COLUMNS.filter((c) => visibleColumns[c.key] !== false);
    return v.length > 0 ? v : ENTRY_COLUMNS;
  }, [visibleColumns]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      ENTRY_COLUMNS.some((col) => {
        const v = r[col.key];
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, debouncedSearch]);

  const pagedRows = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return filteredRows.slice(start, start + pagination.pageSize);
  }, [filteredRows, pagination.pageIndex, pagination.pageSize]);

  const listTotalCount = resultTotal ?? rows.length;

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredRows.length / pagination.pageSize),
    );
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [filteredRows.length, pagination.pageSize, pagination.pageIndex]);

  const columnToggleItems = useMemo(
    () =>
      ENTRY_COLUMNS.map((col) => ({
        id: col.key,
        label: col.label,
        checked: visibleColumns[col.key] !== false,
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [col.key]: !prev[col.key],
          })),
      })),
    [visibleColumns],
  );

  const locationOptions = useMemo(() => {
    const branches = (user?.branches ?? []) as Array<{
      user_branch_id?: number;
      branch_code?: string;
      branch_name?: string;
      country?: { country_id?: number };
      is_default?: boolean;
    }>;

    if (branches.length === 0) return [];

    const activeCountryId = user?.country?.country_id;
    const activeCountryIdStr =
      activeCountryId !== null && activeCountryId !== undefined
        ? String(activeCountryId)
        : null;

    const activeBranches = activeCountryIdStr
      ? branches.filter((b) => {
          const branchCountryId = b.country?.country_id;
          if (branchCountryId === null || branchCountryId === undefined) {
            return false;
          }
          return String(branchCountryId) === activeCountryIdStr;
        })
      : [];

    const effectiveBranches =
      activeBranches.length > 0
        ? activeBranches
        : branches.filter((b) => b.is_default);

    const list = (effectiveBranches.length > 0 ? effectiveBranches : branches)
      .map((b) => ({
        value: String(b.branch_code ?? "").trim(),
        label: String(b.branch_name ?? "").trim(),
      }))
      .filter((o) => o.value !== "" && o.label !== "");

    const seen = new Set<string>();
    return list.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [user]);

  const ingestSubledgerResponse = useCallback(
    (response: SubledgerEnquiryResponse) => {
      const list = Array.isArray(response?.data) ? response.data : [];
      setRows(list);
      setResultTotal(
        typeof response?.total === "number" ? response.total : list.length,
      );
      setEnquirySummary({
        opening_balance:
          typeof response?.opening_balance === "number"
            ? response.opening_balance
            : null,
        closing_balance:
          typeof response?.closing_balance === "number"
            ? response.closing_balance
            : null,
      });
    },
    [],
  );

  const runSubledgerEnquiry = useCallback(
    async (values: FilterFormValues) => {
      setFetchError("");
      setIsFetchingRows(true);

      try {
        const trimmedLocation = values.location?.trim();
        const date_from = formatDateYYYYMMDD(values.fromDate);
        const date_to = formatDateYYYYMMDD(values.toDate);
        const account_code = String(values.accountCode);
        const payload = {
          filters: {
            date_from,
            date_to,
            account_code,
            ...(selectedSlCode ? { subledger_code: selectedSlCode } : {}),
            ...(trimmedLocation ? { location: trimmedLocation } : {}),
          },
        };

        const response = (await postAPICall(
          URL.subledgerEnquiry,
          payload,
          API_HEADER,
        )) as SubledgerEnquiryResponse;

        ingestSubledgerResponse(response);
        setAppliedFilters({
          date_from,
          date_to,
          account_code,
          ...(selectedSlCode ? { subledger_code: selectedSlCode } : {}),
          ...(trimmedLocation ? { location: trimmedLocation } : {}),
          ...(selectedAccountName ? { account_name: selectedAccountName } : {}),
        });
        setPagination((p) => ({ ...p, pageIndex: 0 }));
      } catch {
        setRows([]);
        setEnquirySummary(null);
        setResultTotal(null);
        setFetchError("Unable to fetch subledger data. Please try again.");
      } finally {
        setIsFetchingRows(false);
      }
    },
    [ingestSubledgerResponse, selectedAccountName, selectedSlCode],
  );

  const refreshSubledgerEnquiry = useCallback(async () => {
    if (!appliedFilters) return;
    setFetchError("");
    setIsFetchingRows(true);
    try {
      const payload = {
        filters: {
          date_from: appliedFilters.date_from,
          date_to: appliedFilters.date_to,
          account_code: appliedFilters.account_code,
          ...(appliedFilters.subledger_code
            ? { subledger_code: appliedFilters.subledger_code }
            : {}),
          ...(appliedFilters.location
            ? { location: appliedFilters.location }
            : {}),
        },
      };

      const response = (await postAPICall(
        URL.subledgerEnquiry,
        payload,
        API_HEADER,
      )) as SubledgerEnquiryResponse;

      ingestSubledgerResponse(response);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    } catch {
      setRows([]);
      setEnquirySummary(null);
      setResultTotal(null);
      setFetchError("Unable to fetch subledger data. Please try again.");
    } finally {
      setIsFetchingRows(false);
    }
  }, [appliedFilters, ingestSubledgerResponse]);

  const downloadSubledgerCsv = useCallback(async () => {
    if (!appliedFilters) return;
    setIsDownloadingCsv(true);
    try {
      const payload = {
        filters: {
          date_from: appliedFilters.date_from,
          date_to: appliedFilters.date_to,
          account_code: appliedFilters.account_code,
          ...(appliedFilters.subledger_code
            ? { subledger_code: appliedFilters.subledger_code }
            : {}),
          ...(appliedFilters.location
            ? { location: appliedFilters.location }
            : {}),
          csv: true,
        },
      };

      const response = (await postAPICall(URL.subledgerEnquiry, payload, {
        ...API_HEADER,
        responseType: "blob",
      })) as { data?: Blob };

      const blob =
        response?.data instanceof Blob
          ? response.data
          : (response as unknown as Blob);
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Empty response from server");
      }

      // If server returns JSON error in a blob, surface it.
      const head = await blob.slice(0, 256).text();
      const headTrim = head.trimStart();
      if (headTrim.startsWith("{") || headTrim.startsWith("[")) {
        const fullText = await blob.text();
        let parsed: { detail?: unknown; message?: unknown; error?: unknown };
        try {
          parsed = JSON.parse(fullText) as typeof parsed;
        } catch {
          throw new Error(
            fullText.slice(0, 500) || "Invalid response from server",
          );
        }
        const raw = parsed.detail ?? parsed.message ?? parsed.error ?? fullText;
        const msg = Array.isArray(raw)
          ? raw.map(String).join(", ")
          : typeof raw === "string"
            ? raw
            : JSON.stringify(raw);
        throw new Error(msg || "CSV download failed");
      }

      const stamp = dayjs().format("YYYYMMDD-HHmmss");
      downloadBlob(blob, `subledger-enquiry-${stamp}.csv`);
      ToastNotification({ type: "success", message: "CSV downloaded" });
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: Blob } };
      let message = err?.message || "Failed to download CSV";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text) as {
            detail?: string;
            message?: string;
          };
          message = parsed.detail || parsed.message || text || message;
        } catch {
          /* keep default message */
        }
      }
      ToastNotification({ type: "error", message });
    } finally {
      setIsDownloadingCsv(false);
    }
  }, [appliedFilters]);

  const handleSearch = form.onSubmit(runSubledgerEnquiry);

  const applySearch = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    void runSubledgerEnquiry(form.values);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    form.reset();
    setSelectedAccount(null);
    setRows([]);
    setEnquirySummary(null);
    setResultTotal(null);
    setFetchError("");
    setSearchQuery("");
    setPagination({ pageIndex: 0, pageSize: 25 });
    setAppliedFilters(null);
  };

  const openingBalanceLabelDisplay = useMemo(() => {
    if (enquirySummary?.opening_balance == null) return "—";
    return formatAmount(enquirySummary.opening_balance);
  }, [enquirySummary]);

  const appliedFilterItems = useMemo(() => {
    if (!appliedFilters) return [];
    const items: Array<{ key: string; value: string }> = [];
    if (appliedFilters.date_from)
      items.push({ key: "From", value: appliedFilters.date_from });
    if (appliedFilters.date_to)
      items.push({ key: "To", value: appliedFilters.date_to });
    if (appliedFilters.account_name)
      items.push({ key: "Account Name", value: appliedFilters.account_name });
    if (appliedFilters.account_code)
      items.push({ key: "Account Code", value: appliedFilters.account_code });
    if (appliedFilters.subledger_code)
      items.push({ key: "SL Code", value: appliedFilters.subledger_code });
    if (appliedFilters.location)
      items.push({ key: "Location", value: appliedFilters.location });
    return items;
  }, [appliedFilters]);

  return (
    <MantineProvider theme={subledgerV0MantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={{
          ...erpListGeistRootTypography,
          ...v0RootTypographyShell,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ERPListScreen
          theme={erpTheme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconTable size={14} color={primary} />}
                  value={listTotalCount}
                  label="Total"
                />

                {appliedFilterItems.length > 0 ? (
                  <Text
                    size="xs"
                    c={muted}
                    style={{
                      fontFamily: erpTheme.fontSans,
                      maxWidth: 720,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={appliedFilterItems
                      .map((i) => `${i.key}: ${i.value}`)
                      .filter(Boolean)
                      .join(" | ")}
                  >
                    {appliedFilterItems.map((item, idx) => (
                      <span
                        key={`${item.key}-${idx}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "baseline",
                          gap: 4,
                          fontFamily: erpTheme.fontSans,
                        }}
                      >
                        <span style={{ fontWeight: 600, fontFamily: erpTheme.fontSans }}>
                          {item.key}:
                        </span>{" "}
                        <span style={{ fontWeight: 400, fontFamily: erpTheme.fontSans }}>
                          {item.value}
                        </span>
                        {idx < appliedFilterItems.length - 1 ? " | " : ""}
                      </span>
                    ))}
                  </Text>
                ) : null}
                {enquirySummary ? (
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCoin size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={openingBalanceLabelDisplay}
                    label="Opening Balance"
                  />
                ) : null}
              </>
            ),
            // secondary: selectedAccount ? (
            //   <>
            //     <Group gap={8} wrap="nowrap" align="center">
            //       <IconBook2 size={16} color={muted} style={{ flexShrink: 0 }} />
            //       <Text
            //         size="xs"
            //         fw={600}
            //         c={fg}
            //         style={{ fontFamily: erpTheme.fontSans }}
            //         component="span"
            //       >
            //         GL: {selectedGlAccountCode || "—"}
            //       </Text>
            //     </Group>
            //     <Group gap={8} wrap="nowrap" align="center">
            //       <Text size="xs" c={muted} component="span">
            //         SL
            //       </Text>
            //       <Text
            //         size="xs"
            //         fw={600}
            //         c={fg}
            //         style={{ fontFamily: erpTheme.fontSans }}
            //         component="span"
            //       >
            //         {selectedSlCode || "—"}
            //       </Text>
            //     </Group>
            //   </>
            // ) : undefined,
            actions: (
              <>
                <TextInput
                  placeholder="Search…"
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    searchQuery ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        aria-label="Clear search"
                        onClick={() => setSearchQuery("")}
                        style={{ cursor: "pointer" }}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    ) : null
                  }
                  w={260}
                  size="xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={{
                    input: {
                      fontFamily: erpTheme.fontSans,
                      fontSize: 12,
                      height: 32,
                      borderColor: border,
                    },
                  }}
                />
                <ERPListColumnToggleMenu
                  theme={erpTheme}
                  items={columnToggleItems}
                  menuStyles={v0MenuStyles}
                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                />
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => void refreshSubledgerEnquiry()}
                  loading={isFetchingRows}
                  disabled={!appliedFilters || isFetchingRows}
                >
                  Refresh
                </Button>
                {rows.length > 0 && (
                  <Button
                    variant="default"
                    size="xs"
                    styles={erpToolbarOutlineButtonStyles(erpTheme)}
                    leftSection={<IconBook2 size={14} />}
                    onClick={() => void downloadSubledgerCsv()}
                    loading={isDownloadingCsv}
                    disabled={
                      isDownloadingCsv || isFetchingRows || !appliedFilters
                    }
                  >
                    Download
                  </Button>
                )}
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine by date range, account, or location",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearAllFilters}
                onApply={applySearch}
                applyLabel="Search"
                applyLoading={isFetchingRows}
                applyDisabled={isFetchingRows}
              />
            ),
            children: (
              <form onSubmit={handleSearch}>
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <SingleDateInput
                        label="From"
                        value={form.values.fromDate}
                        onChange={(d) => form.setFieldValue("fromDate", d)}
                        error={asStringError(form.errors.fromDate)}
                        withAsterisk
                        size="xs"
                        classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                        styles={{
                          ...SUBLEDGER_FILTER_UNIFIED_STYLES,
                          input: {
                            ...SUBLEDGER_FILTER_UNIFIED_STYLES.input,
                            minHeight: 32,
                          },
                        }}
                      />
                    </Box>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <SingleDateInput
                        label="To"
                        value={form.values.toDate}
                        onChange={(d) => form.setFieldValue("toDate", d)}
                        error={asStringError(form.errors.toDate)}
                        withAsterisk
                        size="xs"
                        classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                        styles={{
                          ...SUBLEDGER_FILTER_UNIFIED_STYLES,
                          input: {
                            ...SUBLEDGER_FILTER_UNIFIED_STYLES.input,
                            minHeight: 32,
                          },
                        }}
                      />
                    </Box>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 12, md: 8, xl: 4 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <SearchableSelect
                        label="Account Name"
                        apiEndpoint={URL.chartOfAccounts}
                        value={form.values.accountId}
                        dropdownZIndex={1100}
                        placeholder="Search by account name"
                        withAsterisk
                        minSearchLength={1}
                        size="xs"
                        searchFields={["gl_account_code", "account_name", "id"]}
                        displayFormat={(item: Record<string, unknown>) => {
                          const id = String(item.id ?? "").trim();
                          const gl = String(item.gl_account_code ?? "").trim();
                          const name = String(item.account_name ?? "").trim();
                          const glName = String(item.gl_name ?? "").trim();
                          return {
                            value: id,
                            label: [name, gl, glName]
                              .filter(Boolean)
                              .join(" - "),
                          };
                        }}
                        displayValue={selectedAccount?.account_name ?? ""}
                        returnOriginalData
                        onChange={(value, _selectedData, originalData) => {
                          if (!value || !originalData) {
                            form.setFieldValue("accountId", null);
                            form.setFieldValue("accountCode", null);
                            setSelectedAccount(null);
                            return;
                          }

                          const nextGl = originalData.gl_account_code;
                          const nextSl = originalData.sl_code;
                          const nextName = originalData.account_name;

                          form.setFieldValue("accountId", value);
                          form.setFieldValue(
                            "accountCode",
                            nextGl !== undefined && nextGl !== null
                              ? String(nextGl)
                              : null,
                          );
                          setSelectedAccount({
                            id:
                              originalData.id !== undefined &&
                              originalData.id !== null
                                ? Number(originalData.id)
                                : undefined,
                            gl_account_code:
                              nextGl !== undefined && nextGl !== null
                                ? String(nextGl)
                                : undefined,
                            sl_code:
                              nextSl !== undefined && nextSl !== null
                                ? String(nextSl)
                                : undefined,
                            account_name:
                              nextName !== undefined && nextName !== null
                                ? String(nextName)
                                : undefined,
                          });
                        }}
                        error={asStringError(form.errors.accountId)}
                        classNames={{
                          input: ERP_LIST_GEIST_ROOT_CLASS,
                          ...erpListGeistSelectClassNames,
                          ...SUBLEDGER_FILTER_SELECT_CLASSNAMES,
                        }}
                        styles={{
                          ...SUBLEDGER_FILTER_UNIFIED_STYLES,
                          input: {
                            ...SUBLEDGER_FILTER_UNIFIED_STYLES.input,
                            minHeight: 32,
                          },
                        }}
                      />
                    </Box>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Box
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        minHeight: 0,
                      }}
                    >
                      <Dropdown
                        label="Location"
                        placeholder={
                          locationOptions.length > 0
                            ? "Select location"
                            : "No locations"
                        }
                        data={locationOptions}
                        value={form.values.location}
                        dropdownZIndex={1100}
                        searchable={false}
                        onChange={(value) =>
                          form.setFieldValue("location", value)
                        }
                        size="xs"
                        classNames={erpListGeistSelectClassNames}
                        styles={SUBLEDGER_FILTER_UNIFIED_STYLES}
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
              </form>
            ),
          }}
          table={{
            footer:
              !isFetchingRows &&
              !(rows.length === 0 && enquirySummary === null) ? (
                <ERPListPaginationFooter
                  theme={erpTheme}
                  totalRecords={filteredRows.length}
                  pageIndex={pagination.pageIndex}
                  pageSize={pagination.pageSize}
                  onPageIndexChange={(i) =>
                    setPagination((p) => ({ ...p, pageIndex: i }))
                  }
                  onPageSizeChange={(size) =>
                    setPagination({ pageIndex: 0, pageSize: size })
                  }
                  selectClassNames={SUBLEDGER_FILTER_SELECT_CLASSNAMES}
                />
              ) : undefined,
            children: (
              <>
                {fetchError && (
                  <Alert
                    mb="md"
                    color="red"
                    variant="light"
                    icon={<IconInfoCircle size={16} />}
                    styles={{ root: { fontFamily: erpTheme.fontSans } }}
                  >
                    {fetchError}
                  </Alert>
                )}
                {isFetchingRows ? (
                  <ERPListTableLoading
                    theme={erpTheme}
                    message="Loading subledger entries…"
                  />
                ) : rows.length === 0 && enquirySummary === null ? (
                  <ERPListTableEmpty
                    theme={erpTheme}
                    icon={<IconTable size={24} color={muted} />}
                    title="No subledger data yet"
                    hint="Open filters, choose an account and date range, then run Search"
                  />
                ) : (
                  <SubledgerTable
                    theme={erpTheme}
                    borderColor={border}
                    backgroundColor={cardBg}
                    mutedColor={muted}
                    headerBg={erpTheme.headerBg}
                    fgColor={fg}
                    dateFormat={dateFormat}
                    entryColumns={visibleEntryColumns}
                    rows={pagedRows}
                    rowCount={filteredRows.length}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                  />
                )}
              </>
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}

function SubledgerTable(props: {
  theme: ErpListTheme;
  borderColor: string;
  backgroundColor: string;
  headerBg: string;
  mutedColor: string;
  fgColor: string;
  dateFormat: unknown;
  entryColumns: EntryColumn[];
  rows: SubledgerEntryRow[];
  rowCount: number;
  pagination: MRT_PaginationState;
  onPaginationChange: (
    updater:
      | MRT_PaginationState
      | ((prev: MRT_PaginationState) => MRT_PaginationState),
  ) => void;
}) {
  const {
    theme,
    borderColor,
    backgroundColor,
    headerBg,
    mutedColor,
    dateFormat,
    entryColumns,
    rows,
    rowCount,
    pagination,
    onPaginationChange,
  } = props;

  const allColumns = useMemo<MRT_ColumnDef<SubledgerEntryRow>[]>(
    () =>
      ENTRY_COLUMNS.map((c) => ({
        id: String(c.key),
        accessorKey: String(c.key),
        header: c.label,
        size: subledgerMrtColumnSize(c.key),
        minSize: Math.min(subledgerMrtColumnSize(c.key), 120),
        maxSize: c.key === "narration" || c.key === "note" ? 520 : undefined,
        grow: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<unknown>();
          return formatSubledgerCell(c.key, value, dateFormat) || "—";
        },
      })),
    [dateFormat],
  );

  const visibleColumns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = entryColumnId(col);
        return entryColumns.some((c) => String(c.key) === id);
      }),
    [allColumns, entryColumns],
  );

  const table = useMantineReactTable({
    columns: visibleColumns,
    data: rows,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableStickyHeader: true,
    layoutMode: "grid",
    manualPagination: true,
    onPaginationChange,
    rowCount,
    state: { pagination },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: {
      shadow: "none",
      p: 0,
      radius: 0,
      withBorder: false,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        backgroundColor: "transparent",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      const key = column.id as keyof SubledgerEntryRow;
      const tone = subledgerColumnTone(key);
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: theme.fontSans,
          color: tone === "muted" ? mutedColor : mutedColor,
          backgroundColor,
          textAlign: subledgerCellAlign(key),
          borderBottom: `1px solid ${borderColor}`,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const key = column.id as keyof SubledgerEntryRow;
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: theme.fontSans,
          color: mutedColor,
          backgroundColor: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          textAlign: subledgerCellAlign(key),
          whiteSpace: "nowrap",
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
      },
    },
  });

  return (
    <Box
      style={{ minWidth: 1100, paddingBottom: 8 }}
      className={ERP_LIST_GEIST_ROOT_CLASS}
    >
      <MantineReactTable table={table} />
    </Box>
  );
}
