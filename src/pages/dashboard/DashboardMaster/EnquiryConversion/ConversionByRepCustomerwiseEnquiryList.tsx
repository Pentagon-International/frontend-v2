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
import { IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import { useDashboardChartSearch } from "../../../../hooks/useDashboardChartSearch";
import {
  extractNumericValue,
  type EnquiryConversionCustomerwiseResponse,
  type EnquiryDrilldownEnquiry,
} from "../../../../service/dashboard.service";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import { stageLabelFromApiStatus } from "./enquiryConversionDashboardMappers";
import {
  badgeColorForMode,
  laneFromEnquiry,
  modeAbbrev,
} from "./customerwiseEnquiryHelpers";
import { ConversionByRepCustomerwiseEnquiryDetails } from "./ConversionByRepCustomerwiseEnquiryDetails";
import {
  EnquiryConversionDrawerBack,
  EnquiryConversionDrawerHeaderSeparator,
} from "./EnquiryConversionDrawerBack";

/** Aligned with Pentagon Sales Dashboard standalone (`openCustomer`, `.dd-*`, `.card`, table) */
const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const INK = "#0f172a";
const INK2 = "#334155";
const INK3 = "#64748b";
const INK4 = "#94a3b8";
const LINE = "#e2e8f0";
const PANEL_BG = "#f1f5f9";
const TABLE_HEAD_BG = "#f8fafc";
const GOOD = "#16a34a";
const BAD = "#dc2626";

type Props = {
  opened: boolean;
  onClose: () => void;
  salesperson: string | null;
  apiType?: string | null;
  company: string;
  filters: EnquiryConversionPageFilters;
  customerCode: string | null;
  customerName: string;
};

export function ConversionByRepCustomerwiseEnquiryList({
  opened,
  onClose,
  salesperson,
  apiType = null,
  company,
  filters,
  customerCode,
  customerName,
}: Props) {
  const { committed: committedSearch } = useDashboardChartSearch();
  const fd = filters.fromDate;
  const td = filters.toDate;
  const normalizedApiType = (apiType ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const stageMetricLabel =
    normalizedApiType === "ACTIVE"
      ? "Active"
      : normalizedApiType === "QUOTE CREATED"
        ? "Quote created"
        : normalizedApiType === "LOST"
          ? "Lost"
          : "Won";

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "enquiryConversionCustomerwise",
      company,
      customerCode ?? "",
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
      apiType ?? "",
      filters.service ?? "",
      committedSearch?.trim() ?? "",
    ],
    queryFn: async () => {
      const body: Record<string, string> = {
        company,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        customer_code: customerCode!,
      };
      const t = apiType?.trim();
      if (t) body.type = t;
      const svc = filters.service?.trim();
      if (svc) body.service = svc;
      const q = committedSearch?.trim();
      if (q) body.search = q;
      const response = await apiCallProtected.post(
        URL.dashboard.enquiryConversion,
        body
      );
      return response as unknown as EnquiryConversionCustomerwiseResponse;
    },
    enabled:
      opened &&
      !!customerCode?.trim() &&
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
  const active = extractNumericValue(row?.active);
  const gained = extractNumericValue(row?.gained);
  const quoteCreated = extractNumericValue(row?.quote_created);
  const lost = extractNumericValue(row?.lost);
  const stageMetricValue =
    normalizedApiType === "ACTIVE"
      ? active
      : normalizedApiType === "QUOTE CREATED"
        ? quoteCreated
        : normalizedApiType === "LOST"
          ? lost
          : gained;
  const stageMetricColor = normalizedApiType === "LOST" ? BAD : GOOD;

  const repLabel = salesperson?.trim() || data?.salesperson || "Rep";

  const rowMeta = row as unknown as Record<string, unknown> | undefined;
  const industryRaw =
    rowMeta?.industry ?? rowMeta?.customer_industry ?? rowMeta?.segment;
  const industryLine =
    typeof industryRaw === "string" ? industryRaw.trim() : "";
  const titleSub = `${industryLine || "—"} · Account owner: ${repLabel}`;

  const [detailOpen, setDetailOpen] = useState<EnquiryDrilldownEnquiry | null>(null);

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="min(920px, 92vw)"
        padding={0}
        offset={8}
        radius="md"
        zIndex={400}
        withOverlay
        overlayProps={{ backgroundOpacity: 0.32, color: "#0f172a", blur: 0 }}
        styles={{
          header: { display: "none" },
          body: { padding: 0, height: "100%", background: PANEL_BG },
          content: {
            fontFamily: FONT,
            borderLeft: `1px solid ${LINE}`,
            boxShadow: "-16px 0 40px rgba(15, 23, 42, 0.18)",
            background: PANEL_BG,
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
            px={22}
            py={14}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              background: enquiryConversionColors.panelBg,
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            <Group gap={10} wrap="nowrap" align="center" style={{ minWidth: 0, flex: 1 }}>
              <EnquiryConversionDrawerBack onClick={onClose} />
              <EnquiryConversionDrawerHeaderSeparator />
              <Text
                fz={12}
                fw={500}
                c={INK3}
                truncate
                style={{ minWidth: 0, lineHeight: 1.45 }}
              >
                {repLabel} &gt; {customerName || row?.customer_name || "—"}
              </Text>
            </Group>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onClose}
              aria-label="Close"
              size={30}
              radius="md"
              style={{ color: INK3 }}
            >
              <IconX size={18} stroke={2} />
            </ActionIcon>
          </Box>

          <ScrollArea type="scroll" scrollbarSize={8} style={{ flex: 1, minHeight: 0 }}>
            <Stack gap={0} p={22} pb={32} style={{ background: PANEL_BG }}>
              <Box
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                  minWidth: 0,
                }}
              >
                <Text
                  component="h2"
                  m={0}
                  fz={18}
                  fw={600}
                  c={INK}
                  lh={1.2}
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {customerName || row?.customer_name || "—"}
                </Text>
                <Text fz={12} c={INK3} fw={400} lh={1.45} style={{ minWidth: 0 }}>
                  {titleSub}
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
                  <SimpleGrid
                    cols={{ base: 1, sm: 5 }}
                    spacing={10}
                    mb={16}
                    style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
                  >
                    {[
                      {
                        label: "Enquiries",
                        value: String(enquiriesKpi),
                        valueColor: INK,
                      },
                      {
                        label: stageMetricLabel,
                        value: stageMetricValue.toLocaleString("en-IN"),
                        valueColor: stageMetricColor,
                      },
                      // {
                      //   label: "Win rate",
                      //   value: `${wrStr}%`,
                      //   valueColor: INK,
                      // },
                      // {
                      //   label: "Won value (FY)",
                      //   value: wonValueLabel,
                      //   valueColor: INK,
                      // },
                    ].map((k) => (
                      <Box
                        key={k.label}
                        p="10px 12px"
                        style={{
                          background: enquiryConversionColors.panelBg,
                          border: `1px solid ${LINE}`,
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          fz={10}
                          fw={500}
                          c={INK3}
                          tt="uppercase"
                          lts="0.04em"
                        >
                          {k.label}
                        </Text>
                        <Text
                          fz={18}
                          fw={600}
                          c={k.valueColor}
                          lh={1.15}
                          mt={2}
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {k.value}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>

                  <Box
                    style={{
                      background: enquiryConversionColors.panelBg,
                      border: `1px solid ${LINE}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      px={18}
                      pt={18}
                      pb={12}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <Text
                        component="h3"
                        m={0}
                        fz={13}
                        fw={600}
                        c={INK}
                        style={{ letterSpacing: "-0.005em" }}
                      >
                        Enquiries &amp; Quotations
                      </Text>
                      <Text fz={11} c={INK4} fw={400}>
                        Click for full quotation detail
                      </Text>
                    </Box>
                    <Table
                      horizontalSpacing={12}
                      verticalSpacing={11}
                      withRowBorders={false}
                      highlightOnHover
                      highlightOnHoverColor={TABLE_HEAD_BG}
                      style={{ borderTop: `1px solid ${LINE}` }}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          {[
                            "Enquiry",
                            "Lane",
                            "Mode",
                            "Stage",
                            // "Prob.",
                            // "Value",
                          ].map((h, i) => (
                            <Table.Th
                              key={h}
                              fz={11}
                              fw={500}
                              c={INK3}
                              tt="uppercase"
                              lts="0.04em"
                              ta={i >= 4 ? "right" : "left"}
                              style={{
                                background: TABLE_HEAD_BG,
                                padding: "10px 12px",
                                borderBottom: `1px solid ${LINE}`,
                                whiteSpace: "nowrap",
                              }}
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
                              <Text fz={13} c={INK4} py={8}>
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
                            return (
                              <Table.Tr
                                key={e.id ?? e.enquiry_id}
                                onClick={() => setDetailOpen(e)}
                                style={{ cursor: "pointer" }}
                              >
                                <Table.Td
                                  style={{
                                    verticalAlign: "middle",
                                    padding: "11px 12px",
                                    borderBottom: `1px solid ${LINE}`,
                                  }}
                                >
                                  <Text fz={12} fw={600} c={INK} lh={1.35}>
                                    {e.enquiry_id}
                                  </Text>
                                  <Text fz={10.5} c={INK4} mt={1} lh={1.3}>
                                    {recv}
                                  </Text>
                                </Table.Td>
                                <Table.Td
                                  style={{
                                    verticalAlign: "middle",
                                    padding: "11px 12px",
                                    borderBottom: `1px solid ${LINE}`,
                                  }}
                                >
                                  <Text
                                    fz={11}
                                    fw={500}
                                    c={INK2}
                                    style={{
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      letterSpacing: "0.02em",
                                    }}
                                  >
                                    {laneFromEnquiry(e)}
                                  </Text>
                                </Table.Td>
                                <Table.Td
                                  style={{
                                    verticalAlign: "middle",
                                    padding: "11px 12px",
                                    borderBottom: `1px solid ${LINE}`,
                                  }}
                                >
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
                                <Table.Td
                                  style={{
                                    verticalAlign: "middle",
                                    padding: "11px 12px",
                                    borderBottom: `1px solid ${LINE}`,
                                  }}
                                >
                                  <Box
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      background: `${stage.dotColor}15`,
                                      padding: "2px 10px",
                                      borderRadius: 4,
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
                                    <Text fz={11} fw={500} c={stage.dotColor}>
                                      {stage.label}
                                    </Text>
                                  </Box>
                                </Table.Td>
                                {/* <Table.Td
                                  ta="right"
                                  style={{
                                    verticalAlign: "middle",
                                    padding: "11px 12px",
                                    borderBottom: `1px solid ${LINE}`,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  <Text fz={12} fw={500} c={INK} lh={1.35}>
                                    {winProbLabel(e.status)}
                                  </Text>
                                </Table.Td>
                                <Table.Td
                                  ta="right"
                                  style={{
                                    verticalAlign: "middle",
                                    padding: "11px 12px",
                                    borderBottom: `1px solid ${LINE}`,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  <Text fz={12} fw={600} c={INK} lh={1.35}>
                                    {val > 0 ? formatInrLakhs(val) : "—"}
                                  </Text>
                                </Table.Td> */}
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
