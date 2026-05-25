import { Box, Flex, Text } from "@mantine/core";
import { BAD, CARD_BG, GOOD, INK, INK_2, INK_3, INK_4, LINE, PAGE_BG } from "../profitabilityTrillOne/constants";
import type { JobMarginBridgeItem } from "./types";

type MarginBridgeCardProps = {
  items: JobMarginBridgeItem[];
  commentary: string;
};

export function MarginBridgeCard({ items, commentary }: MarginBridgeCardProps) {
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
      <Flex
        align="baseline"
        justify="space-between"
        gap={10}
        px={14}
        py={12}
        style={{ borderBottom: `1px solid ${LINE}` }}
      >
        <Text fw={600} fz={13} c={INK}>
          Margin Bridge
        </Text>
        <Text fz={11} c={INK_4}>
          vs branch avg
        </Text>
      </Flex>

      <Box p={14}>
        <Flex direction="column" gap={10}>
          {items.map((item) => {
            const positive = item.deltaPp >= 0;
            const width = Math.min(48, Math.abs(item.deltaPp) * 3);
            return (
              <Box
                key={item.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr 70px",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <Text c={INK_2}>{item.label}</Text>
                <Box
                  style={{
                    height: 8,
                    background: PAGE_BG,
                    borderRadius: 3,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: INK_4,
                    }}
                  />
                  <Box
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      ...(positive
                        ? { left: "50%", width: `${width}%`, background: GOOD }
                        : { right: "50%", width: `${width}%`, background: BAD }),
                    }}
                  />
                </Box>
                <Text
                  ta="right"
                  fw={600}
                  c={positive ? GOOD : BAD}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {positive ? "+" : ""}
                  {item.deltaPp.toFixed(1)}pp
                </Text>
              </Box>
            );
          })}
        </Flex>

        <Text
          fz={11}
          c={INK_4}
          mt={12}
          pt={10}
          style={{ borderTop: `1px solid ${LINE}`, lineHeight: 1.5 }}
        >
          {commentary}
        </Text>
      </Box>
    </Box>
  );
}
