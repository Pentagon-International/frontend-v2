import { Stack, Box, Loader, Center } from "@mantine/core";
import { EnquiryConversionAggregatedData } from "../../../service/dashboard.service";
import {
  SegmentedFunnelBar,
  buildEnquiryConversionSegments,
  ConversionMetricStrip,
  type ConversionMetricStripColumn,
} from "./EnquiryConversion";

interface EnquiryProps {
  enquiryConversionAggregatedData: EnquiryConversionAggregatedData;
  isLoadingEnquiryConversion: boolean;
  isLoadingEnquiryChart: boolean;
  /** KPI row + funnel open the Enquiry Conversion module (same as header arrow). */
  onOpenDetailModule?: () => void;
}

const FUNNEL_BAR_HEIGHT = 26;

const Enquiry = ({
  enquiryConversionAggregatedData,
  isLoadingEnquiryConversion,
  isLoadingEnquiryChart,
  onOpenDetailModule,
}: EnquiryProps) => {
  const data = enquiryConversionAggregatedData;
  const quotedPctOfNew =
    data.totalEnquiries > 0
      ? (data.totalQuoteCreated / data.totalEnquiries) * 100
      : 0;
  const lostVsWonPct =
    data.totalGain > 0 ? (data.totalLost / data.totalGain) * 100 : 0;

  const funnelSegments = buildEnquiryConversionSegments(data);

  const metricColumns: ConversionMetricStripColumn[] = [
    {
      key: "quoted",
      label: "QUOTED",
      value: data.totalQuoteCreated,
      valueColor: "#0F172A",
      caption: `${quotedPctOfNew.toFixed(1)}% of new`,
    },
    {
      key: "won",
      label: "WON",
      value: data.totalGain,
      valueColor: "#15803D",
      caption: "▲ +14 MoM",
      captionColor: "#15803D",
      captionFw: 600,
    },
    {
      key: "lost",
      label: "LOST",
      value: data.totalLost,
      valueColor: "#0F172A",
      caption: `${lostVsWonPct.toFixed(1)}% vs won`,
    },
  ];

  return (
    <Box>
      {isLoadingEnquiryConversion || isLoadingEnquiryChart ? (
        <Center h="70%">
          <Loader size="lg" color="#105476" />
        </Center>
      ) : (
        <Stack gap="md" pt={4}>
          <ConversionMetricStrip
            columns={metricColumns}
            onActivate={onOpenDetailModule}
          />

          <Box
            style={{ cursor: onOpenDetailModule ? "pointer" : undefined }}
            onClick={onOpenDetailModule}
          >
            <SegmentedFunnelBar
              segments={funnelSegments}
              height={FUNNEL_BAR_HEIGHT}
            />
          </Box>
        </Stack>
      )}
    </Box>
  );
};

export default Enquiry;
