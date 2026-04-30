import { Box, Stack, Text, Group, Pagination } from "@mantine/core";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export type RepBarRow = {
  name: string;
  rateLabel: string;
  winsLabel: string;
  /** 0–100 bar fill */
  barPercent: number;
  barColor: string;
};

export interface ConversionByRepPagination {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function ConversionByRepCard({
  title,
  subtitle,
  benchmarkPercent,
  rows,
  pagination,
  emptyLabel = "No salesperson data for this filter.",
}: {
  title: string;
  subtitle?: string;
  /** optional vertical benchmark line as % from left */
  benchmarkPercent?: number;
  rows: RepBarRow[];
  pagination?: ConversionByRepPagination;
  emptyLabel?: string;
}) {
  return (
    <Box
      style={{
        background: "#fff",
        border: `1px solid ${enquiryConversionColors.panelBorder}`,
        borderRadius: 12,
        padding: "18px 20px",
        height: "100%",
        boxShadow:
          "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 14px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Stack gap={4} mb={16}>
        <Text fw={600} fz={14} c={enquiryConversionColors.heading}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" c="#64748B">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {rows.length === 0 ? (
        <Text size="sm" c="#64748B" py={12}>
          {emptyLabel}
        </Text>
      ) : (
        <Stack gap={14}>
          {rows.map((row, idx) => (
            <Box key={`${row.name}-${idx}`}>
              <Group justify="space-between" gap="md" mb={4} wrap="nowrap">
                <Text
                  size="sm"
                  fw={600}
                  c="#0F172A"
                  style={{ flex: "0 0 100px" }}
                >
                  {row.name}
                </Text>
                <Text size="xs" c="#475569" ta="right">
                  {row.rateLabel} · {row.winsLabel}
                </Text>
              </Group>
              <Box style={{ position: "relative", height: 14 }}>
                {benchmarkPercent != null ? (
                  <Box
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: `clamp(0%, ${benchmarkPercent}%, calc(100% - 2px))`,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: "#CA8A04",
                      opacity: 0.95,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                  />
                ) : null}
                <Box
                  style={{
                    height: "100%",
                    borderRadius: 6,
                    background: "#F1F5F9",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(6, row.barPercent))}%`,
                      backgroundColor: row.barColor,
                      borderRadius: 6,
                    }}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
      {pagination && pagination.totalPages > 1 ? (
        <Group justify="center" mt={16}>
          <Pagination
            value={pagination.page}
            onChange={pagination.onChange}
            total={pagination.totalPages}
            size="sm"
            siblings={1}
            boundaries={1}
            styles={{
              control: {
                fontSize: 12,
                minWidth: 32,
                height: 32,
              },
            }}
          />
        </Group>
      ) : null}
    </Box>
  );
}
