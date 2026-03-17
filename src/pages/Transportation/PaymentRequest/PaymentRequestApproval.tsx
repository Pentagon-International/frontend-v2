import { useMemo, useState, useRef } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Card,
  Center,
  Stack,
  Box,
  Menu,
  ActionIcon,
  UnstyledButton,
  Select,
  Loader,
  Badge,
  Collapse,
  Grid,
  TextInput,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconChevronLeft,
  IconChevronRight,
  IconFileInvoice,
  IconFilter,
  IconFilterOff,
  IconX,
  IconSearch,
  IconPlus,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";
import { Dropdown, SingleDateInput, ToastNotification } from "../../../components";
import dayjs from "dayjs";

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentRequestCharge = {
  id: number;
  payment_request: number;
  job_id?: string;
  charge_id: number;
  charge_code?: string;
  charge_name?: string;
  currency_code?: string;
  currency_id?: number;
  roe?: string;
  unit_code?: string;
  no_of_unit?: number;
  amount_per_unit?: string;
  amount?: string;
  local_amount?: string;
  sac_code?: string;
};

type PaymentRequestRecord = {
  id: number;
  request_no: string;
  job_reference?: string;
  created_by?: string;
  date?: string;
  payment_type?: string;
  vouchar_type?: string;
  paid_to_type?: string;
  paid_to?: string;
  not_over?: string;
  state_code?: string;
  state_id?: number;
  tds_section_code?: string;
  account_code?: string;
  subledger_code?: string;
  currency_id?: number;
  location_gst_no?: string;
  customer_gst_no?: string;
  note?: string;
  account_note?: string;
  status?: string;
  amount?: string;
  currency_code?: string;
  charges?: PaymentRequestCharge[];
};

type FilterState = {
  status: string | null;
  date_from: Date | null;
  date_to: Date | null;
  payment_type: string | null;
  paid_to_type: string | null;
  request_no: string | null;
  job_reference: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "Rejected", label: "Rejected" },
  { value: "Unapproved", label: "Unapproved" },
  { value: "Approved", label: "Approved (Waiting for Payment / CRJ)" },
  { value: "Unposted", label: "Unposted" },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: "Bank", label: "Bank" },
  { value: "CASH", label: "Cash" },
  { value: "PDC", label: "PDC" },
  { value: "ONLINE TRANSFER", label: "Online Transfer" },
  { value: "DD/PO", label: "DD/PO" },
];

const PAID_TO_TYPE_OPTIONS = [
  { value: "supplier", label: "Supplier" },
  { value: "agent", label: "Agent" },
  { value: "customer", label: "Customer" },
  { value: "staff", label: "Staff" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcLocalAmount(charges?: PaymentRequestCharge[]): string {
  if (!charges?.length) return "0.00";
  const total = charges.reduce(
    (sum, c) => sum + (c.local_amount ? parseFloat(c.local_amount) : 0),
    0,
  );
  return total.toFixed(2);
}

function getFirstJobNo(charges?: PaymentRequestCharge[]): string {
  return charges?.find((c) => c.job_id)?.job_id ?? "-";
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function statusColor(status?: string): string {
  if (!status) return "gray";
  switch (status.toLowerCase()) {
    case "approved":
      return "green";
    case "rejected":
      return "red";
    case "unapproved":
      return "orange";
    case "unposted":
      return "blue";
    default:
      return "gray";
  }
}

const emptyFilters = (): FilterState => ({
  status: null,
  date_from: null,
  date_to: null,
  payment_type: null,
  paid_to_type: null,
  request_no: null,
  job_reference: null,
});

// ─── Component ───────────────────────────────────────────────────────────────

function PaymentRequestApproval() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isRefreshingRef = useRef(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [filters, setFilters] = useState<FilterState>(emptyFilters());

  // ─── Build filter payload ─────────────────────────────────────────────────

  const buildFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if (filters.status) payload.status = filters.status;
    if (filters.date_from) payload.date_from = dayjs(filters.date_from).format("YYYY-MM-DD");
    if (filters.date_to) payload.date_to = dayjs(filters.date_to).format("YYYY-MM-DD");
    if (filters.payment_type) payload.payment_type = filters.payment_type;
    if (filters.paid_to_type) payload.paid_to_type = filters.paid_to_type;
    if (filters.request_no?.trim()) payload.request_no = filters.request_no.trim();
    if (filters.job_reference?.trim()) payload.job_reference = filters.job_reference.trim();
    return payload;
  }, [filters]);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const {
    data: initialData,
    isLoading,
    isFetching,
    refetch: refetchInitial,
  } = useQuery<{ data: PaymentRequestRecord[]; total_count: number }>({
    queryKey: ["paymentRequestApproval"],
    queryFn: async () => {
      try {
        const response = await postAPICall(
          (URL as any).paymentRequestFilter,
          { filters: {} },
          API_HEADER,
        );
        const result = response as { status?: boolean; data?: PaymentRequestRecord[] };
        const rows = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
            ? (result as unknown as PaymentRequestRecord[])
            : [];
        return { data: rows, total_count: rows.length };
      } catch {
        return { data: [], total_count: 0 };
      }
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: filteredData,
    isLoading: isFilteredLoading,
    isFetching: isFilteredFetching,
    refetch: refetchFiltered,
  } = useQuery<{ data: PaymentRequestRecord[]; total_count: number }>({
    queryKey: ["paymentRequestApprovalFiltered", buildFilterPayload],
    queryFn: async () => {
      try {
        if (Object.keys(buildFilterPayload).length === 0) {
          return { data: [], total_count: 0 };
        }
        const response = await postAPICall(
          (URL as any).paymentRequestFilter,
          { filters: buildFilterPayload },
          API_HEADER,
        );
        const result = response as { status?: boolean; data?: PaymentRequestRecord[] };
        const rows = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
            ? (result as unknown as PaymentRequestRecord[])
            : [];
        return { data: rows, total_count: rows.length };
      } catch {
        return { data: [], total_count: 0 };
      }
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  // ─── Derived data ─────────────────────────────────────────────────────────

  const allData = useMemo(() => {
    if (filtersApplied && filteredData) return filteredData.data ?? [];
    return initialData?.data ?? [];
  }, [filtersApplied, filteredData, initialData]);

  const totalRecords = useMemo(() => {
    if (filtersApplied && filteredData) return filteredData.total_count ?? 0;
    return initialData?.total_count ?? 0;
  }, [filtersApplied, filteredData, initialData]);

  const isTableLoading = useMemo(() => {
    return filtersApplied
      ? isFilteredLoading || isFilteredFetching
      : isLoading || isFetching;
  }, [isLoading, isFetching, isFilteredLoading, isFilteredFetching, filtersApplied]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allData.slice(start, start + pageSize);
  }, [allData, currentPage, pageSize]);

  // ─── Filter actions ───────────────────────────────────────────────────────

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = async () => {
    const hasFilters = Object.values(buildFilterPayload).some((v) => v !== null && v !== undefined && v !== "");
    if (!hasFilters) {
      setFiltersApplied(false);
      setCurrentPage(1);
      await queryClient.invalidateQueries({ queryKey: ["paymentRequestApprovalFiltered"] });
      await refetchInitial();
      ToastNotification({ type: "info", message: "No filters selected, showing all data" });
      setShowFilters(false);
      return;
    }
    setFiltersApplied(true);
    setCurrentPage(1);
    await refetchFiltered();
    ToastNotification({ type: "success", message: "Filters applied successfully" });
    setShowFilters(false);
  };

  const clearAllFilters = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setShowFilters(false);
    setFilters(emptyFilters());
    setFiltersApplied(false);
    setCurrentPage(1);
    await queryClient.invalidateQueries({ queryKey: ["paymentRequestApprovalFiltered"] });
    await refetchInitial();
    isRefreshingRef.current = false;
    ToastNotification({ type: "success", message: "All filters cleared successfully" });
  };

  const activeFilterCount = Object.values(buildFilterPayload).filter(
    (v) => v !== null && v !== undefined && v !== "",
  ).length;

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo<MRT_ColumnDef<PaymentRequestRecord>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 60,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => (currentPage - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: "created_by",
        header: "User",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "request_no",
        header: "Request No",
        size: 150,
        Cell: ({ cell }) => (
          <Text size="sm" fw={600} c="#105476" style={{ fontFamily: "Inter" }}>
            {cell.getValue<string>() || "-"}
          </Text>
        ),
      },
      {
        id: "local_amount",
        header: "Local Amount",
        size: 130,
        Cell: ({ row }) => calcLocalAmount(row.original.charges),
      },
      {
        accessorKey: "payment_type",
        header: "Type",
        size: 120,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "not_over",
        header: "Over",
        size: 120,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: "paid_to_type",
        header: "Paid To Type",
        size: 130,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "paid_to",
        header: "Paid To",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        id: "job_no",
        header: "Job Id",
        size: 140,
        Cell: ({ row }) => getFirstJobNo(row.original.charges),
      },
      {
        accessorKey: "note",
        header: "Note",
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Text size="sm" style={{ fontFamily: "Inter", maxWidth: 150 }} truncate title={val}>
              {val}
            </Text>
          );
        },
      },
      {
        accessorKey: "account_note",
        header: "Accountant Note",
        size: 160,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Text size="sm" style={{ fontFamily: "Inter", maxWidth: 150 }} truncate title={val}>
              {val}
            </Text>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Badge
              size="sm"
              variant="light"
              color={statusColor(val)}
              styles={{ root: { textTransform: "none" } }}
            >
              {val}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {row.original.status?.trim().toLowerCase() !== "approved" && (
                <Box px={10} py={5}>
                  <UnstyledButton onClick={() => navigate(`/payment-request/edit/${row.original.id}`)}>
                    <Group gap="sm">
                      <IconEdit size={16} style={{ color: "#105476" }} />
                      <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>Edit</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              )}
              <Box px={10} py={5}>
                <UnstyledButton onClick={() => navigate(`/payment-request/view/${row.original.id}`)}>
                  <Group gap="sm">
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>View</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {row.original.status?.trim().toLowerCase() === "approved" && (
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() =>
                      navigate("/supplier-invoice/create", {
                        state: { paymentRequestData: row.original },
                      })
                    }
                  >
                    <Group gap="sm">
                      <IconFileInvoice size={16} style={{ color: "#105476" }} />
                      <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>
                        Create Supplier Invoice
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              )}
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate, currentPage, pageSize],
  );

  // ─── Table ────────────────────────────────────────────────────────────────

  const table = useMantineReactTable({
    columns,
    data: paginatedData,
    state: { isLoading: isTableLoading },
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: { columnPinning: { right: ["actions"] } },
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
    mantineTableBodyCellProps: ({ column }) => ({
      style: {
        padding: "8px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        color: "#333740",
        backgroundColor: "#ffffff",
        ...(column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              zIndex: 2,
              borderLeft: "1px solid #F3F3F3",
              boxShadow: "1px -2px 4px 0px #00000040",
            }
          : {}),
      },
    }),
    mantineTableHeadCellProps: ({ column }) => ({
      style: {
        padding: "8px 16px",
        fontSize: "13px",
        fontFamily: "Inter",
        color: "#444955",
        backgroundColor: "#FBFBFB",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #F3F3F3",
        ...(column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              zIndex: 4,
              backgroundColor: "#FBFBFB",
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {}),
      },
    }),
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
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                No payment requests found
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Card
      shadow="sm"
      pt="md"
      pb="sm"
      px="lg"
      radius="md"
      withBorder
      style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", flex: 1 }}
    >
      {/* ── Header ── */}
      <Box mb="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text
            size="md"
            fw={600}
            c="#444955"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Payment Request Approval
          </Text>

          <Group gap="xs" wrap="nowrap">
            {/* Filter toggle */}
            <Button
              size="sm"
              variant={showFilters ? "filled" : "outline"}
              color="#105476"
              leftSection={
                filtersApplied && activeFilterCount > 0
                  ? <IconFilterOff size={16} />
                  : <IconFilter size={16} />
              }
              rightSection={
                filtersApplied && activeFilterCount > 0 ? (
                  <Badge size="xs" color="white" variant="filled" circle style={{ backgroundColor: "#e53e3e", color: "#fff" }}>
                    {activeFilterCount}
                  </Badge>
                ) : null
              }
              styles={{
                root: {
                  fontFamily: "Inter",
                  fontSize: "13px",
                  borderRadius: "4px",
                  ...(showFilters
                    ? { backgroundColor: "#105476", color: "#fff" }
                    : { color: "#105476", borderColor: "#105476" }),
                },
              }}
              onClick={() => setShowFilters((v) => !v)}
            >
              {/* {showFilters ? "Hide Filters" : "Filters"} */}
            </Button>

            {/* Clear filters – only shown when filters are active */}
            {filtersApplied && (
              <Button
                size="sm"
                variant="subtle"
                color="red"
                leftSection={<IconX size={14} />}
                styles={{ root: { fontFamily: "Inter", fontSize: "13px" } }}
                onClick={clearAllFilters}
              >
                Clear
              </Button>
            )}

            {/* Create New */}
            {/* <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              styles={{
                root: {
                  backgroundColor: "#105476",
                  borderRadius: "4px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  "&:hover": { backgroundColor: "#0d4460" },
                },
              }}
              onClick={() => navigate("/payment-request/create")}
            >
              Create New
            </Button> */}
          </Group>
        </Group>
      </Box>

      {/* ── Filter Panel ── */}
      <Collapse in={showFilters}>
        <Box
          mb="md"
          p="md"
          style={{
            border: "1px solid #cce4f0",
            borderRadius: 8,
            backgroundColor: "#f8fcff",
          }}
        >
          <Grid columns={12} gutter="sm">
            {/* Status */}
            <Grid.Col span={3}>
              <Dropdown
                label="Status"
                placeholder="Select status"
                data={STATUS_OPTIONS}
                value={filters.status}
                onChange={(v) => updateFilter("status", v ?? null)}
                clearable
                searchable
                styles={{
                  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
                  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
                }}
              />
            </Grid.Col>

            {/* Date From */}
            {/* <Grid.Col span={3}>
              <SingleDateInput
                label="Date From"
                placeholder="Select date from"
                value={filters.date_from}
                onChange={(d) => updateFilter("date_from", d)}
              />
            </Grid.Col> */}

            {/* Date To */}
            {/* <Grid.Col span={3}>
              <SingleDateInput
                label="Date To"
                placeholder="Select date to"
                value={filters.date_to}
                onChange={(d) => updateFilter("date_to", d)}
              />
            </Grid.Col> */}

            {/* Payment Type */}
            {/* <Grid.Col span={3}>
              <Dropdown
                label="Payment Type"
                placeholder="Select payment type"
                data={PAYMENT_TYPE_OPTIONS}
                value={filters.payment_type}
                onChange={(v) => updateFilter("payment_type", v ?? null)}
                clearable
                styles={{
                  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
                  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
                }}
              />
            </Grid.Col> */}

            {/* Paid To Type */}
            {/* <Grid.Col span={3}>
              <Dropdown
                label="Paid To Type"
                placeholder="Select paid to type"
                data={PAID_TO_TYPE_OPTIONS}
                value={filters.paid_to_type}
                onChange={(v) => updateFilter("paid_to_type", v ?? null)}
                clearable
                styles={{
                  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
                  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
                }}
              />
            </Grid.Col> */}

            {/* Request No */}
            {/* <Grid.Col span={3}>
              <TextInput
                label="Request No"
                placeholder="Search request no"
                value={filters.request_no ?? ""}
                onChange={(e) => updateFilter("request_no", e.target.value || null)}
                leftSection={<IconSearch size={14} />}
                styles={{
                  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
                  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
                }}
              />
            </Grid.Col> */}

            {/* Job Reference */}
            {/* <Grid.Col span={3}>
              <TextInput
                label="Job Reference"
                placeholder="Search job reference"
                value={filters.job_reference ?? ""}
                onChange={(e) => updateFilter("job_reference", e.target.value || null)}
                leftSection={<IconSearch size={14} />}
                styles={{
                  input: { fontSize: "13px", fontFamily: "Inter", height: "36px" },
                  label: { fontSize: "13px", fontFamily: "Inter", marginBottom: "4px" },
                }}
              />
            </Grid.Col> */}

            {/* Action buttons */}
            <Grid.Col span={3}>
              <Box style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: 8 }}>
                <Button
                  size="sm"
                  color="#105476"
                  styles={{
                    root: {
                      backgroundColor: "#105476",
                      fontFamily: "Inter",
                      fontSize: "13px",
                      borderRadius: "4px",
                      flex: 1,
                    },
                  }}
                  onClick={applyFilters}
                >
                  Apply Filters
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  color="gray"
                  styles={{
                    root: { fontFamily: "Inter", fontSize: "13px", borderRadius: "4px" },
                  }}
                  onClick={clearAllFilters}
                >
                  Clear
                </Button>
              </Box>
            </Grid.Col>
          </Grid>
        </Box>
      </Collapse>

      {/* ── Table ── */}
      {isLoading && !filtersApplied ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
              Loading payment requests...
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {isTableLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(255,255,255,0.8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  borderRadius: "8px",
                }}
              >
                <Stack align="center" gap="md">
                  <Loader size="lg" color="#105476" />
                  <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                    {filtersApplied ? "Applying filters..." : "Refreshing..."}
                  </Text>
                </Stack>
              </div>
            )}
            <MantineReactTable table={table} />
          </div>

          {/* ── Pagination ── */}
          <Group w="100%" justify="space-between" align="center" p="xs" wrap="nowrap" pt="md">
            <Group gap="sm" align="center" wrap="nowrap">
              <Text size="sm" c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                Rows per page
              </Text>
              <Select
                size="xs"
                data={["10", "25", "50"]}
                value={String(pageSize)}
                onChange={(val) => {
                  if (!val) return;
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
                w={110}
                styles={
                  {
                    input: { fontSize: "13px", height: "36px", fontFamily: "Inter" },
                  } as Record<string, unknown>
                }
              />
              <Text size="sm" c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                {(() => {
                  if (totalRecords === 0) return "0–0 of 0";
                  const start = (currentPage - 1) * pageSize + 1;
                  const end = Math.min(currentPage * pageSize, totalRecords);
                  return `${start}–${end} of ${totalRecords}`;
                })()}
              </Text>
            </Group>

            <Group gap="xs" align="center" wrap="nowrap" pr={50}>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <Text size="sm" ta="center" style={{ width: 26, fontFamily: "Inter, sans-serif" }}>
                {currentPage}
              </Text>
              <Text size="sm" c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                of {Math.max(1, Math.ceil(totalRecords / pageSize))}
              </Text>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={() => {
                  const total = Math.max(1, Math.ceil(totalRecords / pageSize));
                  setCurrentPage((p) => Math.min(total, p + 1));
                }}
                disabled={currentPage >= Math.max(1, Math.ceil(totalRecords / pageSize))}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </>
      )}
    </Card>
  );
}

export default PaymentRequestApproval;
