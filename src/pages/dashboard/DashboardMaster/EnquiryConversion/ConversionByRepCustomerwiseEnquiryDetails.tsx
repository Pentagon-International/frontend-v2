import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import type { EnquiryDrilldownEnquiry } from "../../../../service/dashboard.service";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import { stageLabelFromApiStatus } from "./enquiryConversionDashboardMappers";
import {
  firstQuoteService,
  formatInrLakhs,
  laneFromEnquiry,
  parseMoney,
  primaryQuoteTotalSell,
  winProbLabel,
} from "./customerwiseEnquiryHelpers";
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

function formatQuoteValueDisplay(e: EnquiryDrilldownEnquiry): {
  primary: string;
  secondary?: string;
} {
  const qs = firstQuoteService(e);
  const cur = (qs?.quote_currency || "INR").toUpperCase();
  const total = parseMoney(qs?.total_sell);
  if (total <= 0) return { primary: "—" };
  if (cur === "USD") {
    const usd = total.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return {
      primary: `USD ${usd}`,
      secondary: `≈ ${formatInrLakhs(total * 83)}`,
    };
  }
  return {
    primary: `${cur} ${total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
    secondary: `≈ ${formatInrLakhs(total)}`,
  };
}

function cargoSummary(e: EnquiryDrilldownEnquiry): string {
  const s = e.services?.[0];
  if (!s) return "—";
  const parts: string[] = [];
  if (s.commodity) parts.push(String(s.commodity));
  const fcl = s.fcl_details?.[0];
  if (fcl?.container_type && fcl?.no_of_containers != null) {
    parts.push(`${fcl.no_of_containers} × ${fcl.container_type}`);
  } else if (s.no_of_packages) {
    parts.push(`${s.no_of_packages} pkg`);
  }
  return parts.length ? parts.join(" · ") : s.service_name || s.service || "—";
}

function weightLabel(e: EnquiryDrilldownEnquiry): string {
  const w = e.services?.[0]?.gross_weight;
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
  if (!enquiry) return null;

  const qs = firstQuoteService(enquiry);
  const stage = stageLabelFromApiStatus(enquiry.status);
  const prob = winProbLabel(enquiry.status);
  const quoteFmt = formatQuoteValueDisplay(enquiry);
  const svc0 = enquiry.services?.[0];
  const modeTitle =
    svc0?.service_name ||
    (svc0?.service ? `${svc0.service} ${svc0.trade ?? ""}`.trim() : "—");
  const terms = svc0?.shipment_terms_name || svc0?.shipment_terms_code_read || "—";
  const validityDays =
    qs?.valid_upto && enquiry.enquiry_received_date
      ? Math.max(
          0,
          dayjs(qs.valid_upto).diff(
            dayjs(enquiry.enquiry_received_date),
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
  const validitySub = enquiry.enquiry_received_date
    ? `From ${dayjs(enquiry.enquiry_received_date).format("D MMM YYYY")}`
    : qs?.valid_upto
      ? `Until ${dayjs(qs.valid_upto).format("D MMM YYYY")}`
      : "—";

  const charges = qs?.charges ?? [];
  const totalSell = primaryQuoteTotalSell(enquiry);
  const quoteCur = (qs?.quote_currency || "INR").toUpperCase();

  const timeline = buildTimeline(enquiry);

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
              {salesperson} &gt; {customerName} &gt; {enquiry.enquiry_id}
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
                {enquiry.enquiry_id}
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
                  QUOTE VALUE
                </Text>
                <Text fz={22} fw={700} c="#0B1F3A" lh={1.15}>
                  {quoteFmt.primary}
                </Text>
                {quoteFmt.secondary ? (
                  <Text fz={12} fw={600} c="#64748B" mt={4}>
                    {quoteFmt.secondary}
                  </Text>
                ) : null}
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
                <Text fz={16} fw={700} c="#0B1F3A" lh={1.2}>
                  —
                </Text>
                <Text fz={12} fw={600} c="#64748B" mt={4}>
                  {lanePretty(enquiry)}
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
                  <DetailRow label="Customer" value={customerName || enquiry.customer_name || "—"} />
                  <DetailRow
                    label="Contact"
                    value={
                      enquiry.sales_coordinator
                        ? `${enquiry.sales_coordinator} · Sales ops`
                        : "—"
                    }
                  />
                  <DetailRow label="Cargo" value={cargoSummary(enquiry)} />
                  <DetailRow label="Weight" value={weightLabel(enquiry)} />
                  <DetailRow label="Lane" value={lanePretty(enquiry)} />
                  <DetailRow label="Sales rep" value={salesperson} />
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

            <Box
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
                              ? parseMoney(c.total_sell).toLocaleString("en-IN", {
                                  maximumFractionDigits: 2,
                                })
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
                      ? totalSell.toLocaleString("en-IN", { maximumFractionDigits: 2 })
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
            </Box>
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
