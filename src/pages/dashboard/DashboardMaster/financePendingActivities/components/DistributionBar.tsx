import { Box } from "@mantine/core";
import type { DistributionSegment } from "../financePendingActivitiesTypes";
import { PA_DIST_COLOR, PA_LINE } from "../theme";

type DistributionBarProps = {
  segments: DistributionSegment[];
};

export function DistributionBar({ segments }: DistributionBarProps) {
  const visible = segments.filter((s) => s.flex > 0);
  if (!visible.length) {
    return (
      <Box
        style={{
          height: 10,
          borderRadius: 4,
          background: "#f1f5f9",
          border: `1px solid ${PA_LINE}`,
        }}
      />
    );
  }

  return (
    <Box
      title="Invoices · Costs · Vouchers · Credit notes"
      style={{
        display: "flex",
        height: 10,
        borderRadius: 4,
        overflow: "hidden",
        background: "#f1f5f9",
        border: `1px solid ${PA_LINE}`,
      }}
    >
      {visible.map((seg, i) => (
        <Box
          key={`${seg.category}-${i}`}
          style={{
            flex: seg.flex,
            background: PA_DIST_COLOR[seg.category],
            minWidth: seg.flex > 0 ? 2 : 0,
          }}
        />
      ))}
    </Box>
  );
}
