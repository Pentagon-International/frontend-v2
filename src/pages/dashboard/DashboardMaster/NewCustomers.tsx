import { useMemo } from "react";
import {
  Card,
  Group,
  Text,
  Box,
  Select,
  Stack,
  Center,
  Loader,
  Badge,
  Button,
} from "@mantine/core";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  NewCustomerSalesperson,
  NewCustomerItem,
} from "../../../service/dashboard.service";

interface NewCustomersProps {
  // State props
  drillLevel: 0 | 1 | 2;
  data: any;
  selectedSalesperson: string | null;
  period: string;
  loading: boolean;

  // Handlers
  handleViewAll: () => void;
  handleSalespersonClick: (salesperson: string) => void;
  handleBack: () => void;
  handlePeriodChange: (value: string | null) => void;
}

const NewCustomers = ({
  drillLevel,
  data,
  selectedSalesperson,
  period,
  loading,
  handleViewAll,
  handleSalespersonClick,
  handleBack,
  handlePeriodChange,
}: NewCustomersProps) => {
  // Filter data by search term
  const filteredDisplayData = useMemo(() => {
    if (!data) return [];

    let displayData: any[] = [];

    if (drillLevel === 0) {
      // Level 1: Salesperson list - filter only salespersons with customer_count > 0
      const salespersons = data.data as NewCustomerSalesperson[];
      const filteredSalespersons = salespersons.filter(
        (item) => item.customer_count > 0
      );
      displayData = filteredSalespersons.map((item) => ({
        label: item.user_name,
        value: item.customer_count || 0,
        onClick: () => handleSalespersonClick(item.user_name),
      }));
    } else if (drillLevel === 1) {
      // Level 2: Customer list
      const customers = data.data as NewCustomerItem[];
      displayData = customers.map((item) => ({
        label: item.customer_name,
        value: item.job_date || "-",
        onClick: () => {},
      }));
    }

    return displayData;
  }, [data, drillLevel, handleSalespersonClick]);

  // Get summary data
  const summaryData = useMemo(() => {
    if (!data)
      return {
        primary: 0,
        secondary: 0,
        primaryLabel: "",
        secondaryLabel: "",
      };

    if (drillLevel === 0) {
      // Calculate total customers from salespersons with customer_count > 0
      const salespersons = data.data as NewCustomerSalesperson[];
      const filteredSalespersons = salespersons.filter(
        (item) => item.customer_count > 0
      );

      const totalCustomers = filteredSalespersons.reduce(
        (sum: number, salesperson: NewCustomerSalesperson) =>
          sum + salesperson.customer_count,
        0
      );

      return {
        primary: totalCustomers,
        secondary: filteredSalespersons.length, // Count of salespersons with customers
        primaryLabel: "Total Customers",
        secondaryLabel: "Total Salespersons",
      };
    } else {
      return {
        primary: data.data?.length || 0,
        secondary: 0,
        primaryLabel: "Total Customers",
        secondaryLabel: selectedSalesperson || "",
      };
    }
  }, [data, drillLevel, selectedSalesperson]);

  // Prepare columns for the mini table - memoized
  const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
    if (drillLevel === 0) {
      return [
        {
          accessorKey: "sno",
          header: "S.No",
          size: 60,
          minSize: 50,
          maxSize: 70,
          enableColumnFilter: false,
          enableSorting: false,
        },
        {
          accessorKey: "label",
          header: "SALESPERSON",
          Cell: ({ row }) => (
            <Text
              size="sm"
              style={{ cursor: "pointer", color: "#105476" }}
              onClick={row.original.onClick}
            >
              {row.original.label}
            </Text>
          ),
        },
        {
          accessorKey: "value",
          header: "NEW CUSTOMERS",
          Cell: ({ row }) => (
            <Badge color="#27ae60" size="md" variant="filled">
              {row.original.value}
            </Badge>
          ),
          size: 150,
        },
      ];
    } else {
      return [
        {
          accessorKey: "sno",
          header: "S.No",
          size: 60,
          minSize: 50,
          maxSize: 70,
          enableColumnFilter: false,
          enableSorting: false,
        },
        {
          accessorKey: "label",
          header: "CUSTOMER NAME",
          Cell: ({ row }) => <Text size="sm">{row.original.label}</Text>,
        },
        {
          accessorKey: "value",
          header: "JOB DATE",
          Cell: ({ row }) => <Text size="sm">{row.original.value}</Text>,
          size: 120,
        },
      ];
    }
  }, [drillLevel]);

  // Show only first 5 items in dashboard view
  const displayDataLimited = useMemo(() => {
    return filteredDisplayData.slice(0, 5);
  }, [filteredDisplayData]);

  const remainingCount = filteredDisplayData.length - 5;

  const table = useMantineReactTable({
    columns,
    data: displayDataLimited,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableStickyHeader: true,
    mantineTableProps: {
      striped: true,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: "#f8f9fa",
      },
    },
    mantineTableContainerProps: {
      style: {
        maxHeight: "200px",
        overflowY: "auto",
      },
    },
  });

  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      h={400}
      style={{ border: "1px solid #e9ecef" }}
    >
      {/* Header */}
      <Group justify="space-between" align="center" mb="xs">
        <Text size="md" fw={500} c="Black">
          New Customers
        </Text>
        <Text
          size="md"
          c="#105476"
          style={{
            textDecoration: "underline",
            cursor: "pointer",
          }}
          onClick={handleViewAll}
        >
          View All
        </Text>
      </Group>

      {/* Second row: Period filter + Back Button */}
      <Group justify="space-between" align="center" mb="md">
        <Select
          placeholder="Select period"
          data={[
            { value: "weekly", label: "Last Week" },
            { value: "monthly", label: "Last Month" },
            { value: "quarterly", label: "Last 3 Months" },
            { value: "half-yearly", label: "Last 6 Months" },
            { value: "yearly", label: "Last Year" },
          ]}
          value={period}
          onChange={handlePeriodChange}
          size="xs"
          style={{ width: "150px" }}
        />
        {drillLevel > 0 && (
          <Button
            size="compact-xs"
            variant="light"
            onClick={handleBack}
            disabled={loading}
          >
            Back
          </Button>
        )}
      </Group>

      {/* Summary Section */}
      <Group mb="md" justify="space-between" ml="md" mr="md">
        <Stack gap={4} align="center">
          <Text size="xs" c="dimmed">
            {summaryData.primaryLabel}
          </Text>
          <Badge color="#105476" size="lg" variant="filled">
            {summaryData.primary}
          </Badge>
        </Stack>
        {drillLevel !== 1 ? (
          <Stack gap={4} align="center">
            <Text size="xs" c="dimmed">
              {summaryData.secondaryLabel}
            </Text>
            <Badge color="#086ea1" size="lg" variant="filled">
              {summaryData.secondary}
            </Badge>
          </Stack>
        ) : (
          <Stack gap={4} align="center">
            <Text size="xs" c="dimmed">
              Salesperson
            </Text>
            <Text size="sm" fw={600} c="#105476">
              {summaryData.secondaryLabel}
            </Text>
          </Stack>
        )}
      </Group>

      {/* Table */}
      <Box>
        {loading ? (
          <Center py="xl">
            <Loader size="md" color="#105476" />
          </Center>
        ) : filteredDisplayData.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed">No data available</Text>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />

            {/* View More Button */}
            {remainingCount > 0 && (
              <Center mt="sm">
                <Button
                  variant="subtle"
                  size="xs"
                  color="#105476"
                  onClick={handleViewAll}
                >
                  View More
                </Button>
              </Center>
            )}
          </>
        )}
      </Box>
    </Card>
  );
};

export default NewCustomers;
