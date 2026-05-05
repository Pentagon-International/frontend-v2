import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { CallEntryDashboardRepRow } from "../../../../service/dashboard.service";

type Props = {
  rows: CallEntryDashboardRepRow[];
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: CallEntryDashboardRepRow) => void;
};

const cardStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  padding: "10px",
} as const;

const barPalette = ["#22C55E", "#3B82F6", "#1E3A8A", "#D97706", "#CA8A04"];

export function CallEntryRepCard({
  rows,
  page,
  total,
  pageSize,
  onPageChange,
  onRowClick,
}: Props) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const maxCalls = Math.max(...rows.map((r) => r.total_calls || 0), 1);

  return (
    <Box style={cardStyle}>
      <Group justify="space-between" mb={10} wrap="wrap" gap={8}>
        <Group gap={6}>
          <Text fw={700} fz={13} c="#0B1F3A">
            Calls by Rep
          </Text>
          <Text fz={10} fw={600} c="#A3B2C2">
            Target 25/rep
          </Text>
        </Group>
        <Group gap={6} ml={isMobile ? "auto" : 0}>
          <Button
            size="compact-xs"
            variant="default"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            style={{ borderColor: "#E2E8F0", fontSize: 10, fontWeight: 600 }}
          >
            Prev
          </Button>
          <Text fz={11} c="#64748B">
            {page}/{totalPages}
          </Text>
          <Button
            size="compact-xs"
            variant="default"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            style={{ borderColor: "#E2E8F0", fontSize: 10, fontWeight: 600 }}
          >
            Next
          </Button>
        </Group>
      </Group>

      <Stack gap={8}>
        {rows.map((row, index) => {
          const widthPct = Math.max(6, ((row.total_calls || 0) / maxCalls) * 100);
          const barColor = barPalette[index % barPalette.length];
          return (
            <Group
              key={`${row.sno}-${row.salesperson}`}
              gap={8}
              wrap="nowrap"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              <Text
                c="#64748B"
                fz={10}
                style={{
                  width: isMobile ? "clamp(48px, 24vw, 72px)" : "clamp(56px, 22vw, 80px)",
                  minWidth: 0,
                  flex: isMobile ? "0 1 clamp(48px, 24vw, 72px)" : "0 1 clamp(56px, 22vw, 80px)",
                }}
                truncate
              >
                {row.salesperson}
              </Text>
              <Box
                style={{
                  position: "relative",
                  flex: "1 1 auto",
                  minWidth: isMobile ? 48 : 56,
                  height: 14,
                  borderRadius: 2,
                  background: "#EDF2F7",
                  overflow: "hidden",
                }}
              >
                <Box
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: barColor,
                    borderRadius: 2,
                  }}
                />
              </Box>
              <Text
                c="#0F172A"
                fw={700}
                fz={10}
                style={{
                  width: isMobile ? "clamp(40px, 18vw, 52px)" : "clamp(44px, 18vw, 60px)",
                  minWidth: isMobile ? 40 : 44,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  flex: isMobile
                    ? "0 0 clamp(40px, 18vw, 52px)"
                    : "0 0 clamp(44px, 18vw, 60px)",
                }}
              >
                {row.total_calls} / {row.percentage || "0%"}
              </Text>
            </Group>
          );
        })}
        {rows.length === 0 ? (
          <Text ta="center" c="#94A3B8" fz={12} py={6}>
            No rep data available.
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
