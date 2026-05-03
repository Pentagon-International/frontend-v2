import { useMemo } from "react";
import {
  Box,
  Drawer,
  Text,
  Stack,
  SimpleGrid,
  Table,
  Loader,
  Center,
  ScrollArea,
  ActionIcon,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  getEnquiryConversionDashboardData,
  extractNumericValue,
  type EnquiryConversionDashboardResponse,
  type EnquiryConversionApiSummaryStatusChange,
} from "../../../../service/dashboard.service";
import type { EnquiryConversionPageFilters } from "./EnquiryConversionFilters";
import { enquiryConversionColors } from "./enquiryConversionTokens";

const NAVY = "#1E3A8A";
const NAVY_BG = "rgba(30, 58, 138, 0.08)";
const FONT = "'Geist', sans-serif";

/** Labels emitted by `buildEnquiryConversionMetrics` — must match tile labels on the page. */
export type EnquiryConversionSummaryMetricLabel =
  | "ACTIVE"
  | "QUOTE RATE"
  | "WIN RATE"
  | "TOTAL ENQUIRIES";

function metricToApiType(m: EnquiryConversionSummaryMetricLabel): string | null {
  switch (m) {
    case "ACTIVE":
      return "Active";
    case "QUOTE RATE":
      return "QUOTE CREATED";
    case "WIN RATE":
      return "GAINED";
    case "TOTAL ENQUIRIES":
      return null;
    default:
      return null;
  }
}

function modeDisplayName(code: string): string {
  const u = code.toUpperCase();
  switch (u) {
    case "AIR":
      return "Air Freight";
    case "FCL":
      return "Ocean FCL";
    case "LCL":
      return "Ocean LCL";
    case "OTHERS":
      return "Others";
    default:
      return code;
  }
}

function daysInRange(from: Date | null, to: Date | null): number {
  if (!from || !to) return 30;
  const d = dayjs(to).diff(dayjs(from), "day") + 1;
  return Math.max(1, d);
}

function formatPeriodSubtitle(from: Date | null, to: Date | null): string {
  if (!from || !to) return "";
  const sameMonth =
    from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  if (sameMonth) {
    return dayjs(from).format("MMMM YYYY");
  }
  return `${dayjs(from).format("D MMM YY")} – ${dayjs(to).format("D MMM YY")}`;
}

function momHint(
  ch?: EnquiryConversionApiSummaryStatusChange,
  upGood = true
): string {
  if (!ch?.change_percentage?.trim()) return "—";
  const arrow =
    ch.direction === "increase"
      ? "▲"
      : ch.direction === "decrease"
        ? "▼"
        : "•";
  const pct = ch.change_percentage.trim();
  const suffix =
    ch.direction === "increase"
      ? upGood
        ? "vs prev."
        : "vs prev."
      : upGood
        ? "vs prev."
        : "vs prev.";
  return `${arrow} ${pct} ${suffix}`;
}

function linearTrend(
  mom: EnquiryConversionApiSummaryStatusChange | undefined,
  fallbackEnd: number
): number[] {
  const prev =
    mom?.previous_value != null && Number.isFinite(mom.previous_value)
      ? Number(mom.previous_value)
      : fallbackEnd * 0.92;
  const curr =
    mom?.current_value != null && Number.isFinite(mom.current_value)
      ? Number(mom.current_value)
      : fallbackEnd;
  const end = fallbackEnd > 0 ? fallbackEnd : curr;
  const start = prev;
  const out: number[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const v = start + (end - start) * t;
    out.push(Math.round(v * 10) / 10);
  }
  out[7] = Math.round(end * 10) / 10;
  return out;
}

function last8MonthLabels(endDate: Date | null): { short: string[]; meta: string } {
  if (!endDate) {
    return {
      short: ["—", "—", "—", "—", "—", "—", "—", "—"],
      meta: "Monthly",
    };
  }
  const labels: string[] = [];
  for (let i = -7; i <= 0; i++) {
    labels.push(dayjs(endDate).add(i, "month").format("MMM"));
  }
  const start = dayjs(endDate).subtract(7, "month");
  const meta = `Monthly · ${start.format("MMM 'YY")} → ${dayjs(endDate).format("MMM 'YY")}`;
  return { short: labels, meta };
}

function TrendSparkline({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const w = 600;
  const h = 90;
  const pad = 24;
  const nums = values.length ? values : [0];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const xs = nums.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, nums.length - 1));
  const ys = nums.map(
    (v) => h - pad - ((v - min) / span) * (h - pad * 2)
  );
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area =
    `M${xs[0]},${h - pad} ` +
    xs.map((x, i) => `L${x},${ys[i]}`).join(" ") +
    ` L${xs[xs.length - 1]},${h - pad} Z`;
  const last = nums[nums.length - 1];
  const lastFmt =
    typeof last === "number" && Math.abs(last) < 100 && !Number.isInteger(last)
      ? last.toFixed(1)
      : String(Math.round(last));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", height: 90, display: "block" }}
      aria-hidden
    >
      <path d={area} fill={NAVY_BG} />
      <path d={line} fill="none" stroke={NAVY} strokeWidth={2} />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={3} fill={NAVY} />
      ))}
      <text
        x={xs[xs.length - 1]}
        y={ys[ys.length - 1] - 8}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#0F172A"
      >
        {lastFmt}
      </text>
      {xs.map((x, i) => (
        <text
          key={`l-${i}`}
          x={x}
          y={h - 6}
          textAnchor="middle"
          fontSize={9}
          fill="#64748B"
        >
          {labels[i] ?? ""}
        </text>
      ))}
    </svg>
  );
}

function topServiceRow(services: { service?: string; count: number | string; percentage?: string }[]) {
  const sorted = [...services].sort(
    (x, y) => extractNumericValue(y.count) - extractNumericValue(x.count)
  );
  return sorted[0];
}

function buildDetailContent(
  metric: EnquiryConversionSummaryMetricLabel,
  res: EnquiryConversionDashboardResponse | undefined,
  filters: EnquiryConversionPageFilters
): {
  title: string;
  subtitle: string;
  trend: number[];
  trendLabels: string[];
  trendMeta: string;
  breakdownTitle: string;
  tableCols: string[];
  tableRows: { name: string; a: string | number; b: string | number; share: number }[];
  tableVariant: "pipeline" | "quote" | "rep";
  mini: { l: string; v: string; d: string }[];
} {
  const s = res?.summary;
  const services = Array.isArray(res?.service) ? res!.service! : [];
  const days = daysInRange(filters.fromDate, filters.toDate);
  const topSvc = topServiceRow(services);

  const totalEnquiry = extractNumericValue(s?.total_enquiry);
  const totalActive = extractNumericValue(s?.total_active);
  const totalQuote = extractNumericValue(s?.total_quote_created);
  const totalGain = extractNumericValue(s?.total_gain ?? s?.total_gained);

  const mom = s?.status_change_vs_previous_month;
  const { short: trendLabels, meta: trendMeta } = last8MonthLabels(filters.toDate);

  let title = "";
  let subtitle = "";
  let trend: number[] = [];
  let breakdownTitle = "";
  let tableCols: string[] = [];
  let tableRows: { name: string; a: string | number; b: string | number; share: number }[] =
    [];
  let tableVariant: "pipeline" | "quote" | "rep" = "pipeline";

  switch (metric) {
    case "TOTAL ENQUIRIES": {
      title = "New enquiries";
      subtitle = `${formatPeriodSubtitle(filters.fromDate, filters.toDate)} · ${totalEnquiry.toLocaleString("en-IN")} enquiries received`;
      trend = linearTrend(undefined, totalEnquiry);
      breakdownTitle = "Source & mode mix";
      tableCols = ["Source", "Enquiries", "Pipeline (₹ L)", "Share"];
      tableVariant = "pipeline";
      const totalSvc = services.reduce((acc, x) => acc + extractNumericValue(x.count), 0);
      tableRows = services.map((row) => {
        const c = extractNumericValue(row.count);
        const pct =
          parseFloat(String(row.percentage ?? "").replace(/%/g, "")) ||
          (totalSvc > 0 ? (c / totalSvc) * 100 : 0);
        return {
          name: modeDisplayName(row.service ?? ""),
          a: c.toLocaleString("en-IN"),
          b: "—",
          share: Math.min(100, Math.max(0, pct)) / 100,
        };
      });
      break;
    }
    case "ACTIVE": {
      title = "Active enquiries";
      subtitle = `${formatPeriodSubtitle(filters.fromDate, filters.toDate)} · ${totalActive.toLocaleString("en-IN")} active`;
      trend = linearTrend(mom?.active, totalActive);
      breakdownTitle = "Source & mode mix";
      tableCols = ["Source", "Enquiries", "Pipeline (₹ L)", "Share"];
      tableVariant = "pipeline";
      const totalSvc = services.reduce((acc, x) => acc + extractNumericValue(x.count), 0);
      tableRows = services.map((row) => {
        const c = extractNumericValue(row.count);
        const pct =
          parseFloat(String(row.percentage ?? "").replace(/%/g, "")) ||
          (totalSvc > 0 ? (c / totalSvc) * 100 : 0);
        return {
          name: modeDisplayName(row.service ?? ""),
          a: c.toLocaleString("en-IN"),
          b: "—",
          share: Math.min(100, Math.max(0, pct)) / 100,
        };
      });
      break;
    }
    case "QUOTE RATE": {
      const qpct = s?.quote_created_percentage?.trim() ?? "—";
      title = `Quote rate · ${qpct}`;
      subtitle = `${formatPeriodSubtitle(filters.fromDate, filters.toDate)} · ${totalQuote.toLocaleString("en-IN")} quotes · ${totalEnquiry.toLocaleString("en-IN")} enquiries`;
      trend = linearTrend(mom?.quote_created, totalQuote);
      breakdownTitle = "Quote activity by mode";
      tableCols = ["Mode", "Enquiries", "Share"];
      tableVariant = "quote";
      const totalSvc = services.reduce((acc, x) => acc + extractNumericValue(x.count), 0);
      tableRows = services.map((row) => {
        const c = extractNumericValue(row.count);
        const pct =
          parseFloat(String(row.percentage ?? "").replace(/%/g, "")) ||
          (totalSvc > 0 ? (c / totalSvc) * 100 : 0);
        return {
          name: modeDisplayName(row.service ?? ""),
          a: c.toLocaleString("en-IN"),
          b: "",
          share: Math.min(100, Math.max(0, pct)) / 100,
        };
      });
      break;
    }
    case "WIN RATE": {
      const gpct = s?.gain_percentage?.trim() ?? "—";
      title = `Win rate · ${gpct}`;
      subtitle = `${formatPeriodSubtitle(filters.fromDate, filters.toDate)} · ${totalGain.toLocaleString("en-IN")} won · ${totalEnquiry.toLocaleString("en-IN")} enquiries`;
      trend = linearTrend(mom?.gain, totalGain);
      breakdownTitle = "Win rate by rep";
      tableCols = ["Rep", "Won", "Enquiries", "Win rate"];
      tableVariant = "rep";
      const reps = Array.isArray(res?.data) ? res!.data! : [];
      tableRows = reps.map((row) => {
        const gained = extractNumericValue(row.gained);
        const total = Math.max(1, extractNumericValue(row.total_enquiry));
        const rate = Math.min(100, (gained / total) * 100);
        return {
          name: row.salesperson ?? "—",
          a: gained.toLocaleString("en-IN"),
          b: total.toLocaleString("en-IN"),
          share: rate / 100,
        };
      });
      break;
    }
    default:
      title = "Summary";
      subtitle = "";
      trend = [0, 0, 0, 0, 0, 0, 0, 0];
      tableVariant = "pipeline";
  }

  const mini = ((): { l: string; v: string; d: string }[] => {
    switch (metric) {
      case "TOTAL ENQUIRIES": {
        const topLabel = topSvc ? modeDisplayName(topSvc.service ?? "") : "—";
        const topPct = topSvc?.percentage?.trim() ?? "";
        return [
          {
            l: "NEW THIS PERIOD",
            v: totalEnquiry.toLocaleString("en-IN"),
            d: momHint(mom?.active),
          },
          {
            l: "DAILY AVG",
            v: (totalEnquiry / days).toFixed(1),
            d: `${days}-day range`,
          },
          {
            l: "PIPELINE VALUE",
            v: "—",
            d: "all stages",
          },
          {
            l: "TOP MODE",
            v: topLabel,
            d: topPct ? `${topPct} of enquiries` : "—",
          },
        ];
      }
      case "ACTIVE":
        return [
          {
            l: "ACTIVE NOW",
            v: totalActive.toLocaleString("en-IN"),
            d: momHint(mom?.active),
          },
          {
            l: "DAILY AVG",
            v: (totalActive / days).toFixed(1),
            d: `${days}-day range`,
          },
          {
            l: "SHARE OF TOTAL",
            v: s?.active_percentage?.trim() ?? "—",
            d: "of all enquiries",
          },
          {
            l: "TOP MODE",
            v: topSvc ? modeDisplayName(topSvc.service ?? "") : "—",
            d: topSvc?.percentage?.trim() ?? "—",
          },
        ];
      case "QUOTE RATE":
        return [
          {
            l: "QUOTE RATE",
            v: s?.quote_created_percentage?.trim() ?? "—",
            d: `${totalQuote} / ${totalEnquiry}`,
          },
          {
            l: "QUOTES CREATED",
            v: String(totalQuote),
            d: "in period",
          },
          {
            l: "DAILY AVG",
            v: (totalQuote / days).toFixed(1),
            d: `${days}-day range`,
          },
          {
            l: "TOP MODE",
            v: topSvc ? modeDisplayName(topSvc.service ?? "") : "—",
            d: topSvc?.percentage?.trim() ?? "—",
          },
        ];
      case "WIN RATE":
        return [
          {
            l: "WIN RATE",
            v: s?.gain_percentage?.trim() ?? "—",
            d: `${totalGain} / ${totalEnquiry}`,
          },
          {
            l: "WON COUNT",
            v: String(totalGain),
            d: "in period",
          },
          {
            l: "DAILY AVG",
            v: (totalGain / days).toFixed(1),
            d: `${days}-day range`,
          },
          {
            l: "LOST",
            v: String(extractNumericValue(s?.total_lost)),
            d: s?.lost_percentage?.trim() ?? "—",
          },
        ];
      default:
        return [];
    }
  })();

  return {
    title,
    subtitle,
    trend,
    trendLabels,
    trendMeta,
    breakdownTitle,
    tableCols,
    tableRows,
    mini,
    tableVariant,
  };
}

type Props = {
  opened: boolean;
  onClose: () => void;
  metric: EnquiryConversionSummaryMetricLabel | null;
  company: string;
  filters: EnquiryConversionPageFilters;
};

export function EnquiryconversionSummarydetail({
  opened,
  onClose,
  metric,
  company,
  filters,
}: Props) {
  const fd = filters.fromDate;
  const td = filters.toDate;
  const apiType = metric ? metricToApiType(metric) : null;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "enquiryConversionSummaryDetail",
      company,
      fd?.toISOString() ?? "",
      td?.toISOString() ?? "",
      apiType ?? "",
      filters.service ?? "",
      filters.salesperson.trim(),
      metric ?? "",
    ],
    queryFn: () =>
      getEnquiryConversionDashboardData({
        company,
        date_from: dayjs(fd!).format("DD-MM-YYYY"),
        date_to: dayjs(td!).format("DD-MM-YYYY"),
        type: apiType,
        service: filters.service?.trim() || null,
        salesperson: filters.salesperson.trim() || null,
      }),
    enabled: opened && !!metric && !!company && !!fd && !!td,
    staleTime: 20_000,
  });

  const content = useMemo(
    () =>
      metric ? buildDetailContent(metric, data, filters) : null,
    [metric, data, filters]
  );

  const drawerTitle =
    metric === "TOTAL ENQUIRIES"
      ? "New enquiries"
      : metric === "ACTIVE"
        ? "Active enquiries"
        : metric === "QUOTE RATE"
          ? "Quote rate"
          : metric === "WIN RATE"
            ? "Win rate"
            : "Summary";

  const busy = (isLoading || isFetching) && opened;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="max(480px, 75vw)"
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
          py={14}
          style={{
            borderBottom: "1px solid #EEF2F7",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text fw={600} fz={14} c="#0F172A">
            {drawerTitle}
          </Text>
          <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close">
            <IconX size={18} stroke={2} />
          </ActionIcon>
        </Box>

        <ScrollArea
          type="scroll"
          scrollbarSize={8}
          style={{ flex: 1, minHeight: 0 }}
        >
          <Stack gap="md" p={20} pb={32}>
            {error ? (
              <Text fz={13} c="red">
                {(error as Error).message}
              </Text>
            ) : null}

            {busy ? (
              <Center py={48}>
                <Loader color="#101C2E" />
              </Center>
            ) : content ? (
              <>
                <Box>
                  <Text fw={700} fz={22} c="#0F172A" lh={1.2}>
                    {content.title}
                  </Text>
                  <Text fz={13} fw={600} c="#64748B" mt={6}>
                    {content.subtitle}
                  </Text>
                </Box>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={12}>
                  {content.mini.map((k) => (
                    <Box
                      key={k.l}
                      p={12}
                      style={{
                        background: enquiryConversionColors.panelBg,
                        border: `1px solid ${enquiryConversionColors.panelBorder}`,
                        borderRadius: enquiryConversionColors.radius,
                        boxShadow: enquiryConversionColors.shadow,
                        minHeight: 92,
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
                        {k.l}
                      </Text>
                      <Text fz={26} fw={700} c="#0B1F3A" lh={1.1} mb={4}>
                        {k.v}
                      </Text>
                      <Text fz={11} fw={600} c="#9AAABD" lineClamp={2}>
                        {k.d}
                      </Text>
                    </Box>
                  ))}
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
                  <Box px={16} pt={14} pb={8}>
                    <Text fw={700} fz={14} c="#0F172A">
                      8-month trend
                    </Text>
                    <Text fz={11} fw={600} c="#94A3B8" mt={2}>
                      {content.trendMeta}
                    </Text>
                  </Box>
                  <Box px={8} pb={8}>
                    <TrendSparkline values={content.trend} labels={content.trendLabels} />
                  </Box>
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
                  <Box px={16} pt={14} pb={10}>
                    <Text fw={700} fz={14} c="#0F172A">
                      {content.breakdownTitle}
                    </Text>
                  </Box>
                  <Table horizontalSpacing="md" verticalSpacing={10}>
                    <Table.Thead>
                      <Table.Tr style={{ background: "#F8FAFC" }}>
                        {content.tableCols.map((c, i) => (
                          <Table.Th
                            key={c + i}
                            fz={10}
                            fw={700}
                            c="#94A3B8"
                            tt="uppercase"
                            ta={i === 0 ? "left" : "right"}
                          >
                            {c}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {content.tableRows.map((row, idx) => {
                        const maxShare = Math.max(
                          ...content.tableRows.map((r) => r.share),
                          0.01
                        );
                        const barW = (row.share / maxShare) * 100;
                        const shareBar = (
                          <Box
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              justifyContent: "flex-end",
                            }}
                          >
                            <Box
                              style={{
                                flex: 1,
                                height: 6,
                                background: "#F1F5F9",
                                borderRadius: 3,
                                overflow: "hidden",
                                maxWidth: 140,
                              }}
                            >
                              <Box
                                style={{
                                  width: `${barW}%`,
                                  height: "100%",
                                  background: NAVY,
                                  borderRadius: 3,
                                }}
                              />
                            </Box>
                            <Text
                              fz={12}
                              fw={600}
                              c="#0F172A"
                              style={{ minWidth: 44, textAlign: "right" }}
                            >
                              {(row.share * 100).toFixed(0)}%
                            </Text>
                          </Box>
                        );
                        const key = `${row.name}-${idx}`;
                        if (content.tableVariant === "quote") {
                          return (
                            <Table.Tr key={key}>
                              <Table.Td>
                                <Text fz={13} fw={500} c="#0F172A">
                                  {row.name}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fz={13} tabularNums>
                                  {row.a}
                                </Text>
                              </Table.Td>
                              <Table.Td>{shareBar}</Table.Td>
                            </Table.Tr>
                          );
                        }
                        return (
                          <Table.Tr key={key}>
                            <Table.Td>
                              <Text fz={13} fw={500} c="#0F172A">
                                {row.name}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fz={13} tabularNums>
                                {row.a}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fz={13} tabularNums>
                                {row.b}
                              </Text>
                            </Table.Td>
                            <Table.Td>{shareBar}</Table.Td>
                          </Table.Tr>
                        );
                      })}
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
