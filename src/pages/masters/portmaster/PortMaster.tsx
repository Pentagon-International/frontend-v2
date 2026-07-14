import { useCallback, useEffect, useMemo, useState } from "react";
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
  Center,
  Grid,
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
  IconChevronDown,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilter,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dropdown,
  ERPListColumnHeaderFilter,
  ToastNotification,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { apiCallProtected } from "../../../api/axios";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useListFilterStore } from "../../../store/listFilterStore";
import { useIsAdminUser } from "../../../hooks/useIsAdminUser";
import FormTextInput from "../../../components/FormTextInput";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";

const LIST_KEY = "PORT_MASTER";

type PortMasterRow = {
  sno?: number;
  id?: number;
  port_code?: string;
  port_name?: string;
  transport_mode?: string;
  country?: string;
  status?: "ACTIVE" | "INACTIVE";
  created_at?: string;
  updated_at?: string;
};

type CountryData = {
  country_code: string;
  country_name: string;
  status: string;
};

type CountryApiResponse = {
  success?: boolean;
  data?: CountryData[];
};

type PortFilters = {
  port_code: string;
  port_name: string;
  transport_mode: string;
  country: string;
  status: string;
};

const DEFAULT_FILTERS: PortFilters = {
  port_code: "",
  port_name: "",
  transport_mode: "",
  country: "",
  status: "",
};

const TRANSPORT_MODE_OPTIONS = ["AIR", "SEA"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

const TABLE_HEADER_HEIGHT = "42.4px";

const filterFieldStyles = {
  input: { fontSize: "12px", fontFamily: "Inter" },
  label: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#495057",
    fontFamily: "Inter",
    marginBottom: "2px",
  },
};

function formatCountryLabel(name: string, code: string): string {
  const n = name.trim();
  const c = code.trim();
  if (n && c) return `${n} - ${c}`;
  return n || c;
}

export default function PortMasterList() {
  const isAdmin = useIsAdminUser();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!location.state?.refreshData) return;
    void queryClient.invalidateQueries({ queryKey: ["port-master"] });
    window.history.replaceState({}, document.title);
  }, [location.state?.refreshData, queryClient]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [portToDelete, setPortToDelete] = useState<PortMasterRow | null>(null);

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<PortFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<PortFilters>(DEFAULT_FILTERS);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

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
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));
  };

  const persistListState = useCallback(() => {
    setStoreFilters(LIST_KEY, appliedFilters);
    setStoreSearch(LIST_KEY, search);
    setShouldRestore(LIST_KEY, true);
  }, [appliedFilters, search, setStoreFilters, setStoreSearch, setShouldRestore]);

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

  const commitHeaderFilters = useCallback(
    (updater: (prev: PortFilters) => PortFilters) => {
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

  const { data: countries = [] } = useQuery({
    queryKey: ["countries-port-master"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          URL.country,
          API_HEADER,
        )) as CountryApiResponse | CountryData[];
        if (
          response &&
          typeof response === "object" &&
          "success" in response &&
          response.success &&
          Array.isArray(response.data)
        ) {
          return response.data;
        }
        if (Array.isArray(response)) return response;
        return [];
      } catch (error) {
        console.error("Error fetching countries:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const countryOptions = useMemo(
    () =>
      countries
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          value: c.country_code,
          label: formatCountryLabel(c.country_name, c.country_code),
        })),
    [countries],
  );

  const countryDisplayByCode = useMemo(() => {
    const map = new Map<string, string>();
    countryOptions.forEach((o) => map.set(o.value, o.label));
    return map;
  }, [countryOptions]);

  const resolveCountryDisplay = useCallback(
    (raw: unknown): string => {
      const value = String(raw ?? "").trim();
      if (!value) return "-";
      if (countryDisplayByCode.has(value)) {
        return countryDisplayByCode.get(value)!;
      }
      const byName = countries.find(
        (c) =>
          c.country_name?.trim().toLowerCase() === value.toLowerCase() ||
          formatCountryLabel(c.country_name, c.country_code).toLowerCase() ===
            value.toLowerCase(),
      );
      if (byName) {
        return formatCountryLabel(byName.country_name, byName.country_code);
      }
      return value;
    },
    [countries, countryDisplayByCode],
  );

  const buildFiltersPayload = (
    filters: PortFilters,
    searchValue: string,
  ): Record<string, string> => {
    const cleaned: Record<string, string> = {};
    (
      ["port_code", "port_name", "transport_mode", "country", "status"] as const
    ).forEach((key) => {
      if (filters[key]?.trim()) cleaned[key] = filters[key].trim();
    });
    if (searchValue?.trim()) cleaned.search = searchValue.trim();
    return cleaned;
  };

  const {
    data: portData = [],
    isLoading: portLoading,
    isFetching: portFetching,
    error: portError,
    refetch: refetchPorts,
  } = useQuery({
    queryKey: [
      "port-master",
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
        const payload: {
          filters?: Record<string, string | number>;
          ordering: string;
        } = {
          ordering: "-id",
          ...(Object.keys(filtersPayload).length > 0
            ? { filters: filtersPayload }
            : {}),
        };

        setIsInitialLoad(false);
        const response = await apiCallProtected.post(
          `${URL.portMasterFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        setShowFilters(false);

        const data = response as {
          data?: PortMasterRow[];
          total?: number;
        };
        if (data?.data && Array.isArray(data.data)) {
          setTotalRecords(data.total ?? data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching port data:", error);
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

  const isLoading = portFetching || portLoading || isInitialLoad;
  const tableData = portData ?? [];

  const openDeleteModal = (row: PortMasterRow) => {
    setPortToDelete(row);
    setDeleteModalOpened(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpened(false);
    setPortToDelete(null);
  };

  const confirmDelete = async () => {
    if (!portToDelete) return;
    try {
      setIsDeleting(true);
      await deleteApiCall(URL.portMaster, API_HEADER, portToDelete);
      ToastNotification({ type: "success", message: "Port deleted" });
      await queryClient.invalidateQueries({ queryKey: ["port-master"] });
      refetchPorts();
      closeDeleteModal();
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting port: ${err}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<PortMasterRow>[]>(
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
        accessorKey: "port_code",
        header: "Port Code",
        size: 110,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Port Code"
            value={appliedFilters.port_code}
            displayValue={appliedFilters.port_code}
            theme={erpTheme}
            placeholder="Filter port code"
            isEditing={editingHeaderId === "port_code"}
            onStartEdit={() => openHeaderEditor("port_code")}
            onStopEdit={() => collapseHeaderEditor("port_code")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, port_code: next }))
            }
          />
        ),
      },
      {
        accessorKey: "port_name",
        header: "Port Name",
        size: 180,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Port Name"
            value={appliedFilters.port_name}
            displayValue={appliedFilters.port_name}
            theme={erpTheme}
            placeholder="Filter port name"
            isEditing={editingHeaderId === "port_name"}
            onStartEdit={() => openHeaderEditor("port_name")}
            onStopEdit={() => collapseHeaderEditor("port_name")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, port_name: next }))
            }
          />
        ),
      },
      {
        accessorKey: "transport_mode",
        header: "Transport Mode",
        size: 130,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Transport Mode"
            value={appliedFilters.transport_mode}
            displayValue={appliedFilters.transport_mode}
            theme={erpTheme}
            placeholder="AIR / SEA"
            isEditing={editingHeaderId === "transport_mode"}
            onStartEdit={() => openHeaderEditor("transport_mode")}
            onStopEdit={() => collapseHeaderEditor("transport_mode")}
            onChange={() => {}}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                size="xs"
                data={TRANSPORT_MODE_OPTIONS}
                value={appliedFilters.transport_mode || null}
                placeholder="Select mode"
                clearable
                comboboxProps={{ withinPortal: true, zIndex: 1000 }}
                onChange={(v) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    transport_mode: v ?? "",
                  }));
                  if (v) onClose();
                }}
              />
            )}
          />
        ),
      },
      {
        accessorKey: "country",
        header: "Country",
        size: 120,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Country"
            value={appliedFilters.country}
            displayValue={
              appliedFilters.country
                ? countryDisplayByCode.get(appliedFilters.country) ||
                  appliedFilters.country
                : ""
            }
            theme={erpTheme}
            placeholder="Select country"
            isEditing={editingHeaderId === "country"}
            onStartEdit={() => openHeaderEditor("country")}
            onStopEdit={() => collapseHeaderEditor("country")}
            onChange={() => {}}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                size="xs"
                data={countryOptions}
                value={appliedFilters.country || null}
                placeholder="Select country"
                searchable
                clearable
                comboboxProps={{ withinPortal: true, zIndex: 1000 }}
                onChange={(v) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    country: v ?? "",
                  }));
                  if (v) onClose();
                }}
              />
            )}
          />
        ),
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontSize: "13px" }}>
            {resolveCountryDisplay(cell.getValue())}
          </Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 90,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Status"
            value={appliedFilters.status}
            displayValue={appliedFilters.status}
            theme={erpTheme}
            placeholder="ACTIVE / INACTIVE"
            isEditing={editingHeaderId === "status"}
            onStartEdit={() => openHeaderEditor("status")}
            onStopEdit={() => collapseHeaderEditor("status")}
            onChange={() => {}}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                size="xs"
                data={STATUS_OPTIONS}
                value={appliedFilters.status || null}
                placeholder="Select status"
                clearable
                comboboxProps={{ withinPortal: true, zIndex: 1000 }}
                onChange={(v) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    status: v ?? "",
                  }));
                  if (v) onClose();
                }}
              />
            )}
          />
        ),
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
                    persistListState();
                    navigate("./view", { state: row.original });
                  }}
                >
                  <Group gap="sm">
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>
                      View
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    persistListState();
                    navigate("./edit", { state: row.original });
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
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton onClick={() => openDeleteModal(row.original)}>
                  <Group gap="sm">
                    <IconTrash color="red" size={18} />
                    <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>
                      Delete
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
      appliedFilters,
      erpTheme,
      editingHeaderId,
      openHeaderEditor,
      collapseHeaderEditor,
      commitHeaderFilters,
      persistListState,
      navigate,
      isDeleting,
      openDeleteModal,
      countryOptions,
      countryDisplayByCode,
      resolveCountryDisplay,
    ],
  );

  const table = useMantineReactTable({
    columns,
    /*
     * During fetch, pass empty rows so MRT renders the loader inside <tbody>
     * (Enquiry / Receipt pattern) while keeping headers and pagination visible.
     */
    data: isLoading ? [] : tableData,
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
    renderEmptyRowsFallback: () => (
      <Center py={80} style={{ width: "100%", backgroundColor: "#ffffff" }}>
        {portError ? (
          <Text c="red" size="sm">
            Error loading port data. Please try refreshing the page.
          </Text>
        ) : isLoading ? (
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed" size="sm">
              Loading port data…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            No port data found
          </Text>
        )}
      </Center>
    ),
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: {
      shadow: "none",
      p: 0,
      radius: 0,
      withBorder: false,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        backgroundColor: "transparent",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles: Record<string, unknown> = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          zIndex: 2,
          borderLeft: "1px solid #e9ecef",
        };
      }
      return {
        style: {
          padding: "8px 12px",
          fontSize: "13px",
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
          zIndex: 2,
          backgroundColor: "#ffffff",
        };
      }
      return {
        style: {
          padding: "6px 12px",
          fontSize: "12px",
          backgroundColor: "#ffffff",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #e9ecef",
          minHeight: TABLE_HEADER_HEIGHT,
          height: TABLE_HEADER_HEIGHT,
          boxSizing: "border-box",
          ...extraStyles,
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        flexGrow: 1,
        minHeight: 0,
        height: "100%",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
  });

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        height: "100%",
      }}
    >
      <Card
        shadow="sm"
        padding="lg"
        pb="sm"
        radius="lg"
        withBorder
        mt="md"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          height: "calc(100vh - 112px)",
          overflow: "hidden",
        }}
      >
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600} c="#105476">
          Port Master List
        </Text>

        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Search"
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
            style={{ width: 300 }}
            radius="sm"
            size="xs"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <Button
            variant="outline"
            leftSection={<IconFilter size={16} />}
            size="xs"
            color="#105476"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          {/* <Menu shadow="md" width={160}>
            <Menu.Target>
              <Button
                variant="outline"
                rightSection={<IconChevronDown size={16} />}
                size="xs"
                color="#105476"
              >
                Download
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item>CSV</Menu.Item>
              <Menu.Item>Excel</Menu.Item>
              <Menu.Item>PDF</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button
            variant="outline"
            leftSection={<IconUpload size={16} />}
            size="xs"
            color="#105476"
          >
            Bulk Upload
          </Button> */}
          {isAdmin && (
            <Button
              variant="filled"
              leftSection={<IconPlus size={14} />}
              size="xs"
              color="#105476"
              onClick={() => {
                persistListState();
                navigate("./create");
              }}
            >
              Create New
            </Button>
          )}
        </Group>
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
          <Group justify="space-between" align="center">
            <Group align="center" gap="xs">
              <IconFilter size={16} color="#105476" />
              <Text size="sm" fw={500} c="#105476">
                Filters
              </Text>
            </Group>
          </Group>

          <Grid m="md">
            <Grid.Col span={2.4}>
              <TextInput
                size="xs"
                label="Port Code"
                placeholder="Port Code"
                value={draftFilters.port_code}
                styles={filterFieldStyles}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    port_code: e.currentTarget.value,
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <TextInput
                size="xs"
                label="Port Name"
                placeholder="Port Name"
                value={draftFilters.port_name}
                styles={filterFieldStyles}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    port_name: e.currentTarget.value,
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <Dropdown
                size="xs"
                label="Transport Mode"
                placeholder="Select mode"
                data={TRANSPORT_MODE_OPTIONS}
                searchable
                value={draftFilters.transport_mode || null}
                styles={filterFieldStyles}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    transport_mode: value || "",
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <Dropdown
                size="xs"
                label="Country"
                placeholder="Select country"
                data={countryOptions}
                searchable
                value={draftFilters.country || null}
                styles={filterFieldStyles}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    country: value || "",
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={2.4}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={STATUS_OPTIONS}
                searchable
                value={draftFilters.status || null}
                styles={filterFieldStyles}
                onChange={(value) =>
                  setDraftFilters((prev) => ({ ...prev, status: value || "" }))
                }
              />
            </Grid.Col>
          </Grid>

          <Group justify="end" mt="sm">
            <Button
              size="xs"
              variant="outline"
              color="#105476"
              leftSection={<IconX size={14} />}
              onClick={clearAllFilters}
            >
              Clear Filters
            </Button>
            <Button
              size="xs"
              variant="filled"
              color="#105476"
              leftSection={
                isLoading ? <Loader size={14} /> : <IconFilter size={14} />
              }
              onClick={applyFilters}
              loading={isLoading}
              disabled={isLoading}
            >
              Apply Filters
            </Button>
          </Group>
        </Card>
      )}

      <Box
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <MantineReactTable table={table} />
      </Box>
      <PaginationBar
        pageSize={pagination.pageSize}
        currentPage={currentPage}
        totalRecords={totalRecords}
        onPageSizeChange={handlePageSizeChange}
        onPageChange={handlePageChange}
        pageSizeOptions={["10", "15", "25", "50"]}
      />
      </Card>

      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Confirm Delete"
        centered
        size="sm"
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure? Do you want to delete this port?
          </Text>
          {portToDelete?.port_code || portToDelete?.port_name ? (
            <Box p="xs" bg="#f8f9fa" style={{ borderRadius: "4px" }}>
              <Text size="xs" c="dimmed">
                {portToDelete.port_code ? (
                  <>
                    <Text span fw={500}>
                      Port Code:
                    </Text>{" "}
                    {portToDelete.port_code}
                    <br />
                  </>
                ) : null}
                {portToDelete.port_name ? (
                  <>
                    <Text span fw={500}>
                      Port Name:
                    </Text>{" "}
                    {portToDelete.port_name}
                  </>
                ) : null}
              </Text>
            </Box>
          ) : null}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={closeDeleteModal}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              color="#FF0004"
              w={100}
              onClick={confirmDelete}
              loading={isDeleting}
              disabled={isDeleting}
            >
              Yes, Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
