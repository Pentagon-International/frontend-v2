import { Box, Text, Group } from "@mantine/core";
import { DateRangeInput } from "../../../components";
import CustomerInteractionStatusCard from "./CustomerInteractionStatusCard";

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
          Customer Interaction Status
        </Text>
        <Group gap="xs">
          {handleViewAll && (
            <Text
              size="sm"
              c="#105476"
              style={{
                textDecoration: "underline",
                cursor: "pointer",
              }}
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

      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
