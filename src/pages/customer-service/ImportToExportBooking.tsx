import { useMemo, useEffect, useState } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  Button,
  Card,
  Group,
  Text,
  Loader,
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
  SegmentedControl,
} from "@mantine/core";
import { IconDotsVertical, IconCirclePlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { postAPICall } from "../../service/postApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification } from "../../components";

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

type ImportToExportBookingsResponse = {
  success: boolean;
  message: string;
  count: number;
  index: number;
  limit: number | null;
  total_pagination: number;
  total: number;
  data: ImportToExportBookingData[];
};

// API function to fetch import-to-export bookings
const fetchImportToExportBookings = async (statusFilter: string) => {
  const payload = {
    filters: {
      import_to_export: true,
      reference: statusFilter === "completed",
    },
  };

  console.log(`🔍 Fetching ${statusFilter} bookings with payload:`, payload);

  const response = (await postAPICall(
    URL.customerServiceShipmentFilter,
    payload,
    API_HEADER
  )) as ImportToExportBookingsResponse;

  console.log(`📊 Response for ${statusFilter} bookings:`, response);

  // Extract data from the response structure
  if (response && response.success && Array.isArray(response.data)) {
    console.log(`✅ Found ${response.data.length} ${statusFilter} bookings`);
    return response.data;
  }

  console.log(`❌ No data found for ${statusFilter} bookings`);
  return [];
};

function ImportToExportBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<ImportToExportBookingData | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Effect to refresh data when navigated to from import shipment page or statusFilter changes
  useEffect(() => {
    // Always refresh data when component mounts to ensure latest data
    const refreshData = async () => {
      try {
        await queryClient.invalidateQueries({
          queryKey: ["import-to-export-bookings", statusFilter],
        });
        await queryClient.refetchQueries({
          queryKey: ["import-to-export-bookings", statusFilter],
        });
        console.log("✅ Import-to-export bookings data refreshed");
      } catch (error) {
        console.error("Error refreshing import-to-export bookings:", error);
      }
    };

    refreshData();
  }, [queryClient, statusFilter]);

  // Fetch import-to-export bookings data
  const {
    data: importToExportBookings = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["import-to-export-bookings", statusFilter],
    queryFn: () => fetchImportToExportBookings(statusFilter),
    staleTime: 0, // Always fetch fresh data
  });

  // Transform API data for display
  const displayData: ImportToExportBookingData[] = Array.isArray(
    importToExportBookings
  )
    ? importToExportBookings
    : [];

  const columns = useMemo<MRT_ColumnDef<ImportToExportBookingData>[]>(() => {
    const baseColumns: MRT_ColumnDef<ImportToExportBookingData>[] = [
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
        accessorKey: "shipment_code",
        header: "Booking ID",
        size: 150,
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
      },
      {
        accessorKey: "service",
        header: "Service",
        size: 100,
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 150,
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
        accessorKey: "customer_service_name",
        header: "Customer Service",
        size: 150,
      },
    ];

    // Only add actions column for pending bookings
    if (statusFilter === "pending") {
      baseColumns.push({
        id: "actions",
        header: "Actions",
        size: 100,
        Cell: ({ row }) => (
          <Menu
            withinPortal
            position="bottom-end"
            shadow="sm"
            radius={"md"}
            closeOnItemClick
          >
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() => {
                    setSelectedBooking(row.original);
                    setConfirmModalOpened(true);
                  }}
                >
                  <Group gap={"sm"}>
                    <IconCirclePlus size={16} style={{ color: "#105476" }} />
                    <Text size="sm">Create Export Booking</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      });
    }

    return baseColumns;
  }, [statusFilter]);

  const table = useMantineReactTable({
    columns,
    data: displayData,
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
      columnPinning: statusFilter === "pending" ? { right: ["actions"] } : {},
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
        display: "flex",
        flexDirection: "column",
        height: "78%",
        maxHeight: "1536px",
        flex: 1,
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "#ffffff",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #e9ecef",
      },
    },
    mantineTableContainerProps: {
      style: {
        flex: 1,
        height: "100%",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
  });

  const handleConfirmCreateExport = async () => {
    if (selectedBooking) {
      try {
        // Prepare minimal payload for export conversion
        const payload = {
          service_type: "EXPORT",
          import_to_export: false,
          reference: selectedBooking.id || "",
        };

        console.log("Creating export shipment from import data:", payload);
        // Close modal immediately before API call
        setConfirmModalOpened(false);
        setSelectedBooking(null);

        // Call API to create export shipment
        const response = await postAPICall(
          URL.customerServiceShipment,
          payload,
          API_HEADER
        );

        console.log("Export shipment created successfully:", response);

        // Show success notification
        ToastNotification({
          message: "Export booking created successfully from import booking!",
          type: "success",
        });

        // Refresh the import-to-export bookings data
        await queryClient.invalidateQueries({
          queryKey: ["import-to-export-bookings", statusFilter],
        });
        await queryClient.refetchQueries({
          queryKey: ["import-to-export-bookings", statusFilter],
        });

        // Navigate to export shipment list page with refresh flag
        navigate("/customer-service/export-shipment", {
          state: { refreshData: true },
        });
      } catch (error) {
        console.error("Error creating export shipment:", error);
        ToastNotification({
          message: "Failed to create export shipment. Please try again.",
          type: "error",
        });
      }
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="center" align="center" style={{ minHeight: "200px" }}>
          <Loader size="md" color="#105476" />
          <Text size="sm" c="dimmed">
            Loading import-to-export bookings...
          </Text>
        </Group>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="center" align="center" style={{ minHeight: "200px" }}>
          <Text size="sm" c="red">
            Error loading import-to-export bookings. Please try again.
          </Text>
        </Group>
      </Card>
    );
  }

  return (
    <>
      {/* Confirmation Modal */}
      <Modal
        opened={confirmModalOpened}
        onClose={() => setConfirmModalOpened(false)}
        title={
          <Text fw={600} size="lg" c="#105476">
            Confirm to Create Export Shipment
          </Text>
        }
        size="xl"
        centered
        radius="md"
        zIndex={400}
        styles={{
          header: {
            backgroundColor: "#f8f9fa",
            borderBottom: "2px solid #105476",
            paddingBottom: "12px",
          },
          body: {
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
                      c="#105476"
                      style={{
                        fontFamily: "monospace",
                        letterSpacing: "0.5px",
                      }}
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

      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        style={{ height: "100%", display: "flex" }}
        withBorder
      >
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c={"#105476"}>
            List of Import to Export Bookings
          </Text>

          <Group gap="sm" wrap="nowrap">
            <SegmentedControl
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(value as "pending" | "completed")
              }
              data={[
                { label: "Pending", value: "pending" },
                { label: "Completed", value: "completed" },
              ]}
              size="xs"
              color="#105476"
            />
          </Group>
        </Group>

        <MantineReactTable table={table} />
      </Card>
    </>
  );
}

export default ImportToExportBooking;
