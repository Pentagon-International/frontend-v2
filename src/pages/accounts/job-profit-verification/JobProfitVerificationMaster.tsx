import { useCallback, useEffect, useMemo, useState } from "react";
import type { MRT_PaginationState } from "mantine-react-table";
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
  Modal,
  Select,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconChartBar,
  IconCircleCheck,
  IconDotsVertical,
  IconFilter,
  IconSearch,
  IconStack2,
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
  ERPListJobStatusPill,
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
import useDateFormat from "../../../hooks/useDateFormat";
import { getFilterBranchMasterOptions } from "../../../service/dashboard.service";
import { getDefaultBranchCurrencyFromUser } from "../../../utils/exchangeRateRoe";

const LIST_KEY = "JOB_PROFIT_VERIFICATION_MASTER";

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
  job_no?: string;
  job_date?: string;
  trade_code?: string;
  salesperson_name?: string;
  service?: string;
  job_status?: string;
  status?: string;
  origin_code?: string;
  origin_name?: string;
  destination_code?: string;
  destination_name?: string;
  quotation_id?: number;
  quotation_no?: string;
  quoted_revenue?: number;
  quoted_cost?: number;
  quoted_profit?: number;
  our_gp_pct?: number;
  our_volume?: number;
  our_revenue?: number;
  our_profit?: number;
  has_verified_profit?: boolean;
  verified_by?: string;
  verified_at?: string;
  houses?: HouseRow[];
};

type JobProfitVerificationFilters = {
  date_from: Date | null;
  date_to: Date | null;
  branch_code: string;
  job_id: string;
  service: string;
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

function createDefaultFilters(): JobProfitVerificationFilters {
  return {
    date_from: dayjs().startOf("month").toDate(),
    date_to: dayjs().toDate(),
    branch_code: "",
    job_id: "",
    service: "",
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
): JobProfitVerificationFilters {
  const defaults = createDefaultFilters();
  return {
    ...defaults,
    ...stored,
    date_from: stored.date_from
      ? dayjs(stored.date_from).toDate()
      : defaults.date_from,
    date_to: stored.date_to ? dayjs(stored.date_to).toDate() : defaults.date_to,
  };
}

function getUniqueCustomerNames(row: JobProfitRow): string[] {
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
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function ProfitVerifiedPill({ verified }: { verified?: boolean }) {
  const label = verified ? "Verified" : "Not Verified";
  const cfg = verified
    ? { dot: "#10b981", bg: "#ecfdf5", color: "#047857" }
    : { dot: "#d97706", bg: "#fef3c7", color: "#b45309" };
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

function sumHouseProfit(houses?: HouseRow[]): number {
  return (houses ?? []).reduce(
    (sum, house) => sum + (house.our_profit ?? 0),
    0,
  );
}

function readJobStatus(row: JobProfitRow): string | undefined {
  return row.job_status ?? row.status;
}

function resolveJobEditPath(service?: string, trade?: string): string | null {
  const s = (service ?? "").toUpperCase();
  const t = (trade ?? "").toUpperCase();
  const isExport = t.includes("EXPORT");
  if (s === "AIR") {
    return isExport ? "/air/export-job/edit" : "/air/import-job/edit";
  }
  if (s === "FCL" || s === "LCL") {
    return isExport ? "/SeaExport/export-job/edit" : "/SeaExport/import-job/edit";
  }
  return null;
}

async function fetchJobForEdit(
  jobNo: string,
): Promise<Record<string, unknown> | null> {
  const response = (await apiCallProtected.post(
    URL.filterJobCreate,
    { filters: { job_id: jobNo.trim() } },
    API_HEADER,
  )) as { data?: unknown[] };
  const list = Array.isArray(response?.data) ? response.data : [];
  return list.length > 0 ? (list[0] as Record<string, unknown>) : null;
}

export default function JobProfitVerificationMaster() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
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
    () => createDefaultFilters(),
  );
  const [appliedFilters, setAppliedFilters] =
    useState<JobProfitVerificationFilters>(() => createDefaultFilters());
  const [isRestoring, setIsRestoring] = useState(true);
  const [branchOptions, setBranchOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [verifyProfitRow, setVerifyProfitRow] = useState<JobProfitRow | null>(
    null,
  );
  const [isVerifying, setIsVerifying] = useState(false);

  const openHeaderEditor = useCallback((id: string) => setEditingHeaderId(id), []);
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );

  const commitHeaderFilters = useCallback(
    (partial: Partial<JobProfitVerificationFilters>) => {
      setDraftFilters((prev) => {
        const next = { ...prev, ...partial };
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, serializeFiltersForStore(next));
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setStoreFilters],
  );

  useEffect(() => {
    clearAllExcept(LIST_KEY);
    const stored = getState(LIST_KEY);
    if (stored?.filters && typeof stored.filters === "object") {
      const restored = deserializeFiltersFromStore(
        stored.filters as StoredFilters,
      );
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }
    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }
    setIsRestoring(false);
  }, [clearAllExcept, getState, location.key]);

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
    [countryCode, defaultBranch, isSalesperson, isStaff],
  );

  const persistFiltersToStore = useCallback(
    (filters: JobProfitVerificationFilters, searchValue: string) => {
      setStoreFilters(LIST_KEY, serializeFiltersForStore(filters));
      setStoreSearch(LIST_KEY, searchValue);
    },
    [setStoreFilters, setStoreSearch],
  );

  const persistListAndNavigate = useCallback(
    (path: string, state?: Record<string, unknown>) => {
      persistFiltersToStore(appliedFilters, search);
      setShouldRestore(LIST_KEY, true);
      navigate(path, { state });
    },
    [appliedFilters, navigate, persistFiltersToStore, search, setShouldRestore],
  );

  const handleOpenJobEdit = useCallback(
    async (row: JobProfitRow) => {
      const jobNo = row.job_no?.trim();
      if (!jobNo) return;

      const path = resolveJobEditPath(row.service, row.trade_code);
      if (!path) {
        ToastNotification({
          type: "error",
          message: "Unable to determine job edit route for this service.",
        });
        return;
      }

      const returnState = { returnTo: "/job-profit-verification" };
      const consolId = row.consol_id;
      if (consolId != null && Number.isFinite(Number(consolId))) {
        persistListAndNavigate(path, { jobId: Number(consolId), ...returnState });
        return;
      }

      try {
        const job = await fetchJobForEdit(jobNo);
        if (!job) {
          ToastNotification({ type: "error", message: "Job not found." });
          return;
        }
        const jobId = job.id ?? job.consol_id;
        if (jobId != null && Number.isFinite(Number(jobId))) {
          persistListAndNavigate(path, {
            jobId: Number(jobId),
            ...returnState,
          });
          return;
        }
        persistListAndNavigate(path, { job, ...returnState });
      } catch {
        ToastNotification({
          type: "error",
          message: "Failed to load job details.",
        });
      }
    },
    [persistListAndNavigate],
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

  const handleConfirmVerifyProfit = useCallback(async () => {
    if (!verifyProfitRow) return;

    const jobId = verifyProfitRow.consol_id;
    if (jobId == null || !Number.isFinite(Number(jobId))) {
      ToastNotification({ type: "error", message: "Job id is missing." });
      return;
    }

    const houseDetails = (verifyProfitRow.houses ?? [])
      .filter((house) => house.housing_id != null)
      .map((house) => ({
        id: Number(house.housing_id),
        calculated_profit: house.our_profit ?? 0,
      }));

    if (houseDetails.length === 0) {
      ToastNotification({
        type: "error",
        message: "No house profit details found for this job.",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = (await apiCallProtected.post(
        URL.verifyProfit,
        {
          job_id: Number(jobId),
          house_details: houseDetails,
        },
        API_HEADER,
      )) as { success?: boolean; message?: string; detail?: string };

      if (response?.success === false) {
        throw new Error(
          response.message ?? response.detail ?? "Profit verification failed.",
        );
      }

      ToastNotification({
        type: "success",
        message: response?.message ?? "Profit verified successfully",
      });
      setVerifyProfitRow(null);
      await queryClient.invalidateQueries({
        queryKey: ["jobProfitVerification"],
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to verify profit.";
      ToastNotification({ type: "error", message });
    } finally {
      setIsVerifying(false);
    }
  }, [queryClient, verifyProfitRow]);

  const {
    data: listResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "jobProfitVerification",
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
    const reset = createDefaultFilters();
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
  const modalGpPctThStyle = erpListThStyle(theme, { textAlign: "center" });
  const modalGpPctTdStyle = {
    ...tdPad,
    textAlign: "center" as const,
  };
  const modalCustomerColWidth = 240;
  const modalCustomerThStyle = {
    ...erpListThStyle(theme),
    minWidth: modalCustomerColWidth,
    width: modalCustomerColWidth,
  };
  const modalCustomerTdStyle = {
    ...tdPad,
    minWidth: modalCustomerColWidth,
    width: modalCustomerColWidth,
    whiteSpace: "normal" as const,
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
            secondary: (
              <Group gap={8} wrap="nowrap" align="center">
                <IconChartBar size={16} color={muted} />
                <Text fw={600} size="sm" c={fg}>
                  {totalRecords.toLocaleString()}
                </Text>
                <Text size="xs" c={muted}>
                  job profit rows
                </Text>
              </Group>
            ),
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
            subtitle: "Refine job profit verification",
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
            children: loading ? (
              <Center py="xl">
                <Loader color="#105476" size="lg" />
              </Center>
            ) : (
              <Box style={{ overflowX: "auto" }}>
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
                      <th style={mergeTh(120, 120)}>Quotation No</th>
                      <th style={mergeTh(130, 130)}>Job Date</th>
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
                      <th style={mergeTh(120, 120)}>Job Status</th>
                      <th style={listAmountThStyle}>Quoted Revenue</th>
                      <th style={listAmountBadgeThStyle}>Quoted Profit</th>
                      <th style={listAmountThStyle}>Volume</th>
                      <th style={listAmountThStyle}>Revenue</th>
                      <th style={listAmountThStyle}>Profit</th>
                      <th style={listGpPctThStyle}>GP (%)</th>
                      <th style={mergeTh(140, 140)}>Profit Verified</th>
                      <th style={mergeTh(130, 130)}>Verified By</th>
                      <th style={mergeTh(150, 150)}>Verified At</th>
                      <th style={erpListStickyActionThStyle(theme, 96)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={17} style={tdPad}>
                          <Center py="xl">
                            <Text c="dimmed">No job profit records found</Text>
                          </Center>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, rowIndex) => (
                        <tr
                          key={`${row.job_no ?? "row"}-${rowIndex}`}
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
                            <Text
                              size="sm"
                              fw={600}
                              c={row.job_no ? primary : fg}
                              style={{
                                cursor: row.job_no ? "pointer" : "default",
                              }}
                              onClick={() => void handleOpenJobEdit(row)}
                            >
                              {row.job_no || "—"}
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
                              onClick={() => handleOpenQuotation(row.quotation_id)}
                            >
                              {row.quotation_no?.trim() || "—"}
                            </Text>
                          </td>
                          <td style={tdDate}>{fmtDate(row.job_date)}</td>
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
                          <td style={tdPad}>
                            <ERPListJobStatusPill status={readJobStatus(row)} />
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
                          <td style={tdPad}>
                            <ProfitVerifiedPill verified={row.has_verified_profit} />
                          </td>
                          <td style={tdPad}>
                            <Text size="sm" c={fg}>
                              {row.verified_by?.trim() || "—"}
                            </Text>
                          </td>
                          <td style={tdDate}>{fmtDateTime(row.verified_at)}</td>
                          <td style={erpListStickyActionTdStyle(theme)}>
                            <Menu
                              withinPortal
                              position="bottom-end"
                              shadow="md"
                              width={180}
                              styles={erpListGeistMenuDropdownStyles}
                              classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                            >
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" size="sm">
                                  <IconDotsVertical size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                {!row.has_verified_profit ? (
                                  <Menu.Item
                                    leftSection={<IconCircleCheck size={14} />}
                                    onClick={() => setVerifyProfitRow(row)}
                                  >
                                    Verify Profit
                                  </Menu.Item>
                                ) : (
                                  <Menu.Item
                                    leftSection={<IconCircleCheck size={14} />}
                                    disabled
                                  >
                                    Verify Profit
                                  </Menu.Item>
                                )}
                              </Menu.Dropdown>
                            </Menu>
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

        <Modal
          opened={!!verifyProfitRow}
          onClose={() => !isVerifying && setVerifyProfitRow(null)}
          title={
            <Text fw={600} size="md">
              Verify Profit
              {verifyProfitRow?.job_no ? ` — ${verifyProfitRow.job_no}` : ""}
            </Text>
          }
          centered
          size="xl"
          classNames={{
            content: ERP_LIST_GEIST_ROOT_CLASS,
            body: ERP_LIST_GEIST_ROOT_CLASS,
            header: ERP_LIST_GEIST_ROOT_CLASS,
          }}
        >
          <Text size="sm" c="dimmed" mb="md">
            Review house-level profits before confirming verification.
          </Text>
          <Box style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "House No",
                    "Subjob",
                    "Quotation No",
                    "Customer",
                    "Quoted Revenue",
                    "Quoted Cost",
                    "Quoted Profit",
                    "Volume",
                    "Revenue",
                    "Cost",
                    "Profit",
                    "GP (%)",
                  ].map((h) => (
                    <th
                      key={h}
                      style={
                        h === "Customer"
                          ? modalCustomerThStyle
                          : h === "GP (%)"
                            ? modalGpPctThStyle
                            : erpListThStyle(theme)
                      }
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(verifyProfitRow?.houses ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={12} style={tdPad}>
                      <Text size="sm" c="dimmed">
                        No house profit details available.
                      </Text>
                    </td>
                  </tr>
                ) : (
                  (verifyProfitRow?.houses ?? []).map((house, houseIndex) => (
                    <tr key={`${house.housing_id ?? houseIndex}`} {...erpListDataRowProps(theme)}>
                      <td style={tdPad}>
                        <Text size="sm" c={fg}>
                          {house.house_no || "—"}
                        </Text>
                      </td>
                      <td style={tdPad}>
                        <Text size="sm" c={fg}>
                          {house.subjob_no || "—"}
                        </Text>
                      </td>
                      <td
                        className={ERP_LIST_GEIST_MONO_CLASS}
                        style={tdPad}
                      >
                        <Text
                          size="sm"
                          fw={600}
                          c={house.quotation_id != null ? primary : fg}
                          style={{
                            cursor:
                              house.quotation_id != null ? "pointer" : "default",
                          }}
                          onClick={() => handleOpenQuotation(house.quotation_id)}
                        >
                          {house.quotation_no?.trim() || "—"}
                        </Text>
                      </td>
                      <td style={modalCustomerTdStyle}>
                        <Text size="sm" c={fg}>
                          {house.party_name || "—"}
                        </Text>
                      </td>
                      <td style={tdPad}>
                        <Text size="sm" c={fg}>
                          {formatCurrencyAmount(house.quoted_revenue, currency)}
                        </Text>
                      </td>
                      <td style={tdPad}>
                        <Text size="sm" c={fg}>
                          {formatCurrencyAmount(house.quoted_cost, currency)}
                        </Text>
                      </td>
                      <td style={tdPad}>
                        <SignedValueBadge
                          value={house.quoted_profit}
                          label={formatCurrencyAmount(house.quoted_profit, currency)}
                        />
                      </td>
                      <td style={tdPad}>
                        <Text size="sm" c={fg}>
                          {house.our_volume || "—"}
                        </Text>
                      </td>
                      <td style={tdPad}>
                        <Text size="sm" c={fg}>
                          {formatCurrencyAmount(house.our_revenue, currency)}
                        </Text>
                      </td>
                      <td style={tdPad}>
                        <Text size="sm" c={fg}>
                          {formatCurrencyAmount(house.our_cost, currency)}
                        </Text>
                      </td>
                      <td style={{ ...tdPad }}>
                        <Text size="sm" fw={600} c={fg}>
                          {formatCurrencyAmount(house.our_profit, currency)}
                        </Text>
                      </td>
                      <td style={modalGpPctTdStyle}>
                        <SignedValueBadge
                          value={house.our_gp_pct}
                          label={formatGpPercent(house.our_gp_pct)}
                        />
                      </td>
                    </tr>
                  ))
                )}
                <tr>
                  <td colSpan={10} style={{ ...tdPad, textAlign: "right" }}>
                    <Text size="sm" fw={700} c={fg}>
                      Total Profit
                    </Text>
                  </td>
                  <td style={{ ...tdPad }}>
                    <Text size="sm" fw={700} c={primary}>
                      {formatCurrencyAmount(
                        verifyProfitRow?.our_profit ??
                          sumHouseProfit(verifyProfitRow?.houses),
                        currency,
                      )}
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Box>
          <Group justify="flex-end" gap="xs" mt="md">
            <Button
              variant="subtle"
              onClick={() => setVerifyProfitRow(null)}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={() => void handleConfirmVerifyProfit()}
              loading={isVerifying}
              disabled={
                !verifyProfitRow?.consol_id ||
                (verifyProfitRow?.houses ?? []).length === 0 ||
                verifyProfitRow?.has_verified_profit === true
              }
            >
              Confirm Verify
            </Button>
          </Group>
        </Modal>
      </Box>
    </MantineProvider>
  );
}
