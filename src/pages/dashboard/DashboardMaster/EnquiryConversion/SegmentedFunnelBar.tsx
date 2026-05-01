import type { CSSProperties } from "react";
import { Box, Text } from "@mantine/core";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export type FunnelSegment = {
  key: string;
  label: string;
  /** 0–100, will be normalized to sum to 100 if needed */
  weight: number;
  color: string;
};

function normalizeWeights(
  segments: FunnelSegment[]
): { seg: FunnelSegment; pct: number }[] {
  const sum = segments.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (sum <= 0) {
    const eq = segments.length ? 100 / segments.length : 0;
    return segments.map((seg) => ({ seg, pct: eq }));
  }
  return segments.map((seg) => ({
    seg,
    pct: (Math.max(0, seg.weight) / sum) * 100,
  }));
}

const ERP_FONT = "'Geist', sans-serif";

/** Label alignment matched to Pentagon overview: ends out, middle centred. */
function labelAlign(i: number, n: number): CSSProperties["textAlign"] {
  if (n <= 1) return "center";
  if (i === 0) return "left";
  if (i === n - 1) return "right";
  return "center";
}

export function SegmentedFunnelBar({
  segments,
  height = 22,
  showLabels = true,
  gutterPx = 3,
}: {
  segments: FunnelSegment[];
  height?: number;
  showLabels?: boolean;
  /** Gap between coloured segments */
  gutterPx?: number;
}) {
  const norm = normalizeWeights(segments).filter(({ pct }) => pct > 0);
  const n = norm.length;

  return (
    <Box style={{ fontFamily: ERP_FONT }}>
      <Box
        style={{
          width: "100%",
          display: "flex",
          alignItems: "stretch",
          gap: gutterPx,
        }}
      >
        {norm.map(({ seg, pct }, idx) => (
          <Box
            key={seg.key}
            title={`${seg.label}`}
            style={{
              width: `${pct}%`,
              minWidth: pct > 1 ? undefined : 1,
              height,
              flexShrink: 0,
              backgroundColor: seg.color,
              borderRadius: 4,
              transition: "width 0.35s ease",
            }}
          />
        ))}
      </Box>
      {showLabels ? (
        <Box
          style={{
            display: "flex",
            marginTop: 10,
            width: "100%",
            gap: gutterPx,
          }}
        >
          {norm.map(({ seg, pct }, idx) => (
            <Text
              key={seg.key}
              fz={12}
              fw={600}
              c={enquiryConversionColors.subHeading}
              style={{
                width: `${pct}%`,
                minWidth: 0,
                textAlign: labelAlign(idx, n),
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {seg.label}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
