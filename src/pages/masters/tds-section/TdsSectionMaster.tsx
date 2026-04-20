import { useMemo, useState, useEffect } from "react";
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
  Center,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
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
import { SearchableSelect } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";

const LIST_KEY = "TDS_SECTION_MASTER";

type TdsSectionRow = {
  sno?: number;
  id?: number;
  tds_section_code?: string;
  tds_section_name?: string;
  tds_section_rate?: string;
};

type TdsSectionFilters = {
  tds_section_code: string;
  tds_section_name: string;
  tds_section_rate: string;
};

export default function TdsSectionMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: TdsSectionFilters = {
    tds_section_code: "",
    tds_section_name: "",
    tds_section_rate: "",
  };

  const [draftFilters, setDraftFilters] =
    useState<TdsSectionFilters>(DEFAULT_FILTERS);

  const [appliedFilters, setAppliedFilters] =
    useState<TdsSectionFilters>(DEFAULT_FILTERS);

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

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }

    if (stored?.filters && typeof stored.filters === "object") {
      const restored = { ...DEFAULT_FILTERS, ...stored.filters };
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
    filters: TdsSectionFilters,
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
    data: tableRows = [],
    isLoading: listLoading,
    isFetching: listFetching,
    error: listError,
  } = useQuery({
    queryKey: [
      "tds-section-master",
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

        const payload =
          Object.keys(filtersPayload).length > 0 ? { filters: filtersPayload } : {};
        setIsInitialLoad(false);
        const response = await apiCallProtected.post(
          `${URL.tdsSectionMasterFilter}?&index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        setShowFilters(false);

        const data = response as {
          data?: TdsSectionRow[];
          total?: number;
        };
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total ?? data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching TDS section data:", error);
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

  const isLoading = listFetching || listLoading || isInitialLoad;
  const tableData = tableRows ?? [];

  const columns = useMemo<MRT_ColumnDef<TdsSectionRow>[]>(
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
        accessorKey: "tds_section_code",
        header: "TDS Section Code",
        size: 140,
      },
      {
        accessorKey: "tds_section_name",
        header: "TDS Section Name",
        size: 220,
      },
      // {
      //   accessorKey: "tds_section_rate",
      //   header: "Rate(%)",
      //   size: 100,
      // },
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
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/master/tds-section/edit", {
                      state: { ...row.original },
                    });
                  }}
                >
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#2563EB" }} />
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
    ],
    [
      navigate,
      appliedFilters,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
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
            c={"#444955"}
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            TDS Section Master List
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
                  color: "#333740",
                  minWidth: "24px",
                  minHeight: "24px",
                  width: "248px",
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  "&:focus": {
                    border: "1px solid #2563EB",
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
                    ? "1px solid #2563EB"
                    : "1px solid #737780",
                  color: showFilters ? "#2563EB" : "#737780",
                  "&:active": {
                    border: "1px solid #2563EB",
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
                  backgroundColor: "#2563EB",
                  borderRadius: "4px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontStyle: "semibold",
                  "&:hover": {
                    backgroundColor: "#2563EB",
                  },
                },
              }}
              onClick={() => {
                setStoreFilters(LIST_KEY, appliedFilters);
                setStoreSearch(LIST_KEY, search);
                setShouldRestore(LIST_KEY, true);
                navigate("/master/tds-section/create");
              }}
            >
              Create New
            </Button>
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
              backgroundColor: "#FAFAFA",
              padding: "4px 8px",
            }}
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
            <Grid.Col span={4}>
              <SearchableSelect
                apiEndpoint={URL.tdsSectionMaster}
                label="TDS Section Code"
                placeholder="Type TDS Section Code"
                value={draftFilters.tds_section_code}
                onChange={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    tds_section_code: val || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.tds_section_code ?? ""),
                  label: String(item.tds_section_code ?? ""),
                })}
                searchFields={["tds_section_code"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <SearchableSelect
                apiEndpoint={URL.tdsSectionMaster}
                label="TDS Section Name"
                placeholder="Type TDS Section Name"
                value={draftFilters.tds_section_name}
                onChange={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    tds_section_name: val || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.tds_section_name ?? ""),
                  label: String(item.tds_section_name ?? ""),
                })}
                searchFields={["tds_section_name"]}
                size="xs"
              />
            </Grid.Col>

            {/* <Grid.Col span={4}>
              <TextInput
                label="Rate(%)"
                placeholder="Type rate"
                size="xs"
                value={draftFilters.tds_section_rate}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    tds_section_rate: e.currentTarget.value,
                  }))
                }
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                  },
                  label: {
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#424242",
                    marginBottom: "4px",
                    fontFamily: "Inter",
                  },
                }}
              />
            </Grid.Col> */}
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
                  color: "#444955",
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
                  backgroundColor: "#2563EB",
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
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed">Loading TDS section data...</Text>
          </Stack>
        </Center>
      ) : listError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed">
              Error loading TDS section data. Please try refreshing the page.
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
