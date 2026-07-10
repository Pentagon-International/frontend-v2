import { Box, Group, Stack, Text } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";
import type { ErpListTheme } from "./erpListTheme";
import { DEFAULT_ERP_LIST_THEME } from "./erpListTheme";

/** Shared vertical rhythm so every pill has the same height and aligned numerals across a row. */
const PILL_ROW_MIN_HEIGHT_PX = 52;
/** One-line slot for `size="lg"` value — counts share the same baseline in a stat row. */
const VALUE_SLOT_MIN_HEIGHT_PX = 24;
/** Reserved space for up to two caption lines (`size={10}`, stacked words). */
const LABEL_ZONE_MIN_HEIGHT_PX = 28;

export interface ERPListStatPillProps {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  /** Icon tile background (CSS color). */
  iconBackground?: string;
  /** Icon color (CSS color). */
  iconColor?: string;
  theme?: ErpListTheme;
  /** Fixed pixel width so sub-header KPI tiles align (optional). */
  pillWidth?: number;
}

/**
 * KPI tile used in list sub-headers (icon + large value + caption).
 * Layout uses fixed slots so numbers line up horizontally and icons stay centred in each row.
 */
export function ERPListStatPill({
  icon,
  value,
  label,
  iconBackground,
  iconColor,
  theme = DEFAULT_ERP_LIST_THEME,
  pillWidth,
}: ERPListStatPillProps) {
  const bg = iconBackground ?? `${theme.primary}1a`;
  const fgIcon = iconColor ?? theme.primary;

  /** Multi-word captions stack vertically (e.g. “Quote created”). */
  const labelWords = label.trim().split(/\s+/).filter(Boolean);

  const rootStyle: CSSProperties = {
    minHeight: PILL_ROW_MIN_HEIGHT_PX,
    boxSizing: "border-box",
    ...(pillWidth != null
      ? { width: pillWidth, flexShrink: 0 }
      : { minWidth: 0, flexShrink: 0 }),
  };

  return (
    <Group gap={8} wrap="nowrap" align="stretch" style={rootStyle}>
      <Box
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          alignSelf: "center",
        }}
      >
        <Box style={{ color: fgIcon, display: "flex" }}>{icon}</Box>
      </Box>
      <Stack
        gap={4}
        justify="flex-start"
        align="stretch"
        style={{ minWidth: 0, flex: 1 }}
      >
        {/* Fixed-height value row — aligns counts across neighbouring pills */}
        <Box
          style={{
            minHeight: VALUE_SLOT_MIN_HEIGHT_PX,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-start",
          }}
        >
          <Text fw={700} size="lg" c={theme.fg} lh={1.1} style={{ fontFamily: theme.fontSans }}>
            {value}
          </Text>
        </Box>
        {/* Caption area: two-line capacity without shifting the number above */}
        <Box
          style={{
            minHeight: LABEL_ZONE_MIN_HEIGHT_PX,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            gap: 2,
          }}
        >
          <Text
            c={theme.muted}
            lh={1.15}
            style={{ fontFamily: theme.fontSans }}
          >
          {labelWords.map((word, i) => (
            <span key={i} style={{ display: "inline", fontSize: 10, lineHeight: 1.15 }}>
              {word}{" "}
            </span>
          ))}
          </Text>
        </Box>
      </Stack>
    </Group>
  );
}
