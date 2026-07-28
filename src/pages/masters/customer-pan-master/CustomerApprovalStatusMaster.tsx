import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../../store/authStore";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconFilter,
  IconFilterOff,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCustomerPanPendingList,
  type CustomerPanApprovalFilters,
  type CustomerPanApprovalRow,
} from "../../../service/customerPanApproval.service";
import {
  CustomerPanApprovalDetails,
  getStatusBadgeColor,
} from "./ApproveCustomerPanMaster";
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";

type TableRow = CustomerPanApprovalRow & { sno: number };

type FilterFormState = {
  customer_name: string;
  status: string;
};

const DEFAULT_FILTERS: FilterFormState = {
  customer_name: "",
  status: "",
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
];

function resolveUserEmail(
  user: ReturnType<typeof useAuthStore.getState>["user"],
): string {
  return String(user?.email ?? user?.user_identifier ?? "").trim();
}

export default function CustomerApprovalStatusMaster() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const assignedToEmail = useMemo(() => resolveUserEmail(user), [user]);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationTotal, setPaginationTotal] = useState(1);
  const [viewRow, setViewRow] = useState<CustomerPanApprovalRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<FilterFormState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterFormState>(DEFAULT_FILTERS);

  const apiFilters = useMemo<CustomerPanApprovalFilters>(
    () => ({
      assigned_to: assignedToEmail || undefined,
      customer_name: appliedFilters.customer_name.trim() || undefined,
      status: appliedFilters.status.trim() || undefined,
    }),
    [assignedToEmail, appliedFilters],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "customerPanSubmittedByUser",
      pageIndex,
      pageSize,
      apiFilters.assigned_to,
      apiFilters.customer_name,
      apiFilters.status,
    ],
    queryFn: async () => {
      const index = pageIndex * pageSize;
      return fetchCustomerPanPendingList(index, pageSize, apiFilters);
    },
    enabled: Boolean(apiFilters.assigned_to),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listResult) {
      setTotalCount(listResult.total);
      setPaginationTotal(listResult.paginationTotal);
    }
  }, [listResult]);

  useEffect(() => {
    if (!isIndiaUser) {
      navigate("/master", { replace: true });
    }
  }, [isIndiaUser, navigate]);

  const rawRows = listResult?.rows ?? [];

  const displayRows = useMemo<TableRow[]>(
    () =>
      rawRows.map((row, index) => ({
        ...row,
        sno: row.sno ?? pageIndex * pageSize + index + 1,
      })),
    [rawRows, pageIndex, pageSize],
  );

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPageIndex(0);
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPageIndex(0);
  };

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        enableSorting: false,
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 280,
        Cell: ({ cell }) => (
          <Text size="sm" fw={600} c="#105476" lineClamp={2}>
            {cell.getValue<string>() || "—"}
          </Text>
        ),
      },
      {
        accessorKey: "term_code",
        header: "Term Code",
        size: 110,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Submitted On",
        size: 160,
        Cell: ({ cell }) => (
          <Text size="sm">{cell.getValue<string>() || "—"}</Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 130,
        Cell: ({ row }) => {
          const status = row.original.status;
          const label = status?.trim() || "—";
          return (
            <Badge
              color={getStatusBadgeColor(status)}
              size="sm"
              variant="light"
            >
              {label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => (
          <UnstyledButton
            onClick={() => setViewRow(row.original)}
            aria-label="View customer"
          >
            <Group gap={4} wrap="nowrap">
              <IconEye size={16} style={{ color: "#105476" }} />
              <Text size="sm" c="#105476">
                View
              </Text>
            </Group>
          </UnstyledButton>
        ),
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
      highlightOnHover: true,
      withTableBorder: false,
      style: { width: "100%" },
    },
    mantineTableContainerProps: {
      style: {
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
      },
    },
  });

  const tableLoading = isLoading || isFetching;

  if (!isIndiaUser) {
    return null;
  }

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c="#105476">
            Customer Approval Status
          </Text>

          <Button
            variant="outline"
            leftSection={<IconFilter size={16} />}
            size="xs"
            color="#105476"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            Filters
          </Button>
        </Group>

        {showFilters && (
          <Card
            shadow="xs"
            padding="md"
            radius="md"
            withBorder
            mb="md"
            bg="#f8f9fa"
          >
            <Group align="flex-end" gap="md" wrap="wrap">
              <TextInput
                label="Customer Name"
                placeholder="Search by name"
                value={draftFilters.customer_name}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    customer_name: e.target.value,
                  }))
                }
                style={{ flex: 1, minWidth: 200 }}
                size="sm"
              />
              <Select
                label="Status"
                data={STATUS_FILTER_OPTIONS}
                value={draftFilters.status}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    status: value ?? "",
                  }))
                }
                style={{ minWidth: 160 }}
                size="sm"
              />
            </Group>
            <Group justify="flex-end" mt="md" gap="xs">
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                leftSection={<IconFilterOff size={14} />}
                onClick={clearFilters}
              >
                Clear
              </Button>
              <Button
                size="xs"
                color="#105476"
                leftSection={<IconFilter size={14} />}
                onClick={applyFilters}
              >
                Apply
              </Button>
            </Group>
          </Card>
        )}

        {tableLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading customer approval records...</Text>
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
                setPageSize(Number(val));
                setPageIndex(0);
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
              onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
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
                setPageIndex(Math.min(totalPages - 1, pageIndex + 1));
              }}
              disabled={pageIndex >= paginationTotal - 1}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      <Modal
        opened={viewRow !== null}
        onClose={() => setViewRow(null)}
        title="View Customer"
        centered
        size="xl"
      >
        <Stack gap="md">
          {viewRow && (
            <ScrollArea.Autosize mah="60vh" offsetScrollbars type="auto">
              <CustomerPanApprovalDetails row={viewRow} editable={false} />
            </ScrollArea.Autosize>
          )}
          <Divider />
          <Group justify="flex-end">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={() => setViewRow(null)}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
