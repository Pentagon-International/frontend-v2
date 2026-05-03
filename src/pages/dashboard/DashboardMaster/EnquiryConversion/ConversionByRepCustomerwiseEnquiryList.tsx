import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  getEnquiryConversionCustomerwiseDetail,
  extractNumericValue,
  type EnquiryDrilldownEnquiry,
} from "../../../../service/dashboard.service";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import { stageLabelFromApiStatus } from "./enquiryConversionDashboardMappers";
import {
  badgeColorForMode,
  formatInrLakhs,
  laneFromEnquiry,
  modeAbbrev,
  primaryQuoteTotalSell,
  winProbLabel,
} from "./customerwiseEnquiryHelpers";
import { ConversionByRepCustomerwiseEnquiryDetails } from "./ConversionByRepCustomerwiseEnquiryDetails";

const FONT = "'Geist', sans-serif";
const GREEN = "#16A34A";

type Props = {
  opened: boolean;
  onClose: () => void;
  salesperson: string | null;
  company: string;
  filters: EnquiryConversionPageFilters;
  customerCode: string | null;
  customerName: string;
};

export function ConversionByRepCustomerwiseEnquiryList({
  opened,
  onClose,
  salesperson,
  company,
  filters,
  customerCode,
  customerName,
}: Props) {
  const fd = filters.fromDate;
  const td = filters.toDate;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "enquiryConversionCustomerwise",
      company,
      salesperson ?? "",
      customerCode ?? "",
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
      filters.type ?? "",
      filters.service ?? "",
    ],
    queryFn: () =>
      getEnquiryConversionCustomerwiseDetail({
        company,
        salesperson: salesperson!,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        customer_code: customerCode!,
        type: filters.type,
        service: filters.service,
      }),
    enabled:
      opened &&
      !!customerCode?.trim() &&
      !!salesperson?.trim() &&
      !!company &&
      !!fd &&
      !!td,
    staleTime: 20_000,
  });

  const busy = (isLoading || isFetching) && opened;
  const row = data?.data?.[0];
  const enquiries: EnquiryDrilldownEnquiry[] = Array.isArray(row?.enquiries)
    ? row!.enquiries!
    : [];

  const te = extractNumericValue(row?.total_enquiry);
  const summaryTotal = data?.summary?.total_enquiry_count;
  const enquiriesKpi =
    summaryTotal != null && summaryTotal !== undefined
      ? summaryTotal
      : te || enquiries.length;
  const gained = extractNumericValue(row?.gained);
  const wr = te > 0 ? (gained / te) * 100 : 0;
  const wrStr =
    Math.abs(wr - Math.round(wr)) < 0.05 ? `${Math.round(wr)}` : wr.toFixed(1);

  let wonValueSum = 0;
  for (const e of enquiries) {
    if (e.status?.toUpperCase().includes("GAIN")) {
      wonValueSum += primaryQuoteTotalSell(e);
    }
  }
  const wonValueLabel =
    wonValueSum > 0 ? formatInrLakhs(wonValueSum) : "—";

  const repLabel = salesperson?.trim() || data?.salesperson || "Rep";

  const [detailOpen, setDetailOpen] = useState<EnquiryDrilldownEnquiry | null>(null);

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="max(520px, 75vw)"
        padding={0}
        offset={8}
        radius="md"
        zIndex={400}
        withOverlay
        overlayProps={{ opacity: 0.35, blur: 2 }}
        styles={{
          header: { display: "none" },
          body: { padding: 0, height: "100%" },
          content: {
            fontFamily: FONT,
            borderLeft: "1px solid #E2E8F0",
            boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.1)",
          },
        }}
      >
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            maxHeight: "100%",
          }}
        >
          <Box
            px={20}
            py={12}
            style={{
              borderBottom: "1px solid #EEF2F7",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Back"
                onClick={onClose}
              >
                <IconArrowLeft size={18} stroke={2} />
              </ActionIcon>
              <Text fz={12} fw={600} c="#64748B" truncate style={{ minWidth: 0 }}>
                {repLabel} &gt; {customerName || row?.customer_name || "—"}
              </Text>
            </Group>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={18} stroke={2} />
            </ActionIcon>
          </Box>

          <ScrollArea type="scroll" scrollbarSize={8} style={{ flex: 1, minHeight: 0 }}>
            <Stack gap="lg" p={20} pb={28}>
              <Box style={{ minWidth: 0 }}>
                <Text fw={700} fz={22} c="#0F172A" lh={1.2}>
                  {customerName || row?.customer_name || "—"}
                </Text>
                <Text fz={12} fw={500} c="#94A3B8" mt={6}>
                  Account owner: {repLabel}
                </Text>
              </Box>

              {error ? (
                <Text fz={13} c="red">
                  {(error as Error).message}
                </Text>
              ) : null}

              {busy ? (
                <Center py={40}>
                  <Loader color="#101C2E" />
                </Center>
              ) : (
                <>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={12}>
                    {[
                      {
                        label: "ENQUIRIES",
                        value: String(enquiriesKpi),
                        sub: undefined as string | undefined,
                        valueColor: "#0B1F3A",
                      },
                      {
                        label: "WON",
                        value: gained.toLocaleString("en-IN"),
                        sub: undefined,
                        valueColor: GREEN,
                      },
                      {
                        label: "WIN RATE",
                        value: `${wrStr}%`,
                        sub: undefined,
                        valueColor: GREEN,
                      },
                      {
                        label: "WON VALUE (FY)",
                        value: wonValueLabel,
                        sub: undefined,
                        valueColor: "#0B1F3A",
                      },
                    ].map((k) => (
                      <Box
                        key={k.label}
                        p={12}
                        style={{
                          background: enquiryConversionColors.panelBg,
                          border: `1px solid ${enquiryConversionColors.panelBorder}`,
                          borderRadius: enquiryConversionColors.radius,
                          boxShadow: enquiryConversionColors.shadow,
                          minHeight: 88,
                        }}
                      >
                        <Text
                          fz={9}
                          fw={700}
                          c="#8FA2B7"
                          tt="uppercase"
                          lts="0.04em"
                          mb={8}
                        >
                          {k.label}
                        </Text>
                        <Text fz={24} fw={700} c={k.valueColor} lh={1.1}>
                          {k.value}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>

                  <Box>
                    <Text fw={700} fz={15} c="#0F172A">
                      Enquiries &amp; Quotations
                    </Text>
                    <Text fz={12} fw={500} c="#94A3B8" mt={4}>
                      Click for full quotation detail
                    </Text>
                  </Box>

                  <Box
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${enquiryConversionColors.panelBorder}`,
                      borderRadius: enquiryConversionColors.radius,
                      boxShadow: enquiryConversionColors.shadow,
                      overflow: "hidden",
                    }}
                  >
                    <Table horizontalSpacing="md" verticalSpacing={14}>
                      <Table.Thead>
                        <Table.Tr style={{ background: "#F8FAFC" }}>
                          {[
                            "ENQUIRY",
                            "LANE",
                            "MODE",
                            "STAGE",
                            "PROB.",
                            "VALUE",
                          ].map((h, i) => (
                            <Table.Th
                              key={h}
                              fz={10}
                              fw={700}
                              c="#94A3B8"
                              tt="uppercase"
                              ta={i === 0 ? "left" : i >= 4 ? "right" : "left"}
                            >
                              {h}
                            </Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {enquiries.length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <Text fz={13} c="#94A3B8" py={8}>
                                No enquiries for this customer.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          enquiries.map((e) => {
                            const svc = e.services?.[0]?.service ?? "—";
                            const modeColor = badgeColorForMode(svc);
                            const stage = stageLabelFromApiStatus(e.status);
                            const recv = e.enquiry_received_date
                              ? dayjs(e.enquiry_received_date).format("D MMM")
                              : "—";
                            const val = primaryQuoteTotalSell(e);
                            return (
                              <Table.Tr
                                key={e.id ?? e.enquiry_id}
                                onClick={() => setDetailOpen(e)}
                                style={{
                                  cursor: "pointer",
                                }}
                              >
                                <Table.Td style={{ verticalAlign: "top" }}>
                                  <Text fz={13} fw={700} c="#0F172A">
                                    {e.enquiry_id}
                                  </Text>
                                  <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                                    {recv}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text fz={12} fw={600} c="#475569">
                                    {laneFromEnquiry(e)}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge
                                    size="xs"
                                    variant="light"
                                    radius="sm"
                                    fw={700}
                                    px={6}
                                    h={22}
                                    style={{
                                      backgroundColor: `${modeColor}18`,
                                      color: modeColor,
                                      border: `1px solid ${modeColor}28`,
                                    }}
                                  >
                                    {modeAbbrev(svc)}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Box
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      background: `${stage.dotColor}15`,
                                      padding: "2px 10px",
                                      borderRadius: 12,
                                      height: 22,
                                    }}
                                  >
                                    <Box
                                      style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        backgroundColor: stage.dotColor,
                                      }}
                                    />
                                    <Text fz={11} fw={700} c={stage.dotColor}>
                                      {stage.label}
                                    </Text>
                                  </Box>
                                </Table.Td>
                                <Table.Td ta="right">
                                  <Text fz={13} fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {winProbLabel(e.status)}
                                  </Text>
                                </Table.Td>
                                <Table.Td ta="right">
                                  <Text fz={13} fw={700} style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {val > 0 ? formatInrLakhs(val) : "—"}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })
                        )}
                      </Table.Tbody>
                    </Table>
                  </Box>
                </>
              )}
            </Stack>
          </ScrollArea>
        </Box>
      </Drawer>

      <ConversionByRepCustomerwiseEnquiryDetails
        opened={detailOpen !== null}
        onClose={() => setDetailOpen(null)}
        enquiry={detailOpen}
        salesperson={repLabel}
        customerName={customerName || row?.customer_name || ""}
      />
    </>
  );
}
