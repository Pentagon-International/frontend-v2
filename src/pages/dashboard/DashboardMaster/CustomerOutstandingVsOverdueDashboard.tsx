import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
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

function riskBadgeColor(risk: string): string {
  const normalized = String(risk || "").toUpperCase();
  if (normalized === "HIGH") return "red";
  if (normalized === "MEDIUM") return "yellow";
  return "green";
}

export default function CustomerOutstandingVsOverdueDashboard() {
  const location = useLocation();
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
    return [
      { label: "CURRENT", amount: current, pct: (current / totalOutstanding) * 100 },
      { label: "1-30 DAYS", amount: days1_30, pct: (days1_30 / totalOutstanding) * 100 },
      { label: "31-60 DAYS", amount: days31_60, pct: (days31_60 / totalOutstanding) * 100 },
      { label: "61-90 DAYS", amount: days61_90, pct: (days61_90 / totalOutstanding) * 100 },
      { label: "90+ DAYS", amount: days90Plus, pct: (days90Plus / totalOutstanding) * 100 },
    ];
  }, [summary]);

  const handleApplyFilters = () => {
    setIndex(0);
    void fetchData();
  };

  return (
    <Box
      bg="#F4F6FA"
      mx={{ base: -12, sm: -16, lg: -24 }}
      px={{ base: 12, sm: 16, lg: 20 }}
      py={{ base: 12, sm: 16, lg: 24 }}
      mih={520}
      style={{ fontFamily: ERP_FONT_SANS }}
    >
      <Stack gap={10}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap={8}>
          <Box style={{ flex: "1 1 360px", minWidth: 0 }}>
            <Text fz={11} fw={600} c="#7B8DA5" mb={5}>
              Pentagon Freight › Sales › Outstanding / Overdue
            </Text>
            <Text fw={700} c="#0B1F3A" lh={1.06} style={{ fontSize: "clamp(24px, 4.35vw, 42px)" }}>
              Customer Outstanding vs Overdue
            </Text>
            <Text fz={11} c="#8AA0B9" fw={600} mt={2} style={{ lineHeight: 1.35 }}>
              Total {formatAmountRaw(summary?.total_outstanding)} ·{" "}
              {toNumber(summary?.open_invoices).toLocaleString("en-IN")} open invoices ·{" "}
              {toNumber(summary?.customer_count).toLocaleString("en-IN")} customers
            </Text>
          </Box>

          <Group align="center" gap={8} wrap="wrap" style={{ flex: "1 1 560px", width: "100%" }}>
            <Button
              size="xs"
              radius={6}
              variant="filled"
              color="#0B2D59"
              style={{ height: 30, fontSize: 11, fontWeight: 700, flex: "1 1 120px" }}
            >
              As of {response?.as_of ? response.as_of : "-"}
            </Button>
            <Select
              size="xs"
              radius={6}
              data={customerOptions}
              value={filters.customer_name}
              onChange={(value) => setFilters((prev) => ({ ...prev, customer_name: value || "" }))}
              style={{ flex: "1 1 170px" }}
              styles={{ input: { height: 30, minHeight: 30, fontSize: 11, borderColor: "#DCE6F1" } }}
            />
            <Select
              size="xs"
              radius={6}
              data={salesmanOptions}
              value={filters.salesman}
              onChange={(value) => setFilters((prev) => ({ ...prev, salesman: value || "" }))}
              style={{ flex: "1 1 150px" }}
              styles={{ input: { height: 30, minHeight: 30, fontSize: 11, borderColor: "#DCE6F1" } }}
            />
            <Select
              size="xs"
              radius={6}
              data={locationOptions}
              value={filters.location}
              onChange={(value) => setFilters((prev) => ({ ...prev, location: value || "" }))}
              style={{ flex: "1 1 160px" }}
              styles={{ input: { height: 30, minHeight: 30, fontSize: 11, borderColor: "#DCE6F1" } }}
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
              style={{ flex: "1 1 130px" }}
              styles={{ input: { height: 30, minHeight: 30, fontSize: 11, borderColor: "#DCE6F1" } }}
            />
            <Button
              size="xs"
              radius={6}
              onClick={handleApplyFilters}
              style={{ height: 30, fontSize: 11, fontWeight: 700, flex: "1 1 90px" }}
            >
              Apply
            </Button>
          </Group>
        </Group>

        <TextInput
          leftSection={<IconSearch size={14} />}
          placeholder="Search customer name"
          value={filters.customer_name}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, customer_name: event.currentTarget.value }))
          }
          styles={{ input: { height: 34, borderColor: "#DCE6F1", fontSize: 12 } }}
        />

        <Group gap={8} wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2 }}>
          {bucketCards.map((card, idx) => (
            <Box
              key={card.label}
              style={{
                minWidth: 180,
                flex: "1 1 180px",
                borderRadius: 8,
                border: "1px solid #E4EBF3",
                background: "#FFFFFF",
                padding: "10px 12px",
                borderTop: `3px solid ${["#22C55E", "#38BDF8", "#60A5FA", "#A78BFA", "#F97316"][idx]}`,
              }}
            >
              <Text size="10px" fw={700} c="#64748B" style={{ letterSpacing: "0.06em" }}>
                {card.label}
              </Text>
              <Text mt={3} fw={800} c="#0B1F3A" fz={20}>
                {formatAmountRaw(card.amount)}
              </Text>
              <Text size="10px" fw={600} c="#94A3B8" mt={2}>
                {card.pct.toFixed(1)}%
              </Text>
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
            border: "1px solid #E4EBF3",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <Box style={{ overflowX: "auto" }}>
            <Table striped={false} withColumnBorders={false} highlightOnHover verticalSpacing="xs" miw={940}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ fontSize: 11, color: "#8AA0B9" }}>Customer</Table.Th>
                  <Table.Th style={{ fontSize: 11, color: "#8AA0B9" }}>Outstanding</Table.Th>
                  <Table.Th style={{ fontSize: 11, color: "#8AA0B9" }}>Current</Table.Th>
                  <Table.Th style={{ fontSize: 11, color: "#8AA0B9" }}>1-30</Table.Th>
                  <Table.Th style={{ fontSize: 11, color: "#8AA0B9" }}>31-60</Table.Th>
                  <Table.Th style={{ fontSize: 11, color: "#8AA0B9" }}>60+</Table.Th>
                  <Table.Th style={{ fontSize: 11, color: "#8AA0B9" }}>Risk</Table.Th>
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
                    return (
                      <Table.Tr key={`${row.customer_code}-${row.sno}`}>
                        <Table.Td>
                          <Text fw={700} fz={12} c="#0F172A">
                            {row.customer_name}
                          </Text>
                          <Text fz={10} c="#94A3B8">
                            {row.credit_display || "-"}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={700} fz={12}>
                            {formatAmountRaw(row.outstanding)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={700} fz={12}>
                            {formatAmountRaw(current)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={700} fz={12}>
                            {formatAmountRaw(row.days_1_30)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={700} fz={12}>
                            {formatAmountRaw(row.days_31_60)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={700} fz={12}>
                            {formatAmountRaw(row.days_61_plus)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            variant="light"
                            color={riskBadgeColor(row.risk)}
                            styles={{ root: { fontWeight: 700, textTransform: "uppercase" } }}
                          >
                            {row.risk || "LOW"}
                          </Badge>
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
