import { Box, Flex, Text } from "@mantine/core";
import { BAD, CARD_BG, GOOD, INK, INK_2, INK_3, INK_4, LINE, PAGE_BG } from "../profitabilityTrillOne/constants";
import type { InvoiceProfitabilityDetail } from "./types";

const DOT_COLORS = {
  done: GOOD,
  alert: BAD,
  pending: "#f59e0b",
} as const;

type PaymentTimelineCardProps = {
  detail: InvoiceProfitabilityDetail;
};

export function PaymentTimelineCard({ detail }: PaymentTimelineCardProps) {
  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        overflow: "hidden",
        height: "100%",
      }}
    >
      <Flex align="baseline" justify="space-between" gap={10} px={14} py={12} style={{ borderBottom: `1px solid ${LINE}` }}>
        <Text fw={600} fz={13} c={INK}>
          Payment Timeline
        </Text>
        <Text fz={11} c={INK_4}>
          Activity history
        </Text>
      </Flex>

      <Box p={14}>
        <Flex direction="column" gap={0} mb={16} style={{ position: "relative" }}>
          {detail.timeline.map((event, index) => (
            <Flex key={`${event.when}-${event.what}`} gap={12} pb={index < detail.timeline.length - 1 ? 14 : 0}>
              <Box style={{ position: "relative", width: 12, flexShrink: 0 }}>
                {index < detail.timeline.length - 1 ? (
                  <Box
                    style={{
                      position: "absolute",
                      left: 5,
                      top: 10,
                      bottom: -14,
                      width: 1,
                      background: LINE,
                    }}
                  />
                ) : null}
                <Box
                  style={{
                    width: event.state === "pending" ? 10 : 8,
                    height: event.state === "pending" ? 10 : 8,
                    borderRadius: "50%",
                    marginTop: 3,
                    marginLeft: event.state === "pending" ? 1 : 2,
                    background: event.state === "pending" ? "transparent" : DOT_COLORS[event.state],
                    border:
                      event.state === "pending"
                        ? `2px solid ${DOT_COLORS.pending}`
                        : "none",
                  }}
                />
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text fz={11} c={INK_4}>
                  {event.when}
                </Text>
                <Text fz={12} fw={500} c={INK_2} mt={1}>
                  {event.what}
                </Text>
                {event.amountLabel ? (
                  <Text fz={11} c={INK_3} mt={1} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {event.amountLabel}
                  </Text>
                ) : null}
              </Box>
            </Flex>
          ))}
        </Flex>

        <Text
          fz={10}
          c={INK_4}
          tt="uppercase"
          style={{ letterSpacing: "0.06em", fontWeight: 600, marginBottom: 8 }}
        >
          Follow-up actions
        </Text>
        <Flex direction="column" gap={6}>
          {detail.followUpActions.map((action) => (
            <Flex
              key={action.label}
              align="center"
              gap={8}
              px={10}
              py={8}
              style={{ background: PAGE_BG, borderRadius: 6 }}
            >
              <Box
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: action.urgent ? BAD : "#f59e0b",
                  flexShrink: 0,
                }}
              />
              <Text fz={11.5} c={INK_2} style={{ flex: 1 }}>
                {action.label}
              </Text>
              <Text fz={10.5} c={INK_4}>
                {action.owner}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
