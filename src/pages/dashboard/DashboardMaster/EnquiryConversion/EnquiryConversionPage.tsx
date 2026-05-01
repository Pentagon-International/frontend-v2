import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Text,
  Stack,
  SimpleGrid,
  Grid,
  Group,
  Center,
  Loader,
  Alert,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useLocation } from "react-router-dom";
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
const ERP_FONT_SANS = "'Geist', sans-serif";

function monthStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

function parseDateFromState(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function EnquiryConversionPage() {
  const location = useLocation();
  const { user } = useAuthStore();
  const isCompact = useMediaQuery("(max-width: 48em)");
  const company =
    user?.company?.company_name?.trim() || "PENTAGON INDIA";

  const initialFromDate =
    parseDateFromState(
      (location.state as { fromDate?: unknown } | null)?.fromDate
    ) ?? monthStart();
  const initialToDate =
    parseDateFromState((location.state as { toDate?: unknown } | null)?.toDate) ??
    new Date();

  const [filters, setFilters] = useState<EnquiryConversionPageFilters>({
    fromDate: initialFromDate,
    toDate: initialToDate,
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
      bg="#F9FAFB"
      mx={{ base: -12, sm: -16, lg: -24 }}
      px={{ base: 12, sm: 16, lg: 20 }}
      py={{ base: 12, sm: 16, lg: 24 }}
      mih={520}
      style={{
        fontFamily: ERP_FONT_SANS,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap={8}>
          <Box style={{ flex: "1 1 280px", minWidth: 0 }}>
            <Text fz={11} fw={600} c="#7B8DA5" mb={5} style={{ lineHeight: 1.35 }}>
              Pentagon Freight › Sales › Enquiry Conversion
            </Text>
            <Text
              fw={700}
              c="#111827"
              style={{
                fontSize: "clamp(24px, 5vw, 40px)",
                lineHeight: 1.08,
              }}
              mb={4}
            >
              Enquiry Conversion
            </Text>
            <Text fz={11} fw={600} c="#8AA0B9" style={{ lineHeight: 1.4 }}>
              {subtitle}
            </Text>
          </Box>
          <Box style={{ flex: "1 1 300px", minWidth: 0, width: "100%" }}>
            <Group justify={isCompact ? "stretch" : "flex-end"} wrap="wrap" gap={8} w="100%">
              <EnquiryConversionFilters filters={filters} onFiltersChange={setFilters} />
            </Group>
          </Box>
        </Group>

        {error ? (
          <Alert color="red" variant="light" radius="md" title="Unable to load data">
            {(error as Error).message ?? "Request failed"}
            {" · "}
            <Text
              span
              c="#105476"
              fw={600}
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => refetch()}
            >
              Retry
            </Text>
          </Alert>
        ) : null}

        {showBusy ? (
          <Center h={320}>
            <Loader size="lg" color="#101C2E" />
          </Center>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={{ base: "sm", sm: "md" }}>
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

            <Grid gutter={{ base: 10, sm: 16 }}>
              <Grid.Col span={{ base: 12, lg: 7 }}>
                <Box
                  style={{
                    background: enquiryConversionColors.panelBg,
                    border: "1px solid #E9ECEF",
                    borderRadius: 8,
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    overflow: "hidden",
                  }}
                >
                  <StageFunnelCard
                    title="Stage Funnel"
                    subtitle="Conversion at each stage"
                    rows={stageRows}
                    embeddedAboveModeSection
                  />
                  <Box
                    style={{
                      borderTop: "1px solid #E9ECEF",
                    }}
                  >
                    <ByModeValueCard
                      title="BY MODE"
                      segments={modeSegments}
                      rows={modeRows}
                      embeddedBelowFunnel
                    />
                  </Box>
                </Box>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, lg: 5 }}>
                <Stack gap="md" h="100%">
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <ConversionByRepCard
                      title="Conversion by Rep"
                      subtitle="Gained % · Gained/Total Enquiry"
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
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <TopActiveEnquiriesTable
                      title="Top Active Enquiries"
                      subtitle="By expected value"
                      rows={topRows}
                    />
                  </Box>
                </Stack>
              </Grid.Col>
            </Grid>
          </>
        )}
      </Stack>
    </Box>
  );
}
