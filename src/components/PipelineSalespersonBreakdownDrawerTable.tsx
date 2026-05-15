import { useMemo } from "react";
import { Box, Center, Group, Loader, Stack, Table, Text } from "@mantine/core";
import { enquiryConversionColors } from "../pages/dashboard/DashboardMaster/EnquiryConversion/enquiryConversionTokens";

type DrawerSummary = {
  total_expected: number;
  total_potential: number;
  total_pipeline: number;
  total_quoted: number;
  total_gained: number;
  total_lost: number;
} | null;

export type PipelineSalespersonBreakdownRow = {
  salesperson: string;
  coordinator_name?: string;
  branch_code?: string;
  potential: number;
  pipeline: number;
  gained: number;
  lost: number;
  quote: number;
  expected: number;
};

export interface PipelineSalespersonBreakdownDrawerTableProps {
  rows: PipelineSalespersonBreakdownRow[];
  summary: DrawerSummary;
  breakdownHeading?: string | null;
  periodLabel?: string;
  loading?: boolean;
  emptyMessage?: string;
  onSalespersonClick: (row: PipelineSalespersonBreakdownRow) => void;
}

const NAVY = "#1E3A8A";
const DOT = "#105476";
const GREEN = "#16A34A";
const RED = "#EF4444";

function MetricText({ n, fw = 400, c = "#0F172A" }: { n: number; fw?: number; c?: string }) {
  return (
    <Text fz={13} fw={fw} c={c} style={{ fontVariantNumeric: "tabular-nums" }}>
      {Math.round(n).toLocaleString("en-IN")}
    </Text>
  );
}

function sumField(rows: PipelineSalespersonBreakdownRow[], key: keyof PipelineSalespersonBreakdownRow) {
  return rows.reduce((acc, r) => {
    const v = r[key];
    return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}

export default function PipelineSalespersonBreakdownDrawerTable({
  rows,
  summary,
  breakdownHeading,
  periodLabel,
  loading,
  emptyMessage = "No salesperson rows available.",
  onSalespersonClick,
}: PipelineSalespersonBreakdownDrawerTableProps) {
  const tableRows = useMemo(
    () =>
      rows.filter(
        (r) => r.salesperson && r.salesperson !== "-" && r.salesperson !== "TOTAL"
      ),
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
      ["TOTAL POTENTIAL", Math.round(kpis.pot).toLocaleString("en-IN")],
      ["TOTAL PIPELINE", Math.round(kpis.pipe).toLocaleString("en-IN")],
      ["TOTAL QUOTED", Math.round(kpis.quoted).toLocaleString("en-IN")],
      ["TOTAL GAINED", Math.round(kpis.gained).toLocaleString("en-IN")],
      ["TOTAL LOST", Math.round(kpis.lost).toLocaleString("en-IN")],
      ["TOTAL SALESMAN", String(kpis.count)],
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
          <Box mt={4} style={{ width: 8, height: 8, borderRadius: "50%", background: DOT, flexShrink: 0 }} />
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} fz={15} c={NAVY} lh={1.35}>
              {(breakdownHeading ?? "").trim() || "Salesperson breakdown"}
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
          Salesperson-wise pipeline
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
                  "Salesman",
                  "Reporting to",
                  "Branch",
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
                  <Table.Td colSpan={9}>
                    <Text fz={13} c="#94A3B8" py={8}>
                      {emptyMessage}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                tableRows.map((r, i) => (
                  <Table.Tr key={`${r.salesperson}-${i}`} style={{ cursor: "pointer" }} onClick={() => onSalespersonClick(r)}>
                    <Table.Td style={{ textAlign: "left" }}>
                      <Text fz={13} fw={700} c="#0F172A">
                        {r.salesperson}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text fz={12} fw={500} c="#0F172A" lineClamp={2}>
                        {r.coordinator_name?.trim() || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text fz={12} fw={500} c="#0F172A">
                        {r.branch_code?.trim() || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center"><MetricText n={r.potential} /></Table.Td>
                    <Table.Td ta="center"><MetricText n={r.pipeline} /></Table.Td>
                    <Table.Td ta="center"><MetricText n={r.quote} /></Table.Td>
                    <Table.Td ta="center"><MetricText n={r.gained} fw={700} c={r.gained > 0 ? GREEN : "#0F172A"} /></Table.Td>
                    <Table.Td ta="center"><MetricText n={r.lost} fw={700} c={r.lost > 0 ? RED : "#0F172A"} /></Table.Td>
                    <Table.Td ta="center"><MetricText n={r.expected} /></Table.Td>
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
