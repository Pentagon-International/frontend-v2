import { useMemo, useState, useEffect, useRef } from "react";
import {
  Button,
  Group,
  Text,
  ActionIcon,
  Menu,
  UnstyledButton,
  Modal,
  Divider,
  Badge,
  Table,
  Box,
  Stack,
  Grid,
  MantineProvider,
  Select,
  TextInput,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconCirclePlus,
  IconPackage,
  IconStack2,
  IconCircleCheck,
  IconClock,
  IconX,
  IconSearch,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useListFilterStore } from "../../store/listFilterStore";
import { postAPICall } from "../../service/postApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import {
  ToastNotification,
  ERPListColumnToggleMenu,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  DEFAULT_ERP_LIST_THEME,
  erpListGeistMantineTheme,
  ERP_LIST_GEIST_ROOT_CLASS,
  erpListGeistRootTypography,
  erpListGeistMenuDropdownStyles,
  erpListGeistSelectClassNames,
  erpToolbarSelectStyles,
  erpListTableElementStyle,
  erpListThStyle,
  erpListTdCellToneStyle,
  erpListDataRowProps,
  erpListStickyActionThStyle,
  erpListStickyActionTdStyle,
} from "../../components";
import { ERP_LIST_GEIST_MONO_CLASS } from "../../components/ERPListPage";
import useDateFormat from "../../hooks/useDateFormat";
import dayjs from "dayjs";
import { getBookingShipmentFilterListTotal } from "../../utils/bookingShipmentFilterListTotal";

type ImportToExportBookingData = {
  id: number;
  shipment_code: string;
  date: string;
  service: string;
  customer_name: string;
  customer_code_read: string;
  origin_name: string;
  origin_code_read: string;
  destination_name: string;
  destination_code_read: string;
  customer_service_name: string;
  freight?: string;
  routed?: string;
  routed_by?: string;
  shipment_terms_name?: string;
  shipment_terms_code_read?: string;
  carrier_name?: string;
  eta?: string;
  etd?: string;
  vessel_name?: string;
  voyage_no?: string;
  shipper_name?: string;
  consignee_name?: string;
  forwarder_name?: string;
  destination_agent_name?: string;
  billing_customer_name?: string;
  notify_customer_name?: string;
  cha_name?: string;
  is_hazardous?: boolean;
  commodity_description?: string | null;
  marks_no?: string | null;
  pickup_location?: string;
  pickup_from_name?: string;
  planned_pickup_date?: string;
  transporter_name?: string;
  delivery_location?: string;
  delivery_from_name?: string;
  planned_delivery_date?: string;
  created_by_name?: string;
  is_direct?: boolean;
  is_coload?: boolean;
  cargo_details?: Array<{
    id: number;
    container_type_name: string;
    no_of_containers: number;
    gross_weight: string;
  }>;
  routing_details?: Array<{
    move_type: string;
    etd: string;
    eta: string;
    flight_no: string;
    status: string;
    from_location_name: string;
    to_location_name: string;
    carrier_name: string;
  }>;
  rate_details?: Array<{
    id: number;
    quotation_no: string;
    charge_name: string;
    pp_cc: string;
    no_of_unit: number;
    sell_amount_total: number | null;
  }>;
};

type VisibleColumnsState = {
  booking: boolean;
  date: boolean;
  service: boolean;
  customer: boolean;
  origin: boolean;
  destination: boolean;
  customer_service: boolean;
};

/** `summary` on `customerServiceShipmentFilter` (totals are filter-scoped). */
type ImportToExportListSummary = {
  status_counts?: {
    active?: number;
    closed?: number;
    cancel?: number;
  };
};

type ImportToExportListQueryResult = {
  data: ImportToExportBookingData[];
  total: number;
  summary?: ImportToExportListSummary;
};

const LIST_KEY = "AIR_IMPORT_TO_EXPORT_BOOKING";

type PersistedI2EFilters = {
  statusFilter: string;
  pageIndex: number;
  pageSize: number;
};

function AirImportToExportBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const theme = DEFAULT_ERP_LIST_THEME;
  const { muted, fg, primary, headerBg, fontSans } = theme;

  const getStoreState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<ImportToExportBookingData | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>({
    booking: true,
    date: true,
    service: true,
    customer: true,
    origin: true,
    destination: true,
    customer_service: true,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [isRestoring, setIsRestoring] = useState(true);

  const dateFormat = useDateFormat();

  // Restore state from global store on mount
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const stored = getStoreState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }
    const f = stored?.filters as PersistedI2EFilters | undefined;
    if (f && typeof f === "object") {
      if (typeof f.statusFilter === "string") setStatusFilter(f.statusFilter);
      if (typeof f.pageIndex === "number" && f.pageIndex >= 0) setPageIndex(f.pageIndex);
      if (typeof f.pageSize === "number" && f.pageSize > 0) setPageSize(f.pageSize);
    }

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const { data: listResponse, isLoading, isFetching, error } = useQuery<ImportToExportListQueryResult>({
    queryKey: ["import-to-export-bookings", statusFilter, pageIndex, pageSize, debouncedSearch],
    enabled: !isRestoring && search === debouncedSearch,
    queryFn: async (): Promise<ImportToExportListQueryResult> => {
      try {
        const offset = pageIndex * pageSize;
        const trimmedSearch = debouncedSearch.trim();
        const payload = {
          filters: {
            import_to_export: true,
            service: "AIR",
            // reference: statusFilter === "completed",
            ...(trimmedSearch ? { search: trimmedSearch } : {}),
          },
        };

        const response = (await postAPICall(
          `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`,
          payload,
          API_HEADER
        )) as Record<string, unknown>;

        const list: ImportToExportBookingData[] = Array.isArray(response.data)
          ? (response.data as ImportToExportBookingData[])
          : [];

        const total = getBookingShipmentFilterListTotal(response, list, offset);
        setTotalRecords(total);

        const rawSummary = response?.summary;
        const summary: ImportToExportListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? (rawSummary as ImportToExportListSummary)
            : undefined;

        return { data: list, total, summary };
      } catch {
        setTotalRecords(0);
        return { data: [], total: 0, summary: undefined };
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const displayData: ImportToExportBookingData[] = listResponse?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const maxPageIndex = totalPages - 1;
    if (pageIndex > maxPageIndex) {
      setPageIndex(maxPageIndex);
    }
  }, [totalRecords, pageSize, pageIndex]);

  // Reset to first page whenever the search term changes (after debounce).
  // Skip the initial value (and any restore-driven update) so we don't clobber a restored pageIndex.
  const lastDebouncedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (isRestoring) return;
    if (lastDebouncedSearchRef.current === null) {
      lastDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (lastDebouncedSearchRef.current === debouncedSearch) return;
    lastDebouncedSearchRef.current = debouncedSearch;
    setPageIndex(0);
  }, [debouncedSearch, isRestoring]);

  const listSummary = listResponse?.summary;
  const stats = useMemo(() => {
    const sc = listSummary?.status_counts;
    if (sc) {
      return {
        total: totalRecords,
        active: sc.active ?? 0,
        closed: sc.closed ?? 0,
        cancel: sc.cancel ?? 0,
      };
    }
    return {
      total: totalRecords,
      active: 0,
      closed: 0,
      cancel: 0,
    };
  }, [listSummary, totalRecords]);

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof VisibleColumnsState)[]).map((key) => ({
        id: String(key),
        label: String(key).replace(/_/g, " "),
        checked: visibleColumns[key],
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
          })),
      })),
    [visibleColumns],
  );

  const handlePageSizeChange = (size: number) => {
    setPageIndex(0);
    setPageSize(size);
  };

  const handleConfirmCreateExport = async () => {
    if (!selectedBooking) return;
    try {
      const payload = {
        service_type: "EXPORT",
        import_to_export: false,
        // reference: selectedBooking.id || "",
      };

      setConfirmModalOpened(false);
      setSelectedBooking(null);

      await postAPICall(URL.customerServiceShipment, payload, API_HEADER);

      ToastNotification({
        message: "Export booking created successfully from import booking!",
        type: "success",
      });

      await queryClient.invalidateQueries({
        queryKey: ["import-to-export-bookings"],
      });

      // Preserve list state so this page restores when the user comes back.
      setStoreFilters(LIST_KEY, {
        statusFilter,
        pageIndex,
        pageSize,
      });
      setStoreSearch(LIST_KEY, search);
      setShouldRestore(LIST_KEY, true);

      navigate("/air/export-booking", {
        state: { refreshData: true },
      });
    } catch {
      ToastNotification({
        message: "Failed to create export shipment. Please try again.",
        type: "error",
      });
    }
  };

  const visibleDataColumnCount =
    (Object.keys(visibleColumns) as (keyof VisibleColumnsState)[]).filter(
      (k) => visibleColumns[k],
    ).length + (statusFilter === "pending" ? 1 : 0);

  return (
    <>
      <Modal
        opened={confirmModalOpened}
        onClose={() => setConfirmModalOpened(false)}
        title={
          <Text fw={600} size="lg" c={primary} style={{ fontFamily: fontSans }}>
            Confirm to Create Export Shipment
          </Text>
        }
        size="xl"
        centered
        radius="md"
        zIndex={400}
        classNames={{
          content: ERP_LIST_GEIST_ROOT_CLASS,
          body: ERP_LIST_GEIST_ROOT_CLASS,
          header: ERP_LIST_GEIST_ROOT_CLASS,
        }}
        styles={{
          header: {
            fontFamily: fontSans,
            backgroundColor: headerBg,
            borderBottom: `2px solid ${primary}`,
            paddingBottom: "12px",
          },
          body: {
            fontFamily: fontSans,
            padding: "24px",
          },
        }}
      >
        {selectedBooking && (
          <Stack gap="lg">
            {/* Basic Information */}
            <Box>
              <Text size="sm" fw={600} c="#105476" mb="xs">
                Shipment Information
              </Text>
              <Divider mb="sm" />
              <Grid gutter="xs">
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Booking ID:
                    </Text>
                    <Text
                      size="sm"
                      fw={600}
                      c={primary}
                      className={ERP_LIST_GEIST_MONO_CLASS}
                      style={{ letterSpacing: "0.5px" }}
                    >
                      {selectedBooking.shipment_code}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Date:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.date}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Service:
                    </Text>
                    <Badge variant="filled" color="teal" size="sm">
                      {selectedBooking.service}
                    </Badge>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Customer Service:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.customer_service_name}
                    </Text>
                  </Group>
                </Grid.Col>
              </Grid>
            </Box>

            {/* Customer & Route Information */}
            <Box>
              <Text size="sm" fw={600} c="#105476" mb="xs">
                Customer & Route Details
              </Text>
              <Divider mb="sm" />
              <Grid gutter="xs">
                <Grid.Col span={12}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Customer:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.customer_name}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Origin:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.origin_name}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" fw={500}>
                      Destination:
                    </Text>
                    <Text size="xs" fw={500}>
                      {selectedBooking.destination_name}
                    </Text>
                  </Group>
                </Grid.Col>
                {selectedBooking.shipment_terms_name && (
                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" fw={500}>
                        Shipment Terms:
                      </Text>
                      <Text size="xs" fw={500}>
                        {selectedBooking.shipment_terms_name}
                      </Text>
                    </Group>
                  </Grid.Col>
                )}
                {selectedBooking.freight && (
                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" fw={500}>
                        Freight:
                      </Text>
                      <Badge variant="light" color="cyan" size="sm">
                        {selectedBooking.freight}
                      </Badge>
                    </Group>
                  </Grid.Col>
                )}
              </Grid>
            </Box>

            {/* Party Details */}
            {(selectedBooking.shipper_name ||
              selectedBooking.consignee_name ||
              selectedBooking.forwarder_name ||
              selectedBooking.notify_customer_name) && (
              <Box>
                <Text size="sm" fw={600} c="#105476" mb="xs">
                  Party Details
                </Text>
                <Divider mb="sm" />
                <Grid gutter="xs">
                  {selectedBooking.shipper_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Shipper:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.shipper_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.consignee_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Consignee:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.consignee_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.forwarder_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Forwarder:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.forwarder_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.notify_customer_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Notify Party:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.notify_customer_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.billing_customer_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Billing Customer:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.billing_customer_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.cha_name && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          CHA:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.cha_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                </Grid>
              </Box>
            )}

            {/* Cargo Details */}
            {selectedBooking.cargo_details &&
              selectedBooking.cargo_details.length > 0 && (
                <Box>
                  <Text size="sm" fw={600} c="#105476" mb="xs">
                    Cargo Details
                  </Text>
                  <Divider mb="sm" />
                  <Table
                    striped
                    highlightOnHover
                    withTableBorder
                    withColumnBorders
                    styles={{
                      table: { fontSize: "12px" },
                      th: {
                        backgroundColor: "#f8f9fa",
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#495057",
                      },
                      td: { padding: "6px 8px" },
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Container Type</Table.Th>
                        <Table.Th>No. of Containers</Table.Th>
                        <Table.Th>Gross Weight (kg)</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {selectedBooking.cargo_details.map((cargo, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>{cargo.container_type_name}</Table.Td>
                          <Table.Td>{cargo.no_of_containers}</Table.Td>
                          <Table.Td>{cargo.gross_weight}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              )}

            {/* Pickup & Delivery Information */}
            {(selectedBooking.pickup_location ||
              selectedBooking.delivery_location) && (
              <Box>
                <Text size="sm" fw={600} c="#105476" mb="xs">
                  Pickup & Delivery Details
                </Text>
                <Divider mb="sm" />
                <Grid gutter="xs">
                  {selectedBooking.pickup_location && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Pickup Location:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.pickup_location}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.planned_pickup_date && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Planned Pickup:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.planned_pickup_date}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.delivery_location && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Delivery Location:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.delivery_location}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.planned_delivery_date && (
                    <Grid.Col span={6}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Planned Delivery:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.planned_delivery_date}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                  {selectedBooking.transporter_name && (
                    <Grid.Col span={12}>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" fw={500}>
                          Transporter:
                        </Text>
                        <Text size="xs" fw={500}>
                          {selectedBooking.transporter_name}
                        </Text>
                      </Group>
                    </Grid.Col>
                  )}
                </Grid>
              </Box>
            )}

            {/* Action Buttons */}
            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => setConfirmModalOpened(false)}
              >
                Cancel
              </Button>
              <Button
                variant="filled"
                color="#105476"
                onClick={handleConfirmCreateExport}
              >
                Confirm & Create Export
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <MantineProvider theme={erpListGeistMantineTheme}>
        <Box className={ERP_LIST_GEIST_ROOT_CLASS} style={erpListGeistRootTypography}>
          <ERPListScreen
            theme={theme}
            toolbar={{
              leading: (
                <>
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconPackage size={14} color={primary} />}
                    value={stats.total}
                    label="Total"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconCircleCheck size={14} color="#059669" />}
                    iconBackground="#d1fae5"
                    iconColor="#059669"
                    value={stats.active}
                    label="Active"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconClock size={14} color="#2563eb" />}
                    iconBackground="#dbeafe"
                    iconColor="#2563eb"
                    value={stats.closed}
                    label="Closed"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconX size={14} color="#dc2626" />}
                    iconBackground="#fee2e2"
                    iconColor="#dc2626"
                    value={stats.cancel}
                    label="Cancel"
                  />
                </>
              ),
              secondary: (
                <Group gap={8} wrap="nowrap" align="center">
                  <IconStack2 size={16} color={muted} style={{ flexShrink: 0 }} />
                  <Text fw={600} size="sm" c={fg} component="span">
                    {displayData.length}
                  </Text>

                </Group>
              ),
              actions: (
                <>
                  <TextInput
                    size="xs"
                    w={220}
                    placeholder="Search..."
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
                  <Select
                    size="xs"
                    w={140}
                    value={statusFilter}
                    onChange={(v) => {
                      const next = v === "completed" ? "completed" : "pending";
                      setStatusFilter(next);
                      setPageIndex(0);
                      setStoreFilters(LIST_KEY, {
                        statusFilter: next,
                        pageIndex: 0,
                        pageSize,
                      });
                      setStoreSearch(LIST_KEY, search);
                    }}
                    data={[
                      { value: "pending", label: "Pending" },
                      { value: "completed", label: "Completed" },
                    ]}
                    classNames={erpListGeistSelectClassNames}
                    styles={erpToolbarSelectStyles(theme)}
                  />
                  <ERPListColumnToggleMenu
                    theme={theme}
                    items={columnToggleItems}
                    menuStyles={erpListGeistMenuDropdownStyles}
                    classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                  />
                </>
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
                  onPageSizeChange={handlePageSizeChange}
                  selectClassNames={erpListGeistSelectClassNames}
                  pageSizeOptions={["10", "25", "50"]}
                />
              ),
              children: error ? (
                <Box px="md" py={48} style={{ textAlign: "center" }}>
                  <Text c="red" size="sm" style={{ fontFamily: fontSans }}>
                    Error loading import-to-export bookings. Please try again.
                  </Text>
                </Box>
              ) : isRestoring || isLoading || isFetching ? (
                <ERPListTableLoading
                  theme={theme}
                  message="Loading import-to-export bookings…"
                />
              ) : (
                <table style={erpListTableElementStyle(theme)}>
                  <thead>
                    <tr>
                      {visibleColumns.booking && (
                        <th style={erpListThStyle(theme)}>Booking ID</th>
                      )}
                      {visibleColumns.date && (
                        <th style={erpListThStyle(theme)}>Date</th>
                      )}
                      {visibleColumns.service && (
                        <th style={erpListThStyle(theme)}>Service</th>
                      )}
                      {visibleColumns.customer && (
                        <th style={erpListThStyle(theme)}>Customer Name</th>
                      )}
                      {visibleColumns.origin && (
                        <th style={erpListThStyle(theme)}>Origin</th>
                      )}
                      {visibleColumns.destination && (
                        <th style={erpListThStyle(theme)}>Destination</th>
                      )}
                      {visibleColumns.customer_service && (
                        <th style={erpListThStyle(theme)}>Customer Service</th>
                      )}
                      {statusFilter === "pending" ? (
                        <th style={erpListStickyActionThStyle(theme)}>Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(visibleDataColumnCount, 1)}
                          style={{ padding: 60, textAlign: "center" }}
                        >
                          <Stack align="center" gap="md">
                            <Box
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                backgroundColor: headerBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconPackage size={24} color={muted} />
                            </Box>
                            <Box>
                              <Text fw={500} c={fg}>
                                No bookings to display
                              </Text>
                              <Text size="sm" c={muted} mt={4}>
                                Try switching between Pending and Completed
                              </Text>
                            </Box>
                          </Stack>
                        </td>
                      </tr>
                    ) : (
                      displayData.map((row) => {
                        const rowProps = erpListDataRowProps(theme);
                        return (
                          <tr
                            key={row.id}
                            style={rowProps.style}
                            onMouseEnter={rowProps.onMouseEnter}
                            onMouseLeave={rowProps.onMouseLeave}
                          >
                            {visibleColumns.booking && (
                              <td style={erpListTdCellToneStyle(theme, "default")}>
                                <Text fw={600} size="sm" c={fg}>
                                  {row.shipment_code}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.date && (
                              <td style={erpListTdCellToneStyle(theme, "muted")}>
                                {row.date ? dayjs(row.date).format(dateFormat) : "—"}
                              </td>
                            )}
                            {visibleColumns.service && (
                              <td style={erpListTdCellToneStyle(theme, "default")}>
                                <Text size="sm" c={fg}>
                                  {row.service}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.customer && (
                              <td style={erpListTdCellToneStyle(theme, "default")}>
                                <Text size="sm" c={fg} lineClamp={1}>
                                  {row.customer_name}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.origin && (
                              <td style={erpListTdCellToneStyle(theme, "default")}>
                                <Text size="sm" c={fg} lineClamp={1}>
                                  {row.origin_name}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.destination && (
                              <td style={erpListTdCellToneStyle(theme, "default")}>
                                <Text size="sm" c={fg} lineClamp={1}>
                                  {row.destination_name}
                                </Text>
                              </td>
                            )}
                            {visibleColumns.customer_service && (
                              <td style={erpListTdCellToneStyle(theme, "default")}>
                                <Text size="sm" c={muted} lineClamp={1}>
                                  {row.customer_service_name}
                                </Text>
                              </td>
                            )}
                            {statusFilter === "pending" ? (
                              <td style={erpListStickyActionTdStyle(theme)}>
                                <Menu
                                  withinPortal
                                  position="bottom-end"
                                  shadow="md"
                                  width={220}
                                  closeOnItemClick
                                  styles={erpListGeistMenuDropdownStyles}
                                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                                >
                                  <Menu.Target>
                                    <ActionIcon variant="subtle" color="gray" size="sm">
                                      <IconDotsVertical size={16} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Box px={10} py={5}>
                                      <UnstyledButton
                                        onClick={() => {
                                          setSelectedBooking(row);
                                          setConfirmModalOpened(true);
                                        }}
                                      >
                                        <Group gap="sm">
                                          <IconCirclePlus size={16} color={primary} />
                                          <Text size="sm">Create Export Booking</Text>
                                        </Group>
                                      </UnstyledButton>
                                    </Box>
                                  </Menu.Dropdown>
                                </Menu>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ),
            }}
          />
        </Box>
      </MantineProvider>
    </>
  );
}

export default AirImportToExportBooking;
