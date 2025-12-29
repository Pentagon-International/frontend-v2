import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Stepper,
  Text,
  TextInput,
  Checkbox,
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

// Type definitions
type JobDetailsForm = {
  service: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  eta: string;
  etd: string;
  cutoff_date: string;
  vessel: string;
  voyage: string;
  schedule: string;
  carrier_code: string;
  carrier_name: string;
};

type ContainerDetail = {
  container_number: string;
  container_type: string;
  custom_seal_number: string;
  actual_seal_number: string;
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

// Validation schemas
const jobDetailsSchema = yup.object({
  service: yup.string().required("Service is required"),
  origin_code: yup.string().required("Origin is required"),
  destination_code: yup.string().required("Destination is required"),
  eta: yup.string().required("ETA is required"),
  etd: yup.string().required("ETD is required"),
  cutoff_date: yup.string().required("Cutoff date is required"),
  vessel: yup.string().required("Vessel is required"),
  voyage: yup.string().required("Voyage is required"),
  schedule: yup.string().required("Schedule is required"),
  carrier_code: yup.string().required("Carrier is required"),
});

const containerDetailsSchema = yup.object({
  containers: yup
    .array()
    .of(
      yup.object({
        container_number: yup.string().required("Container number is required"),
        container_type: yup.string().required("Container type is required"),
        custom_seal_number: yup.string().optional(),
        actual_seal_number: yup.string().optional(),
      })
    )
    .min(1, "At least one container detail is required"),
});

function SeaExportCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job;

  // Detect mode from URL pathname or state
  const mode = useMemo(() => {
    // First check state (for backward compatibility)
    if (location.state?.mode) {
      return location.state.mode;
    }
    // Otherwise detect from URL pathname
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("/edit")) {
      return "edit";
    } else if (pathname.includes("/view")) {
      return "view";
    }
    return "create"; // Default
  }, [location.pathname, location.state]);

  // States for edit mode and view mode
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);

  // Detect service type from URL pathname or state
  const serviceType = useMemo(() => {
    // First check if serviceType is passed via state (from Create New button)
    if (location.state?.serviceType) {
      return location.state.serviceType;
    }
    // If jobData exists, use its service
    if (jobData?.service) {
      return jobData.service;
    }
    // Otherwise detect from URL pathname
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("lcl-job-generation")) {
      return "LCL";
    } else if (pathname.includes("fcl-job-generation")) {
      return "FCL";
    }
    return ""; // Fallback
  }, [location.pathname, location.state, jobData]);

  // State for booking list
  const [bookingList, setBookingList] = useState<BookingData[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<Set<number>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Job Details Form - Initialize with serviceType immediately
  const jobDetailsForm = useForm<JobDetailsForm>({
    initialValues: {
      service: serviceType || "",
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      eta: dayjs().format("YYYY-MM-DD"),
      etd: dayjs().format("YYYY-MM-DD"),
      cutoff_date: dayjs().format("YYYY-MM-DD"),
      vessel: "",
      voyage: "",
      schedule: "",
      carrier_code: "",
      carrier_name: "",
    },
    validate: yupResolver(jobDetailsSchema),
  });

  // Update service when serviceType changes (for cases where state is passed after mount)
  useEffect(() => {
    if (
      serviceType &&
      !jobData &&
      jobDetailsForm.values.service !== serviceType
    ) {
      jobDetailsForm.setFieldValue("service", serviceType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  // Container Details Form
  const containerForm = useForm({
    initialValues: {
      containers: [
        {
          container_number: "",
          container_type: "",
          custom_seal_number: "",
          actual_seal_number: "",
        },
      ] as ContainerDetail[],
    },
    validate: yupResolver(containerDetailsSchema),
  });

  // Set edit/view mode states
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

  // Load job data if in edit or view mode
  useEffect(() => {
    if (jobData && (mode === "edit" || mode === "view")) {
      // Set job ID for edit mode
      if (jobData.id) {
        setJobId(jobData.id);
      }

      // Populate job details - map from API response structure
      jobDetailsForm.setValues({
        service: jobData.service || serviceType || "",
        origin_code: jobData.origin_code_read || "",
        origin_name: jobData.origin_name || "",
        destination_code: jobData.destination_code_read || "",
        destination_name: jobData.destination_name || "",
        eta: jobData.eta || dayjs().format("YYYY-MM-DD"),
        etd: jobData.etd || dayjs().format("YYYY-MM-DD"),
        cutoff_date: jobData.cut_off_date || dayjs().format("YYYY-MM-DD"),
        vessel: jobData.vessel || "",
        voyage: jobData.voyage || "",
        schedule: jobData.schedule || "",
        carrier_code: jobData.carrier_code_read || "",
        carrier_name: jobData.carrier_name || "",
      });

      // Populate equipment details if exists - map from API response structure
      if (
        jobData.equipment_details &&
        Array.isArray(jobData.equipment_details) &&
        jobData.equipment_details.length > 0
      ) {
        const mappedContainers = jobData.equipment_details.map((eq: any) => ({
          container_number: eq.container_no || "",
          container_type: eq.container_type_code_read || "",
          custom_seal_number: eq.customer_seal_no || "",
          actual_seal_number: eq.actual_seal_no || "",
        }));
        containerForm.setFieldValue("containers", mappedContainers);
      }

      // Set selected bookings from shipment_details
      if (jobData.shipment_details && Array.isArray(jobData.shipment_details)) {
        const shipmentIds = jobData.shipment_details
          .map((shipment: any) => shipment.customer_service_shipment_id_read)
          .filter((id: number) => id != null);
        setSelectedBookings(new Set(shipmentIds));
      }
    }
  }, [jobData, mode, serviceType]);

  // Fetch carrier data
  const fetchCarrier = async () => {
    try {
      const response = await getAPICall(`${URL.carrier}`, API_HEADER);
      return response;
    } catch (error) {
      console.error("Error fetching carrier data:", error);
    }
  };

  const { data: carrierRes = [] } = useQuery({
    queryKey: ["carrier"],
    queryFn: fetchCarrier,
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

  // Fetch container type data
  const fetchContainerType = async () => {
    try {
      const response = await getAPICall(`${URL.containerType}`, API_HEADER);
      return response;
    } catch (error) {
      console.error("Error fetching container type data:", error);
    }
  };

  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];
    return rawContainerData.map((item: any) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name || item.container_code || "",
    }));
  }, [rawContainerData]);

  // Fetch booking list when reaching step 3
  useEffect(() => {
    if (active === 2) {
      // In view/edit mode, load bookings from jobData.shipment_details
      if ((mode === "view" || mode === "edit") && jobData?.shipment_details) {
        const bookings = jobData.shipment_details.map((shipment: any) => {
          const shipmentData = shipment.customer_service_shipment_data || {};
          return {
            id: shipment.customer_service_shipment_id_read,
            shipment_code: shipmentData.shipment_code || "",
            service_type: shipmentData.service_type || "",
            customer_name: shipmentData.customer_name || "",
            origin_name: shipmentData.origin_name || "",
            destination_name: shipmentData.destination_name || "",
            freight: shipmentData.freight || "",
            selected: true, // All are selected in view/edit mode
          };
        });
        setBookingList(bookings);
        setIsLoadingBookings(false);
      } else {
        // In create mode, fetch from API
        fetchBookingList();
      }
    }
  }, [active, mode, jobData]);

  const fetchBookingList = async () => {
    const formValues = jobDetailsForm.values;

    // Validate that we have required fields
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
          service: formValues.service, // This will be LCL or FCL based on route
          origin_code: formValues.origin_code,
          destination_code: formValues.destination_code,
        },
      };

      const response = await apiCallProtected.post(
        URL.customerServiceShipmentFilter,
        payload
      );

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
    } catch (error: any) {
      console.error("Error fetching booking list:", error);
      ToastNotification({
        type: "error",
        message: error?.message || "Failed to fetch booking list",
      });
      setBookingList([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleNext = () => {
    // Allow navigation without validation
    setActive((current) => current + 1);
  };

  const handleSubmit = async () => {
    // Don't allow submit in view mode
    if (viewMode) {
      return;
    }

    // Validate all forms
    const jobValidation = jobDetailsForm.validate();
    const containerValidation = containerForm.validate();

    if (jobValidation.hasErrors || containerValidation.hasErrors) {
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

    // Prepare payload according to API structure
    const payload = {
      service: jobDetailsForm.values.service,
      origin_code: jobDetailsForm.values.origin_code,
      destination_code: jobDetailsForm.values.destination_code,
      schedule: jobDetailsForm.values.schedule,
      vessel: jobDetailsForm.values.vessel,
      voyage: jobDetailsForm.values.voyage,
      carrier_code: jobDetailsForm.values.carrier_code,
      cut_off_date: jobDetailsForm.values.cutoff_date,
      eta: jobDetailsForm.values.eta,
      etd: jobDetailsForm.values.etd,
      equipment_details: containerForm.values.containers.map((container) => ({
        container_type_code: container.container_type,
        container_no: container.container_number,
        customer_seal_no: container.custom_seal_number,
        actual_seal_no: container.actual_seal_number,
      })),
      shipment_id: Array.from(selectedBookings),
    };

    setIsSubmitting(true);

    try {
      let response;
      let responseData;

      if (editMode && jobId) {
        // Edit mode - use PUT API
        const { putAPICall } = await import("../../../service/putApiCall");
        const { API_HEADER } = await import("../../../store/storeKeys");

        // Add id to payload for PUT request
        const putPayload = {
          id: jobId,
          ...payload,
        };

        response = await putAPICall(URL.booking, putPayload, API_HEADER);
        responseData = response as any;

        if (responseData?.success === true) {
          ToastNotification({
            type: "success",
            message: "Job updated successfully",
          });
        } else {
          ToastNotification({
            type: "error",
            message: responseData?.message || "Failed to update job",
          });
        }
      } else {
        // Create mode - use POST API
        response = await apiCallProtected.post(URL.booking, payload);
        responseData = response as any;

        if (responseData?.success === true) {
          ToastNotification({
            type: "success",
            message: "Job created successfully",
          });
        } else {
          ToastNotification({
            type: "error",
            message: responseData?.message || "Failed to create job",
          });
        }
      }

      if (responseData?.success === true) {
        // Navigate back to list based on service type
        const returnPath =
          serviceType === "LCL"
            ? "/SeaExport/lcl-job-generation"
            : "/SeaExport/fcl-job-generation";
        navigate(returnPath, { state: { refreshData: true } });
      }
    } catch (error: any) {
      console.error(
        `Error ${editMode ? "updating" : "creating"} booking:`,
        error
      );
      ToastNotification({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          `Failed to ${editMode ? "update" : "create"} job`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectBooking = (bookingId: number, checked: boolean) => {
    const newSelection = new Set(selectedBookings);
    if (checked) {
      newSelection.add(bookingId);
    } else {
      newSelection.delete(bookingId);
    }
    setSelectedBookings(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(bookingList.map((b) => b.id));
      setSelectedBookings(allIds);
    } else {
      setSelectedBookings(new Set());
    }
  };

  // Booking list columns
  const bookingColumns = useMemo<MRT_ColumnDef<BookingData>[]>(
    () => [
      {
        id: "select",
        header: "Select",
        size: 60,
        Cell: ({ row }) => (
          <Checkbox
            checked={selectedBookings.has(row.original.id)}
            onChange={(event) =>
              handleSelectBooking(row.original.id, event.currentTarget.checked)
            }
            disabled={mode === "view"}
          />
        ),
        Header: () => (
          <Checkbox
            checked={
              selectedBookings.size === bookingList.length &&
              bookingList.length > 0
            }
            indeterminate={
              selectedBookings.size > 0 &&
              selectedBookings.size < bookingList.length
            }
            onChange={(event) => handleSelectAll(event.currentTarget.checked)}
            disabled={mode === "view"}
          />
        ),
      },
      {
        accessorKey: "shipment_code",
        header: "Booking ID",
        size: 120,
      },
      {
        accessorKey: "service_type",
        header: "Service Type",
        size: 100,
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 200,
      },
      {
        accessorKey: "origin_name",
        header: "Origin",
        size: 120,
      },
      {
        accessorKey: "destination_name",
        header: "Destination",
        size: 120,
      },
      {
        accessorKey: "freight",
        header: "Freight",
        size: 100,
      },
    ],
    [selectedBookings, bookingList, mode]
  );

  const bookingTable = useMantineReactTable({
    columns: bookingColumns,
    data: bookingList,
    enableColumnFilters: false,
    enablePagination: false, // Disable pagination to allow scrolling
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
    mantinePaperProps: {
      shadow: "sm",
      radius: "sm",
      style: {
        overflow: "hidden",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
      },
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
      style: {
        maxHeight: "320px",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
  });

  const isReadOnly = viewMode;

  return (
    <Box p="md" maw={1200} mx="auto">
      <Text size="xl" fw={600} c="#105476" mb="lg">
        {mode === "view"
          ? "View Ocean Job"
          : mode === "edit"
            ? "Edit Ocean Job"
            : "Create Ocean Job"}
      </Text>

      <Stepper
        color="#105476"
        active={active}
        onStepClick={setActive}
        orientation="horizontal"
        allowNextStepsSelect={false}
      >
        {/* Stepper 1: Job Details */}
        <Stepper.Step label="1" description="Job Details">
          <Box mt="md">
            <Grid>
              <Grid.Col span={4}>
                <Dropdown
                  label="Service"
                  withAsterisk
                  placeholder="Select Service"
                  searchable
                  data={["FCL", "LCL"]}
                  {...jobDetailsForm.getInputProps("service")}
                  disabled={true} // Always disabled - auto-selected from route
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <SearchableSelect
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type origin code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: any) => ({
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
                    if (selectedData) {
                      jobDetailsForm.setFieldValue(
                        "origin_name",
                        selectedData.label.split(" (")[0] || ""
                      );
                    }
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
                  displayFormat={(item: any) => ({
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
                    jobDetailsForm.setFieldValue(
                      "destination_code",
                      value || ""
                    );
                    if (selectedData) {
                      jobDetailsForm.setFieldValue(
                        "destination_name",
                        selectedData.label.split(" (")[0] || ""
                      );
                    }
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
                  value={
                    jobDetailsForm.values.eta
                      ? dayjs(jobDetailsForm.values.eta).toDate()
                      : null
                  }
                  onChange={(date) => {
                    const formatted = date
                      ? dayjs(date).format("YYYY-MM-DD")
                      : "";
                    jobDetailsForm.setFieldValue("eta", formatted);
                  }}
                  error={jobDetailsForm.errors.eta}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  disabled={isReadOnly}
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

              <Grid.Col span={4}>
                <DateInput
                  label="ETD"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={
                    jobDetailsForm.values.etd
                      ? dayjs(jobDetailsForm.values.etd).toDate()
                      : null
                  }
                  onChange={(date) => {
                    const formatted = date
                      ? dayjs(date).format("YYYY-MM-DD")
                      : "";
                    jobDetailsForm.setFieldValue("etd", formatted);
                  }}
                  error={jobDetailsForm.errors.etd}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  disabled={isReadOnly}
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
                  onChange={(date) => {
                    const formatted = date
                      ? dayjs(date).format("YYYY-MM-DD")
                      : "";
                    jobDetailsForm.setFieldValue("cutoff_date", formatted);
                  }}
                  error={jobDetailsForm.errors.cutoff_date}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  disabled={isReadOnly}
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

              <Grid.Col span={4}>
                <TextInput
                  label="Vessel"
                  withAsterisk
                  placeholder="Enter vessel name"
                  {...jobDetailsForm.getInputProps("vessel")}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <TextInput
                  label="Voyage"
                  withAsterisk
                  placeholder="Enter voyage number"
                  {...jobDetailsForm.getInputProps("voyage")}
                  disabled={isReadOnly}
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
                    const selectedCarrier = carrierData.find(
                      (carrier) => carrier.value === value
                    );
                    if (selectedCarrier) {
                      jobDetailsForm.setFieldValue(
                        "carrier_name",
                        selectedCarrier.label
                      );
                    }
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
                onClick={() => {
                  const returnPath =
                    serviceType === "LCL"
                      ? "/SeaExport/lcl-job-generation"
                      : "/SeaExport/fcl-job-generation";
                  navigate(returnPath);
                }}
              >
                Back to List
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Stepper 2: Equipment Details */}
        <Stepper.Step label="2" description="Equipments">
          <Box mt="md">
            <Text size="md" fw={600} c="#105476" mb="md">
              Equipments:
            </Text>
            <Stack gap="md">
              {containerForm.values.containers.map((_, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={2.4}>
                      <TextInput
                        label="Container Number"
                        withAsterisk
                        placeholder="Enter container number"
                        {...containerForm.getInputProps(
                          `containers.${index}.container_number`
                        )}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <Dropdown
                        label="Container Type"
                        withAsterisk
                        placeholder="Select container type"
                        searchable
                        data={containerTypeData}
                        nothingFoundMessage="No container types found"
                        {...containerForm.getInputProps(
                          `containers.${index}.container_type`
                        )}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <TextInput
                        label="Custom Seal Number"
                        placeholder="Enter custom seal number"
                        {...containerForm.getInputProps(
                          `containers.${index}.custom_seal_number`
                        )}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <TextInput
                        label="Actual Seal Number"
                        placeholder="Enter actual seal number"
                        {...containerForm.getInputProps(
                          `containers.${index}.actual_seal_number`
                        )}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>

                    <Grid.Col span={0.4}>
                      {index === containerForm.values.containers.length - 1 &&
                        !isReadOnly && (
                          <Button
                            variant="light"
                            color="#105476"
                            mt={25}
                            leftSection={<IconPlus size={16} />}
                            onClick={() => {
                              // Add new container at the end (bottom)
                              containerForm.setFieldValue("containers", [
                                ...containerForm.values.containers,
                                {
                                  container_number: "",
                                  container_type: "",
                                  custom_seal_number: "",
                                  actual_seal_number: "",
                                },
                              ]);
                            }}
                          >
                            Add
                          </Button>
                        )}
                      {containerForm.values.containers.length > 1 &&
                        index !== containerForm.values.containers.length - 1 &&
                        !isReadOnly && (
                          <Button
                            variant="light"
                            color="red"
                            mt={25}
                            onClick={() => {
                              containerForm.removeListItem("containers", index);
                            }}
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
              <Button
                variant="default"
                onClick={() => setActive((current) => current - 1)}
              >
                Back
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Stepper 3: Booking Selection */}
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
              <Button
                variant="default"
                onClick={() => setActive((current) => current - 1)}
              >
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
                  onClick={() => {
                    const returnPath =
                      serviceType === "LCL"
                        ? "/SeaExport/lcl-job-generation"
                        : "/SeaExport/fcl-job-generation";
                    navigate(returnPath);
                  }}
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

export default SeaExportCreate;
