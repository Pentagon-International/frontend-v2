import { useMemo, useState } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  ActionIcon,
  Box,
  Group,
  Button,
  Text,
  Card,
  Center,
  Loader,
  Stack,
  Grid,
  Select,
  Menu,
  UnstyledButton,
  Modal,
  Divider,
  Badge,
  Table,
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
  IconCirclePlus,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { URL } from "../../../api/serverUrls";
import { SearchableSelect } from "../../../components";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "../../../api/axios";
import { postAPICall } from "../../../service/postApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification } from "../../../components";
import dayjs from "dayjs";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";

// Type definitions
type ImportShipmentData = {
  id: number;
  shipment_code: string;
  service_type: string;
  import_to_export: boolean;
  reference: string | null;
  date: string;
  service: string;
  customer_name: string;
  customer_code_read: string;
  origin_name: string;
  origin_code_read: string;
  destination_name: string;
  destination_code_read: string;
  customer_service_name: string;
  freight?: string;
  routed?: string;
  routed_by?: string;
  shipment_terms_name?: string;
  shipment_terms_code_read?: string;
  carrier_name?: string;
  eta?: string;
  etd?: string;
  vessel_name?: string;
  voyage_no?: string;
  shipper_name?: string;
  consignee_name?: string;
  forwarder_name?: string;
  destination_agent_name?: string;
  billing_customer_name?: string;
  notify_customer_name?: string;
  cha_name?: string;
  is_hazardous?: boolean;
  commodity_description?: string | null;
  marks_no?: string | null;
  pickup_location?: string;
  pickup_from_name?: string;
  planned_pickup_date?: string;
  transporter_name?: string;
  delivery_location?: string;
  delivery_from_name?: string;
  planned_delivery_date?: string;
  created_by_name?: string;
  is_direct?: boolean;
  is_coload?: boolean;
  cargo_details?: Array<{
    id: number;
    container_type_name: string;
    no_of_containers: number;
    gross_weight: string;
  }>;
  routing_details?: Array<{
    move_type: string;
    etd: string;
    eta: string;
    flight_no: string;
    status: string;
    from_location_name: string;
    to_location_name: string;
    carrier_name: string;
  }>;
  rate_details?: Array<{
    id: number;
    quotation_no: string;
    charge_name: string;
    pp_cc: string;
    no_of_unit: number;
    sell_amount_total: number | null;
  }>;
};

type FilterState = {
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: Date | null;
};

function AirImportBookingMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Pagination states
  const [pageIndex, setPageIndex] = useState(0); // 0-based index for API
  const [pageSize, setPageSize] = useState(25); // Default page size
  const [totalRecords, setTotalRecords] = useState(0); // Total records from API

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

  const filterForm = useForm<FilterState>({
    initialValues: {
      customer: null,
      service: null,
      origin: null,
      destination: null,
      date: null,
    },
  });

  // Check if we're on the create or edit route
  const isCreateRoute = location.pathname.endsWith("/create");
  const isEditRoute = location.pathname.endsWith("/edit");
  const showMasterTable = !isCreateRoute && !isEditRoute;

  // Check for refetch parameter in URL
  const searchParams = new URLSearchParams(location.search);
  const shouldRefetch = searchParams.get("refetch") === "true";

  // Effect to handle refetch when coming from successful form submission
  useEffect(() => {
    if (shouldRefetch) {
      queryClient.invalidateQueries({
        queryKey: ["air-import-booking/filter/"],
      });

      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("refetch");
      const newSearch = newSearchParams.toString();
      const newPath = newSearch
        ? `${location.pathname}?${newSearch}`
        : location.pathname;

      navigate(newPath, { replace: true });
    }
  }, [
    shouldRefetch,
    queryClient,
    location.search,
    location.pathname,
    navigate,
  ]);

  // Effect to handle refreshData state from navigation
  useEffect(() => {
    if (location.state?.refreshData) {
      const refreshData = async () => {
        try {
          queryClient.removeQueries({
            queryKey: ["air-import-booking/filter/"],
          });
          queryClient.removeQueries({ queryKey: ["filteredAirImportBooking"] });

          await new Promise((resolve) => setTimeout(resolve, 100));

          await queryClient.refetchQueries({
            queryKey: ["air-import-booking/filter/"],
            type: "active",
          });

          if (filtersApplied) {
            await queryClient.refetchQueries({
              queryKey: ["filteredAirImportBooking"],
              type: "active",
            });
          }

          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["air-import-booking/filter/"],
              type: "active",
            });
          }, 300);
        } catch (error) {
          console.error("Error refreshing data:", error);
        }
      };

      refreshData();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, queryClient, navigate, filtersApplied]);

  // Additional effect to ensure data refresh on component mount
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        await queryClient.refetchQueries({
          queryKey: ["air-import-booking/filter/"],
          type: "active",
        });
      } catch (error) {
        console.error("Error refreshing data on mount:", error);
      }
    };

    const timeoutId = setTimeout(refreshOnMount, 200);
    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  // Fetch import shipments data with service="AIR"
  const {
    data: importShipmentsResponse,
    isLoading,
    refetch: refetchImportShipments,
  } = useQuery({
    queryKey: ["air-import-booking/filter/", pageIndex, pageSize],
    queryFn: async () => {
      try {
        // Calculate offset: index should be the number of records to skip
        const offset = pageIndex * pageSize;
        console.log("🔄 Fetching air import booking data...", {
          pageIndex,
          pageSize,
          offset,
        });
        // Build URL with query parameters
        const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`;
        const response = (await apiCallProtected.post(url, {
          filters: {
            service_type: "IMPORT",
            service: "AIR",
          },
        })) as any; // Response interceptor returns data directly
        console.log("📊 Air import booking API response:", response);

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
            "📦 Processed air import booking data:",
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
            index: response.index || offset,
            limit: response.limit || pageSize,
            total_pagination: response.total_pagination || 0,
          };
        }

        return {
          data: [],
          total: 0,
          count: 0,
          index: offset,
          limit: pageSize,
          total_pagination: 0,
        };
      } catch (error) {
        console.error("❌ Error fetching air import booking:", error);
        return {
          data: [],
          total: 0,
          count: 0,
          index: pageIndex * pageSize,
          limit: pageSize,
          total_pagination: 0,
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Extract data and pagination info from response
  const importShipmentsData = importShipmentsResponse?.data || [];
  const totalRecordsFromAPI = importShipmentsResponse?.total || 0;

  // Sync totalRecords with API response
  useEffect(() => {
    if (totalRecordsFromAPI > 0 && !filtersApplied) {
      setTotalRecords(totalRecordsFromAPI);
    }
  }, [totalRecordsFromAPI, filtersApplied]);

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    customer: null,
    service: null,
    origin: null,
    destination: null,
    date: null,
  });

  // Separate query for filtered data
  const {
    data: filteredImportShipmentsResponse,
    isLoading: filteredImportShipmentsLoading,
    refetch: refetchFilteredImportShipments,
  } = useQuery({
    queryKey: [
      "filteredAirImportBooking",
      filtersApplied,
      appliedFilters,
      pageIndex,
      pageSize,
    ],
    queryFn: async () => {
      try {
        if (!filtersApplied) {
          return {
            data: [],
            total: 0,
            count: 0,
            index: pageIndex * pageSize,
            limit: pageSize,
            total_pagination: 0,
          };
        }

        const payload: Record<string, string> = {};

        if (appliedFilters.customer)
          payload.customer_code = appliedFilters.customer;
        if (appliedFilters.service) payload.service = appliedFilters.service;
        if (appliedFilters.origin) payload.origin_code = appliedFilters.origin;
        if (appliedFilters.destination)
          payload.destination_code = appliedFilters.destination;
        if (appliedFilters.date)
          payload.date = dayjs(appliedFilters.date).format("YYYY-MM-DD");

        if (Object.keys(payload)?.length === 0) {
          return {
            data: [],
            total: 0,
            count: 0,
            index: pageIndex * pageSize,
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
            service_type: "IMPORT",
            service: "AIR",
            ...payload,
          },
        })) as any; // Response interceptor returns data directly
        console.log("📊 Filtered air import booking API response:", response);

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
            "📦 Processed filtered air import booking data:",
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
            index: response.index || offset,
            limit: response.limit || pageSize,
            total_pagination: response.total_pagination || 0,
          };
        }

        return {
          data: [],
          total: 0,
          count: 0,
          index: offset,
          limit: pageSize,
          total_pagination: 0,
        };
      } catch (error) {
        console.error("❌ Error fetching filtered air import booking:", error);
        return {
          data: [],
          total: 0,
          count: 0,
          index: pageIndex * pageSize,
          limit: pageSize,
          total_pagination: 0,
        };
      }
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Extract filtered data
  const filteredImportShipmentsData =
    filteredImportShipmentsResponse?.data || [];
  const totalRecordsFromFilteredAPI =
    filteredImportShipmentsResponse?.total || 0;

  // Sync totalRecords with API response (for both filtered and unfiltered)
  useEffect(() => {
    if (filtersApplied && totalRecordsFromFilteredAPI > 0) {
      setTotalRecords(totalRecordsFromFilteredAPI);
    } else if (!filtersApplied && totalRecordsFromAPI > 0) {
      setTotalRecords(totalRecordsFromAPI);
    }
  }, [totalRecordsFromAPI, totalRecordsFromFilteredAPI, filtersApplied]);

  // Determine which data to display
  const displayData = useMemo(() => {
    if (filtersApplied) {
      return filteredImportShipmentsData;
    }
    return importShipmentsData;
  }, [importShipmentsData, filteredImportShipmentsData, filtersApplied]);

  // Loading state
  const isDataLoading = useMemo(() => {
    if (filtersApplied) {
      return filteredImportShipmentsLoading;
    }
    return isLoading;
  }, [isLoading, filteredImportShipmentsLoading, filtersApplied]);

  const applyFilters = async () => {
    try {
      const hasFilterValues =
        filterForm.values.customer ||
        filterForm.values.service ||
        filterForm.values.origin ||
        filterForm.values.destination ||
        filterForm.values.date;

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setAppliedFilters({
          customer: null,
          service: null,
          origin: null,
          destination: null,
          date: null,
        });
        setPageIndex(0); // Reset pagination

        await queryClient.invalidateQueries({
          queryKey: ["air-import-booking/filter/"],
        });
        return;
      }

      // Reset pagination when applying filters
      setPageIndex(0);
      setFiltersApplied(true);
      setAppliedFilters({
        customer: filterForm.values.customer,
        service: filterForm.values.service,
        origin: filterForm.values.origin,
        destination: filterForm.values.destination,
        date: filterForm.values.date,
      });

      await queryClient.invalidateQueries({
        queryKey: ["filteredAirImportBooking"],
      });
      setShowFilters(false);

      await refetchFilteredImportShipments();
    } catch (error) {
      console.error("Error applying filters:", error);
      setShowFilters(false);
    }
  };

  const clearAllFilters = async () => {
    try {
      setShowFilters(false);

      filterForm.reset();
      setFiltersApplied(false);
      setPageIndex(0); // Reset pagination

      setAppliedFilters({
        customer: null,
        service: null,
        origin: null,
        destination: null,
        date: null,
      });

      // Clear display names
      setCustomerDisplayName(null);
      setOriginDisplayName(null);
      setDestinationDisplayName(null);

      await queryClient.invalidateQueries({
        queryKey: ["air-import-booking/filter/"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["filteredAirImportBooking"],
      });
      await queryClient.removeQueries({
        queryKey: ["filteredAirImportBooking"],
      });
    } catch (error) {
      console.error("Error clearing filters:", error);
    } finally {
      setShowFilters(false);
    }
  };

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

  const columns = useMemo<MRT_ColumnDef<ImportShipmentData>[]>(
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
                Air Import Booking Lists
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
                  Loading air import booking...
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

export default AirImportBookingMaster;
