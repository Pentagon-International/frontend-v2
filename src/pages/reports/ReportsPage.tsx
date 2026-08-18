import { Box, Grid, Stack, Text } from "@mantine/core";
import {
  IconReceipt,
  IconFileAnalytics,
  IconBook2,
  IconReportMoney,
  IconShoppingCart,
  IconScale,
  IconChartBar,
  IconReport,
  IconChartArcs3,
  IconClockHour4,
  IconFileInvoice,
  IconReceiptTax,
  IconFileSpreadsheet,
} from "@tabler/icons-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MasterCard from "../../components/MasterCard";
import useAuthStore from "../../store/authStore";
import { isChinaDefaultBranch } from "./fapiaoReport/FapiaoReport";

type ReportItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showFapiaoReports = isChinaDefaultBranch(
    user?.branches,
    user?.country,
  );

  const sections: { title: string; items: ReportItem[] }[] = useMemo(() => [
    {
      title: "Accounting Report",
      items: [
        {
          label: "Job Profit",
          icon: <IconReportMoney size={28} color="#105476" />,
          path: "/reports/job-profit",
        },
        {
          label: "Statement of Accounts",
          icon: <IconReceipt size={28} color="#105476" />,
        },
        {
          label: "Job Ledger",
          icon: <IconBook2 size={28} color="#105476" />,
        },
        {
          label: "Subledger Outstanding",
          icon: <IconFileAnalytics size={28} color="#105476" />,
          path: "/reports/subledger-outstanding",
        },
        {
          label: "Aging Report",
          icon: <IconClockHour4 size={28} color="#105476" />,
          path: "/reports/aging-outstanding",
        },
        {
          label: "Purchase Register",
          icon: <IconShoppingCart size={28} color="#105476" />,
          path: "/reports/purchase-register",
        },
        {
          label: "GST Register Report",
          icon: <IconReceiptTax size={28} color="#105476" />,
          path: "/reports/gst-report",
        },
        {
          label: "OS Report- Document Wise",
          icon: <IconFileInvoice size={28} color="#105476" />,
          path: "/reports/document-wise-outstanding",
        },
        ...(showFapiaoReports
          ? [
              {
                label: "Fapiao Report - Cost",
                icon: <IconFileSpreadsheet size={28} color="#105476" />,
                path: "/reports/cost-fapiao-report",
              },
              {
                label: "Fapiao Report - Sell",
                icon: <IconFileSpreadsheet size={28} color="#105476" />,
                path: "/reports/sell-fapiao-report",
              },
            ]
          : []),
      ],
    },
    {
      title: "MIS Reports",
      items: [
        {
          label: "Balance Sheet",
          icon: <IconScale size={28} color="#105476" />,
        },
        {
          label: "Profit and Loss",
          icon: <IconChartBar size={28} color="#105476" />,
        },
        {
          label: "Trial Balance",
          icon: <IconReport size={28} color="#105476" />,
          path: "/reports/trial-balance",
        },
        {
          label: "Budget vs Actual",
          icon: <IconChartArcs3 size={28} color="#105476" />,
        },
      ],
    },
  ], [showFapiaoReports]);

  return (
    <Box h="100%">
      <Stack gap="lg">
        {sections.map((section) => (
          <Box key={section.title}>
            <Text
              mb="md"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#105476",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {section.title}
            </Text>
            <Grid gutter="md" columns={12}>
              {section.items.map((item) => (
                <Grid.Col key={item.label} span={{ base: 6, sm: 4, md: 3 }}>
                  <MasterCard
                    icon={item.icon}
                    label={item.label}
                    onClick={item.path ? () => navigate(item.path as string) : undefined}
                  />
                </Grid.Col>
              ))}
            </Grid>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

