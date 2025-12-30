import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Grid,
  Tabs,
  TextInput,
  Autocomplete,
  Group,
  ActionIcon,
  Loader,
  Modal,
  Stack,
  Text,
  Button,
  Textarea,
} from "@mantine/core";
import { IconSearch, IconX, IconSend } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthStore from "../../../store/authStore";
import { useDisclosure, useDebouncedValue } from "@mantine/hooks";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import {
  getFilteredOutstandingData,
  calculateAggregatedData,
  calculateFilteredAggregatedData,
  getCallEntryData,
  calculateCallEntryAggregatedData,
  filterCallEntryData,
  getCallEntryStatistics,
  calculateCallEntryDateRange,
  getEnquiryConversionData,
  getFilteredEnquiryConversionData,
  calculateEnquiryConversionAggregatedData,
  calculateFilteredEnquiryConversionAggregatedData,
  getFilteredBudgetData,
  calculateBudgetAggregatedData,
  getCustomerNotVisitedData,
  getLostCustomerData,
  getNewCustomerData,
  getCustomerInteractionStatusSummary,
  DashboardFilters,
  CallEntryAggregatedData,
  CallEntryStatisticsSummary,
  CallEntryStatisticsResponse,
  CallEntrySalespersonData,
  CallEntryCustomerData,
  CallEntryDetailData,
  EnquiryConversionAggregatedData,
  BudgetAggregatedData,
  extractNumericValue,
} from "../../../service/dashboard.service";
import { useQuery } from "@tanstack/react-query";
import { DetailedViewTable, DateRangeInput } from "../../../components";
import dayjs from "dayjs";
import Outstanding from "./Outstanding";
import Budget from "./Budget";
import CallEntry from "./CallEntry";
import Enquiry from "./Enquiry";
import NewCustomers from "./NewCustomers";
import LostCustomer from "./LostCustomer";
import CustomerNotVisited from "./CustomerNotVisited";
import CustomerInteractionStatus from "./CustomerInteractionStatus";
import CallEntrySection from "./CallEntrySection";
import OutstandingSection from "./OutstandingSection";
import EnquirySection from "./EnquirySection";
import BudgetSection from "./BudgetSection";
import PipelineReport from "../PipelineReport/index";
import Booking from "../Booking/index";

interface AggregatedData {
  totalOutstanding: number;
  totalOverdue: number;
  companies: number;
  totalSalespersons: number;
}

type MetricType = "outstanding" | "overdue";

const Dashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [isLoadingOutstandingChart, setIsLoadingOutstandingChart] =
    useState(false);
  const [isLoadingEnquiryChart, setIsLoadingEnquiryChart] = useState(false);
  const [isLoadingEnquiryConversion, setIsLoadingEnquiryConversion] =
    useState(false);
  const [callEntryData, setCallEntryData] = useState<any[]>([]);
  const [isLoadingCallEntry, setIsLoadingCallEntry] = useState(false);

  // Aggregated totals
  const [aggregatedData, setAggregatedData] = useState<AggregatedData>({
    totalOutstanding: 0,
    totalOverdue: 0,
    companies: 0,
    totalSalespersons: 0,
  });

  // Drilldown states for Outstanding pie
  const [drillLevel, setDrillLevel] = useState<0 | 1 | 2>(0);
  const [companySummary, setCompanySummary] = useState<any[]>([]);
  const [selectedCompanyCtx, setSelectedCompanyCtx] = useState<{
    company?: string;
    branch_code?: string;
    currency?: string;
  }>({});
  const [locationData, setLocationData] = useState<any[]>([]);
  const [salespersonData, setSalespersonData] = useState<any[]>([]);
  const [isFilterMode, setIsFilterMode] = useState(false);

  // Metric toggle
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>("outstanding");

  const [contextTotals, setContextTotals] = useState<{
    outstanding: number;
    overdue: number;
  }>({
    outstanding: 0,
    overdue: 0,
  });
  const [hoverTotals] = useState<{
    outstanding: number;
    overdue: number;
  } | null>(null);

  // Detailed view states
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [detailedViewData, setDetailedViewData] = useState<any[]>([]);
  const [detailedViewTitle, setDetailedViewTitle] = useState("");
  const [isLoadingDetailedView, setIsLoadingDetailedView] = useState(false);
  const [detailedViewType, setDetailedViewType] = useState<
    | "outstanding"
    | "enquiry"
    | "budget"
    | "callentry"
    | "customerNotVisited"
    | "lostCustomer"
    | "newCustomer"
    | null
  >(null);
  const [detailedViewSearch, setDetailedViewSearch] = useState<string>("");

  // Track detailed view drill level for back navigation
  const [detailedViewDrillLevel, setDetailedViewDrillLevel] = useState<
    0 | 1 | 2 | 3
  >(0);
  const [detailedViewSelectedCompany, setDetailedViewSelectedCompany] =
    useState<string | null>(null);
  const [detailedViewSelectedLocation, setDetailedViewSelectedLocation] =
    useState<string | null>(null);
  const [detailedViewSelectedSalesperson, setDetailedViewSelectedSalesperson] =
    useState<string | null>(null);
  const [enquiryFilterType, setEnquiryFilterType] = useState<
    "all" | "gain" | "lost" | "active" | "quote"
  >("all");
  const [initialEnquiryFilterType, setInitialEnquiryFilterType] = useState<
    "all" | "gain" | "lost" | "active" | "quote"
  >("all");
  const [enquiryView, setEnquiryView] = useState<"gain-lost" | "active-quote">(
    "gain-lost"
  );
  const [callEntryFilterType, setCallEntryFilterType] = useState<
    "all" | "overdue" | "today" | "upcoming" | "closed"
  >("all");
  const [initialCallEntryFilterType, setInitialCallEntryFilterType] = useState<
    "all" | "overdue" | "today" | "upcoming" | "closed"
  >("all");
  const [callEntryDrillLevel, setCallEntryDrillLevel] = useState<0 | 1 | 2>(0);
  const [callEntrySelectedSalesperson, setCallEntrySelectedSalesperson] =
    useState<string | null>(null);
  const [callEntrySelectedCustomer, setCallEntrySelectedCustomer] = useState<{
    code: string;
    name: string;
  } | null>(null);

  // Customer Not Visited states - similar to Budget
  const [customerNotVisitedRawData, setCustomerNotVisitedRawData] =
    useState<any>(null);
  const [isLoadingCustomerNotVisited, setIsLoadingCustomerNotVisited] =
    useState(false);
  const [customerNotVisitedDrillLevel, setCustomerNotVisitedDrillLevel] =
    useState<0 | 1 | 2>(0);
  const [
    customerNotVisitedSelectedCompany,
    setCustomerNotVisitedSelectedCompany,
  ] = useState<string | null>(null);
  const [
    customerNotVisitedSelectedSalesperson,
    setCustomerNotVisitedSelectedSalesperson,
  ] = useState<string | null>(null);
  const [customerNotVisitedPeriod, setCustomerNotVisitedPeriod] =
    useState<string>("quarterly");
  const [customerNotVisitedTotalRecords, setCustomerNotVisitedTotalRecords] =
    useState(0);

  // Lost Customer states - similar to Customer Not Visited
  const [lostCustomerRawData, setLostCustomerRawData] = useState<any>(null);
  const [isLoadingLostCustomer, setIsLoadingLostCustomer] = useState(false);
  const [lostCustomerDrillLevel, setLostCustomerDrillLevel] = useState<
    0 | 1 | 2
  >(0);
  const [lostCustomerSelectedSalesperson, setLostCustomerSelectedSalesperson] =
    useState<string | null>(null);
  const [lostCustomerPeriod, setLostCustomerPeriod] =
    useState<string>("quarterly");
  const [lostCustomerTotalRecords, setLostCustomerTotalRecords] = useState(0);

  // New Customer states - similar to CustomerNotVisited
  const [newCustomerRawData, setNewCustomerRawData] = useState<any>(null);
  const [newCustomerOriginalData, setNewCustomerOriginalData] =
    useState<any>(null); // Store original data
  const [isLoadingNewCustomer, setIsLoadingNewCustomer] = useState(false);
  const [newCustomerDrillLevel, setNewCustomerDrillLevel] = useState<0 | 1 | 2>(
    0
  );
  const [newCustomerSelectedSalesperson, setNewCustomerSelectedSalesperson] =
    useState<string | null>(null);
  const [newCustomerPeriod, setNewCustomerPeriod] =
    useState<string>("quarterly");
  const [newCustomerTotalRecords, setNewCustomerTotalRecords] = useState(0);

  // Original full lists
  const [originalCompanies, setOriginalCompanies] = useState<string[]>([]);
  const [originalLocations, setOriginalLocations] = useState<string[]>([]);

  const [filterOpened, setFilterOpened] = useState(false);

  // Filter states
  const [searchSalesman, setSearchSalesman] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(
    dayjs().year().toString()
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Global search state - separate input value from actual search query
  const [searchInputValue, setSearchInputValue] = useState<string>("");
  const [globalSearch, setGlobalSearch] = useState<string>("");
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);

  // Searchable dropdown states
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);
  const [isDropdownLoading, setIsDropdownLoading] = useState<boolean>(false);
  const [debouncedSearch] = useDebouncedValue(searchInputValue, 400);

  // Budget month filters - Set proper defaults
  const currentYear = dayjs().year().toString();
  const currentMonth = dayjs().month() + 1;
  const prevMonth = currentMonth - 1;
  const defaultStartMonth = `${currentYear}-04`;
  const defaultEndMonth =
    prevMonth > 0
      ? `${currentYear}-${String(prevMonth).padStart(2, "0")}`
      : `${parseInt(currentYear) - 1}-12`;

  const [budgetStartMonth, setBudgetStartMonth] =
    useState<string>(defaultStartMonth);
  const [budgetEndMonth, setBudgetEndMonth] = useState<string>(defaultEndMonth);

  // Call entry states
  const [callEntryAggregatedData, setCallEntryAggregatedData] =
    useState<CallEntryAggregatedData>({
      overdueCount: 0,
      todayCallsCount: 0,
      upcomingCount: 0,
      totalCalls: 0,
    });

  // New Call Entry Statistics states
  const [callEntryPeriod, setCallEntryPeriod] =
    useState<string>("current_month");
  const [callEntrySummary, setCallEntrySummary] =
    useState<CallEntryStatisticsSummary | null>(null);
  const [callEntryStatisticsData, setCallEntryStatisticsData] =
    useState<CallEntryStatisticsResponse | null>(null);

  // Enquiry conversion states
  const [enquiryPeriod, setEnquiryPeriod] = useState<string>("current_month");
  const [enquiryConversionAggregatedData, setEnquiryConversionAggregatedData] =
    useState<EnquiryConversionAggregatedData>({
      totalGain: 0,
      totalLost: 0,
      totalActive: 0,
      totalQuoteCreated: 0,
      totalEnquiries: 0,
      gainPercentage: 0,
      lossPercentage: 0,
      activePercentage: 0,
      quotePercentage: 0,
    });

  // Section-level period states (for unified filters in section headers)
  const [customerInteractionPeriod, setCustomerInteractionPeriod] =
    useState<string>("last_30_days");
  const [outstandingPeriod, setOutstandingPeriod] =
    useState<string>("last_30_days");

  // Customer Interaction Status date range states
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };
  const getDefaultToDate = (): Date => {
    return new Date();
  };
  const [customerInteractionFromDate, setCustomerInteractionFromDate] =
    useState<Date | null>(getDefaultFromDate());
  const [customerInteractionToDate, setCustomerInteractionToDate] =
    useState<Date | null>(getDefaultToDate());

  // Enquiry date range states
  const [enquiryFromDate, setEnquiryFromDate] = useState<Date | null>(
    getDefaultFromDate()
  );
  const [enquiryToDate, setEnquiryToDate] = useState<Date | null>(
    getDefaultToDate()
  );

  // Call Entry date range states
  const [callEntryFromDate, setCallEntryFromDate] = useState<Date | null>(
    getDefaultFromDate()
  );
  const [callEntryToDate, setCallEntryToDate] = useState<Date | null>(
    getDefaultToDate()
  );

  // Customer Interaction Status Summary (simplified)
  const [customerInteractionData, setCustomerInteractionData] = useState<{
    gain: number;
    gainSalesperson: number;
    notVisited: number;
    notVisitedSalesperson: number;
    lost: number;
    lostSalesperson: number;
  } | null>(null);
  const [isLoadingCustomerInteraction, setIsLoadingCustomerInteraction] =
    useState(false);

  // Budget states
  const [budgetAggregatedData, setBudgetAggregatedData] =
    useState<BudgetAggregatedData>({
      totalActualBudget: 0,
      totalSalesBudget: 0,
    });
  const [budgetRawData, setBudgetRawData] = useState<any>(null);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [budgetDrillLevel, setBudgetDrillLevel] = useState<0 | 1 | 2 | 3>(1);
  const [budgetSelectedCompany, setBudgetSelectedCompany] = useState<
    string | null
  >(null);
  const [budgetSelectedSalesperson, setBudgetSelectedSalesperson] = useState<
    string | null
  >(null);
  const [budgetSelectedMonth, setBudgetSelectedMonth] = useState<string | null>(
    null
  );
  const [budgetDateRange, setBudgetDateRange] = useState<string>("");
  const [budgetWindowStart, setBudgetWindowStart] = useState<number>(0);
  const [budgetHoverTotals] = useState<{
    actual: number;
    sales: number;
  } | null>(null);
  const [budgetType, setBudgetType] = useState<
    "salesperson" | "non-salesperson"
  >("salesperson");

  // Tab state for navigation
  const [activeTab, setActiveTab] = useState<string>("overall");
  // Pipeline Report state for restoration
  const [pipelineReportState, setPipelineReportState] = useState<{
    drillLevel?: 0 | 1 | 2;
    selectedSalesperson?: string | null;
    selectedCustomer?: string | null;
    selectedColumnType?: string | null;
  } | null>(null);

  // Refresh key for Pipeline and Booking tabs - changes when profile is updated
  const [tabsRefreshKey, setTabsRefreshKey] = useState<string>(
    `${user?.company?.company_name || ""}-${Date.now()}`
  );

  // Refs to prevent duplicate API calls
  const isInitialLoadRef = useRef(false);
  const isLoadingRef = useRef(false);
  const locationStateProcessedRef = useRef<string | null>(null);
  const lastCompanyNameRef = useRef<string | null>(null);
  const lastGlobalSearchRef = useRef<string | undefined>(undefined);

  // Email modal states
  const [sendEmailOpened, { open: openSendEmail, close: closeSendEmail }] =
    useDisclosure(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: "",
    cc_email: "",
    subject: "",
    message: "Please find the details of outstanding/overdue amounts.",
  });
  const [emailErrors, setEmailErrors] = useState({
    to_email: "",
    cc_email: "",
  });
  const [currentEmailData, setCurrentEmailData] = useState<any>(null);

  // Handle location state for pipeline report restoration
  useEffect(() => {
    if (location.state?.returnToPipelineReport) {
      // Set the pipeline report state and switch to pipeline report tab
      setPipelineReportState(location.state.pipelineReportState || null);
      setActiveTab("pipeline-Report");
      // Clear the location state to prevent re-triggering on re-render
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Handle location state for enquiry detailed view restoration
  useEffect(() => {
    if (location.state?.returnToEnquiryDetailedView) {
      const dashboardState = location.state?.dashboardState;
      if (dashboardState) {
        // Restore detailed view state
        setShowDetailedView(true);
        setDetailedViewType("enquiry");
        setDetailedViewDrillLevel(dashboardState.detailedViewDrillLevel || 0);
        setDetailedViewSelectedCompany(
          dashboardState.detailedViewSelectedCompany || null
        );
        setDetailedViewSelectedSalesperson(
          dashboardState.detailedViewSelectedSalesperson || null
        );
        setEnquiryFilterType(dashboardState.enquiryFilterType || "all");
        setInitialEnquiryFilterType(
          dashboardState.initialEnquiryFilterType || "all"
        );
        setSelectedCompany(dashboardState.selectedCompany || null);
        setSelectedLocation(dashboardState.selectedLocation || null);
        // Ensure salesperson is restored for drill level 2
        setSearchSalesman(
          dashboardState.detailedViewSelectedSalesperson ||
            dashboardState.searchSalesman ||
            ""
        );
        setSelectedYear(dashboardState.selectedYear || null);
        setSelectedDate(dashboardState.selectedDate || null);
        // Restore enquiryPeriod if available (commented out - can be used in future case)
        // if (dashboardState.enquiryPeriod) {
        //   setEnquiryPeriod(dashboardState.enquiryPeriod);
        //   // Refresh main enquiry card data with restored period
        //   handleEnquiryPeriodChange(dashboardState.enquiryPeriod);
        // }

        // Restore detailed view data
        const restoreDetailedView = async () => {
          try {
            setIsLoadingDetailedView(true);
            // Calculate date range from restored enquiryPeriod or use default
            const restoredEnquiryPeriod =
              dashboardState.enquiryPeriod || "current_month";
            const dateRange = calculateCallEntryDateRange(
              restoredEnquiryPeriod
            );

            const typeMap: Record<string, string> = {
              gain: "gained",
              lost: "lost",
              active: "active",
              quote: "quote created",
            };
            const filterData: DashboardFilters = {
              ...(dashboardState.selectedCompany && {
                company: dashboardState.selectedCompany,
              }),
              ...(dashboardState.selectedLocation && {
                location: dashboardState.selectedLocation,
              }),
              // Prefer salesperson from detailed view selection; fallback to searchSalesman
              ...((dashboardState.detailedViewSelectedSalesperson ||
                dashboardState.searchSalesman) && {
                salesman:
                  dashboardState.detailedViewSelectedSalesperson ||
                  dashboardState.searchSalesman,
              }),
              ...(dashboardState.selectedYear && {
                year: parseInt(dashboardState.selectedYear),
              }),
              ...(dashboardState.enquiryFilterType !== "all" && {
                type:
                  typeMap[dashboardState.enquiryFilterType] ??
                  dashboardState.enquiryFilterType,
              }),
              // Use date range from enquiryPeriod instead of selectedDate
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
            };

            const response = await getFilteredEnquiryConversionData(filterData);
            let tableData = convertEnquiryResponseToTableData(response);

            // Apply filter type
            // if (dashboardState.enquiryFilterType === "gain") {
            //   tableData = tableData.filter(
            //     (item: any) => (item.gained || item.total_gain || 0) > 0
            //   );
            // } else if (dashboardState.enquiryFilterType === "lost") {
            //   tableData = tableData.filter(
            //     (item: any) => (item.lost || item.total_lost || 0) > 0
            //   );
            // } else if (dashboardState.enquiryFilterType === "active") {
            //   tableData = tableData.filter(
            //     (item: any) => (item.active || item.total_active || 0) > 0
            //   );
            // } else if (dashboardState.enquiryFilterType === "quote") {
            //   tableData = tableData.filter(
            //     (item: any) =>
            //       (item.quote_created || item.total_quote_created || 0) > 0
            //   );
            // }

            setDetailedViewData(tableData);
            setDetailedViewTitle(
              dashboardState.enquiryFilterType === "gain"
                ? "Enquiry Conversion - Gain Only"
                : dashboardState.enquiryFilterType === "lost"
                  ? "Enquiry Conversion - Lost Only"
                  : dashboardState.enquiryFilterType === "active"
                    ? "Enquiry Conversion - Active Only"
                    : dashboardState.enquiryFilterType === "quote"
                      ? "Enquiry Conversion - Quoted Only"
                      : "Enquiry Conversion - Detailed View"
            );
          } catch (error) {
            console.error("Error restoring enquiry detailed view:", error);
          } finally {
            setIsLoadingDetailedView(false);
          }
        };

        restoreDetailedView();
        // Clear the location state to prevent re-triggering on re-render
        window.history.replaceState({}, document.title);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Handle location state for call entry detailed view restoration
  useEffect(() => {
    if (location.state?.returnToCallEntryDetailedView) {
      const dashboardState = location.state?.dashboardState;
      if (dashboardState) {
        // Restore call entry detailed view state
        setShowDetailedView(true);
        setDetailedViewType("callentry");
        setDetailedViewDrillLevel(dashboardState.detailedViewDrillLevel || 0);
        setCallEntryDrillLevel(dashboardState.callEntryDrillLevel || 0);
        setCallEntrySelectedSalesperson(
          dashboardState.callEntrySelectedSalesperson || null
        );
        setCallEntrySelectedCustomer(
          dashboardState.callEntrySelectedCustomer || null
        );
        setCallEntryFilterType(dashboardState.callEntryFilterType || "all");
        setInitialCallEntryFilterType(
          dashboardState.initialCallEntryFilterType ||
            dashboardState.callEntryFilterType ||
            "all"
        );
        // Set period state first - ensure it's set before any async operations
        // IMPORTANT: Use the period from dashboardState, not the current state
        // Validate that the period is one of the valid options
        const validPeriods = [
          "weekly",
          "current_month",
          "last_month",
          "last_3_months",
          "last_6_months",
          "last_year",
        ];
        // Get the period from dashboardState - this should be the period that was active when navigating
        const periodFromDashboardState = dashboardState.callEntryPeriod;
        // Validate and restore the period
        // Priority: dashboardState.callEntryPeriod > current callEntryPeriod state > default
        let restoredPeriod = "current_month"; // Default fallback
        if (periodFromDashboardState) {
          // If period exists in dashboardState, validate it
          if (validPeriods.includes(periodFromDashboardState)) {
            restoredPeriod = periodFromDashboardState;
          } else {
            // If invalid, try current state as fallback
            if (callEntryPeriod && validPeriods.includes(callEntryPeriod)) {
              restoredPeriod = callEntryPeriod;
            }
          }
        } else {
          // If not in dashboardState, use current state if valid
          if (callEntryPeriod && validPeriods.includes(callEntryPeriod)) {
            restoredPeriod = callEntryPeriod;
          }
        }
        // Set period state immediately (commented out - can be used in future case)
        // setCallEntryPeriod(restoredPeriod);
        // Refresh main call entry card data with restored period (commented out - can be used in future case)
        // handleCallEntryPeriodChange(restoredPeriod);

        // Restore detailed view data
        const restoreCallEntryDetailedView = async () => {
          try {
            setIsLoadingDetailedView(true);
            // Use the restored period value directly to ensure consistency
            const dateRange = calculateCallEntryDateRange(restoredPeriod);
            const companyName =
              user?.company?.company_name ||
              selectedCompany ||
              "PENTAGON INDIA";

            if (dashboardState.callEntryDrillLevel === 0) {
              // Restore salesperson list
              const response = await getCallEntryStatistics({
                company: companyName,
                date_from: dateRange.date_from,
                date_to: dateRange.date_to,
                ...(dashboardState.callEntryFilterType !== "all" && {
                  type: dashboardState.callEntryFilterType,
                }),
              });
              const tableData = (
                response.data as CallEntrySalespersonData[]
              ).map((item) => ({
                SALESPERSON: item.salesperson,
                OVERDUE: item.total_overdue,
                TODAY: item.total_today,
                UPCOMING: item.total_upcoming,
                CLOSED: item.total_closed,
                TOTAL_CALLS: item.total_calls,
                // Enable Send Email action at salesperson level
                send_email: "send_email",
                salesperson_email: item.salesperson_email || "",
                cc_mail: item.cc_mail || [],
              }));
              // Sort by total calls in descending order
              tableData.sort((a, b) => {
                const aTotal = a.TOTAL_CALLS || 0;
                const bTotal = b.TOTAL_CALLS || 0;
                return bTotal - aTotal; // Descending order
              });
              setDetailedViewData(tableData);
              let title = "Call Entry - Detailed View";
              if (dashboardState.callEntryFilterType === "overdue") {
                title = "Call Entry - Overdue Only";
              } else if (dashboardState.callEntryFilterType === "today") {
                title = "Call Entry - Today's Calls Only";
              } else if (dashboardState.callEntryFilterType === "upcoming") {
                title = "Call Entry - Upcoming Calls";
              } else if (dashboardState.callEntryFilterType === "closed") {
                title = "Call Entry - Closed Calls";
              }
              setDetailedViewTitle(title);
            } else if (
              dashboardState.callEntryDrillLevel === 1 &&
              dashboardState.callEntrySelectedSalesperson
            ) {
              // Restore customer list
              const response = await getCallEntryStatistics({
                company: companyName,
                salesperson: dashboardState.callEntrySelectedSalesperson,
                date_from: dateRange.date_from,
                date_to: dateRange.date_to,
                ...(dashboardState.callEntryFilterType !== "all" && {
                  type: dashboardState.callEntryFilterType,
                }),
              });
              const statsResponse = response as CallEntryStatisticsResponse;
              const salespersonEmail = statsResponse.salesperson_email || "";
              const ccMail = statsResponse.cc_mail || [];

              const tableData = (response.data as CallEntryCustomerData[]).map(
                (item) => ({
                  CUSTOMER_CODE: item.customer_code,
                  CUSTOMER_NAME: item.customer_name,
                  OVERDUE: item.total_overdue,
                  TODAY: item.total_today,
                  UPCOMING: item.total_upcoming,
                  CLOSED: item.total_closed,
                  TOTAL_CALLS: item.total_calls,
                  // Enable Send Email action at customer level (same salesperson email)
                  send_email: "send_email",
                  salesperson_email: salespersonEmail,
                  cc_mail: ccMail,
                })
              );
              // Sort by total calls in descending order
              tableData.sort((a, b) => {
                const aTotal = a.TOTAL_CALLS || 0;
                const bTotal = b.TOTAL_CALLS || 0;
                return bTotal - aTotal; // Descending order
              });
              setDetailedViewData(tableData);
              setDetailedViewTitle(
                `Call Entry - ${dashboardState.callEntrySelectedSalesperson} - ${
                  dashboardState.callEntryFilterType !== "all"
                    ? dashboardState.callEntryFilterType
                        .charAt(0)
                        .toUpperCase() +
                      dashboardState.callEntryFilterType.slice(1)
                    : "All Customers"
                }`
              );
            } else if (
              dashboardState.callEntryDrillLevel === 2 &&
              dashboardState.callEntrySelectedSalesperson &&
              dashboardState.callEntrySelectedCustomer
            ) {
              // Restore call entry details
              const response = await getCallEntryStatistics({
                company: companyName,
                salesperson: dashboardState.callEntrySelectedSalesperson,
                customer_code: dashboardState.callEntrySelectedCustomer.code,
                date_from: dateRange.date_from,
                date_to: dateRange.date_to,
                ...(dashboardState.callEntryFilterType !== "all" && {
                  type: dashboardState.callEntryFilterType,
                }),
              });
              const tableData = (response.data as CallEntryDetailData[]).map(
                (item) => ({
                  CALL_ENTRY_ID: item.call_entry_id,
                  CALL_DATE: item.call_date,
                  CALL_MODE: item.call_mode_name,
                  FOLLOWUP_ACTION: item.followup_action_name,
                  CALL_SUMMARY: item.call_summary,
                  FOLLOWUP_DATE: item.followup_date,
                  EXPECTED_PROFIT: item.expected_profit,
                  CREATED_BY: item.created_by_name,
                })
              );
              setDetailedViewData(tableData);
              setDetailedViewTitle(
                `Call Entry - ${dashboardState.callEntrySelectedCustomer.name} - ${
                  dashboardState.callEntryFilterType !== "all"
                    ? dashboardState.callEntryFilterType
                        .charAt(0)
                        .toUpperCase() +
                      dashboardState.callEntryFilterType.slice(1)
                    : "Details"
                }`
              );
            }
          } catch (error) {
            console.error("Error restoring call entry detailed view:", error);
          } finally {
            setIsLoadingDetailedView(false);
          }
        };

        restoreCallEntryDetailedView();
        // Clear the location state to prevent re-triggering on re-render
        window.history.replaceState({}, document.title);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Handle dashboard reset when logo or dashboard navlink is clicked
  useEffect(() => {
    if (location.state?.resetDashboard) {
      // Check if we're at any drill level or have detailed view open
      const isAtDrillLevel =
        drillLevel > 0 ||
        budgetDrillLevel > 1 ||
        customerNotVisitedDrillLevel > 0 ||
        lostCustomerDrillLevel > 0 ||
        newCustomerDrillLevel > 0 ||
        detailedViewDrillLevel > 0 ||
        showDetailedView ||
        activeTab !== "overall";

      if (isAtDrillLevel) {
        // Reset to base level
        resetToInitialState();
        setShowDetailedView(false);
        setDetailedViewDrillLevel(0);
        setActiveTab("overall");
        setBudgetDrillLevel(1);
        setCustomerNotVisitedDrillLevel(0);
        setLostCustomerDrillLevel(0);
        setNewCustomerDrillLevel(0);
        setPipelineReportState(null);
      }

      // Clear the location state to prevent re-triggering on re-render
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Handle dashboard reset when logo or dashboard navlink is clicked
  useEffect(() => {
    if (location.state?.resetDashboard) {
      // Check if we're at any drill level or have detailed view open
      const isAtDrillLevel =
        drillLevel > 0 ||
        budgetDrillLevel > 1 ||
        customerNotVisitedDrillLevel > 0 ||
        lostCustomerDrillLevel > 0 ||
        newCustomerDrillLevel > 0 ||
        detailedViewDrillLevel > 0 ||
        showDetailedView ||
        activeTab !== "overall";

      if (isAtDrillLevel) {
        // Reset to base level
        resetToInitialState();
        setShowDetailedView(false);
        setDetailedViewDrillLevel(0);
        setActiveTab("overall");
        setBudgetDrillLevel(1);
        setCustomerNotVisitedDrillLevel(0);
        setLostCustomerDrillLevel(0);
        setNewCustomerDrillLevel(0);
        setPipelineReportState(null);
      }

      // Clear the location state to prevent re-triggering on re-render
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Handle profile update refresh - reload data when profile is updated while on dashboard
  useEffect(() => {
    if (location.state?.refreshData && location.state?.timestamp) {
      console.log("🔄 Profile updated - refreshing dashboard data...");

      // Reset refs to allow data reload
      isInitialLoadRef.current = false;
      lastCompanyNameRef.current = null;
      lastGlobalSearchRef.current = undefined;

      // Close detailed view if open
      if (showDetailedView) {
        setShowDetailedView(false);
        setDetailedViewData([]);
        setDetailedViewTitle("");
        setDetailedViewType(null);
        setDetailedViewDrillLevel(0);
      }

      // Reset to overall tab
      setActiveTab("overall");

      // Reset drill levels
      setDrillLevel(0);
      setBudgetDrillLevel(1);
      setCustomerNotVisitedDrillLevel(0);
      setLostCustomerDrillLevel(0);
      setNewCustomerDrillLevel(0);

      // Update refresh key to force Pipeline and Booking tabs to remount
      setTabsRefreshKey(`${user?.company?.company_name || ""}-${Date.now()}`);

      // Clear location state to prevent re-triggering
      window.history.replaceState({}, document.title);

      // Reload all dashboard data
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.refreshData, location.state?.timestamp]);

  // Effect to refresh call entry detailed view - DISABLED for new API implementation
  // The new implementation uses period-based filtering instead of date-based
  // useEffect(() => {
  //   if (showDetailedView && detailedViewType === "callentry") {
  //     refreshCallEntryDetailedView(callEntryFilterType);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [selectedDate, searchSalesman]);

  // Function to refresh budget data
  const refreshBudgetData = async () => {
    try {
      setIsLoadingBudget(true);
      const filterData: DashboardFilters = {
        ...(selectedCompany && { company: selectedCompany }),
        ...(selectedLocation && { location: selectedLocation }),
        ...(searchSalesman && { salesman: searchSalesman }),
        ...(selectedYear && { year: parseInt(selectedYear) }),
        ...(selectedDate && {
          date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
          date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
        }),
      };

      const budgetFilterData = {
        ...filterData,
        ...(budgetStartMonth && { start_month: budgetStartMonth }),
        ...(budgetEndMonth && { end_month: budgetEndMonth }),
        type: budgetType,
      };

      const budgetResponse = await getFilteredBudgetData(
        budgetFilterData as any
      );
      const calculatedBudgetData =
        calculateBudgetAggregatedData(budgetResponse);
      setBudgetAggregatedData(calculatedBudgetData);
      setBudgetRawData(budgetResponse);
      setBudgetDateRange(budgetResponse?.data?.[0]?.date_range || "");
    } catch (error) {
      console.error("Error refreshing budget data:", error);
    } finally {
      setIsLoadingBudget(false);
    }
  };

  // Effect to trigger API calls when selectedYear changes
  useEffect(() => {
    // Skip during initial load - year is set by default and loadInitialData handles it
    if (!isInitialLoadRef.current) return;

    const fetchDataOnYearChange = async () => {
      if (!selectedYear) return;

      try {
        setIsLoadingBudget(true);

        setBudgetDrillLevel(1);
        setBudgetSelectedCompany(null);
        setBudgetSelectedSalesperson(null);
        setBudgetSelectedMonth(null);
        setBudgetWindowStart(0);

        // Extract month parts from existing budgetStartMonth and budgetEndMonth
        const existingStartMonth = budgetStartMonth
          ? budgetStartMonth.split("-")[1]
          : "04";
        const existingEndMonth = budgetEndMonth
          ? budgetEndMonth.split("-")[1]
          : "09";

        const startMonth = `${selectedYear}-${existingStartMonth}`;
        const endMonth = `${selectedYear}-${existingEndMonth}`;

        setBudgetStartMonth(startMonth);
        setBudgetEndMonth(endMonth);

        // Get company name from user's auth data
        const companyName =
          user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

        const budgetResponse = await getFilteredBudgetData(
          addSearchToFilters({
            ...(companyName && { company: companyName }),
            year: parseInt(selectedYear),
            start_month: startMonth,
            end_month: endMonth,
            type: budgetType,
          } as any)
        );
        setBudgetRawData(budgetResponse);
        const budgetAgg = calculateBudgetAggregatedData(budgetResponse);
        setBudgetAggregatedData(budgetAgg);

        setIsLoadingBudget(false);
      } catch (error) {
        console.error("Error fetching budget data on year change:", error);
        setIsLoadingBudget(false);
      }
    };

    if (selectedYear) {
      fetchDataOnYearChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // Effect to trigger API calls when selectedDate changes
  useEffect(() => {
    // Skip during initial load - date changes should only trigger after initial data is loaded
    if (!isInitialLoadRef.current) return;

    const fetchDataOnDateChange = async () => {
      try {
        setIsLoadingOutstandingChart(true);

        setDrillLevel(0);
        setBudgetDrillLevel(1);
        setSelectedCompanyCtx({});
        setSelectedCompany(null);
        setSelectedLocation(null);
        setBudgetSelectedMonth(null);
        setBudgetWindowStart(0);

        const filterData: DashboardFilters = addSearchToFilters({
          ...(selectedYear && { year: parseInt(selectedYear) }),
          ...(selectedDate && {
            date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
            date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
          }),
        });

        const outstandingResponse =
          await getFilteredOutstandingData(filterData);
        if (
          outstandingResponse?.data &&
          Array.isArray(outstandingResponse.data)
        ) {
          setCompanySummary(outstandingResponse.data);
        }

        setIsLoadingOutstandingChart(false);
      } catch (error) {
        console.error("Error fetching data on date change:", error);
        setIsLoadingOutstandingChart(false);
      }
    };

    if (companySummary.length > 0) {
      fetchDataOnDateChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Effect to filter call entry data when date changes
  useEffect(() => {
    const filterCallEntryDataOnDateChange = () => {
      if (!callEntryData || callEntryData.length === 0) return;

      // Build filter data - only include non-empty filters
      const callEntryFilterData: DashboardFilters = {};

      if (selectedCompany) {
        callEntryFilterData.company = selectedCompany;
      }
      if (selectedLocation) {
        callEntryFilterData.location = selectedLocation;
      }
      if (searchSalesman) {
        callEntryFilterData.salesman = searchSalesman;
      }
      if (selectedDate) {
        callEntryFilterData.date_from =
          dayjs(selectedDate).format("YYYY-MM-DD");
        callEntryFilterData.date_to = dayjs(selectedDate).format("YYYY-MM-DD");
      }

      // Apply filters only if there are any filters
      const filteredCallEntryData =
        Object.keys(callEntryFilterData).length > 0
          ? filterCallEntryData(callEntryData, callEntryFilterData)
          : callEntryData;

      const aggregatedCallEntry = calculateCallEntryAggregatedData(
        filteredCallEntryData
      );
      setCallEntryAggregatedData(aggregatedCallEntry);
    };

    filterCallEntryDataOnDateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedCompany, selectedLocation, searchSalesman]);

  // Handler for customer interaction period change (commented - can be used in future case)
  // const handleCustomerInteractionPeriodChange = async (period: string) => {
  //   try {
  //     setIsLoadingCustomerInteraction(true);
  //     setCustomerInteractionPeriod(period);

  //     const companyName =
  //       user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

  //     const data = await getCustomerInteractionStatusSummary({
  //       company: companyName,
  //       period: period,
  //     });

  //     setCustomerInteractionData(data);
  //   } catch (error) {
  //     console.error("Error fetching customer interaction status:", error);
  //     toast.error("Failed to fetch customer interaction status");
  //   } finally {
  //     setIsLoadingCustomerInteraction(false);
  //   }
  // };

  // Handler for customer interaction date range change
  const handleCustomerInteractionDateChange = async () => {
    if (!customerInteractionFromDate || !customerInteractionToDate) {
      return;
    }
    try {
      setIsLoadingCustomerInteraction(true);

      const companyName =
        user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

      const data = await getCustomerInteractionStatusSummary({
        company: companyName,
        date_from: dayjs(customerInteractionFromDate).format("DD-MM-YYYY"),
        date_to: dayjs(customerInteractionToDate).format("DD-MM-YYYY"),
      });

      setCustomerInteractionData(data);
    } catch (error) {
      console.error("Error fetching customer interaction status:", error);
      toast.error("Failed to fetch customer interaction status");
    } finally {
      setIsLoadingCustomerInteraction(false);
    }
  };

  // Effect to trigger API call when date range changes (common for all three sections)
  useEffect(() => {
    if (customerInteractionFromDate && customerInteractionToDate) {
      handleCustomerInteractionDateChange();
      handleEnquiryDateChange();
      handleCallEntryDateChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerInteractionFromDate, customerInteractionToDate]);

  // Handler for call entry period change (commented - can be used in future case)
  // const handleCallEntryPeriodChange = async (period: string) => {
  //   try {
  //     setIsLoadingCallEntry(true);
  //     setCallEntryPeriod(period);

  //     const dateRange = calculateCallEntryDateRange(period);
  //     const companyName =
  //       user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

  //     const response = await getCallEntryStatistics(
  //       addSearchToFilters({
  //         company: companyName,
  //         date_from: dateRange.date_from,
  //         date_to: dateRange.date_to,
  //       })
  //     );

  //     setCallEntryStatisticsData(response);
  //     setCallEntrySummary(response.summary);
  //   } catch (error) {
  //     console.error("Error fetching call entry statistics:", error);
  //     toast.error("Failed to fetch call entry data");
  //   } finally {
  //     setIsLoadingCallEntry(false);
  //   }
  // };

  // Handler for call entry date range change (uses common date filter)
  const handleCallEntryDateChange = async () => {
    if (!customerInteractionFromDate || !customerInteractionToDate) {
      return;
    }
    try {
      setIsLoadingCallEntry(true);

      const companyName =
        user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

      const response = await getCallEntryStatistics(
        addSearchToFilters({
          company: companyName,
          date_from: dayjs(customerInteractionFromDate).format("DD-MM-YYYY"),
          date_to: dayjs(customerInteractionToDate).format("DD-MM-YYYY"),
        })
      );

      setCallEntryStatisticsData(response);
      setCallEntrySummary(response.summary);
    } catch (error) {
      console.error("Error fetching call entry statistics:", error);
      toast.error("Failed to fetch call entry data");
    } finally {
      setIsLoadingCallEntry(false);
    }
  };

  // Effect removed - now using common date filter in the main useEffect above

  // Handler for enquiry conversion period change (commented - can be used in future case)
  // const handleEnquiryPeriodChange = async (period: string) => {
  //   try {
  //     setIsLoadingEnquiryConversion(true);
  //     setEnquiryPeriod(period);

  //     const dateRange = calculateCallEntryDateRange(period);
  //     const companyName =
  //       user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

  //     const filterData: DashboardFilters = addSearchToFilters({
  //       ...(companyName && { company: companyName }),
  //       date_from: dateRange.date_from,
  //       date_to: dateRange.date_to,
  //     });

  //     const response = await getFilteredEnquiryConversionData(filterData);
  //     const aggregatedData =
  //       calculateFilteredEnquiryConversionAggregatedData(response);
  //     setEnquiryConversionAggregatedData(aggregatedData);
  //   } catch (error) {
  //     console.error("Error fetching enquiry conversion data:", error);
  //     toast.error("Failed to fetch enquiry conversion data");
  //   } finally {
  //     setIsLoadingEnquiryConversion(false);
  //   }
  // };

  // Handler for enquiry date range change (uses common date filter)
  const handleEnquiryDateChange = async () => {
    if (!customerInteractionFromDate || !customerInteractionToDate) {
      return;
    }
    try {
      setIsLoadingEnquiryConversion(true);

      const companyName =
        user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

      const filterData: DashboardFilters = addSearchToFilters({
        ...(companyName && { company: companyName }),
        date_from: dayjs(customerInteractionFromDate).format("DD-MM-YYYY"),
        date_to: dayjs(customerInteractionToDate).format("DD-MM-YYYY"),
      });

      const response = await getFilteredEnquiryConversionData(filterData);
      const aggregatedData =
        calculateFilteredEnquiryConversionAggregatedData(response);
      setEnquiryConversionAggregatedData(aggregatedData);
    } catch (error) {
      console.error("Error fetching enquiry conversion data:", error);
      toast.error("Failed to fetch enquiry conversion data");
    } finally {
      setIsLoadingEnquiryConversion(false);
    }
  };

  // Effect removed - now using common date filter in the main useEffect above

  // Consolidated effect to load initial data and handle company/search changes
  useEffect(() => {
    const companyName = user?.company?.company_name || null;
    const hasCompanyChanged = companyName !== lastCompanyNameRef.current;
    const hasSearchChanged = globalSearch !== lastGlobalSearchRef.current;

    // On initial mount, load data once
    if (!isInitialLoadRef.current) {
      console.log("🚀 Initial load - fetching dashboard data...");
      isInitialLoadRef.current = true;
      lastCompanyNameRef.current = companyName;
      lastGlobalSearchRef.current = globalSearch;
      loadInitialData();
      return;
    }

    // If company changed, reload data
    if (hasCompanyChanged && companyName) {
      console.log("🔄 Company changed, refetching dashboard data...");
      lastCompanyNameRef.current = companyName;
      // Update refresh key to force Pipeline and Booking tabs to remount
      setTabsRefreshKey(`${companyName}-${Date.now()}`);
      loadInitialData();
      return;
    }

    // If search changed (and we have a company), reload data
    if (
      hasSearchChanged &&
      companyName &&
      globalSearch !== undefined &&
      activeTab === "overall"
    ) {
      console.log("🔍 Global search changed, refetching dashboard data...");
      lastGlobalSearchRef.current = globalSearch;
      setIsSearchLoading(true);
      // Set all module loading states to true before API call to prevent showing old data
      setIsLoadingOutstandingChart(true);
      setIsLoadingBudget(true);
      setIsLoadingCustomerNotVisited(true);
      setIsLoadingLostCustomer(true);
      setIsLoadingNewCustomer(true);
      setIsLoadingEnquiryConversion(true);
      setIsLoadingCallEntry(true);

      loadInitialData().finally(() => {
        setIsSearchLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company?.company_name, globalSearch, activeTab]);

  // Handler to trigger search on Enter key or icon click
  const handleSearch = useCallback(() => {
    const searchQuery = searchInputValue.trim();
    setGlobalSearch(searchQuery);
  }, [searchInputValue]);

  // Handler for Enter key press
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch]
  );

  // Fetch dropdown options from API
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const searchQuery = debouncedSearch.trim();

      // Only fetch if search query has at least 2 characters
      if (searchQuery.length < 2) {
        setDropdownOptions([]);
        return;
      }

      setIsDropdownLoading(true);
      try {
        const response = await getAPICall(
          `combined-data/?search=${encodeURIComponent(searchQuery)}`,
          API_HEADER
        );

        // Extract user_name or customer_name from response
        if (response && typeof response === "object" && "data" in response) {
          const dataArray = Array.isArray(response.data) ? response.data : [];
          const options = dataArray
            .map((item: any) => {
              // Extract user_name for users or customer_name for customers
              return item.user_name || item.customer_name || null;
            })
            .filter(
              (name: string | null): name is string =>
                name !== null && name.trim() !== ""
            );

          setDropdownOptions(options);
        } else {
          setDropdownOptions([]);
        }
      } catch (error) {
        console.error("Error fetching dropdown options:", error);
        setDropdownOptions([]);
      } finally {
        setIsDropdownLoading(false);
      }
    };

    fetchDropdownOptions();
  }, [debouncedSearch]);

  // Helper function to add search to filters - memoized to prevent unnecessary re-renders
  const addSearchToFilters = useCallback(
    <T extends DashboardFilters>(filters: T): T => {
      if (globalSearch && globalSearch.trim()) {
        return { ...filters, search: globalSearch.trim() };
      }
      return filters;
    },
    [globalSearch]
  );

  const loadInitialData = async () => {
    // Prevent duplicate concurrent calls
    if (isLoadingRef.current) {
      console.log(
        "⏸️ loadInitialData already in progress, skipping duplicate call"
      );
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setIsLoadingOutstandingChart(true);
      setIsLoadingBudget(true);
      setIsLoadingCustomerInteraction(true);
      setIsLoadingEnquiryConversion(true);
      setIsLoadingCallEntry(true);

      const currentYear = dayjs().year().toString();
      const startMonth = `${currentYear}-04`;
      const currentMonth = dayjs().month() + 1;
      const prevMonth = currentMonth - 1;
      const endMonth =
        prevMonth > 0
          ? `${currentYear}-${String(prevMonth).padStart(2, "0")}`
          : `${parseInt(currentYear) - 1}-12`;

      setBudgetStartMonth(startMonth);
      setBudgetEndMonth(endMonth);

      const budgetPayload = {
        start_month: startMonth,
        end_month: endMonth,
        type: "salesperson",
      };
      console.log("🔥 Initial Budget Payload:", budgetPayload);

      // Get company name from user's auth data
      const companyName =
        user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
      console.log("🏢 User company name:", companyName);

      // Use Promise.allSettled to ensure each API call is independent
      // If one fails, others can still succeed and display their data
      const results = await Promise.allSettled([
        // Use filtered API call with company name to get location data directly
        companyName
          ? getFilteredOutstandingData(
              addSearchToFilters({ company: companyName })
            )
          : getFilteredOutstandingData({ company: companyName }),
        // Use filtered API call with company name for budget data
        companyName
          ? getFilteredBudgetData(
              addSearchToFilters({
                ...budgetPayload,
                company: companyName,
              } as any)
            )
          : "",
        // Customer Interaction Status Summary (replaces individual customer data calls)
        // Updated to use date range instead of period
        customerInteractionFromDate && customerInteractionToDate
          ? getCustomerInteractionStatusSummary({
              company: companyName,
              date_from: dayjs(customerInteractionFromDate).format(
                "DD-MM-YYYY"
              ),
              date_to: dayjs(customerInteractionToDate).format("DD-MM-YYYY"),
            })
          : getCustomerInteractionStatusSummary({
              company: companyName,
              period: customerInteractionPeriod,
            }),
        // Use filtered API call with company name and date range for enquiry conversion data
        // Updated to use date range instead of period
        (async () => {
          const filterData: DashboardFilters = addSearchToFilters({
            ...(companyName && { company: companyName }),
            ...(customerInteractionFromDate && customerInteractionToDate
              ? {
                  date_from: dayjs(customerInteractionFromDate).format(
                    "DD-MM-YYYY"
                  ),
                  date_to: dayjs(customerInteractionToDate).format(
                    "DD-MM-YYYY"
                  ),
                }
              : (() => {
                  const dateRange = calculateCallEntryDateRange(enquiryPeriod);
                  return {
                    date_from: dateRange.date_from,
                    date_to: dateRange.date_to,
                  };
                })()),
          });
          return await getFilteredEnquiryConversionData(filterData);
        })(),
        // Call entry statistics - use date range instead of period
        (async () => {
          return await getCallEntryStatistics(
            addSearchToFilters({
              company: companyName,
              ...(customerInteractionFromDate && customerInteractionToDate
                ? {
                    date_from: dayjs(customerInteractionFromDate).format(
                      "DD-MM-YYYY"
                    ),
                    date_to: dayjs(customerInteractionToDate).format(
                      "DD-MM-YYYY"
                    ),
                  }
                : (() => {
                    const dateRange =
                      calculateCallEntryDateRange(callEntryPeriod);
                    return {
                      date_from: dateRange.date_from,
                      date_to: dateRange.date_to,
                    };
                  })()),
            })
          );
        })(),
      ]);

      // Extract responses from settled promises, handling failures gracefully
      const outstandingResponse =
        results[0].status === "fulfilled" ? results[0].value : null;
      const budgetResponse =
        results[1].status === "fulfilled" ? results[1].value : null;
      const customerInteractionResponse =
        results[2].status === "fulfilled" ? results[2].value : null;
      const enquiryConversionResponse =
        results[3].status === "fulfilled" ? results[3].value : null;
      const callEntryResponse =
        results[4].status === "fulfilled" ? results[4].value : null;

      // Log any failed API calls for debugging
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const apiNames = [
            "Outstanding",
            "Budget",
            "Customer Interaction Status",
            "Enquiry Conversion",
            "Call Entry",
          ];
          console.error(`❌ ${apiNames[index]} API failed:`, result.reason);
          toast.error(`Failed to load ${apiNames[index]} data`);
        }
      });

      // Set loading state to false ONLY after processing responses
      // This ensures loaders stay active until data is actually set

      // Process Outstanding response and set loading to false only after data is set
      if (
        outstandingResponse?.data &&
        Array.isArray(outstandingResponse.data)
      ) {
        if (companyName) {
          // If we have a company name, we get location data directly and start at drill level 1
          const calculatedData =
            calculateFilteredAggregatedData(outstandingResponse);

          setAggregatedData(calculatedData);
          setCompanySummary([]); // Empty for level 1
          setLocationData(outstandingResponse.data); // Location data
          setDrillLevel(1); // Start at level 1
          setIsFilterMode(false);
          setSelectedCompanyCtx({
            company: companyName,
            branch_code:
              user?.branches?.find((b) => b.is_default)?.branch_code || "",
          });
          setSelectedCompany(companyName);
          setSalespersonData([]);
          setContextTotals({
            outstanding: calculatedData.totalOutstanding,
            overdue: calculatedData.totalOverdue,
          });
        } else {
          // Fallback to original behavior if no company name
          const calculatedData = calculateAggregatedData(
            outstandingResponse.data as any
          );

          setAggregatedData(calculatedData);
          setCompanySummary(outstandingResponse.data as any);
          setDrillLevel(0);
          setIsFilterMode(false);
          setSelectedCompanyCtx({});
          setLocationData([]);
          setSalespersonData([]);
          setContextTotals({
            outstanding: calculatedData.totalOutstanding,
            overdue: calculatedData.totalOverdue,
          });
        }

        // Only set unique companies and locations if we have company data (level 0)
        if (!companyName && outstandingResponse.data) {
          const uniqueCompanies = [
            ...new Set(
              (outstandingResponse.data as any).map(
                (item: any) => item.company_name
              )
            ),
          ] as string[];
          const uniqueLocations = [
            ...new Set(
              (outstandingResponse.data as any).flatMap(
                (item: any) => item.locations
              )
            ),
          ] as string[];
          setOriginalCompanies(uniqueCompanies);
          setOriginalLocations(uniqueLocations);
        }
        // Set loading to false ONLY after data is set
        setIsLoadingOutstandingChart(false);
      } else if (results[0].status === "rejected") {
        setIsLoadingOutstandingChart(false);
      }

      // Process Budget response and set loading to false only after data is set
      if (budgetResponse && typeof budgetResponse !== "string") {
        const budgetData = calculateBudgetAggregatedData(budgetResponse);
        setBudgetAggregatedData(budgetData);
        setBudgetRawData(budgetResponse);

        // Always start at salesperson level (level 1)
        setBudgetDrillLevel(1);
        setBudgetSelectedCompany(companyName);

        setBudgetSelectedSalesperson(null);
        setBudgetSelectedMonth(null);
        setBudgetWindowStart(0);
        const dr = budgetResponse?.data?.[0]?.date_range || "";
        setBudgetDateRange(dr);
        setSelectedYear(dayjs().year().toString());
        // Set loading to false ONLY after data is set
        setIsLoadingBudget(false);
      } else if (results[1].status === "rejected") {
        setIsLoadingBudget(false);
      }

      // Process Customer Interaction Status response
      if (customerInteractionResponse) {
        setCustomerInteractionData(customerInteractionResponse);
        setIsLoadingCustomerInteraction(false);
      } else if (results[2].status === "rejected") {
        setIsLoadingCustomerInteraction(false);
      }

      // Process Enquiry Conversion response
      if (enquiryConversionResponse) {
        const hasEnquiryData =
          (enquiryConversionResponse as any)?.data?.[0]?.Enquiry_data !==
          undefined;

        const calculatedEnquiryConversionData = hasEnquiryData
          ? calculateEnquiryConversionAggregatedData(
              enquiryConversionResponse as any
            )
          : calculateFilteredEnquiryConversionAggregatedData(
              enquiryConversionResponse as any
            );

        setEnquiryConversionAggregatedData(calculatedEnquiryConversionData);
        // Don't reset period here - preserve user's selected period
        setIsLoadingEnquiryConversion(false);
      } else if (results[3].status === "rejected") {
        setIsLoadingEnquiryConversion(false);
      }

      // Process Call Entry response
      if (callEntryResponse) {
        // New API response structure
        setCallEntryStatisticsData(
          callEntryResponse as CallEntryStatisticsResponse
        );
        setCallEntrySummary(
          (callEntryResponse as CallEntryStatisticsResponse).summary
        );
        // Don't reset period here - let it be controlled by user selection only
        setIsLoadingCallEntry(false);
      } else if (results[4].status === "rejected") {
        setIsLoadingCallEntry(false);
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
      toast.error("Failed to load dashboard data");
      // Set all loaders to false on error
      setLoading(false);
      setIsLoadingOutstandingChart(false);
      setIsLoadingBudget(false);
      setIsLoadingCustomerInteraction(false);
      setIsLoadingEnquiryConversion(false);
      setIsLoadingCallEntry(false);
    } finally {
      // Only set loading to false if all operations completed
      // Individual module loaders are set above after data processing
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const resetToInitialState = async () => {
    try {
      setLoading(true);
      setIsLoadingOutstandingChart(true);
      setIsLoadingBudget(true);
      setIsLoadingEnquiryChart(true);

      setDrillLevel(0);
      setIsFilterMode(false);
      setSelectedCompanyCtx({});
      setLocationData([]);
      setSalespersonData([]);

      const companyName =
        user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
      const summaryResponse = await getFilteredOutstandingData({
        company: companyName,
      });
      if (summaryResponse?.data && Array.isArray(summaryResponse.data)) {
        const calculatedData = calculateFilteredAggregatedData(summaryResponse);
        setAggregatedData(calculatedData);
        setCompanySummary([]);
        setLocationData(summaryResponse.data);
        setDrillLevel(1);
        setSelectedCompanyCtx({
          company: companyName,
          branch_code:
            user?.branches?.find((b) => b.is_default)?.branch_code || "",
        });
        setSelectedCompany(companyName);
        setContextTotals({
          outstanding: calculatedData.totalOutstanding,
          overdue: calculatedData.totalOverdue,
        });
      }

      const enquiryResponse = await getEnquiryConversionData();
      const aggregatedEnquiryConversion =
        calculateEnquiryConversionAggregatedData(enquiryResponse);
      setEnquiryConversionAggregatedData(aggregatedEnquiryConversion);
      // Don't reset period here - preserve user's selected period

      if (callEntryData.length > 0) {
        const aggregatedCallEntry =
          calculateCallEntryAggregatedData(callEntryData);
        setCallEntryAggregatedData(aggregatedCallEntry);
      }

      const currentYear = dayjs().year().toString();
      const startMonth = `${currentYear}-04`;
      const currentMonth = dayjs().month() + 1;
      const prevMonth = currentMonth - 1;
      const endMonth =
        prevMonth > 0
          ? `${currentYear}-${String(prevMonth).padStart(2, "0")}`
          : `${parseInt(currentYear) - 1}-12`;

      setBudgetStartMonth(startMonth);
      setBudgetEndMonth(endMonth);

      // Reuse companyName from above
      const budgetResponse = await getFilteredBudgetData({
        company: companyName,
        start_month: startMonth,
        end_month: endMonth,
        type: budgetType,
      } as any);

      const budgetData = calculateBudgetAggregatedData(budgetResponse);
      setBudgetAggregatedData(budgetData);
      setBudgetRawData(budgetResponse);
      setBudgetDrillLevel(1);
      setBudgetSelectedCompany(companyName);
      setBudgetSelectedSalesperson(null);
      setBudgetSelectedMonth(null);
      setBudgetWindowStart(1);
      setBudgetDateRange(budgetResponse?.data?.[0]?.date_range || "");
    } catch (error) {
      console.error("Error resetting to initial state:", error);
    } finally {
      setLoading(false);
      setIsLoadingOutstandingChart(false);
      setIsLoadingBudget(false);
      setIsLoadingEnquiryChart(false);
    }
  };

  const handleOutstandingViewAll = async () => {
    try {
      setIsLoadingDetailedView(true);
      setShowDetailedView(true);
      setDetailedViewType("outstanding");
      setDetailedViewTitle("Outstanding vs Over Due - Detailed View");
      setDetailedViewSearch(globalSearch); // Initialize with current search

      // Use current dashboard filter values
      setDetailedViewSelectedCompany(selectedCompany);
      setDetailedViewSelectedLocation(selectedLocation);
      setDetailedViewSelectedSalesperson(
        searchSalesman ? searchSalesman : null
      );

      // Use SAME drill level as dashboard
      setDetailedViewDrillLevel(drillLevel);

      const filterData: DashboardFilters = addSearchToFilters({
        ...(selectedCompany && { company: selectedCompany }),
        ...(selectedLocation && { location: selectedLocation }),
        ...(searchSalesman && { salesman: searchSalesman }),
        ...(selectedYear && { year: parseInt(selectedYear) }),
        ...(selectedDate && {
          date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
          date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
        }),
      });

      const response = await getFilteredOutstandingData(filterData);

      const shouldRemoveSalespersonColumns = !!searchSalesman;
      const tableData = convertFilteredResponseToTableData(
        response,
        shouldRemoveSalespersonColumns
      );

      if (searchSalesman) {
        setDetailedViewTitle(`Outstanding vs Over Due - ${searchSalesman}`);
      }

      setDetailedViewData(tableData);
    } catch (error) {
      console.error("Error loading detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  const handleBudgetViewAll = async () => {
    try {
      setIsLoadingDetailedView(true);
      setShowDetailedView(true);
      setDetailedViewType("budget");
      setDetailedViewSearch(globalSearch); // Initialize with current search

      // Use current dashboard filter values with fallback to user company
      const companyName =
        user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
      setDetailedViewSelectedCompany(companyName);
      setDetailedViewSelectedSalesperson(budgetSelectedSalesperson);

      // Use SAME drill level as dashboard
      setDetailedViewDrillLevel(budgetDrillLevel);

      let title = "Budget vs Actual - Overall";
      let response: any;

      if (budgetDrillLevel === 0) {
        title = "Budget vs Actual - Overall";
        const filterData: DashboardFilters = addSearchToFilters({
          ...(budgetStartMonth && { start_month: budgetStartMonth }),
          ...(budgetEndMonth && { end_month: budgetEndMonth }),
          type: budgetType,
        });
        response = await getFilteredBudgetData(filterData as any);
      } else if (budgetDrillLevel === 1) {
        const companyName =
          user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
        title = "Budget vs Actual - Salesperson Wise";
        const filterData: DashboardFilters = addSearchToFilters({
          company: companyName,
          ...(budgetStartMonth && { start_month: budgetStartMonth }),
          ...(budgetEndMonth && { end_month: budgetEndMonth }),
          type: budgetType,
        });
        response = await getFilteredBudgetData(filterData as any);
      } else if (budgetDrillLevel === 2) {
        // Month wise view - show salesperson name
        const companyName =
          user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
        const salespersonName = budgetSelectedSalesperson || "";
        title = `Budget vs Actual - ${salespersonName} - Month Wise`;
        const filterData: DashboardFilters = addSearchToFilters({
          company: companyName,
          salesman: salespersonName,
          ...(budgetStartMonth && { start_month: budgetStartMonth }),
          ...(budgetEndMonth && { end_month: budgetEndMonth }),
          type: budgetType,
        });
        response = await getFilteredBudgetData(filterData as any);
      } else if (budgetDrillLevel === 3) {
        // Specific month selected
        const companyName =
          user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
        const salespersonName = budgetSelectedSalesperson || "";
        const monthFormatted = budgetSelectedMonth
          ? dayjs(budgetSelectedMonth + "-01").format("MMMM YYYY")
          : "";
        title = `Budget vs Actual - ${salespersonName} - ${monthFormatted}`;
        const filterData: DashboardFilters = addSearchToFilters({
          company: companyName,
          salesman: salespersonName,
          ...(budgetSelectedMonth && {
            start_month: budgetSelectedMonth,
            end_month: budgetSelectedMonth,
          }),
          ...(!budgetSelectedMonth && {
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
          }),
          type: budgetType,
        });
        response = await getFilteredBudgetData(filterData as any);
      }

      setDetailedViewTitle(title);

      const tableData = convertBudgetResponseToTableData(
        response,
        budgetDrillLevel,
        budgetType
      );
      setDetailedViewData(tableData);
    } catch (error) {
      console.error("Error loading budget detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  const handleEnquiryConversionViewAll = async (
    filterType: "all" | "gain" | "lost" | "active" | "quote" = "all"
  ) => {
    try {
      setIsLoadingDetailedView(true);
      setShowDetailedView(true);
      setDetailedViewType("enquiry");
      setEnquiryFilterType(filterType);
      setInitialEnquiryFilterType(filterType);
      setDetailedViewSearch(globalSearch); // Initialize with current search

      // Set drill level based on current dashboard state
      let drillLevel: 0 | 1 | 2 = 0;
      if (searchSalesman && selectedCompany) {
        drillLevel = 2; // Salesperson level
        setDetailedViewSelectedCompany(selectedCompany);
        setDetailedViewSelectedSalesperson(searchSalesman);
      } else if (selectedCompany) {
        drillLevel = 1; // Company level
        setDetailedViewSelectedCompany(selectedCompany);
        setDetailedViewSelectedSalesperson(null);
      } else {
        drillLevel = 0; // Initial level - don't set company name
        setDetailedViewSelectedCompany(null);
        setDetailedViewSelectedSalesperson(null);
      }
      setDetailedViewDrillLevel(drillLevel);

      let title = "Enquiry Conversion - Detailed View";
      if (filterType === "gain") {
        title = "Enquiry Conversion - Gain Only";
      } else if (filterType === "lost") {
        title = "Enquiry Conversion - Lost Only";
      } else if (filterType === "active") {
        title = "Enquiry Conversion - Active Only";
      } else if (filterType === "quote") {
        title = "Enquiry Conversion - Quoted Only";
      }
      setDetailedViewTitle(title);

      // Calculate date range from selected period
      const dateRange = calculateCallEntryDateRange(enquiryPeriod);

      const filterData: DashboardFilters = {
        ...(selectedCompany && { company: selectedCompany }),
        ...(selectedLocation && { location: selectedLocation }),
        ...(searchSalesman && { salesman: searchSalesman }),
        ...(selectedYear && { year: parseInt(selectedYear) }),
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
        ...(filterType !== "all" && {
          type:
            filterType === "gain"
              ? "gained"
              : filterType === "lost"
                ? "lost"
                : filterType === "active"
                  ? "active"
                  : filterType === "quote"
                    ? "quote created"
                    : "",
        }),
        ...(globalSearch?.trim() && { search: globalSearch.trim() }),
      };

      // console.log("DasboardFilters", filterData);
      const response = await getFilteredEnquiryConversionData(filterData);
      let tableData = convertEnquiryResponseToTableData(response);
      // let tableData = response;

      // if (filterType === "gain") {
      //   tableData = tableData.filter(
      //     (item) => (item.gained || item.total_gain || 0) != "0 (0%)"
      //   );
      // } else if (filterType === "lost") {
      //   tableData = tableData.filter(
      //     (item) => (item.lost || item.total_lost || 0) != "0 (0%)"
      //   );
      // } else if (filterType === "active") {
      //   tableData = tableData.filter(
      //     (item) => (item.active || item.total_active || 0) != "0 (0%)"
      //   );
      // } else if (filterType === "quote") {
      //   tableData = tableData.filter(
      //     (item) => (item.quote_created || item.total_quote_created || 0) != "0 (0%)"
      //   );
      // }

      // console.log("DasboardTableData", tableData);
      setDetailedViewData(tableData);
    } catch (error) {
      console.error("Error loading enquiry conversion detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  const handleCallEntryViewAll = async (
    filterType: "all" | "overdue" | "today" | "upcoming" | "closed" = "all"
  ) => {
    setIsLoadingDetailedView(true);
    setShowDetailedView(true);
    setDetailedViewType("callentry");
    setCallEntryFilterType(filterType);
    setInitialCallEntryFilterType(filterType); // Preserve initial filter type
    setCallEntryDrillLevel(0); // Start at drill level 0 (salesperson list)
    setDetailedViewDrillLevel(0);
    setDetailedViewSearch(globalSearch); // Initialize with current search

    let title = "Call Entry - Detailed View";
    if (filterType === "overdue") {
      title = "Call Entry - Overdue Only";
    } else if (filterType === "today") {
      title = "Call Entry - Today's Calls Only";
    } else if (filterType === "upcoming") {
      title = "Call Entry - Upcoming Calls";
    } else if (filterType === "closed") {
      title = "Call Entry - Closed Calls";
    }
    setDetailedViewTitle(title);

    try {
      // Fetch data with search parameter if available
      const dateRange = calculateCallEntryDateRange(callEntryPeriod);
      const companyName =
        user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

      const response = await getCallEntryStatistics({
        company: companyName,
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
        ...(filterType !== "all" && { type: filterType }),
        ...(globalSearch?.trim() && { search: globalSearch.trim() }),
      });

      const tableData = (response.data as CallEntrySalespersonData[]).map(
        (item) => ({
          SALESPERSON: item.salesperson,
          OVERDUE: item.total_overdue,
          TODAY: item.total_today,
          UPCOMING: item.total_upcoming,
          CLOSED: item.total_closed,
          TOTAL_CALLS: item.total_calls,
          // Enable Send Email action at salesperson level
          send_email: "send_email",
          salesperson_email: item.salesperson_email || "",
          cc_mail: item.cc_mail || [],
        })
      );
      // Sort by total calls in descending order
      tableData.sort((a, b) => {
        const aTotal = a.TOTAL_CALLS || 0;
        const bTotal = b.TOTAL_CALLS || 0;
        return bTotal - aTotal; // Descending order
      });
      setDetailedViewData(tableData);
    } catch (error) {
      console.error("Error loading call entry detailed view:", error);
      toast.error("Failed to load call entry data");
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  // Customer Not Visited handlers (similar to Budget handlers)
  const handleCustomerNotVisitedPeriodChange = useCallback(
    async (value: string | null) => {
      if (!value) return;
      try {
        setIsLoadingCustomerNotVisited(true);
        const response = await getCustomerNotVisitedData({
          period: value,
          company: customerNotVisitedSelectedCompany || undefined,
          salesperson: customerNotVisitedSelectedSalesperson || undefined,
          index: 0,
          limit: 10,
        });
        setCustomerNotVisitedRawData(response);
        setCustomerNotVisitedPeriod(value);
      } catch (error) {
        console.error("Error changing customer not visited period:", error);
      } finally {
        setIsLoadingCustomerNotVisited(false);
      }
    },
    [customerNotVisitedSelectedCompany, customerNotVisitedSelectedSalesperson]
  );

  const handleCustomerNotVisitedCompanyClick = useCallback(
    async (companyName: string) => {
      try {
        setIsLoadingCustomerNotVisited(true);
        const response = await getCustomerNotVisitedData({
          company: companyName,
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });
        setCustomerNotVisitedRawData(response);
        setCustomerNotVisitedSelectedCompany(companyName);
        setCustomerNotVisitedDrillLevel(1);
      } catch (error) {
        console.error("Error clicking company:", error);
      } finally {
        setIsLoadingCustomerNotVisited(false);
      }
    },
    [customerNotVisitedPeriod]
  );

  const handleCustomerNotVisitedSalespersonClick = useCallback(
    async (salesperson: string) => {
      try {
        setIsLoadingCustomerNotVisited(true);
        const response = await getCustomerNotVisitedData({
          company: customerNotVisitedSelectedCompany || "",
          salesperson: salesperson,
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });
        setCustomerNotVisitedRawData(response);
        setCustomerNotVisitedSelectedSalesperson(salesperson);
        setCustomerNotVisitedDrillLevel(2);
      } catch (error) {
        console.error("Error clicking salesperson:", error);
      } finally {
        setIsLoadingCustomerNotVisited(false);
      }
    },
    [customerNotVisitedSelectedCompany, customerNotVisitedPeriod]
  );

  const handleCustomerNotVisitedBack = useCallback(async () => {
    try {
      setIsLoadingCustomerNotVisited(true);
      if (customerNotVisitedDrillLevel === 2) {
        // Go back to level 1 (salesperson list)
        const response = await getCustomerNotVisitedData({
          company: customerNotVisitedSelectedCompany || "",
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });
        setCustomerNotVisitedRawData(response);
        setCustomerNotVisitedSelectedSalesperson(null);
        setCustomerNotVisitedDrillLevel(1);
      } else if (customerNotVisitedDrillLevel === 1) {
        // Go back to level 0 (company list)
        const response = await getCustomerNotVisitedData({
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });
        setCustomerNotVisitedRawData(response);
        setCustomerNotVisitedSelectedCompany(null);
        setCustomerNotVisitedDrillLevel(0);
      }
    } catch (error) {
      console.error("Error going back:", error);
    } finally {
      setIsLoadingCustomerNotVisited(false);
    }
  }, [
    customerNotVisitedDrillLevel,
    customerNotVisitedSelectedCompany,
    customerNotVisitedPeriod,
  ]);

  // Convert Customer Not Visited response to table data
  const convertCustomerNotVisitedToTableData = (
    response: any,
    drillLevel: number
  ) => {
    const tableData: any[] = [];

    if (!response?.data || !Array.isArray(response.data)) {
      return tableData;
    }

    if (drillLevel === 0) {
      // Level 0: Show company name and total
      response.data.forEach((item: any) => {
        tableData.push({
          company_name: item.company_name,
          total_customers: item.total || 0,
        });
      });
    } else if (drillLevel === 1) {
      // Level 1: Show salesperson and customer count (aggregated)
      response.data.forEach((item: any) => {
        tableData.push({
          salesperson: item.salesperson,
          total_customers: item.count || 0,
        });
      });
    } else {
      // Level 2: Show customer details
      response.data.forEach((item: any) => {
        tableData.push({
          customer_code: item.customer_code,
          customer_name: item.customer_name,
          branch_name: item.branch_name,
          status: item.status,
          last_date: item.last_date || "-",
        });
      });
    }

    return tableData;
  };

  // Convert Lost Customer response to table data
  const convertLostCustomerToTableData = (
    response: any,
    drillLevel: number,
    selectedSalesperson?: string
  ) => {
    const tableData: any[] = [];

    if (!response?.data || !Array.isArray(response.data)) {
      return tableData;
    }

    if (drillLevel === 0) {
      // Level 0: Show salesperson name and customer count (filter out salespersons with 0 customers)
      response.data
        .filter((item: any) => item.customer_count > 0)
        .forEach((item: any) => {
          tableData.push({
            salesperson: item.user_name,
            total_customers: item.customer_count || 0,
          });
        });
    } else if (drillLevel === 1) {
      // Level 1: Show customer details for selected salesperson
      const salespersonToUse =
        selectedSalesperson || lostCustomerSelectedSalesperson;
      const salespersonData = response.data.find(
        (item: any) => item.user_name === salespersonToUse
      );
      if (salespersonData?.customers) {
        salespersonData.customers.forEach((customer: any) => {
          tableData.push({
            customer_code: customer.customer_code,
            customer_name: customer.customer_name,
            job_date: customer.job_date,
          });
        });
      }
    }

    return tableData;
  };

  const handleCustomerNotVisitedViewAll = useCallback(async () => {
    try {
      // Navigate IMMEDIATELY - don't wait for API
      setShowDetailedView(true);
      setIsLoadingDetailedView(true);
      setDetailedViewType("customerNotVisited");
      setDetailedViewSearch(globalSearch); // Initialize with current search

      // Use current dashboard filter values
      setDetailedViewSelectedCompany(customerNotVisitedSelectedCompany);
      setDetailedViewSelectedSalesperson(customerNotVisitedSelectedSalesperson);

      // Use SAME drill level as dashboard
      setDetailedViewDrillLevel(customerNotVisitedDrillLevel);

      let response: any;
      let title = "";

      // Fetch full list data for detailed view
      if (customerNotVisitedDrillLevel === 0) {
        title = "Customer Not Visited - All Companies";
        response = await getCustomerNotVisitedData({
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });
      } else if (customerNotVisitedDrillLevel === 1) {
        title = `Customer Not Visited - ${customerNotVisitedSelectedCompany}`;
        response = await getCustomerNotVisitedData({
          company: customerNotVisitedSelectedCompany || "",
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });
      } else {
        title = `Customer Not Visited - ${customerNotVisitedSelectedCompany} - ${customerNotVisitedSelectedSalesperson}`;
        response = await getCustomerNotVisitedData({
          company: customerNotVisitedSelectedCompany || "",
          salesperson: customerNotVisitedSelectedSalesperson || "",
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });
      }

      setDetailedViewTitle(title);

      // Transform data based on drill level
      const tableData = convertCustomerNotVisitedToTableData(
        response,
        customerNotVisitedDrillLevel
      );
      setDetailedViewData(tableData);

      // Set total records based on drill level
      if (customerNotVisitedDrillLevel === 0) {
        setCustomerNotVisitedTotalRecords(
          response.summary?.total_company_count || 0
        );
      } else if (customerNotVisitedDrillLevel === 1) {
        setCustomerNotVisitedTotalRecords(
          response.summary?.total_salesperson_count || 0
        );
      } else {
        setCustomerNotVisitedTotalRecords(response.summary?.total || 0);
      }
    } catch (error) {
      console.error("Error loading customer not visited detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  }, [
    customerNotVisitedDrillLevel,
    customerNotVisitedSelectedCompany,
    customerNotVisitedSelectedSalesperson,
    customerNotVisitedPeriod,
  ]);

  const handleCustomerNotVisitedPaginationChange = async (pagination: {
    pageIndex: number;
    pageSize: number;
  }) => {
    try {
      setIsLoadingDetailedView(true);

      let response: any;

      if (customerNotVisitedDrillLevel === 0) {
        response = await getCustomerNotVisitedData({
          period: customerNotVisitedPeriod,
          index: pagination.pageIndex,
          limit: pagination.pageSize,
        });
      } else if (customerNotVisitedDrillLevel === 1) {
        response = await getCustomerNotVisitedData({
          company: customerNotVisitedSelectedCompany || "",
          period: customerNotVisitedPeriod,
          index: pagination.pageIndex,
          limit: pagination.pageSize,
        });
      } else {
        response = await getCustomerNotVisitedData({
          company: customerNotVisitedSelectedCompany || "",
          salesperson: customerNotVisitedSelectedSalesperson || "",
          period: customerNotVisitedPeriod,
          index: pagination.pageIndex,
          limit: pagination.pageSize,
        });
      }

      // Transform data based on drill level
      const tableData = convertCustomerNotVisitedToTableData(
        response,
        customerNotVisitedDrillLevel
      );
      setDetailedViewData(tableData);
    } catch (error) {
      console.error("Error changing pagination:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  // Lost Customer handlers (similar to Customer Not Visited handlers)
  const handleLostCustomerPeriodChange = useCallback(
    async (value: string | null) => {
      if (!value) return;
      try {
        setIsLoadingLostCustomer(true);
        const response = await getLostCustomerData({
          period: value,
          company:
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA",
        });
        setLostCustomerRawData(response);
        setLostCustomerPeriod(value);
      } catch (error) {
        console.error("Error changing lost customer period:", error);
      } finally {
        setIsLoadingLostCustomer(false);
      }
    },
    [user?.company?.company_name, selectedCompany]
  );

  const handleLostCustomerSalespersonClick = useCallback(
    async (salesperson: string) => {
      try {
        setIsLoadingLostCustomer(true);
        const response = await getLostCustomerData({
          company:
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA",
          period: lostCustomerPeriod,
        });
        // Filter to show only the selected salesperson's customers
        const filteredData = {
          ...response,
          data: response.data.filter(
            (item: any) => item.user_name === salesperson
          ),
        };
        setLostCustomerRawData(filteredData);
        setLostCustomerSelectedSalesperson(salesperson);
        setLostCustomerDrillLevel(1);
      } catch (error) {
        console.error("Error clicking salesperson:", error);
      } finally {
        setIsLoadingLostCustomer(false);
      }
    },
    [user?.company?.company_name, selectedCompany, lostCustomerPeriod]
  );

  const handleLostCustomerBack = useCallback(async () => {
    try {
      setIsLoadingLostCustomer(true);
      const response = await getLostCustomerData({
        company:
          user?.company?.company_name || selectedCompany || "PENTAGON INDIA",
        period: lostCustomerPeriod,
      });
      setLostCustomerRawData(response);
      setLostCustomerSelectedSalesperson(null);
      setLostCustomerDrillLevel(0);
    } catch (error) {
      console.error("Error going back:", error);
    } finally {
      setIsLoadingLostCustomer(false);
    }
  }, [user?.company?.company_name, selectedCompany, lostCustomerPeriod]);

  const handleLostCustomerViewAll = useCallback(async () => {
    try {
      // Navigate IMMEDIATELY - don't wait for API
      setShowDetailedView(true);
      setIsLoadingDetailedView(true);
      setDetailedViewType("lostCustomer");
      setDetailedViewSearch(globalSearch); // Initialize with current search

      // Use current dashboard filter values
      setDetailedViewSelectedSalesperson(lostCustomerSelectedSalesperson);

      // Set drill level and title
      setDetailedViewDrillLevel(lostCustomerDrillLevel);

      let title = "Lost Customer - Detailed View";
      if (lostCustomerDrillLevel === 0) {
        title = "Lost Customer - All Salespersons";
      } else if (lostCustomerDrillLevel === 1) {
        title = `Lost Customer - ${lostCustomerSelectedSalesperson}`;
      }
      setDetailedViewTitle(title);

      // Load detailed view data
      const response = await getLostCustomerData({
        company:
          user?.company?.company_name || selectedCompany || "PENTAGON INDIA",
        period: lostCustomerPeriod,
      });

      // Transform data based on drill level
      const tableData = convertLostCustomerToTableData(
        response,
        lostCustomerDrillLevel,
        lostCustomerSelectedSalesperson || undefined
      );
      setDetailedViewData(tableData);

      // Set total records
      if (lostCustomerDrillLevel === 0) {
        const salespersonsWithCustomers =
          response.data?.filter((item: any) => item.customer_count > 0) || [];
        setLostCustomerTotalRecords(salespersonsWithCustomers.length);
      } else if (lostCustomerDrillLevel === 1) {
        const salespersonData = response.data.find(
          (item: any) => item.user_name === lostCustomerSelectedSalesperson
        );
        setLostCustomerTotalRecords(salespersonData?.customer_count || 0);
      } else {
        setLostCustomerTotalRecords(response.data.length || 0);
      }
    } catch (error) {
      console.error("Error loading lost customer detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  }, [
    lostCustomerDrillLevel,
    lostCustomerSelectedSalesperson,
    lostCustomerPeriod,
    user?.company?.company_name,
  ]);

  // New Customer handlers (similar to CustomerNotVisited handlers)
  const handleNewCustomerPeriodChange = useCallback(
    async (value: string | null) => {
      if (!value) return;
      try {
        setIsLoadingNewCustomer(true);
        const response = await getNewCustomerData({
          company: user?.company?.company_name || "PENTAGON Dubai",
          period: value,
        });
        setNewCustomerRawData(response);
        setNewCustomerOriginalData(response); // Store original data
        setNewCustomerPeriod(value);
      } catch (error) {
        console.error("Error changing new customer period:", error);
      } finally {
        setIsLoadingNewCustomer(false);
      }
    },
    [user?.company?.company_name]
  );

  const handleNewCustomerSalespersonClick = useCallback(
    async (salesperson: string) => {
      try {
        setIsLoadingNewCustomer(true);
        // For New Customer, we don't need to make another API call
        // We just drill down to show the customers for this salesperson
        const salespersonData = newCustomerRawData?.data?.find(
          (item: any) => item.user_name === salesperson
        );
        if (salespersonData) {
          setNewCustomerRawData({
            ...newCustomerRawData,
            data: salespersonData.customers,
          });
          setNewCustomerSelectedSalesperson(salesperson);
          setNewCustomerDrillLevel(1);
        }
      } catch (error) {
        console.error("Error clicking salesperson:", error);
      } finally {
        setIsLoadingNewCustomer(false);
      }
    },
    [newCustomerRawData]
  );

  const handleNewCustomerBack = useCallback(async () => {
    try {
      setIsLoadingNewCustomer(true);
      if (newCustomerDrillLevel === 1) {
        // Go back to level 0 (salesperson list)
        const response = await getNewCustomerData({
          company: user?.company?.company_name || "PENTAGON Dubai",
          period: newCustomerPeriod,
        });
        setNewCustomerRawData(response);
        setNewCustomerOriginalData(response); // Store original data
        setNewCustomerSelectedSalesperson(null);
        setNewCustomerDrillLevel(0);
      }
    } catch (error) {
      console.error("Error going back:", error);
    } finally {
      setIsLoadingNewCustomer(false);
    }
  }, [newCustomerDrillLevel, newCustomerPeriod, user?.company?.company_name]);

  const handleNewCustomerViewAll = useCallback(async () => {
    try {
      // Navigate IMMEDIATELY - don't wait for API
      setShowDetailedView(true);
      setIsLoadingDetailedView(true);
      setDetailedViewType("newCustomer");
      setDetailedViewSearch(globalSearch); // Initialize with current search

      // Use current dashboard filter values
      setDetailedViewSelectedSalesperson(newCustomerSelectedSalesperson);

      // Use SAME drill level as dashboard
      setDetailedViewDrillLevel(newCustomerDrillLevel);

      let response: any;
      let title = "";

      // Fetch full list data for detailed view
      if (newCustomerDrillLevel === 0) {
        title = "New Customers - All Salespersons";
        response = await getNewCustomerData({
          company: user?.company?.company_name || "PENTAGON Dubai",
          period: newCustomerPeriod,
        });
      } else if (newCustomerDrillLevel === 1) {
        title = `New Customers - ${newCustomerSelectedSalesperson}`;
        const salespersonData = newCustomerOriginalData?.data?.find(
          (item: any) => item.user_name === newCustomerSelectedSalesperson
        );
        if (salespersonData) {
          response = {
            ...newCustomerOriginalData,
            data: salespersonData.customers,
          };
        }
      }

      setDetailedViewTitle(title);

      // Transform data based on drill level
      const tableData = convertNewCustomerToTableData(
        response,
        newCustomerDrillLevel
      );
      setDetailedViewData(tableData);

      // Set total records based on drill level
      if (newCustomerDrillLevel === 0) {
        // Count only salespersons with customer_count > 0
        const filteredSalespersons =
          response.data?.filter((item: any) => item.customer_count > 0) || [];
        setNewCustomerTotalRecords(filteredSalespersons.length);
      } else {
        setNewCustomerTotalRecords(response.data?.length || 0);
      }
    } catch (error) {
      console.error("Error loading new customer detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  }, [
    newCustomerDrillLevel,
    newCustomerSelectedSalesperson,
    newCustomerPeriod,
    newCustomerOriginalData,
    user?.company?.company_name,
  ]);

  // Convert New Customer response to table data
  const convertNewCustomerToTableData = (response: any, drillLevel: number) => {
    const tableData: any[] = [];

    if (!response?.data || !Array.isArray(response.data)) {
      return tableData;
    }

    if (drillLevel === 0) {
      // Level 0: Show salesperson name and customer count - filter only salespersons with customer_count > 0
      const filteredSalespersons = response.data.filter(
        (item: any) => item.customer_count > 0
      );
      filteredSalespersons.forEach((item: any) => {
        tableData.push({
          salesperson: item.user_name,
          customer_count: item.customer_count,
          email: item.email,
          branch_code: item.branch_code,
        });
      });
    } else if (drillLevel === 1) {
      // Level 1: Show customer name and job date
      response.data.forEach((item: any) => {
        tableData.push({
          customer_name: item.customer_name,
          customer_code: item.customer_code,
          job_date: item.job_date,
        });
      });
    }

    return tableData;
  };

  const refreshCallEntryDetailedView = (
    filterType: "all" | "overdue" | "today" | "upcoming" = "all"
  ) => {
    try {
      const callEntryFilterData: DashboardFilters = {
        ...(selectedDate && {
          date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
          date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
        }),
        ...(searchSalesman && { salesman: searchSalesman }),
      };

      let filteredCallEntryData =
        Object.keys(callEntryFilterData).length > 0
          ? filterCallEntryData(callEntryData, callEntryFilterData)
          : callEntryData;

      const today = dayjs().format("YYYY-MM-DD");
      if (filterType === "overdue") {
        filteredCallEntryData = filteredCallEntryData.filter(
          (entry) => dayjs(entry.followup_date).format("YYYY-MM-DD") < today
        );
      } else if (filterType === "today") {
        filteredCallEntryData = filteredCallEntryData.filter(
          (entry) => dayjs(entry.followup_date).format("YYYY-MM-DD") === today
        );
      }

      filteredCallEntryData = filteredCallEntryData.sort((a, b) =>
        dayjs(a.followup_date).diff(dayjs(b.followup_date))
      );

      const tableData = convertCallEntryDataToTableData(filteredCallEntryData);
      setDetailedViewData(tableData);
    } catch (error) {
      console.error("Error loading call entry detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  // Convert filtered response structure to table format
  const convertFilteredResponseToTableData = (
    response: any,
    removeSalespersonColumns: boolean = false
  ) => {
    const tableData: any[] = [];
    console.log("covert response", response);
    if (response?.data && Array.isArray(response.data)) {
      response.data.forEach((locationData: any) => {
        const list =
          locationData.outstanding_data ||
          locationData.Salesman_outstanding_data;
        if (
          list &&
          Array.isArray(list) &&
          response.filter_type === "location"
        ) {
          const filteredList = list.map((item: any) => {
            const { location, ...rest } = item;
            return {
              ...rest,
              send_email: "send_email", // Add send_email action
              salesperson_email: item.salesperson_email || "",
              cc_mail: item.cc_mail || "",
            };
          });

          tableData.push(...filteredList);
        } else if (
          list &&
          Array.isArray(list) &&
          response.filter_type === "salesman"
        ) {
          console.log("List data in else block:", list);

          list.map((item: any) => {
            tableData.push({
              customer_code: item.customer_code,
              customer_name: item.customer_name,
              send_email: "send_email", // Add send_email action
              outstanding: parseFloat(item.local_outstanding || 0),
              overdue: parseFloat(item.overdue || 0),
              credit_amount: parseFloat(item.credit_amount || 0),
              credit_day: item.credit_day || 0,
              days_0_15: parseFloat(item.days_0_15 || 0),
              days_16_30: parseFloat(item.days_16_30 || 0),
              days_31_45: parseFloat(item.days_31_45 || 0),
              days_46_60: parseFloat(item.days_46_60 || 0),
              days_61_90: parseFloat(item.days_61_90 || 0),
              days_91_120: parseFloat(item.days_91_120 || 0),
              days_121_180: parseFloat(item.days_121_180 || 0),
              days_181_365: parseFloat(item.days_181_365 || 0),
              days_366_730: parseFloat(item.days_366_730 || 0),
              days_730: parseFloat(item.days_730 || 0),
              salesperson_email: item.salesperson_email || "",
              cc_mail: item.cc_mail || "",
            });
          });
          console.log(tableData);
        } else if (response.filter_type === "company") {
          console.log("Location data :", locationData);
          tableData.push({
            location: locationData.location,
            // No send_email field - location data doesn't have salesman or customer
            outstanding: parseFloat(
              locationData.summary?.total_outstanding || 0
            ),
            overdue: parseFloat(locationData.summary?.total_overdue || 0),
          });
        }
      });
    }

    return tableData;
  };

  // Convert budget response structure to table format
  const convertBudgetResponseToTableData = (
    response: any,
    drillLevel: number,
    budgetType: "salesperson" | "non-salesperson" = "salesperson"
  ) => {
    const tableData: any[] = [];

    if (response?.data && Array.isArray(response.data)) {
      response.data.forEach((locationData: any) => {
        if (locationData.budget && Array.isArray(locationData.budget)) {
          if (drillLevel === 0) {
            locationData.budget.forEach((budgetItem: any) => {
              const row: any = {
                company_name: locationData.company_name,
                date_range: locationData.date_range,
                month: budgetItem.month || "-",
                actual_budget: budgetItem.actual_budget || 0,
                sales_budget: budgetItem.sales_budget || 0,
              };

              // Only add achieved column for salesperson type
              if (budgetType === "salesperson") {
                row.achieved = `${(budgetItem.sales_budget > 0
                  ? (budgetItem.actual_budget / budgetItem.sales_budget) * 100
                  : 0
                ).toFixed(1)}%`;
              }
              tableData.push(row);
            });
          } else if (drillLevel === 1) {
            locationData.budget.forEach((budgetItem: any) => {
              const dataRow: any = {
                salesperson: budgetItem.salesperson || "-",
                actual_budget: budgetItem.actual_budget || 0,
                sales_budget: budgetItem.sales_budget || 0,
                // Include company and date range for email payloads
                company_name: locationData.company_name,
                date_range: locationData.date_range,
              };

              // Only add achieved column for salesperson type
              if (budgetType === "salesperson") {
                dataRow.achieved = `${(budgetItem.sales_budget > 0
                  ? (budgetItem.actual_budget / budgetItem.sales_budget) * 100
                  : 0
                ).toFixed(1)}%`;
              }

              // Enable Send Email column at salesperson level with email metadata
              dataRow.send_email = "send_email";
              dataRow.salesperson_email =
                budgetItem.salesperson_email ||
                locationData.salesperson_email ||
                "";
              dataRow.cc_mail =
                budgetItem.cc_mail || locationData.cc_mail || [];

              tableData.push(dataRow);
            });
          } else if (drillLevel === 2) {
            locationData.budget.forEach((budgetItem: any) => {
              const dataRow: any = {
                month: budgetItem.month || "-",
                actual_budget: budgetItem.actual_budget || 0,
                sales_budget: budgetItem.sales_budget || 0,
                incentive_amount: budgetItem.incentive_amount || 0,
              };

              // Only add achieved column for salesperson type
              if (budgetType === "salesperson") {
                dataRow.achieved = `${(budgetItem.sales_budget > 0
                  ? (budgetItem.actual_budget / budgetItem.sales_budget) * 100
                  : 0
                ).toFixed(1)}%`;
              }

              tableData.push(dataRow);
            });
          } else if (drillLevel === 3) {
            locationData.budget.forEach((budgetItem: any) => {
              const row: any = {
                month: budgetItem.month || "-",
                actual_budget: budgetItem.actual_budget || 0,
                sales_budget: budgetItem.sales_budget || 0,
              };

              // Only add achieved column for salesperson type
              if (budgetType === "salesperson") {
                row.achieved = `${(budgetItem.sales_budget > 0
                  ? (budgetItem.actual_budget / budgetItem.sales_budget) * 100
                  : 0
                ).toFixed(1)}%`;
              }

              tableData.push(row);
            });
          }
        }
      });
    }

    return tableData;
  };

  // Convert enquiry conversion response structure to table format
  const convertEnquiryResponseToTableData = (response: any) => {
    const tableData: any[] = [];

    if (response?.data && Array.isArray(response.data)) {
      response.data.forEach((item: any) => {
        // Check for customer data first
        if (
          item.customer_code !== undefined ||
          item.customer_name !== undefined
        ) {
          const active = extractNumericValue(item.active);
          const gained = extractNumericValue(item.gained);
          const lost = extractNumericValue(item.lost);
          const quoteCreated = extractNumericValue(item.quote_created);
          const totalEnquiries = active + gained + lost + quoteCreated;

          tableData.push({
            customer_name: item?.customer_name || "-",
            customer_code: item?.customer_code || "-",
            active: item.active,
            gained: item.gained,
            lost: item.lost,
            quote_created: item.quoteCreated || item.quote_created,
            // No send_email field - customer level doesn't show send email column
            total_enquiries: totalEnquiries,
            // active_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.active / totalEnquiries) * 100)}%`
            //     : "0%",
            // gain_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.gained / totalEnquiries) * 100)}%`
            //     : "0%",
            // loss_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.lost / totalEnquiries) * 100)}%`
            //     : "0%",

            // quoted_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.quote_created / totalEnquiries) * 100)}%`
            //     : "0%",
          });
        } else if (item.salesperson !== undefined) {
          const active = extractNumericValue(item.active);
          const gained = extractNumericValue(item.gained);
          const lost = extractNumericValue(item.lost);
          const quoteCreated = extractNumericValue(item.quote_created);
          const totalEnquiries = active + gained + lost + quoteCreated;
          tableData.push({
            salesperson: item.salesperson || "-",
            active: item.active || 0,
            gained: item.gained || 0,
            lost: item.lost || 0,
            quote_created: item.quote_created || 0,
            // Enable Send Email column at salesperson level with email metadata
            send_email: "send_email",
            salesperson_email: item.salesperson_email || "",
            cc_mail: item.cc_mail || [],
            total_enquiries: totalEnquiries,
            // active_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.active / totalEnquiries) * 100)}%`
            //     : "0%",
            // gain_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.gained / totalEnquiries) * 100)}%`
            //     : "0%",
            // loss_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.lost / totalEnquiries) * 100)}%`
            //     : "0%",

            // quoted_percentage:
            //   totalEnquiries > 0
            //     ? `${Math.round((item.quote_created / totalEnquiries) * 100)}%`
            //     : "0%",
          });
        } else if (item.Enquiry_data && Array.isArray(item.Enquiry_data)) {
          item.Enquiry_data.forEach((enquiryItem: any) => {
            const totalEnquiryCount = extractNumericValue(
              enquiryItem.total_enquiry_count
            );
            // const totalGain = extractNumericValue(enquiryItem.total_gain);
            // const totalLost = extractNumericValue(enquiryItem.total_lost);
            // const active = extractNumericValue(enquiryItem.total_active);
            // const quoteCreated = extractNumericValue(enquiryItem.total_quote_created);
            tableData.push({
              company_name: enquiryItem.company_name || "-",
              location: item.Location || item.location || "-",
              total_enquiries: totalEnquiryCount,
              total_gain: enquiryItem.total_gain || 0,
              total_lost: enquiryItem.total_lost || 0,
              active: enquiryItem.total_active || 0,
              quote_created: enquiryItem.total_quote_created || 0,
              // active_percentage:
              //   totalEnquiryCount > 0
              //     ? `${Math.round(
              //         (enquiryItem.total_active / totalEnquiryCount) * 100
              //       )}%`
              //     : "0%",
              // gain_percentage:
              //   totalEnquiryCount > 0
              //     ? `${Math.round(
              //         (enquiryItem.total_gain / totalEnquiryCount) * 100
              //       )}%`
              //     : "0%",
              // loss_percentage:
              //   totalEnquiryCount > 0
              //     ? `${Math.round(
              //         (enquiryItem.total_lost / totalEnquiryCount) * 100
              //       )}%`
              //     : "0%",

              // quoted_percentage:
              //   totalEnquiryCount > 0
              //     ? `${Math.round(
              //         (enquiryItem.total_quote_created / totalEnquiryCount) *
              //           100
              //       )}%`
              //     : "0%",
            });
          });
        }
      });
    }

    // Sort by total_enquiries in descending order for enquiry conversion
    tableData.sort((a, b) => {
      const aTotal = a.total_enquiries || 0;
      const bTotal = b.total_enquiries || 0;
      return bTotal - aTotal; // Descending order
    });

    return tableData;
  };

  // Convert call entry data to table format
  const convertCallEntryDataToTableData = (callEntries: any[]) => {
    const today = dayjs();

    return callEntries.map((entry: any) => {
      const followupDate = dayjs(entry.followup_date);
      const overdueDays = today.diff(followupDate, "day");

      return {
        salesperson: entry.created_by_name || "-",
        customer_code: entry.customer_code || "-",
        customer_name: entry.customer_name || "-",
        call_date: entry.call_date
          ? dayjs(entry.call_date).format("DD-MM-YYYY")
          : "-",
        call_mode: entry.call_mode_name || "-",
        followup_date: entry.followup_date
          ? dayjs(entry.followup_date).format("DD-MM-YYYY")
          : "-",
        overdue_days: overdueDays > 0 ? overdueDays : 0,
        followup_action: entry.followup_action_name || "-",
        call_summary: entry.call_summary || "-",
      };
    });
  };

  // Helper function to add search to detailed view filters
  const addSearchToDetailedViewFilters = useCallback(
    <T extends DashboardFilters>(filters: T): T => {
      // Use detailedViewSearch first, fallback to globalSearch if not set
      const searchValue = detailedViewSearch?.trim() || globalSearch?.trim();
      if (searchValue) {
        return { ...filters, search: searchValue };
      }
      return filters;
    },
    [detailedViewSearch, globalSearch]
  );

  // Handler for search change in DetailedViewTable - immediately triggers API call
  const handleDetailedViewSearchChange = useCallback(
    async (search: string) => {
      setDetailedViewSearch(search);
      setIsLoadingDetailedView(true);
      try {
        let filterData: DashboardFilters = {};

        if (detailedViewType === "outstanding") {
          if (detailedViewDrillLevel === 3) {
            filterData = {
              company: detailedViewSelectedCompany || "",
              location: detailedViewSelectedLocation || "",
              salesman: detailedViewSelectedSalesperson || "",
              ...(search.trim() && { search: search.trim() }),
            };
          } else if (detailedViewDrillLevel === 2) {
            filterData = {
              company: detailedViewSelectedCompany || "",
              location: detailedViewSelectedLocation || "",
              ...(search.trim() && { search: search.trim() }),
            };
          } else if (detailedViewDrillLevel === 1) {
            filterData = {
              company: detailedViewSelectedCompany || "",
              ...(search.trim() && { search: search.trim() }),
            };
          } else {
            filterData = {
              ...(search.trim() && { search: search.trim() }),
            };
          }
          const response = await getFilteredOutstandingData(filterData);
          const tableData = convertFilteredResponseToTableData(
            response,
            detailedViewDrillLevel > 0
          );
          setDetailedViewData(tableData);
        } else if (detailedViewType === "budget") {
          if (detailedViewDrillLevel === 2) {
            filterData = {
              company: detailedViewSelectedCompany || "",
              salesman: detailedViewSelectedSalesperson || "",
              ...(budgetStartMonth && { start_month: budgetStartMonth }),
              ...(budgetEndMonth && { end_month: budgetEndMonth }),
              type: budgetType,
              ...(search.trim() && { search: search.trim() }),
            };
          } else if (detailedViewDrillLevel === 1) {
            filterData = {
              company: detailedViewSelectedCompany || "",
              ...(budgetStartMonth && { start_month: budgetStartMonth }),
              ...(budgetEndMonth && { end_month: budgetEndMonth }),
              type: budgetType,
              ...(search.trim() && { search: search.trim() }),
            };
          } else {
            filterData = {
              ...(budgetStartMonth && { start_month: budgetStartMonth }),
              ...(budgetEndMonth && { end_month: budgetEndMonth }),
              type: budgetType,
              ...(search.trim() && { search: search.trim() }),
            };
          }
          const response = await getFilteredBudgetData(filterData as any);
          const tableData = convertBudgetResponseToTableData(
            response,
            detailedViewDrillLevel,
            budgetType
          );
          setDetailedViewData(tableData);
        } else if (detailedViewType === "enquiry") {
          const dateRange = calculateCallEntryDateRange(enquiryPeriod);
          if (detailedViewDrillLevel === 2) {
            filterData = {
              company: detailedViewSelectedCompany || "",
              salesman: detailedViewSelectedSalesperson || "",
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(search.trim() && { search: search.trim() }),
            };
          } else if (detailedViewDrillLevel === 1) {
            filterData = {
              company: detailedViewSelectedCompany || "",
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(search.trim() && { search: search.trim() }),
            };
          } else {
            filterData = {
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(search.trim() && { search: search.trim() }),
            };
          }
          const response = await getFilteredEnquiryConversionData(filterData);
          let tableData = convertEnquiryResponseToTableData(response);

          // Only filter client-side if there's no search parameter
          // When search is present, the API should return filtered results
          const hasSearch = filterData.search && filterData.search.trim();

          if (!hasSearch) {
            // Apply current filter type if any
            if (enquiryFilterType === "gain") {
              tableData = tableData.filter(
                (item: any) => (item.gained || item.total_gain || 0) > 0
              );
            } else if (enquiryFilterType === "lost") {
              tableData = tableData.filter(
                (item: any) => (item.lost || item.total_lost || 0) > 0
              );
            } else if (enquiryFilterType === "active") {
              tableData = tableData.filter(
                (item: any) => (item.active || item.total_active || 0) > 0
              );
            } else if (enquiryFilterType === "quote") {
              tableData = tableData.filter(
                (item: any) =>
                  (item.quote_created || item.total_quote_created || 0) > 0
              );
            }
          }
          setDetailedViewData(tableData);
        } else if (detailedViewType === "customerNotVisited") {
          const customerNotVisitedFilter: any = {
            period: customerNotVisitedPeriod,
            index: 0,
            limit: 10,
            ...(search.trim() && { search: search.trim() }),
          };
          if (detailedViewDrillLevel === 2) {
            customerNotVisitedFilter.company =
              detailedViewSelectedCompany || "";
            customerNotVisitedFilter.salesperson =
              detailedViewSelectedSalesperson || "";
          } else if (detailedViewDrillLevel === 1) {
            customerNotVisitedFilter.company =
              detailedViewSelectedCompany || "";
          }
          const response = await getCustomerNotVisitedData(
            customerNotVisitedFilter
          );
          const tableData = convertCustomerNotVisitedToTableData(
            response,
            detailedViewDrillLevel
          );
          setDetailedViewData(tableData);
        } else if (detailedViewType === "lostCustomer") {
          const response = await getLostCustomerData({
            company:
              user?.company?.company_name ||
              selectedCompany ||
              "PENTAGON INDIA",
            period: lostCustomerPeriod,
            ...(search.trim() && { search: search.trim() }),
          });
          const tableData = convertLostCustomerToTableData(
            response,
            detailedViewDrillLevel,
            detailedViewSelectedSalesperson || undefined
          );
          setDetailedViewData(tableData);
        } else if (detailedViewType === "newCustomer") {
          const newCustomerFilter: any = {
            company: user?.company?.company_name || "PENTAGON Dubai",
            period: newCustomerPeriod,
            ...(search.trim() && { search: search.trim() }),
          };
          if (detailedViewDrillLevel === 1) {
            newCustomerFilter.salesperson =
              detailedViewSelectedSalesperson || "";
          }
          const response = await getNewCustomerData(newCustomerFilter);
          const tableData = convertNewCustomerToTableData(
            response,
            detailedViewDrillLevel
          );
          setDetailedViewData(tableData);
        } else if (detailedViewType === "callentry") {
          // Call Entry search handling
          const dateRange = calculateCallEntryDateRange(callEntryPeriod);
          const companyName =
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

          if (callEntryDrillLevel === 0) {
            // Drill Level 0: Salesperson list
            const response = await getCallEntryStatistics({
              company: companyName,
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(callEntryFilterType !== "all" && {
                type: callEntryFilterType,
              }),
              ...(search.trim() && { search: search.trim() }),
            });
            const tableData = (response.data as CallEntrySalespersonData[]).map(
              (item) => ({
                SALESPERSON: item.salesperson,
                OVERDUE: item.total_overdue,
                TODAY: item.total_today,
                UPCOMING: item.total_upcoming,
                CLOSED: item.total_closed,
                TOTAL_CALLS: item.total_calls,
                // Enable Send Email action at salesperson level
                send_email: "send_email",
                salesperson_email: item.salesperson_email || "",
                cc_mail: item.cc_mail || [],
              })
            );
            setDetailedViewData(tableData);
          } else if (
            callEntryDrillLevel === 1 &&
            callEntrySelectedSalesperson
          ) {
            // Drill Level 1: Customer list
            const response = await getCallEntryStatistics({
              company: companyName,
              salesperson: callEntrySelectedSalesperson,
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(callEntryFilterType !== "all" && {
                type: callEntryFilterType,
              }),
              ...(search.trim() && { search: search.trim() }),
            });
            const statsResponse = response as CallEntryStatisticsResponse;
            const salespersonEmail = statsResponse.salesperson_email || "";
            const ccMail = statsResponse.cc_mail || [];

            const tableData = (response.data as CallEntryCustomerData[]).map(
              (item) => ({
                CUSTOMER_CODE: item.customer_code,
                CUSTOMER_NAME: item.customer_name,
                OVERDUE: item.total_overdue,
                TODAY: item.total_today,
                UPCOMING: item.total_upcoming,
                CLOSED: item.total_closed,
                TOTAL_CALLS: item.total_calls,
                // Enable Send Email action at customer level (same salesperson email)
                send_email: "send_email",
                salesperson_email: salespersonEmail,
                cc_mail: ccMail,
              })
            );
            setDetailedViewData(tableData);
          } else if (
            callEntryDrillLevel === 2 &&
            callEntrySelectedSalesperson &&
            callEntrySelectedCustomer
          ) {
            // Drill Level 2: Call entry details
            const response = await getCallEntryStatistics({
              company: companyName,
              salesperson: callEntrySelectedSalesperson,
              customer_code: callEntrySelectedCustomer.code,
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(callEntryFilterType !== "all" && {
                type: callEntryFilterType,
              }),
              ...(search.trim() && { search: search.trim() }),
            });
            const tableData = (response.data as CallEntryDetailData[]).map(
              (item) => ({
                CALL_ENTRY_ID: item.call_entry_id,
                CALL_DATE: item.call_date,
                CALL_MODE: item.call_mode_name,
                FOLLOWUP_ACTION: item.followup_action_name,
                CALL_SUMMARY: item.call_summary,
                FOLLOWUP_DATE: item.followup_date,
                EXPECTED_PROFIT: item.expected_profit,
                CREATED_BY: item.created_by_name,
              })
            );
            setDetailedViewData(tableData);
          }
        }
      } catch (error) {
        console.error("Error updating search:", error);
        toast.error("Failed to update search results");
      } finally {
        setIsLoadingDetailedView(false);
      }
    },
    [
      detailedViewType,
      detailedViewDrillLevel,
      detailedViewSelectedCompany,
      detailedViewSelectedLocation,
      detailedViewSelectedSalesperson,
      budgetStartMonth,
      budgetEndMonth,
      budgetType,
      enquiryPeriod,
      enquiryFilterType,
      customerNotVisitedPeriod,
      lostCustomerPeriod,
      newCustomerPeriod,
      callEntryDrillLevel,
      callEntrySelectedSalesperson,
      callEntrySelectedCustomer,
      callEntryFilterType,
      callEntryPeriod,
      user?.company?.company_name,
      selectedCompany,
    ]
  );

  const handleCloseDetailedView = () => {
    setShowDetailedView(false);
    setDetailedViewData([]);
    setDetailedViewTitle("");
    setBudgetSelectedMonth(null);
    setDetailedViewType(null);
    setDetailedViewSearch(""); // Reset search

    // Reset detailed view drill level state
    setDetailedViewDrillLevel(0);
    setDetailedViewSelectedCompany(null);
    setDetailedViewSelectedLocation(null);
    setDetailedViewSelectedSalesperson(null);

    setSearchSalesman("");

    const callEntryFilterData: DashboardFilters = {
      ...(selectedDate && {
        date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
        date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
      }),
    };
    const filteredCallEntryData =
      Object.keys(callEntryFilterData).length > 0
        ? filterCallEntryData(callEntryData, callEntryFilterData)
        : callEntryData;
    const aggregatedCallEntry = calculateCallEntryAggregatedData(
      filteredCallEntryData
    );
    setCallEntryAggregatedData(aggregatedCallEntry);
  };

  // Helper function to parse emails from comma or semicolon separated string
  const parseEmails = (emailString: string): string[] => {
    if (!emailString || !emailString.trim()) return [];

    // Remove any non-printable characters and normalize whitespace
    const cleanedString = emailString
      .replace(/[\r\n\t]/g, " ") // Replace newlines and tabs with space
      .replace(/\s+/g, " ") // Normalize multiple spaces to single space
      .trim();

    // Split by comma or semicolon and clean up each email
    const emails = cleanedString
      .split(/[,;]+/) // Split by one or more commas or semicolons
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    return emails;
  };

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    if (!email || !email.trim()) return false;

    const trimmedEmail = email.trim();

    // More permissive email regex that handles common valid formats
    // Allows: letters, numbers, dots, hyphens, underscores, plus signs
    const emailRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9._+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/;

    // Additional checks for common invalid patterns
    if (trimmedEmail.includes("..")) return false; // No consecutive dots
    if (trimmedEmail.startsWith(".") || trimmedEmail.endsWith("."))
      return false; // No leading/trailing dots
    if (trimmedEmail.includes("@.") || trimmedEmail.includes(".@"))
      return false; // No dot immediately before/after @

    return emailRegex.test(trimmedEmail);
  };

  // Helper function to clean email string - removes non-printable chars and normalizes
  const cleanEmailString = (emailStr: string | null | undefined): string => {
    if (!emailStr) return "";

    // Convert to string and remove non-printable characters
    const cleaned = String(emailStr)
      .replace(/[\r\n\t]/g, " ") // Replace newlines and tabs with space
      .replace(/\s+/g, " ") // Normalize multiple spaces to single space
      .replace(/[^\x20-\x7E]/g, "") // Remove non-printable ASCII characters
      .trim();

    return cleaned;
  };

  // Handle send email click from detailed view table
  const handleSendEmailClick = (rowData: any) => {
    if (!rowData) return;

    // Build subject & default message based on current detailed view type
    let subject = "Outstanding/Overdue Details";
    let defaultMessage =
      "Please find the details of outstanding/overdue amounts.";

    if (detailedViewType === "enquiry") {
      // Match Pulse Enquiry Conversion behaviour: generic subject, optional message
      subject = "Enquiry Conversion";
      defaultMessage = "";
    } else if (detailedViewType === "callentry") {
      // Match Pulse Call Entry behaviour: period-based statistics emails
      if (callEntryDrillLevel === 0 || detailedViewDrillLevel === 0) {
        subject = "Call Entry Statistics - Salesperson Wise";
      } else if (callEntryDrillLevel === 1 || detailedViewDrillLevel === 1) {
        subject = "Call Entry Statistics - Customer Wise Report";
      } else {
        subject = "Call Entry Statistics - Detailed View";
      }
      // Message is optional for call entry statistics
      defaultMessage = "";
    } else if (detailedViewType === "budget") {
      // Budget vs Actual - Salesperson Wise behaviour (similar to Pulse budget email)
      const salespersonName =
        rowData.salesperson ||
        rowData.salesman_name ||
        detailedViewSelectedSalesperson ||
        "";
      const companyName =
        rowData.company_name ||
        detailedViewSelectedCompany ||
        user?.company?.company_name ||
        "";

      if (salespersonName && companyName) {
        subject = `Budget vs Actual - ${salespersonName} (${companyName})`;
      } else if (salespersonName) {
        subject = `Budget vs Actual - ${salespersonName}`;
      } else {
        subject = "Budget vs Actual - Salesperson Wise";
      }

      // Message is optional for budget emails
      defaultMessage = "";
    } else {
      if (rowData.customer_name) {
        subject = `Outstanding Details - ${rowData.customer_name}`;
      } else if (rowData.salesman_name) {
        subject = `Outstanding Details - ${rowData.salesman_name}`;
      } else if (rowData.location) {
        subject = `Outstanding Details - ${rowData.location}`;
      }
    }

    // Clean and normalize email addresses before setting
    const cleanedToEmail = cleanEmailString(rowData.salesperson_email);
    const cleanedCcEmail = cleanEmailString(rowData.cc_mail);

    console.log("Raw email data:", {
      salesperson_email: rowData.salesperson_email,
      cc_mail: rowData.cc_mail,
      cleanedToEmail,
      cleanedCcEmail,
    });

    setCurrentEmailData(rowData);
    setEmailForm({
      to_email: cleanedToEmail,
      cc_email: cleanedCcEmail,
      subject: subject,
      message: defaultMessage,
    });

    // Reset any previous errors
    setEmailErrors({ to_email: "", cc_email: "" });

    openSendEmail();
  };

  // Handle send email from modal
  const handleSendEmail = async () => {
    if (!currentEmailData) {
      toast.error("No data available to send email");
      return;
    }

    // Subject is mandatory (align with Pulse SendEmailModal)
    if (!emailForm.subject.trim()) {
      toast.error("Please enter an email subject");
      return;
    }

    // Validate and parse to_email
    const toEmailString = emailForm.to_email.trim();

    console.log("🔍 Email validation - Raw to_email:", {
      raw: emailForm.to_email,
      trimmed: toEmailString,
      length: toEmailString.length,
      charCodes: toEmailString.split("").map((c) => c.charCodeAt(0)),
    });

    if (!toEmailString) {
      setEmailErrors({
        ...emailErrors,
        to_email: "Please enter recipient email address(es)",
      });
      toast.error("Please enter recipient email address(es)");
      return;
    }

    const toEmailArray = parseEmails(toEmailString);

    console.log("📧 Parsed to_email array:", {
      array: toEmailArray,
      count: toEmailArray.length,
    });

    if (toEmailArray.length === 0) {
      setEmailErrors({
        ...emailErrors,
        to_email: "Please enter valid email address(es)",
      });
      toast.error(
        "Please enter valid email address(es) separated by comma or semicolon"
      );
      return;
    }

    // Validate each to_email with detailed logging
    const invalidToEmails = toEmailArray.filter((email) => {
      const isValid = isValidEmail(email);
      console.log(
        `✉️ Validating email: "${email}" -> ${isValid ? "✅ VALID" : "❌ INVALID"}`
      );
      return !isValid;
    });

    if (invalidToEmails.length > 0) {
      console.error("❌ Invalid emails found:", invalidToEmails);
      setEmailErrors({
        ...emailErrors,
        to_email: `Invalid email address(es): ${invalidToEmails.join(", ")}`,
      });
      toast.error(`Invalid email address(es): ${invalidToEmails.join(", ")}`);
      return;
    }

    console.log("✅ All emails validated successfully:", toEmailArray);

    // Validate and parse cc_email (optional)
    let ccEmailArray: string[] = [];
    const ccEmailString = emailForm.cc_email.trim();

    console.log("🔍 CC Email validation - Raw cc_email:", {
      raw: emailForm.cc_email,
      trimmed: ccEmailString,
      length: ccEmailString.length,
    });

    if (ccEmailString) {
      ccEmailArray = parseEmails(ccEmailString);

      console.log("📧 Parsed cc_email array:", {
        array: ccEmailArray,
        count: ccEmailArray.length,
      });

      if (ccEmailArray.length > 0) {
        const invalidCcEmails = ccEmailArray.filter((email) => {
          const isValid = isValidEmail(email);
          console.log(
            `✉️ Validating CC email: "${email}" -> ${isValid ? "✅ VALID" : "❌ INVALID"}`
          );
          return !isValid;
        });

        if (invalidCcEmails.length > 0) {
          console.error("❌ Invalid CC emails found:", invalidCcEmails);
          setEmailErrors({
            ...emailErrors,
            cc_email: `Invalid email address(es): ${invalidCcEmails.join(", ")}`,
          });
          toast.error(
            `Invalid CC email address(es): ${invalidCcEmails.join(", ")}`
          );
          return;
        }
      }
    }

    console.log("✅ All CC emails validated successfully:", ccEmailArray);

    // Clear errors if validation passes
    setEmailErrors({ to_email: "", cc_email: "" });

    // Build email payload matching Pulse SendEmailModal behaviour
    setSendingEmail(true);
    try {
      // Build base payload (common to all email types)
      const emailPayload: any = {
        // Backend expects comma-separated string (as in Pulse)
        to_email: toEmailArray.join(", "),
        subject: emailForm.subject.trim(),
        // For enquiry conversion and budget, message is optional (Pulse behaviour).
        // For outstanding, fall back to default message when empty.
        message:
          detailedViewType === "enquiry" || detailedViewType === "budget"
            ? emailForm.message.trim() || ""
            : detailedViewType === "callentry"
              ? emailForm.message.trim() // Call entry message is optional; no forced default here
              : emailForm.message.trim() ||
                "Please find the details of outstanding/overdue amounts.",
      };

      // CC as comma-separated string if provided
      if (ccEmailArray.length > 0) {
        emailPayload.cc_email = ccEmailArray.join(", ");
      } else {
        emailPayload.cc_email = "";
      }

      if (detailedViewType === "enquiry") {
        // Enquiry Conversion: Use enquiry_statistics-style payload like Pulse
        const salespersonName =
          currentEmailData.salesperson || detailedViewSelectedSalesperson || "";

        emailPayload.data_table = {
          salesperson: salespersonName || "",
          active: currentEmailData.active ?? currentEmailData.total_active ?? 0,
          gained: currentEmailData.gained ?? currentEmailData.total_gain ?? 0,
          lost: currentEmailData.lost ?? currentEmailData.total_lost ?? 0,
          quote_created:
            currentEmailData.quote_created ??
            currentEmailData.total_quote_created ??
            0,
        };
      } else if (detailedViewType === "callentry") {
        // Call Entry Statistics: align with Pulse 'call_entry_statistics' & 'call_entry_statistics_customer'
        const statsMeta = callEntryStatisticsData;
        const companyName =
          statsMeta?.company_name || user?.company?.company_name || "";
        const companyCode = statsMeta?.company_code || "";
        const defaultType =
          statsMeta?.type ||
          (callEntryFilterType && callEntryFilterType !== "all"
            ? callEntryFilterType
            : "all");
        const dateFrom = statsMeta?.date_from || "";
        const dateTo = statsMeta?.date_to || "";
        const reportDate = statsMeta?.date || "";

        if (callEntryDrillLevel === 0 || detailedViewDrillLevel === 0) {
          // Salesperson-wise statistics (call_entry_statistics)
          const salespersonName =
            currentEmailData.SALESPERSON ||
            currentEmailData.salesperson ||
            statsMeta?.salesperson ||
            "";

          const totalOverdue =
            currentEmailData.total_overdue ?? currentEmailData.OVERDUE ?? 0;
          const totalToday =
            currentEmailData.total_today ?? currentEmailData.TODAY ?? 0;
          const totalUpcoming =
            currentEmailData.total_upcoming ?? currentEmailData.UPCOMING ?? 0;
          const totalClosed =
            currentEmailData.total_closed ?? currentEmailData.CLOSED ?? 0;
          const totalCalls =
            currentEmailData.total_calls ?? currentEmailData.TOTAL_CALLS ?? 0;

          const rawCc = currentEmailData.cc_mail;
          const ccList = Array.isArray(rawCc) ? rawCc : rawCc ? [rawCc] : [];

          emailPayload.data_table = {
            company_code: companyCode,
            company_name: companyName,
            date: reportDate,
            date_from: dateFrom,
            date_to: dateTo,
            type: defaultType,
            data: [
              {
                salesperson: salespersonName,
                total_overdue: totalOverdue,
                total_today: totalToday,
                total_upcoming: totalUpcoming,
                total_closed: totalClosed,
                total_calls: totalCalls,
                salesperson_email: currentEmailData.salesperson_email || "",
                cc_mail: ccList,
              },
            ],
          };
        } else if (callEntryDrillLevel === 1 || detailedViewDrillLevel === 1) {
          // Customer-wise statistics (call_entry_statistics_customer)
          const summary: any = callEntrySummary || {};
          const salespersonName =
            callEntrySelectedSalesperson || statsMeta?.salesperson || "";

          const summaryCcMail = summary?.cc_mail || [];
          const summarySalesManagerEmail = summary?.sales_manager_email;
          const summaryManagerEmail = summary?.manager_email;

          const collectedCc = [
            summaryCcMail,
            summarySalesManagerEmail,
            summaryManagerEmail,
            currentEmailData.cc_mail,
            currentEmailData.sales_manager_email,
          ]
            .flat()
            .filter(Boolean);
          const uniqueCc = Array.from(new Set(collectedCc));

          const totalCustomers =
            statsMeta?.total_customers ?? summary?.total_customers ?? 0;

          const salespersonEmail =
            statsMeta?.salesperson_email ||
            summary?.salesperson_email ||
            currentEmailData.salesperson_email ||
            "";

          emailPayload.data_table = {
            company_code: companyCode,
            company_name: companyName,
            salesperson: salespersonName,
            date_from: dateFrom,
            date_to: dateTo,
            type: defaultType,
            total_customers: totalCustomers,
            salesperson_email: salespersonEmail,
            cc_mail: uniqueCc,
            data: [
              {
                customer_code:
                  currentEmailData.CUSTOMER_CODE ||
                  currentEmailData.customer_code ||
                  "",
                customer_name:
                  currentEmailData.CUSTOMER_NAME ||
                  currentEmailData.customer_name ||
                  "",
                total_calls:
                  currentEmailData.total_calls ??
                  currentEmailData.TOTAL_CALLS ??
                  0,
                total_overdue:
                  currentEmailData.total_overdue ??
                  currentEmailData.OVERDUE ??
                  0,
                total_today:
                  currentEmailData.total_today ?? currentEmailData.TODAY ?? 0,
                total_upcoming:
                  currentEmailData.total_upcoming ??
                  currentEmailData.UPCOMING ??
                  0,
                total_closed:
                  currentEmailData.total_closed ?? currentEmailData.CLOSED ?? 0,
              },
            ],
            summary: {
              total_customers:
                summary?.total_customers ??
                statsMeta?.total_customers ??
                totalCustomers,
              total_overdue: summary?.total_overdue ?? 0,
              total_today: summary?.total_today ?? 0,
              total_upcoming: summary?.total_upcoming ?? 0,
              total_closed: summary?.total_closed ?? 0,
              total_calls: summary?.total_calls ?? 0,
            },
          };
        }

        // For call entry, ensure we always have a polite default message if still empty
        if (!emailPayload.message) {
          emailPayload.message =
            "Please find the call entry statistics report.";
        }
      } else if (detailedViewType === "budget") {
        // Budget vs Actual - Salesperson Wise: align with Pulse 'budget' email_type payload
        const companyName =
          currentEmailData.company_name ||
          detailedViewSelectedCompany ||
          user?.company?.company_name ||
          "";

        // Prefer date_range from API if available; otherwise derive from selected months
        let dateRange = currentEmailData.date_range || "";
        if (!dateRange && budgetStartMonth && budgetEndMonth) {
          const startLabel = dayjs(budgetStartMonth + "-01").format("MMM YYYY");
          const endLabel = dayjs(budgetEndMonth + "-01").format("MMM YYYY");
          dateRange = `${startLabel} - ${endLabel}`;
        }

        const budgetRow: any = {
          salesperson:
            currentEmailData.salesperson ||
            currentEmailData.salesman_name ||
            "",
          month: currentEmailData.month || undefined,
          actual_budget: currentEmailData.actual_budget || 0,
          sales_budget: currentEmailData.sales_budget || 0,
        };

        emailPayload.data_table = {
          company_name: companyName,
          date_range: dateRange,
          currency: "",
          budget: [budgetRow],
        };
      } else {
        // Outstanding: build outstanding data_table similar to Pulse default outstanding format
        const outstandingItem: any = {};

        // Customer-level fields (if present)
        if (currentEmailData.customer_code) {
          outstandingItem.customer_code = currentEmailData.customer_code || "";
          outstandingItem.customer_name = currentEmailData.customer_name || "";
        }

        // Salesman fields: prefer explicit salesman fields; fall back to selected salesperson
        const salesmanName =
          currentEmailData.salesman_name ||
          detailedViewSelectedSalesperson ||
          "";
        if (currentEmailData.salesman_code || salesmanName) {
          if (currentEmailData.salesman_code) {
            outstandingItem.salesman_code =
              currentEmailData.salesman_code || "";
          }
          outstandingItem.salesman_name = salesmanName;
        }

        // Common fields
        const locationValue =
          currentEmailData.location || detailedViewSelectedLocation || "";
        outstandingItem.location = locationValue || "";

        // Amounts – map local_outstanding/outstanding and overdue
        const localOutstanding =
          currentEmailData.local_outstanding ??
          currentEmailData.outstanding ??
          0;
        outstandingItem.local_outstanding = String(localOutstanding);
        outstandingItem.overdue = String(currentEmailData.overdue ?? 0);

        // Days breakdown if available on the row
        const dayKeys = [
          "days_0_15",
          "days_16_30",
          "days_31_45",
          "days_46_60",
          "days_61_90",
          "days_91_120",
          "days_121_180",
          "days_181_365",
          "days_366_730",
          "days_730",
        ];
        let hasDayBuckets = false;
        dayKeys.forEach((key) => {
          if (currentEmailData[key] !== undefined) {
            hasDayBuckets = true;
            outstandingItem[key] = String(currentEmailData[key] ?? "0");
          }
        });

        // Only include days_* when at least one exists (matches Pulse behaviour)
        if (!hasDayBuckets) {
          dayKeys.forEach((key) => {
            if (outstandingItem[key] !== undefined) {
              delete outstandingItem[key];
            }
          });
        }

        emailPayload.data_table = {
          company: user?.company?.company_name || "",
          location: locationValue || "",
          outstanding_data: [outstandingItem],
        };
      }

      console.log("📤 Sending email with payload:", {
        to_email: emailPayload.to_email,
        cc_email: emailPayload.cc_email,
        subject: emailPayload.subject,
        messageLength: emailPayload.message.length,
        dataTable: emailPayload.data_table,
      });

      // Send email via accounts/send-email/ (same as Pulse)
      const response = await apiCallProtected.post(
        URL.accountsSendEmail,
        emailPayload
      );

      console.log("✅ Email sent successfully:", response);

      const successMessage =
        (response as any)?.data?.message || "Email sent successfully";
      toast.success(successMessage);

      closeSendEmail();
      setEmailErrors({ to_email: "", cc_email: "" });
      setCurrentEmailData(null);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to send email"
      );
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle column clicks in detailed view table with module-specific rules
  const handleDetailedViewColumnClick = async (
    columnType:
      | "company"
      | "location"
      | "salesperson"
      | "customer"
      | "gained"
      | "lost"
      | "active"
      | "quote"
      | "potential"
      | "pipeline"
      | "quoted_created"
      | "expected"
      | "quotation_id"
      | "call_entry_id"
      | "overdue"
      | "today"
      | "upcoming"
      | "closed"
      | "region"
      | "service"
      | "services"
      | "service_type"
      | "send_email",
    value: string,
    additionalData?: any
  ) => {
    try {
      // Show loader immediately
      setIsLoadingDetailedView(true);

      // Module-specific validation and filter building
      let filterData: DashboardFilters = {};

      if (detailedViewType === "outstanding") {
        // Handle send email action
        if (columnType === "send_email") {
          handleSendEmailClick(additionalData);
          setIsLoadingDetailedView(false);
          return;
        }

        // Outstanding: Company → Location → Salesperson (mandatory hierarchy)
        if (columnType === "company") {
          filterData = addSearchToDetailedViewFilters({ company: value });
          setDetailedViewSelectedCompany(value);
          setDetailedViewSelectedLocation(null);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(1);
        } else if (columnType === "location") {
          // Location requires company - use previously selected company
          const company =
            detailedViewSelectedCompany ||
            additionalData?.company_name ||
            additionalData?.company;
          if (!company) {
            toast.error("Company is required to filter by location");
            return;
          }
          filterData = addSearchToDetailedViewFilters({
            company,
            location: value,
          });
          setDetailedViewSelectedLocation(value);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(2);
        } else if (columnType === "salesperson") {
          // Salesperson requires both company and location - use previously selected values
          const company =
            detailedViewSelectedCompany ||
            additionalData?.company_name ||
            additionalData?.company;
          const location =
            detailedViewSelectedLocation ||
            additionalData?.location ||
            additionalData?.Location;
          if (!company || !location) {
            toast.error(
              "Company and location are required to filter by salesperson"
            );
            return;
          }
          filterData = addSearchToDetailedViewFilters({
            company,
            location,
            salesman: value,
          });
          setDetailedViewSelectedSalesperson(value);
          setDetailedViewDrillLevel(3);
        }
        const response = await getFilteredOutstandingData(filterData);
        console.log("response columns :", response);
        const tableData = convertFilteredResponseToTableData(response, true);
        console.log("tableData coulmns  :", tableData);
        setDetailedViewData(tableData);
      } else if (detailedViewType === "budget") {
        // Budget: Company → Salesperson (mandatory hierarchy)
        // Also support Send Email action at salesperson level
        if (columnType === "send_email") {
          handleSendEmailClick(additionalData);
          setIsLoadingDetailedView(false);
          return;
        }

        if (columnType === "company") {
          filterData = addSearchToDetailedViewFilters({
            company: value,
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          });
          setDetailedViewSelectedCompany(value);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(1);
          // Update title for salesperson wise view
          setDetailedViewTitle("Budget vs Actual - Salesperson Wise");
        } else if (columnType === "salesperson") {
          // Salesperson requires company - use previously selected company
          const company =
            detailedViewSelectedCompany ||
            additionalData?.company_name ||
            additionalData?.company;
          if (!company) {
            toast.error("Company is required to filter by salesperson");
            setIsLoadingDetailedView(false);
            return;
          }
          filterData = addSearchToDetailedViewFilters({
            company,
            salesman: value,
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          });
          setDetailedViewSelectedSalesperson(value);
          setDetailedViewDrillLevel(2);
          // Update title for salesperson month wise view
          setDetailedViewTitle(`Budget vs Actual - ${value} - Month Wise`);
        }

        const response = await getFilteredBudgetData(filterData as any);
        // Use the correct drill level based on column type
        const currentDrillLevel = columnType === "company" ? 1 : 2;
        const tableData = convertBudgetResponseToTableData(
          response,
          currentDrillLevel,
          budgetType
        );
        setDetailedViewData(tableData);
      } else if (detailedViewType === "enquiry") {
        // Handle send email action for enquiry conversion
        if (columnType === "send_email") {
          handleSendEmailClick(additionalData);
          setIsLoadingDetailedView(false);
          return;
        }

        // Calculate date range from selected period
        const dateRange = calculateCallEntryDateRange(enquiryPeriod);

        // Enquiry: Company → Salesperson (mandatory hierarchy)
        if (columnType === "company") {
          filterData = addSearchToDetailedViewFilters({
            company: value,
            date_from: dateRange.date_from,
            date_to: dateRange.date_to,
          });
          setDetailedViewSelectedCompany(value);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(1);

          // Fetch company-level data
          const response = await getFilteredEnquiryConversionData(filterData);
          let tableData = convertEnquiryResponseToTableData(response);

          // Only filter client-side if there's no search parameter
          const hasSearch = filterData.search && filterData.search.trim();

          if (!hasSearch) {
            // Apply current filter type if any
            if (enquiryFilterType === "gain") {
              tableData = tableData.filter(
                (item: any) => (item.gained || item.total_gain || 0) > 0
              );
            } else if (enquiryFilterType === "lost") {
              tableData = tableData.filter(
                (item: any) => (item.lost || item.total_lost || 0) > 0
              );
            } else if (enquiryFilterType === "active") {
              tableData = tableData.filter(
                (item: any) => (item.active || item.total_active || 0) > 0
              );
            } else if (enquiryFilterType === "quote") {
              tableData = tableData.filter(
                (item: any) =>
                  (item.quote_created || item.total_quote_created || 0) > 0
              );
            }
          }

          setDetailedViewData(tableData);
        } else if (columnType === "salesperson") {
          // Salesperson requires company - use previously selected company
          const company =
            detailedViewSelectedCompany ||
            additionalData?.company_name ||
            additionalData?.company;
          if (!company) {
            toast.error("Company is required to filter by salesperson");
            setIsLoadingDetailedView(false);
            return;
          }
          filterData = addSearchToDetailedViewFilters({
            company,
            salesman: value,
            date_from: dateRange.date_from,
            date_to: dateRange.date_to,
          });

          // Update title based on current filter type when clicking salesperson
          let titleForSalesperson = "Enquiry Conversion - Detailed View";
          if (enquiryFilterType === "gain") {
            titleForSalesperson = "Enquiry Conversion - Gain Only";
          } else if (enquiryFilterType === "lost") {
            titleForSalesperson = "Enquiry Conversion - Lost Only";
          } else if (enquiryFilterType === "active") {
            titleForSalesperson = "Enquiry Conversion - Active Only";
          } else if (enquiryFilterType === "quote") {
            titleForSalesperson = "Enquiry Conversion - Quoted Only";
          }
          setDetailedViewTitle(titleForSalesperson);

          // Make API call first
          const response = await getFilteredEnquiryConversionData(filterData);
          let tableData = convertEnquiryResponseToTableData(response);

          // Only filter client-side if there's no search parameter
          const hasSearch = filterData.search && filterData.search.trim();

          if (!hasSearch) {
            // Apply current filter type when clicking salesperson
            if (enquiryFilterType === "gain") {
              tableData = tableData.filter(
                (item: any) => (item.gained || item.total_gain || 0) > 0
              );
            } else if (enquiryFilterType === "lost") {
              tableData = tableData.filter(
                (item: any) => (item.lost || item.total_lost || 0) > 0
              );
            } else if (enquiryFilterType === "active") {
              tableData = tableData.filter(
                (item: any) => (item.active || item.total_active || 0) > 0
              );
            } else if (enquiryFilterType === "quote") {
              tableData = tableData.filter(
                (item: any) =>
                  (item.quote_created || item.total_quote_created || 0) > 0
              );
            }
          }

          // Update state AFTER data is ready to prevent showing stale data
          setDetailedViewSelectedSalesperson(value);
          setDetailedViewDrillLevel(2);
          setDetailedViewData(tableData);
        } else if (
          columnType === "gained" ||
          columnType === "lost" ||
          columnType === "active" ||
          columnType === "quote"
        ) {
          // Calculate date range from selected period
          const dateRange = calculateCallEntryDateRange(enquiryPeriod);

          // Check if we're at drill level 2 (customer-wise data level)
          // If so, navigate to EnquiryMaster with customer_code and status filters
          if (detailedViewDrillLevel === 2) {
            // Get customer_code from additionalData (row.original from the table)
            // Try multiple sources: additionalData with different field name variations
            let customerCode =
              additionalData?.customer_code ||
              additionalData?.CUSTOMER_CODE ||
              additionalData?.customerCode;

            // If still not found or invalid, try to get from detailedViewData
            // Match the row by comparing the additionalData object reference or key fields
            if (
              !customerCode ||
              customerCode === "-" ||
              (typeof customerCode === "string" && customerCode.trim() === "")
            ) {
              // Try to find the matching row in detailedViewData
              if (
                additionalData &&
                detailedViewData &&
                Array.isArray(detailedViewData)
              ) {
                // Try to find by object reference first (most reliable)
                const matchedRow = detailedViewData.find(
                  (row: any) => row === additionalData
                );

                if (matchedRow) {
                  customerCode =
                    matchedRow.customer_code ||
                    matchedRow.CUSTOMER_CODE ||
                    matchedRow.customerCode;
                } else {
                  // Fallback: try to match by customer_name or other unique identifier
                  const customerName =
                    additionalData?.customer_name ||
                    additionalData?.CUSTOMER_NAME;
                  if (customerName && customerName !== "-") {
                    const matchedRow = detailedViewData.find(
                      (row: any) =>
                        row.customer_name === customerName ||
                        row.CUSTOMER_NAME === customerName
                    );
                    customerCode =
                      matchedRow?.customer_code ||
                      matchedRow?.CUSTOMER_CODE ||
                      matchedRow?.customerCode;
                  }
                }
              }
            }

            // Validate customer_code - must be a non-empty string that's not "-"
            if (
              !customerCode ||
              customerCode === "-" ||
              (typeof customerCode === "string" &&
                customerCode.trim() === "") ||
              typeof customerCode !== "string"
            ) {
              console.error("Customer code validation failed:", {
                customerCode,
                additionalData,
                value,
                detailedViewDrillLevel,
                columnType,
                detailedViewDataLength: detailedViewData?.length,
                sampleRow: detailedViewData?.[0],
              });
              toast.error(
                "Customer code not found or invalid. Please try again."
              );
              setIsLoadingDetailedView(false);
              return;
            }

            // Trim and validate the customer code
            customerCode = String(customerCode).trim();

            // Final validation after trimming
            if (
              !customerCode ||
              customerCode === "-" ||
              customerCode.length === 0
            ) {
              console.error(
                "Customer code is invalid after trimming:",
                customerCode
              );
              toast.error("Customer code is invalid. Please try again.");
              setIsLoadingDetailedView(false);
              return;
            }

            // Map badge column type to status value for API
            const statusMap: Record<string, string> = {
              active: "ACTIVE",
              quote: "QUOTE CREATED",
              gained: "GAINED",
              lost: "LOST",
            };

            const status = statusMap[columnType] || "ACTIVE";

            // Conditional navigation based on status:
            // ACTIVE -> Navigate to EnquiryMaster
            // GAINED, LOST, QUOTE CREATED -> Navigate to QuotationMaster
            // Convert dates from DD-MM-YYYY (dashboard format) to YYYY-MM-DD (enquiry/quotation format)
            const convertDateToYYYYMMDD = (dateStr: string): string => {
              // Simple format conversion: DD-MM-YYYY -> YYYY-MM-DD
              const parts = dateStr.split("-");
              if (parts.length === 3) {
                // Rearrange: [DD, MM, YYYY] -> [YYYY, MM, DD]
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
              return dateStr; // Return as-is if format doesn't match
            };

            const enquiryDateFrom = convertDateToYYYYMMDD(dateRange.date_from);
            const enquiryDateTo = convertDateToYYYYMMDD(dateRange.date_to);

            try {
              if (status === "ACTIVE") {
                // Navigate to EnquiryMaster with filters in location state
                // Also pass dashboard state to enable back navigation
                navigate("/enquiry", {
                  state: {
                    initialFilters: {
                      customer_code: customerCode,
                      status: status,
                      enquiry_received_date_from: enquiryDateFrom,
                      enquiry_received_date_to: enquiryDateTo,
                    },
                    returnToDashboard: true,
                    dashboardState: {
                      detailedViewType: "enquiry",
                      detailedViewDrillLevel: detailedViewDrillLevel,
                      detailedViewSelectedCompany: detailedViewSelectedCompany,
                      detailedViewSelectedSalesperson:
                        detailedViewSelectedSalesperson,
                      enquiryFilterType: enquiryFilterType,
                      initialEnquiryFilterType: initialEnquiryFilterType,
                      selectedCompany: selectedCompany,
                      selectedLocation: selectedLocation,
                      searchSalesman: searchSalesman,
                      selectedYear: selectedYear,
                      selectedDate: selectedDate,
                      enquiryPeriod: enquiryPeriod,
                    },
                  },
                });
              } else if (
                status === "GAINED" ||
                status === "LOST" ||
                status === "QUOTE CREATED"
              ) {
                // Navigate to QuotationMaster with filters in location state and preserve dashboard state
                navigate("/quotation", {
                  state: {
                    initialFilters: {
                      customer_code: customerCode,
                      status: status,
                      enquiry_received_date_from: enquiryDateFrom,
                      enquiry_received_date_to: enquiryDateTo,
                    },
                    returnToDashboard: true,
                    dashboardState: {
                      detailedViewType: "enquiry",
                      detailedViewDrillLevel: detailedViewDrillLevel,
                      detailedViewSelectedCompany: detailedViewSelectedCompany,
                      detailedViewSelectedSalesperson:
                        detailedViewSelectedSalesperson,
                      enquiryFilterType: enquiryFilterType,
                      initialEnquiryFilterType: initialEnquiryFilterType,
                      selectedCompany: selectedCompany,
                      selectedLocation: selectedLocation,
                      searchSalesman: searchSalesman,
                      selectedYear: selectedYear,
                      selectedDate: selectedDate,
                      enquiryPeriod: enquiryPeriod,
                    },
                  },
                });
              }

              // Clear loading state after successful navigation
              setIsLoadingDetailedView(false);
            } catch (error) {
              console.error("Navigation error:", error);
              toast.error("Failed to navigate. Please try again.");
              setIsLoadingDetailedView(false);
            }
            return;
          }

          // Check if we're at drill level 1 (salesperson-wise data level)
          // If so, navigate to EnquiryMaster/QuotationMaster with salesperson filter
          if (detailedViewDrillLevel === 1) {
            // Get salesperson from additionalData (row.original from the table)
            // At drill level 1, additionalData should contain the row with salesperson field
            let salespersonName =
              additionalData?.salesperson ||
              additionalData?.SALESPERSON ||
              additionalData?.salesman;

            // If not found in additionalData, try to find from detailedViewData
            // This can happen if the row reference doesn't match
            if (
              !salespersonName ||
              salespersonName === "-" ||
              (typeof salespersonName === "string" &&
                salespersonName.trim() === "")
            ) {
              // Try to find the matching row in detailedViewData
              if (
                additionalData &&
                detailedViewData &&
                Array.isArray(detailedViewData)
              ) {
                // Try to find by object reference first (most reliable)
                const matchedRow = detailedViewData.find(
                  (row: any) => row === additionalData
                );

                if (matchedRow) {
                  salespersonName =
                    matchedRow.salesperson ||
                    matchedRow.SALESPERSON ||
                    matchedRow.salesman;
                } else {
                  // Fallback: at drill level 1, each row represents a salesperson
                  // Try to match by comparing the badge value with the row's badge value
                  // For the clicked badge column, find the row that has matching badge value
                  const badgeValue =
                    typeof value === "number" ? value : parseFloat(value);
                  if (!isNaN(badgeValue)) {
                    const matchedRowByBadge = detailedViewData.find(
                      (row: any) => {
                        const rowBadgeValue =
                          row[columnType] ||
                          (columnType === "quote" ? row.quote_created : null) ||
                          (columnType === "active" ? row.active : null) ||
                          (columnType === "gained" ? row.gained : null) ||
                          (columnType === "lost" ? row.lost : null);
                        return rowBadgeValue === badgeValue;
                      }
                    );
                    if (matchedRowByBadge) {
                      salespersonName =
                        matchedRowByBadge.salesperson ||
                        matchedRowByBadge.SALESPERSON ||
                        matchedRowByBadge.salesman;
                    }
                  }

                  // If still not found, use the first row with salesperson (less ideal but better than nothing)
                  if (!salespersonName || salespersonName === "-") {
                    const rowWithSalesperson = detailedViewData.find(
                      (row: any) =>
                        (row.salesperson && row.salesperson !== "-") ||
                        (row.SALESPERSON && row.SALESPERSON !== "-") ||
                        (row.salesman && row.salesman !== "-")
                    );
                    if (rowWithSalesperson) {
                      salespersonName =
                        rowWithSalesperson.salesperson ||
                        rowWithSalesperson.SALESPERSON ||
                        rowWithSalesperson.salesman;
                    }
                  }
                }
              }
            }

            // Validate salesperson name
            if (
              !salespersonName ||
              salespersonName === "-" ||
              (typeof salespersonName === "string" &&
                salespersonName.trim() === "")
            ) {
              console.error("Salesperson name validation failed:", {
                salespersonName,
                additionalData,
                value,
                columnType,
                detailedViewDrillLevel,
                detailedViewDataLength: detailedViewData?.length,
                sampleRow: detailedViewData?.[0],
                allRowSalespersons: detailedViewData?.map(
                  (r: any) => r.salesperson || r.SALESPERSON || r.salesman
                ),
              });
              toast.error(
                "Salesperson name not found or invalid. Please try again."
              );
              setIsLoadingDetailedView(false);
              return;
            }

            // Trim and validate the salesperson name
            salespersonName = String(salespersonName).trim();

            // Final validation after trimming
            if (
              !salespersonName ||
              salespersonName === "-" ||
              salespersonName.length === 0
            ) {
              console.error(
                "Salesperson name is invalid after trimming:",
                salespersonName
              );
              toast.error("Salesperson name is invalid. Please try again.");
              setIsLoadingDetailedView(false);
              return;
            }

            // Map badge column type to status value for API
            const statusMap: Record<string, string> = {
              active: "ACTIVE",
              quote: "QUOTE CREATED",
              gained: "GAINED",
              lost: "LOST",
            };

            const status = statusMap[columnType] || "ACTIVE";

            // Get company from state
            const company =
              detailedViewSelectedCompany ||
              additionalData?.company_name ||
              additionalData?.company;

            // Convert dates from DD-MM-YYYY (dashboard format) to YYYY-MM-DD (enquiry/quotation format)
            const convertDateToYYYYMMDD = (dateStr: string): string => {
              // Simple format conversion: DD-MM-YYYY -> YYYY-MM-DD
              const parts = dateStr.split("-");
              if (parts.length === 3) {
                // Rearrange: [DD, MM, YYYY] -> [YYYY, MM, DD]
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
              return dateStr; // Return as-is if format doesn't match
            };

            const enquiryDateFrom = convertDateToYYYYMMDD(dateRange.date_from);
            const enquiryDateTo = convertDateToYYYYMMDD(dateRange.date_to);

            try {
              if (status === "ACTIVE") {
                // Navigate to EnquiryMaster with salesperson filter
                navigate("/enquiry", {
                  state: {
                    initialFilters: {
                      ...(company && { company: company }),
                      sales_person: salespersonName,
                      status: status,
                      enquiry_received_date_from: enquiryDateFrom,
                      enquiry_received_date_to: enquiryDateTo,
                    },
                    returnToDashboard: true,
                    dashboardState: {
                      detailedViewType: "enquiry",
                      detailedViewDrillLevel: detailedViewDrillLevel,
                      detailedViewSelectedCompany: detailedViewSelectedCompany,
                      detailedViewSelectedSalesperson:
                        detailedViewSelectedSalesperson,
                      enquiryFilterType: enquiryFilterType,
                      initialEnquiryFilterType: initialEnquiryFilterType,
                      selectedCompany: selectedCompany,
                      selectedLocation: selectedLocation,
                      searchSalesman: searchSalesman,
                      selectedYear: selectedYear,
                      selectedDate: selectedDate,
                      enquiryPeriod: enquiryPeriod,
                    },
                  },
                });
              } else if (
                status === "GAINED" ||
                status === "LOST" ||
                status === "QUOTE CREATED"
              ) {
                // Navigate to QuotationMaster with salesperson filter
                navigate("/quotation", {
                  state: {
                    initialFilters: {
                      ...(company && { company: company }),
                      sales_person: salespersonName,
                      status: status,
                      enquiry_received_date_from: enquiryDateFrom,
                      enquiry_received_date_to: enquiryDateTo,
                    },
                    returnToDashboard: true,
                    dashboardState: {
                      detailedViewType: "enquiry",
                      detailedViewDrillLevel: detailedViewDrillLevel,
                      detailedViewSelectedCompany: detailedViewSelectedCompany,
                      detailedViewSelectedSalesperson:
                        detailedViewSelectedSalesperson,
                      enquiryFilterType: enquiryFilterType,
                      initialEnquiryFilterType: initialEnquiryFilterType,
                      selectedCompany: selectedCompany,
                      selectedLocation: selectedLocation,
                      searchSalesman: searchSalesman,
                      selectedYear: selectedYear,
                      selectedDate: selectedDate,
                      enquiryPeriod: enquiryPeriod,
                    },
                  },
                });
              }

              // Clear loading state after successful navigation
              setIsLoadingDetailedView(false);
            } catch (error) {
              console.error("Navigation error:", error);
              toast.error("Failed to navigate. Please try again.");
              setIsLoadingDetailedView(false);
            }
            return;
          }

          // Handle badge clicks at drill level 0 - get company from additionalData
          const company =
            detailedViewSelectedCompany ||
            additionalData?.company_name ||
            additionalData?.company;
          const salesperson =
            detailedViewSelectedSalesperson ||
            additionalData?.salesperson ||
            additionalData?.salesman;

          // Build filter with company and salesperson if available, and include date range
          if (company && salesperson) {
            filterData = addSearchToDetailedViewFilters({
              company,
              salesman: salesperson,
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
            });
            setDetailedViewSelectedCompany(company);
            setDetailedViewSelectedSalesperson(salesperson);
            setDetailedViewDrillLevel(2);
          } else if (company) {
            filterData = addSearchToDetailedViewFilters({
              company,
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
            });
            setDetailedViewSelectedCompany(company);
            setDetailedViewDrillLevel(1);
          } else {
            filterData = addSearchToDetailedViewFilters({
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
            });
            setDetailedViewDrillLevel(0);
          }

          // Set the filter type based on badge clicked
          let newFilterType: "all" | "gain" | "lost" | "active" | "quote" =
            "all";
          if (columnType === "gained") {
            newFilterType = "gain";
          } else if (columnType === "lost") {
            newFilterType = "lost";
          } else if (columnType === "active") {
            newFilterType = "active";
          } else if (columnType === "quote") {
            newFilterType = "quote";
          }

          // Update the filter type state
          setEnquiryFilterType(newFilterType);

          // Update the title based on the new filter type
          let newTitle = "Enquiry Conversion - Detailed View";
          if (newFilterType === "gain") {
            newTitle = "Enquiry Conversion - Gain Only";
          } else if (newFilterType === "lost") {
            newTitle = "Enquiry Conversion - Lost Only";
          } else if (newFilterType === "active") {
            newTitle = "Enquiry Conversion - Active Only";
          } else if (newFilterType === "quote") {
            newTitle = "Enquiry Conversion - Quoted Only";
          }
          setDetailedViewTitle(newTitle);

          const response = await getFilteredEnquiryConversionData(filterData);

          // Ensure response has data before converting
          if (!response || !response.data || !Array.isArray(response.data)) {
            setDetailedViewData([]);
            setIsLoadingDetailedView(false);
            return;
          }

          let tableData = convertEnquiryResponseToTableData(response);

          // If conversion returns empty but response has data, use raw data
          if (tableData.length === 0 && response.data.length > 0) {
            tableData = response.data.map((item: any) => {
              const active = extractNumericValue(item.active);
              const gained = extractNumericValue(item.gained);
              const lost = extractNumericValue(item.lost);
              const quoteCreated = extractNumericValue(item.quote_created);
              const totalEnquiries = active + gained + lost + quoteCreated;
              return {
                salesperson: item.salesperson || "-",
                active: item.active || 0,
                gained: item.gained || 0,
                lost: item.lost || 0,
                quote_created: item.quote_created || 0,
                total_enquiries: totalEnquiries,
              };
            });
          }

          // Only filter client-side if there's no search parameter
          // When search is present, the API should return filtered results
          const hasSearch = filterData.search && filterData.search.trim();

          if (!hasSearch) {
            // Use the newFilterType variable for filtering instead of enquiryFilterType
            if (newFilterType === "gain") {
              tableData = tableData.filter(
                (item: any) => (item.gained || item.total_gain || 0) > 0
              );
            } else if (newFilterType === "lost") {
              tableData = tableData.filter(
                (item: any) => (item.lost || item.total_lost || 0) > 0
              );
            } else if (newFilterType === "active") {
              tableData = tableData.filter(
                (item: any) => (item.active || item.total_active || 0) > 0
              );
            } else if (newFilterType === "quote") {
              tableData = tableData.filter(
                (item: any) =>
                  (item.quote_created || item.total_quote_created || 0) > 0
              );
            }
          }

          setDetailedViewData(tableData);
        } else {
          // For non-badge clicks, use the existing enquiryFilterType
          const response = await getFilteredEnquiryConversionData(filterData);
          let tableData = convertEnquiryResponseToTableData(response);

          // Only filter client-side if there's no search parameter
          const hasSearch = filterData.search && filterData.search.trim();

          if (!hasSearch) {
            if (enquiryFilterType === "gain") {
              tableData = tableData.filter(
                (item: any) => (item.gained || item.total_gain || 0) > 0
              );
            } else if (enquiryFilterType === "lost") {
              tableData = tableData.filter(
                (item: any) => (item.lost || item.total_lost || 0) > 0
              );
            } else if (enquiryFilterType === "active") {
              tableData = tableData.filter(
                (item: any) => (item.active || item.total_active || 0) > 0
              );
            } else if (enquiryFilterType === "quote") {
              tableData = tableData.filter(
                (item: any) =>
                  (item.quote_created || item.total_quote_created || 0) > 0
              );
            }
          }

          setDetailedViewData(tableData);
        }
      } else if (detailedViewType === "callentry") {
        // Handle send email action for call entry statistics
        if (columnType === "send_email") {
          handleSendEmailClick(additionalData);
          setIsLoadingDetailedView(false);
          return;
        }

        // Handle call_entry_id navigation at drill level 2
        if (
          columnType === "call_entry_id" &&
          (callEntryDrillLevel === 2 || detailedViewDrillLevel === 2)
        ) {
          const callEntryId =
            additionalData?.CALL_ENTRY_ID ||
            additionalData?.call_entry_id ||
            value;
          if (callEntryId != null && callEntryId !== "") {
            const id = String(callEntryId);
            navigate(`/call-entry-create/${id}`, {
              state: {
                returnTo: "/",
                returnToState: {
                  detailedViewType: "callentry",
                  detailedViewDrillLevel: detailedViewDrillLevel,
                  callEntryDrillLevel: callEntryDrillLevel,
                  callEntrySelectedSalesperson: callEntrySelectedSalesperson,
                  callEntrySelectedCustomer: callEntrySelectedCustomer,
                  callEntryFilterType: callEntryFilterType,
                  callEntryPeriod: callEntryPeriod,
                },
              },
            });
            setIsLoadingDetailedView(false);
            return;
          }
          setIsLoadingDetailedView(false);
          return;
        }

        setIsLoadingDetailedView(true);

        try {
          const dateRange = calculateCallEntryDateRange(callEntryPeriod);
          const companyName =
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
          const isBadgeClick = [
            "overdue",
            "today",
            "upcoming",
            "closed",
          ].includes(columnType);

          // Drill Level 0 → 1: Salesperson click (badges navigate to CallEntryMaster)
          if (callEntryDrillLevel === 0) {
            const salespersonToFilter = additionalData?.SALESPERSON;
            if (!salespersonToFilter) {
              toast.error("Salesperson information not found");
              setIsLoadingDetailedView(false);
              return;
            }

            // If badge is clicked at drill level 0, navigate to CallEntryMaster
            if (isBadgeClick) {
              const typeFilter = columnType as
                | "overdue"
                | "today"
                | "upcoming"
                | "closed";

              // Convert dates from DD-MM-YYYY (dashboard format) to YYYY-MM-DD (call entry format)
              const convertDateToYYYYMMDD = (dateStr: string): string => {
                const parts = dateStr.split("-");
                if (parts.length === 3) {
                  return `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                return dateStr;
              };

              const callEntryDateFrom = convertDateToYYYYMMDD(
                dateRange.date_from
              );
              const callEntryDateTo = convertDateToYYYYMMDD(dateRange.date_to);

              // Map badge type to status for CallEntryMaster
              // Note: CallEntryMaster uses followup_action_name, but we'll use the type filter
              // The actual status mapping may need adjustment based on CallEntryMaster implementation
              const statusMap: Record<string, string> = {
                overdue: "OVERDUE",
                today: "TODAY",
                upcoming: "UPCOMING",
                closed: "CLOSED",
              };

              try {
                navigate("/call-entry", {
                  state: {
                    fromDashboard: true,
                    restoreFilters: {
                      filters: {
                        sales_person: salespersonToFilter,
                        status: statusMap[typeFilter] || null,
                        customer: null,
                        call_date: null,
                        call_mode: null,
                        followup_date: null,
                        city: null,
                        area: null,
                      },
                      displayValues: {
                        customer: null,
                      },
                      fromDate: callEntryDateFrom
                        ? new Date(callEntryDateFrom)
                        : null,
                      toDate: callEntryDateTo
                        ? new Date(callEntryDateTo)
                        : null,
                      filtersApplied: true,
                    },
                    returnToDashboard: true,
                    dashboardState: {
                      detailedViewType: "callentry",
                      detailedViewDrillLevel: callEntryDrillLevel,
                      callEntryDrillLevel: callEntryDrillLevel,
                      callEntrySelectedSalesperson:
                        callEntrySelectedSalesperson,
                      callEntryFilterType: callEntryFilterType,
                      initialCallEntryFilterType: initialCallEntryFilterType,
                      callEntryPeriod: callEntryPeriod,
                    },
                  },
                });
                setIsLoadingDetailedView(false);
                return;
              } catch (error) {
                console.error("Navigation error:", error);
                toast.error("Failed to navigate. Please try again.");
                setIsLoadingDetailedView(false);
                return;
              }
            }

            // Salesperson name clicked - go to drill level 1
            setCallEntrySelectedSalesperson(salespersonToFilter);
            setCallEntryDrillLevel(1);
            setDetailedViewDrillLevel(1);
            // Preserve current filter type instead of resetting to "all"
            // setCallEntryFilterType("all"); // REMOVED - preserve filter type
            setDetailedViewTitle(
              `Call Entry - ${salespersonToFilter} - ${
                callEntryFilterType !== "all"
                  ? callEntryFilterType.charAt(0).toUpperCase() +
                    callEntryFilterType.slice(1)
                  : "All Customers"
              }`
            );

            const response = await getCallEntryStatistics({
              company: companyName,
              salesperson: salespersonToFilter,
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(callEntryFilterType !== "all" && {
                type: callEntryFilterType,
              }),
            });

            // Extract email metadata for the selected salesperson
            const statsResponse = response as CallEntryStatisticsResponse;
            const salespersonEmail = statsResponse.salesperson_email || "";
            const ccMail = statsResponse.cc_mail || [];

            const tableData = (response.data as CallEntryCustomerData[]).map(
              (item) => ({
                CUSTOMER_CODE: item.customer_code,
                CUSTOMER_NAME: item.customer_name,
                OVERDUE: item.total_overdue,
                TODAY: item.total_today,
                UPCOMING: item.total_upcoming,
                CLOSED: item.total_closed,
                TOTAL_CALLS: item.total_calls,
                // Enable Send Email action at customer level (same salesperson email)
                send_email: "send_email",
                salesperson_email: salespersonEmail,
                cc_mail: ccMail,
              })
            );
            // Sort by total calls in descending order
            tableData.sort((a, b) => {
              const aTotal = a.TOTAL_CALLS || 0;
              const bTotal = b.TOTAL_CALLS || 0;
              return bTotal - aTotal; // Descending order
            });
            setDetailedViewData(tableData);
          }
          // Drill Level 1 → 2: Customer click OR Badge click (badges navigate to CallEntryMaster)
          else if (callEntryDrillLevel === 1) {
            // Get customer code from row data
            const customerCode = additionalData?.CUSTOMER_CODE;
            const customerName = additionalData?.CUSTOMER_NAME;

            if (!customerCode) {
              toast.error("Customer code not found");
              setIsLoadingDetailedView(false);
              return;
            }

            // If badge is clicked at drill level 1, navigate to CallEntryMaster
            if (isBadgeClick) {
              const typeFilter = columnType as
                | "overdue"
                | "today"
                | "upcoming"
                | "closed";

              // Convert dates from DD-MM-YYYY (dashboard format) to YYYY-MM-DD (call entry format)
              const convertDateToYYYYMMDD = (dateStr: string): string => {
                const parts = dateStr.split("-");
                if (parts.length === 3) {
                  return `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                return dateStr;
              };

              const callEntryDateFrom = convertDateToYYYYMMDD(
                dateRange.date_from
              );
              const callEntryDateTo = convertDateToYYYYMMDD(dateRange.date_to);

              // Map badge type to status for CallEntryMaster
              const statusMap: Record<string, string> = {
                overdue: "OVERDUE",
                today: "TODAY",
                upcoming: "UPCOMING",
                closed: "CLOSED",
              };

              try {
                navigate("/call-entry", {
                  state: {
                    fromDashboard: true,
                    restoreFilters: {
                      filters: {
                        sales_person: callEntrySelectedSalesperson || null,
                        customer: customerCode,
                        status: statusMap[typeFilter] || null,
                        call_date: null,
                        call_mode: null,
                        followup_date: null,
                        city: null,
                        area: null,
                      },
                      displayValues: {
                        customer: customerName || null,
                      },
                      fromDate: callEntryDateFrom
                        ? new Date(callEntryDateFrom)
                        : null,
                      toDate: callEntryDateTo
                        ? new Date(callEntryDateTo)
                        : null,
                      filtersApplied: true,
                    },
                    returnToDashboard: true,
                    dashboardState: {
                      detailedViewType: "callentry",
                      detailedViewDrillLevel: callEntryDrillLevel,
                      callEntryDrillLevel: callEntryDrillLevel,
                      callEntrySelectedSalesperson:
                        callEntrySelectedSalesperson,
                      callEntryFilterType: callEntryFilterType,
                      initialCallEntryFilterType: initialCallEntryFilterType,
                      callEntryPeriod: callEntryPeriod,
                    },
                  },
                });
                setIsLoadingDetailedView(false);
                return;
              } catch (error) {
                console.error("Navigation error:", error);
                toast.error("Failed to navigate. Please try again.");
                setIsLoadingDetailedView(false);
                return;
              }
            }

            // Customer name/code clicked - go to drill level 2
            setCallEntrySelectedCustomer({
              code: customerCode,
              name: customerName,
            });
            setCallEntryDrillLevel(2);
            setDetailedViewDrillLevel(2);
            const typeFilter =
              callEntryFilterType !== "all" ? callEntryFilterType : undefined;
            setDetailedViewTitle(`Call Entry - ${customerName} - Details`);

            // Fetch call entry details
            const response = await getCallEntryStatistics({
              company: companyName,
              salesperson: callEntrySelectedSalesperson!,
              customer_code: customerCode,
              date_from: dateRange.date_from,
              date_to: dateRange.date_to,
              ...(typeFilter && { type: typeFilter }),
            });

            const tableData = (response.data as CallEntryDetailData[]).map(
              (item) => ({
                CALL_ENTRY_ID: item.call_entry_id,
                CALL_DATE: item.call_date,
                CALL_MODE: item.call_mode_name,
                FOLLOWUP_ACTION: item.followup_action_name,
                CALL_SUMMARY: item.call_summary,
                FOLLOWUP_DATE: item.followup_date,
                EXPECTED_PROFIT: item.expected_profit,
                CREATED_BY: item.created_by_name,
              })
            );
            setDetailedViewData(tableData);
          }
          // Drill Level 2: Badge click navigates to CallEntryMaster (no more drill levels)
          else if (callEntryDrillLevel === 2) {
            if (isBadgeClick) {
              const typeFilter = columnType as
                | "overdue"
                | "today"
                | "upcoming"
                | "closed";

              // Convert dates from DD-MM-YYYY (dashboard format) to YYYY-MM-DD (call entry format)
              const convertDateToYYYYMMDD = (dateStr: string): string => {
                const parts = dateStr.split("-");
                if (parts.length === 3) {
                  return `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                return dateStr;
              };

              const callEntryDateFrom = convertDateToYYYYMMDD(
                dateRange.date_from
              );
              const callEntryDateTo = convertDateToYYYYMMDD(dateRange.date_to);

              // Map badge type to status for CallEntryMaster
              const statusMap: Record<string, string> = {
                overdue: "OVERDUE",
                today: "TODAY",
                upcoming: "UPCOMING",
                closed: "CLOSED",
              };

              try {
                navigate("/call-entry", {
                  state: {
                    fromDashboard: true,
                    restoreFilters: {
                      filters: {
                        sales_person: callEntrySelectedSalesperson || null,
                        customer: callEntrySelectedCustomer?.code || null,
                        status: statusMap[typeFilter] || null,
                        call_date: null,
                        call_mode: null,
                        followup_date: null,
                        city: null,
                        area: null,
                      },
                      displayValues: {
                        customer: callEntrySelectedCustomer?.name || null,
                      },
                      fromDate: callEntryDateFrom
                        ? new Date(callEntryDateFrom)
                        : null,
                      toDate: callEntryDateTo
                        ? new Date(callEntryDateTo)
                        : null,
                      filtersApplied: true,
                    },
                    returnToDashboard: true,
                    dashboardState: {
                      detailedViewType: "callentry",
                      detailedViewDrillLevel: callEntryDrillLevel,
                      callEntryDrillLevel: callEntryDrillLevel,
                      callEntrySelectedSalesperson:
                        callEntrySelectedSalesperson,
                      callEntrySelectedCustomer: callEntrySelectedCustomer,
                      callEntryFilterType: callEntryFilterType,
                      initialCallEntryFilterType: initialCallEntryFilterType,
                      callEntryPeriod: callEntryPeriod,
                    },
                  },
                });
                setIsLoadingDetailedView(false);
                return;
              } catch (error) {
                console.error("Navigation error:", error);
                toast.error("Failed to navigate. Please try again.");
                setIsLoadingDetailedView(false);
                return;
              }
            }
          }
        } catch (error) {
          console.error("Error fetching call entry details:", error);
          toast.error("Failed to fetch call entry details");
        } finally {
          setIsLoadingDetailedView(false);
        }
      } else if (detailedViewType === "customerNotVisited") {
        // Customer Not Visited: Company → Salesperson (mandatory hierarchy)
        if (columnType === "company") {
          filterData = addSearchToDetailedViewFilters({ company: value });
          setDetailedViewSelectedCompany(value);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(1);
        } else if (columnType === "salesperson") {
          // Salesperson requires company - use previously selected company
          const company =
            detailedViewSelectedCompany ||
            additionalData?.company_name ||
            additionalData?.company;
          if (!company) {
            toast.error("Company is required to filter by salesperson");
            return;
          }
          filterData = addSearchToDetailedViewFilters({
            company,
            salesman: value,
          });
          setDetailedViewSelectedSalesperson(value);
          setDetailedViewDrillLevel(2);
        }

        // Handle customer not visited API call
        const customerNotVisitedFilter = {
          ...(filterData.company && { company: filterData.company }),
          ...(filterData.salesman && { salesperson: filterData.salesman }),
          ...(filterData.search && { search: filterData.search }),
        };
        const response = await getCustomerNotVisitedData({
          ...customerNotVisitedFilter,
          period: customerNotVisitedPeriod,
          index: 0,
          limit: 10,
        });

        const tableData = convertCustomerNotVisitedToTableData(
          response,
          columnType === "company" ? 1 : 2
        );
        setDetailedViewData(tableData);
      } else if (detailedViewType === "lostCustomer") {
        // Lost Customer: Salesperson → Customer (mandatory hierarchy)
        if (columnType === "salesperson") {
          filterData = addSearchToDetailedViewFilters({ salesperson: value });
          setDetailedViewSelectedSalesperson(value);
          setDetailedViewDrillLevel(1);
        }

        // Handle lost customer API call
        const response = await getLostCustomerData({
          company:
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA",
          period: lostCustomerPeriod,
          ...(filterData.search && { search: filterData.search }),
        });

        const tableData = convertLostCustomerToTableData(
          response,
          columnType === "salesperson" ? 1 : 0,
          columnType === "salesperson" ? value : undefined
        );
        setDetailedViewData(tableData);
      } else if (detailedViewType === "newCustomer") {
        // New Customer: Salesperson → Customer (mandatory hierarchy)
        if (columnType === "salesperson") {
          filterData = addSearchToDetailedViewFilters({ salesperson: value });
          setDetailedViewSelectedSalesperson(value);
          setDetailedViewDrillLevel(1);
        }

        // Handle new customer API call
        const newCustomerFilter = {
          company: user?.company?.company_name || "PENTAGON Dubai",
          period: newCustomerPeriod,
          ...(filterData.search && { search: filterData.search }),
        };

        let response: any;
        if (columnType === "salesperson") {
          // Get the salesperson's customers from the original data
          const salespersonData = newCustomerOriginalData?.data?.find(
            (item: any) => item.user_name === value
          );
          if (salespersonData) {
            response = {
              ...newCustomerOriginalData,
              data: salespersonData.customers,
            };
          }
        } else {
          response = await getNewCustomerData(newCustomerFilter);
        }

        const tableData = convertNewCustomerToTableData(
          response,
          columnType === "salesperson" ? 1 : 0
        );
        setDetailedViewData(tableData);
      }
    } catch (error) {
      console.error("Error handling column click:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  // Get drill level display name
  const getDrillLevelDisplayName = () => {
    if (detailedViewType === "outstanding") {
      if (detailedViewDrillLevel === 1)
        return detailedViewSelectedCompany || "Company";
      if (detailedViewDrillLevel === 2)
        return detailedViewSelectedLocation || "Location";
      if (detailedViewDrillLevel === 3)
        return detailedViewSelectedSalesperson || "Salesperson";
    } else if (
      detailedViewType === "customerNotVisited" ||
      detailedViewType === "newCustomer"
    ) {
      if (detailedViewDrillLevel === 1) return detailedViewSelectedCompany;
      if (detailedViewDrillLevel === 2) return detailedViewSelectedSalesperson;
      if (detailedViewDrillLevel === 3) return detailedViewSelectedSalesperson; // Month level shows salesperson
    } else if (detailedViewType === "budget") {
      // Budget titles are handled directly in the title, no need to append
      return null;
    } else if (detailedViewType === "enquiry") {
      // For enquiry, only show salesperson name at drill level 2
      if (detailedViewDrillLevel === 2) return detailedViewSelectedSalesperson;
      // Don't show company name at drill level 1 for enquiry type
      if (detailedViewDrillLevel === 1) return null;
    } else if (detailedViewType === "lostCustomer") {
      if (detailedViewDrillLevel === 1)
        return detailedViewSelectedSalesperson || "Salesperson";
    }
    return "";
  };

  // Handle back navigation in detailed view
  const handleDetailedViewBack = async () => {
    try {
      setIsLoadingDetailedView(true);

      if (detailedViewType === "outstanding") {
        if (detailedViewDrillLevel === 3) {
          console.log("detailedview customer back1");

          if (!detailedViewSelectedCompany) {
            toast.error("No company selected for back navigation");
            return;
          }
          const filterData = addSearchToDetailedViewFilters({
            company: detailedViewSelectedCompany,
            ...(detailedViewSelectedLocation && {
              location: detailedViewSelectedLocation,
            }),
          });
          console.log("filterData back 1", filterData);
          const response = await getFilteredOutstandingData(filterData as any);
          console.log("response back 1", response);
          const tableData = convertFilteredResponseToTableData(response, false);
          console.log("tableData back 1", tableData);
          setDetailedViewData(tableData);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(2);
        } else if (detailedViewDrillLevel === 2) {
          console.log("detailedview customer back2");
          // Go back from location to company level
          if (!detailedViewSelectedCompany) {
            toast.error("No company selected for back navigation");
            return;
          }
          const filterData = addSearchToDetailedViewFilters({
            company: detailedViewSelectedCompany,
          });
          const response = await getFilteredOutstandingData(filterData);
          const tableData = convertFilteredResponseToTableData(response, false);
          setDetailedViewData(tableData);
          setDetailedViewSelectedLocation(null);
          setDetailedViewDrillLevel(1);
        } else if (detailedViewDrillLevel === 1) {
          // Go back from company to initial View All state
          console.log("detailedview customer back3");

          const filterData = addSearchToDetailedViewFilters({});
          const response = await getFilteredOutstandingData(filterData);
          console.log("response back 3", response);
          const tableData = convertFilteredResponseToTableData(response, false);
          console.log("tableData back 3", tableData);
          setDetailedViewData(tableData);
          setDetailedViewSelectedCompany(null);
          setDetailedViewSelectedLocation(null);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(0);
        }
      } else if (detailedViewType === "budget") {
        if (detailedViewDrillLevel === 3) {
          // Go back from month level to salesperson monthly view (drill level 2)
          if (
            !detailedViewSelectedCompany ||
            !detailedViewSelectedSalesperson
          ) {
            toast.error(
              "Company and salesperson are required for back navigation"
            );
            return;
          }
          const filterData = addSearchToDetailedViewFilters({
            company: detailedViewSelectedCompany,
            salesman: detailedViewSelectedSalesperson,
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          });
          const response = await getFilteredBudgetData(filterData as any);
          const tableData = convertBudgetResponseToTableData(
            response,
            2, // Salesperson monthly view
            budgetType
          );
          setDetailedViewData(tableData);
          setDetailedViewDrillLevel(2);
          setBudgetSelectedMonth(null);
          // Update title for salesperson monthly view
          const salespersonName = detailedViewSelectedSalesperson || "";
          setDetailedViewTitle(
            `Budget vs Actual - ${salespersonName} - Month Wise`
          );
        } else if (detailedViewDrillLevel === 2) {
          // Go back from salesperson monthly view to company level (salesperson wise)
          if (!detailedViewSelectedCompany) {
            toast.error("No company selected for back navigation");
            return;
          }
          const filterData = addSearchToDetailedViewFilters({
            company: detailedViewSelectedCompany,
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          });
          const response = await getFilteredBudgetData(filterData as any);
          const tableData = convertBudgetResponseToTableData(
            response,
            1,
            budgetType
          );
          setDetailedViewData(tableData);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(1);
          // Update title for salesperson wise view
          setDetailedViewTitle("Budget vs Actual - Salesperson Wise");
        } else if (detailedViewDrillLevel === 1) {
          // Go back to initial View All state (Overall)
          const filterData = addSearchToDetailedViewFilters({
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          });
          const response = await getFilteredBudgetData(filterData as any);
          const tableData = convertBudgetResponseToTableData(
            response,
            0,
            budgetType
          );
          setDetailedViewData(tableData);
          setDetailedViewSelectedCompany(null);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(0);
          // Update title for overall view
          setDetailedViewTitle("Budget vs Actual - Overall");
        }
      } else if (detailedViewType === "enquiry") {
        console.log("detailedview enquiry back 1");
        // Calculate date range from selected period
        const dateRange = calculateCallEntryDateRange(enquiryPeriod);

        if (detailedViewDrillLevel === 2) {
          console.log("detailedview enquiry back 2");
          // Go back from salesperson to company level
          if (!detailedViewSelectedCompany) {
            toast.error("No company selected for back navigation");
            return;
          }
          const typeMap: Record<string, string> = {
            gain: "gained",
            lost: "lost",
            active: "active",
            quote: "quote created",
          };
          const filterData: DashboardFilters = addSearchToDetailedViewFilters({
            company: detailedViewSelectedCompany,
            date_from: dateRange.date_from,
            date_to: dateRange.date_to,
            ...(initialEnquiryFilterType !== "all" && {
              type:
                typeMap[initialEnquiryFilterType] ?? initialEnquiryFilterType,
            }),
          });
          const response = await getFilteredEnquiryConversionData(filterData);
          let tableData = convertEnquiryResponseToTableData(response);

          // Apply initial filter type (not current enquiryFilterType)
          // if (initialEnquiryFilterType === "gain") {
          //   tableData = tableData.filter(
          //     (item: any) => (item.gained || item.total_gain || 0) > 0
          //   );
          // } else if (initialEnquiryFilterType === "lost") {
          //   tableData = tableData.filter(
          //     (item: any) => (item.lost || item.total_lost || 0) > 0
          //   );
          // } else if (initialEnquiryFilterType === "active") {
          //   tableData = tableData.filter(
          //     (item: any) => (item.active || item.total_active || 0) > 0
          //   );
          // } else if (initialEnquiryFilterType === "quote") {
          //   tableData = tableData.filter(
          //     (item: any) =>
          //       (item.quote_created || item.total_quote_created || 0) > 0
          //   );
          // }

          setDetailedViewData(tableData);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(1);

          // Update title based on initial filter type (not current enquiryFilterType)
          let titleForLevel1 = "Enquiry Conversion - Detailed View";
          if (initialEnquiryFilterType === "gain") {
            titleForLevel1 = "Enquiry Conversion - Gain Only";
          } else if (initialEnquiryFilterType === "lost") {
            titleForLevel1 = "Enquiry Conversion - Lost Only";
          } else if (initialEnquiryFilterType === "active") {
            titleForLevel1 = "Enquiry Conversion - Active Only";
          } else if (initialEnquiryFilterType === "quote") {
            titleForLevel1 = "Enquiry Conversion - Quoted Only";
          }
          setDetailedViewTitle(titleForLevel1);
        } else if (detailedViewDrillLevel === 1) {
          // Go back to initial View All state - check if we need to reset to base or keep initial filter
          const filterData: DashboardFilters = addSearchToDetailedViewFilters({
            date_from: dateRange.date_from,
            date_to: dateRange.date_to,
          });
          const response = await getFilteredEnquiryConversionData(filterData);
          let tableData = convertEnquiryResponseToTableData(response);

          // Check if we came from "View All" (initial was "all") or from dashboard filter
          if (initialEnquiryFilterType === "all") {
            // Came from "View All" - reset filter to "all" and show all data
            setEnquiryFilterType("all");
            setDetailedViewTitle("Enquiry Conversion - Detailed View");
          } else {
            // Came from dashboard filter - keep the initial filter
            setEnquiryFilterType(initialEnquiryFilterType);

            // Apply initial filter type
            if (initialEnquiryFilterType === "gain") {
              tableData = tableData.filter(
                (item: any) => (item.gained || item.total_gain || 0) > 0
              );
              setDetailedViewTitle("Enquiry Conversion - Gain Only");
            } else if (initialEnquiryFilterType === "lost") {
              tableData = tableData.filter(
                (item: any) => (item.lost || item.total_lost || 0) > 0
              );
              setDetailedViewTitle("Enquiry Conversion - Lost Only");
            } else if (initialEnquiryFilterType === "active") {
              tableData = tableData.filter(
                (item: any) => (item.active || item.total_active || 0) > 0
              );
              setDetailedViewTitle("Enquiry Conversion - Active Only");
            } else if (initialEnquiryFilterType === "quote") {
              tableData = tableData.filter(
                (item: any) =>
                  (item.quote_created || item.total_quote_created || 0) > 0
              );
              setDetailedViewTitle("Enquiry Conversion - Quoted Only");
            }
          }

          setDetailedViewData(tableData);
          setDetailedViewSelectedCompany(null);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(0);
        }
      } else if (detailedViewType === "customerNotVisited") {
        if (detailedViewDrillLevel === 2) {
          // Go back from salesperson to company level
          if (!detailedViewSelectedCompany) {
            toast.error("No company selected for back navigation");
            return;
          }
          const response = await getCustomerNotVisitedData({
            company: detailedViewSelectedCompany,
            period: customerNotVisitedPeriod,
            index: 0,
            limit: 10,
          });
          const tableData = convertCustomerNotVisitedToTableData(response, 1);
          setDetailedViewData(tableData);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(1);
        } else if (detailedViewDrillLevel === 1) {
          // Go back to initial View All state
          const response = await getCustomerNotVisitedData({
            period: customerNotVisitedPeriod,
            index: 0,
            limit: 10,
          });
          const tableData = convertCustomerNotVisitedToTableData(response, 0);
          setDetailedViewData(tableData);
          setDetailedViewSelectedCompany(null);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(0);
        }
      } else if (detailedViewType === "lostCustomer") {
        if (detailedViewDrillLevel === 1) {
          // Go back from customer to salesperson level
          const response = await getLostCustomerData({
            company:
              user?.company?.company_name ||
              selectedCompany ||
              "PENTAGON INDIA",
            period: lostCustomerPeriod,
          });
          const tableData = convertLostCustomerToTableData(response, 0);
          setDetailedViewData(tableData);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(0);
        }
      } else if (detailedViewType === "newCustomer") {
        if (detailedViewDrillLevel === 1) {
          // Go back to initial View All state
          const response = await getNewCustomerData({
            company: user?.company?.company_name || "PENTAGON Dubai",
            period: newCustomerPeriod,
          });
          const tableData = convertNewCustomerToTableData(response, 0);
          setDetailedViewData(tableData);
          setDetailedViewSelectedSalesperson(null);
          setDetailedViewDrillLevel(0);
        }
      } else if (detailedViewType === "callentry") {
        if (callEntryDrillLevel === 2) {
          // Go back from call entries to customer list
          setCallEntrySelectedCustomer(null);
          setCallEntryDrillLevel(1);
          setDetailedViewDrillLevel(1);

          // Fetch customer list for the selected salesperson
          const dateRange = calculateCallEntryDateRange(callEntryPeriod);
          const companyName =
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

          const response = await getCallEntryStatistics({
            company: companyName,
            salesperson: callEntrySelectedSalesperson!,
            date_from: dateRange.date_from,
            date_to: dateRange.date_to,
            ...(callEntryFilterType !== "all" && { type: callEntryFilterType }),
          });

          // Extract email metadata for the selected salesperson
          const statsResponse = response as CallEntryStatisticsResponse;
          const salespersonEmail = statsResponse.salesperson_email || "";
          const ccMail = statsResponse.cc_mail || [];

          const tableData = (response.data as CallEntryCustomerData[]).map(
            (item) => ({
              CUSTOMER_CODE: item.customer_code,
              CUSTOMER_NAME: item.customer_name,
              OVERDUE: item.total_overdue,
              TODAY: item.total_today,
              UPCOMING: item.total_upcoming,
              CLOSED: item.total_closed,
              TOTAL_CALLS: item.total_calls,
              // Enable Send Email action at customer level (same salesperson email)
              send_email: "send_email",
              salesperson_email: salespersonEmail,
              cc_mail: ccMail,
            })
          );
          // Sort by total calls in descending order
          tableData.sort((a, b) => {
            const aTotal = a.TOTAL_CALLS || 0;
            const bTotal = b.TOTAL_CALLS || 0;
            return bTotal - aTotal; // Descending order
          });
          setDetailedViewData(tableData);
          setDetailedViewTitle(
            `Call Entry - ${callEntrySelectedSalesperson} - ${
              callEntryFilterType !== "all"
                ? callEntryFilterType.charAt(0).toUpperCase() +
                  callEntryFilterType.slice(1)
                : "All Customers"
            }`
          );

          // Keep loader on until React processes the state update and list is rendered
          // Use a small delay to ensure the state update is applied and component re-renders
          setTimeout(() => {
            setIsLoadingDetailedView(false);
          }, 100);
        } else if (callEntryDrillLevel === 1) {
          // Go back from customer list to salesperson list
          setCallEntrySelectedSalesperson(null);
          setCallEntryDrillLevel(0);
          setDetailedViewDrillLevel(0);

          // Always fetch fresh salesperson list from API
          const dateRange = calculateCallEntryDateRange(callEntryPeriod);
          const companyName =
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

          const response = await getCallEntryStatistics({
            company: companyName,
            date_from: dateRange.date_from,
            date_to: dateRange.date_to,
            ...(callEntryFilterType !== "all" && { type: callEntryFilterType }),
          });

          const tableData = (response.data as CallEntrySalespersonData[]).map(
            (item) => ({
              SALESPERSON: item.salesperson,
              OVERDUE: item.total_overdue,
              TODAY: item.total_today,
              UPCOMING: item.total_upcoming,
              CLOSED: item.total_closed,
              TOTAL_CALLS: item.total_calls,
              // Enable Send Email action at salesperson level
              send_email: "send_email",
              salesperson_email: item.salesperson_email || "",
              cc_mail: item.cc_mail || [],
            })
          );
          // Sort by total calls in descending order
          tableData.sort((a, b) => {
            const aTotal = a.TOTAL_CALLS || 0;
            const bTotal = b.TOTAL_CALLS || 0;
            return bTotal - aTotal; // Descending order
          });
          setDetailedViewData(tableData);
          setCallEntryStatisticsData(response); // Update cached data

          // Update title based on original filter type
          let title = "Call Entry - Detailed View";
          if (callEntryFilterType === "overdue") {
            title = "Call Entry - Overdue Only";
          } else if (callEntryFilterType === "today") {
            title = "Call Entry - Today Only";
          } else if (callEntryFilterType === "upcoming") {
            title = "Call Entry - Upcoming Calls";
          } else if (callEntryFilterType === "closed") {
            title = "Call Entry - Closed Calls";
          }
          setDetailedViewTitle(title);

          // Keep loader on until React processes the state update and list is rendered
          // Use a small delay to ensure the state update is applied and component re-renders
          setTimeout(() => {
            setIsLoadingDetailedView(false);
          }, 100);
        } else {
          setIsLoadingDetailedView(false);
        }
        return; // Return early to prevent finally block from running
      }
    } catch (error) {
      console.error("Error handling back navigation:", error);
      toast.error("Error navigating back. Please try again.");
      setIsLoadingDetailedView(false);
    } finally {
      // Only set loader to false if we haven't already handled it for callentry
      if (detailedViewType !== "callentry") {
        setIsLoadingDetailedView(false);
      }
    }
  };

  // Function to refresh detailed view data when filters change
  const refreshDetailedView = async () => {
    if (!showDetailedView || !detailedViewType) return;

    try {
      setIsLoadingDetailedView(true);

      if (detailedViewType === "callentry") {
        // Call entry now uses period-based API, no need to refresh on filter change
        // The data is already loaded from the API based on the selected period
        setIsLoadingDetailedView(false);
        return;
      } else if (detailedViewType === "enquiry") {
        const filterData: DashboardFilters = {
          ...(selectedCompany && { company: selectedCompany }),
          ...(selectedLocation && { location: selectedLocation }),
          ...(searchSalesman && { salesman: searchSalesman }),
          ...(selectedYear && { year: parseInt(selectedYear) }),
          ...(selectedDate && {
            date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
            date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
          }),
        };

        const response = await getFilteredEnquiryConversionData(filterData);
        let tableData = convertEnquiryResponseToTableData(response);

        if (enquiryFilterType === "gain") {
          tableData = tableData.filter(
            (item: any) => (item.gained || item.total_gain || 0) > 0
          );
        } else if (enquiryFilterType === "lost") {
          tableData = tableData.filter(
            (item: any) => (item.lost || item.total_lost || 0) > 0
          );
        }

        setDetailedViewData(tableData);
      } else if (detailedViewType === "budget") {
        let response: any;

        if (budgetDrillLevel === 0) {
          const filterData: DashboardFilters = {
            ...(selectedCompany && { company: selectedCompany }),
            ...(selectedLocation && { location: selectedLocation }),
            ...(searchSalesman && { salesman: searchSalesman }),
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          };
          response = await getFilteredBudgetData(filterData as any);
        } else if (budgetDrillLevel === 1) {
          const filterData: DashboardFilters = {
            company: budgetSelectedCompany || "",
            ...(selectedLocation && { location: selectedLocation }),
            ...(searchSalesman && { salesman: searchSalesman }),
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          };
          response = await getFilteredBudgetData(filterData as any);
        } else if (budgetDrillLevel === 2 || budgetDrillLevel === 3) {
          const filterData: DashboardFilters = {
            company: budgetSelectedCompany || "",
            salesman: budgetSelectedSalesperson || "",
            ...(budgetStartMonth && { start_month: budgetStartMonth }),
            ...(budgetEndMonth && { end_month: budgetEndMonth }),
            type: budgetType,
          };
          response = await getFilteredBudgetData(filterData as any);
        }

        const shouldRemoveSalespersonColumn = !!(
          searchSalesman || budgetSelectedSalesperson
        );
        const tableData = convertBudgetResponseToTableData(
          response,
          budgetDrillLevel,
          budgetType
        );
        setDetailedViewData(tableData);
      } else if (detailedViewType === "outstanding") {
        const filterData: DashboardFilters = {
          ...(selectedCompany && { company: selectedCompany }),
          ...(selectedLocation && { location: selectedLocation }),
          ...(searchSalesman && { salesman: searchSalesman }),
          ...(selectedYear && { year: parseInt(selectedYear) }),
          ...(selectedDate && {
            date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
            date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
          }),
        };

        const response = await getFilteredOutstandingData(filterData);
        const shouldRemoveSalespersonColumns = !!searchSalesman;
        const tableData = convertFilteredResponseToTableData(
          response,
          shouldRemoveSalespersonColumns
        );
        setDetailedViewData(tableData);
      } else if (detailedViewType === "lostCustomer") {
        const response = await getLostCustomerData({
          company:
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA",
          period: lostCustomerPeriod,
        });
        const tableData = convertLostCustomerToTableData(
          response,
          detailedViewDrillLevel,
          detailedViewSelectedSalesperson || undefined
        );
        setDetailedViewData(tableData);
      }
    } catch (error) {
      console.error("Error refreshing detailed view:", error);
    } finally {
      setIsLoadingDetailedView(false);
    }
  };

  // Handle back navigation in drill-down
  const handleBack = async () => {
    try {
      setIsLoadingOutstandingChart(true);

      if (drillLevel === 2) {
        setDrillLevel(1);
        setSelectedLocation(null);
        setSearchSalesman("");
        const resp = await getFilteredOutstandingData({
          company: selectedCompanyCtx.company || selectedCompany || "",
        });
        const locs = Array.isArray(resp?.data) ? resp.data : [];
        setLocationData(locs);
        const totalOutstanding = parseFloat(
          (resp?.summary?.total_outstanding ||
            resp?.summary?.local_outstanding ||
            0) as any
        );
        const totalOverdue = parseFloat(
          (resp?.summary?.total_overdue || 0) as any
        );
        setContextTotals({
          outstanding: totalOutstanding,
          overdue: totalOverdue,
        });

        const callEntryFilterData: DashboardFilters = {
          ...(selectedDate && {
            date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
            date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
          }),
        };
        const filteredCallEntryData =
          Object.keys(callEntryFilterData).length > 0
            ? filterCallEntryData(callEntryData, callEntryFilterData)
            : callEntryData;
        const aggregatedCallEntry = calculateCallEntryAggregatedData(
          filteredCallEntryData
        );
        setCallEntryAggregatedData(aggregatedCallEntry);
      } else if (drillLevel === 1) {
        if (isFilterMode) {
          setDrillLevel(0);
          setIsFilterMode(false);
          setSelectedCompanyCtx({});
          setSelectedCompany(null);
          setSelectedLocation(null);
          setSearchSalesman("");

          const companyName =
            user?.company?.company_name || selectedCompany || "PENTAGON INDIA";
          const summaryResponse = await getFilteredOutstandingData({
            company: companyName,
          });
          if (summaryResponse?.data && Array.isArray(summaryResponse.data)) {
            const calculatedData =
              calculateFilteredAggregatedData(summaryResponse);
            setAggregatedData(calculatedData);
            setCompanySummary([]);
            setLocationData(summaryResponse.data);
            setDrillLevel(1);
            setSelectedCompanyCtx({
              company: companyName,
              branch_code:
                user?.branches?.find((b) => b.is_default)?.branch_code || "",
            });
            setSelectedCompany(companyName);
            setContextTotals({
              outstanding: calculatedData.totalOutstanding,
              overdue: calculatedData.totalOverdue,
            });
          }

          const enquiryResponse = await getEnquiryConversionData();
          const aggregatedEnquiryConversion =
            calculateEnquiryConversionAggregatedData(enquiryResponse);
          setEnquiryConversionAggregatedData(aggregatedEnquiryConversion);

          await refreshBudgetData();
        } else {
          setDrillLevel(0);
          setSelectedCompanyCtx({});
          setSelectedCompany(null);
          setSelectedLocation(null);
          setSearchSalesman("");

          const summaryResponse = await getFilteredOutstandingData({
            company: user?.company?.company_name || "PENTAGON INDIA",
          });
          if (summaryResponse?.data && Array.isArray(summaryResponse.data)) {
            const calculatedData = calculateAggregatedData(
              summaryResponse.data as any
            );
            setAggregatedData(calculatedData);
            setCompanySummary(summaryResponse.data);
            setContextTotals({
              outstanding: calculatedData.totalOutstanding,
              overdue: calculatedData.totalOverdue,
            });
          }
        }

        const callEntryFilterData: DashboardFilters = {
          ...(selectedDate && {
            date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
            date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
          }),
        };
        const filteredCallEntryData =
          Object.keys(callEntryFilterData).length > 0
            ? filterCallEntryData(callEntryData, callEntryFilterData)
            : callEntryData;
        const aggregatedCallEntry = calculateCallEntryAggregatedData(
          filteredCallEntryData
        );
        setCallEntryAggregatedData(aggregatedCallEntry);
      }
    } catch (e) {
      console.error("Error in back handler:", e);
    } finally {
      setIsLoadingOutstandingChart(false);
    }
  };

  const handlePieClick = useCallback(
    async (params: any) => {
      const meta = params?.data?._meta;
      if (!meta) return;

      try {
        if (meta.type === "company") {
          setIsLoadingOutstandingChart(true);

          setDrillLevel(1);
          setIsFilterMode(false);
          setSelectedCompanyCtx({
            company: params.name,
            branch_code: meta.branch_code,
            currency: meta.currency,
          });
          setSelectedCompany(params.name);
          const resp = await getFilteredOutstandingData(
            addSearchToFilters({
              company: params.name,
            })
          );
          const locs = Array.isArray(resp?.data) ? resp.data : [];
          setLocationData(locs);
          const totalOutstanding = parseFloat(
            (resp?.summary?.total_outstanding ||
              resp?.summary?.local_outstanding ||
              0) as any
          );
          const totalOverdue = parseFloat(
            (resp?.summary?.total_overdue || 0) as any
          );
          setContextTotals({
            outstanding: totalOutstanding,
            overdue: totalOverdue,
          });
          // Set loading to false ONLY after data is set
          setIsLoadingOutstandingChart(false);
        } else if (meta.type === "location") {
          setIsLoadingOutstandingChart(true);
          setDrillLevel(2);
          setIsFilterMode(false);
          setSelectedLocation(meta.location || null);
          setSearchSalesman("");

          const callEntryFilterData: DashboardFilters = {
            ...(selectedDate && {
              date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
              date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
            }),
          };
          const filteredCallEntryData =
            Object.keys(callEntryFilterData).length > 0
              ? filterCallEntryData(callEntryData, callEntryFilterData)
              : callEntryData;
          const aggregatedCallEntry = calculateCallEntryAggregatedData(
            filteredCallEntryData
          );
          setCallEntryAggregatedData(aggregatedCallEntry);

          const resp = await getFilteredOutstandingData(
            addSearchToFilters({
              company: selectedCompanyCtx.company || selectedCompany || "",
              location: meta.location,
            })
          );
          const list = Array.isArray(resp?.data)
            ? resp.data.find(
                (d: any) => (d.location || d.Location) === meta.location
              )?.outstanding_data || []
            : [];
          setSalespersonData(list);
          const totalOutstanding = parseFloat(
            (resp?.summary?.total_outstanding ||
              resp?.summary?.local_outstanding ||
              0) as any
          );
          const totalOverdue = parseFloat(
            (resp?.summary?.total_overdue || 0) as any
          );
          setContextTotals({
            outstanding: totalOutstanding,
            overdue: totalOverdue,
          });
          // Set loading to false ONLY after data is set
          setIsLoadingOutstandingChart(false);
        } else if (meta.type === "salesperson") {
          setIsLoadingDetailedView(true);
          setShowDetailedView(true);
          setDetailedViewTitle(`${meta.salesman}`);

          setSearchSalesman(meta.salesman);

          const callEntryFilterData: DashboardFilters = {
            ...(selectedDate && {
              date_from: dayjs(selectedDate).format("YYYY-MM-DD"),
              date_to: dayjs(selectedDate).format("YYYY-MM-DD"),
            }),
            salesman: meta.salesman,
          };
          const filteredCallEntryData = filterCallEntryData(
            callEntryData,
            callEntryFilterData
          );
          const aggregatedCallEntry = calculateCallEntryAggregatedData(
            filteredCallEntryData
          );
          setCallEntryAggregatedData(aggregatedCallEntry);

          try {
            const filterData: DashboardFilters = addSearchToFilters({
              ...(selectedCompanyCtx.company && {
                company: selectedCompanyCtx.company,
              }),
              ...(selectedLocation && { location: selectedLocation }),
              salesman: meta.salesman,
            });

            const response = await getFilteredOutstandingData(filterData);
            const tableData = convertFilteredResponseToTableData(
              response,
              true
            );
            setDetailedViewData(tableData);
          } catch (error) {
            console.error("Error loading salesperson detailed view:", error);
          } finally {
            setIsLoadingDetailedView(false);
          }
        }
      } catch (e) {
        console.error("Error handling pie click:", e);
      } finally {
        setIsLoadingOutstandingChart(false);
      }
    },
    [
      selectedDate,
      selectedCompanyCtx,
      selectedCompany,
      selectedLocation,
      callEntryData,
      addSearchToFilters,
    ]
  );

  // Handle budget type toggle change
  const handleBudgetTypeChange = useCallback(
    async (value: "salesperson" | "non-salesperson") => {
      setIsLoadingBudget(true);
      try {
        setBudgetType(value);
        const filterData: any = {
          start_month: budgetStartMonth,
          end_month: budgetEndMonth,
          type: value,
        };

        if (budgetDrillLevel === 1 && budgetSelectedCompany) {
          filterData.company = budgetSelectedCompany;
        } else if (
          budgetDrillLevel >= 2 &&
          budgetSelectedCompany &&
          budgetSelectedSalesperson
        ) {
          filterData.company = budgetSelectedCompany;
          filterData.salesman = budgetSelectedSalesperson;
        }

        const response = await getFilteredBudgetData(
          addSearchToFilters(filterData as any)
        );
        setBudgetRawData(response);
        const agg = calculateBudgetAggregatedData(response);
        setBudgetAggregatedData(agg);
      } catch (error) {
        console.error("Error changing budget type:", error);
      } finally {
        setIsLoadingBudget(false);
      }
    },
    [
      budgetStartMonth,
      budgetEndMonth,
      budgetDrillLevel,
      budgetSelectedCompany,
      budgetSelectedSalesperson,
      globalSearch,
    ]
  );

  // Handle budget month filter changes
  const handleBudgetMonthFilterChange = useCallback(
    async (startMonth: string | null, endMonth: string | null) => {
      if (!startMonth || !endMonth) return;

      setIsLoadingBudget(true);
      try {
        // Update the month states
        setBudgetStartMonth(startMonth);
        setBudgetEndMonth(endMonth);

        // Reset drill level and selections
        setBudgetDrillLevel(1);
        setBudgetSelectedCompany(null);
        setBudgetSelectedSalesperson(null);
        setBudgetSelectedMonth(null);
        setBudgetWindowStart(0);

        // Get company name from user's auth data
        const companyName =
          user?.company?.company_name || selectedCompany || "PENTAGON INDIA";

        const filterData: DashboardFilters = addSearchToFilters({
          ...(companyName && { company: companyName }),
          ...(selectedYear && { year: parseInt(selectedYear) }),
          start_month: startMonth,
          end_month: endMonth,
          type: budgetType,
        });

        const budgetResponse = await getFilteredBudgetData(filterData as any);
        setBudgetRawData(budgetResponse);
        setBudgetDateRange(budgetResponse?.data?.[0]?.date_range || "");
        const budgetAgg = calculateBudgetAggregatedData(budgetResponse);
        setBudgetAggregatedData(budgetAgg);
      } catch (error) {
        console.error("Error changing budget month filter:", error);
      } finally {
        setIsLoadingBudget(false);
      }
    },
    [
      selectedYear,
      budgetType,
      user?.company?.company_name,
      selectedCompany,
      addSearchToFilters,
    ]
  );

  const handleBudgetBarClick = useCallback(
    async (params: any) => {
      setIsLoadingBudget(true);
      try {
        if (budgetDrillLevel === 0) {
          setBudgetSelectedCompany(params?.name || null);
          setSelectedCompany(params?.name || null);
          setBudgetWindowStart(0);
          const resp = await getFilteredBudgetData(
            addSearchToFilters({
              company: params?.name,
              start_month: budgetStartMonth,
              end_month: budgetEndMonth,
              type: budgetType,
            } as any)
          );
          setBudgetRawData(resp);
          setBudgetDateRange(resp?.data?.[0]?.date_range || budgetDateRange);
          const agg = calculateBudgetAggregatedData(resp);
          setBudgetAggregatedData(agg);
          setBudgetDrillLevel(1);
        } else if (budgetDrillLevel === 1) {
          const fullSalespersonName =
            budgetRawData?.data?.[0]?.budget?.[
              params?.dataIndex + budgetWindowStart
            ]?.salesperson || params?.name;
          setBudgetSelectedSalesperson(fullSalespersonName);
          setSearchSalesman(fullSalespersonName);

          setBudgetWindowStart(0);
          const resp = await getFilteredBudgetData(
            addSearchToFilters({
              company: budgetSelectedCompany,
              salesman: fullSalespersonName,
              start_month: budgetStartMonth,
              end_month: budgetEndMonth,
              type: budgetType,
            } as any)
          );
          setBudgetRawData(resp);
          setBudgetDateRange(resp?.data?.[0]?.date_range || budgetDateRange);
          const agg = calculateBudgetAggregatedData(resp);
          setBudgetAggregatedData(agg);
          setBudgetDrillLevel(2);
        } else if (budgetDrillLevel === 2) {
          const clickedMonth =
            budgetRawData?.data?.[0]?.budget?.[
              params?.dataIndex + budgetWindowStart
            ]?.month;

          if (clickedMonth) {
            // Show detailed view for the selected month
            setIsLoadingDetailedView(true);
            setShowDetailedView(true);
            setDetailedViewType("budget");

            // Set detailed view state for proper back button and header display
            const companyName =
              budgetSelectedCompany ||
              user?.company?.company_name ||
              selectedCompany ||
              "PENTAGON INDIA";
            setDetailedViewSelectedCompany(companyName);
            setDetailedViewSelectedSalesperson(budgetSelectedSalesperson);
            setDetailedViewDrillLevel(3); // Month level is drill level 3
            setDetailedViewSearch(globalSearch);

            const monthFormatted = dayjs(clickedMonth + "-01").format(
              "MMMM YYYY"
            );
            const salespersonName = budgetSelectedSalesperson || "";
            const title = `Budget vs Actual - ${salespersonName} - ${monthFormatted}`;
            setDetailedViewTitle(title);

            const filterData: DashboardFilters = addSearchToFilters({
              company: companyName,
              salesman: budgetSelectedSalesperson || "",
              start_month: clickedMonth,
              end_month: clickedMonth,
              type: budgetType,
            });

            const response = await getFilteredBudgetData(filterData as any);

            const tableData = convertBudgetResponseToTableData(
              response,
              3, // Use drill level 3 for month-level view
              budgetType
            );
            setDetailedViewData(tableData);
            setIsLoadingDetailedView(false);
            setBudgetSelectedMonth(clickedMonth);
          }
        }
      } finally {
        setIsLoadingBudget(false);
      }
    },
    [
      budgetDrillLevel,
      budgetStartMonth,
      budgetEndMonth,
      budgetDateRange,
      budgetRawData,
      budgetSelectedCompany,
      budgetSelectedSalesperson,
      budgetWindowStart,
      searchSalesman,
      budgetType,
      addSearchToFilters,
    ]
  );

  const yearOptions = Array.from({ length: 10 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { value: year.toString(), label: year.toString() };
  });

  const getFromMonthOptions = (year: string | null) => {
    const selectedYear = year || dayjs().year().toString();
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const options: { value: string; label: string }[] = [];

    // Start from April (index 3)
    for (let i = 3; i < 12; i++) {
      const monthNumber = String(i + 1).padStart(2, "0");
      const monthValue = `${selectedYear}-${monthNumber}`;

      options.push({
        value: monthValue,
        label: months[i],
      });
    }

    return options;
  };

  const getToMonthOptions = (year: string | null) => {
    const selectedYear = year || dayjs().year().toString();
    const currentYear = dayjs().year().toString();
    const currentMonth = dayjs().month() + 1;

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const options: { value: string; label: string }[] = [];

    // Get the start month from budgetStartMonth
    const startMonthIndex = budgetStartMonth
      ? parseInt(budgetStartMonth.split("-")[1]) - 1
      : 3; // Default to April (index 3)

    months.forEach((month, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");
      const monthValue = `${selectedYear}-${monthNumber}`;

      // Only show months from the selected start month onwards
      if (index < startMonthIndex) {
        return;
      }

      if (selectedYear === currentYear && index + 1 >= currentMonth) {
        return;
      }

      if (parseInt(selectedYear) > parseInt(currentYear)) {
        return;
      }

      options.push({
        value: monthValue,
        label: `${month}`,
      });
    });

    return options;
  };

  const fromMonthOptions = getFromMonthOptions(selectedYear);
  const toMonthOptions = getToMonthOptions(selectedYear);

  return (
    <Box p="xs" h="50vh">
      {/* Filter Section - Single Row */}

      {/* Tabs and Search Row - Available in all drill levels */}
      <Group
        mb="md"
        justify="space-between"
        align="center"
        wrap="nowrap"
        style={{ alignItems: "center" }}
      >
        {/* Tabs with Segmented Control Style */}
        <Group
          gap={0}
          style={{
            backgroundColor: "#f1f3f5",
            borderRadius: "6px",
            padding: "2px",
            height: "32px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Button
            variant={activeTab === "overall" ? "filled" : "subtle"}
            onClick={() => setActiveTab("overall")}
            size="xs"
            style={{
              backgroundColor:
                activeTab === "overall" ? "#ffffff" : "transparent",
              color: activeTab === "overall" ? "#000000" : "#666",
              fontWeight: activeTab === "overall" ? 600 : 400,
              border: "none",
              borderRadius: "4px",
              boxShadow:
                activeTab === "overall"
                  ? "0 1px 2px rgba(0, 0, 0, 0.1)"
                  : "none",
              transition: "all 0.2s ease",
              fontSize: "12px",
              padding: "4px 12px",
            }}
          >
            Overall
          </Button>
          <Button
            variant={activeTab === "pipeline-Report" ? "filled" : "subtle"}
            onClick={() => setActiveTab("pipeline-Report")}
            size="xs"
            style={{
              backgroundColor:
                activeTab === "pipeline-Report" ? "#ffffff" : "transparent",
              color: activeTab === "pipeline-Report" ? "#000000" : "#666",
              fontWeight: activeTab === "pipeline-Report" ? 600 : 400,
              border: "none",
              borderRadius: "4px",
              boxShadow:
                activeTab === "pipeline-Report"
                  ? "0 1px 2px rgba(0, 0, 0, 0.1)"
                  : "none",
              transition: "all 0.2s ease",
              fontSize: "12px",
              padding: "4px 12px",
            }}
          >
            Pipeline Report
          </Button>
          <Button
            variant={activeTab === "booking" ? "filled" : "subtle"}
            onClick={() => setActiveTab("booking")}
            size="xs"
            style={{
              backgroundColor:
                activeTab === "booking" ? "#ffffff" : "transparent",
              color: activeTab === "booking" ? "#000000" : "#666",
              fontWeight: activeTab === "booking" ? 600 : 400,
              border: "none",
              borderRadius: "4px",
              boxShadow:
                activeTab === "booking"
                  ? "0 1px 2px rgba(0, 0, 0, 0.1)"
                  : "none",
              transition: "all 0.2s ease",
              fontSize: "12px",
              padding: "4px 12px",
            }}
          >
            Booking
          </Button>
        </Group>

        {/* Global Search Input and Date Filter - Always visible at dashboard base level (only hidden in detailed view) */}
        {!showDetailedView && (
          <Group
            gap="md"
            align="center"
            wrap="nowrap"
            style={{ alignItems: "center" }}
          >
            {/* Common Date Range Filter */}
            <Box
              style={{
                width: "270px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                height: "32px",
              }}
            >
              <DateRangeInput
                fromDate={customerInteractionFromDate}
                toDate={customerInteractionToDate}
                onFromDateChange={setCustomerInteractionFromDate}
                onToDateChange={setCustomerInteractionToDate}
                fromPlaceholder="From Date"
                toPlaceholder="To Date"
                size="xs"
                allowDeselection={true}
                showRangeInCalendar={false}
                hideLabels={true}
                containerStyle={{ gap: "4px" }}
              />
            </Box>
            {/* Global Search Input */}
            <Group
              style={{
                maxWidth: "400px",
                display: "flex",
                alignItems: "center",
                height: "32px",
              }}
              gap="xs"
            >
              <Autocomplete
                placeholder="Search by Customer name or Salesperson"
                value={searchInputValue}
                onChange={setSearchInputValue}
                onOptionSubmit={(value) => {
                  setSearchInputValue(value);
                  setGlobalSearch(value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && searchInputValue.trim()) {
                    setGlobalSearch(searchInputValue.trim());
                  }
                }}
                data={dropdownOptions}
                size="xs"
                style={{ width: "400px" }}
                rightSectionWidth={60}
                rightSection={
                  <Group gap={4} align="center" wrap="nowrap">
                    {/* Clear (X) icon - only when value exists and not loading dropdown */}
                    {searchInputValue.trim() !== "" && !isDropdownLoading && (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => {
                          setSearchInputValue("");
                          setGlobalSearch("");
                          setDropdownOptions([]);
                        }}
                        size="sm"
                        style={{ flexShrink: 0 }}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    )}

                    {/* Fixed-width box for loader or search icon */}
                    <Box
                      style={{
                        width: 26,
                        height: 26,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isDropdownLoading || isSearchLoading ? (
                        <Loader size="xs" />
                      ) : (
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={handleSearch}
                          size="sm"
                        >
                          <IconSearch size={16} />
                        </ActionIcon>
                      )}
                    </Box>
                  </Group>
                }
                limit={10}
                maxDropdownHeight={280}
              />
            </Group>
          </Group>
        )}
      </Group>

      {/* Main Dashboard Content */}
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || "overall")}
        styles={{
          list: {
            display: "none",
          },
        }}
      >
        <Tabs.List style={{ display: "none" }}>
          <Tabs.Tab value="overall">Overall</Tabs.Tab>
          <Tabs.Tab value="pipeline-Report">Pipeline Report</Tabs.Tab>
          <Tabs.Tab value="booking">Booking</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overall" pt="sm">
          {showDetailedView ? (
            <DetailedViewTable
              data={detailedViewData}
              title={(() => {
                // For budget type, use title as-is without appending drill level name
                if (detailedViewType === "budget") {
                  return detailedViewTitle;
                }
                // For other types, append drill level display name
                if (detailedViewDrillLevel === 0) return detailedViewTitle;
                const displayName = getDrillLevelDisplayName();
                return displayName
                  ? `${detailedViewTitle} - ${displayName}`
                  : detailedViewTitle;
              })()}
              onClose={handleCloseDetailedView}
              loading={isLoadingDetailedView}
              moduleType={detailedViewType || undefined}
              drillLevel={detailedViewDrillLevel}
              totalRecords={
                detailedViewType === "customerNotVisited"
                  ? customerNotVisitedTotalRecords
                  : detailedViewType === "lostCustomer"
                    ? lostCustomerTotalRecords
                    : detailedViewType === "newCustomer"
                      ? newCustomerTotalRecords
                      : undefined
              }
              onPaginationChange={
                detailedViewType === "customerNotVisited"
                  ? handleCustomerNotVisitedPaginationChange
                  : undefined
              }
              onColumnClick={handleDetailedViewColumnClick}
              onBack={handleDetailedViewBack}
              initialSearch={detailedViewSearch}
              onSearchChange={handleDetailedViewSearchChange}
              showBackButton={
                detailedViewDrillLevel > 1 ||
                (detailedViewDrillLevel > 0 &&
                  (detailedViewType === "lostCustomer" ||
                    detailedViewType === "newCustomer" ||
                    detailedViewType === "callentry" ||
                    detailedViewType === "customerNotVisited"))
              }
              headerActions={
                // Commented out - can be used in future case
                // Period filter is now common at top level
                undefined
              }
            />
          ) : (
            <Box>
              {/* Section 1 & 2: Customer Interaction Status and Enquiry (side by side) */}
              <Grid mb="lg">
                <Grid.Col span={6}>
                  <CustomerInteractionStatus
                    data={customerInteractionData}
                    loading={isLoadingCustomerInteraction}
                    customerInteractionPeriod={customerInteractionPeriod}
                    setCustomerInteractionPeriod={
                      () => {} // Commented out - can be used in future case
                    }
                    fromDate={customerInteractionFromDate}
                    toDate={customerInteractionToDate}
                    setFromDate={setCustomerInteractionFromDate}
                    setToDate={setCustomerInteractionToDate}
                    // Date filter is now common at top level, so hide it here
                    hideDateFilter={true}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <EnquirySection
                    enquiryConversionAggregatedData={
                      enquiryConversionAggregatedData
                    }
                    isLoadingEnquiryConversion={isLoadingEnquiryConversion}
                    isLoadingEnquiryChart={isLoadingEnquiryChart}
                    enquiryView={enquiryView}
                    setEnquiryView={setEnquiryView}
                    handleEnquiryConversionViewAll={
                      handleEnquiryConversionViewAll
                    }
                    selectedPeriod={enquiryPeriod}
                    setSelectedPeriod={
                      () => {} // Commented out - can be used in future case
                    }
                    fromDate={customerInteractionFromDate}
                    toDate={customerInteractionToDate}
                    setFromDate={setCustomerInteractionFromDate}
                    setToDate={setCustomerInteractionToDate}
                    // Date filter is now common at top level, so hide it here
                    hideDateFilter={true}
                  />
                </Grid.Col>
              </Grid>

              {/* Section 3 & 4: Outstanding and Call Entry (side by side) */}
              <Grid mb="lg">
                <Grid.Col span={8}>
                  <OutstandingSection
                    drillLevel={drillLevel}
                    selectedMetric={selectedMetric}
                    companySummary={companySummary}
                    locationData={locationData}
                    salespersonData={salespersonData}
                    selectedCompanyCtx={selectedCompanyCtx}
                    selectedCompany={selectedCompany}
                    selectedLocation={selectedLocation}
                    contextTotals={contextTotals}
                    hoverTotals={hoverTotals}
                    isLoadingOutstandingChart={isLoadingOutstandingChart}
                    handleOutstandingViewAll={handleOutstandingViewAll}
                    handleBack={handleBack}
                    handlePieClick={handlePieClick}
                    outstandingPeriod={outstandingPeriod}
                    setOutstandingPeriod={setOutstandingPeriod}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <CallEntrySection
                    callEntrySummary={callEntrySummary}
                    isLoadingCallEntry={isLoadingCallEntry}
                    handleCallEntryViewAll={handleCallEntryViewAll}
                    selectedPeriod={callEntryPeriod}
                    setSelectedPeriod={
                      () => {} // Commented out - can be used in future case
                    }
                    fromDate={customerInteractionFromDate}
                    toDate={customerInteractionToDate}
                    setFromDate={setCustomerInteractionFromDate}
                    setToDate={setCustomerInteractionToDate}
                    // Date filter is now common at top level, so hide it here
                    hideDateFilter={true}
                  />
                </Grid.Col>
              </Grid>

              {/* Section 5: Budget vs Actual */}
              <BudgetSection
                budgetDrillLevel={budgetDrillLevel}
                budgetSelectedCompany={budgetSelectedCompany}
                budgetSelectedSalesperson={budgetSelectedSalesperson}
                budgetDateRange={budgetDateRange}
                budgetWindowStart={budgetWindowStart}
                budgetRawData={budgetRawData}
                budgetAggregatedData={budgetAggregatedData}
                budgetHoverTotals={budgetHoverTotals}
                isLoadingBudget={isLoadingBudget}
                budgetStartMonth={budgetStartMonth}
                budgetEndMonth={budgetEndMonth}
                budgetType={budgetType}
                selectedYear={selectedYear}
                fromMonthOptions={fromMonthOptions}
                toMonthOptions={toMonthOptions}
                setBudgetDrillLevel={setBudgetDrillLevel}
                setBudgetSelectedCompany={setBudgetSelectedCompany}
                setBudgetSelectedSalesperson={setBudgetSelectedSalesperson}
                setBudgetWindowStart={setBudgetWindowStart}
                setBudgetRawData={setBudgetRawData}
                setBudgetAggregatedData={setBudgetAggregatedData}
                setSearchSalesman={setSearchSalesman}
                setSelectedCompany={setSelectedCompany}
                setIsLoadingBudget={setIsLoadingBudget}
                setBudgetType={setBudgetType}
                setSelectedYear={setSelectedYear}
                handleBudgetViewAll={handleBudgetViewAll}
                handleBudgetBarClick={handleBudgetBarClick}
                handleBudgetTypeChange={handleBudgetTypeChange}
                handleBudgetMonthFilterChange={handleBudgetMonthFilterChange}
              />
            </Box>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="pipeline-Report" pt="md">
          <PipelineReport
            key={tabsRefreshKey}
            initialState={pipelineReportState || undefined}
            globalSearch={globalSearch}
            fromDate={customerInteractionFromDate}
            toDate={customerInteractionToDate}
          />
        </Tabs.Panel>

        <Tabs.Panel value="booking" pt="md">
          <Booking
            key={tabsRefreshKey}
            globalSearch={globalSearch}
            fromDate={customerInteractionFromDate}
            toDate={customerInteractionToDate}
          />
        </Tabs.Panel>
      </Tabs>

      {/* Send Email Modal */}
      <Modal
        opened={sendEmailOpened}
        onClose={() => {
          closeSendEmail();
          setEmailErrors({ to_email: "", cc_email: "" });
          setCurrentEmailData(null);
        }}
        title={
          <Text size="lg" fw={600} c="#105476">
            {detailedViewType === "enquiry"
              ? "Send Email - Enquiry Conversion"
              : "Send Email - Outstanding Details"}
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

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={() => {
                closeSendEmail();
                setEmailErrors({ to_email: "", cc_email: "" });
                setCurrentEmailData(null);
              }}
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
    </Box>
  );
};

export default Dashboard;
