import { Box, Text, Group } from "@mantine/core";
import { DateRangeInput } from "../../../components";
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
  // New date filter props
  fromDate: Date | null;
  toDate: Date | null;
  setFromDate: (date: Date | null) => void;
  setToDate: (date: Date | null) => void;
  // Hide date filter if it's common at top level
  hideDateFilter?: boolean;
}

const CallEntrySection = ({
  callEntrySummary,
  isLoadingCallEntry,
  handleCallEntryViewAll,
  selectedPeriod,
  setSelectedPeriod,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  hideDateFilter = false,
}: CallEntrySectionProps) => {
  return (
    <Box
      style={{
        background: "#ffffff",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        padding: "16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Group justify="space-between" align="center" mb="md">
        <Text
          fw={600}
          style={{ fontSize: "13.5px", color: "#1E293B", letterSpacing: 0.1 }}
        >
          Call Entry
        </Text>
        <Group gap="xs">
          <Text
            size="sm"
            c="#2563EB"
            style={{
              textDecoration: "underline",
              cursor: "pointer",
            }}
            onClick={() => handleCallEntryViewAll("all")}
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
        <CallEntry
          callEntrySummary={callEntrySummary}
          isLoadingCallEntry={isLoadingCallEntry}
          handleCallEntryViewAll={handleCallEntryViewAll}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
        />
      </Box>
    </Box>
  );
};

export default CallEntrySection;
