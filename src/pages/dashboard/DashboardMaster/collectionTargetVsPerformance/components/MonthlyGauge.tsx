import { Box, Text } from "@mantine/core";
import { COL_GOOD, COL_INK, COL_INK_3, COL_LINE, COL_NAVY_900 } from "../theme";

type MonthlyGaugeProps = {
  pct: number;
};

export function MonthlyGauge({ pct }: MonthlyGaugeProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  const arcLength = 282.74;
  const filled = (clamped / 100) * arcLength;

  return (
    <Box style={{ width: 220, flexShrink: 0 }}>
      <svg viewBox="0 0 220 130" style={{ width: 220, height: 130 }}>
        <path
          d="M 20 110 A 90 90 0 0 1 200 110"
          stroke={COL_LINE}
          strokeWidth={18}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 20 110 A 90 90 0 0 1 200 110"
          stroke={COL_GOOD}
          strokeWidth={18}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLength}`}
        />
        <circle cx={200} cy={110} r={4} fill={COL_NAVY_900} />
        <text
          x={110}
          y={92}
          textAnchor="middle"
          style={{ fontSize: 28, fontWeight: 600, fill: COL_INK }}
        >
          {clamped % 1 === 0 ? clamped.toFixed(0) : clamped.toFixed(2)}%
        </text>
        <text
          x={110}
          y={110}
          textAnchor="middle"
          style={{ fontSize: 11, fill: COL_INK_3, textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          of monthly target
        </text>
      </svg>
    </Box>
  );
}
