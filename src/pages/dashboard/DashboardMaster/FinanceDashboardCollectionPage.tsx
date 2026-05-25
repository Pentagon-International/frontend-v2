import { Box } from "@mantine/core";
import { ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import CollectionTargetvsPerformanceDashboard from "./CollectionTargetvsPerformanceDashboard";

/** Finance Dashboard route — Collection Target vs Performance. */
export default function FinanceDashboardCollectionPage() {
  return (
    <Box
      className={ERP_LIST_GEIST_ROOT_CLASS}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "#f1f5f9",
        overflow: "hidden",
      }}
    >
      <Box style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <CollectionTargetvsPerformanceDashboard />
      </Box>
    </Box>
  );
}
