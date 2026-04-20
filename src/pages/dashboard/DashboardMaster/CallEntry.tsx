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

const kpiCardBase = {
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
  height: "85px",
  flex: 1,
  position: "relative" as const,
};

const CallEntry = ({
  callEntrySummary,
  isLoadingCallEntry,
  handleCallEntryViewAll,
}: CallEntryProps) => {
  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {isLoadingCallEntry ? (
        <Center h={200}>
          <Loader size="lg" color="#2563EB" />
        </Center>
      ) : (
        <Stack gap="md" w="100%" style={{ flex: 1, padding: "4px" }}>
          {/* Row 1 — Today & Closed */}
          <Group gap="md" justify="space-between" w="100%">
            {/* Today */}
            <Card
              shadow="xs"
              p="md"
              radius="md"
              style={{
                ...kpiCardBase,
                background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                border: "1px solid #BFDBFE",
                cursor: "pointer",
              }}
              onClick={() => handleCallEntryViewAll("today")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(37, 99, 235, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconCalendar size={22} color="#2563EB" />
              </Box>
              <Stack align="flex-start" gap={3} justify="center" h="100%">
                <Text style={{ fontSize: "11px", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Today
                </Text>
                <Text style={{ fontSize: "1.75rem", fontWeight: 700, color: "#2563EB", lineHeight: 1 }}>
                  {callEntrySummary?.total_today || 0}
                </Text>
              </Stack>
            </Card>

            {/* Closed */}
            <Card
              shadow="xs"
              p="md"
              radius="md"
              style={{
                ...kpiCardBase,
                background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
                border: "1px solid #BBF7D0",
                cursor: "pointer",
              }}
              onClick={() => handleCallEntryViewAll("closed")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(22, 163, 74, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconCalendarCheck size={22} color="#16A34A" />
              </Box>
              <Stack align="flex-start" gap={3} justify="center" h="100%">
                <Text style={{ fontSize: "11px", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Closed
                </Text>
                <Text style={{ fontSize: "1.75rem", fontWeight: 700, color: "#16A34A", lineHeight: 1 }}>
                  {callEntrySummary?.total_closed || 0}
                </Text>
              </Stack>
            </Card>
          </Group>

          {/* Row 2 — Upcoming & Overdue */}
          <Group gap="md" justify="space-between" w="100%">
            {/* Upcoming */}
            <Card
              shadow="xs"
              p="md"
              radius="md"
              style={{
                ...kpiCardBase,
                background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                border: "1px solid #FDE68A",
                cursor: "pointer",
              }}
              onClick={() => handleCallEntryViewAll("upcoming")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(217, 119, 6, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconClock size={22} color="#D97706" />
              </Box>
              <Stack align="flex-start" gap={3} justify="center" h="100%">
                <Text style={{ fontSize: "11px", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Upcoming
                </Text>
                <Text style={{ fontSize: "1.75rem", fontWeight: 700, color: "#D97706", lineHeight: 1 }}>
                  {callEntrySummary?.total_upcoming || 0}
                </Text>
              </Stack>
            </Card>

            {/* Overdue */}
            <Card
              shadow="xs"
              p="md"
              radius="md"
              style={{
                ...kpiCardBase,
                background: "linear-gradient(135deg, #FFF5F5 0%, #FEE2E2 100%)",
                border: "1px solid #FECACA",
                cursor: "pointer",
              }}
              onClick={() => handleCallEntryViewAll("overdue")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(220, 38, 38, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Box style={{ position: "absolute", top: "12px", right: "12px" }}>
                <IconAlertTriangle size={22} color="#DC2626" />
              </Box>
              <Stack align="flex-start" gap={3} justify="center" h="100%">
                <Text style={{ fontSize: "11px", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Overdue
                </Text>
                <Text style={{ fontSize: "1.75rem", fontWeight: 700, color: "#DC2626", lineHeight: 1 }}>
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
