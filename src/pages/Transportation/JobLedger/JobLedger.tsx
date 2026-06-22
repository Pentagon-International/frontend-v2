import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Loader,
  Tooltip,
} from "@mantine/core";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { 
  IconFilter, 
  IconChevronLeft,
  IconX,
} from "@tabler/icons-react";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";

interface JobLedgerData {
  id: number;
  segment: string;
  job: string;
  sno: number;
  subjob: string;
  documentType: string;
  daybookName: string;
  documentNo: string;
  date: string;
  partyName: string;
  currencyCode: string;
  debit: number;
  credit: number;
  revenue: number;
  actualCost: number;
  neutral: number;
  reversed: boolean;
}

interface JobLedgerProps {}

type FilterState = {
  segmentCode: string | null;
  jobNo: string | null;
  location: string | null;
  subjobNo: string | null;
  hbl_hawb_no: string | null;
  withAutoEntry: string | null;
  status: string | null;
};

type JobLedgerSummary = {
  total_debit?: number | null;
  total_credit?: number | null;
  total_revence?: number | null;
  total_cost?: number | null;
  total_neutral?: number | null;
  net_profit_Credit_Debit?: number | null;
  net_profit_revenue_cost?: number | null;
};

type JobLedgerApiRow = {
  sno?: number;
  service?: string;
  job_id?: string;
  location?: string;
  branch_name?: string;
  hbl_hawb_no?: string;
  day_book_code?: string;
  day_book_name?: string;
  document_type?: string;
  document_no?: string;
  date?: string;
  party_name?: string;
  currency_code?: string;
  debit_local_amount?: number | null;
  credit_local_amount?: number | null;
  revence?: number | null;
  cost?: number | null;
  neutral?: number | null;
  reversed?: boolean;
};

type JobLedgerApiResponse = {
  job_id?: string;
  total?: number;
  summary?: JobLedgerSummary;
  data?: JobLedgerApiRow[];
};

type JobLedgerRequestFilters = {
  job_id: string;
  location: string;
  segment_code: string;
  hbl_hawb_no: string;
};

type ServiceMasterRow = {
  service_code?: string | number | null;
  service_name?: string | null;
};

const JobLedger: React.FC<JobLedgerProps> = () => {
  const [activeTab, setActiveTab] = useState<string | null>("document");
  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();
  const routerLocation = useLocation();
  const navState = (routerLocation.state ?? {}) as any;

  const inferredJobIdFinal: string | null =
    (navState?.jobId as string | number | null)?.toString?.() ??
    (navState?.job_id as string | number | null)?.toString?.() ??
    (navState?.id as string | number | null)?.toString?.() ??
    null;

  const inferredLocationFinal: string | null =
    (navState?.location as string | null) ?? null;

  const inferredSegmentCodeFinal: string | null =
    (navState?.segment_code as string | null) ??
    (navState?.segmentCode as string | null) ??
    null;

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    segmentCode: inferredSegmentCodeFinal,
    jobNo: inferredJobIdFinal,
    location: inferredLocationFinal,
    subjobNo: null,
    hbl_hawb_no: null,
    withAutoEntry: null,
    status: null,
  });

  // Real data (loaded from API)
  const [tableData, setTableData] = useState<JobLedgerData[]>([]);
  const [jobLedgerSummary, setJobLedgerSummary] = useState<JobLedgerSummary | null>(null);
  const [jobLedgerLoading, setJobLedgerLoading] = useState<boolean>(false);
  const [jobLedgerError, setJobLedgerError] = useState<string | null>(null);
  const [apiFilters, setApiFilters] = useState<JobLedgerRequestFilters | null>(null);
  const [segmentOptions, setSegmentOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [segmentOptionsLoading, setSegmentOptionsLoading] = useState(false);

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
    // setFilters({
    //   segmentCode: null,
    //   jobNo: null,
    //   location: null,
    //   subjobNo: null,
    //   hbl_hawb_no: null,
    //   withAutoEntry: null,
    //   status: null,
    // });
    setFilters({
      segmentCode: null,
      jobNo: inferredJobIdFinal,
      location: null,
      subjobNo: null,
      hbl_hawb_no: null,
      withAutoEntry: null,
      status: null,
    });
    setApiFilters(null);
    setTableData([]);
    setJobLedgerSummary(null);
    setJobLedgerError(null);
    setShowFilters(false);
  };

  const toNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const buildJobLedgerFiltersFromUI = (
    uiFilters: FilterState,
  ): JobLedgerRequestFilters => {
    return {
      job_id: (uiFilters.jobNo ?? "").toString().trim(),
      location: (uiFilters.location ?? "").toString().trim(),
      segment_code: (uiFilters.segmentCode ?? "").toString().trim(),
      hbl_hawb_no: (uiFilters.hbl_hawb_no ?? "").toString().trim(),
    };
  };

  const fetchJobLedger = async (requestFilters: JobLedgerRequestFilters) => {
    setJobLedgerLoading(true);
    setJobLedgerError(null);
    setTableData([]);
    setJobLedgerSummary(null);
    try {
      const response = await apiCallProtected.post(
        `${URL.jobLedger}`,
        { filters: requestFilters },
        API_HEADER,
      );
      const result = response as JobLedgerApiResponse;
      const apiRows = Array.isArray(result?.data) ? result.data : [];
      setJobLedgerSummary(result?.summary ?? null);
      setTableData(
        apiRows.map((d, idx) => {
          const id = Number(d?.sno ?? idx + 1);
          return {
            id: Number.isFinite(id) ? id : idx + 1,
            segment: (d?.service ?? "").toString(),
            job: (d?.job_id ?? "").toString(),
            sno:d?.sno ?? 0,
            // Response doesn't have "subjob" like the UI. Using HBL/AWB as a closest match.
            subjob: (d?.hbl_hawb_no ?? "").toString(),
            documentType: (d?.document_type ?? "").toString(),
            daybookName: (d?.day_book_name ?? "").toString(),
            documentNo: (d?.document_no ?? "").toString(),
            date: (d?.date ?? "").toString(),
            partyName: (d?.party_name ?? "").toString(),
            currencyCode: (d?.currency_code ?? "").toString(),
            debit: toNumber(d?.debit_local_amount),
            credit: toNumber(d?.credit_local_amount),
            revenue: toNumber(d?.revence),
            actualCost: toNumber(d?.cost),
            neutral: toNumber(d?.neutral),
            reversed: Boolean(d?.reversed),
          };
        }),
      );
    } catch (err) {
      setJobLedgerError("Failed to load Job Ledger. Please try again.");
      setTableData([]);
      setJobLedgerSummary(null);
      // eslint-disable-next-line no-console
      console.error("JobLedger fetch error:", err);
    } finally {
      setJobLedgerLoading(false);
    }
  };

  const handleApplyFilters = () => {
    const built = buildJobLedgerFiltersFromUI(filters);
    setJobLedgerError(null);
    setApiFilters(built);
    fetchJobLedger(built);
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchServiceMaster() {
      setSegmentOptionsLoading(true);
      try {
        const res = await apiCallProtected.get(`${URL.serviceMaster}`, API_HEADER);
        const rows = (res?.data ?? res) as ServiceMasterRow[];
        const list = Array.isArray(rows) ? rows : [];

        const options = list
          .map((r) => ({
            value: (r?.service_code ?? "").toString(),
            label: (r?.service_name ?? "").toString(),
          }))
          .filter((o) => o.value && o.label);

        if (!isMounted) return;
        setSegmentOptions(options);
      } catch (e) {
        if (!isMounted) return;
        setSegmentOptions([]);
      } finally {
        if (!isMounted) return;
        setSegmentOptionsLoading(false);
      }
    }

    fetchServiceMaster();
    return () => {
      isMounted = false;
    };
  }, []);

  // Always hit API when screen opens (even if some filters are blank).
  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;

    const requestFilters: JobLedgerRequestFilters = {
      job_id: (filters.jobNo ?? inferredJobIdFinal ?? "").toString().trim(),
      location: (filters.location ?? inferredLocationFinal ?? "").toString().trim(),
      segment_code: (filters.segmentCode ?? inferredSegmentCodeFinal ?? "").toString().trim(),
      hbl_hawb_no: (filters.hbl_hawb_no ?? "").toString().trim(),
    };

    fetchJobLedger(requestFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep existing flow where changing `apiFilters` triggers a fetch too.
  useEffect(() => {
    if (!apiFilters) return;
    fetchJobLedger(apiFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters]);

  // Calculate totals from API summary (fallback to calculated totals)
  const totals = useMemo(() => {
    // Use API summary if available, otherwise calculate from table data
    if (jobLedgerSummary) {
      return {
        totalDebit: toNumber(jobLedgerSummary.total_debit),
        totalCredit: toNumber(jobLedgerSummary.total_credit),
        totalRevenue: toNumber(jobLedgerSummary.total_revence),
        totalActualCost: toNumber(jobLedgerSummary.total_cost),
        totalNeutral: toNumber(jobLedgerSummary.total_neutral),
      };
    }
    
    // Fallback to calculating from table data
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
  }, [jobLedgerSummary, tableData]);

  // Columns definition for MantineReactTable
  const columns = useMemo<MRT_ColumnDef<JobLedgerData>[]>(
    () => [
      // {
      //   accessorKey: "segment",
      //   header: "Segment",
      //   size: 100,
      //   enableColumnFilter: false,
      //   enableSorting: false,
      // },
      // {
      //   accessorKey: "job",
      //   header: "Job",
      //   size: 120,
      //   enableColumnFilter: false,
      //   enableSorting: false,
      // },
      {
        accessorKey: "sno",
        header: "S.No",
        size: 50,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "subjob",
        header: "HBL/HAWB No.",
        size: 135,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "documentType",
        header: "Daybook Type",
        size: 115,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      // {
      //   accessorKey: "daybookName",
      //   header: "Daybook Name",
      //   size: 160,
      //   enableColumnFilter: false,
      //   enableSorting: false,
      // },
      {
        accessorKey: "documentNo",
        header: "Document number",
        size: 150,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row, cell }) => {
          const value = cell.getValue<string>();
          if (!row.original.reversed) {
            return value;
          }
          return (
            <Tooltip label="This document is reversed" withArrow>
              <Text
                size="sm"
                c="#B45309"
                style={{ fontFamily: "Inter", cursor: "default" }}
              >
                {value}
              </Text>
            </Tooltip>
          );
        },
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 105,
        enableColumnFilter: false,
        enableSorting: false,
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "partyName",
        header: "Party Name",
        size: 220,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          if (!value) return "-";
          return (
            <Tooltip label={value} withArrow multiline maw={320}>
              <Text size="sm" truncate style={{ fontFamily: "Inter", maxWidth: 220 }}>
                {value}
              </Text>
            </Tooltip>
          );
        },
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "currencyCode",
        header: "Currency",
        size: 90,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value || "-";
        },
        mantineTableBodyCellProps: { style: { padding: "4px 8px" } },
        mantineTableHeadCellProps: { style: { padding: "6px 10px" } },
      },
      {
        accessorKey: "debit",
        header: "Debit",
        size: 140,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return value > 0 ? `${value.toFixed(2)}` : "-";
        },
        mantineTableBodyCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "4px 14px" },
        },
        mantineTableHeadCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "6px 16px" },
        },
      },
      {
        accessorKey: "credit",
        header: "Credit",
        size: 140,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return value > 0 ? `${value.toFixed(2)}` : "-";
        },
        mantineTableBodyCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "4px 14px" },
        },
        mantineTableHeadCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "6px 16px" },
        },
      },
      {
        accessorKey: "revenue",
        header: "Revenue",
        size: 140,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `${value.toFixed(2)}`;
        },
        mantineTableBodyCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "4px 14px" },
        },
        mantineTableHeadCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "6px 16px" },
        },
      },
      {
        accessorKey: "actualCost",
        header: "Actual cost",
        size: 150,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `${value.toFixed(2)}`;
        },
        mantineTableBodyCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "4px 14px" },
        },
        mantineTableHeadCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "6px 16px" },
        },
      },
      {
        accessorKey: "neutral",
        header: "Neutral",
        size: 140,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return `${value.toFixed(2)}`;
        },
        mantineTableBodyCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "4px 14px" },
        },
        mantineTableHeadCellProps: {
          style: { backgroundColor: "#F8FAFC", padding: "6px 16px" },
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
        padding: "4px 8px",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#334155",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableBodyRowProps: {
      style: {
        height: "40px",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        width: "fit-content",
        padding: "6px 12px",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#1E293B",
        backgroundColor: "#F8FAFC",
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
                c="#1E293B"
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
                  label="Location"
                  placeholder="Enter Location"
                  size="xs"
                  value={filters.location || ""}
                  onChange={(e) =>
                    updateFilter("location", e.target.value || null)
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
                  value={filters.hbl_hawb_no || ""}
                  onChange={(e) =>
                    updateFilter("hbl_hawb_no", e.target.value || null)
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
                    onClick={handleApplyFilters}
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
          <Group gap="md">
            <Group gap={6} wrap="nowrap">
              <Text
                size="lg"
                fw={600}
                c="#105476"
                style={{ fontFamily: "Inter" }}
              >
                Segment:
              </Text>
              <Text size="lg" c="dimmed" style={{ fontFamily: "Inter" }}>
                  {navState?.service_name}
              </Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <Text
                size="lg"
                fw={600}
                c="#105476"
                style={{ fontFamily: "Inter" }}
              >
                Job:
              </Text>
              <Text size="lg" c="dimmed" style={{ fontFamily: "Inter" , }}>
                {filters.jobNo || "-"}
              </Text>
            </Group>
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
            <Button
              variant="outline"
              size="sm"
              leftSection={<IconChevronLeft size={16} />}
              onClick={() => navigate(-1)}
              styles={{
                root: {
                  borderRadius: "4px",
                  color: "#105476",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  border: "1px solid #105476",
                  "&:hover": {
                    backgroundColor: "#E0F5FF",
                  },
                },
              }}
            >
              Back
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
                c="#1E293B"
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
                <Select
                  label="Segment Code"
                  placeholder="Select Segment Code"
                  size="xs"
                  searchable
                  clearable
                  data={segmentOptions}
                  value={filters.segmentCode || ""}
                  onChange={(value) => updateFilter("segmentCode", value || null)}
                  disabled={segmentOptionsLoading}
                  rightSection={
                    segmentOptionsLoading ? <Loader size={14} /> : undefined
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
                  label="Location"
                  placeholder="Enter Location"
                  size="xs"
                  value={filters.location || ""}
                  onChange={(e) =>
                    updateFilter("location", e.target.value || null)
                  }
                />
              </Grid.Col>

              {/* <Grid.Col span={2}>
                <TextInput
                  label="Subjob No"
                  placeholder="Enter Subjob No"
                  size="xs"
                  value={filters.subjobNo || ""}
                  onChange={(e) =>
                    updateFilter("subjobNo", e.target.value || null)
                  }
                />
              </Grid.Col> */}

              <Grid.Col span={2}>
                <TextInput
                  label="HBL/HAWB No."
                  placeholder="Enter HBL/HAWB No"
                  size="xs"
                  value={filters.hbl_hawb_no || ""}
                  onChange={(e) =>
                    updateFilter("hbl_hawb_no", e.target.value || null)
                  }
                />
              </Grid.Col>

              {/* <Grid.Col span={2}>
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
              </Grid.Col> */}

              {/* <Grid.Col span={2}>
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
              </Grid.Col> */}

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
                    onClick={handleApplyFilters}
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
                {jobLedgerLoading && (
                  <Box
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 5,
                      background: "rgba(255,255,255,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Loader size="md" color="#105476" />
                  </Box>
                )}
                <MantineReactTable table={table} />
              </Box>

              {/* Totals Section */}
              <Divider my="md" />
              {jobLedgerLoading && (
                <Text size="sm" c="dimmed" mb="sm">
                  Loading job ledger...
                </Text>
              )}
              {jobLedgerError && (
                <Text size="sm" c="red" mb="sm">
                  {jobLedgerError}
                </Text>
              )}
              <Box>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Debit
                      </Text>
                      <Text size="lg" fw={600}>
                        {totals.totalDebit.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Credit
                      </Text>
                      <Text size="lg" fw={600}>
                        {totals.totalCredit.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Revenue
                      </Text>
                      <Text size="lg" fw={600}>
                        {totals.totalRevenue.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Actual Cost
                      </Text>
                      <Text size="lg" fw={600}>
                        {totals.totalActualCost.toFixed(2)}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                    <Stack gap={0}>
                      <Text size="sm" c="dimmed">
                        Total Neutral
                      </Text>
                      <Text size="lg" fw={600} c="#105476">
                        {totals.totalNeutral.toFixed(2)}
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