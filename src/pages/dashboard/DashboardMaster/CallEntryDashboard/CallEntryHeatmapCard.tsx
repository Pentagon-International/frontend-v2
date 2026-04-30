import { Box, Group, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { CallEntryHeatmapRow } from "../../../../service/dashboard.service";

type Props = {
  rows: CallEntryHeatmapRow[];
};

const cardStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  padding: "10px",
} as const;

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function cellColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "#EEF2F7";
  const ratio = value / max;
  if (ratio <= 0.2) return "#E2E8F2";
  if (ratio <= 0.4) return "#D0E1F7";
  if (ratio <= 0.6) return "#9EC5F4";
  if (ratio <= 0.8) return "#5AA1F0";
  return "#357EE6";
}

function cellTextColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "#94A3B8";
  return value / max >= 0.55 ? "#FFFFFF" : "#375069";
}

export function CallEntryHeatmapCard({ rows }: Props) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const visibleRows = rows.slice(0, 6);
  const values = visibleRows.flatMap((row) => row.hours.map((h) => h.count || 0));
  const maxCount = Math.max(...values, 0);
  const nameColWidth = isMobile ? "56px" : "clamp(62px, 18vw, 84px)";
  const cellWidth = isMobile ? "22px" : "clamp(26px, 7vw, 32px)";
  const cellHeight = isMobile ? "20px" : "clamp(20px, 5vw, 24px)";
  const gridMinWidth = isMobile ? 0 : 480;
  const gridGap = isMobile ? 2 : 4;

  return (
    <Box style={cardStyle}>
      <Group justify="space-between" mb={8}>
        <Text fw={700} fz={13} c="#0B1F3A">
          Call Heatmap · Hour × Rep
        </Text>
        <Text fz={10} fw={700} c="#A3B2C2">
          Darker = more calls
        </Text>
      </Group>

      <Box style={{ overflowX: "auto" }}>
        <Group gap={gridGap} wrap="nowrap" mb={6} style={{ minWidth: gridMinWidth }}>
          <Box style={{ width: nameColWidth }} />
          {HOURS.map((hour) => (
            <Text
              key={hour}
              fz={isMobile ? 8 : 10}
              fw={700}
              c="#94A3B8"
              style={{
                width: cellWidth,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {hour}:00
            </Text>
          ))}
        </Group>

        <Stack gap={isMobile ? 4 : 6} style={{ minWidth: gridMinWidth }}>
          {visibleRows.map((row) => (
            <Group key={row.salesperson} gap={gridGap} wrap="nowrap">
              <Text
                fz={isMobile ? 9 : 10}
                c="#64748B"
                style={{ width: nameColWidth, minWidth: 0 }}
                truncate
              >
                {row.salesperson}
              </Text>
              {HOURS.map((hour) => {
                const entry = row.hours.find((h) => h.hour === hour);
                const value = entry?.count || 0;
                const bg = cellColor(value, maxCount);
                return (
                  <Box
                    key={`${row.salesperson}-${hour}`}
                    style={{
                      width: cellWidth,
                      minWidth: isMobile ? 22 : 26,
                      height: cellHeight,
                      borderRadius: 2,
                      background: bg,
                      border: "1px solid #E6EDF5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      fz={isMobile ? 8 : 9}
                      fw={700}
                      c={cellTextColor(value, maxCount)}
                      style={{ lineHeight: 1 }}
                    >
                      {value}
                    </Text>
                  </Box>
                );
              })}
            </Group>
          ))}
          {visibleRows.length === 0 ? (
            <Text ta="center" c="#94A3B8" fz={12} py={8}>
              No heatmap data available.
            </Text>
          ) : null}
        </Stack>
      </Box>

      <Group justify="space-between" mt={8}>
        <Text fz={9} c="#94A3B8">
          Low
        </Text>
        <Group gap={4}>
          <Box w={16} h={6} bg="#DBEAFE" />
          <Box w={16} h={6} bg="#BFDBFE" />
          <Box w={16} h={6} bg="#93C5FD" />
          <Box w={16} h={6} bg="#60A5FA" />
          <Box w={16} h={6} bg="#3B82F6" />
        </Group>
        <Text fz={9} c="#94A3B8">
          High
        </Text>
      </Group>
    </Box>
  );
}
