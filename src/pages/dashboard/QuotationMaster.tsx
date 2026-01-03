import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  ToastNotification,
  SearchableSelect,
  DownloadComponent,
  DateRangeInput,
} from "../../components";
import { URL } from "../../api/serverUrls";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Badge,
  Menu,
  ActionIcon,
  Box,
  UnstyledButton,
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
  Tooltip,
  Alert,
  Collapse,
  Table,
  Textarea,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconFilterOff,
  IconSearch,
  IconDownload,
  IconX,
  IconFilter,
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
  IconArrowLeft,
  IconExternalLink,
  IconChevronDown,
  IconChevronUp,
  IconSend,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { searchAPI } from "../../service/searchApi";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../store/authStore";
import { generateNewQuotationPDF } from "./QuotationPDFTemplate";
import { postAPICall } from "../../service/postApiCall";
import { API_HEADER } from "../../store/storeKeys";
import { getAPICall } from "../../service/getApiCall";
import { putAPICall } from "../../service/putApiCall";

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
  service: string;
  cargo_type: string;
  charges: any[];
  quotation: any[];
  status?: string;
  remark?: string;
  revision?: string;
  origin_list?: string[];
  destination_list?: string[];
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
};

type QuotationMasterMode = "master" | "approval";

interface QuotationMasterProps {
  mode?: QuotationMasterMode;
}

function QuotationMaster({ mode = "master" }: QuotationMasterProps) {
  // Get first day of current month and today's date
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const getDefaultToDate = (): Date => {
    return new Date();
  };

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
  const isManagerOrAdmin = Boolean(user?.is_manager || user?.is_staff);
  const hasQuotationApprovalPermission = Boolean(
    user?.screen_permissions?.quotation_approval
  );
  const isApprovalMode = mode === "approval";
  const pageTitle = isApprovalMode
    ? "Quotation Approval List"
    : "Quotation Lists";

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
  });

  // Track if filters are applied - default true for approval mode
  const [filtersApplied, setFiltersApplied] = useState(isApprovalMode);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [showFilters, setShowFilters] = useState(false);

  // Build filter payload function
  const buildFilterPayload = () => {
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
    if (filters.valid_upto)
      payload.valid_upto = dayjs(filters.valid_upto).format("YYYY-MM-DD");
    if (filters.quote_type && filters.quote_type !== "all")
      payload.quote_type = filters.quote_type;
    if (filters.status && filters.status !== "all")
      payload.status = filters.status;
    if (filters.remark) payload.remark = filters.remark;
    if (filters.revision) payload.revision = filters.revision;

    return payload;
  };

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
    data: quotationData = [],
    isFetching: quotationFetching,
    refetch: refetchQuotations,
  } = useQuery({
    queryKey: ["quotations", fromDate, toDate],
    queryFn: async () => {
      try {
        let requestBody: { filters: any } = { filters: {} };

        // Only add date filters if both dates are selected
        if (fromDate && toDate) {
          requestBody.filters.enquiry_received_date_from =
            dayjs(fromDate).format("YYYY-MM-DD");
          requestBody.filters.enquiry_received_date_to =
            dayjs(toDate).format("YYYY-MM-DD");
        }

        const endpoint = isApprovalMode
          ? URL.quotationFilterApproval
          : URL.quotationFilter;
        const response = await apiCallProtected.post(endpoint, requestBody);
        const result = response as any;
        if (result && Array.isArray(result.data)) {
          return result.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching quotation data:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 0, // 5 minutes
    gcTime: 0, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredQuotationData = [],
    isLoading: filteredQuotationLoading,
    refetch: refetchFilteredQuotations,
  } = useQuery({
    queryKey: ["filteredQuotations"],
    queryFn: async () => {
      try {
        const filterPayload = buildFilterPayload();

        // if (Object.keys(filterPayload).length === 0) {
        //   return [];
        // }

        const requestBody = { filters: filterPayload };
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
        console.error("Error fetching filtered quotation data:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 0, // 5 minutes
    gcTime: 0, // 10 minutes
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

  // Remove raw API calls - using SearchableSelect instead

  // Search data with React Query
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["quotationSearch", debounced],
    queryFn: async () => {
      if (!debounced.trim()) return null;
      try {
        const result = await searchAPI(debounced, new AbortController().signal);
        return result;
      } catch (error) {
        console.error("Search API Error:", error);
        return null;
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
      return searchData;
    }
    // Check if filters have been applied and we have filtered data
    if (filtersApplied) {
      return filteredQuotationData;
    }
    return quotationData;
  }, [
    debounced,
    searchData,
    quotationData,
    filteredQuotationData,
    filtersApplied,
  ]);

  // Loading state
  const isLoading =
    isInitialLoading ||
    quotationFetching ||
    (filtersApplied && filteredQuotationLoading) ||
    searchLoading;

  const loadAllQuotations = useCallback(async () => {
    try {
      setIsInitialLoading(true);
      const result = await refetchQuotations();
      if (result.data) {
        queryClient.setQueryData(["quotations", fromDate, toDate], result.data);
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, [refetchQuotations, queryClient, fromDate, toDate]);

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
      setFilters({
        customer_code: initialFilters.customer_code || null,
        sales_person: initialFilters.sales_person || null,
        origin_code: null,
        destination_code: null,
        valid_upto: null,
        quote_type: null,
        status: initialFilters.status || null,
        remark: null,
        revision: null,
      });

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
        await refetchFilteredQuotations();
        setIsInitialLoading(false);
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

  // Add effect to refresh data when returning from create/edit operations
  useEffect(() => {
    // Check if we're returning from a create/edit operation with filter restoration
    if (location.state?.restoreFilters) {
      const restoreFiltersData = location.state.restoreFilters;

      // Restore filter state
      setFilters(
        restoreFiltersData.filters || {
          customer_code: null,
          sales_person: null,
          origin_code: null,
          destination_code: null,
          valid_upto: null,
          quote_type: null,
          status: null,
          remark: null,
          revision: null,
        }
      );

      // Restore date range
      setFromDate(restoreFiltersData.fromDate || null);
      setToDate(restoreFiltersData.toDate || null);

      // Restore filters applied state
      setFiltersApplied(restoreFiltersData.filtersApplied || false);

      // Restore display values for SearchableSelect fields
      if (restoreFiltersData.displayValues) {
        setCustomerDisplayValue(
          restoreFiltersData.displayValues.customer_code || null
        );
        setOriginDisplayValue(
          restoreFiltersData.displayValues.origin_code || null
        );
        setDestinationDisplayValue(
          restoreFiltersData.displayValues.destination_code || null
        );
      }

      // Clear the restore filters flag
      navigate(location.pathname, { replace: true, state: {} });

      // Refresh all quotation data based on restored filter state
      const refreshData = async () => {
        try {
          // Use restored filtersApplied state to determine which query to refetch
          if (restoreFiltersData.filtersApplied) {
            // Invalidate the filtered queries to trigger refetch with new filter payload
            await queryClient.invalidateQueries({
              queryKey: ["filteredQuotations"],
            });
            // Wait a bit for filter state and query key to update before refetching
            setTimeout(async () => {
              await refetchFilteredQuotations();
            }, 200);
          } else {
            await queryClient.invalidateQueries({ queryKey: ["quotations"] });
            await refetchQuotations();
          }
        } catch (error) {
          console.error("Error refreshing data:", error);
        }
      };

      refreshData();
    } else if (location.state?.refreshData && isMountedRef.current) {
      // Check if we're returning from a create/edit operation (only if already mounted)
      // Clear the refresh flag
      navigate(location.pathname, { replace: true, state: {} });

      // Refresh all quotation data
      if (filtersApplied && Object.keys(buildFilterPayload()).length > 0) {
        setIsInitialLoading(true);
        refetchFilteredQuotations().finally(() => setIsInitialLoading(false));
      } else {
        loadAllQuotations();
      }
    } else if (location.state?.refreshData && !isMountedRef.current) {
      // Fresh mount with refreshData - mark as mounted and load data
      isMountedRef.current = true;
      navigate(location.pathname, { replace: true, state: {} });

      // For approval mode, load filtered data with "QUOTE CREATED" status
      if (isApprovalMode) {
        setIsInitialLoading(true);
        refetchFilteredQuotations().finally(() => setIsInitialLoading(false));
      } else {
        loadAllQuotations();
      }
    }
  }, [
    location.state,
    refetchFilteredQuotations,
    navigate,
    filtersApplied,
    loadAllQuotations,
    queryClient,
  ]);

  const applyFilters = async () => {
    try {
      const filterPayload = buildFilterPayload();

      // If no filters are selected, show unfiltered data

      setFiltersApplied(true);
      setIsInitialLoading(true);
      await refetchFilteredQuotations();
      setIsInitialLoading(false);

      ToastNotification({
        type: "success",
        message: "Filters applied successfully",
      });
      setShowFilters(false);
    } catch (error) {
      console.error("Error applying filters:", error);
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
      status: null,
      remark: null,
      revision: null,
    });
    setSearchQuery("");
    setFiltersApplied(false);

    // Clear display values
    setCustomerDisplayValue(null);
    setOriginDisplayValue(null);
    setDestinationDisplayValue(null);

    // Invalidate queries and refetch unfiltered data
    await queryClient.invalidateQueries({ queryKey: ["quotations"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredQuotations"] });
    await loadAllQuotations();
    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Fetch data for download with applied filters
  const fetchDownloadData = async () => {
    try {
      // Always use current filter state (even if empty, it will fetch all data)
      const filterPayload = buildFilterPayload();
      const requestBody = { filters: filterPayload };
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
          return item.origin_list && item.origin_list.length > 0
            ? item.origin_list.join("\n")
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
          return item.destination_list && item.destination_list.length > 0
            ? item.destination_list.join("\n")
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
            return item.quotation
              .map((q: any) => {
                if (q.service_type === "FCL" && q.cargo_details) {
                  const total = q.cargo_details.reduce(
                    (sum: number, cd: any) => sum + (cd.no_of_containers || 0),
                    0
                  );
                  return total || "N/A";
                }
                return "N/A";
              })
              .join("\n");
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
            return item.quotation
              .map((q: any) => {
                const total =
                  q.charges?.reduce(
                    (sum: number, charge: any) =>
                      sum + (charge.total_cost || 0),
                    0
                  ) || 0;
                return total;
              })
              .join("\n");
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
            return item.quotation
              .map((q: any) => {
                const total =
                  q.charges?.reduce(
                    (sum: number, charge: any) =>
                      sum + (charge.total_sell || 0),
                    0
                  ) || 0;
                return total;
              })
              .join("\n");
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
            return item.quotation.map((q: any) => q.profit || 0).join("\n");
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
            return item.quotation.map((q: any) => q.revision || 0).join("\n");
          }
          return "N/A";
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

      setEmailForm({
        to_email: currentQuotation.customer_email || "",
        cc_email: currentQuotation.salesperson_email || "",
        subject: subject,
        message: "Please find the attached Quotation.",
      });
      openSendEmail();
    }
  };

  const handleSendEmail = async () => {
    if (!currentQuotation || !pdfBlob) {
      ToastNotification({
        type: "error",
        message: "Quotation or PDF not available",
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
      // Convert blob URL to File
      const response = await fetch(pdfBlob);
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
      // Get country from user store or localStorage
      const country = user?.country || null;
      setPreviewOpen(true);
      const userCurrency = await getUserCurrencyCode(
        user?.country?.country_code
      );
      const blobUrl = generateNewQuotationPDF(
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
    // Preserve current filter state when navigating to edit
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
    const returnToPath = isApprovalMode ? "/quotation-approval" : "/quotation";
    navigate("/quotation-create", {
      state: {
        ...rowData,
        actionType: "edit",
        preserveFilters: currentFilterState,
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

  const columns = useMemo<MRT_ColumnDef<QuotationData>[]>(
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
        id: "enquiry_id",
        accessorKey: "enquiry_id",
        header: "Enquiry ID",
      },
      {
        id: "customer_name",
        accessorKey: "customer_name",
        header: "Customer Name",
      },
      {
        id: "sales_person",
        accessorKey: "sales_person",
        header: "Sales Person",
      },
      {
        id: "created_at",
        accessorKey: "created_at",
        header: "Quote Date",
        Cell: ({ row }) => {
          const quotations = (row.original as any)?.quotation;
          const quoteCreatedAt =
            Array.isArray(quotations) && quotations.length > 0
              ? quotations[0]?.created_at
              : null;
          return quoteCreatedAt
            ? dayjs(quoteCreatedAt).format("YYYY-MM-DD")
            : "-";
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
        id: "valid_upto_list",
        accessorKey: "valid_upto_list",
        header: "Valid Upto",
        Cell: ({ cell }) => {
          const validUptoList = cell.getValue<string[]>();
          if (
            !validUptoList ||
            !Array.isArray(validUptoList) ||
            validUptoList.length === 0
          ) {
            return "-";
          }
          return (
            <div style={{ lineHeight: "1.4" }}>
              {validUptoList.map((date, index) => (
                <div key={index}>{date}</div>
              ))}
            </div>
          );
        },
      },
      {
        id: "revision",
        accessorKey: "revision",
        header: "Revision",
        Cell: ({ row }) => {
          const quotations = (row.original as QuotationData)?.quotation;
          if (!quotations) {
            return null;
          }
          return (
            <Stack gap="xs">
              {quotations.map((quote, index) => {
                if (quote.revision === 0)
                  return (
                    <Text key={index} px={8}>
                      -
                    </Text>
                  );
                return (
                  <Badge
                    key={index}
                    style={{ cursor: "pointer" }}
                    onClick={() => fetchRevision(quote.quotation_service_id)}
                    color="#105476"
                    size="sm"
                  >
                    {quote.revision}
                  </Badge>
                );
              })}
            </Stack>
          );
        },
      },
      {
        id: "reject_remark",
        accessorKey: "reject_remark",
        header: "Remark",
        Cell: ({ cell }) => {
          const reject_remark = cell.getValue<string>();
          if (reject_remark == "" || !reject_remark) {
            return "-";
          }

          // Join all remarks with line breaks for display
          const fullRemarkText = reject_remark || "";
          const displayText =
            fullRemarkText.trim().length > 10
              ? fullRemarkText.substring(0, 10) + "..."
              : fullRemarkText;

          return (
            <Tooltip
              label={fullRemarkText}
              multiline
              w={300}
              position="top"
              withArrow
            >
              <Text
                size="sm"
                style={{
                  cursor: "pointer",
                  lineHeight: "1.4",
                  whiteSpace: "pre-line",
                }}
              >
                {displayText}
              </Text>
            </Tooltip>
          );
        },
      },

      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        Cell: ({ row }) => {
          const status = (row.original as QuotationData).status;
          if (!status) {
            return (
              <Badge color="gray" size="sm">
                Pending
              </Badge>
            );
          }
          return (
            <Badge
              color={
                status === "GAINED"
                  ? "green"
                  : status === "LOST"
                    ? "red"
                    : status === "QUOTE APPROVED" || status === "Quote Approved"
                      ? "blue"
                      : "cyan"
              }
              size="sm"
            >
              {status.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Action",
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
                      showQuotationPreview(row.original);
                    }}
                  >
                    <Group gap={"sm"}>
                      <IconEye size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Preview</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                {/* Hide Edit Quote option if opened from Dashboard (but show Approve Quotation in approval mode) */}
                {(isApprovalMode || !location.state?.returnToDashboard) && (
                  <>
                    <Menu.Divider />
                    <Box px={10} py={5}>
                      <UnstyledButton
                        onClick={() => {
                          setMenuOpened(false);
                          handlePrimaryAction(row.original);
                        }}
                      >
                        <Group gap={"sm"}>
                          <PrimaryActionIcon
                            size={16}
                            style={{ color: "#105476" }}
                          />
                          <Text size="sm">{primaryActionLabel}</Text>
                        </Group>
                      </UnstyledButton>
                    </Box>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [
      navigate,
      filters,
      filtersApplied,
      fromDate,
      toDate,
      showQuotationPreview,
      handlePrimaryAction,
      primaryActionLabel,
      PrimaryActionIcon,
      isApprovalMode,
      location,
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
        fontSize: "13px",
        width: "100%",
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
    // pagination will be controlled by a custom bar below the table
  });

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
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Box mb="md">
          <Group justify="space-between" align="center" mb="md">
            <Text
              size="md"
              fw={600}
              c={"#444955"}
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              {pageTitle}
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
            </Group>
          </Group>
        </Box>

        {/* Filter Section */}
        {showFilters && (
          <Box
            mb="md"
            style={{
              borderRadius: "8px",
              border: "1px solid #E0E0E0",
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
              {/* Customer Name Filter */}
              <Grid.Col span={2.4}>
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
                  className="filter-searchable-select"
                />
              </Grid.Col>

              {/* Sales Person Filter */}
              <Grid.Col span={2.4}>
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
                  className="filter-searchable-select"
                />
              </Grid.Col>

              {/* Destination Filter */}
              <Grid.Col span={2.4}>
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
                  className="filter-searchable-select"
                />
              </Grid.Col>

              {/* Quote Date Filter */}
              <Grid.Col span={2.4}>
                <DateInput
                  key={`quote-date-${filters.valid_upto}`}
                  label="Quote Date"
                  placeholder="YYYY-MM-DD"
                  size="xs"
                  value={filters.valid_upto}
                  onChange={(date) =>
                    setFilters((prev) => ({ ...prev, valid_upto: date }))
                  }
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={14} />}
                  leftSectionPointerEvents="none"
                  radius="md"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  clearable
                  styles={
                    {
                      input: { fontSize: "13px", height: "36px" },
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
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        marginBottom: "0.8rem",
                        flex: 1,
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "2.5rem",
                      },
                      calendarHeaderControl: {
                        width: "2.5rem",
                        height: "2.5rem",
                        margin: "0 0.5rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      },
                      calendarHeader: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                        padding: "0.5rem 0",
                        height: "3rem",
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

              {/* Date Range Filter */}
              <Grid.Col span={2.4}>
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
                />
              </Grid.Col>

              {/* Quote Type Filter */}
              <Grid.Col span={2.4}>
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

              {/* Approval Status Filter */}
              <Grid.Col span={2.4}>
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

              {/* Remark Filter */}
              <Grid.Col span={2.4}>
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
              <Grid.Col span={2.4}>
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
                size="sm"
                variant="outline"
                color="#105476"
                leftSection={<IconFilterOff size={16} />}
                onClick={clearAllFilters}
                styles={{
                  root: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontstyle: "semibold",
                    borderColor: "#105476",
                    color: "#105476",
                    "&:hover": {
                      backgroundColor: "#E0F5FF",
                    },
                  },
                }}
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                variant="filled"
                color="#105476"
                leftSection={
                  isLoading ? <Loader size={16} /> : <IconFilter size={16} />
                }
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
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
              <Text c="dimmed">Loading quotations...</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <Box style={{ position: "relative" }}>
              <MantineReactTable table={table} />
              {/* Loader overlay for approval mode when approving */}
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
                    borderRadius: "8px",
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

            {/* Custom Pagination Bar */}
            {/* Back to Dashboard Button - Only show when navigated from dashboard */}
            {location.state?.returnToDashboard && (
              <Group justify="center" mt="md" mb="sm">
                <Button
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => {
                    const dashboardState = (location.state as any)
                      ?.dashboardState;
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
              </Group>
            )}
          </>
        )}
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
            <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
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
              styles={{
                input: {
                  fontSize: "13px",
                  height: "30px",
                  fontFamily: "Inter",
                },
              }}
            />
            <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
              {(() => {
                const { pageIndex, pageSize } = table.getState().pagination;
                const total = table.getPrePaginationRowModel().rows.length || 0;
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
            <Text
              size="sm"
              ta="center"
              style={{ width: 26, fontFamily: "Inter" }}
            >
              {table.getState().pagination.pageIndex + 1}
            </Text>
            <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
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
                const total = table.getPrePaginationRowModel().rows.length || 0;
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
                const total = table.getPrePaginationRowModel().rows.length || 0;
                const totalPages = Math.max(
                  1,
                  Math.ceil(total / table.getState().pagination.pageSize)
                );
                return table.getState().pagination.pageIndex >= totalPages - 1;
              })()}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>

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
      </Card>
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
