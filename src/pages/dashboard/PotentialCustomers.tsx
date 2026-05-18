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
import dayjs from "dayjs";
import { URL } from "../../api/serverUrls";
import {
  ToastNotification,
  SingleDateInput,
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_GEIST_ROOT_CLASS,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
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
import SearchableSelect from "../../components/SearchableSelect";
import {
  PotentialCustomersListNativeTable,
  type PotentialCustomerHeaderFilterKey,
  type PotentialCustomerHeaderFilterValues,
  type PotentialCustomerHeaderFiltersProp,
  type PotentialCustomerHeaderRenderInput,
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
import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type CSSProperties,
} from "react";
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

/** Resolve list total for pagination (prefers `total`, then `pagination_total`, then index+page length). */
function getPotentialCustomersListTotal(
  response: PotentialCustomersResponse
): number {
  const anyRes = response as PotentialCustomersResponse & {
    count?: number;
  };
  const raw: unknown =
    anyRes.total ??
    anyRes.pagination_total ??
    anyRes.count;
  let n: number;
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    n = raw;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    const p = Number(raw);
    n = !Number.isNaN(p) ? p : 0;
  } else {
    n = 0;
  }
  const idx = Number(response.index);
  const len = Array.isArray(response.data) ? response.data.length : 0;
  if (
    len > 0 &&
    !Number.isNaN(idx) &&
    idx >= 0 &&
    n < idx + len
  ) {
    n = Math.max(n, idx + len);
  }
  return n;
}

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

/**
 * Filter shape mirrors the keys the backend understands (`customer_code`,
 * `email_id`, `commodity`, `ice`, `pin`, `phone_no`, `contact_person`,
 * `address`, `city`, `state`, `unit`, `sales_person` → `assigned_to`,
 * `created_at`).
 *
 * Empty strings / nulls are NEVER sent to the API (the backend would otherwise
 * turn them into `{key}__isnull=True`), so the payload builder includes a
 * key only when its value is truthy.
 *
 * The `customer_code` payload key is populated via the customer-master
 * `SearchableSelect`. The friendly label is tracked separately via
 * `customerDisplayValue` (persisted as `displayValues.customer_name`).
 */
type FilterState = {
  customer_code: string | null;
  email_id: string | null;
  commodity: string | null;
  ice: string | null;
  pin: string | null;
  phone_no: string | null;
  contact_person: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  unit: string | null;
  sales_person: string | null;
  /** ISO `YYYY-MM-DD` date string — matches `created_at` (Assigned date) column. */
  created_at: string | null;
};

const LIST_KEY = "POTENTIAL_CUSTOMERS";

/**
 * Stable `classNames` for the `SingleDateInput` used in the `created_at`
 * column header. Module-scope keeps the object reference stable so the
 * renderInput memo isn't churned every render.
 */
const POTENTIAL_HEADER_DATE_INPUT_CLASSNAMES: Record<string, string> = {
  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
};

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
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 1000);
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
      customer_code: null,
      email_id: null,
      commodity: null,
      ice: null,
      pin: null,
      phone_no: null,
      contact_person: null,
      address: null,
      city: null,
      state: null,
      unit: null,
      sales_person: null,
      created_at: null,
    },
  });

  // Friendly label that shadows `filterForm.values.customer_code`. Persisted
  // in the global store so navigating back from a sub-page restores the label
  // even before the customer-master API has been hit.
  const [customerDisplayValue, setCustomerDisplayValue] = useState<
    string | null
  >(null);

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
      
      // Restore filters — accept any of the supported keys (advanced filter
      // section + column header filters share the same shape).
      let hasFilters = false;
      const restoredFilters = restoredState.filters as Partial<FilterState>;
      if (restoredFilters && Object.keys(restoredFilters).length > 0) {
        filterForm.setValues(restoredFilters);
        hasFilters = Boolean(
          restoredFilters.customer_code ||
          restoredFilters.email_id ||
          restoredFilters.commodity ||
          restoredFilters.ice ||
          restoredFilters.pin ||
          restoredFilters.phone_no ||
          restoredFilters.contact_person ||
          restoredFilters.address ||
          restoredFilters.city ||
          restoredFilters.state ||
          restoredFilters.unit ||
          restoredFilters.sales_person ||
          restoredFilters.created_at
        );
      }

      // Rehydrate customer display label so the UI shows the friendly name
      // (e.g. on the column header chip + advanced filter) before the
      // customer-master API has been hit.
      const restoredCustomerLabel =
        restoredState.displayValues?.customer_name;
      if (
        typeof restoredCustomerLabel === "string" &&
        restoredCustomerLabel.trim() !== ""
      ) {
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

  // (Customer options are now fetched on-demand by the customer-master
  // `SearchableSelect` — no separate effect needed.)

  // Fetch potential customers data using useQuery
  const {
    data: potentialCustomersData = [],
    isLoading: potentialCustomersLoading,
    isFetching: potentialCustomersFetching,
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
          setTotalCount(getPotentialCustomersListTotal(response));
          return response.data;
        }

        setTotalCount(0);
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
        setTotalCount(0);
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
    isFetching: filteredPotentialCustomersFetching,
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

        // Add additional filters if they have values. Empty strings / null
        // are intentionally NOT sent — the backend treats those as
        // `{key}__isnull=True` which would silently break the result set.
        const f = filterForm.values;
        if (f.customer_code) baseFilters.customer_code = f.customer_code;
        if (f.email_id) baseFilters.email_id = f.email_id;
        if (f.commodity) baseFilters.commodity = f.commodity;
        if (f.ice) baseFilters.ice = f.ice;
        if (f.pin) baseFilters.pin = f.pin;
        if (f.phone_no) baseFilters.phone_no = f.phone_no;
        if (f.contact_person) baseFilters.contact_person = f.contact_person;
        if (f.address) baseFilters.address = f.address;
        if (f.city) baseFilters.city = f.city;
        if (f.state) baseFilters.state = f.state;
        if (f.unit) baseFilters.unit = f.unit;
        // Only include salesperson filter when statusFilter is "assigned"
        if (statusFilter === "assigned" && f.sales_person) {
          baseFilters.assigned_to = f.sales_person;
        }
        // `created_at` is the single-date filter the backend supports;
        // values are already ISO `YYYY-MM-DD` strings (set by SingleDateInput
        // → `dayjs().format("YYYY-MM-DD")` in the change handlers).
        if (f.created_at) baseFilters.created_at = f.created_at;
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
          setTotalCount(getPotentialCustomersListTotal(response));
          return response.data;
        }

        setTotalCount(0);
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
        setTotalCount(0);
        return [];
      }
    },
    enabled: !!statusFilter && (filtersApplied || debouncedSearch.trim() !== ""),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Keep current page in range when total shrinks (filters, assign, API data)
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalCount, pageSize, currentPage]);

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
      // Check if there are other filters applied (all supported filterable
      // fields — covers both the advanced filter section and column headers).
      const f = filterForm.values;
      const hasOtherFilters =
        f.customer_code ||
        f.email_id ||
        f.commodity ||
        f.ice ||
        f.pin ||
        f.phone_no ||
        f.contact_person ||
        f.address ||
        f.city ||
        f.state ||
        f.unit ||
        f.created_at ||
        (statusFilter === "assigned" && f.sales_person);

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

  // City / state are free-text inputs now — no option fetching needed.

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

  // ── Column header filters ─────────────────────────────────────────────────
  // Strictly non-invasive: the column header filter inputs live on top of the
  // existing `filterForm` state. They DO NOT introduce any new payload
  // structure, client-side filtering, separate React Query, search path, or
  // store keys. A monotonic tick is incremented only when the user edits a
  // header input — a debounced effect (further below) uses that tick to
  // invoke the EXISTING filtered query (via `setFiltersApplied(true)` +
  // `invalidateQueries`), exactly the way the Apply button does today.
  // Advanced filter inputs DO NOT bump this tick, so their existing
  // behaviour (commit-on-Apply) is fully preserved.
  const [headerFilterTick, setHeaderFilterTick] = useState(0);
  const [debouncedHeaderFilterTick] = useDebouncedValue(headerFilterTick, 1000);
  const lastHandledHeaderFilterTickRef = useRef(0);

  const handlePotentialHeaderFilterChange = useCallback(
    (key: PotentialCustomerHeaderFilterKey, value: string) => {
      const next = value || null;
      switch (key) {
        case "customer":
          // Header `customer` column writes to `customer_code` payload key.
          // The free-text fallback path (used only when the user types into
          // the generic input — not the SearchableSelect renderInput) would
          // strip the display label, so clear it to keep state coherent.
          filterForm.setFieldValue("customer_code", next);
          if (!next) {
            setCustomerDisplayValue(null);
            useListFilterStore
              .getState()
              .setDisplayValues(LIST_KEY, { customer_name: null });
          }
          break;
        case "email_id":
          filterForm.setFieldValue("email_id", next);
          break;
        case "commodity":
          filterForm.setFieldValue("commodity", next);
          break;
        case "ice":
          filterForm.setFieldValue("ice", next);
          break;
        case "pin":
          filterForm.setFieldValue("pin", next);
          break;
        case "phone_no":
          filterForm.setFieldValue("phone_no", next);
          break;
        case "contact_person":
          filterForm.setFieldValue("contact_person", next);
          break;
        case "address":
          filterForm.setFieldValue("address", next);
          break;
        case "city":
          filterForm.setFieldValue("city", next);
          break;
        case "state":
          filterForm.setFieldValue("state", next);
          break;
        case "unit":
          filterForm.setFieldValue("unit", next);
          break;
        case "assigned_to":
          // Column header maps to filterForm.sales_person (per spec) — same
          // field the advanced "Sales Person" Select writes to.
          filterForm.setFieldValue("sales_person", next);
          break;
        case "created_at":
          // Date column header — only fires from the generic fallback path
          // (e.g. someone clearing it via the X button); the custom
          // SingleDateInput renderInput handles its own set/format.
          filterForm.setFieldValue("created_at", next);
          break;
      }
      setCurrentPage(1);
      setHeaderFilterTick((t) => t + 1);
    },
    [filterForm],
  );

  const potentialHeaderFilterValues: PotentialCustomerHeaderFilterValues =
    useMemo(
      () => ({
        customer: filterForm.values.customer_code ?? "",
        email_id: filterForm.values.email_id ?? "",
        commodity: filterForm.values.commodity ?? "",
        ice: filterForm.values.ice ?? "",
        pin: filterForm.values.pin ?? "",
        phone_no: filterForm.values.phone_no ?? "",
        contact_person: filterForm.values.contact_person ?? "",
        address: filterForm.values.address ?? "",
        city: filterForm.values.city ?? "",
        state: filterForm.values.state ?? "",
        unit: filterForm.values.unit ?? "",
        assigned_to: filterForm.values.sales_person ?? "",
        created_at: filterForm.values.created_at ?? "",
      }),
      [
        filterForm.values.customer_code,
        filterForm.values.email_id,
        filterForm.values.commodity,
        filterForm.values.ice,
        filterForm.values.pin,
        filterForm.values.phone_no,
        filterForm.values.contact_person,
        filterForm.values.address,
        filterForm.values.city,
        filterForm.values.state,
        filterForm.values.unit,
        filterForm.values.sales_person,
        filterForm.values.created_at,
      ],
    );

  // Function to apply filters manually
  const applyFilters = useCallback(async () => {
    try {
      // Check if there are any actual filter values (excluding search, which
      // is handled separately). Exclude sales_person when statusFilter is
      // "unassigned" — keeps existing UX for the segmented control.
      const f = filterForm.values;
      const hasFilterValues =
        f.customer_code ||
        f.email_id ||
        f.commodity ||
        f.ice ||
        f.pin ||
        f.phone_no ||
        f.contact_person ||
        f.address ||
        f.city ||
        f.state ||
        f.unit ||
        f.created_at ||
        (statusFilter === "assigned" && f.sales_person) ||
        debouncedSearch.trim() !== "";

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setCurrentPage(1); // Reset to first page
        // Clear store when no filters
        clearStoreFilters(LIST_KEY);
        clearStoreSearch(LIST_KEY);
        useListFilterStore
          .getState()
          .setDisplayValues(LIST_KEY, { customer_name: null });
        return;
      }

      // Mark filters as applied and reset to first page
      setFiltersApplied(true);
      setCurrentPage(1);

      // Save filters and search to store
      saveFiltersToStore();
      // Persist the customer display label so the friendly name shows up on
      // restore even before the customer-master API has been re-hit.
      useListFilterStore
        .getState()
        .setDisplayValues(LIST_KEY, { customer_name: customerDisplayValue });

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
      setCustomerDisplayValue(null);
      setSearchQuery(""); // Clear search
      setFiltersApplied(false); // Reset filters applied state
      setCurrentPage(1); // Reset to first page

      // Clear filters and search from store
      clearStoreFilters(LIST_KEY);
      clearStoreSearch(LIST_KEY);
      useListFilterStore
        .getState()
        .setDisplayValues(LIST_KEY, { customer_name: null });

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
      return filteredPotentialCustomersLoading || filteredPotentialCustomersFetching;
    }
    return potentialCustomersLoading || potentialCustomersFetching;
  }, [
    potentialCustomersLoading,
    potentialCustomersFetching,
    filteredPotentialCustomersLoading,
    filteredPotentialCustomersFetching,
    filtersApplied,
    debouncedSearch,
  ]);

  const handleCreateCallEntry = useCallback((row: PotentialCustomerTableRow) => {
    const customerData = row as unknown as PotentialCustomerData;
    useListFilterStore.getState().setShouldRestore(LIST_KEY, true);
    navigate("/call-entry-create", {
      state: {
        returnTo: "/potential-customers",
        fromPotentialCustomer: true,
        statusFilter: "assigned",
        customerCode: customerData.customer_code || customerData.potential_id,
        customerName: customerData.customer,
        customerData,
      },
    });
  }, [navigate]);

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

  // Stable reference — the header-filter `renderInput` memo depends on
  // `erpTheme`, so an inline object literal (new reference every render)
  // would make it recompute every render and cascade into the native table
  // re-rendering needlessly. Same fix we did in EnquiryMaster / RFQMaster.
  const erpTheme = useMemo<ErpListTheme>(
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

  const { border, muted, primary, fontSans, fg } = erpTheme;

  // Stable styles for the SingleDateInput used in the `created_at` column
  // header. Mirrors the same `erpListFilterUnifiedMantineStyles` the
  // advanced filter would have produced.
  const potentialHeaderDateInputStyles = useMemo(
    () =>
      erpListFilterUnifiedMantineStyles(erpTheme) as unknown as Record<
        string,
        CSSProperties & Record<string, unknown>
      >,
    [erpTheme],
  );

  // ── Header column custom inputs ──────────────────────────────────────────
  // Mirrors the advanced filter section so the column header inputs (visible
  // only when a user clicks a header) send the SAME payload shape — e.g.
  // a customer pick from the header sets `filterForm.values.customer_code`,
  // exactly like the advanced filter `SearchableSelect` does, so the API
  // contract stays identical regardless of which surface the user edits from.
  const potentialHeaderRenderInput = useMemo<
    Partial<
      Record<
        PotentialCustomerHeaderFilterKey,
        PotentialCustomerHeaderRenderInput
      >
    >
  >(
    () => ({
      customer: ({ autoFocus, onClose }) => (
        <SearchableSelect
          autoFocus={autoFocus}
          size="xs"
          placeholder="Type customer name"
          apiEndpoint={URL.customer}
          searchFields={["customer_name", "customer_code"]}
          displayFormat={(item: Record<string, unknown>) => ({
            value: String(item.customer_code),
            label: String(item.customer_name),
          })}
          value={filterForm.values.customer_code}
          displayValue={customerDisplayValue}
          dropdownZIndex={1000}
          onChange={(value, selected) => {
            const nextValue = value || null;
            const nextLabel = selected?.label ?? null;
            filterForm.setFieldValue("customer_code", nextValue);
            setCustomerDisplayValue(nextValue ? nextLabel : null);
            // Persist the display label immediately so a navigation away
            // before Apply still rehydrates the friendly name on return.
            useListFilterStore.getState().setDisplayValues(LIST_KEY, {
              customer_name: nextValue ? nextLabel : null,
            });
            setCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (nextValue) onClose();
          }}
          minSearchLength={2}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      // `city` and `state` are now free-text (icontains on backend) — no
      // server-side option fetching. They fall through to the default
      // debounced `HeaderFilterInput` (1000ms) for consistency with the
      // other free-text columns (commodity, email_id, etc.).
      assigned_to: ({ autoFocus, onClose }) => (
        <Select
          autoFocus={autoFocus}
          placeholder={
            salespersonsLoading ? "Loading..." : "Select sales person"
          }
          size="xs"
          data={salespersonOptions}
          value={filterForm.values.sales_person}
          onChange={(value) => {
            filterForm.setFieldValue("sales_person", value || null);
            setCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (value) onClose();
          }}
          searchable
          clearable
          disabled={salespersonsLoading}
          comboboxProps={{ zIndex: 1000 }}
          classNames={erpListGeistSelectClassNames}
          styles={erpListFilterUnifiedMantineStyles(erpTheme)}
        />
      ),
      created_at: ({ onClose }) => (
        <SingleDateInput
          value={
            filterForm.values.created_at
              ? new Date(filterForm.values.created_at)
              : null
          }
          onChange={(d) => {
            const iso = d ? dayjs(d).format("YYYY-MM-DD") : null;
            filterForm.setFieldValue("created_at", iso);
            setCurrentPage(1);
            setHeaderFilterTick((t) => t + 1);
            if (iso) onClose();
          }}
          placeholder="Assigned date"
          size="xs"
          allowDeselection
          classNames={POTENTIAL_HEADER_DATE_INPUT_CLASSNAMES}
          styles={potentialHeaderDateInputStyles}
        />
      ),
      // Remaining text columns (email_id, ice, pin, phone_no, contact_person,
      // address, city, state, unit, commodity) fall back to the default
      // debounced `HeaderFilterInput` (1000ms) — the backend accepts them as
      // plain strings, identical to the advanced filter.
    }),
    [
      filterForm.values.customer_code,
      filterForm.values.sales_person,
      filterForm.values.created_at,
      customerDisplayValue,
      salespersonOptions,
      salespersonsLoading,
      potentialHeaderDateInputStyles,
      erpTheme,
      filterForm,
    ],
  );

  // The collapsed `customer` header label otherwise shows the opaque
  // `customer_code` — render the friendly customer name instead.
  const potentialHeaderDisplayFormatter = useMemo<
    Partial<Record<PotentialCustomerHeaderFilterKey, (value: string) => string>>
  >(
    () => ({
      customer: (raw) => {
        if (!raw) return "";
        return customerDisplayValue ?? raw;
      },
    }),
    [customerDisplayValue],
  );

  const potentialHeaderFiltersProp: PotentialCustomerHeaderFiltersProp = useMemo(
    () => ({
      values: potentialHeaderFilterValues,
      onChange: handlePotentialHeaderFilterChange,
      renderInput: potentialHeaderRenderInput,
      displayFormatter: potentialHeaderDisplayFormatter,
    }),
    [
      potentialHeaderFilterValues,
      handlePotentialHeaderFilterChange,
      potentialHeaderRenderInput,
      potentialHeaderDisplayFormatter,
    ],
  );

  // ── Debounced refetch on header-filter edit ───────────────────────────────
  // When `headerFilterTick` advances (the user picked / typed in a column
  // header), wait for `debouncedHeaderFilterTick` to settle (1000ms) then
  // mark filters as applied, persist to store, and invalidate the EXISTING
  // filtered query — exactly what the Apply button does. We dedupe via
  // `lastHandledHeaderFilterTickRef` so the same tick is never replayed
  // twice (e.g. on a parent re-render).
  useEffect(() => {
    if (debouncedHeaderFilterTick === 0) return;
    if (lastHandledHeaderFilterTickRef.current === debouncedHeaderFilterTick)
      return;
    lastHandledHeaderFilterTickRef.current = debouncedHeaderFilterTick;

    setFiltersApplied(true);
    saveFiltersToStore();
    queryClient.invalidateQueries({
      queryKey: ["filteredPotentialCustomers"],
    });
  }, [debouncedHeaderFilterTick, queryClient, saveFiltersToStore]);

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
                  {/* <ERPListStatPill
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
                  />*/}
                </> 
              ),
              // secondary: (
              //   <Text fw={600} size="sm" c={fg} style={{ fontFamily: fontSans }}>
              //     Potential Customers
              //   </Text>
              // ),
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
              subtitle:
                "Refine by customer, contact, address, commodity, location, unit, salesperson, or assigned date",
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

              {/* Customer Filter — hits customer-master, sends `customer_code` */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
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
                  displayValue={customerDisplayValue}
                  dropdownZIndex={5}
                  onChange={(value, selected) => {
                    const nextValue = value || null;
                    const nextLabel = selected?.label ?? null;
                    filterForm.setFieldValue("customer_code", nextValue);
                    setCustomerDisplayValue(nextValue ? nextLabel : null);
                  }}
                  minSearchLength={2}
                  classNames={erpListGeistSelectClassNames}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* City Filter (free text → backend icontains) */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="City"
                  placeholder="Search city"
                  size="xs"
                  value={filterForm.values.city || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "city",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* State Filter (free text → backend icontains) */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="State"
                  placeholder="Search state"
                  size="xs"
                  value={filterForm.values.state || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "state",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
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

              {/* Email Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Email"
                  placeholder="Search email"
                  size="xs"
                  value={filterForm.values.email_id || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "email_id",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Phone No. Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Phone No."
                  placeholder="Search phone no."
                  size="xs"
                  value={filterForm.values.phone_no || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "phone_no",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Contact Person Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Contact Person"
                  placeholder="Search contact person"
                  size="xs"
                  value={filterForm.values.contact_person || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "contact_person",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Address Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Address"
                  placeholder="Search address"
                  size="xs"
                  value={filterForm.values.address || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "address",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Ice Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Ice"
                  placeholder="Search ice"
                  size="xs"
                  value={filterForm.values.ice || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "ice",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Pin Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Pin"
                  placeholder="Search pin"
                  size="xs"
                  value={filterForm.values.pin || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "pin",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Unit Filter */}
              <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                <Box style={erpListFilterFieldCellStyle}>
                <TextInput
                  label="Unit"
                  placeholder="Search unit"
                  size="xs"
                  value={filterForm.values.unit || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue(
                      "unit",
                      e.currentTarget.value || null,
                    )
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={erpListFilterUnifiedMantineStyles(erpTheme)}
                />
                </Box>
              </Grid.Col>

              {/* Assigned Date Filter (created_at) — only when in assigned mode */}
              {statusFilter === "assigned" && (
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_FIFTHS}>
                  <Box style={erpListFilterFieldCellStyle}>
                  <SingleDateInput
                    label="Assigned Date"
                    placeholder="Select date"
                    size="xs"
                    value={
                      filterForm.values.created_at
                        ? new Date(filterForm.values.created_at)
                        : null
                    }
                    onChange={(d) =>
                      filterForm.setFieldValue(
                        "created_at",
                        d ? dayjs(d).format("YYYY-MM-DD") : null,
                      )
                    }
                    allowDeselection
                    classNames={POTENTIAL_HEADER_DATE_INPUT_CLASSNAMES}
                    styles={potentialHeaderDateInputStyles}
                  />
                  </Box>
                </Grid.Col>
              )}
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
              children: (
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
                    headerFilters={potentialHeaderFiltersProp}
                    loading={tableLoading}
                    loadingMessage="Loading potential customers…"
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
