import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Card,
  Grid,
  Group,
  Text,
  Center,
  Loader,
  Button,
  Badge,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  getPendingBookingsData,
  getPendingJobsData,
  getJobListByEventData,
  PendingBookingItem,
  PendingJobItem,
  JobsWithoutBLReleasedItem,
} from "../../../service/dashboard.service";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useDashboardChartSearch } from "../../../hooks/useDashboardChartSearch";

const CARD_PREVIEW_ROWS = 5;
const TABLE_PAGE_SIZE = 10;

const GAINED_QUOTATIONS_PAYLOAD = { trade: "Export" };
const BOOKINGS_PENDING_JOBS_PAYLOAD = { service_type: "Export" };
const JOBS_WITHOUT_BL_PAYLOAD = {
  event_name: "BL Released",
  service_type: "Export",
  operator: "not_equal",
};
const POD_NOT_UPDATED_PAYLOAD = {
  event_name: "POD Released",
  service_type: "Export",
  operator: "not_equal",
};
const INVOICE_NOT_RAISED_PAYLOAD = {
  for_invoice: true,
  service_type: "Export"
};

type TableViewType = null | "pending-bookings" | "pending-jobs" | "jobs-without-bl" | "pod-not-updated" | "invoice-not-raised";

interface CustomerServiceReportProps {
  fromDate?: Date | null;
  toDate?: Date | null;
}

const CustomerServiceReport: React.FC<CustomerServiceReportProps> = ({
  fromDate,
  toDate,
}) => {
  const navigate = useNavigate();
  const {
    committed: committedSearch,
  } = useDashboardChartSearch();
  const [tableView, setTableView] = useState<TableViewType>(null);
  const [pendingBookings, setPendingBookings] = useState<PendingBookingItem[]>(
    [],
  );
  const [pendingJobs, setPendingJobs] = useState<PendingJobItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [cardBookingsCount, setCardBookingsCount] = useState(0);
  const [cardJobsCount, setCardJobsCount] = useState(0);
  const [jobsWithoutBL, setJobsWithoutBL] = useState<JobsWithoutBLReleasedItem[]>([]);
  const [loadingJobsWithoutBL, setLoadingJobsWithoutBL] = useState(true);
  const [cardJobsWithoutBLCount, setCardJobsWithoutBLCount] = useState(0);
  const [podNotUpdated, setPodNotUpdated] = useState<JobsWithoutBLReleasedItem[]>([]);
  const [loadingPodNotUpdated, setLoadingPodNotUpdated] = useState(true);
  const [cardPodNotUpdatedCount, setCardPodNotUpdatedCount] = useState(0);
  const [invoiceNotRaised, setInvoiceNotRaised] = useState<JobsWithoutBLReleasedItem[]>([]);
  const [loadingInvoiceNotRaised, setLoadingInvoiceNotRaised] = useState(true);
  const [cardInvoiceNotRaisedCount, setCardInvoiceNotRaisedCount] = useState(0);
  // Full table view state (when View All is clicked)
  const [tableData, setTableData] = useState<
    PendingBookingItem[] | PendingJobItem[] | JobsWithoutBLReleasedItem[]
  >([]);
  const [tableTotalCount, setTableTotalCount] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [tablePageIndex, setTablePageIndex] = useState(0);
  const [tablePageSize, setTablePageSize] = useState(TABLE_PAGE_SIZE);
  const filters = useMemo(() => {
    return {
      ...(fromDate && { date_from: dayjs(fromDate).format("YYYY-MM-DD") }),
      ...(toDate && { date_to: dayjs(toDate).format("YYYY-MM-DD") }),
      ...(committedSearch?.trim() && { search: committedSearch.trim() }),
      index: 0,
      limit: CARD_PREVIEW_ROWS,
    };
  }, [fromDate, toDate, committedSearch]);

  const headerBar = (
    <Group justify="space-between" align="center" mb="md" wrap="wrap">
      <Group gap="xs" align="center">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(-1)}
          variant="outline"
          size="xs"
          color="#105476"
          style={{ fontFamily: "Inter" }}
        >
          Back
        </Button>
        <Text
          size="md"
          fw={600}
          c="#111827"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Customer Service Report (Export)
        </Text>
      </Group>
    </Group>
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingBookings(true);
      try {
        const res = await getPendingBookingsData(filters, GAINED_QUOTATIONS_PAYLOAD);
        if (!cancelled && Array.isArray(res?.data)) {
          setPendingBookings(res.data);
          setCardBookingsCount(typeof res?.count === "number" ? res.count : 0);
        }
      } catch {
        if (!cancelled) {
          setPendingBookings([]);
          setCardBookingsCount(0);
        }
      } finally {
        if (!cancelled) setLoadingBookings(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters.date_from, filters.date_to, filters.search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingJobs(true);
      try {
        const res = await getPendingJobsData(filters, BOOKINGS_PENDING_JOBS_PAYLOAD);
        if (!cancelled && Array.isArray(res?.data)) {
          setPendingJobs(res.data);
          setCardJobsCount(typeof res?.count === "number" ? res.count : 0);
        }
      } catch {
        if (!cancelled) {
          setPendingJobs([]);
          setCardJobsCount(0);
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters.date_from, filters.date_to, filters.search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingJobsWithoutBL(true);
      try {
        const res = await getJobListByEventData(filters, JOBS_WITHOUT_BL_PAYLOAD);
        if (!cancelled && Array.isArray(res?.data)) {
          setJobsWithoutBL(res.data);
          setCardJobsWithoutBLCount(typeof res?.count === "number" ? res.count : 0);
        }
      } catch {
        if (!cancelled) {
          setJobsWithoutBL([]);
          setCardJobsWithoutBLCount(0);
        }
      } finally {
        if (!cancelled) setLoadingJobsWithoutBL(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters.date_from, filters.date_to, filters.search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingPodNotUpdated(true);
      try {
        const res = await getJobListByEventData(filters, POD_NOT_UPDATED_PAYLOAD);
        if (!cancelled && Array.isArray(res?.data)) {
          setPodNotUpdated(res.data);
          setCardPodNotUpdatedCount(typeof res?.count === "number" ? res.count : 0);
        }
      } catch {
        if (!cancelled) {
          setPodNotUpdated([]);
          setCardPodNotUpdatedCount(0);
        }
      } finally {
        if (!cancelled) setLoadingPodNotUpdated(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filters.date_from, filters.date_to, filters.search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingInvoiceNotRaised(true);
      try {
        const res = await getJobListByEventData(filters, INVOICE_NOT_RAISED_PAYLOAD);
        if (!cancelled && Array.isArray(res?.data)) {
          setInvoiceNotRaised(res.data);
          setCardInvoiceNotRaisedCount(typeof res?.count === "number" ? res.count : 0);
        }
      } catch {
        if (!cancelled) {
          setInvoiceNotRaised([]);
          setCardInvoiceNotRaisedCount(0);
        }
      } finally {
        if (!cancelled) setLoadingInvoiceNotRaised(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filters.date_from, filters.date_to, filters.search]);

  const handleViewAllBookings = () => {
    setTableView("pending-bookings");
    setTablePageIndex(0);
  };
  const handleViewAllJobs = () => {
    setTableView("pending-jobs");
    setTablePageIndex(0);
  };
  const handleViewAllJobsWithoutBL = () => {
    setTableView("jobs-without-bl");
    setTablePageIndex(0);
  };
  const handleViewAllPodNotUpdated = () => {
    setTableView("pod-not-updated");
    setTablePageIndex(0);
  };
  const handleViewAllInvoiceNotRaised = () => {
    setTableView("invoice-not-raised");
    setTablePageIndex(0);
  };
  const handleBackFromTable = () => setTableView(null);

  const handlePageChange = (newPage: number) => setTablePageIndex(newPage - 1);
  const handlePageSizeChange = (newPageSize: number) => {
    setTablePageSize(newPageSize);
    setTablePageIndex(0);
  };

  const tableFilters = useMemo(
    () => ({
      ...(fromDate && { date_from: dayjs(fromDate).format("YYYY-MM-DD") }),
      ...(toDate && { date_to: dayjs(toDate).format("YYYY-MM-DD") }),
      ...(committedSearch?.trim() && { search: committedSearch.trim() }),
      index: tablePageIndex * tablePageSize,
      limit: tablePageSize,
    }),
    [fromDate, toDate, committedSearch, tablePageIndex, tablePageSize],
  );

  useEffect(() => {
    if (!tableView) return;
    let cancelled = false;
    setTableLoading(true);
    const load = async () => {
      try {
        const res =
          tableView === "pending-bookings"
            ? await getPendingBookingsData(tableFilters, GAINED_QUOTATIONS_PAYLOAD)
            : tableView === "pending-jobs"
              ? await getPendingJobsData(tableFilters, BOOKINGS_PENDING_JOBS_PAYLOAD)
              : tableView === "jobs-without-bl"
                ? await getJobListByEventData(tableFilters, JOBS_WITHOUT_BL_PAYLOAD)
                : tableView === "pod-not-updated"
                  ? await getJobListByEventData(tableFilters, POD_NOT_UPDATED_PAYLOAD)
                  : await getJobListByEventData(tableFilters, INVOICE_NOT_RAISED_PAYLOAD);
        if (!cancelled) {
          const list = Array.isArray(res?.data) ? res.data : [];
          const total = typeof res?.count === "number" ? res.count : 0;
          setTableData(list);
          setTableTotalCount(total);
        }
      } catch {
        if (!cancelled) {
          setTableData([]);
          setTableTotalCount(0);
        }
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    tableView,
    fromDate,
    toDate,
    committedSearch,
    tablePageIndex,
    tablePageSize,
  ]);

  const pendingBookingsColumns = useMemo<MRT_ColumnDef<PendingBookingItem>[]>(
    () => [
      {
        accessorKey: "enquiry_id",
        header: "Enquiry No",
        minSize: 120,
        maxSize:150,
        Cell: ({ row }) => (
          <Text truncate size="sm">{row.original.enquiry_id ?? "-"}</Text>
        ),
      },
      {
        accessorKey: "quotation_id",
        header: "Quotation No",
        minSize: 80,
        maxSize:100,
        Cell: ({ row }) => {
          const id = row.original.quotation_primary_key;
          if (!id) return <Text size="sm">-</Text>;
          return (
            <Badge
              size="xs"
              bg="#105476"
              c="white"
              style={{ cursor: "pointer", textDecoration: "none", fontFamily:'Inter' }}
              onClick={() =>
                navigate(`/quotation-create/${id}`, {
                  state: {
                    returnTo: "dashboard-customer-service",
                    viewMode: true,
                  },
                })
              }
            >
              {id}
            </Badge>
          );
        },
      },
      {
        id: "customer_name",
        header: "Customer Name",
        minSize: 120,
        maxSize:150,
        Cell: ({ row }) => (
          <Text truncate maw={150} size="sm" style={{fontSize:13, fontFamily:'Inter'}}>
            {row.original.customer_details?.customer_name ?? "-"}
          </Text>
        ),
      },
      {
        id: "service",
        header: "Service",
        minSize: 90,
        maxSize:110,
        Cell: ({ row }) => {
          const sd = row.original.service_details;
          if (!sd?.length) return <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>-</Text>;
          const first = sd[0];
          const service =
            first?.service && first?.trade
              ? `${first.service} ${first.trade}`
              : (first?.service ?? "-");
          return <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{service}</Text>;
        },
      },
      {
        accessorKey: "quotation_date",
        header: "Quote Date",
        minSize: 90,
        maxSize:110,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.quotation_date ?? "-"}</Text>
        ),
      },
      {
        accessorKey: "customer_service_details",
        header: "Customer Service",
        minSize: 100,
        maxSize:120,
        Cell: ({ row }) => (
          <Text truncate size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.customer_service_details ?? "-"}</Text>
        ),
      },
      {
        id: "sales_person",
        header: "Sales Person",
        minSize: 90,
        maxSize:110,
        Cell: ({ row }) => (
          <Text truncate size="sm" style={{fontSize:13, fontFamily:'Inter'}}>
            {row.original.sales_details?.sales_person ?? "-"}
          </Text>
        ),
      },
      {
        accessorKey: "gained_date",
        header: "Gained Date",
        minSize: 90,
        maxSize:110,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.gained_date ?? "-"}</Text>
        ),
      },
    ],
    [navigate],
  );

  const getBookingEditPath = (service: string) => {
    const s = (service ?? "").toUpperCase();
    if (s === "AIR") return "/air/export-booking/edit";
    if (s === "FCL" || s === "LCL") return "/SeaExport/export-booking/edit";
    return null;
  };

  const getJobEditPath = (service: string) => {
    const s = (service ?? "").toUpperCase();
    if (s === "AIR") return "/air/export-job/edit";
    if (s === "FCL" || s === "LCL") return "/SeaExport/export-job/edit";
    return null;
  };

  const pendingJobsColumns = useMemo<MRT_ColumnDef<PendingJobItem>[]>(
    () => [
      {
        accessorKey: "booking_id",
        header: "Booking No",
        minSize: 80,
        maxSize:120,
        Cell: ({ row }) => {
          const bookingId = row.original.booking_id;
          const path = getBookingEditPath(row.original.service);
          if (!bookingId || !path) return <Text size="sm">{bookingId ?? "-"}</Text>;
          return (
            <Badge
              size="xs"
              bg="#105476"
              c="white"
              style={{ cursor: "pointer", textDecoration: "none", fontFamily:'Inter' }}
              onClick={() =>
                navigate(path, {
                  state: {
                    bookingId:row.original.booking_primary_key,
                    returnTo: "dashboard-customer-service",
                    viewMode: true,
                  },
                })
              }
            >
              {bookingId}
            </Badge>
          );
        },
      },
      {
        id: "customer_name",
        header: "Customer Name",
        minSize: 120,
        maxSize:150,
        Cell: ({ row }) => (
          <Text truncate size="sm" style={{fontSize:13, fontFamily:'Inter'}}>
            {row.original.customer_details?.customer_name ?? "-"}
          </Text>
        ),
      },
      {
        accessorKey: "service",
        header: "Service",
        minSize: 90,
        maxSize:110,
        Cell: ({ row }) => <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.service ?? "-"}</Text>,
      },
      {
        id: "houseno",
        header: "House No",
        minSize: 80,
        maxSize: 100,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>
            {(row.original as PendingJobItem & { houseno?: string }).houseno ?? "-"}
          </Text>
        ),
      },
      {
        accessorKey: "customer_service_person",
        header: "Customer Service",
        minSize: 100,
        maxSize:120,
        Cell: ({ row }) => (
          <Text truncate size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.customer_service_person ?? "-"}</Text>
        ),
      },
      {
        accessorKey: "booking_date",
        header: "Booking Date",
        minSize: 90,
        maxSize:110,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.booking_date ?? "-"}</Text>
        ),
      },
    ],
    [navigate],
  );

  const jobsWithoutBLColumns = useMemo<
    MRT_ColumnDef<JobsWithoutBLReleasedItem>[]
  >(
    () => [
      {
        accessorKey: "booking_id",
        header: "Booking Id",
        minSize: 80,
        maxSize: 120,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.booking_id ?? "-"}</Text>
        ),
      },
      {
        accessorKey: "job_id",
        header: "Job Id",
        minSize: 90,
        maxSize: 110,
        Cell: ({ row }) => {
          const jobId = row.original.job_id;
          const path = getJobEditPath(row.original.service);
          if (!jobId || !path) return <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{jobId ?? "-"}</Text>;
          return (
            <Badge
              size="xs"
              style={{ cursor: "pointer", textDecoration: "none", backgroundColor: "#105476", color:"white", fontFamily:'Inter' }}
              onClick={() =>
                navigate(path, {
                  state: {
                    jobId: row.original.job_primary_key,
                    returnTo: "dashboard-customer-service",
                    viewMode: true,
                  },
                })
              }
            >
              {jobId}
            </Badge>
          );
        },
      },
      {
        accessorKey: "service",
        header: "Service",
        minSize: 80,
        maxSize: 100,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.service ?? "-"}</Text>
        ),
      },
      {
        accessorKey: "houseno",
        header: "House No",
        minSize: 80,
        maxSize: 100,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>{row.original.houseno ?? "-"}</Text>
        ),
      },
      {
        id: "customer_name",
        header: "Customer Name",
        minSize: 120,
        maxSize: 150,
        Cell: ({ row }) => (
          <Text truncate size="sm" style={{fontSize:13, fontFamily:'Inter'}}>
            {row.original.customer_details?.customer_name ?? "-"}
          </Text>
        ),
      },
      {
        accessorKey: "etd",
        header: "ETD",
        minSize: 90,
        maxSize: 110,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>
            {row.original.etd
              ? dayjs(row.original.etd).format("YYYY-MM-DD")
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "eta",
        header: "ETA",
        minSize: 90,
        maxSize: 110,
        Cell: ({ row }) => (
          <Text size="sm" style={{fontSize:13, fontFamily:'Inter'}}>
            {row.original.eta
              ? dayjs(row.original.eta).format("YYYY-MM-DD")
              : "-"}
          </Text>
        ),
      },
    ],
    [navigate],
  );

  const bookingsPreview = pendingBookings.slice(0, CARD_PREVIEW_ROWS);
  const jobsPreview = pendingJobs.slice(0, CARD_PREVIEW_ROWS);
  const jobsWithoutBLPreview = jobsWithoutBL.slice(0, CARD_PREVIEW_ROWS);
  const podNotUpdatedPreview = podNotUpdated.slice(0, CARD_PREVIEW_ROWS);
  const invoiceNotRaisedPreview = invoiceNotRaised.slice(0, CARD_PREVIEW_ROWS);

  const cardTableCommon = {
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableStickyHeader: true,
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { background: "transparent", tableLayout: "fixed" },
    },
    mantinePaperProps: {
      shadow: "none",
      p: 0,
      style: { background: "transparent", borderRadius:8, boxShadow: "none", minHeight: 0 },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "4px 8px",
        fontSize: "8px",
        background: "transparent",
        borderBottom: "1px solid #e6e6e6",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "4px 8px",
        fontSize: "10px",
        fontWeight: 600,
        background: "transparent",
        borderBottom: "1px solid #e6e6e6",
      },
    },
    mantineTableContainerProps: {
      sx: {
        height: "185px",
        overflowY: "auto",
        overflowX: "auto",
        borderCollapse: "separate",   // IMPORTANT
        borderSpacing: "8px 0px",

        /* Width */
        "&::-webkit-scrollbar": {
          width: "6px",
          height: "6px",
        },

        /* Track */
        "&::-webkit-scrollbar-track": {
          background: "transparent",
        },

        /* Thumb */
        "&::-webkit-scrollbar-thumb": {
          background: "#ced4da",
          borderRadius: "6px",
        },

        "&::-webkit-scrollbar-thumb:hover": {
          background: "#adb5bd",
        },

        /* Firefox */
        scrollbarWidth: "thin",
        scrollbarColor: "#ced4da transparent",
      },
    },
  };

  const tableBookings = useMantineReactTable({
    ...cardTableCommon,
    columns: pendingBookingsColumns,
    data: bookingsPreview,
  });

  const tableJobs = useMantineReactTable({
    ...cardTableCommon,
    columns: pendingJobsColumns,
    data: jobsPreview,
  });

  const tableJobsWithoutBL = useMantineReactTable({
    ...cardTableCommon,
    columns: jobsWithoutBLColumns,
    data: jobsWithoutBLPreview,
  });

  const tablePodNotUpdated = useMantineReactTable({
    ...cardTableCommon,
    columns: jobsWithoutBLColumns,
    data: podNotUpdatedPreview,
  });

  const tableInvoiceNotRaised = useMantineReactTable({
    ...cardTableCommon,
    columns: jobsWithoutBLColumns,
    data: invoiceNotRaisedPreview,
  });

  const fullTableColumns =
    tableView === "pending-bookings"
      ? pendingBookingsColumns
      : tableView === "pending-jobs"
        ? pendingJobsColumns
        : jobsWithoutBLColumns;

  const fullTable = useMantineReactTable({
    columns: fullTableColumns,
    data: tableData,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableStickyHeader: true,
    // layoutMode: "grid",
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
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
        minHeight: 0,
        overflow: "hidden",
      },
    },
    mantineTableBodyCellProps: {
      style: { padding: "8px 12px", fontSize: "13px" },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: "#f8f9fa",
      },
    },
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
        maxHeight:"61vh"
      },
    },
  });

  if (tableView) {
    const title =
      tableView === "pending-bookings"
        ? "Gained Quotations - Pending for Bookings"
        : tableView === "pending-jobs"
          ? "Bookings Created - Pending for Jobs"
          : tableView === "jobs-without-bl"
            ? "Jobs - BL Not Released"
            : tableView === "pod-not-updated"
              ? "Jobs - POD Not Updated"
              : "Jobs - Invoice Not Raised";
    return (
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 220px)",
          minHeight: 400,
          overflow: "hidden",
          flex: 1,
        }}
      >
        {headerBar}
        <Group justify="space-between" align="center" mb="md" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Text size="md" fw={500} c="#424242" style={{ fontFamily: "Inter, sans-serif" }}>
            {title}
          </Text>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleBackFromTable}
            variant="outline"
            size="xs"
            color="#105476"
            style={{fontFamily:'Inter'}}
          >
            Back
          </Button>
        </Group>
        {tableLoading ? (
          <Center py="xl" style={{ flex: 1, minHeight: 0 }}>
            <Loader size="lg" color="#105476" />
          </Center>
        ) : (
          <>
            <Box
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <MantineReactTable table={fullTable} />
            </Box>
            <Box style={{ borderTop: "1px solid #e9ecef", flexShrink: 0 }}>
              <PaginationBar
                pageSize={tablePageSize}
                currentPage={tablePageIndex + 1}
                totalRecords={tableTotalCount}
                onPageSizeChange={handlePageSizeChange}
                onPageChange={handlePageChange}
                pageSizeOptions={["10", "25", "50"]}
              />
            </Box>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box pb={20}>
      {headerBar}
      <Grid>
        <Grid.Col span={6}>
          <Card
            shadow="sm"
            p="md"
            radius="md"
            style={{
              border: "1px solid #e9ecef",
              background:
                "linear-gradient(to right, rgb(251, 253, 255) 0%, rgb(235, 247, 252) 100%)",
              height: 265,
            }}
          >
            <Group justify="space-between" align="center" mb="md">
              <Group gap="sm" align="center" >
                <Text size="md" fw={500} c="Black" style={{fontFamily:'Inter'}}>
                  Gained Quotations - Pending for Bookings
                </Text>
                <Badge size="sm" variant="transparent" bg="#105476" c={"white"}>
                  {cardBookingsCount}
                </Badge>
              </Group>
              <Text
                size="xs"
                c="#ffffff"
                fw={500}
                style={{
                  backgroundColor:"#105476",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding:"4px 8px",
                  borderRadius:24,
                  fontFamily:'Inter'
                }}
                onClick={handleViewAllBookings}
              >
                View All
              </Text>
            </Group>
            {loadingBookings ? (
              <Center py="xl">
                <Loader size="md" color="#105476" />
              </Center>
            ) : bookingsPreview.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" style={{fontFamily:'Inter'}}>No data available</Text>
              </Center>
            ) : (
              <Box style={{ overflow: "hidden", maxHeight: 200 }}>
                <MantineReactTable table={tableBookings} />
              </Box>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card
            shadow="sm"
            p="md"
            radius="md"
            style={{
              border: "1px solid #e9ecef",
              background:
                "linear-gradient(to right, rgb(255, 249, 249) 0%, rgb(252, 235, 237) 100%)",
              height: 265,
            }}
          >
            <Group justify="space-between" align="center" mb="md">
              <Group gap="sm" align="center">
                <Text size="md" fw={500} c="Black" style={{fontFamily:'Inter'}}>
                  Bookings Created - Pending for Jobs
                </Text>
                <Badge size="sm" variant="transparent" bg="#105476" c={"white"}>
                  {cardJobsCount}
                </Badge>
              </Group>
              <Text
                size="xs"
                c="#ffffff"
                fw={500}
                style={{
                  backgroundColor:"#105476",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding:"4px 8px",
                  borderRadius:24,
                  fontFamily:'Inter'
                }}
                onClick={handleViewAllJobs}
              >
                View All
              </Text>
            </Group>
            {loadingJobs ? (
              <Center py="xl">
                <Loader size="md" color="#105476" />
              </Center>
            ) : jobsPreview.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" style={{fontFamily:'Inter'}}>No data available</Text>
              </Center>
            ) : (
              <Box style={{ overflow: "hidden", maxHeight: 200 }}>
                <MantineReactTable table={tableJobs} />
              </Box>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card
            shadow="sm"
            p="md"
            radius="md"
            style={{
              border: "1px solid #e9ecef",
              background:
                "linear-gradient(to right, rgb(251, 253, 255) 0%, #FAF8F5 100%)",
              height: 265,
            }}
          >
            <Group justify="space-between" align="center" mb="md">
              <Group gap="sm" align="center">
                <Text size="md" fw={500} c="Black" style={{fontFamily:'Inter'}}>
                  Jobs - BL Not Released
                </Text>
                <Badge size="sm" variant="transparent" bg="#105476" c={"white"}>
                  {cardJobsWithoutBLCount}
                </Badge>
              </Group>
              <Text
                size="xs"
                c="#ffffff"
                fw={500}
                style={{
                  backgroundColor: "#105476",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 24,
                  fontFamily:'Inter'
                }}
                onClick={handleViewAllJobsWithoutBL}
              >
                View All
              </Text>
            </Group>
            {loadingJobsWithoutBL ? (
              <Center py="xl">
                <Loader size="md" color="#105476" />
              </Center>
            ) : jobsWithoutBLPreview.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" style={{fontFamily:'Inter'}}>No data available</Text>
              </Center>
            ) : (
              <Box style={{ overflow: "hidden", maxHeight: 200 }}>
                <MantineReactTable table={tableJobsWithoutBL} />
              </Box>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card
            shadow="sm"
            p="md"
            radius="md"
            style={{
              border: "1px solid #e9ecef",
              background:
                "linear-gradient(to right, rgb(251, 253, 255) 0%, #FAF8F5 100%)",
              height: 265,
            }}
          >
            <Group justify="space-between" align="center" mb="md">
              <Group gap="sm" align="center">
                <Text size="md" fw={500} c="Black" style={{fontFamily:'Inter'}}>
                  Jobs - POD Not Updated
                </Text>
                <Badge size="sm" variant="transparent" bg="#105476" c={"white"}>
                  {cardPodNotUpdatedCount}
                </Badge>
              </Group>
              <Text
                size="xs"
                c="#ffffff"
                fw={500}
                style={{
                  backgroundColor: "#105476",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 24,
                  fontFamily:'Inter'
                }}
                onClick={handleViewAllPodNotUpdated}
              >
                View All
              </Text>
            </Group>
            {loadingPodNotUpdated ? (
              <Center py="xl">
                <Loader size="md" color="#105476" />
              </Center>
            ) : podNotUpdatedPreview.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" style={{fontFamily:'Inter'}}>No data available</Text>
              </Center>
            ) : (
              <Box style={{ overflow: "hidden", maxHeight: 200 }}>
                <MantineReactTable table={tablePodNotUpdated} />
              </Box>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card
            shadow="sm"
            p="md"
            radius="md"
            style={{
              border: "1px solid #e9ecef",
              background:
                "linear-gradient(to right, rgb(251, 253, 255) 0%, #F5F5F5 100%)",
              height: 265,
            }}
          >
            <Group justify="space-between" align="center" mb="md">
              <Group gap="sm" align="center">
                <Text size="md" fw={500} c="Black" style={{fontFamily:'Inter'}}>
                  Jobs - Invoice Not Raised
                </Text>
                <Badge size="sm" variant="transparent" bg="#105476" c={"white"}>
                  {cardInvoiceNotRaisedCount}
                </Badge>
              </Group>
              <Text
                size="xs"
                c="#ffffff"
                fw={500}
                style={{
                  backgroundColor: "#105476",
                  textDecoration: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 24,
                  fontFamily:'Inter'
                }}
                onClick={handleViewAllInvoiceNotRaised}
              >
                View All
              </Text>
            </Group>
            {loadingInvoiceNotRaised ? (
              <Center py="xl">
                <Loader size="md" color="#105476" />
              </Center>
            ) : invoiceNotRaisedPreview.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed" style={{fontFamily:'Inter'}}>No data available</Text>
              </Center>
            ) : (
              <Box style={{ overflow: "hidden", maxHeight: 200 }}>
                <MantineReactTable table={tableInvoiceNotRaised} />
              </Box>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Box>
  );
};

export default CustomerServiceReport;
