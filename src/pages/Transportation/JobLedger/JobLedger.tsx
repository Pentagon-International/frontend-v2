import React, { useState, useMemo } from "react";
import {
  Paper,
  Box,
  Group,
  Text,
  Select,
  TextInput,
  Button,
  Tabs,
  Grid,
  Divider,
  Stack,
  ActionIcon,
} from "@mantine/core";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { 
  IconSearch, 
  IconFilter, 
  IconDownload, 
  IconX,
} from "@tabler/icons-react";

interface JobLedgerData {
  id: number;
  segment: string;
  job: string;
  subjob: string;
  daybookCode: string;
  daybookName: string;
  documentNo: string;
  date: string;
  debit: number;
  credit: number;
  revenue: number;
  actualCost: number;
  neutral: number;
}

interface JobLedgerProps {}

type FilterState = {
  segmentCode: string | null;
  jobNo: string | null;
  subjobNo: string | null;
  hblHawbNo: string | null;
  withAutoEntry: string | null;
  types: string | null;
  status: string | null;
};

const JobLedger: React.FC<JobLedgerProps> = () => {
  const [activeTab, setActiveTab] = useState<string | null>("document");
  const [searchValue, setSearchValue] = useState("");
  const [filterType, setFilterType] = useState<string | null>("all");
  const [filterStatus, setFilterStatus] = useState<string | null>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    segmentCode: null,
    jobNo: null,
    subjobNo: null,
    hblHawbNo: null,
    withAutoEntry: null,
    types: null,
    status: null,
  });

  // Mock data for the table
  const tableData = useMemo(() => [
    {
      id: 1,
      segment: "AIR",
      job: "JOB001",
      subjob: "SUB001",
      daybookCode: "DB001",
      daybookName: "Sales Daybook",
      documentNo: "DOC001",
      date: "2024-03-24",
      debit: 1500.00,
      credit: 0.00,
      revenue: 1500.00,
      actualCost: 1200.00,
      neutral: 300.00,
    },
    {
      id: 2,
      segment: "SEA",
      job: "JOB002",
      subjob: "SUB002",
      daybookCode: "DB002",
      daybookName: "Purchase Daybook",
      documentNo: "DOC002",
      date: "2024-03-23",
      debit: 0.00,
      credit: 500.00,
      revenue: 800.00,
      actualCost: 600.00,
      neutral: 200.00,
    },
    {
      id: 3,
      segment: "AIR",
      job: "JOB003",
      subjob: "SUB003",
      daybookCode: "DB003",
      daybookName: "Journal Daybook",
      documentNo: "DOC003",
      date: "2024-03-22",
      debit: 200.00,
      credit: 0.00,
      revenue: 200.00,
      actualCost: 150.00,
      neutral: 50.00,
    },
     {
      id: 1,
      segment: "AIR",
      job: "JOB001",
      subjob: "SUB001",
      daybookCode: "DB001",
      daybookName: "Sales Daybook",
      documentNo: "DOC001",
      date: "2024-03-24",
      debit: 1500.00,
      credit: 0.00,
      revenue: 1500.00,
      actualCost: 1200.00,
      neutral: 300.00,
    },
    {
      id: 2,
      segment: "SEA",
      job: "JOB002",
      subjob: "SUB002",
      daybookCode: "DB002",
      daybookName: "Purchase Daybook",
      documentNo: "DOC002",
      date: "2024-03-23",
      debit: 0.00,
      credit: 500.00,
      revenue: 800.00,
      actualCost: 600.00,
      neutral: 200.00,
    },
    {
      id: 3,
      segment: "AIR",
      job: "JOB003",
      subjob: "SUB003",
      daybookCode: "DB003",
      daybookName: "Journal Daybook",
      documentNo: "DOC003",
      date: "2024-03-22",
      debit: 200.00,
      credit: 0.00,
      revenue: 200.00,
      actualCost: 150.00,
      neutral: 50.00,
    },
     {
      id: 1,
      segment: "AIR",
      job: "JOB001",
      subjob: "SUB001",
      daybookCode: "DB001",
      daybookName: "Sales Daybook",
      documentNo: "DOC001",
      date: "2024-03-24",
      debit: 1500.00,
      credit: 0.00,
      revenue: 1500.00,
      actualCost: 1200.00,
      neutral: 300.00,
    },
    {
      id: 2,
      segment: "SEA",
      job: "JOB002",
      subjob: "SUB002",
      daybookCode: "DB002",
      daybookName: "Purchase Daybook",
      documentNo: "DOC002",
      date: "2024-03-23",
      debit: 0.00,
      credit: 500.00,
      revenue: 800.00,
      actualCost: 600.00,
      neutral: 200.00,
    },
    {
      id: 3,
      segment: "AIR",
      job: "JOB003",
      subjob: "SUB003",
      daybookCode: "DB003",
      daybookName: "Journal Daybook",
      documentNo: "DOC003",
      date: "2024-03-22",
      debit: 200.00,
      credit: 0.00,
      revenue: 200.00,
      actualCost: 150.00,
      neutral: 50.00,
    },
     {
      id: 1,
      segment: "AIR",
      job: "JOB001",
      subjob: "SUB001",
      daybookCode: "DB001",
      daybookName: "Sales Daybook",
      documentNo: "DOC001",
      date: "2024-03-24",
      debit: 1500.00,
      credit: 0.00,
      revenue: 1500.00,
      actualCost: 1200.00,
      neutral: 300.00,
    },
    {
      id: 2,
      segment: "SEA",
      job: "JOB002",
      subjob: "SUB002",
      daybookCode: "DB002",
      daybookName: "Purchase Daybook",
      documentNo: "DOC002",
      date: "2024-03-23",
      debit: 0.00,
      credit: 500.00,
      revenue: 800.00,
      actualCost: 600.00,
      neutral: 200.00,
    },
    {
      id: 3,
      segment: "AIR",
      job: "JOB003",
      subjob: "SUB003",
      daybookCode: "DB003",
      daybookName: "Journal Daybook",
      documentNo: "DOC003",
      date: "2024-03-22",
      debit: 200.00,
      credit: 0.00,
      revenue: 200.00,
      actualCost: 150.00,
      neutral: 50.00,
    },
     {
      id: 1,
      segment: "AIR",
      job: "JOB001",
      subjob: "SUB001",
      daybookCode: "DB001",
      daybookName: "Sales Daybook",
      documentNo: "DOC001",
      date: "2024-03-24",
      debit: 1500.00,
      credit: 0.00,
      revenue: 1500.00,
      actualCost: 1200.00,
      neutral: 300.00,
    },
    {
      id: 2,
      segment: "SEA",
      job: "JOB002",
      subjob: "SUB002",
      daybookCode: "DB002",
      daybookName: "Purchase Daybook",
      documentNo: "DOC002",
      date: "2024-03-23",
      debit: 0.00,
      credit: 500.00,
      revenue: 800.00,
      actualCost: 600.00,
      neutral: 200.00,
    },
    {
      id: 3,
      segment: "AIR",
      job: "JOB003",
      subjob: "SUB003",
      daybookCode: "DB003",
      daybookName: "Journal Daybook",
      documentNo: "DOC003",
      date: "2024-03-22",
      debit: 200.00,
      credit: 0.00,
      revenue: 200.00,
      actualCost: 150.00,
      neutral: 50.00,
    },
  ], []);

  // Filter functions
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      segmentCode: null,
      jobNo: null,
      subjobNo: null,
      hblHawbNo: null,
      withAutoEntry: null,
      types: null,
      status: null,
    });
    setShowFilters(false);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalDebit = tableData.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = tableData.reduce((sum, row) => sum + row.credit, 0);
    const totalRevenue = tableData.reduce((sum, row) => sum + row.revenue, 0);
    const totalActualCost = tableData.reduce((sum, row) => sum + row.actualCost, 0);
    const totalNeutral = tableData.reduce((sum, row) => sum + row.neutral, 0);
    
    return {
      totalDebit,
      totalCredit,
      totalRevenue,
      totalActualCost,
      totalNeutral,
    };
  }, [tableData]);

  // Columns definition for MantineReactTable
  const columns = useMemo<MRT_ColumnDef<JobLedgerData>[]>(
    () => [
      {
        accessorKey: "segment",
        header: "Segment",
        size: 100,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "job",
        header: "Job",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "subjob",
        header: "Subjob",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "daybookCode",
        header: "Daybook Code",
        size: 140,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "daybookName",
        header: "Daybook Name",
        size: 160,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "documentNo",
        header: "Document number",
        size: 160,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "debit",
        header: "Debit",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return value > 0 ? `$${value.toFixed(2)}` : "-";
        },
        mantineTableBodyCellProps: {
          style: {  backgroundColor: "#FBFBFB" },
        },
        mantineTableHeadCellProps: {
          style: {  backgroundColor: "#FBFBFB" },
        },
      },
      {
        accessorKey: "credit",
        header: "Credit",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return value > 0 ? `$${value.toFixed(2)}` : "-";
        },
        mantineTableBodyCellProps: {
          style: {  backgroundColor: "#FBFBFB" },
        },
        mantineTableHeadCellProps: {
          style: { backgroundColor: "#FBFBFB" },
        },
      },
      {
        accessorKey: "revenue",
        header: "Revenue",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `$${value.toFixed(2)}`;
        },
        mantineTableBodyCellProps: {
          style: {  backgroundColor: "#FBFBFB" },
        },
        mantineTableHeadCellProps: {
          style: {  backgroundColor: "#FBFBFB" },
        },
      },
      {
        accessorKey: "actualCost",
        header: "Actual cost",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `$${value.toFixed(2)}`;
        },
        mantineTableBodyCellProps: {
          style: {  backgroundColor: "#FBFBFB" },
        },
        mantineTableHeadCellProps: {
          style: { backgroundColor: "#FBFBFB" },
        },
      },
      {
        accessorKey: "neutral",
        header: "Neutral",
        size: 120,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `$${value.toFixed(2)}`;
        },
        mantineTableBodyCellProps: {
          style: { backgroundColor: "#FBFBFB" },
        },
        mantineTableHeadCellProps: {
          style: {  backgroundColor: "#FBFBFB" },
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useMantineReactTable({
    columns,
    data: tableData,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableColumnPinning: false,
    enableStickyHeader: true,
    layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%" },
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "1536px",
        overflow: "auto",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        width: "fit-content",
        padding: "8px 16px",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#333740",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        width: "fit-content",
        padding: "8px 16px",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#444955",
        backgroundColor: "#FBFBFB",
        borderBottom: "1px solid #F3F3F3",
        top: 0,
        zIndex: 3,
      },
    },
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
      },
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Box py="xl" ta="center">
            <Stack align="center" gap="md">
              <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                No data to display
              </Text>
            </Stack>
          </Box>
        </td>
      </tr>
    ),
  });

  return (
    <Box p="md">
      {/* Header */}
      {/* <Paper shadow="xs" p="lg" mb="md" withBorder> */}
        {/* <Group justify="space-between" mb="md">
          <Text size="lg" fw={600} c="#105476">
            Job Ledger
          </Text>
          <Group>
            <Button
              variant={showFilters ? "filled" : "outline"}
              leftSection={<IconFilter size={16} />}
              size="sm"
              onClick={toggleFilters}
              styles={{
                root: {
                  backgroundColor: showFilters ? "#105476" : "transparent",
                  borderRadius: "4px",
                  color: showFilters ? "white" : "#105476",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  border: "1px solid #105476",
                  "&:hover": {
                    backgroundColor: showFilters ? "#105476" : "#E0F5FF",
                  },
                },
              }}
            >
              {/* Filters */}
            {/* </Button> */}
            {/* <Button
              variant="outline"
              size="sm"
              leftSection={<IconDownload size={16} />}
            >
              Export
            </Button> */}
          {/* </Group>
        </Group> */}

        {/* Filter Section */}
        {/* {showFilters && (
          <Box
            tt="capitalize"
            mb="sm"
            p="sm"
            style={{
              backgroundColor: "#F8F9FA",
              borderRadius: "8px",
              border: "1px solid #E9ECEF",
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text
                size="sm"
                fw={600}
                c="#000000"
                style={{ fontFamily: "Inter", fontSize: "14px" }}
              >
                Filter
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
                size="sm"
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>

            <Grid gutter="sm" px="md" pt="xs" pb="sm">
              <Grid.Col span={2}>
                <TextInput
                  label="Segment Code"
                  placeholder="Enter Segment Code"
                  size="xs"
                  value={filters.segmentCode || ""}
                  onChange={(e) =>
                    updateFilter("segmentCode", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Job No"
                  placeholder="Enter Job No"
                  size="xs"
                  value={filters.jobNo || ""}
                  onChange={(e) =>
                    updateFilter("jobNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Subjob No"
                  placeholder="Enter Subjob No"
                  size="xs"
                  value={filters.subjobNo || ""}
                  onChange={(e) =>
                    updateFilter("subjobNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="HBL/HAWB No."
                  placeholder="Enter HBL/HAWB No"
                  size="xs"
                  value={filters.hblHawbNo || ""}
                  onChange={(e) =>
                    updateFilter("hblHawbNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="With Auto Entry"
                  placeholder="Select option"
                  size="xs"
                  data={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  value={filters.withAutoEntry}
                  onChange={updateFilter.bind(null, "withAutoEntry")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="Types"
                  placeholder="Select type"
                  size="xs"
                  data={[
                    { value: "invoice", label: "Invoice" },
                    { value: "receipt", label: "Receipt" },
                    { value: "journal", label: "Journal" },
                    { value: "payment", label: "Payment" },
                  ]}
                  value={filters.types}
                  onChange={updateFilter.bind(null, "types")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="Status"
                  placeholder="Select status"
                  size="xs"
                  data={[
                    { value: "paid", label: "Paid" },
                    { value: "pending", label: "Pending" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  value={filters.status}
                  onChange={updateFilter.bind(null, "status")}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Group gap="sm" mt="lg">
                  <Button
                    size="xs"
                    onClick={clearAllFilters}
                    variant="outline"
                    style={{
                      borderColor: "#105476",
                      color: "#105476",
                      fontSize: "12px",
                      fontFamily: "Inter",
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    size="xs"
                    variant="filled"
                    style={{
                      backgroundColor: "#105476",
                      color: "white",
                      fontSize: "12px",
                      fontFamily: "Inter",
                      "&:hover": {
                        backgroundColor: "#0d3a5a",
                      },
                    }}
                  >
                    Apply
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )} */}

        {/* Filter Section */}
        {/* <Grid> */}
          {/* <Grid.Col span={3}>
            <TextInput
              placeholder="Search..."
              leftSection={<IconSearch size={16} />}
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
            />
          </Grid.Col> */}
          {/* <Grid.Col span={2}>
            <Select
              placeholder="Filter Type"
              data={[
                { value: "all", label: "All Types" },
                { value: "invoice", label: "Invoice" },
                { value: "receipt", label: "Receipt" },
                { value: "journal", label: "Journal" },
              ]}
              value={filterType}
              onChange={setFilterType}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              placeholder="Filter Status"
              data={[
                { value: "all", label: "All Status" },
                { value: "paid", label: "Paid" },
                { value: "pending", label: "Pending" },
                { value: "completed", label: "Completed" },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Button
              variant="outline"
              leftSection={<IconFilter size={16} />}
              fullWidth
            >
              Apply Filters
            </Button>
          </Grid.Col> */}
        {/* </Grid> */}
      {/* </Paper> */}

      {/* Tabs Section */}
      <Paper shadow="xs" p="lg" mb="md" withBorder>
                <Group justify="space-between" mb="md">
          <Text size="lg" fw={600} c="#105476">
            Job Ledger
          </Text>
          <Group>
            <Button
              variant={showFilters ? "filled" : "outline"}
              leftSection={<IconFilter size={16} />}
              size="sm"
              onClick={toggleFilters}
              styles={{
                root: {
                  backgroundColor: showFilters ? "#105476" : "transparent",
                  borderRadius: "4px",
                  color: showFilters ? "white" : "#105476",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  border: "1px solid #105476",
                  "&:hover": {
                    backgroundColor: showFilters ? "#105476" : "#E0F5FF",
                  },
                },
              }}
            >
              {/* Filters */}
            </Button>
            {/* <Button
              variant="outline"
              size="sm"
              leftSection={<IconDownload size={16} />}
            >
              Export
            </Button> */}
          </Group>
        </Group>

        {/* Filter Section */}
        {showFilters && (
          <Box
            tt="capitalize"
            mb="sm"
            p="sm"
            style={{
              backgroundColor: "#F8F9FA",
              borderRadius: "8px",
              border: "1px solid #E9ECEF",
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text
                size="sm"
                fw={600}
                c="#000000"
                style={{ fontFamily: "Inter", fontSize: "14px" }}
              >
                Filter
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
                size="sm"
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>

            <Grid gutter="sm" px="md" pt="xs" pb="sm">
              <Grid.Col span={2}>
                <TextInput
                  label="Segment Code"
                  placeholder="Enter Segment Code"
                  size="xs"
                  value={filters.segmentCode || ""}
                  onChange={(e) =>
                    updateFilter("segmentCode", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Job No"
                  placeholder="Enter Job No"
                  size="xs"
                  value={filters.jobNo || ""}
                  onChange={(e) =>
                    updateFilter("jobNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Subjob No"
                  placeholder="Enter Subjob No"
                  size="xs"
                  value={filters.subjobNo || ""}
                  onChange={(e) =>
                    updateFilter("subjobNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="HBL/HAWB No."
                  placeholder="Enter HBL/HAWB No"
                  size="xs"
                  value={filters.hblHawbNo || ""}
                  onChange={(e) =>
                    updateFilter("hblHawbNo", e.target.value || null)
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="With Auto Entry"
                  placeholder="Select option"
                  size="xs"
                  data={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  value={filters.withAutoEntry}
                  onChange={updateFilter.bind(null, "withAutoEntry")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="Types"
                  placeholder="Select type"
                  size="xs"
                  data={[
                    { value: "invoice", label: "Invoice" },
                    { value: "receipt", label: "Receipt" },
                    { value: "journal", label: "Journal" },
                    { value: "payment", label: "Payment" },
                  ]}
                  value={filters.types}
                  onChange={updateFilter.bind(null, "types")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <Select
                  label="Status"
                  placeholder="Select status"
                  size="xs"
                  data={[
                    { value: "paid", label: "Paid" },
                    { value: "pending", label: "Pending" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  value={filters.status}
                  onChange={updateFilter.bind(null, "status")}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Group gap="sm" mt="lg">
                  <Button
                    size="xs"
                    onClick={clearAllFilters}
                    variant="outline"
                    style={{
                      borderColor: "#105476",
                      color: "#105476",
                      fontSize: "12px",
                      fontFamily: "Inter",
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    size="xs"
                    variant="filled"
                    style={{
                      backgroundColor: "#105476",
                      color: "white",
                      fontSize: "12px",
                      fontFamily: "Inter",
                      "&:hover": {
                        backgroundColor: "#0d3a5a",
                      },
                    }}
                  >
                    Apply
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="document">Document Wise</Tabs.Tab>
            <Tabs.Tab value="charge">Charge Wise</Tabs.Tab>
            <Tabs.Tab value="links">Links</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="document" pt="md">
            {/* Document Wise Content */}
            <Box style={{ height: "600px", display: "flex", flexDirection: "column" }}>
              {/* Table */}
              <Box style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <MantineReactTable table={table} />
              </Box>

              {/* Totals Section */}
              <Divider my="md" />
              <Box>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Debit
                      </Text>
                      <Text size="lg" fw={600}>
                        ${totals.totalDebit.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Credit
                      </Text>
                      <Text size="lg" fw={600}>
                        ${totals.totalCredit.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Revenue
                      </Text>
                      <Text size="lg" fw={600}>
                        ${totals.totalRevenue.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Actual Cost
                      </Text>
                      <Text size="lg" fw={600}>
                        ${totals.totalActualCost.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Neutral
                      </Text>
                      <Text size="lg" fw={600} c="#105476">
                        ${totals.totalNeutral.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Box>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="charge" pt="md">
            <Text c="dimmed">Charge Wise View - To be implemented</Text>
          </Tabs.Panel>

          <Tabs.Panel value="links" pt="md">
            <Text c="dimmed">Links View - To be implemented</Text>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Box>
  );
};

export default JobLedger;