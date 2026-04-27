import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  useMantineReactTable,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  MantineProvider,
  Menu,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconClock,
  IconCreditCard,
  IconDots,
  IconEdit,
  IconEye,
  IconFilter,
  IconPlus,
  IconReceiptRefund,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Dropdown,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  SingleDateInput,
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
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";

// ─── Types ───────────────────────────────────────────────────────────────────

type JVRecord = {
  id?: number;
  document_no?: string;
  account_name?: string;
  narration?: string;
  journal_date?: string;
  note?: string;
  status?: string;
  debit_total?: string;
  credit_total?: string;
  difference?: string;
  daybook_id?: number;
  charges?: Array<{
    charge_id?: number;
    currency_id?: number;
    account_name?: string;
    subledger?: string;
    code?: string;
    key?: string;
    roe?: string;
    amount?: string;
    local_amount?: string;
    dr_cr?: string;
    narration?: string;
    c_r_n?: string;
    shipment_id?: string;
    job_id?: string;
  }>;
};

/** `summary` on `journalVoucherFilter` — totals are filter-scoped. */
type JournalVoucherListSummary = {
  total_shipments?: number;
  status_counts?: {
    posted?: number;
    unposted?: number;
  };
};

type JournalVoucherListQueryResult = {
  data: JVRecord[];
  summary?: JournalVoucherListSummary;
};

type JournalVoucherFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  total_count?: number;
  data?: JVRecord[];
  summary?: JournalVoucherListSummary;
};

const LIST_KEY = "JOURNAL_VOUCHER_MASTER";

type JournalVoucherFilters = {
  document_no: string;
  account_name: string;
  journal_date_from: Date | null;
  journal_date_to: Date | null;
  status: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status?: string): string {
  if (!status) return "gray";
  switch (status.toUpperCase()) {
    case "POSTED":
      return "green";
    case "UNPOSTED":
      return "orange";
    default:
      return "gray";
  }
}

type JournalVoucherColumnVisibility = {
  sno: boolean;
  document_no: boolean;
  journal_date: boolean;
  account_name: boolean;
  narration: boolean;
  debit_total: boolean;
  credit_total: boolean;
  difference: boolean;
  note: boolean;
  status: boolean;
};

const journalVoucherColumnDefault: JournalVoucherColumnVisibility = {
  sno: true,
  document_no: true,
  journal_date: true,
  account_name: true,
  narration: true,
  debit_total: true,
  credit_total: true,
  difference: true,
  note: true,
  status: true,
};

const journalVoucherColumnLabels: Record<keyof JournalVoucherColumnVisibility, string> = {
  sno: "S.No",
  document_no: "Document No",
  journal_date: "Journal Date",
  account_name: "Account Name",
  narration: "Narration",
  debit_total: "Debit",
  credit_total: "Credit",
  difference: "Difference",
  note: "Note",
  status: "Status",
};

function journalVoucherColumnId(col: MRT_ColumnDef<JVRecord>): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

// ─── Component ───────────────────────────────────────────────────────────────

function JournalVoucherMaster() {
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

  const DEFAULT_FILTERS: JournalVoucherFilters = {
    document_no: "",
    account_name: "",
    journal_date_from: defaultDateFrom,
    journal_date_to: defaultDateTo,
    status: "",
  };

  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);

  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const [visibleColumns, setVisibleColumns] = useState<JournalVoucherColumnVisibility>(
    () => ({ ...journalVoucherColumnDefault }),
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

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }

    if (stored?.filters && typeof stored.filters === "object") {
      const raw = stored.filters as Record<string, unknown>;
      const restored = {
        ...DEFAULT_FILTERS,
        ...raw,
        journal_date_from: raw.journal_date_from
          ? new Date(String(raw.journal_date_from))
          : raw.journal_date
            ? new Date(String(raw.journal_date))
            : DEFAULT_FILTERS.journal_date_from,
        journal_date_to: raw.journal_date_to
          ? new Date(String(raw.journal_date_to))
          : raw.journal_date
            ? new Date(String(raw.journal_date))
            : DEFAULT_FILTERS.journal_date_to,
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
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildFiltersPayload = (
    filters: JournalVoucherFilters,
    searchValue: string,
  ) => {
    const cleaned: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      if (key === "journal_date_from") {
        cleaned.journal_date_from = dayjs(value as Date).format("YYYY-MM-DD");
      } else if (key === "journal_date_to") {
        cleaned.journal_date_to = dayjs(value as Date).format("YYYY-MM-DD");
      } else if (typeof value === "string" && value.trim() !== "") {
        cleaned[key] = value;
      }
    });

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  const {
    data: journalVoucherListResult,
    isLoading: isLoadingQuery,
    isFetching,
    error,
  } = useQuery<JournalVoucherListQueryResult>({
    queryKey: [
      "journalVoucherMaster",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<JournalVoucherListQueryResult> => {
      try {
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);

        const payload =
          Object.keys(filtersPayload).length > 0
            ? { filters: filtersPayload }
            : { filters: {} };

        setIsInitialLoad(false);

        const response = (await apiCallProtected.post(
          `${URL.journalVoucherFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
          API_HEADER as any,
        )) as Record<string, unknown>;

        const raw = response as any;
        const bodyCandidate =
          raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate != null
          ? (bodyCandidate as JournalVoucherFilterResponse | JVRecord[])
          : null;

        if (!body) {
          setTotalRecords(0);
          return { data: [], summary: undefined };
        }

        const list = Array.isArray((body as JournalVoucherFilterResponse).data)
          ? ((body as JournalVoucherFilterResponse).data as JVRecord[])
          : Array.isArray(body) ? (body as JVRecord[]) : [];

        const totalEnvelope =
          body != null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          ("total" in body || "index" in body)
            ? (body as unknown as Record<string, unknown>)
            : (raw as Record<string, unknown>);
        const listTotal = getBookingShipmentFilterListTotal(totalEnvelope, list, index);
        const rawSummary = raw?.summary;
        const summary: JournalVoucherListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? (rawSummary as JournalVoucherListSummary)
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

  const data = journalVoucherListResult?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const isLoading = isFetching || isLoadingQuery || isInitialLoad;
  const tableData = data ?? [];

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
      const d = parseFloat(String(r.debit_total ?? 0));
      if (!Number.isNaN(d)) pageAmount += d;
    }
    const summary = journalVoucherListResult?.summary;
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
  }, [tableData, journalVoucherListResult?.summary, totalRecords]);

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
      (Object.keys(visibleColumns) as (keyof JournalVoucherColumnVisibility)[]).map(
        (key) => ({
          id: String(key),
          label: journalVoucherColumnLabels[key],
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

  // ─── Columns ──────────────────────────────────────────────────────────────

  const allColumns = useMemo<MRT_ColumnDef<JVRecord>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 60,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => index + row.index + 1,
      },
      {
        accessorKey: "document_no",
        header: "Document No",
        size: 150,
        Cell: ({ cell }) => (
          <Text size="sm" fw={600} c={primary} style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() || "-"}
          </Text>
        ),
      },
      {
        accessorKey: "journal_date",
        header: "Journal Date",
        size: 130,
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {row.original.journal_date
              ? dayjs(String(row.original.journal_date)).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "account_name",
        header: "Account Name",
        size: 170,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "narration",
        header: "Narration",
        size: 180,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Text
              size="sm"
              style={{ fontFamily: erpTheme.fontSans, maxWidth: 170 }}
              truncate
              title={val}
            >
              {val}
            </Text>
          );
        },
      },
      {
        accessorKey: "debit_total",
        header: "Debit",
        size: 110,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "credit_total",
        header: "Credit",
        size: 110,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "difference",
        header: "Difference",
        size: 110,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          const num = parseFloat(val ?? "0");
          return (
            <Text
              size="sm"
              fw={500}
              c={Math.abs(num) > 0.005 ? "red" : primary}
              style={{ fontFamily: erpTheme.fontSans }}
            >
              {val || "-"}
            </Text>
          );
        },
      },
      {
        accessorKey: "note",
        header: "Note",
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Text
              size="sm"
              style={{ fontFamily: erpTheme.fontSans, maxWidth: 150 }}
              truncate
              title={val}
            >
              {val}
            </Text>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Badge
              size="sm"
              variant="light"
              color={statusColor(val)}
              styles={{ root: { textTransform: "none" } }}
            >
              {val}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => {
          const status = String(row.original.status ?? "").trim().toUpperCase();
          const isPosted = status === "POSTED";
          const canEdit = !isPosted;
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
                {canEdit && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate(`/journal-voucher/edit/${row.original.id}`, {
                          state: { rowData: row.original },
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

                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setStoreFilters(LIST_KEY, appliedFilters);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate(`/journal-voucher/view/${row.original.id}`, {
                        state: { rowData: row.original },
                      });
                    }}
                  >
                    <Group gap="sm">
                      <IconEye size={16} color={primary} />
                      <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                        View
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>

                {isPosted && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate("/journal-voucher-reversal/create", {
                          state: { reversalOf: row.original },
                        });
                      }}
                    >
                      <Group gap="sm">
                        <IconReceiptRefund size={16} color={primary} />
                        <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                          JV Reversal
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
    ],
    [
      navigate,
      index,
      appliedFilters,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
      erpTheme,
      dateFormat,
      primary,
    ],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = journalVoucherColumnId(col);
        if (id === "actions") return true;
        return visibleColumns[id as keyof JournalVoucherColumnVisibility] !== false;
      }),
    [allColumns, visibleColumns],
  );

  // ─── Table ────────────────────────────────────────────────────────────────

  const table = useMantineReactTable({
    columns,
    data: tableData,
    state: { pagination },
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    manualPagination: true,
    rowCount: totalRecords,
    onPaginationChange: setPagination,
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
    mantineTableBodyCellProps: ({ column }) => ({
      style: {
        padding: "8px 16px",
        fontSize: 14,
        fontFamily: erpTheme.fontSans,
        color: muted,
        backgroundColor: cardBg,
        ...(column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "30px",
              zIndex: 2,
              borderLeft: `1px solid ${border}`,
              boxShadow: "1px -2px 4px 0px #00000040",
            }
          : {}),
      },
    }),
    mantineTableHeadCellProps: ({ column }) => ({
      style: {
        padding: "8px 16px",
        fontSize: 14,
        fontFamily: erpTheme.fontSans,
        color: muted,
        backgroundColor: erpTheme.headerBg,
        top: 0,
        zIndex: 3,
        borderBottom: `1px solid ${border}`,
        ...(column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              zIndex: 4,
              minWidth: "80px",
              backgroundColor: erpTheme.headerBg,
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {}),
      },
    }),
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
      },
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Center py="xl" style={{ backgroundColor: cardBg }}>
            <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              No journal vouchers found
            </Text>
          </Center>
        </td>
      </tr>
    ),
  });

  // ─── Render ───────────────────────────────────────────────────────────────

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
                  icon={<IconCreditCard size={14} color={primary} />}
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
            //     <IconCoin size={16} color={muted} style={{ flexShrink: 0 }} />
            //     <Text fw={600} size="sm" c={fg} style={{ fontFamily: erpTheme.fontSans }} component="span">
            //       {listStats.pageAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            //     </Text>
            //     <Text size="xs" c={muted} component="span">
            //       debit on this page
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
                    navigate("/journal-voucher/create");
                  }}
                >
                  Create New
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine by document no., account, journal date range, or status",
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
                    <FormTextInput
                      label="Document No"
                      placeholder="Type Document No"
                      value={draftFilters.document_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          document_no: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Account Name"
                      placeholder="Type Account Name"
                      value={draftFilters.account_name}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          account_name: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Journal Date From"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.journal_date_from}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          journal_date_from: date,
                        }))
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
                      label="Journal Date To"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.journal_date_to}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          journal_date_to: date,
                        }))
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
                      label="Status"
                      placeholder="Select Status"
                      data={["POSTED", "UNPOSTED"]}
                      value={draftFilters.status}
                      searchable
                      onChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          status: value || "",
                        }))
                      }
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
              <Center py="xl" style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}>
                <Text size="sm" c="dimmed" style={{ fontFamily: erpTheme.fontSans }}>
                  Error loading journal vouchers. Please try refreshing the page.
                </Text>
              </Center>
            ) : isLoading ? (
              <ERPListTableLoading theme={erpTheme} message="Loading journal vouchers…" />
            ) : (
              <MantineReactTable table={table} />
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}

export default JournalVoucherMaster;
