import { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  Grid,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEyeSpark,
  IconPlus,
  IconSearch,
  IconArrowLeft,
  IconFilter,
  IconFilterOff,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router-dom";
import { ToastNotification, SearchableSelect, SingleDateInput } from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
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
import useDateFormat from "../../../hooks/useDateFormat";

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

  const isMountedRef = useRef(false);
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
    queryKey: ["destination", currentDestinationCode, pageSize],
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
          setTotalRecords(data.total || data.data.length);
          return data.data;
        } else if (data && Array.isArray(data.result)) {
          setTotalRecords(data.total || data.result.length);
          return data.result;
        } else if (data && Array.isArray(data.results)) {
          setTotalRecords(data.total || data.results.length);
          return data.results;
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
    queryKey: ["filteredDestination", filtersApplied, appliedFilters, currentDestinationCode, pageSize],
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
          setTotalRecords(data.total || data.data.length);
          return data.data;
        } else if (data && Array.isArray(data.result)) {
          setTotalRecords(data.total || data.result.length);
          return data.result;
        } else if (data && Array.isArray(data.results)) {
          setTotalRecords(data.total || data.results.length);
          return data.results;
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

  const handleDelete = async (value: any) => {
    try {
      const res = await deleteApiCall(URL.groupCompany, API_HEADER, value);
      await refetchDestination();
      ToastNotification({
        type: "success",
        message: `Destination is successfully deleted`,
      });
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message || err}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<Destination>[]>(
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
        size: 100,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.valid_from
              ? dayjs(row.original.valid_from).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "valid_to",
        header: "Valid To",
        size: 100,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.valid_to
              ? dayjs(row.original.valid_to).format(dateFormat)
              : "-"}
          </Text>
        ),
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
                    navigate("/tariff/destination/create", {
                      state: {
                        ...row.original,
                        actionType: "view",
                      },
                    })
                  }
                >
                  <Group gap={"sm"}>
                    <IconEyeSpark size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View Destination</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {user?.is_staff && (
                <>
                  <Menu.Divider />
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/tariff/destination/create", {
                          state: {
                            ...row.original,
                            actionType: "edit",
                          },
                        })
                      }
                    >
                      <Group gap={"sm"}>
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text size="sm">Edit Destination</Text>
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
    data: filteredDestinationDataForDisplay as Destination[],
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      pagination: { pageSize: pageSize, pageIndex: currentPage - 1 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%" },
    },
    mantinePaperProps: {
      shadow: "sm",
      radius: "md",
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "1536px",
        overflow: "auto",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles: Record<string, any> = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "30px",
            zIndex: 2,
            borderLeft: "1px solid #F3F3F3",
            boxShadow: "1px -2px 4px 0px #00000040",
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontstyle: "regular",
          fontFamily: "Inter",
          color: "#334155",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles: Record<string, any> = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "80px",
            zIndex: 2,
            backgroundColor: "#F8FAFC",
            boxShadow: "0px -2px 4px 0px #00000040",
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          fontstyle: "bold",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #F3F3F3",
          ...extraStyles,
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
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

  // Refetch data when pagination changes
  useEffect(() => {
    if (filtersApplied) {
      refetchFilteredDestination();
    } else {
      refetchDestination();
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

      <Card
        shadow="sm"
        pt="md"
        pb="sm"
        px="md"
        radius="md"
        withBorder
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          flex: 1,
        }}
      >
        <Box>
          <Group justify="space-between" align="center" pb="sm">
            <Group align="center" gap="xs">
              <Text
                size="md"
                fw={600}
                c={"#1E293B"}
                style={{ fontFamily: "Inter", fontSize: "16px" }}
              >
                List of Destination
              </Text>
              {currentDestinationName && (
                <>
                  <Text
                    size="md"
                    fw={600}
                    c={"#1E293B"}
                    style={{ fontFamily: "Inter", fontSize: "16px" }}
                  >
                    for:
                  </Text>
                  <Badge variant="light" color="#105476" size="md">
                    {currentDestinationName}
                  </Badge>
                </>
              )}
            </Group>

            <Group gap="xs" wrap="nowrap">
              {hasSearched && (
                <TextInput
                  placeholder="Search by carrier name"
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
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  disabled={!hasSearched || isDestinationLoading}
                  styles={{
                    input: {
                      fontSize: "13px",
                      height: "36px",
                      borderRadius: "4px",
                      fontFamily: "Inter",
                      fontstyle: "regular",
                      color: "#334155",
                      border: "1px solid #D0D1D4",
                      "&:focus": {
                        border: "1px solid #105476",
                      },
                    },
                  }}
                />
              )}

              {hasSearched && (
                <ActionIcon
                  variant={showFilters ? "filled" : "outline"}
                  size={36}
                  color={showFilters ? "#E0F5FF" : "gray"}
                  onClick={() => setShowFilters(!showFilters)}
                  styles={{
                    root: {
                      borderRadius: "4px",
                      backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                      border: showFilters
                        ? "1px solid #105476"
                        : "1px solid #737780",
                      color: showFilters ? "#105476" : "#737780",
                      "&:active": {
                        border: "1px solid #105476",
                        color: "#FFFFFF",
                      },
                    },
                  }}
                >
                  <IconFilter size={18} />
                </ActionIcon>
              )}

              {hasSearched && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChangeDestination}
                  styles={{
                    root: {
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontWeight: 600,
                      height: "36px",
                      border: "1px solid #D0D1D4",
                      color: "#1E293B",
                    },
                  }}
                >
                  Change Destination
                </Button>
              )}

              {user?.is_staff && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  size="sm"
                  onClick={() => navigate("/tariff/destination/create")}
                  disabled={false}
                  styles={{
                    root: {
                      backgroundColor: "#105476",
                      borderRadius: "4px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontStyle: "semibold",
                      "&:hover": {
                        backgroundColor: "#105476",
                      },
                    },
                  }}
                >
                  Create New
                </Button>
              )}
            </Group>
          </Group>
        </Box>

        {/* Filter Section */}
        {showFilters && hasSearched && (
          <Box
            tt="capitalize"
            mb="sm"
            style={{
              borderRadius: "8px",
              border: "1px solid #E0E0E0",
              flexShrink: 0,
              height: "fit-content",
            }}
          >
            <Group
              justify="space-between"
              align="center"
              mb="sm"
              px="md"
              style={{
                backgroundColor: "#F8FAFC",
                padding: "4px 8px",
                borderRadius: "8px 8px 0 0",
              }}
            >
              <Text
                size="sm"
                fw={600}
                c="#1E293B"
                style={{ fontFamily: "Inter", fontSize: "14px" }}
              >
                Filter
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
                size="sm"
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>

            <Grid gutter="sm" px="md" pt="xs" pb="sm">
              {/* Carrier Name Filter */}
              <Grid.Col span={3}>
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
                  className="filter-searchable-select"
                />
              </Grid.Col>

              {/* Service Filter */}
              <Grid.Col span={3}>
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
                  styles={{
                    input: { fontSize: "13px", height: "36px" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#000000",
                      marginBottom: "4px",
                      fontFamily: "Inter",
                    },
                  }}
                />
              </Grid.Col>

              {/* Valid From Date Filter */}
              <Grid.Col span={3}>
                <SingleDateInput
                  key={`valid-from-${filterForm.values.valid_from}`}
                  label="Valid From"
                  placeholder="YYYY-MM-DD"
                  size="xs"
                  {...filterForm.getInputProps("valid_from")}
                />
              </Grid.Col>

              {/* Valid To Date Filter */}
              <Grid.Col span={3}>
                <SingleDateInput
                  key={`valid-to-${filterForm.values.valid_to}`}
                  label="Valid To"
                  placeholder="YYYY-MM-DD"
                  size="xs"
                  {...filterForm.getInputProps("valid_to")}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
              <Button
                size="sm"
                variant="default"
                onClick={clearAllFilters}
                leftSection={<IconX size={16} />}
                styles={{
                  root: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    height: "36px",
                    border: "1px solid #D0D1D4",
                    color: "#1E293B",
                  },
                }}
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
                leftSection={<IconFilter size={16} />}
                styles={{
                  root: {
                    backgroundColor: "#105476",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    height: "36px",
                    "&:hover": {
                      backgroundColor: "#0d4261",
                    },
                  },
                }}
              >
                Apply Filters
              </Button>
            </Group>
          </Box>
        )}

        {/* Show table only after search and when not in modal */}
        {hasSearched && (
          <>
            {isLoading || filteredDestinationLoading ? (
              <Center py="xl" style={{ flex: 1 }}>
                <Stack align="center" gap="md">
                  <Loader size="lg" color="#105476" />
                  <Text c="dimmed">Loading destination data...</Text>
                </Stack>
              </Center>
            ) : (displayData as Destination[]).length === 0 ? (
              <Box p="xl" style={{ textAlign: "center" }}>
                <Text c="dimmed">
                  No destinations found for {filtersApplied && "this filters"} {!filtersApplied && currentDestinationName && `${currentDestinationName}`}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  mt="md"
                  onClick={handleChangeDestination}
                >
                  Try Different Destination
                </Button>
              </Box>
            ) : (
              <>
                {/* {localSearchTerm && (
                  // <Box mb="md">
                  //   <Text size="sm" c="dimmed">
                  //     Showing {filteredDestinationData.length} of{" "}
                  //     {(destinationVal as Destination[]).length} results
                  //     {localSearchTerm && ` for "${localSearchTerm}"`}
                  //   </Text>
                  // </Box>
                )} */}
                <MantineReactTable table={table} />

                <PaginationBar
                  pageSize={pageSize}
                  currentPage={currentPage}
                  totalRecords={totalRecords}
                  onPageSizeChange={handlePageSizeChange}
                  onPageChange={handlePageChange}
                  pageSizeOptions={["10", "25", "50"]}
                />
              </>
            )}
          </>
        )}

        <Outlet />
      </Card>
    </>
  );
}
