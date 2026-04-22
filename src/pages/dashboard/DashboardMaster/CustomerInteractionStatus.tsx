import { Box, Text, Group } from "@mantine/core";
import { DateRangeInput } from "../../../components";
import CustomerInteractionStatusCard from "./CustomerInteractionStatusCard";
import {
  dashboardPanelShell,
  dashboardPanelHeaderBand,
  dashboardPanelBody,
  dashboardPanelTitleStyle,
  dashboardViewAllStyle,
} from "./dashboardPanelStyles";

interface CustomerInteractionData {
  gain: number;
  gainSalesperson: number;
  notVisited: number;
  notVisitedSalesperson: number;
  lost: number;
  lostSalesperson: number;
}

interface CustomerInteractionStatusProps {
  // Simplified props for the new design
  data: CustomerInteractionData | null;
  loading: boolean;
  customerInteractionPeriod: string;
  setCustomerInteractionPeriod: (value: string) => void;
  handleViewAll?: () => void;
  // New date filter props
  fromDate: Date | null;
  toDate: Date | null;
  setFromDate: (date: Date | null) => void;
  setToDate: (date: Date | null) => void;
  // Hide date filter if it's common at top level
  hideDateFilter?: boolean;
  // Click handlers for cards
  onGainClick?: () => void;
  onLostClick?: () => void;
  onNotVisitedClick?: () => void;
}

const CustomerInteractionStatus = ({
  data,
  loading,
  handleViewAll,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  hideDateFilter = false,
  onGainClick,
  onLostClick,
  onNotVisitedClick,
}: CustomerInteractionStatusProps) => {
  return (
    <Box style={dashboardPanelShell}>
      <Box style={dashboardPanelHeaderBand}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
          <Box style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={dashboardPanelTitleStyle}>
              Customer Interaction Status
            </Text>
          </Box>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {handleViewAll && (
            <Text
              size="sm"
              c="#105476"
              style={dashboardViewAllStyle}
              onClick={handleViewAll}
            >
              View All
            </Text>
          )}
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
            value={customerInteractionPeriod}
            onChange={(value) =>
              setCustomerInteractionPeriod(value || "last_30_days")
            }
            w={150}
            size="xs"
            data={[
              { value: "last_7_days", label: "Last 7 days" },
              { value: "last_30_days", label: "Last 30 days" },
              { value: "last_60_days", label: "Last 60 days" },
              { value: "last_90_days", label: "Last 90 days" },
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
        <CustomerInteractionStatusCard
          data={data}
          loading={loading}
          onViewAll={handleViewAll}
          onGainClick={onGainClick}
          onLostClick={onLostClick}
          onNotVisitedClick={onNotVisitedClick}
        />
      </Box>
    </Box>
  );
};

export default CustomerInteractionStatus;
