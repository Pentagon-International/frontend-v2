import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { MRT_PaginationState } from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Stack,
  Box,
  Menu,
  ActionIcon,
  Modal,
  Grid,
  TextInput,
  MantineProvider,
  Select,
  Tooltip,
  Center,
  Loader,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
  IconSearch,
  IconFilter,
  IconPackage,
  IconCircleCheck,
  IconClock,
  IconStack2,
  IconBriefcase,
  IconArrowRight,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  ToastNotification,
  SearchableSelect,
  SingleDateInput,
  Dropdown,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  erpToolbarSelectStyles,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistRootTypography,
  erpListGeistMenuDropdownStyles,
  erpListGeistSelectClassNames,
  erpListThStyle,
  erpListDataRowProps,
  erpListBookingMasterTableStyle,
  erpListStickyActionThStyle,
  erpListStickyActionTdStyle,
  ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
  erpListBookingMasterBodyTd,
  erpListBookingMasterDateTd,
  erpListBookingMasterReferenceTdShell,
  ERPListJobStatusPill,
  ERP_LIST_GEIST_MONO_CLASS,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import dayjs from "dayjs";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import { formatDisplayJobId } from "../../../utils/displayJobId";
import { ERPListJobActionMenu } from "../../../components/JobList/ERPListJobActionMenu";
import useDateFormat from "../../../hooks/useDateFormat";
import { withInlandImportJobServiceFields } from "./inlandImportJobService";

const LIST_KEY = "INLAND_IMPORT_JOB_MASTER";

type VisibleColumnsState = {
  sno: boolean;
  quotation_id: boolean;
  job_id: boolean;
  mawb: boolean;
  agent: boolean;
  route: boolean;
  job_date: boolean;
  etd: boolean;
  eta: boolean;
  status: boolean;
};

const INLAND_IMPORT_JOB_COLUMN_LABELS: Record<
  keyof VisibleColumnsState,
  string
> = {
  sno: "S.No",
  quotation_id: "Quotation ID",
  job_id: "Job ID",
  mawb: "MAWB No",
  agent: "Agent",
  route: "Route",
  job_date: "Job Date",
  etd: "ETD",
  eta: "ETA",
  status: "Status",
};

type InlandImportJobData = {
  id: number;
  sno?: number;
  quotation_id?: string | null;
  enquiry_id?: string | null;
  service_id?: number;
  service: string;
  service_code?: string;
  service_name?: string;
  service_type: string;
  agent_code: string | null;
  agent_name: string | null;
  origin_agent_code: string | null;
  origin_agent_name: string | null;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: string;
  eta: string;
  atd: string | null;
  ata: string | null;
  job_date?: string | null;
  carrier_code: string;
  carrier_name: string;
  vessel_name: string | null;
  voyage_number: string | null;
  mbl_number: string | null;
  mbl_date: string | null;
  flightno: string | null;
  mawb_no: string | null;
  mawb_date: string | null;
  ocean_routings?: Array<Record<string, unknown>>;
  housing_details?: Array<Record<string, unknown>>;
  created_by?: string;
  branch_code?: string;
  company_code?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  job_id?: string;
};

/** `summary` on `filterJobCreate` (totals are filter-scoped). */
type InlandImportJobListSummary = {
  status_counts?: {
    active?: number;
    closed?: number;
    cancel?: number;
  };
};

type InlandImportJobListQueryResult = {
  data: InlandImportJobData[];
  total: number;
  summary?: InlandImportJobListSummary;
};

/** Inland Import Booking route column: origin_code_read → origin_code → origin_name (same for destination). */
function routeEndpointsFromAirImportJobRow(row: InlandImportJobData) {
  const ext = row as InlandImportJobData & {
    origin_code_read?: string | null;
    destination_code_read?: string | null;
  };
  const oc =
    String(ext.origin_code_read || "").trim() ||
    String(row.origin_code || "").trim() ||
    String(row.origin_name || "").trim() ||
    "";
  const dc =
    String(ext.destination_code_read || "").trim() ||
    String(row.destination_code || "").trim() ||
    String(row.destination_name || "").trim() ||
    "";
  return { oc, dc };
}

type AirImportJobFilters = {
  job_id: string;
  mawb_no: string;
  agent_code: string;
  agent_name: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  /** Exact job_date (column header filter only). */
  job_date: string;
  /** Range job_date (filter panel); open-ended from/to. Mutually exclusive with job_date. */
  job_date_from: string;
  job_date_to: string;
  etd: string;
  eta: string;
  status: string;
};

function InlandImportJobMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = DEFAULT_ERP_LIST_THEME;
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(theme);
  const { muted, fg, primary } = theme;

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: AirImportJobFilters = {
    job_id: "",
    mawb_no: "",
    agent_code: "",
    agent_name: "",
    origin_code: "",
    origin_name: "",
    destination_code: "",
    destination_name: "",
    job_date: "",
    job_date_from: dayjs().startOf("month").format("YYYY-MM-DD"),
    job_date_to: dayjs().format("YYYY-MM-DD"),
    etd: "",
    eta: "",
    status: "",
  };
  const [draftFilters, setDraftFilters] =
    useState<AirImportJobFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AirImportJobFilters>(DEFAULT_FILTERS);
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
  const [cancelConfirmRow, setCancelConfirmRow] =
    useState<InlandImportJobData | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>({
    sno: true,
    quotation_id: true,
    job_id: true,
    mawb: true,
    agent: true,
    route: true,
    job_date: true,
    etd: true,
    eta: true,
    status: true,
  });

  const dateFormat = useDateFormat();
  const formatFilterDateLabel = useCallback(
    (iso: string) => {
      if (!iso?.trim()) return "";
      const d = dayjs(iso);
      return d.isValid() ? d.format(dateFormat) : iso;
    },
    [dateFormat],
  );

  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId(id),
    [],
  );
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );

  const commitHeaderFilters = useCallback(
    (partial: Partial<AirImportJobFilters>) => {
      setDraftFilters((prev) => {
        let next = { ...prev, ...partial };
        // Exact column job_date clears panel range (mutually exclusive).
        if ("job_date" in partial) {
          next = { ...next, job_date_from: "", job_date_to: "" };
        }
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, next);
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setStoreFilters],
  );

  const getStatusBadge = (statusRaw: string | undefined | null) => {
    const statusUpper = (statusRaw || "").toUpperCase();
    const label =
      statusUpper === "CANCEL"
        ? "Cancel"
        : statusUpper === "CLOSED"
          ? "Closed"
          : "Active";
    const color =
      label === "Cancel" ? "red" : label === "Closed" ? "blue" : "green";
    return { label, color } as const;
  };

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    setIsInitialLoad(true);

    if (!shouldRestore) {
      setIsRestoring(false);
      setIsInitialLoad(false);
      return;
    }

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }

    if (stored?.filters && typeof stored.filters === "object") {
      const restored = { ...DEFAULT_FILTERS, ...stored.filters };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    setIsInitialLoad(false);
  }, [location.key]);

  const pageIndex = pagination.pageIndex;
  const pageSize = pagination.pageSize;

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const handlePageIndexChange = (idx: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: idx }));
  };

  const applyFilters = () => {
    const from = draftFilters.job_date_from?.trim();
    const to = draftFilters.job_date_to?.trim();
    // Range from filter panel clears exact job_date (mutually exclusive).
    const next =
      from || to
        ? { ...draftFilters, job_date: "" }
        : draftFilters;
    setDraftFilters(next);
    setAppliedFilters(next);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, next);
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
    filters: AirImportJobFilters,
    searchValue: string,
  ): Record<string, string | { from?: string; to?: string }> => {
    const cleaned: Record<string, string | { from?: string; to?: string }> = {};
    const push = (
      apiKey: string,
      raw: string | undefined | null,
      mode?: "upper",
    ) => {
      const v = (raw ?? "").trim();
      if (!v) return;
      cleaned[apiKey] = mode === "upper" ? v.toUpperCase() : v;
    };

    push("job_id", filters.job_id);
    push("mawb_no", filters.mawb_no);
    push("origin_code", filters.origin_code);
    push("destination_code", filters.destination_code);
    push("etd", filters.etd);
    push("eta", filters.eta);
    push("status", filters.status, "upper");

    if (filters.agent_name?.trim()) cleaned.agent = filters.agent_name.trim();
    if (searchValue?.trim()) cleaned.search = searchValue.trim();

    const exactJobDate = filters.job_date?.trim();
    const jobDateFrom = filters.job_date_from?.trim();
    const jobDateTo = filters.job_date_to?.trim();
    if (exactJobDate) {
      cleaned.job_date = exactJobDate;
    } else if (jobDateFrom || jobDateTo) {
      const range: { from?: string; to?: string } = {};
      if (jobDateFrom) range.from = jobDateFrom;
      if (jobDateTo) range.to = jobDateTo;
      cleaned.job_date = range;
    }

    return cleaned;
  };

  const {
    data: importJobResponse,
    isLoading: importJobLoading,
    isFetching: importJobFetching,
    refetch: refetchImportJobs,
  } = useQuery<InlandImportJobListQueryResult>({
    queryKey: [
      "inlandImportJobs",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<InlandImportJobListQueryResult> => {
      const filtersPayload = buildFiltersPayload(
        appliedFilters,
        debouncedSearch,
      );

      const payload =
        Object.keys(filtersPayload).length > 0
          ? {
              filters: {
                service_type: "Import",
                service: "INLAND",
                ...filtersPayload,
              },
            }
          : {
              filters: {
                service_type: "Import",
                service: "INLAND",
              },
            };

      setIsInitialLoad(false);
      const offset = pagination.pageIndex * pagination.pageSize;
      const response = (await apiCallProtected.post(
        `${URL.filterJobCreate}?index=${offset}&limit=${pagination.pageSize}`,
        payload,
        API_HEADER,
      )) as Record<string, unknown>;

      const list = Array.isArray(response?.data)
        ? (response.data as InlandImportJobData[]).map((row) =>
            withInlandImportJobServiceFields(
              row as unknown as Record<string, unknown>,
            ) as InlandImportJobData,
          )
        : [];
      const total = getBookingShipmentFilterListTotal(response, list, offset);
      setTotalRecords(total);

      const rawSummary = response?.summary;
      const summary: InlandImportJobListSummary | undefined =
        rawSummary &&
        typeof rawSummary === "object" &&
        !Array.isArray(rawSummary)
          ? (rawSummary as InlandImportJobListSummary)
          : undefined;

      return { data: list, total, summary };
    },
    enabled: !isRestoring,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const importJobData = importJobResponse?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const maxPageIndex = totalPages - 1;
    if (pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pageSize, pageIndex]);

  const isLoading = importJobFetching || importJobLoading || isInitialLoad;

  const mergeTh = (minW: number = 120) => ({
    ...erpListThStyle(theme),
    minHeight: 52.4,
    height: 52.4,
    verticalAlign: "middle" as const,
    boxSizing: "border-box" as const,
    minWidth: minW,
  });

  // Reset to first page whenever the search term changes (after debounce).
  // Skip the initial value (and any restore-driven update) so we don't clobber a restored pageIndex.
  const lastDebouncedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRestoring) return;
    if (lastDebouncedSearchRef.current === null) {
      lastDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (lastDebouncedSearchRef.current === debouncedSearch) return;
    lastDebouncedSearchRef.current = debouncedSearch;
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
    );
  }, [debouncedSearch, isRestoring]);

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    const rowToCancel = cancelConfirmRow;
    setIsCancelling(true);
    try {
      const response = (await apiCallProtected.patch(
        `${URL.importJob}${rowToCancel.id}/`,
        { status: "CANCEL" },
        API_HEADER,
      )) as { status?: boolean; message?: string };
      if (response?.status === false) {
        throw new Error(response?.message || "Failed to cancel job");
      }
      setCancelConfirmRow(null);
      ToastNotification({
        type: "success",
        message: "Job cancelled successfully",
      });
      await refetchImportJobs();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel job",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const listSummary = importJobResponse?.summary;
  const stats = useMemo(() => {
    const sc = listSummary?.status_counts;
    if (sc) {
      return {
        total: totalRecords,
        active: sc.active ?? 0,
        closed: sc.closed ?? 0,
        cancel: sc.cancel ?? 0,
      };
    }
    const rows = importJobData;
    return {
      total: totalRecords,
      active: rows.filter((r) => (r.status ?? "").toUpperCase() === "ACTIVE")
        .length,
      closed: rows.filter((r) => (r.status ?? "").toUpperCase() === "CLOSED")
        .length,
      cancel: rows.filter((r) => (r.status ?? "").toUpperCase() === "CANCEL")
        .length,
    };
  }, [importJobData, totalRecords, listSummary]);

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof VisibleColumnsState)[]).map(
        (key) => ({
          id: String(key),
          label: INLAND_IMPORT_JOB_COLUMN_LABELS[key],
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

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={erpListGeistRootTypography}
      >
        <ERPListScreen
          theme={theme}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={theme}
                  icon={<IconPackage size={14} color={primary} />}
                  value={stats.total}
                  label="Total"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconCircleCheck size={14} color="#059669" />}
                  iconBackground="#d1fae5"
                  iconColor="#059669"
                  value={stats.active}
                  label="Active"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconClock size={14} color="#2563eb" />}
                  iconBackground="#dbeafe"
                  iconColor="#2563eb"
                  value={stats.closed}
                  label="Closed"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconX size={14} color="#dc2626" />}
                  iconBackground="#fee2e2"
                  iconColor="#dc2626"
                  value={stats.cancel}
                  label="Cancel"
                />
              </>
            ),
            secondary: (
              <>
                <Group gap={8} wrap="nowrap" align="center">
                  <IconStack2
                    size={16}
                    color={muted}
                    style={{ flexShrink: 0 }}
                  />
                  <Text fw={600} size="sm" c={fg} component="span">
                    {importJobData.length}
                  </Text>
                </Group>
                <Group gap={8} wrap="nowrap" align="center">
                  <IconBriefcase
                    size={16}
                    color={muted}
                    style={{ flexShrink: 0 }}
                  />
                  <Text fw={600} size="sm" c={fg} component="span">
                    {totalRecords.toLocaleString()}
                  </Text>
                  <Text size="xs" c={muted} component="span">
                    total
                  </Text>
                </Group>
              </>
            ),
            actions: (
              <>
                <TextInput
                  size="xs"
                  w={220}
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  leftSection={<IconSearch size={14} />}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    ) : null
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={{
                    input: {
                      fontFamily: theme.fontSans,
                      fontSize: 12,
                      height: 32,
                      minHeight: 32,
                    },
                  }}
                />
                <Select
                  size="xs"
                  w={130}
                  value={
                    appliedFilters.status?.trim()
                      ? appliedFilters.status
                      : "all"
                  }
                  onChange={(v) => {
                    const status = !v || v === "all" ? "" : v;
                    setDraftFilters((p) => ({ ...p, status }));
                    setAppliedFilters((p) => ({ ...p, status }));
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  data={[
                    { value: "all", label: "All Status" },
                    { value: "Active", label: "Active" },
                    { value: "Closed", label: "Closed" },
                    { value: "Cancel", label: "Cancel" },
                  ]}
                  classNames={erpListGeistSelectClassNames}
                  styles={erpToolbarSelectStyles(theme)}
                />
                <ERPListColumnToggleMenu
                  theme={theme}
                  items={columnToggleItems}
                  menuStyles={erpListGeistMenuDropdownStyles}
                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
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
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  styles={erpToolbarPrimaryButtonStyles(theme)}
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/inland/import-job/create");
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
            subtitle:
              "Refine Inland Import Jobs by reference, agent, route, or dates",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={theme}
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
                      label="Job ID"
                      placeholder="Type Job ID"
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
                    <FormTextInput
                      label="MAWB No"
                      placeholder="Type MAWB No"
                      size="xs"
                      styles={filterFieldStyles}
                      value={draftFilters.mawb_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          mawb_no: e.currentTarget.value,
                        }))
                      }
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      apiEndpoint={URL.agent}
                      label="Agent"
                      placeholder="Type Agent"
                      size="xs"
                      value={draftFilters.agent_code}
                      displayValue={draftFilters.agent_name}
                      onChange={(value, selectedData, originalData) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          agent_code: value || "",
                          agent_name:
                            selectedData?.label ||
                            String(
                              originalData?.customer_name ??
                                originalData?.name ??
                                value ??
                                "",
                            ),
                        }))
                      }
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item) => ({
                        value: String(item.customer_code ?? item.id ?? ""),
                        label: String(item.customer_name ?? item.name ?? ""),
                      })}
                      searchFields={["customer_code", "customer_name", "name"]}
                      returnOriginalData
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      apiEndpoint={URL.portMaster}
                      additionalParams={{ transport_mode: "AIR" }}
                      label="Origin"
                      placeholder="Type Origin"
                      size="xs"
                      value={draftFilters.origin_code}
                      displayValue={draftFilters.origin_name}
                      onChange={(value, selectedData, originalData) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          origin_code: value || "",
                          origin_name:
                            selectedData?.label ||
                            String(originalData?.port_name ?? value ?? ""),
                        }))
                      }
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      searchFields={["port_code", "port_name"]}
                      returnOriginalData
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      apiEndpoint={URL.portMaster}
                      label="Destination"
                      placeholder="Type Destination"
                      additionalParams={{ transport_mode: "AIR" }}
                      size="xs"
                      value={draftFilters.destination_code}
                      displayValue={draftFilters.destination_name}
                      onChange={(value, selectedData, originalData) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          destination_code: value || "",
                          destination_name:
                            selectedData?.label ||
                            String(originalData?.port_name ?? value ?? ""),
                        }))
                      }
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      searchFields={["port_code", "port_name"]}
                      returnOriginalData
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Job Date From"
                      size="xs"
                      value={
                        draftFilters.job_date_from
                          ? dayjs(draftFilters.job_date_from).toDate()
                          : null
                      }
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          job_date_from: date
                            ? dayjs(date).format("YYYY-MM-DD")
                            : "",
                          job_date: "",
                        }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Job Date To"
                      size="xs"
                      value={
                        draftFilters.job_date_to
                          ? dayjs(draftFilters.job_date_to).toDate()
                          : null
                      }
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          job_date_to: date
                            ? dayjs(date).format("YYYY-MM-DD")
                            : "",
                          job_date: "",
                        }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="ETD"
                      size="xs"
                      value={
                        draftFilters.etd
                          ? dayjs(draftFilters.etd).toDate()
                          : null
                      }
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          etd: date ? dayjs(date).format("YYYY-MM-DD") : "",
                        }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="ETA"
                      size="xs"
                      value={
                        draftFilters.eta
                          ? dayjs(draftFilters.eta).toDate()
                          : null
                      }
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          eta: date ? dayjs(date).format("YYYY-MM-DD") : "",
                        }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      label="Status"
                      placeholder="Select status"
                      size="xs"
                      searchable
                      clearable
                      data={[
                        { value: "Active", label: "Active" },
                        { value: "Closed", label: "Closed" },
                        { value: "Cancel", label: "Cancel" },
                      ]}
                      value={draftFilters.status || null}
                      onChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          status: value || "",
                        }))
                      }
                      styles={filterFieldStyles}
                      classNames={{
                        label: ERP_LIST_GEIST_ROOT_CLASS,
                        input: ERP_LIST_GEIST_ROOT_CLASS,
                        dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                        option: ERP_LIST_GEIST_ROOT_CLASS,
                      }}
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
                totalRecords={totalRecords}
                pageIndex={pageIndex}
                pageSize={pageSize}
                onPageIndexChange={handlePageIndexChange}
                onPageSizeChange={handlePageSizeChange}
                selectClassNames={erpListGeistSelectClassNames}
                pageSizeOptions={["10", "25", "50"]}
              />
            ),
            children: (
              <Box style={{ position: "relative", flex: 1, minHeight: 0 }}>
                <table style={erpListBookingMasterTableStyle(theme)}>
                  <thead>
                    <tr>
                      {visibleColumns.sno && <th style={mergeTh(40)}>S.No</th>}
                      {visibleColumns.quotation_id && (
                        <th style={mergeTh(180)}>Quotation ID</th>
                      )}
                      {visibleColumns.job_id && (
                        <th style={mergeTh(140)}>
                          <ERPListColumnHeaderFilter
                            label="Job ID"
                            value={appliedFilters.job_id}
                            displayValue={appliedFilters.job_id}
                            theme={theme}
                            placeholder="Filter Job ID"
                            isEditing={editingHeaderId === "job_id"}
                            onStartEdit={() => openHeaderEditor("job_id")}
                            onStopEdit={() => collapseHeaderEditor("job_id")}
                            onChange={(next) =>
                              commitHeaderFilters({ job_id: next || "" })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.mawb && (
                        <th style={mergeTh(140)}>
                          <ERPListColumnHeaderFilter
                            label="MAWB No"
                            value={appliedFilters.mawb_no}
                            displayValue={appliedFilters.mawb_no}
                            theme={theme}
                            placeholder="Filter MAWB"
                            isEditing={editingHeaderId === "mawb_no"}
                            onStartEdit={() => openHeaderEditor("mawb_no")}
                            onStopEdit={() => collapseHeaderEditor("mawb_no")}
                            onChange={(next) =>
                              commitHeaderFilters({ mawb_no: next || "" })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.agent && (
                        <th style={mergeTh(240)}>
                          <ERPListColumnHeaderFilter
                            label="Destination Agent"
                            value={appliedFilters.agent_code}
                            displayValue={
                              appliedFilters.agent_name ||
                              appliedFilters.agent_code
                            }
                            theme={theme}
                            placeholder="Filter agent"
                            isEditing={editingHeaderId === "agent"}
                            onStartEdit={() => openHeaderEditor("agent")}
                            onStopEdit={() => collapseHeaderEditor("agent")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus }) => (
                              <SearchableSelect
                                autoFocus={autoFocus}
                                size="xs"
                                placeholder="Agent"
                                apiEndpoint={URL.agent}
                                searchFields={[
                                  "customer_code",
                                  "customer_name",
                                  "name",
                                ]}
                                displayFormat={(item) => ({
                                  value: String(
                                    item.customer_code ?? item.id ?? "",
                                  ),
                                  label: String(
                                    item.customer_name ?? item.name ?? "",
                                  ),
                                })}
                                value={appliedFilters.agent_code || undefined}
                                displayValue={
                                  appliedFilters.agent_name || undefined
                                }
                                onChange={(
                                  value,
                                  selectedData,
                                  originalData,
                                ) => {
                                  commitHeaderFilters({
                                    agent_code: value || "",
                                    agent_name:
                                      selectedData?.label ||
                                      String(
                                        originalData?.customer_name ??
                                          originalData?.name ??
                                          value ??
                                          "",
                                      ),
                                  });
                                }}
                                minSearchLength={1}
                                dropdownZIndex={1000}
                                returnOriginalData
                                classNames={erpListGeistSelectClassNames}
                                styles={filterFieldStyles}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.route && (
                        <th style={mergeTh(220)}>
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
                              <Group
                                gap={4}
                                wrap="nowrap"
                                style={{ width: "100%" }}
                              >
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <SearchableSelect
                                    autoFocus={autoFocus}
                                    size="xs"
                                    apiEndpoint={URL.portMaster}
                                    additionalParams={{ transport_mode: "AIR" }}
                                    searchFields={["port_code", "port_name"]}
                                    placeholder="Origin"
                                    displayFormat={(
                                      item: Record<string, unknown>,
                                    ) => ({
                                      value: String(item.port_code),
                                      label: `${item.port_name} (${item.port_code})`,
                                    })}
                                    value={appliedFilters.origin_code}
                                    displayValue={appliedFilters.origin_name}
                                    onChange={(
                                      value,
                                      selectedData,
                                      originalData,
                                    ) =>
                                      commitHeaderFilters({
                                        origin_code: value || "",
                                        origin_name:
                                          selectedData?.label ||
                                          String(
                                            originalData?.port_name ??
                                              value ??
                                              "",
                                          ),
                                      })
                                    }
                                    minSearchLength={1}
                                    dropdownZIndex={1000}
                                    returnOriginalData
                                    classNames={erpListGeistSelectClassNames}
                                    styles={filterFieldStyles}
                                  />
                                </Box>
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <SearchableSelect
                                    size="xs"
                                    apiEndpoint={URL.portMaster}
                                    additionalParams={{ transport_mode: "AIR" }}
                                    searchFields={["port_code", "port_name"]}
                                    placeholder="Destination"
                                    displayFormat={(
                                      item: Record<string, unknown>,
                                    ) => ({
                                      value: String(item.port_code),
                                      label: `${item.port_name} (${item.port_code})`,
                                    })}
                                    value={appliedFilters.destination_code}
                                    displayValue={
                                      appliedFilters.destination_name
                                    }
                                    onChange={(
                                      value,
                                      selectedData,
                                      originalData,
                                    ) =>
                                      commitHeaderFilters({
                                        destination_code: value || "",
                                        destination_name:
                                          selectedData?.label ||
                                          String(
                                            originalData?.port_name ??
                                              value ??
                                              "",
                                          ),
                                      })
                                    }
                                    minSearchLength={1}
                                    dropdownZIndex={1000}
                                    returnOriginalData
                                    classNames={erpListGeistSelectClassNames}
                                    styles={filterFieldStyles}
                                  />
                                </Box>
                              </Group>
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.job_date && (
                        <th style={mergeTh(200)}>
                          <ERPListColumnHeaderFilter
                            label="Job Date"
                            value={appliedFilters.job_date}
                            displayValue={formatFilterDateLabel(
                              appliedFilters.job_date,
                            )}
                            theme={theme}
                            isEditing={editingHeaderId === "job_date"}
                            onStartEdit={() => openHeaderEditor("job_date")}
                            onStopEdit={() => collapseHeaderEditor("job_date")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                size="xs"
                                value={
                                  appliedFilters.job_date
                                    ? dayjs(appliedFilters.job_date).toDate()
                                    : null
                                }
                                onChange={(date) => {
                                  commitHeaderFilters({
                                    job_date: date
                                      ? dayjs(date).format("YYYY-MM-DD")
                                      : "",
                                  });
                                  if (date) onClose();
                                }}
                                classNames={{
                                  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                                }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.etd && (
                        <th style={mergeTh(200)}>
                          <ERPListColumnHeaderFilter
                            label="ETD"
                            value={appliedFilters.etd}
                            displayValue={formatFilterDateLabel(
                              appliedFilters.etd,
                            )}
                            theme={theme}
                            isEditing={editingHeaderId === "etd"}
                            onStartEdit={() => openHeaderEditor("etd")}
                            onStopEdit={() => collapseHeaderEditor("etd")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                size="xs"
                                value={
                                  appliedFilters.etd
                                    ? dayjs(appliedFilters.etd).toDate()
                                    : null
                                }
                                onChange={(date) => {
                                  commitHeaderFilters({
                                    etd: date
                                      ? dayjs(date).format("YYYY-MM-DD")
                                      : "",
                                  });
                                  if (date) onClose();
                                }}
                                classNames={{
                                  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                                }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.eta && (
                        <th style={mergeTh(200)}>
                          <ERPListColumnHeaderFilter
                            label="ETA"
                            value={appliedFilters.eta}
                            displayValue={formatFilterDateLabel(
                              appliedFilters.eta,
                            )}
                            theme={theme}
                            isEditing={editingHeaderId === "eta"}
                            onStartEdit={() => openHeaderEditor("eta")}
                            onStopEdit={() => collapseHeaderEditor("eta")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                size="xs"
                                value={
                                  appliedFilters.eta
                                    ? dayjs(appliedFilters.eta).toDate()
                                    : null
                                }
                                onChange={(date) => {
                                  commitHeaderFilters({
                                    eta: date
                                      ? dayjs(date).format("YYYY-MM-DD")
                                      : "",
                                  });
                                  if (date) onClose();
                                }}
                                classNames={{
                                  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                                }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.status && (
                        <th style={mergeTh(100)}>
                          <ERPListColumnHeaderFilter
                            label="Status"
                            value={appliedFilters.status}
                            displayValue={appliedFilters.status}
                            theme={theme}
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
                                data={[
                                  { value: "Active", label: "Active" },
                                  { value: "Closed", label: "Closed" },
                                  { value: "Cancel", label: "Cancel" },
                                ]}
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
                        </th>
                      )}
                      <th
                        style={{
                          ...erpListStickyActionThStyle(theme, 96),
                          minHeight: 52.4,
                          height: 52.4,
                          verticalAlign: "middle",
                          boxSizing: "border-box",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={20}
                          style={{ padding: 80, textAlign: "center" }}
                        >
                          <Center className="erp-header-filter-fade">
                            <Stack align="center" gap="sm">
                              <Loader size="lg" color={primary} />
                              <Text
                                c="dimmed"
                                size="sm"
                                style={{ fontFamily: theme.fontSans }}
                              >
                                Loading Inland Import Jobs…
                              </Text>
                            </Stack>
                          </Center>
                        </td>
                      </tr>
                    ) : importJobData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          style={{ padding: 60, textAlign: "center" }}
                        >
                          <Stack align="center" gap="md">
                            <Box
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                backgroundColor:
                                  ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconPackage size={24} color={muted} />
                            </Box>
                            <Box>
                              <Text fw={500} c={fg}>
                                No jobs to display
                              </Text>
                              <Text size="sm" c={muted} mt={4}>
                                Try adjusting your search or filters
                              </Text>
                            </Box>
                          </Stack>
                        </td>
                      </tr>
                    ) : (
                      importJobData.map((row, i) => {
                        const rowProps = erpListDataRowProps(theme);
                        const sno = row.sno ?? pageIndex * pageSize + i + 1;
                        const tdPad = erpListBookingMasterBodyTd();
                        const tdDate = erpListBookingMasterDateTd(theme);
                        const refShell =
                          erpListBookingMasterReferenceTdShell(theme);
                        const fmtUtcLocal = (v: string | null | undefined) => {
                          if (!v) return "—";
                          try {
                            const raw = String(v).trim();
                            const d = dayjs(raw);
                            if (!d.isValid()) return raw;
                            // Bare YYYY-MM-DD: parse as calendar day like Ocean Export (avoid UTC-midnight shift).
                            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                              return d.format(dateFormat);
                            }
                            return d.format(`${dateFormat} HH:mm`);
                          } catch {
                            return v;
                          }
                        };
                        return (
                          <tr
                            key={row.id}
                            style={rowProps.style}
                            onMouseEnter={rowProps.onMouseEnter}
                            onMouseLeave={rowProps.onMouseLeave}
                          >
                            {visibleColumns.sno && (
                              <td style={tdPad}>
                                <Text fw={600} size="sm" c={fg}>
                                  {sno}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.quotation_id && (
                              <td style={tdPad}>
                                <Text fw={600} size="sm" c={fg}>
                                  {row.quotation_id?.trim()
                                    ? row.quotation_id
                                    : "—"}
                                </Text>
                                {row.enquiry_id ? (
                                  <Text fz={10} c={muted}>
                                    {row.enquiry_id}
                                  </Text>
                                ) : null}
                              </td>
                            )}
                            {visibleColumns.job_id && (
                              <td style={tdPad}>
                                <Text fw={600} size="sm" c={fg}>
                                  {formatDisplayJobId(row.job_id, row.service_code) || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.mawb && (
                              <td
                                className={ERP_LIST_GEIST_MONO_CLASS}
                                style={refShell}
                              >
                                {row.mawb_no ? (
                                  <Text size="xs" fw={500} c={fg}>
                                    {row.mawb_no}
                                  </Text>
                                ) : (
                                  <Text size="sm" c={muted}>
                                    —
                                  </Text>
                                )}
                              </td>
                            )}
                            {visibleColumns.agent && (
                              <td style={{ ...tdPad, maxWidth: 200 }}>
                                <Tooltip
                                  label={row.agent_name ?? ""}
                                  withArrow
                                  styles={{
                                    tooltip: {
                                      fontFamily: theme.fontSans,
                                      fontSize: 12,
                                    },
                                  }}
                                >
                                  <Text
                                    size="sm"
                                    c={fg}
                                    lineClamp={1}
                                    style={{ cursor: "default" }}
                                  >
                                    {row.agent_name || "—"}
                                  </Text>
                                </Tooltip>
                              </td>
                            )}
                            {visibleColumns.route &&
                              (() => {
                                const { oc, dc } =
                                  routeEndpointsFromAirImportJobRow(row);
                                return (
                                  <td style={tdPad}>
                                    <Group gap={6} wrap="nowrap">
                                      <Text fw={600} size="sm" c={primary}>
                                        {oc || "—"}
                                      </Text>
                                      <IconArrowRight size={12} color={muted} />
                                      <Text fw={500} size="sm" c={fg}>
                                        {dc || "—"}
                                      </Text>
                                    </Group>
                                  </td>
                                );
                              })()}
                            {visibleColumns.job_date && (
                              <td style={tdDate}>{fmtUtcLocal(row.job_date)}</td>
                            )}
                            {visibleColumns.etd && (
                              <td style={tdDate}>{fmtUtcLocal(row.etd)}</td>
                            )}
                            {visibleColumns.eta && (
                              <td style={tdDate}>{fmtUtcLocal(row.eta)}</td>
                            )}
                            {visibleColumns.status && (
                              <td style={tdPad}>
                                <ERPListJobStatusPill status={row.status} />
                              </td>
                            )}
                            <td style={erpListStickyActionTdStyle(theme)}>
                              {(() => {
                                const statusUpper = (
                                  row.status ?? ""
                                ).toUpperCase();
                                const canCancel =
                                  statusUpper !== "GENERATED" && statusUpper !== "CANCEL";
                                return (
                                  <ERPListJobActionMenu
                                    status={row.status}
                                    variant="job-page"
                                    canCancel={canCancel}
                                    onEdit={() => {
                                      setStoreFilters(LIST_KEY, appliedFilters);
                                      setStoreSearch(LIST_KEY, search);
                                      setShouldRestore(LIST_KEY, true);
                                      navigate(`/inland/import-job/edit`, {
                                        state: {
                                          job: withInlandImportJobServiceFields(
                                            row as unknown as Record<
                                              string,
                                              unknown
                                            >,
                                          ),
                                        },
                                      });
                                    }}
                                    onView={() => {
                                      setStoreFilters(LIST_KEY, appliedFilters);
                                      setStoreSearch(LIST_KEY, search);
                                      setShouldRestore(LIST_KEY, true);
                                      navigate(`/inland/import-job/view`, {
                                        state: {
                                          job: withInlandImportJobServiceFields(
                                            row as unknown as Record<
                                              string,
                                              unknown
                                            >,
                                          ),
                                          jobId: row.id ?? row.job_id,
                                          actionType: "view",
                                          viewMode: true,
                                        },
                                      });
                                    }}
                                    onCancel={() => setCancelConfirmRow(row)}
                                  />
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Box>
            ),
          }}
        />

        <Modal
          opened={!!cancelConfirmRow}
          onClose={() => !isCancelling && setCancelConfirmRow(null)}
          title={
            <Text fw={600} size="md" style={{ fontFamily: theme.fontSans }}>
              Cancel job
            </Text>
          }
          centered
          classNames={{
            content: ERP_LIST_GEIST_ROOT_CLASS,
            body: ERP_LIST_GEIST_ROOT_CLASS,
            header: ERP_LIST_GEIST_ROOT_CLASS,
          }}
        >
          <Text
            size="sm"
            c="dimmed"
            mb="md"
            style={{ fontFamily: theme.fontSans }}
          >
            Are you sure you want to cancel this job? This action cannot be
            undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              onClick={() => setCancelConfirmRow(null)}
              disabled={isCancelling}
            >
              No
            </Button>
            <Button
              color="red"
              onClick={handleConfirmCancel}
              loading={isCancelling}
            >
              Yes, cancel
            </Button>
          </Group>
        </Modal>
      </Box>
    </MantineProvider>
  );
}

export default InlandImportJobMaster;
