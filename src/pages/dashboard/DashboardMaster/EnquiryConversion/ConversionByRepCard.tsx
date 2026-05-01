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
        background: enquiryConversionColors.panelBg,
        border: `1px solid ${enquiryConversionColors.panelBorder}`,
        borderRadius: enquiryConversionColors.radius,
        padding: "24px",
        height: "100%",
        boxShadow: enquiryConversionColors.shadow,
      }}
    >
      <Stack gap={4} mb={20}>
        <Group gap="sm" align="baseline">
          <Text fw={700} fz={16} c={enquiryConversionColors.heading}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" fw={500} c={enquiryConversionColors.subHeading}>
              {subtitle}
            </Text>
          ) : null}
        </Group>
      </Stack>
      {rows.length === 0 ? (
        <Text size="sm" c={enquiryConversionColors.subHeading} py={12}>
          {emptyLabel}
        </Text>
      ) : (
        <Stack gap={16}>
          {rows.map((row, idx) => (
            <Group key={`${row.name}-${idx}`} wrap="nowrap" gap="md" align="center">
              <Text
                size="sm"
                fw={600}
                c={enquiryConversionColors.heading}
                style={{ flex: "0 0 100px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {row.name}
              </Text>
              
              <Box style={{ flex: 1, position: "relative", height: 16 }}>
                <Box
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    background: "#F1F5F9",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Box
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${row.barPercent}%`,
                      backgroundColor: row.barColor,
                      borderRadius: 4,
                      transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </Box>
                {benchmarkPercent != null ? (
                  <Box
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: `${benchmarkPercent}%`,
                      top: -2,
                      bottom: -2,
                      width: 2,
                      background: "#f59e0b",
                      borderRadius: 1,
                      zIndex: 2,
                      pointerEvents: "none",
                    }}
                  />
                ) : null}
              </Box>

              <Box style={{ flex: "0 0 90px", textAlign: "right" }}>
                <Text size="xs" fw={700} c={enquiryConversionColors.heading} style={{ whiteSpace: "nowrap" }}>
                  {row.rateLabel} · {row.winsLabel}
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <Group justify="center" mt={24} pt={16} style={{ borderTop: `1px solid ${enquiryConversionColors.panelBorder}` }}>
          <Pagination
            size="xs"
            total={pagination.totalPages}
            value={pagination.page}
            onChange={pagination.onChange}
            styles={{
              control: {
                border: `1px solid ${enquiryConversionColors.panelBorder}`,
                borderRadius: 6,
              },
            }}
          />
        </Group>
      ) : null}
    </Box>
  );
}
