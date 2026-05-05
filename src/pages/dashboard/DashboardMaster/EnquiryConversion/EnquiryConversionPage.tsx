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

function mapQuotationFilterRowToDrilldown(
  row: Record<string, unknown>
): EnquiryDrilldownEnquiry {
  const quotationArr = Array.isArray(row.quotation)
    ? (row.quotation as Array<Record<string, unknown>>)
    : [];
  const quotations = quotationArr.map((q) => {
    const charges = Array.isArray(q.charges)
      ? (q.charges as Array<Record<string, unknown>>).map((c) => ({
          charge_name: String(c.charge_name ?? ""),
          unit: String(c.unit ?? ""),
          no_of_units:
            typeof c.no_of_units === "number"
              ? c.no_of_units
              : Number(c.no_of_units ?? 0),
          sell_per_unit: String(c.sell_per_unit ?? ""),
          total_sell: String(c.total_sell ?? ""),
          currency: String(c.currency ?? ""),
        }))
      : [];
    const cargo = Array.isArray(q.cargo_details)
      ? (q.cargo_details[0] as Record<string, unknown> | undefined)
      : undefined;
    return {
      quotation_id: String(q.quotation_id ?? ""),
      created_at: String(q.created_at ?? ""),
      quotation_services: [
        {
          total_sell: String(
            charges.reduce((s, c) => s + Number(c.total_sell ?? 0), 0) || ""
          ),
          quote_currency: String(q.quote_currency ?? "INR"),
          valid_upto: String(q.valid_upto ?? ""),
          charges,
          service_details: {
            service: String(q.service_type ?? q.service_name ?? ""),
            shipment_terms_code_read: String(q.shipment_terms_code ?? ""),
            shipment_terms_name: String(q.shipment_terms ?? ""),
            origin_code_read: String(q.origin_code ?? ""),
            destination_code_read: String(q.destination_code ?? ""),
            origin_name: String(q.origin ?? ""),
            destination_name: String(q.destination ?? ""),
            gross_weight:
              typeof cargo?.gross_weight === "number"
                ? cargo.gross_weight
                : Number(cargo?.gross_weight ?? 0) || undefined,
            no_of_packages:
              typeof cargo?.no_of_packages === "number"
                ? cargo.no_of_packages
                : Number(cargo?.no_of_packages ?? 0) || undefined,
            commodity:
              q.commodity == null ? null : String(q.commodity ?? ""),
          },
        },
      ],
    };
  });

  const firstQuote = quotationArr[0];
  const firstCargo = Array.isArray(firstQuote?.cargo_details)
    ? (firstQuote?.cargo_details?.[0] as Record<string, unknown> | undefined)
    : undefined;

  return {
    id: typeof row.id === "number" ? row.id : Number(row.id ?? 0) || undefined,
    enquiry_id: String(row.enquiry_id ?? ""),
    customer_name: String(row.customer_name ?? ""),
    customer_address: String(row.customer_address ?? ""),
    enquiry_received_date: String(row.enquiry_received_date ?? ""),
    sales_person: String(row.sales_person ?? ""),
    status: String(row.status ?? ""),
    services: firstQuote
      ? [
          {
            service: String(firstQuote.service_type ?? ""),
            service_name: String(firstQuote.service_name ?? ""),
            trade: String(firstQuote.trade ?? ""),
            shipment_terms_code_read: String(
              firstQuote.shipment_terms_code ?? ""
            ),
            shipment_terms_name: String(firstQuote.shipment_terms ?? ""),
            origin_code_read: String(firstQuote.origin_code ?? ""),
            destination_code_read: String(firstQuote.destination_code ?? ""),
            origin_name: String(firstQuote.origin ?? ""),
            destination_name: String(firstQuote.destination ?? ""),
            gross_weight:
              typeof firstCargo?.gross_weight === "number"
                ? firstCargo.gross_weight
                : Number(firstCargo?.gross_weight ?? 0) || undefined,
            no_of_packages:
              typeof firstCargo?.no_of_packages === "number"
                ? firstCargo.no_of_packages
                : Number(firstCargo?.no_of_packages ?? 0) || undefined,
            commodity:
              firstQuote.commodity == null
                ? null
                : String(firstQuote.commodity ?? ""),
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
    quotations,
  };
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
        | { data?: unknown[] }
        | undefined;
      const first = Array.isArray(body?.data)
        ? (body?.data?.[0] as Record<string, unknown> | undefined)
        : undefined;
      if (first) {
        setTopActiveDetailEnquiry(mapQuotationFilterRowToDrilldown(first));
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
