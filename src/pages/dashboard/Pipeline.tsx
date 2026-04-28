import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  ActionIcon,
  Button,
  Text,
  Grid,
  Box,
  TextInput,
  MantineProvider,
  Select,
} from "@mantine/core";
import {
  IconPlus,
  IconFilter,
  IconX,
  IconSearch,
  IconUsers,
  IconCoin,
  IconChartBar,
  IconRoute,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import {
  ToastNotification,
  SearchableSelect,
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistRootTypography,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  erpListGeistMantineTheme,
  erpListGeistSelectClassNames,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  type ErpListTheme,
} from "../../components";
import { PipelineListNativeTable, type PipelineListRow } from "./PipelineListNativeTable";
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

/** Top-level `summary` from `pipeline/filter/` (filter-scoped totals across all matching rows). */
type PipelineApiSummary = {
  total_profit?: number;
  total_volume?: number;
};

type PipelineQueryResult = {
  results: CustomerPipelineData[];
  summary: PipelineApiSummary;
  /** Mirrors API `total_count` — total rows matching filters (all pages). */
  totalCount: number;
};

const EMPTY_PIPELINE_QUERY: PipelineQueryResult = {
  results: [],
  summary: {},
  totalCount: 0,
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
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
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

  // Single query: server pagination + summary totals from API (`summary.total_profit`, `summary.total_volume`, `total_count`)
  const {
    data: pipelineQueryResult,
    isLoading: pipelineLoading,
    isFetching: pipelineFetching,
    refetch: refetchPipeline,
  } = useQuery({
    queryKey: ["pipeline", appliedFilters, debouncedSearch, listCurrentPage, listPageSize],
    queryFn: async (): Promise<PipelineQueryResult> => {
      try {
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

        let searchValue =
          (appliedFilters.search ?? "").toString().trim() || "";
        const debouncedTrimmed = debouncedSearch.trim();
        if (debouncedTrimmed) {
          searchValue = debouncedTrimmed;
        }
        if (searchValue) {
          payload.search = searchValue;
        }

        const requestBody: Record<string, unknown> = {
          page: listCurrentPage,
          page_size: listPageSize,
        };
        if (Object.keys(payload).length > 0) {
          requestBody.filters = payload;
        }

        const response = await apiCallProtected.post(
          URL.pipelineFilter,
          requestBody
        );
        const raw =
          (response as { data?: unknown }).data ?? (response as unknown);

        const r = raw as {
          results?: CustomerPipelineData[];
          summary?: PipelineApiSummary;
          total_count?: number;
        };

        const results = Array.isArray(r.results) ? r.results : [];
        const summary = r.summary ?? {};
        const tp = Number(summary.total_profit);
        const tv = Number(summary.total_volume);

        const totalCountRaw = r.total_count;
        const totalCount =
          typeof totalCountRaw === "number" && Number.isFinite(totalCountRaw)
            ? Math.floor(totalCountRaw)
            : results.length;

        return {
          results,
          summary: {
            total_profit: Number.isFinite(tp) ? tp : 0,
            total_volume: Number.isFinite(tv) ? tv : 0,
          },
          totalCount,
        };
      } catch (error) {
        console.error("Error fetching pipeline data:", error);
        return { ...EMPTY_PIPELINE_QUERY };
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  const pipelinePage =
    pipelineQueryResult ?? EMPTY_PIPELINE_QUERY;
  const pipelineData = pipelinePage.results;

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

      setListCurrentPage(1);
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
    setListCurrentPage(1);
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
          setListCurrentPage(1);

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

  const erpTheme: ErpListTheme = {
    border: DEFAULT_ERP_LIST_THEME.border,
    muted: DEFAULT_ERP_LIST_THEME.muted,
    fg: DEFAULT_ERP_LIST_THEME.fg,
    primary: DEFAULT_ERP_LIST_THEME.primary,
    headerBg: DEFAULT_ERP_LIST_THEME.headerBg,
    pageBg: DEFAULT_ERP_LIST_THEME.pageBg,
    cardBg: DEFAULT_ERP_LIST_THEME.cardBg,
    fontSans: DEFAULT_ERP_LIST_THEME.fontSans,
  };
  const { border, muted, primary, fontSans, fg } = erpTheme;

  /** Sub-header stats from API `summary` + `total_count` (same pattern as Air Export Booking summary pills). */
  const pipelineStats = useMemo(() => {
    const q = pipelineQueryResult ?? EMPTY_PIPELINE_QUERY;
    const profit = Number(q.summary.total_profit);
    const vol = Number(q.summary.total_volume);
    return {
      totalRows: q.totalCount,
      profit: Number.isFinite(profit) ? profit : 0,
      vol: Number.isFinite(vol) ? vol : 0,
    };
  }, [
    pipelineQueryResult?.totalCount,
    pipelineQueryResult?.summary?.total_profit,
    pipelineQueryResult?.summary?.total_volume,
  ]);

  useEffect(() => {
    if (listPageSize <= 0) return;
    if (pipelineFetching) return;
    const totalRecords = pipelineQueryResult?.totalCount ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalRecords / listPageSize));
    if (listCurrentPage > totalPages) {
      setListCurrentPage(totalPages);
    }
  }, [
    pipelineQueryResult?.totalCount,
    listPageSize,
    listCurrentPage,
    pipelineFetching,
  ]);

  const pipelineTableRows: PipelineListRow[] = useMemo(() => {
    return displayData.map((r, i) => ({
      sno: (listCurrentPage - 1) * listPageSize + i + 1,
      customer_code: r.customer_code,
      customer_name: r.customer_name,
      created_by: r.created_by,
      total_profit: r.total_profit,
      total_volume: r.total_volume,
      pipelines: r.pipelines,
      raw: {
        customer_code: r.customer_code,
        customer_name: r.customer_name,
        created_by: r.created_by,
        pipelines: r.pipelines,
        total_profit: r.total_profit,
        total_volume: r.total_volume,
      },
    }));
  }, [displayData, listCurrentPage, listPageSize]);

  const openPipeline = useCallback(
    (row: PipelineListRow, actionType: "view" | "edit") => {
      useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
      navigate("/pipeline/create", {
        state: {
          customer_code: row.customer_code,
          customer_name: row.customer_name,
          pipelines: row.raw.pipelines,
          actionType,
          returnTo: "/pipeline",
        },
      });
    },
    [navigate]
  );

  const tableLoading = pipelineLoading || pipelineFetching;

  return (
    <>
      <MantineProvider theme={erpListGeistMantineTheme}>
        <Box className={ERP_LIST_GEIST_ROOT_CLASS} style={erpListGeistRootTypography}>
          <ERPListScreen
            theme={erpTheme}
            className={ERP_LIST_GEIST_ROOT_CLASS}
            toolbar={{
              leading: (
                <>
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconUsers size={14} color={primary} />}
                    value={pipelineStats.totalRows.toLocaleString()}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCoin size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={Math.round(pipelineStats.profit).toLocaleString()}
                    label="Total profit"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconChartBar size={14} color="#105476" />}
                    iconBackground="#dbeafe"
                    iconColor="#105476"
                    value={Number.isFinite(pipelineStats.vol)
                      ? pipelineStats.vol.toLocaleString(undefined, { maximumFractionDigits: 1 })
                      : "0"}
                    label="Total volume"
                  />
                </>
              ),
              secondary: (
                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  List of Pipelines
                </Text>
              ),
              actions: (
                <>
                  <TextInput
                    placeholder="Search pipelines"
                    leftSection={<IconSearch size={16} />}
                    rightSection={
                      searchQuery ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          aria-label="Clear search"
                          onClick={() => {
                            setSearchQuery("");
                            clearStoreSearch(LIST_KEY);
                          }}
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
                    classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                    styles={{
                      input: {
                        fontFamily: fontSans,
                        fontSize: 12,
                        height: 32,
                        borderColor: border,
                      },
                    }}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    styles={erpToolbarOutlineButtonStyles(erpTheme)}
                    leftSection={<IconFilter size={14} />}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    {showFilters ? "Hide filters" : "Filters"}
                  </Button>
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                    onClick={() => {
                      useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                      navigate("/pipeline/create");
                    }}
                  >
                    Create New
                  </Button>
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: "Refine by customer, service, route, or frequency",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={clearAllFilters}
                  onApply={applyFilters}
                  applyLoading={isLoading}
                  applyDisabled={isLoading}
                />
              ),
              children: (
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
              {/* Sales Person Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
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
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Customer Name Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
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
                  dropdownZIndex={1000}
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                  className="filter-searchable-select"
                />
                </Box>
              </Grid.Col>

              {/* Service Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
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
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Origin Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
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
                  dropdownZIndex={1000}
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                  className="filter-searchable-select"
                />
                </Box>
              </Grid.Col>

              {/* Destination Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
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
                  dropdownZIndex={1000}
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                  className="filter-searchable-select"
                />
                </Box>
              </Grid.Col>

              {/* Frequency Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
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
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>
            </Grid>
              ),
            }}
            table={{
              footer: (
                <ERPListPaginationFooter
                  theme={erpTheme}
                  totalRecords={pipelineStats.totalRows}
                  pageIndex={listCurrentPage - 1}
                  pageSize={listPageSize}
                  onPageIndexChange={(idx) => setListCurrentPage(idx + 1)}
                  onPageSizeChange={(size) => {
                    setListPageSize(size);
                    setListCurrentPage(1);
                  }}
                  pageSizeOptions={["10", "25", "50"]}
                  selectClassNames={{
                    dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                    option: ERP_LIST_GEIST_ROOT_CLASS,
                  }}
                />
              ),
              children: tableLoading ? (
                <ERPListTableLoading
                  theme={erpTheme}
                  message="Loading pipeline data…"
                />
              ) : (
                <Box
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <PipelineListNativeTable
                    theme={erpTheme}
                    rows={pipelineTableRows}
                    isEmpty={displayData.length === 0}
                    onView={(row) => openPipeline(row, "view")}
                    onEdit={(row) => openPipeline(row, "edit")}
                  />
                </Box>
              ),
            }}
          />
        </Box>
      </MantineProvider>
    </>
  );
}
export default Pipeline;
