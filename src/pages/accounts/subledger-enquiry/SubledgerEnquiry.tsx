import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  Group,
  Loader,
  ScrollArea,
  Text,
  TextInput,
} from "@mantine/core";
import { IconInfoCircle, IconSearch } from "@tabler/icons-react";
import {
  Dropdown,
  SearchableSelect,
  SingleDateInput,
} from "../../../components";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import useAuthStore from "../../../store/authStore";

type CoaItem = {
  id?: number;
  gl_account_code?: string;
  sl_code?: string;
  account_name?: string;
};

type SubledgerEntryRow = {
  sno?: number;
  location?: string | null;
  day_book_code?: string | null;
  day_book_type?: string | null;
  document_no?: string | null;
  date_document?: string | null;
  due_date?: string | null;
  shipment_no?: string | null;
  service?: string | null;
  job_id?: string | null;
  debit_local_amount?: number | null;
  credit_local_amount?: number | null;
  narration?: string | null;
  amount?: number | null;
  closing_balance?: number | null;
};

type SubledgerEnquiryResponse = {
  date_from?: string;
  date_to?: string;
  account_code?: string;
  opening_balance?: number | null;
  closing_balance?: number | null;
  total?: number;
  data?: SubledgerEntryRow[];
};

type EntryColumn = {
  key: keyof SubledgerEntryRow;
  label: string;
  span: number;
};

const ENTRY_COLUMNS: EntryColumn[] = [
  { key: "sno", label: "S.No.", span: 0.4 },
  { key: "location", label: "Location", span: 0.65 },
  { key: "day_book_code", label: "Day Book", span: 0.65 },
  { key: "day_book_type", label: "Doc Type", span: 0.65 },
  { key: "document_no", label: "Doc No", span: 1.25 },
  { key: "date_document", label: "Doc Date", span: 0.9 },
  { key: "due_date", label: "Due Date", span: 0.9 },
  { key: "shipment_no", label: "Shipment No", span: 1.0 },
  { key: "service", label: "Service", span: 0.55 },
  { key: "job_id", label: "Job Id", span: 0.95 },
  { key: "debit_local_amount", label: "Debit", span: 0.75 },
  { key: "credit_local_amount", label: "Credit", span: 0.75 },
  { key: "narration", label: "Narration", span: 1 },
  { key: "amount", label: "Amount", span: 0.75 },
  { key: "closing_balance", label: "Closing Bal", span: 0.8 },
];

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSubledgerCell(
  key: keyof SubledgerEntryRow,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (key === "sno") return String(value);
  if (
    key === "debit_local_amount" ||
    key === "credit_local_amount" ||
    key === "amount" ||
    key === "closing_balance"
  ) {
    if (typeof value === "number") return formatAmount(value);
  }
  return String(value);
}

function formatDateYYYYMMDD(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const headerGridStyles = {
  position: "sticky" as const,
  top: 0,
  zIndex: 100,
  backgroundColor: "white",
  fontWeight: 600,
  color: "#105476",
};

const readOnlyInputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
    height: "36px",
    backgroundColor: "var(--mantine-color-gray-0)",
  },
};

export default function SubledgerEnquiry() {
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [accountCode, setAccountCode] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<CoaItem | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [rows, setRows] = useState<SubledgerEntryRow[]>([]);
  const [enquirySummary, setEnquirySummary] = useState<{
    opening_balance: number | null;
    closing_balance: number | null;
  } | null>(null);
  const [isFetchingRows, setIsFetchingRows] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const isFormValid = Boolean(fromDate && toDate && accountCode);

  const selectedGlAccountCode = selectedAccount?.gl_account_code ?? "";
  const selectedSlCode = selectedAccount?.sl_code ?? "";

  const { user } = useAuthStore();

  const locationOptions = useMemo(() => {
    const branches = (user?.branches ?? []) as Array<{
      user_branch_id?: number;
      branch_code?: string;
      branch_name?: string;
      country?: { country_id?: number };
      is_default?: boolean;
    }>;

    if (branches.length === 0) return [];

    // Active country is derived from login context.
    const activeCountryId = user?.country?.country_id;
    const activeCountryIdStr =
      activeCountryId !== null && activeCountryId !== undefined
        ? String(activeCountryId)
        : null;

    // Prefer filtering by country_id present on branch objects (if available).
    const activeBranches = activeCountryIdStr
      ? branches.filter((b) => {
          const branchCountryId = b.country?.country_id;
          if (branchCountryId === null || branchCountryId === undefined) {
            return false;
          }
          return String(branchCountryId) === activeCountryIdStr;
        })
      : [];

    // Fallback: if branch objects don't include country info, show only default branch.
    const effectiveBranches =
      activeBranches.length > 0
        ? activeBranches
        : branches.filter((b) => b.is_default);

    const list = (effectiveBranches.length > 0 ? effectiveBranches : branches)
      .map((b) => ({
        value: String(b.branch_code ?? "").trim(),
        label: String(b.branch_name ?? "").trim(),
      }))
      .filter((o) => o.value !== "" && o.label !== "");

    // Keep order stable and unique by value.
    const seen = new Set<string>();
    return list.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [user]);

  const handleSearch = async () => {
    if (!isFormValid) {
      setFetchError("Please fill From, To, and Account fields.");
      return;
    }

    setFetchError("");
    setIsFetchingRows(true);

    try {
      const trimmedLocation = location?.trim();
      const payload = {
        filters: {
          date_from: formatDateYYYYMMDD(fromDate),
          date_to: formatDateYYYYMMDD(toDate),
          account_code: String(accountCode),
          ...(trimmedLocation ? { location: trimmedLocation } : {}),
        },
      };

      const response = (await postAPICall(
        URL.subledgerEnquiry,
        payload,
        API_HEADER,
      )) as SubledgerEnquiryResponse;

      const list = Array.isArray(response?.data) ? response.data : [];
      setRows(list);
      setEnquirySummary({
        opening_balance:
          typeof response?.opening_balance === "number"
            ? response.opening_balance
            : null,
        closing_balance:
          typeof response?.closing_balance === "number"
            ? response.closing_balance
            : null,
      });
    } catch {
      setRows([]);
      setEnquirySummary(null);
      setFetchError("Unable to fetch subledger data. Please try again.");
    } finally {
      setIsFetchingRows(false);
    }
  };

  const openingBalanceLabel =
    enquirySummary && typeof enquirySummary.opening_balance === "number"
      ? formatAmount(enquirySummary.opening_balance)
      : null;

  return (
    <Box p="md">
      <Group justify="space-between" mb="md" align="flex-end">
        <Text fw={600} size="lg" style={{ fontFamily: "Inter" }}>
          Subledger Enquiry
        </Text>
      </Group>

      <Grid gutter="md" align="flex-end">
        <Grid.Col span={{ base: 12, md: 3 }}>
          <SingleDateInput
            label="From"
            value={fromDate}
            onChange={setFromDate}
            withAsterisk
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <SingleDateInput
            label="To"
            value={toDate}
            onChange={setToDate}
            withAsterisk
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <SearchableSelect
            label="Account"
            apiEndpoint={URL.chartOfAccounts}
            value={accountId}
            dropdownZIndex={1100}
            placeholder="Search by GL code or account name"
            required
            withAsterisk
            minSearchLength={1}
            searchFields={["gl_account_code", "account_name", "id"]}
            displayFormat={(item: Record<string, unknown>) => {
              const id = String(item.id ?? "").trim();
              const gl = String(item.gl_account_code ?? "").trim();
              const name = String(item.account_name ?? "").trim();
              return {
                value: id,
                label: name ? `${name}${gl ? ` - ${gl}` : ""}` : gl,
              };
            }}
            displayValue={selectedAccount?.account_name ?? ""}
            returnOriginalData
            onChange={(value, _selectedData, originalData) => {
              setAccountId(value);
              if (!value || !originalData) {
                setAccountCode(null);
                setSelectedAccount(null);
                return;
              }

              const nextGl = originalData.gl_account_code;
              const nextSl = originalData.sl_code;
              const nextName = originalData.account_name;

              setAccountCode(
                nextGl !== undefined && nextGl !== null ? String(nextGl) : null,
              );
              setSelectedAccount({
                id:
                  originalData.id !== undefined && originalData.id !== null
                    ? Number(originalData.id)
                    : undefined,
                gl_account_code:
                  nextGl !== undefined && nextGl !== null
                    ? String(nextGl)
                    : undefined,
                sl_code:
                  nextSl !== undefined && nextSl !== null
                    ? String(nextSl)
                    : undefined,
                account_name:
                  nextName !== undefined && nextName !== null
                    ? String(nextName)
                    : undefined,
              });
            }}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 2 }}>
          <Dropdown
            label="Location"
            placeholder={
              locationOptions.length > 0 ? "Select location" : "No locations"
            }
            data={locationOptions}
            value={location}
            dropdownZIndex={1100}
            searchable={false}
            onChange={(value) => setLocation(value)}
          />
        </Grid.Col>

        <Grid.Col span={{ md: 1 }}>
          <Button
            leftSection={
              isFetchingRows ? (
                <Loader size={14} color="white" />
              ) : (
                <IconSearch size={16} />
              )
            }
            onClick={handleSearch}
            fullWidth
            size="xs"
            style={{ height: 32 }}
          >
            Search
          </Button>
        </Grid.Col>
      </Grid>

      {/* Keep filter inputs aligned; show GL/SL under Account in a second row */}
      {selectedAccount && (
        <Grid gutter="md" mt={4}>
          <Grid.Col span={{ md: 6 }} />
          <Grid.Col span={{ md: 3 }}>
            <Text size="12px" style={{ fontFamily: "Inter" }}>
              {/* GL: {selectedGlAccountCode || "—"}{" "}
              <span style={{ margin: "0 8px" }}>|</span> */}
              SL: {selectedSlCode || "—"}
            </Text>
          </Grid.Col>
          <Grid.Col span={{ md: 3 }} />
        </Grid>
      )}

      {fetchError && (
        <Alert
          mt="md"
          color="red"
          variant="light"
          icon={<IconInfoCircle size={16} />}
        >
          {fetchError}
        </Alert>
      )}

      <Box mt={"sm"}>
        {enquirySummary !== null && (
          <Grid align="flex-end" mb="sm">
            <Grid.Col span={{ md: 9.5 }} />
            <Grid.Col span={{ md: 2 }}>
              <Box
                style={{
                  border: "1px solid #dbe5ef",
                  borderRadius: 6,
                  padding: "10px 12px",
                  backgroundColor: "#f8fbff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <Text
                  fw={700}
                  size="sm"
                  c="#105476"
                  style={{
                    fontFamily: "Inter",
                    display: "flex",
                    // justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <span>Opening Bal:</span>
                  <span>{openingBalanceLabel ?? "—"}</span>
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={0.5} />
          </Grid>
        )}

        <ScrollArea type="scroll" offsetScrollbars>
          <Box style={{ minWidth: 1100 }}>
            <Grid
              w="100%"
              py="sm"
              style={{ ...headerGridStyles, flexWrap: "nowrap" }}
            >
              {ENTRY_COLUMNS.map((col) => (
                <Grid.Col
                  key={col.key}
                  span={col.span}
                  style={{ fontSize: "13px" }}
                >
                  {col.label}
                </Grid.Col>
              ))}
            </Grid>

            {rows.length === 0 && !isFetchingRows ? (
              <Text
                size="sm"
                c="dimmed"
                mt="sm"
                style={{ fontFamily: "Inter" }}
              >
                No entries.
              </Text>
            ) : (
              rows.map((row, index) => (
                <Grid
                  key={`${row.sno ?? index}-${row.document_no ?? index}`}
                  w="100%"
                  gutter="xs"
                  mt={index !== 0 ? "sm" : 0}
                  style={{ flexWrap: "nowrap" }}
                >
                  {ENTRY_COLUMNS.map((col) => (
                    <Grid.Col key={col.key} span={col.span}>
                      <TextInput
                        value={formatSubledgerCell(col.key, row[col.key])}
                        readOnly
                        placeholder="—"
                        styles={readOnlyInputStyles}
                      />
                    </Grid.Col>
                  ))}
                </Grid>
              ))
            )}
          </Box>
        </ScrollArea>
      </Box>
    </Box>
  );
}
