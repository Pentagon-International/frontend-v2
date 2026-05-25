import { Box } from "@mantine/core";
import type { CollectionBarTone } from "../collectionTargetVsPerformanceTypes";
import { COL_GOOD, COL_LINE, COL_NAVY_700, COL_NAVY_900, COL_WARN } from "../theme";

function barColor(tone?: CollectionBarTone): string {
  if (tone === "over") return COL_GOOD;
  if (tone === "under") return COL_WARN;
  return COL_NAVY_700;
}

type CollectionPerformanceBarProps = {
  collectedWidthPct: number;
  markerLeftPct: number;
  tone?: CollectionBarTone;
};

export function CollectionPerformanceBar({
  collectedWidthPct,
  markerLeftPct,
  tone,
}: CollectionPerformanceBarProps) {
  return (
    <Box
      style={{
        height: 22,
        background: "#f1f5f9",
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(11,31,58,0.08) 4px, rgba(11,31,58,0.08) 8px)",
          border: `1px dashed ${COL_LINE}`,
          borderRadius: 4,
        }}
      />
      <Box
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${Math.min(100, Math.max(0, collectedWidthPct))}%`,
          background: barColor(tone),
          borderRadius: 4,
        }}
      />
      {/* <Box
        style={{
          position: "absolute",
          top: -3,
          bottom: -3,
          left: `${Math.min(100, Math.max(0, markerLeftPct))}%`,
          width: 2,
          background: COL_NAVY_900,
          transform: "translateX(-1px)",
        }}
      /> */}
    </Box>
  );
}
