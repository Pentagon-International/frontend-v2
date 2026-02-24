import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Stepper,
  Text,
  TextInput,
  Center,
  Loader,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
} from "../../../components";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { apiCallProtected } from "../../../api/axios";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { useQuery } from "@tanstack/react-query";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { Checkbox } from "@mantine/core";

type JobDetailsForm = {
  service: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  eta: string;
  etd: string;
  cutoff_date: string;
  schedule: string;
  carrier_code: string;
  carrier_name: string;
};

type RoutingDetail = {
  from_code: string;
  from_name: string;
  to_code: string;
  to_name: string;
  eta: string;
  etd: string;
  carrier_code: string;
  carrier_name: string;
  flight_no: string;
};

type BookingData = {
  id: number;
  shipment_code: string;
  service_type: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  freight: string;
  selected?: boolean;
};

const jobDetailsSchema = yup.object({
  service: yup.string().required("Service is required"),
  origin_code: yup.string().required("Origin is required"),
  destination_code: yup.string().required("Destination is required"),
  eta: yup.string().required("ETA is required"),
  etd: yup.string().required("ETD is required"),
  cutoff_date: yup.string().required("Cutoff date is required"),
  schedule: yup.string().required("Schedule is required"),
  carrier_code: yup.string().required("Carrier is required"),
});

const routingDetailsSchema = yup.object({
  routings: yup
    .array()
    .of(
      yup.object({
        from_code: yup.string().required("From is required"),
        to_code: yup.string().required("To is required"),
        eta: yup.string().required("ETA is required"),
        etd: yup.string().required("ETD is required"),
        carrier_code: yup.string().required("Carrier is required"),
        flight_no: yup.string().required("Flight No is required"),
      })
    )
    .min(1, "At least one routing is required"),
});

function AirJobGenerationCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job as Record<string, unknown> | undefined;

  const mode = useMemo(() => {
    if (location.state?.mode) return location.state.mode as string;
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("/edit")) return "edit";
    if (pathname.includes("/view")) return "view";
    return "create";
  }, [location.pathname, location.state]);

  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);

  const [bookingList, setBookingList] = useState<BookingData[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<Set<number>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jobDetailsForm = useForm<JobDetailsForm>({
    initialValues: {
      service: "AIR",
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      eta: dayjs().format("YYYY-MM-DD"),
      etd: dayjs().format("YYYY-MM-DD"),
      cutoff_date: dayjs().format("YYYY-MM-DD"),
      schedule: "",
      carrier_code: "",
      carrier_name: "",
    },
    validate: yupResolver(jobDetailsSchema),
  });

  const routingForm = useForm({
    initialValues: {
      routings: [
        {
          from_code: "",
          from_name: "",
          to_code: "",
          to_name: "",
          eta: dayjs().format("YYYY-MM-DD"),
          etd: dayjs().format("YYYY-MM-DD"),
          carrier_code: "",
          carrier_name: "",
          flight_no: "",
        },
      ] as RoutingDetail[],
    },
    validate: yupResolver(routingDetailsSchema),
  });

  useEffect(() => {
    if (mode === "edit") {
      setEditMode(true);
      setViewMode(false);
    } else if (mode === "view") {
      setViewMode(true);
      setEditMode(false);
    } else {
      setEditMode(false);
      setViewMode(false);
    }
  }, [mode]);

  useEffect(() => {
    if (jobData && (mode === "edit" || mode === "view")) {
      if (jobData.id) setJobId(jobData.id as number);

      jobDetailsForm.setValues({
        service: (jobData.service as string) || "AIR",
        origin_code: (jobData.origin_code_read as string) || "",
        origin_name: (jobData.origin_name as string) || "",
        destination_code: (jobData.destination_code_read as string) || "",
        destination_name: (jobData.destination_name as string) || "",
        eta: (jobData.eta as string) || dayjs().format("YYYY-MM-DD"),
        etd: (jobData.etd as string) || dayjs().format("YYYY-MM-DD"),
        cutoff_date: (jobData.cut_off_date as string) || dayjs().format("YYYY-MM-DD"),
        schedule: (jobData.schedule as string) || "",
        carrier_code: (jobData.carrier_code_read as string) || "",
        carrier_name: (jobData.carrier_name as string) || "",
      });

      const routingDetails = jobData.routing_details as Array<{
        from_code?: string;
        from_name?: string;
        to_code?: string;
        to_name?: string;
        eta?: string;
        etd?: string;
        carrier_code?: string;
        carrier_name?: string;
        flight_no?: string;
      }> | undefined;
      if (routingDetails && Array.isArray(routingDetails) && routingDetails.length > 0) {
        routingForm.setFieldValue(
          "routings",
          routingDetails.map((r) => ({
            from_code: r.from_code || "",
            from_name: r.from_name || "",
            to_code: r.to_code || "",
            to_name: r.to_name || "",
            eta: r.eta || dayjs().format("YYYY-MM-DD"),
            etd: r.etd || dayjs().format("YYYY-MM-DD"),
            carrier_code: r.carrier_code || "",
            carrier_name: r.carrier_name || "",
            flight_no: r.flight_no || "",
          }))
        );
      }

      const shipmentDetails = jobData.shipment_details as Array<{ customer_service_shipment_id_read?: number; customer_service_shipment_data?: Record<string, unknown> }> | undefined;
      if (shipmentDetails && Array.isArray(shipmentDetails)) {
        const ids = shipmentDetails
          .map((s) => s.customer_service_shipment_id_read)
          .filter((id): id is number => id != null);
        setSelectedBookings(new Set(ids));
      }
    }
  }, [jobData, mode]);

  const { data: carrierRes = [] } = useQuery({
    queryKey: ["carrier"],
    queryFn: async () => {
      try {
        return await getAPICall(`${URL.carrier}`, API_HEADER);
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    staleTime: Infinity,
  });

  const carrierData = useMemo(() => {
    if (!Array.isArray(carrierRes)) return [];
    return carrierRes.map(
      (item: { carrier_code: string; carrier_name: string }) => ({
        value: String(item.carrier_code),
        label: item.carrier_name,
      })
    );
  }, [carrierRes]);

  useEffect(() => {
    if (active === 2) {
      if ((mode === "view" || mode === "edit") && jobData?.shipment_details) {
        const shipmentDetails = jobData.shipment_details as Array<{
          customer_service_shipment_id_read?: number;
          customer_service_shipment_data?: Record<string, unknown>;
        }>;
        const bookings = shipmentDetails.map((s) => {
          const d = s.customer_service_shipment_data || {};
          return {
            id: s.customer_service_shipment_id_read!,
            shipment_code: String(d.shipment_code ?? ""),
            service_type: String(d.service_type ?? ""),
            customer_name: String(d.customer_name ?? ""),
            origin_name: String(d.origin_name ?? ""),
            destination_name: String(d.destination_name ?? ""),
            freight: String(d.freight ?? ""),
            selected: true,
          };
        });
        setBookingList(bookings);
        setIsLoadingBookings(false);
      } else {
        fetchBookingList();
      }
    }
  }, [active, mode, jobData]);

  const fetchBookingList = async () => {
    const formValues = jobDetailsForm.values;
    if (
      !formValues.service ||
      !formValues.origin_code ||
      !formValues.destination_code
    ) {
      ToastNotification({
        type: "warning",
        message:
          "Please complete Job Details (Service, Origin, Destination) before proceeding",
      });
      setActive(0);
      return;
    }

    setIsLoadingBookings(true);
    try {
      const payload = {
        filters: {
          service_type: "EXPORT",
          status: "BOOKED",
          service: formValues.service,
          origin_code: formValues.origin_code,
          destination_code: formValues.destination_code,
        },
      };

      const response = await apiCallProtected.post(
        URL.customerServiceShipmentFilter,
        payload
      ) as { data?: BookingData[] };

      if (response?.data) {
        setBookingList(response.data);
        ToastNotification({
          type: "success",
          message: `Loaded ${response.data.length} booking(s)`,
        });
      } else {
        setBookingList([]);
        ToastNotification({
          type: "info",
          message: "No bookings found for selected criteria",
        });
      }
    } catch (error: unknown) {
      const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "Failed to fetch booking list";
      ToastNotification({ type: "error", message });
      setBookingList([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleNext = () => {
    setActive((current) => current + 1);
  };

  const handleSubmit = async () => {
    if (viewMode) return;

    const jobValidation = jobDetailsForm.validate();
    const routingValidation = routingForm.validate();

    if (jobValidation.hasErrors || routingValidation.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please complete all required fields",
      });
      return;
    }

    if (selectedBookings.size === 0) {
      ToastNotification({
        type: "warning",
        message: "Please select at least one booking",
      });
      return;
    }

    const payload = {
      service: jobDetailsForm.values.service,
      origin_code: jobDetailsForm.values.origin_code,
      destination_code: jobDetailsForm.values.destination_code,
      schedule: jobDetailsForm.values.schedule,
      carrier_code: jobDetailsForm.values.carrier_code,
      cut_off_date: jobDetailsForm.values.cutoff_date,
      eta: jobDetailsForm.values.eta,
      etd: jobDetailsForm.values.etd,
      routing_details: routingForm.values.routings.map((r) => ({
        from_code: r.from_code,
        to_code: r.to_code,
        eta: r.eta,
        etd: r.etd,
        carrier_code: r.carrier_code,
        flight_no: r.flight_no,
      })),
      shipment_id: Array.from(selectedBookings),
    };

    setIsSubmitting(true);

    try {
      let responseData: { success?: boolean; message?: string };

      if (editMode && jobId) {
        const { putAPICall } = await import("../../../service/putApiCall");
        const putPayload = { id: jobId, ...payload };
        const response = await putAPICall(URL.booking, putPayload, API_HEADER);
        responseData = response as { success?: boolean; message?: string };

        if (responseData?.success === true) {
          ToastNotification({ type: "success", message: "Air job updated successfully" });
        } else {
          ToastNotification({
            type: "error",
            message: responseData?.message || "Failed to update job",
          });
        }
      } else {
        const response = await apiCallProtected.post(URL.booking, payload);
        responseData = response as { success?: boolean; message?: string };

        if (responseData?.success === true) {
          ToastNotification({ type: "success", message: "Air job created successfully" });
        } else {
          ToastNotification({
            type: "error",
            message: responseData?.message || "Failed to create job",
          });
        }
      }

      if (responseData?.success === true) {
        navigate("/air/job-generation", { state: { refreshData: true } });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      ToastNotification({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to save job",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectBooking = (bookingId: number, checked: boolean) => {
    const newSelection = new Set(selectedBookings);
    if (checked) newSelection.add(bookingId);
    else newSelection.delete(bookingId);
    setSelectedBookings(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedBookings(new Set(bookingList.map((b) => b.id)));
    else setSelectedBookings(new Set());
  };

  const bookingColumns = useMemo<MRT_ColumnDef<BookingData>[]>(
    () => [
      {
        id: "select",
        header: "Select",
        size: 60,
        Cell: ({ row }) => (
          <Checkbox
            checked={selectedBookings.has(row.original.id)}
            onChange={(e) =>
              handleSelectBooking(row.original.id, e.currentTarget.checked)
            }
            disabled={mode === "view"}
          />
        ),
        Header: () => (
          <Checkbox
            checked={
              selectedBookings.size === bookingList.length && bookingList.length > 0
            }
            indeterminate={
              selectedBookings.size > 0 && selectedBookings.size < bookingList.length
            }
            onChange={(e) => handleSelectAll(e.currentTarget.checked)}
            disabled={mode === "view"}
          />
        ),
      },
      { accessorKey: "shipment_code", header: "Booking ID", size: 120 },
      { accessorKey: "service_type", header: "Service Type", size: 100 },
      { accessorKey: "customer_name", header: "Customer Name", size: 200 },
      { accessorKey: "origin_name", header: "Origin", size: 120 },
      { accessorKey: "destination_name", header: "Destination", size: 120 },
      { accessorKey: "freight", header: "Freight", size: 100 },
    ],
    [selectedBookings, bookingList, mode]
  );

  const bookingTable = useMantineReactTable({
    columns: bookingColumns,
    data: bookingList,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableStickyHeader: true,
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: { shadow: "sm", radius: "sm", style: { overflow: "hidden" } },
    mantineTableBodyCellProps: {
      style: { padding: "8px 12px", fontSize: "13px" },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "#f8f9fa",
        position: "sticky",
        top: 0,
        zIndex: 10,
      },
    },
    mantineTableContainerProps: {
      style: { maxHeight: "320px", overflowY: "auto", overflowX: "auto" },
    },
  });

  const isReadOnly = viewMode;

  const dateInputStyles = {
    day: { width: "2.25rem", height: "2.25rem", fontSize: "0.9rem" },
    calendarHeaderLevel: { fontSize: "1rem", fontWeight: 500, marginBottom: "0.5rem", flex: 1, textAlign: "center" as const },
    calendarHeaderControl: { width: "2rem", height: "2rem", margin: "0 0.5rem" },
    calendarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" },
  };

  return (
    <Box p="md" maw={1200} mx="auto">
      <Text size="xl" fw={600} c="#105476" mb="lg">
        {mode === "view"
          ? "View Air Job"
          : mode === "edit"
            ? "Edit Air Job"
            : "Create Air Job"}
      </Text>

      <Stepper
        color="#105476"
        active={active}
        onStepClick={setActive}
        orientation="horizontal"
        allowNextStepsSelect={false}
      >
        {/* Stepper 1: Job Details (like FCL stepper 1) */}
        <Stepper.Step label="1" description="Job Details">
          <Box mt="md">
            <Grid>
              <Grid.Col span={4}>
                <Dropdown
                  label="Service"
                  withAsterisk
                  placeholder="Select Service"
                  data={["AIR"]}
                  {...jobDetailsForm.getInputProps("service")}
                  disabled
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type origin code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: { port_code: string; port_name: string }) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={jobDetailsForm.values.origin_code}
                  displayValue={
                    jobDetailsForm.values.origin_name
                      ? `${jobDetailsForm.values.origin_name} (${jobDetailsForm.values.origin_code})`
                      : jobDetailsForm.values.origin_code
                  }
                  onChange={(value, selectedData) => {
                    jobDetailsForm.setFieldValue("origin_code", value || "");
                    if (selectedData)
                      jobDetailsForm.setFieldValue("origin_name", selectedData.label.split(" (")[0] || "");
                  }}
                  error={jobDetailsForm.errors.origin_code as string}
                  minSearchLength={3}
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type destination code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: { port_code: string; port_name: string }) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={jobDetailsForm.values.destination_code}
                  displayValue={
                    jobDetailsForm.values.destination_name
                      ? `${jobDetailsForm.values.destination_name} (${jobDetailsForm.values.destination_code})`
                      : jobDetailsForm.values.destination_code
                  }
                  onChange={(value, selectedData) => {
                    jobDetailsForm.setFieldValue("destination_code", value || "");
                    if (selectedData)
                      jobDetailsForm.setFieldValue("destination_name", selectedData.label.split(" (")[0] || "");
                  }}
                  error={jobDetailsForm.errors.destination_code as string}
                  minSearchLength={3}
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <DateInput
                  label="ETA"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={jobDetailsForm.values.eta ? dayjs(jobDetailsForm.values.eta).toDate() : null}
                  onChange={(date) =>
                    jobDetailsForm.setFieldValue("eta", date ? dayjs(date).format("YYYY-MM-DD") : "")
                  }
                  error={jobDetailsForm.errors.eta}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  disabled={isReadOnly}
                  styles={dateInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <DateInput
                  label="ETD"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={jobDetailsForm.values.etd ? dayjs(jobDetailsForm.values.etd).toDate() : null}
                  onChange={(date) =>
                    jobDetailsForm.setFieldValue("etd", date ? dayjs(date).format("YYYY-MM-DD") : "")
                  }
                  error={jobDetailsForm.errors.etd}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  disabled={isReadOnly}
                  styles={dateInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <DateInput
                  label="Cutoff Date"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={
                    jobDetailsForm.values.cutoff_date
                      ? dayjs(jobDetailsForm.values.cutoff_date).toDate()
                      : null
                  }
                  onChange={(date) =>
                    jobDetailsForm.setFieldValue(
                      "cutoff_date",
                      date ? dayjs(date).format("YYYY-MM-DD") : ""
                    )
                  }
                  error={jobDetailsForm.errors.cutoff_date}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  disabled={isReadOnly}
                  styles={dateInputStyles}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Dropdown
                  label="Schedule"
                  placeholder="Select schedule"
                  searchable
                  data={[
                    { value: "Weekly", label: "Weekly" },
                    { value: "Monthly", label: "Monthly" },
                    { value: "Daily", label: "Daily" },
                    { value: "Quarterly", label: "Quarterly" },
                  ]}
                  {...jobDetailsForm.getInputProps("schedule")}
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Dropdown
                  label="Carrier"
                  placeholder="Select carrier"
                  searchable
                  data={carrierData}
                  nothingFoundMessage="No carriers found"
                  {...jobDetailsForm.getInputProps("carrier_code")}
                  onChange={(value) => {
                    jobDetailsForm.setFieldValue("carrier_code", value || "");
                    const selected = carrierData.find((c) => c.value === value);
                    if (selected) jobDetailsForm.setFieldValue("carrier_name", selected.label);
                  }}
                  disabled={isReadOnly}
                />
              </Grid.Col>
            </Grid>

            <Group justify="space-between" mt="xl">
              <Button
                variant="outline"
                color="#105476"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate("/air/job-generation")}
              >
                Back to List
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Stepper 2: Routing Details */}
        <Stepper.Step label="2" description="Routings">
          <Box mt="md">
            <Text size="md" fw={600} c="#105476" mb="md">
              Routings
            </Text>
            <Stack gap="md">
              {routingForm.values.routings.map((_, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={2}>
                      <SearchableSelect
                        label="From"
                        required
                        apiEndpoint={URL.portMaster}
                        placeholder="From"
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: { port_code: string; port_name: string }) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={routingForm.values.routings[index].from_code}
                        displayValue={
                          routingForm.values.routings[index].from_name
                            ? `${routingForm.values.routings[index].from_name} (${routingForm.values.routings[index].from_code})`
                            : routingForm.values.routings[index].from_code
                        }
                        onChange={(value, selectedData) => {
                          routingForm.setFieldValue(`routings.${index}.from_code`, value || "");
                          if (selectedData)
                            routingForm.setFieldValue(`routings.${index}.from_name`, selectedData.label.split(" (")[0] || "");
                        }}
                        error={routingForm.errors[`routings.${index}.from_code`] as string}
                        minSearchLength={2}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <SearchableSelect
                        label="To"
                        required
                        apiEndpoint={URL.portMaster}
                        placeholder="To"
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: { port_code: string; port_name: string }) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={routingForm.values.routings[index].to_code}
                        displayValue={
                          routingForm.values.routings[index].to_name
                            ? `${routingForm.values.routings[index].to_name} (${routingForm.values.routings[index].to_code})`
                            : routingForm.values.routings[index].to_code
                        }
                        onChange={(value, selectedData) => {
                          routingForm.setFieldValue(`routings.${index}.to_code`, value || "");
                          if (selectedData)
                            routingForm.setFieldValue(`routings.${index}.to_name`, selectedData.label.split(" (")[0] || "");
                        }}
                        error={routingForm.errors[`routings.${index}.to_code`] as string}
                        minSearchLength={2}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <DateInput
                        label="ETA"
                        withAsterisk
                        placeholder="YYYY-MM-DD"
                        value={
                          routingForm.values.routings[index].eta
                            ? dayjs(routingForm.values.routings[index].eta).toDate()
                            : null
                        }
                        onChange={(date) =>
                          routingForm.setFieldValue(
                            `routings.${index}.eta`,
                            date ? dayjs(date).format("YYYY-MM-DD") : ""
                          )
                        }
                        valueFormat="YYYY-MM-DD"
                        leftSection={<IconCalendar size={16} />}
                        leftSectionPointerEvents="none"
                        radius="sm"
                        size="sm"
                        disabled={isReadOnly}
                        styles={dateInputStyles}
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <DateInput
                        label="ETD"
                        withAsterisk
                        placeholder="YYYY-MM-DD"
                        value={
                          routingForm.values.routings[index].etd
                            ? dayjs(routingForm.values.routings[index].etd).toDate()
                            : null
                        }
                        onChange={(date) =>
                          routingForm.setFieldValue(
                            `routings.${index}.etd`,
                            date ? dayjs(date).format("YYYY-MM-DD") : ""
                          )
                        }
                        valueFormat="YYYY-MM-DD"
                        leftSection={<IconCalendar size={16} />}
                        leftSectionPointerEvents="none"
                        radius="sm"
                        size="sm"
                        disabled={isReadOnly}
                        styles={dateInputStyles}
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Dropdown
                        label="Carrier"
                        required
                        placeholder="Carrier"
                        searchable
                        data={carrierData}
                        nothingFoundMessage="No carriers"
                        {...routingForm.getInputProps(`routings.${index}.carrier_code`)}
                        onChange={(value) => {
                          routingForm.setFieldValue(`routings.${index}.carrier_code`, value || "");
                          const selected = carrierData.find((c) => c.value === value);
                          if (selected)
                            routingForm.setFieldValue(`routings.${index}.carrier_name`, selected.label);
                        }}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.5}>
                      <TextInput
                        label="Flight No"
                        required
                        placeholder="Flight No"
                        {...routingForm.getInputProps(`routings.${index}.flight_no`)}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={0.5}>
                      {index === routingForm.values.routings.length - 1 && !isReadOnly && (
                        <Button
                          variant="light"
                          color="#105476"
                          mt={25}
                          leftSection={<IconPlus size={16} />}
                          onClick={() => {
                            routingForm.setFieldValue("routings", [
                              ...routingForm.values.routings,
                              {
                                from_code: "",
                                from_name: "",
                                to_code: "",
                                to_name: "",
                                eta: dayjs().format("YYYY-MM-DD"),
                                etd: dayjs().format("YYYY-MM-DD"),
                                carrier_code: "",
                                carrier_name: "",
                                flight_no: "",
                              },
                            ]);
                          }}
                        >
                          Add
                        </Button>
                      )}
                      {routingForm.values.routings.length > 1 && index !== routingForm.values.routings.length - 1 && !isReadOnly && (
                        <Button
                          variant="light"
                          color="red"
                          mt={25}
                          onClick={() => routingForm.removeListItem("routings", index)}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                    </Grid.Col>
                  </Grid>
                </Box>
              ))}
            </Stack>

            <Group justify="space-between" mt="xl">
              <Button variant="default" onClick={() => setActive((c) => c - 1)}>
                Back
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Stepper 3: Select Bookings */}
        <Stepper.Step label="3" description="Select Bookings">
          <Box mt="md">
            <Group justify="space-between" align="center" mb="md">
              <Text size="md" fw={600} c="#105476">
                Select Export Bookings
              </Text>
              <Group gap="md">
                <Text size="sm" c="dimmed">
                  Total: {bookingList.length} booking(s)
                </Text>
                <Text size="sm" c="dimmed">
                  Selected: {selectedBookings.size} booking(s)
                </Text>
              </Group>
            </Group>

            {isLoadingBookings ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Loader size="lg" color="#105476" />
                  <Text c="dimmed">Loading bookings...</Text>
                </Stack>
              </Center>
            ) : bookingList.length === 0 ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Text c="dimmed" size="lg">
                    No bookings found
                  </Text>
                  <Text c="dimmed" size="sm">
                    No export bookings match the selected criteria
                  </Text>
                </Stack>
              </Center>
            ) : (
              <MantineReactTable table={bookingTable} />
            )}

            <Group justify="space-between" mt="xl">
              <Button variant="default" onClick={() => setActive((c) => c - 1)}>
                Back
              </Button>
              {!isReadOnly ? (
                <Button
                  rightSection={<IconCheck size={16} />}
                  onClick={handleSubmit}
                  color="teal"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Generate Job
                </Button>
              ) : (
                <Button
                  variant="outline"
                  color="#105476"
                  onClick={() => navigate("/air/job-generation")}
                >
                  Close
                </Button>
              )}
            </Group>
          </Box>
        </Stepper.Step>
      </Stepper>
    </Box>
  );
}

export default AirJobGenerationCreate;
