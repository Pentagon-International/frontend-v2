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
  Radio,
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
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  SingleDateInput,
  EstimatesSection,
  useEstimatesForm,
} from "../../../components";
import { generateBillOfLadingPDF } from "../../jobs/pdf/BillOfLadingPDFTemplate";
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
import FormTextInput from "../../../components/FormTextInput";
import RequiredLabel from "../../../components/RequiredLabel";
import { roundToDecimals } from "../../../utils/numberInputUtils";

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
  is_direct: boolean;
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
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
  is_direct: yup.boolean().required(),
  origin_agent: yup
    .string()
    // Custom test to make the conditional "required" behavior deterministic.
    // We treat Direct as NOT required when is_direct === true.
    // Destination Agent is required when is_direct === false.
    .test(
      "origin_agent-required-when-direct",
      "Destination Agent is required",
      function (value) {
        const parent = this.parent as { is_direct?: boolean };
        const isDirect = parent.is_direct === true;
        // If Direct = Yes (true), Destination Agent is optional
        if (isDirect) return true;

        if (value == null) {
          return this.createError({
            message: "Destination Agent is required",
          });
        }

        if (String(value).trim() === "") {
          return this.createError({
            message: "Destination Agent is required",
          });
        }

        return true;
      },
    ),
  origin_code: yup.string().required("Origin is required"),
  destination_code: yup.string().required("Destination is required"),
  etd: yup.date().required("ETD is required"),
  eta: yup.date().required("ETA is required"),
  atd: yup.date().nullable(),
  ata: yup.date().nullable(),
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
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  notify_customer1_name: string;
  notify_customer1_address: string;
  notify_customer1_email: string;
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

// Helper function to get transport_mode based on transport_type
const getTransportMode = (
  transportType: string | null | undefined,
): string | undefined => {
  if (!transportType) return undefined;
  const type = transportType.trim().toUpperCase();
  if (type === "AIR") return "AIR";
  if (type === "SEA" || type === "FCL" || type === "LCL") return "SEA";
  if (type === "ROAD") return "LAND";
  return undefined;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "y";
  }
  return false;
};

function ExportJobCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingJobById, setIsFetchingJobById] = useState(false);
  const [housingDetails, setHousingDetails] = useState<HousingDetail[]>(
    location.state?.housingDetails &&
      Array.isArray(location.state.housingDetails)
      ? location.state.housingDetails
      : [],
  );

  // PDF Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [currentHousingForPreview, setCurrentHousingForPreview] =
    useState<HousingDetail | null>(null);

  // Cargo Manifest PDF preview state
  const [cargoManifestPreviewOpen, setCargoManifestPreviewOpen] =
    useState(false);
  const [cargoManifestPdfBlob, setCargoManifestPdfBlob] = useState<
    string | null
  >(null);

  // Proforma PDF preview state
  const [proformaPreviewOpen, setProformaPreviewOpen] = useState(false);
  const [proformaPdfBlob, setProformaPdfBlob] = useState<string | null>(null);
  const [proformaCurrencyModalOpen, setProformaCurrencyModalOpen] =
    useState(false);
  const [selectedProformaCurrency, setSelectedProformaCurrency] =
    useState<string>("");
  const [pendingProformaShipmentId, setPendingProformaShipmentId] = useState<
    string | null
  >(null);

  // Accounts tab: invoice list from filter/invoice API
  const [invoiceList, setInvoiceList] = useState<InvoiceListItem[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(false);
  const [expandedInvoiceRowId, setExpandedInvoiceRowId] = useState<
    string | null
  >(null);

  // Get user from auth store
  const user = useAuthStore((state) => state.user);

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

  // When navigated from Customer Service (Jobs without BL) with jobId only - fetch job and show
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
          navigate("/SeaExport/export-job/edit", {
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
      is_direct: false,
      etd: null,
      eta: null,
      atd: null,
      ata: null,
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
          setActive(2);
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
        // Extract agent_address from origin_agent_data if available
        let agentAddress = "";
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
              agentAddress = addressesData[0].address;
            }
          }
        }

        mblDetailsForm.setValues({
          service: mblData.service || "",
          is_direct: parseBoolean(
            (mblData as { is_direct?: unknown })?.is_direct,
          ),
          origin_agent:
            mblData.agent_code ||
            mblData.origin_agent_code ||
            mblData.origin_agent ||
            "",
          agent_name: mblData.agent_name || mblData.origin_agent_name || "",
          agent_address: agentAddress,
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
              agent_address: house.agent_address
                ? String(house.agent_address)
                : "",
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
              consignee_name: house.consignee_name
                ? String(house.consignee_name)
                : "",
              consignee_address: house.consignee_address
                ? String(house.consignee_address)
                : "",
              consignee_email: house.consignee_email
                ? String(house.consignee_email)
                : "",
              notify_customer1_name:
                (house.notify1_customer_name ?? house.notify_customer1_name)
                  ? String(
                      house.notify1_customer_name ??
                        house.notify_customer1_name,
                    )
                  : "",
              notify_customer1_address:
                (house.notify1_customer_address ??
                house.notify_customer1_address)
                  ? String(
                      house.notify1_customer_address ??
                        house.notify_customer1_address,
                    )
                  : "",
              notify_customer1_email:
                (house.notify1_customer_email ?? house.notify_customer1_email)
                  ? String(
                      house.notify1_customer_email ??
                        house.notify_customer1_email,
                    )
                  : "",
              notify2_customer_name: house.notify2_customer_name
                ? String(house.notify2_customer_name)
                : "",
              notify2_customer_address: house.notify2_customer_address
                ? String(house.notify2_customer_address)
                : "",
              notify2_customer_email: house.notify2_customer_email
                ? String(house.notify2_customer_email)
                : "",
              commodity_description: house.commodity_description
                ? String(house.commodity_description)
                : "",
              marks_no: house.marks_no ? String(house.marks_no) : "",
              shipment_terms_code: house.shipment_terms_code
                ? String(house.shipment_terms_code)
                : house.shipment_terms_name
                  ? String(house.shipment_terms_name)
                  : "",
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
                            charge.sell_local_amount !== null &&
                            charge.sell_local_amount !== undefined
                              ? typeof charge.sell_local_amount === "string"
                                ? parseFloat(charge.sell_local_amount) || null
                                : (charge.sell_local_amount as number)
                              : null;

                          const unitCost =
                            charge.unit_cost !== null &&
                            charge.unit_cost !== undefined
                              ? typeof charge.unit_cost === "string"
                                ? parseFloat(charge.unit_cost) || null
                                : (charge.unit_cost as number)
                              : null;

                          const totalCost =
                            charge.total_cost !== null &&
                            charge.total_cost !== undefined
                              ? typeof charge.total_cost === "string"
                                ? parseFloat(charge.total_cost) || null
                                : (charge.total_cost as number)
                              : null;

                          const costLocal =
                            charge.cost_local_amount !== null &&
                            charge.cost_local_amount !== undefined
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
          console.log(
            "mappedHousingDetails..................",
            mappedHousingDetails,
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

              if (transportType === "SEA" || transportType === "VESSEL") {
                voyage_number = routing.voyage_number
                  ? String(routing.voyage_number)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = voyage_number;
              } else if (transportType === "AIR") {
                flight = routing.flight
                  ? String(routing.flight)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = flight;
              } else if (transportType === "ROAD") {
                truck_no = routing.truck_no
                  ? String(routing.truck_no)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = truck_no;
              } else if (transportType === "RAIL") {
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
            const raw = String(value ?? "")
              .trim()
              .toUpperCase();
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
    if (mode !== "edit" && active === 4) setActive(0);
  }, [active, mode]);

  // Fetch invoice list when Accounts tab is active
  useEffect(() => {
    if (active !== 4) return;
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

    if (
      mode !== "create" ||
      !(
        isNavigatingBackFromHouseCreate ||
        location.state?.mblDetails ||
        location.state?.carrierDetails ||
        location.state?.routings ||
        location.state?.containerDetails
      )
    ) {
      return; // Exit early → NO restore in edit mode
    }
    // Restore form values when:
    // 1. We're navigating back from HouseCreate (has housingDetails) OR
    // 2. We're in create mode and have form data in location.state
    // But skip if we're in initial edit load (has jobData but no housingDetails)
    const shouldRestore =
      mode === "create" &&
      (isNavigatingBackFromHouseCreate ||
        location.state?.mblDetails ||
        location.state?.carrierDetails ||
        location.state?.routings ||
        location.state?.containerDetails);

    if (mode === "create" && shouldRestore) {
      // Restore MBL Details
      if (location.state?.mblDetails) {
        const mblDetails = location.state.mblDetails;
        mblDetailsForm.setValues({
          service: mblDetails.service || "",
          is_direct: parseBoolean(
            (mblDetails as { is_direct?: unknown })?.is_direct,
          ),
          origin_agent: mblDetails.origin_agent || "",
          agent_name:
            (mblDetails as { agent_name?: string } | undefined)?.agent_name ||
            "",
          agent_address:
            (mblDetails as { agent_address?: string } | undefined)
              ?.agent_address || "",
          origin_code: mblDetails.origin_code || "",
          origin_name: mblDetails.origin_name || "",
          destination_code: mblDetails.destination_code || "",
          destination_name: mblDetails.destination_name || "",
          etd: mblDetails.etd || null,
          eta: mblDetails.eta || null,
          atd: mblDetails.atd || null,
          ata: mblDetails.ata || null,
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
        Array.isArray(location.state.estimates) &&
        location.state.estimates.length > 0
      ) {
        estimatesForm.setFieldValue(
          "estimates",
          location.state.estimates as typeof estimatesForm.values.estimates,
        );
      }

      // Set active step to 2 (Container Details) when navigating back from HouseCreate
      // This ensures the user sees the HBL list after saving
      if (isNavigatingBackFromHouseCreate) {
        setActive(2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.state?.mblDetails,
    location.state?.carrierDetails,
    location.state?.routings,
    location.state?.containerDetails,
    location.state?.housingDetails,
    mode,
    jobData,
  ]);

  // Restore estimates when coming back from HouseCreate (works for create/edit)
  useEffect(() => {
    if (
      location.state?.fromHouseCreate === true &&
      location.state?.estimates &&
      Array.isArray(location.state.estimates) &&
      location.state.estimates.length > 0
    ) {
      estimatesForm.setFieldValue(
        "estimates",
        location.state.estimates as typeof estimatesForm.values.estimates,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.fromHouseCreate, location.state?.estimates]);

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
      if (validateStep2()) {
        // Save container details before moving to step 3
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
        setActive(2);
      }
    } else if (active === 2) {
      if (validateStep3()) {
        // Save container details before submitting
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
        setActive(3);
      }
    } else if (active === 3) {
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

  // Generate Bill Of Lading PDF Preview
  const generateBillOfLadingPDFPreview = async (housing: HousingDetail) => {
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
        ...jobData,
        ...housing,
        mblDetails: {
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
        containerDetails: containerDetailsForm.values.containers,
      };

      const blobUrl = generateBillOfLadingPDF(
        combinedData,
        housing,
        defaultBranch,
        country,
      );
      setPdfBlob(blobUrl);
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
      link.download = `Bill-Of-Lading-${currentHousingForPreview.hbl_number || "HBL"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  // Cargo Manifest PDF preview handlers
  const handleCargoManifestPreview = async () => {
    if (!jobData?.id) return;
    setCargoManifestPreviewOpen(true);
    setCargoManifestPdfBlob(null);
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${URL.base}job-create/cargo-manifest/${jobData.id}/pdf/`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const pdfUrl = window.URL.createObjectURL(blob);
      setCargoManifestPdfBlob(pdfUrl);
    } catch (error) {
      console.error("Error fetching cargo manifest PDF:", error);
      ToastNotification({
        type: "error",
        message: "Failed to load cargo manifest PDF",
      });
      setCargoManifestPreviewOpen(false);
    }
  };

  const handleCargoManifestClosePreview = () => {
    setCargoManifestPreviewOpen(false);
    if (cargoManifestPdfBlob) {
      window.URL.revokeObjectURL(cargoManifestPdfBlob);
    }
    setCargoManifestPdfBlob(null);
  };

  const handleCargoManifestDownloadPDF = () => {
    if (cargoManifestPdfBlob) {
      const link = document.createElement("a");
      link.href = cargoManifestPdfBlob;
      link.download = `CargoManifest-${jobData?.id || "draft"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Proforma PDF preview handlers
  const handleProformaPreview = async (shipmentId: string) => {
    if (!shipmentId) return;
    if (!selectedProformaCurrency) return;
    setProformaPreviewOpen(true);
    setProformaPdfBlob(null);
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${URL.base}job-create/proforma/${shipmentId}/pdf/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ currency: selectedProformaCurrency }),
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const pdfUrl = window.URL.createObjectURL(blob);
      setProformaPdfBlob(pdfUrl);
    } catch (error) {
      console.error("Error fetching proforma PDF:", error);
      ToastNotification({
        type: "error",
        message: "Failed to load proforma PDF",
      });
      setProformaPreviewOpen(false);
    }
  };

  const handleProformaClosePreview = () => {
    setProformaPreviewOpen(false);
    if (proformaPdfBlob) {
      window.URL.revokeObjectURL(proformaPdfBlob);
    }
    setProformaPdfBlob(null);
  };

  const handleProformaDownloadPDF = () => {
    if (proformaPdfBlob) {
      const link = document.createElement("a");
      link.href = proformaPdfBlob;
      link.download = `Proforma.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Helper function to navigate to HouseCreate with container numbers
  const navigateToHouseCreate = useCallback(
    (editIndex?: number, editData?: HousingDetail) => {
      // Validate MBL mandatory fields before navigating
      const missingFields: string[] = [];

      if (!mblDetailsForm.values.service?.trim()) {
        missingFields.push("Service");
      }
      if (
        !mblDetailsForm.values.is_direct &&
        !mblDetailsForm.values.origin_agent?.trim()
      ) {
        missingFields.push("Destination Agent");
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

      navigate("/SeaExport/export-job/house-create", {
        state: {
          fromHouseCreate: true,
          housingDetails: housingDetails,
          ...(editIndex !== undefined && { editIndex }),
          ...(editData && { editData }),
          ...(jobData && { job: jobData }),
          mblDetails: {
            service: mblDetailsForm.values.service || "",
            is_direct: mblDetailsForm.values.is_direct,
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
      housingDetails,
      jobData,
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
    mblDetailsForm.values.is_direct,
    mblDetailsForm.values.origin_code,
    mblDetailsForm.values.destination_code,
    mblDetailsForm.values.etd,
    mblDetailsForm.values.eta,
    containerDetailsForm.values.containers,
    housingDetails.length,
  ]);

  // Handle form submission
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
    // When "Direct" is Yes, Destination Agent is not required.
    // Clear any stale Yup error from a previous toggle so Update/Create can proceed normally.
    if (mblDetailsForm.values.is_direct === true) {
      mblDetailsForm.clearFieldError("origin_agent");
    }
    const mblValidation = mblDetailsForm.validate();
    const carrierValidation = carrierDetailsForm.validate();

    // Extra safety: if Direct is Yes, ignore origin_agent errors entirely.
    // This ensures we never block inline UI due to stale conditional validation.
    const originAgentError = (
      mblValidation.errors as Record<string, unknown> | undefined
    )?.origin_agent;
    const shouldIgnoreOriginAgent =
      mblDetailsForm.values.is_direct === true && !!originAgentError;

    if (
      (mblValidation.hasErrors && !shouldIgnoreOriginAgent) ||
      carrierValidation.hasErrors
    ) {
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
      setActive(2);
      setIsSubmitting(false);
      return;
    }
    try {
      const payload = {
        service: mblDetailsForm.values.service,
        service_type: "Export", // Export job creation
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
        is_direct: mblDetailsForm.values.is_direct,
        carrier_code: carrierDetailsForm.values.carrier_code,
        vessel_name: carrierDetailsForm.values.vessel_name || null,
        voyage_number: carrierDetailsForm.values.voyage_number || null,
        mbl_number: carrierDetailsForm.values.mbl_number || null,
        mbl_date: carrierDetailsForm.values.mbl_date
          ? dayjs(carrierDetailsForm.values.mbl_date).isValid()
            ? dayjs(carrierDetailsForm.values.mbl_date).format("YYYY-MM-DD")
            : null
          : null,
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

          if (transportType === "SEA" || transportType === "VESSEL") {
            routingPayload.vessel = routing.vessel || null;
            routingPayload.voyage_number = routing.voyage_number || null;
          } else if (transportType === "AIR") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.flight = routing.flight || null;
          } else if (transportType === "ROAD") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.truck_no = routing.truck_no || null;
          } else if (transportType === "RAIL") {
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
          consignee_name: house.consignee_name,
          consignee_address: house.consignee_address || "",
          consignee_email: house.consignee_email || "",
          notify1_customer_name:
            house.notify1_customer_name ?? house.notify_customer1_name ?? "",
          notify1_customer_address:
            house.notify1_customer_address ??
            house.notify_customer1_address ??
            "",
          notify1_customer_email:
            house.notify1_customer_email ?? house.notify_customer1_email ?? "",
          notify2_customer_name: house.notify2_customer_name ?? "",
          notify2_customer_address: house.notify2_customer_address ?? "",
          notify2_customer_email: house.notify2_customer_email ?? "",
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
                (
                  house as {
                    events?: Array<{
                      id?: number;
                      type?: string;
                      date?: string;
                    }>;
                  }
                ).events ?? []
              ).map((e) => ({
                ...(e.id != null && { id: Number(e.id) }),
                type: String(e.type ?? ""),
                date: String(e.date ?? ""),
              }))
            : [],
          cargo_details: (house.cargo_details || []).map((cargo) => ({
            ...(cargo.id && { id: cargo.id }),
            ...(cargo.container_no && { container_no: cargo.container_no }),
            ...(cargo.container_id && { container_id: cargo.container_id }),
            no_of_packages: cargo.no_of_packages,
            gross_weight: cargo.gross_weight,
            volume: cargo.volume,
            chargeable_weight: cargo.chargeable_weight,
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
                charge.no_of_unit != null ? roundToDecimals(charge.no_of_unit) : null,
              roe: charge.roe != null ? roundToDecimals(charge.roe) : null,
              amount_per_unit:
                charge.amount_per_unit != null
                  ? roundToDecimals(charge.amount_per_unit)
                  : null,
              amount: charge.amount != null ? roundToDecimals(charge.amount) : null,
              sell_local_amount:
                charge.sell_local_amount != null
                  ? roundToDecimals(charge.sell_local_amount)
                  : (charge as { local_amount?: unknown }).local_amount != null
                    ? roundToDecimals(
                        (charge as { local_amount?: unknown }).local_amount,
                      )
                    : null,
              unit_cost:
                charge.unit_cost != null
                  ? roundToDecimals(charge.unit_cost)
                  : (charge as { cost_per_unit?: unknown }).cost_per_unit !=
                      null
                    ? roundToDecimals(
                        (charge as { cost_per_unit?: unknown }).cost_per_unit,
                      )
                    : null,
              total_cost:
                charge.total_cost != null ? roundToDecimals(charge.total_cost) : null,
              cost_local_amount:
                charge.cost_local_amount != null
                  ? roundToDecimals(charge.cost_local_amount)
                  : null,
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

      // API call to create or update export job
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
        message: `Export Job ${mode === "edit" ? "updated" : "created"} successfully`,
      });

      // Clear housing details from state when navigating and trigger refetch
      navigate("/SeaExport/export-job", {
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
        <Text size="xl" fw={600} c="#105476">
          {mode === "view"
            ? "View Export Job"
            : mode === "edit"
              ? "Edit Export Job"
              : "Create Export Job"}
        </Text>
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
                    <Fragment key={idx}>
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
                        onClick={() => generateBillOfLadingPDFPreview(housing)}
                      >
                        Draft Bill Of Lading -{" "}
                        {housing.hbl_number || `HBL ${idx + 1}`}
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
                        onClick={() => generateBillOfLadingPDFPreview(housing)}
                      >
                        Bill Of Lading -{" "}
                        {housing.hbl_number || `HBL ${idx + 1}`}
                      </Menu.Item>
                    </Fragment>
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
                      onClick={handleCargoManifestPreview}
                    >
                      Cargo Manifest
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
                      onClick={() => {
                        const allCollectCharges = housingDetails.flatMap(
                          (house) =>
                            (house.charges ?? [])
                              .filter(
                                (c) =>
                                  String(c.pp_cc ?? "").trim() === "Collect",
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

                        navigate("/SeaExport/export-job/invoice", {
                          state: {
                            serviceType: ["FCL", "LCL"],
                            hawbDetails: housingDetailsForInvoice,
                            housingDetails: housingDetailsForInvoice,
                            is_agent: true,
                            fromJobLevel: true,
                            ...(jobData && { job: jobData }),
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
                              jobData?.job_id,
                              service_name: "Ocean Export",
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
        onChange={(v) =>
          v !== null &&
          (isReadOnly || (mode === "edit" && jobData?.id)) &&
          setActive(Number(v))
        }
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
            Routings
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
            Container Details
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
            Estimates
          </Tabs.Tab>
          {mode === "edit" && jobData?.id && (
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
                  label="Destination Agent"
                  required={!mblDetailsForm.values.is_direct}
                  placeholder="Type agent name"
                  apiEndpoint={URL.agent}
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
                        mblDetailsForm.setFieldValue("agent_address", "");
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
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
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
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
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
            <Grid mb="sm">
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

            {/* Direct */}
            <Grid mb="sm">
              <Grid.Col span={3}>
                <Radio.Group
                  label="Direct"
                  value={mblDetailsForm.values.is_direct ? "true" : "false"}
                  onChange={(value) => {
                    const isDirect = value === "true";
                    mblDetailsForm.setFieldValue("is_direct", isDirect);

                    // If switching to "Yes" (Direct=true), Destination Agent becomes optional.
                    // Clear any previously shown Destination Agent error so Update doesn't look blocked.
                    if (isDirect) {
                      mblDetailsForm.clearFieldError("origin_agent");
                      // Also clear values to avoid any stale selected temp values.
                      mblDetailsForm.setFieldValue("origin_agent", "");
                      mblDetailsForm.setFieldValue("agent_name", "");
                      mblDetailsForm.setFieldValue("agent_address", "");
                    }
                  }}
                >
                  <Group mt="xs">
                    <Radio value="true" label="Yes" />
                    <Radio value="false" label="No" />
                  </Group>
                </Radio.Group>
              </Grid.Col>
            </Grid>

            <Divider my="md" />

            {/* Carrier Details Section */}
            <Group justify="space-between" align="center" mb="sm">
              <Text size="lg" fw={600} c="#105476">
                Carrier Details
              </Text>
            </Group>
            <Grid mb="xl">
              <Grid.Col span={2.4}>
                <SearchableSelect
                  label="Carrier"
                  required
                  apiEndpoint={URL.carrier}
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

        {/* Tab 2: Routings */}
        <Tabs.Panel value="1">
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
                        label="From"
                        required
                        apiEndpoint={URL.portMaster}
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
                        label="To"
                        required
                        apiEndpoint={URL.portMaster}
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
                              // Also update flight_voyage_number for backward compatibility
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
                            label="Carrier"
                            required
                            apiEndpoint={URL.carrier}
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
                              // Also update flight_voyage_number for backward compatibility
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
                            label="Carrier"
                            required
                            apiEndpoint={URL.carrier}
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
                              // Also update flight_voyage_number for backward compatibility
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
                              // For Rail, carrier_code can be same as carrier_name or empty
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
                              // Also update flight_voyage_number for backward compatibility
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
        <Tabs.Panel value="2">
          <Box mt="md">
            <Group justify="space-between" align="flex-start" mb="md">
              <Text size="lg" fw={600} c="#105476" mb="md">
                Container Details{" "}
                {containerDetailsForm.values.containers.length > 1 &&
                  `(${containerDetailsForm.values.containers.length})`}
              </Text>
              {!isReadOnly && (
                <Group gap="sm">
                  <Button
                    variant="light"
                    color="#105476"
                    leftSection={<IconPlus size={16} />}
                    onClick={addContainer}
                  >
                    Add Container
                  </Button>
                  <Button
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
                  </Button>
                </Group>
              )}
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
                <Grid.Col span={2.2}>
                  <RequiredLabel label="Container Type" required={false} />
                </Grid.Col>
                <Grid.Col span={2.2}>
                  <RequiredLabel label="Container No" required={false} />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel label="Actual Seal No" required={false} />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel label="Customs Seal No" required={false} />
                </Grid.Col>
                <Grid.Col span={1.7}>
                  <RequiredLabel label="Loading Date" required={false} />
                </Grid.Col>
                <Grid.Col span={1.7}>
                  <RequiredLabel label="Unloading Date" required={false} />
                </Grid.Col>
                <Grid.Col span={0.6}>
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
                  <Grid.Col span={2.2}>
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
                  <Grid.Col span={2.2}>
                    <FormTextInput
                      required
                      placeholder="Container number"
                      maxLength={11}
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.container_no`,
                      )}
                      value={
                        containerDetailsForm.values.containers[index]
                          ?.container_no || ""
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
                        // Validate uniqueness on blur
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
                            // Clear error if no duplicates
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
                  <Grid.Col span={1.8}>
                    <FormTextInput
                      placeholder="Actual seal number"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.actual_seal_no`,
                      )}
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <FormTextInput
                      placeholder="Customs seal number"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.customs_seal_no`,
                      )}
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.7}>
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
                  <Grid.Col span={1.7}>
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
                  <Grid.Col span={0.6}>
                    {containerDetailsForm.values.containers.length > 1 &&
                      !isReadOnly && (
                        <Button
                          variant="light"
                          color="red"
                          onClick={() => removeContainer(index)}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                  </Grid.Col>
                </Grid>
              </Box>
            ))}
          </Box>
        </Tabs.Panel>

        {/* Tab 4: Estimates */}
        <Tabs.Panel value="3">
          <Box mt="md">
            <Group justify="space-between" align="center" mb="md" wrap="nowrap">
              <Text size="lg" fw={600} c="#105476">
                Estimates
              </Text>
              <Button
                variant="light"
                color="#105476"
                size="sm"
                leftSection={<IconFileInvoice size={16} />}
                styles={{
                  root: {
                    fontFamily: "Inter",
                    fontSize: "13px",
                    fontWeight: 500,
                  },
                }}
                onClick={() => {
                  const estimates = estimatesForm.values.estimates ?? [];
                  const chargesFromEstimates = estimates
                    .filter(
                      (e) =>
                        e.charge_id != null ||
                        (e.charge_name && e.charge_name.trim() !== ""),
                    )
                    .map((e) => ({
                      charge_id: e.charge_id,
                      charge_name: e.charge_name ?? "",
                      segment: "",
                      job_no: String(jobData?.job_id ?? jobData?.id ?? ""),
                      sub_job: "",
                      cn_r: "",
                      currency: e.currency_code ?? "",
                      currency_id: e.currency_id ?? "",
                      roe: e.roe,
                      unit_code: e.unit_code ?? "",
                      unit_id: e.unit_id ?? "",
                      no_of_unit: e.no_of_unit,
                      amount_per_unit: e.cost_per_unit,
                      amount: e.total_cost,
                      amount_in_local:
                        e.total_cost != null && e.roe != null
                          ? Math.round(e.total_cost * e.roe * 100) / 100
                          : e.total_cost,
                      tax_code: "",
                      tax: "false",
                    }));
                  navigate("/payment-request/create", {
                    state: {
                      serviceType: ["FCL", "LCL"],
                      chargesFromEstimates:
                        chargesFromEstimates.length > 0
                          ? chargesFromEstimates
                          : undefined,
                      job_reference_1:
                        jobData?.job_id != null
                          ? String(jobData.job_id)
                          : jobData?.id != null
                            ? String(jobData.id)
                            : "",
                      ...(jobData && { job: jobData }),
                    },
                  });
                }}
              >
                Create PRQ
              </Button>
            </Group>
            <EstimatesSection
              serviceType={["FCL", "LCL"]}
              form={estimatesForm}
              readOnly={isReadOnly}
            />
          </Box>
        </Tabs.Panel>

        {mode === "edit" && jobData?.id && (
          <Tabs.Panel value="4">
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
                      th: {
                        padding: "8px",
                      },
                      td: {
                        padding: "8px",
                      },
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
                                            `/SeaExport/export-job/invoice/view/${invoiceViewId}`,
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
                                              `/SeaExport/export-job/invoice/edit/${row.invoice_id}`,
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
                                              "/SeaExport/export-job/invoice/reverse",
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
                                                              `/SeaExport/export-job/invoice/view/${targetId}`,
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
            onClick={() => navigate("/SeaExport/export-job")}
          >
            Back to List
          </Button>
          {(active === 1 ||
            active === 2 ||
            active === 3 ||
            (active === 4 && mode === "edit" && jobData?.id)) &&
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
          {!isReadOnly && active === 2 && (
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
                    {/* <Badge color="blue" variant="light">
                      {house.trade}
                    </Badge> */}
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
                      {/* House-level Bill of Lading actions - only in edit mode */}
                      {mode === "edit" && jobData?.id && (
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
                                generateBillOfLadingPDFPreview(house)
                              }
                            >
                              Draft Bill Of Lading
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
                              onClick={() =>
                                generateBillOfLadingPDFPreview(house)
                              }
                            >
                              Bill Of Lading
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
                                setPendingProformaShipmentId(
                                  String(house.id ?? ""),
                                );
                                setSelectedProformaCurrency("");
                                setProformaCurrencyModalOpen(true);
                              }}
                            >
                              Proforma
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )}
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
                      {house.notify1_customer_name ?? house.notify_customer1_name ?? "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm">{house.notify1_customer_email ?? house.notify_customer1_email ?? "-"}</Text>
                  </Grid.Col> */}
                </Grid>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Proforma Currency Modal */}
      <Modal
        opened={proformaCurrencyModalOpen}
        onClose={() => {
          setProformaCurrencyModalOpen(false);
          setSelectedProformaCurrency("");
          setPendingProformaShipmentId(null);
        }}
        title="Currency"
        centered
        size="sm"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
      >
        <Stack gap="md">
          <Dropdown
            label="Currency"
            placeholder="Select Currency"
            searchable
            clearable
            dropdownZIndex={1000}
            data={[
              { value: "INR", label: "INR" },
              { value: "USD", label: "USD" },
            ]}
            value={selectedProformaCurrency || null}
            onChange={(value) => setSelectedProformaCurrency(value || "")}
          />
          <Group justify="flex-end">
            <Button
              color="#105476"
              disabled={!selectedProformaCurrency}
              onClick={() => {
                if (!pendingProformaShipmentId) return;
                setProformaCurrencyModalOpen(false);
                handleProformaPreview(pendingProformaShipmentId);
              }}
            >
              Get
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Proforma PDF Preview Modal */}
      <Modal
        opened={proformaPreviewOpen}
        onClose={handleProformaClosePreview}
        title="Proforma"
        centered
        size="95%"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            minHeight: "90vh",
            maxWidth: "1200px",
          },
          body: {
            padding: 0,
            height: "100%",
          },
        }}
      >
        <Stack h="82vh">
          {proformaPdfBlob ? (
            <>
              <iframe
                src={proformaPdfBlob}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="Proforma Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleProformaClosePreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleProformaDownloadPDF}
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

      {/* Cargo Manifest PDF Preview Modal */}
      <Modal
        opened={cargoManifestPreviewOpen}
        onClose={handleCargoManifestClosePreview}
        title="Cargo Manifest"
        centered
        size="95%"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            minHeight: "90vh",
            maxWidth: "1200px",
          },
          body: {
            padding: 0,
            height: "100%",
          },
        }}
      >
        <Stack h="82vh">
          {cargoManifestPdfBlob ? (
            <>
              <iframe
                src={cargoManifestPdfBlob}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="Cargo Manifest Preview"
              />
              <Group
                justify="flex-end"
                p="md"
                style={{ borderTop: "1px solid #e9ecef" }}
              >
                <Button
                  variant="outline"
                  onClick={handleCargoManifestClosePreview}
                  leftSection={<IconX size={16} />}
                >
                  Close
                </Button>
                <Button
                  onClick={handleCargoManifestDownloadPDF}
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

      {/* Bill Of Lading PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title={`Bill Of Lading - ${currentHousingForPreview?.hbl_number || "HBL"}`}
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
                title="Bill Of Lading PDF Preview"
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
                <Text c="dimmed">Generating Bill Of Lading PDF preview...</Text>
              </Stack>
            </Center>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}

export default ExportJobCreate;
