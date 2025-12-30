import { Box, Text, Group, Select } from "@mantine/core";
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
}

const CustomerInteractionStatus = ({
  data,
  loading,
  customerInteractionPeriod,
  setCustomerInteractionPeriod,
  handleViewAll,
}: CustomerInteractionStatusProps) => {
  return (
    <Box>
      <Group justify="space-between" align="center" mb="md">
        <Text size="lg" fw={600}>
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
          <Select
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
          />
        </Group>
      </Group>

      <CustomerInteractionStatusCard
        data={data}
        loading={loading}
        onViewAll={handleViewAll}
      />
    </Box>
  );
};

export default CustomerInteractionStatus;
