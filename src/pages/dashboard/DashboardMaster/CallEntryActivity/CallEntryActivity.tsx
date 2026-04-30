import { Box, Text, Stack, Tooltip, Flex } from "@mantine/core";
import type { CallEntryStatisticsSummary } from "../../../../service/dashboard.service";

interface CallEntryActivityProps {
  summary: CallEntryStatisticsSummary | null;
  isLoading: boolean;
}

export const CallEntryActivity = ({ summary, isLoading }: CallEntryActivityProps) => {
  if (isLoading || !summary) {
    return (
      <Stack gap="md" py="xl">
        <Box h={100} style={{ backgroundColor: '#F8FAFC', borderRadius: 8 }} />
      </Stack>
    );
  }

  const {
    total_sales_persons = 0,
    total_calls = 0,
    total_today = 0,
    total_overdue = 0,
    total_upcoming = 0,
    total_closed = 0,
    overdue_percentage = "0%",
    today_percentage = "0%",
    upcoming_percentage = "0%",
    closed_percentage = "0%",
  } = summary;

  const parsePercent = (value?: string) => {
    const parsed = Number.parseFloat((value || "").replace("%", "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const safePct = (value: number) => Math.max(2, Math.min(100, value));

  // Prefer summary percentage fields; derive from totals if needed.
  const derivedTodayPct =
    total_calls > 0 ? (total_today / total_calls) * 100 : 0;
  const derivedUpcomingPct =
    total_calls > 0 ? (total_upcoming / total_calls) * 100 : 0;
  const derivedOverduePct =
    total_calls > 0 ? (total_overdue / total_calls) * 100 : 0;
  const derivedClosedPct =
    total_calls > 0 ? (total_closed / total_calls) * 100 : 0;

  const todayPct = safePct(parsePercent(today_percentage) || derivedTodayPct);
  const upcomingPct = safePct(
    parsePercent(upcoming_percentage) || derivedUpcomingPct
  );
  const overduePct = safePct(parsePercent(overdue_percentage) || derivedOverduePct);
  const closedPct = safePct(parsePercent(closed_percentage) || derivedClosedPct);

  // Data-driven mini bars inspired by the standalone ERP card rhythm.
  const baseValues = [todayPct, upcomingPct, overduePct, closedPct];
  const wave = [0.62, 0.84, 0.9, 0.78, 0.7, 0.92, 1.08, 0.95, 0.82, 1, 0.88, 0.72, 0.58];
  const chartData = wave.map((factor, index) => ({
    value: safePct(baseValues[index % baseValues.length] * factor),
  }));

  return (
    <Stack gap="lg" style={{ flex: 1 }}>
      {/* Subtitle */}
      <Text c="#94A3B8" fz={12} fw={500} style={{ marginTop: -8 }}>
        {total_calls} calls today · {total_sales_persons} reps
      </Text>

      {/* KPI strip */}
      <Flex justify="space-between" align="flex-start" wrap="nowrap">
        {/* QUALIFIED */}
        <Stack gap={2} style={{ flex: 1 }}>
          <Text c="#94A3B8" fz={10} fw={600} tt="uppercase" lts="0.05em">QUALIFIED</Text>
          <Text fz={24} fw={600} c="#10B981" style={{ lineHeight: 1.1 }}>{total_closed}</Text>
          <Text c="#64748B" fz={11} fw={500}>{closed_percentage} rate</Text>
        </Stack>

        {/* TODAY */}
        <Stack gap={2} style={{ flex: 1 }}>
          <Text c="#94A3B8" fz={10} fw={600} tt="uppercase" lts="0.05em">TODAY</Text>
          <Text fz={24} fw={600} c="#0F172A" style={{ lineHeight: 1.1 }}>{total_today}</Text>
          <Text c="#10B981" fz={11} fw={600}>{today_percentage} of total</Text>
        </Stack>

        {/* FOLLOW-UPS */}
        <Stack gap={2} style={{ flex: 1 }}>
          <Text c="#94A3B8" fz={10} fw={600} tt="uppercase" lts="0.05em">FOLLOW-UPS</Text>
          <Text fz={24} fw={600} c="#F59E0B" style={{ lineHeight: 1.1 }}>{total_upcoming}</Text>
          <Text c="#EF4444" fz={11} fw={500}>{total_overdue} overdue</Text>
        </Stack>
      </Flex>

      {/* Dynamic activity bars from summary percentages */}
      <Box pt={2}>
        <Flex align="flex-end" gap={4} h={34}>
          {chartData.map((item, idx) => (
            <Tooltip
              key={idx}
              label={`Today ${todayPct.toFixed(0)}% • Upcoming ${upcomingPct.toFixed(0)}% • Overdue ${overduePct.toFixed(0)}% • Closed ${closedPct.toFixed(0)}%`}
              withArrow
              color="#0F172A"
            >
              <Box
                style={{
                  flex: 1,
                  backgroundColor: "#17386A",
                  height: `${item.value}%`,
                  borderRadius: "2px",
                  boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.12)",
                }}
              />
            </Tooltip>
          ))}
        </Flex>

        <Flex justify="space-between" mt={4} px={2}>
          <Text fz={9} c="#94A3B8">9a</Text>
          <Text fz={9} c="#94A3B8">11a</Text>
          <Text fz={9} c="#94A3B8">1p</Text>
          <Text fz={9} c="#94A3B8">3p</Text>
          <Text fz={9} c="#94A3B8">5p</Text>
        </Flex>
      </Box>
    </Stack>
  );
};

