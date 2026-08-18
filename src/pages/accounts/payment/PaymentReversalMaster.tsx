import { useMemo, useState } from "react";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatCurrencyAmountForUi,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Select,
  type SelectProps,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconEye,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";

type PaymentReversalRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  day_book_name?: string;
  payment_no?: string;
  reverse_payment_no?: string;
  type?: string;
  status?: string;
  amount?: number | string;
  [key: string]: unknown;
};

type PaymentReversalFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  data?: PaymentReversalRow[];
};

type PaymentReversalListResult = {
  list: PaymentReversalRow[];
  total: number;
};

export default function PaymentReversalMaster() {
  const user = useAuthStore((s) => s.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const navigate = useNavigate();
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [search] = useState("");

  const index = (listCurrentPage - 1) * listPageSize;

  const handlePageSizeChange = (newPageSize: number) => {
    setListPageSize(newPageSize);
    setListCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setListCurrentPage(newPage);
  };

  const {
    data: listResult,
    isLoading: listLoading,
    isFetching: listFetching,
    error: listError,
  } = useQuery({
    queryKey: ["payment-reversal", listCurrentPage, listPageSize, search],
    queryFn: async (): Promise<PaymentReversalListResult> => {
      try {
        const payload = { filters: {} as Record<string, unknown> };
        if (search?.trim()) {
          payload.filters.search = search.trim();
        }
        const response = await apiCallProtected.post(
          `${URL.reversePaymentFilter}?index=${index}&limit=${listPageSize}`,
          payload,
        );
        const body =
          response?.data != null
            ? (response.data as PaymentReversalFilterResponse)
            : null;
        if (!body) {
          return { list: [], total: 0 };
        }
        const list = Array.isArray(body.data)
          ? body.data
          : Array.isArray(body)
            ? (body as unknown as PaymentReversalRow[])
            : [];
        const total =
          body.total != null ? Number(body.total) : list.length;
        return { list, total };
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 404) {
          return { list: [], total: 0 };
        }
        console.error("Error fetching payment reversal data:", err);
        return { list: [], total: 0 };
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });

  const isLoading = listFetching || listLoading;
  const tableData = listResult?.list ?? [];
  const listTotalRecords = listResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(listTotalRecords / listPageSize));
  const pagination = {
    pageIndex: listCurrentPage - 1,
    pageSize: listPageSize,
  };

  const columns = useMemo<MRT_ColumnDef<PaymentReversalRow>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) =>
          row.original?.sno ?? index + row.index + 1,
      },
      {
        accessorKey: "day_book_name",
        header: "Day Book",
        size: 160,
      },
      {
        id: "payment_no",
        header: "Payment No",
        size: 160,
        accessorFn: (row) =>
          (row.reverse_payment_no ?? row.payment_no ?? "") as string,
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 100,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) => {
          const val = cell.getValue<unknown>();
          if (val == null || val === "") return "-";
          const n = typeof val === "number" ? val : parseFloat(String(val));
          return Number.isFinite(n) ? formatCurrencyAmountForUi(n) : String(val);
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ cell }) => {
          const val = cell.getValue<unknown>();
          if (val == null) return "-";
          const str = typeof val === "number" ? val.toFixed(2) : String(val);
          const statusUpper = str.toUpperCase();
          const color =
            statusUpper === "POSTED"
              ? "green"
              : statusUpper === "UNPOSTED"
                ? "gray"
                : "#105476";
          return (
            <Badge
              size="sm"
              variant="light"
              color={color}
              styles={{ root: { textTransform: "none" } }}
            >
              {str}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => {
          const status = String(row.original?.status ?? "").toUpperCase();
          const isUnposted = status === "UNPOSTED";
          return (
            <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      navigate("/payment/reversal/view", {
                        state: {
                          ...row.original,
                          documents:
                            (row.original as any)?.documents ??
                            (row.original as any)?.supporting_documents ??
                            [],
                        },
                      });
                    }}
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
                {isUnposted && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        navigate("/payment/reversal/edit", {
                          state: {
                            ...row.original,
                            documents:
                              (row.original as any)?.documents ??
                              (row.original as any)?.supporting_documents ??
                              [],
                          },
                        });
                      }}
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
                )}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [index, navigate],
  );

  const table = useMantineReactTable({
    columns,
    data: tableData,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    manualPagination: true,
    rowCount: listTotalRecords,
    state: {
      pagination,
    },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "sm",
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
    mantineTableBodyCellProps: ({ column }) => {
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "30px",
              zIndex: 2,
              borderLeft: "1px solid #F3F3F3",
              boxShadow: "1px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#334155",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "80px",
              zIndex: 2,
              backgroundColor: "#F8FAFC",
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
          borderBottom: "1px solid #F3F3F3",
          ...extraStyles,
        },
      };
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
  });

  return (
    <Card
      shadow="sm"
      pt="md"
      pb="sm"
      px="md"
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
      <Box>
        <Group justify="space-between" align="center" pb="sm">
          <Text
            size="md"
            fw={600}
            c="#1E293B"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Payment Reversal List
          </Text>
        </Group>
      </Box>

      {isLoading ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">
              Loading payment reversal data...
            </Text>
          </Stack>
        </Center>
      ) : listError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Text c="dimmed">
              Error loading payment reversal data. Please try refreshing the page.
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <MantineReactTable table={table} />
          <Group
            w="100%"
            justify="space-between"
            align="center"
            p="xs"
            wrap="nowrap"
            pt="sm"
          >
            <Group gap="sm" align="center" wrap="nowrap">
              <Text size="sm" c="dimmed">
                Rows per page
              </Text>
              <Select
                size="xs"
                data={["10", "25", "50"]}
                value={String(listPageSize)}
                onChange={(val) => {
                  if (!val) return;
                  handlePageSizeChange(Number(val));
                }}
                w={110}
                styles={
                  { input: { fontSize: 12, height: 30 } } as SelectProps["styles"]
                }
              />
              <Text size="sm" c="dimmed">
                {listTotalRecords === 0
                  ? "0–0 of 0"
                  : `${(listCurrentPage - 1) * listPageSize + 1}–${Math.min(
                      listCurrentPage * listPageSize,
                      listTotalRecords,
                    )} of ${listTotalRecords}`}
              </Text>
            </Group>
            <Group gap="xs" align="center" wrap="nowrap" pr={50}>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={() =>
                  handlePageChange(Math.max(1, listCurrentPage - 1))
                }
                disabled={listCurrentPage === 1}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <Text size="sm" ta="center" style={{ width: 26 }}>
                {listCurrentPage}
              </Text>
              <Text size="sm" c="dimmed">
                of {totalPages}
              </Text>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={() =>
                  handlePageChange(Math.min(totalPages, listCurrentPage + 1))
                }
                disabled={listCurrentPage >= totalPages}
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
