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
    <Box>
      {isLoadingCallEntry ? (
        <Center h={200}>
          <Loader size="lg" color="#105476" />
        </Center>
      ) : (
        <Group gap="lg" justify="space-between" w="100%">
          {/* Today */}
          <Card
            shadow="sm"
            p="md"
            radius="md"
            style={{
              cursor: "pointer",
              background: "linear-gradient(135deg, #EDF9FF 0%, #EBF7FC 100%)",
              border: "1px solid #EBF7FC",
              transition: "all 0.3s ease",
              height: "100px",
              flex: 1,
              position: "relative",
            }}
            onClick={() => handleCallEntryViewAll("today")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(33, 150, 243, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "";
            }}
          >
            <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
              <IconCalendar size={24} color="#1976d2" />
            </Box>
            <Stack align="flex-start" gap={4} justify="center" h="100%">
              <Text size="xs" c="dimmed" fw={500}>
                Today
              </Text>
              <Text size="2rem" fw={700} c="#1976d2" style={{ lineHeight: 1 }}>
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
              background: "linear-gradient(135deg, #EFFFED 0%, #ECFCEB 100%)",
              border: "1px solid #ECFCEB",
              transition: "all 0.3s ease",
              height: "100px",
              flex: 1,
              position: "relative",
            }}
            onClick={() => handleCallEntryViewAll("closed")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(22, 163, 74, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "";
            }}
          >
            <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
              <IconCalendarCheck size={24} color="#16a34a" />
            </Box>
            <Stack align="flex-start" gap={4} justify="center" h="100%">
              <Text size="xs" c="dimmed" fw={500}>
                Closed
              </Text>
              <Text size="2rem" fw={700} c="#16a34a" style={{ lineHeight: 1 }}>
                {callEntrySummary?.total_closed || 0}
              </Text>
            </Stack>
          </Card>

          {/* Upcoming */}
          <Card
            shadow="sm"
            p="md"
            radius="md"
            style={{
              cursor: "pointer",
              background: "linear-gradient(135deg, #FFFAED 0%, #FCF7EB 100%)",
              border: "1px solid #FCF7EB",
              transition: "all 0.3s ease",
              height: "100px",
              flex: 1,
              position: "relative",
            }}
            onClick={() => handleCallEntryViewAll("upcoming")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(234, 179, 8, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "";
            }}
          >
            <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
              <IconClock size={24} color="#ca8a04" />
            </Box>
            <Stack align="flex-start" gap={4} justify="center" h="100%">
              <Text size="xs" c="dimmed" fw={500}>
                Upcoming
              </Text>
              <Text size="2rem" fw={700} c="#ca8a04" style={{ lineHeight: 1 }}>
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
              background: "linear-gradient(135deg, #FFEDEF 0%, #FCEBED 100%)",
              border: "1px solid #FCEBED",
              transition: "all 0.3s ease",
              height: "100px",
              flex: 1,
              position: "relative",
            }}
            onClick={() => handleCallEntryViewAll("overdue")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(239, 68, 68, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "";
            }}
          >
            <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
              <IconAlertTriangle size={24} color="#dc2626" />
            </Box>
            <Stack align="flex-start" gap={4} justify="center" h="100%">
              <Text size="xs" c="dimmed" fw={500}>
                Overdue
              </Text>
              <Text size="2rem" fw={700} c="#dc2626" style={{ lineHeight: 1 }}>
                {callEntrySummary?.total_overdue || 0}
              </Text>
            </Stack>
          </Card>
        </Group>
      )}
    </Box>
  );
};

export default CallEntry;
