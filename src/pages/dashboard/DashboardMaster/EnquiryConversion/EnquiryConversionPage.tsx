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
import dayjs from "dayjs";
import { ERPListToolbar } from "../../../../components";
import { apiCallProtected } from "../../../../api/axios";
import { URL } from "../../../../api/serverUrls";
import { MetricTrendCard } from "./MetricTrendCard";
import { StageFunnelCard, type StageFunnelRow } from "./StageFunnelCard";
import { ClickableByModeValueCard } from "./ClickableByModeValueCard";
import type { ModeLegendRow } from "./ByModeValueCard";
import { ConversionByModeDetails } from "./ConversionByModeDetails";
import { ConversionByRepCard, type RepBarRow } from "./ConversionByRepCard";
import { EnquiryConversionSendEmailModal } from "./EnquiryConversionSendEmailModal";
import {
  TopActiveEnquiriesTable,
  type EnquiryRow,
} from "./TopActiveEnquiriesTable";
import { TopActiveEnquirySendEmailModal } from "./TopActiveEnquirySendEmailModal";
import {
  EnquiryConversionFilters,
  type EnquiryConversionPageFilters,
} from "./EnquiryConversionFilters";
import {
  buildEnquiryConversionMetrics,
  buildStageFunnelRowsFromDashboard,
  buildModeCardFromDashboard,
  buildRepRowsFromDashboard,
  buildTopEnquiryRowsFromDashboard,
  formatEnquiryConversionPageSubtitle,
} from "./enquiryConversionDashboardMappers";
import { useEnquiryConversionDashboard } from "./useEnquiryConversionDashboard";
import { enquiryConversionColors } from "./enquiryConversionTokens";
import useAuthStore from "../../../../store/authStore";
import {
  EnquiryconversionSummarydetail,
  type EnquiryConversionSummaryMetricLabel,
} from "./EnquiryconversionSummarydetail";
import { StageFunnelDetails } from "./StageFunnelDetails";
import { ConversionByRepSummary } from "./ConversionByRepSummary";
import { ConversionByRepCustomerwiseEnquiryDetails } from "./ConversionByRepCustomerwiseEnquiryDetails";
import { ConversionByRepCustomerwiseEnquiryList } from "./ConversionByRepCustomerwiseEnquiryList";
import type { EnquiryDrilldownEnquiry } from "../../../../service/dashboard.service";

const REP_PAGE_SIZE = 5;
const ERP_FONT_SANS = "'Geist', sans-serif";

function mapEnquiryFilterRowToDrilldown(
  row: Record<string, unknown>,
  extra?: { filterDateFrom?: string; filterDateTo?: string }
): EnquiryDrilldownEnquiry {
  const servicesArr = Array.isArray(row.services)
    ? (row.services as Array<Record<string, unknown>>)
    : [];
  const s0 = servicesArr[0];

  const fclDetails = Array.isArray(s0?.fcl_details)
    ? (s0?.fcl_details as Array<Record<string, unknown>>).map((c) => ({
        container_type: c.container_type == null ? undefined : String(c.container_type),
        container_name: c.container_name == null ? undefined : String(c.container_name),
        no_of_containers:
          typeof c.no_of_containers === "number"
            ? c.no_of_containers
            : c.no_of_containers == null
              ? undefined
              : String(c.no_of_containers),
      }))
    : undefined;

  return {
    id: typeof row.id === "number" ? row.id : Number(row.id ?? 0) || undefined,
    enquiry_id: String(row.enquiry_id ?? ""),
    customer_name: String(row.customer_name ?? ""),
    customer_address: String(row.customer_address ?? ""),
    enquiry_received_date: String(row.enquiry_received_date ?? ""),
    sales_person: String(row.sales_person ?? ""),
    sales_coordinator: String(row.sales_coordinator ?? ""),
    status: String(row.status ?? ""),
    services: s0
      ? [
          {
            service: String(s0.service ?? ""),
            service_name: String(s0.service_name ?? ""),
            trade: String(s0.trade ?? ""),
            shipment_terms_code_read: String(s0.shipment_terms_code_read ?? ""),
            shipment_terms_name: String(s0.shipment_terms_name ?? ""),
            origin_code_read: String(s0.origin_code_read ?? ""),
            destination_code_read: String(s0.destination_code_read ?? ""),
            origin_name: String(s0.origin_name ?? ""),
            destination_name: String(s0.destination_name ?? ""),
            gross_weight:
              s0.gross_weight == null ? undefined : (s0.gross_weight as string | number),
            no_of_packages:
              typeof s0.no_of_packages === "number"
                ? s0.no_of_packages
                : Number(s0.no_of_packages ?? 0) || undefined,
            commodity: s0.commodity == null ? null : String(s0.commodity ?? ""),
            fcl_details: fclDetails,
          },
        ]
      : [],
    origin_list: Array.isArray(row.origin_list) ? (row.origin_list as string[]) : [],
    destination_list: Array.isArray(row.destination_list)
      ? (row.destination_list as string[])
      : [],
    origin_code_list: Array.isArray(row.origin_code_list)
      ? (row.origin_code_list as string[])
      : [],
    destination_code_list: Array.isArray(row.destination_code_list)
      ? (row.destination_code_list as string[])
      : [],
    ...(extra?.filterDateFrom ? { __filterDateFrom: extra.filterDateFrom } : null),
    ...(extra?.filterDateTo ? { __filterDateTo: extra.filterDateTo } : null),
  } as EnquiryDrilldownEnquiry & { __filterDateFrom?: string; __filterDateTo?: string };
}

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
  const [detailMetric, setDetailMetric] =
    useState<EnquiryConversionSummaryMetricLabel | null>(null);
  const [funnelStageRow, setFunnelStageRow] = useState<StageFunnelRow | null>(
    null
  );
  const [repSummarySalesperson, setRepSummarySalesperson] = useState<
    string | null
  >(null);
  const [repSummaryApiType, setRepSummaryApiType] = useState<string | null>(null);
  const [topActiveDetailEnquiry, setTopActiveDetailEnquiry] =
    useState<EnquiryDrilldownEnquiry | null>(null);
  const [modeDetailRow, setModeDetailRow] = useState<ModeLegendRow | null>(null);
  const [modeCustomerList, setModeCustomerList] = useState<{
    customerCode: string;
    customerName: string;
    salesperson?: string | null;
  } | null>(null);
  const [repEmailRow, setRepEmailRow] = useState<RepBarRow | null>(null);
  const [topEnquiryEmailRow, setTopEnquiryEmailRow] =
    useState<EnquiryRow | null>(null);

  useEffect(() => {
    if (modeDetailRow === null) setModeCustomerList(null);
  }, [modeDetailRow]);

  useEffect(() => {
    setRepPage(1);
  }, [
    filters.fromDate,
    filters.toDate,
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
  const topRows = useMemo(
    () => buildTopEnquiryRowsFromDashboard(data),
    [data]
  );
  const subtitle = formatEnquiryConversionPageSubtitle(data);

  const showBusy = (isLoading || isFetching) && !data;

  const handleTopActiveRowClick = async (row: EnquiryRow) => {
    if (!filters.fromDate || !filters.toDate || !row.enquiryCode?.trim()) {
      setTopActiveDetailEnquiry(row.drilldownEnquiry);
      return;
    }
    try {
      const payload = {
        filters: {
          date_from: dayjs(filters.fromDate).format("YYYY-MM-DD"),
          date_to: dayjs(filters.toDate).format("YYYY-MM-DD"),
          enquiry_id: row.enquiryCode.trim(),
        },
      };
      // const res = await apiCallProtected.post(URL.quotationFilter, payload);
      const res = await apiCallProtected.post(URL.enquiryFilter, payload);
      const body = (res as { data?: unknown }).data as
        | { data?: unknown[]; results?: unknown[] }
        | unknown[]
        | undefined;
      const list = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body?.data
          : Array.isArray(body?.results)
            ? body?.results
            : [];
      const first =
        Array.isArray(list) && list.length > 0
          ? (list[0] as Record<string, unknown>)
          : undefined;
      if (first) {
        setTopActiveDetailEnquiry(
          mapEnquiryFilterRowToDrilldown(first, {
            filterDateFrom: dayjs(filters.fromDate).format("YYYY-MM-DD"),
            filterDateTo: dayjs(filters.toDate).format("YYYY-MM-DD"),
          })
        );
        return;
      }
    } catch {
      // keep existing fallback behavior on API failure
    }
    setTopActiveDetailEnquiry(row.drilldownEnquiry);
  };

  return (
    <Box
      bg="#F9FAFB"
      mx={{ base: -12, sm: -16, lg: -24 }}
      // px={{ base: 12, sm: 16, lg: 20 }}
      // py={{ base: 12, sm: 16, lg: 24 }}
      mih={520}
      style={{
        fontFamily: ERP_FONT_SANS,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <Stack gap="md">
        <ERPListToolbar
          bleed={false}
          leading={
            <Box style={{ minWidth: 0 ,paddingLeft: 10, paddingRight: 10 }}>
              {/* <Text fz={11} fw={600} c="#7B8DA5" mb={5} style={{ lineHeight: 1.35 }}>
                Pentagon Freight › Sales › Enquiry Conversion
              </Text> */}
              <Text
                // fw={700}
                c="#111827"
                style={{
                  fontSize: "clamp(14px, 5vw, 20px)",
                  lineHeight: 1.08,
                  fontFamily: "Geist", 
                  fontWeight:'550'
                }}
                mb={4}
              >
                Enquiry Conversion
              </Text>
              <Text fz={11} fw={600} c="#8AA0B9" style={{ lineHeight: 1.4 }}>
                {subtitle}
              </Text>
            </Box>
          }
          actions={
            <Box style={{ minWidth: isCompact ? 300 : 360 }}>
              <Group justify={isCompact ? "stretch" : "flex-end"} wrap="wrap" gap={8} w="100%">
                <EnquiryConversionFilters filters={filters} onFiltersChange={setFilters} />
              </Group>
            </Box>
          }
        />

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
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={{ base: "sm", sm: "md" }} style={{ paddingLeft: 10, paddingRight: 10 }}>
              {metrics.map((m) => (
                <MetricTrendCard
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  trend={m.trend}
                  trendLabel={m.trendLabel}
                  onClick={() =>
                    setDetailMetric(m.label as EnquiryConversionSummaryMetricLabel)
                  }
                />
              ))}
            </SimpleGrid>

            <Grid gutter={{ base: 10, sm: 16 }} style={{ paddingLeft: 10, paddingRight: 10 }}>
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
                    onFunnelRowClick={(row) => setFunnelStageRow(row)}
                  />
                  <Box
                    style={{
                      borderTop: "1px solid #E9ECEF",
                    }}
                  >
                    <ClickableByModeValueCard
                      title="BY MODE"
                      segments={modeSegments}
                      rows={modeRows}
                      embeddedBelowFunnel
                      onRowClick={(row) => setModeDetailRow(row)}
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
                      // benchmarkPercent={benchmark}
                      rows={repRowsPage}
                      onRepRowClick={(row) => {
                        setRepSummarySalesperson(row.name);
                        setRepSummaryApiType(null);
                      }}
                      onRepSendEmailClick={(row) => setRepEmailRow(row)}
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
                      onRowClick={handleTopActiveRowClick}
                      onSendEmailClick={(row) => setTopEnquiryEmailRow(row)}
                    />
                  </Box>
                </Stack>
              </Grid.Col>
            </Grid>
          </>
        )}
      </Stack>
      <EnquiryconversionSummarydetail
        opened={detailMetric !== null}
        onClose={() => setDetailMetric(null)}
        metric={detailMetric}
        company={company}
        filters={filters}
      />
      <StageFunnelDetails
        opened={funnelStageRow !== null}
        onClose={() => setFunnelStageRow(null)}
        stageRow={funnelStageRow}
        company={company}
        filters={filters}
        onRepRowClick={(name, apiType) => {
          setRepSummarySalesperson(name);
          setRepSummaryApiType(apiType);
        }}
      />
      <ConversionByRepSummary
        opened={repSummarySalesperson !== null}
        onClose={() => {
          setRepSummarySalesperson(null);
          setRepSummaryApiType(null);
        }}
        salesperson={repSummarySalesperson}
        apiType={repSummaryApiType}
        company={company}
        filters={filters}
      />
      <EnquiryConversionSendEmailModal
        opened={repEmailRow !== null}
        onClose={() => setRepEmailRow(null)}
        row={repEmailRow}
      />
      <TopActiveEnquirySendEmailModal
        opened={topEnquiryEmailRow !== null}
        onClose={() => setTopEnquiryEmailRow(null)}
        row={topEnquiryEmailRow}
      />
      <ConversionByModeDetails
        opened={modeDetailRow !== null}
        onClose={() => setModeDetailRow(null)}
        modeRow={modeDetailRow}
        company={company}
        filters={filters}
        onOpenCustomerEnquiryList={(p) => setModeCustomerList(p)}
        onOpenEnquiryDetail={(enquiry) => setTopActiveDetailEnquiry(enquiry)}
      />
      <ConversionByRepCustomerwiseEnquiryList
        opened={modeCustomerList !== null}
        onClose={() => setModeCustomerList(null)}
        salesperson={
          modeCustomerList?.salesperson?.trim() ||
          filters.salesperson?.trim() ||
          null
        }
        company={company}
        filters={
          modeCustomerList !== null
            ? { ...filters, type: null, service: null }
            : filters
        }
        customerCode={modeCustomerList?.customerCode ?? null}
        customerName={modeCustomerList?.customerName ?? ""}
      />
      <ConversionByRepCustomerwiseEnquiryDetails
        opened={topActiveDetailEnquiry !== null}
        onClose={() => setTopActiveDetailEnquiry(null)}
        enquiry={topActiveDetailEnquiry}
        salesperson={filters.salesperson?.trim() || "All reps"}
        customerName={
          topActiveDetailEnquiry?.customer_name?.trim() ?? "—"
        }
      />
    </Box>
  );
}
