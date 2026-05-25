import { useEffect, useState } from "react";
import { Alert, Box, Drawer, Flex, Loader, SimpleGrid, Text } from "@mantine/core";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import type { BreakdownDimension } from "./accountsDashboardTypes";
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
import type { JobLinkedDocument } from "./profitabilityTrillTwo/types";
import type { JobProfitabilityDetail } from "./profitabilityTrillTwo/types";
import { ChargeLinesTable } from "./profitabilityTrillThree/ChargeLinesTable";
import { InvoiceDetailHeader } from "./profitabilityTrillThree/InvoiceDetailHeader";
import { PaymentTimelineCard } from "./profitabilityTrillThree/PaymentTimelineCard";
import { fetchInvoiceProfitabilityDetail } from "./profitabilityTrillThree/service";
import type { InvoiceProfitabilityDetail } from "./profitabilityTrillThree/types";

export type ProfitabilityTrillThreeProps = {
  opened: boolean;
  onClose: () => void;
  onBack: () => void;
  document: JobLinkedDocument | null;
  jobDetail: JobProfitabilityDetail | null;
  jobId: string;
  dimension: BreakdownDimension;
  parentName: string;
  company: string;
  fromDate?: Date | null;
  toDate?: Date | null;
};

export default function ProfitabilityTrillThree({
  opened,
  onClose,
  onBack,
  document,
  jobDetail,
  jobId,
  dimension,
  parentName,
  company,
  fromDate,
  toDate,
}: ProfitabilityTrillThreeProps) {
  const [detail, setDetail] = useState<InvoiceProfitabilityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened || !document?.invoiceId) {
      setDetail(null);
      setError(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const context = {
          invoiceId: document.invoiceId ?? document.id,
          jobId,
          customer: jobDetail?.customer ?? "—",
          documentLabel: document.label,
        };
        const data = await fetchInvoiceProfitabilityDetail(
          {
            company,
            invoice_id: context.invoiceId,
            job_id: jobId,
            date_from: fromDate
              ? dayjs(fromDate).format("YYYY-MM-DD")
              : dayjs().startOf("month").format("YYYY-MM-DD"),
            date_to: toDate ? dayjs(toDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
          },
          context,
          jobDetail,
          document,
        );
        setDetail(data);
      } catch (err) {
        console.error("Error loading invoice detail:", err);
        setError("Unable to load invoice detail.");
        setDetail(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [opened, document, jobDetail, jobId, company, fromDate, toDate]);

  const invoiceLabel = document?.invoiceId ?? document?.id ?? "Invoice";

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={920}
      withCloseButton={false}
      padding={0}
      zIndex={500}
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
            <Text span c={NAVY_600} fw={500}>
              {jobId}
            </Text>
            <Text span c={INK_4} mx={4}>
              ›
            </Text>
            <Text span c={INK} fw={600}>
              {invoiceLabel}
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
              <InvoiceDetailHeader detail={detail} />
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={14}>
                <ChargeLinesTable detail={detail} />
                <PaymentTimelineCard detail={detail} />
              </SimpleGrid>
            </>
          ) : null}
        </Box>
      </Box>
    </Drawer>
  );
}
