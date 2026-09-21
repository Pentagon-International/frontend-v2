import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MRT_PaginationState } from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Select,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowRight,
  IconChartBar,
  IconCircleCheck,
  IconCircleX,
  IconDotsVertical,
  IconFilter,
  IconSearch,
  IconStack2,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import {
  Dropdown,
  ERPListColumnHeaderFilter,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  erpListThStyle,
  erpListDataRowProps,
  erpListBookingMasterDateTd,
  ERP_LIST_GEIST_MONO_CLASS,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  erpListStickyActionThStyle,
  erpListStickyActionTdStyle,
  erpListGeistMenuDropdownStyles,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import { useListFilterStore } from "../../../store/listFilterStore";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountForUi,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import useDateFormat from "../../../hooks/useDateFormat";
import { getFilterBranchMasterOptions } from "../../../service/dashboard.service";
import { getDefaultBranchCurrencyFromUser } from "../../../utils/exchangeRateRoe";
import {
  canShowConfirmProfit,
  canShowVerifyProfit,
  getProfitStatusLabel,
  PROFIT_STATUS_FILTER_OPTIONS,
  runJobProfitHoldDecision,
  runJobProfitHouseAction,
} from "../../../utils/jobProfitHouseVerification";

const LIST_KEY_VERIFICATION = "JOB_PROFIT_VERIFICATION_MASTER";
const LIST_KEY_APPROVAL = "JOB_PROFIT_VERIFICATION_APPROVAL";

type JobProfitVerificationMode = "verification" | "approval";

type JobProfitVerificationListProps = {
  mode?: JobProfitVerificationMode;
};

const SERVICE_OPTIONS = [
  { value: "AIR", label: "AIR" },
  { value: "FCL", label: "FCL" },
  { value: "LCL", label: "LCL" },
] as const;

type HouseRow = {
  housing_id?: number;
  subjob_no?: string;
  house_no?: string;
  party_name?: string;
  quotation_id?: number;
  quotation_no?: string;
  quoted_revenue?: number;
  quoted_cost?: number;
  quoted_profit?: number;
  our_gp_pct?: number;
  our_profit?: number;
  our_revenue?: number;
  our_cost?: number;
  our_volume?: number;
};

type JobProfitRow = {
  sno?: number;
  consol_id?: number;
  mbl_no?: string;
  job_no?: string;
  job_date?: string;
  trade_code?: string;
  salesperson_name?: string;
  salesman_name?: string;
  service?: string;
  job_status?: string;
  status?: string;
  origin_code?: string;
  origin_name?: string;
  destination_code?: string;
  destination_name?: string;
  housing_id?: number;
  subjob_no?: string;
  house_no?: string;
  job?: string;
  party_code?: string;
  party_name?: string;
  agent_code?: string;
  agent_name?: string;
  house_freight?: string;
  tos_code?: string;
  quotation_id?: number | null;
  quotation_no?: string | null;
  enquiry_no?: string | null;
  enquiry_id?: number | null;
  quoted_revenue?: number;
  quoted_cost?: number;
  quoted_profit?: number;
  our_gp_pct?: number | null;
  our_volume?: number;
  our_teu?: number;
  our_revenue?: number;
  our_cost?: number;
  our_profit?: number;
  is_sales?: boolean;
  has_verified_profit?: boolean;
  verified?: boolean;
  brokerage?: number | null;
  brokerage_remark?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  hold_remark?: string | null;
  /** @deprecated Nested houses — API now returns flat house rows. */
  houses?: HouseRow[];
};

type JobProfitVerificationFilters = {
  date_from: Date | null;
  date_to: Date | null;
  branch_code: string;
  job_id: string;
  service: string;
  status: string;
  origin_code: string;
  origin_port_label: string;
  destination_code: string;
  destination_name: string;
  salesperson: string;
  customer_code: string;
  customer_label: string;
};

type StoredFilters = Omit<
  JobProfitVerificationFilters,
  "date_from" | "date_to"
> & {
  date_from?: string | null;
  date_to?: string | null;
};

type JobProfitListResponse = {
  success?: boolean;
  total?: number;
  index?: number;
  limit?: number;
  message?: string;
  data?: JobProfitRow[];
  scope?: {
    role?: string;
    branch_code?: string;
    country_code?: string | null;
    salesperson_name?: string;
  };
};

type UserWithSalespersonFlag = {
  is_salesperson?: boolean;
};

function createDefaultFilters(
  mode: JobProfitVerificationMode = "verification",
): JobProfitVerificationFilters {
  return {
    date_from: dayjs().startOf("month").toDate(),
    date_to: dayjs().toDate(),
    branch_code: "",
    job_id: "",
    service: "",
    status: mode === "approval" ? "hold" : "",
    origin_code: "",
    origin_port_label: "",
    destination_code: "",
    destination_name: "",
    salesperson: "",
    customer_code: "",
    customer_label: "",
  };
}

function serializeFiltersForStore(
  filters: JobProfitVerificationFilters,
): StoredFilters {
  return {
    ...filters,
    date_from: filters.date_from
      ? dayjs(filters.date_from).format("YYYY-MM-DD")
      : null,
    date_to: filters.date_to ? dayjs(filters.date_to).format("YYYY-MM-DD") : null,
  };
}

function deserializeFiltersFromStore(
  stored: StoredFilters,
  mode: JobProfitVerificationMode = "verification",
): JobProfitVerificationFilters {
  const defaults = createDefaultFilters(mode);
  return {
    ...defaults,
    ...stored,
    date_from: stored.date_from
      ? dayjs(stored.date_from).toDate()
      : defaults.date_from,
    date_to: stored.date_to ? dayjs(stored.date_to).toDate() : defaults.date_to,
    status: mode === "approval" ? "hold" : (stored.status ?? defaults.status),
  };
}

function getUniqueCustomerNames(row: JobProfitRow): string[] {
  if (row.party_name?.trim()) {
    return [row.party_name.trim()];
  }
  const names = (row.houses ?? [])
    .map((house) => house.party_name?.trim())
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

function CustomerNamesDisplay({
  row,
  color,
  fontFamily,
}: {
  row: JobProfitRow;
  color: string;
  fontFamily: string;
}) {
  const names = getUniqueCustomerNames(row);
  if (names.length === 0) {
    return (
      <Text size="sm" c={color}>
        —
      </Text>
    );
  }

  const fullText = names.join(", ");
  const displayText =
    names.length <= 2 ? fullText : `${names.slice(0, 2).join(", ")}...`;

  if (names.length <= 2) {
    return (
      <Text size="sm" c={color}>
        {displayText}
      </Text>
    );
  }

  return (
    <Tooltip
      label={fullText}
      multiline
      maw={400}
      withArrow
      styles={{
        tooltip: {
          fontFamily,
          fontSize: 12,
          whiteSpace: "pre-wrap",
        },
      }}
    >
      <Text size="sm" c={color} style={{ cursor: "default" }}>
        {displayText}
      </Text>
    </Tooltip>
  );
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return formatMoneyAmountForUi(value);
}

function formatCurrencyAmount(
  value: number | null | undefined,
  currency?: string,
): string {
  const formatted = formatNumber(value);
  if (formatted === "—") return "—";
  return currency ? `${currency} ${formatted}` : formatted;
}

function formatGpPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function resolveSignedBadgeColor(
  value: number | null | undefined,
): "green" | "red" | "gray" | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "gray";
}

function SignedValueBadge({
  value,
  label,
}: {
  value: number | null | undefined;
  label: string;
}) {
  const color = resolveSignedBadgeColor(value);
  if (!color) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  return (
    <Badge
      color={color}
      variant="light"
      size="sm"
      styles={{
        root: {
          whiteSpace: "nowrap",
          flexShrink: 0,
          width: "fit-content",
          maxWidth: "none",
        },
        label: {
          whiteSpace: "nowrap",
          overflow: "visible",
        },
      }}
    >
      {label}
    </Badge>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const raw = String(status ?? "").trim();
  if (!raw) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  const key = raw.toLowerCase();
  const label = getProfitStatusLabel(raw);
  const cfg =
    key === "confirmed" || key === "approved" || key === "hold_confirmed"
      ? { dot: "#10b981", bg: "#ecfdf5", color: "#047857" }
      : key === "verified"
        ? { dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" }
        : key === "sent_to_verify"
          ? { dot: "#d97706", bg: "#fef3c7", color: "#b45309" }
          : key === "hold"
            ? { dot: "#e11d48", bg: "#fff1f2", color: "#be123c" }
            : key === "rejected" || key === "hold_rejected"
              ? { dot: "#dc2626", bg: "#fef2f2", color: "#b91c1c" }
              : { dot: "#6b7280", bg: "#f3f4f6", color: "#4b5563" };

  return (
    <Box
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 9999,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </Box>
  );
}

function stripJobIdServicePrefix(jobNo: string): string {
  const trimmed = jobNo.trim();
  const hyphenIndex = trimmed.indexOf("-");
  if (hyphenIndex < 0) return trimmed;
  const withoutPrefix = trimmed.slice(hyphenIndex + 1).trim();
  return withoutPrefix || trimmed;
}

export default function JobProfitVerificationMaster({
  mode = "verification",
}: JobProfitVerificationListProps = {}) {
  const isApprovalMode = mode === "approval";
  const LIST_KEY = isApprovalMode ? LIST_KEY_APPROVAL : LIST_KEY_VERIFICATION;
  const listQueryKey = isApprovalMode
    ? "jobProfitVerificationApproval"
    : "jobProfitVerification";
  const listReturnPath = isApprovalMode
    ? "/job-profit-verification-approval"
    : "/job-profit-verification";

  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const theme = DEFAULT_ERP_LIST_THEME;
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(theme);
  const dateFormat = useDateFormat();
  const { muted, fg, primary } = theme;

  const defaultBranch =
    user?.branches?.find((b) => b.is_default)?.branch_code ??
    user?.branches?.[0]?.branch_code ??
    "";
  const countryCode = user?.country?.country_code ?? "";
  const isStaff = Boolean(user?.is_staff);
  const isSalesperson = Boolean(
    (user as UserWithSalespersonFlag | null)?.is_salesperson,
  );

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const currency = useMemo(
    () => getDefaultBranchCurrencyFromUser(user?.branches).branchCurrencyCode,
    [user?.branches],
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<JobProfitVerificationFilters>(
    () => createDefaultFilters(mode),
  );
  const [appliedFilters, setAppliedFilters] =
    useState<JobProfitVerificationFilters>(() => createDefaultFilters(mode));
  const [isRestoring, setIsRestoring] = useState(true);
  const [branchOptions, setBranchOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  /** Visible width of the ERPListTableCard scrollport — keeps loader/empty centered while the table is wider. */
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [scrollPortWidth, setScrollPortWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const scrollParent = tableWrapRef.current?.parentElement;
    if (!scrollParent) return;

    const update = () => setScrollPortWidth(scrollParent.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scrollParent);
    return () => observer.disconnect();
  }, []);

  const openHeaderEditor = useCallback((id: string) => setEditingHeaderId(id), []);
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );

  /**
   * Header-filter writes update BOTH draft and applied state at once
   * (instant filtering). This keeps the advanced filter section visually in
   * sync, resets pagination to page 1, and persists filters to the list-filter
   * store so values survive navigation to Job Ledger and back.
   */
  const commitHeaderFilters = useCallback(
    (partial: Partial<JobProfitVerificationFilters>) => {
      setDraftFilters((prev) => {
        const next = {
          ...prev,
          ...partial,
          ...(isApprovalMode ? { status: "hold" } : {}),
        };
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, serializeFiltersForStore(next));
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [LIST_KEY, isApprovalMode, setStoreFilters],
  );

  useEffect(() => {
    clearAllExcept(LIST_KEY);
    const stored = getState(LIST_KEY);
    if (stored?.filters && typeof stored.filters === "object") {
      const restored = deserializeFiltersFromStore(
        stored.filters as StoredFilters,
        mode,
      );
      setDraftFilters(restored);
      setAppliedFilters(restored);
    } else if (isApprovalMode) {
      const defaults = createDefaultFilters(mode);
      setDraftFilters(defaults);
      setAppliedFilters(defaults);
    }
    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }
    setIsRestoring(false);
  }, [LIST_KEY, clearAllExcept, getState, isApprovalMode, location.key, mode]);

  useEffect(() => {
    if (!isStaff || !countryCode) {
      setBranchOptions([]);
      return;
    }

    let cancelled = false;
    const loadBranches = async () => {
      setBranchLoading(true);
      try {
        const branches = await getFilterBranchMasterOptions(countryCode);
        if (cancelled) return;
        setBranchOptions(
          branches.map((b) => ({
            value: b.branch_code,
            label: b.branch_name?.trim() || b.branch_code,
          })),
        );
      } catch {
        if (!cancelled) setBranchOptions([]);
      } finally {
        if (!cancelled) setBranchLoading(false);
      }
    };

    void loadBranches();
    return () => {
      cancelled = true;
    };
  }, [countryCode, isStaff]);

  const { data: salespersonsData = [], isLoading: salespersonsLoading } =
    useQuery({
      queryKey: ["job-profit-verification-salespersons"],
      queryFn: async () => {
        const response = (await apiCallProtected.post(
          URL.salespersons,
          {},
          API_HEADER,
        )) as { data?: unknown[] };
        return Array.isArray(response?.data) ? response.data : [];
      },
      enabled: !isSalesperson,
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    });

  const salespersonOptions = useMemo(() => {
    if (!Array.isArray(salespersonsData)) return [];
    return salespersonsData
      .filter((item: { sales_person?: string }) => item?.sales_person)
      .map((item: { sales_person?: string }) => ({
        value: String(item.sales_person),
        label: String(item.sales_person),
      }));
  }, [salespersonsData]);

  const branchSelectData = useMemo(
    () => [{ value: "", label: "All" }, ...branchOptions],
    [branchOptions],
  );

  const pageIndex = pagination.pageIndex;
  const pageSize = pagination.pageSize;
  const index = pageIndex * pageSize;

  const buildFiltersPayload = useCallback(
    (filters: JobProfitVerificationFilters, searchValue: string) => {
      const branchCode = isStaff
        ? filters.branch_code?.trim() || ""
        : defaultBranch;

      return {
        date_from: filters.date_from
          ? dayjs(filters.date_from).format("YYYY-MM-DD")
          : dayjs().startOf("month").format("YYYY-MM-DD"),
        date_to: filters.date_to
          ? dayjs(filters.date_to).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD"),
        branch_code: branchCode,
        country_code: countryCode,
        job_id: filters.job_id?.trim() || "",
        service: filters.service?.trim() || "",
        status: isApprovalMode ? "hold" : filters.status?.trim() || "",
        service_type: "",
        trade: "",
        shipment_id: "",
        hbl_number: "",
        hawb_no: "",
        company_code: "",
        customer_code: filters.customer_code?.trim() || "",
        agent_code: "",
        salesperson: isSalesperson ? "" : filters.salesperson?.trim() || "",
        origin_code: filters.origin_code?.trim() || "",
        destination_code: filters.destination_code?.trim() || "",
        search: searchValue?.trim() || "",
        ordering: "-job_date",
      };
    },
    [countryCode, defaultBranch, isApprovalMode, isSalesperson, isStaff],
  );

  const persistFiltersToStore = useCallback(
    (filters: JobProfitVerificationFilters, searchValue: string) => {
      setStoreFilters(LIST_KEY, serializeFiltersForStore(filters));
      setStoreSearch(LIST_KEY, searchValue);
    },
    [LIST_KEY, setStoreFilters, setStoreSearch],
  );

  const persistListAndNavigate = useCallback(
    (path: string, state?: Record<string, unknown>) => {
      persistFiltersToStore(appliedFilters, search);
      setShouldRestore(LIST_KEY, true);
      navigate(path, { state });
    },
    [LIST_KEY, appliedFilters, navigate, persistFiltersToStore, search, setShouldRestore],
  );

  const handleOpenHouseLedger = useCallback(
    (row: JobProfitRow) => {
      const jobNo = row.job_no?.trim();
      const houseNo = row.house_no?.trim();
      const shipmentId = row.subjob_no?.trim();
      if (!jobNo || !houseNo) return;

      const ledgerJobId = stripJobIdServicePrefix(jobNo);

      // House-level ledger: same navigation shape as house action menus.
      persistListAndNavigate("/job-ledger", {
        jobId: ledgerJobId,
        job_id: ledgerJobId,
        hbl_hawb_no: houseNo,
        shipment_id: shipmentId || undefined,
        is_sales: row.is_sales,
        status: row.status,
        brokerage: row.brokerage ?? null,
        brokerage_remark: row.brokerage_remark ?? null,
        verified_by: row.verified_by ?? null,
        verified_at: row.verified_at ?? null,
        confirmed_by: row.confirmed_by ?? null,
        confirmed_at: row.confirmed_at ?? null,
        fromJobProfitVerification: true,
        jobReturnTo: listReturnPath,
      });
    },
    [listReturnPath, persistListAndNavigate],
  );

  const handleOpenQuotation = useCallback(
    (quotationId?: number) => {
      if (quotationId == null || !Number.isFinite(Number(quotationId))) return;
      navigate(`/quotation-create/${quotationId}`, {
        state: {
          returnTo: location.pathname,
          viewMode: true,
        },
      });
    },
    [navigate, location.pathname],
  );

  const refreshProfitList = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [listQueryKey],
    });
  }, [listQueryKey, queryClient]);

  const handleVerifyProfit = useCallback(
    (row: JobProfitRow) => {
      const shipmentId = row.subjob_no?.trim();
      if (!shipmentId) {
        ToastNotification({
          type: "error",
          message: "Shipment number not found.",
        });
        return;
      }
      runJobProfitHouseAction({
        shipmentId,
        action: "verify",
        onSuccess: refreshProfitList,
      });
    },
    [refreshProfitList],
  );

  const handleConfirmProfit = useCallback(
    (row: JobProfitRow) => {
      const shipmentId = row.subjob_no?.trim();
      if (!shipmentId) {
        ToastNotification({
          type: "error",
          message: "Shipment number not found.",
        });
        return;
      }
      runJobProfitHouseAction({
        shipmentId,
        action: "confirm",
        askBrokerage: true,
        initialBrokerage: row.brokerage,
        initialBrokerageRemark: row.brokerage_remark,
        onSuccess: refreshProfitList,
      });
    },
    [refreshProfitList],
  );

  const handleApproveHold = useCallback(
    (row: JobProfitRow) => {
      const shipmentId = row.subjob_no?.trim();
      if (!shipmentId) {
        ToastNotification({
          type: "error",
          message: "Shipment number not found.",
        });
        return;
      }
      runJobProfitHoldDecision({
        shipmentId,
        decision: "approve",
        onSuccess: refreshProfitList,
      });
    },
    [refreshProfitList],
  );

  const handleRejectHold = useCallback(
    (row: JobProfitRow) => {
      const shipmentId = row.subjob_no?.trim();
      if (!shipmentId) {
        ToastNotification({
          type: "error",
          message: "Shipment number not found.",
        });
        return;
      }
      runJobProfitHoldDecision({
        shipmentId,
        decision: "reject",
        onSuccess: refreshProfitList,
      });
    },
    [refreshProfitList],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      listQueryKey,
      pageIndex,
      pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
      countryCode,
      defaultBranch,
      isStaff,
    ],
    queryFn: async () => {
      const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
      const response = (await apiCallProtected.post(
        URL.jobProfitVerification,
        {
          filters: filtersPayload,
          index,
          limit: pageSize,
        },
        API_HEADER,
      )) as JobProfitListResponse;

      const list = Array.isArray(response?.data) ? response.data : [];
      const total =
        response?.total != null ? Number(response.total) : list.length;
      setTotalRecords(total);
      return { data: list, total };
    },
    enabled: !isRestoring && Boolean(countryCode),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const rows = listResult?.data ?? [];

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    persistFiltersToStore(draftFilters, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    const reset = createDefaultFilters(mode);
    setDraftFilters(reset);
    setAppliedFilters(reset);
    setSearch("");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const fmtDate = useCallback(
    (value: string | null | undefined) => {
      if (!value) return "—";
      const d = dayjs(value);
      return d.isValid() ? d.format(dateFormat) : value;
    },
    [dateFormat],
  );

  const fmtDateTime = useCallback(
    (value: string | null | undefined) => {
      if (!value) return "—";
      const d = dayjs(value);
      return d.isValid() ? d.format(`${dateFormat} HH:mm`) : value;
    },
    [dateFormat],
  );

  const loading = isLoading || isFetching || isRestoring;
  const tdPad = { padding: "10px 12px" as const };
  const tdDate = erpListBookingMasterDateTd(theme);
  const mergeTh = (minW: number, widthPx: number) => ({
    ...erpListThStyle(theme),
    minWidth: minW,
    width: widthPx,
  });
  const listAmountThStyle = {
    ...erpListThStyle(theme),
    width: "max-content" as const,
    minWidth: 0,
    whiteSpace: "nowrap" as const,
  };
  const listAmountTdStyle = {
    ...tdPad,
    width: "max-content" as const,
    whiteSpace: "nowrap" as const,
  };
  const listAmountBadgeThStyle = {
    ...erpListThStyle(theme),
    width: "max-content" as const,
    minWidth: "max-content" as const,
    whiteSpace: "nowrap" as const,
  };
  const listAmountBadgeTdStyle = {
    ...tdPad,
    width: "max-content" as const,
    minWidth: "max-content" as const,
    whiteSpace: "nowrap" as const,
  };
  const listGpPctThStyle = {
    ...listAmountBadgeThStyle,
    textAlign: "center" as const,
  };
  const listGpPctTdStyle = {
    ...listAmountBadgeTdStyle,
    textAlign: "center" as const,
  };
  /** Stick to the scrollport so loader/empty center in the visible window, not mid-table. */
  const scrollPortCenteredStyle = {
    position: "sticky" as const,
    left: 0,
    width: scrollPortWidth ?? undefined,
    maxWidth: "100%",
    boxSizing: "border-box" as const,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 80,
    backgroundColor: theme.cardBg,
  };

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box className={ERP_LIST_GEIST_ROOT_CLASS} style={erpListGeistRootTypography}>
        <ERPListScreen
          theme={theme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <ERPListStatPill
                theme={theme}
                icon={<IconStack2 size={14} color={theme.primary} />}
                iconBackground="#E7F5FF"
                iconColor={theme.primary}
                value={totalRecords}
                label="Total"
              />
            ),
            // secondary: isApprovalMode ? undefined : (
            //   <Group gap={8} wrap="nowrap" align="center">
            //     <IconChartBar size={16} color={muted} />
            //     <Text fw={600} size="sm" c={fg}>
            //       {totalRecords.toLocaleString()}
            //     </Text>
            //     <Text size="xs" c={muted}>
            //       job profit rows
            //     </Text>
            //   </Group>
            // ),
            actions: (
              <>
                <TextInput
                  size="xs"
                  w={220}
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => {
                    const next = e.currentTarget.value;
                    setSearch(next);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                    persistFiltersToStore(appliedFilters, next);
                  }}
                  leftSection={<IconSearch size={14} />}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearch("");
                          setPagination((p) => ({ ...p, pageIndex: 0 }));
                          persistFiltersToStore(appliedFilters, "");
                        }}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    ) : null
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                />
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(theme)}
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
            subtitle: isApprovalMode
              ? "Refine job profit verification approval"
              : "Refine job profit verification",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={theme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={loading}
                applyDisabled={loading}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch" >
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="From Date"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_from}
                      onChange={(d) =>
                        setDraftFilters((prev) => ({ ...prev, date_from: d }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: {
                          ...filterFieldStyles.input,
                          minHeight: 32,
                        },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="To Date"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_to}
                      onChange={(d) =>
                        setDraftFilters((prev) => ({ ...prev, date_to: d }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: {
                          ...filterFieldStyles.input,
                          minHeight: 32,
                        },
                      }}
                    />
                  </Box>
                </Grid.Col>
                {isStaff ? (
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Select
                        size="xs"
                        label="Branch"
                        placeholder={branchLoading ? "Loading..." : "All"}
                        data={branchSelectData}
                        value={draftFilters.branch_code}
                        onChange={(v) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            branch_code: v ?? "",
                          }))
                        }
                        searchable
                        disabled={branchLoading}
                        nothingFoundMessage="No branches"
                        comboboxProps={{ zIndex: 400 }}
                        classNames={erpListGeistSelectClassNames}
                        styles={filterFieldStyles}
                      />
                    </Box>
                  </Grid.Col>
                ) : null}
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      format="capital"
                      label="Job Number"
                      placeholder="Type job number"
                      size="xs"
                      styles={filterFieldStyles}
                      value={draftFilters.job_id}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          job_id: e.currentTarget.value,
                        }))
                      }
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="Service"
                      placeholder="Select service"
                      data={[...SERVICE_OPTIONS]}
                      value={draftFilters.service || null}
                      onChange={(v) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          service: v ?? "",
                        }))
                      }
                      clearable
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                {!isApprovalMode ? (
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Select
                        size="xs"
                        label="Status"
                        placeholder="All statuses"
                        data={[...PROFIT_STATUS_FILTER_OPTIONS]}
                        value={draftFilters.status || null}
                        onChange={(v) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            status: v ?? "",
                          }))
                        }
                        clearable
                        searchable
                        comboboxProps={{ zIndex: 400 }}
                        classNames={erpListGeistSelectClassNames}
                        styles={filterFieldStyles}
                      />
                    </Box>
                  </Grid.Col>
                ) : null}
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      size="xs"
                      label="Origin"
                      placeholder="Type origin code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={draftFilters.origin_code}
                      displayValue={draftFilters.origin_port_label}
                      onChange={(value, selectedData) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          origin_code: value || "",
                          origin_port_label: selectedData?.label || "",
                        }));
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      size="xs"
                      label="Destination"
                      placeholder="Type destination code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={draftFilters.destination_code}
                      displayValue={draftFilters.destination_name}
                      onChange={(value, selectedData) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          destination_code: value || "",
                          destination_name: selectedData?.label || "",
                        }));
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                {!isSalesperson ? (
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Dropdown
                        size="xs"
                        label="Salesperson"
                        placeholder={
                          salespersonsLoading ? "Loading..." : "Select salesperson"
                        }
                        data={salespersonOptions}
                        value={draftFilters.salesperson || null}
                        onChange={(v) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            salesperson: v ?? "",
                          }))
                        }
                        clearable
                        searchable
                        disabled={salespersonsLoading}
                        styles={filterFieldStyles}
                      />
                    </Box>
                  </Grid.Col>
                ) : null}
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      size="xs"
                      label="Customer"
                      placeholder="Type customer name or code"
                      apiEndpoint={URL.customer}
                      searchFields={["customer_code", "customer_name", "name"]}
                      returnOriginalData
                      value={draftFilters.customer_code}
                      displayValue={draftFilters.customer_label}
                      onChange={(value, selected) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          customer_code: value || "",
                          customer_label: selected?.label || "",
                        }));
                      }}
                      displayFormat={(item) => ({
                        value: String(item.customer_code ?? item.id ?? ""),
                        label: String(
                          item.customer_name ?? item.name ?? "",
                        ).trim(),
                      })}
                      minSearchLength={1}
                      dropdownZIndex={1000}
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
                theme={theme}
                pageIndex={pageIndex}
                pageSize={pageSize}
                totalRecords={totalRecords}
                onPageIndexChange={(idx) =>
                  setPagination((p) => ({ ...p, pageIndex: idx }))
                }
                onPageSizeChange={(size) =>
                  setPagination({ pageIndex: 0, pageSize: size })
                }
              />
            ),
            children: (
              <Box ref={tableWrapRef}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ height: 45 }}>
                      <th style={mergeTh(70, 70)}>S.No</th>
                      <th style={mergeTh(160, 160)}>
                        <ERPListColumnHeaderFilter
                          label="Job Number"
                          value={appliedFilters.job_id}
                          displayValue={appliedFilters.job_id}
                          theme={theme}
                          placeholder="Filter job number"
                          isEditing={editingHeaderId === "job_id"}
                          onStartEdit={() => openHeaderEditor("job_id")}
                          onStopEdit={() => collapseHeaderEditor("job_id")}
                          onChange={(next) =>
                            commitHeaderFilters({ job_id: next || "" })
                          }
                        />
                      </th>
                      <th style={mergeTh(100, 100)}>
                        <ERPListColumnHeaderFilter
                          label="Service"
                          value={appliedFilters.service}
                          displayValue={appliedFilters.service}
                          theme={theme}
                          placeholder="Service"
                          isEditing={editingHeaderId === "service"}
                          onStartEdit={() => openHeaderEditor("service")}
                          onStopEdit={() => collapseHeaderEditor("service")}
                          onChange={() => {}}
                          renderEditor={({ autoFocus, onClose }) => (
                            <Select
                              autoFocus={autoFocus}
                              placeholder="Service"
                              searchable
                              clearable
                              size="xs"
                              data={[...SERVICE_OPTIONS]}
                              value={appliedFilters.service || null}
                              onChange={(value) => {
                                commitHeaderFilters({ service: value ?? "" });
                                onClose();
                              }}
                              comboboxProps={{ zIndex: 1000 }}
                              classNames={erpListGeistSelectClassNames}
                              styles={filterFieldStyles}
                            />
                          )}
                        />
                      </th>
                      <th style={mergeTh(180, 180)}>Shipment No</th>
                      <th style={mergeTh(120, 120)}>Quotation No</th>
                      <th style={mergeTh(130, 130)}>Job Date</th>
                      <th style={mergeTh(220, 220)}>
                        <ERPListColumnHeaderFilter
                          label="Route"
                          value={
                            (appliedFilters.origin_code || "") +
                            (appliedFilters.destination_code || "")
                          }
                          displayValue={
                            appliedFilters.origin_code ||
                            appliedFilters.destination_code
                              ? `${appliedFilters.origin_code || "—"} → ${appliedFilters.destination_code || "—"}`
                              : ""
                          }
                          theme={theme}
                          isEditing={editingHeaderId === "route"}
                          onStartEdit={() => openHeaderEditor("route")}
                          onStopEdit={() => collapseHeaderEditor("route")}
                          onChange={() => {}}
                          renderEditor={({ autoFocus }) => (
                            <Group gap={4} wrap="nowrap" style={{ width: "100%" }}>
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <SearchableSelect
                                  autoFocus={autoFocus}
                                  size="xs"
                                  apiEndpoint={URL.portMaster}
                                  searchFields={["port_code", "port_name"]}
                                  placeholder="Origin"
                                  displayFormat={(item: Record<string, unknown>) => ({
                                    value: String(item.port_code),
                                    label: `${item.port_name} (${item.port_code})`,
                                  })}
                                  value={appliedFilters.origin_code}
                                  displayValue={appliedFilters.origin_port_label}
                                  onChange={(value, selectedData) =>
                                    commitHeaderFilters({
                                      origin_code: value || "",
                                      origin_port_label: selectedData?.label || "",
                                    })
                                  }
                                  minSearchLength={1}
                                  dropdownZIndex={1000}
                                  classNames={erpListGeistSelectClassNames}
                                  styles={filterFieldStyles}
                                />
                              </Box>
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <SearchableSelect
                                  size="xs"
                                  apiEndpoint={URL.portMaster}
                                  searchFields={["port_code", "port_name"]}
                                  placeholder="Destination"
                                  displayFormat={(item: Record<string, unknown>) => ({
                                    value: String(item.port_code),
                                    label: `${item.port_name} (${item.port_code})`,
                                  })}
                                  value={appliedFilters.destination_code}
                                  displayValue={appliedFilters.destination_name}
                                  onChange={(value, selectedData) =>
                                    commitHeaderFilters({
                                      destination_code: value || "",
                                      destination_name: selectedData?.label || "",
                                    })
                                  }
                                  minSearchLength={1}
                                  dropdownZIndex={1000}
                                  classNames={erpListGeistSelectClassNames}
                                  styles={filterFieldStyles}
                                />
                              </Box>
                            </Group>
                          )}
                        />
                      </th>
                      <th style={mergeTh(200, 200)}>
                        <ERPListColumnHeaderFilter
                          label="Customer Name"
                          value={appliedFilters.customer_code}
                          displayValue={appliedFilters.customer_label}
                          theme={theme}
                          placeholder="Filter customer"
                          isEditing={editingHeaderId === "customer"}
                          onStartEdit={() => openHeaderEditor("customer")}
                          onStopEdit={() => collapseHeaderEditor("customer")}
                          onChange={() => {}}
                          renderEditor={({ autoFocus }) => (
                            <SearchableSelect
                              autoFocus={autoFocus}
                              size="xs"
                              placeholder="Customer"
                              apiEndpoint={URL.customer}
                              searchFields={["customer_code", "customer_name", "name"]}
                              returnOriginalData
                              value={appliedFilters.customer_code}
                              displayValue={appliedFilters.customer_label}
                              onChange={(value, selected) => {
                                commitHeaderFilters({
                                  customer_code: value || "",
                                  customer_label: selected?.label || "",
                                });
                              }}
                              displayFormat={(item) => ({
                                value: String(item.customer_code ?? item.id ?? ""),
                                label: String(
                                  item.customer_name ?? item.name ?? "",
                                ).trim(),
                              })}
                              minSearchLength={1}
                              dropdownZIndex={1000}
                              classNames={erpListGeistSelectClassNames}
                              styles={filterFieldStyles}
                              />
                            )}
                        />
                      </th>
                      {!isSalesperson ? (
                        <th style={mergeTh(150, 150)}>
                          <ERPListColumnHeaderFilter
                            label="Salesperson"
                            value={appliedFilters.salesperson}
                            displayValue={appliedFilters.salesperson}
                            theme={theme}
                            placeholder="Salesperson"
                            isEditing={editingHeaderId === "salesperson"}
                            onStartEdit={() => openHeaderEditor("salesperson")}
                            onStopEdit={() => collapseHeaderEditor("salesperson")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <Select
                                autoFocus={autoFocus}
                                placeholder="Salesperson"
                                searchable
                                clearable
                                size="xs"
                                data={salespersonOptions}
                                value={appliedFilters.salesperson || null}
                                onChange={(value) => {
                                  commitHeaderFilters({ salesperson: value ?? "" });
                                  onClose();
                                }}
                                disabled={salespersonsLoading}
                                comboboxProps={{ zIndex: 1000 }}
                                classNames={erpListGeistSelectClassNames}
                                styles={filterFieldStyles}
                              />
                            )}
                          />
                        </th>
                      ) : (
                        <th style={mergeTh(150, 150)}>Salesperson</th>
                      )}
                      <th style={listAmountThStyle}>Quoted Revenue</th>
                      <th style={listAmountBadgeThStyle}>Quoted Profit</th>
                      <th style={listAmountThStyle}>Volume</th>
                      <th style={listAmountThStyle}>Revenue</th>
                      <th style={listAmountThStyle}>Profit</th>
                      <th style={listGpPctThStyle}>GP (%)</th>
                      <th style={mergeTh(isApprovalMode ? 90 : 180, isApprovalMode ? 90 : 180)}>
                        {isApprovalMode ? (
                          "Status"
                        ) : (
                          <ERPListColumnHeaderFilter
                            label="Status"
                            value={appliedFilters.status}
                            displayValue={
                              appliedFilters.status
                                ? getProfitStatusLabel(appliedFilters.status)
                                : ""
                            }
                            theme={theme}
                            placeholder="Status"
                            isEditing={editingHeaderId === "status"}
                            onStartEdit={() => openHeaderEditor("status")}
                            onStopEdit={() => collapseHeaderEditor("status")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <Select
                                autoFocus={autoFocus}
                                placeholder="Status"
                                searchable
                                clearable
                                size="xs"
                                data={[...PROFIT_STATUS_FILTER_OPTIONS]}
                                value={appliedFilters.status || null}
                                onChange={(value) => {
                                  commitHeaderFilters({ status: value ?? "" });
                                  onClose();
                                }}
                                comboboxProps={{ zIndex: 1000 }}
                                classNames={erpListGeistSelectClassNames}
                                styles={filterFieldStyles}
                              />
                            )}
                          />
                        )}
                      </th>
                      {isApprovalMode ? (
                        <th style={mergeTh(220, 220)}>Remark</th>
                      ) : null}
                      <th style={mergeTh(150, 150)}>Verified By</th>
                      {!isApprovalMode ? (
                        <th style={mergeTh(150, 150)}>Confirmed By</th>
                      ) : null}
                      <th style={erpListStickyActionThStyle(theme, 96)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={19} style={{ padding: 0 }}>
                          <Box style={scrollPortCenteredStyle}>
                            <Loader color="#105476" size="lg" />
                          </Box>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={19} style={{ padding: 0 }}>
                          <Box style={scrollPortCenteredStyle}>
                            <Text c="dimmed">No job profit records found</Text>
                          </Box>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, rowIndex) => (
                        <tr
                          key={`${row.housing_id ?? row.subjob_no ?? row.job_no ?? "row"}-${rowIndex}`}
                          {...erpListDataRowProps(theme)}
                        >
                          <td style={tdPad}>
                            <Text size="sm" c={fg}>
                              {row.sno ?? index + rowIndex + 1}
                            </Text>
                          </td>
                          <td
                            className={ERP_LIST_GEIST_MONO_CLASS}
                            style={tdPad}
                          >
                            <Text size="sm" fw={600} c={fg}>
                              {row.job_no || "—"}
                            </Text>
                          </td>
                          <td style={tdPad}>
                            <Text size="sm" c={fg}>
                              {row.service?.trim() || "—"}
                            </Text>
                          </td>
                          <td
                            className={ERP_LIST_GEIST_MONO_CLASS}
                            style={tdPad}
                          >
                            <Text
                              size="sm"
                              fw={600}
                              c={
                                row.subjob_no && row.job_no && row.house_no
                                  ? primary
                                  : fg
                              }
                              style={{
                                cursor:
                                  row.subjob_no && row.job_no && row.house_no
                                    ? "pointer"
                                    : "default",
                              }}
                              onClick={() => void handleOpenHouseLedger(row)}
                            >
                              {row.subjob_no || "—"}
                            </Text>
                          </td>
                          <td
                            className={ERP_LIST_GEIST_MONO_CLASS}
                            style={tdPad}
                          >
                            <Text
                              size="sm"
                              fw={600}
                              c={row.quotation_id != null ? primary : fg}
                              style={{
                                cursor:
                                  row.quotation_id != null ? "pointer" : "default",
                              }}
                              onClick={() => handleOpenQuotation(row.quotation_id ?? undefined)}
                            >
                              {row.quotation_no?.trim() || "—"}
                            </Text>
                          </td>
                          <td style={tdDate}>{fmtDate(row.job_date)}</td>
                          <td style={tdPad}>
                            <Group gap={6} wrap="nowrap">
                              <Text size="sm" fw={600} c={primary}>
                                {row.origin_code?.trim() || "—"}
                              </Text>
                              <IconArrowRight size={12} color={muted} />
                              <Text size="sm" c={fg}>
                                {row.destination_code?.trim() || "—"}
                              </Text>
                            </Group>
                          </td>
                          <td style={tdPad}>
                            <CustomerNamesDisplay
                              row={row}
                              color={fg}
                              fontFamily={theme.fontSans}
                            />
                          </td>
                          <td style={tdPad}>
                            <Text size="sm" c={fg}>
                              {row.salesperson_name || "—"}
                            </Text>
                          </td>
                          <td style={listAmountTdStyle}>
                            <Text size="sm" fw={600} c={fg}>
                              {formatCurrencyAmount(row.quoted_revenue, currency)}
                            </Text>
                          </td>
                          <td style={listAmountBadgeTdStyle}>
                            <SignedValueBadge
                              value={row.quoted_profit}
                              label={formatCurrencyAmount(row.quoted_profit, currency)}
                            />
                          </td>
                          <td style={listAmountTdStyle}>
                            <Text size="sm" c={fg}>
                              {formatNumber(row.our_volume)}
                            </Text>
                          </td>
                          <td style={listAmountTdStyle}>
                            <Text size="sm" fw={600} c={fg}>
                              {formatCurrencyAmount(row.our_revenue, currency)}
                            </Text>
                          </td>
                          <td style={listAmountTdStyle}>
                            <Text size="sm" fw={600} c={fg}>
                              {formatCurrencyAmount(row.our_profit, currency)}
                            </Text>
                          </td>
                          <td style={listGpPctTdStyle}>
                            <SignedValueBadge
                              value={row.our_gp_pct}
                              label={formatGpPercent(row.our_gp_pct)}
                            />
                          </td>
                          <td
                            style={{
                              ...tdPad,
                              ...(isApprovalMode
                                ? {
                                    width: 90,
                                    minWidth: 90,
                                    maxWidth: 90,
                                    whiteSpace: "nowrap" as const,
                                  }
                                : {}),
                            }}
                          >
                            <StatusPill status={row.status} />
                          </td>
                          {isApprovalMode ? (
                            <td style={tdPad}>
                              {(() => {
                                const holdRemark =
                                  row.hold_remark?.trim() || "";
                                const brokerageRemark =
                                  row.brokerage_remark?.trim() || "";
                                const remarkNode = (
                                  <Text
                                    size="sm"
                                    c={holdRemark ? fg : muted}
                                    style={{
                                      maxWidth: 280,
                                      whiteSpace: "normal",
                                      wordBreak: "break-word",
                                      cursor: brokerageRemark
                                        ? "default"
                                        : undefined,
                                    }}
                                  >
                                    {holdRemark || "—"}
                                  </Text>
                                );
                                if (!brokerageRemark) return remarkNode;
                                return (
                                  <Tooltip
                                    label={brokerageRemark}
                                    multiline
                                    maw={360}
                                    withArrow
                                    styles={{
                                      tooltip: {
                                        fontFamily: theme.fontSans,
                                        fontSize: 12,
                                        whiteSpace: "pre-wrap",
                                      },
                                    }}
                                  >
                                    {remarkNode}
                                  </Tooltip>
                                );
                              })()}
                            </td>
                          ) : null}
                          <td style={tdPad}>
                            <Text size="sm" c={fg}>
                              {row.verified_by?.trim() || "—"}
                            </Text>
                            {row.verified_at ? (
                              <Text size="xs" c={muted} mt={2}>
                                {fmtDateTime(row.verified_at)}
                              </Text>
                            ) : null}
                          </td>
                          {!isApprovalMode ? (
                            <td style={tdPad}>
                              <Text size="sm" c={fg}>
                                {row.confirmed_by?.trim() || "—"}
                              </Text>
                              {row.confirmed_at ? (
                                <Text size="xs" c={muted} mt={2}>
                                  {fmtDateTime(row.confirmed_at)}
                                </Text>
                              ) : null}
                            </td>
                          ) : null}
                          <td style={erpListStickyActionTdStyle(theme)}>
                            {(() => {
                              if (isApprovalMode) {
                                return (
                                  <Menu
                                    withinPortal
                                    position="bottom-end"
                                    shadow="md"
                                    width={180}
                                    styles={erpListGeistMenuDropdownStyles}
                                    classNames={{
                                      dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                                    }}
                                  >
                                    <Menu.Target>
                                      <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                      >
                                        <IconDotsVertical size={16} />
                                      </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                      <Menu.Item
                                        leftSection={
                                          <IconCircleCheck size={14} />
                                        }
                                        onClick={() => handleApproveHold(row)}
                                      >
                                        Approve
                                      </Menu.Item>
                                      <Menu.Item
                                        color="red"
                                        leftSection={<IconCircleX size={14} />}
                                        onClick={() => handleRejectHold(row)}
                                      >
                                        Reject
                                      </Menu.Item>
                                    </Menu.Dropdown>
                                  </Menu>
                                );
                              }

                              const showVerify = canShowVerifyProfit({
                                is_sales: row.is_sales,
                                status: row.status,
                              });
                              const showConfirm = canShowConfirmProfit({
                                is_sales: row.is_sales,
                                status: row.status,
                              });
                              if (!showVerify && !showConfirm) return null;
                              return (
                                <Menu
                                  withinPortal
                                  position="bottom-end"
                                  shadow="md"
                                  width={180}
                                  styles={erpListGeistMenuDropdownStyles}
                                  classNames={{
                                    dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                                  }}
                                >
                                  <Menu.Target>
                                    <ActionIcon
                                      variant="subtle"
                                      color="gray"
                                      size="sm"
                                    >
                                      <IconDotsVertical size={16} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    {showVerify && (
                                      <Menu.Item
                                        leftSection={
                                          <IconCircleCheck size={14} />
                                        }
                                        onClick={() => handleVerifyProfit(row)}
                                      >
                                        Verify profit
                                      </Menu.Item>
                                    )}
                                    {showConfirm && (
                                      <Menu.Item
                                        leftSection={
                                          <IconCircleCheck size={14} />
                                        }
                                        onClick={() => handleConfirmProfit(row)}
                                      >
                                        Confirm profit
                                      </Menu.Item>
                                    )}
                                  </Menu.Dropdown>
                                </Menu>
                              );
                            })()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Box>
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}
