import { useMemo, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Group,
  Button,
  Text,
  Stack,
  Grid,
  Menu,
  ActionIcon,
  Box,
  Center,
  TextInput,
  Loader,
  MantineProvider,
  Select,
} from "@mantine/core";
import {
  IconFilter,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconSearch,
  IconX,
  IconBriefcase,
  IconCircleCheck,
  IconClock,
  IconStack2,
  IconPlane,
  IconArrowRight,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "@mantine/form";
import {
  SearchableSelect,
  Dropdown,
  SingleDateInput,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistRootTypography,
  erpListGeistMenuDropdownStyles,
  erpListGeistSelectClassNames,
  erpListThStyle,
  erpListDataRowProps,
  erpListBookingMasterTableStyle,
  ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
  erpListBookingMasterBodyTd,
  erpListBookingMasterDateTd,
  erpListBookingMasterReferenceTdShell,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  ERPListJobStatusPill,
  ERP_LIST_GEIST_MONO_CLASS,
} from "../../../components";
import { URL } from "../../../api/serverUrls";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";
import useDateFormat from "../../../hooks/useDateFormat";

const LIST_KEY = "INLAND_EXPORT_JOB_GENERATION_MASTER";

/** Same as backend `STATUS_CHOICES` — sent as `filters.status` (`status__iexact`). */
const AIR_JOB_STATUS_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "GENERATED", label: "Generated" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

function airJobStatusFilterLabel(value: string | null | undefined) {
  if (!value) return "";
  const found = AIR_JOB_STATUS_FILTER_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}

type InlandJobData = {
  id: number;
  sno?: number;
  service: string;
  service_type?: string;
  origin_code_read?: string;
  origin_name: string;
  destination_code_read?: string;
  destination_name: string;
  schedule: string;
  flight_no: string | null;
  vessel?: string | null;
  voyage?: string | null;
  carrier_code_read?: string;
  carrier_name: string;
  cut_off_date: string;
  eta: string;
  etd: string;
  status: string;
  routing_details?: Array<{
    id: number;
    from_code?: string;
    from_name?: string;
    to_code?: string;
    to_name?: string;
    eta?: string;
    etd?: string;
    carrier_code?: string;
    carrier_name?: string;
    flight_no?: string;
  }>;
  shipment_details?: Array<unknown>;
  booking_details?: Array<unknown>;
};

type FilterState = {
  origin: string | null;
  origin_name: string | null;
  destination: string | null;
  destination_name: string | null;
  service: string | null;
  schedule: string | null;
  flight_no: string | null;
  carrier_name: string | null;
  cut_off_date: Date | null;
  eta: Date | null;
  etd: Date | null;
  /** API `filters.status` (case-insensitive match on backend). */
  status: string | null;
};

type VisibleColumnsState = {
  sno: boolean;
  flight_no: boolean;
  carrier_name: boolean;
  route: boolean;
  eta: boolean;
  etd: boolean;
  cut_off_date: boolean;
  schedule: boolean;
};

/** Same endpoint resolution as Inland Export Booking route column (code read → code → name). */
function routeEndpointsFromJobRow(row: InlandJobData) {
  const oc =
    String(row.origin_code_read || "").trim() ||
    String((row as InlandJobData & { origin_code?: string }).origin_code || "").trim() ||
    String(row.origin_name || "").trim() ||
    "";
  const dc =
    String(row.destination_code_read || "").trim() ||
    String((row as InlandJobData & { destination_code?: string }).destination_code || "").trim() ||
    String(row.destination_name || "").trim() ||
    "";
  return { oc, dc };
}

function InlandExportJobGenerationMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = DEFAULT_ERP_LIST_THEME;
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(theme);
  const { muted, fg, primary } = theme;

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [appliedFilterPayload, setAppliedFilterPayload] = useState<Record<string, unknown>>({
    service: "INLAND",
    service_type: "EXPORT",
  });
  const dateFormat = useDateFormat();
  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [showFilters, setShowFilters] = useState(false);

  /**
   * Column-header filtering: which header is currently in "edit" mode. Lifted
   * here so opening one header collapses any other open editor and the state
   * survives table re-renders.
   */
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId(id),
    [],
  );
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>({
    sno: true,
    flight_no: true,
    carrier_name: true,
    route: true,
    eta: true,
    etd: true,
    cut_off_date: true,
    schedule: true,
  });

  const filterForm = useForm<FilterState>({
    initialValues: {
      origin: null,
      origin_name: null,
      destination: null,
      destination_name: null,
      service: "INLAND",
      schedule: null,
      flight_no: null,
      carrier_name: null,
      cut_off_date: null,
      eta: null,
      etd: null,
      status: null,
    },
  });

  const buildFilterPayload = useCallback((): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      service: filterForm.values.service || "INLAND",
      service_type: "EXPORT",
    };
    if (filterForm.values.origin) payload.origin_code = filterForm.values.origin;
    if (filterForm.values.destination)
      payload.destination_code = filterForm.values.destination;
    if (filterForm.values.schedule) payload.schedule = filterForm.values.schedule;
    if (filterForm.values.flight_no) payload.flight_no = filterForm.values.flight_no;
    if (filterForm.values.carrier_name) payload.carrier_name = filterForm.values.carrier_name;
    if (filterForm.values.cut_off_date)
      payload.cut_off_date = dayjs(filterForm.values.cut_off_date).format("YYYY-MM-DD");
    if (filterForm.values.eta)
      payload.eta = dayjs(filterForm.values.eta).format("YYYY-MM-DD");
    if (filterForm.values.etd)
      payload.etd = dayjs(filterForm.values.etd).format("YYYY-MM-DD");
    if (filterForm.values.status) payload.status = filterForm.values.status;
    return payload;
  }, [filterForm.values]);

  /**
   * Build the API payload directly from a snapshot of form values. Used by
   * `commitHeaderFilters` so that header-typed updates flow into the request
   * without waiting for the form's state-update cycle.
   */
  const buildPayloadFrom = useCallback(
    (values: FilterState): Record<string, unknown> => {
      const payload: Record<string, unknown> = {
        service: values.service || "INLAND",
        service_type: "EXPORT",
      };
      if (values.origin) payload.origin_code = values.origin;
      if (values.destination) payload.destination_code = values.destination;
      if (values.schedule) payload.schedule = values.schedule;
      if (values.flight_no) payload.flight_no = values.flight_no;
      if (values.carrier_name) payload.carrier_name = values.carrier_name;
      if (values.cut_off_date)
        payload.cut_off_date = dayjs(values.cut_off_date).format("YYYY-MM-DD");
      if (values.eta) payload.eta = dayjs(values.eta).format("YYYY-MM-DD");
      if (values.etd) payload.etd = dayjs(values.etd).format("YYYY-MM-DD");
      if (values.status) payload.status = values.status;
      return payload;
    },
    [],
  );

  /**
   * Column-header writes update BOTH form values and `appliedFilterPayload`
   * at once (instant filtering, mirroring ReceiptMaster's column-header UX),
   * reset pagination to page 1, and persist to the global list-filter store
   * so the value is preserved across navigation.
   */
  const commitHeaderFilters = useCallback(
    (updates: Partial<FilterState>) => {
      const nextValues: FilterState = { ...filterForm.values, ...updates };
      filterForm.setValues(updates);
      const payload = buildPayloadFrom(nextValues);
      setAppliedFilterPayload(payload);
      setPageIndex(0);
      setStoreFilters(LIST_KEY, {
        ...payload,
        origin_name: nextValues.origin_name || "",
        destination_name: nextValues.destination_name || "",
      });
    },
    [filterForm, buildPayloadFrom, setStoreFilters],
  );

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
      const { origin_name: _on, destination_name: _dn, ...apiPayload } = f;
      filterForm.setValues({
        origin: (f.origin_code as string) || null,
        origin_name: (f.origin_name as string) || null,
        destination: (f.destination_code as string) || null,
        destination_name: (f.destination_name as string) || null,
        service: (f.service as string) || "INLAND",
        schedule: (f.schedule as string) || null,
        flight_no: (f.flight_no as string) || null,
        carrier_name: (f.carrier_name as string) || null,
        cut_off_date: f.cut_off_date ? new Date(f.cut_off_date as string) : null,
        eta: f.eta ? new Date(f.eta as string) : null,
        etd: f.etd ? new Date(f.etd as string) : null,
        status: (f.status as string) || null,
      });
      setAppliedFilterPayload(apiPayload);
    }

    setPageIndex(0);
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const index = pageIndex * pageSize;

  const buildRequestFilters = useCallback(() => {
    const base: Record<string, unknown> = { ...appliedFilterPayload };
    if (debouncedSearch?.trim()) base.search = debouncedSearch.trim();
    return base;
  }, [appliedFilterPayload, debouncedSearch]);

  const {
    data: bookingData,
    isLoading: bookingLoading,
    isFetching: bookingFetching,
    error: bookingError,
  } = useQuery({
    queryKey: [
      "inland-export-job-bookings",
      pageIndex,
      pageSize,
      JSON.stringify(appliedFilterPayload),
      debouncedSearch,
    ],
    queryFn: async (): Promise<InlandJobData[]> => {
      try {
        const filtersWithSearch = buildRequestFilters();
        const payload =
          Object.keys(filtersWithSearch).length > 0
            ? { filters: filtersWithSearch }
            : { filters: { service: "INLAND", service_type: "EXPORT" } };

        setIsInitialLoad(false);

        const response = await apiCallProtected.post(
          `${URL.bookingFilter}?index=${index}&limit=${pageSize}`,
          payload,
        );
        const data = response as {
          total?: number;
          data?: InlandJobData[] | { data?: InlandJobData[]; total?: number };
        };

        const nestedData =
          data?.data && !Array.isArray(data.data)
            ? (data.data as { data?: InlandJobData[]; total?: number })
            : undefined;
        const list: InlandJobData[] = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(nestedData?.data)
            ? nestedData.data
            : [];

        const total = data?.total ?? nestedData?.total ?? list.length;
        setTotalRecords(Number(total));
        return list;
      } catch (error) {
        console.error("Error fetching inland export job list:", error);
        setTotalRecords(0);
        return [];
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = bookingLoading || bookingFetching || isInitialLoad;

  const mergeTh = (minW: number, widthPx: number) => ({
    ...erpListThStyle(theme),
    minHeight: 52.4,
    height: 52.4,
    verticalAlign: "middle" as const,
    boxSizing: "border-box" as const,
    minWidth: minW,
    width: widthPx,
  });

  const displayData = useMemo(() => {
    return (bookingData || []).map((row, i) => ({
      ...row,
      sno: index + i + 1,
    }));
  }, [bookingData, index]);

  const stats = useMemo(() => {
    const rows = bookingData || [];
    const st = (s: string | undefined) => (s || "").toUpperCase();
    return {
      total: totalRecords,
      pending: rows.filter((r) => st(r.status) === "PENDING").length,
      generated: rows.filter((r) => st(r.status) === "GENERATED").length,
      inactive: rows.filter((r) => st(r.status) === "INACTIVE").length,
    };
  }, [bookingData, totalRecords]);

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

  const applyFilters = () => {
    const payload = buildFilterPayload();
    setAppliedFilterPayload(payload);
    setPageIndex(0);
    setStoreFilters(LIST_KEY, {
      ...payload,
      origin_name: filterForm.values.origin_name || "",
      destination_name: filterForm.values.destination_name || "",
    });
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    filterForm.reset();
    filterForm.setFieldValue("service", "INLAND");
    const defaultPayload = { service: "INLAND", service_type: "EXPORT" };
    setAppliedFilterPayload(defaultPayload);
    setPageIndex(0);
    clearAllStore(LIST_KEY);
    setShowFilters(false);
  };

  const handleEdit = useCallback(
    (job: InlandJobData) => {
      setStoreFilters(LIST_KEY, {
        ...appliedFilterPayload,
        origin_name: filterForm.values.origin_name || "",
        destination_name: filterForm.values.destination_name || "",
      });
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate("/inland/export-job-generation/edit", {
        state: { job, mode: "edit" },
      });
    },
    [
      appliedFilterPayload,
      filterForm.values.origin_name,
      filterForm.values.destination_name,
      navigate,
      search,
      setShouldRestore,
      setStoreFilters,
      setStoreSearch,
    ],
  );

  const handleView = useCallback(
    (job: InlandJobData) => {
      setStoreFilters(LIST_KEY, {
        ...appliedFilterPayload,
        origin_name: filterForm.values.origin_name || "",
        destination_name: filterForm.values.destination_name || "",
      });
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate("/inland/export-job-generation/view", {
        state: { job, mode: "view" },
      });
    },
    [
      appliedFilterPayload,
      filterForm.values.origin_name,
      filterForm.values.destination_name,
      navigate,
      search,
      setShouldRestore,
      setStoreFilters,
      setStoreSearch,
    ],
  );

  const airTransportParams = useMemo(() => ({ transport_mode: "AIR" }), []);

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
                  icon={<IconPlane size={14} color={primary} />}
                  value={stats.total}
                  label="Total"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconClock size={14} color="#d97706" />}
                  iconBackground="#fef3c7"
                  iconColor="#d97706"
                  value={stats.pending}
                  label="Pending"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconCircleCheck size={14} color="#059669" />}
                  iconBackground="#d1fae5"
                  iconColor="#059669"
                  value={stats.generated}
                  label="Generated"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconStack2 size={14} color="#6b7280" />}
                  iconBackground="#f3f4f6"
                  iconColor="#6b7280"
                  value={stats.inactive}
                  label="Inactive"
                />
              </>
            ),
            secondary: (
              <>
                <Group gap={8} wrap="nowrap" align="center">
                  <IconStack2 size={16} color={muted} style={{ flexShrink: 0 }} />
                  <Text fw={600} size="sm" c={fg} component="span">
                    {displayData.length}
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
                    setStoreFilters(LIST_KEY, {
                      ...appliedFilterPayload,
                      origin_name: filterForm.values.origin_name || "",
                      destination_name: filterForm.values.destination_name || "",
                    });
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/inland/export-job-generation/create", {
                      state: { serviceType: "INLAND" },
                    });
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
            subtitle: "Refine schedules by flight, carrier, route, or dates",
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
                      size="xs"
                      label="Flight No"
                      placeholder="Enter flight number"
                      styles={filterFieldStyles}
                      {...filterForm.getInputProps("flight_no")}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      size="xs"
                      label="Carrier"
                      placeholder="Enter carrier name"
                      styles={filterFieldStyles}
                      {...filterForm.getInputProps("carrier_name")}
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
                      additionalParams={airTransportParams}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.origin}
                      displayValue={filterForm.values.origin_name}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("origin", value || null);
                        filterForm.setFieldValue("origin_name", selectedData?.label || null);
                      }}
                      minSearchLength={3}
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
                      additionalParams={airTransportParams}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.destination}
                      displayValue={filterForm.values.destination_name}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("destination", value || null);
                        filterForm.setFieldValue(
                          "destination_name",
                          selectedData?.label || null,
                        );
                      }}
                      minSearchLength={3}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="Schedule"
                      placeholder="Select schedule"
                      searchable
                      clearable
                      data={[
                        { value: "Weekly", label: "Weekly" },
                        { value: "Monthly", label: "Monthly" },
                        { value: "Daily", label: "Daily" },
                        { value: "Quarterly", label: "Quarterly" },
                      ]}
                      {...filterForm.getInputProps("schedule")}
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
                      key={`eta-${filterForm.values.eta}`}
                      label="ETA"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.eta}
                      onChange={(d) => filterForm.setFieldValue("eta", d)}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      key={`etd-${filterForm.values.etd}`}
                      label="ETD"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.etd}
                      onChange={(d) => filterForm.setFieldValue("etd", d)}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      key={`cut-off-${filterForm.values.cut_off_date}`}
                      label="Cut Off Date"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.cut_off_date}
                      onChange={(d) => filterForm.setFieldValue("cut_off_date", d)}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      size="xs"
                      label="Status"
                      placeholder="Select status"
                      searchable
                      clearable
                      data={[...AIR_JOB_STATUS_FILTER_OPTIONS]}
                      {...filterForm.getInputProps("status")}
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
                onPageIndexChange={setPageIndex}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPageIndex(0);
                }}
                selectClassNames={erpListGeistSelectClassNames}
                pageSizeOptions={["10", "15", "25", "50"]}
              />
            ),
            children: (
              <Box style={{ position: "relative", flex: 1, minHeight: 0 }}>
                <table style={erpListBookingMasterTableStyle(theme)}>
                  <thead>
                    <tr>
                      {visibleColumns.sno && (
                        <th style={mergeTh(70, 70)}>S.No</th>
                      )}
                      {visibleColumns.flight_no && (
                        <th style={mergeTh(140, 140)}>
                          <ERPListColumnHeaderFilter
                            label="Flight No"
                            value={filterForm.values.flight_no ?? ""}
                            displayValue={filterForm.values.flight_no ?? ""}
                            theme={theme}
                            placeholder="Filter Flight No"
                            isEditing={editingHeaderId === "flight_no"}
                            onStartEdit={() => openHeaderEditor("flight_no")}
                            onStopEdit={() => collapseHeaderEditor("flight_no")}
                            onChange={(next) =>
                              commitHeaderFilters({ flight_no: next || null })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.carrier_name && (
                        <th style={mergeTh(160, 160)}>
                          <ERPListColumnHeaderFilter
                            label="Carrier"
                            value={filterForm.values.carrier_name ?? ""}
                            displayValue={filterForm.values.carrier_name ?? ""}
                            theme={theme}
                            placeholder="Filter Carrier"
                            isEditing={editingHeaderId === "carrier_name"}
                            onStartEdit={() => openHeaderEditor("carrier_name")}
                            onStopEdit={() => collapseHeaderEditor("carrier_name")}
                            onChange={(next) =>
                              commitHeaderFilters({ carrier_name: next || null })
                            }
                          />
                        </th>
                      )}
                      {visibleColumns.route && (
                        <th style={mergeTh(220, 220)}>
                          <ERPListColumnHeaderFilter
                            label="Route"
                            value={
                              (filterForm.values.origin ?? "") +
                              (filterForm.values.destination ?? "")
                            }
                            displayValue={
                              filterForm.values.origin || filterForm.values.destination
                                ? `${filterForm.values.origin ?? "—"} → ${
                                    filterForm.values.destination ?? "—"
                                  }`
                                : ""
                            }
                            onChange={() => {}}
                            theme={theme}
                            isEditing={editingHeaderId === "route"}
                            onStartEdit={() => openHeaderEditor("route")}
                            onStopEdit={() => collapseHeaderEditor("route")}
                            renderEditor={({ autoFocus }) => (
                              <Group gap={4} wrap="nowrap" style={{ width: "100%" }}>
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                  <SearchableSelect
                                    autoFocus={autoFocus}
                                    size="xs"
                                    apiEndpoint={URL.portMaster}
                                    additionalParams={airTransportParams}
                                    searchFields={["port_code", "port_name"]}
                                    placeholder="Origin"
                                    displayFormat={(item: Record<string, unknown>) => ({
                                      value: String(item.port_code),
                                      label: `${item.port_name} (${item.port_code})`,
                                    })}
                                    value={filterForm.values.origin}
                                    displayValue={filterForm.values.origin_name}
                                    onChange={(value, selectedData) =>
                                      commitHeaderFilters({
                                        origin: value || null,
                                        origin_name: selectedData?.label || null,
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
                                    additionalParams={airTransportParams}
                                    searchFields={["port_code", "port_name"]}
                                    placeholder="Destination"
                                    displayFormat={(item: Record<string, unknown>) => ({
                                      value: String(item.port_code),
                                      label: `${item.port_name} (${item.port_code})`,
                                    })}
                                    value={filterForm.values.destination}
                                    displayValue={filterForm.values.destination_name}
                                    onChange={(value, selectedData) =>
                                      commitHeaderFilters({
                                        destination: value || null,
                                        destination_name: selectedData?.label || null,
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
                      )}
                      {visibleColumns.eta && (
                        <th style={mergeTh(140, 140)}>
                          <ERPListColumnHeaderFilter
                            label="ETA"
                            value={
                              filterForm.values.eta
                                ? dayjs(filterForm.values.eta).format("YYYY-MM-DD")
                                : ""
                            }
                            displayValue={
                              filterForm.values.eta
                                ? dayjs(filterForm.values.eta).format(dateFormat)
                                : ""
                            }
                            onChange={() => {}}
                            theme={theme}
                            isEditing={editingHeaderId === "eta"}
                            onStartEdit={() => openHeaderEditor("eta")}
                            onStopEdit={() => collapseHeaderEditor("eta")}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                key={`eta-h-${filterForm.values.eta}`}
                                placeholder="YYYY-MM-DD"
                                size="xs"
                                value={filterForm.values.eta}
                                onChange={(d) => {
                                  commitHeaderFilters({ eta: d });
                                  if (d) onClose();
                                }}
                                classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.etd && (
                        <th style={mergeTh(140, 140)}>
                          <ERPListColumnHeaderFilter
                            label="ETD"
                            value={
                              filterForm.values.etd
                                ? dayjs(filterForm.values.etd).format("YYYY-MM-DD")
                                : ""
                            }
                            displayValue={
                              filterForm.values.etd
                                ? dayjs(filterForm.values.etd).format(dateFormat)
                                : ""
                            }
                            onChange={() => {}}
                            theme={theme}
                            isEditing={editingHeaderId === "etd"}
                            onStartEdit={() => openHeaderEditor("etd")}
                            onStopEdit={() => collapseHeaderEditor("etd")}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                key={`etd-h-${filterForm.values.etd}`}
                                placeholder="YYYY-MM-DD"
                                size="xs"
                                value={filterForm.values.etd}
                                onChange={(d) => {
                                  commitHeaderFilters({ etd: d });
                                  if (d) onClose();
                                }}
                                classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.cut_off_date && (
                        <th style={mergeTh(150, 150)}>
                          <ERPListColumnHeaderFilter
                            label="Cutoff Date"
                            value={
                              filterForm.values.cut_off_date
                                ? dayjs(filterForm.values.cut_off_date).format("YYYY-MM-DD")
                                : ""
                            }
                            displayValue={
                              filterForm.values.cut_off_date
                                ? dayjs(filterForm.values.cut_off_date).format(dateFormat)
                                : ""
                            }
                            onChange={() => {}}
                            theme={theme}
                            isEditing={editingHeaderId === "cut_off_date"}
                            onStartEdit={() => openHeaderEditor("cut_off_date")}
                            onStopEdit={() => collapseHeaderEditor("cut_off_date")}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                key={`cod-h-${filterForm.values.cut_off_date}`}
                                placeholder="YYYY-MM-DD"
                                size="xs"
                                value={filterForm.values.cut_off_date}
                                onChange={(d) => {
                                  commitHeaderFilters({ cut_off_date: d });
                                  if (d) onClose();
                                }}
                                classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                styles={filterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        </th>
                      )}
                      {visibleColumns.schedule && (
                        <th style={mergeTh(140, 140)}>
                          <ERPListColumnHeaderFilter
                            label="Schedule"
                            value={filterForm.values.schedule ?? ""}
                            displayValue={filterForm.values.schedule ?? ""}
                            onChange={() => {}}
                            theme={theme}
                            isEditing={editingHeaderId === "schedule"}
                            onStartEdit={() => openHeaderEditor("schedule")}
                            onStopEdit={() => collapseHeaderEditor("schedule")}
                            renderEditor={({ autoFocus, onClose }) => (
                              <Select
                                autoFocus={autoFocus}
                                placeholder="Select schedule"
                                searchable
                                clearable
                                size="xs"
                                data={[
                                  { value: "Weekly", label: "Weekly" },
                                  { value: "Monthly", label: "Monthly" },
                                  { value: "Daily", label: "Daily" },
                                  { value: "Quarterly", label: "Quarterly" },
                                ]}
                                value={filterForm.values.schedule}
                                onChange={(value) => {
                                  commitHeaderFilters({ schedule: value ?? null });
                                  if (value) onClose();
                                }}
                                comboboxProps={{ zIndex: 1000 }}
                                classNames={erpListGeistSelectClassNames}
                                styles={filterFieldStyles}
                              />
                            )}
                          />
                        </th>
                      )}
                      <th style={mergeTh(150, 150)}>
                        <ERPListColumnHeaderFilter
                          label="Status"
                          value={filterForm.values.status ?? ""}
                          displayValue={airJobStatusFilterLabel(filterForm.values.status)}
                          onChange={() => {}}
                          theme={theme}
                          isEditing={editingHeaderId === "status"}
                          onStartEdit={() => openHeaderEditor("status")}
                          onStopEdit={() => collapseHeaderEditor("status")}
                          renderEditor={({ autoFocus, onClose }) => (
                            <Select
                              autoFocus={autoFocus}
                              placeholder="Select status"
                              searchable
                              clearable
                              size="xs"
                              data={[...AIR_JOB_STATUS_FILTER_OPTIONS]}
                              value={filterForm.values.status}
                              onChange={(value) => {
                                commitHeaderFilters({ status: value ?? null });
                                onClose();
                              }}
                              comboboxProps={{ zIndex: 1000 }}
                              classNames={erpListGeistSelectClassNames}
                              styles={filterFieldStyles}
                            />
                          )}
                        />
                      </th>
                      <th
                        style={{
                          ...erpListStickyActionThStyle(theme, 80),
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
                    {bookingError ? (
                      <tr>
                        <td colSpan={20} style={{ padding: 48, textAlign: "center" }}>
                          <Text c="red" size="sm" style={{ fontFamily: theme.fontSans }}>
                            Error loading inland export job data. Please try refreshing the page.
                          </Text>
                        </td>
                      </tr>
                    ) : isLoading ? (
                      <tr>
                        <td colSpan={20} style={{ padding: 80, textAlign: "center" }}>
                          <Center className="erp-header-filter-fade">
                            <Stack align="center" gap="sm">
                              <Loader size="lg" color={primary} />
                              <Text c="dimmed" size="sm" style={{ fontFamily: theme.fontSans }}>
                                Loading inland export job schedules…
                              </Text>
                            </Stack>
                          </Center>
                        </td>
                      </tr>
                    ) : displayData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={20}
                          style={{ padding: 60, textAlign: "center" }}
                        >
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
                              <IconPlane size={24} color={muted} />
                            </Box>
                            <Box>
                              <Text fw={500} c={fg}>
                                No schedules found
                              </Text>
                              <Text size="sm" c={muted} mt={4}>
                                Try adjusting your search or filters
                              </Text>
                            </Box>
                          </Stack>
                        </td>
                      </tr>
                    ) : (
                      displayData.map((row) => {
                        const rowProps = erpListDataRowProps(theme);
                        const tdPad = erpListBookingMasterBodyTd();
                        const tdDate = erpListBookingMasterDateTd(theme);
                        const refShell = erpListBookingMasterReferenceTdShell(theme);
                        const fmt = (d: string) =>
                          dayjs(d).isValid() ? dayjs(d).format("DD MMM") : "—";
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
                                  {row.sno}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.flight_no && (
                              <td
                                className={ERP_LIST_GEIST_MONO_CLASS}
                                style={refShell}
                              >
                                {row.flight_no ? (
                                  <Text size="xs" fw={500} c={fg}>
                                    {row.flight_no}
                                  </Text>
                                ) : (
                                  <Text size="sm" c={muted}>
                                    —
                                  </Text>
                                )}
                              </td>
                            )}
                            {visibleColumns.carrier_name && (
                              <td style={tdPad}>
                                <Text size="sm" c={fg}>
                                  {row.carrier_name || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.route && (() => {
                              const { oc, dc } = routeEndpointsFromJobRow(row);
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
                            {visibleColumns.eta && (
                              <td style={tdDate}>
                                {row.eta ? fmt(row.eta) : "—"}
                              </td>
                            )}
                            {visibleColumns.etd && (
                              <td style={tdDate}>
                                {row.etd ? fmt(row.etd) : "—"}
                              </td>
                            )}
                            {visibleColumns.cut_off_date && (
                              <td style={tdDate}>
                                {row.cut_off_date ? fmt(row.cut_off_date) : "—"}
                              </td>
                            )}
                            {visibleColumns.schedule && (
                              <td style={tdPad}>
                                <Text size="sm" c={fg}>
                                  {row.schedule || "—"}
                                </Text>
                              </td>
                            )}
                            <td style={tdPad}>
                              <ERPListJobStatusPill status={row.status} />
                            </td>
                            <td style={erpListStickyActionTdStyle(theme)}>
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
                                    leftSection={<IconEye size={14} />}
                                    onClick={() => handleView(row)}
                                  >
                                    View
                                  </Menu.Item>
                                  <Menu.Item
                                    leftSection={<IconEdit size={14} />}
                                    onClick={() => handleEdit(row)}
                                  >
                                    Edit
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
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
      </Box>
    </MantineProvider>
  );
}

export default InlandExportJobGenerationMaster;
