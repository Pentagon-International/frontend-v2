import { useEffect, useMemo, useState } from "react";
import { Box, Drawer, Flex, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { BreakdownDimension, BreakdownRow } from "./accountsDashboardTypes";
import ProfitabilityTrillTwo from "./ProfitabilityTrillTwo";
import { DIMENSION_CRUMB, INK, INK_3, INK_4, LINE, NAVY_600, PAGE_BG } from "./profitabilityTrillOne/constants";
import {
  buildDrillSummary,
  filterJobsForRow,
  sortJobsByGrossProfit,
} from "./profitabilityTrillOne/data";
import { ProfitabilityDrillKpiCards } from "./profitabilityTrillOne/ProfitabilityDrillKpiCards";
import { ProfitabilityJobTable } from "./profitabilityTrillOne/ProfitabilityJobTable";
import type { ProfitabilityJob } from "./profitabilityTrillOne/types";
import { profitabilityTrillFonts } from "./profitabilityTrillOne/utils";

export type ProfitabilityTrillOneProps = {
  opened: boolean;
  onClose: () => void;
  dimension: BreakdownDimension;
  row: BreakdownRow | null;
  periodLabel?: string;
  categoryBenchmarkPct?: number;
  company: string;
  fromDate?: Date | null;
  toDate?: Date | null;
};

export default function ProfitabilityTrillOne({
  opened,
  onClose,
  dimension,
  row,
  periodLabel = "YTD",
  categoryBenchmarkPct,
  company,
  fromDate,
  toDate,
}: ProfitabilityTrillOneProps) {
  const [selectedJob, setSelectedJob] = useState<ProfitabilityJob | null>(null);
  const [trillTwoOpened, setTrillTwoOpened] = useState(false);
  const jobs = useMemo(
    () => (row ? sortJobsByGrossProfit(filterJobsForRow(dimension, row)) : []),
    [dimension, row],
  );

  const summary = useMemo(() => {
    if (!row) return null;
    return buildDrillSummary({ dimension, row, periodLabel, categoryBenchmarkPct }, jobs);
  }, [categoryBenchmarkPct, dimension, jobs, periodLabel, row]);

  useEffect(() => {
    if (!opened) {
      setTrillTwoOpened(false);
      setSelectedJob(null);
    }
  }, [opened]);

  if (!row || !summary) return null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={920}
      withCloseButton={false}
      padding={0}
      overlayProps={{ opacity: 0.35, blur: 0 }}
      transitionProps={{ transition: "slide-left", duration: 220 }}
      styles={{
        content: {
          background: PAGE_BG,
          boxShadow: "-16px 0 40px rgba(15, 23, 42, 0.18)",
          fontFamily: profitabilityTrillFonts.sans,
        },
        body: { padding: 0, height: "100%" },
      }}
    >
      <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Flex
          align="center"
          gap={14}
          px={22}
          py={14}
          style={{
            background: "#ffffff",
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <Text fz={12} c={INK_3} style={{ flex: 1 }}>
            <Text span c={NAVY_600} fw={500}>
              {DIMENSION_CRUMB[dimension]}
            </Text>
            <Text span c={INK_4} mx={6}>
              ·
            </Text>
            <Text span c={INK} fw={600}>
              {row.name}
            </Text>
          </Text>
          <Box
            component="button"
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              width: 30,
              height: 30,
              borderRadius: 6,
              color: INK_3,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = PAGE_BG;
              e.currentTarget.style.color = INK;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = INK_3;
            }}
          >
            <IconX size={18} stroke={1.75} />
          </Box>
        </Flex>

        <Box style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          <Flex align="baseline" gap={12} mb={16} wrap="wrap">
            <Text
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: INK,
                lineHeight: 1.2,
              }}
            >
              {row.name}
            </Text>
            <Text fz={12} c={INK_3}>
              {row.subtitle ? `${row.subtitle} · ` : ""}
              {periodLabel}
            </Text>
          </Flex>

          <ProfitabilityDrillKpiCards
            summary={summary}
            categoryBenchmarkPct={categoryBenchmarkPct}
          />

          <ProfitabilityJobTable
            jobs={jobs}
            onJobClick={(job) => {
              setSelectedJob(job);
              setTrillTwoOpened(true);
            }}
          />
        </Box>
      </Box>

      <ProfitabilityTrillTwo
        opened={trillTwoOpened}
        onClose={() => {
          setTrillTwoOpened(false);
          setSelectedJob(null);
        }}
        onBack={() => {
          setTrillTwoOpened(false);
          setSelectedJob(null);
        }}
        job={selectedJob}
        dimension={dimension}
        parentName={row.name}
        company={company}
        fromDate={fromDate}
        toDate={toDate}
      />
    </Drawer>
  );
}
