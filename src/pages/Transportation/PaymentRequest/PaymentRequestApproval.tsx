import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
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
  Loader,
  Badge,
  Grid,
  TextInput
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFileInvoice,
  IconFilter,
  IconX,
  IconSearch,
  IconPlus,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { Dropdown, SingleDateInput, ToastNotification } from "../../../components";
import dayjs from "dayjs";
import { useDebouncedValue } from "@mantine/hooks";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";
import useDateFormat from "../../../hooks/useDateFormat";

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
  { value: "Active", label: "Unapproved" },
    { value: "Approved", label: "Approved" },
  { value: "APPROVED_WITHOUT_CRJ", label: "Approved (Waiting for Payment / CRJ)" },
  { value: "UNPOSTED", label: "Unposted" },
    { value: "Rejected", label: "Rejected" },
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
  date_from: dayjs().startOf("month").toDate(),
  date_to: dayjs().toDate(),
  payment_type: null,
  paid_to_type: null,
  request_no: null,
  job_reference: null,
});

const LIST_KEY = "PAYMENT_REQUEST_APPROVAL";

// ─── Component ───────────────────────────────────────────────────────────────

function PaymentRequestApproval() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const dateFormat = useDateFormat();

  const [showFilters, setShowFilters] = useState(false);
  // draftFilters: what user is editing in the panel; appliedFilters: what drives the query
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(emptyFilters());
  const [draftCreatedBy, setDraftCreatedBy] = useState("");
  const [appliedCreatedBy, setAppliedCreatedBy] = useState("");
  const [draftPaidTo, setDraftPaidTo] = useState("");
  const [appliedPaidTo, setAppliedPaidTo] = useState("");

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  useEffect(() => {
    if (isRestoring) return;
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
    );
  }, [debouncedSearch, isRestoring]);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") setSearch(stored.search);

    if (stored?.filters && typeof stored.filters === "object") {
      const f = stored.filters as Record<string, unknown>;
      const restored: FilterState = {
        status: (f.status as string) ?? null,
        date_from: f.date_from ? new Date(f.date_from as string) : null,
        date_to: f.date_to ? new Date(f.date_to as string) : null,
        payment_type: (f.payment_type as string) ?? null,
        paid_to_type: (f.paid_to_type as string) ?? null,
        request_no: (f.request_no as string) ?? null,
        job_reference: (f.job_reference as string) ?? null,
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
      setDraftCreatedBy((f.created_by as string) ?? "");
      setAppliedCreatedBy((f.created_by as string) ?? "");
      setDraftPaidTo((f.paid_to as string) ?? "");
      setAppliedPaidTo((f.paid_to as string) ?? "");
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;
  const index = pagination.pageIndex * pagination.pageSize;

  // ─── Build filter payload ─────────────────────────────────────────────────

  const buildFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if (appliedFilters.status) payload.status = appliedFilters.status;
    if (appliedFilters.date_from) payload.date_from = dayjs(appliedFilters.date_from).format("YYYY-MM-DD");
    if (appliedFilters.date_to) payload.date_to = dayjs(appliedFilters.date_to).format("YYYY-MM-DD");
    if (appliedFilters.payment_type) payload.payment_type = appliedFilters.payment_type;
    if (appliedFilters.paid_to_type) payload.paid_to_type = appliedFilters.paid_to_type;
    if (appliedFilters.request_no?.trim()) payload.request_no = appliedFilters.request_no.trim();
    if (appliedFilters.job_reference?.trim()) payload.job_reference = appliedFilters.job_reference.trim();
    if (appliedCreatedBy.trim()) payload.created_by = appliedCreatedBy.trim();
    if (appliedPaidTo.trim()) payload.paid_to = appliedPaidTo.trim();
    return payload;
  }, [appliedFilters, appliedCreatedBy, appliedPaidTo]);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const {
    data: requestData = [],
    isLoading: requestLoading,
    isFetching: requestFetching,
    error: requestError,
  } = useQuery({
    queryKey: ["paymentRequestApproval", pagination.pageIndex, pagination.pageSize, JSON.stringify(buildFilterPayload), debouncedSearch],
    queryFn: async (): Promise<PaymentRequestRecord[]> => {
      try {
        const filtersWithSearch: Record<string, unknown> = { ...buildFilterPayload };
        if (debouncedSearch?.trim()) filtersWithSearch.search = debouncedSearch.trim();

        const payload = Object.keys(filtersWithSearch).length > 0
          ? { filters: filtersWithSearch }
          : { filters: {} };

        setIsInitialLoad(false);

        const response = await apiCallProtected.post(
          `${(URL as any).paymentRequestFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        const raw = response as any;
        const bodyCandidate = raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate ?? null;
        if (!body) {
          setTotalRecords(0);
          return [];
        }

        const list: PaymentRequestRecord[] = Array.isArray((body as any).data)
          ? (body as any).data
          : Array.isArray(body) ? body : [];

        const total = (body as any).total ?? (body as any).total_count ?? list.length;
        setTotalRecords(Number(total));
        return list;
      } catch {
        setTotalRecords(0);
        return [];
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = requestLoading || requestFetching || isInitialLoad;

  // ─── Filter actions ───────────────────────────────────────────────────────

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handlePageSizeChange = (newPageSize: number) => setPagination({ pageIndex: 0, pageSize: newPageSize });
  const handlePageChange = (newPage: number) => setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setAppliedCreatedBy(draftCreatedBy);
    setAppliedPaidTo(draftPaidTo);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, buildFilterPayload);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    const empty = emptyFilters();
    setDraftFilters(empty);
    setAppliedFilters(empty);
    setDraftCreatedBy("");
    setAppliedCreatedBy("");
    setDraftPaidTo("");
    setAppliedPaidTo("");
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
    setSearch("");
    setShowFilters(false);
  };

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo<MRT_ColumnDef<PaymentRequestRecord>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 60,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => index + row.index + 1,
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
        size: 100,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.date
              ? dayjs(row.original?.date).format(dateFormat)
              : "-"}
          </Text>
        ),
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
              {row.original.status?.trim().toLowerCase() !== "approved" &&
                row.original.status?.trim().toLowerCase() !== "rejected" && (
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setStoreFilters(LIST_KEY, buildFilterPayload);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate(`/payment-request/edit/${row.original.id}`);
                    }}
                  >
                    <Group gap="sm">
                      <IconEdit size={16} style={{ color: "#105476" }} />
                      <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>Edit</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              )}
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    setStoreFilters(LIST_KEY, buildFilterPayload);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate(`/payment-request/view/${row.original.id}`);
                  }}
                >
                  <Group gap="sm">
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>View</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {row.original.status?.trim().toLowerCase() === "approved" && (
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setStoreFilters(LIST_KEY, buildFilterPayload);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate("/supplier-invoice/create", {
                        state: { paymentRequestData: row.original },
                      });
                    }}
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
    [navigate, index, buildFilterPayload, search, setStoreFilters, setStoreSearch, setShouldRestore],
  );

  // ─── Table ────────────────────────────────────────────────────────────────

  const table = useMantineReactTable({
    columns,
    data: requestData ?? [],
    state: {},
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
            <TextInput
              placeholder="Search..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                search ? (
                  <ActionIcon variant="transparent" size="sm" onClick={() => setSearch("")} style={{ cursor: "pointer" }}>
                    <IconX size={16} />
                  </ActionIcon>
                ) : null
              }
              w={248} size="sm" value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              styles={{
                input: {
                  borderRadius: "4px", fontSize: "13px", fontFamily: "Inter",
                  color: "#333740", height: "36px", border: "1px solid #D0D1D4",
                  "&:focus": { border: "1px solid #105476" },
                },
              }}
            />
            <ActionIcon
              variant={showFilters ? "filled" : "outline"}
              size={36}
              color={showFilters ? "#E0F5FF" : "gray"}
              onClick={() => setShowFilters((v) => !v)}
              styles={{
                root: {
                  borderRadius: "4px",
                  backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                  border: showFilters
                    ? "1px solid #105476"
                    : "1px solid #737780",
                  color: showFilters ? "#105476" : "#737780",
                  "&:active": {
                    border: "1px solid #105476",
                    color: "#FFFFFF",
                  },
                },
              }}
            >
              <IconFilter size={18} />
            </ActionIcon>

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
      {showFilters && (
        <Box
          tt="capitalize"
          mb="sm"
          p="sm"
          style={{
            borderRadius: "8px",
            border: "1px solid #E0E0E0",
            flexShrink: 0,
            height: "fit-content",
          }}
        >
          <Group
            justify="space-between"
            align="center"
            mb="sm"
            px="md"
            style={{
              backgroundColor: "#FAFAFA",
              padding: "4px 8px",
            }}
          >
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
            <Grid.Col span={3}>
              <FormTextInput
                label="User"
                value={draftCreatedBy}
                placeholder="Type User"
                onChange={(e) => setDraftCreatedBy(e.currentTarget.value)}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <FormTextInput
                label="Paid To"
                value={draftPaidTo}
                placeholder="Type Paid To"
                onChange={(e) => setDraftPaidTo(e.currentTarget.value)}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <FormTextInput
                label="Job Id"
                value={draftFilters.job_reference ?? ""}
                placeholder="Type Job Id"
                onChange={(e) => updateFilter("job_reference", e.currentTarget.value || null)}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <FormTextInput
                label="Request Number"
                value={draftFilters.request_no ?? ""}
                placeholder="Type Request Number"
                onChange={(e) => updateFilter("request_no", e.currentTarget.value || null)}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Payment Type"
                placeholder="Select Payment Type"
                data={["Bank", "Cash", "Online Transfer", "PDC", "DD/PO"]}
                searchable
                value={draftFilters.payment_type}
                onChange={(v) => {
                  const mapped = v === "Cash" ? "CASH" : v === "Online Transfer" ? "ONLINE TRANSFER" : v;
                  updateFilter("payment_type", mapped ?? null);
                }}
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Paid To Type"
                placeholder="Select Paid To Type"
                data={["customer", "agent", "supplier", "Vendor"]}
                searchable
                value={draftFilters.paid_to_type}
                onChange={(v) => updateFilter("paid_to_type", v ?? null)}
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <SingleDateInput
                label="Date From"
                placeholder="Select Date"
                value={draftFilters.date_from}
                onChange={(d) => updateFilter("date_from", d)}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <SingleDateInput
                label="Date To"
                placeholder="Select Date"
                value={draftFilters.date_to}
                onChange={(d) => updateFilter("date_to", d)}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={[
                  { value: "Active", label: "Active" },
                  { value: "Approved", label: "Approved" },
                  { value: "Rejected", label: "Rejected" },
                ]}
                value={draftFilters.status}
                onChange={(v) => updateFilter("status", v ?? null)}
                clearable
                searchable
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
            <Button
              size="sm"
              variant="default"
              onClick={clearAllFilters}
              leftSection={<IconX size={16} />}
              styles={{
                root: {
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 600,
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  color: "#444955",
                },
              }}
            >
              Clear Filters
            </Button>
            <Button
              size="sm"
              onClick={applyFilters}
              loading={isLoading}
              disabled={isLoading}
              leftSection={<IconFilter size={16} />}
              styles={{
                root: {
                  backgroundColor: "#105476",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 600,
                  height: "36px",
                  "&:hover": {
                    backgroundColor: "#0d4261",
                  },
                },
              }}
            >
              Apply Filters
            </Button>
          </Group>
        </Box>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
              Loading payment requests...
            </Text>
          </Stack>
        </Center>
      ) : requestError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
              Error loading payment requests. Please try refreshing the page.
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <MantineReactTable table={table} />
          <PaginationBar
            pageSize={pagination.pageSize}
            currentPage={currentPage}
            totalRecords={totalRecords}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={handlePageChange}
            pageSizeOptions={["1", "25", "50"]}
          />
        </>
      )}
    </Card>
  );
}

export default PaymentRequestApproval;
