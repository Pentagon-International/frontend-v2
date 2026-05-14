import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  LoadingOverlay,
  MantineProvider,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconSend, IconX } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { useLocation, useNavigate } from "react-router-dom";
import { ERPListToolbar } from "../../../components";
import useAuthStore from "../../../store/authStore";
import { DashboardChartSearch } from "../../../components/DashboardChartSearch";
import { useDashboardChartSearch } from "../../../hooks/useDashboardChartSearch";
import {
  getCustomerOutstandingVsOverdueData,
  type CustomerOutstandingVsOverdueItem,
  type CustomerOutstandingVsOverdueResponse,
} from "../../../service/dashboard.service";
import { CustomerOutstandingSendEmailModal } from "./CustomerOutstandingSendEmailModal";
import { enquiryConversionColors } from "./EnquiryConversion/enquiryConversionTokens";
import {
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistMantineTheme,
  erpListGeistRootTypography,
} from "../../../components/ERPListPage/erpListGeistShell";

const ERP_FONT_SANS = "'Geist', sans-serif";

const PAGE_SIZE = 15;

type DrawerDetailMode =
  | { type: "customerLocal"; row: CustomerOutstandingVsOverdueItem }
  | { type: "salesperson"; salespersonName: string };

function drawerResponseFromClickedRow(
  row: CustomerOutstandingVsOverdueItem,
  pageResponse: CustomerOutstandingVsOverdueResponse | null
): CustomerOutstandingVsOverdueResponse {
  if (pageResponse) {
    return {
      ...pageResponse,
      data: [row],
      total: 1,
      index: 0,
      limit: PAGE_SIZE,
    };
  }
  return {
    success: true,
    message: "",
    as_of: "",
    summary: {
      total_outstanding: String(row.outstanding ?? 0),
      total_overdue: String(row.overdue ?? 0),
      total_outstanding_percentage: "0",
      total_overdue_percentage: "0",
      open_invoices: 0,
      customer_count: 1,
      currency: "INR",
      days_1_30: String(row.days_1_30 ?? 0),
      days_31_60: String(row.days_31_60 ?? 0),
      days_61_90: String(row.days_61_90 ?? row.days_61_plus ?? 0),
      days_90_plus: row.days_90_plus,
    },
    data: [row],
    total: 1,
    index: 0,
    limit: PAGE_SIZE,
  };
}

type RouteState = {
  company?: string | null;
  location?: string | null;
  salesman?: string | null;
  customer_name?: string | null;
  risk?: string | null;
};

const toNumber = (value: string | number | undefined | null): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPercentNumber = (value: string | number | undefined | null): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (!match) return 0;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/** Indian-style digit grouping (thousands, lakhs, crores) for whole amounts. */
function formatInrInteger(value: string | number | undefined | null): string {
  return Math.round(toNumber(value)).toLocaleString("en-IN");
}

/** Top accent per aging bucket — matches ERP reference (green → amber → orange → deep orange → red). */
const BUCKET_TOP_COLORS = ["#22C55E", "#F59E0B", "#FB923C", "#EA580C", "#DC2626"] as const;

/** Summary-card → table column mapping used for click-sort/filter. */
type ColumnSortBucket = "OVERDUE" | "1-30" | "31-60" | "61-90" | "90+";

function summaryLabelToSortBucket(label: string): ColumnSortBucket | null {
  switch (label) {
    case "OVERDUE":
      return "OVERDUE";
    case "1-30 DAYS":
      return "1-30";
    case "31-60 DAYS":
      return "31-60";
    case "61-90 DAYS":
      return "61-90";
    case "90+ DAYS":
      return "90+";
    default:
      return null;
  }
}

function rowBucketNumeric(row: CustomerOutstandingVsOverdueItem, bucket: ColumnSortBucket): number {
  switch (bucket) {
    case "OVERDUE":
      return toNumber(row.overdue);
    case "1-30":
      return toNumber(row.days_1_30);
    case "31-60":
      return toNumber(row.days_31_60);
    case "61-90":
      return toNumber(row.days_61_90 ?? row.days_61_plus);
    case "90+":
      return toNumber(row.days_90_plus);
  }
}

function splitInvoicesByPct(openInvoices: number, pcts: number[]): number[] {
  if (openInvoices <= 0 || pcts.length === 0) return pcts.map(() => 0);
  const raw = pcts.map((p) => (openInvoices * p) / 100);
  const floored = raw.map((r) => Math.floor(r));
  const rem = openInvoices - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floored];
  for (let k = 0; k < rem; k++) {
    const o = order[k % order.length];
    if (o) out[o.i] += 1;
  }
  return out;
}

function statusTagStyle(tag: string): { bg: string; fg: string; fw: number } {
  const u = tag.toUpperCase();
  if (u === "STOP" || u === "BLOCK") return { bg: "#DC2626", fg: "#FFFFFF", fw: 600 };
  if (u === "HOLD") return { bg: "#FEE2E2", fg: "#B91C1C", fw: 600 };
  if (u === "WATCH") return { bg: "#FEF3C7", fg: "#B45309", fw: 600 };
  return { bg: "#EEF2F7", fg: "#475569", fw: 500 };
}

function riskPillStyle(risk: string | undefined): { bg: string; fg: string; border: string } {
  const n = String(risk || "LOW").toUpperCase();
  if (n === "HIGH") return { bg: "#FEE2E2", fg: "#DC2626", border: "1px solid #FECACA" };
  if (n === "MEDIUM") return { bg: "#FFEDD5", fg: "#C2410C", border: "1px solid #FDBA74" };
  return { bg: "#DCFCE7", fg: "#15803D", border: "1px solid #BBF7D0" };
}

function formatAmountCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  if (toNumber(value) === 0) return "—";
  return formatInrInteger(value);
}

const hdr = {
  paddingTop: 12,
  paddingBottom: 12,
};

/** Fixed layout: send icon; customer; numeric columns (widths sum to 100%). */
const col = {
  send: { width: "4%", minWidth: 44, maxWidth: 52 } as const,
  customer: { width: "23%", minWidth: 88, maxWidth: 200 } as const,
  outstanding: { width: "12.5%", minWidth: 72 } as const,
  overdue: { width: "12.5%", minWidth: 72 } as const,
  aging: { width: "9%", minWidth: 60 } as const,
  risk: { width: "12%", minWidth: 56 } as const,
};

/** Match `ConversionByRepCustomerwiseEnquiryList` "Enquiries & Quotations" table. */
const OSTD_LIST_INK = "#0f172a";
const OSTD_LIST_INK4 = "#94a3b8";
const OSTD_LIST_LINE = "#e2e8f0";
const OSTD_LIST_HEAD_BG = "#f8fafc";

const ostdListTd = (extra?: { verticalAlign?: "middle" | "top"; padding?: string }) => ({
  verticalAlign: "middle" as const,
  padding: "11px 12px",
  borderBottom: `1px solid ${OSTD_LIST_LINE}`,
  ...extra,
});

/** Matches enquiry modal primary line (`customer_name` / `enquiry_id`): `fz` 12, `fw` 600. */
const OSTD_ENQUIRY_COL_PRIMARY_TEXT = {
  fz: 12,
  fw: 600,
  c: OSTD_LIST_INK,
  lh: 1.35,
} as const;

/** Currency / aging amount cells — `fz` 12, semibold for INR readability (not the light enquiry count style). */
const OSTD_TABLE_VALUE_TEXT = {
  fz: 12,
  fw: 600,
  c: OSTD_LIST_INK,
  lh: 1.35,
} as const;

const ostdTableValueNumericStyle = {
  fontVariantNumeric: "tabular-nums" as const,
};

export default function CustomerOutstandingVsOverdueDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const routeState = (location.state || {}) as RouteState;
  const user = useAuthStore((state) => state.user);

  const company =
    routeState.company?.trim() || user?.company?.company_name?.trim() || "PENTAGON INDIA";

  const [filters, setFilters] = useState({
    location: routeState.location?.trim() || "",
    salesman: routeState.salesman?.trim() || "",
    customer_name: routeState.customer_name?.trim() || "",
    risk: routeState.risk?.trim() || "",
  });

  /** Company-level list (no salesman / customer filter): show Customers vs Salespersons mode and send `salesperson` boolean. */
  const showAggregateViewToggle = useMemo(
    () => !filters.salesman?.trim() && !filters.customer_name?.trim(),
    [filters.salesman, filters.customer_name]
  );

  /** When true, main table is salesperson-wise (`salesperson: true`); when false, customer-wise (`salesperson: false`). */
  const [aggregateBySalespersonList, setAggregateBySalespersonList] = useState(false);

  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CustomerOutstandingVsOverdueResponse | null>(null);
  /** When set, table shows only rows with that bucket > 0, sorted by that column descending. */
  const [activeSortBucket, setActiveSortBucket] = useState<ColumnSortBucket | null>(null);
  const [emailRow, setEmailRow] = useState<CustomerOutstandingVsOverdueItem | null>(null);

  const [drawerOpened, setDrawerOpened] = useState(false);
  const [drawerDetailMode, setDrawerDetailMode] = useState<DrawerDetailMode | null>(null);
  const [drawerIndex, setDrawerIndex] = useState(0);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerResponse, setDrawerResponse] = useState<CustomerOutstandingVsOverdueResponse | null>(null);
  const [drawerTitle, setDrawerTitle] = useState("");
  const {
    input: searchInput,
    setInput: setSearchInput,
    committed: committedSearch,
    commit: commitSearch,
  } = useDashboardChartSearch();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCustomerOutstandingVsOverdueData({
        company,
        index,
        limit: PAGE_SIZE,
        ...(showAggregateViewToggle && {
          salesperson: aggregateBySalespersonList,
        }),
        ...(filters.location && { location: filters.location }),
        ...(filters.salesman && { salesman: filters.salesman }),
        ...(filters.customer_name && { customer_name: filters.customer_name }),
        ...(filters.risk && { risk: filters.risk }),
        ...(committedSearch?.trim() && { search: committedSearch.trim() }),
      });
      setResponse(data);
    } catch (err) {
      console.error("Error loading customer outstanding vs overdue dashboard:", err);
      setError("Unable to load Customer Outstanding vs Overdue dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [
    company,
    aggregateBySalespersonList,
    showAggregateViewToggle,
    filters.customer_name,
    filters.location,
    filters.risk,
    filters.salesman,
    index,
    committedSearch,
  ]);

  const closeDrawer = useCallback(() => {
    setDrawerOpened(false);
    setDrawerDetailMode(null);
    setDrawerIndex(0);
    setDrawerResponse(null);
    setDrawerError(null);
    setDrawerTitle("");
  }, []);

  const openDrawerForCustomer = useCallback(
    (row: CustomerOutstandingVsOverdueItem) => {
      const name = (row.customer_name || "").trim();
      if (!name) return;
      setDrawerTitle(name);
      setDrawerError(null);
      setDrawerDetailMode({ type: "customerLocal", row });
      setDrawerIndex(0);
      setDrawerLoading(false);
      setDrawerResponse(drawerResponseFromClickedRow(row, response));
      setDrawerOpened(true);
    },
    [response]
  );

  const openDrawerForSalesperson = useCallback((row: CustomerOutstandingVsOverdueItem) => {
    const sp = (row.salesperson || "").trim();
    if (!sp) return;
    setDrawerTitle(sp);
    setDrawerError(null);
    setDrawerResponse(null);
    setDrawerDetailMode({ type: "salesperson", salespersonName: sp });
    setDrawerIndex(0);
    setDrawerOpened(true);
  }, []);

  useEffect(() => {
    if (!drawerOpened || !drawerDetailMode) return;
    if (drawerDetailMode.type === "customerLocal") return;

    let cancelled = false;
    (async () => {
      setDrawerLoading(true);
      setDrawerError(null);
      try {
        const common = {
          company,
          index: drawerIndex,
          limit: PAGE_SIZE,
          ...(filters.location && { location: filters.location }),
          ...(filters.risk && { risk: filters.risk }),
          ...(committedSearch?.trim() && { search: committedSearch.trim() }),
        };
        const data = await getCustomerOutstandingVsOverdueData({
          ...common,
          salesperson: true,
          salesman: drawerDetailMode.salespersonName,
        });
        if (!cancelled) setDrawerResponse(data);
      } catch (err) {
        console.error("Error loading outstanding detail drawer:", err);
        if (!cancelled) {
          setDrawerError("Unable to load detail.");
          setDrawerResponse(null);
        }
      } finally {
        if (!cancelled) setDrawerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    drawerOpened,
    drawerDetailMode,
    drawerIndex,
    company,
    filters.location,
    filters.risk,
    committedSearch,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const summary = response?.summary;
  const rows = useMemo(() => response?.data || [], [response]);
  const displayRows = useMemo(() => {
    if (!activeSortBucket) return rows;
    return [...rows]
      .filter((r) => rowBucketNumeric(r, activeSortBucket) > 0)
      .sort(
        (a, b) =>
          rowBucketNumeric(b, activeSortBucket) - rowBucketNumeric(a, activeSortBucket)
      );
  }, [rows, activeSortBucket]);
  const total = response?.total || 0;
  const currentPage = Math.floor(index / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const drawerTotal = drawerResponse?.total ?? 0;
  const drawerCurrentPage = Math.floor(drawerIndex / PAGE_SIZE) + 1;
  const drawerTotalPages = Math.max(1, Math.ceil(drawerTotal / PAGE_SIZE));

  const locationOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.map((r) => (r.location || "").trim()).filter(Boolean)));
    return [{ value: "", label: "All locations" }, ...unique.map((v) => ({ value: v, label: v }))];
  }, [rows]);

  const customerOptions = useMemo(() => {
    const unique = Array.from(
      new Set(rows.map((r) => (r.customer_name || "").trim()).filter(Boolean))
    );
    return [{ value: "", label: "All customers" }, ...unique.map((v) => ({ value: v, label: v }))];
  }, [rows]);

  const bucketCards = useMemo(() => {
    if (!summary) return [];
    const totalOutstanding = Math.max(1, toNumber(summary.total_outstanding));
    const days1_30 = toNumber(summary.days_1_30);
    const days31_60 = toNumber(summary.days_31_60);
    const days61_90 = toNumber(summary.days_61_90);
    const raw90Plus =
      summary.days_90_plus ??
      (summary as unknown as Record<string, unknown>)["days_90+"];
    const raw90Str =
      typeof raw90Plus === "string" || typeof raw90Plus === "number" ? raw90Plus : "";
    const hasDays90Plus = String(raw90Str).trim() !== "";
    const days90Plus = toNumber(raw90Str);
    const cards = [
      {
        label: "OVERDUE",
        amount: toNumber(summary.total_overdue),
        pct: toPercentNumber(summary.total_overdue_percentage),
      },
      { label: "1-30 DAYS", amount: days1_30, pct: (days1_30 / totalOutstanding) * 100 },
      { label: "31-60 DAYS", amount: days31_60, pct: (days31_60 / totalOutstanding) * 100 },
      { label: "61-90 DAYS", amount: days61_90, pct: (days61_90 / totalOutstanding) * 100 },
      {
        label: "90+ DAYS",
        amount: days90Plus,
        pct: (days90Plus / totalOutstanding) * 100,
        missing: !hasDays90Plus,
      },
    ];
    const openInv = toNumber(summary.open_invoices);
    const invoiceSplits = splitInvoicesByPct(
      openInv,
      cards.map((c) => c.pct)
    );
    return cards.map((c, i) => ({ ...c, invoiceCount: invoiceSplits[i] ?? 0 }));
  }, [summary]);

  const handleBucketCardClick = (label: string) => {
    const bucket = summaryLabelToSortBucket(label);
    if (!bucket) return;
    setActiveSortBucket((prev) => (prev === bucket ? null : bucket));
  };

  const selectInputStyles = {
    input: {
      height: 30,
      minHeight: 30,
      fontSize: 11,
      borderColor: "#E2E8F0",
      color: "#4A607A",
      fontWeight: 500,
      background: "#FFFFFF",
    },
  } as const;

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        bg="#F9FAFB"
        mx={{ base: -12, sm: -16, lg: -24 }}
        mih={520}
        style={{
          ...erpListGeistRootTypography,
          paddingBottom: 70,
        }}
      >
      <Stack gap={10}>
        <ERPListToolbar
          bleed={false}
          leading={
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0, paddingLeft: 10 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Back"
                onClick={() => navigate(-1)}
              >
                <IconChevronLeft size={18} stroke={2} />
              </ActionIcon>
              <Box style={{ minWidth: 0 }}>
              {/* <Text fz={11} fw={600} c="#7B8DA5" mb={5} style={{ lineHeight: 1.35 }}>
                Pentagon Freight › Sales › Outstanding / Overdue
              </Text> */}
              <Text
                c="#111827"
                mb={4}
                style={{
                  fontSize: "clamp(14px, 5vw, 20px)",
                  lineHeight: 1.08,
                  fontFamily: ERP_FONT_SANS,
                  fontWeight: 550,
                }}
              >
                Customer Outstanding vs Overdue
              </Text>
              {showAggregateViewToggle ? (
                <Box mt={8} mb={4}>
                  <SegmentedControl
                    size="xs"
                    radius="md"
                    data={[
                      { label: "Customers", value: "customers" },
                      { label: "Salespersons", value: "salespersons" },
                    ]}
                    value={aggregateBySalespersonList ? "salespersons" : "customers"}
                    onChange={(v) => {
                      const next = v === "salespersons";
                      setAggregateBySalespersonList(next);
                      setIndex(0);
                      setResponse(null);
                      setActiveSortBucket(null);
                      setIsLoading(true);
                    }}
                    styles={{
                      root: { maxWidth: 280 },
                      label: { fontWeight: 700, fontSize: 11 },
                    }}
                  />
                </Box>
              ) : null}
              <Text fz={11} fw={600} c="#8AA0B9" style={{ lineHeight: 1.4 }}>
                Total AR {formatInrInteger(summary?.total_outstanding)} ·{" "}
                {toNumber(summary?.open_invoices).toLocaleString("en-IN")} open invoices ·{" "}
                {toNumber(summary?.customer_count).toLocaleString("en-IN")} customers
              </Text>
              </Box>
            </Group>
          }
          actions={
            <Box style={{ minWidth: isMobile ? 320 : 420, paddingRight: 10 }}>
              <Group align="center" gap={8} wrap="wrap" style={{ width: "100%" }}>
                <Button
                  size="xs"
                  radius={6}
                  variant="filled"
                  style={{
                    flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 120px",
                    minWidth: isMobile ? 0 : undefined,
                  }}
                  styles={{
                    root: {
                      backgroundColor: "#101C2E",
                      color: "#FFFFFF",
                      height: 30,
                      fontSize: 11,
                      border: "none",
                    },
                    label: { fontWeight: 700 },
                  }}
                >
                  As of {response?.as_of ? response.as_of : "-"}
                </Button>
                <Select
                  size="xs"
                  radius={6}
                  data={customerOptions}
                  value={filters.customer_name}
                  onChange={(value) => setFilters((prev) => ({ ...prev, customer_name: value || "" }))}
                  style={{ flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 170px", minWidth: isMobile ? 0 : 120 }}
                  styles={selectInputStyles}
                />
                <Select
                  size="xs"
                  radius={6}
                  data={[
                    { value: "", label: "Risk: All" },
                    { value: "HIGH", label: "Risk: HIGH" },
                    { value: "MEDIUM", label: "Risk: MEDIUM" },
                    { value: "LOW", label: "Risk: LOW" },
                  ]}
                  value={filters.risk}
                  onChange={(value) => setFilters((prev) => ({ ...prev, risk: value || "" }))}
                  style={{ flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 130px", minWidth: isMobile ? 0 : 120 }}
                  styles={selectInputStyles}
                />
                <Select
                  size="xs"
                  radius={6}
                  data={locationOptions}
                  value={filters.location}
                  onChange={(value) => setFilters((prev) => ({ ...prev, location: value || "" }))}
                  style={{ flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 160px", minWidth: isMobile ? 0 : 120 }}
                  styles={selectInputStyles}
                />
                <Box
                  style={{
                    width: "clamp(200px, 20vw, 280px)",
                    minWidth: 200,
                    flexShrink: 0,
                  }}
                >
                  <DashboardChartSearch
                    value={searchInput}
                    onChange={setSearchInput}
                    onCommit={(v) => {
                      commitSearch(v);
                      setIndex(0);
                      void fetchData();
                    }}
                    onClear={() => {
                      commitSearch("");
                      setIndex(0);
                      void fetchData();
                    }}
                    placeholder="Search customer / salesperson"
                  />
                </Box>
                {/* <Button
                  size="xs"
                  radius={6}
                  variant="default"
                  onClick={handleApplyFilters}
                  style={{
                    height: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    flex: isMobile ? "1 1 100%" : "1 1 90px",
                    minWidth: isMobile ? 0 : undefined,
                    borderColor: "#E2E8F0",
                  }}
                >
                  Apply
                </Button> */}
              </Group>
            </Box>
          }
        />

        {/* <TextInput
          leftSection={<IconSearch size={14} color="#94A3B8" />}
          placeholder="Search enquiries, customers, invoices..."
          value={filters.customer_name}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, customer_name: event.currentTarget.value }))
          }
          radius={8}
          styles={{
            input: {
              height: 36,
              borderColor: "#E2E8F0",
              fontSize: 12,
              background: "#FFFFFF",
              color: "#334155",
            },
          }}
        /> */}

        <Group gap={8} wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2, paddingLeft: 10, paddingRight: 10 }}>
          {bucketCards.map((card, idx) => {
            const sortBucket = summaryLabelToSortBucket(card.label);
            const isActive = sortBucket !== null && activeSortBucket === sortBucket;
            return (
              <Box
                key={card.label}
                role="button"
                tabIndex={0}
                onClick={() => handleBucketCardClick(card.label)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBucketCardClick(card.label);
                  }
                }}
                style={{
                  minWidth: isMobile ? 132 : 148,
                  flex: "1 1 148px",
                  borderRadius: 8,
                  border: isActive ? "2px solid #153F72" : "1px solid #E9ECEF",
                  background: "#FFFFFF",
                  padding: "7px 9px",
                  boxShadow: isActive
                    ? "0 2px 8px rgba(21, 63, 114, 0.12)"
                    : "0 1px 2px rgba(16, 24, 40, 0.04)",
                  borderTop: `2px solid ${BUCKET_TOP_COLORS[idx] ?? "#94A3B8"}`,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <Text
                  size="10px"
                  fw={600}
                  c={enquiryConversionColors.subHeading}
                  tt="uppercase"
                  lts={0.6}
                  component="div"
                >
                  {card.label}
                </Text>
                <Text
                  mt={6}
                  fw={700}
                  fz={{ base: 16, sm: 18 }}
                  c={enquiryConversionColors.heading}
                  lh={1.1}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {card.label === "90+ DAYS" && card.missing ? "-" : formatInrInteger(card.amount)}
                </Text>
                <Text fz={11} fw={500} c={enquiryConversionColors.subHeading} mt={2} lh={1.3}>
                  {toNumber(card.pct).toLocaleString("en-IN", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  %
                </Text>
                {card.label === "90+ DAYS" && card.pct > 0 ? (
                  <Text size="10px" fw={600} c="#EF4444" mt={2}>
                    High risk
                  </Text>
                ) : null}
              </Box>
            );
          })}
        </Group>

        {error ? (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        ) : null}

        <Box className="co-ostd-jakarta-values">
        <Box
          style={{
            background: "#FFFFFF",
            border: "1px solid #E9ECEF",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
           marginLeft: 10,
           marginRight: 10,
          }}
        >
          <Box className="co-ec-table" style={{ overflowX: "auto" }}>
            <Table
              striped={false}
              withColumnBorders={false}
              withRowBorders={false}
              highlightOnHover
              highlightOnHoverColor={OSTD_LIST_HEAD_BG}
              verticalSpacing={11}
              horizontalSpacing={12}
              miw={isMobile ? 720 : 920}
              style={{ tableLayout: "fixed", width: "100%", borderTop: `1px solid ${OSTD_LIST_LINE}` }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    ta="center"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.send,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 8px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    SEND
                    <br />
                    EMAIL
                  </Table.Th>
                  <Table.Th
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.customer,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    {aggregateBySalespersonList ? "Salesperson" : "Customer"}
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.outstanding,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    Outstanding
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.overdue,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    Overdue
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.aging,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    1-30
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.aging,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    31-60
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.aging,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    61-90
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.aging,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    90+
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    fz={11}
                    fw={500}
                    c="#64748b"
                    tt="uppercase"
                    lts="0.04em"
                    style={{
                      ...col.risk,
                      background: OSTD_LIST_HEAD_BG,
                      padding: "10px 12px",
                      borderBottom: `1px solid ${OSTD_LIST_LINE}`,
                    }}
                  >
                    Risk
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading && !response ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Group justify="center" py="md">
                        <Loader size="sm" color="#153F72" />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : rows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Text ta="center" py="sm" size="sm" c={enquiryConversionColors.subHeading}>
                        No records found
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : displayRows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Text ta="center" py="sm" size="sm" c={enquiryConversionColors.subHeading}>
                        No customers with an amount in this bucket on this page.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  displayRows.map((row: CustomerOutstandingVsOverdueItem) => {
                    const days61_90 = toNumber(row.days_61_90 ?? row.days_61_plus);
                    const riskUpper = String(row.risk || "LOW").toUpperCase();
                    const highlight61_90 =
                      days61_90 > 0 && (riskUpper === "HIGH" || riskUpper === "MEDIUM");
                    const rp = riskPillStyle(row.risk);
                    return (
                      <Table.Tr key={`${row.customer_code}-${row.sno}`}>
                        <Table.Td
                          ta="center"
                          style={{
                            ...ostdListTd(),
                            ...col.send,
                            padding: "11px 8px",
                          }}
                        >
                          <Tooltip label="Send Email" position="top" withArrow>
                            <ActionIcon
                              variant="light"
                              color="#105476"
                              size="sm"
                              aria-label={`Send outstanding email for ${row.customer_name}`}
                              onClick={() => setEmailRow(row)}
                            >
                              <IconSend size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td
                          style={{
                            ...ostdListTd({ verticalAlign: "top", padding: "11px 12px" }),
                            ...col.customer,
                          }}
                        >
                          {aggregateBySalespersonList ? (
                            <Group gap={6} align="flex-start" wrap="wrap">
                              <Stack gap={6} style={{ flex: "1 1 0", minWidth: 0, maxWidth: "100%" }}>
                                <UnstyledButton
                                  type="button"
                                  onClick={() => void openDrawerForSalesperson(row)}
                                  style={{
                                    textAlign: "left",
                                    width: "100%",
                                    cursor: "pointer",
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    {...OSTD_ENQUIRY_COL_PRIMARY_TEXT}
                                    lineClamp={2}
                                    style={{ wordBreak: "break-word", minWidth: 0 }}
                                  >
                                    {row.salesperson || "—"}
                                  </Text>
                                </UnstyledButton>
                                <UnstyledButton
                                  type="button"
                                  onClick={() => void openDrawerForCustomer(row)}
                                  style={{
                                    textAlign: "left",
                                    width: "100%",
                                    cursor: "pointer",
                                    borderRadius: 4,
                                  }}
                                >
                                  <Text
                                    {...OSTD_ENQUIRY_COL_PRIMARY_TEXT}
                                    c="#105476"
                                    lineClamp={1}
                                    style={{ wordBreak: "break-word" }}
                                  >
                                    {row.customer_name || "—"}
                                  </Text>
                                </UnstyledButton>
                              </Stack>
                              <Group gap={4} wrap="wrap">
                                {(row.status_tags || []).map((tag) => {
                                  const st = statusTagStyle(tag);
                                  return (
                                    <Box
                                      key={`${row.customer_code}-${tag}-sp`}
                                      style={{
                                        display: "inline-block",
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        background: st.bg,
                                        color: st.fg,
                                        fontSize: 10,
                                        fontWeight: st.fw,
                                        letterSpacing: "0.02em",
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {tag}
                                    </Box>
                                  );
                                })}
                              </Group>
                            </Group>
                          ) : (
                            <Group gap={6} align="flex-start" wrap="wrap">
                              <Box style={{ flex: "1 1 0", minWidth: 0, maxWidth: "100%" }}>
                                <Text
                                  {...OSTD_ENQUIRY_COL_PRIMARY_TEXT}
                                  lineClamp={2}
                                  style={{ wordBreak: "break-word", minWidth: 0 }}
                                >
                                  {row.customer_name}
                                </Text>
                              </Box>
                              <Group gap={4} wrap="wrap">
                                {(row.status_tags || []).map((tag) => {
                                  const st = statusTagStyle(tag);
                                  return (
                                    <Box
                                      key={`${row.customer_code}-${tag}`}
                                      style={{
                                        display: "inline-block",
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        background: st.bg,
                                        color: st.fg,
                                        fontSize: 10,
                                        fontWeight: st.fw,
                                        letterSpacing: "0.02em",
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {tag}
                                    </Box>
                                  );
                                })}
                              </Group>
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td ta="right" style={{ ...ostdListTd(), ...col.outstanding, whiteSpace: "nowrap" }}>
                          <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                            {formatInrInteger(row.outstanding)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ ...ostdListTd(), ...col.overdue, whiteSpace: "nowrap" }}>
                          <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                            {formatAmountCell(row.overdue)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ ...ostdListTd(), ...col.aging, whiteSpace: "nowrap" }}>
                          <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                            {formatAmountCell(row.days_1_30)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ ...ostdListTd(), ...col.aging, whiteSpace: "nowrap" }}>
                          <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                            {formatAmountCell(row.days_31_60)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ ...ostdListTd(), ...col.aging, whiteSpace: "nowrap" }}>
                          <Text
                            {...OSTD_TABLE_VALUE_TEXT}
                            c={highlight61_90 ? "#EF4444" : OSTD_LIST_INK}
                            style={ostdTableValueNumericStyle}
                          >
                            {formatAmountCell(row.days_61_90 ?? row.days_61_plus)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ ...ostdListTd(), ...col.aging, whiteSpace: "nowrap" }}>
                          <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                            {(() => {
                              const raw =
                                row.days_90_plus ??
                                (row as unknown as Record<string, unknown>)["days_90+"];
                              if (
                                raw === undefined ||
                                raw === null ||
                                raw === "" ||
                                toNumber(raw as string | number) === 0
                              ) {
                                return "-";
                              }
                              return formatInrInteger(raw as string | number);
                            })()}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ ...ostdListTd(), ...col.risk, whiteSpace: "nowrap" }}>
                          <Box
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: 9999,
                              background: rp.bg,
                              color: rp.fg,
                              border: rp.border,
                              fontSize: 10,
                              fontWeight: 500,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {row.risk || "LOW"}
                          </Box>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </Box>
        </Box>

        <Group justify="space-between" style={{ paddingLeft: 10, paddingRight: 10 }}>
          <Text fz={11} fw={600} c={enquiryConversionColors.subHeading}>
            Showing {Math.min(total, index + 1).toLocaleString("en-IN")}-
            {Math.min(total, index + PAGE_SIZE).toLocaleString("en-IN")} of{" "}
            {total.toLocaleString("en-IN")}
          </Text>
          <Group gap={6}>
            <Button
              size="compact-sm"
              variant="default"
              leftSection={<IconChevronLeft size={14} />}
              disabled={index <= 0 || isLoading}
              onClick={() => setIndex((prev) => Math.max(0, prev - PAGE_SIZE))}
            >
              Prev
            </Button>
            <Text fz={11} fw={500} c={enquiryConversionColors.heading} style={{ minWidth: 72, textAlign: "center" }}>
              Page {currentPage}/{totalPages}
            </Text>
            <Button
              size="compact-sm"
              variant="default"
              rightSection={<IconChevronRight size={14} />}
              disabled={index + PAGE_SIZE >= total || isLoading}
              onClick={() => setIndex((prev) => prev + PAGE_SIZE)}
            >
              Next
            </Button>
          </Group>
        </Group>
        </Box>
      </Stack>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        position="right"
        size="min(1000px, 96vw)"
        padding={0}
        offset={8}
        radius="md"
        zIndex={400}
        withOverlay
        overlayProps={{ opacity: 0.35, blur: 2 }}
        styles={{
          header: { display: "none" },
          body: { padding: 0, height: "100%" },
          content: {
            borderLeft: "1px solid #E2E8F0",
            boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.08)",
            background: "#F9FAFB",
          },
        }}
      >
        <Box
          className="co-ostd-jakarta-values"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            maxHeight: "100%",
          }}
        >
          <Box
            px={20}
            py={14}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              background: "#FFFFFF",
              borderBottom: "1px solid #EEF2F7",
            }}
          >
            <Group gap={10} wrap="nowrap" align="center" style={{ minWidth: 0, flex: 1 }}>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Close" onClick={closeDrawer}>
                <IconChevronLeft size={18} stroke={2} />
              </ActionIcon>
              <Text fw={600} fz={14} c="#0F172A" truncate style={{ minWidth: 0 }}>
                {drawerTitle}
              </Text>
            </Group>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Close drawer" onClick={closeDrawer}>
              <IconX size={18} stroke={2} />
            </ActionIcon>
          </Box>

          <ScrollArea type="scroll" scrollbarSize={8} style={{ flex: 1, minHeight: 0 }}>
            <Stack gap="md" p={20} pb={32}>
              {drawerLoading && !drawerResponse ? (
                <Group justify="center" py="xl">
                  <Loader color="#101C2E" />
                </Group>
              ) : drawerError ? (
                <Alert color="red" title="Error">
                  {drawerError}
                </Alert>
              ) : (
                <>
                  <Text fz={13} fw={500} c="#64748B">
                    As of {drawerResponse?.as_of ?? "—"} · Total AR{" "}
                    {formatInrInteger(drawerResponse?.summary?.total_outstanding)} ·{" "}
                    {toNumber(drawerResponse?.summary?.open_invoices).toLocaleString("en-IN")} open invoices
                  </Text>
                  <Box style={{ position: "relative" }}>
                    <LoadingOverlay
                      visible={drawerLoading && !!drawerResponse}
                      overlayProps={{ opacity: 0.28 }}
                      loaderProps={{ size: "sm", color: "#101C2E" }}
                      zIndex={3}
                    />
                    <Box
                      style={{
                        background: enquiryConversionColors.panelBg,
                        border: `1px solid ${enquiryConversionColors.panelBorder}`,
                        borderRadius: enquiryConversionColors.radius,
                        boxShadow: enquiryConversionColors.shadow,
                        overflow: "hidden",
                      }}
                    >
                      <Box className="co-ec-drawer-table" style={{ overflowX: "auto" }}>
                      <Table
                        striped={false}
                        highlightOnHover
                        verticalSpacing={10}
                        horizontalSpacing="md"
                        miw={720}
                        style={{ tableLayout: "fixed", width: "100%" }}
                      >
                        <Table.Thead>
                          <Table.Tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E9ECEF" }}>
                            <Table.Th
                              ta="center"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.send, verticalAlign: "middle", paddingInline: 4 }}
                            >
                              SEND
                              <br />
                              EMAIL
                            </Table.Th>
                            <Table.Th
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.customer, verticalAlign: "middle" }}
                            >
                              Customer
                            </Table.Th>
                            <Table.Th
                              ta="right"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.outstanding, verticalAlign: "middle" }}
                            >
                              Outstanding
                            </Table.Th>
                            <Table.Th
                              ta="right"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.overdue, verticalAlign: "middle" }}
                            >
                              Overdue
                            </Table.Th>
                            <Table.Th
                              ta="right"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.aging, verticalAlign: "middle" }}
                            >
                              1-30
                            </Table.Th>
                            <Table.Th
                              ta="right"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.aging, verticalAlign: "middle" }}
                            >
                              31-60
                            </Table.Th>
                            <Table.Th
                              ta="right"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.aging, verticalAlign: "middle" }}
                            >
                              61-90
                            </Table.Th>
                            <Table.Th
                              ta="right"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.aging, verticalAlign: "middle" }}
                            >
                              90+
                            </Table.Th>
                            <Table.Th
                              ta="right"
                              fz={10}
                              fw={500}
                              c="#94A3B8"
                              tt="uppercase"
                              style={{ ...hdr, ...col.risk, verticalAlign: "middle" }}
                            >
                              Risk
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(drawerResponse?.data || []).length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={9}>
                                <Text ta="center" py="sm" fz={13} fw={500} c="#64748B">
                                  No records found
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ) : (
                            (drawerResponse?.data || []).map((drow: CustomerOutstandingVsOverdueItem) => {
                              const days61_90d = toNumber(drow.days_61_90 ?? drow.days_61_plus);
                              const riskUpperd = String(drow.risk || "LOW").toUpperCase();
                              const highlight61_90d =
                                days61_90d > 0 && (riskUpperd === "HIGH" || riskUpperd === "MEDIUM");
                              const rpd = riskPillStyle(drow.risk);
                              return (
                                <Table.Tr key={`drawer-${drow.sno}-${drow.customer_code}`}>
                                  <Table.Td ta="center" style={{ ...col.send, verticalAlign: "middle", paddingInline: 4 }}>
                                    <Tooltip label="Send Email" position="top" withArrow>
                                      <ActionIcon
                                        variant="light"
                                        color="#105476"
                                        size="sm"
                                        aria-label={`Send outstanding email for ${drow.customer_name}`}
                                        onClick={() => setEmailRow(drow)}
                                      >
                                        <IconSend size={16} />
                                      </ActionIcon>
                                    </Tooltip>
                                  </Table.Td>
                                  <Table.Td style={{ ...col.customer, verticalAlign: "top" }}>
                                    <Stack gap={0} style={{ minWidth: 0 }}>
                                      <Text
                                        {...OSTD_ENQUIRY_COL_PRIMARY_TEXT}
                                        lineClamp={2}
                                        style={{ wordBreak: "break-word" }}
                                      >
                                        {drow.customer_name}
                                      </Text>
                                      {drawerDetailMode?.type !== "salesperson" &&
                                      drow.salesperson?.trim() ? (
                                        <Text
                                          fz={10.5}
                                          c={OSTD_LIST_INK4}
                                          mt={1}
                                          lh={1.3}
                                          lineClamp={1}
                                        >
                                          {drow.salesperson}
                                        </Text>
                                      ) : null}
                                    </Stack>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ ...col.outstanding, whiteSpace: "nowrap" }}>
                                    <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                                      {formatInrInteger(drow.outstanding)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ ...col.overdue, whiteSpace: "nowrap" }}>
                                    <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                                      {formatAmountCell(drow.overdue)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ ...col.aging, whiteSpace: "nowrap" }}>
                                    <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                                      {formatAmountCell(drow.days_1_30)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ ...col.aging, whiteSpace: "nowrap" }}>
                                    <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                                      {formatAmountCell(drow.days_31_60)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ ...col.aging, whiteSpace: "nowrap" }}>
                                    <Text
                                      {...OSTD_TABLE_VALUE_TEXT}
                                      c={highlight61_90d ? "#EF4444" : OSTD_LIST_INK}
                                      style={ostdTableValueNumericStyle}
                                    >
                                      {formatAmountCell(drow.days_61_90 ?? drow.days_61_plus)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ ...col.aging, whiteSpace: "nowrap" }}>
                                    <Text {...OSTD_TABLE_VALUE_TEXT} style={ostdTableValueNumericStyle}>
                                      {(() => {
                                        const raw =
                                          drow.days_90_plus ??
                                          (drow as unknown as Record<string, unknown>)["days_90+"];
                                        if (
                                          raw === undefined ||
                                          raw === null ||
                                          raw === "" ||
                                          toNumber(raw as string | number) === 0
                                        ) {
                                          return "-";
                                        }
                                        return formatInrInteger(raw as string | number);
                                      })()}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ ...col.risk, whiteSpace: "nowrap" }}>
                                    <Box
                                      style={{
                                        display: "inline-block",
                                        padding: "4px 10px",
                                        borderRadius: 9999,
                                        background: rpd.bg,
                                        color: rpd.fg,
                                        border: rpd.border,
                                        fontSize: 10,
                                        fontWeight: 500,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                      }}
                                    >
                                      {drow.risk || "LOW"}
                                    </Box>
                                  </Table.Td>
                                </Table.Tr>
                              );
                            })
                          )}
                        </Table.Tbody>
                      </Table>
                    </Box>
                  </Box>
                  </Box>
                </>
              )}
            </Stack>
          </ScrollArea>
          {drawerResponse && !drawerError && drawerDetailMode?.type !== "customerLocal" ? (
            <Box
              px={20}
              py={14}
              pr={88}
              style={{
                flexShrink: 0,
                borderTop: "1px solid #EEF2F7",
                background: "#FFFFFF",
              }}
            >
              <Group justify="space-between" wrap="wrap" gap="sm">
                <Text fz={12} fw={500} c="#64748B">
                  Showing {Math.min(drawerTotal, drawerIndex + 1).toLocaleString("en-IN")}-
                  {Math.min(drawerTotal, drawerIndex + PAGE_SIZE).toLocaleString("en-IN")} of{" "}
                  {drawerTotal.toLocaleString("en-IN")}
                </Text>
                <Group gap={6}>
                  <Button
                    size="compact-sm"
                    variant="default"
                    leftSection={<IconChevronLeft size={14} />}
                    disabled={drawerIndex <= 0 || drawerLoading}
                    onClick={() => setDrawerIndex((prev) => Math.max(0, prev - PAGE_SIZE))}
                  >
                    Prev
                  </Button>
                  <Text fz={12} fw={500} c="#0F172A" style={{ minWidth: 72, textAlign: "center" }}>
                    Page {drawerCurrentPage}/{drawerTotalPages}
                  </Text>
                  <Button
                    size="compact-sm"
                    variant="default"
                    rightSection={<IconChevronRight size={14} />}
                    disabled={drawerIndex + PAGE_SIZE >= drawerTotal || drawerLoading}
                    onClick={() => setDrawerIndex((prev) => prev + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </Group>
              </Group>
            </Box>
          ) : null}
        </Box>
      </Drawer>

      <CustomerOutstandingSendEmailModal
        opened={!!emailRow}
        onClose={() => setEmailRow(null)}
        row={emailRow}
        companyName={company}
        asOf={response?.as_of}
      />
      </Box>
    </MantineProvider>
  );
}
