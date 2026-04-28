import { useMemo, useState, useEffect } from "react";
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
} from "@mantine/core";
import {
  IconDotsVertical,
  IconCirclePlus,
  IconPackage,
  IconStack2,
  IconCircleCheck,
  IconClock,
  IconArrowRight,
  IconCircleX,
  IconScale,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  origin_code?: string;
  destination_name: string;
  destination_code_read: string;
  destination_code?: string;
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
  route: boolean;
  customer_service: boolean;
};

function routeEndpointsFromBookingRow(row: ImportToExportBookingData) {
  const oc =
    String(row.origin_code_read || "").trim() ||
    String(row.origin_code || "").trim() ||
    String(row.origin_name || "").trim() ||
    "";
  const dc =
    String(row.destination_code_read || "").trim() ||
    String(row.destination_code || "").trim() ||
    String(row.destination_name || "").trim() ||
    "";
  return { oc, dc };
}

/** `summary` on `customerServiceShipmentFilter` (totals are filter-scoped). */
type ImportToExportListSummary = {
  total_shipments?: number;
  status_counts?: {
    booked?: number;
    received?: number;
    generated?: number;
    closed?: number;
    cancel?: number;
    pending?: number;
  };
  totals?: {
    pcs?: number;
    weight_kg?: number;
  };
};

type ImportToExportListQueryResult = {
  data: ImportToExportBookingData[];
  total: number;
  summary?: ImportToExportListSummary;
};

function OceanImportToExportBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = DEFAULT_ERP_LIST_THEME;
  const { muted, fg, primary, headerBg, fontSans } = theme;

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
    route: true,
    customer_service: true,
  });

  const dateFormat = useDateFormat();

  const { data: listResponse, isLoading, error } = useQuery<ImportToExportListQueryResult>({
    queryKey: ["ocean-import-to-export-bookings", statusFilter, pageIndex, pageSize],
    queryFn: async (): Promise<ImportToExportListQueryResult> => {
      try {
        const offset = pageIndex * pageSize;
        const payload = {
          filters: {
            import_to_export: true,
            service: ["FCL", "LCL"],
            reference: statusFilter === "completed",
          },
        };
        const response = (await postAPICall(
          `${URL.customerServiceShipmentFilter}?index=${offset}&limit=${pageSize}`,
          payload,
          API_HEADER,
        )) as Record<string, unknown>;

        const list: ImportToExportBookingData[] = Array.isArray(response.data)
          ? (response.data as ImportToExportBookingData[])
          : [];
        const listTotal = getBookingShipmentFilterListTotal(response, list, offset);
        const rawSummary = response.summary;
        const summary: ImportToExportListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? (rawSummary as ImportToExportListSummary)
            : undefined;
        const summaryTotal = summary?.total_shipments;
        const total =
          typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
            ? summaryTotal
            : listTotal;
        setTotalRecords(total);

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

  const listSummary = listResponse?.summary;
  const stats = useMemo(() => {
    if (listSummary) {
      const sc = listSummary.status_counts;
      return {
        total: listSummary.total_shipments ?? totalRecords,
        booked: sc?.booked ?? 0,
        received: sc?.received ?? 0,
        generated: sc?.generated ?? 0,
        cancel: sc?.cancel ?? 0,
        totalPieces: listSummary.totals?.pcs ?? 0,
        totalWeight: listSummary.totals?.weight_kg ?? 0,
      };
    }
    return {
      total: totalRecords,
      booked: 0,
      received: 0,
      generated: 0,
      cancel: 0,
      totalPieces: 0,
      totalWeight: 0,
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
        reference: selectedBooking.id || "",
      };

      setConfirmModalOpened(false);
      setSelectedBooking(null);

      await postAPICall(URL.customerServiceShipment, payload, API_HEADER);

      ToastNotification({
        message: "Export booking created successfully from import booking!",
        type: "success",
      });

      await queryClient.invalidateQueries({
        queryKey: ["ocean-import-to-export-bookings"],
      });

      navigate("/SeaExport/export-booking", {
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
                    value={stats.booked}
                    label="Booked"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconPackage size={14} color="#105476" />}
                    iconBackground="#dbeafe"
                    iconColor="#105476"
                    value={stats.received}
                    label="Received"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconClock size={14} color="#d97706" />}
                    iconBackground="#fef3c7"
                    iconColor="#d97706"
                    value={stats.generated}
                    label="Generated"
                  />
                  <ERPListStatPill
                    theme={theme}
                    icon={<IconCircleX size={14} color="#dc2626" />}
                    iconBackground="#fee2e2"
                    iconColor="#dc2626"
                    value={stats.cancel}
                    label="Canceled"
                  />
                </>
              ),
              secondary: (
                <>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconStack2 size={16} color={muted} style={{ flexShrink: 0 }} />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {stats.totalPieces.toLocaleString()}
                    </Text>
                    <Text size="xs" c={muted} component="span">
                      pcs
                    </Text>
                  </Group>
                  <Group gap={8} wrap="nowrap" align="center">
                    <IconScale size={16} color={muted} style={{ flexShrink: 0 }} />
                    <Text fw={600} size="sm" c={fg} component="span">
                      {stats.totalWeight.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                    </Text>
                    <Text size="xs" c={muted} component="span">
                      kg
                    </Text>
                  </Group>
                </>
              ),
              actions: (
                <>
                  <Select
                    size="xs"
                    w={140}
                    value={statusFilter}
                    onChange={(v) => {
                      setStatusFilter(v === "completed" ? "completed" : "pending");
                      setPageIndex(0);
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
              ) : isLoading ? (
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
                      {visibleColumns.route && (
                        <th style={erpListThStyle(theme)}>Route</th>
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
                            {visibleColumns.route && (() => {
                              const { oc, dc } = routeEndpointsFromBookingRow(row);
                              return (
                                <td style={erpListTdCellToneStyle(theme, "default")}>
                                  <Group gap={6} wrap="nowrap">
                                    <Text fw={600} size="sm" c={primary}>
                                      {oc || "—"}
                                    </Text>
                                    <IconArrowRight size={12} color={muted} />
                                    <Text fw={500} size="sm" c={fg}>
                                      {dc || "—"}
                                    </Text>
                                  </Group>
                                </td>
                              );
                            })()}
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

export default OceanImportToExportBooking;
