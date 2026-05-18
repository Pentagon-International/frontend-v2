import {
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  useCallback,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ActionIcon,
  Button,
  Group,
  Text,
  TextInput,
  Select,
  Grid,
  Box,
  Stack,
  Badge,
  Tooltip,
  Modal,
  ScrollArea,
  Menu,
  UnstyledButton,
  MantineProvider,
  Center,
  Loader,
} from "@mantine/core";
import {
  IconSearch,
  IconFilter,
  IconFilterFilled,
  IconPlus,
  IconEdit,
  IconDotsVertical,
  IconX,
  IconUsers,
  IconSparkles,
  IconMessageCircle,
  IconCircleCheck,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import {
  ToastNotification,
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
  ERP_LIST_GEIST_ROOT_CLASS,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  type ErpListTheme,
  type ERPListColumnToggleItem,
  erpListTableElementStyle,
  erpListThStyle,
  erpListTdPaddingStyle,
  erpListThActionsSpacer,
  erpListStickyActionTdStyle,
  erpListDataRowProps,
} from "../../components";
import SingleDateInput from "../../components/SingleDateInput";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useLayoutStore } from "../../store/useLayoutStore";
import useAuthStore from "../../store/authStore";
import { useListFilterStore } from "../../store/listFilterStore";
import useDateFormat from "../../hooks/useDateFormat";

const LIST_KEY = "LEAD_LIST";

type LeadData = {
  id: number;
  name: string;
  contact_number: string | null;
  contact_person: string | null;
  email_id: string | null;
  location: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
  created_by: string;
  assigned_to: string;
  status: string;
  remark: {
    messages?: Array<{
      sender: string;
      message: string;
      sender_id: number;
      timestamp: string;
    }>;
    interest_level?: string;
  };
  created_at: string;
  updated_at: string;
};

type FilterState = {
  // Existing
  assigned_to: string | null;
  status: string | null;
  // Newly supported (mirrors the backend `filters_payload` keys exactly):
  // `name` -> Lead company name; `contact_*` / `email_id` / `location` use
  // backend `icontains`; `created_by` filters by username; `interest_level`
  // is sent inside `remark: { interest_level }` (the backend supports a
  // dict for the JSON `remark` field); `created_at` / `updated_at` are
  // single ISO `YYYY-MM-DD` strings matched server-side via `__date=`.
  name: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email_id: string | null;
  location: string | null;
  created_by: string | null;
  interest_level: string | null;
  created_at: string | null;
  updated_at: string | null;
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

const statusOptions = [
  { label: "All", value: "" },
  { label: "New", value: "New" },
  { label: "Contacted", value: "Contacted" },
  { label: "Qualified", value: "Qualified" },
  { label: "Converted", value: "Converted" },
  { label: "Lost", value: "Lost" },
];

/**
 * Interest level picker. Sent to the API as `remark: { interest_level: <value> }`
 * because the backend filters the `remark` JSON field by exact key/value match
 * when given a dict, which is what `LeadData.remark.interest_level` stores.
 */
const interestLevelOptions = [
  { label: "High", value: "High" },
  { label: "Medium", value: "Medium" },
  { label: "Low", value: "Low" },
];

/**
 * Stable `classNames` for the date column-header `SingleDateInput`s. Kept at
 * module scope so the object reference does not churn `renderInput`'s memo.
 */
const LEAD_HEADER_DATE_INPUT_CLASSNAMES: Record<string, string> = {
  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
};

/** Reset-shape for `FilterState` -- used in initial form values, default applied filters, and Clear All. */
const EMPTY_LEAD_FILTERS: FilterState = {
  assigned_to: null,
  status: null,
  name: null,
  contact_person: null,
  contact_number: null,
  email_id: null,
  location: null,
  created_by: null,
  interest_level: null,
  created_at: null,
  updated_at: null,
};

/** Picks a single field off the restored filter blob (or `null` when absent / falsy). */
function pickRestoredFilter(
  restoredFilters: Partial<FilterState> | null | undefined,
  key: keyof FilterState,
): string | null {
  const v = restoredFilters?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Merges a (possibly partial) restored filters blob into the full `FilterState` shape. */
function mergeRestoredLeadFilters(
  restoredFilters: Partial<FilterState> | null | undefined,
): FilterState {
  return {
    assigned_to: pickRestoredFilter(restoredFilters, "assigned_to"),
    status: pickRestoredFilter(restoredFilters, "status"),
    name: pickRestoredFilter(restoredFilters, "name"),
    contact_person: pickRestoredFilter(restoredFilters, "contact_person"),
    contact_number: pickRestoredFilter(restoredFilters, "contact_number"),
    email_id: pickRestoredFilter(restoredFilters, "email_id"),
    location: pickRestoredFilter(restoredFilters, "location"),
    created_by: pickRestoredFilter(restoredFilters, "created_by"),
    interest_level: pickRestoredFilter(restoredFilters, "interest_level"),
    created_at: pickRestoredFilter(restoredFilters, "created_at"),
    updated_at: pickRestoredFilter(restoredFilters, "updated_at"),
  };
}

type LeadVisibleColumns = {
  sno: boolean;
  company: boolean;
  contactPerson: boolean;
  contactNumber: boolean;
  email: boolean;
  location: boolean;
  status: boolean;
  assignedTo: boolean;
  createdBy: boolean;
  interest: boolean;
  latestRemark: boolean;
  createdAt: boolean;
  updatedAt: boolean;
};

const DEFAULT_LEAD_VISIBLE_COLUMNS: LeadVisibleColumns = {
  sno: true,
  company: true,
  contactPerson: true,
  contactNumber: true,
  email: true,
  location: true,
  status: true,
  assignedTo: true,
  createdBy: true,
  interest: true,
  latestRemark: true,
  createdAt: true,
  updatedAt: true,
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Column-header filter primitives
 *
 * Mirrors the EnquiryListNativeTables.tsx pattern: a click on the column
 * header label collapses it into an inline editor (`FilterableHeaderEdit`)
 * which auto-focuses, auto-blurs back to the label, and supports Escape to
 * cancel. Each filterable column can supply a richer `renderInput` (e.g. a
 * `Select` of users / statuses) so the column header reuses the SAME control
 * the advanced-filter drawer offers -- single source of truth, identical
 * API payload shape.
 *
 * `LeadList` only exposes server-backed filters that the existing
 * `buildLeadPayload` already understands (`assigned_to`, `status`), so the
 * key set is intentionally small. No new payload keys, no client-side row
 * filtering: the column header just writes into the existing
 * `appliedFilters` state and lets React Query refetch.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * One header-filter key per backend filter field that the column header is
 * allowed to write into. The backend filters `created_at` / `updated_at`
 * as single dates (`__date=...`), so each maps 1:1 with a single ISO
 * `YYYY-MM-DD` string in `FilterState`.
 */
export type LeadHeaderFilterKey =
  | "name"
  | "contact_person"
  | "contact_number"
  | "email_id"
  | "location"
  | "status"
  | "assigned_to"
  | "created_by"
  | "interest_level"
  | "created_at"
  | "updated_at";

export type LeadHeaderFilterValues = Record<LeadHeaderFilterKey, string>;

export type LeadHeaderInputContext = {
  /** Whether the input should auto-focus on mount (always true for now). */
  autoFocus: boolean;
  /** Imperatively collapse the cell back to label mode (after a pick). */
  onClose: () => void;
};

export type LeadHeaderRenderInput = (ctx: LeadHeaderInputContext) => ReactNode;

export type LeadHeaderFiltersProp = {
  values: LeadHeaderFilterValues;
  onChange: (key: LeadHeaderFilterKey, value: string) => void;
  renderInput?: Partial<Record<LeadHeaderFilterKey, LeadHeaderRenderInput>>;
  /**
   * Optional per-column label formatter for the collapsed header. Used when
   * the raw filter value is a code or sentinel that should display as a
   * friendlier label (e.g. `Contacted` instead of the raw value).
   */
  displayFormatter?: Partial<Record<LeadHeaderFilterKey, (value: string) => string>>;
};

/**
 * Identifies which column header is currently in edit mode. Each entry maps
 * 1:1 to a `LeadHeaderFilterKey`.
 */
type LeadEditingColumn = LeadHeaderFilterKey | null;

const LEAD_HEADER_FILTER_TEXTINPUT_STYLES = {
  input: {
    height: 26,
    minHeight: 26,
    fontSize: 12,
    paddingLeft: 8,
    paddingRight: 24,
  },
} as const;

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
  // Local typing buffer. We keep every keystroke local and only bubble the
  // value upstream after 1000ms of idle, so React Query does not refetch on
  // every character. The X-clear button bypasses this debounce for a snappy
  // discrete UX. External value changes (Clear-All, restore, advanced filter
  // Apply) are synced back into the local buffer via the effect below.
  const [localValue, setLocalValue] = useState(value);
  const [debouncedLocalValue] = useDebouncedValue(localValue, 1000);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    // If the new external value equals what we last emitted, it's just our
    // own commit echoing back -- ignore. Otherwise (Clear-All / restore /
    // advanced-filter Apply), accept the external value. We also always
    // honour an explicit clear ("") so Clear-All wins over uncommitted typing.
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
      styles={LEAD_HEADER_FILTER_TEXTINPUT_STYLES}
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
      title={isFiltered ? `Filter: ${filterDisplay}\nClick to edit` : `Click to filter`}
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
}: {
  /**
   * Must use the functional-set form
   * (`setState((cur) => cur === me ? null : cur)`) so a click on a different
   * header that already switched the editing column is not undone by this
   * collapse handler.
   */
  onCollapse: () => void;
  children: ReactNode;
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
      style={{ width: "100%", minWidth: 0 } as CSSProperties}
    >
      {children}
    </div>
  );
}

function LeadsStatusPill({ status }: { status: string | undefined | null }) {
  const s = (status || "").trim() || "—";
  const cfg =
    s === "New"
      ? { label: "New", dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" }
      : s === "Contacted"
        ? { label: "Contacted", dot: "#8b5cf6", bg: "#f5f3ff", color: "#6d28d9" }
        : s === "Qualified"
          ? { label: "Qualified", dot: "#10b981", bg: "#ecfdf5", color: "#047857" }
          : s === "Converted"
            ? { label: "Converted", dot: "#0d9488", bg: "#ccfbf1", color: "#0f766e" }
            : s === "Lost"
              ? { label: "Lost", dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c" }
              : { label: s, dot: "#94a3b8", bg: "#f1f5f9", color: "#475569" };

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

function LeadList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { setActiveNav, setActiveSubNav, setTitle } = useLayoutStore();
  const dateFormat = useDateFormat();

  // Ensure navigation state is set correctly on mount and refresh
  useEffect(() => {
    setActiveNav("Sales");
    setActiveSubNav("Lead");
    setTitle("Sales");
  }, [setActiveNav, setActiveSubNav, setTitle]);

  // Refs to persist returnToDashboard flag and dashboard state
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard)
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state
  const fromDashboardRef = useRef<boolean>(
    Boolean(location.state?.fromDashboard)
  ); // Track if page was opened from dashboard

  // Zustand store for filter and search preservation
  const setStoreFilters = useListFilterStore((state) => state.setFilters);
  const setStoreSearch = useListFilterStore((state) => state.setSearch);
  const clearStoreFilters = useListFilterStore((state) => state.clearFilters);
  const clearStoreSearch = useListFilterStore((state) => state.clearSearch);
  const getState = useListFilterStore((state) => state.getState);
  const clearStoreAllExcept = useListFilterStore((state) => state.clearAllExcept);

  // CRITICAL: Capture restore data immediately to prevent loss during re-renders
  const restoreFiltersDataRef = useRef<any>(
    location.state?.restoreFilters ? { ...location.state.restoreFilters } : null
  );
  const hasRestoredRef = useRef(false);
  const restoreFiltersProcessed = useRef(false);

  //Search Debounce - initialize from restoreFilters if present
  const shouldRestore = Boolean(location.state?.restoreFilters);
  const [searchQuery, setSearchQuery] = useState(
    shouldRestore && restoreFiltersDataRef.current?.searchQuery !== undefined
      ? restoreFiltersDataRef.current.searchQuery || ""
      : ""
  );
  const [debounced] = useDebouncedValue(searchQuery, 1000);
  const [showFilters, setShowFilters] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverPaginated, setServerPaginated] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<LeadVisibleColumns>(DEFAULT_LEAD_VISIBLE_COLUMNS);

  // Modal state for remark conversation
  const [
    remarkModalOpened,
    { open: openRemarkModal, close: closeRemarkModal },
  ] = useDisclosure(false);
  const [selectedLeadForRemark, setSelectedLeadForRemark] =
    useState<LeadData | null>(null);

  // Filter form
  const filterForm = useForm<FilterState>({
    initialValues: EMPTY_LEAD_FILTERS,
  });

  // State to store the actual applied filter values - initialize from restoreFilters if present
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(
    shouldRestore && restoreFiltersDataRef.current?.filters
      ? mergeRestoredLeadFilters(restoreFiltersDataRef.current.filters)
      : EMPTY_LEAD_FILTERS,
  );
  
  const [filtersApplied, setFiltersApplied] = useState(
    shouldRestore && restoreFiltersDataRef.current?.filtersApplied !== undefined
      ? restoreFiltersDataRef.current.filtersApplied || Boolean(restoreFiltersDataRef.current?.searchQuery?.trim())
      : false
  );

  // Ref to hold latest appliedFilters to avoid stale closure in buildLeadPayload
  const appliedFiltersRef = useRef(appliedFilters);
  
  useEffect(() => {
      clearStoreAllExcept(LIST_KEY);
    }, []);

  // Update ref whenever appliedFilters changes
  useEffect(() => {
    appliedFiltersRef.current = appliedFilters;
  }, [appliedFilters]);

  // Memoized filter payload - includes filters + search together
  // Use ONLY debounced value for search to prevent API calls on every keystroke
  // Always include search field in payload (even if empty) to match API structure.
  // Each backend filter key is added only when the corresponding `appliedFilters`
  // slot is non-empty so we don't accidentally over-filter.
  const buildLeadPayload = useMemo(() => {
    const f = appliedFiltersRef.current;
    const payload: Record<string, unknown> = {
      // existing API contract: assigned_to + status are always sent (empty
      // string == "no filter"). All other keys are optional and only added
      // when set.
      assigned_to: f.assigned_to || "",
      status: f.status || "",
      search: debounced.trim() || "",
    };

    if (f.name) payload.name = f.name;
    if (f.contact_person) payload.contact_person = f.contact_person;
    if (f.contact_number) payload.contact_number = f.contact_number;
    if (f.email_id) payload.email_id = f.email_id;
    if (f.location) payload.location = f.location;
    if (f.created_by) payload.created_by = f.created_by;
    // The `remark` field is a JSONField. The backend accepts a dict whose
    // entries are matched as exact key/value pairs -- which is exactly what
    // `LeadData.remark.interest_level` stores.
    if (f.interest_level) payload.remark = { interest_level: f.interest_level };
    // Backend matches `created_at` / `updated_at` with `__date=<ISO YYYY-MM-DD>`.
    if (f.created_at) payload.created_at = f.created_at;
    if (f.updated_at) payload.updated_at = f.updated_at;

    return payload;
  }, [appliedFilters, debounced]); // Removed searchQuery from dependencies to use only debounced value

  // Fetch users for assigned_to filter
  const { data: usersData = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.user, API_HEADER)) as UserMasterData[];
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching users data:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const userOptions = useMemo(() => {
    if (!usersData || !Array.isArray(usersData)) return [];
    const options = usersData
      .filter((item) => item?.user_name)
      .map((item) => ({
        value: item.user_name,
        label: item.user_name,
      }));
    // Add "All" option at the beginning
    return [{ label: "All", value: "" }, ...options];
  }, [usersData]);

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
  }, [location.state?.returnToDashboard, location.state?.dashboardState, location.state?.fromDashboard]);

  // Fetch lead data with React Query - initial load (no filters, no search)
  // Pagination params (index/limit) are sent to the API so the backend can paginate when supported.
  const {
    data: leadData = [],
    isLoading: leadLoading,
    isFetching: leadFetching,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ["leads", pageIndex, pageSize],
    queryFn: async () => {
      try {
        // Initial payload - empty filters (not wrapped in filters object)
        const requestBody: { assigned_to: string; status: string; search: string } = {
          assigned_to: "",
          status: "",
          search: "",
        };

        const offset = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.leadFilter}?index=${offset}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;

        let list: LeadData[] = [];
        // Handle response - API returns { status: true, data: [...], message: "..." }
        if (data?.status === true && Array.isArray(data.data)) {
          list = data.data;
        } else if (data && Array.isArray(data.data)) {
          list = data.data;
        } else if (data && Array.isArray(data.results)) {
          list = data.results;
        }

        const rawTotal = data?.total ?? data?.count ?? data?.data_count ?? data?.total_count;
        const total = typeof rawTotal === "number" ? rawTotal : list.length;
        setTotalRecords(total);
        setServerPaginated(total > list.length);
        return list;
      } catch (error) {
        console.error("Error fetching lead data:", error);
        setTotalRecords(0);
        setServerPaginated(false);
        ToastNotification({
          type: "error",
          message: "Error fetching leads. Please try again.",
        });
        return [];
      }
    },
    enabled: false, // Don't run automatically
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Keep previous data visible while fetching to prevent "No records to display" flicker
    placeholderData: (previousData) => previousData || [],
  });

  // Separate query for filtered data - with filters and search
  // queryKey includes pageIndex/pageSize so page changes refetch with the new offset.
  // Pagination params (index/limit) are sent in the API URL alongside filters/search in the payload.
  const {
    data: filteredLeadData = [],
    isLoading: filteredLeadLoading,
    isFetching: filteredLeadFetching,
    refetch: refetchFilteredLeads,
  } = useQuery({
    queryKey: [
      "filteredLeads",
      buildLeadPayload, // Includes search when present - queryKey change auto-triggers refetch
      pageIndex,
      pageSize,
    ],
    queryFn: async () => {
      try {
        const filterPayload = buildLeadPayload;
        // buildLeadPayload always includes existing filters + search (when present)
        // This ensures filters and search are sent together in a single API call

        const requestBody = filterPayload; // Not wrapped in 'filters' object

        const offset = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `${URL.leadFilter}?index=${offset}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;

        let list: LeadData[] = [];
        // Handle response - API returns { status: true, data: [...], message: "..." }
        if (data?.status === true && Array.isArray(data.data)) {
          list = data.data;
        } else if (data && Array.isArray(data.data)) {
          list = data.data;
        } else if (data && Array.isArray(data.results)) {
          list = data.results;
        }

        const rawTotal = data?.total ?? data?.count ?? data?.data_count;
        const total = typeof rawTotal === "number" ? rawTotal : list.length;
        setTotalRecords(total);
        setServerPaginated(total > list.length);
        return list;
      } catch (error) {
        console.error("Error fetching filtered lead data:", error);
        setTotalRecords(0);
        setServerPaginated(false);
        ToastNotification({
          type: "error",
          message: "Error fetching leads. Please try again.",
        });
        return [];
      }
    },
    // Enable query when filters are applied OR search is present
    enabled: filtersApplied || Boolean(debounced.trim()),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    // Keep previous data visible while fetching to prevent "No records to display" flicker
    placeholderData: (previousData) => previousData || [],
  });

  // Determine which data to display
  // Search is merged into filter payload - use filteredLeadData when filters are applied OR search is present
  // placeholderData ensures previous data remains visible during fetch, preventing empty state flicker
  const displayData = useMemo(() => {
    // If filters were applied OR search is present, show filtered results
    // (buildLeadPayload includes search when present, ensuring search is sent with filters)
    if (filtersApplied || debounced.trim()) {
      // placeholderData keeps previous data visible while fetching, so filteredLeadData won't be empty during fetch
      return filteredLeadData || [];
    }

    // Otherwise, show the original lead data (no filters, no search)
    // placeholderData ensures leadData won't be empty during fetch
    return leadData || [];
  }, [leadData, filteredLeadData, filtersApplied, debounced]);

  // Helper function to check if filters have real values (not just null keys)
  const hasRealFilterValues = useCallback((filters: FilterState): boolean => {
    return (Object.values(filters) as Array<string | null>).some(
      (v) => typeof v === "string" && v.trim() !== "",
    );
  }, []);

  const applyFilters = async () => {
    try {
      // Check if there are any actual filter values (including search)
      // Search is treated as a filter and requires filtersApplied to be true
      const hasFilterValues =
        hasRealFilterValues(filterForm.values) || debounced.trim();

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setAppliedFilters(EMPTY_LEAD_FILTERS);
        appliedFiltersRef.current = EMPTY_LEAD_FILTERS; // Sync ref immediately

        // Clear filters and search from store
        clearStoreFilters(LIST_KEY);
        clearStoreSearch(LIST_KEY);

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
        await refetchLeads();
        setShowFilters(false)
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setFiltersApplied(true);

      // Store the current filter form values as applied filters
      const newAppliedFilters: FilterState = { ...filterForm.values };
      setAppliedFilters(newAppliedFilters);
      appliedFiltersRef.current = newAppliedFilters;

      // Save filters and search to store
      setStoreFilters(LIST_KEY, newAppliedFilters);
      setStoreSearch(LIST_KEY, searchQuery);

      // React Query will auto-refetch when queryKey changes (buildLeadPayload will update)
      // No manual refetch needed - queryKey change triggers exactly ONE API call
      setShowFilters(false);

      ToastNotification({
        type: "success",
        message: "Filters applied successfully",
      });
    } catch (error) {
      console.error("Error applying filters:", error);
      ToastNotification({
        type: "error",
        message: "Error applying filters. Please try again.",
      });
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset();
    setSearchQuery("");
    setFiltersApplied(false);

    // Reset applied filters state
    setAppliedFilters(EMPTY_LEAD_FILTERS);
    appliedFiltersRef.current = EMPTY_LEAD_FILTERS; // Sync ref immediately

    // Clear filters and search in store
    clearStoreFilters(LIST_KEY);
    clearStoreSearch(LIST_KEY);

    // Invalidate queries and refetch with initial payload (empty filters)
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredLeads"] });
    await refetchLeads(); // This uses empty filters - initial payload

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Track previous search value to detect changes
  const prevSearchRef = useRef<string>("");
  const searchInitializedRef = useRef(false);

  // Handle search changes - trigger API when search value changes (including when cleared)
  useEffect(() => {
    // Skip on initial mount if search hasn't changed
    if (!searchInitializedRef.current) {
      searchInitializedRef.current = true;
      prevSearchRef.current = debounced;
      return;
    }

    // Only trigger API if search actually changed (debounced)
    if (prevSearchRef.current === debounced) {
      return;
    }

    // Update ref for next comparison
    prevSearchRef.current = debounced;
    
    // Save search to store immediately
    setStoreSearch(LIST_KEY, searchQuery);
    
    // React Query will auto-refetch when queryKey changes (buildLeadPayload includes search)
    // buildLeadPayload is in queryKey, so when debounced changes, queryKey changes and triggers refetch
    if (debounced.trim() !== "") {
      // Search exists - set filtersApplied to true so filtered query is enabled
      setFiltersApplied(true);
    } else {
      // Search cleared
      if (!appliedFilters.assigned_to && !appliedFilters.status) {
        // No other filters - use default query
        setFiltersApplied(false);
      }
      // If other filters exist, filtersApplied stays true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Track if we've restored from store to prevent duplicate restoration calls
  const hasRestoredFromStore = useRef(false);
  // Track initial mount to trigger initial API call
  const isMountedRef = useRef(false);

  // Restore filters and search from store on mount and fetch data
  // Skip if refreshData is present (let refreshData effect handle it)
  useEffect(() => {
    if (hasRestoredFromStore.current) return;
    // Skip restoration if refreshData is present - let refreshData effect handle it
    if (location.state?.refreshData) return;

    const restoredState = useListFilterStore.getState().getState(LIST_KEY);

    const performRestore = async () => {
      if (!restoredState) {
        // No restored state, load default data
        await refetchLeads();
        return;
      }

      // 1️⃣ Restore filters
      let hasFilters = false;
      const restoredFilters = mergeRestoredLeadFilters(
        restoredState.filters as Partial<FilterState> | undefined,
      );
      console.log("restored filters---------------", restoredFilters);
      // Check for REAL filter values (not just null keys)
      if (hasRealFilterValues(restoredFilters)) {
        setAppliedFilters(restoredFilters);
        appliedFiltersRef.current = restoredFilters;
        // Restore filter form values (full FilterState shape)
        filterForm.setValues(restoredFilters);
        hasFilters = true;
      }

      // 2️⃣ Restore search
      let hasSearch = false;
      if (typeof restoredState.search === "string" && restoredState.search.trim()) {
        setSearchQuery(restoredState.search);
        hasSearch = true;
      }

      // Set filtersApplied FIRST to ensure query is enabled before refetch
      if (hasFilters || hasSearch) {
        setFiltersApplied(true);
      }

      // Wait for state updates to flush and buildLeadPayload useMemo to recalculate
      // Increased delay to ensure:
      // 1. debounced search value is updated (debounce is 1000ms)
      // 2. appliedFilters state triggers useMemo recalculation
      // 3. buildLeadPayload reads updated values from appliedFiltersRef.current
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 3️⃣ Fetch data based on restored state
      if (hasFilters || hasSearch) {
        // Manually refetch filtered leads AFTER:
        // - filtersApplied is set (query is enabled)
        // - restored state + refs are synced
        // - buildLeadPayload useMemo has recalculated with preserved values
        // This ensures the payload uses preserved filters/search instead of defaults
        await refetchFilteredLeads();
      } else {
        // No filters/search - load default data
        await refetchLeads();
      }
    };

    if(restoredState?.shouldRestore){
      performRestore();
      useListFilterStore.getState().setShouldRestore(LIST_KEY, false);
      hasRestoredFromStore.current = true;
      isMountedRef.current = true;
    } else if (!isMountedRef.current && !restoredState) {
      // Initial mount with no stored state - load default data
      isMountedRef.current = true;
      refetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.refreshData]);

  // Handle refresh when navigating from create/edit operations
  useEffect(() => {
    if (location.state?.refreshData) {
      const refreshData = async () => {
        // Check if we have filters or search from store
        const restoredState = getState(LIST_KEY);
        const hasActiveFilters = restoredState?.filters && hasRealFilterValues(mergeRestoredLeadFilters(restoredState.filters as Partial<FilterState>));
        const hasActiveSearch = restoredState?.search && restoredState.search.trim() !== "";

        // If we have filters/search in store, restore them first
        if (restoredState && (hasActiveFilters || hasActiveSearch)) {
          // Restore filters from store if they exist
          if (hasActiveFilters) {
            const restoredFilters = mergeRestoredLeadFilters(
              restoredState.filters as Partial<FilterState> | undefined,
            );
            setAppliedFilters(restoredFilters);
            appliedFiltersRef.current = restoredFilters; // Update ref immediately
            // Restore filter form values (full FilterState shape)
            filterForm.setValues(restoredFilters);
          }

          // Restore search from store if it exists
          if (hasActiveSearch) {
            setSearchQuery(restoredState.search);
          }

          // Set filtersApplied FIRST to ensure query is enabled
          setFiltersApplied(true);

          // Wait for state updates to flush and buildLeadPayload to recalculate
          // This ensures buildLeadPayload will use the restored values from refs
          // Increased delay to ensure debounced value is updated and useMemo recalculates
          await new Promise((resolve) => setTimeout(resolve, 1100));

          // Manually refetch filtered leads AFTER restored state + refs are synced + useMemo recalculated
          // This ensures the payload uses preserved filters/search instead of defaults
          await refetchFilteredLeads();
        } else {
          // No filters/search - refetch default data
          await refetchLeads();
        }

        // Clear the refresh state but preserve dashboard return state
        navigate(location.pathname, {
          replace: true,
          state: {
            returnToDashboard: returnToDashboardRef.current,
            dashboardState: dashboardStateRef.current,
            fromDashboard: fromDashboardRef.current,
          },
        });
      };

      refreshData();
    }
  }, [
    location.state?.refreshData,
    refetchLeads,
    refetchFilteredLeads,
    navigate,
    location.pathname,
    getState,
    filterForm,
    hasRealFilterValues,
  ]);

  // Track if we're restoring filters to trigger refetch after state updates
  const [, setIsRestoringFilters] = useState(
    Boolean(location.state?.restoreFilters)
  );

  // Add effect to restore filters when returning from create/edit operations
  useEffect(() => {
    // Check if we're returning from a create/edit operation with filter restoration
    // Only restore if we haven't already restored (prevents re-initialization)
    if (
      location.state?.restoreFilters &&
      restoreFiltersDataRef.current &&
      !restoreFiltersProcessed.current &&
      !hasRestoredRef.current
    ) {
      restoreFiltersProcessed.current = true;
      hasRestoredRef.current = true;
      console.log(
        "🔄 Restoring filters and search after create/edit operation"
      );

      const restoreFiltersData = restoreFiltersDataRef.current;
      
      // Set restore guard FIRST to block all refetch logic during restore
      setIsRestoringFilters(true);

      // Restore filter form state -- full FilterState shape from restore blob
      const restoredFilters = mergeRestoredLeadFilters(
        restoreFiltersData.filters as Partial<FilterState> | undefined,
      );
      filterForm.setValues(restoredFilters);

      // Restore applied filters state FIRST (synchronously) to ensure refs are updated
      setAppliedFilters(restoredFilters);
      appliedFiltersRef.current = restoredFilters; // Sync ref immediately BEFORE startTransition

      // Check for REAL filter values and search to determine filtersApplied
      // This must be done BEFORE startTransition to ensure query is enabled
      const hasRealFilters = hasRealFilterValues(restoredFilters);
      const hasSearch = Boolean(restoreFiltersData.searchQuery?.trim());
      const shouldApplyFilters = restoreFiltersData.filtersApplied || hasRealFilters || hasSearch;
      
      // Set filtersApplied FIRST (synchronously) to ensure query is enabled before refetch
      setFiltersApplied(shouldApplyFilters);

      // Batch remaining state restoration together to prevent multiple queryKey changes
      // This ensures React Query queryKey changes only ONCE after all state is restored
      // Using startTransition to batch state updates in a single render cycle
      startTransition(() => {
        // Restore search value
        if (restoreFiltersData.searchQuery !== undefined) {
          setSearchQuery(restoreFiltersData.searchQuery || "");
        }

        // Restore fromDashboard flag if present
        if (restoreFiltersData.fromDashboard !== undefined) {
          fromDashboardRef.current = Boolean(restoreFiltersData.fromDashboard);
        }
      });

      // Save to store (use the same restoredFilters variable declared above)
      setStoreFilters(LIST_KEY, restoredFilters);
      if (restoreFiltersData.searchQuery !== undefined) {
        setStoreSearch(LIST_KEY, restoreFiltersData.searchQuery || "");
      }

      // Clear the restore filters flag but preserve dashboard return state
      // Use refs to ensure persistence
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });

      // Wait for state updates to flush and queryKey to stabilize, then manually refetch
      const performRestore = async () => {
        try {
          // Wait for all state updates to flush and buildLeadPayload useMemo to recalculate
          // This ensures queryKey changes only ONCE with complete payload
          // Increased delay to ensure:
          // 1. debounced value is updated (debounce is 500ms, so 600ms should be enough)
          // 2. appliedFiltersRef.current is fully synchronized
          // 3. appliedFilters state change triggers useMemo recalculation
          // 4. buildLeadPayload reads updated values from appliedFiltersRef.current
          await new Promise((resolve) => setTimeout(resolve, 1100));

          // Manually refetch filtered leads AFTER:
          // - filtersApplied is set (query is enabled)
          // - restored state + refs are synced
          // - buildLeadPayload useMemo has recalculated with preserved values
          // This ensures the payload uses preserved filters/search instead of defaults
          await refetchFilteredLeads();

          console.log("🔄 State restored - Manually refetched with restored filters/search", {
            filters: restoreFiltersData.filters,
            filtersApplied: restoreFiltersData.filtersApplied,
            searchQuery: restoreFiltersData.searchQuery,
            debounced: debounced, // Log debounced value to verify it's updated
          });
        } catch (error) {
          console.error("Error during restore:", error);
        } finally {
          // Release restore guard after state is stable and queryKey has changed
          setIsRestoringFilters(false);
        }
      };

      performRestore();
      return;
    }

    if (!location.state?.restoreFilters && restoreFiltersProcessed.current) {
      restoreFiltersProcessed.current = false;
      hasRestoredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.restoreFilters, navigate, location.pathname]);

  const getInterestLevelColor = (level: string | undefined) => {
    switch (level) {
      case "High":
        return "red";
      case "Medium":
        return "yellow";
      case "Low":
        return "gray";
      default:
        return "gray";
    }
  };

  const formatLocation = (location: LeadData["location"]) => {
    if (!location) return "-";
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.country) parts.push(location.country);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const getLatestMessage = (remark: LeadData["remark"]) => {
    if (!remark?.messages || remark.messages.length === 0) return "-";
    const latest = remark.messages[remark.messages.length - 1];
    return latest.message || "-";
  };

  const leadStats = useMemo(() => {
    const list = displayData;
    const inPipeline = list.filter(
      (l: LeadData) => l.status === "Contacted" || l.status === "Qualified",
    ).length;
    return {
      total: serverPaginated ? totalRecords : list.length,
      new: list.filter((l: LeadData) => l.status === "New").length,
      inPipeline,
      converted: list.filter((l: LeadData) => l.status === "Converted").length,
    };
  }, [displayData, serverPaginated, totalRecords]);

  // When the backend honors index/limit pagination we display the response as-is.
  // Otherwise we fall back to client-side slicing so behavior is unchanged.
  const effectiveTotalRecords = serverPaginated
    ? totalRecords
    : displayData.length;

  const pagedRows = useMemo(() => {
    if (serverPaginated) return displayData;
    const start = pageIndex * pageSize;
    return displayData.slice(start, start + pageSize);
  }, [displayData, pageIndex, pageSize, serverPaginated]);

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

  const { border, muted, fg, primary, fontSans } = erpTheme;

  const visibleDataColumnCount = useMemo(() => {
    const v = visibleColumns;
    let n = 0;
    if (v.sno) n++;
    if (v.company) n++;
    if (v.contactPerson) n++;
    if (v.contactNumber) n++;
    if (v.email) n++;
    if (v.location) n++;
    if (v.status) n++;
    if (v.assignedTo) n++;
    if (v.createdBy) n++;
    if (v.interest) n++;
    if (v.latestRemark) n++;
    if (v.createdAt) n++;
    if (v.updatedAt) n++;
    return n + 1;
  }, [visibleColumns]);

  const columnToggleItems: ERPListColumnToggleItem[] = useMemo(
    () => [
      { id: "sno", label: "S.No", checked: visibleColumns.sno, onToggle: () => setVisibleColumns((p) => ({ ...p, sno: !p.sno })) },
      { id: "company", label: "Company name", checked: visibleColumns.company, onToggle: () => setVisibleColumns((p) => ({ ...p, company: !p.company })) },
      { id: "contactPerson", label: "Contact person", checked: visibleColumns.contactPerson, onToggle: () => setVisibleColumns((p) => ({ ...p, contactPerson: !p.contactPerson })) },
      { id: "contactNumber", label: "Contact number", checked: visibleColumns.contactNumber, onToggle: () => setVisibleColumns((p) => ({ ...p, contactNumber: !p.contactNumber })) },
      { id: "email", label: "Email", checked: visibleColumns.email, onToggle: () => setVisibleColumns((p) => ({ ...p, email: !p.email })) },
      { id: "location", label: "Location", checked: visibleColumns.location, onToggle: () => setVisibleColumns((p) => ({ ...p, location: !p.location })) },
      { id: "status", label: "Status", checked: visibleColumns.status, onToggle: () => setVisibleColumns((p) => ({ ...p, status: !p.status })) },
      { id: "assignedTo", label: "Assigned to", checked: visibleColumns.assignedTo, onToggle: () => setVisibleColumns((p) => ({ ...p, assignedTo: !p.assignedTo })) },
      { id: "createdBy", label: "Created by", checked: visibleColumns.createdBy, onToggle: () => setVisibleColumns((p) => ({ ...p, createdBy: !p.createdBy })) },
      { id: "interest", label: "Interest level", checked: visibleColumns.interest, onToggle: () => setVisibleColumns((p) => ({ ...p, interest: !p.interest })) },
      { id: "latestRemark", label: "Latest remark", checked: visibleColumns.latestRemark, onToggle: () => setVisibleColumns((p) => ({ ...p, latestRemark: !p.latestRemark })) },
      { id: "createdAt", label: "Created at", checked: visibleColumns.createdAt, onToggle: () => setVisibleColumns((p) => ({ ...p, createdAt: !p.createdAt })) },
      { id: "updatedAt", label: "Updated at", checked: visibleColumns.updatedAt, onToggle: () => setVisibleColumns((p) => ({ ...p, updatedAt: !p.updatedAt })) },
    ],
    [visibleColumns],
  );

  // Reset to first page when filters/search change. Use a ref to skip the initial
  // render and any restore-driven update so we don't clobber a restored pageIndex.
  const lastBuildLeadPayloadRef = useRef<any>(null);
  useEffect(() => {
    if (lastBuildLeadPayloadRef.current === null) {
      lastBuildLeadPayloadRef.current = buildLeadPayload;
      return;
    }
    if (lastBuildLeadPayloadRef.current === buildLeadPayload) return;
    lastBuildLeadPayloadRef.current = buildLeadPayload;
    setPageIndex(0);
  }, [buildLeadPayload]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(Math.max(0, effectiveTotalRecords) / pageSize),
    );
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [effectiveTotalRecords, pageSize, pageIndex]);

  // Refetch the unfiltered query when page/pageSize change and no filters/search are applied.
  // (The filtered query auto-refetches via its queryKey.)
  const initialPaginationMountRef = useRef(true);
  useEffect(() => {
    if (initialPaginationMountRef.current) {
      initialPaginationMountRef.current = false;
      return;
    }
    if (filtersApplied || debounced.trim()) return;
    refetchLeads();
  }, [pageIndex, pageSize, filtersApplied, debounced, refetchLeads]);

  /* ───────────── Column header filters (click-to-edit, EnquiryMaster pattern)
   * Strictly NON-INVASIVE: the column header inputs live on top of the
   * EXISTING `appliedFilters` state. They DO NOT introduce any new payload
   * structure, separate React Query, search path, or store key. A change to
   * a column header writes directly into `appliedFilters` (and the advanced
   * filter form) -- the existing `buildLeadPayload` useMemo then re-builds
   * and React Query auto-refetches via queryKey, exactly the way the
   * advanced-filter `Apply` button does today.
   * ─────────────────────────────────────────────────────────────────────── */

  // Which column header is currently in edit mode (only one at a time).
  const [editingHeaderColumn, setEditingHeaderColumn] =
    useState<LeadEditingColumn>(null);

  // Bumped on every header-filter change. A debounced effect below reads
  // this and calls `refetchFilteredLeads` for safety -- React Query's
  // queryKey change already triggers a refetch, but the tick gives us a
  // single, stable, debounced refetch path for parity with EnquiryMaster.
  const [headerFilterTick, setHeaderFilterTick] = useState(0);
  // 1100ms (slightly after the HeaderFilterInput's 1000ms commit debounce) so
  // the safety-net refetch trails -- and is therefore deduplicated by -- the
  // queryKey-driven auto-refetch that fires once `appliedFilters` commits.
  const [debouncedHeaderFilterTick] = useDebouncedValue(headerFilterTick, 1100);
  const lastHandledHeaderFilterTickRef = useRef(0);

  const openHeaderEditor = useCallback((col: NonNullable<LeadEditingColumn>) => {
    setEditingHeaderColumn(col);
  }, []);

  // IMPORTANT: functional setter, so a fast click on another header that
  // already switched the editing column is not undone by this collapse.
  const makeCollapseHeader = useCallback(
    (col: NonNullable<LeadEditingColumn>) => () => {
      setEditingHeaderColumn((cur) => (cur === col ? null : cur));
    },
    [],
  );

  // Header values are derived from `appliedFilters` so the header inputs and
  // the advanced filter drawer stay in sync via a single source of truth.
  const leadHeaderFilterValues: LeadHeaderFilterValues = useMemo(
    () => ({
      name: appliedFilters.name ?? "",
      contact_person: appliedFilters.contact_person ?? "",
      contact_number: appliedFilters.contact_number ?? "",
      email_id: appliedFilters.email_id ?? "",
      location: appliedFilters.location ?? "",
      status: appliedFilters.status ?? "",
      assigned_to: appliedFilters.assigned_to ?? "",
      created_by: appliedFilters.created_by ?? "",
      interest_level: appliedFilters.interest_level ?? "",
      created_at: appliedFilters.created_at ?? "",
      updated_at: appliedFilters.updated_at ?? "",
    }),
    [appliedFilters],
  );

  /**
   * Atomically patch one or more filter keys at once.
   *
   * Used by both single-key header inputs (Select / TextInput) AND the
   * compound date editors which commit `_from`+`_to` together. Reuses the
   * EXISTING applied-filters / store / filtersApplied wiring -- no new
   * payload keys, no client-side filtering. After the state update,
   * `buildLeadPayload` re-memos and React Query auto-refetches via queryKey.
   */
  const handleLeadHeaderFilterPatch = useCallback(
    (patch: Partial<FilterState>) => {
      const newApplied: FilterState = {
        ...appliedFiltersRef.current,
        ...patch,
      };

      // 1) advanced filter drawer stays in sync for every patched key
      (Object.entries(patch) as Array<[keyof FilterState, string | null]>).forEach(
        ([k, v]) => {
          filterForm.setFieldValue(k, v);
        },
      );

      // 2) applied filters state + ref (the ref is what `buildLeadPayload` reads)
      setAppliedFilters(newApplied);
      appliedFiltersRef.current = newApplied;

      // 3) persist to global store so navigations restore correctly
      setStoreFilters(LIST_KEY, newApplied);

      // 4) flip filtersApplied based on whether any real filter / search remains
      const hasFilters = hasRealFilterValues(newApplied);
      const hasSearch = Boolean(searchQuery.trim());
      setFiltersApplied(hasFilters || hasSearch);

      // 5) reset to first page (same as advanced-filter Apply does)
      setPageIndex(0);

      // 6) bump tick for the debounced refetch fallback
      setHeaderFilterTick((t) => t + 1);
    },
    [filterForm, hasRealFilterValues, searchQuery, setStoreFilters],
  );

  /** Single-key wrapper -- this is what `LeadHeaderFiltersProp.onChange` calls. */
  const handleLeadHeaderFilterChange = useCallback(
    (key: LeadHeaderFilterKey, value: string) => {
      handleLeadHeaderFilterPatch({ [key]: value || null } as Partial<FilterState>);
    },
    [handleLeadHeaderFilterPatch],
  );

  // Display formatter: friendlier label for the collapsed header. Reuses the
  // existing option arrays so the labels stay consistent with the drawer.
  // Dates are formatted with the user's `dateFormat`.
  const leadHeaderDisplayFormatter = useMemo<
    Partial<Record<LeadHeaderFilterKey, (value: string) => string>>
  >(
    () => ({
      status: (raw) =>
        statusOptions.find((o) => o.value === raw)?.label ?? raw,
      assigned_to: (raw) =>
        userOptions.find((o) => o.value === raw)?.label ?? raw,
      created_by: (raw) =>
        userOptions.find((o) => o.value === raw)?.label ?? raw,
      interest_level: (raw) =>
        interestLevelOptions.find((o) => o.value === raw)?.label ?? raw,
      created_at: (raw) => (raw ? dayjs(raw).format(dateFormat) : raw),
      updated_at: (raw) => (raw ? dayjs(raw).format(dateFormat) : raw),
    }),
    [userOptions, dateFormat],
  );

  // Stable styles for the SingleDateInputs used in the date column headers.
  // Memoised so they don't churn `leadHeaderRenderInput`'s identity on every
  // render (the editors look like the other Selects in the filter drawer).
  const leadHeaderDateInputStyles = useMemo(
    () =>
      erpListFilterUnifiedMantineStyles(
        erpTheme,
      ) as unknown as Record<
        string,
        CSSProperties & Record<string, unknown>
      >,
    [erpTheme],
  );

  // Per-column rich editors -- mirror the advanced filter drawer's controls
  // exactly so the column header sends the SAME payload value the advanced
  // filter would (no free-text drift for Select-backed columns; the JSON
  // remark / location text fields fall back to the default TextInput).
  const leadHeaderRenderInput = useMemo<
    Partial<Record<LeadHeaderFilterKey, LeadHeaderRenderInput>>
  >(
    () => ({
      status: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder="Status"
          searchable
          clearable
          size="xs"
          data={statusOptions}
          value={appliedFilters.status || ""}
          onChange={(value) => {
            handleLeadHeaderFilterChange("status", value || "");
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      assigned_to: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder={usersLoading ? "Loading users…" : "Assigned to"}
          searchable
          clearable
          size="xs"
          data={userOptions}
          disabled={usersLoading}
          value={appliedFilters.assigned_to || ""}
          onChange={(value) => {
            handleLeadHeaderFilterChange("assigned_to", value || "");
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      created_by: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder={usersLoading ? "Loading users…" : "Created by"}
          searchable
          clearable
          size="xs"
          data={userOptions}
          disabled={usersLoading}
          value={appliedFilters.created_by || ""}
          onChange={(value) => {
            handleLeadHeaderFilterChange("created_by", value || "");
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      interest_level: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder="Interest"
          searchable
          clearable
          size="xs"
          data={interestLevelOptions}
          value={appliedFilters.interest_level || ""}
          onChange={(value) => {
            handleLeadHeaderFilterChange("interest_level", value || "");
            if (value) onClose();
          }}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      // Single date picker -- the backend matches `created_at__date=<ISO>`.
      created_at: ({ onClose }) => (
        <SingleDateInput
          value={
            appliedFilters.created_at
              ? dayjs(appliedFilters.created_at).toDate()
              : null
          }
          onChange={(date) => {
            handleLeadHeaderFilterChange(
              "created_at",
              date ? dayjs(date).format("YYYY-MM-DD") : "",
            );
            // Match `Select` UX: collapse the editor right after a pick.
            if (date) onClose();
          }}
          placeholder="Created at"
          size="xs"
          allowDeselection
          classNames={LEAD_HEADER_DATE_INPUT_CLASSNAMES}
          styles={leadHeaderDateInputStyles}
        />
      ),
      // Single date picker -- the backend matches `updated_at__date=<ISO>`.
      updated_at: ({ onClose }) => (
        <SingleDateInput
          value={
            appliedFilters.updated_at
              ? dayjs(appliedFilters.updated_at).toDate()
              : null
          }
          onChange={(date) => {
            handleLeadHeaderFilterChange(
              "updated_at",
              date ? dayjs(date).format("YYYY-MM-DD") : "",
            );
            if (date) onClose();
          }}
          placeholder="Updated at"
          size="xs"
          allowDeselection
          classNames={LEAD_HEADER_DATE_INPUT_CLASSNAMES}
          styles={leadHeaderDateInputStyles}
        />
      ),
    }),
    [
      appliedFilters.status,
      appliedFilters.assigned_to,
      appliedFilters.created_by,
      appliedFilters.interest_level,
      appliedFilters.created_at,
      appliedFilters.updated_at,
      userOptions,
      usersLoading,
      handleLeadHeaderFilterChange,
      leadHeaderDateInputStyles,
      erpTheme,
    ],
  );

  const leadHeaderFiltersProp: LeadHeaderFiltersProp = useMemo(
    () => ({
      values: leadHeaderFilterValues,
      onChange: handleLeadHeaderFilterChange,
      renderInput: leadHeaderRenderInput,
      displayFormatter: leadHeaderDisplayFormatter,
    }),
    [
      leadHeaderFilterValues,
      handleLeadHeaderFilterChange,
      leadHeaderRenderInput,
      leadHeaderDisplayFormatter,
    ],
  );

  /**
   * Renders the inner content of a single-key filterable `<th>` (the
   * click-to-edit label + the inline editor). Centralises the boilerplate
   * shared by every non-date column header so the table render stays small.
   */
  const renderFilterableHeader = useCallback(
    (
      columnId: NonNullable<LeadEditingColumn>,
      filterKey: LeadHeaderFilterKey,
      label: string,
      ariaLabel: string = `Filter ${label}`,
    ) => {
      const value = leadHeaderFiltersProp.values[filterKey];
      const filterDisplay = value
        ? leadHeaderFiltersProp.displayFormatter?.[filterKey]?.(value) ?? value
        : "";
      return editingHeaderColumn === columnId ? (
        <FilterableHeaderEdit onCollapse={makeCollapseHeader(columnId)}>
          {leadHeaderFiltersProp.renderInput?.[filterKey]?.({
            autoFocus: true,
            onClose: makeCollapseHeader(columnId),
          }) ?? (
            <HeaderFilterInput
              value={value}
              onChange={(val) => leadHeaderFiltersProp.onChange(filterKey, val)}
              ariaLabel={ariaLabel}
              autoFocus
            />
          )}
        </FilterableHeaderEdit>
      ) : (
        <FilterableHeaderLabel
          label={label}
          filterDisplay={filterDisplay}
          onClick={() => openHeaderEditor(columnId)}
          theme={erpTheme}
        />
      );
    },
    [
      editingHeaderColumn,
      leadHeaderFiltersProp,
      makeCollapseHeader,
      openHeaderEditor,
      erpTheme,
    ],
  );


  // Debounced safety refetch -- the queryKey change already triggers a
  // refetch when `appliedFilters` updates, this just guarantees it.
  useEffect(() => {
    if (debouncedHeaderFilterTick === 0) return;
    if (lastHandledHeaderFilterTickRef.current === debouncedHeaderFilterTick)
      return;
    lastHandledHeaderFilterTickRef.current = debouncedHeaderFilterTick;
    void refetchFilteredLeads();
  }, [debouncedHeaderFilterTick, refetchFilteredLeads]);

  const isTableDataLoading =
    leadLoading || leadFetching || filteredLeadLoading || filteredLeadFetching;
  const filterApplyBusy = isTableDataLoading;

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
                    icon={<IconUsers size={14} color={primary} />}
                    value={leadStats.total}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconSparkles size={14} color="#2563eb" />}
                    iconBackground="#dbeafe"
                    iconColor="#2563eb"
                    value={leadStats.new}
                    label="New"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconMessageCircle size={14} color="#7c3aed" />}
                    iconBackground="#f3e8ff"
                    iconColor="#7c3aed"
                    value={leadStats.inPipeline}
                    label="In pipeline"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCircleCheck size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={leadStats.converted}
                    label="Converted"
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
                          onClick={() => {
                            setSearchQuery("");
                            clearStoreSearch(LIST_KEY);
                            const hasOtherFilters =
                              appliedFilters.assigned_to || appliedFilters.status;
                            if (!hasOtherFilters) {
                              setFiltersApplied(false);
                            }
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
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                    onClick={() => {
                      useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                      navigate("/lead-create", {
                        state: {
                          returnTo: "/lead",
                          restoreFilters: {
                            filters: appliedFilters,
                            filtersApplied,
                            fromDashboard: fromDashboardRef.current,
                          },
                        },
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
              subtitle:
                "Refine by company, contact, status, assignee, dates and more; search is in the toolbar",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={clearAllFilters}
                  onApply={applyFilters}
                  applyLoading={filterApplyBusy}
                  applyDisabled={filterApplyBusy}
                />
              ),
              children: (
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <TextInput
                        size="xs"
                        label="Company"
                        placeholder="Search company"
                        disabled={filterApplyBusy}
                        value={filterForm.values.name || ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "name",
                            e.currentTarget.value || null,
                          )
                        }
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <TextInput
                        size="xs"
                        label="Contact person"
                        placeholder="Search contact person"
                        disabled={filterApplyBusy}
                        value={filterForm.values.contact_person || ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "contact_person",
                            e.currentTarget.value || null,
                          )
                        }
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <TextInput
                        size="xs"
                        label="Contact number"
                        placeholder="Search contact number"
                        disabled={filterApplyBusy}
                        value={filterForm.values.contact_number || ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "contact_number",
                            e.currentTarget.value || null,
                          )
                        }
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <TextInput
                        size="xs"
                        label="Email"
                        placeholder="Search email"
                        disabled={filterApplyBusy}
                        value={filterForm.values.email_id || ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "email_id",
                            e.currentTarget.value || null,
                          )
                        }
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <TextInput
                        size="xs"
                        label="Location"
                        placeholder="Search city / state / country"
                        disabled={filterApplyBusy}
                        value={filterForm.values.location || ""}
                        onChange={(e) =>
                          filterForm.setFieldValue(
                            "location",
                            e.currentTarget.value || null,
                          )
                        }
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Select
                        size="xs"
                        label="Status"
                        placeholder="All statuses"
                        searchable
                        clearable
                        data={statusOptions}
                        nothingFoundMessage="No status found"
                        disabled={filterApplyBusy}
                        value={filterForm.values.status || ""}
                        onChange={(value) =>
                          filterForm.setFieldValue("status", value || null)
                        }
                        classNames={erpListGeistSelectClassNames}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Select
                        key={`assigned-to-${filterForm.values.assigned_to}-${usersLoading}-${userOptions.length}`}
                        size="xs"
                        label="Assigned to"
                        placeholder={
                          usersLoading ? "Loading users…" : "All users"
                        }
                        searchable
                        clearable
                        data={userOptions}
                        nothingFoundMessage={
                          usersLoading ? "Loading users…" : "No users found"
                        }
                        disabled={filterApplyBusy || usersLoading}
                        value={filterForm.values.assigned_to || ""}
                        onChange={(value) =>
                          filterForm.setFieldValue("assigned_to", value || null)
                        }
                        classNames={erpListGeistSelectClassNames}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Select
                        key={`created-by-${filterForm.values.created_by}-${usersLoading}-${userOptions.length}`}
                        size="xs"
                        label="Created by"
                        placeholder={
                          usersLoading ? "Loading users…" : "All users"
                        }
                        searchable
                        clearable
                        data={userOptions}
                        nothingFoundMessage={
                          usersLoading ? "Loading users…" : "No users found"
                        }
                        disabled={filterApplyBusy || usersLoading}
                        value={filterForm.values.created_by || ""}
                        onChange={(value) =>
                          filterForm.setFieldValue("created_by", value || null)
                        }
                        classNames={erpListGeistSelectClassNames}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Select
                        size="xs"
                        label="Interest"
                        placeholder="All levels"
                        searchable
                        clearable
                        data={interestLevelOptions}
                        nothingFoundMessage="No interest level found"
                        disabled={filterApplyBusy}
                        value={filterForm.values.interest_level || ""}
                        onChange={(value) =>
                          filterForm.setFieldValue(
                            "interest_level",
                            value || null,
                          )
                        }
                        classNames={erpListGeistSelectClassNames}
                        styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <SingleDateInput
                        label="Created at"
                        placeholder="Pick a date"
                        value={
                          filterForm.values.created_at
                            ? dayjs(filterForm.values.created_at).toDate()
                            : null
                        }
                        onChange={(date) =>
                          filterForm.setFieldValue(
                            "created_at",
                            date ? dayjs(date).format("YYYY-MM-DD") : null,
                          )
                        }
                        size="xs"
                        disabled={filterApplyBusy}
                        allowDeselection
                        classNames={LEAD_HEADER_DATE_INPUT_CLASSNAMES}
                        styles={leadHeaderDateInputStyles}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <SingleDateInput
                        label="Updated at"
                        placeholder="Pick a date"
                        value={
                          filterForm.values.updated_at
                            ? dayjs(filterForm.values.updated_at).toDate()
                            : null
                        }
                        onChange={(date) =>
                          filterForm.setFieldValue(
                            "updated_at",
                            date ? dayjs(date).format("YYYY-MM-DD") : null,
                          )
                        }
                        size="xs"
                        disabled={filterApplyBusy}
                        allowDeselection
                        classNames={LEAD_HEADER_DATE_INPUT_CLASSNAMES}
                        styles={leadHeaderDateInputStyles}
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
                  totalRecords={effectiveTotalRecords}
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  onPageIndexChange={setPageIndex}
                  onPageSizeChange={(size) => {
                    setPageIndex(0);
                    setPageSize(size);
                  }}
                  pageSizeOptions={["10", "15", "25", "50"]}
                  selectClassNames={{
                    dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                    option: ERP_LIST_GEIST_ROOT_CLASS,
                  }}
                />
              ),
              children: (
                <table style={erpListTableElementStyle(erpTheme)}>
                  <thead>
                    <tr style={{ height: 52.4 }}>
                      {visibleColumns.sno && (
                        <th style={{...erpListThStyle(erpTheme), minWidth:40}}>
                          S.No
                        </th>
                      )}
                      {visibleColumns.company && (
                        <th style={{...erpListThStyle(erpTheme), minWidth:180}}>
                          {renderFilterableHeader("name", "name", "Company")}
                        </th>
                      )}
                      {visibleColumns.contactPerson && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "contact_person",
                            "contact_person",
                            "Contact person",
                          )}
                        </th>
                      )}
                      {visibleColumns.contactNumber && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "contact_number",
                            "contact_number",
                            "Contact number",
                          )}
                        </th>
                      )}
                      {visibleColumns.email && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "email_id",
                            "email_id",
                            "Email",
                          )}
                        </th>
                      )}
                      {visibleColumns.location && (
                        <th style={{...erpListThStyle(erpTheme), minWidth:150}}>
                          {renderFilterableHeader(
                            "location",
                            "location",
                            "Location",
                          )}
                        </th>
                      )}
                      {visibleColumns.status && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader("status", "status", "Status")}
                        </th>
                      )}
                      {visibleColumns.assignedTo && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "assigned_to",
                            "assigned_to",
                            "Assigned to",
                          )}
                        </th>
                      )}
                      {visibleColumns.createdBy && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "created_by",
                            "created_by",
                            "Created by",
                          )}
                        </th>
                      )}
                      {visibleColumns.interest && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "interest_level",
                            "interest_level",
                            "Interest",
                          )}
                        </th>
                      )}
                      {visibleColumns.latestRemark && (
                        <th style={{...erpListThStyle(erpTheme), minWidth:180}}>
                          Latest remark
                        </th>
                      )}
                      {visibleColumns.createdAt && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "created_at",
                            "created_at",
                            "Created at",
                          )}
                        </th>
                      )}
                      {visibleColumns.updatedAt && (
                        <th style={erpListThStyle(erpTheme)}>
                          {renderFilterableHeader(
                            "updated_at",
                            "updated_at",
                            "Updated at",
                          )}
                        </th>
                      )}
                      <th style={erpListThActionsSpacer(erpTheme)} />
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
                                Loading leads…
                              </Text>
                            </Stack>
                          </Center>
                        </td>
                      </tr>
                    ) : pagedRows.length === 0 ? (
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
                              <IconUsers size={24} color={muted} />
                            </Box>
                            <Box>
                              <Text fw={500} c={fg} style={{ fontFamily: fontSans }}>
                                No leads found
                              </Text>
                              <Text size="sm" c={muted} mt={4} style={{ fontFamily: fontSans }}>
                                Try adjusting your search or filters
                              </Text>
                            </Box>
                          </Stack>
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((row: LeadData, rowIdx: number) => {
                        const sno = pageIndex * pageSize + rowIdx + 1;
                        const remarkMessage = getLatestMessage(row.remark);
                        const hasMessages = Boolean(
                          row.remark?.messages && row.remark.messages.length > 0,
                        );
                        return (
                          <tr key={row.id} {...erpListDataRowProps(erpTheme)}>
                            {visibleColumns.sno && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                  {sno}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.company && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                  {row.name || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.contactPerson && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.contact_person || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.contactNumber && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.contact_number || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.email && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted, maxWidth: 220 }}>
                                <Text size="sm" lineClamp={1} style={{ fontFamily: fontSans }}>
                                  {row.email_id || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.location && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted, maxWidth: 200 }}>
                                <Tooltip
                                  label={formatLocation(row.location)}
                                  withArrow
                                  styles={{ tooltip: { fontFamily: fontSans, fontSize: 12 } }}
                                >
                                  <Text size="sm" c={fg} lineClamp={1} style={{ cursor: "default", fontFamily: fontSans }}>
                                    {formatLocation(row.location)}
                                  </Text>
                                </Tooltip>
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td style={erpListTdPaddingStyle()}>
                                <LeadsStatusPill status={row.status} />
                              </td>
                            )}
                            {visibleColumns.assignedTo && (
                              <td style={erpListTdPaddingStyle()}>
                                <Text fw={500} size="sm" c={fg} style={{ fontFamily: fontSans }}>
                                  {row.assigned_to || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.createdBy && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.created_by || "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.interest && (
                              <td style={erpListTdPaddingStyle()}>
                                <Badge size="sm" color={getInterestLevelColor(row.remark?.interest_level)}>
                                  {row.remark?.interest_level || "—"}
                                </Badge>
                              </td>
                            )}
                            {visibleColumns.latestRemark && (
                              <td style={{ ...erpListTdPaddingStyle(), maxWidth: 200 }}>
                                <Tooltip
                                  label={hasMessages ? "Click to view full conversation" : remarkMessage}
                                  maw={400}
                                  withArrow
                                  multiline
                                  styles={{ tooltip: { fontFamily: fontSans, fontSize: 12, whiteSpace: "normal" } }}
                                >
                                  <Text
                                    size="sm"
                                    lineClamp={2}
                                    style={{
                                      cursor: hasMessages ? "pointer" : "default",
                                      color: hasMessages ? primary : fg,
                                      textDecoration: hasMessages ? "underline" : "none",
                                      fontFamily: fontSans,
                                    }}
                                    onClick={() => {
                                      if (hasMessages) {
                                        setSelectedLeadForRemark(row);
                                        openRemarkModal();
                                      }
                                    }}
                                  >
                                    {remarkMessage}
                                  </Text>
                                </Tooltip>
                              </td>
                            )}
                            {visibleColumns.createdAt && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.created_at
                                    ? dayjs(row.created_at).format(`${dateFormat} HH:mm`)
                                    : "—"}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.updatedAt && (
                              <td style={{ ...erpListTdPaddingStyle(), color: muted }}>
                                <Text size="sm" style={{ fontFamily: fontSans }}>
                                  {row.updated_at
                                    ? dayjs(row.updated_at).format(`${dateFormat} HH:mm`)
                                    : "—"}
                                </Text>
                              </td>
                            )}
                            <td style={erpListStickyActionTdStyle(erpTheme)}>
                              <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray">
                                    <IconDotsVertical size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Box px={10} py={5}>
                                    <UnstyledButton
                                      onClick={() => {
                                        useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
                                        navigate("/lead-create", {
                                          state: {
                                            leadData: row,
                                            returnTo: "/lead",
                                            restoreFilters: {
                                              filters: appliedFilters,
                                              filtersApplied,
                                              fromDashboard: fromDashboardRef.current,
                                            },
                                          },
                                        });
                                      }}
                                    >
                                      <Group gap="sm">
                                        <IconEdit size={16} style={{ color: primary }} />
                                        <Text size="sm" style={{ fontFamily: fontSans }}>
                                          Edit
                                        </Text>
                                      </Group>
                                    </UnstyledButton>
                                  </Box>
                                </Menu.Dropdown>
                              </Menu>
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

      {/* Conversation Modal */}
      <Modal
        opened={remarkModalOpened}
        onClose={closeRemarkModal}
        title={
          <Stack gap={4}>
            <Text size="lg" fw={600} c="#105476">
              Conversation
            </Text>
            {selectedLeadForRemark && (
              <Group gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  {selectedLeadForRemark.name}
                </Text>
                {selectedLeadForRemark.remark?.interest_level && (
                  <>
                    <Text size="sm" c="dimmed">
                      •
                    </Text>
                    <Badge
                      size="sm"
                      color={getInterestLevelColor(
                        selectedLeadForRemark.remark.interest_level
                      )}
                    >
                      {selectedLeadForRemark.remark.interest_level} Interest
                    </Badge>
                  </>
                )}
              </Group>
            )}
          </Stack>
        }
        size="lg"
        centered
        styles={{
          title: {
            paddingBottom: "12px",
          },
          body: {
            padding: "0",
          },
        }}
      >
        {selectedLeadForRemark?.remark?.messages &&
        selectedLeadForRemark.remark.messages &&
        selectedLeadForRemark.remark.messages.length > 0 ? (
          <Box>
            {/* Conversation Messages */}
            <ScrollArea style={{ maxHeight: "60vh", overflow: "auto" }}>
              <Stack gap="xs" p="md" style={{ backgroundColor: "#f8f9fa" }}>
                {selectedLeadForRemark?.remark?.messages?.map((msg, index) => {
                  const isSentByMe =
                    msg.sender === user?.full_name ||
                    msg.sender === user?.username ||
                    msg.sender_id === user?.user_id;
                  const prevMessage = index > 0 && selectedLeadForRemark?.remark?.messages ? selectedLeadForRemark.remark.messages[index - 1] : null;
                  const showSenderHeader =
                    !prevMessage || prevMessage.sender !== msg.sender;
                  const showDateSeparator =
                    !prevMessage ||
                    dayjs(msg.timestamp).format("DD-MM-YYYY") !==
                      dayjs(prevMessage.timestamp).format("DD-MM-YYYY");

                  return (
                    <Box key={index} px={4}>
                      {/* Date Separator */}
                      {showDateSeparator && (
                        <Group justify="center" my="md">
                          <Badge
                            size="sm"
                            variant="light"
                            color="gray"
                            style={{ textTransform: "none" }}
                          >
                            {dayjs(msg.timestamp).format("DD MMMM YYYY")}
                          </Badge>
                        </Group>
                      )}

                      {/* Message Bubble */}
                      <Group
                        align="flex-start"
                        gap="xs"
                        style={{
                          flexDirection: isSentByMe ? "row-reverse" : "row",
                        }}
                      >
                        <Box
                          style={{
                            maxWidth: "75%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isSentByMe ? "flex-end" : "flex-start",
                          }}
                        >
                          {/* Sender Name */}
                          {showSenderHeader && (
                            <Text
                              size="xs"
                              fw={600}
                              c="#105476"
                              mb={4}
                              style={{
                                paddingLeft: isSentByMe ? "0" : "8px",
                                paddingRight: isSentByMe ? "8px" : "0",
                                fontFamily: "Inter",
                              }}
                            >
                              {msg.sender}
                            </Text>
                          )}

                          {/* Message Bubble */}
                          <Box
                            style={{
                              backgroundColor: isSentByMe ? "#105476" : "#ffffff",
                              color: isSentByMe ? "#ffffff" : "#333",
                              padding: "10px 14px",
                              borderRadius: isSentByMe
                                ? "12px 12px 4px 12px"
                                : "12px 12px 12px 4px",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                              border: isSentByMe
                                ? "none"
                                : "1px solid #e9ecef",
                            }}
                          >
                            <Text
                              size="sm"
                              style={{
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                lineHeight: 1.5,
                                color: isSentByMe ? "#ffffff" : "#333",
                                fontFamily: "Inter",
                              }}
                            >
                              {msg.message}
                            </Text>
                          </Box>

                          {/* Timestamp */}
                          <Text
                            size="xs"
                            c="dimmed"
                            mt={4}
                            style={{
                              paddingLeft: isSentByMe ? "0" : "8px",
                              paddingRight: isSentByMe ? "8px" : "0",
                              fontFamily: "Inter",
                            }}
                          >
                            {dayjs(msg.timestamp).format("HH:mm")}
                          </Text>
                        </Box>
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            </ScrollArea>


            {/* Footer */}
            <Box
              p="md"
              style={{
                borderTop: "1px solid #e9ecef",
                backgroundColor: "#ffffff",
              }}
            >
              <Group justify="flex-end">
                <Button
                  variant="outline"
                  onClick={closeRemarkModal}
                  color="#105476"
                  size="sm"
                >
                  Close
                </Button>
              </Group>
            </Box>
          </Box>
        ) : (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed" size="sm">
                No conversation available
              </Text>
              <Button
                variant="outline"
                onClick={closeRemarkModal}
                color="#105476"
                size="sm"
              >
                Close
              </Button>
            </Stack>
          </Center>
        )}
      </Modal>
    </>
  );
}

export default LeadList;
