import { useMemo, useState, useEffect, useRef } from "react";
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
  Stack,
  Menu,
  ActionIcon,
  Select,
  Loader,
  Grid,
  TextInput,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconFilterOff,
  IconSearch,
  IconCalendar,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { SearchableSelect } from "../../../components";
import { DateInput } from "@mantine/dates";
import { ToastNotification } from "../../../components";
import dayjs from "dayjs";

// Type definitions
type ImportJobData = {
  id: number;
  service: string;
  origin_agent: string | null;
  origin_agent_name: string | null;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: string;
  eta: string;
  atd: string | null;
  ata: string | null;
  schedule_id: string | null;
  carrier_code: string;
  carrier_name: string;
  vessel_name: string | null;
  voyage_number: string | null;
  mbl_number: string | null;
  mbl_date: string | null;
  status: string;
  housing_details?: Array<{
    hbl_number: string;
  }>;
};

type FilterState = {
  mbl_number: string | null;
  origin_agent: string | null;
  origin_code: string | null;
  destination_code: string | null;
  service: string | null;
  etd: Date | null;
  eta: Date | null;
};

function ImportJobMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    mbl_number: null,
    origin_agent: null,
    origin_code: null,
    destination_code: null,
    service: null,
    etd: null,
    eta: null,
  });

  // Display values for SearchableSelect
  const [originAgentDisplayValue, setOriginAgentDisplayValue] = useState<
    string | null
  >(null);
  const [originDisplayValue, setOriginDisplayValue] = useState<string | null>(
    null
  );
  const [destinationDisplayValue, setDestinationDisplayValue] = useState<
    string | null
  >(null);

  // Memoize additionalParams for SearchableSelect
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  // Build filter payload according to API specification
  const buildFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};

    // MBL Number - icontains search
    if (filters.mbl_number && filters.mbl_number.trim()) {
      payload.mbl_number = filters.mbl_number.trim();
    }

    // Origin Agent - icontains search
    if (filters.origin_agent && filters.origin_agent.trim()) {
      payload.origin_agent = filters.origin_agent.trim();
    }

    // Origin Code - exact match or array
    if (filters.origin_code && filters.origin_code.trim()) {
      payload.origin_code = filters.origin_code.trim();
    }

    // Destination Code - exact match or array
    if (filters.destination_code && filters.destination_code.trim()) {
      payload.destination_code = filters.destination_code.trim();
    }

    // Service - exact match or array
    if (filters.service && filters.service.trim()) {
      payload.service = filters.service.trim();
    }

    // ETD - single date format: "YYYY-MM-DD"
    if (filters.etd) {
      payload.etd = dayjs(filters.etd).format("YYYY-MM-DD");
    }

    // ETA - single date format: "YYYY-MM-DD"
    if (filters.eta) {
      payload.eta = dayjs(filters.eta).format("YYYY-MM-DD");
    }

    return payload;
  }, [filters]);

  // Track if we're refreshing from edit to prevent duplicate calls
  const isRefreshingFromEdit = useRef(false);

  // Fetch data using useQuery - initial load without filters
  const {
    data: importJobData,
    isLoading,
    isFetching,
    refetch: refetchImportJobs,
  } = useQuery<{ data: ImportJobData[]; total_count: number }>({
    queryKey: ["importJobs"],
    queryFn: async () => {
      try {
        const response = await apiCallProtected.post(
          URL.importJobFilter,
          { filters: { service: ["FCL", "LCL"], service_type: "Import" } },
          API_HEADER
        );
        const result = response as unknown as {
          status: boolean;
          message: string;
          data: ImportJobData[];
          total_count: number;
        };

        // Handle response format: { status, message, data, total_count }
        if (result?.status && Array.isArray(result?.data)) {
          return {
            data: result.data,
            total_count: result.total_count || result.data.length,
          };
        }
        return { data: [], total_count: 0 };
      } catch (error) {
        console.error("Error fetching import jobs:", error);
        return { data: [], total_count: 0 };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: !!location.state?.refreshData,
    enabled: true, // Always enabled to fetch initial data
  });

  // Fetch filtered data - disabled by default, only runs when explicitly refetched via Apply Filters button
  const {
    data: filteredImportJobData,
    isLoading: isFilteredLoading,
    isFetching: isFilteredFetching,
    refetch: refetchFilteredImportJobs,
  } = useQuery<{ data: ImportJobData[]; total_count: number }>({
    queryKey: ["filteredImportJobs", buildFilterPayload],
    queryFn: async () => {
      try {
        const filterPayload = buildFilterPayload;
        // Don't return empty array - let the query be disabled instead
        if (Object.keys(filterPayload).length === 0) {
          return { data: [], total_count: 0 };
        }

        const response = await apiCallProtected.post(
          URL.importJobFilter,
          { filters: filterPayload },
          API_HEADER
        );
        const result = response as unknown as {
          status: boolean;
          message: string;
          data: ImportJobData[];
          total_count: number;
        };

        if (result?.status && Array.isArray(result?.data)) {
          return {
            data: result.data,
            total_count: result.total_count || result.data.length,
          };
        }
        return { data: [], total_count: 0 };
      } catch (error) {
        console.error("Error fetching filtered import jobs:", error);
        return { data: [], total_count: 0 };
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false, // Never auto-run - only run when explicitly refetched via Apply Filters button
  });

  // Refetch when navigating from create/edit page
  useEffect(() => {
    if (location.state?.refreshData) {
      queryClient.invalidateQueries({ queryKey: ["importJobs"] });
      queryClient.invalidateQueries({ queryKey: ["filteredImportJobs"] });
      refetchImportJobs();
      if (filtersApplied) {
        refetchFilteredImportJobs();
      }
      // Clear the refresh flag
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state?.refreshData,
    navigate,
    location.pathname,
    queryClient,
    refetchImportJobs,
    refetchFilteredImportJobs,
    filtersApplied,
  ]);

  // Use filtered data if filters are applied, otherwise use initial data
  // Only change data when filtersApplied flag changes (via Apply/Clear buttons), not on filter input changes
  const data = useMemo(() => {
    if (filtersApplied && filteredImportJobData) {
      return filteredImportJobData.data || [];
    }
    // Always return initial data when filters are not applied
    return importJobData?.data || [];
  }, [filtersApplied, filteredImportJobData, importJobData]);

  const totalRecords = useMemo(() => {
    if (filtersApplied && filteredImportJobData) {
      return filteredImportJobData.total_count || 0;
    }
    // Always return initial data count when filters are not applied
    return importJobData?.total_count || 0;
  }, [filtersApplied, filteredImportJobData, importJobData]);

  // Combined loading state - show loader whenever API is called (initial load, filter, or refresh)
  const isTableLoading = useMemo(() => {
    // Show loader when refreshing from edit (location.state?.refreshData is set)
    if (location.state?.refreshData) {
      return isLoading || isFetching;
    }
    // Otherwise, show loader based on filter state - use isFetching to catch all API calls
    return filtersApplied
      ? isFilteredLoading || isFilteredFetching
      : isLoading || isFetching;
  }, [
    isLoading,
    isFetching,
    isFilteredLoading,
    isFilteredFetching,
    filtersApplied,
    location.state?.refreshData,
  ]);

  // Client-side search filtering
  const displayData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }
    const query = searchQuery.toLowerCase().trim();
    return data.filter((job) => {
      return (
        job.mbl_number?.toLowerCase().includes(query) ||
        job.origin_agent_name?.toLowerCase().includes(query) ||
        job.origin_name?.toLowerCase().includes(query) ||
        job.destination_name?.toLowerCase().includes(query) ||
        job.carrier_name?.toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery]);

  // Filter functions
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const applyFilters = async () => {
    const hasFilterValues = Object.values(buildFilterPayload).some((val) => {
      // Check if value is not empty
      if (val === null || val === undefined || val === "") return false;
      // Check if it's an object (date range) and has at least one key
      if (typeof val === "object" && !Array.isArray(val)) {
        return Object.keys(val).length > 0;
      }
      return true;
    });

    if (!hasFilterValues) {
      // No filters selected - clear filters and show initial data
      setFiltersApplied(false);
      setCurrentPage(1);
      // Invalidate filtered queries and refetch initial data
      await queryClient.invalidateQueries({ queryKey: ["filteredImportJobs"] });
      await refetchImportJobs();
      ToastNotification({
        type: "info",
        message: "No filters selected, showing all data",
      });
      setShowFilters(false);
      return;
    }

    // Mark that filters were applied - this will trigger data change
    setFiltersApplied(true);
    setCurrentPage(1); // Reset to first page

    // Manually refetch filtered data with current filter payload
    await refetchFilteredImportJobs();

    ToastNotification({
      type: "success",
      message: "Filters applied successfully",
    });
    setShowFilters(false);
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    setFilters({
      mbl_number: null,
      origin_agent: null,
      origin_code: null,
      destination_code: null,
      service: null,
      etd: null,
      eta: null,
    });
    setOriginAgentDisplayValue(null);
    setOriginDisplayValue(null);
    setDestinationDisplayValue(null);
    setFiltersApplied(false); // Mark that filters are cleared
    setCurrentPage(1);

    // Invalidate filtered queries
    await queryClient.invalidateQueries({ queryKey: ["filteredImportJobs"] });

    // Refetch initial data to show all records
    await refetchImportJobs();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Refetch when navigating from create/edit page - only once
  useEffect(() => {
    if (location.state?.refreshData && !isRefreshingFromEdit.current) {
      isRefreshingFromEdit.current = true;
      // Invalidate and refetch data
      queryClient.invalidateQueries({ queryKey: ["importJobs"] });
      queryClient.invalidateQueries({ queryKey: ["filteredImportJobs"] });
      refetchImportJobs().finally(() => {
        // Clear the refresh flag after refetch completes
        navigate(location.pathname, { replace: true, state: {} });
        // Reset the flag after a short delay to allow for future refreshes
        setTimeout(() => {
          isRefreshingFromEdit.current = false;
        }, 1000);
      });
    }
  }, [
    location.state?.refreshData,
    navigate,
    location.pathname,
    queryClient,
    refetchImportJobs,
  ]);

  // Columns definition
  const columns = useMemo<MRT_ColumnDef<ImportJobData>[]>(
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
        accessorKey: "mbl_number",
        header: "MBL No",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value || "-";
        },
      },
      {
        accessorKey: "origin_agent_name",
        header: "Origin Agent",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value || "-";
        },
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
        accessorKey: "etd",
        header: "ETD",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) return "-";
          try {
            return dayjs(value).format("DD-MM-YYYY");
          } catch {
            return value;
          }
        },
      },
      {
        accessorKey: "eta",
        header: "ETA",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) return "-";
          try {
            return dayjs(value).format("DD-MM-YYYY");
          } catch {
            return value;
          }
        },
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
                  navigate(`/SeaExport/import-job/edit`, {
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

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return displayData.slice(start, end);
  }, [displayData, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const table = useMantineReactTable({
    columns,
    data: paginatedData,
    state: {
      isLoading: isTableLoading,
    },
    enableColumnFilters: false,
    enablePagination: false, // Use custom pagination
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
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
              <Text c="dimmed" size="lg" ta="center">
                No jobs to display
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600} c="#105476">
          Import Job List
        </Text>

        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            w={{ sm: 150, md: 300 }}
            radius="sm"
            size="xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <Button
            variant={showFilters ? "filled" : "outline"}
            leftSection={<IconFilter size={16} />}
            size="xs"
            color="#105476"
            onClick={toggleFilters}
          >
            Filters
          </Button>
          <Button
            variant="filled"
            leftSection={<IconPlus size={14} />}
            size="xs"
            color="#105476"
            onClick={() => navigate("/SeaExport/import-job/create")}
          >
            Create New
          </Button>
        </Group>
      </Group>

      {/* Filter Section */}
      {showFilters && (
        <Card
          shadow="xs"
          padding="md"
          radius="md"
          withBorder
          mb="md"
          bg="#f8f9fa"
        >
          <Group justify="space-between" align="center" mb="md">
            <Group align="center" gap="xs">
              <IconFilter size={16} color="#105476" />
              <Text size="sm" fw={500} c="#105476">
                Filters
              </Text>
            </Group>
          </Group>

          <Grid>
            <Grid.Col span={3}>
              <TextInput
                label="MBL Number"
                placeholder="Enter MBL Number"
                size="xs"
                value={filters.mbl_number || ""}
                onChange={(e) =>
                  updateFilter("mbl_number", e.target.value || null)
                }
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <SearchableSelect
                size="xs"
                label="Origin Agent"
                placeholder="Type agent name"
                apiEndpoint={URL.agent}
                searchFields={["customer_name", "customer_code"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.customer_name), // Use customer_name as value
                  label: String(item.customer_name), // Display customer_name
                })}
                value={filters.origin_agent} // Stores customer_name
                displayValue={originAgentDisplayValue} // Displays customer_name
                onChange={(value, selectedData) => {
                  updateFilter("origin_agent", value || null); // Store customer_name
                  setOriginAgentDisplayValue(selectedData?.label || null); // Display customer_name
                }}
                minSearchLength={2}
              />
            </Grid.Col>

            <Grid.Col span={3}>
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
                value={filters.origin_code}
                displayValue={originDisplayValue}
                onChange={(value, selectedData) => {
                  updateFilter("origin_code", value || null);
                  setOriginDisplayValue(selectedData?.label || null);
                }}
                additionalParams={seaTransportParams}
                minSearchLength={2}
              />
            </Grid.Col>

            <Grid.Col span={3}>
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
                value={filters.destination_code}
                displayValue={destinationDisplayValue}
                onChange={(value, selectedData) => {
                  updateFilter("destination_code", value || null);
                  setDestinationDisplayValue(selectedData?.label || null);
                }}
                additionalParams={seaTransportParams}
                minSearchLength={2}
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <Select
                label="Service"
                placeholder="Select Service"
                size="xs"
                searchable
                clearable
                data={["FCL", "LCL"]}
                value={filters.service}
                onChange={(value) => updateFilter("service", value || null)}
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <DateInput
                label="ETD"
                placeholder="YYYY-MM-DD"
                size="xs"
                value={filters.etd}
                onChange={(date) => updateFilter("etd", date)}
                clearable
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={14} />}
                leftSectionPointerEvents="none"
                nextIcon={<IconChevronRight size={16} />}
                previousIcon={<IconChevronLeft size={16} />}
                styles={
                  {
                    input: { fontSize: "12px" },
                    label: {
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#495057",
                    },
                  } as any
                }
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <DateInput
                label="ETA"
                placeholder="YYYY-MM-DD"
                size="xs"
                value={filters.eta}
                onChange={(date) => updateFilter("eta", date)}
                clearable
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={14} />}
                leftSectionPointerEvents="none"
                nextIcon={<IconChevronRight size={16} />}
                previousIcon={<IconChevronLeft size={16} />}
                styles={
                  {
                    input: { fontSize: "12px" },
                    label: {
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#495057",
                    },
                  } as any
                }
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Group justify="flex-end" gap="sm">
                <Button
                  variant="outline"
                  color="#105476"
                  size="xs"
                  leftSection={<IconFilterOff size={14} />}
                  onClick={clearAllFilters}
                >
                  Clear All
                </Button>
                <Button
                  color="#105476"
                  size="xs"
                  leftSection={<IconFilter size={14} />}
                  onClick={applyFilters}
                  loading={isFilteredLoading}
                >
                  Apply Filters
                </Button>
              </Group>
            </Grid.Col>
          </Grid>
        </Card>
      )}

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
            styles={
              { input: { fontSize: 12, height: 30 } } as Record<string, unknown>
            }
          />
          <Text size="sm" c="dimmed">
            {(() => {
              const total = displayData.length || 0;
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
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text size="sm" ta="center" style={{ width: 26 }}>
            {currentPage}
          </Text>
          <Text size="sm" c="dimmed">
            of {Math.max(1, Math.ceil(displayData.length / pageSize))}
          </Text>
          <ActionIcon
            variant="default"
            size="sm"
            onClick={() => {
              const totalPages = Math.max(
                1,
                Math.ceil(displayData.length / pageSize)
              );
              handlePageChange(Math.min(totalPages, currentPage + 1));
            }}
            disabled={(() => {
              const totalPages = Math.max(
                1,
                Math.ceil(displayData.length / pageSize)
              );
              return currentPage >= totalPages;
            })()}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Card>
  );
}

export default ImportJobMaster;
