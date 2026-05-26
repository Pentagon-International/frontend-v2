import { Box, SimpleGrid, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { AgeingBucket } from "../financeOutstandingAgeingTypes";
import { AGEING_BUCKET_STRIPES, OST_BAD, OST_INK, OST_INK_3, OST_INK_4, OST_LINE } from "../theme";

type AgeingSummaryBarProps = {
  buckets: AgeingBucket[];
  /** From API `summary.currency` (e.g. INR). */
  currency?: string;
};

export function AgeingSummaryBar({ buckets, currency = "" }: AgeingSummaryBarProps) {
  const isCompact = useMediaQuery("(max-width: 36em)") ?? false;
  const isNarrow = useMediaQuery("(max-width: 48em)") ?? false;

  const gridCols = buckets.length > 6 ? { base: 1, xs: 2, sm: 2, md: 3, lg: 3, xl: 4 } : { base: 1, xs: 2, sm: 2, md: 3, lg: 4, xl: 4 };

  return (
    <SimpleGrid
      cols={gridCols}
      spacing={2}
      mb={16}
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${OST_LINE}`,
        width: "100%",
        minWidth: 0,
      }}
    >
      {buckets.map((bucket, index) => (
        <Box
          key={`${bucket.id}-${bucket.label}-${index}`}
          style={{
            background: "#f8fafc",
            padding: isCompact ? "10px 12px" : "12px 14px",
            position: "relative",
            overflow: "hidden",
            minWidth: 0,
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
            fz={isCompact ? 10 : 10.5}
            fw={500}
            c={OST_INK_3}
            tt="uppercase"
            style={{ letterSpacing: "0.04em" }}
            lineClamp={2}
          >
            {bucket.label}
          </Text>
          <Text
            mt={4}
            style={{
              fontSize: isCompact ? 16 : isNarrow ? 17 : 18,
              fontWeight: 600,
              color: OST_INK,
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
              wordBreak: "break-word",
            }}
          >
            {bucket.id === "dso_days"
              ? String(bucket.raw ?? "—")
              : bucket.amountDisplay ?? (currency ? `${currency} —` : "—")}
          </Text>
          <Text
            fz={isCompact ? 10 : 10.5}
            c={OST_INK_4}
            mt={2}
            style={{
              display: bucket.id === "dso_days" ? "none" : "block",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {bucket.pct.toFixed(1)}% · {bucket.invoiceCount} invoices
            {bucket.footnote && !isCompact ? (
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
