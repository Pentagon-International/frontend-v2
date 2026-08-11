import { Box, Group, ScrollArea, Stack, Table, Text, Tooltip, UnstyledButton } from "@mantine/core";
import dayjs from "dayjs";
import { IconArrowDownLeft, IconArrowUpRight, IconX } from "@tabler/icons-react";
import { useMemo } from "react";
import { useMediaQuery } from "@mantine/hooks";
import type { CallEntryActivityLogRow } from "../../../../service/dashboard.service";

type Props = {
  rows: CallEntryActivityLogRow[];
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: CallEntryActivityLogRow) => void;
  /** When true (Closed KPI / outcome filter), show the Remark column */
  showRemark?: boolean;
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

type ChannelTab = "All" | "Inbound" | "Outbound" | "Missed";

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
  onRowClick,
  showRemark = false,
}: Props) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeTab: ChannelTab = "All";
  const visibleRows = useMemo(() => {
    if (activeTab === "All") return rows;
    return rows.filter((r) => getRowChannel(r) === activeTab);
  }, [activeTab, rows]);
  const colCount = showRemark ? 6 : 5;

  return (
    <Box
      style={{
        ...cardStyle,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Group
        justify="space-between"
        px={12}
        py={9}
        style={{
          borderBottom: "1px solid #E7EEF6",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 3,
          background: "#FFFFFF",
        }}
      >
        <Group gap={10}>
          <Text fw={700} fz={14} c="#0B1F3A" style={{ lineHeight: 1 }}>
            Activity Log
          </Text>
          <Text fz={11} fw={600} c="#B9C8DB" style={{ lineHeight: 1.2 }}>
            Last 24h
          </Text>
        </Group>
      </Group>

      <ScrollArea
        type="scroll"
        offsetScrollbars
        scrollbarSize={8}
        style={{ flex: 1, minHeight: 0 }}
        styles={{
          root: { flex: 1, minHeight: 0 },
          viewport: { minHeight: 0 },
        }}
      >
        <Table
          highlightOnHover={false}
          withTableBorder={false}
          withColumnBorders={false}
          stickyHeader
          stickyHeaderOffset={0}
          horizontalSpacing={isMobile ? 8 : 10}
          verticalSpacing={isMobile ? 7 : 8}
          style={{
            width: "100%",
            tableLayout: "fixed",
            minWidth: isMobile
              ? showRemark
                ? 640
                : 560
              : showRemark
                ? 720
                : 640,
          }}
        >
          <Table.Thead
            style={{
              background: "#FFFFFF",
              zIndex: 2,
              boxShadow: "0 1px 0 #EAF0F6",
            }}
          >
            <Table.Tr style={{ borderBottom: "1px solid #EAF0F6" }}>
              <Table.Th style={{ width: 28, maxWidth: 28 }} />
              <Table.Th style={{ width: "auto", minWidth: 0 }}>
                <Text fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                  CUSTOMER / PURPOSE
                </Text>
              </Table.Th>
              <Table.Th style={{ width: isMobile ? 110 : 130 }}>
                <Text fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                  OUTCOME
                </Text>
              </Table.Th>
              {showRemark ? (
                <Table.Th style={{ width: "25%", maxWidth: "25%" }}>
                  <Text fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                    REMARK
                  </Text>
                </Table.Th>
              ) : null}
              <Table.Th style={{ width: isMobile ? 88 : 110 }}>
                <Text fz={12} fw={700} c="#B0C0D4" style={{ letterSpacing: "0.03em" }}>
                  REP
                </Text>
              </Table.Th>
              <Table.Th style={{ width: isMobile ? 56 : 64 }}>
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
                tone === "blue"
                  ? "#E5F0FF"
                  : tone === "green"
                    ? "#DCFCE7"
                    : "#FEE2E2";
              const iconColor =
                tone === "blue"
                  ? "#2563EB"
                  : tone === "green"
                    ? "#15803D"
                    : "#DC2626";
              const remarkText = row.remark?.trim() || "";
              const remarkDisplay = remarkText || "-";

              return (
                <Table.Tr
                  key={`${row.sno}-${row.customer_code}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    borderBottom: "1px solid #EDF2F7",
                    cursor: onRowClick ? "pointer" : "default",
                  }}
                >
                  <Table.Td style={{ width: 28, maxWidth: 28 }}>
                    <Box
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {tone === "red" ? (
                        <IconX size={12} stroke={2} color={iconColor} />
                      ) : tone === "green" ? (
                        <IconArrowDownLeft size={12} stroke={2} color={iconColor} />
                      ) : (
                        <IconArrowUpRight size={12} stroke={2} color={iconColor} />
                      )}
                    </Box>
                  </Table.Td>
                  <Table.Td style={{ width: "auto", minWidth: 0 }}>
                    <Stack gap={0} style={{ minWidth: 0, maxWidth: "100%" }}>
                      <Text
                        fw={700}
                        fz={isMobile ? 12 : 13}
                        c="#0B1F3A"
                        truncate
                        style={{ lineHeight: 1.1, minWidth: 0 }}
                      >
                        {row.customer_name || row.customer_code}
                      </Text>
                      <Text
                        fz={isMobile ? 11 : 12}
                        fw={500}
                        c="#7F93AF"
                        truncate
                        style={{ lineHeight: 1.1, minWidth: 0 }}
                      >
                        {row.purpose || "-"}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td style={{ width: isMobile ? 110 : 130 }}>
                    <Box
                      style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        background: chip.bg,
                        color: chip.fg,
                        borderRadius: 4,
                        padding: "3px 10px",
                      }}
                    >
                      <Text
                        fz={isMobile ? 10 : 11}
                        fw={700}
                        truncate
                        style={{ lineHeight: 1, maxWidth: "100%" }}
                      >
                        {row.outcome || "-"}
                      </Text>
                    </Box>
                  </Table.Td>
                  {showRemark ? (
                    <Table.Td style={{ width: "25%", maxWidth: "25%" }}>
                      <Tooltip
                        label={remarkText}
                        disabled={!remarkText}
                        multiline
                        maw={360}
                        withArrow
                        openDelay={250}
                        position="top-start"
                        events={{ hover: true, focus: true, touch: true }}
                        styles={{
                          tooltip: {
                            fontSize: 12,
                            fontWeight: 500,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          },
                        }}
                      >
                        <Text
                          fz={isMobile ? 11 : 12}
                          fw={500}
                          c="#334155"
                          truncate
                          style={{
                            lineHeight: 1.25,
                            maxWidth: "100%",
                            display: "block",
                          }}
                        >
                          {remarkDisplay}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                  ) : null}
                  <Table.Td style={{ width: isMobile ? 88 : 110 }}>
                    <Text fz={isMobile ? 11 : 12} fw={500} c="#334155" truncate>
                      {row.salesperson || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ width: isMobile ? 56 : 64 }}>
                    <Text ta="right" fz={isMobile ? 11 : 12} fw={500} c="#8EA1B9">
                      {getRowTime(row.call_date)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {visibleRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={colCount}>
                  <Text ta="center" c="#94A3B8" fz={12} py={14}>
                    No activity logs found.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <Group
        justify="space-between"
        px={12}
        py={6}
        style={{ borderTop: "1px solid #E7EEF6", flexShrink: 0 }}
      >
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
