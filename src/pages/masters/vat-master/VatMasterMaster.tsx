import { useMemo, useState, useEffect } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
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
import { Dropdown, SearchableSelect } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";
import { useIsAdminUser } from "../../../hooks/useIsAdminUser";
import useAuthStore from "../../../store/authStore";
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";

const LIST_KEY = "VAT_MASTER";

type VatMasterRow = {
  id?: number;
  sno?: number;
  vat_code?: string;
  vat_name?: string;
  percentage?: string | number;
  status?: "ACTIVE" | "INACTIVE";
};

type VatMasterFilters = {
  id: string;
  vat_code: string;
  vat_name: string;
  percentage: string;
  status: string;
};

export default function VatMasterList() {
  const isAdmin = useIsAdminUser();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);

  useEffect(() => {
    if (isIndiaUser) {
      navigate("/master", { replace: true });
    }
  }, [isIndiaUser, navigate]);

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: VatMasterFilters = {
    id: "",
    vat_code: "",
    vat_name: "",
    percentage: "",
    status: "",
  };

  const [draftFilters, setDraftFilters] =
    useState<VatMasterFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<VatMasterFilters>(DEFAULT_FILTERS);
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
      const restored = {
        ...DEFAULT_FILTERS,
        ...stored.filters,
      } as VatMasterFilters;
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;
  const statusOptions = ["ACTIVE", "INACTIVE"];

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));
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
    filters: VatMasterFilters,
    searchValue: string,
  ) => {
    const cleaned: Record<string, string | number> = {};
    if (filters.id?.trim()) cleaned.id = Number(filters.id);
    if (filters.vat_code?.trim()) cleaned.vat_code = filters.vat_code.trim();
    if (filters.vat_name?.trim()) cleaned.vat_name = filters.vat_name.trim();
    if (filters.percentage?.trim())
      cleaned.percentage = filters.percentage.trim();
    if (filters.status?.trim()) cleaned.status = filters.status;
    if (searchValue?.trim()) cleaned.search = searchValue.trim();
    return Object.keys(cleaned).length > 0 ? { filters: cleaned } : {};
  };

  const {
    data: vatMasterData = [],
    isLoading: vatMasterLoading,
    isFetching: vatMasterFetching,
    error: vatMasterError,
  } = useQuery({
    queryKey: [
      "vat-master",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;
        const payload = buildFiltersPayload(appliedFilters, debouncedSearch);

        const response = await apiCallProtected.post(
          `${URL.vatMasterFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        setIsInitialLoad(false);
        setShowFilters(false);

        const data = response as { data?: VatMasterRow[]; total?: number };
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching VAT Master data:", error);
        setShowFilters(false);
        setTotalRecords(0);
        throw error;
      }
    },
    enabled: !isRestoring && !isIndiaUser && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = vatMasterFetching || vatMasterLoading || isInitialLoad;
  const tableData = vatMasterData ?? [];

  const columns = useMemo<MRT_ColumnDef<VatMasterRow>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        enableColumnFilter: false,
        enableSorting: false,
      },
      { accessorKey: "vat_code", header: "VAT Code", minSize: 100 },
      { accessorKey: "vat_name", header: "VAT Name", minSize: 180 },
      {
        accessorKey: "percentage",
        header: "Percentage (%)",
        size: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | number>();
          return value != null && value !== "" ? `${value}%` : "-";
        },
      },
      // {
      //   accessorKey: "status",
      //   header: "Status",
      //   size: 80,
      //   Cell: ({ cell }) => {
      //     const value = cell.getValue<"ACTIVE" | "INACTIVE">();
      //     return (
      //       <Badge
      //         color={value === "ACTIVE" ? "green" : "red"}
      //         variant="light"
      //         size="sm"
      //         radius="sm"
      //         px={8}
      //       >
      //         {value}
      //       </Badge>
      //     );
      //   },
      // },
      {
        id: "actions",
        header: "Actions",
        size: 50,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-start" shadow="sm" radius="md">
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
                    navigate("/master/vat-master/edit", {
                      state: row.original,
                    });
                  }}
                >
                  <Group gap="sm">
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
    state: { pagination },
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
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
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
        overflow: "auto",
      },
    },
  });

  if (isIndiaUser) {
    return null;
  }

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
            VAT Master
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
                  color: "#334155",
                  width: "248px",
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  "&:focus": { border: "1px solid #105476" },
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
                    "&:hover": { backgroundColor: "#105476" },
                  },
                }}
                onClick={() => {
                  setStoreFilters(LIST_KEY, appliedFilters);
                  setStoreSearch(LIST_KEY, search);
                  setShouldRestore(LIST_KEY, true);
                  navigate("/master/vat-master/create");
                }}
              >
                Create New
              </Button>
            )}
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
          }}
        >
          <Group
            justify="space-between"
            align="center"
            mb="sm"
            px="md"
            style={{ backgroundColor: "#F8FAFC", padding: "4px 8px" }}
          >
            <Text
              size="sm"
              fw={600}
              c="#1E293B"
              style={{ fontFamily: "Inter" }}
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
            {/* <Grid.Col span={2.4}>
              <TextInput
                label="ID"
                placeholder="Enter ID"
                size="xs"
                value={draftFilters.id}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    id: e.currentTarget.value,
                  }))
                }
                styles={{
                  label: {
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#424242",
                    marginBottom: 4,
                  },
                  input: { fontSize: "13px" },
                }}
              />
            </Grid.Col> */}

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.vatMaster}
                label="VAT Code"
                placeholder="Search VAT code..."
                value={draftFilters.vat_code}
                onChange={(val) =>
                  setDraftFilters((prev) => ({ ...prev, vat_code: val || "" }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.vat_code ?? ""),
                  label: String(item.vat_code ?? ""),
                })}
                searchFields={["vat_code", "vat_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.vatMaster}
                label="VAT Name"
                placeholder="Search VAT name..."
                value={draftFilters.vat_name}
                onChange={(val) =>
                  setDraftFilters((prev) => ({ ...prev, vat_name: val || "" }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.vat_name ?? ""),
                  label: String(item.vat_name ?? ""),
                })}
                searchFields={["vat_code", "vat_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <TextInput
                label="Percentage"
                placeholder="e.g. 5.00"
                size="xs"
                value={draftFilters.percentage}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    percentage: e.currentTarget.value,
                  }))
                }
                styles={{
                  label: {
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#424242",
                    marginBottom: 4,
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

            {/* <Grid.Col span={2.4}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={statusOptions}
                searchable
                value={draftFilters.status || null}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    status: value || "",
                  }))
                }
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

      {isLoading ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">Loading VAT Master data...</Text>
          </Stack>
        </Center>
      ) : vatMasterError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Text c="dimmed">
            Error loading VAT Master data. Please try refreshing the page.
          </Text>
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
