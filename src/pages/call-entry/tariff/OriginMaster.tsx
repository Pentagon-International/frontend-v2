import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useDebouncedValue } from "@mantine/hooks";
import useDateFormat from "../../../hooks/useDateFormat";
import { useListFilterStore } from "../../../store/listFilterStore";
import {
  TariffMasterListNativeTable,
  type TariffListColumn,
} from "./TariffMasterListNativeTable";
import { getTariffFilterListTotal } from "./tariffFilterListTotal";

type Origin = {
  id: number;
  origin_name: string;
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

const LIST_KEY = "ORIGIN_MASTER";

export default function OriginMaster() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const dateFormat = useDateFormat();

  // Initialize states from localStorage to persist across navigation
  const [showOriginModal, setShowOriginModal] = useState(() => {
    const hasSearchedBefore = localStorage.getItem("origin-has-searched");
    const currentName = localStorage.getItem("origin-current-name");
    // Only show modal if user hasn't searched before AND there's no current name
    return !hasSearchedBefore || !currentName;
  });

  const [originName, setOriginName] = useState("");
  const [selectedOriginData, setSelectedOriginData] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [currentOriginName, setCurrentOriginName] = useState(() => {
    return localStorage.getItem("origin-current-name") || "";
  });
  const [currentOriginCode, setCurrentOriginCode] = useState(() => {
    const storedCode = localStorage.getItem("origin-current-code") || "";
    const storedName = localStorage.getItem("origin-current-name") || "";

    // If code equals name, it's likely bad data - clear it
    if (storedCode && storedName && storedCode === storedName) {
      localStorage.removeItem("origin-current-code");
      return "";
    }

    return storedCode;
  });

  const [isModalLoading, setIsModalLoading] = useState(false);

  const [hasSearched, setHasSearched] = useState(() => {
    return !!localStorage.getItem("origin-has-searched");
  });

  const [searchError, setSearchError] = useState("");
  const [isChangeOriginMode, setIsChangeOriginMode] = useState(false); // Track if opened via "Change Origin"
  const [modalDisplayValue, setModalDisplayValue] = useState(""); // For SearchableSelect display in modal

  // Remove old state - now using memoized originData from useQuery

  // Add local search state
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [debouncedSearch] = useDebouncedValue(localSearchTerm, 500);

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
  const hasRestoredFromStore = useRef(false);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearStoreFilters = useListFilterStore((s) => s.clearFilters);
  const clearStoreSearch = useListFilterStore((s) => s.clearSearch);
  const clearStoreAllExcept = useListFilterStore((s) => s.clearAllExcept);

  // Service options - simple list like EnquiryMaster
  const serviceOptions = useMemo(
    () => [
      { value: "FCL", label: "FCL" },
      { value: "LCL", label: "LCL" },
      { value: "AIR", label: "AIR" },
    ],
    []
  );

  // Fetch origin data with React Query - using filter API with origin code from modal
  const {
    data: originVal = [],
    isLoading: isOriginLoading,
    isFetching: isOriginFetching,
  } = useQuery({
    queryKey: ["origin", currentOriginCode, currentPage, pageSize, debouncedSearch],
    queryFn: async () => {
      try {
        const requestBody: { filters: any } = { filters: {} };

        // Add origin_code filter if origin is selected from modal (use port code)
        if (currentOriginCode) {
          requestBody.filters.origin_code = currentOriginCode;
        }
        if (debouncedSearch.trim()) requestBody.filters.search = debouncedSearch.trim();

        const response = await apiCallProtected.post(
          `${URL.filter_origin}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        // Handle response - API returns { results: [...] } or { result: [...] }
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
        console.error("Error fetching origin data:", error);
        setTotalRecords(0);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    enabled:
      hasSearched &&
      !filtersApplied &&
      debouncedSearch.trim() === "" &&
      Boolean(currentOriginCode),
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredOriginData = [],
    isLoading: filteredOriginLoading,
    isFetching: filteredOriginFetching,
  } = useQuery({
    queryKey: [
      "filteredOrigin",
      filtersApplied,
      appliedFilters,
      currentOriginCode,
      debouncedSearch,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      try {
        const hasSearch = debouncedSearch.trim() !== "";
        if (!filtersApplied && !hasSearch) return [];

        const payload: any = {};

        // Always include origin_code from modal selection if available
        if (currentOriginCode) {
          payload.origin_code = currentOriginCode;
        }

        if (appliedFilters.carrier_name)
          payload.carrier_name = appliedFilters.carrier_name;
        if (appliedFilters.service)
          payload.service = appliedFilters.service;
        if (appliedFilters.valid_from)
          payload.valid_from = dayjs(appliedFilters.valid_from).format("YYYY-MM-DD");
        if (appliedFilters.valid_to)
          payload.valid_to = dayjs(appliedFilters.valid_to).format("YYYY-MM-DD");

        if (debouncedSearch.trim()) payload.search = debouncedSearch.trim();
        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          `${URL.filter_origin}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
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
        console.error("Error fetching filtered origin data:", error);
        setTotalRecords(0);
        return [];
      }
    },
    enabled: hasSearched && Boolean(currentOriginCode) && (filtersApplied || debouncedSearch.trim() !== ""),
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    clearStoreAllExcept(LIST_KEY);
  }, []);

  useEffect(() => {
    if (hasRestoredFromStore.current) return;
    const restored = useListFilterStore.getState().getState(LIST_KEY);
    if (restored?.shouldRestore) {
      const restoredFilters = (restored.filters as FilterState) || null;
      if (restoredFilters) {
        filterForm.setValues(restoredFilters);
        setAppliedFilters(restoredFilters);
        setFiltersApplied(
          Boolean(
            restoredFilters.carrier_name ||
              restoredFilters.service ||
              restoredFilters.valid_from ||
              restoredFilters.valid_to,
          ),
        );
      }
      if (typeof restored.search === "string") setLocalSearchTerm(restored.search);
      setCurrentPage(1);
      void queryClient.invalidateQueries({ queryKey: ["origin"] });
      void queryClient.invalidateQueries({ queryKey: ["filteredOrigin"] });
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }
  }, [filterForm, queryClient]);

  useEffect(() => {
    setStoreSearch(LIST_KEY, localSearchTerm);
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Determine which data to display
  const displayData = useMemo(() => {
    // Check if we have filtered data (filters were applied)
    if (filtersApplied || debouncedSearch.trim() !== "") {
      console.log("Displaying filtered data:", filteredOriginData);
      return filteredOriginData;
    }
    console.log("Displaying unfiltered data:", originVal);
    return originVal;
  }, [originVal, filteredOriginData, filtersApplied]);

  // Loading state
  const isLoading = useMemo(() => {
    if (filtersApplied || debouncedSearch.trim() !== "") {
      return filteredOriginLoading || filteredOriginFetching;
    }
    return isOriginLoading || isOriginFetching;
  }, [
    isOriginLoading,
    isOriginFetching,
    filteredOriginLoading,
    filteredOriginFetching,
    filtersApplied,
    debouncedSearch,
  ]);

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
  const preserveListState = useCallback(() => {
    setStoreFilters(LIST_KEY, appliedFilters);
    setStoreSearch(LIST_KEY, localSearchTerm);
    useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
  }, [appliedFilters, localSearchTerm, setStoreFilters, setStoreSearch]);

  const renderOriginActions = useCallback(
    (row: Origin) => (
      <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
            <IconDotsVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Box px={10} py={5}>
            <UnstyledButton
              onClick={() => {
                preserveListState();
                navigate("/tariff/origin/create", {
                  state: { ...row, actionType: "view" },
                });
              }}
            >
              <Group gap="sm">
                <IconEyeSpark size={16} style={{ color: primary }} />
                <Text size="sm">View Origin</Text>
              </Group>
            </UnstyledButton>
          </Box>
          {user?.is_staff ? (
            <>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    preserveListState();
                    navigate("/tariff/origin/create", {
                      state: { ...row, actionType: "edit" },
                    });
                  }}
                >
                  <Group gap="sm">
                    <IconEdit size={16} style={{ color: primary }} />
                    <Text size="sm">Edit Origin</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </>
          ) : null}
        </Menu.Dropdown>
      </Menu>
    ),
    [navigate, user?.is_staff, primary, preserveListState]
  );

  const originListColumns = useMemo<TariffListColumn<Origin>[]>(
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
            ...new Set(charges.map((c: { carrier_name?: string }) => c.carrier_name)),
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

  const handleOriginSubmit = async () => {
    if (!originName.trim() || !selectedOriginData) {
      ToastNotification({
        type: "error",
        message: "Please select an origin from the dropdown",
      });
      return;
    }

    setIsModalLoading(true);
    setSearchError(""); // Clear previous errors

    try {
      // Use the port name from selected data (no additional API call needed)
      const originDisplayName = selectedOriginData.name;

      // Update current origin first
      setCurrentOriginName(originDisplayName);
      setCurrentOriginCode(selectedOriginData.code);
      setHasSearched(true);

      // Save to localStorage to persist across navigation - store both name and code
      localStorage.setItem("origin-has-searched", "true");
      localStorage.setItem("origin-current-name", originDisplayName);
      localStorage.setItem("origin-current-code", selectedOriginData.code);

      setShowOriginModal(false); // Close the modal
      setIsChangeOriginMode(false); // Reset change mode
      setHasSearched(true); // Mark that user has searched
      setCurrentPage(1);
      ToastNotification({
        type: "success",
        message: `Loading origins for: ${originDisplayName}`,
      });
    } catch (error) {
      setSearchError(
        `Error loading origins for "${originName}". Please try again.`
      );
      ToastNotification({
        type: "error",
        message: "Error loading origins",
      });
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleChangeOrigin = () => {
    // Set the SearchableSelect value to the port CODE, not name
    setOriginName(currentOriginCode || currentOriginName);
    setSearchError("");

    // Use stored data to show formatted display (no API call needed)
    if (
      currentOriginName &&
      currentOriginCode &&
      currentOriginCode !== currentOriginName
    ) {
      // We have both name and a valid code (different from name)
      setModalDisplayValue(`${currentOriginName} (${currentOriginCode})`);
      setSelectedOriginData({
        code: currentOriginCode,
        name: currentOriginName,
      });
    } else if (currentOriginName) {
      // Fallback: if code is missing or same as name, just show name
      // This forces user to select again to get proper code
      setModalDisplayValue(currentOriginName);
      setSelectedOriginData({
        code: currentOriginName,
        name: currentOriginName,
      });
    }

    setShowOriginModal(true);
    setIsChangeOriginMode(true);
  };

  // Only show modal initially, not on every render
  const shouldShowModal = showOriginModal;

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
        await queryClient.invalidateQueries({ queryKey: ["origin"] });
        clearStoreFilters(LIST_KEY);
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
      setStoreFilters(LIST_KEY, { ...filterForm.values });
      setStoreSearch(LIST_KEY, localSearchTerm);
      setCurrentPage(1);

      // Enable the filtered query and refetch
      await queryClient.invalidateQueries({
        queryKey: ["filteredOrigin"],
      });
      setShowFilters(false);

      console.log("Filters applied successfully");
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset(); // Reset form to initial values
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
    clearStoreFilters(LIST_KEY);

    // Invalidate queries and refetch unfiltered data
    await queryClient.invalidateQueries({ queryKey: ["origin"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredOrigin"] });
    await queryClient.removeQueries({ queryKey: ["filteredOrigin"] }); // Remove filtered data from cache
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

  return (
    <>
      {/* Origin Name Modal */}
      <Modal
        opened={shouldShowModal}
        onClose={() => {
          if (isChangeOriginMode) {
            setShowOriginModal(false);
            setIsChangeOriginMode(false);
          }
        }}
        title={hasSearched ? "Change Origin Name" : "Enter Origin Name"}
        centered={false}
        yOffset={100}
        closeOnClickOutside={isChangeOriginMode} // Enable outside click to close only in change mode
        closeOnEscape={isChangeOriginMode} // Enable escape to close only in change mode
        withCloseButton={isChangeOriginMode} // Show close button only in change mode
        size="md"
      >
        <Box p="sm">
          <Text size="sm" mb="md" c="dimmed">
            {hasSearched
              ? "Enter a different origin name to change the current filter."
              : "Please enter the origin name to view the list of origins."}
          </Text>

          <Box mb="lg">
            <SearchableSelect
              dropdownZIndex={1000}
              label="Origin Name"
              placeholder="Type origin port name"
              apiEndpoint={URL.portMaster}
              searchFields={["port_name", "port_code"]}
              displayFormat={(item: any) => ({
                value: String(item.port_code),
                label: `${item.port_name} (${item.port_code})`,
              })}
              value={originName}
              displayValue={modalDisplayValue}
              onChange={(value, selectedData) => {
                setOriginName(value || "");
                setModalDisplayValue(selectedData?.label || "");
                if (selectedData) {
                  setSelectedOriginData({
                    code: selectedData.value,
                    name: selectedData.label.split(" (")[0],
                  });
                } else {
                  setSelectedOriginData(null);
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
            {!isChangeOriginMode && (
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isModalLoading}
              >
                Cancel
              </Button>
            )}

            <Group>
              {isChangeOriginMode && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOriginModal(false);
                    setIsChangeOriginMode(false);
                    setOriginName(""); // Clear the input
                    setSearchError(""); // Clear any errors
                  }}
                  disabled={isModalLoading}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={() => handleOriginSubmit()}
                loading={isModalLoading}
                disabled={!originName.trim() || isModalLoading}
                color="#105476"
              >
                {isChangeOriginMode ? "Change" : "Submit"}
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
                    List of Origin
                  </Text>
                  {currentOriginName ? (
                    <>
                      <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                        for:
                      </Text>
                      <Badge variant="light" color="#105476" size="md">
                        {currentOriginName}
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
                          onClick={() => {
                            setLocalSearchTerm("");
                            clearStoreSearch(LIST_KEY);
                            setCurrentPage(1);
                            void queryClient.invalidateQueries({ queryKey: ["origin"] });
                            void queryClient.invalidateQueries({ queryKey: ["filteredOrigin"] });
                          }}
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
                    disabled={!hasSearched || isOriginLoading}
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
                      onClick={handleChangeOrigin}
                    >
                      Change Origin
                    </Button>
                  ) : null}
                  {user?.is_staff ? (
                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                      onClick={() => {
                        preserveListState();
                        navigate("/tariff/origin/create");
                      }}
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
                    Select an origin port in the dialog to load tariff lines for that location.
                  </Text>
                </Center>
              ) : isLoading ? (
                <ERPListTableLoading theme={erpTheme} message="Loading origin data…" />
              ) : (displayData as Origin[]).length === 0 ? (
                <Center py="xl" style={{ backgroundColor: erpTheme.cardBg, flex: 1 }}>
                  <Stack align="center" gap="md">
                    <Text c="dimmed" ta="center">
                      No origins found
                      {filtersApplied ? " for this filter" : ""}
                      {!filtersApplied && currentOriginName ? ` for ${currentOriginName}` : ""}
                    </Text>
                    <Button variant="default" size="sm" onClick={handleChangeOrigin}>
                      Try Different Origin
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
                    rows={displayData as Origin[]}
                    getRowKey={(row) => String(row.id)}
                    getSno={(_row, index) => (currentPage - 1) * pageSize + index + 1}
                    columns={originListColumns}
                    isEmpty={(displayData as Origin[]).length === 0}
                    emptyIcon={<IconMapPin size={24} color={erpTheme.muted} />}
                    emptyTitle="No origin lines match your search"
                    renderActions={renderOriginActions}
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
