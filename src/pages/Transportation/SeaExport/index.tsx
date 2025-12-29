import { useMemo, useState, useEffect } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Card,
  Center,
  Stack,
  Grid,
  Select,
  Menu,
  ActionIcon,
  Box,
  UnstyledButton,
  TextInput,
} from "@mantine/core";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconFilterOff,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconEye,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "@mantine/form";
import {
  SearchableSelect,
  ToastNotification,
  Dropdown,
} from "../../../components";
import { DateInput } from "@mantine/dates";
import { URL } from "../../../api/serverUrls";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";

// Type definitions based on API response
type SeaExportJobData = {
  id: number;
  service: string;
  origin_code_read: string;
  origin_name: string;
  destination_code_read: string;
  destination_name: string;
  schedule: string;
  vessel: string;
  voyage: string;
  carrier_code_read: string;
  carrier_name: string;
  cut_off_date: string;
  eta: string;
  etd: string;
  status: string;
  equipment_details: Array<{
    id: number;
    container_type_code_read: string;
    container_type_name: string;
    container_no: string;
    customer_seal_no: string;
    actual_seal_no: string;
  }>;
  shipment_details: Array<any>;
};

type FilterState = {
  origin: string | null;
  destination: string | null;
  service: string | null;
  schedule: string | null;
  vessel: string | null;
  voyage: string | null;
  cut_off_date: Date | null;
  eta: Date | null;
  etd: Date | null;
};

function SeaExportMaster() {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect service type from URL immediately
  const getServiceTypeFromUrl = () => {
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("lcl-job-generation")) {
      return "LCL";
    } else if (pathname.includes("fcl-job-generation")) {
      return "FCL";
    }
    return null;
  };

  // States
  const [showFilters, setShowFilters] = useState(false);

  // Filter form - Initialize with service type from URL
  const filterForm = useForm<FilterState>({
    initialValues: {
      origin: null,
      destination: null,
      service: getServiceTypeFromUrl(),
      schedule: null,
      vessel: null,
      voyage: null,
      cut_off_date: null,
      eta: null,
      etd: null,
    },
  });

  // Build filter payload
  const buildFilterPayload = useMemo(() => {
    const payload: any = {};
    if (filterForm.values.service) payload.service = filterForm.values.service;
    if (filterForm.values.origin)
      payload.origin_code_read = filterForm.values.origin;
    if (filterForm.values.destination)
      payload.destination_code_read = filterForm.values.destination;
    if (filterForm.values.schedule)
      payload.schedule = filterForm.values.schedule;
    if (filterForm.values.vessel) payload.vessel = filterForm.values.vessel;
    if (filterForm.values.voyage) payload.voyage = filterForm.values.voyage;
    if (filterForm.values.cut_off_date)
      payload.cut_off_date = dayjs(filterForm.values.cut_off_date).format(
        "YYYY-MM-DD"
      );
    if (filterForm.values.eta)
      payload.eta = dayjs(filterForm.values.eta).format("YYYY-MM-DD");
    if (filterForm.values.etd)
      payload.etd = dayjs(filterForm.values.etd).format("YYYY-MM-DD");
    return payload;
  }, [filterForm.values]);

  // Update service filter when URL changes
  useEffect(() => {
    const serviceType = getServiceTypeFromUrl();
    if (serviceType && filterForm.values.service !== serviceType) {
      filterForm.setFieldValue("service", serviceType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Fetch bookings from API - Only run when service filter is set
  const {
    data: bookingData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["bookings", buildFilterPayload],
    queryFn: async () => {
      try {
        const requestBody = { filters: buildFilterPayload };
        const response = await apiCallProtected.post(
          URL.bookingFilter,
          requestBody
        );
        const data = response as any;
        if (data?.success && Array.isArray(data?.data)) {
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching bookings:", error);
        return [];
      }
    },
    enabled: !!filterForm.values.service, // Only run when service is set
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Check for refresh from create/edit page
  useEffect(() => {
    if (location.state?.refreshData) {
      // Clear state first to prevent multiple refetches
      navigate(location.pathname, { replace: true, state: {} });
      // Then refetch - this will show loading state via isFetching
      refetch();
    }
  }, [location.state?.refreshData, location.pathname, navigate, refetch]);

  // Display data
  const displayData = useMemo(() => {
    return bookingData || [];
  }, [bookingData]);

  const applyFilters = () => {
    const formValues = filterForm.values;
    const hasFilterValues =
      formValues.origin ||
      formValues.destination ||
      formValues.service ||
      formValues.schedule ||
      formValues.vessel ||
      formValues.voyage ||
      formValues.cut_off_date ||
      formValues.eta ||
      formValues.etd;

    if (!hasFilterValues) {
      ToastNotification({
        type: "info",
        message: "No filters selected, showing all data",
      });
      return;
    }

    refetch();
    ToastNotification({
      type: "success",
      message: "Filters applied successfully",
    });
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    const formValues = filterForm.values;
    const hasFilterValues =
      formValues.origin ||
      formValues.destination ||
      formValues.service ||
      formValues.schedule ||
      formValues.vessel ||
      formValues.voyage ||
      formValues.cut_off_date ||
      formValues.eta ||
      formValues.etd;

    if (!hasFilterValues) {
      ToastNotification({
        type: "info",
        message: "No filters to clear",
      });
      return;
    }

    filterForm.reset();
    // Reset service to URL-based default
    filterForm.setFieldValue("service", getServiceTypeFromUrl());
    setShowFilters(false);
    refetch();
    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const handleEdit = (job: SeaExportJobData) => {
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("lcl-job-generation")) {
      navigate("/SeaExport/lcl-job-generation/edit", {
        state: { job, mode: "edit" },
      });
    } else {
      navigate("/SeaExport/fcl-job-generation/edit", {
        state: { job, mode: "edit" },
      });
    }
  };

  const handleView = (job: SeaExportJobData) => {
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("lcl-job-generation")) {
      navigate("/SeaExport/lcl-job-generation/view", {
        state: { job, mode: "view" },
      });
    } else {
      navigate("/SeaExport/fcl-job-generation/view", {
        state: { job, mode: "view" },
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<SeaExportJobData>[]>(
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
        accessorKey: "vessel",
        header: "Vessel",
        size: 150,
        Cell: ({ cell }) => {
          const vessel = cell.getValue<string>();
          return vessel || "-";
        },
      },
      {
        accessorKey: "voyage",
        header: "Voyage",
        size: 120,
        Cell: ({ cell }) => {
          const voyage = cell.getValue<string>();
          return voyage || "-";
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
        accessorKey: "eta",
        header: "ETA",
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format("YYYY-MM-DD") : "-";
        },
      },
      {
        accessorKey: "etd",
        header: "ETD",
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format("YYYY-MM-DD") : "-";
        },
      },
      {
        accessorKey: "cut_off_date",
        header: "Cutoff Date",
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format("YYYY-MM-DD") : "-";
        },
      },

      {
        accessorKey: "schedule",
        header: "Schedule",
        size: 120,
      },

      {
        id: "actions",
        header: "Action",
        size: 100,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius={"md"}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton onClick={() => handleView(row.original)}>
                  <Group gap={"sm"}>
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton onClick={() => handleEdit(row.original)}>
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text size="sm">Edit</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    []
  );

  const table = useMantineReactTable({
    columns,
    data: displayData,
    state: {
      isLoading: isLoading || isFetching, // Show loading during initial load and refetch
    },
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
    },
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "30px",
          zIndex: 2,
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
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "30px",
          zIndex: 2,
        };
      }
      return {
        style: {
          padding: "6px 12px",
          fontSize: "12px",
          backgroundColor: "#ffffff",
          top: 0,
          zIndex: column.id === "actions" ? 4 : 3,
          borderBottom: "1px solid #e9ecef",
          ...extraStyles,
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="dimmed" size="lg" ta="center">
                No jobs to display
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600} c="#105476">
          Ocean Job List
        </Text>

        <Group gap="sm" wrap="nowrap">
          <Button
            variant={showFilters ? "filled" : "outline"}
            leftSection={<IconFilter size={16} />}
            size="xs"
            color="#105476"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="filled"
            leftSection={<IconPlus size={14} />}
            size="xs"
            color="#105476"
            onClick={() => {
              const pathname = location.pathname.toLowerCase();
              let serviceType = "FCL"; // Default
              let createPath = "/SeaExport/fcl-job-generation/create";
              if (pathname.includes("lcl-job-generation")) {
                serviceType = "LCL";
                createPath = "/SeaExport/lcl-job-generation/create";
              }
              navigate(createPath, { state: { serviceType } });
            }}
          >
            Create New
          </Button>
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

          <Grid>
            <Grid.Col span={12}>
              <Grid>
                {/* Origin Filter */}
                <Grid.Col span={2.4}>
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
                    value={filterForm.values.origin}
                    onChange={(value) =>
                      filterForm.setFieldValue("origin", value || null)
                    }
                    minSearchLength={3}
                  />
                </Grid.Col>

                {/* Destination Filter */}
                <Grid.Col span={2.4}>
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
                    value={filterForm.values.destination}
                    onChange={(value) =>
                      filterForm.setFieldValue("destination", value || null)
                    }
                    minSearchLength={3}
                  />
                </Grid.Col>

                {/* Service Filter */}
                <Grid.Col span={2.4}>
                  <Select
                    key={`service-${filterForm.values.service}`}
                    label="Service"
                    placeholder="Select Service"
                    searchable
                    clearable
                    size="xs"
                    data={[
                      { value: "FCL", label: "FCL" },
                      { value: "LCL", label: "LCL" },
                    ]}
                    nothingFoundMessage="No services found"
                    {...filterForm.getInputProps("service")}
                    styles={{
                      input: { fontSize: "12px" },
                      label: {
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#495057",
                      },
                    }}
                  />
                </Grid.Col>

                {/* Schedule Filter */}
                <Grid.Col span={2.4}>
                  <Dropdown
                    size="xs"
                    label="Schedule"
                    placeholder="Select schedule"
                    searchable
                    clearable
                    data={[
                      { value: "Weekly", label: "Weekly" },
                      { value: "Monthly", label: "Monthly" },
                      { value: "Daily", label: "Daily" },
                      { value: "Quarterly", label: "Quarterly" },
                    ]}
                    {...filterForm.getInputProps("schedule")}
                    styles={{
                      input: { fontSize: "12px" },
                      label: {
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#495057",
                      },
                    }}
                  />
                </Grid.Col>

                {/* Vessel Filter */}
                <Grid.Col span={2.4}>
                  <TextInput
                    size="xs"
                    label="Vessel"
                    placeholder="Enter vessel name"
                    {...filterForm.getInputProps("vessel")}
                    styles={{
                      input: { fontSize: "12px" },
                      label: {
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#495057",
                      },
                    }}
                  />
                </Grid.Col>

                {/* Voyage Filter */}
                <Grid.Col span={2.4}>
                  <TextInput
                    size="xs"
                    label="Voyage"
                    placeholder="Enter voyage number"
                    {...filterForm.getInputProps("voyage")}
                    styles={{
                      input: { fontSize: "12px" },
                      label: {
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#495057",
                      },
                    }}
                  />
                </Grid.Col>

                {/* Cut Off Date Filter */}
                <Grid.Col span={2.4}>
                  <DateInput
                    key={`cut-off-${filterForm.values.cut_off_date}`}
                    label="Cut Off Date"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    {...filterForm.getInputProps("cut_off_date")}
                    valueFormat="YYYY-MM-DD"
                    leftSection={<IconCalendar size={14} />}
                    leftSectionPointerEvents="none"
                    radius="md"
                    nextIcon={<IconChevronRight size={16} />}
                    previousIcon={<IconChevronLeft size={16} />}
                    clearable
                    styles={{
                      day: {
                        width: "2.25rem",
                        height: "2.25rem",
                        fontSize: "0.9rem",
                      },
                      calendarHeaderLevel: {
                        fontSize: "1rem",
                        fontWeight: 500,
                        marginBottom: "0.5rem",
                        flex: 1,
                        textAlign: "center",
                      },
                      calendarHeaderControl: {
                        width: "2rem",
                        height: "2rem",
                        margin: "0 0.5rem",
                      },
                      calendarHeader: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      },
                    }}
                  />
                </Grid.Col>

                {/* ETA Filter */}
                <Grid.Col span={2.4}>
                  <DateInput
                    key={`eta-${filterForm.values.eta}`}
                    label="ETA"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    {...filterForm.getInputProps("eta")}
                    valueFormat="YYYY-MM-DD"
                    leftSection={<IconCalendar size={14} />}
                    leftSectionPointerEvents="none"
                    radius="md"
                    nextIcon={<IconChevronRight size={16} />}
                    previousIcon={<IconChevronLeft size={16} />}
                    clearable
                    styles={{
                      day: {
                        width: "2.25rem",
                        height: "2.25rem",
                        fontSize: "0.9rem",
                      },
                      calendarHeaderLevel: {
                        fontSize: "1rem",
                        fontWeight: 500,
                        marginBottom: "0.5rem",
                        flex: 1,
                        textAlign: "center",
                      },
                      calendarHeaderControl: {
                        width: "2rem",
                        height: "2rem",
                        margin: "0 0.5rem",
                      },
                      calendarHeader: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      },
                    }}
                  />
                </Grid.Col>

                {/* ETD Filter */}
                <Grid.Col span={2.4}>
                  <DateInput
                    key={`etd-${filterForm.values.etd}`}
                    label="ETD"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    {...filterForm.getInputProps("etd")}
                    valueFormat="YYYY-MM-DD"
                    leftSection={<IconCalendar size={14} />}
                    leftSectionPointerEvents="none"
                    radius="md"
                    nextIcon={<IconChevronRight size={16} />}
                    previousIcon={<IconChevronLeft size={16} />}
                    clearable
                    styles={{
                      day: {
                        width: "2.25rem",
                        height: "2.25rem",
                        fontSize: "0.9rem",
                      },
                      calendarHeaderLevel: {
                        fontSize: "1rem",
                        fontWeight: 500,
                        marginBottom: "0.5rem",
                        flex: 1,
                        textAlign: "center",
                      },
                      calendarHeaderControl: {
                        width: "2rem",
                        height: "2rem",
                        margin: "0 0.5rem",
                      },
                      calendarHeader: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      },
                    }}
                  />
                </Grid.Col>
              </Grid>
            </Grid.Col>
          </Grid>

          <Group justify="end" mt="sm">
            <Button
              size="xs"
              variant="outline"
              color="#105476"
              leftSection={<IconFilterOff size={14} />}
              onClick={clearAllFilters}
            >
              Clear Filters
            </Button>
            <Button
              size="xs"
              variant="filled"
              color="#105476"
              leftSection={<IconFilter size={14} />}
              onClick={applyFilters}
            >
              Apply Filters
            </Button>
          </Group>
        </Card>
      )}

      <MantineReactTable table={table} />
    </Card>
  );
}

export default SeaExportMaster;
