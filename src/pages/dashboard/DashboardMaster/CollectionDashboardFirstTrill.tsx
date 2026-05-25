import { useEffect, useState } from "react";
import { Alert, Box, Drawer, Flex, Loader, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import {
  ERP_LIST_FONT_SANS,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components/ERPListPage/erpListGeistShell";
import { CollectionDrillSummaryCards } from "./collectionDashboardFirstTrill/CollectionDrillSummaryCards";
import { CollectionOutstandingInvoicesTable } from "./collectionDashboardFirstTrill/CollectionOutstandingInvoicesTable";
import {
  emptyCollectionBranchDrill,
  normalizeCollectionBranchDrill,
} from "./collectionDashboardFirstTrill/normalize";
import type { CollectionBranchDrillData } from "./collectionDashboardFirstTrill/types";
import {
  buildCollectionPerformanceRequest,
  fetchCollectionPerformance,
} from "./collectionTargetVsPerformance/collectionTargetVsPerformanceApi";
import type { BranchCollectionRow } from "./collectionTargetVsPerformance/collectionTargetVsPerformanceTypes";
import {
  COL_INK,
  COL_INK_3,
  COL_INK_4,
  COL_LINE,
  COL_PAGE_BG,
} from "./collectionTargetVsPerformance/theme";
import type { PendingActivitiesDateRange } from "./financePendingActivities/financePendingActivitiesApi";

export type CollectionDashboardFirstTrillProps = {
  opened: boolean;
  onClose: () => void;
  branch: BranchCollectionRow | null;
  company: string;
  dateRange: PendingActivitiesDateRange;
};

export default function CollectionDashboardFirstTrill({
  opened,
  onClose,
  branch,
  company,
  dateRange,
}: CollectionDashboardFirstTrillProps) {
  const [data, setData] = useState<CollectionBranchDrillData>(() =>
    emptyCollectionBranchDrill(branch?.branchName),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened || !branch) {
      setData(emptyCollectionBranchDrill(branch?.branchName));
      setError(null);
      return;
    }

    const branchCode = branch.branchCode ?? branch.id;
    if (!branchCode?.trim()) {
      setError("Branch code is missing for this row.");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const body = await fetchCollectionPerformance(
          buildCollectionPerformanceRequest(company, dateRange, {
            branchCode,
          }),
        );
        setData(
          normalizeCollectionBranchDrill(body, {
            branchName: branch.branchName,
            branchCode,
          }),
        );
      } catch {
        setData(emptyCollectionBranchDrill(branch.branchName));
        setError("Unable to load branch collection drill-down. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [opened, branch, company, dateRange]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="80%"
      withCloseButton={false}
      padding={0}
      zIndex={400}
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
          justify="space-between"
          px={22}
          py={12}
          style={{
            background: "#ffffff",
            borderBottom: `1px solid ${COL_LINE}`,
          }}
        >
          <Text fz={12} fw={600} c={COL_INK_3}>
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
          <Flex
            align="baseline"
            gap={12}
            wrap="wrap"
            mb={18}
            pb={14}
            style={{ borderBottom: `1px solid ${COL_LINE}` }}
          >
            <Text
              style={{
                fontSize: "clamp(18px, 2.5vw, 22px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: COL_INK,
                lineHeight: 1.2,
              }}
            >
              {data.title}
            </Text>
            <Text fz={12} c={COL_INK_4} style={{ maxWidth: 420, lineHeight: 1.45 }}>
              {data.subtitle}
            </Text>
          </Flex>

          {error ? (
            <Alert color="red" variant="light" radius="md" mb="md">
              {error}
            </Alert>
          ) : null}

          {loading && !data.invoices.length ? (
            <Flex justify="center" align="center" mih={280}>
              <Loader color="#0f2744" />
            </Flex>
          ) : (
            <>
              <CollectionDrillSummaryCards cards={data.summaryCards} loading={loading} />
              <CollectionOutstandingInvoicesTable invoices={data.invoices} loading={loading} />
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
