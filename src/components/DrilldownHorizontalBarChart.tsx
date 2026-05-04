import { useMemo } from "react";
import { Box, Center, Group, Loader, Stack, Text } from "@mantine/core";

/** One portion of a stacked bar (solid or CSS gradient) */
export interface DrilldownBarSegment {
  id: string;
  label: string;
  value: number;
  /** CSS `background` value (e.g. color or `linear-gradient(...)`) */
  fill: string;
}

export interface DrilldownHorizontalBarChartRow<T = unknown> {
  id: string;
  label: string;
  /** When set, row shows a stacked bar + legend for each segment with value > 0 */
  segments?: DrilldownBarSegment[];
  /** Legacy single-metric row (used when `segments` is absent or empty) */
  numerator?: number;
  denominator?: number;
  valuePercent?: number;
  /** Optional sort key; default is sum of segment values or valuePercent */
  sortValue?: number;
  meta?: T;
}

export interface DrilldownHorizontalBarChartProps<T = unknown> {
  title: string;
  subtitle?: string;
  rows: DrilldownHorizontalBarChartRow<T>[];
  /** Benchmark line (0–100), only for legacy single-metric rows */
  targetPercent?: number | null;
  loading?: boolean;
  onRowClick?: (row: DrilldownHorizontalBarChartRow<T>) => void;
  isRowDisabled?: (row: DrilldownHorizontalBarChartRow<T>) => boolean;
  emptyMessage?: string;
  maxHeight?: React.CSSProperties["maxHeight"];
  maxWidth?: React.CSSProperties["maxWidth"];
}

/** Outer track + inner bars (rows use a slimmer bar for denser lists) */
const BAR_ROW_RADIUS = 5;
const BAR_TRACK_HEIGHT = 18;

function computePercent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.min(100, Math.max(0, (100 * numerator) / denominator));
}

function barColorForPercent(
  pct: number,
  target: number | null | undefined
): string {
  if (target == null || Number.isNaN(target)) {
    if (pct >= 30) return "#16a34a";
    if (pct >= 25) return "#105476";
    return "#ea580c";
  }
  if (pct >= target + 3) return "#16a34a";
  if (pct <= target - 3) return "#ea580c";
  return "#105476";
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

export function shortNameLabel(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed || trimmed === "-") return "-";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const p = parts[0];
    return p.length > 14 ? `${p.slice(0, 12)}…` : p;
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first.charAt(0).toUpperCase()}. ${last}`;
}

function rowSortScore<T>(row: DrilldownHorizontalBarChartRow<T>): number {
  if (row.sortValue != null && Number.isFinite(row.sortValue)) {
    return row.sortValue;
  }
  if (row.segments !== undefined) {
    return row.segments.reduce(
      (s, x) => s + (Number(x.value) || 0),
      0
    );
  }
  return (
    row.valuePercent ??
    computePercent(row.numerator ?? 0, row.denominator ?? 0)
  );
}

function DrilldownHorizontalBarChart<T>({
  title,
  subtitle,
  rows,
  targetPercent,
  loading,
  onRowClick,
  isRowDisabled,
  emptyMessage = "No data",
  maxHeight = "62vh",
  maxWidth = "min(100%, 1100px)",
}: DrilldownHorizontalBarChartProps<T>) {
  const showTarget =
    targetPercent != null &&
    Number.isFinite(targetPercent) &&
    targetPercent >= 0 &&
    targetPercent <= 100;

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => rowSortScore(b) - rowSortScore(a));
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

  if (!sortedRows.length) {
    return (
      <Box py="xl" px="md">
        <Text size="sm" c="dimmed" ta="center">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <Stack
      gap="md"
      style={{
        maxHeight,
        maxWidth,
        width: "100%",
        marginInline: "auto",
        overflowY: "auto",
        padding: "16px 20px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Box>
        <Text size="md" fw={700} c="#1a1a1a" lh={1.35}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" c="dimmed" mt={4} lh={1.45}>
            {subtitle}
          </Text>
        ) : null}
      </Box>

      <Stack gap="sm" pb={2}>
        {sortedRows.map((row) => {
          const useSegmentsLayout = row.segments !== undefined;
          const segments =
            row.segments?.filter((s) => (Number(s.value) || 0) > 0) ?? [];
          const disabled = isRowDisabled?.(row) ?? false;
          const clickable = Boolean(onRowClick) && !disabled;

          const segmentTotal = useSegmentsLayout
            ? segments.reduce((s, x) => s + (Number(x.value) || 0), 0)
            : 0;

          return (
            <Box
              key={row.id}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => {
                if (clickable) onRowClick?.(row);
              }}
              onKeyDown={(e) => {
                if (
                  clickable &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  onRowClick?.(row);
                }
              }}
              style={{
                display: "grid",
                gridTemplateColumns: useSegmentsLayout
                  ? "minmax(88px, 118px) minmax(0, 1fr)"
                  : "minmax(88px, 118px) minmax(0, 1fr) minmax(100px, 132px)",
                alignItems: "start",
                columnGap: 12,
                rowGap: 6,
                padding: "8px 12px",
                borderRadius: 8,
                backgroundColor: "#f8fafc",
                border: "1px solid #eef2f7",
                cursor: clickable ? "pointer" : "default",
                opacity: disabled ? 0.45 : 1,
              }}
            >
              <Text
                size="xs"
                fw={600}
                c="#1a1a1a"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  paddingTop: 2,
                  lineHeight: 1.35,
                }}
              >
                {row.label}
              </Text>

              {useSegmentsLayout ? (
                <Stack gap={6} style={{ minWidth: 0 }}>
                  <Box
                    style={{
                      position: "relative",
                      height: BAR_TRACK_HEIGHT,
                      minWidth: 0,
                      borderRadius: BAR_ROW_RADIUS,
                      overflow: "hidden",
                      backgroundColor: "#e9ecef",
                    }}
                  >
                    {segmentTotal > 0 ? (
                      <Box
                        style={{
                          display: "flex",
                          height: "100%",
                          width: "100%",
                          flexDirection: "row",
                        }}
                      >
                        {segments.map((seg) => (
                          <Box
                            key={seg.id}
                            title={`${seg.label}: ${formatAmount(seg.value)}`}
                            style={{
                              flexGrow: Math.max(seg.value, 0),
                              flexShrink: 1,
                              flexBasis: 0,
                              minWidth: 2,
                              background: seg.fill,
                            }}
                          />
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                  {segments.length > 0 ? (
                    <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                      <Group gap="xs" wrap="wrap" justify="flex-start">
                        {segments.map((seg) => (
                          <Group key={seg.id} gap={6} wrap="nowrap" align="center">
                            <Box
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 2,
                                background: seg.fill,
                                flexShrink: 0,
                              }}
                            />
                            <Text
                              size="xs"
                              c="#495057"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {seg.label}{" "}
                              <Text span fw={600} c="#1a1a1a" size="xs">
                                {formatAmount(seg.value)}
                              </Text>
                            </Text>
                          </Group>
                        ))}
                      </Group>
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        Total {formatAmount(segmentTotal)}
                      </Text>
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">
                      No status amounts greater than zero
                    </Text>
                  )}
                </Stack>
              ) : (
                <>
                  <Box
                    style={{
                      position: "relative",
                      height: BAR_TRACK_HEIGHT,
                      minWidth: 0,
                      borderRadius: BAR_ROW_RADIUS,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "#e9ecef",
                      }}
                    />
                    {(() => {
                      const pct =
                        row.valuePercent ??
                        computePercent(
                          row.numerator ?? 0,
                          row.denominator ?? 0
                        );
                      const color = barColorForPercent(pct, targetPercent);
                      return (
                        <Box
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${pct}%`,
                            maxWidth: "100%",
                            backgroundColor: color,
                            transition: "width 0.2s ease",
                          }}
                        />
                      );
                    })()}
                    {showTarget ? (
                      <Box
                        title="Benchmark"
                        style={{
                          position: "absolute",
                          left: `${targetPercent}%`,
                          top: -3,
                          bottom: -3,
                          width: 2,
                          marginLeft: -1,
                          backgroundColor: "#facc15",
                          borderRadius: 1,
                          zIndex: 2,
                          pointerEvents: "none",
                        }}
                      />
                    ) : null}
                  </Box>
                  {(() => {
                    const pct =
                      row.valuePercent ??
                      computePercent(
                        row.numerator ?? 0,
                        row.denominator ?? 0
                      );
                    const denom = row.denominator ?? 0;
                    const num = row.numerator ?? 0;
                    const fractionText =
                      denom > 0 ? `${formatAmount(num)}/${formatAmount(denom)}` : "—";
                    return (
                      <Text
                        size="xs"
                        c="#495057"
                        ta="right"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {pct.toFixed(1)}%{" "}
                        <Text span c="dimmed" size="xs">
                          · {fractionText}
                        </Text>
                      </Text>
                    );
                  })()}
                </>
              )}
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

export default DrilldownHorizontalBarChart;
