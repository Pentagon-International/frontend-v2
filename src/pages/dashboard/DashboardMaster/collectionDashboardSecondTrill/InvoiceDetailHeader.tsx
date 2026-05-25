import { Box, Flex, Text } from "@mantine/core";
import { branchDotColor } from "../accountsDashboardNormalize";
import {
  COL_BAD,
  COL_CARD_BG,
  COL_GOOD,
  COL_INK,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
  COL_WARN,
} from "../collectionTargetVsPerformance/theme";
import type { CollectionInvoiceDrillData } from "./types";

type InvoiceDetailHeaderProps = {
  detail: CollectionInvoiceDrillData;
};

function statusColor(tone: CollectionInvoiceDrillData["statusTone"]): string {
  if (tone === "overdue") return COL_BAD;
  if (tone === "partial") return COL_WARN;
  if (tone === "open") return COL_INK_3;
  return COL_GOOD;
}

export function InvoiceDetailHeader({ detail }: InvoiceDetailHeaderProps) {
  return (
    <Box
      style={{
        background: COL_CARD_BG,
        border: `1px solid ${COL_LINE}`,
        borderRadius: 10,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <Flex align="flex-start" justify="space-between" gap={16} wrap="wrap" mb={14}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fz={13} c={COL_INK_3} style={{ letterSpacing: "0.01em" }}>
            {detail.invoiceId}
          </Text>
          <Text
            mt={4}
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: COL_INK,
              lineHeight: 1.2,
            }}
          >
            {detail.customerName}
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
                color: COL_INK,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                border: `1px solid ${COL_LINE}`,
              }}
            >
              <Box
                component="span"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: branchDotColor(detail.branchVariant),
                }}
              />
              {detail.branchLabel}
            </Box>
            <Text fz={11} c={COL_INK_4}>
              Job ref <Text span c="#1e3a5f" fw={500}>{detail.jobRef}</Text> · {detail.terms} ·{" "}
              {detail.currency}
            </Text>
          </Flex>
        </Box>

        <Box ta="right">
          <Text
            fz={10}
            c={COL_INK_4}
            tt="uppercase"
            style={{ letterSpacing: "0.04em", fontWeight: 600 }}
          >
            {detail.receivableLabel}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: COL_INK,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {detail.balance}
          </Text>
          <Text fz={11} fw={600} c={statusColor(detail.statusTone)} mt={2} tt="uppercase">
            {detail.status}
            {detail.statusTone === "overdue" ? " · Overdue" : ""}
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
          { label: "Invoice Date", value: detail.invoiceDate },
          { label: "Due Date", value: detail.dueDate },
          { label: "Gross Amount", value: detail.grossAmount },
          {
            label: "Received / Paid",
            value: detail.received,
            color: detail.received !== "0.00" && detail.received !== "—" ? COL_GOOD : COL_INK_3,
          },
        ].map((cell) => (
          <Box key={cell.label}>
            <Text
              fz={10}
              c={COL_INK_4}
              tt="uppercase"
              style={{ letterSpacing: "0.04em", fontWeight: 600 }}
            >
              {cell.label}
            </Text>
            <Text fz={13} fw={500} c={cell.color ?? COL_INK} mt={2} style={{ fontVariantNumeric: "tabular-nums" }}>
              {cell.value}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
