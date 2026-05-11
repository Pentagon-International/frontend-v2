import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Button,
  Group,
  Text,
  ActionIcon,
  Menu,
  Modal,
  Divider,
  Badge,
  Table,
  Box,
  Stack,
  Grid,
  MantineProvider,
  Select,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconCirclePlus,
  IconPackage,
  IconStack2,
  IconCircleCheck,
  IconClock,
  IconCircleX,
  IconScale,
  IconSearch,
  IconX,
  IconFilter,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { postAPICall } from "../../service/postApiCall";
import { useListFilterStore } from "../../store/listFilterStore";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import {
  ToastNotification,
  SearchableSelect,
  SingleDateInput,
  BookingMasterListTable,
  DEFAULT_BOOKING_MASTER_VISIBLE_COLUMNS,
  getBookingRowPW,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistRootTypography,
  erpListGeistMenuDropdownStyles,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  erpToolbarSelectStyles,
  type BookingMasterTableRowModel,
  type BookingMasterVisibleColumns,
} from "../../components";
import FormTextInput from "../../components/FormTextInput";
import { ERP_LIST_GEIST_MONO_CLASS } from "../../components/ERPListPage";
import dayjs from "dayjs";
import { getBookingShipmentFilterListTotal } from "../../utils/bookingShipmentFilterListTotal";

const I2E_FILTER_UNIFIED_STYLES = {
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

type ImportToExportBookingData = {
  id: number;
  sno?: number;
  shipment_code: string;
  enquiry_id?: string | null;
  service_type?: string;
  import_to_export?: boolean;
  reference?: unknown;
  date: string;
  service: string;
  customer_name: string;
  customer_code?: string;
  customer_code_read?: string;
  origin_name: string;
  origin_code?: string;
  origin_code_read?: string;
  destination_name: string;
  destination_code?: string;
  destination_code_read?: string;
  customer_service_name: string;
  status?: string;
  freight?: string;
  routed?: string;
  routed_by?: string;
  shipment_terms_name?: string;
  shipment_terms_code_read?: string;
  carrier_name?: string;
  carrier_code?: string | null;
  eta?: string;
  etd?: string;
  ata?: string | null;
  atd?: string | null;
  actual_pickup_date?: string | null;
  actual_delivery_date?: string | null;
  vessel_name?: string;
  voyage_no?: string;
  mawb_no?: string | null;
  carrier_booking_no?: string | null;
  shipper_name?: string;
  consignee_name?: string;
  forwarder_name?: string;
  destination_agent_name?: string;
  billing_customer_name?: string;
  notify_customer_name?: string;
  notify1_customer_name?: string;
  notify2_customer_name?: string;
  cha_name?: string;
  cha?: string;
  is_hazardous?: boolean;
  commodity_description?: string | null;
  marks_no?: string | null;
  houseno?: string | null;
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
  events?: Array<Record<string, unknown>>;
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
  cargo_details?: Array<{
    id: number;
    container_type_name: string;
    no_of_containers: number;
    no_of_packages?: number;
    gross_weight: string;
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
};

/** `summary` on `customerServiceShipmentFilter` (totals are filter-scoped). */
type ImportToExportListSummary = {
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

type ImportToExportListQueryResult = {
  data: ImportToExportBookingData[];
  total: number;
  summary?: ImportToExportListSummary;
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
};

const LIST_KEY = "OCEAN_IMPORT_TO_EXPORT_BOOKING";

type PersistedI2EFilters = {
  statusFilter: string;
  booking_id: string | null;
  enquiry_id: string | null;
  customer: string | null;
  service: string | null;
  origin: string | null;
  destination: string | null;
  date: string | null;
  filtersApplied: boolean;
  showFilters: boolean;
  pageIndex: number;
  pageSize: number;
};

function oceanI2ERowToTableModel(
  r: ImportToExportBookingData,
  index: number,
  pageIndex: number,
  pageSize: number,
): BookingMasterTableRowModel<ImportToExportBookingData> {
  const pw = getBookingRowPW(r.cargo_details);
  const mawb =
    (r.mawb_no && String(r.mawb_no).trim()) ||
    (r.carrier_booking_no && String(r.carrier_booking_no).trim()) ||
    "";
  const flight =
    (r.voyage_no && r.voyage_no.trim()) ||
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
    houseno: r.houseno ?? "",
    date: r.date,
    customer_name: r.customer_name,
    originCode: r.origin_code_read || r.origin_code || "",
    destCode: r.destination_code_read || r.destination_code || "",
    service: r.service,
    status: r.status,
    mawb,
    flight,
    pieces: pw.pieces,
    weight: pw.weight,
    customer_service_name: r.customer_service_name,
  };
}

function normalizeI2EListMilestonesFromApi(
  r: ImportToExportBookingData,
): ImportToExportBookingData {
  return {
    ...r,
    last_milestone: r.last_milestone ?? null,
    last_milestone_date: r.last_milestone_date ?? null,
    last_milestone_time: r.last_milestone_time ?? null,
    route_milestones: Array.isArray(r.route_milestones) ? r.route_milestones : undefined,
  };
}

function OceanImportToExportBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const theme = DEFAULT_ERP_LIST_THEME;
  const { muted, fg, primary, headerBg, fontSans, border } = theme;

  const getStoreState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const setStoreDisplayValues = useListFilterStore((s) => s.setDisplayValues);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const oceanTransportParams = useMemo(() => ({ transport_mode: "OCEAN" }), []);

  const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<ImportToExportBookingData | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<BookingMasterVisibleColumns>({
    ...DEFAULT_BOOKING_MASTER_VISIBLE_COLUMNS,
    service: true,
  });
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(null);
  const [originDisplayName, setOriginDisplayName] = useState<string | null>(null);
  const [destinationDisplayName, setDestinationDisplayName] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const filterForm = useForm<FilterState>({
    initialValues: {
      booking_id: null,
      enquiry_id: null,
      customer: null,
      service: null,
      origin: null,
      destination: null,
      date: null,
    },
  });

  // Restore filters/search/page from the global store on navigation back.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const stored = getStoreState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (stored?.filters && typeof stored.filters === "object") {
      const f = stored.filters as PersistedI2EFilters;
      if (typeof f.statusFilter === "string") setStatusFilter(f.statusFilter);
      if (typeof f.pageIndex === "number" && f.pageIndex >= 0) setPageIndex(f.pageIndex);
      if (typeof f.pageSize === "number" && f.pageSize > 0) setPageSize(f.pageSize);
      setShowFilters(Boolean(f.showFilters));
      setFiltersApplied(Boolean(f.filtersApplied));
      filterForm.setValues({
        booking_id: f.booking_id ?? null,
        enquiry_id: f.enquiry_id ?? null,
        customer: f.customer ?? null,
        service: f.service ?? null,
        origin: f.origin ?? null,
        destination: f.destination ?? null,
        date: f.date ? dayjs(f.date, "YYYY-MM-DD").toDate() : null,
      });
    }

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }

    const dv = stored?.displayValues;
    if (dv) {
      setCustomerDisplayName(dv.customer ?? null);
      setOriginDisplayName(dv.origin ?? null);
      setDestinationDisplayName(dv.destination ?? null);
    }

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const buildFilterPayload = () => {
    const values = filterForm.values;
    const payload: Record<string, string> = {};
    if (values.booking_id?.trim()) payload.shipment_code = values.booking_id.trim();
    if (values.enquiry_id?.trim()) payload.enquiry_id = values.enquiry_id.trim();
    if (values.customer) payload.customer_code = values.customer;
    if (values.origin) payload.origin_code = values.origin;
    if (values.destination) payload.destination_code = values.destination;
    if (values.date) payload.date = dayjs(values.date).format("YYYY-MM-DD");
    return payload;
  };

  const buildRequestFilters = (searchValue: string): Record<string, unknown> => {
    const extra: Record<string, unknown> = {};
    if (filtersApplied) Object.assign(extra, buildFilterPayload());
    const trimmed = searchValue.trim();
    if (trimmed) extra.search = trimmed;
    return extra;
  };

  const { data: listResponse, isLoading, isFetching, isError } =
    useQuery<ImportToExportListQueryResult>({
      queryKey: [
        "ocean-import-to-export-bookings",
        statusFilter,
        pageIndex,
        pageSize,
        filtersApplied,
        filtersApplied ? JSON.stringify(filterForm.values) : "-",
        debouncedSearch,
      ],
      enabled: !isRestoring && search === debouncedSearch,
      queryFn: async (): Promise<ImportToExportListQueryResult> => {
        try {
          const offset = pageIndex * pageSize;
          const extra = buildRequestFilters(debouncedSearch);
          // When the user picks FCL/LCL from the filters drawer we narrow the
          // service array; otherwise we send both so all ocean bookings load.
          const service = filterForm.values.service
            ? filterForm.values.service
            : ["FCL", "LCL"];
          const payload = {
            filters: {
              import_to_export: true,
              service,
              reference: statusFilter === "completed",
              ...extra,
            },
          };
          const response = (await postAPICall(
            `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`,
            payload,
            API_HEADER,
          )) as Record<string, unknown>;

          let list: ImportToExportBookingData[] = [];
          if (Array.isArray(response.data)) {
            list = (response.data as ImportToExportBookingData[]).map(
              normalizeI2EListMilestonesFromApi,
            );
          }

          const listTotal = getBookingShipmentFilterListTotal(response, list, offset);
          const rawSummary = response.summary;
          const summary: ImportToExportListSummary | undefined =
            rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
              ? (rawSummary as ImportToExportListSummary)
              : undefined;
          const summaryTotal = summary?.total_shipments;
          const total =
            typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
              ? summaryTotal
              : listTotal;
          setTotalRecords(total);

          const countRaw = response.count;
          const count =
            typeof countRaw === "number" && !Number.isNaN(countRaw)
              ? countRaw
              : list.length;
          const totalPaginationRaw = response.total_pagination;
          const totalPagination =
            typeof totalPaginationRaw === "number" && !Number.isNaN(totalPaginationRaw)
              ? totalPaginationRaw
              : 0;

          return {
            data: list,
            total,
            summary,
            count,
            index: (response.index as number) ?? pageIndex,
            limit: (response.limit as number) ?? pageSize,
            total_pagination: totalPagination,
          };
        } catch (err) {
          console.error("Error fetching ocean import-to-export bookings:", err);
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
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    });

  const displayData: ImportToExportBookingData[] = listResponse?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const maxPageIndex = totalPages - 1;
    if (pageIndex > maxPageIndex) {
      setPageIndex(maxPageIndex);
    }
  }, [totalRecords, pageSize, pageIndex]);

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

  // Toast feedback once the filter request completes.
  useEffect(() => {
    if (!isApplyingFilters) return;
    if (isFetching) return;
    setIsApplyingFilters(false);
    if (isError) {
      ToastNotification({ type: "error", message: "Error applying filters" });
      return;
    }
    ToastNotification({ type: "success", message: "Filters applied successfully" });
  }, [isApplyingFilters, isFetching, isError]);

  const tableRowModels = useMemo(
    () => displayData.map((r, i) => oceanI2ERowToTableModel(r, i, pageIndex, pageSize)),
    [displayData, pageIndex, pageSize],
  );

  const listSummary = listResponse?.summary;
  const stats = useMemo(() => {
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

    if (listSummary) {
      const fallback = fromRows();
      return {
        total: listSummary.total_shipments ?? totalRecords,
        booked: listSummary.status_counts?.booked ?? 0,
        received: listSummary.status_counts?.received ?? 0,
        generated: listSummary.status_counts?.generated ?? 0,
        canceled: listSummary.status_counts?.cancel ?? 0,
        totalPieces: listSummary.totals?.pcs ?? fallback.totalPieces,
        totalWeight: listSummary.totals?.weight_kg ?? fallback.totalWeight,
      };
    }

    const st = (s: string | undefined) => (s || "").toUpperCase();
    const { totalPieces, totalWeight } = fromRows();
    return {
      total: totalRecords,
      booked: rows.filter((r) => st(r.status) === "BOOKED").length,
      received: rows.filter((r) => st(r.status) === "RECEIVED").length,
      generated: rows.filter((r) => st(r.status) === "GENERATED").length,
      canceled: rows.filter((r) =>
        st(r.status) === "CANCEL" || st(r.status) === "CANCELED" || st(r.status) === "CANCELLED"
      ).length,
      totalPieces,
      totalWeight,
    };
  }, [displayData, listSummary, totalRecords]);

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof BookingMasterVisibleColumns)[]).map((key) => ({
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

  const persistListState = useCallback(() => {
    const persisted: PersistedI2EFilters = {
      statusFilter,
      booking_id: filterForm.values.booking_id,
      enquiry_id: filterForm.values.enquiry_id,
      customer: filterForm.values.customer,
      service: filterForm.values.service,
      origin: filterForm.values.origin,
      destination: filterForm.values.destination,
      date: filterForm.values.date
        ? dayjs(filterForm.values.date).format("YYYY-MM-DD")
        : null,
      filtersApplied,
      showFilters,
      pageIndex,
      pageSize,
    };
    setStoreFilters(LIST_KEY, persisted);
    setStoreDisplayValues(LIST_KEY, {
      customer: customerDisplayName,
      origin: originDisplayName,
      destination: destinationDisplayName,
    });
    setStoreSearch(LIST_KEY, search);
    setShouldRestore(LIST_KEY, true);
  }, [
    statusFilter,
    filterForm.values,
    filtersApplied,
    showFilters,
    pageIndex,
    pageSize,
    customerDisplayName,
    originDisplayName,
    destinationDisplayName,
    search,
    setStoreFilters,
    setStoreDisplayValues,
    setStoreSearch,
    setShouldRestore,
  ]);

  const handlePageSizeChange = (size: number) => {
    setPageIndex(0);
    setPageSize(size);
  };

  const applyFilters = () => {
    const values = filterForm.values;
    const hasFilterValues =
      (values.booking_id && values.booking_id.trim()) ||
      (values.enquiry_id && values.enquiry_id.trim()) ||
      values.customer ||
      values.service ||
      values.origin ||
      values.destination ||
      values.date;

    if (!hasFilterValues) {
      setFiltersApplied(false);
      setPageIndex(0);
      setShowFilters(false);
      ToastNotification({ type: "info", message: "No filters selected, showing all data" });
      return;
    }

    setPageIndex(0);
    setFiltersApplied(true);
    setIsApplyingFilters(true);
    const persisted: PersistedI2EFilters = {
      statusFilter,
      booking_id: values.booking_id,
      enquiry_id: values.enquiry_id,
      customer: values.customer,
      service: values.service,
      origin: values.origin,
      destination: values.destination,
      date: values.date ? dayjs(values.date).format("YYYY-MM-DD") : null,
      filtersApplied: true,
      showFilters: false,
      pageIndex: 0,
      pageSize,
    };
    setStoreFilters(LIST_KEY, persisted);
    setStoreDisplayValues(LIST_KEY, {
      customer: customerDisplayName,
      origin: originDisplayName,
      destination: destinationDisplayName,
    });
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = async () => {
    try {
      setShowFilters(false);
      const values = filterForm.values;
      const hasFilterValues =
        (values.booking_id && values.booking_id.trim()) ||
        (values.enquiry_id && values.enquiry_id.trim()) ||
        values.customer ||
        values.service ||
        values.origin ||
        values.destination ||
        values.date;
      if (!hasFilterValues) {
        setFiltersApplied(false);
        setPageIndex(0);
        ToastNotification({ type: "info", message: "No filters selected, showing all data" });
        return;
      }
      filterForm.reset();
      setFiltersApplied(false);
      setSearch("");
      setPageIndex(0);
      setCustomerDisplayName(null);
      setOriginDisplayName(null);
      setDestinationDisplayName(null);
      clearAllStore(LIST_KEY);
      await queryClient.invalidateQueries({
        queryKey: ["ocean-import-to-export-bookings"],
      });
      ToastNotification({ type: "success", message: "All filters cleared successfully" });
    } catch (e) {
      console.error("Error clearing filters:", e);
      setShowFilters(false);
    }
  };

  const handleConfirmCreateExport = async () => {
    if (!selectedBooking) return;
    try {
      const payload = {
        service_type: "EXPORT",
        import_to_export: false,
        reference: selectedBooking.id || "",
      };

      setConfirmModalOpened(false);
      setSelectedBooking(null);

      await postAPICall(URL.customerServiceShipment, payload, API_HEADER);

      ToastNotification({
        message: "Export booking created successfully from import booking!",
        type: "success",
      });

      await queryClient.invalidateQueries({
        queryKey: ["ocean-import-to-export-bookings"],
      });

      // Preserve list state so this page restores when the user comes back.
      persistListState();

      navigate("/SeaExport/export-booking", {
        state: { refreshData: true },
      });
    } catch {
      ToastNotification({
        message: "Failed to create export shipment. Please try again.",
        type: "error",
      });
    }
  };

  const isDataLoading = isRestoring || isLoading || isFetching;

  const renderRowActions = useCallback(
    (row: ImportToExportBookingData) => {
      if (statusFilter !== "pending") return null;
      return (
        <Menu withinPortal position="bottom-end" shadow="md" width={220} closeOnItemClick>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconCirclePlus size={14} color={primary} />}
              onClick={() => {
                setSelectedBooking(row);
                setConfirmModalOpened(true);
              }}
            >
              Create Export Booking
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      );
    },
    [statusFilter, primary],
  );

  return (
    <>
      <Modal
        opened={confirmModalOpened}
        onClose={() => setConfirmModalOpened(false)}
        title={
          <Text fw={600} size="lg" c={primary} style={{ fontFamily: fontSans }}>
            Confirm to Create Export Shipment
          </Text>
        }
        size="xl"
        centered
        radius="md"
        zIndex={400}
        classNames={{
          content: ERP_LIST_GEIST_ROOT_CLASS,
          body: ERP_LIST_GEIST_ROOT_CLASS,
          header: ERP_LIST_GEIST_ROOT_CLASS,
        }}
        styles={{
          header: {
            fontFamily: fontSans,
            backgroundColor: headerBg,
            borderBottom: `2px solid ${primary}`,
            paddingBottom: "12px",
          },
          body: {
            fontFamily: fontSans,
            padding: "24px",
          },
        }}
      >
        {selectedBooking && (
          <Stack gap="lg">
            {/* Basic Information */}
            <Box>
              <Text size="sm" fw={600} c="#105476" mb="xs">
                Shipment Information
              </Text>
              <Divider mb="sm" />
              <Grid gutter="xs">
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Booking ID:
                    </Text>
                    <Text
                      size="sm"
                      fw={600}
                      c={primary}
                      className={ERP_LIST_GEIST_MONO_CLASS}
                      style={{ letterSpacing: "0.5px" }}
                    >
                      {selectedBooking.shipment_code}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Date:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.date}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Service:
                    </Text>
                    <Badge variant="filled" color="teal" size="sm">
                      {selectedBooking.service}
                    </Badge>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Customer Service:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.customer_service_name}
                    </Text>
                  </Group>
                </Grid.Col>
              </Grid>
            </Box>

            {/* Customer & Route Information */}
            <Box>
              <Text size="sm" fw={600} c="#105476" mb="xs">
                Customer & Route Details
              </Text>
              <Divider mb="sm" />
              <Grid gutter="xs">
                <Grid.Col span={12}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Customer:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.customer_name}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Origin:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.origin_name}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Destination:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.destination_name}
                    </Text>
                  </Group>
                </Grid.Col>
                {selectedBooking.shipment_terms_name && (
                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" fw={500}>
                        Shipment Terms:
                      </Text>
                      <Text size="xs" fw={500}>
                        {selectedBooking.shipment_terms_name}
                      </Text>
                    </Group>
                  </Grid.Col>
                )}
                {selectedBooking.freight && (
                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" fw={500}>
                        Freight:
                      </Text>
                      <Badge variant="light" color="cyan" size="sm">
                        {selectedBooking.freight}
                      </Badge>
                    </Group>
                  </Grid.Col>
                )}
              </Grid>
            </Box>

            {/* Party Details */}
            {(selectedBooking.shipper_name ||
              selectedBooking.consignee_name ||
              selectedBooking.forwarder_name ||
              selectedBooking.notify_customer_name) && (
              <Box>
                <Text size="sm" fw={600} c="#105476" mb="xs">
                  Party Details
                </Text>
                <Divider mb="sm" />
                <Grid gutter="xs">
                  {selectedBooking.shipper_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Shipper:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.shipper_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.consignee_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Consignee:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.consignee_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.forwarder_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Forwarder:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.forwarder_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.notify_customer_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Notify Party:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.notify_customer_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.billing_customer_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Billing Customer:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.billing_customer_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.cha_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          CHA:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.cha_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                </Grid>
              </Box>
            )}

            {/* Cargo Details */}
            {selectedBooking.cargo_details &&
              selectedBooking.cargo_details.length > 0 && (
                <Box>
                  <Text size="sm" fw={600} c="#105476" mb="xs">
                    Cargo Details
                  </Text>
                  <Divider mb="sm" />
                  <Table
                    striped
                    highlightOnHover
                    withTableBorder
                    withColumnBorders
                    styles={{
                      table: { fontSize: "12px" },
                      th: {
                        backgroundColor: "#f8f9fa",
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#495057",
                      },
                      td: { padding: "6px 8px" },
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Container Type</Table.Th>
                        <Table.Th>No. of Containers</Table.Th>
                        <Table.Th>Gross Weight (kg)</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {selectedBooking.cargo_details.map((cargo, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>{cargo.container_type_name}</Table.Td>
                          <Table.Td>{cargo.no_of_containers}</Table.Td>
                          <Table.Td>{cargo.gross_weight}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              )}

            {/* Pickup & Delivery Information */}
            {(selectedBooking.pickup_location ||
              selectedBooking.delivery_location) && (
              <Box>
                <Text size="sm" fw={600} c="#105476" mb="xs">
                  Pickup & Delivery Details
                </Text>
                <Divider mb="sm" />
                <Grid gutter="xs">
                  {selectedBooking.pickup_location && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Pickup Location:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.pickup_location}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.planned_pickup_date && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Planned Pickup:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.planned_pickup_date}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.delivery_location && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Delivery Location:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.delivery_location}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.planned_delivery_date && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Planned Delivery:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.planned_delivery_date}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.transporter_name && (
                    <Grid.Col span={12}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Transporter:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.transporter_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                </Grid>
              </Box>
            )}

            {/* Action Buttons */}
            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => setConfirmModalOpened(false)}
              >
                Cancel
              </Button>
              <Button
                variant="filled"
                color="#105476"
                onClick={handleConfirmCreateExport}
              >
                Confirm & Create Export
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <MantineProvider theme={erpListGeistMantineTheme}>
        <Box className={ERP_LIST_GEIST_ROOT_CLASS} style={erpListGeistRootTypography}>
          <ERPListScreen
            theme={theme}
            toolbar={{
              leading: (
                <>
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconPackage size={14} color={primary} />}
                    value={stats.total}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconCircleCheck size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={stats.booked}
                    label="Booked"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconPackage size={14} color="#105476" />}
                    iconBackground="#dbeafe"
                    iconColor="#105476"
                    value={stats.received}
                    label="Received"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconClock size={14} color="#d97706" />}
                    iconBackground="#fef3c7"
                    iconColor="#d97706"
                    value={stats.generated}
                    label="Generated"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconCircleX size={14} color="#dc2626" />}
                    iconBackground="#fee2e2"
                    iconColor="#dc2626"
                    value={stats.canceled}
                    label="Canceled"
                  />
                </>
              ),
              secondary: (
                <>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconStack2 size={16} color={muted} style={{ flexShrink: 0 }} />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {stats.totalPieces.toLocaleString()}
                    </Text>
                    <Text size="xs" c={muted} component="span">
                      pcs
                    </Text>
                  </Group>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconScale size={16} color={muted} style={{ flexShrink: 0 }} />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {stats.totalWeight.toLocaleString(undefined, {
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
                    w={140}
                    value={statusFilter}
                    onChange={(v) => {
                      const next = v === "completed" ? "completed" : "pending";
                      setStatusFilter(next);
                      setPageIndex(0);
                    }}
                    data={[
                      { value: "pending", label: "Pending" },
                      { value: "completed", label: "Completed" },
                    ]}
                    classNames={erpListGeistSelectClassNames}
                    styles={erpToolbarSelectStyles(theme)}
                  />
                  <ERPListColumnToggleMenu
                    theme={theme}
                    items={columnToggleItems}
                    menuStyles={erpListGeistMenuDropdownStyles}
                    classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                  />
                  <FormTextInput
                    placeholder="Search..."
                    leftSection={<IconSearch size={14} />}
                    rightSection={
                      search ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          onClick={() => setSearch("")}
                          aria-label="Clear search"
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      ) : null
                    }
                    w={220}
                    size="xs"
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    styles={{
                      input: {
                        height: 32,
                        minHeight: 32,
                        fontSize: 12,
                        borderColor: border,
                        fontFamily: fontSans,
                      },
                    }}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    leftSection={<IconFilter size={14} />}
                    styles={erpToolbarOutlineButtonStyles(theme)}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    {showFilters ? "Hide filters" : "Filters"}
                  </Button>
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: "Refine import-to-export bookings by reference, customer, service, route, or date",
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={theme}
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
                      styles={I2E_FILTER_UNIFIED_STYLES}
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
                      styles={I2E_FILTER_UNIFIED_STYLES}
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
                      styles={I2E_FILTER_UNIFIED_STYLES}
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
                      value={filterForm.values.service}
                      onChange={(value) =>
                        filterForm.setFieldValue("service", value || null)
                      }
                      classNames={erpListGeistSelectClassNames}
                      styles={I2E_FILTER_UNIFIED_STYLES}
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
                      styles={I2E_FILTER_UNIFIED_STYLES}
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
                      additionalParams={oceanTransportParams}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={I2E_FILTER_UNIFIED_STYLES}
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
                      additionalParams={oceanTransportParams}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={I2E_FILTER_UNIFIED_STYLES}
                    />
                  </Grid.Col>
                </Grid>
              ),
            }}
            table={{
              footer: (
                <ERPListPaginationFooter
                  theme={theme}
                  totalRecords={totalRecords}
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  onPageIndexChange={setPageIndex}
                  onPageSizeChange={handlePageSizeChange}
                  selectClassNames={erpListGeistSelectClassNames}
                  pageSizeOptions={["10", "15", "25", "50"]}
                />
              ),
              children: isDataLoading ? (
                <ERPListTableLoading
                  theme={theme}
                  message="Loading import-to-export bookings…"
                />
              ) : (
                <BookingMasterListTable
                  theme={theme}
                  geistRootClass={ERP_LIST_GEIST_ROOT_CLASS}
                  monoClass={ERP_LIST_GEIST_MONO_CLASS}
                  fontSans={fontSans}
                  rows={tableRowModels}
                  visibleColumns={visibleColumns}
                  showServiceColumn
                  renderActions={renderRowActions}
                  emptyTitle="No bookings to display"
                  emptySubtitle="Try switching between Pending and Completed or adjust your filters"
                />
              ),
            }}
          />
        </Box>
      </MantineProvider>
    </>
  );
}

export default OceanImportToExportBooking;
