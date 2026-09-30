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
  Badge,
  Grid,
  Loader,
  Select,
  Stack,
  TextInput,
  Tooltip,
  MantineProvider,
  Modal,
  Table,
  Textarea,
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
  IconListDetails,
  IconSearch,
  IconX,
  IconBan,
  IconPackage,
  IconCircleX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import {
  Dropdown,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  SearchableSelect,
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
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";
import useDateFormat from "../../../hooks/useDateFormat";
import { useViewAllocationDocs } from "../../../hooks/useViewAllocationDocs";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import {
  getApiFailureMessage,
  getServerErrorMessage,
  unwrapApiStatusBody,
} from "../../../utils/apiErrorMessage";

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
  /** Master job id string (not an array). */
  job_id?: string | number | null;
  /** One or more shipment ids from the list API. */
  shipment_id?: string | string[] | null;
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
  service_code: string | null;
  service_display: string | null;
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

function formatJobIdCell(jobId: unknown): string {
  if (jobId == null || jobId === "") return "-";
  // List API returns a single job id string — never treat as array.
  if (Array.isArray(jobId)) {
    const first = jobId.find((v) => String(v ?? "").trim() !== "");
    return first != null ? String(first) : "-";
  }
  return String(jobId);
}

function formatShipmentIdCell(shipmentId: unknown): string {
  if (shipmentId == null || shipmentId === "") return "-";
  if (Array.isArray(shipmentId)) {
    const parts = shipmentId
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
  }
  return String(shipmentId);
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

const PAYMENT_REQUEST_PAGE_SIZES = [10, 25, 50] as const;

function parseStoredPageSize(value: unknown): number | null {
  const size = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(size)) return null;
  return (PAYMENT_REQUEST_PAGE_SIZES as readonly number[]).includes(size)
    ? size
    : null;
}

function statusColor(status?: string): string {
  if (!status) return "gray";
  switch (status.toLowerCase()) {
    case "posted":
      return "green";
    case "approved":
      return "orange";
    case "override":
      return "violet";
    case "rejected":
      return "red";
    case "unapproved":
      return "yellow";
    case "unposted":
      return "blue";
    default:
      return "gray";
  }
}

function buildPaymentRequestListPayload(
  filters: FilterState,
  createdBy: string,
  paidTo: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (filters.status) payload.status = filters.status;
  if (filters.date_from)
    payload.date_from = dayjs(filters.date_from).format("YYYY-MM-DD");
  if (filters.date_to)
    payload.date_to = dayjs(filters.date_to).format("YYYY-MM-DD");
  if (filters.payment_type) payload.payment_type = filters.payment_type;
  if (filters.request_no?.trim())
    payload.request_no = filters.request_no.trim();
  if (filters.service_code?.trim())
    payload.service_code = filters.service_code.trim();
  if (filters.job_reference?.trim())
    payload.job_reference = filters.job_reference.trim();
  if (filters.shipment_id?.trim())
    payload.shipment_id = filters.shipment_id.trim();
  if (createdBy.trim()) payload.created_by = createdBy.trim();
  if (paidTo.trim()) payload.paid_to = paidTo.trim();
  return payload;
}

function withPaymentRequestListUiState(
  payload: Record<string, unknown>,
  pageSize: number,
  serviceDisplay: string | null | undefined,
): Record<string, unknown> {
  const stored: Record<string, unknown> = { ...payload, pageSize };
  const label = String(serviceDisplay ?? "").trim();
  if (label) stored.service_display = label;
  return stored;
}

const emptyFilters = (overrideMode = false): FilterState => ({
  status: overrideMode ? "Active" : null,
  date_from: dayjs().startOf("month").toDate(),
  date_to: dayjs().toDate(),
  payment_type: null,
  request_no: null,
  service_code: null,
  service_display: null,
  job_reference: null,
  shipment_id: null,
});

const LIST_KEY_APPROVAL = "PAYMENT_REQUEST_APPROVAL";
const LIST_KEY_OVERRIDE = "PAYMENT_REQUEST_OVERRIDE_APPROVAL";

type PendingActiveJobRow = {
  job_id: string;
  shipment_no: string[];
};

function readStoredPageSize(listKey: string): number {
  const stored = useListFilterStore.getState().getState(listKey);
  if (stored?.shouldRestore !== true) return 25;
  return parseStoredPageSize(stored.filters?.pageSize) ?? 25;
}

export type PaymentRequestApprovalMode = "approval" | "override";

type PaymentRequestApprovalProps = {
  mode?: PaymentRequestApprovalMode;
};

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

function PaymentRequestApproval({
  mode = "approval",
}: PaymentRequestApprovalProps) {
  const isOverrideMode = mode === "override";
  const LIST_KEY = isOverrideMode ? LIST_KEY_OVERRIDE : LIST_KEY_APPROVAL;
  const listReturnTo = isOverrideMode
    ? "/payment-request-override-approval"
    : "/payment-request-approval";

  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const navigate = useNavigate();
  const location = useLocation();
  const { openViewAllocationDocs, viewAllocationDocsUi } =
    useViewAllocationDocs();
  const [pagination, setPagination] = useState<MRT_PaginationState>(() => ({
    pageIndex: 0,
    pageSize: readStoredPageSize(
      mode === "override" ? LIST_KEY_OVERRIDE : LIST_KEY_APPROVAL,
    ),
  }));
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const dateFormat = useDateFormat();

  const [showFilters, setShowFilters] = useState(false);
  // draftFilters: what user is editing in the panel; appliedFilters: what drives the query
  const [draftFilters, setDraftFilters] = useState<FilterState>(() =>
    emptyFilters(mode === "override"),
  );
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() =>
    emptyFilters(mode === "override"),
  );
  const [
    pendingShipmentsOpened,
    { open: openPendingShipments, close: closePendingShipments },
  ] = useDisclosure(false);
  const [pendingShipmentsLoading, setPendingShipmentsLoading] = useState(false);
  const [pendingShipments, setPendingShipments] = useState<
    PendingActiveJobRow[]
  >([]);
  const [pendingShipmentsContext, setPendingShipmentsContext] = useState("");
  const [
    rejectModalOpened,
    { open: openRejectModal, close: closeRejectModal },
  ] = useDisclosure(false);
  const [rejectTarget, setRejectTarget] =
    useState<PaymentRequestRecord | null>(null);
  const [rejectedNote, setRejectedNote] = useState("");
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [statusActionLabel, setStatusActionLabel] = useState(
    "Updating payment request…",
  );
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

    const storedFilters =
      stored?.filters && typeof stored.filters === "object"
        ? (stored.filters as Record<string, unknown>)
        : null;

    if (storedFilters) {
      const f = storedFilters;
      const restored: FilterState = {
        status:
          (f.status as string) ?? (isOverrideMode ? "Active" : null),
        date_from: f.date_from ? new Date(f.date_from as string) : null,
        date_to: f.date_to ? new Date(f.date_to as string) : null,
        payment_type: (f.payment_type as string) ?? null,
        request_no: (f.request_no as string) ?? null,
        service_code: (f.service_code as string) ?? null,
        service_display: (f.service_display as string) ?? null,
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

    const restoredPageSize = parseStoredPageSize(storedFilters?.pageSize);
    setPagination((p) => ({
      ...p,
      pageIndex: 0,
      ...(restoredPageSize != null ? { pageSize: restoredPageSize } : {}),
    }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const index = pagination.pageIndex * pagination.pageSize;

  // ─── Build filter payload ─────────────────────────────────────────────────

  const buildFilterPayload = useMemo(() => {
    const payload = buildPaymentRequestListPayload(
      appliedFilters,
      appliedCreatedBy,
      appliedPaidTo,
    );
    if (isOverrideMode) {
      payload.status = "Active";
      payload.override = true;
    }
    return payload;
  }, [appliedFilters, appliedCreatedBy, appliedPaidTo, isOverrideMode]);

  const openPendingShipmentsForRow = useCallback(
    async (row: PaymentRequestRecord) => {
      const subledgerCode = String(row.subledger_code ?? "").trim();
      const jobId = formatJobIdCell(row.job_id);
      if (!subledgerCode || !jobId || jobId === "-") {
        ToastNotification({
          type: "error",
          message: "Subledger code and Job Id are required for pending shipments.",
        });
        return;
      }
      setPendingShipmentsContext(
        [row.request_no, row.paid_to].filter(Boolean).join(" · "),
      );
      setPendingShipments([]);
      openPendingShipments();
      setPendingShipmentsLoading(true);
      try {
        const raw = (await apiCallProtected.post(
          URL.paymentRequestRemainingActiveJobs,
          { subledger_code: subledgerCode, job_id: jobId },
        )) as unknown;
        const failureMessage = getApiFailureMessage(
          raw,
          "Failed to load pending shipments.",
        );
        if (failureMessage) {
          ToastNotification({ type: "error", message: failureMessage });
          return;
        }
        const body = unwrapApiStatusBody(raw) as {
          data?: PendingActiveJobRow[];
        };
        const rows = Array.isArray(body?.data)
          ? body.data
          : Array.isArray((raw as { data?: unknown })?.data)
            ? ((raw as { data: PendingActiveJobRow[] }).data)
            : [];
        setPendingShipments(
          rows.map((r) => ({
            job_id: String(r.job_id ?? ""),
            shipment_no: Array.isArray(r.shipment_no)
              ? r.shipment_no.map((s) => String(s))
              : [],
          })),
        );
      } catch (error: unknown) {
        ToastNotification({
          type: "error",
          message: getServerErrorMessage(
            error,
            "Failed to load pending shipments.",
          ),
        });
      } finally {
        setPendingShipmentsLoading(false);
      }
    },
    [openPendingShipments],
  );

  const persistListState = useCallback(
    (
      payload: Record<string, unknown>,
      options?: { pageSize?: number; serviceDisplay?: string | null },
    ) => {
      const pageSize = options?.pageSize ?? pagination.pageSize;
      const serviceDisplay =
        options && "serviceDisplay" in options
          ? options.serviceDisplay
          : appliedFilters.service_display;
      setStoreFilters(
        LIST_KEY,
        withPaymentRequestListUiState(payload, pageSize, serviceDisplay),
      );
    },
    [appliedFilters.service_display, pagination.pageSize, setStoreFilters],
  );

  // ─── Queries ──────────────────────────────────────────────────────────────

  const {
    data: paymentRequestListResult,
    isLoading: requestLoading,
    isFetching: requestFetching,
    error: requestError,
    refetch: refetchPaymentRequests,
  } = useQuery<PaymentRequestListQueryResult>({
    queryKey: [
      isOverrideMode ? "paymentRequestOverrideApproval" : "paymentRequestApproval",
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

  const patchPaymentRequestStatus = useCallback(
    async (
      row: PaymentRequestRecord,
      status: "Approved" | "Rejected",
      rejectedNoteValue?: string,
    ) => {
      setStatusActionLabel(
        status === "Approved"
          ? "Approving payment request…"
          : "Rejecting payment request…",
      );
      setStatusActionLoading(true);
      try {
        const payload: Record<string, unknown> = {
          id: row.id,
          status,
        };
        if (status === "Rejected") {
          payload.rejected_note = rejectedNoteValue?.trim() || null;
        }
        const raw = (await apiCallProtected.patch(
          `${URL.paymentRequest}${row.id}/`,
          payload,
          API_HEADER,
        )) as unknown;
        const failureMessage = getApiFailureMessage(
          raw,
          `Failed to ${status === "Approved" ? "approve" : "reject"} payment request.`,
        );
        if (failureMessage) {
          ToastNotification({ type: "error", message: failureMessage });
          return false;
        }
        ToastNotification({
          type: "success",
          message:
            status === "Approved"
              ? "Payment request approved successfully."
              : "Payment request rejected successfully.",
        });
        await refetchPaymentRequests();
        return true;
      } catch (error: unknown) {
        ToastNotification({
          type: "error",
          message: getServerErrorMessage(
            error,
            `Failed to ${status === "Approved" ? "approve" : "reject"} payment request.`,
          ),
        });
        return false;
      } finally {
        setStatusActionLoading(false);
      }
    },
    [refetchPaymentRequests],
  );

  const handleOverrideApprove = useCallback(
    (row: PaymentRequestRecord) => {
      void patchPaymentRequestStatus(row, "Approved");
    },
    [patchPaymentRequestStatus],
  );

  const handleOverrideRejectClick = useCallback(
    (row: PaymentRequestRecord) => {
      setRejectTarget(row);
      setRejectedNote("");
      openRejectModal();
    },
    [openRejectModal],
  );

  const confirmOverrideReject = useCallback(async () => {
    if (!rejectTarget) return;
    if (!rejectedNote.trim()) {
      ToastNotification({
        type: "error",
        message: "Rejected note is required.",
      });
      return;
    }
    const ok = await patchPaymentRequestStatus(
      rejectTarget,
      "Rejected",
      rejectedNote,
    );
    if (ok) {
      closeRejectModal();
      setRejectTarget(null);
      setRejectedNote("");
    }
  }, [
    closeRejectModal,
    patchPaymentRequestStatus,
    rejectTarget,
    rejectedNote,
  ]);

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

  // While approve/reject overlay is up, ignore list refetch so a second
  // table-body loader does not show behind the status action overlay.
  const isLoading =
    !statusActionLoading &&
    (requestLoading || requestFetching || isInitialLoad);
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
      else if (
        s === "approved" ||
        s === "approved_without_crj" ||
        s === "posted"
      )
        approved += 1;
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

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({ pageIndex: 0, pageSize: newPageSize });
    persistListState(buildFilterPayload, { pageSize: newPageSize });
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setAppliedCreatedBy(draftCreatedBy);
    setAppliedPaidTo(draftPaidTo);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    persistListState(
      buildPaymentRequestListPayload(
        draftFilters,
        draftCreatedBy,
        draftPaidTo,
      ),
      {
        serviceDisplay: draftFilters.service_display,
      },
    );
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    const empty = emptyFilters(isOverrideMode);
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
      persistListState(
        buildPaymentRequestListPayload(
          nextFilters,
          nextCreatedBy,
          nextPaidTo,
        ),
        { serviceDisplay: nextFilters.service_display },
      );
    },
    [
      draftFilters,
      appliedCreatedBy,
      appliedPaidTo,
      persistListState,
    ],
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
        Cell: ({ cell }) => {
          const value = cell.getValue<string>() || "-";
          if (value === "-") return value;
          return (
            <Tooltip label={value} withArrow withinPortal>
              <Text
                size="sm"
                truncate
                style={{ fontFamily: erpTheme.fontSans, maxWidth: "100%" }}
              >
                {value}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "service",
        header: "Service",
        size: 96,
        grow: false,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Service"
            value={appliedFilters.service_code ?? ""}
            displayValue={appliedFilters.service_display ?? ""}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "service"}
            onStartEdit={() => openHeaderEditor("service")}
            onStopEdit={() => collapseHeaderEditor("service")}
            renderEditor={({ autoFocus }) => (
              <SearchableSelect
                autoFocus={autoFocus}
                size="xs"
                placeholder="Service"
                apiEndpoint={URL.serviceMaster}
                searchFields={["service_code", "service_name"]}
                minSearchLength={1}
                dropdownZIndex={1000}
                returnOriginalData
                value={appliedFilters.service_code || null}
                displayValue={appliedFilters.service_display || undefined}
                displayFormat={(item) => ({
                  value: String(item.service_code ?? ""),
                  label: String(item.service_code ?? ""),
                })}
                onChange={(value) => {
                  const code = String(value ?? "").trim();
                  commitHeaderFilters({
                    filters: (prev) => ({
                      ...prev,
                      service_code: code || null,
                      service_display: code || null,
                    }),
                  });
                }}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
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
        Cell: ({ cell }) => {
          const value = cell.getValue<string>() || "-";
          if (value === "-") return value;
          return (
            <Tooltip label={value} withArrow withinPortal>
              <Text
                size="sm"
                truncate
                style={{ fontFamily: erpTheme.fontSans, maxWidth: "100%" }}
              >
                {value}
              </Text>
            </Tooltip>
          );
        },
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
            {formatJobIdCell(row.original.job_id)}
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
        Cell: ({ row }) => {
          const shipmentLabel = formatShipmentIdCell(row.original.shipment_id);
          if (shipmentLabel === "-") return shipmentLabel;
          return (
            <Tooltip label={shipmentLabel} withArrow withinPortal>
              <Text
                size="sm"
                truncate
                style={{ fontFamily: erpTheme.fontSans, maxWidth: "100%" }}
              >
                {shipmentLabel}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 96,
        grow: false,
        Header: () =>
          isOverrideMode ? (
            <Text size="xs" fw={600} style={{ fontFamily: erpTheme.fontSans }}>
              Status
            </Text>
          ) : (
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
                    { value: "Override", label: "Override" },
                    { value: "Posted", label: "Posted" },
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
            closeOnItemClick
            styles={erpListGeistMenuDropdownStyles}
            classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
          >
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {isOverrideMode ? (
                <>
                  <Menu.Item
                    leftSection={<IconPackage size={16} color={primary} />}
                    onClick={() => void openPendingShipmentsForRow(row.original)}
                  >
                    Pending Shipments
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconCircleCheck size={16} color={primary} />}
                    disabled={statusActionLoading}
                    onClick={() => handleOverrideApprove(row.original)}
                  >
                    Approve
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconCircleX size={16} color="#b91c1c" />}
                    disabled={statusActionLoading}
                    onClick={() => handleOverrideRejectClick(row.original)}
                  >
                    Reject
                  </Menu.Item>
                </>
              ) : (
                <>
                  <Menu.Item
                    leftSection={<IconEye size={16} color={primary} />}
                    onClick={() => {
                      persistListState(buildFilterPayload);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate(`/payment-request/view/${row.original.id}`, {
                        state: {
                          fromPaymentRequestApproval: true,
                          returnTo: listReturnTo,
                        },
                      });
                    }}
                  >
                    View
                  </Menu.Item>
                  {row.original.status?.trim().toLowerCase() !== "rejected" && (
                    <Menu.Item
                      leftSection={<IconEdit size={16} color={primary} />}
                      onClick={() => {
                        persistListState(buildFilterPayload);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate(`/payment-request/edit/${row.original.id}`, {
                          state: {
                            fromPaymentRequestApproval: true,
                            returnTo: listReturnTo,
                          },
                        });
                      }}
                    >
                      Edit
                    </Menu.Item>
                  )}
                  {row.original.status?.trim().toLowerCase() === "approved" && (
                    <Menu.Item
                      leftSection={<IconFileInvoice size={16} color={primary} />}
                      onClick={() => {
                        void (async () => {
                          try {
                            const raw = await apiCallProtected.get(
                              `${URL.paymentRequest}${row.original.id}/`,
                            );
                            const prData =
                              (raw as { data?: { data?: PaymentRequestRecord } })
                                ?.data?.data ??
                              (raw as { data?: PaymentRequestRecord })?.data ??
                              row.original;
                            persistListState(buildFilterPayload);
                            setStoreSearch(LIST_KEY, search);
                            setShouldRestore(LIST_KEY, true);
                            navigate("/supplier-invoice/create", {
                              state: {
                                paymentRequestData: prData,
                                returnTo: listReturnTo,
                              },
                            });
                          } catch {
                            ToastNotification({
                              type: "error",
                              message:
                                "Failed to load payment request details.",
                            });
                          }
                        })();
                      }}
                    >
                      Create Supplier Invoice
                    </Menu.Item>
                  )}
                  <Menu.Item
                    leftSection={<IconListDetails size={16} color={primary} />}
                    onClick={() =>
                      void openViewAllocationDocs(
                        String(row.original.request_no ?? ""),
                      )
                    }
                  >
                    View Allocation Docs
                  </Menu.Item>
                </>
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
      persistListState,
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
      openViewAllocationDocs,
      isOverrideMode,
      listReturnTo,
      LIST_KEY,
      openPendingShipmentsForRow,
      handleOverrideApprove,
      handleOverrideRejectClick,
      statusActionLoading,
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
      {viewAllocationDocsUi}
      {statusActionLoading && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(255, 255, 255, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color={primary} />
            <Text
              size="sm"
              fw={500}
              c={fg}
              style={{ fontFamily: erpTheme.fontSans }}
            >
              {statusActionLabel}
            </Text>
          </Stack>
        </Box>
      )}
      <Modal
        opened={pendingShipmentsOpened}
        onClose={closePendingShipments}
        title={
          pendingShipmentsContext
            ? `Pending Shipments — ${pendingShipmentsContext}`
            : "Pending Shipments"
        }
        size="lg"
        centered
      >
        {pendingShipmentsLoading ? (
          <Center py="xl">
            <Loader size="md" color={primary} />
          </Center>
        ) : pendingShipments.length === 0 ? (
          <Text c="dimmed" size="sm" py="md">
            No pending shipments found.
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Job Id</Table.Th>
                <Table.Th>Shipment No</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pendingShipments.map((row) => (
                <Table.Tr key={row.job_id}>
                  <Table.Td>{row.job_id || "-"}</Table.Td>
                  <Table.Td>
                    {row.shipment_no.length > 0
                      ? row.shipment_no.join(", ")
                      : "-"}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closePendingShipments}>
            Close
          </Button>
        </Group>
      </Modal>
      <Modal
        opened={rejectModalOpened}
        onClose={() => {
          if (statusActionLoading) return;
          closeRejectModal();
          setRejectTarget(null);
          setRejectedNote("");
        }}
        title={
          rejectTarget?.request_no
            ? `Reject Payment Request — ${rejectTarget.request_no}`
            : "Reject Payment Request"
        }
        size="md"
        centered
      >
        <Stack gap="md">
          <Textarea
            label="Rejected Note"
            placeholder="Enter reason for rejection"
            value={rejectedNote}
            onChange={(e) => setRejectedNote(e.currentTarget.value)}
            rows={4}
            withAsterisk
            styles={{
              label: { fontFamily: erpTheme.fontSans, fontSize: 13 },
              input: { fontFamily: erpTheme.fontSans, fontSize: 13 },
            }}
          />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              disabled={statusActionLoading}
              onClick={() => {
                closeRejectModal();
                setRejectTarget(null);
                setRejectedNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconX size={16} />}
              loading={statusActionLoading}
              disabled={!rejectedNote.trim()}
              onClick={() => void confirmOverrideReject()}
            >
              Confirm Reject
            </Button>
          </Group>
        </Stack>
      </Modal>
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
                {!isOverrideMode && (
                  <>
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
                )}
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
              "Refine by user, request no., type, service, date range, paid to, job id, shipment id, or status",
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
                    <SearchableSelect
                      size="xs"
                      label="Service"
                      placeholder="Search service"
                      apiEndpoint={URL.serviceMaster}
                      searchFields={["service_code", "service_name"]}
                      minSearchLength={1}
                      dropdownZIndex={1000}
                      returnOriginalData
                      value={draftFilters.service_code || null}
                      displayValue={draftFilters.service_display || undefined}
                      displayFormat={(item) => ({
                        value: String(item.service_code ?? ""),
                        label: String(item.service_code ?? ""),
                      })}
                      onChange={(value) => {
                        const code = String(value ?? "").trim();
                        setDraftFilters((prev) => ({
                          ...prev,
                          service_code: code || null,
                          service_display: code || null,
                        }));
                      }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                {!isOverrideMode && (
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Dropdown
                        size="xs"
                        label="Status"
                        placeholder="Select Status"
                        data={[
                          { value: "Active", label: "Active" },
                          { value: "Approved", label: "Approved" },
                          { value: "Override", label: "Override" },
                          { value: "Posted", label: "Posted" },
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
                )}
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
