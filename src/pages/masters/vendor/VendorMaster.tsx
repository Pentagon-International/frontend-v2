import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastNotification } from "../../../components";
import { URL } from "../../../api/serverUrls";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
  type MRT_PaginationState,
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
  Grid,
  TextInput,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconPlus,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { SearchableSelect } from "../../../components";
import dayjs from "dayjs";
import CustomerDataDrawer from "../../../components/CustomerDataDrawer/CustomerDataDrawer";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useListFilterStore } from "../../../store/listFilterStore";
import { useIsAdminUser } from "../../../hooks/useIsAdminUser";
import useAuthStore from "../../../store/authStore";
import { isIndianUserCountry } from "../../../utils/userNumberFormat";

const LIST_KEY = "VENDOR_MASTER";

/** Default customer_type filter for Vendor Master list (customertype-master ids). */
const DEFAULT_VENDOR_CUSTOMER_TYPE_IDS = [6, 8, 12] as const;

/** Customer types shown in Vendor Master filter (matches customer_type_name from API). */
const VENDOR_CUSTOMER_TYPE_NAMES = ["Supplier", "Carrier", "Transporter"] as const;

const VENDOR_LABELS_LC = new Set(
  VENDOR_CUSTOMER_TYPE_NAMES.map((n) => n.toLowerCase()),
);

type AddressData = {
  id?: number;
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
  pan_no?: string;
  gst_id?: string;
  tan_no?: string;
  arn_no?: string;
  uin_no?: string;
  gst_registration_status?: string;
  composite_regular?: string;
  sez?: boolean;
  latitude?: number;
  longitude?: number;
};

type BankDetailData = {
  id?: number;
  currency?: string;
  account_no?: string;
  account_name?: string;
  bank_name?: string;
  iban_no?: string;
  swift_no?: string;
  bank_address?: string;
  ifsc_code?: string;
};

type CustomerData = {
  id: number;
  customer_code: string;
  customer_name: string;
  customer_type?: string;
  customer_type_name?: string;
  customer_types?: Array<{
    id?: number;
    customer_type_code?: string;
    customer_type_name?: string;
  }>;
  status: string;
  term_code?: string;
  own_office?: boolean;
  assigned_to?: string | null;
  assigned_to_display?: string | null;
  addresses_data?: AddressData[];
  bank_details_data?: BankDetailData[];
  documents_list?: CustomerDocumentListItem[];
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

type VendorFilterState = {
  customer_name: string | null;
  /** Display name for filter API (SearchableSelect label) */
  customer_name_label: string | null;
  /** Selected customertype-master id (string for Select); null = use default id list */
  customer_type_id: string | null;
  assigned_to_display: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  status: string | null;
};

const DEFAULT_VENDOR_FILTERS: VendorFilterState = {
  customer_name: null,
  customer_name_label: null,
  customer_type_id: null,
  assigned_to_display: null,
  country: null,
  state: null,
  city: null,
  status: null,
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
    currency?: string;
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

function buildVendorFilterPayload(
  filters: VendorFilterState,
  searchValue: string,
): Record<string, string | number[]> {
  const payload: Record<string, string | number[]> = {};

  if (filters.customer_type_id?.trim()) {
    const id = Number(filters.customer_type_id.trim());
    payload.customer_type = Number.isNaN(id)
      ? [...DEFAULT_VENDOR_CUSTOMER_TYPE_IDS]
      : [id];
  } else {
    payload.customer_type = [...DEFAULT_VENDOR_CUSTOMER_TYPE_IDS];
  }

  if (searchValue?.trim()) {
    payload.customer_name = searchValue.trim();
  } else if (filters.customer_name_label?.trim()) {
    payload.customer_name = filters.customer_name_label.trim();
  }

  if (filters.assigned_to_display) {
    payload.assigned_to_display = filters.assigned_to_display;
  }
  if (filters.country) payload.country = filters.country;
  if (filters.state) payload.state = filters.state;
  if (filters.city) payload.city = filters.city;
  if (filters.status) payload.status = filters.status;

  return payload;
}

export default function VendorMaster() {
  const isAdmin = useIsAdminUser();
  const userPulseId = useAuthStore((s) => s.user?.pulse_id);
  const userCountry = useAuthStore((s) => s.user?.country);
  const isPentagonUser =
    String(userPulseId ?? "")
      .trim()
      .toUpperCase() === "P2PEN";
  const isIndiaUser =
    isIndianUserCountry(userCountry?.country_code) ||
    String(userCountry?.country_name ?? "")
      .toLowerCase()
      .includes("india");
  // Hide only for non-admin P2PEN users based in India; P2PEN abroad (e.g. US) may create
  const showCreateButton =
    isAdmin || !isPentagonUser || !isIndiaUser;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [draftFilters, setDraftFilters] =
    useState<VendorFilterState>(DEFAULT_VENDOR_FILTERS);

  const [appliedFilters, setAppliedFilters] =
    useState<VendorFilterState>(DEFAULT_VENDOR_FILTERS);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }

    if (stored?.filters && typeof stored.filters === "object") {
      const raw = { ...(stored.filters as Record<string, unknown>) };
      delete raw.customer_type;
      const restored = {
        ...DEFAULT_VENDOR_FILTERS,
        ...(raw as Partial<VendorFilterState>),
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
      setSelectedCountry(restored.country);
      setSelectedState(restored.state);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
  };

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_VENDOR_FILTERS);
    setAppliedFilters(DEFAULT_VENDOR_FILTERS);
    setSelectedCountry(null);
    setSelectedState(null);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

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
        return statesData.filter((state) => state.status === "active");
      } catch (error) {
        console.error("Error fetching states:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: customerTypes = [] } = useQuery({
    queryKey: ["customerTypes", "vendor", "vendor=True"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.customerType}?vendor=True`,
          API_HEADER,
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

  const { data: salespersonsData = [] } = useQuery({
    queryKey: ["salespersons"],
    queryFn: async () => {
      try {
        const response = (await postAPICall(
          URL.salespersons,
          {},
          API_HEADER,
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

  const vendorCustomerTypeOptions = useMemo(() => {
    return customerTypes
      .filter((type) =>
        VENDOR_LABELS_LC.has((type.customer_type_name || "").toLowerCase()),
      )
      .map((type) => ({
        value: String(type.id),
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

  const {
    data: tableData = [],
    isLoading: listLoading,
    isFetching: listFetching,
    error: listError,
  } = useQuery({
    queryKey: [
      "vendor-master-list",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;
        const filtersPayload = buildVendorFilterPayload(
          appliedFilters,
          debouncedSearch,
        );

        setIsInitialLoad(false);
        const response = await apiCallProtected.post(
          `${URL.customerFilter}?index=${index}&limit=${pagination.pageSize}`,
          { filters: filtersPayload },
        );
        setShowFilters(false);

        const data = response as unknown as CustomerApiResponse;
        if (data && data.success && Array.isArray(data.data)) {
          const total =
            data.filters_total_count ?? data.total ?? data.data.length;
          setTotalRecords(total);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching vendor master data:", error);
        setShowFilters(false);
        setTotalRecords(0);
        throw error;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = listFetching || listLoading || isInitialLoad;

  useEffect(() => {
    if (location.state?.refreshData) {
      navigate(location.pathname, { replace: true, state: {} });
      setSearch("");
      queryClient.invalidateQueries({ queryKey: ["vendor-master-list"] });
    }
  }, [location.state, navigate, location.pathname, queryClient]);

  const handleViewCustomer = useCallback(
    (rowData: CustomerData) => {
      setStoreFilters(LIST_KEY, appliedFilters);
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate(`/master/vendor/view/${rowData.id}`, {
        state: { customerData: rowData },
      });
    },
    [
      navigate,
      appliedFilters,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
    ],
  );

  const handleEditCustomer = useCallback(
    (rowData: CustomerData) => {
      setStoreFilters(LIST_KEY, appliedFilters);
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate(`/master/vendor/edit/${rowData.id}`, {
        state: { customerData: rowData },
      });
    },
    [
      navigate,
      appliedFilters,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
    ],
  );

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
    null,
  );
  const [customerSalesperson, setCustomerSalesperson] = useState<string | null>(
    null,
  );
  const [customerLastVisited, setCustomerLastVisited] = useState<string | null>(
    null,
  );
  const [customerTotalCreditAmount, setCustomerTotalCreditAmount] = useState<
    number | null
  >(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState<number | null>(null);
  const [customerCurrency, setCustomerCurrency] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [totalOutstandingAmount, setTotalOutstandingAmount] =
    useState<number>(0);

  const getPreviousMonthRange = () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    );
    return { from: previousMonth, to: lastDayOfPreviousMonth };
  };
  const previousMonthRange = getPreviousMonthRange();
  const [customerDataFromDate, setCustomerDataFromDate] = useState<Date | null>(
    previousMonthRange.from,
  );
  const [customerDataToDate, setCustomerDataToDate] = useState<Date | null>(
    previousMonthRange.to,
  );

  const fetchCustomerData = useCallback(
    async (
      customerCode: string,
      customerName: string,
      fromDate?: Date | null,
      toDate?: Date | null,
    ) => {
      try {
        setIsLoadingData(true);
        setSelectedCustomerName(customerName);
        setSelectedCustomerCode(customerCode);

        const fromDateToUse = fromDate ?? customerDataFromDate;
        const toDateToUse = toDate ?? customerDataToDate;

        if (!fromDateToUse || !toDateToUse) {
          setIsLoadingData(false);
          return;
        }

        const dateFrom = dayjs(fromDateToUse).format("YYYY-MM-DD");
        const dateTo = dayjs(toDateToUse).format("YYYY-MM-DD");

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
          `${URL.customerData}`,
          payload,
        )) as CustomerDataResponse;

        if (customerData) {
          if (
            customerData.customer_info &&
            customerData.customer_info.customer_name
          ) {
            setSelectedCustomerName(customerData.customer_info.customer_name);
          }

          if (customerData.customer_info) {
            setCustomerCreditDay(customerData.customer_info.credit_day);
            setCustomerSalesperson(customerData.customer_info.salesperson);
            setCustomerLastVisited(customerData.customer_info.last_visited);
            setCustomerTotalCreditAmount(
              customerData.customer_info.total_credit_amount,
            );
            setTotalRevenue(
              customerData.customer_info.overall_total_revenue ?? null,
            );
            setTotalProfit(customerData.customer_info.overall_total_gp ?? null);
            if (customerData.customer_info.total_net_balance !== undefined) {
              setTotalOutstandingAmount(
                customerData.customer_info.total_net_balance,
              );
            }
            setCustomerCurrency(customerData.customer_info.currency || "");
          }

          if (customerData.quotations && customerData.quotations.data) {
            setQuotationData(customerData.quotations.data);
          } else {
            setQuotationData([]);
          }

          if (customerData.call_entries && customerData.call_entries.data) {
            setCallEntryData(customerData.call_entries.data);
          } else {
            setCallEntryData([]);
          }

          if (customerData.shipment && customerData.shipment.data) {
            setShipmentData(customerData.shipment.data);
          } else {
            setShipmentData([]);
          }

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
    [customerDataFromDate, customerDataToDate],
  );

  const handleCustomerNameClick = useCallback(
    (customer: CustomerData) => {
      const prev = getPreviousMonthRange();
      setCustomerDataFromDate(prev.from);
      setCustomerDataToDate(prev.to);
      fetchCustomerData(
        customer.customer_code,
        customer.customer_name,
        prev.from,
        prev.to,
      );
      openCustomerDataDrawer();
    },
    [fetchCustomerData, openCustomerDataDrawer],
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
        header: "Vendor Code",
        size: 150,
      },
      {
        accessorKey: "customer_name",
        header: "Vendor Name",
        size: 250,
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
      {
        accessorKey: "customer_type_name",
        header: "Vendor Type",
        size: 150,
        Cell: ({ row, cell }) => {
          const rowData = row.original as CustomerData;
          const typeNames =
            rowData.customer_types
              ?.map((item) => item?.customer_type_name?.trim())
              .filter((name): name is string => Boolean(name)) || [];

          return (
            <Text size="sm">
              {typeNames.length > 0
                ? typeNames.join(", ")
                : cell.getValue<string>() || "N/A"}
            </Text>
          );
        },
      },
      {
        accessorKey: "term_code",
        header: "Term Code",
        size: 120,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "N/A"}</Text>
        ),
      },
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
        header: "Actions",
        size: 70,
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
                  onClick={() => handleViewCustomer(row.original)}
                >
                  <Group gap={"sm"}>
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text
                      size="sm"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      View
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => handleEditCustomer(row.original)}
                >
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text
                      size="sm"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Edit
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [handleViewCustomer, handleEditCustomer, handleCustomerNameClick],
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
    initialState: {
      pagination: { pageSize: 25, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: totalRecords,
    state: {
      pagination,
    },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "sm",
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
        px="md"
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
              c={"#1E293B"}
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              Vendor Master List
            </Text>

            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size={16} />}
                rightSection={
                  search ? (
                    <ActionIcon
                      variant="transparent"
                      size="sm"
                      onClick={() => setSearch("")}
                      style={{ cursor: "pointer" }}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
                w={248}
                size="sm"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
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
                    "&:active": {
                      border: "1px solid #105476",
                      color: "#FFFFFF",
                    },
                  },
                }}
              >
                <IconFilter size={18} />
              </ActionIcon>
              {showCreateButton && (
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
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/master/vendor/create");
                  }}
                >
                  Create New
                </Button>
              )}
            </Group>
          </Group>
        </Box>

        {showFilters && (
          <Box
            tt="capitalize"
            mb="sm"
            p="sm"
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
              px="md"
              style={{
                backgroundColor: "#F8FAFC",
                padding: "4px 8px",
              }}
            >
              <Text
                size="sm"
                fw={600}
                c="#1E293B"
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

            <Grid gutter="sm" px="md" pt="xs" pb="sm">
              <Grid.Col span={2.4}>
                <SearchableSelect
                  size="xs"
                  label="Vendor Name"
                  placeholder="Type customer name"
                  apiEndpoint={URL.allCustomers}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code as string),
                    label: item.customer_name as string,
                  })}
                  value={draftFilters.customer_name}
                  displayValue={draftFilters.customer_name_label}
                  onChange={(value, selectedData) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      customer_name: value || null,
                      customer_name_label: selectedData?.label || null,
                    }));
                  }}
                  minSearchLength={2}
                  dropdownZIndex={1000}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <Select
                  label="Vendor Type"
                  placeholder="Supplier / Carrier / Transporter"
                  searchable
                  clearable
                  size="xs"
                  data={vendorCustomerTypeOptions}
                  value={draftFilters.customer_type_id || null}
                  onChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      customer_type_id: value || null,
                    }))
                  }
                  styles={{
                    input: { fontSize: "12px", fontFamily: "Inter" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                      marginBottom: "4px",
                      fontFamily: "Inter",
                    },
                  }}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <Select
                  label="Salesperson"
                  placeholder="Select salesperson"
                  searchable
                  clearable
                  size="xs"
                  data={salespersonOptions}
                  value={draftFilters.assigned_to_display || null}
                  onChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      assigned_to_display: value || null,
                    }))
                  }
                  styles={{
                    input: { fontSize: "12px", fontFamily: "Inter" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                      marginBottom: "4px",
                      fontFamily: "Inter",
                    },
                  }}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
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
                    setDraftFilters((prev) => ({
                      ...prev,
                      country: value || null,
                      state: null,
                    }));
                    setSelectedState(null);
                  }}
                  styles={{
                    input: { fontSize: "12px", fontFamily: "Inter" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                      marginBottom: "4px",
                      fontFamily: "Inter",
                    },
                  }}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
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
                    setDraftFilters((prev) => ({
                      ...prev,
                      state: value || null,
                    }));
                  }}
                  disabled={statesLoading}
                  nothingFoundMessage={
                    statesLoading
                      ? "Loading state values..."
                      : "No states found"
                  }
                  styles={{
                    input: { fontSize: "12px", fontFamily: "Inter" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                      marginBottom: "4px",
                      fontFamily: "Inter",
                    },
                  }}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <TextInput
                  label="City"
                  placeholder="Type city name"
                  size="xs"
                  value={draftFilters.city || ""}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      city: e.currentTarget.value || null,
                    }))
                  }
                  styles={{
                    input: { fontSize: "12px", fontFamily: "Inter" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
                      marginBottom: "4px",
                      fontFamily: "Inter",
                    },
                  }}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
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
                  value={draftFilters.status || null}
                  onChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: value || null,
                    }))
                  }
                  styles={{
                    input: { fontSize: "12px", fontFamily: "Inter" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#424242",
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
                leftSection={<IconX size={16} />}
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
                Clear Filters
              </Button>
              <Button
                size="sm"
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
                leftSection={<IconFilter size={16} />}
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
                Apply Filters
              </Button>
            </Group>
          </Box>
        )}

        {isLoading ? (
          <Center py="xl" style={{ flex: 1 }}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading vendors...</Text>
            </Stack>
          </Center>
        ) : listError ? (
          <Center py="xl" style={{ flex: 1 }}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">
                Error loading vendor data. Please try refreshing the page.
              </Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />
            <PaginationBar
              pageSize={pagination.pageSize}
              currentPage={currentPage}
              totalRecords={totalRecords}
              onPageSizeChange={handlePageSizeChange}
              onPageChange={handlePageChange}
              pageSizeOptions={["10", "25", "50"]}
            />
          </>
        )}
      </Card>

      <CustomerDataDrawer
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
          setSelectedCustomerName("");
          setSelectedCustomerCode("");
          const pm = getPreviousMonthRange();
          setCustomerDataFromDate(pm.from);
          setCustomerDataToDate(pm.to);
          setTotalOutstandingAmount(0);
        }}
        title={`Vendor Data for ${selectedCustomerName}`}
        isLoading={isLoadingData}
        customerSalesperson={customerSalesperson}
        customerCreditDay={customerCreditDay}
        customerLastVisited={customerLastVisited}
        customerTotalCreditAmount={customerTotalCreditAmount}
        totalOutstandingAmount={totalOutstandingAmount}
        customerCurrency={customerCurrency}
        totalRevenue={totalRevenue}
        totalProfit={totalProfit}
        isAdmin={true}
        fromDate={customerDataFromDate}
        toDate={customerDataToDate}
        onFromDateChange={(date) => {
          setCustomerDataFromDate(date);
          if (
            selectedCustomerCode &&
            selectedCustomerName &&
            date &&
            customerDataToDate
          ) {
            fetchCustomerData(
              selectedCustomerCode,
              selectedCustomerName,
              date,
              customerDataToDate,
            );
          }
        }}
        onToDateChange={(date) => {
          setCustomerDataToDate(date);
          if (
            selectedCustomerCode &&
            selectedCustomerName &&
            customerDataFromDate &&
            date
          ) {
            fetchCustomerData(
              selectedCustomerCode,
              selectedCustomerName,
              customerDataFromDate,
              date,
            );
          }
        }}
        quotationData={quotationData}
        shipmentData={shipmentData}
        callEntryData={callEntryData}
        potentialProfilingData={potentialProfilingData}
        onQuotationClick={(quotation) => {
          navigate("/quotation-create", {
            state: {
              enquiry_id: quotation.enquiry_id,
              service: quotation.service,
              quotationData: quotation,
              customerData: {
                customer_code: selectedCustomerCode,
                customer_name: selectedCustomerName,
                total_net_balance: totalOutstandingAmount,
              },
              returnTo: "customer-create",
              returnToState: {
                customer: selectedCustomerCode,
                customerName: selectedCustomerName,
                openDrawer: true,
              },
            },
          });
        }}
      />
    </>
  );
}
