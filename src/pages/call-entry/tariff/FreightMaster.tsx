import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
  Grid,
  Select,
  TextInput,
  MantineProvider,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconFilter,
  IconListDetails,
  IconListNumbers,
  IconSearch,
  IconTruck,
  IconX,
  IconEye,
} from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  ToastNotification,
  SearchableSelect,
  SingleDateInput,
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistMantineTheme,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { URL } from "../../../api/serverUrls";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import useDateFormat from "../../../hooks/useDateFormat";
import {
  TariffMasterListNativeTable,
  type TariffListColumn,
} from "./TariffMasterListNativeTable";
import { getTariffFilterListTotal } from "./tariffFilterListTotal";

type Freight = {
  id: number;
  origin_name: string;
  destination_name: string;
  valid_from: string;
  valid_to: string;
  status?: string;
  tariff_charges?: any[];
  service?: string;
};

type FilterState = {
  origin: string | null;
  destination: string | null;
  service: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
};

export default function Freight() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const dateFormat = useDateFormat();

  // Add local search state
  const [localSearchTerm, setLocalSearchTerm] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter states - similar to CallEntryMaster
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Store display values (labels) for SearchableSelect fields
  const [originDisplayValue, setOriginDisplayValue] = useState<string | null>(
    null
  );
  const [destinationDisplayValue, setDestinationDisplayValue] = useState<
    string | null
  >(null);

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      origin: null,
      destination: null,
      service: null,
      valid_from: null,
      valid_to: null,
    },
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    origin: null,
    destination: null,
    service: null,
    valid_from: null,
    valid_to: null,
  });

  // Service options - simple list like EnquiryMaster
  const serviceOptions = useMemo(
    () => [
      { value: "FCL", label: "FCL" },
      { value: "LCL", label: "LCL" },
      { value: "AIR", label: "AIR" },
    ],
    []
  );

  // Fetch freight data with React Query - initial fetch without filters with pagination
  const {
    data: freightVal = [],
    isLoading: isFreightLoading,
    refetch: refetchFreight,
  } = useQuery({
    queryKey: ["freight", currentPage, pageSize],
    queryFn: async () => {
      try {
        const requestBody: { filters: any } = { filters: {} };

        const response = await apiCallProtected.post(
          `${URL.filter_freight}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        // Handle response - API returns { data: [...], total: ... } or { results: [...], total: ... }
        if (data && Array.isArray(data.data)) {
          const rows = data.data;
          setTotalRecords(getTariffFilterListTotal(data, rows));
          return rows;
        } else if (data && Array.isArray(data.results)) {
          const rows = data.results;
          setTotalRecords(getTariffFilterListTotal(data, rows));
          return rows;
        } else if (data && Array.isArray(data.result)) {
          const rows = data.result;
          setTotalRecords(getTariffFilterListTotal(data, rows));
          return rows;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching freight data:", error);
        setTotalRecords(0);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    enabled: true, // Enable to run automatically on mount
  });

  // Separate query for filtered data - only runs when filters are applied with pagination
  const {
    data: filteredFreightData = [],
    isLoading: filteredFreightLoading,
    refetch: refetchFilteredFreight,
  } = useQuery({
    queryKey: [
      "filteredFreight",
      filtersApplied,
      appliedFilters,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        const payload: any = {};

        if (appliedFilters.origin) payload.origin_code = appliedFilters.origin;
        if (appliedFilters.destination)
          payload.destination_code = appliedFilters.destination;
        if (appliedFilters.service) payload.service = appliedFilters.service;
        if (appliedFilters.valid_from)
          payload.valid_from = dayjs(appliedFilters.valid_from).format(
            "YYYY-MM-DD"
          );
        if (appliedFilters.valid_to)
          payload.valid_to = dayjs(appliedFilters.valid_to).format(
            "YYYY-MM-DD"
          );

        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          `${URL.filter_freight}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Filter API response:", data);

        // Handle response with total count
        if (data && Array.isArray(data.data)) {
          const rows = data.data;
          setTotalRecords(getTariffFilterListTotal(data, rows));
          return rows;
        } else if (data && Array.isArray(data.result)) {
          const rows = data.result;
          setTotalRecords(getTariffFilterListTotal(data, rows));
          return rows;
        } else if (data && Array.isArray(data.results)) {
          const rows = data.results;
          setTotalRecords(getTariffFilterListTotal(data, rows));
          return rows;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching filtered freight data:", error);
        setTotalRecords(0);
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Determine which data to display
  const displayData = useMemo(() => {
    // Check if we have filtered data (filters were applied)
    if (filtersApplied) {
      console.log("Displaying filtered data:", filteredFreightData);
      return Array.isArray(filteredFreightData) ? filteredFreightData : [];
    }
    console.log("Displaying unfiltered data:", freightVal);
    return Array.isArray(freightVal) ? freightVal : [];
  }, [freightVal, filteredFreightData, filtersApplied]);

  // Filter data based on local search term (client-side search on displayed data)
  const filteredFreightDataForDisplay = useMemo<Freight[]>(() => {
    if (!localSearchTerm.trim()) {
      return displayData as Freight[];
    }

    const searchLower = localSearchTerm.toLowerCase();

    return (displayData as Freight[]).filter((item) => {
      // Search in tariff charges for carrier and charge details
      const tariffCharges = item.tariff_charges || [];

      // Check if any tariff charge matches the search criteria
      const chargeMatches = tariffCharges.some((charge: any) => {
        const chargeName = charge.charge_name?.toLowerCase() || "";
        return chargeName.includes(searchLower);
      });

      // Search in other fields
      const originName = item.origin_name?.toLowerCase() || "";
      const destinationName = item.destination_name?.toLowerCase() || "";
      const validFrom = item.valid_from?.toLowerCase() || "";
      const validTo = item.valid_to?.toLowerCase() || "";
      const status = item.status?.toLowerCase() || "";
      const service = (item.service || "").toLowerCase();

      // Check if search term matches any of these fields
      return (
        chargeMatches ||
        originName.includes(searchLower) ||
        destinationName.includes(searchLower) ||
        validFrom.includes(searchLower) ||
        validTo.includes(searchLower) ||
        status.includes(searchLower) ||
        service.includes(searchLower)
      );
    });
  }, [displayData, localSearchTerm]);

  // Loading state
  const isLoading = useMemo(() => {
    if (filtersApplied) {
      return filteredFreightLoading;
    }
    return isFreightLoading;
  }, [isFreightLoading, filteredFreightLoading, filtersApplied]);

  const erpTheme: ErpListTheme = {
    border: DEFAULT_ERP_LIST_THEME.border,
    muted: DEFAULT_ERP_LIST_THEME.muted,
    fg: DEFAULT_ERP_LIST_THEME.fg,
    primary: DEFAULT_ERP_LIST_THEME.primary,
    headerBg: DEFAULT_ERP_LIST_THEME.headerBg,
    pageBg: DEFAULT_ERP_LIST_THEME.pageBg,
    cardBg: DEFAULT_ERP_LIST_THEME.cardBg,
    fontSans: DEFAULT_ERP_LIST_THEME.fontSans,
  };
  const { border, fg, fontSans, primary, muted } = erpTheme;

  const renderFreightActions = useCallback(
    (row: Freight) => (
      <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
            <IconDotsVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Box px={10} py={5}>
            <UnstyledButton
              onClick={() =>
                navigate("/tariff/freight/create", {
                  state: { ...row, actionType: "view" },
                })
              }
            >
              <Group gap="sm">
                <IconEye size={16} style={{ color: primary }} />
                <Text size="sm">View</Text>
              </Group>
            </UnstyledButton>
          </Box>
          {user?.is_staff ? (
            <>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate("/tariff/freight/create", {
                      state: { ...row, actionType: "edit" },
                    })
                  }
                >
                  <Group gap="sm">
                    <IconEdit size={16} style={{ color: primary }} />
                    <Text size="sm">Edit</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </>
          ) : null}
        </Menu.Dropdown>
      </Menu>
    ),
    [navigate, user?.is_staff, primary]
  );

  const freightListColumns = useMemo<TariffListColumn<Freight>[]>(
    () => [
      {
        id: "origin",
        header: "Origin",
        cellMaxWidth: 200,
        cell: (r) => {
          const v = r.origin_name ?? "—";
          return (
            <Tooltip
              label={v}
              withArrow
              styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
            >
              <Text
                component="span"
                fw={600}
                size="sm"
                c={primary}
                lineClamp={1}
                style={{ fontFamily: fontSans, cursor: "default" }}
              >
                {v}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        id: "destination",
        header: "Destination",
        cellMaxWidth: 200,
        cell: (r) => {
          const v = r.destination_name ?? "—";
          return (
            <Tooltip
              label={v}
              withArrow
              styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
            >
              <Text
                component="span"
                fw={500}
                size="sm"
                c={fg}
                lineClamp={1}
                style={{ fontFamily: fontSans, cursor: "default" }}
              >
                {v}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        id: "service",
        header: "Service",
        cell: (r) => (
          <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
            {r.service ?? "—"}
          </Text>
        ),
      },
      {
        id: "valid_from",
        header: "Valid From",
        cellTone: "muted",
        cell: (r) => (
          <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
            {r.valid_from ? dayjs(r.valid_from).format(dateFormat) : "—"}
          </Text>
        ),
      },
      {
        id: "valid_to",
        header: "Valid To",
        cellTone: "muted",
        cell: (r) => (
          <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
            {r.valid_to ? dayjs(r.valid_to).format(dateFormat) : "—"}
          </Text>
        ),
      },
    ],
    [dateFormat, fg, fontSans, muted, primary]
  );

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values (excluding date range which is handled separately)
      const hasFilterValues =
        filterForm.values.origin ||
        filterForm.values.destination ||
        filterForm.values.service ||
        filterForm.values.valid_from ||
        filterForm.values.valid_to;

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setAppliedFilters({
          origin: null,
          destination: null,
          service: null,
          valid_from: null,
          valid_to: null,
        });

        // Reset to first page
        setCurrentPage(1);

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["freight"] });
        await refetchFreight();
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        console.log("No filter values provided, showing unfiltered data");
        return;
      }

      setFiltersApplied(true); // Mark filters as applied

      // Store the current filter form values as applied filters
      setAppliedFilters({
        origin: filterForm.values.origin,
        destination: filterForm.values.destination,
        service: filterForm.values.service,
        valid_from: filterForm.values.valid_from,
        valid_to: filterForm.values.valid_to,
      });

      // Reset to first page when applying filters
      setCurrentPage(1);

      // Enable the filtered query and refetch
      await queryClient.invalidateQueries({
        queryKey: ["filteredFreight"],
      });
      setShowFilters(false);

      await refetchFilteredFreight();

      console.log("Filters applied successfully");
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset(); // Reset form to initial values
    setLocalSearchTerm("");
    setFiltersApplied(false); // Reset filters applied state

    // Reset applied filters state
    setAppliedFilters({
      origin: null,
      destination: null,
      service: null,
      valid_from: null,
      valid_to: null,
    });

    // Clear display values
    setOriginDisplayValue(null);
    setDestinationDisplayValue(null);

    // Reset to first page
    setCurrentPage(1);

    // Invalidate queries and refetch unfiltered data
    await queryClient.invalidateQueries({ queryKey: ["freight"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredFreight"] });
    await queryClient.removeQueries({ queryKey: ["filteredFreight"] }); // Remove filtered data from cache
    await refetchFreight();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalRecords, pageSize, currentPage]);

  // Refetch data when pagination changes
  useEffect(() => {
    if (filtersApplied) {
      refetchFilteredFreight();
    } else {
      refetchFreight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  return (
    <>
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
                    icon={<IconListDetails size={14} color={primary} />}
                    value={totalRecords}
                    label="Total"
                  />

                </>
              ),
              secondary: (
                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  List of Freights
                </Text>
              ),
              actions: (
                <>
                  <TextInput
                    placeholder="Search freights"
                    leftSection={<IconSearch size={16} />}
                    rightSection={
                      localSearchTerm ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          aria-label="Clear search"
                          onClick={() => setLocalSearchTerm("")}
                          style={{ cursor: "pointer" }}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      ) : null
                    }
                    w={260}
                    size="xs"
                    value={localSearchTerm}
                    onChange={(e) => setLocalSearchTerm(e.currentTarget.value)}
                    disabled={isLoading}
                    classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                    styles={{
                      input: {
                        fontFamily: fontSans,
                        fontSize: 12,
                        height: 32,
                        borderColor: border,
                      },
                    }}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    styles={erpToolbarOutlineButtonStyles(erpTheme)}
                    leftSection={<IconFilter size={14} />}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    {showFilters ? "Hide filters" : "Filters"}
                  </Button>
                  {user?.is_staff ? (
                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                      onClick={() => navigate("/tariff/freight/create")}
                    >
                      Create New
                    </Button>
                  ) : null}
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: "Refine by origin, destination, service, or validity dates",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={() => {
                    void clearAllFilters();
                  }}
                  onApply={() => {
                    void applyFilters();
                  }}
                  applyLoading={isLoading}
                  applyDisabled={isLoading}
                />
              ),
              children: (
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      dropdownZIndex={1000}
                      size="xs"
                      label="Origin"
                      placeholder="Type Origin Code"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_name", "port_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.origin}
                      displayValue={originDisplayValue}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("origin", value || null);
                        setOriginDisplayValue(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      className="filter-searchable-select"
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      dropdownZIndex={1000}
                      size="xs"
                      label="Destination"
                      placeholder="Type Destination Code"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_name", "port_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.destination}
                      displayValue={destinationDisplayValue}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("destination", value || null);
                        setDestinationDisplayValue(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      className="filter-searchable-select"
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <Select
                      key={`service-${filterForm.values.service}`}
                      label="Service"
                      placeholder="Select Service"
                      searchable
                      clearable
                      size="xs"
                      data={serviceOptions}
                      value={filterForm.values.service}
                      onChange={(value) =>
                        filterForm.setFieldValue("service", value || null)
                      }
                      onFocus={(event) => {
                        const input = event.target as HTMLInputElement;
                        if (input && input.value) {
                          input.select();
                        }
                      }}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      key={`valid-from-${filterForm.values.valid_from}`}
                      label="Valid From"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.valid_from}
                      onChange={(v) => filterForm.setFieldValue("valid_from", v)}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      key={`valid-to-${filterForm.values.valid_to}`}
                      label="Valid To"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.valid_to}
                      onChange={(v) => filterForm.setFieldValue("valid_to", v)}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
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
                  pageIndex={currentPage - 1}
                  pageSize={pageSize}
                  onPageIndexChange={(idx) => setCurrentPage(idx + 1)}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={["10", "25", "50"]}
                  selectClassNames={erpListGeistSelectClassNames}
                />
              ),
              children: isLoading ? (
                <ERPListTableLoading
                  theme={erpTheme}
                  message="Loading freight data…"
                />
              ) : (
                <Box
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <TariffMasterListNativeTable
                    theme={erpTheme}
                    rows={filteredFreightDataForDisplay}
                    getRowKey={(row) => String(row.id)}
                    getSno={(_row, index) =>
                      (currentPage - 1) * pageSize + index + 1
                    }
                    columns={freightListColumns}
                    isEmpty={filteredFreightDataForDisplay.length === 0}
                    emptyIcon={<IconTruck size={24} color={erpTheme.muted} />}
                    emptyTitle="No freight records"
                    renderActions={renderFreightActions}
                  />
                </Box>
              ),
            }}
          />
          <Outlet />
        </Box>
      </MantineProvider>
    </>
  );
}
