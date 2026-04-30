import { Box, Text } from "@mantine/core";

export type FunnelSegment = {
  key: string;
  label: string;
  /** 0–100, will be normalized to sum to 100 if needed */
  weight: number;
  color: string;
};

function normalizeWeights(segments: FunnelSegment[]): { seg: FunnelSegment; pct: number }[] {
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

export function SegmentedFunnelBar({
  segments,
  height = 28,
  showLabels = true,
}: {
  segments: FunnelSegment[];
  height?: number;
  showLabels?: boolean;
}) {
  const norm = normalizeWeights(segments);

  return (
    <Box>
      <Box
        style={{
          width: "100%",
          height,
          display: "flex",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}
      >
        {norm.map(({ seg, pct }) =>
          pct > 0 ? (
            <Box
              key={seg.key}
              title={`${seg.label}`}
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                minWidth: pct > 2 ? undefined : 2,
              }}
            />
          ) : null
        )}
      </Box>
      {showLabels ? (
        <Box
          style={{
            display: "flex",
            marginTop: 8,
            width: "100%",
            gap: 0,
          }}
        >
          {norm.map(({ seg, pct }) => (
            <Text
              key={seg.key}
              size="10px"
              c="#64748B"
              fw={500}
              style={{
                width: `${pct}%`,
                textAlign: "center",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                padding: "0 2px",
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
