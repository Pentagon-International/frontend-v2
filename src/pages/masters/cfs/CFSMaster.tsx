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
import { apiCallProtected } from "../../../api/axios";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { Dropdown, SearchableSelect } from "../../../components";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";

const LIST_KEY = "CFS_MASTER";

type CFSMasterRow = {
  sno?: number;
  id?: number;
  cfs_name?: string;
  port_id?: number;
  port_name?: string;
  address?: string;
  city_id?: number;
  city_name?: string;
  state_id?: number;
  state_name?: string;
  country_id?: number;
  country_name?: string;
  phone?: string;
  status?: "ACTIVE" | "INACTIVE";
};

type CFSFilters = {
  cfs_name: string;
  port_id: string;
  port_name: string;
  city_id: string;
  city_name: string;
  state_id: string;
  state_name: string;
  country_id: string;
  country_code: string;
  country_name: string;
  address: string;
  phone: string;
  status: string;
};

export default function CFSMasterList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: CFSFilters = {
    cfs_name: "",
    port_id: "",
    port_name: "",
    city_id: "",
    city_name: "",
    state_id: "",
    state_name: "",
    country_id: "",
    country_code: "",
    country_name: "",
    address: "",
    phone: "",
    status: "",
  };

  const [draftFilters, setDraftFilters] = useState<CFSFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<CFSFilters>(DEFAULT_FILTERS);
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

  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") setSearch(stored.search);
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
    filters: CFSFilters,
    searchValue: string,
  ): Record<string, string | number> => {
    const cleaned: Record<string, string | number> = {};
    const idKeys = ["port_id", "city_id", "state_id", "country_id"] as const;
    idKeys.forEach((key) => {
      const raw = filters[key];
      if (raw && raw.trim() !== "") {
        const num = parseInt(raw, 10);
        if (!Number.isNaN(num)) cleaned[key] = num;
      }
    });
    if (filters.cfs_name?.trim()) cleaned.cfs_name = filters.cfs_name.trim();
    if (filters.address?.trim()) cleaned.address = filters.address.trim();
    if (filters.phone?.trim()) cleaned.phone = filters.phone.trim();
    if (filters.status?.trim()) cleaned.status = filters.status.trim();
    if (searchValue?.trim()) cleaned.search = searchValue.trim();
    return cleaned;
  };

  const {
    data: cfsData = [],
    isLoading: cfsLoading,
    isFetching: cfsFetching,
    error: cfsError,
  } = useQuery({
    queryKey: [
      "cfs-master",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
        const payload: { filters?: Record<string, string>; ordering?: string } =
          Object.keys(filtersPayload).length > 0
            ? { filters: filtersPayload, ordering: "-created_at" }
            : { ordering: "-created_at" };

        setIsInitialLoad(false);
        const response = await apiCallProtected.post(
          `${URL.cfsMasterFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        setShowFilters(false);

        const data = response as { data?: CFSMasterRow[]; total?: number };
        if (data?.data && Array.isArray(data.data)) {
          setTotalRecords(data.total ?? data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching CFS data:", error);
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

  const isLoading = cfsFetching || cfsLoading || isInitialLoad;
  const tableData = cfsData ?? [];

  const columns = useMemo<MRT_ColumnDef<CFSMasterRow>[]>(
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
      { accessorKey: "cfs_name", header: "CFS Name", size: 140 },
      { accessorKey: "port_name", header: "Port Name", size: 120 },
      { accessorKey: "address", header: "Address", size: 180 },
      { accessorKey: "city_name", header: "City Name", size: 120 },
      { accessorKey: "state_name", header: "State Name", size: 120 },
      { accessorKey: "country_name", header: "Country Name", size: 120 },
      { accessorKey: "phone", header: "Phone No", size: 110 },
      {
        accessorKey: "status",
        header: "Status",
        size: 90,
        Cell: ({ cell }) => {
          const value = cell.getValue<"ACTIVE" | "INACTIVE">();
          return (
            <Badge
              color={value === "ACTIVE" ? "green" : "red"}
              variant="light"
              size="sm"
              radius="sm"
              px={8}
            >
              {value}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 70,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
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
                    navigate("/master/cfs-master/edit", { state: { ...row.original } });
                  }}
                >
                  <Group gap="sm">
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
    [navigate, appliedFilters, search, setStoreFilters, setStoreSearch, setShouldRestore],
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
      let extraStyles: Record<string, unknown> = {};
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
          fontFamily: "Inter",
          color: "#333740",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles: Record<string, unknown> = {};
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
            c="#444955"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            CFS Master List
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
                  "&:focus": { border: "1px solid #2563EB" },
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
                  border: showFilters ? "1px solid #2563EB" : "1px solid #737780",
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
                  "&:hover": { backgroundColor: "#2563EB" },
                },
              }}
              onClick={() => {
                setStoreFilters(LIST_KEY, appliedFilters);
                setStoreSearch(LIST_KEY, search);
                setShouldRestore(LIST_KEY, true);
                navigate("/master/cfs-master/create");
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
            <Grid.Col span={2.4}>
              <FormTextInput
                size="xs"
                label="CFS Name"
                placeholder="CFS Name"
                value={draftFilters.cfs_name}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, cfs_name: e.currentTarget.value }))
                }
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.portMaster}
                label="Port Name"
                placeholder="Type port name"
                value={draftFilters.port_id}
                displayValue={draftFilters.port_name || undefined}
                onChange={(val, selectedData) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    port_id: val || "",
                    port_name: selectedData?.label ?? "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String((item as { id?: number }).id ?? ""),
                  label: `${item.port_name} (${item.port_code})`,
                })}
                searchFields={["port_name", "port_code"]}
                additionalParams={seaTransportParams}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.country}
                label="Country Name"
                placeholder="Type country name"
                value={draftFilters.country_id}
                displayValue={draftFilters.country_name || undefined}
                returnOriginalData
                onChange={(val, selectedData, originalData) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    country_id: val || "",
                    country_name: selectedData?.label ?? "",
                    country_code: (originalData as { country_code?: string } | null)?.country_code ?? "",
                    state_id: "",
                    state_name: "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String((item as { id?: number }).id ?? ""),
                  label: String((item as { country_name?: string }).country_name ?? ""),
                })}
                searchFields={["country_name"]}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.state}
                label="State Name"
                placeholder="Type state name"
                value={draftFilters.state_id}
                displayValue={draftFilters.state_name || undefined}
                disabled={!draftFilters.country_code}
                additionalParams={
                  draftFilters.country_code
                    ? { country_code: draftFilters.country_code }
                    : undefined
                }
                onChange={(val, selectedData) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    state_id: val || "",
                    state_name: selectedData?.label ?? "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String((item as { id?: number }).id ?? ""),
                  label: String((item as { state_name?: string }).state_name ?? ""),
                })}
                searchFields={["state_name"]}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.city}
                label="City Name"
                placeholder="Type city name"
                value={draftFilters.city_id}
                displayValue={draftFilters.city_name || undefined}
                onChange={(val, selectedData) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    city_id: val || "",
                    city_name: selectedData?.label ?? "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String((item as { id?: number }).id ?? ""),
                  label: String((item as { city_name?: string }).city_name ?? ""),
                })}
                searchFields={["city_name"]}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <FormTextInput
                size="xs"
                label="Address"
                placeholder="Address"
                value={draftFilters.address}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, address: e.currentTarget.value }))
                }
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <FormTextInput
                size="xs"
                label="Phone"
                placeholder="Phone"
                value={draftFilters.phone}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, phone: e.currentTarget.value }))
                }
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={statusOptions}
                searchable
                value={draftFilters.status || null}
                onChange={(value) =>
                  setDraftFilters((prev) => ({ ...prev, status: value || "" }))
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
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed">Loading CFS data...</Text>
          </Stack>
        </Center>
      ) : cfsError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed">
              Error loading CFS data. Please try refreshing the page.
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
            pageSizeOptions={["1", "25", "50"]}
          />
        </>
      )}
    </Card>
  );
}
