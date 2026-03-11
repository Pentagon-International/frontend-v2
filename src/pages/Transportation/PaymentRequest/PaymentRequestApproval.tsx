import { useMemo, useState } from "react";
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
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentRequestCharge = {
  id: number;
  payment_request: number;
  job_id?: string;
  charge_id: number;
  charge_code?: string;
  charge_name?: string;
  currency_code?: string;
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
  note?: string;
  account_note?: string;
  status?: string;
  amount?: string;
  currency_code?: string;
  charges?: PaymentRequestCharge[];
};

// ─── Filter options ───────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Rejected", value: "Rejected" },
  { label: "Unapproved", value: "Unapproved" },
  { label: "Approved (Waiting for Payment / CRJ)", value: "Approved" },
  { label: "Unposted", value: "Unposted" },
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

function getSegCode(charges?: PaymentRequestCharge[]): string {
  return charges?.find((c) => c.charge_code)?.charge_code ?? "-";
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

// ─── Component ───────────────────────────────────────────────────────────────

function PaymentRequestApproval() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filterPayload = useMemo(
    () => ({
      filters: activeFilter ? { status: activeFilter } : {},
    }),
    [activeFilter],
  );

  const {
    data: queryData,
    isLoading,
    isFetching,
  } = useQuery<{ data: PaymentRequestRecord[]; total_count: number }>({
    queryKey: ["paymentRequestApproval", activeFilter],
    queryFn: async () => {
      try {
        const response = await postAPICall(
          (URL as any).paymentRequestFilter,
          filterPayload,
          API_HEADER,
        );
        const result = response as {
          status?: boolean;
          data?: PaymentRequestRecord[];
        };
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

  const allData = useMemo(() => queryData?.data ?? [], [queryData]);
  const totalRecords = useMemo(() => queryData?.total_count ?? 0, [queryData]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allData.slice(start, start + pageSize);
  }, [allData, currentPage, pageSize]);

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
    //   {
    //     id: "seg_code",
    //     header: "Seg Code",
    //     size: 110,
    //     Cell: ({ row }) => getSegCode(row.original.charges),
    //   },
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
            <Text
              size="sm"
              style={{ fontFamily: "Inter", maxWidth: 150 }}
              truncate
              title={val}
            >
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
            <Text
              size="sm"
              style={{ fontFamily: "Inter", maxWidth: 150 }}
              truncate
              title={val}
            >
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
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate(
                      `/payment-request/edit/${row.original.id}`,
                    )
                  }
                >
                  <Group gap="sm">
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text
                      size="sm"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Edit
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate(
                      `/payment-request/view/${row.original.id}`,
                    )
                  }
                >
                  <Group gap="sm">
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text
                      size="sm"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      View
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate, currentPage, pageSize],
  );

  const table = useMantineReactTable({
    columns,
    data: paginatedData,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      columnPinning: { right: ["actions"] },
    },
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

  return (
    <Card
      shadow="sm"
      pt="md"
      pb="sm"
      px="lg"
      radius="md"
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        flex: 1,
      }}
    >
      {/* Header */}
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
      </Box>

      {/* Filter Buttons */}
      <Box mb="md">
        <Group gap="xs" wrap="wrap">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="xs"
              variant={activeFilter === opt.value ? "filled" : "outline"}
              color="#105476"
              styles={{
                root: {
                  fontFamily: "Inter",
                  fontSize: "12px",
                  borderRadius: "6px",
                  ...(activeFilter === opt.value
                    ? { backgroundColor: "#105476", color: "#fff" }
                    : { color: "#105476", borderColor: "#105476" }),
                },
              }}
              onClick={() => {
                setActiveFilter(opt.value);
                setCurrentPage(1);
              }}
            >
              {opt.label}
            </Button>
          ))}
        </Group>
      </Box>

      {/* Table */}
      {isLoading ? (
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
          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {isFetching && (
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
                    Refreshing...
                  </Text>
                </Stack>
              </div>
            )}
            <MantineReactTable table={table} />
          </div>

          {/* Pagination */}
          <Group
            w="100%"
            justify="space-between"
            align="center"
            p="xs"
            wrap="nowrap"
            pt="md"
          >
            <Group gap="sm" align="center" wrap="nowrap">
              <Text
                size="sm"
                c="dimmed"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
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
                    input: {
                      fontSize: "13px",
                      height: "36px",
                      fontFamily: "Inter",
                    },
                  } as Record<string, unknown>
                }
              />
              <Text
                size="sm"
                c="dimmed"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
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
                onClick={() =>
                  setCurrentPage((p) => Math.max(1, p - 1))
                }
                disabled={currentPage === 1}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <Text
                size="sm"
                ta="center"
                style={{ width: 26, fontFamily: "Inter, sans-serif" }}
              >
                {currentPage}
              </Text>
              <Text
                size="sm"
                c="dimmed"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                of {Math.max(1, Math.ceil(totalRecords / pageSize))}
              </Text>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={() => {
                  const total = Math.max(
                    1,
                    Math.ceil(totalRecords / pageSize),
                  );
                  setCurrentPage((p) => Math.min(total, p + 1));
                }}
                disabled={
                  currentPage >= Math.max(1, Math.ceil(totalRecords / pageSize))
                }
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
