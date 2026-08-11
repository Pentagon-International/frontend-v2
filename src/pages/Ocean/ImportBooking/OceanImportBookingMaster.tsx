import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  ActionIcon,
  Box,
  Group,
  Button,
  Text,
  Stack,
  Grid,
  Menu,
  Modal,
  Tooltip,
  Select,
  Drawer,
  MantineProvider,
} from "@mantine/core";
import {
  IconFilter,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
  IconSearch,
  IconPackage,
  IconCircleCheck,
  IconClock,
  IconStack2,
  IconScale,
  IconCircleX,
  IconCopy,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "./../../../api/serverUrls";
import {
  SearchableSelect,
  SingleDateInput,
  ToastNotification,
  BookingMasterListTable,
  DEFAULT_BOOKING_MASTER_VISIBLE_COLUMNS,
  getBookingRowPW,
  getBookingRowOceanVolume,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpToolbarOutlineButtonStyles,
  erpToolbarSelectStyles,
  BookingCreateJobLoader,
  LastBookingsList,
  DEFAULT_ERP_LIST_THEME,
  type BookingMasterHeaderRenderers,
  type BookingMasterTableRowModel,
  type BookingMasterVisibleColumns,
  type ErpListTheme,
} from "./../../../components";
import FormTextInput from "../../../components/FormTextInput";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "./../../../api/axios";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import dayjs from "dayjs";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import useDateFormat from "../../../hooks/useDateFormat";
import { createJobFromBooking } from "../../../utils/bookingCreateJob";
import { navigateBookingDuplicate } from "../../../utils/navigateBookingDuplicate";

const LIST_KEY = "OCEAN_IMPORT_BOOKING_MASTER";

const OCEAN_IMPORT_VISIBLE_COLUMNS: BookingMasterVisibleColumns = {
  ...DEFAULT_BOOKING_MASTER_VISIBLE_COLUMNS,
  service: true,
};

const OCEAN_IMPORT_FILTER_UNIFIED_STYLES = {
  label: {
    fontFamily: DEFAULT_ERP_LIST_THEME.fontSans,
    fontSize: 12,
    fontWeight: 500,
    color: DEFAULT_ERP_LIST_THEME.muted,
    lineHeight: 1.25,
    marginBottom: 6,
    display: "block" as const,
    minHeight: 15,
  },
  input: {
    fontFamily: DEFAULT_ERP_LIST_THEME.fontSans,
    fontSize: 12,
    height: 32,
    minHeight: 32,
    borderColor: DEFAULT_ERP_LIST_THEME.border,
  },
  dropdown: {
    fontFamily: DEFAULT_ERP_LIST_THEME.fontSans,
    fontSize: 12,
  },
  option: {
    fontFamily: DEFAULT_ERP_LIST_THEME.fontSans,
    fontSize: 12,
  },
} as const;

// Type definitions
type ImportShipmentData = {
  id: number;
  shipment_code: string;
  enquiry_id?: string | null;
  houseno?: string | null;
  service_type: string;
  import_to_export: boolean;
  reference: string | null;
  date: string;
  service: string;
  customer_name: string;
  customer_code_read: string;
  customer_code?: string;
  origin_name: string;
  origin_code_read: string;
  destination_name: string;
  destination_code_read: string;
  customer_service_name: string;
  job_no?: string | null;
  status?: string;
  freight?: string;
  routed?: string;
  routed_by?: string;
  shipment_terms_name?: string;
  shipment_terms_code_read?: string;
  carrier_code?: string | null;
  carrier_name?: string;
  eta?: string;
  etd?: string;
  vessel_name?: string;
  voyage_no?: string;
  shipper_name?: string;
  consignee_name?: string;
  forwarder_name?: string;
  destination_agent_name?: string;
  billing_customer_name?: string;
  notify_customer_name?: string;
  cha_name?: string;
  is_hazardous?: boolean;
  commodity_description?: string | null;
  marks_no?: string | null;
  pickup_location?: string;
  pickup_from_name?: string;
  planned_pickup_date?: string;
  transporter_name?: string;
  delivery_location?: string;
  delivery_from_name?: string;
  planned_delivery_date?: string;
  created_by_name?: string;
  is_direct?: boolean;
  is_coload?: boolean;
  mawb_no?: string | null;
  carrier_booking_no?: string | null;
  origin_code?: string | null;
  destination_code?: string | null;
  atd?: string | null;
  ata?: string | null;
  actual_pickup_date?: string | null;
  actual_delivery_date?: string | null;
  events?: Array<Record<string, unknown>>;
  sno?: number;
  cargo_details?: Array<{
    id: number;
    container_type_code?: string | null;
    container_type_name: string;
    container_no?: string | null;
    no_of_containers: number;
    no_of_packages?: number;
    gross_weight: string;
    volume?: string | number | null;
    containers?: Array<{
      container_no?: string | null;
    }>;
  }>;
  routing_details?: Array<{
    move_type: string;
    etd: string;
    eta: string;
    flight_no: string;
    status: string;
    from_location_name: string;
    to_location_name: string;
    carrier_name: string;
  }>;
  rate_details?: Array<{
    id: number;
    quotation_no: string;
    charge_name: string;
    pp_cc: string;
    no_of_unit: number;
    sell_amount_total: number | null;
  }>;
  last_milestone?: string | null;
  last_milestone_date?: string | null;
  last_milestone_time?: string | null;
  route_milestones?: Array<{
    code: string;
    label: string;
    date?: string | null;
    time?: string | null;
    active?: boolean;
    note?: string;
    source?: unknown;
  }>;
};

/** Matches `summary` on `customerServiceShipmentFilter` for ocean import (totals are filter-scoped). */
type OceanImportShipmentListSummary = {
  total_shipments?: number;
  status_counts?: {
    booked?: number;
    received?: number;
    generated?: number;
    closed?: number;
    cancel?: number;
    pending?: number;
  };
  totals?: {
    pcs?: number;
    weight_kg?: number;
  };
};

type OceanImportListQueryResult = {
  data: ImportShipmentData[];
  total: number;
  summary?: OceanImportShipmentListSummary;
  count: number;
  index: number;
  limit: number;
  total_pagination: number;
};

type FilterState = {
  booking_id: string | null;
  enquiry_id: string | null;
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: Date | null;
  houseno: string | null;
  customer_service_name: string | null;
  mawb_no: string | null;
};

type PersistedListFilters = {
  booking_id: string | null;
  enquiry_id: string | null;
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: string | null;
  houseno: string | null;
  customer_service_name: string | null;
  mawb_no: string | null;
  filtersApplied: boolean;
  showFilters: boolean;
  pageIndex: number;
};

function oceanImportRowToTableModel(
  r: ImportShipmentData,
  index: number,
  pageIndex: number,
  pageSize: number,
): BookingMasterTableRowModel<ImportShipmentData> {
  const pw = getBookingRowPW(r.cargo_details);
  const mawb =
    (r.mawb_no && String(r.mawb_no).trim()) ||
    (r.carrier_booking_no && String(r.carrier_booking_no).trim()) ||
    "";
  const v = r.voyage_no?.trim();
  const vessel = r.vessel_name?.trim();
  const flight =
    [vessel, v].filter(Boolean).join(" · ") ||
    r.routing_details?.[0]?.flight_no?.trim() ||
    "";
  return {
    raw: r,
    id: r.id,
    sno: typeof r.sno === "number" ? r.sno : pageIndex * pageSize + index + 1,
    milestone: {
      status: r.status,
      events: r.events ?? null,
      actual_delivery_date: r.actual_delivery_date ?? null,
      ata: r.ata ?? null,
      atd: r.atd ?? null,
      etd: r.etd ?? null,
      eta: r.eta ?? null,
      actual_pickup_date: r.actual_pickup_date ?? null,
      mawb_no: r.mawb_no ?? null,
      carrier_booking_no: r.carrier_booking_no ?? null,
      origin_name: r.origin_name,
      origin_code_read: r.origin_code_read,
      origin_code: r.origin_code ?? null,
      destination_name: r.destination_name,
      destination_code_read: r.destination_code_read,
      destination_code: r.destination_code ?? null,
      date: r.date,
      last_milestone: r.last_milestone ?? null,
      last_milestone_date: r.last_milestone_date ?? null,
      last_milestone_time: r.last_milestone_time ?? null,
      route_milestones: r.route_milestones,
    },
    shipment_code: r.shipment_code,
    enquiry_id: r.enquiry_id,
    date: r.date,
    customer_name: r.customer_name,
    originCode: r.origin_code_read || r.origin_code || "",
    destCode: r.destination_code_read || r.destination_code || "",
    service: r.service,
    status: r.status,
    job_no: r.job_no?.trim() ?? "",
    volume: getBookingRowOceanVolume(r.service, r.cargo_details),
    mawb,
    flight,
    pieces: pw.pieces,
    weight: pw.weight,
    customer_service_name: r.customer_service_name,
    houseno: r.houseno?.trim() ?? "",
  };
}

/** Ensure filter API milestone fields are passed through to the list table and drawer. */
function normalizeOceanImportListMilestonesFromApi(
  r: ImportShipmentData,
): ImportShipmentData {
  return {
    ...r,
    last_milestone: r.last_milestone ?? null,
    last_milestone_date: r.last_milestone_date ?? null,
    last_milestone_time: r.last_milestone_time ?? null,
    route_milestones: Array.isArray(r.route_milestones)
      ? r.route_milestones
      : undefined,
  };
}

function OceanImportBookingMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const setStoreDisplayValues = useListFilterStore((s) => s.setDisplayValues);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const dateFormat = useDateFormat();
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  const [isRestoring, setIsRestoring] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Pagination states
  const [pageIndex, setPageIndex] = useState(0); // 0-based index for API
  const [pageSize, setPageSize] = useState(25); // Default page size
  const [totalRecords, setTotalRecords] = useState(0); // Total records from API
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] =
    useState<BookingMasterVisibleColumns>(OCEAN_IMPORT_VISIBLE_COLUMNS);

  // Display name states for filter fields
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null,
  );
  const [originDisplayName, setOriginDisplayName] = useState<string | null>(
    null,
  );
  const [destinationDisplayName, setDestinationDisplayName] = useState<
    string | null
  >(null);

  const [cancelConfirmRow, setCancelConfirmRow] =
    useState<ImportShipmentData | null>(null);
  const [createJobBookingId, setCreateJobBookingId] = useState<number | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDuplicatingBooking, setIsDuplicatingBooking] = useState(false);
  const [duplicateCustomerCode, setDuplicateCustomerCode] = useState<
    string | null
  >(null);
  const [
    lastBookingsDrawerOpened,
    { open: openLastBookingsDrawer, close: closeLastBookingsDrawer },
  ] = useDisclosure(false);

  const openDuplicateForRow = useCallback(
    (row: ImportShipmentData) => {
      const customerCode =
        (row.customer_code_read || row.customer_code || "").trim() || null;
      setDuplicateCustomerCode(customerCode);
      openLastBookingsDrawer();
    },
    [openLastBookingsDrawer],
  );

  const handleCloseLastBookingsDrawer = useCallback(() => {
    closeLastBookingsDrawer();
    setDuplicateCustomerCode(null);
  }, [closeLastBookingsDrawer]);

  const filterForm = useForm<FilterState>({
    initialValues: {
      booking_id: null,
      enquiry_id: null,
      customer: null,
      service: null,
      origin: null,
      destination: null,
      date: null,
      houseno: null,
      customer_service_name: null,
      mawb_no: null,
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 1000);

  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId(id),
    [],
  );
  const collapseHeaderEditor = useCallback(
    (id: string) => setEditingHeaderId((cur) => (cur === id ? null : cur)),
    [],
  );

  // Check if we're on the create or edit route
  const isCreateRoute = location.pathname.endsWith("/create");
  const isEditRoute = location.pathname.endsWith("/edit");
  const showMasterTable = !isCreateRoute && !isEditRoute;

  // Check for refetch parameter in URL
  const searchParams = new URLSearchParams(location.search);
  const shouldRefetch = searchParams.get("refetch") === "true";

  // Effect to handle refetch when coming from successful form submission
  useEffect(() => {
    if (shouldRefetch) {
      queryClient.invalidateQueries({
        queryKey: ["ocean-import-booking/filter/"],
      });

      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("refetch");
      const newSearch = newSearchParams.toString();
      const newPath = newSearch
        ? `${location.pathname}?${newSearch}`
        : location.pathname;

      navigate(newPath, { replace: true });
    }
  }, [
    shouldRefetch,
    queryClient,
    location.search,
    location.pathname,
    navigate,
  ]);

  const buildFilterPayload = () => {
    const values = filterForm.values;
    const payload: Record<string, string> = {};
    if (values.booking_id?.trim())
      payload.shipment_code = values.booking_id.trim();
    if (values.enquiry_id?.trim())
      payload.enquiry_id = values.enquiry_id.trim();
    if (values.customer) payload.customer_code = values.customer;
    if (values.service) payload.service = values.service;
    if (values.origin) payload.origin_code = values.origin;
    if (values.destination) payload.destination_code = values.destination;
    if (values.date) payload.date = dayjs(values.date).format("YYYY-MM-DD");
    if (values.houseno?.trim()) payload.houseno = values.houseno.trim();
    if (values.customer_service_name?.trim())
      payload.customer_service_name = values.customer_service_name.trim();
    if (values.mawb_no?.trim()) payload.masterno = values.mawb_no.trim();
    return payload;
  };

  const buildBookingRequestFilters = (
    searchValue: string,
  ): Record<string, string> => {
    const extra: Record<string, string> = {};
    if (filtersApplied) Object.assign(extra, buildFilterPayload());
    if (statusFilter !== "all") extra.status = statusFilter;
    const trimmed = searchValue.trim();
    if (trimmed) extra.search = trimmed;
    return extra;
  };

  const commitHeaderFilters = useCallback(
    (
      updates: Partial<FilterState>,
      displayUpdates?: {
        customer?: string | null;
        origin?: string | null;
        destination?: string | null;
      },
    ) => {
      const nextValues = { ...filterForm.values, ...updates };
      filterForm.setValues(updates);
      setFiltersApplied(true);
      setPageIndex(0);
      const nextCustomerDisplay =
        displayUpdates && "customer" in displayUpdates
          ? (displayUpdates.customer ?? null)
          : customerDisplayName;
      const nextOriginDisplay =
        displayUpdates && "origin" in displayUpdates
          ? (displayUpdates.origin ?? null)
          : originDisplayName;
      const nextDestinationDisplay =
        displayUpdates && "destination" in displayUpdates
          ? (displayUpdates.destination ?? null)
          : destinationDisplayName;
      if (displayUpdates && "customer" in displayUpdates) {
        setCustomerDisplayName(nextCustomerDisplay);
      }
      if (displayUpdates && "origin" in displayUpdates) {
        setOriginDisplayName(nextOriginDisplay);
      }
      if (displayUpdates && "destination" in displayUpdates) {
        setDestinationDisplayName(nextDestinationDisplay);
      }
      const persisted: PersistedListFilters = {
        booking_id: nextValues.booking_id,
        enquiry_id: nextValues.enquiry_id,
        customer: nextValues.customer,
        service: nextValues.service,
        origin: nextValues.origin,
        destination: nextValues.destination,
        date: nextValues.date
          ? dayjs(nextValues.date).format("YYYY-MM-DD")
          : null,
        houseno: nextValues.houseno,
        customer_service_name: nextValues.customer_service_name,
        mawb_no: nextValues.mawb_no,
        filtersApplied: true,
        showFilters,
        pageIndex: 0,
      };
      setStoreFilters(LIST_KEY, persisted);
      setStoreDisplayValues(LIST_KEY, {
        customer: nextCustomerDisplay,
        origin: nextOriginDisplay,
        destination: nextDestinationDisplay,
      });
    },
    [
      filterForm,
      customerDisplayName,
      originDisplayName,
      destinationDisplayName,
      showFilters,
      setStoreFilters,
      setStoreDisplayValues,
    ],
  );

  const {
    data: importShipmentsResponse,
    isLoading,
    isFetching,
    isError,
    refetch: refetchImportShipments,
  } = useQuery<OceanImportListQueryResult>({
    queryKey: [
      "ocean-import-booking/filter/",
      pageIndex,
      pageSize,
      filtersApplied,
      filtersApplied ? JSON.stringify(filterForm.values) : "-",
      debouncedSearch,
      statusFilter,
    ],
    enabled: !isRestoring && searchQuery === debouncedSearch,
    queryFn: async (): Promise<OceanImportListQueryResult> => {
      try {
        const offset = pageIndex * pageSize;
        const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`;
        const filtersPayload = buildBookingRequestFilters(debouncedSearch);
        const response = (await apiCallProtected.post(url, {
          filters: {
            service_type: "IMPORT",
            service: ["FCL", "LCL"],
            ...filtersPayload,
          },
        })) as Record<string, unknown>;

        if (response && typeof response === "object") {
          let data: ImportShipmentData[] = [];
          if (Array.isArray(response.data)) {
            data = (response.data as ImportShipmentData[]).map(
              normalizeOceanImportListMilestonesFromApi,
            );
          } else if (Array.isArray(response.results)) {
            data = (response.results as ImportShipmentData[]).map(
              normalizeOceanImportListMilestonesFromApi,
            );
          } else if (Array.isArray(response.result)) {
            data = (response.result as ImportShipmentData[]).map(
              normalizeOceanImportListMilestonesFromApi,
            );
          }
          const total = getBookingShipmentFilterListTotal(
            response,
            data,
            offset,
          );
          setTotalRecords(total);
          const countRaw = response.count;
          const count =
            typeof countRaw === "number" && !Number.isNaN(countRaw)
              ? countRaw
              : data.length;
          const totalPaginationRaw = response.total_pagination;
          const totalPagination =
            typeof totalPaginationRaw === "number" &&
            !Number.isNaN(totalPaginationRaw)
              ? totalPaginationRaw
              : 0;
          const rawSummary = response.summary;
          const summary: OceanImportShipmentListSummary | undefined =
            rawSummary &&
            typeof rawSummary === "object" &&
            !Array.isArray(rawSummary)
              ? (rawSummary as OceanImportShipmentListSummary)
              : undefined;
          return {
            data,
            total,
            summary,
            count,
            index: (response.index as number) ?? pageIndex,
            limit: (response.limit as number) ?? pageSize,
            total_pagination: totalPagination,
          };
        }
        setTotalRecords(0);
        return {
          data: [],
          total: 0,
          summary: undefined,
          count: 0,
          index: pageIndex,
          limit: pageSize,
          total_pagination: 0,
        };
      } catch (error) {
        console.error("❌ Error fetching ocean import booking:", error);
        setTotalRecords(0);
        return {
          data: [],
          total: 0,
          summary: undefined,
          count: 0,
          index: pageIndex,
          limit: pageSize,
          total_pagination: 0,
        };
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const maxPageIndex = totalPages - 1;
    if (pageIndex > maxPageIndex) {
      setPageIndex(maxPageIndex);
    }
  }, [totalRecords, pageSize, pageIndex]);

  const displayData = importShipmentsResponse?.data ?? [];

  const tableRowModels = useMemo(
    () =>
      displayData.map((r, i) =>
        oceanImportRowToTableModel(r, i, pageIndex, pageSize),
      ),
    [displayData, pageIndex, pageSize],
  );

  const oceanImportStats = useMemo(() => {
    const rows = displayData;
    const fromRows = () => {
      let totalPieces = 0;
      let totalWeight = 0;
      rows.forEach((r) => {
        const pw = getBookingRowPW(r.cargo_details);
        totalPieces += pw.pieces;
        totalWeight += pw.weight;
      });
      return { totalPieces, totalWeight };
    };

    const summary = importShipmentsResponse?.summary;
    if (summary) {
      const fallback = fromRows();
      return {
        total: summary.total_shipments ?? totalRecords,
        booked: summary.status_counts?.booked ?? 0,
        received: summary.status_counts?.received ?? 0,
        generated: summary.status_counts?.generated ?? 0,
        canceled: summary.status_counts?.cancel ?? 0,
        totalPieces: summary.totals?.pcs ?? fallback.totalPieces,
        totalWeight: summary.totals?.weight_kg ?? fallback.totalWeight,
      };
    }

    const st = (s: string | undefined) => (s || "").toUpperCase();
    const { totalPieces, totalWeight } = fromRows();
    return {
      total: totalRecords,
      booked: rows.filter((r) => st(r.status) === "BOOKED").length,
      received: rows.filter((r) => st(r.status) === "RECEIVED").length,
      generated: rows.filter((r) => st(r.status) === "GENERATED").length,
      canceled: rows.filter(
        (r) =>
          st(r.status) === "CANCEL" ||
          st(r.status) === "CANCELED" ||
          st(r.status) === "CANCELLED",
      ).length,
      totalPieces,
      totalWeight,
    };
  }, [displayData, importShipmentsResponse?.summary, totalRecords]);

  const columnToggleItems = useMemo(
    () =>
      (
        Object.keys(visibleColumns) as (keyof BookingMasterVisibleColumns)[]
      ).map((key) => ({
        id: String(key),
        label: String(key),
        checked: Boolean(visibleColumns[key]),
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
          })),
      })),
    [visibleColumns],
  );

  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }
    const f = stored.filters as PersistedListFilters | undefined;
    if (f && typeof f === "object") {
      filterForm.setValues({
        booking_id: f.booking_id ?? null,
        enquiry_id: f.enquiry_id ?? null,
        customer: f.customer ?? null,
        service: f.service ?? null,
        origin: f.origin ?? null,
        destination: f.destination ?? null,
        date: f.date ? dayjs(f.date, "YYYY-MM-DD").toDate() : null,
        houseno: f.houseno ?? null,
        customer_service_name: f.customer_service_name ?? null,
        mawb_no: f.mawb_no ?? null,
      });
      setFiltersApplied(Boolean(f.filtersApplied));
      setShowFilters(Boolean(f.showFilters));
      setPageIndex(typeof f.pageIndex === "number" ? f.pageIndex : 0);
    }
    const dv = stored.displayValues;
    if (dv) {
      setCustomerDisplayName(dv.customer ?? null);
      setOriginDisplayName(dv.origin ?? null);
      setDestinationDisplayName(dv.destination ?? null);
    }
    if (typeof stored.search === "string") {
      setSearchQuery(stored.search);
    }
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore runs on navigation key
  }, [location.key]);

  const persistListState = useCallback(() => {
    const persisted: PersistedListFilters = {
      booking_id: filterForm.values.booking_id,
      enquiry_id: filterForm.values.enquiry_id,
      customer: filterForm.values.customer,
      service: filterForm.values.service,
      origin: filterForm.values.origin,
      destination: filterForm.values.destination,
      date: filterForm.values.date
        ? dayjs(filterForm.values.date).format("YYYY-MM-DD")
        : null,
      houseno: filterForm.values.houseno,
      customer_service_name: filterForm.values.customer_service_name,
      mawb_no: filterForm.values.mawb_no,
      filtersApplied,
      showFilters,
      pageIndex,
    };
    setStoreFilters(LIST_KEY, persisted);
    setStoreDisplayValues(LIST_KEY, {
      customer: customerDisplayName,
      origin: originDisplayName,
      destination: destinationDisplayName,
    });
    setStoreSearch(LIST_KEY, searchQuery);
    setShouldRestore(LIST_KEY, true);
  }, [
    filterForm.values,
    filtersApplied,
    showFilters,
    pageIndex,
    customerDisplayName,
    originDisplayName,
    destinationDisplayName,
    searchQuery,
    setStoreFilters,
    setStoreDisplayValues,
    setStoreSearch,
    setShouldRestore,
  ]);

  // Create New hidden: bookings must be created from gained quotations
  // const persistListAndNavigate = useCallback(() => {
  //   persistListState();
  //   navigate("./create");
  // }, [persistListState, navigate]);

  const isDataLoading = isRestoring || isLoading || isFetching;

  // Reset to first page whenever the search term changes (after debounce).
  // Skip the initial value (and any restore-driven update) so we don't clobber a restored pageIndex.
  const lastDebouncedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRestoring) return;
    if (lastDebouncedSearchRef.current === null) {
      lastDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (lastDebouncedSearchRef.current === debouncedSearch) return;
    lastDebouncedSearchRef.current = debouncedSearch;
    setPageIndex((prev) => (prev === 0 ? prev : 0));
  }, [debouncedSearch, isRestoring]);

  useEffect(() => {
    if (!isApplyingFilters) return;
    if (isFetching) return;

    setIsApplyingFilters(false);

    if (isError) {
      ToastNotification({
        type: "error",
        message: "Error applying filters",
      });
      return;
    }

    ToastNotification({
      type: "success",
      message: "Filters applied successfully",
    });
  }, [isApplyingFilters, isFetching, isError]);

  // Effect to handle refreshData state from navigation
  useEffect(() => {
    if (location.state?.refreshData) {
      const refreshData = async () => {
        try {
          queryClient.removeQueries({
            queryKey: ["ocean-import-booking/filter/"],
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
          await refetchImportShipments();
          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: ["ocean-import-booking/filter/"],
              type: "active",
            });
          }, 200);
        } catch (error) {
          console.error("Error refreshing ocean import booking data:", error);
        }
      };
      refreshData();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state,
    refetchImportShipments,
    navigate,
    location.pathname,
    queryClient,
  ]);

  // Additional effect to ensure data refresh on component mount
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        await queryClient.refetchQueries({
          queryKey: ["ocean-import-booking/filter/"],
          type: "active",
        });
      } catch (error) {
        console.error("Error refreshing data on mount:", error);
      }
    };
    const timeoutId = setTimeout(refreshOnMount, 100);
    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  const applyFilters = async () => {
    try {
      const formValues = filterForm.values;
      const hasFilterValues =
        (formValues.booking_id && formValues.booking_id.trim() !== "") ||
        (formValues.enquiry_id && formValues.enquiry_id.trim() !== "") ||
        formValues.customer ||
        formValues.service ||
        formValues.origin ||
        formValues.destination ||
        formValues.date ||
        (formValues.houseno?.trim() ?? "") !== "" ||
        (formValues.customer_service_name?.trim() ?? "") !== "" ||
        (formValues.mawb_no?.trim() ?? "") !== "";

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0);
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setPageIndex(0);
      setFiltersApplied(true);
      setIsApplyingFilters(true);

      const persisted: PersistedListFilters = {
        booking_id: formValues.booking_id,
        enquiry_id: formValues.enquiry_id,
        customer: formValues.customer,
        service: formValues.service,
        origin: formValues.origin,
        destination: formValues.destination,
        date: formValues.date
          ? dayjs(formValues.date).format("YYYY-MM-DD")
          : null,
        houseno: formValues.houseno,
        customer_service_name: formValues.customer_service_name,
        mawb_no: formValues.mawb_no,
        filtersApplied: true,
        showFilters: false,
        pageIndex: 0,
      };
      setStoreFilters(LIST_KEY, persisted);
      setStoreDisplayValues(LIST_KEY, {
        customer: customerDisplayName,
        origin: originDisplayName,
        destination: destinationDisplayName,
      });
      setStoreSearch(LIST_KEY, searchQuery);
    } catch (error) {
      ToastNotification({
        type: "error",
        message: "Error applying filters",
      });
      console.error("Error applying filters:", error);
    } finally {
      setShowFilters(false);
    }
  };

  const clearAllFilters = async () => {
    try {
      setShowFilters(false);

      const formValues = filterForm.values;
      const hasFilterValues =
        (formValues.booking_id && formValues.booking_id.trim() !== "") ||
        (formValues.enquiry_id && formValues.enquiry_id.trim() !== "") ||
        formValues.customer ||
        formValues.service ||
        formValues.origin ||
        formValues.destination ||
        formValues.date ||
        (formValues.houseno?.trim() ?? "") !== "" ||
        (formValues.customer_service_name?.trim() ?? "") !== "" ||
        (formValues.mawb_no?.trim() ?? "") !== "";

      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0);
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }
      filterForm.reset();
      setFiltersApplied(false);
      setSearchQuery("");
      setPageIndex(0);
      setCustomerDisplayName(null);
      setOriginDisplayName(null);
      setDestinationDisplayName(null);
      clearAllStore(LIST_KEY);
      await queryClient.invalidateQueries({
        queryKey: ["ocean-import-booking/filter/"],
      });
      ToastNotification({
        type: "success",
        message: "All filters cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing filters:", error);
      setShowFilters(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    setIsCancelling(true);
    try {
      const payload = { ...cancelConfirmRow, status: "CANCEL" };
      await putAPICall(URL.customerServiceShipment, payload, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Booking cancelled successfully",
      });
      setCancelConfirmRow(null);
      queryClient.invalidateQueries({
        queryKey: ["ocean-import-booking/filter/"],
      });
      void refetchImportShipments();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to cancel booking",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCreateJob = async (booking: ImportShipmentData) => {
    await createJobFromBooking(booking as unknown as Record<string, unknown>, {
      navigate,
      mode: "ocean-import",
      onStart: () => setCreateJobBookingId(booking.id),
      onEnd: () => setCreateJobBookingId(null),
      invalidateList: () => {
        queryClient.invalidateQueries({
          queryKey: ["ocean-import-booking/filter/"],
        });
        void refetchImportShipments();
      },
    });
  };

  const renderRowActions = useCallback(
    (row: ImportShipmentData) => {
      const statusUpper = (row.status ?? "").toUpperCase();
      const isCancel = statusUpper === "CANCEL";
      const canCancel = statusUpper !== "GENERATED" && !isCancel;
      const isBooked = statusUpper === "BOOKED";
      return (
        <Menu shadow="md" width={140}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray">
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Tooltip
              label="Edit disabled because booking is cancelled"
              disabled={!isCancel}
            >
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                disabled={isCancel}
                onClick={() => {
                  if (!isCancel) {
                    persistListState();
                    navigate(`./edit`, {
                      state: { job: row },
                    });
                  }
                }}
              >
                Edit
              </Menu.Item>
            </Tooltip>
            <Menu.Item
              leftSection={<IconCopy size={14} />}
              disabled={isDuplicatingBooking}
              onClick={() => openDuplicateForRow(row)}
            >
              Duplicate
            </Menu.Item>
            {isBooked && (
              <Menu.Item
                leftSection={<IconPlus size={14} />}
                disabled={createJobBookingId === row.id}
                onClick={() => void handleCreateJob(row)}
              >
                {createJobBookingId === row.id ? "Creating job…" : "Create Job"}
              </Menu.Item>
            )}
            {canCancel && (
              <Tooltip
                label="This booking already has a job. If required, you can cancel the job."
                disabled={statusUpper !== "GENERATED"}
              >
                <Menu.Item
                  leftSection={<IconX size={14} />}
                  color="red"
                  disabled={!canCancel}
                  onClick={() => {
                    if (canCancel) setCancelConfirmRow(row);
                  }}
                >
                  Cancel
                </Menu.Item>
              </Tooltip>
            )}
          </Menu.Dropdown>
        </Menu>
      );
    },
    [
      navigate,
      persistListState,
      createJobBookingId,
      handleCreateJob,
      isDuplicatingBooking,
      openDuplicateForRow,
    ],
  );

  const border = DEFAULT_ERP_LIST_THEME.border;
  const muted = DEFAULT_ERP_LIST_THEME.muted;
  const fg = DEFAULT_ERP_LIST_THEME.fg;
  const primary = DEFAULT_ERP_LIST_THEME.primary;
  const bg = DEFAULT_ERP_LIST_THEME.headerBg;
  const pageBg = DEFAULT_ERP_LIST_THEME.pageBg;
  const cardBg = DEFAULT_ERP_LIST_THEME.cardBg;

  const erpTheme: ErpListTheme = {
    border,
    muted,
    fg,
    primary,
    headerBg: bg,
    pageBg,
    cardBg,
    fontSans: DEFAULT_ERP_LIST_THEME.fontSans,
  };

  const headerRenderers: BookingMasterHeaderRenderers = useMemo(
    () => ({
      shipment: (
        <ERPListColumnHeaderFilter
          label="Booking ID"
          value={filterForm.values.booking_id ?? ""}
          displayValue={filterForm.values.booking_id ?? ""}
          theme={erpTheme}
          placeholder="Filter Booking ID"
          isEditing={editingHeaderId === "shipment"}
          onStartEdit={() => openHeaderEditor("shipment")}
          onStopEdit={() => collapseHeaderEditor("shipment")}
          onChange={(next) => commitHeaderFilters({ booking_id: next || null })}
        />
      ),
      houseno: (
        <ERPListColumnHeaderFilter
          label="House No"
          value={filterForm.values.houseno ?? ""}
          displayValue={filterForm.values.houseno ?? ""}
          theme={erpTheme}
          placeholder="Filter House No"
          isEditing={editingHeaderId === "houseno"}
          onStartEdit={() => openHeaderEditor("houseno")}
          onStopEdit={() => collapseHeaderEditor("houseno")}
          onChange={(next) => commitHeaderFilters({ houseno: next || null })}
        />
      ),
      customer: (
        <ERPListColumnHeaderFilter
          label="Customer"
          value={filterForm.values.customer ?? ""}
          displayValue={customerDisplayName ?? filterForm.values.customer ?? ""}
          onChange={() => {}}
          theme={erpTheme}
          isEditing={editingHeaderId === "customer"}
          onStartEdit={() => openHeaderEditor("customer")}
          onStopEdit={() => collapseHeaderEditor("customer")}
          renderEditor={({ autoFocus, onClose }) => (
            <SearchableSelect
              autoFocus={autoFocus}
              size="xs"
              apiEndpoint={URL.customer}
              searchFields={["customer_name", "customer_code"]}
              placeholder="Type customer"
              displayFormat={(item: Record<string, unknown>) => ({
                value: String(item.customer_code),
                label: String(item.customer_name),
              })}
              value={filterForm.values.customer}
              displayValue={customerDisplayName}
              onChange={(value, selectedData) => {
                commitHeaderFilters(
                  { customer: value || null },
                  { customer: selectedData?.label ?? null },
                );
                if (value) onClose();
              }}
              minSearchLength={1}
              dropdownZIndex={1000}
              classNames={erpListGeistSelectClassNames}
              styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
            />
          )}
        />
      ),
      date: (
        <ERPListColumnHeaderFilter
          label="Date"
          value={
            filterForm.values.date
              ? dayjs(filterForm.values.date).format("YYYY-MM-DD")
              : ""
          }
          displayValue={
            filterForm.values.date
              ? dayjs(filterForm.values.date).format(dateFormat)
              : ""
          }
          onChange={() => {}}
          theme={erpTheme}
          isEditing={editingHeaderId === "date"}
          onStartEdit={() => openHeaderEditor("date")}
          onStopEdit={() => collapseHeaderEditor("date")}
          renderEditor={({ autoFocus, onClose }) => (
            <SingleDateInput
              key={`date-h-${filterForm.values.date}`}
              size="xs"
              value={filterForm.values.date}
              onChange={(d) => {
                commitHeaderFilters({ date: d });
                if (d) onClose();
              }}
              classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
              styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
              {...(autoFocus ? { autoFocus: true } : {})}
            />
          )}
        />
      ),
      route: (
        <ERPListColumnHeaderFilter
          label="Route"
          value={
            (filterForm.values.origin ?? "") +
            (filterForm.values.destination ?? "")
          }
          displayValue={
            filterForm.values.origin || filterForm.values.destination
              ? `${filterForm.values.origin ?? "—"} → ${filterForm.values.destination ?? "—"}`
              : ""
          }
          onChange={() => {}}
          theme={erpTheme}
          isEditing={editingHeaderId === "route"}
          onStartEdit={() => openHeaderEditor("route")}
          onStopEdit={() => collapseHeaderEditor("route")}
          renderEditor={({ autoFocus }) => (
            <Group gap={4} wrap="nowrap" style={{ width: "100%" }}>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  autoFocus={autoFocus}
                  size="xs"
                  apiEndpoint={URL.portMaster}
                  additionalParams={seaTransportParams}
                  searchFields={["port_code", "port_name"]}
                  placeholder="Origin"
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={filterForm.values.origin}
                  displayValue={originDisplayName}
                  onChange={(value, selectedData) =>
                    commitHeaderFilters(
                      { origin: value || null },
                      { origin: selectedData?.label ?? null },
                    )
                  }
                  minSearchLength={1}
                  dropdownZIndex={1000}
                  classNames={erpListGeistSelectClassNames}
                  styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                />
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  size="xs"
                  apiEndpoint={URL.portMaster}
                  additionalParams={seaTransportParams}
                  searchFields={["port_code", "port_name"]}
                  placeholder="Destination"
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={filterForm.values.destination}
                  displayValue={destinationDisplayName}
                  onChange={(value, selectedData) =>
                    commitHeaderFilters(
                      { destination: value || null },
                      { destination: selectedData?.label ?? null },
                    )
                  }
                  minSearchLength={1}
                  dropdownZIndex={1000}
                  classNames={erpListGeistSelectClassNames}
                  styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                />
              </Box>
            </Group>
          )}
        />
      ),
      service: (
        <ERPListColumnHeaderFilter
          label="Service"
          value={filterForm.values.service ?? ""}
          displayValue={filterForm.values.service ?? ""}
          theme={erpTheme}
          placeholder="All services"
          isEditing={editingHeaderId === "service"}
          onStartEdit={() => openHeaderEditor("service")}
          onStopEdit={() => collapseHeaderEditor("service")}
          onChange={() => {}}
          renderEditor={({ autoFocus, onClose }) => (
            <Select
              size="xs"
              placeholder="All"
              clearable
              data={[
                { value: "FCL", label: "FCL" },
                { value: "LCL", label: "LCL" },
              ]}
              value={filterForm.values.service}
              onChange={(v) => {
                commitHeaderFilters({ service: v ?? null });
                onClose();
              }}
              autoFocus={autoFocus}
              classNames={erpListGeistSelectClassNames}
              styles={erpToolbarSelectStyles(erpTheme)}
            />
          )}
        />
      ),
      mawb: (
        <ERPListColumnHeaderFilter
          label="MAWB"
          value={filterForm.values.mawb_no ?? ""}
          displayValue={filterForm.values.mawb_no ?? ""}
          theme={erpTheme}
          placeholder="Filter MAWB"
          isEditing={editingHeaderId === "mawb"}
          onStartEdit={() => openHeaderEditor("mawb")}
          onStopEdit={() => collapseHeaderEditor("mawb")}
          onChange={(next) => commitHeaderFilters({ mawb_no: next || null })}
        />
      ),
      handler: (
        <ERPListColumnHeaderFilter
          label="Customer Service"
          value={filterForm.values.customer_service_name ?? ""}
          displayValue={filterForm.values.customer_service_name ?? ""}
          theme={erpTheme}
          placeholder="Filter Customer Service"
          isEditing={editingHeaderId === "handler"}
          onStartEdit={() => openHeaderEditor("handler")}
          onStopEdit={() => collapseHeaderEditor("handler")}
          onChange={(next) =>
            commitHeaderFilters({ customer_service_name: next || null })
          }
        />
      ),
    }),
    [
      filterForm.values,
      erpTheme,
      editingHeaderId,
      openHeaderEditor,
      collapseHeaderEditor,
      commitHeaderFilters,
      customerDisplayName,
      originDisplayName,
      destinationDisplayName,
      seaTransportParams,
      dateFormat,
    ],
  );

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={erpListGeistRootTypography}
      >
        {showMasterTable && (
          <ERPListScreen
            theme={erpTheme}
            toolbar={{
              leading: (
                <>
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconPackage size={14} color={primary} />}
                    value={oceanImportStats.total}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCircleCheck size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={oceanImportStats.booked}
                    label="Booked"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconPackage size={14} color="#105476" />}
                    iconBackground="#dbeafe"
                    iconColor="#105476"
                    value={oceanImportStats.received}
                    label="Received"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconClock size={14} color="#d97706" />}
                    iconBackground="#fef3c7"
                    iconColor="#d97706"
                    value={oceanImportStats.generated}
                    label="Generated"
                  />
                  <ERPListStatPill
                    theme={erpTheme}
                    icon={<IconCircleX size={14} color="#dc2626" />}
                    iconBackground="#fee2e2"
                    iconColor="#dc2626"
                    value={oceanImportStats.canceled}
                    label="Canceled"
                  />
                </>
              ),
              secondary: (
                <>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconStack2
                      size={16}
                      color={muted}
                      style={{ flexShrink: 0 }}
                    />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {oceanImportStats.totalPieces.toLocaleString()}
                    </Text>
                    <Text size="xs" c={muted} component="span">
                      pcs
                    </Text>
                  </Group>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconScale
                      size={16}
                      color={muted}
                      style={{ flexShrink: 0 }}
                    />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {oceanImportStats.totalWeight.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </Text>
                    <Text size="xs" c={muted} component="span">
                      kg
                    </Text>
                  </Group>
                </>
              ),
              actions: (
                <>
                  <Select
                    size="xs"
                    w={130}
                    value={statusFilter}
                    onChange={(v) => {
                      setStatusFilter(v || "all");
                      setPageIndex(0);
                    }}
                    data={[
                      { value: "all", label: "All Status" },
                      { value: "BOOKED", label: "Booked" },
                      { value: "RECEIVED", label: "Received" },
                      { value: "GENERATED", label: "Generated" },
                      { value: "CLOSED", label: "Closed" },
                      { value: "CANCEL", label: "Cancelled" },
                    ]}
                    classNames={erpListGeistSelectClassNames}
                    styles={erpToolbarSelectStyles(erpTheme)}
                  />
                  <ERPListColumnToggleMenu
                    theme={erpTheme}
                    items={columnToggleItems}
                    menuStyles={erpListGeistMenuDropdownStyles}
                    classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                  />
                  <FormTextInput
                    placeholder="Search..."
                    leftSection={<IconSearch size={14} />}
                    rightSection={
                      searchQuery ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          onClick={() => setSearchQuery("")}
                          aria-label="Clear search"
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      ) : null
                    }
                    w={220}
                    size="xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    styles={{
                      input: {
                        height: 32,
                        minHeight: 32,
                        fontSize: 12,
                        borderColor: border,
                        fontFamily: erpTheme.fontSans,
                      },
                    }}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    leftSection={<IconFilter size={14} />}
                    styles={erpToolbarOutlineButtonStyles(erpTheme)}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    {showFilters ? "Hide filters" : "Filters"}
                  </Button>
                  {/* Create New hidden: bookings must be created from gained quotations
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                    onClick={persistListAndNavigate}
                  >
                    Create New
                  </Button>
                  */}
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle:
                "Refine ocean import bookings by reference, customer, service, route, or date",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={erpTheme}
                  onClear={clearAllFilters}
                  onApply={applyFilters}
                  applyLoading={isDataLoading}
                  applyDisabled={isDataLoading}
                />
              ),
              children: (
                <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <FormTextInput
                      size="xs"
                      label="Booking ID"
                      placeholder="Enter Booking ID"
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                      value={filterForm.values.booking_id ?? ""}
                      onChange={(e) =>
                        filterForm.setFieldValue(
                          "booking_id",
                          e.currentTarget.value || null,
                        )
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <FormTextInput
                      size="xs"
                      label="Enquiry ID"
                      placeholder="Enter Enquiry ID"
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                      value={filterForm.values.enquiry_id ?? ""}
                      onChange={(e) =>
                        filterForm.setFieldValue(
                          "enquiry_id",
                          e.currentTarget.value || null,
                        )
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <SearchableSelect
                      size="xs"
                      label="Customer"
                      placeholder="Type customer name"
                      apiEndpoint={URL.allCustomers}
                      searchFields={["customer_name", "customer_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.customer_code),
                        label: String(item.customer_name),
                      })}
                      value={filterForm.values.customer}
                      displayValue={customerDisplayName}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("customer", value || "");
                        setCustomerDisplayName(selectedData?.label || null);
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <Select
                      size="xs"
                      label="Service"
                      placeholder="All"
                      clearable
                      data={[
                        { value: "FCL", label: "FCL" },
                        { value: "LCL", label: "LCL" },
                      ]}
                      value={filterForm.values.service ?? null}
                      onChange={(v) =>
                        filterForm.setFieldValue("service", v ?? null)
                      }
                      classNames={erpListGeistSelectClassNames}
                      styles={erpToolbarSelectStyles(erpTheme)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <SingleDateInput
                      key={`date-${filterForm.values.date}`}
                      label="Date"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      value={filterForm.values.date}
                      onChange={(d) => filterForm.setFieldValue("date", d)}
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <SearchableSelect
                      size="xs"
                      label="Origin"
                      placeholder="Type origin code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.origin}
                      displayValue={originDisplayName}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("origin", value || "");
                        setOriginDisplayName(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      className="filter-searchable-select"
                      additionalParams={seaTransportParams}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <SearchableSelect
                      size="xs"
                      label="Destination"
                      placeholder="Type destination code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.destination}
                      displayValue={destinationDisplayName}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("destination", value || "");
                        setDestinationDisplayName(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      className="filter-searchable-select"
                      additionalParams={seaTransportParams}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <FormTextInput
                      size="xs"
                      label="House No"
                      placeholder="Enter House No"
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                      value={filterForm.values.houseno ?? ""}
                      onChange={(e) =>
                        filterForm.setFieldValue(
                          "houseno",
                          e.currentTarget.value || null,
                        )
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <FormTextInput
                      size="xs"
                      label="Customer Service"
                      placeholder="Enter Customer Service"
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                      value={filterForm.values.customer_service_name ?? ""}
                      onChange={(e) =>
                        filterForm.setFieldValue(
                          "customer_service_name",
                          e.currentTarget.value || null,
                        )
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 2 }}>
                    <FormTextInput
                      size="xs"
                      label="MAWB"
                      placeholder="Enter MAWB"
                      styles={OCEAN_IMPORT_FILTER_UNIFIED_STYLES}
                      value={filterForm.values.mawb_no ?? ""}
                      onChange={(e) =>
                        filterForm.setFieldValue(
                          "mawb_no",
                          e.currentTarget.value || null,
                        )
                      }
                    />
                  </Grid.Col>
                </Grid>
              ),
            }}
            table={{
              footer: (
                <ERPListPaginationFooter
                  theme={erpTheme}
                  totalRecords={totalRecords}
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  onPageIndexChange={setPageIndex}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={["10", "15", "25", "50"]}
                  selectClassNames={erpListGeistSelectClassNames}
                />
              ),
              children: (
                <BookingMasterListTable
                  theme={erpTheme}
                  geistRootClass={ERP_LIST_GEIST_ROOT_CLASS}
                  monoClass="air-export-geist-mono"
                  fontSans={erpTheme.fontSans}
                  rows={tableRowModels}
                  visibleColumns={visibleColumns}
                  showServiceColumn
                  renderActions={renderRowActions}
                  headerRenderers={headerRenderers}
                  stickyActions
                  // dateCellFormat={dateFormat}
                  isLoading={isDataLoading}
                  loadingMessage="Loading ocean import bookings..."
                />
              ),
            }}
          />
        )}
        <Modal
          opened={!!cancelConfirmRow}
          onClose={() => !isCancelling && setCancelConfirmRow(null)}
          title="Cancel booking"
          centered
        >
          <Text size="sm" c="dimmed" mb="md">
            Are you sure you want to cancel this booking? This action cannot be
            undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              onClick={() => setCancelConfirmRow(null)}
              disabled={isCancelling}
            >
              No
            </Button>
            <Button
              color="red"
              onClick={handleConfirmCancel}
              loading={isCancelling}
            >
              Yes, cancel
            </Button>
          </Group>
        </Modal>
        <Drawer
          opened={lastBookingsDrawerOpened}
          onClose={handleCloseLastBookingsDrawer}
          position="right"
          size="70%"
          title="Last Bookings"
          titleProps={{ style: { fontWeight: "bold" } }}
        >
          <LastBookingsList
            service={["FCL", "LCL"]}
            serviceType="IMPORT"
            customerCode={duplicateCustomerCode}
            onRowSelect={(row) => {
              const bookingId = row.id as string | number | undefined;
              if (bookingId == null) {
                ToastNotification({
                  type: "error",
                  message: "Selected booking has no id.",
                });
                return;
              }
              handleCloseLastBookingsDrawer();
              void navigateBookingDuplicate({
                bookingId,
                navigate,
                persistListState,
                onStart: () => setIsDuplicatingBooking(true),
                onEnd: () => setIsDuplicatingBooking(false),
              });
            }}
          />
        </Drawer>
        <BookingCreateJobLoader
          active={createJobBookingId != null || isDuplicatingBooking}
          message={
            isDuplicatingBooking
              ? "Preparing duplicate booking…"
              : undefined
          }
        />
        <Outlet />
      </Box>
    </MantineProvider>
  );
}

export default OceanImportBookingMaster;
