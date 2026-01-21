import { useEffect, useMemo, useRef, useState, startTransition, useCallback } from "react";
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
  Center,
  Stack,
  Badge,
  Tooltip,
  Modal,
  ScrollArea,
  Menu,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconFilter,
  IconPlus,
  IconEdit,
  IconDotsVertical,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification } from "../../components";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useLayoutStore } from "../../store/useLayoutStore";
import useAuthStore from "../../store/authStore";
import { useListFilterStore } from "../../store/listFilterStore";

const LIST_KEY = "LEAD_LIST";

type LeadData = {
  id: number;
  name: string;
  contact_number: string | null;
  contact_person: string | null;
  email_id: string | null;
  location: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
  created_by: string;
  assigned_to: string;
  status: string;
  remark: {
    messages?: Array<{
      sender: string;
      message: string;
      sender_id: number;
      timestamp: string;
    }>;
    interest_level?: string;
  };
  created_at: string;
  updated_at: string;
};

type FilterState = {
  assigned_to: string | null;
  status: string | null;
};

type UserMasterData = {
  id: number;
  user_id: string;
  user_name: string;
  employee_id: string;
  pulse_id: string | null;
  email_id: string;
  status: string;
};

const statusOptions = [
  { label: "All", value: "" },
  { label: "New", value: "New" },
  { label: "Contacted", value: "Contacted" },
  { label: "Qualified", value: "Qualified" },
  { label: "Converted", value: "Converted" },
  { label: "Lost", value: "Lost" },
];

function LeadList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { setActiveNav, setActiveSubNav, setTitle } = useLayoutStore();

  // Ensure navigation state is set correctly on mount and refresh
  useEffect(() => {
    setActiveNav("Sales");
    setActiveSubNav("Lead");
    setTitle("Sales");
  }, [setActiveNav, setActiveSubNav, setTitle]);

  // Refs to persist returnToDashboard flag and dashboard state
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard)
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state
  const fromDashboardRef = useRef<boolean>(
    Boolean(location.state?.fromDashboard)
  ); // Track if page was opened from dashboard

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const getState = useListFilterStore((state) => state.getState);
  const clearStoreAllExcept = useListFilterStore((state) => state.clearAllExcept);

  // CRITICAL: Capture restore data immediately to prevent loss during re-renders
  const restoreFiltersDataRef = useRef<any>(
    location.state?.restoreFilters ? { ...location.state.restoreFilters } : null
  );
  const hasRestoredRef = useRef(false);
  const restoreFiltersProcessed = useRef(false);

  //Search Debounce - initialize from restoreFilters if present
  const shouldRestore = Boolean(location.state?.restoreFilters);
  const [searchQuery, setSearchQuery] = useState(
    shouldRestore && restoreFiltersDataRef.current?.searchQuery !== undefined
      ? restoreFiltersDataRef.current.searchQuery || ""
      : ""
  );
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [showFilters, setShowFilters] = useState(false);

  // Modal state for remark conversation
  const [
    remarkModalOpened,
    { open: openRemarkModal, close: closeRemarkModal },
  ] = useDisclosure(false);
  const [selectedLeadForRemark, setSelectedLeadForRemark] =
    useState<LeadData | null>(null);

  // Filter form
  const filterForm = useForm<FilterState>({
    initialValues: {
      assigned_to: null,
      status: null,
    },
  });

  // State to store the actual applied filter values - initialize from restoreFilters if present
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    assigned_to:
      shouldRestore && restoreFiltersDataRef.current?.filters?.assigned_to !== undefined
        ? restoreFiltersDataRef.current.filters.assigned_to || null
        : null,
    status:
      shouldRestore && restoreFiltersDataRef.current?.filters?.status !== undefined
        ? restoreFiltersDataRef.current.filters.status || null
        : null,
  });
  
  const [filtersApplied, setFiltersApplied] = useState(
    shouldRestore && restoreFiltersDataRef.current?.filtersApplied !== undefined
      ? restoreFiltersDataRef.current.filtersApplied || Boolean(restoreFiltersDataRef.current?.searchQuery?.trim())
      : false
  );

  // Ref to hold latest appliedFilters to avoid stale closure in buildLeadPayload
  const appliedFiltersRef = useRef(appliedFilters);
  
  useEffect(() => {
      clearStoreAllExcept(LIST_KEY);
    }, []);

  // Update ref whenever appliedFilters changes
  useEffect(() => {
    appliedFiltersRef.current = appliedFilters;
  }, [appliedFilters]);

  // Memoized filter payload - includes filters + search together
  // Use ONLY debounced value for search to prevent API calls on every keystroke
  // Always include search field in payload (even if empty) to match API structure
  const buildLeadPayload = useMemo(() => {
    const payload: any = {
      assigned_to: appliedFiltersRef.current.assigned_to || "",
      status: appliedFiltersRef.current.status || "",
      search: debounced.trim() || "", // Always include search field (use debounced value)
    };

    return payload;
  }, [appliedFilters, debounced]); // Removed searchQuery from dependencies to use only debounced value

  // Fetch users for assigned_to filter
  const { data: usersData = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.user, API_HEADER)) as UserMasterData[];
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching users data:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const userOptions = useMemo(() => {
    if (!usersData || !Array.isArray(usersData)) return [];
    const options = usersData
      .filter((item) => item?.user_name)
      .map((item) => ({
        value: item.user_name,
        label: item.user_name,
      }));
    // Add "All" option at the beginning
    return [{ label: "All", value: "" }, ...options];
  }, [usersData]);

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
  }, [location.state?.returnToDashboard, location.state?.dashboardState, location.state?.fromDashboard]);

  // Fetch lead data with React Query - initial load (no filters, no search)
  const {
    data: leadData = [],
    isLoading: leadLoading,
    isFetching: leadFetching,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      try {
        // Initial payload - empty filters (not wrapped in filters object)
        const requestBody: { assigned_to: string; status: string } = {
          assigned_to: "",
          status: "",
        };

        const response = await apiCallProtected.post(
          URL.leadFilter,
          requestBody
        );
        const data = response as any;

        // Handle response - API returns { status: true, data: [...], message: "..." }
        if (data?.status === true && Array.isArray(data.data)) {
          return data.data;
        } else if (data && Array.isArray(data.data)) {
          return data.data;
        } else if (data && Array.isArray(data.results)) {
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching lead data:", error);
        ToastNotification({
          type: "error",
          message: "Error fetching leads. Please try again.",
        });
        return [];
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Keep previous data visible while fetching to prevent "No records to display" flicker
    placeholderData: (previousData) => previousData || [],
  });

  // Separate query for filtered data - with filters and search
  const {
    data: filteredLeadData = [],
    isLoading: filteredLeadLoading,
    isFetching: filteredLeadFetching,
    refetch: refetchFilteredLeads,
  } = useQuery({
    queryKey: [
      "filteredLeads",
      buildLeadPayload, // Includes search when present - queryKey change auto-triggers refetch
    ],
    queryFn: async () => {
      try {
        const filterPayload = buildLeadPayload;
        // buildLeadPayload always includes existing filters + search (when present)
        // This ensures filters and search are sent together in a single API call

        const requestBody = filterPayload; // Not wrapped in 'filters' object

        const response = await apiCallProtected.post(
          URL.leadFilter,
          requestBody
        );
        const data = response as any;

        // Handle response - API returns { status: true, data: [...], message: "..." }
        if (data?.status === true && Array.isArray(data.data)) {
          return data.data;
        } else if (data && Array.isArray(data.data)) {
          return data.data;
        } else if (data && Array.isArray(data.results)) {
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered lead data:", error);
        ToastNotification({
          type: "error",
          message: "Error fetching leads. Please try again.",
        });
        return [];
      }
    },
    // Enable query when filters are applied OR search is present
    enabled: filtersApplied || Boolean(debounced.trim()),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    // Keep previous data visible while fetching to prevent "No records to display" flicker
    placeholderData: (previousData) => previousData || [],
  });

  // Determine which data to display
  // Search is merged into filter payload - use filteredLeadData when filters are applied OR search is present
  // placeholderData ensures previous data remains visible during fetch, preventing empty state flicker
  const displayData = useMemo(() => {
    // If filters were applied OR search is present, show filtered results
    // (buildLeadPayload includes search when present, ensuring search is sent with filters)
    if (filtersApplied || debounced.trim()) {
      // placeholderData keeps previous data visible while fetching, so filteredLeadData won't be empty during fetch
      return filteredLeadData || [];
    }

    // Otherwise, show the original lead data (no filters, no search)
    // placeholderData ensures leadData won't be empty during fetch
    return leadData || [];
  }, [leadData, filteredLeadData, filtersApplied, debounced]);

  // Helper function to check if filters have real values (not just null keys)
  const hasRealFilterValues = useCallback((filters: FilterState): boolean => {
    return Boolean(
      (filters.assigned_to && filters.assigned_to.trim() !== "") ||
      (filters.status && filters.status.trim() !== "")
    );
  }, []);

  // Loading state - include refreshing state
  const isLoading =
    leadLoading ||
    filteredLeadLoading ||
    usersLoading;
  // Use isFetching to show loader while keeping previous data visible (prevents empty state flicker)
  const isFetching =
    leadFetching ||
    filteredLeadFetching;

  const applyFilters = async () => {
    try {
      // Check if there are any actual filter values (including search)
      // Search is treated as a filter and requires filtersApplied to be true
      const hasFilterValues =
        filterForm.values.assigned_to ||
        filterForm.values.status ||
        debounced.trim(); // Include search value

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        const emptyFilters = {
          assigned_to: null,
          status: null,
        };
        setAppliedFilters(emptyFilters);
        appliedFiltersRef.current = emptyFilters; // Sync ref immediately

        // Clear filters and search from store
        clearStoreFilters(LIST_KEY);
        clearStoreSearch(LIST_KEY);

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
        await refetchLeads();
        setShowFilters(false)
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setFiltersApplied(true);

      // Store the current filter form values as applied filters
      const newAppliedFilters = {
        assigned_to: filterForm.values.assigned_to,
        status: filterForm.values.status,
      };
      setAppliedFilters(newAppliedFilters);
      appliedFiltersRef.current = newAppliedFilters;

      // Save filters and search to store
      setStoreFilters(LIST_KEY, newAppliedFilters);
      setStoreSearch(LIST_KEY, searchQuery);

      // React Query will auto-refetch when queryKey changes (buildLeadPayload will update)
      // No manual refetch needed - queryKey change triggers exactly ONE API call
      setShowFilters(false);

      ToastNotification({
        type: "success",
        message: "Filters applied successfully",
      });
    } catch (error) {
      console.error("Error applying filters:", error);
      ToastNotification({
        type: "error",
        message: "Error applying filters. Please try again.",
      });
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset();
    setSearchQuery("");
    setFiltersApplied(false);

    // Reset applied filters state
    const emptyFilters = {
      assigned_to: null,
      status: null,
    };
    setAppliedFilters(emptyFilters);
    appliedFiltersRef.current = emptyFilters; // Sync ref immediately

    // Clear filters and search in store
    clearStoreFilters(LIST_KEY);
    clearStoreSearch(LIST_KEY);

    // Invalidate queries and refetch with initial payload (empty filters)
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredLeads"] });
    await refetchLeads(); // This uses empty filters - initial payload

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Track previous search value to detect changes
  const prevSearchRef = useRef<string>("");
  const searchInitializedRef = useRef(false);

  // Handle search changes - trigger API when search value changes (including when cleared)
  useEffect(() => {
    // Skip on initial mount if search hasn't changed
    if (!searchInitializedRef.current) {
      searchInitializedRef.current = true;
      prevSearchRef.current = debounced;
      return;
    }

    // Only trigger API if search actually changed (debounced)
    if (prevSearchRef.current === debounced) {
      return;
    }

    // Update ref for next comparison
    prevSearchRef.current = debounced;
    
    // Save search to store immediately
    setStoreSearch(LIST_KEY, searchQuery);
    
    // React Query will auto-refetch when queryKey changes (buildLeadPayload includes search)
    // buildLeadPayload is in queryKey, so when debounced changes, queryKey changes and triggers refetch
    if (debounced.trim() !== "") {
      // Search exists - set filtersApplied to true so filtered query is enabled
      setFiltersApplied(true);
    } else {
      // Search cleared
      if (!appliedFilters.assigned_to && !appliedFilters.status) {
        // No other filters - use default query
        setFiltersApplied(false);
      }
      // If other filters exist, filtersApplied stays true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Track if we've restored from store to prevent duplicate restoration calls
  const hasRestoredFromStore = useRef(false);
  // Track initial mount to trigger initial API call
  const isMountedRef = useRef(false);

  // Restore filters and search from store on mount and fetch data
  // Skip if refreshData is present (let refreshData effect handle it)
  useEffect(() => {
    if (hasRestoredFromStore.current) return;
    // Skip restoration if refreshData is present - let refreshData effect handle it
    if (location.state?.refreshData) return;

    const restoredState = useListFilterStore.getState().getState(LIST_KEY);

    const performRestore = async () => {
      if (!restoredState) {
        // No restored state, load default data
        await refetchLeads();
        return;
      }

      // 1️⃣ Restore filters
      let hasFilters = false;
      const restoredFilters = restoredState.filters as FilterState;
      console.log("restored filters---------------",restoredFilters)
      // Check for REAL filter values (not just null keys)
      if (restoredFilters && hasRealFilterValues(restoredFilters)) {
        setAppliedFilters(restoredFilters);
        appliedFiltersRef.current.assigned_to = restoredFilters.assigned_to;
        appliedFiltersRef.current.status = restoredFilters.status;
        // Restore filter form values
        filterForm.setValues({
          assigned_to: restoredFilters.assigned_to || null,
          status: restoredFilters.status || null,
        });
        hasFilters = true;
      }

      // 2️⃣ Restore search
      let hasSearch = false;
      if (typeof restoredState.search === "string" && restoredState.search.trim()) {
        setSearchQuery(restoredState.search);
        hasSearch = true;
      }

      // Set filtersApplied FIRST to ensure query is enabled before refetch
      if (hasFilters || hasSearch) {
        setFiltersApplied(true);
      }

      // Wait for state updates to flush and buildLeadPayload useMemo to recalculate
      // Increased delay to ensure:
      // 1. debounced search value is updated (debounce is 500ms)
      // 2. appliedFilters state triggers useMemo recalculation
      // 3. buildLeadPayload reads updated values from appliedFiltersRef.current
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 3️⃣ Fetch data based on restored state
      if (hasFilters || hasSearch) {
        // Manually refetch filtered leads AFTER:
        // - filtersApplied is set (query is enabled)
        // - restored state + refs are synced
        // - buildLeadPayload useMemo has recalculated with preserved values
        // This ensures the payload uses preserved filters/search instead of defaults
        await refetchFilteredLeads();
      } else {
        // No filters/search - load default data
        await refetchLeads();
      }
    };

    if(restoredState?.shouldRestore){
      performRestore();
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
      isMountedRef.current = true;
    } else if (!isMountedRef.current && !restoredState) {
      // Initial mount with no stored state - load default data
      isMountedRef.current = true;
      refetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.refreshData]);

  // Handle refresh when navigating from create/edit operations
  useEffect(() => {
    if (location.state?.refreshData) {
      const refreshData = async () => {
        // Check if we have filters or search from store
        const restoredState = getState(LIST_KEY);
        const hasActiveFilters = restoredState?.filters && hasRealFilterValues(restoredState.filters as FilterState);
        const hasActiveSearch = restoredState?.search && restoredState.search.trim() !== "";

        // If we have filters/search in store, restore them first
        if (restoredState && (hasActiveFilters || hasActiveSearch)) {
          // Restore filters from store if they exist
          if (hasActiveFilters) {
            const restoredFilters = restoredState.filters as FilterState;
            setAppliedFilters(restoredFilters);
            appliedFiltersRef.current = restoredFilters; // Update ref immediately
            // Restore filter form values
            filterForm.setValues({
              assigned_to: restoredFilters.assigned_to || null,
              status: restoredFilters.status || null,
            });
          }

          // Restore search from store if it exists
          if (hasActiveSearch) {
            setSearchQuery(restoredState.search);
          }

          // Set filtersApplied FIRST to ensure query is enabled
          setFiltersApplied(true);

          // Wait for state updates to flush and buildLeadPayload to recalculate
          // This ensures buildLeadPayload will use the restored values from refs
          // Increased delay to ensure debounced value is updated and useMemo recalculates
          await new Promise((resolve) => setTimeout(resolve, 600));

          // Manually refetch filtered leads AFTER restored state + refs are synced + useMemo recalculated
          // This ensures the payload uses preserved filters/search instead of defaults
          await refetchFilteredLeads();
        } else {
          // No filters/search - refetch default data
          await refetchLeads();
        }

        // Clear the refresh state but preserve dashboard return state
        navigate(location.pathname, {
          replace: true,
          state: {
            returnToDashboard: returnToDashboardRef.current,
            dashboardState: dashboardStateRef.current,
            fromDashboard: fromDashboardRef.current,
          },
        });
      };

      refreshData();
    }
  }, [
    location.state?.refreshData,
    refetchLeads,
    refetchFilteredLeads,
    navigate,
    location.pathname,
    getState,
    filterForm,
    hasRealFilterValues,
  ]);

  // Track if we're restoring filters to trigger refetch after state updates
  const [isRestoringFilters, setIsRestoringFilters] = useState(
    Boolean(location.state?.restoreFilters)
  );

  // Add effect to restore filters when returning from create/edit operations
  useEffect(() => {
    // Check if we're returning from a create/edit operation with filter restoration
    // Only restore if we haven't already restored (prevents re-initialization)
    if (
      location.state?.restoreFilters &&
      restoreFiltersDataRef.current &&
      !restoreFiltersProcessed.current &&
      !hasRestoredRef.current
    ) {
      restoreFiltersProcessed.current = true;
      hasRestoredRef.current = true;
      console.log(
        "🔄 Restoring filters and search after create/edit operation"
      );

      const restoreFiltersData = restoreFiltersDataRef.current;
      
      // Set restore guard FIRST to block all refetch logic during restore
      setIsRestoringFilters(true);

      // Restore filter form state
      filterForm.setValues({
        assigned_to: restoreFiltersData.filters?.assigned_to || null,
        status: restoreFiltersData.filters?.status || null,
      });

      // Restore applied filters state FIRST (synchronously) to ensure refs are updated
      const restoredFilters = {
        assigned_to: restoreFiltersData.filters?.assigned_to || null,
        status: restoreFiltersData.filters?.status || null,
      };
      setAppliedFilters(restoredFilters);
      appliedFiltersRef.current = restoredFilters; // Sync ref immediately BEFORE startTransition

      // Check for REAL filter values and search to determine filtersApplied
      // This must be done BEFORE startTransition to ensure query is enabled
      const hasRealFilters = hasRealFilterValues(restoredFilters);
      const hasSearch = Boolean(restoreFiltersData.searchQuery?.trim());
      const shouldApplyFilters = restoreFiltersData.filtersApplied || hasRealFilters || hasSearch;
      
      // Set filtersApplied FIRST (synchronously) to ensure query is enabled before refetch
      setFiltersApplied(shouldApplyFilters);

      // Batch remaining state restoration together to prevent multiple queryKey changes
      // This ensures React Query queryKey changes only ONCE after all state is restored
      // Using startTransition to batch state updates in a single render cycle
      startTransition(() => {
        // Restore search value
        if (restoreFiltersData.searchQuery !== undefined) {
          setSearchQuery(restoreFiltersData.searchQuery || "");
        }

        // Restore fromDashboard flag if present
        if (restoreFiltersData.fromDashboard !== undefined) {
          fromDashboardRef.current = Boolean(restoreFiltersData.fromDashboard);
        }
      });

      // Save to store (use the same restoredFilters variable declared above)
      setStoreFilters(LIST_KEY, restoredFilters);
      if (restoreFiltersData.searchQuery !== undefined) {
        setStoreSearch(LIST_KEY, restoreFiltersData.searchQuery || "");
      }

      // Clear the restore filters flag but preserve dashboard return state
      // Use refs to ensure persistence
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });

      // Wait for state updates to flush and queryKey to stabilize, then manually refetch
      const performRestore = async () => {
        try {
          // Wait for all state updates to flush and buildLeadPayload useMemo to recalculate
          // This ensures queryKey changes only ONCE with complete payload
          // Increased delay to ensure:
          // 1. debounced value is updated (debounce is 500ms, so 600ms should be enough)
          // 2. appliedFiltersRef.current is fully synchronized
          // 3. appliedFilters state change triggers useMemo recalculation
          // 4. buildLeadPayload reads updated values from appliedFiltersRef.current
          await new Promise((resolve) => setTimeout(resolve, 600));

          // Manually refetch filtered leads AFTER:
          // - filtersApplied is set (query is enabled)
          // - restored state + refs are synced
          // - buildLeadPayload useMemo has recalculated with preserved values
          // This ensures the payload uses preserved filters/search instead of defaults
          await refetchFilteredLeads();

          console.log("🔄 State restored - Manually refetched with restored filters/search", {
            filters: restoreFiltersData.filters,
            filtersApplied: restoreFiltersData.filtersApplied,
            searchQuery: restoreFiltersData.searchQuery,
            debounced: debounced, // Log debounced value to verify it's updated
          });
        } catch (error) {
          console.error("Error during restore:", error);
        } finally {
          // Release restore guard after state is stable and queryKey has changed
          setIsRestoringFilters(false);
        }
      };

      performRestore();
      return;
    }

    if (!location.state?.restoreFilters && restoreFiltersProcessed.current) {
      restoreFiltersProcessed.current = false;
      hasRestoredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.restoreFilters, navigate, location.pathname]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "blue";
      case "Contacted":
        return "cyan";
      case "Qualified":
        return "green";
      case "Converted":
        return "teal";
      case "Lost":
        return "red";
      default:
        return "gray";
    }
  };

  const getInterestLevelColor = (level: string | undefined) => {
    switch (level) {
      case "High":
        return "red";
      case "Medium":
        return "yellow";
      case "Low":
        return "gray";
      default:
        return "gray";
    }
  };

  const formatLocation = (location: LeadData["location"]) => {
    if (!location) return "-";
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.country) parts.push(location.country);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const getLatestMessage = (remark: LeadData["remark"]) => {
    if (!remark?.messages || remark.messages.length === 0) return "-";
    const latest = remark.messages[remark.messages.length - 1];
    return latest.message || "-";
  };

  const columns = useMemo<MRT_ColumnDef<LeadData>[]>(
    () => [
      {
        id: "sno",
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        maxSize: 70,
        enableColumnFilter: false,
        enableSorting: false,
        enableColumnOrdering: false,
        Cell: ({ row, table }) => {
          // Calculate S.No based on pagination: (pageIndex * pageSize) + rowIndex + 1
          const { pageIndex, pageSize } = table.getState().pagination;
          const sno = pageIndex * pageSize + row.index + 1;
          return <Text size="sm">{sno}</Text>;
        },
      },
      {
        accessorKey: "name",
        header: "Company Name",
        size: 180,
        Cell: ({ row }) => (
          <Text fw={600} size="sm">
            {row.original.name || "-"}
          </Text>
        ),
      },
      {
        accessorKey: "contact_person",
        header: "Contact Person",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.contact_person || "-"}</Text>
        ),
      },
      {
        accessorKey: "contact_number",
        header: "Contact Number",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.contact_number || "-"}</Text>
        ),
      },
      {
        accessorKey: "email_id",
        header: "Email",
        size: 180,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.email_id || "-"}</Text>
        ),
      },
      {
        accessorKey: "location",
        header: "Location",
        size: 180,
        Cell: ({ row }) => (
          <Text size="sm">{formatLocation(row.original.location)}</Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ row }) => (
          <Badge size="sm" color={getStatusColor(row.original.status)}>
            {row.original.status || "-"}
          </Badge>
        ),
      },
      {
        accessorKey: "assigned_to",
        header: "Assigned To",
        size: 130,
        Cell: ({ row }) => (
          <Text fw={500} size="sm">
            {row.original.assigned_to || "-"}
          </Text>
        ),
      },
      {
        accessorKey: "created_by",
        header: "Created By",
        size: 120,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.created_by || "-"}</Text>
        ),
      },
      {
        accessorKey: "interest_level",
        header: "Interest Level",
        size: 120,
        Cell: ({ row }) => (
          <Badge
            size="sm"
            color={getInterestLevelColor(row.original.remark?.interest_level)}
          >
            {row.original.remark?.interest_level || "-"}
          </Badge>
        ),
      },
      {
        accessorKey: "latest_remark",
        header: "Latest Remark",
        size: 150,
        minSize: 150,
        maxSize: 150,
        enableResizing: false,
        Cell: ({ row }) => {
          const message = getLatestMessage(row.original.remark);
          const hasMessages =
            row.original.remark?.messages &&
            row.original.remark.messages.length > 0;

          const handleClick = () => {
            if (hasMessages) {
              setSelectedLeadForRemark(row.original);
              openRemarkModal();
            }
          };

          return (
            <Tooltip
              label={hasMessages ? "Click to view full conversation" : message}
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
              <Text
                size="sm"
                style={{
                  cursor: hasMessages ? "pointer" : "default",
                  color: hasMessages ? "#105476" : "inherit",
                  textDecoration: hasMessages ? "underline" : "none",
                }}
                truncate
                onClick={handleClick}
              >
                {message}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Created At",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm">
            {row.original.created_at
              ? dayjs(row.original.created_at).format("DD-MM-YYYY HH:mm")
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Updated At",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm">
            {row.original.updated_at
              ? dayjs(row.original.updated_at).format("DD-MM-YYYY HH:mm")
              : "-"}
          </Text>
        ),
      },
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
                    navigate("/lead-create", {
                      state: {
                        leadData: row.original,
                        returnTo: "/lead",
                        restoreFilters: {
                          filters: appliedFilters,
                          filtersApplied,
                          fromDashboard: fromDashboardRef.current,
                        },
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
    [navigate, appliedFilters, filtersApplied]
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
    // Use table's built-in loading state - shows loader while keeping previous rows visible
    state: {
      isLoading: isFetching,
    },
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
          color: "#333740",
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
            backgroundColor: "#FBFBFB",
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
        <Box>
          <Group justify="space-between" align="center" pb="sm">
            <Text
              size="md"
              fw={600}
              c={"#444955"}
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              Lead List
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
                        // Clear search and update filtersApplied if no other filters exist
                        setSearchQuery("");
                        clearStoreSearch(LIST_KEY);
                        // Check if other filters exist to determine filtersApplied state
                        const hasOtherFilters =
                          appliedFilters.assigned_to ||
                          appliedFilters.status;
                        if (!hasOtherFilters) {
                          setFiltersApplied(false);
                        }
                        // React Query will auto-refetch when queryKey changes (buildLeadPayload will update)
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
                    color: "#333740",
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
                    border: showFilters ? "1px solid #105476" : "1px solid #737780",
                    color: showFilters ? "#105476" : "#737780",
                    "&:active": {
                      border: "1px solid #105476",
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
                    backgroundColor: "#105476",
                    borderRadius: "4px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontStyle: "semibold",
                    "&:hover": {
                      backgroundColor: "#105476",
                    },
                  },
                }}
                onClick={() =>{
                  useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                  navigate("/lead-create", {
                    state: {
                      returnTo: "/lead",
                      restoreFilters: {
                        filters: appliedFilters,
                        filtersApplied,
                        fromDashboard: fromDashboardRef.current,
                      },
                    },
                  })
                }
                }
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
            <Group justify="space-between" align="center" mb="sm" px="md" style={{ backgroundColor: "#FAFAFA", padding: "8px 8px", borderRadius: "8px" }}>
              <Text size="sm" fw={600} c="#000000" style={{ fontFamily: "Inter", fontSize: "14px" }}>
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
              {/* Status Filter */}
              <Grid.Col span={6}>
                <Select
                  label="Status"
                  placeholder="Select Service"
                  searchable
                  clearable
                  size="xs"
                  data={statusOptions}
                  nothingFoundMessage="No status found"
                  disabled={isLoading}
                  value={filterForm.values.status || ""}
                  onChange={(value) =>
                    filterForm.setFieldValue("status", value || null)
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

              {/* Assigned To Filter */}
              <Grid.Col span={6}>
                <Select
                  key={`assigned-to-${filterForm.values.assigned_to}-${usersLoading}-${userOptions.length}`}
                  label="Assigned To"
                  placeholder={
                    usersLoading
                      ? "Loading users..."
                      : "Select Service"
                  }
                  searchable
                  clearable
                  size="xs"
                  data={userOptions}
                  nothingFoundMessage={
                    usersLoading
                      ? "Loading users..."
                      : "No users found"
                  }
                  disabled={usersLoading}
                  value={filterForm.values.assigned_to || ""}
                  onChange={(value) =>
                    filterForm.setFieldValue("assigned_to", value || null)
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
                    color: "#444955",
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
                    backgroundColor: "#105476",
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

        {/* Show full-screen loader when loading and no data available */}
        {/* Loader should show when: */}
        {/* 1. Initial load (isLoading) and no data exists */}
        {/* 2. Fetching (isFetching) and we don't have data yet (check if data is undefined, not just empty) */}
        {/* Use table's built-in loading state for refetches to keep previous data visible */}
        {(isLoading || isFetching) ? (
          <Center py="xl" style={{ flex: 1 }}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                Loading leads...
              </Text>
            </Stack>
          </Center>
        ) : (
          <>
            {/* Table's built-in loading state handles display during refetches - placeholderData keeps previous rows visible */}
            <MantineReactTable
              key={`table-${filtersApplied ? "filtered" : "unfiltered"}-${displayData.length}`}
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

      {/* Conversation Modal */}
      <Modal
        opened={remarkModalOpened}
        onClose={closeRemarkModal}
        title={
          <Stack gap={4}>
            <Text size="lg" fw={600} c="#105476">
              Conversation
            </Text>
            {selectedLeadForRemark && (
              <Group gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  {selectedLeadForRemark.name}
                </Text>
                {selectedLeadForRemark.remark?.interest_level && (
                  <>
                    <Text size="sm" c="dimmed">
                      •
                    </Text>
                    <Badge
                      size="sm"
                      color={getInterestLevelColor(
                        selectedLeadForRemark.remark.interest_level
                      )}
                    >
                      {selectedLeadForRemark.remark.interest_level} Interest
                    </Badge>
                  </>
                )}
              </Group>
            )}
          </Stack>
        }
        size="lg"
        centered
        styles={{
          title: {
            paddingBottom: "12px",
          },
          body: {
            padding: "0",
          },
        }}
      >
        {selectedLeadForRemark?.remark?.messages &&
        selectedLeadForRemark.remark.messages &&
        selectedLeadForRemark.remark.messages.length > 0 ? (
          <Box>
            {/* Conversation Messages */}
            <ScrollArea style={{ maxHeight: "60vh", overflow: "auto" }}>
              <Stack gap="xs" p="md" style={{ backgroundColor: "#f8f9fa" }}>
                {selectedLeadForRemark?.remark?.messages?.map((msg, index) => {
                  const isSentByMe =
                    msg.sender === user?.full_name ||
                    msg.sender === user?.username ||
                    msg.sender_id === user?.user_id;
                  const prevMessage = index > 0 && selectedLeadForRemark?.remark?.messages ? selectedLeadForRemark.remark.messages[index - 1] : null;
                  const showSenderHeader =
                    !prevMessage || prevMessage.sender !== msg.sender;
                  const showDateSeparator =
                    !prevMessage ||
                    dayjs(msg.timestamp).format("DD-MM-YYYY") !==
                      dayjs(prevMessage.timestamp).format("DD-MM-YYYY");

                  return (
                    <Box key={index} px={4}>
                      {/* Date Separator */}
                      {showDateSeparator && (
                        <Group justify="center" my="md">
                          <Badge
                            size="sm"
                            variant="light"
                            color="gray"
                            style={{ textTransform: "none" }}
                          >
                            {dayjs(msg.timestamp).format("DD MMMM YYYY")}
                          </Badge>
                        </Group>
                      )}

                      {/* Message Bubble */}
                      <Group
                        align="flex-start"
                        gap="xs"
                        style={{
                          flexDirection: isSentByMe ? "row-reverse" : "row",
                        }}
                      >
                        <Box
                          style={{
                            maxWidth: "75%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isSentByMe ? "flex-end" : "flex-start",
                          }}
                        >
                          {/* Sender Name */}
                          {showSenderHeader && (
                            <Text
                              size="xs"
                              fw={600}
                              c="#105476"
                              mb={4}
                              style={{
                                paddingLeft: isSentByMe ? "0" : "8px",
                                paddingRight: isSentByMe ? "8px" : "0",
                                fontFamily: "Inter",
                              }}
                            >
                              {msg.sender}
                            </Text>
                          )}

                          {/* Message Bubble */}
                          <Box
                            style={{
                              backgroundColor: isSentByMe ? "#105476" : "#ffffff",
                              color: isSentByMe ? "#ffffff" : "#333",
                              padding: "10px 14px",
                              borderRadius: isSentByMe
                                ? "12px 12px 4px 12px"
                                : "12px 12px 12px 4px",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                              border: isSentByMe
                                ? "none"
                                : "1px solid #e9ecef",
                            }}
                          >
                            <Text
                              size="sm"
                              style={{
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                lineHeight: 1.5,
                                color: isSentByMe ? "#ffffff" : "#333",
                                fontFamily: "Inter",
                              }}
                            >
                              {msg.message}
                            </Text>
                          </Box>

                          {/* Timestamp */}
                          <Text
                            size="xs"
                            c="dimmed"
                            mt={4}
                            style={{
                              paddingLeft: isSentByMe ? "0" : "8px",
                              paddingRight: isSentByMe ? "8px" : "0",
                              fontFamily: "Inter",
                            }}
                          >
                            {dayjs(msg.timestamp).format("HH:mm")}
                          </Text>
                        </Box>
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            </ScrollArea>


            {/* Footer */}
            <Box
              p="md"
              style={{
                borderTop: "1px solid #e9ecef",
                backgroundColor: "#ffffff",
              }}
            >
              <Group justify="flex-end">
                <Button
                  variant="outline"
                  onClick={closeRemarkModal}
                  color="#105476"
                  size="sm"
                >
                  Close
                </Button>
              </Group>
            </Box>
          </Box>
        ) : (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed" size="sm">
                No conversation available
              </Text>
              <Button
                variant="outline"
                onClick={closeRemarkModal}
                color="#105476"
                size="sm"
              >
                Close
              </Button>
            </Stack>
          </Center>
        )}
      </Modal>
    </>
  );
}

export default LeadList;
