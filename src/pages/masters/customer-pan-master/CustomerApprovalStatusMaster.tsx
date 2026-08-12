import { useEffect, useMemo, useState } from "react";
import useAuthStore from "../../../store/authStore";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconEye,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { Dropdown, FormTextInput } from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import useDateFormat from "../../../hooks/useDateFormat";
import { formatDateTimeForUi } from "../../../utils/dateFormat";
import {
  fetchCustomerPanPendingList,
  type CustomerPanApprovalFilters,
  type CustomerPanApprovalRow,
} from "../../../service/customerPanApproval.service";
import {
  CustomerPanApprovalDetails,
  getForeignBranchProfile,
  getStatusBadgeColor,
  type ApprovalPartyType,
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

export default function CustomerApprovalStatusMaster({
  partyType = "customer",
}: {
  partyType?: ApprovalPartyType;
} = {}) {
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const foreignBranchProfile = useMemo(
    () => getForeignBranchProfile(user?.country, user?.branches),
    [user?.country, user?.branches],
  );
  const assignedToEmail = useMemo(() => resolveUserEmail(user), [user]);
  const entityLabel =
    partyType === "vendor"
      ? "Vendor"
      : partyType === "agent"
        ? "Agent"
        : "Customer";
  const entityLabelLower = partyType;
  const dateFormat = useDateFormat();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [viewRow, setViewRow] = useState<CustomerPanApprovalRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [draftFilters, setDraftFilters] =
    useState<FilterFormState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterFormState>(DEFAULT_FILTERS);

  const apiFilters = useMemo<CustomerPanApprovalFilters>(
    () => ({
      assigned_to: assignedToEmail || undefined,
      customer_name:
        appliedFilters.customer_name.trim() ||
        debouncedSearch.trim() ||
        undefined,
      status: appliedFilters.status.trim() || undefined,
      customer_type: partyType,
    }),
    [assignedToEmail, appliedFilters, partyType, debouncedSearch],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "customerPanSubmittedByUser",
      partyType,
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
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listResult) {
      setTotalCount(listResult.total);
    }
  }, [listResult]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch]);

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
    setSearch("");
    setPageIndex(0);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0);
  };

  const handlePageChange = (newPage: number) => {
    setPageIndex(newPage - 1);
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
        header: `${entityLabel} Name`,
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
          <Text size="sm">
            {formatDateTimeForUi(cell.getValue<string>(), dateFormat)}
          </Text>
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
        accessorKey: "approved_by",
        header: "Approved By",
        size: 180,
        Cell: ({ row }) => (
          <Text size="sm" lineClamp={2}>
            {row.original.approved_by?.trim() || "—"}
          </Text>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => (
          <UnstyledButton
            onClick={() => setViewRow(row.original)}
            aria-label={`View ${entityLabelLower}`}
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
    [entityLabel, entityLabelLower, dateFormat],
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

  return (
    <>
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
              {entityLabel} Approval Status
            </Text>

            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size={16} />}
                rightSection={
                  search ? (
                    <ActionIcon
                      variant="transparent"
                      size="sm"
                      onClick={() => setSearch("")}
                      style={{ cursor: "pointer" }}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  ) : null
                }
                w={248}
                size="sm"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                styles={{
                  input: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontstyle: "regular",
                    color: "#334155",
                    minWidth: "24px",
                    minHeight: "24px",
                    width: "248px",
                    height: "36px",
                    border: "1px solid #D0D1D4",
                    "&:focus": {
                      border: "1px solid #105476",
                    },
                  },
                }}
              />
              <ActionIcon
                variant={showFilters ? "filled" : "outline"}
                size={36}
                color={showFilters ? "#E0F5FF" : "gray"}
                onClick={() => setShowFilters(!showFilters)}
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
            </Group>
          </Group>
        </Box>

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
                backgroundColor: "#F8FAFC",
                padding: "4px 8px",
              }}
            >
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
              <Grid.Col span={2.4}>
                <FormTextInput
                  format="normal"
                  label={`${entityLabel} Name`}
                  placeholder="Search by name"
                  size="xs"
                  value={draftFilters.customer_name}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      customer_name: e.target.value,
                    }))
                  }
                />
              </Grid.Col>
              <Grid.Col span={2.4}>
                <Dropdown
                  label="Status"
                  data={STATUS_FILTER_OPTIONS}
                  value={draftFilters.status}
                  onChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: value ?? "",
                    }))
                  }
                  size="xs"
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
              <Button
                size="sm"
                variant="default"
                onClick={clearFilters}
                leftSection={<IconX size={16} />}
                styles={{
                  root: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    height: "36px",
                    border: "1px solid #D0D1D4",
                    color: "#1E293B",
                  },
                }}
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                onClick={applyFilters}
                loading={tableLoading}
                disabled={tableLoading}
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

        {tableLoading ? (
          <Center py="xl" style={{ flex: 1 }}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">
                Loading {entityLabelLower} approval records...
              </Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable table={table} />
            <PaginationBar
              pageSize={pageSize}
              currentPage={pageIndex + 1}
              totalRecords={totalCount}
              onPageSizeChange={handlePageSizeChange}
              onPageChange={handlePageChange}
              pageSizeOptions={["10", "25", "50"]}
            />
          </>
        )}
      </Card>

      <Modal
        opened={viewRow !== null}
        onClose={() => setViewRow(null)}
        title={`View ${entityLabel}`}
        centered
        size="xl"
      >
        <Stack gap="md">
          {viewRow && (
            <ScrollArea.Autosize mah="60vh" offsetScrollbars type="auto">
              <CustomerPanApprovalDetails
                row={viewRow}
                editable={false}
                partyType={partyType}
                requireIndiaTaxIds={isIndiaUser}
                foreignBranchProfile={foreignBranchProfile}
              />
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
