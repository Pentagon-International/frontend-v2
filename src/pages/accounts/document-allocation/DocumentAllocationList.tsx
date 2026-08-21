import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Grid,
  Group,
  MantineProvider,
  Menu,
  Modal,
  Select,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconCircleCheck,
  IconClock,
  IconDots,
  IconEdit,
  IconEye,
  IconFilter,
  IconPlus,
  IconSearch,
  IconStack2,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  useMantineReactTable,
} from "mantine-react-table";
import {
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableEmpty,
  ERPListTableLoading,
  SingleDateInput,
  ToastNotification,
  SearchableSelect,
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
import FormTextInput from "../../../components/FormTextInput";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import { URL } from "../../../api/serverUrls";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import useDateFormat from "../../../hooks/useDateFormat";

const LIST_KEY = "DOCUMENT_ALLOCATION_LIST";

type DocumentAllocationListItem = {
  id: number;
  account_name?: string;
  account_code?: string;
  subledger_code?: string;
  allocation_no?: string;
  allocation_date?: string;
  document_status?: string;
  jv_id?: number | null;
  jv_no?: string | null;
  allocation?: Array<Record<string, unknown>>;
};

/** `summary` on `outstandingAllocationDocumentsFilter` — totals are filter-scoped. */
type DocumentAllocationListSummary = {
  total_shipments?: number;
  status_counts?: {
    posted?: number;
    unposted?: number;
  };
};

type DocumentAllocationListQueryResult = {
  data: DocumentAllocationListItem[];
  total: number;
  summary?: DocumentAllocationListSummary;
};

type DocumentAllocationListResponse = {
  status?: boolean;
  message?: string;
  total?: number;
  index?: number;
  limit?: number | null;
  data?: DocumentAllocationListItem[];
  summary?: DocumentAllocationListSummary;
};

type FilterState = {
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  subledger_code: string | null;
  allocation_date: Date | null;
  document_status: string | null;
};

const EMPTY_FILTERS: FilterState = {
  account_id: null,
  account_code: null,
  account_name: null,
  subledger_code: null,
  allocation_date: null,
  document_status: null,
};

type DocAllocColumnKey =
  | "account_name"
  | "subledger_code"
  | "allocation_no"
  | "allocation_date"
  | "document_status";

type DocumentAllocationColumnVisibility = Record<DocAllocColumnKey, boolean>;

const docAllocColumnDefault: DocumentAllocationColumnVisibility = {
  account_name: true,
  subledger_code: true,
  allocation_no: true,
  allocation_date: true,
  document_status: true,
};

const docAllocColumnLabels: Record<keyof DocumentAllocationColumnVisibility, string> = {
  account_name: "Account Name",
  subledger_code: "Subledger Code",
  allocation_no: "Allocation No",
  allocation_date: "Allocation Date",
  document_status: "Document Status",
};

function columnIdForDocAlloc<T extends Record<string, unknown>>(
  col: MRT_ColumnDef<T>,
): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

type DocumentAllocationRowActionsProps = {
  row: DocumentAllocationListItem;
  navigate: ReturnType<typeof useNavigate>;
  setStoreFilters: (key: string, v: FilterState) => void;
  setStoreSearch: (key: string, s: string) => void;
  setShouldRestore: (key: string, b: boolean) => void;
  search: string;
  appliedFilters: FilterState;
  erpTheme: ErpListTheme;
  primary: string;
  onReverse: (row: DocumentAllocationListItem) => void;
};

const DocumentAllocationRowActions = memo(function DocumentAllocationRowActions({
  row,
  navigate,
  setStoreFilters,
  setStoreSearch,
  setShouldRestore,
  search,
  appliedFilters,
  erpTheme,
  primary,
  onReverse,
}: DocumentAllocationRowActionsProps) {
  const [menuOpened, setMenuOpened] = useState(false);
  const statusUpper = String(row.document_status ?? "").toUpperCase();
  const isUnposted = statusUpper === "UNPOSTED";
  const isPosted = statusUpper === "POSTED";

  const goToDocumentAllocation = (mode: "view" | "edit") => {
    setMenuOpened(false);
    setStoreFilters(LIST_KEY, {
      account_id: appliedFilters.account_id,
      account_code: appliedFilters.account_code,
      account_name: appliedFilters.account_name,
      subledger_code: appliedFilters.subledger_code,
      allocation_date: appliedFilters.allocation_date,
      document_status: appliedFilters.document_status,
    });
    setStoreSearch(LIST_KEY, search);
    setShouldRestore(LIST_KEY, true);
    navigate("/document-allocation/create", {
      state: {
        allocationDocument: row,
        allocationMode: mode,
      },
    });
  };

  return (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="md"
      width={200}
      opened={menuOpened}
      onChange={setMenuOpened}
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
          <UnstyledButton onClick={() => goToDocumentAllocation("view")}>
            <Group gap="sm">
              <IconEye size={16} color={primary} />
              <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                View
              </Text>
            </Group>
          </UnstyledButton>
        </Box>
        {isUnposted ? (
          <>
            <Menu.Divider />
            <Box px={10} py={5}>
              <UnstyledButton onClick={() => goToDocumentAllocation("edit")}>
                <Group gap="sm">
                  <IconEdit size={16} color={primary} />
                  <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                    Edit
                  </Text>
                </Group>
              </UnstyledButton>
            </Box>
          </>
        ) : null}
        {isPosted ? (
          <>
            <Menu.Divider />
            <Box px={10} py={5}>
              <UnstyledButton
                onClick={() => {
                  setMenuOpened(false);
                  onReverse(row);
                }}
              >
                <Group gap="sm">
                  <IconArrowBackUp size={16} color="#dc2626" />
                  <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                    Reverse
                  </Text>
                </Group>
              </UnstyledButton>
            </Box>
          </>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  );
});

export default function DocumentAllocationList() {
  const navigate = useNavigate();
  const location = useLocation();
  const dateFormat = useDateFormat();

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [showFilters, setShowFilters] = useState(false);

  const [draftFilters, setDraftFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ ...EMPTY_FILTERS });

  const [isRestoring, setIsRestoring] = useState(true);
  const [pendingReverse, setPendingReverse] =
    useState<DocumentAllocationListItem | null>(null);
  const [isReversing, setIsReversing] = useState(false);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [visibleColumns, setVisibleColumns] =
    useState<DocumentAllocationColumnVisibility>(() => ({ ...docAllocColumnDefault }));

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
    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }
    if (stored?.filters && typeof stored.filters === "object") {
      const raw = stored.filters as Record<string, unknown>;
      const next: FilterState = {
        account_id: raw.account_id != null ? String(raw.account_id) : null,
        account_code: raw.account_code != null ? String(raw.account_code) : null,
        account_name: raw.account_name != null ? String(raw.account_name) : null,
        subledger_code: raw.subledger_code != null ? String(raw.subledger_code) : null,
        allocation_date: raw.allocation_date
          ? new Date(String(raw.allocation_date))
          : null,
        document_status: raw.document_status != null ? String(raw.document_status) : null,
      };
      setDraftFilters(next);
      setAppliedFilters(next);
    }
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const buildFilterPayload = useCallback(
    (f: FilterState, searchValue: string) => {
      const payload: Record<string, string> = {};
      if (f.account_code) payload.account_code = f.account_code;
      if (f.subledger_code) payload.subledger_code = f.subledger_code;
      if (f.allocation_date) {
        payload.allocation_date = dayjs(f.allocation_date).format("YYYY-MM-DD");
      }
      if (f.document_status) payload.document_status = f.document_status;
      if (searchValue.trim()) payload.search = searchValue.trim();
      return payload;
    },
    [],
  );

  const index = pagination.pageIndex * pagination.pageSize;

  const {
    data: listResult = { data: [], total: 0, summary: undefined },
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery<DocumentAllocationListQueryResult>({
    queryKey: [
      "documentAllocationList",
      pagination.pageIndex,
      pagination.pageSize,
      appliedFilters,
      debouncedSearch,
    ],
    queryFn: async (): Promise<DocumentAllocationListQueryResult> => {
      try {
        const payload = buildFilterPayload(appliedFilters, debouncedSearch);
        const response = (await apiCallProtected.post(
          `${URL.outstandingAllocationDocumentsFilter}?index=${index}&limit=${pagination.pageSize}`,
          { filters: payload },
        )) as DocumentAllocationListResponse & Record<string, unknown>;

        const rows = Array.isArray(response?.data) ? response.data : [];
        const raw = response as Record<string, unknown>;
        const listTotal = getBookingShipmentFilterListTotal(raw, rows, index);

        const rawSummary = raw.summary;
        const summary: DocumentAllocationListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? (rawSummary as DocumentAllocationListSummary)
            : undefined;
        const summaryTotal = summary?.total_shipments;
        const total =
          typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
            ? summaryTotal
            : listTotal;
        setTotalRecords(total);
        return { data: rows, total, summary };
      } catch (error) {
        console.error("Error fetching document allocation list:", error);
        setTotalRecords(0);
        ToastNotification({
          type: "error",
          message: "Failed to fetch document allocation list",
        });
        return { data: [], total: 0, summary: undefined };
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const tableData = listResult.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);
  const loading = isLoading || isFetching;

  const closeReverseConfirm = useCallback(() => {
    if (isReversing) return;
    setPendingReverse(null);
  }, [isReversing]);

  const confirmReverse = useCallback(async () => {
    if (!pendingReverse?.id || isReversing) return;
    const docId = pendingReverse.id;
    setIsReversing(true);
    try {
      const res = (await apiCallProtected.put(
        `${URL.outstandingAllocationDocuments}${docId}/reverse/`,
        {},
      )) as { status?: boolean; message?: string };
      if (res?.status === false) {
        ToastNotification({
          type: "error",
          message: res.message || "Failed to reverse allocation document",
        });
        return;
      }
      ToastNotification({
        type: "success",
        message: res?.message || "Allocation document REVERSED.",
      });
      setPendingReverse(null);
      await refetch();
    } catch (error: unknown) {
      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Failed to reverse allocation document";
      ToastNotification({ type: "error", message });
    } finally {
      setIsReversing(false);
    }
  }, [pendingReverse, isReversing, refetch]);

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
    const summary = listResult?.summary;
    if (summary) {
      const sc = summary.status_counts ?? {};
      return {
        total: summary.total_shipments ?? totalRecords,
        posted: sc.posted ?? 0,
        unposted: sc.unposted ?? 0,
      };
    }
    let posted = 0;
    let unposted = 0;
    for (const r of tableData) {
      const s = String(r.document_status ?? "").toUpperCase();
      if (s === "POSTED") posted += 1;
      else if (s === "UNPOSTED" || s === "DRAFT") unposted += 1;
    }
    return { total: totalRecords, posted, unposted };
  }, [tableData, listResult?.summary, totalRecords]);

  const filterFieldStyles = erpListFilterUnifiedMantineStyles(erpTheme);
  const formTextFilterStyles = useMemo(
    () => ({
      label: { ...filterFieldStyles.label, fontSize: 12, fontWeight: 500, marginBottom: 4 },
      input: { ...filterFieldStyles.input, minHeight: 32, fontSize: 12, fontFamily: erpTheme.fontSans },
    }),
    [filterFieldStyles, erpTheme.fontSans],
  );

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof DocumentAllocationColumnVisibility)[]).map(
        (key) => ({
          id: String(key),
          label: docAllocColumnLabels[key],
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

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const allColumns = useMemo<MRT_ColumnDef<DocumentAllocationListItem>[]>(
    () => [
      {
        accessorKey: "account_name",
        header: "Account Name",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "subledger_code",
        header: "Subledger Code",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "allocation_no",
        header: "Allocation No",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "allocation_date",
        header: "Allocation Date",
        Cell: ({ cell }) => {
          const v = cell.getValue<string | undefined>();
          return (
            <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              {v ? dayjs(v).format(dateFormat) : "—"}
            </Text>
          );
        },
      },
      {
        accessorKey: "document_status",
        header: "Document Status",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        id: "actions",
        header: "Action",
        size: 80,
        Cell: ({ row }) => (
          <DocumentAllocationRowActions
            row={row.original}
            navigate={navigate}
            setStoreFilters={setStoreFilters}
            setStoreSearch={setStoreSearch}
            setShouldRestore={setShouldRestore}
            search={search}
            appliedFilters={appliedFilters}
            erpTheme={erpTheme}
            primary={primary}
            onReverse={setPendingReverse}
          />
        ),
      },
    ],
    [navigate, search, appliedFilters, erpTheme, primary, dateFormat, setStoreFilters, setStoreSearch, setShouldRestore, setPendingReverse],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = columnIdForDocAlloc(col);
        if (id === "actions") return true;
        return visibleColumns[id as DocAllocColumnKey] !== false;
      }),
    [allColumns, visibleColumns],
  );

  const table = useMantineReactTable({
    columns,
    data: tableData,
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
    onPaginationChange: setPagination,
    rowCount: totalRecords,
    state: { pagination },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%" },
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
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "30px",
              zIndex: 2,
              borderLeft: `1px solid ${border}`,
              boxShadow: "1px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
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
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "80px",
              zIndex: 2,
              backgroundColor: erpTheme.headerBg,
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          borderBottom: `1px solid ${border}`,
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
                  icon={<IconStack2 size={14} color={primary} />}
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
            //   <Group gap={8} wrap="nowrap" align="center">
            //     <IconStack2 size={16} color={muted} style={{ flexShrink: 0 }} />
            //     <Text
            //       fw={600}
            //       size="sm"
            //       c={fg}
            //       style={{ fontFamily: erpTheme.fontSans }}
            //       component="span"
            //     >
            //       {tableData.length.toLocaleString()}
            //     </Text>
            //     <Text size="xs" c={muted} component="span">
            //       on this page
            //     </Text>
            //   </Group>
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
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/document-allocation/create");
                  }}
                >
                  Create
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Account, subledger, allocation date, and document status",
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
                      label="Account"
                      placeholder="Search account..."
                      apiEndpoint={URL.chartOfAccounts}
                      value={draftFilters.account_id}
                      displayValue={
                        draftFilters.account_name
                          ? draftFilters.account_code
                            ? `${draftFilters.account_name} (${draftFilters.account_code})`
                            : draftFilters.account_name
                          : undefined
                      }
                      onChange={(val, _option, originalData) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          account_id: val || null,
                          account_code:
                            originalData?.gl_account_code != null
                              ? String(originalData.gl_account_code)
                              : null,
                          account_name:
                            originalData?.account_name != null
                              ? String(originalData.account_name)
                              : null,
                        }))
                      }
                      dropdownZIndex={1100}
                      minSearchLength={1}
                      size="xs"
                      searchFields={["gl_account_code", "account_name", "id"]}
                      displayFormat={(item: Record<string, unknown>) => {
                        const id = String(item.id ?? "").trim();
                        const code = String(item.gl_account_code ?? "").trim();
                        const name = String(item.account_name ?? "").trim();
                        return {
                          value: id,
                          label: name ? `${name} (${code})` : code || id,
                        };
                      }}
                      returnOriginalData
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      format="capital"
                      label="Subledger Code"
                      placeholder="Enter subledger code"
                      size="xs"
                      value={draftFilters.subledger_code || ""}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          subledger_code: e.currentTarget.value || null,
                        }))
                      }
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Allocation Date"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={draftFilters.allocation_date}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({ ...prev, allocation_date: date }))
                      }
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
                    <Select
                      label="Document Status"
                      placeholder="Select status"
                      searchable
                      clearable
                      size="xs"
                      data={[
                        { value: "POSTED", label: "POSTED" },
                        { value: "DRAFT", label: "DRAFT" },
                      ]}
                      value={draftFilters.document_status}
                      onChange={(value) =>
                        setDraftFilters((prev) => ({ ...prev, document_status: value || null }))
                      }
                      classNames={erpListGeistSelectClassNames}
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
            children: queryError ? (
              <Center py="xl" style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}>
                <Text size="sm" c="dimmed" style={{ fontFamily: erpTheme.fontSans }}>
                  Error loading document allocations. Please try again.
                </Text>
              </Center>
            ) : loading ? (
              <ERPListTableLoading theme={erpTheme} message="Loading document allocations…" />
            ) : tableData.length === 0 ? (
              <ERPListTableEmpty
                theme={erpTheme}
                icon={<IconStack2 size={24} color={muted} />}
                title="No document allocations found"
                hint="Try adjusting your search or filters"
              />
            ) : (
              <MantineReactTable table={table} />
            ),
          }}
        />
        <Modal
          opened={pendingReverse != null}
          onClose={closeReverseConfirm}
          title={
            <Text fw={600} size="md" style={{ fontFamily: erpTheme.fontSans }}>
              Reverse allocation
            </Text>
          }
          centered
          zIndex={400}
          closeOnClickOutside={!isReversing}
          closeOnEscape={!isReversing}
          withCloseButton={!isReversing}
        >
          <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: erpTheme.fontSans }}>
            Are you sure you want to reverse
            {pendingReverse?.allocation_no
              ? ` allocation ${pendingReverse.allocation_no}`
              : " this allocation document"}
            ? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              onClick={closeReverseConfirm}
              disabled={isReversing}
            >
              Cancel
            </Button>
            <Button color="red" onClick={confirmReverse} loading={isReversing}>
              Yes, reverse
            </Button>
          </Group>
        </Modal>
      </Box>
    </MantineProvider>
  );
}
