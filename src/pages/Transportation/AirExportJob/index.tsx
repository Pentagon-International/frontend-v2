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
  Stack,
  Box,
  Menu,
  ActionIcon,
  Loader,
  Modal,
  Badge,
  Grid,
  TextInput,
  MantineProvider,
  createTheme,
  rem,
  Tooltip,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconX,
  IconSearch,
  IconFilter,
  IconPackage,
  IconCircleCheck,
  IconClock,
  IconCircleX,
  IconArrowRight,
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
  ERPListScreen,
  ERPListStatPill,
  ERPListPaginationFooter,
  ERPListFilterActionsFooter,
  ERPListTableLoading,
  ERPListTableEmpty,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  type ErpListTheme,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import useDateFormat from "../../../hooks/useDateFormat";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../../store/listFilterStore";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";

dayjs.extend(utc);

const LIST_KEY = "AIR_EXPORT_JOB_MASTER";

const AIR_EXPORT_JOB_GEIST_ROOT_CLASS = "air-export-job-geist-root";

const V0_FONT_SANS = "'Geist', sans-serif";
const v0RootTypography = {
  fontFamily: V0_FONT_SANS,
  fontSize: 14,
  lineHeight: 1.5,
  WebkitFontSmoothing: "antialiased" as const,
  MozOsxFontSmoothing: "grayscale" as const,
};

const AIR_EXPORT_FILTER_SELECT_CLASSNAMES = {
  dropdown: AIR_EXPORT_JOB_GEIST_ROOT_CLASS,
  option: AIR_EXPORT_JOB_GEIST_ROOT_CLASS,
};

const AIR_EXPORT_FILTER_BORDER = "#e2e8f0";
const AIR_EXPORT_FILTER_UNIFIED_STYLES = {
  label: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    fontWeight: 500,
    color: "#64748b",
    lineHeight: 1.25,
    marginBottom: 6,
    display: "block" as const,
    minHeight: 15,
  },
  input: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
    height: 32,
    minHeight: 32,
    borderColor: AIR_EXPORT_FILTER_BORDER,
  },
  dropdown: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
  option: {
    fontFamily: V0_FONT_SANS,
    fontSize: 12,
  },
} as const;

const airExportJobV0MantineTheme = createTheme({
  fontFamily: V0_FONT_SANS,
  headings: { fontFamily: V0_FONT_SANS },
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(20),
  },
});

type AirExportJobFilters = {
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

const DEFAULT_AIR_EXPORT_FILTERS: AirExportJobFilters = {
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

type AirExportJobData = {
  id: number;
  service_id?: number;
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

/** Matches `summary` on filtered job create list for air export jobs. */
type AirExportJobListSummary = {
  status_counts?: {
    active?: number;
    closed?: number;
    cancel?: number;
  };
};

type AirExportJobListQueryResult = {
  data: AirExportJobData[];
  total: number;
  summary?: AirExportJobListSummary;
};

type AirExportJobTableRow = AirExportJobData & { sno: number };

function AirExportJobMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<AirExportJobFilters>(DEFAULT_AIR_EXPORT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AirExportJobFilters>(DEFAULT_AIR_EXPORT_FILTERS);
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
  const [cancelConfirmRow, setCancelConfirmRow] = useState<AirExportJobData | null>(
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

  // Keep restore flow tied strictly to navigation key, same as AirImportJobMaster.
  /* eslint-disable react-hooks/exhaustive-deps */
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
      const restored = { ...DEFAULT_AIR_EXPORT_FILTERS, ...stored.filters };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const index = pagination.pageIndex * pagination.pageSize;

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters({ ...DEFAULT_AIR_EXPORT_FILTERS });
    setAppliedFilters({ ...DEFAULT_AIR_EXPORT_FILTERS });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildFiltersPayload = (
    filters: AirExportJobFilters,
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

  const { data: exportJobResponse, isLoading: exportJobLoading, isFetching: exportJobFetching, refetch: refetchExportJobs } =
    useQuery({
      queryKey: [
        "airExportJobs",
        pagination.pageIndex,
        pagination.pageSize,
        JSON.stringify(appliedFilters),
        debouncedSearch,
      ],
      queryFn: async (): Promise<AirExportJobListQueryResult> => {
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);

        const payload =
          Object.keys(filtersPayload).length > 0
            ? {
                filters: {
                  service: "AIR",
                  service_type: "Export",
                  ...filtersPayload,
                },
              }
            : {
                filters: {
                  service: "AIR",
                  service_type: "Export",
                },
              };

        setIsInitialLoad(false);
        const response = (await apiCallProtected.post(
          `${URL.filterJobCreate}?index=${index}&limit=${pagination.pageSize}`,
          payload,
          API_HEADER
        )) as Record<string, unknown>;

        const list = Array.isArray(response.data) ? (response.data as AirExportJobData[]) : [];
        const total = getBookingShipmentFilterListTotal(response, list, index);
        setTotalRecords(total);

        const rawSummary = response.summary;
        const summary: AirExportJobListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? (rawSummary as AirExportJobListSummary)
            : undefined;

        return { data: list, total, summary };
      },
      enabled: !isRestoring && search === debouncedSearch,
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    });

  const exportJobData = exportJobResponse?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(Math.max(0, totalRecords) / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    setPagination((p) => (p.pageIndex > maxPageIndex ? { ...p, pageIndex: maxPageIndex } : p));
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const stats = useMemo(() => {
    const s = exportJobResponse?.summary;
    if (s?.status_counts) {
      return {
        total: totalRecords,
        active: s.status_counts.active ?? 0,
        closed: s.status_counts.closed ?? 0,
        cancel: s.status_counts.cancel ?? 0,
      };
    }
    return {
      total: totalRecords,
      active: 0,
      closed: 0,
      cancel: 0,
    };
  }, [exportJobResponse?.summary, totalRecords]);

  const tableData: AirExportJobTableRow[] = useMemo(
    () =>
      exportJobData.map((row, i) => ({
        ...row,
        sno: pagination.pageIndex * pagination.pageSize + i + 1,
      })),
    [exportJobData, pagination.pageIndex, pagination.pageSize]
  );

  const isDataLoading = isRestoring || exportJobLoading || isInitialLoad;

  /** Aligned with `AirExportBookingMaster` list table (padding, palette, route column). */
  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#105476";
  const pageBg = "#F0F4F8";
  const cardBg = "#ffffff";
  const headerBg = "#f8fafc";

  const erpTheme: ErpListTheme = {
    border,
    muted,
    fg,
    primary,
    headerBg,
    pageBg,
    cardBg,
    fontSans: V0_FONT_SANS,
  };

  const columns = useMemo<MRT_ColumnDef<AirExportJobTableRow>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        maxSize: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ cell }) => (
          <Text fw={600} size="sm" c={fg} style={{ fontFamily: V0_FONT_SANS }}>
            {cell.getValue<number>()}
          </Text>
        ),
      },
      {
        accessorKey: "job_id",
        header: "Job ID",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) {
            return (
              <Text size="sm" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
                —
              </Text>
            );
          }
          return (
            <Text fw={600} size="sm" c={fg} style={{ fontFamily: V0_FONT_SANS }}>
              {value}
            </Text>
          );
        },
      },
      {
        accessorKey: "mawb_no",
        header: "MAWB No",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (value) {
            return (
              <Text size="xs" fw={500} c={fg} style={{ fontFamily: V0_FONT_SANS }}>
                {value}
              </Text>
            );
          }
          return (
            <Text size="sm" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
              —
            </Text>
          );
        },
      },
      {
        accessorKey: "agent_name",
        header: "Destination Agent",
        size: 200,
        Cell: ({ cell }) => {
          const value = (cell.getValue<string | null>() || "").trim();
          if (!value) {
            return (
              <Text size="sm" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
                —
              </Text>
            );
          }
          return (
            <Tooltip
              label={value}
              withArrow
              styles={{ tooltip: { fontFamily: V0_FONT_SANS, fontSize: 12 } }}
            >
              <Text size="sm" c={fg} lineClamp={1} maw={200} style={{ cursor: "default", fontFamily: V0_FONT_SANS }}>
                {value}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        id: "route",
        header: "Route",
        size: 260,
        minSize: 200,
        Cell: ({ row }) => {
          const o = row.original;
          const oc = o.origin_code || o.origin_name || "";
          const dc = o.destination_code || o.destination_name || "";
          return (
            <Group gap={6} wrap="nowrap">
              <Text fw={600} size="sm" c={primary} style={{ fontFamily: V0_FONT_SANS }}>
                {oc || "—"}
              </Text>
              <IconArrowRight size={12} color={muted} style={{ flexShrink: 0 }} />
              <Text fw={500} size="sm" c={fg} style={{ fontFamily: V0_FONT_SANS }}>
                {dc || "—"}
              </Text>
            </Group>
          );
        },
      },
      {
        accessorKey: "etd",
        header: "ETD",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) {
            return (
              <Text size="sm" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
                —
              </Text>
            );
          }
          try {
            return (
              <Text size="sm" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
                {dayjs.utc(value).local().format(`${dateFormat} HH:mm`)}
              </Text>
            );
          } catch {
            return (
              <Text size="sm" c={fg} style={{ fontFamily: V0_FONT_SANS }}>
                {value}
              </Text>
            );
          }
        },
      },
      {
        accessorKey: "eta",
        header: "ETA",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) {
            return (
              <Text size="sm" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
                —
              </Text>
            );
          }
          try {
            return (
              <Text size="sm" c={muted} style={{ fontFamily: V0_FONT_SANS }}>
                {dayjs.utc(value).local().format(`${dateFormat} HH:mm`)}
              </Text>
            );
          } catch {
            return (
              <Text size="sm" c={fg} style={{ fontFamily: V0_FONT_SANS }}>
                {value}
              </Text>
            );
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
            <Badge size="sm" variant="light" color={color} styles={{ label: { fontFamily: V0_FONT_SANS } }}>
              {label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
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
                      navigate(`/air/export-job/edit`, {
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
    [navigate, dateFormat, appliedFilters, search, setStoreFilters, setStoreSearch, setShouldRestore, fg, primary, muted]
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
      )) as { status?: boolean; message?: string };
      if (response?.status === false) {
        throw new Error(response?.message || "Failed to cancel job");
      }
      setCancelConfirmRow(null);
      ToastNotification({
        type: "success",
        message: "Job cancelled successfully",
      });
      await refetchExportJobs();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel job",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const table = useMantineReactTable({
    columns,
    data: tableData,
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
    mantineTableBodyRowProps: {
      style: {
        borderBottom: `1px solid ${border}`,
        transition: "background 0.12s",
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
              borderLeft: `1px solid ${border}`,
              boxShadow: "1px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "10px 14px",
          fontSize: 14,
          fontFamily: V0_FONT_SANS,
          color: muted,
          backgroundColor: cardBg,
          verticalAlign: "middle" as const,
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
              backgroundColor: headerBg,
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "10px 14px",
          fontSize: 14,
          fontWeight: 500,
          fontFamily: V0_FONT_SANS,
          color: muted,
          backgroundColor: headerBg,
          top: 0,
          zIndex: 3,
          borderBottom: `1px solid ${border}`,
          whiteSpace: "nowrap" as const,
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
    <MantineProvider theme={airExportJobV0MantineTheme}>
      <Box className={AIR_EXPORT_JOB_GEIST_ROOT_CLASS} style={v0RootTypography}>
        <ERPListScreen
          theme={erpTheme}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconPackage size={14} color={primary} />}
                  value={stats.total}
                  label="Total"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconCircleCheck size={14} color="#059669" />}
                  iconBackground="#d1fae5"
                  iconColor="#059669"
                  value={stats.active}
                  label="Active"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconClock size={14} color="#2563eb" />}
                  iconBackground="#dbeafe"
                  iconColor="#2563eb"
                  value={stats.closed}
                  label="Closed"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconCircleX size={14} color="#dc2626" />}
                  iconBackground="#fee2e2"
                  iconColor="#dc2626"
                  value={stats.cancel}
                  label="Cancel"
                />
              </>
            ),
            actions: (
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  classNames={{ input: AIR_EXPORT_JOB_GEIST_ROOT_CLASS }}
                  placeholder="Search..."
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={() => setSearch("")}
                        style={{ cursor: "pointer" }}
                        aria-label="Clear search"
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
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: V0_FONT_SANS,
                      color: fg,
                      height: 36,
                      border: `1px solid ${border}`,
                      "&:focus": {
                        borderColor: primary,
                      },
                    },
                  }}
                />
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/air/export-job/create");
                  }}
                >
                  Create New
                </Button>
              </Group>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine jobs by ID, route, MAWB, dates, or status",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={isDataLoading}
                applyDisabled={isDataLoading}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <FormTextInput
                    label="Job ID"
                    placeholder="Type Job ID"
                    size="xs"
                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                    value={draftFilters.job_id}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, job_id: e.currentTarget.value }))
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <FormTextInput
                    label="MAWB No"
                    placeholder="Type MAWB No"
                    size="xs"
                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                    value={draftFilters.mawb_no}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, mawb_no: e.currentTarget.value }))
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <SearchableSelect
                    apiEndpoint={URL.agent}
                    label="Agent"
                    placeholder="Type Agent"
                    size="xs"
                    classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
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
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <SearchableSelect
                    apiEndpoint={URL.portMaster}
                    additionalParams={{ transport_mode: "AIR" }}
                    label="Origin"
                    placeholder="Type Origin"
                    size="xs"
                    classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
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
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <SearchableSelect
                    apiEndpoint={URL.portMaster}
                    label="Destination"
                    placeholder="Type Destination"
                    additionalParams={{ transport_mode: "AIR" }}
                    size="xs"
                    classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
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
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <SingleDateInput
                    label="ETD"
                    size="xs"
                    classNames={{ dropdown: AIR_EXPORT_JOB_GEIST_ROOT_CLASS }}
                    styles={{
                      ...AIR_EXPORT_FILTER_UNIFIED_STYLES,
                      input: {
                        ...AIR_EXPORT_FILTER_UNIFIED_STYLES.input,
                        minHeight: 32,
                      },
                    }}
                    value={draftFilters.etd ? dayjs(draftFilters.etd).toDate() : null}
                    onChange={(date) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        etd: date ? dayjs(date).format("YYYY-MM-DD") : "",
                      }))
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <SingleDateInput
                    label="ETA"
                    size="xs"
                    classNames={{ dropdown: AIR_EXPORT_JOB_GEIST_ROOT_CLASS }}
                    styles={{
                      ...AIR_EXPORT_FILTER_UNIFIED_STYLES,
                      input: {
                        ...AIR_EXPORT_FILTER_UNIFIED_STYLES.input,
                        minHeight: 32,
                      },
                    }}
                    value={draftFilters.eta ? dayjs(draftFilters.eta).toDate() : null}
                    onChange={(date) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        eta: date ? dayjs(date).format("YYYY-MM-DD") : "",
                      }))
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 4, xl: 3 }}>
                  <Dropdown
                    label="Status"
                    placeholder="Select Status"
                    size="xs"
                    classNames={AIR_EXPORT_FILTER_SELECT_CLASSNAMES}
                    styles={AIR_EXPORT_FILTER_UNIFIED_STYLES}
                    data={["Active", "Closed", "Cancel"]}
                    searchable
                    value={draftFilters.status || null}
                    onChange={(value) =>
                      setDraftFilters((prev) => ({ ...prev, status: value || "" }))
                    }
                  />
                </Grid.Col>
              </Grid>
            ),
          }}
          table={{
            footer: (
              <ERPListPaginationFooter
                theme={erpTheme}
                totalRecords={totalRecords}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                onPageIndexChange={(i) => setPagination((p) => ({ ...p, pageIndex: i }))}
                onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
                pageSizeOptions={["10", "25", "50"]}
                selectClassNames={{
                  dropdown: AIR_EXPORT_JOB_GEIST_ROOT_CLASS,
                  option: AIR_EXPORT_JOB_GEIST_ROOT_CLASS,
                }}
              />
            ),
            children: isDataLoading ? (
              <ERPListTableLoading theme={erpTheme} message="Loading air export jobs..." />
            ) : tableData.length === 0 ? (
              <ERPListTableEmpty
                theme={erpTheme}
                icon={<IconPackage size={24} color={muted} />}
                title="No jobs found"
              />
            ) : (
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {exportJobFetching && !isDataLoading && (
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
                      borderRadius: 8,
                    }}
                  >
                    <Stack align="center" gap="md">
                      <Loader size="lg" color={primary} />
                      <Text c="dimmed" size="sm" style={{ fontFamily: V0_FONT_SANS }}>
                        Refreshing data...
                      </Text>
                    </Stack>
                  </div>
                )}
                <MantineReactTable table={table} />
              </div>
            ),
          }}
        />
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
      </Box>
    </MantineProvider>
  );
}

export default AirExportJobMaster;
