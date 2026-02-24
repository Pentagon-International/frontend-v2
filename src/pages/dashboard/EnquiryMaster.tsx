import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Pagination,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  Grid,
  Select,
  Loader,
  Center,
  Badge,
  Modal,
  Tabs,
  Breadcrumbs,
  Anchor,
  Card,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconPlus,
  IconSearch,
  IconFilter,
  IconX,
  IconTag,
  IconDownload,
  IconChevronRight,
  IconChevronLeft,
  IconArrowLeft,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { API_HEADER } from "../../store/storeKeys";
import { URL } from "../../api/serverUrls";
import { apiCallProtected } from "../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import {
  ToastNotification,
  SearchableSelect,
  DateRangeInput,
} from "../../components";
import { postAPICall } from "../../service/postApiCall";
import { putAPICall } from "../../service/putApiCall";
import useAuthStore from "../../store/authStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateEnquiryPDF } from "./EnquiryPDFTemplate";
import { useListFilterStore } from "../../store/listFilterStore";

const LIST_KEY = "ENQUIRY_MASTER";
const DETAILED_LIST_KEY = "ENQUIRY_MASTER_DETAILED";

type FilterState = {
  customer_code: string | null;
  sales_person: string | null;
  origin_code: string | null;
  destination_code: string | null;
  enquiry_received_date: Date | null;
  enquiry_received_date_to: Date | null;
  service: string | null;
  trade: string | null;
  status: string | null;
  enquiry_id: string | null;
  reference_no: string | null;
};

type PreviewFilterState = {
  customer_name: string | null;
  sales_person: string | null;
  enquiry_received_date: Date | null;
  enquiry_received_date_to: Date | null;
  terms_of_shipment: string | null;
  service: string | null;
  trade: string | null;
  origin_name: string | null;
  destination_name: string | null;
  status: string | null;
  enquiry_id: string | null;
  reference_no: string | null;
  // Optional fields for store compatibility (dates are already included above)
};

function EnquiryMaster() {
  // Get first day of current month and today's date
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const getDefaultToDate = (): Date => {
    return new Date();
  };

  const navigate = useNavigate();
  const location = useLocation(); // Add this line to get location
  const hasInitialFilters = Boolean(location.state?.initialFilters);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const setStoreDisplayValues = useListFilterStore(
    (state) => state.setDisplayValues,
  );
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const clearStoreAll = useListFilterStore((state) => state.clearAll);
  const clearStoreAllExcept = useListFilterStore(
    (state) => state.clearAllExcept,
  );

  // Preview modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [currentEnquiry, setCurrentEnquiry] = useState<any>(null);

  // Get the default branch from user
  const defaultBranch =
    user?.branches?.find((branch) => branch.is_default) || user?.branches?.[0];

  // Date range state for summary view
  const [fromDate, setFromDate] = useState<Date | null>(
    hasInitialFilters ? null : getDefaultFromDate(),
  );
  const [toDate, setToDate] = useState<Date | null>(
    hasInitialFilters ? null : getDefaultToDate(),
  );

  const isMountedRef = useRef(false); // Start as false, will be set when mounted or initial filters processed
  const initialFiltersProcessed = useRef(false);
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard),
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state

  // Toggle state for preview table
  const [showPreviewTable, setShowPreviewTable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(hasInitialFilters);

  // Track whether filters have been applied (clicked) vs just selected
  const [filtersApplied, setFiltersApplied] = useState(hasInitialFilters);
  const [previewFiltersApplied, setPreviewFiltersApplied] = useState(false);

  // Store display values (labels) for SearchableSelect fields in summary view
  const [customerDisplayValue, setCustomerDisplayValue] = useState<
    string | null
  >(null);
  const [originDisplayValue, setOriginDisplayValue] = useState<string | null>(
    null,
  );
  const [destinationDisplayValue, setDestinationDisplayValue] = useState<
    string | null
  >(null);

  // Store display values (labels) for SearchableSelect fields in preview view
  const [previewCustomerDisplayValue, setPreviewCustomerDisplayValue] =
    useState<string | null>(null);
  const [previewOriginDisplayValue, setPreviewOriginDisplayValue] = useState<
    string | null
  >(null);
  const [previewDestinationDisplayValue, setPreviewDestinationDisplayValue] =
    useState<string | null>(null);

  // SEPARATE PAGINATION STATES FOR BOTH VIEWS
  // List view pagination
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [listTotalRecords, setListTotalRecords] = useState(0);
  const [cancellingEnquiryId, setCancellingEnquiryId] = useState<number | null>(null);

  // Detailed view pagination (completely separate)
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(25);

  const listPaginationInfo = useMemo(() => {
    const total = listTotalRecords || 0;
    const totalPages = Math.max(1, Math.ceil(total / listPageSize || 1));
    const start = total === 0 ? 0 : (listCurrentPage - 1) * listPageSize + 1;
    const end =
      total === 0 ? 0 : Math.min(listCurrentPage * listPageSize, total);
    return { start, end, total, totalPages };
  }, [listCurrentPage, listPageSize, listTotalRecords]);

  const previewColumnToKeyMap: Record<string, string> = {
    "Enquiry ID": "enquiry_id",
    "Sales Person": "sales_person",
    "Enquiry Date": "enquiry_date",
    Trade: "trade",
    Shipment: "shipment",
    "Customer Name": "customer_name",
    Location: "location",
    Service: "service",
    Origin: "origin",
    Destination: "destination",
    "Cargo Details": "cargo_details",
    "Total Cost": "total_cost",
    "Total Sell": "total_sell",
    Profit: "profit",
    Status: "status",
    Remark: "service_remark",
    "Reference No": "reference_no",
  };

  const openPreview = async () => {
    try {
      setShowPreviewTable(true);
      setPreviewCurrentPage(1);

      // Use summary view's filters (ENQUIRY_MASTER) as initialFilters for detailed view (ENQUIRY_MASTER_DETAILED)
      const summaryState = useListFilterStore.getState().getState(LIST_KEY);
      const summaryFilters = summaryState?.filters as
        | (FilterState & {
            enquiry_received_date?: Date | null;
            enquiry_received_date_to?: Date | null;
          })
        | undefined;

      const initialPreviewFilters: PreviewFilterState = summaryFilters
        ? {
            customer_name: summaryFilters.customer_code ?? null,
            sales_person: summaryFilters.sales_person ?? null,
            enquiry_received_date:
              summaryFilters.enquiry_received_date ?? getDefaultFromDate(),
            enquiry_received_date_to:
              summaryFilters.enquiry_received_date_to ?? getDefaultToDate(),
            terms_of_shipment: null,
            service: summaryFilters.service ?? null,
            trade: summaryFilters.trade ?? null,
            origin_name: summaryFilters.origin_code ?? null,
            destination_name: summaryFilters.destination_code ?? null,
            status: summaryFilters.status ?? "ACTIVE",
            enquiry_id: summaryFilters.enquiry_id ?? null,
            reference_no: summaryFilters.reference_no ?? null,
          }
        : {
            customer_name: null,
            sales_person: null,
            enquiry_received_date: getDefaultFromDate(),
            enquiry_received_date_to: getDefaultToDate(),
            terms_of_shipment: null,
            service: null,
            trade: null,
            origin_name: null,
            destination_name: null,
            status: "ACTIVE",
            enquiry_id: null,
            reference_no: null,
          };

      setPreviewFilters(initialPreviewFilters);
      const hasReplicatedFilters = Boolean(
        initialPreviewFilters.customer_name ||
          initialPreviewFilters.sales_person ||
          initialPreviewFilters.origin_name ||
          initialPreviewFilters.destination_name ||
          initialPreviewFilters.service ||
          initialPreviewFilters.trade ||
          initialPreviewFilters.enquiry_id ||
          initialPreviewFilters.reference_no ||
          (initialPreviewFilters.status &&
            initialPreviewFilters.status !== "ALL"),
      );
      setPreviewFiltersApplied(hasReplicatedFilters);

      setStoreFilters(DETAILED_LIST_KEY, initialPreviewFilters);
      setStoreSearch(DETAILED_LIST_KEY, summaryState?.search ?? "");
      useListFilterStore.getState().setShouldRestore(DETAILED_LIST_KEY, true);

      setSearchQuery(summaryState?.search ?? "");
      setShowFilters(false);

      // Restore effect will run and fetch detailed API with these initialFilters; no direct refetch here
    } catch (error: any) {
      ToastNotification({
        type: "error",
        message: error?.message || "Failed to load preview",
      });
    }
  };

  const closePreview = async () => {
    try {
      setShowPreviewTable(false);
      // Reset preview pagination/search initialization flags when leaving detailed view
      previewPaginationInitialized.current = false;
      previewSearchInitializedRef.current = false;
      // Reset to first page when switching back to list view
      setListCurrentPage(1);
      // Close the filters section when switching back to list view
      setShowFilters(false);

      // Check if detailed view has applied filters
      if (previewFiltersApplied) {
        // Map detailed view filters to summary view filters
        const mappedFilters: FilterState = {
          customer_code: previewFilters.customer_name || null, // Map customer_name to customer_code
          sales_person: previewFilters.sales_person || null,
          origin_code: previewFilters.origin_name || null, // Map origin_name to origin_code
          destination_code: previewFilters.destination_name || null, // Map destination_name to destination_code
          enquiry_received_date: null, // Not used in summary view filter state
          enquiry_received_date_to: null, // Not used in summary view filter state
          service: previewFilters.service || null,
          trade: previewFilters.trade || null,
          status: previewFilters.status || "ACTIVE",
          enquiry_id: previewFilters.enquiry_id || null,
          reference_no: previewFilters.reference_no || null,
        };

        setFilters(mappedFilters);
        // Map date range from detailed view to summary view
        setFromDate(previewFilters.enquiry_received_date);
        setToDate(previewFilters.enquiry_received_date_to);

        // Mark filters as applied in summary view
        setFiltersApplied(true);

        // Save summary filters to store
        saveFiltersToStore();
      } else {
        // No filters applied in detailed view, preserve existing summary view filters
        // DO NOT clear filters or reset filtersApplied - preserve the summary view filters
        // The filters and filtersApplied state should remain as they were before switching to detailed view

        // Save current preview filters to store (even if empty) to maintain state
        savePreviewFiltersToStore();
      }
    } catch (error: any) {
      console.error("Error closing preview:", error);
    }
  };

  const downloadExcel = async () => {
    try {
      setDownloading(true);
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        ToastNotification({ type: "error", message: "No access token found" });
        return;
      }
      // Build filter payload for download (use preview filters in detailed view, summary filters otherwise)
      const filterPayload = showPreviewTable
        ? buildPreviewFilterPayload
        : buildFilterPayload();
      const requestBody = { filters: { ...filterPayload } };
      const response: any = await postAPICall(
        `${URL.enquiryDownloadExcel}`,
        requestBody,
        { responseType: "blob" }
      );
      const blob = response?.data instanceof Blob ? response.data : response;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "enquiries.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      ToastNotification({
        type: "error",
        message: error?.message || "Download failed",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPdfBlob(null);
    setCurrentEnquiry(null);
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
  };

  const handleDownloadPDF = () => {
    if (pdfBlob && currentEnquiry) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `Enquiry-${currentEnquiry.enquiry_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  const generateEnquiryPDFPreview = async (rowData: any) => {
    try {
      const country = user?.country || null;
      setPreviewOpen(true);
      const blobUrl = generateEnquiryPDF(rowData, defaultBranch, country);
      setPdfBlob(blobUrl);
    } catch (error) {
      console.error("Error generating PDF:", error);
      ToastNotification({
        type: "error",
        message: "Error generating PDF preview",
      });
    }
  };

  const showEnquiryPreview = (rowData: any) => {
    setCurrentEnquiry(rowData);
    generateEnquiryPDFPreview(rowData);
  };

  // Filter states - OPTIMIZED with useCallback for better performance
  const [filters, setFilters] = useState<FilterState>({
    customer_code: null,
    sales_person: null,
    origin_code: null,
    destination_code: null,
    enquiry_received_date: null,
    enquiry_received_date_to: null,
    service: null,
    trade: null,
    status: "ACTIVE",
    enquiry_id: null,
    reference_no: null,
  });

  // Detailed view filter states (7 inputs only) - OPTIMIZED
  const [previewFilters, setPreviewFilters] = useState<PreviewFilterState>({
    customer_name: null,
    sales_person: null,
    enquiry_received_date: null,
    enquiry_received_date_to: null,
    terms_of_shipment: null,
    service: null,
    trade: null,
    origin_name: null,
    destination_name: null,
    status: "ACTIVE",
    enquiry_id: null,
    reference_no: null,
  });

  // Optimized filter update functions to reduce re-renders
  const updateFilter = useCallback((key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updatePreviewFilter = useCallback(
    (key: keyof PreviewFilterState, value: any) => {
      setPreviewFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // Helper function to save filters with dates to store (ensures consistency)
  // This function captures current filter/date/search values when called
  const saveFiltersToStore = useCallback(() => {
    const filtersWithDates = {
      ...filters,
      enquiry_received_date: fromDate,
      enquiry_received_date_to: toDate,
    };
    setStoreFilters(LIST_KEY, filtersWithDates);
    setStoreSearch(LIST_KEY, searchQuery);
    setStoreDisplayValues(LIST_KEY, {
      customer_code: customerDisplayValue ?? null,
      origin_code: originDisplayValue ?? null,
      destination_code: destinationDisplayValue ?? null,
    });
    console.log("💾 Saved filters to store:", {
      filters: filtersWithDates,
      search: searchQuery,
      displayValues: {
        customer_code: customerDisplayValue,
        origin_code: originDisplayValue,
        destination_code: destinationDisplayValue,
      },
      timestamp: new Date().toISOString(),
    });
  }, [
    filters,
    fromDate,
    toDate,
    searchQuery,
    customerDisplayValue,
    originDisplayValue,
    destinationDisplayValue,
    setStoreFilters,
    setStoreSearch,
    setStoreDisplayValues,
  ]);

  // Helper function to save preview filters to store (for Detailed view)
  const savePreviewFiltersToStore = useCallback(() => {
    setStoreFilters(DETAILED_LIST_KEY, previewFilters);
    setStoreSearch(DETAILED_LIST_KEY, searchQuery);
    setStoreDisplayValues(DETAILED_LIST_KEY, {
      customer_code: customerDisplayValue ?? null,
      origin_code: originDisplayValue ?? null,
      destination_code: destinationDisplayValue ?? null,
    });
    console.log("💾 [Detailed View] Saved filters to store:", {
      filters: previewFilters,
      search: searchQuery,
      displayValues: {
        customer_code: customerDisplayValue,
        origin_code: originDisplayValue,
        destination_code: destinationDisplayValue,
      },
      timestamp: new Date().toISOString(),
    });
  }, [
    previewFilters,
    searchQuery,
    customerDisplayValue,
    originDisplayValue,
    destinationDisplayValue,
    setStoreFilters,
    setStoreSearch,
    setStoreDisplayValues,
  ]);

  const [showFilters, setShowFilters] = useState(false);

  // Debounced search effect (non-invasive)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Optimized filter toggle to prevent unnecessary re-renders
  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  // Single payload builder function
  const buildFilterPayload = useCallback(() => {
    const payload: any = {};

    // Add date range if both dates are selected
    if (fromDate && toDate) {
      payload.enquiry_received_date_from = dayjs(fromDate).format("YYYY-MM-DD");
      payload.enquiry_received_date_to = dayjs(toDate).format("YYYY-MM-DD");
    }

    if (filters.customer_code) payload.customer_code = filters.customer_code;
    if (filters.sales_person) payload.sales_person = filters.sales_person;
    if (filters.origin_code) payload.origin_code = filters.origin_code;
    if (filters.destination_code)
      payload.destination_code = filters.destination_code;
    if (filters.service) payload.service = filters.service;
    if (filters.trade) payload.trade = filters.trade;
    if (filters.enquiry_id) payload.enquiry_id = filters.enquiry_id;
    if (filters.reference_no) payload.reference_no = filters.reference_no;
    if (filters.status && filters.status !== "ALL") {
      payload.status = filters.status;
    } else {
      payload.status = "";
    }

    // Include search based on latest available value.
    // Prefer debouncedSearch for typing flows, but fall back to searchQuery
    // so restored search (setSearchQuery) is not lost before debounce fires.
    const effectiveSearch = debouncedSearch.trim() || searchQuery.trim();
    if (effectiveSearch) {
      payload.search = effectiveSearch;
    }

    return payload;
  }, [filters, fromDate, toDate, debouncedSearch, searchQuery]);

  // Build preview filter payload function (for detailed view)
  // Use the same canonical filter state (FilterState + from/to dates) so both views share filters
  const buildPreviewFilterPayload = useMemo(() => {
    const payload: any = {};

    // Add date range if both dates are selected
    if (fromDate && toDate) {
      payload.enquiry_received_date_from = dayjs(fromDate).format("YYYY-MM-DD");
      payload.enquiry_received_date_to = dayjs(toDate).format("YYYY-MM-DD");
    }

    if (filters.customer_code) payload.customer_code = filters.customer_code;
    if (filters.sales_person) payload.sales_person = filters.sales_person;
    if (filters.origin_code) payload.origin_code = filters.origin_code;
    if (filters.destination_code)
      payload.destination_code = filters.destination_code;
    if (filters.service) payload.service = filters.service;
    if (filters.trade) payload.trade = filters.trade;
    if (filters.enquiry_id) payload.enquiry_id = filters.enquiry_id;
    if (filters.reference_no) payload.reference_no = filters.reference_no;
    if (filters.status && filters.status !== "ALL") {
      payload.status = filters.status;
    } else {
      payload.status = "";
    }

    // Include search as part of the payload (search is a filter)
    // Use debouncedSearch when typing, but fall back to searchQuery so
    // restored values are included even before debounce completes.
    const effectiveSearch = debouncedSearch.trim() || searchQuery.trim();
    if (effectiveSearch) {
      payload.search = effectiveSearch;
    }

    return payload;
  }, [filters, fromDate, toDate, debouncedSearch, searchQuery]);

  // Single summary query for enquiries (enquiryFilter) - used for both initial and filtered data
  const {
    data: summaryResult,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["enquirySummary", listCurrentPage, listPageSize],
    queryFn: async () => {
      try {
        // Use restored payload from store when returning from sub-page (exact filters preserved)
        let filterPayload: Record<string, unknown>;
        if (restorePayloadRef.current) {
          filterPayload = restorePayloadRef.current as Record<string, unknown>;
          restorePayloadRef.current = null;
        } else {
          filterPayload = buildFilterPayload();
        }

        const response = await apiCallProtected.post(
          `${URL.enquiryFilter}?index=${(listCurrentPage - 1) * listPageSize}&limit=${listPageSize}`,
          { filters: filterPayload },
        );
        const data = response as any;
        const rows = Array.isArray(data?.data) ? data.data : [];
        const total = data?.total || rows.length || 0;
        setListTotalRecords(total);
        return { data: rows, total };
      } catch (error) {
        console.error("Error fetching enquiry data:", error);
        setListTotalRecords(0);
        return { data: [], total: 0 };
      }
    },
    enabled: false, // Always refetch explicitly (Apply, navigation restore, etc.)
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Single detailed query (enquiryPreviewExcel) - covers initial, filtered, and search flows
  const {
    data: previewResult,
    isFetching: previewFetching,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["enquiryPreview", previewCurrentPage, previewPageSize],
    queryFn: async () => {
      try {
        // Always build payload from current filters + dates + debounced search
        const filterPayload = buildPreviewFilterPayload;
        const res: any = await apiCallProtected.post(
          `${URL.enquiryPreviewExcel}?index=${(previewCurrentPage - 1) * previewPageSize}&limit=${previewPageSize}`,
          { filters: { ...filterPayload } },
        );
        return {
          columns: Array.isArray(res?.columns) ? res.columns : [],
          data: Array.isArray(res?.data) ? res.data : [],
          total: res?.total_count || res?.total || 0,
        };
      } catch (error: any) {
        ToastNotification({
          type: "error",
          message: error?.message || "Failed to load preview",
        });
        return { columns: [], data: [], total: 0 };
      }
    },
    enabled: false, // Always refetch explicitly (Apply, navigation restore, etc.)
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

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

  // Memoized service options
  const serviceOptions = useMemo(
    () => [
      { value: "FCL", label: "FCL" },
      { value: "LCL", label: "LCL" },
      { value: "AIR", label: "AIR" },
    ],
    [],
  );

  // Memoized trade options
  const tradeOptions = useMemo(
    () => [
      { value: "Import", label: "Import" },
      { value: "Export", label: "Export" },
    ],
    [],
  );

  // Memoized status options
  const statusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: "Active" },
      { value: "QUOTE CREATED", label: "Quote Created" },
      { value: "GAINED", label: "Gain" },
      { value: "LOST", label: "Lost" },
      { value: "ALL", label: "All" },
    ],
    [],
  );

  // No separate search queries – search is merged into the main payloads

  // Choose which data set to show in tables (no client-side filtering of rows)
  const tableData = summaryResult?.data || [];
  const tablePreviewData = previewResult || { columns: [], data: [], total: 0 };

  // Loading state - single source of truth for table loader
  // Use isFetching states (not isLoading) as they remain true during refetch
  // isRefreshingData is set manually before/after explicit refetch calls
  const tableLoading = isRefreshingData || summaryFetching;

  // Keep isLoading for backward compatibility (used elsewhere)
  // const isLoading =
  //   enquiryLoading ||
  //   filteredEnquiryLoading ||
  //   isRefreshingData;

  // // Use isFetching to show progress bars while keeping previous data visible
  // const isFetching =
  //   enquiryFetching ||
  //   filteredEnquiryFetching ||
  //   isRefreshingData;

  // Use isFetching states for preview loading (they remain true during refetch)
  // isRefreshingData is set manually before/after explicit refetch calls
  const isPreviewLoading = isRefreshingData || previewFetching;

  // Map status to badge props (label and color)
  const getStatusBadge = (statusRaw: string | undefined | null) => {
    const statusUpper = (statusRaw || "").toUpperCase();
    const label =
      statusUpper === "INACTIVE" ? "CANCEL" : statusUpper || "ACTIVE";
    let color: string = "cyan";
    if (label === "GAINED") color = "green";
    else if (label === "LOST" || label === "CANCEL") color = "red";
    else if (label === "ACTIVE") color = "#105476";
    return { label, color } as const;
  };

  // Create preview table using MantineReactTable
  const previewTable = useMantineReactTable({
    columns: (() => {
      const desiredOrder = [
        "Customer Name",
        "Enquiry ID",
        "Reference No",
        "Sales Person",
        "Enquiry Date",
        "Shipment",
        "Location",
        "Service",
        "Origin",
        "Destination",
      ];

      const availableColumns = (tablePreviewData?.columns || []).filter(
        (col: string) =>
          !["No of Containers", "sno", "S.No", "SNO", "S No"].includes(col),
      );

      if (!availableColumns.includes("Reference No")) {
        availableColumns.push("Reference No");
      }

      const orderedColumns: string[] = [
        ...desiredOrder.filter((col: string) => availableColumns.includes(col)),
        ...availableColumns.filter(
          (col: string) => !desiredOrder.includes(col),
        ),
      ];

      const columnDefs: MRT_ColumnDef<any>[] = [];

      // Add S.No as the first column for detailed view
      columnDefs.push({
        accessorKey: "sno",
        header: "S.No",
        size: 70,
      });

      orderedColumns.forEach((col: string) => {
        // Combine Service and Trade columns
        if (col === "Service") {
          columnDefs.push({
            accessorKey: "service_trade_combined",
            header: "Service",
            size: 130,
            Cell: ({ row }: any) => {
              const serviceValue = row.original?.service || "";
              const tradeValue = row.original?.trade || "";

              if (!serviceValue && !tradeValue) {
                return "-";
              }
              if (!serviceValue) {
                return tradeValue;
              }
              if (!tradeValue) {
                return serviceValue;
              }
              return `${serviceValue} - ${tradeValue}`;
            },
          });
          return;
        }

        // Skip Trade column (handled with Service)
        if (col === "Trade") {
          return;
        }

        columnDefs.push({
          accessorKey: previewColumnToKeyMap[col] || col,
          header: col,
          size:
            col === "Customer Name" || col.toLowerCase().includes("customer")
              ? 218
              : col === "Enquiry ID"
                ? 218
                : col === "Sales Person"
                  ? 120
                  : col === "Enquiry Date"
                    ? 120
                    : col === "Remark"
                      ? 180
                      : col === "Status"
                        ? 130
                        : col === "Shipment"
                          ? 163
                          : col === "Location"
                            ? 218
                            : col === "Service"
                              ? 140
                              : col === "Origin"
                                ? 150
                                : col === "Destination"
                                  ? 150
                                  : col === "Cargo Details"
                                    ? 150
                                    : col === "Reference No"
                                      ? 120
                                      : 100,
          Cell: ({ cell, column }: any) => {
            const value = cell.getValue();

            // Apply badge for Status column
            if (column.id === "status" || column.id === "Status") {
              const { label, color } = getStatusBadge(String(value || ""));
              return (
                <Badge color={color} size="sm">
                  {label}
                </Badge>
              );
            }

            return value === null || value === undefined || value === ""
              ? "-"
              : String(value);
          },
        });
      });

      return columnDefs;
    })(),
    data: tablePreviewData?.data || [],
    enableColumnFilters: false,
    enablePagination: false, // Removed pagination
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      // Pin S.No first, then Customer Name on the left
      columnPinning: { left: ["sno", "customer_name"] },
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
    // Keep cell/head styles minimal to avoid interfering with built-in sticky behavior
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 16px",
        fontSize: "14px",
        fontstyle: "regular",
        fontFamily: "Inter",
        color: "#333740",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "8px 16px",
        fontSize: "14px",
        fontFamily: "Inter",
        fontstyle: "bold",
        color: "#444955",
        backgroundColor: "#FBFBFB",
        borderBottom: "1px solid #F3F3F3",
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
  });

  const applyFilters = async () => {
    try {
      console.log("filters.status", filters.status);
      const filterPayload = buildFilterPayload();
      const hasFilterValues =
        filterPayload.customer_code ||
        filterPayload.sales_person ||
        filterPayload.origin_code ||
        filterPayload.destination_code ||
        filterPayload.enquiry_received_date_from ||
        filterPayload.service ||
        filterPayload.trade ||
        filterPayload.enquiry_id ||
        filterPayload.reference_no ||
        filterPayload.search ||
        (filters.status !== "ALL" ? filterPayload.status : true);

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

      if (showPreviewTable) {
        // Save preview filters and search to store
        savePreviewFiltersToStore();

        setPreviewCurrentPage(1); // Reset to first page when applying filters
        setPreviewFiltersApplied(true); // Mark that filters were applied
        setIsRefreshingData(true);
        try {
          await refetchPreview(); // Manually refetch detailed data
          setIsRefreshingData(false);
          ToastNotification({
            type: "success",
            message: "Filters applied successfully",
          });
        } catch (error) {
          console.error("Error applying preview filters:", error);
          setIsRefreshingData(false);
          ToastNotification({
            type: "error",
            message: "Error applying filters",
          });
        }
      } else {
        setListCurrentPage(1);
        // Set loading state FIRST before marking filters as applied
        // This ensures loader shows and previous data remains visible
        setIsRefreshingData(true);
        try {
          // Manually refetch filtered data - loader will show until response
          // Note: When query is disabled, refetch() might not set isLoading=true,
          // so we rely on isRefreshingData for the loader
          const result = await refetchSummary();
          if (result.data?.length) {
            setFiltersApplied(true);
          }

          // Check if data was returned successfully
          if (result.data && Array.isArray(result.data)) {
            // Data is now set in filteredEnquiryData via React Query
            // displayData will automatically update to show filteredEnquiryData
            // Small delay to ensure React Query has updated the data state
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          // Hide loader after data is received and set
          setIsRefreshingData(false);

          ToastNotification({
            type: "success",
            message: "Filters applied successfully",
          });
        } catch (error) {
          console.error("Error applying filters:", error);
          setIsRefreshingData(false);
          ToastNotification({
            type: "error",
            message: "Error applying filters",
          });
        }
      }
      setShowFilters(false);
    } catch (error) {
      console.error("Error applying filters:", error);
      setShowFilters(false);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);

    // Reset summary view filters to initial state (status: "ACTIVE", dates to default)
    setFilters({
      customer_code: null,
      sales_person: null,
      origin_code: null,
      destination_code: null,
      enquiry_received_date: null,
      enquiry_received_date_to: null,
      service: null,
      trade: null,
      status: "ACTIVE", // Reset to initial status
      enquiry_id: null,
      reference_no: null,
    });

    // Reset dates to default values (like first load)
    setFromDate(getDefaultFromDate());
    setToDate(getDefaultToDate());

    // Reset preview view filters to initial state (status: "ACTIVE" + default dates)
    setPreviewFilters({
      customer_name: null,
      sales_person: null,
      enquiry_received_date: getDefaultFromDate(), // Reset to default from date (first day of month)
      enquiry_received_date_to: getDefaultToDate(), // Reset to default to date (today)
      terms_of_shipment: null,
      service: null,
      trade: null,
      origin_name: null,
      destination_name: null,
      status: "ACTIVE", // Reset to initial status
      enquiry_id: null,
      reference_no: null,
    });
    setSearchQuery("");
    // Clear filters and search in store (both summary and detailed views)
    clearStoreFilters(LIST_KEY);
    clearStoreSearch(LIST_KEY);
    clearStoreFilters(DETAILED_LIST_KEY);
    clearStoreSearch(DETAILED_LIST_KEY);

    // Clear display values
    setCustomerDisplayValue(null);
    setOriginDisplayValue(null);
    setDestinationDisplayValue(null);
    setPreviewCustomerDisplayValue(null);
    setPreviewOriginDisplayValue(null);
    setPreviewDestinationDisplayValue(null);

    // Reset filter applied states
    setFiltersApplied(false);
    setPreviewFiltersApplied(false);

    if (showPreviewTable) {
      setPreviewCurrentPage(1); // Reset to first page
      // Invalidate queries and refetch preview data with initial payload
      await queryClient.invalidateQueries({ queryKey: ["enquiryPreview"] });
      await queryClient.invalidateQueries({
        queryKey: ["filteredPreviewData"],
      });
      await queryClient.invalidateQueries({ queryKey: ["initialPreviewData"] });
      await queryClient.invalidateQueries({ queryKey: ["previewSearch"] });
      // Wait a bit for state updates to flush before refetching
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsRefreshingData(true);
      await refetchPreview(); // This uses enquiryPreviewExcel with current filters/search
      setIsRefreshingData(false);
    } else {
      setListCurrentPage(1); // Reset to first page
      // Invalidate queries and refetch with initial payload (status: "ACTIVE" + default dates)
      await queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      await queryClient.invalidateQueries({ queryKey: ["filteredEnquiries"] });
      // Wait a bit for state updates (dates) to flush before refetching
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsRefreshingData(true);
      await refetchSummary(); // This uses enquiryFilter with current filters/search
      setIsRefreshingData(false);
    }

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const handleCancelEnquiry = async (enquiry: number) => {
    const enquiryData = enquiry as any;
    setCancellingEnquiryId(enquiryData.id ?? null);
    try {

      // Build service payload to match edit flow (getEnquiryPayload in EnquiryCreate)
      const mapService = (service: any) => {
        const svc: any = {
          service: service.service,
          origin_code: service.origin_code_read || service.origin_code,
          destination_code:
            service.destination_code_read || service.destination_code,
          pickup: service.pickup === true || service.pickup === "true",
          delivery: service.delivery === true || service.delivery === "true",
          pickup_location: service.pickup_location || "",
          delivery_location: service.delivery_location || "",
          hazardous_cargo: service.hazardous_cargo === true || service.hazardous_cargo === "Yes",
          stackable: service.stackable === true || service.stackable === "Yes",
          shipment_terms_code:
            service.shipment_terms_code_read || service.shipment_terms_code || "",
          icd: service.icd || "",
          service_remark: service.service_remark || "",
          commodity: service.commodity || "",
        };
        if (service.id != null) svc.id = service.id;
        svc.un_no =
          svc.hazardous_cargo === true ? (service.un_no ?? null) : null;
        svc.class_name =
          svc.hazardous_cargo === true ? (service.class_name ?? service.class ?? null) : null;
        svc.pkg_group =
          svc.hazardous_cargo === true ? (service.pkg_group ?? null) : null;
        if (service.service === "OTHERS") {
          svc.trade = null;
          svc.service_name = service.service_name || "";
          svc.service_code = service.service_code || "";
        } else {
          svc.trade = service.trade ?? null;
        }
        // FCL (or OTHERS with FCL structure) - only when there are actual container rows (don't add fcl_details: [] for OTHERS LCL)
        if (
          (service.service === "FCL" || service.service === "OTHERS") &&
          service.fcl_details &&
          Array.isArray(service.fcl_details) &&
          service.fcl_details.length > 0
        ) {
          svc.fcl_details = service.fcl_details.map((fcl: any) => {
            const item: any = {
              container_type: fcl.container_type_code ?? fcl.container_type,
              no_of_containers: Number(fcl.no_of_containers) || 0,
              gross_weight:
                fcl.gross_weight != null
                  ? Number(fcl.gross_weight).toFixed(2)
                  : "0.00",
            };
            if (fcl.id != null) item.id = fcl.id;
            return item;
          });
        }
        // AIR (or OTHERS with AIR structure)
        if (
          service.service === "AIR" ||
          (service.service === "OTHERS" &&
            (service.volume_weight != null || service.chargeable_weight != null))
        ) {
          svc.no_of_packages = service.no_of_packages != null ? Number(service.no_of_packages) : 0;
          svc.gross_weight =
            service.gross_weight != null
              ? Number(service.gross_weight).toFixed(2)
              : "0.00";
          svc.volume_weight =
            service.volume_weight != null
              ? Math.round(Number(service.volume_weight) * 1000) / 1000
              : 0;
          svc.chargeable_weight =
            service.chargeable_weight != null
              ? Number(service.chargeable_weight).toFixed(2)
              : "0.00";
          if (
            service.dimension_data &&
            Array.isArray(service.dimension_data) &&
            service.dimension_data.length > 0
          ) {
            svc.dimension_details = service.dimension_data.map((d: any) => ({
              pieces: Number(d.pieces) || 0,
              length: Number(d.length) || 0,
              width: Number(d.width) || 0,
              height: Number(d.height) || 0,
              value: Number(d.value) || 0,
              volume_weight: d.volume_weight != null ? Math.round(Number(d.volume_weight) * 1000) / 1000 : 0,
              dimension_unit: d.dimension_unit || "",
              ...(d.id != null && { id: d.id }),
            }));
          }
        }
        // LCL (or OTHERS with LCL structure)
        if (
          service.service === "LCL" ||
          (service.service === "OTHERS" &&
            !svc.fcl_details &&
            (service.volume != null || service.chargeable_volume != null))
        ) {
          svc.no_of_packages = service.no_of_packages != null ? Number(service.no_of_packages) : 0;
          svc.gross_weight =
            service.gross_weight != null
              ? Number(service.gross_weight).toFixed(2)
              : "0.00";
          svc.volume =
            service.volume != null ? Number(service.volume).toFixed(3) : "0.000";
          svc.chargeable_volume =
            service.chargeable_volume != null
              ? Number(service.chargeable_volume).toFixed(3)
              : "0.000";
          if (
            service.dimension_data &&
            Array.isArray(service.dimension_data) &&
            service.dimension_data.length > 0
          ) {
            svc.dimension_details = service.dimension_data.map((d: any) => ({
              pieces: Number(d.pieces) || 0,
              length: Number(d.length) || 0,
              width: Number(d.width) || 0,
              height: Number(d.height) || 0,
              value: Number(d.value) || 0,
              volume_weight: d.volume_weight != null ? Math.round(Number(d.volume_weight) * 1000) / 1000 : 0,
              dimension_unit: d.dimension_unit || "",
              ...(d.id != null && { id: d.id }),
            }));
          }
        }
        return svc;
      };

      // Transform the payload: same shape as edit (getEnquiryPayload + editData) with status INACTIVE
      const payload: any = {
        id: enquiryData.id,
        customer_code:
          enquiryData.customer_code_read || enquiryData.customer_code,
        enquiry_received_date: enquiryData.enquiry_received_date,
        sales_person: enquiryData.sales_person ?? "",
        status: "INACTIVE",
        sales_coordinator: enquiryData.sales_coordinator || "",
        customer_services: enquiryData.customer_services || "",
        reference_no: enquiryData.reference_no || "",
        customer_address: enquiryData.customer_address || "",
        ...(enquiryData.call_entry_id != null && {
          call_entry: enquiryData.call_entry_id,
        }),
        ...(enquiryData.documents_list?.length > 0 && {
          documents_list: enquiryData.documents_list,
        }),
        ...(enquiryData.remark != null && enquiryData.remark !== "" && {
          remark: enquiryData.remark,
        }),
        services: (enquiryData.services || []).map(mapService),
      };

      // Use FormData (same format as enquiry update flow) instead of raw JSON
      const formData = new FormData();
      formData.append("enquiry_data", JSON.stringify(payload));

      const response = await apiCallProtected.put(
        `${URL.enquiry}${enquiryData.id}/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...API_HEADER.headers,
          },
        }
      );

      if (response) {
        ToastNotification({
          type: "success",
          message: "Enquiry cancelled successfully",
        });
        // Refetch data after cancellation
        if (filtersApplied) {
          setIsRefreshingData(true);
          const result = await refetchSummary();
          if (result.data?.length) {
            setFiltersApplied(true);
          }
          setIsRefreshingData(false);
        } else {
          setIsRefreshingData(true);
          await refetchSummary();
          setIsRefreshingData(false);
        }
      }
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while cancelling enquiry: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setCancellingEnquiryId(null);
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

  // SEPARATE PAGINATION HANDLERS FOR PREVIEW VIEW
  const handlePreviewPageChange = (newPage: number) => {
    setPreviewCurrentPage(newPage);
  };

  const handlePreviewPageSizeChange = (newPageSize: number) => {
    setPreviewPageSize(newPageSize);
    setPreviewCurrentPage(1); // Reset to first page when changing page size
  };

  // Sync refs with location.state when it changes
  useEffect(() => {
    if (location.state?.returnToDashboard !== undefined) {
      returnToDashboardRef.current = Boolean(location.state.returnToDashboard);
    }
    if (location.state?.dashboardState !== undefined) {
      dashboardStateRef.current = location.state.dashboardState;
    }
  }, [location.state?.returnToDashboard, location.state?.dashboardState]);

  // Track if we've restored from store to prevent duplicate API calls
  const hasRestoredFromStore = useRef(false);
  const hasRestoredPreviewFromStore = useRef(false);
  // When restoring from store on return from sub-page, pass this payload to the next refetch
  // so the API is hit with exact saved filters (avoids stale state/closure issues)
  const restorePayloadRef = useRef<Record<string, unknown> | null>(null);

  // Clear other keys in store on mount (keep only current LIST_KEY)
  // Do not clear store on mount so returning from sub-pages (Create New, Get Rate, Edit, Preview)
  // can restore filters from both LIST_KEY and DETAILED_LIST_KEY
  // useEffect(() => { clearStoreAllExcept(LIST_KEY); }, []);

  // Restore filters and search from store on mount and fetch data
  // Skip if refreshData is present (let refreshData effect handle it)
  useEffect(() => {
    if (hasRestoredFromStore.current) return;
    // Skip restoration if refreshData is present - let refreshData effect handle it
    if (location.state?.refreshData) return;

    const restoredState = useListFilterStore.getState().getState(LIST_KEY);

    const performRestore = async () => {
      if (!restoredState) {
        // No restored state, load default data if dates are set
        if (fromDate && toDate && !hasInitialFilters) {
          setIsRefreshingData(true);
          await refetchSummary();
          setIsRefreshingData(false);
        }
        return;
      }

      // 1️⃣ Restore filters (including dates)
      let hasFilters = false;
      const restoredFilters = restoredState.filters as FilterState;
      if (restoredFilters && Object.keys(restoredFilters).length > 0) {
        console.log("📥 Restoring filters from store:", restoredFilters);
        setFilters(restoredFilters);
        if (restoredFilters.enquiry_received_date) {
          setFromDate(restoredFilters.enquiry_received_date);
        }
        if (restoredFilters.enquiry_received_date_to) {
          setToDate(restoredFilters.enquiry_received_date_to);
        }
        const dv = restoredState.displayValues;
        if (dv) {
          setCustomerDisplayValue(dv.customer_code ?? null);
          setOriginDisplayValue(dv.origin_code ?? null);
          setDestinationDisplayValue(dv.destination_code ?? null);
        }
        // Check if any non-date filters exist
        hasFilters = Boolean(
          restoredFilters.customer_code ||
            restoredFilters.sales_person ||
            restoredFilters.origin_code ||
            restoredFilters.destination_code ||
            restoredFilters.service ||
            restoredFilters.trade ||
            restoredFilters.enquiry_id ||
            restoredFilters.reference_no ||
            (restoredFilters.status && restoredFilters.status !== "ALL") ||
            (restoredFilters.enquiry_received_date &&
              restoredFilters.enquiry_received_date_to),
        );
        console.log("📥 Filter restoration check:", {
          hasFilters,
          customer_code: restoredFilters.customer_code,
          sales_person: restoredFilters.sales_person,
          origin_code: restoredFilters.origin_code,
          destination_code: restoredFilters.destination_code,
          service: restoredFilters.service,
          trade: restoredFilters.trade,
          status: restoredFilters.status,
          enquiry_id: restoredFilters.enquiry_id,
          reference_no: restoredFilters.reference_no,
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
        console.log("📥 Restoring search from store:", restoredState.search);
        setSearchQuery(restoredState.search);
        hasSearch = true;
      }

      // 3️⃣ Build payload from store so refetch uses exact saved filters
      const payload: Record<string, unknown> = {};
      if (restoredFilters?.enquiry_received_date && restoredFilters?.enquiry_received_date_to) {
        payload.enquiry_received_date_from = dayjs(restoredFilters.enquiry_received_date).format("YYYY-MM-DD");
        payload.enquiry_received_date_to = dayjs(restoredFilters.enquiry_received_date_to).format("YYYY-MM-DD");
      }
      if (restoredFilters?.customer_code) payload.customer_code = restoredFilters.customer_code;
      if (restoredFilters?.sales_person) payload.sales_person = restoredFilters.sales_person;
      if (restoredFilters?.origin_code) payload.origin_code = restoredFilters.origin_code;
      if (restoredFilters?.destination_code) payload.destination_code = restoredFilters.destination_code;
      if (restoredFilters?.service) payload.service = restoredFilters.service;
      if (restoredFilters?.trade) payload.trade = restoredFilters.trade;
      if (restoredFilters?.enquiry_id) payload.enquiry_id = restoredFilters.enquiry_id;
      if (restoredFilters?.reference_no) payload.reference_no = restoredFilters.reference_no;
      if (restoredFilters?.status && restoredFilters.status !== "ALL") {
        payload.status = restoredFilters.status;
      } else {
        payload.status = "";
      }
      const searchStr = (restoredState.search ?? "").trim();
      if (searchStr) payload.search = searchStr;
      restorePayloadRef.current = Object.keys(payload).length > 0 ? payload : null;

      // Wait for state updates to flush
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 4️⃣ Fetch data based on restored state
      if (hasFilters || hasSearch) {
        setIsRefreshingData(true);
        setFiltersApplied(true);
        const result = await refetchSummary();
        if (result.data && Array.isArray(result.data)) {
          // Data will be set via React Query
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        setIsRefreshingData(false);
      } else if (fromDate && toDate) {
        // No filters/search but dates exist - load default data
        setIsRefreshingData(true);
        await refetchSummary();
        setIsRefreshingData(false);
      }
    };

    if (restoredState?.shouldRestore) {
      performRestore();
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.refreshData]);

  // Handle initial filters from navigation
  useEffect(() => {
    if (location.state?.initialFilters && !initialFiltersProcessed.current) {
      initialFiltersProcessed.current = true;
      isMountedRef.current = true; // Mark as mounted to prevent default data load

      // Persist returnToDashboard and dashboardState in refs
      if (location.state?.returnToDashboard !== undefined) {
        returnToDashboardRef.current = Boolean(
          location.state.returnToDashboard,
        );
      }
      if (location.state?.dashboardState !== undefined) {
        dashboardStateRef.current = location.state.dashboardState;
      }

      const initialFilters = location.state.initialFilters;

      // Parse date filters if provided
      // Dates come in YYYY-MM-DD format from dashboard
      let enquiryReceivedDateFrom: Date | null = null;
      let enquiryReceivedDateTo: Date | null = null;

      if (initialFilters.enquiry_received_date_from) {
        const parsedFrom = dayjs(
          initialFilters.enquiry_received_date_from,
          "YYYY-MM-DD",
          true,
        );
        if (parsedFrom.isValid()) {
          enquiryReceivedDateFrom = parsedFrom.toDate();
        } else {
          console.error(
            "Invalid from date:",
            initialFilters.enquiry_received_date_from,
          );
        }
      }

      if (initialFilters.enquiry_received_date_to) {
        const parsedTo = dayjs(
          initialFilters.enquiry_received_date_to,
          "YYYY-MM-DD",
          true,
        );
        if (parsedTo.isValid()) {
          enquiryReceivedDateTo = parsedTo.toDate();
        } else {
          console.error(
            "Invalid to date:",
            initialFilters.enquiry_received_date_to,
          );
        }
      }

      // Only set dates if both are valid (buildFilterPayload requires both)
      // If one is invalid, log error but don't set dates to avoid partial date filtering
      if (enquiryReceivedDateFrom && enquiryReceivedDateTo) {
        setFromDate(enquiryReceivedDateFrom);
        setToDate(enquiryReceivedDateTo);
        console.log("Date filters set:", {
          from: enquiryReceivedDateFrom,
          to: enquiryReceivedDateTo,
        });
      } else {
        console.warn("Date filters not set - one or both dates are invalid:", {
          from: initialFilters.enquiry_received_date_from,
          to: initialFilters.enquiry_received_date_to,
          parsedFrom: enquiryReceivedDateFrom,
          parsedTo: enquiryReceivedDateTo,
        });
      }

      // Update filter state with initial values
      setFilters({
        customer_code: initialFilters.customer_code || null,
        sales_person: initialFilters.sales_person || null,
        origin_code: null,
        destination_code: null,
        enquiry_received_date: enquiryReceivedDateFrom,
        enquiry_received_date_to: enquiryReceivedDateTo,
        service: null,
        trade: null,
        status: initialFilters.status || "ACTIVE",
        enquiry_id: null,
        reference_no: null,
      });
      setIsRefreshingData(true);

      // Clear only initialFilters but preserve dashboard return state
      // Update refs before navigation to ensure they persist
      if (location.state?.returnToDashboard !== undefined) {
        returnToDashboardRef.current = Boolean(
          location.state.returnToDashboard,
        );
      }
      if (location.state?.dashboardState !== undefined) {
        dashboardStateRef.current = location.state.dashboardState;
      }

      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
        },
      });

      setShowFilters(false);

      // Save filters to store
      setStoreFilters(LIST_KEY, {
        customer_code: initialFilters.customer_code || null,
        sales_person: initialFilters.sales_person || null,
        origin_code: null,
        destination_code: null,
        enquiry_received_date: enquiryReceivedDateFrom,
        enquiry_received_date_to: enquiryReceivedDateTo,
        service: null,
        trade: null,
        status: initialFilters.status || "ACTIVE",
        enquiry_id: null,
        reference_no: null,
      });

      // Call API after a small delay to ensure state is updated
      setTimeout(async () => {
        const result = await refetchSummary();
        if (result.data?.length) {
          setFiltersApplied(true);
        }
        setIsRefreshingData(false);
      }, 50);
    } else if (
      !isMountedRef.current &&
      !location.state?.refreshData &&
      !initialFiltersProcessed.current &&
      !hasRestoredFromStore.current
    ) {
      // Initial mount - load default data only if not navigating with refreshData flag
      // and if we haven't processed initial filters
      isMountedRef.current = true;

      // Load default data with dates
      if (fromDate && toDate) {
        setIsRefreshingData(true);
        refetchSummary().finally(() => setIsRefreshingData(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname, refetchSummary]);

  // Add effect to refresh data when returning from create/edit operations
  useEffect(() => {
    // Only handle refreshData flag - filters/search are now managed via store
    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation");

      // Mark that we're handling refreshData so restoration effect doesn't interfere
      if (!hasRestoredFromStore.current) {
        hasRestoredFromStore.current = true;
      }

      setIsRefreshingData(true);

      // Clear the refresh flag but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
        },
      });

      // Refresh data based on current state (filters/search from store)
      const refreshData = async () => {
        try {
          if (showPreviewTable) {
            const restoredPreviewState = useListFilterStore
              .getState()
              .getState(DETAILED_LIST_KEY);

            if (restoredPreviewState) {
              console.log(
                "🔄 [refreshData - Detailed] Restoring filters/search from store:",
                {
                  filters: restoredPreviewState.filters,
                  search: restoredPreviewState.search,
                },
              );

              const restoredPreviewFilters =
                (restoredPreviewState.filters || {}) as PreviewFilterState;
              setPreviewFilters(restoredPreviewFilters);
              setSearchQuery(restoredPreviewState.search ?? "");
              const dv = restoredPreviewState.displayValues;
              if (dv) {
                setCustomerDisplayValue(dv.customer_code ?? null);
                setOriginDisplayValue(dv.origin_code ?? null);
                setDestinationDisplayValue(dv.destination_code ?? null);
              }
              setFilters({
                customer_code: restoredPreviewFilters.customer_name || null,
                sales_person: restoredPreviewFilters.sales_person || null,
                origin_code: restoredPreviewFilters.origin_name || null,
                destination_code:
                  restoredPreviewFilters.destination_name || null,
                enquiry_received_date:
                  restoredPreviewFilters.enquiry_received_date || null,
                enquiry_received_date_to:
                  restoredPreviewFilters.enquiry_received_date_to || null,
                service: restoredPreviewFilters.service || null,
                trade: restoredPreviewFilters.trade || null,
                status: restoredPreviewFilters.status || "ACTIVE",
                enquiry_id: restoredPreviewFilters.enquiry_id || null,
                reference_no: restoredPreviewFilters.reference_no || null,
              });
              setFromDate(
                restoredPreviewFilters.enquiry_received_date || null,
              );
              setToDate(
                restoredPreviewFilters.enquiry_received_date_to || null,
              );
              setPreviewFiltersApplied(true);
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
            await new Promise((resolve) => setTimeout(resolve, 0));

            console.log("✅ [refreshData - Detailed] Fetching preview data with restored/current state");
            await refetchPreview();
            setIsRefreshingData(false);
          } else {
            // Summary view: restore from store when we have saved state (returned from sub-page)
            const restoredState = useListFilterStore
              .getState()
              .getState(LIST_KEY);

            if (restoredState) {
              console.log("🔄 [refreshData] Restoring filters/search from store:", {
                filters: restoredState.filters,
                search: restoredState.search,
              });

              const restoredFilters = (restoredState.filters || {}) as FilterState;
              setFilters(restoredFilters);
              if (restoredFilters.enquiry_received_date != null) {
                setFromDate(restoredFilters.enquiry_received_date);
              }
              if (restoredFilters.enquiry_received_date_to != null) {
                setToDate(restoredFilters.enquiry_received_date_to);
              }
              setSearchQuery(restoredState.search ?? "");
              setFiltersApplied(true);
              // Restore display labels so SearchableSelects show label (e.g. "Chennai (INMAA)") not code
              const dv = restoredState.displayValues;
              if (dv) {
                setCustomerDisplayValue(dv.customer_code ?? null);
                setOriginDisplayValue(dv.origin_code ?? null);
                setDestinationDisplayValue(dv.destination_code ?? null);
              }

              // Build payload from stored state so the next refetch uses exact saved filters
              const payload: Record<string, unknown> = {};
              if (restoredFilters.enquiry_received_date && restoredFilters.enquiry_received_date_to) {
                payload.enquiry_received_date_from = dayjs(restoredFilters.enquiry_received_date).format("YYYY-MM-DD");
                payload.enquiry_received_date_to = dayjs(restoredFilters.enquiry_received_date_to).format("YYYY-MM-DD");
              }
              if (restoredFilters.customer_code) payload.customer_code = restoredFilters.customer_code;
              if (restoredFilters.sales_person) payload.sales_person = restoredFilters.sales_person;
              if (restoredFilters.origin_code) payload.origin_code = restoredFilters.origin_code;
              if (restoredFilters.destination_code) payload.destination_code = restoredFilters.destination_code;
              if (restoredFilters.service) payload.service = restoredFilters.service;
              if (restoredFilters.trade) payload.trade = restoredFilters.trade;
              if (restoredFilters.enquiry_id) payload.enquiry_id = restoredFilters.enquiry_id;
              if (restoredFilters.reference_no) payload.reference_no = restoredFilters.reference_no;
              if (restoredFilters.status && restoredFilters.status !== "ALL") {
                payload.status = restoredFilters.status;
              } else {
                payload.status = "";
              }
              const searchStr = (restoredState.search ?? "").trim();
              if (searchStr) payload.search = searchStr;
              restorePayloadRef.current = payload;
            }

            // Wait for state updates to flush, then refetch (queryFn will use restorePayloadRef if set)
            await new Promise((resolve) => setTimeout(resolve, 100));
            await new Promise((resolve) => setTimeout(resolve, 0));

            console.log("✅ [refreshData] Fetching summary data with restored/current state");
            const result = await refetchSummary();
            if (result.data && Array.isArray(result.data)) {
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            setIsRefreshingData(false);
          }
        } catch (error) {
          console.error("Error refreshing data:", error);
          setIsRefreshingData(false);
        }
      };

      refreshData();
    }
  }, [
    location.state?.refreshData,
    showPreviewTable,
    previewFiltersApplied,
    filtersApplied,
    refetchPreview,
    refetchSummary,
    navigate,
    fromDate,
    toDate,
  ]);

  // Track previous search value to detect changes (for summary view)
  const prevSearchRef = useRef<string>("");
  const searchInitializedRef = useRef(false);

  // Track previous search value for preview view
  const prevPreviewSearchRef = useRef<string>("");
  const previewSearchInitializedRef = useRef(false);

  // Handle search changes - trigger API when search value changes (including when cleared)
  useEffect(() => {
    if (showPreviewTable) {
      return;
    }

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
    // Keep search in sync for both summary and detailed views
    setStoreSearch(LIST_KEY, searchQuery);
    setStoreSearch(DETAILED_LIST_KEY, searchQuery);

    // Trigger API with loading state - loader will show until API response
    setIsRefreshingData(true);

    if (debouncedSearch.trim() !== "") {
      // Search exists - trigger filtered API (search will be merged with filters in buildFilterPayload)
      refetchSummary()
        .then(() => {
          setFiltersApplied(true);
        })
        .then(() => {
          // API completed - data is set, hide loader
          setIsRefreshingData(false);
        })
        .catch((error) => {
          console.error("Error fetching filtered data:", error);
          // Hide loader even on error
          setIsRefreshingData(false);
        });
    } else {
      // Search cleared
      if (filtersApplied) {
        // Filters still applied - refetch with filters only (no search)
        refetchSummary()
          .then(() => {
            setFiltersApplied(true);
          })
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch((error) => {
            console.error("Error fetching filtered data:", error);
            setIsRefreshingData(false);
          });
      } else if (fromDate && toDate) {
        // No search, no filters - use default query
        refetchSummary()
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch((error) => {
            console.error("Error fetching enquiry data:", error);
            setIsRefreshingData(false);
          });
      } else {
        // No search, no filters, no dates - no API call needed
        setIsRefreshingData(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, showPreviewTable]);

  // Handle search changes for preview view - trigger API when search value changes (including when cleared)
  useEffect(() => {
    if (!showPreviewTable) {
      return;
    }

    // Skip on initial mount if search hasn't changed
    if (!previewSearchInitializedRef.current) {
      previewSearchInitializedRef.current = true;
      prevPreviewSearchRef.current = debouncedSearch;
      return;
    }

    // Only trigger API if search actually changed (debounced)
    if (prevPreviewSearchRef.current === debouncedSearch) {
      return;
    }

    // Update ref for next comparison
    prevPreviewSearchRef.current = debouncedSearch;

    // Save search to store immediately (use current searchQuery, not debouncedSearch)
    // Keep search in sync for both summary and detailed views
    setStoreSearch(DETAILED_LIST_KEY, searchQuery);
    setStoreSearch(LIST_KEY, searchQuery);

    // Trigger API with loading state - loader will show until API response
    setIsRefreshingData(true);

    if (debouncedSearch.trim() !== "") {
      // Search exists - refetch preview with search merged into payload
      refetchPreview()
        .then(() => {
          setPreviewFiltersApplied(true);
          setIsRefreshingData(false);
        })
        .catch((error) => {
          console.error("Error fetching preview data with search:", error);
          setIsRefreshingData(false);
        });
    } else {
      // Search cleared - refetch based on filter state
      if (previewFiltersApplied) {
        // Filters still applied - refetch with filters only (no search)
        refetchPreview()
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch((error) => {
            console.error("Error fetching filtered preview data:", error);
            setIsRefreshingData(false);
          });
      } else {
        // No search, no filters - refetch default preview data
        refetchPreview()
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch((error) => {
            console.error("Error fetching initial preview data:", error);
            setIsRefreshingData(false);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, showPreviewTable, previewFiltersApplied]);

  // Restore preview filters and search from store when detailed view is opened
  useEffect(() => {
    if (!showPreviewTable) {
      // Reset restoration flag when switching back to summary view
      hasRestoredPreviewFromStore.current = false;
      return;
    }

    // Skip if already restored or if refreshData is present (let refreshData effect handle it)
    if (hasRestoredPreviewFromStore.current || location.state?.refreshData) {
      return;
    }

    const restoredState = useListFilterStore
      .getState()
      .getState(DETAILED_LIST_KEY);

    const performPreviewRestore = async () => {
      if (!restoredState) {
        // No restored state, set default dates and load initial data
        setPreviewFilters((prev) => ({
          ...prev,
          enquiry_received_date: getDefaultFromDate(),
          enquiry_received_date_to: getDefaultToDate(),
        }));
        return;
      }

      // 1️⃣ Restore preview filters
      let hasPreviewFilters = false;
      const restoredPreviewFilters =
        restoredState.filters as PreviewFilterState;
      if (
        restoredPreviewFilters &&
        Object.keys(restoredPreviewFilters).length > 0
      ) {
        console.log(
          "📥 [Detailed View] Restoring filters from store:",
          restoredPreviewFilters,
        );
        setPreviewFilters(restoredPreviewFilters);

        // Keep shared summary filters + dates in sync so the single filter section reflects them
        setFilters({
          customer_code: restoredPreviewFilters.customer_name || null,
          sales_person: restoredPreviewFilters.sales_person || null,
          origin_code: restoredPreviewFilters.origin_name || null,
          destination_code: restoredPreviewFilters.destination_name || null,
          enquiry_received_date:
            restoredPreviewFilters.enquiry_received_date || null,
          enquiry_received_date_to:
            restoredPreviewFilters.enquiry_received_date_to || null,
          service: restoredPreviewFilters.service || null,
          trade: restoredPreviewFilters.trade || null,
          status: restoredPreviewFilters.status || "ACTIVE",
          enquiry_id: restoredPreviewFilters.enquiry_id || null,
          reference_no: restoredPreviewFilters.reference_no || null,
        });
        setFromDate(restoredPreviewFilters.enquiry_received_date || null);
        setToDate(restoredPreviewFilters.enquiry_received_date_to || null);
        const dv = restoredState.displayValues;
        if (dv) {
          setCustomerDisplayValue(dv.customer_code ?? null);
          setOriginDisplayValue(dv.origin_code ?? null);
          setDestinationDisplayValue(dv.destination_code ?? null);
        }

        // Check if any filters exist
        hasPreviewFilters = Boolean(
          restoredPreviewFilters.customer_name ||
            restoredPreviewFilters.sales_person ||
            restoredPreviewFilters.origin_name ||
            restoredPreviewFilters.destination_name ||
            restoredPreviewFilters.service ||
            restoredPreviewFilters.trade ||
            restoredPreviewFilters.terms_of_shipment ||
            (restoredPreviewFilters.status &&
              restoredPreviewFilters.status !== "ALL") ||
            restoredPreviewFilters.enquiry_id ||
            restoredPreviewFilters.reference_no ||
            (restoredPreviewFilters.enquiry_received_date &&
              restoredPreviewFilters.enquiry_received_date_to),
        );
      }

      // 2️⃣ Restore search
      let hasPreviewSearch = false;
      if (
        typeof restoredState.search === "string" &&
        restoredState.search.trim()
      ) {
        console.log(
          "📥 [Detailed View] Restoring search from store:",
          restoredState.search,
        );
        setSearchQuery(restoredState.search);
        hasPreviewSearch = true;
      }

      // Wait for state updates to flush, then defer refetch so queryFn sees restored state
      await new Promise((resolve) => setTimeout(resolve, 150));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 3️⃣ Fetch data based on restored state
      setIsRefreshingData(true);
      if (hasPreviewFilters || hasPreviewSearch) {
        setPreviewFiltersApplied(true);
      }
      await refetchPreview();
      setIsRefreshingData(false);
    };
    if (restoredState?.shouldRestore) {
      performPreviewRestore();
      useListFilterStore.getState().setShouldRestore(DETAILED_LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreviewTable, location.state?.refreshData]);

  // Track if pagination has been initialized (to prevent initial mount trigger)
  const paginationInitialized = useRef(false);

  // Handle pagination changes - ONLY trigger API if filters are applied or search exists
  // API should NOT be called on pagination changes if no filters/search are active
  useEffect(() => {
    if (showPreviewTable) {
      return;
    }

    // Skip on initial mount (initial load is handled separately)
    if (!paginationInitialized.current) {
      paginationInitialized.current = true;
      return;
    }

    // ONLY trigger API if filters are applied or search exists
    // This ensures API is only called when user changes page/size with active filters/search
    if (filtersApplied || debouncedSearch.trim() !== "") {
      setIsRefreshingData(true);
      refetchSummary()
        .then(() => {
          setFiltersApplied(true);
        })
        .then(() => setIsRefreshingData(false));
    } else if (fromDate && toDate) {
      // No filters, no search, but dates exist - use default query for pagination
      setIsRefreshingData(true);
      refetchSummary().finally(() => setIsRefreshingData(false));
    }
    // If no filters, no search, no dates - don't call API (no data to paginate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCurrentPage, listPageSize, showPreviewTable]);

  // Track if preview pagination has been initialized (to prevent initial mount trigger)
  const previewPaginationInitialized = useRef(false);

  // useEffect(() => {
  //   if (showPreviewTable) {
  //     return;
  //   }

  //   if (filtersApplied) {
  //     const shouldRefresh = filteredEnquiryLoading;
  //     if (shouldRefresh !== isRefreshingData) {
  //       setIsRefreshingData(shouldRefresh);
  //     }
  //   } else if (!isRestoringFilters && !filtersApplied) {
  //     if (!enquiryLoading && isRefreshingData) {
  //       setIsRefreshingData(false);
  //     }
  //   }
  // }, [
  //   showPreviewTable,
  //   filtersApplied,
  //   filteredEnquiryLoading,
  //   enquiryLoading,
  //   isRestoringFilters,
  //   isRefreshingData,
  // ]);

  // Handle preview pagination changes - refetch data when page or page size changes,
  // but only after the first load for the current detailed-view session.
  useEffect(() => {
    if (!showPreviewTable) {
      return;
    }

    if (!previewPaginationInitialized.current) {
      previewPaginationInitialized.current = true;
      return;
    }

    setIsRefreshingData(true);
    refetchPreview()
      .then(() => {
        setIsRefreshingData(false);
      })
      .catch((error) => {
        console.error(
          "Error fetching preview data on pagination change:",
          error,
        );
        setIsRefreshingData(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewCurrentPage, previewPageSize, showPreviewTable]);

  const columns = useMemo<MRT_ColumnDef<any>[]>(
    () => [
      {
        id: "sno",
        accessorKey: "sno",
        header: "S.No",
        size: 70,
      },
      {
        id: "enquiry_id",
        accessorKey: "enquiry_id",
        header: "Enquiry ID",
      },
      {
        id: "customer_name",
        accessorKey: "customer_name",
        header: "Customer",
      },
      {
        id: "sales_person",
        accessorKey: "sales_person",
        header: "Sales Person",
      },
      {
        id: "service_list",
        accessorKey: "services",
        header: "Service",
        Cell: ({ cell }) => {
          const services = cell.getValue<any[]>();
          if (!services || !Array.isArray(services) || services.length === 0) {
            return "-";
          }
          const serviceTradePairs = services
            .map((s) => {
              const service = s.service || "";
              const trade = s.trade || "";
              if (!service && !trade) return null;
              if (!service) return trade;
              if (!trade) return service;
              return `${service} - ${trade}`;
            })
            .filter((pair) => pair !== null);
          const uniquePairs = [...new Set(serviceTradePairs)];
          return (
            <div style={{ lineHeight: "1.4" }}>
              {uniquePairs.length > 0 ? (
                uniquePairs.map((pair, index) => <div key={index}>{pair}</div>)
              ) : (
                <div>-</div>
              )}
            </div>
          );
        },
      },
      {
        id: "origin_list",
        accessorKey: "origin_list",
        header: "Origin",
        Cell: ({ cell }) => {
          const originList = cell.getValue<string[]>();
          if (
            !originList ||
            !Array.isArray(originList) ||
            originList.length === 0
          ) {
            return "-";
          }
          return (
            <div style={{ lineHeight: "1.4" }}>
              {originList.map((origin, index) => (
                <div key={index}>{origin}</div>
              ))}
            </div>
          );
        },
      },
      {
        id: "destination_list",
        accessorKey: "destination_list",
        header: "Destination",
        Cell: ({ cell }) => {
          const destinationList = cell.getValue<string[]>();
          if (
            !destinationList ||
            !Array.isArray(destinationList) ||
            destinationList.length === 0
          ) {
            return "-";
          }
          return (
            <div style={{ lineHeight: "1.4" }}>
              {destinationList.map((destination, index) => (
                <div key={index}>{destination}</div>
              ))}
            </div>
          );
        },
      },
      {
        id: "reference_no",
        accessorKey: "reference_no",
        header: "Reference No",
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value || "-";
        },
      },
      {
        id: "enquiry_received_date",
        accessorKey: "enquiry_received_date",
        header: "Enquiry Date",
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        size: 180,
        minSize: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          const { label, color } = getStatusBadge(value ?? undefined);
          return (
            <Badge
              size="sm"
              variant="light"
              color={color}
              styles={{
                root: {
                  textTransform: "none",
                  minWidth: "fit-content",
                  whiteSpace: "nowrap",
                },
              }}
            >
              {label}
            </Badge>
          );
        },
      },
      {
        id: "remark_list",
        accessorKey: "services",
        header: "Remark",
        Cell: ({ cell }) => {
          const services = cell.getValue<any[]>();
          if (!services || !Array.isArray(services) || services.length === 0) {
            return "-";
          }
          const remarkList = services
            .map((s) => s.service_remark)
            .filter((r) => r);
          const uniqueRemarks = [...new Set(remarkList)];
          return (
            <div style={{ lineHeight: "1.4" }}>
              {uniqueRemarks.length > 0 ? (
                uniqueRemarks.map((remark, index) => (
                  <div key={index}>{remark}</div>
                ))
              ) : (
                <div>-</div>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        Cell: ({ row }) => {
          const [menuOpened, setMenuOpened] = useState(false);
          return (
            <Menu
              withinPortal
              position="bottom-end"
              shadow="sm"
              radius={"md"}
              opened={menuOpened}
              onChange={setMenuOpened}
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
                      setMenuOpened(false);
                      saveFiltersToStore();
                      if (showPreviewTable) savePreviewFiltersToStore();
                      const currentFilterState = {
                        filters,
                        filtersApplied,
                        fromDate,
                        toDate,
                        displayValues: {
                          customer_code: customerDisplayValue,
                          origin_code: originDisplayValue,
                          destination_code: destinationDisplayValue,
                        },
                      };
                      if (showPreviewTable) {
                        useListFilterStore
                          .getState()
                          .setShouldRestore(DETAILED_LIST_KEY, true);
                      } else {
                        useListFilterStore
                          .getState()
                          .setShouldRestore(LIST_KEY, true);
                      }
                      navigate("/enquiry-create", {
                        state: {
                          ...row.original,
                          preserveFilters: currentFilterState,
                          fromEnquiry: true, // Flag to indicate navigation from enquiry page
                        },
                      });
                    }}
                    style={{
                      opacity: ["GAINED", "LOST", "QUOTE CREATED"].includes(
                        (row.original.status || "").toUpperCase(),
                      )
                        ? 0.5
                        : 1,
                      cursor: ["GAINED", "LOST", "QUOTE CREATED"].includes(
                        (row.original.status || "").toUpperCase(),
                      )
                        ? "not-allowed"
                        : "pointer",
                    }}
                    disabled={["GAINED", "LOST", "QUOTE CREATED"].includes(
                      (row.original.status || "").toUpperCase(),
                    )}
                  >
                    <Group gap={"sm"}>
                      <IconEye size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Create Quotation</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                {/* Edit Quotation - Only show for gained, lost, quote created */}
                {["GAINED", "LOST", "QUOTE CREATED"].includes(
                  (row.original.status || "").toUpperCase(),
                ) && (
                  <>
                    <Box px={10} py={5}>
                      <UnstyledButton
                        onClick={async () => {
                          try {
                            setMenuOpened(false);
                            // Fetch quotation data by enquiry_id
                            const filterPayload = {
                              filters: { enquiry_id: row.original.enquiry_id },
                            };
                            const response = await apiCallProtected.post(
                              `${URL.quotationFilter}`,
                              filterPayload,
                            );
                            const data = response as any;
                            if (
                              data &&
                              Array.isArray(data.data) &&
                              data.data.length > 0
                            ) {
                              const quotationData = data.data[0];
                              saveFiltersToStore();
                              if (showPreviewTable) savePreviewFiltersToStore();
                              const currentFilterState = {
                                filters,
                                filtersApplied,
                                fromDate,
                                toDate,
                                displayValues: {
                                  customer_code: customerDisplayValue,
                                  origin_code: originDisplayValue,
                                  destination_code: destinationDisplayValue,
                                },
                              };
                              if (showPreviewTable) {
                                useListFilterStore
                                  .getState()
                                  .setShouldRestore(DETAILED_LIST_KEY, true);
                              } else {
                                useListFilterStore
                                  .getState()
                                  .setShouldRestore(LIST_KEY, true);
                              }
                              // Navigate to quotation-create in edit mode
                              navigate("/quotation-create", {
                                state: {
                                  ...quotationData,
                                  actionType: "edit",
                                  preserveFilters: currentFilterState,
                                  fromEnquiry: true, // Flag to indicate navigation from enquiry page
                                },
                              });
                            } else {
                              ToastNotification({
                                type: "warning",
                                message: "No quotation found for this enquiry",
                              });
                            }
                          } catch (error: any) {
                            ToastNotification({
                              type: "error",
                              message: `Error fetching quotation: ${error?.message || "Unknown error"}`,
                            });
                          }
                        }}
                      >
                        <Group gap={"sm"}>
                          <IconEdit size={16} style={{ color: "#105476" }} />
                          <Text size="sm">Edit Quotation</Text>
                        </Group>
                      </UnstyledButton>
                    </Box>
                    <Menu.Divider />
                  </>
                )}
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      saveFiltersToStore();
                      if (showPreviewTable) savePreviewFiltersToStore();
                      const currentFilterState = {
                        filters,
                        filtersApplied,
                        fromDate,
                        toDate,
                        displayValues: {
                          customer_code: customerDisplayValue,
                          origin_code: originDisplayValue,
                          destination_code: destinationDisplayValue,
                        },
                      };
                      if (showPreviewTable) {
                        useListFilterStore
                          .getState()
                          .setShouldRestore(DETAILED_LIST_KEY, true);
                      } else {
                        useListFilterStore
                          .getState()
                          .setShouldRestore(LIST_KEY, true);
                      }
                      navigate("/get-rate", {
                        state: {
                          ...row.original,
                          preserveFilters: currentFilterState,
                          fromEnquiry: true,
                        },
                      });
                    }}
                  >
                    <Group gap={"sm"}>
                      <IconTag size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Get Rate</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                {/* Hide Edit Enquiry option if opened from Dashboard */}
                {!location.state?.returnToDashboard &&
                  !returnToDashboardRef.current && (
                    <>
                      <Box px={10} py={5}>
                        <UnstyledButton
                          onClick={() => {
                            setMenuOpened(false);
                            saveFiltersToStore();
                            if (showPreviewTable) savePreviewFiltersToStore();
                            const currentFilterState = {
                              filters,
                              filtersApplied,
                              fromDate,
                              toDate,
                              displayValues: {
                                customer_code: customerDisplayValue,
                                origin_code: originDisplayValue,
                                destination_code: destinationDisplayValue,
                              },
                            };
                            if (showPreviewTable) {
                              useListFilterStore
                                .getState()
                                .setShouldRestore(DETAILED_LIST_KEY, true);
                            } else {
                              useListFilterStore
                                .getState()
                                .setShouldRestore(LIST_KEY, true);
                            }
                            navigate("/enquiry-create", {
                              state: {
                                ...row.original,
                                actionType: "edit",
                                preserveFilters: currentFilterState,
                                fromEnquiry: true, // Flag to indicate navigation from enquiry page
                              },
                            });
                          }}
                        >
                          <Group gap={"sm"}>
                            <IconEdit size={16} style={{ color: "#105476" }} />
                            <Text size="sm">Edit Enquiry</Text>
                          </Group>
                        </UnstyledButton>
                      </Box>
                      <Menu.Divider />
                    </>
                  )}
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      showEnquiryPreview(row.original);
                    }}
                  >
                    <Group gap={"sm"}>
                      <IconEye size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Preview</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      handleCancelEnquiry(row.original);
                    }}
                    disabled={cancellingEnquiryId === (row.original as { id?: number })?.id}
                  >
                    <Group gap={"sm"}>
                      {cancellingEnquiryId === (row.original as { id?: number })?.id ? (
                        <Loader size={16} color="red" />
                      ) : (
                        <IconX size={16} style={{ color: "red" }} />
                      )}
                      <Text size="sm" c="red">
                        {cancellingEnquiryId === (row.original as { id?: number })?.id ? "Cancelling..." : "Cancel"}
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [
      navigate,
      handleCancelEnquiry,
      cancellingEnquiryId,
      filters,
      filtersApplied,
      fromDate,
      toDate,
      showEnquiryPreview,
      customerDisplayValue,
      originDisplayValue,
      destinationDisplayValue,
    ],
  );

  const table = useMantineReactTable({
    columns,
    data: tableData,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    // Use table's built-in loading state - shows loader while keeping previous rows visible
    // tableLoading is the single source of truth for loader state
    // state: {
    //   isLoading: tableLoading,
    //   showProgressBars: tableLoading,
    // },
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
        case "enquiry_id":
          extraStyles = {
            minWidth: "218px",
          };
          break;
        case "customer_name":
          extraStyles = {
            minWidth: "218px",
          };
          break;
        case "sales_person":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "service_list":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "trade_list":
          extraStyles = {
            minWidth: "100px",
          };
          break;
        case "origin_list":
          extraStyles = {
            minWidth: "145px",
          };
          break;
        case "destination_list":
          extraStyles = {
            minWidth: "181px",
          };
          break;
        case "reference_no":
          extraStyles = {
            minWidth: "125px",
          };
          break;
        case "enquiry_received_date":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "remark_list":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "status":
          extraStyles = {
            minWidth: "120px",
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
      let extraStyles = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "80px",
            zIndex: 2,
            backgroundColor: "#FBFBFB",
            // borderLeft: "2px solid red",
            boxShadow: "0px -2px 4px 0px #00000040",
          };
          break;
        case "enquiry_id":
          extraStyles = {
            minWidth: "218px",
          };
          break;
        case "customer_name":
          extraStyles = {
            minWidth: "218px",
          };
          break;
        case "sales_person":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "service_list":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "trade_list":
          extraStyles = {
            minWidth: "100px",
          };
          break;
        case "remark_list":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "origin_list":
          extraStyles = {
            minWidth: "145px",
          };
          break;
        case "destination_list":
          extraStyles = {
            minWidth: "181px",
          };
          break;
        case "reference_no":
          extraStyles = {
            minWidth: "125px",
          };
          break;
        case "enquiry_received_date":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "status":
          extraStyles = {
            minWidth: "120px",
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
          // height: "38px",
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
          {/* Breadcrumbs */}
          {/* <Breadcrumbs mb={8}>
            <Text
              size="sm"
              style={{
                fontFamily: "Inter",
                fontStyle: "regular",
                color: "#000000",
              }}
            >
              Enquiry
            </Text>
            <Anchor href="#" size="sm" c="dimmed">
              <Text
                size="sm"
                style={{
                  color: "#105476",
                  fontFamily: "Inter",
                  fontStyle: "regular",
                  marginRight: "4px",
                }}
              >
                Core
              </Text>
            </Anchor>
            <Anchor
              href="#"
              size="sm"
              c="dimmed"
              style={{
                color: "#105476",
                fontFamily: "Inter",
                fontStyle: "regular",
                marginRight: "4px",
              }}
            >
              <Text
                size="sm"
                style={{
                  color: "#105476",
                  fontFamily: "Inter",
                  fontStyle: "regular",
                  marginRight: "4px",
                }}
              >
                Sale
              </Text>
            </Anchor>
            <Text
              size="sm"
              c="dimmed"
              style={{
                fontFamily: "Inter",
                fontStyle: "regular",
                marginRight: "4px",
              }}
            >
              Enquiry
            </Text>
          </Breadcrumbs> */}

          {/* Tabs and Actions */}
          <Group justify="space-between" align="center" mb="md">
            <Tabs
              value={showPreviewTable ? "detailed" : "summary"}
              onChange={(value) => {
                if (value === "detailed" && !showPreviewTable) {
                  openPreview();
                } else if (value === "summary" && showPreviewTable) {
                  closePreview();
                }
              }}
              styles={{
                tab: {
                  padding: "8px 8px",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontstyle: "semibold",
                  color: "#444955",
                  "&[data-active]": {
                    color: "#105476",
                    borderBottom: "0px",
                    backgroundColor: "#E0F5FF",
                  },
                  "&:hover": {
                    backgroundColor: "#f8f9fa",
                    borderBottom: "0px",
                    color: "#444955",
                    // borderColor: "transparent",
                  },
                  "&[data-active]:hover": {
                    backgroundColor: "#E0F5FF",
                    borderBottom: "0px",
                    color: "#105476",
                  },
                },
                list: {
                  borderBottom: "0px",
                },
              }}
            >
              <Tabs.List
                style={{
                  border: "1px solid #E0E0E0",
                  borderRadius: "6px",
                  borderBottom: "0px",
                }}
              >
                <Tabs.Tab value="summary" style={{ borderBottom: "0px" }}>
                  Summary
                </Tabs.Tab>
                <Tabs.Tab value="detailed" style={{ borderBottom: "0px" }}>
                  Detailed
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

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
                        // Clear search - this will trigger the search change useEffect
                        // which will update store and trigger API
                        setSearchQuery("");
                        // Clear search from store immediately (use correct LIST_KEY based on view)
                        const currentListKey = showPreviewTable
                          ? DETAILED_LIST_KEY
                          : LIST_KEY;
                        clearStoreSearch(currentListKey);
                        // Reset search ref to current debouncedSearch value
                        // This ensures the useEffect will detect the change when debouncedSearch becomes ""
                        if (showPreviewTable) {
                          prevPreviewSearchRef.current = debouncedSearch;
                        } else {
                          prevSearchRef.current = debouncedSearch;
                        }
                        // Check if other filters exist to determine filtersApplied state
                        if (showPreviewTable) {
                          // For preview view, check preview filters
                          const hasOtherPreviewFilters =
                            previewFilters.customer_name ||
                            previewFilters.sales_person ||
                            previewFilters.origin_name ||
                            previewFilters.destination_name ||
                            previewFilters.service ||
                            previewFilters.trade ||
                            previewFilters.terms_of_shipment ||
                            (previewFilters.status &&
                              previewFilters.status !== "ALL") ||
                            previewFilters.enquiry_id ||
                            previewFilters.reference_no ||
                            (previewFilters.enquiry_received_date &&
                              previewFilters.enquiry_received_date_to);
                          if (!hasOtherPreviewFilters) {
                            setPreviewFiltersApplied(false);
                          }
                        } else {
                          // For summary view, check summary filters
                          const hasOtherFilters =
                            filters.customer_code ||
                            filters.sales_person ||
                            filters.origin_code ||
                            filters.destination_code ||
                            filters.service ||
                            filters.trade ||
                            filters.enquiry_id ||
                            filters.reference_no ||
                            (filters.status && filters.status !== "ALL") ||
                            (fromDate && toDate);
                          if (!hasOtherFilters) {
                            setFiltersApplied(false);
                          }
                        }
                        // Note: The search change useEffect will handle API trigger after debounce
                        // and will save the empty search to store
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
                onClick={toggleFilters}
                styles={{
                  root: {
                    borderRadius: "4px",
                    backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                    border: showFilters
                      ? "1px solid #105476"
                      : "1px solid #737780",
                    color: showFilters ? "#105476" : "#737780",
                    // "&:hover": {
                    //   backgroundColor: "#105476",
                    //   color: "#FFFFFF",
                    // },
                    // "&:focus": {
                    //   border: "1px solid #105476",
                    //   color: "#FFFFFF",
                    // },
                    "&:active": {
                      border: "1px solid #105476",
                      color: "#FFFFFF",
                    },
                  },
                }}
              >
                <IconFilter size={18} />
              </ActionIcon>

              {showPreviewTable && (
                <ActionIcon
                  variant="outline"
                  size={36}
                  color="gray"
                  onClick={downloadExcel}
                  loading={downloading}
                  styles={{
                    root: {
                      borderRadius: "4px",
                      borderColor: "#737780",
                      color: "#737780",
                    },
                  }}
                >
                  <IconDownload size={18} />
                </ActionIcon>
              )}

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
                  saveFiltersToStore();
                  if (showPreviewTable) savePreviewFiltersToStore();
                  const currentFilterState = {
                    filters,
                    filtersApplied,
                    fromDate,
                    toDate,
                    displayValues: {
                      customer_code: customerDisplayValue,
                      origin_code: originDisplayValue,
                      destination_code: destinationDisplayValue,
                    },
                  };
                  if (showPreviewTable) {
                    useListFilterStore
                      .getState()
                      .setShouldRestore(DETAILED_LIST_KEY, true);
                  } else {
                    useListFilterStore
                      .getState()
                      .setShouldRestore(LIST_KEY, true);
                  }
                  navigate("/enquiry-create", {
                    state: {
                      preserveFilters: currentFilterState,
                      fromEnquiry: true,
                    },
                  });
                }}
              >
                Create New
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Filter Section - shared between Summary & Detailed views */}
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

            <>
              <Grid gutter="md" px="md">
                {/* Row 1 */}
                <Grid.Col span={2}>
                  <SearchableSelect
                    size="xs"
                    label="Customer Name"
                    placeholder="Select Service"
                    apiEndpoint={URL.customer}
                    searchFields={["customer_code", "customer_name"]}
                    displayFormat={(item: any) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={filters.customer_code}
                    displayValue={customerDisplayValue}
                    onChange={(value, selectedData) => {
                      updateFilter("customer_code", value || null);
                      setCustomerDisplayValue(selectedData?.label || null);
                      // Keep detailed-view filter state in sync when in Detailed view
                      if (showPreviewTable) {
                        updatePreviewFilter("customer_name", value || null);
                        setPreviewCustomerDisplayValue(
                          selectedData?.label || null,
                        );
                      }
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                  />
                </Grid.Col>

                <Grid.Col span={2}>
                  <SearchableSelect
                    size="xs"
                    label="Origin"
                    placeholder="Type Origin Code"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_code", "port_name"]}
                    displayFormat={(item: any) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={filters.origin_code}
                    displayValue={originDisplayValue}
                    onChange={(value, selectedData) => {
                      updateFilter("origin_code", value || null);
                      setOriginDisplayValue(selectedData?.label || null);
                      if (showPreviewTable) {
                        updatePreviewFilter("origin_name", value || null);
                        setPreviewOriginDisplayValue(
                          selectedData?.label || null,
                        );
                      }
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <SearchableSelect
                    size="xs"
                    label="Destination"
                    placeholder="Type destination code"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_code", "port_name"]}
                    displayFormat={(item: any) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={filters.destination_code}
                    displayValue={destinationDisplayValue}
                    onChange={(value, selectedData) => {
                      updateFilter("destination_code", value || null);
                      setDestinationDisplayValue(selectedData?.label || null);
                      if (showPreviewTable) {
                        updatePreviewFilter("destination_name", value || null);
                        setPreviewDestinationDisplayValue(
                          selectedData?.label || null,
                        );
                      }
                    }}
                    minSearchLength={3}
                    className="filter-searchable-select"
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <DateRangeInput
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromDateChange={(date) => {
                      setFromDate(date);
                      if (showPreviewTable) {
                        updatePreviewFilter("enquiry_received_date", date);
                      }
                    }}
                    onToDateChange={(date) => {
                      setToDate(date);
                      if (showPreviewTable) {
                        updatePreviewFilter("enquiry_received_date_to", date);
                      }
                    }}
                    fromLabel="From Date"
                    toLabel="To Date"
                    size="xs"
                    allowDeselection={true}
                    showRangeInCalendar={false}
                    inputWidth={260}
                  />
                </Grid.Col>

                {/* Row 2 */}
                <Grid.Col span={2}>
                  <Select
                    key={`sales-person-${filters.sales_person}`}
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
                    disabled={salespersonsLoading}
                    value={filters.sales_person}
                    onChange={(value) => {
                      updateFilter("sales_person", value || null);
                      if (showPreviewTable) {
                        updatePreviewFilter("sales_person", value || null);
                      }
                    }}
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
                <Grid.Col span={2}>
                  <Select
                    key={`service-${filters.service}`}
                    label="Service"
                    placeholder="Select Service"
                    searchable
                    clearable
                    size="xs"
                    data={serviceOptions}
                    value={filters.service}
                    onChange={(value) => {
                      updateFilter("service", value || null);
                      if (showPreviewTable) {
                        updatePreviewFilter("service", value || null);
                      }
                    }}
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
                <Grid.Col span={2}>
                  <Select
                    key={`trade-${filters.trade}`}
                    label="Trade"
                    placeholder="Select Service"
                    searchable
                    clearable
                    size="xs"
                    data={tradeOptions}
                    value={filters.trade}
                    onChange={(value) => {
                      updateFilter("trade", value || null);
                      if (showPreviewTable) {
                        updatePreviewFilter("trade", value || null);
                      }
                    }}
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
                <Grid.Col span={2}>
                  <Select
                    key={`status-${filters.status}`}
                    label="Status"
                    placeholder="Active"
                    searchable
                    clearable
                    size="xs"
                    data={statusOptions}
                    value={filters.status}
                    onChange={(value) => {
                      updateFilter("status", value || "all");
                      if (showPreviewTable) {
                        updatePreviewFilter("status", value || "all");
                      }
                    }}
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
                <Grid.Col span={2}>
                  <TextInput
                    label="Enquiry ID"
                    placeholder="Placeholder"
                    size="xs"
                    value={filters.enquiry_id || ""}
                    onChange={(e) => {
                      const val = e.currentTarget.value || null;
                      updateFilter("enquiry_id", val);
                      if (showPreviewTable) {
                        updatePreviewFilter("enquiry_id", val);
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
                <Grid.Col span={2}>
                  <TextInput
                    label="Reference No"
                    placeholder="Placeholder"
                    size="xs"
                    value={filters.reference_no || ""}
                    onChange={(e) => {
                      const val = e.currentTarget.value || null;
                      updateFilter("reference_no", val);
                      if (showPreviewTable) {
                        updatePreviewFilter("reference_no", val);
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
              <Group
                justify="flex-end"
                mt="lg"
                gap="sm"
                style={{ margin: "8px 8px" }}
              >
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
                  loading={tableLoading}
                  disabled={tableLoading}
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
            </>
          </Box>
        )}

        {isPreviewLoading ? (
          <Center
            p="md"
            style={{
              marginBottom: "52px",
              boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
              border: "1px solid #dee2e6",
              borderRadius: "calc(0.5rem * 1)",
              display: "flex",
              flexDirection: "column",
              height: "78%",
              maxHeight: "1536px",
              flex: 1,
            }}
          >
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">
                {isRefreshingData
                  ? "Updating enquiry list..."
                  : "Loading enquiries..."}
              </Text>
            </Stack>
          </Center>
        ) : showPreviewTable ? (
          <>
            {isPreviewLoading ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Loader size="lg" color="#105476" />
                  <Text c="dimmed">
                    {isRefreshingData
                      ? "Updating preview data..."
                      : "Loading preview data..."}
                  </Text>
                </Stack>
              </Center>
            ) : (
              <>
                <MantineReactTable table={previewTable} />

                {/* Preview Pagination - unified design */}
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
                  {/* Left side: Back to Dashboard Button or Rows per page */}
                  <Group gap="sm" align="center" wrap="nowrap" mt={10}>
                    {location.state?.returnToDashboard ||
                    returnToDashboardRef.current ? (
                      <Button
                        leftSection={<IconArrowLeft size={16} />}
                        onClick={() => {
                          const dashboardState =
                            location.state?.dashboardState ||
                            dashboardStateRef.current;
                          if (dashboardState) {
                            // Navigate back to dashboard with state to restore detailed view
                            navigate("/", {
                              state: {
                                returnToEnquiryDetailedView: true,
                                dashboardState: dashboardState,
                              },
                            });
                          } else {
                            // Fallback to regular dashboard navigation
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
                          value={String(previewPageSize)}
                          onChange={(val) => {
                            if (!val) return;
                            handlePreviewPageSizeChange(Number(val));
                          }}
                          w={110}
                          styles={
                            { input: { fontSize: 12, height: 30 } } as any
                          }
                        />
                        <Text size="sm" c="dimmed">
                          {(() => {
                            const total = tablePreviewData?.total || 0;
                            if (total === 0) return "0–0 of 0";
                            const start =
                              (previewCurrentPage - 1) * previewPageSize + 1;
                            const end = Math.min(
                              previewCurrentPage * previewPageSize,
                              total,
                            );
                            return `${start}–${end} of ${total}`;
                          })()}
                        </Text>
                      </>
                    )}
                  </Group>

                  {/* Right side: Page controls or Rows per page (if button is shown) */}
                  <Group gap="xs" align="center" wrap="nowrap" mt={10}>
                    {(location.state?.returnToDashboard ||
                      returnToDashboardRef.current) && (
                      <>
                        <Text size="sm" c="dimmed">
                          Rows per page
                        </Text>
                        <Select
                          size="xs"
                          data={["10", "25", "50"]}
                          value={String(previewPageSize)}
                          onChange={(val) => {
                            if (!val) return;
                            handlePreviewPageSizeChange(Number(val));
                          }}
                          w={110}
                          styles={
                            { input: { fontSize: 12, height: 30 } } as any
                          }
                        />
                        <Text size="sm" c="dimmed">
                          {(() => {
                            const total = tablePreviewData?.total || 0;
                            if (total === 0) return "0–0 of 0";
                            const start =
                              (previewCurrentPage - 1) * previewPageSize + 1;
                            const end = Math.min(
                              previewCurrentPage * previewPageSize,
                              total,
                            );
                            return `${start}–${end} of ${total}`;
                          })()}
                        </Text>
                      </>
                    )}
                    <ActionIcon
                      variant="default"
                      size="sm"
                      onClick={() =>
                        handlePreviewPageChange(
                          Math.max(1, previewCurrentPage - 1),
                        )
                      }
                      disabled={previewCurrentPage === 1}
                    >
                      <IconChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="sm" ta="center" style={{ width: 26 }}>
                      {previewCurrentPage}
                    </Text>
                    <Text size="sm" c="dimmed">
                      of{" "}
                      {Math.max(
                        1,
                        Math.ceil(
                          (tablePreviewData?.total || 0) / previewPageSize,
                        ),
                      )}
                    </Text>
                    <ActionIcon
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil(
                            (tablePreviewData?.total || 0) / previewPageSize,
                          ),
                        );
                        handlePreviewPageChange(
                          Math.min(totalPages, previewCurrentPage + 1),
                        );
                      }}
                      disabled={(() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil(
                            (tablePreviewData?.total || 0) / previewPageSize,
                          ),
                        );
                        return previewCurrentPage >= totalPages;
                      })()}
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </>
            )}
          </>
        ) : (
          <>
            {tableLoading ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Loader size="lg" color="#105476" />
                  <Text c="dimmed">
                    {isRefreshingData ? "Fetching data..." : "Loading data..."}
                  </Text>
                </Stack>
              </Center>
            ) : (
              <MantineReactTable table={table} />
            )}

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
                        // Navigate back to dashboard with state to restore detailed view
                        navigate("/", {
                          state: {
                            returnToEnquiryDetailedView: true,
                            dashboardState: dashboardState,
                          },
                        });
                      } else {
                        // Fallback to regular dashboard navigation
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
                      value={String(listPageSize)}
                      onChange={(val) => {
                        if (!val) return;
                        handlePageSizeChange(Number(val));
                      }}
                      w={110}
                      styles={{ input: { fontSize: 12, height: 30 } } as any}
                    />
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const total = listTotalRecords || 0;
                        if (total === 0) return "0–0 of 0";
                        const start = (listCurrentPage - 1) * listPageSize + 1;
                        const end = Math.min(
                          listCurrentPage * listPageSize,
                          total,
                        );
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
                      value={String(listPageSize)}
                      onChange={(val) => {
                        if (!val) return;
                        handlePageSizeChange(Number(val));
                      }}
                      w={110}
                      styles={{ input: { fontSize: 12, height: 30 } } as any}
                    />
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const total = listTotalRecords || 0;
                        if (total === 0) return "0–0 of 0";
                        const start = (listCurrentPage - 1) * listPageSize + 1;
                        const end = Math.min(
                          listCurrentPage * listPageSize,
                          total,
                        );
                        return `${start}–${end} of ${total}`;
                      })()}
                    </Text>
                  </>
                )}
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() =>
                    handlePageChange(Math.max(1, listCurrentPage - 1))
                  }
                  disabled={listCurrentPage === 1}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <Text size="sm" ta="center" style={{ width: 26 }}>
                  {listCurrentPage}
                </Text>
                <Text size="sm" c="dimmed">
                  of {Math.max(1, Math.ceil(listTotalRecords / listPageSize))}
                </Text>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const totalPages = Math.max(
                      1,
                      Math.ceil(listTotalRecords / listPageSize),
                    );
                    handlePageChange(Math.min(totalPages, listCurrentPage + 1));
                  }}
                  disabled={(() => {
                    const totalPages = Math.max(
                      1,
                      Math.ceil(listTotalRecords / listPageSize),
                    );
                    return listCurrentPage >= totalPages;
                  })()}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </>
        )}
      </Card>

      {/* PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title={
          <Text size="lg" fw={600} c="#105476">
            Enquiry Preview - {currentEnquiry?.enquiry_id}
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
                <Button
                  onClick={handleDownloadPDF}
                  leftSection={<IconDownload size={16} />}
                  color="#105476"
                >
                  Download PDF
                </Button>
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
    </>
  );
}

export default EnquiryMaster;
