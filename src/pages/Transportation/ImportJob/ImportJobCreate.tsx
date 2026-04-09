import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Tabs,
  Table,
  Text,
  Divider,
  Card,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Modal,
  Loader,
  Center,
  ScrollArea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconPlus,
  IconTrash,
  IconDotsVertical,
  IconEye,
  IconDownload,
  IconX,
  IconFileInvoice,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  SingleDateInput,
  EstimatesSection,
  useEstimatesForm,
} from "../../../components";
import { generateCargoArrivalNoticePDF } from "../../jobs/pdf/CargoArrivalNoticePDFTemplate";
import { generateDeliveryOrderPDF } from "../../jobs/pdf/DeliveryOrderPDFTemplate";
import useAuthStore from "../../../store/authStore";
import dayjs from "dayjs";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useQuery } from "@tanstack/react-query";
import { toTitleCase } from "../../../utils/textFormatter";
import { roundToDecimals } from "../../../utils/numberInputUtils";
import {
  extractJobDataFromPatchAxiosResponse,
  housingEventsFromJobPatchData,
} from "../../../utils/jobHousingEventsFromPatch";
import FormTextInput from "../../../components/FormTextInput";
import RequiredLabel from "../../../components/RequiredLabel";

// Type definitions
type MBLDetailsForm = {
  service: string;
  origin_agent: string; // Stores customer_code (code) for API payload
  agent_name: string;
  agent_address: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
  igm_no: string;
  igm_date: Date | null;
  shipper_id: string;
  shipper_name: string;
  shipper_email: string;
  shipper_address_id: string;
  shipper_address: string;
  consignee_id: string;
  consignee_name: string;
  consignee_email: string;
  consignee_address_id: string;
  consignee_address: string;
  carrier_agent_id: string;
  carrier_agent_name: string;
  carrier_agent_email: string;
  carrier_agent_address_id: string;
  carrier_agent_address: string;
};

type CarrierDetailsForm = {
  schedule_id: string;
  carrier_code: string;
  carrier_name: string;
  vessel_name: string;
  voyage_number: string;
  mbl_number: string;
  mbl_date: Date | null;
};

type RoutingDetail = {
  id?: number | string;
  transport_type: string;
  from_code: string;
  from_name: string;
  to_code: string;
  to_name: string;
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
  carrier_code: string;
  carrier_name: string;
  vessel: string;
  // Separate fields based on transport_type
  flight: string; // For Air transport
  truck_no: string; // For Road transport
  rail_no: string; // For Rail transport
  voyage_number: string; // For Sea transport
  // Keep flight_voyage_number for backward compatibility and UI display
  flight_voyage_number: string;
};

type ContainerDetail = {
  id?: number | string;
  container_type: string;
  container_no: string;
  actual_seal_no: string;
  customs_seal_no: string;
  loading_date: Date | null;
  unloading_date: Date | null;
  cfs_id?: number | string | null;
  cfs_name?: string;
  cfs_address?: string;
};

// Reverse invoice item (from API reverse_invoices)
type ReverseInvoiceItem = {
  id?: number;
  reverse_invoice_id?: number;
  document_no?: string;
  document_date?: string;
  total?: string | number;
  status?: string;
  day_book_name?: string;
  [key: string]: unknown;
};

// Invoice list item from /api/filter/invoice/ response
type InvoiceListItem = {
  id: number;
  invoice_id?: number;
  sno?: number;
  day_book_name?: string;
  day_book_code?: string;
  document_no?: string;
  document_date?: string;
  due_date?: string;
  status?: string;
  bill_to?: string;
  currency_code?: string;
  total?: string | number;
  charges?: Array<{
    amount?: string | number;
    amount_in_local?: string | number;
  }>;
  reverse_invoice_id?: number;
  reverse_invoices?: ReverseInvoiceItem[];
};

// Validation schemas
const mblDetailsSchema = yup.object({
  service: yup.string().required("Service is required"),
  origin_agent: yup.string().required("Origin Agent is required"),
  origin_code: yup.string().required("Origin is required"),
  destination_code: yup.string().required("Destination is required"),
  etd: yup.date().required("ETD is required"),
  eta: yup.date().required("ETA is required"),
  atd: yup.date().nullable(),
  ata: yup.date().nullable(),
  igm_no: yup.string().optional(),
  igm_date: yup.date().nullable(),
});

const carrierDetailsSchema = yup.object({
  schedule_id: yup.string().nullable(),
  carrier_code: yup.string().required("Carrier is required"),
  carrier_name: yup.string().required("Carrier is required"),
  vessel_name: yup.string().required("Vessel Name is required"),
  voyage_number: yup.string().required("Voyage Number is required"),
  mbl_number: yup.string().required("MBL Number is required"),
  mbl_date: yup.date().nullable(),
});

const containerDetailSchema = yup.object({
  container_type: yup.string().required("Container Type is required"),
  container_no: yup
    .string()
    .required("Container No is required")
    .matches(/^[A-Za-z0-9]{11}$/, "Container No must be exactly 11 characters"),
  actual_seal_no: yup.string().nullable(),
  customs_seal_no: yup.string().nullable(),
  loading_date: yup.date().nullable(),
  unloading_date: yup.date().nullable(),
  cfs_id: yup.mixed().nullable(),
});

const containerDetailsFormSchema = yup.object({
  containers: yup
    .array()
    .of(containerDetailSchema)
    .min(1, "At least one container detail is required")
    .test(
      "unique-container-no",
      "Container numbers must be unique",
      function (containers) {
        if (!containers || containers.length === 0) return true;
        const containerNos = containers
          .map((c) => c.container_no?.trim())
          .filter((no) => no && no !== "");
        const uniqueContainerNos = new Set(containerNos);
        return uniqueContainerNos.size === containerNos.length;
      },
    ),
});

// const routingSchema = yup.object({
//   transport_type: yup.string().required("Transport Type is required"),
//   from_code: yup.string().required("From is required"),
//   to_code: yup.string().required("To is required"),
//   etd: yup.date().required("ETD is required"),
//   eta: yup.date().required("ETA is required"),
//   atd: yup.date().nullable(),
//   ata: yup.date().nullable(),
//   carrier_vessel: yup.string().required("Carrier/Vessel is required"),
//   flight_voyage_number: yup
//     .string()
//     .required("Flight/Voyage Number is required"),
// });

type HousingDetail = {
  id?: number | string;
  shipment_id: string;
  hbl_number: string;
  house_date: Date | null;
  booking_id?: number | null;
  routed: string;
  routed_by?: string;
  origin_code: string;
  origin_name?: string;
  destination_code: string;
  destination_name?: string;
  customer_service: string;
  trade: string;
  agent_name: string;
  agent_address: string;
  agent_email: string;
  shipper_name: string;
  shipper_address: string;
  shipper_email: string;
  shipper_state_id: string;
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  notify1_customer_name: string;
  notify1_customer_address: string;
  notify1_customer_email: string;
  // Backward-compat (older payload keys)
  notify_customer1_name?: string;
  commodity_description: string;
  marks_no: string;
  item_no?: string;
  sub_item_no?: string;
  shipment_terms_code?: string;
  cargo_details?: Array<{
    id?: number | string;
    container_no?: number | string;
    container_id?: number | null;
    no_of_packages: number | null;
    gross_weight: number | null;
    volume: number | null;
    chargeable_weight: number | null;
    haz: boolean | null;
  }>;
  charges?: Array<{
    id?: number | string; // ID from backend when editing
    charge_id?: number | null;
    charge_name: string;
    pp_cc: string;
    unit_id?: string;
    unit_code: string;
    no_of_unit: number | null;
    currency_id?: string;
    currency: string;
    roe: number | null;
    amount_per_unit: number | null;
    amount: number | null;
    sell_local_amount?: number | null;
    unit_cost?: number | null;
    total_cost?: number | null;
    cost_local_amount?: number | null;
    supplier_code?: string | null;
    supplier_name?: string | null;
  }>;
  mbl_charges?: Array<Record<string, unknown>>;
};

type DoTypeOption = "carrier_agent" | "unstuff_place";
type DoDeliverToOption = "consignee" | "notify" | "cha";

type PartyAddressOption = {
  value: string;
  label: string;
  email: string;
  address: string;
};

// Helper function to get transport_mode based on transport_type
const getTransportMode = (
  transportType: string | null | undefined,
): string | undefined => {
  if (!transportType) return undefined;
  const type = transportType.trim().toUpperCase();
  if (type === "AIR") return "AIR";
  if (type === "SEA" || type === "FCL" || type === "LCL" || type === "VESSEL")
    return "SEA";
  if (type === "ROAD") return "LAND";
  return undefined;
};

const getAddressOptions = (
  originalData?: Record<string, unknown> | null,
): PartyAddressOption[] => {
  const addresses = Array.isArray(originalData?.addresses_data)
    ? (originalData.addresses_data as Array<Record<string, unknown>>)
    : [];
  return addresses
    .map((item) => ({
      value: String(item.id ?? ""),
      label: String(item.address ?? ""),
      email: String(item.email ?? ""),
      address: String(item.address ?? ""),
      isPrimary: String(item.address_type ?? "").toLowerCase() === "primary",
    }))
    .filter((item) => item.value && item.address)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map(({ value, label, email, address }) => ({ value, label, email, address }));
};

function ImportJobCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job;
  const user = useAuthStore((state) => state.user);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingJobById, setIsFetchingJobById] = useState(false);
  const [housingDetails, setHousingDetails] = useState<HousingDetail[]>(
    location.state?.housingDetails &&
      Array.isArray(location.state.housingDetails)
      ? location.state.housingDetails
      : [],
  );

  /** Keeps `job.housing_details` aligned with `housingDetails` (events, etc.) without retriggering the job load effect. */
  const jobWithMergedHousingDetails = useMemo(() => {
    if (!jobData) return undefined;
    if (housingDetails.length > 0) {
      return { ...jobData, housing_details: housingDetails };
    }
    return jobData;
  }, [jobData, housingDetails]);

  // PDF Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [currentHousingForPreview, setCurrentHousingForPreview] =
    useState<HousingDetail | null>(null);

  // Delivery Order preview state
  const [doPreviewOpen, setDoPreviewOpen] = useState(false);
  const [doPdfBlob, setDoPdfBlob] = useState<string | null>(null);
  const [currentHousingForDoPreview, setCurrentHousingForDoPreview] =
    useState<HousingDetail | null>(null);
  const [doConfigOpen, setDoConfigOpen] = useState(false);
  const [pendingHousingForDo, setPendingHousingForDo] =
    useState<HousingDetail | null>(null);
  const [doTypeSelection, setDoTypeSelection] = useState<DoTypeOption | null>(
    null,
  );
  const [doDeliverToSelection, setDoDeliverToSelection] =
    useState<DoDeliverToOption | null>(null);

  // Accounts tab: invoice list from filter/invoice API
  const [invoiceList, setInvoiceList] = useState<InvoiceListItem[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(false);
  const [expandedInvoiceRowId, setExpandedInvoiceRowId] = useState<
    string | null
  >(null);

  // Detect mode from URL pathname and location state
  const mode = useMemo(() => {
    const pathname = location.pathname.toLowerCase();
    const hasJobData = location.state?.job && location.state.job.id;

    // Check for edit, view, or create in the pathname
    if (pathname.includes("/edit") || hasJobData) {
      return "edit";
    } else if (pathname.includes("/view")) {
      return "view";
    }
    // Default to create if neither edit nor view
    return "create";
  }, [location.pathname, location.state]);

  const isReadOnly = mode === "view";

  // When navigated from Customer Service Import with jobId only - fetch job and show
  useEffect(() => {
    const jobId = location.state?.jobId as number | undefined;
    if (jobId == null || location.state?.job) return;
    let cancelled = false;
    const fetchAndReplace = async () => {
      setIsFetchingJobById(true);
      try {
        const jobListRes = await getAPICall(
          `${URL.jobCreate}${jobId}/`,
          API_HEADER,
        );
        const body = (jobListRes as { data?: unknown })?.data ?? jobListRes;
        const list = Array.isArray((body as { data?: unknown[] })?.data)
          ? (body as { data: unknown[] }).data
          : Array.isArray(body)
            ? (body as unknown[])
            : [];
        const job =
          list.length > 0 ? (list[0] as Record<string, unknown>) : null;
        if (!cancelled && job) {
          navigate("/SeaExport/import-job/edit", {
            state: {
              job,
              returnTo: location.state?.returnTo,
              viewMode: location.state?.viewMode,
            },
            replace: true,
          });
        } else if (!cancelled) {
          ToastNotification({
            type: "error",
            message: "Failed to load job data.",
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching job:", error);
          ToastNotification({
            type: "error",
            message: "Failed to load job. Please try again.",
          });
        }
      } finally {
        if (!cancelled) setIsFetchingJobById(false);
      }
    };
    fetchAndReplace();
    return () => {
      cancelled = true;
    };
  }, [location.state?.jobId, location.state?.job, navigate]);

  // MBL Details Form
  const mblDetailsForm = useForm<MBLDetailsForm>({
    initialValues: {
      service: "",
      origin_agent: "", // Stores customer_code
      agent_name: "",
      agent_address: "",
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      etd: null,
      eta: null,
      atd: null,
      ata: null,
      igm_no: "",
      igm_date: null,
      shipper_id: "",
      shipper_name: "",
      shipper_email: "",
      shipper_address_id: "",
      shipper_address: "",
      consignee_id: "",
      consignee_name: "",
      consignee_email: "",
      consignee_address_id: "",
      consignee_address: "",
      carrier_agent_id: "",
      carrier_agent_name: "",
      carrier_agent_email: "",
      carrier_agent_address_id: "",
      carrier_agent_address: "",
    },
    validate: yupResolver(mblDetailsSchema),
  });

  // Carrier Details Form
  const carrierDetailsForm = useForm<CarrierDetailsForm>({
    initialValues: {
      schedule_id: "",
      carrier_code: "",
      carrier_name: "",
      vessel_name: "",
      voyage_number: "",
      mbl_number: "",
      mbl_date: null,
    },
    validate: yupResolver(carrierDetailsSchema),
  });

  const partyDetailsForm = mblDetailsForm;
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    PartyAddressOption[]
  >([]);
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    PartyAddressOption[]
  >([]);
  const [carrierAgentAddressOptions, setCarrierAgentAddressOptions] = useState<
    PartyAddressOption[]
  >([]);
  const [shipperAddressSearch, setShipperAddressSearch] = useState("");
  const [consigneeAddressSearch, setConsigneeAddressSearch] = useState("");
  const [carrierAgentAddressSearch, setCarrierAgentAddressSearch] = useState("");
  const [shipperAddressCustom, setShipperAddressCustom] = useState(false);
  const [consigneeAddressCustom, setConsigneeAddressCustom] = useState(false);
  const [carrierAgentAddressCustom, setCarrierAgentAddressCustom] =
    useState(false);

  // Routings Form - Using useForm like charges in QuotationCreate
  const routingsForm = useForm<{ routings: RoutingDetail[] }>({
    initialValues: {
      routings: [
        {
          transport_type: "",
          from_code: "",
          from_name: "",
          to_code: "",
          to_name: "",
          etd: null,
          eta: null,
          atd: null,
          ata: null,
          carrier_code: "",
          carrier_name: "",
          vessel: "",
          flight: "",
          truck_no: "",
          rail_no: "",
          voyage_number: "",
          flight_voyage_number: "",
        },
      ],
    },
  });

  // Container Details Form - Using useForm similar to routings
  const containerDetailsForm = useForm<{ containers: ContainerDetail[] }>({
    initialValues: {
      containers: [
        {
          container_type: "",
          container_no: "",
          actual_seal_no: "",
          customs_seal_no: "",
          loading_date: null,
          unloading_date: null,
          cfs_id: null,
          cfs_name: "",
          cfs_address: "",
        },
      ],
    },
    validate: yupResolver(containerDetailsFormSchema),
  });

  const estimatesForm = useEstimatesForm();

  // Load job data if in edit or view mode
  useEffect(() => {
    if (jobData && (mode === "edit" || mode === "view")) {
      try {
        let mblData, carrierData, housingData, containerData, routingData;
        if (location.state?.fromHouseCreate) {
          setActive(3);
          mblData = location.state?.mblDetails;
          carrierData = location.state?.carrierDetails;
          housingData = location.state?.housingDetails;
          containerData = location.state?.containerDetails;
          routingData = location.state?.routings;
        } else {
          mblData = jobData;
          carrierData = jobData;
          housingData = jobData.housing_details;
          containerData = jobData.container_details;
          routingData = jobData.ocean_routings?.length
            ? jobData.ocean_routings
            : jobData.routings?.length
              ? jobData.routings
              : [];
        }
        // Populate MBL Details
        // Extract origin_agent_address from origin_agent_data if available
        let originAgentAddress = "";
        if (mblData.origin_agent_data) {
          const originAgentData = mblData.origin_agent_data as Record<
            string,
            unknown
          >;
          if (
            originAgentData.addresses_data &&
            Array.isArray(originAgentData.addresses_data)
          ) {
            const addressesData = originAgentData.addresses_data as Array<{
              id: number;
              address: string;
            }>;
            if (addressesData.length > 0 && addressesData[0].address) {
              originAgentAddress = addressesData[0].address;
            }
          }
        }

        mblDetailsForm.setValues({
          service: mblData.service || "",
          origin_agent:
            mblData.agent_code ||
            mblData.origin_agent_code ||
            mblData.origin_agent ||
            "",
          agent_name: mblData.agent_name || mblData.origin_agent_name || "",
          agent_address: originAgentAddress,
          origin_code: mblData.origin_code || "",
          origin_name: mblData.origin_name || "",
          destination_code: mblData.destination_code || "",
          destination_name: mblData.destination_name || "",
          etd:
            mblData.etd && dayjs(mblData.etd).isValid()
              ? dayjs(mblData.etd).toDate()
              : null,
          eta:
            mblData.eta && dayjs(mblData.eta).isValid()
              ? dayjs(mblData.eta).toDate()
              : null,
          atd:
            mblData.atd && dayjs(mblData.atd).isValid()
              ? dayjs(mblData.atd).toDate()
              : null,
          ata:
            mblData.ata && dayjs(mblData.ata).isValid()
              ? dayjs(mblData.ata).toDate()
              : null,
          igm_no:
            mblData.igm_no != null
              ? String(mblData.igm_no)
              : mblDetailsForm.values.igm_no || "",
          igm_date:
            mblData.igm_date && dayjs(mblData.igm_date).isValid()
              ? dayjs(mblData.igm_date).toDate()
              : mblDetailsForm.values.igm_date || null,
          shipper_id: location.state?.mblDetails?.shipper_id || "",
          shipper_name: String(mblData.shipper_name || ""),
          shipper_email: String(mblData.shipper_email || ""),
          shipper_address_id: location.state?.mblDetails?.shipper_address_id || "",
          shipper_address: String(mblData.shipper_address || ""),
          consignee_id: location.state?.mblDetails?.consignee_id || "",
          consignee_name: String(mblData.consignee_name || ""),
          consignee_email: String(mblData.consignee_email || ""),
          consignee_address_id:
            location.state?.mblDetails?.consignee_address_id || "",
          consignee_address: String(mblData.consignee_address || ""),
          carrier_agent_id: location.state?.mblDetails?.carrier_agent_id || "",
          carrier_agent_name: String(mblData.carrier_agent_name || ""),
          carrier_agent_email: String(mblData.carrier_agent_email || ""),
          carrier_agent_address_id:
            location.state?.mblDetails?.carrier_agent_address_id || "",
          carrier_agent_address: String(mblData.carrier_agent_address || ""),
        });

        // Populate Carrier Details using setValues
        // Use the exact field names from the API response
        carrierDetailsForm.setValues({
          schedule_id: carrierData.schedule_id || "",
          carrier_code: carrierData.carrier_code || "",
          carrier_name: carrierData.carrier_name || "",
          vessel_name: carrierData.vessel_name || "",
          voyage_number: carrierData.voyage_number || "",
          mbl_number: carrierData.mbl_number || "",
          mbl_date:
            carrierData.mbl_date && dayjs(carrierData.mbl_date).isValid()
              ? dayjs(carrierData.mbl_date).toDate()
              : null,
        });
        // Populate Housing Details from jobData if exists
        if (
          housingData &&
          Array.isArray(housingData) &&
          housingData.length > 0
        ) {
          const mappedHousingDetails = housingData.map(
            (house: Record<string, unknown>) => ({
              id: house.id
                ? typeof house.id === "number"
                  ? house.id
                  : Number(house.id)
                : undefined,
              shipment_id: house.shipment_id ? String(house.shipment_id) : "",
              hbl_number: house.hbl_number ? String(house.hbl_number) : "",
              house_date: house.house_date ? dayjs(house.house_date as string | Date).format("YYYY-MM-DD") : null,
              routed: house.routed
                ? String(house.routed).toLowerCase() === "self"
                  ? "self"
                  : String(house.routed).toLowerCase() === "agent"
                    ? "agent"
                    : String(house.routed).toLowerCase()
                : "",
              routed_by: house.routed_by ? String(house.routed_by) : "",
              origin_code: house.origin_code ? String(house.origin_code) : "",
              origin_name: house.origin_name ? String(house.origin_name) : "",
              destination_code: house.destination_code
                ? String(house.destination_code)
                : "",
              destination_name: house.destination_name
                ? String(house.destination_name)
                : "",
              customer_service: house.customer_service
                ? String(house.customer_service)
                : "",
              trade: house.trade ? String(house.trade) : "",
              agent_name: house.agent_name ? String(house.agent_name) : "",
              agent_address: house.agent_address ? String(house.agent_address) : "",
              agent_email: house.agent_email ? String(house.agent_email) : "",
              cha_name: house.cha_name ? String(house.cha_name) : "",
              cha_address: house.cha_address ? String(house.cha_address) : "",
              shipper_name: house.shipper_name
                ? String(house.shipper_name)
                : "",
              shipper_address: house.shipper_address
                ? String(house.shipper_address)
                : "",
              shipper_email: house.shipper_email
                ? String(house.shipper_email)
                : "",
              shipper_state_id: house.shipper_state_id
                ? String(house.shipper_state_id)
                : "",
              consignee_name: house.consignee_name
                ? String(house.consignee_name)
                : "",
              consignee_address: house.consignee_address
                ? String(house.consignee_address)
                : "",
              consignee_email: house.consignee_email
                ? String(house.consignee_email)
                : "",
              notify1_customer_name: (house.notify1_customer_name)
                ? String(house.notify1_customer_name)
                : "",
              notify1_customer_address: (house.notify1_customer_address)
                ? String(
                    house.notify1_customer_address
                  )
                : "",
              notify1_customer_email: (house.notify1_customer_email)
                ? String(house.notify1_customer_email)
                : "",
          commodity_description: house.commodity_description
            ? String(house.commodity_description)
            : "",
          marks_no: house.marks_no ? String(house.marks_no) : "",
          item_no: house.item_no ? String(house.item_no) : "",
          sub_item_no: house.sub_item_no ? String(house.sub_item_no) : "",
          shipment_terms_code: house.shipment_terms_code
            ? String(house.shipment_terms_code)
            : house.shipment_terms_name
              ? String(house.shipment_terms_name)
              : "",
          events: Array.isArray(
            (house as {
              events?: Array<{ id?: number; type?: string; date?: string }>;
            }).events,
          )
            ? (
                (house as {
                  events?: Array<{ id?: number; type?: string; date?: string }>;
                }).events ?? []
              ).map((e) => ({
                id: e.id != null ? Number(e.id) : undefined,
                type: String(e.type ?? ""),
                date: String(e.date ?? ""),
              }))
            : [],
              cargo_details:
                house.cargo_details && Array.isArray(house.cargo_details)
                  ? house.cargo_details.map(
                      (cargo: Record<string, unknown>) => ({
                        id: cargo.id
                          ? typeof cargo.id === "number"
                            ? cargo.id
                            : Number(cargo.id)
                          : undefined,
                        container_no: cargo.container_no as number | string,
                        container_id: cargo.container_id
                          ? typeof cargo.container_id === "number"
                            ? cargo.container_id
                            : Number(cargo.container_id)
                          : undefined,
                        no_of_packages: cargo.no_of_packages as number | null,
                        gross_weight: cargo.gross_weight as number | null,
                        volume: cargo.volume as number | null,
                        chargeable_weight: cargo.chargeable_weight as
                          | number
                          | null,
                        haz:
                          cargo.haz !== null && cargo.haz !== undefined
                            ? typeof cargo.haz === "boolean"
                              ? cargo.haz
                              : cargo.haz === "Yes" ||
                                cargo.haz === true ||
                                String(cargo.haz).toLowerCase() === "yes"
                            : null,
                      }),
                    )
                  : [],
              charges:
                house.charges &&
                Array.isArray(house.charges) &&
                house.charges.length > 0
                  ? house.charges.map((charge: Record<string, unknown>) => ({
                      id: charge.id
                        ? typeof charge.id === "number"
                          ? charge.id
                          : Number(charge.id)
                        : undefined,
                      charge_id:
                        charge.charge_id != null
                          ? Number(charge.charge_id)
                          : charge.id != null
                            ? Number(charge.id)
                            : null,
                      charge_name: charge.charge_name
                        ? String(charge.charge_name)
                        : "",
                      pp_cc: charge.pp_cc ? String(charge.pp_cc) : "",
                      unit_id:
                        charge.unit_id != null ? String(charge.unit_id) : "",
                      unit_code: charge.unit_code
                        ? String(charge.unit_code)
                        : "",
                      no_of_unit: charge.no_of_unit as number | null,
                      currency_id:
                        charge.currency_id != null
                          ? String(charge.currency_id)
                          : "",
                      currency: charge.currency ? String(charge.currency) : "",
                      roe:
                        charge.roe != null
                          ? typeof charge.roe === "string"
                            ? parseFloat(charge.roe) || null
                            : (charge.roe as number)
                          : null,
                      amount_per_unit:
                        charge.amount_per_unit != null
                          ? typeof charge.amount_per_unit === "string"
                            ? parseFloat(charge.amount_per_unit) || null
                            : (charge.amount_per_unit as number)
                          : null,
                      amount:
                        charge.amount != null
                          ? typeof charge.amount === "string"
                            ? parseFloat(charge.amount) || null
                            : (charge.amount as number)
                          : null,
                      sell_local_amount:
                        charge.sell_local_amount != null
                          ? typeof charge.sell_local_amount === "string"
                            ? parseFloat(charge.sell_local_amount) || null
                            : (charge.sell_local_amount as number)
                          : null,
                      unit_cost:
                        charge.unit_cost != null
                          ? typeof charge.unit_cost === "string"
                            ? parseFloat(charge.unit_cost) || null
                            : (charge.unit_cost as number)
                          : null,
                      total_cost:
                        charge.total_cost != null
                          ? typeof charge.total_cost === "string"
                            ? parseFloat(charge.total_cost) || null
                            : (charge.total_cost as number)
                          : null,
                      cost_local_amount:
                        charge.cost_local_amount != null
                          ? typeof charge.cost_local_amount === "string"
                            ? parseFloat(charge.cost_local_amount) || null
                            : (charge.cost_local_amount as number)
                          : null,
                    }))
                  : house.mbl_charges &&
                      Array.isArray(house.mbl_charges) &&
                      house.mbl_charges.length > 0
                    ? house.mbl_charges.map(
                        (charge: Record<string, unknown>) => {
                          // Handle mbl_charges structure: unit can be in charge.unit or charge.unit_details.unit_code
                          const unitCode = charge.unit_code
                            ? String(charge.unit_code)
                            : charge.unit
                              ? String(charge.unit)
                              : (charge.unit_details as Record<string, unknown>)
                                    ?.unit_code
                                ? String(
                                    (
                                      charge.unit_details as Record<
                                        string,
                                        unknown
                                      >
                                    ).unit_code,
                                  )
                                : "";

                          // Handle currency: can be in charge.currency or charge.currency_details.currency_code
                          const currencyCode = charge.currency
                            ? String(charge.currency)
                            : (
                                  charge.currency_details as Record<
                                    string,
                                    unknown
                                  >
                                )?.currency_code
                              ? String(
                                  (
                                    charge.currency_details as Record<
                                      string,
                                      unknown
                                    >
                                  ).currency_code,
                                )
                              : "";

                          // Handle roe: can be string or number
                          const roeValue =
                            charge.roe !== null && charge.roe !== undefined
                              ? typeof charge.roe === "string"
                                ? parseFloat(charge.roe) || null
                                : (charge.roe as number)
                              : null;

                          // Handle amount_per_unit: can be string or number
                          const amountPerUnit =
                            charge.amount_per_unit !== null &&
                            charge.amount_per_unit !== undefined
                              ? typeof charge.amount_per_unit === "string"
                                ? parseFloat(charge.amount_per_unit) || null
                                : (charge.amount_per_unit as number)
                              : null;

                          // Handle amount: can be string or number
                          const amount =
                            charge.amount !== null &&
                            charge.amount !== undefined
                              ? typeof charge.amount === "string"
                                ? parseFloat(charge.amount) || null
                                : (charge.amount as number)
                              : null;

                          const sellLocal =
                            (charge.sell_local_amount !== null &&
                              charge.sell_local_amount !== undefined)
                              ? typeof charge.sell_local_amount === "string"
                                ? parseFloat(charge.sell_local_amount) || null
                                : (charge.sell_local_amount as number)
                              : null;

                          const unitCost =
                            (charge.unit_cost !== null &&
                              charge.unit_cost !== undefined)
                              ? typeof charge.unit_cost === "string"
                                ? parseFloat(charge.unit_cost) || null
                                : (charge.unit_cost as number)
                              : null;

                          const totalCost =
                            (charge.total_cost !== null &&
                              charge.total_cost !== undefined)
                              ? typeof charge.total_cost === "string"
                                ? parseFloat(charge.total_cost) || null
                                : (charge.total_cost as number)
                              : null;

                          const costLocal =
                            (charge.cost_local_amount !== null &&
                              charge.cost_local_amount !== undefined)
                              ? typeof charge.cost_local_amount === "string"
                                ? parseFloat(charge.cost_local_amount) || null
                                : (charge.cost_local_amount as number)
                              : null;

                          const unitDetails = charge.unit_details as
                            | { unit_id?: number; unit_code?: string }
                            | undefined;
                          const currencyDetails = charge.currency_details as
                            | { currency_id?: number; currency_code?: string }
                            | undefined;
                          const unitIdFromApi =
                            charge.unit_id != null
                              ? String(charge.unit_id)
                              : charge.unit != null
                                ? String(charge.unit)
                                : unitDetails?.unit_id != null
                                  ? String(unitDetails.unit_id)
                                  : "";
                          const currencyIdFromApi =
                            charge.currency_id != null
                              ? String(charge.currency_id)
                              : currencyDetails?.currency_id != null
                                ? String(currencyDetails.currency_id)
                                : "";

                          return {
                            id: charge.id
                              ? typeof charge.id === "number"
                                ? charge.id
                                : Number(charge.id)
                              : undefined,
                            charge_id:
                              charge.charge_id != null
                                ? Number(charge.charge_id)
                                : charge.id != null
                                  ? Number(charge.id)
                                  : null,
                            charge_name: charge.charge_name
                              ? String(charge.charge_name)
                              : "",
                            pp_cc: charge.pp_cc ? String(charge.pp_cc) : "",
                            unit_id: unitIdFromApi,
                            unit_code: unitCode,
                            currency_id: currencyIdFromApi,
                            no_of_unit:
                              charge.no_of_unit !== null &&
                              charge.no_of_unit !== undefined
                                ? typeof charge.no_of_unit === "number"
                                  ? charge.no_of_unit
                                  : Number(charge.no_of_unit)
                                : null,
                            currency: currencyCode,
                            roe: roeValue,
                            amount_per_unit: amountPerUnit,
                            amount: amount,
                            sell_local_amount: sellLocal,
                            unit_cost: unitCost,
                            total_cost: totalCost,
                            cost_local_amount: costLocal,
                            supplier_code: charge.supplier_code
                              ? String(charge.supplier_code)
                              : "",
                            supplier_name: charge.supplier_name
                              ? String(charge.supplier_name)
                              : "",
                          };
                        },
                      )
                    : [],
            }),
          );
          setHousingDetails(mappedHousingDetails);
        }

        // Populate Routings if exists
        if (
          routingData &&
          Array.isArray(routingData) &&
          routingData.length > 0
        ) {
          const mappedRoutings = routingData.map(
            (routing: Record<string, unknown>) => {
              // Map fields based on transport type from API response
              const transportType = String(
                routing.transport_type || "",
              ).toLowerCase();

              // Extract values based on transport_type
              let flight = "";
              let truck_no = "";
              let rail_no = "";
              let voyage_number = "";
              let flightVoyageNumber = "";

              if (transportType === "sea" || transportType === "vessel") {
                voyage_number = routing.voyage_number
                  ? String(routing.voyage_number)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = voyage_number;
              } else if (transportType === "air") {
                flight = routing.flight
                  ? String(routing.flight)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = flight;
              } else if (transportType === "road") {
                truck_no = routing.truck_no
                  ? String(routing.truck_no)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = truck_no;
              } else if (transportType === "rail") {
                rail_no = routing.rail_no
                  ? String(routing.rail_no)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = rail_no;
              } else {
                // Fallback: try to determine from available fields
                if (routing.voyage_number) {
                  voyage_number = String(routing.voyage_number);
                  flightVoyageNumber = voyage_number;
                } else if (routing.flight) {
                  flight = String(routing.flight);
                  flightVoyageNumber = flight;
                } else if (routing.truck_no) {
                  truck_no = String(routing.truck_no);
                  flightVoyageNumber = truck_no;
                } else if (routing.rail_no) {
                  rail_no = String(routing.rail_no);
                  flightVoyageNumber = rail_no;
                } else if (routing.flight_voyage_number) {
                  flightVoyageNumber = String(routing.flight_voyage_number);
                }
              }

              return {
                id: routing.id
                  ? typeof routing.id === "number"
                    ? routing.id
                    : Number(routing.id)
                  : undefined,
                transport_type: routing.transport_type
                  ? String(routing.transport_type).toUpperCase()
                  : "",
                from_code: routing.from_port_code
                  ? String(routing.from_port_code)
                  : routing.from_code
                    ? String(routing.from_code)
                    : "",
                from_name: routing.from_port_name
                  ? String(routing.from_port_name)
                  : routing.from_name
                    ? String(routing.from_name)
                    : "",
                to_code: routing.to_port_code
                  ? String(routing.to_port_code)
                  : routing.to_code
                    ? String(routing.to_code)
                    : "",
                to_name: routing.to_port_name
                  ? String(routing.to_port_name)
                  : routing.to_name
                    ? String(routing.to_name)
                    : "",
                etd:
                  routing.etd && dayjs(routing.etd as string | Date).isValid()
                    ? dayjs(routing.etd as string | Date).toDate()
                    : null,
                eta:
                  routing.eta && dayjs(routing.eta as string | Date).isValid()
                    ? dayjs(routing.eta as string | Date).toDate()
                    : null,
                atd:
                  routing.atd && dayjs(routing.atd as string | Date).isValid()
                    ? dayjs(routing.atd as string | Date).toDate()
                    : null,
                ata:
                  routing.ata && dayjs(routing.ata as string | Date).isValid()
                    ? dayjs(routing.ata as string | Date).toDate()
                    : null,
                carrier_code: routing.carrier_code
                  ? String(routing.carrier_code)
                  : "",
                carrier_name: routing.carrier_name
                  ? String(routing.carrier_name)
                  : "",
                vessel: routing.vessel ? String(routing.vessel) : "",
                flight: flight,
                truck_no: truck_no,
                rail_no: rail_no,
                voyage_number: voyage_number,
                flight_voyage_number: flightVoyageNumber,
              };
            },
          );
          routingsForm.setValues({ routings: mappedRoutings });
        }

        // Populate Container Details from jobData if exists
        if (
          containerData &&
          Array.isArray(containerData) &&
          containerData.length > 0
        ) {
          const mappedContainers = containerData.map(
            (container: Record<string, unknown>) => {
              // Get container_type_code from container_type_details if available
              const containerTypeDetails = container.container_type_details as
                | Record<string, unknown>
                | undefined;
              const containerTypeCode =
                containerTypeDetails?.container_type_code
                  ? String(containerTypeDetails.container_type_code)
                  : container.container_type
                    ? String(container.container_type)
                    : "";

              // Map uploading_date to unloading_date (API uses uploading_date, form uses unloading_date)
              const unloadingDate =
                container.unloading_date || container.uploading_date;

              return {
                id: container.id
                  ? typeof container.id === "number"
                    ? container.id
                    : Number(container.id)
                  : undefined,
                container_type: containerTypeCode,
                container_no: container.container_no
                  ? String(container.container_no)
                  : "",
                actual_seal_no: container.actual_seal_no
                  ? String(container.actual_seal_no)
                  : "",
                customs_seal_no: container.customs_seal_no
                  ? String(container.customs_seal_no)
                  : "",
                loading_date:
                  container.loading_date &&
                  dayjs(container.loading_date as string | Date).isValid()
                    ? dayjs(container.loading_date as string | Date).toDate()
                    : null,
                unloading_date:
                  unloadingDate &&
                  dayjs(unloadingDate as string | Date).isValid()
                    ? dayjs(unloadingDate as string | Date).toDate()
                    : null,
                cfs_id:
                  container.cfs_id != null
                    ? typeof container.cfs_id === "number"
                      ? container.cfs_id
                      : Number(container.cfs_id)
                    : null,
                cfs_name:
                  typeof (container as { cfs_name?: string }).cfs_name ===
                  "string"
                    ? (container as { cfs_name: string }).cfs_name
                    : "",
                cfs_address:
                  typeof (container as { cfs_address?: string }).cfs_address ===
                  "string"
                    ? (container as { cfs_address: string }).cfs_address
                    : "",
              };
            },
          );
          containerDetailsForm.setValues({ containers: mappedContainers });
        }

        // Populate Estimates (master level) from jobData if exists
        const estimatesFromApi = (jobData as unknown as { estimates?: unknown })
          ?.estimates;
        const estimatesArray = Array.isArray(estimatesFromApi)
          ? (estimatesFromApi as Array<Record<string, unknown>>)
          : [];
        if (estimatesArray.length > 0) {
          const toNum = (v: unknown): number | null => {
            if (v == null) return null;
            if (typeof v === "number" && !Number.isNaN(v)) return v;
            const n = parseFloat(String(v));
            return Number.isNaN(n) ? null : n;
          };
          const normalizePpCc = (value: unknown): string => {
            const raw = String(value ?? "").trim().toUpperCase();
            if (raw === "PP" || raw === "PREPAID") return "Prepaid";
            if (raw === "CC" || raw === "COLLECT") return "Collect";
            return "";
          };

          const mappedEstimates = estimatesArray.map((e) => {
            const supplierId =
              e.supplier_id != null ? Number(e.supplier_id) : null;
            const supplierCode = String(
              e.supplier_code ??
                (supplierId != null && !Number.isNaN(supplierId)
                  ? `CUST${supplierId}`
                  : ""),
            );
            return {
              id: e.id != null ? Number(e.id) : undefined,
              supplier_code: supplierCode,
              supplier_name: String(e.supplier_name ?? ""),
              charge_id: e.charge_id != null ? Number(e.charge_id) : null,
              charge_name: String(e.charge_name ?? e.charge_code ?? ""),
              pp_cc: normalizePpCc(e.pp_cc),
              unit_id: e.unit_id != null ? String(e.unit_id) : "",
              unit_code: String(e.unit_code ?? e.unit_name ?? ""),
              no_of_unit: toNum(e.no_of_unit),
              currency_id:
                e.currency_id != null
                  ? String(e.currency_id)
                  : e.currency != null
                    ? String(e.currency)
                    : "",
              currency_code: String(e.currency_code ?? ""),
              roe: toNum(e.roe),
              cost_per_unit: toNum(e.cost_per_unit),
              total_cost: toNum(e.total_cost),
            };
          });

          const sanitizedEstimates = mappedEstimates.map((row) => ({
            id: row.id,
            supplier_code: row.supplier_code ?? "",
            supplier_name: row.supplier_name ?? "",
            charge_id: row.charge_id ?? null,
            charge_name: row.charge_name ?? "",
            pp_cc: row.pp_cc ?? "",
            unit_id: row.unit_id ?? "",
            unit_code: row.unit_code ?? "",
            no_of_unit: row.no_of_unit ?? null,
            currency_id: row.currency_id ?? "",
            currency_code: row.currency_code ?? "",
            roe: row.roe ?? null,
            cost_per_unit: row.cost_per_unit ?? null,
            total_cost: row.total_cost ?? null,
          }));

          estimatesForm.setFieldValue(
            "estimates",
            sanitizedEstimates as unknown as typeof estimatesForm.values.estimates,
          );
        }
      } catch (error) {
        console.error("Error loading job data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to load job data. Please try again.",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobData, mode]);

  // Reset active when not in edit mode and on Accounts tab
  useEffect(() => {
    if (mode !== "edit" && active === 5) setActive(0);
  }, [active, mode]);

  // Fetch invoice list when Accounts tab is active
  useEffect(() => {
    if (active !== 5) return;
    if (!jobData?.id) return;
    setInvoiceListLoading(true);
    postAPICall(
      URL.invoiceCombined,
      { filters: { shipment_no: jobData.job_id, is_agent: true } },
      API_HEADER,
    )
      .then((res: unknown) => {
        const data = (res as { data?: InvoiceListItem[] })?.data;
        setInvoiceList(Array.isArray(data) ? data : []);
      })
      .catch(() => setInvoiceList([]))
      .finally(() => setInvoiceListLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Restore form values from location.state when navigating back from HouseCreate
  // This runs after the jobData loading effect to avoid conflicts
  useEffect(() => {
    // Check if we're navigating back from HouseCreate (indicated by housingDetails in location.state)
    // const isNavigatingBackFromHouseCreate = location.state?.housingDetails && Array.isArray(location.state.housingDetails) && location.state.housingDetails.length > 0;
    const isNavigatingBackFromHouseCreate =
      location.state?.fromHouseCreate === true;
    const hasStateToRestore =
      !!(
        location.state?.mblDetails ||
        location.state?.carrierDetails ||
        location.state?.routings ||
        location.state?.containerDetails ||
        location.state?.estimates
      );

    // Restore when coming back from HouseCreate in any mode.
    // For create mode, also allow restoration when state exists.
    if (
      !isNavigatingBackFromHouseCreate &&
      !(mode === "create" && hasStateToRestore)
    ) {
      return;
    }
    // Restore form values when:
    // 1. We're navigating back from HouseCreate (has housingDetails) OR
    // 2. We're in create mode and have form data in location.state
    // But skip if we're in initial edit load (has jobData but no housingDetails)
    const shouldRestore =
      isNavigatingBackFromHouseCreate || (mode === "create" && hasStateToRestore);

    if (shouldRestore) {
      // Restore MBL Details
      if (location.state?.mblDetails) {
        const mblDetails = location.state.mblDetails;
        mblDetailsForm.setValues({
          service: mblDetails.service || "",
          origin_agent: mblDetails.origin_agent || "",
          agent_name:
            (mblDetails as { agent_name?: string } | undefined)?.agent_name || "",
          agent_address:
            (mblDetails as { agent_address?: string } | undefined)?.agent_address ||
            "",
          origin_code: mblDetails.origin_code || "",
          origin_name: mblDetails.origin_name || "",
          destination_code: mblDetails.destination_code || "",
          destination_name: mblDetails.destination_name || "",
          etd: mblDetails.etd || null,
          eta: mblDetails.eta || null,
          atd: mblDetails.atd || null,
          ata: mblDetails.ata || null,
          igm_no:
            mblDetails.igm_no != null
              ? String(mblDetails.igm_no)
              : mblDetailsForm.values.igm_no || "",
          igm_date:
            mblDetails.igm_date && dayjs(mblDetails.igm_date).isValid()
              ? dayjs(mblDetails.igm_date).toDate()
              : mblDetailsForm.values.igm_date || null,
          shipper_id:
            (mblDetails as { shipper_id?: string } | undefined)?.shipper_id || "",
          shipper_name:
            (mblDetails as { shipper_name?: string } | undefined)?.shipper_name ||
            "",
          shipper_email:
            (mblDetails as { shipper_email?: string } | undefined)?.shipper_email ||
            "",
          shipper_address_id:
            (mblDetails as { shipper_address_id?: string } | undefined)
              ?.shipper_address_id || "",
          shipper_address:
            (mblDetails as { shipper_address?: string } | undefined)
              ?.shipper_address || "",
          consignee_id:
            (mblDetails as { consignee_id?: string } | undefined)?.consignee_id ||
            "",
          consignee_name:
            (mblDetails as { consignee_name?: string } | undefined)
              ?.consignee_name || "",
          consignee_email:
            (mblDetails as { consignee_email?: string } | undefined)
              ?.consignee_email || "",
          consignee_address_id:
            (mblDetails as { consignee_address_id?: string } | undefined)
              ?.consignee_address_id || "",
          consignee_address:
            (mblDetails as { consignee_address?: string } | undefined)
              ?.consignee_address || "",
          carrier_agent_id:
            (mblDetails as { carrier_agent_id?: string } | undefined)
              ?.carrier_agent_id || "",
          carrier_agent_name:
            (mblDetails as { carrier_agent_name?: string } | undefined)
              ?.carrier_agent_name || "",
          carrier_agent_email:
            (mblDetails as { carrier_agent_email?: string } | undefined)
              ?.carrier_agent_email || "",
          carrier_agent_address_id:
            (mblDetails as { carrier_agent_address_id?: string } | undefined)
              ?.carrier_agent_address_id || "",
          carrier_agent_address:
            (mblDetails as { carrier_agent_address?: string } | undefined)
              ?.carrier_agent_address || "",
        });
      }

      // Restore Carrier Details
      if (location.state?.carrierDetails) {
        carrierDetailsForm.setValues(location.state.carrierDetails);
      }

      // Restore Routings
      if (
        location.state?.routings &&
        Array.isArray(location.state.routings) &&
        location.state.routings.length > 0
      ) {
        routingsForm.setValues({ routings: location.state.routings });
      }

      // Restore Container Details
      if (
        location.state?.containerDetails &&
        Array.isArray(location.state.containerDetails) &&
        location.state.containerDetails.length > 0
      ) {
        containerDetailsForm.setValues({
          containers: location.state.containerDetails,
        });
      }

      // Restore Estimates (master-level) if present in location.state when coming back
      if (
        location.state?.estimates &&
        Array.isArray(location.state.estimates)
      ) {
        estimatesForm.setFieldValue(
          "estimates",
          location.state.estimates as typeof estimatesForm.values.estimates,
        );
      }

      // Set active step to 2 (Container Details) when navigating back from HouseCreate
      // This ensures the user sees the HBL list after saving
      if (isNavigatingBackFromHouseCreate) {
        setActive(3);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.state?.mblDetails,
    location.state?.carrierDetails,
    location.state?.routings,
    location.state?.containerDetails,
    location.state?.estimates,
    location.state?.housingDetails,
    mode,
    jobData,
  ]);

  // Add new routing - Using insertListItem like charges form
  const addRouting = () => {
    routingsForm.insertListItem("routings", {
      transport_type: "",
      from_code: "",
      from_name: "",
      to_code: "",
      to_name: "",
      etd: null,
      eta: null,
      atd: null,
      ata: null,
      carrier_code: "",
      carrier_name: "",
      vessel: "",
      flight: "",
      truck_no: "",
      rail_no: "",
      voyage_number: "",
      flight_voyage_number: "",
    });
  };

  // Remove routing - Using removeListItem like charges form
  const removeRouting = (index: number) => {
    if (routingsForm.values.routings.length > 1) {
      routingsForm.removeListItem("routings", index);
    }
  };

  // Add new container - Using insertListItem
  const addContainer = () => {
    containerDetailsForm.insertListItem("containers", {
      container_type: "",
      container_no: "",
      actual_seal_no: "",
      customs_seal_no: "",
      loading_date: null,
      unloading_date: null,
      cfs_id: null,
      cfs_name: "",
      cfs_address: "",
    });
  };

  // Remove container - Using removeListItem
  const removeContainer = (index: number) => {
    if (containerDetailsForm.values.containers.length > 1) {
      containerDetailsForm.removeListItem("containers", index);
    }
  };

  // Validate step 1
  const validateStep1 = () => {
    const mblValid = mblDetailsForm.validate().hasErrors === false;
    const carrierValid = carrierDetailsForm.validate().hasErrors === false;
    return mblValid && carrierValid;
  };

  // Validate step 2 - Conditional validation for routings
  // If any mandatory routing field has value, all required routing fields must be filled
  // If all routing fields are empty, allow proceeding without validation (skip entirely)
  const validateStep2 = () => {
    for (const routing of routingsForm.values.routings) {
      // Check if any mandatory routing field has a non-empty value
      const transportType = routing.transport_type?.trim().toUpperCase() || "";
      const fromCode = routing.from_code?.trim() || "";
      const toCode = routing.to_code?.trim() || "";
      const carrierCode = routing.carrier_code?.trim() || "";
      const vessel = routing.vessel?.trim() || "";
      // Get the appropriate field value based on transport_type
      let flightVoyageNumber = "";
      if (transportType === "SEA" || transportType === "VESSEL") {
        flightVoyageNumber =
          routing.voyage_number?.trim() ||
          routing.flight_voyage_number?.trim() ||
          "";
      } else if (transportType === "AIR") {
        flightVoyageNumber =
          routing.flight?.trim() || routing.flight_voyage_number?.trim() || "";
      } else if (transportType === "ROAD") {
        flightVoyageNumber =
          routing.truck_no?.trim() ||
          routing.flight_voyage_number?.trim() ||
          "";
      } else if (transportType === "RAIL") {
        flightVoyageNumber =
          routing.rail_no?.trim() || routing.flight_voyage_number?.trim() || "";
      } else {
        flightVoyageNumber = routing.flight_voyage_number?.trim() || "";
      }

      const hasAnyMandatoryValue =
        transportType !== "" ||
        fromCode !== "" ||
        toCode !== "" ||
        routing.etd !== null ||
        routing.eta !== null ||
        carrierCode !== "" ||
        vessel !== "" ||
        flightVoyageNumber !== "";

      // Only validate if at least one mandatory field has a value
      // If all fields are empty/null, skip validation for this routing
      if (hasAnyMandatoryValue) {
        // Validate transport type first (required for all)
        if (transportType === "") {
          ToastNotification({
            type: "error",
            message:
              "Transport Type is required if routing details are provided",
          });
          return false;
        }

        // Validate from (origin) - required
        if (fromCode === "") {
          ToastNotification({
            type: "error",
            message:
              "From (Origin) is required if routing details are provided",
          });
          return false;
        }

        // Validate to (destination) - required
        if (toCode === "") {
          ToastNotification({
            type: "error",
            message:
              "To (Destination) is required if routing details are provided",
          });
          return false;
        }

        // Validate ETD - required
        if (!routing.etd || routing.etd === null) {
          ToastNotification({
            type: "error",
            message: "ETD is required if routing details are provided",
          });
          return false;
        }

        // Validate ETA - required
        if (!routing.eta || routing.eta === null) {
          ToastNotification({
            type: "error",
            message: "ETA is required if routing details are provided",
          });
          return false;
        }

        // Validate transport-type-specific required fields using correct field names
        if (routing.transport_type === "SEA") {
          const voyageNumber = routing.voyage_number?.trim() || "";
          if (vessel === "" || voyageNumber === "") {
            ToastNotification({
              type: "error",
              message:
                "Vessel Name and Voyage Number are required for Sea transport",
            });
            return false;
          }
        } else if (routing.transport_type === "AIR") {
          const flight = routing.flight?.trim() || "";
          if (carrierCode === "" || flight === "") {
            ToastNotification({
              type: "error",
              message: "Carrier and Flight No are required for Air transport",
            });
            return false;
          }
        } else if (routing.transport_type === "ROAD") {
          const truckNo = routing.truck_no?.trim() || "";
          if (carrierCode === "" || truckNo === "") {
            ToastNotification({
              type: "error",
              message: "Carrier and Truck No are required for Road transport",
            });
            return false;
          }
        } else if (routing.transport_type === "RAIL") {
          const railNo = routing.rail_no?.trim() || "";
          if (carrierCode === "" || railNo === "") {
            ToastNotification({
              type: "error",
              message: "Carrier and Rail No are required for Rail transport",
            });
            return false;
          }
        }
      }
      // If hasAnyMandatoryValue is false, skip validation for this routing (allow empty)
    }
    return true;
  };

  // Validate step 3 - Container Details
  // At least one container detail is required
  const validateStep3 = () => {
    const validation = containerDetailsForm.validate();
    if (validation.hasErrors) {
      // Errors are automatically set on the form, which will display field-level errors
      return false;
    }
    return true;
  };

  // Handle next step
  const handleNext = () => {
    if (active === 0) {
      if (validateStep1()) {
        setActive(1);
      }
    } else if (active === 1) {
      setActive(2);
    } else if (active === 2) {
      if (validateStep2()) {
        setActive(3);
      }
    } else if (active === 3) {
      if (validateStep3()) {
        setActive(4);
      }
    } else if (active === 4) {
      handleSubmit();
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (active > 0) {
      // Save container details to location.state before going back
      // if (active === 2) {
      //   // We're on step 3 (container details), save them before going back
      //   navigate(location.pathname, {
      //     replace: true,
      //     state: {
      //       ...location.state,
      //       containerDetails: containerDetailsForm.values.containers,
      //       // Preserve all other state
      //       ...(location.state?.housingDetails && {
      //         housingDetails: location.state.housingDetails,
      //       }),
      //       ...(location.state?.mblDetails && {
      //         mblDetails: location.state.mblDetails,
      //       }),
      //       ...(location.state?.carrierDetails && {
      //         carrierDetails: location.state.carrierDetails,
      //       }),
      //       ...(location.state?.routings && {
      //         routings: location.state.routings,
      //       }),
      //       ...(location.state?.job && { job: location.state.job }),
      //     },
      //   });
      // }
      setActive(active - 1);
    }
  };

  // Check if Save Container button should be enabled
  // At least one container must have both container_type and container_no filled
  const canSaveContainerDetails = useMemo(() => {
    return containerDetailsForm.values.containers.some(
      (container) =>
        container.container_type?.trim() && container.container_no?.trim(),
    );
  }, [containerDetailsForm.values.containers]);

  // Check if Add HBL button should be enabled
  // At least one container must have both container_type and container_no filled
  const canAddHBL = useMemo(() => {
    return containerDetailsForm.values.containers.some(
      (container) =>
        container.container_type?.trim() && container.container_no?.trim(),
    );
  }, [containerDetailsForm.values.containers]);

  // Handle save container details
  const handleSaveContainerDetails = () => {
    // Validate container details before saving
    const validation = containerDetailsForm.validate();
    if (validation.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required container details before saving",
      });
      return;
    } else {
      ToastNotification({
        type: "success",
        message: "Container details saved. Proceed for HBL Entry",
      });
      return;
    }

    // // Save container details to location.state
    // navigate(location.pathname, {
    //   replace: true,
    //   state: {
    //     ...location.state,
    //     containerDetails: containerDetailsForm.values.containers,
    //     // Preserve all other state
    //     ...(location.state?.housingDetails && {
    //       housingDetails: location.state.housingDetails,
    //     }),
    //     ...(location.state?.mblDetails && {
    //       mblDetails: location.state.mblDetails,
    //     }),
    //     ...(location.state?.carrierDetails && {
    //       carrierDetails: location.state.carrierDetails,
    //     }),
    //     ...(location.state?.routings && {
    //       routings: location.state.routings,
    //     }),
    //     ...(location.state?.job && { job: location.state.job }),
    //   },
    // });

    // // Navigate to step 1 after saving
    // setActive(2);
  };

  // Fetch container type data
  const fetchContainerType = async () => {
    try {
      const response = await getAPICall(`${URL.containerType}`, API_HEADER);
      return response;
    } catch (error) {
      console.error("Error fetching container type data:", error);
    }
  };

  // Container type data query with memoization
  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Container type options memoized
  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];
    return rawContainerData.map((item: Record<string, unknown>) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name ? String(item.container_name) : "",
    }));
  }, [rawContainerData]);

  // Memoize additionalParams to prevent SearchableSelect from recreating fetchData on every render
  // This prevents infinite API calls
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  // Don't update location state on every keystroke - only when navigating to HouseCreate
  // This prevents infinite re-renders and input issues
  // Container details are preserved in form state and passed when navigating to HouseCreate

  // Update housing details when location state changes
  useEffect(() => {
    if (
      location.state?.housingDetails &&
      Array.isArray(location.state.housingDetails) &&
      location.state.housingDetails.length > 0
    ) {
      setHousingDetails(location.state.housingDetails);
    }
  }, [location.state?.housingDetails]);

  // Remove housing detail
  const removeHousingDetail = (index: number) => {
    const updated = housingDetails.filter((_, i) => i !== index);
    setHousingDetails(updated);
  };

  // Helper function to navigate to HouseCreate with container numbers
  const navigateToHouseCreate = useCallback(
    (editIndex?: number, editData?: HousingDetail) => {
      // Validate MBL mandatory fields before navigating
      const missingFields: string[] = [];

      if (!mblDetailsForm.values.service?.trim()) {
        missingFields.push("Service");
      }
      if (!mblDetailsForm.values.origin_agent?.trim()) {
        missingFields.push("Origin Agent");
      }
      if (!mblDetailsForm.values.origin_code?.trim()) {
        missingFields.push("Origin");
      }
      if (!mblDetailsForm.values.destination_code?.trim()) {
        missingFields.push("Destination");
      }
      if (!mblDetailsForm.values.etd) {
        missingFields.push("ETD");
      }
      if (!mblDetailsForm.values.eta) {
        missingFields.push("ETA");
      }

      if (missingFields.length > 0) {
        ToastNotification({
          type: "error",
          message: `Please fill all mandatory MBL details.`,
        });
        setActive(0);
        return;
      }

      // Extract container numbers from container details
      const containerNumbers = containerDetailsForm.values.containers
        .map((container) => container.container_no)
        .filter((no) => no && no.trim() !== "");

      navigate("/SeaExport/import-job/house-create", {
        state: {
          fromHouseCreate: true,
          housingDetails: housingDetails,
          ...(editIndex !== undefined && { editIndex }),
          ...(editData && { editData }),
          ...(jobWithMergedHousingDetails && {
            job: jobWithMergedHousingDetails,
          }),
          mblDetails: {
            service: mblDetailsForm.values.service || "",
            origin_agent: mblDetailsForm.values.origin_agent || "",
            agent_name: mblDetailsForm.values.agent_name || "",
            agent_address: mblDetailsForm.values.agent_address || "",
            origin_code: mblDetailsForm.values.origin_code || "",
            origin_name: mblDetailsForm.values.origin_name || "",
            destination_code: mblDetailsForm.values.destination_code || "",
            destination_name: mblDetailsForm.values.destination_name || "",
            etd: mblDetailsForm.values.etd || null,
            eta: mblDetailsForm.values.eta || null,
            atd: mblDetailsForm.values.atd || null,
            ata: mblDetailsForm.values.ata || null,
            igm_no: mblDetailsForm.values.igm_no || "",
            igm_date: mblDetailsForm.values.igm_date || null,
            shipper_id: mblDetailsForm.values.shipper_id || "",
            shipper_name: mblDetailsForm.values.shipper_name || "",
            shipper_email: mblDetailsForm.values.shipper_email || "",
            shipper_address_id: mblDetailsForm.values.shipper_address_id || "",
            shipper_address: mblDetailsForm.values.shipper_address || "",
            consignee_id: mblDetailsForm.values.consignee_id || "",
            consignee_name: mblDetailsForm.values.consignee_name || "",
            consignee_email: mblDetailsForm.values.consignee_email || "",
            consignee_address_id: mblDetailsForm.values.consignee_address_id || "",
            consignee_address: mblDetailsForm.values.consignee_address || "",
            carrier_agent_id: mblDetailsForm.values.carrier_agent_id || "",
            carrier_agent_name: mblDetailsForm.values.carrier_agent_name || "",
            carrier_agent_email: mblDetailsForm.values.carrier_agent_email || "",
            carrier_agent_address_id:
              mblDetailsForm.values.carrier_agent_address_id || "",
            carrier_agent_address:
              mblDetailsForm.values.carrier_agent_address || "",
          },
          carrierDetails: carrierDetailsForm.values,
          routings: routingsForm.values.routings,
          containerNumbers: containerNumbers,
          containerDetails: containerDetailsForm.values.containers,
          // NEW: preserve master-level estimates when going to HouseCreate
          estimates: estimatesForm.values.estimates,
        },
      });
    },
    [
      mblDetailsForm.values,
      containerDetailsForm.values.containers,
      carrierDetailsForm.values,
      routingsForm.values.routings,
      estimatesForm.values.estimates,
      partyDetailsForm.values,
      housingDetails,
      jobWithMergedHousingDetails,
    ],
  );

  // Handle edit housing detail
  const handleEditHousingDetail = (index: number) => {
    const houseToEdit = housingDetails[index];
    navigateToHouseCreate(index, houseToEdit);
  };

  // Check if all requirements are met for Create button
  // Enable on all steps (0, 1, 2) if all required data is present
  const canCreateJob = useMemo(() => {
    // Check MBL mandatory fields
    const mblFieldsValid =
      mblDetailsForm.values.service?.trim() &&
      mblDetailsForm.values.origin_agent?.trim() &&
      mblDetailsForm.values.origin_code?.trim() &&
      mblDetailsForm.values.destination_code?.trim() &&
      mblDetailsForm.values.etd &&
      mblDetailsForm.values.eta;

    // Check at least one container detail is added with both type and number
    const hasValidContainers = containerDetailsForm.values.containers.some(
      (container) =>
        container.container_type?.trim() && container.container_no?.trim(),
    );

    // Check at least one HBL detail is added
    const hasHousingDetails = housingDetails.length > 0;

    return mblFieldsValid && hasValidContainers && hasHousingDetails;
  }, [
    mblDetailsForm.values.service,
    mblDetailsForm.values.origin_agent,
    mblDetailsForm.values.origin_code,
    mblDetailsForm.values.destination_code,
    mblDetailsForm.values.etd,
    mblDetailsForm.values.eta,
    containerDetailsForm.values.containers,
    housingDetails.length,
  ]);

  const housingAlreadyHasEventType = (
    events: unknown,
    eventType: string,
  ): boolean =>
    Array.isArray(events) &&
    events.some(
      (e: { type?: string }) => String(e?.type ?? "") === eventType,
    );

  const patchHousingPdfReleasedEvent = async (
    housingId: number | undefined,
    eventType: string,
  ) => {
    const jobId = jobData?.id;
    if (!jobId || !housingId) return;
    const currentHousing = housingDetails.find(
      (h) => Number(h.id) === Number(housingId),
    );
    if (
      housingAlreadyHasEventType(
        (currentHousing as { events?: unknown })?.events,
        eventType,
      )
    )
      return;

    const date = new Date().toISOString().slice(0, 10);

    // Optimistic update so the guard blocks re-clicks immediately
    const optimisticEvent = { type: eventType, date };
    setHousingDetails((prev) =>
      prev.map((h) =>
        Number(h.id) === Number(housingId)
          ? ({
              ...h,
              events: [
                ...((h as { events?: typeof optimisticEvent[] }).events ?? []),
                optimisticEvent,
              ],
            } as HousingDetail)
          : h,
      ),
    );
    setCurrentHousingForPreview((prev) =>
      prev && Number(prev.id) === Number(housingId)
        ? ({
            ...prev,
            events: [
              ...(
                prev as { events?: typeof optimisticEvent[] }
              ).events ?? [],
              optimisticEvent,
            ],
          } as HousingDetail)
        : prev,
    );
    setCurrentHousingForDoPreview((prev) =>
      prev && Number(prev.id) === Number(housingId)
        ? ({
            ...prev,
            events: [
              ...(
                prev as { events?: typeof optimisticEvent[] }
              ).events ?? [],
              optimisticEvent,
            ],
          } as HousingDetail)
        : prev,
    );

    const res = await apiCallProtected.patch(
      `${URL.importJob}${jobId}/`,
      {
        id: jobId,
        housing_details: [
          {
            id: housingId,
            events: [{ type: eventType, date }],
          },
        ],
      },
      API_HEADER,
    );
    const jobPayload = extractJobDataFromPatchAxiosResponse(res);
    const nextEvents = housingEventsFromJobPatchData(jobPayload, housingId);
    if (nextEvents) {
      setHousingDetails((prev) =>
        prev.map((h) =>
          Number(h.id) === Number(housingId)
            ? ({ ...h, events: nextEvents } as HousingDetail)
            : h,
        ),
      );
      setCurrentHousingForPreview((prev) =>
        prev && Number(prev.id) === Number(housingId)
          ? ({ ...prev, events: nextEvents } as HousingDetail)
          : prev,
      );
      setCurrentHousingForDoPreview((prev) =>
        prev && Number(prev.id) === Number(housingId)
          ? ({ ...prev, events: nextEvents } as HousingDetail)
          : prev,
      );
    }
  };

  // Handle form submission
  // Generate Cargo Arrival Notice PDF
  const generateCargoArrivalNoticePDFPreview = async (
    housing: HousingDetail,
  ) => {
    try {
      setPreviewOpen(true);
      setCurrentHousingForPreview(housing);

      // Get default branch from user store or use default
      const defaultBranch = user?.branches?.find(
        (branch) => branch.is_default,
      ) ||
        user?.branches?.[0] || { branch_name: "CHENNAI" };
      const country = user?.country || null;

      // Combine job data and housing data for PDF generation
      const combinedData = {
        ...(jobWithMergedHousingDetails ?? jobData),
        ...housing,
        mawbDetails: {
          service: mblDetailsForm.values.service,
          origin_agent: mblDetailsForm.values.origin_agent,
          origin_code: mblDetailsForm.values.origin_code,
          origin_name: mblDetailsForm.values.origin_name,
          destination_code: mblDetailsForm.values.destination_code,
          destination_name: mblDetailsForm.values.destination_name,
          etd: mblDetailsForm.values.etd,
          eta: mblDetailsForm.values.eta,
          atd: mblDetailsForm.values.atd,
          ata: mblDetailsForm.values.ata,
        },
        carrierDetails: {
          carrier_code: carrierDetailsForm.values.carrier_code,
          carrier_name: carrierDetailsForm.values.carrier_name,
          vessel_name: carrierDetailsForm.values.vessel_name,
          voyage_number: carrierDetailsForm.values.voyage_number,
          mbl_number: carrierDetailsForm.values.mbl_number,
          mbl_date: carrierDetailsForm.values.mbl_date,
        },
        notes: jobData?.notes || [],
      };

      const blobUrl = generateCargoArrivalNoticePDF(
        combinedData,
        housing,
        defaultBranch,
        country,
      );
      setPdfBlob(blobUrl);
      void patchHousingPdfReleasedEvent(
        typeof housing.id === "number" ? housing.id : undefined,
        "CAN Released",
      ).catch((e) => console.error("Failed to patch PDF release event:", e));
    } catch (error) {
      console.error("Error generating PDF:", error);
      ToastNotification({
        type: "error",
        message: "Error generating PDF preview",
      });
      setPreviewOpen(false);
    }
  };

  // Handle close preview
  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPdfBlob(null);
    setCurrentHousingForPreview(null);
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
  };

  // Handle download PDF
  const handleDownloadPDF = () => {
    if (pdfBlob && currentHousingForPreview) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `Cargo-Arrival-Notice-${currentHousingForPreview.hbl_number || "HBL"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  const resolveDoAttentionTo = (type: DoTypeOption, housing: HousingDetail) => {
    if (type === "carrier_agent") {
      const name = partyDetailsForm.values.carrier_agent_name || "";
      const address = partyDetailsForm.values.carrier_agent_address || "";
      return [name, address].filter(Boolean).join("\n");
    }

    const allContainerSources = [
      ...(containerDetailsForm.values.containers || []),
      ...((jobData as { containerDetails?: unknown[] } | undefined)
        ?.containerDetails || []),
      ...((jobData as { container_details?: unknown[] } | undefined)
        ?.container_details || []),
      ...((jobWithMergedHousingDetails as { container_details?: unknown[] } | undefined)
        ?.container_details || []),
    ] as Array<
      | (ContainerDetail & {
          cfs_address?: string;
          address?: string;
          cfs_details?: { address?: string; cfs_address?: string };
        })
      | Record<string, unknown>
    >;

    const mappedCargoDetails = Array.isArray(housing.cargo_details)
      ? housing.cargo_details
      : [];
    const mappedContainerIds = mappedCargoDetails
      .map((cargo) => String(cargo.container_id ?? "").trim())
      .filter(Boolean);
    const mappedContainerNos = mappedCargoDetails
      .map((cargo) => String(cargo.container_no ?? "").trim())
      .filter(Boolean);

    const matchedHouseContainer = allContainerSources.find((container) => {
      const containerId = String(
        (container as { id?: number | string }).id ?? "",
      ).trim();
      const containerNo = String(
        (container as { container_no?: string | number }).container_no ?? "",
      ).trim();
      const hasCfs = String(
        (container as { cfs_name?: string }).cfs_name || "",
      ).trim();
      return (
        !!hasCfs &&
        (mappedContainerIds.includes(containerId) ||
          mappedContainerNos.includes(containerNo))
      );
    }) as
      | (ContainerDetail & {
          cfs_address?: string;
          address?: string;
          cfs_details?: { address?: string; cfs_address?: string };
        })
      | undefined;

    const firstContainerWithCfs = allContainerSources.find((container) =>
      String((container as { cfs_name?: string }).cfs_name || "").trim(),
    ) as
      | (ContainerDetail & {
          cfs_address?: string;
          address?: string;
          cfs_details?: { address?: string; cfs_address?: string };
        })
      | undefined;

    const sourceContainer = matchedHouseContainer || firstContainerWithCfs;
    const cfsName = sourceContainer?.cfs_name || "";
    const cfsAddress =
      sourceContainer?.cfs_address ||
      sourceContainer?.address ||
      sourceContainer?.cfs_details?.address ||
      sourceContainer?.cfs_details?.cfs_address ||
      "";

    return [cfsName, cfsAddress].filter(Boolean).join("\n");
  };

  const resolveDoDeliverTo = (
    housing: HousingDetail,
    deliverTo: DoDeliverToOption,
  ) => {
    if (deliverTo === "consignee") return housing.consignee_name || "";
    if (deliverTo === "notify") {
      return (
        (housing as HousingDetail & { notify1_customer_name?: string })
          .notify1_customer_name ||
        housing.notify1_customer_name || housing.notify_customer1_name ||
        ""
      );
    }
    return (housing as HousingDetail & { cha_name?: string }).cha_name || "";
  };

  const openDoConfigModal = (housing: HousingDetail) => {
    setPendingHousingForDo(housing);
    setDoTypeSelection(null);
    setDoDeliverToSelection(null);
    setDoConfigOpen(true);
  };

  const handleGenerateDeliveryOrderFromConfig = () => {
    if (!pendingHousingForDo || !doTypeSelection || !doDeliverToSelection) {
      ToastNotification({
        type: "error",
        message: "Type and Deliver to are required",
      });
      return;
    }
    setDoConfigOpen(false);
    generateDeliveryOrderPDFPreview(
      pendingHousingForDo,
      doTypeSelection,
      doDeliverToSelection,
    );
  };

  // Generate Delivery Order PDF Preview
  const generateDeliveryOrderPDFPreview = async (
    housing: HousingDetail,
    type: DoTypeOption,
    deliverTo: DoDeliverToOption,
  ) => {
    try {
      setDoPreviewOpen(true);
      setCurrentHousingForDoPreview(housing);

      // Combine job data and housing data for PDF generation
      const combinedData = {
        ...(jobWithMergedHousingDetails ?? jobData),
        ...housing,
        mawbDetails: {
          service: mblDetailsForm.values.service,
          origin_agent: mblDetailsForm.values.origin_agent,
          origin_code: mblDetailsForm.values.origin_code,
          origin_name: mblDetailsForm.values.origin_name,
          destination_code: mblDetailsForm.values.destination_code,
          destination_name: mblDetailsForm.values.destination_name,
          etd: mblDetailsForm.values.etd,
          eta: mblDetailsForm.values.eta,
          atd: mblDetailsForm.values.atd,
          ata: mblDetailsForm.values.ata,
        },
        carrierDetails: {
          carrier_code: carrierDetailsForm.values.carrier_code,
          carrier_name: carrierDetailsForm.values.carrier_name,
          vessel_name: carrierDetailsForm.values.vessel_name,
          voyage_number: carrierDetailsForm.values.voyage_number,
          mbl_number: carrierDetailsForm.values.mbl_number,
          mbl_date: carrierDetailsForm.values.mbl_date,
        },
        containerDetails: jobData?.containerDetails || [],
      };

      const housingDataForDo = {
        ...housing,
        attention_to: resolveDoAttentionTo(type, housing),
        please_deliver_to: resolveDoDeliverTo(housing, deliverTo),
        do_heading: type === "carrier_agent" ? "DELIVERY ADVICE" : "DELIVERY ORDER",
      };
      const blobUrl = generateDeliveryOrderPDF(combinedData, housingDataForDo);
      setDoPdfBlob(blobUrl);
      void patchHousingPdfReleasedEvent(
        typeof housing.id === "number" ? housing.id : undefined,
        "DO Released",
      ).catch((e) => console.error("Failed to patch PDF release event:", e));
    } catch (error) {
      console.error("Error generating Delivery Order PDF:", error);
      ToastNotification({
        type: "error",
        message: "Error generating Delivery Order PDF preview",
      });
      setDoPreviewOpen(false);
    }
  };

  // Handle close DO preview
  const handleCloseDoPreview = () => {
    setDoPreviewOpen(false);
    setDoPdfBlob(null);
    setCurrentHousingForDoPreview(null);
    if (doPdfBlob) {
      window.URL.revokeObjectURL(doPdfBlob);
    }
  };

  const handleCloseDoConfig = () => {
    setDoConfigOpen(false);
    setPendingHousingForDo(null);
    setDoTypeSelection(null);
    setDoDeliverToSelection(null);
  };

  // Handle download DO PDF
  const handleDownloadDoPDF = () => {
    if (doPdfBlob && currentHousingForDoPreview) {
      const link = document.createElement("a");
      link.href = doPdfBlob;
      link.download = `Delivery-Order-${currentHousingForDoPreview.hbl_number || "HBL"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  const handleSubmit = async () => {
    // Ensure we're using the latest form values by constructing payload right before API call
    setIsSubmitting(true);

    // Validate: At least one HBL detail is required
    if (housingDetails.length === 0) {
      ToastNotification({
        type: "error",
        message: "At least one HBL detail is required before creating MBL",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate MBL and Carrier details before submission
    const mblValidation = mblDetailsForm.validate();
    const carrierValidation = carrierDetailsForm.validate();

    if (mblValidation.hasErrors || carrierValidation.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required fields in MBL & Carrier Details",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate routings if any field has value
    if (!validateStep2()) {
      setIsSubmitting(false);
      return;
    }

    // Validate container details - this will set field-level errors
    if (!validateStep3()) {
      // Navigate to step 3 to show validation errors
      setActive(3);
      setIsSubmitting(false);
      return;
    }
    try {
      // Backend rejects numeric fields with more than 2 decimals.
      // Round right before we build the final create/edit payload.
      const bookingIds = Array.from(
        new Set(
          (housingDetails ?? [])
            .map((h) => (h as { booking_id?: unknown }).booking_id)
            .map((v) => (v == null || v === "" ? null : Number(v)))
            .filter((n): n is number => typeof n === "number" && !Number.isNaN(n)),
        ),
      );

      const payload = {
        service: mblDetailsForm.values.service,
        service_type: "Import", // Based on the example payload
        agent: mblDetailsForm.values.origin_agent || null,
        origin_code: mblDetailsForm.values.origin_code,
        destination_code: mblDetailsForm.values.destination_code,
        etd: mblDetailsForm.values.etd
          ? dayjs(mblDetailsForm.values.etd).isValid()
            ? dayjs(mblDetailsForm.values.etd).format("YYYY-MM-DD")
            : null
          : null,
        eta: mblDetailsForm.values.eta
          ? dayjs(mblDetailsForm.values.eta).isValid()
            ? dayjs(mblDetailsForm.values.eta).format("YYYY-MM-DD")
            : null
          : null,
        atd: mblDetailsForm.values.atd
          ? dayjs(mblDetailsForm.values.atd).isValid()
            ? dayjs(mblDetailsForm.values.atd).format("YYYY-MM-DD")
            : null
          : null,
        ata: mblDetailsForm.values.ata
          ? dayjs(mblDetailsForm.values.ata).isValid()
            ? dayjs(mblDetailsForm.values.ata).format("YYYY-MM-DD")
            : null
          : null,
        igm_no: mblDetailsForm.values.igm_no
          ? mblDetailsForm.values.igm_no.trim()
          : null,
        igm_date: mblDetailsForm.values.igm_date
          ? dayjs(mblDetailsForm.values.igm_date).isValid()
            ? dayjs(mblDetailsForm.values.igm_date).format("YYYY-MM-DD")
            : null
          : null,
        carrier_code: carrierDetailsForm.values.carrier_code,
        vessel_name: carrierDetailsForm.values.vessel_name || null,
        voyage_number: carrierDetailsForm.values.voyage_number || null,
        mbl_number: carrierDetailsForm.values.mbl_number || null,
        mbl_date: carrierDetailsForm.values.mbl_date
          ? dayjs(carrierDetailsForm.values.mbl_date).isValid()
            ? dayjs(carrierDetailsForm.values.mbl_date).format("YYYY-MM-DD")
            : null
          : null,
        shipper_name: partyDetailsForm.values.shipper_name || "",
        shipper_email: partyDetailsForm.values.shipper_email || "",
        shipper_address: partyDetailsForm.values.shipper_address || "",
        consignee_name: partyDetailsForm.values.consignee_name || "",
        consignee_email: partyDetailsForm.values.consignee_email || "",
        consignee_address: partyDetailsForm.values.consignee_address || "",
        carrier_agent_name: partyDetailsForm.values.carrier_agent_name || "",
        carrier_agent_email: partyDetailsForm.values.carrier_agent_email || "",
        carrier_agent_address: partyDetailsForm.values.carrier_agent_address || "",
        booking_ids: bookingIds,
        ocean_routings: routingsForm.values.routings.map((routing) => {
          // New format: all fields are nullable
          const routingPayload: Record<string, unknown> = {
            // Include id if it exists (for edit mode) - handle id === 0 as valid
            ...(routing.id !== undefined &&
              routing.id !== null &&
              routing.id !== "" && { id: Number(routing.id) }),
            transport_type: routing.transport_type
              ? routing.transport_type.toUpperCase()
              : null,
            from_port_code: routing.from_code || null,
            to_port_code: routing.to_code || null,
            etd: routing.etd
              ? dayjs(routing.etd).isValid()
                ? dayjs(routing.etd).format("YYYY-MM-DD")
                : null
              : null,
            eta: routing.eta
              ? dayjs(routing.eta).isValid()
                ? dayjs(routing.eta).format("YYYY-MM-DD")
                : null
              : null,
            atd: routing.atd
              ? dayjs(routing.atd).isValid()
                ? dayjs(routing.atd).format("YYYY-MM-DD")
                : null
              : null,
            ata: routing.ata
              ? dayjs(routing.ata).isValid()
                ? dayjs(routing.ata).format("YYYY-MM-DD")
                : null
              : null,
            carrier_code: null,
            vessel: null,
            flight: null,
            truck_no: null,
            rail_no: null,
            voyage_number: null,
          };

          // Map fields based on transport type - use the correct field names from form
          const transportType = String(
            routing.transport_type || "",
          ).toLowerCase();

          if (transportType === "sea" || transportType === "vessel") {
            routingPayload.vessel = routing.vessel || null;
            routingPayload.voyage_number = routing.voyage_number || null;
          } else if (transportType === "air") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.flight = routing.flight || null;
          } else if (transportType === "road") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.truck_no = routing.truck_no || null;
          } else if (transportType === "rail") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.rail_no = routing.rail_no || null;
          } else {
            // Default case - include all fields if transport type is not set
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.vessel = routing.vessel || null;
            routingPayload.flight = routing.flight || null;
            routingPayload.truck_no = routing.truck_no || null;
            routingPayload.rail_no = routing.rail_no || null;
            routingPayload.voyage_number = routing.voyage_number || null;
          }

          return routingPayload;
        }),
        housing_details: housingDetails.map((house) => ({
          // Include id and shipment_id when editing (for update operations)
          ...(house.id && { id: house.id }),
          ...(house.shipment_id && { shipment_id: house.shipment_id }),
          hbl_number: house.hbl_number,
          house_date: house.house_date ? dayjs(house.house_date as string | Date).format("YYYY-MM-DD") : null,
          routed: house.routed,
          routed_by: house.routed_by || null,
          origin_code: house.origin_code,
          destination_code: house.destination_code,
          customer_service: house.customer_service || "",
          trade: house.trade,
          agent_name: house.agent_name,
          agent_address: house.agent_address || "",
          agent_email: house.agent_email || "",
          cha_name: (house as { cha_name?: string }).cha_name || null,
          cha_address: (house as { cha_address?: string }).cha_address || null,
          shipper_name: house.shipper_name,
          shipper_address: house.shipper_address || "",
          shipper_email: house.shipper_email || "",
          shipper_state_id: house.shipper_state_id || "",
          consignee_name: house.consignee_name,
          consignee_address: house.consignee_address || "",
          consignee_email: house.consignee_email || "",
          notify1_customer_name:
            (house as HousingDetail & { notify1_customer_name?: string })
              .notify1_customer_name ??
            "",
          notify1_customer_address:
            (house as HousingDetail & { notify1_customer_address?: string })
              .notify1_customer_address ??
            "",
          notify1_customer_email:
            (house as HousingDetail & { notify1_customer_email?: string })
              .notify1_customer_email ??
            "",
          commodity_description: house.commodity_description || "",
          marks_no: house.marks_no || "",
          item_no: house.item_no || "",
          sub_item_no: house.sub_item_no || "",
          ...(house.shipment_terms_code != null &&
            house.shipment_terms_code !== "" && {
              shipment_terms_code: house.shipment_terms_code,
            }),
          events: Array.isArray((house as { events?: unknown }).events)
            ? (
                (house as {
                  events?: Array<{ id?: number; type?: string; date?: string }>;
                }).events ?? []
              ).map((e) => ({
                ...(e.id != null && { id: Number(e.id) }),
                type: String(e.type ?? ""),
                date: String(e.date ?? ""),
              }))
            : [],
          cargo_details: (house.cargo_details || []).map((cargo) => ({
            ...(cargo.id && { id: cargo.id }),
            // Include both container_no and container_id in edit mode if they exist
            ...(cargo.container_no && { container_no: cargo.container_no }),
            ...(cargo.container_id && { container_id: cargo.container_id }),
            no_of_packages: cargo.no_of_packages,
            gross_weight: roundToDecimals(cargo.gross_weight) ?? null,
            volume: roundToDecimals(cargo.volume) ?? null,
            chargeable_weight: roundToDecimals(cargo.chargeable_weight) ?? null,
            haz:
              cargo.haz !== null && cargo.haz !== undefined
                ? typeof cargo.haz === "boolean"
                  ? cargo.haz
                  : cargo.haz === "Yes" ||
                    cargo.haz === true ||
                    String(cargo.haz).toLowerCase() === "yes"
                : null,
          })),
          // Each housing detail has its own mbl_charges
          mbl_charges: (() => {
            const src =
              (house as { mbl_charges?: unknown }).mbl_charges ??
              (house as { charges?: unknown }).charges ??
              [];
            const arr = Array.isArray(src) ? src : [];
            return arr.map((charge: Record<string, unknown>) => ({
              ...(mode === "edit" &&
                charge.id != null && {
                  id:
                    typeof charge.id === "number"
                      ? charge.id
                      : Number(charge.id),
                }),
              charge_id:
                charge.charge_id != null ? Number(charge.charge_id) : null,
              supplier_code:
                charge.supplier_code != null
                  ? String(charge.supplier_code)
                  : null,
              pp_cc: String(charge.pp_cc ?? ""),
              unit_id:
                charge.unit_id != null
                  ? Number(charge.unit_id)
                  : charge.unit != null
                    ? Number(charge.unit)
                    : null,
              currency_id:
                charge.currency_id != null
                  ? Number(charge.currency_id)
                  : charge.currency != null
                    ? Number(charge.currency)
                    : null,
              no_of_unit:
                charge.no_of_unit != null
                  ? roundToDecimals(charge.no_of_unit as number | string)
                  : null,
              roe: roundToDecimals(charge.roe as number | string) ?? null,
              amount_per_unit:
                roundToDecimals(charge.amount_per_unit as number | string) ??
                null,
              amount: roundToDecimals(charge.amount as number | string) ?? null,
            sell_local_amount:
              roundToDecimals(
                (charge.sell_local_amount != null
                  ? charge.sell_local_amount
                  : (charge as { local_amount?: number | string }).local_amount) as
                  | number
                  | string,
              ) ?? null,
            unit_cost:
              roundToDecimals(
                (charge.unit_cost != null
                  ? charge.unit_cost
                  : (charge as { cost_per_unit?: number | string })
                      .cost_per_unit) as number | string,
              ) ?? null,
              total_cost: roundToDecimals(charge.total_cost as number | string) ?? null,
              cost_local_amount:
                roundToDecimals(charge.cost_local_amount as number | string) ??
                null,
            }));
          })(),
        })),
        container_details: containerDetailsForm.values.containers.map(
          (container) => {
            return {
              ...(container.id && { id: container.id }),
              container_type_input: container.container_type || null,
              container_no: container.container_no || null,
              actual_seal_no: container.actual_seal_no || null,
              customs_seal_no: container.customs_seal_no || null,
              loading_date: container.loading_date
                ? dayjs(container.loading_date).format("YYYY-MM-DD")
                : null,
              uploading_date: container.unloading_date
                ? dayjs(container.unloading_date).format("YYYY-MM-DD")
                : null,
              ...(container.cfs_id != null &&
                container.cfs_id !== "" && {
                  cfs_id:
                    typeof container.cfs_id === "number"
                      ? container.cfs_id
                      : Number(container.cfs_id),
                }),
            };
          },
        ),
        estimates: (() => {
          const raw = estimatesForm.values.estimates ?? [];
          const nonEmpty = raw.filter((e) => {
            return (
              !!e.supplier_code ||
              !!e.supplier_name ||
              e.charge_id != null ||
              !!e.charge_name ||
              !!e.pp_cc ||
              !!e.unit_id ||
              !!e.currency_id ||
              e.no_of_unit != null ||
              e.cost_per_unit != null ||
              e.total_cost != null
            );
          });

          return nonEmpty.map((e) => ({
            ...(mode === "edit" &&
              e.id != null && {
                id: typeof e.id === "number" ? e.id : Number(e.id),
              }),
            supplier_code: e.supplier_code || null,
            charge_id: e.charge_id,
            pp_cc: e.pp_cc || "",
            unit_id: e.unit_id ? Number(e.unit_id) : null,
            no_of_unit: roundToDecimals(e.no_of_unit) ?? null,
            currency_id: e.currency_id ? Number(e.currency_id) : null,
            roe: roundToDecimals(e.roe) ?? null,
            cost_per_unit: roundToDecimals(e.cost_per_unit) ?? null,
            total_cost: roundToDecimals(e.total_cost) ?? null,
          }));
        })(),
      };

      // API call to create or update import job
      if (mode === "edit" && jobData?.id) {
        // Edit mode: Use PUT method with ID in payload
        await putAPICall(
          URL.importJob,
          {
            ...payload,
            id: jobData.id,
          },
          API_HEADER,
        );
      } else {
        // Create mode: Use POST method
        await postAPICall(URL.importJob, payload, API_HEADER);
      }

      ToastNotification({
        type: "success",
        message: `Import Job ${mode === "edit" ? "updated" : "created"} successfully`,
      });

      // Clear housing details from state when navigating and trigger refetch
      navigate("/SeaExport/import-job", {
        state: { housingDetails: [], refreshData: true },
      });
    } catch (err) {
      console.error("Error submitting form:", err);
      ToastNotification({
        type: "error",
        message: "Failed to submit form",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetchingJobById) {
    return (
      <Center style={{ minHeight: "60vh" }}>
        <Loader color="#105476" size="lg" />
      </Center>
    );
  }

  return (
    <Box p="md" mx="auto">
      <Group justify="space-between" align="center" mb="lg">
        <Group gap={"md"}>
          <Text size="xl" fw={600} c="#105476">
            {mode === "view"
              ? "View Import Job"
              : mode === "edit"
                ? "Edit Import Job"
                : "Create Import Job"}
          </Text>
          {jobData?.job_id && (
            <Badge color="#105476" radius="md" size="md">
              {jobData?.job_id ? `Job ID: ${jobData.job_id}` : ""}
            </Badge>
          )}
        </Group>
        {!isReadOnly && (
          <Group gap="xs">
            <Button
              color="#105476"
              variant={canCreateJob ? "filled" : "outline"}
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!canCreateJob}
              leftSection={<IconPlus size={14} />}
              style={{
                cursor: canCreateJob ? "pointer" : "not-allowed",
              }}
            >
              {mode === "edit" ? "Update" : "Create"}
            </Button>
            {housingDetails.length > 0 && (
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    color="#105476"
                    size="lg"
                    styles={{
                      root: {
                        fontFamily: "Inter",
                        fontSize: "13px",
                        border: "1px solid #E9ECEF",
                        borderRadius: "8px",
                        "&:hover": {
                          backgroundColor: "#F8F9FA",
                        },
                      },
                    }}
                  >
                    <IconDotsVertical size={18} />
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown
                  styles={{
                    dropdown: {
                      border: "1px solid #E9ECEF",
                      borderRadius: "8px",
                      padding: "8px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    },
                  }}
                >
                  <Menu.Label
                    styles={{
                      label: {
                        fontFamily: "Inter",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6B7280",
                        marginBottom: "6px",
                      },
                    }}
                  >
                    Preview PDF
                  </Menu.Label>

                  {housingDetails.map((housing, idx) => (
                    <Menu.Item
                      key={idx}
                      leftSection={
                        <Box
                          style={{
                            backgroundColor: "#E7F5FF",
                            borderRadius: "6px",
                            padding: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconEye size={16} color="#105476" />
                        </Box>
                      }
                      styles={{
                        item: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          borderRadius: "6px",
                          padding: "10px 12px",
                          marginBottom: "4px",
                          "&:hover": {
                            backgroundColor: "#F8F9FA",
                          },
                        },
                        itemLabel: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                        },
                      }}
                      onClick={() =>
                        generateCargoArrivalNoticePDFPreview(housing)
                      }
                    >
                      Cargo Arrival Notice -{" "}
                      {housing.hbl_number || `HBL ${idx + 1}`}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  {housingDetails.map((housing, idx) => (
                    <Menu.Item
                      key={`do-${idx}`}
                      leftSection={
                        <Box
                          style={{
                            backgroundColor: "#E7F5FF",
                            borderRadius: "6px",
                            padding: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconEye size={16} color="#105476" />
                        </Box>
                      }
                      styles={{
                        item: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          borderRadius: "6px",
                          padding: "10px 12px",
                          marginBottom: "4px",
                          "&:hover": {
                            backgroundColor: "#F8F9FA",
                          },
                        },
                        itemLabel: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                        },
                      }}
                      onClick={() => openDoConfigModal(housing)}
                    >
                      Delivery Order - {housing.hbl_number || `HBL ${idx + 1}`}
                    </Menu.Item>
                  ))}
                  {jobData?.id != null && (
                    <Menu.Item
                      leftSection={
                        <Box
                          style={{
                            backgroundColor: "#E7F5FF",
                            borderRadius: "6px",
                            padding: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconFileInvoice size={16} color="#105476" />
                        </Box>
                      }
                      styles={{
                        item: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          borderRadius: "6px",
                          padding: "10px 12px",
                          marginBottom: "4px",
                          "&:hover": {
                            backgroundColor: "#F8F9FA",
                          },
                        },
                        itemLabel: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                        },
                      }}
                      onClick={() => {
                        const allCollectCharges = housingDetails.flatMap(
                          (house) =>
                            (house.charges ?? [])
                              .filter(
                                (c) =>
                                  String(c.pp_cc ?? "")
                                    .trim() === "Collect",
                              )
                              .map((c) => ({
                                ...c,
                                shipment_id:
                                  (house as { shipment_id?: string })
                                    .shipment_id ??
                                  (house as { shipment_no?: string })
                                    .shipment_no ??
                                  "",
                                shipper_id:
                                  (house as { shipper_code?: string })
                                    .shipper_code ??
                                  (house as { shipper_id?: string })
                                    .shipper_id ??
                                  "",
                              })),
                        );
                        const firstHouse = housingDetails[0];
                        const housingDetailsForInvoice = [
                          {
                            ...firstHouse,
                            charges: allCollectCharges,
                          },
                        ];
                        navigate("/SeaExport/import-job/invoice", {
                          state: {
                            serviceType: ["FCL", "LCL"],
                            hawbDetails: housingDetailsForInvoice,
                            housingDetails: housingDetailsForInvoice,
                            is_agent: true,
                            fromJobLevel: true,
                            ...(jobWithMergedHousingDetails && {
                              job: jobWithMergedHousingDetails,
                            }),
                            ...(location.state?.mblDetails && {
                              mblDetails: location.state.mblDetails,
                            }),
                            ...(location.state?.carrierDetails && {
                              carrierDetails: location.state.carrierDetails,
                            }),
                            ...(location.state?.routings && {
                              routings: location.state.routings,
                            }),
                          },
                        });
                      }}
                    >
                      Create Invoice
                    </Menu.Item>
                  )}

                  {jobData?.id != null && (
                    <Menu.Item
                      leftSection={
                        <Box
                          style={{
                            backgroundColor: "#E7F5FF",
                            borderRadius: "6px",
                            padding: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconFileInvoice size={16} color="#105476" />
                        </Box>
                      }
                      styles={{
                        item: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          borderRadius: "6px",
                          padding: "10px 12px",
                          marginBottom: "4px",
                          "&:hover": {
                            backgroundColor: "#F8F9FA",
                          },
                        },
                        itemLabel: {
                          fontFamily: "Inter",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                        },
                      }}
                      onClick={() =>
                        navigate("/job-ledger", {
                          state: {
                            jobId:
                              jobData?.job_id ,
                              service_name: "Ocean Import",
                          },
                        })
                      }
                    >
                      Job Ledger
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        )}
      </Group>

      <Tabs
        value={String(active)}
        onChange={(v) => {
          if (v === null) return;
          setActive(Number(v));
        }}
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
            MBL & Carrier Details
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
            Party Details
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
            Routings
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
            Container Details
          </Tabs.Tab>
          <Tabs.Tab
            value="4"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 4 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 4 ? 600 : 400,
            }}
          >
            Estimates
          </Tabs.Tab>
          {mode === "edit" && jobData?.id && (
            <Tabs.Tab
              value="5"
              style={{
                textAlign: "center",
                padding: "12px",
                backgroundColor: "transparent",
                borderBottom: active === 5 ? "3px solid #105476" : "none",
                color: "#105476",
                fontSize: 16,
                fontWeight: active === 5 ? 600 : 400,
              }}
            >
              Accounts
            </Tabs.Tab>
          )}
        </Tabs.List>

        {/* Tab 1: MBL Details & Carrier Details */}
        <Tabs.Panel value="0">
          <Box mt="md">
            {/* MBL Details Section */}
            <Group align="center" mb="md">
              <Text size="lg" fw={600} c="#105476">
                MBL Details
              </Text>
            </Group>
            <Grid mb="sm">
              <Grid.Col span={3}>
                <Dropdown
                  size="sm"
                  label="Service"
                  required
                  placeholder="Select Service"
                  searchable
                  data={["FCL", "LCL"]}
                  {...mblDetailsForm.getInputProps("service")}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  size="sm"
                  label="Origin Agent"
                  required
                  placeholder="Type agent name"
                  apiEndpoint={URL.customerByTypes}
                  additionalParams={{ types: "Agent,Coloader" }}
                  dropdownZIndex={10}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code), // Use code as value for API payload
                    label: String(item.customer_name), // Display name to user
                  })}
                  value={mblDetailsForm.values.origin_agent} // Stores customer_code
                  displayValue={mblDetailsForm.values.agent_name} // Displays customer_name
                  onChange={(value, selectedData, originalData) => {
                    // Store customer_code as value (for API payload)
                    mblDetailsForm.setFieldValue("origin_agent", value || "");
                    // Store customer_name for display
                    mblDetailsForm.setFieldValue(
                      "agent_name",
                      selectedData?.label || "",
                    );

                    // Extract address from addresses_data if available
                    if (
                      value &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      const addressesData = (
                        originalData as Record<string, unknown>
                      ).addresses_data as Array<{
                        id: number;
                        address: string;
                      }>;

                      // Auto-select the first address if available
                      if (
                        addressesData &&
                        addressesData.length > 0 &&
                        addressesData[0].address
                      ) {
                        mblDetailsForm.setFieldValue(
                          "agent_address",
                          addressesData[0].address,
                        );
                      } else {
                        mblDetailsForm.setFieldValue(
                          "agent_address",
                          "",
                        );
                      }
                    } else {
                      mblDetailsForm.setFieldValue("agent_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={mblDetailsForm.errors.origin_agent as string}
                  minSearchLength={2}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  size="sm"
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  dropdownZIndex={10}
                  placeholder="Type the origin"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={mblDetailsForm.values.origin_code}
                  displayValue={
                    mblDetailsForm.values.origin_name
                      ? `${mblDetailsForm.values.origin_name} (${mblDetailsForm.values.origin_code})`
                      : mblDetailsForm.values.origin_code
                  }
                  onChange={(value, selectedData) => {
                    mblDetailsForm.setFieldValue("origin_code", value || "");
                    if (selectedData) {
                      mblDetailsForm.setFieldValue(
                        "origin_name",
                        selectedData.label.split(" (")[0] || "",
                      );
                    } else if (!value) {
                      mblDetailsForm.setFieldValue("origin_name", "");
                    }
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={mblDetailsForm.errors.origin_code as string}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  size="sm"
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
                  dropdownZIndex={10}
                  placeholder="Type the destination"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={mblDetailsForm.values.destination_code}
                  displayValue={
                    mblDetailsForm.values.destination_name
                      ? `${mblDetailsForm.values.destination_name} (${mblDetailsForm.values.destination_code})`
                      : mblDetailsForm.values.destination_code
                  }
                  onChange={(value, selectedData) => {
                    mblDetailsForm.setFieldValue(
                      "destination_code",
                      value || "",
                    );
                    if (selectedData) {
                      mblDetailsForm.setFieldValue(
                        "destination_name",
                        selectedData.label.split(" (")[0] || "",
                      );
                    } else if (!value) {
                      mblDetailsForm.setFieldValue("destination_name", "");
                    }
                    // Note: Don't update location.state on every keystroke - only when navigating to HouseCreate
                    // This prevents infinite re-renders and API calls
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={mblDetailsForm.errors.destination_code as string}
                />
              </Grid.Col>
            </Grid>

            {/* Second row for ETD, ETA, ATD, ATA */}
            <Grid mb="xl">
              <Grid.Col span={3}>
                <SingleDateInput
                  label="ETD"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps = mblDetailsForm.getInputProps("etd");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("etd", value);
                      },
                    };
                  })()}
                  size="sm"
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="ETA"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps = mblDetailsForm.getInputProps("eta");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("eta", value);
                      },
                    };
                  })()}
                  size="sm"
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="ATD"
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps = mblDetailsForm.getInputProps("atd");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("atd", value);
                      },
                    };
                  })()}
                  size="sm"
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SingleDateInput
                  label="ATA"
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps = mblDetailsForm.getInputProps("ata");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("ata", value);
                      },
                    };
                  })()}
                  size="sm"
                />
              </Grid.Col>
            </Grid>

            {/* IGM details row */}
            <Grid mb="xl">
              <Grid.Col span={3}>
                <FormTextInput
                  label="IGM Number"
                  placeholder="Enter IGM Number"
                  value={mblDetailsForm.values.igm_no}
                  onChange={(e) =>
                    mblDetailsForm.setFieldValue("igm_no", e.currentTarget.value)
                  }
                  error={mblDetailsForm.errors.igm_no}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <SingleDateInput
                  label="IGM Date"
                  placeholder="YYYY-MM-DD"
                  value={mblDetailsForm.values.igm_date}
                  onChange={(value: Date | null) => {
                    mblDetailsForm.setFieldValue("igm_date", value);
                  }}
                  error={mblDetailsForm.errors.igm_date as string | undefined}
                  size="sm"
                />
              </Grid.Col>
            </Grid>

            <Divider my="sm" />

            {/* Carrier Details Section */}
            <Group justify="space-between" align="center" mb="sm">
              <Text size="lg" fw={600} c="#105476">
                Carrier Details
              </Text>
            </Group>
            <Grid mb="xl">
              <Grid.Col span={2.4}>
                <SearchableSelect
                  size="sm"
                  label="Carrier"
                  required
                  apiEndpoint={URL.carrier}
                  dropdownZIndex={10}
                  placeholder="Type carrier name"
                  searchFields={["carrier_code", "carrier_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.carrier_code),
                    label: String(item.carrier_name),
                  })}
                  value={carrierDetailsForm.values.carrier_code}
                  displayValue={carrierDetailsForm.values.carrier_name}
                  onChange={(value, selectedData) => {
                    carrierDetailsForm.setFieldValue(
                      "carrier_code",
                      value || "",
                    );
                    carrierDetailsForm.setFieldValue(
                      "carrier_name",
                      selectedData?.label || "",
                    );
                  }}
                  minSearchLength={2}
                  error={carrierDetailsForm.errors.carrier_code as string}
                  additionalParams={
                    mblDetailsForm.values.service
                      ? {
                          transport_mode:
                            mblDetailsForm.values.service === "FCL" ||
                            mblDetailsForm.values.service === "LCL"
                              ? "SEA"
                              : mblDetailsForm.values.service === "AIR"
                                ? "AIR"
                                : "",
                        }
                      : undefined
                  }
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <FormTextInput
                  label="Vessel Name"
                  required
                  placeholder="Enter vessel name"
                  {...carrierDetailsForm.getInputProps("vessel_name")}
                  error={carrierDetailsForm.errors.vessel_name}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <FormTextInput
                  label="Voyage Number"
                  required
                  placeholder="Enter voyage number"
                  {...carrierDetailsForm.getInputProps("voyage_number")}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <FormTextInput
                  label="MBL Number"
                  required
                  placeholder="Enter MBL number"
                  {...carrierDetailsForm.getInputProps("mbl_number")}
                />
              </Grid.Col>

              <Grid.Col span={2.4}>
                <SingleDateInput
                  label="MBL Date"
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps =
                      carrierDetailsForm.getInputProps("mbl_date");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        carrierDetailsForm.setFieldValue("mbl_date", value);
                      },
                    };
                  })()}
                  size="sm"
                />
              </Grid.Col>
            </Grid>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="1">
          <Box mt="md">
            <Text size="lg" fw={600} c="#105476" mb="md">
              Party Details
            </Text>

            <Grid gutter="sm" mb="md">
              <Grid.Col span={12}>
                <Text fw={600} c="#105476">
                  Shipper Details
                </Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <SearchableSelect
                  size="sm"
                  label="Shipper Name"
                  dropdownZIndex={10}
                  apiEndpoint={URL.shipper}
                  placeholder="Type shipper name"
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.id ?? ""),
                    label: String(item.customer_name ?? ""),
                  })}
                  value={partyDetailsForm.values.shipper_id || null}
                  displayValue={partyDetailsForm.values.shipper_name || null}
                  onChange={(value, selectedData, originalData) => {
                    const options = getAddressOptions(originalData);
                    const primary = options[0];
                    partyDetailsForm.setFieldValue("shipper_id", value || "");
                    partyDetailsForm.setFieldValue(
                      "shipper_name",
                      selectedData?.label || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "shipper_email",
                      primary?.email || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "shipper_address_id",
                      primary?.value || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "shipper_address",
                      primary?.address || "",
                    );
                    if (!value) {
                      partyDetailsForm.setFieldValue("shipper_name", "");
                      partyDetailsForm.setFieldValue("shipper_email", "");
                      partyDetailsForm.setFieldValue("shipper_address_id", "");
                      partyDetailsForm.setFieldValue("shipper_address", "");
                    }
                    setShipperAddressOptions(value ? options : []);
                    setShipperAddressSearch("");
                    setShipperAddressCustom(false);
                  }}
                  minSearchLength={2}
                  returnOriginalData={true}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Shipper Email"
                  value={partyDetailsForm.values.shipper_email}
                  onChange={(e) =>
                    partyDetailsForm.setFieldValue(
                      "shipper_email",
                      e.currentTarget.value,
                    )
                  }
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {shipperAddressCustom ||
                (!!partyDetailsForm.values.shipper_address &&
                  (!partyDetailsForm.values.shipper_address_id ||
                    !shipperAddressOptions.some(
                      (item) =>
                        item.value === partyDetailsForm.values.shipper_address_id,
                    ))) ? (
                  <FormTextInput
                    label="Shipper Address"
                    value={partyDetailsForm.values.shipper_address}
                    onChange={(e) => {
                      const nextValue = e.currentTarget.value;
                      partyDetailsForm.setFieldValue("shipper_address", nextValue);
                      if (!nextValue.trim()) {
                        setShipperAddressCustom(false);
                        setShipperAddressSearch("");
                        partyDetailsForm.setFieldValue("shipper_address_id", "");
                      }
                    }}
                  />
                ) : (
                  <Dropdown
                    size="sm"
                    label="Shipper Address"
                    data={shipperAddressOptions.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    value={partyDetailsForm.values.shipper_address_id || null}
                    searchValue={shipperAddressSearch}
                    onSearchChange={(value) => {
                      setShipperAddressSearch(value);
                      const hasMatch = shipperAddressOptions.some(
                        (item) =>
                          item.label.toLowerCase() === value.trim().toLowerCase(),
                      );
                      if (value.trim() && !hasMatch) {
                        setShipperAddressCustom(true);
                        partyDetailsForm.setFieldValue("shipper_address_id", "");
                        partyDetailsForm.setFieldValue("shipper_address", value);
                      }
                    }}
                    onChange={(value) => {
                      const selected = shipperAddressOptions.find(
                        (item) => item.value === value,
                      );
                      partyDetailsForm.setFieldValue(
                        "shipper_address_id",
                        value || "",
                      );
                      partyDetailsForm.setFieldValue(
                        "shipper_address",
                        selected?.address || "",
                      );
                    }}
                    searchable
                    clearable
                  />
                )}
              </Grid.Col>
            </Grid>

            <Grid gutter="sm" mb="md">
              <Grid.Col span={12}>
                <Text fw={600} c="#105476">
                  Consignee Details
                </Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <SearchableSelect
                  size="sm"
                  label="Consignee Name"
                  dropdownZIndex={10}
                  apiEndpoint={URL.consignee}
                  placeholder="Type consignee name"
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.id ?? ""),
                    label: String(item.customer_name ?? ""),
                  })}
                  value={partyDetailsForm.values.consignee_id || null}
                  displayValue={partyDetailsForm.values.consignee_name || null}
                  onChange={(value, selectedData, originalData) => {
                    const options = getAddressOptions(originalData);
                    const primary = options[0];
                    partyDetailsForm.setFieldValue("consignee_id", value || "");
                    partyDetailsForm.setFieldValue(
                      "consignee_name",
                      selectedData?.label || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "consignee_email",
                      primary?.email || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "consignee_address_id",
                      primary?.value || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "consignee_address",
                      primary?.address || "",
                    );
                    if (!value) {
                      partyDetailsForm.setFieldValue("consignee_name", "");
                      partyDetailsForm.setFieldValue("consignee_email", "");
                      partyDetailsForm.setFieldValue("consignee_address_id", "");
                      partyDetailsForm.setFieldValue("consignee_address", "");
                    }
                    setConsigneeAddressOptions(value ? options : []);
                    setConsigneeAddressSearch("");
                    setConsigneeAddressCustom(false);
                  }}
                  minSearchLength={2}
                  returnOriginalData={true}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Consignee Email"
                  value={partyDetailsForm.values.consignee_email}
                  onChange={(e) =>
                    partyDetailsForm.setFieldValue(
                      "consignee_email",
                      e.currentTarget.value,
                    )
                  }
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {consigneeAddressCustom ||
                (!!partyDetailsForm.values.consignee_address &&
                  (!partyDetailsForm.values.consignee_address_id ||
                    !consigneeAddressOptions.some(
                      (item) =>
                        item.value === partyDetailsForm.values.consignee_address_id,
                    ))) ? (
                  <FormTextInput
                    label="Consignee Address"
                    value={partyDetailsForm.values.consignee_address}
                    onChange={(e) => {
                      const nextValue = e.currentTarget.value;
                      partyDetailsForm.setFieldValue("consignee_address", nextValue);
                      if (!nextValue.trim()) {
                        setConsigneeAddressCustom(false);
                        setConsigneeAddressSearch("");
                        partyDetailsForm.setFieldValue("consignee_address_id", "");
                      }
                    }}
                  />
                ) : (
                  <Dropdown
                    size="sm"
                    label="Consignee Address"
                    data={consigneeAddressOptions.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    value={partyDetailsForm.values.consignee_address_id || null}
                    searchValue={consigneeAddressSearch}
                    onSearchChange={(value) => {
                      setConsigneeAddressSearch(value);
                      const hasMatch = consigneeAddressOptions.some(
                        (item) =>
                          item.label.toLowerCase() === value.trim().toLowerCase(),
                      );
                      if (value.trim() && !hasMatch) {
                        setConsigneeAddressCustom(true);
                        partyDetailsForm.setFieldValue("consignee_address_id", "");
                        partyDetailsForm.setFieldValue("consignee_address", value);
                      }
                    }}
                    onChange={(value) => {
                      const selected = consigneeAddressOptions.find(
                        (item) => item.value === value,
                      );
                      partyDetailsForm.setFieldValue(
                        "consignee_address_id",
                        value || "",
                      );
                      partyDetailsForm.setFieldValue(
                        "consignee_address",
                        selected?.address || "",
                      );
                    }}
                    searchable
                    clearable
                  />
                )}
              </Grid.Col>
            </Grid>

            <Grid gutter="sm" mb="md">
              <Grid.Col span={12}>
                <Text fw={600} c="#105476">
                  Carrier Agent Details
                </Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <SearchableSelect
                  size="sm"
                  label="Carrier Agent Name"
                  dropdownZIndex={10}
                  apiEndpoint={URL.customerByTypes}
                  additionalParams={{ types: "Carrier-agent" }}
                  placeholder="Type carrier agent name"
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.id ?? ""),
                    label: String(item.customer_name ?? ""),
                  })}
                  value={partyDetailsForm.values.carrier_agent_id || null}
                  displayValue={partyDetailsForm.values.carrier_agent_name || null}
                  onChange={(value, selectedData, originalData) => {
                    const options = getAddressOptions(originalData);
                    const primary = options[0];
                    partyDetailsForm.setFieldValue(
                      "carrier_agent_id",
                      value || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "carrier_agent_name",
                      selectedData?.label || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "carrier_agent_email",
                      primary?.email || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "carrier_agent_address_id",
                      primary?.value || "",
                    );
                    partyDetailsForm.setFieldValue(
                      "carrier_agent_address",
                      primary?.address || "",
                    );
                    if (!value) {
                      partyDetailsForm.setFieldValue("carrier_agent_name", "");
                      partyDetailsForm.setFieldValue("carrier_agent_email", "");
                      partyDetailsForm.setFieldValue(
                        "carrier_agent_address_id",
                        "",
                      );
                      partyDetailsForm.setFieldValue("carrier_agent_address", "");
                    }
                    setCarrierAgentAddressOptions(value ? options : []);
                    setCarrierAgentAddressSearch("");
                    setCarrierAgentAddressCustom(false);
                  }}
                  minSearchLength={2}
                  returnOriginalData={true}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Carrier Agent Email"
                  value={partyDetailsForm.values.carrier_agent_email}
                  onChange={(e) =>
                    partyDetailsForm.setFieldValue(
                      "carrier_agent_email",
                      e.currentTarget.value,
                    )
                  }
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {carrierAgentAddressCustom ||
                (!!partyDetailsForm.values.carrier_agent_address &&
                  (!partyDetailsForm.values.carrier_agent_address_id ||
                    !carrierAgentAddressOptions.some(
                      (item) =>
                        item.value ===
                        partyDetailsForm.values.carrier_agent_address_id,
                    ))) ? (
                  <FormTextInput
                    label="Carrier Agent Address"
                    value={partyDetailsForm.values.carrier_agent_address}
                    onChange={(e) => {
                      const nextValue = e.currentTarget.value;
                      partyDetailsForm.setFieldValue(
                        "carrier_agent_address",
                        nextValue,
                      );
                      if (!nextValue.trim()) {
                        setCarrierAgentAddressCustom(false);
                        setCarrierAgentAddressSearch("");
                        partyDetailsForm.setFieldValue(
                          "carrier_agent_address_id",
                          "",
                        );
                      }
                    }}
                  />
                ) : (
                  <Dropdown
                    size="sm"
                    label="Carrier Agent Address"
                    data={carrierAgentAddressOptions.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    value={partyDetailsForm.values.carrier_agent_address_id || null}
                    searchValue={carrierAgentAddressSearch}
                    onSearchChange={(value) => {
                      setCarrierAgentAddressSearch(value);
                      const hasMatch = carrierAgentAddressOptions.some(
                        (item) =>
                          item.label.toLowerCase() === value.trim().toLowerCase(),
                      );
                      if (value.trim() && !hasMatch) {
                        setCarrierAgentAddressCustom(true);
                        partyDetailsForm.setFieldValue(
                          "carrier_agent_address_id",
                          "",
                        );
                        partyDetailsForm.setFieldValue(
                          "carrier_agent_address",
                          value,
                        );
                      }
                    }}
                    onChange={(value) => {
                      const selected = carrierAgentAddressOptions.find(
                        (item) => item.value === value,
                      );
                      partyDetailsForm.setFieldValue(
                        "carrier_agent_address_id",
                        value || "",
                      );
                      partyDetailsForm.setFieldValue(
                        "carrier_agent_address",
                        selected?.address || "",
                      );
                    }}
                    searchable
                    clearable
                  />
                )}
              </Grid.Col>
            </Grid>
          </Box>
        </Tabs.Panel>

        {/* Tab 3: Routings */}
        <Tabs.Panel value="2">
          <Box mt="md">
            <Text size="lg" fw={600} c="#105476" mb="md">
              Routings{" "}
              {routingsForm.values?.routings?.length > 1 &&
                `(${routingsForm.values?.routings?.length})`}
            </Text>

            <Stack gap="xl">
              {routingsForm.values.routings.map((routing, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={2.4}>
                      <Dropdown
                        size="sm"
                        label="Transport Type"
                        required
                        placeholder="Select Transport Type"
                        searchable
                        clearable
                        data={["AIR", "SEA", "ROAD", "RAIL"]}
                        value={
                          routingsForm.values.routings[index]?.transport_type ||
                          null
                        }
                        onChange={(value) => {
                          routingsForm.setFieldValue(
                            `routings.${index}.transport_type`,
                            value || "",
                          );
                        }}
                        error={
                          routingsForm.errors[
                            `routings.${index}.transport_type`
                          ] as string
                        }
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <SearchableSelect
                        size="sm"
                        label="From"
                        required
                        apiEndpoint={URL.portMaster}
                        dropdownZIndex={10}
                        placeholder="Type from location"
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={routing.from_code || null}
                        displayValue={
                          routing.from_name && routing.from_code
                            ? `${routing.from_name} (${routing.from_code})`
                            : routing.from_code || null
                        }
                        onChange={(value, selectedData) => {
                          routingsForm.setFieldValue(
                            `routings.${index}.from_code`,
                            value || "",
                          );
                          if (selectedData) {
                            const portName =
                              selectedData.label.split(" (")[0] || "";
                            routingsForm.setFieldValue(
                              `routings.${index}.from_name`,
                              portName,
                            );
                          } else if (!value) {
                            routingsForm.setFieldValue(
                              `routings.${index}.from_name`,
                              "",
                            );
                          }
                        }}
                        minSearchLength={2}
                        additionalParams={
                          getTransportMode(routing.transport_type)
                            ? {
                                transport_mode: getTransportMode(
                                  routing.transport_type,
                                )!,
                              }
                            : undefined
                        }
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <SearchableSelect
                        size="sm"
                        label="To"
                        required
                        apiEndpoint={URL.portMaster}
                        dropdownZIndex={10}
                        placeholder="Type to location"
                        searchFields={["port_code", "port_name"]}
                        displayFormat={(item: Record<string, unknown>) => ({
                          value: String(item.port_code),
                          label: `${item.port_name} (${item.port_code})`,
                        })}
                        value={routing.to_code || null}
                        displayValue={
                          routing.to_name && routing.to_code
                            ? `${routing.to_name} (${routing.to_code})`
                            : routing.to_code || null
                        }
                        onChange={(value, selectedData) => {
                          routingsForm.setFieldValue(
                            `routings.${index}.to_code`,
                            value || "",
                          );
                          if (selectedData) {
                            const portName =
                              selectedData.label.split(" (")[0] || "";
                            routingsForm.setFieldValue(
                              `routings.${index}.to_name`,
                              portName,
                            );
                          } else if (!value) {
                            routingsForm.setFieldValue(
                              `routings.${index}.to_name`,
                              "",
                            );
                          }
                        }}
                        minSearchLength={2}
                        additionalParams={
                          getTransportMode(routing.transport_type)
                            ? {
                                transport_mode: getTransportMode(
                                  routing.transport_type,
                                )!,
                              }
                            : undefined
                        }
                      />
                    </Grid.Col>

                    {/* Dynamic field labels based on transport type */}
                    {routing.transport_type === "SEA" && (
                      <>
                        <Grid.Col span={2.4}>
                          <FormTextInput
                            label="Vessel"
                            required
                            placeholder="Enter vessel name"
                            value={routing.vessel || ""}
                            onChange={(e) => {
                              const formattedValue = toTitleCase(
                                e.target.value,
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.vessel`,
                                formattedValue,
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.vessel`
                              ] as string
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={2.4}>
                          <FormTextInput
                            label="Voyage Number"
                            required
                            placeholder="Enter voyage number"
                            value={routing.voyage_number || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.voyage_number`,
                                value,
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value,
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.voyage_number`
                              ] as string
                            }
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "AIR" && (
                      <>
                        <Grid.Col span={2.4}>
                          <SearchableSelect
                            size="sm"
                            label="Carrier"
                            required
                            apiEndpoint={URL.carrier}
                            dropdownZIndex={10}
                            placeholder="Type carrier name"
                            searchFields={["carrier_code", "carrier_name"]}
                            displayFormat={(item: Record<string, unknown>) => ({
                              value: String(item.carrier_code),
                              label: String(item.carrier_name),
                            })}
                            value={routing.carrier_code || null}
                            displayValue={routing.carrier_name || null}
                            onChange={(value, selectedData) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_code`,
                                value || "",
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_name`,
                                selectedData?.label || "",
                              );
                            }}
                            minSearchLength={2}
                            additionalParams={
                              getTransportMode(routing.transport_type)
                                ? {
                                    transport_mode: getTransportMode(
                                      routing.transport_type,
                                    )!,
                                  }
                                : undefined
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={2.4}>
                          <FormTextInput
                            label="Flight Number"
                            required
                            placeholder="Enter flight number"
                            value={routing.flight || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.flight`,
                                value,
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value,
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.flight`
                              ] as string
                            }
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "ROAD" && (
                      <>
                        <Grid.Col span={2.4}>
                          <SearchableSelect
                            size="sm"
                            label="Carrier"
                            required
                            apiEndpoint={URL.carrier}
                            dropdownZIndex={10}
                            placeholder="Type carrier name"
                            searchFields={["carrier_code", "carrier_name"]}
                            displayFormat={(item: Record<string, unknown>) => ({
                              value: String(item.carrier_code),
                              label: String(item.carrier_name),
                            })}
                            value={routing.carrier_code || null}
                            displayValue={routing.carrier_name || null}
                            onChange={(value, selectedData) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_code`,
                                value || "",
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_name`,
                                selectedData?.label || "",
                              );
                            }}
                            minSearchLength={2}
                            additionalParams={
                              getTransportMode(routing.transport_type)
                                ? {
                                    transport_mode: getTransportMode(
                                      routing.transport_type,
                                    )!,
                                  }
                                : undefined
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={2.4}>
                          <FormTextInput
                            label="Truck Number"
                            required
                            placeholder="Enter truck number"
                            value={routing.truck_no || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.truck_no`,
                                value,
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value,
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.truck_no`
                              ] as string
                            }
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "RAIL" && (
                      <>
                        <Grid.Col span={2.4}>
                          <FormTextInput
                            label="Carrier"
                            required
                            placeholder="Enter carrier name"
                            value={routing.carrier_name || ""}
                            onChange={(e) => {
                              const formattedValue = toTitleCase(
                                e.target.value,
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_name`,
                                formattedValue,
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_code`,
                                formattedValue,
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.carrier_name`
                              ] as string
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={2.4}>
                          <FormTextInput
                            label="Rail Number"
                            required
                            placeholder="Enter rail number"
                            value={routing.rail_no || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.rail_no`,
                                value,
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value,
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.rail_no`
                              ] as string
                            }
                          />
                        </Grid.Col>
                      </>
                    )}

                    <Grid.Col span={2.4}>
                      <SingleDateInput
                        label="ETD"
                        withAsterisk
                        placeholder="YYYY-MM-DD"
                        {...(() => {
                          const inputProps = routingsForm.getInputProps(
                            `routings.${index}.etd`,
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.etd`,
                                value,
                              );
                            },
                          };
                        })()}
                        size="sm"
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <SingleDateInput
                        label="ETA"
                        withAsterisk
                        placeholder="YYYY-MM-DD"
                        {...(() => {
                          const inputProps = routingsForm.getInputProps(
                            `routings.${index}.eta`,
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.eta`,
                                value,
                              );
                            },
                          };
                        })()}
                        size="sm"
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <SingleDateInput
                        label="ATD"
                        placeholder="YYYY-MM-DD"
                        {...(() => {
                          const inputProps = routingsForm.getInputProps(
                            `routings.${index}.atd`,
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.atd`,
                                value,
                              );
                            },
                          };
                        })()}
                        size="sm"
                      />
                    </Grid.Col>

                    <Grid.Col span={2.4}>
                      <SingleDateInput
                        label="ATA"
                        placeholder="YYYY-MM-DD"
                        {...(() => {
                          const inputProps = routingsForm.getInputProps(
                            `routings.${index}.ata`,
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.ata`,
                                value,
                              );
                            },
                          };
                        })()}
                        size="sm"
                      />
                    </Grid.Col>

                    {/* Remove button - IconTrash only */}
                    {!isReadOnly && routingsForm.values.routings.length > 1 && (
                      <Grid.Col span={0.5}>
                        <ActionIcon
                          color="red"
                          variant="light"
                          size="lg"
                          onClick={() => removeRouting(index)}
                          style={{ marginTop: "1.75rem" }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Grid.Col>
                    )}

                    {/* Add Routing button - Only at last routing row */}
                    {!isReadOnly &&
                      index === routingsForm.values.routings.length - 1 && (
                        <Grid.Col span={0.5}>
                          <ActionIcon
                            // leftSection={<IconPlus size={16} />}
                            size="lg"
                            variant="light"
                            color="#105476"
                            onClick={addRouting}
                            style={{ marginTop: "1.75rem" }}
                          >
                            <IconPlus size={16}></IconPlus>
                            {/* Add Routing */}
                          </ActionIcon>
                          {/* <ActionIcon
                            color="red"
                            variant="light"
                            size="lg"
                            onClick={() => removeRouting(index)}
                            style={{ marginTop: "1.75rem" }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon> */}
                        </Grid.Col>
                      )}
                  </Grid>

                  {index < routingsForm.values.routings.length - 1 && (
                    <Divider my="xl" />
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Tab 3: Container Details */}
        <Tabs.Panel value="3">
          <Box mt="md">
            <Group justify="space-between" align="flex-start" mb="md">
              <Text size="lg" fw={600} c="#105476" mb="md">
                Container Details{" "}
                {containerDetailsForm.values.containers.length > 1 &&
                  `(${containerDetailsForm.values.containers.length})`}
              </Text>
              {/* {!isReadOnly && (
                <Group gap="sm"> */}
                  {/* <Button
                    variant="light"
                    color="#105476"
                    leftSection={<IconPlus size={16} />}
                    onClick={addContainer}
                  >
                    Add Container
                  </Button> */}
                  {/* <Button
                    variant={canSaveContainerDetails ? "filled" : "outline"}
                    color="#105476"
                    onClick={handleSaveContainerDetails}
                    disabled={!canSaveContainerDetails}
                    style={{
                      cursor: canSaveContainerDetails
                        ? "pointer"
                        : "not-allowed",
                    }}
                  >
                    Save Container
                  </Button> */}
                {/* </Group>
              )} */}
            </Group>

            {/* Static Header Row */}
            {containerDetailsForm.values.containers.length > 0 && (
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={2}>
                  <RequiredLabel label="Container Type" required={false} />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel label="Container No" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel label="Actual Seal No" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel label="Customs Seal No" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel label="Loading Date" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel label="Unloading Date" required={false} />
                </Grid.Col>
                <Grid.Col span={1.2}>
                  <RequiredLabel label="CFS Name" required={false} />
                </Grid.Col>
                <Grid.Col span={0.9}>
                  {containerDetailsForm.values.containers.length > 1 && (
                    <RequiredLabel label="Actions" required={false} />
                  )}
                </Grid.Col>
              </Grid>
            )}

            {/* Container Rows */}
            {containerDetailsForm.values.containers.map((_container, index) => (
              <Box key={index}>
                <Grid gutter="sm">
                  <Grid.Col span={2}>
                    <Dropdown
                      required
                      placeholder="Container Type"
                      searchable
                      data={containerTypeData}
                      nothingFoundMessage="No container types found"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.container_type`,
                      )}
                      disabled={isReadOnly}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.container_type`
                        ] as string
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <FormTextInput
                      placeholder="Container number"
                      maxLength={11}
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.container_no`,
                      )}
                      value={
                        containerDetailsForm.values.containers[index]?.container_no || ""
                      }
                      onChange={(e) => {
                        const raw = e.currentTarget.value.toUpperCase();
                        const alnumOnly = raw.replace(/[^A-Z0-9]/g, "");
                        const next = alnumOnly.slice(0, 11);
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.container_no`,
                          next,
                        );
                      }}
                      disabled={isReadOnly}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.container_no`
                        ] as string
                      }
                      onBlur={() => {
                        const currentValue =
                          containerDetailsForm.values.containers[
                            index
                          ]?.container_no?.trim();
                        if (currentValue) {
                          const duplicates =
                            containerDetailsForm.values.containers.filter(
                              (c, i) =>
                                i !== index &&
                                c.container_no?.trim() === currentValue,
                            );
                          if (duplicates.length > 0) {
                            containerDetailsForm.setFieldError(
                              `containers.${index}.container_no`,
                              "Container number must be unique",
                            );
                          } else {
                            const currentError =
                              containerDetailsForm.errors[
                                `containers.${index}.container_no`
                              ];
                            if (
                              currentError === "Container number must be unique"
                            ) {
                              containerDetailsForm.clearFieldError(
                                `containers.${index}.container_no`,
                              );
                            }
                          }
                        }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.5}>
                    <FormTextInput
                      placeholder="Actual seal number"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.actual_seal_no`,
                      )}
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.5}>
                    <FormTextInput
                      placeholder="Customs seal number"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.customs_seal_no`,
                      )}
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.5}>
                    <SingleDateInput
                      placeholder="YYYY-MM-DD"
                      value={
                        containerDetailsForm.values.containers[index]
                          ?.loading_date || null
                      }
                      onChange={(date) => {
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.loading_date`,
                          date,
                        );
                      }}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.loading_date`
                        ] as string
                      }
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.5}>
                    <SingleDateInput
                      placeholder="YYYY-MM-DD"
                      value={
                        containerDetailsForm.values.containers[index]
                          ?.unloading_date || null
                      }
                      onChange={(date) => {
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.unloading_date`,
                          date,
                        );
                      }}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.unloading_date`
                        ] as string
                      }
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.2}>
                    <SearchableSelect
                      placeholder="Type CFS name"
                      apiEndpoint={URL.cfsMaster}
                      value={
                        containerDetailsForm.values.containers[index]?.cfs_id !=
                        null
                          ? String(
                              containerDetailsForm.values.containers[index]
                                ?.cfs_id ?? "",
                            )
                          : null
                      }
                      displayValue={
                        containerDetailsForm.values.containers[index]
                          ?.cfs_name || undefined
                      }
                      onChange={(val, selectedData, originalData) => {
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.cfs_id`,
                          val != null && val !== "" ? val : null,
                        );
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.cfs_name`,
                          selectedData?.label ?? "",
                        );
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.cfs_address`,
                          String(
                            (
                              originalData as
                                | { address?: string; cfs_address?: string }
                                | undefined
                            )?.address ||
                              (
                                originalData as
                                  | { address?: string; cfs_address?: string }
                                  | undefined
                              )?.cfs_address ||
                              "",
                          ),
                        );
                      }}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String((item as { id?: number }).id ?? ""),
                        label: String(
                          (item as { cfs_name?: string }).cfs_name ?? "",
                        ),
                      })}
                      searchFields={["cfs_name"]}
                      size="sm"
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.9} style={{display: 'flex', justifyContent: 'space-between'}}>

                    {containerDetailsForm.values.containers.length > 1 &&
                      !isReadOnly && (
                        <Button
                          size="sm"
                          px={12}
                          variant="light"
                          color="red"
                          onClick={() => removeContainer(index)}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                                      {index === containerDetailsForm.values.containers.length - 1 && (
                                                          <Button
                                                          size="sm"
                                                          px={12}
                                                            variant="light"
                                                            color="#105476"
                                                            onClick={addContainer}
                                                          ><IconPlus size={16} /></Button>
      )}
                  </Grid.Col>
                </Grid>
              </Box>
            ))}
          </Box>
        </Tabs.Panel>

        {/* Tab 4: Estimates */}
        <Tabs.Panel value="4">
          <Box mt="md">
            <Group justify="space-between" align="center" mb="md" wrap="nowrap">
              <Text size="lg" fw={600} c="#105476">
                Estimates
              </Text>
              {mode === "edit" && !isReadOnly && (
                <Button
                  variant="outline"
                  color="#105476"
                  size="sm"
                  onClick={() => {
                  const toStr = (v: unknown) => String(v ?? "").trim();
                  const jobId = toStr(jobData?.job_id ?? jobData?.id);
                  if (!jobId) {
                    ToastNotification({
                      type: "error",
                      message: "Job ID not found for Supplier Invoice prefill.",
                    });
                    return;
                  }

                  const estimates = estimatesForm.values.estimates ?? [];
                  const estimateCharges = estimates
                    .map((e) => ({
                      shipment_no: jobId,
                      charge_id: e.charge_id ?? null,
                      charge_name: e.charge_name ?? "",
                      currency_id: e.currency_id ?? null,
                      roe: e.roe ?? null,
                      amount: e.total_cost ?? null,
                      supplier_code: toStr((e as any).supplier_code),
                      supplier_name: toStr((e as any).supplier_name),
                    }))
                    .filter(
                      (c) =>
                        toStr((c as any).shipment_no) &&
                        (c as any).charge_id != null &&
                        (c as any).amount != null &&
                        (c as any).amount !== "" &&
                        (toStr((c as any).supplier_code) ||
                          toStr((c as any).supplier_name)),
                    );

                  const houseCharges = (housingDetails ?? [])
                    .flatMap((h) => {
                      const rec = h as unknown as Record<string, unknown>;
                      const shipmentNo = toStr((rec as any).shipment_id);
                      const chargesArr = Array.isArray((rec as any).charges)
                        ? ((rec as any).charges as unknown[])
                        : Array.isArray((rec as any).mbl_charges)
                          ? ((rec as any).mbl_charges as unknown[])
                          : [];
                      return chargesArr
                        .map((c) => {
                          const cr = c as Record<string, unknown>;
                          return {
                            shipment_no: shipmentNo,
                            charge_id:
                              cr.charge_id != null ? Number(cr.charge_id) : null,
                            charge_name: toStr(cr.charge_name),
                            currency_id:
                              (cr as any).currency_id ??
                              (cr as any).currency ??
                              null,
                            roe: (cr as any).roe ?? null,
                            amount:
                              (cr as any).total_cost ??
                              (cr as any).cost_local_amount ??
                              (cr as any).amount ??
                              null,
                            supplier_code: toStr((cr as any).supplier_code),
                            supplier_name: toStr((cr as any).supplier_name),
                          };
                        })
                        .filter(
                          (x) =>
                            toStr((x as any).shipment_no) &&
                            (x as any).charge_id != null &&
                            (x as any).amount != null &&
                            (x as any).amount !== "" &&
                            (toStr((x as any).supplier_code) ||
                              toStr((x as any).supplier_name)),
                        );
                    })
                    .filter(Boolean);

                  const charges = [...estimateCharges, ...houseCharges];
                  if (charges.length === 0) {
                    ToastNotification({
                      type: "error",
                      message:
                        "No charges found in Estimates/House charges to prefill.",
                    });
                    return;
                  }

                  navigate("/supplier-invoice/create", {
                    state: {
                      prefillSupplierInvoiceFromJob: {
                        source: "air-import-job",
                        job_id: jobId,
                        charges,
                      },
                    },
                  });
                  }}
                >
                  Create Supplier Invoice
                </Button>
              )}
            </Group>
            <EstimatesSection serviceType="SEA" form={estimatesForm} readOnly={isReadOnly} />
          </Box>
        </Tabs.Panel>

        {mode === "edit" && jobData?.id && (
          <Tabs.Panel value="5">
            <Box mt="md">
              <Text size="md" fw={600} c="#105476" mb="md">
                Accounts
              </Text>
              {invoiceListLoading ? (
                <Center py="xl">
                  <Loader color="#105476" size="lg" />
                </Center>
              ) : (
                <ScrollArea>
                  <Table
                    withTableBorder
                    withColumnBorders
                    striped
                    highlightOnHover
                    style={{ minWidth: 700 }}
                    styles={{
                      th: { padding: "8px" },
                      td: { padding: "8px" },
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Daybook
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Invoice number
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Invoice Date
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Invoice Total
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Status
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Actions
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {invoiceList.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Center py="xl">
                              <Text c="dimmed">No invoices to display</Text>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        invoiceList.map((row, idx) => {
                          const statusUpper = (row.status ?? "").toUpperCase();
                          const isPosted =
                            statusUpper === "POSTED" || row.status === "posted";
                          const isUnposted =
                            statusUpper === "UNPOSTED" ||
                            row.status === "unpost";
                          const isReversed =
                            statusUpper === "PARTIALLY REVERSED" ||
                            statusUpper === "FULLY REVERSED";
                          const rowKey = `${row.id}-${idx}`;
                          const isExpanded = expandedInvoiceRowId === rowKey;
                          const reverseInvoices = row.reverse_invoices ?? [];
                          const hasReverseInvoices = reverseInvoices.length > 0;
                          const invoiceViewId = row.invoice_id ?? row.id;
                          return (
                            <Fragment key={rowKey}>
                              <Table.Tr
                                style={
                                  isReversed ? { cursor: "pointer" } : undefined
                                }
                                onClick={(e) => {
                                  if (
                                    (e.target as HTMLElement).closest(
                                      "[data-menu-dropdown],[button]",
                                    )
                                  )
                                    return;
                                  if (!isReversed) {
                                    setExpandedInvoiceRowId(null);
                                    return;
                                  }
                                  setExpandedInvoiceRowId((prev) =>
                                    prev === rowKey ? null : rowKey,
                                  );
                                }}
                              >
                                <Table.Td
                                  style={{ fontSize: "13px", width: "20%" }}
                                >
                                  <Group gap="xs" wrap="nowrap">
                                    {isReversed && (
                                      <Box
                                        component="span"
                                        style={{ display: "inline-flex" }}
                                      >
                                        {isExpanded ? (
                                          <IconChevronUp
                                            size={14}
                                            color="#105476"
                                          />
                                        ) : (
                                          <IconChevronDown
                                            size={14}
                                            color="#105476"
                                          />
                                        )}
                                      </Box>
                                    )}
                                    {row.day_book_name ?? "-"}
                                  </Group>
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "20%" }}
                                >
                                  {row.document_no ?? "-"}
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                >
                                  {row.document_date ?? "-"}
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                >
                                  {row.total}
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                >
                                  <Badge
                                    size="sm"
                                    variant="light"
                                    color={
                                      isUnposted
                                        ? "yellow"
                                        : isPosted
                                          ? "green"
                                          : "#105476"
                                    }
                                  >
                                    {row.status ?? "-"}
                                  </Badge>
                                </Table.Td>
                                <Table.Td
                                  style={{ fontSize: "13px", width: "15%" }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Menu
                                    shadow="md"
                                    width={200}
                                    position="bottom-end"
                                  >
                                    <Menu.Target>
                                      <ActionIcon
                                        variant="subtle"
                                        color="#105476"
                                        size="sm"
                                        styles={{
                                          root: {
                                            fontFamily: "Inter",
                                            fontSize: "13px",
                                            border: "1px solid #E9ECEF",
                                            borderRadius: "8px",
                                            "&:hover": {
                                              backgroundColor: "#F8F9FA",
                                            },
                                          },
                                        }}
                                      >
                                        <IconDotsVertical size={16} />
                                      </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown
                                      styles={{
                                        dropdown: {
                                          border: "1px solid #E9ECEF",
                                          borderRadius: "8px",
                                          padding: "8px",
                                          boxShadow:
                                            "0 4px 12px rgba(0, 0, 0, 0.1)",
                                        },
                                      }}
                                    >
                                      <Menu.Item
                                        leftSection={
                                          <Box
                                            style={{
                                              backgroundColor: "#E7F5FF",
                                              borderRadius: "6px",
                                              padding: "6px",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <IconEye
                                              size={16}
                                              color="#105476"
                                            />
                                          </Box>
                                        }
                                        styles={{
                                          item: {
                                            fontFamily: "Inter",
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            borderRadius: "6px",
                                            padding: "10px 12px",
                                            marginBottom: "4px",
                                            "&:hover": {
                                              backgroundColor: "#F8F9FA",
                                            },
                                          },
                                          itemLabel: {
                                            fontFamily: "Inter",
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            color: "#424242",
                                          },
                                        }}
                                        onClick={() =>
                                          navigate(
                                            `/SeaExport/import-job/invoice/view/${invoiceViewId}`,
                                            {
                                              state: {
                                                invoiceData: row,
                                                fromJobLevel: true,
                                                ...(location.state?.job && {
                                                  job: location.state.job,
                                                }),
                                              },
                                            },
                                          )
                                        }
                                      >
                                        View
                                      </Menu.Item>
                                      {isUnposted ? (
                                        <Menu.Item
                                          leftSection={
                                            <Box
                                              style={{
                                                backgroundColor: "#E7F5FF",
                                                borderRadius: "6px",
                                                padding: "6px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                              }}
                                            >
                                              <IconEdit
                                                size={16}
                                                color="#105476"
                                              />
                                            </Box>
                                          }
                                          styles={{
                                            item: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              borderRadius: "6px",
                                              padding: "10px 12px",
                                              marginBottom: "4px",
                                              "&:hover": {
                                                backgroundColor: "#F8F9FA",
                                              },
                                            },
                                            itemLabel: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                            },
                                          }}
                                          onClick={() =>
                                            navigate(
                                              `/SeaExport/import-job/invoice/edit/${row.invoice_id}`,
                                              {
                                                state: {
                                                  invoiceData: row,
                                                  fromJobLevel: true,
                                                  ...(location.state?.job && {
                                                    job: location.state.job,
                                                  }),
                                                },
                                              },
                                            )
                                          }
                                        >
                                          Edit
                                        </Menu.Item>
                                      ) : (
                                        <Menu.Item
                                          leftSection={
                                            <Box
                                              style={{
                                                backgroundColor: "#E7F5FF",
                                                borderRadius: "6px",
                                                padding: "6px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                              }}
                                            >
                                              <IconRefresh
                                                size={16}
                                                color="#105476"
                                              />
                                            </Box>
                                          }
                                          styles={{
                                            item: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              borderRadius: "6px",
                                              padding: "10px 12px",
                                              marginBottom: "4px",
                                              "&:hover": {
                                                backgroundColor: "#F8F9FA",
                                              },
                                            },
                                            itemLabel: {
                                              fontFamily: "Inter",
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#424242",
                                            },
                                          }}
                                          onClick={() =>
                                            navigate(
                                              "/SeaExport/import-job/invoice/reverse",
                                              {
                                                state: {
                                                  document_no:
                                                    row.document_no ?? "",
                                                  ...(location.state?.job && {
                                                    job: location.state.job,
                                                  }),
                                                },
                                              },
                                            )
                                          }
                                        >
                                          Invoice Reversal
                                        </Menu.Item>
                                      )}
                                    </Menu.Dropdown>
                                  </Menu>
                                </Table.Td>
                              </Table.Tr>

                              {isReversed && isExpanded && (
                                <Table.Tr>
                                  <Table.Td
                                    colSpan={6}
                                    style={{
                                      padding: 0,
                                      verticalAlign: "top",
                                      backgroundColor:
                                        "var(--mantine-color-gray-0)",
                                    }}
                                  >
                                    <Box
                                      p="sm"
                                      style={{ borderTop: "1px solid #E9ECEF" }}
                                    >
                                      <Text
                                        size="sm"
                                        fw={600}
                                        c="#105476"
                                        mb="xs"
                                      >
                                        Reverse invoices
                                      </Text>
                                      <Table
                                        withTableBorder
                                        withColumnBorders
                                        striped
                                        style={{ minWidth: 700 }}
                                      >
                                        <Table.Thead>
                                          <Table.Tr>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "20%",
                                              }}
                                            >
                                              Daybook
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "20%",
                                              }}
                                            >
                                              Invoice number
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Invoice Date
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Invoice Total
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Status
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "15%",
                                              }}
                                            >
                                              Actions
                                            </Table.Th>
                                          </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                          {hasReverseInvoices ? (
                                            reverseInvoices.map(
                                              (rev, revIdx) => (
                                                <Table.Tr
                                                  key={rev.id ?? revIdx}
                                                >
                                                  <Table.Td
                                                    style={{
                                                      fontSize: "12px",
                                                      width: "20%",
                                                    }}
                                                  >
                                                    {rev.day_book_name ?? "-"}
                                                  </Table.Td>
                                                  <Table.Td
                                                    style={{
                                                      fontSize: "12px",
                                                      width: "20%",
                                                    }}
                                                  >
                                                    {rev.document_no ?? "-"}
                                                  </Table.Td>
                                                  <Table.Td
                                                    style={{
                                                      fontSize: "12px",
                                                      width: "15%",
                                                    }}
                                                  >
                                                    {rev.document_date ?? "-"}
                                                  </Table.Td>
                                                  <Table.Td
                                                    style={{
                                                      fontSize: "12px",
                                                      width: "15%",
                                                    }}
                                                  >
                                                    {rev.total ?? "-"}
                                                  </Table.Td>
                                                  <Table.Td
                                                    style={{
                                                      fontSize: "12px",
                                                      width: "15%",
                                                    }}
                                                  >
                                                    <Badge
                                                      size="sm"
                                                      variant="light"
                                                      color="#105476"
                                                    >
                                                      {rev.status ?? "-"}
                                                    </Badge>
                                                  </Table.Td>
                                                  <Table.Td
                                                    style={{
                                                      fontSize: "12px",
                                                      width: "15%",
                                                    }}
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  >
                                                    <Menu
                                                      shadow="md"
                                                      width={200}
                                                      position="bottom-end"
                                                    >
                                                      <Menu.Target>
                                                        <ActionIcon
                                                          variant="subtle"
                                                          color="#105476"
                                                          size="sm"
                                                          styles={{
                                                            root: {
                                                              fontFamily:
                                                                "Inter",
                                                              fontSize: "13px",
                                                              border:
                                                                "1px solid #E9ECEF",
                                                              borderRadius:
                                                                "8px",
                                                              "&:hover": {
                                                                backgroundColor:
                                                                  "#F8F9FA",
                                                              },
                                                            },
                                                          }}
                                                        >
                                                          <IconDotsVertical
                                                            size={16}
                                                          />
                                                        </ActionIcon>
                                                      </Menu.Target>
                                                      <Menu.Dropdown
                                                        styles={{
                                                          dropdown: {
                                                            border:
                                                              "1px solid #E9ECEF",
                                                            borderRadius: "8px",
                                                            padding: "8px",
                                                            boxShadow:
                                                              "0 4px 12px rgba(0, 0, 0, 0.1)",
                                                          },
                                                        }}
                                                      >
                                                        <Menu.Item
                                                          leftSection={
                                                            <Box
                                                              style={{
                                                                backgroundColor:
                                                                  "#E7F5FF",
                                                                borderRadius:
                                                                  "6px",
                                                                padding: "6px",
                                                                display: "flex",
                                                                alignItems:
                                                                  "center",
                                                                justifyContent:
                                                                  "center",
                                                              }}
                                                            >
                                                              <IconEye
                                                                size={16}
                                                                color="#105476"
                                                              />
                                                            </Box>
                                                          }
                                                          styles={{
                                                            item: {
                                                              fontFamily:
                                                                "Inter",
                                                              fontSize: "13px",
                                                              fontWeight: 500,
                                                              borderRadius:
                                                                "6px",
                                                              padding:
                                                                "10px 12px",
                                                              marginBottom:
                                                                "4px",
                                                              "&:hover": {
                                                                backgroundColor:
                                                                  "#F8F9FA",
                                                              },
                                                            },
                                                            itemLabel: {
                                                              fontFamily:
                                                                "Inter",
                                                              fontSize: "13px",
                                                              fontWeight: 500,
                                                              color: "#424242",
                                                            },
                                                          }}
                                                          onClick={() => {
                                                            const targetId =
                                                              (rev.reverse_invoice_id ??
                                                                row.reverse_invoice_id) as number;
                                                            navigate(
                                                              `/SeaExport/import-job/invoice/view/${targetId}`,
                                                              {
                                                                state: {
                                                                  invoiceData: {
                                                                    ...row,
                                                                    ...rev,
                                                                    id: targetId,
                                                                    document_no:
                                                                      rev.document_no ??
                                                                      row.document_no,
                                                                    document_date:
                                                                      rev.document_date ??
                                                                      row.document_date,
                                                                    total:
                                                                      rev.total ??
                                                                      row.total,
                                                                    status:
                                                                      rev.status ??
                                                                      row.status,
                                                                    day_book_name:
                                                                      rev.day_book_name ??
                                                                      row.day_book_name,
                                                                  },
                                                                  fromJobLevel: true,
                                                                  ...(location
                                                                    .state
                                                                    ?.job && {
                                                                    job: location
                                                                      .state
                                                                      .job,
                                                                  }),
                                                                },
                                                              },
                                                            );
                                                          }}
                                                        >
                                                          View
                                                        </Menu.Item>
                                                      </Menu.Dropdown>
                                                    </Menu>
                                                  </Table.Td>
                                                </Table.Tr>
                                              ),
                                            )
                                          ) : (
                                            <Table.Tr>
                                              <Table.Td
                                                colSpan={6}
                                                style={{ fontSize: "12px" }}
                                              >
                                                <Center py="md">
                                                  <Text c="dimmed">
                                                    No reverse invoices to
                                                    display
                                                  </Text>
                                                </Center>
                                              </Table.Td>
                                            </Table.Tr>
                                          )}
                                        </Table.Tbody>
                                      </Table>
                                    </Box>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Box>
          </Tabs.Panel>
        )}
      </Tabs>

      <Group justify="space-between" mt="xl">
        <Group>
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() =>
              navigate("/SeaExport/import-job", {
                state: { refreshData: true },
              })
            }
          >
            Back to List
          </Button>
          {(active === 1 ||
            active === 2 ||
            active === 3 ||
            active === 4 ||
            (active === 5 && mode === "edit" && jobData?.id)) &&
            !isReadOnly && (
              <Button
                leftSection={<IconChevronLeft size={16} />}
                variant="outline"
                color="#105476"
                onClick={handlePrev}
              >
                Previous
              </Button>
            )}
        </Group>

        <Group>
          {!isReadOnly && active === 3 && (
            <Tooltip
              label="Please enter Container Type and Container Number in at least one row to enable Add HBL"
              disabled={canAddHBL}
              withArrow
            >
              <Button
                variant="outline"
                color="#105476"
                leftSection={<IconPlus size={16} />}
                onClick={() => navigateToHouseCreate()}
                disabled={!canAddHBL}
                style={{
                  cursor: canAddHBL ? "pointer" : "not-allowed",
                }}
              >
                Add HBL
              </Button>
            </Tooltip>
          )}
          {active === 0 && !isReadOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
              loading={isSubmitting}
            >
              Next
            </Button>
          )}

          {active === 1 && !isReadOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
            >
              Next
            </Button>
          )}

          {active === 2 && !isReadOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
            >
              Next
            </Button>
          )}
          {active === 3 && !isReadOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
            >
              Next
            </Button>
          )}
          {active === 4 && !isReadOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
              loading={isSubmitting}
            >
              Submit
            </Button>
          )}
        </Group>
      </Group>
      {/* Housing Details Display - Show at the top (all steps) */}
      {housingDetails.length > 0 && (
        <Box mb="xl">
          <Text size="lg" fw={600} c="#105476" mb="md" mt="md">
            House Bill of Lading ({housingDetails.length})
          </Text>
          <Stack gap="md">
            {housingDetails.map((house, index) => (
              <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Group>
                    <Badge color="#105476" size="lg">
                      HBL {index + 1}
                    </Badge>
                    <Badge
                      color={
                        house.routed === "self" || house.routed === "agent"
                          ? "green"
                          : "gray"
                      }
                      variant="light"
                    >
                      {house.routed === "self"
                        ? "Self"
                        : house.routed === "agent"
                          ? "Agent"
                          : "Not Routed"}
                    </Badge>
                    {house.routed_by && (
                      <Badge color="blue" variant="light" ml="xs">
                        Routed By : {house.routed_by}
                      </Badge>
                    )}
                    {house.shipment_id && (
                      <Badge color="#105476" variant="light">
                        Shipment Id : {house.shipment_id}
                      </Badge>
                    )}
                  </Group>
                  {!isReadOnly && (
                    <Group gap="xs">
                      <Button
                        variant="light"
                        color="#105476"
                        size="xs"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleEditHousingDetail(index)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => removeHousingDetail(index)}
                      >
                        Remove
                      </Button>
                      <Menu shadow="md" width={200} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="#105476"
                            size="lg"
                            styles={{
                              root: {
                                fontFamily: "Inter",
                                fontSize: "13px",
                                border: "1px solid #E9ECEF",
                                borderRadius: "8px",
                                "&:hover": {
                                  backgroundColor: "#F8F9FA",
                                },
                              },
                            }}
                          >
                            <IconDotsVertical size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown
                          styles={{
                            dropdown: {
                              border: "1px solid #E9ECEF",
                              borderRadius: "8px",
                              padding: "8px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                            },
                          }}
                        >
                          <Menu.Item
                            leftSection={
                              <Box
                                style={{
                                  backgroundColor: "#E7F5FF",
                                  borderRadius: "6px",
                                  padding: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <IconEye size={16} color="#105476" />
                              </Box>
                            }
                            styles={{
                              item: {
                                fontFamily: "Inter",
                                fontSize: "13px",
                                fontWeight: 500,
                                borderRadius: "6px",
                                padding: "10px 12px",
                                marginBottom: "4px",
                                "&:hover": {
                                  backgroundColor: "#F8F9FA",
                                },
                              },
                              itemLabel: {
                                fontFamily: "Inter",
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "#424242",
                              },
                            }}
                            onClick={() =>
                              generateCargoArrivalNoticePDFPreview(house)
                            }
                          >
                            Cargo Arrival Notice
                          </Menu.Item>
                          <Menu.Item
                            leftSection={
                              <Box
                                style={{
                                  backgroundColor: "#E7F5FF",
                                  borderRadius: "6px",
                                  padding: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <IconEye size={16} color="#105476" />
                              </Box>
                            }
                            styles={{
                              item: {
                                fontFamily: "Inter",
                                fontSize: "13px",
                                fontWeight: 500,
                                borderRadius: "6px",
                                padding: "10px 12px",
                                marginBottom: "4px",
                                "&:hover": {
                                  backgroundColor: "#F8F9FA",
                                },
                              },
                              itemLabel: {
                                fontFamily: "Inter",
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "#424242",
                              },
                            }}
                            onClick={() => openDoConfigModal(house)}
                          >
                            Delivery Order
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  )}
                </Group>

                <Grid>
                  {/* <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Shipment ID
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.shipment_id || "-"}
                    </Text>
                  </Grid.Col> */}

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      HBL Number
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.hbl_number || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Origin
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.origin_name && house.origin_code
                        ? `${house.origin_name} (${house.origin_code})`
                        : house.origin_code || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Destination
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.destination_name && house.destination_code
                        ? `${house.destination_name} (${house.destination_code})`
                        : house.destination_code || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Customer Service
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.customer_service || "-"}
                    </Text>
                  </Grid.Col>

                  {/* <Grid.Col span={12}>
                    <Divider my="sm" />
                  </Grid.Col>

                  <Grid.Col span={4}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Destination Agent
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.destination_agent_name || "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.destination_agent_email || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={4}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Shipper
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.shipper_name || "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.shipper_email || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={4}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Consignee
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.consignee_name || "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.consignee_email || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={12}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Notify Customer
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.notify1_customer_name ?? "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm">{house.notify1_customer_email ?? "-"}</Text>
                  </Grid.Col> */}
                </Grid>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title={`Cargo Arrival Notice - ${currentHousingForPreview?.hbl_number || "HBL"}`}
        size="xl"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        centered
        fullScreen
        transitionProps={{ transition: "fade", duration: 200 }}
      >
        <Stack h="82vh">
          {pdfBlob ? (
            <>
              <iframe
                src={pdfBlob}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="PDF Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleClosePreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  leftSection={<IconDownload size={16} />}
                  color="#105476"
                >
                  Download PDF
                </Button>
              </Group>
            </>
          ) : (
            <Center h="100%">
              <Stack align="center">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Generating PDF preview...</Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>

      {/* Delivery Order PDF Preview Modal */}
      <Modal
        opened={doConfigOpen}
        onClose={handleCloseDoConfig}
        title="Delivery Order Options"
        centered
        size={"md"}
      >
        <Stack>
          <Dropdown
            label="Type"
            required
            placeholder="Select Type"
            dropdownZIndex={3000}
            data={[
              { value: "carrier_agent", label: "Carrier Agent" },
              { value: "unstuff_place", label: "Unstuff Place" },
            ]}
            value={doTypeSelection}
            onChange={(value) => setDoTypeSelection(value as DoTypeOption)}
          />
          <Dropdown
            label="Deliver to"
            required
            placeholder="Select Deliver to"
            dropdownZIndex={3000}
            data={[
              { value: "consignee", label: "Consignee" },
              { value: "notify", label: "Notify" },
              { value: "cha", label: "CHA" },
            ]}
            value={doDeliverToSelection}
            onChange={(value) =>
              setDoDeliverToSelection(value as DoDeliverToOption)
            }
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="outline" onClick={handleCloseDoConfig}>
              Cancel
            </Button>
            <Button color="#105476" onClick={handleGenerateDeliveryOrderFromConfig}>
              Generate PDF
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delivery Order PDF Preview Modal */}
      <Modal
        opened={doPreviewOpen}
        onClose={handleCloseDoPreview}
        title={`Delivery Order - ${currentHousingForDoPreview?.hbl_number || "HBL"}`}
        size="xl"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        centered
        fullScreen
        transitionProps={{ transition: "fade", duration: 200 }}
      >
        <Stack h="82vh">
          {doPdfBlob ? (
            <>
              <iframe
                src={doPdfBlob}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="Delivery Order PDF Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleCloseDoPreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleDownloadDoPDF}
                  leftSection={<IconDownload size={16} />}
                  color="#105476"
                >
                  Download PDF
                </Button>
              </Group>
            </>
          ) : (
            <Center h="100%">
              <Stack align="center">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Generating Delivery Order PDF preview...</Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}

export default ImportJobCreate;
