import { useMemo } from "react";
import {
  Box,
  Center,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { useBranchNumberFormat } from "../hooks/useBranchNumberFormat";
import { enquiryConversionColors } from "../pages/dashboard/DashboardMaster/EnquiryConversion/enquiryConversionTokens";
import type { PipelineCustomerProfitRow } from "../pages/dashboard/PipelineReport/pipelineCustomerProfit";

export type PipelineCustomerProfitSummary = {
  total_expected: number;
  total_potential: number;
  total_pipeline: number;
  total_quoted: number;
  total_gained: number;
  total_lost: number;
} | null;

export type PipelineCustomerProfitMetricType =
  | "potential"
  | "pipeline"
  | "gained"
  | "quote"
  | "lost";

export interface PipelineCustomerProfitTableProps {
  title?: string;
  subtitle?: string;
  rows: PipelineCustomerProfitRow[];
  summary?: PipelineCustomerProfitSummary;
  loading?: boolean;
  emptyMessage?: string;
  drillableMetrics?: PipelineCustomerProfitMetricType[];
  onMetricClick?: (
    columnType: PipelineCustomerProfitMetricType,
    row: PipelineCustomerProfitRow
  ) => void;
}

const NAVY = "#1E3A8A";
const DOT = "#105476";
const GREEN = "#16A34A";
const RED = "#EF4444";

function MetricText({
  n,
  formatAmount,
  fw = 400,
  c = "#0F172A",
}: {
  n: number;
  formatAmount: (value: number) => string;
  fw?: number;
  c?: string;
}) {
  return (
    <Text fz={13} fw={fw} c={c} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatAmount(n)}
    </Text>
  );
}

function sumField(
  rows: PipelineCustomerProfitRow[],
  key: keyof PipelineCustomerProfitRow
) {
  return rows.reduce((acc, r) => {
    const v = r[key];
    return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}

export default function PipelineCustomerProfitTable({
  title = "By customer",
  subtitle,
  rows,
  summary,
  loading,
  emptyMessage = "No customer pipeline data",
  drillableMetrics = ["gained", "quote", "lost"],
  onMetricClick,
}: PipelineCustomerProfitTableProps) {
  const { formatAmountFromNumber: formatAmount } = useBranchNumberFormat();

  const tableRows = useMemo(
    () =>
      [...rows]
        .filter(
          (r) =>
            r.customer_name &&
            r.customer_name !== "-" &&
            r.customer_name !== "TOTAL"
        )
        .sort((a, b) => {
          const total = (r: PipelineCustomerProfitRow) =>
            r.gained + r.lost + r.quote + r.expected + r.pipeline + r.potential;
          return total(b) - total(a);
        }),
    [rows]
  );

  const kpis = useMemo(() => {
    const count = tableRows.length;
    const pot = summary?.total_potential ?? sumField(tableRows, "potential");
    const pipe = summary?.total_pipeline ?? sumField(tableRows, "pipeline");
    const quoted = summary?.total_quoted ?? sumField(tableRows, "quote");
    const gained = summary?.total_gained ?? sumField(tableRows, "gained");
    const lost = summary?.total_lost ?? sumField(tableRows, "lost");
    return { pot, pipe, quoted, gained, lost, count };
  }, [tableRows, summary]);

  const headerKpiCards = (
    [
      ["TOTAL POTENTIAL", formatAmount(kpis.pot)],
      ["TOTAL PIPELINE", formatAmount(kpis.pipe)],
      ["TOTAL QUOTED", formatAmount(kpis.quoted)],
      ["TOTAL GAINED", formatAmount(kpis.gained)],
      ["TOTAL LOST", formatAmount(kpis.lost)],
      ["TOTAL CUSTOMERS", String(kpis.count)],
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

  const renderDrillableMetric = (
    row: PipelineCustomerProfitRow,
    metric: PipelineCustomerProfitMetricType,
    value: number,
    color?: string
  ) => {
    const canDrill =
      onMetricClick &&
      drillableMetrics.includes(metric) &&
      value > 0;
    return (
      <Table.Td
        ta="center"
        onClick={
          canDrill
            ? (e) => {
                e.stopPropagation();
                onMetricClick(metric, row);
              }
            : undefined
        }
        style={{
          cursor: canDrill ? "pointer" : undefined,
        }}
      >
        <MetricText
          n={value}
          formatAmount={formatAmount}
          fw={canDrill ? 700 : 400}
          c={canDrill ? color ?? GREEN : "#0F172A"}
        />
      </Table.Td>
    );
  };

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
              {title.trim() || "By customer"}
            </Text>
            {subtitle ? (
              <Text fz={12} fw={500} c="#94A3B8" mt={6} lh={1.45}>
                {subtitle}
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
          Customer-wise pipeline
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
          <Table horizontalSpacing="md" verticalSpacing={12} style={{ minWidth: 880 }}>
            <Table.Thead>
              <Table.Tr style={{ background: "#F8FAFC" }}>
                {[
                  "Customer",
                  "Potential",
                  "Pipeline",
                  "Quoted",
                  "Gained",
                  "Lost",
                  "Expected",
                ].map((label, idx) => (
                  <Table.Th
                    key={label}
                    fz={10}
                    fw={700}
                    c="#94A3B8"
                    tt="uppercase"
                    ta={idx === 0 ? "left" : "center"}
                  >
                    {label}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tableRows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text fz={13} c="#94A3B8" py={8}>
                      {emptyMessage}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                tableRows.map((r, i) => {
                  const inProg = Math.max(0, r.quote) + Math.max(0, r.expected);
                  return (
                    <Table.Tr key={`${r.customer_code}-${i}`}>
                      <Table.Td style={{ textAlign: "left", maxWidth: 220 }}>
                        <Tooltip
                          label={r.customer_name}
                          disabled={!r.customer_name?.trim()}
                          withArrow
                          position="top"
                        >
                          <Text fz={13} fw={700} c="#0F172A" lineClamp={2}>
                            {r.customer_name}
                          </Text>
                        </Tooltip>
                        {r.customer_code && r.customer_code !== "-" ? (
                          <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                            {r.customer_code}
                          </Text>
                        ) : null}
                      </Table.Td>
                      {renderDrillableMetric(r, "potential", r.potential)}
                      {renderDrillableMetric(r, "pipeline", r.pipeline)}
                      <Table.Td
                        ta="center"
                        onClick={
                          onMetricClick &&
                          drillableMetrics.includes("quote") &&
                          inProg > 0
                            ? (e) => {
                                e.stopPropagation();
                                onMetricClick("quote", r);
                              }
                            : undefined
                        }
                        style={{
                          cursor:
                            onMetricClick &&
                            drillableMetrics.includes("quote") &&
                            inProg > 0
                              ? "pointer"
                              : undefined,
                        }}
                      >
                        <MetricText
                          n={r.quote}
                          formatAmount={formatAmount}
                          fw={
                            inProg > 0 &&
                            onMetricClick &&
                            drillableMetrics.includes("quote")
                              ? 700
                              : 400
                          }
                          c={
                            inProg > 0 &&
                            onMetricClick &&
                            drillableMetrics.includes("quote")
                              ? GREEN
                              : "#0F172A"
                          }
                        />
                      </Table.Td>
                      {renderDrillableMetric(r, "gained", r.gained, GREEN)}
                      {renderDrillableMetric(r, "lost", r.lost, RED)}
                      <Table.Td ta="center">
                        <MetricText n={r.expected} formatAmount={formatAmount} />
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Box>
    </Stack>
  );
}
