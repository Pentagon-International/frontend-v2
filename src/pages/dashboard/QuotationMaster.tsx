import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  ToastNotification,
  SearchableSelect,
  DownloadComponent,
  DateRangeInput,
  SingleDateInput,
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_GEIST_ROOT_CLASS,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS,
  ERP_LIST_FILTER_FIELD_COL_SPAN_TWO_FIFTHS,
  erpToolbarOutlineButtonStyles,
  type ErpListTheme,
  type ERPListColumnToggleItem,
} from "../../components";
import { URL } from "../../api/serverUrls";
import {
  Badge,
  ActionIcon,
  Box,
  Group,
  Button,
  Text,
  Card,
  TextInput,
  Modal,
  Stack,
  Center,
  Loader,
  Grid,
  Select,
  Alert,
  Collapse,
  Table,
  Textarea,
  MantineProvider,
} from "@mantine/core";
import {
  IconEye,
  IconEdit,
  IconSearch,
  IconDownload,
  IconX,
  IconFilter,
  IconArrowLeft,
  IconExternalLink,
  IconChevronDown,
  IconChevronUp,
  IconSend,
  IconFileText,
  IconCircleX,
  IconUserOff,
  IconFileDescription,
  IconShieldCheck,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../store/authStore";
import { useListFilterStore } from "../../store/listFilterStore";
import { generateNewQuotationPDF } from "./QuotationPDFTemplate";
import { postAPICall } from "../../service/postApiCall";
import { API_HEADER } from "../../store/storeKeys";
import { getAPICall } from "../../service/getApiCall";
import { putAPICall } from "../../service/putApiCall";
import useDateFormat from "../../hooks/useDateFormat";
import { getBookingShipmentFilterListTotal } from "../../utils/bookingShipmentFilterListTotal";
import {
  QuotationListNativeTable,
  type QuotationHeaderFilterKey,
  type QuotationHeaderFilterValues,
  type QuotationHeaderFiltersProp,
  type QuotationHeaderRenderInput,
  type QuotationRowMenuContext,
  type QuotationTableRow,
  type QuotationVisibleColumns,
} from "./QuotationListNativeTable";
import { useDebouncedValue } from "@mantine/hooks";

/**
 * Stable `displayFormat` references for the `SearchableSelect`s in the column
 * header inputs. Kept at MODULE scope so `SearchableSelect`'s internal fetch
 * effect (which depends on `displayFormat`) doesn't refire on every render
 * and re-hit the customer-master / port-master API.
 */
const quotationCustomerDisplayFormat = (item: any) => ({
  value: String(item.customer_code),
  label: String(item.customer_name),
});

const quotationPortDisplayFormat = (item: any) => ({
  value: String(item.port_code),
  label: `${item.port_name} (${item.port_code})`,
});

type QuotationData = {
  id: number;
  customer_name: string;
  sales_person: string;
  origin_name: string;
  destination_name: string;
  quote_type: string;
  valid_upto: string;
  enquiry_id: string;
  enquiry_received_date: string;
  customer_code: string;
  customer_address: string;
  /** From filter quotation response; used when creating booking (shipper/consignee) */
  customer_address_id?: number;
  service: string;
  cargo_type: string;
  charges: any[];
  quotation: any[];
  status?: string;
  remark?: string;
  revision?: string;
  origin_code_list?: string[];
  destination_code_list?: string[];
  quote_type_list?: string[];
  remark_list?: string[];
  valid_upto_list?: string[];
  reject_remark?: string;
};

type RevisionCharge = {
  id: number;
  quotation_charge_id: number;
  action_type: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  branch_code: string;
  company_code: string;
  action_timestamp: string;
  original_created_at: string;
  original_updated_at: string;
  quotation_service_id: number;
  charge_name: string;
  currency_id: number;
  currency_code: string;
  roe: string;
  unit: string;
  no_of_units: number;
  sell_per_unit: string;
  min_sell: string;
  cost_per_unit: string;
  min_cost: string | null;
  total_cost: string;
  total_sell: string;
};

type RevisionHistoryItem = {
  revision: number;
  count: number;
  total_cost: number;
  total_sell: number;
  profit: number;
  charges: RevisionCharge[];
  remark?: string;
};

type FilterState = {
  customer_code: string | null;
  sales_person: string | null;
  origin_code: string | null;
  destination_code: string | null;
  valid_upto: Date | null;
  quote_type: string | null;
  status: string | null;
  remark: string | null;
  revision: string | null;
  enquiry_id: string | null;
  enquiry_received_date?: Date | null;
  enquiry_received_date_to?: Date | null;
};

type QuotationMasterMode = "master" | "approval";

interface QuotationMasterProps {
  mode?: QuotationMasterMode;
}

const LIST_KEY = "QUOTATION_MASTER";
const APPROVAL_LIST_KEY = "QUOTATION_APPROVAL_MASTER";

function normalizeQuotationListStatusKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeQuotationListStatusCounts(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

function getQuotationListStatusCount(
  map: Record<string, number> | null | undefined,
  ...labels: string[]
): number {
  if (!map) return 0;
  for (const label of labels) {
    const target = normalizeQuotationListStatusKey(label);
    for (const [k, v] of Object.entries(map)) {
      if (normalizeQuotationListStatusKey(k) === target) return v;
    }
  }
  return 0;
}

function parseQuotationFilterResponse(data: any): {
  rows: any[];
  total: number;
  statusCounts: Record<string, number> | null;
} {
  const rows = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.result)
        ? data.result
        : [];
  const statusCounts = normalizeQuotationListStatusCounts(data?.summary?.status_counts);

  const indexRaw = data?.index;
  const requestOffset =
    typeof indexRaw === "number" && !Number.isNaN(indexRaw) ? indexRaw : 0;
  const total = getBookingShipmentFilterListTotal(
    (data ?? {}) as Record<string, unknown>,
    rows,
    requestOffset,
  );

  return { rows, total, statusCounts };
}

function QuotationMaster({ mode = "master" }: QuotationMasterProps) {
  // Use separate LIST_KEY for approval mode to maintain separate filter/search state
  const currentListKey = mode === "approval" ? APPROVAL_LIST_KEY : LIST_KEY;
  // Get first day of current month and today's date
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const getDefaultToDate = (): Date => {
    return new Date();
  };

  const dateFormat = useDateFormat();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [revisionHistoryData, setRevisionHistoryData] = useState<
    RevisionHistoryItem[]
  >([]);
  const [isLoadingRevisionHistory, setIsLoadingRevisionHistory] =
    useState(false);
  const [openedRevision, { open: openRevision, close: closeRevision }] =
    useDisclosure(false);
  const [expandedRevisionIndex, setExpandedRevisionIndex] = useState<
    number | null
  >(null);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [currentQuotation, setCurrentQuotation] = useState<any>(null);
  const [isApprovingQuotation, setIsApprovingQuotation] = useState(false);
  const [sendEmailOpened, { open: openSendEmail, close: closeSendEmail }] =
    useDisclosure(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: "",
    cc_email: "",
    subject: "",
    message: "Please find the attached Quotation.",
  });
  const [emailErrors, setEmailErrors] = useState({
    to_email: "",
    cc_email: "",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Refs to persist returnToDashboard flag and dashboard state
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard)
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state
  const isManagerOrAdmin = Boolean(user?.is_manager || user?.is_staff);
  const hasQuotationApprovalPermission = Boolean(
    user?.screen_permissions?.quotation_approval
  );
  const isApprovalMode = mode === "approval";
  const pageTitle = isApprovalMode
    ? "Quotation Approval List"
    : "Quotation Lists";

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const clearStoreAllExcept = useListFilterStore(
    (state) => state.clearAllExcept
  );

  // Check if we have initialFilters to determine initial date state
  const hasInitialFilters = location.state?.initialFilters;

  // Date range state - don't set default dates if coming from dashboard
  const [fromDate, setFromDate] = useState<Date | null>(
    hasInitialFilters ? null : getDefaultFromDate()
  );
  const [toDate, setToDate] = useState<Date | null>(
    hasInitialFilters ? null : getDefaultToDate()
  );
  const isMountedRef = useRef(false);
  const initialFiltersProcessed = useRef(false);

  // Get the default branch from user
  const defaultBranch =
    user?.branches?.find((branch) => branch.is_default) || user?.branches?.[0];

  // Filter states - set default status to "QUOTE CREATED" for approval mode
  const [filters, setFilters] = useState<FilterState>({
    customer_code: null,
    sales_person: null,
    origin_code: null,
    destination_code: null,
    valid_upto: null,
    quote_type: null,
    status: isApprovalMode ? "QUOTE CREATED" : null,
    remark: null,
    revision: null,
    enquiry_id: null,
  });

  // Track if filters are applied - default true for approval mode
  const [filtersApplied, setFiltersApplied] = useState(isApprovalMode);
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [listTotalRecords, setListTotalRecords] = useState(0);

  /** Column visibility for ERP list toolbar (actions column always shown). */
  const [quotationVisibleColumns, setQuotationVisibleColumns] = useState<
    QuotationVisibleColumns
  >({
    sno: true,
    enquiry_id: true,
    quotation_id: true,
    customer_name: true,
    sales_person: true,
    created_at: true,
    route: true,
    reference_no: true,
    status: true,
    valid_upto_list: true,
    revision: true,
    reject_remark: true,
  });

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search effect — 1000ms to match column-header debounce so a
  // global-search edit and a header-filter edit (both 1000ms) don't race and
  // double-refetch.
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 1000);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Helper function to save filters with dates to store (ensures consistency)
  const saveFiltersToStore = useCallback(() => {
    const filtersWithDates = {
      ...filters,
      enquiry_received_date: fromDate,
      enquiry_received_date_to: toDate,
    };
    setStoreFilters(currentListKey, filtersWithDates);
    setStoreSearch(currentListKey, searchQuery);
    console.log(
      `💾 [Quotation${isApprovalMode ? " Approval" : ""}] Saved filters to store:`,
      {
        filters: filtersWithDates,
        search: searchQuery,
        timestamp: new Date().toISOString(),
      }
    );
  }, [
    filters,
    fromDate,
    toDate,
    searchQuery,
    setStoreFilters,
    setStoreSearch,
    currentListKey,
    isApprovalMode,
  ]);

  // Track if we've restored from store to prevent duplicate API calls
  const hasRestoredFromStore = useRef(false);

  // Clear other keys in store on mount (keep only current LIST_KEY)
  useEffect(() => {
    clearStoreAllExcept(currentListKey);
  }, [currentListKey]); // eslint-disable-line react-hooks/exhaustive-deps

  console.log("filters------------------", filters);
  // Restore filters and search from store on mount and fetch data
  // Prioritize store-based restoration over location.state restoration
  useEffect(() => {
    console.log(
      "restore state",
      hasRestoredFromStore.current,
      useListFilterStore.getState().getState(currentListKey)
    );
    if (hasRestoredFromStore.current) return;

    const restoredState = useListFilterStore
      .getState()
      .getState(currentListKey);

    const performRestore = async () => {
      if (!restoredState) {
        // No restored state, load default data if dates are set or approval mode
        if (isApprovalMode) {
          setIsInitialLoading(true);
          await refetchFilteredQuotations();
          setIsInitialLoading(false);
          // Reset pagination after restore refetch completes
          setListCurrentPage(1);
        } else if (fromDate && toDate && !hasInitialFilters) {
          setIsInitialLoading(true);
          await loadAllQuotations();
          setIsInitialLoading(false);
          // Reset pagination after restore refetch completes
          setListCurrentPage(1);
        }
        return;
      }

      // 1️⃣ Restore filters (including dates)
      let hasFilters = false;
      const restoredFilters = restoredState.filters as FilterState;
      if (restoredFilters && Object.keys(restoredFilters).length > 0) {
        console.log(
          `📥 [Quotation${isApprovalMode ? " Approval" : ""}] Restoring filters from store:`,
          restoredFilters
        );
        setFilters(restoredFilters);
        // Restore date range from filters
        if (restoredFilters.enquiry_received_date) {
          setFromDate(restoredFilters.enquiry_received_date);
        }
        if (restoredFilters.enquiry_received_date_to) {
          setToDate(restoredFilters.enquiry_received_date_to);
        }
        // Check if any non-date filters exist
        hasFilters = Boolean(
          restoredFilters.customer_code ||
            restoredFilters.sales_person ||
            restoredFilters.origin_code ||
            restoredFilters.destination_code ||
            restoredFilters.valid_upto ||
            (restoredFilters.quote_type &&
              restoredFilters.quote_type !== "all") ||
            (restoredFilters.status && restoredFilters.status !== "all") ||
            restoredFilters.remark ||
            restoredFilters.revision ||
            restoredFilters.enquiry_id ||
            (restoredFilters.enquiry_received_date &&
              restoredFilters.enquiry_received_date_to)
        );
        console.log("📥 [Quotation] Filter restoration check:", {
          hasFilters,
          customer_code: restoredFilters.customer_code,
          sales_person: restoredFilters.sales_person,
          origin_code: restoredFilters.origin_code,
          destination_code: restoredFilters.destination_code,
          quote_type: restoredFilters.quote_type,
          status: restoredFilters.status,
          dates: {
            from: restoredFilters.enquiry_received_date,
            to: restoredFilters.enquiry_received_date_to,
          },
        });
      }

      // 2️⃣ Restore search
      let hasSearch = false;
      if (
        typeof restoredState.search === "string" &&
        restoredState.search.trim()
      ) {
        console.log(
          `📥 [Quotation${isApprovalMode ? " Approval" : ""}] Restoring search from store:`,
          restoredState.search
        );
        setSearchQuery(restoredState.search);
        hasSearch = true;
      }

      // 3️⃣ Restore display values if available in location.state (for SearchableSelect fields)
      const displayValues =
        location.state?.preserveFilters?.displayValues ||
        location.state?.restoreFilters?.displayValues;
      if (displayValues) {
        if (displayValues.customer_code) {
          setCustomerDisplayValue(displayValues.customer_code);
        }
        if (displayValues.origin_code) {
          setOriginDisplayValue(displayValues.origin_code);
        }
        if (displayValues.destination_code) {
          setDestinationDisplayValue(displayValues.destination_code);
        }
      }

      // Set filtersApplied FIRST to ensure query is enabled before refetch
      if (hasFilters || hasSearch || isApprovalMode) {
        setFiltersApplied(true);
      }

      // Wait for state updates to flush and debounced search to update
      // Increased delay to ensure:
      // 1. debounced search value is updated (debounce is 500ms, so 600ms should be enough)
      // 2. filters state triggers useMemo recalculation
      // 3. memoizedFilterPayload reads updated values from filters and debouncedSearch
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 4️⃣ Fetch data based on restored state
      if (hasFilters || hasSearch || isApprovalMode) {
        setIsInitialLoading(true);
        const result = await refetchFilteredQuotations();
        if (result.data && Array.isArray(result.data)) {
          // Wait a bit to ensure React Query has updated the data state
          // Similar to EnquiryMaster pattern - just wait for data to be set
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        setIsInitialLoading(false);
        // Reset pagination after restore refetch completes
        setListCurrentPage(1);
      } else if (fromDate && toDate) {
        // No filters/search but dates exist - load default data
        setIsInitialLoading(true);
        await loadAllQuotations();
        setIsInitialLoading(false);
        // Reset pagination after restore refetch completes
        setListCurrentPage(1);
      }
    };

    if (restoredState?.shouldRestore) {
      performRestore();
      useListFilterStore.getState().setShouldRestore(currentListKey, false);
      hasRestoredFromStore.current = true;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.refreshData, isApprovalMode, currentListKey]);

  // Sync refs with location.state when it changes
  useEffect(() => {
    if (location.state?.returnToDashboard !== undefined) {
      returnToDashboardRef.current = Boolean(location.state.returnToDashboard);
    }
    if (location.state?.dashboardState !== undefined) {
      dashboardStateRef.current = location.state.dashboardState;
    }
  }, [location.state?.returnToDashboard, location.state?.dashboardState]);

  // Memoized filter payload - prevents stale closures in queryFn
  const memoizedFilterPayload = useMemo(() => {
    const payload: any = {};

    // Add date range if both dates are selected
    if (fromDate && toDate) {
      payload.date_from = dayjs(fromDate).format("YYYY-MM-DD");
      payload.date_to = dayjs(toDate).format("YYYY-MM-DD");
    }

    if (filters.customer_code) payload.customer_code = filters.customer_code;
    if (filters.sales_person) payload.sales_person = filters.sales_person;
    if (filters.origin_code) payload.origin_code = filters.origin_code;
    if (filters.destination_code)
      payload.destination_code = filters.destination_code;
    if (filters.valid_upto)
      payload.valid_upto = dayjs(filters.valid_upto).format("YYYY-MM-DD");
    if (filters.quote_type && filters.quote_type !== "all")
      payload.quote_type = filters.quote_type;
    if (filters.status && filters.status !== "all")
      payload.status = filters.status;
    if (filters.remark) payload.remark = filters.remark;
    if (filters.revision) payload.revision = filters.revision;
    if (filters.enquiry_id) payload.enquiry_id = filters.enquiry_id;

    // Append search value to existing payload (never replaces filters)
    if (debouncedSearch.trim()) {
      payload.search = debouncedSearch.trim();
    } else if (searchQuery.trim()) {
      payload.search = searchQuery.trim();
    }

    return payload;
  }, [filters, fromDate, toDate, debouncedSearch, searchQuery]);

  // Build filter payload function - merges filters + search into single payload
  // Kept for backward compatibility with other parts of the code
  const buildFilterPayload = useCallback(
    (overridePayload?: any) => {
      if (overridePayload) return overridePayload;
      return memoizedFilterPayload;
    },
    [memoizedFilterPayload]
  );

  async function fetchRevision(service_id: number) {
    if (!service_id) {
      ToastNotification({
        type: "warning",
        message: "Quotation service ID not found for the selected service",
      });
      return;
    }
    openRevision();
    setIsLoadingRevisionHistory(true);
    try {
      const payload = {
        service_id: service_id,
      };

      console.log("Fetching revision with payload:", payload);

      const response: any = await postAPICall(
        URL.quotationChargeHistory,
        payload,
        API_HEADER
      );
      console.log("Revision response:", response);

      if (response && response.status && response.data) {
        setRevisionHistoryData(response.data);
      } else {
        setRevisionHistoryData([]);
        ToastNotification({
          type: "info",
          message: response?.message || "No revision history found",
        });
      }
    } catch (error: any) {
      console.error("Error fetching Revision history:", error);
      setRevisionHistoryData([]);
      ToastNotification({
        type: "error",
        message: `Failed to fetch revision history: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsLoadingRevisionHistory(false);
    }
  }

  // Reset expanded revision when modal closes
  useEffect(() => {
    if (!openedRevision) {
      setExpandedRevisionIndex(null);
    }
  }, [openedRevision]);

  const {
    data: quotationResult = { data: [], total: 0, statusCounts: null },
    isFetching: quotationFetching,
    refetch: refetchQuotations,
  } = useQuery({
    queryKey: [
      "quotations",
      fromDate,
      toDate,
      listCurrentPage,
      listPageSize,
      isApprovalMode,
    ],
    /** Keeps prior page totals/rows while the next page loads — avoids total→0 and clamp resetting to page 1. */
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      try {
        let requestBody: { filters: any } = { filters: {} };

        // Only add date filters if both dates are selected
        if (fromDate && toDate) {
          requestBody.filters.date_from = dayjs(fromDate).format("YYYY-MM-DD");
          requestBody.filters.date_to = dayjs(toDate).format("YYYY-MM-DD");
        }

        const endpoint = isApprovalMode
          ? URL.quotationFilterApproval
          : URL.quotationFilter;
        const response = await apiCallProtected.post(
          `${endpoint}?index=${(listCurrentPage - 1) * listPageSize}&limit=${listPageSize}`,
          requestBody
        );
        const { rows, total, statusCounts } = parseQuotationFilterResponse(
          response as any,
        );
        setListTotalRecords(total);
        return { data: rows, total, statusCounts };
      } catch (error) {
        console.error("Error fetching quotation data:", error);
        setListTotalRecords(0);
        return { data: [], total: 0, statusCounts: null };
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 0, // 5 minutes
    gcTime: 0, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Derived flag: hasActiveFiltersOrSearch - determines if we should use filtered data
  // This replaces filtersApplied for data source decisions (filtersApplied is UI-only)
  const hasActiveFiltersOrSearch = useMemo(() => {
    return Boolean(
      filters.customer_code ||
        filters.sales_person ||
        filters.origin_code ||
        filters.destination_code ||
        filters.valid_upto ||
        (filters.quote_type && filters.quote_type !== "all") ||
        (filters.status && filters.status !== "all") ||
        filters.remark ||
        filters.revision ||
        filters.enquiry_id ||
        (fromDate && toDate) ||
        debouncedSearch.trim() ||
        isApprovalMode
    );
  }, [filters, fromDate, toDate, debouncedSearch, isApprovalMode]);

  /** Use filtered-query rows/totals when filters were applied, or when search is active (search refetch intentionally does not set filtersApplied). */
  const showFilteredQuotationData =
    filtersApplied || Boolean(debouncedSearch.trim());

  // Single-flight protection for refetchFilteredQuotations
  const isRefetchingRef = useRef(false);

  // Separate query for filtered data - only triggers on explicit actions
  const {
    data: filteredQuotationResult = { data: [], total: 0, statusCounts: null },
    isLoading: filteredQuotationLoading,
    isFetching: filteredQuotationFetching,
    refetch: refetchFilteredQuotationsRaw,
  } = useQuery({
    queryKey: [
      "filteredQuotations",
      fromDate,
      toDate,
      debouncedSearch,
      isApprovalMode,
      listCurrentPage,
      listPageSize,
      memoizedFilterPayload,
    ],
    queryFn: async () => {
      try {
        // Use memoized payload to prevent stale closures
        const filterPayload = memoizedFilterPayload;

        // Skip if no filters/search
        if (Object.keys(filterPayload).length === 0) {
          console.log("No filters applied, skipping API call");
          return { data: [], total: 0, statusCounts: null };
        }

        const requestBody = { filters: filterPayload };
        console.log("📤 [Quotation] API Call - Applying filters + search:", {
          payload: filterPayload,
          filtersState: filters,
          fromDateState: fromDate,
          toDateState: toDate,
          searchQueryState: searchQuery,
          debouncedSearchState: debouncedSearch,
        });
        const endpoint = isApprovalMode
          ? URL.quotationFilterApproval
          : URL.quotationFilter;
        const response = await apiCallProtected.post(
          `${endpoint}?index=${(listCurrentPage - 1) * listPageSize}&limit=${listPageSize}`,
          requestBody
        );
        const { rows, total, statusCounts } = parseQuotationFilterResponse(
          response as any,
        );
        console.log("Filtered data received:", rows.length, "records");
        setListTotalRecords(total);
        return { data: rows, total, statusCounts };
      } catch (error) {
        console.error("Error fetching filtered quotation data:", error);
        setListTotalRecords(0);
        return { data: [], total: 0, statusCounts: null };
      } finally {
        isRefetchingRef.current = false;
      }
    },
    enabled: false, // Always trigger manually (Apply Filters / explicit flows only)
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    // Keep previous data visible while fetching to prevent "No records to display" flicker
    placeholderData: (previousData) => previousData,
  });

  // Wrapped refetch with single-flight protection
  const refetchFilteredQuotations = useCallback(async () => {
    if (isRefetchingRef.current) {
      console.log(
        "⏸️ [Quotation] Refetch already in progress, skipping duplicate call"
      );
      return { data: filteredQuotationResult, status: "skipped" } as any;
    }
    isRefetchingRef.current = true;
    try {
      return await refetchFilteredQuotationsRaw();
    } finally {
      // Reset flag after a delay to allow for async completion
      setTimeout(() => {
        isRefetchingRef.current = false;
      }, 100);
    }
  }, [refetchFilteredQuotationsRaw, filteredQuotationResult]);

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

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Store display values (labels) for SearchableSelect fields
  const [customerDisplayValue, setCustomerDisplayValue] = useState<
    string | null
  >(null);
  const [originDisplayValue, setOriginDisplayValue] = useState<string | null>(
    null
  );
  const [destinationDisplayValue, setDestinationDisplayValue] = useState<
    string | null
  >(null);

  // ── Column header filters ─────────────────────────────────────────────────
  // Strictly non-invasive: the column header filter inputs live on top of the
  // existing `filters` state. They DO NOT introduce any new payload structure,
  // client-side filtering, separate React Query, search path, or store keys.
  // A monotonic tick is incremented only when the user edits a header input —
  // a debounced effect (further below) uses that tick to invoke the EXISTING
  // `refetchFilteredQuotations`, exactly the way the Apply button does today.
  // Advanced filter inputs DO NOT bump this tick, so their existing behaviour
  // (commit-on-Apply) is fully preserved.
  const [headerFilterTick, setHeaderFilterTick] = useState(0);
  const [debouncedHeaderFilterTick] = useDebouncedValue(headerFilterTick, 1000);
  const lastHandledHeaderFilterTickRef = useRef(0);

  const handleQuotationHeaderFilterChange = useCallback(
    (key: QuotationHeaderFilterKey, value: string) => {
      const next = value;
      switch (key) {
        case "enquiry_id":
          setFilters((prev) => ({ ...prev, enquiry_id: next || null }));
          break;
        case "customer_name":
          // Header column maps to filters.customer_code (per spec).
          setFilters((prev) => ({ ...prev, customer_code: next || null }));
          // Clear the SearchableSelect's label cache so the advanced panel
          // reflects whatever the user typed in the header (single source of truth).
          setCustomerDisplayValue(null);
          break;
        case "sales_person":
          setFilters((prev) => ({ ...prev, sales_person: next || null }));
          break;
        case "origin":
          setFilters((prev) => ({ ...prev, origin_code: next || null }));
          setOriginDisplayValue(null);
          break;
        case "destination":
          setFilters((prev) => ({ ...prev, destination_code: next || null }));
          setDestinationDisplayValue(null);
          break;
        case "status":
          setFilters((prev) => ({ ...prev, status: next || null }));
          break;
        case "valid_upto_list":
          // Header value is an ISO `YYYY-MM-DD` string; convert back to a Date
          // so `memoizedFilterPayload` formats it the same way as the advanced
          // SingleDateInput would.
          setFilters((prev) => ({
            ...prev,
            valid_upto: next ? dayjs(next, "YYYY-MM-DD").toDate() : null,
          }));
          break;
        case "revision":
          setFilters((prev) => ({ ...prev, revision: next || null }));
          break;
        case "reject_remark":
          setFilters((prev) => ({ ...prev, remark: next || null }));
          break;
      }
      setListCurrentPage(1);
      setHeaderFilterTick((t) => t + 1);
    },
    [],
  );

  const quotationHeaderFilterValues: QuotationHeaderFilterValues = useMemo(
    () => ({
      enquiry_id: filters.enquiry_id ?? "",
      customer_name: filters.customer_code ?? "",
      sales_person: filters.sales_person ?? "",
      origin: filters.origin_code ?? "",
      destination: filters.destination_code ?? "",
      status:
        !filters.status || filters.status === "all" ? "" : filters.status,
      valid_upto_list: filters.valid_upto
        ? dayjs(filters.valid_upto).format("YYYY-MM-DD")
        : "",
      revision: filters.revision ?? "",
      reject_remark: filters.remark ?? "",
    }),
    [filters],
  );

  // Remove raw API calls - using SearchableSelect instead

  // Search data query - DISABLED: search is now handled via buildFilterPayload in filteredQuotations query
  // This prevents double API calls (one with filters+search, one with search-only)
  // Search is merged into buildFilterPayload and sent together with existing filters

  // Determine which data to display — use showFilteredQuotationData so search-only mode
  // (filtersApplied stays false) still reads from the filtered React Query result.
  // Note: When tableLoading is true, a full loader is shown instead of the table, so we don't need
  // to handle empty data states here - the loader prevents "No records to display" flicker
  const displayData = useMemo(() => {
    if (showFilteredQuotationData) {
      return filteredQuotationResult?.data || [];
    }
    return quotationResult?.data || [];
  }, [
    quotationResult,
    filteredQuotationResult,
    showFilteredQuotationData,
  ]);

  const summaryListTotalRecords = useMemo(() => {
    if (showFilteredQuotationData) {
      return filteredQuotationResult?.total ?? listTotalRecords;
    }
    return quotationResult?.total ?? listTotalRecords;
  }, [
    showFilteredQuotationData,
    filteredQuotationResult?.total,
    quotationResult?.total,
    listTotalRecords,
  ]);

  useEffect(() => {
    const listFetching = showFilteredQuotationData
      ? filteredQuotationFetching
      : quotationFetching;
    /** While fetching the next/prev page, totals can briefly go stale — never clamp page during that window. */
    if (listFetching) return;
    const tr = summaryListTotalRecords;
    const totalPages = Math.max(1, Math.ceil(tr / listPageSize));
    if (listCurrentPage > totalPages) {
      setListCurrentPage(totalPages);
    }
  }, [
    summaryListTotalRecords,
    listPageSize,
    listCurrentPage,
    showFilteredQuotationData,
    filteredQuotationFetching,
    quotationFetching,
  ]);

  // Loading state - single source of truth for table loader
  // Use isFetching states (not isLoading) as they remain true during refetch
  // isInitialLoading is set manually before/after explicit refetch calls
  const tableLoading =
    isInitialLoading || quotationFetching || filteredQuotationFetching;

  // Keep isLoading for backward compatibility (used elsewhere)
  const isLoading =
    isInitialLoading || quotationFetching || filteredQuotationLoading;
  // Use isFetching to show progress bars while keeping previous data visible
  const isFetching = filteredQuotationFetching || quotationFetching;

  const loadAllQuotations = useCallback(async () => {
    try {
      setIsInitialLoading(true);
      const result = await refetchQuotations();
      if (result.data) {
        queryClient.setQueryData(
          [
            "quotations",
            fromDate,
            toDate,
            listCurrentPage,
            listPageSize,
            isApprovalMode,
          ],
          result.data
        );
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, [
    refetchQuotations,
    queryClient,
    fromDate,
    toDate,
    listCurrentPage,
    listPageSize,
    isApprovalMode,
  ]);

  const paginationInitialized = useRef(false);

  useEffect(() => {
    if (!paginationInitialized.current) {
      paginationInitialized.current = true;
      return;
    }
    if (showFilteredQuotationData) {
      refetchFilteredQuotations();
    } else {
      loadAllQuotations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCurrentPage, listPageSize, showFilteredQuotationData]);

  // Handle initial filters from navigation
  useEffect(() => {
    if (location.state?.initialFilters && !initialFiltersProcessed.current) {
      initialFiltersProcessed.current = true;
      isMountedRef.current = true; // Mark as mounted to prevent default data load
      const initialFilters = location.state.initialFilters;

      // Parse date filters if provided
      // Dates come in YYYY-MM-DD format from dashboard
      let parsedFromDate: Date | null = null;
      let parsedToDate: Date | null = null;

      if (initialFilters.enquiry_received_date_from) {
        const parsedFrom = dayjs(
          initialFilters.enquiry_received_date_from,
          "YYYY-MM-DD",
          true
        );
        if (parsedFrom.isValid()) {
          parsedFromDate = parsedFrom.toDate();
        } else {
          console.error(
            "Invalid from date:",
            initialFilters.enquiry_received_date_from
          );
        }
      }

      if (initialFilters.enquiry_received_date_to) {
        const parsedTo = dayjs(
          initialFilters.enquiry_received_date_to,
          "YYYY-MM-DD",
          true
        );
        if (parsedTo.isValid()) {
          parsedToDate = parsedTo.toDate();
        } else {
          console.error(
            "Invalid to date:",
            initialFilters.enquiry_received_date_to
          );
        }
      }

      // Only set dates if both are valid (buildFilterPayload requires both)
      if (parsedFromDate && parsedToDate) {
        setFromDate(parsedFromDate);
        setToDate(parsedToDate);
        console.log("Date filters set:", {
          from: parsedFromDate,
          to: parsedToDate,
        });
      } else {
        console.warn("Date filters not set - one or both dates are invalid:", {
          from: initialFilters.enquiry_received_date_from,
          to: initialFilters.enquiry_received_date_to,
          parsedFrom: parsedFromDate,
          parsedTo: parsedToDate,
        });
      }

      // Set filters
      const initialFilterState = {
        customer_code: initialFilters.customer_code || null,
        sales_person: initialFilters.sales_person || null,
        origin_code: null,
        destination_code: null,
        valid_upto: null,
        quote_type: null,
        status: initialFilters.status || null,
        remark: null,
        revision: null,
        enquiry_id: initialFilters.enquiry_id || null,
      };
      setFilters(initialFilterState);

      // Save filters and search to store
      const filtersWithDates = {
        ...initialFilterState,
        enquiry_received_date: parsedFromDate,
        enquiry_received_date_to: parsedToDate,
      };
      setStoreFilters(currentListKey, filtersWithDates);
      setStoreSearch(currentListKey, "");

      setFiltersApplied(true);

      // Clear location state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: location.state?.returnToDashboard,
          dashboardState: location.state?.dashboardState,
        },
      });

      // Call API after a small delay to ensure state is updated
      setTimeout(async () => {
        setIsInitialLoading(true);
        const result = await refetchFilteredQuotations();
        if (result.data && Array.isArray(result.data)) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        setIsInitialLoading(false);
        // Reset pagination after initial filters refetch completes
        setListCurrentPage(1);
      }, 50);
    } else if (!isMountedRef.current && !location.state?.refreshData) {
      // Initial mount - load default data only if not navigating with refreshData flag
      isMountedRef.current = true;

      // For approval mode, load filtered data with "QUOTE CREATED" status
      if (isApprovalMode) {
        setIsInitialLoading(true);
        refetchFilteredQuotations().finally(() => setIsInitialLoading(false));
      } else {
        loadAllQuotations();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname, loadAllQuotations]);

  // Track previous search value to detect changes
  const prevSearchRef = useRef<string>("");
  const searchInitializedRef = useRef(false);
  const restoreFiltersProcessed = useRef(false);

  // Handle search changes - trigger API when search value changes (including when cleared)
  useEffect(() => {
    // Skip on initial mount if search hasn't changed
    if (!searchInitializedRef.current) {
      searchInitializedRef.current = true;
      prevSearchRef.current = debouncedSearch;
      return;
    }

    // Only trigger API if search actually changed (debounced)
    if (prevSearchRef.current === debouncedSearch) {
      return;
    }

    // Update ref for next comparison
    prevSearchRef.current = debouncedSearch;

    // Save search to store immediately (use current searchQuery, not debouncedSearch)
    // This ensures store always has the latest search value
    setStoreSearch(currentListKey, searchQuery);

    // Trigger API with loading state - loader will show until API response
    setIsInitialLoading(true);

    // Reset pagination to prevent empty table rendering when search changes
    setListCurrentPage(1);

    if (debouncedSearch.trim() !== "") {
      // Search exists - trigger filtered API (search will be merged with filters in memoizedFilterPayload)
      // Do NOT mutate filtersApplied - it's UI-only
      refetchFilteredQuotations()
        .then((result) => {
          if (result.data && Array.isArray(result.data)) {
            // Wait a bit to ensure React Query has updated the data state
            return new Promise((resolve) => setTimeout(resolve, 50));
          }
        })
        .then(() => {
          // API completed - data is set, hide loader
          setIsInitialLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching filtered data:", error);
          // Hide loader even on error
          setIsInitialLoading(false);
        });
    } else {
      // Search cleared
      if (hasActiveFiltersOrSearch) {
        // Filters still active or approval mode - refetch with filters only (no search)
        refetchFilteredQuotations()
          .then((result) => {
            if (result.data && Array.isArray(result.data)) {
              return new Promise((resolve) => setTimeout(resolve, 50));
            }
          })
          .then(() => {
            setIsInitialLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching filtered data:", error);
            setIsInitialLoading(false);
          });
      } else if (fromDate && toDate) {
        // No search, no filters - use default query
        loadAllQuotations();
      } else {
        // No search, no filters, no dates - no API call needed
        setIsInitialLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isApprovalMode, currentListKey]);

  // Add effect to refresh data when returning from create/edit operations
  // useEffect(() => {
  //   // Legacy shouldRestoreFilters pattern - now handled via store + refreshData
  //   // Keep for backward compatibility but prioritize store-based restoration
  //   if (location.state?.shouldRestoreFilters && location.state?.restoreFilterValues && !restoreFiltersProcessed.current) {
  //     restoreFiltersProcessed.current = true;
  //     const restoreFilterValues = location.state.restoreFilterValues;

  //     // Save to store for consistency
  //     if (restoreFilterValues.filters) {
  //       const filtersWithDates = {
  //         ...restoreFilterValues.filters,
  //         enquiry_received_date: restoreFilterValues.fromDate,
  //         enquiry_received_date_to: restoreFilterValues.toDate,
  //       };
  //       setStoreFilters(currentListKey, filtersWithDates);
  //       if (restoreFilterValues.searchQuery) {
  //         setStoreSearch(currentListKey, restoreFilterValues.searchQuery);
  //       }
  //     }

  //     // Restore filter state
  //     if (restoreFilterValues.filters) {
  //       setFilters(restoreFilterValues.filters);
  //     }

  //     // Restore date range
  //     if (restoreFilterValues.fromDate !== undefined) {
  //       setFromDate(restoreFilterValues.fromDate);
  //     }
  //     if (restoreFilterValues.toDate !== undefined) {
  //       setToDate(restoreFilterValues.toDate);
  //     }

  //     // Restore search value
  //     if (restoreFilterValues.searchQuery !== undefined) {
  //       setSearchQuery(restoreFilterValues.searchQuery || "");
  //     }

  //     // Restore filters applied state - set to true if filters were applied OR search is present
  //     setFiltersApplied(
  //       restoreFilterValues.filtersApplied ||
  //       Boolean(restoreFilterValues.searchQuery?.trim()) ||
  //       isApprovalMode
  //     );

  //     // Restore display values for SearchableSelect fields
  //     if (restoreFilterValues.displayValues) {
  //       setCustomerDisplayValue(
  //         restoreFilterValues.displayValues.customer_code || null
  //       );
  //       setOriginDisplayValue(
  //         restoreFilterValues.displayValues.origin_code || null
  //       );
  //       setDestinationDisplayValue(
  //         restoreFilterValues.displayValues.destination_code || null
  //       );
  //     }

  //     // Clear the restore filters flag
  //     navigate(location.pathname, { replace: true, state: {} });

  //     // Manually trigger API after state is restored
  //     const performRestore = async () => {
  //       try {
  //         // Wait for all state updates to flush and buildFilterPayload to update
  //         await new Promise((resolve) => setTimeout(resolve, 300));

  //         if (restoreFilterValues.filtersApplied || Boolean(restoreFilterValues.searchQuery?.trim()) || isApprovalMode) {
  //           setIsInitialLoading(true);
  //           const result = await refetchFilteredQuotations();
  //           if (result.data && Array.isArray(result.data)) {
  //             // Wait a bit to ensure React Query has updated the data state
  //             await new Promise((resolve) => setTimeout(resolve, 50));
  //           }
  //           setIsInitialLoading(false);
  //         } else if (fromDate && toDate) {
  //           setIsInitialLoading(true);
  //           await loadAllQuotations();
  //           setIsInitialLoading(false);
  //         }
  //       } catch (error) {
  //         console.error("Error during restore:", error);
  //         setIsInitialLoading(false);
  //       }
  //     };

  //     performRestore();
  //     return;
  //   }

  //   // Legacy restoreFilters pattern (for backward compatibility)
  //   if (location.state?.restoreFilters && !restoreFiltersProcessed.current) {
  //     restoreFiltersProcessed.current = true;
  //     const restoreFiltersData = location.state.restoreFilters;

  //     // Restore filter state
  //     setFilters(
  //       restoreFiltersData.filters || {
  //         customer_code: null,
  //         sales_person: null,
  //         origin_code: null,
  //         destination_code: null,
  //         valid_upto: null,
  //         quote_type: null,
  //         status: null,
  //         remark: null,
  //         revision: null,
  //       }
  //     );

  //     // Restore date range
  //     setFromDate(restoreFiltersData.fromDate || null);
  //     setToDate(restoreFiltersData.toDate || null);

  //     // Restore filters applied state
  //     setFiltersApplied(restoreFiltersData.filtersApplied || false);

  //     // Restore display values for SearchableSelect fields
  //     if (restoreFiltersData.displayValues) {
  //       setCustomerDisplayValue(
  //         restoreFiltersData.displayValues.customer_code || null
  //       );
  //       setOriginDisplayValue(
  //         restoreFiltersData.displayValues.origin_code || null
  //       );
  //       setDestinationDisplayValue(
  //         restoreFiltersData.displayValues.destination_code || null
  //       );
  //     }

  //     // Clear the restore filters flag
  //     navigate(location.pathname, { replace: true, state: {} });

  //     // Refresh all quotation data based on restored filter state
  //     const refreshData = async () => {
  //       try {
  //         // Use restored filtersApplied state to determine which query to refetch
  //         if (restoreFiltersData.filtersApplied) {
  //           // Wait a bit for filter state and query key to update before refetching
  //           setTimeout(async () => {
  //             setIsInitialLoading(true);
  //             const result = await refetchFilteredQuotations();
  //             if (result.data && Array.isArray(result.data)) {
  //               // Wait a bit to ensure React Query has updated the data state
  //               await new Promise((resolve) => setTimeout(resolve, 50));
  //             }
  //             setIsInitialLoading(false);
  //             // Reset pagination after restore refetch completes
  //             if (tableRef.current) {
  //               tableRef.current.setPageIndex(0);
  //             }
  //           }, 200);
  //         } else {
  //           setIsInitialLoading(true);
  //           await loadAllQuotations();
  //           setIsInitialLoading(false);
  //           // Reset pagination after restore refetch completes
  //           if (tableRef.current) {
  //             tableRef.current.setPageIndex(0);
  //           }
  //         }
  //       } catch (error) {
  //         console.error("Error refreshing data:", error);
  //         setIsInitialLoading(false);
  //       }
  //     };

  //     refreshData();
  //     return;
  //   }

  //   if (!location.state?.restoreFilters && !location.state?.shouldRestoreFilters && restoreFiltersProcessed.current) {
  //     restoreFiltersProcessed.current = false;
  //   } else if (location.state?.refreshData && !hasRestoredFromStore.current) {
  //     // Handle refreshData flag - but only if store restoration hasn't already run
  //     // Store restoration effect will handle filters/search restoration
  //     // This effect only clears the refreshData flag and triggers data refresh if needed
  //     console.log("🔄 [Quotation] Refreshing data after create/edit operation");

  //     // Clear the refresh flag but preserve dashboard return state
  //     navigate(location.pathname, {
  //       replace: true,
  //       state: {
  //         returnToDashboard: location.state?.returnToDashboard,
  //         dashboardState: location.state?.dashboardState,
  //       },
  //     });

  //     // If store restoration didn't run (no shouldRestore flag and no store data),
  //     // then just refresh with current state or load default data
  //     const restoredState = useListFilterStore.getState().getState(currentListKey);
  //     const hasStoreData = restoredState && (Object.keys(restoredState.filters || {}).length > 0 || (restoredState.search || "").trim() !== "");

  //     // If store has data, restoration effect will handle it
  //     // Otherwise, just refresh with current filters/search state
  //     if (!hasStoreData) {
  //       const refreshData = async () => {
  //         try {
  //           setIsInitialLoading(true);

  //           // Check current state to determine which query to use
  //           const hasActiveFiltersOrSearch = Boolean(
  //             filters.customer_code ||
  //             filters.sales_person ||
  //             filters.origin_code ||
  //             filters.destination_code ||
  //             filters.valid_upto ||
  //             (filters.quote_type && filters.quote_type !== "all") ||
  //             (filters.status && filters.status !== "all") ||
  //             filters.remark ||
  //             filters.revision ||
  //             (fromDate && toDate) ||
  //             debouncedSearch.trim() ||
  //             isApprovalMode
  //           );

  //           if (hasActiveFiltersOrSearch || filtersApplied) {
  //             await refetchFilteredQuotations();
  //           } else if (fromDate && toDate) {
  //             await loadAllQuotations();
  //           }

  //           setIsInitialLoading(false);
  //           if (tableRef.current) {
  //             tableRef.current.setPageIndex(0);
  //           }
  //         } catch (error) {
  //           console.error("Error refreshing data:", error);
  //           setIsInitialLoading(false);
  //         }
  //       };

  //       refreshData();
  //     }
  //   }
  // }, [
  //   location.state,
  //   refetchFilteredQuotations,
  //   navigate,
  //   filtersApplied,
  //   loadAllQuotations,
  //   queryClient,
  // ]);

  const applyFilters = async () => {
    try {
      const filterPayload = memoizedFilterPayload;
      const hasFilterValues =
        filterPayload.customer_code ||
        filterPayload.sales_person ||
        filterPayload.origin_code ||
        filterPayload.destination_code ||
        filterPayload.valid_upto ||
        filterPayload.quote_type ||
        (filterPayload.status && filterPayload.status !== "all") ||
        filterPayload.remark ||
        filterPayload.revision ||
        filterPayload.enquiry_id ||
        filterPayload.date_from ||
        filterPayload.search;

      if (!hasFilterValues) {
        setFiltersApplied(false);
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      // Save filters and search to store (include dates in filters)
      saveFiltersToStore();

      // Reset pagination to prevent empty table rendering
      setListCurrentPage(1);

      setFiltersApplied(true);
      setIsInitialLoading(true);
      const result = await refetchFilteredQuotations(); // Manually refetch with applied filters
      if (result.data && Array.isArray(result.data)) {
        // Wait a bit to ensure React Query has updated the data state
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      setIsInitialLoading(false);

      ToastNotification({
        type: "success",
        message: "Filters applied successfully",
      });
      setShowFilters(false);
    } catch (error) {
      console.error("Error applying filters:", error);
      setIsInitialLoading(false);
      ToastNotification({
        type: "error",
        message: "Error applying filters",
      });
      setShowFilters(false);
    }
  };
  const clearAllFilters = async () => {
    setShowFilters(false);

    setFilters({
      customer_code: null,
      sales_person: null,
      origin_code: null,
      destination_code: null,
      valid_upto: null,
      quote_type: null,
      status: isApprovalMode ? "QUOTE CREATED" : null,
      remark: null,
      revision: null,
      enquiry_id: null,
    });
    setSearchQuery("");
    setFiltersApplied(isApprovalMode); // Keep true for approval mode

    // Clear display values
    setCustomerDisplayValue(null);
    setOriginDisplayValue(null);
    setDestinationDisplayValue(null);

    // Clear filters and search in store
    clearStoreFilters(currentListKey);
    clearStoreSearch(currentListKey);

    setListCurrentPage(1);

    // Manually trigger API with cleared filters (default query)
    setIsInitialLoading(true);
    if (isApprovalMode) {
      await refetchFilteredQuotations();
    } else {
      await loadAllQuotations();
    }
    setIsInitialLoading(false);
    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Fetch data for download with applied filters
  const fetchDownloadData = async () => {
    try {
      // Always use current filter state (even if empty, it will fetch all data)
      const requestBody = { filters: buildFilterPayload() };
      const endpoint = isApprovalMode
        ? URL.quotationFilterApproval
        : URL.quotationFilter;
      const response = await apiCallProtected.post(endpoint, requestBody);
      const data = response as any;
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error("Error fetching download data:", error);
      return [];
    }
  };

  const fetchCurrencyMaster = async () => {
    try {
      const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
      return response;
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const getUserCurrencyCode = async (userCountryCode: string | undefined) => {
    try {
      if (!userCountryCode) return null;
      const currencyList = await fetchCurrencyMaster();
      if (!Array.isArray(currencyList)) return null;

      const match = currencyList.find(
        (item) =>
          item.country_code &&
          item.country_code.toUpperCase() === userCountryCode.toUpperCase()
      );
      console.log("--------------------------", match);

      return match ? match.code : null;
    } catch (error) {
      console.error("Error getting user currency:", error);
      return null;
    }
  };

  // Helper function to format numbers preserving decimals when converting to string
  const formatNumberWithDecimals = (num: number): string => {
    // Check if number has decimal places
    if (num % 1 !== 0) {
      // Has decimal places, preserve them with proper formatting
      return num.toString();
    }
    // For integers, preserve as decimal format (e.g., 336.0)
    // This ensures decimal values from API are preserved in Excel
    return num.toFixed(1);
  };

  // Column configuration for download - using original comprehensive headers
  const downloadColumns = useMemo(
    () => [
      {
        key: "enquiry_id",
        header: "Enquiry ID",
      },
      {
        key: "quotation_id",
        header: "Quotation ID",
        transform: (_value: any, item: any) => {
          // Extract quotation_id from the quotation array - one by one
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            return item.quotation.map((q: any) => q.quotation_id).join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "enquiry_received_date",
        header: "Enquiry Received Date",
      },
      {
        key: "sales_person",
        header: "Sales Person",
      },
      {
        key: "trade",
        header: "Trade",
        transform: (_value: any, item: any) => {
          // Get trade from quotations - one by one
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            return item.quotation.map((q: any) => q.trade || "N/A").join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "shipment_terms",
        header: "Terms of Shipment",
        transform: (_value: any, item: any) => {
          // Get shipment terms from quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            return item.quotation
              .map(
                (q: any) => q.shipment_terms || q.shipment_terms_code || "N/A"
              )
              .join(", ");
          }
          return "N/A";
        },
      },
      {
        key: "customer_name",
        header: "Customer Name",
      },
      {
        key: "location",
        header: "Location",
        transform: () => "Chennai", // Fixed value as requested
      },
      {
        key: "service_type",
        header: "Service",
        transform: (_value: any, item: any) => {
          // Get all service types from quotations - one by one
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            return item.quotation
              .map((q: any) => q.service_type || "N/A")
              .join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "origin_name",
        header: "Origin Name",
        transform: (_value: any, item: any) => {
          // Get all origins from quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            return item.quotation.map((q: any) => q.origin || "N/A").join("\n");
          }
          return item.origin_code_list && item.origin_code_list.length > 0
            ? item.origin_code_list.join("\n")
            : "N/A";
        },
      },
      {
        key: "destination_name",
        header: "Destination Name",
        transform: (_value: any, item: any) => {
          // Get all destinations from quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            return item.quotation
              .map((q: any) => q.destination || "N/A")
              .join("\n");
          }
          return item.destination_code_list && item.destination_code_list.length > 0
            ? item.destination_code_list.join("\n")
            : "N/A";
        },
      },
      {
        key: "container_detail",
        header: "Container Detail",
        transform: (_value: any, item: any) => {
          // Get container details from quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            return item.quotation
              .map((q: any) => {
                if (q.service_type === "FCL") {
                  const containerTypes = q.cargo_details
                    ?.map(
                      (cd: any) =>
                        cd.container_type || cd.container_type_code || ""
                    )
                    .filter(Boolean)
                    .join(", ");
                  return containerTypes || "N/A";
                }
                return "N/A";
              })
              .join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "no_of_containers",
        header: "No of Containers",
        transform: (_value: any, item: any) => {
          // Get container counts from quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            const counts = item.quotation.map((q: any) => {
              if (q.service_type === "FCL" && q.cargo_details) {
                const total = q.cargo_details.reduce(
                  (sum: number, cd: any) => sum + (cd.no_of_containers || 0),
                  0
                );
                return total || 0;
              }
              return 0;
            });
            // If single value, return as number; otherwise format and join as string
            return counts.length === 1
              ? counts[0]
              : counts.map(formatNumberWithDecimals).join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "total_cost",
        header: "Total Cost",
        transform: (_value: any, item: any) => {
          // Calculate total cost from all quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            const totals = item.quotation.map((q: any) => {
              const total =
                q.charges?.reduce(
                  (sum: number, charge: any) => sum + (charge.total_cost || 0),
                  0
                ) || 0;
              return total;
            });
            // If single value, return as number; otherwise format and join as string
            return totals.length === 1
              ? totals[0]
              : totals.map(formatNumberWithDecimals).join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "total_sell",
        header: "Total Sell",
        transform: (_value: any, item: any) => {
          // Calculate total sell from all quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            const totals = item.quotation.map((q: any) => {
              const total =
                q.charges?.reduce(
                  (sum: number, charge: any) => sum + (charge.total_sell || 0),
                  0
                ) || 0;
              return total;
            });
            // If single value, return as number; otherwise format and join as string
            return totals.length === 1
              ? totals[0]
              : totals.map(formatNumberWithDecimals).join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "profit",
        header: "Profit",
        transform: (_value: any, item: any) => {
          // Get profit from all quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            const profits = item.quotation.map((q: any) => q.profit || 0);
            // If single value, return as number; otherwise format and join as string
            return profits.length === 1
              ? profits[0]
              : profits.map(formatNumberWithDecimals).join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "status",
        header: "Status",
      },
      {
        key: "reject_remark",
        header: "Remark",
        transform: (_value: any, item: any) => {
          // Map to reject_remark instead of quotation remark
          return item.reject_remark || "N/A";
        },
      },
      {
        key: "revision",
        header: "Revision",
        transform: (_value: any, item: any) => {
          // Get revisions from all quotations
          if (
            item.quotation &&
            Array.isArray(item.quotation) &&
            item.quotation.length > 0
          ) {
            const revisions = item.quotation.map((q: any) => q.revision || 0);
            // If single value, return as number; otherwise format and join as string
            return revisions.length === 1
              ? revisions[0]
              : revisions.map(formatNumberWithDecimals).join("\n");
          }
          return "N/A";
        },
      },
      {
        key: "quote_approved_rejected_date",
        header: "Quote Approved/Rejected Date",
        transform: (_value: any, item: any) => {
          // Show updated_at if status is "GAINED" or "LOST", otherwise "-"
          const status = item.status;
          if (status === "GAINED" || status === "LOST") {
            return item.updated_at || "-";
          }
          return "-";
        },
      },
      {
        key: "quote_created_date",
        header: "Quote Created Date",
        transform: (_value: any, item: any) => {
          // Show created_at from the response
          return item.created_at || "-";
        },
      },
    ],
    []
  );

  // useEffect(() => {
  //   const initializeData = async () => {
  //     await fetchMasterData();
  //     const result = await fetchData({});
  //     console.log("Setting data to state:", result);
  //     setData(result);
  //   };
  //   initializeData();
  // }, []);

  // useEffect(() => {
  //   if (debounced.trim() === "") {
  //     const filterPayload = buildFilterPayload();
  //     const loadData = async () => {
  //       const result = await fetchData(filterPayload);
  //       setData(result);
  //     };
  //     loadData();
  //     return;
  //   }

  //   setLoading(true);
  //   abortRef.current?.abort();
  //   const controller = new AbortController();
  //   abortRef.current = controller;

  //   searchAPI(debounced, controller.signal)
  //     .then((res) => {
  //       setData(res);
  //     })
  //     .catch((err) => {
  //       if (err.name !== "CanceledError") console.error("API Error:", err);
  //     })
  //     .finally(() => setLoading(false));
  // }, [debounced]);

  const handleDownloadPDF = () => {
    if (currentQuotation && pdfBlob) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `Quotation_${currentQuotation.enquiry_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPdfBlob(null);
    setCurrentQuotation(null);
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
  };

  // Helper function to parse emails from comma or semicolon separated string
  const parseEmails = (emailString: string): string[] => {
    if (!emailString || !emailString.trim()) return [];
    // Split by comma or semicolon, then trim each email
    return emailString
      .split(/[,;]/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
  };

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendEmailClick = () => {
    console.log("RRR:",user?.screen_permissions)
    if (currentQuotation) {
      // Set default email from customer_email field (if available)
      const enquiryId = currentQuotation.enquiry_id || "";

      // Build subject in format: Enquiry id//origin to Destination//trade//servicetype//customer name
      let subject = enquiryId;

      // Get first quotation service for origin, destination, trade, and service_type
      const firstQuotation =
        currentQuotation.quotation && currentQuotation.quotation.length > 0
          ? currentQuotation.quotation[0]
          : null;

      if (firstQuotation) {
        const origin = firstQuotation.origin || "";
        const destination = firstQuotation.destination || "";
        const trade = firstQuotation.trade || "";
        const serviceType = firstQuotation.service_type || "";

        // Build origin to destination string
        const originToDestination =
          origin && destination
            ? `${origin.toUpperCase()} TO ${destination.toUpperCase()}`
            : "";

        // Build subject with // separators
        const parts = [enquiryId];
        if (originToDestination) parts.push(originToDestination);
        if (trade) parts.push(trade.toUpperCase());
        if (serviceType) parts.push(serviceType.toUpperCase());
        if (currentQuotation.customer_name)
          parts.push(currentQuotation.customer_name.toUpperCase());

        subject = parts.join("//");
      } else {
        // Fallback to old format if no quotation services
        subject = `Quotation - ${enquiryId}`;
      }
console.log("currentQuotation: ", currentQuotation);
      setEmailForm({
        to_email: currentQuotation.customer_email || "",
        cc_email: currentQuotation.salesperson_email || "",
        subject: subject,
        message: "Please find the attached Quotation.",
      });
      openSendEmail();
    }
  };

  const canCreateBookingFromRow = (rowData: QuotationData) => {
    // Show option for quotations that are gained
    return rowData.status === "GAINED";
  };

  const handleCreateBookingFromRow = (rowData: QuotationData) => {
    if (!canCreateBookingFromRow(rowData)) {
      ToastNotification({
        type: "warning",
        message: "Create booking is available only for gained quotations.",
      });
      return;
    }

    const quotationServices = Array.isArray(rowData.quotation)
      ? rowData.quotation
      : [];

    if (!quotationServices.length) {
      ToastNotification({
        type: "warning",
        message: "No quotation services found for this quotation.",
      });
      return;
    }

    // Use the first quotation service, similar to how a selected service
    // is used inside the quotation page when creating a booking.
    const service: any = quotationServices[0];

    // Derive cargo summary fields from quotation cargo_details so booking
    // steppers receive the same shape they expect from the quotation page.
    const firstCargo =
      Array.isArray(service.cargo_details) && service.cargo_details.length > 0
        ? service.cargo_details[0]
        : undefined;

    const serviceDetails = {
      ...service,
      origin_code: service.origin_code,
      origin_code_read: service.origin_code,
      origin_name: service.origin,
      destination_code: service.destination_code,
      destination_code_read: service.destination_code,
      destination_name: service.destination,
      shipment_terms_code: service.shipment_terms_code,
      shipment_terms_code_read: service.shipment_terms_code,
      shipment_terms_name: service.shipment_terms,
      no_of_packages: firstCargo?.no_of_packages,
      gross_weight: firstCargo?.gross_weight,
      volume_weight: firstCargo?.volume_weight,
      chargeable_weight: firstCargo?.chargeable_weight,
      volume: firstCargo?.volume,
      chargeable_volume: firstCargo?.chargeable_volume,
      container_type_code:
        firstCargo?.container_type_code || firstCargo?.container_type,
      no_of_containers: firstCargo?.no_of_containers,
    };

    const bookingData = {
      enquiryData: {
        enquiry_id: rowData.enquiry_id,
        customer_name: rowData.customer_name,
        customer_address: rowData.customer_address || "",
        customer_address_id:
          rowData.customer_address_id != null
            ? Number(rowData.customer_address_id)
            : undefined,
        sales_person: rowData.sales_person,
        enquiry_received_date: rowData.enquiry_received_date,
        customer_code: rowData.customer_code || "",
      },
      quotationData: service,
      serviceDetails,
      quotation_primary_id: rowData.id,
    };

    const trade = service.trade;
    const serviceType = service.service_type;

    if (serviceType === "AIR") {
      if (trade === "Export") {
        navigate("/air/export-booking/create", { state: { bookingData } });
      } else if (trade === "Import") {
        navigate("/air/import-booking/create", { state: { bookingData } });
      } else {
        ToastNotification({ type: "error", message: "Invalid trade type" });
      }
    } else if (serviceType === "FCL" || serviceType === "LCL") {
      if (trade === "Export") {
        navigate("/SeaExport/export-booking/create", {
          state: { bookingData },
        });
      } else if (trade === "Import") {
        navigate("/SeaExport/import-booking/create", {
          state: { bookingData },
        });
      } else {
        ToastNotification({ type: "error", message: "Invalid trade type" });
      }
    } else {
      ToastNotification({
        type: "error",
        message:
          "Create booking is only supported for AIR, FCL and LCL services",
      });
    }
  };

  const handleSendEmail = async () => {
    const includeQuotationBody = Boolean(
      user?.screen_permissions?.include_quotation_body,
    );

    if (!currentQuotation || (!includeQuotationBody && !pdfBlob)) {
      ToastNotification({
        type: "error",
        message: includeQuotationBody
          ? "Quotation not available"
          : "Quotation or PDF not available",
      });
      return;
    }

    // Validate and parse to_email
    const toEmailString = emailForm.to_email.trim();
    if (!toEmailString) {
      setEmailErrors({
        ...emailErrors,
        to_email: "Please enter recipient email address(es)",
      });
      ToastNotification({
        type: "error",
        message: "Please enter recipient email address(es)",
      });
      return;
    }

    const toEmailArray = parseEmails(toEmailString);
    if (toEmailArray.length === 0) {
      setEmailErrors({
        ...emailErrors,
        to_email: "Please enter valid email address(es)",
      });
      ToastNotification({
        type: "error",
        message:
          "Please enter valid email address(es) separated by comma or semicolon",
      });
      return;
    }

    // Validate each to_email
    const invalidToEmails = toEmailArray.filter(
      (email) => !isValidEmail(email)
    );
    if (invalidToEmails.length > 0) {
      setEmailErrors({
        ...emailErrors,
        to_email: `Invalid email address(es): ${invalidToEmails.join(", ")}`,
      });
      ToastNotification({
        type: "error",
        message: `Invalid email address(es): ${invalidToEmails.join(", ")}`,
      });
      return;
    }

    // Validate and parse cc_email (optional)
    let ccEmailArray: string[] = [];
    const ccEmailString = emailForm.cc_email.trim();
    if (ccEmailString) {
      ccEmailArray = parseEmails(ccEmailString);
      if (ccEmailArray.length > 0) {
        // Validate each cc_email
        const invalidCcEmails = ccEmailArray.filter(
          (email) => !isValidEmail(email)
        );
        if (invalidCcEmails.length > 0) {
          setEmailErrors({
            ...emailErrors,
            cc_email: `Invalid email address(es): ${invalidCcEmails.join(", ")}`,
          });
          ToastNotification({
            type: "error",
            message: `Invalid CC email address(es): ${invalidCcEmails.join(", ")}`,
          });
          return;
        }
      }
    }

    // Clear errors if validation passes
    setEmailErrors({ to_email: "", cc_email: "" });

    setSendingEmail(true);
    try {
      if (includeQuotationBody) {
        await apiCallProtected.post(URL.quotationSendEmail, {
          quotation_id: currentQuotation.id,
          to_email: JSON.stringify(toEmailArray),
          cc_email: JSON.stringify(ccEmailArray),
          subject: emailForm.subject,
          message: emailForm.message,
          include_quotation_body: true,
        });
      } else {
        // Convert blob URL to File
        const response = await fetch(pdfBlob!);
        const blob = await response.blob();
        const pdfFile = new File(
          [blob],
          `Quotation_${currentQuotation.enquiry_id}.pdf`,
          { type: "application/pdf" }
        );

        // Create FormData
        const formData = new FormData();
        // Send email arrays as JSON strings
        formData.append("to_email", JSON.stringify(toEmailArray));
        if (ccEmailArray.length > 0) {
          formData.append("cc_email", JSON.stringify(ccEmailArray));
        }
        formData.append("subject", emailForm.subject);
        formData.append("message", emailForm.message);
        formData.append("pdf_file", pdfFile);

        // Send email
        await apiCallProtected.post(URL.quotationSendEmail, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      ToastNotification({
        type: "success",
        message: "Email sent successfully",
      });

      closeSendEmail();
      // Reset email errors
      setEmailErrors({ to_email: "", cc_email: "" });
    } catch (error: any) {
      console.error("Error sending email:", error);
      ToastNotification({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to send email",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const generateQuotationPDF = async (rowData: any) => {
    try {
      // Logo/country: use default branch country (e.g. US) when set, else user country
      const country = defaultBranch?.country ?? user?.country ?? null;
      setPreviewOpen(true);
      const userCurrency = await getUserCurrencyCode(
        user?.country?.country_code
      );
      const blobUrl = await generateNewQuotationPDF(
        rowData,
        defaultBranch,
        country,
        userCurrency
      );
      setPdfBlob(blobUrl);
    } catch (error) {
      console.error("Error generating PDF:", error);
      ToastNotification({
        type: "error",
        message: "Error generating PDF preview",
      });
    }
  };

  const showQuotationPreview = (rowData: any) => {
    setCurrentQuotation(rowData);
    generateQuotationPDF(rowData);
  };

  const handleApproveQuotationFromPreview = async () => {
    if (!currentQuotation) {
      ToastNotification({
        type: "error",
        message: "Quotation data is not available.",
      });
      return;
    }

    const quotationId = currentQuotation?.id || currentQuotation?.quotation_id;
    if (!quotationId) {
      ToastNotification({
        type: "error",
        message: "Quotation ID is not available.",
      });
      return;
    }

    // Only allow approval for managers/admins with quotation_approval permission
    if (hasQuotationApprovalPermission && isManagerOrAdmin) {
      setIsApprovingQuotation(true);
      try {
        // Fetch the quotation data first
        const response: any = await getAPICall(
          `${URL.quotation}${quotationId}/`,
          API_HEADER
        );

        if (response && response.status && response.data) {
          const quotationData = response.data;

          // Prepare the edit payload with status updated to "Quote Approved"
          const payload = {
            id: quotationId,
            enquiry_id: quotationData.enquiry_id,
            quotation_services_data:
              quotationData.quotation_services_data ||
              quotationData.quotation ||
              [],
            status: "Quote Approved",
          };

          // Call the edit API
          const updateResponse = await putAPICall(
            URL.quotation,
            payload,
            API_HEADER
          );

          if (updateResponse) {
            ToastNotification({
              type: "success",
              message: "Quotation approved successfully.",
            });

            // Close the preview modal
            handleClosePreview();

            // Refresh the data
            await queryClient.invalidateQueries({
              queryKey: ["filteredQuotations"],
            });
            await queryClient.invalidateQueries({
              queryKey: ["quotationSearch"],
            });
            await queryClient.invalidateQueries({
              queryKey: ["quotations"],
            });

            // Refetch the filtered quotations list
            await refetchFilteredQuotations();
          }
        }
      } catch (error: any) {
        console.error("Error approving quotation:", error);
        ToastNotification({
          type: "error",
          message:
            error?.response?.data?.message ||
            error?.message ||
            "Failed to approve quotation",
        });
      } finally {
        setIsApprovingQuotation(false);
      }
    }
  };

  const handleEditQuotation = (rowData: any) => {
    // Preserve filters and search in store before navigation
    saveFiltersToStore();

    // Preserve current filter state when navigating to edit (includes search and pagination)
    const currentFilterState = {
      filters,
      filtersApplied,
      fromDate,
      toDate,
      searchQuery: searchQuery,
      displayValues: {
        customer_code: customerDisplayValue,
        origin_code: originDisplayValue,
        destination_code: destinationDisplayValue,
      },
    };
    const returnToPath = isApprovalMode ? "/quotation-approval" : "/quotation";
    useListFilterStore.getState().setShouldRestore(currentListKey, true);
    navigate("/quotation-create", {
      state: {
        ...rowData,
        actionType: "edit",
        preserveFilters: currentFilterState,
        restoreFilterValues: buildFilterPayload(),
        shouldRestoreFilters: true, // Keep for backward compatibility
        refreshData: true, // Use refreshData for store-based restoration
        returnToPath,
      },
    });
  };

  const handleApproveQuotation = async (rowData: any) => {
    const quotationId = rowData?.id || rowData?.quotation_id;
    if (!quotationId) {
      ToastNotification({
        type: "error",
        message: "Quotation ID is not available.",
      });
      return;
    }

    // If user has quotation_approval permission and is manager/admin, update status via edit API
    if (hasQuotationApprovalPermission && isManagerOrAdmin && isApprovalMode) {
      setIsApprovingQuotation(true);
      try {
        // Fetch the quotation data first
        const response: any = await getAPICall(
          `${URL.quotation}${quotationId}/`,
          API_HEADER
        );

        if (response && response.status && response.data) {
          const quotationData = response.data;

          // Prepare the edit payload with status updated to "Quotation Approved"
          const payload = {
            id: quotationId,
            enquiry_id: quotationData.enquiry_id,
            quotation_services_data:
              quotationData.quotation_services_data ||
              quotationData.quotation ||
              [],
            status: "Quote Approved",
          };

          // Call the edit API
          const updateResponse = await putAPICall(
            URL.quotation,
            payload,
            API_HEADER
          );

          if (updateResponse) {
            ToastNotification({
              type: "success",
              message: "Quotation approved successfully.",
            });

            // Refresh the data
            await queryClient.invalidateQueries({
              queryKey: ["filteredQuotations"],
            });
            await queryClient.invalidateQueries({
              queryKey: ["quotationSearch"],
            });
            await queryClient.invalidateQueries({
              queryKey: ["quotations"],
            });

            // Refetch the filtered quotations list
            await refetchFilteredQuotations();
          }
        }
      } catch (error: any) {
        console.error("Error approving quotation:", error);
        ToastNotification({
          type: "error",
          message:
            error?.response?.data?.message ||
            error?.message ||
            "Failed to approve quotation",
        });
      } finally {
        setIsApprovingQuotation(false);
      }
    } else {
      // Fallback to opening the approval URL in a new tab
      const baseApprovalUrl =
        import.meta.env.VITE_QUOTATION_APPROVE_URL || window.location.origin;
      const approvalUrl = `${baseApprovalUrl}/quotation/approvalrequest/${quotationId}`;
      window.open(approvalUrl, "_blank", "noopener,noreferrer");
    }
  };

  const primaryActionLabel = isApprovalMode
    ? "Approve Quotation"
    : "Edit Quote";
  const PrimaryActionIcon = isApprovalMode ? IconExternalLink : IconEdit;
  const handlePrimaryAction = isApprovalMode
    ? handleApproveQuotation
    : handleEditQuotation;

  /** Toolbar stats from quotation filter API `summary.status_counts` (filter-scoped). */
  const quotationListStats = useMemo(() => {
    const source = showFilteredQuotationData
      ? filteredQuotationResult
      : quotationResult;
    const sc = source?.statusCounts ?? null;
    return {
      total: summaryListTotalRecords,
      quoteCreated: getQuotationListStatusCount(sc, "quote created"),
      quoteApproved: getQuotationListStatusCount(sc, "quote approved"),
      inactive: getQuotationListStatusCount(sc, "inactive"),
      gained: getQuotationListStatusCount(sc, "gained"),
      lost: getQuotationListStatusCount(sc, "lost"),
    };
  }, [
    showFilteredQuotationData,
    filteredQuotationResult,
    quotationResult,
    summaryListTotalRecords,
  ]);

  const quotationTableRows: QuotationTableRow[] = useMemo(
    () =>
      displayData.map((row: QuotationData, index: number) => ({
        ...row,
        sno: (listCurrentPage - 1) * listPageSize + index + 1,
      })),
    [displayData, listCurrentPage, listPageSize]
  );

  const rowMenuCtx: QuotationRowMenuContext = useMemo(
    () => ({
      location,
      isApprovalMode,
      returnToDashboardRef,
      primaryActionLabel,
      PrimaryActionIcon,
      showQuotationPreview: (row) =>
        showQuotationPreview(row as QuotationData),
      handlePrimaryAction: (row) => handlePrimaryAction(row as QuotationData),
      canCreateBookingFromRow: (row) =>
        canCreateBookingFromRow(row as QuotationData),
      handleCreateBookingFromRow: (row) =>
        handleCreateBookingFromRow(row as QuotationData),
    }),
    [
      location,
      isApprovalMode,
      returnToDashboardRef,
      primaryActionLabel,
      PrimaryActionIcon,
      showQuotationPreview,
      handlePrimaryAction,
      canCreateBookingFromRow,
      handleCreateBookingFromRow,
    ]
  );

  const quotationColumnToggleItems: ERPListColumnToggleItem[] = useMemo(
    () => [
      { id: "sno", label: "S.No", checked: quotationVisibleColumns.sno !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, sno: !p.sno })) },
      { id: "enquiry_id", label: "Enquiry ID", checked: quotationVisibleColumns.enquiry_id !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, enquiry_id: !p.enquiry_id })) },
      { id: "quotation_id", label: "Quotation ID", checked: quotationVisibleColumns.quotation_id !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, quotation_id: !p.quotation_id })) },
      { id: "customer_name", label: "Customer Name", checked: quotationVisibleColumns.customer_name !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, customer_name: !p.customer_name })) },
      { id: "sales_person", label: "Sales Person", checked: quotationVisibleColumns.sales_person !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, sales_person: !p.sales_person })) },
      { id: "created_at", label: "Quote Date", checked: quotationVisibleColumns.created_at !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, created_at: !p.created_at })) },
      { id: "route", label: "Route", checked: quotationVisibleColumns.route !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, route: !p.route })) },
      { id: "reference_no", label: "Reference No", checked: quotationVisibleColumns.reference_no !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, reference_no: !p.reference_no })) },
      { id: "status", label: "Status", checked: quotationVisibleColumns.status !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, status: !p.status })) },
      { id: "valid_upto_list", label: "Valid Upto", checked: quotationVisibleColumns.valid_upto_list !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, valid_upto_list: !p.valid_upto_list })) },
      { id: "revision", label: "Revision", checked: quotationVisibleColumns.revision !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, revision: !p.revision })) },
      { id: "reject_remark", label: "Remark", checked: quotationVisibleColumns.reject_remark !== false, onToggle: () => setQuotationVisibleColumns((p) => ({ ...p, reject_remark: !p.reject_remark })) },
    ],
    [quotationVisibleColumns]
  );

  // Reset pagination when filters or search change to prevent empty table rendering
  useEffect(() => {
    if (filtersApplied) {
      setListCurrentPage(1);
    }
  }, [filtersApplied]);

  // ── Debounced refetch on header-filter edit ───────────────────────────────
  // When `headerFilterTick` advances (the user picked / typed in a column
  // header), wait for `debouncedHeaderFilterTick` to settle (1000ms) then
  // refetch via the SAME `refetchFilteredQuotations` the Apply button uses.
  // We dedupe via `lastHandledHeaderFilterTickRef` so the same tick is never
  // replayed twice (e.g. on a parent re-render). We also save current
  // filters + search to the store so the column-header edits survive a
  // sub-page navigation, mirroring what the Apply button does.
  useEffect(() => {
    if (debouncedHeaderFilterTick === 0) return;
    if (lastHandledHeaderFilterTickRef.current === debouncedHeaderFilterTick)
      return;
    lastHandledHeaderFilterTickRef.current = debouncedHeaderFilterTick;

    setFiltersApplied(true);
    saveFiltersToStore();
    setIsInitialLoading(true);
    void refetchFilteredQuotations().finally(() => setIsInitialLoading(false));
  }, [debouncedHeaderFilterTick, refetchFilteredQuotations, saveFiltersToStore]);

  // Stable reference — the header-filter `renderInput` memo depends on
  // `erpTheme`, so an inline object literal (new reference every render)
  // would make it recompute every render and cascade into the native table
  // re-rendering needlessly. Same fix we did in EnquiryMaster / RFQMaster.
  const erpTheme = useMemo<ErpListTheme>(
    () => ({
      border: DEFAULT_ERP_LIST_THEME.border,
      muted: DEFAULT_ERP_LIST_THEME.muted,
      fg: DEFAULT_ERP_LIST_THEME.fg,
      primary: DEFAULT_ERP_LIST_THEME.primary,
      headerBg: DEFAULT_ERP_LIST_THEME.headerBg,
      pageBg: DEFAULT_ERP_LIST_THEME.pageBg,
      cardBg: DEFAULT_ERP_LIST_THEME.cardBg,
      fontSans: DEFAULT_ERP_LIST_THEME.fontSans,
    }),
    [],
  );
  const { border, muted, primary, fontSans } = erpTheme;

  // ── Header column custom inputs ──────────────────────────────────────────
  // Mirrors the advanced filter section so the column header inputs (visible
  // only when a user clicks a header) send the SAME payload shape — e.g.
  // a customer pick from the header sets `filters.customer_code` (not free
  // text), exactly like the advanced filter SearchableSelect would.
  const quotationHeaderRenderInput = useMemo<
    Partial<Record<QuotationHeaderFilterKey, QuotationHeaderRenderInput>>
  >(
    () => ({
      customer_name: ({ autoFocus, onClose }) => (
        <SearchableSelect
          size="xs"
          autoFocus={autoFocus}
          placeholder="Search customer"
          apiEndpoint={URL.customer}
          searchFields={["customer_code", "customer_name"]}
          displayFormat={quotationCustomerDisplayFormat}
          value={filters.customer_code}
          displayValue={customerDisplayValue}
          onChange={(value, selectedData) => {
            setFilters((prev) => ({
              ...prev,
              customer_code: value || null,
            }));
            setCustomerDisplayValue(selectedData?.label || null);
            setListCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (value) onClose();
          }}
          minSearchLength={3}
          dropdownZIndex={1000}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
          className="filter-searchable-select"
        />
      ),
      origin: ({ autoFocus, onClose }) => (
        <SearchableSelect
          size="xs"
          autoFocus={autoFocus}
          placeholder="Search origin"
          apiEndpoint={URL.portMaster}
          searchFields={["port_code", "port_name"]}
          displayFormat={quotationPortDisplayFormat}
          value={filters.origin_code}
          displayValue={originDisplayValue}
          onChange={(value, selectedData) => {
            setFilters((prev) => ({
              ...prev,
              origin_code: value || null,
            }));
            setOriginDisplayValue(selectedData?.label || null);
            setListCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (value) onClose();
          }}
          minSearchLength={3}
          dropdownZIndex={1000}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
          className="filter-searchable-select"
        />
      ),
      destination: ({ autoFocus, onClose }) => (
        <SearchableSelect
          size="xs"
          autoFocus={autoFocus}
          placeholder="Search destination"
          apiEndpoint={URL.portMaster}
          searchFields={["port_code", "port_name"]}
          displayFormat={quotationPortDisplayFormat}
          value={filters.destination_code}
          displayValue={destinationDisplayValue}
          onChange={(value, selectedData) => {
            setFilters((prev) => ({
              ...prev,
              destination_code: value || null,
            }));
            setDestinationDisplayValue(selectedData?.label || null);
            setListCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (value) onClose();
          }}
          minSearchLength={3}
          dropdownZIndex={1000}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
          className="filter-searchable-select"
        />
      ),
      sales_person: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder={
            salespersonsLoading ? "Loading..." : "Select sales person"
          }
          searchable
          clearable
          size="xs"
          data={salespersonOptions}
          disabled={salespersonsLoading}
          value={filters.sales_person}
          onChange={(value) => {
            setFilters((prev) => ({
              ...prev,
              sales_person: value || null,
            }));
            setListCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      status: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder="Status"
          searchable
          clearable
          size="xs"
          data={[
            { value: "GAINED", label: "Gained" },
            { value: "LOST", label: "Lost" },
            { value: "QUOTE CREATED", label: "Quote Created" },
            { value: "all", label: "All" },
          ]}
          value={filters.status}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value || null }));
            setListCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      valid_upto_list: ({ autoFocus, onClose }) => (
        <SingleDateInput
          autoFocus={autoFocus}
          placeholder="YYYY-MM-DD"
          size="xs"
          value={filters.valid_upto}
          onChange={(date) => {
            setFilters((prev) => ({ ...prev, valid_upto: date }));
            setListCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (date) onClose();
          }}
          allowDeselection
          classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
    }),
    [
      filters.customer_code,
      filters.origin_code,
      filters.destination_code,
      filters.sales_person,
      filters.status,
      filters.valid_upto,
      customerDisplayValue,
      originDisplayValue,
      destinationDisplayValue,
      salespersonOptions,
      salespersonsLoading,
      erpTheme,
    ],
  );

  /**
   * Translates the underlying code (e.g. `INMAA`) into the user-friendly
   * label (e.g. `Chennai (INMAA)`) for the collapsed column header, mirroring
   * what the advanced section's SearchableSelect / Select originally showed.
   */
  const quotationHeaderDisplayFormatter = useMemo<
    Partial<Record<QuotationHeaderFilterKey, (value: string) => string>>
  >(
    () => ({
      customer_name: (raw) => customerDisplayValue ?? raw,
      origin: (raw) => originDisplayValue ?? raw,
      destination: (raw) => destinationDisplayValue ?? raw,
      status: (raw) => {
        const opts: Record<string, string> = {
          GAINED: "Gained",
          LOST: "Lost",
          "QUOTE CREATED": "Quote Created",
          all: "All",
        };
        return opts[raw] ?? raw;
      },
      valid_upto_list: (raw) =>
        raw ? dayjs(raw, "YYYY-MM-DD").format(dateFormat) : raw,
    }),
    [
      customerDisplayValue,
      originDisplayValue,
      destinationDisplayValue,
      dateFormat,
    ],
  );

  const quotationHeaderFiltersProp: QuotationHeaderFiltersProp = useMemo(
    () => ({
      values: quotationHeaderFilterValues,
      onChange: handleQuotationHeaderFilterChange,
      renderInput: quotationHeaderRenderInput,
      displayFormatter: quotationHeaderDisplayFormatter,
    }),
    [
      quotationHeaderFilterValues,
      handleQuotationHeaderFilterChange,
      quotationHeaderRenderInput,
      quotationHeaderDisplayFormatter,
    ],
  );

  if (isApprovalMode && !isManagerOrAdmin) {
    return (
      <Center h="70vh">
        <Alert
          title="Access Restricted"
          color="red"
          variant="light"
          style={{ maxWidth: 420 }}
        >
          Only managers and admins can access the Quotation Approval module.
        </Alert>
      </Center>
    );
  }

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
                  {(location.state?.returnToDashboard || returnToDashboardRef.current) && (
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconArrowLeft size={14} />}
                      styles={erpToolbarOutlineButtonStyles(erpTheme)}
                      onClick={() => {
                        const dashboardState =
                          location.state?.dashboardState || dashboardStateRef.current;
                        if (dashboardState) {
                          navigate("/", {
                            state: { returnToEnquiryDetailedView: true, dashboardState },
                          });
                        } else {
                          navigate("/");
                        }
                      }}
                    >
                      Back to Dashboard
                    </Button>
                  )}
                  <Group gap={6} wrap="wrap" align="center">
                    <ERPListStatPill
                      theme={erpTheme}
                      icon={<IconFileText size={14} color={primary} />}
                      value={quotationListStats.total}
                      label="Total"
                    />
                    <ERPListStatPill
                      theme={erpTheme}
                      icon={<IconFileDescription size={14} color="#2563eb" />}
                      iconBackground="#dbeafe"
                      iconColor="#2563eb"
                      value={quotationListStats.quoteCreated}
                      label="Quote created"
                    />
                    <ERPListStatPill
                      theme={erpTheme}
                      icon={<IconShieldCheck size={14} color="#7c3aed" />}
                      iconBackground="#f3e8ff"
                      iconColor="#7c3aed"
                      value={quotationListStats.quoteApproved}
                      label="Quote approved"
                    />
                    <ERPListStatPill
                      theme={erpTheme}
                      icon={<IconUserOff size={14} color="#64748b" />}
                      iconBackground="#f1f5f9"
                      iconColor="#64748b"
                      value={quotationListStats.inactive}
                      label="Inactive"
                    />
                    <ERPListStatPill
                      theme={erpTheme}
                      icon={<IconTrendingUp size={14} color="#16a34a" />}
                      iconBackground="#f0fdf4"
                      iconColor="#16a34a"
                      value={quotationListStats.gained}
                      label="Gained"
                    />
                    <ERPListStatPill
                      theme={erpTheme}
                      icon={<IconCircleX size={14} color="#dc2626" />}
                      iconBackground="#fee2e2"
                      iconColor="#dc2626"
                      value={quotationListStats.lost}
                      label="Lost"
                    />
                  </Group>
                </>
              ),
              // secondary: (
              //   <Group gap="md" wrap="wrap" align="center">
              //     <Text fw={600} size="sm" c={erpTheme.fg} style={{ fontFamily: fontSans }}>
              //       {pageTitle}
              //     </Text>
              //     <Text size="xs" c={muted} style={{ fontFamily: fontSans }}>
              //       {isApprovalMode ? "Quotation Approval List" : "All quotations"}
              //     </Text>
              //   </Group>
              // ),
              actions: (
                <>
                  <TextInput
                    placeholder="Search…"
                    leftSection={<IconSearch size={16} />}
                    rightSection={
                      searchQuery ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("");
                            clearStoreSearch(currentListKey);
                            prevSearchRef.current = debouncedSearch;
                            const hasOtherFilters =
                              filters.customer_code ||
                              filters.sales_person ||
                              filters.origin_code ||
                              filters.destination_code ||
                              filters.valid_upto ||
                              (filters.quote_type && filters.quote_type !== "all") ||
                              (filters.status && filters.status !== "all") ||
                              filters.remark ||
                              filters.revision ||
                              filters.enquiry_id ||
                              (fromDate && toDate) ||
                              isApprovalMode;
                            if (!hasOtherFilters) {
                              setFiltersApplied(false);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      ) : null
                    }
                    w={240}
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
                  <ERPListColumnToggleMenu
                    theme={erpTheme}
                    items={quotationColumnToggleItems}
                    menuStyles={erpListGeistMenuDropdownStyles}
                    classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
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
                  {user?.is_staff && (
                    <DownloadComponent
                      columns={downloadColumns}
                      fileName="quotation_data"
                      fileExtension="xlsx"
                      buttonText="Download"
                      fetchData={fetchDownloadData}
                      expandQuotations={false}
                    />
                  )}
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: isApprovalMode
                ? "Narrow approval queue by customer, dates, or IDs"
                : "Refine quotations by customer, route, status, or validity",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={clearAllFilters}
                  onApply={applyFilters}
                  clearLabel="Clear filters"
                  applyLoading={isLoading}
                  applyDisabled={isLoading}
                />
              ),
              children: (
                <>
                            <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                              {/* Customer Name Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <SearchableSelect
                                  size="xs"
                                  label="Customer Name"
                                  placeholder="Type customer name"
                                  apiEndpoint={URL.customer}
                                  searchFields={["customer_code", "customer_name"]}
                                  displayFormat={(item: any) => ({
                                    value: String(item.customer_code),
                                    label: String(item.customer_name),
                                  })}
                                  value={filters.customer_code}
                                  displayValue={customerDisplayValue}
                                  onChange={(value, selectedData) => {
                                    setFilters((prev) => ({
                                      ...prev,
                                      customer_code: value || null,
                                    }));
                                    setCustomerDisplayValue(selectedData?.label || null);
                                  }}
                                  minSearchLength={3}
                                  dropdownZIndex={1000}
                                  classNames={erpListGeistSelectClassNames}
                                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                                  className="filter-searchable-select"
                                />
                                </Box>
                              </Grid.Col>
                
                              {/* Sales Person Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <Select
                                  key={`sales-person-${filters.sales_person}`}
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
                                  disabled={salespersonsLoading}
                                  value={filters.sales_person}
                                  onChange={(value) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      sales_person: value || null,
                                    }))
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
                                  placeholder="Type origin code or name"
                                  apiEndpoint={URL.portMaster}
                                  searchFields={["port_code", "port_name"]}
                                  displayFormat={(item: any) => ({
                                    value: String(item.port_code),
                                    label: `${item.port_name} (${item.port_code})`,
                                  })}
                                  value={filters.origin_code}
                                  displayValue={originDisplayValue}
                                  onChange={(value, selectedData) => {
                                    setFilters((prev) => ({
                                      ...prev,
                                      origin_code: value || null,
                                    }));
                                    setOriginDisplayValue(selectedData?.label || null);
                                  }}
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
                                  placeholder="Type destination code or name"
                                  apiEndpoint={URL.portMaster}
                                  searchFields={["port_code", "port_name"]}
                                  displayFormat={(item: any) => ({
                                    value: String(item.port_code),
                                    label: `${item.port_name} (${item.port_code})`,
                                  })}
                                  value={filters.destination_code}
                                  displayValue={destinationDisplayValue}
                                  onChange={(value, selectedData) => {
                                    setFilters((prev) => ({
                                      ...prev,
                                      destination_code: value || null,
                                    }));
                                    setDestinationDisplayValue(selectedData?.label || null);
                                  }}
                                  minSearchLength={3}
                                  dropdownZIndex={1000}
                                  classNames={erpListGeistSelectClassNames}
                                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                                  className="filter-searchable-select"
                                />
                                </Box>
                              </Grid.Col>
                
                              {/* Quote Date Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <SingleDateInput
                                  key={`quote-date-${filters.valid_upto}`}
                                  label="Quote Date"
                                  placeholder="YYYY-MM-DD"
                                  size="xs"
                                  value={filters.valid_upto}
                                  onChange={(date) =>
                                    setFilters((prev) => ({ ...prev, valid_upto: date }))
                                  }
                                  allowDeselection
                                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                                />
                                </Box>
                              </Grid.Col>
                
                              {/* Date Range Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_TWO_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
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
                                  filterFieldStyles={erpListFilterUnifiedMantineStyles(erpTheme)}
                                  dateInputClassNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                />
                                </Box>
                              </Grid.Col>
                
                              {/* Quote Type Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <Select
                                  key={`quote-type-${filters.quote_type}`}
                                  label="Quote Type"
                                  placeholder="Select Quote Type"
                                  searchable
                                  clearable
                                  size="xs"
                                  data={[
                                    { value: "Standard", label: "Standard" },
                                    { value: "All Inclusive", label: "All Inclusive" },
                                    { value: "Lumpsum", label: "Lumpsum" },
                                    { value: "all", label: "All" },
                                  ]}
                                  value={filters.quote_type}
                                  onChange={(value) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      quote_type: value || null,
                                    }))
                                  }
                                  onFocus={(event) => {
                                    // Auto-select all text when input is focused
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
                
                              {/* Approval Status Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <Select
                                  key={`approval-status-${filters.status}`}
                                  label="Approval Status"
                                  placeholder="Select Status"
                                  searchable
                                  clearable
                                  size="xs"
                                  data={[
                                    { value: "GAINED", label: "Gained" },
                                    { value: "LOST", label: "Lost" },
                                    { value: "QUOTE CREATED", label: "Quote Created" },
                                    { value: "all", label: "All" },
                                  ]}
                                  value={filters.status}
                                  onChange={(value) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      status: value || null,
                                    }))
                                  }
                                  onFocus={(event) => {
                                    // Auto-select all text when input is focused
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
                
                              {/* Enquiry ID Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <TextInput
                                  label="Enquiry ID"
                                  placeholder="Enter Enquiry ID"
                                  size="xs"
                                  value={filters.enquiry_id || ""}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      enquiry_id: e.currentTarget.value || null,
                                    }))
                                  }
                                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                                />
                                </Box>
                              </Grid.Col>
                
                              {/* Remark Filter */}
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <TextInput
                                  label="Remark"
                                  placeholder="Search Remark"
                                  size="xs"
                                  value={filters.remark || ""}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      remark: e.currentTarget.value,
                                    }))
                                  }
                                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                                />
                                </Box>
                              </Grid.Col>
                              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                                <Box style={erpListFilterFieldCellStyle}>
                                <TextInput
                                  label="Revision"
                                  placeholder="Search Revision"
                                  size="xs"
                                  value={filters.revision || ""}
                                  onChange={(e) => {
                                    const val = e.currentTarget.value;
                                    if (/^\d*$/.test(val)) {
                                      setFilters((prev) => ({
                                        ...prev,
                                        revision: val,
                                      }));
                                    }
                                  }}
                                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                                />
                                </Box>
                              </Grid.Col>
                            </Grid>
                </>
              ),
            }}
            table={{
              footer: (
                <ERPListPaginationFooter
                  theme={erpTheme}
                  totalRecords={summaryListTotalRecords}
                  pageIndex={listCurrentPage - 1}
                  pageSize={listPageSize}
                  onPageIndexChange={(idx) => setListCurrentPage(idx + 1)}
                  onPageSizeChange={(size) => {
                    setListPageSize(size);
                    setListCurrentPage(1);
                  }}
                  pageSizeOptions={["10", "15", "25", "50"]}
                  selectClassNames={{
                    dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                    option: ERP_LIST_GEIST_ROOT_CLASS,
                  }}
                />
              ),
              // Always render the native table so its `<thead>` (column
              // filters) and the pagination footer stay visible during a
              // refetch. The loader is rendered INSIDE `<tbody>` via the
              // `loading` prop — this also preserves any open header-filter
              // editor across refetches (it lives in the table's state).
              children: (
                <Box
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    position: "relative",
                  }}
                >
                  <Box
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflow: "auto",
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    <QuotationListNativeTable
                      theme={erpTheme}
                      rows={quotationTableRows}
                      visible={quotationVisibleColumns}
                      dateFormat={dateFormat}
                      isEmpty={quotationTableRows.length === 0}
                      onFetchRevision={fetchRevision}
                      rowMenuCtx={rowMenuCtx}
                      headerFilters={quotationHeaderFiltersProp}
                      loading={tableLoading || isFetching}
                      loadingMessage={
                        isInitialLoading
                          ? "Fetching quotations…"
                          : "Loading quotations…"
                      }
                    />
                  </Box>
                  {isApprovalMode && isApprovingQuotation && (
                    <Box
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(255, 255, 255, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        borderRadius: 8,
                      }}
                    >
                      <Stack align="center" gap="md">
                        <Loader size="lg" color="#105476" />
                        <Text c="dimmed" fw={500}>
                          Approving quotation...
                        </Text>
                      </Stack>
                    </Box>
                  )}
                </Box>
              ),
            }}
          />
        </Box>
      </MantineProvider>
      {/* PDF Preview Modal */}
      <Modal
          opened={previewOpen}
          onClose={handleClosePreview}
          title={
            <Text size="lg" fw={600} c="#105476">
              Quotation Preview - {currentQuotation?.enquiry_id}
            </Text>
          }
          size="95%"
          centered
          overlayProps={{
            backgroundOpacity: 0.55,
            blur: 3,
          }}
          styles={{
            content: {
              minHeight: "90vh",
              maxWidth: "1200px",
            },
            body: {
              padding: 0,
              height: "100%",
            },
          }}
        >
          <Stack h="82vh">
            {pdfBlob ? (
              <>
                <iframe
                  src={pdfBlob}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    borderRadius: "8px",
                  }}
                  title="PDF Preview"
                />
                <Group
                  justify="flex-end"
                  p="md"
                  style={{ borderTop: "1px solid #e9ecef" }}
                >
                  <Button
                    variant="outline"
                    onClick={handleClosePreview}
                    leftSection={<IconX size={16} />}
                  >
                    Close
                  </Button>
                  {/* Conditionally show Download PDF, Send Email, and Approve Quotation buttons */}
                  {/* 
                    Logic:
                    - If status is NOT "QUOTE CREATED": Show all buttons for everyone
                    - If status IS "QUOTE CREATED":
                      - If quotation_approval is false: Show all buttons
                      - If quotation_approval is true:
                        - If NOT manager/admin: Hide all buttons except Close
                        - If IS manager/admin: Show all buttons
                  */}
                  {(() => {
                    const status = currentQuotation?.status;
                    const isQuoteCreated =
                      status === "QUOTE CREATED" || status === "Quote Created";

                    // Hide buttons only if: status is "QUOTE CREATED" AND quotation_approval is true AND user is NOT manager/admin
                    const shouldHideButtons =
                      isQuoteCreated &&
                      hasQuotationApprovalPermission &&
                      !isManagerOrAdmin;

                    return !shouldHideButtons ? (
                      <>
                        <Button
                          onClick={handleDownloadPDF}
                          leftSection={<IconDownload size={16} />}
                          color="#105476"
                        >
                          Download PDF
                        </Button>
                        <Button
                          onClick={handleSendEmailClick}
                          leftSection={<IconSend size={16} />}
                          color="#105476"
                          variant="outline"
                        >
                          Send Email
                        </Button>
                        {currentQuotation &&
                          // For managers/admins with quotation_approval permission, use edit functionality
                          // For others, use the external approval link
                          (hasQuotationApprovalPermission &&
                          isManagerOrAdmin ? (
                            <Button
                              color="green"
                              variant="filled"
                              leftSection={
                                <IconEye size={16} style={{ color: "white" }} />
                              }
                              style={{ marginLeft: "8px" }}
                              onClick={handleApproveQuotationFromPreview}
                            >
                              Approve Quotation
                            </Button>
                          ) : (
                            <a
                              href={`${import.meta.env.VITE_QUOTATION_APPROVE_URL || window.location.origin}/quotation/approvalrequest/${currentQuotation.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: "none" }}
                            >
                              <Button
                                color="green"
                                variant="filled"
                                leftSection={
                                  <IconEye
                                    size={16}
                                    style={{ color: "white" }}
                                  />
                                }
                                style={{ marginLeft: "8px" }}
                              >
                                Approve Quotation
                              </Button>
                            </a>
                          ))}
                      </>
                    ) : null;
                  })()}
                </Group>
              </>
            ) : (
              <Center h="100%">
                <Stack align="center">
                  <Loader size="lg" color="#105476" />
                  <Text c="dimmed">Generating PDF preview...</Text>
                </Stack>
              </Center>
            )}
          </Stack>
        </Modal>

        {/* Send Email Modal */}
        <Modal
          opened={sendEmailOpened}
          onClose={closeSendEmail}
          title={
            <Text size="lg" fw={600} c="#105476">
              Send Email - {currentQuotation?.enquiry_id}
            </Text>
          }
          size="lg"
          centered
          overlayProps={{
            backgroundOpacity: 0.55,
            blur: 3,
          }}
        >
          <Stack gap="md">
            <TextInput
              label="To Email"
              placeholder="name@example.com, name2@example.com or name@example.com; name2@example.com"
              value={emailForm.to_email}
              onChange={(e) => {
                setEmailForm({ ...emailForm, to_email: e.target.value });
                // Clear error when user starts typing
                if (emailErrors.to_email) {
                  setEmailErrors({ ...emailErrors, to_email: "" });
                }
              }}
              error={emailErrors.to_email}
              required
            />

            <TextInput
              label="CC Email"
              placeholder="cc@example.com, cc2@example.com"
              value={emailForm.cc_email}
              onChange={(e) => {
                setEmailForm({ ...emailForm, cc_email: e.target.value });
                // Clear error when user starts typing
                if (emailErrors.cc_email) {
                  setEmailErrors({ ...emailErrors, cc_email: "" });
                }
              }}
              error={emailErrors.cc_email}
            />

            <TextInput
              label="Subject"
              placeholder="Enter email subject"
              value={emailForm.subject}
              onChange={(e) =>
                setEmailForm({ ...emailForm, subject: e.target.value })
              }
            />

            <Textarea
              label="Message"
              placeholder="Enter email message"
              value={emailForm.message}
              onChange={(e) =>
                setEmailForm({ ...emailForm, message: e.target.value })
              }
              minRows={4}
            />

            {pdfBlob && (
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Quotation PDF:
                </Text>
                <iframe
                  src={pdfBlob}
                  style={{
                    width: "100%",
                    height: "130px",
                    border: "1px solid #e9ecef",
                    borderRadius: "8px",
                  }}
                  title="PDF Preview"
                />
              </Box>
            )}

            <Group justify="flex-end" mt="md">
              <Button
                variant="outline"
                onClick={closeSendEmail}
                disabled={sendingEmail}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                loading={sendingEmail}
                leftSection={<IconSend size={16} />}
                color="#105476"
              >
                Send
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Modal
          opened={openedRevision}
          onClose={closeRevision}
          title={
            <Text fw={700} c="#105475" size="xl">
              Revision History
            </Text>
          }
          size="80vw"
          radius={10}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isLoadingRevisionHistory ? (
            <Center p="md">
              <Loader color="#105475" />
            </Center>
          ) : revisionHistoryData && revisionHistoryData.length > 0 ? (
            <Stack gap="xs">
              {revisionHistoryData.map((revision, index) => {
                const isExpanded = expandedRevisionIndex === index;
                const charges = revision.charges || [];

                // Helper function to get action by user
                const getActionBy = (charge: any) => {
                  if (charge.action_type === "CREATED")
                    return charge.created_by || "-";
                  if (charge.action_type === "UPDATED")
                    return charge.updated_by || "-";
                  if (charge.action_type === "DELETED")
                    return charge.deleted_by || "-";
                  return "-";
                };

                return (
                  <Box key={index}>
                    <Card
                      shadow="md"
                      radius="md"
                      withBorder
                      mt="md"
                      style={{
                        padding: 0,
                        backgroundColor: "#fafafa",
                        display: "flex",
                        flexDirection: "column",
                        borderWidth: "2px",
                        transition: "0.25s ease",
                        borderColor: isExpanded ? "#105475" : "#e0e0e0",
                        overflow: "hidden",
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.borderColor = "#105475";
                          e.currentTarget.style.boxShadow =
                            "0 4px 12px rgba(0,0,0,0.15)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.borderColor = "#e0e0e0";
                          e.currentTarget.style.boxShadow =
                            "0 2px 6px rgba(0,0,0,0.05)";
                        }
                      }}
                    >
                      <Box
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          padding: "0 16px",
                          cursor: "pointer",
                          width: "100%",
                        }}
                        onClick={() => {
                          setExpandedRevisionIndex(isExpanded ? null : index);
                        }}
                      >
                        <Box px="md" py="md" style={{ flex: 1 }}>
                          <Text fw={700} c="#105475" size="lg">
                            Revision {revision.revision}
                          </Text>
                          <Text c="grey" fw={600} size="sm" mt={4}>
                            Count: {revision.count}
                          </Text>
                        </Box>
                        <Box
                          px="md"
                          py="md"
                          style={{
                            display: "flex",
                            flex: 2,
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Box style={{ flex: 1 }}>
                            <Text fw={600} size="sm">
                              Total Cost
                            </Text>
                            <Badge color="#085e61ff">
                              {revision.total_cost}
                            </Badge>
                          </Box>

                          <Box style={{ flex: 1 }}>
                            <Text fw={600} size="sm">
                              Total Sell
                            </Text>
                            <Badge color="#105475">{revision.total_sell}</Badge>
                          </Box>

                          <Box style={{ flex: 1 }}>
                            <Text fw={600} size="sm">
                              Profit
                            </Text>
                            <Badge
                              color={
                                revision.profit > 0
                                  ? "#0a7020ff"
                                  : revision.profit == 0
                                    ? "#f3a703ff"
                                    : "#e00707ff"
                              }
                            >
                              {revision.profit}
                            </Badge>
                          </Box>
                          <Box style={{ flex: 2 }}>
                            <Text fw={600} size="sm">
                              Remark
                            </Text>
                            <Text>{revision?.remark || "-"}</Text>
                          </Box>
                        </Box>
                        <Box
                          style={{
                            flex: 0,
                            transition: "transform 0.25s ease",
                          }}
                        >
                          {isExpanded ? (
                            <IconChevronUp color="#105475" size={20} />
                          ) : (
                            <IconChevronDown color="#105475" size={20} />
                          )}
                        </Box>
                      </Box>

                      <Collapse in={isExpanded}>
                        <Box
                          style={{
                            backgroundColor: "#ffffff",
                            borderTop: "1px solid #e0e0e0",
                            padding: "16px",
                            overflowX: "auto",
                            overflowY: "visible",
                            maxWidth: "100%",
                          }}
                        >
                          {charges.length > 0 ? (
                            <Box
                              style={{ minWidth: "100%", width: "max-content" }}
                            >
                              <Table
                                striped
                                highlightOnHover
                                withTableBorder
                                withColumnBorders
                                style={{
                                  fontSize: "12px",
                                  minWidth: "100%",
                                  textAlign: "center",
                                }}
                              >
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "80px",
                                      }}
                                    >
                                      Action
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "120px",
                                      }}
                                    >
                                      Charge Name
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "70px",
                                      }}
                                    >
                                      Currency
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "60px",
                                      }}
                                    >
                                      ROE
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "70px",
                                      }}
                                    >
                                      Unit
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "80px",
                                      }}
                                    >
                                      No. of Units
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "90px",
                                      }}
                                    >
                                      Sell Per Unit
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "90px",
                                      }}
                                    >
                                      Min Sell
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "90px",
                                      }}
                                    >
                                      Cost Per Unit
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "80px",
                                      }}
                                    >
                                      Total Cost
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "80px",
                                      }}
                                    >
                                      Total Sell
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "100px",
                                      }}
                                    >
                                      Action By
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        textAlign: "center",
                                        minWidth: "150px",
                                      }}
                                    >
                                      Timestamp
                                    </Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {charges.map(
                                    (charge: any, chargeIndex: number) => (
                                      <Table.Tr key={chargeIndex}>
                                        <Table.Td>
                                          <Badge
                                            color={
                                              charge.action_type === "CREATED"
                                                ? "green"
                                                : charge.action_type ===
                                                    "UPDATED"
                                                  ? "blue"
                                                  : "red"
                                            }
                                            size="sm"
                                          >
                                            {charge.action_type || "-"}
                                          </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.charge_name || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.currency_code || "-"}
                                        </Table.Td>
                                        <Table.Td>{charge.roe || "-"}</Table.Td>
                                        <Table.Td>
                                          {charge.unit || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.no_of_units || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.sell_per_unit || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.min_sell || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.cost_per_unit || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.total_cost || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.total_sell || "-"}
                                        </Table.Td>
                                        <Table.Td>
                                          {getActionBy(charge)}
                                        </Table.Td>
                                        <Table.Td>
                                          {charge.action_timestamp
                                            ? dayjs(
                                                charge.action_timestamp
                                              ).format("YYYY-MM-DD HH:mm:ss")
                                            : "-"}
                                        </Table.Td>
                                      </Table.Tr>
                                    )
                                  )}
                                </Table.Tbody>
                              </Table>
                            </Box>
                          ) : (
                            <Text c="dimmed" ta="center" py="md">
                              No charges found for this revision
                            </Text>
                          )}
                        </Box>
                      </Collapse>
                    </Card>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Text>No Data</Text>
          )}
        </Modal>
    </>
  );
}

export const QuotationApprovalMaster = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isManagerOrAdmin = Boolean(user?.is_manager || user?.is_staff);
  const hasQuotationApprovalPermission = Boolean(
    user?.screen_permissions?.quotation_approval
  );

  // Only show approval page if user has permission and is manager/admin
  useEffect(() => {
    if (!hasQuotationApprovalPermission || !isManagerOrAdmin) {
      // Redirect to quotation list if user doesn't have permission
      navigate("/quotation", { replace: true });
    }
  }, [hasQuotationApprovalPermission, isManagerOrAdmin, navigate]);

  // Only render if user has permission
  if (!hasQuotationApprovalPermission || !isManagerOrAdmin) {
    return null;
  }

  return <QuotationMaster key="quotation-approval" mode="approval" />;
};

export default QuotationMaster;
