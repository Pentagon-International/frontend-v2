import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Divider,
  Drawer,
  Flex,
  Grid,
  Group,
  Loader,
  Menu,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconPlus,
  IconTrash,
  IconUserScan,
} from "@tabler/icons-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useDisclosure } from "@mantine/hooks";
import { DateInput } from "@mantine/dates";
import { getAPICall } from "../../service/getApiCall";
import { getCallEntryDetails } from "../../service/dashboard.service";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import dayjs from "dayjs";
import { postAPICall } from "../../service/postApiCall";
import { putAPICall } from "../../service/putApiCall";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
} from "../../components";
import useAuthStore from "../../store/authStore";
import { toTitleCase } from "../../utils/textFormatter";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useQueryClient, useQuery } from "@tanstack/react-query";

// Removed fetchCustomerNames - using SearchableSelect for dynamic loading

type CompanyFormData = {
  customer: string;
  call_date: string;
  call_mode: string;
  call_summary: string;
  followup_date: string;
  followup_action: string;
  expected_profit: string;
  latitude: string;
  longitude: string;
  status: "ACTIVE" | "CLOSE";
  remark: string;
};

type CompanyData = {
  id: number;
  company_code: string;
  company_name: string;
  website: string;
  reporting_name: string;
  status: string;
  group_name: string;
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

type JobData = {
  id: number;
  location_name: string;
  segment_cost_center_code: string;
  segment_name: string;
  segment_code: string;
  job_no: string;
  subjob_no: string;
  job_date: string;
  job_close_date: string;
  shipper_name: string;
  consignee_name: string;
  job_created_user: string;
  subjob_close_date: string;
  subjob_status: string;
  pol_country: string;
  fdc_country: string;
  who_routed: string;
  vessel_name: string | null;
  voyage: string;
  salesman: string;
  billing_customer: string;
  lcl_cbm: number;
  fcl_teu: number;
  air_kg: number;
  wip_date: string | null;
  sales_coordinator: string | null;
  revenue: number;
  cost: number;
  neutral: number;
  profit: number;
  profit_percentage: number;
  pol: string;
  pod: string;
  origin_agent: string | null;
  destination_agent: string | null;
};

// Commented out - local_outstanding key will be removed from response
// type NetBalanceData = {
//   id: number;
//   company_code: string;
//   branch_code: string;
//   location_code: string;
//   branch_name: string;
//   account_code: string;
//   customer_code: string;
//   customer_name: string;
//   category_code: string | null;
//   category_name: string | null;
//   group_code: string | null;
//   customer_group_name: string | null;
//   salesman_code: string;
//   salesman_name: string;
//   daybook_code: string;
//   document_type: string;
//   document_no: string;
//   segment_code: string;
//   segment_name: string;
//   job_no: string;
//   subjob_no: string;
//   house_no: string;
//   credit_day: number;
//   credit_amount: number;
//   total_balance: number;
//   unadj_credit: number;
//   net_balance: number;
//   days_0_15: number;
//   days_16_30: number;
//   days_31_45: number;
//   days_46_60: number;
//   days_61_90: number;
//   days_91_120: number;
//   days_121_180: number;
//   days_181_365: number;
//   days_366_730: number;
//   days_730: number;
//   narration: string;
//   master_no: string;
//   fdc: string;
//   total_os_days: number;
//   net_usd: string;
// };

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

type UserMasterData = {
  id: number;
  user_id: string;
  user_name: string;
  employee_id: string;
  pulse_id: string | null;
  email_id: string;
  status: string;
};

type NearbyCustomerData = {
  id: number;
  customer: string;
  email_id: string;
  phone_no: string;
  address: string;
  pin1: string;
  contact_person: string;
  city: string;
  state: string;
  status: string;
};

type NearbyCustomersResponse = {
  success: boolean;
  message: string;
  pincode_searched: string;
  pincode_range: string[];
  total_customers: number;
  debug_info: {
    total_customers_with_pincode: number;
    unassigned_customers_with_pincode: number;
  };
  data: NearbyCustomerData[];
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
  // Commented out - local_outstanding key will be removed from response
  // local_outstanding: {
  //   count: number;
  //   data: NetBalanceData[];
  // };
  job_profit: {
    count: number;
    data: JobData[];
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

function CallEntryNew() {
  const [callModeOptions, setcallModeOptions] = useState<
    { value: string; label: string }[]
  >([]);
  // Remove the customerNames state since we'll use React Query
  const [followUpAction, setfollowUpAction] = useState<
    { value: string; label: string }[]
  >([]);
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { id: callEntryId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [opened, { open, close }] = useDisclosure(false);
  const [nearbyCustomer, { open: openCustomer, close: closeCustomer }] =
    useDisclosure(false);
  const [isLoadingCallEntryData, setIsLoadingCallEntryData] = useState(false);
  const [
    openedParticipant,
    { open: openParticipant, close: closeParticipant },
  ] = useDisclosure(false);
  const [
    quotationDrawer,
    { open: openQuotationDrawer, close: closeQuotationDrawer },
  ] = useDisclosure(false);

  const [data, setData] = useState<CompanyData[]>([]);
  const [participantsData, setParticipants] = useState<any[]>([]);

  // Pagination state for profiling table
  const [profilingPageIndex, setProfilingPageIndex] = useState(0);
  const [profilingPageSize, setProfilingPageSize] = useState(25);
  const [profilingTotalCount, setProfilingTotalCount] = useState(0);
  const [isLoadingProfiling, setIsLoadingProfiling] = useState(false);

  // Pagination state for participants table
  const [participantsPageIndex, setParticipantsPageIndex] = useState(0);
  const [participantsPageSize, setParticipantsPageSize] = useState(25);
  const [participantsTotalCount, setParticipantsTotalCount] = useState(0);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [quotationData, setQuotationData] = useState<QuotationData[]>([]);
  const [jobData, setJobData] = useState<JobData[]>([]);
  // Commented out - local_outstanding key will be removed from response
  // const [netBalanceData, setNetBalanceData] = useState<NetBalanceData[]>([]);
  const [callEntryData, setCallEntryData] = useState<CallEntryData[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [selectedCustomerData, setSelectedCustomerData] = useState<any>(null);
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  const [potentialProfilingData, setPotentialProfilingData] = useState<
    PotentialProfilingData[]
  >([]);
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
  ); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [totalOutstandingAmount, setTotalOutstandingAmount] =
    useState<number>(0);
  const [closeCallEntry, setCloseCallEntry] = useState<boolean>(false);

  // Location state management
  const [location, setLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
    pincode: string | null;
  }>({ latitude: null, longitude: null, pincode: null });
  const [locationPermission, setLocationPermission] = useState<
    "granted" | "denied" | "prompt"
  >("prompt");
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);

  //Profiling Dropdown states
  const [frequencyProfile, setFrequencyProfile] = useState<any[]>([]);

  // Fetch user master data for assignment functionality
  const { data: usersData = [] } = useQuery({
    queryKey: ["userMaster"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          URL.user,
          API_HEADER
        )) as UserMasterData[];
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

  const getDropdownData = async () => {
    try {
      const frequencyData = await getAPICall(`${URL.frequency}`, API_HEADER);

      const frequencyOptions = (frequencyData as any[]).map((item: any) => ({
        value: String(item.id),
        label: item.frequency_name,
      }));

      setFrequencyProfile(frequencyOptions);
    } catch (e) {
      console.log("Error in getDropdownData=", e);
    }
  };

  const fetchProfiling = async (
    pageIndex: number = profilingPageIndex,
    pageSize: number = profilingPageSize
  ) => {
    const customerVal = callEntryForm.getValues().customer;
    getDropdownData();

    try {
      if (customerVal) {
        setIsLoadingProfiling(true);
        // Convert to 0-based index for API (API expects 0-based)
        const index = pageIndex * pageSize;
        const data = await getAPICall(
          `${URL.profiling}?customer_code=${customerVal}&index=${index}&limit=${pageSize}`,
          API_HEADER
        );

        // Handle paginated response
        if (data && typeof data === "object" && "data" in data) {
          const response = data as {
            success?: boolean;
            total?: number;
            data: CompanyData[];
          };
          setData(response.data || []);
          setProfilingTotalCount(response.total || 0);
        } else if (Array.isArray(data)) {
          // Fallback for non-paginated response
          setData(data as CompanyData[]);
          setProfilingTotalCount(data.length);
        } else {
          setData([]);
          setProfilingTotalCount(0);
        }
      } else {
        ToastNotification({
          type: "warning",
          message: "Select a customer name",
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setData([]);
      setProfilingTotalCount(0);
    } finally {
      setIsLoadingProfiling(false);
    }
  };
  const fetchParticipants = async (
    pageIndex: number = participantsPageIndex,
    pageSize: number = participantsPageSize
  ) => {
    try {
      setIsLoadingParticipants(true);
      // Convert to 0-based index for API (API expects 0-based)
      const index = pageIndex * pageSize;
      const data = await getAPICall(
        `${URL.participants}?index=${index}&limit=${pageSize}`,
        API_HEADER
      );

      // Handle paginated response
      if (data && typeof data === "object" && "data" in data) {
        const response = data as {
          success?: boolean;
          total?: number;
          data: any[];
        };
        setParticipants(response.data || []);
        setParticipantsTotalCount(response.total || 0);
      } else if (Array.isArray(data)) {
        // Fallback for non-paginated response
        setParticipants(data as any[]);
        setParticipantsTotalCount(data.length);
      } else {
        setParticipants([]);
        setParticipantsTotalCount(0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setParticipants([]);
      setParticipantsTotalCount(0);
    } finally {
      setIsLoadingParticipants(false);
    }
  };
  // State for nearby customers data
  const [nearbyCustomersData, setNearbyCustomersData] = useState<
    NearbyCustomerData[]
  >([]);
  const [isLoadingNearbyCustomers, setIsLoadingNearbyCustomers] =
    useState<boolean>(false);

  const fetchNearbyCustomers = async (pincode: string) => {
    try {
      setIsLoadingNearbyCustomers(true);
      const payload = {
        pincode: pincode,
      };

      const response = (await postAPICall(
        URL.nearbyCustomers,
        payload,
        API_HEADER
      )) as NearbyCustomersResponse;

      if (response && response.success && Array.isArray(response.data)) {
        setNearbyCustomersData(response.data);

        // Show success message with details
        // ToastNotification({
        //   type: "success",
        //   message:
        //     response.message ||
        //     `Found ${response.total_customers} nearby customers for pincode ${pincode}`,
        // });
      } else {
        setNearbyCustomersData([]);
        ToastNotification({
          type: "info",
          message: "No nearby customers found for this pincode",
        });
      }
    } catch (err: unknown) {
      console.error("Error fetching nearby customers:", err);
      setNearbyCustomersData([]);
      ToastNotification({
        type: "error",
        message: `Failed to fetch nearby customers: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setIsLoadingNearbyCustomers(false);
    }
  };

  const handleAssignToMe = useCallback(
    async (customerData: NearbyCustomerData) => {
      try {
        // Check if user is logged in
        if (!user) {
          ToastNotification({
            type: "error",
            message: "User not logged in. Please login to assign customers.",
          });
          return;
        }

        // Find the current user in the user-master data
        const currentUserInMaster = usersData.find((userMaster) => {
          // Compare by pulse_id, email, or user_id
          return (
            userMaster.pulse_id === user.pulse_id ||
            userMaster.email_id === user.email ||
            userMaster.user_id === user.user_id.toString()
          );
        });

        if (!currentUserInMaster) {
          ToastNotification({
            type: "error",
            message:
              "Your user account is not mapped in the user-master. Please contact administrator.",
          });
          return;
        }

        // Check if user is active
        if (currentUserInMaster.status !== "ACTIVE") {
          ToastNotification({
            type: "error",
            message:
              "Your user account is not active. Please contact administrator.",
          });
          return;
        }

        // Create payload for assignment API
        // Using the potential customer ID from the nearby customers data
        const payload = {
          user_id: currentUserInMaster.id,
          potential_ids: [customerData.id], // Using potential customer ID
        };

        // Call the assignment API
        await postAPICall(URL.userPotentialMaster, payload, API_HEADER);

        ToastNotification({
          type: "success",
          message: `Customer "${customerData.customer}" has been assigned to you successfully!`,
        });

        // Refresh nearby customers data by refetching with current pincode
        if (location.pincode) {
          await fetchNearbyCustomers(location.pincode);
        }
      } catch (error) {
        console.error("Error assigning customer:", error);
        ToastNotification({
          type: "error",
          message: `Failed to assign customer: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    },
    [user, usersData, location.pincode]
  );
  // Remove the fetchCustomerNames function since we're using React Query
  const fetchfollowUpAction = async () => {
    try {
      const response = await getAPICall(`${URL.followUpAction}`, API_HEADER);

      const options = (response as any[]).map((item: any) => ({
        value: String(item.id),
        label: item.followup_name,
      }));
      setfollowUpAction(options);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchCallMode = async () => {
    try {
      const response = await getAPICall(URL.callMode, API_HEADER);

      const options = (response as any[]).map((item: any) => ({
        value: String(item.id),
        label: item.callmode_name,
      }));
      setcallModeOptions(options);
    } catch (error) {
      console.error("Failed to load group companies", error);
    }
  };

  const fetchCustomerData = async (
    customerCode: string,
    month?: number,
    year?: number
  ) => {
    try {
      setIsLoadingData(true);

      // Use provided month/year or current state values
      const monthToUse = month ?? selectedMonth;
      const yearToUse = year ?? selectedYear;

      // Calculate date_from: First day of the selected month (YYYY-MM-01)
      const dateFrom = `${yearToUse}-${String(monthToUse).padStart(2, "0")}-01`;

      // Calculate date_to: Last day of the selected month
      // Create a date object for the first day of the next month, then subtract 1 day
      const lastDayOfMonth = new Date(yearToUse, monthToUse, 0).getDate();
      const dateTo = `${yearToUse}-${String(monthToUse).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

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
        payload as any
      )) as CustomerDataResponse;
      // console.log("customerData-----", customerData);

      // Extract data from the new combined API response
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
          const quotations = customerData.quotations.data;
          // console.log("quotations----", quotations);

          setQuotationData(quotations);
        }

        // Set call entries data
        if (customerData.call_entries && customerData.call_entries.data) {
          const callEntries = customerData.call_entries.data;
          setCallEntryData(callEntries);
        }

        // Commented out - local_outstanding key will be removed from response
        // Set net balance data (for now, create a mock structure since it's not in response yet)
        // if (
        //   customerData.local_outstanding &&
        //   customerData.local_outstanding.data
        // ) {
        //   setNetBalanceData(customerData.local_outstanding.data);
        // }

        // Set shipment data
        if (customerData.shipment && customerData.shipment.data) {
          setShipmentData(customerData.shipment.data);
        } else {
          setShipmentData([]);
        }

        // Set overall totals from shipment
        // if (customerData.customer_info) {
        //   setTotalRevenue(
        //     customerData.customer_info.overall_total_revenue ?? null
        //   );
        //   setTotalProfit(customerData.customer_info.overall_total_gp ?? null);
        // } else {
        //   setTotalRevenue(null);
        //   setTotalProfit(null);
        // }

        // Set potential profiling data
        if (
          customerData.potential_profiling &&
          customerData.potential_profiling.data
        ) {
          setPotentialProfilingData(customerData.potential_profiling.data);
        } else {
          setPotentialProfilingData([]);
        }

        // Set job profit data (shipments) - keeping for backward compatibility
        if (customerData.job_profit && customerData.job_profit.data) {
          const jobProfit = customerData.job_profit.data;
          setJobData(jobProfit);
        } else {
          setJobData([]);
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
  };

  const handleCustomerChange = (value: string, customerData?: any) => {
    if (value) {
      // Store the full customer data for later use
      setSelectedCustomerData(customerData);
      // Extract customer name from selectedData if available
      // SearchableSelect passes {value, label} format
      if (customerData && customerData.label) {
        setSelectedCustomerName(customerData.label);
      } else if (customerData && customerData.customer_name) {
        // Fallback for full customer data object
        setSelectedCustomerName(customerData.customer_name);
      } else {
        setSelectedCustomerName(`${value}`);
      }
      // Don't load data automatically, only when user clicks Customer Data button
    } else {
      setSelectedCustomerName("");
      setSelectedCustomerData(null);
      setQuotationData([]);
      setJobData([]);
      // Commented out - local_outstanding key will be removed from response
      // setNetBalanceData([]);
      setCallEntryData([]);
      setShipmentData([]);
      setPotentialProfilingData([]);
      setCustomerCreditDay(null);
      setCustomerSalesperson(null);
      setCustomerLastVisited(null);
      setCustomerTotalCreditAmount(null);
      setSelectedMonth(new Date().getMonth() + 1);
      setSelectedYear(new Date().getFullYear());
      setTotalOutstandingAmount(0);
    }
  };

  useEffect(() => {
    fetchCallMode();
    // Remove fetchCustomerNames() since we're using React Query
    fetchfollowUpAction();

    // Automatically request location permission when page loads
    requestLocationPermission();
  }, []);

  // Fetch call entry details when callEntryId is provided from URL
  useEffect(() => {
    const fetchCallEntryDetails = async () => {
      if (callEntryId) {
        setIsLoadingCallEntryData(true);
        try {
          const response = await getCallEntryDetails(callEntryId);
          console.log("Fetched call entry details:", response);

          // Map call entry data to form fields
          const mappedCallEntryForm = {
            customer: response.customer_code || "",
            call_date: response.call_date || "",
            call_mode: response.call_mode_id
              ? String(response.call_mode_id)
              : "",
            call_summary: response.call_summary || "",
            followup_date: response.followup_date || "",
            followup_action: response.followup_id
              ? String(response.followup_id)
              : "",
            latitude: response.latitude || "",
            longitude: response.longitude || "",
            expected_profit: response.expected_profit
              ? String(response.expected_profit)
              : "0",
            status: ((response.status as string) || "ACTIVE") as
              | "ACTIVE"
              | "CLOSE",
            remark: (response as any).remark || "",
          };

          // Set close checkbox based on status
          setCloseCallEntry((response.status as string) === "CLOSE");

          // Set form values
          callEntryForm.setValues(mappedCallEntryForm);
          setSelectedCustomerName(response.customer_name || "");

          console.log("Mapped call entry form:", mappedCallEntryForm);
        } catch (error) {
          console.error("Error fetching call entry details:", error);
          ToastNotification({
            type: "error",
            message: "Failed to fetch call entry details",
          });
        } finally {
          setIsLoadingCallEntryData(false);
        }
      }
    };

    fetchCallEntryDetails();
  }, [callEntryId]);

  // Handle return state from QuotationCreate or PotentialCustomers
  useEffect(() => {
    if (routerLocation.state?.openDrawer && routerLocation.state?.customer) {
      const customerVal = routerLocation.state.customer;
      const customerNameFromState = routerLocation.state.customerName;

      // First priority: customer name from navigation state
      if (customerNameFromState) {
        setSelectedCustomerName(customerNameFromState);
      }
      // Second priority: stored customer data
      else if (selectedCustomerData && selectedCustomerData.customer_name) {
        setSelectedCustomerName(selectedCustomerData.customer_name);
      } else {
        // Set placeholder name - will be updated when fetchCustomerData completes
        setSelectedCustomerName(`${customerVal}`);
      }

      callEntryForm.setFieldValue("customer", customerVal);
      fetchCustomerData(customerVal);
      openQuotationDrawer();
    }
    // Handle navigation from PotentialCustomers
    else if (
      routerLocation.state?.fromPotentialCustomer &&
      routerLocation.state?.customerCode
    ) {
      const customerCode = routerLocation.state.customerCode;
      const customerName = routerLocation.state.customerName;
      const customerData = routerLocation.state.customerData;

      // Set the form field value to customer_code
      callEntryForm.setFieldValue("customer", customerCode);

      // Set the customer name for display
      if (customerName) {
        setSelectedCustomerName(customerName);
      }

      // Store the full customer data
      if (customerData) {
        setSelectedCustomerData({
          customer_code: customerCode,
          customer_name: customerName,
          ...customerData,
        });
      }
    }
    // if (routerLocation.state?.customer_code) {
    //   const customer_code = routerLocation.state.customer_code;
    //   callEntryForm.setFieldValue("customer", customer_code);
    // }
  }, [routerLocation.state]);

  const schema = yup.object().shape({
    customer: yup.string().required("Company Name is required"),
    call_date: yup.string().required("Date is required"),
    call_mode: yup.string().required("Call Mode is required"),
    call_summary: yup.string().required("Call Summary is required"),
    followup_date: yup.string().required("Follow Up Date is required"),
    followup_action: yup.string().required("Follow Up Action is required"),
  });

  const callEntryForm = useForm<CompanyFormData>({
    mode: "controlled",
    initialValues: {
      customer: "",
      call_date:
        (routerLocation.state as any)?.prefilledDate ||
        dayjs().format("YYYY-MM-DD"),
      call_mode: "",
      call_summary: "",
      followup_date: dayjs().format("YYYY-MM-DD"),
      followup_action: "",
      expected_profit: "",
      latitude: "",
      longitude: "",
      status: "ACTIVE",
      remark: "",
    },
    validate: yupResolver(schema),
  });

  const participantForm = useForm({
    initialValues: {
      participants: [
        {
          first_name: "",
          last_name: "",
          designation: "",
          mobile_no: "",
          email: "",
          department: "",
        },
      ],
    },
  });
  const profilingForm = useForm({
    initialValues: {
      profiles: [
        {
          customer_code: "",
          service: "",
          origin: "",
          destination: "",
          no_of_shipments: "",
          frequency: "",
          volume: "",
          tier: "",
          competitors: "",
          potential_profit: "",
        },
      ],
    },
  });

  // Sync closeCallEntry state when follow-up action changes
  useEffect(() => {
    if (callEntryId) {
      const selectedFollowUpAction = followUpAction.find(
        (option) => option.value === callEntryForm.values.followup_action
      );
      const isFollowUpActionClose = selectedFollowUpAction?.label === "Close";

      // If follow-up action is "Close", automatically check the close checkbox
      if (isFollowUpActionClose) {
        setCloseCallEntry(true);
      }
    }
  }, [callEntryForm.values.followup_action, followUpAction, callEntryId]);

  // Function to extract pincode from coordinates using reverse geocoding
  const getPincodeFromCoordinates = useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      try {
        console.log("latitude value---", lat);
        console.log("longitude value---", lng);

        // Using OpenStreetMap Nominatim API for reverse geocoding
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          {
            headers: {
              "User-Agent": "PentagonPrime/1.0", // Required by Nominatim
            },
          }
        );

        if (!response.ok) {
          throw new Error("Reverse geocoding failed");
        }

        const data = await response.json();

        // Extract pincode from various possible fields
        const address = data.address || {};
        const pincode = address.postcode || address.postal_code || null;

        return pincode;
      } catch (error) {
        console.error("Error getting pincode:", error);
        return null;
      }
    },
    []
  );

  // Function to get user's current location
  const getUserLocation = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
    pincode: string | null;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }

      // navigator.geolocation.getCurrentPosition(
      //   async (position) => {
      //     console.log("position value---", position);

      //     const lat = position.coords.latitude;
      //     const lng = position.coords.longitude;

      //     // Get pincode from coordinates
      //     const pincode = await getPincodeFromCoordinates(lat, lng);

      //     resolve({ latitude: lat, longitude: lng, pincode });
      //   },
      //   (error) => {
      //     reject(error);
      //   },
      //   {
      //     enableHighAccuracy: true,
      //     timeout: 10000,
      //     maximumAge: 0, // 5 minutes
      //   }
      // );
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log("position value ---", position);

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy; // accuracy in meters

          console.log("Accuracy (meters):", accuracy);

          // Get pincode from coordinates
          const pincode = await getPincodeFromCoordinates(lat, lng);

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy,
            pincode,
          });
        },
        (error) => {
          console.error("Geolocation Error:", error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000, // give GPS time to lock
          maximumAge: 0, // no cached location
        }
      );
    });
  }, [getPincodeFromCoordinates]);

  // Function to request location permission and get coordinates
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsGettingLocation(true);
      setLocationPermission("prompt");

      const locationData = await getUserLocation();

      setLocation({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        pincode: locationData.pincode,
      });

      // Update form with coordinates
      callEntryForm.setFieldValue("latitude", String(locationData.latitude));
      callEntryForm.setFieldValue("longitude", String(locationData.longitude));

      setLocationPermission("granted");

      // ToastNotification({
      //   type: "success",
      //   message: locationData.pincode
      //     ? `Location accessed!`
      //     : "Location accessed successfully!",
      // });

      return true;
    } catch (error: any) {
      setLocationPermission("denied");

      let errorMessage = "Failed to access location";
      if (error.code === 1) {
        errorMessage =
          "Location access denied. Please enable location permissions to use nearby customers feature.";
      } else if (error.code === 2) {
        errorMessage =
          "Location unavailable. Please check your internet connection.";
      } else if (error.code === 3) {
        errorMessage = "Location request timed out. Please try again.";
      }

      // ToastNotification({
      //   type: "error",
      //   message: errorMessage,
      // });

      return false;
    } finally {
      setIsGettingLocation(false);
    }
  }, [getUserLocation, callEntryForm]);

  const addParticipant = () => {
    participantForm.insertListItem("participants", {
      first_name: "",
      last_name: "",
      designation: "",
      mobile_no: "",
      email: "",
      department: "",
    });
  };

  const removeParticipant = (index: number) => {
    participantForm.removeListItem("participants", index);
  };

  const handleParticipantSubmit = async (
    values: typeof participantForm.values
  ) => {
    const participants = values.participants;

    for (const participant of participants) {
      try {
        await postAPICall(URL.participants, participant as any, API_HEADER);
      } catch (error) {
        console.error("Error submitting profile:", error);
      }
    }
    participantForm.reset();
  };

  const handleCreateForm = async (values: CompanyFormData): Promise<void> => {
    const participantFormData = participantForm.values;

    const customerVal = callEntryForm.getValues().customer;
    const profilingFormData = profilingForm.values;

    const updatedProfiles = profilingFormData.profiles.map((profile) => ({
      ...profile,
      customer_code: customerVal,
    }));

    const payload = {
      profiles: updatedProfiles,
    };
    console.log("Profiling payload---", payload);
    console.log("participantFormData payload---", participantFormData);

    // const profileCheck = payload.profiles.every((item) =>
    //   Object.values(item).every((value) => value !== null && value !== "")
    // );
    // console.log("profileCheck---", profileCheck);

    // if (profileCheck) {
    handleProfilingSubmit(payload as any);
    // }

    try {
      let response;

      // Check if this is an edit operation
      if (callEntryId) {
        // Edit mode: Use PUT request with ID appended to URL
        // If close checkbox is checked, set status to CLOSE, otherwise use form status
        const finalStatus =
          closeCallEntry || values.followup_action == "4"
            ? "CLOSE"
            : values.status;

        // Validate remark when closing
        if (finalStatus === "CLOSE" && !values.remark?.trim()) {
          callEntryForm.setFieldError(
            "remark",
            "Remark is required when closing call entry"
          );
          ToastNotification({
            type: "error",
            message: "Remark is required when closing call entry",
          });
          return;
        }

        const editPayload: any = {
          customer: values.customer,
          call_date: values.call_date,
          call_mode: values.call_mode,
          call_summary: values.call_summary,
          followup_date: values.followup_date,
          followup_action: values.followup_action,
          expected_profit: values.expected_profit
            ? parseFloat(values.expected_profit)
            : 0,
          latitude: values.latitude,
          longitude: values.longitude,
          status: finalStatus,
          id: parseInt(callEntryId), // ID used for URL construction by putAPICall
        };

        // Include remark when closing
        if (finalStatus === "CLOSE" && values.remark?.trim()) {
          editPayload.remark = values.remark.trim();
        }
        console.log("Updating call entry with payload:", editPayload);

        response = await putAPICall(
          URL.callEntry,
          editPayload as any,
          API_HEADER
        );
        console.log("Updated call entry response:", response);

        ToastNotification({
          type: "success",
          message: "Call Entry updated successfully",
        });
      } else {
        // Create mode: Use POST request
        response = await postAPICall(URL.callEntry, values as any, API_HEADER);
        console.log("callentry response---", response);

        if (response && typeof response === "object" && "id" in response) {
          const callEntryID = (response as any).id;

          const updatedParticipant = participantFormData.participants.map(
            (participant) => ({
              ...participant,
              call: callEntryID,
            })
          );

          const participantPayload = {
            participants: updatedParticipant,
          };

          const participantsCheck = participantPayload.participants.every(
            (item) =>
              Object.values(item).every(
                (value) => value !== null && value !== ""
              )
          );
          if (participantsCheck) {
            handleParticipantSubmit(participantPayload as any);
          }
        }

        ToastNotification({
          type: "success",
          message: "Call Entry created successfully",
        });
      }

      // Invalidate all call entry related queries to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
      await queryClient.invalidateQueries({
        queryKey: ["filteredCallEntries"],
      });
      await queryClient.invalidateQueries({ queryKey: ["callEntrySearch"] });

      if (response) {
        const returnTo =
          (routerLocation.state as any)?.returnTo || "/call-entry";
        const returnToState = (routerLocation.state as any)?.returnToState;

        // Handle dashboard-pipeline returnTo similar to Cancel button
        if (returnTo === "dashboard-pipeline") {
          // Navigate back to dashboard with pipeline report state
          navigate("/", {
            state: {
              returnToPipelineReport: true,
              pipelineReportState: (routerLocation.state as any)
                ?.pipelineReportState,
              refreshData: true,
              timestamp: Date.now(),
            },
          });
        } else if (returnTo === "/" && returnToState) {
          // Navigate back to dashboard with call entry detailed view state
          navigate("/", {
            state: {
              returnToCallEntryDetailedView: true,
              dashboardState: returnToState,
              refreshData: true,
              timestamp: Date.now(),
            },
          });
        } else {
          // Navigate with a refresh flag to trigger data reload
          // Don't preserve filters on submit - clear them
          navigate(returnTo, {
            state: {
              refreshData: true,
              timestamp: Date.now(),
            },
          });
        }
      }
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while ${callEntryId ? "updating" : "creating"} call entry: ${err.message}`,
      });
    }
  };

  const handleAddProfile = () => {
    profilingForm.insertListItem("profiles", {
      customer_code: "",
      service: "",
      origin: "",
      destination: "",
      no_of_shipments: "",
      frequency: "",
      volume: "",
      tier: "",
      competitors: "",
      potential_profit: "",
    });
  };

  const handleRemoveProfile = (index: number) => {
    profilingForm.removeListItem("profiles", index);
  };

  const handleProfilingSubmit = async (values: any): Promise<void> => {
    const profiles = values.profiles;

    for (const profile of profiles) {
      if (profile.service && profile.no_of_shipments) {
        try {
          const response = await postAPICall(
            URL.profiling,
            profile as any,
            API_HEADER
          );
          if (response) {
            profilingForm.reset();
          }
        } catch (error) {
          console.error("Error submitting profile:", error);
        }
      }
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
        accessorKey: "service",
        header: "Service",
        size: 100,
      },
      {
        accessorKey: "origin_port_name",
        header: "Origin",
        size: 150,
      },
      {
        accessorKey: "destination_port_name",
        header: "Destination",
        size: 150,
      },
      {
        accessorKey: "no_of_shipments",
        header: "No.of Shipments",
        size: 150,
      },
      {
        accessorKey: "frequency_name",
        header: "Frequency",
        size: 150,
      },
      {
        accessorKey: "tier",
        header: "Qty",
        size: 100,
      },
      {
        accessorKey: "volume",
        header: "Unit",
        size: 100,
      },
      {
        accessorKey: "potential_profit",
        header: "Potential Profit",
        size: 100,
      },
    ],
    []
  );
  const participantColumns = useMemo<MRT_ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: "First Name",
        size: 100,
      },
      {
        accessorKey: "last_name",
        header: "Last Name",
        size: 150,
      },
      {
        accessorKey: "designation",
        header: "Designation",
        size: 150,
      },
      {
        accessorKey: "mobile_no",
        header: "Mobile Number",
        size: 150,
      },
      {
        accessorKey: "email",
        header: "Email",
        size: 150,
      },
      {
        accessorKey: "department",
        header: "Department",
        size: 100,
      },
    ],
    []
  );
  const nearbyCustomerColumns = useMemo<MRT_ColumnDef<NearbyCustomerData>[]>(
    () => [
      {
        accessorKey: "customer",
        header: "Customer",
        size: 150,
      },
      {
        accessorKey: "email_id",
        header: "Email ID",
        size: 200,
      },
      {
        accessorKey: "phone_no",
        header: "Phone Number",
        size: 150,
      },
      {
        accessorKey: "address",
        header: "Address",
        size: 300,
      },
      {
        accessorKey: "pin1",
        header: "Pincode",
        size: 100,
      },
      {
        accessorKey: "contact_person",
        header: "Contact Person",
        size: 200,
      },
      {
        accessorKey: "city",
        header: "City",
        size: 120,
      },
      {
        accessorKey: "state",
        header: "State",
        size: 120,
      },
      {
        id: "assign_to_me",
        header: "Action",
        Cell: ({ row }) => (
          <Button
            size="xs"
            variant="filled"
            color="#105476"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              borderRadius: "4px",
              padding: "4px 8px",
              minWidth: "80px",
            }}
            onClick={() => handleAssignToMe(row.original)}
          >
            Assign to me
          </Button>
        ),
        size: 120,
        enableSorting: false,
        enableColumnFilter: false,
      },
    ],
    [handleAssignToMe]
  );

  const nearbyCustomerTable = useMantineReactTable({
    columns: nearbyCustomerColumns,
    data: nearbyCustomersData || [],
    enableColumnActions: false,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableSorting: false,
    mantineTableContainerProps: {
      style: {
        maxHeight: "400px",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "12px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        color: "#444955",
        borderBottom: "1px solid #E9ECEF",
        whiteSpace: "nowrap",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "12px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        fontWeight: 700,
        color: "#000000",
        backgroundColor: "#FAFAFA",
        borderBottom: "1px solid #E9ECEF",
        whiteSpace: "nowrap",
      },
    },
    mantinePaginationProps: {
      size: "xs",
    },
    mantineSearchTextInputProps: {
      size: "xs",
    },
    mantineToolbarAlertBannerProps: {
      style: { fontSize: "13px" },
    },
    // renderBottomToolbarCustomActions: () => (
    //   <Group w="100%" justify="space-between" px="md" py="xs">
    //     <Group>
    //       <Text size="sm" c={"dimmed"}>
    //         Items per page
    //       </Text>
    //       <Select
    //         value={pageSize.toString()}
    //         onChange={(val) => {
    //           setPageSize(Number(val));
    //           setPageIndex(0);
    //         }}
    //         data={["5"]}
    //         w={80}
    //       />
    //       <Text size="sm" c={"dimmed"}>
    //         {startItem}–{endItem} of {rowCount} items
    //       </Text>
    //     </Group>

    //     {/* Pagination Controls */}
    //     <Group>
    //       <ActionIcon
    //         // onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
    //         disabled={pageIndex === 0}
    //         // disabled={pageIndex + 1 >= totalPages}
    //         onClick={() => {
    //           const newPage = pageIndex - 1;
    //           setPageIndex(newPage);
    //           fetchProfiling(pageIndex + 1, pageSize);
    //         }}
    //         variant="default"
    //       >
    //         <IconChevronLeft size={18} />
    //       </ActionIcon>
    //       <Text size="sm" w={20} ta="center">
    //         {pageIndex + 1}
    //       </Text>
    //       <Text size="sm" c="dimmed">
    //         of {totalPages} pages
    //       </Text>
    //       <ActionIcon
    //         onClick={() => {
    //           setPageIndex((p) => Math.min(totalPages - 1, p + 1));
    //           //   handlePaginationNext();
    //         }}
    //         disabled={pageIndex === totalPages - 1}
    //         variant="default"
    //       >
    //         <IconChevronRight size={18} />
    //       </ActionIcon>
    //     </Group>
    //   </Group>
    // ),
  });

  const participantsTable = useMantineReactTable({
    columns: participantColumns,
    data: participantsData,
    manualPagination: true,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    initialState: {
      pagination: {
        pageIndex: participantsPageIndex,
        pageSize: participantsPageSize,
      },
    },
    state: {
      pagination: {
        pageIndex: participantsPageIndex,
        pageSize: participantsPageSize,
      },
    },
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const newPagination = updater({
          pageIndex: participantsPageIndex,
          pageSize: participantsPageSize,
        });
        setParticipantsPageIndex(newPagination.pageIndex);
        setParticipantsPageSize(newPagination.pageSize);
        fetchParticipants(newPagination.pageIndex, newPagination.pageSize);
      } else {
        setParticipantsPageIndex(updater.pageIndex);
        setParticipantsPageSize(updater.pageSize);
        fetchParticipants(updater.pageIndex, updater.pageSize);
      }
    },
    pageCount: Math.ceil(participantsTotalCount / participantsPageSize),
    mantineTableContainerProps: {
      style: {
        maxHeight: "400px",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "12px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        color: "#444955",
        borderBottom: "1px solid #E9ECEF",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "12px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        fontWeight: 700,
        color: "#000000",
        backgroundColor: "#FAFAFA",
        borderBottom: "1px solid #E9ECEF",
      },
    },
    mantinePaginationProps: {
      size: "xs",
    },
    mantineSearchTextInputProps: {
      size: "xs",
    },
    mantineToolbarAlertBannerProps: {
      style: { fontSize: "13px" },
    },
    // renderBottomToolbarCustomActions: () => (
    //   <Group w="100%" justify="space-between" px="md" py="xs">
    //     <Group>
    //       <Text size="sm" c={"dimmed"}>
    //         Items per page
    //       </Text>
    //       <Select
    //         value={pageSize.toString()}
    //         onChange={(val) => {
    //           setPageSize(Number(val));
    //           setPageIndex(0);
    //         }}
    //         data={["5"]}
    //         w={80}
    //       />
    //       <Text size="sm" c={"dimmed"}>
    //         {startItem}–{endItem} of {rowCount} items
    //       </Text>
    //     </Group>

    //     {/* Pagination Controls */}
    //     <Group>
    //       <ActionIcon
    //         // onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
    //         disabled={pageIndex === 0}
    //         // disabled={pageIndex + 1 >= totalPages}
    //         onClick={() => {
    //           const newPage = pageIndex - 1;
    //           setPageIndex(newPage);
    //           fetchProfiling(pageIndex + 1, pageSize);
    //         }}
    //         variant="default"
    //       >
    //         <IconChevronLeft size={18} />
    //       </ActionIcon>
    //       <Text size="sm" w={20} ta="center">
    //         {pageIndex + 1}
    //       </Text>
    //       <Text size="sm" c="dimmed">
    //         of {totalPages} pages
    //       </Text>
    //       <ActionIcon
    //         onClick={() => {
    //           setPageIndex((p) => Math.min(totalPages - 1, p + 1));
    //           //   handlePaginationNext();
    //         }}
    //         disabled={pageIndex === totalPages - 1}
    //         variant="default"
    //       >
    //         <IconChevronRight size={18} />
    //       </ActionIcon>
    //     </Group>
    //   </Group>
    // ),
  });
  const table = useMantineReactTable({
    columns,
    data,
    manualPagination: true,
    enableColumnFilters: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    initialState: {
      pagination: {
        pageIndex: profilingPageIndex,
        pageSize: profilingPageSize,
      },
    },
    state: {
      pagination: {
        pageIndex: profilingPageIndex,
        pageSize: profilingPageSize,
      },
    },
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const newPagination = updater({
          pageIndex: profilingPageIndex,
          pageSize: profilingPageSize,
        });
        setProfilingPageIndex(newPagination.pageIndex);
        setProfilingPageSize(newPagination.pageSize);
        fetchProfiling(newPagination.pageIndex, newPagination.pageSize);
      } else {
        setProfilingPageIndex(updater.pageIndex);
        setProfilingPageSize(updater.pageSize);
        fetchProfiling(updater.pageIndex, updater.pageSize);
      }
    },
    pageCount: Math.ceil(profilingTotalCount / profilingPageSize),
    mantineTableContainerProps: {
      style: {
        maxHeight: "400px",
        overflowY: "auto",
        overflowX: "auto",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "12px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        color: "#444955",
        borderBottom: "1px solid #E9ECEF",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "12px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        fontWeight: 700,
        color: "#000000",
        backgroundColor: "#FAFAFA",
        borderBottom: "1px solid #E9ECEF",
      },
    },
    mantinePaginationProps: {
      size: "xs",
    },
    mantineSearchTextInputProps: {
      size: "xs",
    },
    mantineToolbarAlertBannerProps: {
      style: { fontSize: "13px" },
    },
    // renderBottomToolbarCustomActions: () => (
    //   <Group w="100%" justify="space-between" px="md" py="xs">
    //     <Group>
    //       <Text size="sm" c={"dimmed"}>
    //         Items per page
    //       </Text>
    //       <Select
    //         value={pageSize.toString()}
    //         onChange={(val) => {
    //           setPageSize(Number(val));
    //           setPageIndex(0);
    //         }}
    //         data={["5"]}
    //         w={80}
    //       />
    //       <Text size="sm" c={"dimmed"}>
    //         {startItem}–{endItem} of {rowCount} items
    //       </Text>
    //     </Group>

    //     {/* Pagination Controls */}
    //     <Group>
    //       <ActionIcon
    //         // onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
    //         disabled={pageIndex === 0}
    //         // disabled={pageIndex + 1 >= totalPages}
    //         onClick={() => {
    //           const newPage = pageIndex - 1;
    //           setPageIndex(newPage);
    //           fetchProfiling(pageIndex + 1, pageSize);
    //         }}
    //         variant="default"
    //       >
    //         <IconChevronLeft size={18} />
    //       </ActionIcon>
    //       <Text size="sm" w={20} ta="center">
    //         {pageIndex + 1}
    //       </Text>
    //       <Text size="sm" c="dimmed">
    //         of {totalPages} pages
    //       </Text>
    //       <ActionIcon
    //         onClick={() => {
    //           setPageIndex((p) => Math.min(totalPages - 1, p + 1));
    //           //   handlePaginationNext();
    //         }}
    //         disabled={pageIndex === totalPages - 1}
    //         variant="default"
    //       >
    //         <IconChevronRight size={18} />
    //       </ActionIcon>
    //     </Group>
    //   </Group>
    // ),
  });

  // Show loading when call entry data is being fetched
  if (isLoadingCallEntryData) {
    return (
      <Box
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
        }}
      >
        <Stack align="center" gap="xs">
          <Loader size="xl" color="#105476" />
          <Text
            size="xl"
            color="dimmed"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Loading call entry details...
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
      onSubmit={callEntryForm.onSubmit(handleCreateForm)}
    >
      <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
        <Flex
          gap="md"
          align="flex-start"
          style={{ height: "calc(100vh - 112px)", width: "100%" }}
        >
          {/* Vertical Stepper Sidebar */}
          <Box
            style={{
              minWidth: 180,
              width: "100%",
              maxWidth: 220,
              height: "100%",
              alignSelf: "stretch",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
              position: "sticky",
              top: 0,
            }}
          >
            <Box
              style={{
                padding: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                size="md"
                fw={600}
                c="#105476"
                style={{
                  fontFamily: "Inter",
                  fontStyle: "medium",
                  fontSize: "16px",
                  color: "#105476",
                  textAlign: "center",
                }}
              >
                {callEntryId ? "Edit Call Entry" : "Create Call Entry"}
              </Text>
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 100px)",
              overflow: "hidden",
            }}
          >
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                paddingBottom: "16px",
                backgroundColor: "#F8F8F8",
              }}
            >
              <Grid style={{ backgroundColor: "#FFFFFF", padding: "24px" }}>
                {/* {" "}
      {location.latitude && location.longitude ? (
        <p>
          Current Location: {location.latitude}, {location.longitude}
        </p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <p>Fetching location...</p>
      )} */}
                <Drawer
                  opened={opened}
                  onClose={close}
                  title="Profiling"
                  position="right"
                  size={"1250"}
                  styles={{
                    title: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
                  }}
                >
                  <Divider mb={"md"} />
                  {data.length > 0 && (
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                      <Group
                        justify="space-between"
                        align="center"
                        mb="md"
                        wrap="nowrap"
                      >
                        <Text
                          size="md"
                          fw={600}
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          List of Profiling{" "}
                        </Text>
                      </Group>
                      {isLoadingProfiling ? (
                        <Center style={{ minHeight: "200px" }}>
                          <Loader size="lg" color="#105476" />
                        </Center>
                      ) : (
                        <>
                          <MantineReactTable table={table} />
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
                            <Group
                              gap="sm"
                              align="center"
                              wrap="nowrap"
                              mt={10}
                            >
                              <Text
                                size="sm"
                                c="dimmed"
                                style={{ fontFamily: "Inter, sans-serif" }}
                              >
                                Rows per page
                              </Text>
                              <Select
                                size="xs"
                                data={["10", "25", "50"]}
                                value={String(profilingPageSize)}
                                onChange={(val) => {
                                  if (!val) return;
                                  const newPageSize = Number(val);
                                  setProfilingPageSize(newPageSize);
                                  setProfilingPageIndex(0);
                                  fetchProfiling(0, newPageSize);
                                }}
                                w={110}
                                styles={{
                                  input: {
                                    fontSize: 12,
                                    height: 30,
                                    fontFamily: "Inter, sans-serif",
                                  },
                                }}
                              />
                              <Text
                                size="sm"
                                c="dimmed"
                                style={{ fontFamily: "Inter, sans-serif" }}
                              >
                                {(() => {
                                  if (profilingTotalCount === 0)
                                    return "0–0 of 0";
                                  const start =
                                    profilingPageIndex * profilingPageSize + 1;
                                  const end = Math.min(
                                    (profilingPageIndex + 1) *
                                      profilingPageSize,
                                    profilingTotalCount
                                  );
                                  return `${start}–${end} of ${profilingTotalCount}`;
                                })()}
                              </Text>
                            </Group>

                            {/* Page controls */}
                            <Group
                              gap="xs"
                              align="center"
                              wrap="nowrap"
                              mt={10}
                            >
                              <ActionIcon
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const newPage = Math.max(
                                    0,
                                    profilingPageIndex - 1
                                  );
                                  setProfilingPageIndex(newPage);
                                  fetchProfiling(newPage, profilingPageSize);
                                }}
                                disabled={profilingPageIndex === 0}
                              >
                                <IconChevronLeft size={16} />
                              </ActionIcon>
                              <Text
                                size="sm"
                                ta="center"
                                style={{
                                  width: 26,
                                  fontFamily: "Inter, sans-serif",
                                }}
                              >
                                {profilingPageIndex + 1}
                              </Text>
                              <Text
                                size="sm"
                                c="dimmed"
                                style={{ fontFamily: "Inter, sans-serif" }}
                              >
                                of{" "}
                                {Math.max(
                                  1,
                                  Math.ceil(
                                    profilingTotalCount / profilingPageSize
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
                                      profilingTotalCount / profilingPageSize
                                    )
                                  );
                                  const newPage = Math.min(
                                    totalPages - 1,
                                    profilingPageIndex + 1
                                  );
                                  setProfilingPageIndex(newPage);
                                  fetchProfiling(newPage, profilingPageSize);
                                }}
                                disabled={
                                  profilingPageIndex >=
                                  Math.ceil(
                                    profilingTotalCount / profilingPageSize
                                  ) -
                                    1
                                }
                              >
                                <IconChevronRight size={16} />
                              </ActionIcon>
                            </Group>
                          </Group>
                        </>
                      )}
                    </Card>
                  )}
                  <Box
                    px={"xl"}
                    component="form"
                    onSubmit={profilingForm.onSubmit(handleProfilingSubmit)}
                  >
                    <Text
                      fw={500}
                      mt={20}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Add Profile
                    </Text>
                    {/* Profiling Dynamic form starts */}
                    {profilingForm.values.profiles.map((_, index) => (
                      <Box key={index}>
                        <Grid gutter="md" p="sm" align="end">
                          <Grid.Col span={4}>
                            <Dropdown
                              label="Service"
                              placeholder="Select Service"
                              withAsterisk
                              searchable
                              clearable
                              data={["AIR", "FCL", "LCL"]}
                              rightSection={<IconChevronDown />}
                              {...profilingForm.getInputProps(
                                `profiles.${index}.service`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <SearchableSelect
                              label="Origin"
                              placeholder="Type origin port"
                              apiEndpoint={URL.portMaster}
                              searchFields={["port_name", "port_code"]}
                              displayFormat={(item: any) => ({
                                value: String(item.port_code),
                                label: `${item.port_name} (${item.port_code})`,
                              })}
                              value={
                                profilingForm.values.profiles[index]?.origin ||
                                ""
                              }
                              onChange={(value) =>
                                profilingForm.setFieldValue(
                                  `profiles.${index}.origin`,
                                  value || ""
                                )
                              }
                              minSearchLength={2}
                              required
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <SearchableSelect
                              label="Destination"
                              placeholder="Type destination port"
                              apiEndpoint={URL.portMaster}
                              searchFields={["port_name", "port_code"]}
                              displayFormat={(item: any) => ({
                                value: String(item.port_code),
                                label: `${item.port_name} (${item.port_code})`,
                              })}
                              value={
                                profilingForm.values.profiles[index]
                                  ?.destination || ""
                              }
                              onChange={(value) =>
                                profilingForm.setFieldValue(
                                  `profiles.${index}.destination`,
                                  value || ""
                                )
                              }
                              minSearchLength={2}
                              required
                            />
                          </Grid.Col>

                          <Grid.Col span={4}>
                            <TextInput
                              label="No. of Shipments"
                              withAsterisk
                              {...profilingForm.getInputProps(
                                `profiles.${index}.no_of_shipments`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <Dropdown
                              label="Frequency"
                              placeholder="Select Frequency"
                              withAsterisk
                              searchable
                              clearable
                              data={frequencyProfile}
                              limit={50}
                              maxDropdownHeight={400}
                              rightSection={<IconChevronDown />}
                              {...profilingForm.getInputProps(
                                `profiles.${index}.frequency`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label="Volume/Containers"
                              withAsterisk
                              {...profilingForm.getInputProps(
                                `profiles.${index}.volume`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>

                          <Grid.Col span={4}>
                            <TextInput
                              label="Tier"
                              placeholder="Enter Tier"
                              withAsterisk
                              {...profilingForm.getInputProps(
                                `profiles.${index}.tier`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label="Competitors"
                              placeholder="Enter Competitors value"
                              {...profilingForm.getInputProps(
                                `profiles.${index}.competitors`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>

                          <Grid.Col span={4}>
                            <NumberInput
                              label="Potential Profit"
                              placeholder="Enter potential profit"
                              hideControls
                              {...profilingForm.getInputProps(
                                `profiles.${index}.potential_profit`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>

                          <Grid.Col span={1}>
                            {profilingForm.values.profiles.length > 1 && (
                              <Button
                                color="red"
                                variant="light"
                                onClick={() => handleRemoveProfile(index)}
                                styles={{
                                  root: { fontFamily: "Inter, sans-serif" },
                                }}
                              >
                                <IconTrash size={16} />
                              </Button>
                            )}
                          </Grid.Col>
                        </Grid>
                        <Divider my="lg" />
                      </Box>
                    ))}

                    <Group mt="md" justify="apart">
                      <Button
                        variant="outline"
                        c={"#105476"}
                        leftSection={<IconPlus size={16} />}
                        onClick={handleAddProfile}
                        styles={{
                          root: { fontFamily: "Inter, sans-serif" },
                        }}
                      >
                        Add More
                      </Button>
                    </Group>

                    <Group justify="end">
                      <Group>
                        <Button
                          variant="outline"
                          c="#105476"
                          styles={{
                            root: {
                              color: "#105476",
                              borderColor: "#105476",
                              fontFamily: "Inter, sans-serif",
                            },
                          }}
                          onClick={close}
                        >
                          Save
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                </Drawer>
                <Drawer
                  opened={openedParticipant}
                  onClose={closeParticipant}
                  title="Participants"
                  position="right"
                  size={"1250"}
                  styles={{
                    title: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
                  }}
                >
                  <Divider mb={"md"} />
                  {participantsData.length > 0 && (
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                      <Group
                        justify="space-between"
                        align="center"
                        mb="md"
                        wrap="nowrap"
                      >
                        <Text size="md" fw={600}>
                          List of Participants{" "}
                        </Text>
                      </Group>
                      {isLoadingParticipants ? (
                        <Center style={{ minHeight: "200px" }}>
                          <Loader size="lg" color="#105476" />
                        </Center>
                      ) : (
                        <>
                          <MantineReactTable table={participantsTable} />
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
                            <Group
                              gap="sm"
                              align="center"
                              wrap="nowrap"
                              mt={10}
                            >
                              <Text size="sm" c="dimmed">
                                Rows per page
                              </Text>
                              <Select
                                size="xs"
                                data={["10", "25", "50"]}
                                value={String(participantsPageSize)}
                                onChange={(val) => {
                                  if (!val) return;
                                  const newPageSize = Number(val);
                                  setParticipantsPageSize(newPageSize);
                                  setParticipantsPageIndex(0);
                                  fetchParticipants(0, newPageSize);
                                }}
                                w={110}
                                styles={{ input: { fontSize: 12, height: 30 } }}
                              />
                              <Text size="sm" c="dimmed">
                                {(() => {
                                  if (participantsTotalCount === 0)
                                    return "0–0 of 0";
                                  const start =
                                    participantsPageIndex *
                                      participantsPageSize +
                                    1;
                                  const end = Math.min(
                                    (participantsPageIndex + 1) *
                                      participantsPageSize,
                                    participantsTotalCount
                                  );
                                  return `${start}–${end} of ${participantsTotalCount}`;
                                })()}
                              </Text>
                            </Group>

                            {/* Page controls */}
                            <Group
                              gap="xs"
                              align="center"
                              wrap="nowrap"
                              mt={10}
                            >
                              <ActionIcon
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const newPage = Math.max(
                                    0,
                                    participantsPageIndex - 1
                                  );
                                  setParticipantsPageIndex(newPage);
                                  fetchParticipants(
                                    newPage,
                                    participantsPageSize
                                  );
                                }}
                                disabled={participantsPageIndex === 0}
                              >
                                <IconChevronLeft size={16} />
                              </ActionIcon>
                              <Text size="sm" ta="center" style={{ width: 26 }}>
                                {participantsPageIndex + 1}
                              </Text>
                              <Text size="sm" c="dimmed">
                                of{" "}
                                {Math.max(
                                  1,
                                  Math.ceil(
                                    participantsTotalCount /
                                      participantsPageSize
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
                                      participantsTotalCount /
                                        participantsPageSize
                                    )
                                  );
                                  const newPage = Math.min(
                                    totalPages - 1,
                                    participantsPageIndex + 1
                                  );
                                  setParticipantsPageIndex(newPage);
                                  fetchParticipants(
                                    newPage,
                                    participantsPageSize
                                  );
                                }}
                                disabled={
                                  participantsPageIndex >=
                                  Math.ceil(
                                    participantsTotalCount /
                                      participantsPageSize
                                  ) -
                                    1
                                }
                              >
                                <IconChevronRight size={16} />
                              </ActionIcon>
                            </Group>
                          </Group>
                        </>
                      )}
                    </Card>
                  )}

                  <Box
                    px="xl"
                    component="form"
                    onSubmit={participantForm.onSubmit(handleParticipantSubmit)}
                  >
                    <Text fw={500} mt={20}>
                      Add Participant
                    </Text>

                    {participantForm.values.participants.map((_, index) => (
                      <>
                        <Grid key={index} p="sm">
                          <Grid.Col span={4}>
                            <TextInput
                              label="First Name"
                              placeholder="Enter First Name"
                              value={
                                participantForm.values.participants[index]
                                  ?.first_name || ""
                              }
                              onChange={(e) => {
                                const formattedValue = toTitleCase(
                                  e.target.value
                                );
                                participantForm.setFieldValue(
                                  `participants.${index}.first_name`,
                                  formattedValue
                                );
                              }}
                              error={
                                participantForm.errors[
                                  `participants.${index}.first_name`
                                ] as string
                              }
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label="Last Name"
                              placeholder="Enter Last Name"
                              value={
                                participantForm.values.participants[index]
                                  ?.last_name || ""
                              }
                              onChange={(e) => {
                                const formattedValue = toTitleCase(
                                  e.target.value
                                );
                                participantForm.setFieldValue(
                                  `participants.${index}.last_name`,
                                  formattedValue
                                );
                              }}
                              error={
                                participantForm.errors[
                                  `participants.${index}.last_name`
                                ] as string
                              }
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label="Designation"
                              placeholder="Enter designation"
                              value={
                                participantForm.values.participants[index]
                                  ?.designation || ""
                              }
                              onChange={(e) => {
                                const formattedValue = toTitleCase(
                                  e.target.value
                                );
                                participantForm.setFieldValue(
                                  `participants.${index}.designation`,
                                  formattedValue
                                );
                              }}
                              error={
                                participantForm.errors[
                                  `participants.${index}.designation`
                                ] as string
                              }
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label="Mobile Number"
                              placeholder="Enter Mobile Number"
                              {...participantForm.getInputProps(
                                `participants.${index}.mobile_no`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label="Email"
                              placeholder="Enter Email ID"
                              {...participantForm.getInputProps(
                                `participants.${index}.email`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <TextInput
                              label="Department"
                              placeholder="Enter Department"
                              {...participantForm.getInputProps(
                                `participants.${index}.department`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "#424242",
                                  marginBottom: "4px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                },
                              }}
                            />
                          </Grid.Col>
                        </Grid>
                        <Group justify="end" mb="xs" mr="md">
                          {participantForm.values.participants.length > 1 && (
                            <Button
                              variant="light"
                              color="red"
                              size="xs"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => removeParticipant(index)}
                              styles={{
                                root: { fontFamily: "Inter, sans-serif" },
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </Group>
                        <Divider my="lg" />
                      </>
                    ))}

                    <Group justify="space-between">
                      <Button
                        variant="outline"
                        c="#105476"
                        leftSection={<IconPlus size={16} />}
                        onClick={addParticipant}
                        styles={{
                          root: { fontFamily: "Inter, sans-serif" },
                        }}
                      >
                        Add More
                      </Button>
                      <Group>
                        <Button
                          variant="outline"
                          c="#105476"
                          styles={{
                            root: {
                              color: "#105476",
                              borderColor: "#105476",
                              fontFamily: "Inter, sans-serif",
                            },
                          }}
                          onClick={closeParticipant}
                        >
                          Save
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                </Drawer>
                <Drawer
                  opened={nearbyCustomer}
                  onClose={closeCustomer}
                  title="Nearby Customers"
                  position="right"
                  size={"1200"}
                  styles={{
                    title: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
                  }}
                >
                  <Divider mb={"md"} />
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Group
                      justify="space-between"
                      align="center"
                      mb="md"
                      wrap="nowrap"
                    >
                      <Text
                        size="md"
                        fw={600}
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        List of Customers{" "}
                      </Text>
                      {/* <TextInput
              placeholder="Search"
              leftSection={<IconSearch size={16} />}
              style={{ width: 300, height: 32, fontSize: 14 }}
              radius="sm"
              size="xs"
            /> */}
                    </Group>

                    {isLoadingNearbyCustomers ? (
                      <Box ta="center" py="xl">
                        <Loader size="lg" color="#105476" />
                        <Text
                          mt="md"
                          c="dimmed"
                          size="lg"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Fetching nearby customers data...
                        </Text>
                      </Box>
                    ) : (
                      <Box
                        style={{
                          overflowX: "auto",
                          overflowY: "auto",
                          maxHeight: "70vh",
                          minWidth: "100%",
                        }}
                      >
                        <MantineReactTable table={nearbyCustomerTable} />
                      </Box>
                    )}
                  </Card>
                </Drawer>
                <Drawer
                  opened={quotationDrawer}
                  onClose={() => {
                    closeQuotationDrawer();
                    setQuotationData([]);
                    setJobData([]);
                    // Commented out - local_outstanding key will be removed from response
                    // setNetBalanceData([]);
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
                  }}
                  title={`Customer Data for ${selectedCustomerName}`}
                  size={"70%"}
                  position="right"
                  styles={{
                    title: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
                  }}
                >
                  <Divider mb={"md"} />

                  {isLoadingData ? (
                    <Box ta="center" py="xl">
                      <Loader size="lg" color="#105476" />
                      <Text
                        mt="md"
                        c="dimmed"
                        size="lg"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        Loading customer data...
                      </Text>
                    </Box>
                  ) : (
                    <Stack gap="lg">
                      {/* Customer Info Section - Above Quotations */}
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
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            ℹ️ Customer Information
                          </Text>
                          <Grid gutter="md">
                            {/* Left Card - General Customer Info */}
                            <Grid.Col
                              span={{ base: 12, md: user?.is_staff ? 6 : 12 }}
                            >
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
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={6}
                                          style={{
                                            fontFamily: "Inter, sans-serif",
                                          }}
                                        >
                                          Salesperson
                                        </Text>
                                        <Text
                                          size="sm"
                                          fw={500}
                                          c="#333"
                                          style={{
                                            fontFamily: "Inter, sans-serif",
                                          }}
                                        >
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
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={6}
                                        >
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
                                        ₹
                                        {totalOutstandingAmount.toLocaleString(
                                          "en-IN"
                                        )}
                                      </Text>
                                    </Box>
                                  </Grid.Col>
                                  <Grid.Col span={{ base: 12, sm: 6 }}>
                                    <Box>
                                      <Text size="xs" fw={600} c="#666" mb={6}>
                                        Last Visited
                                      </Text>
                                      <Text size="sm" fw={500} c="#333">
                                        {customerLastVisited
                                          ? dayjs(customerLastVisited).format(
                                              "DD/MM/YYYY"
                                            )
                                          : "-"}
                                      </Text>
                                    </Box>
                                  </Grid.Col>
                                </Grid>
                              </Card>
                            </Grid.Col>

                            {/* Right Card - Revenue/Profit with Filter - Only visible to admin users */}
                            {user?.is_staff && (
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
                                          <Text
                                            size="xs"
                                            fw={600}
                                            c="#666"
                                            mb={6}
                                          >
                                            Revenue & Profit
                                          </Text>
                                        </Group>
                                        <Group>
                                          <Select
                                            size="xs"
                                            value={String(selectedMonth)}
                                            onChange={(value) => {
                                              if (value) {
                                                const month = parseInt(
                                                  value,
                                                  10
                                                );
                                                setSelectedMonth(month);
                                                const customerVal =
                                                  callEntryForm.getValues()
                                                    .customer;
                                                if (customerVal) {
                                                  fetchCustomerData(
                                                    customerVal,
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
                                              {
                                                value: "9",
                                                label: "September",
                                              },
                                              { value: "10", label: "October" },
                                              {
                                                value: "11",
                                                label: "November",
                                              },
                                              {
                                                value: "12",
                                                label: "December",
                                              },
                                            ]}
                                            styles={{
                                              input: {
                                                fontSize: 12,
                                                height: 30,
                                              },
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
                                                const year = parseInt(
                                                  value,
                                                  10
                                                );
                                                setSelectedYear(year);
                                                const customerVal =
                                                  callEntryForm.getValues()
                                                    .customer;
                                                if (customerVal) {
                                                  fetchCustomerData(
                                                    customerVal,
                                                    selectedMonth,
                                                    year
                                                  );
                                                }
                                              }
                                            }}
                                            data={Array.from(
                                              { length: 10 },
                                              (_, i) => {
                                                const year =
                                                  new Date().getFullYear() -
                                                  9 +
                                                  i;
                                                return {
                                                  value: String(year),
                                                  label: String(year),
                                                };
                                              }
                                            )}
                                            styles={{
                                              input: {
                                                fontSize: 12,
                                                height: 30,
                                              },
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
                                          <Text
                                            size="xs"
                                            fw={600}
                                            c="#666"
                                            mb={6}
                                          >
                                            Total Revenue
                                          </Text>
                                          <Text size="sm" fw={500} c="#FF9800">
                                            ₹
                                            {totalRevenue.toLocaleString(
                                              "en-IN"
                                            )}
                                          </Text>
                                        </Box>
                                      )}
                                      {totalProfit !== null && (
                                        <Box style={{ textAlign: "center" }}>
                                          <Text
                                            size="xs"
                                            fw={600}
                                            c="#666"
                                            mb={6}
                                          >
                                            Total Profit
                                          </Text>
                                          <Text size="sm" fw={500} c="#105476">
                                            ₹
                                            {totalProfit.toLocaleString(
                                              "en-IN"
                                            )}
                                          </Text>
                                        </Box>
                                      )}
                                    </Group>
                                  </Stack>
                                </Card>
                              </Grid.Col>
                            )}
                          </Grid>
                        </Box>
                      )}

                      {/* Total Outstanding Amount - Below Customer Information - Commented out, now integrated in Customer Information section */}
                      {/* <Box>
              <Card
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                style={{
                  border: "1px solid #e9ecef",
                  backgroundColor: "#ffffff",
                }}
              >
                <Group align="center">
                  <Text size="md" fw={600} c="#666">
                    Total Outstanding Amount:
                  </Text>
                  <Text
                    size="lg"
                    fw={600}
                    style={{
                      color:
                        totalOutstandingAmount > 0
                          ? "#28a745"
                          : totalOutstandingAmount < 0
                            ? "#dc3545"
                            : undefined,
                    }}
                  >
                    ₹{totalOutstandingAmount.toLocaleString()}
                  </Text>
                </Group>
              </Card>
            </Box> */}

                      {/* Quotations Section */}
                      <Box>
                        <Text
                          size="lg"
                          fw={700}
                          mb="md"
                          c="#105476"
                          style={{
                            // borderBottom: "2px solid #105476",
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
                                    e.currentTarget.style.transform =
                                      "translateY(-2px)";
                                    e.currentTarget.style.boxShadow =
                                      "0 8px 20px rgba(16, 84, 118, 0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#105476";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform =
                                      "translateY(0)";
                                    e.currentTarget.style.boxShadow =
                                      "0 2px 8px rgba(0,0,0,0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#e9ecef";
                                  }}
                                  onClick={() => {
                                    const customerVal =
                                      callEntryForm.getValues().customer;

                                    navigate("/quotation-create", {
                                      state: {
                                        enquiry_id: quotation.enquiry_id,
                                        service: quotation.service,
                                        quotationData: quotation,
                                        customerData: {
                                          customer_code: customerVal,
                                          customer_name:
                                            quotation.customer_name ||
                                            selectedCustomerName,
                                          total_net_balance:
                                            totalOutstandingAmount,
                                        },
                                        returnTo: "call-entry",
                                        returnToState: {
                                          customer: customerVal,
                                          customerName:
                                            quotation.customer_name ||
                                            selectedCustomerName,
                                          openDrawer: true,
                                        },
                                      },
                                    });
                                  }}
                                >
                                  <Stack gap="sm">
                                    <Group
                                      justify="space-between"
                                      align="center"
                                    >
                                      <Text size="sm" fw={600} c="#105476">
                                        {quotation.enquiry_received_date
                                          ? dayjs(
                                              quotation.enquiry_received_date
                                            ).format("DD/MM/YYYY")
                                          : "-"}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        {quotation.service || "-"}
                                      </Text>
                                    </Group>

                                    <Group gap="sm">
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Origin
                                        </Text>
                                        <Text
                                          size="sm"
                                          fw={500}
                                          c="#333"
                                          truncate
                                        >
                                          {quotation.origin_name || "-"}
                                        </Text>
                                      </Box>
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Destination
                                        </Text>
                                        <Text
                                          size="sm"
                                          fw={500}
                                          c="#333"
                                          truncate
                                        >
                                          {quotation.destination_name || "-"}
                                        </Text>
                                      </Box>
                                    </Group>

                                    {/* Additional Quotation Details */}
                                    <Group gap="sm">
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Container Type
                                        </Text>
                                        <Text
                                          size="sm"
                                          fw={500}
                                          c="#333"
                                          truncate
                                        >
                                          {quotation.fcl_details &&
                                          quotation.fcl_details.length > 0
                                            ? quotation.fcl_details
                                                .map(
                                                  (detail) =>
                                                    detail.container_type
                                                )
                                                .join(", ")
                                            : "-"}
                                        </Text>
                                      </Box>
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          No. of Containers
                                        </Text>
                                        <Text
                                          size="sm"
                                          fw={500}
                                          c="#333"
                                          truncate
                                        >
                                          {quotation.fcl_details &&
                                          quotation.fcl_details.length > 0
                                            ? quotation.fcl_details
                                                .map(
                                                  (detail) =>
                                                    detail.no_of_containers
                                                )
                                                .join(", ")
                                            : "-"}
                                        </Text>
                                      </Box>
                                    </Group>

                                    {/* Status at the bottom */}
                                    <Group
                                      justify="space-between"
                                      align="center"
                                    >
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
                              <Grid.Col
                                key={index}
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
                                    e.currentTarget.style.transform =
                                      "translateY(-2px)";
                                    e.currentTarget.style.boxShadow =
                                      "0 8px 20px rgba(16, 84, 118, 0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#105476";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform =
                                      "translateY(0)";
                                    e.currentTarget.style.boxShadow =
                                      "0 2px 8px rgba(0,0,0,0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#e9ecef";
                                  }}
                                >
                                  <Stack gap="sm">
                                    <Group
                                      justify="space-between"
                                      align="center"
                                    >
                                      <Text size="sm" fw={600} c="#105476">
                                        {shipment.customer_name || "-"}
                                      </Text>
                                      {/* <Text size="xs" c="dimmed">
                              {shipment.carrier_name || "-"}
                            </Text> */}
                                    </Group>

                                    <Group gap="sm">
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Booking No
                                        </Text>
                                        <Text size="sm" fw={500} c="#333">
                                          {shipment.booking_no || "-"}
                                        </Text>
                                      </Box>
                                    </Group>

                                    {/* <Group gap="sm">
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Revenue
                              </Text>
                              <Text size="sm" fw={500} c="#28a745">
                                {shipment.revenue
                                  ? `₹${shipment.revenue.toLocaleString("en-IN")}`
                                  : "-"}
                              </Text>
                            </Box>
                            <Box style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c="#666" mb={2}>
                                Profit
                              </Text>
                              <Text size="sm" fw={500} c="#105476">
                                {shipment.gp
                                  ? `₹${shipment.gp.toLocaleString("en-IN")}`
                                  : "-"}
                              </Text>
                            </Box>
                          </Group> */}
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
                            // borderBottom: "2px solid #105476",
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
                                    e.currentTarget.style.transform =
                                      "translateY(-2px)";
                                    e.currentTarget.style.boxShadow =
                                      "0 8px 20px rgba(16, 84, 118, 0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#105476";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform =
                                      "translateY(0)";
                                    e.currentTarget.style.boxShadow =
                                      "0 2px 8px rgba(0,0,0,0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#e9ecef";
                                  }}
                                >
                                  <Stack gap="sm">
                                    <Group
                                      justify="space-between"
                                      align="center"
                                    >
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

                                    {/* <Box>
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
                          </Box> */}

                                    <Group gap="sm">
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Follow-up Date
                                        </Text>
                                        <Text size="sm" fw={500} c="#333">
                                          {callEntry.followup_date
                                            ? dayjs(
                                                callEntry.followup_date
                                              ).format("DD/MM/YYYY")
                                            : "-"}
                                        </Text>
                                      </Box>
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
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

                                    {/* <Group justify="space-between" align="center">
                            <Text size="xs" fw={600} c="#666">
                              Status:
                            </Text>
                            <Text
                              size="sm"
                              fw={500}
                              style={{
                                color:
                                  callEntry.status === "ACTIVE"
                                    ? "#28a745"
                                    : "#ffc107",
                              }}
                            >
                              {callEntry.status || "-"}
                            </Text>
                          </Group> */}
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
                            // borderBottom: "2px solid #105476",
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
                                    e.currentTarget.style.transform =
                                      "translateY(-2px)";
                                    e.currentTarget.style.boxShadow =
                                      "0 8px 20px rgba(16, 84, 118, 0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#105476";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform =
                                      "translateY(0)";
                                    e.currentTarget.style.boxShadow =
                                      "0 2px 8px rgba(0,0,0,0.1)";
                                    e.currentTarget.style.borderColor =
                                      "#e9ecef";
                                  }}
                                >
                                  <Stack gap="sm">
                                    <Group
                                      justify="space-between"
                                      align="center"
                                    >
                                      <Text size="sm" fw={600} c="#105476">
                                        {profile.service || "-"}
                                      </Text>
                                    </Group>

                                    <Group gap="sm">
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Origin
                                        </Text>
                                        <Text
                                          size="sm"
                                          fw={500}
                                          c="#333"
                                          truncate
                                        >
                                          {profile.origin_port_name || "-"}
                                        </Text>
                                      </Box>
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Destination
                                        </Text>
                                        <Text
                                          size="sm"
                                          fw={500}
                                          c="#333"
                                          truncate
                                        >
                                          {profile.destination_port_name || "-"}
                                        </Text>
                                      </Box>
                                    </Group>

                                    <Group gap="sm">
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          No. of Shipments
                                        </Text>
                                        <Text size="sm" fw={500} c="#333">
                                          {profile.no_of_shipments || "-"}
                                        </Text>
                                      </Box>
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Frequency
                                        </Text>
                                        <Text size="sm" fw={500} c="#333">
                                          {profile.frequency_name || "-"}
                                        </Text>
                                      </Box>
                                    </Group>

                                    <Group gap="sm">
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
                                          Volume
                                        </Text>
                                        <Text size="sm" fw={500} c="#333">
                                          {profile.volume || "-"}
                                        </Text>
                                      </Box>
                                      <Box style={{ flex: 1 }}>
                                        <Text
                                          size="xs"
                                          fw={600}
                                          c="#666"
                                          mb={2}
                                        >
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
                                No potential profiling data found for this
                                customer
                              </Text>
                            </Box>
                          </Card>
                        )}
                      </Box>
                    </Stack>
                  )}
                </Drawer>
                <Grid.Col span={12}>
                  <Box
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: "16px",
                    }}
                  >
                    <Menu shadow="md" width={220} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="#105476"
                          size="lg"
                          styles={{
                            root: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              border: "1px solid #E9ECEF",
                              borderRadius: "8px",
                              "&:hover": {
                                backgroundColor: "#F8F9FA",
                              },
                            },
                          }}
                        >
                          <IconDotsVertical size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown
                        styles={{
                          dropdown: {
                            border: "1px solid #E9ECEF",
                            borderRadius: "8px",
                            padding: "8px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                          },
                        }}
                      >
                        <Menu.Item
                          leftSection={
                            <Box
                              style={{
                                backgroundColor: "#E7F5FF",
                                borderRadius: "6px",
                                padding: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconUserScan size={16} color="#105476" />
                            </Box>
                          }
                          disabled={
                            !location.pincode &&
                            locationPermission !== "granted"
                          }
                          styles={{
                            item: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              borderRadius: "6px",
                              padding: "10px 12px",
                              marginBottom: "4px",
                              "&:hover": {
                                backgroundColor: "#F8F9FA",
                              },
                            },
                            itemLabel: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                            },
                          }}
                          onClick={async () => {
                            // Check if pincode is available
                            if (location.pincode) {
                              openCustomer();
                              await fetchNearbyCustomers(location.pincode);
                              return;
                            }

                            // If location is denied, retry permission request without showing duplicate toast
                            if (locationPermission === "denied") {
                              // Automatically retry location permission request
                              const locationGranted =
                                await requestLocationPermission();

                              if (locationGranted && location.pincode) {
                                openCustomer();
                                await fetchNearbyCustomers(location.pincode);
                              }
                              return;
                            }

                            // Request location permission
                            const locationGranted =
                              await requestLocationPermission();

                            if (locationGranted && location.pincode) {
                              openCustomer();
                              await fetchNearbyCustomers(location.pincode);
                            } else if (locationGranted && !location.pincode) {
                              ToastNotification({
                                type: "error",
                                message:
                                  "Unable to fetch pincode from your location. Please try again or check your internet connection.",
                              });
                            }
                          }}
                        >
                          Nearby Customers
                        </Menu.Item>
                        <Menu.Item
                          leftSection={
                            <Box
                              style={{
                                backgroundColor: "#E7F5FF",
                                borderRadius: "6px",
                                padding: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconUserScan size={16} color="#105476" />
                            </Box>
                          }
                          styles={{
                            item: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              borderRadius: "6px",
                              padding: "10px 12px",
                              marginBottom: "4px",
                              "&:hover": {
                                backgroundColor: "#F8F9FA",
                              },
                            },
                            itemLabel: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                            },
                          }}
                          onClick={() => {
                            open();
                            // Reset pagination when opening modal
                            setProfilingPageIndex(0);
                            // Always fetch table data when opening modal
                            fetchProfiling(0, profilingPageSize);
                            // Check if there's existing profiling form data
                            if (
                              profilingForm.values.profiles.some(
                                (profile) =>
                                  profile.service ||
                                  profile.origin ||
                                  profile.destination ||
                                  profile.no_of_shipments ||
                                  profile.frequency ||
                                  profile.volume ||
                                  profile.tier ||
                                  profile.competitors
                              )
                            ) {
                              // Show existing form data
                              console.log(
                                "Showing existing profiling data:",
                                profilingForm.values.profiles
                              );
                            }
                          }}
                        >
                          Profiling
                        </Menu.Item>
                        <Menu.Item
                          leftSection={
                            <Box
                              style={{
                                backgroundColor: "#E7F5FF",
                                borderRadius: "6px",
                                padding: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconPlus size={16} color="#105476" />
                            </Box>
                          }
                          styles={{
                            item: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              borderRadius: "6px",
                              padding: "10px 12px",
                              marginBottom: "4px",
                              "&:hover": {
                                backgroundColor: "#F8F9FA",
                              },
                            },
                            itemLabel: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                            },
                          }}
                          onClick={() => {
                            openParticipant();
                            // Reset pagination when opening modal
                            setParticipantsPageIndex(0);
                            // Always fetch table data when opening modal
                            fetchParticipants(0, participantsPageSize);
                            // Check if there's existing participant form data
                            if (
                              participantForm.values.participants.some(
                                (participant) =>
                                  participant.first_name ||
                                  participant.last_name ||
                                  participant.designation ||
                                  participant.mobile_no ||
                                  participant.email ||
                                  participant.department
                              )
                            ) {
                              // Show existing form data
                              console.log(
                                "Showing existing participant data:",
                                participantForm.values.participants
                              );
                            }
                          }}
                        >
                          Participants
                        </Menu.Item>
                        <Menu.Item
                          leftSection={
                            <Box
                              style={{
                                backgroundColor: "#E7F5FF",
                                borderRadius: "6px",
                                padding: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconUserScan size={16} color="#105476" />
                            </Box>
                          }
                          styles={{
                            item: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              borderRadius: "6px",
                              padding: "10px 12px",
                              marginBottom: "4px",
                              "&:hover": {
                                backgroundColor: "#F8F9FA",
                              },
                            },
                            itemLabel: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                            },
                          }}
                          onClick={() => {
                            const customerVal =
                              callEntryForm.getValues().customer;
                            if (customerVal) {
                              // Set customer name from stored customer data if available
                              if (
                                selectedCustomerData &&
                                selectedCustomerData.customer_name
                              ) {
                                setSelectedCustomerName(
                                  selectedCustomerData.customer_name
                                );
                              } else if (!selectedCustomerName) {
                                // Fallback to placeholder only if no data available
                                setSelectedCustomerName(`${customerVal}`);
                              }
                              fetchCustomerData(customerVal);
                              openQuotationDrawer();
                            } else {
                              ToastNotification({
                                type: "warning",
                                message: "Please select a customer",
                              });
                            }
                          }}
                        >
                          Customer Data
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Box>
                </Grid.Col>
                <Grid gutter="md">
                  <Grid.Col span={4}>
                    <SearchableSelect
                      label="Customer Name"
                      placeholder="Type customer name"
                      apiEndpoint={URL.customer}
                      searchFields={["customer_name", "customer_code"]}
                      displayFormat={(item: any) => ({
                        value: String(item.customer_code),
                        label: item.customer_name,
                      })}
                      value={callEntryForm.values.customer}
                      displayValue={
                        callEntryForm.values.customer &&
                        callEntryForm.values.customer.trim()
                          ? selectedCustomerName || null
                          : null
                      }
                      onChange={(value, selectedData) => {
                        callEntryForm.setFieldValue("customer", value || "");
                        // Always call handleCustomerChange to handle both selection and clearing
                        handleCustomerChange(value || "", selectedData || null);
                      }}
                      minSearchLength={2}
                      required
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <DateInput
                      label="Date"
                      withAsterisk
                      placeholder="YYYY-MM-DD"
                      value={
                        callEntryForm.values.call_date &&
                        callEntryForm.values.call_date.trim() !== ""
                          ? dayjs(callEntryForm.values.call_date).toDate()
                          : new Date()
                      }
                      onChange={(date) => {
                        const formatted = date
                          ? dayjs(date).format("YYYY-MM-DD")
                          : "";
                        callEntryForm.setFieldValue("call_date", formatted);
                        console.log("formatted=", formatted);
                      }}
                      error={callEntryForm.errors.call_date}
                      valueFormat="YYYY-MM-DD"
                      leftSection={<IconCalendar size={18} />}
                      leftSectionPointerEvents="none"
                      radius="sm"
                      size="sm"
                      nextIcon={<IconChevronRight size={16} />}
                      previousIcon={<IconChevronLeft size={16} />}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                        day: {
                          width: "2.25rem",
                          height: "2.25rem",
                          fontSize: "0.9rem",
                          fontFamily: "Inter, sans-serif",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Dropdown
                      label="Call Mode"
                      placeholder="Select Call Mode"
                      withAsterisk
                      searchable
                      clearable
                      nothingFoundMessage="No Call Mode found..."
                      data={callModeOptions}
                      limit={50} // Limit initial display to 50 items
                      maxDropdownHeight={400} // Limit dropdown height
                      {...callEntryForm.getInputProps("call_mode")}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={12}>
                    <Textarea
                      label="Description"
                      withAsterisk
                      placeholder="Enter Description"
                      minRows={4}
                      value={callEntryForm.values.call_summary}
                      onChange={(e) => {
                        const formattedValue = toTitleCase(e.target.value);
                        callEntryForm.setFieldValue(
                          "call_summary",
                          formattedValue
                        );
                      }}
                      error={callEntryForm.errors.call_summary}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Dropdown
                      label="Follow Up Action"
                      placeholder="Select Follow Up Action"
                      withAsterisk
                      searchable
                      clearable
                      nothingFoundMessage="No Follow up action found..."
                      data={followUpAction}
                      limit={50} // Limit initial display to 50 items
                      maxDropdownHeight={250} // Limit dropdown height
                      rightSection={<IconChevronDown />}
                      {...callEntryForm.getInputProps("followup_action")}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <DateInput
                      label="Follow-Up Date"
                      withAsterisk
                      placeholder="YYYY-MM-DD"
                      value={
                        callEntryForm.values.followup_date &&
                        callEntryForm.values.followup_date.trim() !== ""
                          ? dayjs(callEntryForm.values.followup_date).toDate()
                          : new Date()
                      }
                      onChange={(date) => {
                        console.log("date=", date);
                        const formatted = date
                          ? dayjs(date).format("YYYY-MM-DD")
                          : "";
                        console.log("formatted=", formatted);
                        callEntryForm.setFieldValue("followup_date", formatted);
                        console.log("followup_date date=", formatted);
                      }}
                      error={callEntryForm.errors.followup_date}
                      valueFormat="YYYY-MM-DD"
                      leftSection={<IconCalendar size={18} />}
                      leftSectionPointerEvents="none"
                      radius="sm"
                      size="sm"
                      nextIcon={<IconChevronRight size={16} />}
                      previousIcon={<IconChevronLeft size={16} />}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                        day: {
                          width: "2.25rem",
                          height: "2.25rem",
                          fontSize: "0.9rem",
                          fontFamily: "Inter, sans-serif",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <NumberInput
                      label="Expected Profit"
                      placeholder="Enter expected profit"
                      hideControls
                      {...callEntryForm.getInputProps("expected_profit")}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                      }}
                    />
                  </Grid.Col>
                  {callEntryId &&
                    (() => {
                      // Find the selected follow-up action option
                      const selectedFollowUpAction = followUpAction.find(
                        (option) =>
                          option.value === callEntryForm.values.followup_action
                      );
                      const isFollowUpActionClose =
                        selectedFollowUpAction?.label === "Close";
                      const isChecked = closeCallEntry || isFollowUpActionClose;

                      return (
                        <>
                          <Grid.Col span={12}>
                            <Checkbox
                              label="Close Call Entry"
                              checked={isChecked}
                              onChange={(event) => {
                                // Only allow change if follow-up action is not "Close"
                                if (!isFollowUpActionClose) {
                                  setCloseCallEntry(
                                    event.currentTarget.checked
                                  );
                                }
                              }}
                              description="Check this box to close the call entry"
                              disabled={isFollowUpActionClose}
                              color="red"
                              styles={{
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  fontWeight: 500,
                                  color: "#424242",
                                },
                                description: {
                                  fontSize: "12px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          {(isChecked || isFollowUpActionClose) && (
                            <Grid.Col span={12}>
                              <Textarea
                                label="Remark"
                                placeholder="Enter remark..."
                                required
                                {...callEntryForm.getInputProps("remark")}
                                error={
                                  (isChecked || isFollowUpActionClose) &&
                                  !callEntryForm.values.remark.trim()
                                    ? "Remark is required when closing call entry"
                                    : callEntryForm.errors.remark
                                }
                                minRows={3}
                                styles={{
                                  input: {
                                    fontSize: "13px",
                                    fontFamily: "Inter",
                                  },
                                  label: {
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: "#424242",
                                    marginBottom: "4px",
                                    fontFamily: "Inter",
                                    fontStyle: "medium",
                                  },
                                }}
                              />
                            </Grid.Col>
                          )}
                        </>
                      );
                    })()}
                </Grid>
              </Grid>
            </Box>

            {/* Footer Buttons */}
            <Box
              style={{
                borderTop: "1px solid #e9ecef",
                padding: "20px 32px",
                backgroundColor: "#ffffff",
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
                  {/* Back to Dashboard button - show when navigating from dashboard */}
                  {routerLocation.state?.returnTo === "/" &&
                    routerLocation.state?.returnToState && (
                      <Button
                        variant="outline"
                        color="gray"
                        size="sm"
                        leftSection={<IconChevronLeft size={16} />}
                        styles={{
                          root: {
                            borderColor: "#d0d0d0",
                            color: "#666",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        onClick={() => {
                          const returnToState = (routerLocation.state as any)
                            ?.returnToState;
                          if (returnToState) {
                            navigate("/", {
                              state: {
                                returnToCallEntryDetailedView: true,
                                dashboardState: returnToState,
                              },
                            });
                          }
                        }}
                      >
                        Back to Dashboard
                      </Button>
                    )}

                  {/* Cancel button */}
                  <Button
                    variant="outline"
                    color="gray"
                    size="sm"
                    styles={{
                      root: {
                        borderColor: "#d0d0d0",
                        color: "#666",
                        fontSize: "13px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                    onClick={() => {
                      // Check if there's a returnTo path in location state, otherwise go back in history
                      const returnTo = (
                        routerLocation.state as { returnTo?: string }
                      )?.returnTo;
                      const returnToState = (routerLocation.state as any)
                        ?.returnToState;
                      const preserveFilters = (routerLocation.state as any)
                        ?.preserveFilters;

                      if (returnTo === "dashboard-pipeline") {
                        // Navigate back to dashboard with pipeline report state
                        navigate("/", {
                          state: {
                            returnToPipelineReport: true,
                            pipelineReportState: (routerLocation.state as any)
                              ?.pipelineReportState,
                          },
                        });
                      } else if (returnTo === "/" && returnToState) {
                        // Navigate back to dashboard with call entry detailed view state
                        navigate("/", {
                          state: {
                            returnToCallEntryDetailedView: true,
                            dashboardState: returnToState,
                          },
                        });
                      } else if (returnTo) {
                        // If navigating to a specific route, restore filters if preserved
                        if (preserveFilters && returnTo === "/call-entry") {
                          navigate(returnTo, {
                            state: {
                              restoreFilters: preserveFilters,
                              refreshData: true,
                            },
                          });
                        } else {
                          navigate(returnTo);
                        }
                      } else {
                        // Restore filter state if preserved when going back to call-entry
                        if (preserveFilters) {
                          navigate("/call-entry", {
                            state: {
                              restoreFilters: preserveFilters,
                              refreshData: true,
                            },
                          });
                        } else {
                          // Use navigate(-1) to go back, with fallback to call-entry if no history
                          const historyLength = window.history.length;
                          if (historyLength > 1) {
                            navigate(-1);
                          } else {
                            // Fallback if there's no history to go back to
                            navigate("/call-entry");
                          }
                        }
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </Group>

                <Group gap="sm">
                  <Tooltip
                    label="Enable location access to create call-entry"
                    disabled={locationPermission === "granted"}
                    py={5}
                    px={15}
                    withArrow
                    styles={{
                      tooltip: { fontFamily: "Inter, sans-serif" },
                    }}
                  >
                    <Box style={{ display: "inline-block" }}>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={locationPermission !== "granted"}
                        style={{
                          backgroundColor: "#105476",
                          fontSize: "13px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                          cursor:
                            locationPermission !== "granted"
                              ? "not-allowed"
                              : "pointer",
                        }}
                        rightSection={<IconCheck size={16} />}
                      >
                        Submit
                      </Button>
                    </Box>
                  </Tooltip>
                </Group>
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

export default CallEntryNew;
