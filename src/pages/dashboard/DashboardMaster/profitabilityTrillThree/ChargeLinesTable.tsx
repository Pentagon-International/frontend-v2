import { Box, Flex, Table, Text } from "@mantine/core";
import { CARD_BG, INK, INK_2, INK_3, INK_4, LINE, PAGE_BG } from "../profitabilityTrillOne/constants";
import { formatInrAmount } from "./normalize";
import type { InvoiceProfitabilityDetail } from "./types";
import { profitabilityTrillFonts } from "../profitabilityTrillOne/utils";

type ChargeLinesTableProps = {
  detail: InvoiceProfitabilityDetail;
};

export function ChargeLinesTable({ detail }: ChargeLinesTableProps) {
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
          Charge Lines
        </Text>
        <Text fz={11} c={INK_4}>
          {detail.chargeLines.length} lines · {detail.currency}
        </Text>
      </Flex>

      <Table
        horizontalSpacing={12}
        verticalSpacing={9}
        styles={{
          table: { fontSize: 12, fontFamily: profitabilityTrillFonts.sans },
          th: {
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: INK_3,
            fontWeight: 500,
            background: PAGE_BG,
            borderBottom: `1px solid ${LINE}`,
          },
          td: { borderBottom: `1px solid ${LINE}`, color: INK_2 },
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
          {detail.chargeLines.map((line) => (
            <Table.Tr key={`${line.head}-${line.qty}-${line.rate}`}>
              <Table.Td>{line.head}</Table.Td>
              <Table.Td ta="right">
                <Text fz={12} c={INK_3}>
                  {line.qty}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fz={12} c={INK_3}>
                  {line.rate}
                </Text>
              </Table.Td>
              <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatInrAmount(line.amountInr)}
              </Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td colSpan={3} fw={600} c={INK}>
              Sub-total
            </Table.Td>
            <Table.Td ta="right" fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatInrAmount(detail.subtotalInr)}
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td colSpan={3} c={INK_3}>
              GST @ {detail.gstPct}%
            </Table.Td>
            <Table.Td ta="right" c={INK_3} style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatInrAmount(detail.gstInr)}
            </Table.Td>
          </Table.Tr>
          <Table.Tr style={{ borderTop: `2px solid ${INK}` }}>
            <Table.Td colSpan={3} fw={700} c={INK} fz={13}>
              Invoice Total
            </Table.Td>
            <Table.Td ta="right" fw={700} c={INK} fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatInrAmount(detail.totalInr)}
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Box>
  );
}
