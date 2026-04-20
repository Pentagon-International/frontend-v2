import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  TextInput,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconFilter,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconX,
  IconSearch,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification, SearchableSelect } from "../../components";
import { useDebouncedValue } from "@mantine/hooks";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { useListFilterStore } from "../../store/listFilterStore";

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
  search: string | null;
};

const LIST_KEY = "PIPELINE";

function Pipeline() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(5);
  const queryClient = useQueryClient();
  const hasRestoredFromStore = useRef(false);

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const clearStoreAllExcept = useListFilterStore(
    (state) => state.clearAllExcept
  );

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      customer: null,
      service: null,
      origin: null,
      destination: null,
      frequency: null,
      sales_person: null,
      search: null,
    },
  });

  const navigate = useNavigate();
  const location = useLocation();

  //Search Debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    customer: null,
    service: null,
    origin: null,
    destination: null,
    frequency: null,
    sales_person: null,
    search: null,
  });

  // Single query using filter endpoint - always enabled, sends empty payload when no filters, filter payload when filters applied
  const {
    data: pipelineData = [],
    isLoading: pipelineLoading,
    isFetching: pipelineFetching,
    refetch: refetchPipeline,
  } = useQuery({
    queryKey: ["pipeline", appliedFilters, debouncedSearch],
    queryFn: async () => {
      try {
        // Build payload based on applied filters and search
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

        // Ensure full, debounced search value is sent in payload
        let searchValue =
          (appliedFilters.search ?? "").toString().trim() || "";
        const debouncedTrimmed = debouncedSearch.trim();
        if (debouncedTrimmed) {
          searchValue = debouncedTrimmed;
        }
        if (searchValue) {
          payload.search = searchValue;
        }

        // If payload has filters, wrap in filters object, otherwise send empty object
        const requestBody = Object.keys(payload).length > 0 
          ? { filters: payload } 
          : {};

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
    staleTime: 0, // Always fetch fresh data on mount to show loader
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always refetch on mount to ensure fresh data and show loader
  });

  // Clear other keys in store on mount (keep only current LIST_KEY)
  useEffect(() => {
    clearStoreAllExcept(LIST_KEY);
  }, []);

  // Restore filters and search from store on mount (before API calls)
  useEffect(() => {
    if (hasRestoredFromStore.current) return;

    const restoredState = useListFilterStore.getState().getState(LIST_KEY);
    
    const performRestore = async () => {
      if (!restoredState) {
        return; // No stored state, use defaults
      }

      // Restore filters
      let hasFilters = false;
      const restoredFilters = restoredState.filters as FilterState;
      if (restoredFilters && Object.keys(restoredFilters).length > 0) {
        // Remove search from filters as it's handled separately
        const { search: _, ...filtersWithoutSearch } = restoredFilters;
        filterForm.setValues({
          customer: filtersWithoutSearch.customer || null,
          service: filtersWithoutSearch.service || null,
          origin: filtersWithoutSearch.origin || null,
          destination: filtersWithoutSearch.destination || null,
          frequency: filtersWithoutSearch.frequency || null,
          sales_person: filtersWithoutSearch.sales_person || null,
          search: null, // Search is handled separately
        });
        hasFilters = Boolean(
          filtersWithoutSearch.customer ||
            filtersWithoutSearch.service ||
            filtersWithoutSearch.origin ||
            filtersWithoutSearch.destination ||
            filtersWithoutSearch.frequency ||
            filtersWithoutSearch.sales_person
        );
      }

      // Restore search
      let hasSearch = false;
      if (
        typeof restoredState.search === "string" &&
        restoredState.search.trim()
      ) {
        setSearchQuery(restoredState.search);
        hasSearch = true;
      }

      // Wait for state updates to flush (including debounced search)
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Set applied filters and filtersApplied if we have filters or search
      if (hasFilters || hasSearch) {
        const filtersToApply: FilterState = {
          customer: restoredFilters?.customer || null,
          service: restoredFilters?.service || null,
          origin: restoredFilters?.origin || null,
          destination: restoredFilters?.destination || null,
          frequency: restoredFilters?.frequency || null,
          sales_person: restoredFilters?.sales_person || null,
          search: hasSearch ? restoredState.search.trim() : null,
        };
        setAppliedFilters(filtersToApply);
        setFiltersApplied(true);
      }
    };

    if(restoredState?.shouldRestore){
      performRestore();
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle refresh when navigating from PipelineCreate
  useEffect(() => {
    if (location.state?.refreshData) {
      // Invalidate and refetch pipeline data to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      refetchPipeline();

      // Clear the refresh state to prevent unnecessary refetches
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state?.refreshData,
    refetchPipeline,
    navigate,
    location.pathname,
    queryClient,
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

  // Display data - single source from pipeline query
  const displayData = useMemo(() => {
    return pipelineData;
  }, [pipelineData]);

  // Loading state - show loader when initial load, fetching, or when navigating from create/edit
  const isLoading = useMemo(() => {
    return pipelineLoading || pipelineFetching;
  }, [pipelineLoading, pipelineFetching]);

  // Helper function to save filters and search to store
  const saveFiltersToStore = useCallback(() => {
    const filtersWithValues = {
      customer: filterForm.values.customer,
      service: filterForm.values.service,
      origin: filterForm.values.origin,
      destination: filterForm.values.destination,
      frequency: filterForm.values.frequency,
      sales_person: filterForm.values.sales_person,
    };
    setStoreFilters(LIST_KEY, filtersWithValues);
    setStoreSearch(LIST_KEY, searchQuery);
  }, [
    filterForm.values,
    searchQuery,
    setStoreFilters,
    setStoreSearch,
  ]);

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
          search: null,
        });

        // Query will automatically refetch when appliedFilters changes (it's in the query key)
        await queryClient.invalidateQueries({ queryKey: ["pipeline"] });

        // Clear filters and search from store
        clearStoreFilters(LIST_KEY);
        clearStoreSearch(LIST_KEY);

        console.log("No filter values provided, showing unfiltered data");
        return;
      }

      // Store the current filter form values as applied filters
      const filtersToApply: FilterState = {
        customer: filterForm.values.customer,
        service: filterForm.values.service,
        origin: filterForm.values.origin,
        destination: filterForm.values.destination,
        frequency: filterForm.values.frequency,
        sales_person: filterForm.values.sales_person,
        search: appliedFilters.search,
      };
      setAppliedFilters(filtersToApply);

      setPageIndex(0); // Reset to first page when applying filters
      setFiltersApplied(true); // Mark filters as applied

      setShowFilters(false);
      
      // Save filters and search to store
      saveFiltersToStore();
      
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
      search: null,
    });

    // Invalidate queries and refetch pipeline data
    await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    await refetchPipeline();

    // Clear filters and search from store
    clearStoreFilters(LIST_KEY);
    clearStoreSearch(LIST_KEY);

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Trigger filtered API when debounced search changes
  useEffect(() => {
    const trimmedSearch = debouncedSearch.trim();

    // If nothing is applied and search is empty, nothing to do
    if (!filtersApplied && trimmedSearch === "") {
      return;
    }

    const runSearchEffect = async () => {
      try {
        if (trimmedSearch !== "") {
          setPageIndex(0);

          setAppliedFilters((prev) => ({
            ...prev,
            search: trimmedSearch,
          }));

          setFiltersApplied(true);
          
          // Save filters and search to store
          saveFiltersToStore();
        } else {
          // Search cleared
          setAppliedFilters((prev) => ({
            ...prev,
            search: null,
          }));

          const hasOtherFilters =
            appliedFilters.customer ||
            appliedFilters.service ||
            appliedFilters.origin ||
            appliedFilters.destination ||
            appliedFilters.frequency ||
            appliedFilters.sales_person;

          if (hasOtherFilters) {
            // Save filters and search to store (with cleared search)
            saveFiltersToStore();
          } else {
            setFiltersApplied(false);
            // Query will automatically refetch when appliedFilters changes
            
            // Clear filters and search from store
            clearStoreFilters(LIST_KEY);
            clearStoreSearch(LIST_KEY);
          }
        }
      } catch (error) {
        console.error("Error applying search filter:", error);
      }
    };

    void runSearchEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

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
                    useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
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
                    <IconEye size={16} style={{ color: "#2563EB" }} />
                    <Text size="sm">View</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
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
                    <IconEdit size={16} style={{ color: "#2563EB" }} />
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

  return (
    <>
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
            flex:1,
        }}
      >
        <Box >
          <Group justify="space-between" align="center" pb="sm">
            <Text
              size="md"
              fw={600}
              c={"#1E293B"}
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              List of Pipelines
            </Text>

            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="Search pipelines"
                leftSection={<IconSearch size={16} />}
                rightSection={
                  searchQuery ? (
                    <ActionIcon
                      variant="transparent"
                      size="sm"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery("")}
                      style={{ cursor: "pointer" }}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
                w={260}
                size="xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
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
                      border: "1px solid #2563EB",
                    },
                  },
                }}
              />
              <ActionIcon
                variant={showFilters ? "filled" : "outline"}
                size={36}
                color={showFilters ? "#E0F5FF" : "gray"}
                onClick={() => setShowFilters(!showFilters)}
                styles={{
                  root: {
                    borderRadius: "4px",
                    backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                    border: showFilters ? "1px solid #2563EB" : "1px solid #737780",
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

              <Button
                leftSection={<IconPlus size={16} />}
                size="sm"
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
                onClick={() => {
                  useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                  navigate("/pipeline/create");
                }}
              >
                Create New
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Filter Section */}
        {showFilters && (
          <Box
            tt="capitalize"
            mb="xs"
            style={{
              borderRadius: "8px",
              border: "1px solid #E0E0E0",
              flexShrink: 0,
              height: "fit-content",
            }}
          >
            <Group justify="space-between" align="center" mb="sm" px="md" style={{ backgroundColor: "#F8FAFC", padding: "8px 8px", borderRadius: "8px" }}>
              <Text size="sm" fw={600} c="#1E293B" style={{ fontFamily: "Inter", fontSize: "14px" }}>
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

            <Grid gutter="md" px="md">
              {/* Sales Person Filter */}
              <Grid.Col span={2.4}>
                <Select
                  key={`sales-person-${filterForm.values.sales_person}-${salespersonsLoading}-${salespersonOptions.length}`}
                  label="Sales Person"
                  placeholder={
                    salespersonsLoading
                      ? "Loading salespersons..."
                      : "Select Service"
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

              {/* Customer Name Filter */}
              <Grid.Col span={2.4}>
                <SearchableSelect
                  size="xs"
                  label="Customer Name"
                  placeholder="Select Service"
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
                  className="filter-searchable-select"
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
                    { value: "AIR", label: "AIR" },
                    { value: "FCL", label: "FCL" },
                    { value: "LCL", label: "LCL" },
                  ]}
                  value={filterForm.values.service}
                  onChange={(value) =>
                    filterForm.setFieldValue("service", value || "")
                  }
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

              {/* Origin Filter */}
              <Grid.Col span={2.4}>
                <SearchableSelect
                  size="xs"
                  label="Origin"
                  placeholder="Type Origin Code"
                  apiEndpoint={URL.portMaster}
                  searchFields={["port_name", "port_code"]}
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
                  placeholder="Type Destination Code"
                  apiEndpoint={URL.portMaster}
                  searchFields={["port_name", "port_code"]}
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

              {/* Frequency Filter */}
              <Grid.Col span={2.4}>
                <Select
                  key={`frequency-${filterForm.values.frequency}-${frequencyDataLoading}-${frequencyOptionsData.length}`}
                  label="Frequency"
                  placeholder={
                    frequencyDataLoading
                      ? "Loading frequencies..."
                      : "Select Service"
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
            </Grid>

            <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
              <Button
                size="sm"
                variant="default"
                onClick={clearAllFilters}
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
                Clear
              </Button>
              <Button
                size="sm"
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
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
                Apply
              </Button>
            </Group>
          </Box>
        )}

        {isLoading ? (
          <Center py="xl" style={{flex:1}}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#2563EB" />
              <Text c="dimmed">Loading pipeline data...</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable
              key={`table-${displayData.length}`}
              table={table}
            />

            {/* Custom Pagination Bar */}
            <Group
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
              {/* Rows per page and range */}
              <Group gap="sm" align="center" wrap="nowrap">
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
              <Group gap="xs" align="center" wrap="nowrap">
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
