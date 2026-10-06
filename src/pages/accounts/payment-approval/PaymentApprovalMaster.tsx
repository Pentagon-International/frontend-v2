import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatCurrencyAmountForUi,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_ExpandedState,
  type MRT_PaginationState,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Grid,
  Loader,
  MantineProvider,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconCreditCard,
  IconEye,
  IconEyeOff,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { URL } from "../../../api/serverUrls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Dropdown,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import PaymentApprovalAllocationsTable from "./components/PaymentApprovalAllocationsTable";
import ApprovePaymentsConfirmModal from "./components/ApprovePaymentsConfirmModal";
import {
  paymentApprovalColumnDefault,
  paymentApprovalColumnLabels,
  type PaymentApprovalColumnVisibility,
  type PaymentApprovalFilters,
  type PaymentApprovalRow,
} from "./types";

const LIST_KEY = "PAYMENT_APPROVAL_MASTER";
const TYPE_OPTIONS = ["CHEQUE", "ONLINE", "CASH", "NEFT"];
const APPROVAL_STATUS_OPTIONS = ["PENDING", "APPROVED"];

function getPartyNames(row: PaymentApprovalRow): string[] {
  const parties = Array.isArray(row.parties) ? row.parties : [];
  const names = parties
    .map((p) => String(p?.subledger_name ?? "").trim())
    .filter(Boolean);
  return [...new Set(names)];
}

function TruncatedNameCell({
  fullText,
  displayText,
  fontFamily,
}: {
  fullText: string;
  displayText: string;
  fontFamily: string;
}) {
  if (!fullText) return <Text size="sm">-</Text>;
  const showTooltip = fullText !== displayText || fullText.length >= 24;
  return (
    <Tooltip
      label={fullText}
      multiline
      maw={400}
      withArrow
      disabled={!showTooltip}
      styles={{ tooltip: { fontFamily, fontSize: 12, whiteSpace: "pre-wrap" } }}
    >
      <Text
        size="sm"
        lineClamp={1}
        style={{ cursor: showTooltip ? "default" : undefined }}
      >
        {displayText}
      </Text>
    </Tooltip>
  );
}

function columnId(col: MRT_ColumnDef<PaymentApprovalRow>): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

function paymentIdOf(row: PaymentApprovalRow): number | null {
  const n = Number(row.id);
  return Number.isFinite(n) ? n : null;
}

/** True when both dates are set and fall on the same calendar day. */
function isSameFilterDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return dayjs(a).isSame(dayjs(b), "day");
}

export default function PaymentApprovalMaster() {
  const user = useAuthStore((s) => s.user);
  const canAccess = Boolean(user?.screen_permissions?.payment_approval_screen);
  if (!canAccess) return <Navigate to="/" replace />;
  return <PaymentApprovalMasterContent />;
}

function PaymentApprovalMasterContent() {
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const queryClient = useQueryClient();
  const dateFormat = useDateFormat();

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
      fontSans: "'Geist', sans-serif",
    }),
    [],
  );
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(erpTheme);

  const defaultDateFrom = dayjs().startOf("month").toDate();
  const defaultDateTo = dayjs().toDate();
  const DEFAULT_FILTERS: PaymentApprovalFilters = useMemo(
    () => ({
      day_book_id: "",
      day_book_name: "",
      payment_no: "",
      date_from: defaultDateFrom,
      date_to: defaultDateTo,
      type: "",
      approval_status: "PENDING",
      parties_account_name: "",
      amount: "",
      allocation_document_no: "",
      branch_code: "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [isRestoring, setIsRestoring] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [visibleColumns, setVisibleColumns] = useState(
    () => ({ ...paymentApprovalColumnDefault }),
  );
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<MRT_ExpandedState>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Column header shows a single date only when From/To are the same day.
  const headerDateIsSingleDay = isSameFilterDay(
    appliedFilters.date_from,
    appliedFilters.date_to,
  );
  const headerDateDisplay = headerDateIsSingleDay
    ? dayjs(appliedFilters.date_from!).format(dateFormat)
    : "";

  /** Accordion expand: only one payment row open at a time. */
  const handleExpandedChange = useCallback(
    (
      updater:
        | MRT_ExpandedState
        | ((old: MRT_ExpandedState) => MRT_ExpandedState),
    ) => {
      setExpanded((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (next === true) return prev;
        if (!next || next === false) return {};
        const opened = Object.entries(next)
          .filter(([, isOpen]) => Boolean(isOpen))
          .map(([id]) => id);
        if (opened.length === 0) return {};
        if (opened.length === 1) return { [opened[0]]: true };
        const prevObj =
          typeof prev === "object" && prev && prev !== true ? prev : {};
        const newlyOpened = opened.find((id) => !prevObj[id as keyof typeof prevObj]);
        return { [newlyOpened ?? opened[opened.length - 1]]: true };
      });
    },
    [],
  );

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const openHeaderEditor = useCallback((id: string) => setEditingHeaderId(id), []);
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );

  const commitHeaderFilters = useCallback(
    (updater: (prev: PaymentApprovalFilters) => PaymentApprovalFilters) => {
      setDraftFilters((prev) => {
        const next = updater(prev);
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, next);
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setStoreFilters],
  );

  useEffect(() => {
    if (isRestoring) return;
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
    );
  }, [debouncedSearch, isRestoring]);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    if (stored?.shouldRestore !== true) {
      setIsRestoring(false);
      return;
    }
    if (typeof stored?.search === "string") setSearch(stored.search);
    if (stored?.filters && typeof stored.filters === "object") {
      const raw = stored.filters as Record<string, unknown>;
      const restored: PaymentApprovalFilters = {
        ...DEFAULT_FILTERS,
        ...(raw as Partial<PaymentApprovalFilters>),
        date_from: raw.date_from
          ? new Date(String(raw.date_from))
          : DEFAULT_FILTERS.date_from,
        date_to: raw.date_to
          ? new Date(String(raw.date_to))
          : DEFAULT_FILTERS.date_to,
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const index = pagination.pageIndex * pagination.pageSize;

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildFiltersPayload = useCallback(
    (filters: PaymentApprovalFilters, searchValue: string) => {
      // Document status is always exact POSTED on this screen; approval_status comes from filters (default PENDING).
      const cleaned: Record<string, string> = { status_exact: "POSTED" };
      Object.entries(filters).forEach(([key, value]) => {
        if (key === "day_book_name") return;
        if (key === "date_from" && value) {
          cleaned.date_from = dayjs(value as Date).format("YYYY-MM-DD");
        } else if (key === "date_to" && value) {
          cleaned.date_to = dayjs(value as Date).format("YYYY-MM-DD");
        } else if (typeof value === "string" && value.trim() !== "") {
          cleaned[key] = value.trim();
        }
      });
      if (searchValue?.trim()) cleaned.search = searchValue.trim();
      return cleaned;
    },
    [],
  );

  // Stable query key from the real API payload (dates as YYYY-MM-DD) — avoids
  // Date-object stringify quirks and ensures filter/clear always refetch.
  const filtersQueryKey = useMemo(
    () => JSON.stringify(buildFiltersPayload(appliedFilters, debouncedSearch)),
    [appliedFilters, debouncedSearch, buildFiltersPayload],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: [
      "payment-approval",
      pagination.pageIndex,
      pagination.pageSize,
      filtersQueryKey,
    ],
    queryFn: async () => {
      const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
      const response = (await apiCallProtected.post(
        `${URL.paymentFilter}?index=${index}&limit=${pagination.pageSize}`,
        {
          filters: { ...filtersPayload },
          ordering: "-updated_at",
        },
      )) as Record<string, unknown>;

      const raw = response as any;
      const bodyCandidate =
        raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
      const listRaw = Array.isArray(bodyCandidate?.data)
        ? (bodyCandidate.data as PaymentApprovalRow[])
        : Array.isArray(bodyCandidate)
          ? (bodyCandidate as PaymentApprovalRow[])
          : [];

      // Backend POSTED filter also returns FULLY REVERSED — keep exact POSTED only.
      const list = listRaw.filter(
        (r) => String(r.status ?? "").toUpperCase() === "POSTED",
      );

      const totalEnvelope =
        bodyCandidate != null &&
        typeof bodyCandidate === "object" &&
        !Array.isArray(bodyCandidate) &&
        ("total" in bodyCandidate || "index" in bodyCandidate)
          ? (bodyCandidate as Record<string, unknown>)
          : (raw as Record<string, unknown>);
      const listTotal = getBookingShipmentFilterListTotal(
        totalEnvelope,
        listRaw,
        index,
      );
      // Return total with the result — do not rely on side-effect state that can
      // stay stale when React Query serves/memoizes prior query data.
      return { data: list, total: listTotal };
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  // Derive from the active query result only (no separate memoized total state).
  const tableData = listResult?.data ?? [];
  const totalRecords = listResult?.total ?? 0;
  const loading = isLoading || isFetching;

  // Keep page index in range when filter/clear shrinks the result set.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const approveMutation = useMutation({
    mutationFn: async (paymentIds: number[]) => {
      const res = (await apiCallProtected.post(URL.paymentBulkApprovalStatus, {
        payment_ids: paymentIds,
      })) as { status?: boolean; message?: string };
      if (res?.status === false) {
        throw new Error(res.message || "Approval failed.");
      }
      return res;
    },
    onSuccess: (res) => {
      ToastNotification({
        type: "success",
        message: res?.message || "Payment(s) approved successfully.",
      });
      setSelectedIds(new Set());
      setConfirmOpen(false);
      setExpanded({});
      void queryClient.invalidateQueries({ queryKey: ["payment-approval"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to approve payment(s). Please try again.";
      ToastNotification({ type: "error", message });
    },
  });

  const pageIds = useMemo(
    () => tableData.map(paymentIdOf).filter((id): id is number => id != null),
    [tableData],
  );
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const toggleSelectAllPage = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) pageIds.forEach((id) => next.add(id));
        else pageIds.forEach((id) => next.delete(id));
        return next;
      });
    },
    [pageIds],
  );

  const toggleSelectOne = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const columnToggleItems = useMemo(
    () =>
      (
        Object.keys(visibleColumns) as (keyof PaymentApprovalColumnVisibility)[]
      ).map((key) => ({
        id: String(key),
        label: paymentApprovalColumnLabels[key],
        checked: visibleColumns[key],
        onToggle: () =>
          setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] })),
      })),
    [visibleColumns],
  );

  const allColumns = useMemo<MRT_ColumnDef<PaymentApprovalRow>[]>(
    () => [
      {
        id: "select",
        header: "Select",
        size: 52,
        enableColumnFilter: false,
        enableSorting: false,
        Header: () => (
          <Checkbox
            aria-label="Select all on page"
            checked={allPageSelected}
            indeterminate={somePageSelected}
            onChange={(e) => toggleSelectAllPage(e.currentTarget.checked)}
          />
        ),
        Cell: ({ row }) => {
          const id = paymentIdOf(row.original);
          if (id == null) return null;
          return (
            <Checkbox
              aria-label={`Select payment ${row.original.payment_no ?? id}`}
              checked={selectedIds.has(id)}
              onChange={(e) => toggleSelectOne(id, e.currentTarget.checked)}
            />
          );
        },
      },
      {
        id: "sno",
        header: "S.No",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => row.original?.sno ?? index + row.index + 1,
      },
      {
        accessorKey: "day_book_name",
        header: "Day Book",
        size: 140,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Day Book"
            value={appliedFilters.day_book_id}
            displayValue={appliedFilters.day_book_name}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "day_book_name"}
            onStartEdit={() => openHeaderEditor("day_book_name")}
            onStopEdit={() => collapseHeaderEditor("day_book_name")}
            renderEditor={({ autoFocus, onClose }) => (
              <SearchableSelect
                apiEndpoint={URL.daybookGet}
                placeholder="Day Book"
                value={appliedFilters.day_book_id}
                displayValue={appliedFilters.day_book_name}
                onChange={(val, selectedData) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    day_book_id: val || "",
                    day_book_name: selectedData?.label || "",
                  }));
                  if (val) onClose();
                }}
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.name ?? ""),
                })}
                searchFields={["name"]}
                size="xs"
                autoFocus={autoFocus}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
            )}
          />
        ),
        Cell: ({ row }) => {
          const fullText = String(row.original.day_book_name ?? "").trim();
          const displayText =
            fullText.length > 18 ? `${fullText.slice(0, 18)}...` : fullText;
          return (
            <TruncatedNameCell
              fullText={fullText}
              displayText={displayText || "-"}
              fontFamily={erpTheme.fontSans}
            />
          );
        },
      },
      {
        id: "party_name",
        header: "Vendor name",
        size: 150,
        enableSorting: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Vendor name"
            value={appliedFilters.parties_account_name}
            displayValue={appliedFilters.parties_account_name}
            theme={erpTheme}
            placeholder="Filter Vendor name"
            isEditing={editingHeaderId === "party_name"}
            onStartEdit={() => openHeaderEditor("party_name")}
            onStopEdit={() => collapseHeaderEditor("party_name")}
            onChange={(nextVal) =>
              commitHeaderFilters((prev) => ({
                ...prev,
                parties_account_name: nextVal || "",
              }))
            }
          />
        ),
        Cell: ({ row }) => {
          const names = getPartyNames(row.original);
          const fullText = names.join(", ");
          const displayText =
            names.length === 0
              ? "-"
              : names.length === 1
                ? names[0].length > 18
                  ? `${names[0].slice(0, 18)}...`
                  : names[0]
                : `${names[0]}...`;
          return (
            <TruncatedNameCell
              fullText={fullText}
              displayText={displayText}
              fontFamily={erpTheme.fontSans}
            />
          );
        },
      },
      {
        accessorKey: "payment_no",
        header: "Payment No",
        size: 140,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Payment No"
            value={appliedFilters.payment_no}
            displayValue={appliedFilters.payment_no}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "payment_no"}
            onStartEdit={() => openHeaderEditor("payment_no")}
            onStopEdit={() => collapseHeaderEditor("payment_no")}
            renderEditor={({ autoFocus, onClose }) => (
              <SearchableSelect
                apiEndpoint={URL.payment}
                placeholder="Payment No"
                value={appliedFilters.payment_no}
                onChange={(val) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    payment_no: val || "",
                  }));
                  if (val) onClose();
                }}
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.payment_no ?? ""),
                  label: String(item.payment_no ?? ""),
                })}
                searchFields={["payment_no"]}
                size="xs"
                autoFocus={autoFocus}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
            )}
          />
        ),
      },
      {
        accessorKey: "date",
        header: "PMT Date",
        size: 120,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="PMT Date"
            value={headerDateDisplay}
            displayValue={headerDateDisplay}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "date"}
            onStartEdit={() => openHeaderEditor("date")}
            onStopEdit={() => collapseHeaderEditor("date")}
            renderEditor={({ onClose }) => (
              <SingleDateInput
                value={
                  headerDateIsSingleDay ? appliedFilters.date_from : null
                }
                onChange={(date) => {
                  if (date) {
                    commitHeaderFilters((prev) => ({
                      ...prev,
                      date_from: date,
                      date_to: date,
                    }));
                    onClose();
                  } else {
                    // Clear → restore default date range (not an empty range).
                    commitHeaderFilters((prev) => ({
                      ...prev,
                      date_from: DEFAULT_FILTERS.date_from,
                      date_to: DEFAULT_FILTERS.date_to,
                    }));
                  }
                }}
                placeholder="PMT Date"
                size="xs"
                allowDeselection
                classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                styles={{
                  ...filterFieldStyles,
                  input: { ...filterFieldStyles.input, minHeight: 26 },
                }}
                popoverProps={{ zIndex: 1000 }}
              />
            )}
          />
        ),
        Cell: ({ row }) => (
          <Text size="sm">
            {row.original.date
              ? dayjs(String(row.original.date)).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "type",
        header: "PMT Type",
        size: 100,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="PMT Type"
            value={appliedFilters.type}
            displayValue={appliedFilters.type}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "type"}
            onStartEdit={() => openHeaderEditor("type")}
            onStopEdit={() => collapseHeaderEditor("type")}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                placeholder="Select Type"
                searchable
                clearable
                size="xs"
                data={TYPE_OPTIONS}
                value={appliedFilters.type || ""}
                onChange={(value) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    type: value || "",
                  }));
                  if (value) onClose();
                }}
                comboboxProps={{ zIndex: 1000 }}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
            )}
          />
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 120,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Amount"
            value={appliedFilters.amount}
            displayValue={appliedFilters.amount}
            theme={erpTheme}
            placeholder="Filter Amount"
            isEditing={editingHeaderId === "amount"}
            onStartEdit={() => openHeaderEditor("amount")}
            onStopEdit={() => collapseHeaderEditor("amount")}
            onChange={(nextVal) =>
              commitHeaderFilters((prev) => ({
                ...prev,
                amount: nextVal || "",
              }))
            }
          />
        ),
        Cell: ({ cell }) => {
          const val = cell.getValue<unknown>();
          if (val == null || val === "") return "-";
          const n = typeof val === "number" ? val : parseFloat(String(val));
          return Number.isFinite(n) ? formatCurrencyAmountForUi(n) : String(val);
        },
      },
      {
        accessorKey: "status",
        header: "PMT Status",
        size: 110,
        enableColumnFilter: false,
        Cell: ({ cell }) => {
          const str = String(cell.getValue<unknown>() ?? "");
          if (!str) return "-";
          return (
            <Badge
              size="sm"
              variant="light"
              color="green"
              styles={{ root: { textTransform: "none" } }}
            >
              {str}
            </Badge>
          );
        },
      },
      {
        accessorKey: "approval_status",
        header: "Approval Status",
        size: 140,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Approval Status"
            value={appliedFilters.approval_status}
            displayValue={appliedFilters.approval_status}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "approval_status"}
            onStartEdit={() => openHeaderEditor("approval_status")}
            onStopEdit={() => collapseHeaderEditor("approval_status")}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                placeholder="Select Approval Status"
                searchable
                clearable
                size="xs"
                data={APPROVAL_STATUS_OPTIONS}
                value={appliedFilters.approval_status || ""}
                onChange={(value) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    approval_status: value || "",
                  }));
                  if (value) onClose();
                }}
                comboboxProps={{ zIndex: 1000 }}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
            )}
          />
        ),
        Cell: ({ cell }) => {
          const str = String(cell.getValue<unknown>() ?? "").trim();
          if (!str) return "-";
          const upper = str.toUpperCase();
          const color =
            upper === "APPROVED"
              ? "green"
              : upper === "PENDING"
                ? "yellow"
                : "#105476";
          return (
            <Badge
              size="sm"
              variant="light"
              color={color}
              styles={{ root: { textTransform: "none" } }}
            >
              {str}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 72,
        Cell: ({ row }) => {
          const isExpanded = row.getIsExpanded();
          return (
            <Tooltip
              label={isExpanded ? "Collapse" : "View allocations"}
              withArrow
            >
              <ActionIcon
                variant="subtle"
                color={primary}
                size="sm"
                aria-label={
                  isExpanded ? "Collapse allocations" : "Expand allocations"
                }
                onClick={() => row.toggleExpanded()}
              >
                {isExpanded ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </ActionIcon>
            </Tooltip>
          );
        },
      },
    ],
    [
      index,
      appliedFilters,
      erpTheme,
      dateFormat,
      primary,
      editingHeaderId,
      filterFieldStyles,
      selectedIds,
      allPageSelected,
      somePageSelected,
      openHeaderEditor,
      collapseHeaderEditor,
      commitHeaderFilters,
      toggleSelectAllPage,
      toggleSelectOne,
      headerDateDisplay,
      headerDateIsSingleDay,
      DEFAULT_FILTERS.date_from,
      DEFAULT_FILTERS.date_to,
    ],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = columnId(col);
        if (id === "actions" || id === "select") return true;
        return visibleColumns[id as keyof PaymentApprovalColumnVisibility] !== false;
      }),
    [allColumns, visibleColumns],
  );

  // Disable row expand chrome while loading / empty so fallback matches Payment List.
  const hasTableRows = !loading && tableData.length > 0;

  const table = useMantineReactTable({
    columns,
    data: loading ? [] : tableData,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    enableExpanding: hasTableRows,
    enableExpandAll: false,
    getRowCanExpand: () => hasTableRows,
    getRowId: (row) => String(row.id ?? ""),
    onExpandedChange: handleExpandedChange,
    renderDetailPanel: hasTableRows
      ? ({ row }) => (
          <PaymentApprovalAllocationsTable
            allocations={
              Array.isArray(row.original.allocations)
                ? row.original.allocations
                : []
            }
          />
        )
      : undefined,
    initialState: {
      pagination: { pageSize: 25, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
      columnVisibility: { "mrt-row-expand": false },
    },
    layoutMode: "grid",
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: totalRecords,
    state: {
      pagination,
      expanded: hasTableRows ? expanded : {},
    },
    renderEmptyRowsFallback: () => (
      <Center
        py={80}
        style={{ width: "100%", backgroundColor: cardBg }}
        className="erp-header-filter-fade"
      >
        {loading ? (
          <Stack align="center" gap="md">
            <Loader size="lg" color={primary} />
            <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              Loading payment data…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            No payment data found
          </Text>
        )}
      </Center>
    ),
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
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        backgroundColor: "transparent",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      const colSize = column.getSize();
      const isActions = column.id === "actions";
      const isTruncated =
        column.id === "day_book_name" || column.id === "party_name";
      return {
        style: {
          width: colSize,
          minWidth: isTruncated ? 100 : colSize,
          maxWidth: isTruncated ? colSize : undefined,
          overflow: isTruncated ? "hidden" : undefined,
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: cardBg,
          ...(isActions
            ? {
                position: "sticky" as const,
                right: 0,
                minWidth: "72px",
                zIndex: 2,
                borderLeft: `1px solid ${border}`,
                boxShadow: "1px -2px 4px 0px #00000040",
              }
            : {}),
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const colSize = column.getSize();
      const isActions = column.id === "actions";
      const isTruncated =
        column.id === "day_book_name" || column.id === "party_name";
      return {
        style: {
          width: colSize,
          minWidth: isTruncated ? 100 : colSize,
          maxWidth: isTruncated ? colSize : undefined,
          overflow: isTruncated ? "hidden" : undefined,
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          borderBottom: `1px solid ${border}`,
          minHeight: 52,
          height: 52,
          verticalAlign: "middle" as const,
          position: "sticky" as const,
          top: 0,
          zIndex: isActions ? 4 : 3,
          ...(isActions
            ? {
                right: 0,
                minWidth: "72px",
                backgroundColor: erpTheme.headerBg,
                boxShadow: "0px -2px 4px 0px #00000040",
              }
            : {}),
        },
      };
    },
    mantineTableHeadProps: {
      style: {
        position: "sticky",
        top: 0,
        zIndex: 3,
        backgroundColor: erpTheme.headerBg,
      },
    },
    // Constrain scroll to this container so sticky headers work (avoid outer card scroll).
    mantineTableContainerProps: {
      style: {
        flex: 1,
        minHeight: 0,
        height: "100%",
        maxHeight: "100%",
        position: "relative",
        overflow: "auto",
      },
    },
  });

  const selectedCount = selectedIds.size;
  const handlePageSizeChange = (newPageSize: number) =>
    setPagination({ pageIndex: 0, pageSize: newPageSize });

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={{
          ...erpListGeistRootTypography,
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
                  icon={<IconCreditCard size={14} color={primary} />}
                  value={totalRecords}
                  label="Pending"
                />
                {selectedCount > 0 ? (
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCircleCheck size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={selectedCount}
                    label="Selected"
                  />
                ) : null}
              </>
            ),
            actions: (
              <>
                {selectedCount > 0 ? (
                  <Button
                    size="xs"
                    leftSection={<IconCircleCheck size={14} />}
                    styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Approve ({selectedCount})
                  </Button>
                ) : null}
                <TextInput
                  placeholder="Search…"
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        style={{ cursor: "pointer" }}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    ) : null
                  }
                  w={260}
                  size="xs"
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
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
                  menuStyles={erpListGeistMenuDropdownStyles}
                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                />
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
            subtitle:
              "POSTED payments — refine by approval status, day book, vendor, dates, or document",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={loading}
                applyDisabled={loading}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      apiEndpoint={URL.daybookGet}
                      label="Day Book"
                      placeholder="Type Day Book"
                      value={draftFilters.day_book_id}
                      displayValue={draftFilters.day_book_name}
                      onChange={(val, selectedData) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          day_book_id: val || "",
                          day_book_name: selectedData?.label || "",
                        }))
                      }
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item) => ({
                        value: String(item.id ?? ""),
                        label: String(item.name ?? ""),
                      })}
                      searchFields={["name"]}
                      size="xs"
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      apiEndpoint={URL.payment}
                      label="Payment No"
                      placeholder="Type Payment No"
                      value={draftFilters.payment_no}
                      onChange={(val) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          payment_no: val || "",
                        }))
                      }
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item) => ({
                        value: String(item.payment_no ?? ""),
                        label: String(item.payment_no ?? ""),
                      })}
                      searchFields={["payment_no"]}
                      size="xs"
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="PMT Date From"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_from}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({ ...prev, date_from: date }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="PMT Date To"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_to}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({ ...prev, date_to: date }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="PMT Type"
                      placeholder="Select PMT Type"
                      data={TYPE_OPTIONS}
                      searchable
                      value={draftFilters.type || null}
                      onChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          type: value || "",
                        }))
                      }
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="Approval Status"
                      placeholder="Select Approval Status"
                      data={APPROVAL_STATUS_OPTIONS}
                      searchable
                      clearable
                      value={draftFilters.approval_status || null}
                      onChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          approval_status: value || "",
                        }))
                      }
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <TextInput
                      size="xs"
                      label="Vendor name"
                      placeholder="Vendor account name"
                      value={draftFilters.parties_account_name}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          parties_account_name: e.currentTarget.value,
                        }))
                      }
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <TextInput
                      size="xs"
                      label="Amount"
                      placeholder="e.g. 1000.00"
                      value={draftFilters.amount}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          amount: e.currentTarget.value,
                        }))
                      }
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <TextInput
                      size="xs"
                      label="Allocation document no"
                      placeholder="e.g. CRJ2609MUM0055"
                      value={draftFilters.allocation_document_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          allocation_document_no: e.currentTarget.value,
                        }))
                      }
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <TextInput
                      size="xs"
                      label="Branch code"
                      placeholder="e.g. MUM"
                      value={draftFilters.branch_code}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          branch_code: e.currentTarget.value,
                        }))
                      }
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
              </Grid>
            ),
          }}
          table={{
            footer: (
              <ERPListPaginationFooter
                theme={erpTheme}
                totalRecords={totalRecords}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                onPageIndexChange={(idx) =>
                  setPagination((prev) => ({ ...prev, pageIndex: idx }))
                }
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={["10", "25", "50"]}
                selectClassNames={erpListGeistSelectClassNames}
              />
            ),
            children: error ? (
              <Center
                py="xl"
                style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}
              >
                <Text
                  size="sm"
                  c="dimmed"
                  style={{ fontFamily: erpTheme.fontSans }}
                >
                  Error loading payment approval data. Please refresh the page.
                </Text>
              </Center>
            ) : (
              <Box
                style={{
                  position: "relative",
                  height: "100%",
                  minHeight: 0,
                }}
              >
                <Box
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <MantineReactTable table={table} />
                </Box>
              </Box>
            ),
          }}
        />
      </Box>

      <ApprovePaymentsConfirmModal
        opened={confirmOpen}
        loading={approveMutation.isPending}
        count={selectedCount}
        onClose={() => {
          if (!approveMutation.isPending) setConfirmOpen(false);
        }}
        onConfirm={() => {
          const ids = Array.from(selectedIds);
          if (ids.length) approveMutation.mutate(ids);
        }}
      />
    </MantineProvider>
  );
}
