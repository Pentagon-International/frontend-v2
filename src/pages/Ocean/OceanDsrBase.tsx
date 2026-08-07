import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from "react";
import { Box, Center, Flex, Group, Text, Button, TextInput, ActionIcon, Loader, Tooltip } from "@mantine/core";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { IconSearch, IconFilter, IconStack2, IconCircleCheck, IconClock, IconX, IconDownload } from "@tabler/icons-react";
import { useLocation } from "react-router-dom";
import { useDebouncedValue } from "@mantine/hooks";
import { apiCallProtected } from "../../api/axios";
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

const DSR_PRIMARY = "#105476";
const DSR_BORDER = "#e2e8f0";
const DSR_FOOTER_BG = "#f8fafc";

const TABLE_BODY: CSSProperties = {
  flex: 1,
  minHeight: 0,
  maxHeight: "70vh",
  overflow: "auto",
  padding: "12px 16px",
};

const COLUMNS = [
  { key: "sr_no", label: "S.No", width: 55 },
{ key: "booking_no", label: "Booking No.", width: 120 },
{ key: "nomination_date", label: "Nomination Date", width: 120 },
{ key: "sales_person", label: "Sales Person", width: 100 },
{ key: "cnee", label: "Cnee", width: 120 },
{ key: "shipper", label: "Shipper", width: 120 },
{ key: "agent", label: "Agent", width: 110 },
{ key: "equip", label: "Equip", width: 80 },
{ key: "lcl_fcl", label: "Lcl/Fcl", width: 80 },
{ key: "pol", label: "POL", width: 90 },
{ key: "pod", label: "POD", width: 90 },
{ key: "terms", label: "Terms", width: 80 },
{ key: "etd", label: "ETD", width: 105 },
{ key: "eta", label: "ETA", width: 105 },
{ key: "vsl_name", label: "Vsl Name", width: 120 },
{ key: "container_number", label: "Container Number", width: 130 },
{ key: "remark", label: "Remark", width: 120 },
{ key: "row_type", label: "Row Type", width: 90 },
{ key: "status", label: "Status", width: 90 },
{ key: "buy_rates", label: "Buy Rates", width: 90 },
{ key: "sell_rates", label: "Sell Rates", width: 90 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
type Row = Record<ColumnKey, string> & { __source?: Record<string, unknown> };
type EditableKey = "etd" | "eta" | "remark";

const OCEAN_NAME_TOOLTIP_KEYS = new Set<ColumnKey>(["shipper", "cnee"]);

const OCEAN_DATE_FILTER_COLUMN_KEYS = new Set<ColumnKey>(["etd", "eta"]);

/**
 * Backend `filters` keys for ocean DSR (matches API).
 * `nomination_date` is handled by the date-range drawer, not column headers.
 */
const OCEAN_BACKEND_FILTER_KEYS = [
  "booking_no",
  "cnee",
  "shipper",
  "equip",
  "lcl_fcl",
  "pol",
  "pod",
  "terms",
  "etd",
  "eta",
  "vsl_name",
  "container_number",
  "remarks",
  "row_type",
  "status",
] as const;

type OceanBackendFilterKey = (typeof OCEAN_BACKEND_FILTER_KEYS)[number];

type OceanExtendedFilterKey =
  | OceanBackendFilterKey
  | "sales_person"
  | "agent"
  | "buy_rates"
  | "sell_rates";

const OCEAN_COLUMN_TO_BACKEND_FILTER_KEY: Partial<
  Record<ColumnKey, OceanExtendedFilterKey>
> = {
  booking_no: "booking_no",
  sales_person: "sales_person",
  cnee: "cnee",
  shipper: "shipper",
  agent: "agent",
  equip: "equip",
  lcl_fcl: "lcl_fcl",
  pol: "pol",
  pod: "pod",
  terms: "terms",
  etd: "etd",
  eta: "eta",
  vsl_name: "vsl_name",
  container_number: "container_number",
  remark: "remarks",
  row_type: "row_type",
  status: "status",
  buy_rates: "buy_rates",
  sell_rates: "sell_rates",
};

const OCEAN_NON_FILTERABLE_COLUMN_KEYS = new Set<ColumnKey>([
  "sr_no",
  "nomination_date",
]);

function oceanColumnKeyToBackendFilterKey(
  columnKey: ColumnKey,
): OceanExtendedFilterKey | null {
  if (OCEAN_NON_FILTERABLE_COLUMN_KEYS.has(columnKey)) return null;
  return OCEAN_COLUMN_TO_BACKEND_FILTER_KEY[columnKey] ?? null;
}

function buildOceanBackendFiltersPayload(
  applied: Partial<Record<ColumnKey, string>>,
): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const [columnKey, raw] of Object.entries(applied) as [ColumnKey, string][]) {
    const backendKey = oceanColumnKeyToBackendFilterKey(columnKey);
    if (!backendKey) continue;
    const v = String(raw ?? "").trim();
    if (v) filters[backendKey] = v;
  }
  return filters;
}

function columnFiltersForApiRequest(
  applied: Partial<Record<ColumnKey, string>>,
  debounced: Partial<Record<ColumnKey, string>>,
): Partial<Record<ColumnKey, string>> {
  const appliedActive = Object.values(applied).some((v) => String(v ?? "").trim() !== "");
  const debouncedActive = Object.values(debounced).some((v) => String(v ?? "").trim() !== "");
  if (!appliedActive && debouncedActive) return applied;
  return debounced;
}

type PersistedDsrFilters = {
  date_from?: string | null;
  date_to?: string | null;
  page?: number;
  pageSize?: number;
  column_filters?: Partial<Record<ColumnKey, string>>;
};

function getIdentity(source: unknown): string {
  const src = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const bookingId = src["booking_id"] ?? "";
  const jobId = src["job_id"] ?? "";
  const houseId = src["house_id"] ?? "";
  return `${bookingId}|${jobId}|${houseId}`;
}

function parseDateValue(value: string): Date | null {
  if (!value.trim()) return null;
  const d = dayjs(value);
  return d.isValid() ? d.toDate() : null;
}

function asString(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

type Props = {
  title: string;
  endpoint: string;
  serviceType: "import" | "export";
};

export default function OceanDsrBase({ title, endpoint, serviceType }: Props) {
  const location = useLocation();
  const LIST_KEY = useMemo(
    () => `OCEAN_${serviceType.toUpperCase()}_DSR`,
    [serviceType],
  );

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

  const [fromDate, setFromDate] = useState<Date | null>(() => dayjs().startOf("month").toDate());
  const [toDate, setToDate] = useState<Date | null>(() => dayjs().toDate());
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFromDate, setDraftFromDate] = useState<Date | null>(fromDate);
  const [draftToDate, setDraftToDate] = useState<Date | null>(toDate);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>,
  );
  const [appliedColumnFilters, setAppliedColumnFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [debouncedColumnFilters] = useDebouncedValue(appliedColumnFilters, 1000);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const originalEditableRef = useRef<Map<string, Pick<Row, EditableKey>>>(new Map());

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
    (nextColumnFilters: Partial<Record<ColumnKey, string>>, nextPage: number) => {
      setStoreFilters(LIST_KEY, {
        date_from: fromDate ? dayjs(fromDate).format("YYYY-MM-DD") : null,
        date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : null,
        page: nextPage,
        pageSize,
        column_filters: nextColumnFilters,
      });
    },
    [fromDate, toDate, pageSize, setStoreFilters, LIST_KEY],
  );

  const commitColumnFilter = useCallback(
    (patch: Partial<Record<ColumnKey, string>>) => {
      setAppliedColumnFilters((prev) => {
        const next: Partial<Record<ColumnKey, string>> = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          const key = k as ColumnKey;
          if (key === "sr_no") continue;
          const trimmed = String(v ?? "").trim();
          if (!trimmed) delete next[key];
          else next[key] = trimmed;
        }
        persistDsrListState(next, 1);
        return next;
      });
      setPage(1);
    },
    [persistDsrListState],
  );

  const columnToggleItems = useMemo(
    () =>
      COLUMNS.map((column) => ({
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

  const visibleColumnCount = useMemo(
    () => COLUMNS.filter((c) => visibleColumns[c.key]).length,
    [visibleColumns],
  );

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

    if (stored?.filters && typeof stored.filters === "object") {
      const f = stored.filters as PersistedDsrFilters;
      const fd = f.date_from ? dayjs(f.date_from, "YYYY-MM-DD") : null;
      const td = f.date_to ? dayjs(f.date_to, "YYYY-MM-DD") : null;
      if (fd?.isValid()) {
        setFromDate(fd.toDate());
        setDraftFromDate(fd.toDate());
      }
      if (td?.isValid()) {
        setToDate(td.toDate());
        setDraftToDate(td.toDate());
      }
      if (typeof f.page === "number" && f.page > 0) setPage(f.page);
      if (typeof f.pageSize === "number" && f.pageSize > 0) setPageSize(f.pageSize);
      if (f.column_filters && typeof f.column_filters === "object") {
        setAppliedColumnFilters(f.column_filters as Partial<Record<ColumnKey, string>>);
      }
    }

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!fromDate || !toDate) return;

      const size = Math.max(1, Math.trunc(Number(pageSize)) || 25);
      const currentPage = Math.max(1, Math.trunc(Number(page)) || 1);
      const offset = (currentPage - 1) * size;
      const listUrl = `${endpoint}?index=${offset}&limit=${size}`;

      const payload = {
        service_type: serviceType,
        date_from: dayjs(fromDate).format("YYYY-MM-DD"),
        date_to: dayjs(toDate).format("YYYY-MM-DD"),
        search: debouncedSearch.trim(),
        filters: buildOceanBackendFiltersPayload(
          columnFiltersForApiRequest(appliedColumnFilters, debouncedColumnFilters),
        ),
      };

      const response = await apiCallProtected.post(listUrl, payload);
      const body = response as { data?: Record<string, unknown>[]; total?: number; count?: number };
      const list = Array.isArray(body.data) ? body.data : [];
      setTotalRecords(
        typeof body.total === "number"
          ? body.total
          : typeof body.count === "number"
            ? body.count
            : list.length,
      );

      const mapped: Row[] = list.map((item, idx) => ({
        __source: item,
        sr_no: String(offset + idx + 1),
        booking_no: asString(item["booking_no"] ?? item["ref_number"]),
        nomination_date: asString(item["nomination_date"] ?? item["date"]),
        sales_person: asString(item["sales_person"]),
        cnee: asString(item["cnee"] ?? item["actual_consignee"]),
        shipper: asString(item["shipper"]),
        agent: asString(item["agent"]),
        equip: asString(item["equip"]),
        lcl_fcl: asString(item["lcl_fcl"]),
        pol: asString(item["pol"]),
        pod: asString(item["pod"]),
        terms: asString(item["terms"]),
        etd: asString(item["etd"]),
        eta: asString(item["eta"]),
        vsl_name: asString(item["vsl_name"]),
        container_number: asString(item["container_number"]),
        remark: asString(item["remark"] ?? item["remarks"]),
        row_type: asString(item["row_type"]),
        status: asString(item["status"]),
        buy_rates: asString(item["buy_rates"] ?? item["buy"]),
        sell_rates: asString(item["sell_rates"] ?? item["sell"]),
      }));
      setRows(mapped);

      const original = new Map<string, Pick<Row, EditableKey>>();
      mapped.forEach((row) => {
        original.set(getIdentity(row.__source), { etd: row.etd, eta: row.eta, remark: row.remark });
      });
      originalEditableRef.current = original;
    } catch (error) {
      console.error(`Failed to load ${title}:`, error);
      setRows([]);
      setTotalRecords(0);
      toast.error(`Failed to load ${title}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    fromDate,
    toDate,
    page,
    pageSize,
    endpoint,
    serviceType,
    title,
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
        endpoint,
        fileNamePrefix: `ocean-${serviceType}-dsr`,
        payload: {
          service_type: serviceType,
          date_from: dayjs(fromDate).format("YYYY-MM-DD"),
          date_to: dayjs(toDate).format("YYYY-MM-DD"),
          search: debouncedSearch.trim(),
          filters: buildOceanBackendFiltersPayload(
            columnFiltersForApiRequest(appliedColumnFilters, debouncedColumnFilters),
          ),
        },
      });
    } catch (error) {
      console.error(`Failed to download ${title} CSV:`, error);
      const err = error as { message?: string };
      toast.error(err?.message || "Failed to download CSV");
    } finally {
      setIsDownloadingCsv(false);
    }
  }, [
    fromDate,
    toDate,
    endpoint,
    serviceType,
    title,
    debouncedSearch,
    appliedColumnFilters,
    debouncedColumnFilters,
  ]);

  useEffect(() => setPage(1), [fromDate, toDate]);

  const lastDebouncedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRestoring) return;
    if (lastDebouncedSearchRef.current === null) {
      lastDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (lastDebouncedSearchRef.current === debouncedSearch) return;
    lastDebouncedSearchRef.current = debouncedSearch;
    setPage(1);
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
    setPage(1);
  }, [debouncedColumnFilters, isRestoring]);

  useEffect(() => {
    if (isRestoring) return;
    void fetchData();
  }, [fetchData, isRestoring]);

  const onFieldChange = useCallback((identity: string, field: ColumnKey, value: string) => {
    setRows((prev) =>
      prev.map((row) => (getIdentity(row.__source) === identity ? { ...row, [field]: value } : row)),
    );
  }, []);

  const summary = {
    total: rows.length,
    active: rows.filter((r) => String(r.__source?.status ?? "").toUpperCase() === "ACTIVE").length,
    closed: rows.filter((r) => String(r.__source?.status ?? "").toUpperCase() === "CLOSED").length,
    cancel: rows.filter((r) => String(r.__source?.status ?? "").toUpperCase() === "CANCEL").length,
  };

  const submitUpdates = useCallback(async () => {
    try {
      setIsSubmitting(true);
      const updates: Record<string, unknown>[] = [];
      rows.forEach((row) => {
        const identity = getIdentity(row.__source);
        const original = originalEditableRef.current.get(identity);
        if (!original) return;
        const source = row.__source ?? {};
        const changed: Record<string, unknown> = {};
        if (row.etd !== original.etd) changed.etd = row.etd;
        if (row.eta !== original.eta) changed.eta = row.eta;
        if (row.remark !== original.remark) changed.remarks = row.remark;
        if (Object.keys(changed).length === 0) return;
        updates.push({
          booking_id: source["booking_id"] ?? null,
          job_id: source["job_id"] ?? null,
          house_id: source["house_id"] ?? null,
          ...changed,
        });
      });
      if (updates.length === 0) {
        toast("No changes to submit");
        return;
      }
      await apiCallProtected.patch(endpoint, {
        service_type: serviceType,
        updates,
      });
      toast.success(`${title} updated`);
      void fetchData();
    } catch (error) {
      console.error(`Failed to update ${title}:`, error);
      toast.error(`Failed to submit ${title} updates`);
    } finally {
      setIsSubmitting(false);
    }
  }, [rows, fetchData, endpoint, serviceType, title]);

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
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
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
              onClick={() => {
                setDraftFromDate(fromDate);
                setDraftToDate(toDate);
                setShowFilters((s) => !s);
              }}
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
              disabled={isLoading || !fromDate || !toDate}
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
              setSearch("");
              setPage(1);
              setAppliedColumnFilters({});
              setEditingHeaderId(null);
              lastDebouncedColumnFiltersRef.current = "{}";
              clearAllStore(LIST_KEY);
            }}
            onApply={() => {
              setFromDate(draftFromDate);
              setToDate(draftToDate);
              setPage(1);
              setShowFilters(false);
              const persisted: PersistedDsrFilters = {
                date_from: draftFromDate ? dayjs(draftFromDate).format("YYYY-MM-DD") : null,
                date_to: draftToDate ? dayjs(draftToDate).format("YYYY-MM-DD") : null,
                page: 1,
                pageSize,
                column_filters: appliedColumnFilters,
              };
              setStoreFilters(LIST_KEY, persisted);
              setStoreSearch(LIST_KEY, search);
            }}
            applyLabel="Apply Filters"
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
              pageSize={pageSize}
              currentPage={page}
              totalRecords={totalRecords}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onPageChange={setPage}
              trailing={
                <Button
                  size="xs"
                  color={DSR_PRIMARY}
                  onClick={() => void submitUpdates()}
                  loading={isSubmitting}
                  disabled={isLoading || rows.length === 0}
                >
                  Submit changes
                </Button>
              }
            />
          </Box>
        ),
        children: (
          <Box style={TABLE_BODY}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "4px 4px",
                minWidth: 1940,
              }}
            >
              <thead>
                <tr>
                  {COLUMNS.filter((column) => visibleColumns[column.key]).map((column) => {
                    const w = column.width ?? 80;
                    const isDateHeader = OCEAN_DATE_FILTER_COLUMN_KEYS.has(column.key);
                    const isFilterable = !OCEAN_NON_FILTERABLE_COLUMN_KEYS.has(column.key);
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
                {isRestoring || isLoading ? (
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
                        <Text size="sm" c="dimmed" style={{ fontFamily: theme.fontSans }}>
                          Loading {title}…
                        </Text>
                      </Flex>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
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
                  rows.map((row, rowIndex) => {
                    const identity = getIdentity(row.__source) || `row-${row.sr_no}-${rowIndex}`;
                    return (
                      <tr key={identity}>
                        {COLUMNS.filter((c) => visibleColumns[c.key]).map((column) => (
                          <td
                            key={`${identity}-${column.key}`}
                            style={{
                              padding: "0px",
                              borderBottom: "1px solid #f1f5f9",
                              width: column.width,
                              maxWidth: column.width,
                            }}
                          >
                            {column.key === "etd" ||
                            column.key === "eta" ||
                            column.key === "nomination_date" ? (
                              <SingleDateInput
                                value={parseDateValue(row[column.key])}
                                onChange={(d) => {
                                  if (column.key === "etd" || column.key === "eta")
                                    onFieldChange(
                                      identity,
                                      column.key,
                                      d ? dayjs(d).format("YYYY-MM-DD") : "",
                                    );
                                }}
                                size="xs"
                                readOnly={column.key !== "etd" && column.key !== "eta"}
                                styles={{
                                  input: {
                                    width: column.width ?? 110,
                                    minWidth: column.width ?? 110,
                                    fontSize: 11,
                                    height: 26,
                                    ...(column.key !== "etd" && column.key !== "eta"
                                      ? { backgroundColor: "#f8fafc", borderColor: "#dbe4ff" }
                                      : {}),
                                  },
                                }}
                              />
                            ) : column.key === "remark" ? (
                              <FormTextInput
                                value={row[column.key]}
                                onChange={(event) =>
                                  onFieldChange(identity, column.key, event.currentTarget.value)
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
                            ) : (
                              (() => {
                                const cellValue = row[column.key];
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
                                  OCEAN_NAME_TOOLTIP_KEYS.has(column.key) &&
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
