import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { Box, Flex, Group, Loader, Text, Button } from "@mantine/core";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { apiCallProtected } from "../../api/axios";
import { URL } from "../../api/serverUrls";
import DateRangeInput from "../../components/DateRangeInput";
import SingleDateInput from "../../components/SingleDateInput";
import FormTextInput from "../../components/FormTextInput";
import PaginationBar from "../../components/PaginationBar/PaginationBar";

function buildListUrl(offset: number, limit: number): string {
  return `${URL.airExportBooked}?index=${offset}&limit=${limit}`;
}

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
      const listUrl = buildListUrl(offset, size);
      const payload = {
        date_from: dayjs(fromDate).format("YYYY-MM-DD"),
        date_to: dayjs(toDate).format("YYYY-MM-DD"),
      };

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
  }, [fromDate, toDate, page, pageSize]);

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
      await apiCallProtected.patch(URL.airExportBooked, { updates });
      toast.success("Air export DSR updated");
      void fetchData();
    } catch (error) {
      console.error("Failed to update air export DSR:", error);
      toast.error("Failed to submit Air export DSR updates");
    } finally {
      setIsSubmitting(false);
    }
  }, [rows, fetchData]);

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
            <Text fw={600} size="sm" c="#0f172a">Air Export DSR</Text>
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "4px 4px", minWidth: 2600 }}>
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
