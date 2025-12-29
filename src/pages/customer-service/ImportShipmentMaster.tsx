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
  IconFilterOff,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
  IconCirclePlus,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { URL } from "../../api/serverUrls";
import { SearchableSelect } from "../../components";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "../../api/axios";
import { postAPICall } from "../../service/postApiCall";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification } from "../../components";
import dayjs from "dayjs";
import PaginationBar from "../../components/PaginationBar/PaginationBar";

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

function ImportShipmentMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  // const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  // const [selectedBooking, setSelectedBooking] =
  //   useState<ImportShipmentData | null>(null);
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [listTotalRecords, setListTotalRecords] = useState(0);

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
      // Refetch the import shipments data
      queryClient.invalidateQueries({ queryKey: ["import-shipment/filter/"] });

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

  // Effect to handle refreshData state from navigation
  useEffect(() => {
    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation", {
        timestamp: location.state.timestamp,
        currentTime: Date.now(),
      });

      // Refresh import shipments data
      const refreshData = async () => {
        try {
          console.log(
            "🔄 Starting aggressive data refresh for import shipments..."
          );

          // Remove all cached data first
          queryClient.removeQueries({ queryKey: ["import-shipment/filter/"] });
          queryClient.removeQueries({ queryKey: ["filteredImportShipments"] });

          // Clear all queries related to import shipments
          queryClient.clear();

          // Wait a moment for cleanup
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Force refetch with fresh data
          await queryClient.refetchQueries({
            queryKey: ["import-shipment/filter/"],
            type: "active",
          });

          // If filters are applied, also refresh filtered data
          if (filtersApplied) {
            await queryClient.refetchQueries({
              queryKey: ["filteredImportShipments"],
              type: "active",
            });
          }

          // Multiple additional refetches to ensure UI updates
          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["import-shipment/filter/"],
              type: "active",
            });
            console.log(
              "✅ Data refresh completed with first additional refetch"
            );
          }, 300);

          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["import-shipment/filter/"],
              type: "active",
            });
            console.log(
              "✅ Data refresh completed with second additional refetch"
            );
          }, 600);

          console.log("✅ Data refresh completed");
        } catch (error) {
          console.error("Error refreshing data:", error);
        }
      };

      refreshData();

      // Clear the refresh flag after starting the refresh process
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, queryClient, navigate, filtersApplied]);

  // Additional effect to ensure data refresh on component mount
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        console.log("🔄 Refreshing data on component mount...");

        // Always refetch data when component mounts to ensure fresh data
        await queryClient.refetchQueries({
          queryKey: ["import-shipment/filter/"],
          type: "active",
        });

        // Additional refetch after a delay to ensure UI consistency
        setTimeout(async () => {
          await queryClient.refetchQueries({
            queryKey: ["import-shipment/filter/"],
            type: "active",
          });
          console.log(
            "✅ Data refreshed on component mount with additional refetch"
          );
        }, 500);

        console.log("🔄 Data refreshed on component mount");
      } catch (error) {
        console.error("Error refreshing data on mount:", error);
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(refreshOnMount, 200);

    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  // Fetch import shipments data using filter endpoint with empty body
  const { data: importShipmentsData = [], isLoading } = useQuery({
    queryKey: ["import-shipment/filter/"],
    queryFn: async () => {
      try {
        const response = await apiCallProtected.post(
          URL.customerServiceShipmentFilter,
          {
            filters: {
              service_type: "IMPORT",
            },
          }
        );
        return (response?.data as ImportShipmentData[]) || [];
      } catch (error) {
        console.error("Error fetching import shipments:", error);
        return [];
      }
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    customer: null,
    service: null,
    origin: null,
    destination: null,
    date: null,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredImportShipmentsData = [],
    isLoading: filteredImportShipmentsLoading,
    refetch: refetchFilteredImportShipments,
  } = useQuery({
    queryKey: ["filteredImportShipments", filtersApplied, appliedFilters],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        const payload: Record<string, string> = {};

        if (appliedFilters.customer)
          payload.customer_code = appliedFilters.customer;
        if (appliedFilters.service) payload.service = appliedFilters.service;
        if (appliedFilters.origin) payload.origin_code = appliedFilters.origin;
        if (appliedFilters.destination)
          payload.destination_code = appliedFilters.destination;
        if (appliedFilters.date)
          payload.date = dayjs(appliedFilters.date).format("YYYY-MM-DD");

        if (Object.keys(payload)?.length === 0) return [];

        const response = await apiCallProtected.post(
          URL.customerServiceShipmentFilter,
          {
            filters: {
              service_type: "IMPORT",
              ...payload,
            },
          }
        );
        return (response?.data as ImportShipmentData[]) || [];
      } catch (error) {
        console.error("Error fetching filtered import shipments:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

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
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values
      const hasFilterValues =
        filterForm.values.customer ||
        filterForm.values.service ||
        filterForm.values.origin ||
        filterForm.values.destination ||
        filterForm.values.date;

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setAppliedFilters({
          customer: null,
          service: null,
          origin: null,
          destination: null,
          date: null,
        });

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({
          queryKey: ["import-shipment/filter/"],
        });

        console.log("No filter values provided, showing unfiltered data");
        return;
      }

      setFiltersApplied(true); // Mark filters as applied

      // Store the current filter form values as applied filters
      setAppliedFilters({
        customer: filterForm.values.customer,
        service: filterForm.values.service,
        origin: filterForm.values.origin,
        destination: filterForm.values.destination,
        date: filterForm.values.date,
      });

      // Enable the filtered query and refetch
      await queryClient.invalidateQueries({
        queryKey: ["filteredImportShipments"],
      });
      setShowFilters(false);

      await refetchFilteredImportShipments();

      console.log("Filters applied successfully");
    } catch (error) {
      console.error("Error applying filters:", error);
      setShowFilters(false);
    }
  };

  const clearAllFilters = async () => {
    try {
      setShowFilters(false);

      filterForm.reset(); // Reset form to initial values
      setFiltersApplied(false); // Reset filters applied state

      // Reset applied filters state
      setAppliedFilters({
        customer: null,
        service: null,
        origin: null,
        destination: null,
        date: null,
      });

      // Invalidate queries and refetch unfiltered data
      await queryClient.invalidateQueries({
        queryKey: ["import-shipment/filter/"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["filteredImportShipments"],
      });
      await queryClient.removeQueries({
        queryKey: ["filteredImportShipments"],
      }); // Remove filtered data from cache
    } catch (error) {
      console.error("Error clearing filters:", error);
    } finally {
      setShowFilters(false);
    }
  };
  // Handle page change
  const handlePageChange = (newPage: number) => {
    setListCurrentPage(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setListPageSize(newPageSize);
    setListCurrentPage(1); // Reset to first page when changing page size
  };

  const columns = useMemo<MRT_ColumnDef<ImportShipmentData>[]>(
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
        accessorKey: "shipment_code",
        header: "Booking ID",
        size: 150,
        // Cell: ({ cell }) => (
        //   <Text fw={500} size="sm">
        //     {cell.getValue<string>()}
        //   </Text>
        // ),
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
        // Cell: ({ cell }) => (
        //   <Badge variant="light" color="blue" size="sm">
        //     {cell.getValue<string>()}
        //   </Badge>
        // ),
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 150,
        // Cell: ({ cell }) => (
        //   <Text fw={500} size="sm">
        //     {cell.getValue<string>()}
        //   </Text>
        // ),
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
      // {
      //   id: "actions",
      //   header: "Actions",
      //   position: "sticky",
      //   right: 0,
      //   size: 100,
      //   Cell: ({ row }) => (
      //     <Menu
      //       withinPortal
      //       position="bottom-end"
      //       shadow="sm"
      //       radius={"md"}
      //       closeOnItemClick
      //     >
      //       <Menu.Target>
      //         <ActionIcon variant="subtle" color="gray">
      //           <IconDotsVertical size={16} />
      //         </ActionIcon>
      //       </Menu.Target>
      //       <Menu.Dropdown>
      //         {/* <Box px={10} py={5}>
      //           <UnstyledButton
      //             onClick={() =>
      //               navigate("./edit", {
      //                 state: row.original,
      //               })
      //             }
      //           >
      //             <Group gap={"sm"}>
      //               <IconEdit size={16} style={{ color: "#105476" }} />
      //               <Text size="sm">Edit</Text>
      //             </Group>
      //           </UnstyledButton>
      //         </Box> */}
      //         {/* <Menu.Divider /> */}

      //         <Box px={10} py={5}>
      //           <UnstyledButton
      //             onClick={() => {
      //               setSelectedBooking(row.original);
      //               setConfirmModalOpened(true);
      //             }}
      //             disabled={row.original.import_to_export}
      //             style={{
      //               opacity: row.original.import_to_export ? 0.9 : 1,
      //               cursor: row.original.import_to_export
      //                 ? "not-allowed"
      //                 : "pointer",
      //             }}
      //           >
      //             <Group gap={"sm"}>
      //               <IconCirclePlus
      //                 size={16}
      //                 style={{
      //                   color: row.original.import_to_export
      //                     ? "#ccc"
      //                     : "#105476",
      //                 }}
      //               />
      //               <Text
      //                 size="sm"
      //                 c={row.original.import_to_export ? "dimmed" : undefined}
      //               >
      //                 {row.original.import_to_export
      //                   ? "Export Created"
      //                   : "Create Export Booking"}
      //               </Text>
      //             </Group>
      //           </UnstyledButton>
      //         </Box>
      //         <Menu.Divider />

      //         {/* <Box px={10} py={5}>
      //           <UnstyledButton
      //             onClick={() => {
      //               // TODO: Implement delete functionality
      //               // console.log("Delete import shipment:", row.original);
      //             }}
      //           >
      //             <Group gap={"sm"}>
      //               <IconX size={16} style={{ color: "red" }} />
      //               <Text size="sm" c="red">
      //                 Delete
      //               </Text>
      //             </Group>
      //           </UnstyledButton>
      //         </Box> */}
      //       </Menu.Dropdown>
      //     </Menu>
      //   ),
      // },
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
      // columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: false,
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
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
      },
    },
    renderEmptyRowsFallback: () => (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Text c="dimmed" ta="center" size="xl">
            No data to display
          </Text>
        </Stack>
      </Center>
    ),
  });

  // const handleConfirmCreateExport = async () => {
  //   if (selectedBooking) {
  //     try {
  //       // Helper function to format dates to YYYY-MM-DD
  //       const formatDate = (dateValue: Date | string | null | undefined) => {
  //         if (!dateValue) return "";
  //         if (typeof dateValue === "string") {
  //           const date = new Date(dateValue);
  //           return date.toISOString().split("T")[0];
  //         }
  //         if (dateValue instanceof Date) {
  //           return dateValue.toISOString().split("T")[0];
  //         }
  //         return "";
  //       };

  //       // Prepare minimal payload for export conversion
  //       const payload = {
  //         service_type: "EXPORT",
  //         import_to_export: true,
  //         reference: selectedBooking.shipment_code || "",
  //       };

  //       console.log("Creating export shipment from import data:", payload);
  //       // Close modal immediately before API call
  //       setConfirmModalOpened(false);
  //       setSelectedBooking(null);

  //       // Call API to create export shipment
  //       const response = await postAPICall(
  //         URL.customerServiceShipment,
  //         payload,
  //         API_HEADER
  //       );

  //       console.log("Export shipment created successfully:", response);

  //       // Show success notification
  //       ToastNotification({
  //         message: "Export booking created successfully from import booking!",
  //         type: "success",
  //       });

  //       // Refresh the import booking master page data
  //       await queryClient.invalidateQueries({
  //         queryKey: ["import-shipment/filter/"],
  //       });
  //       await queryClient.refetchQueries({
  //         queryKey: ["import-shipment/filter/"],
  //       });

  //       // Navigate to export shipment list page with refresh flag
  //       navigate("/customer-service/export-shipment", {
  //         state: { refreshData: true },
  //       });
  //     } catch (error) {
  //       console.error("Error creating export shipment:", error);
  //       ToastNotification({
  //         message: "Failed to create export shipment. Please try again.",
  //         type: "error",
  //       });
  //     }
  //   }
  // };

  return (
    <>
      {showMasterTable && (
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            padding: "5px 10px",
          }}
        >
          <Group justify="space-between" align="center" mb="md" wrap="nowrap">
            <Text size="md" fw={600} c="#105476">
              Import Booking Lists
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
              shadow="md"
              padding="md"
              radius="md"
              withBorder
              mb="md"
              bg="#f8f9fa"
              style={{
                flexShrink: 0,
                height: "fit-content",
              }}
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
                        onChange={(value) =>
                          filterForm.setFieldValue("customer", value || "")
                        }
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

                    {/* Service Filter */}
                    <Grid.Col span={2.4}>
                      <Select
                        key={`service-${filterForm.values.service}`}
                        label="Service"
                        placeholder="Select Service"
                        searchable
                        clearable
                        size="xs"
                        data={[
                          { value: "FCL", label: "FCL" },
                          { value: "LCL", label: "LCL" },
                          { value: "AIR", label: "AIR" },
                        ]}
                        nothingFoundMessage="No services found"
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
                        onChange={(value) =>
                          filterForm.setFieldValue("origin", value || "")
                        }
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
                        onChange={(value) =>
                          filterForm.setFieldValue("destination", value || "")
                        }
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
            <Center
              p="md"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                maxHeight: "1536px",
                overflow: "auto",
                border: "1px solid #e9ecef",
                boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
                borderRadius: "calc(0.5rem * 1)",
              }}
            >
              <Stack align="center" gap="md">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Loading import bookings...</Text>
              </Stack>
            </Center>
          ) : (
            <>
              <MantineReactTable table={table} />
            </>
          )}
          <PaginationBar
            pageSize={listPageSize}
            currentPage={listCurrentPage}
            totalRecords={listTotalRecords}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={handlePageChange}
          />
        </Card>
      )}
      <Outlet />
    </>
  );
}

export default ImportShipmentMaster;
