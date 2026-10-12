import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  createTheme,
  Group,
  MantineProvider,
  rem,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconCheck,
  IconFilter,
  IconInfoCircle,
  IconRefresh,
  IconTable,
  IconX,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from "mantine-react-table";
import { useForm } from "@mantine/form";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  Dropdown,
  ERPListColumnToggleMenu,
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
  erpToolbarPrimaryButtonStyles,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { apiCallProtected } from "../../../api/axios";
import { postAPICall } from "../../../service/postApiCall";
import useDateFormat from "../../../hooks/useDateFormat";
import { getServerErrorMessage } from "../../../utils/apiErrorMessage";
import { formatMoneyAmountForUi } from "../../../utils/nonDecimalMoneyAmount";

type CoaItem = {
  id?: number;
  gl_account_code?: string;
  sl_code?: string;
  account_name?: string;
};

type ChequeClearanceRow = {
  source: "payment" | "receipt";
  id: number;
  date?: string | null;
  daybook_code?: string | null;
  document_no?: string | null;
  party_name?: string | null;
  cheque_no?: string | null;
  cheque_date?: string | null;
  amount?: string | number | null;
  local_amount?: string | number | null;
  currency_code?: string | null;
  utr_no?: string | null;
  chq_clrd_date?: string | null;
};

type ChequeClearanceResponse = {
  status?: boolean;
  message?: string;
  total?: number;
  data?: ChequeClearanceRow[];
};

type FilterFormValues = {
  fromDate: Date | null;
  toDate: Date | null;
  accountId: string | null;
  accountCode: string | null;
  subledger: string;
  chequeNo: string;
  chequeStatus: string | null;
};

type AppliedFilters = {
  date_from: string;
  date_to: string;
  account_code: string;
  account_name: string;
  subledger: string;
  cheque_no: string;
  cheque_status: "CLEARED" | "UNCLEARED";
};

const V0_FONT_SANS = "'Geist', sans-serif";
const FILTER_BORDER = "#e2e8f0";
const FILTER_STYLES = {
  label: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    fontWeight: 500,
    color: "#64748b",
    lineHeight: 1.25,
    marginBottom: 4,
    display: "block" as const,
    minHeight: 14,
  },
  input: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    height: 32,
    minHeight: 32,
    borderColor: FILTER_BORDER,
  },
  dropdown: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
  option: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
  error: {
    fontFamily: V0_FONT_SANS,
    fontSize: 11,
    lineHeight: 1.35,
    marginTop: 4,
  },
} as const;

const pageTheme = createTheme({
  fontFamily: V0_FONT_SANS,
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },
});

const CHEQUE_STATUS_OPTIONS = [
  { value: "CLEARED", label: "Cleared" },
  { value: "UNCLEARED", label: "Uncleared" },
];

const COLUMNS: { key: keyof ChequeClearanceRow | "sno"; label: string }[] = [
  { key: "sno", label: "S.No" },
  { key: "date", label: "Document Date" },
  { key: "daybook_code", label: "Daybook" },
  { key: "document_no", label: "Document No" },
  { key: "party_name", label: "Paid To / Received From" },
  { key: "cheque_no", label: "Cheque No" },
  { key: "cheque_date", label: "Cheque Date" },
  { key: "amount", label: "Cheque Amount" },
  { key: "local_amount", label: "Currency Amount" },
  { key: "currency_code", label: "Currency" },
  { key: "utr_no", label: "UTR No" },
  { key: "chq_clrd_date", label: "Cheque Clearance Date" },
];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const COLUMN_WIDTH: Record<ColumnKey, number> = {
  sno: 52,
  date: 108,
  daybook_code: 84,
  document_no: 112,
  party_name: 168,
  cheque_no: 96,
  cheque_date: 108,
  amount: 108,
  local_amount: 116,
  currency_code: 76,
  utr_no: 120,
  chq_clrd_date: 176,
};

const UTR_PIN_WIDTH = COLUMN_WIDTH.utr_no;
const DATE_PIN_WIDTH = COLUMN_WIDTH.chq_clrd_date;

const filterSchema = yup.object({
  fromDate: yup.date().nullable().required("From date is required"),
  toDate: yup
    .date()
    .nullable()
    .required("To date is required")
    .test("after-from", "To date cannot be before From date", function (value) {
      const from = this.parent.fromDate as Date | null;
      if (!from || !value) return true;
      return value >= from;
    }),
  accountId: yup.string().nullable().required("Account is required"),
  chequeNo: yup.string().trim().optional(),
  chequeStatus: yup.string().nullable().required("Cheque status is required"),
});

function formatDateYYYYMMDD(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function rowKey(row: ChequeClearanceRow): string {
  return `${row.source}-${row.id}`;
}

function OverflowTooltipText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <Tooltip label={text} disabled={!overflows} multiline maw={360} withArrow>
      <Text
        ref={ref}
        component="p"
        truncate
        style={{
          fontFamily: V0_FONT_SANS,
          fontSize: 13,
          margin: 0,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          display: "block",
        }}
      >
        {text}
      </Text>
    </Tooltip>
  );
}

function rowClearanceDraft(
  row: ChequeClearanceRow,
  draftDates: Record<string, Date | null>,
  draftUtrs: Record<string, string>,
) {
  const key = rowKey(row);
  const nextDate = key in draftDates ? draftDates[key] : parseApiDate(row.chq_clrd_date);
  const nextValue = nextDate ? formatDateYYYYMMDD(nextDate) : null;
  const currentValue = row.chq_clrd_date ? row.chq_clrd_date.slice(0, 10) : null;
  const nextUtr = (key in draftUtrs ? draftUtrs[key] : row.utr_no ?? "").trim();
  const currentUtr = (row.utr_no ?? "").trim();
  return {
    key,
    nextValue,
    nextUtr,
    dirty: nextValue !== currentValue || nextUtr !== currentUtr,
  };
}

function patchClearance(row: ChequeClearanceRow, nextValue: string | null, nextUtr: string) {
  const endpoint = row.source === "receipt" ? URL.receipt : URL.payment;
  return apiCallProtected.patch(
    `${endpoint}${row.id}/`,
    {
      id: row.id,
      chq_clrd_date: nextValue,
      utr_no: nextUtr || null,
    },
    API_HEADER,
  );
}

function displayDate(value: string | null | undefined, dateFormat: string): string {
  const parsed = parseApiDate(value);
  if (!parsed) return "";
  return dayjs(parsed).format(dateFormat);
}

function displayAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return formatMoneyAmountForUi(n);
}

export default function ChequeClearance() {
  const navigate = useNavigate();
  const dateFormat = useDateFormat();
  const [selectedAccount, setSelectedAccount] = useState<CoaItem | null>(null);
  const [rows, setRows] = useState<ChequeClearanceRow[]>([]);
  const [resultTotal, setResultTotal] = useState<number | null>(null);
  const [isFetchingRows, setIsFetchingRows] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters | null>(null);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    () =>
      Object.fromEntries(COLUMNS.map((col) => [col.key, true])) as Record<
        ColumnKey,
        boolean
      >,
  );
  const [draftDates, setDraftDates] = useState<Record<string, Date | null>>({});
  const [draftUtrs, setDraftUtrs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#105476";
  const erpTheme: ErpListTheme = useMemo(
    () => ({
      border,
      muted,
      fg,
      primary,
      headerBg: "#f8fafc",
      pageBg: "#F0F4F8",
      cardBg: "#ffffff",
      fontSans: V0_FONT_SANS,
    }),
    [],
  );

  const form = useForm<FilterFormValues>({
    initialValues: {
      fromDate: startOfCurrentMonth(),
      toDate: today(),
      accountId: null,
      accountCode: null,
      subledger: "0",
      chequeNo: "",
      chequeStatus: "UNCLEARED",
    },
    validate: yupResolver(filterSchema),
    validateInputOnBlur: true,
  });

  const asStringError = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  const pagedRows = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination.pageIndex, pagination.pageSize]);

  const columnToggleItems = useMemo(
    () =>
      COLUMNS.map((col) => ({
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

  const fetchRows = useCallback(async (filters: AppliedFilters) => {
    setShowFilters(false);
    setFetchError("");
    setIsFetchingRows(true);
    try {
      const response = (await postAPICall(
        URL.chequeClearanceFilter,
        {
          filters: {
            date_from: filters.date_from,
            date_to: filters.date_to,
            account_code: filters.account_code,
            subledger: filters.subledger || "0",
            cheque_status: filters.cheque_status,
            ...(filters.cheque_no ? { cheque_no: filters.cheque_no } : {}),
          },
        },
        API_HEADER,
      )) as ChequeClearanceResponse;
      if (response?.status === false) {
        setRows([]);
        setResultTotal(0);
        setFetchError(response.message || "Unable to fetch cheque clearance data.");
        return;
      }
      const list = Array.isArray(response?.data) ? response.data : [];
      setRows(list);
      setResultTotal(typeof response?.total === "number" ? response.total : list.length);
      setDraftDates({});
      setDraftUtrs({});
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (error) {
      setRows([]);
      setResultTotal(null);
      setFetchError(
        getServerErrorMessage(error, "Unable to fetch cheque clearance data."),
      );
    } finally {
      setIsFetchingRows(false);
    }
  }, []);

  const runSearch = form.onSubmit((values) => {
    const next: AppliedFilters = {
      date_from: formatDateYYYYMMDD(values.fromDate),
      date_to: formatDateYYYYMMDD(values.toDate),
      account_code: (values.accountCode || "").trim(),
      account_name: selectedAccount?.account_name || "",
      subledger: (values.subledger || "0").trim() || "0",
      cheque_no: (values.chequeNo || "").trim(),
      cheque_status: values.chequeStatus === "UNCLEARED" ? "UNCLEARED" : "CLEARED",
    };
    setAppliedFilters(next);
    void fetchRows(next);
  });

  const clearFilters = () => {
    form.setValues({
      fromDate: startOfCurrentMonth(),
      toDate: today(),
      accountId: null,
      accountCode: null,
      subledger: "0",
      chequeNo: "",
      chequeStatus: "UNCLEARED",
    });
    form.clearErrors();
    setSelectedAccount(null);
    setShowFilters(true);
    setAppliedFilters(null);
    setRows([]);
    setResultTotal(null);
    setDraftDates({});
    setDraftUtrs({});
    setFetchError("");
  };

  const saveClearanceDate = useCallback(
    async (row: ChequeClearanceRow) => {
      const draft = rowClearanceDraft(row, draftDates, draftUtrs);
      if (!draft.dirty || isBulkSaving) return;

      setSavingKey(draft.key);
      try {
        await patchClearance(row, draft.nextValue, draft.nextUtr);
        ToastNotification({
          type: "success",
          message: "Cheque clearance updated.",
        });
        if (appliedFilters) {
          await fetchRows(appliedFilters);
        }
      } catch (error) {
        ToastNotification({
          type: "error",
          message: getServerErrorMessage(error, "Failed to update cheque clearance."),
        });
      } finally {
        setSavingKey(null);
      }
    },
    [appliedFilters, draftDates, draftUtrs, fetchRows, isBulkSaving],
  );

  const dirtyRows = useMemo(
    () => rows.filter((row) => rowClearanceDraft(row, draftDates, draftUtrs).dirty),
    [rows, draftDates, draftUtrs],
  );

  const saveBulk = useCallback(async () => {
    if (!dirtyRows.length || isBulkSaving || savingKey) return;
    setIsBulkSaving(true);
    const savedKeys = new Set<string>();
    let failed = 0;
    try {
      const response = (await postAPICall(
        URL.chequeClearanceBulkUpdate,
        {
          items: dirtyRows.map((row) => {
            const draft = rowClearanceDraft(row, draftDates, draftUtrs);
            return {
              source: row.source,
              id: row.id,
              chq_clrd_date: draft.nextValue,
              utr_no: draft.nextUtr || null,
            };
          }),
        },
        API_HEADER,
      )) as {
        status?: boolean;
        message?: string;
        results?: { source?: string; id?: number; status?: boolean }[];
      };
      const results = Array.isArray(response?.results) ? response.results : [];
      if (!results.length) {
        failed = dirtyRows.length;
      } else {
        const dirtyKeys = new Set(dirtyRows.map((row) => rowKey(row)));
        results.forEach((result) => {
          const key = `${result.source}-${result.id}`;
          if (dirtyKeys.has(key) && result.status) savedKeys.add(key);
        });
        failed = dirtyKeys.size - savedKeys.size;
      }
    } catch (error) {
      failed = dirtyRows.length;
      ToastNotification({
        type: "error",
        message: getServerErrorMessage(error, "Failed to update cheque clearance."),
      });
      setIsBulkSaving(false);
      return;
    }
    if (savedKeys.size > 0) {
      setRows((prev) =>
        prev.map((row) => {
          const key = rowKey(row);
          if (!savedKeys.has(key)) return row;
          const draft = rowClearanceDraft(row, draftDates, draftUtrs);
          return { ...row, chq_clrd_date: draft.nextValue, utr_no: draft.nextUtr || null };
        }),
      );
      setDraftDates((prev) => {
        const next = { ...prev };
        savedKeys.forEach((key) => delete next[key]);
        return next;
      });
      setDraftUtrs((prev) => {
        const next = { ...prev };
        savedKeys.forEach((key) => delete next[key]);
        return next;
      });
    }
    if (failed === 0) {
      ToastNotification({
        type: "success",
        message: "Cheque clearance updated.",
      });
      if (appliedFilters) await fetchRows(appliedFilters);
    } else if (savedKeys.size > 0 || failed > 0) {
      ToastNotification({
        type: "error",
        message:
          failed === dirtyRows.length
            ? "Failed to update cheque clearance."
            : `${failed} of ${dirtyRows.length} rows could not be updated.`,
      });
    }
    setIsBulkSaving(false);
  }, [appliedFilters, dirtyRows, draftDates, draftUtrs, fetchRows, isBulkSaving, savingKey]);

  const columns = useMemo<MRT_ColumnDef<ChequeClearanceRow>[]>(() => {
    return COLUMNS.filter((col) => visibleColumns[col.key] !== false).map((col) => ({
      id: col.key,
      accessorKey: col.key === "sno" ? "id" : col.key,
      header: col.label,
      size: COLUMN_WIDTH[col.key],
      Cell: ({ row }) => {
        const record = row.original;
        if (col.key === "sno") {
          return pagination.pageIndex * pagination.pageSize + row.index + 1;
        }
        if (col.key === "utr_no") {
          const key = rowKey(record);
          const value = key in draftUtrs ? draftUtrs[key] : record.utr_no ?? "";
          return (
            <TextInput
              value={value}
              maxLength={100}
              size="xs"
              disabled={savingKey === key || isBulkSaving}
              onChange={(event) =>
                setDraftUtrs((prev) => ({
                  ...prev,
                  [key]: event.currentTarget.value,
                }))
              }
              styles={{
                input: {
                  width: 112,
                  fontFamily: V0_FONT_SANS,
                  fontSize: 12,
                  height: 28,
                  minHeight: 28,
                },
              }}
            />
          );
        }
        if (col.key === "chq_clrd_date") {
          const key = rowKey(record);
          const value =
            key in draftDates ? draftDates[key] : parseApiDate(record.chq_clrd_date);
          const saved = record.chq_clrd_date ? record.chq_clrd_date.slice(0, 10) : null;
          const draft = value ? formatDateYYYYMMDD(value) : null;
          const utrDraft = (key in draftUtrs ? draftUtrs[key] : record.utr_no ?? "").trim();
          const utrSaved = (record.utr_no ?? "").trim();
          const dirty = draft !== saved || utrDraft !== utrSaved;
          const rowBusy = savingKey === key || isBulkSaving;
          return (
            <Group gap={4} wrap="nowrap">
              <SingleDateInput
                value={value}
                onChange={(date) =>
                  setDraftDates((prev) => ({
                    ...prev,
                    [key]: date,
                  }))
                }
                size="xs"
                disabled={rowBusy}
                popoverProps={{position: 'bottom-end', withinPortal: true, zIndex: 400 }}
                styles={{
                  input: {
                    width: 130,
                    fontFamily: V0_FONT_SANS,
                    fontSize: 12,
                    height: 28,
                    minHeight: 28,
                  },
                }}
              />
              <ActionIcon
                size={28}
                variant="filled"
                color="#105476"
                aria-label="Save"
                disabled={!dirty || rowBusy}
                loading={savingKey === key}
                onClick={() => void saveClearanceDate(record)}
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Group>
          );
        }
        if (col.key === "date" || col.key === "cheque_date") {
          return displayDate(record[col.key], String(dateFormat)) || "—";
        }
        if (col.key === "amount" || col.key === "local_amount") {
          return displayAmount(record[col.key]) || "—";
        }
        if (col.key === "party_name") {
          const name = String(record.party_name ?? "").trim();
          if (!name) return "—";
          return <OverflowTooltipText text={name} />;
        }
        const text = record[col.key as keyof ChequeClearanceRow];
        if (text == null || String(text).trim() === "") return "—";
        return String(text);
      },
    }));
  }, [dateFormat, draftDates, draftUtrs, isBulkSaving, pagination.pageIndex, pagination.pageSize, saveClearanceDate, savingKey, visibleColumns]);

  const rightPinnedColumns = useMemo(() => {
    const pinned: string[] = [];
    if (visibleColumns.utr_no !== false) pinned.push("utr_no");
    if (visibleColumns.chq_clrd_date !== false) pinned.push("chq_clrd_date");
    return pinned;
  }, [visibleColumns]);

  const pinnedColumnStyle = (columnId: string, header: boolean) => {
    const index = rightPinnedColumns.indexOf(columnId);
    if (index < 0) return {};
    let right = 0;
    for (let i = index + 1; i < rightPinnedColumns.length; i += 1) {
      right += rightPinnedColumns[i] === "chq_clrd_date" ? DATE_PIN_WIDTH : UTR_PIN_WIDTH;
    }
    const width = columnId === "chq_clrd_date" ? DATE_PIN_WIDTH : UTR_PIN_WIDTH;
    return {
      position: "sticky" as const,
      right,
      zIndex: header ? 5 : 2,
      minWidth: width,
      width,
      borderLeft: columnId === "chq_clrd_date" ? undefined : `1px solid ${border}`,
      boxShadow: index === 0 ? "-6px 0 8px -6px rgba(15, 23, 42, 0.18)" : undefined,
    };
  };

  const table = useMantineReactTable({
    columns,
    data: pagedRows,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    layoutMode: "grid",
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: rows.length,
    state: {
      pagination,
      columnPinning: {
        right: rightPinnedColumns,
      },
    },
    getRowId: (row) => rowKey(row),
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { minWidth: 1240 },
    },
    mantinePaperProps: {
      shadow: "none",
      p: 0,
      radius: 0,
      withBorder: false,
      style: {
        backgroundColor: "transparent",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      const pinned = pinnedColumnStyle(column.id, false);
      return {
        style: {
          padding: "6px",
          fontSize: 13,
          fontFamily: V0_FONT_SANS,
          color: muted,
          backgroundColor: erpTheme.cardBg,
          borderBottom: `1px solid ${border}`,
          ...pinned,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const pinned = pinnedColumnStyle(column.id, true);
      return {
        style: {
          position: "sticky" as const,
          top: 0,
          zIndex: column.id === "utr_no" || column.id === "chq_clrd_date" ? 5 : 3,
          padding: "6px",
          fontSize: 13,
          fontFamily: V0_FONT_SANS,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          borderBottom: `1px solid ${border}`,
          whiteSpace: "nowrap",
          ...pinned,
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        flex: 1,
        height: "100%",
        minHeight: 0,
        overflow: "auto",
      },
    },
  });

  const appliedFilterItems = useMemo(() => {
    if (!appliedFilters) return [];
    const statusLabel =
      appliedFilters.cheque_status === "UNCLEARED" ? "Uncleared" : "Cleared";
    const items = [
      { key: "From", value: appliedFilters.date_from },
      { key: "To", value: appliedFilters.date_to },
      {
        key: "Account",
        value: appliedFilters.account_name
          ? `${appliedFilters.account_code} - ${appliedFilters.account_name}`
          : appliedFilters.account_code,
      },
      { key: "Cheque Status", value: statusLabel },
    ];
    if (appliedFilters.cheque_no) {
      items.splice(3, 0, { key: "Cheque No", value: appliedFilters.cheque_no });
    }
    return items;
  }, [appliedFilters]);

  return (
    <MantineProvider theme={pageTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={{
          ...erpListGeistRootTypography,
          fontFamily: V0_FONT_SANS,
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
                  value={resultTotal ?? rows.length}
                  label="Total"
                />
                {appliedFilterItems.length > 0 ? (
                  <Text size="xs" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
                    {appliedFilterItems.map((item, index) => (
                      <span key={item.key}>
                        <span style={{ fontWeight: 600 }}>{item.key}:</span> {item.value}
                        {index < appliedFilterItems.length - 1 ? " | " : ""}
                      </span>
                    ))}
                  </Text>
                ) : null}
              </>
            ),
            actions: (
              <>
                <ERPListColumnToggleMenu
                  theme={erpTheme}
                  items={columnToggleItems}
                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                />
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => {
                    if (appliedFilters) void fetchRows(appliedFilters);
                  }}
                  loading={isFetchingRows}
                  disabled={!appliedFilters || isFetchingRows}
                >
                  Refresh
                </Button>
                {dirtyRows.length > 0 ? (
                  <Button
                    size="xs"
                    styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                    leftSection={<IconCheck size={14} />}
                    onClick={() => void saveBulk()}
                    loading={isBulkSaving}
                    disabled={isBulkSaving || Boolean(savingKey) || isFetchingRows}
                  >
                    Update
                  </Button>
                ) : null}
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((open) => !open)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconArrowLeft size={14} />}
                  onClick={() => navigate(-1)}
                >
                  Back
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            compact: true,
            title: "Filters",
            onClose: () => setShowFilters(false),
            children: (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  runSearch();
                }}
              >
                <Group align="flex-start" wrap="wrap" gap="sm" style={{ padding:"16px 8px" }}>
                  <Box style={{ width: 120, flex: "1 1 110px" }}>
                    <SingleDateInput
                      label="From"
                      value={form.values.fromDate}
                      onChange={(date) => form.setFieldValue("fromDate", date)}
                      error={asStringError(form.errors.fromDate)}
                      withAsterisk
                      size="xs"
                      styles={FILTER_STYLES}
                    />
                  </Box>
                  <Box style={{ width: 120, flex: "1 1 110px" }}>
                    <SingleDateInput
                      label="To"
                      value={form.values.toDate}
                      onChange={(date) => form.setFieldValue("toDate", date)}
                      error={asStringError(form.errors.toDate)}
                      withAsterisk
                      size="xs"
                      styles={FILTER_STYLES}
                    />
                  </Box>
                  <Box style={{ flex: "2 1 240px", minWidth: 220 }}>
                    <SearchableSelect
                      label="Account"
                      apiEndpoint={URL.chartOfAccountsFilter}
                      additionalParams={{ index: "0", limit: "30" }}
                      postBody={(term) => ({
                        filters: { code_or_name: term },
                      })}
                      value={form.values.accountId}
                      dropdownZIndex={1100}
                      placeholder="Search by account code or name"
                      withAsterisk
                      minSearchLength={1}
                      size="xs"
                      searchFields={["gl_account_code", "account_name", "id"]}
                      displayFormat={(item: Record<string, unknown>) => {
                        const code = String(item.gl_account_code ?? "").trim();
                        const name = String(
                          item.account_name ?? item.gl_account_name ?? "",
                        ).trim();
                        return {
                          value: String(item.id ?? "").trim(),
                          label: [code, name].filter(Boolean).join(" - "),
                        };
                      }}
                      displayValue={
                        selectedAccount?.gl_account_code
                          ? [selectedAccount.gl_account_code, selectedAccount.account_name]
                              .filter(Boolean)
                              .join(" - ")
                          : (selectedAccount?.account_name ?? "")
                      }
                      returnOriginalData
                      onChange={(value, _selected, originalData) => {
                        if (!value || !originalData) {
                          form.setFieldValue("accountId", null);
                          form.setFieldValue("accountCode", null);
                          form.setFieldValue("subledger", "0");
                          setSelectedAccount(null);
                          return;
                        }
                        const gl = originalData.gl_account_code;
                        const sl = originalData.sl_code;
                        const subledger =
                          sl != null && String(sl).trim() !== "" ? String(sl).trim() : "0";
                        form.setFieldValue("accountId", value);
                        form.setFieldValue(
                          "accountCode",
                          gl != null ? String(gl) : null,
                        );
                        form.setFieldValue("subledger", subledger);
                        setSelectedAccount({
                          id: originalData.id != null ? Number(originalData.id) : undefined,
                          gl_account_code: gl != null ? String(gl) : undefined,
                          sl_code: subledger,
                          account_name:
                            originalData.account_name != null
                              ? String(originalData.account_name)
                              : undefined,
                        });
                      }}
                      error={asStringError(form.errors.accountId)}
                      classNames={{
                        input: ERP_LIST_GEIST_ROOT_CLASS,
                        ...erpListGeistSelectClassNames,
                      }}
                      styles={FILTER_STYLES}
                    />
                  </Box>
                  <Box style={{ width: 140, flex: "1 1 120px" }}>
                    <TextInput
                      label="Cheque No"
                      placeholder="Optional"
                      value={form.values.chequeNo}
                      onChange={(event) =>
                        form.setFieldValue("chequeNo", event.currentTarget.value)
                      }
                      size="xs"
                      styles={FILTER_STYLES}
                    />
                  </Box>
                  <Box style={{ width: 160, flex: "1 1 140px" }}>
                    <Dropdown
                      label="Cheque Status"
                      data={CHEQUE_STATUS_OPTIONS}
                      value={form.values.chequeStatus}
                      onChange={(value) =>
                        form.setFieldValue("chequeStatus", value || "UNCLEARED")
                      }
                      withAsterisk
                      size="xs"
                      dropdownZIndex={1100}
                      error={asStringError(form.errors.chequeStatus)}
                      classNames={erpListGeistSelectClassNames}
                      styles={FILTER_STYLES}
                    />
                  </Box>
                  <Group gap={8} wrap="nowrap" style={{ paddingTop: 18, width: 160, flex: "1 1 140px" }} align="center" justify="flex-end"> 
                    <Button
                      size="xs"
                      variant="outline"
                      leftSection={<IconX size={13} />}
                      styles={{
                        root: {
                          height: 32,
                          fontSize: 12,
                          borderColor: primary,
                          color: primary,
                          fontFamily: V0_FONT_SANS,
                        },
                      }}
                      onClick={clearFilters}
                    >
                      Clear
                    </Button>
                    <Button
                      type="submit"
                      size="xs"
                      leftSection={<IconFilter size={13} />}
                      loading={isFetchingRows}
                      disabled={isFetchingRows}
                      styles={{
                        root: {
                          height: 32,
                          fontSize: 12,
                          backgroundColor: primary,
                          border: "none",
                          fontFamily: V0_FONT_SANS,
                        },
                      }}
                    >
                      Search
                    </Button>
                  </Group>
                </Group>
              </form>
            ),
          }}
          table={{
            fillBody: true,
            footer:
              !isFetchingRows && rows.length > 0 ? (
                <ERPListPaginationFooter
                  theme={erpTheme}
                  totalRecords={rows.length}
                  pageIndex={pagination.pageIndex}
                  pageSize={pagination.pageSize}
                  onPageIndexChange={(index) =>
                    setPagination((prev) => ({ ...prev, pageIndex: index }))
                  }
                  onPageSizeChange={(size) =>
                    setPagination({ pageIndex: 0, pageSize: size })
                  }
                />
              ) : undefined,
            children: (
              <>
                {fetchError ? (
                  <Alert
                    mb="md"
                    color="red"
                    variant="light"
                    icon={<IconInfoCircle size={16} />}
                  >
                    {fetchError}
                  </Alert>
                ) : null}
                {isFetchingRows ? (
                  <ERPListTableLoading
                    theme={erpTheme}
                    message="Loading cheques…"
                  />
                ) : rows.length === 0 ? (
                  <ERPListTableEmpty
                    theme={erpTheme}
                    icon={<IconTable size={24} color={muted} />}
                    title="No cheques yet"
                    hint="Open filters, choose the date range, account, and cheque status, then run Search"
                  />
                ) : (
                  <Box
                    style={{
                      flex: 1,
                      minHeight: 0,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    className={ERP_LIST_GEIST_ROOT_CLASS}
                  >
                    <MantineReactTable table={table} />
                  </Box>
                )}
              </>
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}
