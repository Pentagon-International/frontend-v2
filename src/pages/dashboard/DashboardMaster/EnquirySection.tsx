import { Box } from "@mantine/core";
import { DateRangeInput } from "../../../components";
import Enquiry from "./Enquiry";
import {
  EnquiryConversionAggregatedData,
  EnquiryConversionOverviewMeta,
} from "../../../service/dashboard.service";
import {
  dashboardPanelShell,
  dashboardPanelHeaderBand,
  dashboardPanelBody,
} from "./dashboardPanelStyles";
import { EnquiryConversionCardHeader } from "./EnquiryConversion/EnquiryConversionCardHeader";
import { formatEnquiryConversionOverviewSubtitle } from "./EnquiryConversion/formatEnquiryConversionOverviewSubtitle";

interface EnquirySectionProps {
  enquiryConversionAggregatedData: EnquiryConversionAggregatedData;
  enquiryConversionOverviewMeta?: EnquiryConversionOverviewMeta | null;
  isLoadingEnquiryConversion: boolean;
  isLoadingEnquiryChart: boolean;
  fromDate: Date | null;
  toDate: Date | null;
  setFromDate: (date: Date | null) => void;
  setToDate: (date: Date | null) => void;
  hideDateFilter?: boolean;
  /** Opens full-screen Enquiry Conversion module (`/dashboard/enquiry-conversion`). */
  onOpenEnquiryConversionModule?: () => void;
}

const EnquirySection = ({
  enquiryConversionAggregatedData,
  enquiryConversionOverviewMeta,
  isLoadingEnquiryConversion,
  isLoadingEnquiryChart,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  hideDateFilter = false,
  onOpenEnquiryConversionModule,
}: EnquirySectionProps) => {
  const subtitle = formatEnquiryConversionOverviewSubtitle(
    enquiryConversionAggregatedData.totalEnquiries
  );

  return (
    <Box style={dashboardPanelShell}>
      <Box style={dashboardPanelHeaderBand}>
        <EnquiryConversionCardHeader
          subtitle={subtitle}
          onNavigate={onOpenEnquiryConversionModule}
        />
        {!hideDateFilter && (
          <Box mt="sm" style={{ width: "100%", maxWidth: 270 }}>
            <DateRangeInput
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              fromLabel="From"
              toLabel="To"
              size="xs"
              allowDeselection={true}
              showRangeInCalendar={false}
              containerStyle={{ gap: "4px" }}
            />
          </Box>
        )}
      </Box>

      <Box style={dashboardPanelBody}>
        <Enquiry
          enquiryConversionAggregatedData={enquiryConversionAggregatedData}
          enquiryConversionOverviewMeta={enquiryConversionOverviewMeta}
          isLoadingEnquiryConversion={isLoadingEnquiryConversion}
          isLoadingEnquiryChart={isLoadingEnquiryChart}
          onOpenDetailModule={onOpenEnquiryConversionModule}
        />
      </Box>
    </Box>
  );
};

export default EnquirySection;
