import { Box, Grid, Stack, Text } from "@mantine/core";
import {
  IconReceipt,
  IconFileAnalytics,
  IconBook2,
  IconReportMoney,
  IconScale,
  IconChartBar,
  IconReport,
  IconChartArcs3,
  IconClockHour4,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import MasterCard from "../../components/MasterCard";

type ReportItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
};

export default function ReportsPage() {
  const navigate = useNavigate();

  const sections: { title: string; items: ReportItem[] }[] = [
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
        },
        {
          label: "Aging Outstanding",
          icon: <IconClockHour4 size={28} color="#105476" />,
          path: "/reports/aging-outstanding",
        },
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
  ];

  return (
    <Box h="100%">
      <Stack gap="lg">
        {sections.map((section) => (
          <Box key={section.title}>
            <Text size="sm" fw={600} c="#105476" mb="md">
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

