import { Box, Flex, Table, Text } from "@mantine/core";
import { CARD_BG, GOOD, INK, INK_2, INK_3, INK_4, LINE, PAGE_BG } from "../profitabilityTrillOne/constants";
import type { JobPlLine, JobProfitabilityDetail } from "./types";
import { profitabilityTrillFonts } from "../profitabilityTrillOne/utils";

function formatInrFull(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function PlRows({ lines }: { lines: JobPlLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <Table.Tr key={`${line.head}-${line.party}-${line.qty}`}>
          <Table.Td>{line.head}</Table.Td>
          <Table.Td>
            <Text fz={11} c={INK_3}>
              {line.party}
            </Text>
          </Table.Td>
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
            {formatInrFull(line.amountInr)}
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

type JobPlTableProps = {
  detail: JobProfitabilityDetail;
};

export function JobPlTable({ detail }: JobPlTableProps) {
  const revenueTotal = detail.revenueL * 100000;
  const costTotal = detail.costL * 100000;
  const gpTotal = detail.grossProfitL * 100000;

  return (
    <Box>
      <Flex align="baseline" justify="space-between" gap={12} mb={10} wrap="wrap">
        <Text fw={600} fz={13} c={INK}>
          Job P&amp;L
        </Text>
        <Text fz={11} c={INK_4}>
          All amounts in INR (₹)
        </Text>
      </Flex>

      <Box
        style={{
          background: CARD_BG,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
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
              <Table.Th>Charge / Cost head</Table.Th>
              <Table.Th>Vendor / Beneficiary</Table.Th>
              <Table.Th ta="right">Qty</Table.Th>
              <Table.Th ta="right">Rate</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td
                colSpan={5}
                style={{
                  background: PAGE_BG,
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: INK_2,
                }}
              >
                Revenue
              </Table.Td>
            </Table.Tr>
            <PlRows lines={detail.revenueLines} />
            <Table.Tr>
              <Table.Td colSpan={4} fw={600} c={INK}>
                Total Revenue
              </Table.Td>
              <Table.Td ta="right" fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatInrFull(revenueTotal)}
              </Table.Td>
            </Table.Tr>

            <Table.Tr>
              <Table.Td
                colSpan={5}
                style={{
                  background: PAGE_BG,
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: INK_2,
                }}
              >
                Direct Cost
              </Table.Td>
            </Table.Tr>
            <PlRows lines={detail.costLines} />
            <Table.Tr>
              <Table.Td colSpan={4} fw={600} c={INK}>
                Total Direct Cost
              </Table.Td>
              <Table.Td ta="right" fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatInrFull(costTotal)}
              </Table.Td>
            </Table.Tr>

            <Table.Tr style={{ background: "#f0fdf4" }}>
              <Table.Td colSpan={4} fw={700} c={GOOD} fz={13}>
                Gross Profit · {detail.marginPct.toFixed(1)}% margin
              </Table.Td>
              <Table.Td ta="right" fw={700} c={GOOD} fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatInrFull(gpTotal)}
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Box>
    </Box>
  );
}
