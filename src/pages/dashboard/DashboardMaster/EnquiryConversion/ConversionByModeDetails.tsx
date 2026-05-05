import { useMemo } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Drawer,
  Flex,
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
import {
  getEnquiryConversionDashboardData,
  extractNumericValue,
  type EnquiryConversionTopEnquiryRow,
  type EnquiryDrilldownEnquiry,
} from "../../../../service/dashboard.service";
import type { ModeLegendRow } from "./ByModeValueCard";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import {
  buildDrilldownFromTopEnquiryRow,
  stageLabelFromApiStatus,
} from "./enquiryConversionDashboardMappers";

const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const INK = "#0f172a";
const INK2 = "#334155";
const INK3 = "#64748b";
const INK4 = "#94a3b8";
const LINE = "#e2e8f0";
const PANEL_BG = "#f1f5f9";
const TABLE_HEAD_BG = "#f8fafc";
const GREEN = "#16a34a";

type Props = {
  opened: boolean;
  onClose: () => void;
  modeRow: ModeLegendRow | null;
  company: string;
  filters: EnquiryConversionPageFilters;
  /** Opens `ConversionByRepCustomerwiseEnquiryList` (needs `customer_code` + salesperson). */
  onOpenCustomerEnquiryList?: (payload: {
    customerCode: string;
    customerName: string;
    /** When present (e.g. from `top_gained`), used as POST `salesperson`. */
    salesperson?: string | null;
  }) => void;
  /** Opens the enquiry quote-detail drawer (`ConversionByRepCustomerwiseEnquiryDetails`) with a minimal drilldown payload. */
  onOpenEnquiryDetail?: (enquiry: EnquiryDrilldownEnquiry) => void;
};

function laneKey(e: EnquiryConversionTopEnquiryRow): string {
  const o = (e.origin_code ?? "").trim();
  const d = (e.destination_code ?? "").trim();
  if (!o && !d) return "—";
  return `${o}-${d}`;
}

const TOP_GAINED_INDEX = 0;
const TOP_GAINED_LIMIT = 5;

function badgeStyleForStageLabel(label: string): { bg: string; fg: string } {
  const s = label.trim().toLowerCase();
  if (s === "new" || s === "active")
    return { bg: enquiryConversionColors.status.new.bg, fg: enquiryConversionColors.status.new.dot };
  if (s === "quoted")
    return { bg: enquiryConversionColors.status.quoted.bg, fg: enquiryConversionColors.status.quoted.dot };
  if (s === "negotiation")
    return { bg: enquiryConversionColors.status.negotiation.bg, fg: enquiryConversionColors.status.negotiation.dot };
  if (s === "won")
    return { bg: enquiryConversionColors.status.won.bg, fg: enquiryConversionColors.status.won.dot };
  if (s === "lost")
    return { bg: enquiryConversionColors.status.lost.bg, fg: enquiryConversionColors.status.lost.dot };
  return { bg: "#F1F5F9", fg: "#64748B" };
}

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
    const cargo = Array.isArray(q.cargo_details)
      ? (q.cargo_details[0] as Record<string, unknown> | undefined)
      : undefined;
    return {
      quotation_id: String(q.quotation_id ?? ""),
      created_at: String(q.created_at ?? ""),
      quotation_services: [
        {
          total_sell: String(
            charges.reduce(
              (s, c) => s + Number(c.total_sell ?? 0),
              0
            ) || ""
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
          },
        },
      ],
    };
  });

  const firstQuote = quotationArr[0];
  const firstCargo = Array.isArray(firstQuote?.cargo_details)
    ? (firstQuote?.cargo_details?.[0] as Record<string, unknown> | undefined)
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
  };
}

export function ConversionByModeDetails({
  opened,
  onClose,
  modeRow,
  company,
  filters,
  onOpenCustomerEnquiryList,
  onOpenEnquiryDetail,
}: Props) {
  const fd = filters.fromDate;
  const td = filters.toDate;
  const modeCode = modeRow?.key?.trim();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "enquiryConversionModeDetails",
      company,
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
      modeCode ?? "",
      filters.type ?? "",
      filters.salesperson.trim(),
      TOP_GAINED_INDEX,
      TOP_GAINED_LIMIT,
    ],
    queryFn: () =>
      getEnquiryConversionDashboardData({
        company,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        // type: filters.type?.trim() || null,
        type: "GAINED",
        service: modeCode ?? null,
        salesperson: filters.salesperson.trim() || null,
        top_gained_pagination: {
          index: TOP_GAINED_INDEX,
          limit: TOP_GAINED_LIMIT,
        },
      }),
    enabled: opened && !!modeRow && !!company && !!fd && !!td && !!modeCode,
    staleTime: 20_000,
  });

  const busy = (isLoading || isFetching) && opened;

  const summary = data?.summary;
  const totalEnquiry = extractNumericValue(summary?.total_enquiry);
  const totalGain = extractNumericValue(summary?.total_gain ?? summary?.total_gained);
  const gainPctStr =
    typeof summary?.gain_percentage === "string"
      ? summary.gain_percentage.trim()
      : null;
  const winRateLabel =
    gainPctStr && gainPctStr.length > 0
      ? gainPctStr
      : totalEnquiry > 0
        ? `${((totalGain / totalEnquiry) * 100).toFixed(1)}%`
        : "—";

  const topEnquiries = useMemo(
    () => (Array.isArray(data?.top_enquiries) ? data!.top_enquiries! : []),
    [data]
  );

  const topLanes = useMemo(() => {
    const lanesRaw = Array.isArray(data?.top_gained_roted)
      ? data.top_gained_roted
      : [];
    const seen = new Set<string>();
    const lanes: string[] = [];
    for (const item of lanesRaw) {
      let lane = "";
      if (typeof item === "string") {
        lane = item.trim();
      } else if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        lane =
          String(
            row.roted ??
              row.route ??
              row.lane ??
              row.lane_key ??
              row.origin_destination ??
              ""
          ).trim();
        if (!lane) {
          const o = String(row.origin_code ?? row.origin ?? "").trim();
          const d = String(row.destination_code ?? row.destination ?? "").trim();
          lane = o || d ? `${o}-${d}` : "";
        }
      }
      if (!lane || seen.has(lane)) continue;
      seen.add(lane);
      lanes.push(lane);
    }
    return lanes;
  }, [data?.top_gained_roted]);

  const topCustomers = useMemo(() => {
    type Row = {
      name: string;
      enquiries: number;
      won: number;
      customerCode: string | null;
      /** From `top_gained` row when API sends it. */
      salesperson: string | null;
      valueLabel: string;
      sampleEnquiry: EnquiryConversionTopEnquiryRow | null;
    };
    const rows = Array.isArray(data?.top_gained) ? data.top_gained : [];
    return rows.map((item) => {
      const row = item as Record<string, unknown>;
      const name = String(
        row.customer_name ?? row.customer ?? row.customerName ?? row.name ?? "—"
      ).trim() || "—";
      const enquiriesRaw =
        (row.total_enquiry ?? row.enquiry_count ?? row.enquiry_count ?? row.count) as
          | string
          | number
          | null
          | undefined;
      const enquiries = extractNumericValue(
        enquiriesRaw
      );
      const wonRaw = (row.gained_count ?? row.won ?? row.total_gain ?? row.gain) as
        | string
        | number
        | null
        | undefined;
      const won = extractNumericValue(
        wonRaw
      );
      const customerCodeRaw = String(row.customer_code ?? "").trim();
      const customerCode = customerCodeRaw || null;
      const spRaw =
        row.sales_person ??
        row.salesperson ??
        row.sales_person_name ??
        row.rep ??
        row.account_owner;
      const salesperson =
        typeof spRaw === "string"
          ? spRaw.trim() || null
          : spRaw != null && String(spRaw).trim()
            ? String(spRaw).trim()
            : null;
      const valueRaw = (row.value ?? row.total_value ?? row.gained_value ?? row.won_value) as
        | string
        | number
        | null
        | undefined;
      const valueNum = extractNumericValue(valueRaw);
      const valueLabel =
        typeof valueRaw === "string" && valueRaw.trim().length > 0
          ? valueRaw.trim()
          : valueNum > 0
            ? `${valueNum.toLocaleString("en-IN", { maximumFractionDigits: 1 })} `
            : "—";
      const sampleEnquiry =
        topEnquiries.find(
          (e) =>
            (customerCode && e.customer_code?.trim() === customerCode) ||
            e.customer_name?.trim() === name
        ) ?? null;
      return {
        name,
        enquiries,
        won,
        customerCode,
        salesperson,
        valueLabel,
        sampleEnquiry,
      } satisfies Row;
    });
  }, [data?.top_gained, topEnquiries]);

  const titleName = modeRow?.label ?? "Mode";
  const pipelineValueLabel = modeRow?.valueLabel?.trim() || "—";
  const shareLabel = modeRow?.percentLabel?.trim() || "—";

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(920px, 92vw)"
      padding={0}
      offset={8}
      radius="md"
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
            borderBottom: `1px solid ${LINE}`,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            background: enquiryConversionColors.panelBg,
          }}
        >
          <Text fw={600} fz={14} c={INK} lh={1.2} style={{ letterSpacing: "-0.01em" }}>
            {titleName}
          </Text>
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
            {error ? (
              <Text fz={13} c="red">
                {(error as Error).message}
              </Text>
            ) : null}

            {busy ? (
              <Center py={48}>
                <Loader color="#101C2E" />
              </Center>
            ) : modeRow ? (
              <>
                <Box
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <Group gap={8} align="center" wrap="nowrap">
                    <Box
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: modeRow.color,
                        flexShrink: 0,
                      }}
                    />
                    <Text component="h2" m={0} fz={18} fw={600} c={INK} lh={1.2} style={{ letterSpacing: "-0.01em" }}>
                      {titleName}
                    </Text>
                  </Group>
                  <Text fz={12} fw={400} c={INK3} lh={1.45}>
                    {shareLabel} of pipeline · {pipelineValueLabel} · {totalEnquiry.toLocaleString("en-IN")} enquiries this period
                  </Text>
                </Box>

                <SimpleGrid cols={{ base: 1, sm: 4 }} spacing={10} mb={14} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                  {/* <MetricTile
                    label="Pipeline value"
                    primary={pipelineValueLabel}
                    secondary={`${shareLabel} share`}
                  /> */}
                  <MetricTile
                    label="Enquiries"
                    primary={totalEnquiry.toLocaleString("en-IN")}
                    secondary={
                      totalGain > 0 ? `${totalGain.toLocaleString("en-IN")} won` : undefined
                    }
                  />
                  <MetricTile label="Win rate" primary={winRateLabel} />
                  {/* <MetricTile label="Avg deal size" primary={avgDealLabel} /> */}
                </SimpleGrid>

                <Box
                  p={16}
                  mb={14}
                  style={{
                    background: enquiryConversionColors.panelBg,
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                  }}
                >
                  <Group gap={8} align="baseline" mb={12}>
                    <Text fw={600} fz={13} c={INK}>
                      Top lanes
                    </Text>
                    <Text fz={11} fw={400} c={INK4}>
                      By volume
                    </Text>
                  </Group>
                  {topLanes.length === 0 ? (
                    <Text fz={12} c={INK4}>
                      No lane data for this period.
                    </Text>
                  ) : (
                    <Flex gap={8} wrap="wrap">
                      {topLanes.map((lane) => (
                        <Box
                          key={lane}
                          px={10}
                          py={5}
                          style={{
                            background: PANEL_BG,
                            borderRadius: 4,
                            border: `1px solid ${LINE}`,
                          }}
                        >
                          <Text fz={11} fw={500} c={INK2} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                            {lane}
                          </Text>
                        </Box>
                      ))}
                    </Flex>
                  )}
                </Box>

                <Box>
                  <Text fw={700} fz={15} c="#0F172A">
                    Top customers — {titleName}
                  </Text>
                  <Text fz={12} fw={500} c="#94A3B8" mt={4}>
                    Click for enquiry list
                  </Text>
                </Box>

                <Box
                  style={{
                    background: enquiryConversionColors.panelBg,
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <Table horizontalSpacing={12} verticalSpacing={11} withRowBorders={false} highlightOnHover highlightOnHoverColor={TABLE_HEAD_BG}>
                    <Table.Thead>
                      <Table.Tr>
                        {(["Customer", "Enquiries", "Won", "Value", ""] as const).map(
                          (h, i) => (
                            <Table.Th
                              key={h}
                              fz={11}
                              fw={500}
                              c={INK3}
                              tt="uppercase"
                              ta={i === 0 ? "left" : "right"}
                              style={{
                                background: TABLE_HEAD_BG,
                                padding: "10px 12px",
                                borderBottom: `1px solid ${LINE}`,
                              }}
                            >
                              {h}
                            </Table.Th>
                          )
                        )}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {topCustomers.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Text fz={13} c={INK4} py={8}>
                              No customer rows for this mode.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        topCustomers.map((c) => {
                          const wr = c.enquiries > 0 ? (c.won / c.enquiries) * 100 : 0;
                          const wrStr =
                            Math.abs(wr - Math.round(wr)) < 0.05
                              ? `${Math.round(wr)}`
                              : wr.toFixed(1);
                          const resolvedSalesperson =
                            c.salesperson?.trim() ||
                            filters.salesperson?.trim() ||
                            "";
                          const openTopCustomerRow = () => {
                            const cc =
                              c.customerCode ??
                              c.sampleEnquiry?.customer_code?.trim() ??
                              "";
                            if (onOpenCustomerEnquiryList && cc) {
                              onOpenCustomerEnquiryList({
                                customerCode: cc,
                                customerName: c.name,
                                salesperson: resolvedSalesperson,
                              });
                              return;
                            }
                            if (onOpenEnquiryDetail && c.sampleEnquiry) {
                              onOpenEnquiryDetail(
                                buildDrilldownFromTopEnquiryRow(c.sampleEnquiry)
                              );
                            }
                          };
                          const topCustomerInteractive =
                            (onOpenCustomerEnquiryList &&
                              !!(c.customerCode ?? c.sampleEnquiry?.customer_code?.trim())) ||
                            (onOpenEnquiryDetail && !!c.sampleEnquiry);
                          return (
                            <Table.Tr
                              key={c.name}
                              onClick={topCustomerInteractive ? openTopCustomerRow : undefined}
                              onKeyDown={
                                topCustomerInteractive
                                  ? (ev) => {
                                      if (ev.key === "Enter" || ev.key === " ") {
                                        ev.preventDefault();
                                        openTopCustomerRow();
                                      }
                                    }
                                  : undefined
                              }
                              tabIndex={topCustomerInteractive ? 0 : undefined}
                              role={topCustomerInteractive ? "button" : undefined}
                              style={{
                                cursor: topCustomerInteractive ? "pointer" : "default",
                              }}
                            >
                              <Table.Td style={{ verticalAlign: "middle", borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={12} fw={600} c={INK}>
                                  {c.name}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right" style={{ borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={12} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {c.enquiries.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right" style={{ borderBottom: `1px solid ${LINE}` }}>
                                <Text
                                  fz={12}
                                  fw={600}
                                  c={c.won > 0 ? GREEN : "#0F172A"}
                                  style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                  {c.won.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right" style={{ borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={12} fw={600} c={INK}>
                                  {c.valueLabel}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right" style={{ borderBottom: `1px solid ${LINE}`, width: 32 }}>
                                <Text fz={14} c={INK4}>→</Text>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>

                <Box mb={14} style={{ marginTop: 16 }}>
                  <Text fw={700} fz={15} c="#0F172A">
                    Active enquiries — {titleName}
                  </Text>
                  <Text fz={12} fw={500} c="#94A3B8" mt={4}>
                    Click for full quote detail
                  </Text>
                </Box>

                <Box
                  style={{
                    background: enquiryConversionColors.panelBg,
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <Table horizontalSpacing={12} verticalSpacing={11} withRowBorders={false} highlightOnHover highlightOnHoverColor={TABLE_HEAD_BG}>
                    <Table.Thead>
                      <Table.Tr>
                        {(
                          [
                            "Customer / Enquiry",
                            "Lane",
                            "Stage",
                            // "Probll",
                            // "Value",
                            "",
                          ] as const
                        ).map((h, i) => (
                          <Table.Th
                            key={h}
                            fz={11}
                            fw={500}
                            c={INK3}
                            tt="uppercase"
                            ta={i >= 3 ? "right" : "left"}
                            style={{
                              background: TABLE_HEAD_BG,
                              padding: "10px 12px",
                              borderBottom: `1px solid ${LINE}`,
                            }}
                          >
                            {h}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {topEnquiries.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Text fz={13} c={INK4} py={8}>
                              No active enquiries for this mode.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        topEnquiries.map((e) => {
                          const stage = stageLabelFromApiStatus(e.status ?? "");
                          const { bg, fg } = badgeStyleForStageLabel(stage.label);
                          const openActiveDetail = () => {
                            if (!onOpenEnquiryDetail) return;
                            const drill = buildDrilldownFromTopEnquiryRow(e) as
                              EnquiryDrilldownEnquiry & {
                                __filterDateFrom?: string;
                                __filterDateTo?: string;
                              };
                            drill.__filterDateFrom = dayjs(fd!).format("YYYY-MM-DD");
                            drill.__filterDateTo = dayjs(td!).format("YYYY-MM-DD");
                            onOpenEnquiryDetail(drill);
                          };
                          return (
                            <Table.Tr
                              key={`${e.enquiry_id}-${e.sno}`}
                              onClick={onOpenEnquiryDetail ? openActiveDetail : undefined}
                              onKeyDown={
                                onOpenEnquiryDetail
                                  ? (ev) => {
                                      if (ev.key === "Enter" || ev.key === " ") {
                                        ev.preventDefault();
                                        openActiveDetail();
                                      }
                                    }
                                  : undefined
                              }
                              tabIndex={onOpenEnquiryDetail ? 0 : undefined}
                              role={onOpenEnquiryDetail ? "button" : undefined}
                              style={{ cursor: onOpenEnquiryDetail ? "pointer" : undefined }}
                            >
                              <Table.Td style={{ verticalAlign: "middle", maxWidth: 220, borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={12} fw={600} c={INK} lineClamp={2}>
                                  {e.customer_name ?? "—"}
                                </Text>
                                <Text fz={10.5} fw={400} c={INK4} mt={1}>
                                  {e.enquiry_id}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ whiteSpace: "nowrap", borderBottom: `1px solid ${LINE}` }}>
                                <Text fz={11} c={INK2} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                                  {laneKey(e)}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ verticalAlign: "middle", borderBottom: `1px solid ${LINE}` }}>
                                <Badge
                                  size="sm"
                                  variant="light"
                                  styles={{
                                    root: {
                                      background: bg,
                                      color: fg,
                                      fontWeight: 500,
                                      textTransform: "none",
                                      borderRadius: 4,
                                    },
                                  }}
                                >
                                  {stage.label}
                                </Badge>
                              </Table.Td>
                              <Table.Td ta="right" style={{ borderBottom: `1px solid ${LINE}`, width: 32 }}>
                                <Text fz={14} c={INK4}>→</Text>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </>
            ) : null}
          </Stack>
        </ScrollArea>
      </Box>
    </Drawer>
  );
}

function MetricTile({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <Box
      p="10px 12px"
      style={{
        background: enquiryConversionColors.panelBg,
        border: `1px solid ${LINE}`,
        borderRadius: 8,
      }}
    >
      <Text fz={10} fw={500} c={INK3} tt="uppercase" lts="0.04em">
        {label}
      </Text>
      <Text fz={18} fw={600} c={INK} lh={1.15} mt={2} style={{ letterSpacing: "-0.01em" }}>
        {primary}
      </Text>
      {secondary ? (
        <Text fz={10} fw={400} c={INK4} mt={1}>
          {secondary}
        </Text>
      ) : null}
    </Box>
  );
}
