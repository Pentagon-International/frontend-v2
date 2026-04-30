import { Stack, Box, Loader, Center } from "@mantine/core";
import type {
  EnquiryConversionAggregatedData,
  EnquiryConversionOverviewMeta,
} from "../../../service/dashboard.service";
import {
  SegmentedFunnelBar,
  buildEnquiryConversionSegments,
  ConversionMetricStrip,
  type ConversionMetricStripColumn,
} from "./EnquiryConversion";

function formatWonMoMCaption(meta?: EnquiryConversionOverviewMeta | null): {
  text: string;
  captionColor?: string;
  captionFw?: number;
} {
  const pct = meta?.gainMoMChangePctDisplay;
  if (!pct) {
    return { text: "— MoM", captionColor: "#64748B", captionFw: 400 };
  }
  const dir = meta?.gainMoMDirection;
  const arrow =
    dir === "decrease" ? "▼" : dir === "increase" ? "▲" : "";
  const color =
    dir === "decrease"
      ? "#DC2626"
      : dir === "increase"
        ? "#15803D"
        : "#64748B";
  const text = [arrow, pct, "MoM"].filter(Boolean).join(" ").trim();
  return { text, captionColor: color, captionFw: 600 };
}

interface EnquiryProps {
  enquiryConversionAggregatedData: EnquiryConversionAggregatedData;
  /** Sub-line copy + WON MoM from `enquiry/enquiryconversion/` `summary` */
  enquiryConversionOverviewMeta?: EnquiryConversionOverviewMeta | null;
  isLoadingEnquiryConversion: boolean;
  isLoadingEnquiryChart: boolean;
  /** KPI row + funnel open the Enquiry Conversion module (same as header arrow). */
  onOpenDetailModule?: () => void;
}

const FUNNEL_BAR_HEIGHT = 28;

const Enquiry = ({
  enquiryConversionAggregatedData,
  enquiryConversionOverviewMeta,
  isLoadingEnquiryConversion,
  isLoadingEnquiryChart,
  onOpenDetailModule,
}: EnquiryProps) => {
  const data = enquiryConversionAggregatedData;
  const meta = enquiryConversionOverviewMeta;

  const quotedCaption = meta?.quoteCreatedPctDisplay?.length
    ? `${meta.quoteCreatedPctDisplay} of Total`
    : `${data.quotePercentage.toFixed(1)}% of Total`;

  const lostCaption = 
  // meta?.lostRowPctDisplay?.length
  //   ? `${meta.lostRowPctDisplay} vs won`
  //   :
     data.totalGain > 0
      ? `${((data.totalLost / data.totalGain) * 100).toFixed(1)}% vs won`
      : data.totalEnquiries > 0
        ? `${((data.totalLost / data.totalEnquiries) * 100).toFixed(1)}% of enquiries`
        : "0.0% vs won";

  const wonMoM = formatWonMoMCaption(meta);

  const funnelSegments = buildEnquiryConversionSegments(data);

  const metricColumns: ConversionMetricStripColumn[] = [
    {
      key: "quoted",
      label: "QUOTED",
      value: data.totalQuoteCreated,
      valueColor: "#0F172A",
      caption: quotedCaption,
    },
    {
      key: "won",
      label: "WON",
      value: data.totalGain,
      valueColor: "#15803D",
      caption: wonMoM.text,
      captionColor: wonMoM.captionColor,
      captionFw: wonMoM.captionFw,
    },
    {
      key: "lost",
      label: "LOST",
      value: data.totalLost,
      valueColor: "#0F172A",
      caption: lostCaption,
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
