import { Group, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";

type ErpListRouteListTheme = Pick<ErpListTheme, "primary" | "fg" | "muted" | "fontSans">;

/**
 * Pairs `origin_list` / `destination_list` — same as Air Export Booking “Route”.
 * Pass `{ wrapContent: true }` to allow origin/destination text to wrap fully in narrow cells.
 */
export function erpListRouteListCell(
  originList: unknown,
  destList: unknown,
  { primary, fg, muted, fontSans }: ErpListRouteListTheme,
  options?: { wrapContent?: boolean; compact?: boolean },
): ReactNode {
  const wrapContent = options?.wrapContent ?? false;
  const compact = options?.compact ?? false;
  const groupGap = compact ? 4 : 6;
  const stackGap = compact ? 4 : 6;
  const oa = (originList as string[] | undefined) ?? [];
  const da = (destList as string[] | undefined) ?? [];
  const lineCount = Math.max(oa.length, da.length) || 1;
    const textStyle = {
      fontFamily: fontSans,
      ...(wrapContent ? { wordBreak: "break-word" as const } : {}),
      ...(compact
        ? {
            flex: 1,
            minWidth: 0,
            overflow: "hidden" as const,
            textOverflow: "ellipsis" as const,
            whiteSpace: "nowrap" as const,
          }
        : {}),
    };
  const cell = (i: number) => {
    const os = oa[i];
    const ds = da[i];
    const oc = os != null && String(os).trim() !== "" ? String(os) : "—";
    const dc = ds != null && String(ds).trim() !== "" ? String(ds) : "—";
    return (
      <Group
        key={i}
        gap={groupGap}
        wrap={wrapContent ? "wrap" : "nowrap"}
        align={wrapContent ? "flex-start" : "center"}
        style={compact ? { minWidth: 0, maxWidth: "100%" } : undefined}
      >
        <Text fw={600} size="sm" c={primary} style={textStyle} lineClamp={compact ? 1 : undefined}>
          {oc}
        </Text>
        <IconArrowRight
          size={12}
          color={muted}
          style={{
            flexShrink: 0,
            ...(wrapContent ? { marginTop: 4 } : {}),
          }}
        />
        <Text fw={500} size="sm" c={fg} style={textStyle} lineClamp={compact ? 1 : undefined}>
          {dc}
        </Text>
      </Group>
    );
  };
  if (lineCount === 1) {
    return cell(0);
  }
  return (
    <Stack gap={stackGap}>{Array.from({ length: lineCount }, (_, i) => cell(i))}</Stack>
  );
}
