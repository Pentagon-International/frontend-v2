import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Center,
  Loader,
  Tabs,
} from "@mantine/core";
import {
  carrierDisplayFormat,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../../utils/carrierSelect";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconCheck,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  SingleDateInput,
  DateTimeInput,
} from "../../../components";
import dayjs from "dayjs";
import FormTextInput from "../../../components/FormTextInput";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";
import {
  formatLocalDateTime,
  parseLocalDateTime,
} from "../../../utils/localDateTime";

import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { apiCallProtected } from "../../../api/axios";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { API_HEADER } from "../../../store/storeKeys";
import { getAPICall } from "../../../service/getApiCall";
import { Checkbox } from "@mantine/core";

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
  schedule: string;
  carrier_code: string;
  carrier_name: string;
  master_no: string;
  master_date: string;
  flight_no: string;
};

type RoutingDetail = {
  id?: number;
  transport_type: string;
  from_port_code: string;
  from_port_name: string;
  to_port_code: string;
  to_port_name: string;
  eta: string;
  etd: string;
  ata: string;
  atd: string;
  carrier_code: string;
  carrier_name: string;
  transport_no: string;
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

type ServiceMasterItem = {
  service_code: string;
  service_name: string;
};

const fetchInlandExportServices = async (): Promise<ServiceMasterItem[]> => {
  const response = await getAPICall(
    `${URL.serviceMaster}?filter=inland_export`,
    API_HEADER
  );
  return Array.isArray(response) ? response : [];
};

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
  schedule: yup.string().required("Schedule is required"),
  carrier_code: yup.string().required("Carrier is required"),
  master_no: yup
  .string()
    .required("MAWB Number is required")
    .matches(/^[A-Za-z0-9]{11}$/, "MAWB Number must be exactly 11 characters"),
  master_date: yup.string().optional(),
  flight_no: yup.string().optional(),
});

const routingDetailsSchema = yup.object({
  routings: yup
    .array()
    .of(
      yup.object({
        transport_type: yup.string().optional(),
        from_port_code: yup.string().required("From is required"),
        to_port_code: yup.string().required("To is required"),
        eta: yup.string().required("ETA is required"),
        etd: yup.string().required("ETD is required"),
        ata: yup.string().optional(),
        atd: yup.string().optional(),
        carrier_code: yup.string().required("Carrier is required"),
        transport_no: yup.string().optional(),
        vessel: yup.string().optional(),
      })
    )
    .min(1, "At least one routing is required"),
});

function InlandExportJobGenerationCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job as Record<string, unknown> | undefined;
  console.log("Job Data-------------------------------------",jobData)
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
  const [isGeneratingJob, setIsGeneratingJob] = useState(false);
  const [existingBookingDetails, setExistingBookingDetails] = useState<
    Record<number, number>
  >({});

  const { data: inlandExportServices = [] } = useQuery({
    queryKey: ["serviceMaster", "inland_export"],
    queryFn: fetchInlandExportServices,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const inlandServiceOptions = useMemo(
    () =>
      inlandExportServices.map((item) => ({
        value: item.service_code,
        label: item.service_name || item.service_code,
      })),
    [inlandExportServices]
  );

  const jobDetailsForm = useForm<JobDetailsForm>({
    initialValues: {
      service: "INLAND",
      agent_code: "",
      agent_name: "",
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      eta: "",
      etd: "",
      ata: "",
      atd: "",
      cutoff_date: dayjs().format("YYYY-MM-DD"),
      schedule: "",
      carrier_code: "",
      carrier_name: "",
      master_no: "",
      master_date: "",
      flight_no: "",
    },
    validate: yupResolver(jobDetailsSchema),
  });

  const routingForm = useForm({
    initialValues: {
      routings: [
        {
          transport_type: "",
          from_port_code: "",
          from_port_name: "",
          to_port_code: "",
          to_port_name: "",
          eta: "",
          etd: "",
          ata: "",
          atd: "",
          carrier_code: "",
          carrier_name: "",
          transport_no: "",
          vessel: "",
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

      const etaStr = (jobData.eta as string) || "";
      const etdStr = (jobData.etd as string) || "";
      const ataStr = (jobData.ata as string) || "";
      const atdStr = (jobData.atd as string) || "";
      jobDetailsForm.setValues({
        service: (jobData.service as string) || "INLAND",
        agent_code: (jobData.agent_code as string) || (jobData.agent_code as string) || "",
        agent_name: (jobData.agent_name as string) || "",
        origin_code: (jobData.origin_code as string) || "",
        origin_name: (jobData.origin_name as string) || "",
        destination_code: (jobData.destination_code as string) || "",
        destination_name: (jobData.destination_name as string) || "",
        eta: etaStr,
        etd: etdStr,
        ata: ataStr || "",
        atd: atdStr || "",
        cutoff_date: (jobData.cut_off_date as string) || dayjs().format("YYYY-MM-DD"),
        schedule: (jobData.schedule as string) || "",
        carrier_code: (jobData.carrier_code as string) || "",
        carrier_name: (jobData.carrier_name as string) || "",
        master_no: (jobData.master_no as string) || "",
        master_date: (jobData.master_date as string) || "",
        flight_no: (jobData.flight_no as string) || "",
      });

      const apiRoutings = jobData.routing_details as Array<{
        id?: number;
        transport_type?: string;
        from_port_code?: string;
        from_port_name?: string;
        to_port_code?: string;
        to_port_name?: string;
        eta?: string;
        etd?: string;
        ata?: string;
        atd?: string;
        carrier_code?: string;
        carrier_name?: string;
        transport_no?: string;
        vessel?: string;
      }> | undefined;
      if (apiRoutings && Array.isArray(apiRoutings) && apiRoutings.length > 0) {
        routingForm.setFieldValue(
          "routings",
          apiRoutings.map((r) => ({
            id: r.id,
            transport_type: r.transport_type || "",
            from_port_code: r.from_port_code || "",
            from_port_name: r.from_port_name || "",
            to_port_code: r.to_port_code || "",
            to_port_name: r.to_port_name || "",
            eta: r.eta ? dayjs(r.eta).format("YYYY-MM-DD") : "",
            etd: r.etd ? dayjs(r.etd).format("YYYY-MM-DD") : "",
            ata: r.ata ? dayjs(r.ata).format("YYYY-MM-DD") : "",
            atd: r.atd ? dayjs(r.atd).format("YYYY-MM-DD") : "",
            carrier_code: r.carrier_code || "",
            carrier_name: r.carrier_name || "",
            transport_no: r.transport_no || "",
            vessel: r.vessel || "",
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

      const bookingDetails = jobData.booking_details as Array<{ id?: number; booking_id?: number }> | undefined;
      if (bookingDetails && Array.isArray(bookingDetails)) {
        const idMap: Record<number, number> = {};
        bookingDetails.forEach((d) => {
          const bid = d.booking_id;
          if (bid != null && d.id != null) idMap[bid] = d.id;
        });
        setExistingBookingDetails(idMap);
      }
    }
  }, [jobData, mode]);

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
          status: ["BOOKED", "RECEIVED"],
          service: "INLAND",
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

  const resolveServicePayloadValue = () => {
    const selectedService = inlandExportServices.find(
      (item) => item.service_code === jobDetailsForm.values.service
    );
    return selectedService?.service_name || jobDetailsForm.values.service;
  };

  const buildPayload = (status: "PENDING" | "GENERATED") => ({
    service: resolveServicePayloadValue(),
    service_type: "EXPORT",
    status,
    agent_code: jobDetailsForm.values.agent_code || undefined,
    origin_code: jobDetailsForm.values.origin_code,
    destination_code: jobDetailsForm.values.destination_code,
    schedule: jobDetailsForm.values.schedule,
    carrier_code: jobDetailsForm.values.carrier_code,
    cut_off_date: jobDetailsForm.values.cutoff_date,
    eta: jobDetailsForm.values.eta,
    etd: jobDetailsForm.values.etd,
    ata: jobDetailsForm.values.ata || undefined,
    atd: jobDetailsForm.values.atd || undefined,
    master_no: jobDetailsForm.values.master_no || undefined,
    master_date: jobDetailsForm.values.master_date || undefined,
    flight_no: jobDetailsForm.values.flight_no || undefined,
    routing_details: routingForm.values.routings.map((r) => ({
      ...(r.id != null ? { id: r.id } : {}),
      transport_type: r.transport_type,
      from_port_code: r.from_port_code,
      to_port_code: r.to_port_code,
      carrier_code: r.carrier_code,
      transport_no: r.transport_no,
      etd: r.etd,
      eta: r.eta,
      atd: r.atd,
      ata: r.ata,
      vessel: r.transport_type === "SEA" ? r.vessel : "",
    })),
    booking_details: Array.from(selectedBookings).map((booking_id) => ({
      ...(existingBookingDetails[booking_id] != null
        ? { id: existingBookingDetails[booking_id] }
        : {}),
      booking_id,
    })),
  });

  const handleSaveBooking = async () => {
    if (viewMode) return;

    const jobValidation = jobDetailsForm.validate();
    if (jobValidation.hasErrors) {
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

    const payload = buildPayload("PENDING");

    setIsSubmitting(true);

    try {
      let responseData: { success?: boolean; message?: string } | undefined;

      if (jobId) {
        const { putAPICall } = await import("../../../service/putApiCall");
        const putPayload = { id: jobId, ...payload };
        const response = await putAPICall(URL.booking, putPayload, API_HEADER);
        responseData = response as { success?: boolean; message?: string };

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
        const response = await apiCallProtected.post(URL.booking, payload);
        type CreateResponseData = {
          id?: number;
          booking_id?: number;
          routing_details?: Array<{ id?: number }>;
          booking_details?: Array<{ id?: number; booking_id?: number }>;
        };
        type CreateResponse = {
          success?: boolean;
          message?: string;
          data?: CreateResponseData;
          id?: number;
          booking_id?: number;
        };
        const createResponse = response as CreateResponse;
        responseData = createResponse;

        if (createResponse?.success === true) {
          ToastNotification({
            type: "success",
            message: "Booking created successfully",
          });

          const resData = createResponse?.data;
          const createdId =
            resData?.id ??
            createResponse?.id ??
            resData?.booking_id ??
            createResponse?.booking_id;

          if (createdId) {
            setJobId(createdId);
            setEditMode(true);
            setViewMode(false);
          }

          // Map create response to edit payload ids: routing_details[].id and booking_details[].id
          if (resData?.routing_details && Array.isArray(resData.routing_details)) {
            routingForm.setFieldValue(
              "routings",
              routingForm.values.routings.map((r, i) => ({
                ...r,
                id: resData.routing_details?.[i]?.id ?? r.id,
              }))
            );
          }
          if (resData?.booking_details && Array.isArray(resData.booking_details)) {
            const idMap: Record<number, number> = {};
            resData.booking_details.forEach((bd: { id?: number; booking_id?: number }) => {
              const bid = bd.booking_id;
              if (bid != null && bd.id != null) idMap[bid] = bd.id;
            });
            setExistingBookingDetails((prev) => ({ ...prev, ...idMap }));
          }
        } else {
          ToastNotification({
            type: "error",
            message: createResponse?.message || "Failed to create booking",
          });
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      ToastNotification({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to save booking",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateJob = async () => {
    if (!editMode || viewMode || !jobId) return;

    const jobValidation = jobDetailsForm.validate();
    if (jobValidation.hasErrors) {
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
      const putPayload = { id: jobId, ...payload };
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
            message: "Redirecting to Inland export job page...",
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
            navigate("/inland/export-job/edit", { state: { job } });
            return;
          }
        } catch (fetchErr) {
          console.error("Error fetching job after generate:", fetchErr);
        }
        navigate("/inland/export-job/edit", {
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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      ToastNotification({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to generate job",
      });
    } finally {
      setIsGeneratingJob(false);
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

  useEffect(() => {
    if (!jobDetailsForm.values.service && inlandServiceOptions.length > 0) {
      jobDetailsForm.setFieldValue("service", inlandServiceOptions[0].value);
    }
  }, [inlandServiceOptions, jobDetailsForm]);

  return (
    <Box px="md" py="md" w="100%">
      <EditPageHeadingRow
        visible={(mode === "edit" || mode === "view") && !!jobData}
        auditSource={jobData}
        animateKey={jobData?.id}
        ariaLabel="Inland export job generation audit info"
        justify="flex-start"
      >
        <Text size="xl" fw={600} c="#105476" mb="lg">
          {mode === "view"
            ? "View Inland Export Job Generation"
            : mode === "edit"
              ? "Edit Inland Export Job Generation"
              : "Create Inland Export Job Generation"}
        </Text>
      </EditPageHeadingRow>

      <Tabs value={String(active)} onChange={(v) => v !== null && setActive(Number(v))} color="#105476">
        <Tabs.List mb="md" style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "none" }}>
          <Tabs.Tab value="0" style={{ textAlign: "center", padding: "12px", backgroundColor: "transparent", borderBottom: active === 0 ? "3px solid #105476" : "none", color: "#105476", fontSize: 16, fontWeight: active === 0 ? 600 : 400 }}>Job Details</Tabs.Tab>
          <Tabs.Tab value="1" style={{ textAlign: "center", padding: "12px", backgroundColor: "transparent", borderBottom: active === 1 ? "3px solid #105476" : "none", color: "#105476", fontSize: 16, fontWeight: active === 1 ? 600 : 400 }}>Routing Details</Tabs.Tab>
          <Tabs.Tab value="2" style={{ textAlign: "center", padding: "12px", backgroundColor: "transparent", borderBottom: active === 2 ? "3px solid #105476" : "none", color: "#105476", fontSize: 16, fontWeight: active === 2 ? 600 : 400 }}>Select Bookings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="0">
          <Box mt="md">
            {/* First section: Service, Agent, Origin, Destination */}
            <Grid>
              <Grid.Col span={3}>
                <Dropdown
                  label="Service"
                  withAsterisk
                  placeholder="Select Service"
                  searchable
                  data={inlandServiceOptions}
                  value={jobDetailsForm.values.service || null}
                  onChange={(value) =>
                    jobDetailsForm.setFieldValue("service", value || "")
                  }
                  error={jobDetailsForm.errors.service as string}
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <SearchableSelect
                  label="Agent"
                  apiEndpoint={URL.agent}
                  placeholder="Type agent name"
                  searchFields={["customer_code", "customer_name"]}
                  dropdownZIndex={310}
                  displayFormat={(item: Record<string, unknown>) => {
                    const row = item as { customer_code?: string; customer_name?: string; agent_code?: string; agent_name?: string };
                    const code = row.customer_code ?? row.agent_code ?? "";
                    const name = row.customer_name ?? row.agent_name ?? code;
                    return { value: String(code), label: String(name) };
                  }}
                  value={jobDetailsForm.values.agent_code}
                  displayValue={
                    jobDetailsForm.values.agent_name
                      ? `${jobDetailsForm.values.agent_name}`
                      : jobDetailsForm.values.agent_code || ""
                  }
                  onChange={(value, selectedData) => {
                    jobDetailsForm.setFieldValue("agent_code", value || "");
                    jobDetailsForm.setFieldValue("agent_name", parseCarrierNameFromLabel(selectedData?.label || ""));
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
                  displayFormat={(item: Record<string, unknown>) => {
                    const port = item as { port_code: string; port_name: string };
                    return {
                      value: String(port.port_code),
                      label: `${port.port_name} (${port.port_code})`,
                    };
                  }}
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
                  additionalParams={{ transport_mode: "AIR" }}
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
                  displayFormat={(item: Record<string, unknown>) => {
                    const port = item as { port_code: string; port_name: string };
                    return {
                      value: String(port.port_code),
                      label: `${port.port_name} (${port.port_code})`,
                    };
                  }}
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
                  additionalParams={{ transport_mode: "AIR" }}
                  disabled={isReadOnly}
                />
              </Grid.Col>
            </Grid>

            {/* Second section: Master No, Master Date, Cutoff, Carrier, Flight No, Schedule */}
            <Grid mt="sm">
              <Grid.Col span={3}>
                <FormTextInput
                  label="Master No"
                  placeholder="Enter master number"
                  maxLength={11}
                  {...jobDetailsForm.getInputProps("master_no")}
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <SingleDateInput
                  label="Master Date"
                  value={jobDetailsForm.values.master_date ? dayjs(jobDetailsForm.values.master_date).toDate() : null}
                  onChange={(date) => jobDetailsForm.setFieldValue("master_date", date ? dayjs(date).format("YYYY-MM-DD") : "")}
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <SingleDateInput
                  label="Cutoff Date"
                  withAsterisk
                  value={jobDetailsForm.values.cutoff_date ? dayjs(jobDetailsForm.values.cutoff_date).toDate() : null}
                  onChange={(date) => jobDetailsForm.setFieldValue("cutoff_date", date ? dayjs(date).format("YYYY-MM-DD") : "")}
                  error={jobDetailsForm.errors.cutoff_date as string}
                  disabled={isReadOnly}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={3}>
                <SearchableSelect
                  label="Carrier"
                  required
                  apiEndpoint={URL.carrier}
                  placeholder="Type carrier code or name"
                  searchFields={["carrier_code", "carrier_name"]}
                  dropdownZIndex={310}
                  displayFormat={carrierDisplayFormat}
                  value={jobDetailsForm.values.carrier_code}
                  displayValue={formatCarrierDisplayValue(
                    jobDetailsForm.values.carrier_name,
                    jobDetailsForm.values.carrier_code,
                  )}
                  onChange={(value, selectedData) => {
                    jobDetailsForm.setFieldValue("carrier_code", value || "");
                    jobDetailsForm.setFieldValue("carrier_name", parseCarrierNameFromLabel(selectedData?.label || ""));
                  }}
                  error={jobDetailsForm.errors.carrier_code as string}
                  additionalParams={{ transport_mode: "AIR" }}
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <FormTextInput
                  label="Flight No"
                  placeholder="Enter flight number"
                  {...jobDetailsForm.getInputProps("flight_no")}
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

            {/* Third section: ETD, ETA, ATD, ATA */}
            <Grid mt="sm">
              <Grid.Col span={3}>
                <DateTimeInput
                  label="ETD"
                  withAsterisk
                  placeholder="YYYY-MM-DD HH:mm"
                  value={parseLocalDateTime(jobDetailsForm.values.etd)}
                  onChange={(value: Date | null) => {
                    jobDetailsForm.setFieldValue(
                      "etd",
                      formatLocalDateTime(value) ?? "",
                    );
                  }}
                  error={jobDetailsForm.errors.etd as string}
                  size="sm"
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <DateTimeInput
                  label="ETA"
                  withAsterisk
                  placeholder="YYYY-MM-DD HH:mm"
                  value={parseLocalDateTime(jobDetailsForm.values.eta)}
                  onChange={(value: Date | null) => {
                    jobDetailsForm.setFieldValue(
                      "eta",
                      formatLocalDateTime(value) ?? "",
                    );
                  }}
                  error={jobDetailsForm.errors.eta as string}
                  size="sm"
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <DateTimeInput
                  label="ATD"
                  placeholder="YYYY-MM-DD HH:mm"
                  value={parseLocalDateTime(jobDetailsForm.values.atd)}
                  onChange={(value: Date | null) => {
                    jobDetailsForm.setFieldValue(
                      "atd",
                      formatLocalDateTime(value) ?? "",
                    );
                  }}
                  size="sm"
                  disabled={isReadOnly}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <DateTimeInput
                  label="ATA"
                  placeholder="YYYY-MM-DD HH:mm"
                  value={parseLocalDateTime(jobDetailsForm.values.ata)}
                  onChange={(value: Date | null) => {
                    jobDetailsForm.setFieldValue(
                      "ata",
                      formatLocalDateTime(value) ?? "",
                    );
                  }}
                  size="sm"
                  disabled={isReadOnly}
                />
              </Grid.Col>
            </Grid>

            <Group justify="space-between" mt="xl">
              <Button variant="outline" color="#105476" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/inland/export-job-generation")}>
                Back to List
              </Button>
              <Group gap="sm">
                <Button variant="default" onClick={() => setActive((c) => c - 1)} disabled={active === 0}>Previous</Button>
                <Button onClick={handleNext} color="#105476">Next</Button>
                {editMode && !isReadOnly && (
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={handleGenerateJob}
                  >
                    Generate Job
                  </Button>
                )}
              </Group>
            </Group>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="1">
          <Box mt="md">
            <Text size="md" fw={600} c="#105476" mb="md">
              Routing Details
            </Text>
            {/* Header Row - Vessel column only when at least one route is SEA (same spacing/format as Ocean) */}
            {(() => {
              const hasAnySea = routingForm.values.routings.some((r) => r.transport_type === "SEA");
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
            <Stack gap="xs">
              {routingForm.values.routings.map((_, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="Select type"
                        searchable
                        data={["SEA", "AIR", "ROAD", "RAIL"]}
                        value={routingForm.values.routings[index].transport_type}
                        onChange={(value) => {
                          routingForm.setFieldValue(`routings.${index}.transport_type`, value || "");
                          if (value !== "SEA") routingForm.setFieldValue(`routings.${index}.vessel`, "");
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
                        value={routingForm.values.routings[index].from_port_code}
                        displayValue={
                          routingForm.values.routings[index].from_port_name
                            ? `${routingForm.values.routings[index].from_port_name} (${routingForm.values.routings[index].from_port_code})`
                            : routingForm.values.routings[index].from_port_code
                        }
                        onChange={(value, selectedData) => {
                          routingForm.setFieldValue(`routings.${index}.from_port_code`, value || "");
                          if (selectedData) routingForm.setFieldValue(`routings.${index}.from_port_name`, selectedData.label.split(" (")[0] || "");
                        }}
                        minSearchLength={3}
                        additionalParams={
                          getTransportMode(routingForm.values.routings[index].transport_type)
                            ? { transport_mode: getTransportMode(routingForm.values.routings[index].transport_type)! }
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
                        value={routingForm.values.routings[index].to_port_code}
                        displayValue={
                          routingForm.values.routings[index].to_port_name
                            ? `${routingForm.values.routings[index].to_port_name} (${routingForm.values.routings[index].to_port_code})`
                            : routingForm.values.routings[index].to_port_code
                        }
                        onChange={(value, selectedData) => {
                          routingForm.setFieldValue(`routings.${index}.to_port_code`, value || "");
                          if (selectedData) routingForm.setFieldValue(`routings.${index}.to_port_name`, selectedData.label.split(" (")[0] || "");
                        }}
                        minSearchLength={3}
                        additionalParams={
                          getTransportMode(routingForm.values.routings[index].transport_type)
                            ? { transport_mode: getTransportMode(routingForm.values.routings[index].transport_type)! }
                            : undefined
                        }
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={routingForm.values.routings[index].transport_type === "SEA" ? 1 : 1.5}>
                      <SearchableSelect
                        placeholder="Carrier"
                        apiEndpoint={URL.carrier}
                        searchFields={["carrier_code", "carrier_name"]}
                        dropdownZIndex={310}
                        displayFormat={carrierDisplayFormat}
                        value={routingForm.values.routings[index].carrier_code}
                        displayValue={
                          routingForm.values.routings[index].carrier_name
                            ? `${routingForm.values.routings[index].carrier_name}`
                            : routingForm.values.routings[index].carrier_code
                        }
                        onChange={(value, selectedData) => {
                          routingForm.setFieldValue(`routings.${index}.carrier_code`, value || "");
                          routingForm.setFieldValue(`routings.${index}.carrier_name`, parseCarrierNameFromLabel(selectedData?.label || ""));
                        }}
                        minSearchLength={2}
                        additionalParams={
                          getTransportMode(routingForm.values.routings[index].transport_type)
                            ? { transport_mode: getTransportMode(routingForm.values.routings[index].transport_type)! }
                            : undefined
                        }
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={routingForm.values.routings[index].transport_type === "SEA" ? 1 : 1.5}>
                      <TextInput
                        placeholder="Transport no"
                        {...routingForm.getInputProps(`routings.${index}.transport_no`)}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ETD"
                        value={routingForm.values.routings[index].etd ? dayjs(routingForm.values.routings[index].etd).toDate() : null}
                        onChange={(date) => routingForm.setFieldValue(`routings.${index}.etd`, date ? dayjs(date).format("YYYY-MM-DD") : "")}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ETA"
                        value={routingForm.values.routings[index].eta ? dayjs(routingForm.values.routings[index].eta).toDate() : null}
                        onChange={(date) => routingForm.setFieldValue(`routings.${index}.eta`, date ? dayjs(date).format("YYYY-MM-DD") : "")}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ATD"
                        value={routingForm.values.routings[index].atd ? dayjs(routingForm.values.routings[index].atd).toDate() : null}
                        onChange={(date) => routingForm.setFieldValue(`routings.${index}.atd`, date ? dayjs(date).format("YYYY-MM-DD") : "")}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <SingleDateInput
                        placeholder="ATA"
                        value={routingForm.values.routings[index].ata ? dayjs(routingForm.values.routings[index].ata).toDate() : null}
                        onChange={(date) => routingForm.setFieldValue(`routings.${index}.ata`, date ? dayjs(date).format("YYYY-MM-DD") : "")}
                        disabled={isReadOnly}
                      />
                    </Grid.Col>
                    {routingForm.values.routings[index].transport_type === "SEA" && (
                      <Grid.Col span={1}>
                        <TextInput
                          placeholder="Vessel"
                          value={routingForm.values.routings[index].vessel}
                          onChange={(e) => routingForm.setFieldValue(`routings.${index}.vessel`, e.currentTarget.value)}
                          disabled={isReadOnly}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={2}>
                      {!isReadOnly && (
                        <Group gap="xs" mt={4}>
                          {index === routingForm.values.routings.length - 1 && (
                            <Button
                              variant="light"
                              color="#105476"
                              size="xs"
                              leftSection={<IconPlus size={14} />}
                              onClick={() => {
                                routingForm.setFieldValue("routings", [
                                  ...routingForm.values.routings,
                                  {
                                    transport_type: "",
                                    from_port_code: "",
                                    from_port_name: "",
                                    to_port_code: "",
                                    to_port_name: "",
                                    eta: "",
                                    etd: "",
                                    ata: "",
                                    atd: "",
                                    carrier_code: "",
                                    carrier_name: "",
                                    transport_no: "",
                                    vessel: "",
                                  },
                                ]);
                              }}
                            >
                            </Button>
                          )}
                          {routingForm.values.routings.length > 1 && (
                            <Button variant="light" color="red" size="xs" onClick={() => routingForm.removeListItem("routings", index)}><IconTrash size={14} /></Button>
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
                onClick={() => navigate("/inland/export-job-generation")}
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
                {editMode && !isReadOnly && (
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={handleGenerateJob}
                  >
                    Generate Job
                  </Button>
                )}
              </Group>
            </Group>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="2">
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
                onClick={() => navigate("/inland/export-job-generation")}
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
                <Group gap="sm">
                  <Button variant="default" onClick={() => setActive((c) => c - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => navigate("/inland/export-job-generation")}
                  >
                    Close
                  </Button>
                </Group>
              )}
            </Group>
          </Box>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

export default InlandExportJobGenerationCreate;
