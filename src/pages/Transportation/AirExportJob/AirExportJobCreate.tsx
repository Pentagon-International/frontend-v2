import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Tabs,
  Table,
  Text,
  TextInput,
  Divider,
  Card,
  Badge,
  ActionIcon,
  Menu,
  ScrollArea,
  Center,
  Loader,
  Modal,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconTrash,
  IconDotsVertical,
  IconFileInvoice,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconRefresh,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  Fragment,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  SingleDateInput,
  DateTimeInput,
  EstimatesSection,
  useEstimatesForm,
} from "../../../components";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { toTitleCase } from "../../../utils/textFormatter";
import FormTextInput from "../../../components/FormTextInput";

// Type definitions
type MAWBDetailsForm = {
  service: string;
  agent_code: string; // Stores agent_code (code) for API payload
  agent_name: string; // Stores agent_name (name) for display
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
};

type CarrierDetailsForm = {
  schedule_id: string;
  carrier_code: string;
  carrier_name: string;
  flight_number: string;
  mawb_number: string;
  mawb_date: Date | null;
};

type RoutingDetail = {
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
  flight: string;
  voyage_number: string;
  truck_no: string;
  rail_no: string;
};

// ContainerDetail removed for Air Export Jobs

type HAWBDetail = {
  id: number;
  shipment_id: string;
  hawb_number: string;
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
  shipper_code: string;
  shipper_name: string;
  shipper_address: string;
  shipper_email: string;
  consignee_code: string;
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  notify_customer1_name: string;
  notify_customer1_address: string;
  notify_customer1_email: string;
  commodity_description?: string;
  marks_no?: string;
  cargo_details?: Array<{
    no_of_packages: number | null;
    gross_weight: number | null;
    volume: number | null;
    chargeable_weight: number | null;
    haz: string;
  }>;
  charges?: Array<{
    id?: number;
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
  }>;
  mawb_charges?: Array<Record<string, unknown>>;
};

// Invoice-related types for Accounts tab
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
const mawbDetailsSchema = yup.object({
  service: yup.string().required("Service is required"),
  agent_code: yup.string().required("Destination Agent is required"),
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
  flight_number: yup.string().required("Flight Number is required"),
  mawb_number: yup
    .string()
    .required("MAWB Number is required")
    .matches(/^[A-Za-z0-9]{11}$/, "MAWB Number must be exactly 11 characters"),
  mawb_date: yup.date().nullable(),
});

// Container schemas removed for Air Export Jobs

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

// Helper function to get transport_mode based on transport_type
const getTransportMode = (
  transportType: string | null | undefined,
): string | undefined => {
  if (!transportType) return undefined;
  const type = transportType.trim();
  if (type === "AIR") return "AIR";
  if (type === "SEA" || type === "FCL" || type === "LCL") return "SEA";
  if (type === "ROAD") return "LAND";
  return undefined;
};

function AirExportJobCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingJobById, setIsFetchingJobById] = useState(false);
  const [hawbDetails, setHawbDetails] = useState<HAWBDetail[]>(
    location.state?.hawbDetails && Array.isArray(location.state.hawbDetails)
      ? location.state.hawbDetails
      : location.state?.housingDetails &&
          Array.isArray(location.state.housingDetails)
        ? location.state.housingDetails
        : [],
  );

  // Track if forms have been initialized from jobData (one-time initialization)
  const formsInitializedFromJobDataRef = useRef(false);
  // Track initialization key to force re-render of SearchableSelect components when form values are set
  const [formInitializedKey, setFormInitializedKey] = useState(0);
  // Track if form state has been restored from location.state (prevents overwriting user changes)
  const formStateRestoredRef = useRef(false);
  // Track if HAWB details have been loaded from jobData to prevent overwriting
  const hawbDetailsLoadedRef = useRef(false);
  // Track if routing state has been initialized from location.state
  const routingStateInitializedRef = useRef(false);
  // Store origin agent data to persist across navigations
  const originAgentDataRef = useRef<Record<string, unknown> | null>(
    location.state?.mawbDetails?.agent_data || null,
  );
  // Ref to track if navigation is in progress to prevent multiple navigations
  const navigationInProgressRef = useRef(false);
  // Track the last restored mawbDetails to prevent duplicate restorations
  const lastRestoredMawbDetailsRef = useRef<string | null>(null);

  // Accounts tab state
  const [invoiceList, setInvoiceList] = useState<InvoiceListItem[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(false);
  const [expandedInvoiceRowId, setExpandedInvoiceRowId] = useState<
    string | null
  >(null);

  // Cargo manifest PDF preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);

  // Proforma PDF preview state
  const [proformaPreviewOpen, setProformaPreviewOpen] = useState(false);
  const [proformaPdfBlob, setProformaPdfBlob] = useState<string | null>(null);

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
          navigate("/air/export-job/edit", {
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

  // MAWB Details Form - Initialize with jobData if available, or from location.state for create mode
  const mawbDetailsForm = useForm<MAWBDetailsForm>({
    initialValues: {
      service:
        jobData?.service || location.state?.mawbDetails?.service || "AIR", // Auto-selected for Air
      agent_code:
        jobData?.agent_code ||
        jobData?.origin_agent ||
        location.state?.mawbDetails?.agent_code ||
        "",
      agent_name:
        jobData?.agent_name || location.state?.mawbDetails?.agent_name || "",
      origin_code:
        jobData?.origin_code || location.state?.mawbDetails?.origin_code || "",
      origin_name:
        jobData?.origin_name || location.state?.mawbDetails?.origin_name || "",
      destination_code:
        jobData?.destination_code ||
        location.state?.mawbDetails?.destination_code ||
        "",
      destination_name:
        jobData?.destination_name ||
        location.state?.mawbDetails?.destination_name ||
        "",
      etd:
        jobData?.etd && dayjs.utc(jobData.etd).isValid()
          ? dayjs.utc(jobData.etd).local().toDate()
          : location.state?.mawbDetails?.etd || null,
      eta:
        jobData?.eta && dayjs.utc(jobData.eta).isValid()
          ? dayjs.utc(jobData.eta).local().toDate()
          : location.state?.mawbDetails?.eta || null,
      atd:
        jobData?.atd && dayjs.utc(jobData.atd).isValid()
          ? dayjs.utc(jobData.atd).local().toDate()
          : location.state?.mawbDetails?.atd || null,
      ata:
        jobData?.ata && dayjs.utc(jobData.ata).isValid()
          ? dayjs.utc(jobData.ata).local().toDate()
          : location.state?.mawbDetails?.ata || null,
    },
    validate: yupResolver(mawbDetailsSchema),
  });

  // Auto-set service to "Air" on mount
  // useEffect(() => {
  //   mawbDetailsForm.setFieldValue("service", "Air");
  // }, []);

  // Carrier Details Form - Initialize with jobData if available, or from location.state for create mode
  const carrierDetailsForm = useForm<CarrierDetailsForm>({
    initialValues: {
      schedule_id:
        jobData?.schedule_id ||
        location.state?.carrierDetails?.schedule_id ||
        "",
      carrier_code:
        jobData?.carrier_code ||
        location.state?.carrierDetails?.carrier_code ||
        "",
      carrier_name:
        jobData?.carrier_name ||
        location.state?.carrierDetails?.carrier_name ||
        "",
      flight_number:
        jobData?.flight_number ||
        jobData?.voyage_number ||
        jobData?.flightno ||
        location.state?.carrierDetails?.flight_number ||
        "",
      mawb_number:
        jobData?.mawb_no ||
        jobData?.mawb_number ||
        location.state?.carrierDetails?.mawb_number ||
        "",
      mawb_date:
        (jobData?.mawb_date || jobData?.mbl_date) &&
        dayjs(jobData.mawb_date || jobData.mbl_date).isValid()
          ? dayjs(jobData.mawb_date || jobData.mbl_date).toDate()
          : location.state?.carrierDetails?.mawb_date || null,
    },
    validate: yupResolver(carrierDetailsSchema),
  });

  // Routings Form - Using useForm like charges in QuotationCreate
  // Initialize with location.state.routings if available (for create mode restoration)
  const routingsForm = useForm<{ routings: RoutingDetail[] }>({
    initialValues: {
      routings:
        location.state?.routings && Array.isArray(location.state.routings)
          ? location.state.routings
          : [
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
                voyage_number: "",
                truck_no: "",
                rail_no: "",
              },
            ],
    },
  });

  const estimatesForm = useEstimatesForm(
    location.state?.estimates && Array.isArray(location.state.estimates)
      ? { estimates: location.state.estimates }
      : undefined,
  );

  // Cache the last mapped estimates from jobData (edit/view) and auto-heal if something overwrites them.
  const lastJobMappedEstimatesRef = useRef<
    (typeof estimatesForm.values.estimates) | null
  >(null);
  const lastAutoHealAtRef = useRef<number>(0);

  // If something overwrites estimates (e.g. a restore effect), re-apply the job-mapped estimates
  // so dropdown fields don't go blank in edit/view mode.
  useEffect(() => {
    if (!jobData) return;
    if (mode !== "edit" && mode !== "view") return;
    const expected = lastJobMappedEstimatesRef.current;
    if (!expected || expected.length === 0) return;

    const current = estimatesForm.values.estimates ?? [];
    if (current.length !== expected.length) return;

    const hasBlankDropdownRow = current.some((row, idx) => {
      const exp = expected[idx];
      const expHas =
        !!exp?.supplier_code ||
        !!exp?.supplier_name ||
        exp?.charge_id != null ||
        !!exp?.charge_name ||
        !!exp?.pp_cc ||
        !!exp?.unit_id ||
        !!exp?.currency_id;
      if (!expHas) return false;

      return (
        !row.supplier_code ||
        !row.supplier_name ||
        row.charge_id == null ||
        !row.charge_name ||
        !row.pp_cc ||
        !row.unit_id ||
        !row.currency_id
      );
    });

    if (!hasBlankDropdownRow) return;

    const now = Date.now();
    if (now - lastAutoHealAtRef.current < 500) return;
    lastAutoHealAtRef.current = now;

    console.log(
      "🧾 [AIR_EXPORT_JOB] Detected estimates overwrite. Re-applying job-mapped estimates.",
      { current, expected },
    );

    estimatesForm.setFieldValue(
      "estimates",
      expected as unknown as typeof estimatesForm.values.estimates,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatesForm.values.estimates, jobData, mode]);

  // Note: Container Details are not used for Air Export Jobs

  // Load job data if in edit or view mode - Only initialize once from jobData
  // This effect runs FIRST to ensure forms are initialized before restoration logic
  useEffect(() => {
    // Skip if forms have already been initialized
    if (formsInitializedFromJobDataRef.current) {
      return;
    }

    // Only proceed if we have jobData and are in edit/view mode
    if (jobData && (mode === "edit" || mode === "view")) {
      try {
        console.log("🔧 [EDIT MODE] Initializing forms from jobData:", {
          jobData,
          hasOriginAgent: !!jobData.agent_name || !!jobData.agent_code,
          originCode: jobData.origin_code,
          originName: jobData.origin_name,
          destinationCode: jobData.destination_code,
          destinationName: jobData.destination_name,
          carrierCode: jobData.carrier_code,
          carrierName: jobData.carrier_name,
        });

        // Populate MAWB Details using setValues - ensure all fields are set
        const mawbInitialValues = {
          service: jobData.service || "AIR",
          // Use agent_code and agent_name from API response, fallback to old fields for backward compatibility
          agent_code: jobData.agent_code || jobData.origin_agent || "",
          agent_name: jobData.agent_name || jobData.origin_agent_name || "",
          origin_code: jobData.origin_code || "",
          origin_name: jobData.origin_name || "",
          destination_code: jobData.destination_code || "",
          destination_name: jobData.destination_name || "",
          etd:
            jobData.etd && dayjs.utc(jobData.etd).isValid()
              ? dayjs.utc(jobData.etd).local().toDate()
              : null,
          eta:
            jobData.eta && dayjs.utc(jobData.eta).isValid()
              ? dayjs.utc(jobData.eta).local().toDate()
              : null,
          atd:
            jobData.atd && dayjs.utc(jobData.atd).isValid()
              ? dayjs.utc(jobData.atd).local().toDate()
              : null,
          ata:
            jobData.ata && dayjs.utc(jobData.ata).isValid()
              ? dayjs.utc(jobData.ata).local().toDate()
              : null,
        };

        console.log("🔧 Setting MAWB form values:", mawbInitialValues);
        // Use setValues to update all fields at once
        mawbDetailsForm.setValues(mawbInitialValues);

        console.log(
          "✅ MAWB Details initialized - Form values after setValues:",
          {
            agent_code: mawbDetailsForm.values.agent_code,
            origin_code: mawbDetailsForm.values.origin_code,
            origin_name: mawbDetailsForm.values.origin_name,
            destination_code: mawbDetailsForm.values.destination_code,
            destination_name: mawbDetailsForm.values.destination_name,
            allFormValues: mawbDetailsForm.values,
          },
        );

        // Populate Carrier Details using setValues
        const carrierInitialValues = {
          schedule_id: jobData.schedule_id || "",
          carrier_code: jobData.carrier_code || "",
          carrier_name: jobData.carrier_name || "",
          flight_name: jobData.vessel_name || jobData.flight_name || "",
          flight_number:
            jobData.flight_number ||
            jobData.voyage_number ||
            jobData.flightno ||
            "",
          mawb_number: jobData.mawb_no || jobData.mawb_number || "",
          mawb_date:
            (jobData.mawb_date || jobData.mbl_date) &&
            dayjs(jobData.mawb_date || jobData.mbl_date).isValid()
              ? dayjs(jobData.mawb_date || jobData.mbl_date).toDate()
              : null,
        };

        console.log("🔧 Setting Carrier form values:", carrierInitialValues);
        // Use setValues to update all fields at once
        carrierDetailsForm.setValues(carrierInitialValues);

        console.log(
          "✅ Carrier Details initialized - Form values after setValues:",
          {
            carrier_code: carrierDetailsForm.values.carrier_code,
            carrier_name: carrierDetailsForm.values.carrier_name,
            allFormValues: carrierDetailsForm.values,
          },
        );

        // Populate Housing Details from jobData if exists
        // Only load from jobData if location.state doesn't have hawbDetails with actual data
        // (meaning we're on initial edit load, not coming back from HAWBCreate)
        const hasHawbDetailsInState =
          location.state?.hawbDetails &&
          Array.isArray(location.state.hawbDetails) &&
          location.state.hawbDetails.length > 0;

        // Support both hawb_details and housing_details for backward compatibility
        const housingDetailsData =
          jobData.housing_details ||
          jobData.hawb_details ||
          ([] as Record<string, unknown>[]);

        if (
          housingDetailsData &&
          Array.isArray(housingDetailsData) &&
          housingDetailsData.length > 0 &&
          !hasHawbDetailsInState
        ) {
          const mappedHawbDetails = housingDetailsData.map(
            (house: Record<string, unknown>) => ({
              id: house.id ? Number(house.id) : 0,
              shipment_id: house.shipment_id ? String(house.shipment_id) : "",
              hawb_number:
                house.hawb_number || house.hawb_no || house.hbl_number
                  ? String(
                      house.hawb_number || house.hawb_no || house.hbl_number,
                    )
                  : "",
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
              shipper_code: house.shipper_code
                ? String(house.shipper_code)
                : "",
              shipper_name: house.shipper_name
                ? String(house.shipper_name)
                : "",
              shipper_address: house.shipper_address
                ? String(house.shipper_address)
                : "",
              shipper_email: house.shipper_email
                ? String(house.shipper_email)
                : "",
              consignee_code: house.consignee_code
                ? String(house.consignee_code)
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
              notify_customer1_name: house.notify_customer1_name
                ? String(house.notify_customer1_name)
                : "",
              notify_customer1_address: house.notify_customer1_address
                ? String(house.notify_customer1_address)
                : "",
              notify_customer1_email: house.notify_customer1_email
                ? String(house.notify_customer1_email)
                : "",
              commodity_description: house.commodity_description
                ? String(house.commodity_description)
                : "",
              marks_no: house.marks_no ? String(house.marks_no) : "",
              cargo_details:
                house.cargo_details && Array.isArray(house.cargo_details)
                  ? house.cargo_details.map(
                      (cargo: Record<string, unknown>) => ({
                        no_of_packages: cargo.no_of_packages as number | null,
                        gross_weight: cargo.gross_weight as number | null,
                        volume: cargo.volume as number | null,
                        chargeable_weight: cargo.chargeable_weight as
                          | number
                          | null,
                        haz: cargo.haz ? String(cargo.haz) : "",
                      }),
                    )
                  : [],
              charges: (() => {
                const chargesArray = (house.charges || house.mawb_charges) as
                  | Record<string, unknown>[]
                  | undefined;
                if (chargesArray && Array.isArray(chargesArray)) {
                  return chargesArray.map((charge: Record<string, unknown>) => {
                    const unitDetails = charge.unit_details as
                      | { unit_code?: string; unit_id?: number }
                      | undefined;
                    const currencyDetails = charge.currency_details as
                      | { currency_code?: string; currency_id?: number }
                      | undefined;
                    const unitCode = String(
                      charge.unit_code ??
                        charge.unit_input ??
                        unitDetails?.unit_code ??
                        "",
                    ).trim();
                    const currency = String(
                      charge.currency ?? currencyDetails?.currency_code ?? "",
                    ).trim();
                    const chargeId =
                      charge.charge_id != null
                        ? Number(charge.charge_id)
                        : charge.id != null
                          ? Number(charge.id)
                          : null;
                    const unitId =
                      charge.unit_id != null
                        ? String(charge.unit_id)
                        : charge.unit != null
                          ? String(charge.unit)
                          : unitDetails?.unit_id != null
                            ? String(unitDetails.unit_id)
                            : "";
                    const currencyId =
                      charge.currency_id != null
                        ? String(charge.currency_id)
                        : charge.currency != null
                          ? String(charge.currency)
                          : currencyDetails?.currency_id != null
                            ? String(currencyDetails.currency_id)
                            : "";
                    return {
                      id: charge.id != null ? Number(charge.id) : undefined,
                      charge_id: chargeId,
                      charge_name: charge.charge_name
                        ? String(charge.charge_name)
                        : "",
                      pp_cc: charge.pp_cc ? String(charge.pp_cc) : "",
                      unit_id: unitId,
                      unit_code: unitCode,
                      currency_id: currencyId,
                      currency,
                      no_of_unit: charge.no_of_unit as number | null,
                      roe: charge.roe as number | null,
                      amount_per_unit: charge.amount_per_unit as number | null,
                      amount: charge.amount as number | null,
                    };
                  });
                }
                return [];
              })(),
            }),
          );
          setHawbDetails(mappedHawbDetails);
          hawbDetailsLoadedRef.current = true;
        }

        // Populate Routings if exists
        if (
          jobData.ocean_routings &&
          Array.isArray(jobData.ocean_routings) &&
          jobData.ocean_routings.length > 0
        ) {
          const mappedRoutings = jobData.ocean_routings.map(
            (routing: Record<string, unknown>) => {
              return {
                transport_type: routing.transport_type || "",
                from_code: routing.from_port_code || routing.from_code || "",
                from_name: routing.from_port_name || routing.from_name || "",
                to_code: routing.to_port_code || routing.to_code || "",
                to_name: routing.to_port_name || routing.to_name || "",
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
                carrier_code: routing.carrier_code || "",
                carrier_name: routing.carrier_name || "",
                vessel: routing.vessel || "",
                flight: routing.flight ? String(routing.flight) : "",
                voyage_number: routing.voyage_number
                  ? String(routing.voyage_number)
                  : "",
                truck_no: routing.truck_no ? String(routing.truck_no) : "",
                rail_no: routing.rail_no ? String(routing.rail_no) : "",
              };
            },
          );
          routingsForm.setValues({ routings: mappedRoutings });
          routingStateInitializedRef.current = true;
        } else if (
          jobData.routings &&
          Array.isArray(jobData.routings) &&
          jobData.routings.length > 0
        ) {
          const mappedRoutings = jobData.routings.map(
            (routing: Record<string, unknown>) => {
              return {
                transport_type: routing.transport_type || "",
                from_code: routing.from_port_code || routing.from_code || "",
                from_name: routing.from_port_name || routing.from_name || "",
                to_code: routing.to_port_code || routing.to_code || "",
                to_name: routing.to_port_name || routing.to_name || "",
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
                carrier_code: routing.carrier_code || "",
                carrier_name: routing.carrier_name || "",
                vessel: routing.vessel || "",
                flight: routing.flight ? String(routing.flight) : "",
                voyage_number: routing.voyage_number
                  ? String(routing.voyage_number)
                  : "",
                truck_no: routing.truck_no ? String(routing.truck_no) : "",
                rail_no: routing.rail_no ? String(routing.rail_no) : "",
              };
            },
          );
          routingsForm.setValues({ routings: mappedRoutings });
          routingStateInitializedRef.current = true;
        }

        // Note: Container Details are not used for Air Export Jobs

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
          console.log("🧾 [AIR_EXPORT_JOB] mappedEstimates (before setValues)", {
            mappedEstimates,
          });

          // Hard replace estimates list (avoid partial merges on array items)
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

          console.log("🧾 [AIR_EXPORT_JOB] estimatesForm.setFieldValue applied", {
            sanitizedEstimates,
          });

          // Keep a copy so we can detect later overwrites/resets.
          lastJobMappedEstimatesRef.current =
            sanitizedEstimates as unknown as typeof estimatesForm.values.estimates;
        }
        formsInitializedFromJobDataRef.current = true;

        // Force re-render of SearchableSelect components after all values are set
        // Use a small delay to ensure setValues has completed
        setTimeout(() => {
          setFormInitializedKey((prev) => prev + 1);
        }, 50);
      } catch (error) {
        console.error("Error loading job data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to load job data. Please try again.",
        });
      }
    } else {
      // Reset the ref when not in edit/view mode or jobData changes
      hawbDetailsLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobData, mode]);

  // Force re-initialization if jobData becomes available after initial render
  useEffect(() => {
    if (
      jobData &&
      (mode === "edit" || mode === "view") &&
      !formsInitializedFromJobDataRef.current
    ) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        if (!formsInitializedFromJobDataRef.current && jobData) {
          console.log("🔄 Re-initializing forms after delay:", jobData);
          // Trigger initialization again
          formsInitializedFromJobDataRef.current = false;
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [jobData, mode]);

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
      voyage_number: "",
      truck_no: "",
      rail_no: "",
    });
  };

  // Remove routing - Using removeListItem like charges form
  const removeRouting = (index: number) => {
    if (routingsForm.values.routings.length > 1) {
      routingsForm.removeListItem("routings", index);
    }
  };

  // Validate step 1
  const validateStep1 = () => {
    const mawbValid = mawbDetailsForm.validate().hasErrors === false;
    const carrierValid = carrierDetailsForm.validate().hasErrors === false;
    return mawbValid && carrierValid;
  };

  // Validate step 2 - Conditional validation for routings
  // If any mandatory routing field has value, all required routing fields must be filled
  // If all routing fields are empty, allow proceeding without validation (skip entirely)
  const validateStep2 = () => {
    for (const routing of routingsForm.values.routings) {
      // Check if any mandatory routing field has a non-empty value
      const transportType = routing.transport_type?.trim() || "";
      const fromCode = routing.from_code?.trim() || "";
      const toCode = routing.to_code?.trim() || "";
      const carrierCode = routing.carrier_code?.trim() || "";
      const vessel = routing.vessel?.trim() || "";
      const flight = routing.flight?.trim() || "";
      const voyageNumber = routing.voyage_number?.trim() || "";
      const truckNo = routing.truck_no?.trim() || "";
      const railNo = routing.rail_no?.trim() || "";

      const hasAnyMandatoryValue =
        transportType !== "" ||
        fromCode !== "" ||
        toCode !== "" ||
        routing.etd !== null ||
        routing.eta !== null ||
        carrierCode !== "" ||
        vessel !== "" ||
        flight !== "" ||
        voyageNumber !== "" ||
        truckNo !== "" ||
        railNo !== "";

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

        // Validate transport-type-specific required fields
        if (routing.transport_type === "SEA") {
          if (vessel === "" || voyageNumber === "") {
            ToastNotification({
              type: "error",
              message:
                "Vessel Name and Voyage Number are required for Sea transport",
            });
            return false;
          }
        } else if (routing.transport_type === "AIR") {
          if (carrierCode === "" || flight === "") {
            ToastNotification({
              type: "error",
              message: "Carrier and Flight No are required for Air transport",
            });
            return false;
          }
        } else if (routing.transport_type === "ROAD") {
          if (carrierCode === "" || truckNo === "") {
            ToastNotification({
              type: "error",
              message: "Carrier and Truck No are required for Road transport",
            });
            return false;
          }
        } else if (routing.transport_type === "RAIL") {
          const carrierName = routing.carrier_name?.trim() || "";
          if (carrierName === "" || railNo === "") {
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

  // Handle next step
  const handleNext = () => {
    if (active === 0) {
      if (validateStep1()) {
        // Save ALL current form values before moving to step 2
        navigate(location.pathname, {
          replace: true,
          state: {
            ...location.state,
            // Save current MAWB form values
            mawbDetails: {
              service: mawbDetailsForm.values.service || "AIR",
              agent_code: mawbDetailsForm.values.agent_code || "",
              agent_name: mawbDetailsForm.values.agent_name || "",
              origin_code: mawbDetailsForm.values.origin_code || "",
              origin_name: mawbDetailsForm.values.origin_name || "",
              destination_code: mawbDetailsForm.values.destination_code || "",
              destination_name: mawbDetailsForm.values.destination_name || "",
              etd: mawbDetailsForm.values.etd || null,
              eta: mawbDetailsForm.values.eta || null,
              atd: mawbDetailsForm.values.atd || null,
              ata: mawbDetailsForm.values.ata || null,
              agent_data: originAgentDataRef.current || null,
            },
            // Save current Carrier form values
            carrierDetails: carrierDetailsForm.values,
            // Save current Routings form values
            routings: routingsForm.values.routings,
            // Save current Estimates form values
            estimates: estimatesForm.values.estimates,
            // Preserve all other state
            ...(location.state?.hawbDetails && {
              hawbDetails: location.state.hawbDetails,
            }),
            ...(location.state?.housingDetails && {
              housingDetails: location.state.housingDetails,
            }),
            ...(location.state?.job && { job: location.state.job }),
          },
        });
        setActive(1);
      }
    } else if (active === 1) {
      if (validateStep2()) {
        // Save ALL current form values before moving to Estimates
        navigate(location.pathname, {
          replace: true,
          state: {
            ...location.state,
            // Save current MAWB form values
            mawbDetails: {
              service: mawbDetailsForm.values.service || "AIR",
              agent_code: mawbDetailsForm.values.agent_code || "",
              agent_name: mawbDetailsForm.values.agent_name || "",
              origin_code: mawbDetailsForm.values.origin_code || "",
              origin_name: mawbDetailsForm.values.origin_name || "",
              destination_code: mawbDetailsForm.values.destination_code || "",
              destination_name: mawbDetailsForm.values.destination_name || "",
              etd: mawbDetailsForm.values.etd || null,
              eta: mawbDetailsForm.values.eta || null,
              atd: mawbDetailsForm.values.atd || null,
              ata: mawbDetailsForm.values.ata || null,
              agent_data: originAgentDataRef.current || null,
            },
            // Save current Carrier form values
            carrierDetails: carrierDetailsForm.values,
            // Save current Routings form values
            routings: routingsForm.values.routings,
            // Save current Estimates form values
            estimates: estimatesForm.values.estimates,
            // Preserve all other state
            ...(location.state?.hawbDetails && {
              hawbDetails: location.state.hawbDetails,
            }),
            ...(location.state?.housingDetails && {
              housingDetails: location.state.housingDetails,
            }),
            ...(location.state?.job && { job: location.state.job }),
          },
        });
        setActive(2);
      }
    } else if (active === 2) {
      navigate(location.pathname, {
        replace: true,
        state: {
          ...location.state,
          mawbDetails: {
            service: mawbDetailsForm.values.service || "AIR",
            agent_code: mawbDetailsForm.values.agent_code || "",
            agent_name: mawbDetailsForm.values.agent_name || "",
            origin_code: mawbDetailsForm.values.origin_code || "",
            origin_name: mawbDetailsForm.values.origin_name || "",
            destination_code: mawbDetailsForm.values.destination_code || "",
            destination_name: mawbDetailsForm.values.destination_name || "",
            etd: mawbDetailsForm.values.etd || null,
            eta: mawbDetailsForm.values.eta || null,
            atd: mawbDetailsForm.values.atd || null,
            ata: mawbDetailsForm.values.ata || null,
            agent_data: originAgentDataRef.current || null,
          },
          carrierDetails: carrierDetailsForm.values,
          routings: routingsForm.values.routings,
          estimates: estimatesForm.values.estimates,
          ...(location.state?.hawbDetails && {
            hawbDetails: location.state.hawbDetails,
          }),
          ...(location.state?.housingDetails && {
            housingDetails: location.state.housingDetails,
          }),
          ...(location.state?.job && { job: location.state.job }),
        },
      });
      handleSubmit();
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (active > 0) {
      // Save ALL current form values before going back
      navigate(location.pathname, {
        replace: true,
        state: {
          ...location.state,
          // Save current MAWB form values
          mawbDetails: {
            service: mawbDetailsForm.values.service || "AIR",
            agent_code: mawbDetailsForm.values.agent_code || "",
            agent_name: mawbDetailsForm.values.agent_name || "",
            origin_code: mawbDetailsForm.values.origin_code || "",
            origin_name: mawbDetailsForm.values.origin_name || "",
            destination_code: mawbDetailsForm.values.destination_code || "",
            destination_name: mawbDetailsForm.values.destination_name || "",
            etd: mawbDetailsForm.values.etd || null,
            eta: mawbDetailsForm.values.eta || null,
            atd: mawbDetailsForm.values.atd || null,
            ata: mawbDetailsForm.values.ata || null,
            agent_data: originAgentDataRef.current || null,
          },
          // Save current Carrier form values
          carrierDetails: carrierDetailsForm.values,
          // Save current Routings form values
          routings: routingsForm.values.routings,
          // Save current Estimates form values
          estimates: estimatesForm.values.estimates,
          // Preserve all other state
          ...(location.state?.hawbDetails && {
            hawbDetails: location.state.hawbDetails,
          }),
          ...(location.state?.housingDetails && {
            housingDetails: location.state.housingDetails,
          }),
          ...(location.state?.job && { job: location.state.job }),
        },
      });
      setActive(active - 1);
    }
  };

  // Memoize additionalParams to prevent SearchableSelect from recreating fetchData on every render
  // This prevents infinite API calls
  const airTransportParams = useMemo(() => ({ transport_mode: "AIR" }), []);

  // Don't update location state on every keystroke - only when navigating to HouseCreate
  // This prevents infinite re-renders and input issues
  // Container details are preserved in form state and passed when navigating to HouseCreate

  // Update housing details and restore form state when location state changes
  // Only restore when coming back from HouseCreate, not on every state change
  // IMPORTANT: This effect runs AFTER jobData initialization to avoid interfering
  // Works for both CREATE and EDIT modes
  useEffect(() => {
    // Skip if navigation is in progress to prevent interference
    if (navigationInProgressRef.current) {
      return;
    }

    // CRITICAL: Skip restoration if forms are being initialized from jobData (only in edit/view mode)
    // Wait for jobData initialization to complete first in edit/view mode
    // In create mode, we don't have jobData, so we can proceed with restoration
    if (
      jobData &&
      (mode === "edit" || mode === "view") &&
      !formsInitializedFromJobDataRef.current
    ) {
      console.log("⏳ Waiting for jobData initialization to complete...");
      return;
    }

    try {
      // Detect if we're coming back from HouseCreate by checking if we have mawbDetails in state
      // This works for both CREATE and EDIT modes
      const hasMawbDetailsInState = !!location.state?.mawbDetails;

      // If hawbDetails exist in location.state with actual data, use them (coming back from HAWBCreate)
      // Don't overwrite if we've already loaded from jobData on initial edit load
      if (
        location.state?.hawbDetails &&
        Array.isArray(location.state.hawbDetails) &&
        location.state.hawbDetails.length > 0 &&
        !hawbDetailsLoadedRef.current
      ) {
        setHawbDetails(location.state.hawbDetails);
      } else if (
        location.state?.housingDetails &&
        Array.isArray(location.state.housingDetails) &&
        location.state.housingDetails.length > 0 &&
        !hawbDetailsLoadedRef.current
      ) {
        // Support legacy housingDetails key for backward compatibility
        setHawbDetails(location.state.housingDetails);
      }

      // Restore form state when coming back from HouseCreate
      // Always restore when mawbDetails exist in state (coming back from HAWB)
      // This ensures updated MAWB form data is restored when navigating back
      // IMPORTANT: Always restore when hasMawbDetailsInState is true, regardless of edit/create mode
      // This ensures updated MAWB values are restored when navigating back from HAWB
      if (hasMawbDetailsInState) {
        const savedMawbDetails = location.state?.mawbDetails;
        const savedCarrierDetails = location.state?.carrierDetails;

        // Create a unique key for this mawbDetails state to prevent duplicate restorations
        const mawbDetailsKey = savedMawbDetails
          ? JSON.stringify({
              service: savedMawbDetails.service,
              agent_code: savedMawbDetails.agent_code,
              origin_code: savedMawbDetails.origin_code,
              destination_code: savedMawbDetails.destination_code,
              etd: savedMawbDetails.etd,
              eta: savedMawbDetails.eta,
            })
          : null;

        // Only restore if this is a new/different mawbDetails state
        const shouldRestore =
          mawbDetailsKey &&
          mawbDetailsKey !== lastRestoredMawbDetailsRef.current;

        if (shouldRestore && savedMawbDetails) {
          // Restore MAWB Details - Always restore when coming back from HAWB
          mawbDetailsForm.setValues({
            service: savedMawbDetails.service || "AIR",
            agent_code: savedMawbDetails.agent_code || "",
            agent_name: savedMawbDetails.agent_name || "",
            origin_code: savedMawbDetails.origin_code || "",
            origin_name: savedMawbDetails.origin_name || "",
            destination_code: savedMawbDetails.destination_code || "",
            destination_name: savedMawbDetails.destination_name || "",
            etd: savedMawbDetails.etd || null,
            eta: savedMawbDetails.eta || null,
            atd: savedMawbDetails.atd || null,
            ata: savedMawbDetails.ata || null,
          });

          // Update origin agent data ref if available in location state
          if (savedMawbDetails.agent_data) {
            originAgentDataRef.current =
              savedMawbDetails.agent_data as Record<string, unknown>;
          }

          // Track that we've restored from this state
          lastRestoredMawbDetailsRef.current = mawbDetailsKey;

          // Force re-render of SearchableSelect components after restoring form values
          setTimeout(() => {
            setFormInitializedKey((prev) => prev + 1);
          }, 50);
        }

        // Restore Carrier Details - Always restore when coming back from HAWB (only if changed)
        if (shouldRestore && savedCarrierDetails) {
          carrierDetailsForm.setValues({
            schedule_id: savedCarrierDetails.schedule_id || "",
            carrier_code: savedCarrierDetails.carrier_code || "",
            carrier_name: savedCarrierDetails.carrier_name || "",
            flight_number:
              savedCarrierDetails.flight_number ||
              savedCarrierDetails.voyage_number ||
              "",
            mawb_number:
              savedCarrierDetails.mawb_number ||
              savedCarrierDetails.mawb_number ||
              "",
            mawb_date:
              savedCarrierDetails.mawb_date ||
              savedCarrierDetails.mawb_date ||
              null,
          });
        }
      }

      // Also restore routings if they exist in state
      // Always restore when coming back from HAWB to ensure updated routing data is restored
      if (
        hasMawbDetailsInState &&
        location.state?.routings &&
        Array.isArray(location.state.routings)
      ) {
        routingsForm.setValues({ routings: location.state.routings });
        // Reset routingStateInitializedRef to allow restoration on next navigation back from HAWB
        routingStateInitializedRef.current = false;
      }
    } catch (error) {
      console.error("Error restoring form state:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.state?.hawbDetails,
    location.state?.housingDetails,
    location.state?.mawbDetails,
    location.state?.carrierDetails,
    location.state?.routings,
    active, // Add active to dependencies to restore when navigating back to step 0
    mode, // Add mode to dependencies
  ]);

  // Note: Container details restoration removed for Air Export Jobs

  // Remove housing detail
  const removeHawbDetail = (index: number) => {
    const updated = hawbDetails.filter((_, i) => i !== index);
    setHawbDetails(updated);
  };

  // Helper function to navigate to HAWBCreate
  const navigateToHawbCreate = useCallback(
    (editIndex?: number, editData?: HAWBDetail) => {
      // Prevent multiple navigations
      if (navigationInProgressRef.current) {
        console.log("⚠️ Navigation already in progress, skipping...");
        return;
      }

      // Validate MAWB mandatory fields before navigating
      const missingFields: string[] = [];

      if (!mawbDetailsForm.values.service?.trim()) {
        missingFields.push("Service");
      }
      if (!mawbDetailsForm.values.agent_code?.trim()) {
        missingFields.push("Origin Agent");
      }
      if (!mawbDetailsForm.values.origin_code?.trim()) {
        missingFields.push("Origin");
      }
      if (!mawbDetailsForm.values.destination_code?.trim()) {
        missingFields.push("Destination");
      }
      if (!mawbDetailsForm.values.etd) {
        missingFields.push("ETD");
      }
      if (!mawbDetailsForm.values.eta) {
        missingFields.push("ETA");
      }

      if (missingFields.length > 0) {
        ToastNotification({
          type: "error",
          message: `Please fill all mandatory MAWB details.`,
        });
        // Set active step to 0 to show the MAWB details form
        setActive(0);
        return;
      }

      // Set navigation flag
      navigationInProgressRef.current = true;

      // Reset form state restoration flag so it can be restored when coming back
      formStateRestoredRef.current = false;
      // Reset last restored ref to allow restoration when coming back from HAWB
      lastRestoredMawbDetailsRef.current = null;

      // Prepare MAWB details with ALL current form values including origin_name and destination_name
      const mawbDetailsToPass = {
        service: mawbDetailsForm.values.service || "AIR",
        agent_code: mawbDetailsForm.values.agent_code || "",
        agent_name: mawbDetailsForm.values.agent_name || "",
        origin_code: mawbDetailsForm.values.origin_code || "",
        origin_name: mawbDetailsForm.values.origin_name || "",
        destination_code: mawbDetailsForm.values.destination_code || "",
        destination_name: mawbDetailsForm.values.destination_name || "",
        etd: mawbDetailsForm.values.etd || null,
        eta: mawbDetailsForm.values.eta || null,
        atd: mawbDetailsForm.values.atd || null,
        ata: mawbDetailsForm.values.ata || null,
        // Use ref first (most recent), then fallback to location.state
        agent_data: originAgentDataRef.current || null,
      };

      console.log("🚀 Navigating to HAWBCreate with mawbDetails:", {
        mawbDetailsToPass,
        agent_data: mawbDetailsToPass.agent_data,
        hasAddressesData: mawbDetailsToPass.agent_data?.addresses_data,
        fromRef: !!originAgentDataRef.current,
        fromLocationState: !!location.state?.mawbDetails?.agent_data,
      });

      navigate("/air/export-job/house-create", {
        state: {
          hawbDetails: hawbDetails,
          // Support legacy housingDetails key for backward compatibility
          housingDetails: hawbDetails,
          ...(editIndex !== undefined && { editIndex }),
          ...(editData && { editData }),
          ...(jobData && { job: jobData }),
          // Preserve form state including agent_code and agent_data
          mawbDetails: mawbDetailsToPass,
          carrierDetails: carrierDetailsForm.values,
          routings: routingsForm.values.routings,
          // Preserve master-level estimates so they can be restored on the job screen
          estimates: estimatesForm.values.estimates,
        },
      });

      // Reset navigation flag after a short delay
      setTimeout(() => {
        navigationInProgressRef.current = false;
      }, 1000);
    },
    [
      mawbDetailsForm.values,
      carrierDetailsForm.values,
      routingsForm.values.routings,
      estimatesForm.values.estimates,
      hawbDetails,
      jobData,
      location.state,
      navigate,
    ],
  );

  // Handle edit HAWB detail
  const handleEditHawbDetail = (index: number) => {
    const hawbToEdit = hawbDetails[index];
    navigateToHawbCreate(index, hawbToEdit);
  };

  // Cargo manifest PDF preview handlers
  const handleCargoManifestPreview = async () => {
    if (!jobData?.id) return;
    setPreviewOpen(true);
    setPdfBlob(null);
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
      setPdfBlob(pdfUrl);
    } catch (error) {
      console.error("Error fetching cargo manifest PDF:", error);
      ToastNotification({
        type: "error",
        message: "Failed to load cargo manifest PDF",
      });
      setPreviewOpen(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
    setPdfBlob(null);
  };

  const handleDownloadPDF = () => {
    if (pdfBlob) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `CargoManifest-${jobData?.id || "draft"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Proforma PDF preview handlers
  const handleProformaPreview = async (shipmentId: string) => {
    if (!shipmentId) return;
    setProformaPreviewOpen(true);
    setProformaPdfBlob(null);
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        // `${URL.base}job-create/proforma/${shipmentId}/pdf/`,
       `${URL.base}job-create/proforma/411/pdf/`,
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

  // Check if all requirements are met for Create button
  const canCreateJob = useMemo(() => {
    // Check MAWB mandatory fields
    const mawbFieldsValid =
      mawbDetailsForm.values.service?.trim() &&
      mawbDetailsForm.values.agent_code?.trim() &&
      mawbDetailsForm.values.origin_code?.trim() &&
      mawbDetailsForm.values.destination_code?.trim() &&
      mawbDetailsForm.values.etd &&
      mawbDetailsForm.values.eta;

    // Check at least one HAWB detail is added
    const hasHawbDetails = hawbDetails.length > 0;

    return mawbFieldsValid && hasHawbDetails;
  }, [
    mawbDetailsForm.values.service,
    mawbDetailsForm.values.agent_code,
    mawbDetailsForm.values.origin_code,
    mawbDetailsForm.values.destination_code,
    mawbDetailsForm.values.etd,
    mawbDetailsForm.values.eta,
    hawbDetails.length,
  ]);

  // Validate HAWB details - check mandatory fields
  const validateHawbDetails = () => {
    if (hawbDetails.length === 0) {
      ToastNotification({
        type: "error",
        message: "At least one HAWB detail is required before creating MAWB",
      });
      return false;
    }

    // Validate each HAWB detail has mandatory fields
    for (let i = 0; i < hawbDetails.length; i++) {
      const hawb = hawbDetails[i];
      const missingFields: string[] = [];

      // Step 1 validations
      if (!hawb.hawb_number?.trim()) {
        missingFields.push("HAWB Number");
      }
      if (!hawb.origin_code?.trim()) {
        missingFields.push("Origin");
      }
      if (!hawb.destination_code?.trim()) {
        missingFields.push("Destination");
      }
      if (!hawb.trade?.trim()) {
        missingFields.push("Trade");
      }
      if (!hawb.routed?.trim()) {
        missingFields.push("Routed");
      }
      if (!hawb.routed_by?.trim()) {
        missingFields.push("Routed By");
      }

      // Step 2 validations
      if (!hawb.shipper_name?.trim()) {
        missingFields.push("Shipper Name");
      }
      if (!hawb.consignee_name?.trim()) {
        missingFields.push("Consignee Name");
      }

      // Step 3 validations - at least one cargo detail required
      if (!hawb.cargo_details || hawb.cargo_details.length === 0) {
        missingFields.push("At least one Cargo Detail");
      } else {
        // Validate each cargo detail has mandatory fields
        for (let j = 0; j < hawb.cargo_details.length; j++) {
          const cargo = hawb.cargo_details[j];
          if (!cargo.no_of_packages || cargo.no_of_packages <= 0) {
            missingFields.push(`Cargo ${j + 1}: Number of Packages`);
          }
          if (!cargo.gross_weight || cargo.gross_weight <= 0) {
            missingFields.push(`Cargo ${j + 1}: Gross Weight`);
          }
        }
      }

      if (missingFields.length > 0) {
        ToastNotification({
          type: "error",
          message: `HAWB ${i + 1} is missing required fields: ${missingFields.join(", ")}`,
        });
        return false;
      }
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Validate HAWB details first
    if (!validateHawbDetails()) {
      setIsSubmitting(false);
      return;
    }

    // Validate MAWB and Carrier details before submission
    const mawbValidation = mawbDetailsForm.validate();
    const carrierValidation = carrierDetailsForm.validate();

    if (mawbValidation.hasErrors || carrierValidation.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required fields in MAWB & Carrier Details",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate routings if any field has value
    if (!validateStep2()) {
      setIsSubmitting(false);
      return;
    }
    try {
      const payload = {
        service: mawbDetailsForm.values.service,
        service_type: "Export",
        agent: mawbDetailsForm.values.agent_code || null,
        origin_code: mawbDetailsForm.values.origin_code,
        destination_code: mawbDetailsForm.values.destination_code,
        etd: mawbDetailsForm.values.etd
          ? dayjs(mawbDetailsForm.values.etd).isValid()
            ? dayjs(mawbDetailsForm.values.etd)
                .utc()
                .format("YYYY-MM-DDTHH:mm:ss") + "+00:00"
            : ""
          : "",
        eta: mawbDetailsForm.values.eta
          ? dayjs(mawbDetailsForm.values.eta).isValid()
            ? dayjs(mawbDetailsForm.values.eta)
                .utc()
                .format("YYYY-MM-DDTHH:mm:ss") + "+00:00"
            : ""
          : "",
        atd: mawbDetailsForm.values.atd
          ? dayjs(mawbDetailsForm.values.atd).isValid()
            ? dayjs(mawbDetailsForm.values.atd)
                .utc()
                .format("YYYY-MM-DDTHH:mm:ss") + "+00:00"
            : null
          : null,
        ata: mawbDetailsForm.values.ata
          ? dayjs(mawbDetailsForm.values.ata).isValid()
            ? dayjs(mawbDetailsForm.values.ata)
                .utc()
                .format("YYYY-MM-DDTHH:mm:ss") + "+00:00"
            : null
          : null,
        carrier_code: carrierDetailsForm.values.carrier_code,
        voyage_number: carrierDetailsForm.values.flight_number || null,
        mbl_date: carrierDetailsForm.values.mawb_date
          ? dayjs(carrierDetailsForm.values.mawb_date).isValid()
            ? dayjs(carrierDetailsForm.values.mawb_date).format("YYYY-MM-DD")
            : null
          : null,
        flightno: carrierDetailsForm.values.flight_number || null,
        mawb_no: carrierDetailsForm.values.mawb_number || null,
        ocean_routings: routingsForm.values.routings.map((routing) => {
          // New format: all fields are nullable
          const routingPayload: Record<string, unknown> = {
            transport_type: routing.transport_type || null,
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
            voyage_number: null,
            truck_no: null,
            rail_no: null,
          };

          // Map fields based on transport type
          if (routing.transport_type === "SEA") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.vessel = routing.vessel || null;
            routingPayload.voyage_number = routing.voyage_number || null;
          } else if (routing.transport_type === "AIR") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.flight = routing.flight || null;
          } else if (routing.transport_type === "ROAD") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.truck_no = routing.truck_no || null;
          } else if (routing.transport_type === "RAIL") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.rail_no = routing.rail_no || null;
          } else {
            // Default case - include all fields
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.vessel = routing.vessel || null;
            routingPayload.flight = routing.flight || null;
            routingPayload.voyage_number = routing.voyage_number || null;
            routingPayload.truck_no = routing.truck_no || null;
            routingPayload.rail_no = routing.rail_no || null;
          }

          return routingPayload;
        }),
        housing_details: hawbDetails.map((hawb) => ({
          hawb_no: hawb.hawb_number,
          routed: hawb.routed,
          routed_by: hawb.routed_by || null,
          origin_code: hawb.origin_code,
          destination_code: hawb.destination_code,
          customer_service: hawb.customer_service || "",
          trade: hawb.trade,
          agent_name: hawb.agent_name,
          agent_address: hawb.agent_address || "",
          agent_email: hawb.agent_email || "",
          shipper_code: hawb.shipper_code,
          shipper_name: hawb.shipper_name,
          shipper_address: hawb.shipper_address || "",
          shipper_email: hawb.shipper_email || "",
          consignee_code: hawb.consignee_code,
          consignee_name: hawb.consignee_name,
          consignee_address: hawb.consignee_address || "",
          consignee_email: hawb.consignee_email || "",
          notify_customer1_name: hawb.notify_customer1_name || "",
          notify_customer1_address: hawb.notify_customer1_address || "",
          notify_customer1_email: hawb.notify_customer1_email || "",
          commodity_description: hawb.commodity_description || null,
          marks_no: hawb.marks_no || null,
          item_no: (hawb as { item_no?: string }).item_no ?? "",
          sub_item_no: (hawb as { sub_item_no?: string }).sub_item_no ?? "",
          events: Array.isArray((hawb as { events?: unknown }).events)
            ? (
                (
                  hawb as {
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
          cargo_details: hawb.cargo_details || [],
          mawb_charges: hawb.charges
            ? hawb.charges.map((charge) => ({
                ...(charge.id != null &&
                  charge.id !== undefined && { id: Number(charge.id) }),
                charge_id: charge.charge_id ?? null,
                charge_name: charge.charge_name || "",
                pp_cc: charge.pp_cc || "",
                unit_id: charge.unit_id ? String(charge.unit_id) : "",
                // unit_input: charge.unit_code || "",
                // currency: charge.currency || "",
                no_of_unit: charge.no_of_unit || null,
                currency_id: charge.currency_id
                  ? String(charge.currency_id)
                  : "",
                roe: charge.roe || null,
                amount_per_unit: charge.amount_per_unit || null,
                amount: charge.amount || null,
              }))
            : [],
        })),
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
            no_of_unit: e.no_of_unit ?? null,
            currency_id: e.currency_id ? Number(e.currency_id) : null,
            roe: e.roe ?? null,
            cost_per_unit: e.cost_per_unit ?? null,
            total_cost: e.total_cost ?? null,
          }));
        })(),
      };
      console.log("Payload value---", payload);

      // API call to create or update air import job
      if (mode === "edit" && jobData?.id) {
        await putAPICall(
          `${URL.base}${URL.jobCreate}`,
          {
            ...payload,
            id: jobData.id,
          },
          API_HEADER,
        );
      } else {
        await postAPICall(`${URL.base}${URL.jobCreate}`, payload, API_HEADER);
      }

      ToastNotification({
        type: "success",
        message: `Air Export Job ${mode === "edit" ? "updated" : "created"} successfully`,
      });

      // Clear hawb details from state when navigating and trigger refetch
      navigate("/air/export-job", {
        state: { hawbDetails: [], refreshData: true },
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

  // Fetch invoice list when Accounts tab (active === 3) is active
  useEffect(() => {
    if (active !== 3) return;
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
          <Group gap="sm">
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
            {jobData?.id != null && hawbDetails.length > 0 && (
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
                      const allCollectCharges = hawbDetails.flatMap((hawb) =>
                        (hawb.charges ?? [])
                          .filter(
                            (c) => String(c.pp_cc ?? "").trim() === "Collect",
                          )
                          .map((c) => ({
                            ...c,
                            shipment_id:
                              (hawb as { shipment_id?: string }).shipment_id ??
                              (hawb as { shipment_no?: string }).shipment_no ??
                              "",
                            shipper_id:
                              (hawb as { shipper_code?: string })
                                .shipper_code ??
                              (hawb as { shipper_id?: string }).shipper_id ??
                              "",
                          })),
                      );

                      const firstHouse = hawbDetails[0];

                      const housingDetailsForInvoice = [
                        {
                          ...firstHouse,
                          charges: allCollectCharges,
                        },
                      ];

                      navigate("/air/export-job/invoice", {
                        state: {
                          hawbDetails: housingDetailsForInvoice,
                          housingDetails: housingDetailsForInvoice,
                          is_agent: true,
                          fromJobLevel: true,
                          ...(jobData && { job: jobData }),
                          ...(location.state?.mawbDetails && {
                            mawbDetails: location.state.mawbDetails,
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
                      navigate("/payment-request/create", {
                        state: {
                          job_reference_1: jobData?.job_id || jobData?.id || "",
                          job_reference_2: "",
                          ...(jobData && { job: jobData }),
                          ...(location.state?.mawbDetails && {
                            mawbDetails: location.state.mawbDetails,
                          }),
                        },
                      });
                    }}
                  >
                    Payment Request
                  </Menu.Item>

                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        )}
      </Group>

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
            MAWB &amp; Carrier Details
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
            Estimates
          </Tabs.Tab>
          {jobData?.id != null && (
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
              Accounts
            </Tabs.Tab>
          )}
        </Tabs.List>

        {/* Tab 1: MAWB Details & Carrier Details */}
        <Tabs.Panel value="0">
          <Box mt="md">
            {/* MAWB Details Section */}
            <Group align="center" mb="md">
              <Text size="lg" fw={600} c="#105476">
                MAWB Details
              </Text>
            </Group>
            <Grid mb="sm">
              <Grid.Col span={3}>
                <Dropdown
                  label="Service"
                  required
                  placeholder="Select Service"
                  searchable
                  data={["AIR"]}
                  {...mawbDetailsForm.getInputProps("service")}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  key={`origin-agent-${formInitializedKey}`}
                  label="Destination Agent"
                  required
                  placeholder="Type agent name"
                  apiEndpoint={URL.agent}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code), // Use code as value for API payload
                    label: String(item.customer_name), // Display name to user
                  })}
                  value={mawbDetailsForm.values.agent_code || null} // Stores agent_code
                  displayValue={mawbDetailsForm.values.agent_name || null} // Displays agent_name
                  onChange={(value, selectedData, originalData) => {
                    // Store customer_code as value (for API payload)
                    mawbDetailsForm.setFieldValue("agent_code", value || "");
                    // Store customer_name for display
                    mawbDetailsForm.setFieldValue("agent_name", selectedData?.label || "");

                    console.log("🔍 MAWB Destination Agent Selected:", {
                      agentCode: value,
                      agentName: selectedData?.label,
                      originalData,
                      hasAddressesData: originalData?.addresses_data,
                      addressesData: originalData?.addresses_data,
                    });

                    // Store origin agent data in ref for persistence
                    originAgentDataRef.current = originalData || null;
                    // Note: Don't update location.state on every keystroke - only when navigating to HouseCreate
                    // This prevents infinite re-renders and API calls
                  }}
                  returnOriginalData={true}
                  error={mawbDetailsForm.errors.agent_code as string}
                  minSearchLength={2}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  key={`origin-${formInitializedKey}`}
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type the origin"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={mawbDetailsForm.values.origin_code || null}
                  displayValue={
                    mawbDetailsForm.values.origin_name &&
                    mawbDetailsForm.values.origin_code
                      ? `${mawbDetailsForm.values.origin_name} (${mawbDetailsForm.values.origin_code})`
                      : mawbDetailsForm.values.origin_code || null
                  }
                  onChange={(value, selectedData) => {
                    mawbDetailsForm.setFieldValue("origin_code", value || "");
                    if (selectedData) {
                      const portName = selectedData.label.split(" (")[0] || "";
                      mawbDetailsForm.setFieldValue("origin_name", portName);
                    } else if (!value) {
                      mawbDetailsForm.setFieldValue("origin_name", "");
                    }
                  }}
                  additionalParams={airTransportParams}
                  minSearchLength={2}
                  error={mawbDetailsForm.errors.origin_code as string}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  key={`destination-${formInitializedKey}`}
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type the destination"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={mawbDetailsForm.values.destination_code || null}
                  displayValue={
                    mawbDetailsForm.values.destination_name &&
                    mawbDetailsForm.values.destination_code
                      ? `${mawbDetailsForm.values.destination_name} (${mawbDetailsForm.values.destination_code})`
                      : mawbDetailsForm.values.destination_code || null
                  }
                  onChange={(value, selectedData) => {
                    mawbDetailsForm.setFieldValue(
                      "destination_code",
                      value || "",
                    );
                    if (selectedData) {
                      const portName = selectedData.label.split(" (")[0] || "";
                      mawbDetailsForm.setFieldValue(
                        "destination_name",
                        portName,
                      );
                    } else if (!value) {
                      mawbDetailsForm.setFieldValue("destination_name", "");
                    }
                    // Note: Don't update location.state on every keystroke - only when navigating to HAWBCreate
                    // This prevents infinite re-renders and API calls
                  }}
                  additionalParams={airTransportParams}
                  minSearchLength={2}
                  error={mawbDetailsForm.errors.destination_code as string}
                />
              </Grid.Col>
            </Grid>

            {/* Second row for ETD, ETA, ATD, ATA */}
            <Grid mb="xl">
              <Grid.Col span={3}>
                <DateTimeInput
                  label="ETD"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={mawbDetailsForm.values.etd}
                  onChange={(value: Date | null) => {
                    mawbDetailsForm.setFieldValue("etd", value);
                  }}
                  error={mawbDetailsForm.errors.etd as string}
                  size="sm"
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <DateTimeInput
                  label="ETA"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={mawbDetailsForm.values.eta}
                  onChange={(value: Date | null) => {
                    mawbDetailsForm.setFieldValue("eta", value);
                  }}
                  error={mawbDetailsForm.errors.eta as string}
                  size="sm"
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <DateTimeInput
                  label="ATD"
                  placeholder="YYYY-MM-DD"
                  value={mawbDetailsForm.values.atd}
                  onChange={(value: Date | null) => {
                    mawbDetailsForm.setFieldValue("atd", value);
                  }}
                  error={mawbDetailsForm.errors.atd as string}
                  size="sm"
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <DateTimeInput
                  label="ATA"
                  placeholder="YYYY-MM-DD"
                  value={mawbDetailsForm.values.ata}
                  onChange={(value: Date | null) => {
                    mawbDetailsForm.setFieldValue("ata", value);
                  }}
                  error={mawbDetailsForm.errors.ata as string}
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
              <Grid.Col span={2}>
                <SearchableSelect
                  key={`carrier-${formInitializedKey}`}
                  label="Carrier"
                  required
                  apiEndpoint={URL.carrier}
                  placeholder="Type carrier name"
                  searchFields={["carrier_code", "carrier_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.carrier_code),
                    label: String(item.carrier_name),
                  })}
                  value={carrierDetailsForm.values.carrier_code || null}
                  displayValue={carrierDetailsForm.values.carrier_name || null}
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
                    mawbDetailsForm.values.service
                      ? {
                          transport_mode: "AIR",
                        }
                      : undefined
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <FormTextInput
                  label="Flight Number"
                  required
                  placeholder="Enter Flight number"
                  {...carrierDetailsForm.getInputProps("flight_number")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <FormTextInput
                  label="MAWB Number"
                  required
                  placeholder="Enter MAWB number"
                  maxLength={11}
                  {...carrierDetailsForm.getInputProps("mawb_number")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <SingleDateInput
                  label="MAWB Date"
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps =
                      carrierDetailsForm.getInputProps("mawb_date");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        carrierDetailsForm.setFieldValue("mawb_date", value);
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
              Routings
            </Text>

            <Stack gap="xl">
              {routingsForm.values.routings.map((routing, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={2.5}>
                      <Dropdown
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
                          const oldTransportType =
                            routingsForm.values.routings[index]?.transport_type;
                          routingsForm.setFieldValue(
                            `routings.${index}.transport_type`,
                            value || "",
                          );
                          // Clear carrier when transport type changes
                          if (oldTransportType !== value) {
                            routingsForm.setFieldValue(
                              `routings.${index}.carrier_code`,
                              "",
                            );
                            routingsForm.setFieldValue(
                              `routings.${index}.carrier_name`,
                              "",
                            );
                            // Clear transport-type-specific fields
                            routingsForm.setFieldValue(
                              `routings.${index}.vessel`,
                              "",
                            );
                            routingsForm.setFieldValue(
                              `routings.${index}.flight`,
                              "",
                            );
                            routingsForm.setFieldValue(
                              `routings.${index}.voyage_number`,
                              "",
                            );
                            routingsForm.setFieldValue(
                              `routings.${index}.truck_no`,
                              "",
                            );
                            routingsForm.setFieldValue(
                              `routings.${index}.rail_no`,
                              "",
                            );
                          }
                        }}
                        error={
                          routingsForm.errors[
                            `routings.${index}.transport_type`
                          ] as string
                        }
                      />
                    </Grid.Col>

                    <Grid.Col span={2.5}>
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

                    <Grid.Col span={2.5}>
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
                        <Grid.Col span={2}>
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

                        <Grid.Col span={2}>
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
                        <Grid.Col span={2.5}>
                          <FormTextInput
                            label="Voyage Number"
                            required
                            placeholder="Enter voyage number"
                            {...routingsForm.getInputProps(
                              `routings.${index}.voyage_number`,
                            )}
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "AIR" && (
                      <>
                        <Grid.Col span={2}>
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
                        <Grid.Col span={2.5}>
                          <FormTextInput
                            label="Flight Number"
                            required
                            placeholder="Enter flight number"
                            {...routingsForm.getInputProps(
                              `routings.${index}.flight`,
                            )}
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "ROAD" && (
                      <>
                        <Grid.Col span={2}>
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
                        <Grid.Col span={2.5}>
                          <FormTextInput
                            label="Truck Number"
                            required
                            placeholder="Enter truck number"
                            {...routingsForm.getInputProps(
                              `routings.${index}.truck_no`,
                            )}
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "RAIL" && (
                      <>
                        <Grid.Col span={2}>
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
                        <Grid.Col span={2.5}>
                          <FormTextInput
                            label="Rail Number"
                            required
                            placeholder="Enter rail number"
                            {...routingsForm.getInputProps(
                              `routings.${index}.rail_no`,
                            )}
                          />
                        </Grid.Col>
                      </>
                    )}

                    <Grid.Col span={2.5}>
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

                    <Grid.Col span={2.5}>
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

                    <Grid.Col span={2.5}>
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

                    <Grid.Col span={2.5}>
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
                            size="lg"
                            variant="light"
                            color="#105476"
                            onClick={addRouting}
                            style={{ marginTop: "1.75rem" }}
                          >
                            <IconPlus size={16}></IconPlus>
                          </ActionIcon>
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

        {/* Tab 3: Estimates */}
        <Tabs.Panel value="2">
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
              serviceType="AIR"
              key={`estimates-${formInitializedKey}`}
              form={estimatesForm}
              readOnly={isReadOnly}
              debugTag="AIR_EXPORT_JOB"
            />
          </Box>
        </Tabs.Panel>

        {jobData?.id != null && (
          <Tabs.Panel value="3">
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
                          Invoice Number
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
                                            `/air/export-job/invoice/view/${row.invoice_id ?? row.id}`,
                                            {
                                              state: {
                                                invoiceData: row,
                                                fromJobLevel: true,
                                                ...(jobData && {
                                                  job: jobData,
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
                                              `/air/export-job/invoice/edit/${row.invoice_id ?? row.id}`,
                                              {
                                                state: {
                                                  invoiceData: row,
                                                  fromJobLevel: true,
                                                  ...(jobData && {
                                                    job: jobData,
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
                                              "/air/export-job/invoice/reverse",
                                              {
                                                state: {
                                                  document_no:
                                                    row.document_no ?? "",
                                                  ...(jobData && {
                                                    job: jobData,
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
                                    px={8}
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
                                              Invoice Number
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
                                                                (
                                                                  row as unknown as {
                                                                    reverse_invoice_id?: number;
                                                                  }
                                                                )
                                                                  .reverse_invoice_id) as number;
                                                            navigate(
                                                              `/air/export-job/invoice/view/${targetId}`,
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
                                                                  ...(jobData && {
                                                                    job: jobData,
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
            onClick={() => navigate("/air/export-job")}
          >
            Back to List
          </Button>
          {(active === 1 || active === 2) && !isReadOnly && (
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
          {!isReadOnly && (
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={() => navigateToHawbCreate()}
            >
              Add HAWB
            </Button>
          )}
          {active === 0 && !isReadOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
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
              loading={isSubmitting}
            >
              Submit
            </Button>
          )}
        </Group>
      </Group>
      {/* Cargo Manifest PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
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
                title="Cargo Manifest Preview"
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

      {/* HAWB Details Display - Show at the top (all steps) */}
      {hawbDetails.length > 0 && (
        <Box mb="xl">
          <Text size="lg" fw={600} c="#105476" mb="md" mt="md">
            House Air Waybill (HAWB) ({hawbDetails.length})
          </Text>
          <Stack gap="md">
            {hawbDetails.map((hawb, index) => (
              <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Group>
                    <Badge color="#105476" size="lg">
                      HAWB {index + 1}
                    </Badge>
                    <Badge
                      color={
                        hawb.routed === "self" || hawb.routed === "agent"
                          ? "green"
                          : "gray"
                      }
                      variant="light"
                    >
                      {hawb.routed === "self"
                        ? "Self"
                        : hawb.routed === "agent"
                          ? "Agent"
                          : "Not Routed"}
                    </Badge>
                    {hawb.routed_by && (
                      <Badge color="blue" variant="light" ml="xs">
                        Routed By : {hawb.routed_by}
                      </Badge>
                    )}
                  </Group>
                  <Group gap="xs">
                    {!isReadOnly && (
                      <>
                        <Button
                          variant="light"
                          color="#105476"
                          size="xs"
                          leftSection={<IconEdit size={14} />}
                          onClick={() => handleEditHawbDetail(index)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="light"
                          color="red"
                          size="xs"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => removeHawbDetail(index)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                    <Menu shadow="md" width={160} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          variant="light"
                          color="#105476"
                          size="sm"
                          styles={{
                            root: {
                              border: "1px solid #E9ECEF",
                              borderRadius: "6px",
                            },
                          }}
                        >
                          <IconDotsVertical size={14} />
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
                              <IconFileInvoice size={14} color="#105476" />
                            </Box>
                          }
                          styles={{
                            item: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              borderRadius: "6px",
                              padding: "10px 12px",
                              "&:hover": { backgroundColor: "#F8F9FA" },
                            },
                            itemLabel: {
                              fontFamily: "Inter",
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                            },
                          }}
                          onClick={() =>
                            // handleProformaPreview(hawb.shipment_id)
                            handleProformaPreview(hawb.id)
                          }
                        >
                          Proforma
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Group>

                <Grid>
                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      HAWB Number
                    </Text>
                    <Text size="sm" mb="sm">
                      {hawb.hawb_number || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Origin
                    </Text>
                    <Text size="sm" mb="sm">
                      {hawb.origin_name && hawb.origin_code
                        ? `${hawb.origin_name} (${hawb.origin_code})`
                        : hawb.origin_code || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Destination
                    </Text>
                    <Text size="sm" mb="sm">
                      {hawb.destination_name && hawb.destination_code
                        ? `${hawb.destination_name} (${hawb.destination_code})`
                        : hawb.destination_code || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Customer Service
                    </Text>
                    <Text size="sm" mb="sm">
                      {hawb.customer_service || "-"}
                    </Text>
                  </Grid.Col>
                </Grid>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default AirExportJobCreate;
