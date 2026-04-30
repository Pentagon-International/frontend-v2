import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Text,
  Stack,
  SimpleGrid,
  Group,
  Center,
  Loader,
  Alert,
} from "@mantine/core";
import { MetricTrendCard } from "./MetricTrendCard";
import { StageFunnelCard } from "./StageFunnelCard";
import { ByModeValueCard } from "./ByModeValueCard";
import { ConversionByRepCard } from "./ConversionByRepCard";
import { TopActiveEnquiriesTable } from "./TopActiveEnquiriesTable";
import {
  EnquiryConversionFilters,
  type EnquiryConversionPageFilters,
} from "./EnquiryConversionFilters";
import {
  buildEnquiryConversionMetrics,
  buildStageFunnelRowsFromDashboard,
  buildModeCardFromDashboard,
  buildRepRowsFromDashboard,
  meanRepBenchmarkPercent,
  buildTopEnquiryRowsFromDashboard,
  formatEnquiryConversionPageSubtitle,
} from "./enquiryConversionDashboardMappers";
import { useEnquiryConversionDashboard } from "./useEnquiryConversionDashboard";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import useAuthStore from "../../../../store/authStore";

const REP_PAGE_SIZE = 5;

function monthStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

export default function EnquiryConversionPage() {
  const { user } = useAuthStore();
  const company =
    user?.company?.company_name?.trim() || "PENTAGON INDIA";

  const [filters, setFilters] = useState<EnquiryConversionPageFilters>({
    fromDate: monthStart(),
    toDate: new Date(),
    type: null,
    service: null,
    salesperson: "",
  });

  const [repPage, setRepPage] = useState(1);

  useEffect(() => {
    setRepPage(1);
  }, [
    filters.fromDate?.toISOString(),
    filters.toDate?.toISOString(),
    filters.type,
    filters.service,
    filters.salesperson,
    company,
  ]);

  const { data, isLoading, isFetching, error, refetch } =
    useEnquiryConversionDashboard({ company, filters });

  const metrics = useMemo(() => buildEnquiryConversionMetrics(data), [data]);
  const stageRows = useMemo(
    () => buildStageFunnelRowsFromDashboard(data),
    [data]
  );
  const { segments: modeSegments, rows: modeRows } = useMemo(
    () => buildModeCardFromDashboard(data),
    [data]
  );
  const repRowsAll = useMemo(
    () => buildRepRowsFromDashboard(data),
    [data]
  );
  const repTotalPages = Math.max(
    1,
    Math.ceil(repRowsAll.length / REP_PAGE_SIZE)
  );
  const repPageClamped = Math.min(repPage, repTotalPages);
  const repRowsPage = useMemo(() => {
    const start = (repPageClamped - 1) * REP_PAGE_SIZE;
    return repRowsAll.slice(start, start + REP_PAGE_SIZE);
  }, [repRowsAll, repPageClamped]);
  const benchmark = useMemo(
    () => meanRepBenchmarkPercent(repRowsAll),
    [repRowsAll]
  );
  const topRows = useMemo(
    () => buildTopEnquiryRowsFromDashboard(data),
    [data]
  );
  const subtitle = formatEnquiryConversionPageSubtitle(data);

  const showBusy = (isLoading || isFetching) && !data;

  return (
    <Box
      style={{
        background: enquiryConversionColors.pageBg,
        margin: "-16px -24px",
        padding: "20px 24px 32px",
        minHeight: 480,
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Box style={{ flex: "1 1 220px" }}>
            <Text fw={700} fz={24} c={enquiryConversionColors.heading}>
              Enquiry Conversion
            </Text>
            <Text size="sm" c="#64748B" mt={6}>
              {subtitle}
              {company ? ` · ${company}` : ""}
            </Text>
          </Box>
          <EnquiryConversionFilters filters={filters} onFiltersChange={setFilters} />
        </Group>

        {error ? (
          <Alert color="red" title="Unable to load data">
            {(error as Error).message ?? "Request failed"}
            {" · "}
            <Text
              span
              c="#105476"
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => refetch()}
            >
              Retry
            </Text>
          </Alert>
        ) : null}

        {showBusy ? (
          <Center h={280}>
            <Loader size="lg" color="#105476" />
          </Center>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              {metrics.map((m) => (
                <MetricTrendCard
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  trend={m.trend}
                  trendLabel={m.trendLabel}
                />
              ))}
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <Stack gap="md">
                <StageFunnelCard
                  title="Stage Funnel"
                  subtitle="Conversion at each stage"
                  rows={stageRows}
                />
                <ByModeValueCard
                  title="BY MODE · ₹ VALUE"
                  segments={modeSegments}
                  rows={modeRows}
                />
              </Stack>
              <Stack gap="md">
                <ConversionByRepCard
                  title="Conversion by Rep"
                  subtitle="Win rate — last 30 days"
                  benchmarkPercent={benchmark}
                  rows={repRowsPage}
                  pagination={
                    repTotalPages > 1
                      ? {
                          page: repPageClamped,
                          totalPages: repTotalPages,
                          onChange: setRepPage,
                        }
                      : undefined
                  }
                />
                <TopActiveEnquiriesTable
                  title="Top Active Enquiries"
                  subtitle="By expected value"
                  rows={topRows}
                />
              </Stack>
            </SimpleGrid>
          </>
        )}
      </Stack>
    </Box>
  );
}
