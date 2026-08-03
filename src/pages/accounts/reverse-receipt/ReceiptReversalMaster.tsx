import { useCallback, useEffect, useMemo, useState } from "react";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountBound,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconClock,
  IconCoin,
  IconDots,
  IconEdit,
  IconEye,
  IconFilter,
  IconReceipt,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
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
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";

const LIST_KEY = "RECEIPT_REVERSAL_MASTER";

type ReceiptRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  day_book_name?: string;
  receipt_no?: string;
  reverse_receipt_no?: string;
  original_doc_no?: string;
  type?: string;
  status?: string;
  amount?: number | string;
  [key: string]: unknown;
};

/** `summary` on `reverseReceiptFilter` (totals are filter-scoped). */
type ReversalListSummary = {
  total_shipments?: number;
  status_counts?: {
    posted?: number;
    unposted?: number;
  };
};

type ReversalListQueryResult = {
  data: ReceiptRow[];
  summary?: ReversalListSummary;
};

type ReceiptFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  data?: ReceiptRow[];
  summary?: ReversalListSummary;
};

type ReceiptReversalFilters = {
  day_book_id: string;
  day_book_name: string;
  receipt_no: string;
  original_doc_no: string;
  date_from: Date | null;
  date_to: Date | null;
  type: string;
  amount: string;
  status: string;
};

type ReceiptReversalColumnVisibility = {
  sno: boolean;
  day_book_name: boolean;
  reverse_receipt_no: boolean;
  original_doc_no: boolean;
  date: boolean;
  type: boolean;
  amount: boolean;
  status: boolean;
};

const receiptReversalColumnDefault: ReceiptReversalColumnVisibility = {
  sno: true,
  day_book_name: true,
  reverse_receipt_no: true,
  original_doc_no: true,
  date: true,
  type: true,
  amount: true,
  status: true,
};

const receiptReversalColumnLabels: Record<keyof ReceiptReversalColumnVisibility, string> = {
  sno: "S.No",
  day_book_name: "Day Book",
  reverse_receipt_no: "Reverse Receipt No",
  original_doc_no: "Receipt No",
  date: "Date",
  type: "Type",
  amount: "Amount",
  status: "Status",
};

function reversalColumnId(
  col: MRT_ColumnDef<ReceiptRow>,
): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

export default function ReceiptReversalMaster() {
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const navigate = useNavigate();
  const location = useLocation();
  const defaultDateFrom = dayjs().startOf("month").toDate();
  const defaultDateTo = dayjs().toDate();
  const dateFormat = useDateFormat();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: ReceiptReversalFilters = {
    day_book_id: "",
    day_book_name: "",
    receipt_no: "",
    original_doc_no: "",
    date_from: defaultDateFrom,
    date_to: defaultDateTo,
    type: "",
    amount: "",
    status: "",
  };
  const [draftFilters, setDraftFilters] =
    useState<ReceiptReversalFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ReceiptReversalFilters>(DEFAULT_FILTERS);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);

  const [visibleColumns, setVisibleColumns] = useState<ReceiptReversalColumnVisibility>(
    () => ({ ...receiptReversalColumnDefault }),
  );

  /**
   * Column-header filtering: which header is currently in "edit" mode.
   * Mirrors the EnquiryMaster click-to-filter UX.
   */
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId(id);
  }, []);
  const collapseHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId((cur) => (cur === id ? null : cur));
  }, []);

  /**
   * Header-filter writes update BOTH draftFilters and appliedFilters at once
   * (instant filtering), reset pagination, and persist to the global store so
   * filters survive navigation to associated pages.
   */
  const commitHeaderFilters = useCallback(
    (updater: (prev: ReceiptReversalFilters) => ReceiptReversalFilters) => {
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
    const shouldRestore = stored?.shouldRestore === true;
    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }
    if (typeof stored?.search === "string") setSearch(stored.search);
    if (stored?.filters && typeof stored.filters === "object") {
      const raw = stored.filters as Record<string, unknown>;
      const restored = {
        ...DEFAULT_FILTERS,
        ...raw,
        date_from: raw.date_from ? new Date(String(raw.date_from)) : DEFAULT_FILTERS.date_from,
        date_to: raw.date_to ? new Date(String(raw.date_to)) : DEFAULT_FILTERS.date_to,
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const index = pagination.pageIndex * pagination.pageSize;
  const typeOptions = ["CHEQUE", "ONLINE", "CASH", "NEFT"];
  const statusOptions = ["POSTED", "UNPOSTED"];
  const handlePageSizeChange = (newPageSize: number) =>
    setPagination({ pageIndex: 0, pageSize: newPageSize });
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
  const buildFiltersPayload = (
    filters: ReceiptReversalFilters,
    searchValue: string,
  ) => {
    const cleaned = Object.entries(filters).reduce((acc, [key, value]) => {
      if (key === "day_book_name") return acc;
      if (key === "date_from" && value) acc.date_from = dayjs(value as Date).format("YYYY-MM-DD");
      else if (key === "date_to" && value) acc.date_to = dayjs(value as Date).format("YYYY-MM-DD");
      else if (typeof value === "string" && value.trim() !== "") acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    if (searchValue?.trim()) cleaned.search = searchValue;
    return cleaned;
  };

  const {
    data: receiptListResult,
    isLoading: receiptLoading,
    isFetching: receiptFetching,
    error: receiptError,
  } = useQuery<ReversalListQueryResult>({
    queryKey: [
      "receipt-reversal",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<ReversalListQueryResult> => {
      try {
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
        const payload =
          Object.keys(filtersPayload).length > 0
            ? { filters: { ...filtersPayload } }
            : {};
        setIsInitialLoad(false);
        const response = (await apiCallProtected.post(
          `${URL.reverseReceiptFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        )) as Record<string, unknown>;

        const raw = response as any;
        const bodyCandidate = raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate != null ? (bodyCandidate as ReceiptFilterResponse | ReceiptRow[]) : null;
        if (!body) {
          setTotalRecords(0);
          return { data: [], summary: undefined };
        }
        const list = Array.isArray((body as ReceiptFilterResponse).data)
          ? ((body as ReceiptFilterResponse).data as ReceiptRow[])
          : Array.isArray(body) ? (body as ReceiptRow[]) : [];
        const totalEnvelope =
          body != null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          ("total" in body || "index" in body)
            ? (body as unknown as Record<string, unknown>)
            : (raw as Record<string, unknown>);
        const listTotal = getBookingShipmentFilterListTotal(totalEnvelope, list, index);
        const rawSummary = raw?.summary;
        const summary: ReversalListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? (rawSummary as ReversalListSummary)
            : undefined;
        const summaryTotal = summary?.total_shipments;
        const total =
          typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
            ? summaryTotal
            : listTotal;
        setTotalRecords(total);
        return { data: list, summary };
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setTotalRecords(0);
          return { data: [], summary: undefined };
        }
        throw err;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const receiptData = receiptListResult?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const isLoading = receiptFetching || receiptLoading || isInitialLoad;
  const tableData = receiptData ?? [];

  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#105476";
  const pageBg = "#F0F4F8";
  const cardBg = "#ffffff";
  const erpTheme: ErpListTheme = {
    border,
    muted,
    fg,
    primary,
    headerBg: "#f8fafc",
    pageBg,
    cardBg,
    fontSans: "'Geist', sans-serif",
  };

  const listStats = useMemo(() => {
    let pageAmount = 0;
    for (const r of tableData) {
      const a = Number(r.amount);
      if (!Number.isNaN(a)) pageAmount += a;
    }
    const summary = receiptListResult?.summary;
    if (summary) {
      const sc = summary.status_counts ?? {};
      return {
        total: summary.total_shipments ?? totalRecords,
        posted: sc.posted ?? 0,
        unposted: sc.unposted ?? 0,
        pageAmount,
      };
    }
    let posted = 0;
    let unposted = 0;
    for (const r of tableData) {
      const s = String(r.status ?? "").toUpperCase();
      if (s === "POSTED") posted += 1;
      else if (s === "UNPOSTED") unposted += 1;
    }
    return { total: totalRecords, posted, unposted, pageAmount };
  }, [tableData, receiptListResult?.summary, totalRecords]);

  const filterFieldStyles = erpListFilterUnifiedMantineStyles(erpTheme);

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof ReceiptReversalColumnVisibility)[]).map(
        (key) => ({
          id: String(key),
          label: receiptReversalColumnLabels[key],
          checked: visibleColumns[key],
          onToggle: () =>
            setVisibleColumns((prev) => ({
              ...prev,
              [key]: !prev[key],
            })),
        }),
      ),
    [visibleColumns],
  );

  const allColumns = useMemo<MRT_ColumnDef<ReceiptRow>[]>(
    () => {
      return [
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
        size: 160,
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
      },
      {
        id: "reverse_receipt_no",
        header: "Reverse Receipt No",
        size: 160,
        accessorFn: (row) =>
          (row.reverse_receipt_no ?? row.receipt_no ?? "") as string,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Reverse Receipt No"
            value={appliedFilters.receipt_no}
            displayValue={appliedFilters.receipt_no}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "reverse_receipt_no"}
            onStartEdit={() => openHeaderEditor("reverse_receipt_no")}
            onStopEdit={() => collapseHeaderEditor("reverse_receipt_no")}
            renderEditor={({ autoFocus, onClose }) => (
              <SearchableSelect
                apiEndpoint={URL.reverseReceipt}
                placeholder="Reverse Receipt No"
                value={appliedFilters.receipt_no}
                onChange={(val) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    receipt_no: val || "",
                  }));
                  if (val) onClose();
                }}
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.reverse_receipt_no ?? item.receipt_no ?? ""),
                  label: String(item.reverse_receipt_no ?? item.receipt_no ?? ""),
                })}
                searchFields={["reverse_receipt_no"]}
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
        accessorKey: "original_doc_no",
        header: "Receipt No",
        size: 160,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Receipt No"
            value={appliedFilters.original_doc_no}
            displayValue={appliedFilters.original_doc_no}
            theme={erpTheme}
            placeholder="Filter Receipt No"
            isEditing={editingHeaderId === "original_doc_no"}
            onStartEdit={() => openHeaderEditor("original_doc_no")}
            onStopEdit={() => collapseHeaderEditor("original_doc_no")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({
                ...prev,
                original_doc_no: next,
              }))
            }
          />
        ),
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "-"}</Text>
        ),
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 100,
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
        header: "Type",
        size: 100,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Type"
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
                data={typeOptions}
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
        Cell: ({ cell }) => {
          const val = cell.getValue<unknown>();
          if (val == null) return "-";
          return typeof val === "number" ? formatMoneyAmountBound(val) : String(val);
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Status"
            value={appliedFilters.status}
            displayValue={appliedFilters.status}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "status"}
            onStartEdit={() => openHeaderEditor("status")}
            onStopEdit={() => collapseHeaderEditor("status")}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                placeholder="Select Status"
                searchable
                clearable
                size="xs"
                data={statusOptions}
                value={appliedFilters.status || ""}
                onChange={(value) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    status: value || "",
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
          const val = cell.getValue<unknown>();
          if (val == null) return "-";
          const str = typeof val === "number" ? val.toFixed(2) : String(val);
          const statusUpper = str.toUpperCase();
          const color =
            statusUpper === "POSTED"
              ? "green"
              : statusUpper === "UNPOSTED"
                ? "gray"
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
        size: 80,
        Cell: ({ row }) => {
          const status = String(row.original?.status ?? "").toUpperCase();
          const isUnposted = status === "UNPOSTED";
          return (
            <Menu
              withinPortal
              position="bottom-end"
              shadow="md"
              width={200}
              styles={erpListGeistMenuDropdownStyles}
              classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
            >
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() =>{
                      setStoreFilters(LIST_KEY, appliedFilters);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate("/receipt/reversal/view", {
                        state: {
                          ...row.original,
                          documents:
                            (row.original as any)?.documents ??
                            (row.original as any)?.supporting_documents ??
                            [],
                        },
                      })
                    }
                    }
                  >
                    <Group gap="sm">
                      <IconEye size={16} color={primary} />
                      <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                        View
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                {isUnposted && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate("/receipt/reversal/edit", {
                          state: {
                            ...row.original,
                            documents:
                              (row.original as any)?.documents ??
                              (row.original as any)?.supporting_documents ??
                            [],
                          },
                        });
                      }}
                    >
                      <Group gap="sm">
                        <IconEdit size={16} color={primary} />
                        <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                          Edit
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                )}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ];
    },
    [
      index,
      navigate,
      appliedFilters,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
      erpTheme,
      dateFormat,
      primary,
      editingHeaderId,
      openHeaderEditor,
      collapseHeaderEditor,
      commitHeaderFilters,
      filterFieldStyles,
    ],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = reversalColumnId(col);
        if (id === "actions") return true;
        return visibleColumns[id as keyof ReceiptReversalColumnVisibility] !== false;
      }),
    [allColumns, visibleColumns],
  );

  const table = useMantineReactTable({
    columns,
    /*
     * During a fetch we pass an empty data array so MRT renders
     * `renderEmptyRowsFallback` (the loader) inside `<tbody>` while keeping
     * `<thead>` (with the column-header filter inputs) and the pagination
     * footer mounted. Mirrors EnquiryListNativeTables' loader-in-body UX.
     */
    data: isLoading ? [] : tableData,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    manualPagination: true,
    rowCount: totalRecords,
    state: {
      pagination,
    },
    renderEmptyRowsFallback: () => (
      <Center
        py={80}
        style={{ width: "100%", backgroundColor: cardBg }}
        className="erp-header-filter-fade"
      >
        {isLoading ? (
          <Stack align="center" gap="md">
            <Loader size="lg" color={primary} />
            <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              Loading receipt reversal data…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            No receipt reversal data found
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
        backgroundColor: "transparent",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      const colSize = column.getSize();
      const isActions = column.id === "actions";
      const extraStyles = isActions
        ? {
            // Pinned-right Actions cell. `minWidth: 80px` matches the head
            // cell so the sticky body cell and sticky head cell stay the
            // same width. `zIndex: 2` stays BELOW the sticky head
            // (`zIndex: 4`) so the head paints over the body cell at the
            // bottom-right corner during horizontal scroll.
            position: "sticky" as const,
            right: 0,
            minWidth: "80px",
            zIndex: 2,
            borderLeft: `1px solid ${border}`,
            boxShadow: "1px -2px 4px 0px #00000040",
          }
        : {};
      return {
        style: {
          /*
           * Pin cell width to the column's declared `size` so the column
           * cannot resize when its header swaps between the static label
           * and the inline filter editor.
           */
          width: colSize,
          minWidth: colSize,
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: cardBg,
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const colSize = column.getSize();
      const isActions = column.id === "actions";
      const extraStyles = isActions
        ? {
            // Pinned-right Actions header. `zIndex: 4` keeps the sticky
            // head cell above the sticky body cell (`zIndex: 2`) at the
            // bottom-right corner.
            position: "sticky" as const,
            right: 0,
            minWidth: "80px",
            zIndex: 4,
            backgroundColor: erpTheme.headerBg,
            boxShadow: "0px -2px 4px 0px #00000040",
          }
        : {};
      return {
        style: {
          /*
           * Pin head cell width to the column's declared `size` (matches the
           * body cell width) so toggling between the column label and the
           * inline filter editor never resizes the header.
           */
          width: colSize,
          minWidth: colSize,
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          borderBottom: `1px solid ${border}`,
          /*
           * Stable header cell height so swapping between the column label
           * and the inline filter editor never resizes the row. Matches the
           * EnquiryMaster header row height (52.4 → 52).
           */
          minHeight: 52,
          height: 52,
          verticalAlign: "middle" as const,
          ...extraStyles,
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
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={{ ...erpListGeistRootTypography, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <ERPListScreen
          theme={erpTheme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconReceipt size={14} color={primary} />}
                  value={listStats.total}
                  label="Total"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconCircleCheck size={14} color="#059669" />}
                  iconBackground="#d1fae5"
                  iconColor="#059669"
                  value={listStats.posted}
                  label="Posted"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconClock size={14} color="#d97706" />}
                  iconBackground="#fef3c7"
                  iconColor="#d97706"
                  value={listStats.unposted}
                  label="Unposted"
                />
              </>
            ),
            // secondary: (
            //   <>
            //     <Text fw={600} size="sm" c={fg} style={{ fontFamily: erpTheme.fontSans }} component="span">
            //       Receipt Reversal
            //     </Text>
            //     <Group gap={8} wrap="nowrap" align="center">
            //       <IconCoin size={16} color={muted} style={{ flexShrink: 0 }} />
            //       <Text fw={600} size="sm" c={fg} style={{ fontFamily: erpTheme.fontSans }} component="span">
            //         {listStats.pageAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            //       </Text>
            //       <Text size="xs" c={muted} component="span">
            //         on this page
            //       </Text>
            //     </Group>
            //   </>
            // ),
            actions: (
              <>
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
            subtitle: "Refine by day book, reverse receipt number, dates, type, or status",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={isLoading}
                applyDisabled={isLoading}
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
                        setDraftFilters((prev) => ({ ...prev, day_book_id: val || "", day_book_name: selectedData?.label || "" }))
                      }
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item) => ({ value: String(item.id ?? ""), label: String(item.name ?? "") })}
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
                      apiEndpoint={URL.reverseReceipt}
                      label="Reverse Receipt No"
                      placeholder="Type Reverse Receipt No"
                      value={draftFilters.receipt_no}
                      onChange={(val) => setDraftFilters((prev) => ({ ...prev, receipt_no: val || "" }))}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item) => ({
                        value: String(item.reverse_receipt_no ?? item.receipt_no ?? ""),
                        label: String(item.reverse_receipt_no ?? item.receipt_no ?? ""),
                      })}
                      searchFields={["reverse_receipt_no"]}
                      size="xs"
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <TextInput
                      label="Receipt No"
                      placeholder="Type Receipt No"
                      value={draftFilters.original_doc_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          original_doc_no: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Date From"
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
                      label="Date To"
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
                      label="Type"
                      placeholder="Select Type"
                      data={typeOptions}
                      searchable
                      value={draftFilters.type || null}
                      onChange={(value) => setDraftFilters((prev) => ({ ...prev, type: value || "" }))}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="Status"
                      placeholder="Select Status"
                      data={statusOptions}
                      searchable
                      value={draftFilters.status || null}
                      onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value || "" }))}
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
            children: receiptError ? (
              <Center py="xl" style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}>
                <Text size="sm" c="dimmed" style={{ fontFamily: erpTheme.fontSans }}>
                  Error loading receipt reversal data. Please try refreshing the page.
                </Text>
              </Center>
            ) : (
              /*
               * Always render the table so `<thead>` (column-header filters)
               * and the pagination footer stay visible. While loading, MRT
               * shows `renderEmptyRowsFallback` (the loader) inside `<tbody>`
               * only — matching EnquiryListNativeTables' UX.
               */
              <MantineReactTable table={table} />
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}
