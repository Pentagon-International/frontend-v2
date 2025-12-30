import { Box, Text, Group, Select } from "@mantine/core";
import CallEntry from "./CallEntry";
import { CallEntryStatisticsSummary } from "../../../service/dashboard.service";

interface CallEntrySectionProps {
  callEntrySummary: CallEntryStatisticsSummary | null;
  isLoadingCallEntry: boolean;
  handleCallEntryViewAll: (
    filterType: "all" | "overdue" | "today" | "upcoming" | "closed"
  ) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
}

const CallEntrySection = ({
  callEntrySummary,
  isLoadingCallEntry,
  handleCallEntryViewAll,
  selectedPeriod,
  setSelectedPeriod,
}: CallEntrySectionProps) => {
  return (
    <Box
      style={{
        border: "1px solid #F7F7F7",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <Group justify="space-between" align="center" mb="md">
        <Text
          size="lg"
          fw={500}
          c="#22252B"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Call Entry
        </Text>
        <Group gap="xs">
          <Text
            size="sm"
            c="#105476"
            style={{
              textDecoration: "underline",
              cursor: "pointer",
            }}
            onClick={() => handleCallEntryViewAll("all")}
          >
            View All
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
      </Group>

      <CallEntry
        callEntrySummary={callEntrySummary}
        isLoadingCallEntry={isLoadingCallEntry}
        handleCallEntryViewAll={handleCallEntryViewAll}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
      />
    </Box>
  );
};

export default CallEntrySection;
