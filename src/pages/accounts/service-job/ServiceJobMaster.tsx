import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MRT_PaginationState } from "mantine-react-table";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  MantineProvider,
  Modal,
  Select,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconBriefcase,
  IconCircleCheck,
  IconClock,
  IconFilter,
  IconPlus,
  IconSearch,
  IconStack2,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { apiCallProtected } from "../../../api/axios";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import {
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListJobStatusPill,
  ToastNotification,
  SearchableSelect,
  SingleDateInput,
  Dropdown,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  erpToolbarSelectStyles,
  erpListThStyle,
  erpListDataRowProps,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListBookingMasterDateTd,
  ERP_LIST_GEIST_MONO_CLASS,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
import { ERPListJobActionMenu } from "../../../components/JobList/ERPListJobActionMenu";
import { useListFilterStore } from "../../../store/listFilterStore";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import { formatDisplayJobId } from "../../../utils/displayJobId";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";

const LIST_KEY = "SERVICE_JOB_MASTER";

function readListAwbFromRow(row: Record<string, unknown>): string {
  const housing = Array.isArray(row.housing_details)
    ? (row.housing_details[0] as Record<string, unknown> | undefined)
    : undefined;
  return String(
    row.mawb_no ??
      row.mbl_number ??
      row.mawb_number ??
      housing?.hawb_no ??
      housing?.hbl_number ??
      "",
  );
}

type ServiceJobRow = {
  id: number;
  job_id?: string;
  service_id?: number;
  service_code?: string;
  service_name?: string;
  service?: string;
  shipper_name?: string;
  origin_code?: string;
  origin_name?: string;
  destination_code?: string;
  destination_name?: string;
  etd?: string;
  eta?: string;
  status?: string;
  housing_details?: Array<{ routed_by?: string }>;
};

type ServiceJobFilters = {
  job_id: string;
  shipper_name: string;
  origin_code: string;
  origin_port_label: string;
  destination_code: string;
  destination_name: string;
  awb_number: string;
  etd: string;
  eta: string;
  status: string;
};

const DEFAULT_FILTERS: ServiceJobFilters = {
  job_id: "",
  shipper_name: "",
  origin_code: "",
  origin_port_label: "",
  destination_code: "",
  destination_name: "",
  awb_number: "",
  etd: "",
  eta: "",
  status: "",
};

export default function ServiceJobMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = DEFAULT_ERP_LIST_THEME;
  const filterFieldStyles = erpListFilterUnifiedMantineStyles(theme);
  const dateFormat = useDateFormat();
  const { muted, fg } = theme;

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<ServiceJobFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ServiceJobFilters>(DEFAULT_FILTERS);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [cancelConfirmRow, setCancelConfirmRow] = useState<ServiceJobRow | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const isRefreshingFromEdit = useRef(false);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;
    setIsInitialLoad(true);

    if (!shouldRestore) {
      setIsRestoring(false);
      setIsInitialLoad(false);
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
    setIsInitialLoad(false);
  }, [location.key, clearAllExcept, getState, setShouldRestore]);

  const pageIndex = pagination.pageIndex;
  const pageSize = pagination.pageSize;
  const index = pageIndex * pageSize;

  const buildFiltersPayload = useCallback(
    (filters: ServiceJobFilters, searchValue: string) => {
      const cleaned: Record<string, string | boolean> = {
        is_service_job: true,
      };
      if (filters.job_id?.trim()) cleaned.job_id = filters.job_id.trim();
      if (filters.shipper_name?.trim())
        cleaned.shipper_name = filters.shipper_name.trim();
      if (filters.origin_code?.trim())
        cleaned.origin_code = filters.origin_code.trim();
      if (filters.destination_code?.trim())
        cleaned.destination_code = filters.destination_code.trim();
      if (filters.awb_number?.trim())
        cleaned.mawb_no = filters.awb_number.trim();
      if (filters.etd?.trim()) cleaned.etd = filters.etd.trim();
      if (filters.eta?.trim()) cleaned.eta = filters.eta.trim();
      if (filters.status?.trim())
        cleaned.status = filters.status.trim().toUpperCase();
      if (searchValue?.trim()) cleaned.search = searchValue.trim();
      return cleaned;
    },
    [],
  );

  const persistFiltersToStore = useCallback(
    (filters: ServiceJobFilters, searchValue: string) => {
      setStoreFilters(LIST_KEY, filters);
      setStoreSearch(LIST_KEY, searchValue);
    },
    [setStoreFilters, setStoreSearch],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "serviceJobs",
      pageIndex,
      pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
      setIsInitialLoad(false);
      const response = (await apiCallProtected.post(
        `${URL.filterJobCreate}?index=${index}&limit=${pageSize}`,
        { filters: filtersPayload },
        API_HEADER,
      )) as Record<string, unknown>;

      const list = Array.isArray(response?.data)
        ? (response.data as ServiceJobRow[])
        : [];
      const listTotal = getBookingShipmentFilterListTotal(response, list, index);
      setTotalRecords(listTotal);
      return { data: list, total: listTotal };
    },
    enabled: !isRestoring,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const rows = listResult?.data ?? [];

  useEffect(() => {
    if (
      (location.state as { refreshData?: boolean } | null)?.refreshData &&
      !isRefreshingFromEdit.current
    ) {
      isRefreshingFromEdit.current = true;
      void refetch().finally(() => {
        isRefreshingFromEdit.current = false;
        navigate(location.pathname, { replace: true, state: {} });
      });
    }
  }, [location.pathname, location.state, navigate, refetch]);

  const persistListAndNavigate = useCallback(
    (path: string, state?: Record<string, unknown>) => {
      persistFiltersToStore(appliedFilters, search);
      setShouldRestore(LIST_KEY, true);
      navigate(path, { state });
    },
    [appliedFilters, navigate, persistFiltersToStore, search, setShouldRestore],
  );

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    persistFiltersToStore(draftFilters, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const fmtDate = useCallback(
    (value: string | null | undefined) => {
      if (!value) return "—";
      const d = dayjs(value);
      return d.isValid() ? d.format(dateFormat) : value;
    },
    [dateFormat],
  );

  const tableColumns = [
    "S.No",
    "Job ID",
    "Service",
    "Customer",
    "Route",
    "AWB",
    "Routed By",
    "ETD",
    "ETA",
    "Status",
  ] as const;

  const handleConfirmCancel = async () => {
    if (!cancelConfirmRow) return;
    setIsCancelling(true);
    try {
      const response = (await apiCallProtected.patch(
        `${URL.jobCreate}${cancelConfirmRow.id}/`,
        { status: "CANCEL", is_service_job: true },
        API_HEADER,
      )) as { status?: boolean; message?: string };
      if (response?.status === false) {
        throw new Error(response?.message || "Failed to cancel job");
      }
      setCancelConfirmRow(null);
      ToastNotification({
        type: "success",
        message: "Service job cancelled successfully",
      });
      await refetch();
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel job",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const stats = useMemo(() => {
    return {
      total: totalRecords,
      active: rows.filter((r) => (r.status ?? "").toUpperCase() === "ACTIVE")
        .length,
      closed: rows.filter((r) => (r.status ?? "").toUpperCase() === "CLOSED")
        .length,
      cancel: rows.filter((r) => (r.status ?? "").toUpperCase() === "CANCEL")
        .length,
    };
  }, [rows, totalRecords]);

  const loading = isLoading || isFetching || isInitialLoad;
  const tdPad = { padding: "10px 12px" as const };
  const tdDate = erpListBookingMasterDateTd(theme);

  return (
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box className={ERP_LIST_GEIST_ROOT_CLASS} style={erpListGeistRootTypography}>
        <ERPListScreen
          theme={theme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={theme}
                  icon={<IconStack2 size={14} color={theme.primary} />}
                  iconBackground="#E7F5FF"
                  iconColor={theme.primary}
                  value={stats.total}
                  label="Total"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconBriefcase size={14} color="#16a34a" />}
                  iconBackground="#dcfce7"
                  iconColor="#16a34a"
                  value={stats.active}
                  label="Active"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconCircleCheck size={14} color="#2563eb" />}
                  iconBackground="#dbeafe"
                  iconColor="#2563eb"
                  value={stats.closed}
                  label="Closed"
                />
                <ERPListStatPill
                  theme={theme}
                  icon={<IconClock size={14} color="#dc2626" />}
                  iconBackground="#fee2e2"
                  iconColor="#dc2626"
                  value={stats.cancel}
                  label="Cancel"
                />
              </>
            ),
            secondary: (
              <Group gap={8} wrap="nowrap" align="center">
                <IconBriefcase size={16} color={muted} />
                <Text fw={600} size="sm" c={fg}>
                  {totalRecords.toLocaleString()}
                </Text>
                <Text size="xs" c={muted}>
                  service jobs
                </Text>
              </Group>
            ),
            actions: (
              <>
                <TextInput
                  size="xs"
                  w={220}
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  leftSection={<IconSearch size={14} />}
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                />
                <Select
                  size="xs"
                  w={130}
                  value={appliedFilters.status?.trim() ? appliedFilters.status : "all"}
                  onChange={(v) => {
                    const status = !v || v === "all" ? "" : v;
                    const next = { ...appliedFilters, status };
                    setDraftFilters(next);
                    setAppliedFilters(next);
                    persistFiltersToStore(next, search);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  data={[
                    { value: "all", label: "All Status" },
                    { value: "Active", label: "Active" },
                    { value: "Closed", label: "Closed" },
                    { value: "Cancel", label: "Cancel" },
                  ]}
                  classNames={erpListGeistSelectClassNames}
                  styles={erpToolbarSelectStyles(theme)}
                />
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
                  onClick={() => {
                    persistFiltersToStore(appliedFilters, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/service-job/create");
                  }}
                >
                  Create Service Job
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Refine service jobs",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={theme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={loading}
                applyDisabled={loading}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Job ID"
                      placeholder="Type Job ID"
                      size="xs"
                      styles={filterFieldStyles}
                      value={draftFilters.job_id}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          job_id: e.currentTarget.value,
                        }))
                      }
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Customer"
                      placeholder="Type customer name"
                      size="xs"
                      styles={filterFieldStyles}
                      value={draftFilters.shipper_name}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          shipper_name: e.currentTarget.value,
                        }))
                      }
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      size="xs"
                      label="Origin"
                      placeholder="Type origin code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={draftFilters.origin_code}
                      displayValue={draftFilters.origin_port_label}
                      onChange={(value, selectedData) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          origin_code: value || "",
                          origin_port_label: selectedData?.label || "",
                        }));
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      size="xs"
                      label="Destination"
                      placeholder="Type destination code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={draftFilters.destination_code}
                      displayValue={draftFilters.destination_name}
                      onChange={(value, selectedData) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          destination_code: value || "",
                          destination_name: selectedData?.label || "",
                        }));
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="AWB / BL Number"
                      placeholder="Type AWB or BL number"
                      size="xs"
                      styles={filterFieldStyles}
                      value={draftFilters.awb_number}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          awb_number: e.currentTarget.value,
                        }))
                      }
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="ETD"
                      size="xs"
                      value={
                        draftFilters.etd ? dayjs(draftFilters.etd).toDate() : null
                      }
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          etd: date ? dayjs(date).format("YYYY-MM-DD") : "",
                        }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="ETA"
                      size="xs"
                      value={
                        draftFilters.eta ? dayjs(draftFilters.eta).toDate() : null
                      }
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          eta: date ? dayjs(date).format("YYYY-MM-DD") : "",
                        }))
                      }
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Dropdown
                      label="Status"
                      placeholder="Select status"
                      size="xs"
                      searchable
                      clearable
                      data={[
                        { value: "Active", label: "Active" },
                        { value: "Closed", label: "Closed" },
                        { value: "Cancel", label: "Cancel" },
                      ]}
                      value={draftFilters.status || null}
                      onChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          status: value || "",
                        }))
                      }
                      styles={filterFieldStyles}
                      classNames={{
                        label: ERP_LIST_GEIST_ROOT_CLASS,
                        input: ERP_LIST_GEIST_ROOT_CLASS,
                        dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                        option: ERP_LIST_GEIST_ROOT_CLASS,
                      }}
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
                pageIndex={pageIndex}
                pageSize={pageSize}
                totalRecords={totalRecords}
                onPageIndexChange={(idx) =>
                  setPagination((p) => ({ ...p, pageIndex: idx }))
                }
                onPageSizeChange={(size) =>
                  setPagination({ pageIndex: 0, pageSize: size })
                }
              />
            ),
            children: loading ? (
              <Center py="xl">
                <Loader color="#105476" size="lg" />
              </Center>
            ) : (
              <Box style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {tableColumns.map((h) => (
                        <th key={h} style={erpListThStyle(theme)}>
                          {h}
                        </th>
                      ))}
                      <th style={erpListStickyActionThStyle(theme, 96)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumns.length + 1} style={tdPad}>
                          <Center py="xl">
                            <Text c="dimmed">No service jobs found</Text>
                          </Center>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => {
                        const route = `${row.origin_code || row.origin_name || "—"} → ${row.destination_code || row.destination_name || "—"}`;
                        const routedBy =
                          row.housing_details?.[0]?.routed_by || "—";
                        const statusUpper = (row.status ?? "").toUpperCase();
                        const isCancel = statusUpper === "CANCEL";
                        const canCancel =
                          statusUpper !== "GENERATED" && !isCancel;

                        return (
                          <tr key={row.id} {...erpListDataRowProps(theme)}>
                            <td style={tdPad}>
                              <Text size="sm" c={muted}>
                                {index + idx + 1}
                              </Text>
                            </td>
                            <td style={tdPad}>
                              <Text fw={600} size="sm" c={fg}>
                                {formatDisplayJobId(row.job_id, row.service_code) ||
                                  "—"}
                              </Text>
                            </td>
                            <td style={tdPad}>
                              <Text size="sm" fw={600} c={fg}>
                                {row.service_name || row.service || "—"}
                              </Text>
                            </td>
                            <td style={tdPad}>
                              <Text size="sm" c={fg}>
                                {row.shipper_name || "—"}
                              </Text>
                            </td>
                            <td style={tdPad}>
                              <Group gap={4} wrap="nowrap">
                                <Text size="sm" c={fg}>
                                  {route}
                                </Text>
                              </Group>
                            </td>
                            <td
                              className={ERP_LIST_GEIST_MONO_CLASS}
                              style={tdPad}
                            >
                              <Text size="xs" fw={500} c={fg}>
                                {readListAwbFromRow(
                                  row as Record<string, unknown>,
                                ) || "—"}
                              </Text>
                            </td>
                            <td style={tdPad}>
                              <Text size="sm" c={fg}>
                                {routedBy}
                              </Text>
                            </td>
                            <td style={tdDate}>{fmtDate(row.etd)}</td>
                            <td style={tdDate}>{fmtDate(row.eta)}</td>
                            <td style={tdPad}>
                              <ERPListJobStatusPill status={row.status} />
                            </td>
                            <td style={erpListStickyActionTdStyle(theme)}>
                              <ERPListJobActionMenu
                                status={row.status}
                                variant="job-page"
                                canCancel={canCancel}
                                onEdit={() =>
                                  persistListAndNavigate(
                                    `/service-job/edit/${row.id}`,
                                    { job: row },
                                  )
                                }
                                onCancel={() => setCancelConfirmRow(row)}
                              />
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

        <Modal
          opened={!!cancelConfirmRow}
          onClose={() => !isCancelling && setCancelConfirmRow(null)}
          title={
            <Text fw={600} size="md">
              Cancel service job
            </Text>
          }
          centered
          classNames={{ content: ERP_LIST_GEIST_ROOT_CLASS }}
        >
          <Text size="sm" c="dimmed" mb="md">
            Are you sure you want to cancel this service job? This action cannot
            be undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              onClick={() => setCancelConfirmRow(null)}
              disabled={isCancelling}
            >
              No
            </Button>
            <Button
              color="red"
              onClick={handleConfirmCancel}
              loading={isCancelling}
            >
              Yes, cancel
            </Button>
          </Group>
        </Modal>
      </Box>
    </MantineProvider>
  );
}
