import { Box, Text, Group } from "@mantine/core";
import { DateRangeInput } from "../../../components";
import CallEntry from "./CallEntry";
import { CallEntryStatisticsSummary } from "../../../service/dashboard.service";
import {
  dashboardPanelShell,
  dashboardPanelHeaderBand,
  dashboardPanelBody,
  dashboardPanelTitleStyle,
  dashboardViewAllStyle,
} from "./dashboardPanelStyles";

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
    <Box style={dashboardPanelShell}>
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Box style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={dashboardPanelTitleStyle}>Call Entry</Text>
          </Box>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Text
            size="sm"
            c="#105476"
            style={dashboardViewAllStyle}
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
      </Box>

      <Box style={dashboardPanelBody}>
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
