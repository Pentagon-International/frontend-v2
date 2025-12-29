import { Box, Text, Group, Select, Grid } from "@mantine/core";
import NewCustomers from "./NewCustomers";
import LostCustomer from "./LostCustomer";
import CustomerNotVisited from "./CustomerNotVisited";

interface CustomerInteractionStatusProps {
  // New Customers props
  newCustomerDrillLevel: 0 | 1 | 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newCustomerRawData: any;
  newCustomerSelectedSalesperson: string | null;
  newCustomerPeriod: string;
  isLoadingNewCustomer: boolean;
  handleNewCustomerViewAll: () => void;
  handleNewCustomerSalespersonClick: (salesperson: string) => void;
  handleNewCustomerBack: () => void;
  handleNewCustomerPeriodChange: (value: string | null) => void;

  // Lost Customer props
  lostCustomerDrillLevel: 0 | 1 | 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lostCustomerRawData: any;
  lostCustomerSelectedSalesperson: string | null;
  lostCustomerPeriod: string;
  isLoadingLostCustomer: boolean;
  handleLostCustomerViewAll: () => void;
  handleLostCustomerSalespersonClick: (salesperson: string) => void;
  handleLostCustomerBack: () => void;
  handleLostCustomerPeriodChange: (value: string | null) => void;

  // Customer Not Visited props
  customerNotVisitedDrillLevel: 0 | 1 | 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customerNotVisitedRawData: any;
  customerNotVisitedSelectedSalesperson: string | null;
  customerNotVisitedPeriod: string;
  isLoadingCustomerNotVisited: boolean;
  handleCustomerNotVisitedViewAll: () => void;
  handleCustomerNotVisitedCompanyClick: (companyName: string) => void;
  handleCustomerNotVisitedSalespersonClick: (salesperson: string) => void;
  handleCustomerNotVisitedBack: () => void;
  handleCustomerNotVisitedPeriodChange: (value: string | null) => void;

  // Common period filter
  customerInteractionPeriod: string;
  setCustomerInteractionPeriod: (value: string) => void;
}

const CustomerInteractionStatus = ({
  newCustomerDrillLevel,
  newCustomerRawData,
  newCustomerSelectedSalesperson,
  newCustomerPeriod,
  isLoadingNewCustomer,
  handleNewCustomerViewAll,
  handleNewCustomerSalespersonClick,
  handleNewCustomerBack,
  handleNewCustomerPeriodChange,
  lostCustomerDrillLevel,
  lostCustomerRawData,
  lostCustomerSelectedSalesperson,
  lostCustomerPeriod,
  isLoadingLostCustomer,
  handleLostCustomerViewAll,
  handleLostCustomerSalespersonClick,
  handleLostCustomerBack,
  handleLostCustomerPeriodChange,
  customerNotVisitedDrillLevel,
  customerNotVisitedRawData,
  customerNotVisitedSelectedSalesperson,
  customerNotVisitedPeriod,
  isLoadingCustomerNotVisited,
  handleCustomerNotVisitedViewAll,
  handleCustomerNotVisitedCompanyClick,
  handleCustomerNotVisitedSalespersonClick,
  handleCustomerNotVisitedBack,
  handleCustomerNotVisitedPeriodChange,
  customerInteractionPeriod,
  setCustomerInteractionPeriod,
}: CustomerInteractionStatusProps) => {
  return (
    <Box mb="lg">
      <Group justify="space-between" align="center" mb="md">
        <Text size="lg" fw={600}>
          Customer Interaction Status
        </Text>
        <Select
          placeholder="Select Period"
          value={customerInteractionPeriod}
          onChange={(value) =>
            setCustomerInteractionPeriod(value || "last_3_months")
          }
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

      <Grid>
        <Grid.Col span={4}>
          <NewCustomers
            drillLevel={newCustomerDrillLevel}
            data={newCustomerRawData}
            selectedSalesperson={newCustomerSelectedSalesperson}
            period={newCustomerPeriod}
            loading={isLoadingNewCustomer}
            handleViewAll={handleNewCustomerViewAll}
            handleSalespersonClick={handleNewCustomerSalespersonClick}
            handleBack={handleNewCustomerBack}
            handlePeriodChange={handleNewCustomerPeriodChange}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <CustomerNotVisited
            drillLevel={customerNotVisitedDrillLevel}
            data={customerNotVisitedRawData}
            selectedSalesperson={customerNotVisitedSelectedSalesperson}
            period={customerNotVisitedPeriod}
            loading={isLoadingCustomerNotVisited}
            handleViewAll={handleCustomerNotVisitedViewAll}
            handleCompanyClick={handleCustomerNotVisitedCompanyClick}
            handleSalespersonClick={handleCustomerNotVisitedSalespersonClick}
            handleBack={handleCustomerNotVisitedBack}
            handlePeriodChange={handleCustomerNotVisitedPeriodChange}
          />
        </Grid.Col>

        <Grid.Col span={4}>
          <LostCustomer
            drillLevel={lostCustomerDrillLevel}
            data={lostCustomerRawData}
            selectedSalesperson={lostCustomerSelectedSalesperson}
            period={lostCustomerPeriod}
            loading={isLoadingLostCustomer}
            handleViewAll={handleLostCustomerViewAll}
            handleSalespersonClick={handleLostCustomerSalespersonClick}
            handleBack={handleLostCustomerBack}
            handlePeriodChange={handleLostCustomerPeriodChange}
          />
        </Grid.Col>
      </Grid>
    </Box>
  );
};

export default CustomerInteractionStatus;
