import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Center,
  Box,
  Menu,
  ActionIcon,
  UnstyledButton,
  Badge,
  Grid,
  TextInput,
  MantineProvider,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconClock,
  IconCreditCard,
  IconDots,
  IconEdit,
  IconEye,
  IconFileInvoice,
  IconFilter,
  IconSearch,
  IconX,
  IconBan,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
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
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import dayjs from "dayjs";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";
import useDateFormat from "../../../hooks/useDateFormat";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentRequestCharge = {
  id: number;
  payment_request: number;
  job_id?: string;
  charge_id: number;
  charge_code?: string;
  charge_name?: string;
  currency_code?: string;
  currency_id?: number;
  roe?: string;
  unit_code?: string;
  no_of_unit?: number;
  amount_per_unit?: string;
  amount?: string;
  local_amount?: string;
  sac_code?: string;
};

type PaymentRequestRecord = {
  id: number;
  request_no: string;
  job_reference?: string;
  created_by?: string;
  date?: string;
  payment_type?: string;
  vouchar_type?: string;
  paid_to_type?: string;
  paid_to?: string;
  not_over?: string;
  state_code?: string;
  state_id?: number;
  tds_section_code?: string;
  account_code?: string;
  subledger_code?: string;
  currency_id?: number;
  location_gst_no?: string;
  customer_gst_no?: string;
  note?: string;
  account_note?: string;
  status?: string;
  amount?: string;
  currency_code?: string;
  charges?: PaymentRequestCharge[];
};

/** `summary` on `filter/payment-request/` — totals are filter-scoped. */
type PaymentRequestListSummary = {
  total_shipments?: number;
  status_counts?: {
    active?: number;
    approved?: number;
    rejected?: number;
  };
};

type PaymentRequestListQueryResult = {
  data: PaymentRequestRecord[];
  summary?: PaymentRequestListSummary;
};

type PaymentRequestFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  total_count?: number;
  data?: PaymentRequestRecord[];
  summary?: PaymentRequestListSummary;
};

type FilterState = {
  status: string | null;
  date_from: Date | null;
  date_to: Date | null;
  payment_type: string | null;
  paid_to_type: string | null;
  request_no: string | null;
  job_reference: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcLocalAmount(charges?: PaymentRequestCharge[]): string {
  if (!charges?.length) return "0.00";
  const total = charges.reduce(
    (sum, c) => sum + (c.local_amount ? parseFloat(c.local_amount) : 0),
    0,
  );
  return total.toFixed(2);
}

function getFirstJobNo(charges?: PaymentRequestCharge[]): string {
  return charges?.find((c) => c.job_id)?.job_id ?? "-";
}

function statusColor(status?: string): string {
  if (!status) return "gray";
  switch (status.toLowerCase()) {
    case "approved":
      return "green";
    case "rejected":
      return "red";
    case "unapproved":
      return "orange";
    case "unposted":
      return "blue";
    default:
      return "gray";
  }
}

const emptyFilters = (): FilterState => ({
  status: null,
  date_from: dayjs().startOf("month").toDate(),
  date_to: dayjs().toDate(),
  payment_type: null,
  paid_to_type: null,
  request_no: null,
  job_reference: null,
});

const LIST_KEY = "PAYMENT_REQUEST_APPROVAL";

type PaymentRequestColumnVisibility = {
  sno: boolean;
  created_by: boolean;
  request_no: boolean;
  local_amount: boolean;
  payment_type: boolean;
  not_over: boolean;
  date: boolean;
  paid_to_type: boolean;
  paid_to: boolean;
  job_no: boolean;
  note: boolean;
  account_note: boolean;
  status: boolean;
};

const paymentRequestColumnDefault: PaymentRequestColumnVisibility = {
  sno: true,
  created_by: true,
  request_no: true,
  local_amount: true,
  payment_type: true,
  not_over: true,
  date: true,
  paid_to_type: true,
  paid_to: true,
  job_no: true,
  note: true,
  account_note: true,
  status: true,
};

const paymentRequestColumnLabels: Record<keyof PaymentRequestColumnVisibility, string> = {
  sno: "S.No",
  created_by: "User",
  request_no: "Request No",
  local_amount: "Local Amount",
  payment_type: "Type",
  not_over: "Over",
  date: "Date",
  paid_to_type: "Paid To Type",
  paid_to: "Paid To",
  job_no: "Job Id",
  note: "Note",
  account_note: "Accountant Note",
  status: "Status",
};

function paymentRequestColumnId(
  col: MRT_ColumnDef<PaymentRequestRecord>,
): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

// ─── Component ───────────────────────────────────────────────────────────────

function PaymentRequestApproval() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const dateFormat = useDateFormat();

  const [showFilters, setShowFilters] = useState(false);
  // draftFilters: what user is editing in the panel; appliedFilters: what drives the query
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(emptyFilters());
  const [draftCreatedBy, setDraftCreatedBy] = useState("");
  const [appliedCreatedBy, setAppliedCreatedBy] = useState("");
  const [draftPaidTo, setDraftPaidTo] = useState("");
  const [appliedPaidTo, setAppliedPaidTo] = useState("");

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const [visibleColumns, setVisibleColumns] = useState<PaymentRequestColumnVisibility>(
    () => ({ ...paymentRequestColumnDefault }),
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
      const f = stored.filters as Record<string, unknown>;
      const restored: FilterState = {
        status: (f.status as string) ?? null,
        date_from: f.date_from ? new Date(f.date_from as string) : null,
        date_to: f.date_to ? new Date(f.date_to as string) : null,
        payment_type: (f.payment_type as string) ?? null,
        paid_to_type: (f.paid_to_type as string) ?? null,
        request_no: (f.request_no as string) ?? null,
        job_reference: (f.job_reference as string) ?? null,
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
      setDraftCreatedBy((f.created_by as string) ?? "");
      setAppliedCreatedBy((f.created_by as string) ?? "");
      setDraftPaidTo((f.paid_to as string) ?? "");
      setAppliedPaidTo((f.paid_to as string) ?? "");
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const index = pagination.pageIndex * pagination.pageSize;

  // ─── Build filter payload ─────────────────────────────────────────────────

  const buildFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if (appliedFilters.status) payload.status = appliedFilters.status;
    if (appliedFilters.date_from) payload.date_from = dayjs(appliedFilters.date_from).format("YYYY-MM-DD");
    if (appliedFilters.date_to) payload.date_to = dayjs(appliedFilters.date_to).format("YYYY-MM-DD");
    if (appliedFilters.payment_type) payload.payment_type = appliedFilters.payment_type;
    if (appliedFilters.paid_to_type) payload.paid_to_type = appliedFilters.paid_to_type;
    if (appliedFilters.request_no?.trim()) payload.request_no = appliedFilters.request_no.trim();
    if (appliedFilters.job_reference?.trim()) payload.job_reference = appliedFilters.job_reference.trim();
    if (appliedCreatedBy.trim()) payload.created_by = appliedCreatedBy.trim();
    if (appliedPaidTo.trim()) payload.paid_to = appliedPaidTo.trim();
    return payload;
  }, [appliedFilters, appliedCreatedBy, appliedPaidTo]);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const {
    data: paymentRequestListResult,
    isLoading: requestLoading,
    isFetching: requestFetching,
    error: requestError,
  } = useQuery<PaymentRequestListQueryResult>({
    queryKey: ["paymentRequestApproval", pagination.pageIndex, pagination.pageSize, JSON.stringify(buildFilterPayload), debouncedSearch],
    queryFn: async (): Promise<PaymentRequestListQueryResult> => {
      try {
        const filtersWithSearch: Record<string, unknown> = { ...buildFilterPayload };
        if (debouncedSearch?.trim()) filtersWithSearch.search = debouncedSearch.trim();

        const payload = Object.keys(filtersWithSearch).length > 0
          ? { filters: filtersWithSearch }
          : { filters: {} };

        setIsInitialLoad(false);

        const response = (await apiCallProtected.post(
          `${URL.paymentRequestFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        )) as Record<string, unknown>;

        const raw = response as Record<string, unknown> & { summary?: unknown };
        const bodyCandidate = raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate != null
          ? (bodyCandidate as PaymentRequestFilterResponse | PaymentRequestRecord[])
          : null;
        if (!body) {
          setTotalRecords(0);
          return { data: [], summary: undefined };
        }

        const list: PaymentRequestRecord[] = Array.isArray((body as PaymentRequestFilterResponse).data)
          ? ((body as PaymentRequestFilterResponse).data as PaymentRequestRecord[])
          : Array.isArray(body) ? (body as PaymentRequestRecord[]) : [];

        const totalEnvelope =
          body != null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          ("total" in body || "index" in body)
            ? (body as unknown as Record<string, unknown>)
            : (raw as Record<string, unknown>);
        const listTotal = getBookingShipmentFilterListTotal(totalEnvelope, list, index);

        const rawSummary = raw?.summary;
        const summary: PaymentRequestListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? (rawSummary as PaymentRequestListSummary)
            : undefined;

        const summaryTotal = summary?.total_shipments;
        const fromCounts = summary?.status_counts
          ? (summary.status_counts.active ?? 0) +
            (summary.status_counts.approved ?? 0) +
            (summary.status_counts.rejected ?? 0)
          : 0;
        const total =
          typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
            ? summaryTotal
            : listTotal > 0
              ? listTotal
              : fromCounts > 0
                ? fromCounts
                : listTotal;
        setTotalRecords(total);
        return { data: list, summary };
      } catch {
        setTotalRecords(0);
        return { data: [], summary: undefined };
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const requestData = paymentRequestListResult?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const isLoading = requestLoading || requestFetching || isInitialLoad;
  const tableData = requestData ?? [];

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
      pageAmount += parseFloat(calcLocalAmount(r.charges)) || 0;
    }
    const summary = paymentRequestListResult?.summary;
    if (summary) {
      const sc = summary.status_counts ?? {};
      return {
        total: summary.total_shipments ?? totalRecords,
        approved: sc.approved ?? 0,
        pending: sc.active ?? 0,
        rejected: sc.rejected ?? 0,
        pageAmount,
      };
    }
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    for (const r of tableData) {
      const s = (r.status ?? "").trim().toLowerCase();
      if (s === "rejected") rejected += 1;
      else if (s === "approved" || s === "approved_without_crj") approved += 1;
      else pending += 1;
    }
    return { total: totalRecords, approved, pending, rejected, pageAmount };
  }, [tableData, paymentRequestListResult?.summary, totalRecords]);

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
      (Object.keys(visibleColumns) as (keyof PaymentRequestColumnVisibility)[]).map(
        (key) => ({
          id: String(key),
          label: paymentRequestColumnLabels[key],
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

  // ─── Filter actions ───────────────────────────────────────────────────────

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handlePageSizeChange = (newPageSize: number) => setPagination({ pageIndex: 0, pageSize: newPageSize });

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setAppliedCreatedBy(draftCreatedBy);
    setAppliedPaidTo(draftPaidTo);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, buildFilterPayload);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    const empty = emptyFilters();
    setDraftFilters(empty);
    setAppliedFilters(empty);
    setDraftCreatedBy("");
    setAppliedCreatedBy("");
    setDraftPaidTo("");
    setAppliedPaidTo("");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
    setSearch("");
    setShowFilters(false);
  };

  // ─── Columns ──────────────────────────────────────────────────────────────

  const allColumns = useMemo<MRT_ColumnDef<PaymentRequestRecord>[]>(
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
        accessorKey: "created_by",
        header: "User",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "request_no",
        header: "Request No",
        size: 150,
        Cell: ({ cell }) => (
          <Text size="sm" fw={600} c={primary} style={{ fontFamily: erpTheme.fontSans }}>
            {cell.getValue<string>() || "-"}
          </Text>
        ),
      },
      {
        id: "local_amount",
        header: "Local Amount",
        size: 130,
        Cell: ({ row }) => calcLocalAmount(row.original.charges),
      },
      {
        accessorKey: "payment_type",
        header: "Type",
        size: 120,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "not_over",
        header: "Over",
        size: 120,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 100,
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {row.original.date
              ? dayjs(String(row.original.date)).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "paid_to_type",
        header: "Paid To Type",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "paid_to",
        header: "Paid To",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        id: "job_no",
        header: "Job Id",
        size: 140,
        Cell: ({ row }) => getFirstJobNo(row.original.charges),
      },
      {
        accessorKey: "note",
        header: "Note",
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Text size="sm" style={{ fontFamily: erpTheme.fontSans, maxWidth: 150 }} truncate title={val}>
              {val}
            </Text>
          );
        },
      },
      {
        accessorKey: "account_note",
        header: "Accountant Note",
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Text size="sm" style={{ fontFamily: erpTheme.fontSans, maxWidth: 150 }} truncate title={val}>
              {val}
            </Text>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
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
        Cell: ({ row }) => (
          <Menu
            withinPortal
            position="bottom-end"
            shadow="md"
            width={220}
            styles={erpListGeistMenuDropdownStyles}
            classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
          >
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {row.original.status?.trim().toLowerCase() !== "approved" &&
                row.original.status?.trim().toLowerCase() !== "rejected" && (
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setStoreFilters(LIST_KEY, buildFilterPayload);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate(`/payment-request/edit/${row.original.id}`);
                    }}
                  >
                    <Group gap="sm">
                      <IconEdit size={16} color={primary} />
                      <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>Edit</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              )}
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    setStoreFilters(LIST_KEY, buildFilterPayload);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate(`/payment-request/view/${row.original.id}`);
                  }}
                >
                  <Group gap="sm">
                    <IconEye size={16} color={primary} />
                    <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>View</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {row.original.status?.trim().toLowerCase() === "approved" && (
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setStoreFilters(LIST_KEY, buildFilterPayload);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate("/supplier-invoice/create", {
                        state: { paymentRequestData: row.original },
                      });
                    }}
                  >
                    <Group gap="sm">
                      <IconFileInvoice size={16} color={primary} />
                      <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                        Create Supplier Invoice
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              )}
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [
      navigate,
      index,
      buildFilterPayload,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
      dateFormat,
      erpTheme,
      primary,
    ],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = paymentRequestColumnId(col);
        if (id === "actions") return true;
        return visibleColumns[id as keyof PaymentRequestColumnVisibility] !== false;
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
    initialState: { pagination: { pageSize: 10, pageIndex: 0 }, columnPinning: { right: ["actions"] } },
    layoutMode: "grid",
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: totalRecords,
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
              zIndex: 2,
              minWidth: "30px",
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
              No payment requests found
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
                  value={listStats.approved}
                  label="Approved"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconClock size={14} color="#d97706" />}
                  iconBackground="#fef3c7"
                  iconColor="#d97706"
                  value={listStats.pending}
                  label="Other"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconBan size={14} color="#b91c1c" />}
                  iconBackground="#fee2e2"
                  iconColor="#b91c1c"
                  value={listStats.rejected}
                  label="Rejected"
                />
              </>
            ),
            // secondary: (
            //   <>
            //     <Text fw={600} size="sm" c={fg} style={{ fontFamily: erpTheme.fontSans }} component="span">
            //       Payment request approval
            //     </Text>
            //     <Group gap={8} wrap="nowrap" align="center">
            //       <IconCoin size={16} color={muted} style={{ flexShrink: 0 }} />
            //       <Text fw={600} size="sm" c={fg} style={{ fontFamily: erpTheme.fontSans }} component="span">
            //         {listStats.pageAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            //       </Text>
            //       <Text size="xs" c={muted} component="span">
            //         local on this page
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
                  onClick={() => setShowFilters((v) => !v)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine by user, request no., job, payment type, paid-to, dates, or status",
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
                      label="User"
                      value={draftCreatedBy}
                      placeholder="Type User"
                      onChange={(e) => setDraftCreatedBy(e.currentTarget.value)}
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Paid To"
                      value={draftPaidTo}
                      placeholder="Type Paid To"
                      onChange={(e) => setDraftPaidTo(e.currentTarget.value)}
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Job Id"
                      value={draftFilters.job_reference ?? ""}
                      placeholder="Type Job Id"
                      onChange={(e) => updateFilter("job_reference", e.currentTarget.value || null)}
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Request Number"
                      value={draftFilters.request_no ?? ""}
                      placeholder="Type Request Number"
                      onChange={(e) => updateFilter("request_no", e.currentTarget.value || null)}
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="Payment Type"
                      placeholder="Select Payment Type"
                      data={["Bank", "Cash", "Online Transfer", "PDC", "DD/PO"]}
                      searchable
                      value={draftFilters.payment_type}
                      onChange={(v) => {
                        const mapped = v === "Cash" ? "CASH" : v === "Online Transfer" ? "ONLINE TRANSFER" : v;
                        updateFilter("payment_type", mapped ?? null);
                      }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="Paid To Type"
                      placeholder="Select Paid To Type"
                      data={["customer", "agent", "supplier", "Vendor"]}
                      searchable
                      value={draftFilters.paid_to_type}
                      onChange={(v) => updateFilter("paid_to_type", v ?? null)}
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
                      onChange={(d) => updateFilter("date_from", d)}
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
                      onChange={(d) => updateFilter("date_to", d)}
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
                      data={[
                        { value: "Active", label: "Active" },
                        { value: "Approved", label: "Approved" },
                        { value: "Rejected", label: "Rejected" },
                      ]}
                      value={draftFilters.status}
                      onChange={(v) => updateFilter("status", v ?? null)}
                      clearable
                      searchable
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
            children: requestError ? (
              <Center py="xl" style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}>
                <Text size="sm" c="dimmed" style={{ fontFamily: erpTheme.fontSans }}>
                  Error loading payment requests. Please try refreshing the page.
                </Text>
              </Center>
            ) : isLoading ? (
              <ERPListTableLoading theme={erpTheme} message="Loading payment requests…" />
            ) : (
              <MantineReactTable table={table} />
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}

export default PaymentRequestApproval;
