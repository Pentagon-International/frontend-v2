import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Group,
  Menu,
  Modal,
  Popover,
  Select,
  Text,
  TextInput,
  UnstyledButton,
  Grid,
  Loader,
} from "@mantine/core";
import {
  IconChevronDown,
  IconDotsVertical,
  IconEdit,
  IconEyeSpark,
  IconFilterOff,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconArrowLeft,
  IconFilter,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ToastNotification, SearchableSelect, DateRangeInput } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { DateInput } from "@mantine/dates";

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

export default function OriginMaster() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isMountedRef = useRef(false);

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

  // Fetch origin data with React Query - using filter API with origin code from modal
  const {
    data: originVal = [],
    isLoading: isOriginLoading,
    refetch: refetchOrigin,
  } = useQuery({
    queryKey: ["origin", currentOriginCode],
    queryFn: async () => {
      try {
        const requestBody: { filters: any } = { filters: {} };

        // Add origin_code filter if origin is selected from modal (use port code)
        if (currentOriginCode) {
          requestBody.filters.origin_code = currentOriginCode;
        }

        const response = await apiCallProtected.post(
          URL.filter_origin,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        // Handle response - API returns { results: [...] } or { result: [...] }
        if (data && Array.isArray(data.results)) {
          return data.results;
        } else if (data && Array.isArray(data.result)) {
          return data.result;
        } else if (data && Array.isArray(data.data)) {
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching origin data:", error);
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
    data: filteredOriginData = [],
    isLoading: filteredOriginLoading,
    refetch: refetchFilteredOrigin,
  } = useQuery({
    queryKey: ["filteredOrigin", filtersApplied, appliedFilters, currentOriginCode],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

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

        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          URL.filter_origin,
          requestBody
        );
        const data = response as any;
        console.log("Filter API response:", data);

        // Handle both 'result' and 'results' properties
        if (data && Array.isArray(data.result)) {
          return data.result;
        } else if (data && Array.isArray(data.results)) {
          return data.results;
        } else if (data && Array.isArray(data.data)) {
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered origin data:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Trigger initial fetch when page mounts with saved origin
  useEffect(() => {
    if (currentOriginName) {
      setHasSearched(true);
      refetchOrigin();
    }
  }, []); // Run only once on mount

  // Determine which data to display
  const displayData = useMemo(() => {
    // Check if we have filtered data (filters were applied)
    if (filtersApplied) {
      console.log("Displaying filtered data:", filteredOriginData);
      return filteredOriginData;
    }
    console.log("Displaying unfiltered data:", originVal);
    return originVal;
  }, [originVal, filteredOriginData, filtersApplied]);

  // Filter data based on local search term (client-side search on displayed data)
  const filteredOriginDataForDisplay = useMemo<Origin[]>(() => {
    if (!localSearchTerm.trim()) {
      return displayData as Origin[];
    }

    const searchLower = localSearchTerm.toLowerCase();

    return (displayData as Origin[]).filter((item) => {
      // Search in tariff charges for carrier and charge details
      const tariffCharges = item.tariff_charges || [];

      // Check if any tariff charge matches the search criteria
      const chargeMatches = tariffCharges.some((charge: any) => {
        const carrierName = charge.carrier_name?.toLowerCase() || "";
        return carrierName.includes(searchLower);
      });

      // Search in other fields
      const originName = item.origin_name?.toLowerCase() || "";
      const validFrom = item.valid_from?.toLowerCase() || "";
      const validTo = item.valid_to?.toLowerCase() || "";
      const status = item.status?.toLowerCase() || "";
      const service = (item.service || "").toLowerCase();

      // Check if search term matches any of these fields
      return (
        chargeMatches ||
        originName.includes(searchLower) ||
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
      return filteredOriginLoading;
    }
    return isOriginLoading;
  }, [isOriginLoading, filteredOriginLoading, filtersApplied]);


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

      // Invalidate and refetch data with new origin name using filter API
      // Use setTimeout to ensure state update has propagated
      await queryClient.invalidateQueries({ queryKey: ["origin"] });
      setTimeout(async () => {
        await refetchOrigin();
      }, 100);

      setShowOriginModal(false); // Close the modal
      setIsChangeOriginMode(false); // Reset change mode
      setHasSearched(true); // Mark that user has searched
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
        await refetchOrigin();
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
        queryKey: ["filteredOrigin"],
      });
      setShowFilters(false);

      await refetchFilteredOrigin();

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
    await queryClient.invalidateQueries({ queryKey: ["origin"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredOrigin"] });
    await queryClient.removeQueries({ queryKey: ["filteredOrigin"] }); // Remove filtered data from cache
    await refetchOrigin();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const handleDelete = async (value: any) => {
    try {
      const res = await deleteApiCall(URL.groupCompany, API_HEADER, value);
      await refetchOrigin();
      ToastNotification({
        type: "success",
        message: `Origin is successfully deleted`,
      });
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message || err}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<Origin>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        maxSize: 70,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "tariff_charges",
        header: "Carrier Name",
        size: 200,
        Cell: ({ row }) => {
          const charges = row.original.tariff_charges || [];
          if (charges.length === 0) return "—";

          // Get unique carrier names from tariff charges
          const uniqueCarriers = [
            ...new Set(charges.map((charge: any) => charge.carrier_name)),
          ];
          return uniqueCarriers.join(", ");
        },
      },
      {
        accessorKey: "service",
        header: "Service",
        size: 100,
      },
      {
        accessorKey: "valid_from",
        header: "Valid From",
        size: 100
        ,
      },
      {
        accessorKey: "valid_to",
        header: "Valid To",
        size: 100
        ,
      },
      {
        id: "actions",
        header: "Action",
        size: 80,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius={"md"}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate("/tariff/origin/create", {
                      state: {
                        ...row.original,
                        actionType: "view",
                      },
                    })
                  }
                >
                  <Group gap={"sm"}>
                    <IconEyeSpark size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View Origin</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {user?.is_staff && (
                <>
                  <Menu.Divider />
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/tariff/origin/create", {
                          state: {
                            ...row.original,
                            actionType: "edit",
                          },
                        })
                      }
                    >
                      <Group gap={"sm"}>
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text size="sm">Edit Origin</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate, user?.is_staff]
  );

  const table = useMantineReactTable({
    columns,
    data: filteredOriginDataForDisplay as Origin[],
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      pagination: { pageSize: 25, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
    },
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "30px",
            zIndex: 2,
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "6px 8px",
          fontSize: "13px",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "30px",
            zIndex: 2,
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "6px 8px",
          fontSize: "12px",
          backgroundColor: "#ffffff",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #e9ecef",
          ...extraStyles,
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
  });

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

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

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Group align="center" gap="xs">
            <Text size="md" fw={600}>
              List of Origin
            </Text>
            {currentOriginName && (
              <>
                <Text size="md" fw={600}>
                  for:
                </Text>
                <Badge variant="light" color="#105476" size="md">
                  {currentOriginName}
                </Badge>
              </>
            )}
          </Group>

          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="Search in origin name"
              leftSection={<IconSearch size={16} />}
              style={{ width: 350, height: 32, fontSize: 14 }}
              radius="sm"
              size="xs"
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              disabled={!hasSearched || isOriginLoading}
            />

            {hasSearched && (
              <Button
                variant="outline"
                leftSection={<IconFilter size={16} />}
                size="xs"
                color="#105476"
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </Button>
            )}

            {hasSearched && (
              <Button
                variant="outline"
                size="xs"
                color="#105476"
                onClick={handleChangeOrigin}
              >
                Change Origin
              </Button>
            )}

            {user?.is_staff && (
              <Button
                color={"#105476"}
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={() => navigate("/tariff/origin/create")}
                disabled={false}
              >
                Create New
              </Button>
            )}
          </Group>
        </Group>

        {/* Filter Section */}
        {showFilters && hasSearched && (
          <Card
            shadow="xs"
            padding="md"
            radius="md"
            withBorder
            mb="md"
            bg="#f8f9fa"
          >
            <Group justify="space-between" align="center">
              <Group align="center" gap="xs">
                <IconFilter size={16} color="#105476" />
                <Text size="sm" fw={500} c="#105476">
                  Filters
                </Text>
              </Group>
            </Group>

            <Grid>
              <Grid.Col span={12}>
                <Grid>
                  {/* Carrier Name Filter */}
                  <Grid.Col span={2.4}>
                    <SearchableSelect
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
                    />
                  </Grid.Col>

                  {/* Service Filter */}
                  <Grid.Col span={2.4}>
                    <Select
                      key={`service-${filterForm.values.service}`}
                      label="Service"
                      placeholder="Select Service"
                      searchable
                      clearable
                      size="xs"
                      data={serviceOptions}
                      {...filterForm.getInputProps("service")}
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      }}
                    />
                  </Grid.Col>

                  {/* Valid From Date Filter */}
                  <Grid.Col span={2.4}>
                    <DateInput
                      key={`valid-from-${filterForm.values.valid_from}`}
                      label="Valid From"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      {...filterForm.getInputProps("valid_from")}
                      valueFormat="YYYY-MM-DD"
                      leftSection={<IconCalendar size={14} />}
                      leftSectionPointerEvents="none"
                      radius="md"
                      nextIcon={<IconChevronRight size={16} />}
                      previousIcon={<IconChevronLeft size={16} />}
                      clearable
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      } as any}
                    />
                  </Grid.Col>

                  {/* Valid To Date Filter */}
                  <Grid.Col span={2.4}>
                    <DateInput
                      key={`valid-to-${filterForm.values.valid_to}`}
                      label="Valid To"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      {...filterForm.getInputProps("valid_to")}
                      valueFormat="YYYY-MM-DD"
                      leftSection={<IconCalendar size={14} />}
                      leftSectionPointerEvents="none"
                      radius="md"
                      nextIcon={<IconChevronRight size={16} />}
                      previousIcon={<IconChevronLeft size={16} />}
                      clearable
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      } as any}
                    />
                  </Grid.Col>
                </Grid>
              </Grid.Col>
            </Grid>

            {/* Date Range Filter
            <Grid mt="md">
              <Grid.Col span={12}>
                <DateRangeInput
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromDateChange={setFromDate}
                  onToDateChange={setToDate}
                  fromLabel="From Date"
                  toLabel="To Date"
                  size="xs"
                  allowDeselection={true}
                  showRangeInCalendar={false}
                />
              </Grid.Col>
            </Grid>
                </Grid>
              </Grid.Col>
            </Grid> */}

            <Group justify="end" mt="sm">
              <Button
                size="xs"
                variant="outline"
                color="#105476"
                leftSection={<IconFilterOff size={14} />}
                onClick={clearAllFilters}
              >
                Clear Filters
              </Button>
              <Button
                size="xs"
                variant="filled"
                color="#105476"
                leftSection={
                  isLoading ? <Loader size={14} /> : <IconFilter size={14} />
                }
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
              >
                Apply Filters
              </Button>
            </Group>
          </Card>
        )}

        {/* Show table only after search and when not in modal */}
        {hasSearched && (
          <>
            {isLoading ? (
              <Box p="xl" style={{ textAlign: "center", display:"flex", alignItems:"center", justifyContent:"center", gap:"5px" }}>
                <Loader color="#105475" size="sm"/>
                <Text>Loading origins...</Text>
              </Box>
            ) : (displayData as Origin[]).length === 0 ? (
              <Box p="xl" style={{ textAlign: "center" }}>
                <Text c="dimmed">
                  No origins found for {filtersApplied && "this filter"} {!filtersApplied && currentOriginName && `${currentOriginName}`}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  mt="md"
                  onClick={handleChangeOrigin}
                >
                  Try Different Origin
                </Button>
              </Box>
            ) : (
              <>
                {/* {localSearchTerm && (
                  <Box mb="md">
                    <Text size="sm" c="dimmed">
                      Showing {filteredOriginData.length} of{" "}
                      {(originVal as Origin[]).length} results
                      {localSearchTerm && ` for "${localSearchTerm}"`}
                    </Text>
                  </Box>
                )} */}
                <MantineReactTable table={table} />

                {/* Custom Pagination Bar */}
                <Group
                  w="100%"
                  justify="space-between"
                  align="center"
                  p="xs"
                  wrap="nowrap"
                  pt="md"
                >
                  {/* Rows per page and range */}
                  <Group gap="sm" align="center" wrap="nowrap">
                    <Text size="sm" c="dimmed">
                      Rows per page
                    </Text>
                    <Select
                      size="xs"
                      data={["10", "25", "50"]}
                      value={String(pageSize)}
                      onChange={(val) => {
                        if (!val) return;
                        handlePageSizeChange(Number(val));
                      }}
                      w={110}
                      styles={{ input: { fontSize: 12, height: 30 } } as any}
                    />
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const total = totalRecords || filteredOriginDataForDisplay.length || 0;
                        if (total === 0) return "0–0 of 0";
                        const start = (currentPage - 1) * pageSize + 1;
                        const end = Math.min(currentPage * pageSize, total);
                        return `${start}–${end} of ${total}`;
                      })()}
                    </Text>
                  </Group>

                  {/* Page controls */}
                  <Group gap="xs" align="center" wrap="nowrap" pr={50}>
                    <ActionIcon
                      variant="default"
                      size="sm"
                      onClick={() =>
                        handlePageChange(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <IconChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="sm" ta="center" style={{ width: 26 }}>
                      {currentPage}
                    </Text>
                    <Text size="sm" c="dimmed">
                      of {Math.max(1, Math.ceil((totalRecords || filteredOriginDataForDisplay.length || 0) / pageSize))}
                    </Text>
                    <ActionIcon
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil((totalRecords || filteredOriginDataForDisplay.length || 0) / pageSize)
                        );
                        handlePageChange(Math.min(totalPages, currentPage + 1));
                      }}
                      disabled={(() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil((totalRecords || filteredOriginDataForDisplay.length || 0) / pageSize)
                        );
                        return currentPage >= totalPages;
                      })()}
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </>
            )}
          </>
        )}

        <Outlet />
      </Card>
    </>
  );
}
