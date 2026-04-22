import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  Button,
  Card,
  Group,
  Text,
  Center,
  Loader,
  Modal,
  Select,
  Stack,
  MultiSelect,
  SegmentedControl,
  ActionIcon,
  Menu,
  Box,
  UnstyledButton,
  Drawer,
  Flex,
  TextInput,
  Grid,
} from "@mantine/core";
import {
  IconPlus,
  IconUpload,
  IconUserPlus,
  IconDotsVertical,
  IconDownload,
  IconFile,
  IconX,
  IconFilter,
  IconFilterOff,
  IconSearch,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../api/serverUrls";
import { ToastNotification } from "../../components";
import PaginationBar from "../../components/PaginationBar/PaginationBar";
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

  const columns = useMemo<MRT_ColumnDef<PotentialCustomerData>[]>(() => {
    const baseColumns: MRT_ColumnDef<PotentialCustomerData>[] = [
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
        accessorKey: "customer",
        header: "Customer",
        size: 250,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "email_id",
        header: "Email Id",
        size: 200,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "commodity",
        header: "Commodity",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "ice",
        header: "Ice",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "pin",
        header: "Pin",
        size: 100,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "phone_no",
        header: "Phone No.",
        size: 130,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "contact_person",
        header: "Contact Person",
        size: 180,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "address",
        header: "Address",
        size: 200,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "city",
        header: "City",
        size: 150,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "state",
        header: "State",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "total_value",
        header: "Total Value",
        size: 120,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "total_quantity",
        header: "Total Quantity",
        size: 130,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
      {
        accessorKey: "unit",
        header: "Unit",
        size: 80,
        Cell: ({ cell }): string => String(cell.getValue() || "-"),
      },
    ];

    // Only add actions column when statusFilter is "assigned"
    if (statusFilter === "assigned") {
      baseColumns.push(
        {
          accessorKey: "assigned_to",
          header: "Assigned to",
          size: 130,
          Cell: ({ cell }): string => String(cell.getValue() || "-"),
        },
        {
          accessorKey: "created_at",
          header: "Assigned date",
          size: 100,
          Cell: ({ cell }): string => String(cell.getValue() || "-"),
        },
        {
          id: "actions",
          header: "Actions",
          size: 80,
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
                    onClick={() => handleCreateCallEntry(row.original)}
                  >
                    <Group gap={"sm"}>
                      <IconPlus size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Create call entry</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              </Menu.Dropdown>
            </Menu>
          ),
        }
      );
    }

    return baseColumns;
  }, [statusFilter, handleCreateCallEntry]);

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
              Potential Customers
            </Text>

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
                {/* <Button
                  variant="outline"
                  leftSection={<IconUpload size={16} />}
                  size="xs"
                  color="#105476"
                  onClick={uploadOpen}
                >
                  Upload
                </Button> */}
                {statusFilter === "unassigned" && (
                  <Button
                    variant="outline"
                    leftSection={<IconUserPlus size={16} />}
                    size="sm"
                    styles={{
                      root: {
                        borderRadius: "4px",
                        fontSize: "14px",
                        fontFamily: "Inter",
                        fontWeight: 600,
                        border: "1px solid #105476",
                        color: "#105476",
                        "&:hover": {
                          backgroundColor: "#E0F5FF",
                        },
                      },
                    }}
                    onClick={open}
                  >
                    Assign to salesperson
                  </Button>
                )}
              </>
            )}
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
              {/* Sales Person Filter - Only show when statusFilter is "assigned" and should be first */}
              {statusFilter === "assigned" && (
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
              )}

              {/* Customer Filter */}
              <Grid.Col span={2.4}>
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
              <Grid.Col span={2.4}>
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

              {/* State Filter */}
              <Grid.Col span={2.4}>
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

              {/* Commodity Filter */}
              <Grid.Col span={2.4}>
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

        {isLoading ? (
          <Center py="xl" style={{flex:1}}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading potential customers data...</Text>
            </Stack>
          </Center>
        ) : displayData.length === 0 ? (
          <Center py="xl" style={{flex:1}}>
            <Text c="dimmed" size="lg">
              No data available
            </Text>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />

            <Box
              w="100%"
              style={{ borderTop: "1px solid #e9ecef", flexShrink: 0 }}
              mt="sm"
            >
              <PaginationBar
                pageSize={pageSize}
                currentPage={currentPage}
                totalRecords={totalCount}
                onPageSizeChange={handlePageSizeChange}
                onPageChange={handlePageChange}
              />
            </Box>
          </>
        )}
      </Card>
    </>
  );
}

export default PotentialCustomers;
