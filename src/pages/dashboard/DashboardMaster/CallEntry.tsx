import { Card, Group, Text, Stack, Box, Loader, Center } from "@mantine/core";
import {
  IconAlertTriangle,
  IconClock,
  IconCalendar,
  IconCalendarCheck,
} from "@tabler/icons-react";
import { CallEntryStatisticsSummary } from "../../../service/dashboard.service";

interface CallEntryProps {
  callEntrySummary: CallEntryStatisticsSummary | null;
  isLoadingCallEntry: boolean;
  handleCallEntryViewAll: (
    filterType: "all" | "overdue" | "today" | "upcoming" | "closed"
  ) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
}

const CallEntry = ({
  callEntrySummary,
  isLoadingCallEntry,
  handleCallEntryViewAll,
}: CallEntryProps) => {
  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {isLoadingCallEntry ? (
        <Center h={200}>
          <Loader size="lg" color="#105476" />
        </Center>
      ) : (
        <Stack gap="lg" w="100%" style={{ flex: 1, padding: "8px" }}>
          {/* First Row - Today and Closed */}
          <Group gap="lg" justify="space-between" w="100%">
            {/* Today */}
            <Card
              shadow="sm"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background:
                  "linear-gradient(to right, #FFFFFF 0%, #EBF7FC 100%)",
                border: "1px solid #EBF7FC",
                transition: "all 0.3s ease",
                height: "85px",
                flex: 1,
                position: "relative",
              }}
              onClick={() => handleCallEntryViewAll("today")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(16, 84, 118, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconCalendar size={24} color="#105476" />
              </Box>
              <Stack align="flex-start" gap={4} justify="center" h="100%">
                <Text size="xs" c="dimmed" fw={500}>
                  Today
                </Text>
                <Text
                  size="1.75rem"
                  fw={700}
                  c="#105476"
                  style={{ lineHeight: 1 }}
                >
                  {callEntrySummary?.total_today || 0}
                </Text>
              </Stack>
            </Card>

            {/* Closed */}
            <Card
              shadow="sm"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background:
                  "linear-gradient(to right, #FFFFFF 0%, #ECFCEB 100%)",
                border: "1px solid #ECFCEB",
                transition: "all 0.3s ease",
                height: "85px",
                flex: 1,
                position: "relative",
              }}
              onClick={() => handleCallEntryViewAll("closed")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(48, 128, 40, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconCalendarCheck size={24} color="#308028" />
              </Box>
              <Stack align="flex-start" gap={4} justify="center" h="100%">
                <Text size="xs" c="dimmed" fw={500}>
                  Closed
                </Text>
                <Text
                  size="1.75rem"
                  fw={700}
                  c="#308028"
                  style={{ lineHeight: 1 }}
                >
                  {callEntrySummary?.total_closed || 0}
                </Text>
              </Stack>
            </Card>
          </Group>

          {/* Second Row - Upcoming and Overdue */}
          <Group gap="lg" justify="space-between" w="100%">
            {/* Upcoming */}
            <Card
              shadow="sm"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background:
                  "linear-gradient(to right, #FFFFFF 0%, #FCF7EB 100%)",
                border: "1px solid #FCF7EB",
                transition: "all 0.3s ease",
                height: "85px",
                flex: 1,
                position: "relative",
              }}
              onClick={() => handleCallEntryViewAll("upcoming")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(181, 137, 27, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconClock size={24} color="#B5891B" />
              </Box>
              <Stack align="flex-start" gap={4} justify="center" h="100%">
                <Text size="xs" c="dimmed" fw={500}>
                  Upcoming
                </Text>
                <Text
                  size="1.75rem"
                  fw={700}
                  c="#B5891B"
                  style={{ lineHeight: 1 }}
                >
                  {callEntrySummary?.total_upcoming || 0}
                </Text>
              </Stack>
            </Card>

            {/* Overdue */}
            <Card
              shadow="sm"
              p="md"
              radius="md"
              style={{
                cursor: "pointer",
                background:
                  "linear-gradient(to right, #FFFFFF 0%, #FCEBED 100%)",
                border: "1px solid #FCEBED",
                transition: "all 0.3s ease",
                height: "85px",
                flex: 1,
                position: "relative",
              }}
              onClick={() => handleCallEntryViewAll("overdue")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(138, 0, 13, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconAlertTriangle size={24} color="#8A000D" />
              </Box>
              <Stack align="flex-start" gap={4} justify="center" h="100%">
                <Text size="xs" c="dimmed" fw={500}>
                  Overdue
                </Text>
                <Text
                  size="1.75rem"
                  fw={700}
                  c="#8A000D"
                  style={{ lineHeight: 1 }}
                >
                  {callEntrySummary?.total_overdue || 0}
                </Text>
              </Stack>
            </Card>
          </Group>
        </Stack>
      )}
    </Box>
  );
};

export default CallEntry;
