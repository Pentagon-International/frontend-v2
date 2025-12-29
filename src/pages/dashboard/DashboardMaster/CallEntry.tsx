import {
  Card,
  Group,
  Text,
  Stack,
  Box,
  Loader,
  Center,
  Select,
} from "@mantine/core";
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
  selectedPeriod,
  setSelectedPeriod,
}: CallEntryProps) => {
  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      h={165}
      style={{ border: "1px solid #e9ecef" }}
      mb={15}
    >
      <Group justify="space-between" align="center" mb="md">
        <Group gap="md" align="center">
          <Text size="md" fw={500}>
            Call Entry
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

        <Text
          size="md"
          c="#105476"
          style={{
            textDecoration: "underline",
            cursor: "pointer",
          }}
          onClick={() => handleCallEntryViewAll("all")}
        >
          View All
        </Text>
      </Group>

      {isLoadingCallEntry ? (
        <Center h="70%">
          <Loader size="lg" color="#105476" />
        </Center>
      ) : (
        <Stack gap="lg" align="center" justify="center" h="70%">
          <Group gap="md" justify="center" w="100%">
            <Stack
              align="center"
              style={{
                cursor: "pointer",
                padding: "8px",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                flex: 1,
              }}
              onClick={() => handleCallEntryViewAll("overdue")}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#fee";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <IconAlertTriangle size={24} color="#e74d3c" />
              <Box ta="center">
                <Text size="lg" fw={700} c="#e74d3c">
                  {callEntrySummary?.total_overdue || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Overdue
                </Text>
              </Box>
            </Stack>
            <Stack
              align="center"
              style={{
                cursor: "pointer",
                padding: "8px",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                flex: 1,
              }}
              onClick={() => handleCallEntryViewAll("today")}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#e3f2fd";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <IconCalendar size={24} color="blue" />
              <Box ta="center">
                <Text size="lg" fw={700} c="blue">
                  {callEntrySummary?.total_today || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Today
                </Text>
              </Box>
            </Stack>
            <Stack
              align="center"
              style={{
                cursor: "pointer",
                padding: "8px",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                flex: 1,
              }}
              onClick={() => handleCallEntryViewAll("upcoming")}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f9ff";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <IconClock size={24} color="#059669" />
              <Box ta="center">
                <Text size="lg" fw={700} c="#059669">
                  {callEntrySummary?.total_upcoming || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Upcoming
                </Text>
              </Box>
            </Stack>
            <Stack
              align="center"
              style={{
                cursor: "pointer",
                padding: "8px",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                flex: 1,
              }}
              onClick={() => handleCallEntryViewAll("closed")}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0fdf4";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <IconCalendarCheck size={24} color="#16a34a" />
              <Box ta="center">
                <Text size="lg" fw={700} c="#16a34a">
                  {callEntrySummary?.total_closed || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  Closed
                </Text>
              </Box>
            </Stack>
          </Group>
        </Stack>
      )}
    </Card>
  );
};

export default CallEntry;
