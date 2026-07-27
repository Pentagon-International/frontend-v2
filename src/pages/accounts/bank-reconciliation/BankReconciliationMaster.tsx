import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Select,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBuildingBank,
  IconCircleCheck,
  IconClock,
  IconDots,
  IconEdit,
  IconEye,
  IconFilter,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  useMantineReactTable,
} from "mantine-react-table";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import {
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableEmpty,
  ERPListTableLoading,
  SearchableSelect,
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
import FormTextInput from "../../../components/FormTextInput";
import useDateFormat from "../../../hooks/useDateFormat";
import { useListFilterStore } from "../../../store/listFilterStore";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountBound,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";

const LIST_KEY = "BANK_RECONCILIATION_MASTER";

type BankReconciliationListItem = {
  id?: number;
  brs_no?: string;
  brs_date?: string;
  account_code?: string;
  account_name?: string;
  subledger?: string;
  currency_id?: number;
  currency_code?: string;
  currency_name?: string;
  as_per_statement?: string | number;
  bank_balance?: string | number;
  cheque_issued_total?: string | number;
  bank_credit_total?: string | number;
  credit_total?: string | number;
  cheque_deposited_total?: string | number;
  bank_debit_total?: string | number;
  debit_total?: string | number;
  difference_amount?: string | number;
  grand_total?: string | number;
  status?: string;
  remarks?: string;
  created_by?: string;
  company_code?: string;
  branch_code?: string;
  posted_by?: string | null;
  posted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BankReconciliationListSummary = {
  total_shipments?: number;
  status_counts?: {
    posted?: number;
    unposted?: number;
  };
};

type BankReconciliationListQueryResult = {
  data: BankReconciliationListItem[];
  total: number;
  summary?: BankReconciliationListSummary;
};

type BankReconciliationFilterResponse = {
  status?: boolean;
  message?: string;
  total?: number;
  index?: number;
  limit?: number | null;
  data?: BankReconciliationListItem[];
  summary?: BankReconciliationListSummary;
};

type FilterState = {
  brs_no: string;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  status: "" | "POSTED" | "UNPOSTED";
};

const EMPTY_FILTERS: FilterState = {
  brs_no: "",
  account_id: null,
  account_code: null,
  account_name: null,
  status: "",
};

type BrsColumnKey =
  | "brs_no"
  | "brs_date"
  | "account_name"
  | "account_code"
  | "currency_code"
  | "as_per_statement"
  | "bank_balance"
  | "grand_total"
  | "difference_amount"
  | "status"
  | "remarks"
  | "created_by";

type BrsColumnVisibility = Record<BrsColumnKey, boolean>;

const brsColumnDefault: BrsColumnVisibility = {
  brs_no: true,
  brs_date: true,
  account_name: true,
  account_code: true,
  currency_code: true,
  as_per_statement: true,
  bank_balance: true,
  grand_total: true,
  difference_amount: true,
  status: true,
  remarks: false,
  created_by: false,
};

const brsColumnLabels: Record<BrsColumnKey, string> = {
  brs_no: "BRS No",
  brs_date: "BRS Date",
  account_name: "Account Name",
  account_code: "Account Code",
  currency_code: "Currency",
  as_per_statement: "As Per Statement",
  bank_balance: "Bank Balance",
  grand_total: "Grand Total",
  difference_amount: "Difference",
  status: "Status",
  remarks: "Remarks",
  created_by: "Created By",
};

function columnId<T extends Record<string, unknown>>(
  col: MRT_ColumnDef<T>,
): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

function formatAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return formatMoneyAmountBound(n);
}

function receiptStatusBadgeColor(status?: string): string {
  const statusUpper = String(status ?? "").toUpperCase();
  if (statusUpper === "POSTED") return "green";
  if (statusUpper === "UNPOSTED") return "gray";
  return "#105476";
}

type RowActionsProps = {
  row: BankReconciliationListItem;
  navigate: ReturnType<typeof useNavigate>;
  setStoreFilters: (key: string, v: FilterState) => void;
  setStoreSearch: (key: string, s: string) => void;
  setShouldRestore: (key: string, b: boolean) => void;
  search: string;
  appliedFilters: FilterState;
  erpTheme: ErpListTheme;
  primary: string;
};

const BankReconciliationRowActions = memo(function BankReconciliationRowActions({
  row,
  navigate,
  setStoreFilters,
  setStoreSearch,
  setShouldRestore,
  search,
  appliedFilters,
  erpTheme,
  primary,
}: RowActionsProps) {
  const [menuOpened, setMenuOpened] = useState(false);
  const isUnposted = String(row.status ?? "").toUpperCase() === "UNPOSTED";

  const goTo = (mode: "view" | "edit") => {
    if (row.id == null) return;
    setMenuOpened(false);
    setStoreFilters(LIST_KEY, appliedFilters);
    setStoreSearch(LIST_KEY, search);
    setShouldRestore(LIST_KEY, true);
    navigate(`/bank-reconciliation/${mode}/${row.id}`);
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
          <UnstyledButton onClick={() => goTo("view")}>
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
              <UnstyledButton onClick={() => goTo("edit")}>
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
      </Menu.Dropdown>
    </Menu>
  );
});

export default function BankReconciliationMaster() {
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const navigate = useNavigate();
  const location = useLocation();
  const dateFormat = useDateFormat();

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [isRestoring, setIsRestoring] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<BrsColumnVisibility>(() => ({
    ...brsColumnDefault,
  }));

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

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
        brs_no: raw.brs_no != null ? String(raw.brs_no) : "",
        account_id: raw.account_id != null ? String(raw.account_id) : null,
        account_code: raw.account_code != null ? String(raw.account_code) : null,
        account_name: raw.account_name != null ? String(raw.account_name) : null,
        status: (raw.status as FilterState["status"]) || "",
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
      const filters: Record<string, string> = {};
      if (f.brs_no.trim()) filters.brs_no = f.brs_no.trim();
      if (f.account_code) filters.account_code = f.account_code;
      if (f.status) filters.status = f.status;
      if (searchValue.trim()) filters.search = searchValue.trim();
      return filters;
    },
    [],
  );

  const index = pagination.pageIndex * pagination.pageSize;

  const {
    data: listResult = { data: [], total: 0, summary: undefined },
    isLoading,
    isFetching,
  } = useQuery<BankReconciliationListQueryResult>({
    queryKey: [
      "bankReconciliationList",
      pagination.pageIndex,
      pagination.pageSize,
      appliedFilters,
      debouncedSearch,
    ],
    queryFn: async (): Promise<BankReconciliationListQueryResult> => {
      try {
        const filters = buildFilterPayload(appliedFilters, debouncedSearch);
        const response = (await apiCallProtected.post(
          `${URL.bankReconciliationFilter}?index=${index}&limit=${pagination.pageSize}`,
          { filters },
        )) as BankReconciliationFilterResponse & Record<string, unknown>;

        const rows = Array.isArray(response?.data) ? response.data : [];
        const listTotal = getBookingShipmentFilterListTotal(
          response as Record<string, unknown>,
          rows,
          index,
        );

        const rawSummary = response.summary;
        const summary: BankReconciliationListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? rawSummary
            : undefined;
        const summaryTotal = summary?.total_shipments;
        const total =
          typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
            ? summaryTotal
            : listTotal;

        setTotalRecords(total);
        return { data: rows, total, summary };
      } catch (error) {
        console.error("Error fetching bank reconciliation data:", error);
        setTotalRecords(0);
        ToastNotification({
          type: "error",
          message: "Failed to fetch bank reconciliation data",
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
  const loading = isLoading || isFetching;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

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
      const s = String(r.status ?? "").toUpperCase();
      if (s === "POSTED") posted += 1;
      else if (s === "UNPOSTED") unposted += 1;
    }
    return { total: totalRecords, posted, unposted };
  }, [tableData, listResult?.summary, totalRecords]);

  const filterFieldStyles = erpListFilterUnifiedMantineStyles(erpTheme);
  const formTextFilterStyles = useMemo(
    () => ({
      label: {
        ...filterFieldStyles.label,
        fontSize: 12,
        fontWeight: 500,
        marginBottom: 4,
      },
      input: {
        ...filterFieldStyles.input,
        minHeight: 32,
        fontSize: 12,
        fontFamily: erpTheme.fontSans,
      },
    }),
    [filterFieldStyles, erpTheme.fontSans],
  );

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as BrsColumnKey[]).map((key) => ({
        id: String(key),
        label: brsColumnLabels[key],
        checked: visibleColumns[key],
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
          })),
      })),
    [visibleColumns],
  );

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
    setSearch("");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const formatListDate = useCallback(
    (value?: string | null) => {
      if (!value) return "—";
      const d = dayjs(value);
      return d.isValid() ? d.format(dateFormat) : value;
    },
    [dateFormat],
  );

  const allColumns = useMemo<MRT_ColumnDef<BankReconciliationListItem>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 64,
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {pagination.pageIndex * pagination.pageSize + row.index + 1}
          </Text>
        ),
      },
      {
        accessorKey: "brs_no",
        header: "BRS No",
        Cell: ({ cell }) => (
          <Text size="sm" fw={500} style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "brs_date",
        header: "BRS Date",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatListDate(cell.getValue<string>())}
          </Text>
        ),
      },
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
        accessorKey: "account_code",
        header: "Account Code",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "currency_code",
        header: "Currency",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "as_per_statement",
        header: "As Per Statement",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatAmount(cell.getValue<string | number>())}
          </Text>
        ),
      },
      {
        accessorKey: "bank_balance",
        header: "Bank Balance",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatAmount(cell.getValue<string | number>())}
          </Text>
        ),
      },
      {
        accessorKey: "grand_total",
        header: "Grand Total",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatAmount(cell.getValue<string | number>())}
          </Text>
        ),
      },
      {
        accessorKey: "difference_amount",
        header: "Difference",
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatAmount(cell.getValue<string | number>())}
          </Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        Cell: ({ cell }) => {
          const val = cell.getValue<unknown>();
          if (val == null) return "—";
          const str = String(val);
          return (
            <Badge
              size="sm"
              variant="light"
              color={receiptStatusBadgeColor(str)}
              styles={{ root: { textTransform: "none" } }}
            >
              {str}
            </Badge>
          );
        },
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        Cell: ({ cell }) => (
          <Text size="sm" lineClamp={2} style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "created_by",
        header: "Created By",
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
          <BankReconciliationRowActions
            row={row.original}
            navigate={navigate}
            setStoreFilters={setStoreFilters}
            setStoreSearch={setStoreSearch}
            setShouldRestore={setShouldRestore}
            search={search}
            appliedFilters={appliedFilters}
            erpTheme={erpTheme}
            primary={primary}
          />
        ),
      },
    ],
    [
      navigate,
      search,
      appliedFilters,
      erpTheme,
      primary,
      formatListDate,
      pagination.pageIndex,
      pagination.pageSize,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
    ],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = columnId(col);
        if (id === "actions") return true;
        return visibleColumns[id as BrsColumnKey] !== false;
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
      pagination: { pageSize: 20, pageIndex: 0 },
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

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (appliedFilters.brs_no.trim()) parts.push(`BRS: ${appliedFilters.brs_no}`);
    if (appliedFilters.account_code) parts.push(`Account: ${appliedFilters.account_code}`);
    if (appliedFilters.status) parts.push(appliedFilters.status);
    if (debouncedSearch.trim()) parts.push(`Search: ${debouncedSearch}`);
    return parts;
  }, [appliedFilters, debouncedSearch]);

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
                  icon={<IconBuildingBank size={14} color={primary} />}
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
                    navigate("/bank-reconciliation/create");
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
            subtitle: "Refine by BRS no., bank account, or status",
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
                    <FormTextInput
                      label="BRS No"
                      placeholder="BRS number"
                      size="xs"
                      value={draftFilters.brs_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          brs_no: e.currentTarget.value,
                        }))
                      }
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      label="Account Code"
                      placeholder="Search bank account..."
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
                      searchFields={[
                        "account_name",
                        "gl_name",
                        "gl_account_code",
                        "sl_code",
                      ]}
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
                    <Select
                      label="Status"
                      placeholder="All"
                      searchable
                      clearable
                      size="xs"
                      data={[
                        { value: "POSTED", label: "Posted" },
                        { value: "UNPOSTED", label: "Unposted" },
                      ]}
                      value={draftFilters.status || null}
                      onChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          status: (value as FilterState["status"]) || "",
                        }))
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
            children:
              loading && tableData.length === 0 ? (
                <Center style={{ flex: 1, minHeight: 280 }}>
                  <ERPListTableLoading theme={erpTheme} />
                </Center>
              ) : tableData.length === 0 ? (
                <Box
                  style={{
                    flex: 1,
                    minHeight: 280,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ERPListTableEmpty
                    theme={erpTheme}
                    icon={<IconBuildingBank size={24} color={muted} />}
                    title={
                      search.trim() || filterSummary.length
                        ? "No records found"
                        : "No bank reconciliations yet"
                    }
                    hint={
                      search.trim() || filterSummary.length
                        ? "Try adjusting your search or filters"
                        : "Click Create New to add a bank reconciliation"
                    }
                  />
                </Box>
              ) : (
                <MantineReactTable table={table} />
              ),
            footer: (
              <ERPListPaginationFooter
                theme={erpTheme}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                totalRecords={totalRecords}
                onPageIndexChange={(pageIndex) =>
                  setPagination((p) => ({ ...p, pageIndex }))
                }
                onPageSizeChange={(pageSize) =>
                  setPagination({ pageIndex: 0, pageSize })
                }
              />
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}
