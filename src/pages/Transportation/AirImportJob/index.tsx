import { useMemo, useState, useEffect } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Card,
  Center,
  Stack,
  Box,
  Menu,
  ActionIcon,
  Loader,
  Modal,
  Badge,
  Grid,
  TextInput,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  ToastNotification,
  SearchableSelect,
  SingleDateInput,
  Dropdown,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import useDateFormat from "../../../hooks/useDateFormat";
import { useDebouncedValue } from "@mantine/hooks";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useListFilterStore } from "../../../store/listFilterStore";

dayjs.extend(utc);

const LIST_KEY = "AIR_IMPORT_JOB_MASTER";

type AirImportJobData = {
  id: number;
  service: string;
  service_type: string;
  agent_code: string | null;
  agent_name: string | null;
  origin_agent_code: string | null;
  origin_agent_name: string | null;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: string;
  eta: string;
  atd: string | null;
  ata: string | null;
  carrier_code: string;
  carrier_name: string;
  vessel_name: string | null;
  voyage_number: string | null;
  mbl_number: string | null;
  mbl_date: string | null;
  flightno: string | null;
  mawb_no: string | null;
  mawb_date: string | null;
  ocean_routings?: Array<Record<string, unknown>>;
  housing_details?: Array<Record<string, unknown>>;
  created_by?: string;
  branch_code?: string;
  company_code?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  job_id?: string;
};

type AirImportJobFilters = {
  job_id: string;
  mawb_no: string;
  agent_code: string;
  agent_name: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: string;
  eta: string;
  status: string;
};

function AirImportJobMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: AirImportJobFilters = {
    job_id: "",
    mawb_no: "",
    agent_code: "",
    agent_name: "",
    origin_code: "",
    origin_name: "",
    destination_code: "",
    destination_name: "",
    etd: "",
    eta: "",
    status: "",
  };
  const [draftFilters, setDraftFilters] = useState<AirImportJobFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AirImportJobFilters>(DEFAULT_FILTERS);
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
  const [cancelConfirmRow, setCancelConfirmRow] = useState<AirImportJobData | null>(
    null
  );
  const [isCancelling, setIsCancelling] = useState(false);

  const dateFormat = useDateFormat();
  const getStatusBadge = (statusRaw: string | undefined | null) => {
    const statusUpper = (statusRaw || "").toUpperCase();
    const label =
      statusUpper === "CANCEL"
        ? "Cancel"
        : statusUpper === "CLOSED"
          ? "Closed"
          : "Active";
    const color = label === "Cancel" ? "red" : label === "Closed" ? "blue" : "green";
    return { label, color } as const;
  };

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    setIsInitialLoad(true);

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
  const index = pagination.pageIndex * pagination.pageSize;

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: page - 1 }));
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
    filters: AirImportJobFilters,
    searchValue: string,
  ): Record<string, string> => {
    const cleaned: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (key === "agent_code" || key === "origin_name" || key === "destination_name") {
        return;
      }
      if (!value) return;
      if (value.trim() !== "") {
        cleaned[key] = key === "status" ? value.toUpperCase() : value;
      }
    });

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  const {
    data: importJobData = [],
    isLoading: importJobLoading,
    isFetching: importJobFetching,
    refetch: refetchImportJobs,
  } = useQuery({
    queryKey: [
      "airImportJobs",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<AirImportJobData[]> => {
      const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);

      const payload =
        Object.keys(filtersPayload).length > 0
          ? {
              filters: {
                service: "AIR",
                service_type: "Import",
                ...filtersPayload,
              },
            }
          : {
              filters: {
                service: "AIR",
                service_type: "Import",
              },
            };

      setIsInitialLoad(false);
      const response = await apiCallProtected.post(
        `${URL.filterJobCreate}?index=${index}&limit=${pagination.pageSize}`,
        payload,
        API_HEADER
      );
      setShowFilters(false);

      const result = response as any;
      const list = Array.isArray(result?.data) ? result.data : [];
      setTotalRecords(result?.total_count ?? list.length);

      return list;
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const isLoading = importJobFetching || importJobLoading || isInitialLoad;

  const columns = useMemo<MRT_ColumnDef<AirImportJobData>[]>(
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
        accessorKey: "job_id",
        header: "Job ID",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value || "-";
        },
      },
      {
        accessorKey: "mawb_no",
        header: "MAWB No",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value || "-";
        },
      },
      {
        accessorKey: "agent_name",
        header: "Destination Agent",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value || "-";
        },
      },
      {
        accessorKey: "origin_name",
        header: "Origin",
        size: 150,
      },
      {
        accessorKey: "destination_name",
        header: "Destination",
        size: 150,
      },
      {
        accessorKey: "etd",
        header: "ETD",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) return "-";
          try {
            return dayjs.utc(value).local().format(`${dateFormat} HH:mm`);
          } catch {
            return value;
          }
        },
      },
      {
        accessorKey: "eta",
        header: "ETA",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) return "-";
          try {
            return dayjs.utc(value).local().format(`${dateFormat} HH:mm`);
          } catch {
            return value;
          }
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ cell }) => {
          const { label, color } = getStatusBadge(cell.getValue<string | null>());
          return (
            <Badge size="sm" variant="light" color={color}>
              {label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Action",
        size: 80,
        Cell: ({ row }) => {
          const statusUpper = (row.original.status ?? "").toUpperCase();
          const isCancel = statusUpper === "CANCEL";
          const canCancel = statusUpper !== "GENERATED" && !isCancel;
          return (
            <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  disabled={isCancel}
                  onClick={() => {
                    if (!isCancel) {
                      setStoreFilters(LIST_KEY, appliedFilters);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate(`/air/import-job/edit`, {
                        state: { job: row.original },
                      });
                    }
                  }}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconX size={14} />}
                  color="red"
                  disabled={!canCancel}
                  onClick={() => {
                    if (canCancel) setCancelConfirmRow(row.original);
                  }}
                >
                  Cancel
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [navigate, appliedFilters, search, setStoreFilters, setStoreSearch, setShouldRestore]
  );

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    const rowToCancel = cancelConfirmRow;
    setIsCancelling(true);
    try {
      const response = (await apiCallProtected.patch(
        `${URL.importJob}${rowToCancel.id}/`,
        { status: "CANCEL" },
        API_HEADER
      )) as any;
      if (response?.status === false) {
        throw new Error(response?.message || "Failed to cancel job");
      }
      setCancelConfirmRow(null);
      ToastNotification({
        type: "success",
        message: "Job cancelled successfully",
      });
      await refetchImportJobs();
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: err?.message || "Failed to cancel job",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const table = useMantineReactTable({
    columns,
    data: importJobData,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: totalRecords,
    state: {
      pagination,
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
          width: "fit-content",
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
        position: "relative",
        overflow: "auto",
      },
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                No jobs to display
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

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
            c="#1E293B"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Air Import Job List
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
                  "&:hover": {
                    backgroundColor: "#2563EB",
                  },
                },
              }}
              onClick={() => {
                setStoreFilters(LIST_KEY, appliedFilters);
                setStoreSearch(LIST_KEY, search);
                setShouldRestore(LIST_KEY, true);
                navigate("/air/import-job/create");
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
                label="Job ID"
                placeholder="Type Job ID"
                size="xs"
                value={draftFilters.job_id}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, job_id: e.currentTarget.value }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <FormTextInput
                label="MAWB No"
                placeholder="Type MAWB No"
                size="xs"
                value={draftFilters.mawb_no}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, mawb_no: e.currentTarget.value }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SearchableSelect
                apiEndpoint={URL.agent}
                label="Agent"
                placeholder="Type Agent"
                size="xs"
                value={draftFilters.agent_code}
                displayValue={draftFilters.agent_name}
                onChange={(value, selectedData, originalData) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    agent_code: value || "",
                    agent_name:
                      selectedData?.label ||
                      String(
                        originalData?.customer_name ?? originalData?.name ?? value ?? ""
                      ),
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(item.customer_code ?? item.id ?? ""),
                  label: String(item.customer_name ?? item.name ?? ""),
                })}
                searchFields={["customer_code", "customer_name", "name"]}
                returnOriginalData
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SearchableSelect
                apiEndpoint={URL.portMaster}
                additionalParams={{ transport_mode: "AIR" }}
                label="Origin"
                placeholder="Type Origin"
                size="xs"
                value={draftFilters.origin_code}
                displayValue={draftFilters.origin_name}
                onChange={(value, selectedData, originalData) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    origin_code: value || "",
                    origin_name:
                      selectedData?.label ||
                      String(originalData?.port_name ?? value ?? ""),
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                searchFields={["port_code", "port_name"]}
                returnOriginalData
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SearchableSelect
                apiEndpoint={URL.portMaster}
                label="Destination"
                placeholder="Type Destination"
                additionalParams={{ transport_mode: "AIR" }}
                size="xs"
                value={draftFilters.destination_code}
                displayValue={draftFilters.destination_name}
                onChange={(value, selectedData, originalData) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    destination_code: value || "",
                    destination_name:
                      selectedData?.label ||
                      String(originalData?.port_name ?? value ?? ""),
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                searchFields={["port_code", "port_name"]}
                returnOriginalData
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="ETD"
                size="xs"
                value={draftFilters.etd ? dayjs(draftFilters.etd).toDate() : null}
                onChange={(date) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    etd: date ? dayjs(date).format("YYYY-MM-DD") : "",
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="ETA"
                size="xs"
                value={draftFilters.eta ? dayjs(draftFilters.eta).toDate() : null}
                onChange={(date) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    eta: date ? dayjs(date).format("YYYY-MM-DD") : "",
                  }))
                }
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Dropdown
                label="Status"
                placeholder="Select Status"
                size="xs"
                data={["Active", "Closed", "Cancel"]}
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
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
              Loading air import jobs...
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {importJobFetching && (
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
                  <Loader size="lg" color="#2563EB" />
                  <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
                    Refreshing data...
                  </Text>
                </Stack>
              </div>
            )}
            <MantineReactTable table={table} />
          </div>

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
      <Modal
        opened={!!cancelConfirmRow}
        onClose={() => !isCancelling && setCancelConfirmRow(null)}
        title="Cancel job"
        centered
      >
        <Text size="sm" c="dimmed" mb="md">
          Are you sure you want to cancel this job? This action cannot be undone.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button
            variant="subtle"
            onClick={() => setCancelConfirmRow(null)}
            disabled={isCancelling}
          >
            No
          </Button>
          <Button color="red" onClick={handleConfirmCancel} loading={isCancelling}>
            Yes, cancel
          </Button>
        </Group>
      </Modal>
    </Card>
  );
}

export default AirImportJobMaster;
