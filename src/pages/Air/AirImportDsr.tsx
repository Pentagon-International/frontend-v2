import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from "react";
import { Box, Center, Flex, Group, Text, Button, TextInput, ActionIcon, Loader, Tooltip } from "@mantine/core";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { IconSearch, IconFilter, IconStack2, IconCircleCheck, IconClock, IconX, IconDownload } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useLocation } from "react-router-dom";
import { apiCallProtected } from "../../api/axios";
import { URL } from "../../api/serverUrls";
import SingleDateInput from "../../components/SingleDateInput";
import FormTextInput from "../../components/FormTextInput";
import PaginationBar from "../../components/PaginationBar/PaginationBar";
import { ERPListScreen } from "../../components/ERPListPage/ERPListScreen";
import { ERPListStatPill } from "../../components/ERPListPage/ERPListStatPill";
import { ERPListFilterActionsFooter } from "../../components/ERPListPage/ERPListFilterActionsFooter";
import { DEFAULT_ERP_LIST_THEME } from "../../components/ERPListPage/erpListTheme";
import {
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMenuDropdownStyles,
  erpListThStyle,
  erpToolbarOutlineButtonStyles,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../components";
import { useListFilterStore } from "../../store/listFilterStore";
import useDateFormat from "../../hooks/useDateFormat";
import { downloadDsrCsv } from "../../utils/dsrCsvDownload";

const LIST_KEY = "AIR_IMPORT_DSR";

function buildAirImportBookedListUrl(
  zeroBasedRowOffset: number,
  limit: number
): string {
  return `${URL.airImportBooked}?index=${zeroBasedRowOffset}&limit=${limit}`;
}

const DSR_PRIMARY = "#105476";
const DSR_BORDER = "#e2e8f0";
const DSR_FOOTER_BG = "#f8fafc";

/** Scroll area inside the bordered card (pagination lives in the card footer). */
const AIR_IMPORT_DSR_TABLE_BODY: CSSProperties = {
  flex: 1,
  minHeight: 0,
  maxHeight: "70vh",
  overflow: "auto",
  padding: "12px 16px",
};

const AIR_IMPORT_DSR_COLUMNS = [
  { key: "sr_no", label: "S.No", width: 55 },
  { key: "date", label: "Date", width: 105 },
  { key: "sales_person", label: "Sales Person", width: 100 },
  { key: "ref_number", label: "Ref Number", width: 120 },
  { key: "status", label: "Status", width: 100 },
  { key: "customer", label: "Customer", width: 120 },
  { key: "actual_consignee", label: "Consignee", width: 120 },
  { key: "shipper", label: "Shipper", width: 120 },
  { key: "agent", label: "Agent", width: 120 },
  { key: "pol", label: "POL", width: 100 },
  { key: "pod", label: "POD", width: 100 },
  { key: "terms", label: "Terms", width: 100 },
  { key: "pqkgs", label: "Packages", width: 100 },
  { key: "gw", label: "GW", width: 100 },
  { key: "cw", label: "CW", width: 100 },
  { key: "hawb", label: "HAWB", width: 100 },
  { key: "mawb", label: "MAWB", width: 100 },
  { key: "etd", label: "ETD", width: 110 },
  { key: "eta", label: "ETA", width: 110 },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  width?: number;
}>;

type AirImportDsrColumnKey = (typeof AIR_IMPORT_DSR_COLUMNS)[number]["key"];

const IMPORT_NAME_TOOLTIP_KEYS = new Set<AirImportDsrColumnKey>([
  "shipper",
  "actual_consignee",
]);

/**
 * Backend `filters` keys for air-import-booked (matches API).
 * `shipment_received_date` is handled by the date-range drawer, not column headers.
 */
const IMPORT_BACKEND_FILTER_KEYS = [
  "sales_person",
  "enq_reference_no",
  "customer_name",
  "shipper_name",
  "cnee_name",
  "overseas_agent",
  "pol",
  "pod",
  "terms",
  "pkgs",
  "weight_in_kg",
  "shipping_bill_number_date",
  "invoice_number_date",
  "hawb",
  "mawb",
  "etd",
  "eta",
  "haz_non_haz",
  "iata",
  "remark",
  "shipment_status",
  "job_number",
  "job_month",
  "job_submitted_date",
] as const;

type ImportBackendFilterKey = (typeof IMPORT_BACKEND_FILTER_KEYS)[number];

/** Table column key → backend `filters` key. */
const IMPORT_COLUMN_TO_BACKEND_FILTER_KEY: Partial<
  Record<AirImportDsrColumnKey, ImportBackendFilterKey>
> = {
  sales_person: "sales_person",
  ref_number: "enq_reference_no",
  status: "shipment_status",
  customer: "customer_name",
  actual_consignee: "cnee_name",
  shipper: "shipper_name",
  agent: "overseas_agent",
  pol: "pol",
  pod: "pod",
  terms: "terms",
  pqkgs: "pkgs",
  gw: "weight_in_kg",
  hawb: "hawb",
  mawb: "mawb",
  etd: "etd",
  eta: "eta",
};

const IMPORT_NON_FILTERABLE_COLUMN_KEYS = new Set<AirImportDsrColumnKey>([
  "sr_no",
  "date",
  "cw",
]);

function importColumnKeyToBackendFilterKey(
  columnKey: AirImportDsrColumnKey,
): ImportBackendFilterKey | null {
  if (IMPORT_NON_FILTERABLE_COLUMN_KEYS.has(columnKey)) return null;
  return IMPORT_COLUMN_TO_BACKEND_FILTER_KEY[columnKey] ?? null;
}

function buildImportBackendFiltersPayload(
  applied: Partial<Record<AirImportDsrColumnKey, string>>,
): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const [columnKey, raw] of Object.entries(applied) as [
    AirImportDsrColumnKey,
    string,
  ][]) {
    const backendKey = importColumnKeyToBackendFilterKey(columnKey);
    if (!backendKey) continue;
    const v = String(raw ?? "").trim();
    if (v) filters[backendKey] = v;
  }
  return filters;
}

/** Use cleared `applied` immediately; otherwise debounced values (avoids 1s lag after Clear). */
function columnFiltersForApiRequest(
  applied: Partial<Record<AirImportDsrColumnKey, string>>,
  debounced: Partial<Record<AirImportDsrColumnKey, string>>,
): Partial<Record<AirImportDsrColumnKey, string>> {
  const appliedActive = Object.values(applied).some((v) => String(v ?? "").trim() !== "");
  const debouncedActive = Object.values(debounced).some((v) => String(v ?? "").trim() !== "");
  if (!appliedActive && debouncedActive) return applied;
  return debounced;
}

type PersistedDsrFilters = {
  date_from: string | null;
  date_to: string | null;
  page: number;
  pageSize: number;
  column_filters?: Partial<Record<AirImportDsrColumnKey, string>>;
};

type AirImportBookedApiRow = {
  booking_id?: number | null;
  job_id?: number | null;
  house_id?: number | null;
  date?: string | null;
  sales_person?: string | null;
  ref_number?: string | null;
  status?: string | null;
  customer?: string | null;
  actual_consignee?: string | null;
  shipper?: string | null;
  agent?: string | null;
  pol?: string | null;
  pod?: string | null;
  terms?: string | null;
  pqkgs?: number | string | null;
  gw?: number | string | null;
  cw?: number | string | null;
  hawb_no?: string | null;
  mawb_no?: string | null;
  etd?: string | null;
  eta?: string | null;
  line?: string | null;
};

type AirImportBookedListResponse = {
  data?: AirImportBookedApiRow[];
  total?: number;
  count?: number;
};

type AirImportDsrRow = {
  __source?: AirImportBookedApiRow;
  sr_no: string;
  date: string;
  sales_person: string;
  ref_number: string;
  line: string;
  status: string;
  customer: string;
  actual_consignee: string;
  shipper: string;
  agent: string;
  pol: string;
  pod: string;
  terms: string;
  pqkgs: string;
  gw: string;
  cw: string;
  hawb: string;
  mawb: string;
  etd: string;
  eta: string;
};

type AirImportDsrEditableKey =
  | "status"
  | "ref_number"
  | "hawb"
  | "mawb"
  | "etd"
  | "eta";

function airImportDsrRowScalar(
  row: AirImportDsrRow,
  key: AirImportDsrColumnKey
): string {
  const k = key as keyof Omit<AirImportDsrRow, "__source">;
  const v = row[k];
  return v != null ? String(v) : "";
}

const AIR_IMPORT_DSR_TEXT_EDITABLE_KEYS = new Set<
  "status" | "ref_number" | "hawb" | "mawb"
>(["status", "ref_number", "hawb", "mawb"]);

type AirImportDsrIds = {
  booking_id: number | null;
  job_id: number | null;
  house_id: number | null;
};

function normalizeNullableInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getAirImportDsrIdsFromSource(source: unknown): AirImportDsrIds {
  const src =
    source && typeof source === "object"
      ? (source as Record<string, unknown>)
      : {};
  return {
    booking_id: normalizeNullableInt(src["booking_id"]),
    job_id: normalizeNullableInt(src["job_id"]),
    house_id: normalizeNullableInt(src["house_id"]),
  };
}

function getAirImportDsrIdentityKeyFromRow(row: AirImportDsrRow): string {
  const ids = getAirImportDsrIdsFromSource(row.__source);
  return `${ids.booking_id ?? ""}|${ids.job_id ?? ""}|${ids.house_id ?? ""}`;
}

export default function AirImportDsr() {
  const location = useLocation();
  const getStoreState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const theme = DEFAULT_ERP_LIST_THEME;
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(theme);
  const compactFilterFieldStyles = {
    ...filterFieldStyles,
    input: {
      ...filterFieldStyles.input,
      height: 26,
      minHeight: 26,
    },
  } as const;
  const mergeTh = (minW: number, widthPx: number) => ({
    ...erpListThStyle(theme),
    minHeight: 40,
    height: 40,
    verticalAlign: "middle" as const,
    boxSizing: "border-box" as const,
    minWidth: minW,
    width: widthPx,
    fontSize: 12,
    fontWeight: 500,
    color: theme.fg,
  });

  const [fromDate, setFromDate] = useState<Date | null>(() =>
    dayjs().startOf("month").toDate()
  );
  const [toDate, setToDate] = useState<Date | null>(() => dayjs().toDate());
  const [airImportDsrRows, setAirImportDsrRows] = useState<AirImportDsrRow[]>([]);
  const [isLoadingAirImportDsr, setIsLoadingAirImportDsr] = useState(false);
  const [isSubmittingAirImportDsr, setIsSubmittingAirImportDsr] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [airImportDsrPage, setAirImportDsrPage] = useState(1);
  const [airImportDsrPageSize, setAirImportDsrPageSize] = useState(25);
  const [airImportDsrTotalRecords, setAirImportDsrTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFromDate, setDraftFromDate] = useState<Date | null>(fromDate);
  const [draftToDate, setDraftToDate] = useState<Date | null>(toDate);
  const [visibleColumns, setVisibleColumns] = useState<Record<AirImportDsrColumnKey, boolean>>(() =>
    Object.fromEntries(
      AIR_IMPORT_DSR_COLUMNS.map((column) => [column.key, true])
    ) as Record<AirImportDsrColumnKey, boolean>
  );
  const [appliedColumnFilters, setAppliedColumnFilters] = useState<
    Partial<Record<AirImportDsrColumnKey, string>>
  >({});
  const [debouncedColumnFilters] = useDebouncedValue(appliedColumnFilters, 1000);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const dateFormat = useDateFormat();
  const formatFilterDateLabel = useCallback(
    (iso: string) => {
      if (!iso?.trim()) return "";
      const d = dayjs(iso);
      return d.isValid() ? d.format(dateFormat) : iso;
    },
    [dateFormat],
  );

  const openHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId(id);
  }, []);
  const collapseHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId((cur) => (cur === id ? null : cur));
  }, []);

  const persistDsrListState = useCallback(
    (nextColumnFilters: Partial<Record<AirImportDsrColumnKey, string>>, nextPage: number) => {
      setStoreFilters(LIST_KEY, {
        date_from: fromDate ? dayjs(fromDate).format("YYYY-MM-DD") : null,
        date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : null,
        page: nextPage,
        pageSize: airImportDsrPageSize,
        column_filters: nextColumnFilters,
      });
    },
    [fromDate, toDate, airImportDsrPageSize, setStoreFilters],
  );

  const commitColumnFilter = useCallback(
    (patch: Partial<Record<AirImportDsrColumnKey, string>>) => {
      setAppliedColumnFilters((prev) => {
        const next: Partial<Record<AirImportDsrColumnKey, string>> = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          const key = k as AirImportDsrColumnKey;
          if (key === "sr_no") continue;
          const trimmed = String(v ?? "").trim();
          if (!trimmed) delete next[key];
          else next[key] = trimmed;
        }
        persistDsrListState(next, 1);
        return next;
      });
      setAirImportDsrPage(1);
    },
    [persistDsrListState],
  );

  const columnToggleItems = useMemo(
    () =>
      AIR_IMPORT_DSR_COLUMNS.map((column) => ({
        id: column.key,
        label: column.label,
        checked: visibleColumns[column.key],
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [column.key]: !prev[column.key],
          })),
      })),
    [visibleColumns],
  );

  const airImportDsrOriginalEditableRef = useRef<
    Map<string, Pick<AirImportDsrRow, AirImportDsrEditableKey>>
  >(new Map());

  // Restore filters/search from global store on mount
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const stored = getStoreState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }
    const f = stored?.filters as PersistedDsrFilters | undefined;
    if (f && typeof f === "object") {
      const restoredFrom = f.date_from ? dayjs(f.date_from, "YYYY-MM-DD").toDate() : null;
      const restoredTo = f.date_to ? dayjs(f.date_to, "YYYY-MM-DD").toDate() : null;
      if (restoredFrom) setFromDate(restoredFrom);
      if (restoredTo) setToDate(restoredTo);
      setDraftFromDate(restoredFrom ?? null);
      setDraftToDate(restoredTo ?? null);
      if (typeof f.page === "number" && f.page > 0) setAirImportDsrPage(f.page);
      if (typeof f.pageSize === "number" && f.pageSize > 0) setAirImportDsrPageSize(f.pageSize);
      if (f.column_filters && typeof f.column_filters === "object") {
        setAppliedColumnFilters(f.column_filters as Partial<Record<AirImportDsrColumnKey, string>>);
      }
    }

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchAirImportDsrData = useCallback(async () => {
    try {
      setIsLoadingAirImportDsr(true);

      if (!fromDate || !toDate) {
        toast.error("Please select date range");
        setAirImportDsrRows([]);
        setAirImportDsrTotalRecords(0);
        return;
      }

      const pageSize = Math.max(1, Math.trunc(Number(airImportDsrPageSize)) || 25);
      const page = Math.max(1, Math.trunc(Number(airImportDsrPage)) || 1);
      const offset = (page - 1) * pageSize;

      const payload = {
        service_type: "import",
        date_from: dayjs(fromDate).format("YYYY-MM-DD"),
        date_to: dayjs(toDate).format("YYYY-MM-DD"),
        search: debouncedSearch.trim(),
        filters: buildImportBackendFiltersPayload(
          columnFiltersForApiRequest(appliedColumnFilters, debouncedColumnFilters),
        ),
      };

      const listUrl = buildAirImportBookedListUrl(offset, pageSize);
      const response = await apiCallProtected.post(listUrl, payload);
      const body = response as AirImportBookedListResponse;
      const list = Array.isArray(body.data) ? body.data : [];

      const total =
        typeof body.total === "number"
          ? body.total
          : typeof body.count === "number"
            ? body.count
            : list.length;
      setAirImportDsrTotalRecords(total);

      const mappedRows: AirImportDsrRow[] = list.map((item, idx) => ({
        __source: item,
        sr_no: String(offset + idx + 1),
        date: item?.date ?? "",
        sales_person: item?.sales_person ?? "",
        ref_number: item?.ref_number ?? "",
        line: item?.line ?? "",
        status: item?.status ?? "",
        customer: item?.customer ?? "",
        actual_consignee: item?.actual_consignee ?? "",
        shipper: item?.shipper ?? "",
        agent: item?.agent ?? "",
        pol: item?.pol ?? "",
        pod: item?.pod ?? "",
        terms: item?.terms ?? "",
        pqkgs:
          item?.pqkgs !== undefined && item.pqkgs !== null ? String(item.pqkgs) : "",
        gw: item?.gw !== undefined && item.gw !== null ? String(item.gw) : "",
        cw: item?.cw !== undefined && item.cw !== null ? String(item.cw) : "",
        hawb: item?.hawb_no ?? "",
        mawb: item?.mawb_no ?? "",
        etd: item?.etd ?? "",
        eta: item?.eta ?? "",
      }));

      setAirImportDsrRows(mappedRows);
      const originalEditable = new Map<string, Pick<AirImportDsrRow, AirImportDsrEditableKey>>();
      mappedRows.forEach((row) => {
        originalEditable.set(getAirImportDsrIdentityKeyFromRow(row), {
          status: row.status,
          ref_number: row.ref_number,
          hawb: row.hawb,
          mawb: row.mawb,
          etd: row.etd,
          eta: row.eta,
        });
      });
      airImportDsrOriginalEditableRef.current = originalEditable;
    } catch (error) {
      console.error("Failed to load air import DSR data:", error);
      setAirImportDsrRows([]);
      setAirImportDsrTotalRecords(0);
      toast.error("Failed to load Air import DSR data");
    } finally {
      setIsLoadingAirImportDsr(false);
    }
  }, [
    fromDate,
    toDate,
    airImportDsrPage,
    airImportDsrPageSize,
    debouncedSearch,
    appliedColumnFilters,
    debouncedColumnFilters,
  ]);

  const downloadCsv = useCallback(async () => {
    if (!fromDate || !toDate) {
      toast.error("Please select date range");
      return;
    }
    setIsDownloadingCsv(true);
    try {
      await downloadDsrCsv({
        endpoint: URL.airImportBooked,
        fileNamePrefix: "air-import-dsr",
        payload: {
          service_type: "import",
          date_from: dayjs(fromDate).format("YYYY-MM-DD"),
          date_to: dayjs(toDate).format("YYYY-MM-DD"),
          search: debouncedSearch.trim(),
          filters: buildImportBackendFiltersPayload(
            columnFiltersForApiRequest(appliedColumnFilters, debouncedColumnFilters),
          ),
        },
      });
    } catch (error) {
      console.error("Failed to download air import DSR CSV:", error);
      const err = error as { message?: string };
      toast.error(err?.message || "Failed to download CSV");
    } finally {
      setIsDownloadingCsv(false);
    }
  }, [fromDate, toDate, debouncedSearch, appliedColumnFilters, debouncedColumnFilters]);

  useEffect(() => {
    setAirImportDsrPage(1);
  }, [fromDate, toDate]);

  const lastDebouncedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRestoring) return;
    if (lastDebouncedSearchRef.current === null) {
      lastDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (lastDebouncedSearchRef.current === debouncedSearch) return;
    lastDebouncedSearchRef.current = debouncedSearch;
    setAirImportDsrPage(1);
  }, [debouncedSearch, isRestoring]);

  const lastDebouncedColumnFiltersRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRestoring) return;
    const serialized = JSON.stringify(debouncedColumnFilters);
    if (lastDebouncedColumnFiltersRef.current === null) {
      lastDebouncedColumnFiltersRef.current = serialized;
      return;
    }
    if (lastDebouncedColumnFiltersRef.current === serialized) return;
    lastDebouncedColumnFiltersRef.current = serialized;
    setAirImportDsrPage(1);
  }, [debouncedColumnFilters, isRestoring]);

  useEffect(() => {
    if (isRestoring) return;
    void fetchAirImportDsrData();
  }, [fetchAirImportDsrData, isRestoring]);

  const handleAirImportDsrFieldChange = useCallback(
    (identityKey: string, field: AirImportDsrColumnKey, value: string) => {
      setAirImportDsrRows((prev) =>
        prev.map((row) =>
          getAirImportDsrIdentityKeyFromRow(row) === identityKey
            ? { ...row, [field]: value }
            : row
        )
      );
    },
    []
  );

  const submitAirImportDsrUpdates = useCallback(async () => {
    try {
      setIsSubmittingAirImportDsr(true);
      const updates: Array<{
        booking_id: number | null;
        job_id: number | null;
        house_id: number | null;
        status?: string;
        ref_number?: string;
        hawb_no?: string;
        mawb_no?: string;
        etd?: string;
        eta?: string;
      }> = [];

      let skippedNoIds = 0;
      for (const row of airImportDsrRows) {
        const ids = getAirImportDsrIdsFromSource(row.__source);
        if (ids.booking_id == null && ids.job_id == null && ids.house_id == null) {
          skippedNoIds += 1;
          continue;
        }
        const identityKey = getAirImportDsrIdentityKeyFromRow(row);
        const original = airImportDsrOriginalEditableRef.current.get(identityKey);
        if (!original) continue;

        const changed: {
          status?: string;
          ref_number?: string;
          hawb_no?: string;
          mawb_no?: string;
          etd?: string;
          eta?: string;
        } = {};
        if (row.status !== original.status) changed.status = row.status;
        if (row.ref_number !== original.ref_number) changed.ref_number = row.ref_number;
        if (row.hawb !== original.hawb) changed.hawb_no = row.hawb;
        if (row.mawb !== original.mawb) changed.mawb_no = row.mawb;
        if (row.etd !== original.etd) changed.etd = row.etd;
        if (row.eta !== original.eta) changed.eta = row.eta;
        if (Object.keys(changed).length === 0) continue;

        updates.push({
          booking_id: ids.booking_id,
          job_id: ids.job_id,
          house_id: ids.house_id,
          ...changed,
        });
      }

      if (updates.length === 0) {
        if (skippedNoIds > 0) toast.error("Some rows have no IDs; cannot update them.");
        else toast("No changes to submit");
        return;
      }

      await apiCallProtected.patch(URL.airImportBooked, {
        service_type: "import",
        updates,
      });
      toast.success("Air import DSR updated");
      void fetchAirImportDsrData();
    } catch (error) {
      console.error("Failed to submit air import DSR updates:", error);
      toast.error("Failed to submit Air import DSR updates");
    } finally {
      setIsSubmittingAirImportDsr(false);
    }
  }, [airImportDsrRows, fetchAirImportDsrData]);

  const summary = {
    total: airImportDsrRows.length,
    active: airImportDsrRows.filter((r) => r.status?.toUpperCase() === "ACTIVE").length,
    closed: airImportDsrRows.filter((r) => r.status?.toUpperCase() === "CLOSED").length,
    cancel: airImportDsrRows.filter((r) => r.status?.toUpperCase() === "CANCEL").length,
  };

  const visibleColumnCount = useMemo(
    () => AIR_IMPORT_DSR_COLUMNS.filter((c) => visibleColumns[c.key]).length,
    [visibleColumns],
  );

  return (
    <ERPListScreen
      theme={theme}
      toolbar={{
        leading: (
          <>
            <ERPListStatPill theme={theme} icon={<IconStack2 size={14} />} value={summary.total} label="Total" />
            <ERPListStatPill theme={theme} icon={<IconCircleCheck size={14} />} value={summary.active} label="Active" iconBackground="#d1fae5" iconColor="#059669" />
            <ERPListStatPill theme={theme} icon={<IconClock size={14} />} value={summary.closed} label="Closed" iconBackground="#dbeafe" iconColor="#2563eb" />
            <ERPListStatPill theme={theme} icon={<IconX size={14} />} value={summary.cancel} label="Cancel" iconBackground="#fee2e2" iconColor="#dc2626" />
          </>
        ),
        actions: (
          <>
            <TextInput
              size="xs"
              leftSection={<IconSearch size={14} />}
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
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
              classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
              styles={{
                input: {
                  fontFamily: theme.fontSans,
                  fontSize: 12,
                  height: 32,
                  minHeight: 32,
                },
              }}
            />

            <ERPListColumnToggleMenu
              theme={theme}
              items={columnToggleItems}
              menuStyles={erpListGeistMenuDropdownStyles}
              classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
            />
            <Button
              variant="default"
              size="xs"
              leftSection={<IconFilter size={14} />}
              styles={erpToolbarOutlineButtonStyles(theme)}
              onClick={() => { setDraftFromDate(fromDate); setDraftToDate(toDate); setShowFilters((s) => !s); }}
            >
              Filters
            </Button>
            <Button
              variant="default"
              size="xs"
              leftSection={<IconDownload size={14} />}
              styles={erpToolbarOutlineButtonStyles(theme)}
              onClick={() => void downloadCsv()}
              loading={isDownloadingCsv}
              disabled={isLoadingAirImportDsr || !fromDate || !toDate}
            >
              Download
            </Button>
          </>
        ),
      }}
      filters={{
        opened: showFilters,
        title: "Filters",
        subtitle: "Refine DSR list by date range",
        onClose: () => setShowFilters(false),
        footer: (
          <ERPListFilterActionsFooter
            theme={theme}
            onClear={() => {
              const defFrom = dayjs().startOf("month").toDate();
              const defTo = dayjs().toDate();
              setDraftFromDate(defFrom);
              setDraftToDate(defTo);
              setFromDate(defFrom);
              setToDate(defTo);
              setAirImportDsrPage(1);
              setAppliedColumnFilters({});
              setEditingHeaderId(null);
              lastDebouncedColumnFiltersRef.current = "{}";
              clearAllStore(LIST_KEY);
            }}
            onApply={() => {
              setFromDate(draftFromDate);
              setToDate(draftToDate);
              setAirImportDsrPage(1);
              setShowFilters(false);
              const persisted: PersistedDsrFilters = {
                date_from: draftFromDate ? dayjs(draftFromDate).format("YYYY-MM-DD") : null,
                date_to: draftToDate ? dayjs(draftToDate).format("YYYY-MM-DD") : null,
                page: 1,
                pageSize: airImportDsrPageSize,
                column_filters: appliedColumnFilters,
              };
              setStoreFilters(LIST_KEY, persisted);
              setStoreSearch(LIST_KEY, search);
            }}
          />
        ),
        children: (
          <Group align="end" gap="sm">
            <SingleDateInput
              label="From date"
              value={draftFromDate}
              onChange={setDraftFromDate}
              size="xs"
              classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={compactFilterFieldStyles}
            />
            <SingleDateInput
              label="To date"
              value={draftToDate}
              onChange={setDraftToDate}
              size="xs"
              classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={compactFilterFieldStyles}
            />
          </Group>
        ),
      }}
      table={{
        footer: (
          <Box
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${DSR_BORDER}`,
              background: DSR_FOOTER_BG,
              padding: "6px 14px",
              marginTop: 4,
            }}
          >
            <PaginationBar
              pageSize={airImportDsrPageSize}
              currentPage={airImportDsrPage}
              totalRecords={airImportDsrTotalRecords}
              onPageSizeChange={(size) => {
                setAirImportDsrPageSize(size);
                setAirImportDsrPage(1);
              }}
              onPageChange={setAirImportDsrPage}
              trailing={
                <Button
                  size="xs"
                  color={DSR_PRIMARY}
                  onClick={() => void submitAirImportDsrUpdates()}
                  loading={isSubmittingAirImportDsr}
                  disabled={isLoadingAirImportDsr || airImportDsrRows.length === 0}
                >
                  Submit changes
                </Button>
              }
            />
          </Box>
        ),
        children: (
          <Box style={AIR_IMPORT_DSR_TABLE_BODY}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "4px 4px",
                minWidth: 1280,
              }}
            >
              <thead>
                <tr>
                  {AIR_IMPORT_DSR_COLUMNS.filter((column) => visibleColumns[column.key]).map((column) => {
                    const w = column.width ?? 80;
                    const isDateHeader = column.key === "etd" || column.key === "eta";
                    const isFilterable = !IMPORT_NON_FILTERABLE_COLUMN_KEYS.has(column.key);
                    return (
                      <th key={column.key} style={mergeTh(w, w)}>
                        {!isFilterable ? (
                          column.label
                        ) : isDateHeader ? (
                          <ERPListColumnHeaderFilter
                            label={column.label}
                            value={appliedColumnFilters[column.key] ?? ""}
                            displayValue={formatFilterDateLabel(
                              appliedColumnFilters[column.key] ?? "",
                            )}
                            theme={theme}
                            isEditing={editingHeaderId === column.key}
                            onStartEdit={() => openHeaderEditor(column.key)}
                            onStopEdit={() => collapseHeaderEditor(column.key)}
                            onChange={() => {}}
                            renderEditor={({ autoFocus, onClose }) => (
                              <SingleDateInput
                                size="xs"
                                value={
                                  appliedColumnFilters[column.key]
                                    ? dayjs(appliedColumnFilters[column.key]).toDate()
                                    : null
                                }
                                onChange={(date) => {
                                  commitColumnFilter({
                                    [column.key]: date ? dayjs(date).format("YYYY-MM-DD") : "",
                                  });
                                  if (date) onClose();
                                }}
                                classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                styles={compactFilterFieldStyles}
                                {...(autoFocus ? { autoFocus: true } : {})}
                              />
                            )}
                          />
                        ) : (
                          <ERPListColumnHeaderFilter
                            label={column.label}
                            value={appliedColumnFilters[column.key] ?? ""}
                            displayValue={appliedColumnFilters[column.key] ?? ""}
                            theme={theme}
                            placeholder={`Filter ${column.label}`}
                            isEditing={editingHeaderId === column.key}
                            onStartEdit={() => openHeaderEditor(column.key)}
                            onStopEdit={() => collapseHeaderEditor(column.key)}
                            onChange={(next) => commitColumnFilter({ [column.key]: next })}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isRestoring || isLoadingAirImportDsr ? (
                  <tr>
                    <td colSpan={Math.max(1, visibleColumnCount)}>
                      <Flex
                        py={48}
                        gap={8}
                        justify="center"
                        align="center"
                        className="erp-header-filter-fade"
                        style={{
                          width: "calc(100vw - 150px)",
                          position: "sticky",
                          left: 0,
                        }}
                      >
                        <Loader color={theme.primary} />

                        <Text
                          size="sm"
                          c="dimmed"
                          style={{ fontFamily: theme.fontSans }}
                        >
                          Loading air import DSR…
                        </Text>
                      </Flex>
                    </td>
                  </tr>
                ) : airImportDsrRows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, visibleColumnCount)}>
                      <Flex
                        justify="center"
                        align="center"
                        style={{
                          minHeight: 200,
                          width: "calc(100vw - 150px)",
                          position: "sticky",
                          left: 0,
                        }}
                      >
                        <Text size="sm" c="dimmed">
                          No data available
                        </Text>
                      </Flex>
                    </td>
                  </tr>
                ) : (
                  airImportDsrRows.map((row, rowIndex) => {
                    const identityKey =
                      getAirImportDsrIdentityKeyFromRow(row) || `row-${row.sr_no}-${rowIndex}`;
                    return (
                      <tr key={identityKey}>
                        {AIR_IMPORT_DSR_COLUMNS.filter((column) => visibleColumns[column.key]).map((column) => (
                          <td
                            key={`${identityKey}-${column.key}`}
                            style={{
                              padding: "0px",
                              borderBottom: "1px solid #f1f5f9",
                              width: column.width,
                              maxWidth: column.width,
                            }}
                          >
                            {AIR_IMPORT_DSR_TEXT_EDITABLE_KEYS.has(
                              column.key as "status" | "ref_number" | "hawb" | "mawb"
                            ) ? (
                              <FormTextInput
                                value={airImportDsrRowScalar(row, column.key)}
                                onChange={(event) =>
                                  handleAirImportDsrFieldChange(
                                    identityKey,
                                    column.key,
                                    event.currentTarget.value
                                  )
                                }
                                format="normal"
                                size="xs"
                                styles={{
                                  input: {
                                    width: column.width ?? 120,
                                    minWidth: column.width ?? 120,
                                    fontSize: 11,
                                    height: 26,
                                  },
                                }}
                              />
                            ) : column.key === "etd" || column.key === "eta" ? (
                              <SingleDateInput
                                value={(() => {
                                  const s = airImportDsrRowScalar(row, column.key);
                                  if (!s.trim()) return null;
                                  const d = dayjs(s);
                                  return d.isValid() ? d.toDate() : null;
                                })()}
                                onChange={(date) =>
                                  handleAirImportDsrFieldChange(
                                    identityKey,
                                    column.key,
                                    date ? dayjs(date).format("YYYY-MM-DD") : ""
                                  )
                                }
                                size="xs"
                                styles={{
                                  input: {
                                    width: column.width ?? 110,
                                    minWidth: column.width ?? 110,
                                    fontSize: 11,
                                    height: 26,
                                  },
                                }}
                              />
                            ) : column.key === "date" ? (
                              <SingleDateInput
                                value={(() => {
                                  const s = airImportDsrRowScalar(row, column.key);
                                  if (!s.trim()) return null;
                                  const d = dayjs(s);
                                  return d.isValid() ? d.toDate() : null;
                                })()}
                                onChange={() => {}}
                                size="xs"
                                readOnly
                                styles={{
                                  input: {
                                    width: column.width ?? 110,
                                    minWidth: column.width ?? 110,
                                    fontSize: 11,
                                    height: 26,
                                    backgroundColor: "#f8fafc",
                                    borderColor: "#dbe4ff",
                                  },
                                }}
                              />
                            ) : (
                              (() => {
                                const cellValue = airImportDsrRowScalar(row, column.key);
                                const input = (
                                  <FormTextInput
                                    value={cellValue}
                                    format="normal"
                                    size="xs"
                                    readOnly
                                    styles={{
                                      input: {
                                        width: column.width ?? 120,
                                        minWidth: column.width ?? 120,
                                        fontSize: 11,
                                        height: 26,
                                        textAlign: column.key === "sr_no" ? "center" : "left",
                                        backgroundColor: "#f8fafc",
                                        borderColor: "#dbe4ff",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      },
                                    }}
                                  />
                                );
                                if (
                                  IMPORT_NAME_TOOLTIP_KEYS.has(column.key) &&
                                  cellValue.trim()
                                ) {
                                  return (
                                    <Tooltip
                                      label={cellValue}
                                      withArrow
                                      multiline
                                      maw={420}
                                      openDelay={300}
                                    >
                                      <Box style={{ maxWidth: "100%" }}>{input}</Box>
                                    </Tooltip>
                                  );
                                }
                                return input;
                              })()
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Box>
        ),
      }}
    />
  );
}

