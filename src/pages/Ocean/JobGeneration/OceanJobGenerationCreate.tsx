import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Checkbox,
  Center,
  Loader,
  Select,
  Tabs,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconCheck,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  SingleDateInput,
} from "../../../components";
import FormTextInput from "../../../components/FormTextInput";
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
  agent_code: string;
  agent_name: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  eta: string;
  etd: string;
  ata: string;
  atd: string;
  cutoff_date: string;
  vessel: string;
  voyage: string;
  schedule: string;
  carrier_code: string;
  carrier_name: string;
  master_no: string;
  master_date: string;
};

type ContainerDetail = {
  id?: number;
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

type RoutingDetail = {
  id?: number;
  transport_type: string;
  from_port_code: string;
  to_port_code: string;
  carrier_code: string;
  transport_no: string;
  etd: string;
  eta: string;
  atd: string;
  ata: string;
  vessel: string;
};

// Helper: transport_mode for port/carrier search (SEA/AIR sent with search key)
const getTransportMode = (
  transportType: string | null | undefined
): "SEA" | "AIR" | "LAND" | undefined => {
  if (!transportType) return undefined;
  const t = transportType.trim().toUpperCase();
  if (t === "SEA") return "SEA";
  if (t === "AIR") return "AIR";
  if (t === "ROAD" || t === "RAIL") return "LAND";
  return undefined;
};

// Validation schemas
const jobDetailsSchema = yup.object({
  service: yup.string().required("Service is required"),
  agent_code: yup.string().optional(),
  origin_code: yup.string().required("Origin is required"),
  destination_code: yup.string().required("Destination is required"),
  eta: yup.string().required("ETA is required"),
  etd: yup.string().required("ETD is required"),
  ata: yup.string().optional(),
  atd: yup.string().optional(),
  cutoff_date: yup.string().required("Cutoff date is required"),
  vessel: yup.string().required("Vessel is required"),
  voyage: yup.string().required("Voyage is required"),
  schedule: yup.string().required("Schedule is required"),
  carrier_code: yup.string().required("Carrier is required"),
  master_no: yup.string().optional(),
  master_date: yup.string().optional(),
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
      }),
    )
    .min(1, "At least one container detail is required"),
});

function OceanJobGenerationCreate() {
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
    new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingJob, setIsGeneratingJob] = useState(false);
  // Stores the latest job data returned from create/update API
  // so we can reuse nested IDs (equipment, routing, booking_details) in PUT payloads.
  const [createdJobData, setCreatedJobData] = useState<any | null>(null);
  const [existingBookingDetails, setExistingBookingDetails] = useState<
    Record<number, number>
  >({});
  const [routingDetails, setRoutingDetails] = useState<RoutingDetail[]>([
    {
      transport_type: "",
      from_port_code: "",
      to_port_code: "",
      carrier_code: "",
      transport_no: "",
      etd: "",
      eta: "",
      atd: "",
      ata: "",
      vessel: "",
    },
  ]);
  // Map booking id -> selected container number (for stepper 3 payload later)
  const [bookingContainerMap, setBookingContainerMap] = useState<
    Record<number, string>
  >({});
  const hasFetchedBookingsRef = useRef(false);

  // Job Details Form - Initialize with serviceType immediately
  const jobDetailsForm = useForm<JobDetailsForm>({
    initialValues: {
      service: serviceType || "",
      agent_code: "",
      agent_name: "",
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      eta: dayjs().format("YYYY-MM-DD"),
      etd: dayjs().format("YYYY-MM-DD"),
      ata: "",
      atd: "",
      cutoff_date: dayjs().format("YYYY-MM-DD"),
      vessel: "",
      voyage: "",
      schedule: "",
      carrier_code: "",
      carrier_name: "",
      master_no: "",
      master_date: "",
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
          id: undefined,
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

      // Also store jobData locally so we can reuse nested IDs in later payloads
      setCreatedJobData(jobData as any);

      // Populate job details - map from API response structure
      jobDetailsForm.setValues({
        service: jobData.service || serviceType || "",
        agent_code: jobData.agent_code_read || jobData.agent_code || "",
        agent_name: jobData.agent_name || "",
        origin_code: jobData.origin_code_read || "",
        origin_name: jobData.origin_name || "",
        destination_code: jobData.destination_code_read || "",
        destination_name: jobData.destination_name || "",
        eta: jobData.eta || dayjs().format("YYYY-MM-DD"),
        etd: jobData.etd || dayjs().format("YYYY-MM-DD"),
        ata: jobData.ata || "",
        atd: jobData.atd || "",
        cutoff_date: jobData.cut_off_date || dayjs().format("YYYY-MM-DD"),
        vessel: jobData.vessel || "",
        voyage: jobData.voyage || "",
        schedule: jobData.schedule || "",
        carrier_code: jobData.carrier_code_read || "",
        carrier_name: jobData.carrier_name || "",
        master_no: jobData.master_no || "",
        master_date: jobData.master_date || "",
      });

      // Populate equipment details if exists - map from API response structure
      if (
        jobData.equipment_details &&
        Array.isArray(jobData.equipment_details) &&
        jobData.equipment_details.length > 0
      ) {
        const mappedContainers = jobData.equipment_details.map((eq: any) => ({
          id: eq.id,
          container_number: eq.container_no || "",
          container_type: eq.container_type_code_read || "",
          custom_seal_number: eq.customer_seal_no || "",
          actual_seal_number: eq.actual_seal_no || "",
        }));
        containerForm.setFieldValue("containers", mappedContainers);
      }

      // Populate routing details if exists
      if (
        jobData.routing_details &&
        Array.isArray(jobData.routing_details) &&
        jobData.routing_details.length > 0
      ) {
        const mappedRoutes = jobData.routing_details.map((route: any) => ({
          id: route.id,
          transport_type: route.transport_type || "",
          from_port_code: route.from_port_code || "",
          to_port_code: route.to_port_code || "",
          carrier_code: route.carrier_code || "",
          transport_no: route.transport_no || "",
          etd: route.etd || "",
          eta: route.eta || "",
          atd: route.atd || "",
          ata: route.ata || "",
          vessel: route.vessel || "",
        }));
        setRoutingDetails(mappedRoutes);
      }

      // Set selected bookings from shipment_details
      if (jobData.shipment_details && Array.isArray(jobData.shipment_details)) {
        const shipmentIds = jobData.shipment_details
          .map((shipment: any) => shipment.customer_service_shipment_id_read)
          .filter((id: number) => id != null);
        setSelectedBookings(new Set(shipmentIds));
      }

      // Map existing booking_details (for edit payload IDs & container mapping)
      const sourceBookingDetails =
        jobData.booking_details &&
        Array.isArray(jobData.booking_details) &&
        jobData.booking_details.length > 0
          ? jobData.booking_details
          : null;

      if (sourceBookingDetails) {
        const idMap: Record<number, number> = {};
        const containerMap: Record<number, string> = {};

        sourceBookingDetails.forEach((detail: any) => {
          const bookingId =
            detail.booking_id ?? detail.booking_data?.id ?? null;
          if (bookingId != null) {
            if (detail.id) {
              idMap[bookingId] = detail.id;
            }
            if (detail.container_no) {
              containerMap[bookingId] = detail.container_no;
            }
          }
        });

        setExistingBookingDetails(idMap);
        // Prefill container selections for existing bookings
        setBookingContainerMap((prev) => ({ ...containerMap, ...prev }));
      }
    }
  }, [jobData, mode, serviceType]);

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

  // Fetch booking list once when page is rendered (not on every navigation to step 3)
  useEffect(() => {
    // In view/edit mode, load bookings from jobData.shipment_details when we have it
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
      return;
    }
    // In create mode, fetch from API once when page has required fields (hit on render, not on every step navigation)
    if (mode !== "create") return;
    const formValues = jobDetailsForm.values;
    if (
      !formValues.service ||
      !formValues.origin_code ||
      !formValues.destination_code
    ) {
      return;
    }
    if (hasFetchedBookingsRef.current) return;
    hasFetchedBookingsRef.current = true;
    fetchBookingList();
  }, [mode, jobData, jobDetailsForm.values.service, jobDetailsForm.values.origin_code, jobDetailsForm.values.destination_code]);

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
        payload,
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

  const buildPayload = (status: "PENDING" | "GENERATED") => {
    // Prefer the latest job payload from the API (createdJobData)
    // for nested collections where backend has already assigned IDs.
    const sourceJobData = (createdJobData || jobData) as any | null;

    // Use backend-sourced booking_details when available so we send correct
    // booking_id and preserve existing booking_detail IDs.
    const backendBookingDetails =
      sourceJobData &&
      sourceJobData.booking_details &&
      Array.isArray(sourceJobData.booking_details) &&
      sourceJobData.booking_details.length > 0
        ? (sourceJobData.booking_details as any[])
        : null;

    return {
      service: jobDetailsForm.values.service,
      service_type: "EXPORT",
      status,
      agent_code: jobDetailsForm.values.agent_code || undefined,
      origin_code: jobDetailsForm.values.origin_code,
      destination_code: jobDetailsForm.values.destination_code,
      schedule: jobDetailsForm.values.schedule,
      vessel: jobDetailsForm.values.vessel,
      voyage: jobDetailsForm.values.voyage,
      carrier_code: jobDetailsForm.values.carrier_code,
      cut_off_date: jobDetailsForm.values.cutoff_date,
      eta: jobDetailsForm.values.eta,
      etd: jobDetailsForm.values.etd,
      ata: jobDetailsForm.values.ata,
      atd: jobDetailsForm.values.atd,
      master_no: jobDetailsForm.values.master_no,
      master_date: jobDetailsForm.values.master_date,
      equipment_details: containerForm.values.containers.map((container) => ({
        ...(container.id ? { id: container.id } : {}),
        container_type_code: container.container_type,
        container_no: container.container_number,
        customer_seal_no: container.custom_seal_number,
        actual_seal_no: container.actual_seal_number,
      })),
      routing_details: routingDetails.map((route) => ({
        ...(route.id ? { id: route.id } : {}),
        transport_type: route.transport_type,
        from_port_code: route.from_port_code,
        to_port_code: route.to_port_code,
        carrier_code: route.carrier_code,
        transport_no: route.transport_no,
        etd: route.etd,
        eta: route.eta,
        atd: route.atd,
        ata: route.ata,
        vessel: route.transport_type === "SEA" ? (route.vessel || undefined) : undefined,
      })),
      // booking_details:
      // - When we have backend booking_details (from create/edit API),
      //   use those so booking_id and internal IDs are correct.
      // - Otherwise, fall back to selected bookings from the UI.
      booking_details: backendBookingDetails
        ? backendBookingDetails.map((detail: any) => ({
            ...(detail.id ? { id: detail.id } : {}),
            booking_id:
              detail.booking_id ??
              (detail.booking_data && detail.booking_data.id) ??
              null,
            container_no: detail.container_no || "",
          }))
        : Array.from(selectedBookings).map((bookingId) => ({
            ...(existingBookingDetails[bookingId]
              ? { id: existingBookingDetails[bookingId] }
              : {}),
            booking_id: bookingId,
            container_no: bookingContainerMap[bookingId] || "",
          })),
    };
  };

  const handleSaveBooking = async () => {
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
    const payload = buildPayload("PENDING");

    setIsSubmitting(true);

    try {
      let responseData: any;

      if (jobId) {
        // Update existing booking
        const { putAPICall } = await import("../../../service/putApiCall");
        const { API_HEADER } = await import("../../../store/storeKeys");

        const putPayload = {
          id: jobId,
          ...payload,
        };

        const response = await putAPICall(URL.booking, putPayload, API_HEADER);
        responseData = response as any;

        if (responseData?.success === true) {
          ToastNotification({
            type: "success",
            message: "Booking updated successfully",
          });
        } else {
          ToastNotification({
            type: "error",
            message: responseData?.message || "Failed to update booking",
          });
        }
      } else {
        // Create new booking
        const response = await apiCallProtected.post(URL.booking, payload);
        responseData = response as any;

        if (responseData?.success === true) {
          // Store full job data from create response so that subsequent
          // Generate Job calls can reuse nested IDs (including booking_details).
          if (responseData?.data) {
            setCreatedJobData(responseData.data);
          }
          ToastNotification({
            type: "success",
            message: "Booking created successfully",
          });

          const createdId =
            responseData?.data?.id ??
            responseData?.id ??
            responseData?.data?.booking_id ??
            responseData?.booking_id;

          if (createdId) {
            setJobId(createdId);
            setEditMode(true);
            setViewMode(false);
          }
        } else {
          ToastNotification({
            type: "error",
            message: responseData?.message || "Failed to create booking",
          });
        }
      }
    } catch (error: any) {
      console.error(`Error ${jobId ? "updating" : "creating"} booking:`, error);
      ToastNotification({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          `Failed to ${jobId ? "update" : "create"} booking`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateJob = async () => {
    // Only allow generate in edit mode (existing booking) and not in view mode
    if (!editMode || viewMode || !jobId) {
      return;
    }

    // Reuse same validations as save
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

    const payload = buildPayload("GENERATED");

    setIsGeneratingJob(true);

    try {
      const { putAPICall } = await import("../../../service/putApiCall");
      const { API_HEADER } = await import("../../../store/storeKeys");

      const putPayload = {
        id: jobId,
        ...payload,
      };

      const response = await putAPICall(URL.booking, putPayload, API_HEADER);
      const responseData = response as {
        success?: boolean;
        message?: string;
        data?: { job_details_id?: number };
      };

      if (responseData?.success === true && responseData?.data?.job_details_id) {
        ToastNotification({
          type: "success",
          message: "Job generated successfully",
        });
        try {
          ToastNotification({
            type: "info",
            message: "Redirecting to Ocean job page...",
          });
          const jobListRes = await getAPICall(
            `${URL.jobCreate}${responseData.data.job_details_id}/`,
            API_HEADER
          );
          // GET: axios returns full response so body = response.data; support both shapes
          const body = (jobListRes as { data?: unknown })?.data ?? jobListRes;
          const list = Array.isArray((body as { data?: unknown[] })?.data)
            ? (body as { data: unknown[] }).data
            : Array.isArray(body)
              ? (body as unknown[])
              : [];
          const job = list.length > 0 ? (list[0] as Record<string, unknown>) : null;
          if (job) {
            navigate("/SeaExport/export-job/edit", { state: { job } });
            return;
          }
        } catch (fetchErr) {
          console.error("Error fetching job after generate:", fetchErr);
        }
        navigate("/SeaExport/export-job/edit", {
          state: { job_details_id: responseData.data.job_details_id },
        });
      } else if (responseData?.success === true) {
        ToastNotification({
          type: "success",
          message: "Job generated successfully",
        });
      } else {
        ToastNotification({
          type: "error",
          message: responseData?.message || "Failed to generate job",
        });
      }
    } catch (error: any) {
      console.error("Error generating job:", error);
      ToastNotification({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to generate job",
      });
    } finally {
      setIsGeneratingJob(false);
    }
  };

  const handleSelectBooking = (bookingId: number, checked: boolean) => {
    const newSelection = new Set(selectedBookings);
    if (checked) {
      newSelection.add(bookingId);
      // If only one container in equipment section, auto-set it for this booking
      const containers = containerForm.values.containers;
      if (containers.length === 1 && containers[0].container_number) {
        setBookingContainerMap((prev) => ({
          ...prev,
          [bookingId]: containers[0].container_number,
        }));
      }
    } else {
      newSelection.delete(bookingId);
      // Clear container selection when booking is unselected
      setBookingContainerMap((prev) => {
        const updated = { ...prev };
        delete updated[bookingId];
        return updated;
      });
    }
    setSelectedBookings(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(bookingList.map((b) => b.id));
      setSelectedBookings(allIds);
      // If only one container, set it for all selected bookings
      const containers = containerForm.values.containers;
      if (containers.length === 1 && containers[0].container_number) {
        const containerNo = containers[0].container_number;
        setBookingContainerMap((prev) => {
          const next = { ...prev };
          allIds.forEach((id) => {
            next[id] = containerNo;
          });
          return next;
        });
      }
    } else {
      setSelectedBookings(new Set());
      // Clear all container selections when none are selected
      setBookingContainerMap({});
    }
  };

  // Container numbers from Equipments stepper (step 2) for dropdown in step 3
  const containerNumberOptions = useMemo(() => {
    return containerForm.values.containers
      .filter((c) => c.container_number?.trim())
      .map((c) => ({
        value: c.container_number.trim(),
        label: c.container_number.trim(),
      }));
  }, [containerForm.values.containers]);

  // Show Container Number column only when at least one container number is given in Equipments
  const showContainerNumberColumn = containerNumberOptions.length >= 1;

  const handleContainerNumberChange = (
    bookingId: number,
    value: string | null,
  ) => {
    setBookingContainerMap((prev) => ({
      ...prev,
      [bookingId]: value ?? "",
    }));
  };

  // Booking list columns
  const bookingColumns = useMemo<MRT_ColumnDef<BookingData>[]>(() => {
    const baseColumns: MRT_ColumnDef<BookingData>[] = [
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
    ];

    if (showContainerNumberColumn) {
      baseColumns.push({
        id: "container_number",
        header: "Container Number",
        size: 180,
        Cell: ({ row }) => {
          const isSelected = selectedBookings.has(row.original.id);

          if (!isSelected) {
            // For non-selected bookings, show a disabled field with no options
            return (
              <Select
                size="xs"
                placeholder="-"
                data={[]}
                value={null}
                disabled
                styles={{
                  input: { fontSize: "12px", minHeight: 28 },
                }}
              />
            );
          }

          return (
            <Select
              size="xs"
              placeholder="Select container"
              data={containerNumberOptions}
              value={bookingContainerMap[row.original.id] || null}
              onChange={(value) =>
                handleContainerNumberChange(row.original.id, value)
              }
              clearable
              disabled={mode === "view"}
              styles={{
                input: { fontSize: "12px", minHeight: 28 },
              }}
            />
          );
        },
      });
    }

    return baseColumns;
  }, [
    selectedBookings,
    bookingList,
    mode,
    showContainerNumberColumn,
    containerNumberOptions,
    bookingContainerMap,
  ]);

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
    <Box px="md" py="md" w="100%">
      <Text size="xl" fw={600} c="#105476" mb="lg">
        {mode === "view"
          ? "View Ocean Job Generation"
          : mode === "edit"
            ? "Edit Ocean Job Generation"
            : "Create Ocean Job Generation"}
      </Text>

      <Tabs
        value={String(active)}
        onChange={(v) => v !== null && setActive(Number(v))}
        color="#105476"
      >
        <Tabs.List
          mb="md"
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            borderBottom: "none",
          }}
        >
          <Tabs.Tab
            value="0"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 0 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 0 ? 600 : 400,
            }}
          >
            Job Details
          </Tabs.Tab>
          <Tabs.Tab
            value="1"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 1 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 1 ? 600 : 400,
            }}
          >
            Equipments
          </Tabs.Tab>
          <Tabs.Tab
            value="2"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 2 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 2 ? 600 : 400,
            }}
          >
            Routing Details
          </Tabs.Tab>
          <Tabs.Tab
            value="3"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 3 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 3 ? 600 : 400,
            }}
          >
            Select Bookings
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="0">
          <Box mt="md">
            {/* First section: service, origin, destination, master no, master date, cutoff date */}
            <Grid>
              <Grid.Col span={3}>
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

              <Grid.Col span={3}>
                <SearchableSelect
                  label="Agent"
                  apiEndpoint={URL.agent}
                  placeholder="Type agent name"
                  searchFields={["customer_code", "customer_name"]}
                  dropdownZIndex={310}
                  displayFormat={(item: any) => ({
                    value: String(item.customer_code ?? item.agent_code ?? ""),
                    label: String(item.customer_name ?? item.agent_name ?? item.customer_code ?? ""),
                  })}
                  value={jobDetailsForm.values.agent_code}
                  displayValue={
                    jobDetailsForm.values.agent_name
                      ? `${jobDetailsForm.values.agent_name} (${jobDetailsForm.values.agent_code})`
                      : jobDetailsForm.values.agent_code || ""
                  }
                  onChange={(value, selectedData) => {
                    jobDetailsForm.setFieldValue("agent_code", value || "");
                    jobDetailsForm.setFieldValue(
                      "agent_name",
                      selectedData?.label?.split(" (")[0] ?? "",
                    );
                  }}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type origin code or name"
                  searchFields={["port_code", "port_name"]}
                  dropdownZIndex={310}
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
                        selectedData.label.split(" (")[0] || "",
                      );
                    }
                  }}
                  error={jobDetailsForm.errors.origin_code as string}
                  minSearchLength={3}
                  additionalParams={{ transport_mode: "SEA" }}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type destination code or name"
                  searchFields={["port_code", "port_name"]}
                  dropdownZIndex={310}
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
                      value || "",
                    );
                    if (selectedData) {
                      jobDetailsForm.setFieldValue(
                        "destination_name",
                        selectedData.label.split(" (")[0] || "",
                      );
                    }
                  }}
                  error={jobDetailsForm.errors.destination_code as string}
                  minSearchLength={3}
                  additionalParams={{ transport_mode: "SEA" }}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <FormTextInput
                  label="Master No"
                  placeholder="Enter master number"
                  {...jobDetailsForm.getInputProps("master_no")}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="Master Date"
                  value={
                    jobDetailsForm.values.master_date
                      ? dayjs(jobDetailsForm.values.master_date).toDate()
                      : null
                  }
                  onChange={(date) => {
                    const formatted = date
                      ? dayjs(date).format("YYYY-MM-DD")
                      : "";
                    jobDetailsForm.setFieldValue("master_date", formatted);
                  }}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="Cutoff Date"
                  withAsterisk
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
                  error={jobDetailsForm.errors.cutoff_date as string}
                  disabled={isReadOnly}
                />
              </Grid.Col>
            </Grid>

            <Grid mt="sm">
              <Grid.Col span={3}>
                <SearchableSelect
                  label="Carrier"
                  required
                  apiEndpoint={URL.carrier}
                  placeholder="Type carrier code or name"
                  searchFields={["carrier_code", "carrier_name"]}
                  dropdownZIndex={310}
                  displayFormat={(item: Record<string, unknown>) => {
                    const row = item as { carrier_code?: string; carrier_name?: string };
                    return {
                      value: String(row.carrier_code ?? ""),
                      label: String(row.carrier_name ?? row.carrier_code ?? ""),
                    };
                  }}
                  value={jobDetailsForm.values.carrier_code}
                  displayValue={
                    jobDetailsForm.values.carrier_name
                      ? `${jobDetailsForm.values.carrier_name} (${jobDetailsForm.values.carrier_code})`
                      : jobDetailsForm.values.carrier_code || ""
                  }
                  onChange={(value, selectedData) => {
                    jobDetailsForm.setFieldValue("carrier_code", value || "");
                    jobDetailsForm.setFieldValue(
                      "carrier_name",
                      selectedData?.label?.split(" (")[0] ?? "",
                    );
                  }}
                  error={jobDetailsForm.errors.carrier_code as string}
                  additionalParams={{ transport_mode: "SEA" }}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <FormTextInput
                  label="Vessel"
                  withAsterisk
                  placeholder="Enter vessel name"
                  {...jobDetailsForm.getInputProps("vessel")}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <FormTextInput
                  label="Voyage"
                  withAsterisk
                  placeholder="Enter voyage number"
                  {...jobDetailsForm.getInputProps("voyage")}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
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
            </Grid>

            {/* Second section: ETD, ETA, ATD, ATA */}
            <Grid mt="sm">
              <Grid.Col span={3}>
                <SingleDateInput
                  label="ETD"
                  withAsterisk
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
                  error={jobDetailsForm.errors.etd as string}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="ETA"
                  withAsterisk
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
                  error={jobDetailsForm.errors.eta as string}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="ATD"
                  value={
                    jobDetailsForm.values.atd
                      ? dayjs(jobDetailsForm.values.atd).toDate()
                      : null
                  }
                  onChange={(date) => {
                    const formatted = date
                      ? dayjs(date).format("YYYY-MM-DD")
                      : "";
                    jobDetailsForm.setFieldValue("atd", formatted);
                  }}
                  disabled={isReadOnly}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="ATA"
                  value={
                    jobDetailsForm.values.ata
                      ? dayjs(jobDetailsForm.values.ata).toDate()
                      : null
                  }
                  onChange={(date) => {
                    const formatted = date
                      ? dayjs(date).format("YYYY-MM-DD")
                      : "";
                    jobDetailsForm.setFieldValue("ata", formatted);
                  }}
                  disabled={isReadOnly}
                />
              </Grid.Col>
            </Grid>

            {/* Third section: carrier, vessel, voyage, schedule */}

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
              <Group gap="sm">
                <Button variant="default" onClick={() => setActive((c) => c - 1)} disabled={active === 0}>
                  Previous
                </Button>
                <Button onClick={handleNext} color="#105476">
                  Next
                </Button>
              </Group>
            </Group>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="1">
          <Box mt="md">
            <Text size="md" fw={600} c="#105476" mb="md">
              Equipments:
            </Text>

            {/* Header Row for Equipments */}
            <Grid mb="xs">
              <Grid.Col span={2.4}>
                <Text size="sm" fw={500} c="#105476">
                  Container Type
                </Text>
              </Grid.Col>
              <Grid.Col span={2.4}>
                <Text size="sm" fw={500} c="#105476">
                  Container Number
                </Text>
              </Grid.Col>
              <Grid.Col span={2.4}>
                <Text size="sm" fw={500} c="#105476">
                  Custom Seal Number
                </Text>
              </Grid.Col>
              <Grid.Col span={2.4}>
                <Text size="sm" fw={500} c="#105476">
                  Actual Seal Number
                </Text>
              </Grid.Col>
              <Grid.Col span={0.4}>
                <Text size="sm" fw={500} c="#105476">
                  Actions
                </Text>
              </Grid.Col>
            </Grid>

            {/* Dynamic Equipment Rows */}
            <Stack gap="xs">
              {containerForm.values.containers.map((_, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={2.4}>
                      <Dropdown
                        withAsterisk
                        placeholder="Select container type"
                        searchable
                        data={containerTypeData}
                        nothingFoundMessage="No container types found"
                        {...containerForm.getInputProps(
                          `containers.${index}.container_type`,
                        )}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <TextInput
                        withAsterisk
                        placeholder="Enter container number"
                        {...containerForm.getInputProps(
                          `containers.${index}.container_number`,
                        )}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <TextInput
                        placeholder="Enter custom seal number"
                        {...containerForm.getInputProps(
                          `containers.${index}.custom_seal_number`,
                        )}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <TextInput
                        placeholder="Enter actual seal number"
                        {...containerForm.getInputProps(
                          `containers.${index}.actual_seal_number`,
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
                            mt={4}
                            leftSection={<IconPlus size={16} />}
                            onClick={() => {
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
                            mt={4}
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
              <Group gap="sm">
                <Button variant="default" onClick={() => setActive((c) => c - 1)}>
                  Previous
                </Button>
                <Button onClick={handleNext} color="#105476">
                  Next
                </Button>
              </Group>
            </Group>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="2">
          <Box mt="md">
            <Text size="md" fw={600} c="#105476" mb="md">
              Routing Details
            </Text>

            {/* Header Row - Vessel column only when at least one route is SEA */}
            {(() => {
              const hasAnySea = routingDetails.some((r) => r.transport_type === "SEA");
              return (
                <Grid mb="xs">
                  <Grid.Col span={1}>
                    <Text size="sm" fw={500} c="#105476">
                      Transport Type
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Text size="sm" fw={500} c="#105476">
                      From Port
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Text size="sm" fw={500} c="#105476">
                      To Port
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={hasAnySea ? 1 : 1.5}>
                    <Text size="sm" fw={500} c="#105476">
                      Carrier
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={hasAnySea ? 1 : 1.5}>
                    <Text size="sm" fw={500} c="#105476">
                      Transport No
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Text size="sm" fw={500} c="#105476">
                      ETD
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Text size="sm" fw={500} c="#105476">
                      ETA
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Text size="sm" fw={500} c="#105476">
                      ATD
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Text size="sm" fw={500} c="#105476">
                      ATA
                    </Text>
                  </Grid.Col>
                  {hasAnySea && (
                    <Grid.Col span={1}>
                      <Text size="sm" fw={500} c="#105476">
                        Vessel
                      </Text>
                    </Grid.Col>
                  )}
                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="#105476">
                      Actions
                    </Text>
                  </Grid.Col>
                </Grid>
              );
            })()}

            {/* Dynamic Routing Rows */}
            <Stack gap="xs">
              {routingDetails.map((route, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="Select type"
                        searchable
                        data={["SEA", "AIR", "ROAD", "RAIL"]}
                        value={route.transport_type}
                        onChange={(value) => {
                          const updated = [...routingDetails];
                          updated[index] = {
                            ...updated[index],
                            transport_type: value || "",
                            ...(value !== "SEA" ? { vessel: "" } : {}),
                          };
                          setRoutingDetails(updated);
                        }}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SearchableSelect
                        placeholder="From port code or name"
                        apiEndpoint={URL.portMaster}
                        searchFields={["port_code", "port_name"]}
                        dropdownZIndex={310}
                        displayFormat={(item: Record<string, unknown>) => {
                          const port = item as { port_code: string; port_name: string };
                          return { value: String(port.port_code), label: `${port.port_name} (${port.port_code})` };
                        }}
                        value={route.from_port_code}
                        onChange={(value) => {
                          const updated = [...routingDetails];
                          updated[index] = { ...updated[index], from_port_code: value || "" };
                          setRoutingDetails(updated);
                        }}
                        minSearchLength={3}
                        additionalParams={
                          getTransportMode(route.transport_type)
                            ? { transport_mode: getTransportMode(route.transport_type)! }
                            : undefined
                        }
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SearchableSelect
                        placeholder="To port code or name"
                        apiEndpoint={URL.portMaster}
                        searchFields={["port_code", "port_name"]}
                        dropdownZIndex={310}
                        displayFormat={(item: Record<string, unknown>) => {
                          const port = item as { port_code: string; port_name: string };
                          return { value: String(port.port_code), label: `${port.port_name} (${port.port_code})` };
                        }}
                        value={route.to_port_code}
                        onChange={(value) => {
                          const updated = [...routingDetails];
                          updated[index] = { ...updated[index], to_port_code: value || "" };
                          setRoutingDetails(updated);
                        }}
                        minSearchLength={3}
                        additionalParams={
                          getTransportMode(route.transport_type)
                            ? { transport_mode: getTransportMode(route.transport_type)! }
                            : undefined
                        }
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={route.transport_type === "SEA" ? 1 : 1.5}>
                      <SearchableSelect
                        placeholder="Carrier"
                        apiEndpoint={URL.carrier}
                        searchFields={["carrier_code", "carrier_name"]}
                        dropdownZIndex={310}
                        displayFormat={(item: Record<string, unknown>) => {
                          const r = item as { carrier_code?: string; carrier_name?: string };
                          return { value: String(r.carrier_code ?? ""), label: String(r.carrier_name ?? r.carrier_code ?? "") };
                        }}
                        value={route.carrier_code}
                        displayValue={route.carrier_code ? `${route.carrier_code}` : ""}
                        onChange={(value) => {
                          const updated = [...routingDetails];
                          updated[index] = { ...updated[index], carrier_code: value || "" };
                          setRoutingDetails(updated);
                        }}
                        minSearchLength={2}
                        additionalParams={
                          getTransportMode(route.transport_type)
                            ? { transport_mode: getTransportMode(route.transport_type)! }
                            : undefined
                        }
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={route.transport_type === "SEA" ? 1 : 1.5}>
                      <TextInput
                        placeholder="Transport no"
                        value={route.transport_no}
                        onChange={(event) => {
                          const updated = [...routingDetails];
                          updated[index] = {
                            ...updated[index],
                            transport_no: event.currentTarget.value,
                          };
                          setRoutingDetails(updated);
                        }}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ETD"
                        value={route.etd ? dayjs(route.etd).toDate() : null}
                        onChange={(date) => {
                          const updated = [...routingDetails];
                          updated[index] = {
                            ...updated[index],
                            etd: date ? dayjs(date).format("YYYY-MM-DD") : "",
                          };
                          setRoutingDetails(updated);
                        }}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ETA"
                        value={route.eta ? dayjs(route.eta).toDate() : null}
                        onChange={(date) => {
                          const updated = [...routingDetails];
                          updated[index] = {
                            ...updated[index],
                            eta: date ? dayjs(date).format("YYYY-MM-DD") : "",
                          };
                          setRoutingDetails(updated);
                        }}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ATD"
                        value={route.atd ? dayjs(route.atd).toDate() : null}
                        onChange={(date) => {
                          const updated = [...routingDetails];
                          updated[index] = {
                            ...updated[index],
                            atd: date ? dayjs(date).format("YYYY-MM-DD") : "",
                          };
                          setRoutingDetails(updated);
                        }}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ATA"
                        value={route.ata ? dayjs(route.ata).toDate() : null}
                        onChange={(date) => {
                          const updated = [...routingDetails];
                          updated[index] = {
                            ...updated[index],
                            ata: date ? dayjs(date).format("YYYY-MM-DD") : "",
                          };
                          setRoutingDetails(updated);
                        }}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    {route.transport_type === "SEA" && (
                      <Grid.Col span={1}>
                        <TextInput
                          placeholder="Vessel"
                          value={route.vessel}
                          onChange={(event) => {
                            const updated = [...routingDetails];
                            updated[index] = {
                              ...updated[index],
                              vessel: event.currentTarget.value,
                            };
                            setRoutingDetails(updated);
                          }}
                          disabled={isReadOnly}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={2}>
                      {!isReadOnly && (
                        <Group gap="xs" mt={4}>
                          {index === routingDetails.length - 1 && (
                            <Button
                              variant="light"
                              color="#105476"
                              size="xs"
                              leftSection={<IconPlus size={14} />}
                              onClick={() => {
                                setRoutingDetails([
                                  ...routingDetails,
                                  {
                                    transport_type: "",
                                    from_port_code: "",
                                    to_port_code: "",
                                    carrier_code: "",
                                    transport_no: "",
                                    etd: "",
                                    eta: "",
                                    atd: "",
                                    ata: "",
                                    vessel: "",
                                  },
                                ]);
                              }}
                            > 
                            </Button>
                          )}
                          {routingDetails.length > 1 && (
                            <Button
                              variant="light"
                              color="red"
                              size="xs"
                              onClick={() => {
                                setRoutingDetails(
                                  routingDetails.filter((_, i) => i !== index),
                                );
                              }}
                            >
                              <IconTrash size={14} />
                            </Button>
                          )}
                        </Group>
                      )}
                    </Grid.Col>
                  </Grid>
                </Box>
              ))}
            </Stack>

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
              <Group gap="sm">
                <Button variant="default" onClick={() => setActive((c) => c - 1)}>
                  Previous
                </Button>
                <Button onClick={handleNext} color="#105476">
                  Next
                </Button>
              </Group>
            </Group>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="3">
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
              {!isReadOnly ? (
                <Group gap="sm">
                  <Button variant="default" onClick={() => setActive((c) => c - 1)}>
                    Previous
                  </Button>
                  <Button
                    rightSection={<IconCheck size={16} />}
                    onClick={handleSaveBooking}
                    color="teal"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {jobId ? "Update" : "Create"}
                  </Button>
                  {editMode && (
                    <Button
                      variant="outline"
                      color="#105476"
                      onClick={handleGenerateJob}
                      loading={isGeneratingJob}
                      disabled={isGeneratingJob}
                    >
                      Generate Job
                    </Button>
                  )}
                </Group>
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
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

export default OceanJobGenerationCreate;
