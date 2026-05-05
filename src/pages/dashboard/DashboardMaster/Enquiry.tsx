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
import { enquiryConversionColors } from "./EnquiryConversion/enquiryConversionTokens";

const ERP_FONT = "'Geist', sans-serif";

function normalizeGainMoMDirection(raw?: string): "up" | "down" | "flat" {
  const d = String(raw ?? "").toLowerCase();
  if (d === "increase" || d === "up") return "up";
  if (d === "decrease" || d === "down") return "down";
  return "flat";
}

function formatWonMoMCaption(meta?: EnquiryConversionOverviewMeta | null): {
  text: string;
  captionColor?: string;
  captionFw?: number;
} {
  const pct = meta?.gainMoMChangePctDisplay?.trim();
  if (!pct) {
    return { text: "— MoM", captionColor: enquiryConversionColors.subHeading, captionFw: 500 };
  }
  const dir = normalizeGainMoMDirection(meta?.gainMoMDirection);
  const arrow = dir === "down" ? "▼" : dir === "up" ? "▲" : "";
  const color =
    dir === "down" ? enquiryConversionColors.bars.lost : dir === "up" ? enquiryConversionColors.bars.won : enquiryConversionColors.subHeading;
  const text = [arrow, pct, "MoM"].filter(Boolean).join(" ").trim();
  return { text, captionColor: color, captionFw: 600 };
}

interface EnquiryProps {
  enquiryConversionAggregatedData: EnquiryConversionAggregatedData;
  enquiryConversionOverviewMeta?: EnquiryConversionOverviewMeta | null;
  isLoadingEnquiryConversion: boolean;
  isLoadingEnquiryChart: boolean;
  onOpenDetailModule?: () => void;
}

const FUNNEL_BAR_HEIGHT = 24;

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
    ? `${meta.quoteCreatedPctDisplay} of new`
    : `${data.quotePercentage.toFixed(1)}% of new`;

  const lostCaption = meta?.lostRowPctDisplay?.trim()?.length
    ? meta.lostRowPctDisplay.trim()
    : data.totalGain > 0
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
      valueColor: enquiryConversionColors.heading,
      caption: quotedCaption,
      captionColor: enquiryConversionColors.subHeading,
      captionFw: 500,
    },
    {
      key: "won",
      label: "WON",
      value: data.totalGain,
      valueColor: enquiryConversionColors.bars.won,
      caption: wonMoM.text,
      captionColor: wonMoM.captionColor,
      captionFw: wonMoM.captionFw,
    },
    {
      key: "lost",
      label: "LOST",
      value: data.totalLost,
      valueColor: enquiryConversionColors.heading,
      caption: lostCaption,
      captionColor: enquiryConversionColors.subHeading,
      captionFw: 500,
    },
  ];

  return (
    <Box style={{ fontFamily: ERP_FONT }}>
      {isLoadingEnquiryConversion || isLoadingEnquiryChart ? (
        <Center h={160}>
          <Loader size="md" color="#111827" />
        </Center>
      ) : (
        <Stack gap={24} pt={4}>
          <ConversionMetricStrip
            columns={metricColumns}
            onActivate={onOpenDetailModule}
          />

          <Box
            style={{ cursor: onOpenDetailModule ? "pointer" : undefined }}
            onClick={onOpenDetailModule}
            onKeyDown={(e) => {
              if (!onOpenDetailModule) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDetailModule();
              }
            }}
            role={onOpenDetailModule ? "button" : undefined}
            tabIndex={onOpenDetailModule ? 0 : undefined}
          >
            <SegmentedFunnelBar
              segments={funnelSegments}
              height={10}
            />
          </Box>
        </Stack>
      )}
    </Box>
  );
};

export default Enquiry;
