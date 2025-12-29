import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Menu,
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
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilterOff,
  IconPlus,
  IconSearch,
  IconFilter,
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconTag,
  IconArrowLeft,
  IconDownload,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { getAPICall } from "../../service/getApiCall";
import { API_HEADER } from "../../store/storeKeys";
import { URL } from "../../api/serverUrls";
import { apiCallProtected } from "../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import {
  ToastNotification,
  SearchableSelect,
  DateRangeInput,
} from "../../components";
import { putAPICall } from "../../service/putApiCall";
import useAuthStore from "../../store/authStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateEnquiryPDF } from "./EnquiryPDFTemplate";

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

  // Preview modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [currentEnquiry, setCurrentEnquiry] = useState<any>(null);

  // Get the default branch from user
  const defaultBranch =
    user?.branches?.find((branch) => branch.is_default) || user?.branches?.[0];

  // Date range state for summary view
  const [fromDate, setFromDate] = useState<Date | null>(
    hasInitialFilters ? null : getDefaultFromDate()
  );
  const [toDate, setToDate] = useState<Date | null>(
    hasInitialFilters ? null : getDefaultToDate()
  );

  const isMountedRef = useRef(false); // Start as false, will be set when mounted or initial filters processed
  const initialFiltersProcessed = useRef(false);
  const restoreFiltersProcessed = useRef(false);
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard)
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state
  const [isRestoringFilters, setIsRestoringFilters] = useState(
    Boolean(location.state?.restoreFilters)
  );

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
    null
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

  // Detailed view pagination (completely separate)
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(25);

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
      setShowPreviewTable(true); // Show preview table immediately
      // Reset to first page when opening preview
      setPreviewCurrentPage(1);
      // Clear any existing search when switching to detailed view
      setSearchQuery("");
      // Close the filters section when switching to detailed view
      setShowFilters(false);

      const summaryHasFilters =
        filtersApplied ||
        Boolean(
          (fromDate && toDate) ||
            filters.customer_code ||
            filters.sales_person ||
            filters.origin_code ||
            filters.destination_code ||
            filters.service ||
            filters.trade ||
            filters.enquiry_id ||
            filters.reference_no ||
            (filters.status && filters.status !== "ALL")
        );

      // Check if summary view has applied filters or default filters are active
      if (summaryHasFilters) {
        // Map summary view filters to detailed view filters
        const mappedPreviewFilters: PreviewFilterState = {
          customer_name: filters.customer_code || null, // Map customer_code to customer_name
          sales_person: filters.sales_person || null,
          enquiry_received_date: fromDate && toDate ? new Date(fromDate) : null, // Map date range from summary view
          enquiry_received_date_to:
            fromDate && toDate ? new Date(toDate) : null, // Map date range from summary view
          terms_of_shipment: null, // Not in summary view, leave as null
          service: filters.service || null,
          trade: filters.trade || null,
          origin_name: filters.origin_code || null, // Map origin_code to origin_name
          destination_name: filters.destination_code || null, // Map destination_code to destination_name
          status: filters.status || "ACTIVE",
          enquiry_id: filters.enquiry_id || null,
          reference_no: filters.reference_no || null,
        };

        setPreviewFilters(mappedPreviewFilters);
        // Mark filters as applied in detailed view
        setPreviewFiltersApplied(true);

        // Invalidate filtered preview queries to trigger refetch with new filter payload
        await queryClient.invalidateQueries({
          queryKey: ["filteredPreviewData"],
        });

        // Refetch filtered preview data with mapped filters
        // Wait a bit for state and query key to update before refetching
        setTimeout(async () => {
          await refetchFilteredPreview();
        }, 200);
      } else {
        // No filters applied in summary view, clear detailed view filters
        setPreviewFiltersApplied(false);
        setPreviewFilters({
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
        // Fetch initial data without filters when opening detailed view
        await refetchInitialPreview();
      }
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
      // Reset to first page when switching back to list view
      setListCurrentPage(1);
      // Clear any existing search when switching back to list view
      setSearchQuery("");
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
      } else {
        // No filters applied in detailed view, preserve existing summary view filters
        // DO NOT clear filters or reset filtersApplied - preserve the summary view filters
        // The filters and filtersApplied state should remain as they were before switching to detailed view
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
      const response = await fetch(`${URL.base}${URL.enquiryDownloadExcel}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to download");
      const blob = await response.blob();
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
    []
  );

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [showFilters, setShowFilters] = useState(false);

  // Optimized filter toggle to prevent unnecessary re-renders
  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const buildFilterPayload = useMemo(() => {
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

    return payload;
  }, [filters, fromDate, toDate]);

  // Build preview filter payload function (for detailed view) - OPTIMIZED with useMemo
  const buildPreviewFilterPayload = useMemo(() => {
    const payload: any = {};

    // Add date range if both dates are selected
    if (
      previewFilters.enquiry_received_date &&
      previewFilters.enquiry_received_date_to
    ) {
      payload.enquiry_received_date_from = dayjs(
        previewFilters.enquiry_received_date
      ).format("YYYY-MM-DD");
      payload.enquiry_received_date_to = dayjs(
        previewFilters.enquiry_received_date_to
      ).format("YYYY-MM-DD");
    }

    if (previewFilters.customer_name)
      payload.customer_code = previewFilters.customer_name; // Use customer_code like list view
    if (previewFilters.terms_of_shipment)
      payload.terms_of_shipment = previewFilters.terms_of_shipment;
    if (previewFilters.sales_person)
      payload.sales_person = previewFilters.sales_person;
    if (previewFilters.service) payload.service = previewFilters.service;
    if (previewFilters.trade) payload.trade = previewFilters.trade;
    if (previewFilters.origin_name)
      payload.origin_code = previewFilters.origin_name; // Use origin_code like list view
    if (previewFilters.destination_name)
      payload.destination_code = previewFilters.destination_name; // Use destination_code like list view
    if (previewFilters.enquiry_id)
      payload.enquiry_id = previewFilters.enquiry_id;
    if (previewFilters.reference_no)
      payload.reference_no = previewFilters.reference_no;
    if (previewFilters.status && previewFilters.status !== "ALL") {
      payload.status = previewFilters.status;
    } else {
      payload.status = "";
    }
    return payload;
  }, [previewFilters]);

  // Fetch enquiry data with React Query - with pagination and date range
  const {
    data: enquiryData = [],
    isLoading: enquiryLoading,
    refetch: refetchEnquiries,
  } = useQuery({
    queryKey: ["enquiries", listCurrentPage, listPageSize, fromDate, toDate],
    queryFn: async () => {
      try {
        console.log("Fetching enquiry data FIRST API");
        let requestBody: { filters: any } = { filters: { status: "ACTIVE" } };

        // Only add date filters if both dates are selected
        if (fromDate && toDate) {
          requestBody.filters.enquiry_received_date_from =
            dayjs(fromDate).format("YYYY-MM-DD");
          requestBody.filters.enquiry_received_date_to =
            dayjs(toDate).format("YYYY-MM-DD");
        }

        const response = await apiCallProtected.post(
          `${URL.enquiryFilter}?index=${(listCurrentPage - 1) * listPageSize}&limit=${listPageSize}`,
          requestBody
        );
        const data = response as any;
        if (data && Array.isArray(data.data)) {
          setListTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setListTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching enquiry data:", error);
        setListTotalRecords(0);
        return [];
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Separate query for filtered data - with pagination
  const {
    data: filteredEnquiryData = [],
    isLoading: filteredEnquiryLoading,
    refetch: refetchFilteredEnquiries,
  } = useQuery({
    queryKey: [
      "filteredEnquiries",
      buildFilterPayload,
      listCurrentPage,
      listPageSize,
    ],
    queryFn: async () => {
      try {
        const filterPayload = buildFilterPayload;
        // Don't return empty array - let the query be disabled instead
        if (Object.keys(filterPayload).length === 0) {
          console.log("No filters applied, skipping API call");
          return [];
        }

        const requestBody = { filters: filterPayload };
        console.log("Applying filters:", filterPayload);
        const response = await apiCallProtected.post(
          `${URL.enquiryFilter}?index=${(listCurrentPage - 1) * listPageSize}&limit=${listPageSize}`,
          requestBody
        );
        const data = response as any;
        if (data && Array.isArray(data.data)) {
          setListTotalRecords(data.total || data.data.length);
          console.log("Filtered data received:", data.data.length, "records");
          return data.data;
        }
        setListTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching filtered enquiry data:", error);
        setListTotalRecords(0);
        return [];
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 0,
    gcTime: 0,
  });

  const { isLoading: previewLoading } = useQuery({
    queryKey: [
      "enquiryPreview",
      previewCurrentPage,
      previewPageSize,
      buildPreviewFilterPayload,
    ],
    queryFn: async () => {
      try {
        // Build filter payload for preview
        const filterPayload = buildPreviewFilterPayload;
        const requestBody = { filters: { ...filterPayload } };

        const res: any = await apiCallProtected.post(
          `${URL.enquiryPreviewExcel}?index=${(previewCurrentPage - 1) * previewPageSize}&limit=${previewPageSize}`,
          requestBody
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
    enabled: false, // Disabled by default - only fetch when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Separate query for initial preview data (no filters) - only when first opened
  const {
    data: initialPreviewData,
    isLoading: initialPreviewLoading,
    refetch: refetchInitialPreview,
  } = useQuery({
    queryKey: ["initialPreviewData", previewCurrentPage, previewPageSize],
    queryFn: async () => {
      try {
        // No filters - just get all data
        const requestBody = { filters: { status: "ACTIVE" } };

        const res: any = await apiCallProtected.post(
          `${URL.enquiryPreviewExcel}?index=${(previewCurrentPage - 1) * previewPageSize}&limit=${previewPageSize}`,
          requestBody
        );
        return {
          columns: Array.isArray(res?.columns) ? res.columns : [],
          data: Array.isArray(res?.data) ? res.data : [],
          total: res?.total_count || res?.total || 0,
        };
      } catch (error: any) {
        ToastNotification({
          type: "error",
          message: error?.message || "Failed to load initial preview",
        });
        return { columns: [], data: [], total: 0 };
      }
    },
    enabled: showPreviewTable && !previewFiltersApplied, // Only when in preview mode and no filters applied
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Separate query for filtered preview data (only when filters are applied)
  const {
    data: filteredPreviewData,
    isLoading: filteredPreviewLoading,
    refetch: refetchFilteredPreview,
  } = useQuery({
    queryKey: [
      "filteredPreviewData",
      previewCurrentPage,
      previewPageSize,
      buildPreviewFilterPayload,
    ],
    queryFn: async () => {
      try {
        // Build filter payload for preview
        const filterPayload = buildPreviewFilterPayload;
        console.log("Applying preview filters:", filterPayload);
        const requestBody = { filters: { ...filterPayload } };

        const res: any = await apiCallProtected.post(
          `${URL.enquiryPreviewExcel}?index=${(previewCurrentPage - 1) * previewPageSize}&limit=${previewPageSize}`,
          requestBody
        );
        const result = {
          columns: Array.isArray(res?.columns) ? res.columns : [],
          data: Array.isArray(res?.data) ? res.data : [],
          total: res?.total_count || res?.total || 0,
        };
        console.log(
          "Filtered preview data received:",
          result.data.length,
          "records"
        );
        return result;
      } catch (error: any) {
        ToastNotification({
          type: "error",
          message: error?.message || "Failed to load filtered preview",
        });
        return { columns: [], data: [], total: 0 };
      }
    },
    enabled: false, // Disabled by default - only fetch when Apply Filters is clicked
    staleTime: 30 * 60 * 1000, // 30 minutes - keep data longer
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const {
    data: rawTermsOfShipmentData,
    isLoading: termsOfShipmentDataLoading,
  } = useQuery({
    queryKey: ["termsOfShipment"],
    queryFn: async () => {
      try {
        const termsResponse = (await getAPICall(
          URL.termsOfShipment,
          API_HEADER
        )) as any[];
        return termsResponse || [];
      } catch (error) {
        console.error("Error fetching terms of shipment data:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const termsOfShipmentOptionsData = useMemo(() => {
    if (!rawTermsOfShipmentData) return [];
    return rawTermsOfShipmentData
      .filter((item: any) => item?.tos_name && item?.tos_code)
      .map((item: any) => ({
        value: String(item.tos_name),
        label: `${item.tos_name} (${item.tos_code})`,
      }))
      .filter(
        (option, index, self) =>
          index === self.findIndex((o) => o.value === option.value)
      );
  }, [rawTermsOfShipmentData]);

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
    []
  );

  // Memoized trade options
  const tradeOptions = useMemo(
    () => [
      { value: "Import", label: "Import" },
      { value: "Export", label: "Export" },
    ],
    []
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
    []
  );

  // Search data with React Query - with pagination
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["enquirySearch", debounced, listCurrentPage, listPageSize],
    queryFn: async () => {
      if (!debounced.trim()) return null;
      try {
        // Use the filter API with search query and pagination
        const searchPayload = { search: debounced };
        const requestBody = { filters: searchPayload };
        const response = await apiCallProtected.post(
          `${URL.enquiryFilter}?index=${(listCurrentPage - 1) * listPageSize}&limit=${listPageSize}`,
          requestBody
        );
        const data = response as any;
        if (data && Array.isArray(data.data)) {
          setListTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setListTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Search API Error:", error);
        setListTotalRecords(0);
        return [];
      }
    },
    enabled: debounced.trim() !== "" && !showPreviewTable,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // SEPARATE SEARCH FOR PREVIEW VIEW
  const { data: previewSearchData, isLoading: previewSearchLoading } = useQuery(
    {
      queryKey: [
        "previewSearch",
        debounced,
        previewCurrentPage,
        previewPageSize,
      ],
      queryFn: async () => {
        if (!debounced.trim()) return null;
        try {
          // Use the preview API with search query and pagination
          const searchPayload = { search: debounced };
          const requestBody = {
            filters: { ...buildPreviewFilterPayload, ...searchPayload },
          };
          const response = await apiCallProtected.post(
            `${URL.enquiryPreviewExcel}?index=${(previewCurrentPage - 1) * previewPageSize}&limit=${previewPageSize}`,
            requestBody
          );
          const data = response as any;
          if (data && Array.isArray(data.data)) {
            return {
              columns: Array.isArray(data?.columns) ? data.columns : [],
              data: Array.isArray(data?.data) ? data.data : [],
              total: data?.total_count || data?.total || 0,
            };
          }
          return { columns: [], data: [], total: 0 };
        } catch (error: any) {
          console.error("Preview Search API Error:", error);
          return { columns: [], data: [], total: 0 };
        }
      },
      enabled: debounced.trim() !== "" && showPreviewTable,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Determine which data to display
  const displayData = useMemo(() => {
    // If there's a search query, show search results
    if (debounced.trim() !== "" && searchData) {
      return searchData;
    }

    // If filters were actually applied (clicked), show filtered results
    if (filtersApplied) {
      return filteredEnquiryData;
    }

    // Otherwise, show the original enquiry data
    return enquiryData;
  }, [debounced, searchData, enquiryData, filteredEnquiryData, filtersApplied]);

  // Determine which preview data to display
  const displayPreviewData = useMemo(() => {
    // If there's a search query, show search results
    if (debounced.trim() !== "" && previewSearchData) {
      return previewSearchData;
    }

    // If preview filters were actually applied (clicked), show filtered results
    if (previewFiltersApplied) {
      return filteredPreviewData;
    }

    // Otherwise, show the initial preview data (no filters)
    return initialPreviewData;
  }, [
    debounced,
    previewSearchData,
    filteredPreviewData,
    previewFiltersApplied,
    initialPreviewData,
  ]);

  // Loading state - include refreshing state
  const isLoading =
    enquiryLoading ||
    filteredEnquiryLoading ||
    searchLoading ||
    isRefreshingData;
  const isPreviewLoading =
    previewLoading ||
    previewSearchLoading ||
    filteredPreviewLoading ||
    initialPreviewLoading ||
    isRefreshingData;

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
      // Filter out "No of Containers" and prepare column order
      const filteredColumns = (displayPreviewData?.columns || []).filter(
        (col: string) => col !== "No of Containers"
      );

      // Ensure "Reference No" is always included in the columns
      const columnsWithReferenceNo = [...filteredColumns];
      if (!columnsWithReferenceNo.includes("Reference No")) {
        columnsWithReferenceNo.push("Reference No");
      }

      // Determine the customer column (prefer explicit "Customer Name")
      const customerColumn =
        columnsWithReferenceNo.find(
          (col) =>
            col === "Customer Name" ||
            col === "customer_name" ||
            col.toLowerCase().includes("customer")
        ) || null;

      // Build ordered columns list: customer right after S.No, then the rest (skipping sno variants)
      const orderedColumns: string[] = [];
      if (customerColumn) {
        orderedColumns.push(customerColumn);
      }
      orderedColumns.push(
        ...columnsWithReferenceNo.filter(
          (col) =>
            col !== customerColumn &&
            !["sno", "S.No", "SNO", "S No"].includes(col)
        )
      );

      const columnDefs: MRT_ColumnDef<any>[] = [];

      // Add S.No as the first column (left of Customer Name)
      columnDefs.push({
        id: "sno",
        header: "S.No",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        accessorFn: (row: any) => {
          const apiSno =
            row?.sno ?? row?.SNO ?? row?.s_no ?? row?.S_No ?? row?.["S.No"];
          return apiSno !== undefined && apiSno !== null && apiSno !== ""
            ? apiSno
            : '';
        },
        Cell: ({ row }) => {
          const apiSno =
            row?.original?.sno ??
            row?.original?.SNO ??
            row?.original?.s_no ??
            row?.original?.S_No ??
            row?.original?.["S.No"];
          const displayValue =
            apiSno !== undefined && apiSno !== null && apiSno !== ""
              ? apiSno
              : '';
          return (
            <Text size="sm" style={{ fontWeight: 500 }}>
              {displayValue}
            </Text>
          );
        },
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
              ? 200
              : col === "Enquiry Date"
                ? 120
                : col === "Remark"
                  ? 180
                  : col === "Status"
                    ? 130
                    : col === "Shipment"
                      ? 150
                      : col === "Cargo Details"
                        ? 120
                        : col === "Reference No"
                          ? 50
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
    data: displayPreviewData?.data || [],
    enableColumnFilters: false,
    enablePagination: false, // Removed pagination
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      columnPinning: { left: ["sno", "customer_name"] },
      // Pin the customer name column by accessorKey
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
    // Keep cell/head styles minimal to avoid interfering with built-in sticky behavior
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
  });

  const applyFilters = async () => {
    try {
      console.log("filters.status", filters.status);
      const hasFilterValues =
        buildFilterPayload.customer_code ||
        buildFilterPayload.sales_person ||
        buildFilterPayload.origin_code ||
        buildFilterPayload.destination_code ||
        buildFilterPayload.enquiry_received_date_from ||
        buildFilterPayload.service ||
        buildFilterPayload.trade ||
        buildFilterPayload.enquiry_id ||
        buildFilterPayload.reference_no ||
        (filters.status !== "ALL" ? buildFilterPayload.status : true);

      if (!hasFilterValues) {
        setFiltersApplied(false);
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setFiltersApplied(true); // Mark that filters were applied

      if (showPreviewTable) {
        setPreviewCurrentPage(1); // Reset to first page when applying filters
        setPreviewFiltersApplied(true); // Mark that filters were applied
        await refetchFilteredPreview(); // Manually refetch filtered preview data
        ToastNotification({
          type: "success",
          message: "Filters applied successfully",
        });
      } else {
        setListCurrentPage(1);
        setIsRefreshingData(true);
        await refetchFilteredEnquiries(); // Manually refetch filtered data
        setIsRefreshingData(false);
        ToastNotification({
          type: "success",
          message: "Filters applied successfully",
        });
      }
      setShowFilters(false);
    } catch (error) {
      console.error("Error applying filters:", error);
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
      enquiry_received_date: null,
      enquiry_received_date_to: null,
      service: null,
      trade: null,
      status: null,
      enquiry_id: null,
      reference_no: null,
    });
    setPreviewFilters({
      customer_name: null,
      sales_person: null,
      enquiry_received_date: null,
      enquiry_received_date_to: null,
      terms_of_shipment: null,
      service: null,
      trade: null,
      origin_name: null,
      destination_name: null,
      status: null,
      enquiry_id: null,
      reference_no: null,
    });
    setSearchQuery("");

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
      // Invalidate queries and refetch preview data
      await queryClient.invalidateQueries({ queryKey: ["enquiryPreview"] });
      await queryClient.invalidateQueries({
        queryKey: ["filteredPreviewData"],
      });
      await queryClient.invalidateQueries({ queryKey: ["initialPreviewData"] });
      await queryClient.invalidateQueries({ queryKey: ["previewSearch"] });
      await refetchInitialPreview();
    } else {
      setListCurrentPage(1); // Reset to first page
      // Invalidate queries and refetch unfiltered data
      await queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      await queryClient.invalidateQueries({ queryKey: ["filteredEnquiries"] });
      await refetchEnquiries();
    }

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const handleCancelEnquiry = async (enquiry: number) => {
    try {
      const enquiryData = enquiry as any;

      // Transform the payload: map _read fields to non-_read fields
      const payload: any = {
        id: enquiryData.id,
        customer_code:
          enquiryData.customer_code_read || enquiryData.customer_code,
        enquiry_received_date: enquiryData.enquiry_received_date,
        sales_person: enquiryData.sales_person,
        status: "INACTIVE",
        sales_coordinator: enquiryData.sales_coordinator || "",
        customer_services: enquiryData.customer_services || "",
        reference_no: enquiryData.reference_no || "",
        services: (enquiryData.services || []).map((service: any) => ({
          service: service.service,
          trade: service.trade,
          origin_code: service.origin_code_read || service.origin_code,
          destination_code:
            service.destination_code_read || service.destination_code,
          pickup: service.pickup || false,
          delivery: service.delivery || false,
          pickup_location: service.pickup_location || "",
          delivery_location: service.delivery_location || "",
          hazardous_cargo: service.hazardous_cargo || false,
          shipment_terms_code:
            service.shipment_terms_code_read || service.shipment_terms_code,
          service_remark: service.service_remark || "",
          id: service.id,
          no_of_packages: service.no_of_packages,
          gross_weight: service.gross_weight,
          volume: service.volume,
          volume_weight: service.volume_weight,
          chargeable_volume: service.chargeable_volume,
          chargeable_weight: service.chargeable_weight,
          stackable: service.stackable || false,
        })),
      };

      const response = await putAPICall(`${URL.enquiry}`, payload, API_HEADER);

      if (response) {
        ToastNotification({
          type: "success",
          message: "Enquiry cancelled successfully",
        });
        // Refetch data after cancellation
        if (filtersApplied) {
          await refetchFilteredEnquiries();
        } else {
          await refetchEnquiries();
        }
      }
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while cancelling enquiry: ${err?.message || "Unknown error"}`,
      });
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

  // Handle initial filters from navigation
  useEffect(() => {
    if (location.state?.initialFilters && !initialFiltersProcessed.current) {
      initialFiltersProcessed.current = true;
      isMountedRef.current = true; // Mark as mounted to prevent default data load

      // Persist returnToDashboard and dashboardState in refs
      if (location.state?.returnToDashboard !== undefined) {
        returnToDashboardRef.current = Boolean(
          location.state.returnToDashboard
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
          true
        );
        if (parsedFrom.isValid()) {
          enquiryReceivedDateFrom = parsedFrom.toDate();
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
          enquiryReceivedDateTo = parsedTo.toDate();
        } else {
          console.error(
            "Invalid to date:",
            initialFilters.enquiry_received_date_to
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

      // Mark filters as applied
      setFiltersApplied(true);
      setIsRefreshingData(true);

      // Clear only initialFilters but preserve dashboard return state
      // Update refs before navigation to ensure they persist
      if (location.state?.returnToDashboard !== undefined) {
        returnToDashboardRef.current = Boolean(
          location.state.returnToDashboard
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

      // Call API after a small delay to ensure state is updated
      setTimeout(async () => {
        setIsRefreshingData(true);
        await refetchFilteredEnquiries();
        setIsRefreshingData(false);
      }, 50);
    } else if (
      !isMountedRef.current &&
      !location.state?.refreshData &&
      !initialFiltersProcessed.current
    ) {
      // Initial mount - load default data only if not navigating with refreshData flag
      // and if we haven't processed initial filters
      isMountedRef.current = true;

      // Load default data with dates
      if (fromDate && toDate) {
        setIsRefreshingData(true);
        refetchEnquiries().finally(() => setIsRefreshingData(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.state,
    location.pathname,
    refetchEnquiries,
    refetchFilteredEnquiries,
  ]);

  // Add effect to refresh data when returning from create/edit operations
  useEffect(() => {
    // Check if we're returning from a create/edit operation with filter restoration
    if (location.state?.restoreFilters && !restoreFiltersProcessed.current) {
      restoreFiltersProcessed.current = true;
      console.log(
        "🔄 Restoring filters and refreshing data after create/edit operation"
      );
      setIsRestoringFilters(true);
      setIsRefreshingData(true); // Start loading state

      const restoreFiltersData = location.state.restoreFilters;

      // Restore filter state - preserve original filters including status "ALL"
      setFilters(
        restoreFiltersData.filters || {
          customer_code: null,
          sales_person: null,
          origin_code: null,
          destination_code: null,
          enquiry_received_date: null,
          enquiry_received_date_to: null,
          service: null,
          trade: null,
          status: null, // Don't default to "ACTIVE", preserve null or original value
          enquiry_id: null,
          reference_no: null,
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

      // Clear the restore filters flag but preserve dashboard return state
      // Use refs to ensure persistence
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
        },
      });

      const performRestore = async () => {
        try {
          // Wait for state updates to flush before refetching
          // Need enough time for React to update the buildFilterPayload useMemo
          await new Promise((resolve) => setTimeout(resolve, 200));

          if (showPreviewTable) {
            if (previewFiltersApplied) {
              await refetchFilteredPreview();
            } else {
              await refetchInitialPreview();
            }
          } else if (restoreFiltersData.filtersApplied) {
            // Actually refetch the filtered data with restored filters
            console.log("🔄 Refetching filtered data with restored filters", {
              filters: restoreFiltersData.filters,
              filtersApplied: restoreFiltersData.filtersApplied,
            });
            await refetchFilteredEnquiries();
            console.log("✅ Data refresh completed with restored filters");
          } else {
            // No filters applied, refetch all data
            await refetchEnquiries();
            console.log("✅ Data refresh completed");
          }
        } catch (error) {
          console.error("Error refreshing data:", error);
        } finally {
          setIsRefreshingData(false);
          setIsRestoringFilters(false);
        }
      };

      performRestore();
      return;
    }

    if (!location.state?.restoreFilters && restoreFiltersProcessed.current) {
      restoreFiltersProcessed.current = false;
    }

    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation");
      setIsRefreshingData(true); // Start loading state

      // Clear the refresh flag but preserve dashboard return state
      // Use refs to ensure persistence
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
        },
      });

      // Refresh all enquiry data
      const refreshData = async () => {
        try {
          if (showPreviewTable) {
            if (previewFiltersApplied) {
              await refetchFilteredPreview();
            } else {
              await refetchInitialPreview();
            }
          } else {
            if (filtersApplied) {
              await refetchFilteredEnquiries();
            } else {
              await refetchEnquiries();
            }
          }

          // Add a small delay to ensure data is updated in the UI
          setTimeout(() => {
            setIsRefreshingData(false);
            console.log("✅ Data refresh completed");
          }, 500);
        } catch (error) {
          console.error("Error refreshing data:", error);
          setIsRefreshingData(false);
        }
      };

      refreshData();
    }
  }, [
    location.state,
    showPreviewTable,
    previewFiltersApplied,
    filtersApplied,
    refetchFilteredPreview,
    refetchInitialPreview,
    refetchEnquiries,
    refetchFilteredEnquiries,
    navigate,
  ]);

  // Handle pagination changes - refetch data when page or page size changes
  useEffect(() => {
    if (showPreviewTable) {
      return;
    }

    if (!isRestoringFilters) {
      if (filtersApplied && !hasInitialFilters) {
        refetchFilteredEnquiries();
      } else if (fromDate && toDate && !hasInitialFilters) {
        // Only call default query if we don't have initial filters
        refetchEnquiries();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCurrentPage, listPageSize, showPreviewTable]);

  useEffect(() => {
    if (showPreviewTable) {
      return;
    }

    if (filtersApplied) {
      const shouldRefresh = filteredEnquiryLoading;
      if (shouldRefresh !== isRefreshingData) {
        setIsRefreshingData(shouldRefresh);
      }
    } else if (!isRestoringFilters && !filtersApplied) {
      if (!enquiryLoading && isRefreshingData) {
        setIsRefreshingData(false);
      }
    }
  }, [
    showPreviewTable,
    filtersApplied,
    filteredEnquiryLoading,
    enquiryLoading,
    isRestoringFilters,
    isRefreshingData,
  ]);

  const columns = useMemo<MRT_ColumnDef<any>[]>(
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
          // Combine service and trade into "Service - Trade" format
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
        id: "status",
        accessorKey: "status",
        header: "Status",
        Cell: ({ cell }) => {
          const { label, color } = getStatusBadge(cell.getValue<string>());
          return (
            <Badge color={color} size="xs">
              {label}
            </Badge>
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
                      (row.original.status || "").toUpperCase()
                    )
                      ? 0.5
                      : 1,
                    cursor: ["GAINED", "LOST", "QUOTE CREATED"].includes(
                      (row.original.status || "").toUpperCase()
                    )
                      ? "not-allowed"
                      : "pointer",
                  }}
                  disabled={["GAINED", "LOST", "QUOTE CREATED"].includes(
                    (row.original.status || "").toUpperCase()
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
                (row.original.status || "").toUpperCase()
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
                            filterPayload
                          );
                          const data = response as any;
                          if (
                            data &&
                            Array.isArray(data.data) &&
                            data.data.length > 0
                          ) {
                            // Get the first quotation (most recent)
                            const quotationData = data.data[0];
                            // Preserve current filter state
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
                    // Preserve current filter state when navigating to get rate
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
              {!location.state?.returnToDashboard && !returnToDashboardRef.current && (
                <>
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        setMenuOpened(false);
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
                <UnstyledButton onClick={() => {
                  setMenuOpened(false);
                  showEnquiryPreview(row.original);
                }}>
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
                    // setMenuOpened(false);
                    handleCancelEnquiry(row.original);
                  }}
                >
                  <Group gap={"sm"}>
                    <IconX size={16} style={{ color: "red" }} />
                    <Text size="sm" c="red">
                      Cancel
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
      filters,
      filtersApplied,
      fromDate,
      toDate,
      showEnquiryPreview,
      customerDisplayValue,
      originDisplayValue,
      destinationDisplayValue,
    ]
  );

  const table = useMantineReactTable({
    columns,
    data: displayData, // Use displayData for the table
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
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
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
          };
          break;
        case "enquiry_id":
          extraStyles = {
            minWidth: "70px",
          };
          break;
        case "customer_name":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "sales_person":
          extraStyles = {
            minWidth: "100px",
          };
          break;
        case "service_list":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "trade_list":
          extraStyles = {
            minWidth: "80px",
          };
          break;
        case "origin_list":
          extraStyles = {
            minWidth: "60px",
          };
          break;
        case "destination_list":
          extraStyles = {
            minWidth: "60px",
          };
          break;
        case "reference_no":
          extraStyles = {
            minWidth: "60px",
          };
          break;
        case "enquiry_received_date":
          extraStyles = {
            minWidth: "100px",
          };
          break;
        case "remark_list":
          extraStyles = {
            minWidth: "50px",
          };
          break;
        case "status":
          extraStyles = {
            minWidth: "70px",
          };
          break;

        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "6px 8px",
          fontSize: "13px",
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
            minWidth: "30px",
            zIndex: 2,
          };
          break;
        case "enquiry_id":
          extraStyles = {
            minWidth: "70px",
          };
          break;
        case "customer_name":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "sales_person":
          extraStyles = {
            minWidth: "70px",
          };
          break;
        case "service_list":
          extraStyles = {
            minWidth: "100px",
          };
          break;
        case "trade_list":
          extraStyles = {
            minWidth: "80px",
          };
          break;
        case "remark_list":
          extraStyles = {
            minWidth: "120px",
          };
          break;
        case "origin_list":
          extraStyles = {
            minWidth: "60px",
          };
          break;
        case "destination_list":
          extraStyles = {
            minWidth: "60px",
          };
          break;
        case "reference_no":
          extraStyles = {
            minWidth: "60px",
          };
          break;
        case "enquiry_received_date":
          extraStyles = {
            minWidth: "85px",
          };
          break;
        case "status":
          extraStyles = {
            minWidth: "70px",
          };
          break;

        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "6px 8px",
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
            {showPreviewTable ? "Preview Enquiries" : "Enquiry Lists"}
          </Text>

          <Group gap="sm" wrap="nowrap">
            {/* Always render primary controls */}
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
              color={"#105476"}
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={() => {
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
                navigate("/enquiry-create", {
                  state: {
                    preserveFilters: currentFilterState,
                    fromEnquiry: true, // Flag to indicate navigation from enquiry page
                  },
                });
              }}
            >
              Create New
            </Button>
            <Button
              variant={"outline"}
              color={"#105476"}
              size="xs"
              leftSection={<IconEye size={16} />}
              onClick={() => {
                if (showPreviewTable) {
                  closePreview();
                } else {
                  openPreview();
                }
              }}
            >
              {showPreviewTable ? "Summary View" : "Detailed View"}
            </Button>

            {/* Extra controls shown only in preview */}
            {showPreviewTable && user?.is_staff && (
              <>
                <Button
                  size="xs"
                  color="#105476"
                  loading={downloading}
                  variant={downloading ? "filled" : "outline"}
                  onClick={downloadExcel}
                >
                  Download
                </Button>
              </>
            )}
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
            // style={{
            // position: "absolute",
            // top: 45,
            // zIndex: 5,
            //   width: "calc(100% - 16px)",
            // }}
          >
            <Group justify="space-between" align="center">
              <Group align="center" gap="xs">
                <IconFilter size={16} color="#105476" />
                <Text size="sm" fw={500} c="#105476">
                  Filters
                </Text>
              </Group>
            </Group>

            {showPreviewTable ? (
              <Grid>
                <Grid.Col span={12}>
                  <Grid>
                    {/* Detailed view: 7 filters */}
                    <Grid.Col span={2}>
                      <SearchableSelect
                        size="xs"
                        label="Customer Name"
                        placeholder="Type customer name"
                        apiEndpoint={URL.customer}
                        searchFields={["customer_code", "customer_name"]}
                        displayFormat={(item: any) => ({
                          value: String(item.customer_code),
                          label: String(item.customer_name), // Show only customer name
                        })}
                        value={previewFilters.customer_name}
                        displayValue={previewCustomerDisplayValue}
                        onChange={(value, selectedData) => {
                          updatePreviewFilter("customer_name", value || null);
                          setPreviewCustomerDisplayValue(
                            selectedData?.label || null
                          );
                        }}
                        minSearchLength={3}
                        className="filter-searchable-select"
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Select
                        key={`preview-sales-person-${previewFilters.sales_person}`}
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
                        value={previewFilters.sales_person}
                        onChange={(value) =>
                          updatePreviewFilter("sales_person", value || null)
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
                    <Grid.Col span={4.8}>
                      <DateRangeInput
                        key={`preview-date-range-${previewFilters.enquiry_received_date?.getTime() || "null"}-${previewFilters.enquiry_received_date_to?.getTime() || "null"}`}
                        fromDate={previewFilters.enquiry_received_date}
                        toDate={previewFilters.enquiry_received_date_to}
                        onFromDateChange={(date) =>
                          updatePreviewFilter("enquiry_received_date", date)
                        }
                        onToDateChange={(date) =>
                          updatePreviewFilter("enquiry_received_date_to", date)
                        }
                        fromLabel="From Date"
                        toLabel="To Date"
                        size="xs"
                        allowDeselection={true}
                        showRangeInCalendar={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Select
                        key={`preview-terms-of-shipment-${previewFilters.terms_of_shipment}-${termsOfShipmentDataLoading}-${termsOfShipmentOptionsData.length}`}
                        label="Terms of Shipment"
                        placeholder={
                          termsOfShipmentDataLoading
                            ? "Loading terms..."
                            : "Select Terms"
                        }
                        searchable
                        clearable
                        size="xs"
                        data={termsOfShipmentOptionsData}
                        limit={10}
                        maxDropdownHeight={400}
                        nothingFoundMessage={
                          termsOfShipmentDataLoading
                            ? "Loading terms..."
                            : "No terms found"
                        }
                        disabled={termsOfShipmentDataLoading}
                        value={previewFilters.terms_of_shipment}
                        onChange={(value) =>
                          updatePreviewFilter(
                            "terms_of_shipment",
                            value || null
                          )
                        }
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
                    <Grid.Col span={2}>
                      <Select
                        key={`preview-service-${previewFilters.service}`}
                        label="Service"
                        placeholder="Select Service"
                        searchable
                        clearable
                        size="xs"
                        data={serviceOptions}
                        value={previewFilters.service}
                        onChange={(value) =>
                          updatePreviewFilter("service", value || null)
                        }
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
                    <Grid.Col span={2}>
                      <Select
                        key={`preview-trade-${previewFilters.trade}`}
                        label="Trade"
                        placeholder="Select Trade"
                        searchable
                        clearable
                        size="xs"
                        data={tradeOptions}
                        value={previewFilters.trade}
                        onChange={(value) =>
                          updatePreviewFilter("trade", value || null)
                        }
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
                    <Grid.Col span={2}>
                      <SearchableSelect
                        size="xs"
                        label="Origin Name"
                        placeholder="Type origin code or name"
                        apiEndpoint={URL.portMaster}
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: any) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={previewFilters.origin_name}
                        displayValue={previewOriginDisplayValue}
                        onChange={(value, selectedData) => {
                          updatePreviewFilter("origin_name", value || null);
                          setPreviewOriginDisplayValue(
                            selectedData?.label || null
                          );
                        }}
                        minSearchLength={3}
                        className="filter-searchable-select"
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <SearchableSelect
                        size="xs"
                        label="Destination Name"
                        placeholder="Type destination code or name"
                        apiEndpoint={URL.portMaster}
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: any) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={previewFilters.destination_name}
                        displayValue={previewDestinationDisplayValue}
                        onChange={(value, selectedData) => {
                          updatePreviewFilter(
                            "destination_name",
                            value || null
                          );
                          setPreviewDestinationDisplayValue(
                            selectedData?.label || null
                          );
                        }}
                        minSearchLength={3}
                        className="filter-searchable-select"
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Select
                        key={`preview-status-${previewFilters.status}`}
                        label="Status"
                        placeholder="Select Status"
                        searchable
                        clearable
                        size="xs"
                        data={statusOptions}
                        value={previewFilters.status}
                        onChange={(value) =>
                          updatePreviewFilter("status", value || "all")
                        }
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
                    <Grid.Col span={2}>
                      <TextInput
                        label="Enquiry ID"
                        placeholder="Enter enquiry ID"
                        size="xs"
                        value={previewFilters.enquiry_id || ""}
                        onChange={(e) =>
                          updatePreviewFilter(
                            "enquiry_id",
                            e.currentTarget.value || null
                          )
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
                    <Grid.Col span={2}>
                      <TextInput
                        label="Reference No"
                        placeholder="Enter reference number"
                        size="xs"
                        value={previewFilters.reference_no || ""}
                        onChange={(e) =>
                          updatePreviewFilter(
                            "reference_no",
                            e.currentTarget.value || null
                          )
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
                  </Grid>
                </Grid.Col>
              </Grid>
            ) : (
              <Grid>
                <Grid.Col span={12}>
                  <Grid>
                    {/* Customer Name (by code) */}
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
                      <SearchableSelect
                        size="xs"
                        label="Customer Name"
                        placeholder="Type customer name"
                        apiEndpoint={URL.customer}
                        searchFields={["customer_code", "customer_name"]}
                        displayFormat={(item: any) => ({
                          value: String(item.customer_code),
                          label: String(item.customer_name), // Show only customer name
                        })}
                        value={filters.customer_code}
                        displayValue={customerDisplayValue}
                        onChange={(value, selectedData) => {
                          updateFilter("customer_code", value || null);
                          setCustomerDisplayValue(selectedData?.label || null);
                        }}
                        minSearchLength={3}
                        className="filter-searchable-select"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
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
                          updateFilter("sales_person", value || null)
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
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
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
                          updateFilter("origin_code", value || null);
                          setOriginDisplayValue(selectedData?.label || null);
                        }}
                        minSearchLength={3}
                        className="filter-searchable-select"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
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
                          updateFilter("destination_code", value || null);
                          setDestinationDisplayValue(
                            selectedData?.label || null
                          );
                        }}
                        minSearchLength={3}
                        className="filter-searchable-select"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
                      <Select
                        key={`service-${filters.service}`}
                        label="Service"
                        placeholder="Select Service"
                        searchable
                        clearable
                        size="xs"
                        data={serviceOptions}
                        value={filters.service}
                        onChange={(value) =>
                          updateFilter("service", value || null)
                        }
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
                    <Grid.Col span={{ base: 12, md: 6, lg: 6, xl: 4.8 }}>
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

                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
                      <Select
                        key={`trade-${filters.trade}`}
                        label="Trade"
                        placeholder="Select Trade"
                        searchable
                        clearable
                        size="xs"
                        data={tradeOptions}
                        value={filters.trade}
                        onChange={(value) =>
                          updateFilter("trade", value || null)
                        }
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
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
                      <Select
                        key={`status-${filters.status}`}
                        label="Status"
                        placeholder="Select Status"
                        searchable
                        clearable
                        size="xs"
                        data={statusOptions}
                        value={filters.status}
                        onChange={(value) =>
                          updateFilter("status", value || "all")
                        }
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
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
                      <TextInput
                        label="Enquiry ID"
                        placeholder="Enter enquiry ID"
                        size="xs"
                        value={filters.enquiry_id || ""}
                        onChange={(e) =>
                          updateFilter(
                            "enquiry_id",
                            e.currentTarget.value || null
                          )
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
                    <Grid.Col span={{ base: 6, md: 4, lg: 3, xl: 2 }}>
                      <TextInput
                        label="Reference No"
                        placeholder="Enter reference number"
                        size="xs"
                        value={filters.reference_no || ""}
                        onChange={(e) =>
                          updateFilter(
                            "reference_no",
                            e.currentTarget.value || null
                          )
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
                  </Grid>
                </Grid.Col>
              </Grid>
            )}

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

        {isLoading || isPreviewLoading ? (
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

                {/* Preview Pagination - Show pagination for preview table too */}
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
                            const total = displayPreviewData?.total || 0;
                            if (total === 0) return "0–0 of 0";
                            const start =
                              (previewCurrentPage - 1) * previewPageSize + 1;
                            const end = Math.min(
                              previewCurrentPage * previewPageSize,
                              total
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
                            const total = displayPreviewData?.total || 0;
                            if (total === 0) return "0–0 of 0";
                            const start =
                              (previewCurrentPage - 1) * previewPageSize + 1;
                            const end = Math.min(
                              previewCurrentPage * previewPageSize,
                              total
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
                          Math.max(1, previewCurrentPage - 1)
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
                          (displayPreviewData?.total || 0) / previewPageSize
                        )
                      )}
                    </Text>
                    <ActionIcon
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil(
                            (displayPreviewData?.total || 0) / previewPageSize
                          )
                        );
                        handlePreviewPageChange(
                          Math.min(totalPages, previewCurrentPage + 1)
                        );
                      }}
                      disabled={(() => {
                        const totalPages = Math.max(
                          1,
                          Math.ceil(
                            (displayPreviewData?.total || 0) / previewPageSize
                          )
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
                          total
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
                          total
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
                      Math.ceil(listTotalRecords / listPageSize)
                    );
                    handlePageChange(Math.min(totalPages, listCurrentPage + 1));
                  }}
                  disabled={(() => {
                    const totalPages = Math.max(
                      1,
                      Math.ceil(listTotalRecords / listPageSize)
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
