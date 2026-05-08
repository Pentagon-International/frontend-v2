import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { Box, Flex, Group, Text, Button, TextInput, Menu, Checkbox, ActionIcon } from "@mantine/core";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { IconSearch, IconFilter, IconStack2, IconCircleCheck, IconClock, IconX, IconSettings } from "@tabler/icons-react";
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
import { ERPListTableLoading } from "../../components/ERPListPage/ERPListTableLoading";
import { DEFAULT_ERP_LIST_THEME } from "../../components/ERPListPage/erpListTheme";
import { erpToolbarOutlineButtonStyles } from "../../components";
import { useListFilterStore } from "../../store/listFilterStore";

const LIST_KEY = "AIR_EXPORT_DSR";

type PersistedDsrFilters = {
  date_from: string | null;
  date_to: string | null;
  page: number;
  pageSize: number;
};

function buildListUrl(offset: number, limit: number): string {
  // Air Import & Export DSR share the same endpoint; service_type in the payload
  // distinguishes between them.
  return `${URL.airImportBooked}?index=${offset}&limit=${limit}`;
}

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
  { key: "sr_no", label: "Sr. No.", width: 60 },
  { key: "shipment_received_date", label: "Shipment received Date", width: 140 },
  { key: "sales_person", label: "Sales Person", width: 110 },
  { key: "enq_reference_no", label: "Enq.Reference No.", width: 130 },
  { key: "customer_name", label: "Customer Name", width: 140 },
  { key: "shipper_name", label: "Shipper Name", width: 140 },
  { key: "cnee_name", label: "Cnee Name", width: 130 },
  { key: "overseas_agent", label: "OverseasAgent", width: 130 },
  { key: "pol", label: "POL", width: 80 },
  { key: "pod", label: "POD", width: 80 },
  { key: "terms", label: "Terms", width: 90 },
  { key: "pkgs", label: "Pkgs", width: 90 },
  { key: "weight_in_kg", label: "Weight in Kg", width: 110 },
  { key: "shipping_bill_number_date", label: "Shipping Bill Number/Date", width: 170 },
  { key: "invoice_number_date", label: "Invocie No./Date", width: 150 },
  { key: "hawb", label: "HAWB", width: 110 },
  { key: "mawb", label: "MAWB", width: 110 },
  { key: "etd", label: "ETD", width: 110 },
  { key: "eta", label: "ETA", width: 110 },
  { key: "haz_non_haz", label: "HAZ/Non Haz", width: 110 },
  { key: "iata", label: "IATA", width: 90 },
  { key: "remark", label: "Remark", width: 130 },
  { key: "shipment_status", label: "Shipment Status", width: 130 },
  { key: "job_number", label: "JOB Number", width: 120 },
  { key: "job_month", label: "JOB MONTH", width: 110 },
  { key: "job_submitted_date", label: "JOB SUBMITTED DATE", width: 150 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
type Row = Record<ColumnKey, string> & { __source?: Record<string, unknown> };
type EditableKey = "etd" | "eta" | "remark" | "shipment_status" | "hawb" | "mawb";

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

export default function AirExportDsr() {
  const location = useLocation();
  const getStoreState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [fromDate, setFromDate] = useState<Date | null>(() => dayjs().startOf("month").toDate());
  const [toDate, setToDate] = useState<Date | null>(() => dayjs().toDate());
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFromDate, setDraftFromDate] = useState<Date | null>(fromDate);
  const [draftToDate, setDraftToDate] = useState<Date | null>(toDate);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((column) => [column.key, true])) as Record<ColumnKey, boolean>
  );
  const [isRestoring, setIsRestoring] = useState(true);
  const originalEditableRef = useRef<Map<string, Pick<Row, EditableKey>>>(new Map());

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
      if (typeof f.page === "number" && f.page > 0) setPage(f.page);
      if (typeof f.pageSize === "number" && f.pageSize > 0) setPageSize(f.pageSize);
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
      const listUrl = buildListUrl(offset, size);
      const payload: Record<string, string> = {
        service_type: "export",
        date_from: dayjs(fromDate).format("YYYY-MM-DD"),
        date_to: dayjs(toDate).format("YYYY-MM-DD"),
      };
      if (debouncedSearch.trim()) payload.search = debouncedSearch.trim();

      const response = await apiCallProtected.post(listUrl, payload);
      const body = response as { data?: Record<string, unknown>[]; total?: number; count?: number };
      const list = Array.isArray(body.data) ? body.data : [];
      setTotalRecords(typeof body.total === "number" ? body.total : typeof body.count === "number" ? body.count : list.length);

      const mapped: Row[] = list.map((item, idx) => ({
        __source: item,
        sr_no: String(offset + idx + 1),
        shipment_received_date: asString(item["shipment_received_date"] ?? item["date"]),
        sales_person: asString(item["sales_person"]),
        enq_reference_no: asString(item["enq_reference_no"] ?? item["ref_number"]),
        customer_name: asString(item["customer_name"] ?? item["customer"]),
        shipper_name: asString(item["shipper_name"] ?? item["shipper"]),
        cnee_name: asString(item["cnee_name"] ?? item["actual_consignee"]),
        overseas_agent: asString(item["overseas_agent"] ?? item["agent"]),
        pol: asString(item["pol"]),
        pod: asString(item["pod"]),
        terms: asString(item["terms"]),
        pkgs: asString(item["pkgs"] ?? item["pqkgs"]),
        weight_in_kg: asString(item["weight_in_kg"] ?? item["gw"]),
        shipping_bill_number_date: asString(item["shipping_bill_number_date"]),
        invoice_number_date: asString(item["invoice_number_date"]),
        hawb: asString(item["hawb"] ?? item["hawb_no"]),
        mawb: asString(item["mawb"] ?? item["mawb_no"]),
        etd: asString(item["etd"]),
        eta: asString(item["eta"]),
        haz_non_haz: asString(item["haz_non_haz"]),
        iata: asString(item["iata"]),
        remark: asString(item["remark"] ?? item["remarks"]),
        shipment_status: asString(item["shipment_status"] ?? item["status"]),
        job_number: asString(item["job_number"]),
        job_month: asString(item["job_month"]),
        job_submitted_date: asString(item["job_submitted_date"]),
      }));
      setRows(mapped);

      const original = new Map<string, Pick<Row, EditableKey>>();
      mapped.forEach((row) => {
        original.set(getIdentity(row.__source), {
          etd: row.etd,
          eta: row.eta,
          remark: row.remark,
          shipment_status: row.shipment_status,
          hawb: row.hawb,
          mawb: row.mawb,
        });
      });
      originalEditableRef.current = original;
    } catch (error) {
      console.error("Failed to load air export DSR data:", error);
      setRows([]);
      setTotalRecords(0);
      toast.error("Failed to load Air export DSR data");
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, page, pageSize, debouncedSearch]);

  useEffect(() => setPage(1), [fromDate, toDate]);

  // Reset to first page whenever the search term changes (after debounce).
  // Skip the initial value (and any restore-driven update) so we don't clobber a restored page.
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

  useEffect(() => {
    if (isRestoring) return;
    void fetchData();
  }, [fetchData, isRestoring]);

  const onFieldChange = useCallback((identity: string, field: ColumnKey, value: string) => {
    setRows((prev) => prev.map((row) => (getIdentity(row.__source) === identity ? { ...row, [field]: value } : row)));
  }, []);

  // Search is now applied server-side via the API payload; render rows directly.
  const filteredRows = rows;

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
        if (row.remark !== original.remark) changed.remark = row.remark;
        if (row.shipment_status !== original.shipment_status) changed.status = row.shipment_status;
        if (row.hawb !== original.hawb) changed.hawb_no = row.hawb;
        if (row.mawb !== original.mawb) changed.mawb_no = row.mawb;
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
      await apiCallProtected.patch(URL.airImportBooked, {
        service_type: "export",
        updates,
      });
      toast.success("Air export DSR updated");
      void fetchData();
    } catch (error) {
      console.error("Failed to update air export DSR:", error);
      toast.error("Failed to submit Air export DSR updates");
    } finally {
      setIsSubmitting(false);
    }
  }, [rows, fetchData]);

  const theme = DEFAULT_ERP_LIST_THEME;
  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.shipment_status?.toUpperCase() === "ACTIVE").length,
    closed: rows.filter((r) => r.shipment_status?.toUpperCase() === "CLOSED").length,
    cancel: rows.filter((r) => r.shipment_status?.toUpperCase() === "CANCEL").length,
  };

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
              placeholder="Search..."
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
            />
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <Button
                  variant="default"
                  size="xs"
                  leftSection={<IconSettings size={14} />}
                  styles={erpToolbarOutlineButtonStyles(theme)}
                >
                  Columns
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {COLUMNS.map((column) => (
                  <Menu.Item key={column.key} closeMenuOnClick={false}>
                    <Checkbox label={column.label} checked={visibleColumns[column.key]} onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [column.key]: e.currentTarget.checked }))} />
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="default"
              size="xs"
              leftSection={<IconFilter size={14} />}
              styles={erpToolbarOutlineButtonStyles(theme)}
              onClick={() => { setDraftFromDate(fromDate); setDraftToDate(toDate); setShowFilters((s) => !s); }}
            >
              Filters
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
              setPage(1);
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
              };
              setStoreFilters(LIST_KEY, persisted);
              setStoreSearch(LIST_KEY, search);
            }}
          />
        ),
        children: (
          <Group align="end" gap="sm">
            <SingleDateInput label="From date" value={draftFromDate} onChange={setDraftFromDate} size="xs" />
            <SingleDateInput label="To date" value={draftToDate} onChange={setDraftToDate} size="xs" />
          </Group>
        ),
      }}
      table={{
        footer: (
          <Box style={{ flexShrink: 0, borderTop: `1px solid ${DSR_BORDER}`, background: DSR_FOOTER_BG, padding: "6px 14px", marginTop: 4 }}>
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Box style={{ flex: "1 1 320px", minWidth: 0 }}>
                <PaginationBar
                  pageSize={pageSize}
                  currentPage={page}
                  totalRecords={totalRecords}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                  onPageChange={setPage}
                />
              </Box>
              <Button size="xs" color={DSR_PRIMARY} onClick={() => void submitUpdates()} loading={isSubmitting} disabled={isLoading || rows.length === 0} style={{ flexShrink: 0, marginRight: 56 }}>
                Submit changes
              </Button>
            </Group>
          </Box>
        ),
        children: (
          <Box style={TABLE_BODY}>
            {isRestoring || isLoading ? (
              <ERPListTableLoading theme={theme} message="Loading air export DSR..." />
            ) : filteredRows.length === 0 ? (
              <Flex justify="center" align="center" style={{ minHeight: 200 }}><Text size="sm" c="dimmed">No data available for this criteria.</Text></Flex>
            ) : (
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "4px 4px", minWidth: 2600 }}>
                <thead>
                  <tr>
                    {COLUMNS.filter((column) => visibleColumns[column.key]).map((column) => (
                      <th key={column.key} style={{ textAlign: "left", padding: "4px 6px", fontSize: 11, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", whiteSpace: "nowrap", width: column.width, maxWidth: column.width }}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, rowIndex) => {
                    const identity = getIdentity(row.__source) || `row-${row.sr_no}-${rowIndex}`;
                    return (
                      <tr key={identity}>
                        {COLUMNS.filter((column) => visibleColumns[column.key]).map((column) => (
                          <td key={`${identity}-${column.key}`} style={{ padding: "0px", borderBottom: "1px solid #f1f5f9", width: column.width, maxWidth: column.width }}>
                            {column.key === "etd" || column.key === "eta" || column.key === "shipment_received_date" || column.key === "job_submitted_date" ? (
                              <SingleDateInput
                                value={parseDateValue(row[column.key])}
                                onChange={(d) => {
                                  if (column.key === "etd" || column.key === "eta") onFieldChange(identity, column.key, d ? dayjs(d).format("YYYY-MM-DD") : "");
                                }}
                                size="xs"
                                readOnly={column.key !== "etd" && column.key !== "eta"}
                                styles={{ input: { width: column.width ?? 110, minWidth: column.width ?? 110, fontSize: 11, height: 28, ...(column.key !== "etd" && column.key !== "eta" ? { backgroundColor: "#f8fafc", borderColor: "#dbe4ff" } : {}) } }}
                              />
                            ) : column.key === "remark" || column.key === "shipment_status" || column.key === "hawb" || column.key === "mawb" ? (
                              <FormTextInput
                                value={row[column.key]}
                                onChange={(event) => onFieldChange(identity, column.key, event.currentTarget.value)}
                                format="normal"
                                size="xs"
                                styles={{ input: { width: column.width ?? 120, minWidth: column.width ?? 120, fontSize: 11, height: 28 } }}
                              />
                            ) : (
                              <FormTextInput
                                value={row[column.key]}
                                format="normal"
                                size="xs"
                                readOnly
                                styles={{ input: { width: column.width ?? 120, minWidth: column.width ?? 120, fontSize: 11, height: 28, backgroundColor: "#f8fafc", borderColor: "#dbe4ff" } }}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Box>
        ),
      }}
    />
  );
}
