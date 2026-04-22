import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  useMantineReactTable,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilter,
  IconReceiptRefund,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import FormTextInput from "../../../components/FormTextInput";
import { Dropdown, SingleDateInput } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";

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

const LIST_KEY = "JOURNAL_VOUCHER_REVERSAL_MASTER";

type JVReversalFilters = {
  document_no: string;
  account_name: string;
  journal_date_from: Date | null;
  journal_date_to: Date | null;
  status: string;
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

  const location = useLocation();
  const defaultDateFrom = dayjs().startOf("month").toDate();
  const defaultDateTo = dayjs().toDate();
  const dateFormat = useDateFormat();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const DEFAULT_FILTERS: JVReversalFilters = {
    document_no: "",
    account_name: "",
    journal_date_from: defaultDateFrom,
    journal_date_to: defaultDateTo,
    status: "",
  };

  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  // Sync search → store and reset page on debounced change
  useEffect(() => {
    if (isRestoring) return;
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
    );
    setStoreSearch(LIST_KEY, search);
  }, [debouncedSearch, isRestoring, search, setStoreSearch]);

  // Restore from global store when returning from edit/view
  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") setSearch(stored.search);

    if (stored?.filters && typeof stored.filters === "object") {
      const raw = stored.filters as Record<string, unknown>;
      const restored = {
        ...DEFAULT_FILTERS,
        ...raw,
        journal_date_from: raw.journal_date_from
          ? new Date(String(raw.journal_date_from))
          : raw.journal_date
            ? new Date(String(raw.journal_date))
            : DEFAULT_FILTERS.journal_date_from,
        journal_date_to: raw.journal_date_to
          ? new Date(String(raw.journal_date_to))
          : raw.journal_date
            ? new Date(String(raw.journal_date))
            : DEFAULT_FILTERS.journal_date_to,
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;
  const index = pagination.pageIndex * pagination.pageSize;

  const handlePageSizeChange = (size: number) =>
    setPagination({ pageIndex: 0, pageSize: size });
  const handlePageChange = (page: number) =>
    setPagination((prev) => ({ ...prev, pageIndex: page - 1 }));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
  };

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildFiltersPayload = (
    filters: JVReversalFilters,
    searchValue: string,
  ) => {
    const cleaned: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      if (key === "journal_date_from") {
        cleaned.journal_date_from = dayjs(value as Date).format("YYYY-MM-DD");
      } else if (key === "journal_date_to") {
        cleaned.journal_date_to = dayjs(value as Date).format("YYYY-MM-DD");
      } else if (typeof value === "string" && value.trim() !== "") {
        cleaned[key] = value;
      }
    });

    if (searchValue?.trim()) cleaned.search = searchValue;
    return cleaned;
  };

  const {
    data = [],
    isLoading: isLoadingQuery,
    isFetching,
    error,
  } = useQuery({
    queryKey: [
      "journalVoucherReversalMaster",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<JVRecord[]> => {
      try {
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
        const payload =
          Object.keys(filtersPayload).length > 0
            ? { filters: filtersPayload }
            : { filters: {} };

        setIsInitialLoad(false);

        const response = await apiCallProtected.post(
          `${(URL as any).journalVoucherReversalFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );

        const raw = response as any;
        const bodyCandidate =
          raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate ?? null;

        if (!body) {
          setTotalRecords(0);
          return [];
        }

        const list = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body)
            ? body
            : [];
        const total = body?.total ?? body?.total_count ?? list.length;
        setTotalRecords(Number(total));
        return list;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) {
          setTotalRecords(0);
          return [];
        }
        throw err;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = isFetching || isLoadingQuery || isInitialLoad;
  const tableData = data ?? [];

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo<MRT_ColumnDef<JVRecord>[]>(
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
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.journal_date
              ? dayjs(row.original?.journal_date).format(dateFormat)
              : "-"}
          </Text>
        ),
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
                      onClick={() => {
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate(`/journal-voucher-reversal/edit/${row.original.id}`, {
                          state: { rowData: row.original },
                        });
                      }}
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
                    onClick={() => {
                      setStoreFilters(LIST_KEY, appliedFilters);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate(`/journal-voucher-reversal/view/${row.original.id}`, {
                        state: { rowData: row.original },
                      });
                    }}
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
                      onClick={() => {
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate("/journal-voucher-reversal/create", {
                          state: { reversalOf: row.original },
                        });
                      }}
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
    [navigate, index, appliedFilters, search, setStoreFilters, setStoreSearch, setShouldRestore],
  );

  // ─── Table ────────────────────────────────────────────────────────────────

  const table = useMantineReactTable({
    columns,
    data: tableData,
    state: { isLoading, pagination },
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
    manualPagination: true,
    rowCount: totalRecords,
    onPaginationChange: setPagination,
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
        color: "#334155",
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
        color: "#1E293B",
        backgroundColor: "#F8FAFC",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #F3F3F3",
        ...(column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              zIndex: 4,
              backgroundColor: "#F8FAFC",
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
            c="#1E293B"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Journal Voucher Reversal
          </Text>

          <Group gap="xs" wrap="nowrap">
            {/* Search */}
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
                  color: "#334155",
                  width: "248px",
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  "&:focus": { border: "1px solid #105476" },
                },
              }}
            />

            {/* Filter toggle */}
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

            {/* Keep the commented-out Create New button exactly as-is */}
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
            <Grid.Col span={3}>
              <FormTextInput
                label="Document No"
                placeholder="Type Document No"
                value={draftFilters.document_no}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    document_no: e.currentTarget.value,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <FormTextInput
                label="Account Name"
                placeholder="Type Account Name"
                value={draftFilters.account_name}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    account_name: e.currentTarget.value,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Journal Date From"
                placeholder="Select Date"
                value={draftFilters.journal_date_from}
                onChange={(date) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    journal_date_from: date,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Journal Date To"
                placeholder="Select Date"
                value={draftFilters.journal_date_to}
                onChange={(date) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    journal_date_to: date,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={["POSTED", "UNPOSTED"]}
                value={draftFilters.status}
                searchable
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    status: value || "",
                  }))
                }
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
                  color: "#1E293B",
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
                  "&:hover": { backgroundColor: "#0d4261" },
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
            <Text c="dimmed" style={{ fontFamily: "Inter" }}>
              Loading journal voucher reversals...
            </Text>
          </Stack>
        </Center>
      ) : error ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Text c="dimmed" style={{ fontFamily: "Inter" }}>
              Error loading journal voucher reversals. Please try refreshing the page.
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
            pageSizeOptions={["10", "25", "50"]}
          />
        </>
      )}
    </Card>
  );
}

export default JournalVoucherReversalMaster;
