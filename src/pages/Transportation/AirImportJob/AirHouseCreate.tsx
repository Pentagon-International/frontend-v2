import {
  Box,
  Button,
  Grid,
  Group,
  Tabs,
  Table,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Modal,
  Loader,
  Center,
  Stack,
  ScrollArea,
  Select,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconTrash,
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconDownload,
  IconX,
  IconRefresh,
  IconChevronDown,
  IconChevronUp,
  IconCalendar,
  IconSend,
} from "@tabler/icons-react";
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  Fragment,
} from "react";
import { useDebouncedCallback, useDisclosure } from "@mantine/hooks";
import SendPdfEmailModal from "../../../components/SendPdfEmailModal";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useExchangeRateRoe } from "../../../hooks/useExchangeRateRoe";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { commonSearchAPI } from "../../../service/searchApi";
import {
  SearchableSelect,
  Dropdown,
  ToastNotification,
  SingleDateInput,
} from "../../../components";
import { toTitleCase } from "../../../utils/textFormatter";
import {
  mapShipmentPartyAddressOptions,
  mapShipmentPartySearchResults,
  shipmentPartyAddressMatchesSearch,
  shouldUseCustomShipmentPartyAddress,
} from "../../../utils/shipmentParty";
import { applyShipmentTermsSelection } from "../../../utils/shipmentTermsFreight";
import { isJobClosed, isJobOpenedAsView } from "../../../utils/closeJob";
import {
  getJobFormReadOnlyTabProps,
  JOB_ACCOUNTS_TAB_PANEL_CLASS,
} from "../../../utils/jobFormReadOnly";
import { roundToDecimals } from "../../../utils/numberInputUtils";
import {
  bindMoneyWholeNumberMode,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
  roundMoneyAmountBound,
  clampCurrencyMoneyAmountBound,
  roundMoneyToDecimals,
  roundLocalMoneyToDecimals,
} from "../../../utils/nonDecimalMoneyAmount";
import {
  ROE_DECIMAL_PLACES,
  roundRoeForPayload,
} from "../../../utils/exchangeRateRoe";
import {
  getMeaningfulHouseCharges,
  validateMeaningfulHouseCharges,
  type HouseChargeLike,
} from "../../../utils/houseChargesPayload";
import {
  formatInvoiceDocumentNo,
  getInvoiceDocumentNo,
} from "../../../utils/invoiceDocumentNumber";
import {
  calculateHouseChargeableWeight,
  formatHouseCargoWeightForPayload,
  HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS,
  jobChargeNoOfUnitInputProps,
  houseCargoWeightValuesEqual,
  isPositiveHouseCargoWeight,
  coerceHouseCargoWeightInput,
  formatHouseCargoChargeableDisplay,
  formatHouseCargoChargeableForPayload,
  importHouseCargoWeightFromApi,
  applyJobChargeUnitChange,
  buildBookingCargoNoOfUnitsSyncKey,
  buildJobUnitOptions,
  mapJobChargesWithUnits,
  syncJobChargesWithCargoNoOfUnits,
  toBookingCargoForNoOfUnits,
  withRecalculatedChargeableWeight,
  type HouseCargoWeightValue,
} from "../../../utils/houseCargoChargeableWeight";
import {
  findJobUnitOptionByCode,
  resolveAutoUnitForNewCharge,
} from "../../../utils/chargeCalculationTypeUnit";
import {
  eventsToEventModalRows,
  extractJobDataFromPatchAxiosResponse,
  housingEventsFromJobPatchData,
  resolveHousingEventsForHouseForm,
} from "../../../utils/jobHousingEventsFromPatch";
import { previewCargoArrivalNoticePDF } from "../../jobs/pdf/canPdfPreview";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { JobInvoiceDeleteConfirmModal } from "../../../components/JobInvoiceDeleteConfirmModal";
import { CanShowChargesModal } from "../../../components/CanShowChargesModal";
import { HouseCreateAgentInvoiceMenuItem } from "../../../components/HouseCreateAgentInvoiceMenuItem";
import { HouseAutomateVendorInvoiceMenuItem } from "../../../components/HouseAutomateVendorInvoiceMenuItem";
import { VendorInvoiceAutomationModal } from "../../../components/VendorInvoiceAutomationModal";
import { HouseJobLedgerMenuItem } from "../../../components/HouseJobLedgerMenuItem";
import {
  JOB_HOUSE_ACTION_MENU_DROPDOWN_STYLES,
  JOB_HOUSE_ACTION_MENU_WIDTH,
} from "../../../utils/jobHouseActionMenuStyles";
import { JobInvoiceDeleteMenuItem } from "../../../components/JobInvoiceDeleteMenuItem";
import { JobReverseInvoiceAccountMenu } from "../../../components/JobReverseInvoiceAccountMenu";
import { useJobAccountInvoices } from "../../../hooks/useJobAccountInvoices";
import { useHousePageDocuments } from "../../../hooks/useHousePageDocuments";
import {
  HousePageDocumentsButton,
  HousePageDocumentsModal,
} from "../../../components/HousePageDocumentsAttach";
import {
  pickHouseDocumentFields,
  spreadMasterDocumentsNavState,
} from "../../../utils/jobDocuments";
import { getInvoiceStatusBadgeColor } from "../../../utils/invoiceStatus";
import { normalizePackageTypeCode, pickPackageTypeCodeFromCargo, resolvePackageTypeName } from "../../../utils/packageTypeOptions";
import { usePackageTypeOptions } from "../../../hooks/usePackageTypeOptions";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import FormTextInput from "../../../components/FormTextInput";
import RequiredLabel from "../../../components/RequiredLabel";
import { ChargesLocalAmountTotalsRow } from "../../../components/JobChargeSummaryDisplay";
import FormTextArea from "../../../components/FormTextArea";
import FormNumberInput from "../../../components/FormNumberInput";
import { useJobModulePaths } from "../chaJob/chaJobContext";
import {
  formatChaHouseBlPayload,
  readChaHouseBlInitial,
} from "../chaJob/chaHouseBlFields";
import { ChaHouseBlFormFields } from "../chaJob/ChaHouseBlFormFields";

// Type definitions
type HAWBDetailsForm = {
  hawb_number: string;
  bl_no: string;
  bl_date: Date | null;
  shipment_terms_code: string;
  shipment_terms_name: string;
  pp_cc: string;
  routed: string;
  routed_by: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  customer_service: string;
  trade: string;
  origin_agent: string; // Stores customer_code for API filter
  origin_agent_name: string;
  origin_agent_address: string;
  origin_agent_email: string;
  /** internal select value; not sent in payload */
  cha_code: string;
  cha_name: string;
  cha_address: string;
  shipper_code: string;
  shipper_name: string;
  shipper_address: string;
  shipper_email: string;
  shipper_state_id: string;
  consignee_code: string;
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  notify1_customer_name: string;
  notify1_customer_address: string;
  notify1_customer_email: string;
  commodity_description: string;
  marks_no: string;
  note: string;
  item_no: string;
  sub_item_no: string;
  ref_no: string;
  events: Array<{ id?: number; type: string; date: string }>;
  event_modal_rows: Array<{
    id?: number;
    eventType: string | null;
    eventDate: Date | null;
  }>;
};

// Type definitions for cargo details
type CargoDetail = {
  // container_number removed for Air HAWB
  package_type: string;
  no_of_packages: number | null;
  gross_weight: HouseCargoWeightValue;
  volume: HouseCargoWeightValue;
  chargeable_weight: HouseCargoWeightValue;
  haz: string;
};

// Type definitions for charges (charge_id, unit_id, currency_id sent in payload; id for update)
type ChargeDetail = {
  id?: number | null;
  charge_id: number | null;
  charge_name: string;
  pp_cc: string;
  unit_id: string;
  no_of_unit: number | null;
  currency_id: string;
  currency: string;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null;
  // Sell group UI fields
  local_amount?: number | null;
  // Cost group UI fields
  cost_per_unit?: number | null;
  total_cost?: number | null;
  cost_local_amount?: number | null;
  supplier_code?: string;
  supplier_name?: string;
};

// Type definitions for salespersons
type SalespersonData = {
  id: number;
  sales_person: string;
  sales_coordinator: string;
  customer_service: string;
};

type SalespersonsResponse = {
  success: boolean;
  message: string;
  data: SalespersonData[];
};

const fetchSalespersons = async (customerId: string = "") => {
  const payload = {
    customer_code: customerId,
  };
  const response = await postAPICall(URL.salespersons, payload, API_HEADER);
  return response;
};

const fetchCurrencyMaster = async () => {
  try {
    const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
    return response;
  } catch (error) {
    console.error("Error fetching currency master:", error);
    return [];
  }
};

const fetchUnitMaster = async (serviceType: string = "AIR") => {
  try {
    const payload = {
      filters: {
        service_type: serviceType,
      },
    };
    const response = (await postAPICall(
      URL.unitMasterFilter,
      payload,
      API_HEADER,
    )) as { data?: unknown[] };
    return response?.data || [];
  } catch (error) {
    console.error("Error fetching unit master:", error);
    return [];
  }
};

const fetchEventMaster = async () => {
  try {
    const payload = { filters: {} };
    const response = (await postAPICall(
      URL.eventMasterFilter,
      payload,
      API_HEADER,
    )) as { data?: unknown[] };
    return response?.data ?? [];
  } catch (error) {
    console.error("Error fetching event master:", error);
    return [];
  }
};

const fetchTermsOfShipment = async () => {
  const response = await getAPICall(`${URL.termsOfShipment}`, API_HEADER);
  return response;
};

// Reverse invoice item (from API reverse_invoices)
type ReverseInvoiceItem = {
  id?: number;
  reverse_document_no?: string;
  document_no?: string;
  document_date?: string;
  total?: string | number;
  status?: string;
  day_book_name?: string;
  bill_to_name?: string;
  [key: string]: unknown;
};

// Invoice list item from /api/filter/invoice/ response
type InvoiceListItem = {
  id: number;
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
  reverse_invoices?: ReverseInvoiceItem[];
};

// Validation handled in validateStep1 and validateStep2 functions

const normalizePpCc = (value: unknown): string => {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (raw === "PP" || raw === "PREPAID") return "Prepaid";
  if (raw === "CC" || raw === "COLLECT") return "Collect";
  return "";
};

const resolveHouseFreightPpCc = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const normalized = normalizePpCc(candidate);
    if (normalized) return normalized;
  }
  return "Collect";
};

function HouseCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { isChaMode, basePath: jobModuleBasePath } = useJobModulePaths({
    basePath: "/air/import-job",
    listKey: "AIR_IMPORT_JOB_MASTER",
    invoiceServiceType: "AIR",
  });
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const currencyAmountDecimalScale = getAmountDecimalScale(false);
  const localAmountDecimalScale = getAmountDecimalScale(isVietnamBranch);

  const {
    isBaseCurrency,
    isChargeBaseCurrencyFor,
    ensureRoeForCurrency,
    validateRoeField,
    resolveCurrencyCode,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
    getBranchCurrencyDefaults,
  } = useExchangeRateRoe();
  const branchCurrencyDefaults = getBranchCurrencyDefaults();

  const calculateChargeableWeight = useCallback(
    (grossWeight: HouseCargoWeightValue, volumeWeight: HouseCargoWeightValue) =>
      calculateHouseChargeableWeight(grossWeight, volumeWeight, "air"),
    [],
  );

  // State for address options (populated from addresses_data when shipper/consignee is selected)
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    Array<{ value: string; label: string; email?: string }>
  >([]);
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    Array<{ value: string; label: string; email?: string }>
  >([]);
  const [notifyCustomerAddressOptions, setNotifyCustomerAddressOptions] =
    useState<Array<{ value: string; label: string; email?: string }>>([]);
  const [originAgentAddressOptions, setOriginAgentAddressOptions] = useState<
    Array<{ value: string; label: string; email?: string }>
  >([]);

  // Shipment-party search state for Shipper (import flow)
  const [shipperSearch, setShipperSearch] = useState("");
  const [shipperOptions, setShipperOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  // Separate "manual mode" flag to avoid rapid flipping between Select/TextInput (prevents focus loss)
  const [shipperManualMode, setShipperManualMode] = useState(false);
  const [shipperHasResults, setShipperHasResults] = useState<boolean | null>(
    null,
  );
  const shipperDataRef = useRef<Record<string, Record<string, unknown>>>({});
  const [shipperAddressSearch, setShipperAddressSearch] = useState("");
  const [shipperAddressCustom, setShipperAddressCustom] = useState(false);

  // State for cargo details
  const [cargoDetails, setCargoDetails] = useState<CargoDetail[]>([
    {
      package_type: "",
      no_of_packages: null,
      gross_weight: null,
      volume: null,
      chargeable_weight: null,
      haz: "",
    },
  ]);

  // State for cargo details validation errors
  const [cargoErrors, setCargoErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  // State for charges validation errors
  const [chargeErrors, setChargeErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  // PDF Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [canChargesModalOpen, setCanChargesModalOpen] = useState(false);
  const [sendEmailOpened, { open: openSendEmail, close: closeSendEmail }] =
    useDisclosure(false);
  const [activePdfBlob, setActivePdfBlob] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState("");
  const [activeDocumentLabel, setActiveDocumentLabel] = useState("");

  // Charges Form - Using useForm similar to routings in ImportJobCreate
  const chargesForm = useForm<{ charges: ChargeDetail[] }>({
    initialValues: {
      charges: [
        {
          charge_id: null,
          charge_name: "",
          pp_cc: "Collect",
          unit_id: "",
          no_of_unit: null,
          ...branchCurrencyDefaults,
          amount_per_unit: null,
          amount: null,
          supplier_code: "",
          supplier_name: "",
        },
      ],
    },
  });

  // Debounced shipment-party search for Shipper (import flow)
  const debouncedShipperSearch = useDebouncedCallback(async (term: string) => {
    const query = term.trim();
    if (!query || query.length < 2) {
      setShipperOptions([]);
      setShipperHasResults(null);
      setShipperManualMode(false);
      shipperDataRef.current = {};
      return;
    }

    try {
      const results = await commonSearchAPI({
        endpoint: URL.shipmentParty,
        query,
      });

      const arr = Array.isArray(results)
        ? (results as Record<string, unknown>[])
        : [];

      if (!arr.length) {
        setShipperOptions([]);
        setShipperHasResults(false);
        setShipperManualMode(true);
        shipperDataRef.current = {};
        // When shipment-party has no matches, keep the user's typed text
        // as the shipper name (manual entry flow like booking page).
        form.setFieldValue("shipper_code", "");
        form.setFieldValue("shipper_name", query);
        return;
      }

      const { options: opts, map } = mapShipmentPartySearchResults(arr);

      shipperDataRef.current = map;
      setShipperOptions(opts);
      setShipperHasResults(true);
      setShipperManualMode(false);
    } catch (error) {
      console.error("Shipper shipment-party search failed:", error);
      setShipperOptions([]);
      setShipperHasResults(null);
      setShipperManualMode(false);
      shipperDataRef.current = {};
    }
  }, 500);

  const getPartyAddresses = (
    original: Record<string, unknown>,
  ): Array<{
    address?: string;
    email?: string;
    address_type?: string;
    state_id?: number;
  }> => {
    const raw =
      (original.addresses_data as unknown) ??
      (original.addresses as unknown) ??
      (original.address_data as unknown);

    if (!Array.isArray(raw)) return [];

    return (raw as Array<Record<string, unknown>>).map((a) => ({
      address:
        (a.address as string | undefined) ?? (a.address1 as string | undefined),
      email: String(a.email ?? ""),
      address_type: String(a.address_type ?? ""),
      state_id:
        a.state_id != null && !Number.isNaN(Number(a.state_id))
          ? Number(a.state_id)
          : undefined,
    }));
  };

  const pickPrimaryPartyAddress = <
    T extends { address?: string; email?: string; address_type?: string | null },
  >(
    addresses: T[],
  ): T | undefined =>
    addresses.find(
      (a) =>
        String(a.address_type || "").toUpperCase() === "PRIMARY" && !!a.address,
    ) || addresses.find((a) => !!a.address);

  // Get existing housing details from location state if available
  // Check both hawbDetails and housingDetails for backward compatibility
  const existingHousingDetails =
    location.state?.hawbDetails || location.state?.housingDetails || [];
  const editIndex = location.state?.editIndex;
  const editData = location.state?.editData;
  const housePageDocuments = useHousePageDocuments(
    (editData as Record<string, unknown> | undefined) ?? undefined,
  );
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
    shipmentNo: editData?.shipment_id,
    enabled: !!editData?.shipment_id,
  });
  const isEditMode = editIndex !== undefined && editData !== undefined;
  const isViewOnly = isJobOpenedAsView({
    viewMode: location.state?.viewMode,
    actionType: location.state?.actionType,
  });
  const isReadOnly =
    isViewOnly ||
    isJobClosed(
      (location.state?.job as { status?: string | null } | undefined)?.status,
    );

  useEffect(() => {
    if (!isEditMode && active === 4) setActive(0);
  }, [active, isEditMode]);

  // Helper function to normalize routed value (handle backwards compatibility)
  const normalizeRoutedValue = (value: unknown): string => {
    if (typeof value === "boolean") {
      return value ? "self" : "";
    }
    if (typeof value === "string") {
      const lowerValue = value.toLowerCase();
      if (lowerValue === "self" || lowerValue === "agent") {
        return lowerValue;
      }
      // Handle old values like "Self", "Agent", etc.
      if (value === "Self") return "self";
      if (value === "Agent") return "agent";
    }
    return "";
  };

  const initialHousingEvents = resolveHousingEventsForHouseForm(
    location.state?.job,
    editData,
    editIndex,
  );

  // Form with all fields - pre-fill if in edit mode, auto-set from MAWB in create mode
  const form = useForm<HAWBDetailsForm>({
    initialValues: {
      hawb_number: editData?.hawb_number || editData?.hbl_number || "",
      ...readChaHouseBlInitial(
        editData as { bl_no?: string; bl_date?: string | Date } | undefined,
      ),
      shipment_terms_code: editData?.shipment_terms_code || "",
      shipment_terms_name: editData?.shipment_terms_name || "",
      pp_cc: resolveHouseFreightPpCc(
        editData?.pp_cc,
        (editData as { freight?: string } | undefined)?.freight,
      ),
      routed: normalizeRoutedValue(editData?.routed),
      routed_by: editData?.routed_by || "",
      origin_code:
        editData?.origin_code ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.origin_code ||
            location.state?.mawbDetails?.origin_code ||
            ""
          : ""),
      origin_name:
        editData?.origin_name ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.origin_name ||
            location.state?.mawbDetails?.origin_name ||
            ""
          : ""),
      destination_code:
        editData?.destination_code ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.destination_code ||
            location.state?.mawbDetails?.destination_code ||
            ""
          : ""),
      destination_name:
        editData?.destination_name ||
        (editIndex === undefined
          ? location.state?.mawbDetails?.destination_name ||
            location.state?.mawbDetails?.destination_name ||
            ""
          : ""),
      customer_service: editData?.customer_service || "",
      trade: editData?.trade || "",
      origin_agent: editData?.origin_agent || "",
      origin_agent_name: editData?.origin_agent_name || "",
      origin_agent_address: editData?.origin_agent_address || "",
      origin_agent_email: editData?.origin_agent_email || "",
      cha_code: (editData as { cha_code?: string })?.cha_code ?? "",
      cha_name: (editData as { cha_name?: string })?.cha_name ?? "",
      cha_address: (editData as { cha_address?: string })?.cha_address ?? "",
      // shipment-party uses customer id as value; API may send shipper_id or shipper_code
      shipper_code:
        editData?.shipper_id != null
          ? String(editData.shipper_id)
          : String(editData?.shipper_code || ""),
      shipper_name: editData?.shipper_name || "",
      shipper_address: editData?.shipper_address || "",
      shipper_email: editData?.shipper_email || "",
      shipper_state_id:
        editData?.shipper_state_id != null
          ? String(editData.shipper_state_id)
          : "",
      consignee_code:
        editData?.consignee_id != null
          ? String(editData.consignee_id)
          : String(editData?.consignee_code || ""),
      consignee_name: editData?.consignee_name || "",
      consignee_address: editData?.consignee_address || "",
      consignee_email: editData?.consignee_email || "",
      notify1_customer_name:
        (editData as { notify1_customer_name?: string })
          ?.notify1_customer_name ??
        editData?.notify_customer1_name ??
        "",
      notify1_customer_address:
        (editData as { notify1_customer_address?: string })
          ?.notify1_customer_address ??
        editData?.notify_customer1_address ??
        "",
      notify1_customer_email:
        (editData as { notify1_customer_email?: string })
          ?.notify1_customer_email ??
        editData?.notify_customer1_email ??
        "",
      commodity_description: editData?.commodity_description || "",
      marks_no: editData?.marks_no || "",
      note: (editData as { note?: string } | undefined)?.note || "",
      item_no: (editData as { item_no?: string } | undefined)?.item_no || "",
      sub_item_no:
        (editData as { sub_item_no?: string } | undefined)?.sub_item_no || "",
      ref_no: (editData as { ref_no?: string } | undefined)?.ref_no || "",
      events: initialHousingEvents,
      event_modal_rows: eventsToEventModalRows(initialHousingEvents),
    },
    validate: () => {
      // Validation handled in validateStep functions
      return {};
    },
  });

  const { data: eventMasterData = [] } = useQuery({
    queryKey: ["eventMaster"],
    queryFn: fetchEventMaster,
    staleTime: 5 * 60 * 1000,
  });
  const { data: termsOfShipment = [] } = useQuery({
    queryKey: ["termsOfShipment"],
    queryFn: fetchTermsOfShipment,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const packageTypeOptions = usePackageTypeOptions();

  const shipmentOptions = useMemo(() => {
    if (!Array.isArray(termsOfShipment) || !termsOfShipment.length) return [];
    return termsOfShipment.map(
      (item: { tos_code?: string; tos_name?: string }) => ({
        value: item.tos_code ? String(item.tos_code) : "",
        label: `${String(item.tos_name || "")} (${String(item.tos_code || "")})`,
      }),
    );
  }, [termsOfShipment]);

  const eventTypeOptions = useMemo(() => {
    const list = eventMasterData as Array<{ name?: string }>;
    if (!list?.length) return [];
    return list.map((item) => {
      const name = String(item.name ?? "");
      return { value: name, label: name };
    });
  }, [eventMasterData]);

  const [eventsModalOpen, setEventsModalOpen] = useState(false);
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

  const openEventsModalFromMenu = useCallback(() => {
    const existing =
      form.values.events.length > 0
        ? form.values.events
        : resolveHousingEventsForHouseForm(
            location.state?.job,
            editData,
            editIndex,
          );
    if (existing.length > 0) {
      form.setFieldValue("events", existing);
      form.setFieldValue("event_modal_rows", [
        ...existing.map((e) => ({
          id: e.id,
          eventType: e.type,
          eventDate: e.date ? new Date(String(e.date)) : null,
        })),
        { id: undefined, eventType: null, eventDate: null },
      ]);
    } else {
      form.setFieldValue("event_modal_rows", [
        { id: undefined, eventType: null, eventDate: null },
      ]);
    }
    setEventsModalOpen(true);
  }, [editData, editIndex, form, location.state?.job]);

  useEffect(() => {
    if (location.state?.openEventsModal) {
      openEventsModalFromMenu();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addEventRow = () => {
    form.insertListItem("event_modal_rows", {
      id: undefined,
      eventType: null,
      eventDate: null,
    });
  };

  const updateEventRow = (
    index: number,
    field: "eventType" | "eventDate",
    value: string | Date | null,
  ) => {
    form.setFieldValue(`event_modal_rows.${index}.${field}`, value);
  };

  const removeEventRow = (index: number) => {
    if (form.values.event_modal_rows.length > 1) {
      form.removeListItem("event_modal_rows", index);
    }
  };

  const handleSubmitEventsModal = () => {
    const rows = form.values.event_modal_rows;
    const toAdd: Array<{ id?: number; type: string; date: string }> = [];

    for (const row of rows) {
      if (row.eventType && row.eventDate) {
        const item: { id?: number; type: string; date: string } = {
          type: row.eventType,
          date:
            row.eventDate instanceof Date
              ? row.eventDate.toISOString().split("T")[0]
              : String(row.eventDate),
        };
        if (row.id != null) {
          item.id = typeof row.id === "number" ? row.id : Number(row.id);
        }
        toAdd.push(item);
      }
    }

    form.setFieldValue("events", toAdd);
    form.setFieldValue("event_modal_rows", [
      { id: undefined, eventType: null, eventDate: null },
    ]);
    setEventsModalOpen(false);
  };

  // Memoize additionalParams to prevent SearchableSelect from recreating fetchData on every render
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  // Similar booking check - modal and API (Air Import Job Create flow only)
  const [similarBookingModalOpen, setSimilarBookingModalOpen] = useState(false);
  const [similarBookingData, setSimilarBookingData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [similarBookingId, setSimilarBookingId] = useState<number | null>(null);
  const [similarBookingApplyLoading, setSimilarBookingApplyLoading] =
    useState(false);

  const fetchSimilarBookings = useCallback(
    async (hawbNo: string, agentCode: string) => {
      if (!hawbNo?.trim() || !agentCode?.trim()) return;
      try {
        const response = (await postAPICall(
          URL.customerServiceShipmentFilter,
          {
            filters: {
              service_type: "IMPORT",
              service: "AIR",
              status: ["BOOKED", "RECEIVED"],
              houseno: hawbNo.trim(),
              destination_agent_code: agentCode.trim(),
            },
          },
          API_HEADER,
        )) as { success?: boolean; data?: unknown[] };
        if (
          response?.success &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          setSimilarBookingData(response.data[0] as Record<string, unknown>);
          setSimilarBookingModalOpen(true);
        }
      } catch {
        // Silent fail for optional feature
      }
    },
    [],
  );

  const debouncedFetchSimilarBookings = useDebouncedCallback(
    (hawbNo: string, agentCode: string) => {
      fetchSimilarBookings(hawbNo, agentCode);
    },
    2000,
  );

  useEffect(() => {
    if (isEditMode) return;
    const hawbNo = form.values.hawb_number?.trim();
    const agentCode = form.values.origin_agent?.trim();
    if (hawbNo && agentCode) {
      debouncedFetchSimilarBookings(hawbNo, agentCode);
    }
  }, [
    isEditMode,
    form.values.hawb_number,
    form.values.origin_agent,
    debouncedFetchSimilarBookings,
  ]);

  const fillFormFromSimilarBooking = useCallback(() => {
    const b = similarBookingData;
    if (!b) return;
    const bookingIdRaw = (b as { id?: unknown })?.id;
    const bookingId =
      bookingIdRaw == null || bookingIdRaw === "" ? null : Number(bookingIdRaw);
    setSimilarBookingId(Number.isNaN(bookingId as number) ? null : bookingId);
    setSimilarBookingModalOpen(false);
    setSimilarBookingData(null);

    const rb = b as Record<string, unknown>;

    // Party details (booking uses shipper/consignee or customer when null)
    const shipperCode = rb.shipper_code || "";
    const shipperName = rb.shipper_name || "";
    const consigneeCode = rb.consignee_code || "";
    const consigneeName = rb.consignee_name || "";
    form.setFieldValue("shipper_code", String(shipperCode || ""));
    form.setFieldValue("shipper_name", String(shipperName || ""));
    form.setFieldValue("consignee_code", String(consigneeCode || ""));
    form.setFieldValue("consignee_name", String(consigneeName || ""));
    form.setFieldValue(
      "commodity_description",
      String(rb.commodity_description || ""),
    );
    form.setFieldValue("marks_no", String(rb.marks_no || ""));

    // Shipment terms (auto-fill)
    if (rb.shipment_terms_code) {
      form.setFieldValue(
        "shipment_terms_code",
        String(rb.shipment_terms_code || ""),
      );
    }
    if (rb.shipment_terms_name) {
      form.setFieldValue(
        "shipment_terms_name",
        String(rb.shipment_terms_name || ""),
      );
    }

    // Customer service name, routed, routed_by
    if (rb.customer_service_name) {
      form.setFieldValue("customer_service", String(rb.customer_service_name));
    }
    if (rb.routed) {
      const routed = String(rb.routed).toLowerCase();
      form.setFieldValue(
        "routed",
        routed === "self" || routed === "agent" ? routed : "self",
      );
    }
    if (rb.routed_by) {
      form.setFieldValue("routed_by", String(rb.routed_by));
    }

    // Notify customer name / address / email (payload keys: notify1_customer_*)
    if (rb.notify1_customer_name || rb.notify_customer) {
      form.setFieldValue(
        "notify1_customer_name",
        String(rb.notify1_customer_name || rb.notify_customer || ""),
      );
    }
    if (rb.notify1_customer_address || rb.notify_customer_address) {
      form.setFieldValue(
        "notify1_customer_address",
        String(rb.notify1_customer_address || rb.notify_customer_address || ""),
      );
    }
    if (rb.notify1_customer_email || rb.notify_customer_email) {
      form.setFieldValue(
        "notify1_customer_email",
        String(rb.notify1_customer_email || rb.notify_customer_email || ""),
      );
    }

    // CHA (auto-fill)
    if (rb.cha_code) form.setFieldValue("cha_code", String(rb.cha_code || ""));
    if (rb.cha) form.setFieldValue("cha_name", String(rb.cha || ""));
    if (rb.cha_address) {
      form.setFieldValue("cha_address", String(rb.cha_address || ""));
    }

    // Shipper/consignee addresses - try addresses from API if available
    const shipperAddr = rb.shipper_address;
    const consigneeAddr = rb.consignee_address;
    if (shipperAddr) {
      form.setFieldValue("shipper_address", String(shipperAddr));
    }
    if (consigneeAddr) {
      form.setFieldValue("consignee_address", String(consigneeAddr));
    }

    const shipperEmail = rb.shipper_email;
    const consigneeEmail = rb.consignee_email;
    if (shipperEmail) {
      form.setFieldValue("shipper_email", String(shipperEmail));
    }
    if (consigneeEmail) {
      form.setFieldValue("consignee_email", String(consigneeEmail));
    }

    // Keep shipper search input in sync so UI shows the autofilled value
    if (shipperName) setShipperSearch(String(shipperName));

    // Origin agent address and email (booking uses destination_agent_* for import)
    if (rb.destination_agent_address) {
      form.setFieldValue(
        "origin_agent_address",
        String(rb.destination_agent_address),
      );
    }
    if (rb.destination_agent_email) {
      form.setFieldValue(
        "origin_agent_email",
        String(rb.destination_agent_email),
      );
    }

    // Cargo details - from cargo_details array OR top-level fields
    const cargoDetailsData = rb.cargo_details as
      Array<Record<string, unknown>> | undefined;
    const isHazardous = (rb as { is_hazardous?: boolean }).is_hazardous;
    const haz =
      isHazardous === true ? "Yes" : isHazardous === false ? "No" : "";

    const toNum = (v: unknown): number | null => {
      if (v == null) return null;
      const n = parseFloat(String(v));
      return Number.isNaN(n) ? null : n;
    };

    if (
      cargoDetailsData &&
      Array.isArray(cargoDetailsData) &&
      cargoDetailsData.length > 0
    ) {
      const mapped = cargoDetailsData.map((c) => {
        const no_of_packages = toNum(c.no_of_packages ?? rb.no_of_packages);
        const gross_weight = importHouseCargoWeightFromApi(
          c.gross_weight ?? rb.gross_weight,
        );
        const volumeFromRow = importHouseCargoWeightFromApi(
          c.volume ?? c.volume_weight ?? rb.volume_weight ?? rb.volume,
        );
        const chargeable_weight = importHouseCargoWeightFromApi(
          c.chargeable_volume ??
            c.chargeable_weight ??
            rb.chargeable_volume ??
            rb.chargeable_weight,
        );
        return {
          package_type: pickPackageTypeCodeFromCargo(
            c as Record<string, unknown>,
          ),
          no_of_packages,
          gross_weight,
          volume: volumeFromRow,
          chargeable_weight,
          haz,
        };
      });
      setCargoDetails(mapped.length > 0 ? mapped : []);
    } else {
      // Top-level cargo fields when cargo_details array absent
      const row = {
        package_type: pickPackageTypeCodeFromCargo(
          rb as Record<string, unknown>,
        ),
        no_of_packages: toNum(rb.no_of_packages),
        gross_weight: importHouseCargoWeightFromApi(rb.gross_weight),
        volume: importHouseCargoWeightFromApi(rb.volume ?? rb.volume_weight),
        chargeable_weight: importHouseCargoWeightFromApi(
          rb.chargeable_volume ?? rb.chargeable_weight,
        ),
        haz,
      };
      setCargoDetails([row]);
    }

    // Charges from rate_details - use unit_id, currency_id from API
    const rateDetails = rb.rate_details as
      Array<Record<string, unknown>> | undefined;
    if (rateDetails && Array.isArray(rateDetails) && rateDetails.length > 0) {
      const mappedCharges = rateDetails.map((r) => {
        const unitId =
          r.unit_id != null
            ? String(r.unit_id)
            : r.unit != null
              ? String(r.unit)
              : "";
        const currencyId =
          (r as { currency_id?: unknown }).currency_id != null
            ? String((r as { currency_id?: unknown }).currency_id)
            : (r as { currency_country_code?: string }).currency_country_code !=
                null
              ? String(
                  (r as { currency_country_code?: string })
                    .currency_country_code,
                )
              : "";
        return {
          charge_id: r.charge_id != null ? Number(r.charge_id) : null,
          charge_name: String(r.charge_name || ""),
          pp_cc: String(r.pp_cc || ""),
          unit_id: unitId,
          no_of_unit: r.no_of_units != null ? Number(r.no_of_units) : null,
          currency_id: currencyId,
          roe: r.roe != null ? Number(r.roe) : null,
          amount_per_unit:
            r.sell_per_unit != null ? Number(r.sell_per_unit) : null,
          amount: r.total_sell != null ? Number(r.total_sell) : null,
        };
      });
      chargesForm.setValues({ charges: mappedCharges });
    }
  }, [similarBookingData, form, chargesForm]);

  const handleConfirmSimilarBooking = useCallback(async () => {
    setSimilarBookingApplyLoading(true);
    try {
      // Ensure loader is painted before heavy form updates.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      fillFormFromSimilarBooking();
      // Keep loader until autofilled values are committed to UI.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    } finally {
      setSimilarBookingApplyLoading(false);
    }
  }, [fillFormFromSimilarBooking]);

  const dismissSimilarBookingModal = useCallback(() => {
    setSimilarBookingModalOpen(false);
    setSimilarBookingData(null);
    setSimilarBookingId(null);
  }, []);

  // Auto-calculate chargeable weight when gross weight or volume weight changes
  const cargoGrossWeights = cargoDetails.map((c) => c.gross_weight).join(",");
  const cargoVolumeWeights = cargoDetails.map((c) => c.volume).join(",");

  useEffect(() => {
    const updatedCargoDetails = cargoDetails.map((cargo) => {
      const chargeableWeight = calculateChargeableWeight(
        cargo.gross_weight,
        cargo.volume,
      );
      // Only update if chargeable_weight changed
      if (
        houseCargoWeightValuesEqual(cargo.chargeable_weight, chargeableWeight)
      ) {
        return cargo;
      }
      return {
        ...cargo,
        chargeable_weight: isPositiveHouseCargoWeight(chargeableWeight)
          ? chargeableWeight
          : null,
      };
    });

    // Only update if there are actual changes
    const hasChanges = updatedCargoDetails.some(
      (cargo, index) =>
        cargo.chargeable_weight !== cargoDetails[index]?.chargeable_weight,
    );

    if (hasChanges) {
      setCargoDetails(updatedCargoDetails);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargoGrossWeights, cargoVolumeWeights, calculateChargeableWeight]);

  // Track if form has been initialized from editData to prevent overwriting user changes (reset when editData id/index changes)
  const formInitializedFromEditDataRef = useRef(false);
  const lastEditKeyRef = useRef<string>("");

  // Initialize form values from editData when in edit mode (re-run when editData/editIndex changes so different house loads)
  useEffect(() => {
    if (!isEditMode || !editData) {
      console.log(
        "[AirHouseCreate] EDIT LOAD skip: not edit mode or no editData",
        {
          isEditMode,
          hasEditData: !!editData,
          editIndex,
        },
      );
      return;
    }

    const editKey = `${editIndex}-${(editData as { id?: number })?.id ?? "new"}`;
    if (lastEditKeyRef.current !== editKey) {
      formInitializedFromEditDataRef.current = false;
      lastEditKeyRef.current = editKey;
      console.log(
        "[AirHouseCreate] EDIT LOAD new house detected, reset init ref",
        { editKey },
      );
    }

    console.log("[AirHouseCreate] EDIT LOAD effect run", {
      editIndex,
      editDataId: (editData as { id?: number })?.id,
      editDataKeys: Object.keys(editData),
      hasCargoDetails: !!editData.cargo_details,
      cargoDetailsIsArray: Array.isArray(editData.cargo_details),
      cargoDetailsLength: Array.isArray(editData.cargo_details)
        ? editData.cargo_details.length
        : 0,
      hasCharges: !!editData.charges,
      hasMawbCharges: !!editData.mawb_charges,
      chargesLength: Array.isArray(editData.charges)
        ? editData.charges.length
        : Array.isArray((editData as { mawb_charges?: unknown[] }).mawb_charges)
          ? (editData as { mawb_charges: unknown[] }).mawb_charges.length
          : 0,
      formAlreadyInitialized: formInitializedFromEditDataRef.current,
    });

    if (!formInitializedFromEditDataRef.current) {
      // Set all form values from editData (main form fields - only once per house)
      form.setValues({
        hawb_number:
          editData.hawb_number || editData.hbl_number || editData.hawb_no || "",
        ...readChaHouseBlInitial(
          editData as { bl_no?: string; bl_date?: string | Date },
        ),
        shipment_terms_code: editData.shipment_terms_code || "",
        shipment_terms_name: editData.shipment_terms_name || "",
        pp_cc: resolveHouseFreightPpCc(
          editData.pp_cc,
          (editData as { freight?: string }).freight,
        ),
        routed: normalizeRoutedValue(editData.routed),
        routed_by: editData.routed_by || "",
        origin_code: editData.origin_code || "",
        origin_name: editData.origin_name || "",
        destination_code: editData.destination_code || "",
        destination_name: editData.destination_name || "",
        customer_service: editData.customer_service || "",
        trade: editData.trade || "",
        origin_agent: editData.origin_agent || "",
        origin_agent_name: editData.origin_agent_name || "",
        origin_agent_address: editData.origin_agent_address || "",
        origin_agent_email: editData.origin_agent_email || "",
        // Preserve party ids for shipment-party Select; name/address/email from API housing_details
        shipper_code:
          editData.shipper_id != null
            ? String(editData.shipper_id)
            : String(editData.shipper_code || ""),
        shipper_name: editData.shipper_name || "",
        shipper_address: editData.shipper_address || "",
        shipper_email: editData.shipper_email || "",
        shipper_state_id:
          editData.shipper_state_id != null
            ? String(editData.shipper_state_id)
            : "",
        consignee_code:
          editData.consignee_id != null
            ? String(editData.consignee_id)
            : String(editData.consignee_code || ""),
        consignee_name: editData.consignee_name || "",
        consignee_address: editData.consignee_address || "",
        consignee_email: editData.consignee_email || "",
        notify1_customer_name:
          (editData as { notify1_customer_name?: string })
            .notify1_customer_name ??
          editData.notify_customer1_name ??
          "",
        notify1_customer_address:
          (editData as { notify1_customer_address?: string })
            .notify1_customer_address ??
          editData.notify_customer1_address ??
          "",
        notify1_customer_email:
          (editData as { notify1_customer_email?: string })
            .notify1_customer_email ??
          editData.notify_customer1_email ??
          "",
        commodity_description: editData.commodity_description || "",
        marks_no: editData.marks_no || "",
        note: (editData as { note?: string }).note || "",
        ref_no: (editData as { ref_no?: string }).ref_no || "",
      });

      // Sync search display and address options from housing_details (like booking edit load)
      const shipperName = String(editData.shipper_name || "");
      if (shipperName) setShipperSearch(shipperName);
      const shipperAddr = editData.shipper_address;
      if (shipperAddr) {
        const addrStr = toTitleCase(String(shipperAddr));
        // Set both the form value and the dropdown options so the address shows in-field
        form.setFieldValue("shipper_address", addrStr);
        setShipperAddressOptions([{ value: addrStr, label: addrStr }]);
      }
      const consigneeAddr = editData.consignee_address;
      if (consigneeAddr) {
        const addrStr = toTitleCase(String(consigneeAddr));
        form.setFieldValue("consignee_address", addrStr);
        setConsigneeAddressOptions([{ value: addrStr, label: addrStr }]);
      }
    }

    // Always load cargo_details and charges when editData has them (run every time so data is set even if init ref was already true)
    // Load cargo details (support both cargo_details from mapped object and raw API)
    const cargoDetailsSource =
      editData.cargo_details ??
      (editData as { cargo_details?: unknown[] }).cargo_details;
    if (!cargoDetailsSource || !Array.isArray(cargoDetailsSource)) {
      console.log("[AirHouseCreate] Cargo details: NOT SET", {
        reason: !editData.cargo_details
          ? "editData.cargo_details is missing"
          : "editData.cargo_details is not an array",
        editDataKeys: editData ? Object.keys(editData) : [],
        rawCargoDetails: (editData as Record<string, unknown>).cargo_details,
      });
    } else {
      console.log("[AirHouseCreate] Cargo details: loading", {
        count: cargoDetailsSource.length,
        firstItem: cargoDetailsSource[0],
      });
      const loadedCargoDetails = cargoDetailsSource.map(
        (cargo: Record<string, unknown>, idx: number) => {
          const no_of_packages =
            cargo.no_of_packages != null &&
            !Number.isNaN(Number(cargo.no_of_packages))
              ? Number(cargo.no_of_packages)
              : null;
          const gross_weight = importHouseCargoWeightFromApi(
            cargo.gross_weight,
          );
          const volume_weight_final = importHouseCargoWeightFromApi(
            cargo.volume,
          );
          const chargeable_weight = importHouseCargoWeightFromApi(
            cargo.chargeable_weight,
          );
          const haz =
            cargo.haz === true || cargo.haz === "true"
              ? "Yes"
              : cargo.haz === false || cargo.haz === "false"
                ? "No"
                : cargo.haz
                  ? String(cargo.haz)
                  : "";
          const row = {
            package_type: pickPackageTypeCodeFromCargo(
              cargo as Record<string, unknown>,
            ),
            no_of_packages,
            gross_weight,
            volume: volume_weight_final,
            chargeable_weight,
            haz,
          };
          const notSet: string[] = [];
          if (row.no_of_packages == null) notSet.push("no_of_packages");
          if (row.gross_weight == null) notSet.push("gross_weight");
          if (row.volume == null) notSet.push("volume");
          if (row.chargeable_weight == null) notSet.push("chargeable_weight");
          if (row.haz === "") notSet.push("haz");
          if (notSet.length > 0) {
            console.log(
              `[AirHouseCreate] Cargo[${idx}] fields NOT SET:`,
              notSet,
              { raw: cargo, mapped: row },
            );
          }
          return row;
        },
      );
      const allCargoNotSet = loadedCargoDetails.flatMap((row, idx) => {
        const notSet: string[] = [];
        if (row.no_of_packages == null) notSet.push("no_of_packages");
        if (row.gross_weight == null) notSet.push("gross_weight");
        if (row.volume == null) notSet.push("volume");
        if (row.chargeable_weight == null) notSet.push("chargeable_weight");
        if (row.haz === "") notSet.push("haz");
        return notSet.length ? [{ index: idx, fields: notSet }] : [];
      });
      console.log("[AirHouseCreate] Cargo details loaded", {
        count: loadedCargoDetails.length,
        rowsWithMissingFields: allCargoNotSet,
        loadedCargoDetails,
      });
      if (loadedCargoDetails.length > 0) {
        setCargoDetails(loadedCargoDetails);
        console.log("[AirHouseCreate] Cargo details: setCargoDetails called", {
          count: loadedCargoDetails.length,
        });
      }
    }

    // Load charges - handle both "charges" (mapped) and "mawb_charges" (raw API)
    const chargesToLoad = (() => {
      const rawCharges = (editData as { charges?: unknown }).charges;
      const rawMawbCharges = (editData as { mawb_charges?: unknown })
        .mawb_charges;
      const chargesArr = Array.isArray(rawCharges) ? rawCharges : null;
      const mawbArr = Array.isArray(rawMawbCharges) ? rawMawbCharges : null;
      if (chargesArr && chargesArr.length > 0) return chargesArr;
      if (mawbArr && mawbArr.length > 0) return mawbArr;
      return [];
    })();
    const chargesArray = Array.isArray(chargesToLoad) ? chargesToLoad : [];
    if (chargesArray.length === 0) {
      console.log("[AirHouseCreate] Charges: NOT SET (empty or missing)", {
        hasCharges: !!(editData as { charges?: unknown }).charges,
        chargesLength: Array.isArray(
          (editData as { charges?: unknown[] }).charges,
        )
          ? (editData as { charges: unknown[] }).charges.length
          : 0,
        hasMawbCharges: !!(editData as { mawb_charges?: unknown }).mawb_charges,
        mawbChargesLength: Array.isArray(
          (editData as { mawb_charges?: unknown[] }).mawb_charges,
        )
          ? (editData as { mawb_charges: unknown[] }).mawb_charges.length
          : 0,
        editDataKeys: editData ? Object.keys(editData) : [],
      });
    } else {
      console.log("[AirHouseCreate] Charges: loading", {
        source:
          (editData as { charges?: unknown[] }).charges &&
          Array.isArray((editData as { charges: unknown[] }).charges)
            ? "charges"
            : "mawb_charges",
        count: chargesArray.length,
        firstCharge: chargesArray[0],
      });
      const unitDataArr: { id?: number; unit_code?: string }[] = [];
      const currencyDataArr: {
        id?: number;
        code?: string;
        currency_code?: string;
      }[] = [];
      const loadedCharges = chargesArray.map(
        (charge: Record<string, unknown>) => {
          const unitDetails = charge.unit_details as
            { unit_id?: number; unit_code?: string } | undefined;
          const currencyDetails = charge.currency_details as
            { currency_id?: number; currency_code?: string } | undefined;
          const unitCode = String(
            charge.unit_code ??
              charge.unit_input ??
              unitDetails?.unit_code ??
              "",
          ).trim();
          const currencyCode = String(
            currencyDetails?.currency_code ?? charge.currency_code ?? "",
          ).trim();

          const pp_cc = normalizePpCc(charge.pp_cc);

          const toNum = (v: unknown): number | null => {
            if (v == null) return null;
            if (typeof v === "number" && !Number.isNaN(v)) return v;
            const n = parseFloat(String(v));
            return Number.isNaN(n) ? null : n;
          };

          const chargeId =
            charge.charge_id != null
              ? Number(charge.charge_id)
              : charge.id != null
                ? Number(charge.id)
                : null;
          // API may return unit (number) and currency (number); or unit_id/currency_id; or unit_details.unit_id / currency_details.currency_id
          const unitIdFromApi =
            charge.unit_id != null
              ? String(charge.unit_id)
              : charge.unit != null
                ? String(charge.unit)
                : unitDetails?.unit_id != null
                  ? String(unitDetails.unit_id)
                  : null;
          const currencyIdFromApi =
            charge.currency_id != null
              ? String(charge.currency_id)
              : charge.currency != null
                ? String(charge.currency)
                : currencyDetails?.currency_id != null
                  ? String(currencyDetails.currency_id)
                  : null;
          const unitByCode = unitCode
            ? unitDataArr.find((u) => (u.unit_code ?? "") === unitCode)
            : null;
          const currByCode = currencyCode
            ? currencyDataArr.find(
                (c) => (c.currency_code ?? c.code ?? "") === currencyCode,
              )
            : null;
          const unit_id =
            unitIdFromApi ??
            (unitByCode?.id != null ? String(unitByCode.id) : "");
          const currency_id =
            currencyIdFromApi ??
            (currByCode?.id != null ? String(currByCode.id) : "");

          const mapped = {
            id: charge.id != null ? Number(charge.id) : undefined,
            charge_id: chargeId,
            charge_name: charge.charge_name ? String(charge.charge_name) : "",
            supplier_code: charge.supplier_code
              ? String(charge.supplier_code)
              : "",
            supplier_name: charge.supplier_name
              ? String(charge.supplier_name)
              : "",
            pp_cc,
            unit_id,
            no_of_unit: toNum(charge.no_of_unit),
            currency_id,
            roe: toNum(charge.roe),
            amount_per_unit: toNum(charge.amount_per_unit),
            amount: toNum(charge.amount),
            // New fields (sell/cost) from API / job state
            local_amount: toNum(
              charge.sell_local_amount ?? charge.local_amount,
            ),
            cost_per_unit: toNum(charge.unit_cost ?? charge.cost_per_unit),
            total_cost: toNum(charge.total_cost),
            cost_local_amount: toNum(charge.cost_local_amount),
          };

          console.log("🧾 [AIR_IMPORT_HOUSE] load charges (initial effect)", {
            source:
              (editData as { charges?: unknown[] }).charges &&
              Array.isArray((editData as { charges: unknown[] }).charges) &&
              (editData as { charges: unknown[] }).charges.length > 0
                ? "charges"
                : "mawb_charges",
            raw: {
              sell_local_amount: (charge as { sell_local_amount?: unknown })
                .sell_local_amount,
              unit_cost: (charge as { unit_cost?: unknown }).unit_cost,
              total_cost: (charge as { total_cost?: unknown }).total_cost,
              cost_local_amount: (charge as { cost_local_amount?: unknown })
                .cost_local_amount,
            },
            mapped: {
              local_amount: mapped.local_amount,
              cost_per_unit: mapped.cost_per_unit,
              total_cost: mapped.total_cost,
              cost_local_amount: mapped.cost_local_amount,
            },
          });

          return mapped;
        },
      );
      const allChargeNotSet = loadedCharges
        .map((row, idx) => {
          const notSet: string[] = [];
          if (!row.charge_name?.trim()) notSet.push("charge_name");
          if (!row.pp_cc?.trim()) notSet.push("pp_cc");
          if (!row.unit_id?.trim()) notSet.push("unit_id");
          if (row.no_of_unit == null) notSet.push("no_of_unit");
          if (!row.currency_id?.trim()) notSet.push("currency_id");
          if (row.roe == null) notSet.push("roe");
          if (row.amount_per_unit == null) notSet.push("amount_per_unit");
          if (row.amount == null) notSet.push("amount");
          return { index: idx, fields: notSet };
        })
        .filter((x) => x.fields.length > 0);
      console.log("[AirHouseCreate] Charges loaded", {
        count: loadedCharges.length,
        rowsWithMissingFields: allChargeNotSet,
        loadedCharges,
      });
      if (loadedCharges.length > 0) {
        chargesForm.setValues({ charges: loadedCharges });
        console.log("[AirHouseCreate] Charges: setValues called", {
          count: loadedCharges.length,
          firstCharge: loadedCharges[0],
        });
      }
    }

    formInitializedFromEditDataRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editData, editIndex]);

  // Auto-calculate amount, local_amount, cost_local_amount when dependencies change
  // amount = no_of_unit * amount_per_unit
  // local_amount = amount * roe
  // cost_local_amount = total_cost * roe
  const chargeAmountPerUnits = chargesForm.values.charges
    .map((c) => c.amount_per_unit)
    .join(",");
  const chargeNoOfUnits = chargesForm.values.charges
    .map((c) => c.no_of_unit)
    .join(",");
  const chargeRoes = chargesForm.values.charges.map((c) => c.roe).join(",");
  const chargeAmounts = chargesForm.values.charges
    .map((c) => c.amount)
    .join(",");
  const chargeTotalCosts = chargesForm.values.charges
    .map((c) => c.total_cost)
    .join(",");

  useEffect(() => {
    const updatedCharges = chargesForm.values.charges.map((charge) => {
      const next = { ...charge };

      // Recalculate amount from no_of_unit and amount_per_unit
      if (
        charge.amount_per_unit !== null &&
        charge.amount_per_unit !== undefined &&
        charge.amount_per_unit > 0 &&
        charge.no_of_unit !== null &&
        charge.no_of_unit !== undefined &&
        charge.no_of_unit > 0
      ) {
        const amountPerUnit = charge.amount_per_unit || 0;
        const noOfUnit = charge.no_of_unit || 0;
        const calculatedAmount = clampCurrencyMoneyAmountBound(
          noOfUnit * amountPerUnit,
        );

        if (calculatedAmount > 0 && calculatedAmount !== charge.amount) {
          next.amount = calculatedAmount;
        }
      }

      // Recalculate local_amount (sell) from amount and roe
      if (
        next.amount !== null &&
        next.amount !== undefined &&
        next.amount > 0 &&
        next.roe !== null &&
        next.roe !== undefined &&
        next.roe > 0
      ) {
        const calculatedLocal = next.amount * next.roe;
        if (calculatedLocal !== next.local_amount) {
          next.local_amount = calculatedLocal;
        }
      } else {
        if (next.local_amount !== null && next.local_amount !== undefined) {
          next.local_amount = null;
        }
      }

      // Recalculate cost_local_amount from total_cost and roe
      if (
        next.total_cost !== null &&
        next.total_cost !== undefined &&
        next.total_cost > 0 &&
        next.roe !== null &&
        next.roe !== undefined &&
        next.roe > 0
      ) {
        const calculatedCostLocal = next.total_cost * next.roe;
        if (calculatedCostLocal !== next.cost_local_amount) {
          next.cost_local_amount = calculatedCostLocal;
        }
      } else {
        if (
          next.cost_local_amount !== null &&
          next.cost_local_amount !== undefined
        ) {
          next.cost_local_amount = null;
        }
      }

      return next;
    });

    // Only update if there are actual changes
    const hasChanges = updatedCharges.some((charge, index) => {
      const original = chargesForm.values.charges[index];
      return (
        charge.amount !== original?.amount ||
        charge.local_amount !== original?.local_amount ||
        charge.cost_local_amount !== original?.cost_local_amount
      );
    });

    if (hasChanges) {
      chargesForm.setValues({ charges: updatedCharges });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chargeAmountPerUnits,
    chargeNoOfUnits,
    chargeRoes,
    chargeAmounts,
    chargeTotalCosts,
  ]);

  // Salespersons data query
  const { data: rawSalespersonsData = [] } = useQuery({
    queryKey: ["salespersons", ""],
    queryFn: () => fetchSalespersons(""),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: true,
  });

  // Format salespersons data
  const salespersonsData = useMemo(() => {
    const response = rawSalespersonsData as SalespersonsResponse;
    if (
      !response?.data ||
      !Array.isArray(response.data) ||
      !response.data.length
    )
      return [];

    return response.data.map((item) => ({
      value: item.sales_person ? String(item.sales_person) : "",
      label: item.sales_person,
      sales_coordinator: item.sales_coordinator || "",
      customer_service: item.customer_service || "",
    }));
  }, [rawSalespersonsData]);

  // Currency master query
  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Unit master query - use AIR for Air Import House so units like SHPT are available
  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster", "AIR"],
    queryFn: () => fetchUnitMaster("AIR"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Format currency data: value = id, label = currency_code (for payload we send currency_id)
  const currencyOptions = useMemo(() => {
    if (!Array.isArray(currencyData)) return [];
    const data = currencyData as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    return data.map((item) => {
      const code = item.currency_code ?? item.code ?? "";
      const id = item.id != null ? String(item.id) : "";
      return { value: id || code, label: code || id || "" };
    });
  }, [currencyData]);

  const jobService = "AIR";

  const unitOptions = useMemo(
    () => buildJobUnitOptions(unitDataRaw),
    [unitDataRaw],
  );

  const bookingCargoForCharges = useMemo(
    () =>
      toBookingCargoForNoOfUnits(
        cargoDetails.map((cargo) => ({
          gross_weight: cargo.gross_weight,
          volume: cargo.volume,
          volume_weight: cargo.volume,
          chargeable_weight: cargo.chargeable_weight,
        })),
      ),
    [cargoDetails],
  );

  const cargoNoOfUnitsSyncKey = useMemo(
    () => buildBookingCargoNoOfUnitsSyncKey(jobService, bookingCargoForCharges),
    [bookingCargoForCharges],
  );

  useEffect(() => {
    if (!unitOptions.length) return;
    const updated = syncJobChargesWithCargoNoOfUnits(
      chargesForm.values.charges,
      jobService,
      bookingCargoForCharges,
      unitOptions,
    );
    if (updated) {
      chargesForm.setValues({ charges: updated });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargoNoOfUnitsSyncKey, unitOptions]);

  useEffect(() => {
    if (!unitOptions.length) return;
    const updated = mapJobChargesWithUnits(
      chargesForm.values.charges,
      jobService,
      bookingCargoForCharges,
      unitOptions,
    );
    if (updated) {
      chargesForm.setValues({ charges: updated });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitOptions, bookingCargoForCharges]);

  // When charge currency matches branch currency, ROE must always be 1
  const chargeCurrenciesKey = chargesForm.values.charges
    .map((c) => `${c.currency ?? ""}|${c.currency_id ?? ""}`)
    .join("|");
  useEffect(() => {
    const currencyArr = (currencyData ?? []) as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    let changed = false;
    const updatedCharges = chargesForm.values.charges.map((charge) => {
      if (isChargeBaseCurrencyFor(charge, currencyArr) && charge.roe !== 1) {
        changed = true;
        return { ...charge, roe: 1 };
      }
      return charge;
    });
    if (changed) chargesForm.setValues({ charges: updatedCharges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrenciesKey, currencyData]);

  useEffect(() => {
    const currencyArr = (currencyData ?? []) as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    chargesForm.values.charges.forEach((charge, index) => {
      if (!charge.currency_id || charge.roe != null) return;
      if (isChargeBaseCurrencyFor(charge, currencyArr)) return;
      const code = resolveCurrencyCode(charge, currencyArr);
      if (!code) return;
      void ensureRoeForCurrency(code).then((roe) => {
        if (chargesForm.values.charges[index]?.roe == null) {
          chargesForm.setFieldValue(`charges.${index}.roe`, roe);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrenciesKey, currencyData]);

  // When in edit mode and unit/currency masters load, resolve charge unit_id/currency_id from unit_code/currency
  const chargesIdsResolvedRef = useRef(false);
  useEffect(() => {
    const unitArr = Array.isArray(unitDataRaw) ? unitDataRaw : [];
    const currArr = Array.isArray(currencyData) ? currencyData : [];
    if (
      !isEditMode ||
      !editData ||
      unitArr.length === 0 ||
      currArr.length === 0 ||
      chargesIdsResolvedRef.current
    ) {
      return;
    }
    const rawCharges = (editData as { charges?: unknown }).charges;
    const rawMawbCharges = (editData as { mawb_charges?: unknown })
      .mawb_charges;
    const chargesArr = Array.isArray(rawCharges) ? rawCharges : null;
    const mawbArr = Array.isArray(rawMawbCharges) ? rawMawbCharges : null;
    const chargesToLoad =
      chargesArr && chargesArr.length > 0
        ? chargesArr
        : mawbArr && mawbArr.length > 0
          ? mawbArr
          : null;
    if (!chargesToLoad) return;
    const unitDataArr = unitArr as { id?: number; unit_code?: string }[];
    const currencyDataArr = currArr as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    const loadedCharges = chargesToLoad.map(
      (charge: Record<string, unknown>) => {
        const unitDetails = charge.unit_details as
          { unit_id?: number; unit_code?: string } | undefined;
        const currencyDetails = charge.currency_details as
          { currency_id?: number; currency_code?: string } | undefined;
        const unitCode = String(
          charge.unit_code ?? charge.unit_input ?? unitDetails?.unit_code ?? "",
        ).trim();
        const currencyCode = String(
          currencyDetails?.currency_code ?? charge.currency_code ?? "",
        ).trim();
        const pp_cc = normalizePpCc(charge.pp_cc);
        const toNum = (v: unknown): number | null => {
          if (v == null) return null;
          if (typeof v === "number" && !Number.isNaN(v)) return v;
          const n = parseFloat(String(v));
          return Number.isNaN(n) ? null : n;
        };
        const chargeId =
          charge.charge_id != null
            ? Number(charge.charge_id)
            : charge.id != null
              ? Number(charge.id)
              : null;
        const unitIdFromApi =
          charge.unit_id != null
            ? String(charge.unit_id)
            : charge.unit != null
              ? String(charge.unit)
              : unitDetails?.unit_id != null
                ? String(unitDetails.unit_id)
                : null;
        const currencyIdFromApi =
          charge.currency_id != null
            ? String(charge.currency_id)
            : charge.currency != null
              ? String(charge.currency)
              : currencyDetails?.currency_id != null
                ? String(currencyDetails.currency_id)
                : null;
        const unitByCode = unitCode
          ? unitDataArr.find((u) => (u.unit_code ?? "") === unitCode)
          : null;
        const currByCode = currencyCode
          ? currencyDataArr.find(
              (c) => (c.currency_code ?? c.code ?? "") === currencyCode,
            )
          : null;
        const unit_id =
          unitIdFromApi ??
          (unitByCode?.id != null ? String(unitByCode.id) : "");
        const currency_id =
          currencyIdFromApi ??
          (currByCode?.id != null ? String(currByCode.id) : "");
        return {
          id: charge.id != null ? Number(charge.id) : undefined,
          charge_id: chargeId,
          charge_name: charge.charge_name ? String(charge.charge_name) : "",
          pp_cc,
          unit_id,
          no_of_unit: toNum(charge.no_of_unit),
          currency_id,
          roe: toNum(charge.roe),
          amount_per_unit: toNum(charge.amount_per_unit),
          amount: toNum(charge.amount),
          local_amount: toNum(charge.sell_local_amount ?? charge.local_amount),
          cost_per_unit: toNum(charge.unit_cost ?? charge.cost_per_unit),
          total_cost: toNum(charge.total_cost),
          cost_local_amount: toNum(charge.cost_local_amount),
        };
      },
    );
    if (loadedCharges.length > 0) {
      const editCargoForCharges = toBookingCargoForNoOfUnits(
        ((editData.cargo_details as Array<Record<string, unknown>>) ?? []).map(
          (cargo) => ({
            gross_weight: importHouseCargoWeightFromApi(cargo.gross_weight),
            volume: importHouseCargoWeightFromApi(
              cargo.volume ?? cargo.volume_weight,
            ),
            volume_weight: importHouseCargoWeightFromApi(
              cargo.volume_weight ?? cargo.volume,
            ),
            chargeable_weight: importHouseCargoWeightFromApi(
              cargo.chargeable_weight,
            ),
          }),
        ),
      );
      chargesForm.setValues({
        charges:
          mapJobChargesWithUnits(
            loadedCharges,
            jobService,
            editCargoForCharges,
            buildJobUnitOptions(unitArr),
          ) ?? loadedCharges,
      });
      chargesIdsResolvedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editData, unitDataRaw, currencyData]);

  // Note: Container numbers removed for Air HAWB - no containerNumberOptions needed

  // Auto-set routed_by when routed is "self" and user data is available
  useEffect(() => {
    if (
      form.values.routed === "self" &&
      user?.full_name &&
      !form.values.routed_by
    ) {
      form.setFieldValue("routed_by", user.full_name);
    }
  }, [form.values.routed, user?.full_name, form]);

  // Clear routed_by when routed changes to something other than "agent" or "self"
  useEffect(() => {
    if (
      form.values.routed &&
      form.values.routed !== "agent" &&
      form.values.routed !== "self"
    ) {
      form.setFieldValue("routed_by", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.routed]);

  // Trade dropdown options
  const tradeOptions = [
    { value: "Import", label: "Import" },
    { value: "Transshipment", label: "Transshipment" },
    { value: "Re Export", label: "Re Export" },
  ];

  // Function to update Trade field based on destination comparison
  const updateTradeField = (hawbDestinationCode: string) => {
    console.log("🔄 updateTradeField called with:", hawbDestinationCode);
    const mawbDestinationCode =
      location.state?.mawbDetails?.destination_code ||
      location.state?.mawbDetails?.destination_code ||
      "";

    console.log("🔍 updateTradeField comparison:", {
      hawbDestinationCode,
      mawbDestinationCode,
      currentTradeValue: form.values.trade,
    });

    // Only update if both destinations exist
    if (hawbDestinationCode && mawbDestinationCode) {
      // Compare HAWB destination with MAWB destination
      const newTradeValue =
        hawbDestinationCode === mawbDestinationCode
          ? "Import"
          : "Transshipment";

      console.log("💡 updateTradeField calculated value:", newTradeValue);

      // Always update to ensure dropdown re-renders
      console.log("✏️ updateTradeField updating Trade to:", newTradeValue);
      form.setFieldValue("trade", newTradeValue);
      // Force form state update by setting values directly
      form.setValues({
        ...form.values,
        trade: newTradeValue,
      });
      console.log(
        "📊 updateTradeField after update, form.values.trade:",
        form.values.trade,
      );
    } else if (!hawbDestinationCode && form.values.trade) {
      // Clear trade if HAWB destination is cleared
      console.log("🧹 updateTradeField clearing Trade");
      form.setFieldValue("trade", "");
    }
  };

  // Auto-update Trade field whenever HAWB destination or MAWB destination changes
  useEffect(() => {
    const mawbDestinationCode =
      location.state?.mawbDetails?.destination_code || "";
    console.log("🔄 useEffect triggered for Trade update:", {
      destinationCode: form.values.destination_code,
      mawbDestinationCode,
      currentTradeValue: form.values.trade,
    });
    updateTradeField(form.values.destination_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.values.destination_code,
    location.state?.mawbDetails?.destination_code,
  ]);

  // Auto-set HAWB origin and destination from MAWB in create mode
  useEffect(() => {
    const mawbDetails = location.state?.mawbDetails;
    if (!isEditMode && mawbDetails) {
      const mawbOriginCode = mawbDetails.origin_code || "";
      const mawbOriginName = mawbDetails.origin_name || "";
      const mawbDestinationCode = mawbDetails.destination_code || "";
      const mawbDestinationName = mawbDetails.destination_name || "";

      // Set origin if not already set
      if (mawbOriginCode && !form.values.origin_code) {
        form.setFieldValue("origin_code", mawbOriginCode);
        if (mawbOriginName) {
          form.setFieldValue("origin_name", mawbOriginName);
        }
      }

      // Set destination if not already set
      if (mawbDestinationCode && !form.values.destination_code) {
        form.setFieldValue("destination_code", mawbDestinationCode);
        if (mawbDestinationName) {
          form.setFieldValue("destination_name", mawbDestinationName);
        }
        // Also trigger Trade update when destination is auto-set
        updateTradeField(mawbDestinationCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, location.state?.mawbDetails]);

  // Auto-update HAWB origin agent name and address from MAWB origin agent
  // Master sends origin_agent = code (for payload); we display and send customer name in house as agent_name, address as agent_address
  // In edit flow we may have origin_agent_address from API (e.g. agent_address) - only overwrite when master has new address data
  useEffect(() => {
    const mawbDetails =
      location.state?.mawbDetails || location.state?.mawbDetails;
    if (!mawbDetails) return;

    const mawbOriginAgentCode = mawbDetails.origin_agent || "";
    const mawbOriginAgentName =
      mawbDetails.origin_agent_name ||
      (mawbDetails.origin_agent_data as Record<string, unknown> | undefined)
        ?.customer_name ||
      "";
    const mawbOriginAgentData = mawbDetails.origin_agent_data as
      Record<string, unknown> | null | undefined;

    if (mawbOriginAgentCode && mawbOriginAgentCode.trim() !== "") {
      form.setFieldValue("origin_agent", mawbOriginAgentCode);
      // Origin Agent Name in house = customer name (for display and for payload agent_name)
      form.setFieldValue(
        "origin_agent_name",
        mawbOriginAgentName && mawbOriginAgentName.trim() !== ""
          ? mawbOriginAgentName
          : "",
      );

      // Origin Agent Address: only set when master has address data from agent selection.
      // Do not clear when master has no addresses_data (e.g. edit flow where we have agent_address from API).
      if (mawbOriginAgentData && mawbOriginAgentData.addresses_data) {
        const addressesData = Array.isArray(mawbOriginAgentData.addresses_data)
          ? (mawbOriginAgentData.addresses_data as Array<{
              id: number;
              address: string;
            }>)
          : null;

        if (
          addressesData &&
          addressesData.length > 0 &&
          addressesData[0].address
        ) {
          form.setFieldValue("origin_agent_address", addressesData[0].address);
        }
        // else: leave existing value (e.g. from editData.origin_agent_address / API agent_address)
      }
      // else: do not clear - preserve edit flow value (agent_address from API) or user input
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Auto-set routed_by to MAWB origin agent customer name when routed is "agent"
  useEffect(() => {
    if (form.values.routed === "agent") {
      const mawbDetails = location.state?.mawbDetails;
      if (!mawbDetails) return;

      // Use customer name (origin_agent_name or origin_agent_data.customer_name), not code
      let mawbOriginAgentName = mawbDetails.origin_agent_name || "";
      if (!mawbOriginAgentName && mawbDetails.origin_agent_data) {
        const originAgentData = mawbDetails.origin_agent_data as Record<
          string,
          unknown
        >;
        mawbOriginAgentName = (originAgentData.customer_name as string) || "";
      }

      if (mawbOriginAgentName && mawbOriginAgentName.trim() !== "") {
        if (
          !form.values.routed_by ||
          form.values.routed_by !== mawbOriginAgentName
        ) {
          form.setFieldValue("routed_by", mawbOriginAgentName);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.values.routed,
    location.state?.mawbDetails?.origin_agent,
    location.state?.mawbDetails?.origin_agent_name,
    location.state?.mawbDetails?.origin_agent_data,
  ]);

  // Validate step 1 - Validate required fields
  const validateStep1 = () => {
    const errors: Record<string, string> = {};

    if (!form.values.hawb_number?.trim()) {
      errors.hawb_number = "HAWB Number is required";
    }
    if (!form.values.origin_code?.trim()) {
      errors.origin_code = "Origin is required";
    }
    if (!form.values.destination_code?.trim()) {
      errors.destination_code = "Destination is required";
    }
    if (!form.values.trade?.trim()) {
      errors.trade = "Trade is required";
    }
    if (!form.values.shipment_terms_code?.trim()) {
      errors.shipment_terms_code = "Shipment Terms is required";
    }
    if (!form.values.routed?.trim()) {
      errors.routed = "Routed is required";
    }
    if (!form.values.routed_by?.trim()) {
      errors.routed_by = "Routed By is required";
    }

    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return false;
    }
    return true;
  };

  // Validate step 2 - Validate required fields and email format
  const validateStep2 = () => {
    const errors: Record<string, string> = {};

    // If shipper_name is empty but user has typed search text, sync it before validating.
    if (
      (!form.values.shipper_name || !form.values.shipper_name.trim()) &&
      shipperSearch.trim()
    ) {
      form.setFieldValue("shipper_name", shipperSearch.trim());
    }

    if (!form.values.shipper_name?.trim()) {
      errors.shipper_name = "Shipper Name is required";
    }
    if (!form.values.consignee_name?.trim()) {
      errors.consignee_name = "Consignee Name is required";
    }
    // Email validations
    if (
      form.values.shipper_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.shipper_email)
    ) {
      errors.shipper_email = "Invalid email format";
    }
    if (
      form.values.consignee_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.consignee_email)
    ) {
      errors.consignee_email = "Invalid email format";
    }
    if (
      form.values.origin_agent_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.origin_agent_email)
    ) {
      errors.origin_agent_email = "Invalid email format";
    }
    if (
      form.values.notify1_customer_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.notify1_customer_email)
    ) {
      errors.notify1_customer_email = "Invalid email format";
    }

    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return false;
    }
    return true;
  };

  // Validate step 3 - Cargo Details
  // Mandatory validations apply to both create and edit modes
  const validateStep3 = () => {
    const newErrors: Record<number, Record<string, string>> = {};
    let hasErrors = false;

    cargoDetails.forEach((cargo, index) => {
      const cargoError: Record<string, string> = {};

      // Mandatory fields: no_of_packages, gross_weight, volume (container_number removed for Air)
      if (cargo.no_of_packages === null || cargo.no_of_packages === undefined) {
        cargoError.no_of_packages = "No of Packages is required";
        hasErrors = true;
      }
      if (cargo.gross_weight === null || cargo.gross_weight === undefined) {
        cargoError.gross_weight = "Gross Weight is required";
        hasErrors = true;
      }
      if (cargo.volume === null || cargo.volume === undefined) {
        cargoError.volume = "Volume Weight is required";
        hasErrors = true;
      }

      if (Object.keys(cargoError).length > 0) {
        newErrors[index] = cargoError;
      }
    });

    setCargoErrors(newErrors);

    if (hasErrors) {
      return false;
    }
    return true;
  };

  // Validate step 4 - Charges (optional; only rows with user-entered data are validated/sent)
  const validateStep4 = () => {
    const currencyArr = (currencyData ?? []) as {
      id?: number;
      code?: string;
      currency_code?: string;
    }[];
    const result = validateMeaningfulHouseCharges(
      chargesForm.values.charges as HouseChargeLike[],
      (charge) =>
        validateRoeField(
          resolveCurrencyCode(charge, currencyArr),
          charge.roe,
          charge.currency_id,
        ),
      {
        roeCannotBeOneField: ROE_CANNOT_BE_ONE_FIELD,
        roeCannotBeOneToast: ROE_CANNOT_BE_ONE_TOAST,
      },
    );

    setChargeErrors(result.errors);

    if (!result.valid) {
      if (result.roeToastMessage) {
        ToastNotification({
          type: "error",
          message: result.roeToastMessage,
        });
      }
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
        setActive(2);
      }
    } else if (active === 2) {
      // Step 3: Validate cargo details before proceeding to Step 4
      if (validateStep3()) {
        setActive(3);
      }
    } else if (active === 3) {
      // Step 4: Validate charges before saving
      if (validateStep4()) {
        handleSave();
      }
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (active > 0) {
      setActive(active - 1);
    }
  };

  // Build current form as housing detail (for passing to invoice page)
  const getCurrentHousingDetail = () => {
    const v = form.values;
    return {
      hawb_number: v.hawb_number,
      ...formatChaHouseBlPayload(v),
      shipment_terms_code: v.shipment_terms_code,
      shipment_terms_name: v.shipment_terms_name,
      pp_cc: v.pp_cc || "Collect",
      routed: v.routed,
      routed_by: v.routed_by,
      origin_code: v.origin_code,
      origin_name: v.origin_name,
      destination_code: v.destination_code,
      destination_name: v.destination_name,
      customer_service: v.customer_service,
      trade: v.trade,
      origin_agent: v.origin_agent,
      origin_agent_name: v.origin_agent_name,
      origin_agent_address: v.origin_agent_address,
      origin_agent_email: v.origin_agent_email,
      cha_name: v.cha_name,
      cha_address: v.cha_address,
      shipper_name: v.shipper_name,
      shipper_address: v.shipper_address,
      shipper_email: v.shipper_email,
      // GST: prefer form value if present, else fall back to job.housing_details[editIndex]
      shipper_gst_id:
        (v as { shipper_gst_id?: string }).shipper_gst_id ??
        (
          location.state?.job as {
            housing_details?: Array<{ shipper_gst_id?: string | null }>;
          }
        )?.housing_details?.[editIndex ?? 0]?.shipper_gst_id ??
        null,
      shipper_state_id: v.shipper_state_id
        ? Number(v.shipper_state_id)
        : ((editData as { shipper_state_id?: number } | undefined)
            ?.shipper_state_id ??
          (
            location.state?.job as {
              housing_details?: Array<{ shipper_state_id?: number }>;
            }
          )?.housing_details?.[editIndex ?? 0]?.shipper_state_id ??
          null),
      shipment_id:
        (editData as { shipment_id?: string } | undefined)?.shipment_id ?? null,
      consignee_code: v.consignee_code,
      consignee_name: v.consignee_name,
      consignee_address: v.consignee_address,
      consignee_email: v.consignee_email,
      consignee_gst_id:
        (v as { consignee_gst_id?: string }).consignee_gst_id ??
        (
          location.state?.job as {
            housing_details?: Array<{ consignee_gst_id?: string | null }>;
          }
        )?.housing_details?.[editIndex ?? 0]?.consignee_gst_id ??
        null,
      notify1_customer_name: v.notify1_customer_name,
      notify1_customer_address: v.notify1_customer_address,
      notify1_customer_email: v.notify1_customer_email,
      commodity_description: v.commodity_description,
      marks_no: v.marks_no,
      note: v.note || "",
      item_no: v.item_no,
      sub_item_no: v.sub_item_no,
      ref_no: v.ref_no,
      cargo_details: cargoDetails,
      charges: getMeaningfulHouseCharges(chargesForm.values.charges),
    };
  };

  /** Builds HAWB list from current form (events, cargo, charges) for sync with Air Import Job. */
  const buildUpdatedHousingDetailsFromForm = () => {
    // Prepare cargo details (container_number removed for Air)
    // Keep payload stable; only round known numeric cargo fields to 2dp
    const cargoDetailsForPayload = cargoDetails.map((cargo) => ({
      ...cargo,
      gross_weight: formatHouseCargoWeightForPayload(
        (cargo as any).gross_weight,
      ),
      volume: formatHouseCargoWeightForPayload((cargo as any).volume),
      chargeable_weight: formatHouseCargoChargeableForPayload(
        (cargo as any).gross_weight,
        (cargo as any).volume,
        "air",
      ),
    }));

    // Get current form values - ensure we're using the latest form state
    const currentFormValues = form.values;

    console.log("💾 HAWB Form Save - Current Form Values:", {
      origin_code: currentFormValues.origin_code,
      origin_name: currentFormValues.origin_name,
      destination_code: currentFormValues.destination_code,
      destination_name: currentFormValues.destination_name,
      allValues: currentFormValues,
    });

    // Prepare housing detail object - use current form values (include id when editing for update payload)
    const houseId =
      isEditMode &&
      ((editData as { id?: number })?.id ??
        (
          existingHousingDetails[editIndex as number] as
            { id?: number } | undefined
        )?.id);
    const housingDetail = {
      ...(houseId != null && { id: Number(houseId) }),
      hawb_number: currentFormValues.hawb_number,
      ...formatChaHouseBlPayload(currentFormValues),
      shipment_terms_code: currentFormValues.shipment_terms_code,
      shipment_terms_name: currentFormValues.shipment_terms_name,
      pp_cc: currentFormValues.pp_cc || "Collect",
      routed: currentFormValues.routed,
      routed_by: currentFormValues.routed_by,
      origin_code: currentFormValues.origin_code,
      origin_name: currentFormValues.origin_name,
      destination_code: currentFormValues.destination_code,
      destination_name: currentFormValues.destination_name,
      customer_service: currentFormValues.customer_service,
      trade: currentFormValues.trade,
      origin_agent: currentFormValues.origin_agent,
      origin_agent_name: currentFormValues.origin_agent_name,
      origin_agent_address: currentFormValues.origin_agent_address,
      origin_agent_email: currentFormValues.origin_agent_email,
      cha_name: currentFormValues.cha_name,
      cha_address: currentFormValues.cha_address,
      shipper_code: currentFormValues.shipper_code,
      shipper_name: currentFormValues.shipper_name,
      shipper_address: currentFormValues.shipper_address,
      shipper_email: currentFormValues.shipper_email,
      shipper_state_id: currentFormValues.shipper_state_id
        ? Number(currentFormValues.shipper_state_id)
        : ((
            editData as
              { shipment_id?: string; shipper_state_id?: number } | undefined
          )?.shipper_state_id ?? null),
      shipment_id:
        (editData as { shipment_id?: string } | undefined)?.shipment_id ?? null,
      consignee_code: currentFormValues.consignee_code,
      consignee_name: currentFormValues.consignee_name,
      consignee_address: currentFormValues.consignee_address,
      consignee_email: currentFormValues.consignee_email,
      notify1_customer_name: currentFormValues.notify1_customer_name,
      notify1_customer_address: currentFormValues.notify1_customer_address,
      notify1_customer_email: currentFormValues.notify1_customer_email,
      commodity_description: currentFormValues.commodity_description,
      marks_no: currentFormValues.marks_no,
      note: currentFormValues.note || "",
      item_no: currentFormValues.item_no,
      sub_item_no: currentFormValues.sub_item_no,
      ref_no: currentFormValues.ref_no,
      events: currentFormValues.events ?? [],
      cargo_details: cargoDetailsForPayload,
      charges: getMeaningfulHouseCharges(chargesForm.values.charges),
      ...(similarBookingId != null && { booking_id: similarBookingId }),
      ...pickHouseDocumentFields(housePageDocuments.getNavigationState()),
    };

    // Update existing housing details
    let updatedHousingDetails: typeof existingHousingDetails;

    if (isEditMode && editIndex !== undefined) {
      // Replace the existing item at editIndex
      updatedHousingDetails = [...existingHousingDetails];
      updatedHousingDetails[editIndex] = housingDetail;
    } else {
      // Add new housing detail
      updatedHousingDetails = [...existingHousingDetails, housingDetail];
    }

    return updatedHousingDetails;
  };

  const navigateToJobWithHousingList = (
    updatedHousingDetails: typeof existingHousingDetails,
  ) => {
    const isInEditMode = location.state?.job && location.state.job.id;
    const navigatePath = isViewOnly
      ? `${jobModuleBasePath}/view`
      : isInEditMode
        ? `${jobModuleBasePath}/edit`
        : `${jobModuleBasePath}/create`;

    navigate(navigatePath, {
      state: {
        fromHouseCreate: true,
        hawbDetails: updatedHousingDetails,
        housingDetails: updatedHousingDetails,
        ...(isViewOnly && { viewMode: true, actionType: "view" }),
        ...(location.state?.fromGlobalSearch && {
          fromGlobalSearch: location.state.fromGlobalSearch,
        }),
        ...(location.state?.job && {
          job: {
            ...location.state.job,
            housing_details: updatedHousingDetails,
          },
        }),
        ...(location.state?.mawbDetails && {
          mawbDetails: location.state.mawbDetails,
        }),
        ...(location.state?.carrierDetails && {
          carrierDetails: location.state.carrierDetails,
        }),
        ...(location.state?.routings && {
          routings: location.state.routings,
        }),
        ...(location.state?.estimates && {
          estimates: location.state.estimates,
        }),
        ...spreadMasterDocumentsNavState(
          location.state as Record<string, unknown> | undefined,
        ),
      },
    });
  };

  const handleSave = () => {
    if (isViewOnly) return;
    navigateToJobWithHousingList(buildUpdatedHousingDetailsFromForm());
  };

  const housingAlreadyHasEventType = (
    events: unknown,
    eventType: string,
  ): boolean =>
    Array.isArray(events) &&
    events.some((e: { type?: string }) => String(e?.type ?? "") === eventType);

  const patchHousingPdfReleasedEvent = async (eventType: string) => {
    const jobId = location.state?.job?.id;
    const rawHousingId = editData?.id;
    if (!jobId || rawHousingId == null) return;

    const housingId =
      typeof rawHousingId === "number" ? rawHousingId : Number(rawHousingId);
    if (!housingId) return;
    if (housingAlreadyHasEventType(form.values.events, eventType)) return;

    const date = new Date().toISOString().slice(0, 10);

    // Optimistic update: shows event in modal immediately and blocks re-clicks
    const optimisticEvents = [
      ...(form.values.events ?? []),
      { type: eventType, date },
    ];
    form.setFieldValue("events", optimisticEvents);
    form.setFieldValue(
      "event_modal_rows",
      eventsToEventModalRows(optimisticEvents),
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
      form.setFieldValue("events", nextEvents);
      form.setFieldValue(
        "event_modal_rows",
        eventsToEventModalRows(nextEvents),
      );
    }
  };

  // Generate PDF preview from current form data
  const generatePDFPreview = async (showCharges: boolean) => {
    try {
      setPreviewOpen(true);

      // Get default branch from user store or use default
      const defaultBranch = user?.branches?.find(
        (branch) => branch.is_default,
      ) ||
        user?.branches?.[0] || { branch_name: "CHENNAI" };
      const country = user?.country || null;

      // Build hawb data from current form
      const hawbData = {
        hawb_number: form.values.hawb_number,
        hawb_no: form.values.hawb_number,
        routed: form.values.routed,
        routed_by: form.values.routed_by,
        origin_code: form.values.origin_code,
        origin_name: form.values.origin_name,
        destination_code: form.values.destination_code,
        destination_name: form.values.destination_name,
        customer_service: form.values.customer_service,
        trade: form.values.trade,
        origin_agent_name: form.values.origin_agent_name,
        origin_agent_address: form.values.origin_agent_address,
        origin_agent_email: form.values.origin_agent_email,
        shipper_name: form.values.shipper_name,
        shipper_address: form.values.shipper_address,
        shipper_email: form.values.shipper_email,
        shipment_id:
          (editData as { shipment_id?: string } | undefined)?.shipment_id ??
          null,
        consignee_name: form.values.consignee_name,
        consignee_address: form.values.consignee_address,
        consignee_email: form.values.consignee_email,
        notify1_customer_name: form.values.notify1_customer_name,
        notify1_customer_address: form.values.notify1_customer_address,
        notify1_customer_email: form.values.notify1_customer_email,
        commodity_description: form.values.commodity_description,
        marks_no: form.values.marks_no,
        note: form.values.note || "",
        cargo_details: cargoDetails.map((cargo) => {
          const packageTypeName =
            resolvePackageTypeName(
              cargo.package_type,
              packageTypeOptions,
            ) || String((cargo as { package_type_name?: string }).package_type_name ?? "").trim();
          return {
            package_type: normalizePackageTypeCode(cargo.package_type) || "",
            package_type_code: normalizePackageTypeCode(cargo.package_type) || null,
            package_type_name: packageTypeName,
            no_of_packages: cargo.no_of_packages,
            gross_weight: formatHouseCargoWeightForPayload(cargo.gross_weight),
            volume: formatHouseCargoWeightForPayload(cargo.volume),
            chargeable_weight: formatHouseCargoChargeableForPayload(
              cargo.gross_weight,
              cargo.volume,
              "air",
            ),
            haz: cargo.haz === "Yes",
          };
        }),
        mawb_charges: (() => {
          const meaningfulCharges = getMeaningfulHouseCharges(
            chargesForm.values.charges as HouseChargeLike[],
          ) as ChargeDetail[];
          if (meaningfulCharges.length === 0) return [];
          return meaningfulCharges.map((charge) => ({
            ...(charge.id != null &&
              charge.id !== undefined && { id: Number(charge.id) }),
            charge_id: charge.charge_id ?? null,
            pp_cc: charge.pp_cc || "",
            unit_id: charge.unit_id ? Number(charge.unit_id) : null,
            currency_id: charge.currency_id ? Number(charge.currency_id) : null,
            no_of_unit: roundToDecimals(charge.no_of_unit) ?? null,
            roe: roundRoeForPayload(charge.roe) ?? null,
            amount_per_unit: roundMoneyToDecimals(charge.amount_per_unit) ?? null,
            amount: roundMoneyToDecimals(charge.amount) ?? null,
            sell_local_amount: roundLocalMoneyToDecimals(charge.local_amount) ?? null,
            unit_cost: roundMoneyToDecimals(charge.cost_per_unit) ?? null,
            total_cost: roundMoneyToDecimals(charge.total_cost) ?? null,
            cost_local_amount:
              roundLocalMoneyToDecimals(charge.cost_local_amount) ?? null,
            supplier_code: charge.supplier_code || null,
            supplier_name: charge.supplier_name || null,
          }));
        })(),
      };

      // Build job data from location state
      const jobData = {
        service: location.state?.mawbDetails?.service || "AIR",
        service_type: "Import",
        ...location.state?.mawbDetails,
        ...location.state?.carrierDetails,
        notes: location.state?.job?.notes || [],
      };

      const blobUrl = await previewCargoArrivalNoticePDF(
        jobData,
        hawbData,
        defaultBranch,
        country,
        { showCharges },
      );
      setPdfBlob(blobUrl);
      void patchHousingPdfReleasedEvent("CAN Released").catch((e) =>
        console.error("Failed to patch PDF release event:", e),
      );
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
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
  };

  // Handle download PDF
  const handleDownloadPDF = () => {
    if (pdfBlob) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `Cargo-Arrival-Notice-${form.values.hawb_number || "HAWB"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  const handleOpenSendEmailForCan = () => {
    setActivePdfBlob(pdfBlob);
    setActiveFileName(
      `Cargo-Arrival-Notice-${form.values.hawb_number || "HAWB"}.pdf`,
    );
    setActiveDocumentLabel("Cargo Arrival Notice");
    openSendEmail();
  };

  return (
    <Box p="md" mx="auto">
      <Group justify="space-between" mb="lg">
        <Group gap="md">
          <Text size="xl" fw={600} c="#105476">
            {isViewOnly
              ? "View HAWB Details"
              : isEditMode
                ? "Edit HAWB Details"
                : "Create HAWB Details"}
          </Text>
          {isEditMode && editData?.shipment_id && (
            <Badge color="#105476" size="md" variant="light">
              Shipment ID: {editData.shipment_id}
            </Badge>
          )}
        </Group>
        {/* Save button moved to top */}
        <Group>
          {/* <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() =>
              navigate("/SeaExport/import-job/create", {
                state: {
                  housingDetails: existingHousingDetails,
                  // Preserve any existing job data
                  ...(location.state?.job && { job: location.state.job }),
                  // Preserve form state when navigating back
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
              })
            }
          >
            Back to Import Job
          </Button> */}
          {!isViewOnly && (
          <Button
            color="#105476"
            variant="outline"
            onClick={() => {
              // Save HBL button: Validate all steps before saving
              // If on step 0, 1, or 2, validate current step and show errors
              // If on step 3, validate all steps (1, 2, 3, 4) before saving
              if (active === 0) {
                if (!validateStep1()) {
                  // Errors are already set, just return
                  return;
                }
                // If step 1 is valid, continue to validate all steps
                if (!validateStep2()) {
                  setActive(1); // Navigate to step 2 to show errors
                  return;
                }
                if (!validateStep3()) {
                  setActive(2); // Navigate to step 3 to show errors
                  return;
                }
                if (!validateStep4()) {
                  setActive(3); // Navigate to step 4 to show errors
                  return;
                }
                // All validations passed, save
                handleSave();
              } else if (active === 1) {
                if (!validateStep2()) {
                  return;
                }
                if (!validateStep3()) {
                  setActive(2);
                  return;
                }
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              } else if (active === 2) {
                if (!validateStep3()) {
                  return;
                }
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              } else if (active === 3) {
                if (!validateStep4()) {
                  return;
                }
                handleSave();
              } else if (active === 4) {
                if (!validateStep1()) {
                  setActive(0);
                  return;
                }
                if (!validateStep2()) {
                  setActive(1);
                  return;
                }
                if (!validateStep3()) {
                  setActive(2);
                  return;
                }
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              }
            }}
          >
            Save HBL
          </Button>
          )}
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

            <Menu.Dropdown styles={JOB_HOUSE_ACTION_MENU_DROPDOWN_STYLES}>
              {/* Cargo Arrival Notice */}
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
                onClick={() => setCanChargesModalOpen(true)}
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
                onClick={() => {
                  ToastNotification({
                    type: "info",
                    message: "Delivery Order preview coming soon",
                  });
                }}
              >
                Deliver Order
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
                    <IconCalendar size={16} color="#105476" />
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
                onClick={openEventsModalFromMenu}
              >
                Events
              </Menu.Item>

              {!isReadOnly && (
                <>
                  <HouseCreateAgentInvoiceMenuItem
                    invoicePath="/air/import-job/invoice"
                    serviceType="AIR"
                    getCurrentHousingDetail={getCurrentHousingDetail}
                    jobId={location.state?.job?.id}
                  />

                  <HouseAutomateVendorInvoiceMenuItem
                    getCurrentHousingDetail={getCurrentHousingDetail}
                    jobId={location.state?.job?.id}
                    onOpen={openVendorInvoiceAutomation}
                  />
                </>
              )}

              <HouseJobLedgerMenuItem
                serviceName="Air Import"
                getHouseDetail={getCurrentHousingDetail}
              />
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Modal
        opened={eventsModalOpen}
        onClose={() => setEventsModalOpen(false)}
        title="Events"
        centered
        size="xl"
        styles={{ content: { maxWidth: 640 } }}
      >
        <Stack gap="md">
          {form.values.event_modal_rows.length > 0 && (
            <Grid gutter="sm" style={{ fontWeight: 600, color: "#105476" }}>
              <Grid.Col span={5}>
                <RequiredLabel label="Event Type" required={false} />
              </Grid.Col>
              <Grid.Col span={5}>
                <RequiredLabel label="Event Date" required={false} />
              </Grid.Col>
              <Grid.Col span={2}>
                <RequiredLabel label="Actions" required={false} />
              </Grid.Col>
            </Grid>
          )}

          {form.values.event_modal_rows.map((row, index) => (
            <Grid key={index} align="flex-start" gutter="sm">
              <Grid.Col span={5}>
                <Select
                  placeholder="Select event type"
                  data={eventTypeOptions}
                  value={row.eventType}
                  onChange={(value) =>
                    updateEventRow(index, "eventType", value ?? null)
                  }
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={5}>
                <SingleDateInput
                  placeholder="Pick date"
                  value={row.eventDate}
                  onChange={(value) =>
                    updateEventRow(index, "eventDate", value ?? null)
                  }
                  size="sm"
                />
              </Grid.Col>
              <Grid.Col
                span={2}
                style={{ display: "flex", gap: 4, marginBottom: 4 }}
              >
                {form.values.event_modal_rows.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    onClick={() => removeEventRow(index)}
                    title="Remove row"
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                )}
                {index === form.values.event_modal_rows.length - 1 && (
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="lg"
                    onClick={addEventRow}
                    title="Add row"
                  >
                    <IconPlus size={18} />
                  </ActionIcon>
                )}
              </Grid.Col>
            </Grid>
          ))}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setEventsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEventsModal}>Save Events</Button>
          </Group>
        </Stack>
      </Modal>

      <Tabs
        value={String(active)}
        onChange={(v) => v !== null && setActive(Number(v))}
        color="#105476"
        {...getJobFormReadOnlyTabProps(isReadOnly)}
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
            Shipment Details
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
            Cargo Details
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
            Charges
          </Tabs.Tab>
          {isEditMode && (
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

        <Tabs.Panel value="0">
          <Group align="center" mb="xs">
            <Text size="md" fw={600} c="#105476">
              Shipment Details
            </Text>
          </Group>

          <Box mt="md">
            <Grid>
              <Grid.Col span={4}>
                <FormTextInput
                  format="capital"
                  label="HAWB Number"
                  required
                  placeholder="Enter HAWB Number"
                  {...form.getInputProps("hawb_number")}
                  error={form.errors.hawb_number}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <SearchableSelect
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type origin code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={form.values.origin_code || null}
                  displayValue={
                    form.values.origin_name && form.values.origin_code
                      ? `${form.values.origin_name} (${form.values.origin_code})`
                      : form.values.origin_code || null
                  }
                  onChange={(value, selectedData) => {
                    // Handle both selection and clearing (value will be null when cleared)
                    form.setFieldValue("origin_code", value || "");
                    if (selectedData) {
                      const portName = selectedData.label.split(" (")[0] || "";
                      form.setFieldValue("origin_name", portName);
                    } else if (!value) {
                      form.setFieldValue("origin_name", "");
                    }
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={form.errors.origin_code as string}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <SearchableSelect
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type destination code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={form.values.destination_code || null}
                  displayValue={
                    form.values.destination_name && form.values.destination_code
                      ? `${form.values.destination_name} (${form.values.destination_code})`
                      : form.values.destination_code || null
                  }
                  onChange={(value, selectedData) => {
                    console.log("🚀 Destination onChange triggered", {
                      value,
                      selectedData,
                    });
                    const hblDestinationCode = value || "";

                    // Update destination fields first
                    form.setFieldValue("destination_code", hblDestinationCode);
                    if (selectedData) {
                      const portName = selectedData.label.split(" (")[0] || "";
                      form.setFieldValue("destination_name", portName);
                    } else if (!value) {
                      form.setFieldValue("destination_name", "");
                    }

                    // Update Trade field immediately based on comparison
                    const mawbDestinationCode =
                      location.state?.mawbDetails?.destination_code || "";

                    console.log("🔍 Comparing destinations:", {
                      hblDestinationCode,
                      mawbDestinationCode,
                      match: hblDestinationCode === mawbDestinationCode,
                    });

                    if (hblDestinationCode && mawbDestinationCode) {
                      // Compare HBL destination with MAWB destination
                      const newTradeValue =
                        hblDestinationCode === mawbDestinationCode
                          ? "Import"
                          : "Transshipment";
                      console.log("✅ Setting Trade value:", newTradeValue);
                      // Use setValues to ensure state is properly updated
                      form.setValues({
                        ...form.values,
                        destination_code: hblDestinationCode,
                        destination_name: selectedData
                          ? selectedData.label.split(" (")[0] || ""
                          : "",
                        trade: newTradeValue,
                      });
                      console.log(
                        "📝 After setValues, form.values.trade:",
                        form.values.trade,
                      );
                    } else if (!hblDestinationCode) {
                      // Clear trade if HBL destination is cleared
                      console.log("🧹 Clearing Trade (no HBL destination)");
                      form.setFieldValue("trade", "");
                    } else {
                      console.log(
                        "⚠️ No MAWB destination found, cannot update Trade",
                      );
                    }
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={form.errors.destination_code as string}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  key={`trade-${form.values.trade}`}
                  label="Trade"
                  required
                  placeholder="Select Trade"
                  searchable
                  data={tradeOptions}
                  value={form.values.trade || null}
                  onChange={(value) => {
                    console.log(
                      "📥 Trade Dropdown onChange triggered with value:",
                      value,
                    );
                    form.setFieldValue("trade", value || "");
                    console.log(
                      "📝 Trade Dropdown after setFieldValue, form.values.trade:",
                      form.values.trade,
                    );
                  }}
                  error={form.errors.trade}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  label="Shipment Terms"
                  required
                  placeholder="Select Shipment Terms"
                  searchable
                  data={shipmentOptions}
                  value={form.values.shipment_terms_code}
                  onChange={(value) => {
                    applyShipmentTermsSelection(
                      form.setFieldValue,
                      termsOfShipment,
                      value,
                      { freightField: "pp_cc" },
                    );
                  }}
                  error={form.errors.shipment_terms_code}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  label="Freight"
                  placeholder="Select Freight"
                  searchable
                  data={[
                    { value: "Prepaid", label: "Prepaid" },
                    { value: "Collect", label: "Collect" },
                  ]}
                  {...form.getInputProps("pp_cc")}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
                  label="Routed"
                  required
                  placeholder="Select Routed"
                  searchable
                  data={[
                    { value: "self", label: "Self" },
                    { value: "agent", label: "Agent" },
                  ]}
                  {...form.getInputProps("routed")}
                  error={form.errors.routed}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {form.values.routed === "self" ? (
                  salespersonsData.length > 0 ? (
                    <Dropdown
                      label="Routed By"
                      required
                      placeholder="Select salesperson"
                      searchable
                      data={salespersonsData}
                      value={form.values.routed_by}
                      onChange={(value) => {
                        form.setFieldValue("routed_by", value || "");
                      }}
                      error={form.errors.routed_by}
                    />
                  ) : (
                    <FormTextInput
                      label="Routed By"
                      required
                      placeholder="Enter routed by"
                      {...form.getInputProps("routed_by")}
                      error={form.errors.routed_by}
                    />
                  )
                ) : form.values.routed === "agent" ? (
                  <SearchableSelect
                    label="Routed By"
                    required
                    placeholder="Type agent name"
                    apiEndpoint={URL.agent}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_name),
                      label: String(item.customer_name),
                    })}
                    value={form.values.routed_by}
                    displayValue={form.values.routed_by}
                    onChange={(value) => {
                      form.setFieldValue("routed_by", value || "");
                    }}
                    error={form.errors.routed_by as string}
                    minSearchLength={2}
                  />
                ) : (
                  <FormTextInput
                    label="Routed By"
                    required
                    placeholder="Enter routed by"
                    {...form.getInputProps("routed_by")}
                    error={form.errors.routed_by}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Customer Service"
                  placeholder="Enter Customer Service"
                  value={form.values.customer_service}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.target.value);
                    form.setFieldValue("customer_service", formattedValue);
                  }}
                  error={form.errors.customer_service}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <FormTextInput
                  format="capital"
                  label="Item Number"
                  placeholder="Enter Item Number"
                  {...form.getInputProps("item_no")}
                  error={form.errors.item_no}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <FormTextInput
                  format="capital"
                  label="Sub Item Number"
                  placeholder="Enter Sub Item Number"
                  {...form.getInputProps("sub_item_no")}
                  error={form.errors.sub_item_no}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <FormTextInput
                  format="capital"
                  label="Customer Ref No"
                  placeholder="Enter Customer Ref No"
                  {...form.getInputProps("ref_no")}
                  error={form.errors.ref_no}
                />
              </Grid.Col>

              <ChaHouseBlFormFields isChaMode={isChaMode} form={form} />

              <Grid.Col span={3}>
                <FormTextArea
                  label="Note/Remark"
                  placeholder="Enter note / remark"
                  minRows={2}
                  size="sm"
                  radius="sm"
                  {...form.getInputProps("note")}
                />
              </Grid.Col>
            </Grid>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="1">
          <Box mt="md">
            {/* Shipper Section */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Shipper
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                {shipperManualMode && shipperSearch.trim().length >= 2 ? (
                  <FormTextInput
                    label="Shipper Name"
                    required
                    placeholder="Enter shipper name"
                    value={shipperSearch}
                    onChange={(e) => {
                      const v = toTitleCase(e.currentTarget.value);
                      setShipperSearch(v);
                      form.setFieldValue("shipper_name", v);
                      form.setFieldValue("shipper_code", "");
                      if (!v.trim()) {
                        form.setFieldValue("shipper_address", "");
                        form.setFieldValue("shipper_email", "");
                        form.setFieldValue("shipper_state_id", "");
                        setShipperAddressOptions([]);
                        setShipperAddressCustom(false);
                        setShipperAddressSearch("");
                      }
                    }}
                    error={form.errors.shipper_name as string}
                  />
                ) : (
                  <Select
                    label="Shipper Name"
                    required
                    placeholder="Select or search shipper"
                    searchable
                    clearable
                    data={shipperOptions}
                    searchValue={shipperSearch}
                    onSearchChange={(value) => {
                      const v = toTitleCase(value);
                      setShipperSearch(v);
                      debouncedShipperSearch(v);
                    }}
                    value={form.values.shipper_code || ""}
                    onChange={(value) => {
                      if (!value) {
                        form.setFieldValue("shipper_code", "");
                        form.setFieldValue("shipper_name", "");
                        form.setFieldValue("shipper_address", "");
                        form.setFieldValue("shipper_email", "");
                        form.setFieldValue("shipper_state_id", "");
                        setShipperAddressOptions([]);
                        setShipperAddressCustom(false);
                        setShipperAddressSearch("");
                        setShipperSearch("");
                        return;
                      }
                      const original = shipperDataRef.current[value] || {};
                      const name = String(
                        (original as Record<string, unknown>).customer_name ||
                          "",
                      );
                      const addressesData = getPartyAddresses(
                        original as Record<string, unknown>,
                      );
                      const addressOptions = mapShipmentPartyAddressOptions(
                        original as Record<string, unknown>,
                        toTitleCase,
                      );
                      form.setFieldValue("shipper_address", "");
                      setShipperAddressOptions(addressOptions);
                      setShipperAddressCustom(false);

                      const addressesDataFull = Array.isArray(
                        (original as Record<string, unknown>).addresses_data,
                      )
                        ? ((original as Record<string, unknown>)
                            .addresses_data as Array<{
                            address?: string;
                            email?: string;
                            state_id?: number | null;
                            address_type?: string | null;
                          }>)
                        : [];
                      const primaryAddr =
                        pickPrimaryPartyAddress(addressesDataFull);
                      const primaryAddressValue = primaryAddr?.address
                        ? toTitleCase(String(primaryAddr.address))
                        : addressOptions[0]?.value || "";
                      const primaryEmail =
                        addressOptions.find(
                          (item) => item.value === primaryAddressValue,
                        )?.email ||
                        addressOptions[0]?.email ||
                        "";

                      if (primaryAddressValue) {
                        form.setFieldValue("shipper_address", primaryAddressValue);
                        setShipperAddressSearch(primaryAddressValue);
                      } else {
                        form.setFieldValue("shipper_address", "");
                        setShipperAddressSearch("");
                      }

                      const addrWithState =
                        (primaryAddr?.state_id != null ? primaryAddr : null) ||
                        addressesData.find((a) => a.state_id != null);
                      if (addrWithState?.state_id != null) {
                        form.setFieldValue(
                          "shipper_state_id",
                          String(addrWithState.state_id),
                        );
                      } else {
                        form.setFieldValue("shipper_state_id", "");
                      }

                      form.setFieldValue("shipper_code", value);
                      form.setFieldValue("shipper_name", toTitleCase(name));
                      form.setFieldValue("shipper_email", primaryEmail);
                      setShipperSearch(name);
                    }}
                    comboboxProps={{ zIndex: 10 }}
                    styles={{
                      input: {
                        fontSize: "13px",
                        height: "36px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                    nothingFoundMessage="No shipper found - type to enter new shipper"
                    error={form.errors.shipper_name as string}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Shipper Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Shipper Email"
                  {...form.getInputProps("shipper_email")}
                  error={form.errors.shipper_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {shouldUseCustomShipmentPartyAddress(
                  shipperAddressCustom,
                  form.values.shipper_address || "",
                  shipperAddressOptions,
                ) ? (
                  <FormTextInput
                    label="Shipper Address"
                    placeholder="Enter shipper address"
                    value={form.values.shipper_address || ""}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue("shipper_address", formattedValue);
                      if (!formattedValue.trim()) {
                        setShipperAddressCustom(false);
                        setShipperAddressSearch("");
                      }
                    }}
                    error={form.errors.shipper_address}
                  />
                ) : (
                  <Dropdown
                    key={`shipper-address-${form.values.shipper_code || "none"}`}
                    label="Shipper Address"
                    placeholder="Select shipper address"
                    searchable
                    data={shipperAddressOptions}
                    value={form.values.shipper_address || ""}
                    searchValue={shipperAddressSearch}
                    onSearchChange={(value) => {
                      setShipperAddressSearch(value);
                      if (
                        value.trim() &&
                        !shipmentPartyAddressMatchesSearch(shipperAddressOptions, value)
                      ) {
                        setShipperAddressCustom(true);
                        form.setFieldValue("shipper_address", value);
                        form.setFieldValue("shipper_email", "");
                      }
                    }}
                    onChange={(value) => {
                      form.setFieldValue("shipper_address", value || "");
                      if (value) {
                        const selected = shipperAddressOptions.find(
                          (item) => item.value === value,
                        );
                        form.setFieldValue(
                          "shipper_email",
                          selected?.email || "",
                        );
                      }
                      setShipperAddressSearch(value || "");
                      setShipperAddressCustom(false);
                    }}
                    error={form.errors.shipper_address}
                  />
                )}
              </Grid.Col>
            </Grid>

            {/* Consignee Section */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Consignee
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Consignee Name"
                  required
                  placeholder="Type consignee name"
                  apiEndpoint={URL.consignee}
                  dropdownZIndex={10}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code),
                    label: String(item.customer_name),
                  })}
                  value={form.values.consignee_code}
                  displayValue={form.values.consignee_name}
                  onChange={(value, selectedData, originalData) => {
                    if (!value) {
                      form.setFieldValue("consignee_code", "");
                      form.setFieldValue("consignee_name", "");
                      form.setFieldValue("consignee_email", "");
                      form.setFieldValue("consignee_address", "");
                      setConsigneeAddressOptions([]);
                      return;
                    }
                    form.setFieldValue("consignee_code", value || "");
                    form.setFieldValue(
                      "consignee_name",
                      selectedData?.label || "",
                    );

                    // Map email + addresses from customer-master response (addresses_data)
                    const original = (originalData || {}) as Record<
                      string,
                      unknown
                    >;
                    const email = String(
                      original.customer_email ?? original.email ?? "",
                    );

                    const addressesData = Array.isArray(original.addresses_data)
                      ? (original.addresses_data as Array<{
                          address?: string;
                          email?: string;
                          address_type?: string | null;
                        }>)
                      : [];
                    const addressOptions = addressesData
                      .filter((a) => a.address)
                      .map((a) => {
                        const addr = toTitleCase(String(a.address || ""));
                          return {
                            value: addr,
                            label: addr,
                            email: String(a.email || ""),
                          };
                      });
                    setConsigneeAddressOptions(addressOptions);

                    const primaryAddr = pickPrimaryPartyAddress(addressesData);
                    form.setFieldValue(
                      "consignee_email",
                      String(primaryAddr?.email || email || ""),
                    );

                    if (primaryAddr?.address) {
                      form.setFieldValue(
                        "consignee_address",
                        toTitleCase(String(primaryAddr.address)),
                      );
                    }
                    // If customer has no address list, keep any typed value
                  }}
                  returnOriginalData={true}
                  error={form.errors.consignee_name as string}
                  minSearchLength={3}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Consignee Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Consignee Email"
                  {...form.getInputProps("consignee_email")}
                  error={form.errors.consignee_email}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {consigneeAddressOptions.length > 0 ? (
                  <Dropdown
                    label="Consignee Address"
                    placeholder="Select consignee address"
                    searchable
                    data={consigneeAddressOptions}
                    value={form.values.consignee_address || ""}
                    onChange={(value) => {
                      form.setFieldValue("consignee_address", value || "");
                      if (value) {
                        const selected = consigneeAddressOptions.find(
                          (item) => item.value === value,
                        );
                        form.setFieldValue(
                          "consignee_email",
                          selected?.email || "",
                        );
                      }
                    }}
                    error={form.errors.consignee_address}
                  />
                ) : (
                  <FormTextInput
                    label="Consignee Address"
                    placeholder="Enter consignee address"
                    value={form.values.consignee_address || ""}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue("consignee_address", formattedValue);
                    }}
                    error={form.errors.consignee_address}
                  />
                )}
              </Grid.Col>
            </Grid>

            {/* Notify Customer 1 Details - same payload/response keys as Import booking steppers */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Notify Customer Details
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Notify Customer Name"
                  placeholder="Type notify customer name"
                  apiEndpoint={URL.consignee}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code),
                    label: String(item.customer_name),
                  })}
                  value={
                    form.values.notify1_customer_name
                      ? String(form.values.notify1_customer_name)
                      : ""
                  }
                  displayValue={form.values.notify1_customer_name}
                  onChange={(value, selectedData, originalData) => {
                    const newValue = selectedData?.label || value || "";

                    form.setFieldValue("notify1_customer_name", newValue);

                    // Use originalData to populate address options (same pattern as consignee/reference)
                    if (
                      newValue &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      const addressesData = (
                        (originalData as Record<string, unknown>)
                          .addresses_data as Array<{
                          id: number;
                          address: string;
                          email?: string;
                          address_type?: string;
                        }>
                      );
                      const addressOptions = addressesData.map(
                        (addr: {
                          id: number;
                          address: string;
                          email?: string;
                        }) => ({
                          value: addr.address,
                          label: addr.address,
                          email: String(addr.email || ""),
                        }),
                      );

                      setNotifyCustomerAddressOptions(addressOptions);

                      const primaryAddr = pickPrimaryPartyAddress(addressesData);
                      if (primaryAddr?.address) {
                        form.setFieldValue(
                          "notify1_customer_address",
                          primaryAddr.address,
                        );
                      } else {
                        form.setFieldValue("notify1_customer_address", "");
                      }
                      form.setFieldValue(
                        "notify1_customer_email",
                        String(primaryAddr?.email || ""),
                      );
                    } else {
                      setNotifyCustomerAddressOptions([]);
                      form.setFieldValue("notify1_customer_address", "");
                      form.setFieldValue("notify1_customer_email", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.notify1_customer_name as string}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Notify Customer Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Notify Customer Email"
                  {...form.getInputProps("notify1_customer_email")}
                  error={form.errors.notify1_customer_email}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {notifyCustomerAddressOptions.length > 0 ? (
                  <Dropdown
                    label="Notify Customer Address"
                    placeholder="Select notify address"
                    searchable
                    data={notifyCustomerAddressOptions}
                    value={form.values.notify1_customer_address || ""}
                    onChange={(value) => {
                      form.setFieldValue(
                        "notify1_customer_address",
                        value || "",
                      );
                      if (value) {
                        const selected = notifyCustomerAddressOptions.find(
                          (item) => item.value === value,
                        );
                        form.setFieldValue(
                          "notify1_customer_email",
                          selected?.email || "",
                        );
                      }
                    }}
                    error={form.errors.notify1_customer_address}
                  />
                ) : (
                  <FormTextInput
                    label="Notify Customer Address"
                    placeholder="Enter Notify Customer Address"
                    minRows={2}
                    value={form.values.notify1_customer_address}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.currentTarget.value);
                      form.setFieldValue(
                        "notify1_customer_address",
                        formattedValue,
                      );
                    }}
                    error={form.errors.notify1_customer_address}
                  />
                )}
              </Grid.Col>
            </Grid>
            {/* Origin Agent Section */}
            <Text size="md" mt="md" fw={600} c="#105476" mb="xs">
              Origin Agent
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Origin Agent Name"
                  placeholder="Type agent name"
                  apiEndpoint={URL.agent}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_name),
                    label: String(item.customer_name),
                  })}
                  value={form.values.origin_agent_name}
                  displayValue={form.values.origin_agent_name}
                  onChange={(value, _selectedData, originalData) => {
                    const newValue = value || "";
                    const code = (
                      originalData as Record<string, unknown> | undefined
                    )?.customer_code
                      ? String(
                          (originalData as Record<string, unknown>)
                            .customer_code,
                        )
                      : "";

                    form.setFieldValue("origin_agent", code);
                    form.setFieldValue("origin_agent_name", newValue);

                    // Use originalData to populate address options
                    if (
                      newValue &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      const addressesData = (
                        originalData as Record<string, unknown>
                      ).addresses_data as Array<{
                        id: number;
                        address: string;
                        email?: string;
                        address_type?: string;
                      }>;

                      const addressOptions = addressesData.map(
                        (addr: {
                          id: number;
                          address: string;
                          email?: string;
                        }) => ({
                          value: addr.address,
                          label: addr.address,
                          email: String(addr.email || ""),
                        }),
                      );

                      setOriginAgentAddressOptions(addressOptions);

                      const primaryAddr = pickPrimaryPartyAddress(addressesData);
                      if (primaryAddr?.address) {
                        form.setFieldValue(
                          "origin_agent_address",
                          primaryAddr.address,
                        );
                      } else {
                        form.setFieldValue("origin_agent_address", "");
                      }
                      form.setFieldValue(
                        "origin_agent_email",
                        String(primaryAddr?.email || ""),
                      );
                    } else {
                      setOriginAgentAddressOptions([]);
                      form.setFieldValue("origin_agent_address", "");
                      form.setFieldValue("origin_agent_email", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.origin_agent_name as string}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Origin Agent Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Origin Agent Email"
                  {...form.getInputProps("origin_agent_email")}
                  error={form.errors.origin_agent_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {originAgentAddressOptions.length > 0 ? (
                  <Dropdown
                    label="Origin Agent Address"
                    placeholder="Select origin agent address"
                    searchable
                    data={originAgentAddressOptions}
                    value={form.values.origin_agent_address || ""}
                    onChange={(value) => {
                      form.setFieldValue(
                        "origin_agent_address",
                        value || "",
                      );
                      if (value) {
                        const selected = originAgentAddressOptions.find(
                          (item) => item.value === value,
                        );
                        form.setFieldValue(
                          "origin_agent_email",
                          selected?.email || "",
                        );
                      }
                    }}
                    error={form.errors.origin_agent_address}
                  />
                ) : (
                  <FormTextInput
                    label="Origin Agent Address"
                    placeholder="Enter Origin Agent Address"
                    minRows={2}
                    value={form.values.origin_agent_address}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.currentTarget.value);
                      form.setFieldValue(
                        "origin_agent_address",
                        formattedValue,
                      );
                    }}
                    error={form.errors.origin_agent_address}
                  />
                )}
              </Grid.Col>
            </Grid>

            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="CHA Name"
                  placeholder="Type CHA name"
                  apiEndpoint={URL.cha}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code ?? ""),
                    label: String(item.customer_name ?? ""),
                  })}
                  value={form.values.cha_code || null}
                  displayValue={form.values.cha_name}
                  onChange={(value, _selectedData, originalData) => {
                    const chaCode = value || "";
                    const chaName =
                      (originalData as Record<string, unknown> | undefined)
                        ?.customer_name != null
                        ? String(
                            (originalData as Record<string, unknown>)
                              .customer_name,
                          )
                        : "";
                    form.setFieldValue("cha_code", chaCode);
                    form.setFieldValue("cha_name", chaName);

                    const addr =
                      (originalData as Record<string, unknown> | undefined)
                        ?.addresses_data &&
                      Array.isArray(
                        (originalData as Record<string, unknown>)
                          .addresses_data,
                      ) &&
                      (
                        (originalData as Record<string, unknown>)
                          .addresses_data as Array<{
                          address?: unknown;
                        }>
                      )[0]?.address
                        ? String(
                            (
                              (originalData as Record<string, unknown>)
                                .addresses_data as Array<{
                                address?: unknown;
                              }>
                            )[0].address,
                          )
                        : "";

                    if (addr) {
                      form.setFieldValue("cha_address", toTitleCase(addr));
                    } else if (!chaCode) {
                      form.setFieldValue("cha_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={8}>
                <FormTextArea
                  label="CHA Address"
                  placeholder="Enter CHA Address"
                  minRows={2}
                  value={form.values.cha_address}
                  onChange={(e) => {
                    form.setFieldValue("cha_address", e.currentTarget.value);
                  }}
                />
              </Grid.Col>
            </Grid>

          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="2">
          <Box mt="md">
            <Text size="md" fw={600} c="#105476" mb="md">
              Cargo Details
            </Text>

            <Grid mb="md">
              <Grid.Col span={6}>
                <FormTextArea
                  label="Commodity Description"
                  placeholder="Enter Commodity Description"
                  minRows={3}
                  value={form.values.commodity_description}
                  onChange={(e) => {
                    form.setFieldValue(
                      "commodity_description",
                      e.currentTarget.value,
                    );
                  }}
                  error={form.errors.commodity_description}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <FormTextArea
                  label="Marks No"
                  placeholder="Enter Marks No"
                  minRows={3}
                  value={form.values.marks_no}
                  onChange={(e) => {
                    form.setFieldValue("marks_no", e.currentTarget.value);
                  }}
                  error={form.errors.marks_no}
                />
              </Grid.Col>
            </Grid>

            {/* Dynamic Cargo Rows */}
            <Box mb="md">
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={2}>
                  <RequiredLabel label="Package Type" required={false} />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel label="No of Packages" required={true} />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel label="Gross Weight (KG)" required={true} />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel label="Volume (KG)" required={true} />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel
                    label="Chargeable Weight (KG)"
                    required={false}
                  />
                </Grid.Col>
                <Grid.Col span={1.8}>
                  <RequiredLabel label="Haz" required={false} />
                </Grid.Col>
                <Grid.Col span={1}>
                  <Text size="xs" fw={600}>
                    Actions
                  </Text>
                </Grid.Col>
              </Grid>

              {cargoDetails.map((cargo, index) => (
                <Grid key={index} gutter="sm" mb="xs">
                  <Grid.Col span={2}>
                    <Dropdown
                      placeholder="Package Type"
                      searchable
                      data={packageTypeOptions}
                      value={cargo.package_type || null}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          package_type: value || "",
                        };
                        setCargoDetails(updated);
                      }}
                      clearable
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <FormNumberInput
                      placeholder="Enter No of Packages"
                      min={0}
                      hideControls
                      value={cargo.no_of_packages || undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          no_of_packages: value as number | null,
                        };
                        setCargoDetails(updated);
                        // Clear error when field is updated
                        if (cargoErrors[index]?.no_of_packages) {
                          const newErrors = { ...cargoErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].no_of_packages;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setCargoErrors(newErrors);
                        }
                      }}
                      error={cargoErrors[index]?.no_of_packages}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <FormNumberInput
                      placeholder="Enter Gross Weight"
                      min={0}
                      hideControls
                      {...HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS}
                      value={cargo.gross_weight ?? undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = withRecalculatedChargeableWeight(
                          {
                            ...updated[index],
                            gross_weight: coerceHouseCargoWeightInput(
                              value,
                              cargo.gross_weight,
                            ),
                          },
                          "air",
                        );
                        setCargoDetails(updated);
                        // Clear error when field is updated
                        if (cargoErrors[index]?.gross_weight) {
                          const newErrors = { ...cargoErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].gross_weight;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setCargoErrors(newErrors);
                        }
                      }}
                      onBlur={(e) => {
                        const raw = e.currentTarget.value
                          .replace(/,/g, "")
                          .trim();
                        if (!raw) return;
                        const updated = [...cargoDetails];
                        updated[index] = withRecalculatedChargeableWeight(
                          {
                            ...updated[index],
                            gross_weight: coerceHouseCargoWeightInput(
                              raw,
                              cargo.gross_weight,
                            ),
                          },
                          "air",
                        );
                        setCargoDetails(updated);
                      }}
                      error={cargoErrors[index]?.gross_weight}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <FormNumberInput
                      placeholder="Enter Volume Weight"
                      min={0}
                      hideControls
                      {...HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS}
                      value={cargo.volume ?? undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = withRecalculatedChargeableWeight(
                          {
                            ...updated[index],
                            volume: coerceHouseCargoWeightInput(
                              value,
                              cargo.volume,
                            ),
                          },
                          "air",
                        );
                        setCargoDetails(updated);
                        // Clear error when field is updated
                        if (cargoErrors[index]?.volume) {
                          const newErrors = { ...cargoErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].volume;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setCargoErrors(newErrors);
                        }
                      }}
                      onBlur={(e) => {
                        const raw = e.currentTarget.value
                          .replace(/,/g, "")
                          .trim();
                        if (!raw) return;
                        const updated = [...cargoDetails];
                        updated[index] = withRecalculatedChargeableWeight(
                          {
                            ...updated[index],
                            volume: coerceHouseCargoWeightInput(
                              raw,
                              cargo.volume,
                            ),
                          },
                          "air",
                        );
                        setCargoDetails(updated);
                      }}
                      error={cargoErrors[index]?.volume}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <FormTextInput
                      placeholder=""
                      format="normal"
                      value={formatHouseCargoChargeableDisplay(
                        cargo.gross_weight,
                        cargo.volume,
                        "air",
                      )}
                      readOnly
                      disabled
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <Dropdown
                      placeholder="Select Haz"
                      searchable
                      data={[
                        { value: "true", label: "Yes" },
                        { value: "false", label: "No" },
                      ]}
                      value={cargo.haz || null}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          haz: value || "",
                        };
                        setCargoDetails(updated);
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <Group gap="xs">
                      {cargoDetails.length > 1 && (
                        <Button
                          size="sm"
                          px={12}
                          variant="light"
                          color="red"
                          onClick={() => {
                            const updated = cargoDetails.filter(
                              (_, i) => i !== index,
                            );
                            setCargoDetails(updated);
                          }}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                      {cargoDetails.length - 1 === index && (
                        <Button
                          size="sm"
                          px={12}
                          variant="light"
                          color="#105476"
                          onClick={() => {
                            setCargoDetails([
                              ...cargoDetails,
                              {
                                package_type: "",
                                no_of_packages: null,
                                gross_weight: null,
                                volume: null,
                                chargeable_weight: null,
                                haz: "",
                              },
                            ]);
                          }}
                        >
                          <IconPlus size={16} />
                        </Button>
                      )}
                    </Group>
                  </Grid.Col>
                </Grid>
              ))}
            </Box>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="3">
          <Box mt="md">
            <Group justify="space-between" align="center" mb="md">
              <Text size="md" fw={600} c="#105476">
                Charges
                {chargesForm.values.charges.length > 1 &&
                  ` (${chargesForm.values.charges.length})`}
              </Text>
              {location.state?.job?.id != null && !isReadOnly && (
                <Group gap="xs">
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => {
                      const fullDetail = getCurrentHousingDetail();
                      const charges = Array.isArray(fullDetail.charges)
                        ? fullDetail.charges
                        : [];

                      const chargesFromHouse = charges
                        .filter(
                          (e: any) =>
                            e?.charge_id != null ||
                            (e?.charge_name &&
                              String(e.charge_name).trim() !== ""),
                        )
                        .map((e: any) => ({
                          charge_id: e?.charge_id ?? null,
                          charge_name: e?.charge_name ?? "",
                          segment: "",
                          // NOTE: PRQ "Job Id" should receive shipment_id from house context
                          job_no: String(
                            (fullDetail as { shipment_id?: unknown })
                              ?.shipment_id ??
                              (
                                location.state?.job as {
                                  shipment_id?: unknown;
                                } | null
                              )?.shipment_id ??
                              location.state?.job?.job_id ??
                              location.state?.job?.id ??
                              "",
                          ),
                          sub_job: String(
                            fullDetail?.hawb_number ??
                              fullDetail?.hawb_no ??
                              fullDetail?.id ??
                              "",
                          ),
                          cn_r: "",
                          currency: e?.currency_code ?? e?.currency ?? "",
                          currency_id: e?.currency_id ?? "",
                          roe: e?.roe ?? null,
                          unit_code: e?.unit_code ?? e?.unit ?? "",
                          unit_id: e?.unit_id ?? "",
                          no_of_unit: e?.no_of_unit ?? null,
                          amount_per_unit:
                            e?.cost_per_unit ?? e?.amount_per_unit ?? null,
                          amount: e?.total_cost ?? e?.amount ?? null,
                          amount_in_local:
                            e?.cost_local_amount ??
                            e?.local_amount ??
                            (e?.total_cost != null && e?.roe != null
                              ? Math.round(
                                  Number(e.total_cost) * Number(e.roe) * 100,
                                ) / 100
                              : (e?.total_cost ?? null)),
                          tax_code: "",
                          tax: "false",
                        }));

                      const firstSupplier =
                        charges.find(
                          (e: any) =>
                            String(e?.supplier_code ?? "").trim() !== "" ||
                            String(e?.supplier_name ?? "").trim() !== "",
                        ) ?? null;

                      navigate("/payment-request/create", {
                        state: {
                          serviceType: "AIR",
                          voucherType: "AIR IMPORTS",
                          chargesFromEstimates:
                            chargesFromHouse.length > 0
                              ? chargesFromHouse
                              : undefined,
                          supplier:
                            firstSupplier != null
                              ? {
                                  supplier_code: String(
                                    firstSupplier?.supplier_code ?? "",
                                  ),
                                  supplier_name: String(
                                    firstSupplier?.supplier_name ?? "",
                                  ),
                                }
                              : null,
                          job_reference_1: String(
                            location.state?.job?.job_id ??
                              location.state?.job?.id ??
                              "",
                          ),
                          ...(location.state?.job && {
                            job: location.state.job,
                          }),
                        },
                      });
                    }}
                  >
                    Create PRQ
                  </Button>
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => {
                      const fullDetail = getCurrentHousingDetail();
                      // For air import customer invoice, only Collect charges (mirrors Ocean Import)
                      const collectCharges = (fullDetail.charges ?? []).filter(
                        (c: { pp_cc?: string }) =>
                          String(c.pp_cc ?? "").trim() === "Collect",
                      );
                      const detailForInvoice = {
                        ...fullDetail,
                        charges: collectCharges,
                      };
                      navigate("/air/import-job/credit-note", {
                        state: {
                          serviceType: "AIR",
                          hawbDetails: [detailForInvoice],
                          housingDetails: [detailForInvoice],
                          is_agent: false,
                          // Indicate that Bill To / State / Address should come from consignee
                          billToFrom: "consignee",
                          ...(location.state?.job && {
                            job: location.state.job,
                          }),
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
                    Create Credit Note
                  </Button>
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => {
                      const fullDetail = getCurrentHousingDetail();
                      // For air import customer invoice, only Collect charges (mirrors Ocean Import)
                      const collectCharges = (fullDetail.charges ?? []).filter(
                        (c: { pp_cc?: string }) =>
                          String(c.pp_cc ?? "").trim() === "Collect",
                      );
                      const detailForInvoice = {
                        ...fullDetail,
                        charges: collectCharges,
                      };
                      navigate("/air/import-job/invoice", {
                          state: {
                            serviceType: "AIR",
                            hawbDetails: [detailForInvoice],
                            housingDetails: [detailForInvoice],
                            is_agent: false,
                            // Indicate that Bill To / State / Address should come from consignee
                            billToFrom: "consignee",
                            ...(location.state?.job && {
                              job: location.state.job,
                            }),
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
                    </Button>
                </Group>
              )}
            </Group>

            {/* Dynamic Charges Rows */}
            <Box mb="md">
              {/* Group title row: Sell / Cost */}
              <Grid mb={2} gutter="sm" style={{ fontWeight: 700 }}>
                <Grid.Col span={1.4} />
                <Grid.Col span={0.9} />
                <Grid.Col span={0.8} />
                <Grid.Col span={0.8} />
                <Grid.Col span={0.7} />
                <Grid.Col span={0.7} />
                <Grid.Col span={2.55}>
                  <Box
                    style={{
                      border: "1.5px solid #228be6",
                      borderRadius: 6,
                      textAlign: "center",
                      padding: "2px 0",
                      color: "#228be6",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    SELL
                  </Box>
                </Grid.Col>
                <Grid.Col span={3.65}>
                  <Box
                    style={{
                      border: "1.5px solid #e67700",
                      borderRadius: 6,
                      textAlign: "center",
                      padding: "2px 0",
                      color: "#e67700",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    COST
                  </Box>
                </Grid.Col>
                <Grid.Col span={0.5} />
              </Grid>
              {/* Field labels row */}
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={1.4}>
                  <RequiredLabel label="Charge Name" required />
                </Grid.Col>
                <Grid.Col span={0.9}>
                  <RequiredLabel label="Prepaid / Collect" required />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <RequiredLabel label="Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <RequiredLabel label="Currency" required />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <RequiredLabel label="ROE" required />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <RequiredLabel label="No of Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Amount/Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Amount" required />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Local Amount" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Cost/Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Total Cost" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Local Amount" required={false} />
                </Grid.Col>
                <Grid.Col span={1.1}>
                  <RequiredLabel label="Supplier" required={false} />
                </Grid.Col>
                <Grid.Col span={0.5}>
                  <RequiredLabel label="Actions" required={false} />
                </Grid.Col>
              </Grid>

              {chargesForm.values.charges.map((charge, index) => (
                <Grid key={index} gutter="sm" mb="xs">
                  <Grid.Col span={1.4}>
                    <SearchableSelect
                      placeholder="Type charge name"
                      apiEndpoint={URL.chargeMaster}
                      searchFields={["charge_name", "charge_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.id ?? ""),
                        label: String(item.charge_name ?? ""),
                      })}
                      value={
                        charge.charge_id != null
                          ? String(charge.charge_id)
                          : null
                      }
                      displayValue={charge.charge_name || undefined}
                      returnOriginalData
                      onChange={(value, selectedData, originalData) => {
                        const chargeId = value ? Number(value) : null;
                        const chargeName = selectedData?.label ?? "";
                        chargesForm.setFieldValue(
                          `charges.${index}.charge_id`,
                          chargeId,
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.charge_name`,
                          chargeName,
                        );
                        if (chargeErrors[index]?.charge_name) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].charge_name;
                            if (Object.keys(newErrors[index]).length === 0)
                              delete newErrors[index];
                          }
                          setChargeErrors(newErrors);
                        }

                        if (!value) return;
                        const defaultUnitCode = resolveAutoUnitForNewCharge({
                          calculationType: (
                            originalData as {
                              calculation_type?: string;
                            } | null
                          )?.calculation_type,
                          service: jobService,
                          currentUnitId: charge.unit_id,
                          currentUnitCode: charge.unit_code,
                        });
                        if (!defaultUnitCode) return;
                        const unitOpt = findJobUnitOptionByCode(
                          defaultUnitCode,
                          unitOptions,
                        );
                        if (!unitOpt) return;
                        const updated = applyJobChargeUnitChange(
                          {
                            ...charge,
                            charge_id: chargeId,
                            charge_name: chargeName,
                          },
                          unitOpt.value,
                          unitOptions,
                          jobService,
                          bookingCargoForCharges,
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.unit_id`,
                          updated.unit_id ?? "",
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.unit_code`,
                          updated.unit_code ?? "",
                        );
                        if (
                          charge.no_of_unit === null ||
                          charge.no_of_unit === undefined
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.no_of_unit`,
                            updated.no_of_unit ?? null,
                          );
                        }
                      }}
                      error={chargeErrors[index]?.charge_name}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.9}>
                    <Dropdown
                      placeholder="Select Prepaid/Collect"
                      searchable
                      data={[
                        { value: "Prepaid", label: "Prepaid" },
                        { value: "Collect", label: "Collect" },
                      ]}
                      value={charge.pp_cc || null}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.pp_cc`,
                          value || "",
                        );
                        if (chargeErrors[index]?.pp_cc) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].pp_cc;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.pp_cc}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.8}>
                    <Dropdown
                      placeholder="Select Unit"
                      searchable
                      data={unitOptions}
                      value={charge.unit_id || null}
                      onChange={(value) => {
                        const unitId = value ?? "";
                        if (unitId === (charge.unit_id || "")) return;
                        const updated = applyJobChargeUnitChange(
                          charge,
                          unitId,
                          unitOptions,
                          jobService,
                          bookingCargoForCharges,
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.unit_id`,
                          updated.unit_id ?? "",
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.unit_code`,
                          updated.unit_code ?? "",
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.no_of_unit`,
                          updated.no_of_unit ?? null,
                        );
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.8}>
                    <Dropdown
                      placeholder="Select Currency"
                      searchable
                      data={currencyOptions}
                      value={charge.currency_id || null}
                      onChange={(value) => {
                        const currencyId = value ?? "";
                        const code =
                          currencyOptions.find((o) => o.value === currencyId)
                            ?.label ?? "";
                        chargesForm.setFieldValue(
                          `charges.${index}.currency_id`,
                          currencyId,
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.currency`,
                          code,
                        );
                        if (isBaseCurrency(code)) {
                          chargesForm.setFieldValue(`charges.${index}.roe`, 1);
                        } else {
                          void ensureRoeForCurrency(code).then((roe) => {
                            chargesForm.setFieldValue(
                              `charges.${index}.roe`,
                              roe,
                            );
                          });
                        }
                        if (chargeErrors[index]?.currency_id) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].currency_id;
                            if (Object.keys(newErrors[index]).length === 0)
                              delete newErrors[index];
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.currency_id}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.7}>
                    <FormNumberInput
                      placeholder="ROE"
                      min={0}
                      hideControls
                      decimalScale={ROE_DECIMAL_PLACES}
                      readOnly={isChargeBaseCurrencyFor(
                        charge,
                        (currencyData ?? []) as {
                          id?: number;
                          code?: string;
                          currency_code?: string;
                        }[],
                      )}
                      value={charge.roe || undefined}
                      onChange={(value) => {
                        if (
                          isChargeBaseCurrencyFor(
                            charge,
                            (currencyData ?? []) as {
                              id?: number;
                              code?: string;
                              currency_code?: string;
                            }[],
                          )
                        ) {
                          chargesForm.setFieldValue(`charges.${index}.roe`, 1);
                          return;
                        }
                        const roe = value as number | null;
                        chargesForm.setFieldValue(`charges.${index}.roe`, roe);
                        const currencyArr = (currencyData ?? []) as {
                          id?: number;
                          code?: string;
                          currency_code?: string;
                        }[];
                        const roeError = validateRoeField(
                          resolveCurrencyCode(charge, currencyArr),
                          roe,
                          charge.currency_id,
                        );
                        if (roeError) {
                          setChargeErrors((prev) => ({
                            ...prev,
                            [index]: { ...(prev[index] ?? {}), roe: roeError },
                          }));
                        } else {
                          setChargeErrors((prev) => {
                            if (!prev[index]?.roe) return prev;
                            const newErrors = { ...prev };
                            if (newErrors[index]) {
                              delete newErrors[index].roe;
                              if (Object.keys(newErrors[index]).length === 0) {
                                delete newErrors[index];
                              }
                            }
                            return newErrors;
                          });
                        }
                      }}
                      error={chargeErrors[index]?.roe}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.7}>
                    <FormNumberInput
                      placeholder="No of Unit"
                      min={0}
                      hideControls
                      {...jobChargeNoOfUnitInputProps(
                        charge.unit_code ?? "",
                        unitOptions.find((o) => o.value === charge.unit_id)
                          ?.label,
                      )}
                      {...(() => {
                        const inputProps = chargesForm.getInputProps(
                          `charges.${index}.no_of_unit`,
                        );
                        return {
                          value: inputProps.value as number | undefined,
                          onChange: (value: number | string | null) => {
                            const noOfUnit = value as number | null;
                            chargesForm.setFieldValue(
                              `charges.${index}.no_of_unit`,
                              noOfUnit,
                            );

                            const currentCharge =
                              chargesForm.values.charges[index];

                            if (
                              currentCharge.amount_per_unit != null &&
                              currentCharge.amount_per_unit > 0 &&
                              noOfUnit != null &&
                              noOfUnit > 0
                            ) {
                              chargesForm.setFieldValue(
                                `charges.${index}.amount`,
                                noOfUnit * currentCharge.amount_per_unit,
                              );
                            } else {
                              chargesForm.setFieldValue(
                                `charges.${index}.amount`,
                                null,
                              );
                            }

                            if (
                              currentCharge.cost_per_unit != null &&
                              currentCharge.cost_per_unit > 0 &&
                              noOfUnit != null &&
                              noOfUnit > 0
                            ) {
                              chargesForm.setFieldValue(
                                `charges.${index}.total_cost`,
                                noOfUnit * currentCharge.cost_per_unit,
                              );
                            } else {
                              chargesForm.setFieldValue(
                                `charges.${index}.total_cost`,
                                null,
                              );
                            }
                          },
                        };
                      })()}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Amount/Unit"
                      min={0}
                      hideControls
                      decimalScale={currencyAmountDecimalScale}
                      value={charge.amount_per_unit || undefined}
                      onChange={(value) => {
                        const amountPerUnit = value as number | null;
                        chargesForm.setFieldValue(
                          `charges.${index}.amount_per_unit`,
                          amountPerUnit,
                        );

                        const currentCharge = chargesForm.values.charges[index];

                        if (
                          amountPerUnit == null ||
                          amountPerUnit === 0 ||
                          currentCharge.no_of_unit == null ||
                          currentCharge.no_of_unit === 0
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.amount`,
                            null,
                          );
                        } else {
                          chargesForm.setFieldValue(
                            `charges.${index}.amount`,
                            currentCharge.no_of_unit * amountPerUnit,
                          );
                        }

                        if (chargeErrors[index]?.amount_per_unit) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].amount_per_unit;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.amount_per_unit}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Amount"
                      min={0}
                      hideControls
                      decimalScale={currencyAmountDecimalScale}
                      value={charge.amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.amount`,
                          value as number | null,
                        );
                        if (chargeErrors[index]?.amount) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].amount;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.amount}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Local Amount"
                      min={0}
                      hideControls
                      groupThousands
                      decimalScale={localAmountDecimalScale}
                      value={charge.local_amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.local_amount`,
                          value as number | null,
                        );
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Cost/Unit"
                      min={0}
                      hideControls
                      decimalScale={currencyAmountDecimalScale}
                      value={charge.cost_per_unit || undefined}
                      onChange={(value) => {
                        const costPerUnit = value as number | null;
                        chargesForm.setFieldValue(
                          `charges.${index}.cost_per_unit`,
                          costPerUnit,
                        );
                        const currentCharge = chargesForm.values.charges[index];
                        if (
                          costPerUnit != null &&
                          costPerUnit > 0 &&
                          currentCharge.no_of_unit != null &&
                          currentCharge.no_of_unit > 0
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.total_cost`,
                            currentCharge.no_of_unit * costPerUnit,
                          );
                        } else {
                          chargesForm.setFieldValue(
                            `charges.${index}.total_cost`,
                            null,
                          );
                        }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Total Cost"
                      min={0}
                      hideControls
                      groupThousands
                      decimalScale={currencyAmountDecimalScale}
                      value={charge.total_cost || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.total_cost`,
                          value as number | null,
                        );
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Local Amount"
                      min={0}
                      hideControls
                      groupThousands
                      decimalScale={localAmountDecimalScale}
                      value={charge.cost_local_amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.cost_local_amount`,
                          value as number | null,
                        );
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.1}>
                    <SearchableSelect
                      placeholder="Type supplier"
                      apiEndpoint={URL.supplierByType}
                      searchFields={["customer_name", "customer_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.customer_code ?? ""),
                        label: String(item.customer_name ?? ""),
                      })}
                      value={
                        charge.supplier_code
                          ? String(charge.supplier_code)
                          : null
                      }
                      displayValue={charge.supplier_name || undefined}
                      onChange={(value, selectedData) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.supplier_code`,
                          value || "",
                        );
                        chargesForm.setFieldValue(
                          `charges.${index}.supplier_name`,
                          selectedData?.label || "",
                        );
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      styles={{
                        input: {
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col
                    span={0.5}
                    style={{
                      display: "flex",
                      gap: "6px",
                      alignItems: "center",
                      justifyContent: "flex-start",
                    }}
                  >
                    {chargesForm.values.charges.length - 1 === index && (
                      <ActionIcon
                        variant="light"
                        color="#105476"
                        onClick={() => {
                          chargesForm.insertListItem("charges", {
                            charge_id: null,
                            charge_name: "",
                            pp_cc: "Collect",
                            unit_id: "",
                            no_of_unit: null,
                            ...branchCurrencyDefaults,
                            amount_per_unit: null,
                            amount: null,
                            local_amount: null,
                            cost_per_unit: null,
                            total_cost: null,
                            cost_local_amount: null,
                            supplier_code: "",
                            supplier_name: "",
                          });
                        }}
                      >
                        <IconPlus size={16} />
                      </ActionIcon>
                    )}
                    {chargesForm.values.charges.length > 1 && (
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => {
                          chargesForm.removeListItem("charges", index);
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Grid.Col>
                </Grid>
              ))}

              <ChargesLocalAmountTotalsRow
                offsetBeforeSellCol={7.1}
                house={{
                  charges: getMeaningfulHouseCharges(
                    chargesForm.values.charges,
                  ),
                  mawb_charges: (editData as { mawb_charges?: unknown })
                    ?.mawb_charges as
                    | Array<{
                        sell_local_amount?: unknown;
                        local_amount?: unknown;
                        cost_local_amount?: unknown;
                      }>
                    | undefined,
                  mbl_charges: (editData as { mbl_charges?: unknown })
                    ?.mbl_charges as
                    | Array<{
                        sell_local_amount?: unknown;
                        local_amount?: unknown;
                        cost_local_amount?: unknown;
                      }>
                    | undefined,
                  summary: (
                    editData as {
                      summary?: {
                        total_local_sell?: number | string | null;
                        total_local_cost?: number | string | null;
                      };
                    }
                  )?.summary,
                }}
                branches={user?.branches}
              />
            </Box>
          </Box>
        </Tabs.Panel>

        {isEditMode && (
          <Tabs.Panel value="4" className={JOB_ACCOUNTS_TAB_PANEL_CLASS}>
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
                        <Table.Th
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            width: "20%",
                          }}
                        >
                          Daybook
                        </Table.Th>
                        <Table.Th
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            width: "20%",
                          }}
                        >
                          Document Number
                        </Table.Th>
                        <Table.Th
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            width: "20%",
                          }}
                        >
                          Party Name
                        </Table.Th>
                        <Table.Th
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            width: "15%",
                          }}
                        >
                          Invoice Date
                        </Table.Th>
                        <Table.Th
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            width: "15%",
                          }}
                        >
                          Invoice Total
                        </Table.Th>
                        <Table.Th
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            width: "15%",
                          }}
                        >
                          Status
                        </Table.Th>
                        <Table.Th
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            width: "15%",
                          }}
                        >
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
                                            `/air/import-job/invoice/view/${invoiceViewId}`,
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
                                      {isUnposted && !isReadOnly ? (
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
                                                `/air/import-job/invoice/edit/${row.invoice_id}`,
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
                                      ) : isPosted && !isReadOnly ? (
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
                                              "/air/import-job/invoice/reverse",
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
                                                      width: "20%",
                                                    }}
                                                  >
                                                    {rev.bill_to_name ?? "-"}
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
                                                      readOnly={isReadOnly}
                                                      parentRow={row}
                                                      jobBasePath="/air/import-job"
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

      <CanShowChargesModal
        opened={canChargesModalOpen}
        onClose={() => setCanChargesModalOpen(false)}
        onConfirm={(showCharges) => {
          setCanChargesModalOpen(false);
          void generatePDFPreview(showCharges);
        }}
      />

      <HousePageDocumentsModal
        documents={housePageDocuments}
        readOnly={isViewOnly}
      />

      <Group justify="space-between" mt="xl">
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => {
            if (isViewOnly) {
              navigateToJobWithHousingList(existingHousingDetails);
            } else if (isEditMode && editIndex !== undefined) {
              navigateToJobWithHousingList(
                buildUpdatedHousingDetailsFromForm(),
              );
            } else {
              navigateToJobWithHousingList(existingHousingDetails);
            }
          }}
        >
          Back to Import Job
        </Button>

        <Group>
          <HousePageDocumentsButton
            documents={housePageDocuments}
            readOnly={isViewOnly}
          />
          {active > 0 && (
            <Button
              leftSection={<IconChevronLeft size={16} />}
              variant="outline"
              onClick={handlePrev}
            >
              Previous
            </Button>
          )}

          {active < 3 && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
            >
              Next
            </Button>
          )}
          {active === 3 && !isViewOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
            >
              Save HBL
            </Button>
          )}
        </Group>
      </Group>

      {similarBookingApplyLoading && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            backgroundColor: "rgba(255, 255, 255, 0.7)",
          }}
        >
          <Center h="100%">
            <Loader size="lg" color="#105476" />
          </Center>
        </Box>
      )}

      {/* Similar booking found modal */}
      <Modal
        opened={similarBookingModalOpen}
        onClose={
          similarBookingApplyLoading
            ? () => undefined
            : dismissSimilarBookingModal
        }
        title="Similar booking found"
        centered
        closeOnClickOutside={!similarBookingApplyLoading}
        closeOnEscape={!similarBookingApplyLoading}
        withCloseButton={!similarBookingApplyLoading}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            A similar booking is found for the house number. Do you want to add
            it to the house?
          </Text>
          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={dismissSimilarBookingModal}
              disabled={similarBookingApplyLoading}
            >
              No
            </Button>
            <Button
              color="#105476"
              onClick={() => void handleConfirmSimilarBooking()}
              loading={similarBookingApplyLoading}
              disabled={similarBookingApplyLoading}
            >
              Yes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title="PDF Preview"
        size="xl"
        styles={{
          body: {
            padding: 0,
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
                <Button
                  onClick={handleOpenSendEmailForCan}
                  leftSection={<IconSend size={16} />}
                  color="#105476"
                  variant="outline"
                >
                  Send Email
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

      <SendPdfEmailModal
        opened={sendEmailOpened}
        onClose={closeSendEmail}
        pdfBlobUrl={activePdfBlob}
        fileName={activeFileName}
        documentLabel={activeDocumentLabel}
      />

      <VendorInvoiceAutomationModal
        opened={vendorInvoiceAutomationShipmentNo != null}
        shipmentNo={vendorInvoiceAutomationShipmentNo ?? ""}
        onClose={() => setVendorInvoiceAutomationShipmentNo(null)}
      />
    </Box>
  );
}

export default HouseCreate;
