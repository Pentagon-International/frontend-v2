import { Box, Group, Stack, Text } from "@mantine/core";
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
  if (value <= 0 || max <= 0) return "#F1F5F9";
  const ratio = value / max;
  if (ratio <= 0.2) return "#E7EEF6";
  if (ratio <= 0.4) return "#BFDBFE";
  if (ratio <= 0.6) return "#93C5FD";
  if (ratio <= 0.8) return "#60A5FA";
  return "#3B82F6";
}

export function CallEntryHeatmapCard({ rows }: Props) {
  const visibleRows = rows.slice(0, 6);
  const values = visibleRows.flatMap((row) => row.hours.map((h) => h.count || 0));
  const maxCount = Math.max(...values, 0);

  return (
    <Box style={cardStyle}>
      <Group justify="space-between" mb={10}>
        <Text fw={700} fz={14} c="#0B1F3A">
          Call Heatmap · Hour × Rep
        </Text>
        <Text fz={10} fw={700} c="#A3B2C2">
          Darker = more calls
        </Text>
      </Group>

      <Box style={{ overflowX: "auto" }}>
        <Group gap={4} wrap="nowrap" mb={6} style={{ minWidth: 520 }}>
          <Box style={{ width: "clamp(66px, 20vw, 92px)" }} />
          {HOURS.map((hour) => (
            <Text
              key={hour}
              fz={10}
              fw={700}
              c="#94A3B8"
              style={{
                width: "clamp(30px, 8vw, 40px)",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {hour}:00
            </Text>
          ))}
        </Group>

        <Stack gap={6} style={{ minWidth: 520 }}>
          {visibleRows.map((row) => (
            <Group key={row.salesperson} gap={4} wrap="nowrap">
              <Text
                fz={11}
                c="#64748B"
                style={{ width: "clamp(66px, 20vw, 92px)", minWidth: 0 }}
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
                      width: "clamp(30px, 8vw, 40px)",
                      minWidth: 30,
                      height: "clamp(22px, 5.6vw, 26px)",
                      borderRadius: 4,
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      fz={10}
                      fw={700}
                      c={value > 0 ? "#FFFFFF" : "#94A3B8"}
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
        <Text fz={10} c="#94A3B8">
          Low
        </Text>
        <Group gap={4}>
          <Box w={16} h={6} bg="#DBEAFE" />
          <Box w={16} h={6} bg="#BFDBFE" />
          <Box w={16} h={6} bg="#93C5FD" />
          <Box w={16} h={6} bg="#60A5FA" />
          <Box w={16} h={6} bg="#3B82F6" />
        </Group>
        <Text fz={10} c="#94A3B8">
          High
        </Text>
      </Group>
    </Box>
  );
}
