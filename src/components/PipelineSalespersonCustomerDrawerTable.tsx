import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Center,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useBranchNumberFormat } from "../hooks/useBranchNumberFormat";
import { enquiryConversionColors } from "../pages/dashboard/DashboardMaster/EnquiryConversion/enquiryConversionTokens";

const GREEN = "#16A34A";
const RED = "#EF4444";
const NAVY = "#1E3A8A";
const DOT = "#105476";

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
  /** Sales rep name for “Reps breakdown”-style section title in the drawer. */
  salespersonLabel?: string | null;
  /** When set, replaces the default “{salesperson} · Customers breakdown” heading line. */
  breakdownHeading?: string | null;
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
        root: { maxWidth: 64, marginInline: "auto" },
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

export default function PipelineSalespersonCustomerDrawerTable({
  rows,
  rowDrilldownIndices,
  summary,
  salespersonLabel,
  breakdownHeading,
  loading,
  emptyMessage = "No customer rows for this rep.",
  periodLabel,
  onFinancialColumnClick,
  onExpectedEnter,
}: PipelineSalespersonCustomerDrawerTableProps) {
  const { formatAmountFromNumber: formatAmount } = useBranchNumberFormat();

  const kpis = useMemo(() => {
    const pot = summary?.total_potential ?? sumField(rows, "potential");
    const pipe = summary?.total_pipeline ?? sumField(rows, "pipeline");
    const quoted = summary?.total_quoted ?? sumField(rows, "quote");
    const gained = summary?.total_gained ?? sumField(rows, "gained");
    const lost = summary?.total_lost ?? sumField(rows, "lost");
    return { pot, pipe, quoted, gained, lost };
  }, [rows, summary]);

  const repTitle = (salespersonLabel ?? "").trim() || "Sales rep";
  const totalCustomerCount = useMemo(() => {
    const codes = new Set<string>();
    for (const r of rows) {
      const c = String(r.customer_code ?? "").trim();
      if (c) codes.add(c);
    }
    return codes.size > 0 ? codes.size : rows.length;
  }, [rows]);

  const headerKpiCards = (
    [
      ["TOTAL POTENTIAL", formatAmount(kpis.pot)],
      ["TOTAL PIPELINE", formatAmount(kpis.pipe)],
      ["TOTAL QUOTED", formatAmount(kpis.quoted)],
      ["TOTAL GAINED", formatAmount(kpis.gained)],
      ["TOTAL LOST", formatAmount(kpis.lost)],
      ["TOTAL CUSTOMER", String(totalCustomerCount)],
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
              {(breakdownHeading ?? "").trim()
                ? (breakdownHeading ?? "").trim()
                : `${repTitle} · Customers breakdown`}
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
          <Table horizontalSpacing="md" verticalSpacing={12} style={{ minWidth: 640 }}>
            <Table.Thead>
              <Table.Tr style={{ background: "#F8FAFC" }}>
                {[
                  { label: "Customer", ta: "left" as const, w: undefined },
                  { label: "Potential", ta: "center" as const, w: undefined },
                  { label: "Pipeline", ta: "center" as const, w: undefined },
                  { label: "Quoted", ta: "center" as const, w: undefined },
                  { label: "Gained", ta: "center" as const, w: undefined },
                  { label: "Lost", ta: "center" as const, w: undefined },
                  { label: "Expected", ta: "center" as const, w: 72 },
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
                      <Table.Td
                        ta="center"
                        style={{
                          cursor: r.potential > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.potential > 0)
                            onFinancialColumnClick("potential", r);
                        }}
                      >
                        <MetricText n={r.potential} formatAmount={formatAmount} fw={r.potential > 0 ? 600 : 400} />
                      </Table.Td>
                      <Table.Td
                        ta="center"
                        style={{
                          cursor: r.pipeline > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.pipeline > 0)
                            onFinancialColumnClick("pipeline", r);
                        }}
                      >
                        <MetricText n={r.pipeline} formatAmount={formatAmount} fw={r.pipeline > 0 ? 600 : 400} />
                      </Table.Td>
                      <Table.Td
                        ta="center"
                        style={{
                          cursor: r.quote > 0 ? "pointer" : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={() => {
                          if (r.quote > 0) onFinancialColumnClick("quote", r);
                        }}
                      >
                        <MetricText n={r.quote} formatAmount={formatAmount} fw={r.quote > 0 ? 600 : 400} />
                      </Table.Td>
                      <Table.Td
                        ta="center"
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
                          formatAmount={formatAmount}
                          fw={700}
                          c={r.gained > 0 ? GREEN : "#0F172A"}
                        />
                      </Table.Td>
                      <Table.Td
                        ta="center"
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
                          formatAmount={formatAmount}
                          fw={700}
                          c={r.lost > 0 ? RED : "#0F172A"}
                        />
                      </Table.Td>
                      <Table.Td
                        ta="center"
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
