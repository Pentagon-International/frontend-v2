import { Box, Text, Stack, SimpleGrid, Group } from "@mantine/core";
import { MetricTrendCard } from "./MetricTrendCard";
import { StageFunnelCard } from "./StageFunnelCard";
import { ByModeValueCard } from "./ByModeValueCard";
import { ConversionByRepCard } from "./ConversionByRepCard";
import { TopActiveEnquiriesTable } from "./TopActiveEnquiriesTable";
import { EnquiryConversionFilters } from "./EnquiryConversionFilters";
import {
  demoMetricStrip,
  demoStageFunnelRows,
  demoModeSegments,
  demoModeRows,
  demoRepRows,
  demoEnquiryRows,
} from "./demoData";
import { enquiryConversionColors } from "./enquiryConversionTokens";

export default function EnquiryConversionPage() {
  return (
    <Box
      style={{
        background: enquiryConversionColors.pageBg,
        margin: "-16px -24px",
        padding: "20px 24px 32px",
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Box>
            <Text fw={700} fz={24} c={enquiryConversionColors.heading}>
              Enquiry Conversion
            </Text>
            <Text size="sm" c="#64748B" mt={6}>
              Pipeline · 284 enquiries · ₹14.2 Cr total value
            </Text>
          </Box>
          <EnquiryConversionFilters />
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <MetricTrendCard
            label="NEW"
            value={demoMetricStrip.newCount}
            trend="up"
            trendLabel={demoMetricStrip.newTrend}
          />
          <MetricTrendCard
            label="QUOTE RATE"
            value={demoMetricStrip.quoteRate}
            trend="up"
            trendLabel={demoMetricStrip.quoteTrend}
          />
          <MetricTrendCard
            label="WIN RATE"
            value={demoMetricStrip.winRate}
            trend="up"
            trendLabel={demoMetricStrip.winTrend}
          />
          <MetricTrendCard
            label="AVG. DEAL SIZE"
            value={demoMetricStrip.avgDeal}
            trend="down"
            trendLabel={demoMetricStrip.avgDealTrend}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Stack gap="md">
            <StageFunnelCard
              title="Stage Funnel"
              subtitle="Conversion at each stage"
              rows={demoStageFunnelRows}
            />
            <ByModeValueCard
              title="BY MODE · ₹ VALUE"
              segments={demoModeSegments}
              rows={demoModeRows}
            />
          </Stack>
          <Stack gap="md">
            <ConversionByRepCard
              title="Conversion by Rep"
              subtitle="Win rate — last 30 days"
              benchmarkPercent={42}
              rows={demoRepRows}
            />
            <TopActiveEnquiriesTable
              title="Top Active Enquiries"
              subtitle="By expected value"
              rows={demoEnquiryRows}
            />
          </Stack>
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
