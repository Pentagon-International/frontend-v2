import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Group,
  Button,
  Text,
  Stack,
  Grid,
  Menu,
  ActionIcon,
  Box,
  TextInput,
  Loader,
  MantineProvider,
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
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
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
import { URL } from "../../../api/serverUrls";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";

const LIST_KEY = "AIR_JOB_GENERATION_MASTER";

type AirJobData = {
  id: number;
  service: string;
  origin_code_read: string;
  origin_name: string;
  destination_code_read: string;
  destination_name: string;
  schedule: string;
  flight_no: string;
  carrier_code_read: string;
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
  shipment_details: Array<unknown>;
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

/** Same endpoint resolution as Air Export Booking route column (code read → code → name). */
function routeEndpointsFromJobRow(row: AirJobData) {
  const oc =
    String(row.origin_code_read || "").trim() ||
    String((row as AirJobData & { origin_code?: string }).origin_code || "").trim() ||
    String(row.origin_name || "").trim() ||
    "";
  const dc =
    String(row.destination_code_read || "").trim() ||
    String((row as AirJobData & { destination_code?: string }).destination_code || "").trim() ||
    String(row.destination_name || "").trim() ||
    "";
  return { oc, dc };
}

function getStatusBadge(statusRaw: string | undefined | null) {
  const statusUpper = (statusRaw || "").toUpperCase();
  const label =
    statusUpper === "CANCEL"
      ? "Cancel"
      : statusUpper === "CLOSED"
        ? "Closed"
        : "Active";
  const color = label === "Cancel" ? "red" : label === "Closed" ? "blue" : "green";
  return { label, color } as const;
}

function AirJobGenerationMaster() {
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
    service: "AIR",
  });
  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [showFilters, setShowFilters] = useState(false);
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
      service: "AIR",
      schedule: null,
      flight_no: null,
      carrier_name: null,
      cut_off_date: null,
      eta: null,
      etd: null,
    },
  });

  const buildFilterPayload = useCallback((): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    if (filterForm.values.service) payload.service = filterForm.values.service;
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
    return payload;
  }, [filterForm.values]);

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
        service: (f.service as string) || "AIR",
        schedule: (f.schedule as string) || null,
        flight_no: (f.flight_no as string) || null,
        carrier_name: (f.carrier_name as string) || null,
        cut_off_date: f.cut_off_date ? new Date(f.cut_off_date as string) : null,
        eta: f.eta ? new Date(f.eta as string) : null,
        etd: f.etd ? new Date(f.etd as string) : null,
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
      "air-job-bookings",
      pageIndex,
      pageSize,
      JSON.stringify(appliedFilterPayload),
      debouncedSearch,
    ],
    queryFn: async (): Promise<AirJobData[]> => {
      try {
        const filtersWithSearch = buildRequestFilters();
        const payload =
          Object.keys(filtersWithSearch).length > 0
            ? { filters: filtersWithSearch }
            : { filters: { service: "AIR" } };

        setIsInitialLoad(false);

        const response = await apiCallProtected.post(
          `${URL.bookingFilter}?index=${index}&limit=${pageSize}`,
          payload,
        );
        const data = response as {
          total?: number;
          data?: AirJobData[] | { data?: AirJobData[]; total?: number };
        };

        const nestedData =
          data?.data && !Array.isArray(data.data)
            ? (data.data as { data?: AirJobData[]; total?: number })
            : undefined;
        const list: AirJobData[] = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(nestedData?.data)
            ? nestedData.data
            : [];

        const total = data?.total ?? nestedData?.total ?? list.length;
        setTotalRecords(Number(total));
        return list;
      } catch (error) {
        console.error("Error fetching air job list:", error);
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

  const displayData = useMemo(() => {
    return (bookingData || []).map((row, i) => ({
      ...row,
      sno: index + i + 1,
    }));
  }, [bookingData, index]);

  const stats = useMemo(() => {
    const rows = bookingData || [];
    return {
      total: totalRecords,
      active: rows.filter((r) => getStatusBadge(r.status).label === "Active").length,
      closed: rows.filter((r) => getStatusBadge(r.status).label === "Closed").length,
      cancel: rows.filter((r) => getStatusBadge(r.status).label === "Cancel").length,
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
    filterForm.setFieldValue("service", "AIR");
    const defaultPayload = { service: "AIR" };
    setAppliedFilterPayload(defaultPayload);
    setPageIndex(0);
    clearAllStore(LIST_KEY);
    setShowFilters(false);
  };

  const handleEdit = useCallback(
    (job: AirJobData) => {
      setStoreFilters(LIST_KEY, {
        ...appliedFilterPayload,
        origin_name: filterForm.values.origin_name || "",
        destination_name: filterForm.values.destination_name || "",
      });
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate("/air/job-generation/edit", {
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
    (job: AirJobData) => {
      setStoreFilters(LIST_KEY, {
        ...appliedFilterPayload,
        origin_name: filterForm.values.origin_name || "",
        destination_name: filterForm.values.destination_name || "",
      });
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate("/air/job-generation/view", {
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
                    {displayData.length}
                  </Text>
                  <Text size="xs" c={muted} component="span">
                    on page
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
                    navigate("/air/job-generation/create", {
                      state: { serviceType: "AIR" },
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
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                  <FormTextInput
                    size="xs"
                    label="Flight No"
                    placeholder="Enter flight number"
                    styles={filterFieldStyles}
                    {...filterForm.getInputProps("flight_no")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                  <FormTextInput
                    size="xs"
                    label="Carrier"
                    placeholder="Enter carrier name"
                    styles={filterFieldStyles}
                    {...filterForm.getInputProps("carrier_name")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
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
            children: bookingError ? (
              <Box px="md" py={48} style={{ textAlign: "center" }}>
                <Text c="red" size="sm" style={{ fontFamily: theme.fontSans }}>
                  Error loading air job data. Please try refreshing the page.
                </Text>
              </Box>
            ) : isLoading ? (
              <ERPListTableLoading theme={theme} message="Loading air job schedules…" />
            ) : (
              <Box style={{ position: "relative", flex: 1, minHeight: 0 }}>
                {bookingFetching && displayData.length > 0 ? (
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
                      {visibleColumns.sno && <th style={erpListThStyle(theme)}>S.No</th>}
                      {visibleColumns.flight_no && (
                        <th style={erpListThStyle(theme)}>Flight No</th>
                      )}
                      {visibleColumns.carrier_name && (
                        <th style={erpListThStyle(theme)}>Carrier</th>
                      )}
                      {visibleColumns.route && (
                        <th style={erpListThStyle(theme)}>Route</th>
                      )}
                      {visibleColumns.eta && <th style={erpListThStyle(theme)}>ETA</th>}
                      {visibleColumns.etd && <th style={erpListThStyle(theme)}>ETD</th>}
                      {visibleColumns.cut_off_date && (
                        <th style={erpListThStyle(theme)}>Cutoff Date</th>
                      )}
                      {visibleColumns.schedule && (
                        <th style={erpListThStyle(theme)}>Schedule</th>
                      )}
                      <th style={erpListThStyle(theme)}>Status</th>
                      <th style={erpListBookingMasterTrailingHeaderTh(theme)} />
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.length === 0 ? (
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
                            <td style={erpListRowActionMenuTdStyle()}>
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

export default AirJobGenerationMaster;
