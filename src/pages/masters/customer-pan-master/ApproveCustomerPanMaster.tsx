import { useCallback, useEffect, useMemo, useState } from "react";
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
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { ToastNotification } from "../../../components";
import {
  approveCustomerPan,
  extractApiErrorMessage,
  fetchCustomerPanPendingList,
  rejectCustomerPan,
  type CustomerPanApprovalRow,
} from "../../../service/customerPanApproval.service";

type TableRow = CustomerPanApprovalRow & { sno: number };

type PendingAction = {
  row: CustomerPanApprovalRow;
  type: "approve" | "reject";
};

export default function ApproveCustomerPanMaster() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationTotal, setPaginationTotal] = useState(1);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const {
    data: listResult,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["customerPanPending", pageIndex, pageSize, debounced],
    queryFn: async () => {
      const index = pageIndex * pageSize;
      const result = await fetchCustomerPanPendingList(index, pageSize);
      return result;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listResult) {
      setTotalCount(listResult.total);
      setPaginationTotal(listResult.paginationTotal);
    }
  }, [listResult]);

  const rawRows = listResult?.rows ?? [];

  const displayRows = useMemo<TableRow[]>(() => {
    const needle = debounced.trim().toLowerCase();
    const filtered = needle
      ? rawRows.filter((row) => {
          const haystack = [
            row.customer_name,
            row.pan_no,
            row.gstin,
            row.state,
            row.district,
            row.pincode,
            row.assigned_to,
            row.created_by,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        })
      : rawRows;

    return filtered.map((row, index) => ({
      ...row,
      sno: row.sno ?? pageIndex * pageSize + index + 1,
    }));
  }, [rawRows, debounced, pageIndex, pageSize]);

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0);
  };

  const handlePageIndexChange = (newPageIndex: number) => {
    setPageIndex(newPageIndex);
  };

  const refreshList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["customerPanPending"] });
    await refetch();
  }, [queryClient, refetch]);

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    setIsSubmittingAction(true);
    try {
      if (pendingAction.type === "approve") {
        await approveCustomerPan(pendingAction.row.id);
        ToastNotification({
          type: "success",
          message: "Customer PAN approved successfully.",
        });
      } else {
        await rejectCustomerPan(pendingAction.row.id);
        ToastNotification({
          type: "success",
          message: "Customer PAN rejected successfully.",
        });
      }
      setPendingAction(null);
      await refreshList();
    } catch (error) {
      ToastNotification({
        type: "error",
        message: extractApiErrorMessage(error),
      });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
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
        accessorKey: "pan_no",
        header: "PAN",
        size: 120,
        Cell: ({ cell }) => (
          <Text size="sm" fw={600} c="#105476">
            {cell.getValue<string>() || "—"}
          </Text>
        ),
      },
      {
        accessorKey: "customer_name",
        header: "Company Name",
        size: 260,
        Cell: ({ cell }) => (
          <Text size="sm" lineClamp={2}>
            {cell.getValue<string>() || "—"}
          </Text>
        ),
      },
      {
        accessorKey: "gstin",
        header: "GSTIN",
        size: 160,
        Cell: ({ row }) => {
          const item = row.original;
          if (item.gstin) {
            return <Text size="sm">{item.gstin}</Text>;
          }
          if (item.gstin_count != null && item.gstin_count > 0) {
            return <Text size="sm">{item.gstin_count} GSTIN(s)</Text>;
          }
          return <Text size="sm">—</Text>;
        },
      },
      {
        accessorKey: "state",
        header: "State",
        size: 130,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        accessorKey: "district",
        header: "District",
        size: 140,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        accessorKey: "pincode",
        header: "Pin Code",
        size: 100,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        accessorKey: "assigned_to",
        header: "Assign To",
        size: 150,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        accessorKey: "approved",
        header: "Approval Status",
        size: 130,
        Cell: ({ row }) => {
          const approved = row.original.approved;
          const label =
            approved === true
              ? "APPROVED"
              : approved === false
                ? "PENDING"
                : "PENDING";
          const color =
            approved === true ? "green" : approved === false ? "yellow" : "gray";
          return (
            <Badge color={color} size="sm" variant="light">
              {label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "created_by",
        header: "Created By",
        size: 120,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 50,
        Cell: ({ row }) => {
          const [menuOpened, setMenuOpened] = useState(false);
          const item = row.original;

          return (
            <Menu
              withinPortal
              position="bottom-end"
              shadow="sm"
              radius="md"
              opened={menuOpened}
              onChange={setMenuOpened}
            >
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      setPendingAction({ row: item, type: "approve" });
                    }}
                  >
                    <Group gap="sm">
                      <IconCheck size={16} style={{ color: "#2f9e44" }} />
                      <Text size="sm">Approve</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      setPendingAction({ row: item, type: "reject" });
                    }}
                  >
                    <Group gap="sm">
                      <IconX size={16} style={{ color: "#e03131" }} />
                      <Text size="sm">Reject</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [],
  );

  const table = useMantineReactTable<TableRow>({
    columns,
    data: displayRows,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
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
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "#ffffff",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #e9ecef",
      },
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
  });

  const tableLoading = isLoading || isFetching;

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c="#105476">
            Approve Customer PAN
          </Text>

          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            style={{ width: 300 }}
            radius="sm"
            size="xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </Group>

        {tableLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading pending customer PAN records...</Text>
            </Stack>
          </Center>
        ) : (
          <MantineReactTable table={table} />
        )}

        <Group
          w="100%"
          justify="space-between"
          align="center"
          px="md"
          py="xs"
          style={{ borderTop: "1px solid #e9ecef" }}
          wrap="nowrap"
          mt="xs"
        >
          <Group gap="sm" align="center" wrap="nowrap" mt={10}>
            <Text size="sm" c="dimmed">
              Rows per page
            </Text>
            <Select
              size="xs"
              data={["10", "25", "50"]}
              value={String(pageSize)}
              onChange={(val) => {
                if (!val) return;
                handlePageSizeChange(Number(val));
              }}
              w={110}
              styles={{ input: { fontSize: 12, height: 30 } }}
            />
            <Text size="sm" c="dimmed">
              {(() => {
                if (totalCount === 0) return "0–0 of 0";
                const start = pageIndex * pageSize + 1;
                const end = Math.min((pageIndex + 1) * pageSize, totalCount);
                return `${start}–${end} of ${totalCount}`;
              })()}
            </Text>
          </Group>

          <Group gap="xs" align="center" wrap="nowrap" mt={10}>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => handlePageIndexChange(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Text size="sm" ta="center" style={{ width: 26 }}>
              {pageIndex + 1}
            </Text>
            <Text size="sm" c="dimmed">
              of {Math.max(1, paginationTotal)}
            </Text>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => {
                const totalPages = Math.max(1, paginationTotal);
                handlePageIndexChange(
                  Math.min(totalPages - 1, pageIndex + 1),
                );
              }}
              disabled={pageIndex >= paginationTotal - 1}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      <Modal
        opened={pendingAction !== null}
        onClose={() => !isSubmittingAction && setPendingAction(null)}
        title={
          pendingAction?.type === "approve"
            ? "Approve Customer PAN"
            : "Reject Customer PAN"
        }
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            {pendingAction?.type === "approve"
              ? "Are you sure you want to approve this customer?"
              : "Are you sure you want to reject this customer?"}
          </Text>
          {pendingAction?.row && (
            <Box p="xs" bg="#f8f9fa" style={{ borderRadius: 6 }}>
              <Text size="xs" c="dimmed">
                <Text span fw={500}>
                  Company:
                </Text>{" "}
                {pendingAction.row.customer_name || "—"}
                <br />
                <Text span fw={500}>
                  PAN:
                </Text>{" "}
                {pendingAction.row.pan_no || "—"}
                <br />
                <Text span fw={500}>
                  GSTIN:
                </Text>{" "}
                {pendingAction.row.gstin ||
                  (pendingAction.row.gstin_count
                    ? `${pendingAction.row.gstin_count} GSTIN(s)`
                    : "—")}
              </Text>
            </Box>
          )}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={() => setPendingAction(null)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              color={pendingAction?.type === "approve" ? "green" : "red"}
              onClick={handleConfirmAction}
              loading={isSubmittingAction}
            >
              {pendingAction?.type === "approve" ? "Approve" : "Reject"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
