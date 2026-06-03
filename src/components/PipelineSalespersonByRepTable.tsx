import { useMemo } from "react";
import {
  Box,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { shortNameLabel } from "./DrilldownHorizontalBarChart";
import { useBranchNumberFormat } from "../hooks/useBranchNumberFormat";
import { enquiryConversionColors } from "../pages/dashboard/DashboardMaster/EnquiryConversion/enquiryConversionTokens";

export type PipelineSalespersonRepRow = {
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

export type PipelineSalespersonRepSummary = {
  total_expected: number;
  total_potential: number;
  total_pipeline: number;
  total_quoted: number;
  total_gained: number;
  total_lost: number;
} | null;

export type PipelineSalespersonFinancialColumnType =
  | "potential"
  | "pipeline"
  | "gained"
  | "quote"
  | "lost";

export interface PipelineSalespersonByRepTableProps {
  title?: string;
  subtitle?: string;
  rows: PipelineSalespersonRepRow[];
  summary?: PipelineSalespersonRepSummary;
  loading?: boolean;
  onRowClick?: (row: PipelineSalespersonRepRow) => void;
  onFinancialColumnClick?: (
    columnType: PipelineSalespersonFinancialColumnType,
    row: PipelineSalespersonRepRow
  ) => void;
  emptyMessage?: string;
  /** Shown under each rep name (e.g. reporting period); same for all rows if only one string is needed */
  getRepSubline?: (row: PipelineSalespersonRepRow) => string | undefined;
}

const BASE_NUMBER_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

/** Potential & Pipeline — tabular numbers, centered under column titles */
const METRIC_NUMERIC: React.CSSProperties = {
  ...BASE_NUMBER_STYLE,
  textAlign: "center",
};

/** Shown beside compact bar (number is primary; bar is visual cue) */
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

/** Salesman capped width; reporting to compact — avoid fr growth that gaps the two name columns */
const GRID_TEMPLATE =
  "minmax(108px, 152px) minmax(64px, 92px) minmax(0, 0.34fr) minmax(0, 0.4fr) minmax(0, 0.4fr) minmax(0, 0.64fr) minmax(0, 0.64fr) minmax(0, 0.64fr)";

const GRID_COLUMN_GAP = 4;

/** Max width of striped bar track (values carry precision) */
const BAR_TRACK_W = 64;

const BAR_H = 16;

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
      gap={4}
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

function CoordinatorCell({ name }: { name?: string }) {
  const display = name?.trim() || "—";
  const text = (
    <Text
      fz={11}
      fw={500}
      c={enquiryConversionColors.heading}
      lineClamp={1}
      truncate
      style={{
        textAlign: "center",
        minWidth: 0,
        lineHeight: 1.3,
      }}
    >
      {display}
    </Text>
  );

  if (display === "—") {
    return <Box style={{ minWidth: 0, paddingInline: "0 2px" }}>{text}</Box>;
  }

  return (
    <Tooltip label={display} multiline w={280} withArrow position="top">
      <Box style={{ minWidth: 0, paddingInline: "0 2px", cursor: "default" }}>
        {text}
      </Box>
    </Tooltip>
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
  summary,
  loading,
  onRowClick,
  onFinancialColumnClick,
  emptyMessage = "No salesperson pipeline data",
  getRepSubline,
}: PipelineSalespersonByRepTableProps) {
  const { formatAmountFromNumber: formatAmount } = useBranchNumberFormat();

  const prepared = useMemo(() => {
    const list = rows.filter(
      (r) =>
        r.salesperson && r.salesperson !== "-" && r.salesperson !== "TOTAL",
    );
    const maxInProgress = Math.max(
      1,
      ...list.map((r) => Math.max(0, r.quote) + Math.max(0, r.expected)),
    );
    const maxGained = Math.max(1, ...list.map((r) => Math.max(0, r.gained)));
    const maxLost = Math.max(1, ...list.map((r) => Math.max(0, r.lost)));
    return { displayRows: list, maxInProgress, maxGained, maxLost };
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

  if (!prepared.displayRows.length) {
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
    <Stack
      gap="md"
      style={{
        width: "100%",
        minWidth: 0,
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
              columnGap: GRID_COLUMN_GAP,
              alignItems: "center",
              paddingBottom: 8,
              borderBottom: "1px solid #e2e8f0",
              marginBottom: 2,
            }}
          >
            <Box style={{ paddingInline: "4px 0", minWidth: 0 }}>
              {headerCell("Salesman", "left")}
            </Box>
            <Box style={{ minWidth: 0, paddingInline: "0 2px" }}>
              {headerCell("Reporting to")}
            </Box>
            {headerCell("Branch")}
            {headerCell("Potential")}
            {headerCell("Pipeline")}
            {headerCell("Gained")}
            {headerCell("In progress")}
            {headerCell("Lost")}
          </Box>

          {prepared.displayRows.map((row) => {
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
                  columnGap: GRID_COLUMN_GAP,
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
                    padding: "6px 0 6px 4px",
                  }}
                >
                  <Tooltip
                    label={row.salesperson.trim()}
                    disabled={!row.salesperson?.trim()}
                    withArrow
                    position="top"
                  >
                    <Text
                      fz={12}
                      fw={700}
                      c={enquiryConversionColors.heading}
                      lh={1.25}
                      truncate
                      style={{ minWidth: 0, display: "block" }}
                    >
                      {shortNameLabel(row.salesperson)}
                    </Text>
                  </Tooltip>
                  {sub ? (
                    <Text
                      fz={10}
                      fw={500}
                      c={enquiryConversionColors.muted}
                      mt={2}
                      lh={1.25}
                      lineClamp={1}
                    >
                      {sub}
                    </Text>
                  ) : null}
                </Box>
                <CoordinatorCell name={row.coordinator_name} />
                <Text
                  fz={12}
                  fw={500}
                  c={enquiryConversionColors.heading}
                  style={{
                    ...METRIC_NUMERIC,
                    textAlign: "center",
                    minWidth: 0,
                  }}
                >
                  {row.branch_code?.trim() || "—"}
                </Text>
                <Text
                  style={{
                    ...METRIC_NUMERIC,
                    minWidth: 0,
                    cursor:
                      onFinancialColumnClick && row.potential > 0
                        ? "pointer"
                        : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFinancialColumnClick && row.potential > 0) {
                      onFinancialColumnClick("potential", row);
                    }
                  }}
                >
                  {formatAmount(row.potential)}
                </Text>
                <Text
                  style={{
                    ...METRIC_NUMERIC,
                    minWidth: 0,
                    cursor:
                      onFinancialColumnClick && row.pipeline > 0
                        ? "pointer"
                        : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFinancialColumnClick && row.pipeline > 0) {
                      onFinancialColumnClick("pipeline", row);
                    }
                  }}
                >
                  {formatAmount(row.pipeline)}
                </Text>
                <Box
                  style={{
                    cursor:
                      onFinancialColumnClick && row.gained > 0
                        ? "pointer"
                        : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFinancialColumnClick && row.gained > 0) {
                      onFinancialColumnClick("gained", row);
                    }
                  }}
                >
                  <ValueAndCompactBar valueLabel={formatAmount(row.gained)}>
                    <SingleBar
                      value={row.gained}
                      max={prepared.maxGained}
                      fill={BAR_FILLS.gained}
                    />
                  </ValueAndCompactBar>
                </Box>
                <Box
                  style={{
                    cursor:
                      onFinancialColumnClick && inProg > 0
                        ? "pointer"
                        : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFinancialColumnClick && inProg > 0) {
                      onFinancialColumnClick("quote", row);
                    }
                  }}
                >
                  <ValueAndCompactBar valueLabel={formatAmount(inProg)}>
                    <InProgressStackedBar
                      quote={row.quote}
                      expected={row.expected}
                      maxSum={prepared.maxInProgress}
                    />
                  </ValueAndCompactBar>
                </Box>
                <Box
                  style={{
                    cursor:
                      onFinancialColumnClick && row.lost > 0
                        ? "pointer"
                        : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFinancialColumnClick && row.lost > 0) {
                      onFinancialColumnClick("lost", row);
                    }
                  }}
                >
                  <ValueAndCompactBar valueLabel={formatAmount(row.lost)}>
                    <SingleBar
                      value={row.lost}
                      max={prepared.maxLost}
                      fill={BAR_FILLS.lost}
                    />
                  </ValueAndCompactBar>
                </Box>
              </Box>
            );
          })}

          {summary ? (
            <TotalsFooterRow
              gridTemplate={GRID_TEMPLATE}
              labelLeading="Total"
              labelTrailing={`${prepared.displayRows.length} salespersons`}
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
        columnGap: GRID_COLUMN_GAP,
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
          padding: "4px 4px",
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
      <Box />
      <Box />
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(potential)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(pipeline)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(gained)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(inProgress)}</Text>
      <Text style={TOTAL_NUMBER_STYLE}>{formatAmount(lost)}</Text>
    </Box>
  );
}

export default PipelineSalespersonByRepTable;
