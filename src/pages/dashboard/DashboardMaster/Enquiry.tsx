import {
  Card,
  Group,
  Text,
  Badge,
  Stack,
  Box,
  Image,
  Loader,
  Center,
  ActionIcon,
  Select,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import gainImage from "../../../assets/images/gain.png";
import lossImage from "../../../assets/images/loss.png";
import quotationImage from "../../../assets/images/quotation.png";
import tasksImage from "../../../assets/images/tasks.png";
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
  enquiryView,
  setEnquiryView,
  handleEnquiryConversionViewAll,
  selectedPeriod,
  setSelectedPeriod,
}: EnquiryProps) => {
  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      style={{ border: "1px solid #e9ecef", height: "100%" }}
    >
      <Group justify="space-between" align="center" mb="sm">
        <Badge color="#105476" variant="filled" size="sm">
          Total {enquiryConversionAggregatedData.totalEnquiries}
        </Badge>
        
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
      </Group>

      {isLoadingEnquiryConversion || isLoadingEnquiryChart ? (
        <Center h="70%">
          <Loader size="lg" color="#105476" />
        </Center>
      ) : (
        <Stack align="center" justify="center" h="70%">
          <Box style={{ position: "relative", width: "100%" }}>
            <Group gap="xl" justify="center">
              {enquiryView === "gain-lost" ? (
                <>
                  <Stack
                    align="center"
                    gap="sm"
                    style={{
                      cursor: "pointer",
                      padding: "10px",
                      borderRadius: "8px",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => handleEnquiryConversionViewAll("gain")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#e8f4f8";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <Group align="center" gap="md">
                      <Image src={gainImage} alt="Gain" w={40} h={40} />
                      <Box
                        p="xs"
                        style={{
                          backgroundColor: "#105476",
                          borderRadius: "4px",
                          display: "inline-block",
                        }}
                      >
                        <Text size="lg" fw={700} c="white">
                          {enquiryConversionAggregatedData.gainPercentage}%
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={4}>
                      <Text size="sm" c="dimmed">
                        Gain
                      </Text>
                      <Badge color="#105476" variant="filled" size="sm">
                        {enquiryConversionAggregatedData.totalGain}
                      </Badge>
                    </Group>
                  </Stack>
                  <Stack
                    align="center"
                    gap="sm"
                    style={{
                      cursor: "pointer",
                      padding: "10px",
                      borderRadius: "8px",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => handleEnquiryConversionViewAll("lost")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9f9fb";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <Group align="center" gap="md">
                      <Image src={lossImage} alt="Loss" w={40} h={40} />
                      <Box
                        p="xs"
                        style={{
                          backgroundColor: "#F1F3F9",
                          borderRadius: "4px",
                          display: "inline-block",
                        }}
                      >
                        <Text size="lg" fw={700} c="#105476">
                          {enquiryConversionAggregatedData.lossPercentage}%
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={4}>
                      <Text size="sm" c="dimmed">
                        Loss
                      </Text>
                      <Badge color="gray" variant="filled" size="sm">
                        {enquiryConversionAggregatedData.totalLost}
                      </Badge>
                    </Group>
                  </Stack>
                </>
              ) : (
                <>
                  <Stack
                    align="center"
                    gap="sm"
                    style={{
                      cursor: "pointer",
                      padding: "10px",
                      borderRadius: "8px",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => handleEnquiryConversionViewAll("active")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#e8f4f8";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <Group align="center" gap="md">
                      <Image src={tasksImage} alt="Active" w={40} h={40} />
                      <Box
                        p="xs"
                        style={{
                          backgroundColor: "#105476",
                          borderRadius: "4px",
                          display: "inline-block",
                        }}
                      >
                        <Text size="lg" fw={700} c="white">
                          {enquiryConversionAggregatedData.activePercentage}%
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={4}>
                      <Text size="sm" c="dimmed">
                        Active
                      </Text>
                      <Badge color="#105476" variant="filled" size="sm">
                        {enquiryConversionAggregatedData.totalActive}
                      </Badge>
                    </Group>
                  </Stack>
                  <Stack
                    align="center"
                    gap="sm"
                    style={{
                      cursor: "pointer",
                      padding: "10px",
                      borderRadius: "8px",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => handleEnquiryConversionViewAll("quote")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9f9fb";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <Group align="center" gap="md">
                      <Image src={quotationImage} alt="Quote" w={40} h={40} />
                      <Box
                        p="xs"
                        style={{
                          backgroundColor: "#F1F3F9",
                          borderRadius: "4px",
                          display: "inline-block",
                        }}
                      >
                        <Text size="lg" fw={700} c="#105476">
                          {enquiryConversionAggregatedData.quotePercentage}%
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={4}>
                      <Text size="sm" c="dimmed">
                        Quoted
                      </Text>
                      <Badge color="gray" variant="filled" size="sm">
                        {enquiryConversionAggregatedData.totalQuoteCreated}
                      </Badge>
                    </Group>
                  </Stack>
                </>
              )}
            </Group>

            {/* Slider Button - Fixed position on right side */}
            <ActionIcon
              variant="filled"
              color="#105476"
              size="md"
              radius="xl"
              style={{
                position: "absolute",
                right: -10,
                top: "30%",
                transform: "translateY(-50%)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
              onClick={() =>
                setEnquiryView(
                  enquiryView === "gain-lost" ? "active-quote" : "gain-lost"
                )
              }
            >
              {enquiryView === "gain-lost" ? (
                <IconChevronRight size={16} />
              ) : (
                <IconChevronLeft size={16} />
              )}
            </ActionIcon>
          </Box>
        </Stack>
      )}
    </Card>
  );
};

export default Enquiry;
