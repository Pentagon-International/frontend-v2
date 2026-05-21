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
import type { ProfitabilityDrillRowKind } from "./profitabilityTrillOneApi";
import type { ProfitabilityJob } from "./types";
import {
  formatProfitabilityAmount,
  jobMarginPct,
  marginTone,
  profitabilityTrillFonts,
} from "./utils";

const JL_GRID_BASE: React.CSSProperties = {
  display: "grid",
  gap: 12,
  alignItems: "center",
  padding: "11px 14px",
  fontSize: 12,
};

const JL_GRID_COLUMNS = {
  default: "1.6fr 1.2fr 90px 90px 80px 80px 30px",
  withSalesperson: "1.4fr 100px 1fr 90px 90px 80px 80px 30px",
} as const;

const MARGIN_STYLES = {
  good: { background: "#dcfce7", color: "#166534" },
  ok: { background: PAGE_BG, color: INK_2, border: `1px solid ${LINE}` },
  warn: { background: "#fef3c7", color: "#92400e" },
  bad: { background: "#fee2e2", color: "#b91c1c" },
} as const;

function MarginBadge({ marginPct }: { marginPct: number | null }) {
  if (marginPct === null || !Number.isFinite(marginPct)) {
    return (
      <Text fz={11} c={INK_4} style={{ textAlign: "right" }}>
        —
      </Text>
    );
  }
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
  value,
  currencyCode,
  bold = false,
  muted = false,
}: {
  value: number;
  currencyCode: string;
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
      {formatProfitabilityAmount(value, currencyCode)}
    </Text>
  );
}

type ProfitabilityJobTableProps = {
  jobs: ProfitabilityJob[];
  /** Job rows when drill request includes customer_code (or other job-level drill). */
  rowKind?: ProfitabilityDrillRowKind;
  /** Show salesperson column when drill request included salesperson_name. */
  showSalesperson?: boolean;
  onJobClick?: (job: ProfitabilityJob) => void;
};

export function ProfitabilityJobTable({
  jobs,
  rowKind = "customer",
  showSalesperson = false,
  onJobClick,
}: ProfitabilityJobTableProps) {
  const currencyCode = jobs[0]?.currencyCode ?? "INR";
  const showJobIdPrimary = rowKind === "job";
  const gridStyle: React.CSSProperties = {
    ...JL_GRID_BASE,
    gridTemplateColumns: showSalesperson
      ? JL_GRID_COLUMNS.withSalesperson
      : JL_GRID_COLUMNS.default,
  };

  return (
    <Box>
      <Flex align="baseline" justify="space-between" gap={12} mb={10} wrap="wrap">
        <Text fw={600} fz={13} c={INK}>
          Job-wise Profitability
        </Text>
        <Text fz={11} c={INK_4}>
          {jobs.length} rows · {currencyCode} · sorted by GP
          {showJobIdPrimary ? " · click for P&L" : " · click to drill"}
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
            ...gridStyle,
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
          <div>{showJobIdPrimary ? "Job" : "Customer"}</div>
          {showSalesperson ? <div>Salesperson</div> : null}
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
            const displayMargin: number | null =
              job.marginPct !== null && Number.isFinite(job.marginPct)
                ? job.marginPct
                : job.revenue > 0
                  ? jobMarginPct(job)
                  : null;
            return (
              <Box
                key={job.id}
                style={{
                  ...gridStyle,
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
                  <Text
                    fw={600}
                    c={INK}
                    lh={1.3}
                    style={
                      showJobIdPrimary
                        ? { fontFamily: profitabilityTrillFonts.mono }
                        : undefined
                    }
                  >
                    {showJobIdPrimary ? job.id : job.customer}
                  </Text>
                  <Text
                    fz={11}
                    c={INK_3}
                    mt={2}
                    style={{ fontFamily: profitabilityTrillFonts.mono }}
                  >
                    {showJobIdPrimary
                      ? [job.delivered, getLaneLabel(job.lane)].filter((s) => s && s !== "—").join(" · ") ||
                        "—"
                      : `${job.id} · ${job.delivered}`}
                  </Text>
                </Box>
                {showSalesperson ? (
                  <Text fz={12} c={INK_2} lh={1.3}>
                    {job.rep}
                  </Text>
                ) : null}
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
                <CurrencyCell value={job.revenue} currencyCode={job.currencyCode} />
                <CurrencyCell value={job.cost} currencyCode={job.currencyCode} muted />
                <CurrencyCell value={job.grossProfit} currencyCode={job.currencyCode} bold />
                <Flex justify="flex-end">
                  <MarginBadge marginPct={displayMargin} />
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
