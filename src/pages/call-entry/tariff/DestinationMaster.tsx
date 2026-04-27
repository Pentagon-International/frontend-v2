import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
  Grid,
  MantineProvider,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEyeSpark,
  IconFilter,
  IconListDetails,
  IconListNumbers,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconX,
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
  ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER,
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

type Destination = {
  id: number;
  destination_name: string;
  valid_from: string;
  valid_to: string;
  status?: string;
  tariff_charges?: any[];
  service?: string;
};

type FilterState = {
  carrier_name: string | null;
  service: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
};

export default function DestinationMaster() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const dateFormat = useDateFormat();

  // Initialize states from localStorage to persist across navigation
  const [showDestinationModal, setShowDestinationModal] = useState(() => {
    const hasSearchedBefore = localStorage.getItem("destination-has-searched");
    const currentName = localStorage.getItem("destination-current-name");
    // Only show modal if user hasn't searched before AND there's no current name
    return !hasSearchedBefore || !currentName;
  });

  const [destinationName, setDestinationName] = useState("");
  const [selectedDestinationData, setSelectedDestinationData] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [currentDestinationName, setCurrentDestinationName] = useState(() => {
    return localStorage.getItem("destination-current-name") || "";
  });
  const [currentDestinationCode, setCurrentDestinationCode] = useState(() => {
    const storedCode = localStorage.getItem("destination-current-code") || "";
    const storedName = localStorage.getItem("destination-current-name") || "";

    // If code equals name, it's likely bad data - clear it
    if (storedCode && storedName && storedCode === storedName) {
      localStorage.removeItem("destination-current-code");
      return "";
    }

    return storedCode;
  });

  const [isModalLoading, setIsModalLoading] = useState(false);

  const [hasSearched, setHasSearched] = useState(() => {
    return !!localStorage.getItem("destination-has-searched");
  });

  const [searchError, setSearchError] = useState("");
  const [isChangeDestinationMode, setIsChangeDestinationMode] = useState(false); // Track if opened via "Change Destination"
  const [modalDisplayValue, setModalDisplayValue] = useState(""); // For SearchableSelect display in modal

  // Remove old state - now using memoized destinationData from useQuery

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
  const [carrierDisplayValue, setCarrierDisplayValue] = useState<string | null>(null);

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      carrier_name: null,
      service: null,
      valid_from: null,
      valid_to: null,
    },
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    carrier_name: null,
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

  // Fetch destination data with React Query - using filter API with destination code from modal
  const {
    data: destinationVal = [],
    isLoading: isDestinationLoading,
    refetch: refetchDestination,
  } = useQuery({
    queryKey: ["destination", currentDestinationCode, currentPage, pageSize],
    queryFn: async () => {
      try {
        const requestBody: { filters: any } = { filters: {} };

        // Add destination_code filter if destination is selected from modal (use port code)
        if (currentDestinationCode) {
          requestBody.filters.destination_code = currentDestinationCode;
        }

        const response = await apiCallProtected.post(
          `${URL.filter_destination}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

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
        console.error("Error fetching destination data:", error);
        setTotalRecords(0);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: false, // Don't run automatically - we'll trigger it manually
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredDestinationData = [],
    isLoading: filteredDestinationLoading,
    refetch: refetchFilteredDestination,
  } = useQuery({
    queryKey: [
      "filteredDestination",
      filtersApplied,
      appliedFilters,
      currentDestinationCode,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        const payload: any = {};

        // Always include destination_code from modal selection if available
        if (currentDestinationCode) {
          payload.destination_code = currentDestinationCode;
        }

        if (appliedFilters.carrier_name)
          payload.carrier_name = appliedFilters.carrier_name;
        if (appliedFilters.service)
          payload.service = appliedFilters.service;
        if (appliedFilters.valid_from)
          payload.valid_from = dayjs(appliedFilters.valid_from).format("YYYY-MM-DD");
        if (appliedFilters.valid_to)
          payload.valid_to = dayjs(appliedFilters.valid_to).format("YYYY-MM-DD");

        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          `${URL.filter_destination}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
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
        console.error("Error fetching filtered destination data:", error);
        setTotalRecords(0);
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Trigger initial fetch when page mounts with saved destination
  useEffect(() => {
    if (currentDestinationName) {
      setHasSearched(true);
      refetchDestination();
    }
  }, []); // Run only once on mount

  // Determine which data to display
  const displayData = useMemo(() => {
    // Check if we have filtered data (filters were applied)
    if (filtersApplied) {
      console.log("Displaying filtered data:", filteredDestinationData);
      return filteredDestinationData;
    }
    console.log("Displaying unfiltered data:", destinationVal);
    return destinationVal;
  }, [destinationVal, filteredDestinationData, filtersApplied]);

  // Filter data based on local search term (client-side search on displayed data)
  const filteredDestinationDataForDisplay = useMemo<Destination[]>(() => {
    if (!localSearchTerm.trim()) {
      return displayData as Destination[];
    }

    const searchLower = localSearchTerm.toLowerCase();

    return (displayData as Destination[]).filter((item) => {
      // Search in tariff charges for carrier and charge details
      const tariffCharges = item.tariff_charges || [];

      // Check if any tariff charge matches the search criteria
      const chargeMatches = tariffCharges.some((charge: any) => {
        const carrierName = charge.carrier_name?.toLowerCase() || "";
        return carrierName.includes(searchLower);
      });

      // Search in other fields
      const destinationName = item.destination_name?.toLowerCase() || "";
      const validFrom = item.valid_from?.toLowerCase() || "";
      const validTo = item.valid_to?.toLowerCase() || "";
      const status = item.status?.toLowerCase() || "";
      const service = (item.service || "").toLowerCase();

      // Check if search term matches any of these fields
      return (
        chargeMatches ||
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
      return filteredDestinationLoading;
    }
    return isDestinationLoading;
  }, [isDestinationLoading, filteredDestinationLoading, filtersApplied]);

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

  const renderDestinationActions = useCallback(
    (row: Destination) => (
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
                navigate("/tariff/destination/create", {
                  state: { ...row, actionType: "view" },
                })
              }
            >
              <Group gap="sm">
                <IconEyeSpark size={16} style={{ color: primary }} />
                <Text size="sm">View Destination</Text>
              </Group>
            </UnstyledButton>
          </Box>
          {user?.is_staff ? (
            <>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate("/tariff/destination/create", {
                      state: { ...row, actionType: "edit" },
                    })
                  }
                >
                  <Group gap="sm">
                    <IconEdit size={16} style={{ color: primary }} />
                    <Text size="sm">Edit Destination</Text>
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

  const destinationListColumns = useMemo<TariffListColumn<Destination>[]>(
    () => [
      {
        id: "carrier",
        header: "Carrier Name",
        cellMaxWidth: 240,
        cell: (r) => {
          const charges = r.tariff_charges || [];
          if (charges.length === 0) {
            return (
              <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
                —
              </Text>
            );
          }
          const uniqueCarriers = [
            ...new Set(
              charges.map((c: { carrier_name?: string }) => c.carrier_name)
            ),
          ];
          const raw = uniqueCarriers.join(", ");
          return (
            <Tooltip
              label={raw}
              withArrow
              multiline
              w={320}
              position="top"
              styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
            >
              <Text
                size="sm"
                c={fg}
                lineClamp={2}
                style={{ fontFamily: fontSans, cursor: "default" }}
              >
                {raw}
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
    [dateFormat, fg, fontSans, muted]
  );

  const handleDestinationSubmit = async () => {
    console.log(
      "handleDestinationSubmit called with destinationName:",
      destinationName,
      "selectedData:",
      selectedDestinationData
    );

    if (!destinationName.trim() || !selectedDestinationData) {
      ToastNotification({
        type: "error",
        message: "Please select a destination from the dropdown",
      });
      return;
    }

    setIsModalLoading(true);
    setSearchError(""); // Clear previous errors

    try {
      // Use the port name for display and API call (no additional API call needed)
      const destinationDisplayName = selectedDestinationData.name;

      // Update current destination first
      setCurrentDestinationName(destinationDisplayName);
      setCurrentDestinationCode(selectedDestinationData.code);
      setHasSearched(true);

      // Save to localStorage - store both name and code
      localStorage.setItem("destination-has-searched", "true");
      localStorage.setItem("destination-current-name", destinationDisplayName);
      localStorage.setItem(
        "destination-current-code",
        selectedDestinationData.code
      );

      // Invalidate and refetch data with new destination name using filter API
      // Use setTimeout to ensure state update has propagated
      await queryClient.invalidateQueries({ queryKey: ["destination"] });
      setTimeout(async () => {
        await refetchDestination();
      }, 100);

      setShowDestinationModal(false);
      setIsChangeDestinationMode(false);
      ToastNotification({
        type: "success",
        message: `Loading destinations for: ${destinationDisplayName}`,
      });
    } catch (error) {
      console.error("Error in handleDestinationSubmit:", error);
      setSearchError(
        `Error loading destinations for "${destinationName}". Please try again.`
      );
      ToastNotification({
        type: "error",
        message: "Error loading destinations",
      });
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleChangeDestination = () => {
    // Set the SearchableSelect value to the port CODE, not name
    setDestinationName(currentDestinationCode || currentDestinationName);
    setSearchError("");

    // Use stored data to show formatted display (no API call needed)
    if (
      currentDestinationName &&
      currentDestinationCode &&
      currentDestinationCode !== currentDestinationName
    ) {
      // We have both name and a valid code (different from name)
      setModalDisplayValue(
        `${currentDestinationName} (${currentDestinationCode})`
      );
      setSelectedDestinationData({
        code: currentDestinationCode,
        name: currentDestinationName,
      });
    } else if (currentDestinationName) {
      // Fallback: if code is missing or same as name, just show name
      // This forces user to select again to get proper code
      setModalDisplayValue(currentDestinationName);
      setSelectedDestinationData({
        code: currentDestinationName,
        name: currentDestinationName,
      });
    }

    setShowDestinationModal(true);
    setIsChangeDestinationMode(true);
  };

  // Only show modal initially, not on every render
  const shouldShowModal = showDestinationModal; // Remove the !hasSearched condition

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values (excluding date range which is handled separately)
      const hasFilterValues =
        filterForm.values.carrier_name ||
        filterForm.values.service ||
        filterForm.values.valid_from ||
        filterForm.values.valid_to;

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setAppliedFilters({
          carrier_name: null,
          service: null,
          valid_from: null,
          valid_to: null,
        });

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["destination"] });
        await refetchDestination();
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
        carrier_name: filterForm.values.carrier_name,
        service: filterForm.values.service,
        valid_from: filterForm.values.valid_from,
        valid_to: filterForm.values.valid_to,
      });

      // Enable the filtered query and refetch
      await queryClient.invalidateQueries({
        queryKey: ["filteredDestination"],
      });
      setShowFilters(false);

      await refetchFilteredDestination();

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
      carrier_name: null,
      service: null,
      valid_from: null,
      valid_to: null,
    });

    // Clear display values
    setCarrierDisplayValue(null);

    // Invalidate queries and refetch unfiltered data
    await queryClient.invalidateQueries({ queryKey: ["destination"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredDestination"] });
    await queryClient.removeQueries({ queryKey: ["filteredDestination"] }); // Remove filtered data from cache
    await refetchDestination();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
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
      void refetchFilteredDestination();
    } else {
      void refetchDestination();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  return (
    <>
      {/* Destination Name Modal */}
      <Modal
        opened={shouldShowModal}
        onClose={() => {
          if (isChangeDestinationMode) {
            setShowDestinationModal(false);
            setIsChangeDestinationMode(false);
          }
        }}
        title={
          hasSearched ? "Change Destination Name" : "Enter Destination Name"
        }
        centered={false}
        yOffset={100}
        closeOnClickOutside={isChangeDestinationMode} // Enable outside click to close only in change mode
        closeOnEscape={isChangeDestinationMode} // Enable escape to close only in change mode
        withCloseButton={isChangeDestinationMode} // Show close button only in change mode
        size="md"
      >
        <Box p="sm">
          <Text size="sm" mb="md" c="dimmed">
            {hasSearched
              ? "Enter a different destination name to change the current filter."
              : "Please enter the destination name to view the list of destinations."}
          </Text>

          <Box mb="lg">
            <SearchableSelect
              dropdownZIndex={1000}
              label="Destination Name"
              placeholder="Type destination port name"
              apiEndpoint={URL.portMaster}
              searchFields={["port_name", "port_code"]}
              displayFormat={(item: any) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={destinationName}
              displayValue={modalDisplayValue}
              onChange={(value, selectedData) => {
                setDestinationName(value || "");
                setModalDisplayValue(selectedData?.label || "");
                if (selectedData) {
                  setSelectedDestinationData({
                    code: selectedData.value,
                    name: selectedData.label.split(" (")[0], // Extract port name from "Port Name (CODE)"
                  });
                } else {
                  setSelectedDestinationData(null);
                }
              }}
              minSearchLength={2}
              required
              disabled={isModalLoading}
            />
          </Box>

          {searchError && (
            <Text color="red" size="sm" mb="lg">
              {searchError}
            </Text>
          )}

          <Group justify="flex-end">
            {!isChangeDestinationMode && (
              <Button
                variant="outline"
                // leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate(-1)}
                disabled={isModalLoading}
              >
                Cancel
              </Button>
            )}

            <Group>
              {isChangeDestinationMode && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDestinationModal(false);
                    setIsChangeDestinationMode(false);
                    setDestinationName(""); // Clear the input
                    setSearchError(""); // Clear any errors
                  }}
                  disabled={isModalLoading}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={() => handleDestinationSubmit()}
                loading={isModalLoading}
                disabled={!destinationName.trim() || isModalLoading}
                color="#105476"
              >
                {isChangeDestinationMode ? "Change" : "Submit"}
              </Button>
            </Group>
          </Group>
        </Box>
      </Modal>

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
                <Group gap="xs" wrap="nowrap" align="center">
                  <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                    List of Destination
                  </Text>
                  {currentDestinationName ? (
                    <>
                      <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                        for:
                      </Text>
                      <Badge variant="light" color="#105476" size="md">
                        {currentDestinationName}
                      </Badge>
                    </>
                  ) : null}
                </Group>
              ),
              actions: (
                <>
                  <TextInput
                    placeholder="Search carriers and fields"
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
                    disabled={!hasSearched || isDestinationLoading}
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
                  {hasSearched ? (
                    <Button
                      variant="default"
                      size="xs"
                      styles={erpToolbarOutlineButtonStyles(erpTheme)}
                      leftSection={<IconFilter size={14} />}
                      onClick={() => setShowFilters((s) => !s)}
                    >
                      {showFilters ? "Hide filters" : "Filters"}
                    </Button>
                  ) : null}
                  {hasSearched ? (
                    <Button
                      variant="default"
                      size="xs"
                      styles={erpToolbarOutlineButtonStyles(erpTheme)}
                      onClick={handleChangeDestination}
                    >
                      Change Destination
                    </Button>
                  ) : null}
                  {user?.is_staff ? (
                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                      onClick={() => navigate("/tariff/destination/create")}
                    >
                      Create New
                    </Button>
                  ) : null}
                </>
              ),
            }}
            filters={
              hasSearched
                ? {
                    opened: showFilters,
                    title: "Filters",
                    subtitle: "Carrier, service, or validity dates",
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
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                          <Box style={erpListFilterFieldCellStyle}>
                          <SearchableSelect
                            dropdownZIndex={1000}
                            size="xs"
                            label="Carrier Name"
                            placeholder="Type carrier name"
                            apiEndpoint={URL.carrier}
                            searchFields={["carrier_name", "carrier_code"]}
                            displayFormat={(item: any) => ({
                              value: String(item.carrier_name),
                              label: item.carrier_name,
                            })}
                            value={filterForm.values.carrier_name}
                            displayValue={carrierDisplayValue}
                            onChange={(value, selectedData) => {
                              filterForm.setFieldValue("carrier_name", value || null);
                              setCarrierDisplayValue(selectedData?.label || null);
                            }}
                            minSearchLength={2}
                            classNames={erpListGeistSelectClassNames}
                            styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                            className="filter-searchable-select"
                          />
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                          <Box style={erpListFilterFieldCellStyle}>
                          <Select
                            key={`service-${filterForm.values.service}`}
                            label="Service"
                            placeholder="Select Service"
                            searchable
                            clearable
                            size="xs"
                            data={serviceOptions}
                            {...filterForm.getInputProps("service")}
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
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                          <Box style={erpListFilterFieldCellStyle}>
                          <SingleDateInput
                            key={`valid-from-${filterForm.values.valid_from}`}
                            label="Valid From"
                            placeholder="YYYY-MM-DD"
                            size="xs"
                            value={filterForm.values.valid_from}
                            onChange={(v) =>
                              filterForm.setFieldValue("valid_from", v)
                            }
                            classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                            styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                          />
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                          <Box style={erpListFilterFieldCellStyle}>
                          <SingleDateInput
                            key={`valid-to-${filterForm.values.valid_to}`}
                            label="Valid To"
                            placeholder="YYYY-MM-DD"
                            size="xs"
                            value={filterForm.values.valid_to}
                            onChange={(v) =>
                              filterForm.setFieldValue("valid_to", v)
                            }
                            classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                            styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                          />
                          </Box>
                        </Grid.Col>
                      </Grid>
                    ),
                  }
                : null
            }
            table={{
              footer: hasSearched ? (
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
              ) : undefined,
              children: !hasSearched ? (
                <Center py={60} style={{ backgroundColor: erpTheme.cardBg }}>
                  <Text size="sm" c="dimmed" style={{ fontFamily: fontSans }} ta="center" maw={360}>
                    Select a destination port in the dialog to load tariff lines for that location.
                  </Text>
                </Center>
              ) : isLoading || filteredDestinationLoading ? (
                <ERPListTableLoading theme={erpTheme} message="Loading destination data…" />
              ) : (displayData as Destination[]).length === 0 ? (
                <Center py="xl" style={{ backgroundColor: erpTheme.cardBg, flex: 1 }}>
                  <Stack align="center" gap="md">
                    <Text c="dimmed" ta="center">
                      No destinations found
                      {filtersApplied ? " for this filter" : ""}
                      {!filtersApplied && currentDestinationName ? ` for ${currentDestinationName}` : ""}
                    </Text>
                    <Button variant="default" size="sm" onClick={handleChangeDestination}>
                      Try Different Destination
                    </Button>
                  </Stack>
                </Center>
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
                    rows={filteredDestinationDataForDisplay}
                    getRowKey={(row) => String(row.id)}
                    getSno={(_row, index) => (currentPage - 1) * pageSize + index + 1}
                    columns={destinationListColumns}
                    isEmpty={filteredDestinationDataForDisplay.length === 0}
                    emptyIcon={<IconMapPin size={24} color={erpTheme.muted} />}
                    emptyTitle="No destination lines match your search"
                    renderActions={renderDestinationActions}
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
