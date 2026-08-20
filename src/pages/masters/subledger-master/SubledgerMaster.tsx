import { useCallback, useMemo, useState, useEffect } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from "mantine-react-table";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Text,
  UnstyledButton,
  Center,
  Loader,
  Stack,
  TextInput,
  Grid,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import { useIsAdminUser } from "../../../hooks/useIsAdminUser";
import { ERPListColumnHeaderFilter } from "../../../components";
import type { ErpListTheme } from "../../../components";

const LIST_KEY = "SUBLEDGER_MASTER";
const TABLE_HEADER_HEIGHT = "42.4px";

type SubledgerMasterRow = {
  sno?: number;
  id?: number;
  account_name?: string;
  sl_code?: string;
  account_code?: string;
  branch_code?: string;
  company_code?: string;
};

type SubledgerMasterFilters = {
  account_name: string;
  sl_code: string;
  account_code: string;
  branch_code: string;
  company_code: string;
};

const DEFAULT_FILTERS: SubledgerMasterFilters = {
  account_name: "",
  sl_code: "",
  account_code: "",
  branch_code: "",
  company_code: "",
};

export default function SubledgerMasterList() {
  const isAdmin = useIsAdminUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [draftFilters, setDraftFilters] =
    useState<SubledgerMasterFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<SubledgerMasterFilters>(DEFAULT_FILTERS);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const erpTheme = useMemo<ErpListTheme>(
    () => ({
      border: "#e2e8f0",
      muted: "#64748b",
      fg: "#0f172a",
      primary: "#105476",
      headerBg: "#f8fafc",
      pageBg: "#F0F4F8",
      cardBg: "#ffffff",
      fontSans: "'Geist', sans-serif",
    }),
    [],
  );

  const openHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId(id);
  }, []);

  const collapseHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId((cur) => (cur === id ? null : cur));
  }, []);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") setSearch(stored.search);

    if (stored?.filters && typeof stored.filters === "object") {
      const f = stored.filters as SubledgerMasterFilters;
      const restored = { ...DEFAULT_FILTERS, ...f };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);

    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({
      pageIndex: 0,
      pageSize: newPageSize,
    });
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: newPage - 1,
    }));
  };

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
    filters: SubledgerMasterFilters,
    searchValue: string,
  ) => {
    const cleaned = Object.entries(filters).reduce(
      (acc, [key, value]) => {
        if (value && value.trim() !== "") acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  const {
    data: subledgerData = [],
    isLoading: subledgerLoading,
    isFetching: subledgerFetching,
    error: subledgerError,
  } = useQuery({
    queryKey: [
      "subledger-master",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;
        const filtersPayload = buildFiltersPayload(
          appliedFilters,
          debouncedSearch,
        );
        setIsInitialLoad(false);
        const response = await apiCallProtected.post(
          `${URL.subledgerEnquiryMasterFilter}?index=${index}&limit=${pagination.pageSize}`,
          {
            filters: filtersPayload,
            ordering: "-created_at",
          },
        );
        setShowFilters(false);

        const data = response as { data?: unknown[]; total?: number };
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching subledger master data:", error);
        setShowFilters(false);
        setTotalRecords(0);
        throw error;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = subledgerFetching || subledgerLoading || isInitialLoad;
  const tableData = subledgerData ?? [];

  const persistListAndGo = useCallback(
    (path: string, state?: unknown) => {
      setStoreFilters(LIST_KEY, appliedFilters);
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);
      navigate(path, state != null ? { state } : undefined);
    },
    [
      appliedFilters,
      navigate,
      search,
      setShouldRestore,
      setStoreFilters,
      setStoreSearch,
    ],
  );

  const commitHeaderFilters = useCallback(
    (updater: (prev: SubledgerMasterFilters) => SubledgerMasterFilters) => {
      setDraftFilters((prev) => {
        const next = updater(prev);
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, next);
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setStoreFilters],
  );

  const columns = useMemo<MRT_ColumnDef<SubledgerMasterRow>[]>(
    () => {
      const textHeader = (
        id: keyof SubledgerMasterFilters,
        label: string,
        placeholder: string,
      ) => (
        <ERPListColumnHeaderFilter
          label={label}
          value={appliedFilters[id]}
          displayValue={appliedFilters[id]}
          theme={erpTheme}
          placeholder={placeholder}
          isEditing={editingHeaderId === id}
          onStartEdit={() => openHeaderEditor(id)}
          onStopEdit={() => collapseHeaderEditor(id)}
          onChange={(next) =>
            commitHeaderFilters((prev) => ({ ...prev, [id]: next }))
          }
        />
      );

      return [
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
        accessorKey: "account_name",
        header: "Account Name",
        size: 200,
        Header: () =>
          textHeader("account_name", "Account Name", "Filter account name"),
      },
      {
        accessorKey: "sl_code",
        header: "SL Code",
        size: 140,
        Header: () => textHeader("sl_code", "SL Code", "Filter SL code"),
      },
      {
        accessorKey: "account_code",
        header: "Account Code",
        size: 160,
        Header: () =>
          textHeader("account_code", "Account Code", "Filter account code"),
      },
      {
        accessorKey: "branch_code",
        header: "Branch Code",
        size: 120,
        Header: () =>
          textHeader("branch_code", "Branch Code", "Filter branch code"),
      },
      {
        accessorKey: "company_code",
        header: "Company Code",
        size: 140,
        Header: () =>
          textHeader("company_code", "Company Code", "Filter company code"),
      },
      {
        id: "actions",
        header: "Actions",
        size: 70,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius={"md"}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    persistListAndGo("/master/subledger-master/edit", {
                      ...row.original,
                    })
                  }
                >
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>
                      Edit
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ];
    },
    [
      appliedFilters,
      collapseHeaderEditor,
      commitHeaderFilters,
      editingHeaderId,
      erpTheme,
      openHeaderEditor,
      persistListAndGo,
    ],
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
      pagination: { pageSize: 25, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: totalRecords,
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
          color: "#334155",
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
          backgroundColor: "#F8FAFC",
          boxShadow: "0px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "6px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          fontstyle: "bold",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #F3F3F3",
          minHeight: TABLE_HEADER_HEIGHT,
          height: TABLE_HEADER_HEIGHT,
          boxSizing: "border-box",
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

  const filterField = (
    key: keyof SubledgerMasterFilters,
    label: string,
    placeholder: string,
  ) => (
    <Grid.Col span={2.4}>
      <TextInput
        size="xs"
        label={label}
        placeholder={placeholder}
        value={draftFilters[key]}
        onChange={(e) =>
          setDraftFilters((prev) => ({
            ...prev,
            [key]: e.currentTarget.value,
          }))
        }
        rightSection={
          draftFilters[key] ? (
            <ActionIcon
              variant="transparent"
              size="sm"
              onClick={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  [key]: "",
                }))
              }
              aria-label={`Clear ${label}`}
              style={{ cursor: "pointer" }}
            >
              <IconX size={14} />
            </ActionIcon>
          ) : null
        }
        styles={{
          label: {
            fontSize: "13px",
            fontWeight: 500,
            color: "#495057",
            marginBottom: "6px",
            fontFamily: "Inter",
          },
          input: {
            fontSize: "13px",
            height: "36px",
            fontFamily: "Inter",
          },
        }}
      />
    </Grid.Col>
  );

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
            c={"#1E293B"}
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Subledger Master List
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
                    onClick={() => {
                      setSearch("");
                    }}
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
            {isAdmin && (
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
                onClick={() => persistListAndGo("/master/subledger-master/create")}
              >
                Create New
              </Button>
            )}
          </Group>
        </Group>
      </Box>

      {showFilters && (
        <Box
          tt="capitalize"
          mb="sm"
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
              borderRadius: "8px 8px 0 0",
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
            {filterField("account_name", "Account Name", "Type Account Name")}
            {filterField("sl_code", "SL Code", "Type SL Code")}
            {filterField("account_code", "Account Code", "Type Account Code")}
            {filterField("branch_code", "Branch Code", "Type Branch Code")}
            {filterField("company_code", "Company Code", "Type Company Code")}
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
            <Text c="dimmed">Loading Subledger Master data...</Text>
          </Stack>
        </Center>
      ) : subledgerError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Text c="dimmed">
              Error loading subledger master data. Please try refreshing the
              page.
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
