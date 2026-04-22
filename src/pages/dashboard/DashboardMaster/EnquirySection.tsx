import { Box, Text, Group, Badge } from "@mantine/core";
import { DateRangeInput } from "../../../components";
import Enquiry from "./Enquiry";
import { EnquiryConversionAggregatedData } from "../../../service/dashboard.service";
import {
  dashboardPanelShell,
  dashboardPanelHeaderBand,
  dashboardPanelBody,
  dashboardPanelTitleStyle,
  dashboardViewAllStyle,
} from "./dashboardPanelStyles";

interface EnquirySectionProps {
  enquiryConversionAggregatedData: EnquiryConversionAggregatedData;
  isLoadingEnquiryConversion: boolean;
  isLoadingEnquiryChart: boolean;
  enquiryView: "gain-lost" | "active-quote";
  setEnquiryView: (view: "gain-lost" | "active-quote") => void;
  handleEnquiryConversionViewAll: (filterType: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  // New date filter props
  fromDate: Date | null;
  toDate: Date | null;
  setFromDate: (date: Date | null) => void;
  setToDate: (date: Date | null) => void;
  // Hide date filter if it's common at top level
  hideDateFilter?: boolean;
}

const EnquirySection = ({
  enquiryConversionAggregatedData,
  isLoadingEnquiryConversion,
  isLoadingEnquiryChart,
  enquiryView,
  setEnquiryView,
  handleEnquiryConversionViewAll,
  selectedPeriod,
  setSelectedPeriod,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  hideDateFilter = false,
}: EnquirySectionProps) => {
  return (
    <Box style={dashboardPanelShell}>
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Group
            gap="sm"
            align="center"
            wrap="nowrap"
            style={{ flex: 1, minWidth: 0 }}
          >
            <Text style={dashboardPanelTitleStyle}>Enquiry</Text>
            <Badge
              color="#105476"
              variant="light"
              size="sm"
              radius="sm"
              style={{ flexShrink: 0 }}
            >
              Total {enquiryConversionAggregatedData.totalEnquiries}
            </Badge>
          </Group>
          <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Text
            size="sm"
            c="#105476"
            style={dashboardViewAllStyle}
            onClick={() => handleEnquiryConversionViewAll("all")}
          >
            View All
          </Text>
          {/* Date Range Filter - Hidden if common at top level */}
          {!hideDateFilter && (
            <Box style={{ width: "270px", flexShrink: 0 }}>
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
          {/* Commented out - can be used in future case */}
          {/* <Select
            placeholder="Select Period"
            value={selectedPeriod}
            onChange={(value) => setSelectedPeriod(value || "last_3_months")}
            w={150}
            size="xs"
            data={[
              { value: "weekly", label: "Last Week" },
              { value: "current_month", label: "Current Month" },
              { value: "last_month", label: "Last Month" },
              { value: "last_3_months", label: "Last 3 Months" },
              { value: "last_6_months", label: "Last 6 Months" },
              { value: "last_year", label: "Last Year" },
            ]}
            styles={{
              input: { fontSize: "12px" },
            }}
          /> */}
          </Group>
        </Group>
      </Box>

      <Box style={dashboardPanelBody}>
        <Enquiry
          enquiryConversionAggregatedData={enquiryConversionAggregatedData}
          isLoadingEnquiryConversion={isLoadingEnquiryConversion}
          isLoadingEnquiryChart={isLoadingEnquiryChart}
          enquiryView={enquiryView}
          setEnquiryView={setEnquiryView}
          handleEnquiryConversionViewAll={handleEnquiryConversionViewAll}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
        />
      </Box>
    </Box>
  );
};

export default EnquirySection;
