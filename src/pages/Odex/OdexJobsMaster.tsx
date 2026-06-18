import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Progress,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconArrowRight,
  IconAutomation,
  IconBriefcase,
  IconCircleCheck,
  IconClock,
  IconDotsVertical,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStack2,
  IconX,
} from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { useDebouncedValue } from "@mantine/hooks";
import dayjs from "dayjs";
import {
  DEFAULT_ERP_LIST_THEME,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
  ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  erpListBookingMasterBodyTd,
  erpListBookingMasterDateTd,
  erpListBookingMasterReferenceTdShell,
  erpListBookingMasterTableStyle,
  erpListDataRowProps,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListThStyle,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  SingleDateInput,
  ToastNotification,
} from "../../components";
import { useOdexJobList } from "../../hooks/useOdexJobList";
import useDateFormat from "../../hooks/useDateFormat";
import OdexStatusBadge from "./components/OdexStatusBadge";
import { ODEX_JOB_TYPES, ODEX_STATUS_FILTER_OPTIONS } from "./odexConstants";
import {
  CONSOL_IMPORT_JOB_EDIT_PATH,
  odexJobDetailPath,
} from "./odexUrls";

type OdexFilterState = {
  status: string;
  odex_type: string;
  date_from: Date | null;
  date_to: Date | null;
};

const EMPTY_FILTERS: OdexFilterState = {
  status: "",
  odex_type: "",
  date_from: null,
  date_to: null,
};

const ODEX_STATUS_SELECT_OPTIONS = ODEX_STATUS_FILTER_OPTIONS.filter(
  (o) => o.value !== "",
);

export default function OdexJobsMaster() {
  const navigate = useNavigate();
  const dateFormat = useDateFormat();
  const theme = DEFAULT_ERP_LIST_THEME;
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(theme);
  const { muted, fg, primary } = theme;

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "—";
    const d = dayjs(value);
    return d.isValid() ? d.format(`${dateFormat} HH:mm`) : "—";
  };

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [draftFilters, setDraftFilters] = useState<OdexFilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<OdexFilterState>(EMPTY_FILTERS);

  const filters = useMemo(
    () => ({
      index: pageIndex * pageSize,
      limit: pageSize,
      ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
      ...(appliedFilters.odex_type
        ? { odex_type: appliedFilters.odex_type }
        : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(appliedFilters.date_from
        ? { date_from: dayjs(appliedFilters.date_from).format("YYYY-MM-DD") }
        : {}),
      ...(appliedFilters.date_to
        ? { date_to: dayjs(appliedFilters.date_to).format("YYYY-MM-DD") }
        : {}),
    }),
    [pageIndex, pageSize, appliedFilters, debouncedSearch],
  );

  const { data, isLoading, isFetching, refetch, error } = useOdexJobList(
    filters,
    { refetchInterval: 30_000 },
  );

  const rows = data?.results ?? [];
  const totalRecords = data?.total ?? 0;

  const lastDebouncedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastDebouncedSearchRef.current === null) {
      lastDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (lastDebouncedSearchRef.current === debouncedSearch) return;
    lastDebouncedSearchRef.current = debouncedSearch;
    setPageIndex(0);
  }, [debouncedSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const maxPageIndex = totalPages - 1;
    if (pageIndex > maxPageIndex) {
      setPageIndex(maxPageIndex);
    }
  }, [totalRecords, pageSize, pageIndex]);

  const stats = useMemo(() => {
    const norm = (s: string | undefined) => String(s ?? "").toLowerCase();
    return {
      total: totalRecords,
      running: rows.filter((r) => norm(r.status) === "running").length,
      completed: rows.filter((r) => norm(r.status) === "completed").length,
      failed: rows.filter((r) => norm(r.status) === "failed").length,
    };
  }, [rows, totalRecords]);

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPageIndex(0);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPageIndex(0);
    setShowFilters(false);
  };

  const handleRefresh = () => {
    refetch().catch(() => {
      ToastNotification({
        type: "error",
        message: "Failed to refresh ODEX jobs",
      });
    });
  };

  const mergeTh = (minW: number, widthPx?: number) => ({
    ...erpListThStyle(theme),
    minHeight: 52.4,
    height: 52.4,
    verticalAlign: "middle" as const,
    boxSizing: "border-box" as const,
    minWidth: minW,
    ...(widthPx != null ? { width: widthPx } : {}),
  });

  const tableLoading = isLoading && rows.length === 0;

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box className={ERP_LIST_GEIST_ROOT_CLASS} style={erpListGeistRootTypography}>
        <ERPListScreen
          theme={theme}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={theme}
                  icon={<IconAutomation size={14} color={primary} />}
                  value={stats.total}
                  label="Total"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconClock size={14} color="#2563eb" />}
                  iconBackground="#dbeafe"
                  iconColor="#2563eb"
                  value={stats.running}
                  label="Running"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconCircleCheck size={14} color="#059669" />}
                  iconBackground="#d1fae5"
                  iconColor="#059669"
                  value={stats.completed}
                  label="Completed"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconX size={14} color="#dc2626" />}
                  iconBackground="#fee2e2"
                  iconColor="#dc2626"
                  value={stats.failed}
                  label="Failed"
                />
              </>
            ),
            secondary: (
              <>
                <Group gap={8} wrap="nowrap" align="center">
                  <IconStack2 size={16} color={muted} style={{ flexShrink: 0 }} />
                  <Text fw={600} size="sm" c={fg} component="span">
                    {rows.length}
                  </Text>
                </Group>
                <Group gap={8} wrap="nowrap" align="center">
                  <IconBriefcase size={16} color={muted} style={{ flexShrink: 0 }} />
                  <Text fw={600} size="sm" c={fg} component="span">
                    {totalRecords.toLocaleString()}
                  </Text>
                  <Text size="xs" c={muted} component="span">
                    total
                  </Text>
                </Group>
              </>
            ),
            actions: (
              <>
                <TextInput
                  size="xs"
                  w={220}
                  placeholder="Search job ref, log…"
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  leftSection={<IconSearch size={14} />}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    ) : null
                  }
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={{
                    input: {
                      fontFamily: theme.fontSans,
                      fontSize: 12,
                      height: 32,
                      minHeight: 32,
                    },
                  }}
                />
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(theme)}
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleRefresh}
                  loading={isFetching}
                >
                  Refresh
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(theme)}
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  styles={erpToolbarPrimaryButtonStyles(theme)}
                  component={Link}
                  to="/SeaExport/import-job"
                >
                  Go to Job Create
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine ODEX jobs by status, type, or created date",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={theme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={isFetching}
                applyDisabled={isFetching}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Select
                      size="xs"
                      label="Status"
                      placeholder="All statuses"
                      clearable
                      data={ODEX_STATUS_SELECT_OPTIONS}
                      value={draftFilters.status || null}
                      onChange={(v) =>
                        setDraftFilters((p) => ({ ...p, status: v ?? "" }))
                      }
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Select
                      size="xs"
                      label="ODEX Type"
                      placeholder="All types"
                      clearable
                      data={ODEX_JOB_TYPES.map((t) => ({
                        value: t.value,
                        label: t.label,
                      }))}
                      value={draftFilters.odex_type || null}
                      onChange={(v) =>
                        setDraftFilters((p) => ({ ...p, odex_type: v ?? "" }))
                      }
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Created From"
                      size="xs"
                      value={draftFilters.date_from}
                      onChange={(v) =>
                        setDraftFilters((p) => ({ ...p, date_from: v }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Created To"
                      size="xs"
                      value={draftFilters.date_to}
                      onChange={(v) =>
                        setDraftFilters((p) => ({ ...p, date_to: v }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
              </Grid>
            ),
          }}
          table={{
            footer: (
              <ERPListPaginationFooter
                theme={theme}
                totalRecords={totalRecords}
                pageIndex={pageIndex}
                pageSize={pageSize}
                onPageIndexChange={setPageIndex}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPageIndex(0);
                }}
                selectClassNames={erpListGeistSelectClassNames}
                pageSizeOptions={["10", "20", "25", "50"]}
              />
            ),
            children: (
              <Box style={{ position: "relative", flex: 1, minHeight: 0 }}>
                <table style={erpListBookingMasterTableStyle(theme)}>
                  <thead>
                    <tr>
                      <th style={mergeTh(120)}>Job Ref</th>
                      <th style={mergeTh(120)}>ODEX Type</th>
                      <th style={mergeTh(120)}>Status</th>
                      <th style={mergeTh(140)}>Progress</th>
                      <th style={mergeTh(100)}>Filled Fields</th>
                      <th style={mergeTh(120)}>Screenshots</th>
                      <th style={mergeTh(140)}>Started</th>
                      <th style={mergeTh(140)}>Completed</th>
                      <th style={mergeTh(200)}>Last Activity</th>
                      <th
                        style={{
                          ...erpListStickyActionThStyle(theme, 80),
                          minHeight: 52.4,
                          height: 52.4,
                          verticalAlign: "middle",
                          boxSizing: "border-box",
                        }}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {error ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 48, textAlign: "center" }}>
                          <Text c="red" size="sm" style={{ fontFamily: theme.fontSans }}>
                            Failed to load ODEX jobs. Try refresh.
                          </Text>
                        </td>
                      </tr>
                    ) : tableLoading ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 80, textAlign: "center" }}>
                          <Center>
                            <Stack align="center" gap="sm">
                              <Loader size="lg" color={primary} />
                              <Text c="dimmed" size="sm" style={{ fontFamily: theme.fontSans }}>
                                Loading ODEX jobs…
                              </Text>
                            </Stack>
                          </Center>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 60, textAlign: "center" }}>
                          <Stack align="center" gap="md">
                            <Box
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                backgroundColor: ERP_LIST_BOOKING_MASTER_EMPTY_ICON_BG,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconAutomation size={24} color={muted} />
                            </Box>
                            <Box>
                              <Text fw={500} c={fg} style={{ fontFamily: theme.fontSans }}>
                                No ODEX jobs yet
                              </Text>
                              <Text size="sm" c={muted} mt={4} style={{ fontFamily: theme.fontSans }}>
                                Try adjusting your search or filters
                              </Text>
                              <Button
                                mt="md"
                                size="xs"
                                styles={erpToolbarPrimaryButtonStyles(theme)}
                                component={Link}
                                to="/SeaExport/import-job"
                              >
                                Go to Job Create
                              </Button>
                            </Box>
                          </Stack>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const rowProps = erpListDataRowProps(theme);
                        const tdPad = erpListBookingMasterBodyTd();
                        const tdDate = erpListBookingMasterDateTd(theme);
                        const refShell = erpListBookingMasterReferenceTdShell(theme);

                        return (
                          <tr key={String(row.id)} {...rowProps}>
                            <td style={refShell}>
                              {row.consol_job_id ? (
                                <Anchor
                                  component={Link}
                                  to={CONSOL_IMPORT_JOB_EDIT_PATH}
                                  state={{ job: { id: row.consol_job_id } }}
                                  c={primary}
                                  size="sm"
                                  style={{ fontFamily: theme.fontSans }}
                                >
                                  {row.job_ref || "—"}
                                </Anchor>
                              ) : (
                                <Text size="sm" style={{ fontFamily: theme.fontSans }}>
                                  {row.job_ref || "—"}
                                </Text>
                              )}
                            </td>
                            <td style={tdPad}>
                              <Badge variant="outline" color={primary}>
                                {row.odex_type}
                              </Badge>
                            </td>
                            <td style={tdPad}>
                              <OdexStatusBadge status={row.status} />
                            </td>
                            <td style={{ ...tdPad, minWidth: 120 }}>
                              {row.status === "completed" ? (
                                <Text size="sm" c={muted}>
                                  —
                                </Text>
                              ) : row.progress_percentage != null ? (
                                <Progress
                                  value={row.progress_percentage}
                                  size="sm"
                                  color={primary}
                                />
                              ) : (
                                <Text size="sm" c={muted}>
                                  —
                                </Text>
                              )}
                            </td>
                            <td style={tdPad}>{row.filled_fields_count ?? "—"}</td>
                            <td style={tdPad}>
                              <Group gap="xs" wrap="nowrap">
                                <Text size="sm">{row.screenshot_count ?? 0}</Text>
                                {row.thumbnail_url ? (
                                  <Avatar
                                    src={row.thumbnail_url}
                                    size="sm"
                                    radius="sm"
                                  />
                                ) : null}
                              </Group>
                            </td>
                            <td style={tdDate}>
                              {row.started_at ? formatDateTime(row.started_at) : "—"}
                            </td>
                            <td style={tdDate}>
                              {row.completed_at
                                ? formatDateTime(row.completed_at)
                                : "—"}
                            </td>
                            <td style={{ ...tdPad, maxWidth: 200 }}>
                              <Text
                                size="sm"
                                truncate="end"
                                title={row.last_log ?? ""}
                                style={{ fontFamily: theme.fontSans }}
                              >
                                {row.last_log || "—"}
                              </Text>
                            </td>
                            <td style={erpListStickyActionTdStyle(theme, 80)}>
                              <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray" size="sm">
                                    <IconDotsVertical size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown className={ERP_LIST_GEIST_ROOT_CLASS}>
                                  <Menu.Item
                                    leftSection={<IconArrowRight size={14} />}
                                    onClick={() => navigate(odexJobDetailPath(row.id))}
                                  >
                                    View Details
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Box>
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}
