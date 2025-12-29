import { useMemo, useState } from "react";
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
  Select,
  TextInput,
  Menu,
  ActionIcon,
} from "@mantine/core";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconFilterOff,
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconEdit,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { URL } from "../../../api/serverUrls";
import { searchAPI } from "../../../service/searchApi";
import { SearchableSelect, ToastNotification } from "../../../components";
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

function AirExportBookingMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  //States
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Display name states for filter fields
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(null);
  const [originDisplayName, setOriginDisplayName] = useState<string | null>(null);
  const [destinationDisplayName, setDestinationDisplayName] = useState<string | null>(null);

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

  // Fetch export shipments data using filter endpoint with service="AIR"
  const {
    data: exportShipmentsData = [],
    isLoading,
    refetch: refetchExportShipments,
  } = useQuery({
    queryKey: ["air-export-booking/filter/"],
    queryFn: async () => {
      try {
        const response = await apiCallProtected.post(
          URL.customerServiceShipmentFilter,
          {
            filters: {
              service_type: "EXPORT",
              service: "AIR",
            },
          }
        );
        return response?.data || [];
      } catch (error) {
        console.error("Error fetching air export booking:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredExportShipmentsData = [],
    isLoading: filteredExportShipmentsLoading,
    refetch: refetchFilteredExportShipments,
  } = useQuery({
    queryKey: ["filteredAirExportBooking"],
    queryFn: async () => {
      const payload = buildFilterPayload();
      if (Object.keys(payload).length === 0) return [];

      const response = await apiCallProtected.post(
        URL.customerServiceShipmentFilter,
        {
          filters: {
            service_type: "EXPORT",
            service: "AIR",
            ...payload,
          },
        }
      );
      return response?.data || [];
    },
    enabled: false,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["airExportBookingSearch", debounced],
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
    if (debounced.trim() !== "" && searchData) {
      return searchData;
    }
    if (filtersApplied && Object.keys(buildFilterPayload()).length > 0) {
      return filteredExportShipmentsData;
    }
    return exportShipmentsData;
  }, [
    debounced,
    searchData,
    exportShipmentsData,
    filteredExportShipmentsData,
    filtersApplied,
  ]);

  // Loading state
  const isDataLoading =
    searchLoading ||
    (filtersApplied ? filteredExportShipmentsLoading : isLoading);

  // Effect to handle refetch when coming from successful form submission
  useEffect(() => {
    if (shouldRefetch) {
      // Refetch the export shipments data
      queryClient.invalidateQueries({
        queryKey: ["air-export-booking/filter/"],
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
            "🔄 Starting aggressive data refresh for air export booking..."
          );

          // Remove all cached data first
          queryClient.removeQueries({
            queryKey: ["air-export-booking/filter/"],
          });
          queryClient.removeQueries({ queryKey: ["filteredAirExportBooking"] });

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
              queryKey: ["air-export-booking/filter/"],
              type: "active",
            });
            console.log(
              "✅ Air export booking data refresh completed with additional refetch"
            );
          }, 200);

          console.log("✅ Air export booking data refresh completed");
        } catch (error) {
          console.error("Error refreshing air export booking data:", error);
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
          queryKey: ["air-export-booking/filter/"],
          type: "active",
        });
        console.log("🔄 Air export booking data refreshed on component mount");
      } catch (error) {
        console.error(
          "Error refreshing air export booking data on mount:",
          error
        );
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(refreshOnMount, 100);

    return () => clearTimeout(timeoutId);
  }, [queryClient]);

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

        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      // ✅ set state first
      setFiltersApplied(true);

      // ✅ Trigger API refetch and wait for it
      const { data } = await refetchFilteredExportShipments();

      // ✅ Toast only after success
      ToastNotification({
        type: "success",
        message:
          data && data.length > 0
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

        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }
      filterForm.reset(); // Reset form to initial values
      setFiltersApplied(false); // Reset filters applied state
      setSearchQuery("");
      
      // Clear display names
      setCustomerDisplayName(null);
      setOriginDisplayName(null);
      setDestinationDisplayName(null);

      // Invalidate queries and refetch unfiltered data
      await queryClient.invalidateQueries({
        queryKey: ["air-export-booking/filter/"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["filteredAirExportBooking"],
      });
      queryClient.removeQueries({ queryKey: ["filteredAirExportBooking"] }); // Remove filtered data from cache
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
      style: { width: "100%" },
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "#ffffff",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #e9ecef",
      },
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
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="center" mb="md" wrap="nowrap">
            <Text size="md" fw={600} c="#105476">
              Air Export Booking Lists
            </Text>

            <Group gap="sm" wrap="nowrap">
              <Button
                variant={showFilters ? "filled" : "outline"}
                leftSection={<IconFilter size={16} />}
                size="xs"
                color="#105476"
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </Button>
              <Button
                variant="filled"
                leftSection={<IconPlus size={14} />}
                size="xs"
                color="#105476"
                onClick={() => navigate("./create")}
              >
                Create New
              </Button>
            </Group>
          </Group>

          {showFilters && (
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
                </Grid.Col>
              </Grid>

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
            </Card>
          )}

          {isDataLoading ? (
            <Center py="xl">
              <Stack align="center" gap="md">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Loading air export booking...</Text>
              </Stack>
            </Center>
          ) : (
            <>
              <MantineReactTable table={table} />
            </>
          )}
        </Card>
      )}
      <Outlet />
    </>
  );
}

export default AirExportBookingMaster;
