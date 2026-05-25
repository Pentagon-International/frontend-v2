import { useEffect, useState } from "react";
import { Alert, Box, Drawer, Flex, Loader, SimpleGrid, Text } from "@mantine/core";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import {
  ERP_LIST_FONT_SANS,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components/ERPListPage/erpListGeistShell";
import { ChargeLinesTable } from "./collectionDashboardSecondTrill/ChargeLinesTable";
import { InvoiceDetailHeader } from "./collectionDashboardSecondTrill/InvoiceDetailHeader";
import {
  emptyCollectionInvoiceDrill,
  normalizeCollectionInvoiceDrill,
} from "./collectionDashboardSecondTrill/normalize";
import { PaymentTimelineCard } from "./collectionDashboardSecondTrill/PaymentTimelineCard";
import type { CollectionInvoiceDrillData } from "./collectionDashboardSecondTrill/types";
import type { CollectionOutstandingInvoiceRow } from "./collectionDashboardFirstTrill/types";
import {
  fetchCollectionPerformance,
  getLastCollectionPerformanceRequest,
} from "./collectionTargetVsPerformance/collectionTargetVsPerformanceApi";
import {
  COL_INK,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
  COL_PAGE_BG,
} from "./collectionTargetVsPerformance/theme";

export type CollectionDashboardSecondTrillProps = {
  opened: boolean;
  onClose: () => void;
  onBack: () => void;
  invoice: CollectionOutstandingInvoiceRow | null;
  branchName?: string;
};

export default function CollectionDashboardSecondTrill({
  opened,
  onClose,
  onBack,
  invoice,
  branchName,
}: CollectionDashboardSecondTrillProps) {
  const [data, setData] = useState<CollectionInvoiceDrillData>(() =>
    emptyCollectionInvoiceDrill(invoice?.documentNo),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened || !invoice?.invoiceId) {
      setData(emptyCollectionInvoiceDrill(invoice?.documentNo));
      setError(null);
      return;
    }

    const baseRequest = getLastCollectionPerformanceRequest();
    if (!baseRequest) {
      setError("Session context is missing. Close and reopen the branch drill-down.");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const body = await fetchCollectionPerformance({
          ...baseRequest,
          invoice_id: invoice.invoiceId,
        });
        setData(
          normalizeCollectionInvoiceDrill(body, {
            documentNo: invoice.documentNo,
            branchName,
          }),
        );
      } catch {
        setData(emptyCollectionInvoiceDrill(invoice.documentNo));
        setError("Unable to load invoice detail. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [opened, invoice, branchName]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="80%"
      withCloseButton={false}
      padding={0}
      zIndex={500}
      overlayProps={{ opacity: 0.35, blur: 0 }}
      transitionProps={{ transition: "slide-left", duration: 220 }}
      classNames={{ content: ERP_LIST_GEIST_ROOT_CLASS }}
      styles={{
        content: {
          background: "#ffffff",
          boxShadow: "-16px 0 40px rgba(15, 23, 42, 0.18)",
          fontFamily: ERP_LIST_FONT_SANS,
        },
        body: { padding: 0, height: "100%" },
      }}
    >
      <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Flex
          align="center"
          gap={14}
          px={22}
          py={12}
          style={{
            background: "#ffffff",
            borderBottom: `1px solid ${COL_LINE}`,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={onBack}
            style={{
              background: COL_PAGE_BG,
              border: `1px solid ${COL_LINE}`,
              color: COL_INK_3,
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: ERP_LIST_FONT_SANS,
            }}
          >
            <IconArrowLeft size={14} stroke={1.75} />
            Back
          </Box>

          <Text fz={12} c={COL_INK_3} style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
            {data.breadcrumb}
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
              color: COL_INK_3,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IconX size={18} stroke={1.75} />
          </Box>
        </Flex>

        <Box
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 22px 28px",
            background: COL_PAGE_BG,
          }}
        >
          {loading ? (
            <Flex justify="center" align="center" mih={320}>
              <Loader color="#0f2744" />
            </Flex>
          ) : error ? (
            <Alert color="red" variant="light" radius="md">
              {error}
            </Alert>
          ) : (
            <>
              <InvoiceDetailHeader detail={data} />
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={14}>
                <ChargeLinesTable detail={data} />
                <PaymentTimelineCard detail={data} />
              </SimpleGrid>
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
