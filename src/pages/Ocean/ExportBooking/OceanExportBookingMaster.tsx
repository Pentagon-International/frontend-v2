import { useMemo, useState, useRef } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Card,
  Center,
  Loader,
  Stack,
  Grid,
  Menu,
  ActionIcon,
  Box,
} from "@mantine/core";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { URL } from "../../../api/serverUrls";
import { searchAPI } from "../../../service/searchApi";
import { SearchableSelect, ToastNotification } from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "../../../api/axios";
import dayjs from "dayjs";
import { useDebouncedValue } from "@mantine/hooks";

// Type definitions
type ExportShipmentData = {
  id: number;
  shipment_code: string;
  date: string;
  service: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  customer_service_name: string;
};

type FilterState = {
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: Date | null;
};

function OceanExportBookingMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  //States
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Pagination states
  const [pageIndex, setPageIndex] = useState(0); // 0-based index for API
  const [pageSize, setPageSize] = useState(25); // Default page size
  const [totalRecords, setTotalRecords] = useState(0); // Total records from API

  // Ref to track if this is the initial mount
  const isInitialMount = useRef(true);

  // Display name states for filter fields
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null
  );
  const [originDisplayName, setOriginDisplayName] = useState<string | null>(
    null
  );
  const [destinationDisplayName, setDestinationDisplayName] = useState<
    string | null
  >(null);

  // State to store the actual applied filter values
  const filterForm = useForm<FilterState>({
    initialValues: {
      customer: null,
      service: null,
      origin: null,
      destination: null,
      date: null,
    },
  });

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 5000);

  // Check if we're on the create or edit route
  const isCreateRoute = location.pathname.endsWith("/create");
  const isEditRoute = location.pathname.endsWith("/edit");
  const showMasterTable = !isCreateRoute && !isEditRoute;

  // Check for refetch parameter in URL
  const searchParams = new URLSearchParams(location.search);
  const shouldRefetch = searchParams.get("refetch") === "true";

  // Build filter payload function
  const buildFilterPayload = () => {
    const values = filterForm.values;
    const payload: any = {};

    if (values.customer) payload.customer_code = values.customer;
    if (values.service) payload.service = values.service;
    if (values.origin) payload.origin_code = values.origin;
    if (values.destination) payload.destination_code = values.destination;
    if (values.date) payload.date = dayjs(values.date).format("YYYY-MM-DD");

    return payload;
  };

  // Fetch export shipments data using filter endpoint with service=["FCL", "LCL"]
  const {
    data: exportShipmentsResponse,
    isLoading,
    refetch: refetchExportShipments,
  } = useQuery({
    queryKey: ["ocean-export-booking/filter/", pageIndex, pageSize],
    queryFn: async () => {
      try {
        // Calculate offset: index should be the number of records to skip
        const offset = pageIndex * pageSize;
        //console.log("🔄 Fetching ocean export booking data...", {
        //   pageIndex,
        //   pageSize,
        //   offset,
        // });
        // Build URL with query parameters
        const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`;
        const response = (await apiCallProtected.post(url, {
          filters: {
            service_type: "EXPORT",
            service: ["FCL", "LCL"],
          },
        })) as any; // Response interceptor returns data directly
        console.log("📊 Ocean export booking API response:", response);

        // Handle response structure with pagination metadata
        if (response && typeof response === "object") {
          // Update total records from response
          if (response.total !== undefined) {
            setTotalRecords(response.total);
          }

          // Extract data array
          let data = [];
          if (Array.isArray(response.data)) {
            data = response.data;
          } else if (Array.isArray(response.results)) {
            data = response.results;
          } else if (Array.isArray(response.result)) {
            data = response.result;
          } else if (Array.isArray(response)) {
            data = response;
          }

          console.log(
            "📦 Processed ocean export booking data:",
            data,
            "Length:",
            data.length,
            "Total:",
            response.total
          );

          return {
            data,
            total: response.total || 0,
            count: response.count || data.length,
            index: response.index || pageIndex,
            limit: response.limit || pageSize,
            total_pagination: response.total_pagination || 0,
          };
        }

        return {
          data: [],
          total: 0,
          count: 0,
          index: pageIndex,
          limit: pageSize,
          total_pagination: 0,
        };
      } catch (error) {
        console.error("❌ Error fetching ocean export booking:", error);
        return {
          data: [],
          total: 0,
          count: 0,
          index: pageIndex,
          limit: pageSize,
          total_pagination: 0,
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Enable refetch on mount to load data initially
  });

  // Extract data and pagination info from response
  const exportShipmentsData = exportShipmentsResponse?.data || [];
  const totalRecordsFromAPI = exportShipmentsResponse?.total || 0;

  // Sync totalRecords with API response
  useEffect(() => {
    if (totalRecordsFromAPI > 0 && !filtersApplied) {
      setTotalRecords(totalRecordsFromAPI);
    }
  }, [totalRecordsFromAPI, filtersApplied]);

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredExportShipmentsResponse,
    isLoading: filteredExportShipmentsLoading,
    refetch: refetchFilteredExportShipments,
  } = useQuery({
    queryKey: [
      "filteredOceanExportBooking",
      filterForm.values,
      pageIndex,
      pageSize,
    ],
    queryFn: async () => {
      const payload = buildFilterPayload();
      if (Object.keys(payload).length === 0) {
        return {
          data: [],
          total: 0,
          count: 0,
          index: pageIndex,
          limit: pageSize,
          total_pagination: 0,
        };
      }

      // Calculate offset: index should be the number of records to skip
      const offset = pageIndex * pageSize;
      // Build URL with query parameters
      const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`;
      const response = (await apiCallProtected.post(url, {
        filters: {
          service_type: "EXPORT",
          service: ["FCL", "LCL"],
          ...payload,
        },
      })) as any; // Response interceptor returns data directly
      console.log("📊 Filtered ocean export booking API response:", response);

      // Handle response structure with pagination metadata
      if (response && typeof response === "object") {
        // Update total records from response
        if (response.total !== undefined) {
          setTotalRecords(response.total);
        }

        // Extract data array
        let data = [];
        if (Array.isArray(response.data)) {
          data = response.data;
        } else if (Array.isArray(response.results)) {
          data = response.results;
        } else if (Array.isArray(response.result)) {
          data = response.result;
        } else if (Array.isArray(response)) {
          data = response;
        }

        console.log(
          "📦 Processed filtered ocean export booking data:",
          data,
          "Length:",
          data.length,
          "Total:",
          response.total
        );

        return {
          data,
          total: response.total || 0,
          count: response.count || data.length,
          index: response.index || pageIndex,
          limit: response.limit || pageSize,
          total_pagination: response.total_pagination || 0,
        };
      }

      return {
        data: [],
        total: 0,
        count: 0,
        index: pageIndex,
        limit: pageSize,
        total_pagination: 0,
      };
    },
    enabled: false,
  });

  // Extract filtered data
  const filteredExportShipmentsData =
    filteredExportShipmentsResponse?.data || [];
  const totalRecordsFromFilteredAPI =
    filteredExportShipmentsResponse?.total || 0;

  // Sync totalRecords with API response (for both filtered and unfiltered)
  useEffect(() => {
    if (filtersApplied && totalRecordsFromFilteredAPI > 0) {
      setTotalRecords(totalRecordsFromFilteredAPI);
    } else if (!filtersApplied && totalRecordsFromAPI > 0) {
      setTotalRecords(totalRecordsFromAPI);
    }
  }, [totalRecordsFromAPI, totalRecordsFromFilteredAPI, filtersApplied]);

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["oceanExportBookingSearch", debounced],
    queryFn: async () => {
      if (!debounced.trim()) return null;
      try {
        const result = await searchAPI(debounced, new AbortController().signal);
        return result;
      } catch (error) {
        console.error("Search API Error:", error);
        return null;
      }
    },
    enabled: debounced.trim() !== "",
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Determine which data to display
  const displayData = useMemo(() => {
    let data = [];
    if (debounced.trim() !== "" && searchData) {
      data = searchData;
      console.log("📊 Using search data:", data);
    } else if (filtersApplied && Object.keys(buildFilterPayload()).length > 0) {
      data = filteredExportShipmentsData;
      console.log("📊 Using filtered data:", data);
    } else {
      data = exportShipmentsData;
      console.log("📊 Using default export shipments data:", data);
    }
    console.log("📊 Final displayData:", data, "Length:", data?.length);
    return Array.isArray(data) ? data : [];
  }, [
    debounced,
    searchData,
    exportShipmentsData,
    filteredExportShipmentsData,
    filtersApplied,
    filterForm.values, // Use filterForm.values instead of buildFilterPayload function
  ]);

  // Loading state
  const isDataLoading =
    searchLoading ||
    (filtersApplied ? filteredExportShipmentsLoading : isLoading);

  console.log("🔄 Loading states:", {
    searchLoading,
    filteredExportShipmentsLoading,
    isLoading,
    filtersApplied,
    isDataLoading,
  });

  // Effect to handle refetch when coming from successful form submission
  useEffect(() => {
    if (shouldRefetch) {
      // Refetch the export shipments data
      queryClient.invalidateQueries({
        queryKey: ["ocean-export-booking/filter/"],
      });

      // Remove the refetch parameter from URL to prevent unnecessary refetches on subsequent visits
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("refetch");
      const newSearch = newSearchParams.toString();
      const newPath = newSearch
        ? `${location.pathname}?${newSearch}`
        : location.pathname;

      // Replace the current URL to remove the refetch parameter
      navigate(newPath, { replace: true });
    }
  }, [
    shouldRefetch,
    queryClient,
    location.search,
    location.pathname,
    navigate,
  ]);

  // Reset filtersApplied when search is cleared
  useEffect(() => {
    if (debounced.trim() === "" && searchQuery.trim() === "") {
      setFiltersApplied(false);
    }
  }, [debounced, searchQuery]);

  // Effect to handle refreshData state from navigation
  useEffect(() => {
    console.log("refresh data----", location.state?.refreshData);

    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation");

      // Refresh export shipments data
      const refreshData = async () => {
        try {
          console.log(
            "🔄 Starting aggressive data refresh for ocean export booking..."
          );

          // Remove all cached data first
          queryClient.removeQueries({
            queryKey: ["ocean-export-booking/filter/"],
          });
          queryClient.removeQueries({
            queryKey: ["filteredOceanExportBooking"],
          });

          // Wait a moment for cleanup
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Refresh all quotation data
          if (filtersApplied && Object.keys(buildFilterPayload()).length > 0) {
            refetchFilteredExportShipments();
          } else {
            refetchExportShipments();
          }

          // Additional refetch to ensure UI updates
          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["ocean-export-booking/filter/"],
              type: "active",
            });
            console.log(
              "✅ Ocean export booking data refresh completed with additional refetch"
            );
          }, 200);

          console.log("✅ Ocean export booking data refresh completed");
        } catch (error) {
          console.error("Error refreshing ocean export booking data:", error);
        }
      };

      refreshData();

      // Clear the refresh flag after starting the refresh process
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state,
    refetchFilteredExportShipments,
    refetchExportShipments,
    navigate,
    location.pathname,
  ]);

  // Additional effect to ensure data refresh on component mount
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        // Always refetch data when component mounts to ensure fresh data
        await queryClient.refetchQueries({
          queryKey: ["ocean-export-booking/filter/"],
          type: "active",
        });
        console.log(
          "🔄 Ocean export booking data refreshed on component mount"
        );
      } catch (error) {
        console.error(
          "Error refreshing ocean export booking data on mount:",
          error
        );
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(refreshOnMount, 100);

    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    // PaginationBar uses 1-based page numbers, convert to 0-based index
    const newIndex = page - 1;
    setPageIndex(newIndex);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0); // Reset to first page when page size changes
  };

  // Effect to refetch data when pageSize or pageIndex changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // When pagination changes, refetch the appropriate query
    if (filtersApplied) {
      const hasFilterValues =
        filterForm.values.customer ||
        filterForm.values.service ||
        filterForm.values.origin ||
        filterForm.values.destination ||
        filterForm.values.date;

      if (hasFilterValues) {
        // If filters are applied, manually refetch filtered query (it's disabled by default)
        refetchFilteredExportShipments();
      }
    }
    // Note: Main query will automatically refetch when pageSize/pageIndex changes
    // because they're in the queryKey, so we don't need to manually trigger it
  }, [
    pageSize,
    pageIndex,
    filtersApplied,
    refetchFilteredExportShipments,
    filterForm.values,
  ]);

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      const formValues = filterForm.values;
      console.log("Current filters:", formValues);

      const hasFilterValues =
        formValues.customer ||
        formValues.service ||
        formValues.origin ||
        formValues.destination ||
        formValues.date;

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0); // Reset pagination

        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      // ✅ Reset pagination when applying filters
      setPageIndex(0);
      // ✅ set state first
      setFiltersApplied(true);

      // ✅ Trigger API refetch and wait for it
      const { data } = await refetchFilteredExportShipments();

      // ✅ Toast only after success
      ToastNotification({
        type: "success",
        message:
          data?.data && data.data.length > 0
            ? "Filters applied successfully"
            : "No matching data found",
      });

      console.log("Filters applied successfully");
    } catch (error) {
      ToastNotification({
        type: "error",
        message: "Error applying filters",
      });
      console.error("Error applying filters:", error);
    } finally {
      setShowFilters(false);
    }
  };

  const clearAllFilters = async () => {
    try {
      setShowFilters(false);

      const formValues = filterForm.values;
      const hasFilterValues =
        formValues.customer ||
        formValues.service ||
        formValues.origin ||
        formValues.destination ||
        formValues.date;

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0); // Reset pagination

        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }
      filterForm.reset(); // Reset form to initial values
      setFiltersApplied(false); // Reset filters applied state
      setSearchQuery("");
      setPageIndex(0); // Reset pagination

      // Clear display names
      setCustomerDisplayName(null);
      setOriginDisplayName(null);
      setDestinationDisplayName(null);

      // Invalidate queries and refetch unfiltered data
      await queryClient.invalidateQueries({
        queryKey: ["ocean-export-booking/filter/"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["filteredOceanExportBooking"],
      });
      queryClient.removeQueries({ queryKey: ["filteredOceanExportBooking"] }); // Remove filtered data from cache
      ToastNotification({
        type: "success",
        message: "All filters cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing filters:", error);
      setShowFilters(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<ExportShipmentData>[]>(
    () => [
      {
        accessorKey: "shipment_code",
        header: "Booking ID",
        size: 150,
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
      },
      {
        accessorKey: "service",
        header: "Service",
        size: 100,
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 150,
      },
      {
        accessorKey: "origin_name",
        header: "Origin",
        size: 150,
      },
      {
        accessorKey: "destination_name",
        header: "Destination",
        size: 150,
      },
      {
        accessorKey: "customer_service_name",
        header: "Customer Service",
        size: 150,
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => (
          <Menu shadow="md" width={120}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                onClick={() => {
                  navigate(`./edit`, {
                    state: { job: row.original },
                  });
                }}
              >
                Edit
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate]
  );

  const table = useMantineReactTable({
    columns,
    data: displayData,
    enableColumnFilters: false,
    enablePagination: false, // Disable built-in pagination - using server-side pagination
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
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
      p: "md",
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
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "30px",
          zIndex: 2,
          borderLeft: "1px solid #F3F3F3",
          boxShadow: "1px -2px 4px 0px #00000040",
        };
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
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "80px",
          zIndex: 2,
          backgroundColor: "#FBFBFB",
          boxShadow: "0px -2px 4px 0px #00000040",
        };
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
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="dimmed" size="lg">
                No data to display
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

  return (
    <>
      {showMasterTable && (
        <Card
          shadow="sm"
          pt="md"
          pb="sm"
          px="lg"
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
          <Box mb="md">
            <Group justify="space-between" align="center" mb="md">
              <Text
                size="md"
                fw={600}
                c={"#444955"}
                style={{ fontFamily: "Inter", fontSize: "16px" }}
              >
                Sea Export Booking Lists
              </Text>

              <Group gap="xs" wrap="nowrap">
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
                    },
                  }}
                >
                  <IconFilter size={18} />
                </ActionIcon>

                <Button
                  leftSection={<IconPlus size={16} />}
                  size="sm"
                  styles={{
                    root: {
                      backgroundColor: "#105476",
                      borderRadius: "4px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontstyle: "semibold",
                      "&:hover": {
                        backgroundColor: "#105476",
                      },
                    },
                  }}
                  onClick={() => navigate("./create")}
                >
                  Create New
                </Button>
              </Group>
            </Group>
          </Box>

          {/* Filter Section */}
          {showFilters && (
            <Box
              mb="xs"
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
                mb="lg"
                style={{
                  backgroundColor: "#FAFAFA",
                  padding: "8px 8px",
                  borderRadius: "8px",
                }}
              >
                <Text
                  size="sm"
                  fw={600}
                  c="#000000"
                  style={{ fontFamily: "Inter", fontSize: "14px" }}
                >
                  Filters
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

              <Grid gutter="md" px="md">
                {/* Customer Name Filter */}
                <Grid.Col span={2.4}>
                  <SearchableSelect
                    size="xs"
                    label="Customer Name"
                    placeholder="Type customer name"
                    apiEndpoint={URL.customer}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={filterForm.values.customer}
                    displayValue={customerDisplayName}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("customer", value || "");
                      setCustomerDisplayName(selectedData?.label || null);
                    }}
                    minSearchLength={2}
                  />
                </Grid.Col>

                {/* Date Filter */}
                <Grid.Col span={2.4}>
                  <DateInput
                    key={`date-${filterForm.values.date}`}
                    label="Date"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    {...filterForm.getInputProps("date")}
                    valueFormat="YYYY-MM-DD"
                    leftSection={<IconCalendar size={14} />}
                    leftSectionPointerEvents="none"
                    radius="md"
                    nextIcon={<IconChevronRight size={16} />}
                    previousIcon={<IconChevronLeft size={16} />}
                    clearable
                    styles={
                      {
                        input: {
                          fontSize: "13px",
                          height: "36px",
                          fontFamily: "Inter",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#000000",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                        },
                        calendar: {
                          padding: "1rem",
                          gap: "0.5rem",
                          minWidth: "300px",
                        },
                        day: {
                          width: "2.5rem",
                          height: "2.5rem",
                          fontSize: "0.9rem",
                          margin: "0.1rem",
                        },
                        calendarHeaderLevel: {
                          fontSize: "1rem",
                          fontWeight: 500,
                          marginBottom: "0.8rem",
                          flex: 1,
                          textAlign: "center",
                        },
                        calendarHeaderControl: {
                          width: "2.2rem",
                          height: "2.2rem",
                          margin: "0 0.5rem",
                        },
                        calendarHeader: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          marginBottom: "0.5rem",
                        },
                        monthsListControl: {
                          width: "2.5rem",
                          height: "2.5rem",
                          fontSize: "0.9rem",
                        },
                        yearsListControl: {
                          width: "2.5rem",
                          height: "2.5rem",
                          fontSize: "0.9rem",
                        },
                      } as any
                    }
                  />
                </Grid.Col>

                {/* Origin Filter */}
                <Grid.Col span={2.4}>
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
                    value={filterForm.values.origin}
                    displayValue={originDisplayName}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("origin", value || "");
                      setOriginDisplayName(selectedData?.label || null);
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                  />
                </Grid.Col>

                {/* Destination Filter */}
                <Grid.Col span={2.4}>
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
                    value={filterForm.values.destination}
                    displayValue={destinationDisplayName}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("destination", value || "");
                      setDestinationDisplayName(selectedData?.label || null);
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                  />
                </Grid.Col>
              </Grid>

              <Group justify="end" mt="md" p="md" pb="md">
                <Button
                  size="xs"
                  variant="outline"
                  styles={{
                    root: {
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontstyle: "semibold",
                      color: "#105476",
                      borderColor: "#105476",
                      "&:hover": {
                        backgroundColor: "#f8f9fa",
                      },
                    },
                  }}
                  leftSection={<IconX size={14} />}
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </Button>
                <Button
                  size="xs"
                  variant="filled"
                  styles={{
                    root: {
                      backgroundColor: "#105476",
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontFamily: "Inter",
                      fontstyle: "semibold",
                      "&:hover": {
                        backgroundColor: "#105476",
                      },
                    },
                  }}
                  leftSection={
                    isDataLoading ? (
                      <Loader size={14} />
                    ) : (
                      <IconFilter size={14} />
                    )
                  }
                  onClick={applyFilters}
                  loading={isDataLoading}
                  disabled={isDataLoading}
                >
                  Apply Filters
                </Button>
              </Group>
            </Box>
          )}

          {isDataLoading ? (
            <Center py="xl">
              <Stack align="center" gap="md">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                  Loading sea export booking...
                </Text>
              </Stack>
            </Center>
          ) : (
            <>
              <MantineReactTable
                key={`table-${filtersApplied ? "filtered" : "unfiltered"}-${displayData.length}`}
                table={table}
              />

              {/* Pagination Bar */}
              <PaginationBar
                pageSize={pageSize}
                currentPage={pageIndex + 1} // Convert 0-based to 1-based for PaginationBar
                totalRecords={totalRecords}
                onPageSizeChange={handlePageSizeChange}
                onPageChange={handlePageChange}
                pageSizeOptions={["10", "25", "50"]}
              />
            </>
          )}
        </Card>
      )}
      <Outlet />
    </>
  );
}

export default OceanExportBookingMaster;
