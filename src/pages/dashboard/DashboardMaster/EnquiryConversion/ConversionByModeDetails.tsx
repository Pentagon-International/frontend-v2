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

const FONT = "'Geist', sans-serif";
const GREEN = "#16A34A";

type Props = {
  opened: boolean;
  onClose: () => void;
  modeRow: ModeLegendRow | null;
  company: string;
  filters: EnquiryConversionPageFilters;
  /** Opens `ConversionByRepCustomerwiseEnquiryList` (needs `customer_code` on sample enquiry + salesperson filter). */
  onOpenCustomerEnquiryList?: (payload: {
    customerCode: string;
    customerName: string;
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

function isWonStatus(status: string): boolean {
  const u = status.toUpperCase();
  return u.includes("GAIN") || u.includes("WON");
}

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
    ],
    queryFn: () =>
      getEnquiryConversionDashboardData({
        company,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        type: filters.type?.trim() || null,
        service: modeCode ?? null,
        salesperson: filters.salesperson.trim() || null,
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
    const counts = new Map<string, number>();
    for (const e of topEnquiries) {
      const k = laneKey(e);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([lane]) => lane);
  }, [topEnquiries]);

  const topCustomers = useMemo(() => {
    type Acc = {
      name: string;
      enquiries: number;
      won: number;
      /** First enquiry seen for this customer — used to open the details drawer. */
      sampleEnquiry: EnquiryConversionTopEnquiryRow | null;
    };
    const byName = new Map<string, Acc>();
    for (const e of topEnquiries) {
      const name = e.customer_name?.trim() || "—";
      const cur =
        byName.get(name) ??
        ({
          name,
          enquiries: 0,
          won: 0,
          sampleEnquiry: null,
        } as Acc);
      if (!cur.sampleEnquiry) cur.sampleEnquiry = e;
      cur.enquiries += 1;
      if (isWonStatus(e.status ?? "")) cur.won += 1;
      byName.set(name, cur);
    }
    return [...byName.values()]
      .sort((a, b) => b.enquiries - a.enquiries)
      .slice(0, 12);
  }, [topEnquiries]);

  const titleName = modeRow?.label ?? "Mode";

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="max(520px, 75vw)"
      padding={0}
      offset={8}
      radius="md"
      withOverlay
      overlayProps={{ opacity: 0.35, blur: 2 }}
      styles={{
        header: { display: "none" },
        body: { padding: 0, height: "100%" },
        content: {
          fontFamily: FONT,
          borderLeft: "1px solid #E2E8F0",
          boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.08)",
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
          py={16}
          style={{
            borderBottom: "1px solid #EEF2F7",
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text fw={700} fz={22} c="#0F172A" lh={1.2}>
            {titleName}
          </Text>
          <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close" mt={2}>
            <IconX size={20} stroke={2} />
          </ActionIcon>
        </Box>

        <ScrollArea type="scroll" scrollbarSize={8} style={{ flex: 1, minHeight: 0 }}>
          <Stack gap="lg" p={20} pb={36}>
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
                <Box>
                  <Group gap={10} align="flex-start" wrap="nowrap">
                    <Box
                      mt={3}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: modeRow.color,
                        flexShrink: 0,
                      }}
                    />
                    <Box style={{ minWidth: 0 }}>
                      <Text fw={700} fz={15} c="#1E3A8A" lh={1.35}>
                        {titleName}
                      </Text>
                      <Text fz={12} fw={500} c="#64748B" mt={6} lh={1.45}>
                        {modeRow.percentLabel} of pipeline · — ·{" "}
                        {totalEnquiry.toLocaleString("en-IN")} enquiries this period
                      </Text>
                    </Box>
                  </Group>
                </Box>

                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing={12}>
                  <MetricTile
                    label="Pipeline value"
                    primary="—"
                    secondary={`${modeRow.percentLabel} share`}
                  />
                  <MetricTile
                    label="Enquiries"
                    primary={totalEnquiry.toLocaleString("en-IN")}
                    secondary={
                      totalGain > 0 ? `${totalGain.toLocaleString("en-IN")} won` : undefined
                    }
                  />
                  <MetricTile label="Win rate" primary={winRateLabel} />
                  <MetricTile label="Avg deal size" primary="—" />
                </SimpleGrid>

                <Box>
                  <Group gap={8} align="baseline" mb={10}>
                    <Text fw={700} fz={14} c="#0F172A">
                      Top lanes
                    </Text>
                    <Text fz={12} fw={500} c="#94A3B8">
                      By volume
                    </Text>
                  </Group>
                  {topLanes.length === 0 ? (
                    <Text fz={12} c="#94A3B8">
                      No lane data for this period.
                    </Text>
                  ) : (
                    <Flex gap={8} wrap="wrap">
                      {topLanes.map((lane) => (
                        <Box
                          key={lane}
                          px={10}
                          py={6}
                          style={{
                            background: "#F1F5F9",
                            borderRadius: 6,
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          <Text fz={12} fw={600} c="#0F172A">
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
                    border: `1px solid ${enquiryConversionColors.panelBorder}`,
                    borderRadius: enquiryConversionColors.radius,
                    boxShadow: enquiryConversionColors.shadow,
                    overflow: "hidden",
                  }}
                >
                  <Table horizontalSpacing="md" verticalSpacing={12}>
                    <Table.Thead>
                      <Table.Tr style={{ background: "#F8FAFC" }}>
                        {(["Customer", "Enquiries", "Won", "Win rate", "Value"] as const).map(
                          (h, i) => (
                            <Table.Th
                              key={h}
                              fz={10}
                              fw={700}
                              c="#94A3B8"
                              tt="uppercase"
                              ta={i === 0 ? "left" : "right"}
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
                          <Table.Td colSpan={5}>
                            <Text fz={13} c="#94A3B8" py={8}>
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
                          const openTopCustomerRow = () => {
                            if (!c.sampleEnquiry) return;
                            const sp = filters.salesperson?.trim();
                            const cc = c.sampleEnquiry.customer_code?.trim();
                            if (onOpenCustomerEnquiryList && cc && sp) {
                              onOpenCustomerEnquiryList({
                                customerCode: cc,
                                customerName: c.name,
                              });
                              return;
                            }
                            if (onOpenEnquiryDetail) {
                              onOpenEnquiryDetail(
                                buildDrilldownFromTopEnquiryRow(c.sampleEnquiry)
                              );
                            }
                          };
                          const topCustomerInteractive =
                            !!c.sampleEnquiry &&
                            (onOpenCustomerEnquiryList || onOpenEnquiryDetail);
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
                              <Table.Td style={{ verticalAlign: "top" }}>
                                <Text fz={13} fw={700} c="#0F172A">
                                  {c.name}
                                </Text>
                                <Text fz={11} fw={500} c="#94A3B8" mt={2}>
                                  —
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {c.enquiries.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text
                                  fz={13}
                                  fw={700}
                                  c={c.won > 0 ? GREEN : "#0F172A"}
                                  style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                  {c.won.toLocaleString("en-IN")}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} fw={700} c={GREEN} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  {wrStr}%
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} c="#64748B">
                                  —
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>

                <Box>
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
                    border: `1px solid ${enquiryConversionColors.panelBorder}`,
                    borderRadius: enquiryConversionColors.radius,
                    boxShadow: enquiryConversionColors.shadow,
                    overflow: "hidden",
                  }}
                >
                  <Table horizontalSpacing="md" verticalSpacing={12}>
                    <Table.Thead>
                      <Table.Tr style={{ background: "#F8FAFC" }}>
                        {(
                          [
                            "Customer / Enquiry",
                            "Lane",
                            "Stage",
                            "Prob",
                            "Value",
                          ] as const
                        ).map((h, i) => (
                          <Table.Th
                            key={h}
                            fz={10}
                            fw={700}
                            c="#94A3B8"
                            tt="uppercase"
                            ta={i >= 3 ? "right" : "left"}
                          >
                            {h}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {topEnquiries.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={5}>
                            <Text fz={13} c="#94A3B8" py={8}>
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
                            onOpenEnquiryDetail(buildDrilldownFromTopEnquiryRow(e));
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
                              <Table.Td style={{ verticalAlign: "top", maxWidth: 220 }}>
                                <Text fz={13} fw={700} c="#0F172A" lineClamp={2}>
                                  {e.customer_name ?? "—"}
                                </Text>
                                <Text fz={11} fw={500} c="#94A3B8" mt={4}>
                                  {e.enquiry_id}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ whiteSpace: "nowrap" }}>
                                <Text fz={13} c="#0F172A">
                                  {laneKey(e)}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ verticalAlign: "middle" }}>
                                <Badge
                                  size="sm"
                                  variant="light"
                                  styles={{
                                    root: {
                                      background: bg,
                                      color: fg,
                                      fontWeight: 600,
                                      textTransform: "none",
                                    },
                                  }}
                                >
                                  {stage.label}
                                </Badge>
                              </Table.Td>
                              <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                                <Text fz={13} c="#64748B">
                                  —
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                                <Text fz={13} c="#64748B">
                                  —
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
      p={14}
      style={{
        background: enquiryConversionColors.panelBg,
        border: `1px solid ${enquiryConversionColors.panelBorder}`,
        borderRadius: enquiryConversionColors.radius,
        boxShadow: enquiryConversionColors.shadow,
        minHeight: 96,
      }}
    >
      <Text fz={9} fw={700} c="#8FA2B7" tt="uppercase" lts="0.04em" mb={10}>
        {label}
      </Text>
      <Text fz={22} fw={700} c="#0B1F3A" lh={1.15}>
        {primary}
      </Text>
      {secondary ? (
        <Text fz={11} fw={500} c="#94A3B8" mt={6}>
          {secondary}
        </Text>
      ) : null}
    </Box>
  );
}
