import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Center,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { enquiryConversionColors } from "../pages/dashboard/DashboardMaster/EnquiryConversion/enquiryConversionTokens";

const GREEN = "#16A34A";
const RED = "#EF4444";

export type PipelineCustomerDrawerRow = {
  customer_code: string;
  customer_name: string;
  potential: number;
  pipeline: number;
  gained: number;
  lost: number;
  quote: number;
  expected: number;
};

export type PipelineCustomerDrawerSummary = {
  total_expected: number;
  total_potential: number;
  total_pipeline: number;
  total_quoted: number;
  total_gained: number;
  total_lost: number;
};

export type PipelineFinancialColumnType =
  | "potential"
  | "pipeline"
  | "gained"
  | "quote"
  | "lost";

export interface PipelineSalespersonCustomerDrawerTableProps {
  rows: PipelineCustomerDrawerRow[];
  /** Per-row index in parent `drilldownData` (for expected profit save). */
  rowDrilldownIndices: number[];
  summary: PipelineCustomerDrawerSummary | null;
  loading?: boolean;
  emptyMessage?: string;
  /** Date range label for KPI strip (e.g. "01 Jan 2026 – 31 Jan 2026"). */
  periodLabel?: string;
  onFinancialColumnClick: (
    columnType: PipelineFinancialColumnType,
    row: PipelineCustomerDrawerRow
  ) => void;
  onExpectedEnter: (
    drilldownIndex: number,
    row: PipelineCustomerDrawerRow,
    value: number
  ) => void;
}

function sumField(rows: PipelineCustomerDrawerRow[], key: keyof PipelineCustomerDrawerRow) {
  return rows.reduce((acc, r) => {
    const v = r[key];
    return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}

function KpiCard({
  label,
  value,
  sub,
  valueColor = "#0B1F3A",
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <Box
      p={12}
      style={{
        background: enquiryConversionColors.panelBg,
        border: `1px solid ${enquiryConversionColors.panelBorder}`,
        borderRadius: enquiryConversionColors.radius,
        boxShadow: enquiryConversionColors.shadow,
        minHeight: 88,
      }}
    >
      <Text fz={9} fw={700} c="#8FA2B7" tt="uppercase" lts="0.04em" mb={8}>
        {label}
      </Text>
      <Text fz={24} fw={700} c={valueColor} lh={1.1}>
        {value}
      </Text>
      {sub ? (
        <Text fz={11} fw={600} c="#9AAABD" mt={4}>
          {sub}
        </Text>
      ) : null}
    </Box>
  );
}

function ExpectedEditCell({
  row,
  onEnter,
}: {
  row: PipelineCustomerDrawerRow;
  onEnter: (n: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(row.expected ?? 0));

  useEffect(() => {
    setDraft(String(row.expected ?? 0));
  }, [row.customer_code, row.expected]);

  return (
    <TextInput
      size="xs"
      w={56}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const n = Number(String(draft).replace(/,/g, ""));
          if (Number.isFinite(n)) onEnter(n);
        }
      }}
      styles={{
        root: { maxWidth: 64 },
        input: {
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          minWidth: 0,
          width: 56,
          paddingInline: 6,
          fontSize: 11,
          minHeight: 28,
        },
      }}
    />
  );
}

function MetricText({
  n,
  fw = 400,
  c = "#0F172A",
}: {
  n: number;
  fw?: number;
  c?: string;
}) {
  return (
    <Text fz={13} fw={fw} c={c} style={{ fontVariantNumeric: "tabular-nums" }}>
      {Math.round(n).toLocaleString("en-IN")}
    </Text>
  );
}

export default function PipelineSalespersonCustomerDrawerTable({
  rows,
  rowDrilldownIndices,
  summary,
  loading,
  emptyMessage = "No customer rows for this rep.",
  periodLabel,
  onFinancialColumnClick,
  onExpectedEnter,
}: PipelineSalespersonCustomerDrawerTableProps) {
  const kpis = useMemo(() => {
    const count = rows.length;
    const pot = summary?.total_potential ?? sumField(rows, "potential");
    const pipe = summary?.total_pipeline ?? sumField(rows, "pipeline");
    const gained = summary?.total_gained ?? sumField(rows, "gained");
    const lost = summary?.total_lost ?? sumField(rows, "lost");
    const quoted = summary?.total_quoted ?? sumField(rows, "quote");
    const exp = summary?.total_expected ?? sumField(rows, "expected");
    return { count, pot, pipe, gained, lost, quoted, exp };
  }, [rows, summary]);

  if (loading) {
    return (
      <Center py={48}>
        <Loader color="#101C2E" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={12}>
        <KpiCard
          label="Customers"
          value={kpis.count.toLocaleString("en-IN")}
          sub={periodLabel}
        />
        <KpiCard label="Potential" value={Math.round(kpis.pot).toLocaleString("en-IN")} />
        <KpiCard label="Pipeline" value={Math.round(kpis.pipe).toLocaleString("en-IN")} />
        <KpiCard
          label="Gained"
          value={Math.round(kpis.gained).toLocaleString("en-IN")}
          valueColor={GREEN}
        />
        <KpiCard
          label="Lost"
          value={Math.round(kpis.lost).toLocaleString("en-IN")}
          valueColor={kpis.lost > 0 ? RED : "#0B1F3A"}
        />
        <KpiCard
          label="Quoted"
          value={Math.round(kpis.quoted).toLocaleString("en-IN")}
        />
        <KpiCard
          label="Expected profit"
          value={Math.round(kpis.exp).toLocaleString("en-IN")}
        />
      </SimpleGrid>

      <Box>
        <Text fw={700} fz={15} c="#0F172A">
          Customer-wise pipeline
        </Text>
        <Text fz={12} fw={500} c="#94A3B8" mt={4}>
          Click a number to open details (where available)
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
          <Table horizontalSpacing="md" verticalSpacing={12} style={{ minWidth: 640 }}>
            <Table.Thead>
              <Table.Tr style={{ background: "#F8FAFC" }}>
                {[
                  { label: "Customer", ta: "left" as const, w: undefined },
                  { label: "Potential", ta: "right" as const, w: undefined },
                  { label: "Pipeline", ta: "right" as const, w: undefined },
                  { label: "Quoted", ta: "right" as const, w: undefined },
                  { label: "Gained", ta: "right" as const, w: undefined },
                  { label: "Lost", ta: "right" as const, w: undefined },
                  { label: "Expected", ta: "right" as const, w: 72 },
                ].map((h) => (
                  <Table.Th
                    key={h.label}
                    fz={10}
                    fw={700}
                    c="#94A3B8"
                    tt="uppercase"
                    ta={h.ta}
                    style={h.w ? { width: h.w, maxWidth: h.w } : undefined}
                  >
                    {h.label}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text fz={13} c="#94A3B8" py={8}>
                      {emptyMessage}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows.map((r, i) => {
                  const drillIdx = rowDrilldownIndices[i] ?? i;
                  return (
                    <Table.Tr key={r.customer_code || `${r.customer_name}-${i}`}>
                      <Table.Td style={{ verticalAlign: "top" }}>
                        <Text fz={13} fw={700} c="#0F172A">
                          {r.customer_name}
                        </Text>
                        {r.customer_code ? (
                          <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                            {r.customer_code}
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          cursor: r.potential > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.potential > 0)
                            onFinancialColumnClick("potential", r);
                        }}
                      >
                        <MetricText n={r.potential} fw={r.potential > 0 ? 600 : 400} />
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          cursor: r.pipeline > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.pipeline > 0)
                            onFinancialColumnClick("pipeline", r);
                        }}
                      >
                        <MetricText n={r.pipeline} fw={r.pipeline > 0 ? 600 : 400} />
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          cursor: r.quote > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.quote > 0) onFinancialColumnClick("quote", r);
                        }}
                      >
                        <MetricText n={r.quote} fw={r.quote > 0 ? 600 : 400} />
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          cursor: r.gained > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.gained > 0) onFinancialColumnClick("gained", r);
                        }}
                      >
                        <MetricText
                          n={r.gained}
                          fw={700}
                          c={r.gained > 0 ? GREEN : "#0F172A"}
                        />
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          cursor: r.lost > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.lost > 0) onFinancialColumnClick("lost", r);
                        }}
                      >
                        <MetricText
                          n={r.lost}
                          fw={700}
                          c={r.lost > 0 ? RED : "#0F172A"}
                        />
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          width: 72,
                          maxWidth: 72,
                          verticalAlign: "middle",
                        }}
                      >
                        <ExpectedEditCell
                          row={r}
                          onEnter={(n) => onExpectedEnter(drillIdx, r, n)}
                        />
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
