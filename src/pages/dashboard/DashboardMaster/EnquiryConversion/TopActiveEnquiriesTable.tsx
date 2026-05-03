import {
  ActionIcon,
  Box,
  Table,
  Text,
  Badge,
  Group,
  Tooltip,
} from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import type { EnquiryDrilldownEnquiry } from "../../../../service/dashboard.service";
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
  /** When null/undefined, PROB. shows — */
  probability?: number | null;
  valueLabel: string;
  /** Payload for the customer-wise enquiry details drawer. */
  drilldownEnquiry: EnquiryDrilldownEnquiry;
  /** From `top_enquiries` API when present — send-email prefill. */
  salespersonEmail?: string;
  ccMail?: string | string[];
  salespersonName?: string;
};

export function TopActiveEnquiriesTable({
  title,
  subtitle,
  rows,
  onRowClick,
  onSendEmailClick,
}: {
  title: string;
  subtitle?: string;
  rows: EnquiryRow[];
  onRowClick?: (row: EnquiryRow) => void;
  onSendEmailClick?: (row: EnquiryRow) => void;
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
      <Group justify="space-between" mb={20} wrap="nowrap">
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
      </Group>
      <Box style={{ overflowX: "auto" }}>
        <Table verticalSpacing="md" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              {[
                ...["CUSTOMER", "LANE", "MODE", "STAGE"],
                ...(onSendEmailClick ? (["SEND EMAIL"] as const) : []),
              ].map((h) => (
                <Table.Th
                  key={h}
                  style={{
                    borderBottom: `1px solid ${enquiryConversionColors.panelBorder}`,
                  }}
                  ta={h === "SEND EMAIL" ? "center" : "left"}
                >
                  <Text
                    size="11px"
                    fw={600}
                    c={enquiryConversionColors.subHeading}
                    tt="uppercase"
                    lts={0.8}
                  >
                    {h}
                  </Text>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={onSendEmailClick ? 5 : 4}>
                  <Text size="sm" c={enquiryConversionColors.subHeading} py={12}>
                    No enquiries for this filter.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((r) => (
                <Table.Tr
                  key={r.id}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            onRowClick(r);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  style={{
                    cursor: onRowClick ? "pointer" : undefined,
                  }}
                  aria-label={
                    onRowClick
                      ? `Open details for enquiry ${r.enquiryCode}`
                      : undefined
                  }
                >
                  <Table.Td style={{ minWidth: 180 }}>
                    <Text fw={700} size="sm" c={enquiryConversionColors.heading}>
                      {r.customer}
                    </Text>
                    <Group gap={8} mt={2}>
                      <Text size="11px" fw={500} c={enquiryConversionColors.muted}>
                        {r.enquiryCode} · {r.ageLabel}
                      </Text>
                      {r.stale ? (
                        <Badge size="xs" color="yellow.7" variant="light" radius="sm" fw={700} px={4} h={16}>
                          STALE
                        </Badge>
                      ) : null}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={600} c={enquiryConversionColors.subHeading}>
                      {r.lane}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      variant="light"
                      color="blue"
                      radius="sm"
                      fw={700}
                      px={6}
                      h={22}
                      style={{
                        backgroundColor: `${r.modeColor}15`,
                        color: r.modeColor,
                        border: `1px solid ${r.modeColor}20`,
                      }}
                    >
                      {r.modeLabel}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Box
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: `${r.stageDotColor}15`,
                        padding: "2px 10px",
                        borderRadius: 12,
                        height: 22,
                      }}
                    >
                      <Box
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: r.stageDotColor,
                        }}
                      />
                      <Text size="xs" fw={700} c={r.stageDotColor}>
                        {r.stageLabel}
                      </Text>
                    </Box>
                  </Table.Td>
                  {onSendEmailClick ? (
                    <Table.Td
                      ta="center"
                      style={{ width: 100, verticalAlign: "middle" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip label="Send Email" position="top" withArrow>
                        <ActionIcon
                          variant="light"
                          color="#105476"
                          size="md"
                          aria-label={`Send email for enquiry ${r.enquiryCode}`}
                          onClick={() => onSendEmailClick(r)}
                        >
                          <IconSend size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  ) : null}
                  {/* <Table.Td style={{ minWidth: 100 }}>
                    <Group gap={8} wrap="nowrap">
                      <Box style={{ flex: 1, height: 4, background: "#F1F5F9", borderRadius: 2 }}>
                        <Box
                          style={{
                            height: "100%",
                            width: `${r.probability ?? 0}%`,
                            background: r.probability && r.probability > 60 ? "#22C55E" : "#94A3B8",
                            borderRadius: 2,
                          }}
                        />
                      </Box>
                      <Text size="xs" fw={600} c={enquiryConversionColors.heading}>
                        {r.probability != null ? `${r.probability}%` : "—"}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={700} c={enquiryConversionColors.heading} ta="right">
                      {r.valueLabel}
                    </Text>
                  </Table.Td> */}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </Box>
  );
}
