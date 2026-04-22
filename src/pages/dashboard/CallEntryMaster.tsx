import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TextInput,
  Grid,
  Box,
  Divider,
  Flex,
  Center,
  Stack,
  Menu,
  UnstyledButton,
  Badge,
  Tooltip,
  Modal,
  Textarea,
} from "@mantine/core";
import {
  IconCalendarTime,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFilterOff,
  IconPlus,
  IconSearch,
  IconCalendar,
  IconFilter,
  IconDots,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconX,
  IconArrowLeft,
  IconFileText,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { getAPICall } from "../../service/getApiCall";
import { deleteApiCall } from "../../service/deleteApiCall";
import { putAPICall } from "../../service/putApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import {
  ToastNotification,
  SearchableSelect,
  DateRangeInput,
  SingleDateInput,
} from "../../components";
import PaginationBar from "../../components/PaginationBar/PaginationBar";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { searchAPI } from "../../service/searchApi";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { useListFilterStore } from "../../store/listFilterStore";
import useDateFormat from "../../hooks/useDateFormat";

type CompanyData = {
  id: number;
  company_code: string;
  company_name: string;
  website: string;
  reporting_name: string;
  status: string;
  city: string;
  address: string;
  group_name: string;
};

type FilterState = {
  customer: string | null;
  call_date: Date | null;
  call_mode: string | null;
  followup_date: Date | null;
  status: string | null;
  sales_person: string | null;
  city: string | null;
  area: string | null;
  date_from: string | null;
  date_to: string | null;
  search?: string | null; // Optional search field for appliedFilters
};

const LIST_KEY = "CALL_ENTRY_MASTER";

type CallEntryPageResult = { items: any[]; total: number };

function parseCallEntryFilterResponse(data: any): CallEntryPageResult {
  let items: any[] = [];
  if (data && Array.isArray(data.data)) {
    items = data.data;
  } else if (data && Array.isArray(data.results)) {
    items = data.results;
  } else if (data && Array.isArray(data.result)) {
    items = data.result;
  }
  const totalRaw = data?.total ?? data?.count;
  const total =
    typeof totalRaw === "number" && !Number.isNaN(totalRaw)
      ? totalRaw
      : items.length;
  return { items, total };
}

function CallEntry() {
  // Get first day of current month and today's date
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const getDefaultToDate = (): Date => {
    return new Date();
  };

  const dateFormat = useDateFormat();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const queryClient = useQueryClient();

  // Date range state
  const [fromDate, setFromDate] = useState<Date | null>(getDefaultFromDate());
  const [toDate, setToDate] = useState<Date | null>(getDefaultToDate());
  const isMountedRef = useRef(false);

  // Store initial dates for the main query (these won't change when user modifies dates)
  const initialFromDateRef = useRef<Date | null>(getDefaultFromDate());
  const initialToDateRef = useRef<Date | null>(getDefaultToDate());

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      customer: null,
      call_date: null,
      call_mode: null,
      followup_date: null,
      status: null,
      sales_person: null,
      city: null,
      area: null,
      date_from: null,
      date_to: null,
    },
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Refs to persist returnToDashboard flag and dashboard state
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard)
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state
  const fromDashboardRef = useRef<boolean>(
    Boolean(location.state?.fromDashboard)
  ); // Track if page was opened from dashboard
  const initialFiltersProcessed = useRef(false);
  const isProcessingInitialFilters = useRef(false); // Track if we're currently processing initial filters

  //Search Debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const prevSearchRef = useRef<string>(searchQuery);
  const [isClosingCallEntry, setIsClosingCallEntry] = useState(false);
  const [closeModalOpened, { open: openCloseModal, close: closeCloseModal }] =
    useDisclosure(false);
  const [selectedCallEntryForClose, setSelectedCallEntryForClose] = useState<
    any | null
  >(null);
  const [remark, setRemark] = useState<string>("");
  const [openedMenuRowId, setOpenedMenuRowId] = useState<number | null>(null);
  const hasRestoredFromStore = useRef(false);

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const clearStoreAll = useListFilterStore((state) => state.clearAll);
  const clearStoreAllExcept = useListFilterStore(
    (state) => state.clearAllExcept
  );

  // Store display values (labels) for SearchableSelect fields
  const [customerDisplayValue, setCustomerDisplayValue] = useState<
    string | null
  >(null);

  // Debounced search effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Remove old state variables since React Query handles this now

  // Fetch call entry data with React Query - using filter API with date range on initial mount
  const {
    data: callEntryResult = { items: [], total: 0 },
    isLoading: callEntryLoading,
    refetch: refetchCallEntries,
  } = useQuery({
    queryKey: ["callEntries", pageIndex, pageSize],
    queryFn: async () => {
      try {
        // Use dates from location.state if available (from Dashboard), otherwise use initial dates
        // Dates are not in queryKey so changes won't trigger refetch
        // Only Apply Filters button will use the new dates via appliedFilters
        const requestBody: { filters: any } = { filters: {} };

        // Use default date range for initial load
        let dateFrom: string | null = null;
        let dateTo: string | null = null;

        if (initialFromDateRef.current && initialToDateRef.current) {
          dateFrom = dayjs(initialFromDateRef.current).format("YYYY-MM-DD");
          dateTo = dayjs(initialToDateRef.current).format("YYYY-MM-DD");
        }

        // Add date range if both dates are available
        if (dateFrom && dateTo) {
          requestBody.filters = {
            date_from: dateFrom,
            date_to: dateTo,
          };
        }

        const index = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.filter_call_entries}?index=${index}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        return parseCallEntryFilterResponse(data);
      } catch (error) {
        console.error("Error fetching call entry data:", error);
        return { items: [], total: 0 };
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
    call_date: null,
    call_mode: null,
    followup_date: null,
    status: null,
    sales_person: null,
    city: null,
    area: null,
    date_from: null,
    date_to: null,
  });

  // Separate query for filtered data - triggers on Apply Filters, Clear Filters, Search changes, Navigation back
  const {
    data: filteredCallEntryResult = { items: [], total: 0 },
    isLoading: filteredCallEntryLoading,
    isFetching: filteredCallEntryFetching,
    refetch: refetchFilteredCallEntries,
  } = useQuery({
    queryKey: [
      "filteredCallEntries",
      filtersApplied,
      appliedFilters,
      debouncedSearch, // Include debouncedSearch in queryKey to trigger on search changes
      pageIndex,
      pageSize,
    ],
    queryFn: async () => {
      try {
        const filterPayload = buildFilterPayload();
        
        // If no filters and no search, return empty (will use unfiltered data)
        if (Object.keys(filterPayload).length === 0) {
          console.log("No filters or search, skipping API call");
          return { items: [], total: 0 };
        }

        const requestBody = { filters: filterPayload };
        console.log("📤 API Call - Applying filters + search:", {
          payload: filterPayload,
          filtersApplied,
          searchQuery,
          debouncedSearch,
        });

        const index = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.filter_call_entries}?index=${index}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Filter API response:", data);

        return parseCallEntryFilterResponse(data);
      } catch (error) {
        console.error("Error fetching filtered call entry data:", error);
        return { items: [], total: 0 };
      }
    },
    // Disable query during refreshData to prevent auto-trigger from queryKey changes
    // Only manually refetch after state is fully restored
    enabled: (filtersApplied || Boolean(debouncedSearch.trim())) && !isRefreshingData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Clear all store entries except this page's key on mount
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
        // Restore filter form values
        filterForm.setValues({
          customer: restoredFilters.customer || null,
          call_date: restoredFilters.call_date
            ? (typeof restoredFilters.call_date === 'string'
                ? dayjs(restoredFilters.call_date, "YYYY-MM-DD", true).toDate()
                : restoredFilters.call_date)
            : null,
          call_mode: restoredFilters.call_mode || null,
          followup_date: restoredFilters.followup_date
            ? (typeof restoredFilters.followup_date === 'string'
                ? dayjs(restoredFilters.followup_date, "YYYY-MM-DD", true).toDate()
                : restoredFilters.followup_date)
            : null,
          status: restoredFilters.status || null,
          sales_person: restoredFilters.sales_person || null,
          city: restoredFilters.city || null,
          area: restoredFilters.area || null,
          date_from: restoredFilters.date_from || null,
          date_to: restoredFilters.date_to || null,
        });

        // Restore date range if available
        if (restoredFilters.date_from && restoredFilters.date_to) {
          const parsedFrom = dayjs(restoredFilters.date_from, "YYYY-MM-DD", true);
          const parsedTo = dayjs(restoredFilters.date_to, "YYYY-MM-DD", true);
          if (parsedFrom.isValid()) setFromDate(parsedFrom.toDate());
          if (parsedTo.isValid()) setToDate(parsedTo.toDate());
        }

        hasFilters = Boolean(
          restoredFilters.customer ||
          restoredFilters.call_date ||
          restoredFilters.call_mode ||
          restoredFilters.followup_date ||
          restoredFilters.status ||
          restoredFilters.sales_person ||
          restoredFilters.city ||
          restoredFilters.area ||
          (restoredFilters.date_from && restoredFilters.date_to)
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
        const restoredDateFrom = restoredFilters?.date_from || null;
        const restoredDateTo = restoredFilters?.date_to || null;

        setAppliedFilters({
          customer: restoredFilters?.customer || null,
          call_date: restoredFilters?.call_date || null,
          call_mode: restoredFilters?.call_mode || null,
          followup_date: restoredFilters?.followup_date || null,
          status: restoredFilters?.status || null,
          sales_person: restoredFilters?.sales_person || null,
          city: restoredFilters?.city || null,
          area: restoredFilters?.area || null,
          date_from: restoredDateFrom,
          date_to: restoredDateTo,
          search: restoredState.search || null,
        });

        setFiltersApplied(true);
        // Invalidate query to trigger refetch with restored filters/search
        queryClient.invalidateQueries({
          queryKey: ["filteredCallEntries"],
        });
      }
    };

    if(restoredState?.shouldRestore){
      performRestore();
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync refs with location.state when it changes
  useEffect(() => {
    if (location.state?.returnToDashboard !== undefined) {
      returnToDashboardRef.current = Boolean(location.state.returnToDashboard);
    }
    if (location.state?.dashboardState !== undefined) {
      dashboardStateRef.current = location.state.dashboardState;
    }
    if (location.state?.fromDashboard !== undefined) {
      fromDashboardRef.current = Boolean(location.state.fromDashboard);
    }
  }, [
    location.state?.returnToDashboard,
    location.state?.dashboardState,
    location.state?.fromDashboard,
  ]);

  // Apply filters when navigated from call entry dashboard (drill level badge click)
  // Dashboard passes initialFilters + restoreFilters in location.state; listFilterStore is only used when returning from edit.
  useEffect(() => {
    if (initialFiltersProcessed.current) return;
    const state = location.state as {
      fromDashboard?: boolean;
      restoreFilters?: {
        filters: Partial<FilterState>;
        displayValues?: { customer?: string | null };
        fromDate?: Date | null;
        toDate?: Date | null;
        filtersApplied?: boolean;
      };
      initialFilters?: {
        sales_person?: string | null;
        customer?: string | null;
        status?: string | null;
        date_from?: string;
        date_to?: string;
      };
    } | null;
    if (!state?.fromDashboard) return;
    const restoreFilters = state.restoreFilters;
    const initialFilters = state.initialFilters;
    if (!restoreFilters && !initialFilters) return;

    initialFiltersProcessed.current = true;
    isProcessingInitialFilters.current = true;

    const filters = restoreFilters?.filters ?? {
      sales_person: initialFilters?.sales_person ?? null,
      customer: initialFilters?.customer ?? null,
      status: initialFilters?.status ?? null,
      call_date: null,
      call_mode: null,
      followup_date: null,
      city: null,
      area: null,
    };
    const displayValues = restoreFilters?.displayValues ?? {};
    const fromDateVal = restoreFilters?.fromDate ?? (initialFilters?.date_from ? new Date(initialFilters.date_from) : null);
    const toDateVal = restoreFilters?.toDate ?? (initialFilters?.date_to ? new Date(initialFilters.date_to) : null);
    const dateFromStr = initialFilters?.date_from ?? (fromDateVal ? dayjs(fromDateVal).format("YYYY-MM-DD") : null);
    const dateToStr = initialFilters?.date_to ?? (toDateVal ? dayjs(toDateVal).format("YYYY-MM-DD") : null);

    filterForm.setValues({
      customer: filters.customer ?? null,
      call_date: filters.call_date ?? null,
      call_mode: filters.call_mode ?? null,
      followup_date: filters.followup_date ?? null,
      status: filters.status ?? null,
      sales_person: filters.sales_person ?? null,
      city: filters.city ?? null,
      area: filters.area ?? null,
      date_from: dateFromStr,
      date_to: dateToStr,
    });

    if (fromDateVal) setFromDate(fromDateVal);
    if (toDateVal) setToDate(toDateVal);
    setCustomerDisplayValue(displayValues.customer ?? (filters.customer ? String(filters.customer) : null));

    setAppliedFilters({
      customer: filters.customer ?? null,
      call_date: filters.call_date ?? null,
      call_mode: filters.call_mode ?? null,
      followup_date: filters.followup_date ?? null,
      status: filters.status ?? null,
      sales_person: filters.sales_person ?? null,
      city: filters.city ?? null,
      area: filters.area ?? null,
      date_from: dateFromStr,
      date_to: dateToStr,
    });
    setFiltersApplied(true);

    // Persist to listFilterStore so back-navigation and refresh behave consistently
    setStoreFilters(LIST_KEY, {
      ...filters,
      date_from: dateFromStr,
      date_to: dateToStr,
    });
    if (displayValues.customer != null) {
      useListFilterStore.getState().setDisplayValues(LIST_KEY, { customer: displayValues.customer });
    }

    // Clear initial filters from state so we don't re-apply on re-render; keep dashboard return state
    navigate(location.pathname, {
      replace: true,
      state: {
        returnToDashboard: returnToDashboardRef.current,
        dashboardState: dashboardStateRef.current,
        fromDashboard: fromDashboardRef.current,
      },
    });

    isProcessingInitialFilters.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.fromDashboard, location.state?.restoreFilters, location.state?.initialFilters, location.pathname]);

  // Note: Filter and search restoration from listFilterStore runs when shouldRestore (e.g. return from edit). Dashboard filters applied above.

  // Load data on mount with default dates - API only hits on Apply Filters button
  // Date changes don't trigger API automatically - only Apply Filters button does

  // Ref to prevent search change effect from triggering during refreshData restoration
  const isRefreshingDataRef = useRef(false);

  // Handle search changes - trigger API when search value changes (debounced)
  useEffect(() => {
    // Skip if component is not ready
    if (!hasRestoredFromStore.current) {
      prevSearchRef.current = debouncedSearch;
      return;
    }

    // Skip if we're currently refreshing data (prevent multiple API calls during refreshData)
    if (isRefreshingDataRef.current) {
      prevSearchRef.current = debouncedSearch;
      return;
    }

    // Only trigger API if search actually changed (debounced)
    if (prevSearchRef.current === debouncedSearch) {
      return;
    }

    // Update ref for next comparison
    prevSearchRef.current = debouncedSearch;

    setPageIndex(0);

    // Save search to store immediately
    setStoreSearch(LIST_KEY, searchQuery);
    
    // Trigger API with loading state
    setIsRefreshingData(true);
    
    if (debouncedSearch.trim() !== "") {
      // Search exists - trigger filtered API (search will be merged with filters in buildFilterPayload)
      refetchFilteredCallEntries()
        .then(() => {
          setFiltersApplied(true);
        })
        .then(() => {
          setIsRefreshingData(false);
        })
        .catch(() => {
          setIsRefreshingData(false);
        });
    } else {
      // Search cleared - check if we have other filters
      const hasOtherFilters =
        appliedFilters.customer ||
        appliedFilters.call_date ||
        appliedFilters.call_mode ||
        appliedFilters.followup_date ||
        appliedFilters.status ||
        appliedFilters.sales_person ||
        appliedFilters.city ||
        appliedFilters.area ||
        (fromDate && toDate);

      if (hasOtherFilters) {
        // Still have filters - refetch filtered data
        refetchFilteredCallEntries()
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch(() => {
            setIsRefreshingData(false);
          });
      } else {
        // No filters - show unfiltered data
        setFiltersApplied(false);
        refetchCallEntries()
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch(() => {
            setIsRefreshingData(false);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Handle refresh when navigating from create/edit operations
  useEffect(() => {
    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation");
      
      // Mark that we're handling refreshData so search change effect doesn't interfere
      if (!hasRestoredFromStore.current) {
        hasRestoredFromStore.current = true;
      }
      
      // Set flag to prevent search change effect from triggering
      isRefreshingDataRef.current = true;
      setIsRefreshingData(true);

      // Clear the refresh flag but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });

      // Restore from store and refresh data - SINGLE API CALL ONLY
      const refreshData = async () => {
        try {
          // Check if we have filters or search from store
          const restoredState = useListFilterStore.getState().getState(LIST_KEY);
          const hasActiveFilters = restoredState?.filters && Object.keys(restoredState.filters).length > 0;
          const hasActiveSearch = restoredState?.search && restoredState.search.trim() !== "";

          // If we have filters/search in store but not in state, restore them first
          if (restoredState && (hasActiveFilters || hasActiveSearch)) {
            // Restore filters from store if they exist
            if (hasActiveFilters) {
              const restoredFilters = restoredState.filters as FilterState;
              filterForm.setValues({
                customer: restoredFilters.customer || null,
                call_date: restoredFilters.call_date
                  ? (typeof restoredFilters.call_date === 'string'
                      ? dayjs(restoredFilters.call_date, "YYYY-MM-DD", true).toDate()
                      : restoredFilters.call_date)
                  : null,
                call_mode: restoredFilters.call_mode || null,
                followup_date: restoredFilters.followup_date
                  ? (typeof restoredFilters.followup_date === 'string'
                      ? dayjs(restoredFilters.followup_date, "YYYY-MM-DD", true).toDate()
                      : restoredFilters.followup_date)
                  : null,
                status: restoredFilters.status || null,
                sales_person: restoredFilters.sales_person || null,
                city: restoredFilters.city || null,
                area: restoredFilters.area || null,
              });

              // Restore date range
              if (restoredFilters.date_from && restoredFilters.date_to) {
                const parsedFrom = dayjs(restoredFilters.date_from, "YYYY-MM-DD", true);
                const parsedTo = dayjs(restoredFilters.date_to, "YYYY-MM-DD", true);
                if (parsedFrom.isValid()) setFromDate(parsedFrom.toDate());
                if (parsedTo.isValid()) setToDate(parsedTo.toDate());
              }

              setAppliedFilters({
                customer: restoredFilters.customer || null,
                call_date: restoredFilters.call_date || null,
                call_mode: restoredFilters.call_mode || null,
                followup_date: restoredFilters.followup_date || null,
                status: restoredFilters.status || null,
                sales_person: restoredFilters.sales_person || null,
                city: restoredFilters.city || null,
                area: restoredFilters.area || null,
                date_from: restoredFilters.date_from || null,
                date_to: restoredFilters.date_to || null,
                search: restoredState.search || null,
              });
            }

            // Restore search from store if it exists (update prevSearchRef to prevent search effect trigger)
            if (hasActiveSearch) {
              setSearchQuery(restoredState.search);
              prevSearchRef.current = restoredState.search; // Update to prevent search effect from triggering
            }

            // Wait for state updates to flush before calling API
            await new Promise((resolve) => setTimeout(resolve, 250));
          }

          // Determine if we should fetch filtered data - SINGLE API CALL
          const finalState = useListFilterStore.getState().getState(LIST_KEY);
          const finalHasActiveFilters = finalState?.filters && Object.keys(finalState.filters).length > 0;
          const finalHasActiveSearch = finalState?.search && finalState.search.trim() !== "";

          // Wait a bit more to ensure all state updates are flushed and query is disabled
          await new Promise((resolve) => setTimeout(resolve, 100));

          if (finalHasActiveFilters || finalHasActiveSearch) {
            console.log("✅ [refreshData] Fetching filtered data with preserved filters");
            // Set filtersApplied - query is disabled so won't auto-trigger
            setFiltersApplied(true);
            // Wait for state updates to flush (query remains disabled during this time)
            await new Promise((resolve) => setTimeout(resolve, 150));
            // Now enable query and manually refetch in one atomic operation
            // This ensures only ONE API call - query won't auto-trigger because we refetch immediately
            isRefreshingDataRef.current = false;
            setIsRefreshingData(false);
            // Use refetch directly - query is now enabled, but refetch ensures single call
            await refetchFilteredCallEntries();
          } else {
            console.log("🔄 [refreshData] Fetching unfiltered data");
            // Set filtersApplied - query is disabled so won't auto-trigger
            setFiltersApplied(false);
            // Wait for state to update (query remains disabled)
            await new Promise((resolve) => setTimeout(resolve, 150));
            // Release flag and refetch unfiltered data
            isRefreshingDataRef.current = false;
            setIsRefreshingData(false);
            await refetchCallEntries();
          }
        } catch (error) {
          console.error("Error refreshing data:", error);
          // Always release flag on error
          isRefreshingDataRef.current = false;
          setIsRefreshingData(false);
        } finally {
          // Ensure flag is cleared even if there's an error
          setIsRefreshingData(false);
        }
      };

      refreshData();
    }
  }, [
    location.state?.refreshData,
    navigate,
    location.pathname,
    filterForm,
  ]);

  // Note: Filter and search restoration from location.state removed - now handled via listFilterStore

  // Removed raw customer API call - using SearchableSelect for dynamic loading

  // Optimized call mode data query with memoization
  const {
    data: rawCallModeData = [],
    isLoading: callModeDataLoading,
    isError: callModeDataError,
  } = useQuery({
    queryKey: ["callModes"],
    queryFn: async () => {
      try {
        const callModeResponse = (await getAPICall(
          URL.callMode,
          API_HEADER
        )) as any[];
        return callModeResponse;
      } catch (error) {
        console.error("Error fetching call mode data:", error);
        return [];
      }
    },
    staleTime: Infinity, // Never refetch since it's master data
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const callModeOptionsData = useMemo(() => {
    if (!Array.isArray(rawCallModeData) || !rawCallModeData.length) return [];

    return rawCallModeData
      .filter((item: any) => item.id && item.callmode_name) // Filter out items with null/undefined values
      .map((item: any) => ({
        value: String(item.id),
        label: item.callmode_name,
      }))
      .filter(
        (option, index, self) =>
          // Remove duplicates based on value
          index === self.findIndex((o) => o.value === option.value)
      );
  }, [rawCallModeData]);
  console.log("callModeOptionsData---", callModeOptionsData);

  // Optimized follow-up action data query with memoization
  const {
    data: rawFollowUpActionData = [],
    isLoading: followUpActionDataLoading,
    isError: followUpActionDataError,
  } = useQuery({
    queryKey: ["followUpActions"],
    queryFn: async () => {
      try {
        const followUpResponse = (await getAPICall(
          URL.followUpAction,
          API_HEADER
        )) as any[];
        return followUpResponse;
      } catch (error) {
        console.error("Error fetching follow-up action data:", error);
        return [];
      }
    },
    staleTime: Infinity, // Never refetch since it's master data
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const followUpActionOptionsData = useMemo(() => {
    if (!Array.isArray(rawFollowUpActionData) || !rawFollowUpActionData.length)
      return [];
    console.log("rawFollowUpActionData---", rawFollowUpActionData);

    return rawFollowUpActionData
      .filter((item: any) => item.id && item.followup_name) // Filter out items with null/undefined values
      .map((item: any) => ({
        value: String(item.id),
        label: item.followup_name,
      }))
      .filter(
        (option, index, self) =>
          // Remove duplicates based on value
          index === self.findIndex((o) => o.value === option.value)
      );
  }, [rawFollowUpActionData]);
  console.log("followUpActionOptionsData---", followUpActionOptionsData);

  // Helper function to build filter payload (includes search in filters:{})
  // Moved here to ensure followUpActionOptionsData is available
  const buildFilterPayload = useCallback(() => {
    const payload: any = {};

    // Add date range if both dates are selected
    if (fromDate && toDate) {
      payload.date_from = dayjs(fromDate).format("YYYY-MM-DD");
      payload.date_to = dayjs(toDate).format("YYYY-MM-DD");
    }

    if (appliedFilters.customer) payload.customer_code = appliedFilters.customer;
    if (appliedFilters.call_date)
      payload.call_date = dayjs(appliedFilters.call_date).format("YYYY-MM-DD");
    if (appliedFilters.call_mode) payload.call_mode_id = appliedFilters.call_mode;
    if (appliedFilters.followup_date)
      payload.followup_date = dayjs(appliedFilters.followup_date).format("YYYY-MM-DD");
    if (appliedFilters.status) {
      // Check if status is from dashboard
      const dashboardStatuses = ["OVERDUE", "TODAY", "UPCOMING", "CLOSED"];
      const isDashboardStatus = dashboardStatuses.includes(
        String(appliedFilters.status).toUpperCase()
      );

      if (isDashboardStatus) {
        payload.status = appliedFilters.status;
      } else {
        // From filter form - find the followup action name by ID
        const selectedFollowUp = followUpActionOptionsData.find(
          (option: any) => option.value === appliedFilters.status
        );
        payload.followup_action_name =
          selectedFollowUp?.label || appliedFilters.status;
      }
    }
    if (appliedFilters.sales_person) payload.created_by = appliedFilters.sales_person;
    if (appliedFilters.city) payload.city = appliedFilters.city;
    if (appliedFilters.area) payload.area = appliedFilters.area;

    // Include search in filters:{} payload
    if (debouncedSearch.trim()) {
      payload.search = debouncedSearch.trim();
    } else if (searchQuery.trim()) {
      payload.search = searchQuery.trim();
    }

    return payload;
  }, [appliedFilters, fromDate, toDate, debouncedSearch, searchQuery, followUpActionOptionsData]);

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

  // Search data with React Query - DISABLED: search is now handled via filter API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _searchData, isLoading: _searchLoading } = useQuery({
    queryKey: ["callEntrySearch", debounced],
    queryFn: async () => {
      if (!debounced.trim()) return null;
      try {
        const result = await searchAPI(debounced, new AbortController().signal);
        return result?.results;
      } catch (error) {
        console.error("Search API Error:", error);
        return [];
      }
    },
    enabled: false, // Disabled - search is now handled via filter API
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Determine which data to display (server-paginated page from active query)
  const displayData = useMemo(() => {
    if (filtersApplied || debouncedSearch.trim()) {
      return filteredCallEntryResult.items;
    }
    console.log("Displaying unfiltered data:", callEntryResult.items);
    return callEntryResult.items || [];
  }, [
    callEntryResult.items,
    filteredCallEntryResult.items,
    filtersApplied,
    debouncedSearch,
  ]);

  const totalRecords = useMemo(() => {
    if (filtersApplied || debouncedSearch.trim()) {
      return filteredCallEntryResult.total;
    }
    return callEntryResult.total;
  }, [
    filtersApplied,
    debouncedSearch,
    filteredCallEntryResult.total,
    callEntryResult.total,
  ]);

  useEffect(() => {
    const totalPagesCount = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (pageIndex >= totalPagesCount) {
      setPageIndex(Math.max(0, totalPagesCount - 1));
    }
  }, [totalRecords, pageSize, pageIndex]);

  // Loading state - show loader until API response is received
  const isLoading = useMemo(() => {
    if (isClosingCallEntry || isRefreshingData) return true;
    if (filtersApplied || debouncedSearch.trim()) {
      return filteredCallEntryLoading || filteredCallEntryFetching;
    }
    return callEntryLoading;
  }, [
    callEntryLoading,
    filteredCallEntryLoading,
    filteredCallEntryFetching,
    filtersApplied,
    isClosingCallEntry,
    isRefreshingData,
    debouncedSearch,
  ]);

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values (including date range)
      const hasFilterValues =
        filterForm.values.customer ||
        filterForm.values.call_date ||
        filterForm.values.call_mode ||
        filterForm.values.followup_date ||
        filterForm.values.status ||
        filterForm.values.sales_person ||
        filterForm.values.city ||
        filterForm.values.area ||
        (fromDate && toDate);

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setPageIndex(0);
        setFiltersApplied(false);
        setAppliedFilters({
          customer: null,
          call_date: null,
          call_mode: null,
          followup_date: null,
          status: null,
          sales_person: null,
          city: null,
          area: null,
          date_from: null,
          date_to: null,
        });

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
        await refetchCallEntries();
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        console.log("No filter values provided, showing unfiltered data");
        return;
      }

      setPageIndex(0); // Reset to first page when applying filters
      setFiltersApplied(true); // Mark filters as applied

      // Prepare filters object for storage (without search, as it's stored separately)
      const filtersToStore: FilterState = {
        customer: filterForm.values.customer,
        call_date: filterForm.values.call_date,
        call_mode: filterForm.values.call_mode,
        followup_date: filterForm.values.followup_date,
        status: filterForm.values.status,
        sales_person: filterForm.values.sales_person,
        city: filterForm.values.city,
        area: filterForm.values.area,
        // Only add date filters if both dates are selected
        date_from:
          fromDate && toDate ? dayjs(fromDate).format("YYYY-MM-DD") : null,
        date_to: fromDate && toDate ? dayjs(toDate).format("YYYY-MM-DD") : null,
      };

      // Store the current filter form values as applied filters (include search)
      setAppliedFilters({
        ...filtersToStore,
        search: debouncedSearch.trim() || null,
      });

      // Store filters and search in the list store
      setStoreFilters(LIST_KEY, filtersToStore);
      setStoreSearch(LIST_KEY, searchQuery.trim() || "");

      setShowFilters(false);

      // Trigger API refetch
      setIsRefreshingData(true);
      await refetchFilteredCallEntries();
      setIsRefreshingData(false);

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
      call_date: null,
      call_mode: null,
      followup_date: null,
      status: null,
      sales_person: null,
      city: null,
      area: null,
      date_from: null,
      date_to: null,
      search: null,
    });

    // Reset to initial date range (first day of month to today)
    setFromDate(getDefaultFromDate());
    setToDate(getDefaultToDate());

    // Clear display values
    setCustomerDisplayValue(null);

    // Clear filters and search from store
    clearStoreFilters(LIST_KEY);
    clearStoreSearch(LIST_KEY);

    // Trigger API with initial payload (date range only)
    setIsRefreshingData(true);
    await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredCallEntries"] });
    await queryClient.removeQueries({ queryKey: ["filteredCallEntries"] }); // Remove filtered data from cache
    await refetchCallEntries();
    setIsRefreshingData(false);

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const handleDelete = async (value: any) => {
    try {
      const res = await deleteApiCall(URL.callEntry, API_HEADER, value);
      await refetchCallEntries();

      ToastNotification({
        type: "success",
        message: `Call Entry is successfully deleted`,
      });
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message}`,
      });
    }
  };

  const handleCloseCallEntry = (callEntry: any) => {
    setSelectedCallEntryForClose(callEntry);
    setRemark("");
    setOpenedMenuRowId(null); // Close the menu when opening the modal
    openCloseModal();
  };

  const handleCloseCallEntryConfirm = async () => {
    if (!remark.trim()) {
      ToastNotification({
        type: "error",
        message: "Remark is required to close the call entry",
      });
      return;
    }

    if (!selectedCallEntryForClose) return;

    try {
      setIsClosingCallEntry(true);
      closeCloseModal();

      // Use the call entry data directly from the row without fetching
      const editPayload = {
        customer: selectedCallEntryForClose.customer_code || "",
        call_date: selectedCallEntryForClose.call_date || "",
        call_mode: selectedCallEntryForClose.call_mode_id
          ? String(selectedCallEntryForClose.call_mode_id)
          : "",
        call_summary: selectedCallEntryForClose.call_summary || "",
        followup_date: selectedCallEntryForClose.followup_date || "",
        followup_action: selectedCallEntryForClose.followup_id
          ? String(selectedCallEntryForClose.followup_id)
          : "",
        expected_profit: selectedCallEntryForClose.expected_profit
          ? parseFloat(String(selectedCallEntryForClose.expected_profit))
          : 0,
        latitude: selectedCallEntryForClose.latitude || "",
        longitude: selectedCallEntryForClose.longitude || "",
        status: "CLOSE",
        remark: remark.trim(),
        id: selectedCallEntryForClose.id,
      };

      await putAPICall(URL.callEntry, editPayload as any, API_HEADER);

      // Invalidate and refetch all call entry related queries
      await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
      await queryClient.invalidateQueries({
        queryKey: ["filteredCallEntries"],
      });
      await queryClient.invalidateQueries({ queryKey: ["callEntrySearch"] });
      await refetchCallEntries();
      await refetchFilteredCallEntries();

      ToastNotification({
        type: "success",
        message: "Call Entry closed successfully",
      });

      // Reset state
      setSelectedCallEntryForClose(null);
      setRemark("");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while closing call entry: ${err?.message}`,
      });
    } finally {
      setIsClosingCallEntry(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<CompanyData>[]>(
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
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 150,
      },
      {
        accessorKey: "city",
        header: "Customer Location",
        size: 150,
        Cell: ({ row }) => {
          const city = row.original.city;
          const address = row.original.address;

          return (
            <Tooltip
              label={address || "No Address"}
              maw={400}
              fw={500}
              position="top-start"
              bg="#fff"
              style={{
                whiteSpace: "normal",
                padding: "5px 15px",
                color: "#3f3f3fff",
                border: "1px solid #105476",
                boxShadow: "0 2px 10px rgba(0,0,0, 0.2)",
                wordBreak: "break-word",
              }}
              multiline
            >
              <Text size="xs" style={{ cursor: "pointer" }}>
                {city || "-"}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "created_by_name",
        header: "Sales Person",
        size: 100,
      },
      {
        accessorKey: "area",
        header: "Call Entry Location",
        size: 150,
      },
      {
        accessorKey: "call_date",
        header: "Call Date",
        size: 100,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.call_date
              ? dayjs(row.original.call_date).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "call_mode_name",
        header: "Mode of Call",
        size: 100,
      },
      {
        accessorKey: "followup_date",
        header: "Follow up Dates",
        size: 120,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.followup_date
              ? dayjs(row.original.followup_date).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        Cell: ({ row }) => (
          <Badge
            size="sm"
            bg={row.original.status === "CLOSE" ? "#dc3545" : "#105476"}
          >
            {row.original.status || "ACTIVE"}
          </Badge>
        ),
      },
      {
        accessorKey: "remark",
        header: "Remark",
        size: 120,
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => (
          <Menu
            withinPortal
            position="bottom-end"
            shadow="sm"
            opened={openedMenuRowId === row.original.id}
            onChange={(opened) =>
              setOpenedMenuRowId(opened ? row.original.id : null)
            }
          >
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    // Preserve current filter state when navigating to create enquiry
                    const currentFilterState = {
                      filters: {
                        customer: appliedFilters.customer,
                        call_date: appliedFilters.call_date,
                        call_mode: appliedFilters.call_mode,
                        followup_date: appliedFilters.followup_date,
                        status: appliedFilters.status,
                        sales_person: appliedFilters.sales_person,
                        city: appliedFilters.city,
                        area: appliedFilters.area,
                      },
                      displayValues: {
                        customer: customerDisplayValue,
                      },
                      filtersApplied,
                      fromDate,
                      toDate,
                      fromDashboard: fromDashboardRef.current,
                    };
                    useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                    navigate("/enquiry-create", {
                      state: {
                        actionType: "createEnquiry",
                        customer_code: row.original.customer_code,
                        customer_code_read: row.original.customer_code,
                        customer_name: row.original.customer_name,
                        call_entry_id: row.original.id,
                        preserveFilters: currentFilterState,
                      },
                    });
                  }}
                  disabled={row.original.status === "CLOSE"}
                  style={{
                    cursor:
                      row.original.status === "CLOSE"
                        ? "not-allowed"
                        : "pointer",
                    opacity: row.original.status === "CLOSE" ? 0.5 : 1,
                  }}
                >
                  <Group gap={"sm"}>
                    <IconFileText size={16} style={{ color: "#105476" }} />
                    <Text
                      size="sm"
                      c={row.original.status === "CLOSE" ? "dimmed" : ""}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Create Enquiry
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {!fromDashboardRef.current && (
                <>
                  <Menu.Divider />
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        // Preserve current filter state when navigating to edit
                        const currentFilterState = {
                          filters: {
                            customer: appliedFilters.customer,
                            call_date: appliedFilters.call_date,
                            call_mode: appliedFilters.call_mode,
                            followup_date: appliedFilters.followup_date,
                            status: appliedFilters.status,
                            sales_person: appliedFilters.sales_person,
                            city: appliedFilters.city,
                            area: appliedFilters.area,
                          },
                          displayValues: {
                            customer: customerDisplayValue,
                          },
                          filtersApplied,
                          fromDate,
                          toDate,
                          fromDashboard: fromDashboardRef.current,
                        };
                        useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                        navigate(`/call-entry-create/${row.original.id}`, {
                          state: {
                            ...row.original,
                            actionType: "edit",
                            preserveFilters: currentFilterState,
                          },
                        });
                      }}
                      disabled={row.original.status === "CLOSE"}
                      style={{
                        cursor:
                          row.original.status === "CLOSE"
                            ? "not-allowed"
                            : "pointer",
                        opacity: row.original.status === "CLOSE" ? 0.5 : 1,
                      }}
                    >
                      <Group gap={"sm"}>
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text
                          size="sm"
                          c={row.original.status === "CLOSE" ? "dimmed" : ""}
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Edit
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                  <Menu.Divider />
                </>
              )}
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => handleCloseCallEntry(row.original)}
                  disabled={row.original.status === "CLOSE"}
                  style={{
                    cursor:
                      row.original.status === "CLOSE"
                        ? "not-allowed"
                        : "pointer",
                    opacity: row.original.status === "CLOSE" ? 0.5 : 1,
                  }}
                >
                  <Group gap={"sm"}>
                    <IconX size={16} style={{ color: "#dc3545" }} />
                    <Text
                      size="sm"
                      c={row.original.status === "CLOSE" ? "dimmed" : ""}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Close Call
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {/* <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton onClick={() => handleDelete(row.original.id)}>
                  <Group gap={"sm"}>
                    <IconTrash size={16} style={{ color: "red" }} />
                    <Text size="sm" c="red">
                      Delete
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box> */}
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [
      navigate,
      handleDelete,
      handleCloseCallEntry,
      appliedFilters,
      filtersApplied,
      fromDate,
      toDate,
      openedMenuRowId,
    ]
  );

  const table = useMantineReactTable({
    columns,
    data: displayData,
    enableColumnFilters: false,
    enablePagination: false,
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
          color: "#334155",
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
          backgroundColor: "#F8FAFC",
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
          flex: 1,
        }}
      >
        <Box mb="md">
          <Group justify="space-between" align="center" >
            <Text
              size="md"
              fw={600}
              c={"#1E293B"}
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              Call Entry List
            </Text>

            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size={16} />}
                rightSection={
                  searchQuery ? (
                    <ActionIcon
                      variant="transparent"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        // Clear search will trigger API via debouncedSearch useEffect
                        // Store will be updated when debouncedSearch changes
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
                w={248}
                size="sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                styles={{
                  input: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontstyle: "regular",
                    color: "#334155",
                    minWidth: "24px",
                    minHeight: "24px",
                    width: "248px",
                    height: "36px",
                    border: "1px solid #D0D1D4",
                    "&:focus": {
                      border: "1px solid #105476",
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
                    border: showFilters
                      ? "1px solid #105476"
                      : "1px solid #737780",
                    color: showFilters ? "#105476" : "#737780",
                  },
                }}
              >
                <IconFilter size={18} />
              </ActionIcon>

              <ActionIcon
                variant="outline"
                size={36}
                color="gray"
                onClick={() => {
                  const currentFilterState = {
                    filters: {
                      customer: appliedFilters.customer,
                      call_date: appliedFilters.call_date,
                      call_mode: appliedFilters.call_mode,
                      followup_date: appliedFilters.followup_date,
                      status: appliedFilters.status,
                      city: appliedFilters.city,
                      area: appliedFilters.area,
                    },
                    displayValues: {
                      customer: customerDisplayValue,
                    },
                    filtersApplied,
                    fromDate,
                    toDate,
                    fromDashboard: fromDashboardRef.current,
                  };
                  useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                  navigate("/call-entry-calendar", {
                    state: {
                      preserveFilters: currentFilterState,
                    },
                  });
                }}
                styles={{
                  root: {
                    borderRadius: "4px",
                    borderColor: "#737780",
                    color: "#737780",
                  },
                }}
              >
                <IconCalendarTime size={18} />
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
                onClick={() => {
                  const currentFilterState = {
                    filters: {
                      customer: appliedFilters.customer,
                      call_date: appliedFilters.call_date,
                      call_mode: appliedFilters.call_mode,
                      followup_date: appliedFilters.followup_date,
                      status: appliedFilters.status,
                      city: appliedFilters.city,
                      area: appliedFilters.area,
                    },
                    displayValues: {
                      customer: customerDisplayValue,
                    },
                    filtersApplied,
                    fromDate,
                    toDate,
                    fromDashboard: fromDashboardRef.current,
                  };
                  useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                  navigate("/call-entry-create", {
                    state: {
                      preserveFilters: currentFilterState,
                    },
                  });
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
              mb="sm"
              style={{
                backgroundColor: "#F8FAFC",
                padding: "8px 8px",
                borderRadius: "8px",
              }}
            >
              <Text
                size="sm"
                fw={600}
                c="#1E293B"
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
                  placeholder="Type customer name"
                  apiEndpoint={URL.customer}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: any) => ({
                    value: String(item.customer_code),
                    label: item.customer_name,
                  })}
                  value={filterForm.values.customer}
                  displayValue={customerDisplayValue}
                  onChange={(value, selectedData) => {
                    filterForm.setFieldValue("customer", value || "");
                    setCustomerDisplayValue(selectedData?.label || null);
                  }}
                  minSearchLength={2}
                />
              </Grid.Col>

              {/* Date Range Filter */}
              <Grid.Col span={4.8}>
                <DateRangeInput
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromDateChange={setFromDate}
                  onToDateChange={setToDate}
                  fromLabel="From Date"
                  toLabel="To Date"
                  size="xs"
                  allowDeselection={true}
                  showRangeInCalendar={false}
                  containerStyle={{
                    gap: "8px",
                  }}
                />
              </Grid.Col>

              {/* Call Mode Filter */}
              <Grid.Col span={2.4}>
                <Select
                  key={`call-mode-${filterForm.values.call_mode}-${callModeDataLoading}-${callModeOptionsData.length}`}
                  label="Mode of Call"
                  placeholder={
                    callModeDataLoading
                      ? "Loading call modes..."
                      : "Select Mode"
                  }
                  searchable
                  clearable
                  size="xs"
                  data={callModeOptionsData}
                  nothingFoundMessage={
                    callModeDataLoading
                      ? "Loading call modes..."
                      : "No call modes found"
                  }
                  disabled={callModeDataLoading}
                  {...filterForm.getInputProps("call_mode")}
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

              {/* Follow-up Date Filter */}
              <Grid.Col span={2.4}>
                <SingleDateInput
                  key={`followup-date-${filterForm.values.followup_date}`}
                  label="Follow-up Date"
                  placeholder="YYYY-MM-DD"
                  size="xs"
                  {...filterForm.getInputProps("followup_date")}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={14} />}
                  leftSectionPointerEvents="none"
                  radius="md"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  clearable
                />
              </Grid.Col>

              {/* Status Filter */}
              <Grid.Col span={2.4}>
                <Select
                  key={`status-${filterForm.values.status}-${followUpActionDataLoading}-${followUpActionOptionsData.length}`}
                  label="Status"
                  placeholder={
                    followUpActionDataLoading
                      ? "Loading statuses..."
                      : "Select Status"
                  }
                  searchable
                  clearable
                  size="xs"
                  data={followUpActionOptionsData}
                  nothingFoundMessage={
                    followUpActionDataLoading
                      ? "Loading statuses..."
                      : "No statuses found"
                  }
                  disabled={followUpActionDataLoading}
                  {...filterForm.getInputProps("status")}
                  onFocus={(event) => {
                    // Auto-select all text when input is focused
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

              {/* Customer Location Filter */}
              <Grid.Col span={2.4}>
                <TextInput
                  label="Customer Location"
                  placeholder="Type customer location"
                  size="xs"
                  {...filterForm.getInputProps("city")}
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

              {/* Area Filter */}
              <Grid.Col span={2.4}>
                <TextInput
                  label="Call Entry Location"
                  placeholder="Type call entry location"
                  size="xs"
                  {...filterForm.getInputProps("area")}
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

            <Group justify="end" mt="xs" p="md" pb="md">
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
                  isLoading ? <Loader size={14} /> : <IconFilter size={14} />
                }
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
              >
                Apply Filters
              </Button>
            </Group>
          </Box>
        )}

        {isLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                Loading call entries...
              </Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable
              key={`table-${filtersApplied ? "filtered" : "unfiltered"}-${displayData.length}`}
              table={table}
            />

            <Group
              w="100%"
              justify="space-between"
              align="center"
              p="xs"
              wrap="nowrap"
              pt="md"
            >
              {(location.state?.returnToDashboard ||
                returnToDashboardRef.current) && (
                <Button
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => {
                    const dashboardState =
                      location.state?.dashboardState ||
                      dashboardStateRef.current;
                    if (dashboardState) {
                      navigate("/", {
                        state: {
                          returnToCallEntryDetailedView: true,
                          dashboardState: dashboardState,
                        },
                      });
                    } else {
                      navigate("/");
                    }
                  }}
                  variant="outline"
                  size="sm"
                  color="#105476"
                >
                  Back to Dashboard
                </Button>
              )}
              <Box style={{ flex: 1, minWidth: 0 }}>
                <PaginationBar
                  pageSize={pageSize}
                  currentPage={pageIndex + 1}
                  totalRecords={totalRecords}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPageIndex(0);
                  }}
                  onPageChange={(page) => setPageIndex(page - 1)}
                />
              </Box>
            </Group>
          </>
        )}
      </Card>

      {/* Close Call Entry Modal */}
      <Modal
        opened={closeModalOpened}
        onClose={closeCloseModal}
        title="Close Call Entry"
        centered
        styles={{
          title: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
        }}
      >
        <Stack gap="md">
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Please provide a remark before closing this call entry.
          </Text>
          <Textarea
            label="Remark"
            placeholder="Enter remark..."
            required
            value={remark}
            onChange={(e) => setRemark(e.currentTarget.value)}
            minRows={4}
            error={!remark.trim() ? "Remark is required" : undefined}
            styles={{
              input: { fontFamily: "Inter, sans-serif" },
              label: { fontFamily: "Inter, sans-serif", fontWeight: 500 },
            }}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={closeCloseModal}
              styles={{
                root: { fontFamily: "Inter, sans-serif" },
              }}
            >
              Cancel
            </Button>
            <Button
              color="#105476"
              onClick={handleCloseCallEntryConfirm}
              disabled={!remark.trim() || isClosingCallEntry}
              loading={isClosingCallEntry}
              styles={{
                root: { fontFamily: "Inter, sans-serif" },
              }}
            >
              Close Call Entry
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
export default CallEntry;
