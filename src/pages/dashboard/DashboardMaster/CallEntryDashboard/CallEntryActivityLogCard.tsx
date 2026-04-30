import { Box, Group, Stack, Table, Text, UnstyledButton } from "@mantine/core";
import dayjs from "dayjs";
import { IconArrowDownLeft, IconArrowUpRight, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { CallEntryActivityLogRow } from "../../../../service/dashboard.service";

type Props = {
  rows: CallEntryActivityLogRow[];
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

const cardStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  padding: "0px",
  overflow: "hidden",
} as const;

const outcomeChipColors: Record<string, { bg: string; fg: string }> = {
  quoted: { bg: "#EAF0FF", fg: "#4F46E5" },
  qualified: { bg: "#DCFCE7", fg: "#15803D" },
  pending: { bg: "#FEF3C7", fg: "#B45309" },
  escalated: { bg: "#FDE68A", fg: "#92400E" },
  collected: { bg: "#D1FAE5", fg: "#047857" },
  "to quote to client": { bg: "#EAF0FF", fg: "#4F46E5" },
  "to fix appointment": { bg: "#DCFCE7", fg: "#15803D" },
  "to send introduction letter": { bg: "#D1FAE5", fg: "#047857" },
  close: { bg: "#EEF2F7", fg: "#475569" },
  default: { bg: "#E8EEF5", fg: "#55667A" },
};

const channelTabs = ["All", "Inbound", "Outbound", "Missed"] as const;
type ChannelTab = (typeof channelTabs)[number];

function getOutcomeChip(outcome: string) {
  const key = outcome.trim().toLowerCase();
  return outcomeChipColors[key] || outcomeChipColors.default;
}

function getRowChannel(row: CallEntryActivityLogRow): ChannelTab {
  const purpose = (row.purpose || "").toLowerCase();
  const outcome = (row.outcome || "").toLowerCase();
  const status = (row.status || "").toLowerCase();
  if (purpose.includes("miss") || outcome.includes("miss") || status === "missed") {
    return "Missed";
  }
  if (
    purpose.includes("follow-up") ||
    purpose.includes("new business") ||
    outcome.includes("to quote") ||
    outcome.includes("to fix appointment")
  ) {
    return "Outbound";
  }
  return "Inbound";
}

function getLeadingTone(row: CallEntryActivityLogRow): "blue" | "green" | "red" {
  const channel = getRowChannel(row);
  if (channel === "Missed") return "red";
  if ((row.status || "").toUpperCase() === "ACTIVE") return "green";
  return "blue";
}

function getRowTime(value?: string): string {
  if (!value) return "--:--";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "--:--";
  const hasTime = /T|\d{2}:\d{2}/.test(value);
  if (hasTime) return parsed.format("HH:mm");
  return parsed.format("DD MMM");
}

export function CallEntryActivityLogCard({
  rows,
  page,
  total,
  pageSize,
  onPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [activeTab, setActiveTab] = useState<ChannelTab>("All");
  const visibleRows = useMemo(() => {
    if (activeTab === "All") return rows;
    return rows.filter((r) => getRowChannel(r) === activeTab);
  }, [activeTab, rows]);

  return (
    <Box style={cardStyle}>
      <Group justify="space-between" px={12} py={10} style={{ borderBottom: "1px solid #E7EEF6" }}>
        <Group gap={10}>
          <Text fw={700} fz={14} c="#0B1F3A" style={{ lineHeight: 1 }}>
            Activity Log
          </Text>
          <Text fz={12} fw={600} c="#B9C8DB" style={{ lineHeight: 1.2 }}>
            Last 24h
          </Text>
        </Group>
        <Group gap={4}>
          {channelTabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <UnstyledButton
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: active ? "#EEF2F7" : "transparent",
                  color: active ? "#0F172A" : "#7386A1",
                  fontSize: 11,
                  fontWeight: 700,
                  border: active ? "1px solid #E2E8F0" : "1px solid transparent",
                }}
              >
                {tab}
              </UnstyledButton>
            );
          })}
        </Group>
      </Group>

      <Box style={{ overflowX: "auto" }}>
        <Table
          highlightOnHover={false}
          withTableBorder={false}
          withColumnBorders={false}
          horizontalSpacing={10}
          verticalSpacing={8}
          style={{ minWidth: 700 }}
        >
          <Table.Thead>
            <Table.Tr style={{ borderBottom: "1px solid #EAF0F6" }}>
              <Table.Th w={28}></Table.Th>
              <Table.Th>
                <Text fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                  CUSTOMER / PURPOSE
                </Text>
              </Table.Th>
              <Table.Th>
                <Text fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                  OUTCOME
                </Text>
              </Table.Th>
              <Table.Th>
                <Text fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                  REP
                </Text>
              </Table.Th>
              <Table.Th>
                <Text ta="right" fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                  TIME
                </Text>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibleRows.map((row) => {
            const chip = getOutcomeChip(row.outcome || "");
            const tone = getLeadingTone(row);
            const iconBg =
              tone === "blue" ? "#E5F0FF" : tone === "green" ? "#DCFCE7" : "#FEE2E2";
            const iconColor =
              tone === "blue" ? "#2563EB" : tone === "green" ? "#15803D" : "#DC2626";

              return (
                <Table.Tr
                  key={`${row.sno}-${row.customer_code}`}
                  style={{ borderBottom: "1px solid #EDF2F7" }}
                >
                  <Table.Td>
                    <Box
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 7,
                        background: iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {tone === "red" ? (
                        <IconX size={13} stroke={2} color={iconColor} />
                      ) : tone === "green" ? (
                        <IconArrowDownLeft size={13} stroke={2} color={iconColor} />
                      ) : (
                        <IconArrowUpRight size={13} stroke={2} color={iconColor} />
                      )}
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text fw={700} fz={13} c="#0B1F3A" lineClamp={1} style={{ lineHeight: 1.1 }}>
                        {row.customer_name || row.customer_code}
                      </Text>
                      <Text fz={12} fw={500} c="#7F93AF" lineClamp={1} style={{ lineHeight: 1.1 }}>
                        {row.purpose || "-"}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Box
                      style={{
                        display: "inline-block",
                        background: chip.bg,
                        color: chip.fg,
                        borderRadius: 4,
                        padding: "3px 10px",
                        minWidth: 130,
                      }}
                    >
                      <Text fz={11} fw={700} style={{ lineHeight: 1 }}>
                        {row.outcome || "-"}
                      </Text>
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Text fz={12} fw={500} c="#334155">
                      {row.salesperson || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text ta="right" fz={12} fw={500} c="#8EA1B9">
                      {getRowTime(row.call_date)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {visibleRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="#94A3B8" fz={12} py={14}>
                    No activity logs found.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Box>

      <Group justify="space-between" px={12} py={6}>
        <Text fz={11} c="#94A3B8">
          Page {page} / {totalPages}
        </Text>
        <Group gap={8}>
          <UnstyledButton
            onClick={() => onPageChange(Math.max(1, page - 1))}
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              color: page <= 1 ? "#B8C5D5" : "#64748B",
              fontSize: 11,
              fontWeight: 700,
              pointerEvents: page <= 1 ? "none" : "auto",
            }}
          >
            Prev
          </UnstyledButton>
          <UnstyledButton
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              color: page >= totalPages ? "#B8C5D5" : "#64748B",
              fontSize: 11,
              fontWeight: 700,
              pointerEvents: page >= totalPages ? "none" : "auto",
            }}
          >
            Next
          </UnstyledButton>
        </Group>
      </Group>
    </Box>
  );
}
