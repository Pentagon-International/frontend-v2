import { Box, Group, Loader, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { CallEntryDashboardResponse } from "../../../../service/dashboard.service";

type Props = {
  data: CallEntryDashboardResponse | null;
  loading?: boolean;
  /** current dashboard type filter (all/today/upcoming/close/overdue) */
  activeType?: string;
  /** toggle type filter; pass "today|upcoming|close|overdue" */
  onTypeToggle?: (type: "today" | "upcoming" | "close" | "overdue") => void;
};

type Tile = {
  label: string;
  value: number | string;
  sub: string;
  valueColor: string;
  typeKey?: "today" | "upcoming" | "close" | "overdue";
};

const tileStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  padding: "8px 10px",
  minHeight: 72,
} as const;

export function CallEntryKpiRow({ data, loading, activeType, onTypeToggle }: Props) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const kpi = data?.kpi;
  const summary = data?.summary;

  const tiles: Tile[] = [
    {
      label: "TOTAL CALLS",
      value: summary?.total_calls ?? 0,
      sub: `Target 150  · ${summary?.overdue_percentage ?? "0%"} open`,
      valueColor: "#0B1F3A",
    },
    {
      label: "TODAY",
      value: summary?.total_today ?? kpi?.total_today ?? 0,
      sub: `${summary?.today_percentage ?? "0%"} of total`,
      valueColor: "#0B1F3A",
      typeKey: "today",
    },
    {
      label: "UPCOMING",
      value: summary?.total_upcoming ?? kpi?.total_upcoming ?? 0,
      sub: `${summary?.upcoming_percentage ?? "0%"} of total`,
      valueColor: "#0B1F3A",
      typeKey: "upcoming",
    },
    {
      label: "CLOSED",
      value: summary?.total_closed ?? kpi?.total_closed ?? 0,
      sub: `${summary?.closed_percentage ?? "0%"} resolved`,
      valueColor: "#0B1F3A",
      typeKey: "close",
    },
    {
      label: "MISSED",
      value: summary?.total_overdue ?? kpi?.total_overdue ?? 0,
      sub: `${summary?.overdue_percentage ?? "0%"} follow-up`,
      valueColor: "#EF4444",
      typeKey: "overdue",
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
      {tiles.map((tile) => {
        const clickable = !!tile.typeKey && !!onTypeToggle;
        const isActive = !!tile.typeKey && String(activeType || "all") === tile.typeKey;
        const CardShell = clickable ? UnstyledButton : Box;
        return (
          <CardShell
            key={tile.label}
            onClick={
              clickable && tile.typeKey
                ? () => onTypeToggle(tile.typeKey!)
                : undefined
            }
            style={{
              ...tileStyle,
              minHeight: isMobile ? 66 : tileStyle.minHeight,
              padding: isMobile ? "7px 9px" : tileStyle.padding,
              width: "100%",
              textAlign: "left",
              cursor: clickable ? "pointer" : "default",
              border: isActive ? "2px solid #153F72" : tileStyle.border,
              boxShadow: isActive ? "0 2px 8px rgba(21, 63, 114, 0.12)" : undefined,
            }}
          >
            <Stack gap={4}>
              <Text fz={isMobile ? 8 : 9} fw={700} c="#8FA2B7" tt="uppercase" lts="0.03em">
                {tile.label}
              </Text>
              <Group gap={8} wrap="nowrap" align="center">
                <Text fz={isMobile ? 24 : 30} fw={700} c={tile.valueColor} style={{ lineHeight: 1 }}>
                  {loading && clickable ? "…" : tile.value}
                </Text>
                {loading && clickable ? <Loader size={14} color="#153F72" /> : null}
              </Group>
              <Text fz={isMobile ? 8 : 9} fw={600} c="#9AAABD" lineClamp={1}>
                {tile.sub}
              </Text>
            </Stack>
          </CardShell>
        );
      })}
    </SimpleGrid>
  );
}
