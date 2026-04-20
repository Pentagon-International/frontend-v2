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
  Center,
  Flex,
  Group,
  Loader,
  Menu,
  Modal,
  Popover,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  Grid,
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
  IconX,
} from "@tabler/icons-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ToastNotification, SearchableSelect, DateRangeInput, SingleDateInput } from "../../../components";
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
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import useDateFormat from "../../../hooks/useDateFormat";

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
    queryKey: ["origin", currentOriginCode, pageSize],
    queryFn: async () => {
      try {
        const requestBody: { filters: any } = { filters: {} };

        // Add origin_code filter if origin is selected from modal (use port code)
        if (currentOriginCode) {
          requestBody.filters.origin_code = currentOriginCode;
        }

        const response = await apiCallProtected.post(
          `${URL.filter_origin}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        // Handle response - API returns { results: [...] } or { result: [...] }
        // Handle response - API returns { data: [...], total: ... } or { results: [...], total: ... }
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        } else if (data && Array.isArray(data.results)) {
          setTotalRecords(data.total || data.results.length);
          return data.results;
        } else if (data && Array.isArray(data.result)) {
          setTotalRecords(data.total || data.result.length);
          return data.result;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching origin data:", error);
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
    data: filteredOriginData = [],
    isLoading: filteredOriginLoading,
    refetch: refetchFilteredOrigin,
  } = useQuery({
    queryKey: ["filteredOrigin", filtersApplied, appliedFilters, currentOriginCode, pageSize],
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
          `${URL.filter_origin}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
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
        console.error("Error fetching filtered origin data:", error);
        setTotalRecords(0);
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
                    navigate("/tariff/origin/create", {
                      state: {
                        ...row.original,
                        actionType: "view",
                      },
                    })
                  }
                >
                  <Group gap={"sm"}>
                    <IconEyeSpark size={16} style={{ color: "#2563EB" }} />
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
                        <IconEdit size={16} style={{ color: "#2563EB" }} />
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
          color: "#333740",
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
            backgroundColor: "#FBFBFB",
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
          color: "#444955",
          backgroundColor: "#FBFBFB",
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
        refetchFilteredOrigin();
      } else {
        refetchOrigin();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageSize]);
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
                color="#2563EB"
              >
                {isChangeOriginMode ? "Change" : "Submit"}
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
                c={"#444955"}
                style={{ fontFamily: "Inter", fontSize: "16px" }}
              >
                List of Origin
              </Text>
              {currentOriginName && (
                <>
                  <Text
                    size="md"
                    fw={600}
                    c={"#444955"}
                    style={{ fontFamily: "Inter", fontSize: "16px" }}
                  >
                    for:
                  </Text>
                  <Badge variant="light" color="#2563EB" size="md">
                    {currentOriginName}
                  </Badge>
                </>
              )}
            </Group>

            <Group gap="xs" wrap="nowrap">
              {hasSearched && (
                <TextInput
                  placeholder="Search in origin name"
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
                  disabled={!hasSearched || isOriginLoading}
                  styles={{
                    input: {
                      fontSize: "13px",
                      height: "36px",
                      borderRadius: "4px",
                      fontFamily: "Inter",
                      fontstyle: "regular",
                      color: "#333740",
                      border: "1px solid #D0D1D4",
                      "&:focus": {
                        border: "1px solid #2563EB",
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
                        ? "1px solid #2563EB"
                        : "1px solid #737780",
                      color: showFilters ? "#2563EB" : "#737780",
                      "&:active": {
                        border: "1px solid #2563EB",
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
                  onClick={handleChangeOrigin}
                  styles={{
                    root: {
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontWeight: 600,
                      height: "36px",
                      border: "1px solid #D0D1D4",
                      color: "#444955",
                    },
                  }}
                >
                  Change Origin
                </Button>
              )}

              {user?.is_staff && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  size="sm"
                  onClick={() => navigate("/tariff/origin/create")}
                  disabled={false}
                  styles={{
                    root: {
                      backgroundColor: "#2563EB",
                      borderRadius: "4px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontStyle: "semibold",
                      "&:hover": {
                        backgroundColor: "#2563EB",
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
                backgroundColor: "#FAFAFA",
                padding: "4px 8px",
                borderRadius: "8px 8px 0 0",
              }}
            >
              <Text
                size="sm"
                fw={600}
                c="#000000"
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
                    color: "#444955",
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
                    backgroundColor: "#2563EB",
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
            {isLoading || filteredOriginLoading ? (
              <Center py="xl" style={{ flex: 1 }}>
                <Stack align="center" gap="md">
                  <Loader size="lg" color="#2563EB" />
                  <Text c="dimmed">Loading origin data...</Text>
                </Stack>
              </Center>
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

                <PaginationBar
                  pageSize={pageSize}
                  currentPage={currentPage}
                  totalRecords={totalRecords}
                  onPageSizeChange={handlePageSizeChange}
                  onPageChange={handlePageChange}
                  pageSizeOptions={["10", "25", "50"]}
                />

                {/* Custom Pagination Bar */}
                {/* <Group
                  w="100%"
                  justify="space-between"
                  align="center"
                  pt="sm"
                  pl="sm"
                  pr="xl"
                  style={{ borderTop: "1px solid #e9ecef", flexShrink: 0 }}
                  wrap="nowrap"
                  mt="sm"
                >
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
                      styles={{ input: { fontSize: 12, height: 30 } }}
                    />
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const total =
                          totalRecords || filteredOriginDataForDisplay.length || 0;
                        if (total === 0) return "0–0 of 0";
                        const start = (currentPage - 1) * pageSize + 1;
                        const end = Math.min(currentPage * pageSize, total);
                        return `${start}–${end} of ${total}`;
                      })()}
                    </Text>
                  </Group>

                  <Group gap="xs" align="center" wrap="nowrap">
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
                      of{" "}
                      {Math.max(
                        1,
                        Math.ceil(
                          (totalRecords || filteredOriginDataForDisplay.length || 0) /
                            pageSize
                        )
                      )}
                    </Text>
                    <ActionIcon
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil(
                            (totalRecords || filteredOriginDataForDisplay.length || 0) /
                              pageSize
                          )
                        );
                        handlePageChange(Math.min(totalPages, currentPage + 1));
                      }}
                      disabled={(() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil(
                            (totalRecords || filteredOriginDataForDisplay.length || 0) /
                              pageSize
                          )
                        );
                        return currentPage >= totalPages;
                      })()}
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Group> */}
              </>
            )}
          </>
        )}

        <Outlet />
      </Card>
    </>
  );
}
