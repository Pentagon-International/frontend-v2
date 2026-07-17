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
  IconBriefcase,
  IconCircleCheck,
  IconClock,
  IconStack2,
  IconArrowRight,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  erpToolbarSelectStyles,
  erpListFilterUnifiedMantineStyles,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
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
import useDateFormat from "../../../hooks/useDateFormat";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import { formatDisplayJobId } from "../../../utils/displayJobId";
import { getOceanJobListVolumeDisplay } from "../../../utils/oceanJobListVolume";
import { ERPListJobActionMenu } from "../../../components/JobList/ERPListJobActionMenu";

const LIST_KEY = "OCEAN_IMPORT_JOB_MASTER";

type VisibleColumnsState = {
  sno: boolean;
  quotation_id: boolean;
  job_id: boolean;
  mbl: boolean;
  service: boolean;
  agent: boolean;
  volume: boolean;
  route: boolean;
  etd: boolean;
  eta: boolean;
  status: boolean;
};

const OCEAN_IMPORT_JOB_COLUMN_LABELS: Record<keyof VisibleColumnsState, string> = {
  sno: "S.No",
  quotation_id: "Quotation ID",
  job_id: "Job ID",
  mbl: "MBL No",
  service: "Service",
  agent: "Agent",
  volume: "Volume",
  route: "Route",
  etd: "ETD",
  eta: "ETA",
  status: "Status",
};

type ImportJobData = {
  id: number;
  sno?: number;
  quotation_id?: string | null;
  enquiry_id?: string | null;
  service_id?: number;
  service: string;
  is_direct?: boolean | string | number;
  agent_code: string | null;
  agent_name: string | null;
  origin_agent: string | null;
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
  schedule_id: string | null;
  carrier_code: string;
  carrier_name: string;
  vessel_name: string | null;
  voyage_number: string | null;
  mbl_number: string | null;
  mbl_date: string | null;
  status: string;
  job_id?: string;
  service_code?: string;
  booking_no?: string | null;
  actual_booking_no?: string[];
  summary?: {
    estimates_total_cost?: string | number | null;
    container_type?: string[] | null;
    volume_total?: string | number | null;
  };
  housing_details?: Array<{
    hbl_number: string;
  }>;
  document_ids?: number[];
  documents?: Array<{
    id: number;
    document_name?: string;
    user_file_name?: string;
    document_url?: string;
  }>;
};

/** `summary` on `filterJobCreate` list (filter-scoped). */
type ImportJobListSummary = {
  total_shipments?: number;
  status_counts?: {
    active?: number;
    closed?: number;
    cancel?: number;
  };
};

type ImportJobListQueryResult = {
  data: ImportJobData[];
  summary?: ImportJobListSummary;
};

/** Booking-style route column: origin_code_read → origin_code → origin_name (same for destination). */
function routeEndpointsFromImportJobRow(row: ImportJobData) {
  const ext = row as ImportJobData & {
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

type OceanImportJobFilters = {
  job_id: string;
  mbl_number: string;
  origin_agent: string;
  origin_agent_label: string;
  origin_code: string;
  origin_port_label: string;
  destination_code: string;
  destination_name: string;
  service: string;
  etd: string;
  eta: string;
  status: string;
};

function ImportJobMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isRefreshingFromEdit = useRef(false);
  const theme = DEFAULT_ERP_LIST_THEME;
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(theme);
  const { muted, fg, primary } = theme;

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const DEFAULT_FILTERS: OceanImportJobFilters = {
    job_id: "",
    mbl_number: "",
    origin_agent: "",
    origin_agent_label: "",
    origin_code: "",
    origin_port_label: "",
    destination_code: "",
    destination_name: "",
    service: "",
    etd: "",
    eta: "",
    status: "",
  };
  const [draftFilters, setDraftFilters] =
    useState<OceanImportJobFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<OceanImportJobFilters>(DEFAULT_FILTERS);
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
  const [cancelConfirmRow, setCancelConfirmRow] = useState<ImportJobData | null>(
    null
  );
  const dateFormat = useDateFormat();
  const formatFilterDateLabel = useCallback(
    (iso: string) => {
      if (!iso?.trim()) return "";
      const d = dayjs(iso);
      return d.isValid() ? d.format(dateFormat) : iso;
    },
    [dateFormat],
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>({
    sno: true,
    quotation_id: true,
    job_id: true,
    mbl: true,
    service: true,
    agent: true,
    volume: true,
    route: true,
    etd: true,
    eta: true,
    status: true,
  });

  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback((id: string) => setEditingHeaderId(id), []);
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );

  const commitHeaderFilters = useCallback(
    (partial: Partial<OceanImportJobFilters>) => {
      setDraftFilters((prev) => {
        const next = { ...prev, ...partial };
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, next);
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setStoreFilters],
  );

  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  const getStatusBadge = (statusRaw: string | undefined | null) => {
    const statusUpper = (statusRaw || "").toUpperCase();
    const label =
      statusUpper === "CANCEL"
        ? "Cancel"
        : statusUpper === "CLOSED"
          ? "Closed"
          : "Active";
    const color = label === "Cancel" ? "red" : label === "Closed" ? "blue" : "green";
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
  const index = pagination.pageIndex * pagination.pageSize;

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const handlePageIndexChange = (idx: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: idx }));
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
    filters: OceanImportJobFilters,
    searchValue: string
  ): Record<string, string | string[]> => {
    const cleaned: Record<string, string> = {};

    const entries: [keyof OceanImportJobFilters, string][] = [
      ["job_id", filters.job_id],
      ["mbl_number", filters.mbl_number],
      ["origin_code", filters.origin_code],
      ["destination_code", filters.destination_code],
      ["etd", filters.etd],
      ["eta", filters.eta],
    ];

    entries.forEach(([key, value]) => {
      if (!value?.trim()) return;
      cleaned[key as string] = value.trim();
    });

    if (filters.origin_agent_label?.trim()) {
      cleaned.agent = filters.origin_agent_label.trim();
    } else if (filters.origin_agent?.trim()) {
      cleaned.agent = filters.origin_agent.trim();
    }

    if (filters.status?.trim()) {
      cleaned.status = filters.status.trim().toUpperCase();
    }

    if (searchValue?.trim()) cleaned.search = searchValue.trim();

    const serviceVal = filters.service?.trim();
    const base: Record<string, string | string[]> = {
      service: serviceVal ? serviceVal : ["FCL", "LCL"],
      service_type: "Import",
      ...cleaned,
    };

    return base;
  };

  const {
    data: importJobListResult,
    isLoading: importJobLoading,
    isFetching: importJobFetching,
    refetch: refetchImportJobs,
  } = useQuery<ImportJobListQueryResult>({
    queryKey: [
      "oceanImportJobs",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<ImportJobListQueryResult> => {
      const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);

      setIsInitialLoad(false);
      const response = (await apiCallProtected.post(
        `${URL.filterJobCreate}?index=${index}&limit=${pagination.pageSize}`,
        { filters: filtersPayload },
        API_HEADER
      )) as Record<string, unknown>;

      const list = Array.isArray(response.data)
        ? (response.data as ImportJobData[])
        : [];
      const listTotal = getBookingShipmentFilterListTotal(response, list, index);
      const rawSummary = response.summary;
      const summary: ImportJobListSummary | undefined =
        rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
          ? (rawSummary as ImportJobListSummary)
          : undefined;
      const summaryTotal = summary?.total_shipments;
      const total =
        typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
          ? summaryTotal
          : listTotal;
      setTotalRecords(total);

      return { data: list, summary };
    },
    enabled: !isRestoring,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const importJobData = importJobListResult?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pageSize, pagination.pageIndex]);

  const isLoading = importJobFetching || importJobLoading || isInitialLoad;

  const mergeTh = (minW: number, widthPx: number) => ({
    ...erpListThStyle(theme),
    minHeight: 52.4,
    height: 52.4,
    verticalAlign: "middle" as const,
    boxSizing: "border-box" as const,
    minWidth: minW,
    width: widthPx,
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

  useEffect(() => {
    if (location.state?.refreshData && !isRefreshingFromEdit.current) {
      isRefreshingFromEdit.current = true;
      queryClient.invalidateQueries({ queryKey: ["oceanImportJobs"] });
      refetchImportJobs().finally(() => {
        navigate(location.pathname, { replace: true, state: {} });
        setTimeout(() => {
          isRefreshingFromEdit.current = false;
        }, 1000);
      });
    }
  }, [
    location.state?.refreshData,
    navigate,
    location.pathname,
    queryClient,
    refetchImportJobs,
  ]);

  const persistListAndNavigate = useCallback(
    (to: string, state?: object) => {
      setStoreFilters(LIST_KEY, appliedFilters);
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate(to, state !== undefined ? { state } : undefined);
    },
    [
      appliedFilters,
      search,
      navigate,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
    ]
  );

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    const rowToCancel = cancelConfirmRow;
    setIsCancelling(true);
    try {
      const response = (await apiCallProtected.patch(
        `${URL.importJob}${rowToCancel.id}/`,
        { status: "CANCEL" },
        API_HEADER
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

  const stats = useMemo(() => {
    const rows = importJobData;
    const summary = importJobListResult?.summary;
    if (summary) {
      const sc = summary.status_counts ?? {};
      return {
        total: summary.total_shipments ?? totalRecords,
        active: sc.active ?? 0,
        closed: sc.closed ?? 0,
        cancel: sc.cancel ?? 0,
      };
    }
    return {
      total: totalRecords,
      active: rows.filter((r) => (r.status ?? "").toUpperCase() === "ACTIVE").length,
      closed: rows.filter((r) => (r.status ?? "").toUpperCase() === "CLOSED").length,
      cancel: rows.filter((r) => (r.status ?? "").toUpperCase() === "CANCEL").length,
    };
  }, [importJobData, importJobListResult?.summary, totalRecords]);

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof VisibleColumnsState)[]).map((key) => ({
        id: String(key),
        label: OCEAN_IMPORT_JOB_COLUMN_LABELS[key],
        checked: visibleColumns[key],
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
          })),
      })),
    [visibleColumns],
  );

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box className={ERP_LIST_GEIST_ROOT_CLASS} style={erpListGeistRootTypography}>
        <ERPListScreen
          theme={theme}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={theme}
                  icon={<IconBriefcase size={14} color={primary} />}
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
                  <IconStack2 size={16} color={muted} style={{ flexShrink: 0 }} />
                  <Text fw={600} size="sm" c={fg} component="span">
                    {importJobData.length}
                  </Text>
                </Group>
                <Group gap={8} wrap="nowrap" align="center">
                  <IconBriefcase size={16} color={muted} style={{ flexShrink: 0 }} />
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
                  value={appliedFilters.status?.trim() ? appliedFilters.status : "all"}
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
                  onClick={() => persistListAndNavigate("/SeaExport/import-job/create")}
                >
                  Create New
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine import jobs by reference, agent, route, or dates",
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
                        setDraftFilters((prev) => ({ ...prev, job_id: e.currentTarget.value }))
                      }
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="MBL Number"
                      placeholder="Enter MBL Number"
                      size="xs"
                      styles={filterFieldStyles}
                      value={draftFilters.mbl_number}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          mbl_number: e.currentTarget.value,
                        }))
                      }
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      size="xs"
                      label="Origin Agent"
                      placeholder="Type agent name"
                      apiEndpoint={URL.agent}
                      searchFields={["customer_name", "customer_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.customer_name),
                        label: String(item.customer_name),
                      })}
                      value={draftFilters.origin_agent || undefined}
                      displayValue={draftFilters.origin_agent_label || undefined}
                      onChange={(value, selectedData) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          origin_agent: value || "",
                          origin_agent_label: selectedData?.label || value || "",
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
                      additionalParams={seaTransportParams}
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
                      additionalParams={seaTransportParams}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      label="Service"
                      placeholder="Select Service"
                      size="xs"
                      searchable
                      clearable
                      data={["FCL", "LCL"]}
                      value={draftFilters.service || null}
                      onChange={(value) =>
                        setDraftFilters((prev) => ({ ...prev, service: value || "" }))
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
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="ETD"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={draftFilters.etd ? dayjs(draftFilters.etd).toDate() : null}
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
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={draftFilters.eta ? dayjs(draftFilters.eta).toDate() : null}
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
                        setDraftFilters((prev) => ({ ...prev, status: value || "" }))
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
                      {visibleColumns.sno && <th style={mergeTh(70, 70)}>S.No</th>}
                      {visibleColumns.quotation_id && (
                        <th style={mergeTh(180, 180)}>Quotation ID</th>
                      )}
                      {visibleColumns.job_id && (
                        <th style={mergeTh(150, 150)}>
                          <ERPListColumnHeaderFilter
                            label="Job ID"
                            value={appliedFilters.job_id}
                            displayValue={appliedFilters.job_id}
                            theme={theme}
                            placeholder="Filter Job ID"
                            isEditing={editingHeaderId === "job_id"}
                            onStartEdit={() => openHeaderEditor("job_id")}
                            onStopEdit={() => collapseHeaderEditor("job_id")}
                            onChange={(next) => commitHeaderFilters({ job_id: next || "" })}
                          />
                        </th>
                      )}
                      {visibleColumns.mbl && (
                        <th style={mergeTh(150, 150)}>
                          <ERPListColumnHeaderFilter
                            label="MBL No"
                            value={appliedFilters.mbl_number}
                            displayValue={appliedFilters.mbl_number}
                            theme={theme}
                            placeholder="Filter MBL"
                            isEditing={editingHeaderId === "mbl_number"}
                            onStartEdit={() => openHeaderEditor("mbl_number")}
                            onStopEdit={() => collapseHeaderEditor("mbl_number")}
                            onChange={(next) => commitHeaderFilters({ mbl_number: next || "" })}
                          />
                        </th>
                      )}
                      {visibleColumns.service && (
                        <th style={mergeTh(100, 100)}>
                          <ERPListColumnHeaderFilter
                            label="Service"
                            value={appliedFilters.service ?? ""}
                            displayValue={appliedFilters.service || ""}
                            theme={theme}
                            placeholder="FCL / LCL"
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
                                data={[
                                  { value: "FCL", label: "FCL" },
                                  { value: "LCL", label: "LCL" },
                                ]}
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
                      )}
                      {visibleColumns.agent && (
                        <th style={mergeTh(200, 200)}>
                          <ERPListColumnHeaderFilter
                            label="Origin Agent"
                            value={appliedFilters.origin_agent}
                            displayValue={appliedFilters.origin_agent_label || appliedFilters.origin_agent}
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
                                searchFields={["customer_name", "customer_code"]}
                                displayFormat={(item: Record<string, unknown>) => ({
                                  value: String(item.customer_name),
                                  label: String(item.customer_name),
                                })}
                                value={appliedFilters.origin_agent || undefined}
                                displayValue={appliedFilters.origin_agent_label || undefined}
                                onChange={(value, selectedData) => {
                                  commitHeaderFilters({
                                    origin_agent: value || "",
                                    origin_agent_label: selectedData?.label || value || "",
                                  });
                                }}
                                minSearchLength={2}
                                dropdownZIndex={1000}
                                classNames={erpListGeistSelectClassNames}
                                styles={filterFieldStyles}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.volume && (
                        <th style={mergeTh(160, 160)}>Volume</th>
                      )}
                      {visibleColumns.route && (
                        <th style={mergeTh(220, 220)}>
                          <ERPListColumnHeaderFilter
                            label="Route"
                            value={
                              (appliedFilters.origin_code || "") + (appliedFilters.destination_code || "")
                            }
                            displayValue={
                              appliedFilters.origin_code || appliedFilters.destination_code
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
                                    additionalParams={seaTransportParams}
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
                                    additionalParams={seaTransportParams}
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
                      )}
                      {visibleColumns.etd && (
                        <th style={mergeTh(130, 130)}>
                          <ERPListColumnHeaderFilter
                            label="ETD"
                            value={appliedFilters.etd}
                            displayValue={formatFilterDateLabel(appliedFilters.etd)}
                            theme={theme}
                            isEditing={editingHeaderId === "etd"}
                            onStartEdit={() => openHeaderEditor("etd")}
                            onStopEdit={() => collapseHeaderEditor("etd")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                placeholder="YYYY-MM-DD"
                                size="xs"
                                value={appliedFilters.etd ? dayjs(appliedFilters.etd).toDate() : null}
                                onChange={(date) => {
                                  commitHeaderFilters({
                                    etd: date ? dayjs(date).format("YYYY-MM-DD") : "",
                                  });
                                  if (date) onClose();
                                }}
                                classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.eta && (
                        <th style={mergeTh(130, 130)}>
                          <ERPListColumnHeaderFilter
                            label="ETA"
                            value={appliedFilters.eta}
                            displayValue={formatFilterDateLabel(appliedFilters.eta)}
                            theme={theme}
                            isEditing={editingHeaderId === "eta"}
                            onStartEdit={() => openHeaderEditor("eta")}
                            onStopEdit={() => collapseHeaderEditor("eta")}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                placeholder="YYYY-MM-DD"
                                size="xs"
                                value={appliedFilters.eta ? dayjs(appliedFilters.eta).toDate() : null}
                                onChange={(date) => {
                                  commitHeaderFilters({
                                    eta: date ? dayjs(date).format("YYYY-MM-DD") : "",
                                  });
                                  if (date) onClose();
                                }}
                                classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.status && (
                        <th style={mergeTh(130, 130)}>
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
                        <td colSpan={20} style={{ padding: 80, textAlign: "center" }}>
                          <Center className="erp-header-filter-fade">
                            <Stack align="center" gap="sm">
                              <Loader size="lg" color={primary} />
                              <Text c="dimmed" size="sm" style={{ fontFamily: theme.fontSans }}>
                                Loading import jobs…
                              </Text>
                            </Stack>
                          </Center>
                        </td>
                      </tr>
                    ) : importJobData.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 60, textAlign: "center" }}>
                          <Stack align="center" gap="md">
                            <Box
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                backgroundColor: ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconBriefcase size={24} color={muted} />
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
                        const refShell = erpListBookingMasterReferenceTdShell(theme);
                        const fmtDate = (v: string | null | undefined) => {
                          if (!v) return "—";
                          try {
                            const d = dayjs(v);
                            return d.isValid() ? d.format(dateFormat) : v;
                          } catch {
                            return v;
                          }
                        };
                        const volumeDisplay = getOceanJobListVolumeDisplay(
                          row.service,
                          row.summary,
                        );
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
                                  {row.quotation_id?.trim() ? row.quotation_id : "—"}
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
                            {visibleColumns.mbl && (
                              <td
                                className={ERP_LIST_GEIST_MONO_CLASS}
                                style={refShell}
                              >
                                {row.mbl_number ? (
                                  <Text size="xs" fw={500} c={fg}>
                                    {row.mbl_number}
                                  </Text>
                                ) : (
                                  <Text size="sm" c={muted}>
                                    —
                                  </Text>
                                )}
                              </td>
                            )}
                            {visibleColumns.service && (
                              <td style={tdPad}>
                                <Text size="sm" fw={600} c={fg}>
                                  {row.service || "—"}
                                </Text>
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
                            {visibleColumns.volume && (
                              <td style={{ ...tdPad, maxWidth: 220 }}>
                                <Tooltip
                                  label={volumeDisplay}
                                  withArrow
                                  disabled={volumeDisplay === "—"}
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
                                    lineClamp={2}
                                    style={{ cursor: "default" }}
                                  >
                                    {volumeDisplay}
                                  </Text>
                                </Tooltip>
                              </td>
                            )}
                            {visibleColumns.route && (() => {
                              const { oc, dc } = routeEndpointsFromImportJobRow(row);
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
                            {visibleColumns.etd && (
                              <td style={tdDate}>{fmtDate(row.etd)}</td>
                            )}
                            {visibleColumns.eta && (
                              <td style={tdDate}>{fmtDate(row.eta)}</td>
                            )}
                            {visibleColumns.status && (
                              <td style={tdPad}>
                                <ERPListJobStatusPill status={row.status} />
                              </td>
                            )}
                            <td style={erpListStickyActionTdStyle(theme)}>
                              {(() => {
                                const statusUpper = (row.status ?? "").toUpperCase();
                                const isCancel = statusUpper === "CANCEL";
                                const canCancel = statusUpper !== "GENERATED" && !isCancel;
                                return (
                                  <ERPListJobActionMenu
                                    status={row.status}
                                    variant="job-page"
                                    canCancel={canCancel}
                                    onEdit={() => {
                                      persistListAndNavigate(`/SeaExport/import-job/edit`, {
                                        job: row,
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
          <Text size="sm" c="dimmed" mb="md" style={{ fontFamily: theme.fontSans }}>
            Are you sure you want to cancel this job? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              onClick={() => setCancelConfirmRow(null)}
              disabled={isCancelling}
            >
              No
            </Button>
            <Button color="red" onClick={handleConfirmCancel} loading={isCancelling}>
              Yes, cancel
            </Button>
          </Group>
        </Modal>
      </Box>
    </MantineProvider>
  );
}

export default ImportJobMaster;
