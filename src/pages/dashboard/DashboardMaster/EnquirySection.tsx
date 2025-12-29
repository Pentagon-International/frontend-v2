import { Box, Text, Group, Select } from "@mantine/core";
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
}: EnquirySectionProps) => {
  return (
    <Box mb="lg">
      <Group justify="space-between" align="center" mb="md">
        <Text size="lg" fw={600}>
          Enquiry
        </Text>
        <Select
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
        />
      </Group>

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
  );
};

export default EnquirySection;

