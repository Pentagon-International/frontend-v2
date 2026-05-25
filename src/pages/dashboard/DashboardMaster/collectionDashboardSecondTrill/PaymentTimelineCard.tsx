import { Box, Flex, Text } from "@mantine/core";
import {
  COL_BAD,
  COL_CARD_BG,
  COL_GOOD,
  COL_INK,
  COL_INK_2,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
  COL_WARN,
} from "../collectionTargetVsPerformance/theme";
import type { CollectionInvoiceDrillData } from "./types";

const DOT_COLORS = {
  done: COL_GOOD,
  alert: COL_BAD,
  pending: COL_WARN,
} as const;

type PaymentTimelineCardProps = {
  detail: CollectionInvoiceDrillData;
};

export function PaymentTimelineCard({ detail }: PaymentTimelineCardProps) {
  return (
    <Box
      style={{
        background: COL_CARD_BG,
        border: `1px solid ${COL_LINE}`,
        borderRadius: 10,
        overflow: "hidden",
        height: "100%",
      }}
    >
      <Flex
        align="baseline"
        justify="space-between"
        gap={10}
        px={14}
        py={12}
        style={{ borderBottom: `1px solid ${COL_LINE}` }}
      >
        <Text fw={600} fz={13} c={COL_INK}>
          Payment Timeline
        </Text>
        <Text fz={11} c={COL_INK_4}>
          Activity history
        </Text>
      </Flex>

      <Box p={14}>
        <Flex direction="column" gap={0}>
          {detail.timeline.map((event, index) => (
            <Flex
              key={`${event.date}-${event.title}-${index}`}
              gap={12}
              pb={index < detail.timeline.length - 1 ? 14 : 0}
            >
              <Box style={{ position: "relative", width: 12, flexShrink: 0 }}>
                {index < detail.timeline.length - 1 ? (
                  <Box
                    style={{
                      position: "absolute",
                      left: 5,
                      top: 10,
                      bottom: -14,
                      width: 1,
                      background: COL_LINE,
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
                      event.state === "pending" ? `2px solid ${DOT_COLORS.pending}` : "none",
                  }}
                />
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text fz={11} c={COL_INK_4}>
                  {event.date}
                </Text>
                <Text fz={12} fw={500} c={COL_INK_2} mt={1}>
                  {event.title}
                </Text>
                <Text fz={11} c={COL_INK_3} mt={1} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {event.amount}
                </Text>
              </Box>
            </Flex>
          ))}
        </Flex>
        {!detail.timeline.length ? (
          <Text fz={12} c={COL_INK_4} ta="center" py={16}>
            No payment activity recorded.
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}
