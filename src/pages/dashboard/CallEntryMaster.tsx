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
} from "../../components";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { searchAPI } from "../../service/searchApi";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";

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
};

function CallEntry() {
  // Get first day of current month and today's date
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const getDefaultToDate = (): Date => {
    return new Date();
  };

  const [rowCount, setRowCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);
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

  const totalPages = Math.ceil(rowCount / pageSize);
  const startItem = pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, rowCount);
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
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [isClosingCallEntry, setIsClosingCallEntry] = useState(false);
  const [closeModalOpened, { open: openCloseModal, close: closeCloseModal }] =
    useDisclosure(false);
  const [selectedCallEntryForClose, setSelectedCallEntryForClose] = useState<
    any | null
  >(null);
  const [remark, setRemark] = useState<string>("");
  const [openedMenuRowId, setOpenedMenuRowId] = useState<number | null>(null);

  // Store display values (labels) for SearchableSelect fields
  const [customerDisplayValue, setCustomerDisplayValue] = useState<
    string | null
  >(null);

  // Remove old state variables since React Query handles this now

  // Fetch call entry data with React Query - using filter API with date range on initial mount
  const {
    data: callEntryData = [],
    isLoading: callEntryLoading,
    refetch: refetchCallEntries,
  } = useQuery({
    queryKey: ["callEntries", pageIndex, pageSize],
    queryFn: async () => {
      try {
        // Use initial date values in payload (stored in ref, won't change when user modifies dates)
        // Dates are not in queryKey so changes won't trigger refetch
        // Only Apply Filters button will use the new dates via appliedFilters
        const requestBody: { filters: any } = { filters: {} };

        // Add date range if both initial dates are selected
        if (initialFromDateRef.current && initialToDateRef.current) {
          requestBody.filters = {
            date_from: dayjs(initialFromDateRef.current).format("YYYY-MM-DD"),
            date_to: dayjs(initialToDateRef.current).format("YYYY-MM-DD"),
          };
        }

        const response = await apiCallProtected.post(
          URL.filter_call_entries,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        // Handle response - API returns { results: [...] }
        if (data && Array.isArray(data.results)) {
          return data.results;
        } else if (data && Array.isArray(data.result)) {
          return data.result;
        }
        return [];
      } catch (error) {
        console.error("Error fetching call entry data:", error);
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

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredCallEntryData = [],
    isLoading: filteredCallEntryLoading,
    refetch: refetchFilteredCallEntries,
  } = useQuery({
    queryKey: ["filteredCallEntries", filtersApplied, appliedFilters],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        const payload: any = {};

        // Add date range if both dates are selected (use appliedFilters dates, not current state)
        if (appliedFilters.date_from && appliedFilters.date_to) {
          payload.date_from = appliedFilters.date_from;
          payload.date_to = appliedFilters.date_to;
        }

        if (appliedFilters.customer)
          payload.customer_code = appliedFilters.customer;
        if (appliedFilters.call_date)
          payload.call_date = dayjs(appliedFilters.call_date).format(
            "YYYY-MM-DD"
          );
        if (appliedFilters.call_mode)
          payload.call_mode_id = appliedFilters.call_mode;
        if (appliedFilters.followup_date)
          payload.followup_date = dayjs(appliedFilters.followup_date).format(
            "YYYY-MM-DD"
          );
        if (appliedFilters.status) {
          // Check if status is from dashboard (status values like OVERDUE, TODAY, UPCOMING, CLOSED)
          // Dashboard sends status directly, not followup action ID
          const dashboardStatuses = ["OVERDUE", "TODAY", "UPCOMING", "CLOSED"];
          const isDashboardStatus = dashboardStatuses.includes(
            String(appliedFilters.status).toUpperCase()
          );

          if (isDashboardStatus) {
            // From dashboard - send status directly
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
        if (appliedFilters.sales_person)
          payload.created_by = appliedFilters.sales_person;
        if (appliedFilters.city) payload.city = appliedFilters.city;
        if (appliedFilters.area) payload.area = appliedFilters.area;

        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          URL.filter_call_entries,
          requestBody
        );
        const data = response as any;
        console.log("Filter API response:", data);

        // Handle both 'result' and 'results' properties
        if (data && Array.isArray(data.result)) {
          return data.result;
        } else if (data && Array.isArray(data.results)) {
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered call entry data:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

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

  // Handle initial filters from dashboard navigation
  useEffect(() => {
    if (location.state?.initialFilters && !initialFiltersProcessed.current) {
      isProcessingInitialFilters.current = true; // Mark that we're processing initial filters
      initialFiltersProcessed.current = true;
      isMountedRef.current = true;

      // Persist returnToDashboard, dashboardState, and fromDashboard in refs
      if (location.state?.returnToDashboard !== undefined) {
        returnToDashboardRef.current = Boolean(
          location.state.returnToDashboard
        );
      }
      if (location.state?.dashboardState !== undefined) {
        dashboardStateRef.current = location.state.dashboardState;
      }
      if (location.state?.fromDashboard !== undefined) {
        fromDashboardRef.current = Boolean(location.state.fromDashboard);
      }

      const initialFilters = location.state.initialFilters;

      // Parse date filters if provided
      let callDateFrom: Date | null = null;
      let callDateTo: Date | null = null;

      if (initialFilters.date_from) {
        const parsedFrom = dayjs(initialFilters.date_from, "YYYY-MM-DD", true);
        if (parsedFrom.isValid()) {
          callDateFrom = parsedFrom.toDate();
        }
      }

      if (initialFilters.date_to) {
        const parsedTo = dayjs(initialFilters.date_to, "YYYY-MM-DD", true);
        if (parsedTo.isValid()) {
          callDateTo = parsedTo.toDate();
        }
      }

      // Set applied filters first
      setAppliedFilters({
        customer: initialFilters.customer || null,
        sales_person: initialFilters.sales_person || null,
        status: initialFilters.status || null,
        call_date: initialFilters.call_date
          ? dayjs(initialFilters.call_date, "YYYY-MM-DD", true).toDate()
          : null,
        followup_date: initialFilters.followup_date
          ? dayjs(initialFilters.followup_date, "YYYY-MM-DD", true).toDate()
          : null,
        call_mode: null,
        city: null,
        area: null,
        date_from: initialFilters.date_from || null,
        date_to: initialFilters.date_to || null,
      });

      setFiltersApplied(true);

      // Update filter form with initial values
      filterForm.setValues({
        customer: initialFilters.customer || null,
        sales_person: initialFilters.sales_person || null,
        status: initialFilters.status || null,
        call_date: initialFilters.call_date
          ? dayjs(initialFilters.call_date, "YYYY-MM-DD", true).toDate()
          : null,
        followup_date: initialFilters.followup_date
          ? dayjs(initialFilters.followup_date, "YYYY-MM-DD", true).toDate()
          : null,
        call_mode: null,
        city: null,
        area: null,
      });

      // Clear only initialFilters but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });

      setShowFilters(false);

      // Set dates and call API in one batch
      // Set dates first, then call API after a delay to ensure state is updated
      if (callDateFrom && callDateTo) {
        setFromDate(callDateFrom);
        setToDate(callDateTo);
      }

      // Call filtered API only once after all state is set
      setTimeout(() => {
        refetchFilteredCallEntries().finally(() => {
          // Mark that initial filter processing is complete
          isProcessingInitialFilters.current = false;
        });
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname, refetchFilteredCallEntries]);

  // Load data on mount with default dates and when date range changes
  useEffect(() => {
    // Skip if we're currently processing initial filters from dashboard
    if (isProcessingInitialFilters.current) {
      return;
    }

    // Skip if we have initialFilters that haven't been processed yet
    if (location.state?.initialFilters && !initialFiltersProcessed.current) {
      return;
    }

    if (!isMountedRef.current) {
      isMountedRef.current = true;
      // Skip initial load if we have initialFilters (they will be processed separately)
      if (location.state?.initialFilters) {
        return;
      }
    }

    // Only trigger API call when both dates are selected or both are cleared
    // But skip if filters are applied (filtered query handles it)
    if (filtersApplied) {
      return;
    }

    if (fromDate && toDate) {
      // Both dates selected - refetch with date range
      refetchCallEntries();
    } else if (!fromDate && !toDate && isMountedRef.current) {
      // Both dates cleared - refetch with empty filters
      refetchCallEntries();
    }
    // If only one date is selected, don't make API call
  }, [
    fromDate,
    toDate,
    refetchCallEntries,
    filtersApplied,
    location.state?.initialFilters,
  ]);

  // Handle refresh when navigating from CallEntryNew
  useEffect(() => {
    if (location.state?.refreshData) {
      // Refetch all call entry related data
      refetchCallEntries();
      refetchFilteredCallEntries();

      // Clear the refresh state but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });
    }
  }, [
    location.state?.refreshData,
    refetchCallEntries,
    refetchFilteredCallEntries,
    navigate,
    location.pathname,
  ]);

  // Track if we're restoring filters to trigger refetch after state updates
  const [isRestoringFilters, setIsRestoringFilters] = useState(false);

  // Add effect to restore filters when returning from create/edit operations
  useEffect(() => {
    // Check if we're returning from a create/edit operation with filter restoration
    if (location.state?.restoreFilters) {
      // console.log(
      //   "🔄 Restoring filters and refreshing data after create/edit operation"
      // );

      const restoreFiltersData = location.state.restoreFilters;

      // Restore filter form state
      filterForm.setValues({
        customer: restoreFiltersData.filters?.customer || null,
        call_date: restoreFiltersData.filters?.call_date || null,
        call_mode: restoreFiltersData.filters?.call_mode || null,
        followup_date: restoreFiltersData.filters?.followup_date || null,
        status: restoreFiltersData.filters?.status || null,
        sales_person: restoreFiltersData.filters?.sales_person || null,
        city: restoreFiltersData.filters?.city || null,
        area: restoreFiltersData.filters?.area || null,
      });

      // Restore display values for SearchableSelect fields
      setCustomerDisplayValue(
        restoreFiltersData.displayValues?.customer || null
      );

      // Restore date range
      setFromDate(restoreFiltersData.fromDate || null);
      setToDate(restoreFiltersData.toDate || null);

      // Restore applied filters state
      setAppliedFilters({
        customer: restoreFiltersData.filters?.customer || null,
        call_date: restoreFiltersData.filters?.call_date || null,
        call_mode: restoreFiltersData.filters?.call_mode || null,
        followup_date: restoreFiltersData.filters?.followup_date || null,
        status: restoreFiltersData.filters?.status || null,
        sales_person: restoreFiltersData.filters?.sales_person || null,
        city: restoreFiltersData.filters?.city || null,
        area: restoreFiltersData.filters?.area || null,
        date_from: restoreFiltersData.filters?.date_from || null,
        date_to: restoreFiltersData.filters?.date_to || null,
      });

      // Restore filters applied state
      const shouldApplyFilters = restoreFiltersData.filtersApplied || false;
      setFiltersApplied(shouldApplyFilters);

      // Restore fromDashboard flag if present
      if (restoreFiltersData.fromDashboard !== undefined) {
        fromDashboardRef.current = Boolean(restoreFiltersData.fromDashboard);
      }

      // Set flag to trigger refetch after state updates
      setIsRestoringFilters(true);

      // Clear the restore filters flag but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.restoreFilters, navigate, location.pathname]);

  // Effect to refetch data after filters are restored and state is updated
  useEffect(() => {
    if (isRestoringFilters) {
      const refreshData = async () => {
        if (filtersApplied) {
          // If filters were applied, invalidate and refetch filtered data
          await queryClient.invalidateQueries({
            queryKey: ["filteredCallEntries"],
          });
          await refetchFilteredCallEntries();
        } else {
          // Otherwise, refetch unfiltered data
          await refetchCallEntries();
        }
        setIsRestoringFilters(false);
      };

      refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoringFilters, filtersApplied]);

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
      console.log("Displaying filtered data:", filteredCallEntryData);
      console.log("Filters applied:", filtersApplied);
      return filteredCallEntryData;
    }
    console.log("Displaying unfiltered data:", callEntryData);
    return callEntryData;
  }, [
    debounced,
    searchData,
    callEntryData,
    filteredCallEntryData,
    filtersApplied,
  ]);

  // Loading state
  const isLoading = useMemo(() => {
    if (isClosingCallEntry) return true;
    if (filtersApplied) {
      return filteredCallEntryLoading || searchLoading;
    }
    return callEntryLoading || searchLoading;
  }, [
    callEntryLoading,
    filteredCallEntryLoading,
    searchLoading,
    filtersApplied,
    isClosingCallEntry,
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

      // Store the current filter form values as applied filters
      setAppliedFilters({
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
      });

      // Enable the filtered query and refetch
      await queryClient.invalidateQueries({
        queryKey: ["filteredCallEntries"],
      });
      setShowFilters(false);

      await refetchFilteredCallEntries();

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
    });

    // Clear display values
    setCustomerDisplayValue(null);

    // Invalidate queries and refetch unfiltered data
    await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredCallEntries"] });
    await queryClient.removeQueries({ queryKey: ["filteredCallEntries"] }); // Remove filtered data from cache
    await refetchCallEntries();

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
          <Group justify="space-between" align="center" mb="md">
            <Text
              size="md"
              fw={600}
              c={"#444955"}
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              Call Entry List
            </Text>

            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size={16} />}
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
                <DateInput
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

            {/* Custom Pagination Bar */}
            <Group
              w="100%"
              justify="space-between"
              align="center"
              p="xs"
              wrap="nowrap"
              pt="md"
            >
              {/* Left side: Back to Dashboard Button or Rows per page */}
              <Group gap="sm" align="center" wrap="nowrap">
                {location.state?.returnToDashboard ||
                returnToDashboardRef.current ? (
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
                ) : (
                  <>
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
                      styles={{ input: { fontSize: 12, height: 30 } } as any}
                    />
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const { pageIndex, pageSize } =
                          table.getState().pagination;
                        const total =
                          table.getPrePaginationRowModel().rows.length || 0;
                        if (total === 0) return "0–0 of 0";
                        const start = pageIndex * pageSize + 1;
                        const end = Math.min((pageIndex + 1) * pageSize, total);
                        return `${start}–${end} of ${total}`;
                      })()}
                    </Text>
                  </>
                )}
              </Group>

              {/* Right side: Page controls or Rows per page (if button is shown) */}
              <Group gap="xs" align="center" wrap="nowrap" pr={50}>
                {(location.state?.returnToDashboard ||
                  returnToDashboardRef.current) && (
                  <>
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
                      styles={{ input: { fontSize: 12, height: 30 } } as any}
                    />
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const { pageIndex, pageSize } =
                          table.getState().pagination;
                        const total =
                          table.getPrePaginationRowModel().rows.length || 0;
                        if (total === 0) return "0–0 of 0";
                        const start = pageIndex * pageSize + 1;
                        const end = Math.min((pageIndex + 1) * pageSize, total);
                        return `${start}–${end} of ${total}`;
                      })()}
                    </Text>
                  </>
                )}
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
