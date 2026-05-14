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
  mode?: string;
  by_sales_rep_ytd?: {
    index: number;
    limit: number;
  };
  year?: number;
  month?: number;
  date_from?: string;
  date_to?: string;
  start_month?: string;
  end_month?: string;
  type?: string;
  search?: string;
}

export interface CustomerOutstandingVsOverdueItem {
  sno: number;
  company_name: string;
  location: string;
  salesperson: string;
  salesperson_email: string;
  cc_mail: string[];
  customer_code: string;
  customer_name: string;
  credit_display: string;
  credit_amount: string;
  credit_day: number;
  status_tags: string[];
  outstanding: string;
  overdue: string;
  days_1_30: string;
  days_31_60: string;
  /** New API row key for 61-90 bucket. */
  days_61_90?: string | number;
  /** Primary API row key for 90+ bucket. */
  days_90_plus?: string | number;
  /** Backward compatibility for older API shape. */
  days_61_plus?: string | number;
  risk: "LOW" | "MEDIUM" | "HIGH" | string;
  open_line_count: number;
}

export interface CustomerOutstandingVsOverdueSummary {
  total_outstanding: string;
  total_overdue: string;
  total_outstanding_percentage: string;
  total_overdue_percentage: string;
  open_invoices: number;
  customer_count: number;
  currency: string;
  days_1_30: string;
  days_31_60: string;
  days_61_90: string;
  days_90_plus?: string | number;
}

export interface CustomerOutstandingVsOverdueResponse {
  success: boolean;
  message: string;
  as_of: string;
  /** Present when API returns aggregation mode (customer vs salesperson list). */
  salesperson?: boolean;
  summary: CustomerOutstandingVsOverdueSummary;
  data: CustomerOutstandingVsOverdueItem[];
  total: number;
  index: number;
  limit: number;
}

export interface CustomerOutstandingVsOverdueFilters {
  company: string;
  location?: string;
  salesman?: string;
  customer_name?: string;
  risk?: string;
  search?: string;
  index?: number;
  limit?: number;
  /**
   * Customer vs salesperson list: `false` / `true`.
   * Rep drill-down: use `salesperson: true` together with `salesman: "<rep name>"` in the POST body.
   */
  salesperson?: boolean | string;
  /**
   * Dashboard tile: POST `{ company }` only with `?index=0&limit=5` (summary + first page slice).
   */
  summaryCard?: boolean;
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
  overdue_percentage?: string;
  today_percentage?: string;
  upcoming_percentage?: string;
  closed_percentage?: string;
}

/** POST `call-entry/data/` — filters mirror API. */
export interface CallEntryDashboardFilters {
  company: string;
  date_from?: string;
  date_to?: string;
  calls_by_rep_pagination?: {
    index: number;
    limit: number;
  };
  activity_log_pagination?: {
    index: number;
    limit: number;
  };
  salesperson?: string | null;
  type?: string | null;
  search?: string | null;
}

export interface CallEntryDashboardRepRow {
  sno: number;
  salesperson: string;
  total_overdue: number;
  total_today: number;
  total_upcoming: number;
  total_closed: number;
  total_calls: number;
  percentage?: string;
  salesperson_email?: string;
  cc_mail?: string[] | string;
}

export interface CallEntryHeatmapHour {
  hour: number;
  count: number;
}

export interface CallEntryHeatmapRow {
  salesperson: string;
  hours: CallEntryHeatmapHour[];
}

export interface CallEntryCallHeatmap {
  rows: CallEntryHeatmapRow[];
}

export interface CallEntryActivityLogRow {
  id: number;
  customer_code: string;
  customer_name: string;
  purpose: string;
  outcome: string;
  salesperson: string;
  call_date: string;
  followup_date: string;
  status: string;
  sno: number;
}

export interface CallEntryDashboardResponse {
  success: boolean;
  message: string;
  filters_applied: {
    company: string;
    date_from: string;
    date_to: string;
    salesperson: string | null;
    type: string | null;
    search: string | null;
  };
  kpi: {
    total_overdue: number;
    total_today: number;
    total_upcoming: number;
    total_closed: number;
    total_calls: number;
  };
  calls_by_rep: CallEntryDashboardRepRow[];
  calls_by_rep_meta?: {
    total: number;
    index: number;
    limit: number;
    paginated: boolean;
  };
  activity_log: CallEntryActivityLogRow[];
  activity_log_meta?: {
    total: number;
    index: number;
    limit: number;
    paginated: boolean;
  };
  call_heatmap?: CallEntryCallHeatmap;
  summary: CallEntryStatisticsSummary;
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
  /** API “gained” counts; shown as “Won” in enquiry funnel / KPI strip. */
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

/** `summary` from POST `enquiry/enquiryconversion/`. */
export interface EnquiryConversionApiSummaryStatusChange {
  change_count?: number;
  change_percentage?: string;
  direction?: string;
  previous_value?: number;
  current_value?: number;
}

export interface EnquiryConversionApiSummary {
  total_salesperson_count?: number;
  total_active?: number;
  /** Gained enquiries — funnel / metrics display as Won. */
  total_gain?: number;
  /** Some payloads use this alias for gained. */
  total_gained?: number;
  total_lost?: number;
  total_quote_created?: number;
  total_enquiry?: number;
  /** Pre-formatted shares (e.g. `"60%"`) from enquiry/enquiryconversion/ summary */
  active_percentage?: string;
  gain_percentage?: string;
  lost_percentage?: string;
  quote_created_percentage?: string;
  status_change_vs_previous_month?: {
    active?: EnquiryConversionApiSummaryStatusChange;
    gain?: EnquiryConversionApiSummaryStatusChange;
    lost?: EnquiryConversionApiSummaryStatusChange;
    quote_created?: EnquiryConversionApiSummaryStatusChange;
    current_range?: { date_from?: string; date_to?: string };
    previous_range?: { date_from?: string; date_to?: string };
  };
}

/** Salesperson-level row from POST `enquiry/enquiryconversion/`. */
export interface EnquiryConversionSalespersonRow {
  sno?: number;
  salesperson: string;
  active?: string | number;
  gained?: string | number;
  lost?: string | number;
  quote_created?: string | number;
  total_enquiry: number;
  salesperson_email?: string;
  cc_mail?: unknown[];
}

/** Customer row from POST `enquiry/salesperson-statistics/` (rep drill-down). */
export interface EnquiryConversionSalespersonStatisticsCustomerRow {
  sno: number;
  customer_code: string;
  customer_name: string;
  active: number;
  gained: number;
  lost: number;
  quote_created: number;
  total_enquiry: number;
}

export interface EnquiryConversionSalespersonStatisticsSummary {
  total_customer_count: number;
  total_active: number;
  total_gain: number;
  total_lost: number;
  total_quote_created: number;
}

/** POST `enquiry/salesperson-statistics/` — customer-wise stats for one salesperson. */
export interface EnquiryConversionSalespersonStatisticsResponse {
  success: boolean;
  message?: string;
  total?: number;
  index?: number;
  limit?: number | null;
  company?: string;
  salesperson?: string;
  /** When provided by API, used to prefill enquiry conversion–style send-email modals. */
  salesperson_email?: string;
  cc_mail?: string | string[];
  data?: EnquiryConversionSalespersonStatisticsCustomerRow[];
  summary?: EnquiryConversionSalespersonStatisticsSummary;
}

/** Nested quotation / enquiry payloads when POST includes `customer_code`. */
export interface EnquiryDrilldownQuotationCharge {
  charge_name?: string;
  unit?: string;
  no_of_units?: number;
  sell_per_unit?: string;
  total_sell?: string;
  currency?: string;
}

export interface EnquiryDrilldownQuotationService {
  total_sell?: string;
  quote_currency?: string;
  valid_upto?: string;
  charges?: EnquiryDrilldownQuotationCharge[];
  service_details?: {
    service?: string;
    shipment_terms_code_read?: string;
    shipment_terms_name?: string;
    origin_code_read?: string;
    destination_code_read?: string;
    origin_name?: string;
    destination_name?: string;
    gross_weight?: number;
    no_of_packages?: number;
    commodity?: string | null;
    fcl_details?: Array<{
      container_type?: string;
      container_name?: string;
      no_of_containers?: number | string;
    }>;
  };
}

export interface EnquiryDrilldownQuotation {
  quotation_id?: string;
  created_at?: string;
  created_by?: string;
  created_by_name?: string;
  quotation_services?: EnquiryDrilldownQuotationService[];
}

export interface EnquiryDrilldownService {
  service?: string;
  service_name?: string;
  trade?: string;
  shipment_terms_code_read?: string;
  shipment_terms_name?: string;
  origin_code_read?: string;
  destination_code_read?: string;
  origin_name?: string;
  destination_name?: string;
  gross_weight?: string | number;
  no_of_packages?: number;
  commodity?: string | null;
  fcl_details?: Array<{
    container_type?: string;
    container_name?: string;
    no_of_containers?: number | string;
    gross_weight?: number | string;
  }>;
}

export interface EnquiryDrilldownEnquiry {
  id?: number;
  enquiry_id: string;
  customer_name?: string;
  customer_address?: string;
  enquiry_received_date?: string;
  sales_person?: string;
  sales_coordinator?: string;
  status: string;
  services?: EnquiryDrilldownService[];
  origin_code_list?: string[];
  destination_code_list?: string[];
  origin_list?: string[];
  destination_list?: string[];
  quotations?: EnquiryDrilldownQuotation[];
}

export interface EnquiryConversionCustomerwiseCustomerRow
  extends EnquiryConversionSalespersonStatisticsCustomerRow {
  enquiries?: EnquiryDrilldownEnquiry[];
}

export interface EnquiryConversionCustomerwiseSummary {
  total_enquiry_count?: number;
}

/** POST `enquiry/salesperson-statistics/` with `customer_code` — stats + enquiry list. */
export interface EnquiryConversionCustomerwiseResponse {
  success: boolean;
  message?: string;
  company?: string;
  salesperson?: string;
  data?: EnquiryConversionCustomerwiseCustomerRow[];
  summary?: EnquiryConversionCustomerwiseSummary;
}

export interface EnquiryConversionTopEnquiryRow {
  sno: number;
  enquiry_id: string;
  customer_name: string;
  /** Present when API returns account code for drilldown into customer-wise enquiries. */
  customer_code?: string;
  origin_code: string;
  destination_code: string;
  service: string;
  status: string;
  /** When API returns them — used for send-email prefill on Top Active Enquiries. */
  sales_person?: string;
  salesperson_email?: string;
  cc_mail?: string | string[];
}

/** Full POST `enquiry/enquiryconversion/` response (dashboard overview). */
export interface EnquiryConversionDashboardResponse {
  success: boolean;
  message?: string;
  total?: number;
  index?: number;
  limit?: number | null;
  company?: string;
  data?: EnquiryConversionSalespersonRow[];
  summary?: EnquiryConversionApiSummary;
  service?: Array<{ service: string; count: number; percentage: string }>;
  top_enquiries?: EnquiryConversionTopEnquiryRow[];
  /** Customer-wise winners list used by mode drilldown tables. */
  top_gained?: Array<Record<string, unknown>>;
  /** Route/lane-wise winners list used by mode drilldown top lanes. */
  top_gained_roted?: Array<Record<string, unknown> | string>;
  next_drilldown?: unknown;
}

/** Caption / MoM adornments on the Overview enquiry conversion tile (from `summary`). */
export interface EnquiryConversionOverviewMeta {
  /** MoM direction for ACTIVE from summary.status_change_vs_previous_month.active */
  activeMoMDirection?: string;
  /** MoM percentage text for ACTIVE (e.g. "+12.4%") */
  activeMoMChangePctDisplay?: string;
  /** `summary.quote_created_percentage` shown under QUOTED */
  quoteCreatedPctDisplay?: string;
  /** `summary.lost_percentage` shown under LOST */
  lostRowPctDisplay?: string;
  gainMoMDirection?: string;
  /** e.g. `"-100%"` — paired with direction for WON row */
  gainMoMChangePctDisplay?: string;
}

export function extractEnquiryConversionOverviewMeta(
  response: unknown
): EnquiryConversionOverviewMeta {
  if (!response || typeof response !== "object") return {};
  const summary = (response as EnquiryConversionDashboardResponse).summary;
  if (!summary || typeof summary !== "object") return {};
  const active = summary.status_change_vs_previous_month?.active;
  const gain = summary.status_change_vs_previous_month?.gain;
  return {
    activeMoMDirection: active?.direction,
    activeMoMChangePctDisplay:
      typeof active?.change_percentage === "string"
        ? active.change_percentage.trim()
        : undefined,
    quoteCreatedPctDisplay:
      typeof summary.quote_created_percentage === "string"
        ? summary.quote_created_percentage.trim()
        : undefined,
    lostRowPctDisplay:
      typeof summary.lost_percentage === "string"
        ? summary.lost_percentage.trim()
        : undefined,
    gainMoMDirection: gain?.direction,
    gainMoMChangePctDisplay:
      typeof gain?.change_percentage === "string"
        ? gain.change_percentage.trim()
        : undefined,
  };
}

// Budget interfaces
export interface BudgetDataItem {
  salesperson?: string;
  month?: string;
  trade_type?: string | null;
  service_type?: string | null;
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

export interface SalespersonMonthlyBudgetItem {
  sno: number;
  month: string;
  actual_budget: number;
  sales_budget: number;
  currency?: string;
  trade_type?: string | null;
  service_type?: string | null;
  incentive_percentage?: number;
  incentive_amount?: number;
}

export interface SalespersonMonthlyBudgetData {
  company_name: string;
  date_range: string;
  currency?: string;
  salesperson: string;
  budget: SalespersonMonthlyBudgetItem[];
  summary?: {
    total: number;
    total_actual_budget: number;
    total_sales_budget: number;
  };
}

export interface SalespersonMonthlyBudgetResponse {
  success: boolean;
  message: string;
  budget_summary_version?: string;
  total?: number;
  index?: number;
  limit?: number | null;
  summary?: {
    total_actual_budget: number;
    total_sales_budget: number;
    currency?: string;
  };
  data: SalespersonMonthlyBudgetData[];
}

export interface BudgetVsActualSalespersonNameRow {
  sno: number;
  salesperson: string;
}

export interface BudgetVsActualSalespersonNamesResponse {
  status: boolean;
  message: string;
  data: BudgetVsActualSalespersonNameRow[];
}

export interface CustomerOutstandingVsOverdueSalespersonNameRow {
  sno: number;
  salesperson: string;
}

export interface CustomerOutstandingVsOverdueSalespersonNamesResponse {
  status: boolean;
  message: string;
  data: CustomerOutstandingVsOverdueSalespersonNameRow[];
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

export const getCustomerOutstandingVsOverdueData = async (
  filters: CustomerOutstandingVsOverdueFilters
): Promise<CustomerOutstandingVsOverdueResponse> => {
  try {
    const summaryCard = filters.summaryCard === true;
    const index = summaryCard
      ? 0
      : Number.isFinite(filters.index)
        ? Number(filters.index)
        : 0;
    const limit = summaryCard
      ? 5
      : Number.isFinite(filters.limit)
        ? Number(filters.limit)
        : 15;
    const queryParams = new URLSearchParams();
    queryParams.append("index", String(index));
    queryParams.append("limit", String(limit));
    const url = `${URL.dashboard.customerOutstandingVsOverdue}?${queryParams.toString()}`;

    const payload: Record<string, unknown> = {
      company: filters.company,
    };
    if (!summaryCard) {
      if (typeof filters.salesperson === "boolean") {
        payload.salesperson = filters.salesperson;
      } else if (typeof filters.salesperson === "string" && filters.salesperson.trim()) {
        payload.salesperson = filters.salesperson.trim();
      }
      if (filters.location && filters.location.trim()) {
        payload.location = filters.location.trim();
      }
      if (filters.salesman && filters.salesman.trim()) {
        payload.salesman = filters.salesman.trim();
      }
      if (filters.customer_name && filters.customer_name.trim()) {
        payload.customer_name = filters.customer_name.trim();
      }
      if (filters.risk && filters.risk.trim()) {
        payload.risk = filters.risk.trim();
      }
      if (filters.search && filters.search.trim()) {
        payload.search = filters.search.trim();
      }
    }

    const response = await postAPICall(url, payload);
    return response as CustomerOutstandingVsOverdueResponse;
  } catch (error) {
    console.error("Error fetching customer outstanding vs overdue data:", error);
    throw error;
  }
};

/**
 * Fetch searchable "All reps" options for Customer Outstanding vs Overdue page.
 * Backend expects POST payload: { model: "customer-outstanding-vs-overdue", search: "PARESH" }.
 */
export const getCustomerOutstandingVsOverdueSalespersonNames = async (args: {
  search: string;
}): Promise<CustomerOutstandingVsOverdueSalespersonNamesResponse> => {
  try {
    const payload = {
      model: "customer-outstanding-vs-overdue",
      search: args.search,
    };
    const response = await postAPICall(
      URL.dashboard.budgetVsActualSalespersonNames,
      payload
    );
    return response as CustomerOutstandingVsOverdueSalespersonNamesResponse;
  } catch (error) {
    console.error(
      "Error fetching customer outstanding vs overdue salesperson names:",
      error
    );
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
  console.log("Processing filtered response: RRRRRR", response.summary);

  if (response?.summary) {
    console.log("Response summary:", response.summary);
    // Use summary data if available
    const totalOutstanding = parseFloat(
      response.summary.total_outstanding ||
        response.summary.local_outstanding || 
        "0"
    );
    const totalOverdue = parseFloat(response.summary.total_overdue || "0");
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

function dedupeCallEntryDashboardReps(
  rows: CallEntryDashboardRepRow[]
): CallEntryDashboardRepRow[] {
  const seen = new Set<string>();
  const out: CallEntryDashboardRepRow[] = [];
  for (const row of rows || []) {
    const key = (row.salesperson || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function normalizeCcMail(
  raw: string[] | string | undefined
): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw ? [raw] : [];
}

/**
 * Maps POST `call-entry/data/` into the legacy statistics shape used by email + level-0 tables.
 */
export const mapCallEntryDashboardToLegacyResponse = (
  r: CallEntryDashboardResponse
): CallEntryStatisticsResponse => {
  const fa = r.filters_applied;
  const reps = dedupeCallEntryDashboardReps(r.calls_by_rep || []);
  const data: CallEntrySalespersonData[] = reps.map((row) => ({
    salesperson: row.salesperson,
    total_overdue: row.total_overdue,
    total_today: row.total_today,
    total_upcoming: row.total_upcoming,
    total_closed: row.total_closed,
    total_calls: row.total_calls,
    salesperson_email: row.salesperson_email || "",
    cc_mail: normalizeCcMail(row.cc_mail),
  }));
  data.sort((a, b) => (b.total_calls || 0) - (a.total_calls || 0));

  const meta = r.calls_by_rep_meta;
  return {
    success: r.success,
    message: r.message,
    index: meta?.index ?? 0,
    limit: meta?.limit ?? null,
    company_code: "",
    company_name: fa?.company ?? "",
    type: fa?.type ?? null,
    date: null,
    date_from: fa?.date_from ?? "",
    date_to: fa?.date_to ?? "",
    data,
    summary: r.summary,
  };
};

/**
 * Call-entry overview: KPIs, rep list slice, heatmap (POST `call-entry/data/`).
 */
export const getCallEntryDashboardData = async (
  filters: CallEntryDashboardFilters
): Promise<CallEntryDashboardResponse> => {
  const payload: Record<string, unknown> = {
    company: filters.company,
  };
  if (filters.date_from) payload.date_from = filters.date_from;
  if (filters.date_to) payload.date_to = filters.date_to;
  if (filters.calls_by_rep_pagination) {
    payload.calls_by_rep_pagination = filters.calls_by_rep_pagination;
  }
  if (filters.activity_log_pagination) {
    payload.activity_log_pagination = filters.activity_log_pagination;
  }
  if (filters.salesperson != null && String(filters.salesperson).trim()) {
    payload.salesperson = filters.salesperson;
  }
  if (filters.type != null && String(filters.type).trim()) {
    payload.type = filters.type;
  }
  if (filters.search != null && String(filters.search).trim()) {
    payload.search = filters.search;
  }

  try {
    const response = await postAPICall(
      URL.dashboard.callEntryDashboardData,
      payload
    );
    return response as CallEntryDashboardResponse;
  } catch (error) {
    console.error("Error fetching call entry dashboard data:", error);
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
    // Format dates to DD-MM-YYYY for enquiry conversion endpoint
    let formattedDateFrom = filters.date_from;
    let formattedDateTo = filters.date_to;
    
    if (filters.date_from) {
      // Check if the date is already in DD-MM-YYYY format (regex: DD-MM-YYYY)
      const ddMmYyyyPattern = /^\d{2}-\d{2}-\d{4}$/;
      if (typeof filters.date_from === 'string' && ddMmYyyyPattern.test(filters.date_from)) {
        // Already in DD-MM-YYYY format, use as-is
        formattedDateFrom = filters.date_from;
      } else {
        // Try parsing as DD-MM-YYYY first (expected format for enquiry conversion)
        let parsedDate = dayjs(filters.date_from, "DD-MM-YYYY", true);
        
        // If that fails, try YYYY-MM-DD format
        if (!parsedDate.isValid()) {
          parsedDate = dayjs(filters.date_from, "YYYY-MM-DD", true);
        }
        
        // If still invalid, try default parsing (for Date objects converted to strings)
        if (!parsedDate.isValid()) {
          parsedDate = dayjs(filters.date_from);
        }
        
        if (parsedDate.isValid()) {
          formattedDateFrom = parsedDate.format("DD-MM-YYYY");
        }
      }
    }
    
    if (filters.date_to) {
      // Check if the date is already in DD-MM-YYYY format (regex: DD-MM-YYYY)
      const ddMmYyyyPattern = /^\d{2}-\d{2}-\d{4}$/;
      if (typeof filters.date_to === 'string' && ddMmYyyyPattern.test(filters.date_to)) {
        // Already in DD-MM-YYYY format, use as-is
        formattedDateTo = filters.date_to;
      } else {
        // Try parsing as DD-MM-YYYY first (expected format for enquiry conversion)
        let parsedDate = dayjs(filters.date_to, "DD-MM-YYYY", true);
        
        // If that fails, try YYYY-MM-DD format
        if (!parsedDate.isValid()) {
          parsedDate = dayjs(filters.date_to, "YYYY-MM-DD", true);
        }
        
        // If still invalid, try default parsing (for Date objects converted to strings)
        if (!parsedDate.isValid()) {
          parsedDate = dayjs(filters.date_to);
        }
        
        if (parsedDate.isValid()) {
          formattedDateTo = parsedDate.format("DD-MM-YYYY");
        }
      }
    }

    const payload = {
      ...(filters.company && { company: filters.company }),
      ...(filters.location && { location: filters.location }),
      ...(filters.salesman && { salesperson: filters.salesman }),
      ...(formattedDateFrom && { date_from: formattedDateFrom }),
      ...(formattedDateTo && { date_to: formattedDateTo }),
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
 * POST `enquiry/enquiryconversion/` — optional filters align with drilldown template.
 */
export const getEnquiryConversionDashboardData = async (params: {
  company: string;
  date_from: string;
  date_to: string;
  search?: string | null;
  type?: string | null;
  service?: string | null;
  salesperson?: string | null;
  customer_name?: string | null;
  customer_code?: string | null;
  top_gained_pagination?: { index: number; limit: number } | null;
}): Promise<EnquiryConversionDashboardResponse> => {
  try {
    const body: Record<string, unknown> = {
      company: params.company,
      date_from: params.date_from,
      date_to: params.date_to,
    };
    const search = params.search?.trim();
    if (search) body.search = search;
    const t = params.type?.trim();
    if (t) body.type = t;
    const svc = params.service?.trim();
    if (svc) body.service = svc;
    const sp = params.salesperson?.trim();
    if (sp) body.salesperson = sp;
    const cn = params.customer_name?.trim();
    if (cn) body.customer_name = cn;
    const cc = params.customer_code?.trim();
    if (cc) body.customer_code = cc;
    if (params.top_gained_pagination) {
      body.top_gained_pagination = params.top_gained_pagination;
    }

    const response = await postAPICall(
      URL.dashboard.enquiryEnquiryConversion,
      body,
      API_HEADER
    );
    return response as EnquiryConversionDashboardResponse;
  } catch (error) {
    console.error("Error fetching enquiry conversion dashboard data:", error);
    throw error;
  }
};

/**
 * POST `enquiry/salesperson-statistics/` — customer-wise breakdown for one salesperson.
 */
export const getEnquiryConversionSalespersonStatistics = async (params: {
  company: string;
  salesperson: string;
  date_from: string;
  date_to: string;
  type?: string | null;
  search?: string | null;
}): Promise<EnquiryConversionSalespersonStatisticsResponse> => {
  try {
    const body: Record<string, string> = {
      company: params.company,
      salesperson: params.salesperson.trim(),
      date_from: params.date_from,
      date_to: params.date_to,
    };
    const t = params.type?.trim();
    if (t) body.type = t;
    const q = params.search?.trim();
    if (q) body.search = q;
    const response = await postAPICall(
      URL.dashboard.enquiryConversion,
      body,
      API_HEADER
    );
    return response as EnquiryConversionSalespersonStatisticsResponse;
  } catch (error) {
    console.error("Error fetching enquiry conversion salesperson statistics:", error);
    throw error;
  }
};

/**
 * POST `enquiry/salesperson-statistics/` — same endpoint with `customer_code` (+ optional dashboard filters).
 */
export const getEnquiryConversionCustomerwiseDetail = async (params: {
  company: string;
  salesperson: string;
  date_from: string;
  date_to: string;
  customer_code: string;
  type?: string | null;
  service?: string | null;
  search?: string | null;
}): Promise<EnquiryConversionCustomerwiseResponse> => {
  try {
    const body: Record<string, string> = {
      company: params.company,
      salesperson: params.salesperson.trim(),
      date_from: params.date_from,
      date_to: params.date_to,
      customer_code: params.customer_code.trim(),
    };
    const t = params.type?.trim();
    if (t) body.type = t;
    const svc = params.service?.trim();
    if (svc) body.service = svc;
    const q = params.search?.trim();
    if (q) body.search = q;

    const response = await postAPICall(
      URL.dashboard.enquiryConversion,
      body,
      API_HEADER
    );
    return response as EnquiryConversionCustomerwiseResponse;
  } catch (error) {
    console.error("Error fetching enquiry conversion customer-wise detail:", error);
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

function sumDashboardRowGained(data: unknown[] | undefined): number {
  if (!Array.isArray(data)) return 0;
  return data.reduce<number>((sum, row) => {
    if (row && typeof row === "object" && "gained" in row) {
      return sum + extractNumericValue((row as { gained?: number | string }).gained);
    }
    return sum;
  }, 0);
}

export const mapEnquiryConversionSummaryToAggregatedData = (
  summary: EnquiryConversionApiSummary | null | undefined,
  salespersonRows?: unknown[]
): EnquiryConversionAggregatedData => {
  const totalEnquiries =
    summary?.total_enquiry !== undefined && summary?.total_enquiry !== null
      ? extractNumericValue(summary.total_enquiry)
      : 0;
  let totalGain =
    extractNumericValue(
      summary?.total_gain ??
        summary?.total_gain
    );
  const summaryDefinesGainDirectly =
    summary != null &&
    ("total_gain" in summary ||
      "total_gained" in summary);
  if (!summaryDefinesGainDirectly && salespersonRows) {
    totalGain = sumDashboardRowGained(salespersonRows);
  }
  const totalLost = extractNumericValue(summary?.total_lost);
  const totalActive = extractNumericValue(summary?.total_active);
  const totalQuoteCreated = extractNumericValue(summary?.total_quote_created);

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
    gainPercentage: Math.round(gainPercentage),
    lossPercentage: Math.round(lossPercentage),
    activePercentage: Math.round(activePercentage),
    quotePercentage: Math.round(quotePercentage),
  };
};

/** Overview tile totals from POST `enquiry/enquiryconversion/` only (`summary`). */
export const resolveEnquiryConversionAggregatedFromResponse = (
  response: EnquiryConversionDashboardResponse | null | undefined
): EnquiryConversionAggregatedData => {
  const empty: EnquiryConversionAggregatedData = {
    totalGain: 0,
    totalLost: 0,
    totalActive: 0,
    totalQuoteCreated: 0,
    totalEnquiries: 0,
    gainPercentage: 0,
    lossPercentage: 0,
    activePercentage: 0,
    quotePercentage: 0,
  };

  if (!response?.summary) return empty;

  return mapEnquiryConversionSummaryToAggregatedData(
    response.summary,
    response.data
  );
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
    const selectedYearFromFilter = Number.isInteger(filters.year)
      ? (filters.year as number)
      : undefined;
    if (filters.type) payload.type = filters.type;
    if (filters.company) payload.company = filters.company;
    if (filters.location) payload.location = filters.location;
    if (filters.salesperson) payload.salesperson = filters.salesperson;
    else if (filters.salesman) payload.salesperson = filters.salesman;
    if (filters.mode) payload.mode = filters.mode;
    if (filters.by_sales_rep_ytd) {
      payload.by_sales_rep_ytd = {
        index: Number(filters.by_sales_rep_ytd.index) || 0,
        limit: Number(filters.by_sales_rep_ytd.limit) || 2,
      };
    }
    if (filters.year && filters.month) {
      payload.month = `${filters.year}-${filters.month.toString().padStart(2, "0")}`;
    }
    // Budget summary year rule:
    // start_month always uses selected year.
    // end_month uses next year only when start month is greater than end month.
    const startMonthPart = filters.start_month?.split("-")[1];
    const endMonthPart = filters.end_month?.split("-")[1];
    const startYearPart = filters.start_month?.split("-")[0];
    // Prefer year from explicitly selected month range.
    // This avoids stale `filters.year` overriding current drill/filter month payloads.
    const selectedYear =
      (startYearPart ? parseInt(startYearPart, 10) : undefined) ??
      selectedYearFromFilter;
    const startMonthNum = startMonthPart ? parseInt(startMonthPart, 10) : undefined;
    const endMonthNum = endMonthPart ? parseInt(endMonthPart, 10) : undefined;

    if (filters.start_month) {
      payload.start_month =
        selectedYear && startMonthPart
          ? `${selectedYear}-${startMonthPart}`
          : filters.start_month;
    }
    if (filters.end_month) {
      const isCrossYearRange =
        typeof startMonthNum === "number" &&
        typeof endMonthNum === "number" &&
        startMonthNum >= endMonthNum;
      const endYear = selectedYear
        ? isCrossYearRange
          ? selectedYear + 1
          : selectedYear
        : undefined;

      payload.end_month =
        endYear && endMonthPart ? `${endYear}-${endMonthPart}` : filters.end_month;
    }
    // Add search parameter
    if (filters.search) payload.search = filters.search;

    console.log("Budget filter payload:", payload);
    const response = await postAPICall(
      URL.dashboard.budgetVsActual || URL.dashboard.budgetSummary,
      payload
    );
    console.log("Filtered budget response:", response);
    return response as BudgetResponse;
  } catch (error) {
    console.error("Error fetching filtered budget data:", error);
    throw error;
  }
};

export const getSalespersonMonthlyBudgetSummary = async (params: {
  company: string;
  salesperson: string;
  start_month: string;
  end_month: string;
  type: string;
}): Promise<SalespersonMonthlyBudgetResponse> => {
  try {
    const payload = {
      type: params.type,
      company: params.company,
      salesperson: params.salesperson,
      start_month: params.start_month,
      end_month: params.end_month,
    };
    const response = await postAPICall(URL.dashboard.budgetSummary, payload);
    return response as SalespersonMonthlyBudgetResponse;
  } catch (error) {
    console.error("Error fetching salesperson monthly budget summary:", error);
    throw error;
  }
};

export const getBudgetVsActualSalespersonNames = async (
  search: string
): Promise<BudgetVsActualSalespersonNamesResponse> => {
  try {
    const payload = {
      model: "budget-vs-actual",
      search: search.trim(),
    };
    const response = await postAPICall(URL.dashboard.budgetVsActualSalespersonNames, payload);
    return response as BudgetVsActualSalespersonNamesResponse;
  } catch (error) {
    console.error("Error fetching budget vs actual salesperson names:", error);
    throw error;
  }
};

export const calculateBudgetAggregatedData = (
  response: BudgetResponse
): BudgetAggregatedData => {
  const summary = (response as any)?.summary;
  if (summary && typeof summary === "object") {
    return {
      totalActualBudget: Number(summary.actual_ytd || 0),
      totalSalesBudget: Number(summary.budget_ytd || 0),
    };
  }

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

/**
 * Calculate financial year date range for budget
 * Financial year: April (04) of a year to March of next year
 * start_month: Always April (04) of the financial year start year
 * end_month: Previous month (current month - 1)
 * 
 * Example: If today is 01-01-2026 (January 2026)
 * - Financial year: April 2025 to March 2026
 * - start_month: 2025-04
 * - end_month: 2025-12 (December 2025, previous month)
 */
export const calculateFinancialYearBudgetRange = (): {
  start_month: string;
  end_month: string;
} => {
  const today = dayjs();
  const currentMonth = today.month() + 1; // dayjs month is 0-indexed, so +1
  const currentYear = today.year();

  let financialYearStartYear: number;
  
  // Determine financial year start year
  // If current month is Jan-Mar (1-3), financial year started in previous year
  // If current month is Apr-Dec (4-12), financial year started in current year
  if (currentMonth >= 1 && currentMonth <= 3) {
    // Jan-Mar: Financial year started in previous year
    financialYearStartYear = currentYear - 1;
  } else {
    // Apr-Dec: Financial year started in current year
    financialYearStartYear = currentYear;
  }

  // start_month is always April (04) of the financial year start year
  const start_month = `${financialYearStartYear}-04`;

  // end_month is previous month (current month - 1)
  let endMonth: number;
  let endYear: number;

  if (currentMonth === 1) {
    // If current month is January, previous month is December of previous year
    endMonth = 12;
    endYear = currentYear - 1;
  } else {
    // Otherwise, previous month is current month - 1 of current year
    endMonth = currentMonth - 1;
    endYear = currentYear;
  }

  const end_month = `${endYear}-${String(endMonth).padStart(2, "0")}`;

  return { start_month, end_month };
};

/**
 * Calculate financial year start month based on end month
 * If end month is Jan, Feb, or March, then start year = end year - 1
 * If end month is April-December, then start year = end year (same year)
 * 
 * @param endMonth - End month in format "YYYY-MM"
 * @returns Start month in format "YYYY-04" (always April)
 * 
 * Example: 
 * - If endMonth is "2026-01" (January 2026), start_month = "2025-04"
 * - If endMonth is "2026-04" (April 2026), start_month = "2026-04"
 */
export const calculateStartMonthFromEndMonth = (
  endMonth: string
): string => {
  const [endYearStr, endMonthStr] = endMonth.split("-");
  const endYear = parseInt(endYearStr);
  const endMonthNum = parseInt(endMonthStr);

  let startYear: number;

  // If end month is Jan, Feb, or March (01, 02, 03), start year = end year - 1
  // If end month is April-December (04-12), start year = end year (same year)
  if (endMonthNum >= 1 && endMonthNum <= 3) {
    startYear = endYear - 1;
  } else {
    startYear = endYear;
  }

  // start_month is always April (04) of the calculated start year
  return `${startYear}-04`;
};

/**
 * Calculate financial year date range for a specific financial year start year
 * This is used when user selects a year from the dropdown
 * 
 * @param financialYearStartYear - The year when the financial year starts (April)
 * @returns Object with start_month and end_month
 * 
 * Example: If financialYearStartYear is 2025
 * - start_month: 2025-04
 * - end_month: Based on current date (previous month), but capped at March 2026
 */
export const calculateFinancialYearBudgetRangeForYear = (
  financialYearStartYear: number
): {
  start_month: string;
  end_month: string;
} => {
  const today = dayjs();
  const currentMonth = today.month() + 1;
  const currentYear = today.year();

  // start_month is always April (04) of the financial year start year
  const start_month = `${financialYearStartYear}-04`;

  // end_month is previous month (current month - 1), but should not exceed March of next year
  let endMonth: number;
  let endYear: number;

  if (currentMonth === 1) {
    // If current month is January, previous month is December of previous year
    endMonth = 12;
    endYear = currentYear - 1;
  } else {
    // Otherwise, previous month is current month - 1 of current year
    endMonth = currentMonth - 1;
    endYear = currentYear;
  }

  // Cap end_month to March of the financial year end (next year after start year)
  const financialYearEndYear = financialYearStartYear + 1;
  if (endYear > financialYearEndYear || (endYear === financialYearEndYear && endMonth > 3)) {
    // If end_month exceeds March of financial year end, cap it to March
    endMonth = 3;
    endYear = financialYearEndYear;
  }

  const end_month = `${endYear}-${String(endMonth).padStart(2, "0")}`;

  return { start_month, end_month };
};

/**
 * Get dynamic year options for financial year dropdown
 * Returns financial year start years (current and past years)
 */
export const getFinancialYearOptions = (): { value: string; label: string }[] => {
  const today = dayjs();
  const currentMonth = today.month() + 1;
  const currentYear = today.year();

  // Determine current financial year start year
  let currentFinancialYearStart: number;
  if (currentMonth >= 1 && currentMonth <= 3) {
    currentFinancialYearStart = currentYear - 1;
  } else {
    currentFinancialYearStart = currentYear;
  }

  // Generate options: current financial year and 5 years back
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i <= 5; i++) {
    const year = currentFinancialYearStart - i;
    options.push({
      value: year.toString(),
      label: year.toString(),
    });
  }

  return options;
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
  date_from?: string;
  date_to?: string;
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
    if (filters.date_from) payload.date_from = filters.date_from;
    if (filters.date_to) payload.date_to = filters.date_to;
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
  company?: string;
  period?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// Get New Customer data
export const getNewCustomerData = async (
  filters: NewCustomerFilters
): Promise<NewCustomerResponse> => {
  try {
    const url = `${URL.dashboard.newCustomerShipment}/get_new_customers/`;
    const payload: any = {};
    if (filters.company) payload.company = filters.company;
    if (filters.period) payload.period = filters.period;
    if (filters.date_from) payload.date_from = filters.date_from;
    if (filters.date_to) payload.date_to = filters.date_to;
    if (filters.search) payload.search = filters.search;
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

// Customer Interaction Status Summary interface
export interface CustomerInteractionStatusSummary {
  gain: number;
  gainSalesperson: number;
  notVisited: number;
  notVisitedSalesperson: number;
  lost: number;
  lostSalesperson: number;
}

// Get Customer Interaction Status Summary
export const getCustomerInteractionStatusSummary = async (
  filters: {
    company?: string;
    period?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  }
): Promise<CustomerInteractionStatusSummary> => {
  try {
    // Fetch all three data sets in parallel
    const [newCustomerData, customerNotVisitedData, lostCustomerData] = await Promise.all([
      getNewCustomerData(filters),
      getCustomerNotVisitedData(filters),
      getLostCustomerData(filters),
    ]);

    // Calculate aggregated values
    const gainSalesperson = Array.isArray(newCustomerData.data)
      ? newCustomerData.data.filter((sp: NewCustomerSalesperson) => sp.customer_count > 0).length
      : 0;
    
    const gain = Array.isArray(newCustomerData.data)
      ? newCustomerData.data.reduce((sum: number, sp: NewCustomerSalesperson) => sum + (sp.customer_count || 0), 0)
      : 0;

    const notVisitedSalesperson = customerNotVisitedData.summary?.total_salesperson_count || 0;
    const notVisited = customerNotVisitedData.summary?.total_customer_count || 0;

    const lostSalesperson = Array.isArray(lostCustomerData.data)
      ? lostCustomerData.data.filter((sp: LostCustomerSalesperson) => sp.customer_count > 0).length
      : 0;
    
    const lost = Array.isArray(lostCustomerData.data)
      ? lostCustomerData.data.reduce((sum: number, sp: LostCustomerSalesperson) => sum + (sp.customer_count || 0), 0)
      : 0;

    return {
      gain,
      gainSalesperson,
      notVisited,
      notVisitedSalesperson,
      lost,
      lostSalesperson,
    };
  } catch (error) {
    console.error("Error fetching customer interaction status summary:", error);
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
  period?: string; // Commented out - can be used in future case
  date_from?: string;
  date_to?: string;
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
  period?: string; // Commented out - can be used in future case
  date_from?: string;
  date_to?: string;
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
  period?: string; // Commented out - can be used in future case
  date_from?: string;
  date_to?: string;
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
        // Add date filters in the same format as quotation list page
        ...(fromDate && toDate && {
          enquiry_received_date_from: dayjs(fromDate).format("YYYY-MM-DD"),
          enquiry_received_date_to: dayjs(toDate).format("YYYY-MM-DD"),
        }),
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

    // Step 2: Use filtered quotations directly (date filtering is now done by API)
    let filteredQuotations = quotationData.data;

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
  date_from?: string;
  date_to?: string;
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
    if (filters.date_from) payload.date_from = filters.date_from;
    if (filters.date_to) payload.date_to = filters.date_to;
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

// Customer Service Report - Pending Bookings (Gained quotations without booking)
export interface PendingBookingItem {
  enquiry_id: string;
  quotation_id: string;
  quotation_date: string;
  quotation_primary_key: string;
  customer_service_details: string;
  sales_details: {
    sales_person: string;
    sales_coordinator: string | null;
  };
  gained_date: string;
  service_details: Array<{
    service: string;
    trade: string;
    origin: string;
    destination: string;
  }>;
  customer_details: {
    customer_id: number;
    customer_code: string;
    customer_name: string;
  };
}

export interface PendingBookingsResponse {
  status: boolean;
  message: string;
  index: number;
  limit: number;
  count: number;
  next: string | null;
  previous: string | null;
  data: PendingBookingItem[];
}

// Customer Service Report - Pending Jobs (Gained bookings pending jobs)
export interface PendingJobItem {
  booking_id: string;
  booking_primary_key: string;
  customer_details: {
    customer_id: number;
    customer_code: string;
    customer_name: string;
  };
  service: string;
  trade: string;
  booking_date: string;
  customer_service_person: string;
}

export interface PendingJobsResponse {
  status: boolean;
  message: string;
  index: number;
  limit: number;
  count: number;
  next: string | null;
  previous: string | null;
  data: PendingJobItem[];
}

export interface JobsWithoutBLReleasedItem {
  job_primary_key: number;
  job_id: string;
  booking_id: string;
  houseno: string;
  service?: string;
  customer_details: {
    customer_id: number;
    customer_code: string;
    customer_name: string;
  };
  etd: string;
  eta: string;
}

export interface JobsWithoutBLReleasedResponse {
  status: boolean;
  message: string;
  index: number;
  limit: number | null;
  count: number;
  next: string | null;
  previous: string | null;
  data: JobsWithoutBLReleasedItem[];
}

export interface CustomerServiceReportFilters {
  date_from?: string;
  date_to?: string;
  search?: string;
  index?: number;
  limit?: number;
}

/** Payload (other than date/search) for gained-quotations API - caller sends from page */
export interface GainedQuotationsPayload {
  trade?: string;
}

export const getPendingBookingsData = async (
  filters: CustomerServiceReportFilters = {},
  payloadFromPage?: GainedQuotationsPayload
): Promise<PendingBookingsResponse> => {
  try {
    const payload: { date_from?: string; date_to?: string; search?: string; trade?: string } = {
      ...(payloadFromPage && payloadFromPage.trade != null && { trade: payloadFromPage.trade }),
    };
    if (filters.date_from) payload.date_from = filters.date_from;
    if (filters.date_to) payload.date_to = filters.date_to;
    if (filters.search?.trim()) payload.search = filters.search.trim();
    const params = new URLSearchParams();
    if (filters.index != null) params.append("index", String(filters.index));
    if (filters.limit != null) params.append("limit", String(filters.limit));
    const query = params.toString();
    const url = query
      ? `${URL.dashboard.gainedQuotationsWithoutBooking}?${query}`
      : URL.dashboard.gainedQuotationsWithoutBooking;
    const response = await postAPICall(url, payload, API_HEADER);
    return response as PendingBookingsResponse;
  } catch (error) {
    console.error("Error fetching pending bookings data:", error);
    throw error;
  }
};

/** Payload (other than date/search) for bookings-pending-jobs API - caller sends from page */
export interface BookingsPendingJobsPayload {
  service_type?: string;
}

export const getPendingJobsData = async (
  filters: CustomerServiceReportFilters = {},
  payloadFromPage?: BookingsPendingJobsPayload
): Promise<PendingJobsResponse> => {
  try {
    const payload: { date_from?: string; date_to?: string; search?: string; service_type?: string } = {
      ...(payloadFromPage && payloadFromPage.service_type != null && { service_type: payloadFromPage.service_type }),
    };
    if (filters.date_from) payload.date_from = filters.date_from;
    if (filters.date_to) payload.date_to = filters.date_to;
    if (filters.search?.trim()) payload.search = filters.search.trim();
    const params = new URLSearchParams();
    if (filters.index != null) params.append("index", String(filters.index));
    if (filters.limit != null) params.append("limit", String(filters.limit));
    const query = params.toString();
    const url = query
      ? `${URL.dashboard.gainedBookingsPendingJobs}?${query}`
      : URL.dashboard.gainedBookingsPendingJobs;
    const response = await postAPICall(url, payload, API_HEADER);
    return response as PendingJobsResponse;
  } catch (error) {
    console.error("Error fetching pending jobs data:", error);
    throw error;
  }
};

/** Event payload for job-list-by-event API (caller sends from page) */
export interface JobListEventPayload {
  service_type: string;
  /** Required for event-based queries (e.g. BL Released). */
  event_name?: string;
  /** Required for event-based queries (e.g. operator: "not_equal"). */
  operator?: string;
  /** Used by "invoice not raised" flow; when omitted, treated as false. */
  for_invoice?: boolean;
}

/** Job-list-by-event API: payload (event_name, service_type, operator) is passed from caller; date/search from filters */
export const getJobListByEventData = async (
  filters: CustomerServiceReportFilters,
  eventPayload: JobListEventPayload
): Promise<JobsWithoutBLReleasedResponse> => {
  try {
    const payload: {
      date_from?: string;
      date_to?: string;
      search?: string;
      event_name: string;
      service_type: string;
      operator: string;
      for_invoice: boolean;
    } = {
      event_name: eventPayload.event_name ?? "",
      service_type: eventPayload.service_type,
      operator: eventPayload.operator ?? "",
      for_invoice: eventPayload.for_invoice ?? false,
    };
    if (filters.date_from) payload.date_from = filters.date_from;
    if (filters.date_to) payload.date_to = filters.date_to;
    if (filters.search?.trim()) payload.search = filters.search.trim();
    const params = new URLSearchParams();
    if (filters.index != null) params.append("index", String(filters.index));
    if (filters.limit != null) params.append("limit", String(filters.limit));
    const query = params.toString();
    const url = query
      ? `${URL.dashboard.jobsWithoutBLReleased}?${query}`
      : URL.dashboard.jobsWithoutBLReleased;
    const response = await postAPICall(url, payload, API_HEADER);
    return response as JobsWithoutBLReleasedResponse;
  } catch (error) {
    console.error("Error fetching job list by event:", error);
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
