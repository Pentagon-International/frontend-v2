import { Group, Text, Stack, Box, Loader, Center } from "@mantine/core";
import { EnquiryConversionAggregatedData } from "../../../service/dashboard.service";

interface EnquiryProps {
  enquiryConversionAggregatedData: EnquiryConversionAggregatedData;
  isLoadingEnquiryConversion: boolean;
  isLoadingEnquiryChart: boolean;
  enquiryView: "gain-lost" | "active-quote";
  setEnquiryView: (view: "gain-lost" | "active-quote") => void;
  handleEnquiryConversionViewAll: (
    filterType: "all" | "gain" | "lost" | "active" | "quote"
  ) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
}

const Enquiry = ({
  enquiryConversionAggregatedData,
  isLoadingEnquiryConversion,
  isLoadingEnquiryChart,
  handleEnquiryConversionViewAll,
}: EnquiryProps) => {
  return (
    <Box>
      {isLoadingEnquiryConversion || isLoadingEnquiryChart ? (
        <Center h="70%">
          <Loader size="lg" color="#105476" />
        </Center>
      ) : (
        <Stack gap="md" style={{ paddingTop: "16px" }}>
          {/* Horizontal Bar Chart */}
          <Box
            style={{
              width: "100%",
              height: "40px",
              display: "flex",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <Box
              style={{
                backgroundColor: "#2E7D32",
                width: `${enquiryConversionAggregatedData.gainPercentage}%`,
                cursor: "pointer",
                transition: "opacity 0.2s ease",
              }}
              onClick={() => handleEnquiryConversionViewAll("gain")}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            />
            <Box
              style={{
                backgroundColor: "#8B0000",
                width: `${enquiryConversionAggregatedData.lossPercentage}%`,
                cursor: "pointer",
                transition: "opacity 0.2s ease",
              }}
              onClick={() => handleEnquiryConversionViewAll("lost")}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            />
            <Box
              style={{
                backgroundColor: "#F6C667",
                width: `${enquiryConversionAggregatedData.activePercentage}%`,
                cursor: "pointer",
                transition: "opacity 0.2s ease",
              }}
              onClick={() => handleEnquiryConversionViewAll("active")}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            />
            <Box
              style={{
                backgroundColor: "#64B5F6",
                width: `${enquiryConversionAggregatedData.quotePercentage}%`,
                cursor: "pointer",
                transition: "opacity 0.2s ease",
              }}
              onClick={() => handleEnquiryConversionViewAll("quote")}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            />
          </Box>

          {/* Labels below the bar */}
          <Group justify="space-between" style={{ paddingTop: "8px" }}>
            <Stack
              align="center"
              gap={4}
              style={{ cursor: "pointer" }}
              onClick={() => handleEnquiryConversionViewAll("gain")}
            >
              <Text size="xs" c="dimmed">
                Gain
              </Text>
              <Text size="lg" fw={700} c="#2E7D32">
                {enquiryConversionAggregatedData.totalGain}
              </Text>
            </Stack>
            <Stack
              align="center"
              gap={4}
              style={{ cursor: "pointer" }}
              onClick={() => handleEnquiryConversionViewAll("lost")}
            >
              <Text size="xs" c="dimmed">
                Loss
              </Text>
              <Text size="lg" fw={700} c="#8B0000">
                {enquiryConversionAggregatedData.totalLost}
              </Text>
            </Stack>
            <Stack
              align="center"
              gap={4}
              style={{ cursor: "pointer" }}
              onClick={() => handleEnquiryConversionViewAll("active")}
            >
              <Text size="xs" c="dimmed">
                Active
              </Text>
              <Text size="lg" fw={700} c="#F6C667">
                {enquiryConversionAggregatedData.totalActive}
              </Text>
            </Stack>
            <Stack
              align="center"
              gap={4}
              style={{ cursor: "pointer" }}
              onClick={() => handleEnquiryConversionViewAll("quote")}
            >
              <Text size="xs" c="dimmed">
                Quoted
              </Text>
              <Text size="lg" fw={700} c="#1976D2">
                {enquiryConversionAggregatedData.totalQuoteCreated}
              </Text>
            </Stack>
          </Group>
        </Stack>
      )}
    </Box>
  );
};

export default Enquiry;
