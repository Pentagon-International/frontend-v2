import { Box, Flex, Text } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { getLaneLabel } from "./data";
import { ModeChip } from "./ModeChip";
import {
  CARD_BG,
  INK,
  INK_2,
  INK_3,
  INK_4,
  LINE,
  PAGE_BG,
} from "./constants";
import type { ProfitabilityJob } from "./types";
import { formatLakhs, jobMarginPct, marginTone, profitabilityTrillFonts } from "./utils";

const JL_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1.2fr 90px 90px 80px 80px 30px",
  gap: 12,
  alignItems: "center",
  padding: "11px 14px",
  fontSize: 12,
};

const MARGIN_STYLES = {
  good: { background: "#dcfce7", color: "#166534" },
  ok: { background: PAGE_BG, color: INK_2, border: `1px solid ${LINE}` },
  warn: { background: "#fef3c7", color: "#92400e" },
  bad: { background: "#fee2e2", color: "#b91c1c" },
} as const;

function MarginBadge({ marginPct }: { marginPct: number }) {
  const tone = marginTone(marginPct);
  const style = MARGIN_STYLES[tone];
  return (
    <Box
      component="span"
      style={{
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        padding: "3px 7px",
        borderRadius: 3,
        textAlign: "center",
        display: "inline-block",
        minWidth: 50,
        ...style,
      }}
    >
      {marginPct.toFixed(1)}%
    </Box>
  );
}

function CurrencyCell({
  valueL,
  bold = false,
  muted = false,
}: {
  valueL: number;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <Text
      style={{
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        fontWeight: bold ? 600 : 400,
        color: muted ? INK_3 : bold ? INK : INK_2,
        fontFamily: profitabilityTrillFonts.sans,
      }}
    >
      <Text span c={INK_4} fz={10} mr={1}>
        ₹
      </Text>
      {formatLakhs(valueL)}
    </Text>
  );
}

type ProfitabilityJobTableProps = {
  jobs: ProfitabilityJob[];
  onJobClick?: (job: ProfitabilityJob) => void;
};

export function ProfitabilityJobTable({ jobs, onJobClick }: ProfitabilityJobTableProps) {
  return (
    <Box>
      <Flex align="baseline" justify="space-between" gap={12} mb={10} wrap="wrap">
        <Text fw={600} fz={13} c={INK}>
          Job-wise Profitability
        </Text>
        <Text fz={11} c={INK_4}>
          {jobs.length} jobs · sorted by GP · click for P&amp;L
        </Text>
      </Flex>

      <Box
        style={{
          background: CARD_BG,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            ...JL_GRID,
            background: PAGE_BG,
            color: INK_3,
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontWeight: 500,
            paddingTop: 9,
            paddingBottom: 9,
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <div>Customer / Job</div>
          <div>Mode / Lane</div>
          <div style={{ textAlign: "right" }}>Revenue</div>
          <div style={{ textAlign: "right" }}>Cost</div>
          <div style={{ textAlign: "right" }}>GP</div>
          <div style={{ textAlign: "right" }}>Margin</div>
          <div />
        </Box>

        {jobs.length === 0 ? (
          <Box py={24} ta="center">
            <Text fz={12} c={INK_4}>
              No jobs in this period.
            </Text>
          </Box>
        ) : (
          jobs.map((job) => {
            const gp = job.revenueL - job.costL;
            const marginPct = jobMarginPct(job);
            return (
              <Box
                key={job.id}
                style={{
                  ...JL_GRID,
                  borderBottom: `1px solid ${LINE}`,
                  cursor: onJobClick ? "pointer" : "default",
                  transition: "background 120ms",
                }}
                onClick={() => onJobClick?.(job)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = PAGE_BG;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Box>
                  <Text fw={600} c={INK} lh={1.3}>
                    {job.customer}
                  </Text>
                  <Text
                    fz={11}
                    c={INK_3}
                    mt={2}
                    style={{ fontFamily: profitabilityTrillFonts.mono }}
                  >
                    {job.id} · {job.delivered}
                  </Text>
                </Box>
                <Box>
                  <ModeChip segment={job.segment} />
                  <Text
                    fz={10.5}
                    c={INK_4}
                    mt={3}
                    style={{ fontFamily: profitabilityTrillFonts.mono }}
                  >
                    {getLaneLabel(job.lane)}
                  </Text>
                </Box>
                <CurrencyCell valueL={job.revenueL} />
                <CurrencyCell valueL={job.costL} muted />
                <CurrencyCell valueL={gp} bold />
                <Flex justify="flex-end">
                  <MarginBadge marginPct={marginPct} />
                </Flex>
                <Flex justify="flex-end" align="center" c={INK_4}>
                  <IconChevronRight size={16} stroke={1.75} />
                </Flex>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
