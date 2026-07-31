import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Tabs,
  Table,
  Radio,
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
import { useForm, type UseFormReturnType } from "@mantine/form";
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
  IconPaperclip,
} from "@tabler/icons-react";
import {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  Fragment,
} from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  formatLocalDateTime,
  parseLocalDateTime,
} from "../../../utils/localDateTime";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { JobInvoiceDeleteConfirmModal } from "../../../components/JobInvoiceDeleteConfirmModal";
import { JobInvoiceDeleteMenuItem } from "../../../components/JobInvoiceDeleteMenuItem";
import { JobReverseInvoiceAccountMenu } from "../../../components/JobReverseInvoiceAccountMenu";
import { useJobAccountInvoices } from "../../../hooks/useJobAccountInvoices";
import { useJobDocuments } from "../../../hooks/useJobDocuments";
import JobDocumentsModal from "../../../components/JobDocumentsModal";
import {
  buildDocumentIdsPayloadField,
  extractHouseDocumentFields,
  type HouseDocumentFields,
} from "../../../utils/jobDocuments";
import { getInvoiceStatusBadgeColor } from "../../../utils/invoiceStatus";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { toTitleCase } from "../../../utils/textFormatter";
import FormTextInput from "../../../components/FormTextInput";
import FormTextArea from "../../../components/FormTextArea";
import { roundToDecimals } from "../../../utils/numberInputUtils";
import {
  bindMoneyWholeNumberMode,
  isVietnamBranchFromUser,
  roundMoneyToDecimals,
} from "../../../utils/nonDecimalMoneyAmount";
import { roundRoeForPayload } from "../../../utils/exchangeRateRoe";
import { getMeaningfulHouseCharges } from "../../../utils/houseChargesPayload";
import {
  formatInvoiceDocumentNo,
  getInvoiceDocumentNo,
} from "../../../utils/invoiceDocumentNumber";
import { HouseCardSummaryTotals } from "../../../components/JobChargeSummaryDisplay";
import { HouseCreateAgentInvoiceMenuItem } from "../../../components/HouseCreateAgentInvoiceMenuItem";
import { HouseAutomateVendorInvoiceMenuItem } from "../../../components/HouseAutomateVendorInvoiceMenuItem";
import { AutomateVendorInvoiceTrigger } from "../../../components/AutomateVendorInvoiceTrigger";
import { VendorInvoiceAutomationModal } from "../../../components/VendorInvoiceAutomationModal";
import { HouseEventsMenuItem } from "../../../components/HouseEventsMenuItem";
import { HouseJobLedgerMenuItem } from "../../../components/HouseJobLedgerMenuItem";
import { getMasterShipmentNo } from "../../../utils/vendorInvoiceAutomation";
import {
  JOB_HOUSE_ACTION_MENU_DROPDOWN_STYLES,
  JOB_HOUSE_ACTION_MENU_WIDTH,
} from "../../../utils/jobHouseActionMenuStyles";
import {
  formatHouseCargoChargeableForPayload,
  formatHouseCargoWeightForPayload,
  importHouseCargoWeightFromApi,
  type HouseCargoWeightValue,
} from "../../../utils/houseCargoChargeableWeight";
import {
  JobMasterPartyDetailsPanel,
  type JobMasterPartyDetailsValues,
  type PartyAddressOption,
} from "../JobMasterPartyDetailsPanel";
import {
  buildInlandExportJobServicePayload,
  resolveInlandExportJobServiceFields,
  withInlandExportJobServiceFields,
} from "./inlandExportJobService";
import EditPageHeadingRow from "../../../components/EditPageHeadingRow";

type ServiceMasterItem = {
  service_code: string;
  service_name: string;
};

const fetchInlandExportServices = async (): Promise<ServiceMasterItem[]> => {
  const response = await getAPICall(
    `${URL.serviceMaster}?filter=inland_export`,
    API_HEADER,
  );
  return Array.isArray(response) ? response : [];
};

const fetchServiceMasterByCode = async (
  serviceCode: string,
): Promise<ServiceMasterItem | null> => {
  if (!serviceCode.trim()) return null;
  const response = await getAPICall(
    `${URL.serviceMaster}?service_code=${encodeURIComponent(serviceCode.trim())}`,
    API_HEADER,
  );
  if (Array.isArray(response) && response.length > 0) {
    return response[0] as ServiceMasterItem;
  }
  if (response && typeof response === "object" && "service_code" in response) {
    return response as ServiceMasterItem;
  }
  return null;
};

// Type definitions
type MAWBDetailsForm = {
  service_code: string;
  service_name: string;
  pp_cc: string;
  note: string;
  is_direct: boolean;
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
  flight_number: string;
  mawb_number: string;
  mawb_date: Date | null;
};

type RoutingDetail = {
  id?: number;
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

// ContainerDetail removed for Inland Export Jobs

type HAWBDetail = HouseDocumentFields & {
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
  note?: string;
  item_no?: string;
  sub_item_no?: string;
  ref_no?: string;
  shipment_terms_code?: string;
  pp_cc?: string;
  cargo_details?: Array<{
    no_of_packages: number | null;
    gross_weight: HouseCargoWeightValue;
    volume: HouseCargoWeightValue;
    chargeable_weight: HouseCargoWeightValue;
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
    local_amount?: number | null;
    sell_local_amount?: number | null;
    cost_per_unit?: number | null;
    unit_cost?: number | null;
    total_cost?: number | null;
    cost_local_amount?: number | null;
    supplier_code?: string | null;
    supplier_name?: string | null;
  }>;
  mawb_charges?: Array<Record<string, unknown>>;
  summary?: {
    total_local_sell?: number | string | null;
    total_local_cost?: number | string | null;
  };
};

// Invoice-related types for Accounts tab
type ReverseInvoiceItem = {
  id?: number;
  reverse_invoice_id?: number;
  reverse_document_no?: string;
  document_no?: string;
  document_date?: string;
  total?: string | number;
  status?: string;
  day_book_name?: string;
  bill_to_name?: string;
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
  bill_to_name?: string;
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
  service_code: yup.string().trim().required("Service is required"),
  is_direct: yup.boolean().required(),
  // Destination Agent is required when "Direct" is No (false).
  // When "Direct" is Yes (true), Destination Agent becomes optional.
  agent_code: yup
    .string()
    .test(
      "agent_code-required-when-direct-false",
      "Destination Agent is required",
      function (value) {
        const parent = this.parent as { is_direct?: boolean };
        const isDirect = parent.is_direct === true;

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
  flight_number: yup.string().required("Truck Number is required"),
  mawb_number: yup
    .string()
    .required("AWB Number is required")
    .matches(/^[A-Za-z0-9]{11}$/, "AWB Number must be exactly 11 characters"),
  mawb_date: yup.date().nullable(),
});

// Container schemas removed for Inland Export Jobs

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
  const type = transportType.trim().toUpperCase();
  if (type === "AIR") return "AIR";
  if (type === "SEA" || type === "FCL" || type === "LCL" || type === "VESSEL")
    return "SEA";
  if (type === "ROAD") return "LAND";
  return undefined;
};

/** Normalize job/house Freight (pp_cc); defaults to Collect. */
const resolveFreightPpCc = (...candidates: unknown[]): string => {
  for (const value of candidates) {
    const raw = String(value ?? "").trim();
    if (!raw) continue;
    const upper = raw.toUpperCase();
    if (upper === "PP" || upper === "PREPAID") return "Prepaid";
    if (upper === "CC" || upper === "COLLECT") return "Collect";
    if (raw === "Prepaid" || raw === "Collect") return raw;
  }
  return "Collect";
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

function InlandExportJobCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job;
  const {
    invoiceList,
    invoiceListLoading,
    invoiceDeletingId,
    expandedInvoiceRowId,
    setExpandedInvoiceRowId,
    requestDeleteInvoice,
    requestDeleteReverseInvoice,
    deleteConfirmProps,
  } = useJobAccountInvoices<InvoiceListItem>({
    activeTab: active,
    accountsTabIndex: 4,
    shipmentNo: jobData?.job_id,
    isAgent: true,
    enabled: !!jobData?.id,
  });
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const jobServiceFields = useMemo(
    () =>
      resolveInlandExportJobServiceFields(
        jobData as Record<string, unknown> | undefined,
      ),
    [jobData],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingJobById, setIsFetchingJobById] = useState(false);
  const lastFetchedJobIdRef = useRef<number | null>(null);
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

  // Cargo manifest PDF preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);

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
  const [
    vendorInvoiceAutomationShipmentNo,
    setVendorInvoiceAutomationShipmentNo,
  ] = useState<string | null>(null);

  const openVendorInvoiceAutomation = useCallback((shipmentNo: string) => {
    const normalized = shipmentNo.trim();
    if (!normalized) {
      ToastNotification({
        type: "error",
        message: "Shipment number not found for vendor invoice automation.",
      });
      return;
    }
    setVendorInvoiceAutomationShipmentNo(normalized);
  }, []);
  const jobDocuments = useJobDocuments();

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
    [inlandExportServices],
  );

  const resolvedServiceCode = jobServiceFields.service_code;

  const { data: resolvedServiceByCode } = useQuery({
    queryKey: ["serviceMaster", "byCode", resolvedServiceCode],
    queryFn: () => fetchServiceMasterByCode(resolvedServiceCode),
    enabled: Boolean(resolvedServiceCode),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const [confirmBackToListOpen, setConfirmBackToListOpen] = useState(false);
  const handleBackToListClick = () => {
    // In create mode the job is not saved yet; confirm before leaving.
    if (!isReadOnly && mode === "create" && !jobData?.id) {
      setConfirmBackToListOpen(true);
      return;
    }
    navigate("/inland/export-job");
  };

  // Fetch full job only when explicit `jobId` is provided or `job` is absent.
  // Do not refetch just because service_code is missing; this allows master-level
  // state passed back from House (Save AWB) to remain displayed without reload.
  useEffect(() => {
    const jobFromState = location.state?.job as
      Record<string, unknown> | undefined;
    const jobId =
      (location.state?.jobId as number | undefined) ??
      (jobFromState?.id as number | undefined);
    if (jobId == null) return;

    const shouldFetch = location.state?.jobId != null || !location.state?.job;

    if (!shouldFetch) return;
    if (lastFetchedJobIdRef.current === jobId) return;

    let cancelled = false;
    const fetchAndReplace = async () => {
      lastFetchedJobIdRef.current = jobId;
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
          list.length > 0
            ? withInlandExportJobServiceFields(
                list[0] as Record<string, unknown>,
              )
            : null;
        if (!cancelled && job) {
          navigate("/inland/export-job/edit", {
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
        // Always clear loader, even if effect cleanup marked this request cancelled.
        // Route-state replace during successful fetch can otherwise leave the page stuck.
        setIsFetchingJobById(false);
      }
    };
    fetchAndReplace();
    return () => {
      cancelled = true;
    };
  }, [
    location.state?.jobId,
    location.state?.job,
    location.state?.returnTo,
    location.state?.viewMode,
    navigate,
  ]);

  // MAWB Details Form - Initialize with jobData if available, or from location.state for create mode
  const mawbDetailsForm = useForm<MAWBDetailsForm>({
    initialValues: {
      service_code:
        jobServiceFields.service_code ||
        location.state?.mawbDetails?.service_code ||
        "",
      service_name:
        jobServiceFields.service_name ||
        location.state?.mawbDetails?.service_name ||
        "",
      pp_cc: resolveFreightPpCc(
        (jobData as Record<string, unknown> | undefined)?.pp_cc,
        (jobData as Record<string, unknown> | undefined)?.freight,
        location.state?.mawbDetails?.pp_cc,
      ),
      note: String(
        (location.state?.mawbDetails as { note?: unknown } | undefined)?.note ??
          (jobData as { note?: unknown } | undefined)?.note ??
          "",
      ),
      is_direct:
        parseBoolean(
          jobData?.is_direct ?? location.state?.mawbDetails?.is_direct,
        ) || false,
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
        parseLocalDateTime(jobData?.etd) ??
        (location.state?.mawbDetails?.etd || null),
      eta:
        parseLocalDateTime(jobData?.eta) ??
        (location.state?.mawbDetails?.eta || null),
      atd:
        parseLocalDateTime(jobData?.atd) ??
        (location.state?.mawbDetails?.atd || null),
      ata:
        parseLocalDateTime(jobData?.ata) ??
        (location.state?.mawbDetails?.ata || null),
      shipper_id: location.state?.mawbDetails?.shipper_id || "",
      shipper_name:
        String(
          (jobData as Record<string, unknown> | undefined)?.shipper_name || "",
        ) ||
        location.state?.mawbDetails?.shipper_name ||
        "",
      shipper_email:
        String(
          (jobData as Record<string, unknown> | undefined)?.shipper_email || "",
        ) ||
        location.state?.mawbDetails?.shipper_email ||
        "",
      shipper_address_id: location.state?.mawbDetails?.shipper_address_id || "",
      shipper_address:
        String(
          (jobData as Record<string, unknown> | undefined)?.shipper_address ||
            "",
        ) ||
        location.state?.mawbDetails?.shipper_address ||
        "",
      consignee_id: location.state?.mawbDetails?.consignee_id || "",
      consignee_name:
        String(
          (jobData as Record<string, unknown> | undefined)?.consignee_name ||
            "",
        ) ||
        location.state?.mawbDetails?.consignee_name ||
        "",
      consignee_email:
        String(
          (jobData as Record<string, unknown> | undefined)?.consignee_email ||
            "",
        ) ||
        location.state?.mawbDetails?.consignee_email ||
        "",
      consignee_address_id:
        location.state?.mawbDetails?.consignee_address_id || "",
      consignee_address:
        String(
          (jobData as Record<string, unknown> | undefined)?.consignee_address ||
            "",
        ) ||
        location.state?.mawbDetails?.consignee_address ||
        "",
      carrier_agent_id: location.state?.mawbDetails?.carrier_agent_id || "",
      carrier_agent_name:
        String(
          (jobData as Record<string, unknown> | undefined)
            ?.carrier_agent_name || "",
        ) ||
        location.state?.mawbDetails?.carrier_agent_name ||
        "",
      carrier_agent_email:
        String(
          (jobData as Record<string, unknown> | undefined)
            ?.carrier_agent_email || "",
        ) ||
        location.state?.mawbDetails?.carrier_agent_email ||
        "",
      carrier_agent_address_id:
        location.state?.mawbDetails?.carrier_agent_address_id || "",
      carrier_agent_address:
        String(
          (jobData as Record<string, unknown> | undefined)
            ?.carrier_agent_address || "",
        ) ||
        location.state?.mawbDetails?.carrier_agent_address ||
        "",
    },
    validate: yupResolver(mawbDetailsSchema),
  });

  const partyDetailsForm = mawbDetailsForm;
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
  const [carrierAgentAddressSearch, setCarrierAgentAddressSearch] =
    useState("");
  const [shipperAddressCustom, setShipperAddressCustom] = useState(false);
  const [consigneeAddressCustom, setConsigneeAddressCustom] = useState(false);
  const [carrierAgentAddressCustom, setCarrierAgentAddressCustom] =
    useState(false);

  const getMawbDetailsSnapshot = useCallback(
    () => ({
      service_code: mawbDetailsForm.values.service_code || "",
      service_name: mawbDetailsForm.values.service_name || "",
      pp_cc: mawbDetailsForm.values.pp_cc || "Collect",
      note: mawbDetailsForm.values.note || "",
      is_direct: mawbDetailsForm.values.is_direct,
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
      shipper_id: mawbDetailsForm.values.shipper_id || "",
      shipper_name: mawbDetailsForm.values.shipper_name || "",
      shipper_email: mawbDetailsForm.values.shipper_email || "",
      shipper_address_id: mawbDetailsForm.values.shipper_address_id || "",
      shipper_address: mawbDetailsForm.values.shipper_address || "",
      consignee_id: mawbDetailsForm.values.consignee_id || "",
      consignee_name: mawbDetailsForm.values.consignee_name || "",
      consignee_email: mawbDetailsForm.values.consignee_email || "",
      consignee_address_id: mawbDetailsForm.values.consignee_address_id || "",
      consignee_address: mawbDetailsForm.values.consignee_address || "",
      carrier_agent_id: mawbDetailsForm.values.carrier_agent_id || "",
      carrier_agent_name: mawbDetailsForm.values.carrier_agent_name || "",
      carrier_agent_email: mawbDetailsForm.values.carrier_agent_email || "",
      carrier_agent_address_id:
        mawbDetailsForm.values.carrier_agent_address_id || "",
      carrier_agent_address: mawbDetailsForm.values.carrier_agent_address || "",
    }),
    [mawbDetailsForm.values],
  );

  useEffect(() => {
    if (!resolvedServiceByCode?.service_code) return;
    mawbDetailsForm.setFieldValue(
      "service_code",
      resolvedServiceByCode.service_code,
    );
    mawbDetailsForm.setFieldValue(
      "service_name",
      resolvedServiceByCode.service_name || resolvedServiceByCode.service_code,
    );
  }, [
    resolvedServiceByCode?.service_code,
    resolvedServiceByCode?.service_name,
  ]);

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
    { defaultPpCc: "Prepaid" },
  );
  const estimatesRoeValidateRef = useRef<(() => boolean) | null>(null);

  // Note: Container Details are not used for Inland Export Jobs

  // Load job data if in edit or view mode - Only initialize once from jobData
  // This effect runs FIRST to ensure forms are initialized before restoration logic
  useEffect(() => {
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
          service_code: jobServiceFields.service_code,
          service_name: jobServiceFields.service_name,
          pp_cc: resolveFreightPpCc(
            (jobData as Record<string, unknown>).pp_cc,
            (jobData as Record<string, unknown>).freight,
          ),
          note: String((jobData as { note?: unknown }).note ?? ""),
          is_direct: parseBoolean(jobData.is_direct) || false,
          // Use agent_code and agent_name from API response, fallback to old fields for backward compatibility
          agent_code: jobData.agent_code || jobData.origin_agent || "",
          agent_name: jobData.agent_name || jobData.origin_agent_name || "",
          origin_code: jobData.origin_code || "",
          origin_name: jobData.origin_name || "",
          destination_code: jobData.destination_code || "",
          destination_name: jobData.destination_name || "",
          etd: parseLocalDateTime(jobData.etd),
          eta: parseLocalDateTime(jobData.eta),
          atd: parseLocalDateTime(jobData.atd),
          ata: parseLocalDateTime(jobData.ata),
          shipper_id: "",
          shipper_name: String(jobData.shipper_name || ""),
          shipper_email: String(jobData.shipper_email || ""),
          shipper_address_id: "",
          shipper_address: String(jobData.shipper_address || ""),
          consignee_id: "",
          consignee_name: String(jobData.consignee_name || ""),
          consignee_email: String(jobData.consignee_email || ""),
          consignee_address_id: "",
          consignee_address: String(jobData.consignee_address || ""),
          carrier_agent_id: "",
          carrier_agent_name: String(jobData.carrier_agent_name || ""),
          carrier_agent_email: String(jobData.carrier_agent_email || ""),
          carrier_agent_address_id: "",
          carrier_agent_address: String(jobData.carrier_agent_address || ""),
        };

        console.log("🔧 Setting MAWB form values:", mawbInitialValues);
        // Use setValues to update all fields at once
        mawbDetailsForm.setValues(mawbInitialValues);

        // If we are coming back from InlandHouseCreate, preserve the edited MAWB
        // master fields from location.state (e.g., is_direct) instead of
        // letting the API response overwrite them.
        const savedMawbDetailsFromState = location.state?.mawbDetails;
        if (savedMawbDetailsFromState) {
          mawbDetailsForm.setValues({
            service_code: savedMawbDetailsFromState.service_code || "",
            service_name: savedMawbDetailsFromState.service_name || "",
            pp_cc: resolveFreightPpCc(savedMawbDetailsFromState.pp_cc),
            note: String(
              (savedMawbDetailsFromState as { note?: unknown }).note ?? "",
            ),
            is_direct: parseBoolean(savedMawbDetailsFromState.is_direct),
            agent_code: savedMawbDetailsFromState.agent_code || "",
            agent_name: savedMawbDetailsFromState.agent_name || "",
            origin_code: savedMawbDetailsFromState.origin_code || "",
            origin_name: savedMawbDetailsFromState.origin_name || "",
            destination_code: savedMawbDetailsFromState.destination_code || "",
            destination_name: savedMawbDetailsFromState.destination_name || "",
            etd: savedMawbDetailsFromState.etd || null,
            eta: savedMawbDetailsFromState.eta || null,
            atd: savedMawbDetailsFromState.atd || null,
            ata: savedMawbDetailsFromState.ata || null,
            shipper_id: savedMawbDetailsFromState.shipper_id || "",
            shipper_name: savedMawbDetailsFromState.shipper_name || "",
            shipper_email: savedMawbDetailsFromState.shipper_email || "",
            shipper_address_id:
              savedMawbDetailsFromState.shipper_address_id || "",
            shipper_address: savedMawbDetailsFromState.shipper_address || "",
            consignee_id: savedMawbDetailsFromState.consignee_id || "",
            consignee_name: savedMawbDetailsFromState.consignee_name || "",
            consignee_email: savedMawbDetailsFromState.consignee_email || "",
            consignee_address_id:
              savedMawbDetailsFromState.consignee_address_id || "",
            consignee_address:
              savedMawbDetailsFromState.consignee_address || "",
            carrier_agent_id: savedMawbDetailsFromState.carrier_agent_id || "",
            carrier_agent_name:
              savedMawbDetailsFromState.carrier_agent_name || "",
            carrier_agent_email:
              savedMawbDetailsFromState.carrier_agent_email || "",
            carrier_agent_address_id:
              savedMawbDetailsFromState.carrier_agent_address_id || "",
            carrier_agent_address:
              savedMawbDetailsFromState.carrier_agent_address || "",
          });

          if (savedMawbDetailsFromState.agent_data) {
            originAgentDataRef.current =
              savedMawbDetailsFromState.agent_data as Record<string, unknown>;
          }
        }

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
              agent_address: house.agent_address
                ? String(house.agent_address)
                : "",
              agent_email: house.agent_email ? String(house.agent_email) : "",
              cha_name: house.cha_name ? String(house.cha_name) : "",
              cha_address: house.cha_address ? String(house.cha_address) : "",
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
              note: (house as { note?: unknown }).note
                ? String((house as { note?: unknown }).note)
                : "",
              item_no: house.item_no ? String(house.item_no) : "",
              sub_item_no: house.sub_item_no ? String(house.sub_item_no) : "",
              ref_no: house.ref_no ? String(house.ref_no) : "",
              shipment_terms_code: house.shipment_terms_code
                ? String(house.shipment_terms_code)
                : house.shipment_terms_name
                  ? String(house.shipment_terms_name)
                  : "",
              pp_cc: resolveFreightPpCc(house.pp_cc, house.freight),
              cargo_details:
                house.cargo_details && Array.isArray(house.cargo_details)
                  ? house.cargo_details.map(
                      (cargo: Record<string, unknown>) => ({
                        no_of_packages: cargo.no_of_packages as number | null,
                        gross_weight: importHouseCargoWeightFromApi(
                          cargo.gross_weight,
                        ),
                        volume: importHouseCargoWeightFromApi(cargo.volume),
                        chargeable_weight: importHouseCargoWeightFromApi(
                          cargo.chargeable_weight,
                        ),
                        haz: cargo.haz ? String(cargo.haz) : "",
                      }),
                    )
                  : [],
              charges: (() => {
                const chargesArray = (house.charges || house.mawb_charges) as
                  Record<string, unknown>[] | undefined;
                if (chargesArray && Array.isArray(chargesArray)) {
                  const toNum = (v: unknown): number | null => {
                    if (v == null) return null;
                    if (typeof v === "number" && !Number.isNaN(v)) return v;
                    const n = parseFloat(String(v));
                    return Number.isNaN(n) ? null : n;
                  };
                  return chargesArray.map((charge: Record<string, unknown>) => {
                    const unitDetails = charge.unit_details as
                      { unit_code?: string; unit_id?: number } | undefined;
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
                      supplier_code:
                        charge.supplier_code != null
                          ? String(charge.supplier_code)
                          : "",
                      supplier_name:
                        charge.supplier_name != null
                          ? String(charge.supplier_name)
                          : "",
                      charge_id: chargeId,
                      charge_name: charge.charge_name
                        ? String(charge.charge_name)
                        : "",
                      pp_cc: charge.pp_cc ? String(charge.pp_cc) : "",
                      unit_id: unitId,
                      unit_code: unitCode,
                      currency_id: currencyId,
                      currency,
                      no_of_unit: toNum(charge.no_of_unit),
                      roe: toNum(charge.roe),
                      amount_per_unit: toNum(charge.amount_per_unit),
                      amount: toNum(charge.amount),
                      sell_local_amount: toNum(
                        charge.sell_local_amount ?? charge.local_amount,
                      ),
                      unit_cost: toNum(
                        charge.unit_cost ?? charge.cost_per_unit,
                      ),
                      total_cost: toNum(charge.total_cost),
                      cost_local_amount: toNum(charge.cost_local_amount),
                    };
                  });
                }
                return [];
              })(),
              summary: (() => {
                const raw = house.summary;
                if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
                  return undefined;
                }
                const s = raw as Record<string, unknown>;
                return {
                  total_local_sell: s.total_local_sell as
                    number | string | null | undefined,
                  total_local_cost: s.total_local_cost as
                    number | string | null | undefined,
                };
              })(),
              ...extractHouseDocumentFields(house),
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
                ...(routing.id != null && { id: Number(routing.id) }),
                transport_type: String(
                  routing.transport_type ?? "",
                ).toUpperCase(),
                from_code: String(
                  routing.from_port_code ?? routing.from_code ?? "",
                ),
                from_name: String(
                  routing.from_port_name ?? routing.from_name ?? "",
                ),
                to_code: String(routing.to_port_code ?? routing.to_code ?? ""),
                to_name: String(routing.to_port_name ?? routing.to_name ?? ""),
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
                carrier_code: String(routing.carrier_code ?? ""),
                carrier_name: String(routing.carrier_name ?? ""),
                vessel: String(routing.vessel ?? ""),
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
                ...(routing.id != null && { id: Number(routing.id) }),
                transport_type: String(
                  routing.transport_type ?? "",
                ).toUpperCase(),
                from_code: String(
                  routing.from_port_code ?? routing.from_code ?? "",
                ),
                from_name: String(
                  routing.from_port_name ?? routing.from_name ?? "",
                ),
                to_code: String(routing.to_port_code ?? routing.to_code ?? ""),
                to_name: String(routing.to_port_name ?? routing.to_name ?? ""),
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
                carrier_code: String(routing.carrier_code ?? ""),
                carrier_name: String(routing.carrier_name ?? ""),
                vessel: String(routing.vessel ?? ""),
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
        console.log(
          "✅ Routings initialized - Form values after setValues:",
          routingsForm.values,
        );
        // Note: Container Details are not used for Inland Export Jobs

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
          console.log(
            "🧾 [AIR_EXPORT_JOB] mappedEstimates (before setValues)",
            {
              mappedEstimates,
            },
          );

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

          console.log(
            "🧾 [AIR_EXPORT_JOB] estimatesForm.setFieldValue applied",
            {
              sanitizedEstimates,
            },
          );
        }
        if (!location.state?.fromHouseCreate) {
          jobDocuments.initFromJobData(jobData as Record<string, unknown>);
        }
        // Force re-render of SearchableSelect components after all values are set
        // Use a small delay to ensure setValues has completed
        formsInitializedFromJobDataRef.current = true;
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
      formsInitializedFromJobDataRef.current = false;
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
      const normalizedTransportType = String(
        routing.transport_type || "",
      ).toUpperCase();
      // Check if any mandatory routing field has a non-empty value
      const transportType = normalizedTransportType.trim();
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
      }
      // If hasAnyMandatoryValue is false, skip validation for this routing (allow empty)
    }
    return true;
  };

  const validateEstimates = () => {
    const rows = estimatesForm.values.estimates ?? [];
    estimatesForm.clearErrors();

    const rowHasAnyValue = (e: (typeof rows)[number]) => {
      return (
        !!e.supplier_code ||
        !!e.supplier_name ||
        e.charge_id != null ||
        !!e.charge_name ||
        !!e.pp_cc ||
        !!e.unit_id ||
        !!e.currency_id ||
        e.no_of_unit != null ||
        e.roe != null ||
        e.cost_per_unit != null ||
        e.total_cost != null
      );
    };

    for (let i = 0; i < rows.length; i++) {
      const e = rows[i];
      if (!rowHasAnyValue(e)) continue;

      const missing: Array<{ key: keyof typeof e; label: string }> = [];
      if (e.charge_id == null)
        missing.push({ key: "charge_id", label: "Charge" });
      if (!String(e.pp_cc ?? "").trim())
        missing.push({ key: "pp_cc", label: "Prepaid / Collect" });
      if (!String(e.unit_id ?? "").trim())
        missing.push({ key: "unit_id", label: "Unit" });
      if (e.no_of_unit == null)
        missing.push({ key: "no_of_unit", label: "No of Unit" });
      if (!String(e.currency_id ?? "").trim())
        missing.push({ key: "currency_id", label: "Currency" });
      if (e.roe == null) missing.push({ key: "roe", label: "ROE" });
      if (e.cost_per_unit == null)
        missing.push({ key: "cost_per_unit", label: "Cost / Unit" });
      if (e.total_cost == null)
        missing.push({ key: "total_cost", label: "Total Cost" });

      if (missing.length > 0) {
        missing.forEach((m) => {
          estimatesForm.setFieldError(
            `estimates.${i}.${String(m.key)}`,
            `${m.label} is required`,
          );
        });
        ToastNotification({
          type: "error",
          message: "Please fill all mandatory fields in Estimates row",
        });
        return false;
      }
    }

    return true;
  };

  // Handle next step
  const handleNext = () => {
    if (active === 0) {
      if (validateStep1()) {
        navigate(location.pathname, {
          replace: true,
          state: {
            ...location.state,
            mawbDetails: getMawbDetailsSnapshot(),
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
        setActive(1);
      }
    } else if (active === 1) {
      setActive(2);
    } else if (active === 2) {
      if (validateStep2()) {
        navigate(location.pathname, {
          replace: true,
          state: {
            ...location.state,
            mawbDetails: getMawbDetailsSnapshot(),
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
        setActive(3);
      }
    } else if (active === 3) {
      navigate(location.pathname, {
        replace: true,
        state: {
          ...location.state,
          mawbDetails: getMawbDetailsSnapshot(),
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
          mawbDetails: getMawbDetailsSnapshot(),
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
              service_code: savedMawbDetails.service_code,
              is_direct: savedMawbDetails.is_direct,
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
            service_code: savedMawbDetails.service_code || "",
            service_name: savedMawbDetails.service_name || "",
            pp_cc: resolveFreightPpCc(
              (savedMawbDetails as { pp_cc?: string }).pp_cc,
            ),
            note: String((savedMawbDetails as { note?: unknown })?.note ?? ""),
            is_direct: parseBoolean(savedMawbDetails.is_direct),
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
            shipper_id:
              (savedMawbDetails as { shipper_id?: string } | undefined)
                ?.shipper_id || "",
            shipper_name:
              (savedMawbDetails as { shipper_name?: string } | undefined)
                ?.shipper_name || "",
            shipper_email:
              (savedMawbDetails as { shipper_email?: string } | undefined)
                ?.shipper_email || "",
            shipper_address_id:
              (savedMawbDetails as { shipper_address_id?: string } | undefined)
                ?.shipper_address_id || "",
            shipper_address:
              (savedMawbDetails as { shipper_address?: string } | undefined)
                ?.shipper_address || "",
            consignee_id:
              (savedMawbDetails as { consignee_id?: string } | undefined)
                ?.consignee_id || "",
            consignee_name:
              (savedMawbDetails as { consignee_name?: string } | undefined)
                ?.consignee_name || "",
            consignee_email:
              (savedMawbDetails as { consignee_email?: string } | undefined)
                ?.consignee_email || "",
            consignee_address_id:
              (
                savedMawbDetails as
                  { consignee_address_id?: string } | undefined
              )?.consignee_address_id || "",
            consignee_address:
              (savedMawbDetails as { consignee_address?: string } | undefined)
                ?.consignee_address || "",
            carrier_agent_id:
              (savedMawbDetails as { carrier_agent_id?: string } | undefined)
                ?.carrier_agent_id || "",
            carrier_agent_name:
              (savedMawbDetails as { carrier_agent_name?: string } | undefined)
                ?.carrier_agent_name || "",
            carrier_agent_email:
              (savedMawbDetails as { carrier_agent_email?: string } | undefined)
                ?.carrier_agent_email || "",
            carrier_agent_address_id:
              (
                savedMawbDetails as
                  { carrier_agent_address_id?: string } | undefined
              )?.carrier_agent_address_id || "",
            carrier_agent_address:
              (
                savedMawbDetails as
                  { carrier_agent_address?: string } | undefined
              )?.carrier_agent_address || "",
          });

          // Update origin agent data ref if available in location state
          if (savedMawbDetails.agent_data) {
            originAgentDataRef.current = savedMawbDetails.agent_data as Record<
              string,
              unknown
            >;
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
        Array.isArray(location.state.routings) &&
        location.state.routings.length > 0
      ) {
        const mappedRoutingsFromState = location.state.routings.map(
          (routing: Record<string, unknown>) => ({
            ...(routing.id != null && { id: Number(routing.id) }),
            transport_type: String(routing.transport_type ?? "").toUpperCase(),
            from_code: String(
              routing.from_port_code ?? routing.from_code ?? "",
            ),
            from_name: String(
              routing.from_port_name ?? routing.from_name ?? "",
            ),
            to_code: String(routing.to_port_code ?? routing.to_code ?? ""),
            to_name: String(routing.to_port_name ?? routing.to_name ?? ""),
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
            carrier_code: String(routing.carrier_code ?? ""),
            carrier_name: String(routing.carrier_name ?? ""),
            vessel: String(routing.vessel ?? ""),
            flight: routing.flight ? String(routing.flight) : "",
            voyage_number: routing.voyage_number
              ? String(routing.voyage_number)
              : "",
            truck_no: routing.truck_no ? String(routing.truck_no) : "",
            rail_no: routing.rail_no ? String(routing.rail_no) : "",
          }),
        );
        routingsForm.setValues({ routings: mappedRoutingsFromState });
        routingStateInitializedRef.current = true;
        // Reset routingStateInitializedRef to allow restoration on next navigation back from HAWB
        // routingStateInitializedRef.current = false;
      }

      // Restore estimates when coming back from HAWB screen
      if (
        hasMawbDetailsInState &&
        location.state?.estimates &&
        Array.isArray(location.state.estimates) &&
        location.state.estimates.length > 0
      ) {
        estimatesForm.setFieldValue(
          "estimates",
          location.state.estimates as typeof estimatesForm.values.estimates,
        );
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
    location.state?.estimates,
    active, // Add active to dependencies to restore when navigating back to step 0
    mode, // Add mode to dependencies
  ]);

  useEffect(() => {
    if (location.state?.fromHouseCreate === true) {
      jobDocuments.restoreFromNavigationState(location.state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.state?.fromHouseCreate,
    location.state?.document_ids,
    location.state?.document_display_list,
    location.state?.document_modal_rows,
  ]);

  // Note: Container details restoration removed for Inland Export Jobs

  // Remove housing detail
  const removeHawbDetail = (index: number) => {
    const updated = hawbDetails.filter((_, i) => i !== index);
    setHawbDetails(updated);
  };

  // Helper function to navigate to HAWBCreate
  const navigateToHawbCreate = useCallback(
    (
      editIndex?: number,
      editData?: HAWBDetail,
      options?: { openEventsModal?: boolean },
    ) => {
      // Prevent multiple navigations
      if (navigationInProgressRef.current) {
        console.log("⚠️ Navigation already in progress, skipping...");
        return;
      }

      // Validate MAWB mandatory fields before navigating
      const missingFields: string[] = [];

      if (!mawbDetailsForm.values.service_code?.trim()) {
        missingFields.push("Service");
      }
      if (
        !mawbDetailsForm.values.is_direct &&
        !mawbDetailsForm.values.agent_code?.trim()
      ) {
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
      routingStateInitializedRef.current = false;

      const mawbDetailsToPass = getMawbDetailsSnapshot();

      console.log("🚀 Navigating to HAWBCreate with mawbDetails:", {
        mawbDetailsToPass,
        agent_data: mawbDetailsToPass.agent_data,
        hasAddressesData: mawbDetailsToPass.agent_data?.addresses_data,
        fromRef: !!originAgentDataRef.current,
        fromLocationState: !!location.state?.mawbDetails?.agent_data,
      });

      navigate("/inland/export-job/house-create", {
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
          ...jobDocuments.getNavigationState(),
          ...(options?.openEventsModal && { openEventsModal: true }),
        },
      });

      // Reset navigation flag after a short delay
      setTimeout(() => {
        navigationInProgressRef.current = false;
      }, 1000);
    },
    [
      getMawbDetailsSnapshot,
      carrierDetailsForm.values,
      routingsForm.values.routings,
      estimatesForm.values.estimates,
      hawbDetails,
      jobData,
      location.state,
      navigate,
      jobDocuments,
    ],
  );

  // Handle edit HAWB detail
  const handleEditHawbDetail = (index: number) => {
    const hawbToEdit = hawbDetails[index];
    navigateToHawbCreate(index, hawbToEdit);
  };

  const handleOpenHouseEvents = (index: number) => {
    navigateToHawbCreate(index, hawbDetails[index], { openEventsModal: true });
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

  // Check if all requirements are met for Create button
  const canCreateJob = useMemo(() => {
    // Check MAWB mandatory fields
    const destinationAgentValid = mawbDetailsForm.values.is_direct
      ? true
      : !!mawbDetailsForm.values.agent_code?.trim();

    const mawbFieldsValid =
      mawbDetailsForm.values.service_code?.trim() &&
      destinationAgentValid &&
      mawbDetailsForm.values.origin_code?.trim() &&
      mawbDetailsForm.values.destination_code?.trim() &&
      mawbDetailsForm.values.etd &&
      mawbDetailsForm.values.eta;

    // Check at least one HAWB detail is added
    const hasHawbDetails = hawbDetails.length > 0;

    return mawbFieldsValid && hasHawbDetails;
  }, [
    mawbDetailsForm.values.service_code,
    mawbDetailsForm.values.is_direct,
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
        message: "At least one AWB detail is required before creating job",
      });
      return false;
    }

    // Validate each HAWB detail has mandatory fields
    for (let i = 0; i < hawbDetails.length; i++) {
      const hawb = hawbDetails[i];
      const missingFields: string[] = [];

      // Step 1 validations
      if (!hawb.hawb_number?.trim()) {
        missingFields.push("AWB Number");
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
          message: `AWB ${i + 1} is missing required fields: ${missingFields.join(", ")}`,
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
    if (mawbDetailsForm.values.is_direct) {
      mawbDetailsForm.clearFieldError("agent_code");
    }
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

    if (!validateEstimates()) {
      setIsSubmitting(false);
      return;
    }

    if (estimatesRoeValidateRef.current?.() === false) {
      setIsSubmitting(false);
      return;
    }
    try {
      const payload = {
        ...buildInlandExportJobServicePayload(
          mawbDetailsForm.values.service_code,
        ),
        pp_cc: mawbDetailsForm.values.pp_cc || "Collect",
        note: mawbDetailsForm.values.note || "",
        is_direct: mawbDetailsForm.values.is_direct,
        agent: mawbDetailsForm.values.agent_code?.trim() || null,
        origin_code: mawbDetailsForm.values.origin_code,
        destination_code: mawbDetailsForm.values.destination_code,
        etd: formatLocalDateTime(mawbDetailsForm.values.etd) ?? "",
        eta: formatLocalDateTime(mawbDetailsForm.values.eta) ?? "",
        atd: formatLocalDateTime(mawbDetailsForm.values.atd),
        ata: formatLocalDateTime(mawbDetailsForm.values.ata),
        carrier_code: carrierDetailsForm.values.carrier_code,
        voyage_number: carrierDetailsForm.values.flight_number || null,
        mbl_date: carrierDetailsForm.values.mawb_date
          ? dayjs(carrierDetailsForm.values.mawb_date).isValid()
            ? dayjs(carrierDetailsForm.values.mawb_date).format("YYYY-MM-DD")
            : null
          : null,
        flightno: carrierDetailsForm.values.flight_number || null,
        mawb_no: carrierDetailsForm.values.mawb_number || null,
        shipper_name: partyDetailsForm.values.shipper_name || "",
        shipper_email: partyDetailsForm.values.shipper_email || "",
        shipper_address: partyDetailsForm.values.shipper_address || "",
        consignee_name: partyDetailsForm.values.consignee_name || "",
        consignee_email: partyDetailsForm.values.consignee_email || "",
        consignee_address: partyDetailsForm.values.consignee_address || "",
        carrier_agent_name: partyDetailsForm.values.carrier_agent_name || "",
        carrier_agent_email: partyDetailsForm.values.carrier_agent_email || "",
        carrier_agent_address:
          partyDetailsForm.values.carrier_agent_address || "",
        ocean_routings: routingsForm.values.routings.map((routing) => {
          const normalizedTransportType = String(
            routing.transport_type || "",
          ).toUpperCase();
          // New format: all fields are nullable
          const routingPayload: Record<string, unknown> = {
            // Include id if it exists (for edit mode) - handle id === 0 as valid
            ...(routing.id !== undefined &&
              routing.id !== null &&
              routing.id !== ("" as unknown) && { id: Number(routing.id) }),
            transport_type: normalizedTransportType || null,
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
          if (normalizedTransportType === "SEA") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.vessel = routing.vessel || null;
            routingPayload.voyage_number = routing.voyage_number || null;
          } else if (normalizedTransportType === "AIR") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.flight = routing.flight || null;
          } else if (normalizedTransportType === "ROAD") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.truck_no = routing.truck_no || null;
          } else if (normalizedTransportType === "RAIL") {
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
          // Only send positive ids (avoid id: 0 which backend may mishandle)
          ...(Number(hawb.id) > 0 && { id: Number(hawb.id) }),
          hawb_no: hawb.hawb_number,
          pp_cc: resolveFreightPpCc(
            hawb.pp_cc,
            (hawb as { freight?: string }).freight,
          ),
          routed: hawb.routed,
          routed_by: hawb.routed_by || null,
          origin_code: hawb.origin_code,
          destination_code: hawb.destination_code,
          customer_service: hawb.customer_service || "",
          trade: hawb.trade,
          agent_name: hawb.agent_name,
          agent_address: hawb.agent_address || "",
          agent_email: hawb.agent_email || "",
          cha_name: (hawb as { cha_name?: string }).cha_name || null,
          cha_address: (hawb as { cha_address?: string }).cha_address || null,
          shipper_code: hawb.shipper_code,
          shipper_name: hawb.shipper_name,
          shipper_address: hawb.shipper_address || "",
          shipper_email: hawb.shipper_email || "",
          consignee_code: hawb.consignee_code,
          consignee_name: hawb.consignee_name,
          consignee_address: hawb.consignee_address || "",
          consignee_email: hawb.consignee_email || "",
          notify1_customer_name:
            hawb.notify1_customer_name ?? hawb.notify_customer1_name ?? "",
          notify1_customer_address:
            hawb.notify1_customer_address ??
            hawb.notify_customer1_address ??
            "",
          notify1_customer_email:
            hawb.notify1_customer_email ?? hawb.notify_customer1_email ?? "",
          notify2_customer_name: hawb.notify2_customer_name ?? "",
          notify2_customer_address: hawb.notify2_customer_address ?? "",
          notify2_customer_email: hawb.notify2_customer_email ?? "",
          commodity_description: hawb.commodity_description || null,
          marks_no: hawb.marks_no || null,
          note: hawb.note || "",
          item_no: (hawb as { item_no?: string }).item_no ?? "",
          sub_item_no: (hawb as { sub_item_no?: string }).sub_item_no ?? "",
          ref_no: (hawb as { ref_no?: string }).ref_no ?? "",
          ...(hawb.shipment_terms_code != null &&
            hawb.shipment_terms_code !== "" && {
              shipment_terms_code: hawb.shipment_terms_code,
            }),
          ...buildDocumentIdsPayloadField(hawb.document_ids),
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
          cargo_details: (hawb.cargo_details || []).map((c) => ({
            ...(c.id != null && { id: Number(c.id) }),
            no_of_packages: c.no_of_packages ?? 0,
            gross_weight:
              formatHouseCargoWeightForPayload(c.gross_weight) ?? "",
            volume: formatHouseCargoWeightForPayload(c.volume) ?? "",
            chargeable_weight:
              formatHouseCargoChargeableForPayload(
                c.gross_weight,
                c.volume,
                "air",
              ) ?? "",
            haz: c.haz === "Yes" || String(c.haz).toLowerCase() === "true",
          })),
          mawb_charges: (() => {
            const meaningful = getMeaningfulHouseCharges(hawb.charges ?? []);
            if (meaningful.length === 0) return [];
            return meaningful.map((charge) => ({
              ...(charge.id != null &&
                charge.id !== undefined && { id: Number(charge.id) }),
              charge_id: charge.charge_id ?? null,
              supplier_code:
                charge.supplier_code != null
                  ? String(charge.supplier_code)
                  : null,
              pp_cc: charge.pp_cc || "",
              unit_id: charge.unit_id ? String(charge.unit_id) : "",
              no_of_unit: roundToDecimals(charge.no_of_unit) || null,
              currency_id: charge.currency_id ? String(charge.currency_id) : "",
              roe: roundRoeForPayload(charge.roe) ?? null,
              amount_per_unit:
                roundMoneyToDecimals(charge.amount_per_unit) ?? null,
              amount: roundMoneyToDecimals(charge.amount) ?? null,
              sell_local_amount:
                roundMoneyToDecimals(charge.sell_local_amount) ??
                roundMoneyToDecimals(charge.local_amount) ??
                null,
              unit_cost:
                roundMoneyToDecimals(charge.unit_cost) ??
                roundMoneyToDecimals(charge.cost_per_unit) ??
                null,
              total_cost: roundMoneyToDecimals(charge.total_cost) ?? null,
              cost_local_amount:
                roundMoneyToDecimals(charge.cost_local_amount) ?? null,
            }));
          })(),
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
            no_of_unit: roundToDecimals(e.no_of_unit) ?? null,
            currency_id: e.currency_id ? Number(e.currency_id) : null,
            roe: roundRoeForPayload(e.roe) ?? null,
            cost_per_unit: roundMoneyToDecimals(e.cost_per_unit) ?? null,
            total_cost: roundMoneyToDecimals(e.total_cost) ?? null,
          }));
        })(),
        document_ids: jobDocuments.document_ids,
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
        message: `Inland Export Job ${mode === "edit" ? "updated" : "created"} successfully`,
      });

      // Clear hawb details from state when navigating and trigger refetch
      navigate("/inland/export-job", {
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
        <Group gap="md">
          <EditPageHeadingRow
            visible={(mode === "edit" || mode === "view") && !!jobData}
            auditSource={jobData}
            animateKey={jobData?.id}
            ariaLabel="Inland export job audit info"
            justify="flex-start"
          >
            <Text size="xl" fw={600} c="#105476">
              {mode === "view"
                ? "View Export Job"
                : mode === "edit"
                  ? "Edit Export Job"
                  : "Create Export Job"}
            </Text>
          </EditPageHeadingRow>
          {jobData?.job_id && (
            <Badge color="#105476" radius="md" size="md">
              {jobData?.job_id ? `Job ID: ${jobData.job_id}` : ""}
            </Badge>
          )}
        </Group>
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
              <Menu
                shadow="md"
                width={JOB_HOUSE_ACTION_MENU_WIDTH}
                position="bottom-end"
              >
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

                      navigate("/inland/export-job/invoice", {
                        state: {
                          serviceType: "AIR",
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
                    Create Agent Invoice
                  </Menu.Item>

                  {jobData?.id != null && (
                    <AutomateVendorInvoiceTrigger
                      variant="menu"
                      shipmentNo={getMasterShipmentNo(jobData)}
                      onOpen={openVendorInvoiceAutomation}
                    />
                  )}

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
                      navigate("/job-ledger", {
                        state: {
                          jobId: jobData?.job_id,
                          service_name: "Air Export",
                          jobReturnTo: location.pathname,
                          jobReturnToState: location.state,
                        },
                      });
                    }}
                  >
                    Job Ledger
                  </Menu.Item>

                  {/* <Menu.Item
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
                          serviceType: "AIR",
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
                  </Menu.Item> */}
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
            Estimates
          </Tabs.Tab>
          {jobData?.id != null && (
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
                  placeholder="Select service"
                  searchable
                  data={inlandServiceOptions}
                  value={mawbDetailsForm.values.service_code || null}
                  onChange={(value) => {
                    const code = value ?? "";
                    const selected = inlandExportServices.find(
                      (item) => item.service_code === code,
                    );
                    mawbDetailsForm.setFieldValue("service_code", code);
                    mawbDetailsForm.setFieldValue(
                      "service_name",
                      selected?.service_name || code,
                    );
                  }}
                  error={mawbDetailsForm.errors.service_code as string}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SearchableSelect
                  key={`origin-agent-${formInitializedKey}`}
                  label="Destination Agent"
                  required={!mawbDetailsForm.values.is_direct}
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
                    mawbDetailsForm.setFieldValue(
                      "agent_name",
                      selectedData?.label || "",
                    );

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

              <Grid.Col span={3}>
                <FormTextArea
                  label="Note/Remark"
                  placeholder="Enter note / remark"
                  minRows={2}
                  size="sm"
                  {...mawbDetailsForm.getInputProps("note")}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <Dropdown
                  label="Freight"
                  placeholder="Select Freight"
                  searchable
                  data={[
                    { value: "Prepaid", label: "Prepaid" },
                    { value: "Collect", label: "Collect" },
                  ]}
                  value={mawbDetailsForm.values.pp_cc || null}
                  disabled={isReadOnly}
                  onChange={(value) => {
                    mawbDetailsForm.setFieldValue(
                      "pp_cc",
                      value || "Collect",
                    );
                  }}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <Radio.Group
                  label="Direct"
                  value={mawbDetailsForm.values.is_direct ? "true" : "false"}
                  onChange={(value) => {
                    const isDirect = value === "true";
                    const previousIsDirect = mawbDetailsForm.values.is_direct;
                    mawbDetailsForm.setFieldValue("is_direct", isDirect);

                    // If switching to "Yes" (Direct=true), Destination Agent becomes optional.
                    // Clear any previously entered/selected Destination Agent value.
                    if (isDirect && !previousIsDirect) {
                      mawbDetailsForm.clearFieldError("agent_code");
                      mawbDetailsForm.setFieldValue("agent_code", "");
                      mawbDetailsForm.setFieldValue("agent_name", "");
                      originAgentDataRef.current = null;
                    } else if (isDirect) {
                      // Even if value doesn't change, ensure the select isn't blocked by stale errors.
                      mawbDetailsForm.clearFieldError("agent_code");
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
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <FormTextInput
                  label="Truck Number"
                  required
                  placeholder="Enter truck number"
                  {...carrierDetailsForm.getInputProps("flight_number")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <FormTextInput
                  label="AWB Number"
                  required
                  placeholder="Enter AWB number"
                  maxLength={11}
                  {...carrierDetailsForm.getInputProps("mawb_number")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <SingleDateInput
                  label="AWB Date"
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

        <Tabs.Panel value="1">
          <Box mt="md">
            <JobMasterPartyDetailsPanel
              idPrefix="air-export-party"
              partyDetailsForm={
                partyDetailsForm as unknown as UseFormReturnType<JobMasterPartyDetailsValues>
              }
              shipperAddressOptions={shipperAddressOptions}
              setShipperAddressOptions={setShipperAddressOptions}
              consigneeAddressOptions={consigneeAddressOptions}
              setConsigneeAddressOptions={setConsigneeAddressOptions}
              carrierAgentAddressOptions={carrierAgentAddressOptions}
              setCarrierAgentAddressOptions={setCarrierAgentAddressOptions}
              shipperAddressSearch={shipperAddressSearch}
              setShipperAddressSearch={setShipperAddressSearch}
              consigneeAddressSearch={consigneeAddressSearch}
              setConsigneeAddressSearch={setConsigneeAddressSearch}
              carrierAgentAddressSearch={carrierAgentAddressSearch}
              setCarrierAgentAddressSearch={setCarrierAgentAddressSearch}
              shipperAddressCustom={shipperAddressCustom}
              setShipperAddressCustom={setShipperAddressCustom}
              consigneeAddressCustom={consigneeAddressCustom}
              setConsigneeAddressCustom={setConsigneeAddressCustom}
              carrierAgentAddressCustom={carrierAgentAddressCustom}
              setCarrierAgentAddressCustom={setCarrierAgentAddressCustom}
            />
          </Box>
        </Tabs.Panel>

        {/* Tab 3: Routings */}
        <Tabs.Panel value="2">
          <Box mt="md">
            <Text size="lg" fw={600} c="#105476" mb="md">
              Routings
            </Text>

            <Stack gap="xl">
              {routingsForm.values.routings.map((routing, index) => {
                const routingTransportType = String(
                  routing.transport_type || "",
                ).toUpperCase();
                const requireRouting = Boolean(
                  String(routing.transport_type ?? "").trim() ||
                  String(routing.from_code ?? "").trim() ||
                  String(routing.to_code ?? "").trim() ||
                  String(routing.carrier_code ?? "").trim() ||
                  String(routing.carrier_name ?? "").trim() ||
                  String(routing.vessel ?? "").trim() ||
                  String(routing.flight ?? "").trim() ||
                  String(routing.voyage_number ?? "").trim() ||
                  String(routing.truck_no ?? "").trim() ||
                  String(routing.rail_no ?? "").trim() ||
                  routing.etd != null ||
                  routing.eta != null,
                );
                return (
                  <Box key={`${index}-${formInitializedKey}`}>
                    <Grid>
                      <Grid.Col span={2.5}>
                        <Dropdown
                          label="Transport Type"
                          required={requireRouting}
                          placeholder="Select Transport Type"
                          searchable
                          clearable
                          data={["AIR", "SEA", "ROAD", "RAIL"]}
                          value={
                            routingsForm.values.routings[index]
                              ?.transport_type || null
                          }
                          onChange={(value) => {
                            const oldTransportType =
                              routingsForm.values.routings[index]
                                ?.transport_type;
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
                          required={requireRouting}
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
                            getTransportMode(routingTransportType)
                              ? {
                                  transport_mode:
                                    getTransportMode(routingTransportType)!,
                                }
                              : undefined
                          }
                        />
                      </Grid.Col>

                      <Grid.Col span={2.5}>
                        <SearchableSelect
                          label="To"
                          required={requireRouting}
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
                            getTransportMode(routingTransportType)
                              ? {
                                  transport_mode:
                                    getTransportMode(routingTransportType)!,
                                }
                              : undefined
                          }
                        />
                      </Grid.Col>

                      {/* Dynamic field labels based on transport type */}
                      {routingTransportType === "SEA" && (
                        <>
                          <Grid.Col span={2}>
                            <SearchableSelect
                              label="Carrier"
                              apiEndpoint={URL.carrier}
                              placeholder="Type carrier name"
                              searchFields={["carrier_code", "carrier_name"]}
                              displayFormat={(
                                item: Record<string, unknown>,
                              ) => ({
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
                                getTransportMode(routingTransportType)
                                  ? {
                                      transport_mode:
                                        getTransportMode(routingTransportType)!,
                                    }
                                  : undefined
                              }
                            />
                          </Grid.Col>

                          <Grid.Col span={2}>
                            <FormTextInput
                              label="Vessel"
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
                              placeholder="Enter voyage number"
                              {...routingsForm.getInputProps(
                                `routings.${index}.voyage_number`,
                              )}
                            />
                          </Grid.Col>
                        </>
                      )}

                      {routingTransportType === "AIR" && (
                        <>
                          <Grid.Col span={2}>
                            <SearchableSelect
                              label="Carrier"
                              apiEndpoint={URL.carrier}
                              placeholder="Type carrier name"
                              searchFields={["carrier_code", "carrier_name"]}
                              displayFormat={(
                                item: Record<string, unknown>,
                              ) => ({
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
                                getTransportMode(routingTransportType)
                                  ? {
                                      transport_mode:
                                        getTransportMode(routingTransportType)!,
                                    }
                                  : undefined
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={2.5}>
                            <FormTextInput
                              label="Flight Number"
                              placeholder="Enter flight number"
                              {...routingsForm.getInputProps(
                                `routings.${index}.flight`,
                              )}
                            />
                          </Grid.Col>
                        </>
                      )}

                      {routingTransportType === "ROAD" && (
                        <>
                          <Grid.Col span={2}>
                            <SearchableSelect
                              label="Carrier"
                              apiEndpoint={URL.carrier}
                              placeholder="Type carrier name"
                              searchFields={["carrier_code", "carrier_name"]}
                              displayFormat={(
                                item: Record<string, unknown>,
                              ) => ({
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
                                getTransportMode(routingTransportType)
                                  ? {
                                      transport_mode:
                                        getTransportMode(routingTransportType)!,
                                    }
                                  : undefined
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={2.5}>
                            <FormTextInput
                              label="Truck Number"
                              placeholder="Enter truck number"
                              {...routingsForm.getInputProps(
                                `routings.${index}.truck_no`,
                              )}
                            />
                          </Grid.Col>
                        </>
                      )}

                      {routingTransportType === "RAIL" && (
                        <>
                          <Grid.Col span={2}>
                            <FormTextInput
                              label="Carrier"
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
                          withAsterisk={requireRouting}
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
                          withAsterisk={requireRouting}
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
                      {!isReadOnly &&
                        routingsForm.values.routings.length > 1 && (
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
                );
              })}
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Tab 4: Estimates */}
        <Tabs.Panel value="3">
          <Box mt="md">
            <Group justify="space-between" align="center" mb="md" wrap="nowrap">
              <Text size="lg" fw={600} c="#105476">
                Estimates
              </Text>
              <Group gap="xs" wrap="nowrap">
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
                          message:
                            "Job ID not found for Supplier Invoice prefill.",
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
                          supplier_code: toStr(e.supplier_code),
                          supplier_name: toStr(e.supplier_name),
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

                      const houseCharges = (hawbDetails ?? [])
                        .flatMap((h) => {
                          const rec = h as unknown as Record<string, unknown>;
                          const shipmentNo = toStr((rec as any).shipment_id);
                          const chargesArr = Array.isArray((rec as any).charges)
                            ? ((rec as any).charges as unknown[])
                            : Array.isArray((rec as any).mawb_charges)
                              ? ((rec as any).mawb_charges as unknown[])
                              : [];
                          return chargesArr
                            .map((c) => {
                              const cr = c as Record<string, unknown>;
                              return {
                                shipment_no: shipmentNo,
                                charge_id:
                                  cr.charge_id != null
                                    ? Number(cr.charge_id)
                                    : null,
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

                {mode === "edit" && !isReadOnly && (
                  <AutomateVendorInvoiceTrigger
                    variant="button"
                    shipmentNo={getMasterShipmentNo(jobData)}
                    onOpen={openVendorInvoiceAutomation}
                  />
                )}

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
                    const firstSupplier =
                      estimates.find(
                        (e) =>
                          String(e.supplier_code ?? "").trim() !== "" ||
                          String(e.supplier_name ?? "").trim() !== "",
                      ) ?? null;
                    navigate("/payment-request/create", {
                      state: {
                        serviceType: "AIR",
                        chargesFromEstimates:
                          chargesFromEstimates.length > 0
                            ? chargesFromEstimates
                            : undefined,
                        supplier:
                          firstSupplier != null
                            ? {
                                supplier_code: String(
                                  firstSupplier.supplier_code ?? "",
                                ),
                                supplier_name: String(
                                  firstSupplier.supplier_name ?? "",
                                ),
                              }
                            : null,
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
            </Group>
            <EstimatesSection
              serviceType="AIR"
              key={`estimates-${formInitializedKey}`}
              form={estimatesForm}
              readOnly={isReadOnly}
              defaultPpCc="Prepaid"
              roeSubmitValidateRef={estimatesRoeValidateRef}
              conditionalRequired
              debugTag="AIR_EXPORT_JOB"
              summaryEstimatesTotalCost={
                (jobData as { summary?: { estimates_total_cost?: unknown } })
                  ?.summary?.estimates_total_cost
              }
              userBranches={user?.branches}
            />
          </Box>
        </Tabs.Panel>

        {jobData?.id != null && (
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
                          Document Number
                        </Table.Th>
                        <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                          Party Name
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
                          <Table.Td colSpan={7}>
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
                          const rowKey = `${row.id}-${idx}`;
                          const isExpanded = expandedInvoiceRowId === rowKey;
                          const reverseInvoices = row.reverse_invoices ?? [];
                          const hasReverseInvoices = reverseInvoices.length > 0;
                          const invoiceViewId = row.invoice_id ?? row.id;
                          return (
                            <Fragment key={rowKey}>
                              <Table.Tr
                                style={
                                  hasReverseInvoices
                                    ? { cursor: "pointer" }
                                    : undefined
                                }
                                onClick={(e) => {
                                  if (
                                    (e.target as HTMLElement).closest(
                                      "[data-menu-dropdown],[button]",
                                    )
                                  )
                                    return;
                                  if (!hasReverseInvoices) {
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
                                    {hasReverseInvoices && (
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
                                  style={{ fontSize: "13px", width: "20%" }}
                                >
                                  {row.bill_to_name ?? "-"}
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
                                    color={getInvoiceStatusBadgeColor(
                                      row.status,
                                    )}
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
                                            `/inland/export-job/invoice/view/${invoiceViewId}`,
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
                                        <>
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
                                                `/inland/export-job/invoice/edit/${row.invoice_id}`,
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
                                          <JobInvoiceDeleteMenuItem
                                            disabled={
                                              invoiceDeletingId ===
                                              invoiceViewId
                                            }
                                            onDelete={() =>
                                              requestDeleteInvoice(
                                                invoiceViewId as number,
                                              )
                                            }
                                          />
                                        </>
                                      ) : isPosted ? (
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
                                              "/inland/export-job/invoice/reverse",
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
                                      ) : null}
                                    </Menu.Dropdown>
                                  </Menu>
                                </Table.Td>
                              </Table.Tr>

                              {hasReverseInvoices && isExpanded && (
                                <Table.Tr>
                                  <Table.Td
                                    colSpan={7}
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
                                              Document Number
                                            </Table.Th>
                                            <Table.Th
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                width: "20%",
                                              }}
                                            >
                                              Party Name
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
                                                    {formatInvoiceDocumentNo(
                                                      rev,
                                                    )}
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
                                                      color={getInvoiceStatusBadgeColor(
                                                        rev.status,
                                                      )}
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
                                                    <JobReverseInvoiceAccountMenu
                                                      rev={rev}
                                                      parentRow={row}
                                                      jobBasePath="/inland/export-job"
                                                      navigate={navigate}
                                                      job={location.state?.job}
                                                      deletingReverseId={
                                                        invoiceDeletingId
                                                      }
                                                      onRequestDeleteReverseInvoice={
                                                        requestDeleteReverseInvoice
                                                      }
                                                    />
                                                  </Table.Td>
                                                </Table.Tr>
                                              ),
                                            )
                                          ) : (
                                            <Table.Tr>
                                              <Table.Td
                                                colSpan={7}
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

      <JobInvoiceDeleteConfirmModal {...deleteConfirmProps} />

      <JobDocumentsModal
        opened={jobDocuments.documentsModalOpen}
        onClose={() => jobDocuments.setDocumentsModalOpen(false)}
        rows={jobDocuments.document_modal_rows}
        readOnly={isReadOnly}
        uploading={jobDocuments.documentUploading}
        docTypeOptions={jobDocuments.docTypeOptions}
        docCodeErrors={jobDocuments.docCodeErrors}
        onAddRow={jobDocuments.addDocumentRow}
        onUpdateRow={jobDocuments.updateDocumentRow}
        onRemoveRow={jobDocuments.removeDocumentRow}
        onSubmit={jobDocuments.handleSubmitDocumentsModal}
      />

      <Group justify="space-between" mt="xl">
        <Group>
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleBackToListClick}
          >
            Back to List
          </Button>
          {(active === 1 || active === 2 || active === 3) && !isReadOnly && (
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
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconPaperclip size={16} />}
            onClick={jobDocuments.openDocumentsModal}
          >
            {isReadOnly ? "View Documents" : "Attach Documents"}
          </Button>
          {!isReadOnly && (
            <Button
              variant="outline"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={() => navigateToHawbCreate()}
            >
              Add AWB
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
            >
              Next
            </Button>
          )}

          {active === 3 && !isReadOnly && (
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

      <Modal
        opened={confirmBackToListOpen}
        onClose={() => setConfirmBackToListOpen(false)}
        title="Confirm"
        centered
      >
        <Text size="sm" mb="md">
          Do you want to close it since the job is not saved
        </Text>
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => setConfirmBackToListOpen(false)}
          >
            Cancel
          </Button>
          <Button
            color="#105476"
            onClick={() => {
              setConfirmBackToListOpen(false);
              navigate("/inland/export-job");
            }}
          >
            Yes, close
          </Button>
        </Group>
      </Modal>
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

      {/* AWB Details Display - Show at the top (all steps) */}
      {hawbDetails.length > 0 && (
        <Box mb="xl">
          <Text size="lg" fw={600} c="#105476" mb="md" mt="md">
            Air Waybill (AWB) ({hawbDetails.length})
          </Text>
          <Stack gap="md">
            {hawbDetails.map((hawb, index) => (
              <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Group>
                    <Badge color="#105476" size="lg">
                      AWB {index + 1}
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
                    {hawb.shipment_id && (
                      <Badge color="#105476" variant="light">
                        Shipment Id : {hawb.shipment_id}
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
                    <Menu
                      shadow="md"
                      width={JOB_HOUSE_ACTION_MENU_WIDTH}
                      position="bottom-end"
                    >
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
                        styles={JOB_HOUSE_ACTION_MENU_DROPDOWN_STYLES}
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
                          onClick={() => {
                            setPendingProformaShipmentId(String(hawb.id ?? ""));
                            setSelectedProformaCurrency("");
                            setProformaCurrencyModalOpen(true);
                          }}
                        >
                          Proforma
                        </Menu.Item>
                        <HouseEventsMenuItem
                          onClick={() => handleOpenHouseEvents(index)}
                        />
                        <HouseCreateAgentInvoiceMenuItem
                          invoicePath="/inland/export-job/invoice"
                          serviceType="AIR"
                          getCurrentHousingDetail={() => hawb}
                          jobId={jobData?.id}
                        />
                        <HouseAutomateVendorInvoiceMenuItem
                          getCurrentHousingDetail={() => hawb}
                          jobId={jobData?.id}
                          onOpen={openVendorInvoiceAutomation}
                        />
                        <HouseJobLedgerMenuItem
                          serviceName="Air Export"
                          getHouseDetail={() => hawb}
                          jobId={jobData?.job_id}
                        />
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Group>

                <Grid>
                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      AWB Number
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

                  <HouseCardSummaryTotals
                    house={hawb}
                    branches={user?.branches}
                  />
                </Grid>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
      <VendorInvoiceAutomationModal
        opened={vendorInvoiceAutomationShipmentNo != null}
        shipmentNo={vendorInvoiceAutomationShipmentNo ?? ""}
        onClose={() => setVendorInvoiceAutomationShipmentNo(null)}
      />
    </Box>
  );
}

export default InlandExportJobCreate;
