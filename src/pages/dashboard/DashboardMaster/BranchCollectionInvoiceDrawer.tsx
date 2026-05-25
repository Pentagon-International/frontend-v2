import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import dayjs from "dayjs";
import { formatAmountInCr } from "./accountsDashboardNormalize";
import type { PeriodGranularity } from "./collectionTargetVsPerformance/components/PeriodPillGroup";
import {
  branchTitle,
  getBranchCollectionInvoiceMock,
  type BranchCollectionInvoiceRow,
} from "./collectionTargetVsPerformance/branchCollectionInvoiceMock";
import type { BranchCollectionRow } from "./collectionTargetVsPerformance/collectionTargetVsPerformanceTypes";

const ERP_FONT_SANS = "'Geist', sans-serif";

type BranchCollectionInvoiceDrawerProps = {
  opened: boolean;
  onClose: () => void;
  branch: BranchCollectionRow | null;
  company: string;
  periodGranularity: PeriodGranularity;
  periodFilter: string | null;
  currencyFilter: string | null;
  periodLabel: string;
};

function statusColor(status: BranchCollectionInvoiceRow["status"]): string {
  if (status === "Collected") return "#16A34A";
  if (status === "Overdue") return "#DC2626";
  if (status === "Partial") return "#D97706";
  return "#64748B";
}

export default function BranchCollectionInvoiceDrawer({
  opened,
  onClose,
  branch,
  company,
  periodGranularity,
  periodFilter,
  currencyFilter,
  periodLabel,
}: BranchCollectionInvoiceDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<BranchCollectionInvoiceRow[]>([]);
  const [summary, setSummary] = useState({
    targetCr: 0,
    collectedCr: 0,
    gapCr: 0,
    invoiceCount: 0,
    currency: "INR",
  });

  useEffect(() => {
    if (!opened || !branch) return;

    setIsLoading(true);
    const timer = window.setTimeout(() => {
      const mock = getBranchCollectionInvoiceMock(branch);
      setRows(mock.rows);
      setSummary(mock.summary);
      setIsLoading(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [opened, branch, periodGranularity, periodFilter, currencyFilter]);

  const title = branch ? branchTitle(branch) : "";

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="72%"
      title={
        <Group gap={8} justify="space-between" wrap="nowrap" style={{ width: "100%" }}>
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} c="#111827" style={{ fontFamily: ERP_FONT_SANS }}>
              Branch Collection — Invoice Detail
            </Text>
            <Text fz={12} fw={600} c="#64748B" lineClamp={1}>
              {title}
            </Text>
          </Box>
          <Text fz={11} fw={600} c="#8AA0B9" ta="right" style={{ lineHeight: 1.4, flexShrink: 0 }}>
            {company}
            {" · "}
            {periodLabel}
            {currencyFilter && currencyFilter !== "all" ? ` · ${currencyFilter}` : ""}
          </Text>
        </Group>
      }
      styles={{
        body: { background: "#F8FAFC", padding: 14 },
        title: { width: "100%" },
      }}
    >
      {!branch ? null : (
        <Stack gap={10} style={{ fontFamily: ERP_FONT_SANS }}>
          <Alert color="yellow" variant="light" styles={{ message: { fontSize: 12 } }}>
            Showing demo invoice figures until the collection branch invoices API is available.
          </Alert>

          <Grid gutter={10}>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
                <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                  Target YTD
                </Text>
                <Text fw={800} fz={22} c="#111827" mt={4}>
                  ₹{formatAmountInCr(summary.targetCr)}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
                <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                  Collected YTD
                </Text>
                <Text fw={800} fz={22} c="#111827" mt={4}>
                  ₹{formatAmountInCr(summary.collectedCr)}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
                <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                  Gap
                </Text>
                <Text fw={800} fz={22} c={summary.gapCr >= 0 ? "#16A34A" : "#DC2626"} mt={4}>
                  {branch.gapDisplay ?? `₹${formatAmountInCr(Math.abs(summary.gapCr))}`}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder radius={8} p="md" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
                <Text fz={11} fw={700} c="#64748B" tt="uppercase">
                  Invoices
                </Text>
                <Text fw={800} fz={22} c="#111827" mt={4}>
                  {summary.invoiceCount}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>

          {branch.subtitle ? (
            <Text fz={12} c="#64748B">
              {branch.subtitle}
            </Text>
          ) : null}

          <Card
            withBorder
            radius={8}
            p={0}
            style={{ borderColor: "#E2E8F0", background: "#FFFFFF", overflow: "hidden" }}
          >
            <Box px="md" py="sm" style={{ background: "#F8FAFC" }}>
              <Text fw={700} fz={13} c="#0F172A">
                Invoice-level collections
              </Text>
            </Box>
            <Divider />

            {isLoading ? (
              <Group justify="center" py="xl">
                <Loader color="#105476" />
              </Group>
            ) : (
              <ScrollArea h={480}>
                <Table stickyHeader highlightOnHover horizontalSpacing="md" verticalSpacing={10}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Invoice</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Invoice date</Table.Th>
                      <Table.Th>Due date</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                      <Table.Th ta="right">Collected</Table.Th>
                      <Table.Th ta="right">Outstanding</Table.Th>
                      <Table.Th ta="right">Age</Table.Th>
                      <Table.Th ta="right">Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <Table.Tr key={row.invoiceNo}>
                        <Table.Td>
                          <Text fw={600} fz={12}>
                            {row.invoiceNo}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz={12} lineClamp={1}>
                            {row.customer}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz={12}>{dayjs(row.invoiceDate).format("DD MMM YYYY")}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz={12}>{dayjs(row.dueDate).format("DD MMM YYYY")}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} fz={12}>
                            ₹{formatAmountInCr(row.amountCr)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={12} c="#0F172A">
                            ₹{formatAmountInCr(row.collectedCr)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} fz={12} c={row.outstandingCr > 0 ? "#DC2626" : "#64748B"}>
                            ₹{formatAmountInCr(row.outstandingCr)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz={12} c={row.ageDays > 0 ? "#DC2626" : "#64748B"}>
                            {row.ageDays > 0 ? `${row.ageDays}d` : "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} fz={11} c={statusColor(row.status)}>
                            {row.status}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {!rows.length && (
                      <Table.Tr>
                        <Table.Td colSpan={9}>
                          <Text c="#94A3B8" ta="center" py="md">
                            No invoices available for this branch.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Card>
        </Stack>
      )}
    </Drawer>
  );
}
