import { useMemo, useState, useEffect } from "react";
import type { MRT_PaginationState } from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Stack,
  Box,
  Menu,
  ActionIcon,
  Loader,
  Modal,
  Grid,
  TextInput,
  MantineProvider,
  Select,
  Tooltip,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
  IconSearch,
  IconFilter,
  IconPlaneArrival,
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
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
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
  erpListBookingMasterTrailingHeaderTh,
  ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
  erpListBookingMasterBodyTd,
  erpListBookingMasterDateTd,
  erpListBookingMasterReferenceTdShell,
  erpListRowActionMenuTdStyle,
  ERPListJobStatusPill,
  ERP_LIST_GEIST_MONO_CLASS,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";

dayjs.extend(utc);

const LIST_KEY = "AIR_IMPORT_JOB_MASTER";

type VisibleColumnsState = {
  sno: boolean;
  job_id: boolean;
  mawb: boolean;
  agent: boolean;
  route: boolean;
  etd: boolean;
  eta: boolean;
  status: boolean;
};

type AirImportJobData = {
  id: number;
  sno?: number;
  service: string;
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
type AirImportJobListSummary = {
  status_counts?: {
    active?: number;
    closed?: number;
    cancel?: number;
  };
};

type AirImportJobListQueryResult = {
  data: AirImportJobData[];
  total: number;
  summary?: AirImportJobListSummary;
};

/** Air Export Booking route column: origin_code_read → origin_code → origin_name (same for destination). */
function routeEndpointsFromAirImportJobRow(row: AirImportJobData) {
  const ext = row as AirImportJobData & {
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
  etd: string;
  eta: string;
  status: string;
};

function AirImportJobMaster() {
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
    etd: "",
    eta: "",
    status: "",
  };
  const [draftFilters, setDraftFilters] = useState<AirImportJobFilters>(DEFAULT_FILTERS);
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
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [cancelConfirmRow, setCancelConfirmRow] = useState<AirImportJobData | null>(
    null
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>({
    sno: true,
    job_id: true,
    mawb: true,
    agent: true,
    route: true,
    etd: true,
    eta: true,
    status: true,
  });

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
    filters: AirImportJobFilters,
    searchValue: string,
  ): Record<string, string> => {
    const cleaned: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (key === "agent_code" || key === "origin_name" || key === "destination_name") {
        return;
      }
      if (!value) return;
      if (value.trim() !== "") {
        cleaned[key] = key === "status" ? value.toUpperCase() : value;
      }
    });

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  const {
    data: importJobResponse,
    isLoading: importJobLoading,
    isFetching: importJobFetching,
    refetch: refetchImportJobs,
  } = useQuery<AirImportJobListQueryResult>({
    queryKey: [
      "airImportJobs",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<AirImportJobListQueryResult> => {
      const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);

      const payload =
        Object.keys(filtersPayload).length > 0
          ? {
              filters: {
                service: "AIR",
                service_type: "Import",
                ...filtersPayload,
              },
            }
          : {
              filters: {
                service: "AIR",
                service_type: "Import",
              },
            };

      setIsInitialLoad(false);
      const offset = pagination.pageIndex * pagination.pageSize;
      const response = (await apiCallProtected.post(
        `${URL.filterJobCreate}?index=${offset}&limit=${pagination.pageSize}`,
        payload,
        API_HEADER
      )) as Record<string, unknown>;

      const list = Array.isArray(response?.data) ? (response.data as AirImportJobData[]) : [];
      const total = getBookingShipmentFilterListTotal(response, list, offset);
      setTotalRecords(total);

      const rawSummary = response?.summary;
      const summary: AirImportJobListSummary | undefined =
        rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
          ? (rawSummary as AirImportJobListSummary)
          : undefined;

      return { data: list, total, summary };
    },
    enabled: !isRestoring && search === debouncedSearch,
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
      active: rows.filter((r) => getStatusBadge(r.status).label === "Active").length,
      closed: rows.filter((r) => getStatusBadge(r.status).label === "Closed").length,
      cancel: rows.filter((r) => getStatusBadge(r.status).label === "Cancel").length,
    };
  }, [importJobData, totalRecords, listSummary]);

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof VisibleColumnsState)[]).map((key) => ({
        id: String(key),
        label: String(key).replace(/_/g, " "),
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
                  icon={<IconPlaneArrival size={14} color={primary} />}
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
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/air/import-job/create");
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
            subtitle: "Refine air import jobs by reference, agent, route, or dates",
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
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                  <FormTextInput
                    label="MAWB No"
                    placeholder="Type MAWB No"
                    size="xs"
                    styles={filterFieldStyles}
                    value={draftFilters.mawb_no}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, mawb_no: e.currentTarget.value }))
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                            originalData?.customer_name ?? originalData?.name ?? value ?? ""
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                  <SingleDateInput
                    label="ETD"
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                  <SingleDateInput
                    label="ETA"
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
            children: isLoading ? (
              <ERPListTableLoading theme={theme} message="Loading air import jobs…" />
            ) : (
              <Box style={{ position: "relative", flex: 1, minHeight: 0 }}>
                {importJobFetching && importJobData.length > 0 ? (
                  <Box
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10,
                      borderRadius: 8,
                    }}
                  >
                    <Stack align="center" gap="md">
                      <Loader size="lg" color={primary} />
                      <Text c="dimmed" size="sm" style={{ fontFamily: theme.fontSans }}>
                        Refreshing…
                      </Text>
                    </Stack>
                  </Box>
                ) : null}
                <table style={erpListBookingMasterTableStyle(theme)}>
                  <thead>
                    <tr>
                      {visibleColumns.sno && (
                        <th style={erpListThStyle(theme)}>S.No</th>
                      )}
                      {visibleColumns.job_id && (
                        <th style={erpListThStyle(theme)}>Job ID</th>
                      )}
                      {visibleColumns.mawb && (
                        <th style={erpListThStyle(theme)}>MAWB No</th>
                      )}
                      {visibleColumns.agent && (
                        <th style={erpListThStyle(theme)}>Destination Agent</th>
                      )}
                      {visibleColumns.route && (
                        <th style={erpListThStyle(theme)}>Route</th>
                      )}
                      {visibleColumns.etd && (
                        <th style={erpListThStyle(theme)}>ETD</th>
                      )}
                      {visibleColumns.eta && (
                        <th style={erpListThStyle(theme)}>ETA</th>
                      )}
                      {visibleColumns.status && (
                        <th style={erpListThStyle(theme)}>Status</th>
                      )}
                      <th style={erpListBookingMasterTrailingHeaderTh(theme)} />
                    </tr>
                  </thead>
                  <tbody>
                    {importJobData.length === 0 ? (
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
                              <IconPlaneArrival size={24} color={muted} />
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
                        const fmtUtcLocal = (v: string | null | undefined) => {
                          if (!v) return "—";
                          try {
                            const d = dayjs.utc(v).local();
                            return d.isValid() ? d.format("DD MMM") : v;
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
                            {visibleColumns.job_id && (
                              <td style={tdPad}>
                                <Text fw={600} size="sm" c={fg}>
                                  {row.job_id || "—"}
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
                            {visibleColumns.route && (() => {
                              const { oc, dc } = routeEndpointsFromAirImportJobRow(row);
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
                            <td style={erpListRowActionMenuTdStyle()}>
                              {(() => {
                                const statusUpper = (row.status ?? "").toUpperCase();
                                const isCancel = statusUpper === "CANCEL";
                                const canCancel = statusUpper !== "GENERATED" && !isCancel;
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
                                        <IconDotsVertical size={16} />
                                      </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                      <Menu.Item
                                        leftSection={<IconEdit size={14} />}
                                        disabled={isCancel}
                                        onClick={() => {
                                          if (!isCancel) {
                                            setStoreFilters(LIST_KEY, appliedFilters);
                                            setStoreSearch(LIST_KEY, search);
                                            setShouldRestore(LIST_KEY, true);
                                            navigate(`/air/import-job/edit`, {
                                              state: { job: row },
                                            });
                                          }
                                        }}
                                      >
                                        Edit
                                      </Menu.Item>
                                      <Menu.Item
                                        leftSection={<IconX size={14} />}
                                        color="red"
                                        disabled={!canCancel}
                                        onClick={() => {
                                          if (canCancel) setCancelConfirmRow(row);
                                        }}
                                      >
                                        Cancel
                                      </Menu.Item>
                                    </Menu.Dropdown>
                                  </Menu>
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

export default AirImportJobMaster;
