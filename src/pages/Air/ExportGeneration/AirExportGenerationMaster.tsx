import { useMemo, useState, useEffect } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
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
} from "@mantine/core";
import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconFilter,
  IconFilterOff,
  IconPlus,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
  ERPListPaginationFooter,
  ERPListStatPill,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistSelectClassNames,
} from "../../../components";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
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

/** Matches `summary` on `customerServiceShipmentFilter` for air export generation (totals are filter-scoped). */
type AirExportGenerationListSummary = {
  status_counts?: {
    pending?: number;
    generated?: number;
    inactive?: number;
  };
};

type AirExportGenerationQueryResult = {
  data: ExportShipmentData[];
  total: number;
  summary?: AirExportGenerationListSummary;
};

function AirExportGenerationMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const erpTheme = DEFAULT_ERP_LIST_THEME;

  //States
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const [totalRecords, setTotalRecords] = useState(0);

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

  // Search (optional; included in filter request when non-empty)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500);

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

  const buildRequestFilters = (): Record<string, unknown> => {
    const filters: Record<string, unknown> = {
      service_type: "EXPORT",
      service: "AIR",
    };
    if (filtersApplied) {
      Object.assign(filters, buildFilterPayload());
    }
    const q = debouncedSearch.trim();
    if (q) {
      filters.search = q;
    }
    return filters;
  };

  const {
    data: exportShipmentsResponse,
    isLoading,
    refetch: refetchExportShipments,
  } = useQuery({
    queryKey: [
      "air-export-generation/filter",
      pagination.pageIndex,
      pagination.pageSize,
      filtersApplied,
      filtersApplied ? JSON.stringify(filterForm.values) : "-",
      debouncedSearch,
    ],
    enabled: searchQuery === debouncedSearch,
    queryFn: async (): Promise<AirExportGenerationQueryResult> => {
      try {
        const offset = pagination.pageIndex * pagination.pageSize;
        const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pagination.pageSize}`;
        const response = (await apiCallProtected.post(url, {
          filters: buildRequestFilters(),
        })) as Record<string, unknown>;

        if (response && typeof response === "object") {
          let data: ExportShipmentData[] = [];
          if (Array.isArray(response.data)) {
            data = response.data as ExportShipmentData[];
          } else if (Array.isArray(response.results)) {
            data = response.results as ExportShipmentData[];
          } else if (Array.isArray(response.result)) {
            data = response.result as ExportShipmentData[];
          }

          const total = getBookingShipmentFilterListTotal(
            response,
            data,
            offset
          );
          setTotalRecords(total);

          const rawSummary = response.summary;
          const summary: AirExportGenerationListSummary | undefined =
            rawSummary &&
            typeof rawSummary === "object" &&
            !Array.isArray(rawSummary)
              ? (rawSummary as AirExportGenerationListSummary)
              : undefined;

          return { data, total, summary };
        }
        setTotalRecords(0);
        return { data: [], total: 0, summary: undefined };
      } catch (error) {
        console.error("Error fetching air export generation:", error);
        setTotalRecords(0);
        return { data: [], total: 0, summary: undefined };
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const displayData = useMemo(
    () => exportShipmentsResponse?.data ?? [],
    [exportShipmentsResponse]
  );

  const stats = useMemo(() => {
    const summary = exportShipmentsResponse?.summary;
    const sc = summary?.status_counts;
    if (sc) {
      return {
        pending: sc.pending ?? 0,
        generated: sc.generated ?? 0,
        inactive: sc.inactive ?? 0,
      };
    }
    return { pending: 0, generated: 0, inactive: 0 };
  }, [exportShipmentsResponse?.summary]);

  const isDataLoading = isLoading;

  // Keep current page in range when total shrinks
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  // Effect to handle refetch when coming from successful form submission
  useEffect(() => {
    if (shouldRefetch) {
      queryClient.invalidateQueries({
        queryKey: ["air-export-generation/filter"],
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

  // Effect to handle refreshData state from navigation
  useEffect(() => {
    console.log("refresh data----", location.state?.refreshData);

    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation");

      // Refresh export shipments data
      const refreshData = async () => {
        try {
          console.log(
            "🔄 Starting aggressive data refresh for air export generation..."
          );

          // Remove all cached data first
          queryClient.removeQueries({
            queryKey: ["air-export-generation/filter"],
          });

          await new Promise((resolve) => setTimeout(resolve, 50));

          refetchExportShipments();

          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["air-export-generation/filter"],
              type: "active",
            });
            console.log(
              "✅ Air export generation data refresh completed with additional refetch"
            );
          }, 200);

          console.log("✅ Air export generation data refresh completed");
        } catch (error) {
          console.error("Error refreshing air export generation data:", error);
        }
      };

      refreshData();

      // Clear the refresh flag after starting the refresh process
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state,
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
          queryKey: ["air-export-generation/filter"],
          type: "active",
        });
        console.log(
          "🔄 Air export generation data refreshed on component mount"
        );
      } catch (error) {
        console.error(
          "Error refreshing air export generation data on mount:",
          error
        );
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(refreshOnMount, 100);

    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  const applyFilters = () => {
    const formValues = filterForm.values;
    const hasFilterValues =
      formValues.customer ||
      formValues.service ||
      formValues.origin ||
      formValues.destination ||
      formValues.date;

    if (!hasFilterValues) {
      setFiltersApplied(false);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
      ToastNotification({
        type: "info",
        message: "No filters selected, showing all data",
      });
    } else {
      setPagination((p) => ({ ...p, pageIndex: 0 }));
      setFiltersApplied(true);
      ToastNotification({
        type: "success",
        message: "Filters applied successfully",
      });
    }
    setShowFilters(false);
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
      filterForm.reset();
      setFiltersApplied(false);
      setSearchQuery("");
      setPagination((p) => ({ ...p, pageIndex: 0 }));

      await queryClient.invalidateQueries({
        queryKey: ["air-export-generation/filter"],
      });
      ToastNotification({
        type: "success",
        message: "All filters cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing filters:", error);
      setShowFilters(false);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPagination({ pageIndex: 0, pageSize: newSize });
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
    ],
    []
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
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: totalRecords,
    state: { pagination },
    initialState: {
      pagination: { pageSize: 15, pageIndex: 0 },
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
              Air Export Generation Lists
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

          <Group gap="lg" wrap="wrap" align="center" mb="md">
            <ERPListStatPill
              theme={erpTheme}
              icon={<IconClock size={14} color={erpTheme.primary} />}
              value={stats.pending}
              label="Pending"
            />
            <ERPListStatPill
              theme={erpTheme}
              icon={<IconCircleCheck size={14} color="#059669" />}
              iconBackground="#d1fae5"
              iconColor="#059669"
              value={stats.generated}
              label="Generated"
            />
            <ERPListStatPill
              theme={erpTheme}
              icon={<IconCircleX size={14} color="#64748b" />}
              iconBackground="#f1f5f9"
              iconColor="#64748b"
              value={stats.inactive}
              label="Inactive"
            />
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
                        dropdownZIndex={1000}
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
                      <SingleDateInput
                        key={`date-${filterForm.values.date}`}
                        label="Date"
                        placeholder="YYYY-MM-DD"
                        size="xs"
                        value={filterForm.values.date}
                        onChange={(d) => filterForm.setFieldValue("date", d)}
                      />
                    </Grid.Col>

                    {/* Origin Filter */}
                    <Grid.Col span={2.4}>
                      <SearchableSelect
                        size="xs"
                        label="Origin"
                        placeholder="Type origin code or name"
                        dropdownZIndex={1000}
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
                        dropdownZIndex={1000}
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
            <Center py="xl">
              <Stack align="center" gap="md">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Loading air export generation...</Text>
              </Stack>
            </Center>
          ) : (
            <>
              <MantineReactTable table={table} />
              <ERPListPaginationFooter
                theme={erpTheme}
                totalRecords={totalRecords}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                onPageIndexChange={(idx) =>
                  setPagination((prev) => ({ ...prev, pageIndex: idx }))
                }
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={["10", "15", "25", "50"]}
                selectClassNames={erpListGeistSelectClassNames}
              />
            </>
          )}
        </Card>
      )}
      <Outlet />
    </>
  );
}

export default AirExportGenerationMaster;
