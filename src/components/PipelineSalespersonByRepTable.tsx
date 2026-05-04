import { useMemo } from "react";
import { Box, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { shortNameLabel } from "./DrilldownHorizontalBarChart";

export type PipelineSalespersonRepRow = {
  salesperson: string;
  potential: number;
  pipeline: number;
  gained: number;
  lost: number;
  quote: number;
  expected: number;
};

export interface PipelineSalespersonByRepTableProps {
  title?: string;
  subtitle?: string;
  rows: PipelineSalespersonRepRow[];
  loading?: boolean;
  onRowClick?: (row: PipelineSalespersonRepRow) => void;
  emptyMessage?: string;
  /** Shown under each rep name (e.g. reporting period); same for all rows if only one string is needed */
  getRepSubline?: (row: PipelineSalespersonRepRow) => string | undefined;
}

/** Potential & Pipeline — tabular numbers, centered under column titles */
const METRIC_NUMERIC: React.CSSProperties = {
  fontSize: 12,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
};

/** Shown beside compact bar (number is primary; bar is visual cue) */
const BAR_VALUE_LABEL: React.CSSProperties = {
  fontSize: 11,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  color: "#64748b",
  whiteSpace: "nowrap",
};

const BAR_FILLS = {
  quote: "linear-gradient(90deg, #c4a87a, #d3b88c)",
  expected: "linear-gradient(90deg, #c2410c, #fb923c)",
  gained: "linear-gradient(90deg, #15803d, #22c55e)",
  lost: "linear-gradient(90deg, #991b1b, #dc2626)",
} as const;

const STRIPED_TRACK =
  "repeating-linear-gradient(-45deg, #f1f5f9, #f1f5f9 4px, #e8ecf1 4px, #e8ecf1 8px)";

/** Tighter salesman + metrics; compact bar columns (Gained | In progress | Lost) */
const GRID_TEMPLATE =
  "minmax(68px, 0.75fr) minmax(72px, 0.48fr) minmax(72px, 0.48fr) minmax(118px, 0.62fr) minmax(118px, 0.62fr) minmax(118px, 0.62fr)";

/** Max width of striped bar track (values carry precision) */
const BAR_TRACK_W = 80;

const BAR_H = 16;

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

function StripedBarTrack({ children }: { children: React.ReactNode }) {
  return (
    <Box
      style={{
        position: "relative",
        height: BAR_H,
        borderRadius: 6,
        overflow: "hidden",
        background: STRIPED_TRACK,
      }}
    >
      {children}
    </Box>
  );
}

function SingleBar({
  value,
  max,
  fill,
}: {
  value: number;
  max: number;
  fill: string;
}) {
  const pct = max > 0 ? Math.min(100, (100 * Math.max(0, value)) / max) : 0;
  return (
    <StripedBarTrack>
      <Box
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          background: fill,
        }}
      />
    </StripedBarTrack>
  );
}

function ValueAndCompactBar({
  valueLabel,
  children,
}: {
  valueLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Group
      gap={6}
      justify="center"
      align="center"
      wrap="nowrap"
      style={{ width: "100%", minWidth: 0 }}
    >
      <Text style={BAR_VALUE_LABEL}>{valueLabel}</Text>
      <Box
        style={{
          width: BAR_TRACK_W,
          flex: "0 0 auto",
          maxWidth: "100%",
        }}
      >
        {children}
      </Box>
    </Group>
  );
}

function InProgressStackedBar({
  quote,
  expected,
  maxSum,
}: {
  quote: number;
  expected: number;
  maxSum: number;
}) {
  const q = Math.max(0, quote);
  const e = Math.max(0, expected);
  const sum = q + e;
  const outerPct = maxSum > 0 ? Math.min(100, (100 * sum) / maxSum) : 0;

  return (
    <StripedBarTrack>
      <Box
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${outerPct}%`,
          display: "flex",
          flexDirection: "row",
        }}
      >
        {sum <= 0 ? null : (
          <>
            <Box
              style={{
                flexGrow: Math.max(q, 1e-6),
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                background: BAR_FILLS.quote,
              }}
            />
            <Box
              style={{
                flexGrow: Math.max(e, 1e-6),
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                background: BAR_FILLS.expected,
              }}
            />
          </>
        )}
      </Box>
    </StripedBarTrack>
  );
}

function PipelineSalespersonByRepTable({
  title = "By sales rep",
  subtitle,
  rows,
  loading,
  onRowClick,
  emptyMessage = "No salesperson pipeline data",
  getRepSubline,
}: PipelineSalespersonByRepTableProps) {
  const prepared = useMemo(() => {
    const list = rows.filter(
      (r) => r.salesperson && r.salesperson !== "-" && r.salesperson !== "TOTAL"
    );
    const maxInProgress = Math.max(
      1,
      ...list.map((r) => Math.max(0, r.quote) + Math.max(0, r.expected))
    );
    const maxGained = Math.max(1, ...list.map((r) => Math.max(0, r.gained)));
    const maxLost = Math.max(1, ...list.map((r) => Math.max(0, r.lost)));
    const sorted = [...list].sort((a, b) => {
      const sa =
        Math.max(0, a.quote) +
        Math.max(0, a.expected) +
        Math.max(0, a.gained) +
        Math.max(0, a.lost);
      const sb =
        Math.max(0, b.quote) +
        Math.max(0, b.expected) +
        Math.max(0, b.gained) +
        Math.max(0, b.lost);
      return sb - sa;
    });
    return { sorted, maxInProgress, maxGained, maxLost };
  }, [rows]);

  if (loading) {
    return (
      <Box py="xl" px="md">
        <Center>
          <Loader color="#105476" size="md" />
        </Center>
      </Box>
    );
  }

  if (!prepared.sorted.length) {
    return (
      <Box py="xl" px="md">
        <Text size="sm" c="dimmed" ta="center">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  const headerCell = (label: string) => (
    <Text
      size="xs"
      fw={600}
      c="dimmed"
      tt="uppercase"
      ta="center"
      style={{
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </Text>
  );

  return (
    <Stack
      gap="md"
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "16px 14px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Box>
        <Text size="lg" fw={700} c="#1a1a1a" lh={1.3}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="sm" c="dimmed" mt={6} lh={1.5}>
            {subtitle}
          </Text>
        ) : null}
      </Box>

      <Box style={{ overflowX: "auto", width: "100%" }}>
        <Box style={{ width: "100%", minWidth: 0 }}>
          <Box
            style={{
              display: "grid",
              gridTemplateColumns: GRID_TEMPLATE,
              columnGap: 8,
              alignItems: "center",
              paddingBottom: 8,
              borderBottom: "1px solid #e2e8f0",
              marginBottom: 2,
            }}
          >
            {headerCell("Salesman")}
            {headerCell("Potential")}
            {headerCell("Pipeline")}
            {headerCell("Gained")}
            {headerCell("In progress")}
            {headerCell("Lost")}
          </Box>

          {prepared.sorted.map((row) => {
            const sub = getRepSubline?.(row);
            const inProg = Math.max(0, row.quote) + Math.max(0, row.expected);
            return (
              <Box
                key={row.salesperson}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID_TEMPLATE,
                  columnGap: 8,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #eef2f7",
                  cursor: onRowClick ? "pointer" : "default",
                }}
              >
                <Box
                  style={{
                    minWidth: 0,
                    textAlign: "center",
                    paddingInline: 2,
                  }}
                >
                  <Text size="xs" fw={700} c="#111" lh={1.25}>
                    {shortNameLabel(row.salesperson)}
                  </Text>
                  {sub ? (
                    <Text size="xs" c="dimmed" mt={2} lh={1.35}>
                      {sub}
                    </Text>
                  ) : null}
                </Box>
                <Text style={METRIC_NUMERIC}>{formatAmount(row.potential)}</Text>
                <Text style={METRIC_NUMERIC}>{formatAmount(row.pipeline)}</Text>
                <ValueAndCompactBar valueLabel={formatAmount(row.gained)}>
                  <SingleBar
                    value={row.gained}
                    max={prepared.maxGained}
                    fill={BAR_FILLS.gained}
                  />
                </ValueAndCompactBar>
                <ValueAndCompactBar valueLabel={formatAmount(inProg)}>
                  <InProgressStackedBar
                    quote={row.quote}
                    expected={row.expected}
                    maxSum={prepared.maxInProgress}
                  />
                </ValueAndCompactBar>
                <ValueAndCompactBar valueLabel={formatAmount(row.lost)}>
                  <SingleBar
                    value={row.lost}
                    max={prepared.maxLost}
                    fill={BAR_FILLS.lost}
                  />
                </ValueAndCompactBar>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Stack>
  );
}

export default PipelineSalespersonByRepTable;
