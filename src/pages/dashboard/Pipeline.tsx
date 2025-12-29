import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Text,
  Grid,
  Center,
  Stack,
  Menu,
  UnstyledButton,
  Box,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconFilterOff,
  IconPlus,
  IconFilter,
  IconDotsVertical,
  IconEdit,
  IconEye,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification, SearchableSelect } from "../../components";
import { useDebouncedValue } from "@mantine/hooks";
import { searchAPI } from "../../service/searchApi";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";

type PipelineData = {
  id: number;
  customer_code: string;
  customer_name: string;
  service: string;
  origin_port_name: string;
  destination_port_name: string;
  no_of_shipments: number;
  frequency_name: string;
  volume: string | null;
  profit: number;
  branch_code: string;
  company_code: string;
};

type CustomerPipelineData = {
  customer_code: string;
  customer_name: string;
  created_by: string;
  pipelines: PipelineData[];
  total_profile_volume: number;
  total_profile_profit: number;
  total_profit: number;
  total_volume: number;
};

type FilterState = {
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  frequency: string | null;
  sales_person: string | null;
};

function Pipeline() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(5);
  const queryClient = useQueryClient();

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      customer: null,
      service: null,
      origin: null,
      destination: null,
      frequency: null,
      sales_person: null,
    },
  });

  const navigate = useNavigate();
  const location = useLocation();

  //Search Debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Fetch pipeline data with React Query
  const {
    data: pipelineData = [],
    isLoading: pipelineLoading,
    refetch: refetchPipeline,
  } = useQuery({
    queryKey: ["pipeline", pageIndex, pageSize],
    queryFn: async () => {
      try {
        const requestBody = {}; // Empty payload to get all data
        const response = await apiCallProtected.post(
          URL.pipelineFilter,
          requestBody
        );
        const responseData =
          (response as any)?.data ||
          (response as unknown as {
            results: CustomerPipelineData[];
            total_count: number;
            page: number;
            page_size: number;
            total_pages: number;
            filters_applied: Record<string, unknown>;
            ordering: string[];
          });

        if (responseData.results && Array.isArray(responseData.results)) {
          return responseData.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching pipeline data:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: !!location.state?.refreshData, // Refetch on mount if we have refresh flag
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    customer: null,
    service: null,
    origin: null,
    destination: null,
    frequency: null,
    sales_person: null,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredPipelineData = [],
    isLoading: filteredPipelineLoading,
    refetch: refetchFilteredPipeline,
  } = useQuery({
    queryKey: ["filteredPipeline", filtersApplied, appliedFilters],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        const payload: Record<string, unknown> = {};

        if (appliedFilters.customer)
          payload.customer_code = appliedFilters.customer;
        if (appliedFilters.service) payload.service = appliedFilters.service;
        if (appliedFilters.origin)
          payload.origin_port_code = appliedFilters.origin;
        if (appliedFilters.destination)
          payload.destination_port_code = appliedFilters.destination;
        if (appliedFilters.frequency)
          payload.frequency_id = appliedFilters.frequency;
        if (appliedFilters.sales_person)
          payload.created_by = appliedFilters.sales_person;

        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          URL.pipelineFilter, // Use pipeline filter endpoint for filtering
          requestBody
        );
        const responseData =
          (response as any)?.data ||
          (response as unknown as {
            results: CustomerPipelineData[];
            total_count: number;
            page: number;
            page_size: number;
            total_pages: number;
            filters_applied: Record<string, unknown>;
            ordering: string[];
          });
        console.log("Filter API response:", responseData);

        if (responseData.results && Array.isArray(responseData.results)) {
          return responseData.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered pipeline data:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Handle refresh when navigating from PipelineCreate
  useEffect(() => {
    if (location.state?.refreshData) {
      // Refetch all pipeline related data
      refetchPipeline();
      refetchFilteredPipeline();

      // Clear the refresh state to prevent unnecessary refetches
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state?.refreshData,
    refetchPipeline,
    refetchFilteredPipeline,
    navigate,
    location.pathname,
  ]);

  // Optimized frequency data query with memoization
  const { data: rawFrequencyData = [], isLoading: frequencyDataLoading } =
    useQuery({
      queryKey: ["frequencies"],
      queryFn: async () => {
        try {
          const frequencyResponse = (await getAPICall(
            URL.frequency,
            API_HEADER
          )) as Array<{ id: number; frequency_name: string }>;
          return frequencyResponse;
        } catch (error) {
          console.error("Error fetching frequency data:", error);
          return [];
        }
      },
      staleTime: Infinity, // Never refetch since it's master data
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    });

  const frequencyOptionsData = useMemo(() => {
    if (!Array.isArray(rawFrequencyData) || !rawFrequencyData.length) return [];

    return rawFrequencyData
      .filter(
        (item: { id: number; frequency_name: string }) =>
          item.id && item.frequency_name
      ) // Filter out items with null/undefined values
      .map((item: { id: number; frequency_name: string }) => ({
        value: String(item.id),
        label: item.frequency_name,
      }))
      .filter(
        (option, index, self) =>
          // Remove duplicates based on value
          index === self.findIndex((o) => o.value === option.value)
      );
  }, [rawFrequencyData]);

  // Fetch salespersons data
  const { data: salespersonsData = [], isLoading: salespersonsLoading } =
    useQuery({
      queryKey: ["salespersons"],
      queryFn: async () => {
        try {
          const response = await apiCallProtected.post(URL.salespersons, {});
          const data = response as any;
          return Array.isArray(data?.data) ? data.data : [];
        } catch (error) {
          console.error("Error fetching salespersons data:", error);
          return [];
        }
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

  const salespersonOptions = useMemo(() => {
    if (!salespersonsData || !Array.isArray(salespersonsData)) return [];
    return salespersonsData
      .filter((item: any) => item?.sales_person)
      .map((item: any) => ({
        value: String(item.sales_person),
        label: String(item.sales_person),
      }));
  }, [salespersonsData]);

  // Search data with React Query
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["pipelineSearch", debounced],
    queryFn: async () => {
      if (!debounced.trim()) return null;
      try {
        const result = await searchAPI(debounced, new AbortController().signal);
        return result;
      } catch (error) {
        console.error("Search API Error:", error);
        return [];
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
      console.log("Displaying search data:", searchData);
      return searchData;
    }
    // Check if we have filtered data (filters were applied)
    if (filtersApplied) {
      console.log("Displaying filtered data:", filteredPipelineData);
      console.log("Filters applied:", filtersApplied);
      return filteredPipelineData;
    }
    console.log("Displaying unfiltered data:", pipelineData);
    return pipelineData;
  }, [
    debounced,
    searchData,
    pipelineData,
    filteredPipelineData,
    filtersApplied,
  ]);

  // Loading state
  const isLoading = useMemo(() => {
    if (filtersApplied) {
      return filteredPipelineLoading || searchLoading;
    }
    return pipelineLoading || searchLoading;
  }, [pipelineLoading, filteredPipelineLoading, searchLoading, filtersApplied]);

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
        filterForm.values.frequency ||
        filterForm.values.sales_person;

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setAppliedFilters({
          customer: null,
          service: null,
          origin: null,
          destination: null,
          frequency: null,
          sales_person: null,
        });

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
        await refetchPipeline();

        console.log("No filter values provided, showing unfiltered data");
        return;
      }

      setPageIndex(0); // Reset to first page when applying filters
      setFiltersApplied(true); // Mark filters as applied

      // Store the current filter form values as applied filters
      setAppliedFilters({
        customer: filterForm.values.customer,
        service: filterForm.values.service,
        origin: filterForm.values.origin,
        destination: filterForm.values.destination,
        frequency: filterForm.values.frequency,
        sales_person: filterForm.values.sales_person,
      });

      // Enable the filtered query and refetch
      await queryClient.invalidateQueries({
        queryKey: ["filteredPipeline"],
      });
      await refetchFilteredPipeline();
      setShowFilters(false);
      console.log("Filters applied successfully");
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);

    filterForm.reset(); // Reset form to initial values
    setSearchQuery("");
    setPageIndex(0);
    setFiltersApplied(false); // Reset filters applied state

    // Reset applied filters state
    setAppliedFilters({
      customer: null,
      service: null,
      origin: null,
      destination: null,
      frequency: null,
      sales_person: null,
    });

    // Invalidate queries and refetch unfiltered data
    await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredPipeline"] });
    await queryClient.removeQueries({ queryKey: ["filteredPipeline"] }); // Remove filtered data from cache
    await refetchPipeline();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const columns = useMemo<MRT_ColumnDef<CustomerPipelineData>[]>(
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
        accessorKey: "customer_code",
        header: "Customer Code",
        size: 150,
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 200,
      },
      {
        accessorKey: "created_by",
        header: "Sales Person",
        size: 150,
      },
      {
        accessorKey: "total_profit",
        header: "Total Profit",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `${value?.toLocaleString() || "0"}`;
        },
      },
      {
        accessorKey: "total_volume",
        header: "Total Volume",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `${value?.toLocaleString() || "0"}`;
        },
      },

      // Action column
      {
        id: "actions",
        header: "Actions",
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
                  onClick={() => {
                    navigate("/pipeline/create", {
                      state: {
                        customer_code: row.original.customer_code,
                        customer_name: row.original.customer_name,
                        pipelines: row.original.pipelines,
                        actionType: "view",
                        returnTo: "/pipeline",
                      },
                    });
                  }}
                >
                  <Group gap={"sm"}>
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    navigate("/pipeline/create", {
                      state: {
                        customer_code: row.original.customer_code,
                        customer_name: row.original.customer_name,
                        pipelines: row.original.pipelines,
                        actionType: "edit",
                        returnTo: "/pipeline",
                      },
                    });
                  }}
                >
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text size="sm">Edit</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
        size: 80,
      },
    ],
    [navigate]
  );

  const table = useMantineReactTable({
    columns: columns as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles: Record<string, any> = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "30px",
            zIndex: 2,
            backgroundColor: "#ffffff",
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          padding: "8px 12px",
          fontSize: "13px",
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
            minWidth: "30px",
            zIndex: 2,
            backgroundColor: "#ffffff",
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          padding: "6px 12px",
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

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c={"#105476"}>
            List of Pipeline{" "}
          </Text>

          <Group gap="sm" wrap="nowrap">
            {/* <TextInput
              placeholder="Search"
              leftSection={<IconSearch size={16} />}
              style={{ width: 300 }}
              radius="sm"
              size="xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            /> */}

            <Button
              variant="outline"
              leftSection={<IconFilter size={16} />}
              size="xs"
              color="#105476"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Button
              color={"#105476"}
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={() => navigate("/pipeline/create")}
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
                  {/* Sales Person Filter */}
                  <Grid.Col span={2.4}>
                    <Select
                      key={`sales-person-${filterForm.values.sales_person}-${salespersonsLoading}-${salespersonOptions.length}`}
                      label="Sales Person"
                      placeholder={
                        salespersonsLoading
                          ? "Loading salespersons..."
                          : "Select Sales Person"
                      }
                      searchable
                      clearable
                      size="xs"
                      data={salespersonOptions}
                      nothingFoundMessage={
                        salespersonsLoading
                          ? "Loading salespersons..."
                          : "No salespersons found"
                      }
                      disabled={salespersonsLoading}
                      value={filterForm.values.sales_person}
                      onChange={(value) =>
                        filterForm.setFieldValue("sales_person", value || null)
                      }
                      onFocus={(event) => {
                        const input = event.target as HTMLInputElement;
                        if (input && input.value) {
                          input.select();
                        }
                      }}
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

                  {/* Service Filter */}
                  <Grid.Col span={2.4}>
                    <Select
                      size="xs"
                      label="Service"
                      placeholder="Select Service"
                      searchable
                      clearable
                      data={[
                        { value: "AIR", label: "AIR" },
                        { value: "FCL", label: "FCL" },
                        { value: "LCL", label: "LCL" },
                      ]}
                      value={filterForm.values.service}
                      onChange={(value) =>
                        filterForm.setFieldValue("service", value || "")
                      }
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
                      placeholder="Type origin port"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_name", "port_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: String(item.port_name),
                      })}
                      value={filterForm.values.origin}
                      onChange={(value) =>
                        filterForm.setFieldValue("origin", value || "")
                      }
                      minSearchLength={2}
                    />
                  </Grid.Col>

                  {/* Destination Filter */}
                  <Grid.Col span={2.4}>
                    <SearchableSelect
                      size="xs"
                      label="Destination"
                      placeholder="Type destination port"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_name", "port_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: String(item.port_name),
                      })}
                      value={filterForm.values.destination}
                      onChange={(value) =>
                        filterForm.setFieldValue("destination", value || "")
                      }
                      minSearchLength={2}
                    />
                  </Grid.Col>

                  {/* Frequency Filter */}
                  <Grid.Col span={2.4}>
                    <Select
                      key={`frequency-${filterForm.values.frequency}-${frequencyDataLoading}-${frequencyOptionsData.length}`}
                      label="Frequency"
                      placeholder={
                        frequencyDataLoading
                          ? "Loading frequencies..."
                          : "Select Frequency"
                      }
                      searchable
                      clearable
                      size="xs"
                      data={frequencyOptionsData}
                      nothingFoundMessage={
                        frequencyDataLoading
                          ? "Loading frequencies..."
                          : "No frequencies found"
                      }
                      disabled={frequencyDataLoading}
                      {...filterForm.getInputProps("frequency")}
                      onFocus={(event) => {
                        // Auto-select all text when input is focused
                        const input = event.target as HTMLInputElement;
                        if (input && input.value) {
                          input.select();
                        }
                      }}
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

        {isLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading pipeline data...</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable
              key={`table-${filtersApplied ? "filtered" : "unfiltered"}-${displayData.length}`}
              table={table}
            />

            {/* Custom Pagination Bar */}
            <Group
              w="100%"
              justify="space-between"
              align="center"
              px="md"
              py="xs"
              style={{ borderTop: "1px solid #e9ecef" }}
              wrap="nowrap"
              mt="xs"
            >
              {/* Rows per page and range */}
              <Group gap="sm" align="center" wrap="nowrap" mt={10}>
                <Text size="sm" c="dimmed">
                  Rows per page
                </Text>
                <Select
                  size="xs"
                  data={["10", "25", "50"]}
                  value={String(table.getState().pagination.pageSize)}
                  onChange={(val) => {
                    if (!val) return;
                    table.setPageSize(Number(val));
                    table.setPageIndex(0);
                  }}
                  w={110}
                  styles={{ input: { fontSize: 12, height: 30 } }}
                />
                <Text size="sm" c="dimmed">
                  {(() => {
                    const { pageIndex, pageSize } = table.getState().pagination;
                    const total =
                      table.getPrePaginationRowModel().rows.length || 0;
                    if (total === 0) return "0–0 of 0";
                    const start = pageIndex * pageSize + 1;
                    const end = Math.min((pageIndex + 1) * pageSize, total);
                    return `${start}–${end} of ${total}`;
                  })()}
                </Text>
              </Group>

              {/* Page controls */}
              <Group gap="xs" align="center" wrap="nowrap" mt={10}>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() =>
                    table.setPageIndex(
                      Math.max(0, table.getState().pagination.pageIndex - 1)
                    )
                  }
                  disabled={table.getState().pagination.pageIndex === 0}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <Text size="sm" ta="center" style={{ width: 26 }}>
                  {table.getState().pagination.pageIndex + 1}
                </Text>
                <Text size="sm" c="dimmed">
                  of{" "}
                  {Math.max(
                    1,
                    Math.ceil(
                      (table.getPrePaginationRowModel().rows.length || 0) /
                        table.getState().pagination.pageSize
                    )
                  )}
                </Text>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const total =
                      table.getPrePaginationRowModel().rows.length || 0;
                    const totalPages = Math.max(
                      1,
                      Math.ceil(total / table.getState().pagination.pageSize)
                    );
                    table.setPageIndex(
                      Math.min(
                        totalPages - 1,
                        table.getState().pagination.pageIndex + 1
                      )
                    );
                  }}
                  disabled={(() => {
                    const total =
                      table.getPrePaginationRowModel().rows.length || 0;
                    const totalPages = Math.max(
                      1,
                      Math.ceil(total / table.getState().pagination.pageSize)
                    );
                    return (
                      table.getState().pagination.pageIndex >= totalPages - 1
                    );
                  })()}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </>
        )}
      </Card>
    </>
  );
}
export default Pipeline;
