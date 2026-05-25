import { Box, Flex, Table, Text, Tooltip } from "@mantine/core";
import {
  COL_CARD_BG,
  COL_INK,
  COL_INK_2,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
  COL_PAGE_BG,
} from "../collectionTargetVsPerformance/theme";
import type { CollectionInvoiceDrillData } from "./types";

function AmountText({ value, bold }: { value: string; bold?: boolean }) {
  return (
    <Tooltip label={value} withArrow position="top">
      <Text
        component="span"
        fz={12}
        fw={bold ? 600 : 400}
        style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Text>
    </Tooltip>
  );
}

type ChargeLinesTableProps = {
  detail: CollectionInvoiceDrillData;
};

export function ChargeLinesTable({ detail }: ChargeLinesTableProps) {
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
          Charge Lines
        </Text>
        <Text fz={11} c={COL_INK_4}>
          {detail.chargeLines.length} lines · {detail.currency}
        </Text>
      </Flex>

      <Table
        horizontalSpacing={12}
        verticalSpacing={9}
        styles={{
          table: { fontSize: 12 },
          th: {
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: COL_INK_3,
            fontWeight: 600,
            background: COL_PAGE_BG,
            borderBottom: `1px solid ${COL_LINE}`,
          },
          td: { borderBottom: `1px solid ${COL_LINE}`, color: COL_INK_2 },
        }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Charge head</Table.Th>
            <Table.Th ta="right">Qty</Table.Th>
            <Table.Th ta="right">Rate</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detail.chargeLines.map((line, index) => (
            <Table.Tr key={`${line.chargeHead}-${index}`}>
              <Table.Td>{line.chargeHead}</Table.Td>
              <Table.Td ta="right">
                <Text fz={12} c={COL_INK_3}>
                  {line.qty}
                  {line.unit && line.unit !== "—" ? ` ${line.unit}` : ""}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <AmountText value={line.rate} />
              </Table.Td>
              <Table.Td ta="right">
                <AmountText value={line.amount} />
              </Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td colSpan={3} fw={600} c={COL_INK}>
              Sub-total
            </Table.Td>
            <Table.Td ta="right">
              <AmountText value={detail.subtotal} bold />
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td colSpan={3} c={COL_INK_3}>
              Tax total
            </Table.Td>
            <Table.Td ta="right">
              <AmountText value={detail.taxTotal} />
            </Table.Td>
          </Table.Tr>
          <Table.Tr style={{ borderTop: `2px solid ${COL_INK}` }}>
            <Table.Td colSpan={3} fw={700} c={COL_INK} fz={13}>
              Invoice Total
            </Table.Td>
            <Table.Td ta="right">
              <AmountText value={detail.invoiceTotal} bold />
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Box>
  );
}
