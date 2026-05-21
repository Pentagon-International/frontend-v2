import { useEffect, useState } from "react";
import { Alert, Box, Drawer, Flex, Loader, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { BreakdownDimension, BreakdownRow } from "./accountsDashboardTypes";
import ProfitabilityTrillTwo from "./ProfitabilityTrillTwo";
import { DIMENSION_CRUMB, INK, INK_3, INK_4, LINE, NAVY_600, PAGE_BG } from "./profitabilityTrillOne/constants";
import { ProfitabilityDrillKpiCards } from "./profitabilityTrillOne/ProfitabilityDrillKpiCards";
import { ProfitabilityJobTable } from "./profitabilityTrillOne/ProfitabilityJobTable";
import {
  fetchBranchDrillData,
  fetchCustomerDrillData,
  fetchSegmentDrillData,
  fetchTradelaneDrillData,
  type ProfitabilityDrillData,
} from "./profitabilityTrillOne/profitabilityTrillOneApi";
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
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<ProfitabilityDrillData | null>(null);

  const branchCode = row?.code?.trim() || "";
  const customerCode = row?.id?.trim() || row?.code?.trim() || "";
  const originCode = row?.originCode?.trim() || "";
  const destinationCode = row?.destinationCode?.trim() || "";

  useEffect(() => {
    if (!opened) {
      setTrillTwoOpened(false);
      setSelectedJob(null);
      setDrillData(null);
      setDrillError(null);
      setDrillLoading(false);
      return;
    }

    const isSegmentDrill = dimension === "segment" && Boolean(row?.name);
    const isBranchDrill = dimension === "branch" && Boolean(branchCode);
    const isCustomerDrill = dimension === "customer" && Boolean(customerCode);
    const isTradelaneDrill =
      dimension === "tradelane" && Boolean(originCode && destinationCode);

    if (!isSegmentDrill && !isBranchDrill && !isCustomerDrill && !isTradelaneDrill) {
      setDrillData(null);
      setDrillError(null);
      setDrillLoading(false);
      return;
    }

    let cancelled = false;
    setDrillLoading(true);
    setDrillError(null);
    setDrillData(null);

    const fetchPromise = isTradelaneDrill
      ? fetchTradelaneDrillData({
          company,
          originCode,
          destinationCode,
          fromDate,
          toDate,
        })
      : isCustomerDrill
        ? fetchCustomerDrillData({
            company,
            customerCode,
            fromDate,
            toDate,
          })
        : isBranchDrill
          ? fetchBranchDrillData({
              company,
              branchCode,
              fromDate,
              toDate,
            })
          : fetchSegmentDrillData({
              company,
              service: row!.name,
              fromDate,
              toDate,
            });

    void fetchPromise
      .then((data) => {
        if (!cancelled) setDrillData(data);
      })
      .catch(() => {
        if (!cancelled) {
          setDrillData(null);
          setDrillError(
            isTradelaneDrill
              ? "Unable to load tradelane drill-down. Check your connection and try again."
              : isCustomerDrill
                ? "Unable to load customer drill-down. Check your connection and try again."
                : isBranchDrill
                  ? "Unable to load branch drill-down. Check your connection and try again."
                  : "Unable to load segment drill-down. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDrillLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    opened,
    dimension,
    row?.name,
    branchCode,
    customerCode,
    originCode,
    destinationCode,
    company,
    fromDate,
    toDate,
  ]);

  const jobs = drillData?.jobs ?? [];
  const summary = drillData?.summary ?? null;

  useEffect(() => {
    if (!opened) {
      setTrillTwoOpened(false);
      setSelectedJob(null);
    }
  }, [opened]);

  if (!row) return null;

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

          {drillLoading ? (
            <Flex justify="center" align="center" py={48}>
              <Loader color={NAVY_600} />
            </Flex>
          ) : drillError ? (
            <Alert color="red" variant="light" radius="md" title="Could not load data">
              {drillError}
            </Alert>
          ) : summary ? (
            <>
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
            </>
          ) : null}
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
