import {
  Button,
  Group,
  Text,
  Modal,
  Select,
  Stack,
  MultiSelect,
  SegmentedControl,
  ActionIcon,
  Box,
  Drawer,
  Flex,
  TextInput,
  Grid,
  MantineProvider,
} from "@mantine/core";
import {
  IconPlus,
  IconUpload,
  IconUserPlus,
  IconDownload,
  IconFile,
  IconX,
  IconFilter,
  IconSearch,
  IconUsers,
  IconMail,
  IconPhone,
  IconListNumbers,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../api/serverUrls";
import {
  ToastNotification,
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_GEIST_ROOT_CLASS,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS,
  erpToolbarOutlineButtonStyles,
  type ErpListTheme,
  type ERPListColumnToggleItem,
} from "../../components";
import {
  PotentialCustomersListNativeTable,
  type PotentialCustomerTableRow,
  type PotentialCustomerVisibleColumns,
} from "./PotentialCustomersListNativeTable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_HEADER } from "../../store/storeKeys";
import { apiCallProtected } from "../../api/axios";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { getAPICall } from "../../service/getApiCall";
import useAuthStore from "../../store/authStore";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../store/listFilterStore";
import uploadImage from "../../assets/images/upload.png";
import {
  uploadPotentialCustomersCsv,
  downloadPotentialCustomersTemplate,
} from "../../service/csvUploadService";

// Extend User type to include is_manager
type UserWithManager = {
  is_manager?: boolean;
};

type PotentialCustomerData = {
  id: number;
  potential_id: string;
  customer: string;
  ctc_person: string;
  email_id: string;
  ctc_no: string;
  location: string;
  commodity: string;
  movements: string;
  air_sea: string;
  reference: string;
  remark: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_to?: string;
  customer_code?: string;
  ice?: string;
  pin?: string;
  phone_no?: string;
  contact_person?: string;
  iec_allotment_date?: string | null;
  ie_type?: string;
  date_of_establishment?: string;
  pan?: string;
  nature_of_concern?: string;
  address?: string;
  city?: string;
  state?: string;
  pin1?: string;
  trade_month?: string;
  total_value?: string;
  total_quantity?: string;
  unit?: string;
};

type PotentialCustomersResponse = {
  success: boolean;
  message: string;
  index: number;
  limit: number;
  total: number;
  pagination_total: number;
  data: PotentialCustomerData[];
};

type UserData = {
  id: number;
  user_id: string;
  user_name: string;
  employee_id: string;
  pulse_id: string | null;
  email_id: string;
  status: string;
};

type AssignFormValues = {
  potential_ids: string[];
  user_id: string;
};

type FilterState = {
  // customer_code: string | null; // Commented out
  customer: string | null;
  commodity: string | null;
  city: string | null;
  state: string | null;
  sales_person: string | null;
};

type CityData = {
  id: number;
  city_code: string;
  city_name: string;
  status: string;
};

type StateData = {
  id: number;
  state_code: string;
  state_name: string;
};

const LIST_KEY = "POTENTIAL_CUSTOMERS";

function PotentialCustomers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [uploadOpenFlag, { close: uploadClose }] = useDisclosure(false);
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [citySearchValue, setCitySearchValue] = useState("");
  const [debouncedCitySearch] = useDebouncedValue(citySearchValue, 400);
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const [debouncedCustomerSearch] = useDebouncedValue(customerSearchValue, 400);
  const [customerOptions, setCustomerOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [customerOptionsLoading, setCustomerOptionsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500);
  const hasRestoredFromStore = useRef(false);
  const location = useLocation();

  const [potentialVisibleColumns, setPotentialVisibleColumns] =
    useState<PotentialCustomerVisibleColumns>({
      sno: true,
      customer: true,
      email_id: true,
      commodity: true,
      ice: true,
      pin: true,
      phone_no: true,
      contact_person: true,
      address: true,
      city: true,
      state: true,
      total_value: true,
      total_quantity: true,
      unit: true,
      assigned_to: true,
      created_at: true,
    });

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const clearStoreAll = useListFilterStore((state) => state.clearAll);
  const clearStoreAllExcept = useListFilterStore((state) => state.clearAllExcept);

  const form = useForm<AssignFormValues>({
    initialValues: {
      potential_ids: [],
      user_id: "",
    },
    validate: {
      potential_ids: (value) =>
        value.length === 0 ? "Please select at least one customer" : null,
      user_id: (value) => (!value ? "Please select a salesperson" : null),
    },
  });

  const filterForm = useForm<FilterState>({
    initialValues: {
      // customer_code: null, // Commented out
      customer: null,
      commodity: null,
      city: null,
      state: null,
      sales_person: null,
    },
  });

  useEffect(() => {
    if ((user?.is_manager || user?.is_staff) && location.state?.statusFilter !== "assigned") {
      setStatusFilter("unassigned");
    } else {
      setStatusFilter("assigned");
    }
  }, [user]);

  // Reset pagination when status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Clear salesperson filter when statusFilter changes to "unassigned"
  useEffect(() => {
    if (statusFilter === "unassigned") {
      filterForm.setFieldValue("sales_person", null);
    }
  }, [statusFilter, filterForm]);

  // Clear other keys in store on mount (keep only current LIST_KEY)
  useEffect(() => {
    clearStoreAllExcept(LIST_KEY);
  }, []);

  // Restore filters and search from store on mount
  useEffect(() => {
    if (hasRestoredFromStore.current) return;
    if (!statusFilter) return; // Wait for statusFilter to be set

    const restoredState = useListFilterStore.getState().getState(LIST_KEY);
    
    const performRestore = async () => {
      if (!restoredState) {
        return; // No stored state, use defaults
      }
      
      // Restore filters
      let hasFilters = false;
      const restoredFilters = restoredState.filters as FilterState;
      if (restoredFilters && Object.keys(restoredFilters).length > 0) {
        filterForm.setValues(restoredFilters);
        hasFilters = Boolean(
          restoredFilters.customer ||
          restoredFilters.commodity ||
          restoredFilters.city ||
          restoredFilters.state ||
          restoredFilters.sales_person
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

      // Set filtersApplied if we have filters or search
      if (hasFilters || hasSearch) {
        setFiltersApplied(true);
        // Invalidate query to trigger refetch with restored filters/search
        queryClient.invalidateQueries({
          queryKey: ["filteredPotentialCustomers"],
        });
      }
    };
    if(restoredState?.shouldRestore){
      performRestore();
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Helper function to save filters and search to store
  const saveFiltersToStore = useCallback(() => {
    const filtersWithValues = {
      ...filterForm.values,
    };
    setStoreFilters(LIST_KEY, filtersWithValues);
    setStoreSearch(LIST_KEY, searchQuery);
  }, [filterForm.values, searchQuery, setStoreFilters, setStoreSearch]);

  // Fetch customer options for customer filter (server-side search)
  useEffect(() => {
    const term = debouncedCustomerSearch.trim();
    if (!term) {
      setCustomerOptions([]);
      return;
    }

    let cancelled = false;
    setCustomerOptionsLoading(true);
    apiCallProtected
      .post("potential/filter/?index=0&limit=25", {
        filters: { customer: term },
      })
      .then((res: any) => {
        if (cancelled) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        const unique = Array.from(
          new Set(
            rows
              .map((r: any) => String(r?.customer ?? "").trim())
              .filter(Boolean),
          ),
        );
        setCustomerOptions(unique.map((c) => ({ value: String(c), label: String(c) })));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Error fetching customer options:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch customers";
        ToastNotification({
          type: "error",
          message: `Error fetching customers: ${errorMessage}`,
        });
        setCustomerOptions([]);
      })
      .finally(() => {
        if (!cancelled) setCustomerOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedCustomerSearch]);


  // Fetch potential customers data using useQuery
  const {
    data: potentialCustomersData = [],
    isLoading: potentialCustomersLoading,
  } = useQuery({
    queryKey: ["potentialCustomers", statusFilter, currentPage, pageSize],
    queryFn: async () => {
      try {
        // Create filter payload based on status only
        const filterPayload = {
          filters: {
            status: statusFilter === "unassigned" ? "un-assigned" : "assigned",
          },
        };

        // Add pagination parameters to URL (convert to 0-based index)
        const paginationParams = new URLSearchParams({
          index: ((currentPage - 1) * pageSize).toString(),
          limit: pageSize.toString(),
        });

        const response = (await apiCallProtected.post(
          `${URL.potentialCustomers}?${paginationParams.toString()}`,
          filterPayload
        )) as PotentialCustomersResponse;

        if (response && response.success && Array.isArray(response.data)) {
          // Update total count for pagination
          setTotalCount(response.total || 0);
          return response.data;
        }

        return [];
      } catch (err: unknown) {
        console.error("Error fetching potential customers:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to fetch potential customers";
        ToastNotification({
          type: "error",
          message: `Error fetching potential customers: ${errorMessage}`,
        });
        return [];
      }
    },
    enabled: !!statusFilter,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // // State to store the actual applied filter values
  // const [appliedFilters, setAppliedFilters] = useState<FilterState>({
  //   customer_name: null,
  //   commodity: null,
  //   city: null,
  //   state: null,
  // });

  // // Separate query for filtered data - only runs when filters are applied
  // const {
  //   data: filteredPotentialCustomersData = [],
  //   isLoading: filteredPotentialCustomersLoading,
  //   refetch: refetchFilteredPotentialCustomers,
  // } = useQuery({
  //   queryKey: [
  //     "filteredPotentialCustomers",
  //     filtersApplied,
  //     appliedFilters,
  //     statusFilter,
  //   ],
  //   queryFn: async () => {
  //     try {
  //       if (!filtersApplied) return [];

  //       const baseFilters: Record<string, string> = {
  //         status: statusFilter === "unassigned" ? "un-assigned" : "assigned",
  //       };

  //       // Add additional filters if they have values
  //       if (appliedFilters.customer_name) {
  //         baseFilters.customer_name = appliedFilters.customer_name;
  //       }
  //       if (appliedFilters.commodity) {
  //         baseFilters.commodity = appliedFilters.commodity;
  //       }
  //       if (appliedFilters.city) {
  //         baseFilters.city = appliedFilters.city;
  //       }
  //       if (appliedFilters.state) {
  //         baseFilters.state = appliedFilters.state;
  //       }

  //       if (Object.keys(baseFilters).length === 1) return []; // Only status filter

  //       const filterPayload = { filters: baseFilters };

  //       const response = (await apiCallProtected.post(
  //         URL.potentialCustomers,
  //         filterPayload,
  //         API_HEADER
  //       )) as PotentialCustomersResponse;

  //       if (response && response.success && Array.isArray(response.data)) {
  //         return response.data;
  //       }

  //       return [];
  //     } catch (err: unknown) {
  //       console.error("Error fetching filtered potential customers:", err);
  //       const errorMessage =
  //         err instanceof Error
  //           ? err.message
  //           : "Failed to fetch filtered potential customers";
  //       ToastNotification({
  //         type: "error",
  //         message: `Error fetching filtered potential customers: ${errorMessage}`,
  //       });
  //       return [];
  //     }
  //   },
  //   enabled: false, // Don't run automatically - only when Apply Filters is clicked
  //   staleTime: 5 * 60 * 1000, // 5 minutes
  //   refetchOnWindowFocus: false,
  // });

  // Fetch user master data for salesperson dropdown
  const { data: usersData = [] } = useQuery({
    queryKey: ["userMaster"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.user, API_HEADER)) as UserData[];
        return Array.isArray(response) ? response : [];
      } catch (err: unknown) {
        console.error("Error fetching user master:", err);
        ToastNotification({
          type: "error",
          message: `Error fetching user data: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredPotentialCustomersData = [],
    isLoading: filteredPotentialCustomersLoading,
  } = useQuery({
    queryKey: [
      "filteredPotentialCustomers",
      statusFilter,
      currentPage,
      pageSize,
      filtersApplied,
      debouncedSearch,
      // Remove filterForm.values from queryKey to prevent auto-triggering
    ],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        // Create filter payload with additional filters
        const baseFilters: Record<string, string> = {
          status: statusFilter === "unassigned" ? "un-assigned" : "assigned",
        };

        // Add additional filters if they have values
        // if (filterForm.values.customer_code) {
        //   baseFilters.customer_code = filterForm.values.customer_code;
        // }
        if (filterForm.values.customer) {
          baseFilters.customer = filterForm.values.customer;
        }
        if (filterForm.values.commodity) {
          baseFilters.commodity = filterForm.values.commodity;
        }
        if (filterForm.values.city) {
          baseFilters.city = filterForm.values.city;
        }
        if (filterForm.values.state) {
          baseFilters.state = filterForm.values.state;
        }
        // Only include salesperson filter when statusFilter is "assigned"
        if (statusFilter === "assigned" && filterForm.values.sales_person) {
          baseFilters.assigned_to = filterForm.values.sales_person;
        }
        // Add search value to filters if it exists
        if (debouncedSearch.trim()) {
          baseFilters.search = debouncedSearch.trim();
        }

        const filterPayload = { filters: baseFilters };

        // Add pagination parameters to URL (convert to 0-based index)
        const paginationParams = new URLSearchParams({
          index: ((currentPage - 1) * pageSize).toString(),
          limit: pageSize.toString(),
        });

        const response = (await apiCallProtected.post(
          `${URL.potentialCustomers}?${paginationParams.toString()}`,
          filterPayload
        )) as PotentialCustomersResponse;

        if (response && response.success && Array.isArray(response.data)) {
          // Update total count for pagination
          setTotalCount(response.total || 0);
          return response.data;
        }

        return [];
      } catch (err: unknown) {
        console.error("Error fetching filtered potential customers:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to fetch filtered potential customers";
        ToastNotification({
          type: "error",
          message: `Error fetching filtered potential customers: ${errorMessage}`,
        });
        return [];
      }
    },
    enabled: !!statusFilter && (filtersApplied || debouncedSearch.trim() !== ""),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Trigger filtered API when debounced search changes
  useEffect(() => {
    if (debouncedSearch.trim() !== "") {
      setFiltersApplied(true);
      setCurrentPage(1);
      // Save to store when search changes
      saveFiltersToStore();
      queryClient.invalidateQueries({
        queryKey: ["filteredPotentialCustomers"],
      });
    } else if (debouncedSearch.trim() === "" && filtersApplied) {
      // Check if there are other filters applied
      const hasOtherFilters =
        filterForm.values.commodity ||
        filterForm.values.city ||
        filterForm.values.state ||
        (statusFilter === "assigned" && filterForm.values.sales_person);
      
      // Save to store (with cleared search)
      saveFiltersToStore();
      
      if (!hasOtherFilters) {
        setFiltersApplied(false);
        queryClient.invalidateQueries({
          queryKey: ["potentialCustomers"],
        });
      } else {
        // Still have other filters, just refetch filtered data
        queryClient.invalidateQueries({
          queryKey: ["filteredPotentialCustomers"],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Fetch city data with search functionality - only when user searches
  const { data: citiesData = [] } = useQuery({
    queryKey: ["cities", debouncedCitySearch],
    queryFn: async () => {
      try {
        const searchParam = debouncedCitySearch.trim()
          ? `?search=${encodeURIComponent(debouncedCitySearch.trim())}`
          : "";

        const response = (await getAPICall(
          `${URL.city}${searchParam}`,
          API_HEADER
        )) as {
          success: boolean;
          message: string;
          data: CityData[];
        };
        return Array.isArray(response.data) ? response.data : [];
      } catch (err: unknown) {
        console.error("Error fetching cities:", err);
        ToastNotification({
          type: "error",
          message: `Error fetching cities: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return [];
      }
    },
    enabled: debouncedCitySearch.trim().length > 0, // Only fetch when user searches
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch state data with memoization
  const { data: statesData = [] } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.state, API_HEADER)) as {
          success: boolean;
          message: string;
          data: StateData[];
        };
        return Array.isArray(response.data) ? response.data : [];
      } catch (err: unknown) {
        console.error("Error fetching states:", err);
        ToastNotification({
          type: "error",
          message: `Error fetching states: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - longer cache for static data
    refetchOnWindowFocus: false,
  });

  // Memoize city and state options for better performance
  const cityOptions = useMemo(() => {
    return citiesData.map((city) => ({
      value: city.city_name,
      label: city.city_name,
    }));
  }, [citiesData]);

  const stateOptions = useMemo(() => {
    return statesData.map((state) => ({
      value: state.state_name,
      label: state.state_name,
    }));
  }, [statesData]);

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

  // Function to apply filters manually
  const applyFilters = useCallback(async () => {
    try {
      // Check if there are any actual filter values (excluding search, which is handled separately)
      // Exclude sales_person when statusFilter is "unassigned"
      const hasFilterValues =
        filterForm.values.customer ||
        filterForm.values.commodity ||
        filterForm.values.city ||
        filterForm.values.state ||
        (statusFilter === "assigned" && filterForm.values.sales_person) ||
        debouncedSearch.trim() !== "";

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setCurrentPage(1); // Reset to first page
        // Clear store when no filters
        clearStoreFilters(LIST_KEY);
        clearStoreSearch(LIST_KEY);
        return;
      }

      // Mark filters as applied and reset to first page
      setFiltersApplied(true);
      setCurrentPage(1);

      // Save filters and search to store
      saveFiltersToStore();

      // Invalidate and refetch the filtered query
      await queryClient.invalidateQueries({
        queryKey: ["filteredPotentialCustomers"],
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
  }, [filterForm.values, statusFilter, queryClient, debouncedSearch, saveFiltersToStore, clearStoreFilters, clearStoreSearch]);

  // Function to clear all filters
  const clearAllFilters = useCallback(async () => {
    try {
      setShowFilters(false);

      filterForm.reset(); // Reset form to initial values
      setCustomerSearchValue("");
      setCustomerOptions([]);
      setSearchQuery(""); // Clear search
      setFiltersApplied(false); // Reset filters applied state
      setCurrentPage(1); // Reset to first page

      // Clear filters and search from store
      clearStoreFilters(LIST_KEY);
      clearStoreSearch(LIST_KEY);

      // Invalidate queries and refetch unfiltered data
      await queryClient.invalidateQueries({ queryKey: ["potentialCustomers"] });
      await queryClient.invalidateQueries({
        queryKey: ["filteredPotentialCustomers"],
      });

      ToastNotification({
        type: "success",
        message: "All filters cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing filters:", error);
    }
  }, [filterForm, queryClient, clearStoreFilters, clearStoreSearch]);

  // Determine which data to display
  const displayData = useMemo(() => {
    // Check if we have filtered data (filters were applied or search exists)
    if (filtersApplied || debouncedSearch.trim() !== "") {
      return filteredPotentialCustomersData;
    }
    return potentialCustomersData;
  }, [potentialCustomersData, filteredPotentialCustomersData, filtersApplied, debouncedSearch]);

  // Loading state
  const isLoading = useMemo(() => {
    if (filtersApplied || debouncedSearch.trim() !== "") {
      return filteredPotentialCustomersLoading;
    }
    return potentialCustomersLoading;
  }, [
    potentialCustomersLoading,
    filteredPotentialCustomersLoading,
    filtersApplied,
    debouncedSearch,
  ]);

  const handleCreateCallEntry = useCallback(
    (customerData: PotentialCustomerData) => {
      useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
      // Navigate to call entry create page with customer data
      navigate("/call-entry-create", {
        state: {
          returnTo:"/potential-customers",
          fromPotentialCustomer: true,
          statusFilter: "assigned",
          customerCode: customerData.customer_code || customerData.potential_id,
          customerName: customerData.customer,
          customerData: customerData,
        },
      });
    },
    [navigate]
  );

  // File validation function
  const validateFile = (file: File): boolean => {
    const allowedTypes = ["text/csv", "application/csv"];
    const allowedExtensions = [".csv"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    return (
      allowedTypes.includes(file.type) ||
      allowedExtensions.includes(fileExtension)
    );
  };

  // Handle file upload
  const handleFileUpload = (file: File) => {
    setFileError(null);

    if (!validateFile(file)) {
      setFileError("Only CSV files are allowed");
      return;
    }
    // console.log("fileeeeeee----", file);

    setUploadedFile(file);
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileError(null);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!uploadedFile) {
      setFileError("Please upload a CSV file");
      return;
    }

    if (!validateFile(uploadedFile)) {
      setFileError("Only CSV files are allowed");
      return;
    }

    try {
      console.log("Uploading file:", uploadedFile);

      const response = await uploadPotentialCustomersCsv(uploadedFile);

      if (response.success) {
        ToastNotification({
          type: "success",
          message: response.message,
        });

        // Invalidate and refetch the potential customers query to update the list
        await queryClient.invalidateQueries({
          queryKey: ["potentialCustomers"],
        });

        // Reset form
        setUploadedFile(null);
        setFileError(null);
        uploadClose();
      } else {
        ToastNotification({
          type: "error",
          message: response.message,
        });
      }
    } catch (error: unknown) {
      console.error("Upload error:", error);
      ToastNotification({
        type: "error",
        message: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  };

  async function downloadTemplate() {
    try {
      const blob = await downloadPotentialCustomersTemplate();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "potential_customers_template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      ToastNotification({
        type: "success",
        message: "Template downloaded successfully",
      });
    } catch (error: unknown) {
      console.error("Download template error:", error);
      ToastNotification({
        type: "error",
        message: `Failed to download template: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  // // Filter functions
  // const applyFilters = async () => {
  //   try {
  //     console.log("Applying filters...");
  //     console.log("Current filters:", filterForm.values);

  //     // Check if there are any actual filter values
  //     const hasFilterValues =
  //       filterForm.values.customer_name ||
  //       filterForm.values.commodity ||
  //       filterForm.values.city ||
  //       filterForm.values.state;

  //     if (!hasFilterValues) {
  //       // If no filter values, show unfiltered data
  //       setFiltersApplied(false);
  //       setAppliedFilters({
  //         customer_name: null,
  //         commodity: null,
  //         city: null,
  //         state: null,
  //       });

  //       // Invalidate and refetch unfiltered data
  //       await queryClient.invalidateQueries({
  //         queryKey: ["potentialCustomers"],
  //       });
  //       await refetchPotentialCustomers();

  //       console.log("No filter values provided, showing unfiltered data");
  //       return;
  //     }

  //     setFiltersApplied(true); // Mark filters as applied

  //     // Store the current filter form values as applied filters
  //     setAppliedFilters({
  //       customer_name: filterForm.values.customer_name,
  //       commodity: filterForm.values.commodity,
  //       city: filterForm.values.city,
  //       state: filterForm.values.state,
  //     });

  //     // Enable the filtered query and refetch
  //     await queryClient.invalidateQueries({
  //       queryKey: ["filteredPotentialCustomers"],
  //     });
  //     await refetchFilteredPotentialCustomers();

  //     console.log("Filters applied successfully");
  //   } catch (error) {
  //     console.error("Error applying filters:", error);
  //   }
  // };

  // const clearAllFilters = async () => {
  //   filterForm.reset(); // Reset form to initial values
  //   setFiltersApplied(false); // Reset filters applied state

  //   // Reset applied filters state
  //   setAppliedFilters({
  //     customer_name: null,
  //     commodity: null,
  //     city: null,
  //     state: null,
  //   });

  //   // Invalidate queries and refetch unfiltered data
  //   await queryClient.invalidateQueries({ queryKey: ["potentialCustomers"] });
  //   await queryClient.invalidateQueries({
  //     queryKey: ["filteredPotentialCustomers"],
  //   });
  //   await queryClient.removeQueries({
  //     queryKey: ["filteredPotentialCustomers"],
  //   }); // Remove filtered data from cache
  //   await refetchPotentialCustomers();

  //   ToastNotification({
  //     type: "success",
  //     message: "All filters cleared successfully",
  //   });
  // };

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

  const potentialPageStats = useMemo(() => {
    let withEmail = 0;
    let withPhone = 0;
    for (const r of displayData) {
      if (r.email_id && String(r.email_id).trim()) withEmail += 1;
      const ph = r.phone_no || r.ctc_no;
      if (ph && String(ph).trim()) withPhone += 1;
    }
    return { withEmail, withPhone };
  }, [displayData]);

  const potentialTableRows: PotentialCustomerTableRow[] = useMemo(
    () =>
      displayData.map((r, i) => ({
        ...r,
        sno: (currentPage - 1) * pageSize + i + 1,
      })),
    [displayData, currentPage, pageSize]
  );

  const potentialColumnToggleItems: ERPListColumnToggleItem[] = useMemo(
    () => {
      const labelMap: Record<keyof PotentialCustomerVisibleColumns, string> = {
        sno: "S.No",
        customer: "Customer",
        email_id: "Email",
        commodity: "Commodity",
        ice: "Ice",
        pin: "Pin",
        phone_no: "Phone",
        contact_person: "Contact Person",
        address: "Address",
        city: "City",
        state: "State",
        total_value: "Total Value",
        total_quantity: "Total Qty",
        unit: "Unit",
        assigned_to: "Assigned to",
        created_at: "Assigned date",
      };
      return (
        Object.keys(labelMap) as (keyof PotentialCustomerVisibleColumns)[]
      ).map((id) => ({
        id: id as string,
        label: labelMap[id],
        checked: potentialVisibleColumns[id] !== false,
        onToggle: () =>
          setPotentialVisibleColumns((p) => ({ ...p, [id]: !p[id] })),
      }));
    },
    [potentialVisibleColumns]
  );

  const tableLoading = isLoading;
  const assignedListMode = statusFilter === "assigned";

  const handleAssign = async (values: AssignFormValues) => {
    setIsAssigning(true);
    try {
      // Create payload in the required format
      const payload = {
        user_id: parseInt(values.user_id),
        potential_ids: values.potential_ids.map((id) => parseInt(id)),
      };

      // Call the API
      await apiCallProtected.post(URL.userPotentialMaster, payload, API_HEADER);

      ToastNotification({
        type: "success",
        message: "Customers assigned to salesperson successfully",
      });

      // Invalidate and refetch the potential customers queries to update the list
      await queryClient.invalidateQueries({
        queryKey: ["potentialCustomers"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["filteredPotentialCustomers"],
      });

      // Reset form and close modal
      form.reset();
      close();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: `Error assigning customers: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <>
      <Drawer
            opened={uploadOpenFlag}
            onClose={uploadClose}
            title="Potential Customers Bulk Upload"
            position="right"
            size="70%"
            // p={"xl"}
          >
            <Stack gap="xl" p="xl">
              <Flex gap="xl" align="flex-start" wrap="wrap">
                {/* Bulk Upload Section */}
                <Box
                  // flex={1}
                  style={{ minWidth: 320 }}
                >
                  <Group justify="space-between" align="center" mb="md">
                    <Text fw={600} size="lg">
                      Bulk Upload
                    </Text>
                    <Button
                      variant="subtle"
                      c="#105476"
                      leftSection={<IconDownload size={14} />}
                      styles={{
                        root: {
                          padding: 0,
                          height: "auto",
                          backgroundColor: "transparent",
                          "&:hover": { backgroundColor: "transparent" },
                        },
                      }}
                    >
                      <Text
                        td="underline"
                        c="#105476"
                        size="sm"
                        onClick={() => downloadTemplate()}
                      >
                        Download Template
                      </Text>
                    </Button>
                  </Group>

                  {/* Upload Box */}
                  <Box
                    component="label"
                    htmlFor="file-upload"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      border: `3px dashed ${dragActive ? "#0A74A6" : "#105476"}`,
                      borderRadius: "8px",
                      padding: "3rem 7rem",
                      textAlign: "center",
                      backgroundColor: dragActive ? "#f0f8ff" : "#fafafa",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={uploadImage}
                      alt="Upload"
                      style={{
                        width: "60px",
                        height: "60px",
                        marginBottom: "1rem",
                      }}
                    />

                    <Text size="sm" mb="xs" c="dark">
                      Drag and drop here or{" "}
                      <span
                        style={{
                          color: "#105476",
                          textDecoration: "underline",
                          fontWeight: 500,
                        }}
                      >
                        Browse File
                      </span>
                    </Text>

                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      style={{ display: "none" }}
                      onChange={handleInputChange}
                    />

                    <Text size="xs" c="dimmed">
                      Supports: .csv format only
                    </Text>
                  </Box>
                </Box>

                {/* Uploaded File Section - Only show when file is uploaded */}
                {uploadedFile && (
                  <Box flex={1} style={{ minWidth: 300 }}>
                    <Text fw={600} size="lg" mb="md">
                      Uploaded File
                    </Text>

                    <Box
                      style={{
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        padding: "1rem",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <Group justify="space-between" align="center">
                        <Group gap="sm" wrap="nowrap">
                          <IconFile color="#105476" size={24} />
                          <Box>
                            <Text size="sm" fw={500} c="dark">
                              {uploadedFile.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              ({(uploadedFile.size / 1024).toFixed(2)} KB)
                            </Text>
                          </Box>
                        </Group>
                        <ActionIcon
                          variant="transparent"
                          color="gray"
                          size="sm"
                          onClick={handleRemoveFile}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  </Box>
                )}
              </Flex>

              {/* Error Display */}
              {fileError && (
                <Box
                  style={{
                    backgroundColor: "#fee",
                    border: "1px solid #fcc",
                    borderRadius: "8px",
                    padding: "1rem",
                  }}
                >
                  <Text size="sm" c="red">
                    {fileError}
                  </Text>
                </Box>
              )}

              {/* Action Buttons */}
              <Group justify="flex-end" gap="sm" mt="xl">
                <Button variant="outline" color="#105476" onClick={uploadClose}>
                  Cancel
                </Button>
                <Button
                  color="#105476"
                  leftSection={<IconUpload size={16} />}
                  onClick={handleSubmit}
                >
                  Submit
                </Button>
              </Group>
            </Stack>
          </Drawer>
          <Modal
            opened={opened}
            onClose={close}
            title="Assign Customers to Salesperson"
            centered
            size="md"
          >
            <form onSubmit={form.onSubmit(handleAssign)}>
              <Stack gap="md">
                <MultiSelect
                  label="Customer Names"
                  placeholder="Select customers"
                  data={displayData.map((customer) => ({
                    value: customer.id.toString(),
                    label: customer.customer,
                  }))}
                  {...form.getInputProps("potential_ids")}
                  searchable
                  clearable
                  required
                />

                <Select
                  label="Salesperson"
                  placeholder="Select a salesperson"
                  data={usersData
                    .filter((user) => user.status === "ACTIVE")
                    .map((user) => ({
                      value: user.id.toString(),
                      label: user.user_name,
                    }))}
                  {...form.getInputProps("user_id")}
                  searchable
                  clearable
                  required
                />

                <Group justify="flex-end" gap="sm" mt="md">
                  <Button
                    variant="outline"
                    onClick={close}
                    disabled={isAssigning}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    color="#105476"
                    loading={isAssigning}
                    disabled={isAssigning}
                  >
                    Assign
                  </Button>
                </Group>
              </Stack>
            </form>
          </Modal>

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
                    value={totalCount}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconListNumbers size={14} color="#105476" />}
                    iconBackground="#dbeafe"
                    iconColor="#105476"
                    value={displayData.length}
                    label="On page"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconMail size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={potentialPageStats.withEmail}
                    label="With email"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconPhone size={14} color="#d97706" />}
                    iconBackground="#fef3c7"
                    iconColor="#d97706"
                    value={potentialPageStats.withPhone}
                    label="With phone"
                  />
                </>
              ),
              secondary: (
                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                  Potential Customers
                </Text>
              ),
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
                            clearStoreSearch(LIST_KEY);
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
                    items={potentialColumnToggleItems}
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
                  {((user as UserWithManager)?.is_manager || user?.is_staff) && (
                    <>
                      <SegmentedControl
                        value={statusFilter}
                        onChange={(value) =>
                          setStatusFilter(value as "assigned" | "unassigned")
                        }
                        data={[
                          { label: "Assigned", value: "assigned" },
                          { label: "Unassigned", value: "unassigned" },
                        ]}
                        size="xs"
                        color="#105476"
                      />
                      {statusFilter === "unassigned" && (
                        <Button
                          variant="outline"
                          size="xs"
                          leftSection={<IconUserPlus size={16} />}
                          styles={erpToolbarOutlineButtonStyles(erpTheme)}
                          onClick={open}
                        >
                          Assign to salesperson
                        </Button>
                      )}
                    </>
                  )}
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: "Refine by customer, location, or salesperson",
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
              {/* Sales Person Filter - Only show when statusFilter is "assigned" and should be first */}
              {statusFilter === "assigned" && (
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                  <Box style={erpListFilterFieldCellStyle}>
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
                      filterForm.setFieldValue(
                        "sales_person",
                        value || null
                      )
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
              )}

              {/* Customer Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <Select
                  label="Customer"
                  placeholder="Type customer name"
                  size="xs"
                  data={customerOptions}
                  value={filterForm.values.customer}
                  onChange={(value) =>
                    filterForm.setFieldValue("customer", value || null)
                  }
                  searchable
                  clearable
                  searchValue={customerSearchValue}
                  onSearchChange={setCustomerSearchValue}
                  nothingFoundMessage={
                    customerSearchValue.trim().length === 0
                      ? "Type to search customers"
                      : customerOptionsLoading
                        ? "Searching..."
                        : "No customers found"
                  }
                  disabled={customerOptionsLoading && customerOptions.length === 0}
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

                  {/* Customer Name Filter - Commented out */}
                  {/* <Grid.Col span={2.4}>
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
                      value={filterForm.values.customer_code}
                      onChange={(value) =>
                        filterForm.setFieldValue("customer_code", value || "")
                      }
                      minSearchLength={2}
                    />
                  </Grid.Col> */}

              {/* City Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <Select
                  label="City"
                  placeholder="Type to search city"
                  size="xs"
                  data={cityOptions}
                  value={filterForm.values.city}
                  onChange={(value) =>
                    filterForm.setFieldValue("city", value)
                  }
                  searchable
                  clearable
                  searchValue={citySearchValue}
                  onSearchChange={setCitySearchValue}
                  nothingFoundMessage={
                    citySearchValue.trim().length === 0
                      ? "Type to search cities"
                      : "No cities found"
                  }
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* State Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <Select
                  label="State"
                  placeholder="Select State"
                  size="xs"
                  data={stateOptions}
                  value={filterForm.values.state}
                  onChange={(value) =>
                    filterForm.setFieldValue("state", value)
                  }
                  searchable
                  clearable
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Commodity Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Commodity"
                  placeholder="Search Commodity"
                  size="xs"
                  value={filterForm.values.commodity || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "commodity",
                      e.currentTarget.value || null
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
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
                  totalRecords={totalCount}
                  pageIndex={currentPage - 1}
                  pageSize={pageSize}
                  onPageIndexChange={(idx) => setCurrentPage(idx + 1)}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={["10", "15", "25", "50"]}
                  selectClassNames={{
                    dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                    option: ERP_LIST_GEIST_ROOT_CLASS,
                  }}
                />
              ),
              children: tableLoading ? (
                <ERPListTableLoading
                  theme={erpTheme}
                  message="Loading potential customers…"
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
                  <PotentialCustomersListNativeTable
                    theme={erpTheme}
                    rows={potentialTableRows}
                    visible={potentialVisibleColumns}
                    isEmpty={displayData.length === 0}
                    assignedMode={assignedListMode}
                    onCreateCallEntry={handleCreateCallEntry}
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

export default PotentialCustomers;
