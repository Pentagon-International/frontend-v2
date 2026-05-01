import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { useLocation } from "react-router-dom";
import useAuthStore from "../../../store/authStore";
import {
  getCustomerOutstandingVsOverdueData,
  type CustomerOutstandingVsOverdueItem,
  type CustomerOutstandingVsOverdueResponse,
} from "../../../service/dashboard.service";

const ERP_FONT_SANS = "'Geist', sans-serif";
const PAGE_SIZE = 5;

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

function formatAmountRaw(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "0";
  if (typeof value === "string") return value;
  return String(value);
}

/** Top accent per aging bucket — matches ERP reference (green → amber → orange → deep orange → red). */
const BUCKET_TOP_COLORS = ["#22C55E", "#F59E0B", "#FB923C", "#EA580C", "#DC2626"] as const;

function splitInvoicesByPct(openInvoices: number, pcts: number[]): number[] {
  if (openInvoices <= 0 || pcts.length === 0) return pcts.map(() => 0);
  const raw = pcts.map((p) => (openInvoices * p) / 100);
  const floored = raw.map((r) => Math.floor(r));
  let rem = openInvoices - floored.reduce((a, b) => a + b, 0);
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
  if (u === "STOP" || u === "BLOCK") return { bg: "#DC2626", fg: "#FFFFFF", fw: 700 };
  if (u === "HOLD") return { bg: "#FEE2E2", fg: "#B91C1C", fw: 700 };
  if (u === "WATCH") return { bg: "#FEF3C7", fg: "#B45309", fw: 700 };
  return { bg: "#EEF2F7", fg: "#475569", fw: 600 };
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
  return formatAmountRaw(value);
}

export default function CustomerOutstandingVsOverdueDashboard() {
  const location = useLocation();
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
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CustomerOutstandingVsOverdueResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCustomerOutstandingVsOverdueData({
        company,
        index,
        limit: PAGE_SIZE,
        ...(filters.location && { location: filters.location }),
        ...(filters.salesman && { salesman: filters.salesman }),
        ...(filters.customer_name && { customer_name: filters.customer_name }),
        ...(filters.risk && { risk: filters.risk }),
      });
      setResponse(data);
    } catch (err) {
      console.error("Error loading customer outstanding vs overdue dashboard:", err);
      setError("Unable to load Customer Outstanding vs Overdue dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [company, filters.customer_name, filters.location, filters.risk, filters.salesman, index]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const summary = response?.summary;
  const rows = response?.data || [];
  const total = response?.total || 0;
  const currentPage = Math.floor(index / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const locationOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.map((r) => (r.location || "").trim()).filter(Boolean)));
    return [{ value: "", label: "All locations" }, ...unique.map((v) => ({ value: v, label: v }))];
  }, [rows]);

  const salesmanOptions = useMemo(() => {
    const unique = Array.from(
      new Set(rows.map((r) => (r.salesperson || "").trim()).filter(Boolean))
    );
    return [{ value: "", label: "All reps" }, ...unique.map((v) => ({ value: v, label: v }))];
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
    const days90Plus = toNumber(summary["days_90+"]);
    const current = Math.max(0, totalOutstanding - (days1_30 + days31_60 + days61_90 + days90Plus));
    const cards = [
      { label: "CURRENT", amount: current, pct: (current / totalOutstanding) * 100 },
      { label: "1-30 DAYS", amount: days1_30, pct: (days1_30 / totalOutstanding) * 100 },
      { label: "31-60 DAYS", amount: days31_60, pct: (days31_60 / totalOutstanding) * 100 },
      { label: "61-90 DAYS", amount: days61_90, pct: (days61_90 / totalOutstanding) * 100 },
      { label: "90+ DAYS", amount: days90Plus, pct: (days90Plus / totalOutstanding) * 100 },
    ];
    const openInv = toNumber(summary.open_invoices);
    const invoiceSplits = splitInvoicesByPct(
      openInv,
      cards.map((c) => c.pct)
    );
    return cards.map((c, i) => ({ ...c, invoiceCount: invoiceSplits[i] ?? 0 }));
  }, [summary]);

  const handleApplyFilters = () => {
    setIndex(0);
    void fetchData();
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
    <Box
      bg="#F8F9FA"
      mx={{ base: -12, sm: -16, lg: -24 }}
      px={{ base: 12, sm: 16, lg: 20 }}
      py={{ base: 12, sm: 16, lg: 24 }}
      mih={520}
      style={{
        fontFamily: ERP_FONT_SANS,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <Stack gap={10}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap={8}>
          <Box style={{ flex: "1 1 280px", minWidth: 0 }}>
            <Text fz={11} fw={600} c="#7B8DA5" mb={5}>
              Pentagon Freight › Sales › Outstanding / Overdue
            </Text>
            <Text fw={700} c="#0B1F3A" lh={1.05} style={{ fontSize: "clamp(24px, 5vw, 42px)" }}>
              Customer Outstanding vs Overdue
            </Text>
            <Text fz={11} c="#8AA0B9" fw={600} mt={2} style={{ lineHeight: 1.35 }}>
              Total AR {formatAmountRaw(summary?.total_outstanding)} ·{" "}
              {toNumber(summary?.open_invoices).toLocaleString("en-IN")} open invoices ·{" "}
              {toNumber(summary?.customer_count).toLocaleString("en-IN")} customers
            </Text>
          </Box>

          <Group
            align="center"
            gap={8}
            wrap="wrap"
            style={{ flex: "1 1 320px", width: "100%" }}
          >
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
              data={salesmanOptions}
              value={filters.salesman}
              onChange={(value) => setFilters((prev) => ({ ...prev, salesman: value || "" }))}
              style={{ flex: isMobile ? "1 1 calc(50% - 4px)" : "1 1 150px", minWidth: isMobile ? 0 : 120 }}
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
            <Button
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
            </Button>
          </Group>
        </Group>

        <TextInput
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
        />

        <Group gap={8} wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2 }}>
          {bucketCards.map((card, idx) => (
            <Box
              key={card.label}
              style={{
                minWidth: isMobile ? 160 : 180,
                flex: "1 1 180px",
                borderRadius: 8,
                border: "1px solid #E9ECEF",
                background: "#FFFFFF",
                padding: "10px 12px",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                borderTop: `3px solid ${BUCKET_TOP_COLORS[idx] ?? "#94A3B8"}`,
              }}
            >
              <Text size="10px" fw={700} c="#64748B" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                {card.label}
              </Text>
              <Text mt={4} fw={800} c="#0B1F3A" fz={isMobile ? 18 : 20} style={{ lineHeight: 1.15 }}>
                {formatAmountRaw(card.amount)}
              </Text>
              <Text size="10px" fw={600} c="#94A3B8" mt={4} style={{ lineHeight: 1.35 }}>
                {card.pct.toFixed(1)}% · {Number(card.invoiceCount).toLocaleString("en-IN")} Invoices
              </Text>
              {card.label === "90+ DAYS" && card.pct > 0 ? (
                <Text size="10px" fw={700} c="#DC2626" mt={2}>
                  High risk
                </Text>
              ) : null}
            </Box>
          ))}
        </Group>

        {error ? (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        ) : null}

        <Box
          style={{
            background: "#FFFFFF",
            border: "1px solid #E9ECEF",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
          }}
        >
          <Box style={{ overflowX: "auto" }}>
            <Table
              striped={false}
              withColumnBorders={false}
              highlightOnHover
              verticalSpacing={isMobile ? "xs" : "sm"}
              horizontalSpacing={isMobile ? "xs" : "sm"}
              miw={isMobile ? 720 : 940}
            >
              <Table.Thead>
                <Table.Tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E9ECEF" }}>
                  <Table.Th
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    Customer
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    Outstanding
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    Current
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    1-30
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    31-60
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    60+
                  </Table.Th>
                  <Table.Th
                    ta="right"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    Risk
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading && !response ? (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Group justify="center" py="md">
                        <Loader size="sm" color="#153F72" />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : rows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" py="sm" c="#94A3B8">
                        No records found
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  rows.map((row: CustomerOutstandingVsOverdueItem) => {
                    const outstanding = toNumber(row.outstanding);
                    const overdue1_30 = toNumber(row.days_1_30);
                    const overdue31_60 = toNumber(row.days_31_60);
                    const overdue61Plus = toNumber(row.days_61_plus);
                    const current = Math.max(
                      0,
                      outstanding - (overdue1_30 + overdue31_60 + overdue61Plus)
                    );
                    const riskUpper = String(row.risk || "LOW").toUpperCase();
                    const highlight60Plus =
                      overdue61Plus > 0 && (riskUpper === "HIGH" || riskUpper === "MEDIUM");
                    const rp = riskPillStyle(row.risk);
                    return (
                      <Table.Tr
                        key={`${row.customer_code}-${row.sno}`}
                        style={{ borderBottom: "1px solid #E9ECEF" }}
                      >
                        <Table.Td>
                          <Group gap={8} align="flex-start" wrap="wrap">
                            <Stack gap={3} style={{ minWidth: 0, flex: "1 1 140px" }}>
                              <Text fw={700} fz={12} c="#0F172A" lineClamp={2}>
                                {row.customer_name}
                              </Text>
                              <Text fz={10} c="#64748B" lineClamp={1}>
                                {row.credit_display || "—"}
                              </Text>
                            </Stack>
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
                                      fontSize: 9,
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
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={12} c="#0F172A">
                            {formatAmountRaw(row.outstanding)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={12} c="#0F172A">
                            {formatAmountCell(current)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={12} c="#0F172A">
                            {formatAmountCell(row.days_1_30)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={12} c="#0F172A">
                            {formatAmountCell(row.days_31_60)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={12} c={highlight60Plus ? "#DC2626" : "#0F172A"}>
                            {formatAmountCell(row.days_61_plus)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Box
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: 9999,
                              background: rp.bg,
                              color: rp.fg,
                              border: rp.border,
                              fontSize: 10,
                              fontWeight: 700,
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

        <Group justify="space-between">
          <Text fz={11} c="#7B8DA5" fw={600}>
            Showing {Math.min(total, index + 1)}-{Math.min(total, index + PAGE_SIZE)} of {total}
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
            <Text fz={11} fw={700} c="#475569" style={{ minWidth: 72, textAlign: "center" }}>
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
      </Stack>
    </Box>
  );
}
