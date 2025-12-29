import { getAPICall } from "./getApiCall";
import { postAPICall } from "./postApiCall";
import { URL } from "../api/serverUrls";
import { API_HEADER } from "../store/storeKeys";
import dayjs from "dayjs";
import { apiCallProtected } from "../api/axios";

/**
 * Dashboard Service
 *
 * API Endpoints:
 * 1. POST /local-outstanding/salesman-summary/ - Gets filtered outstanding data
 * 2. GET /accounts/salespersons/ - Gets list of salespersons for filters
 *
 * Usage:
 * - POST API: Used for all outstanding data requests (initial load and filtered views)
 */

export interface OutstandingDataItem {
  company_name: string;
  branch_code: string;
  currency: string;
  total_salesperson: string;
  total_outstanding: string;
  total_overdue: string;
  locations: string[];
}

export interface OutstandingSummaryResponse {
  success: boolean;
  message: string;
  data: OutstandingDataItem[];
  total: number;
  index: number;
  limit: number | null;
  searchterm: string | null;
}

export interface SalesmanOutstandingData {
  salesman_name: string;
  customer_name?: string;
  location: string;
  outstanding: string;
  overdue: string;
  days_0_15: string;
  days_16_30: string;
  days_31_45: string;
  days_46_60: string;
  days_61_90: string;
  days_91_120: string;
  days_121_180: string;
  days_181_365: string;
  days_366_730: string;
  days_730: string;
}

export interface LocationData {
  location: string;
  outstanding_data: SalesmanOutstandingData[];
  summary?: {
    total: number | string;
    total_outstanding: string;
    total_overdue: string;
  };
}

export interface FilteredOutstandingResponse {
  success: boolean;
  message: string;
  data: LocationData[];
  summary: {
    total: string | number;
    local_outstanding?: string; // backward compat
    total_outstanding?: string; // new
    total_overdue: string;
  };
  total: number;
  index: number;
  limit: number | null;
  branch_code: string;
  company_name: string;
  location: string;
  filter_type?: string;
  applied_filters?: Record<string, any>;
}

export interface DashboardFilters {
  company?: string;
  location?: string;
  salesman?: string;
  salesperson?: string;
  year?: number;
  month?: number;
  date_from?: string;
  date_to?: string;
  start_month?: string;
  end_month?: string;
  type?: "salesperson" | "non-salesperson";
  search?: string;
}

export interface CallEntryItem {
  customer_name: string;
  customer_code: string;
  call_date: string;
  call_mode_name: string;
  call_summary: string;
  followup_date: string;
  followup_action_name: string;
  latitude: string | null;
  longitude: string | null;
  salesman: string | null;
  created_by_name: string;
}

export interface CallEntryResponse {
  total: number;
  index: number;
  limit: number | null;
  results: CallEntryItem[];
}

export interface CallEntryAggregatedData {
  overdueCount: number;
  todayCallsCount: number;
  upcomingCount: number;
  totalCalls: number;
}

// New Call Entry Statistics API interfaces
export interface CallEntrySalespersonData {
  salesperson: string;
  total_overdue: number;
  total_today: number;
  total_upcoming: number;
  total_closed: number;
  total_calls: number;
  salesperson_email: string;
  cc_mail: string[];
}

export interface CallEntryCustomerData {
  customer_code: string;
  customer_name: string;
  total_calls: number;
  total_overdue: number;
  total_today: number;
  total_upcoming: number;
  total_closed: number;
}

export interface CallEntryDetailData {
  customer_code: string;
  customer_name: string;
  call_entry_id: number;
  call_date: string;
  call_mode_id: number;
  call_mode_name: string;
  followup_action_id: number;
  followup_action_name: string;
  call_summary: string;
  followup_date: string;
  latitude: number;
  longitude: number;
  salesman: string | null;
  expected_profit: number;
  branch_code: string;
  company_code: string;
  created_by_name: string;
}

export interface CallEntryStatisticsSummary {
  total_sales_persons?: number;
  total_customers?: number;
  total_overdue: number;
  total_today: number;
  total_upcoming: number;
  total_closed: number;
  total_calls: number;
}

export interface CallEntryStatisticsResponse {
  success: boolean;
  message: string;
  index: number;
  limit: number | null;
  company_code: string;
  company_name: string;
  salesperson?: string;
  customer_code?: string;
  type: string | null;
  date: string | null;
  date_from: string;
  date_to: string;
  total_customers?: number;
  salesperson_email?: string;
  cc_mail?: string[];
  data:
    | CallEntrySalespersonData[]
    | CallEntryCustomerData[]
    | CallEntryDetailData[];
  summary: CallEntryStatisticsSummary;
}

export interface CallEntryStatisticsFilters {
  company: string;
  salesperson?: string;
  customer_code?: string;
  type?: "overdue" | "today" | "upcoming" | "closed";
  date_from: string;
  date_to: string;
  search?: string;
}

export interface EnquiryDataItem {
  company_name: string;
  total_enquiry_count: number;
  total_active: number;
  total_gain: number;
  total_lost: number;
  total_quote_created: number;
}

export interface EnquiryLocationData {
  Location: string;
  Enquiry_data: EnquiryDataItem[];
}

export interface EnquiryConversionResponse {
  success: boolean;
  message: string;
  total: number;
  index: number;
  limit: number | null;
  search_term: string | null;
  data: EnquiryLocationData[];
}

export interface EnquiryFilteredResponse {
  success: boolean;
  message: string;
  total: number;
  index: number;
  limit: number | null;
  company?: string;
  salesperson?: string;
  data: Array<{
    salesperson?: string;
    customer_code?: string;
    customer_name?: string;
    active: number;
    gained: number;
    lost: number;
    quote_created: number;
  }>;
}

export interface EnquiryConversionAggregatedData {
  totalGain: number;
  totalLost: number;
  totalActive: number;
  totalQuoteCreated: number;
  totalEnquiries: number;
  gainPercentage: number;
  lossPercentage: number;
  activePercentage: number;
  quotePercentage: number;
}

// Budget interfaces
export interface BudgetDataItem {
  salesperson?: string;
  month?: string;
  actual_budget: number;
  sales_budget: number;
}

export interface BudgetLocationData {
  company_name: string;
  salesperson?: string;
  date_range: string;
  budget: BudgetDataItem[];
  summary?: BudgetSummary;
}

export interface BudgetSummary {
  total: number;
  total_actual_budget: number;
  total_sales_budget: number;
}

export interface BudgetResponse {
  success: boolean;
  message: string;
  data: BudgetLocationData[];
}

export interface BudgetAggregatedData {
  totalActualBudget: number;
  totalSalesBudget: number;
}

// Get filtered outstanding data
export const getFilteredOutstandingData = async (
  filters: DashboardFilters
): Promise<FilteredOutstandingResponse> => {
  try {
    const response = await postAPICall(
      URL.dashboard.outstandingSummary,
      filters
    );
    console.log("response filtered outstanding data :", response);
    return response as FilteredOutstandingResponse;
  } catch (error) {
    console.error("Error fetching filtered outstanding data:", error);
    throw error;
  }
};

// Get salespersons list for filter dropdown
export const getSalespersons = async (): Promise<any> => {
  try {
    const response = await getAPICall(URL.salespersons);
    return response as any;
  } catch (error) {
    console.error("Error fetching salespersons:", error);
    throw error;
  }
};

// Calculate aggregated data for pie chart
export const calculateAggregatedData = (data: OutstandingDataItem[]) => {
  const totalOutstanding = data.reduce(
    (sum, item) => sum + parseFloat(item.total_outstanding),
    0
  );
  const totalOverdue = data.reduce(
    (sum, item) => sum + parseFloat(item.total_overdue),
    0
  );

  return {
    companies: data.length,
    totalSalespersons: data.reduce(
      (sum, item) => sum + parseInt(item.total_salesperson),
      0
    ),
    totalOutstanding,
    totalOverdue,
  };
};

// Calculate aggregated data for filtered response (different structure)
export const calculateFilteredAggregatedData = (response: any) => {
  console.log("Processing filtered response:", response);

  if (response?.summary) {
    // Use summary data if available
    const totalOutstanding = parseFloat(
      response.summary.total_outstanding ||
        response.summary.local_outstanding ||
        "0"
    );
    const totalOverdue = response.summary.total_overdue;
    const totalSalespersons = parseInt(
      (response.summary.total || response.summary.TOTAL || "0").toString()
    );

    return {
      companies: 1, // Filtered by specific company
      totalSalespersons,
      totalOutstanding,
      totalOverdue,
    };
  }

  if (response?.data && Array.isArray(response.data)) {
    // Process nested location data structure
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let totalSalespersons = 0;

    response.data.forEach((locationData: any) => {
      const list =
        locationData.outstanding_data || locationData.Salesman_outstanding_data;
      if (list && Array.isArray(list)) {
        list.forEach((salesman: any) => {
          totalOutstanding += parseFloat(salesman.local_outstanding || "0");
          totalOverdue += parseFloat(salesman.overdue || "0");
          totalSalespersons += 1;
        });
      }
    });

    return {
      companies: 1,
      totalSalespersons,
      totalOutstanding,
      totalOverdue,
    };
  }

  console.warn("Unable to process filtered response structure");
  return {
    totalOutstanding: 0,
    totalOverdue: 0,
    companies: 0,
    totalSalespersons: 0,
  };
};

/**
 * Get call entry data
 */
export const getCallEntryData = async (): Promise<CallEntryResponse> => {
  try {
    const response = await getAPICall(URL.callEntry, API_HEADER);
    console.log("Call Entry API Response:", response);
    return response as CallEntryResponse;
  } catch (error) {
    console.error("Error fetching call entry data:", error);
    throw error;
  }
};

/**
 * Get call entry statistics with filters
 */
export const getCallEntryStatistics = async (
  filters: CallEntryStatisticsFilters
): Promise<CallEntryStatisticsResponse> => {
  try {
    const payload = {
      company: filters.company,
      date_from: filters.date_from,
      date_to: filters.date_to,
      ...(filters.salesperson && { salesperson: filters.salesperson }),
      ...(filters.customer_code && { customer_code: filters.customer_code }),
      ...(filters.type && { type: filters.type }),
      ...(filters.search && { search: filters.search }),
    };

    const response = await postAPICall(
      URL.dashboard.callEntryStatistics,
      payload
    );
    return response as CallEntryStatisticsResponse;
  } catch (error) {
    console.error("Error fetching call entry statistics:", error);
    throw error;
  }
};

/**
 * Calculate date range based on period selection
 */
export const calculateCallEntryDateRange = (
  period: string
): { date_from: string; date_to: string } => {
  const today = dayjs();
  let date_from: string;
  let date_to: string;

  switch (period) {
    case "weekly": {
      // Last fully completed week (Mon-Sun)
      // Get today's day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const dayOfWeek = today.day();

      let lastSunday: dayjs.Dayjs;
      let lastMonday: dayjs.Dayjs;

      if (dayOfWeek === 1) {
        // If today is Monday, last week's Sunday is yesterday (1 day ago)
        lastSunday = today.subtract(1, "day");
      } else if (dayOfWeek === 0) {
        // If today is Sunday, last week's Sunday is 7 days ago (previous Sunday)
        // This gives us the week that ended before the current week
        lastSunday = today.subtract(7, "day");
      } else {
        // If today is Tuesday-Saturday, last week's Sunday is (dayOfWeek) days ago
        lastSunday = today.subtract(dayOfWeek, "day");
      }

      // Last week's Monday is 6 days before last week's Sunday
      lastMonday = lastSunday.subtract(6, "day");

      date_from = lastMonday.format("DD-MM-YYYY");
      date_to = lastSunday.format("DD-MM-YYYY");
      break;
    }
    case "current_month": {
      // From 1st of current month to today
      date_from = today.startOf("month").format("DD-MM-YYYY");
      date_to = today.format("DD-MM-YYYY");
      break;
    }
    case "last_month": {
      // Full previous month
      const lastMonth = today.subtract(1, "month");
      date_from = lastMonth.startOf("month").format("DD-MM-YYYY");
      date_to = lastMonth.endOf("month").format("DD-MM-YYYY");
      break;
    }
    case "last_3_months": {
      // Last 3 fully completed months
      const currentMonth = today.month(); // 0-indexed
      const currentYear = today.year();

      // Calculate 3 months before current month
      let endMonth = currentMonth - 1; // Previous month
      let endYear = currentYear;

      if (endMonth < 0) {
        endMonth = 11; // December
        endYear = currentYear - 1;
      }

      // Start month is 3 months before end month
      let startMonth = endMonth - 2;
      let startYear = endYear;

      if (startMonth < 0) {
        startMonth = startMonth + 12;
        startYear = endYear - 1;
      }

      const startDate = dayjs()
        .year(startYear)
        .month(startMonth)
        .startOf("month");
      const endDate = dayjs().year(endYear).month(endMonth).endOf("month");

      date_from = startDate.format("DD-MM-YYYY");
      date_to = endDate.format("DD-MM-YYYY");
      break;
    }
    case "last_6_months": {
      // Last 6 fully completed months
      const currentMonth = today.month();
      const currentYear = today.year();

      let endMonth = currentMonth - 1;
      let endYear = currentYear;

      if (endMonth < 0) {
        endMonth = 11;
        endYear = currentYear - 1;
      }

      let startMonth = endMonth - 5;
      let startYear = endYear;

      if (startMonth < 0) {
        startMonth = startMonth + 12;
        startYear = endYear - 1;
      }

      const startDate = dayjs()
        .year(startYear)
        .month(startMonth)
        .startOf("month");
      const endDate = dayjs().year(endYear).month(endMonth).endOf("month");

      date_from = startDate.format("DD-MM-YYYY");
      date_to = endDate.format("DD-MM-YYYY");
      break;
    }
    case "last_year": {
      // Last 12 fully completed months
      const currentMonth = today.month();
      const currentYear = today.year();

      let endMonth = currentMonth - 1;
      let endYear = currentYear;

      if (endMonth < 0) {
        endMonth = 11;
        endYear = currentYear - 1;
      }

      let startMonth = endMonth - 11;
      let startYear = endYear;

      if (startMonth < 0) {
        startMonth = startMonth + 12;
        startYear = endYear - 1;
      }

      const startDate = dayjs()
        .year(startYear)
        .month(startMonth)
        .startOf("month");
      const endDate = dayjs().year(endYear).month(endMonth).endOf("month");

      date_from = startDate.format("DD-MM-YYYY");
      date_to = endDate.format("DD-MM-YYYY");
      break;
    }
    default: {
      // Default to last 3 months
      const currentMonth = today.month();
      const currentYear = today.year();

      let endMonth = currentMonth - 1;
      let endYear = currentYear;

      if (endMonth < 0) {
        endMonth = 11;
        endYear = currentYear - 1;
      }

      let startMonth = endMonth - 2;
      let startYear = endYear;

      if (startMonth < 0) {
        startMonth = startMonth + 12;
        startYear = endYear - 1;
      }

      const startDate = dayjs()
        .year(startYear)
        .month(startMonth)
        .startOf("month");
      const endDate = dayjs().year(endYear).month(endMonth).endOf("month");

      date_from = startDate.format("DD-MM-YYYY");
      date_to = endDate.format("DD-MM-YYYY");
    }
  }

  return { date_from, date_to };
};

/**
 * Calculate aggregated call entry data based on followup_date
 */
export const calculateCallEntryAggregatedData = (
  callEntryData: CallEntryItem[]
): CallEntryAggregatedData => {
  const today = dayjs().format("YYYY-MM-DD");

  let overdueCount = 0;
  let todayCallsCount = 0;
  let upcomingCount = 0;

  callEntryData.forEach((item) => {
    const followupDate = dayjs(item.followup_date).format("YYYY-MM-DD");

    if (followupDate < today) {
      overdueCount++;
    } else if (followupDate === today) {
      todayCallsCount++;
    } else {
      upcomingCount++;
    }
  });

  return {
    overdueCount,
    todayCallsCount,
    upcomingCount,
    totalCalls: callEntryData.length,
  };
};

/**
 * Filter call entry data based on dashboard filters
 */
export const filterCallEntryData = (
  callEntryData: CallEntryItem[],
  filters: DashboardFilters
): CallEntryItem[] => {
  return callEntryData.filter((item) => {
    // Filter by company (using created_by_name as company proxy)
    if (
      filters.company &&
      !item.created_by_name
        ?.toLowerCase()
        .includes(filters.company.toLowerCase())
    ) {
      return false;
    }

    // Filter by location (using customer_name as location proxy since we don't have location field)
    if (
      filters.location &&
      !item.customer_name
        ?.toLowerCase()
        .includes(filters.location.toLowerCase())
    ) {
      return false;
    }

    // Filter by salesman (using created_by_name field)
    if (
      filters.salesman &&
      item.created_by_name &&
      !item.created_by_name
        .toLowerCase()
        .includes(filters.salesman.toLowerCase())
    ) {
      return false;
    }

    // Filter by year
    if (filters.year) {
      const callYear = dayjs(item.call_date).year();
      if (callYear !== filters.year) {
        return false;
      }
    }

    // Filter by month
    if (filters.month) {
      const callMonth = dayjs(item.call_date).month() + 1; // dayjs months are 0-indexed
      if (callMonth !== filters.month) {
        return false;
      }
    }

    // Filter by date range
    if (filters.date_from && filters.date_to) {
      const callDate = dayjs(item.call_date).format("YYYY-MM-DD");
      if (callDate < filters.date_from || callDate > filters.date_to) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Get enquiry conversion data (initial load)
 */
export const getEnquiryConversionData =
  async (): Promise<EnquiryConversionResponse> => {
    try {
      const response = await getAPICall(
        URL.dashboard.enquiryConversion,
        API_HEADER
      );
      console.log("Enquiry Conversion API Response:", response);
      return response as EnquiryConversionResponse;
    } catch (error) {
      console.error("Error fetching enquiry conversion data:", error);
      throw error;
    }
  };

/**
 * Get filtered enquiry conversion data (POST with filters)
 */
export const getFilteredEnquiryConversionData = async (
  filters: DashboardFilters
): Promise<EnquiryFilteredResponse> => {
  try {
    const payload = {
      ...(filters.company && { company: filters.company }),
      ...(filters.location && { location: filters.location }),
      ...(filters.salesman && { salesperson: filters.salesman }),
      ...(filters.date_from && { date_from: filters.date_from }),
      ...(filters.date_to && { date_to: filters.date_to }),
      ...(filters.search && { search: filters.search }),
      ...(filters.type && { type: filters.type }),
    };

    console.log("Enquiry Conversion Filter Payload:", payload);
    const response = await postAPICall(
      URL.dashboard.enquiryConversion,
      payload,
      API_HEADER
    );
    console.log("Filtered Enquiry Conversion Response:", response);
    return response as EnquiryFilteredResponse;
  } catch (error) {
    console.error("Error fetching filtered enquiry conversion data:", error);
    throw error;
  }
};

/**
 * Helper function to extract numeric value from number or string format like "1 (50.00%)"
 */
export const extractNumericValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  
  // If it's already a number, return it
  if (typeof value === "number") return value;
  
  // If it's a string, extract the number before the parenthesis
  if (typeof value === "string") {
    // Split by space and take the first part (before the parenthesis)
    const parts = value.trim().split(" ");
    if (parts.length > 0) {
      const numericPart = parts[0];
      const parsed = parseFloat(numericPart);
      return isNaN(parsed) ? 0 : parsed;
    }
  }
  
  return 0;
};

/**
 * Calculate aggregated enquiry conversion data from initial response
 */
export const calculateEnquiryConversionAggregatedData = (
  response: EnquiryConversionResponse
): EnquiryConversionAggregatedData => {
  let totalGain = 0;
  let totalLost = 0;
  let totalActive = 0;
  let totalQuoteCreated = 0;
  let totalEnquiries = 0;

  if (response.data && Array.isArray(response.data)) {
    response.data.forEach((locationData) => {
      if (
        locationData.Enquiry_data &&
        Array.isArray(locationData.Enquiry_data)
      ) {
        locationData.Enquiry_data.forEach((enquiryData) => {
          totalGain += extractNumericValue(enquiryData.total_gain);
          totalLost += extractNumericValue(enquiryData.total_lost);
          totalActive += extractNumericValue(enquiryData.total_active);
          totalQuoteCreated += extractNumericValue(enquiryData.total_quote_created);
          totalEnquiries += extractNumericValue(enquiryData.total_enquiry_count);
        });
      }
    });
  }
  console.log("total ENquiry-------------------",totalEnquiries)

  const gainPercentage =
    totalEnquiries > 0 ? (totalGain / totalEnquiries) * 100 : 0;
  const lossPercentage =
    totalEnquiries > 0 ? (totalLost / totalEnquiries) * 100 : 0;
  const activePercentage =
    totalEnquiries > 0 ? (totalActive / totalEnquiries) * 100 : 0;
  const quotePercentage =
    totalEnquiries > 0 ? (totalQuoteCreated / totalEnquiries) * 100 : 0;

  return {
    totalGain,
    totalLost,
    totalActive,
    totalQuoteCreated,
    totalEnquiries,
    gainPercentage: Math.round(gainPercentage), // Round to whole number
    lossPercentage: Math.round(lossPercentage), // Round to whole number
    activePercentage: Math.round(activePercentage), // Round to whole number
    quotePercentage: Math.round(quotePercentage), // Round to whole number
  };
};

/**
 * Calculate aggregated enquiry conversion data from filtered response
 */
export const calculateFilteredEnquiryConversionAggregatedData = (
  response: EnquiryFilteredResponse
): EnquiryConversionAggregatedData => {
  let totalGain = 0;
  let totalLost = 0;
  let totalActive = 0;
  let totalQuoteCreated = 0;
  let totalEnquiries = 0;

  if (response.data && Array.isArray(response.data)) {
    response.data.forEach((item) => {
      const gained = extractNumericValue(item.gained);
      const lost = extractNumericValue(item.lost);
      const active = extractNumericValue(item.active);
      const quoteCreated = extractNumericValue(item.quote_created);
      
      totalGain += gained;
      totalLost += lost;
      totalActive += active;
      totalQuoteCreated += quoteCreated;
      
      // Calculate totalEnquiries: use total_enquiry if available, otherwise sum components
      const totalEnquiry = (item as any).total_enquiry;
      if (totalEnquiry !== undefined && totalEnquiry !== null) {
        totalEnquiries += extractNumericValue(totalEnquiry);
      } else {
        // Calculate from sum of components if total_enquiry is not provided
        totalEnquiries += gained + lost + active + quoteCreated;
      }
    });
  }
  console.log("total-enquiries---------------------",totalEnquiries)

  const gainPercentage =
    totalEnquiries > 0 ? (totalGain / totalEnquiries) * 100 : 0;
  const lossPercentage =
    totalEnquiries > 0 ? (totalLost / totalEnquiries) * 100 : 0;
  const activePercentage =
    totalEnquiries > 0 ? (totalActive / totalEnquiries) * 100 : 0;
  const quotePercentage =
    totalEnquiries > 0 ? (totalQuoteCreated / totalEnquiries) * 100 : 0;

  return {
    totalGain,
    totalLost,
    totalActive,
    totalQuoteCreated,
    totalEnquiries,
    gainPercentage: Math.round(gainPercentage), // Round to whole number
    lossPercentage: Math.round(lossPercentage), // Round to whole number
    activePercentage: Math.round(activePercentage), // Round to whole number
    quotePercentage: Math.round(quotePercentage), // Round to whole number
  };
};

// Budget API functions
export const getBudgetSummary = async (): Promise<BudgetResponse> => {
  try {
    const response = await getAPICall(URL.dashboard.budgetSummary, API_HEADER);
    console.log("Budget summary response:", response);
    return response as BudgetResponse;
  } catch (error) {
    console.error("Error fetching budget summary:", error);
    throw error;
  }
};

export const getFilteredBudgetData = async (
  filters: DashboardFilters
): Promise<BudgetResponse> => {
  try {
    const payload: any = {};
    if (filters.type) payload.type = filters.type;
    if (filters.company) payload.company = filters.company;
    if (filters.location) payload.location = filters.location;
    if (filters.salesman) payload.salesperson = filters.salesman;
    if (filters.year && filters.month) {
      payload.month = `${filters.year}-${filters.month.toString().padStart(2, "0")}`;
    }
    // Add start_month and end_month to payload
    if (filters.start_month) payload.start_month = filters.start_month;
    if (filters.end_month) {
      // Convert end_month to previous month for API call
      const endMonthDate = dayjs(filters.end_month);
      const previousMonth = endMonthDate.format("YYYY-MM");
      payload.end_month = previousMonth;
    }
    // Add search parameter
    if (filters.search) payload.search = filters.search;

    console.log("Budget filter payload:", payload);
    const response = await postAPICall(URL.dashboard.budgetSummary, payload);
    console.log("Filtered budget response:", response);
    return response as BudgetResponse;
  } catch (error) {
    console.error("Error fetching filtered budget data:", error);
    throw error;
  }
};

export const calculateBudgetAggregatedData = (
  response: BudgetResponse
): BudgetAggregatedData => {
  let totalActualBudget = 0;
  let totalSalesBudget = 0;

  if (response.data && Array.isArray(response.data)) {
    // Check if any item has a summary (filtered response)
    const itemWithSummary = response.data.find((item) => item.summary);

    if (itemWithSummary && itemWithSummary.summary) {
      // Use summary from filtered response
      console.log(
        "Using summary from filtered budget response:",
        itemWithSummary.summary
      );
      return {
        totalActualBudget: itemWithSummary.summary.total_actual_budget || 0,
        totalSalesBudget: itemWithSummary.summary.total_sales_budget || 0,
      };
    } else {
      // Calculate from individual budget items (GET response)
      response.data.forEach((locationData) => {
        if (locationData.budget && Array.isArray(locationData.budget)) {
          locationData.budget.forEach((budgetData) => {
            totalActualBudget += budgetData.actual_budget || 0;
            totalSalesBudget += budgetData.sales_budget || 0;
          });
        }
      });
    }
  }

  return {
    totalActualBudget,
    totalSalesBudget,
  };
};

// Customer Not Visited interfaces

// Level 1: Company level
export interface CustomerNotVisitedCompany {
  company_code: string;
  company_name: string;
  total: number;
}

// Level 2: Salesperson level
export interface CustomerNotVisitedCustomerItem {
  customer_code: string;
  customer_name: string;
}

export interface CustomerNotVisitedSalesperson {
  salesperson: string;
  customers: CustomerNotVisitedCustomerItem[];
  count: number;
}

// Level 3: Customer level
export interface CustomerNotVisitedCustomerDetail {
  id: number;
  customer_code: string;
  customer_name: string;
  salesperson: string;
  company_code: string;
  company_name: string;
  branch_code: string;
  branch_name: string;
  term_code: string;
  status: string;
  last_date: string | null;
}

export interface CustomerNotVisitedResponse {
  success: boolean;
  message: string;
  period: string;
  start_date: string;
  end_date: string;
  index: number;
  limit: number;
  pagination_total: number;
  data:
    | CustomerNotVisitedCompany[]
    | CustomerNotVisitedSalesperson[]
    | CustomerNotVisitedCustomerDetail[];
  summary: {
    total?: number; // Level 3
    total_customer_count?: number; // Level 1 & 2
    total_company_count?: number; // Level 1
    total_salesperson_count?: number; // Level 2
  };
}

export interface CustomerNotVisitedFilters {
  company?: string;
  salesperson?: string;
  period?: string;
  index?: number;
  limit?: number;
  search?: string;
}

// Get Customer Not Visited data
export const getCustomerNotVisitedData = async (
  filters: CustomerNotVisitedFilters = {}
): Promise<CustomerNotVisitedResponse> => {
  try {
    const payload: any = {};

    if (filters.company) payload.company = filters.company;
    if (filters.salesperson) payload.salesperson = filters.salesperson;
    if (filters.period) payload.period = filters.period;
    if (filters.search) payload.search = filters.search;

    // Build URL with query params
    const queryParams = new URLSearchParams();
    queryParams.append("index", (filters.index || 0).toString());
    queryParams.append("limit", (filters.limit || 10).toString());

    const url = `${URL.dashboard.customerNotVisited}?${queryParams.toString()}`;

    console.log("Customer Not Visited API URL:", url);
    console.log("Customer Not Visited API Payload:", payload);

    const response = await postAPICall(url, payload);
    console.log("Customer Not Visited API Response:", response);
    return response as CustomerNotVisitedResponse;
  } catch (error) {
    console.error("Error fetching customer not visited data:", error);
    throw error;
  }
};

// New Customer interfaces
export interface NewCustomerItem {
  customer_name: string;
  customer_code: string;
  job_date: string;
}

export interface NewCustomerSalesperson {
  user_name: string;
  email: string;
  branch_code: string;
  customer_count: number;
  customers: NewCustomerItem[];
}

export interface NewCustomerResponse {
  success: boolean;
  message: string;
  company: string;
  period: string;
  current_period_start: string;
  current_period_end: string;
  previous_period_start: string;
  total_salespersons: number;
  data: NewCustomerSalesperson[];
}

export interface NewCustomerFilters {
  company: string;
  period: string;
  search?: string;
}

// Get New Customer data
export const getNewCustomerData = async (
  filters: NewCustomerFilters
): Promise<NewCustomerResponse> => {
  try {
    const url = `${URL.dashboard.newCustomerShipment}/get_new_customers/`;
    const payload: any = {
      company: filters.company,
      period: filters.period,
      ...(filters.search && { search: filters.search }),
    };
    console.log("New Customer API URL:", url);
    console.log("New Customer API Payload:", payload);

    const response = await postAPICall(url, payload);
    console.log("New Customer API Response:", response);
    return response as NewCustomerResponse;
  } catch (error) {
    console.error("Error fetching new customer data:", error);
    throw error;
  }
};

// Pipeline Report API interfaces
export interface PipelineReportItem {
  salesperson: string;
  total_profit: number;
  quoted_profit: number;
  gained_profit: number;
  lost_profit: number;
  expected_profit: number;
  potential_profit: number;
  pipeline_profit: number;
}

export interface PipelineReportCustomerItem {
  customer_code: string;
  customer_name: string;
  expected_profit: number;
  potential_profit: number;
  pipeline_profit: number;
  quoted_created: number;
  gained: number;
  lost: number; // API returns 'lost' not 'lost_profit' at customer level
}

export interface PipelineReportSummary {
  total_expected: number;
  total_potential: number;
  total_pipeline: number;
  total_quoted: number;
  total_gained: number;
  total_lost: number;
}

export interface PipelineReportResponse {
  success: boolean;
  message: string;
  index: number;
  limit: number | null;
  total: number;
  total_profit: number;
  data: PipelineReportItem[] | PipelineReportCustomerItem[];
  summary?: PipelineReportSummary;
}

export interface PipelineReportFilters {
  company: string;
  salesperson?: string;
  type?: string;
  customer_code?: string;
  period?: string;
  region?: string;
  service?: string;
  service_type?: string;
  search?: string;
  calculation?: "volume" | "no_of_shipments";
}

// Sector-wise Pipeline Report interfaces (formerly Regional)
export interface PipelineReportRegionalItem {
  region: string;
  pipeline_profit: number;
  quoted_profit: number;
  gained_profit: number;
  lost_profit: number;
  potential_profit: number;
  expected_profit: number;
  total_profit: number;
}

// Alias for backward compatibility and clarity
export type PipelineReportSectorItem = PipelineReportRegionalItem;

export interface PipelineReportRegionalResponse {
  success: boolean;
  message: string;
  index: number;
  limit: number | null;
  total: number;
  total_profit: number;
  period: string;
  period_info: {
    period: string;
    start_date: string;
    end_date: string;
    description: string;
  };
  data:
    | PipelineReportRegionalItem[]
    | PipelineReportCustomerItem[]
    | PipelineReportItem[];
  summary?: PipelineReportSummary;
}

// Alias for backward compatibility and clarity
export type PipelineReportSectorResponse = PipelineReportRegionalResponse;

export interface PipelineReportRegionalFilters {
  company: string;
  period: string;
  region?: string;
  salesperson?: string;
  search?: string;
}

// Alias for backward compatibility and clarity
export type PipelineReportSectorFilters = PipelineReportRegionalFilters;

// Potential Customers interfaces
export interface PotentialCustomerItem {
  id: number;
  potential_id: string;
  customer: string;
  email_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  commodity: string;
  ice: string;
  pin: string;
  phone_no: string;
  contact_person: string;
  iec_allotment_date: string | null;
  ie_type: string;
  date_of_establishment: string | null;
  pan: string;
  nature_of_concern: string;
  address: string;
  city: string;
  state: string;
  pin1: string;
  trade_month: string;
  total_value: string;
  total_quantity: string;
  unit: string;
}

export interface PotentialCustomersResponse {
  success: boolean;
  message: string;
  index: number;
  limit: number | null;
  total: number;
  pagination_total: number;
  data: PotentialCustomerItem[];
}

// Get Pipeline Report data
export const getPipelineReportData = async (
  filters: PipelineReportFilters
): Promise<PipelineReportResponse> => {
  try {
    // Only include calculation if it's provided in filters (component controls this based on user?.pulse_id === "P2CCI")
    const payload = { ...filters };
    // Remove calculation if it's undefined to avoid sending it
    if (!payload.calculation) {
      delete payload.calculation;
    }
    const response = await postAPICall(URL.dashboard.pipelineReport, payload);
    console.log("Pipeline Report API Response:", response);
    return response as PipelineReportResponse;
  } catch (error) {
    console.error("Error fetching pipeline report data:", error);
    throw error;
  }
};

// Get Sector-wise Pipeline Report data (formerly Regional)
export const getPipelineReportRegionalData = async (
  filters: PipelineReportRegionalFilters & { calculation?: "volume" | "no_of_shipments" }
): Promise<PipelineReportRegionalResponse> => {
  try {
    // Only include calculation if it's provided in filters (component controls this based on user?.pulse_id === "P2CCI")
    const payload = { ...filters };
    // Remove calculation if it's undefined to avoid sending it
    if (!payload.calculation) {
      delete payload.calculation;
    }
    const response = await postAPICall(
      URL.dashboard.pipelineReportRegional,
      payload
    );
    console.log("Pipeline Report Sector API Response:", response);
    return response as PipelineReportRegionalResponse;
  } catch (error) {
    console.error("Error fetching sector pipeline report data:", error);
    throw error;
  }
};

// Alias for clarity
export const getPipelineReportSectorData = getPipelineReportRegionalData;

// Product-wise Pipeline Report interfaces
export interface PipelineReportProductItem {
  service: string;
  service_type: string;
  pipeline_profit: number;
  potential_profit: number;
  expected_profit: number;
  quoted_profit: number;
  gained_profit: number;
  lost_profit: number;
}

export interface PipelineReportProductSalespersonItem {
  salesperson: string;
  service: string;
  service_type: string;
  pipeline_profit: number;
  potential_profit: number;
  expected_profit: number;
  quoted_profit: number;
  gained_profit: number;
  lost_profit: number;
}

export interface PipelineReportProductResponse {
  success: boolean;
  message: string;
  total: number;
  total_profit: number;
  data:
    | PipelineReportProductItem[]
    | PipelineReportProductSalespersonItem[]
    | PipelineReportCustomerItem[];
  summary?: PipelineReportSummary;
}

export interface PipelineReportProductFilters {
  company: string;
  period: string;
  service?: string;
  service_type?: string;
  salesperson?: string;
  search?: string;
}

// Get Product-wise Pipeline Report data
export const getPipelineReportProductData = async (
  filters: PipelineReportProductFilters & { calculation?: "volume" | "no_of_shipments" }
): Promise<PipelineReportProductResponse> => {
  try {
    // Only include calculation if it's provided in filters (component controls this based on user?.pulse_id === "P2CCI")
    const payload = { ...filters };
    // Remove calculation if it's undefined to avoid sending it
    if (!payload.calculation) {
      delete payload.calculation;
    }
    const response = await postAPICall(
      URL.dashboard.pipelineReportProduct,
      payload
    );
    console.log("Pipeline Report Product API Response:", response);
    return response as PipelineReportProductResponse;
  } catch (error) {
    console.error("Error fetching product pipeline report data:", error);
    throw error;
  }
};

// Get Potential Customers data
export const getPotentialCustomersData = async (
  filters: PipelineReportFilters
): Promise<PotentialCustomersResponse> => {
  try {
    // Only include calculation if it's provided in filters (component controls this based on user?.pulse_id === "P2CCI")
    const payload = { ...filters };
    // Remove calculation if it's undefined to avoid sending it
    if (!payload.calculation) {
      delete payload.calculation;
    }
    const response = await postAPICall(URL.dashboard.pipelineReport, payload);
    console.log("Potential Customers API Response:", response);
    return response as PotentialCustomersResponse;
  } catch (error) {
    console.error("Error fetching potential customers data:", error);
    throw error;
  }
};

// Get Potential Customers data for Product tab (uses product endpoint)
export const getPotentialCustomersDataForProduct = async (
  filters: PipelineReportFilters
): Promise<PotentialCustomersResponse> => {
  try {
    // Only include calculation if it's provided in filters (component controls this based on user?.pulse_id === "P2CCI")
    const payload = { ...filters };
    // Remove calculation if it's undefined to avoid sending it
    if (!payload.calculation) {
      delete payload.calculation;
    }
    const response = await postAPICall(
      URL.dashboard.pipelineReportProduct,
      payload
    );
    console.log("Potential Customers Product API Response:", response);
    return response as PotentialCustomersResponse;
  } catch (error) {
    console.error(
      "Error fetching potential customers data for product:",
      error
    );
    throw error;
  }
};

// Get Potential Customers data for Regional/Sector tab (uses regional endpoint)
export const getPotentialCustomersDataForRegional = async (
  filters: PipelineReportFilters
): Promise<PotentialCustomersResponse> => {
  try {
    // Only include calculation if it's provided in filters (component controls this based on user?.pulse_id === "P2CCI")
    const payload = { ...filters };
    // Remove calculation if it's undefined to avoid sending it
    if (!payload.calculation) {
      delete payload.calculation;
    }
    const response = await postAPICall(
      URL.dashboard.pipelineReportRegional,
      payload
    );
    console.log("Potential Customers Regional API Response:", response);
    return response as PotentialCustomersResponse;
  } catch (error) {
    console.error(
      "Error fetching potential customers data for regional:",
      error
    );
    throw error;
  }
};

// Update Expected Profit
export interface UpdateExpectedProfitPayload {
  customer_code: string;
  expected_profit: number;
}

export interface UpdateExpectedProfitResponse {
  success: boolean;
  message: string;
}

export const updateExpectedProfit = async (
  payload: UpdateExpectedProfitPayload
): Promise<UpdateExpectedProfitResponse> => {
  try {
    const response = await postAPICall(URL.dashboard.expected, payload);
    console.log("Update Expected Profit API Response:", response);
    return response as UpdateExpectedProfitResponse;
  } catch (error) {
    console.error("Error updating expected profit:", error);
    throw error;
  }
};

// Booking interfaces
export interface BookingItem {
  salesperson: string;
  customer_name: string;
  product: string;
  volume: string;
  date: string;
}

export interface BookingResponse {
  success: boolean;
  message: string;
  count: number;
  index: number;
  limit: number | null;
  total_pagination: number;
  total: number;
  data: BookingItem[];
}

export interface BookingFilters {
  date_from: string;
  date_to: string;
}

// Get Booking data
export const getBookingData = async (
  fromDate?: Date | null,
  toDate?: Date | null,
  search?: string
): Promise<BookingResponse> => {
  try {
    // Step 1: Call quotation filter API with status "GAINED"
    const requestBody = {
      filters: {
        status: "GAINED",
        ...(search && search.trim() && { search: search.trim() }),
      },
    };

    console.log("Calling quotation filter API with GAINED status...");
    const quotationResponse = await apiCallProtected.post(
      URL.quotationFilter,
      requestBody
    );
    const quotationData = quotationResponse as any;

    if (!quotationData || !Array.isArray(quotationData.data)) {
      console.warn("No quotation data received or invalid format");
      return {
        success: true,
        message: "No booking data found",
        count: 0,
        index: 0,
        limit: null,
        total_pagination: 0,
        total: 0,
        data: [],
      };
    }

    console.log(
      `Received ${quotationData.data.length} quotations with GAINED status`
    );

    // Step 2: Filter by updated_at field based on date range
    let filteredQuotations = quotationData.data;

    if (fromDate && toDate) {
      const fromDateStr = dayjs(fromDate).format("YYYY-MM-DD");
      const toDateStr = dayjs(toDate).format("YYYY-MM-DD");

      filteredQuotations = quotationData.data.filter((quotation: any) => {
        if (!quotation.updated_at) return false;

        // Parse updated_at (format: "2025-11-18T11:51:33.860476Z")
        const updatedDate = dayjs(quotation.updated_at).format("YYYY-MM-DD");
        return updatedDate >= fromDateStr && updatedDate <= toDateStr;
      });

      console.log(
        `Filtered to ${filteredQuotations.length} quotations based on updated_at date range (${fromDateStr} to ${toDateStr})`
      );
    }

    // Step 3: Transform data to BookingItem format
    const bookingItems: BookingItem[] = [];

    filteredQuotations.forEach((quotation: any) => {
      const salesperson = quotation.sales_person || "";
      const customerName = quotation.customer_name || "";
      const updatedAt = quotation.updated_at
        ? dayjs(quotation.updated_at).format("YYYY-MM-DD")
        : "";

      // Process each quotation service
      if (quotation.quotation && Array.isArray(quotation.quotation)) {
        quotation.quotation.forEach((quote: any) => {
          const serviceType = quote.service_type || "";
          const trade = quote.trade || "";
          const product = `${serviceType} ${trade}`.trim();

          // Get cargo_details
          const cargoDetails = quote.cargo_details || [];

          if (serviceType.toUpperCase() === "AIR") {
            // AIR: chargeable_weight + " Kilos"
            if (cargoDetails.length > 0 && cargoDetails[0].chargeable_weight) {
              const volume = `${cargoDetails[0].chargeable_weight} Kilos`;
              bookingItems.push({
                salesperson,
                customer_name: customerName,
                product,
                volume,
                date: updatedAt,
              });
            }
          } else if (serviceType.toUpperCase() === "FCL") {
            // FCL: no_of_containers x container_code (multiple rows if multiple cargo_details)
            if (cargoDetails.length > 0) {
              cargoDetails.forEach((cargo: any) => {
                if (cargo.no_of_containers) {
                  // Try container_code first, then container_type_code as fallback
                  const containerCode =
                    cargo.container_code || cargo.container_type_code || "";
                  if (containerCode) {
                    const volume = `${cargo.no_of_containers} x ${containerCode}`;
                    bookingItems.push({
                      salesperson,
                      customer_name: customerName,
                      product,
                      volume,
                      date: updatedAt,
                    });
                  }
                }
              });
            }
          } else if (serviceType.toUpperCase() === "LCL") {
            // LCL: chargeable_volume + " CBM"
            if (cargoDetails.length > 0 && cargoDetails[0].chargeable_volume) {
              const volume = `${cargoDetails[0].chargeable_volume} CBM`;
              bookingItems.push({
                salesperson,
                customer_name: customerName,
                product,
                volume,
                date: updatedAt,
              });
            }
          }
        });
      }
    });

    console.log(`Transformed to ${bookingItems.length} booking items`);

    // Sort by salesperson
    bookingItems.sort((a, b) => {
      const salespersonA = a.salesperson.toLowerCase();
      const salespersonB = b.salesperson.toLowerCase();
      if (salespersonA < salespersonB) return -1;
      if (salespersonA > salespersonB) return 1;
      return 0;
    });

    return {
      success: true,
      message: "Booking data retrieved successfully",
      count: bookingItems.length,
      index: 0,
      limit: null,
      total_pagination: 1,
      total: bookingItems.length,
      data: bookingItems,
    };
  } catch (error) {
    console.error("Error fetching booking data:", error);
    throw error;
  }
};

// Quotation interfaces
export interface QuotationDetailResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    enquiry_id: string;
    customer_name: string;
    customer_code: string;
    sales_person: string;
    enquiry_received_date: string;
    status: string;
    origin_list: string[];
    destination_list: string[];
    quote_type_list: string[];
    remark_list: string[];
    valid_upto_list: string[];
    quotation: Array<{
      quotation_id: string;
      service_id: number;
      service_type: string;
      trade: string;
      origin: string;
      origin_code: string;
      destination: string;
      destination_code: string;
      shipment_terms: string;
      shipment_terms_code: string;
      hazardous_cargo: boolean;
      carrier_code: string | null;
      carrier: string | null;
      icd: string;
      remark: string;
      profit: number;
      valid_upto: string;
      multi_carrier: boolean;
      quote_type: string;
      quote_currency: string;
      cargo_details: Array<{
        container_type_code: string;
        container_type: string;
        no_of_containers: number;
        gross_weight: number;
      }>;
      charges: Array<{
        id: number;
        charge_name: string;
        currency: string;
        no_of_units: number;
        unit: string;
        sell_per_unit: number;
        cost_per_unit: number;
        total_sell: number;
        total_cost: number;
      }>;
    }>;
  };
}

// Get Quotation Details
export const getQuotationDetails = async (
  quotationId: string
): Promise<QuotationDetailResponse> => {
  try {
    const response = await getAPICall(
      `${URL.quotation}${quotationId}/`,
      API_HEADER
    );
    console.log("Quotation Details API Response:", response);
    return response as QuotationDetailResponse;
  } catch (error) {
    console.error("Error fetching quotation details:", error);
    throw error;
  }
};

// Call Entry interfaces
export interface CallEntryDetailResponse {
  id: number;
  customer_name: string;
  customer_code: string;
  call_date: string;
  call_mode_id: number;
  call_mode_name: string;
  call_summary: string;
  followup_date: string;
  followup_id: number;
  followup_action_name: string;
  latitude: string;
  longitude: string;
  salesman: string | null;
  expected_profit: number;
  created_by_name: string;
  branch_code: string;
  company_code: string;
  status?: string;
}

// Get Call Entry Details
export const getCallEntryDetails = async (
  callEntryId: string
): Promise<CallEntryDetailResponse> => {
  try {
    const response = await getAPICall(
      `${URL.callEntry}${callEntryId}/`,
      API_HEADER
    );
    console.log("Call Entry Details API Response:", response);
    return response as CallEntryDetailResponse;
  } catch (error) {
    console.error("Error fetching call entry details:", error);
    throw error;
  }
};

// Lost Customer interfaces
export interface LostCustomerItem {
  customer_name: string;
  customer_code: string;
  job_date: string;
}

export interface LostCustomerSalesperson {
  user_name: string;
  email: string;
  branch_code: string;
  customer_count: number;
  customers: LostCustomerItem[];
}

export interface LostCustomerResponse {
  success: boolean;
  message: string;
  company: string;
  period: string;
  current_period_start: string;
  current_period_end: string;
  previous_period_start: string;
  previous_period_end: string;
  total_salespersons: number;
  data: LostCustomerSalesperson[];
}

export interface LostCustomerFilters {
  company?: string;
  period?: string;
  search?: string;
}

// Get Lost Customer data
export const getLostCustomerData = async (
  filters: LostCustomerFilters = {}
): Promise<LostCustomerResponse> => {
  try {
    const payload: any = {};

    if (filters.company) payload.company = filters.company;
    if (filters.period) payload.period = filters.period;
    if (filters.search) payload.search = filters.search;

    console.log("Lost Customer API Payload:", payload);

    const response = await postAPICall(URL.dashboard.lostCustomers, payload);
    console.log("Lost Customer API Response:", response);
    return response as LostCustomerResponse;
  } catch (error) {
    console.error("Error fetching lost customer data:", error);
    throw error;
  }
};

/**
 * Example API Usage:
 *
 * 1. GET Request (Initial Load):
 *    const data = await getOutstandingSummary();
 *    // Returns all companies data
 *
 * 2. POST Request (With Filters):
 *    const filters = {
 *      company: "PENTAGON INDIA",
 *      location: "CHENNAI",
 *      salesman: "MAYUR GORI"
 *    };
 *    const data = await getFilteredOutstandingData(filters);
 *    // Returns filtered data based on provided filters
 *
 * 3. Available Filter Options:
 *    - company: string (company name)
 *    - location: string (location name)
 *    - salesman: string (salesman name)
 *    - year: number (filter by year)
 *    - month: number (filter by month 1-12)
 *    - date_from: string (start date in YYYY-MM-DD format)
 *    - date_to: string (end date in YYYY-MM-DD format)
 */
