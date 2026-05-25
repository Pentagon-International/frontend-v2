import { Box, Button, Flex } from "@mantine/core";
import type { FinanceOutstandingAgeingData, OutstandingPartyType } from "../financeOutstandingAgeingTypes";
import { formatAmountInCr } from "../../accountsDashboardNormalize";
import { OST_INK, OST_INK_3, OST_LINE, OST_NAVY_800 } from "../theme";

type PartyTabsProps = {
  data: FinanceOutstandingAgeingData;
  value: OutstandingPartyType;
  onChange: (value: OutstandingPartyType) => void;
};

function tabLabel(slice: { tabLabel: string; amountCr: number }): string {
  return `${slice.tabLabel} · ₹${formatAmountInCr(slice.amountCr)}`;
}

export function PartyTabs({ data, value, onChange }: PartyTabsProps) {
  const tabs: { key: OutstandingPartyType; label: string }[] = [
    { key: "customer", label: tabLabel(data.customer) },
    { key: "agent", label: tabLabel(data.agent) },
  ];

  return (
    <Box
      style={{
        display: "inline-flex",
        gap: 4,
        background: "#f8fafc",
        border: `1px solid ${OST_LINE}`,
        borderRadius: 7,
        padding: 3,
      }}
    >
      {tabs.map((tab) => (
        <Button
          key={tab.key}
          size="compact-xs"
          variant="subtle"
          onClick={() => onChange(tab.key)}
          styles={{
            root: {
              height: "auto",
              minHeight: 30,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: value === tab.key ? 600 : 500,
              color: value === tab.key ? "#ffffff" : OST_INK_3,
              background: value === tab.key ? OST_NAVY_800 : "transparent",
              borderRadius: 5,
            },
          }}
        >
          {tab.label}
        </Button>
      ))}
    </Box>
  );
}

export function ViewToggle({
  value,
  onChange,
  partyLabel,
}: {
  value: "branch" | "party";
  onChange: (value: "branch" | "party") => void;
  partyLabel: string;
}) {
  return (
    <Flex
      gap={2}
      style={{
        background: "#f8fafc",
        border: `1px solid ${OST_LINE}`,
        borderRadius: 6,
        padding: 2,
      }}
    >
      {(
        [
          { key: "branch" as const, label: "By Branch" },
          { key: "party" as const, label: `By ${partyLabel}` },
        ] as const
      ).map((opt) => (
        <Button
          key={opt.key}
          size="compact-xs"
          variant="subtle"
          onClick={() => onChange(opt.key)}
          styles={{
            root: {
              height: "auto",
              minHeight: 28,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: value === opt.key ? 600 : 500,
              color: value === opt.key ? OST_INK : OST_INK_3,
              background: value === opt.key ? "#ffffff" : "transparent",
              boxShadow: value === opt.key ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
            },
          }}
        >
          {opt.label}
        </Button>
      ))}
    </Flex>
  );
}
