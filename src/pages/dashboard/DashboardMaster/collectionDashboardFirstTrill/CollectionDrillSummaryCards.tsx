import { Box, SimpleGrid, Text } from "@mantine/core";
import type { CollectionBranchDrillSummaryCard } from "./types";
import {
  COL_CARD_BG,
  COL_INK,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
} from "../collectionTargetVsPerformance/theme";

type CollectionDrillSummaryCardsProps = {
  cards: CollectionBranchDrillSummaryCard[];
  loading?: boolean;
};

function SummaryCard({ card }: { card: CollectionBranchDrillSummaryCard }) {
  return (
    <Box
      style={{
        background: COL_CARD_BG,
        border: `1px solid ${COL_LINE}`,
        borderRadius: 8,
        padding: "12px 14px",
        minWidth: 0,
      }}
    >
      <Text fz={10} fw={600} c={COL_INK_4} tt="uppercase" style={{ letterSpacing: "0.05em" }}>
        {card.label}
      </Text>
      <Text
        mt={4}
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: card.valueColor ?? COL_INK,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {card.value}
      </Text>
      <Text fz={11} c={COL_INK_3} mt={4}>
        {card.detail}
      </Text>
    </Box>
  );
}

function SummarySkeleton() {
  return (
    <Box
      style={{
        background: COL_CARD_BG,
        border: `1px solid ${COL_LINE}`,
        borderRadius: 8,
        padding: "12px 14px",
        minHeight: 88,
      }}
    />
  );
}

export function CollectionDrillSummaryCards({ cards, loading }: CollectionDrillSummaryCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10} mb={18}>
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <SummarySkeleton key={i} />)
        : cards.map((card) => <SummaryCard key={card.label} card={card} />)}
    </SimpleGrid>
  );
}
