import { Box } from "@mantine/core";
import { ERP_LIST_GEIST_ROOT_CLASS } from "../../../components/ERPListPage/erpListGeistShell";
import FinanceOutstandingAndAgeingDashboard from "./FinanceOutstandingAndAgeingDashboard";

/** Finance Dashboard route — Outstanding & Ageing. */
export default function FinanceDashboardOutstandingPage() {
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
        <FinanceOutstandingAndAgeingDashboard />
      </Box>
    </Box>
  );
}
