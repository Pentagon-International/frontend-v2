import { Box, Flex, Text } from "@mantine/core";
import { BAD, CARD_BG, GOOD, INK, INK_3, INK_4, LINE } from "../profitabilityTrillOne/constants";
import { formatLakhs, profitabilityTrillFonts } from "../profitabilityTrillOne/utils";
import { branchChipDotColor } from "./normalize";
import type { InvoiceProfitabilityDetail } from "./types";

type InvoiceDetailHeaderProps = {
  detail: InvoiceProfitabilityDetail;
};

export function InvoiceDetailHeader({ detail }: InvoiceDetailHeaderProps) {
  const statusColor =
    detail.statusTone === "bad" ? BAD : detail.statusTone === "warn" ? "#d97706" : GOOD;

  return (
    <Box
      style={{
        background: CARD_BG,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <Flex align="flex-start" justify="space-between" gap={16} wrap="wrap" mb={14}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            fz={13}
            c={INK_3}
            style={{ fontFamily: profitabilityTrillFonts.mono, letterSpacing: "0.01em" }}
          >
            {detail.invoiceId}
          </Text>
          <Text
            mt={4}
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: INK,
              lineHeight: 1.2,
            }}
          >
            {detail.customer}
          </Text>
          <Flex align="center" gap={6} mt={6} wrap="wrap">
            <Box
              component="span"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 3,
                background: "#f8fafc",
                color: INK,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                border: `1px solid ${LINE}`,
              }}
            >
              <Box
                component="span"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: branchChipDotColor(detail.branch.code),
                }}
              />
              {detail.branch.label}
            </Box>
            <Text fz={11} c={INK_4}>
              Job ref{" "}
              <Text
                span
                c="#1e3a5f"
                style={{ fontFamily: profitabilityTrillFonts.mono, textDecoration: "underline" }}
              >
                {detail.jobRef}
              </Text>{" "}
              · {detail.terms} · {detail.currency}
            </Text>
          </Flex>
        </Box>

        <Box ta="right">
          <Text
            fz={10}
            c={INK_4}
            tt="uppercase"
            style={{ letterSpacing: "0.04em", fontWeight: 500 }}
          >
            {detail.receivableLabel}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: INK,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ₹{formatLakhs(detail.balanceL)}
          </Text>
          <Text fz={11} fw={500} c={statusColor} mt={2}>
            {detail.statusText}
          </Text>
        </Box>
      </Flex>

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {[
          { label: "Invoice Date", value: detail.invoiceDate, mono: true },
          { label: "Due Date", value: detail.dueDate, mono: true },
          { label: "Gross Amount", value: `₹${formatLakhs(detail.grossAmountL)}` },
          {
            label: "Received / Paid",
            value: `₹${formatLakhs(detail.paidL)}`,
            color: detail.paidL > 0 ? GOOD : INK_3,
          },
        ].map((cell) => (
          <Box key={cell.label}>
            <Text
              fz={10}
              c={INK_4}
              tt="uppercase"
              style={{ letterSpacing: "0.04em", fontWeight: 500 }}
            >
              {cell.label}
            </Text>
            <Text
              fz={13}
              fw={500}
              c={cell.color ?? INK}
              mt={2}
              style={cell.mono ? { fontFamily: profitabilityTrillFonts.mono } : undefined}
            >
              {cell.value}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
