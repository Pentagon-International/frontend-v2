import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { DateRangeInput } from "../../../components";
import { CallEntryActivity } from "./CallEntryActivity/CallEntryActivity";
import type {
  CallEntryStatisticsSummary,
} from "../../../service/dashboard.service";
import {
  dashboardPanelShell,
  dashboardPanelHeaderBand,
  dashboardPanelBody,
  dashboardPanelTitleStyle,
} from "./dashboardPanelStyles";

interface CallEntrySectionProps {
  callEntrySummary: CallEntryStatisticsSummary | null;
  isLoadingCallEntry: boolean;
  handleCallEntryViewAll: (
    filterType: "all" | "overdue" | "today" | "upcoming" | "closed"
  ) => void;
  onOpenCallEntryDashboard?: () => void;
  fromDate: Date | null;
  toDate: Date | null;
  setFromDate: (date: Date | null) => void;
  setToDate: (date: Date | null) => void;
  hideDateFilter?: boolean;
}

const headerArrowButtonSx = {
  flexShrink: 0,
  padding: 8,
  borderRadius: 8,
  color: "#94A3B8",
} as const;

const openDashboard = (
  onOpenCallEntryDashboard: (() => void) | undefined,
  handleCallEntryViewAll: (
    filterType: "all" | "overdue" | "today" | "upcoming" | "closed"
  ) => void
) => {
  if (onOpenCallEntryDashboard) {
    onOpenCallEntryDashboard();
    return;
  }
  handleCallEntryViewAll("all");
};

const CallEntrySection = ({
  callEntrySummary,
  isLoadingCallEntry,
  handleCallEntryViewAll,
  onOpenCallEntryDashboard,
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
          <Group gap="sm" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <UnstyledButton
              type="button"
              onClick={() =>
                openDashboard(onOpenCallEntryDashboard, handleCallEntryViewAll)
              }
              style={{ textAlign: "left" }}
            >
              <Text style={dashboardPanelTitleStyle}>Call Entry Activity</Text>
            </UnstyledButton>
            <UnstyledButton
              type="button"
              onClick={() =>
                openDashboard(onOpenCallEntryDashboard, handleCallEntryViewAll)
              }
              aria-label="Open call entry details"
              style={{
                ...headerArrowButtonSx,
                marginTop: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#105476";
                e.currentTarget.style.background = "#F1F5F9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94A3B8";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <IconArrowRight size={20} stroke={1.5} />
            </UnstyledButton>
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
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
          </Group>
        </Group>
      </Box>

      <Box style={dashboardPanelBody}>
        <CallEntryActivity
          summary={callEntrySummary}
          isLoading={isLoadingCallEntry}
        />
      </Box>
    </Box>
  );
};

export default CallEntrySection;
