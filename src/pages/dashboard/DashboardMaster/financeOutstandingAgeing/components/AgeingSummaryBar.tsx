import { Box, SimpleGrid, Text } from "@mantine/core";
import type { AgeingBucket } from "../financeOutstandingAgeingTypes";
import { AGEING_BUCKET_STRIPES, OST_BAD, OST_INK, OST_INK_3, OST_INK_4, OST_LINE } from "../theme";

type AgeingSummaryBarProps = {
  buckets: AgeingBucket[];
  /** From API `summary.currency` (e.g. INR). */
  currency?: string;
};

export function AgeingSummaryBar({ buckets, currency = "" }: AgeingSummaryBarProps) {
  return (
    <SimpleGrid
      cols={{ base: 1, xs: 2, md: 3, lg: 5 }}
      spacing={2}
      mb={16}
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${OST_LINE}`,
      }}
    >
      {buckets.map((bucket) => (
        <Box
          key={bucket.id}
          style={{
            background: "#f8fafc",
            padding: "12px 14px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: AGEING_BUCKET_STRIPES[bucket.id] ?? OST_INK_4,
            }}
          />
          <Text
            fz={10.5}
            fw={500}
            c={OST_INK_3}
            tt="uppercase"
            style={{ letterSpacing: "0.04em" }}
          >
            {bucket.label}
          </Text>
          <Text
            mt={4}
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: OST_INK,
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {bucket.amountDisplay ?? (currency ? `${currency} —` : "—")}
          </Text>
          <Text fz={10.5} c={OST_INK_4} mt={2}>
            {bucket.pct.toFixed(1)}% · {bucket.invoiceCount} invoices
            {bucket.footnote ? (
              <>
                {" · "}
                <Text
                  component="span"
                  fz={10.5}
                  fw={600}
                  c={bucket.footnoteTone === "bad" ? OST_BAD : OST_INK_4}
                >
                  {bucket.footnote}
                </Text>
              </>
            ) : null}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  );
}
