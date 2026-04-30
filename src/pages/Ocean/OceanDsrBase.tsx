import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { Box, Flex, Group, Loader, Text, Button } from "@mantine/core";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { apiCallProtected } from "../../api/axios";
import DateRangeInput from "../../components/DateRangeInput";
import SingleDateInput from "../../components/SingleDateInput";
import FormTextInput from "../../components/FormTextInput";
import PaginationBar from "../../components/PaginationBar/PaginationBar";

const DSR_PRIMARY = "#105476";
const DSR_BORDER = "#e2e8f0";
const DSR_CARD_BG = "#ffffff";
const DSR_FOOTER_BG = "#f8fafc";

const TABLE_BODY: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "12px 16px",
};

const COLUMNS = [
  { key: "sr_no", label: "SR NO", width: 70 },
  { key: "booking_no", label: "BOOKING NO.", width: 120 },
  { key: "nomination_date", label: "NOMINATION DATE", width: 130 },
  { key: "sales_person", label: "SALES PERSON", width: 120 },
  { key: "cnee", label: "CNEE", width: 130 },
  { key: "shipper", label: "SHIPPER", width: 130 },
  { key: "agent", label: "AGENT", width: 130 },
  { key: "equip", label: "EQUIP", width: 90 },
  { key: "lcl_fcl", label: "LCL/FCL", width: 90 },
  { key: "pol", label: "POL", width: 90 },
  { key: "pod", label: "POD", width: 90 },
  { key: "terms", label: "TERMS", width: 100 },
  { key: "etd", label: "ETD", width: 110 },
  { key: "eta", label: "ETA", width: 110 },
  { key: "vsl_name", label: "VSL NAME", width: 130 },
  { key: "container_number", label: "CONTAINER NUMBER", width: 150 },
  { key: "remark", label: "Remarks", width: 140 },
  { key: "buy_rates", label: "BUY RATES", width: 100 },
  { key: "sell_rates", label: "SELL RATES", width: 100 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
type Row = Record<ColumnKey, string> & { __source?: Record<string, unknown> };
type EditableKey = "etd" | "eta" | "remark";

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
  listEndpoint: string;
};

export default function OceanDsrBase({ title, listEndpoint }: Props) {
  const [fromDate, setFromDate] = useState<Date | null>(() => dayjs().startOf("month").toDate());
  const [toDate, setToDate] = useState<Date | null>(() => dayjs().toDate());
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const originalEditableRef = useRef<Map<string, Pick<Row, EditableKey>>>(new Map());

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!fromDate || !toDate) return;
      const size = Math.max(1, Math.trunc(Number(pageSize)) || 25);
      const currentPage = Math.max(1, Math.trunc(Number(page)) || 1);
      const offset = (currentPage - 1) * size;
      const listUrl = `${listEndpoint}?index=${offset}&limit=${size}`;

      const response = await apiCallProtected.post(listUrl, {
        date_from: dayjs(fromDate).format("YYYY-MM-DD"),
        date_to: dayjs(toDate).format("YYYY-MM-DD"),
      });
      const body = response as { data?: Record<string, unknown>[]; total?: number; count?: number };
      const list = Array.isArray(body.data) ? body.data : [];
      setTotalRecords(typeof body.total === "number" ? body.total : typeof body.count === "number" ? body.count : list.length);

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
  }, [fromDate, toDate, page, pageSize, listEndpoint, title]);

  useEffect(() => setPage(1), [fromDate, toDate]);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onFieldChange = useCallback((identity: string, field: ColumnKey, value: string) => {
    setRows((prev) => prev.map((row) => (getIdentity(row.__source) === identity ? { ...row, [field]: value } : row)));
  }, []);

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
      await apiCallProtected.patch(listEndpoint, { updates });
      toast.success(`${title} updated`);
      void fetchData();
    } catch (error) {
      console.error(`Failed to update ${title}:`, error);
      toast.error(`Failed to submit ${title} updates`);
    } finally {
      setIsSubmitting(false);
    }
  }, [rows, fetchData, listEndpoint, title]);

  return (
    <Box
      mx={{ base: -16, sm: -24 }}
      pb={0}
      pt={0}
      h="calc(100vh - 72px)"
      style={{ display: "flex", flexDirection: "column", boxSizing: "border-box", backgroundColor: "#F0F4F8", minWidth: 0 }}
    >
      <Box style={{ backgroundColor: "#ffffff", borderBottom: `1px solid ${DSR_BORDER}` }}>
        <Box px={{ base: 16, sm: 24 }} py={8}>
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Text fw={600} size="sm" c="#0f172a">{title}</Text>
            <Box style={{ width: "fit-content", maxWidth: "100%" }}>
              <DateRangeInput
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                fromLabel="From date"
                toLabel="To date"
                size="xs"
                inputWidth={170}
                containerStyle={{ justifyContent: "flex-start", gap: 8 }}
              />
            </Box>
          </Group>
        </Box>
      </Box>
      <Box px={{ base: 16, sm: 24 }} pt={0} pb={0} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: `1px solid ${DSR_BORDER}`, borderRadius: 8, overflow: "hidden", background: DSR_CARD_BG, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)" }}>
          <Box style={TABLE_BODY}>
            {isLoading ? (
              <Flex justify="center" align="center" style={{ minHeight: 200 }}><Loader size="sm" color={DSR_PRIMARY} /></Flex>
            ) : rows.length === 0 ? (
              <Flex justify="center" align="center" style={{ minHeight: 200 }}><Text size="sm" c="dimmed">No data available for this date range.</Text></Flex>
            ) : (
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "4px 4px", minWidth: 2100 }}>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key} style={{ textAlign: "left", padding: "4px 6px", fontSize: 11, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", whiteSpace: "nowrap", width: column.width, maxWidth: column.width }}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const identity = getIdentity(row.__source) || `row-${row.sr_no}-${rowIndex}`;
                    return (
                      <tr key={identity}>
                        {COLUMNS.map((column) => (
                          <td key={`${identity}-${column.key}`} style={{ padding: "0px", borderBottom: "1px solid #f1f5f9", width: column.width, maxWidth: column.width }}>
                            {column.key === "etd" || column.key === "eta" || column.key === "nomination_date" ? (
                              <SingleDateInput
                                value={parseDateValue(row[column.key])}
                                onChange={(d) => {
                                  if (column.key === "etd" || column.key === "eta") onFieldChange(identity, column.key, d ? dayjs(d).format("YYYY-MM-DD") : "");
                                }}
                                size="xs"
                                readOnly={column.key !== "etd" && column.key !== "eta"}
                                styles={{ input: { width: column.width ?? 110, minWidth: column.width ?? 110, fontSize: 11, height: 28, ...(column.key !== "etd" && column.key !== "eta" ? { backgroundColor: "#f8fafc", borderColor: "#dbe4ff" } : {}) } }}
                              />
                            ) : column.key === "remark" ? (
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
          <Box style={{ flexShrink: 0, borderTop: `1px solid ${DSR_BORDER}`, background: DSR_FOOTER_BG, padding: "6px 14px", marginTop: 4 }}>
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Box style={{ flex: "1 1 320px", minWidth: 0 }}>
                <PaginationBar
                  pageSize={pageSize}
                  currentPage={page}
                  totalRecords={totalRecords}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  onPageChange={setPage}
                />
              </Box>
              <Button size="xs" color={DSR_PRIMARY} onClick={() => void submitUpdates()} loading={isSubmitting} disabled={isLoading || rows.length === 0} style={{ flexShrink: 0, marginRight: 56 }}>
                Submit changes
              </Button>
            </Group>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
