import { useMemo, useState } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Select,
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
  IconPlus,
  IconReceiptRefund,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { postAPICall } from "../../../service/postApiCall";

// ─── Types ───────────────────────────────────────────────────────────────────

type JVRecord = {
  id?: number;
  document_no?: string;
  account_name?: string;
  narration?: string;
  journal_date?: string;
  note?: string;
  status?: string;
  debit_total?: string;
  credit_total?: string;
  difference?: string;
  daybook_id?: number;
  charges?: Array<{
    charge_id?: number;
    currency_id?: number;
    account_name?: string;
    subledger?: string;
    code?: string;
    key?: string;
    roe?: string;
    amount?: string;
    local_amount?: string;
    dr_cr?: string;
    narration?: string;
    c_r_n?: string;
    shipment_id?: string;
    job_id?: string;
  }>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  switch (status.toUpperCase()) {
    case "POSTED":
      return "green";
    case "UNPOSTED":
      return "orange";
    default:
      return "gray";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

function JournalVoucherReversalMaster() {
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ─── Query ────────────────────────────────────────────────────────────────

  const { data, isLoading, isFetching } = useQuery<{
    data: JVRecord[];
    total_count: number;
  }>({
    queryKey: ["journalVoucherMaster"],
    queryFn: async () => {
      try {
        const response = await postAPICall(
          (URL as any).journalVoucherReversalFilter,
          { filters: {} },
          API_HEADER,
        );
        const result = response as { status?: boolean; data?: JVRecord[] };
        const rows = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
            ? (result as unknown as JVRecord[])
            : [];
        return { data: rows, total_count: rows.length };
      } catch {
        return { data: [], total_count: 0 };
      }
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const allData = data?.data ?? [];
  const totalRecords = data?.total_count ?? 0;
  const isTableLoading = isLoading || isFetching;

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allData.slice(start, start + pageSize);
  }, [allData, currentPage, pageSize]);

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo<MRT_ColumnDef<JVRecord>[]>(
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
        accessorKey: "document_no",
        header: "Document No",
        size: 150,
        Cell: ({ cell }) => (
          <Text size="sm" fw={600} c="#105476" style={{ fontFamily: "Inter" }}>
            {cell.getValue<string>() || "-"}
          </Text>
        ),
      },
      {
        accessorKey: "journal_date",
        header: "Journal Date",
        size: 130,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: "account_name",
        header: "Account Name",
        size: 170,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "narration",
        header: "Narration",
        size: 180,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          if (!val) return "-";
          return (
            <Text
              size="sm"
              style={{ fontFamily: "Inter", maxWidth: 170 }}
              truncate
              title={val}
            >
              {val}
            </Text>
          );
        },
      },
      {
        accessorKey: "debit_total",
        header: "Debit",
        size: 110,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "credit_total",
        header: "Credit",
        size: 110,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "difference",
        header: "Difference",
        size: 110,
        Cell: ({ cell }) => {
          const val = cell.getValue<string>();
          const num = parseFloat(val ?? "0");
          return (
            <Text
              size="sm"
              fw={500}
              c={Math.abs(num) > 0.005 ? "red" : "#105476"}
              style={{ fontFamily: "Inter" }}
            >
              {val || "-"}
            </Text>
          );
        },
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
        accessorKey: "status",
        header: "Status",
        size: 110,
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
        Cell: ({ row }) => {
          const status = String(row.original.status ?? "").trim().toUpperCase();
          const isApproved = status === "APPROVED";
          const isPosted = status === "POSTED";
          const canEdit = !isApproved && !isPosted;
          return (
            <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {canEdit && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate(`/journal-voucher-reversal/edit/${row.original.id}`, {
                          state: { rowData: row.original },
                        })
                      }
                    >
                      <Group gap="sm">
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text size="sm" style={{ fontFamily: "Inter" }}>
                          Edit
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                )}

                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() =>
                      navigate(`/journal-voucher-reversal/view/${row.original.id}`, {
                        state: { rowData: row.original },
                      })
                    }
                  >
                    <Group gap="sm">
                      <IconEye size={16} style={{ color: "#105476" }} />
                      <Text size="sm" style={{ fontFamily: "Inter" }}>
                        View
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>

                {isApproved && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/journal-voucher-reversal/create", {
                          state: { reversalOf: row.original },
                        })
                      }
                    >
                      <Group gap="sm">
                        <IconReceiptRefund size={16} style={{ color: "#105476" }} />
                        <Text size="sm" style={{ fontFamily: "Inter" }}>
                          JV Reversal
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
              <Text c="dimmed" style={{ fontFamily: "Inter" }}>
                No journal voucher reversals found
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
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        flex: 1,
      }}
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
            Journal Voucher Reversal
          </Text>

          {/* <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            styles={{
              root: {
                backgroundColor: "#105476",
                borderRadius: "4px",
                color: "#FFFFFF",
                fontSize: "13px",
                fontFamily: "Inter",
              },
            }}
            onClick={() => navigate("/journal-voucher-reversal/create")}
          >
            Create New
          </Button> */}
        </Group>
      </Box>

      {/* ── Table ── */}
      {isLoading ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed" style={{ fontFamily: "Inter" }}>
              Loading journal voucher reversals...
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
            {isFetching && !isLoading && (
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
                  <Text c="dimmed" style={{ fontFamily: "Inter" }}>
                    Refreshing...
                  </Text>
                </Stack>
              </div>
            )}
            <MantineReactTable table={table} />
          </div>

          {/* ── Pagination ── */}
          <Group
            w="100%"
            justify="space-between"
            align="center"
            p="xs"
            wrap="nowrap"
            pt="md"
          >
            <Group gap="sm" align="center" wrap="nowrap">
              <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
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
              <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
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
              <Text
                size="sm"
                ta="center"
                style={{ width: 26, fontFamily: "Inter" }}
              >
                {currentPage}
              </Text>
              <Text size="sm" c="dimmed" style={{ fontFamily: "Inter" }}>
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

export default JournalVoucherReversalMaster;
