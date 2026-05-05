import { Box, Center, Group, Loader, Stack, Table, Text } from "@mantine/core";
import { useMemo } from "react";
import { enquiryConversionColors } from "../pages/dashboard/DashboardMaster/EnquiryConversion/enquiryConversionTokens";
import type {
  CallEntryCustomerData,
  CallEntryStatisticsSummary,
} from "../service/dashboard.service";

const NAVY = "#1E3A8A";
const DOT = "#105476";

type Metric =
  | "total_calls"
  | "total_overdue"
  | "total_today"
  | "total_upcoming"
  | "total_closed";

export interface CallEntryCustomerDrawerTableProps {
  rows: CallEntryCustomerData[];
  summary: CallEntryStatisticsSummary | null;
  heading?: string | null;
  periodLabel?: string;
  loading?: boolean;
  emptyMessage?: string;
  onMetricClick?: (metric: Metric, row: CallEntryCustomerData) => void;
}

function toNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function CallEntryCustomerDrawerTable({
  rows,
  summary,
  heading,
  periodLabel,
  loading,
  emptyMessage = "No customer-wise rows found.",
  onMetricClick,
}: CallEntryCustomerDrawerTableProps) {
  const totalCustomerCount = useMemo(() => {
    const codes = new Set<string>();
    for (const r of rows) {
      const c = String(r.customer_code ?? "").trim();
      if (c) codes.add(c);
    }
    return codes.size > 0 ? codes.size : rows.length;
  }, [rows]);

  const kpis = useMemo(() => {
    const total_calls = summary?.total_calls ?? rows.reduce((a, r) => a + toNum(r.total_calls), 0);
    const total_overdue =
      summary?.total_overdue ?? rows.reduce((a, r) => a + toNum(r.total_overdue), 0);
    const total_today =
      summary?.total_today ?? rows.reduce((a, r) => a + toNum(r.total_today), 0);
    const total_upcoming =
      summary?.total_upcoming ?? rows.reduce((a, r) => a + toNum(r.total_upcoming), 0);
    const total_closed =
      summary?.total_closed ?? rows.reduce((a, r) => a + toNum(r.total_closed), 0);
    return { total_calls, total_overdue, total_today, total_upcoming, total_closed };
  }, [rows, summary]);

  const headerKpiCards = (
    [
      ["TOTAL CUSTOMERS", String(totalCustomerCount)],
      ["TOTAL CALLS", String(kpis.total_calls)],
      ["TOTAL TODAY", String(kpis.total_today)],
      ["TOTAL UPCOMING", String(kpis.total_upcoming)],
      ["TOTAL CLOSED", String(kpis.total_closed)],
      ["TOTAL OVERDUE", String(kpis.total_overdue)],
    ] as const
  ).map(([label, val]) => (
    <Box
      key={label}
      p={8}
      style={{
        minWidth: 0,
        background: enquiryConversionColors.panelBg,
        border: `1px solid ${enquiryConversionColors.panelBorder}`,
        borderRadius: enquiryConversionColors.radius,
        boxShadow: enquiryConversionColors.shadow,
      }}
    >
      <Text
        fz={8}
        fw={700}
        c="#8FA2B7"
        tt="uppercase"
        lts="0.04em"
        mb={6}
        lineClamp={2}
        style={{ wordBreak: "break-word" }}
      >
        {label}
      </Text>
      <Text fz={18} fw={700} c="#0B1F3A" lh={1.1} truncate>
        {val}
      </Text>
    </Box>
  ));

  if (loading) {
    return (
      <Center py={48}>
        <Loader color="#101C2E" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Box>
        <Group gap={10} align="flex-start" wrap="nowrap">
          <Box
            mt={4}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: DOT,
              flexShrink: 0,
            }}
          />
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} fz={15} c={NAVY} lh={1.35}>
              {(heading ?? "").trim() ? (heading ?? "").trim() : "Customer-wise call entry"}
            </Text>
            {periodLabel ? (
              <Text fz={12} fw={500} c="#94A3B8" mt={6} lh={1.45}>
                {periodLabel}
              </Text>
            ) : null}
          </Box>
        </Group>
      </Box>

      <Box
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        {headerKpiCards}
      </Box>

      <Box>
        <Text fw={700} fz={15} c="#0F172A">
          Customer-wise calls
        </Text>
      </Box>

      <Box
        style={{
          background: enquiryConversionColors.panelBg,
          border: `1px solid ${enquiryConversionColors.panelBorder}`,
          borderRadius: enquiryConversionColors.radius,
          boxShadow: enquiryConversionColors.shadow,
          overflow: "hidden",
        }}
      >
        <Box style={{ overflowX: "auto" }}>
          <Table horizontalSpacing="md" verticalSpacing={12} style={{ minWidth: 720 }}>
            <Table.Thead>
              <Table.Tr style={{ background: "#F8FAFC" }}>
                {[
                  { label: "Customer", ta: "left" as const },
                  { label: "Total", ta: "center" as const },
                  { label: "Overdue", ta: "center" as const },
                  { label: "Today", ta: "center" as const },
                  { label: "Upcoming", ta: "center" as const },
                  { label: "Closed", ta: "center" as const },
                ].map((h) => (
                  <Table.Th
                    key={h.label}
                    fz={10}
                    fw={700}
                    c="#94A3B8"
                    tt="uppercase"
                    ta={h.ta}
                  >
                    {h.label}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text fz={13} c="#94A3B8" py={8}>
                      {emptyMessage}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows.map((r, i) => (
                  <Table.Tr key={r.customer_code || `${r.customer_name}-${i}`}>
                    <Table.Td style={{ verticalAlign: "top", textAlign: "left" }}>
                      <Text fz={13} fw={700} c="#0F172A">
                        {r.customer_name}
                      </Text>
                      {r.customer_code ? (
                        <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                          {r.customer_code}
                        </Text>
                      ) : null}
                    </Table.Td>
                    {(
                      [
                        ["total_calls", r.total_calls],
                        ["total_overdue", r.total_overdue],
                        ["total_today", r.total_today],
                        ["total_upcoming", r.total_upcoming],
                        ["total_closed", r.total_closed],
                      ] as const
                    ).map(([metric, value]) => {
                      const n = toNum(value);
                      const clickable = !!onMetricClick && n > 0;
                      return (
                        <Table.Td
                          key={metric}
                          ta="center"
                          style={{
                            cursor: clickable ? "pointer" : undefined,
                            userSelect: "none",
                          }}
                          onClick={() => {
                            if (clickable && onMetricClick) onMetricClick(metric, r);
                          }}
                        >
                          <Text
                            fz={13}
                            fw={700}
                            c={clickable ? "#0F3D76" : "#0F172A"}
                            style={{
                              textDecoration: clickable ? "underline" : undefined,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {n}
                          </Text>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Box>
    </Stack>
  );
}

