import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ActionIcon,
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
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilter,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { SingleDateInput, Dropdown } from "../../../components";
import { apiCallProtected } from "../../../api/axios";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  MantineReactTable,
  type MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";

type NoteRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  note_no?: string;
  note_type?: string;
  document_date?: string;
  party_name?: string;
  status?: string;
  currency?: string;
  amount?: number | string;
  [key: string]: unknown;
};

type NoteFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  data?: NoteRow[];
};

type Filters = {
  note_type: "" | "DEBIT" | "CREDIT";
  status: "" | "POSTED" | "UNPOSTED";
  date_from: Date | null;
  date_to: Date | null;
  party_name: string;
};

export default function DebitCreditNoteNonTradeMaster() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [paginationPageSize, setPaginationPageSize] = useState(25);
  const [paginationCurrentPage, setPaginationCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const [draftFilters, setDraftFilters] = useState<Filters>({
    note_type: "",
    status: "",
    date_from: dayjs().startOf("month").toDate(),
    date_to: dayjs().toDate(),
    party_name: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>(draftFilters);

  const index = (paginationCurrentPage - 1) * paginationPageSize;
  const buildFiltersPayload = useMemo(() => {
    const payload: Record<string, string> = {};
    if (appliedFilters.note_type) payload.note_type = appliedFilters.note_type;
    if (appliedFilters.status) payload.status = appliedFilters.status;
    if (appliedFilters.party_name.trim())
      payload.party_name = appliedFilters.party_name.trim();
    if (appliedFilters.date_from)
      payload.date_from = dayjs(appliedFilters.date_from).format("YYYY-MM-DD");
    if (appliedFilters.date_to)
      payload.date_to = dayjs(appliedFilters.date_to).format("YYYY-MM-DD");
    if (debouncedSearch.trim()) payload.search = debouncedSearch.trim();
    return payload;
  }, [appliedFilters, debouncedSearch]);

  const {
    data: listData = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "debitCreditNoteNonTradeList",
      paginationCurrentPage,
      paginationPageSize,
      JSON.stringify(buildFiltersPayload),
    ],
    queryFn: async (): Promise<NoteRow[]> => {
      const payload =
        Object.keys(buildFiltersPayload).length > 0
          ? { filters: buildFiltersPayload }
          : { filters: {} };
      const res = (await apiCallProtected.post(
        `${URL.debitCreditNoteFilter}?index=${index}&limit=${paginationPageSize}`,
        payload,
      )) as NoteFilterResponse;

      const rows = Array.isArray(res?.data) ? res.data : [];
      const total = res?.total != null ? Number(res.total) : rows.length;
      setTotalRecords(total);
      return rows;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (paginationCurrentPage !== 1 && index >= totalRecords && totalRecords > 0) {
      setPaginationCurrentPage(1);
    }
  }, [index, paginationCurrentPage, totalRecords]);

  const columns = useMemo<MRT_ColumnDef<NoteRow>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => row.original?.sno ?? index + row.index + 1,
      },
      { accessorKey: "document_no", header: "Document No", size: 160 },
      {
        accessorKey: "document_type",
        header: "Document Type",
        size: 120,
        Cell: ({ cell }) => {
          const v = cell.getValue<unknown>();
          return (
            <Text size="sm">{v == null ? "-" : String(v).toUpperCase()}</Text>
          );
        },
      },
      { accessorKey: "document_date", header: "Document Date", size: 140 },
      { accessorKey: "party_name", header: "Party Name", size: 200 },
      { accessorKey: "status", header: "Status", size: 120 },
      {
        id: "amount",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) => {
          const row = cell.row.original as NoteRow;
          const details = (row?.details as Array<Record<string, unknown>> | undefined) ?? [];
          const v = details?.[0]?.amount;
          if (v == null) return <Text size="sm">-</Text>;
          const num = typeof v === "number" ? v : Number(v);
          return (
            <Text size="sm">{Number.isFinite(num) ? num.toFixed(2) : String(v)}</Text>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => {
          const statusUpper = String(row.original?.status ?? "").toUpperCase();
          const isUnposted = statusUpper === "UNPOSTED";
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
                    onClick={() =>
                      navigate("/debit-credit-note-non-trade/create", {
                        state: { mode: "view", data: row.original },
                      })
                    }
                  >
                    <Group gap="sm">
                      <IconEye size={16} style={{ color: "#105476" }} />
                      <Text size="sm">View</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                {isUnposted && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/debit-credit-note-non-trade/create", {
                          state: { mode: "edit", data: row.original },
                        })
                      }
                    >
                      <Group gap="sm">
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text size="sm">Edit</Text>
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
    data: listData ?? [],
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    layoutMode: "grid",
    manualPagination: true,
    rowCount: totalRecords,
    state: {
      isLoading: isLoading || isFetching,
      showProgressBars: isFetching,
    },
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    enableRowNumbers: false,
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
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
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
          color: "#333740",
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
              backgroundColor: "#FBFBFB",
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#444955",
          backgroundColor: "#FBFBFB",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #F3F3F3",
          ...extraStyles,
        },
      };
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                No records to display
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPaginationCurrentPage(1);
    setShowFilters(false);
  };

  const clearFilters = () => {
    const reset: Filters = {
      note_type: "",
      status: "",
      date_from: dayjs().startOf("month").toDate(),
      date_to: dayjs().toDate(),
      party_name: "",
    };
    setDraftFilters(reset);
    setAppliedFilters(reset);
    setSearch("");
    setPaginationCurrentPage(1);
    setShowFilters(false);
  };

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
      <Box mb="md">
        <Group justify="space-between" align="center">
          <Text
            size="md"
            fw={600}
            c="#444955"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Debit/Credit Note for Non Trade
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
                  color: "#333740",
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
              aria-label="Toggle filters"
              styles={{
                root: {
                  borderRadius: "4px",
                  backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                  border: showFilters ? "1px solid #105476" : "1px solid #737780",
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
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              styles={{
                root: {
                  backgroundColor: "#105476",
                  borderRadius: "4px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  "&:hover": {
                    backgroundColor: "#105476",
                  },
                },
              }}
              onClick={() => navigate("/debit-credit-note-non-trade/create")}
            >
              Create New
            </Button>
          </Group>
        </Group>
      </Box>

      {showFilters && (
        <Box
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
            style={{ backgroundColor: "#FAFAFA", padding: "4px 8px" }}
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
              <Dropdown
                size="xs"
                label="Type"
                placeholder="Select type"
                data={["DEBIT", "CREDIT"]}
                searchable
                value={draftFilters.note_type || null}
                onChange={(value) =>
                  setDraftFilters((p) => ({
                    ...p,
                    note_type: (value as Filters["note_type"]) || "",
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select status"
                data={["POSTED", "UNPOSTED"]}
                searchable
                value={draftFilters.status || null}
                onChange={(value) =>
                  setDraftFilters((p) => ({
                    ...p,
                    status: (value as Filters["status"]) || "",
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Date From"
                placeholder="Select Date"
                value={draftFilters.date_from}
                onChange={(d) => setDraftFilters((p) => ({ ...p, date_from: d }))}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Date To"
                placeholder="Select Date"
                value={draftFilters.date_to}
                onChange={(d) => setDraftFilters((p) => ({ ...p, date_to: d }))}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                size="xs"
                label="Party Name"
                placeholder="Type party name"
                value={draftFilters.party_name}
                onChange={(e) =>
                  setDraftFilters((p) => ({ ...p, party_name: e.currentTarget.value }))
                }
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
                  color: "#444955",
                },
              }}
            >
              Clear Filters
            </Button>
            <Button
              size="sm"
              onClick={applyFilters}
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

      {isLoading ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
              Loading records...
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack style={{ flex: 1, minHeight: 0 }} gap="xs">
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
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
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
                    Refreshing data...
                  </Text>
                </Stack>
              </div>
            )}
            <MantineReactTable table={table} />
          </div>
          <PaginationBar
            pageSize={paginationPageSize}
            currentPage={paginationCurrentPage}
            totalRecords={totalRecords}
            onPageSizeChange={(size) => {
              setPaginationPageSize(size);
              setPaginationCurrentPage(1);
            }}
            onPageChange={setPaginationCurrentPage}
            pageSizeOptions={["10", "25", "50"]}
          />
        </Stack>
      )}
    </Card>
  );
}

