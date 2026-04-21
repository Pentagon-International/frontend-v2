import { useMemo, useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Group,
  Flex,
  Button,
  Text,
  Center,
  Loader,
  Stack,
  Grid,
  Menu,
  ActionIcon,
  Box,
  Modal,
  Tooltip,
  Select,
  Checkbox,
  Paper,
  MantineProvider,
  createTheme,
  rem,
} from "@mantine/core";
import {
  IconFilter,
  IconPlus,
  IconDots,
  IconEdit,
  IconX,
  IconDownload,
  IconArrowRight,
  IconSettings,
  IconPackage,
  IconCircleCheck,
  IconClock,
  IconStack2,
  IconScale,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconEye,
  IconFileText,
  IconBriefcase,
  IconCircleX,
  IconSelector,
} from "@tabler/icons-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { SearchableSelect, SingleDateInput, ToastNotification } from "../../../components";
import { useForm } from "@mantine/form";
import { apiCallProtected } from "../../../api/axios";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import dayjs from "dayjs";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";

const LIST_KEY = "AIR_EXPORT_BOOKING_MASTER";

/** Scoped subtree: only Geist / Geist Mono (see `index.css`). */
const AIR_EXPORT_GEIST_ROOT_CLASS = "air-export-booking-geist-root";
const AIR_EXPORT_GEIST_MONO_CLASS = "air-export-geist-mono";

/** Sans + mono: Geist files only; generic `sans-serif` / `monospace` are not additional typefaces. */
const V0_FONT_SANS = "'Geist', sans-serif";
const V0_FONT_MONO = "'Geist Mono', monospace";

const v0RootTypography = {
  fontFamily: V0_FONT_SANS,
  fontSize: 14,
  lineHeight: 1.5,
  WebkitFontSmoothing: "antialiased" as const,
  MozOsxFontSmoothing: "grayscale" as const,
};

const v0ModalStyles = {
  content: { fontFamily: V0_FONT_SANS },
  body: { fontFamily: V0_FONT_SANS, fontSize: 14 },
  header: { fontFamily: V0_FONT_SANS },
  title: { fontFamily: V0_FONT_SANS },
};

const v0ModalClassNames = {
  content: AIR_EXPORT_GEIST_ROOT_CLASS,
  body: AIR_EXPORT_GEIST_ROOT_CLASS,
  inner: AIR_EXPORT_GEIST_ROOT_CLASS,
};

const v0MenuStyles = {
  dropdown: { fontFamily: V0_FONT_SANS, fontSize: 14 },
};

const AIR_EXPORT_FILTER_SELECT_CLASSNAMES = {
  dropdown: AIR_EXPORT_GEIST_ROOT_CLASS,
  option: AIR_EXPORT_GEIST_ROOT_CLASS,
};

const AIR_EXPORT_FILTER_FIELD_FONT_STYLES = {
  input: { fontFamily: V0_FONT_SANS },
  label: { fontFamily: V0_FONT_SANS },
};

/** Mantine theme slice: v0 uses Geist + Tailwind defaults (text-xs 12px, text-sm 14px, text-lg 18px). */
const airExportV0MantineTheme = createTheme({
  fontFamily: V0_FONT_SANS,
  fontFamilyMonospace: V0_FONT_MONO,
  headings: { fontFamily: V0_FONT_SANS },
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },
});

// ---------- Types ----------
type ExportShipmentData = {
  id: number;
  sno: number;
  shipment_code: string;
  enquiry_id?: string | null;
  date: string;
  service: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  customer_service_name: string;
  status?: string;
  destination_agent_code?: string;
  destination_agent_address?: string;
  destination_agent_email?: string;
  destination_agent_name?: string;
  destination_agent_phone?: string;
  notify1_customer_name?: string;
  notify1_customer_address?: string;
  notify1_customer_email?: string;
  cha?: string;
  cha_id?: number | null;
  cha_address?: string;
  shipment_terms_code?: string;
  origin_code?: string;
  destination_code?: string;
  is_hazardous?: boolean;
  customer_code_read?: string;
  origin_code_read?: string;
  destination_code_read?: string;
  etd?: string;
  eta?: string;
  atd?: string;
  ata?: string;
  carrier_code_read?: string;
  voyage_no?: string;
  mawb_no?: string;
  mawb_date?: string;
  carrier_booking_no?: string;
  igm_no?: string;
  igm_date?: string;
  mawb_no?: string;
  routed?: string;
  routed_by?: string;
  agent_name?: string;
  agent_address?: string;
  agent_email?: string;
  shipper_name?: string;
  shipper_address?: string;
  shipper_email?: string;
  consignee_name?: string;
  consignee_address?: string;
  consignee_email?: string;
  notify_customer_name?: string;
  notify_customer_address?: string;
  notify_customer_email?: string;
  shipment_terms_code_read?: string;
  marks_no?: string | null;
  commodity_description?: string | null;
  service_type?: string;
  events?: Array<Record<string, unknown>>;
  routing_details?: Array<Record<string, unknown>>;
  cargo_details?: Array<Record<string, unknown>>;
  rate_details?: Array<Record<string, unknown>>;
  housing_details?: Array<Record<string, unknown>>;
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

type PersistedListFilters = {
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
};

type VisibleColumnsState = {
  sno: boolean;
  shipment: boolean;
  date: boolean;
  customer: boolean;
  route: boolean;
  status: boolean;
  mawb: boolean;
  flight: boolean;
  pieces: boolean;
  weight: boolean;
  handler: boolean;
};

// ---------- Pure helpers ----------
function normalizeBookingStatus(s: string | undefined | null): string {
  const u = (s || "").toUpperCase();
  if (u.includes("CANCEL")) return "CANCEL";
  if (u === "BOOKED") return "BOOKED";
  if (u === "RECEIVED") return "RECEIVED";
  return u || "GENERATED";
}

function getRowPW(row: ExportShipmentData): { pieces: number; weight: number } {
  const cargo = row.cargo_details;
  if (Array.isArray(cargo) && cargo.length > 0) {
    const pieces = cargo.reduce((s, c) => s + Number((c as Record<string, unknown>).no_of_packages ?? 0), 0);
    const weight = cargo.reduce((s, c) => s + Number((c as Record<string, unknown>).gross_weight ?? 0), 0);
    return { pieces, weight };
  }
  return { pieces: 0, weight: 0 };
}

function initials(name: string | undefined | null): string {
  if (!name?.trim()) return "?";
  return name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function firstName(name: string | undefined | null): string {
  if (!name?.trim()) return "—";
  return name.trim().split(/\s+/)[0] ?? "—";
}

// ---------- Sub-components ----------
function StatusPill({ status }: { status: string | undefined | null }) {
  const n = normalizeBookingStatus(status);
  const cfg =
    n === "BOOKED"
      ? { label: "Booked", dot: "#10b981", bg: "#ecfdf5", color: "#047857" }
      : n === "RECEIVED"
        ? { label: "Received", dot: "#3b82f6", bg: "#eff6ff", color: "#1d4ed8" }
        : n === "CANCEL"
          ? { label: "Cancelled", dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c" }
          : { label: "Generated", dot: "#f59e0b", bg: "#fffbeb", color: "#b45309" };

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
      }}
    >
      <Box style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </Box>
  );
}

// ---------- Main Component ----------
function AirExportBookingMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const setStoreDisplayValues = useListFilterStore((s) => s.setDisplayValues);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const airTransportParams = useMemo(() => ({ transport_mode: "AIR" }), []);

  // ---- restore flag ----
  const [isRestoring, setIsRestoring] = useState(true);

  // ---- filter panel ----
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // ---- pagination ----
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [totalRecords, setTotalRecords] = useState(0);

  // ---- display names ----
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(null);
  const [originDisplayName, setOriginDisplayName] = useState<string | null>(null);
  const [destinationDisplayName, setDestinationDisplayName] = useState<string | null>(null);

  // ---- table state ----
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>({
    sno: true,
    shipment: true, date: true, customer: true, route: true, status: true,
    mawb: true, flight: true, pieces: true, weight: true, handler: true,
  });

  // ---- search ----
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 500);

  // ---- cancel modal ----
  const [cancelConfirmRow, setCancelConfirmRow] = useState<ExportShipmentData | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // ---- create job modal ----
  const [createJobLoading, setCreateJobLoading] = useState(false);
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false);
  const [createJobResponse, setCreateJobResponse] = useState<Record<string, unknown> | null>(null);
  const [createJobError, setCreateJobError] = useState<string | null>(null);

  // ---- filter form ----
  const filterForm = useForm<FilterState>({
    initialValues: { booking_id: null, enquiry_id: null, customer: null, service: null, origin: null, destination: null, date: null },
  });

  // ---- route helpers ----
  const isCreateRoute = location.pathname.endsWith("/create");
  const isEditRoute = location.pathname.endsWith("/edit");
  const showMasterTable = !isCreateRoute && !isEditRoute;

  const searchParams = new URLSearchParams(location.search);
  const shouldRefetch = searchParams.get("refetch") === "true";

  // ---- filter payload ----
  const buildFilterPayload = () => {
    const v = filterForm.values;
    const p: Record<string, string> = {};
    if (v.booking_id?.trim()) p.shipment_code = v.booking_id.trim();
    if (v.enquiry_id?.trim()) p.enquiry_id = v.enquiry_id.trim();
    if (v.customer) p.customer_code = v.customer;
    if (v.service) p.service = v.service;
    if (v.origin) p.origin_code = v.origin;
    if (v.destination) p.destination_code = v.destination;
    if (v.date) p.date = dayjs(v.date).format("YYYY-MM-DD");
    return p;
  };

  const buildRequestFilters = (searchValue: string): Record<string, string> => {
    const extra: Record<string, string> = {};
    if (filtersApplied) Object.assign(extra, buildFilterPayload());
    const trimmed = searchValue.trim();
    if (trimmed) extra.search = trimmed;
    if (statusFilter !== "all") extra.status = statusFilter;
    return extra;
  };

  // ---- data query ----
  const {
    data: exportShipmentsResponse,
    isLoading,
    refetch: refetchExportShipments,
  } = useQuery({
    queryKey: ["air-export-booking/filter/", pageIndex, pageSize, filtersApplied,
      filtersApplied ? JSON.stringify(filterForm.values) : "-", debouncedSearch, statusFilter],
    enabled: !isRestoring && searchQuery === debouncedSearch,
    queryFn: async () => {
      try {
        const offset = pageIndex * pageSize;
        const url = `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`;
        const response = (await apiCallProtected.post(url, {
          filters: { service_type: "EXPORT", service: "AIR", ...buildRequestFilters(debouncedSearch) },
        })) as Record<string, unknown>;

        if (response && typeof response === "object") {
          if (typeof response.total === "number") setTotalRecords(response.total);
          let data: ExportShipmentData[] = [];
          if (Array.isArray(response.data)) data = response.data as ExportShipmentData[];
          else if (Array.isArray(response.results)) data = response.results as ExportShipmentData[];
          else if (Array.isArray(response.result)) data = response.result as ExportShipmentData[];
          return { data, total: (response.total as number) || 0 };
        }
        return { data: [], total: 0 };
      } catch {
        return { data: [], total: 0 };
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const displayData = useMemo(() => exportShipmentsResponse?.data ?? [], [exportShipmentsResponse]);

  // ---- derived table data ----
  const tableRows = useMemo(() => {
    const rows = [...displayData];
    if (sortConfig) {
      rows.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        if (sortConfig.key === "shipment") { aVal = a.shipment_code || ""; bVal = b.shipment_code || ""; }
        else if (sortConfig.key === "date") { aVal = a.date || ""; bVal = b.date || ""; }
        else if (sortConfig.key === "customer") { aVal = a.customer_name || ""; bVal = b.customer_name || ""; }
        else if (sortConfig.key === "weight") { aVal = getRowPW(a).weight; bVal = getRowPW(b).weight; }
        if (typeof aVal === "string") {
          return sortConfig.direction === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
        }
        return sortConfig.direction === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
      });
    }
    return rows;
  }, [displayData, sortConfig]);

  const stats = useMemo(() => {
    const rows = displayData;
    let totalPieces = 0;
    let totalWeight = 0;
    rows.forEach((r) => { const pw = getRowPW(r); totalPieces += pw.pieces; totalWeight += pw.weight; });
    return {
      total: totalRecords,
      booked: rows.filter((r) => normalizeBookingStatus(r.status) === "BOOKED").length,
      received: rows.filter((r) => normalizeBookingStatus(r.status) === "RECEIVED").length,
      pending: rows.filter((r) => normalizeBookingStatus(r.status) === "GENERATED").length,
      totalPieces,
      totalWeight,
    };
  }, [displayData, totalRecords]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const pageButtonIndices = useMemo(() => {
    const n = Math.min(5, totalPages);
    return Array.from({ length: n }, (_, i) => {
      if (totalPages <= 5) return i;
      if (pageIndex < 3) return i;
      if (pageIndex > totalPages - 4) return totalPages - 5 + i;
      return pageIndex - 2 + i;
    });
  }, [totalPages, pageIndex]);

  const isDataLoading = isRestoring || isLoading;

  // ---- restore state ----
  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    if (!shouldRestore) { setIsRestoring(false); return; }

    const f = stored.filters as PersistedListFilters | undefined;
    if (f && typeof f === "object") {
      filterForm.setValues({
        booking_id: f.booking_id ?? null, enquiry_id: f.enquiry_id ?? null,
        customer: f.customer ?? null, service: f.service ?? null,
        origin: f.origin ?? null, destination: f.destination ?? null,
        date: f.date ? dayjs(f.date, "YYYY-MM-DD").toDate() : null,
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
    if (typeof stored.search === "string") setSearchQuery(stored.search);
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // ---- persist & navigate ----
  const persistListAndNavigate = useCallback(() => {
    const persisted: PersistedListFilters = {
      booking_id: filterForm.values.booking_id, enquiry_id: filterForm.values.enquiry_id,
      customer: filterForm.values.customer, service: filterForm.values.service,
      origin: filterForm.values.origin, destination: filterForm.values.destination,
      date: filterForm.values.date ? dayjs(filterForm.values.date).format("YYYY-MM-DD") : null,
      filtersApplied, showFilters, pageIndex,
    };
    setStoreFilters(LIST_KEY, persisted);
    setStoreDisplayValues(LIST_KEY, { customer: customerDisplayName, origin: originDisplayName, destination: destinationDisplayName });
    setStoreSearch(LIST_KEY, searchQuery);
    setShouldRestore(LIST_KEY, true);
    navigate("./create");
  }, [filterForm.values, filtersApplied, showFilters, pageIndex, customerDisplayName, originDisplayName, destinationDisplayName, searchQuery, navigate, setStoreFilters, setStoreDisplayValues, setStoreSearch, setShouldRestore]);

  // ---- refetch effects ----
  useEffect(() => {
    if (shouldRefetch) {
      queryClient.invalidateQueries({ queryKey: ["air-export-booking/filter/"] });
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("refetch");
      const newSearch = newSearchParams.toString();
      navigate(newSearch ? `${location.pathname}?${newSearch}` : location.pathname, { replace: true });
    }
  }, [shouldRefetch, queryClient, location.search, location.pathname, navigate]);

  useEffect(() => {
    if (location.state?.refreshData) {
      queryClient.removeQueries({ queryKey: ["air-export-booking/filter/"] });
      setTimeout(() => { void refetchExportShipments(); }, 50);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, refetchExportShipments, navigate, location.pathname, queryClient]);

  useEffect(() => {
    setSelectedIds([]);
  }, [pageIndex, pageSize, statusFilter, debouncedSearch]);

  // ---- handlers ----
  const handleExport = (rows: ExportShipmentData[]) => {
    if (rows.length === 0) { ToastNotification({ type: "info", message: "No rows to export" }); return; }
    const sheetRows = rows.map((r) => {
      const pw = getRowPW(r);
      return {
        Shipment: r.shipment_code, "Enquiry ID": r.enquiry_id ?? "",
        Date: r.date ? dayjs(r.date).format("DD MMM YYYY") : "",
        Customer: r.customer_name ?? "",
        Origin: r.origin_code_read || r.origin_code || "",
        Destination: r.destination_code_read || r.destination_code || "",
        Status: normalizeBookingStatus(r.status),
        MAWB: r.mawb_no ?? "", Flight: r.voyage_no ?? "",
        Pcs: pw.pieces, "Weight kg": pw.weight,
        Handler: r.customer_service_name ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export Bookings");
    XLSX.writeFile(wb, `air_export_bookings_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) return prev.direction === "asc" ? { key, direction: "desc" } : null;
      return { key, direction: "asc" };
    });
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAllOnPage = () => {
    const ids = tableRows.map((r) => r.id);
    if (ids.length > 0 && ids.every((id) => selectedIds.includes(id))) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const applyFilters = () => {
    const v = filterForm.values;
    const hasValues = (v.booking_id?.trim()) || (v.enquiry_id?.trim()) || v.customer || v.service || v.origin || v.destination || v.date;
    if (!hasValues) {
      setFiltersApplied(false);
      setPageIndex(0);
      ToastNotification({ type: "info", message: "No filters selected, showing all data" });
    } else {
      setPageIndex(0);
      setFiltersApplied(true);
      ToastNotification({ type: "success", message: "Filters applied" });
    }
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    filterForm.reset();
    setFiltersApplied(false);
    setSearchQuery("");
    setPageIndex(0);
    setCustomerDisplayName(null);
    setOriginDisplayName(null);
    setDestinationDisplayName(null);
    setShowFilters(false);
    queryClient.invalidateQueries({ queryKey: ["air-export-booking/filter/"] });
    ToastNotification({ type: "success", message: "Filters cleared" });
  };

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    setIsCancelling(true);
    try {
      const payload = { ...cancelConfirmRow, status: "CANCEL" };
      await putAPICall(URL.customerServiceShipment, payload, API_HEADER);
      ToastNotification({ type: "success", message: "Booking cancelled" });
      setCancelConfirmRow(null);
      queryClient.invalidateQueries({ queryKey: ["air-export-booking/filter/"] });
      void refetchExportShipments();
    } catch (err: unknown) {
      ToastNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to cancel" });
    } finally { setIsCancelling(false); }
  };

  const handleCreateJob = async (booking: ExportShipmentData) => {
    const routingDetails = Array.isArray(booking.routing_details) ? booking.routing_details : [];
    const payload: Record<string, unknown> = {
      service: booking.service || "AIR", service_type: booking.service_type || "Export",
      agent: booking.destination_agent_code || "", origin_code: booking.origin_code || "",
      destination_code: booking.destination_code || "", etd: null, eta: null, atd: null, ata: null,
      carrier_code: "", flightno: "", is_direct: false, mawb_no: booking.mawb_no || "",
      mbl_date: null, carrier_booking_no: booking.carrier_booking_no || "",
      voyage_number: booking.voyage_no || "", estimates: [],
      ocean_routings: routingDetails.map((r) => ({
        transport_type: "Air",
        from_port_code: r.from_port_code || "", to_port_code: r.to_port_code || "",
        carrier_code: r.carrier_code || "", flight: r.flight || "",
        rail_no: r.rail_no || "", truck_no: r.truck_no || "",
        voyage_number: r.voyage_number || "", vessel: r.vessel || "",
        etd: r.etd && dayjs(r.etd as string).isValid() ? dayjs(r.etd as string).format("YYYY-MM-DD") : null,
        eta: r.eta && dayjs(r.eta as string).isValid() ? dayjs(r.eta as string).format("YYYY-MM-DD") : null,
        atd: r.atd && dayjs(r.atd as string).isValid() ? dayjs(r.atd as string).format("YYYY-MM-DD") : null,
        ata: r.ata && dayjs(r.ata as string).isValid() ? dayjs(r.ata as string).format("YYYY-MM-DD") : null,
      })),
      housing_details: [{
        hawb_no: booking.mawb_no || "", origin_code: booking.origin_code || "",
        destination_code: booking.destination_code || "", trade: "Re Export",
        routed: booking.routed || "", routed_by: booking.routed_by || "",
        customer_service: booking.customer_service_name || "",
        agent_name: booking.destination_agent_name || "", agent_address: booking.destination_agent_address || "",
        agent_email: booking.destination_agent_email || "",
        shipper_name: booking.shipper_name || "", shipper_address: booking.shipper_address || "",
        shipper_email: booking.shipper_email || "", consignee_name: booking.consignee_name || "",
        consignee_address: booking.consignee_address || "", consignee_email: booking.consignee_email || "",
        notify1_customer_name: booking.notify1_customer_name || "",
        notify1_customer_address: booking.notify1_customer_address || "",
        notify1_customer_email: booking.notify1_customer_email || "",
        cha_name: booking.cha || "", cha_address: booking.cha_address || "",
        commodity_description: booking.commodity_description || "", marks_no: booking.marks_no || "",
        shipment_terms_code: booking.shipment_terms_code || "",
        cargo_details: Array.isArray(booking.cargo_details)
          ? booking.cargo_details.map((c: Record<string, unknown>) => ({
              no_of_packages: c.no_of_packages || "", gross_weight: c.gross_weight || "",
              volume: c.volume || "", chargeable_weight: c.chargeable_weight || "",
              haz: booking.is_hazardous || "",
            }))
          : [],
        mawb_charges: Array.isArray(booking.rate_details)
          ? booking.rate_details.map((c: Record<string, unknown>) => ({
              charge_id: c.charge_id || "", supplier_code: "", pp_cc: c.pp_cc || "",
              unit_id: c.unit_id || "", no_of_unit: c.no_of_units || "",
              amount: c.min_sell || "", amount_per_unit: c.sell_per_unit || "",
              cost_local_amount: "", currency_id: c.currency_id || "", roe: c.roe || "",
              sell_local_amount: "", total_cost: c.total_cost || "", unit_cost: c.cost_per_unit || "",
            }))
          : [],
        events: Array.isArray(booking.events)
          ? booking.events.map((e: Record<string, unknown>) => ({
              event_id: e.event_id || "", event_name: e.event_name || "", event_date: e.event_date || "",
              event_status: e.event_status || "", event_description: e.event_description || "",
              event_type: e.event_type || "", event_priority: e.event_priority || "", event_location: e.event_location || "",
            }))
          : [],
      }],
    };

    setCreateJobModalOpen(true);
    setCreateJobLoading(true);
    setCreateJobResponse(null);
    setCreateJobError(null);

    try {
      const response = (await apiCallProtected.post(URL.jobCreate, payload)) as Record<string, unknown>;
      setCreateJobResponse(response);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; detail?: string; error?: string } }; message?: string };
      const errMsg = axiosErr?.response?.data?.message || axiosErr?.response?.data?.detail ||
        axiosErr?.response?.data?.error || (err instanceof Error ? err.message : "Failed to create job");
      setCreateJobError(String(errMsg));
    } finally { setCreateJobLoading(false); }
  };

  // ---- Row action menu ----
  const RowMenu = ({ row }: { row: ExportShipmentData }) => {
    const statusUpper = (row.status ?? "").toUpperCase();
    const isCancel = statusUpper.includes("CANCEL");
    const canCancel = statusUpper !== "GENERATED" && !isCancel;
    const isBooked = statusUpper === "BOOKED";
    return (
      <Menu
        shadow="md"
        width={200}
        position="bottom-end"
        styles={v0MenuStyles}
        classNames={{ dropdown: AIR_EXPORT_GEIST_ROOT_CLASS }}
      >
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="sm">
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconEye size={14} />} disabled={isCancel}
            onClick={() => { if (!isCancel) navigate("./edit", { state: { job: row } }); }}>
            View Details
          </Menu.Item>
          <Menu.Item leftSection={<IconEdit size={14} />} disabled={isCancel}
            onClick={() => { if (!isCancel) navigate("./edit", { state: { job: row } }); }}>
            Edit Booking
          </Menu.Item>
          {/* <Menu.Item leftSection={<IconCopy size={14} />}
            onClick={() => ToastNotification({ type: "info", message: "Duplicate not available yet" })}>
            Duplicate
          </Menu.Item> */}
          <Menu.Divider />
          {/* <Menu.Item leftSection={<IconFileText size={14} />}
            onClick={() => ToastNotification({ type: "info", message: "Generate AWB coming soon" })}>
            Generate AWB
          </Menu.Item> */}
          {isBooked && (
            <Menu.Item leftSection={<IconBriefcase size={14} />} onClick={() => handleCreateJob(row)}>
              Create Job
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item leftSection={<IconCircleX size={14} />} color="red" disabled={!canCancel}
            onClick={() => { if (canCancel) setCancelConfirmRow(row); }}>
            Cancel Booking
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  };

  // ---- Sortable header ----
  const Th = ({ col, label, sortable = false, align = "left" as "left" | "right" }) => {
    const active = sortConfig?.key === col;
    return (
      <th style={{
        padding: "10px 14px", textAlign: align, fontWeight: 500, fontSize: 14,
        color: "#64748b", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0",
        whiteSpace: "nowrap", userSelect: "none",
      }}>
        {sortable ? (
          <button type="button" onClick={() => handleSort(col)} style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4,
            color: active ? "#2563eb" : "#64748b", fontSize: "inherit", fontWeight: "inherit",
          }}>
            {label}
            <IconSelector size={12} style={{ opacity: active ? 1 : 0.5 }} />
          </button>
        ) : label}
      </th>
    );
  };

  // ---- theme constants ----
  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#2563eb";
  /** Table header / chrome (muted band inside the white card). */
  const bg = "#f8fafc";
  /** Same as AppShell main + `--page-bg` so the column isn’t a second gray behind the card. */
  const pageBg = "#F0F4F8";
  const cardBg = "#ffffff";

  // ===================== RENDER =====================
  return (
    <MantineProvider theme={airExportV0MantineTheme}>
      <Box className={AIR_EXPORT_GEIST_ROOT_CLASS} style={v0RootTypography}>
      {showMasterTable && (
        <Box
          style={{
            minHeight: "100vh",
            backgroundColor: pageBg,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ===== STATS + TOOLBAR (v0 layout: one row, gap-6 / gap-8, ml-auto actions) ===== */}
          {/* Full-bleed in main column: cancel AppShellLayout px (16 / 24) */}
          <Box
            mx={{ base: -16, sm: -24 }}
            style={{ backgroundColor: "#fff", borderBottom: `1px solid ${border}` }}
          >
            <Box px={{ base: 16, lg: 24 }} py={12}>
              <Flex
                align="center"
                gap={24}
                wrap="nowrap"
                style={{
                  overflowX: "auto",
                  minHeight: 40,
                }}
              >
                {/* Stat pills — gap-8 between items, gap-2 inside each */}
                <Flex align="center" gap={32} wrap="nowrap" style={{ flexShrink: 0 }}>
                  <Group gap={8} wrap="nowrap" align="center">
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: `${primary}1a`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconPackage size={14} color={primary} />
                    </Box>
                    <Box>
                      <Text fw={700} size="lg" c={fg} lh={1}>
                        {stats.total}
                      </Text>
                      <Text size={10} c={muted} lh={1.2}>
                        Total
                      </Text>
                    </Box>
                  </Group>
                  <Group gap={8} wrap="nowrap" align="center">
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: "#d1fae5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconCircleCheck size={14} color="#059669" />
                    </Box>
                    <Box>
                      <Text fw={700} size="lg" c={fg} lh={1}>
                        {stats.booked}
                      </Text>
                      <Text size={10} c={muted} lh={1.2}>
                        Booked
                      </Text>
                    </Box>
                  </Group>
                  <Group gap={8} wrap="nowrap" align="center">
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: "#dbeafe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconPackage size={14} color="#2563eb" />
                    </Box>
                    <Box>
                      <Text fw={700} size="lg" c={fg} lh={1}>
                        {stats.received}
                      </Text>
                      <Text size={10} c={muted} lh={1.2}>
                        Received
                      </Text>
                    </Box>
                  </Group>
                  <Group gap={8} wrap="nowrap" align="center">
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: "#fef3c7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconClock size={14} color="#d97706" />
                    </Box>
                    <Box>
                      <Text fw={700} size="lg" c={fg} lh={1}>
                        {stats.pending}
                      </Text>
                      <Text size={10} c={muted} lh={1.2}>
                        Pending
                      </Text>
                    </Box>
                  </Group>
                </Flex>

                <Box
                  style={{
                    width: 1,
                    height: 32,
                    backgroundColor: border,
                    flexShrink: 0,
                  }}
                />

                <Flex align="center" gap={24} wrap="nowrap" style={{ flexShrink: 0 }}>
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
                </Flex>

                {/* ml-auto toolbar — matches v0: Status, Columns, Refresh, Export, New Booking */}
                <Flex
                  align="center"
                  gap={8}
                  wrap="nowrap"
                  style={{ marginLeft: "auto", flexShrink: 0 }}
                >
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
                    classNames={{
                      dropdown: AIR_EXPORT_GEIST_ROOT_CLASS,
                      option: AIR_EXPORT_GEIST_ROOT_CLASS,
                    }}
                    styles={{
                      input: {
                        height: 32,
                        minHeight: 32,
                        fontSize: 12,
                        borderColor: border,
                        fontFamily: V0_FONT_SANS,
                      },
                      dropdown: { fontFamily: V0_FONT_SANS, fontSize: 14 },
                      option: { fontFamily: V0_FONT_SANS, fontSize: 14 },
                    }}
                  />
                  <Menu
                    shadow="md"
                    width={200}
                    styles={v0MenuStyles}
                    classNames={{ dropdown: AIR_EXPORT_GEIST_ROOT_CLASS }}
                  >
                    <Menu.Target>
                      <Button
                        variant="default"
                        size="xs"
                        leftSection={<IconSettings size={14} />}
                        styles={{
                          root: {
                            height: 32,
                            fontSize: 12,
                            borderColor: border,
                            gap: 6,
                            paddingLeft: 10,
                            paddingRight: 12,
                            fontFamily: V0_FONT_SANS,
                          },
                        }}
                      >
                        Columns
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label style={{ fontSize: 12, fontFamily: V0_FONT_SANS }}>Toggle Columns</Menu.Label>
                      {(Object.keys(visibleColumns) as (keyof VisibleColumnsState)[]).map(
                        (key) => (
                          <Menu.Item
                            key={key}
                            closeMenuOnClick={false}
                            onClick={() =>
                              setVisibleColumns((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          >
                            <Group gap="sm" wrap="nowrap">
                              <Checkbox
                                size="xs"
                                checked={visibleColumns[key]}
                                onChange={() => {}}
                                styles={{ input: { cursor: "pointer", fontFamily: V0_FONT_SANS } }}
                              />
                              <Text size="xs" tt="capitalize" style={{ fontFamily: V0_FONT_SANS }}>
                                {key}
                              </Text>
                            </Group>
                          </Menu.Item>
                        ),
                      )}
                    </Menu.Dropdown>
                  </Menu>
                  {/* <Button
                    variant="default"
                    size="xs"
                    disabled={isDataLoading || isRefreshing}
                    leftSection={
                      isRefreshing ? (
                        <Loader size={14} />
                      ) : (
                        <IconRefresh size={14} />
                      )
                    }
                    styles={{
                      root: {
                        height: 32,
                        fontSize: 12,
                        borderColor: border,
                        gap: 6,
                        paddingLeft: 10,
                        paddingRight: 12,
                      },
                    }}
                    onClick={() => void handleRefresh()}
                  >
                    Refresh
                  </Button> */}
                <Button
                  variant="default"
                  size="xs"
                  styles={{
                    root: {
                      height: 32,
                      fontSize: 12,
                      borderColor: border,
                      gap: 6,
                      paddingLeft: 10,
                      paddingRight: 12,
                      fontFamily: V0_FONT_SANS,
                    },
                  }}
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                  {/* <Button
                    variant="default"
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    styles={{
                      root: {
                        height: 32,
                        fontSize: 12,
                        borderColor: border,
                        gap: 6,
                        paddingLeft: 10,
                        paddingRight: 12,
                        fontFamily: V0_FONT_SANS,
                      },
                    }}
                    onClick={() => handleExport(tableRows)}
                  >
                    Export
                  </Button> */}
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    styles={{
                      root: {
                        height: 32,
                        fontSize: 12,
                        backgroundColor: primary,
                        gap: 6,
                        paddingLeft: 10,
                        paddingRight: 12,
                        border: "none",
                        fontFamily: V0_FONT_SANS,
                      },
                    }}
                    onClick={persistListAndNavigate}
                  >
                    New Booking
                  </Button>
                </Flex>
              </Flex>
            </Box>
          </Box>

          {/* ===== ADVANCED FILTER PANEL ===== */}
          {showFilters && (
            <Box py="sm" style={{ backgroundColor: "#fff", borderBottom: `1px solid ${border}` }}>
              <Box style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
                <Group justify="space-between" align="center" px="sm" py={6} style={{ backgroundColor: bg }}>
                  <Text size="sm" fw={600} c={fg}>Advanced Filters</Text>
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setShowFilters(false)}>
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
                <Box p="md">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, xs: 6, sm: 4, md: 2.4 }}>
                      <FormTextInput size="xs" label="Booking ID" placeholder="Enter Booking ID"
                        styles={AIR_EXPORT_FILTER_FIELD_FONT_STYLES}
                        value={filterForm.values.booking_id ?? ""}
                        onChange={(e) => filterForm.setFieldValue("booking_id", e.currentTarget.value || null)} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, xs: 6, sm: 4, md: 2.4 }}>
                      <FormTextInput size="xs" label="Enquiry ID" placeholder="Enter Enquiry ID"
                        styles={AIR_EXPORT_FILTER_FIELD_FONT_STYLES}
                        value={filterForm.values.enquiry_id ?? ""}
                        onChange={(e) => filterForm.setFieldValue("enquiry_id", e.currentTarget.value || null)} />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, xs: 6, sm: 4, md: 2.4 }}>
                      <SearchableSelect size="xs" label="Customer" placeholder="Type customer name"
                        apiEndpoint={URL.allCustomers} searchFields={["customer_name", "customer_code"]}
                        displayFormat={(item: Record<string, unknown>) => ({ value: String(item.customer_code), label: String(item.customer_name) })}
                        value={filterForm.values.customer} displayValue={customerDisplayName}
                        onChange={(value, selectedData) => { filterForm.setFieldValue("customer", value || ""); setCustomerDisplayName(selectedData?.label || null); }}
                        minSearchLength={2} dropdownZIndex={1000}
                        classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                        styles={AIR_EXPORT_FILTER_FIELD_FONT_STYLES}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, xs: 6, sm: 4, md: 2.4 }}>
                      <SingleDateInput key={`date-${filterForm.values.date}`} label="Date" placeholder="YYYY-MM-DD"
                        size="xs" value={filterForm.values.date}
                        onChange={(d) => filterForm.setFieldValue("date", d)}
                        classNames={{ dropdown: AIR_EXPORT_GEIST_ROOT_CLASS }}
                        styles={AIR_EXPORT_FILTER_FIELD_FONT_STYLES}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, xs: 6, sm: 4, md: 2.4 }}>
                      <SearchableSelect size="xs" label="Origin" placeholder="Type origin code or name"
                        apiEndpoint={URL.portMaster} searchFields={["port_code", "port_name"]}
                        displayFormat={(item: Record<string, unknown>) => ({ value: String(item.port_code), label: `${item.port_name} (${item.port_code})` })}
                        value={filterForm.values.origin} displayValue={originDisplayName}
                        onChange={(value, selectedData) => { filterForm.setFieldValue("origin", value || ""); setOriginDisplayName(selectedData?.label || null); }}
                        minSearchLength={3} additionalParams={airTransportParams} dropdownZIndex={1000}
                        classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                        styles={AIR_EXPORT_FILTER_FIELD_FONT_STYLES}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, xs: 6, sm: 4, md: 2.4 }}>
                      <SearchableSelect size="xs" label="Destination" placeholder="Type destination code or name"
                        apiEndpoint={URL.portMaster} searchFields={["port_code", "port_name"]}
                        displayFormat={(item: Record<string, unknown>) => ({ value: String(item.port_code), label: `${item.port_name} (${item.port_code})` })}
                        value={filterForm.values.destination} displayValue={destinationDisplayName}
                        onChange={(value, selectedData) => { filterForm.setFieldValue("destination", value || ""); setDestinationDisplayName(selectedData?.label || null); }}
                        minSearchLength={3} additionalParams={airTransportParams} dropdownZIndex={1000}
                        classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                        styles={AIR_EXPORT_FILTER_FIELD_FONT_STYLES}
                      />
                    </Grid.Col>
                  </Grid>
                  <Group justify="flex-end" gap={8} mt="md">
                    <Button size="xs" variant="outline" leftSection={<IconX size={13} />}
                      styles={{ root: { borderColor: primary, color: primary } }} onClick={clearAllFilters}>
                      Clear
                    </Button>
                    <Button size="xs" leftSection={<IconFilter size={13} />}
                      styles={{ root: { backgroundColor: primary } }}
                      onClick={applyFilters} loading={isDataLoading} disabled={isDataLoading}>
                      Apply Filters
                    </Button>
                  </Group>
                </Box>
              </Box>
            </Box>
          )}

          {/* ===== MAIN CONTENT ===== */}
          <Box component="main" py="md" style={{ flexShrink: 0 }}>
            <Paper withBorder radius="xl" shadow="sm" style={{ overflow: "hidden", borderColor: border, backgroundColor: cardBg }}>
              {/* <Group justify="flex-end" px="md" py={8} style={{ borderBottom: `1px solid ${border}` }}>
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  {showFilters ? "Hide filters" : "Advanced filters"}
                </Button>
              </Group> */}

              {/* Selection bar */}
              {selectedIds.length > 0 && (
                <Box px="md" py={8} style={{ backgroundColor: `${primary}0d`, borderBottom: `1px solid ${border}` }}>
                  <Group justify="space-between" wrap="wrap" gap={8}>
                    <Text size="sm" fw={500} c={primary}>
                      {selectedIds.length} booking{selectedIds.length > 1 ? "s" : ""} selected
                    </Text>
                    <Group gap={8}>
                      <Button variant="default" size="xs" leftSection={<IconFileText size={13} />}
                        onClick={() => ToastNotification({ type: "info", message: "Generate AWB coming soon" })}>
                        Generate AWB
                      </Button>
                      <Button variant="default" size="xs" leftSection={<IconDownload size={13} />}
                        onClick={() => handleExport(tableRows.filter((r) => selectedIds.includes(r.id)))}>
                        Export Selected
                      </Button>
                      <Button variant="subtle" color="red" size="xs" onClick={() => setSelectedIds([])}>Clear</Button>
                    </Group>
                  </Group>
                </Box>
              )}

              {/* Table area — same surface as card (avoids white vs gray mismatch with footer). */}
              <Box style={{ overflowX: "auto", overflowY: "hidden", backgroundColor: cardBg }}>
                {isDataLoading ? (
                  <Center py={80} style={{ backgroundColor: cardBg }}>
                    <Stack align="center" gap="md">
                      <Loader size="lg" color={primary} />
                      <Text c="dimmed" size="sm">Loading export bookings...</Text>
                    </Stack>
                  </Center>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, backgroundColor: cardBg }}>
                    <thead>
                      <tr>
                        {/* Checkbox */}
                        {/* <th style={{ padding: "10px 14px", width: 44, backgroundColor: bg, borderBottom: `1px solid ${border}` }}>
                          <Checkbox size="xs"
                            checked={tableRows.length > 0 && tableRows.every((r) => selectedIds.includes(r.id))}
                            indeterminate={tableRows.some((r) => selectedIds.includes(r.id)) && !tableRows.every((r) => selectedIds.includes(r.id))}
                            onChange={() => selectAllOnPage()} />
                        </th> */}
                        {/* {visibleColumns.shipment && <Th col="shipment" label="Shipment" sortable />} */}
                        {visibleColumns.sno && <Th col="sno" label="S.No"  />}
                        {visibleColumns.shipment && <Th col="shipment" label="Shipment"  />}
                        {visibleColumns.date && <Th col="date" label="Date"  />}
                        {visibleColumns.customer && <Th col="customer" label="Customer"  />}
                        {visibleColumns.route && <Th col="route" label="Route" />}
                        {visibleColumns.status && <Th col="status" label="Status" />}
                        {visibleColumns.mawb && <Th col="mawb" label="MAWB" />}
                        {visibleColumns.flight && <Th col="flight" label="Flight" />}
                        {visibleColumns.pieces && <Th col="pieces" label="Pcs" align="right" />}
                        {visibleColumns.weight && <Th col="weight" label="Weight"  align="right" />}
                        {visibleColumns.handler && <Th col="handler" label="Customer Service" />}
                        <th style={{ width: 44, backgroundColor: bg, borderBottom: `1px solid ${border}` }} />
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.length === 0 ? (
                        <tr>
                          <td colSpan={20} style={{ padding: 60, textAlign: "center" }}>
                            <Stack align="center" gap="md">
                              <Box style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <IconPackage size={24} color={muted} />
                              </Box>
                              <Box>
                                <Text fw={500} c={fg}>No bookings found</Text>
                                <Text size="sm" c={muted} mt={4}>Try adjusting your search or filters</Text>
                              </Box>
                            </Stack>
                          </td>
                        </tr>
                      ) : (
                        tableRows.map((booking) => {
                          const pw = getRowPW(booking);
                          const oc = booking.origin_code_read || booking.origin_code || "";
                          const dc = booking.destination_code_read || booking.destination_code || "";
                          const sel = selectedIds.includes(booking.id);
                          return (
                            <tr key={booking.id} style={{
                              borderBottom: `1px solid ${border}`,
                              backgroundColor: sel ? `${primary}08` : undefined,
                              transition: "background 0.12s",
                            }}
                              onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"; }}
                              onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ""; }}
                            >
                              {/* <td style={{ padding: "10px 14px" }}>
                                <Checkbox size="xs" checked={sel} onChange={() => { toggleRow(booking.id); }} />
                              </td> */}
                              {visibleColumns.sno && (
                                <td style={{ padding: "10px 14px" }}>
                                  <Text fw={600} size="sm" c={fg}>{booking.sno}</Text>
                                </td>
                              )}
                              {visibleColumns.shipment && (
                                <td style={{ padding: "10px 14px" }}>
                                  <Text fw={600} size="sm" c={fg}>{booking.shipment_code}</Text>
                                  {booking.enquiry_id ? <Text fz={10} c={muted}>{booking.enquiry_id}</Text> : null}
                                </td>
                              )}
                              {visibleColumns.date && (
                                <td style={{ padding: "10px 14px", color: muted }}>
                                  {booking.date ? dayjs(booking.date).format("DD MMM") : "—"}
                                </td>
                              )}
                              {visibleColumns.customer && (
                                <td style={{ padding: "10px 14px", maxWidth: 200 }}>
                                  <Tooltip
                                    label={booking.customer_name ?? ""}
                                    withArrow
                                    styles={{ tooltip: { fontFamily: V0_FONT_SANS, fontSize: 12 } }}
                                  >
                                    <Text size="sm" c={fg} lineClamp={1} style={{ cursor: "default" }}>
                                      {booking.customer_name ?? "—"}
                                    </Text>
                                  </Tooltip>
                                </td>
                              )}
                              {visibleColumns.route && (
                                <td style={{ padding: "10px 14px" }}>
                                  <Group gap={6} wrap="nowrap">
                                    <Text fw={600} size="sm" c={primary}>{oc || "—"}</Text>
                                    <IconArrowRight size={12} color={muted} />
                                    <Text fw={500} size="sm" c={fg}>{dc || "—"}</Text>
                                  </Group>
                                </td>
                              )}
                              {visibleColumns.status && (
                                <td style={{ padding: "10px 14px" }}>
                                  <StatusPill status={booking.status} />
                                </td>
                              )}
                              {visibleColumns.mawb && (
                                <td
                                  className={AIR_EXPORT_GEIST_MONO_CLASS}
                                  style={{ padding: "10px 14px", fontSize: 12, color: muted }}
                                >
                                  {booking.mawb_no ? <Text size="xs" fw={500} c={fg}>{booking.mawb_no}</Text>
                                    : <Text size="sm" c={muted}>—</Text>}
                                </td>
                              )}
                              {visibleColumns.flight && (
                                <td style={{ padding: "10px 14px" }}>
                                  {booking.voyage_no
                                    ? <Text size="xs" fw={500} c={fg}>{booking.voyage_no}</Text>
                                    : <Text size="sm" c={muted}>—</Text>}
                                </td>
                              )}
                              {visibleColumns.pieces && (
                                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 14, color: muted }}>{pw.pieces}</td>
                              )}
                              {visibleColumns.weight && (
                                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 14, fontWeight: 500, color: fg }}>{pw.weight.toFixed(1)}</td>
                              )}
                              {visibleColumns.handler && (
                                <td style={{ padding: "10px 14px" }}>
                                  <Group gap={8} wrap="nowrap">
                                    <Box style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: `${primary}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      <Text size={10} fw={600} c={primary}>{initials(booking.customer_service_name)}</Text>
                                    </Box>
                                    <Text size="xs" c={muted} lineClamp={1} maw={100}>{firstName(booking.customer_service_name)}</Text>
                                  </Group>
                                </td>
                              )}
                              <td style={{ padding: "10px 8px", textAlign: "center" }}>
                                <RowMenu row={booking} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </Box>

              {/* ===== PAGINATION FOOTER ===== */}
              <Box px="md" py={10} style={{ borderTop: `1px solid ${border}`, backgroundColor: cardBg }}>
                <Group justify="space-between" wrap="wrap" gap="md">
                  <Group gap="md" wrap="wrap" align="center">
                    <Text size="sm" c={muted}>
                      Showing{" "}
                      <Text span fw={600} c={fg}>{totalRecords === 0 ? 0 : pageIndex * pageSize + 1}</Text>
                      {" "}to{" "}
                      <Text span fw={600} c={fg}>{Math.min((pageIndex + 1) * pageSize, totalRecords)}</Text>
                      {" "}of{" "}
                      <Text span fw={600} c={fg}>{totalRecords}</Text>
                      {" "}results
                    </Text>
                    <Group gap={6} align="center">
                      <Text size="sm" c={muted}>Rows:</Text>
                      <Select size="xs" w={68} value={String(pageSize)}
                        onChange={(v) => { if (v) { setPageSize(Number(v)); setPageIndex(0); } }}
                        data={["10", "15", "25", "50"]}
                        classNames={{
                          dropdown: AIR_EXPORT_GEIST_ROOT_CLASS,
                          option: AIR_EXPORT_GEIST_ROOT_CLASS,
                        }}
                        styles={{
                          input: { fontFamily: V0_FONT_SANS },
                          dropdown: { fontFamily: V0_FONT_SANS, fontSize: 14 },
                          option: { fontFamily: V0_FONT_SANS, fontSize: 14 },
                        }}
                      />
                    </Group>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon variant="default" size="md" onClick={() => setPageIndex(0)} disabled={pageIndex === 0}><IconChevronsLeft size={16} /></ActionIcon>
                    <ActionIcon variant="default" size="md" onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0}><IconChevronLeft size={16} /></ActionIcon>
                    <Group gap={4} mx={4}>
                      {pageButtonIndices.map((pNum) => (
                        <ActionIcon key={pNum} size="md"
                          variant={pageIndex === pNum ? "filled" : "default"}
                          color={pageIndex === pNum ? "blue" : "gray"}
                          onClick={() => setPageIndex(pNum)}>
                          <Text size="xs">{pNum + 1}</Text>
                        </ActionIcon>
                      ))}
                    </Group>
                    <ActionIcon variant="default" size="md" onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))} disabled={pageIndex >= totalPages - 1}><IconChevronRight size={16} /></ActionIcon>
                    <ActionIcon variant="default" size="md" onClick={() => setPageIndex(totalPages - 1)} disabled={pageIndex >= totalPages - 1}><IconChevronsRight size={16} /></ActionIcon>
                  </Group>
                </Group>
              </Box>
            </Paper>
          </Box>
        </Box>
      )}

      {/* ===== CANCEL MODAL ===== */}
      <Modal opened={!!cancelConfirmRow} onClose={() => !isCancelling && setCancelConfirmRow(null)}
        title={<Text fw={600} size="md">Cancel Booking</Text>} centered size="sm" styles={v0ModalStyles} classNames={v0ModalClassNames}>
        <Text size="sm" c="dimmed" mb="md">
          Are you sure you want to cancel booking{" "}
          <Text span fw={600} c={fg}>{cancelConfirmRow?.shipment_code}</Text>?
          This action cannot be undone.
        </Text>
        <Group justify="flex-end" gap={8}>
          <Button variant="default" onClick={() => setCancelConfirmRow(null)} disabled={isCancelling}>Keep Booking</Button>
          <Button color="red" onClick={handleConfirmCancel} loading={isCancelling}>Cancel Booking</Button>
        </Group>
      </Modal>

      {/* ===== CREATE JOB MODAL ===== */}
      <Modal opened={createJobModalOpen}
        onClose={() => { if (!createJobLoading) { setCreateJobModalOpen(false); setCreateJobResponse(null); setCreateJobError(null); } }}
        title={<Text fw={600} size="md" c={fg}>Create Job</Text>}
        centered size="md" closeOnClickOutside={!createJobLoading} closeOnEscape={!createJobLoading} withCloseButton={!createJobLoading} styles={v0ModalStyles} classNames={v0ModalClassNames}>
        {createJobLoading ? (
          <Center py="xl"><Stack align="center" gap="md"><Loader size="md" color={primary} /><Text c="dimmed" size="sm">Creating job, please wait...</Text></Stack></Center>
        ) : createJobError ? (
          <Stack gap="md">
            <Box style={{ border: "1px solid #FFCDD2", borderRadius: 6, padding: "12px 16px", backgroundColor: "#FFF5F5" }}>
              <Text size="sm" c="red">{createJobError}</Text>
            </Box>
            <Group justify="flex-end">
              <Button size="sm" variant="outline" styles={{ root: { borderColor: primary, color: primary } }}
                onClick={() => { setCreateJobModalOpen(false); setCreateJobError(null); }}>Close</Button>
            </Group>
          </Stack>
        ) : createJobResponse ? (() => {
          const r = createJobResponse as { success?: boolean; message?: string; data?: { job_details_id?: number; id?: number; job_id?: string; job_no?: string }; job_details_id?: number; id?: number; job_id?: string };
          const isSuccess = r?.success === true || r?.success === undefined;
          const message = r?.message || (isSuccess ? "Job created successfully!" : "Job creation failed.");
          const jobId = r?.data?.job_details_id ?? r?.data?.id ?? r?.job_details_id ?? r?.id;
          const jobNo = r?.data?.job_id || r?.data?.job_no || r?.job_id;
          return (
            <Stack gap="md">
              <Box style={{ border: `1px solid ${isSuccess ? "#C8E6C9" : "#FFCDD2"}`, borderRadius: 6, padding: "12px 16px", backgroundColor: isSuccess ? "#F1F8E9" : "#FFF5F5" }}>
                <Text size="sm" fw={600} c={isSuccess ? "green" : "red"}>{message}</Text>
              </Box>
              {(jobId != null || jobNo) && (
                <Box style={{ border: `1px solid ${border}`, borderRadius: 6, padding: "12px 16px", backgroundColor: bg }}>
                  <Stack gap="xs">
                    {jobId != null && <Group gap="xs"><Text size="sm" fw={600} c={fg}>Job ID:</Text><Text size="sm" c="#334155">{String(jobId)}</Text></Group>}
                    {jobNo && <Group gap="xs"><Text size="sm" fw={600} c={fg}>Job No:</Text><Text size="sm" c="#334155">{String(jobNo)}</Text></Group>}
                  </Stack>
                </Box>
              )}
              <Group justify="flex-end">
                <Button size="sm" styles={{ root: { backgroundColor: primary } }}
                  onClick={() => { setCreateJobModalOpen(false); setCreateJobResponse(null); }}>Close</Button>
              </Group>
            </Stack>
          );
        })() : null}
      </Modal>

      <Outlet />
      </Box>
    </MantineProvider>
  );
}

export default AirExportBookingMaster;
