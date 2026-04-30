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

/** Matches CallEntryMaster list URL style: `${endpoint}?index=${offset}&limit=${pageSize}` */
function buildAirImportBookedListUrl(
  zeroBasedRowOffset: number,
  limit: number
): string {
  return `${URL.airImportBooked}?index=${zeroBasedRowOffset}&limit=${limit}`;
}

const DSR_PRIMARY = "#105476";
const DSR_BORDER = "#e2e8f0";
const DSR_CARD_BG = "#ffffff";
const DSR_FOOTER_BG = "#f8fafc";

/** Scroll area inside the bordered card (pagination lives in the card footer). */
const AIR_IMPORT_DSR_TABLE_BODY: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "12px 16px",
};

const AIR_IMPORT_DSR_COLUMNS = [
  { key: "sr_no", label: "S.No", width: 40 },
  { key: "date", label: "Date", width: 105 },
  { key: "sales_person", label: "Sales Person", width: 80 },
  { key: "ref_number", label: "Ref Number", width: 80 },
  { key: "status", label: "Status", width: 80 },
  { key: "customer", label: "Customer", width: 120 },
  { key: "actual_consignee", label: "Consignee", width: 120 },
  { key: "shipper", label: "Shipper", width: 120 },
  { key: "agent", label: "Agent", width: 120 },
  { key: "pol", label: "POL", width: 60 },
  { key: "pod", label: "POD", width: 60 },
  { key: "terms", label: "Terms", width: 60 },
  { key: "pqkgs", label: "Packages", width: 60 },
  { key: "gw", label: "GW", width: 60 },
  { key: "cw", label: "CW", width: 60 },
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
  const [fromDate, setFromDate] = useState<Date | null>(() =>
    dayjs().startOf("month").toDate()
  );
  const [toDate, setToDate] = useState<Date | null>(() => dayjs().toDate());
  const [airImportDsrRows, setAirImportDsrRows] = useState<AirImportDsrRow[]>([]);
  const [isLoadingAirImportDsr, setIsLoadingAirImportDsr] = useState(false);
  const [isSubmittingAirImportDsr, setIsSubmittingAirImportDsr] = useState(false);
  const [airImportDsrPage, setAirImportDsrPage] = useState(1);
  const [airImportDsrPageSize, setAirImportDsrPageSize] = useState(25);
  const [airImportDsrTotalRecords, setAirImportDsrTotalRecords] = useState(0);

  const airImportDsrOriginalEditableRef = useRef<
    Map<string, Pick<AirImportDsrRow, AirImportDsrEditableKey>>
  >(new Map());

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
        date_from: dayjs(fromDate).format("YYYY-MM-DD"),
        date_to: dayjs(toDate).format("YYYY-MM-DD"),
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
  }, [fromDate, toDate, airImportDsrPage, airImportDsrPageSize]);

  useEffect(() => {
    setAirImportDsrPage(1);
  }, [fromDate, toDate]);

  useEffect(() => {
    void fetchAirImportDsrData();
  }, [fetchAirImportDsrData]);

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

      await apiCallProtected.patch(URL.airImportBooked, { updates });
      toast.success("Air import DSR updated");
      void fetchAirImportDsrData();
    } catch (error) {
      console.error("Failed to submit air import DSR updates:", error);
      toast.error("Failed to submit Air import DSR updates");
    } finally {
      setIsSubmittingAirImportDsr(false);
    }
  }, [airImportDsrRows, fetchAirImportDsrData]);

  return (
    <Box
      mx={{ base: -16, sm: -24 }}
      pb={0}
      pt={0}
      h="calc(100vh - 72px)"
      style={{
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        backgroundColor: "#F0F4F8",
        minWidth: 0,
      }}
    >
      <Box style={{ backgroundColor: "#ffffff", borderBottom: `1px solid ${DSR_BORDER}` }}>
        <Box px={{ base: 16, sm: 24 }} py={8}>
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Text fw={600} size="sm" c="#0f172a">
              Air Import DSR
            </Text>
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

      <Box
        px={{ base: 16, sm: 24 }}
        pt={0}
        pb={0}
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${DSR_BORDER}`,
            borderRadius: 8,
            overflow: "hidden",
            background: DSR_CARD_BG,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
          }}
        >
          <Box style={AIR_IMPORT_DSR_TABLE_BODY}>
            {isLoadingAirImportDsr ? (
              <Flex justify="center" align="center" style={{ minHeight: 200 }}>
                <Loader size="sm" color={DSR_PRIMARY} />
              </Flex>
            ) : airImportDsrRows.length === 0 ? (
              <Flex justify="center" align="center" style={{ minHeight: 200 }}>
                <Text size="sm" c="dimmed">
                  No data available for this date range.
                </Text>
              </Flex>
            ) : (
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
                    {AIR_IMPORT_DSR_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        style={{
                          textAlign: "left",
                          padding: "4px 6px",
                          fontSize: 11,
                          borderBottom: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          whiteSpace: "nowrap",
                          width: column.width,
                          maxWidth: column.width,
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {airImportDsrRows.map((row, rowIndex) => {
                    const identityKey =
                      getAirImportDsrIdentityKeyFromRow(row) || `row-${row.sr_no}-${rowIndex}`;
                    return (
                      <tr key={identityKey}>
                        {AIR_IMPORT_DSR_COLUMNS.map((column) => (
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
                                    height: 28,
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
                                    height: 28,
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
                                    height: 28,
                                    backgroundColor: "#f8fafc",
                                    borderColor: "#dbe4ff",
                                  },
                                }}
                              />
                            ) : (
                              <FormTextInput
                                value={airImportDsrRowScalar(row, column.key)}
                                format="normal"
                                size="xs"
                                readOnly
                                styles={{
                                  input: {
                                    width: column.width ?? 120,
                                    minWidth: column.width ?? 120,
                                    fontSize: 11,
                                    height: 28,
                                    backgroundColor: "#f8fafc",
                                    borderColor: "#dbe4ff",
                                  },
                                }}
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

          <Box
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${DSR_BORDER}`,
              background: DSR_FOOTER_BG,
              padding: "6px 14px",
              marginTop: 4,
            }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Box style={{ flex: "1 1 320px", minWidth: 0 }}>
                <PaginationBar
                  pageSize={airImportDsrPageSize}
                  currentPage={airImportDsrPage}
                  totalRecords={airImportDsrTotalRecords}
                  onPageSizeChange={(size) => {
                    setAirImportDsrPageSize(size);
                    setAirImportDsrPage(1);
                  }}
                  onPageChange={setAirImportDsrPage}
                />
              </Box>
              <Button
                size="xs"
                color={DSR_PRIMARY}
                onClick={() => void submitAirImportDsrUpdates()}
                loading={isSubmittingAirImportDsr}
                disabled={isLoadingAirImportDsr || airImportDsrRows.length === 0}
                style={{ flexShrink: 0, marginRight: 56 }}
              >
                Submit changes
              </Button>
            </Group>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

