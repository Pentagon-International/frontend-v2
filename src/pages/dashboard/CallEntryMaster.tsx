import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ActionIcon,
  Button,
  Center,
  Group,
  Loader,
  Select,
  Text,
  TextInput,
  Grid,
  Box,
  Stack,
  Menu,
  UnstyledButton,
  Tooltip,
  Modal,
  Textarea,
  MantineProvider,
} from "@mantine/core";
import {
  IconCalendarTime,
  IconFilterFilled,
  IconPlus,
  IconSearch,
  IconFilter,
  IconEdit,
  IconDotsVertical,
  IconX,
  IconArrowLeft,
  IconFileText,
  IconPhone,
  IconList,
  IconCircleCheck,
  IconUserOff,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { getAPICall } from "../../service/getApiCall";
import { deleteApiCall } from "../../service/deleteApiCall";
import { putAPICall } from "../../service/putApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import {
  ToastNotification,
  SearchableSelect,
  DateRangeInput,
  SingleDateInput,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpListFilterUnifiedMantineStyles,
  erpListFilterFieldCellStyle,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_FILTER_FIELD_COL_SPAN_WIDE,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  type ErpListTheme,
  type ERPListColumnToggleItem,
  erpListTableElementStyle,
  erpListThStyle,
  erpListTdPaddingStyle,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListDataRowProps,
} from "../../components";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { searchAPI } from "../../service/searchApi";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { useListFilterStore } from "../../store/listFilterStore";
import useDateFormat from "../../hooks/useDateFormat";
import FormTextInput from "../../components/FormTextInput";

/** Call entry row as returned from filter/list APIs (flat row for the table). */
type CallEntryTableRow = {
  id: number;
  customer_code?: string;
  customer_name?: string;
  city?: string;
  address?: string;
  created_by?: string;
  area?: string;
  call_date?: string;
  call_mode_name?: string;
  call_mode_id?: string | number;
  followup_date?: string;
  followup_id?: string | number;
  status?: string;
  remark?: string;
  call_summary?: string;
  expected_profit?: string | number;
  latitude?: string;
  longitude?: string;
};

type CallEntryVisibleColumns = {
  sno: boolean;
  customerName: boolean;
  customerLocation: boolean;
  salesPerson: boolean;
  callEntryLocation: boolean;
  callDate: boolean;
  modeOfCall: boolean;
  followupDates: boolean;
  status: boolean;
  remark: boolean;
};

const DEFAULT_CALL_ENTRY_VISIBLE_COLUMNS: CallEntryVisibleColumns = {
  sno: true,
  customerName: true,
  customerLocation: true,
  salesPerson: true,
  callEntryLocation: true,
  callDate: true,
  modeOfCall: true,
  followupDates: true,
  status: true,
  remark: true,
};

function CallEntryStatusPill({ status }: { status: string | undefined | null }) {
  const closed = String(status || "").toUpperCase() === "CLOSE";
  const label = status || (closed ? "CLOSE" : "ACTIVE");
  const cfg = closed
    ? { label, dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c" }
    : { label, dot: "#105476", bg: "#e0f2fe", color: "#105476" };

  return (
    <Box
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 9999,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        fontFamily: DEFAULT_ERP_LIST_THEME.fontSans,
      }}
    >
      <Box
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </Box>
  );
}

type FilterState = {
  customer: string | null;
  call_date: Date | null;
  call_mode: string | null;
  followup_date: Date | null;
  status: string | null;
  sales_person: string | null;
  city: string | null;
  area: string | null;
  date_from: string | null;
  date_to: string | null;
  search?: string | null; // Optional search field for appliedFilters
};

const LIST_KEY = "CALL_ENTRY_MASTER";

type CallEntryPageResult = {
  items: any[];
  total: number;
  statusCounts: Record<string, number> | null;
};

function normalizeStatusCounts(
  raw: unknown
): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

/** Read a count from status_counts; matches keys case-insensitively. */
function getStatusCountFromMap(
  map: Record<string, number> | null | undefined,
  aliases: string[]
): number {
  if (!map) return 0;
  for (const wanted of aliases) {
    const w = wanted.toUpperCase();
    for (const [k, v] of Object.entries(map)) {
      if (k.toUpperCase() === w) return v;
    }
  }
  return 0;
}

function parseCallEntryFilterResponse(data: any): CallEntryPageResult {
  // filter_call_entries returns `results` (and may also send `data`); prefer `results` first
  let items: any[] = [];
  if (data && Array.isArray(data.results)) {
    items = data.results;
  } else if (data && Array.isArray(data.data)) {
    items = data.data;
  } else if (data && Array.isArray(data.result)) {
    items = data.result;
  }
  const statusCounts = normalizeStatusCounts(data?.summary?.status_counts);

  const totalRaw =
    data?.total ??
    data?.count ??
    data?.total_count ??
    data?.summary?.total ??
    data?.summary?.total_calls;
  let total: number;
  if (typeof totalRaw === "number" && !Number.isNaN(totalRaw)) {
    total = totalRaw;
  } else if (typeof totalRaw === "string" && totalRaw.trim() !== "") {
    const parsed = Number(totalRaw);
    total = !Number.isNaN(parsed) ? parsed : 0;
  } else if (statusCounts) {
    total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  } else {
    total = items.length;
  }
  // Ensure at least the current page row count (guards pathological server payloads on later pages)
  if (items.length > 0 && total < (data?.index ?? 0) + items.length) {
    const offset = Number(data?.index);
    if (!Number.isNaN(offset) && offset >= 0) {
      total = Math.max(total, offset + items.length);
    }
  }

  return { items, total, statusCounts };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Column-header filter primitives (CallEntryMaster)
 *
 * Mirrors the EnquiryMaster / LeadList pattern: a click on the column header
 * label collapses it into an inline editor (`FilterableHeaderEdit`) which
 * auto-focuses, auto-blurs back to the label, and supports Escape to cancel.
 * Each filterable column can supply a richer `renderInput` (Select /
 * SearchableSelect / SingleDateInput) so the header reuses the SAME control
 * the advanced-filter drawer offers — single source of truth, identical API
 * payload shape (no new payload keys, no client-side filtering).
 *
 * The default fallback `HeaderFilterInput` uses a local typing buffer + 1000ms
 * debounced commit so React Query does not refetch on every keystroke.
 * ─────────────────────────────────────────────────────────────────────────── */

export type CallEntryHeaderFilterKey =
  | "customer"
  | "city"
  | "sales_person"
  | "area"
  | "call_date"
  | "call_mode"
  | "followup_date"
  | "status";

export type CallEntryHeaderFilterValues = Record<CallEntryHeaderFilterKey, string>;

export type CallEntryHeaderInputContext = {
  /** Whether the input should auto-focus on mount. */
  autoFocus: boolean;
  /** Imperatively collapse the cell back to label mode (after a pick). */
  onClose: () => void;
};

export type CallEntryHeaderRenderInput = (
  ctx: CallEntryHeaderInputContext,
) => ReactNode;

type CallEntryEditingColumn = CallEntryHeaderFilterKey | null;

const CALL_ENTRY_HEADER_FILTER_TEXTINPUT_STYLES = {
  input: {
    height: 26,
    minHeight: 26,
    fontSize: 12,
    paddingLeft: 8,
    paddingRight: 24,
  },
} as const;

/**
 * Stable `classNames` for the date column-header `SingleDateInput`s. Kept at
 * module scope so the object reference does not churn `renderInput`'s memo.
 */
const CALL_ENTRY_HEADER_DATE_INPUT_CLASSNAMES: Record<string, string> = {
  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
};

/** Fallback TextInput editor used when no `renderInput` is supplied for a column. */
function HeaderFilterInput({
  value,
  onChange,
  placeholder = "Filter...",
  ariaLabel,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  // Local typing buffer. Keep every keystroke local and only bubble the value
  // upstream after 1000ms of idle, so React Query does not refetch on every
  // character. The X-clear button bypasses this debounce for a snappy discrete
  // UX. External value changes (Clear-All, restore, advanced-filter Apply) are
  // synced back into the local buffer via the effect below.
  const [localValue, setLocalValue] = useState(value);
  const [debouncedLocalValue] = useDebouncedValue(localValue, 1000);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current || value === "") {
      setLocalValue(value);
      lastEmittedRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debouncedLocalValue !== lastEmittedRef.current) {
      lastEmittedRef.current = debouncedLocalValue;
      onChange(debouncedLocalValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLocalValue]);

  return (
    <TextInput
      size="xs"
      value={localValue}
      onChange={(e) => setLocalValue(e.currentTarget.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      styles={CALL_ENTRY_HEADER_FILTER_TEXTINPUT_STYLES}
      rightSection={
        localValue ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            color="gray"
            onMouseDown={(e) => {
              // Prevent the input from blurring before our handler can fire
              e.preventDefault();
            }}
            onClick={() => {
              // Discrete user action -- commit immediately, bypass debounce.
              setLocalValue("");
              lastEmittedRef.current = "";
              onChange("");
            }}
            aria-label={`Clear ${ariaLabel}`}
          >
            <IconX size={12} />
          </ActionIcon>
        ) : null
      }
    />
  );
}

/** Clickable header label that opens the inline editor; shows the active filter when set. */
function FilterableHeaderLabel({
  label,
  filterDisplay,
  onClick,
  theme,
  align = "left",
}: {
  label: string;
  filterDisplay: string;
  onClick: () => void;
  theme: { fontSans: string; muted: string };
  align?: "left" | "center" | "right";
}) {
  const isFiltered = filterDisplay.length > 0;
  return (
    <UnstyledButton
      onClick={onClick}
      className="erp-header-filter-fade"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        fontFamily: theme.fontSans,
        fontWeight: 500,
        cursor: "pointer",
        textAlign: align,
        justifyContent:
          align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
      }}
      title={
        isFiltered
          ? `Filter: ${filterDisplay}\nClick to edit`
          : `Click to filter`
      }
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {isFiltered ? filterDisplay : label}
      </span>
      {isFiltered && <IconFilterFilled size={14} color={theme.muted} />}
    </UnstyledButton>
  );
}

/**
 * Wraps the editor input(s). Auto-focuses children on mount, collapses on
 * Escape, and collapses on blur once focus leaves the cell entirely (so a
 * Tab inside the cell does not flicker the editor closed).
 */
function FilterableHeaderEdit({
  onCollapse,
  children,
  style,
}: {
  /**
   * Must use the functional-set form
   * (`setState((cur) => cur === me ? null : cur)`) so a click on a different
   * header that already switched the editing column is not undone by this
   * collapse handler.
   */
  onCollapse: () => void;
  children: ReactNode;
  /** Extra style merged onto the wrapper (e.g. absolute positioning over the label). */
  style?: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback(
    (_e: ReactFocusEvent) => {
      setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!container.contains(document.activeElement)) {
          onCollapse();
        }
      }, 0);
    },
    [onCollapse],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === "Escape") {
        onCollapse();
      }
    },
    [onCollapse],
  );

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="erp-header-filter-fade"
      style={{ width: "100%", minWidth: 0, boxSizing: "border-box", ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

function CallEntry() {
  // Get first day of current month and today's date
  const getDefaultFromDate = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const getDefaultToDate = (): Date => {
    return new Date();
  };

  const dateFormat = useDateFormat();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const queryClient = useQueryClient();

  // Date range state
  const [fromDate, setFromDate] = useState<Date | null>(getDefaultFromDate());
  const [toDate, setToDate] = useState<Date | null>(getDefaultToDate());
  const isMountedRef = useRef(false);
  /** When true, unfiltered fetch omits the default current-month date range (user cleared dates and applied). */
  const skipDefaultDateRangeRef = useRef(false);
  const [skipDefaultDateRange, setSkipDefaultDateRange] = useState(false);
  const setSkipDefaultDateRangeValue = (skip: boolean) => {
    skipDefaultDateRangeRef.current = skip;
    setSkipDefaultDateRange(skip);
  };

  // Store initial dates for the main query (these won't change when user modifies dates)
  const initialFromDateRef = useRef<Date | null>(getDefaultFromDate());
  const initialToDateRef = useRef<Date | null>(getDefaultToDate());

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      customer: null,
      call_date: null,
      call_mode: null,
      followup_date: null,
      status: null,
      sales_person: null,
      city: null,
      area: null,
      date_from: null,
      date_to: null,
    },
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Refs to persist returnToDashboard flag and dashboard state
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard)
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state
  const fromDashboardRef = useRef<boolean>(
    Boolean(location.state?.fromDashboard)
  ); // Track if page was opened from dashboard
  const initialFiltersProcessed = useRef(false);
  const isProcessingInitialFilters = useRef(false); // Track if we're currently processing initial filters

  //Search Debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 1000);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<CallEntryVisibleColumns>(
    DEFAULT_CALL_ENTRY_VISIBLE_COLUMNS
  );
  const [filtersApplied, setFiltersApplied] = useState(false);
  const prevSearchRef = useRef<string>(searchQuery);
  const [isClosingCallEntry, setIsClosingCallEntry] = useState(false);
  const [closeModalOpened, { open: openCloseModal, close: closeCloseModal }] =
    useDisclosure(false);
  const [selectedCallEntryForClose, setSelectedCallEntryForClose] = useState<CallEntryTableRow | null>(
    null
  );
  const [remark, setRemark] = useState<string>("");
  const [openedMenuRowId, setOpenedMenuRowId] = useState<number | null>(null);
  const hasRestoredFromStore = useRef(false);

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const clearStoreAll = useListFilterStore((state) => state.clearAll);
  const clearStoreAllExcept = useListFilterStore(
    (state) => state.clearAllExcept
  );

  // Store display values (labels) for SearchableSelect fields
  const [customerDisplayValue, setCustomerDisplayValue] = useState<
    string | null
  >(null);

  // Debounced search effect (1000ms to match column-header debounce behaviour)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 1000);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Remove old state variables since React Query handles this now

  /** Unfiltered list: only fetch when not using filtered/search API (avoids duplicate requests & wrong totals). */
  const isFilteredOrSearchActive =
    filtersApplied || Boolean(debouncedSearch.trim());

  // Fetch call entry data with React Query - using filter API with date range on initial mount
  const {
    data: callEntryResult = { items: [], total: 0, statusCounts: null },
    isLoading: callEntryLoading,
    isFetching: callEntryFetching,
    refetch: refetchCallEntries,
  } = useQuery({
    queryKey: ["callEntries", pageIndex, pageSize, skipDefaultDateRange],
    enabled: !isFilteredOrSearchActive,
    /** Keeps prior page totals/rows while the next page loads — avoids total→0 and clamp resetting pageIndex to 0. */
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      try {
        // Use dates from location.state if available (from Dashboard), otherwise use initial dates
        // Dates are not in queryKey so changes won't trigger refetch
        // Only Apply Filters button will use the new dates via appliedFilters
        const requestBody: { filters: any } = { filters: {} };

        // Use default date range for initial load (unless user cleared dates and applied)
        let dateFrom: string | null = null;
        let dateTo: string | null = null;

        if (
          !skipDefaultDateRangeRef.current &&
          initialFromDateRef.current &&
          initialToDateRef.current
        ) {
          dateFrom = dayjs(initialFromDateRef.current).format("YYYY-MM-DD");
          dateTo = dayjs(initialToDateRef.current).format("YYYY-MM-DD");
        }

        // Add date range if both dates are available
        if (dateFrom && dateTo) {
          requestBody.filters = {
            date_from: dateFrom,
            date_to: dateTo,
          };
        }

        const index = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.filter_call_entries}?index=${index}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        return parseCallEntryFilterResponse(data);
      } catch (error) {
        console.error("Error fetching call entry data:", error);
        return { items: [], total: 0, statusCounts: null };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: !!location.state?.refreshData, // Refetch on mount if we have refresh flag
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    customer: null,
    call_date: null,
    call_mode: null,
    followup_date: null,
    status: null,
    sales_person: null,
    city: null,
    area: null,
    date_from: null,
    date_to: null,
  });

  // Separate query for filtered data - triggers on Apply Filters, Clear Filters, Search changes, Navigation back
  const {
    data: filteredCallEntryResult = { items: [], total: 0, statusCounts: null },
    isLoading: filteredCallEntryLoading,
    isFetching: filteredCallEntryFetching,
    refetch: refetchFilteredCallEntries,
  } = useQuery({
    queryKey: [
      "filteredCallEntries",
      filtersApplied,
      appliedFilters,
      debouncedSearch, // Include debouncedSearch in queryKey to trigger on search changes
      pageIndex,
      pageSize,
    ],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      try {
        const filterPayload = buildFilterPayload();
        
        // If no filters and no search, return empty (will use unfiltered data)
        if (Object.keys(filterPayload).length === 0) {
          console.log("No filters or search, skipping API call");
          return { items: [], total: 0, statusCounts: null };
        }

        const requestBody = { filters: filterPayload };
        console.log("📤 API Call - Applying filters + search:", {
          payload: filterPayload,
          filtersApplied,
          searchQuery,
          debouncedSearch,
        });

        const index = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.filter_call_entries}?index=${index}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Filter API response:", data);

        return parseCallEntryFilterResponse(data);
      } catch (error) {
        console.error("Error fetching filtered call entry data:", error);
        return { items: [], total: 0, statusCounts: null };
      }
    },
    // Disable query during refreshData to prevent auto-trigger from queryKey changes
    // Only manually refetch after state is fully restored
    enabled: (filtersApplied || Boolean(debouncedSearch.trim())) && !isRefreshingData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Clear all store entries except this page's key on mount
  useEffect(() => {
    clearStoreAllExcept(LIST_KEY);
  }, []);

  // Restore filters and search from store on mount (before API calls)
  useEffect(() => {
    if (hasRestoredFromStore.current) return;

    const restoredState = useListFilterStore.getState().getState(LIST_KEY);
    

    const performRestore = async () => {
      if (!restoredState) {
        return; // No stored state, use defaults
      }

      // Restore filters
      let hasFilters = false;
      const restoredFilters = restoredState.filters as FilterState;
      if (restoredFilters && Object.keys(restoredFilters).length > 0) {
        // Restore filter form values
        filterForm.setValues({
          customer: restoredFilters.customer || null,
          call_date: restoredFilters.call_date
            ? (typeof restoredFilters.call_date === 'string'
                ? dayjs(restoredFilters.call_date, "YYYY-MM-DD", true).toDate()
                : restoredFilters.call_date)
            : null,
          call_mode: restoredFilters.call_mode || null,
          followup_date: restoredFilters.followup_date
            ? (typeof restoredFilters.followup_date === 'string'
                ? dayjs(restoredFilters.followup_date, "YYYY-MM-DD", true).toDate()
                : restoredFilters.followup_date)
            : null,
          status: restoredFilters.status || null,
          sales_person: restoredFilters.sales_person || null,
          city: restoredFilters.city || null,
          area: restoredFilters.area || null,
          date_from: restoredFilters.date_from || null,
          date_to: restoredFilters.date_to || null,
        });

        // Restore date range if available; otherwise keep dates cleared
        if (restoredFilters.date_from && restoredFilters.date_to) {
          const parsedFrom = dayjs(restoredFilters.date_from, "YYYY-MM-DD", true);
          const parsedTo = dayjs(restoredFilters.date_to, "YYYY-MM-DD", true);
          if (parsedFrom.isValid()) setFromDate(parsedFrom.toDate());
          if (parsedTo.isValid()) setToDate(parsedTo.toDate());
          setSkipDefaultDateRangeValue(false);
        } else {
          setFromDate(null);
          setToDate(null);
          setSkipDefaultDateRangeValue(true);
        }

        hasFilters = Boolean(
          restoredFilters.customer ||
          restoredFilters.call_date ||
          restoredFilters.call_mode ||
          restoredFilters.followup_date ||
          restoredFilters.status ||
          restoredFilters.sales_person ||
          restoredFilters.city ||
          restoredFilters.area ||
          (restoredFilters.date_from && restoredFilters.date_to)
        );
      }

      // Restore the customer display label so the SearchableSelect and the
      // column header show the friendly name (not the raw customer_code).
      const restoredCustomerLabel = restoredState.displayValues?.customer;
      if (typeof restoredCustomerLabel === "string" && restoredCustomerLabel) {
        setCustomerDisplayValue(restoredCustomerLabel);
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

      // Set applied filters and filtersApplied if we have filters or search
      if (hasFilters || hasSearch) {
        const restoredDateFrom = restoredFilters?.date_from || null;
        const restoredDateTo = restoredFilters?.date_to || null;

        setAppliedFilters({
          customer: restoredFilters?.customer || null,
          call_date: restoredFilters?.call_date || null,
          call_mode: restoredFilters?.call_mode || null,
          followup_date: restoredFilters?.followup_date || null,
          status: restoredFilters?.status || null,
          sales_person: restoredFilters?.sales_person || null,
          city: restoredFilters?.city || null,
          area: restoredFilters?.area || null,
          date_from: restoredDateFrom,
          date_to: restoredDateTo,
          search: restoredState.search || null,
        });

        setFiltersApplied(true);
        // Invalidate query to trigger refetch with restored filters/search
        queryClient.invalidateQueries({
          queryKey: ["filteredCallEntries"],
        });
      }
    };

    if(restoredState?.shouldRestore){
      performRestore();
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync refs with location.state when it changes
  useEffect(() => {
    if (location.state?.returnToDashboard !== undefined) {
      returnToDashboardRef.current = Boolean(location.state.returnToDashboard);
    }
    if (location.state?.dashboardState !== undefined) {
      dashboardStateRef.current = location.state.dashboardState;
    }
    if (location.state?.fromDashboard !== undefined) {
      fromDashboardRef.current = Boolean(location.state.fromDashboard);
    }
  }, [
    location.state?.returnToDashboard,
    location.state?.dashboardState,
    location.state?.fromDashboard,
  ]);

  // Apply filters when navigated from call entry dashboard (drill level badge click)
  // Dashboard passes initialFilters + restoreFilters in location.state; listFilterStore is only used when returning from edit.
  useEffect(() => {
    if (initialFiltersProcessed.current) return;
    const state = location.state as {
      fromDashboard?: boolean;
      restoreFilters?: {
        filters: Partial<FilterState>;
        displayValues?: { customer?: string | null };
        fromDate?: Date | null;
        toDate?: Date | null;
        filtersApplied?: boolean;
      };
      initialFilters?: {
        sales_person?: string | null;
        customer?: string | null;
        status?: string | null;
        date_from?: string;
        date_to?: string;
      };
    } | null;
    if (!state?.fromDashboard) return;
    const restoreFilters = state.restoreFilters;
    const initialFilters = state.initialFilters;
    if (!restoreFilters && !initialFilters) return;

    initialFiltersProcessed.current = true;
    isProcessingInitialFilters.current = true;

    const filters = restoreFilters?.filters ?? {
      sales_person: initialFilters?.sales_person ?? null,
      customer: initialFilters?.customer ?? null,
      status: initialFilters?.status ?? null,
      call_date: null,
      call_mode: null,
      followup_date: null,
      city: null,
      area: null,
    };
    const displayValues = restoreFilters?.displayValues ?? {};
    const fromDateVal = restoreFilters?.fromDate ?? (initialFilters?.date_from ? new Date(initialFilters.date_from) : null);
    const toDateVal = restoreFilters?.toDate ?? (initialFilters?.date_to ? new Date(initialFilters.date_to) : null);
    const dateFromStr = initialFilters?.date_from ?? (fromDateVal ? dayjs(fromDateVal).format("YYYY-MM-DD") : null);
    const dateToStr = initialFilters?.date_to ?? (toDateVal ? dayjs(toDateVal).format("YYYY-MM-DD") : null);

    filterForm.setValues({
      customer: filters.customer ?? null,
      call_date: filters.call_date ?? null,
      call_mode: filters.call_mode ?? null,
      followup_date: filters.followup_date ?? null,
      status: filters.status ?? null,
      sales_person: filters.sales_person ?? null,
      city: filters.city ?? null,
      area: filters.area ?? null,
      date_from: dateFromStr,
      date_to: dateToStr,
    });

    if (fromDateVal) setFromDate(fromDateVal);
    if (toDateVal) setToDate(toDateVal);
    setCustomerDisplayValue(displayValues.customer ?? (filters.customer ? String(filters.customer) : null));

    setAppliedFilters({
      customer: filters.customer ?? null,
      call_date: filters.call_date ?? null,
      call_mode: filters.call_mode ?? null,
      followup_date: filters.followup_date ?? null,
      status: filters.status ?? null,
      sales_person: filters.sales_person ?? null,
      city: filters.city ?? null,
      area: filters.area ?? null,
      date_from: dateFromStr,
      date_to: dateToStr,
    });
    setFiltersApplied(true);

    // Persist to listFilterStore so back-navigation and refresh behave consistently
    setStoreFilters(LIST_KEY, {
      ...filters,
      date_from: dateFromStr,
      date_to: dateToStr,
    });
    if (displayValues.customer != null) {
      useListFilterStore.getState().setDisplayValues(LIST_KEY, { customer: displayValues.customer });
    }

    // Clear initial filters from state so we don't re-apply on re-render; keep dashboard return state
    navigate(location.pathname, {
      replace: true,
      state: {
        returnToDashboard: returnToDashboardRef.current,
        dashboardState: dashboardStateRef.current,
        fromDashboard: fromDashboardRef.current,
      },
    });

    isProcessingInitialFilters.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.fromDashboard, location.state?.restoreFilters, location.state?.initialFilters, location.pathname]);

  // Note: Filter and search restoration from listFilterStore runs when shouldRestore (e.g. return from edit). Dashboard filters applied above.

  // Load data on mount with default dates - API only hits on Apply Filters button
  // Date changes don't trigger API automatically - only Apply Filters button does

  // Ref to prevent search change effect from triggering during refreshData restoration
  const isRefreshingDataRef = useRef(false);

  // Handle search changes - trigger API when search value changes (debounced)
  useEffect(() => {
    // Skip if component is not ready
    if (!hasRestoredFromStore.current) {
      prevSearchRef.current = debouncedSearch;
      return;
    }

    // Skip if we're currently refreshing data (prevent multiple API calls during refreshData)
    if (isRefreshingDataRef.current) {
      prevSearchRef.current = debouncedSearch;
      return;
    }

    // Only trigger API if search actually changed (debounced)
    if (prevSearchRef.current === debouncedSearch) {
      return;
    }

    // Update ref for next comparison
    prevSearchRef.current = debouncedSearch;

    setPageIndex(0);

    // Save search to store immediately
    setStoreSearch(LIST_KEY, searchQuery);
    
    // Trigger API with loading state
    setIsRefreshingData(true);
    
    if (debouncedSearch.trim() !== "") {
      // Search exists - trigger filtered API (search will be merged with filters in buildFilterPayload)
      refetchFilteredCallEntries()
        .then(() => {
          setFiltersApplied(true);
        })
        .then(() => {
          setIsRefreshingData(false);
        })
        .catch(() => {
          setIsRefreshingData(false);
        });
    } else {
      // Search cleared - check if we have other filters
      const hasOtherFilters =
        appliedFilters.customer ||
        appliedFilters.call_date ||
        appliedFilters.call_mode ||
        appliedFilters.followup_date ||
        appliedFilters.status ||
        appliedFilters.sales_person ||
        appliedFilters.city ||
        appliedFilters.area ||
        (fromDate && toDate);

      if (hasOtherFilters) {
        // Still have filters - refetch filtered data
        refetchFilteredCallEntries()
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch(() => {
            setIsRefreshingData(false);
          });
      } else {
        // No filters - show unfiltered data
        setFiltersApplied(false);
        refetchCallEntries()
          .then(() => {
            setIsRefreshingData(false);
          })
          .catch(() => {
            setIsRefreshingData(false);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Handle refresh when navigating from create/edit operations
  useEffect(() => {
    if (location.state?.refreshData) {
      console.log("🔄 Refreshing data after create/edit operation");
      
      // Mark that we're handling refreshData so search change effect doesn't interfere
      if (!hasRestoredFromStore.current) {
        hasRestoredFromStore.current = true;
      }
      
      // Set flag to prevent search change effect from triggering
      isRefreshingDataRef.current = true;
      setIsRefreshingData(true);

      // Clear the refresh flag but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });

      // Restore from store and refresh data - SINGLE API CALL ONLY
      const refreshData = async () => {
        try {
          // Check if we have filters or search from store
          const restoredState = useListFilterStore.getState().getState(LIST_KEY);
          const hasActiveFilters = restoredState?.filters && Object.keys(restoredState.filters).length > 0;
          const hasActiveSearch = restoredState?.search && restoredState.search.trim() !== "";

          // If we have filters/search in store but not in state, restore them first
          if (restoredState && (hasActiveFilters || hasActiveSearch)) {
            // Restore filters from store if they exist
            if (hasActiveFilters) {
              const restoredFilters = restoredState.filters as FilterState;
              filterForm.setValues({
                customer: restoredFilters.customer || null,
                call_date: restoredFilters.call_date
                  ? (typeof restoredFilters.call_date === 'string'
                      ? dayjs(restoredFilters.call_date, "YYYY-MM-DD", true).toDate()
                      : restoredFilters.call_date)
                  : null,
                call_mode: restoredFilters.call_mode || null,
                followup_date: restoredFilters.followup_date
                  ? (typeof restoredFilters.followup_date === 'string'
                      ? dayjs(restoredFilters.followup_date, "YYYY-MM-DD", true).toDate()
                      : restoredFilters.followup_date)
                  : null,
                status: restoredFilters.status || null,
                sales_person: restoredFilters.sales_person || null,
                city: restoredFilters.city || null,
                area: restoredFilters.area || null,
              });

              // Restore date range
              if (restoredFilters.date_from && restoredFilters.date_to) {
                const parsedFrom = dayjs(restoredFilters.date_from, "YYYY-MM-DD", true);
                const parsedTo = dayjs(restoredFilters.date_to, "YYYY-MM-DD", true);
                if (parsedFrom.isValid()) setFromDate(parsedFrom.toDate());
                if (parsedTo.isValid()) setToDate(parsedTo.toDate());
                setSkipDefaultDateRangeValue(false);
              } else {
                setFromDate(null);
                setToDate(null);
                setSkipDefaultDateRangeValue(true);
              }

              setAppliedFilters({
                customer: restoredFilters.customer || null,
                call_date: restoredFilters.call_date || null,
                call_mode: restoredFilters.call_mode || null,
                followup_date: restoredFilters.followup_date || null,
                status: restoredFilters.status || null,
                sales_person: restoredFilters.sales_person || null,
                city: restoredFilters.city || null,
                area: restoredFilters.area || null,
                date_from: restoredFilters.date_from || null,
                date_to: restoredFilters.date_to || null,
                search: restoredState.search || null,
              });
            }

            // Restore the customer display label (friendly name) so it shows
            // correctly in the column header / advanced filter after refresh.
            const restoredCustomerLabel =
              restoredState.displayValues?.customer;
            if (
              typeof restoredCustomerLabel === "string" &&
              restoredCustomerLabel
            ) {
              setCustomerDisplayValue(restoredCustomerLabel);
            }

            // Restore search from store if it exists (update prevSearchRef to prevent search effect trigger)
            if (hasActiveSearch) {
              setSearchQuery(restoredState.search);
              prevSearchRef.current = restoredState.search; // Update to prevent search effect from triggering
            }

            // Wait for state updates to flush before calling API
            await new Promise((resolve) => setTimeout(resolve, 250));
          }

          // Determine if we should fetch filtered data - SINGLE API CALL
          const finalState = useListFilterStore.getState().getState(LIST_KEY);
          const finalHasActiveFilters = finalState?.filters && Object.keys(finalState.filters).length > 0;
          const finalHasActiveSearch = finalState?.search && finalState.search.trim() !== "";

          // Wait a bit more to ensure all state updates are flushed and query is disabled
          await new Promise((resolve) => setTimeout(resolve, 100));

          if (finalHasActiveFilters || finalHasActiveSearch) {
            console.log("✅ [refreshData] Fetching filtered data with preserved filters");
            // Set filtersApplied - query is disabled so won't auto-trigger
            setFiltersApplied(true);
            // Wait for state updates to flush (query remains disabled during this time)
            await new Promise((resolve) => setTimeout(resolve, 150));
            // Now enable query and manually refetch in one atomic operation
            // This ensures only ONE API call - query won't auto-trigger because we refetch immediately
            isRefreshingDataRef.current = false;
            setIsRefreshingData(false);
            // Use refetch directly - query is now enabled, but refetch ensures single call
            await refetchFilteredCallEntries();
          } else {
            console.log("🔄 [refreshData] Fetching unfiltered data");
            // Set filtersApplied - query is disabled so won't auto-trigger
            setFiltersApplied(false);
            // Wait for state to update (query remains disabled)
            await new Promise((resolve) => setTimeout(resolve, 150));
            // Release flag and refetch unfiltered data
            isRefreshingDataRef.current = false;
            setIsRefreshingData(false);
            await refetchCallEntries();
          }
        } catch (error) {
          console.error("Error refreshing data:", error);
          // Always release flag on error
          isRefreshingDataRef.current = false;
          setIsRefreshingData(false);
        } finally {
          // Ensure flag is cleared even if there's an error
          setIsRefreshingData(false);
        }
      };

      refreshData();
    }
  }, [
    location.state?.refreshData,
    navigate,
    location.pathname,
    filterForm,
  ]);

  // Note: Filter and search restoration from location.state removed - now handled via listFilterStore

  // Removed raw customer API call - using SearchableSelect for dynamic loading

  // Optimized call mode data query with memoization
  const {
    data: rawCallModeData = [],
    isLoading: callModeDataLoading,
    isError: callModeDataError,
  } = useQuery({
    queryKey: ["callModes"],
    queryFn: async () => {
      try {
        const callModeResponse = (await getAPICall(
          URL.callMode,
          API_HEADER
        )) as any[];
        return callModeResponse;
      } catch (error) {
        console.error("Error fetching call mode data:", error);
        return [];
      }
    },
    staleTime: Infinity, // Never refetch since it's master data
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const callModeOptionsData = useMemo(() => {
    if (!Array.isArray(rawCallModeData) || !rawCallModeData.length) return [];

    return rawCallModeData
      .filter((item: any) => item.id && item.callmode_name) // Filter out items with null/undefined values
      .map((item: any) => ({
        value: String(item.id),
        label: item.callmode_name,
      }))
      .filter(
        (option, index, self) =>
          // Remove duplicates based on value
          index === self.findIndex((o) => o.value === option.value)
      );
  }, [rawCallModeData]);
  console.log("callModeOptionsData---", callModeOptionsData);

  // Optimized follow-up action data query with memoization
  const {
    data: rawFollowUpActionData = [],
    isLoading: followUpActionDataLoading,
    isError: followUpActionDataError,
  } = useQuery({
    queryKey: ["followUpActions"],
    queryFn: async () => {
      try {
        const followUpResponse = (await getAPICall(
          URL.followUpAction,
          API_HEADER
        )) as any[];
        return followUpResponse;
      } catch (error) {
        console.error("Error fetching follow-up action data:", error);
        return [];
      }
    },
    staleTime: Infinity, // Never refetch since it's master data
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const followUpActionOptionsData = useMemo(() => {
    if (!Array.isArray(rawFollowUpActionData) || !rawFollowUpActionData.length)
      return [];
    console.log("rawFollowUpActionData---", rawFollowUpActionData);

    return rawFollowUpActionData
      .filter((item: any) => item.id && item.followup_name) // Filter out items with null/undefined values
      .map((item: any) => ({
        value: String(item.id),
        label: item.followup_name,
      }))
      .filter(
        (option, index, self) =>
          // Remove duplicates based on value
          index === self.findIndex((o) => o.value === option.value)
      );
  }, [rawFollowUpActionData]);
  console.log("followUpActionOptionsData---", followUpActionOptionsData);

  // Helper function to build filter payload (includes search in filters:{})
  // Moved here to ensure followUpActionOptionsData is available
  const buildFilterPayload = useCallback(() => {
    const payload: any = {};

    // Add date range if both dates are selected
    if (fromDate && toDate) {
      payload.date_from = dayjs(fromDate).format("YYYY-MM-DD");
      payload.date_to = dayjs(toDate).format("YYYY-MM-DD");
    }

    if (appliedFilters.customer) payload.customer_code = appliedFilters.customer;
    if (appliedFilters.call_date)
      payload.call_date = dayjs(appliedFilters.call_date).format("YYYY-MM-DD");
    if (appliedFilters.call_mode) payload.call_mode_id = appliedFilters.call_mode;
    if (appliedFilters.followup_date)
      payload.followup_date = dayjs(appliedFilters.followup_date).format("YYYY-MM-DD");
    if (appliedFilters.status) {
      // Check if status is from dashboard
      const dashboardStatuses = ["OVERDUE", "TODAY", "UPCOMING", "CLOSED"];
      const isDashboardStatus = dashboardStatuses.includes(
        String(appliedFilters.status).toUpperCase()
      );

      if (isDashboardStatus) {
        payload.status = appliedFilters.status;
      } else {
        // From filter form - find the followup action name by ID
        const selectedFollowUp = followUpActionOptionsData.find(
          (option: any) => option.value === appliedFilters.status
        );
        payload.followup_action_name =
          selectedFollowUp?.label || appliedFilters.status;
      }
    }
    if (appliedFilters.sales_person) payload.created_by = appliedFilters.sales_person;
    if (appliedFilters.city) payload.city = appliedFilters.city;
    if (appliedFilters.area) payload.area = appliedFilters.area;

    // Include search in filters:{} payload
    if (debouncedSearch.trim()) {
      payload.search = debouncedSearch.trim();
    } else if (searchQuery.trim()) {
      payload.search = searchQuery.trim();
    }

    return payload;
  }, [appliedFilters, fromDate, toDate, debouncedSearch, searchQuery, followUpActionOptionsData]);

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

  // Search data with React Query - DISABLED: search is now handled via filter API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _searchData, isLoading: _searchLoading } = useQuery({
    queryKey: ["callEntrySearch", debounced],
    queryFn: async () => {
      if (!debounced.trim()) return null;
      try {
        const result = await searchAPI(debounced, new AbortController().signal);
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error("Search API Error:", error);
        return [];
      }
    },
    enabled: false, // Disabled - search is now handled via filter API
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Determine which data to display (server-paginated page from active query)
  const displayData = useMemo(() => {
    if (isFilteredOrSearchActive) {
      return filteredCallEntryResult.items;
    }
    console.log("Displaying unfiltered data:", callEntryResult.items);
    return callEntryResult.items || [];
  }, [
    callEntryResult.items,
    filteredCallEntryResult.items,
    isFilteredOrSearchActive,
  ]);

  const totalRecords = useMemo(() => {
    const raw = isFilteredOrSearchActive
      ? filteredCallEntryResult.total
      : callEntryResult.total;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    return 0;
  }, [
    isFilteredOrSearchActive,
    filteredCallEntryResult.total,
    callEntryResult.total,
  ]);

  useEffect(() => {
    if (pageSize <= 0) return;
    const listFetching = isFilteredOrSearchActive
      ? filteredCallEntryFetching
      : callEntryFetching;
    /** While fetching the next/prev page, totals can briefly go stale — never clamp page during that window. */
    if (listFetching) return;
    const totalPagesCount = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (pageIndex > totalPagesCount - 1) {
      setPageIndex(Math.max(0, totalPagesCount - 1));
    }
  }, [
    totalRecords,
    pageSize,
    pageIndex,
    isFilteredOrSearchActive,
    filteredCallEntryFetching,
    callEntryFetching,
  ]);

  // Loading state - show loader until API response is received
  const isLoading = useMemo(() => {
    if (isClosingCallEntry || isRefreshingData) return true;
    if (isFilteredOrSearchActive) {
      return filteredCallEntryLoading || filteredCallEntryFetching;
    }
    return callEntryLoading || callEntryFetching;
  }, [
    callEntryLoading,
    callEntryFetching,
    filteredCallEntryLoading,
    filteredCallEntryFetching,
    isFilteredOrSearchActive,
    isClosingCallEntry,
    isRefreshingData,
  ]);

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values (including date range)
      const hasFilterValues =
        filterForm.values.customer ||
        filterForm.values.call_date ||
        filterForm.values.call_mode ||
        filterForm.values.followup_date ||
        filterForm.values.status ||
        filterForm.values.sales_person ||
        filterForm.values.city ||
        filterForm.values.area ||
        (fromDate && toDate);

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data (do not re-inject current-month dates)
        setSkipDefaultDateRangeValue(true);
        setPageIndex(0);
        setFiltersApplied(false);
        setAppliedFilters({
          customer: null,
          call_date: null,
          call_mode: null,
          followup_date: null,
          status: null,
          sales_person: null,
          city: null,
          area: null,
          date_from: null,
          date_to: null,
        });

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
        await refetchCallEntries();
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        console.log("No filter values provided, showing unfiltered data");
        return;
      }

      setSkipDefaultDateRangeValue(!(fromDate && toDate));
      setPageIndex(0); // Reset to first page when applying filters
      setFiltersApplied(true); // Mark filters as applied

      // Prepare filters object for storage (without search, as it's stored separately)
      const filtersToStore: FilterState = {
        customer: filterForm.values.customer,
        call_date: filterForm.values.call_date,
        call_mode: filterForm.values.call_mode,
        followup_date: filterForm.values.followup_date,
        status: filterForm.values.status,
        sales_person: filterForm.values.sales_person,
        city: filterForm.values.city,
        area: filterForm.values.area,
        // Only add date filters if both dates are selected
        date_from:
          fromDate && toDate ? dayjs(fromDate).format("YYYY-MM-DD") : null,
        date_to: fromDate && toDate ? dayjs(toDate).format("YYYY-MM-DD") : null,
      };

      // Store the current filter form values as applied filters (include search)
      setAppliedFilters({
        ...filtersToStore,
        search: debouncedSearch.trim() || null,
      });

      // Store filters and search in the list store
      setStoreFilters(LIST_KEY, filtersToStore);
      setStoreSearch(LIST_KEY, searchQuery.trim() || "");
      // Persist the customer display label so the friendly name (and not just
      // the raw customer_code) is shown after navigating back from edit / view.
      useListFilterStore.getState().setDisplayValues(LIST_KEY, {
        customer: customerDisplayValue,
      });

      setShowFilters(false);

      // Trigger API refetch
      setIsRefreshingData(true);
      await refetchFilteredCallEntries();
      setIsRefreshingData(false);

      console.log("Filters applied successfully");
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset(); // Reset form to initial values
    setSearchQuery("");
    setDebouncedSearch(""); // keep in sync with search immediately (debounce would delay filtered vs unfiltered mode)
    prevSearchRef.current = "";
    setPageIndex(0);
    setFiltersApplied(false); // Reset filters applied state

    // Reset applied filters state
    setAppliedFilters({
      customer: null,
      call_date: null,
      call_mode: null,
      followup_date: null,
      status: null,
      sales_person: null,
      city: null,
      area: null,
      date_from: null,
      date_to: null,
      search: null,
    });

    // Reset to initial date range (first day of month to today)
    setSkipDefaultDateRangeValue(false);
    setFromDate(getDefaultFromDate());
    setToDate(getDefaultToDate());

    // Clear display values
    setCustomerDisplayValue(null);

    // Clear filters and search from store
    clearStoreFilters(LIST_KEY);
    clearStoreSearch(LIST_KEY);
    // `clearStoreFilters` deliberately preserves displayValues, so we explicitly
    // null the customer label here to avoid a stale label after a full clear.
    useListFilterStore.getState().setDisplayValues(LIST_KEY, {
      customer: null,
    });

    // Trigger API with initial payload (date range only)
    setIsRefreshingData(true);
    await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredCallEntries"] });
    await queryClient.removeQueries({ queryKey: ["filteredCallEntries"] }); // Remove filtered data from cache
    await refetchCallEntries();
    setIsRefreshingData(false);

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const handleDelete = async (value: any) => {
    try {
      const res = await deleteApiCall(URL.callEntry, API_HEADER, value);
      await refetchCallEntries();

      ToastNotification({
        type: "success",
        message: `Call Entry is successfully deleted`,
      });
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message}`,
      });
    }
  };

  const handleCloseCallEntry = useCallback((callEntry: CallEntryTableRow) => {
    setSelectedCallEntryForClose(callEntry);
    setRemark("");
    setOpenedMenuRowId(null);
    openCloseModal();
  }, [openCloseModal]);

  const handleCloseCallEntryConfirm = async () => {
    if (!remark.trim()) {
      ToastNotification({
        type: "error",
        message: "Remark is required to close the call entry",
      });
      return;
    }

    if (!selectedCallEntryForClose) return;

    try {
      setIsClosingCallEntry(true);
      closeCloseModal();

      // Use the call entry data directly from the row without fetching
      const editPayload = {
        customer: selectedCallEntryForClose.customer_code || "",
        call_date: selectedCallEntryForClose.call_date || "",
        call_mode: selectedCallEntryForClose.call_mode_id
          ? String(selectedCallEntryForClose.call_mode_id)
          : "",
        call_summary: selectedCallEntryForClose.call_summary || "",
        followup_date: selectedCallEntryForClose.followup_date || "",
        followup_action: selectedCallEntryForClose.followup_id
          ? String(selectedCallEntryForClose.followup_id)
          : "",
        expected_profit: selectedCallEntryForClose.expected_profit
          ? parseFloat(String(selectedCallEntryForClose.expected_profit))
          : 0,
        latitude: selectedCallEntryForClose.latitude || "",
        longitude: selectedCallEntryForClose.longitude || "",
        status: "CLOSE",
        remark: remark.trim(),
        id: selectedCallEntryForClose.id,
      };

      await putAPICall(URL.callEntry, editPayload as any, API_HEADER);

      // Invalidate and refetch all call entry related queries
      await queryClient.invalidateQueries({ queryKey: ["callEntries"] });
      await queryClient.invalidateQueries({
        queryKey: ["filteredCallEntries"],
      });
      await queryClient.invalidateQueries({ queryKey: ["callEntrySearch"] });
      await refetchCallEntries();
      await refetchFilteredCallEntries();

      ToastNotification({
        type: "success",
        message: "Call Entry closed successfully",
      });

      // Reset state
      setSelectedCallEntryForClose(null);
      setRemark("");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while closing call entry: ${err?.message}`,
      });
    } finally {
      setIsClosingCallEntry(false);
    }
  };

  const renderRowActions = useCallback(
    (row: CallEntryTableRow) => (
      <Menu
        withinPortal
        position="bottom-end"
        shadow="sm"
        opened={openedMenuRowId === row.id}
        onChange={(opened) => setOpenedMenuRowId(opened ? row.id : null)}
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
                const currentFilterState = {
                  filters: {
                    customer: appliedFilters.customer,
                    call_date: appliedFilters.call_date,
                    call_mode: appliedFilters.call_mode,
                    followup_date: appliedFilters.followup_date,
                    status: appliedFilters.status,
                    sales_person: appliedFilters.sales_person,
                    city: appliedFilters.city,
                    area: appliedFilters.area,
                  },
                  displayValues: { customer: customerDisplayValue },
                  filtersApplied,
                  fromDate,
                  toDate,
                  fromDashboard: fromDashboardRef.current,
                };
                useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                navigate("/enquiry-create", {
                  state: {
                    actionType: "createEnquiry",
                    customer_code: row.customer_code,
                    customer_code_read: row.customer_code,
                    customer_name: row.customer_name,
                    call_entry_id: row.id,
                    preserveFilters: currentFilterState,
                  },
                });
              }}
              disabled={row.status === "CLOSE"}
              style={{
                cursor: row.status === "CLOSE" ? "not-allowed" : "pointer",
                opacity: row.status === "CLOSE" ? 0.5 : 1,
              }}
            >
              <Group gap="sm">
                <IconFileText size={16} style={{ color: "#105476" }} />
                <Text
                  size="sm"
                  c={row.status === "CLOSE" ? "dimmed" : ""}
                  style={{ fontFamily: DEFAULT_ERP_LIST_THEME.fontSans }}
                >
                  Create Enquiry
                </Text>
              </Group>
            </UnstyledButton>
          </Box>
          {!fromDashboardRef.current && (
            <>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    const currentFilterState = {
                      filters: {
                        customer: appliedFilters.customer,
                        call_date: appliedFilters.call_date,
                        call_mode: appliedFilters.call_mode,
                        followup_date: appliedFilters.followup_date,
                        status: appliedFilters.status,
                        sales_person: appliedFilters.sales_person,
                        city: appliedFilters.city,
                        area: appliedFilters.area,
                      },
                      displayValues: { customer: customerDisplayValue },
                      filtersApplied,
                      fromDate,
                      toDate,
                      fromDashboard: fromDashboardRef.current,
                    };
                    useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                    navigate(`/call-entry-create/${row.id}`, {
                      state: { ...row, actionType: "edit", preserveFilters: currentFilterState },
                    });
                  }}
                  disabled={row.status === "CLOSE"}
                  style={{
                    cursor: row.status === "CLOSE" ? "not-allowed" : "pointer",
                    opacity: row.status === "CLOSE" ? 0.5 : 1,
                  }}
                >
                  <Group gap="sm">
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text
                      size="sm"
                      c={row.status === "CLOSE" ? "dimmed" : ""}
                      style={{ fontFamily: DEFAULT_ERP_LIST_THEME.fontSans }}
                    >
                      Edit
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
            </>
          )}
          <Box px={10} py={5}>
            <UnstyledButton
              onClick={() => handleCloseCallEntry(row)}
              disabled={row.status === "CLOSE"}
              style={{
                cursor: row.status === "CLOSE" ? "not-allowed" : "pointer",
                opacity: row.status === "CLOSE" ? 0.5 : 1,
              }}
            >
              <Group gap="sm">
                <IconX size={16} style={{ color: "#dc3545" }} />
                <Text
                  size="sm"
                  c={row.status === "CLOSE" ? "dimmed" : ""}
                  style={{ fontFamily: DEFAULT_ERP_LIST_THEME.fontSans }}
                >
                  Close Call
                </Text>
              </Group>
            </UnstyledButton>
          </Box>
        </Menu.Dropdown>
      </Menu>
    ),
    [
      navigate,
      appliedFilters,
      filtersApplied,
      fromDate,
      toDate,
      customerDisplayValue,
      openedMenuRowId,
      handleCloseCallEntry,
    ],
  );

  const callEntryStats = useMemo(() => {
    const rows = displayData as CallEntryTableRow[];
    const statusSource = isFilteredOrSearchActive
      ? filteredCallEntryResult
      : callEntryResult;
    const sc = statusSource.statusCounts;
    return {
      total: totalRecords,
      onPage: rows.length,
      // Keys match filter_call_entries `summary.status_counts` (e.g. active, inactive, close)
      active: getStatusCountFromMap(sc, [
        "active",
        "ACTIVE",
        "open",
        "OPEN",
      ]),
      inactive: getStatusCountFromMap(sc, [
        "inactive",
        "INACTIVE",
      ]),
      closed: getStatusCountFromMap(sc, [
        "close",
        "Close",
        "CLOSE",
        "closed",
        "CLOSED",
      ]),
    };
  }, [
    displayData,
    totalRecords,
    isFilteredOrSearchActive,
    filteredCallEntryResult,
    callEntryResult,
  ]);

  // Memoised so its reference is stable across renders — keeps downstream
  // memos (renderInput, header date-input styles, etc.) from churning.
  const erpTheme: ErpListTheme = useMemo(
    () => ({
      border: DEFAULT_ERP_LIST_THEME.border,
      muted: DEFAULT_ERP_LIST_THEME.muted,
      fg: DEFAULT_ERP_LIST_THEME.fg,
      primary: DEFAULT_ERP_LIST_THEME.primary,
      headerBg: DEFAULT_ERP_LIST_THEME.headerBg,
      pageBg: DEFAULT_ERP_LIST_THEME.pageBg,
      cardBg: DEFAULT_ERP_LIST_THEME.cardBg,
      fontSans: DEFAULT_ERP_LIST_THEME.fontSans,
    }),
    [],
  );
  const { border, muted, fg, primary, cardBg, fontSans } = erpTheme;

  /* ───────────── Column header filters (click-to-edit, EnquiryMaster pattern)
   * Strictly NON-INVASIVE: the column header inputs live on top of the
   * EXISTING `appliedFilters` state. They DO NOT introduce any new payload
   * structure, separate React Query, search path, or store key. A change
   * to a column header writes directly into `appliedFilters` (and the
   * advanced filter form) — the existing `buildFilterPayload` then reads
   * the new value and React Query auto-refetches via queryKey change.
   * ─────────────────────────────────────────────────────────────────────── */

  // Which column header is currently in edit mode (only one at a time).
  const [editingHeaderColumn, setEditingHeaderColumn] =
    useState<CallEntryEditingColumn>(null);

  const openHeaderEditor = useCallback(
    (col: NonNullable<CallEntryEditingColumn>) => {
      setEditingHeaderColumn(col);
    },
    [],
  );

  // IMPORTANT: functional setter, so a fast click on another header that
  // already switched the editing column is not undone by this collapse.
  const makeCollapseHeader = useCallback(
    (col: NonNullable<CallEntryEditingColumn>) => () => {
      setEditingHeaderColumn((cur) => (cur === col ? null : cur));
    },
    [],
  );

  // Header values derived from `appliedFilters` so the header inputs and
  // the advanced filter drawer stay in sync via a single source of truth.
  const callEntryHeaderFilterValues: CallEntryHeaderFilterValues = useMemo(
    () => ({
      customer: appliedFilters.customer ?? "",
      city: appliedFilters.city ?? "",
      sales_person: appliedFilters.sales_person ?? "",
      area: appliedFilters.area ?? "",
      call_date: appliedFilters.call_date
        ? dayjs(appliedFilters.call_date).format("YYYY-MM-DD")
        : "",
      call_mode: appliedFilters.call_mode ?? "",
      followup_date: appliedFilters.followup_date
        ? dayjs(appliedFilters.followup_date).format("YYYY-MM-DD")
        : "",
      status: appliedFilters.status ?? "",
    }),
    [appliedFilters],
  );

  /**
   * Atomically patch one or more filter keys at once. Updates the advanced
   * filter form, applied-filters state, the global list-filter store, and
   * resets to page 1. The patch values use the SAME shape as `FilterState`
   * (so dates are `Date | null`, everything else is `string | null`).
   */
  const handleCallEntryHeaderFilterPatch = useCallback(
    (patch: Partial<FilterState>) => {
      // 1) advanced filter drawer stays in sync for every patched key
      (Object.entries(patch) as Array<
        [keyof FilterState, FilterState[keyof FilterState]]
      >).forEach(([k, v]) => {
        filterForm.setFieldValue(k, v as any);
      });

      // 2) applied filters state (this is what `buildFilterPayload` reads
      //    via its useCallback deps; the queryKey then changes, which
      //    React Query auto-refetches when `filtersApplied` is true).
      const newApplied: FilterState = {
        ...appliedFilters,
        ...patch,
        search: debouncedSearch.trim() || null,
      };
      setAppliedFilters(newApplied);

      // 3) persist to global store so navigations restore correctly
      //    (the store accepts the raw object as-is)
      setStoreFilters(LIST_KEY, newApplied as any);

      // 4) flip filtersApplied based on whether any real filter / search remains
      const hasFilters =
        Boolean(newApplied.customer) ||
        Boolean(newApplied.call_date) ||
        Boolean(newApplied.call_mode) ||
        Boolean(newApplied.followup_date) ||
        Boolean(newApplied.status) ||
        Boolean(newApplied.sales_person) ||
        Boolean(newApplied.city) ||
        Boolean(newApplied.area) ||
        Boolean(fromDate && toDate);
      const hasSearch = Boolean(debouncedSearch.trim());
      setFiltersApplied(hasFilters || hasSearch);

      // 5) reset to first page (same as advanced-filter Apply does)
      setPageIndex(0);
    },
    [
      filterForm,
      appliedFilters,
      debouncedSearch,
      setStoreFilters,
      fromDate,
      toDate,
    ],
  );

  /** Single-key wrapper — what `CallEntryHeaderFiltersProp.onChange` calls. */
  const handleCallEntryHeaderFilterChange = useCallback(
    (key: CallEntryHeaderFilterKey, value: string) => {
      // Non-date keys map directly; dates use the renderInput closure with
      // `handleCallEntryHeaderFilterPatch` so a `Date` is committed instead
      // of a string (matches the existing FilterState shape).
      handleCallEntryHeaderFilterPatch({
        [key]: value || null,
      } as Partial<FilterState>);
    },
    [handleCallEntryHeaderFilterPatch],
  );

  // Display formatter: friendlier label for the collapsed header. Reuses the
  // existing option arrays so the labels stay consistent with the drawer.
  const callEntryHeaderDisplayFormatter = useMemo<
    Partial<Record<CallEntryHeaderFilterKey, (value: string) => string>>
  >(
    () => ({
      customer: (raw) => (raw ? customerDisplayValue || raw : raw),
      sales_person: (raw) =>
        salespersonOptions.find((o: { value: string; label: string }) => o.value === raw)?.label ?? raw,
      call_mode: (raw) =>
        callModeOptionsData.find((o: { value: string; label: string }) => o.value === raw)?.label ?? raw,
      status: (raw) => {
        const dashboardStatuses = ["OVERDUE", "TODAY", "UPCOMING", "CLOSED"];
        if (dashboardStatuses.includes(String(raw).toUpperCase())) return raw;
        return (
          followUpActionOptionsData.find(
            (o: { value: string; label: string }) => o.value === raw,
          )?.label ?? raw
        );
      },
      call_date: (raw) => (raw ? dayjs(raw).format(dateFormat) : raw),
      followup_date: (raw) => (raw ? dayjs(raw).format(dateFormat) : raw),
    }),
    [
      customerDisplayValue,
      salespersonOptions,
      callModeOptionsData,
      followUpActionOptionsData,
      dateFormat,
    ],
  );

  // Stable styles for the SingleDateInputs used in the date column headers.
  const callEntryHeaderDateInputStyles = useMemo(
    () =>
      erpListFilterUnifiedMantineStyles(erpTheme) as unknown as Record<
        string,
        CSSProperties & Record<string, unknown>
      >,
    [erpTheme],
  );

  // Per-column rich editors — mirror the advanced filter drawer's controls
  // exactly so the column header sends the SAME payload value the advanced
  // filter would. Free-text columns (city, area) fall back to the default
  // `HeaderFilterInput` (1000ms debounced commit).
  const callEntryHeaderRenderInput = useMemo<
    Partial<Record<CallEntryHeaderFilterKey, CallEntryHeaderRenderInput>>
  >(
    () => ({
      customer: ({ onClose }) => (
        <SearchableSelect
          size="xs"
          placeholder="Search customer"
          apiEndpoint={URL.customer}
          searchFields={["customer_name", "customer_code"]}
          displayFormat={(item: Record<string, unknown>) => ({
            value: String(item.customer_code),
            label: String(item.customer_name),
          })}
          value={appliedFilters.customer}
          displayValue={customerDisplayValue}
          onChange={(value, selectedData) => {
            const label = selectedData?.label || null;
            setCustomerDisplayValue(label);
            // Persist the friendly label to the global store so it survives
            // navigation back from create / edit / calendar pages.
            useListFilterStore.getState().setDisplayValues(LIST_KEY, {
              customer: label,
            });
            handleCallEntryHeaderFilterPatch({ customer: value || null });
            if (value) onClose();
          }}
          minSearchLength={2}
          dropdownZIndex={1000}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      sales_person: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder={salespersonsLoading ? "Loading…" : "Sales person"}
          searchable
          clearable
          size="xs"
          data={salespersonOptions}
          disabled={salespersonsLoading}
          value={appliedFilters.sales_person || ""}
          onChange={(value) => {
            handleCallEntryHeaderFilterChange("sales_person", value || "");
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      call_mode: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder={callModeDataLoading ? "Loading…" : "Mode of call"}
          searchable
          clearable
          size="xs"
          data={callModeOptionsData}
          disabled={callModeDataLoading}
          value={appliedFilters.call_mode || ""}
          onChange={(value) => {
            handleCallEntryHeaderFilterChange("call_mode", value || "");
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      status: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder={followUpActionDataLoading ? "Loading…" : "Status"}
          searchable
          clearable
          size="xs"
          data={followUpActionOptionsData}
          disabled={followUpActionDataLoading}
          value={appliedFilters.status || ""}
          onChange={(value) => {
            handleCallEntryHeaderFilterChange("status", value || "");
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      // Single date pickers — commit as a `Date` (matches existing FilterState).
      call_date: ({ onClose }) => (
        <SingleDateInput
          value={appliedFilters.call_date}
          onChange={(d) => {
            handleCallEntryHeaderFilterPatch({ call_date: d });
            if (d) onClose();
          }}
          placeholder="Call date"
          size="xs"
          allowDeselection
          classNames={CALL_ENTRY_HEADER_DATE_INPUT_CLASSNAMES}
          styles={callEntryHeaderDateInputStyles}
        />
      ),
      followup_date: ({ onClose }) => (
        <SingleDateInput
          value={appliedFilters.followup_date}
          onChange={(d) => {
            handleCallEntryHeaderFilterPatch({ followup_date: d });
            if (d) onClose();
          }}
          placeholder="Follow-up"
          size="xs"
          allowDeselection
          classNames={CALL_ENTRY_HEADER_DATE_INPUT_CLASSNAMES}
          styles={callEntryHeaderDateInputStyles}
        />
      ),
    }),
    [
      appliedFilters.customer,
      appliedFilters.sales_person,
      appliedFilters.call_mode,
      appliedFilters.status,
      appliedFilters.call_date,
      appliedFilters.followup_date,
      customerDisplayValue,
      salespersonOptions,
      salespersonsLoading,
      callModeOptionsData,
      callModeDataLoading,
      followUpActionOptionsData,
      followUpActionDataLoading,
      handleCallEntryHeaderFilterChange,
      handleCallEntryHeaderFilterPatch,
      callEntryHeaderDateInputStyles,
      erpTheme,
    ],
  );

  /**
   * Renders the inner content of a single filterable `<th>` (the click-to-edit
   * label + the inline editor). Centralises the boilerplate shared by every
   * filterable column header so the table render stays compact.
   *
   * Layout trick: the label is ALWAYS rendered in normal flow so it dictates
   * the cell's natural width (and therefore its `min-content` size). When
   * editing, the label is visually hidden but still reserves space, while the
   * editor is layered on top via `position: absolute; inset: 0`. The editor
   * therefore never contributes to the cell's preferred width — clicking the
   * header no longer expands the column.
   */
  const renderFilterableHeader = useCallback(
    (
      columnId: NonNullable<CallEntryEditingColumn>,
      filterKey: CallEntryHeaderFilterKey,
      label: string,
      ariaLabel: string = `Filter ${label}`,
    ) => {
      const value = callEntryHeaderFilterValues[filterKey];
      const filterDisplay = value
        ? callEntryHeaderDisplayFormatter?.[filterKey]?.(value) ?? value
        : "";
      const isEditing = editingHeaderColumn === columnId;
      return (
        <div
          style={{
            position: "relative",
            width: "100%",
            minWidth: 0,
          }}
        >
          {/* Label is always rendered so the cell's width is locked to the
              closed-state size. While editing it's `visibility: hidden`
              (still occupies space, but not interactive / not focusable). */}
          <div
            style={{
              visibility: isEditing ? "hidden" : "visible",
              pointerEvents: isEditing ? "none" : "auto",
            }}
            aria-hidden={isEditing || undefined}
          >
            <FilterableHeaderLabel
              label={label}
              filterDisplay={filterDisplay}
              onClick={() => openHeaderEditor(columnId)}
              theme={erpTheme}
            />
          </div>
          {isEditing && (
            <FilterableHeaderEdit
              onCollapse={makeCollapseHeader(columnId)}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              {callEntryHeaderRenderInput?.[filterKey]?.({
                autoFocus: true,
                onClose: makeCollapseHeader(columnId),
              }) ?? (
                <HeaderFilterInput
                  value={value}
                  onChange={(val) =>
                    handleCallEntryHeaderFilterChange(filterKey, val)
                  }
                  ariaLabel={ariaLabel}
                  autoFocus
                />
              )}
            </FilterableHeaderEdit>
          )}
        </div>
      );
    },
    [
      editingHeaderColumn,
      callEntryHeaderFilterValues,
      callEntryHeaderDisplayFormatter,
      callEntryHeaderRenderInput,
      makeCollapseHeader,
      openHeaderEditor,
      handleCallEntryHeaderFilterChange,
      erpTheme,
    ],
  );

  const visibleDataColumnCount = useMemo(() => {
    const v = visibleColumns;
    let n = 0;
    if (v.sno) n++;
    if (v.customerName) n++;
    if (v.customerLocation) n++;
    if (v.salesPerson) n++;
    if (v.callEntryLocation) n++;
    if (v.callDate) n++;
    if (v.modeOfCall) n++;
    if (v.followupDates) n++;
    if (v.status) n++;
    if (v.remark) n++;
    return n + 1;
  }, [visibleColumns]);

  const columnToggleItems: ERPListColumnToggleItem[] = useMemo(
    () => [
      { id: "sno", label: "S.No", checked: visibleColumns.sno, onToggle: () => setVisibleColumns((p) => ({ ...p, sno: !p.sno })) },
      { id: "customerName", label: "Customer name", checked: visibleColumns.customerName, onToggle: () => setVisibleColumns((p) => ({ ...p, customerName: !p.customerName })) },
      { id: "customerLocation", label: "Customer location", checked: visibleColumns.customerLocation, onToggle: () => setVisibleColumns((p) => ({ ...p, customerLocation: !p.customerLocation })) },
      { id: "salesPerson", label: "Sales person", checked: visibleColumns.salesPerson, onToggle: () => setVisibleColumns((p) => ({ ...p, salesPerson: !p.salesPerson })) },
      { id: "callEntryLocation", label: "Call entry location", checked: visibleColumns.callEntryLocation, onToggle: () => setVisibleColumns((p) => ({ ...p, callEntryLocation: !p.callEntryLocation })) },
      { id: "callDate", label: "Call date", checked: visibleColumns.callDate, onToggle: () => setVisibleColumns((p) => ({ ...p, callDate: !p.callDate })) },
      { id: "modeOfCall", label: "Mode of call", checked: visibleColumns.modeOfCall, onToggle: () => setVisibleColumns((p) => ({ ...p, modeOfCall: !p.modeOfCall })) },
      { id: "followupDates", label: "Follow-up dates", checked: visibleColumns.followupDates, onToggle: () => setVisibleColumns((p) => ({ ...p, followupDates: !p.followupDates })) },
      { id: "status", label: "Status", checked: visibleColumns.status, onToggle: () => setVisibleColumns((p) => ({ ...p, status: !p.status })) },
      { id: "remark", label: "Remark", checked: visibleColumns.remark, onToggle: () => setVisibleColumns((p) => ({ ...p, remark: !p.remark })) },
    ],
    [visibleColumns],
  );

  const filterApplyBusy = callEntryLoading || filteredCallEntryLoading;
  const isTableDataLoading = isLoading;

  return (
    <>
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
                    icon={<IconPhone size={14} color={primary} />}
                    value={callEntryStats.total}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCircleCheck size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={callEntryStats.active}
                    label="Active"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconUserOff size={14} color="#64748b" />}
                    iconBackground="#f1f5f9"
                    iconColor="#64748b"
                    value={callEntryStats.inactive}
                    label="Inactive"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconX size={14} color="#dc2626" />}
                    iconBackground="#fef2f2"
                    iconColor="#dc2626"
                    value={callEntryStats.closed}
                    label="Closed"
                  />
                </>
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
                          onClick={() => setSearchQuery("")}
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
                    items={columnToggleItems}
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
                  <Button
                    variant="default"
                    size="xs"
                    styles={erpToolbarOutlineButtonStyles(erpTheme)}
                    leftSection={<IconCalendarTime size={14} />}
                    onClick={() => {
                      const currentFilterState = {
                        filters: {
                          customer: appliedFilters.customer,
                          call_date: appliedFilters.call_date,
                          call_mode: appliedFilters.call_mode,
                          followup_date: appliedFilters.followup_date,
                          status: appliedFilters.status,
                          sales_person: appliedFilters.sales_person,
                          city: appliedFilters.city,
                          area: appliedFilters.area,
                        },
                        displayValues: { customer: customerDisplayValue },
                        filtersApplied,
                        fromDate,
                        toDate,
                        fromDashboard: fromDashboardRef.current,
                      };
                      useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                      navigate("/call-entry-calendar", {
                        state: { preserveFilters: currentFilterState },
                      });
                    }}
                  >
                    Calendar
                  </Button>
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                    onClick={() => {
                      const currentFilterState = {
                        filters: {
                          customer: appliedFilters.customer,
                          call_date: appliedFilters.call_date,
                          call_mode: appliedFilters.call_mode,
                          followup_date: appliedFilters.followup_date,
                          status: appliedFilters.status,
                          sales_person: appliedFilters.sales_person,
                          city: appliedFilters.city,
                          area: appliedFilters.area,
                        },
                        displayValues: { customer: customerDisplayValue },
                        filtersApplied,
                        fromDate,
                        toDate,
                        fromDashboard: fromDashboardRef.current,
                      };
                      useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                      navigate("/call-entry-create", {
                        state: { preserveFilters: currentFilterState },
                      });
                    }}
                  >
                    Create new
                  </Button>
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: "Date range, customer, mode, status, and locations",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={clearAllFilters}
                  onApply={applyFilters}
                  applyLoading={filterApplyBusy || isRefreshingData}
                  applyDisabled={filterApplyBusy || isRefreshingData}
                />
              ),
              children: (
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Select
                        key={`sales-person-${filterForm.values.sales_person}-${salespersonsLoading}-${salespersonOptions.length}`}
                        label="Sales person"
                        placeholder={salespersonsLoading ? "Loading…" : "All"}
                        searchable
                        clearable
                        size="xs"
                        data={salespersonOptions}
                        nothingFoundMessage={salespersonsLoading ? "Loading…" : "None found"}
                        disabled={salespersonsLoading}
                        value={filterForm.values.sales_person}
                        onChange={(value) => filterForm.setFieldValue("sales_person", value || null)}
                        classNames={erpListGeistSelectClassNames}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <SearchableSelect
                        size="xs"
                        label="Customer name"
                        placeholder="Type customer name"
                        apiEndpoint={URL.customer}
                        searchFields={["customer_name", "customer_code"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.customer_code),
                          label: String(item.customer_name),
                        })}
                        value={filterForm.values.customer}
                        displayValue={customerDisplayValue}
                        onChange={(value, selectedData) => {
                          filterForm.setFieldValue("customer", value || "");
                          setCustomerDisplayValue(selectedData?.label || null);
                        }}
                        minSearchLength={2}
                        dropdownZIndex={1000}
                        classNames={erpListGeistSelectClassNames}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_WIDE}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <DateRangeInput
                        fromDate={fromDate}
                        toDate={toDate}
                        onFromDateChange={setFromDate}
                        onToDateChange={setToDate}
                        fromLabel="From date"
                        toLabel="To date"
                        size="xs"
                        allowDeselection={true}
                        showRangeInCalendar={false}
                        filterFieldStyles={erpListFilterUnifiedMantineStyles(erpTheme)}
                        dateInputClassNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                        containerStyle={{ gap: 8 }}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <Select
                      key={`call-mode-${filterForm.values.call_mode}-${callModeDataLoading}-${callModeOptionsData.length}`}
                      label="Mode of call"
                      placeholder={callModeDataLoading ? "Loading…" : "All"}
                      searchable
                      clearable
                      size="xs"
                      data={callModeOptionsData}
                      nothingFoundMessage={callModeDataLoading ? "Loading…" : "None found"}
                      disabled={callModeDataLoading}
                      {...filterForm.getInputProps("call_mode")}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      key={`followup-date-${filterForm.values.followup_date}`}
                      label="Follow-up date"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.followup_date}
                      onChange={(d) => filterForm.setFieldValue("followup_date", d)}
                      error={filterForm.errors.followup_date as string | undefined}
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...erpListFilterUnifiedMantineStyles(erpTheme),
                        input: {
                          ...erpListFilterUnifiedMantineStyles(erpTheme).input,
                          minHeight: 32,
                        },
                      }}
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                    <Select
                      key={`status-${filterForm.values.status}-${followUpActionDataLoading}-${followUpActionOptionsData.length}`}
                      label="Status"
                      placeholder={followUpActionDataLoading ? "Loading…" : "All"}
                      searchable
                      clearable
                      size="xs"
                      data={followUpActionOptionsData}
                      nothingFoundMessage={followUpActionDataLoading ? "Loading…" : "None found"}
                      disabled={followUpActionDataLoading}
                      {...filterForm.getInputProps("status")}
                      classNames={erpListGeistSelectClassNames}
                      styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                    />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <FormTextInput
                        size="xs"
                        format="normal"
                        label="Customer location"
                        placeholder="City / area"
                        {...filterForm.getInputProps("city")}
                        classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <FormTextInput
                        size="xs"
                        format="normal"
                        label="Call entry location"
                        placeholder="Area"
                        {...filterForm.getInputProps("area")}
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
                <>
                  <Group
                    justify="space-between"
                    align="center"
                    wrap="wrap"
                    gap="md"
                    px="md"
                    py={10}
                    style={{ borderTop: `1px solid ${border}`, backgroundColor: cardBg }}
                  >
                    {(location.state?.returnToDashboard || returnToDashboardRef.current) ? (
                      <Button
                        leftSection={<IconArrowLeft size={16} />}
                        onClick={() => {
                          const dashboardState =
                            location.state?.dashboardState || dashboardStateRef.current;
                          if (dashboardState?.source === "callEntryDashboardPage") {
                            navigate("/dashboard/call-entry-dashboard", {
                              state: {
                                company: dashboardState.company || null,
                                fromDate: dashboardState.fromDate || null,
                                toDate: dashboardState.toDate || null,
                                type: dashboardState.type || null,
                                search: dashboardState.search || null,
                                openCustomerWiseForSalesperson:
                                  dashboardState.openCustomerWiseForSalesperson || null,
                              },
                            });
                          } else if (dashboardState) {
                            navigate("/", {
                              state: {
                                returnToCallEntryDetailedView: true,
                                dashboardState,
                              },
                            });
                          } else {
                            navigate("/");
                          }
                        }}
                        variant="default"
                        size="xs"
                        styles={erpToolbarOutlineButtonStyles(erpTheme)}
                      >
                        Back to dashboard
                      </Button>
                    ) : (
                      <Box />
                    )}
                    <Box style={{ flex: 1, minWidth: 280 }} />
                  </Group>
                  <ERPListPaginationFooter
                    theme={erpTheme}
                    totalRecords={totalRecords}
                    pageIndex={pageIndex}
                    pageSize={pageSize}
                    onPageIndexChange={setPageIndex}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={["10", "15", "25", "50"]}
                    selectClassNames={{
                      dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                      option: ERP_LIST_GEIST_ROOT_CLASS,
                    }}
                  />
                </>
              ),
              children: (
                <table style={erpListTableElementStyle(erpTheme)}>
                  <thead>
                    <tr style={{ height: 52.4 }}>
                      {visibleColumns.sno && (
                        <th style={{ ...erpListThStyle(erpTheme), minWidth: 40 }}>
                          S.No
                        </th>
                      )}
                      {visibleColumns.customerName && (
                        <th style={{ ...erpListThStyle(erpTheme), minWidth: 180 }}>
                          {renderFilterableHeader("customer", "customer", "Customer")}
                        </th>
                      )}
                      {visibleColumns.customerLocation && (
                        <th style={{ ...erpListThStyle(erpTheme), minWidth: 150 }}>
                          {renderFilterableHeader("city", "city", "Customer location")}
                        </th>
                      )}
                      {visibleColumns.salesPerson && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader("sales_person", "sales_person", "Sales person")}
                        </th>
                      )}
                      {visibleColumns.callEntryLocation && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader("area", "area", "Call entry location")}
                        </th>
                      )}
                      {visibleColumns.callDate && (
                        <th style={{ ...erpListThStyle(erpTheme)}}>
                          {renderFilterableHeader("call_date", "call_date", "Call date")}
                        </th>
                      )}
                      {visibleColumns.modeOfCall && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader("call_mode", "call_mode", "Mode")}
                        </th>
                      )}
                      {visibleColumns.followupDates && (
                        <th style={{ ...erpListThStyle(erpTheme)}}>
                          {renderFilterableHeader("followup_date", "followup_date", "Follow-up")}
                        </th>
                      )}
                      {visibleColumns.status && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader("status", "status", "Status")}
                        </th>
                      )}
                      {visibleColumns.remark && (
                        <th style={{...erpListThStyle(erpTheme),minWidth:150}}>
                          Remark
                        </th>
                      )}
                      <th style={erpListStickyActionThStyle(erpTheme, 80)}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isTableDataLoading ? (
                      <tr>
                        <td
                          colSpan={visibleDataColumnCount}
                          style={{ padding: 0 }}
                        >
                          <Center
                            py={80}
                            style={{ backgroundColor: erpTheme.cardBg }}
                          >
                            <Stack align="center" gap="md">
                              <Loader size="lg" color={erpTheme.primary} />
                              <Text
                                c="dimmed"
                                size="sm"
                                style={{ fontFamily: fontSans }}
                              >
                                Loading call entries…
                              </Text>
                            </Stack>
                          </Center>
                        </td>
                      </tr>
                    ) : displayData.length === 0 ? (
                      <tr>
                        <td colSpan={visibleDataColumnCount} style={{ padding: 60, textAlign: "center" }}>
                          <Stack align="center" gap="md">
                            <Box
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                backgroundColor: "#f1f5f9",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconPhone size={24} color={muted} />
                            </Box>
                            <Box>
                              <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                                No call entries found
                              </Text>
                              <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                                Try adjusting your search or filters
                              </Text>
                            </Box>
                          </Stack>
                        </td>
                      </tr>
                    ) : (
                      (displayData as CallEntryTableRow[]).map((row, idx) => {
                        const sno = pageIndex * pageSize + idx + 1;
                        return (
                          <tr key={row.id} {...erpListDataRowProps(erpTheme)}>
                            {visibleColumns.sno && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                  {sno}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.customerName && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                  {row.customer_name || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.customerLocation && (
                              <td style={{ ...erpListTdPaddingStyle(), maxWidth: 180 }}>
                                <Tooltip
                                  label={row.address || "No address"}
                                  maw={400}
                                  withArrow
                                  multiline
                                  styles={{ tooltip: { fontFamily: fontSans, fontSize: 12, whiteSpace: "normal" } }}
                                >
                                  <Text size="sm" c={muted} style={{ cursor: "default", fontFamily: fontSans }}>
                                    {row.city || "—"}
                                  </Text>
                                </Tooltip>
                              </td>
                            )}
                            {visibleColumns.salesPerson && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                  {row.created_by || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.callEntryLocation && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text size="sm" c={muted} style={{ fontFamily: fontSans }}>
                                  {row.area || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.callDate && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.call_date ? dayjs(row.call_date).format(dateFormat) : "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.modeOfCall && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.call_mode_name || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.followupDates && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.followup_date ? dayjs(row.followup_date).format(dateFormat) : "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td style={erpListTdPaddingStyle()}>
                                <CallEntryStatusPill status={row.status} />
                              </td>
                            )}
                            {visibleColumns.remark && (
                              <td style={{ ...erpListTdPaddingStyle(), maxWidth: 200 }}>
                                <Text size="sm" lineClamp={2} style={{ fontFamily: fontSans }}>
                                  {row.remark != null && String(row.remark).trim() !== "" ? String(row.remark) : "—"}
                                </Text>
                              </td>
                            )}
                            <td style={erpListStickyActionTdStyle(erpTheme)}>
                              {renderRowActions(row)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ),
            }}
          />
        </Box>
      </MantineProvider>


      {/* Close Call Entry Modal */}
      <Modal
        opened={closeModalOpened}
        onClose={closeCloseModal}
        title="Close Call Entry"
        centered
        styles={{
          title: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
        }}
      >
        <Stack gap="md">
          <Text
            size="sm"
            c="dimmed"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Please provide a remark before closing this call entry.
          </Text>
          <Textarea
            label="Remark"
            placeholder="Enter remark..."
            required
            value={remark}
            onChange={(e) => setRemark(e.currentTarget.value)}
            minRows={4}
            error={!remark.trim() ? "Remark is required" : undefined}
            styles={{
              input: { fontFamily: "Inter, sans-serif" },
              label: { fontFamily: "Inter, sans-serif", fontWeight: 500 },
            }}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={closeCloseModal}
              styles={{
                root: { fontFamily: "Inter, sans-serif" },
              }}
            >
              Cancel
            </Button>
            <Button
              color="#105476"
              onClick={handleCloseCallEntryConfirm}
              disabled={!remark.trim() || isClosingCallEntry}
              loading={isClosingCallEntry}
              styles={{
                root: { fontFamily: "Inter, sans-serif" },
              }}
            >
              Close Call Entry
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
export default CallEntry;
