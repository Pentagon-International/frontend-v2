import { Box, SimpleGrid, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { CallEntryDashboardResponse } from "../../../../service/dashboard.service";

type Props = {
  data: CallEntryDashboardResponse | null;
};

type Tile = {
  label: string;
  value: number | string;
  sub: string;
  valueColor: string;
};

const tileStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  padding: "8px 10px",
  minHeight: 72,
} as const;

export function CallEntryKpiRow({ data }: Props) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const kpi = data?.kpi;
  const summary = data?.summary;

  const tiles: Tile[] = [
    {
      label: "TOTAL CALLS",
      value: kpi?.total_calls ?? 0,
      sub: `Target 150  · ${summary?.overdue_percentage ?? "0%"} open`,
      valueColor: "#0B1F3A",
    },
    {
      label: "INBOUND",
      value: kpi?.total_today ?? 0,
      sub: `${summary?.today_percentage ?? "0%"} of total`,
      valueColor: "#0B1F3A",
    },
    {
      label: "OUTBOUND",
      value: kpi?.total_upcoming ?? 0,
      sub: `${summary?.upcoming_percentage ?? "0%"} of total`,
      valueColor: "#0B1F3A",
    },
    {
      label: "MISSED",
      value: kpi?.total_overdue ?? 0,
      sub: `${summary?.overdue_percentage ?? "0%"} follow-up`,
      valueColor: "#EF4444",
    },
    // {
    //   label: "AVG. DURATION",
    //   value: "6:42",
    //   sub: `+${summary?.closed_percentage ?? "0%"} vs avg`,
    //   valueColor: "#0B1F3A",
    // },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
      {tiles.map((tile) => (
        <Box
          key={tile.label}
          style={{
            ...tileStyle,
            minHeight: isMobile ? 66 : tileStyle.minHeight,
            padding: isMobile ? "7px 9px" : tileStyle.padding,
          }}
        >
          <Stack gap={4}>
            <Text fz={isMobile ? 8 : 9} fw={700} c="#8FA2B7" tt="uppercase" lts="0.03em">
              {tile.label}
            </Text>
            <Text fz={isMobile ? 24 : 30} fw={700} c={tile.valueColor} style={{ lineHeight: 1 }}>
              {tile.value}
            </Text>
            <Text fz={isMobile ? 8 : 9} fw={600} c="#9AAABD" lineClamp={1}>
              {tile.sub}
            </Text>
          </Stack>
        </Box>
      ))}
    </SimpleGrid>
  );
}
