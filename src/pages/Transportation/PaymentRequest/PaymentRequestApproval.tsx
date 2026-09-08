import { useCallback, useEffect, useMemo, useState } from "react";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountForUi,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
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
  Loader,
  Select,
  Stack,
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
  ERPListColumnHeaderFilter,
  ERPListHeaderFilterInput,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  SingleDateInput,
  ToastNotification,
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
  id?: number;
  payment_request?: number;
  job_id?: string;
  job_no?: string;
  charge_id?: number | null;
  charge_code?: string;
  charge_name?: string;
  account_code?: string;
  account_name?: string;
  subledger_code?: string;
  narration?: string;
  cn_r?: string;
  currency_code?: string;
  currency_id?: number;
  roe?: string | number;
  unit_code?: string;
  no_of_unit?: number;
  amount_per_unit?: string | number;
  amount?: string | number;
  local_amount?: string | number;
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
  service?: string;
  service_type?: string;
  job_id?: string | number | null;
  shipment_id?: string | null;
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
  request_no: string | null;
  service: string | null;
  service_type: string | null;
  job_reference: string | null;
  shipment_id: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcLocalAmount(charges?: PaymentRequestCharge[]): number {
  if (!charges?.length) return 0;
  return charges.reduce(
    (sum, c) => sum + (c.local_amount ? parseFloat(c.local_amount) : 0),
    0,
  );
}

function displayCellValue(value: unknown): string {
  if (value == null || value === "") return "-";
  return String(value);
}

function formatServiceColumnValue(
  service?: string | null,
  serviceType?: string | null,
): string {
  const svc = String(service ?? "").trim();
  const type = String(serviceType ?? "").trim();
  if (svc && type) return `${svc} / ${type}`;
  return svc || type || "-";
}

function formatServiceFilterDisplay(
  service?: string | null,
  serviceType?: string | null,
): string {
  const svc = String(service ?? "").trim();
  const type = String(serviceType ?? "").trim();
  if (svc && type && svc.toUpperCase() !== type.toUpperCase()) {
    return `${svc} / ${type}`;
  }
  return svc || type || "";
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
  request_no: null,
  service: null,
  service_type: null,
  job_reference: null,
  shipment_id: null,
});

const LIST_KEY = "PAYMENT_REQUEST_APPROVAL";

type PaymentRequestColumnVisibility = {
  sno: boolean;
  created_by: boolean;
  request_no: boolean;
  local_amount: boolean;
  payment_type: boolean;
  service: boolean;
  date: boolean;
  paid_to: boolean;
  job_id: boolean;
  shipment_id: boolean;
  status: boolean;
};

const paymentRequestColumnDefault: PaymentRequestColumnVisibility = {
  sno: true,
  created_by: true,
  request_no: true,
  local_amount: true,
  payment_type: true,
  service: true,
  date: true,
  paid_to: true,
  job_id: true,
  shipment_id: true,
  status: true,
};

const paymentRequestColumnLabels: Record<
  keyof PaymentRequestColumnVisibility,
  string
> = {
  sno: "S.No",
  created_by: "User",
  request_no: "Request No",
  local_amount: "Local Amount",
  payment_type: "Paid Type",
  service: "Service",
  date: "Date",
  paid_to: "Paid To",
  job_id: "Job Id",
  shipment_id: "Shipment Id",
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
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const dateFormat = useDateFormat();

  const [showFilters, setShowFilters] = useState(false);
  // draftFilters: what user is editing in the panel; appliedFilters: what drives the query
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters());
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(emptyFilters());
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
  const [debouncedSearch] = useDebouncedValue(search, 1000);

  const [visibleColumns, setVisibleColumns] =
    useState<PaymentRequestColumnVisibility>(() => ({
      ...paymentRequestColumnDefault,
    }));

  /**
   * Column-header filtering: which header is currently in "edit" mode.
   * Lifted to the page so opening a new header collapses any prior editor,
   * and so the editor state survives MRT re-renders triggered by filter
   * changes flowing through the column memo's deps.
   */
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId(id);
  }, []);
  const collapseHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId((cur) => (cur === id ? null : cur));
  }, []);

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
        request_no: (f.request_no as string) ?? null,
        service: (f.service as string) ?? null,
        service_type: (f.service_type as string) ?? null,
        job_reference: (f.job_reference as string) ?? null,
        shipment_id: (f.shipment_id as string) ?? null,
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
    if (appliedFilters.date_from)
      payload.date_from = dayjs(appliedFilters.date_from).format("YYYY-MM-DD");
    if (appliedFilters.date_to)
      payload.date_to = dayjs(appliedFilters.date_to).format("YYYY-MM-DD");
    if (appliedFilters.payment_type)
      payload.payment_type = appliedFilters.payment_type;
    if (appliedFilters.request_no?.trim())
      payload.request_no = appliedFilters.request_no.trim();
    if (appliedFilters.service?.trim())
      payload.service = appliedFilters.service.trim();
    if (appliedFilters.service_type?.trim())
      payload.service_type = appliedFilters.service_type.trim();
    if (appliedFilters.job_reference?.trim())
      payload.job_reference = appliedFilters.job_reference.trim();
    if (appliedFilters.shipment_id?.trim())
      payload.shipment_id = appliedFilters.shipment_id.trim();
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
    queryKey: [
      "paymentRequestApproval",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(buildFilterPayload),
      debouncedSearch,
    ],
    queryFn: async (): Promise<PaymentRequestListQueryResult> => {
      try {
        const filtersWithSearch: Record<string, unknown> = {
          ...buildFilterPayload,
        };
        if (debouncedSearch?.trim())
          filtersWithSearch.search = debouncedSearch.trim();

        const payload =
          Object.keys(filtersWithSearch).length > 0
            ? { filters: filtersWithSearch }
            : { filters: {} };

        setIsInitialLoad(false);

        const response = (await apiCallProtected.post(
          `${URL.paymentRequestFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        )) as Record<string, unknown>;

        const raw = response as Record<string, unknown> & { summary?: unknown };
        const bodyCandidate =
          raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body =
          bodyCandidate != null
            ? (bodyCandidate as
                | PaymentRequestFilterResponse
                | PaymentRequestRecord[])
            : null;
        if (!body) {
          setTotalRecords(0);
          return { data: [], summary: undefined };
        }

        const list: PaymentRequestRecord[] = Array.isArray(
          (body as PaymentRequestFilterResponse).data,
        )
          ? ((body as PaymentRequestFilterResponse)
              .data as PaymentRequestRecord[])
          : Array.isArray(body)
            ? (body as PaymentRequestRecord[])
            : [];

        const totalEnvelope =
          body != null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          ("total" in body || "index" in body)
            ? (body as unknown as Record<string, unknown>)
            : (raw as Record<string, unknown>);
        const listTotal = getBookingShipmentFilterListTotal(
          totalEnvelope,
          list,
          index,
        );

        const rawSummary = raw?.summary;
        const summary: PaymentRequestListSummary | undefined =
          rawSummary &&
          typeof rawSummary === "object" &&
          !Array.isArray(rawSummary)
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
    const totalPages = Math.max(
      1,
      Math.ceil(totalRecords / pagination.pageSize),
    );
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
      pageAmount += calcLocalAmount(r.charges) || 0;
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
      (
        Object.keys(visibleColumns) as (keyof PaymentRequestColumnVisibility)[]
      ).map((key) => ({
        id: String(key),
        label: paymentRequestColumnLabels[key],
        checked: visibleColumns[key],
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
          })),
      })),
    [visibleColumns],
  );

  // ─── Filter actions ───────────────────────────────────────────────────────

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handlePageSizeChange = (newPageSize: number) =>
    setPagination({ pageIndex: 0, pageSize: newPageSize });

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

  /**
   * Header-filter writes update BOTH draft and applied state at once (instant
   * filtering, mirroring the EnquiryMaster column-header UX). Supports the
   * three filter-state buckets used by this page (FilterState +
   * appliedCreatedBy + appliedPaidTo), keeps the advanced filter section in
   * sync, resets pagination to page 1, and persists the new payload to the
   * global list-filter store so values survive navigation.
   */
  const commitHeaderFilters = useCallback(
    (next: {
      filters?: (prev: FilterState) => FilterState;
      createdBy?: string;
      paidTo?: string;
    }) => {
      const nextFilters = next.filters
        ? next.filters(draftFilters)
        : draftFilters;
      const nextCreatedBy =
        next.createdBy !== undefined ? next.createdBy : appliedCreatedBy;
      const nextPaidTo =
        next.paidTo !== undefined ? next.paidTo : appliedPaidTo;
      if (next.filters) {
        setDraftFilters(nextFilters);
        setAppliedFilters(nextFilters);
      }
      if (next.createdBy !== undefined) {
        setDraftCreatedBy(nextCreatedBy);
        setAppliedCreatedBy(nextCreatedBy);
      }
      if (next.paidTo !== undefined) {
        setDraftPaidTo(nextPaidTo);
        setAppliedPaidTo(nextPaidTo);
      }
      setPagination((p) => ({ ...p, pageIndex: 0 }));
      const payload: Record<string, unknown> = {};
      if (nextFilters.status) payload.status = nextFilters.status;
      if (nextFilters.date_from)
        payload.date_from = dayjs(nextFilters.date_from).format("YYYY-MM-DD");
      if (nextFilters.date_to)
        payload.date_to = dayjs(nextFilters.date_to).format("YYYY-MM-DD");
      if (nextFilters.payment_type)
        payload.payment_type = nextFilters.payment_type;
      if (nextFilters.request_no?.trim())
        payload.request_no = nextFilters.request_no.trim();
      if (nextFilters.service?.trim())
        payload.service = nextFilters.service.trim();
      if (nextFilters.service_type?.trim())
        payload.service_type = nextFilters.service_type.trim();
      if (nextFilters.job_reference?.trim())
        payload.job_reference = nextFilters.job_reference.trim();
      if (nextFilters.shipment_id?.trim())
        payload.shipment_id = nextFilters.shipment_id.trim();
      if (nextCreatedBy.trim()) payload.created_by = nextCreatedBy.trim();
      if (nextPaidTo.trim()) payload.paid_to = nextPaidTo.trim();
      setStoreFilters(LIST_KEY, payload);
    },
    [draftFilters, appliedCreatedBy, appliedPaidTo, setStoreFilters],
  );

  // ─── Columns ──────────────────────────────────────────────────────────────

  const allColumns = useMemo<MRT_ColumnDef<PaymentRequestRecord>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 48,
        grow: false,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => index + row.index + 1,
      },
      {
        accessorKey: "created_by",
        header: "User",
        size: 100,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="User"
            value={appliedCreatedBy}
            displayValue={appliedCreatedBy}
            theme={erpTheme}
            placeholder="Filter User"
            isEditing={editingHeaderId === "created_by"}
            onStartEdit={() => openHeaderEditor("created_by")}
            onStopEdit={() => collapseHeaderEditor("created_by")}
            onChange={(nextVal) => commitHeaderFilters({ createdBy: nextVal })}
          />
        ),
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "request_no",
        header: "Request No",
        size: 128,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Request No"
            value={appliedFilters.request_no ?? ""}
            displayValue={appliedFilters.request_no ?? ""}
            theme={erpTheme}
            placeholder="Filter Request No"
            isEditing={editingHeaderId === "request_no"}
            onStartEdit={() => openHeaderEditor("request_no")}
            onStopEdit={() => collapseHeaderEditor("request_no")}
            onChange={(nextVal) =>
              commitHeaderFilters({
                filters: (prev) => ({ ...prev, request_no: nextVal || null }),
              })
            }
          />
        ),
        Cell: ({ cell }) => (
          <Text
            size="sm"
            fw={600}
            c={primary}
            style={{ fontFamily: erpTheme.fontSans }}
          >
            {cell.getValue<string>() || "-"}
          </Text>
        ),
      },
      {
        id: "local_amount",
        header: "Local Amount",
        size: 108,
        grow: false,
        Cell: ({ row }) => formatMoneyAmountForUi(calcLocalAmount(row.original.charges)),
      },
      {
        accessorKey: "payment_type",
        header: "Type",
        size: 128,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Paid Type"
            value={appliedFilters.payment_type ?? ""}
            displayValue={appliedFilters.payment_type ?? ""}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "payment_type"}
            onStartEdit={() => openHeaderEditor("payment_type")}
            onStopEdit={() => collapseHeaderEditor("payment_type")}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                placeholder="Select Payment Type"
                searchable
                clearable
                size="xs"
                data={["Bank", "Cash", "Online Transfer", "PDC", "DD/PO"]}
                value={appliedFilters.payment_type ?? ""}
                onChange={(v) => {
                  /*
                   * Mirror the advanced filter section's value mapping so the
                   * payload stays identical regardless of which input the
                   * user touches.
                   */
                  const mapped =
                    v === "Cash"
                      ? "CASH"
                      : v === "Online Transfer"
                        ? "ONLINE TRANSFER"
                        : v;
                  commitHeaderFilters({
                    filters: (prev) => ({
                      ...prev,
                      payment_type: mapped ?? null,
                    }),
                  });
                  if (v) onClose();
                }}
                comboboxProps={{ zIndex: 1000 }}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
            )}
          />
        ),
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "service",
        header: "Service",
        size: 160,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Service"
            value={formatServiceFilterDisplay(
              appliedFilters.service,
              appliedFilters.service_type,
            )}
            displayValue={formatServiceFilterDisplay(
              appliedFilters.service,
              appliedFilters.service_type,
            )}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "service"}
            onStartEdit={() => openHeaderEditor("service")}
            onStopEdit={() => collapseHeaderEditor("service")}
            renderEditor={() => (
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  width: "100%",
                  minWidth: 0,
                }}
              >
                <ERPListHeaderFilterInput
                  value={appliedFilters.service ?? ""}
                  onChange={(nextVal) =>
                    commitHeaderFilters({
                      filters: (prev) => ({
                        ...prev,
                        service: nextVal ? nextVal.trim().toUpperCase() : null,
                      }),
                    })
                  }
                  placeholder="Service"
                  ariaLabel="Filter Service"
                  autoFocus
                />
                <ERPListHeaderFilterInput
                  value={appliedFilters.service_type ?? ""}
                  onChange={(nextVal) =>
                    commitHeaderFilters({
                      filters: (prev) => ({
                        ...prev,
                        service_type: nextVal
                          ? nextVal.trim().toUpperCase()
                          : null,
                      }),
                    })
                  }
                  placeholder="Type"
                  ariaLabel="Filter Service Type"
                />
              </Box>
            )}
          />
        ),
        Cell: ({ row }) =>
          formatServiceColumnValue(
            row.original.service,
            row.original.service_type,
          ),
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 108,
        grow: false,
        Cell: ({ row }) => (
          <Text
            size="sm"
            style={{ fontFamily: erpTheme.fontSans, whiteSpace: "nowrap" }}
          >
            {row.original.date
              ? dayjs(String(row.original.date)).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "paid_to",
        header: "Paid To",
        size: 120,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Paid To"
            value={appliedPaidTo}
            displayValue={appliedPaidTo}
            theme={erpTheme}
            placeholder="Filter Paid To"
            isEditing={editingHeaderId === "paid_to"}
            onStartEdit={() => openHeaderEditor("paid_to")}
            onStopEdit={() => collapseHeaderEditor("paid_to")}
            onChange={(nextVal) => commitHeaderFilters({ paidTo: nextVal })}
          />
        ),
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "job_id",
        header: "Job Id",
        size: 140,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Job Id"
            value={appliedFilters.job_reference ?? ""}
            displayValue={appliedFilters.job_reference ?? ""}
            theme={erpTheme}
            placeholder="Filter Job Id"
            isEditing={editingHeaderId === "job_id"}
            onStartEdit={() => openHeaderEditor("job_id")}
            onStopEdit={() => collapseHeaderEditor("job_id")}
            onChange={(nextVal) =>
              commitHeaderFilters({
                filters: (prev) => ({
                  ...prev,
                  job_reference: nextVal || null,
                }),
              })
            }
          />
        ),
        Cell: ({ row }) => (
          <Text
            size="sm"
            style={{ fontFamily: erpTheme.fontSans, whiteSpace: "nowrap" }}
          >
            {displayCellValue(row.original.job_id)}
          </Text>
        ),
      },
      {
        accessorKey: "shipment_id",
        header: "Shipment Id",
        size: 160,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Shipment Id"
            value={appliedFilters.shipment_id ?? ""}
            displayValue={appliedFilters.shipment_id ?? ""}
            theme={erpTheme}
            placeholder="Filter Shipment Id"
            isEditing={editingHeaderId === "shipment_id"}
            onStartEdit={() => openHeaderEditor("shipment_id")}
            onStopEdit={() => collapseHeaderEditor("shipment_id")}
            onChange={(nextVal) =>
              commitHeaderFilters({
                filters: (prev) => ({
                  ...prev,
                  shipment_id: nextVal || null,
                }),
              })
            }
          />
        ),
        Cell: ({ row }) => (
          <Text
            size="sm"
            style={{ fontFamily: erpTheme.fontSans, whiteSpace: "nowrap" }}
          >
            {displayCellValue(row.original.shipment_id)}
          </Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 96,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Status"
            value={appliedFilters.status ?? ""}
            displayValue={appliedFilters.status ?? ""}
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
                data={[
                  { value: "Active", label: "Active" },
                  { value: "Approved", label: "Approved" },
                  { value: "Rejected", label: "Rejected" },
                ]}
                value={appliedFilters.status ?? ""}
                onChange={(v) => {
                  commitHeaderFilters({
                    filters: (prev) => ({ ...prev, status: v ?? null }),
                  });
                  if (v) onClose();
                }}
                comboboxProps={{ zIndex: 1000 }}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
            )}
          />
        ),
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
        size: 56,
        grow: false,
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
                        navigate(`/payment-request/edit/${row.original.id}`, {
                          state: {
                            fromPaymentRequestApproval: true,
                            returnTo: "/payment-request-approval",
                          },
                        });
                      }}
                    >
                      <Group gap="sm">
                        <IconEdit size={16} color={primary} />
                        <Text
                          size="sm"
                          style={{ fontFamily: erpTheme.fontSans }}
                        >
                          Edit
                        </Text>
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
                    navigate(`/payment-request/view/${row.original.id}`, {
                      state: {
                        fromPaymentRequestApproval: true,
                        returnTo: "/payment-request-approval",
                      },
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
              {row.original.status?.trim().toLowerCase() === "approved" && (
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={async () => {
                      try {
                        const raw = await apiCallProtected.get(
                          `${URL.paymentRequest}${row.original.id}/`,
                        );
                        const prData =
                          (raw as { data?: { data?: PaymentRequestRecord } })
                            ?.data?.data ??
                          (raw as { data?: PaymentRequestRecord })?.data ??
                          row.original;
                        setStoreFilters(LIST_KEY, buildFilterPayload);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate("/supplier-invoice/create", {
                          state: { paymentRequestData: prData },
                        });
                      } catch {
                        ToastNotification({
                          type: "error",
                          message: "Failed to load payment request details.",
                        });
                      }
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
      appliedFilters,
      appliedCreatedBy,
      appliedPaidTo,
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
        const id = paymentRequestColumnId(col);
        if (id === "actions") return true;
        return (
          visibleColumns[id as keyof PaymentRequestColumnVisibility] !== false
        );
      }),
    [allColumns, visibleColumns],
  );

  // ─── Table ────────────────────────────────────────────────────────────────

  const table = useMantineReactTable({
    columns,
    /*
     * During a fetch we pass an empty data array so MRT renders
     * `renderEmptyRowsFallback` (the loader) inside `<tbody>` while keeping
     * `<thead>` (with the column-header filter inputs) and the pagination
     * footer mounted. Mirrors EnquiryListNativeTables' loader-in-body UX.
     */
    data: isLoading ? [] : tableData,
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
    defaultColumn: { grow: false },
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
    mantineTableBodyCellProps: ({ column }) => {
      const colSize = column.getSize();
      return {
        style: {
          /*
           * Pin cell width to the column's declared `size` so the column
           * cannot resize when its header swaps between the static label
           * and the inline filter editor.
           */
          width: colSize,
          minWidth: colSize,
          maxWidth: colSize,
          padding: "6px 8px",
          fontSize: 13,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: cardBg,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          ...(column.id === "actions"
            ? {
                // Pinned-right Actions cell. `minWidth` matches the head cell
                // so the sticky body cell and sticky head cell stay the same
                // width. `zIndex: 2` stays BELOW the sticky head (`zIndex: 4`)
                // so the head paints over the body cell at the corner.
                position: "sticky" as const,
                right: 0,
                zIndex: 2,
                minWidth: "56px",
                borderLeft: `1px solid ${border}`,
                boxShadow: "1px -2px 4px 0px #00000040",
              }
            : {}),
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const colSize = column.getSize();
      return {
        style: {
          /*
           * Pin head cell width to the column's declared `size` (matches the
           * body cell width) so toggling between the column label and the
           * inline filter editor never resizes the header.
           */
          width: colSize,
          minWidth: colSize,
          maxWidth: colSize,
          padding: "6px 8px",
          fontSize: 13,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          top: 0,
          zIndex: 3,
          borderBottom: `1px solid ${border}`,
          /*
           * Stable header cell height so swapping between the column label
           * and the inline filter editor never resizes the row.
           */
          minHeight: 52,
          height: 52,
          verticalAlign: "middle" as const,
          ...(column.id === "actions"
            ? {
                position: "sticky" as const,
                right: 0,
                zIndex: 4,
                minWidth: "56px",
                backgroundColor: erpTheme.headerBg,
                boxShadow: "0px -2px 4px 0px #00000040",
              }
            : {}),
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
    renderEmptyRowsFallback: () => (
      <Center
        py={80}
        style={{ width: "100%", backgroundColor: cardBg }}
        className="erp-header-filter-fade"
      >
        {isLoading ? (
          <Stack align="center" gap="md">
            <Loader size="lg" color={primary} />
            <Text
              c="dimmed"
              size="sm"
              style={{ fontFamily: erpTheme.fontSans }}
            >
              Loading payment requests…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            No payment requests found
          </Text>
        )}
      </Center>
    ),
  });

  // ─── Render ───────────────────────────────────────────────────────────────

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
            subtitle:
              "Refine by user, request no., type, date range, paid to, job id, shipment id, or status",
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
                      format="capital"
                      label="Request No"
                      value={draftFilters.request_no ?? ""}
                      placeholder="Type Request No"
                      onChange={(e) =>
                        updateFilter(
                          "request_no",
                          e.currentTarget.value || null,
                        )
                      }
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
                      label="Type"
                      placeholder="Select Type"
                      data={["Bank", "Cash", "Online Transfer", "PDC", "DD/PO"]}
                      searchable
                      value={draftFilters.payment_type}
                      onChange={(v) => {
                        const mapped =
                          v === "Cash"
                            ? "CASH"
                            : v === "Online Transfer"
                              ? "ONLINE TRANSFER"
                              : v;
                        updateFilter("payment_type", mapped ?? null);
                      }}
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
                      format="capital"
                      label="Job Id"
                      value={draftFilters.job_reference ?? ""}
                      placeholder="Type Job Id"
                      onChange={(e) =>
                        updateFilter(
                          "job_reference",
                          e.currentTarget.value || null,
                        )
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
                      format="capital"
                      label="Shipment Id"
                      value={draftFilters.shipment_id ?? ""}
                      placeholder="Type Shipment Id"
                      onChange={(e) =>
                        updateFilter(
                          "shipment_id",
                          e.currentTarget.value || null,
                        )
                      }
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
              <Center
                py="xl"
                style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}
              >
                <Text
                  size="sm"
                  c="dimmed"
                  style={{ fontFamily: erpTheme.fontSans }}
                >
                  Error loading payment requests. Please try refreshing the
                  page.
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

export default PaymentRequestApproval;
