import { useEffect, useState } from "react";
import { Alert, Box, Drawer, Flex, Loader, SimpleGrid, Text } from "@mantine/core";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import type { BreakdownDimension } from "./accountsDashboardTypes";
import type { ProfitabilityJob } from "./profitabilityTrillOne/types";
import {
  DIMENSION_CRUMB,
  INK,
  INK_3,
  INK_4,
  LINE,
  NAVY_600,
  PAGE_BG,
} from "./profitabilityTrillOne/constants";
import { profitabilityTrillFonts } from "./profitabilityTrillOne/utils";
import { JobDetailHeader } from "./profitabilityTrillTwo/JobDetailHeader";
import { JobDetailKpiCards } from "./profitabilityTrillTwo/JobDetailKpiCards";
import { JobPlTable } from "./profitabilityTrillTwo/JobPlTable";
import { MarginBridgeCard } from "./profitabilityTrillTwo/MarginBridgeCard";
import { fetchJobProfitabilityDetail } from "./profitabilityTrillTwo/service";
import type { JobLinkedDocument, JobProfitabilityDetail } from "./profitabilityTrillTwo/types";
import ProfitabilityTrillThree from "./ProfitabilityTrillThree";
import { LinkedDocumentsCardWithOpen } from "./profitabilityTrillThree/LinkedDocumentsCardWithOpen";

export type ProfitabilityTrillTwoProps = {
  opened: boolean;
  onClose: () => void;
  onBack: () => void;
  job: ProfitabilityJob | null;
  dimension: BreakdownDimension;
  parentName: string;
  company: string;
  fromDate?: Date | null;
  toDate?: Date | null;
};

export default function ProfitabilityTrillTwo({
  opened,
  onClose,
  onBack,
  job,
  dimension,
  parentName,
  company,
  fromDate,
  toDate,
}: ProfitabilityTrillTwoProps) {
  const [detail, setDetail] = useState<JobProfitabilityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<JobLinkedDocument | null>(null);
  const [trillThreeOpened, setTrillThreeOpened] = useState(false);

  useEffect(() => {
    if (!opened) {
      setTrillThreeOpened(false);
      setSelectedDocument(null);
    }
  }, [opened]);

  useEffect(() => {
    if (!opened || !job) {
      setDetail(null);
      setError(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJobProfitabilityDetail(
          {
            company,
            job_id: job.id,
            date_from: fromDate
              ? dayjs(fromDate).format("YYYY-MM-DD")
              : dayjs().startOf("month").format("YYYY-MM-DD"),
            date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
          },
          job,
        );
        setDetail(data);
      } catch (err) {
        console.error("Error loading job profitability detail:", err);
        setError("Unable to load job P&L detail.");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [opened, job, company, fromDate, toDate]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={920}
      withCloseButton={false}
      padding={0}
      zIndex={400}
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
          <Box
            component="button"
            type="button"
            onClick={onBack}
            style={{
              background: PAGE_BG,
              border: `1px solid ${LINE}`,
              color: INK_3,
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: profitabilityTrillFonts.sans,
            }}
          >
            <IconArrowLeft size={14} stroke={1.75} />
            Back
          </Box>

          <Text fz={12} c={INK_3} style={{ flex: 1 }}>
            <Text span c={NAVY_600} fw={500}>
              {DIMENSION_CRUMB[dimension]}
            </Text>
            <Text span c={INK_4} mx={4}>
              ·
            </Text>
            <Text span c={NAVY_600} fw={500}>
              {parentName}
            </Text>
            <Text span c={INK_4} mx={4}>
              ›
            </Text>
            <Text span c={INK} fw={600}>
              {job?.id ?? "Job"}
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
          >
            <IconX size={18} stroke={1.75} />
          </Box>
        </Flex>

        <Box style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {loading ? (
            <Flex justify="center" align="center" mih={320}>
              <Loader color="#0f2744" />
            </Flex>
          ) : error ? (
            <Alert color="red" variant="light" radius="md">
              {error}
            </Alert>
          ) : detail ? (
            <>
              <JobDetailHeader detail={detail} />
              <JobDetailKpiCards detail={detail} />
              <JobPlTable detail={detail} />
              {/* <SimpleGrid cols={{ base: 1, md: 2 }} spacing={14} mt={14}>
                <LinkedDocumentsCardWithOpen
                  documents={detail.linkedDocuments}
                  onOpenDocument={(doc) => {
                    setSelectedDocument(doc);
                    setTrillThreeOpened(true);
                  }}
                />
                <MarginBridgeCard
                  items={detail.marginBridge}
                  commentary={detail.marginCommentary}
                />
              </SimpleGrid> */}
            </>
          ) : null}
        </Box>
      </Box>

      <ProfitabilityTrillThree
        opened={trillThreeOpened}
        onClose={() => {
          setTrillThreeOpened(false);
          setSelectedDocument(null);
        }}
        onBack={() => {
          setTrillThreeOpened(false);
          setSelectedDocument(null);
        }}
        document={selectedDocument}
        jobDetail={detail}
        jobId={job?.id ?? ""}
        dimension={dimension}
        parentName={parentName}
        company={company}
        fromDate={fromDate}
        toDate={toDate}
      />
    </Drawer>
  );
}
