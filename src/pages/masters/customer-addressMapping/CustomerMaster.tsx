import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastNotification } from "../../../components";
import { URL } from "../../../api/serverUrls";
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
  Center,
  Loader,
  Select,
  Stack,
  Modal,
  Drawer,
  Divider,
  Grid,
  TextInput,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconFilter,
  IconFilterOff,
  IconSearch,
} from "@tabler/icons-react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useForm } from "@mantine/form";
import { SearchableSelect } from "../../../components";
import dayjs from "dayjs";

type AddressData = {
  customer_location: string;
  address_type: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone_no: string;
  mobile_no: string;
  email: string;
  latitude?: number;
  longitude?: number;
};

type CustomerData = {
  id: number;
  customer_code: string;
  customer_name: string;
  customer_type?: string;
  status: string;
  term_code?: string;
  own_office?: boolean;
  assigned_to?: string | null;
  assigned_to_display?: string | null;
  addresses_data?: AddressData[];
};

type CustomerApiResponse = {
  success: boolean;
  message: string;
  total: number;
  filters_total_count?: number;
  index: number;
  limit: number;
  pagination_total: number;
  data: CustomerData[];
};

type FilterState = {
  customer_name: string | null;
  customer_type: string | null;
  assigned_to_display: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  status: string | null;
};

type CountryData = {
  country_code: string;
  country_name: string;
  status: string;
};

type StateData = {
  id: number;
  state_code: string;
  state_name: string;
  status: string;
  country_code: string;
  country_name: string;
};

type CustomerTypeData = {
  id: number;
  customer_type_code: string;
  customer_type_name: string;
  status: string;
};

type SalespersonData = {
  id: number;
  sales_person: string;
  sales_coordinator: string;
  customer_service: string;
};

type QuotationData = {
  id: number;
  enquiry_id: string;
  customer_name: string;
  enquiry_received_date: string;
  origin_name: string;
  destination_name: string;
  sales_person: string;
  quote_currency: string;
  valid_upto: string;
  multi_carrier: boolean;
  quote_type: string;
  carrier_name: string;
  charges: Array<{
    id: number;
    currency: string;
    charge_name: string;
    roe: string;
    unit: string;
    no_of_units: number;
    sell_per_unit: string;
    min_sell: string | null;
    cost_per_unit: string;
    min_cost: string | null;
  }>;
  service: string;
  created_by: string;
  created_by_name: string;
  status: string;
  status_display: string;
  remark: string | null;
  trade: string;
  fcl_details: Array<{
    id: number;
    container_type: string;
    container_name: string;
    no_of_containers: number;
  }>;
  location: string;
  total_cost: string;
  total_sell: string;
  profit: string;
  chargeable_volume: number | null;
};

type CallEntryData = {
  id: number;
  customer_name: string;
  call_date: string;
  call_mode: string;
  call_summary: string;
  followup_date: string;
  followup_action: string;
  latitude: string;
  longitude: string;
  status: string;
  created_by: string;
  created_date: string;
  salesman: string;
};

type ShipmentData = {
  customer_name: string;
  carrier_name: string;
  booking_no: string;
  revenue: number;
  gp: number;
};

type PotentialProfilingData = {
  id: number;
  service: string;
  origin_port_code: string;
  origin_port_name: string;
  destination_port_code: string;
  destination_port_name: string;
  no_of_shipments: number;
  frequency_id: number;
  frequency_name: string;
  volume: number;
  tier: string;
  potential_profit: number;
};

type CustomerDataResponse = {
  customer_info: {
    customer_code: string;
    customer_name: string;
    salesperson: string | null;
    credit_day: number | null;
    total_net_balance: number;
    total_credit_amount: number | null;
    last_visited: string | null;
    overall_total_revenue?: number | null;
    overall_total_gp?: number | null;
  };
  quotations: {
    count: number;
    data: QuotationData[];
  };
  call_entries: {
    count: number;
    data: CallEntryData[];
  };
  shipment: {
    count: number;
    data: ShipmentData[];
    overall_total_revenue: number;
    overall_total_gp: number;
  };
  potential_profiling: {
    count: number;
    data: PotentialProfilingData[];
  };
};

function CustomerMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);

  // Pagination states
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationTotal, setPaginationTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [customerDisplayValue, setCustomerDisplayValue] = useState<
    string | null
  >(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  // Filter form
  const filterForm = useForm<FilterState>({
    initialValues: {
      customer_name: null,
      customer_type: null,
      assigned_to_display: null,
      country: null,
      state: null,
      city: null,
      status: null,
    },
  });

  // Build filter payload function
  const buildFilterPayload = useCallback(() => {
    const payload: Record<string, string> = {};
    // Use customerDisplayValue (customer name) for payload instead of customer_code
    if (customerDisplayValue) {
      payload.customer_name = customerDisplayValue;
    }
    if (filterForm.values.customer_type) {
      payload.customer_type = filterForm.values.customer_type;
    }
    if (filterForm.values.assigned_to_display) {
      payload.assigned_to_display = filterForm.values.assigned_to_display;
    }
    if (filterForm.values.country) {
      payload.country = filterForm.values.country;
    }
    if (filterForm.values.state) {
      payload.state = filterForm.values.state;
    }
    if (filterForm.values.city) {
      payload.city = filterForm.values.city;
    }
    if (filterForm.values.status) {
      payload.status = filterForm.values.status;
    }
    return payload;
  }, [filterForm.values, customerDisplayValue]);

  // Fetch countries data
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(`${URL.country}`, API_HEADER)) as
          | { success: boolean; data: CountryData[] }
          | CountryData[];
        if (response && typeof response === "object" && "success" in response) {
          return response.data || [];
        }
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching countries:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch states data
  const { data: states = [], isLoading: statesLoading } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(`${URL.state}`, API_HEADER)) as
          | { success: boolean; data: StateData[] }
          | StateData[];
        let statesData: StateData[] = [];
        if (response && typeof response === "object" && "success" in response) {
          statesData = response.data || [];
        } else if (Array.isArray(response)) {
          statesData = response;
        }
        // Return all active states
        return statesData.filter((state) => state.status === "active");
      } catch (error) {
        console.error("Error fetching states:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch cities data
  // const { data: cities = [] } = useQuery({
  //   queryKey: ["cities"],
  //   queryFn: async () => {
  //     try {
  //       const response = (await getAPICall(`${URL.city}`, API_HEADER)) as
  //         | { success: boolean; data: CityData[] }
  //         | CityData[];
  //       if (response && typeof response === "object" && "success" in response) {
  //         return response.data || [];
  //       }
  //       return Array.isArray(response) ? response : [];
  //     } catch (error) {
  //       console.error("Error fetching cities:", error);
  //       return [];
  //     }
  //   },
  //   staleTime: 5 * 60 * 1000,
  // });

  // Fetch customer types data
  const { data: customerTypes = [] } = useQuery({
    queryKey: ["customerTypes"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.customerType}`,
          API_HEADER
        )) as
          | { success: boolean; data: CustomerTypeData[] }
          | CustomerTypeData[];
        let typesData: CustomerTypeData[] = [];
        if (response && typeof response === "object" && "success" in response) {
          typesData = response.data || [];
        } else if (Array.isArray(response)) {
          typesData = response;
        }
        return typesData.filter((type) => type.status === "ACTIVE");
      } catch (error) {
        console.error("Error fetching customer types:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch salespersons data
  const { data: salespersonsData = [] } = useQuery({
    queryKey: ["salespersons"],
    queryFn: async () => {
      try {
        const response = (await postAPICall(
          URL.salespersons,
          {},
          API_HEADER
        )) as { success: boolean; data: SalespersonData[] } | SalespersonData[];
        if (response && typeof response === "object" && "success" in response) {
          return response.data || [];
        }
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching salespersons:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  // Memoized dropdown options
  const countryOptions = useMemo(() => {
    return countries
      .filter((country) => country.status === "ACTIVE")
      .map((country) => ({
        value: country.country_name,
        label: country.country_name,
      }));
  }, [countries]);

  const stateOptions = useMemo(() => {
    return states.map((state) => ({
      value: state.state_name,
      label: state.state_name,
    }));
  }, [states]);

  // const cityOptions = useMemo(() => {
  //   return cities
  //     .filter((city) => city.status === "active")
  //     .map((city) => ({
  //       value: city.city_name,
  //       label: city.city_name,
  //     }));
  // }, [cities]);

  const customerTypeOptions = useMemo(() => {
    return customerTypes.map((type) => ({
      value: type.customer_type_name,
      label: type.customer_type_name,
    }));
  }, [customerTypes]);

  const salespersonOptions = useMemo(() => {
    return salespersonsData
      .filter((item) => item?.sales_person)
      .map((item) => ({
        value: String(item.sales_person),
        label: String(item.sales_person),
      }));
  }, [salespersonsData]);

  // Fetch customer data with React Query - using filter API
  const {
    data: customerData = [],
    isLoading: customerLoading,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ["customers", pageIndex, pageSize],
    queryFn: async () => {
      try {
        const index = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.customerFilter}?index=${index}&limit=${pageSize}`,
          { filters: {} }
        );
        console.log("customer response---", response);

        const data = response as unknown as CustomerApiResponse;
        if (data && data.success && Array.isArray(data.data)) {
          // Store metadata in the cache
          queryClient.setQueryData(["customersMetadata", pageIndex, pageSize], {
            total: data.filters_total_count || data.total || 0,
            pagination_total: data.pagination_total || 0,
          });
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching customer data:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredCustomerData = [],
    isLoading: filteredCustomerLoading,
    refetch: refetchFilteredCustomers,
  } = useQuery({
    queryKey: ["filteredCustomers", pageIndex, pageSize, buildFilterPayload()],
    queryFn: async () => {
      try {
        const filterPayload = buildFilterPayload();
        if (Object.keys(filterPayload).length === 0) return [];

        const index = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.customerFilter}?index=${index}&limit=${pageSize}`,
          {
            filters: filterPayload,
          }
        );
        const data = response as unknown as CustomerApiResponse;
        if (data && data.success && Array.isArray(data.data)) {
          // Store metadata in the cache
          queryClient.setQueryData(["customersMetadata", pageIndex, pageSize], {
            total: data.filters_total_count || data.total || 0,
            pagination_total: data.pagination_total || 0,
          });
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered customer data:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // State to track if filters have been applied
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Delete confirmation state
  const [customerToDelete, setCustomerToDelete] = useState<CustomerData | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePopoverOpened, setDeletePopoverOpened] = useState(false);

  // Customer Data Drawer state
  const [
    customerDataDrawer,
    { open: openCustomerDataDrawer, close: closeCustomerDataDrawer },
  ] = useDisclosure(false);
  const [quotationData, setQuotationData] = useState<QuotationData[]>([]);
  const [callEntryData, setCallEntryData] = useState<CallEntryData[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  const [potentialProfilingData, setPotentialProfilingData] = useState<
    PotentialProfilingData[]
  >([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [selectedCustomerCode, setSelectedCustomerCode] = useState<string>("");
  const [customerCreditDay, setCustomerCreditDay] = useState<number | null>(
    null
  );
  const [customerSalesperson, setCustomerSalesperson] = useState<string | null>(
    null
  );
  const [customerLastVisited, setCustomerLastVisited] = useState<string | null>(
    null
  );
  const [customerTotalCreditAmount, setCustomerTotalCreditAmount] = useState<
    number | null
  >(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [totalOutstandingAmount, setTotalOutstandingAmount] =
    useState<number>(0);

  // Search data with React Query - using filter API with customer_name
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["customerSearch", debounced, pageIndex, pageSize],
    queryFn: async () => {
      if (!debounced.trim()) return null;
      try {
        const index = pageIndex * pageSize;
        // Use filter API with customer_name filter
        const response = await apiCallProtected.post(
          `${URL.customerFilter}?index=${index}&limit=${pageSize}`,
          {
            filters: {
              customer_name: debounced,
            },
          }
        );

        const data = response as unknown as CustomerApiResponse;
        if (data && data.success && Array.isArray(data.data)) {
          // Store metadata in the cache
          queryClient.setQueryData(["customersMetadata", pageIndex, pageSize], {
            total: data.filters_total_count || data.total || 0,
            pagination_total: data.pagination_total || 0,
          });
          return data.data;
        }
        return [];
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

  // Reset filtersApplied when search is cleared
  useEffect(() => {
    if (debounced.trim() === "" && searchQuery.trim() === "") {
      setFiltersApplied(false);
    }
  }, [debounced, searchQuery]);

  // Effect to get pagination metadata from cache
  useEffect(() => {
    const metadata = queryClient.getQueryData<{
      total: number;
      pagination_total: number;
    }>(["customersMetadata", pageIndex, pageSize]);

    if (metadata) {
      setTotalCount(metadata.total || 0);
      setPaginationTotal(metadata.pagination_total || 0);
    }
  }, [
    queryClient,
    pageIndex,
    pageSize,
    customerData,
    searchData,
    filteredCustomerData,
  ]);

  // Determine which data to display
  const displayData = useMemo(() => {
    if (debounced.trim() !== "" && searchData) {
      return searchData;
    }
    // Only show filtered data if filters have been explicitly applied via "Apply Filters" button
    if (filtersApplied) {
      return filteredCustomerData;
    }
    // Otherwise, show the default customer data
    return customerData;
  }, [
    debounced,
    searchData,
    customerData,
    filteredCustomerData,
    filtersApplied,
  ]);

  // Loading state
  const isLoading =
    customerLoading ||
    (filtersApplied && filteredCustomerLoading) ||
    searchLoading;

  // Add effect to refresh data when returning from create/edit operations
  useEffect(() => {
    // Check if we're returning from a create/edit operation
    if (location.state?.refreshData) {
      // Clear the refresh flag
      navigate(location.pathname, { replace: true, state: {} });

      // Clear search query to show fresh data
      setSearchQuery("");

      // Invalidate and refresh all customer data
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["filteredCustomers"] });
      queryClient.invalidateQueries({ queryKey: ["customerSearch"] });
      queryClient.invalidateQueries({ queryKey: ["customersMetadata"] });

      // Refresh data based on current filter state
      if (filtersApplied && Object.keys(buildFilterPayload()).length > 0) {
        refetchFilteredCustomers();
      } else {
        refetchCustomers();
      }
    }
  }, [
    location.state,
    refetchFilteredCustomers,
    refetchCustomers,
    navigate,
    filtersApplied,
    queryClient,
    buildFilterPayload,
    location.pathname,
  ]);

  const handleViewCustomer = useCallback(
    (rowData: CustomerData) => {
      navigate(`./view/${rowData.id}`, { state: { customerData: rowData } });
    },
    [navigate]
  );

  const handleEditCustomer = useCallback(
    (rowData: CustomerData) => {
      navigate(`./edit/${rowData.id}`, { state: { customerData: rowData } });
    },
    [navigate]
  );

  // Delete functionality is commented out in the menu
  // const handleDeleteCustomer = useCallback((rowData: CustomerData) => {
  //   setCustomerToDelete(rowData);
  //   setDeletePopoverOpened(true);
  // }, []);

  // Cleanup function to reset delete state
  const resetDeleteState = () => {
    setCustomerToDelete(null);
    setDeletePopoverOpened(false);
  };

  // Close delete popover when menu closes
  useEffect(() => {
    if (!deletePopoverOpened) {
      setCustomerToDelete(null);
    }
  }, [deletePopoverOpened]);

  const confirmDelete = async () => {
    if (!customerToDelete) return;

    try {
      setIsDeleting(true);
      const deleteValue = {
        id: customerToDelete.id,
        group_code: customerToDelete.customer_code || "",
        group_name: customerToDelete.customer_name || "",
        status: (customerToDelete.status === "ACTIVE"
          ? "ACTIVE"
          : "INACTIVE") as "ACTIVE" | "INACTIVE",
      };

      const response = await deleteApiCall(URL.customer, {}, deleteValue);
      if (response) {
        ToastNotification({
          type: "success",
          message: "Customer deleted successfully",
        });

        // Invalidate and refresh the data
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        queryClient.invalidateQueries({ queryKey: ["filteredCustomers"] });
        queryClient.invalidateQueries({ queryKey: ["customerSearch"] });
        queryClient.invalidateQueries({ queryKey: ["customersMetadata"] });

        if (filtersApplied && Object.keys(buildFilterPayload()).length > 0) {
          refetchFilteredCustomers();
        } else {
          refetchCustomers();
        }
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      ToastNotification({
        type: "error",
        message: "Failed to delete customer",
      });
    } finally {
      setIsDeleting(false);
      setCustomerToDelete(null);
      setDeletePopoverOpened(false);
    }
  };

  // Handle pagination changes
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0); // Reset to first page when changing page size
  };

  const handlePageIndexChange = (newPageIndex: number) => {
    setPageIndex(newPageIndex);
  };

  const applyFilters = async () => {
    try {
      const hasFilterValues =
        filterForm.values.customer_name ||
        filterForm.values.customer_type ||
        filterForm.values.assigned_to_display ||
        filterForm.values.country ||
        filterForm.values.state ||
        filterForm.values.city ||
        filterForm.values.status;

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0);
        await queryClient.invalidateQueries({ queryKey: ["customers"] });
        await refetchCustomers();
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setPageIndex(0);
      setFiltersApplied(true);
      setShowFilters(false);

      await queryClient.invalidateQueries({
        queryKey: ["filteredCustomers"],
      });
      await refetchFilteredCustomers();
    } catch (error) {
      console.error("Error applying filters:", error);
      ToastNotification({
        type: "error",
        message: "Failed to apply filters",
      });
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset();
    setSearchQuery("");
    setPageIndex(0);
    setFiltersApplied(false);
    setCustomerDisplayValue(null);
    setSelectedCountry(null);
    setSelectedState(null);

    await queryClient.invalidateQueries({ queryKey: ["customers"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredCustomers"] });
    await refetchCustomers();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Fetch customer data for drawer
  const fetchCustomerData = useCallback(
    async (
      customerCode: string,
      customerName: string,
      month?: number,
      year?: number
    ) => {
      try {
        setIsLoadingData(true);
        setSelectedCustomerName(customerName);
        setSelectedCustomerCode(customerCode);

        // Use provided month/year or current state values
        const monthToUse = month ?? selectedMonth;
        const yearToUse = year ?? selectedYear;

        // Calculate date_from: First day of the selected month (YYYY-MM-01)
        const dateFrom = `${yearToUse}-${String(monthToUse).padStart(2, "0")}-01`;

        // Calculate date_to: Today's actual date
        const today = new Date();
        const dateTo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const payload: {
          customer_code: string;
          date_from: string;
          date_to: string;
        } = {
          customer_code: customerCode,
          date_from: dateFrom,
          date_to: dateTo,
        };

        const customerData = (await postAPICall(
          `${URL.customerData}?index=0&limit=5`,
          payload
        )) as CustomerDataResponse;

        // Extract data from the API response
        if (customerData) {
          // Set customer name from customer_info if available
          if (
            customerData.customer_info &&
            customerData.customer_info.customer_name
          ) {
            setSelectedCustomerName(customerData.customer_info.customer_name);
          }

          // Set customer info fields
          if (customerData.customer_info) {
            setCustomerCreditDay(customerData.customer_info.credit_day);
            setCustomerSalesperson(customerData.customer_info.salesperson);
            setCustomerLastVisited(customerData.customer_info.last_visited);
            setCustomerTotalCreditAmount(
              customerData.customer_info.total_credit_amount
            );
            setTotalRevenue(
              customerData.customer_info.overall_total_revenue ?? null
            );
            setTotalProfit(customerData.customer_info.overall_total_gp ?? null);
            if (customerData.customer_info.total_net_balance !== undefined) {
              setTotalOutstandingAmount(
                customerData.customer_info.total_net_balance
              );
            }
          }

          // Set quotations data
          if (customerData.quotations && customerData.quotations.data) {
            setQuotationData(customerData.quotations.data);
          } else {
            setQuotationData([]);
          }

          // Set call entries data
          if (customerData.call_entries && customerData.call_entries.data) {
            setCallEntryData(customerData.call_entries.data);
          } else {
            setCallEntryData([]);
          }

          // Set shipment data
          if (customerData.shipment && customerData.shipment.data) {
            setShipmentData(customerData.shipment.data);
          } else {
            setShipmentData([]);
          }

          // Set potential profiling data
          if (
            customerData.potential_profiling &&
            customerData.potential_profiling.data
          ) {
            setPotentialProfilingData(customerData.potential_profiling.data);
          } else {
            setPotentialProfilingData([]);
          }
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to fetch customer data",
        });
      } finally {
        setIsLoadingData(false);
      }
    },
    [selectedMonth, selectedYear]
  );

  const handleCustomerNameClick = useCallback(
    (customer: CustomerData) => {
      fetchCustomerData(customer.customer_code, customer.customer_name);
      openCustomerDataDrawer();
    },
    [fetchCustomerData, openCustomerDataDrawer]
  );

  const columns = useMemo<MRT_ColumnDef<CustomerData>[]>(
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
        accessorKey: "customer_code",
        header: "Customer Code",
        size: 150,
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 300,
        Cell: ({ row }) => {
          const customer = row.original as CustomerData;
          return (
            <Text
              size="sm"
              style={{
                color: "#105476",
                cursor: "pointer",
                textDecoration: "underline",
              }}
              onClick={() => handleCustomerNameClick(customer)}
            >
              {customer.customer_name}
            </Text>
          );
        },
      },
      // {
      //   accessorKey: "customer_type",
      //   header: "Customer Type",
      //   size: 150,
      //   Cell: ({ cell }) => (
      //     <Text size="sm">{cell.getValue<string>() || "N/A"}</Text>
      //   ),
      // },

      {
        accessorKey: "term_code",
        header: "Term Code",
        size: 120,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "N/A"}</Text>
        ),
      },
      // {
      //   accessorKey: "assigned_to_display",
      //   header: "Assigned To",
      //   size: 150,
      //   Cell: ({ cell }) => (
      //     <Text size="sm">{cell.getValue<string>() || "N/A"}</Text>
      //   ),
      // },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ row }) => {
          const status = (row.original as CustomerData).status;
          return (
            <Badge color={status === "ACTIVE" ? "green" : "red"} size="sm">
              {status?.toUpperCase() || "N/A"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Action",
        size: 40,
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
                      handleViewCustomer(row.original);
                    }}
                  >
                    <Group gap={"sm"}>
                      <IconEye size={16} style={{ color: "#105476" }} />
                      <Text size="sm">View</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      handleEditCustomer(row.original);
                    }}
                  >
                    <Group gap={"sm"}>
                      <IconEdit size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Edit</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                {/* <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      handleDeleteCustomer(row.original);
                    }}
                    style={{ color: "#dc3545" }}
                    className="delete-button"
                  >
                    <Group gap={"sm"}>
                      <IconTrash size={16} style={{ color: "#dc3545" }} />
                      <Text size="sm" style={{ color: "#dc3545" }}>
                        Delete
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box> */}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [handleViewCustomer, handleEditCustomer, handleCustomerNameClick]
  );

  const table = useMantineReactTable<CustomerData>({
    columns,
    data: displayData,
    enableColumnFilters: false,
    enablePagination: false, // Disable client-side pagination
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
    },
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
        top: 0,
        zIndex: 3,
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

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c={"#105476"}>
            Customer Lists
          </Text>

          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="Search"
              leftSection={<IconSearch size={16} />}
              style={{ width: 300 }}
              radius="sm"
              size="xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />

            <Button
              variant="outline"
              leftSection={<IconFilter size={16} />}
              size="xs"
              color="#105476"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>

            <Button
              variant="filled"
              leftSection={<IconPlus size={14} />}
              size="xs"
              color="#105476"
              onClick={() => navigate("./create")}
            >
              Create New
            </Button>
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
          >
            <Group justify="space-between" align="center">
              <Group align="center" gap="xs">
                <IconFilter size={16} color="#105476" />
                <Text size="sm" fw={500} c="#105476">
                  Filters
                </Text>
              </Group>
            </Group>

            <Grid mt="md">
              {/* Customer Name Filter */}
              <Grid.Col span={3}>
                <SearchableSelect
                  size="xs"
                  label="Customer Name"
                  placeholder="Type customer name"
                  apiEndpoint={URL.customer}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code as string),
                    label: item.customer_name as string,
                  })}
                  value={filterForm.values.customer_name}
                  displayValue={customerDisplayValue}
                  onChange={(value, selectedData) => {
                    filterForm.setFieldValue("customer_name", value || null);
                    setCustomerDisplayValue(selectedData?.label || null);
                  }}
                  minSearchLength={2}
                />
              </Grid.Col>

              {/* Customer Type Filter */}
              <Grid.Col span={3}>
                <Select
                  label="Customer Type"
                  placeholder="Select customer type"
                  searchable
                  clearable
                  size="xs"
                  data={customerTypeOptions}
                  {...filterForm.getInputProps("customer_type")}
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

              {/* Salesperson Filter */}
              <Grid.Col span={3}>
                <Select
                  label="Salesperson"
                  placeholder="Select salesperson"
                  searchable
                  clearable
                  size="xs"
                  data={salespersonOptions}
                  {...filterForm.getInputProps("assigned_to_display")}
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

              {/* Country Filter */}
              <Grid.Col span={3}>
                <Select
                  label="Country"
                  placeholder="Select country"
                  searchable
                  clearable
                  size="xs"
                  data={countryOptions}
                  value={selectedCountry}
                  onChange={(value) => {
                    setSelectedCountry(value);
                    filterForm.setFieldValue("country", value || null);
                    // Clear state when country changes
                    setSelectedState(null);
                    filterForm.setFieldValue("state", null);
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

              {/* State Filter */}
              <Grid.Col span={3}>
                <Select
                  label="State"
                  placeholder={
                    statesLoading ? "Loading state values..." : "Select state"
                  }
                  searchable
                  clearable
                  size="xs"
                  data={stateOptions}
                  value={selectedState}
                  onChange={(value) => {
                    setSelectedState(value);
                    filterForm.setFieldValue("state", value || null);
                  }}
                  disabled={statesLoading}
                  nothingFoundMessage={
                    statesLoading
                      ? "Loading state values..."
                      : "No states found"
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

              {/* City Filter */}
              <Grid.Col span={3}>
                <TextInput
                  label="City"
                  placeholder="Type city name"
                  size="xs"
                  {...filterForm.getInputProps("city")}
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

              {/* Status Filter */}
              <Grid.Col span={3}>
                <Select
                  label="Status"
                  placeholder="Select status"
                  searchable
                  clearable
                  size="xs"
                  data={[
                    { value: "ACTIVE", label: "ACTIVE" },
                    { value: "INACTIVE", label: "INACTIVE" },
                  ]}
                  {...filterForm.getInputProps("status")}
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

        {isLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading customers...</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />
          </>
        )}

        {/* Custom Pagination Bar */}
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
          {/* Rows per page and range */}
          <Group gap="sm" align="center" wrap="nowrap" mt={10}>
            <Text size="sm" c="dimmed">
              Rows per page
            </Text>
            <Select
              size="xs"
              data={["10", "25", "50"]}
              value={String(pageSize)}
              onChange={(val) => {
                if (!val) return;
                handlePageSizeChange(Number(val));
              }}
              w={110}
              styles={{ input: { fontSize: 12, height: 30 } }}
            />
            <Text size="sm" c="dimmed">
              {(() => {
                if (totalCount === 0) return "0–0 of 0";
                const start = pageIndex * pageSize + 1;
                const end = Math.min((pageIndex + 1) * pageSize, totalCount);
                return `${start}–${end} of ${totalCount}`;
              })()}
            </Text>
          </Group>

          {/* Page controls */}
          <Group gap="xs" align="center" wrap="nowrap" mt={10}>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => handlePageIndexChange(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Text size="sm" ta="center" style={{ width: 26 }}>
              {pageIndex + 1}
            </Text>
            <Text size="sm" c="dimmed">
              of {Math.max(1, paginationTotal)}
            </Text>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => {
                const totalPages = Math.max(1, paginationTotal);
                handlePageIndexChange(Math.min(totalPages - 1, pageIndex + 1));
              }}
              disabled={pageIndex >= paginationTotal - 1}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deletePopoverOpened}
        onClose={resetDeleteState}
        title="Confirm Delete"
        centered
        size="sm"
        closeOnClickOutside={false}
        closeOnEscape={true}
      >
        <Stack gap="md">
          {/* <Group mb={5} gap="xs">
            <IconTrash color="red" size={16} />
            <Text size="sm" c="red" fw={700}>
              Delete
            </Text>
          </Group> */}
          <Text size="sm">
            Are you sure? Do you want to delete this customer?
          </Text>
          {/* {customerToDelete && (
            <Box p="xs" bg="#f8f9fa" style={{ borderRadius: "4px" }}>
              <Text size="xs" c="dimmed">
                <Text span fw={500}>
                  Customer Code:
                </Text>{" "}
                {customerToDelete.customer_code}
                <br />
                <Text span fw={500}>
                  Customer Name:
                </Text>{" "}
                {customerToDelete.customer_name}
                <br />
                <Text span fw={500}>
                  Status:
                </Text>{" "}
                {customerToDelete.status}
              </Text>
            </Box>
          )} */}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={resetDeleteState}
            >
              Not now
            </Button>
            <Button
              size="xs"
              color="#FF0004"
              w={100}
              onClick={() => confirmDelete()}
              loading={isDeleting}
            >
              Yes, Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Customer Data Drawer */}
      <Drawer
        opened={customerDataDrawer}
        onClose={() => {
          closeCustomerDataDrawer();
          setQuotationData([]);
          setCallEntryData([]);
          setShipmentData([]);
          setPotentialProfilingData([]);
          setCustomerCreditDay(null);
          setCustomerSalesperson(null);
          setCustomerLastVisited(null);
          setCustomerTotalCreditAmount(null);
          setTotalRevenue(null);
          setTotalProfit(null);
          setSelectedMonth(new Date().getMonth() + 1);
          setSelectedYear(new Date().getFullYear());
          setTotalOutstandingAmount(0);
          setSelectedCustomerName("");
          setSelectedCustomerCode("");
        }}
        title={`Customer Data for ${selectedCustomerName}`}
        size={"70%"}
        position="right"
      >
        <Divider mb={"md"} />

        {isLoadingData ? (
          <Box ta="center" py="xl">
            <Loader size="lg" color="#105476" />
            <Text mt="md" c="dimmed" size="lg">
              Loading customer data...
            </Text>
          </Box>
        ) : (
          <Stack gap="lg">
            {/* Customer Info Section */}
            {(customerCreditDay !== null ||
              customerSalesperson ||
              customerLastVisited ||
              customerTotalCreditAmount !== null ||
              totalOutstandingAmount !== 0 ||
              totalRevenue !== null ||
              totalProfit !== null) && (
              <Box>
                <Text
                  size="lg"
                  fw={700}
                  mb="md"
                  c="#105476"
                  style={{
                    paddingBottom: "6px",
                  }}
                >
                  ℹ️ Customer Information
                </Text>
                <Grid gutter="md">
                  {/* Left Card - General Customer Info */}
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Card
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{
                        border: "1px solid #e9ecef",
                        backgroundColor: "#ffffff",
                        height: "100%",
                      }}
                    >
                      <Grid gutter="md">
                        {customerSalesperson && (
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <Box>
                              <Text size="xs" fw={600} c="#666" mb={6}>
                                Salesperson
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {customerSalesperson}
                              </Text>
                            </Box>
                          </Grid.Col>
                        )}
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <Box>
                            <Text size="xs" fw={600} c="#666" mb={6}>
                              Credit Days
                            </Text>
                            <Text size="sm" fw={500} c="#333">
                              {customerCreditDay !== null
                                ? `${customerCreditDay} days`
                                : "-"}
                            </Text>
                          </Box>
                        </Grid.Col>
                        {customerTotalCreditAmount !== null && (
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <Box>
                              <Text size="xs" fw={600} c="#666" mb={6}>
                                Credit Amount
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                ₹
                                {customerTotalCreditAmount.toLocaleString(
                                  "en-IN"
                                )}
                              </Text>
                            </Box>
                          </Grid.Col>
                        )}
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <Box>
                            <Text size="xs" fw={600} c="#666" mb={6}>
                              Total Outstanding Amount
                            </Text>
                            <Text
                              size="sm"
                              fw={500}
                              style={{
                                color:
                                  totalOutstandingAmount > 0
                                    ? "#28a745"
                                    : totalOutstandingAmount < 0
                                      ? "#dc3545"
                                      : undefined,
                              }}
                            >
                              ₹{totalOutstandingAmount.toLocaleString("en-IN")}
                            </Text>
                          </Box>
                        </Grid.Col>
                        {customerLastVisited && (
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <Box>
                              <Text size="xs" fw={600} c="#666" mb={6}>
                                Last Visited
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {dayjs(customerLastVisited).format(
                                  "DD/MM/YYYY"
                                )}
                              </Text>
                            </Box>
                          </Grid.Col>
                        )}
                      </Grid>
                    </Card>
                  </Grid.Col>

                  {/* Right Card - Revenue/Profit with Filter */}
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Card
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{
                        border: "1px solid #e9ecef",
                        backgroundColor: "#ffffff",
                        height: "100%",
                      }}
                    >
                      <Stack gap="md">
                        {/* Filter Section */}
                        <Box>
                          <Group gap="xs" justify="space-between">
                            <Group>
                              <Text size="xs" fw={600} c="#666" mb={6}>
                                Revenue & Profit
                              </Text>
                            </Group>
                            <Group>
                              <Select
                                size="xs"
                                value={String(selectedMonth)}
                                onChange={(value) => {
                                  if (value) {
                                    const month = parseInt(value, 10);
                                    setSelectedMonth(month);
                                    if (selectedCustomerCode) {
                                      fetchCustomerData(
                                        selectedCustomerCode,
                                        selectedCustomerName,
                                        month,
                                        selectedYear
                                      );
                                    }
                                  }
                                }}
                                data={[
                                  { value: "1", label: "January" },
                                  { value: "2", label: "February" },
                                  { value: "3", label: "March" },
                                  { value: "4", label: "April" },
                                  { value: "5", label: "May" },
                                  { value: "6", label: "June" },
                                  { value: "7", label: "July" },
                                  { value: "8", label: "August" },
                                  { value: "9", label: "September" },
                                  { value: "10", label: "October" },
                                  { value: "11", label: "November" },
                                  { value: "12", label: "December" },
                                ]}
                                styles={{
                                  input: { fontSize: 12, height: 30 },
                                  label: {
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    color: "#495057",
                                  },
                                }}
                                w={120}
                              />
                              <Select
                                size="xs"
                                value={String(selectedYear)}
                                onChange={(value) => {
                                  if (value) {
                                    const year = parseInt(value, 10);
                                    setSelectedYear(year);
                                    if (selectedCustomerCode) {
                                      fetchCustomerData(
                                        selectedCustomerCode,
                                        selectedCustomerName,
                                        selectedMonth,
                                        year
                                      );
                                    }
                                  }
                                }}
                                data={Array.from({ length: 10 }, (_, i) => {
                                  const year = new Date().getFullYear() - 9 + i;
                                  return {
                                    value: String(year),
                                    label: String(year),
                                  };
                                })}
                                styles={{
                                  input: { fontSize: 12, height: 30 },
                                  label: {
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    color: "#495057",
                                  },
                                }}
                                w={100}
                              />
                            </Group>
                          </Group>
                        </Box>

                        {/* Revenue and Profit */}
                        <Group justify="space-evenly" mt={10}>
                          {totalRevenue !== null && (
                            <Box style={{ textAlign: "center" }}>
                              <Text size="xs" fw={600} c="#666" mb={6}>
                                Total Revenue
                              </Text>
                              <Text size="sm" fw={500} c="#FF9800">
                                ₹{totalRevenue.toLocaleString("en-IN")}
                              </Text>
                            </Box>
                          )}
                          {totalProfit !== null && (
                            <Box style={{ textAlign: "center" }}>
                              <Text size="xs" fw={600} c="#666" mb={6}>
                                Total Profit
                              </Text>
                              <Text size="sm" fw={500} c="#105476">
                                ₹{totalProfit.toLocaleString("en-IN")}
                              </Text>
                            </Box>
                          )}
                        </Group>
                      </Stack>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Box>
            )}

            {/* Quotations Section */}
            <Box>
              <Text
                size="lg"
                fw={700}
                mb="md"
                c="#105476"
                style={{
                  paddingBottom: "6px",
                }}
              >
                📋 Recent Quotations
              </Text>
              {quotationData.length > 0 ? (
                <Grid gutter="md">
                  {quotationData.map((quotation) => (
                    <Grid.Col
                      key={quotation.id}
                      span={{ base: 12, sm: 6, md: 4 }}
                    >
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="#105476">
                              {quotation.enquiry_received_date
                                ? dayjs(quotation.enquiry_received_date).format(
                                    "DD/MM/YYYY"
                                  )
                                : "-"}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {quotation.service || "-"}
                            </Text>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Origin
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {quotation.origin_name || "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Destination
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {quotation.destination_name || "-"}
                              </Text>
                            </Box>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Container Type
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {quotation.fcl_details &&
                                quotation.fcl_details.length > 0
                                  ? quotation.fcl_details
                                      .map((detail) => detail.container_type)
                                      .join(", ")
                                  : "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                No. of Containers
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {quotation.fcl_details &&
                                quotation.fcl_details.length > 0
                                  ? quotation.fcl_details
                                      .map((detail) => detail.no_of_containers)
                                      .join(", ")
                                  : "-"}
                              </Text>
                            </Box>
                          </Group>

                          <Group justify="space-between" align="center">
                            <Text size="xs" fw={600} c="#666">
                              Status:
                            </Text>
                            <Text size="sm" fw={500} c="#28a745">
                              {quotation.status || "-"}
                            </Text>
                          </Group>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No quotations found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>

            {/* Shipments Section */}
            <Box>
              <Group justify="space-between" align="center" mb="md">
                <Text
                  size="lg"
                  fw={700}
                  c="#105476"
                  style={{
                    paddingBottom: "6px",
                  }}
                >
                  📦 Recent Shipments
                </Text>
              </Group>
              {shipmentData.length > 0 ? (
                <Grid gutter="md">
                  {shipmentData.map((shipment, index) => (
                    <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="#105476">
                              {shipment.customer_name || "-"}
                            </Text>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Booking No
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {shipment.booking_no || "-"}
                              </Text>
                            </Box>
                          </Group>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No shipments found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>

            {/* Call Entries Section */}
            <Box>
              <Text
                size="lg"
                fw={700}
                mb="md"
                c="#105476"
                style={{
                  paddingBottom: "6px",
                }}
              >
                📞 Recent Call Entries
              </Text>
              {callEntryData.length > 0 ? (
                <Grid gutter="md">
                  {callEntryData.map((callEntry) => (
                    <Grid.Col
                      key={callEntry.id}
                      span={{ base: 12, sm: 6, md: 4 }}
                    >
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="#105476">
                              {callEntry.call_date
                                ? dayjs(callEntry.call_date).format(
                                    "DD/MM/YYYY"
                                  )
                                : "-"}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {callEntry.call_mode || "-"}
                            </Text>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Follow-up Date
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {callEntry.followup_date
                                  ? dayjs(callEntry.followup_date).format(
                                      "DD/MM/YYYY"
                                    )
                                  : "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Action
                              </Text>
                              <Text
                                size="sm"
                                fw={500}
                                c="#333"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  lineHeight: "1.4",
                                }}
                              >
                                {callEntry.followup_action || "-"}
                              </Text>
                            </Box>
                          </Group>
                          <Box>
                            <Text size="xs" fw={600} c="#666" mb={2}>
                              Call Summary
                            </Text>
                            <Text
                              size="sm"
                              fw={500}
                              c="#333"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                lineHeight: "1.4",
                              }}
                            >
                              {callEntry.call_summary || "-"}
                            </Text>
                          </Box>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No call entries found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>

            {/* Potential Profiling Section */}
            <Box>
              <Text
                size="lg"
                fw={700}
                mb="md"
                c="#105476"
                style={{
                  paddingBottom: "6px",
                }}
              >
                🎯 Potential Profiling
              </Text>
              {potentialProfilingData.length > 0 ? (
                <Grid gutter="md">
                  {potentialProfilingData.map((profile) => (
                    <Grid.Col
                      key={profile.id}
                      span={{ base: 12, sm: 6, md: 4 }}
                    >
                      <Card
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          border: "1px solid #e9ecef",
                          backgroundColor: "#ffffff",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          height: "100%",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 20px rgba(16, 84, 118, 0.1)";
                          e.currentTarget.style.borderColor = "#105476";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                          e.currentTarget.style.borderColor = "#e9ecef";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="#105476">
                              {profile.service || "-"}
                            </Text>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Origin
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {profile.origin_port_name || "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Destination
                              </Text>
                              <Text size="sm" fw={500} c="#333" truncate>
                                {profile.destination_port_name || "-"}
                              </Text>
                            </Box>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                No. of Shipments
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {profile.no_of_shipments || "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Frequency
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {profile.frequency_name || "-"}
                              </Text>
                            </Box>
                          </Group>

                          <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Volume
                              </Text>
                              <Text size="sm" fw={500} c="#333">
                                {profile.volume || "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Potential Profit
                              </Text>
                              <Text size="sm" fw={500} c="#28a745">
                                {profile.potential_profit
                                  ? `₹${profile.potential_profit.toLocaleString("en-IN")}`
                                  : "-"}
                              </Text>
                            </Box>
                          </Group>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <Box ta="center" py="sm">
                    <Text c="dimmed" size="sm">
                      No potential profiling data found for this customer
                    </Text>
                  </Box>
                </Card>
              )}
            </Box>
          </Stack>
        )}
      </Drawer>

      <Outlet />
    </>
  );
}

export default CustomerMaster;
