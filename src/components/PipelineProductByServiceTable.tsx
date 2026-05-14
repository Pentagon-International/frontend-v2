import { useMemo } from "react";
import { Box, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { enquiryConversionColors } from "../pages/dashboard/DashboardMaster/EnquiryConversion/enquiryConversionTokens";

export type PipelineProductByServiceRow = {
  service: string;
  service_type: string;
  service_original?: string;
  potential: number;
  pipeline: number;
  gained: number;
  lost: number;
  quote: number;
  expected: number;
};

export type PipelineProductByServiceSummary = {
  total_expected: number;
  total_potential: number;
  total_pipeline: number;
  total_quoted: number;
  total_gained: number;
  total_lost: number;
} | null;

export interface PipelineProductByServiceTableProps {
  title?: string;
  subtitle?: string;
  rows: PipelineProductByServiceRow[];
  summary?: PipelineProductByServiceSummary;
  loading?: boolean;
  onRowClick?: (row: PipelineProductByServiceRow) => void;
  emptyMessage?: string;
}

const BASE_NUMBER_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

const METRIC_NUMERIC: React.CSSProperties = {
  ...BASE_NUMBER_STYLE,
  textAlign: "center",
};

const BAR_VALUE_LABEL: React.CSSProperties = {
  ...BASE_NUMBER_STYLE,
  textAlign: "right",
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

const GRID_TEMPLATE =
  "minmax(100px, 0.85fr) minmax(72px, 0.48fr) minmax(72px, 0.48fr) minmax(118px, 0.62fr) minmax(118px, 0.62fr) minmax(118px, 0.62fr)";

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

function rowKey(r: PipelineProductByServiceRow, i: number) {
  return `${r.service_original ?? ""}-${r.service_type}-${r.service}-${i}`;
}

export default function PipelineProductByServiceTable({
  title = "By product",
  subtitle,
  rows,
  summary,
  loading,
  onRowClick,
  emptyMessage = "No product pipeline data",
}: PipelineProductByServiceTableProps) {
  const prepared = useMemo(() => {
    const list = rows.filter(
      (r) =>
        r.service &&
        r.service !== "-" &&
        r.service !== "TOTAL" &&
        !(r as { _isTotalRow?: boolean })._isTotalRow
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

  const headerCell = (label: string, ta: "left" | "center" = "center") => (
    <Text
      size="xs"
      fw={600}
      c="dimmed"
      tt="uppercase"
      ta={ta}
      style={{
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </Text>
  );

  return (
    <Box style={{ overflowX: "auto", width: "100%" }}>
      <Stack
        gap="md"
        style={{
          width: "max-content",
          minWidth: "100%",
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

        <Box style={{ width: "100%" }}>
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
              <Box style={{ paddingInline: 12 }}>
                {headerCell("Product", "left")}
              </Box>
              {headerCell("Potential")}
              {headerCell("Pipeline")}
              {headerCell("Gained")}
              {headerCell("In progress")}
              {headerCell("Lost")}
            </Box>

            {prepared.sorted.map((row, idx) => {
              const inProg = Math.max(0, row.quote) + Math.max(0, row.expected);
              return (
                <Box
                  key={rowKey(row, idx)}
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
                      textAlign: "left",
                      padding: "11px 12px",
                    }}
                  >
                    <Text fz={13} fw={700} c={enquiryConversionColors.heading} lh={1.35}>
                      {row.service}
                    </Text>
                    {row.service_type ? (
                      <Text
                        fz={11}
                        fw={500}
                        c={enquiryConversionColors.muted}
                        mt={2}
                        lh={1.35}
                      >
                        {row.service_type}
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

            {summary ? (
              <TotalsFooterRow
                gridTemplate={GRID_TEMPLATE}
                labelLeading="Total"
                labelTrailing={`${prepared.sorted.length} products`}
                potential={summary.total_potential}
                pipeline={summary.total_pipeline}
                gained={summary.total_gained}
                inProgress={
                  Math.max(0, summary.total_quoted) +
                  Math.max(0, summary.total_expected)
                }
                lost={summary.total_lost}
                formatAmount={formatAmount}
              />
            ) : null}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

function TotalsFooterRow({
  gridTemplate,
  labelLeading,
  labelTrailing,
  potential,
  pipeline,
  gained,
  inProgress,
  lost,
  formatAmount,
}: {
  gridTemplate: string;
  labelLeading: string;
  labelTrailing?: string;
  potential: number;
  pipeline: number;
  gained: number;
  inProgress: number;
  lost: number;
  formatAmount: (n: number) => string;
}) {
  const TOTAL_NUMBER_STYLE: React.CSSProperties = {
    ...BASE_NUMBER_STYLE,
    fontSize: 13,
    fontWeight: 700,
    color: enquiryConversionColors.heading,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <Box
      style={{
        display: "grid",
        gridTemplateColumns: gridTemplate,
        columnGap: 8,
        alignItems: "center",
        padding: "12px 0",
        marginTop: 4,
        borderTop: "2px solid #cbd5e1",
        background: "#f8fafc",
        borderRadius: 6,
      }}
    >
      <Box
        style={{
          minWidth: 0,
          textAlign: "left",
          padding: "4px 12px",
        }}
      >
        <Text
          fz={13}
          fw={800}
          tt="uppercase"
          c={enquiryConversionColors.heading}
          lh={1.35}
          style={{ letterSpacing: "0.04em" }}
        >
          {labelLeading}
        </Text>
        {labelTrailing ? (
          <Text
            fz={11}
            fw={500}
            c={enquiryConversionColors.muted}
            mt={2}
            lh={1.35}
          >
            {labelTrailing}
          </Text>
        ) : null}
      </Box>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(potential)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(pipeline)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(gained)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(inProgress)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(lost)}</Text>
    </Box>
  );
}
