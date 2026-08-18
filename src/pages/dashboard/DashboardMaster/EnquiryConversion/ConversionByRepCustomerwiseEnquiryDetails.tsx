import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import type { EnquiryDrilldownEnquiry } from "../../../../service/dashboard.service";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import { stageLabelFromApiStatus } from "./enquiryConversionDashboardMappers";
import {
  firstQuoteService,
  formatInrLakhs,
  laneFromEnquiry,
  parseMoney,
  winProbLabel,
} from "./customerwiseEnquiryHelpers";
import { formatMoneyAmountForUi } from "../../../../utils/nonDecimalMoneyAmount";
import {
  EnquiryConversionDrawerBack,
  EnquiryConversionDrawerHeaderSeparator,
} from "./EnquiryConversionDrawerBack";

const FONT = "'Geist', sans-serif";
const NAVY_BTN = "#0B1F3A";

type Props = {
  opened: boolean;
  onClose: () => void;
  enquiry: EnquiryDrilldownEnquiry | null;
  salesperson: string;
  customerName: string;
};

function mapQuotationFilterRowToDrilldown(
  row: Record<string, unknown>
): EnquiryDrilldownEnquiry {
  const quotationArr = Array.isArray(row.quotation)
    ? (row.quotation as Array<Record<string, unknown>>)
    : [];
  const quotations = quotationArr.map((q) => {
    const charges = Array.isArray(q.charges)
      ? (q.charges as Array<Record<string, unknown>>).map((c) => ({
          charge_name: String(c.charge_name ?? ""),
          unit: String(c.unit ?? ""),
          no_of_units:
            typeof c.no_of_units === "number"
              ? c.no_of_units
              : Number(c.no_of_units ?? 0),
          sell_per_unit: String(c.sell_per_unit ?? ""),
          total_sell: String(c.total_sell ?? ""),
          currency: String(c.currency ?? ""),
        }))
      : [];
    const cargoArr = Array.isArray(q.cargo_details)
      ? (q.cargo_details as Array<Record<string, unknown>>)
      : [];
    const cargo = cargoArr[0];
    const fcl_details =
      cargoArr.length > 0
        ? cargoArr.map((c) => ({
            // quotation/filter_quotations shape:
            // - container_type_code is the code (maps well to our container_type)
            // - container_type is the readable label (maps well to our container_name)
            container_type:
              c.container_type_code == null
                ? undefined
                : String(c.container_type_code),
            container_name:
              c.container_type == null ? undefined : String(c.container_type),
            no_of_containers:
              typeof c.no_of_containers === "number"
                ? c.no_of_containers
                : c.no_of_containers == null
                  ? undefined
                  : String(c.no_of_containers),
          }))
        : undefined;
    return {
      quotation_id: String(q.quotation_id ?? ""),
      created_at: String(q.created_at ?? ""),
      quotation_services: [
        {
          total_sell: String(
            charges.reduce((s, c) => s + Number(c.total_sell ?? 0), 0) || ""
          ),
          quote_currency: String(q.quote_currency ?? "INR"),
          valid_upto: String(q.valid_upto ?? ""),
          charges,
          service_details: {
            service: String(q.service_type ?? q.service_name ?? ""),
            shipment_terms_code_read: String(q.shipment_terms_code ?? ""),
            shipment_terms_name: String(q.shipment_terms ?? ""),
            origin_code_read: String(q.origin_code ?? ""),
            destination_code_read: String(q.destination_code ?? ""),
            origin_name: String(q.origin ?? ""),
            destination_name: String(q.destination ?? ""),
            gross_weight:
              typeof cargo?.gross_weight === "number"
                ? cargo.gross_weight
                : Number(cargo?.gross_weight ?? 0) || undefined,
            no_of_packages:
              typeof cargo?.no_of_packages === "number"
                ? cargo.no_of_packages
                : Number(cargo?.no_of_packages ?? 0) || undefined,
            commodity:
              q.commodity == null ? null : String(q.commodity ?? ""),
            fcl_details,
          },
        },
      ],
    };
  });

  const firstQuote = quotationArr[0];
  const firstCargoArr = Array.isArray(firstQuote?.cargo_details)
    ? (firstQuote?.cargo_details as Array<Record<string, unknown>>)
    : [];
  const firstCargo = firstCargoArr[0];
  const firstFclDetails =
    firstCargoArr.length > 0
      ? firstCargoArr.map((c) => ({
          container_type:
            c.container_type_code == null ? undefined : String(c.container_type_code),
          container_name:
            c.container_type == null ? undefined : String(c.container_type),
          no_of_containers:
            typeof c.no_of_containers === "number"
              ? c.no_of_containers
              : c.no_of_containers == null
                ? undefined
                : String(c.no_of_containers),
        }))
      : undefined;
  return {
    id: typeof row.id === "number" ? row.id : Number(row.id ?? 0) || undefined,
    enquiry_id: String(row.enquiry_id ?? ""),
    customer_name: String(row.customer_name ?? ""),
    customer_address: String(row.customer_address ?? ""),
    enquiry_received_date: String(row.enquiry_received_date ?? ""),
    sales_person: String(row.sales_person ?? ""),
    status: String(row.status ?? ""),
    services: firstQuote
      ? [
          {
            service: String(firstQuote.service_type ?? ""),
            service_name: String(firstQuote.service_name ?? ""),
            trade: String(firstQuote.trade ?? ""),
            shipment_terms_code_read: String(firstQuote.shipment_terms_code ?? ""),
            shipment_terms_name: String(firstQuote.shipment_terms ?? ""),
            origin_code_read: String(firstQuote.origin_code ?? ""),
            destination_code_read: String(firstQuote.destination_code ?? ""),
            origin_name: String(firstQuote.origin ?? ""),
            destination_name: String(firstQuote.destination ?? ""),
            gross_weight:
              typeof firstCargo?.gross_weight === "number"
                ? firstCargo.gross_weight
                : Number(firstCargo?.gross_weight ?? 0) || undefined,
            no_of_packages:
              typeof firstCargo?.no_of_packages === "number"
                ? firstCargo.no_of_packages
                : Number(firstCargo?.no_of_packages ?? 0) || undefined,
            commodity:
              firstQuote.commodity == null
                ? null
                : String(firstQuote.commodity ?? ""),
            fcl_details: firstFclDetails,
          },
        ]
      : [],
    origin_list: Array.isArray(row.origin_list)
      ? (row.origin_list as string[])
      : [],
    destination_list: Array.isArray(row.destination_list)
      ? (row.destination_list as string[])
      : [],
    origin_code_list: Array.isArray(row.origin_code_list)
      ? (row.origin_code_list as string[])
      : [],
    destination_code_list: Array.isArray(row.destination_code_list)
      ? (row.destination_code_list as string[])
      : [],
    quotations,
    reject_remark:
      row.reject_remark == null ? undefined : String(row.reject_remark).trim() || undefined,
  };
}

function cargoSummary(e: EnquiryDrilldownEnquiry): string {
  const s = e.services?.[0];
  if (!s) return "—";
  const fcl = s.fcl_details?.[0];
  const serviceCode = String(s.service ?? "").trim().toUpperCase();
  const commodity = String(s.commodity ?? "").trim();

  const containerLabel = String(
    fcl?.container_name || fcl?.container_type || ""
  ).trim();
  const containerCount =
    fcl?.no_of_containers == null ? "" : String(fcl.no_of_containers).trim();

  // Desired display:
  // - Air/LCL: Commodity · 4 pkg
  // - FCL: General · 1 × 20' Container
  if ((serviceCode === "FCL" || containerLabel) && containerCount) {
    const commodityLabel = commodity || "General";
    return `${commodityLabel} · ${containerCount} × ${containerLabel || "—"}`;
  }

  const parts: string[] = [];
  if (commodity) parts.push(commodity);
  if (s.no_of_packages != null && s.no_of_packages !== 0) {
    parts.push(`${s.no_of_packages} pkg`);
  }
  return parts.length ? parts.join(" · ") : s.service_name || s.service || "—";
}

function weightLabel(e: EnquiryDrilldownEnquiry): string {
  let w: number | string | null = null;
  if (e.services?.[0]?.service === "FCL") {
    console.log( "FFFFFF:" ,e.services?.[0]?.fcl_details?.[0]?.gross_weight);
     w = (e.services?.[0]?.fcl_details?.[0]?.gross_weight ?? 0);
  }
  else
  {
     w = e.services?.[0]?.gross_weight ?? 0;
  }
  if (w == null || w === "") return "—";
  const n = typeof w === "number" ? w : parseFloat(String(w));
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-IN")} kg`;
}

function lanePretty(e: EnquiryDrilldownEnquiry): string {
  const o = e.origin_list?.[0];
  const d = e.destination_list?.[0];
  if (o && d) return `${o} → ${d}`;
  return laneFromEnquiry(e);
}

type TimelineItem = {
  dt: string;
  title: string;
  actor: string;
  accent?: "orange" | "muted";
};

function buildTimeline(e: EnquiryDrilldownEnquiry): TimelineItem[] {
  const items: TimelineItem[] = [];
  if (e.enquiry_received_date) {
    items.push({
      dt: e.enquiry_received_date,
      title: "Enquiry received",
      actor: e.sales_person || "Sales",
    });
  }
  const q = e.quotations?.[0];
  if (q?.created_at) {
    items.push({
      dt: q.created_at,
      title: "Quotation created",
      actor: q.created_by_name || q.created_by || "System",
    });
  }
  const quotationUpdatedAt = (q as { updated_at?: string } | undefined)?.updated_at;
  if (quotationUpdatedAt) {
    items.push({
      dt: quotationUpdatedAt,
      title: "Quotation updated",
      actor: q?.created_by_name || q?.created_by || "System",
    });
  }

  const st = e.status?.toUpperCase() ?? "";
  if (st.includes("GAIN")) {
    items.push({
      dt: e.enquiry_received_date || "",
      title: "Enquiry gained",
      actor: e.sales_person || "Sales",
      accent: "orange",
    });
  } else if (st.includes("LOST")) {
    items.push({
      dt: e.enquiry_received_date || "",
      title: "Marked lost",
      actor: e.sales_coordinator || "Team",
      accent: "orange",
    });
  } else {
    items.push({
      dt: "",
      title: `Status: ${e.status}`,
      actor: e.sales_coordinator || "—",
      accent: "orange",
    });
  }
  return items.filter((x) => x.title);
}

export function ConversionByRepCustomerwiseEnquiryDetails({
  opened,
  onClose,
  enquiry,
  salesperson,
  customerName,
}: Props) {
  const enquiryId = enquiry?.enquiry_id ?? "";
  const queryDateFrom =
    (enquiry as (EnquiryDrilldownEnquiry & { __filterDateFrom?: string }) | null)
      ?.__filterDateFrom ?? "";
  const queryDateTo =
    (enquiry as (EnquiryDrilldownEnquiry & { __filterDateTo?: string }) | null)
      ?.__filterDateTo ?? "";

  const { data: apiEnquiry } = useQuery({
    queryKey: [
      "enquiryConversionQuotationFilterDetails",
      enquiryId,
      queryDateFrom ?? "",
      queryDateTo ?? "",
    ],
    queryFn: async () => {
      // `quotation/filter_quotations/` reliably supports filtering by enquiry_id.
      // Some environments may not support date filters here, so only include them when present.
      const payload: { filters: Record<string, string> } = {
        filters: {
          enquiry_id: enquiryId,
        },
      };
      if (queryDateFrom?.trim()) payload.filters.date_from = queryDateFrom;
      if (queryDateTo?.trim()) payload.filters.date_to = queryDateTo;
      const res = await apiCallProtected.post(URL.quotationFilter, payload);
      // const res = await apiCallProtected.post(URL.enquiryFilter, payload);
      const raw = (res as { data?: unknown }).data ?? (res as unknown);
      const body = raw as
        | { data?: unknown[]; results?: unknown[] }
        | unknown[]
        | undefined;
      const list = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.results)
            ? body.results
            : [];
      const first =
        Array.isArray(list) && list.length > 0
          ? (list[0] as Record<string, unknown>)
          : undefined;
      return first ? mapQuotationFilterRowToDrilldown(first) : null;
    },
    enabled:
      opened &&
      !!enquiryId.trim() &&
      // Allow drawer hydration even when date range isn't provided on the enquiry payload.
      true,
    staleTime: 20_000,
  });

  if (!enquiry) return null;

  const displayEnquiry = apiEnquiry ?? enquiry;

  const qs = firstQuoteService(displayEnquiry);
  const stage = stageLabelFromApiStatus(displayEnquiry.status);
  const prob = winProbLabel(displayEnquiry.status);
  const svc0 = displayEnquiry.services?.[0];
  const modeTitle =
    svc0?.service_name ||
    (svc0?.service ? `${svc0.service} ${svc0.trade ?? ""}`.trim() : "—");
  const terms = svc0?.shipment_terms_name || svc0?.shipment_terms_code_read || "—";
  const validityDays =
    qs?.valid_upto && displayEnquiry.enquiry_received_date
      ? Math.max(
          0,
          dayjs(qs.valid_upto).diff(
            dayjs(displayEnquiry.enquiry_received_date),
            "day"
          )
        )
      : null;
  const validityLabel =
    validityDays != null && validityDays > 0
      ? `${validityDays} days`
      : qs?.valid_upto
        ? "Open"
        : "—";
  const validitySub = displayEnquiry.enquiry_received_date
    ? `From ${dayjs(displayEnquiry.enquiry_received_date).format("D MMM YYYY")}`
    : qs?.valid_upto
      ? `Until ${dayjs(qs.valid_upto).format("D MMM YYYY")}`
      : "—";

  const timeline = buildTimeline(displayEnquiry);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="max(520px, 75vw)"
      padding={0}
      offset={8}
      radius="md"
      zIndex={500}
      withOverlay
      overlayProps={{ opacity: 0.38, blur: 2 }}
      styles={{
        header: { display: "none" },
        body: { padding: 0, height: "100%" },
        content: {
          fontFamily: FONT,
          borderLeft: "1px solid #E2E8F0",
          boxShadow: "-12px 0 32px rgba(15, 23, 42, 0.12)",
          background: "#f1f5f9",
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
          <Group gap={10} wrap="nowrap" align="center" style={{ minWidth: 0, flex: 1 }}>
            <EnquiryConversionDrawerBack onClick={onClose} />
            <EnquiryConversionDrawerHeaderSeparator />
            <Text fz={12} fw={500} c="#64748B" truncate style={{ minWidth: 0 }}>
              {salesperson} &gt; {customerName} &gt; {displayEnquiry.enquiry_id}
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
          <Stack gap="lg" p={20} pb={100}>
            <Box>
              <Text fw={700} fz={22} c="#0F172A">
                {displayEnquiry.enquiry_id}
              </Text>
              <Group gap={8} mt={8} wrap="wrap">
                <Text fz={13} fw={600} c="#334155">
                  {customerName}
                </Text>
                <Text fz={13} c="#94A3B8">
                  ·
                </Text>
                <Group gap={6} wrap="nowrap">
                  <Box
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: stage.dotColor,
                    }}
                  />
                  <Text fz={13} fw={600} c={stage.dotColor}>
                    {stage.label}
                  </Text>
                </Group>
                <Text fz={13} c="#94A3B8">
                  · Win prob {prob}
                </Text>
              </Group>
            </Box>

            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing={12} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          
              <Box
                p={14}
                style={{
                  background: enquiryConversionColors.panelBg,
                  border: `1px solid ${enquiryConversionColors.panelBorder}`,
                  borderRadius: enquiryConversionColors.radius,
                  boxShadow: enquiryConversionColors.shadow,
                }}
              >
                <Text fz={9} fw={700} c="#8FA2B7" tt="uppercase" lts="0.04em" mb={8}>
                  MODE
                </Text>
                <Text fz={17} fw={700} c="#0B1F3A" lh={1.2}>
                  {modeTitle}
                </Text>
                <Text fz={12} fw={600} c="#64748B" mt={4}>
                  {terms}
                </Text>
              </Box>
              <Box
                p={14}
                style={{
                  background: enquiryConversionColors.panelBg,
                  border: `1px solid ${enquiryConversionColors.panelBorder}`,
                  borderRadius: enquiryConversionColors.radius,
                  boxShadow: enquiryConversionColors.shadow,
                }}
              >
                <Text fz={9} fw={700} c="#8FA2B7" tt="uppercase" lts="0.04em" mb={8}>
                  TRANSIT
                </Text>
                <Text fz={12} fw={600} c="#64748B" mt={4}>
                  {lanePretty(displayEnquiry)}
                </Text>
              </Box>
              <Box
                p={14}
                style={{
                  background: enquiryConversionColors.panelBg,
                  border: `1px solid ${enquiryConversionColors.panelBorder}`,
                  borderRadius: enquiryConversionColors.radius,
                  boxShadow: enquiryConversionColors.shadow,
                }}
              >
                <Text fz={9} fw={700} c="#8FA2B7" tt="uppercase" lts="0.04em" mb={8}>
                  VALIDITY
                </Text>
                <Text fz={16} fw={700} c="#0B1F3A" lh={1.2}>
                  {validityLabel}
                </Text>
                <Text fz={12} fw={600} c="#64748B" mt={4}>
                  {validitySub}
                </Text>
              </Box>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={12}>
              <Box
                p={16}
                style={{
                  background: enquiryConversionColors.panelBg,
                  border: `1px solid ${enquiryConversionColors.panelBorder}`,
                  borderRadius: enquiryConversionColors.radius,
                  boxShadow: enquiryConversionColors.shadow,
                }}
              >
                <Text
                  fz={10}
                  fw={700}
                  c="#8FA2B7"
                  tt="uppercase"
                  lts="0.06em"
                  mb={14}
                >
                  CUSTOMER &amp; CARGO
                </Text>
                <Stack gap={10}>
                  <DetailRow label="Customer" value={customerName || displayEnquiry.customer_name || "—"} />
                  <DetailRow label="Cargo" value={cargoSummary(displayEnquiry)} />
                  <DetailRow label="Weight" value={weightLabel(displayEnquiry)} />
                  <DetailRow label="Lane" value={lanePretty(displayEnquiry)} />
                  <DetailRow label="Sales rep" value={salesperson} />
                  <DetailRow
                    label="Reject remark"
                    value={displayEnquiry.reject_remark?.trim() || "—"}
                  />
                  <DetailRow label="Source" value="—" />
                </Stack>
              </Box>

              <Box
                p={16}
                style={{
                  background: enquiryConversionColors.panelBg,
                  border: `1px solid ${enquiryConversionColors.panelBorder}`,
                  borderRadius: enquiryConversionColors.radius,
                  boxShadow: enquiryConversionColors.shadow,
                  minHeight: 280,
                }}
              >
                <Text
                  fz={10}
                  fw={700}
                  c="#8FA2B7"
                  tt="uppercase"
                  lts="0.06em"
                  mb={14}
                >
                  ACTIVITY TIMELINE
                </Text>
                <Stack gap={0}>
                  {timeline.map((t, i) => (
                    <Box
                      key={`${t.title}-${i}`}
                      pl={18}
                      pb={16}
                      style={{
                        borderLeft:
                          i < timeline.length - 1 ? "2px solid #E2E8F0" : "none",
                        position: "relative",
                      }}
                    >
                      <Box
                        style={{
                          position: "absolute",
                          left: -5,
                          top: 2,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor:
                            t.accent === "orange" ? "#F97316" : "#94A3B8",
                          boxShadow: "0 0 0 3px #fff",
                        }}
                      />
                      <Text fz={11} fw={600} c="#64748B">
                        {t.dt ? dayjs(t.dt).format("D MMM YYYY · HH:mm") : "—"}
                      </Text>
                      <Text fz={13} fw={700} c="#0F172A" mt={2}>
                        {t.title}
                      </Text>
                      <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                        {t.actor}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </SimpleGrid>

            {/* <Box
              style={{
                background: enquiryConversionColors.panelBg,
                border: `1px solid ${enquiryConversionColors.panelBorder}`,
                borderRadius: enquiryConversionColors.radius,
                boxShadow: enquiryConversionColors.shadow,
                overflow: "hidden",
              }}
            >
              <Text fw={700} fz={14} c="#0F172A" p="md" pb={0}>
                QUOTATION LINE ITEMS
              </Text>
              <Table horizontalSpacing="md" verticalSpacing={10} mt={8}>
                <Table.Thead>
                  <Table.Tr style={{ background: "#F8FAFC" }}>
                    {["DESCRIPTION", "QTY", "UNIT", "RATE", "AMOUNT"].map((h) => (
                      <Table.Th
                        key={h}
                        fz={10}
                        fw={700}
                        c="#94A3B8"
                        tt="uppercase"
                        ta={h === "DESCRIPTION" ? "left" : "right"}
                      >
                        {h}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {charges.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text fz={13} c="#94A3B8" py={8}>
                          No line items in quotation.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    charges.map((c, idx) => (
                      <Table.Tr key={c.charge_name ?? idx}>
                        <Table.Td>
                          <Text fz={13} fw={600} c="#0F172A">
                            {c.charge_name ?? "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                            {c.no_of_units ?? "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                            {c.unit ?? "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                            {c.sell_per_unit != null
                              ? `${c.currency ?? quoteCur} ${c.sell_per_unit}`
                              : "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz={13} fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                            {c.total_sell != null
                              ? formatMoneyAmountForUi(parseMoney(c.total_sell))
                              : "—"}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
              <Box
                p="md"
                pt={12}
                style={{ borderTop: "1px solid #EEF2F7", background: "#FAFBFC" }}
              >
                <Group justify="space-between">
                  <Text fz={13} fw={700} c="#0F172A">
                    Total ({quoteCur}):
                  </Text>
                  <Text fz={15} fw={700} c="#0F172A" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {totalSell > 0
                      ? formatMoneyAmountForUi(totalSell)
                      : "—"}
                  </Text>
                </Group>
                {quoteCur !== "INR" ? (
                  <Text fz={12} fw={600} c="#64748B" mt={6} ta="right">
                    Approx. INR: {formatInrLakhs(totalSell * 83)}
                  </Text>
                ) : (
                  <Text fz={12} fw={600} c="#64748B" mt={6} ta="right">
                    Approx. INR: {formatInrLakhs(totalSell)}
                  </Text>
                )}
              </Box>
            </Box> */}
          </Stack>
        </ScrollArea>

        <Box
          px={20}
          py={14}
          style={{
            borderTop: "1px solid #E2E8F0",
            flexShrink: 0,
            background: "#fff",
          }}
        >
          <Group gap={10} wrap="wrap" justify="flex-end">
            <Button
              radius="md"
              size="sm"
              fw={600}
              style={{ background: NAVY_BTN }}
              onClick={() => {}}
            >
              Send revised quote
            </Button>
            <Button radius="md" size="sm" variant="default" fw={600} onClick={() => {}}>
              Mark as won
            </Button>
            <Button radius="md" size="sm" variant="default" fw={600} onClick={() => {}}>
              Mark as lost
            </Button>
            <Button radius="md" size="sm" variant="default" fw={600} onClick={() => {}}>
              Open in CRM
            </Button>
          </Group>
        </Box>
      </Box>
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={12} align="flex-start" wrap="nowrap">
      <Text fz={11} fw={700} c="#94A3B8" w={88} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text fz={13} fw={600} c="#0F172A" style={{ flex: 1 }}>
        {value}
      </Text>
    </Group>
  );
}
