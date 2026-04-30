import { Box, Table, Text, Badge, Group, Progress } from "@mantine/core";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export type EnquiryRow = {
  id: string;
  customer: string;
  enquiryCode: string;
  ageLabel: string;
  stale?: boolean;
  lane: string;
  modeLabel: string;
  modeColor: string;
  stageLabel: string;
  stageDotColor: string;
  probability: number;
  valueLabel: string;
};

export function TopActiveEnquiriesTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: EnquiryRow[];
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
      <Group justify="space-between" mb={14} wrap="nowrap">
        <Box>
          <Text fw={600} fz={14} c={enquiryConversionColors.heading}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" c="#64748B" mt={4}>
              {subtitle}
            </Text>
          ) : null}
        </Box>
      </Group>
      <Box style={{ overflowX: "auto" }}>
        <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              {["CUSTOMER", "LANE", "MODE", "STAGE", "PROB.", "VALUE"].map(
                (h) => (
                  <Table.Th key={h}>
                    <Text size="10px" fw={700} c="#64748B" tt="uppercase">
                      {h}
                    </Text>
                  </Table.Th>
                )
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td style={{ minWidth: 200 }}>
                  <Text fw={600} size="sm" c="#0F172A">
                    {r.customer}
                  </Text>
                  <Group gap={8} mt={4}>
                    <Text size="xs" c="#64748B">
                      {r.enquiryCode} · {r.ageLabel}
                    </Text>
                    {r.stale ? (
                      <Badge size="xs" color="yellow" variant="light">
                        STALE
                      </Badge>
                    ) : null}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="#334155">
                    {r.lane}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="sm"
                    variant="light"
                    styles={{
                      root: {
                        backgroundColor: `${r.modeColor}22`,
                        color: "#0F172A",
                        border: `1px solid ${r.modeColor}44`,
                      },
                    }}
                  >
                    {r.modeLabel}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Box
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: r.stageDotColor,
                      }}
                    />
                    <Text size="sm">{r.stageLabel}</Text>
                  </Group>
                </Table.Td>
                <Table.Td style={{ minWidth: 100 }}>
                  <Group gap={8} wrap="nowrap">
                    <Progress
                      value={r.probability}
                      size="sm"
                      style={{ flex: 1, minWidth: 48 }}
                      color="#105476"
                    />
                    <Text size="xs" fw={600} c="#475569">
                      {r.probability}%
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fw={700} size="sm">
                    {r.valueLabel}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </Box>
  );
}
