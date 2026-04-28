import { Group, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";

type ErpListRouteListTheme = Pick<ErpListTheme, "primary" | "fg" | "muted" | "fontSans">;

/**
 * Pairs `origin_list` / `destination_list` — same as Air Export Booking “Route”.
 */
export function erpListRouteListCell(
  originList: unknown,
  destList: unknown,
  { primary, fg, muted, fontSans }: ErpListRouteListTheme,
): ReactNode {
  const oa = (originList as string[] | undefined) ?? [];
  const da = (destList as string[] | undefined) ?? [];
  const lineCount = Math.max(oa.length, da.length) || 1;
  const cell = (i: number) => {
    const os = oa[i];
    const ds = da[i];
    const oc = os != null && String(os).trim() !== "" ? String(os) : "—";
    const dc = ds != null && String(ds).trim() !== "" ? String(ds) : "—";
    return (
      <Group key={i} gap={6} wrap="nowrap" align="center">
        <Text fw={600} size="sm" c={primary} style={{ fontFamily: fontSans }}>
          {oc}
        </Text>
        <IconArrowRight size={12} color={muted} style={{ flexShrink: 0 }} />
        <Text fw={500} size="sm" c={fg} style={{ fontFamily: fontSans }}>
          {dc}
        </Text>
      </Group>
    );
  };
  if (lineCount === 1) {
    return cell(0);
  }
  return <Stack gap={6}>{Array.from({ length: lineCount }, (_, i) => cell(i))}</Stack>;
}
