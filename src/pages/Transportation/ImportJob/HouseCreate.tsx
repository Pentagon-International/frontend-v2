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
import dayjs from "dayjs";
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
} from "@tabler/icons-react";
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Fragment,
  useRef,
} from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useExchangeRateRoe } from "../../../hooks/useExchangeRateRoe";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import {
  SearchableSelect,
  Dropdown,
  ToastNotification,
  SingleDateInput,
} from "../../../components";
import { commonSearchAPI } from "../../../service/searchApi";
import { toTitleCase } from "../../../utils/textFormatter";
import {
  bindMoneyWholeNumberMode,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
  roundMoneyAmountBound,
  roundMoneyToDecimals,
} from "../../../utils/nonDecimalMoneyAmount";
import {
  ROE_DECIMAL_PLACES,
  roundRoeForPayload,
} from "../../../utils/exchangeRateRoe";
import {
  getMeaningfulHouseCharges,
  validateMeaningfulHouseCharges,
} from "../../../utils/houseChargesPayload";
import {
  formatInvoiceDocumentNo,
  getInvoiceDocumentNo,
} from "../../../utils/invoiceDocumentNumber";
import {
  calculateHouseChargeableWeight,
  formatHouseCargoWeightForPayload,
  HOUSE_CARGO_WEIGHT_DECIMALS,
  HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS,
  jobChargeNoOfUnitInputProps,
  houseCargoWeightValuesEqual,
  isPositiveHouseCargoWeight,
  coerceHouseCargoWeightInput,
  formatHouseCargoChargeableDisplay,
  formatHouseCargoChargeableForPayload,
  importHouseCargoWeightFromApi,
  applyJobChargeUnitChange,
  buildJobChargeNoOfUnitsSyncKey,
  buildJobUnitOptions,
  type JobChargeNoOfUnitContext,
  mapJobChargesWithUnits,
  parseNoOfUnitForPayload,
  syncJobChargesWithCargoNoOfUnits,
  toBookingCargoForNoOfUnits,
  withRecalculatedChargeableWeight,
  type HouseCargoWeightValue,
} from "../../../utils/houseCargoChargeableWeight";
import {
  eventsToEventModalRows,
  extractJobDataFromPatchAxiosResponse,
  housingEventsFromJobPatchData,
  resolveHousingEventsForHouseForm,
} from "../../../utils/jobHousingEventsFromPatch";
import { previewCargoArrivalNoticePDF } from "../../jobs/pdf/canPdfPreview";
import { generateDeliveryOrderPDF } from "../../jobs/pdf/DeliveryOrderPDFTemplate";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { JobInvoiceDeleteConfirmModal } from "../../../components/JobInvoiceDeleteConfirmModal";
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
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import FormTextInput from "../../../components/FormTextInput";
import RequiredLabel from "../../../components/RequiredLabel";
import { ChargesLocalAmountTotalsRow } from "../../../components/JobChargeSummaryDisplay";
import FormTextArea from "../../../components/FormTextArea";
import FormNumberInput from "../../../components/FormNumberInput";

// Type definitions
type HouseDetailsForm = {
  hbl_number: string;
  house_date: Date | null;
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
  // Agent fields sent in payload (no origin_agent_* keys)
  agent_name: string;
  /** customer_code used for similar-booking API filters (not sent in payload) */
  agent_code: string;
  agent_address: string;
  agent_email: string;
  /** internal select value; not sent in payload */
  cha_code: string;
  cha_name: string;
  cha_address: string;
  // Internal selection ids/codes (NOT sent in payload)
  shipper_code: string;
  shipper_name: string;
  shipper_address: string;
  shipper_email: string;
  shipper_state_id: string;
  consignee_code: string;
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  /** State id from consignee customer master primary address — used for Invoice Create (Bill To state). */
  consignee_state_id: string;
  notify1_customer_name: string;
  notify1_customer_address: string;
  notify1_customer_email: string;
  commodity_description: string;
  marks_no: string;
  note: string;
  item_no: string;
  sub_item_no: string;
  ref_no: string;
  hscode: string;
  item_type: string;
  events: Array<{ id?: number; type: string; date: string }>;
  event_modal_rows: Array<{
    id?: number;
    eventType: string | null;
    eventDate: Date | null;
  }>;
};

// Type definitions for cargo details
type CargoDetail = {
  id?: number | string; // ID from backend when editing
  container_number: string; // UI field - used to select container
  container_id?: number | string; // Container ID for edit mode (from container_details)
  package_type: string;
  no_of_packages: number | null;
  gross_weight: HouseCargoWeightValue;
  volume: HouseCargoWeightValue;
  chargeable_weight: HouseCargoWeightValue;
  haz: boolean | null;
};

const ITEM_TYPE_OPTIONS = [
  { value: "GC - Govt. Cargo", label: "GC - Govt. Cargo" },
  { value: "OT - Other Cargo", label: "OT - Other Cargo" },
  { value: "UB - Un-accompanied Baggage", label: "UB - Un-accompanied Baggage" },
];

/** Label and value are the same `{code - name}` string. */
const PACKAGE_TYPE_OPTIONS = [
  { value: "BDL - Bundles", label: "BDL - Bundles" },
  { value: "BGS - Bags", label: "BGS - Bags" },
  { value: "BLK - Bulk", label: "BLK - Bulk" },
  { value: "BLO - Blocks", label: "BLO - Blocks" },
  { value: "BLS - Bales", label: "BLS - Bales" },
  { value: "BOX - Boxes", label: "BOX - Boxes" },
  { value: "BRL - Barrel", label: "BRL - Barrel" },
  { value: "CAN - Cans", label: "CAN - Cans" },
  { value: "CAS - Cases", label: "CAS - Cases" },
  { value: "CBY - Carboys", label: "CBY - Carboys" },
  { value: "CHT - Chest", label: "CHT - Chest" },
  { value: "CLS - Coils", label: "CLS - Coils" },
  { value: "COL - Collies", label: "COL - Collies" },
  { value: "CON - Container", label: "CON - Container" },
  { value: "CRT - Crates", label: "CRT - Crates" },
  { value: "CSK - Cask", label: "CSK - Cask" },
  { value: "CTN - Cartons", label: "CTN - Cartons" },
  { value: "CYL - Cylinder", label: "CYL - Cylinder" },
  { value: "DRM - Drums", label: "DRM - Drums" },
  { value: "ENV - Envelopes", label: "ENV - Envelopes" },
  { value: "FLK - Flask", label: "FLK - Flask" },
  { value: "FUT - Futs", label: "FUT - Futs" },
  { value: "HBK - Habbuck", label: "HBK - Habbuck" },
  { value: "JAL - Jumble Bale", label: "JAL - Jumble Bale" },
  { value: "JTA - Jotta", label: "JTA - Jotta" },
  { value: "KEG - Keggs", label: "KEG - Keggs" },
  { value: "LFT - Lift", label: "LFT - Lift" },
  { value: "LOG - Logs", label: "LOG - Logs" },
  { value: "LOS - Loose", label: "LOS - Loose" },
  { value: "LTR - Liters", label: "LTR - Liters" },
  { value: "MTS - Metric Ton", label: "MTS - Metric Ton" },
  { value: "NGT - Ingot", label: "NGT - Ingot" },
  { value: "PAL - Pails", label: "PAL - Pails" },
  { value: "PCS - Piece", label: "PCS - Piece" },
  { value: "PKG - Packages", label: "PKG - Packages" },
  { value: "PLT - Pallets", label: "PLT - Pallets" },
  { value: "QDS - Quads", label: "QDS - Quads" },
  { value: "REL - Reels", label: "REL - Reels" },
  { value: "RLS - Rolls", label: "RLS - Rolls" },
  { value: "SHT - Sheet", label: "SHT - Sheet" },
  { value: "SKD - Skid & Skidded Pkgs", label: "SKD - Skid & Skidded Pkgs" },
  { value: "SLB - Slabs", label: "SLB - Slabs" },
  { value: "TBL - Table", label: "TBL - Table" },
  { value: "TIN - Tins", label: "TIN - Tins" },
  { value: "TRK - Trunk", label: "TRK - Trunk" },
  { value: "TRY - Trays", label: "TRY - Trays" },
  { value: "UNT - Units", label: "UNT - Units" },
];

// Type definitions for charges (charge_id, unit_id, currency_id for payload; id for update)
type ChargeDetail = {
  id?: number | string; // ID from backend when editing
  charge_id: number | null;
  charge_name: string;
  pp_cc: string;
  unit_id: string;
  unit_code: string;
  no_of_unit: number | null;
  currency_id: string;
  currency: string;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null;
  // Sell group
  sell_local_amount?: number | null;
  // Cost group
  unit_cost?: number | null;
  total_cost?: number | null;
  cost_local_amount?: number | null;
  supplier_code?: string;
  supplier_name?: string;
};

type DoTypeOption = "carrier_agent" | "unstuff_place";
type DoDeliverToOption = "consignee" | "notify" | "cha";

// Reverse invoice item (from API reverse_invoices)
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

const fetchUnitMaster = async () => {
  try {
    const payload = {
      filters: {
        service_type: ["FCL", "LCL"],
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

// Validation handled in validateStep1 and validateStep2 functions

const normalizePpCc = (value: unknown): string => {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (raw === "PP" || raw === "PREPAID") return "Prepaid";
  if (raw === "CC" || raw === "COLLECT") return "Collect";
  return "";
};

/** House Freight field: same mapping as charges, default Collect. */
const normalizeFreightPpCc = (value: unknown): string => {
  const normalized = normalizePpCc(value);
  return normalized || "Collect";
};

function HouseCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(isVietnamBranch);
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
    (grossWeight: HouseCargoWeightValue, volume: HouseCargoWeightValue) =>
      calculateHouseChargeableWeight(grossWeight, volume, "ocean"),
    [],
  );

  // State for address options (populated from addresses_data when shipper/consignee is selected)
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [notifyCustomerAddressOptions, setNotifyCustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [originAgentAddressOptions, setOriginAgentAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  // Shipment-party search state for Shipper (import flow)
  const [shipperSearch, setShipperSearch] = useState("");
  const [shipperOptions, setShipperOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  // Manual mode flag so we don't rapidly flip between Select/TextInput (prevents focus loss)
  const [shipperManualMode, setShipperManualMode] = useState(false);
  // Note: shipper results are derived from shipperOptions length; no extra flag needed.
  const shipperDataRef = useRef<Record<string, Record<string, unknown>>>({});
  const partyUiInitializedFromEditRef = useRef(false);

  // State for cargo details
  const [cargoDetails, setCargoDetails] = useState<CargoDetail[]>([
    {
      container_number: "",
      package_type: "",
      no_of_packages: null,
      gross_weight: null,
      volume: null,
      chargeable_weight: null,
      haz: null,
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

  // Delivery Order preview state
  const [doPreviewOpen, setDoPreviewOpen] = useState(false);
  const [doPdfBlob, setDoPdfBlob] = useState<string | null>(null);
  const [doConfigOpen, setDoConfigOpen] = useState(false);
  const [doTypeSelection, setDoTypeSelection] = useState<DoTypeOption | null>(
    null,
  );
  const [doDeliverToSelection, setDoDeliverToSelection] =
    useState<DoDeliverToOption | null>(null);

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

  // Charges Form - Using useForm similar to routings in ImportJobCreate
  const chargesForm = useForm<{ charges: ChargeDetail[] }>({
    initialValues: {
      charges: [
        {
          charge_id: null,
          charge_name: "",
          pp_cc: "Collect",
          unit_id: "",
          unit_code: "",
          no_of_unit: null,
          ...branchCurrencyDefaults,
          amount_per_unit: null,
          amount: null,
          sell_local_amount: null,
          unit_cost: null,
          total_cost: null,
          cost_local_amount: null,
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
        setShipperManualMode(true);
        shipperDataRef.current = {};
        // When shipment-party has no matches, keep user's typed text as manual entry
        form.setFieldValue("shipper_code", "");
        form.setFieldValue("shipper_name", query);
        return;
      }

      const map: Record<string, Record<string, unknown>> = {};
      const opts = arr.map((item) => {
        const id = String(item.id ?? "");
        map[id] = item;
        return {
          value: id,
          label: String(item.customer_name || ""),
        };
      });

      shipperDataRef.current = map;
      setShipperOptions(opts);
      setShipperManualMode(false);
    } catch (error) {
      console.error("Shipper shipment-party search failed:", error);
      setShipperOptions([]);
      setShipperManualMode(false);
      shipperDataRef.current = {};
    }
  }, 500);

  const getPartyEmail = (original: Record<string, unknown>): string => {
    const email =
      (original.customer_email as string | undefined) ??
      (original.email as string | undefined) ??
      (original.customerEmail as string | undefined) ??
      "";
    return String(email || "");
  };

  const getPartyAddresses = (
    original: Record<string, unknown>,
  ): Array<{ address?: string }> => {
    const raw =
      (original.addresses_data as unknown) ??
      (original.addresses as unknown) ??
      (original.address_data as unknown);
    if (!Array.isArray(raw)) return [];
    return (raw as Array<Record<string, unknown>>).map((a) => ({
      address:
        (a.address as string | undefined) ?? (a.address1 as string | undefined),
    }));
  };

  // Get existing housing details from location state if available
  // Support both hawbDetails and housingDetails for backward compatibility (same as AirHouseCreate)
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
  const isLclShipment = useMemo(
    () =>
      String(location.state?.mblDetails?.service ?? "").toUpperCase() === "LCL",
    [location.state?.mblDetails?.service],
  );

  const jobService = useMemo(
    () => String(location.state?.mblDetails?.service ?? "").toUpperCase(),
    [location.state?.mblDetails?.service],
  );

  useEffect(() => {
    if (!isEditMode && active === 4) setActive(0);
  }, [active, isEditMode]);

  // Unit and currency masters - fetch early for charge loading when in edit mode
  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster", ["FCL", "LCL"]],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Load cargo_details and charges from editData when in edit mode
  useEffect(() => {
    if (isEditMode && editData) {
      // Load cargo details
      if (
        editData.cargo_details &&
        Array.isArray(editData.cargo_details) &&
        editData.cargo_details.length > 0
      ) {
        // Map cargo details and add container_number from containerNumbers if available
        const containerNumbers = location.state?.containerNumbers || [];
        const containerDetails = location.state?.containerDetails || [];

        const mappedCargoDetails = editData.cargo_details.map(
          (cargo: Record<string, unknown>, index: number) => {
            // Use container_no from cargo_details API response as primary source
            // Fallback to containerNumbers[index] if container_no is not available
            const containerNumber =
              (cargo.container_no ? String(cargo.container_no) : null) ||
              (containerNumbers[index]
                ? String(containerNumbers[index])
                : "") ||
              "";

            // Find container_id by matching container_number with containerDetails
            const matchedContainer = containerDetails.find(
              (container: Record<string, unknown>) =>
                container.container_no === containerNumber,
            );
            const containerId = matchedContainer?.id
              ? typeof matchedContainer.id === "number"
                ? matchedContainer.id
                : Number(matchedContainer.id)
              : undefined;

            return {
              id: cargo.id
                ? typeof cargo.id === "number"
                  ? cargo.id
                  : Number(cargo.id)
                : undefined,
              container_number: containerNumber,
              container_id: containerId,
              package_type: cargo.package_type
                ? String(cargo.package_type)
                : "",
              no_of_packages: cargo.no_of_packages as number | null,
              gross_weight: importHouseCargoWeightFromApi(cargo.gross_weight),
              volume: importHouseCargoWeightFromApi(cargo.volume),
              chargeable_weight: importHouseCargoWeightFromApi(
                cargo.chargeable_weight,
              ),
              haz:
                cargo.haz !== null && cargo.haz !== undefined
                  ? typeof cargo.haz === "boolean"
                    ? cargo.haz
                    : cargo.haz === "Yes" || cargo.haz === true
                  : null,
            };
          },
        );
        setCargoDetails(mappedCargoDetails);
      }

      // Load charges - check both charges and mbl_charges
      const chargesToLoad =
        (editData.charges && Array.isArray(editData.charges)
          ? editData.charges
          : null) ||
        (editData as { mbl_charges?: unknown[] }).mbl_charges ||
        [];
      const chargesArray = Array.isArray(chargesToLoad) ? chargesToLoad : [];
      const unitArr = Array.isArray(unitDataRaw) ? unitDataRaw : [];
      const currArr = Array.isArray(currencyData) ? currencyData : [];
      if (chargesArray.length > 0) {
        const unitDataArr = unitArr as { id?: number; unit_code?: string }[];
        const currencyDataArr = currArr as {
          id?: number;
          code?: string;
          currency_code?: string;
        }[];
        const mappedCharges = chargesArray.map(
          (charge: Record<string, unknown>) => {
            const unitDetails = charge.unit_details as
              { unit_id?: number; unit_code?: string } | undefined;
            const currencyDetails = charge.currency_details as
              { currency_id?: number; currency_code?: string } | undefined;
            const unitCode = String(
              charge.unit_code ??
                charge.unit ??
                charge.unit_input ??
                unitDetails?.unit_code ??
                "",
            ).trim();
            const currencyCode = String(
              currencyDetails?.currency_code ??
                charge.currency_code ??
                (charge.currency != null &&
                !/^\d+$/.test(String(charge.currency))
                  ? charge.currency
                  : ""),
            ).trim();

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
              id:
                charge.id != null
                  ? typeof charge.id === "number"
                    ? charge.id
                    : Number(charge.id)
                  : undefined,
              charge_id: chargeId,
              charge_name: charge.charge_name ? String(charge.charge_name) : "",
              supplier_code: charge.supplier_code
                ? String(charge.supplier_code)
                : "",
              supplier_name: charge.supplier_name
                ? String(charge.supplier_name)
                : "",
              pp_cc: normalizePpCc(charge.pp_cc),
              unit_id,
              unit_code: unitCode,
              no_of_unit: toNum(charge.no_of_unit),
              currency_id,
              currency: currencyCode,
              roe: toNum(charge.roe),
              amount_per_unit: toNum(charge.amount_per_unit),
              amount: toNum(charge.amount),
              sell_local_amount: toNum(charge.sell_local_amount),
              unit_cost: toNum(charge.unit_cost),
              total_cost: toNum(charge.total_cost),
              cost_local_amount: toNum(charge.cost_local_amount),
            };
          },
        );
        const editCargoForCharges = toBookingCargoForNoOfUnits(
          (
            (editData.cargo_details as Array<Record<string, unknown>>) ?? []
          ).map((cargo) => ({
            gross_weight: importHouseCargoWeightFromApi(cargo.gross_weight),
            volume: importHouseCargoWeightFromApi(cargo.volume),
            chargeable_weight: importHouseCargoWeightFromApi(
              cargo.chargeable_weight,
            ),
            no_of_packages: cargo.no_of_packages as number | string | null,
          })),
        );
        const editService = String(
          (editData as { service?: string }).service ??
            location.state?.mblDetails?.service ??
            jobService,
        ).toUpperCase();
        chargesForm.setValues({
          charges:
            mapJobChargesWithUnits(
              mappedCharges,
              editService,
              editCargoForCharges,
              buildJobUnitOptions(unitArr),
            ) ?? mappedCharges,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editData, editIndex, unitDataRaw, currencyData]);

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

  // Form with all fields - pre-fill if in edit mode, auto-set from MBL in create mode
  const form = useForm<HouseDetailsForm>({
    initialValues: {
      hbl_number: editData?.hbl_number || "",
      house_date: (editData as { house_date?: string | Date } | undefined)
        ?.house_date
        ? new Date(
            String((editData as { house_date?: string | Date }).house_date),
          )
        : null,
      shipment_terms_code: editData?.shipment_terms_code || "",
      shipment_terms_name: editData?.shipment_terms_name || "",
      pp_cc: normalizeFreightPpCc(
        (editData as { pp_cc?: unknown } | undefined)?.pp_cc ??
          (editData as { freight?: unknown } | undefined)?.freight,
      ),
      routed: normalizeRoutedValue(editData?.routed),
      routed_by: editData?.routed_by || "",
      origin_code:
        editData?.origin_code ||
        (editIndex === undefined
          ? location.state?.mblDetails?.origin_code || ""
          : ""),
      origin_name:
        editData?.origin_name ||
        (editIndex === undefined
          ? location.state?.mblDetails?.origin_name || ""
          : ""),
      destination_code:
        editData?.destination_code ||
        (editIndex === undefined
          ? location.state?.mblDetails?.destination_code || ""
          : ""),
      destination_name:
        editData?.destination_name ||
        (editIndex === undefined
          ? location.state?.mblDetails?.destination_name || ""
          : ""),
      customer_service: editData?.customer_service || "",
      trade: editData?.trade || "",
      agent_name:
        (editData as { agent_name?: string } | undefined)?.agent_name || "",
      agent_code:
        editIndex === undefined
          ? location.state?.mblDetails?.origin_agent || ""
          : (editData as { agent_code?: string } | undefined)?.agent_code || "",
      agent_address:
        (editData as { agent_address?: string } | undefined)?.agent_address ||
        "",
      agent_email:
        (editData as { agent_email?: string } | undefined)?.agent_email || "",
      cha_code: (editData as { cha_code?: string })?.cha_code ?? "",
      cha_name: (editData as { cha_name?: string })?.cha_name ?? "",
      cha_address: (editData as { cha_address?: string })?.cha_address ?? "",
      shipper_code:
        editData?.shipper_id != null && String(editData.shipper_id) !== ""
          ? String(editData.shipper_id)
          : String(editData?.shipper_code || ""),
      shipper_name: editData?.shipper_name || "",
      shipper_address: editData?.shipper_address || "",
      shipper_email: editData?.shipper_email || "",
      shipper_state_id:
        editData?.shipper_state_id != null
          ? String(editData.shipper_state_id)
          : "",
      consignee_code: editData?.consignee_code || "",
      consignee_name: editData?.consignee_name || "",
      consignee_address: editData?.consignee_address || "",
      consignee_email: editData?.consignee_email || "",
      consignee_state_id:
        (editData as { consignee_state_id?: number | string } | undefined)
          ?.consignee_state_id != null
          ? String(
              (editData as { consignee_state_id?: number | string })
                .consignee_state_id,
            )
          : "",
      notify1_customer_name:
        (editData as { notify1_customer_name?: string })
          ?.notify1_customer_name ?? "",
      notify1_customer_address:
        (editData as { notify1_customer_address?: string })
          ?.notify1_customer_address ?? "",
      notify1_customer_email:
        (editData as { notify1_customer_email?: string })
          ?.notify1_customer_email ?? "",
      commodity_description: editData?.commodity_description || "",
      marks_no: editData?.marks_no || "",
      note: (editData as { note?: string } | undefined)?.note || "",
      item_no: (editData as { item_no?: string } | undefined)?.item_no || "",
      sub_item_no:
        (editData as { sub_item_no?: string } | undefined)?.sub_item_no || "",
      ref_no: (editData as { ref_no?: string } | undefined)?.ref_no || "",
      hscode: (editData as { hscode?: string } | undefined)?.hscode || "",
      item_type:
        (editData as { item_type?: string } | undefined)?.item_type || "",
      events: initialHousingEvents,
      event_modal_rows: eventsToEventModalRows(initialHousingEvents),
    },
    validate: () => {
      // Validation handled in validateStep functions
      return {};
    },
  });

  // Initialize shipper/consignee UI from editData once (avoid reset when unit/currency masters load)
  useEffect(() => {
    if (!isEditMode || !editData || partyUiInitializedFromEditRef.current)
      return;
    partyUiInitializedFromEditRef.current = true;

    form.setFieldValue(
      "pp_cc",
      normalizeFreightPpCc(
        (editData as { pp_cc?: unknown }).pp_cc ??
          (editData as { freight?: unknown }).freight,
      ),
    );

    const shipperName = String(editData.shipper_name || "");
    if (shipperName) {
      setShipperSearch(shipperName);
    }

    const shipperSelectValue =
      editData.shipper_id != null && String(editData.shipper_id) !== ""
        ? String(editData.shipper_id)
        : String(editData.shipper_code || "");
    if (shipperSelectValue) {
      form.setFieldValue("shipper_code", shipperSelectValue);
    }

    const shipperAddr = editData.shipper_address;
    if (shipperAddr) {
      const addrStr = toTitleCase(String(shipperAddr));
      setShipperAddressOptions([{ value: addrStr, label: addrStr }]);
    }

    if (shipperName && !editData.shipper_code && !editData.shipper_id) {
      setShipperManualMode(true);
    }

    const consigneeSelectValue =
      editData.consignee_id != null && String(editData.consignee_id) !== ""
        ? String(editData.consignee_id)
        : String(editData.consignee_code || "");
    if (consigneeSelectValue) {
      form.setFieldValue("consignee_code", consigneeSelectValue);
    }

    const consigneeAddr = editData.consignee_address;
    if (consigneeAddr) {
      const addrStr = toTitleCase(String(consigneeAddr));
      setConsigneeAddressOptions([{ value: addrStr, label: addrStr }]);
    }
  }, [isEditMode, editData, form]);

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

  // Memoize displayFormat callbacks for SearchableSelect to avoid refetch loops on rerenders
  const portDisplayFormat = useCallback((item: Record<string, unknown>) => {
    return {
      value: String(item.port_code),
      label: `${String(item.port_name)} (${String(item.port_code)})`,
    };
  }, []);

  const customerNameOnlyDisplayFormat = useCallback(
    (item: Record<string, unknown>) => ({
      value: String(item.customer_name ?? ""),
      label: String(item.customer_name ?? ""),
    }),
    [],
  );

  const customerCodeNameDisplayFormat = useCallback(
    (item: Record<string, unknown>) => ({
      value: String(item.customer_code ?? ""),
      label: String(item.customer_name ?? ""),
    }),
    [],
  );

  const chargeNameDisplayFormat = useCallback(
    (item: Record<string, unknown>) => ({
      value: String(item.id ?? ""),
      label: String(item.charge_name ?? ""),
    }),
    [],
  );

  // Similar booking check - modal and API (Ocean Import Job Create flow only)
  const [similarBookingModalOpen, setSimilarBookingModalOpen] = useState(false);
  const [similarBookingData, setSimilarBookingData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [similarBookingId, setSimilarBookingId] = useState<number | null>(null);
  const [similarBookingApplyLoading, setSimilarBookingApplyLoading] =
    useState(false);

  const fetchSimilarBookings = useCallback(
    async (hblNo: string, agentCode: string) => {
      if (!hblNo?.trim() || !agentCode?.trim()) return;
      try {
        const response = (await postAPICall(
          URL.customerServiceShipmentFilter,
          {
            filters: {
              service_type: "IMPORT",
              service: location.state?.mblDetails?.service,
              status: ["BOOKED", "RECEIVED"],
              houseno: hblNo.trim(),
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
    (hblNo: string, agentCode: string) => {
      fetchSimilarBookings(hblNo, agentCode);
    },
    2000,
  );

  useEffect(() => {
    if (isEditMode) return;
    const hblNo = form.values.hbl_number?.trim();
    const agentCode = form.values.agent_code?.trim();
    if (hblNo && agentCode) {
      debouncedFetchSimilarBookings(hblNo, agentCode);
    }
  }, [
    isEditMode,
    form.values.hbl_number,
    form.values.agent_code,
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

    // Shipment terms
    form.setFieldValue(
      "shipment_terms_code",
      String(rb.shipment_terms_code || ""),
    );
    form.setFieldValue(
      "shipment_terms_name",
      String(rb.shipment_terms_name || ""),
    );

    // Party details
    const shipperCode = rb.shipper_code || "";
    const shipperName = rb.shipper_name || "";
    const consigneeCode = rb.consignee_code || "";
    const consigneeName = rb.consignee_name || "";
    // keep codes for UI only; payload uses name/address/email
    form.setFieldValue("shipper_code", String(shipperCode || ""));
    form.setFieldValue("shipper_name", String(shipperName || ""));
    setShipperSearch(String(shipperName || ""));
    form.setFieldValue("consignee_code", String(consigneeCode || ""));
    form.setFieldValue("consignee_name", String(consigneeName || ""));
    form.setFieldValue(
      "commodity_description",
      String(rb.commodity_description || ""),
    );
    form.setFieldValue("marks_no", String(rb.marks_no || ""));

    // Shipper/consignee addresses - also populate address options for Dropdown
    const shipperAddr = rb.shipper_address;
    const consigneeAddr = rb.consignee_address;
    if (shipperAddr) {
      const addrStr = String(shipperAddr);
      setShipperAddressOptions([{ value: addrStr, label: addrStr }]);
      form.setFieldValue("shipper_address", addrStr);
    }
    if (consigneeAddr) {
      const addrStr = String(consigneeAddr);
      setConsigneeAddressOptions([{ value: addrStr, label: addrStr }]);
      form.setFieldValue("consignee_address", addrStr);
    }

    const shipperEmail = rb.shipper_email;
    const consigneeEmail = rb.consignee_email;
    if (shipperEmail) form.setFieldValue("shipper_email", String(shipperEmail));
    if (consigneeEmail)
      form.setFieldValue("consignee_email", String(consigneeEmail));

    // Notify customer name / address / email (supports both notify1_* and legacy notify_*)
    form.setFieldValue(
      "notify1_customer_name",
      String(rb.notify1_customer_name || rb.notify_customer || ""),
    );
    form.setFieldValue(
      "notify1_customer_address",
      String(rb.notify1_customer_address || rb.notify_customer_address || ""),
    );
    form.setFieldValue(
      "notify1_customer_email",
      String(rb.notify1_customer_email || rb.notify_customer_email || ""),
    );

    // Origin agent fields (import booking maps via destination_agent_* keys)
    form.setFieldValue(
      "agent_name",
      String(rb.destination_agent_name || rb.destination_agent || ""),
    );
    if (rb.destination_agent_code) {
      form.setFieldValue("agent_code", String(rb.destination_agent_code));
    }
    // Agent address and email (booking uses destination_agent_* for import)
    if (rb.destination_agent_address) {
      form.setFieldValue("agent_address", String(rb.destination_agent_address));
    }
    if (rb.destination_agent_email) {
      form.setFieldValue("agent_email", String(rb.destination_agent_email));
    }

    // CHA fields
    form.setFieldValue("cha_code", String(rb.cha_code || ""));
    form.setFieldValue("cha_name", String(rb.cha || rb.cha_name || ""));
    form.setFieldValue("cha_address", String(rb.cha_address || ""));

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

    // Cargo details - from cargo_details array when service is FCL
    const serviceType = String(rb.service || "").toUpperCase();
    const isFCL = serviceType === "FCL";
    const cargoDetailsData = rb.cargo_details as
      Array<Record<string, unknown>> | undefined;
    const isHazardous = (rb as { is_hazardous?: boolean }).is_hazardous;
    const hazValue =
      isHazardous === true ? true : isHazardous === false ? false : null;

    const toNum = (v: unknown): number | null => {
      if (v == null) return null;
      const n = parseFloat(String(v));
      return Number.isNaN(n) ? null : n;
    };

    if (
      isFCL &&
      cargoDetailsData &&
      Array.isArray(cargoDetailsData) &&
      cargoDetailsData.length > 0
    ) {
      const mappedFromContainers = cargoDetailsData.flatMap((c) => {
        const nested = Array.isArray(c.containers)
          ? (c.containers as Array<Record<string, unknown>>)
          : [];
        if (nested.length === 0) return [];
        return nested.map((cn) => ({
          container_number: String(cn.container_no ?? ""),
          package_type: String(cn.package_type ?? c.package_type ?? ""),
          no_of_packages: toNum(
            cn.no_of_packages ??
              c.no_of_packages ??
              c.no_of_containers ??
              rb.no_of_packages,
          ),
          gross_weight: importHouseCargoWeightFromApi(
            cn.gross_weight ?? c.gross_weight ?? rb.gross_weight,
          ),
          volume: toNum(
            cn.volume ??
              c.volume ??
              c.volume_weight ??
              rb.volume ??
              rb.volume_weight,
          ),
          chargeable_weight: toNum(
            cn.chargeable_weight ??
              cn.chargeable_volume ??
              c.chargeable_weight ??
              c.chargeable_volume ??
              rb.chargeable_weight ??
              rb.chargeable_volume,
          ),
          haz: (cn.haz as boolean) ?? (c.haz as boolean) ?? hazValue,
        }));
      });
      const mapped =
        mappedFromContainers.length > 0
          ? mappedFromContainers
          : cargoDetailsData.map((c) => ({
              container_number: String(
                c.container_no ?? c.container_number ?? "",
              ),
              package_type: String(c.package_type ?? ""),
              // FCL API uses no_of_containers; map to No of Packages
              no_of_packages: toNum(
                c.no_of_containers ?? c.no_of_packages ?? rb.no_of_packages,
              ),
              gross_weight: importHouseCargoWeightFromApi(
                c.gross_weight ?? rb.gross_weight,
              ),
              volume: toNum(c.volume ?? c.volume_weight ?? rb.volume),
              chargeable_weight: toNum(
                c.chargeable_weight ??
                  c.chargeable_volume ??
                  rb.chargeable_weight ??
                  rb.chargeable_volume,
              ),
              haz: (c.haz as boolean) ?? hazValue,
            }));
      setCargoDetails(mapped.length > 0 ? mapped : []);
    } else if (
      cargoDetailsData &&
      Array.isArray(cargoDetailsData) &&
      cargoDetailsData.length > 0
    ) {
      const mappedFromContainers = cargoDetailsData.flatMap((c) => {
        const nested = Array.isArray(c.containers)
          ? (c.containers as Array<Record<string, unknown>>)
          : [];
        if (nested.length === 0) return [];
        return nested.map((cn) => ({
          container_number: String(cn.container_no ?? ""),
          package_type: String(cn.package_type ?? c.package_type ?? ""),
          no_of_packages: toNum(
            cn.no_of_packages ?? c.no_of_packages ?? rb.no_of_packages,
          ),
          gross_weight: importHouseCargoWeightFromApi(
            cn.gross_weight ?? c.gross_weight ?? rb.gross_weight,
          ),
          volume:
            toNum(cn.volume) ??
            toNum(c.volume) ??
            toNum(c.volume_weight) ??
            toNum(rb.volume) ??
            toNum(rb.volume_weight),
          chargeable_weight:
            toNum(cn.chargeable_weight) ??
            toNum(cn.chargeable_volume) ??
            toNum(c.chargeable_volume) ??
            toNum(c.chargeable_weight) ??
            toNum(rb.chargeable_volume) ??
            toNum(rb.chargeable_weight),
          haz: (c.haz as boolean) ?? hazValue,
        }));
      });
      const mapped =
        mappedFromContainers.length > 0
          ? mappedFromContainers
          : cargoDetailsData.map((c) => ({
              container_number: String(
                c.container_no ?? c.container_number ?? "",
              ),
              package_type: String(c.package_type ?? ""),
              no_of_packages: toNum(
                c.no_of_packages ?? c.no_of_containers ?? rb.no_of_packages,
              ),
              gross_weight: importHouseCargoWeightFromApi(
                c.gross_weight ?? rb.gross_weight,
              ),
              volume:
                toNum(c.volume) ??
                toNum(c.volume_weight) ??
                toNum(rb.volume) ??
                toNum(rb.volume_weight),
              chargeable_weight:
                toNum(c.chargeable_volume) ??
                toNum(c.chargeable_weight) ??
                toNum(rb.chargeable_volume) ??
                toNum(rb.chargeable_weight),
              haz: (c.haz as boolean) ?? hazValue,
            }));
      setCargoDetails(mapped.length > 0 ? mapped : []);
    } else {
      const row = {
        container_number: "",
        package_type: "",
        no_of_packages: toNum(rb.no_of_packages),
        gross_weight: importHouseCargoWeightFromApi(rb.gross_weight),
        volume: toNum(rb.volume) ?? toNum(rb.volume_weight),
        chargeable_weight:
          toNum(rb.chargeable_volume) ?? toNum(rb.chargeable_weight),
        haz: hazValue,
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
          pp_cc: normalizePpCc((r as { pp_cc?: unknown }).pp_cc),
          unit_id: unitId,
          unit_code: String(r.unit || ""),
          no_of_unit: r.no_of_units != null ? Number(r.no_of_units) : null,
          currency_id: currencyId,
          currency: String(
            (r as { currency_country_code?: string }).currency_country_code ||
              "",
          ),
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
      // Ensure overlay is rendered before field updates start.
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

  // Auto-calculate chargeable weight when gross weight or volume changes
  const cargoGrossWeights = cargoDetails.map((c) => c.gross_weight).join(",");
  const cargoVolumes = cargoDetails.map((c) => c.volume).join(",");

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
  }, [cargoGrossWeights, cargoVolumes, calculateChargeableWeight]);

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

  // Auto-calculate amount, sell_local_amount, cost_local_amount when dependencies change
  // Formula: amount = no_of_unit * amount_per_unit
  //          total_cost = unit_cost * no_of_unit
  //          sell_local_amount = amount * roe
  //          cost_local_amount = total_cost * roe
  const chargeCalculationKeys = chargesForm.values.charges
    .map(
      (c) =>
        `${c.roe || ""}_${c.no_of_unit || ""}_${c.amount_per_unit || ""}_${c.unit_cost || ""}_${c.total_cost || ""}`,
    )
    .join(",");
  const chargeAmounts = chargesForm.values.charges
    .map((c) => c.amount)
    .join(",");

  useEffect(() => {
    const updatedCharges = chargesForm.values.charges.map((charge) => {
      const next = { ...charge };

      // Calculate: amount = no_of_unit * amount_per_unit
      if (
        charge.amount_per_unit !== null &&
        charge.amount_per_unit !== undefined &&
        charge.amount_per_unit > 0
      ) {
        const noOfUnit =
          charge.no_of_unit !== null && charge.no_of_unit !== undefined
            ? charge.no_of_unit
            : 0;
        const calculatedAmount = roundMoneyAmountBound(
          noOfUnit * charge.amount_per_unit,
        );
        if (calculatedAmount !== next.amount) {
          next.amount = calculatedAmount > 0 ? calculatedAmount : null;
        }
      }

      // Calculate: sell_local_amount = amount * roe
      if (
        next.amount != null &&
        next.amount > 0 &&
        next.roe != null &&
        next.roe > 0
      ) {
        const calculatedSellLocal = next.amount * next.roe;
        if (calculatedSellLocal !== next.sell_local_amount) {
          next.sell_local_amount = calculatedSellLocal;
        }
      } else if (next.sell_local_amount != null) {
        next.sell_local_amount = null;
      }

      // Calculate: cost_local_amount = total_cost * roe
      if (
        next.total_cost != null &&
        next.total_cost > 0 &&
        next.roe != null &&
        next.roe > 0
      ) {
        const calculatedCostLocal = next.total_cost * next.roe;
        if (calculatedCostLocal !== next.cost_local_amount) {
          next.cost_local_amount = calculatedCostLocal;
        }
      } else if (next.cost_local_amount != null) {
        next.cost_local_amount = null;
      }

      return next;
    });

    const hasChanges = updatedCharges.some((charge, index) => {
      const orig = chargesForm.values.charges[index];
      return (
        charge.amount !== orig?.amount ||
        charge.sell_local_amount !== orig?.sell_local_amount ||
        charge.cost_local_amount !== orig?.cost_local_amount
      );
    });

    if (hasChanges) {
      chargesForm.setValues({ charges: updatedCharges });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCalculationKeys, chargeAmounts]);

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

  const unitOptions = useMemo(
    () => buildJobUnitOptions(unitDataRaw),
    [unitDataRaw],
  );

  const bookingCargoForCharges = useMemo(
    () => toBookingCargoForNoOfUnits(cargoDetails),
    [cargoDetails],
  );

  const jobChargeNoOfUnitContext = useMemo((): JobChargeNoOfUnitContext => {
    const containerDetails =
      (location.state
        ?.containerDetails as JobChargeNoOfUnitContext["containerDetails"]) ??
      [];
    return {
      containerDetails,
      jobCargoDetails: cargoDetails.map((cargo) => ({
        container_number: cargo.container_number,
        no_of_packages: cargo.no_of_packages,
      })),
    };
  }, [cargoDetails, location.state?.containerDetails]);

  const cargoNoOfUnitsSyncKey = useMemo(
    () =>
      buildJobChargeNoOfUnitsSyncKey(
        jobService,
        bookingCargoForCharges,
        jobChargeNoOfUnitContext,
      ),
    [jobService, bookingCargoForCharges, jobChargeNoOfUnitContext],
  );

  useEffect(() => {
    if (!jobService || !unitOptions.length) return;
    const updated = syncJobChargesWithCargoNoOfUnits(
      chargesForm.values.charges,
      jobService,
      bookingCargoForCharges,
      unitOptions,
      jobChargeNoOfUnitContext,
    );
    if (updated) {
      chargesForm.setValues({ charges: updated });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargoNoOfUnitsSyncKey, jobService, unitOptions]);

  useEffect(() => {
    if (!unitOptions.length || !jobService) return;
    const updated = mapJobChargesWithUnits(
      chargesForm.values.charges,
      jobService,
      bookingCargoForCharges,
      unitOptions,
      jobChargeNoOfUnitContext,
    );
    if (updated) {
      chargesForm.setValues({ charges: updated });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    unitOptions,
    jobService,
    bookingCargoForCharges,
    jobChargeNoOfUnitContext,
  ]);

  // Format container numbers from location state into dropdown options
  const containerNumberOptions = useMemo(() => {
    const containerNumbers = location.state?.containerNumbers || [];
    const fromState = Array.isArray(containerNumbers)
      ? containerNumbers
          .filter((no) => no && String(no).trim() !== "")
          .map((no) => String(no))
      : [];
    const fromAutofill = cargoDetails
      .map((cargo) => String(cargo.container_number || "").trim())
      .filter((no) => no.length > 0);
    const merged = Array.from(new Set([...fromState, ...fromAutofill]));
    return merged
      .filter((no) => no && String(no).trim() !== "")
      .map((no) => ({
        value: String(no),
        label: String(no),
      }));
  }, [location.state?.containerNumbers, cargoDetails]);

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
  const updateTradeField = (hblDestinationCode: string) => {
    console.log("🔄 updateTradeField called with:", hblDestinationCode);
    const mblDestinationCode =
      location.state?.mblDetails?.destination_code || "";

    console.log("🔍 updateTradeField comparison:", {
      hblDestinationCode,
      mblDestinationCode,
      currentTradeValue: form.values.trade,
    });

    // Only update if both destinations exist
    if (hblDestinationCode && mblDestinationCode) {
      // Compare HBL destination with MBL destination
      const newTradeValue =
        hblDestinationCode === mblDestinationCode ? "Import" : "Transshipment";

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
    } else if (!hblDestinationCode && form.values.trade) {
      // Clear trade if HBL destination is cleared
      console.log("🧹 updateTradeField clearing Trade");
      form.setFieldValue("trade", "");
    }
  };

  // Auto-update Trade field whenever HBL destination or MBL destination changes
  useEffect(() => {
    console.log("🔄 useEffect triggered for Trade update:", {
      destinationCode: form.values.destination_code,
      mblDestinationCode: location.state?.mblDetails?.destination_code,
      currentTradeValue: form.values.trade,
    });
    updateTradeField(form.values.destination_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.values.destination_code,
    location.state?.mblDetails?.destination_code,
  ]);

  // Auto-set HBL origin and destination from MBL in create mode
  useEffect(() => {
    if (!isEditMode && location.state?.mblDetails) {
      const mblOriginCode = location.state.mblDetails.origin_code || "";
      const mblOriginName = location.state.mblDetails.origin_name || "";
      const mblDestinationCode =
        location.state.mblDetails.destination_code || "";
      const mblDestinationName =
        location.state.mblDetails.destination_name || "";

      // Set origin if not already set
      if (mblOriginCode && !form.values.origin_code) {
        form.setFieldValue("origin_code", mblOriginCode);
        if (mblOriginName) {
          form.setFieldValue("origin_name", mblOriginName);
        }
      }

      // Set destination if not already set
      if (mblDestinationCode && !form.values.destination_code) {
        form.setFieldValue("destination_code", mblDestinationCode);
        if (mblDestinationName) {
          form.setFieldValue("destination_name", mblDestinationName);
        }
        // Also trigger Trade update when destination is auto-set
        updateTradeField(mblDestinationCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, location.state?.mblDetails]);

  // Auto-update house Agent name/address from MBL origin agent
  useEffect(() => {
    const mblDetails = location.state?.mblDetails;
    if (!mblDetails) return;

    const mblOriginAgent = mblDetails.origin_agent || ""; // This is the customer_code
    const mblOriginAgentName = mblDetails.origin_agent_name || ""; // This is the customer_name
    const mblOriginAgentData = mblDetails.origin_agent_data as
      Record<string, unknown> | null | undefined;

    console.log("🔍 MBL Origin Agent Auto-fill:", {
      mblOriginAgent,
      mblOriginAgentName,
      hasMblOriginAgentData: !!mblOriginAgentData,
      mblOriginAgentData,
      addressesData: mblOriginAgentData?.addresses_data,
      fullMblDetails: mblDetails,
      isEditMode,
      currentAgentName: form.values.agent_name,
    });

    // In create mode: always set from MBL if available
    // In edit mode: only set if not already set (to preserve user edits)
    if (mblOriginAgent && mblOriginAgent.trim() !== "") {
      if (!isEditMode || !form.values.agent_code) {
        form.setFieldValue("agent_code", mblOriginAgent);
      }
      // Auto-set HBL origin agent name from MBL origin agent name
      if (mblOriginAgentName && mblOriginAgentName.trim() !== "") {
        // Only set if not already set in edit mode, or always in create mode
        if (!isEditMode || !form.values.agent_name) {
          form.setFieldValue("agent_name", mblOriginAgentName);
        }
      } else if (
        mblOriginAgentData &&
        (mblOriginAgentData as Record<string, unknown>).customer_name
      ) {
        // Fallback: try to get customer_name from origin_agent_data
        const customerName = (mblOriginAgentData as Record<string, unknown>)
          .customer_name as string;
        if (customerName && customerName.trim() !== "") {
          // Only set if not already set in edit mode, or always in create mode
          if (!isEditMode || !form.values.agent_name) {
            form.setFieldValue("agent_name", customerName);
          }
        }
      }

      // Auto-set HBL origin agent address from MBL
      // Priority: 1. mblDetails.origin_agent_address (direct field), 2. addresses_data from origin_agent_data
      const mblOriginAgentAddress = mblDetails.origin_agent_address as
        string | undefined;

      if (mblOriginAgentAddress && mblOriginAgentAddress.trim() !== "") {
        // Use direct origin_agent_address field from mblDetails if available
        // Only set if not already set in edit mode, or always in create mode
        if (!isEditMode || !form.values.agent_address) {
          console.log(
            "✅ Setting HBL origin agent address from mblDetails.origin_agent_address:",
            mblOriginAgentAddress,
          );
          form.setFieldValue("agent_address", mblOriginAgentAddress);
        }
      } else if (mblOriginAgentData && mblOriginAgentData.addresses_data) {
        // Fallback: Check if addresses_data exists and is an array
        const addressesData = Array.isArray(mblOriginAgentData.addresses_data)
          ? (mblOriginAgentData.addresses_data as Array<{
              id: number;
              address: string;
            }>)
          : null;

        console.log("📍 Processed Addresses Data:", addressesData);

        // Auto-select the first address if available
        if (
          addressesData &&
          addressesData.length > 0 &&
          addressesData[0].address
        ) {
          const firstAddress = addressesData[0].address;
          // Only set if not already set in edit mode, or always in create mode
          if (!isEditMode || !form.values.agent_address) {
            console.log(
              "✅ Setting HBL origin agent address from addresses_data:",
              firstAddress,
            );
            form.setFieldValue("agent_address", firstAddress);
          }
        } else {
          console.log("⚠️ No valid address found in addresses_data");
          // Clear address if no addresses_data available (only in create mode)
          if (!isEditMode) {
            form.setFieldValue("agent_address", "");
          }
        }
      } else {
        console.log("⚠️ No mblOriginAgentData or addresses_data found");
        // Clear address if no origin_agent_data (only in create mode)
        if (!isEditMode) {
          form.setFieldValue("agent_address", "");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Auto-set routed_by to MBL origin agent name when routed is "agent"
  useEffect(() => {
    if (form.values.routed === "agent") {
      const mblDetails = location.state?.mblDetails;
      if (!mblDetails) return;

      // Get origin agent name from mblDetails
      // origin_agent_name is the customer_name (name) for display
      let mblOriginAgentName = mblDetails.origin_agent_name || "";

      // If origin_agent_name is empty, try to get it from origin_agent_data
      if (!mblOriginAgentName && mblDetails.origin_agent_data) {
        const originAgentData = mblDetails.origin_agent_data as Record<
          string,
          unknown
        >;
        // Try to get customer_name from origin_agent_data
        mblOriginAgentName = (originAgentData.customer_name as string) || "";
      }

      if (mblOriginAgentName && mblOriginAgentName.trim() !== "") {
        // Auto-set routed_by to MBL origin agent name if not already set or if MBL origin agent changed
        if (
          !form.values.routed_by ||
          form.values.routed_by !== mblOriginAgentName
        ) {
          form.setFieldValue("routed_by", mblOriginAgentName);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.values.routed,
    location.state?.mblDetails?.origin_agent_name,
    location.state?.mblDetails?.origin_agent_data,
  ]);

  // Validate step 1 - Validate required fields
  const validateStep1 = () => {
    const errors: Record<string, string> = {};

    if (!form.values.hbl_number?.trim()) {
      errors.hbl_number = "HBL Number is required";
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
      form.values.agent_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.agent_email)
    ) {
      errors.agent_email = "Invalid email format";
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

      // Mandatory fields: container_number, no_of_packages, gross_weight, volume
      if (!cargo.container_number || cargo.container_number.trim() === "") {
        cargoError.container_number = "Container Number is required";
        hasErrors = true;
      }
      if (cargo.no_of_packages === null || cargo.no_of_packages === undefined) {
        cargoError.no_of_packages = "No of Packages is required";
        hasErrors = true;
      }
      if (cargo.gross_weight === null || cargo.gross_weight === undefined) {
        cargoError.gross_weight = "Gross Weight is required";
        hasErrors = true;
      }
      if (cargo.volume === null || cargo.volume === undefined) {
        cargoError.volume = "Volume is required";
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
      chargesForm.values.charges,
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

  /** Builds the housing list from the current form (events, cargo, charges) for sync with Job Create. */
  const buildUpdatedHousingDetailsFromForm = () => {
    // Get container details to map container_number to container_id
    const containerDetails = location.state?.containerDetails || [];
    const containerNumbers = location.state?.containerNumbers || [];

    // Prepare cargo details with container_no (create) or container_id (edit)
    const cargoDetailsForPayload = cargoDetails.map((cargo, idx) => {
      // Keep the raw UI fields separate
      const {
        container_number, // UI field selected by user
        container_id, // maybe pre-populated in edit mode
        id, // cargo id (only present in editData)
        package_type,
        no_of_packages,
        gross_weight,
        volume,
        haz,
      } = cargo as any;

      // Try to find matching container object (from containerDetails) by container_no
      const matchedContainer = containerDetails.find(
        (c: Record<string, unknown>) =>
          c.container_no === container_number ||
          // Also allow matching by index if containerNumbers are aligned
          (Array.isArray(containerNumbers) &&
            containerNumbers[idx] === container_number),
      );

      // Build base payload common to create/edit
      // Convert haz to boolean: true for "Yes", false for "No", null otherwise
      const hazValue =
        haz === true || haz === "Yes" || String(haz).toLowerCase() === "yes"
          ? true
          : haz === false || haz === "No" || String(haz).toLowerCase() === "no"
            ? false
            : null;
      const basePayload: Record<string, unknown> = {
        no_of_packages: no_of_packages ?? null,
        gross_weight: formatHouseCargoWeightForPayload(gross_weight),
        volume: formatHouseCargoWeightForPayload(volume),
        chargeable_weight: formatHouseCargoChargeableForPayload(
          gross_weight,
          volume,
          "ocean",
        ),
        haz: hazValue,
        package_type: package_type || null,
      };

      // Include id only when editing and id exists
      if (isEditMode && id !== undefined && id !== null) {
        basePayload.id = typeof id === "number" ? id : Number(id);
      }

      // Now add container identifier:
      // - In edit mode, include both container_no and container_id
      // - In create mode, include container_no if available, or container_id if matched
      // Resolve container id from cargo or matched container (both edit/create)
      const resolvedContainerId =
        container_id !== undefined && container_id !== null
          ? typeof container_id === "number"
            ? container_id
            : Number(container_id)
          : matchedContainer?.id !== undefined && matchedContainer?.id !== null
            ? typeof matchedContainer.id === "number"
              ? matchedContainer.id
              : Number(matchedContainer.id)
            : undefined;

      // In edit mode, include both container_no and container_id
      if (isEditMode) {
        if (container_number) {
          (basePayload as any).container_no = String(container_number);
        }
        if (resolvedContainerId !== undefined) {
          (basePayload as any).container_id = resolvedContainerId;
        }
      } else {
        // In create mode, prefer container_id if available, otherwise use container_no
        if (resolvedContainerId !== undefined) {
          (basePayload as any).container_id = resolvedContainerId;
        } else if (container_number) {
          (basePayload as any).container_no = String(container_number);
        }
      }

      return basePayload;
    });

    // Prepare charges payload - include id only in edit mode, charge_id, supplier_code for API
    const meaningfulCharges = getMeaningfulHouseCharges(
      chargesForm.values.charges,
    );
    const chargesForPayload =
      meaningfulCharges.length === 0
        ? []
        : meaningfulCharges.map((charge) => ({
            ...(isEditMode &&
              charge.id && {
                id:
                  typeof charge.id === "number" ? charge.id : Number(charge.id),
              }),
            ...(charge.charge_id != null && { charge_id: charge.charge_id }),
            charge_name: charge.charge_name,
            pp_cc: charge.pp_cc,
            unit_id: charge.unit_id || undefined,
            unit_code: charge.unit_code,
            currency_id: charge.currency_id || undefined,
            currency: charge.currency,
            no_of_unit: parseNoOfUnitForPayload(charge.no_of_unit),
            roe: roundRoeForPayload(charge.roe) ?? null,
            amount_per_unit: roundMoneyToDecimals(charge.amount_per_unit) ?? null,
            amount: roundMoneyToDecimals(charge.amount) ?? null,
            sell_local_amount:
              roundMoneyToDecimals(charge.sell_local_amount) ?? null,
            unit_cost: roundMoneyToDecimals(charge.unit_cost) ?? null,
            total_cost: roundMoneyToDecimals(charge.total_cost) ?? null,
            cost_local_amount:
              roundMoneyToDecimals(charge.cost_local_amount) ?? null,
            supplier_code: charge.supplier_code || null,
            supplier_name: charge.supplier_name ?? null,
          }));

    // Prepare housing detail object
    const housingDetail = {
      // Include id and shipment_id only in edit mode
      ...(isEditMode &&
        editData?.id && {
          id:
            typeof editData.id === "number" ? editData.id : Number(editData.id),
        }),
      ...(isEditMode &&
        editData?.shipment_id && { shipment_id: editData.shipment_id }),
      hbl_number: form.values.hbl_number,
      house_date: form.values.house_date
        ? dayjs(form.values.house_date).format("YYYY-MM-DD")
        : null,
      shipment_terms_code: form.values.shipment_terms_code,
      shipment_terms_name: form.values.shipment_terms_name,
      pp_cc: form.values.pp_cc || "Collect",
      routed: form.values.routed,
      routed_by: form.values.routed_by,
      origin_code: form.values.origin_code,
      origin_name: form.values.origin_name,
      destination_code: form.values.destination_code,
      destination_name: form.values.destination_name,
      customer_service: form.values.customer_service,
      trade: form.values.trade,
      agent_name: form.values.agent_name,
      agent_address: form.values.agent_address,
      agent_email: form.values.agent_email,
      cha_name: form.values.cha_name,
      cha_address: form.values.cha_address,
      shipper_name: form.values.shipper_name,
      shipper_address: form.values.shipper_address,
      shipper_email: form.values.shipper_email,
      shipper_state_id: form.values.shipper_state_id
        ? Number(form.values.shipper_state_id)
        : ((
            editData as
              { shipment_id?: string; shipper_state_id?: number } | undefined
          )?.shipper_state_id ?? null),
      shipment_id:
        (editData as { shipment_id?: string } | undefined)?.shipment_id ?? null,
      consignee_name: form.values.consignee_name,
      consignee_address: form.values.consignee_address,
      consignee_email: form.values.consignee_email,
      consignee_state_id: form.values.consignee_state_id
        ? Number(form.values.consignee_state_id)
        : ((editData as { consignee_state_id?: number } | undefined)
            ?.consignee_state_id ??
          (
            location.state?.job as {
              housing_details?: Array<{ consignee_state_id?: number }>;
            }
          )?.housing_details?.[editIndex ?? 0]?.consignee_state_id ??
          null),
      consignee_gst_id:
        (editData as { consignee_gst_id?: string } | undefined)
          ?.consignee_gst_id ??
        (
          location.state?.job as {
            housing_details?: Array<{ consignee_gst_id?: string | null }>;
          }
        )?.housing_details?.[editIndex ?? 0]?.consignee_gst_id ??
        null,
      consignee_pan_no:
        (editData as { consignee_pan_no?: string } | undefined)
          ?.consignee_pan_no ??
        (
          location.state?.job as {
            housing_details?: Array<{ consignee_pan_no?: string | null }>;
          }
        )?.housing_details?.[editIndex ?? 0]?.consignee_pan_no ??
        null,
      consignee_state_code:
        (editData as { consignee_state_code?: string } | undefined)
          ?.consignee_state_code ??
        (
          location.state?.job as {
            housing_details?: Array<{ consignee_state_code?: string | null }>;
          }
        )?.housing_details?.[editIndex ?? 0]?.consignee_state_code ??
        null,
      notify1_customer_name: form.values.notify1_customer_name,
      notify1_customer_address: form.values.notify1_customer_address,
      notify1_customer_email: form.values.notify1_customer_email,
      commodity_description: form.values.commodity_description,
      marks_no: form.values.marks_no,
      note: form.values.note || "",
      item_no: form.values.item_no,
      sub_item_no: form.values.sub_item_no,
      ref_no: form.values.ref_no,
      hscode: form.values.hscode || "",
      item_type: form.values.item_type || "",
      events: form.values.events ?? [],
      cargo_details: cargoDetailsForPayload,
      charges: chargesForPayload,
      ...(similarBookingId != null && { booking_id: similarBookingId }),
      ...pickHouseDocumentFields(housePageDocuments.getNavigationState()),
    };

    // Update existing housing details
    let updatedHousingDetails: typeof existingHousingDetails;

    if (isEditMode && editIndex !== undefined) {
      // Deep clone existing list (prevents stale nested references)
      updatedHousingDetails = JSON.parse(
        JSON.stringify(existingHousingDetails),
      );

      // Safely replace the updated house
      updatedHousingDetails[editIndex] = {
        ...housingDetail,
        cargo_details: [...housingDetail.cargo_details], // ensure fresh arrays
        charges: [...housingDetail.charges],
      };
    } else {
      // Creating a new HBL (simple append)
      updatedHousingDetails = [
        ...existingHousingDetails,
        {
          ...housingDetail,
          cargo_details: [...housingDetail.cargo_details],
          charges: [...housingDetail.charges],
        },
      ];
    }

    return updatedHousingDetails;
  };

  const navigateToJobWithHousingList = (
    updatedHousingDetails: typeof existingHousingDetails,
  ) => {
    const isInEditMode = location.state?.job && location.state.job.id;
    const navigatePath = isInEditMode
      ? "/SeaExport/import-job/edit"
      : "/SeaExport/import-job/create";

    navigate(navigatePath, {
      state: {
        fromHouseCreate: true,
        housingDetails: updatedHousingDetails,
        ...(location.state?.job && {
          job: {
            ...location.state.job,
            housing_details: updatedHousingDetails,
          },
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
        ...(location.state?.containerNumbers && {
          containerNumbers: location.state.containerNumbers,
        }),
        ...(location.state?.containerDetails && {
          containerDetails: location.state.containerDetails,
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
    navigateToJobWithHousingList(buildUpdatedHousingDetailsFromForm());
  };

  // Build current form as housing detail (for passing to invoice page) - same as AirHouseCreate
  const getCurrentHousingDetail = () => {
    const v = form.values;
    return {
      hbl_number: v.hbl_number,
      house_date: v.house_date
        ? dayjs(v.house_date).format("YYYY-MM-DD")
        : null,
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
      agent_name: v.agent_name,
      agent_address: v.agent_address,
      agent_email: v.agent_email,
      cha_name: v.cha_name,
      cha_address: v.cha_address,
      shipper_code: v.shipper_code,
      shipper_name: v.shipper_name,
      shipper_address: v.shipper_address,
      shipper_email: v.shipper_email,
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
      consignee_state_id: v.consignee_state_id
        ? Number(v.consignee_state_id)
        : ((editData as { consignee_state_id?: number } | undefined)
            ?.consignee_state_id ??
          (
            location.state?.job as {
              housing_details?: Array<{ consignee_state_id?: number }>;
            }
          )?.housing_details?.[editIndex ?? 0]?.consignee_state_id ??
          null),
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
            house_date: form.values.house_date
              ? dayjs(form.values.house_date).format("YYYY-MM-DD")
              : null,
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
  const generatePDFPreview = async () => {
    try {
      setPreviewOpen(true);

      // Get default branch from user store or use default
      const defaultBranch = user?.branches?.find(
        (branch) => branch.is_default,
      ) ||
        user?.branches?.[0] || { branch_name: "CHENNAI" };
      const country = user?.country || null;

      // Build housing data from current form
      const housingData = {
        hbl_number: form.values.hbl_number,
        house_date: form.values.house_date
          ? dayjs(form.values.house_date).format("YYYY-MM-DD")
          : null,
        routed: form.values.routed,
        routed_by: form.values.routed_by,
        origin_code: form.values.origin_code,
        origin_name: form.values.origin_name,
        destination_code: form.values.destination_code,
        destination_name: form.values.destination_name,
        customer_service: form.values.customer_service,
        trade: form.values.trade,
        agent_name: form.values.agent_name,
        agent_address: form.values.agent_address,
        agent_email: form.values.agent_email,
        shipper_name: form.values.shipper_name,
        shipper_address: form.values.shipper_address,
        shipper_email: form.values.shipper_email,
        shipper_state_id: form.values.shipper_state_id
          ? Number(form.values.shipper_state_id)
          : ((
              editData as
                { shipment_id?: string; shipper_state_id?: number } | undefined
            )?.shipper_state_id ?? null),
        shipment_id:
          (editData as { shipment_id?: string } | undefined)?.shipment_id ??
          null,
        consignee_name: form.values.consignee_name,
        consignee_address: form.values.consignee_address,
        consignee_email: form.values.consignee_email,
        consignee_gst_id:
          (editData as { consignee_gst_id?: string } | undefined)
            ?.consignee_gst_id ?? "",
        consignee_pan_no:
          (editData as { consignee_pan_no?: string } | undefined)
            ?.consignee_pan_no ??
          (
            location.state?.job as {
              housing_details?: Array<{ consignee_pan_no?: string | null }>;
            }
          )?.housing_details?.[editIndex ?? 0]?.consignee_pan_no ??
          "",
        consignee_state_code:
          (editData as { consignee_state_code?: string } | undefined)
            ?.consignee_state_code ??
          (
            location.state?.job as {
              housing_details?: Array<{
                consignee_state_code?: string | null;
              }>;
            }
          )?.housing_details?.[editIndex ?? 0]?.consignee_state_code ??
          "",
        notify1_customer_name: form.values.notify1_customer_name,
        notify1_customer_address: form.values.notify1_customer_address,
        notify1_customer_email: form.values.notify1_customer_email,
        item_no: form.values.item_no,
        sub_item_no: form.values.sub_item_no,
        commodity_description: form.values.commodity_description,
        marks_no: form.values.marks_no,
        note: form.values.note || "",
        cargo_details: cargoDetails.map((cargo) => ({
          no_of_packages: cargo.no_of_packages,
          gross_weight: formatHouseCargoWeightForPayload(cargo.gross_weight),
          volume: formatHouseCargoWeightForPayload(cargo.volume),
          chargeable_weight: formatHouseCargoChargeableForPayload(
            cargo.gross_weight,
            cargo.volume,
            "ocean",
          ),
          haz: cargo.haz === true,
        })),
        mbl_charges: (() => {
          const meaningfulCharges = getMeaningfulHouseCharges(
            chargesForm.values.charges,
          );
          if (meaningfulCharges.length === 0) return [];
          return meaningfulCharges.map((charge) => ({
            ...(charge.id != null &&
              charge.id !== undefined && { id: Number(charge.id) }),
            charge_id: charge.charge_id ?? null,
            charge_name: charge.charge_name,
            pp_cc: charge.pp_cc,
            unit_id: charge.unit_id ? Number(charge.unit_id) : null,
            unit: charge.unit_code,
            currency_id: charge.currency_id ? Number(charge.currency_id) : null,
            currency: charge.currency,
            no_of_unit: charge.no_of_unit,
            roe: roundRoeForPayload(charge.roe) ?? null,
            amount_per_unit: roundMoneyToDecimals(charge.amount_per_unit) ?? null,
            amount: roundMoneyToDecimals(charge.amount) ?? null,
            sell_local_amount:
              roundMoneyToDecimals(charge.sell_local_amount) ?? null,
            unit_cost: roundMoneyToDecimals(charge.unit_cost) ?? null,
            total_cost: roundMoneyToDecimals(charge.total_cost) ?? null,
            cost_local_amount:
              roundMoneyToDecimals(charge.cost_local_amount) ?? null,
            supplier_code: charge.supplier_code || null,
            supplier_name: charge.supplier_name || null,
          }));
        })(),
      };

      // Build job data from location state
      const jobData = {
        service: location.state?.mblDetails?.service || "FCL",
        service_type: "Import",
        ...(location.state?.job ?? {}),
        ...location.state?.mblDetails,
        ...location.state?.carrierDetails,
        actual_booking_no: location.state?.job?.actual_booking_no,
        notes: location.state?.job?.notes || [],
      };

      const blobUrl = await previewCargoArrivalNoticePDF(
        jobData,
        housingData,
        defaultBranch,
        country,
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
      link.download = `Cargo-Arrival-Notice-${form.values.hbl_number || "HBL"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  const resolveDoAttentionTo = (type: DoTypeOption) => {
    if (type === "carrier_agent") {
      const partyDetails = location.state?.mblDetails as
        | {
            carrier_agent_name?: string;
            carrier_agent_address?: string;
          }
        | undefined;
      // Prefer party details from job state when available (same as house card)
      const jobParty = location.state?.job as
        | {
            carrier_agent_name?: string;
            carrier_agent_address?: string;
          }
        | undefined;
      const name =
        partyDetails?.carrier_agent_name ||
        jobParty?.carrier_agent_name ||
        "";
      const address =
        partyDetails?.carrier_agent_address ||
        jobParty?.carrier_agent_address ||
        "";
      return [name, address].filter(Boolean).join("\n");
    }

    const allContainerSources = [
      ...(location.state?.containerDetails || []),
      ...((location.state?.job as { container_details?: unknown[] } | undefined)
        ?.container_details || []),
    ] as Array<{
      cfs_name?: string;
      cfs_address?: string;
      address?: string;
      cfs_details?: { address?: string; cfs_address?: string };
    }>;

    const mappedContainerIds = (cargoDetails || [])
      .map((cargo) => String(cargo.container_id ?? "").trim())
      .filter(Boolean);
    const mappedContainerNos = (cargoDetails || [])
      .map((cargo) => String(cargo.container_number ?? "").trim())
      .filter(Boolean);

    const matchedHouseContainer = allContainerSources.find((container) => {
      const containerId = String(
        (container as { id?: number | string }).id ?? "",
      ).trim();
      const containerNo = String(
        (container as { container_no?: string | number }).container_no ?? "",
      ).trim();
      const hasCfs = String(container.cfs_name || "").trim();
      return (
        !!hasCfs &&
        (mappedContainerIds.includes(containerId) ||
          mappedContainerNos.includes(containerNo))
      );
    });

    const firstContainerWithCfs = allContainerSources.find(
      (container: {
        cfs_name?: string;
        cfs_address?: string;
        address?: string;
        cfs_details?: { address?: string; cfs_address?: string };
      }) => (container.cfs_name || "").trim(),
    );

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

  const resolveDoDeliverTo = (deliverTo: DoDeliverToOption) => {
    if (deliverTo === "consignee") return form.values.consignee_name || "";
    if (deliverTo === "notify") return form.values.notify1_customer_name || "";
    return form.values.cha_name || "";
  };

  const openDoConfigModal = () => {
    setDoTypeSelection(null);
    setDoDeliverToSelection(null);
    setDoConfigOpen(true);
  };

  // Generate Delivery Order PDF Preview
  const generateDeliveryOrderPDFPreview = async (
    type: DoTypeOption,
    deliverTo: DoDeliverToOption,
  ) => {
    try {
      setDoPreviewOpen(true);

      // Align payload shape with house-card DO so layout/spacing match
      const mblDetails = location.state?.mblDetails || {};
      const carrierDetails = location.state?.carrierDetails || {};
      const combinedData = {
        ...location.state?.job,
        ...form.values,
        service: mblDetails.service || location.state?.job?.service || "",
        igm_no: mblDetails.igm_no || location.state?.job?.igm_no || "",
        igm_date: mblDetails.igm_date || location.state?.job?.igm_date || null,
        eta: mblDetails.eta || location.state?.job?.eta || null,
        mbl_number:
          carrierDetails.mbl_number || location.state?.job?.mbl_number || "",
        mbl_date:
          carrierDetails.mbl_date || location.state?.job?.mbl_date || null,
        vessel_name:
          carrierDetails.vessel_name || location.state?.job?.vessel_name || "",
        voyage_number:
          carrierDetails.voyage_number ||
          location.state?.job?.voyage_number ||
          "",
        mawbDetails: mblDetails,
        carrierDetails,
        containerDetails: location.state?.containerDetails || [],
      };

      // cargo_details lives in UI state, not form.values (same source as house-card DO)
      const doHousingData = {
        ...form.values,
        house_date: form.values.house_date,
        cargo_details: cargoDetails
          .filter(
            (cargo) =>
              String(cargo.container_number || "").trim() !== "" ||
              cargo.no_of_packages != null ||
              cargo.gross_weight != null ||
              cargo.volume != null,
          )
          .map((cargo) => ({
            container_no: cargo.container_number,
            container_number: cargo.container_number,
            container_id: cargo.container_id,
            no_of_packages: cargo.no_of_packages,
            gross_weight: cargo.gross_weight,
            volume: cargo.volume,
            chargeable_weight: cargo.chargeable_weight,
            haz: cargo.haz,
          })),
        attention_to: resolveDoAttentionTo(type),
        please_deliver_to: resolveDoDeliverTo(deliverTo),
        do_heading:
          type === "carrier_agent" ? "DELIVERY ADVICE" : "DELIVERY ORDER",
      };
      const blobUrl = generateDeliveryOrderPDF(combinedData, doHousingData);
      setDoPdfBlob(blobUrl);
      void patchHousingPdfReleasedEvent("DO Released").catch((e) =>
        console.error("Failed to patch PDF release event:", e),
      );
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
    if (doPdfBlob) {
      window.URL.revokeObjectURL(doPdfBlob);
    }
  };

  const handleCloseDoConfig = () => {
    setDoConfigOpen(false);
    setDoTypeSelection(null);
    setDoDeliverToSelection(null);
  };

  const handleGenerateDeliveryOrderFromConfig = () => {
    if (!doTypeSelection || !doDeliverToSelection) {
      ToastNotification({
        type: "error",
        message: "Type and Deliver to are required",
      });
      return;
    }
    setDoConfigOpen(false);
    generateDeliveryOrderPDFPreview(doTypeSelection, doDeliverToSelection);
  };

  // Handle download DO PDF
  const handleDownloadDoPDF = () => {
    if (doPdfBlob) {
      const link = document.createElement("a");
      link.href = doPdfBlob;
      link.download = `Delivery-Order-${form.values.hbl_number || "HBL"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  return (
    <Box p="md" mx="auto">
      <Group justify="space-between" mb="lg">
        <Group gap="md">
          <Text size="xl" fw={600} c="#105476">
            {isEditMode ? "Edit HBL Details" : "Create HBL Details"}
          </Text>
          {isEditMode && editData?.shipment_id && (
            <Badge color="#105476" size="md" variant="light">
              Shipment ID: {editData.shipment_id}
            </Badge>
          )}
        </Group>
        {/* Save button moved to top */}
        <Group gap="xs">
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
              })
            }
          >
            Back to Import Job
          </Button> */}
          <Button
            color="#105476"
            variant="outline"
            onClick={() => {
              if (active === 0) {
                if (!validateStep1()) return;
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
              } else if (active === 1) {
                if (!validateStep2()) return;
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
                if (!validateStep3()) return;
                if (!validateStep4()) {
                  setActive(3);
                  return;
                }
                handleSave();
              } else if (active === 3) {
                if (!validateStep4()) return;
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
                onClick={generatePDFPreview}
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
                onClick={openDoConfigModal}
              >
                Delivery Order
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

              <HouseCreateAgentInvoiceMenuItem
                invoicePath="/SeaExport/import-job/invoice"
                serviceType={location.state?.mblDetails?.service || "FCL"}
                getCurrentHousingDetail={getCurrentHousingDetail}
                jobId={location.state?.job?.id}
              />

              <HouseAutomateVendorInvoiceMenuItem
                getCurrentHousingDetail={getCurrentHousingDetail}
                jobId={location.state?.job?.id}
                onOpen={openVendorInvoiceAutomation}
              />

              <HouseJobLedgerMenuItem
                serviceName="Ocean Import"
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
                  label="HBL Number"
                  required
                  placeholder="Enter HBL Number"
                  {...form.getInputProps("hbl_number")}
                  error={form.errors.hbl_number}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <SearchableSelect
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  dropdownZIndex={10}
                  placeholder="Type origin code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={portDisplayFormat}
                  value={form.values.origin_code}
                  displayValue={
                    form.values.origin_name
                      ? `${form.values.origin_name} (${form.values.origin_code})`
                      : form.values.origin_code || ""
                  }
                  onChange={(value, selectedData) => {
                    if (value === null) {
                      form.setFieldValue(`origin_code`, "");
                      form.setFieldValue(`origin_name`, "");
                      return;
                    }
                    form.setFieldValue("origin_code", value || "");
                    if (selectedData) {
                      form.setFieldValue(
                        "origin_name",
                        selectedData.label.split(" (")[0] || "",
                      );
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
                  dropdownZIndex={10}
                  placeholder="Type destination code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={portDisplayFormat}
                  value={form.values.destination_code}
                  displayValue={
                    form.values.destination_name
                      ? `${form.values.destination_name} (${form.values.destination_code})`
                      : form.values.destination_code || ""
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
                      form.setFieldValue(
                        "destination_name",
                        selectedData.label.split(" (")[0] || "",
                      );
                    } else if (!value) {
                      form.setFieldValue("destination_name", "");
                    }

                    // Update Trade field immediately based on comparison
                    const mblDestinationCode =
                      location.state?.mblDetails?.destination_code || "";

                    console.log("🔍 Comparing destinations:", {
                      hblDestinationCode,
                      mblDestinationCode,
                      match: hblDestinationCode === mblDestinationCode,
                    });

                    if (hblDestinationCode && mblDestinationCode) {
                      // Compare HBL destination with MBL destination
                      const newTradeValue =
                        hblDestinationCode === mblDestinationCode
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
                        "⚠️ No MBL destination found, cannot update Trade",
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
                  {...form.getInputProps("shipment_terms_code")}
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
                    dropdownZIndex={10}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={customerNameOnlyDisplayFormat}
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
                  label="Item Number"
                  placeholder="Enter Item Number"
                  {...form.getInputProps("item_no")}
                  error={form.errors.item_no}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <FormTextInput
                  label="Sub Item Number"
                  placeholder="Enter Sub Item Number"
                  {...form.getInputProps("sub_item_no")}
                  error={form.errors.sub_item_no}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <FormTextInput
                  label="Customer Ref No"
                  placeholder="Enter Customer Ref No"
                  {...form.getInputProps("ref_no")}
                  error={form.errors.ref_no}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <SingleDateInput
                  label="HBL Date"
                  placeholder="Select HBL Date"
                  value={form.values.house_date}
                  onChange={(d) => form.setFieldValue("house_date", d)}
                  size="sm"
                />
              </Grid.Col>

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
                    }}
                    error={form.errors.shipper_name as string}
                  />
                ) : (
                  <Select
                    label="Shipper Name"
                    required
                    placeholder="Select or search shipper"
                    searchable
                    data={shipperOptions}
                    searchValue={shipperSearch}
                    onSearchChange={(value) => {
                      const v = toTitleCase(value);
                      setShipperSearch(v);
                      if (!v.trim()) {
                        form.setFieldValue("shipper_code", "");
                        form.setFieldValue("shipper_name", "");
                        form.setFieldValue("shipper_address", "");
                        form.setFieldValue("shipper_email", "");
                        form.setFieldValue("shipper_state_id", "");
                        setShipperAddressOptions([]);
                        setShipperManualMode(false);
                        setShipperOptions([]);
                        shipperDataRef.current = {};
                        return;
                      }
                      debouncedShipperSearch(v);
                    }}
                    value={form.values.shipper_code || ""}
                    clearable
                    onChange={(value) => {
                      if (!value) {
                        form.setFieldValue("shipper_code", "");
                        form.setFieldValue("shipper_name", "");
                        form.setFieldValue("shipper_address", "");
                        form.setFieldValue("shipper_email", "");
                        form.setFieldValue("shipper_state_id", "");
                        setShipperSearch("");
                        setShipperAddressOptions([]);
                        setShipperManualMode(false);
                        setShipperOptions([]);
                        shipperDataRef.current = {};
                        return;
                      }
                      const original = shipperDataRef.current[value] || {};
                      const name = String(
                        (original as Record<string, unknown>).customer_name ||
                          "",
                      );
                      const email = getPartyEmail(
                        original as Record<string, unknown>,
                      );
                      const addressesData = getPartyAddresses(
                        original as Record<string, unknown>,
                      );
                      const addressOptions = addressesData
                        .filter((a) => a.address)
                        .map((a) => {
                          const addr = toTitleCase(String(a.address || ""));
                          return { value: addr, label: addr };
                        });

                      // Reset address value so it always replaces on re-select
                      form.setFieldValue("shipper_address", "");
                      setShipperAddressOptions(addressOptions);
                      if (addressOptions.length > 0) {
                        form.setFieldValue(
                          "shipper_address",
                          addressOptions[0].value,
                        );
                      }

                      const addressesDataFull = Array.isArray(
                        (original as Record<string, unknown>).addresses_data,
                      )
                        ? ((original as Record<string, unknown>)
                            .addresses_data as Array<{
                            address?: string;
                            state_id?: number | null;
                            address_type?: string | null;
                          }>)
                        : [];
                      const primaryAddr = addressesDataFull.find(
                        (a) =>
                          String(a.address_type || "").toUpperCase() ===
                          "PRIMARY",
                      );
                      const addrWithState =
                        primaryAddr ||
                        addressesDataFull.find((a) => a.state_id != null);
                      if (addrWithState?.state_id != null) {
                        form.setFieldValue(
                          "shipper_state_id",
                          String(addrWithState.state_id),
                        );
                      } else {
                        form.setFieldValue("shipper_state_id", "");
                      }

                      const customerCodeRaw = (
                        original as Record<string, unknown>
                      ).customer_code;
                      const customerCode =
                        customerCodeRaw != null &&
                        String(customerCodeRaw).trim() !== ""
                          ? String(customerCodeRaw).trim()
                          : String(value ?? "").trim();
                      form.setFieldValue("shipper_code", customerCode);
                      form.setFieldValue("shipper_name", toTitleCase(name));
                      form.setFieldValue("shipper_email", email);
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
                {shipperAddressOptions.length > 0 ? (
                  <Dropdown
                    key={`shipper-address-${form.values.shipper_code || "none"}`}
                    label="Shipper Address"
                    placeholder="Select shipper address"
                    searchable
                    data={shipperAddressOptions}
                    value={form.values.shipper_address || ""}
                    onChange={(value) => {
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue("shipper_address", formattedValue);
                    }}
                    error={form.errors.shipper_address}
                  />
                ) : (
                  <FormTextInput
                    label="Shipper Address"
                    placeholder="Enter shipper address"
                    value={form.values.shipper_address || ""}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue("shipper_address", formattedValue);
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
                  displayFormat={customerCodeNameDisplayFormat}
                  value={form.values.consignee_code}
                  displayValue={form.values.consignee_name}
                  onChange={(value, selectedData, originalData) => {
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
                    form.setFieldValue("consignee_email", email);

                    const addressesData = Array.isArray(original.addresses_data)
                      ? (original.addresses_data as Array<{
                          address?: string;
                          state_id?: number | null;
                          address_type?: string | null;
                        }>)
                      : [];
                    const addressOptions = addressesData
                      .filter((a) => a.address)
                      .map((a) => {
                        const addr = toTitleCase(String(a.address || ""));
                        return { value: addr, label: addr };
                      });
                    setConsigneeAddressOptions(addressOptions);

                    if (addressOptions.length > 0) {
                      form.setFieldValue(
                        "consignee_address",
                        addressOptions[0].value,
                      );
                    } else {
                      if (!value) form.setFieldValue("consignee_address", "");
                    }

                    if (!value) {
                      form.setFieldValue("consignee_state_id", "");
                      return;
                    }
                    const primaryAddress = addressesData.find(
                      (a) =>
                        String(a.address_type || "").toUpperCase() ===
                        "PRIMARY",
                    );
                    const addrForState =
                      primaryAddress ||
                      addressesData.find((a) => a.state_id != null);
                    if (addrForState?.state_id != null) {
                      form.setFieldValue(
                        "consignee_state_id",
                        String(addrForState.state_id),
                      );
                    } else {
                      form.setFieldValue("consignee_state_id", "");
                    }
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
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue("consignee_address", formattedValue);
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
                  dropdownZIndex={10}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={customerCodeNameDisplayFormat}
                  value={
                    form.values.notify1_customer_name
                      ? String(form.values.notify1_customer_name)
                      : ""
                  }
                  displayValue={form.values.notify1_customer_name}
                  onChange={(_value, _selectedData, originalData) => {
                    const newValue = _selectedData?.label || "";
                    form.setFieldValue("notify1_customer_name", newValue);

                    if (
                      newValue &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      const addressOptions = (
                        (originalData as Record<string, unknown>)
                          .addresses_data as Array<{
                          id: number;
                          address: string;
                        }>
                      ).map((addr: { id: number; address: string }) => ({
                        value: addr.address,
                        label: addr.address,
                      }));

                      setNotifyCustomerAddressOptions(addressOptions);

                      if (
                        addressOptions.length > 0 &&
                        addressOptions[0].value
                      ) {
                        form.setFieldValue(
                          "notify1_customer_address",
                          addressOptions[0].value,
                        );
                      } else {
                        form.setFieldValue("notify1_customer_address", "");
                      }
                    } else {
                      setNotifyCustomerAddressOptions([]);
                      form.setFieldValue("notify1_customer_address", "");
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
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue(
                        "notify1_customer_address",
                        formattedValue,
                      );
                    }}
                    error={form.errors.notify1_customer_address}
                  />
                ) : (
                  <FormTextArea
                    label="Notify Customer Address"
                    placeholder="Enter Notify Customer Address"
                    value={form.values.notify1_customer_address}
                    onChange={(e) => {
                      form.setFieldValue(
                        "notify1_customer_address",
                        e.currentTarget.value,
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
                  dropdownZIndex={10}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={customerNameOnlyDisplayFormat}
                  value={form.values.agent_name}
                  displayValue={form.values.agent_name}
                  onChange={(_value, _selectedData, originalData) => {
                    const newValue = _value || "";
                    form.setFieldValue("agent_name", newValue);
                    const code =
                      (originalData as Record<string, unknown> | undefined)
                        ?.customer_code != null
                        ? String(
                            (originalData as Record<string, unknown>)
                              .customer_code,
                          )
                        : "";
                    form.setFieldValue("agent_code", code);

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
                      }>;

                      const addressOptions = addressesData.map(
                        (addr: { id: number; address: string }) => ({
                          value: addr.address,
                          label: addr.address,
                        }),
                      );

                      setOriginAgentAddressOptions(addressOptions);

                      if (
                        addressOptions.length > 0 &&
                        addressOptions[0].value
                      ) {
                        form.setFieldValue(
                          "agent_address",
                          addressOptions[0].value,
                        );
                      } else {
                        form.setFieldValue("agent_address", "");
                      }
                    } else {
                      setOriginAgentAddressOptions([]);
                      form.setFieldValue("agent_address", "");
                      form.setFieldValue("agent_code", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.agent_name as string}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  label="Origin Agent Email"
                  type="email"
                  format="normal"
                  placeholder="Enter Origin Agent Email"
                  {...form.getInputProps("agent_email")}
                  error={form.errors.agent_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                {originAgentAddressOptions.length > 0 ? (
                  <Dropdown
                    label="Origin Agent Address"
                    placeholder="Select origin agent address"
                    searchable
                    data={originAgentAddressOptions}
                    value={form.values.agent_address || ""}
                    onChange={(value) => {
                      const formattedValue = value ? toTitleCase(value) : "";
                      form.setFieldValue("agent_address", formattedValue);
                    }}
                    error={form.errors.agent_address}
                  />
                ) : (
                  <FormTextArea
                    label="Origin Agent Address"
                    placeholder="Enter Origin Agent Address"
                    value={form.values.agent_address}
                    onChange={(e) => {
                      form.setFieldValue(
                        "agent_address",
                        e.currentTarget.value,
                      );
                    }}
                    error={form.errors.agent_address}
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
                  displayFormat={customerCodeNameDisplayFormat}
                  value={form.values.cha_code || null}
                  displayValue={form.values.cha_name}
                  onChange={(_value, _selectedData, originalData) => {
                    const chaCode = _value || "";
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
                  dropdownZIndex={1000}
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
              Cargo Details{" "}
              {cargoDetails.length > 1 && `(${cargoDetails.length})`}
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
                  {...form.getInputProps("marks_no")}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Dropdown
                  label="Item Type"
                  placeholder="Select Item Type"
                  searchable
                  data={ITEM_TYPE_OPTIONS}
                  value={form.values.item_type || null}
                  onChange={(value) =>
                    form.setFieldValue("item_type", value || "")
                  }
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <FormTextInput
                  label="HS Code"
                  placeholder="Enter HS Code"
                  maxLength={6}
                  value={form.values.hscode || ""}
                  onChange={(e) => {
                    const next = e.currentTarget.value.slice(0, 6);
                    form.setFieldValue("hscode", next);
                  }}
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
                <Grid.Col span={1.5}>
                  <RequiredLabel label="Container Number" required={true} />
                </Grid.Col>
                <Grid.Col span={1.6}>
                  <RequiredLabel label="Package Type" required={false} />
                </Grid.Col>
                <Grid.Col span={1.2}>
                  <RequiredLabel label="No of Packages" required={true} />
                </Grid.Col>
                <Grid.Col span={1.6}>
                  <RequiredLabel label="Gross Weight (KG)" required={true} />
                </Grid.Col>
                <Grid.Col span={1.6}>
                  <RequiredLabel label="Volume (CBM)" required={true} />
                </Grid.Col>
                <Grid.Col span={1.6}>
                  <RequiredLabel
                    label="Chargeable Weight (CBM)"
                    required={false}
                  />
                </Grid.Col>
                <Grid.Col span={1.2}>
                  <RequiredLabel label="Haz" required={false} />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <RequiredLabel label="Actions" required={false} />
                </Grid.Col>
              </Grid>

              {cargoDetails.map((cargo, index) => (
                <Grid key={index} gutter="sm" mb="xs">
                  <Grid.Col span={1.5}>
                    <Dropdown
                      placeholder={
                        containerNumberOptions.length > 0
                          ? "Select Container Number"
                          : "No containers available"
                      }
                      searchable
                      data={containerNumberOptions}
                      value={cargo.container_number || null}
                      onChange={(value) => {
                        const containerDetails =
                          location.state?.containerDetails || [];
                        const matchedContainer = containerDetails.find(
                          (container: Record<string, unknown>) =>
                            container.container_no === value,
                        );
                        const containerId =
                          matchedContainer?.id !== undefined &&
                          matchedContainer?.id !== null
                            ? typeof matchedContainer.id === "number"
                              ? matchedContainer.id
                              : Number(matchedContainer.id)
                            : undefined;

                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          container_number: value || "",
                          container_id: containerId,
                        };
                        setCargoDetails(updated);

                        if (cargoErrors[index]?.container_number) {
                          const newErrors = { ...cargoErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].container_number;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setCargoErrors(newErrors);
                        }
                      }}
                      disabled={containerNumberOptions.length === 0}
                      clearable
                      error={cargoErrors[index]?.container_number}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.6}>
                    <Dropdown
                      placeholder="Package Type"
                      searchable
                      data={PACKAGE_TYPE_OPTIONS}
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
                  <Grid.Col span={1.2}>
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
                  <Grid.Col span={1.6}>
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
                          "ocean",
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
                          "ocean",
                        );
                        setCargoDetails(updated);
                      }}
                      error={cargoErrors[index]?.gross_weight}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.6}>
                    <FormNumberInput
                      placeholder="Enter Volume"
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
                          "ocean",
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
                          "ocean",
                        );
                        setCargoDetails(updated);
                      }}
                      error={cargoErrors[index]?.volume}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.6}>
                    <FormTextInput
                      placeholder=""
                      format="normal"
                      value={formatHouseCargoChargeableDisplay(
                        cargo.gross_weight,
                        cargo.volume,
                        "ocean",
                      )}
                      readOnly
                      disabled
                      styles={{
                        input: {
                          backgroundColor: "#f5f5f5",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.2}>
                    <Dropdown
                      placeholder="Select Haz"
                      searchable
                      data={[
                        { value: "Yes", label: "Yes" },
                        { value: "No", label: "No" },
                      ]}
                      value={
                        cargo.haz === true
                          ? "Yes"
                          : cargo.haz === false
                            ? "No"
                            : null
                      }
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          haz: value === "Yes" ? true : false,
                        };
                        setCargoDetails(updated);
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.7}>
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
                                container_number: "",
                                package_type: "",
                                no_of_packages: null,
                                gross_weight: null,
                                volume: null,
                                chargeable_weight: null,
                                haz: null,
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
                Charges{" "}
                {chargesForm.values.charges.length > 1 &&
                  ` (${chargesForm.values.charges.length})`}
              </Text>
              {location.state?.job?.id != null && (
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
                            fullDetail?.hbl_number ??
                              fullDetail?.hbl_no ??
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
                          serviceType:
                            location.state?.mblDetails?.service || "FCL",
                          voucherType: "OCEAN IMPORTS",
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
                      // For ocean import customer invoice, only Collect charges
                      const collectCharges = (fullDetail.charges ?? []).filter(
                        (c: { pp_cc?: string }) =>
                          String(c.pp_cc ?? "").trim() === "Collect",
                      );
                      const detailForInvoice = {
                        ...fullDetail,
                        charges: collectCharges,
                      };
                      navigate("/SeaExport/import-job/credit-note", {
                        state: {
                          serviceType:
                            location.state?.mblDetails?.service || "FCL",
                          hawbDetails: [detailForInvoice],
                          housingDetails: [detailForInvoice],
                          is_agent: false,
                          // Explicitly indicate that Bill To / State / Address should come from consignee
                          billToFrom: "consignee",
                          ...(location.state?.job && {
                            job: location.state.job,
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
                    Create Credit Note
                  </Button>
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => {
                      const fullDetail = getCurrentHousingDetail();
                      // For ocean import customer invoice, only Collect charges
                      const collectCharges = (fullDetail.charges ?? []).filter(
                        (c: { pp_cc?: string }) =>
                          String(c.pp_cc ?? "").trim() === "Collect",
                      );
                      const detailForInvoice = {
                        ...fullDetail,
                        charges: collectCharges,
                      };
                      navigate("/SeaExport/import-job/invoice", {
                        state: {
                          serviceType:
                            location.state?.mblDetails?.service || "FCL",
                          hawbDetails: [detailForInvoice],
                          housingDetails: [detailForInvoice],
                          is_agent: false,
                          // Explicitly indicate that Bill To / State / Address should come from consignee
                          billToFrom: "consignee",
                          ...(location.state?.job && {
                            job: location.state.job,
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
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={1.4}>
                  <RequiredLabel label="Charge Name" required={true} />
                </Grid.Col>
                <Grid.Col span={0.9}>
                  <RequiredLabel label="Prepaid / Collect" required={true} />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <RequiredLabel label="Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.8}>
                  <RequiredLabel label="Currency" required={true} />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <RequiredLabel label="ROE" required={true} />
                </Grid.Col>
                <Grid.Col span={0.7}>
                  <RequiredLabel label="No of Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Amount/Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Amount" required={true} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Sell Local Amt" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Cost/Unit" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Total Cost" required={false} />
                </Grid.Col>
                <Grid.Col span={0.85}>
                  <RequiredLabel label="Cost Local Amt" required={false} />
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
                  <Grid.Col span={1.5}>
                    <SearchableSelect
                      placeholder="Type charge name"
                      apiEndpoint={URL.chargeMaster}
                      searchFields={["charge_name", "charge_code"]}
                      displayFormat={chargeNameDisplayFormat}
                      value={
                        charge.charge_id != null
                          ? String(charge.charge_id)
                          : null
                      }
                      displayValue={charge.charge_name || undefined}
                      onChange={(value, selectedData) => {
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
                  <Grid.Col span={0.75}>
                    <Dropdown
                      placeholder="Prepaid/Collect"
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
                            if (Object.keys(newErrors[index]).length === 0)
                              delete newErrors[index];
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.pp_cc}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.75}>
                    <Dropdown
                      placeholder="Unit"
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
                          jobChargeNoOfUnitContext,
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
                  <Grid.Col span={0.75}>
                    <Dropdown
                      placeholder="Currency"
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
                  <Grid.Col span={0.75}>
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
                              if (Object.keys(newErrors[index]).length === 0)
                                delete newErrors[index];
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
                      value={
                        chargesForm.values.charges[index].no_of_unit ??
                        undefined
                      }
                      onChange={(value) => {
                        const noOfUnit = value as number | null;
                        chargesForm.setFieldValue(
                          `charges.${index}.no_of_unit`,
                          noOfUnit,
                        );
                        const currentCharge = chargesForm.values.charges[index];
                        if (
                          currentCharge.amount_per_unit != null &&
                          currentCharge.amount_per_unit > 0 &&
                          noOfUnit != null &&
                          noOfUnit > 0
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.amount`,
                            roundMoneyAmountBound(
                              noOfUnit * currentCharge.amount_per_unit,
                            ),
                          );
                        }
                        if (
                          currentCharge.unit_cost != null &&
                          currentCharge.unit_cost > 0 &&
                          noOfUnit != null &&
                          noOfUnit > 0
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.total_cost`,
                            roundMoneyAmountBound(
                              noOfUnit * currentCharge.unit_cost,
                            ),
                          );
                        }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Amount/Unit"
                      min={0}
                      hideControls
                      decimalScale={amountDecimalScale}
                      value={charge.amount_per_unit || undefined}
                      onChange={(value) => {
                        const amountPerUnit = value as number | null;
                        chargesForm.setFieldValue(
                          `charges.${index}.amount_per_unit`,
                          amountPerUnit,
                        );
                        const currentCharge = chargesForm.values.charges[index];
                        if (
                          amountPerUnit != null &&
                          amountPerUnit > 0 &&
                          currentCharge.no_of_unit != null &&
                          currentCharge.no_of_unit > 0
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.amount`,
                            roundMoneyAmountBound(
                              currentCharge.no_of_unit * amountPerUnit,
                            ),
                          );
                        }
                        if (chargeErrors[index]?.amount_per_unit) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].amount_per_unit;
                            if (Object.keys(newErrors[index]).length === 0)
                              delete newErrors[index];
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
                      decimalScale={amountDecimalScale}
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
                            if (Object.keys(newErrors[index]).length === 0)
                              delete newErrors[index];
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.amount}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.85}>
                    <FormNumberInput
                      placeholder="Sell Local Amt"
                      min={0}
                      hideControls
                      decimalScale={amountDecimalScale}
                      value={charge.sell_local_amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.sell_local_amount`,
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
                      decimalScale={amountDecimalScale}
                      value={charge.unit_cost || undefined}
                      onChange={(value) => {
                        const unitCost = value as number | null;
                        chargesForm.setFieldValue(
                          `charges.${index}.unit_cost`,
                          unitCost,
                        );
                        const currentCharge = chargesForm.values.charges[index];
                        if (
                          unitCost != null &&
                          unitCost > 0 &&
                          currentCharge.no_of_unit != null &&
                          currentCharge.no_of_unit > 0
                        ) {
                          chargesForm.setFieldValue(
                            `charges.${index}.total_cost`,
                            roundMoneyAmountBound(
                              currentCharge.no_of_unit * unitCost,
                            ),
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
                      decimalScale={amountDecimalScale}
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
                      placeholder="Cost Local Amt"
                      min={0}
                      hideControls
                      decimalScale={amountDecimalScale}
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
                      displayFormat={customerCodeNameDisplayFormat}
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
                            unit_code: "",
                            no_of_unit: null,
                            ...branchCurrencyDefaults,
                            amount_per_unit: null,
                            amount: null,
                            sell_local_amount: null,
                            unit_cost: null,
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
                house={{
                  charges: getMeaningfulHouseCharges(
                    chargesForm.values.charges,
                  ),
                  mawb_charges: (editData as { mawb_charges?: unknown })
                    ?.mawb_charges as
                    | Array<{
                        sell_local_amount?: unknown;
                        cost_local_amount?: unknown;
                      }>
                    | undefined,
                  mbl_charges: (editData as { mbl_charges?: unknown })
                    ?.mbl_charges as
                    | Array<{
                        sell_local_amount?: unknown;
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
                                                      parentRow={row}
                                                      jobBasePath="/SeaExport/import-job"
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

      <HousePageDocumentsModal documents={housePageDocuments} />

      <Group justify="space-between" mt="xl">
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => {
            if (isEditMode && editIndex !== undefined) {
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
          <HousePageDocumentsButton documents={housePageDocuments} />
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
          {active === 3 && (
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
        title={`Cargo Arrival Notice - ${form.values.hbl_number || "HBL"}`}
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

      <Modal
        opened={doConfigOpen}
        onClose={handleCloseDoConfig}
        title="Delivery Order Options"
        centered
        size="md"
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
            <Button
              color="#105476"
              onClick={handleGenerateDeliveryOrderFromConfig}
            >
              Generate PDF
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delivery Order PDF Preview Modal */}
      <Modal
        opened={doPreviewOpen}
        onClose={handleCloseDoPreview}
        title={`Delivery Order - ${form.values.hbl_number || "HBL"}`}
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

      <VendorInvoiceAutomationModal
        opened={vendorInvoiceAutomationShipmentNo != null}
        shipmentNo={vendorInvoiceAutomationShipmentNo ?? ""}
        onClose={() => setVendorInvoiceAutomationShipmentNo(null)}
      />
    </Box>
  );
}

export default HouseCreate;
