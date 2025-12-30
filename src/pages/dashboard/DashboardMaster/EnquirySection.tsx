import { Box, Text, Group, Badge } from "@mantine/core";
import { DateRangeInput } from "../../../components";
import Enquiry from "./Enquiry";
import { EnquiryConversionAggregatedData } from "../../../service/dashboard.service";

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
    <Box
      style={{
        border: "1px solid #F7F7F7",
        borderRadius: "8px",
        padding: "12px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Group justify="space-between" align="center" mb="md">
        <Group gap="md" align="center">
          <Text
            size="md"
            fw={500}
            c="#22252B"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Enquiry
          </Text>
          <Badge color="#105476" variant="filled" size="sm">
            Total {enquiryConversionAggregatedData.totalEnquiries}
          </Badge>
        </Group>
        <Group gap="xs" align="center">
          <Text
            size="sm"
            c="#105476"
            style={{
              textDecoration: "underline",
              cursor: "pointer",
            }}
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

      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
