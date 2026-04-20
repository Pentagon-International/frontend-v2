import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
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
  Select,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilter,
  IconFilterOff,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { MantineReactTable, MRT_ColumnDef, useMantineReactTable } from "mantine-react-table";
import { SingleDateInput, ToastNotification } from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import dayjs from "dayjs";
import { URL } from "../../../api/serverUrls";

type DocumentAllocationListItem = {
  id: number;
  account_name?: string;
  account_code?: string;
  subledger_code?: string;
  allocation_no?: string;
  allocation_date?: string;
  document_status?: string;
};

type DocumentAllocationListResponse = {
  status?: boolean;
  message?: string;
  total?: number;
  index?: number;
  limit?: number | null;
  data?: DocumentAllocationListItem[];
};

type FilterState = {
  account_code: string | null;
  subledger_code: string | null;
  allocation_date: Date | null;
  document_status: string | null;
};

export default function DocumentAllocationList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [listTotalRecords, setListTotalRecords] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    account_code: null,
    subledger_code: null,
    allocation_date: null,
    document_status: null,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const buildFilterPayload = useMemo(() => {
    const payload: Record<string, string> = {};
    if (filters.account_code) payload.account_code = filters.account_code;
    if (filters.subledger_code) payload.subledger_code = filters.subledger_code;
    if (filters.allocation_date) {
      payload.allocation_date = dayjs(filters.allocation_date).format("YYYY-MM-DD");
    }
    if (filters.document_status) payload.document_status = filters.document_status;
    if (debouncedSearch.trim()) payload.search = debouncedSearch.trim();
    return payload;
  }, [filters, debouncedSearch]);

  const {
    data: listResult = { data: [], total: 0 },
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "documentAllocationList",
      listCurrentPage,
      listPageSize,
      buildFilterPayload,
      filtersApplied,
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const response = (await apiCallProtected.post(
          `${URL.outstandingAllocationDocumentsFilter}?index=${(listCurrentPage - 1) * listPageSize}&limit=${listPageSize}`,
          { filters: buildFilterPayload },
        )) as DocumentAllocationListResponse;
        const rows = Array.isArray(response?.data) ? response.data : [];
        const total = Number(response?.total ?? rows.length ?? 0);
        setListTotalRecords(total);
        return { data: rows, total };
      } catch (error) {
        console.error("Error fetching document allocation list:", error);
        setListTotalRecords(0);
        ToastNotification({
          type: "error",
          message: "Failed to fetch document allocation list",
        });
        return { data: [], total: 0 };
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    refetch();
  }, [listCurrentPage, listPageSize, filtersApplied, debouncedSearch, refetch]);

  const applyFilters = () => {
    setFiltersApplied(true);
    setListCurrentPage(1);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setFilters({
      account_code: null,
      subledger_code: null,
      allocation_date: null,
      document_status: null,
    });
    setSearchQuery("");
    setFiltersApplied(false);
    setListCurrentPage(1);
    setShowFilters(false);
  };

  const columns = useMemo<MRT_ColumnDef<DocumentAllocationListItem>[]>(
    () => [
      {
        accessorKey: "account_name",
        header: "Account Name",
      },
      {
        accessorKey: "subledger_code",
        header: "Subledger Code",
      },
      {
        accessorKey: "allocation_no",
        header: "Allocation No",
      },
      {
        accessorKey: "allocation_date",
        header: "Allocation Date",
      },
      {
        accessorKey: "document_status",
        header: "Document Status",
      },
      {
        id: "actions",
        header: "Action",
        Cell: ({ row }) => {
          const [menuOpened, setMenuOpened] = useState(false);
          const rowData = row.original;
          const statusUpper = String(rowData.document_status ?? "").toUpperCase();
          const isUnposted = statusUpper === "UNPOSTED";

          const goToDocumentAllocation = (mode: "view" | "edit") => {
            navigate("/document-allocation/create", {
              state: {
                allocationDocument: rowData,
                allocationMode: mode,
              },
            });
          };

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
                      goToDocumentAllocation("view");
                    }}
                  >
                    <Group gap="sm">
                      <IconEye size={16} style={{ color: "#2563EB" }} />
                      <Text size="sm">View</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                {isUnposted ? (
                  <>
                    <Menu.Divider />
                    <Box px={10} py={5}>
                      <UnstyledButton
                        onClick={() => {
                          setMenuOpened(false);
                          goToDocumentAllocation("edit");
                        }}
                      >
                        <Group gap="sm">
                          <IconEdit size={16} style={{ color: "#2563EB" }} />
                          <Text size="sm">Edit</Text>
                        </Group>
                      </UnstyledButton>
                    </Box>
                  </>
                ) : null}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [navigate],
  );

  const table = useMantineReactTable({
    columns,
    data: listResult?.data || [],
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    state: {
      isLoading: isFetching,
      showProgressBars: isFetching,
    },
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
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "30px",
          zIndex: 2,
          borderLeft: "1px solid #F3F3F3",
          boxShadow: "1px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontstyle: "regular",
          fontFamily: "Inter",
          color: "#333740",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "80px",
          zIndex: 2,
          backgroundColor: "#FBFBFB",
          boxShadow: "0px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          fontstyle: "bold",
          color: "#444955",
          backgroundColor: "#FBFBFB",
          top: 0,
          zIndex: 3,
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
    <Card shadow="sm" pt="md" pb="sm" px="lg" radius="md" withBorder style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", flex: 1 }}>
      <Box>
        <Group justify="space-between" align="center" mb="md">
          <Text size="md" fw={600} c="#444955" style={{ fontFamily: "Inter", fontSize: "16px" }}>
            Document Allocation Lists
          </Text>

          <Group gap="xs" wrap="nowrap">
            <TextInput
              placeholder="Search..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                searchQuery ? (
                  <ActionIcon variant="transparent" size="sm" onClick={() => setSearchQuery("")}>
                    <IconX size={16} />
                  </ActionIcon>
                ) : null
              }
              w={248}
              size="sm"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.currentTarget.value);
                setListCurrentPage(1);
              }}
            />
            <ActionIcon
              variant={showFilters ? "filled" : "outline"}
              size={36}
              color={showFilters ? "#E0F5FF" : "gray"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <IconFilter size={18} />
            </ActionIcon>
            <Button
              variant="filled"
              leftSection={<IconPlus size={14} />}
              size="sm"
              color="#2563EB"
              onClick={() => navigate("/document-allocation/create")}
            >
              Create
            </Button>
          </Group>
        </Group>
      </Box>

      {showFilters && (
        <Box mb="xs" style={{ borderRadius: "8px", border: "1px solid #E0E0E0", flexShrink: 0, height: "fit-content" }}>
          <Group justify="space-between" align="center" style={{ backgroundColor: "#FAFAFA", padding: "8px 8px", borderRadius: "8px" }}>
            <Text size="sm" fw={600} c="#000000" style={{ fontFamily: "Inter", fontSize: "14px" }}>
              Filters
            </Text>
          </Group>

          <Grid gutter="md" px="md">
            <Grid.Col span={3}>
              <TextInput
                label="Account Code"
                placeholder="Enter account code"
                size="xs"
                value={filters.account_code || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, account_code: e.currentTarget.value || null }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <TextInput
                label="Subledger Code"
                placeholder="Enter subledger code"
                size="xs"
                value={filters.subledger_code || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, subledger_code: e.currentTarget.value || null }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Allocation Date"
                placeholder="YYYY-MM-DD"
                size="xs"
                value={filters.allocation_date}
                onChange={(date) => setFilters((prev) => ({ ...prev, allocation_date: date }))}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                label="Document Status"
                placeholder="Select status"
                searchable
                clearable
                size="xs"
                data={[
                  { value: "POSTED", label: "POSTED" },
                  { value: "DRAFT", label: "DRAFT" },
                ]}
                value={filters.document_status}
                onChange={(value) => setFilters((prev) => ({ ...prev, document_status: value || null }))}
              />
            </Grid.Col>
          </Grid>

          <Group justify="end" mt="sm" p="sm" pb="md">
            <Button size="sm" variant="outline" color="#2563EB" leftSection={<IconFilterOff size={16} />} onClick={clearAllFilters}>
              Clear Filters
            </Button>
            <Button size="sm" variant="filled" color="#2563EB" leftSection={<IconFilter size={16} />} onClick={applyFilters}>
              Apply Filters
            </Button>
          </Group>
        </Box>
      )}

      {isFetching ? (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed">Loading document allocations...</Text>
          </Stack>
        </Center>
      ) : (
        <>
          <Box style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
            <MantineReactTable table={table} />
          </Box>
          <Group w="100%" justify="space-between" align="center" p="xs" wrap="nowrap" pt="md">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <PaginationBar
                pageSize={listPageSize}
                currentPage={listCurrentPage}
                totalRecords={listTotalRecords}
                onPageSizeChange={(size) => {
                  setListPageSize(size);
                  setListCurrentPage(1);
                }}
                onPageChange={setListCurrentPage}
              />
            </Box>
          </Group>
        </>
      )}
    </Card>
  );
}
